/**
 * 마이페이지 - 내가 신청한 체험단 목록
 * 로그인 없이 anon_id 쿠키 기반으로 신청 내역 관리
 */
'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const STATUS_STYLE = {
  '신청완료' : { bg: '#EEF3FF', color: '#0066FF' },
  '선정됨'   : { bg: '#E6FAF2', color: '#00C471' },
  '후기작성중': { bg: '#FFF8E6', color: '#FFAA00' },
  '완료'     : { bg: '#F3F3F3', color: '#AAAAAA' },
}
const STATUS_LIST = ['신청완료', '선정됨', '후기작성중', '완료']

export default function MypagePage() {
  const router = useRouter()
  const [applications, setApplications] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [filter,       setFilter]       = useState('전체')

  useEffect(() => {
    fetch('/api/applications')
      .then(r => r.json())
      .then(({ applications }) => {
        setApplications(applications || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // 상태 변경
  const updateStatus = async (id, newStatus) => {
    const res = await fetch('/api/applications', {
      method : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ id, status: newStatus }),
    })
    if (res.ok) {
      setApplications(prev =>
        prev.map(a => a.id === id ? { ...a, status: newStatus } : a)
      )
    }
  }

  // 신청 취소
  const cancelApplication = async (id) => {
    if (!confirm('신청을 취소할까요? 이 작업은 되돌릴 수 없습니다.')) return
    const res = await fetch(`/api/applications?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setApplications(prev => prev.filter(a => a.id !== id))
    }
  }

  const filtered = filter === '전체'
    ? applications
    : applications.filter(a => a.status === filter)

  // ── 로딩 화면 ──────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Noto Sans KR', sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #EBEBEB', borderTopColor: '#FF6B35', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 16px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: '#AAAAAA', fontSize: '14px' }}>로딩 중...</p>
        </div>
      </div>
    )
  }

  // ── 메인 UI ────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FA', fontFamily: "'Noto Sans KR', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet" />

      {/* 헤더 */}
      <header style={{
        background: '#fff', borderBottom: '1px solid #EBEBEB',
        padding: '0 32px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', height: '60px',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 4px rgba(0,0,0,.06)',
      }}>
        <a href="/" style={{ fontSize: '20px', fontWeight: 900, color: '#1A1A1A', textDecoration: 'none', letterSpacing: '-0.5px' }}>
          헌터뷰<span style={{ color: '#FF6B35' }}>.</span>
        </a>
        <a href="/" style={{
          background: 'none', border: '1.5px solid #EBEBEB',
          borderRadius: '8px', padding: '6px 14px',
          fontSize: '13px', color: '#555', textDecoration: 'none',
        }}>
          ← 메인으로
        </a>
      </header>

      {/* 메인 콘텐츠 */}
      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '36px 24px' }}>

        {/* 타이틀 */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#1A1A1A', marginBottom: '4px' }}>
            📋 내가 신청한 체험단
          </h1>
          <p style={{ fontSize: '13px', color: '#AAAAAA' }}>
            총 {applications.length}개 신청 내역
          </p>
        </div>

        {/* 상태 필터 탭 */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {['전체', ...STATUS_LIST].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              style={{
                padding: '6px 16px', borderRadius: '20px', fontSize: '13px',
                fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                background: filter === s ? '#FF6B35' : '#fff',
                color     : filter === s ? '#fff'    : '#555',
                border    : filter === s ? 'none'    : '1.5px solid #EBEBEB',
                transition: 'all .15s',
              }}
            >
              {s}
              {s !== '전체' && (
                <span style={{ marginLeft: '6px', fontSize: '11px', opacity: .7 }}>
                  {applications.filter(a => a.status === s).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 신청 목록 */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#AAAAAA' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#555', marginBottom: '8px' }}>
              {filter === '전체' ? '아직 신청한 체험단이 없어요' : `'${filter}' 상태의 체험단이 없어요`}
            </h3>
            <p style={{ fontSize: '13px', marginBottom: '24px' }}>
              헌터뷰에서 마음에 드는 체험단을 찾아 신청해보세요!
            </p>
            <a
              href="/"
              style={{
                display: 'inline-block', background: '#FF6B35', color: '#fff',
                padding: '10px 24px', borderRadius: '10px',
                fontSize: '14px', fontWeight: 700, textDecoration: 'none',
              }}
            >
              체험단 찾으러 가기 →
            </a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filtered.map(app => (
              <div
                key={app.id}
                style={{
                  background: '#fff', border: '1.5px solid #EBEBEB',
                  borderRadius: '14px', padding: '18px 20px',
                  boxShadow: '0 1px 4px rgba(0,0,0,.06)',
                }}
              >
                {/* 상단: 플랫폼 + 상태 배지 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '11px', fontWeight: 700, padding: '2px 10px',
                    borderRadius: '6px', background: '#F8F9FA', color: '#555', border: '1px solid #EBEBEB',
                  }}>
                    {app.campaign_platform || '체험단'}
                  </span>

                  {/* 상태 드롭다운 */}
                  <select
                    value={app.status}
                    onChange={e => updateStatus(app.id, e.target.value)}
                    style={{
                      fontSize: '11px', fontWeight: 700, padding: '2px 8px',
                      borderRadius: '6px', border: 'none', cursor: 'pointer',
                      background: STATUS_STYLE[app.status]?.bg || '#F3F3F3',
                      color     : STATUS_STYLE[app.status]?.color || '#555',
                      fontFamily: 'inherit', outline: 'none',
                    }}
                  >
                    {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>

                  <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#AAAAAA' }}>
                    {new Date(app.applied_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} 신청
                  </span>
                </div>

                {/* 캠페인 제목 */}
                <h3 style={{
                  fontSize: '15px', fontWeight: 700, color: '#1A1A1A',
                  lineHeight: 1.45, marginBottom: '12px',
                }}>
                  {app.campaign_title}
                </h3>

                {/* 버튼 */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {app.campaign_link && (
                    <a
                      href={app.campaign_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        flex: 1, background: '#FF6B35', color: '#fff',
                        padding: '8px', borderRadius: '8px',
                        fontSize: '13px', fontWeight: 700,
                        textDecoration: 'none', textAlign: 'center',
                      }}
                    >
                      체험단 페이지 →
                    </a>
                  )}
                  <button
                    onClick={() => cancelApplication(app.id)}
                    style={{
                      background: 'none', border: '1.5px solid #EBEBEB',
                      borderRadius: '8px', padding: '8px 14px',
                      fontSize: '13px', color: '#AAAAAA', cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
