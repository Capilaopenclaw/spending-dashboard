import { NextResponse } from 'next/server'

// GoCardless redirects here after bank auth
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const ref = searchParams.get('ref') // requisition ID

  if (ref) {
    // Redirect to settings with the ref so frontend can finalize
    return NextResponse.redirect(`${origin}/settings?gc_ref=${ref}&gc_status=success`)
  }

  return NextResponse.redirect(`${origin}/settings?gc_status=error`)
}
