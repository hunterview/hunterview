'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, Suspense } from 'react'

/* ── 배경에 떠다니는 체험단 태그 목록 ── */
const FLOAT_TAGS = [
  '맛집 체험단', '뷰티 리뷰', '숙박 체험', '제품 리뷰',
  '인스타 체험', '블로그 체험', '방문형', '배송형',
  '릴스 체험', '카페 방문', '스킨케어', '한우 오마카세',
]

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isMounted = useRef(true)
  const isRedirecting = useRef(false)

  useEffect(() => {
    isMounted.current = true
    const errorParam = searchParams.get('error')
    const msgParam   = searchParams.get('msg')
    if (errorParam) {
      const messages = {
        oauth_error:     `OAuth 오류: ${msgParam || '카카오 인증 실패'}`,
        exchange_failed: `인증 오류: ${msgParam || '코드 교환 실패'}`,
        no_code:         '인증 코드가 없습니다. 다시 시도해주세요.',
        callback_failed: '로그인 처리 중 오류가 발생했습니다.',
      }
      if (isMounted.current)
        setError(messages[errorParam] || '로그인 중 오류가 발생했습니다. 다시 시도해주세요.')
    }
    const checkSession = async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!isMounted.current || !session) return
        if (isRedirecting.current) return
        isRedirecting.current = true
        router.replace(searchParams.get('next') || '/')
      } catch {}
    }
    checkSession()
    return () => { isMounted.current = false }
  }, [searchParams, router])

  const handleKakaoLogin = async () => {
    if (loading || isRedirecting.current) return
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const next = searchParams.get('next') || '/'
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        if (isRedirecting.current) return
        isRedirecting.current = true
        if (isMounted.current) setLoading(false)
        router.replace(next)
        return
      }
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          scopes: 'profile_nickname profile_image',
          skipBrowserRedirect: true,
        },
      })
      if (oauthError || !data?.url) {
        if (isMounted.current) { setError('로그인에 실패했습니다. 잠시 후 다시 시도해주세요.'); setLoading(false) }
        return
      }
      const kakaoUrl = new URL(data.url)
      const cleanScope = (kakaoUrl.searchParams.get('scope') || '')
        .split(/[ +]/).filter(s => s && s !== 'account_email').join(' ')
      kakaoUrl.searchParams.set('scope', cleanScope)
      window.location.href = kakaoUrl.toString()
    } catch {
      if (isMounted.current) { setError('오류가 발생했습니다. 다시 시도해주세요.'); setLoading(false) }
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .login-root {
          min-height: 100vh;
          display: flex;
          font-family: 'Noto Sans KR', sans-serif;
          background: #0D0D14;
        }

        /* ── 왼쪽 패널 ── */
        .login-left {
          flex: 1;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 48px;
          background: linear-gradient(135deg, #0D0D14 0%, #1A1030 50%, #0D1A2E 100%);
        }
        .login-left::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 60% 50% at 20% 80%, rgba(255,107,53,.18) 0%, transparent 70%),
            radial-gradient(ellipse 50% 60% at 80% 20%, rgba(111,66,255,.15) 0%, transparent 70%);
          pointer-events: none;
        }

        /* 격자 패턴 */
        .login-left::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
        }

        .left-logo {
          position: relative;
          z-index: 1;
          font-size: 22px;
          font-weight: 900;
          color: #fff;
          letter-spacing: -1px;
          text-decoration: none;
        }
        .left-logo span { color: #FF6B35; }

        .left-hero {
          position: relative;
          z-index: 1;
        }
        .left-hero h2 {
          font-size: clamp(32px, 4vw, 52px);
          font-weight: 900;
          color: #fff;
          line-height: 1.2;
          letter-spacing: -1.5px;
          margin-bottom: 16px;
        }
        .left-hero h2 em {
          font-style: normal;
          background: linear-gradient(90deg, #FF6B35, #FF9F6B);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .left-hero p {
          font-size: 15px;
          color: rgba(255,255,255,.5);
          line-height: 1.7;
        }

        /* 떠다니는 태그 */
        .float-tags {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }
        .float-tag {
          position: absolute;
          font-size: 11px;
          font-weight: 700;
          color: rgba(255,255,255,.12);
          white-space: nowrap;
          letter-spacing: .5px;
          animation: drift linear infinite;
        }

        /* 플랫폼 미니 카드들 */
        .platform-cards {
          position: relative;
          z-index: 1;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .platform-chip {
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 20px;
          padding: 6px 14px;
          font-size: 12px;
          font-weight: 600;
          color: rgba(255,255,255,.55);
          backdrop-filter: blur(6px);
        }

        @keyframes drift {
          0%   { transform: translateY(0) translateX(0); opacity: .12; }
          50%  { opacity: .2; }
          100% { transform: translateY(-60px) translateX(20px); opacity: .12; }
        }

        /* ── 오른쪽 패널 ── */
        .login-right {
          width: 420px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 40px;
          background: #F4F5F7;
          position: relative;
        }

        .login-form-wrap {
          width: 100%;
          max-width: 340px;
        }

        .form-eyebrow {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 28px;
        }
        .form-eyebrow-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #FF6B35;
        }
        .form-eyebrow-line {
          flex: 1;
          height: 1px;
          background: #E2E4E8;
        }
        .form-eyebrow-text {
          font-size: 11px;
          font-weight: 700;
          color: #B0B4BC;
          letter-spacing: 1.5px;
          text-transform: uppercase;
        }

        .form-title {
          font-size: 28px;
          font-weight: 900;
          color: #1A1A2E;
          letter-spacing: -1px;
          line-height: 1.2;
          margin-bottom: 8px;
        }
        .form-title span { color: #FF6B35; }
        .form-sub {
          font-size: 13px;
          color: #9EA4AE;
          margin-bottom: 36px;
          line-height: 1.6;
        }

        /* 에러 */
        .error-box {
          background: #FFF0EF;
          color: #E53E3E;
          font-size: 12px;
          padding: 12px 14px;
          border-radius: 10px;
          margin-bottom: 20px;
          border-left: 3px solid #E53E3E;
        }

        /* 카카오 버튼 */
        .kakao-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: #FEE500;
          color: #1A1A1A;
          font-weight: 800;
          font-size: 15px;
          padding: 16px 20px;
          border-radius: 14px;
          border: none;
          cursor: pointer;
          font-family: inherit;
          letter-spacing: -.3px;
          transition: transform .15s, box-shadow .15s, background .15s;
          box-shadow: 0 4px 20px rgba(254,229,0,.35);
        }
        .kakao-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(254,229,0,.45);
        }
        .kakao-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .kakao-btn:disabled {
          opacity: .75;
          cursor: not-allowed;
        }

        .spin { animation: spin .7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* 구분선 */
        .divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 20px 0;
        }
        .divider::before, .divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #E2E4E8;
        }
        .divider span {
          font-size: 11px;
          color: #C0C4CC;
          white-space: nowrap;
        }

        /* 소셜 통계 */
        .stats-row {
          display: flex;
          gap: 6px;
          margin-top: 24px;
        }
        .stat-chip {
          flex: 1;
          background: #fff;
          border: 1px solid #E8EAED;
          border-radius: 10px;
          padding: 10px 8px;
          text-align: center;
        }
        .stat-chip-num {
          font-size: 15px;
          font-weight: 900;
          color: #1A1A2E;
          display: block;
          letter-spacing: -.5px;
        }
        .stat-chip-label {
          font-size: 10px;
          color: #9EA4AE;
          margin-top: 2px;
          display: block;
        }

        .back-link {
          display: block;
          text-align: center;
          margin-top: 20px;
          font-size: 12px;
          color: #B0B4BC;
          text-decoration: none;
          transition: color .15s;
        }
        .back-link:hover { color: #FF6B35; }

        /* ── 반응형 ── */
        @media (max-width: 768px) {
          .login-root { flex-direction: column; }
          .login-left {
            min-height: 240px;
            padding: 32px 28px;
            flex: none;
          }
          .left-hero h2 { font-size: 28px; }
          .platform-cards { display: none; }
          .login-right {
            width: 100%;
            flex: 1;
            padding: 32px 24px;
          }
        }
      `}</style>

      <div className="login-root">

        {/* ── 왼쪽: 브랜드 패널 ── */}
        <div className="login-left">
          {/* 떠다니는 태그들 */}
          <div className="float-tags">
            {FLOAT_TAGS.map((tag, i) => (
              <span
                key={i}
                className="float-tag"
                style={{
                  left:  `${(i * 17 + 5) % 85}%`,
                  top:   `${(i * 23 + 10) % 80}%`,
                  animationDuration: `${8 + (i % 5) * 2}s`,
                  animationDelay:    `${-(i * 1.3)}s`,
                }}
              >
                {tag}
              </span>
            ))}
          </div>

          <a href="/" className="left-logo">헌터뷰<span>.</span></a>

          <div className="left-hero">
            <h2>
              체험단,<br />
              <em>한 번에 찾고</em><br />
              바로 신청하세요
            </h2>
            <p>
              10개 이상의 체험단 사이트를<br />
              한 곳에서 검색·신청·관리
            </p>
          </div>

          <div className="platform-cards">
            {['파블로체험단', '디너의여왕', '포포몬', '모두모여', '강남맛집', '포블로그'].map(p => (
              <span key={p} className="platform-chip">{p}</span>
            ))}
          </div>
        </div>

        {/* ── 오른쪽: 로그인 폼 ── */}
        <div className="login-right">
          <div className="login-form-wrap">
            <div className="form-eyebrow">
              <div className="form-eyebrow-dot" />
              <span className="form-eyebrow-text">로그인</span>
              <div className="form-eyebrow-line" />
            </div>

            <h1 className="form-title">
              시작해볼까요<span>?</span>
            </h1>
            <p className="form-sub">
              카카오 계정으로 3초 만에<br />
              체험단 신청·관리를 시작하세요
            </p>

            {error && <div className="error-box">{error}</div>}

            <button
              className="kakao-btn"
              onClick={handleKakaoLogin}
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg className="spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" strokeOpacity=".25"/>
                    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
                  </svg>
                  이동 중입니다…
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#3C1E1E">
                    <path d="M12 3C6.477 3 2 6.477 2 11c0 2.936 1.665 5.506 4.2 7.05l-1.05 3.9c-.09.33.265.6.555.42l4.5-2.94c.59.09 1.19.13 1.795.13 5.523 0 10-3.477 10-8S17.523 3 12 3z"/>
                  </svg>
                  카카오로 시작하기
                </>
              )}
            </button>

            <div className="divider"><span>헌터뷰와 함께</span></div>

            <div className="stats-row">
              <div className="stat-chip">
                <span className="stat-chip-num">10+</span>
                <span className="stat-chip-label">연동 사이트</span>
              </div>
              <div className="stat-chip">
                <span className="stat-chip-num">1,400+</span>
                <span className="stat-chip-label">체험단 캠페인</span>
              </div>
              <div className="stat-chip">
                <span className="stat-chip-num">무료</span>
                <span className="stat-chip-label">완전 무료</span>
              </div>
            </div>

            <p style={{ fontSize: '10px', color: '#C8CBD2', textAlign: 'center', marginTop: '16px', lineHeight: 1.7 }}>
              로그인 시 서비스 이용약관 및 개인정보처리방침에 동의하는 것으로 간주됩니다
            </p>

            <a href="/" className="back-link">← 메인으로 돌아가기</a>
          </div>
        </div>
      </div>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0D0D14',
        fontFamily: "'Noto Sans KR', sans-serif",
        color: 'rgba(255,255,255,.4)', fontSize: '14px',
      }}>
        로딩 중...
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
