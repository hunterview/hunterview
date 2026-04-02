'use client';

const SOURCE_COLOR = {
  '리뷰노트':  'text-indigo-500',
  '아싸뷰':   'text-emerald-500',
  '체험단닷컴': 'text-amber-500',
  '레뷰':     'text-rose-500',
};

function ddayLabel(deadline) {
  if (!deadline) return null;
  const diff = Math.ceil((new Date(deadline) - new Date()) / 86400000);
  if (diff < 0)   return { text: '마감',    cls: 'text-gray-300' };
  if (diff === 0) return { text: 'D-Day',  cls: 'text-red-500 font-bold' };
  if (diff <= 3)  return { text: `D-${diff}`, cls: 'text-red-500 font-bold' };
  if (diff <= 7)  return { text: `D-${diff}`, cls: 'text-orange-400 font-semibold' };
  return           { text: `D-${diff}`, cls: 'text-gray-400' };
}

export default function CampaignCard({ item }) {
  const dd  = ddayLabel(item.deadline);
  const src = SOURCE_COLOR[item.source] || 'text-gray-400';

  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-100 last:border-0"
    >
      {/* 출처 도트 */}
      <span className={`shrink-0 text-[10px] font-bold w-12 truncate ${src}`}>
        {item.source}
      </span>

      {/* 제목 */}
      <span className="flex-1 text-sm text-gray-800 truncate leading-snug">
        {item.title}
      </span>

      {/* 지역 */}
      <span className="shrink-0 text-xs text-gray-400 hidden sm:block w-16 text-right truncate">
        {item.region !== '정보없음' ? item.region : ''}
      </span>

      {/* D-day */}
      <span className={`shrink-0 text-xs w-12 text-right ${dd ? dd.cls : 'text-gray-300'}`}>
        {dd ? dd.text : '-'}
      </span>
    </a>
  );
}
