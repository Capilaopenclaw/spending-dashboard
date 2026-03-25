/**
 * ai-categorize: Batch transaction categorization using Claude
 *
 * POST /ai-categorize
 * Body: { user_id?: string } (optional - for cron/internal calls)
 *
 * CRITICAL: Only processes transactions where is_transfer = false
 * Transfers are auto-assigned "Prevody" category without AI call.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseClient, getSupabaseAdmin } from '../_shared/supabase.ts'
import { callClaude, extractText } from '../_shared/claude.ts'

const BATCH_SIZE = 50

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabaseAdmin = getSupabaseAdmin()
    let userId: string

    // Support both authenticated user calls and service-level calls
    const authHeader = req.headers.get('Authorization')
    
    if (authHeader?.startsWith('Bearer ') && authHeader.length > 50) {
      const supabase = getSupabaseClient(req)
      const { data: { user: authUser }, error } = await supabase.auth.getUser()
      if (!error && authUser) {
        userId = authUser.id
      }
    }

    if (!userId) {
      const body = await req.json().catch(() => ({}))
      if (body.user_id) {
        userId = body.user_id
      }
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User identity required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Step 1: Auto-categorize transfers with "Prevody" category
    const { data: transferCategory } = await supabaseAdmin
      .from('categories')
      .select('id')
      .eq('slug', 'transfers')
      .single()

    if (transferCategory) {
      await supabaseAdmin
        .from('transactions')
        .update({
          category_id: transferCategory.id,
          category_confidence: 1.0,
        })
        .eq('user_id', userId)
        .eq('is_transfer', true)
        .is('category_id', null)
    }

    // Step 2: Get uncategorized non-transfer transactions
    const { data: uncategorized, error: fetchErr } = await supabaseAdmin
      .from('transactions')
      .select('id, merchant_name, cleaned_description, amount, currency, date')
      .eq('user_id', userId)
      .eq('is_transfer', false)
      .eq('is_category_user_corrected', false)
      .is('category_id', null)
      .order('date', { ascending: false })
      .limit(200) // Process up to 200 per invocation

    if (fetchErr) throw fetchErr
    if (!uncategorized || uncategorized.length === 0) {
      return new Response(JSON.stringify({ success: true, categorized: 0, message: 'No uncategorized transactions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Step 3: Load categories
    const { data: categories } = await supabaseAdmin
      .from('categories')
      .select('id, name_sk, slug')
      .order('sort_order')

    if (!categories || categories.length === 0) {
      throw new Error('No categories found in database')
    }

    // Step 4: Load user corrections for learning context
    const { data: corrections } = await supabaseAdmin
      .from('transactions')
      .select('merchant_name, cleaned_description, amount, category_id, categories(name_sk, slug)')
      .eq('user_id', userId)
      .eq('is_category_user_corrected', true)
      .eq('is_transfer', false)
      .order('updated_at', { ascending: false })
      .limit(50)

    // Step 5: Process in batches
    const categoryMap = Object.fromEntries(categories.map(c => [c.slug, c.id]))
    const categoryList = categories.map(c => `${c.slug}: ${c.name_sk}`).join('\n')

    let totalCategorized = 0

    for (let i = 0; i < uncategorized.length; i += BATCH_SIZE) {
      const batch = uncategorized.slice(i, i + BATCH_SIZE)

      const correctionsContext = corrections && corrections.length > 0
        ? `\n\nUsed corrections from user (learn from these patterns):\n${corrections.map((c: any) =>
            `- "${c.merchant_name || c.cleaned_description}" (${c.amount} EUR) → ${c.categories?.slug || 'unknown'}`
          ).join('\n')}`
        : ''

      const systemPrompt = `You are a transaction categorizer for a Slovak personal finance app.
Given a list of bank transactions, assign each one to the most appropriate category.

Available categories:
${categoryList}

${correctionsContext}

RULES:
- Return ONLY valid JSON array
- Each item: { "id": "transaction_id", "category": "category_slug", "confidence": 0.00-1.00 }
- Use confidence 0.90+ for obvious matches (e.g., Kaufland → groceries)
- Use confidence 0.50-0.89 for reasonable guesses
- Use "other" category with low confidence if truly unclear
- Pay attention to merchant names — they're the strongest signal
- Learn from user corrections above — if user corrected a merchant, use that category for similar merchants`

      const userMessage = `Categorize these transactions:\n${JSON.stringify(
        batch.map(t => ({
          id: t.id,
          merchant: t.merchant_name,
          description: t.cleaned_description,
          amount: t.amount,
          date: t.date,
        })),
        null,
        2
      )}`

      try {
        const response = await callClaude(systemPrompt, [{ role: 'user', content: userMessage }], {
          maxTokens: 2048,
          temperature: 0.1,
        })

        const text = extractText(response)
        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = text.match(/\[[\s\S]*\]/)
        if (!jsonMatch) {
          console.error('Failed to parse Claude response:', text.substring(0, 200))
          continue
        }

        const results: Array<{ id: string; category: string; confidence: number }> = JSON.parse(jsonMatch[0])

        // Update transactions
        for (const result of results) {
          const catId = categoryMap[result.category]
          if (!catId) {
            console.warn(`Unknown category slug: ${result.category}`)
            continue
          }

          const { error: updateErr } = await supabaseAdmin
            .from('transactions')
            .update({
              category_id: catId,
              category_confidence: Math.min(1, Math.max(0, result.confidence)),
            })
            .eq('id', result.id)
            .eq('user_id', userId)

          if (!updateErr) totalCategorized++
        }
      } catch (err) {
        console.error(`Batch ${i / BATCH_SIZE} categorization failed:`, err)
        // Continue with next batch
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        categorized: totalCategorized,
        total_uncategorized: uncategorized.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('ai-categorize error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
