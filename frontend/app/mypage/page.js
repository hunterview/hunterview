'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'

/* ─── helpers ─── */
function calcDday(dateStr) {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0,0,0,0)
  const target = new Date(dateStr); target.setHours(0,0,0,0)
  return Math.ceil((target - today) / 86400000)
}

function ddayBadge(d) {
  if (d === null)  return { text: '-',      bg: '#F0F0F0', color: '#AAA' }
  if (d < 0)       return { text: '마감',   bg: '#F0F0F0', color: '#AAA' }
  if (d === 0)     return { text: 'D-day',  bg: '#FF6B35', color: '#fff' }
  if (d === 1)     return { text: 'D-1',    bg: '#FF4040', color: '#fff' }
  if (d <= 5)      return { text: `D-${d}`, bg: '#FFF3EE', color: '#FF6B35' }
  return             { text: `D-${d}`, bg: '#F5F6F8', color: '#AAAAAA' }
}

function stripeColor(d) {
  if (d === null || d < 0) return '#DDDDDD'
  if (d <= 1) return '#FF4040'
  if (d <= 7) return '#FF6B35'
  return '#DDDDDD'
}

function fmt(n) { return Number(n || 0).toLocaleString('ko-KR') }

function getYM(offsetMonths = 0) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offsetMonths)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function ymLabel(ym) {
  const [y, m] = ym.split('-')
  return `${y}년 ${Number(m)}월`
}

function localDateStr(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function buildCalendar(ym) {
  const [y, m] = ym.split('-').map(Number)
  const firstDay = new Date(y, m - 1, 1).getDay()
  const daysInMonth = new Date(y, m, 0).getDate()
  return { firstDay, daysInMonth, year: y, month: m }
}

const STORAGE_KEY = uid => `hunterview_schedules_${uid}`
const FF = '-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif'
const inputStyle = {
  width: '100%', padding: '11px 14px',
  border: '1.5px solid #EBEBEB', borderRadius: 10,
  fontSize: 13, background: '#F5F6F8', outline: 'none',
  fontFamily: FF, color: '#1A1A1A',
  WebkitAppearance: 'none', appearance: 'none',
  boxSizing: 'border-box',
}

/* ─── 서브 컴포넌트 ─── */
function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FF }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #EBEBEB', borderTopColor: '#FF6B35', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 16px' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <p style={{ color: '#AAAAAA', fontSize: 14 }}>불러오는 중...</p>
      </div>
    </div>
  )
}

function FormField({ label, required, children, flex }) {
  return (
    <div style={{ marginBottom: 12, ...(flex ? { flex } : {}) }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#666', marginBottom: 5 }}>
        {label}{required && <span style={{ color: '#FF4040', marginLeft: 3 }}>*</span>}
      </div>
      {children}
    </div>
  )
}

function AmountField({ label, value, onChange }) {
  return (
    <FormField label={label} flex={1}>
      <div style={{ position: 'relative' }}>
        <input type="number" value={value} onChange={e => onChange(e.target.value)}
          placeholder="0" style={{ ...inputStyle, paddingRight: 28 }} />
        <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#AAAAAA', pointerEvents: 'none' }}>원</span>
      </div>
    </FormField>
  )
}

function ScheduleCard({ s, onDelete, onComplete, onView }) {
  const d  = calcDday(s.deadline)
  const dd = ddayBadge(d)
  return (
    <div onClick={() => onView && onView(s)}
      style={{ background: '#fff', borderRadius: 14, display: 'flex', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,.06)', cursor: onView ? 'pointer' : 'default' }}>
      <div style={{ width: 4, flexShrink: 0, background: stripeColor(d) }} />
      <div style={{ flex: 1, padding: '13px 14px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20, background: dd.bg, color: dd.color, flexShrink: 0 }}>{dd.text}</span>
          {s.deadline && <span style={{ fontSize: 11, color: '#AAAAAA' }}>{s.deadline.replace(/-/g, '.')} 까지</span>}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', lineHeight: 1.4, marginBottom: 8 }}>{s.title}</div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          {s.postingType && <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: '#F5F6F8', color: '#666' }}>{s.postingType}</span>}
          {s.site && <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: '#FFF3EE', color: '#FF6B35' }}>{s.site}</span>}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
            <button onClick={e => { e.stopPropagation(); onComplete(s.id) }}
              style={{ background: '#F0FAF5', border: '1px solid #00C471', borderRadius: 6, padding: '2px 8px', fontSize: 10, color: '#00C471', cursor: 'pointer', fontFamily: FF, fontWeight: 700 }}>완료</button>
            <button onClick={e => { e.stopPropagation(); onDelete(s.id) }}
              style={{ background: 'none', border: '1px solid #EBEBEB', borderRadius: 6, padding: '2px 8px', fontSize: 10, color: '#AAAAAA', cursor: 'pointer', fontFamily: FF }}>삭제</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function GroupSection({ label, color, items, onDelete, onComplete, onView }) {
  if (!items.length) return null
  return (
    <div style={{ padding: '16px 14px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: .4, color }}>{label}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#AAAAAA', background: '#F5F6F8', borderRadius: 10, padding: '2px 8px', fontWeight: 700 }}>{items.length}건</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(s => <ScheduleCard key={s.id} s={s} onDelete={onDelete} onComplete={onComplete} onView={onView} />)}
      </div>
    </div>
  )
}

function DoneCard({ s, onView }) {
  const completedDate = s.completedAt ? new Date(s.completedAt) : null
  const dateStr = completedDate
    ? `${completedDate.getMonth()+1}월 ${completedDate.getDate()}일 완료`
    : '완료'
  const income = (s.sponsorAmount || 0) + (s.fee || 0)
  return (
    <div onClick={() => onView(s)}
      style={{ background: '#fff', borderRadius: 14, display: 'flex', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.04)', cursor: 'pointer' }}>
      <div style={{ width: 4, flexShrink: 0, background: '#00C471' }} />
      <div style={{ flex: 1, padding: '12px 14px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
          <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: '#E8F8EF', color: '#00C471', flexShrink: 0 }}>✓ 완료</span>
          <span style={{ fontSize: 11, color: '#AAAAAA' }}>{dateStr}</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#AAAAAA', lineHeight: 1.4 }}>{s.title}</div>
        {income > 0 && (
          <div style={{ fontSize: 11, color: '#FF6B35', marginTop: 4, fontWeight: 700 }}>+{fmt(income)}원</div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px', color: '#CCCCCC', fontSize: 18 }}>›</div>
    </div>
  )
}

function DetailModal({ s, onClose, onUncomplete, onDelete }) {
  const completedDate = s.completedAt ? new Date(s.completedAt) : null
  const completedStr = completedDate
    ? `${completedDate.getFullYear()}년 ${completedDate.getMonth()+1}월 ${completedDate.getDate()}일`
    : null

  const infoRows = [
    s.deadline && { label: '제출 마감일', value: s.deadline.replace(/-/g, '.') },
    completedStr && { label: '완료일', value: completedStr, valueColor: '#00C471' },
    s.postingType && { label: '포스팅 종류', value: s.postingType },
    s.site && { label: '체험단 사이트', value: s.site, valueColor: '#FF6B35' },
  ].filter(Boolean)

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 300 }}>
      <div style={{ background: '#fff', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 430, maxHeight: '88vh', overflowY: 'auto', paddingBottom: 44 }}>
        {/* 핸들 */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 2px' }}>
          <span style={{ width: 36, height: 4, background: '#E0E0E0', borderRadius: 2, display: 'block' }} />
        </div>
        {/* 헤더 */}
        <div style={{ padding: '10px 20px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid #F5F6F8', gap: 10 }}>
          <div>
            {s.done && (
              <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: '#E8F8EF', color: '#00C471', marginBottom: 6 }}>✓ 완료</span>
            )}
            <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1A1A1A', lineHeight: 1.4, margin: 0 }}>{s.title}</h3>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', background: '#F5F6F8', border: 'none', cursor: 'pointer', fontSize: 13, color: '#666', fontFamily: FF, flexShrink: 0 }}>✕</button>
        </div>

        {/* 정보 */}
        <div style={{ padding: '4px 20px 0' }}>
          {infoRows.map(row => (
            <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid #F5F6F8' }}>
              <span style={{ fontSize: 12, color: '#AAAAAA', fontWeight: 600 }}>{row.label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: row.valueColor || '#1A1A1A' }}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* 금액 */}
        {(s.sponsorAmount > 0 || s.fee > 0 || s.expense > 0) && (
          <div style={{ margin: '14px 20px 0', background: '#F5F6F8', borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#AAAAAA', marginBottom: 10 }}>금액</div>
            {s.sponsorAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#666' }}>협찬 금액</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#FF6B35' }}>+{fmt(s.sponsorAmount)}원</span>
              </div>
            )}
            {s.fee > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: s.expense > 0 ? 8 : 0 }}>
                <span style={{ fontSize: 12, color: '#666' }}>원고료</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#00C471' }}>+{fmt(s.fee)}원</span>
              </div>
            )}
            {s.expense > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#666' }}>내가 쓴 금액</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#FF4040' }}>−{fmt(s.expense)}원</span>
              </div>
            )}
          </div>
        )}

        {/* 메모 */}
        {s.memo && (
          <div style={{ margin: '14px 20px 0' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#AAAAAA', marginBottom: 8 }}>메모</div>
            <div style={{ fontSize: 13, color: '#555', lineHeight: 1.7, background: '#F5F6F8', borderRadius: 12, padding: 14 }}>{s.memo}</div>
          </div>
        )}

        {/* 버튼 */}
        <div style={{ display: 'flex', gap: 8, padding: '20px 20px 0' }}>
          {s.done ? (
            <>
              <button onClick={() => onUncomplete(s.id)}
                style={{ flex: 1, padding: 13, background: '#E8F8EF', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#00C471', cursor: 'pointer', fontFamily: FF }}>
                완료 취소
              </button>
              <button onClick={() => onDelete(s.id)}
                style={{ flex: 1, padding: 13, background: '#FFF0EF', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#FF4040', cursor: 'pointer', fontFamily: FF }}>
                삭제
              </button>
            </>
          ) : (
            <button onClick={onClose}
              style={{ flex: 1, padding: 13, background: '#F5F6F8', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#666', cursor: 'pointer', fontFamily: FF }}>
              닫기
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

/* ─── 메인 컴포넌트 ─── */
export default function MypagePage() {
  const router = useRouter()
  const [user,         setUser]         = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [tab,          setTab]          = useState('schedule')
  const [schedules,    setSchedules]    = useState([])
  const [showModal,    setShowModal]    = useState(false)
  const [incomeOffset, setIncomeOffset] = useState(0)
  const [detailSchedule, setDetailSchedule] = useState(null)
  const [showDone,     setShowDone]     = useState(false)
  const [calendarDay,  setCalendarDay]  = useState(null)
  const [form, setForm] = useState({
    title: '', deadline: '', postingType: '', site: '', siteDirect: '',
    sponsorAmount: '', fee: '', expense: '', memo: '',
  })

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login?next=/mypage'); return }
      setUser(user)
      try {
        const stored = localStorage.getItem(STORAGE_KEY(user.id))
        if (stored) setSchedules(JSON.parse(stored))
      } catch {}
      setLoading(false)
    }
    init()
  }, [router])

  const saveSchedules = useCallback((list) => {
    setSchedules(list)
    if (user) localStorage.setItem(STORAGE_KEY(user.id), JSON.stringify(list))
  }, [user])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/')
  }

  const handleAdd = () => {
    if (!form.title || !form.deadline) { alert('제목과 마감일은 필수입니다.'); return }
    const site = form.site === '__direct__' ? form.siteDirect.trim() : form.site
    saveSchedules([{
      id: Date.now().toString(),
      title: form.title,
      deadline: form.deadline,
      postingType: form.postingType,
      site,
      sponsorAmount: Number(form.sponsorAmount) || 0,
      fee: Number(form.fee) || 0,
      expense: Number(form.expense) || 0,
      memo: form.memo,
      month: form.deadline.slice(0, 7),
      createdAt: new Date().toISOString(),
    }, ...schedules])
    setShowModal(false)
    setForm({ title: '', deadline: '', postingType: '', site: '', siteDirect: '', sponsorAmount: '', fee: '', expense: '', memo: '' })
  }

  const handleDelete = useCallback((id) => {
    if (!confirm('삭제할까요?')) return
    saveSchedules(schedules.filter(s => s.id !== id))
    setDetailSchedule(d => d?.id === id ? null : d)
  }, [schedules, saveSchedules])

  const handleComplete = useCallback((id) => {
    const updated = schedules.map(s => s.id === id ? { ...s, done: true, completedAt: new Date().toISOString() } : s)
    saveSchedules(updated)
  }, [schedules, saveSchedules])

  const handleUncomplete = useCallback((id) => {
    const updated = schedules.map(s => s.id === id ? { ...s, done: false, completedAt: undefined } : s)
    saveSchedules(updated)
    setDetailSchedule(null)
  }, [schedules, saveSchedules])

  const handleOffsetChange = (delta) => {
    setIncomeOffset(o => o + delta)
    setCalendarDay(null)
  }

  if (loading) return <LoadingScreen />

  /* ─ 스케줄 그룹 ─ */
  const active = schedules.filter(s => { const d = calcDday(s.deadline); return d !== null && d >= 0 && !s.done })
  const urgent = active.filter(s => calcDday(s.deadline) <= 1)
  const week   = active.filter(s => { const d = calcDday(s.deadline); return d > 1 && d <= 7 })
  const later  = active.filter(s => calcDday(s.deadline) > 7)
  const done   = schedules.filter(s => s.done)

  /* ─ 수익 계산 ─ */
  const incomeYM     = getYM(incomeOffset)
  const monthItems   = schedules.filter(s => (s.month || s.deadline?.slice(0, 7)) === incomeYM)
  const totalSponsor = monthItems.reduce((a, s) => a + (s.sponsorAmount || 0), 0)
  const totalFee     = monthItems.reduce((a, s) => a + (s.fee || 0), 0)
  const totalExpense = monthItems.reduce((a, s) => a + (s.expense || 0), 0)
  const totalIncome  = totalSponsor + totalFee - totalExpense

  /* ─ 월별 바 차트 ─ */
  const barData = [-3, -2, -1, 0].map(o => {
    const ym    = getYM(o + incomeOffset)
    const items = schedules.filter(s => (s.month || s.deadline?.slice(0, 7)) === ym)
    const total = items.reduce((a, s) => a + (s.sponsorAmount || 0) + (s.fee || 0) - (s.expense || 0), 0)
    return { label: `${Number(ym.split('-')[1])}월`, total, isThis: o === 0 }
  })
  const maxBar = Math.max(...barData.map(b => b.total), 1)

  /* ─ 달력 ─ */
  const { firstDay, daysInMonth, year: calYear, month: calMonth } = buildCalendar(incomeYM)
  const completedByDay = {}
  schedules.forEach(s => {
    if (s.done && s.completedAt) {
      const key = localDateStr(s.completedAt)
      if (key.startsWith(incomeYM)) {
        if (!completedByDay[key]) completedByDay[key] = []
        completedByDay[key].push(s)
      }
    }
  })
  const calCells = []
  for (let i = 0; i < firstDay; i++) calCells.push(null)
  for (let d = 1; d <= daysInMonth; d++) calCells.push(d)
  while (calCells.length % 7 !== 0) calCells.push(null)
  const todayStr = localDateStr(new Date().toISOString())

  const selectStyle = { ...inputStyle, paddingRight: 28 }
  const arrowStyle  = { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-30%)', borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '6px solid #BBB', pointerEvents: 'none' }

  return (
    <div style={{ fontFamily: FF, background: '#F5F6F8', color: '#1A1A1A', maxWidth: 430, margin: '0 auto', minHeight: '100vh', fontSize: 14, paddingBottom: 80 }}>

      {/* 헤더 */}
      <div style={{ background: '#fff', padding: '14px 20px 0', borderBottom: '1px solid #EBEBEB', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 19, fontWeight: 900, letterSpacing: '-0.5px' }}>
            헌터뷰<span style={{ color: '#FF6B35' }}>.</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#666' }}>
              {user?.user_metadata?.full_name || user?.user_metadata?.name || '사용자'}
            </span>
            <button onClick={handleLogout} style={{ fontSize: 11, color: '#AAAAAA', background: 'none', border: '1px solid #EBEBEB', borderRadius: 6, padding: '3px 9px', cursor: 'pointer', fontFamily: FF }}>
              로그아웃
            </button>
          </div>
        </div>
        <div style={{ display: 'flex' }}>
          {[['schedule', '협찬스케줄'], ['income', '수익']].map(([id, label]) => (
            <div key={id} onClick={() => setTab(id)}
              style={{ padding: '8px 20px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: tab === id ? '#FF6B35' : '#AAAAAA', borderBottom: tab === id ? '2.5px solid #FF6B35' : '2.5px solid transparent', transition: 'color .15s' }}>
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* ══ 협찬스케줄 탭 ══ */}
      {tab === 'schedule' && (
        <div>
          <div style={{ padding: '12px 14px 0' }}>
            <button onClick={() => setShowModal(true)}
              style={{ width: '100%', padding: 13, background: '#FF6B35', border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px rgba(255,107,53,.2)', fontFamily: FF }}>
              등록하기
            </button>
          </div>

          {/* 요약 스트립 */}
          <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #EBEBEB', marginTop: 12 }}>
            {[
              { num: urgent.length, lbl: '오늘 마감',  numColor: '#FF4040', lblColor: '#FF9090' },
              { num: week.length,   lbl: '이번 주',    numColor: '#FFAA00', lblColor: '#FFCC66' },
              { num: active.length, lbl: '전체 일정',  numColor: '#FF6B35', lblColor: '#FFD4C2' },
            ].map((s, i, a) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 8px', borderRight: i < a.length - 1 ? '1px solid #EBEBEB' : 'none' }}>
                <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1, marginBottom: 4, color: s.numColor }}>{s.num}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: s.lblColor }}>{s.lbl}</div>
              </div>
            ))}
          </div>

          <GroupSection label="긴급"      color="#FF4040"  items={urgent} onDelete={handleDelete} onComplete={handleComplete} onView={s => setDetailSchedule(s)} />
          <GroupSection label="이번 주"   color="#FF6B35"  items={week}   onDelete={handleDelete} onComplete={handleComplete} onView={s => setDetailSchedule(s)} />
          <GroupSection label="여유 있음"  color="#AAAAAA" items={later}  onDelete={handleDelete} onComplete={handleComplete} onView={s => setDetailSchedule(s)} />

          {active.length === 0 && done.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#AAAAAA' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#555', marginBottom: 6 }}>등록된 스케줄이 없어요</p>
              <p style={{ fontSize: 12 }}>등록하기 버튼으로 체험단 일정을 추가해보세요</p>
            </div>
          )}

          {/* 완료된 일정 */}
          {done.length > 0 && (
            <div style={{ padding: '20px 14px 0' }}>
              <button onClick={() => setShowDone(v => !v)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', border: 'none', borderRadius: 14, padding: '13px 16px', cursor: 'pointer', fontFamily: FF, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00C471' }} />
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#00C471' }}>완료된 일정</span>
                  <span style={{ fontSize: 10, color: '#AAAAAA', background: '#F5F6F8', borderRadius: 10, padding: '2px 8px', fontWeight: 700 }}>{done.length}건</span>
                </div>
                <span style={{ fontSize: 14, color: '#AAAAAA', transform: showDone ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .2s', display: 'inline-block' }}>›</span>
              </button>
              {showDone && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  {done.map(s => <DoneCard key={s.id} s={s} onView={s => setDetailSchedule(s)} />)}
                </div>
              )}
            </div>
          )}

          <div style={{ height: 20 }} />
        </div>
      )}

      {/* ══ 수익 탭 ══ */}
      {tab === 'income' && (
        <div style={{ padding: '0 14px 100px' }}>

          {/* 히어로 카드 */}
          <div style={{ background: 'linear-gradient(135deg,#FF6B35 0%,#FF9550 100%)', borderRadius: 18, padding: '20px 20px 18px', margin: '14px 0 12px', color: '#fff', boxShadow: '0 6px 20px rgba(255,107,53,.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
              <button onClick={() => handleOffsetChange(-1)} style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(255,255,255,.2)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 13 }}>‹</button>
              <span style={{ fontSize: 14, fontWeight: 900, margin: '0 8px' }}>{ymLabel(incomeYM)}</span>
              <button onClick={() => handleOffsetChange(1)} style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(255,255,255,.2)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 13 }}>›</button>
            </div>
            <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: '-1px', marginBottom: 4 }}>{fmt(totalIncome)}원</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.75)', fontWeight: 600 }}>협찬 + 원고료 − 지출</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', marginTop: 10, background: 'rgba(255,255,255,.2)', borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 700 }}>
              {monthItems.length}건 등록
            </div>
          </div>

          {/* 완료 달력 */}
          <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 1px 6px rgba(0,0,0,.06)', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#666' }}>완료 달력</span>
              {Object.keys(completedByDay).length > 0 && (
                <span style={{ fontSize: 10, color: '#FF6B35', fontWeight: 700 }}>● {Object.keys(completedByDay).length}일 완료</span>
              )}
            </div>
            {/* 요일 헤더 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 6 }}>
              {DAY_LABELS.map((d, i) => (
                <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: i === 0 ? '#FF6B35' : i === 6 ? '#5B9CF6' : '#AAAAAA', paddingBottom: 4 }}>{d}</div>
              ))}
            </div>
            {/* 날짜 셀 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px 0' }}>
              {calCells.map((day, i) => {
                if (!day) return <div key={`e${i}`} />
                const dateKey = `${calYear}-${String(calMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                const hasDone = !!completedByDay[dateKey]
                const isSelected = calendarDay === dateKey
                const isToday = dateKey === todayStr
                const col = i % 7
                const textColor = isSelected ? '#fff' : hasDone ? '#FF6B35' : isToday ? '#FF6B35' : col === 0 ? '#FF9090' : col === 6 ? '#9BB8FF' : '#444'
                return (
                  <div key={dateKey} onClick={() => hasDone && setCalendarDay(isSelected ? null : dateKey)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3px 0', cursor: hasDone ? 'pointer' : 'default' }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isSelected ? '#FF6B35' : isToday && !isSelected ? '#FFF3EE' : 'transparent',
                      fontSize: 11, fontWeight: hasDone || isToday ? 800 : 400,
                      color: textColor,
                      border: isToday && !isSelected ? '1.5px solid #FF6B35' : 'none',
                    }}>{day}</div>
                    {hasDone && <div style={{ width: 4, height: 4, borderRadius: '50%', background: isSelected ? '#FF6B35' : '#FFB89A', marginTop: 1 }} />}
                  </div>
                )
              })}
            </div>

            {/* 선택 날짜 완료 목록 */}
            {calendarDay && completedByDay[calendarDay] && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #F5F6F8' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#666', marginBottom: 8 }}>
                  {Number(calendarDay.split('-')[2])}일 완료 체험단
                </div>
                {completedByDay[calendarDay].map(s => {
                  const income = (s.sponsorAmount || 0) + (s.fee || 0)
                  return (
                    <div key={s.id} onClick={() => setDetailSchedule(s)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: '1px solid #F5F6F8', cursor: 'pointer' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00C471', flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                      {income > 0 && <span style={{ fontSize: 12, fontWeight: 800, color: '#FF6B35', whiteSpace: 'nowrap' }}>+{fmt(income)}원</span>}
                      <span style={{ fontSize: 14, color: '#CCCCCC' }}>›</span>
                    </div>
                  )
                })}
              </div>
            )}

            {Object.keys(completedByDay).length === 0 && (
              <div style={{ textAlign: 'center', padding: '16px 0 4px', color: '#CCCCCC', fontSize: 12 }}>이달 완료한 체험단이 없어요</div>
            )}
          </div>

          {/* 수익 구성 */}
          <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 1px 6px rgba(0,0,0,.06)', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#666', marginBottom: 14 }}>수익 구성</div>
            {[
              { label: '협찬 금액',    color: '#FF6B35', val: totalSponsor, max: Math.max(totalSponsor, 1), prefix: '+' },
              { label: '원고료',       color: '#00C471', val: totalFee,     max: Math.max(totalFee, 1),     prefix: '+' },
              { label: '내가 쓴 금액', color: '#FF4040', val: totalExpense, max: Math.max(totalExpense, 1), prefix: '−' },
            ].map(b => (
              <div key={b.label} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#666' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: b.color }} />
                    {b.label}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 900, color: b.color }}>{b.prefix}{fmt(b.val)}원</span>
                </div>
                <div style={{ height: 5, background: '#F5F6F8', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: b.color, borderRadius: 3, width: `${Math.min((b.val / b.max) * 100, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* 월별 바 차트 */}
          <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 1px 6px rgba(0,0,0,.06)', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#666', marginBottom: 16 }}>월별 수익 추이</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
              {barData.map((b, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  {b.total > 0 && <span style={{ fontSize: 8, color: '#666', fontWeight: 700 }}>{(b.total / 10000).toFixed(1)}</span>}
                  <div style={{ width: '100%', borderRadius: '5px 5px 0 0', background: b.isThis ? '#FF6B35' : '#FFD4C2', height: `${Math.max((b.total / maxBar) * 72, b.total > 0 ? 8 : 2)}px` }} />
                  <span style={{ fontSize: 9, color: '#AAAAAA', fontWeight: 700 }}>{b.label}</span>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', fontSize: 9, color: '#AAAAAA', marginTop: 6 }}>단위: 만원</div>
          </div>

          {/* 내역 */}
          <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 1px 6px rgba(0,0,0,.06)' }}>
            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 14 }}>{ymLabel(incomeYM)} 내역</div>
            {monthItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#AAAAAA', fontSize: 13 }}>이번 달 등록된 체험단이 없어요</div>
            ) : monthItems.map(s => (
              <div key={s.id} onClick={() => setDetailSchedule(s)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: '1px solid #F5F6F8', cursor: 'pointer' }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: s.done ? '#E8F8EF' : '#FFF3EE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {s.done
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00C471" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2">
                        <path d="M20 12v10H4V12" /><path d="M22 7H2v5h20V7z" /><path d="M12 22V7" />
                        <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
                      </svg>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: s.done ? '#AAAAAA' : '#1A1A1A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
                  <div style={{ fontSize: 10, color: '#AAAAAA', marginTop: 2 }}>{s.done ? '완료' : (s.site || s.postingType || '체험단')}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#FF6B35', whiteSpace: 'nowrap' }}>+{fmt(s.sponsorAmount)}원</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 하단 내비 */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, background: '#fff', borderTop: '1px solid #EBEBEB', display: 'flex', padding: '8px 0 20px', zIndex: 100 }}>
        <a href="/" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', padding: '4px 0', textDecoration: 'none' }}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#AAAAAA" strokeWidth="1.8">
            <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z" />
            <path d="M9 21V12h6v9" />
          </svg>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#AAAAAA' }}>홈</span>
        </a>
        {[
          { id: 'schedule', label: '협찬스케줄' },
          { id: 'income',   label: '수익' },
        ].map(n => (
          <div key={n.id} onClick={() => setTab(n.id)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', padding: '4px 0' }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={tab === n.id ? '#FF6B35' : '#AAAAAA'} strokeWidth="1.8">
              {n.id === 'schedule'
                ? <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>
                : <><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></>}
            </svg>
            <span style={{ fontSize: 10, fontWeight: 700, color: tab === n.id ? '#FF6B35' : '#AAAAAA' }}>{n.label}</span>
          </div>
        ))}
      </div>

      {/* 스케줄 등록 모달 */}
      {showModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 430, maxHeight: '92vh', overflowY: 'auto', paddingBottom: 44 }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 2px' }}>
              <span style={{ width: 36, height: 4, background: '#E0E0E0', borderRadius: 2, display: 'block' }} />
            </div>
            <div style={{ padding: '10px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F5F6F8' }}>
              <h3 style={{ fontSize: 17, fontWeight: 900 }}>스케줄 추가</h3>
              <button onClick={() => setShowModal(false)} style={{ width: 28, height: 28, borderRadius: '50%', background: '#F5F6F8', border: 'none', cursor: 'pointer', fontSize: 13, color: '#666', fontFamily: FF }}>✕</button>
            </div>

            <div style={{ padding: '16px 20px 0' }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: .5, color: '#AAAAAA', marginBottom: 14 }}>기본 정보</div>
              <FormField label="체험단 제목" required>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="체험단 제목을 입력하세요." style={inputStyle} />
              </FormField>
              <FormField label="제출 마감일" required>
                <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} style={inputStyle} />
              </FormField>
              <div style={{ display: 'flex', gap: 8 }}>
                <FormField label="포스팅 종류" required flex={1}>
                  <div style={{ position: 'relative' }}>
                    <select value={form.postingType} onChange={e => setForm(f => ({ ...f, postingType: e.target.value }))} style={selectStyle}>
                      <option value="">선택</option>
                      {['블로그', '인스타그램', '유튜브', '숏폼 / 릴스'].map(v => <option key={v}>{v}</option>)}
                    </select>
                    <div style={arrowStyle} />
                  </div>
                </FormField>
                <FormField label="체험단 사이트" flex={1}>
                  <div style={{ position: 'relative' }}>
                    <select value={form.site} onChange={e => setForm(f => ({ ...f, site: e.target.value, siteDirect: '' }))} style={selectStyle}>
                      <option value="">선택</option>
                      {['티블', '파블로체험단', '디너의여왕', '포블로그', '데일리뷰', '링블', '블로그랩', '놀러와체험단', '리뷰플레이스', '핌블', '포포몬'].map(v => <option key={v}>{v}</option>)}
                      <option value="__direct__">직접 입력</option>
                    </select>
                    <div style={arrowStyle} />
                  </div>
                  {form.site === '__direct__' && (
                    <input value={form.siteDirect} onChange={e => setForm(f => ({ ...f, siteDirect: e.target.value }))}
                      placeholder="사이트명 직접 입력" style={{ ...inputStyle, marginTop: 6 }} />
                  )}
                </FormField>
              </div>
            </div>

            <div style={{ height: 1, background: '#F5F6F8', margin: '16px 0 0' }} />

            <div style={{ padding: '16px 20px 0' }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: .5, color: '#AAAAAA', marginBottom: 14 }}>금액 정보</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <AmountField label="협찬 금액" value={form.sponsorAmount} onChange={v => setForm(f => ({ ...f, sponsorAmount: v }))} />
                <AmountField label="원고료"    value={form.fee}           onChange={v => setForm(f => ({ ...f, fee: v }))} />
              </div>
              <div style={{ maxWidth: 'calc(50% - 4px)' }}>
                <AmountField label="내가 쓴 금액" value={form.expense} onChange={v => setForm(f => ({ ...f, expense: v }))} />
              </div>
            </div>

            <div style={{ height: 1, background: '#F5F6F8', margin: '16px 0 0' }} />

            <div style={{ padding: '16px 20px 0' }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: .5, color: '#AAAAAA', marginBottom: 14 }}>메모</div>
              <textarea value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                placeholder="방문 일정, 제출 링크, 선정 여부 등 자유롭게 메모하세요."
                rows={3} style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }} />
            </div>

            <div style={{ display: 'flex', gap: 8, padding: '16px 20px 0' }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: 13, background: '#F5F6F8', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#AAAAAA', cursor: 'pointer', fontFamily: FF }}>취소</button>
              <button onClick={handleAdd}                 style={{ flex: 2, padding: 13, background: '#FF6B35', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800, color: '#fff', cursor: 'pointer', fontFamily: FF, boxShadow: '0 4px 12px rgba(255,107,53,.25)' }}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 상세 모달 */}
      {detailSchedule && (
        <DetailModal
          s={detailSchedule}
          onClose={() => setDetailSchedule(null)}
          onUncomplete={handleUncomplete}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
