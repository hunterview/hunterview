/**
 * 서버(Server Component / API Route / middleware)에서 사용하는 Supabase 클라이언트
 * cookies()를 통해 세션 쿠키를 읽고 씁니다.
 */
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component에서 set이 불가한 경우 무시 (middleware가 처리)
          }
        },
      },
    }
  )
}
