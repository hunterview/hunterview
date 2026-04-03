import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

function loadData() {
  const candidates = [
    path.join(process.cwd(), 'public', 'data.json'), // frontend/public/data.json (primary)
    path.join(process.cwd(), 'data.json'),
    path.join(process.cwd(), '..', 'data.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  }
  return { campaigns: [], total: 0 };
}

export async function GET() {
  const data      = loadData();
  const campaigns = data.campaigns || [];

  const sourceMap = {};
  campaigns.forEach(c => {
    const s = c.source || c.platform || '기타';
    sourceMap[s] = (sourceMap[s] || 0) + 1;
  });

  return NextResponse.json({
    ok        : true,
    total     : campaigns.length,
    sources   : Object.entries(sourceMap)
                  .sort((a, b) => b[1] - a[1])
                  .map(([source, n]) => ({ source, n })),
    updated_at: data.updated_at || data.updated || '',
  });
}
