/**
 * 로그아웃 API
 * POST /api/auth/logout
 */
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.signOut()

  // 모든 sb- 쿠키 강제 만료
  const response = NextResponse.json({ success: true })
  cookieStore.getAll().forEach(({ name }) => {
    if (name.startsWith('sb-')) {
      response.cookies.set(name, '', {
        maxAge: 0,
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
      })
    }
  })
  return response
}
