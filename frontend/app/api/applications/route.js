/**
 * 체험단 신청 API
 *
 * GET  /api/applications  → 내가 신청한 campaign_id 목록 반환
 * POST /api/applications  → 체험단 신청 (applications 테이블에 insert)
 * DELETE /api/applications?id=xxx → 신청 취소
 */
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// ── GET: 내가 신청한 campaign_id 목록 ──────────────────────────
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('applications')
    .select('id, campaign_id, status')
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 신청한 campaign_id 목록 (index.html에서 신청완료 여부 체크에 사용)
  return NextResponse.json({
    applied: data.map(a => a.campaign_id),
    applications: data,
  })
}

// ── POST: 체험단 신청 ──────────────────────────────────────────
export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  const { data, error } = await supabase
    .from('applications')
    .insert({
      user_id          : user.id,
      campaign_id,
      campaign_title,
      campaign_link    : campaign_link    || '',
      campaign_platform: campaign_platform || '',
      status           : '신청완료',
    })
    .select()
    .single()

  if (error) {
    // 23505 = unique constraint violation (이미 신청함)
    if (error.code === '23505') {
      return NextResponse.json({ error: 'already_applied' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, application: data }, { status: 201 })
}

// ── PATCH: 상태 변경 (선정됨 / 후기작성중 / 완료) ──────────────
export async function PATCH(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, status } = await request.json()
  const VALID_STATUSES = ['신청완료', '선정됨', '후기작성중', '완료']

  if (!id || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: '유효하지 않은 상태값' }, { status: 400 })
  }

  const { error } = await supabase
    .from('applications')
    .update({ status })
    .eq('id', id)
    .eq('user_id', user.id)  // 본인 것만 수정 가능

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// ── DELETE: 신청 취소 ──────────────────────────────────────────
export async function DELETE(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id 필수' }, { status: 400 })
  }

  const { error } = await supabase
    .from('applications')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)  // 본인 것만 삭제 가능

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
