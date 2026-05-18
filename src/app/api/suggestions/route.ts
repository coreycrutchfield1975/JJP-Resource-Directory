import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  const { data, error } = await supabase
    .from('suggestions')
    .select('*')
    .eq('status', 'pending')
    .order('submitted_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { error } = await supabase.from('suggestions').insert({
    name: body.name,
    type: body.type || 'Community',
    state: body.state || 'MO',
    county: body.county || '',
    city: body.city || '',
    phone: body.phone || '',
    address: body.address || '',
    notes: body.notes || '',
    status: 'pending',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
