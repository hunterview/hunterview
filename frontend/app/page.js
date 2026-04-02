'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import CampaignCard from '../components/CampaignCard';
import AdCard from '../components/AdCard';

const API = process.env.NEXT_PUBLIC_API_URL || '';
const PAGE_SIZE = 60;
const AD_EVERY  = 5;

const CATEGORIES = [
  { label: '전체',  q: '' },
  { label: '육아',  q: '육아' },
  { label: '맛집',  q: '맛집' },
  { label: '숙소',  q: '숙소' },
  { label: '뷰티',  q: '뷰티' },
  { label: '운동',  q: '운동' },
  { label: '반려',  q: '반려' },
  { label: '식품',  q: '식품' },
  { label: '패션',  q: '패션' },
  { label: '배송',  q: '배송' },
  { label: '방문',  q: '방문' },
];

const SOURCES = ['전체', '리뷰노트', '아싸뷰', '체험단닷컴'];

export default function Home() {
  // inputValue: 입력창 타이핑 값 — API 호출과 무관
  const [inputValue,  setInputValue]  = useState('');
  // searchQuery: 버튼/Enter 클릭 시에만 변경 — API 호출 트리거
  const [searchQuery, setSearchQuery] = useState('');
  const [category,    setCategory]    = useState('');
  const [source,      setSource]      = useState('전체');

  const [items,   setItems]   = useState([]);
  const [dbTotal, setDbTotal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const offsetRef = useRef(0);
  const loaderRef = useRef(null);
  const inputRef  = useRef(null);
  // 현재 적용된 필터를 ref에 저장 → fetchItems가 항상 최신값을 읽음
  const filterRef = useRef({ searchQuery: '', category: '', source: '전체' });

  useEffect(() => {
    fetch(`${API}/campaigns/stats`)
      .then(r => r.json())
      .then(d => setDbTotal(d.total ?? null))
      .catch(() => {});
  }, []);

  // deps 없이 한 번만 생성 — filterRef로 최신 필터 읽음
  const fetchItems = useCallback(async (reset = false) => {
    setLoading(true);
    const off = reset ? 0 : offsetRef.current;
    const { searchQuery: sq, category: cat, source: src } = filterRef.current;
    try {
      const p = new URLSearchParams({ limit: PAGE_SIZE, offset: off });
      const q = [sq, cat].filter(Boolean).join(' ');
      if (q)              p.set('q', q);
      if (src !== '전체')  p.set('source', src);
      const res  = await fetch(`${API}/campaigns?${p}`);
      const data = await res.json();
      const rows = data.campaigns || [];
      setItems(prev => reset ? rows : [...prev, ...rows]);
      offsetRef.current = off + rows.length;
      setHasMore(rows.length === PAGE_SIZE);
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, []); // 의존성 없음

  // searchQuery / category / source 변경 시에만 재조회
  // filterRef 업데이트와 fetchItems 호출을 같은 effect 안에서 순서대로 처리
  useEffect(() => {
    filterRef.current = { searchQuery, category, source };
    offsetRef.current = 0;
    setItems([]);
    setHasMore(true);
    fetchItems(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, category, source]);

  // 무한 스크롤
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && hasMore && !loading) fetchItems(false);
    }, { rootMargin: '400px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, fetchItems]);

  // 검색 실행: 버튼 클릭 또는 Enter 키
  const handleSearch = (e) => {
    e.preventDefault();
    const q = inputValue.trim();
    if (q) setCategory('');
    setSearchQuery(q); // ← 유일한 API 트리거
  };

  // 검색 초기화
  const handleClear = () => {
    setInputValue('');
    setSearchQuery('');
    inputRef.current?.focus();
  };

  // 카테고리 선택
  const handleCategory = (q) => {
    setCategory(q);
    setInputValue('');
    setSearchQuery('');
  };

  const renderList = () => {
    const out = [];
    items.forEach((item, i) => {
      out.push(<CampaignCard key={item.link + i} item={item} />);
      if ((i + 1) % AD_EVERY === 0) out.push(<AdCard key={`ad-${i}`} />);
    });
    return out;
  };

  return (
    <div className="min-h-screen bg-white">

      {/* 헤더 */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex items-center gap-3 h-12">
            <span className="text-lg font-black text-indigo-600 tracking-tight">헌터뷰</span>
            {dbTotal !== null && (
              <span className="text-xs text-gray-400">
                총 <b className="text-gray-600">{dbTotal.toLocaleString()}</b>개
              </span>
            )}
          </div>

          {/* 검색 폼 */}
          <form onSubmit={handleSearch} className="pb-2.5 flex gap-2">
            <div className="flex flex-1 items-center bg-gray-100 rounded-lg px-3 gap-2 h-10 focus-within:ring-2 focus-within:ring-indigo-400 focus-within:bg-white transition-all">
              <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
              </svg>
              <input
                ref={inputRef}
                type="text"
                placeholder="키워드 입력 후 검색 버튼 클릭"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)} // inputValue만 업데이트, 검색 실행 없음
                onKeyDown={e => e.key === 'Enter' && handleSearch(e)}
                className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400 text-gray-800"
                autoComplete="off"
              />
              {inputValue && (
                <button type="button" onClick={handleClear}
                  className="text-gray-300 hover:text-gray-500 text-lg leading-none">×</button>
              )}
            </div>
            <button
              type="submit"
              className="shrink-0 h-10 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              검색
            </button>
          </form>
        </div>
      </header>

      {/* 카테고리 */}
      <div className="sticky top-[89px] z-40 bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex gap-1.5 py-2 overflow-x-auto scrollbar-hide">
            {CATEGORIES.map(c => (
              <button key={c.label} onClick={() => handleCategory(c.q)}
                className={`shrink-0 text-xs px-3 py-1 rounded-full border font-medium transition-all ${
                  category === c.q && !searchQuery
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-500'
                }`}>{c.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* 소스 필터 */}
      <div className="sticky top-[133px] z-30 bg-gray-50 border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex items-center gap-1.5 py-1.5">
            {SOURCES.map(s => (
              <button key={s} onClick={() => setSource(s)}
                className={`text-[11px] px-2.5 py-1 rounded-full font-semibold transition-all ${
                  source === s
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-gray-700'
                }`}>{s}</button>
            ))}
            <div className="flex-1" />
            <span className="text-[10px] text-gray-300 hidden sm:block w-16 text-right">지역</span>
            <span className="text-[10px] text-gray-300 w-12 text-right">마감</span>
          </div>
        </div>
      </div>

      {/* 리스트 */}
      <main className="max-w-3xl mx-auto pb-16">

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center py-20 gap-2 text-gray-400">
            <span className="text-4xl">🔍</span>
            <p className="text-sm font-medium">검색 결과가 없어요</p>
            <button onClick={() => { handleClear(); setCategory(''); setSource('전체'); }}
              className="text-xs text-indigo-500 mt-1 hover:underline">전체 보기</button>
          </div>
        )}

        <div className="divide-y divide-gray-100">
          {renderList()}
        </div>

        {loading && (
          <div className="flex justify-center py-6 text-xs text-gray-400 gap-1.5 items-center">
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            불러오는 중
          </div>
        )}

        {!hasMore && items.length > 0 && !loading && (
          <p className="text-center text-[11px] text-gray-300 py-6">
            총 {items.length}개 표시 완료
          </p>
        )}

        <div ref={loaderRef} className="h-1" />
      </main>
    </div>
  );
}
