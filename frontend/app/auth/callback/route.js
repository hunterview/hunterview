/**
 * 카카오 OAuth 콜백 핸들러
 * Supabase → 카카오 인증 완료 후 이 URL로 리다이렉트됩니다.
 * Supabase 대시보드 > Authentication > URL Configuration > Redirect URLs 에
 * https://your-domain.vercel.app/auth/callback 를 등록해야 합니다.
 */
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // 로그인 후 돌아갈 페이지 (기본값: 홈)
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    // 인증 코드 → 세션으로 교환
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // 성공: 원래 가려던 페이지로 리다이렉트
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // 실패: 에러 파라미터와 함께 로그인 페이지로
  return NextResponse.redirect(`${origin}/login?error=callback_failed`)
}
