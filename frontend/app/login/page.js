'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, Suspense } from 'react'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 언마운트 후 setState 방지
  const isMounted = useRef(true)
  // 중복 리다이렉트 방지
  const isRedirecting = useRef(false)

  useEffect(() => {
    isMounted.current = true

    // URL error 파라미터 처리
    const errorParam = searchParams.get('error')
    const msgParam = searchParams.get('msg')
    if (errorParam) {
      const messages = {
        oauth_error:      `OAuth 오류: ${msgParam || '카카오 인증 실패'}`,
        exchange_failed:  `인증 오류: ${msgParam || '코드 교환 실패'}`,
        no_code:          '인증 코드가 없습니다. 다시 시도해주세요.',
        callback_failed:  '로그인 처리 중 오류가 발생했습니다.',
      }
      if (isMounted.current) {
        setError(messages[errorParam] || '로그인 중 오류가 발생했습니다. 다시 시도해주세요.')
      }
    }

    // 이미 로그인된 경우 즉시 메인으로 이동
    const checkSession = async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()

        if (!isMounted.current) return
        if (!session) return

        // 이미 로그인 → 리다이렉트 (loading 표시 없이)
        if (isRedirecting.current) return
        isRedirecting.current = true
        const next = searchParams.get('next') || '/'
        router.replace(next)
      } catch {
        // 세션 확인 실패 시 무시 (로그인 폼 그대로 표시)
      }
    }

    checkSession()

    return () => {
      isMounted.current = false
    }
  }, [searchParams, router])

  const handleKakaoLogin = async () => {
    // 중복 클릭 / 리다이렉트 중 재실행 방지
    if (loading || isRedirecting.current) return

    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const next = searchParams.get('next') || '/'

      // ── 1. 사전 세션 체크 ────────────────────────────────────────
      // 이미 로그인된 경우 OAuth 없이 바로 이동
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        if (isRedirecting.current) return
        isRedirecting.current = true
        if (isMounted.current) setLoading(false)
        router.replace(next)
        return
      }

      // ── 2. Kakao OAuth URL 생성 (skipBrowserRedirect) ────────────
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          scopes: 'profile_nickname profile_image',
          skipBrowserRedirect: true,
        },
      })

      if (oauthError || !data?.url) {
        if (isMounted.current) {
          setError('로그인에 실패했습니다. 잠시 후 다시 시도해주세요.')
          setLoading(false)
        }
        return
      }

      // ── 3. account_email scope 제거 후 카카오로 이동 ─────────────
      const kakaoUrl = new URL(data.url)
      const rawScope = kakaoUrl.searchParams.get('scope') || ''
      const cleanScope = rawScope
        .split(/[ +]/)
        .filter(s => s && s !== 'account_email')
        .join(' ')
      kakaoUrl.searchParams.set('scope', cleanScope)

      // 페이지 이동 — 이후 코드 실행되지 않음
      window.location.href = kakaoUrl.toString()

    } catch (err) {
      if (isMounted.current) {
        setError('오류가 발생했습니다. 다시 시도해주세요.')
        setLoading(false)
      }
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F8F9FA',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: "'Noto Sans KR', sans-serif",
    }}>
      {/* 폰트 */}
      <link
        href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap"
        rel="stylesheet"
      />

      {/* 로고 */}
      <a href="/" style={{ textDecoration: 'none', marginBottom: '32px' }}>
        <span style={{ fontSize: '24px', fontWeight: 900, color: '#1A1A1A', letterSpacing: '-1px' }}>
          헌터뷰<span style={{ color: '#FF6B35' }}>.</span>
        </span>
      </a>

      {/* 로그인 카드 */}
      <div style={{
        background: '#fff',
        borderRadius: '20px',
        boxShadow: '0 4px 24px rgba(0,0,0,.08)',
        padding: '40px 36px',
        width: '100%',
        maxWidth: '380px',
      }}>
        <h1 style={{
          fontSize: '20px', fontWeight: 900,
          textAlign: 'center', color: '#1A1A1A', marginBottom: '8px',
        }}>
          로그인
        </h1>
        <p style={{
          fontSize: '14px', color: '#AAAAAA',
          textAlign: 'center', marginBottom: '32px',
        }}>
          체험단 신청 및 내역 관리를 위해 로그인해주세요
        </p>

        {/* 에러 메시지 */}
        {error && (
          <div style={{
            background: '#FFF0EF', color: '#FF3B30', fontSize: '13px',
            padding: '12px', borderRadius: '10px', marginBottom: '20px',
            textAlign: 'center', border: '1px solid #FFD0CE',
          }}>
            {error}
          </div>
        )}

        {/* 카카오 로그인 버튼 */}
        <button
          onClick={handleKakaoLogin}
          disabled={loading}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            background: loading ? '#E5D100' : '#FEE500',
            color: '#1A1A1A',
            fontWeight: 700,
            fontSize: '15px',
            padding: '14px',
            borderRadius: '12px',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            transition: 'background .15s, opacity .15s',
            opacity: loading ? 0.8 : 1,
          }}
        >
          {/* 카카오 아이콘 */}
          {!loading && (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#3C1E1E">
              <path d="M12 3C6.477 3 2 6.477 2 11c0 2.936 1.665 5.506 4.2 7.05l-1.05 3.9c-.09.33.265.6.555.42l4.5-2.94c.59.09 1.19.13 1.795.13 5.523 0 10-3.477 10-8S17.523 3 12 3z"/>
            </svg>
          )}
          {loading
            ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  width: '16px', height: '16px',
                  border: '2px solid #1A1A1A',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'spin 0.7s linear infinite',
                }} />
                이동 중입니다...
              </span>
            )
            : '카카오로 시작하기'
          }
        </button>

        {/* 스피너 애니메이션 */}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

        <p style={{
          fontSize: '11px', color: '#CCCCCC',
          textAlign: 'center', marginTop: '20px', lineHeight: 1.6,
        }}>
          로그인 시 서비스 이용약관 및 개인정보처리방침에<br />동의하는 것으로 간주됩니다
        </p>
      </div>

      <a href="/" style={{
        marginTop: '24px', fontSize: '13px',
        color: '#AAAAAA', textDecoration: 'none',
      }}>
        ← 메인으로 돌아가기
      </a>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F8F9FA',
        fontFamily: "'Noto Sans KR', sans-serif",
        color: '#AAAAAA',
        fontSize: '14px',
      }}>
        로딩 중...
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
