import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabase.ts'

/**
 * notify-consent-expiry
 * Sends notifications to users whose bank consent is expiring soon
 * Called by cron job daily at 08:00 UTC
 */

interface ExpiringConnection {
  id: string
  user_id: string
  institution_name: string
  consent_expires_at: string
  days_remaining: number
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabase = getSupabaseAdmin()

    // Find connections expiring within 7 days
    const { data: connections, error } = await supabase
      .from('bank_connections')
      .select('id, user_id, institution_name, consent_expires_at')
      .eq('status', 'linked')
      .not('consent_expires_at', 'is', null)
      .lt('consent_expires_at', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
      .gt('consent_expires_at', new Date().toISOString())

    if (error) {
      console.error('Failed to query expiring connections:', error)
      return new Response(JSON.stringify({ error: 'Database query failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!connections || connections.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No expiring connections', notified: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const enriched: ExpiringConnection[] = connections.map(conn => ({
      ...conn,
      days_remaining: Math.floor(
        (new Date(conn.consent_expires_at!).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      ),
    }))

    // Create insight notifications for each user
    const insights = enriched.map(conn => ({
      user_id: conn.user_id,
      insight_type: 'action_required',
      severity: conn.days_remaining <= 3 ? 'warning' : 'info',
      title_sk: `Platnosť prístupu k banke uplynie o ${conn.days_remaining} ${conn.days_remaining === 1 ? 'deň' : 'dni'}`,
      title_en: `Bank access expires in ${conn.days_remaining} day${conn.days_remaining === 1 ? '' : 's'}`,
      title_hu: `Banki hozzáférés lejár ${conn.days_remaining} nap múlva`,
      message_sk: `Prosím obnovte prístup k ${conn.institution_name} v Nastaveniach. Synchronizácia transakcií sa zastaví po vypršaní.`,
      message_en: `Please renew access to ${conn.institution_name} in Settings. Transaction sync will stop after expiry.`,
      message_hu: `Kérjük, újítsa meg a hozzáférést a ${conn.institution_name} bankhoz a Beállításokban. A tranzakció szinkronizálás leáll a lejárat után.`,
      metadata: {
        connection_id: conn.id,
        institution: conn.institution_name,
        expires_at: conn.consent_expires_at,
        days_remaining: conn.days_remaining,
        action: 'renew_consent',
      },
    }))

    const { error: insertError } = await supabase.from('insights').insert(insights)

    if (insertError) {
      console.error('Failed to insert insights:', insertError)
      return new Response(JSON.stringify({ error: 'Failed to create notifications' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Update connection status
    const connectionIds = connections.map(c => c.id)
    await supabase
      .from('bank_connections')
      .update({ status: 'expiring_soon' })
      .in('id', connectionIds)

    return new Response(
      JSON.stringify({
        message: `Notified ${connections.length} user(s) about expiring consent`,
        notified: connections.length,
        connections: enriched.map(c => ({
          id: c.id,
          user_id: c.user_id,
          days_remaining: c.days_remaining,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('notify-consent-expiry error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
