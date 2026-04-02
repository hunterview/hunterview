/**
 * server.js — Express API
 *
 * GET /campaigns
 *   ?q=검색어       — 제목/지역 검색
 *   ?source=레뷰    — 사이트 필터
 *   ?region=서울    — 지역 필터
 *   ?limit=50       — 최대 반환 수 (default 200)
 *   ?offset=0       — 페이지 오프셋
 *
 * GET /campaigns/stats
 *   — 사이트별 건수 + 전체 합계
 */

const express = require('express');
const { getCampaigns, getStats } = require('./db');

const app  = express();
const PORT = process.env.PORT || 4000;

// CORS (프론트엔드 연동용)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// ── GET /campaigns ───────────────────────────────────────────
app.get('/campaigns', (req, res) => {
  try {
    const { q, source, region, limit, offset } = req.query;
    const data = getCampaigns({
      q,
      source,
      region,
      limit  : limit  ? Math.min(parseInt(limit),  500) : 200,
      offset : offset ? parseInt(offset) : 0,
    });
    res.json({ ok: true, total: data.length, campaigns: data });
  } catch (err) {
    console.error('GET /campaigns 오류:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /campaigns/stats ─────────────────────────────────────
app.get('/campaigns/stats', (req, res) => {
  try {
    res.json({ ok: true, ...getStats() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── 404 ──────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Not Found' });
});

app.listen(PORT, () => {
  console.log(`🚀 헌터뷰 API 서버 실행 중: http://localhost:${PORT}`);
  console.log(`   GET /campaigns`);
  console.log(`   GET /campaigns/stats`);
});
