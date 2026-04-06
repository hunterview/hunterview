/**
 * 로그아웃 API
 * POST /api/auth/logout
 * 세션 쿠키를 삭제하고 로그아웃 처리합니다.
 */
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.json({ success: true })
}
