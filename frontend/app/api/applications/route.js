/**
 * 체험단 신청 API (로그인 없음 - anon_id 쿠키로 식별)
 *
 * GET  /api/applications  → 내가 신청한 campaign_id 목록 반환
 * POST /api/applications  → 체험단 신청 (applications 테이블에 insert)
 * PATCH /api/applications → 상태 변경
 * DELETE /api/applications?id=xxx → 신청 취소
 */
import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'

const ANON_COOKIE = 'anon_id'
const COOKIE_OPTS = {
  path    : '/',
  httpOnly: true,
  sameSite: 'lax',
  maxAge  : 60 * 60 * 24 * 365, // 1년
  secure  : process.env.NODE_ENV === 'production',
}

/** 쿠키에서 anon_id를 읽거나, 없으면 null 반환 */
async function getAnonId() {
  const cookieStore = await cookies()
  return cookieStore.get(ANON_COOKIE)?.value || null
}

/** anon_id를 응답 쿠키에 설정 */
function setAnonCookie(response, anonId) {
  response.cookies.set(ANON_COOKIE, anonId, COOKIE_OPTS)
  return response
}

// ── GET: 내가 신청한 campaign_id 목록 ──────────────────────────
export async function GET() {
  const anonId = await getAnonId()

  if (!anonId) {
    return NextResponse.json({ applied: [], applications: [] })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('applications')
    .select('id, campaign_id, status')
    .eq('user_id', anonId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    applied      : data.map(a => a.campaign_id),
    applications : data,
  })
}

// ── POST: 체험단 신청 ──────────────────────────────────────────
export async function POST(request) {
  let anonId = await getAnonId()
  const isNew = !anonId
  if (isNew) anonId = randomUUID()

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { campaign_id, campaign_title, campaign_link, campaign_platform } = body

  if (!campaign_id || !campaign_title) {
    return NextResponse.json({ error: 'campaign_id, campaign_title 필수' }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('applications')
      .insert({
        user_id          : anonId,
        campaign_id,
        campaign_title,
        campaign_link    : campaign_link     || '',
        campaign_platform: campaign_platform || '',
        status           : '신청완료',
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'already_applied' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const response = NextResponse.json({ success: true, application: data }, { status: 201 })
    if (isNew) setAnonCookie(response, anonId)
    return response
  } catch (e) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}

// ── PATCH: 상태 변경 ───────────────────────────────────────────
export async function PATCH(request) {
  const anonId = await getAnonId()
  if (!anonId) {
    return NextResponse.json({ error: 'No session' }, { status: 400 })
  }

  const { id, status } = await request.json()
  const VALID = ['신청완료', '선정됨', '후기작성중', '완료']

  if (!id || !VALID.includes(status)) {
    return NextResponse.json({ error: '유효하지 않은 상태값' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('applications')
    .update({ status })
    .eq('id', id)
    .eq('user_id', anonId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// ── DELETE: 신청 취소 ──────────────────────────────────────────
export async function DELETE(request) {
  const anonId = await getAnonId()
  if (!anonId) {
    return NextResponse.json({ error: 'No session' }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id 필수' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('applications')
    .delete()
    .eq('id', id)
    .eq('user_id', anonId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
