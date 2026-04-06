/**
 * 브라우저(클라이언트 컴포넌트)에서 사용하는 Supabase 클라이언트
 * 'use client' 컴포넌트 내부에서 import해서 사용하세요.
 */
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,    // .env.local 에서 읽음
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}
