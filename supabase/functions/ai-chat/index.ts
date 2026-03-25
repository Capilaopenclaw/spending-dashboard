/**
 * ai-chat: Conversational financial assistant
 *
 * POST /ai-chat
 * Body: { message: string }
 *
 * Streams response via SSE. Stores conversation in chat_messages.
 * CRITICAL: Excludes transfers from all financial context.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseClient, getSupabaseAdmin } from '../_shared/supabase.ts'
import { streamClaude, callClaude, extractText } from '../_shared/claude.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabase = getSupabaseClient(req)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { message, stream = true } = body

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'message is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Store user message
    await supabaseAdmin.from('chat_messages').insert({
      user_id: user.id,
      role: 'user',
      content: message.trim(),
    })

    // Load user profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('language, currency')
      .eq('id', user.id)
      .single()

    const lang = profile?.language || 'sk'
    const currency = profile?.currency || 'EUR'

    // Load last 30 days of financial context (excluding transfers)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const fmt = (d: Date) => d.toISOString().split('T')[0]

    const { data: transactions } = await supabaseAdmin
      .from('transactions')
      .select('amount, currency, date, merchant_name, cleaned_description, categories(name_sk, slug)')
      .eq('user_id', user.id)
      .eq('is_transfer', false)
      .gte('date', fmt(thirtyDaysAgo))
      .order('date', { ascending: false })

    // Aggregate context
    const txns = transactions || []
    let totalSpending = 0
    let totalIncome = 0
    const byCategory: Record<string, { total: number; count: number; name: string }> = {}
    const byMerchant: Record<string, { total: number; count: number }> = {}

    for (const t of txns) {
      if (t.amount < 0) {
        const abs = Math.abs(t.amount)
        totalSpending += abs
        const cat = (t.categories as any)?.slug || 'uncategorized'
        const catName = (t.categories as any)?.name_sk || 'Nekategorizované'
        byCategory[cat] = byCategory[cat] || { total: 0, count: 0, name: catName }
        byCategory[cat].total += abs
        byCategory[cat].count++
        const m = t.merchant_name || 'unknown'
        byMerchant[m] = byMerchant[m] || { total: 0, count: 0 }
        byMerchant[m].total += abs
        byMerchant[m].count++
      } else {
        totalIncome += t.amount
      }
    }

    // Get account balances
    const { data: accounts } = await supabaseAdmin
      .from('accounts')
      .select('account_name, current_balance, currency')
      .eq('user_id', user.id)
      .eq('is_active', true)

    // Load recent chat history for context
    const { data: chatHistory } = await supabaseAdmin
      .from('chat_messages')
      .select('role, content')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    const topCategories = Object.entries(byCategory)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 8)
      .map(([slug, v]) => `${v.name}: €${v.total.toFixed(2)} (${v.count}x)`)
      .join('\n')

    const topMerchants = Object.entries(byMerchant)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([name, v]) => `${name}: €${v.total.toFixed(2)} (${v.count}x)`)
      .join('\n')

    const accountInfo = (accounts || [])
      .map(a => `${a.account_name}: €${a.current_balance?.toFixed(2) || '?'}`)
      .join('\n')

    const langMap: Record<string, string> = { sk: 'Slovak', en: 'English', hu: 'Hungarian' }

    const systemPrompt = `You are a helpful personal finance assistant for a Slovak user.
Respond in ${langMap[lang] || 'Slovak'}.

FINANCIAL CONTEXT (last 30 days, transfers between own accounts excluded):
- Total spending: €${totalSpending.toFixed(2)}
- Total income: €${totalIncome.toFixed(2)}
- Transaction count: ${txns.length}

Top categories:
${topCategories || 'No categorized spending'}

Top merchants:
${topMerchants || 'No merchant data'}

Account balances:
${accountInfo || 'No account data'}

RULES:
- Be concise and helpful
- Use specific numbers from the context
- All transfer transactions between user's own accounts are already excluded
- If asked about subscriptions, look for recurring merchants
- Currency: ${currency}
- If you don't have enough data, say so honestly
- Keep responses under 300 words`

    // Build messages array with chat history
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []
    if (chatHistory && chatHistory.length > 0) {
      // Reverse to chronological order, skip the last user message (we'll add it fresh)
      const history = [...chatHistory].reverse()
      for (const msg of history.slice(0, -1)) {
        messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content })
      }
    }
    messages.push({ role: 'user', content: message.trim() })

    if (stream) {
      // Streaming response
      const responseStream = streamClaude(systemPrompt, messages, { maxTokens: 1024, temperature: 0.5 })

      // We need to collect the full response for storage
      // Use a TransformStream to tee and collect
      let fullResponse = ''
      const transform = new TransformStream({
        transform(chunk, controller) {
          const text = new TextDecoder().decode(chunk)
          // Extract text content for storage
          const lines = text.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.type === 'text') fullResponse += data.text
                if (data.type === 'done') {
                  // Store assistant response
                  supabaseAdmin.from('chat_messages').insert({
                    user_id: user.id,
                    role: 'assistant',
                    content: fullResponse,
                  }).then(() => {})
                }
              } catch { /* skip */ }
            }
          }
          controller.enqueue(chunk)
        },
      })

      const outputStream = responseStream.pipeThrough(transform)

      return new Response(outputStream, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    } else {
      // Non-streaming response
      const response = await callClaude(systemPrompt, messages, { maxTokens: 1024, temperature: 0.5 })
      const assistantMessage = extractText(response)

      // Store assistant response
      await supabaseAdmin.from('chat_messages').insert({
        user_id: user.id,
        role: 'assistant',
        content: assistantMessage,
      })

      return new Response(
        JSON.stringify({ success: true, message: assistantMessage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('ai-chat error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
