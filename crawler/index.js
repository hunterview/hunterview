const fs = require('fs');
const path = require('path');

const crawlTble          = require('./sites/tble');
const crawlPavlovu       = require('./sites/pavlovu');
const crawlDinnerqueen   = require('./sites/dinnerqueen');
const crawlMrblog        = require('./sites/mrblog');
const crawlModootogether = require('./sites/modootogether');
const crawlFourblog      = require('./sites/fourblog');
const crawlPimble        = require('./sites/pimble');
const crawlBloglab       = require('./sites/bloglab');
const crawlGangnam       = require('./sites/gangnam');
const crawlDailyview     = require('./sites/dailyview');
const crawlCometoplay    = require('./sites/cometoplay');
const crawlRingble       = require('./sites/ringble');
const crawlReviewplace   = require('./sites/reviewplace');
const crawlPopomon       = require('./sites/popomon');
const crawlSeoulouba     = require('./sites/seoulouba');
const crawlGaboja        = require('./sites/gaboja');
const crawlStylec        = require('./sites/stylec');

// public/data.json → Vercel 정적 파일로 /data.json 서빙 + API routes도 여기서 읽음
const OUTPUT_PATH = path.join(__dirname, '..', 'frontend', 'public', 'data.json');

async function main() {
  console.log('🔍 헌터뷰 크롤러 시작...\n');

  const results = await Promise.allSettled([
    runCrawler('티블',          crawlTble),
    runCrawler('파블로',        crawlPavlovu),
    runCrawler('디너의여왕',    crawlDinnerqueen),
    runCrawler('미블',          crawlMrblog),
    runCrawler('모두모여체험단', crawlModootogether),
    runCrawler('포블로그',      crawlFourblog),
    runCrawler('핌블',          crawlPimble),
    runCrawler('블로그랩',      crawlBloglab),
    runCrawler('강남맛집체험단', crawlGangnam),
    runCrawler('데일리뷰',      crawlDailyview),
    runCrawler('놀러와체험단',  crawlCometoplay),
    runCrawler('링블',          crawlRingble),
    runCrawler('리뷰플레이스',  crawlReviewplace),
    runCrawler('포포몬',        crawlPopomon),
    runCrawler('서울오빠',      crawlSeoulouba),
    runCrawler('가보자',        crawlGaboja),
    runCrawler('스타일씨',      crawlStylec),
  ]);

  const allCampaigns = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      allCampaigns.push(...r.value);
    }
  }

  // 중복 제거 (id 기준)
  const seen = new Set();
  const unique = allCampaigns.filter(c => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  // 마감일 기준 정렬
  unique.sort((a, b) => {
    const da = a.dday ?? 999;
    const db = b.dday ?? 999;
    return da - db;
  });

  const output = {
    updated: new Date().toISOString(),
    total: unique.length,
    campaigns: unique,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log(`\n✅ 완료! 총 ${unique.length}개 캠페인 저장 → data.json`);
  console.log(`   업데이트: ${output.updated}`);
}

async function runCrawler(name, fn) {
  try {
    console.log(`▶ [${name}] 크롤링 중...`);
    const items = await fn();
    console.log(`  ✓ [${name}] ${items.length}개 수집`);
    return items;
  } catch (err) {
    console.error(`  ✗ [${name}] 실패: ${err.message}`);
    return [];
  }
}

main().catch(err => {
  console.error('크롤러 오류:', err);
  process.exit(1);
});
