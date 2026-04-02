/**
 * base.js — 공통 인터페이스 정의 + 브라우저 팩토리
 *
 * 모든 크롤러는 아래 스키마를 반환해야 한다:
 * {
 *   title    : string   — 캠페인 제목
 *   link     : string   — 원본 URL (중복 제거 기준)
 *   image    : string   — 썸네일 URL
 *   region   : string   — 지역 / 배송형 / 방문형
 *   deadline : string   — "YYYY-MM-DD" | ""
 *   source   : string   — 사이트명 (예: "레뷰", "리뷰노트")
 * }
 */

const puppeteer = require('puppeteer');

// ── 브라우저 팩토리 ──────────────────────────────────────────
async function launchBrowser() {
  return puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });
}

// ── 새 페이지 공통 설정 ──────────────────────────────────────
async function newPage(browser) {
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/122.0.0.0 Safari/537.36'
  );
  await page.setViewport({ width: 1280, height: 900 });
  // 이미지·폰트 로드 차단 → 속도 향상
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const type = req.resourceType();
    if (['font', 'stylesheet', 'media'].includes(type)) {
      req.abort();
    } else {
      req.continue();
    }
  });
  return page;
}

// ── 날짜 파싱 헬퍼 ──────────────────────────────────────────
// "2026.04.30", "2026/04/30", "04월30일" → "2026-04-30"
function parseDeadline(raw) {
  if (!raw) return '';
  const now = new Date();
  const year = now.getFullYear();

  let m;
  // YYYY.MM.DD / YYYY/MM/DD / YYYY-MM-DD
  m = raw.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;

  // MM.DD / MM/DD (연도 없음)
  m = raw.match(/(\d{1,2})[./](\d{1,2})(?!\d)/);
  if (m) return `${year}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;

  // MM월DD일
  m = raw.match(/(\d{1,2})월\s*(\d{1,2})일/);
  if (m) return `${year}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;

  // D-숫자
  m = raw.match(/D-?(\d+)/i);
  if (m) {
    const d = new Date();
    d.setDate(d.getDate() + parseInt(m[1]));
    return d.toISOString().slice(0, 10);
  }

  return '';
}

// ── 빈 캠페인 템플릿 ────────────────────────────────────────
function emptyCampaign(source) {
  return { title: '', link: '', image: '', region: '', deadline: '', source };
}

module.exports = { launchBrowser, newPage, parseDeadline, emptyCampaign };
