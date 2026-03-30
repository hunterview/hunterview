/**
 * 디너의여왕 (dinnerqueen.net) 크롤러
 * - Playwright 사용 (AJAX 렌더링)
 */

const { chromium } = require('playwright');

const BASE_URL = 'https://dinnerqueen.net';
const LIST_URL = `${BASE_URL}/campaign/list`;

module.exports = async function crawlDinnerqueen() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    locale: 'ko-KR',
  });
  const page = await context.newPage();

  try {
    await page.goto(LIST_URL, { waitUntil: 'networkidle', timeout: 30000 });

    // 캠페인 카드가 로드될 때까지 대기
    await page.waitForSelector('a[href*="/campaign/"]', { timeout: 15000 }).catch(() => {});

    const items = await page.evaluate((baseUrl) => {
      const results = [];
      const seen = new Set();

      // 캠페인 링크가 있는 모든 앵커 순회
      document.querySelectorAll('a[href*="/campaign/"]').forEach(el => {
        const href = el.getAttribute('href') || '';
        // /campaign/list 자신 또는 /campaign/123 같은 숫자 ID만
        const idMatch = href.match(/\/campaign\/(\d+)/);
        if (!idMatch) return;

        const cpId = idMatch[1];
        const id = `dinnerqueen_${cpId}`;
        if (seen.has(id)) return;
        seen.add(id);

        const url = href.startsWith('http') ? href : `${baseUrl}${href}`;

        // 이미지
        const img = el.querySelector('img');
        const thumbnail = img ? (img.src || img.dataset.src || '') : '';

        // 제목
        const titleEl = el.querySelector('h3, h4, .title, .name, [class*="title"], [class*="name"]');
        let title = titleEl ? titleEl.textContent.trim() : '';
        if (!title) {
          title = img ? (img.alt || '') : '';
        }
        if (!title || title.length < 3) return;

        // 전체 텍스트
        const fullText = el.textContent.replace(/\s+/g, ' ').trim();

        // 마감일
        let dday = 30;
        const ddayMatch = fullText.match(/D-(\d+)|(\d+)일\s*남/);
        if (ddayMatch) dday = parseInt(ddayMatch[1] || ddayMatch[2]);

        // 인원
        let applied = 0, total = 0;
        const memberMatch = fullText.match(/(\d+)\s*\/\s*(\d+)/);
        if (memberMatch) { applied = parseInt(memberMatch[1]); total = parseInt(memberMatch[2]); }

        results.push({ id, title, url, thumbnail, fullText, dday, applied, total });
      });

      return results;
    }, BASE_URL);

    return items.map(item => ({
      ...item,
      platform: '디너의여왕',
      dot: 'd-coral',
      type: inferTypes(item.title + ' ' + item.fullText),
      tags: inferTags(item.title),
      reward: extractReward(item.fullText),
      rewardNum: 0,
      location: inferLocation(item.title, item.fullText),
      site: 'dinnerqueen.net',
      isNew: item.dday >= 25,
      fullText: undefined,
    }));

  } catch (err) {
    throw new Error(`디너의여왕 크롤링 실패: ${err.message}`);
  } finally {
    await browser.close();
  }
};

function inferTypes(text) {
  const types = [];
  if (/배송/.test(text)) types.push('배송');
  if (/방문|지역/.test(text)) types.push('방문');
  if (/블로그|포스팅/.test(text)) types.push('블로그');
  if (/인스타|instagram/i.test(text)) types.push('인스타');
  if (/릴스|숏폼/.test(text)) types.push('숏폼');
  if (types.length === 0) types.push('블로그');
  return [...new Set(types)];
}

function inferTags(title) {
  const tags = [];
  const rules = [
    [/이유식|아기|유아|육아/, '육아'],
    [/맛집|레스토랑|카페|식당|음식|요리|브런치|오마카세/, '맛집'],
    [/뷰티|스킨케어|화장품|세럼|크림/, '뷰티'],
    [/숙박|호텔|풀빌라|펜션|리조트/, '숙박'],
    [/여행|관광/, '여행'],
    [/반려|강아지|고양이/, '반려동물'],
    [/식품|간식|음료|커피|과일/, '식품'],
    [/패션|의류|옷|신발/, '패션'],
  ];
  for (const [re, tag] of rules) {
    if (re.test(title)) tags.push(tag);
  }
  return tags;
}

function inferLocation(title, text) {
  const combined = title + ' ' + text;
  const rules = [
    [/배송/, '배송형'],
    [/서울/, '서울'],
    [/부산/, '부산'],
    [/강남|서초|송파/, '서울 강남'],
    [/홍대|마포/, '서울 마포'],
    [/제주/, '제주도'],
    [/경기|판교|수원/, '경기'],
    [/인천/, '인천'],
    [/대구/, '대구'],
    [/대전/, '대전'],
  ];
  for (const [re, loc] of rules) {
    if (re.test(combined)) return loc;
  }
  return '전국';
}

function extractReward(text) {
  const m = text.match(/(\d+(?:\.\d+)?)\s*만원/);
  if (m) return `${m[1]}만원 상당`;
  if (/무료|제공/.test(text)) return '무료 제공';
  return '';
}
