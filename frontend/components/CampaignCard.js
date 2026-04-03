'use client';

// 소스별 색상 (새 크롤러 소스명 기준)
const SRC_DOT = {
  '강남맛집체험단': '#ef4444',  // red
  '파블로':        '#f97316',  // orange
  '모두모여체험단': '#10b981',  // green
  '포블로그':      '#8b5cf6',  // purple
  '블로그랩':      '#06b6d4',  // cyan
  '핌블':          '#ec4899',  // pink
  // 구 소스 fallback
  '리뷰노트':      '#6366f1',
  '아싸뷰':        '#10b981',
  '체험단닷컴':    '#f59e0b',
};

// dday 표시: 숫자형(새 크롤러) 또는 날짜형(구 크롤러) 모두 처리
function getDday(item) {
  // 1. 숫자형 dday 우선
  if (item.dday !== null && item.dday !== undefined) {
    const d = Number(item.dday);
    if (d < 0)   return { text: '마감',    color: '#d1d5db' };
    if (d === 0) return { text: 'D-Day',  color: '#ef4444' };
    if (d === 99) return { text: '상시',  color: '#9ca3af' };
    if (d <= 3)  return { text: `D-${d}`, color: '#ef4444' };
    if (d <= 7)  return { text: `D-${d}`, color: '#f97316' };
    return        { text: `D-${d}`,       color: '#9ca3af' };
  }
  // 2. 날짜형 deadline fallback
  if (item.deadline) {
    const diff = Math.ceil((new Date(item.deadline) - new Date()) / 86400000);
    if (diff < 0)   return { text: '마감',    color: '#d1d5db' };
    if (diff === 0) return { text: 'D-Day',  color: '#ef4444' };
    if (diff <= 3)  return { text: `D-${diff}`, color: '#ef4444' };
    if (diff <= 7)  return { text: `D-${diff}`, color: '#f97316' };
    return           { text: `D-${diff}`,       color: '#9ca3af' };
  }
  return { text: '-', color: '#e5e7eb' };
}

export default function CampaignCard({ item }) {
  const dd  = getDday(item);
  const dot = SRC_DOT[item.source] || '#9ca3af';

  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'grid',
        gridTemplateColumns: '6px 1fr auto auto',
        alignItems: 'center',
        gap: '0 10px',
        padding: '9px 14px',
        textDecoration: 'none',
        background: '#fff',
        cursor: 'pointer',
      }}
      onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
    >
      {/* 출처 색 도트 */}
      <span style={{
        display: 'inline-block',
        width: 6, height: 6,
        borderRadius: '50%',
        background: dot,
        flexShrink: 0,
      }} />

      {/* 제목 */}
      <span style={{
        fontSize: 13,
        color: '#111827',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        lineHeight: '1.4',
      }}>
        {item.title}
      </span>

      {/* 지역 */}
      <span style={{
        fontSize: 11,
        color: '#9ca3af',
        whiteSpace: 'nowrap',
        width: 60,
        textAlign: 'right',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        flexShrink: 0,
      }}>
        {item.region || ''}
      </span>

      {/* D-day */}
      <span style={{
        fontSize: 11,
        fontWeight: 600,
        color: dd.color,
        whiteSpace: 'nowrap',
        width: 38,
        textAlign: 'right',
        flexShrink: 0,
      }}>
        {dd.text}
      </span>
    </a>
  );
}
