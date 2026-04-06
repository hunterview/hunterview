/**
 * 현재 로그인 상태를 확인하는 API
 * GET /api/auth/session
 * 정적 HTML(index.html)에서 fetch로 호출해 로그인 상태를 확인합니다.
 */
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ user: null })
    }

    // 클라이언트에 필요한 최소한의 정보만 반환
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        // 카카오 프로필 이름 (user_metadata에 저장됨)
        name: user.user_metadata?.full_name
           || user.user_metadata?.name
           || user.user_metadata?.preferred_username
           || '사용자',
        avatar: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      },
    })
  } catch {
    return NextResponse.json({ user: null })
  }
}
