/**
 * mainCrawler.js — 오케스트레이터
 *
 * 새 크롤러 추가 방법:
 *   1. crawlers/ 폴더에 xxxCrawler.js 생성 (base.js 스키마 준수)
 *   2. 아래 CRAWLERS 배열에 { name, fn } 추가 — 끝.
 */

const { upsertCampaigns, getStats } = require('./db');

// ── 크롤러 등록 ──────────────────────────────────────────────
const CRAWLERS = [
  { name: '리뷰노트',  fn: require('./crawlers/reviewnoteCrawler') },
  { name: '아싸뷰',   fn: require('./crawlers/assaviewCrawler')   },
  { name: '체험단닷컴', fn: require('./crawlers/experienceCrawler') },
  // { name: '레뷰',   fn: require('./crawlers/revuCrawler') },  // API 인증 필요 — 비활성화
];
// ─────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  console.log('━'.repeat(50));
  console.log('🎯 헌터뷰 크롤러 시작');
  console.log(`⏰ ${new Date().toLocaleString('ko-KR')}`);
  console.log('━'.repeat(50));

  // 병렬 실행: 하나 실패해도 나머지는 계속
  const settled = await Promise.allSettled(
    CRAWLERS.map(({ name, fn }) => runCrawler(name, fn))
  );

  // 결과 수집
  const allItems = [];
  for (let i = 0; i < settled.length; i++) {
    const { name } = CRAWLERS[i];
    const result = settled[i];
    if (result.status === 'fulfilled') {
      console.log(`  ✅ [${name}] ${result.value.length}개`);
      allItems.push(...result.value);
    } else {
      console.error(`  ❌ [${name}] 실패: ${result.reason?.message}`);
    }
  }

  // link 기준 중복 제거 (먼저 수집된 것 우선)
  const seen = new Set();
  const unique = allItems.filter(item => {
    if (!item.link || seen.has(item.link)) return false;
    seen.add(item.link);
    return true;
  });

  console.log(`\n📦 중복 제거 후: ${unique.length}개 (원본: ${allItems.length}개)`);

  // DB 저장
  const { inserted, updated } = upsertCampaigns(unique);
  const stats = getStats();

  console.log(`💾 DB 저장: +${inserted}개 신규, ${updated}개 갱신`);
  console.log(`📊 DB 누적: 총 ${stats.total}개`);
  stats.sources.forEach(s => console.log(`   - ${s.source}: ${s.n}개`));
  console.log(`⏱  소요 시간: ${((Date.now() - startTime) / 1000).toFixed(1)}초`);
  console.log('━'.repeat(50));
}

async function runCrawler(name, fn) {
  try {
    const items = await fn();
    // 필수 필드 검증
    return items.filter(item => item.title && item.link);
  } catch (err) {
    // 스택 로그 (디버깅용)
    console.error(`[${name}] 상세 오류:`, err.stack || err.message);
    throw err;
  }
}

main().catch(err => {
  console.error('치명적 오류:', err);
  process.exit(1);
});
