import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

function loadData() {
  // Vercel(rootDirectory=frontend): process.cwd() = /vercel/path0 (= frontend/)
  // 로컬 개발: process.cwd() = frontend/
  const candidates = [
    path.join(process.cwd(), 'public', 'data.json'), // frontend/public/data.json (primary)
    path.join(process.cwd(), 'data.json'),            // Vercel / 로컬 (frontend/data.json)
    path.join(process.cwd(), '..', 'data.json'),      // 구 구조 fallback
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  }
  return { campaigns: [], total: 0 };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q      = searchParams.get('q')?.trim().toLowerCase() || '';
  const source = searchParams.get('source') || '';
  const limit  = Math.min(parseInt(searchParams.get('limit') || '60'), 500);
  const offset = parseInt(searchParams.get('offset') || '0');

  const data = loadData();
  let campaigns = data.campaigns || [];

  // 소스 필터
  if (source && source !== '전체') {
    campaigns = campaigns.filter(c =>
      (c.source || c.platform || '') === source
    );
  }

  // 키워드 검색
  if (q) {
    campaigns = campaigns.filter(c => {
      const text = [c.title, c.region, c.location, c.platform, c.source]
        .filter(Boolean).join(' ').toLowerCase();
      return text.includes(q);
    });
  }

  // dday 오름차순 정렬 (마감 임박 우선, 마감(-1)은 뒤로)
  campaigns.sort((a, b) => {
    const da = a.dday ?? 999;
    const db = b.dday ?? 999;
    if (da < 0 && db >= 0) return 1;
    if (db < 0 && da >= 0) return -1;
    return da - db;
  });

  const total = campaigns.length;
  const paged = campaigns.slice(offset, offset + limit);

  const normalized = paged.map(c => ({
    title  : c.title    || '',
    link   : c.link     || c.url       || '',
    image  : c.image    || c.thumbnail || '',
    region : c.region   || c.location  || '',
    source : c.source   || c.platform  || '',
    dday   : c.dday     ?? null,      // 숫자형 d-day (새 크롤러)
    deadline: c.deadline || '',        // 날짜형 (구 크롤러 호환)
  }));

  return NextResponse.json({ ok: true, total, campaigns: normalized });
}
