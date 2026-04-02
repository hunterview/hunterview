'use client';

const SRC_DOT = {
  '리뷰노트':   '#6366f1',
  '아싸뷰':    '#10b981',
  '체험단닷컴': '#f59e0b',
  '레뷰':      '#ef4444',
};

function dday(deadline) {
  if (!deadline) return { text: '-', color: '#d1d5db' };
  const diff = Math.ceil((new Date(deadline) - new Date()) / 86400000);
  if (diff < 0)   return { text: '마감',    color: '#d1d5db' };
  if (diff === 0) return { text: 'D-Day',  color: '#ef4444' };
  if (diff <= 3)  return { text: `D-${diff}`, color: '#ef4444' };
  if (diff <= 7)  return { text: `D-${diff}`, color: '#f97316' };
  return           { text: `D-${diff}`, color: '#9ca3af' };
}

export default function CampaignCard({ item }) {
  const dd  = dday(item.deadline);
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
        padding: '7px 14px',
        borderBottom: '1px solid #f3f4f6',
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
        width: 64,
        textAlign: 'right',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        flexShrink: 0,
      }}>
        {item.region && item.region !== '정보없음' ? item.region : ''}
      </span>

      {/* D-day */}
      <span style={{
        fontSize: 11,
        fontWeight: 600,
        color: dd.color,
        whiteSpace: 'nowrap',
        width: 40,
        textAlign: 'right',
        flexShrink: 0,
      }}>
        {dd.text}
      </span>
    </a>
  );
}
