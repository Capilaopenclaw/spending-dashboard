/**
 * ai-insights: Weekly spending insights generation
 *
 * POST /ai-insights
 * Body: { user_id: string } (for cron) or authenticated call
 *
 * Cron target: Weekly Mon 07:00 CET
 * CRITICAL: Excludes transfers from all spending calculations
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseClient, getSupabaseAdmin } from '../_shared/supabase.ts'
import { callClaude, extractText } from '../_shared/claude.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabaseAdmin = getSupabaseAdmin()
    let userId: string
    let isCron = false

    const authHeader = req.headers.get('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const supabase = getSupabaseClient(req)
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      userId = user.id
    } else {
      const body = await req.json().catch(() => ({}))
      if (body.cron_all) {
        // Process all users
        isCron = true
        const { data: users } = await supabaseAdmin.from('profiles').select('id')
        const results = []
        for (const u of users || []) {
          try {
            const r = await generateInsights(supabaseAdmin, u.id)
            results.push({ user_id: u.id, ...r })
          } catch (err) {
            results.push({ user_id: u.id, error: (err as Error).message })
          }
        }
        return new Response(JSON.stringify({ success: true, results }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (!body.user_id) {
        return new Response(JSON.stringify({ error: 'user_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      userId = body.user_id
    }

    const result = await generateInsights(supabaseAdmin, userId)

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('ai-insights error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function generateInsights(supabaseAdmin: any, userId: string) {
  const now = new Date()
  const thisWeekStart = new Date(now)
  thisWeekStart.setDate(now.getDate() - 7)
  const prevWeekStart = new Date(now)
  prevWeekStart.setDate(now.getDate() - 14)

  const fmt = (d: Date) => d.toISOString().split('T')[0]

  // Get this week's transactions (excluding transfers)
  const { data: thisWeek } = await supabaseAdmin
    .from('transactions')
    .select('*, categories(name_sk, slug)')
    .eq('user_id', userId)
    .eq('is_transfer', false)
    .gte('date', fmt(thisWeekStart))
    .lte('date', fmt(now))
    .order('date', { ascending: false })

  // Get previous week's transactions (excluding transfers)
  const { data: prevWeek } = await supabaseAdmin
    .from('transactions')
    .select('*, categories(name_sk, slug)')
    .eq('user_id', userId)
    .eq('is_transfer', false)
    .gte('date', fmt(prevWeekStart))
    .lt('date', fmt(thisWeekStart))

  if (!thisWeek || thisWeek.length === 0) {
    return { insights_created: 0, message: 'No transactions this week' }
  }

  // Get user language
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('language')
    .eq('id', userId)
    .single()
  const lang = profile?.language || 'sk'

  // Aggregate by category
  const aggregate = (txns: any[]) => {
    const byCategory: Record<string, { total: number; count: number; name: string }> = {}
    const byMerchant: Record<string, { total: number; count: number }> = {}
    let totalSpending = 0

    for (const t of txns) {
      if (t.amount >= 0) continue // Only expenses
      const abs = Math.abs(t.amount)
      totalSpending += abs
      const cat = t.categories?.slug || 'uncategorized'
      const catName = t.categories?.name_sk || 'Nekategorizované'
      byCategory[cat] = byCategory[cat] || { total: 0, count: 0, name: catName }
      byCategory[cat].total += abs
      byCategory[cat].count++

      const merchant = t.merchant_name || 'unknown'
      byMerchant[merchant] = byMerchant[merchant] || { total: 0, count: 0 }
      byMerchant[merchant].total += abs
      byMerchant[merchant].count++
    }
    return { byCategory, byMerchant, totalSpending }
  }

  const thisAgg = aggregate(thisWeek)
  const prevAgg = aggregate(prevWeek || [])

  // Build context for Claude
  const context = {
    period: `${fmt(thisWeekStart)} to ${fmt(now)}`,
    this_week: {
      total_spending: thisAgg.totalSpending.toFixed(2),
      by_category: Object.entries(thisAgg.byCategory).map(([slug, v]) => ({
        category: v.name, slug, total: v.total.toFixed(2), count: v.count,
      })),
      top_merchants: Object.entries(thisAgg.byMerchant)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 10)
        .map(([name, v]) => ({ name, total: v.total.toFixed(2), count: v.count })),
    },
    prev_week: {
      total_spending: prevAgg.totalSpending.toFixed(2),
      by_category: Object.entries(prevAgg.byCategory).map(([slug, v]) => ({
        category: v.name, slug, total: v.total.toFixed(2), count: v.count,
      })),
    },
  }

  const systemPrompt = `You are a personal finance analyst for a Slovak user. Analyze their weekly spending and generate insights.

RULES:
- Generate 3-6 insights based on the data
- All transfers between own accounts are already excluded
- Respond ONLY with valid JSON array
- Each insight: {
    "title_sk": "...", "title_en": "...", "title_hu": "...",
    "message_sk": "...", "message_en": "...", "message_hu": "...",
    "severity": "info|warning|positive",
    "insight_type": "spending_spike|anomaly|subscription|budget|summary|saving",
    "metadata": { ... optional context data }
  }
- Detect: spending spikes (>20% increase in category), unusual merchants, subscriptions, general summary
- Be specific with numbers (€ amounts)
- Keep messages concise (1-2 sentences)
- Always include a weekly summary as first insight`

  const response = await callClaude(systemPrompt, [{
    role: 'user',
    content: `Analyze this spending data:\n${JSON.stringify(context, null, 2)}`,
  }], { maxTokens: 2048, temperature: 0.4 })

  const text = extractText(response)
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    console.error('Failed to parse insights response:', text.substring(0, 200))
    return { insights_created: 0, error: 'Failed to parse AI response' }
  }

  const insights: any[] = JSON.parse(jsonMatch[0])

  // Store insights
  let created = 0
  for (const insight of insights) {
    const { error } = await supabaseAdmin.from('insights').insert({
      user_id: userId,
      title_sk: insight.title_sk,
      title_en: insight.title_en,
      title_hu: insight.title_hu,
      message_sk: insight.message_sk,
      message_en: insight.message_en,
      message_hu: insight.message_hu,
      severity: insight.severity,
      insight_type: insight.insight_type,
      metadata: insight.metadata || {},
    })
    if (!error) created++
  }

  return { insights_created: created }
}
