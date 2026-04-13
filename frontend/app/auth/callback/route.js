/**
 * 카카오 OAuth 콜백 핸들러
 * Supabase → 카카오 인증 완료 후 이 URL로 리다이렉트됩니다.
 */
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const requestUrl = new URL(request.url)
  const { searchParams, origin } = requestUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  // Kakao/OAuth provider가 에러를 직접 돌려주는 경우
  const oauthError = searchParams.get('error')
  const oauthErrorDesc = searchParams.get('error_description')
  if (oauthError) {
    console.error('[auth/callback] OAuth error:', oauthError, oauthErrorDesc)
    return NextResponse.redirect(
      `${origin}/login?error=oauth_error&msg=${encodeURIComponent(oauthErrorDesc || oauthError)}`
    )
  }

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

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      console.log('[auth/callback] success, user:', data?.user?.id)
      return NextResponse.redirect(`${origin}${next}`)
    }

    // 에러 상세 로깅
    console.error('[auth/callback] exchangeCodeForSession error:', {
      message: error.message,
      code: error.code,
      status: error.status,
    })
    return NextResponse.redirect(
      `${origin}/login?error=exchange_failed&msg=${encodeURIComponent(error.message)}`
    )
  }

  // code 파라미터 자체가 없는 경우
  console.error('[auth/callback] no code param, full url:', request.url)
  return NextResponse.redirect(`${origin}/login?error=no_code`)
}
