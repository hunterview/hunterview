/**
 * 로그인 페이지
 * /login 에서 접근 가능
 * 카카오 OAuth를 통해 로그인합니다.
 */
'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'

// useSearchParams()는 Suspense 경계 안에서 사용해야 함
function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    // URL에 error 파라미터가 있으면 에러 메시지 표시
    if (searchParams.get('error')) {
      setError('로그인 중 오류가 발생했습니다. 다시 시도해주세요.')
    }

    // 이미 로그인된 경우 홈으로 리다이렉트
    const checkSession = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const next = searchParams.get('next') || '/'
        router.replace(next)
      }
    }
    checkSession()
  }, [searchParams, router])

  const handleKakaoLogin = async () => {
    setLoading(true)
    setError('')

    const supabase = createClient()
    const next = searchParams.get('next') || '/'

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        // 인증 완료 후 돌아올 URL (Supabase 대시보드에도 등록 필요)
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        scopes: 'profile_nickname profile_image',
      },
    })

    if (error) {
      setError('로그인에 실패했습니다. 잠시 후 다시 시도해주세요.')
      setLoading(false)
    }
    // 성공 시 카카오 페이지로 리다이렉트 (자동)
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#F8F9FA',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '24px',
      fontFamily: "'Noto Sans KR', sans-serif",
    }}>
      {/* 폰트 로드 */}
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet" />

      {/* 로고 */}
      <a href="/" style={{ textDecoration: 'none', marginBottom: '32px' }}>
        <span style={{ fontSize: '24px', fontWeight: 900, color: '#1A1A1A', letterSpacing: '-1px' }}>
          헌터뷰<span style={{ color: '#FF6B35' }}>.</span>
        </span>
      </a>

      {/* 로그인 카드 */}
      <div style={{
        background: '#fff', borderRadius: '20px',
        boxShadow: '0 4px 24px rgba(0,0,0,.08)',
        padding: '40px 36px', width: '100%', maxWidth: '380px',
      }}>
        <h1 style={{ fontSize: '20px', fontWeight: 900, textAlign: 'center', color: '#1A1A1A', marginBottom: '8px' }}>
          로그인
        </h1>
        <p style={{ fontSize: '14px', color: '#AAAAAA', textAlign: 'center', marginBottom: '32px' }}>
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
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '10px', background: loading ? '#E5D100' : '#FEE500',
            color: '#1A1A1A', fontWeight: 700, fontSize: '15px',
            padding: '14px', borderRadius: '12px', border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            transition: 'background .15s',
          }}
        >
          {/* 카카오 아이콘 */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#3C1E1E">
            <path d="M12 3C6.477 3 2 6.477 2 11c0 2.936 1.665 5.506 4.2 7.05l-1.05 3.9c-.09.33.265.6.555.42l4.5-2.94c.59.09 1.19.13 1.795.13 5.523 0 10-3.477 10-8S17.523 3 12 3z"/>
          </svg>
          {loading ? '카카오 연결 중...' : '카카오로 시작하기'}
        </button>

        <p style={{ fontSize: '11px', color: '#CCCCCC', textAlign: 'center', marginTop: '20px', lineHeight: 1.6 }}>
          로그인 시 서비스 이용약관 및 개인정보처리방침에<br />동의하는 것으로 간주됩니다
        </p>
      </div>

      <a href="/" style={{ marginTop: '24px', fontSize: '13px', color: '#AAAAAA', textDecoration: 'none' }}>
        ← 메인으로 돌아가기
      </a>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>로딩 중...</div>}>
      <LoginContent />
    </Suspense>
  )
}
