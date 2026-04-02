import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

function loadData() {
  // data.json 위치: 레포 루트 (frontend의 상위 디렉토리)
  const candidates = [
    path.join(process.cwd(), '..', 'data.json'),  // 로컬 개발
    path.join(process.cwd(), 'data.json'),         // Vercel 빌드
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  }
  return { campaigns: [], total: 0, updated_at: '' };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q      = searchParams.get('q')?.trim().toLowerCase() || '';
  const source = searchParams.get('source') || '';
  const limit  = Math.min(parseInt(searchParams.get('limit') || '200'), 500);
  const offset = parseInt(searchParams.get('offset') || '0');

  const data = loadData();
  let campaigns = data.campaigns || [];

  // 소스 필터
  if (source && source !== '전체') {
    campaigns = campaigns.filter(c => c.source === source || c.platform === source);
  }

  // 키워드 검색
  if (q) {
    campaigns = campaigns.filter(c => {
      const text = [c.title, c.region, c.location, c.platform, c.source]
        .filter(Boolean).join(' ').toLowerCase();
      return text.includes(q);
    });
  }

  // 마감일 정렬
  campaigns.sort((a, b) => {
    const da = a.deadline || a.updated_at || '';
    const db = b.deadline || b.updated_at || '';
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da.localeCompare(db);
  });

  const total = campaigns.length;
  const paged = campaigns.slice(offset, offset + limit);

  // 필드 정규화 (crawler.py 필드 → 프론트 필드)
  const normalized = paged.map(c => ({
    title    : c.title || '',
    link     : c.link || c.url || '',
    image    : c.image || c.thumbnail || '',
    region   : c.region || c.location || '정보없음',
    deadline : c.deadline || '',
    source   : c.source || c.platform || '',
  }));

  return NextResponse.json({ ok: true, total, campaigns: normalized });
}
