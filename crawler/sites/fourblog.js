/**
 * 포블로그 (4blog.net) 크롤러
 * - Puppeteer 사용 (SPA/AJAX 기반)
 * - URL: https://4blog.net
 * - 주요 selector: a.nounderline, span.camp-name, span.remainDate
 */

const puppeteer = require('puppeteer');

const BASE_URL = 'https://4blog.net';
const SCROLL_ROUNDS = 5; // 스크롤 횟수 (약 30개 × 5 = 150개 목표)

module.exports = async function crawlFourblog() {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1280, height: 900 });

    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    // 캠페인 카드 로딩 대기
    await page.waitForSelector('a.nounderline', { timeout: 15000 }).catch(() => {});

    // 스크롤해서 더 많은 캠페인 로드
    for (let i = 0; i < SCROLL_ROUNDS; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
      await sleep(1200);
    }

    const items = await page.evaluate((baseUrl) => {
      const results = [];
      const seen    = new Set();

      document.querySelectorAll('a.nounderline[href^="/campaign/"]').forEach(el => {
        const href    = el.getAttribute('href') || '';
        const idMatch = href.match(/\/campaign\/(\d+)/);
        if (!idMatch) return;

        const cpId = idMatch[1];
        const id   = `fourblog_${cpId}`;
        if (seen.has(id)) return;
        seen.add(id);

        const url = `${baseUrl}${href}`;

        // 이미지
        const img       = el.querySelector('img.img-rounded, img.main-img-inbox, img');
        const thumbnail = img ? (img.src || img.dataset.src || '') : '';

        // 제목: span.camp-name
        const titleEl = el.querySelector('span.camp-name');
        let title     = titleEl ? titleEl.textContent.trim() : '';
        if (!title) {
          // 대안: 첫 번째 의미있는 텍스트
          const spans = el.querySelectorAll('span');
          for (const s of spans) {
            const t = s.textContent.trim();
            if (t.length > 5 && !/^D-/.test(t) && !/^\d+$/.test(t)) { title = t; break; }
          }
        }
        if (!title || title.length < 3) return;

        // 마감: span.remainDate → "D-7", "D-0", "마감", "D-"
        const ddayEl  = el.querySelector('span.remainDate, .remainDate');
        const ddayTxt = ddayEl ? ddayEl.textContent.trim() : '';
        let dday = 30;
        if (/마감/.test(ddayTxt))          dday = -1;
        else if (/D-0/.test(ddayTxt))      dday = 0;
        else {
          const m = ddayTxt.match(/D-(\d+)/);
          if (m) dday = parseInt(m[1]);
        }

        const fullText = el.textContent.replace(/\s+/g, ' ').trim();

        results.push({ id, title, url, thumbnail, dday, fullText });
      });

      return results;
    }, BASE_URL);

    return items.map(item => ({
      id       : item.id,
      title    : cleanTitle(item.title),
      platform : '포블로그',
      dot      : 'd-purple',
      url      : item.url,
      thumbnail: item.thumbnail,
      type     : inferTypes(item.title + ' ' + item.fullText),
      tags     : inferTags(item.title),
      reward   : '',
      rewardNum: 0,
      location : inferLocation(item.title, item.fullText),
      dday     : item.dday,
      applied  : 0,
      total    : 0,
      site     : '4blog.net',
      isNew    : item.dday >= 25,
    }));

  } catch (err) {
    throw new Error(`포블로그 크롤링 실패: ${err.message}`);
  } finally {
    if (browser) await browser.close();
  }
};

function inferTypes(text) {
  const types = [];
  if (/배송/.test(text))              types.push('배송');
  if (/방문|지역/.test(text))         types.push('방문');
  if (/블로그|포스팅/.test(text))     types.push('블로그');
  if (/인스타|instagram/i.test(text)) types.push('인스타');
  if (/릴스|숏폼|틱톡|유튜브|쇼츠/.test(text)) types.push('숏폼');
  if (types.length === 0)             types.push('블로그');
  return [...new Set(types)];
}

function inferTags(title) {
  const tags  = [];
  const rules = [
    [/이유식|아기|유아|육아/,                    '육아'],
    [/맛집|레스토랑|카페|식당|음식|요리|브런치/, '맛집'],
    [/뷰티|스킨케어|화장품|세럼|크림|마스크팩/, '뷰티'],
    [/숙박|호텔|풀빌라|펜션|리조트/,            '숙박'],
    [/여행|관광|투어/,                           '여행'],
    [/반려|강아지|고양이|펫/,                   '반려동물'],
    [/식품|간식|음료|커피|과일|채소|쌀|김치/,   '식품'],
    [/패션|의류|옷|신발|가방|악세서리/,         '패션'],
    [/운동|헬스|필라테스|요가|스포츠/,          '운동'],
    [/인테리어|가구|생활용품/,                  '생활'],
    [/네일|헤어|마사지|스파|피부관리/,          '뷰티'],
  ];
  for (const [re, tag] of rules) if (re.test(title)) tags.push(tag);
  return tags;
}

function inferLocation(title, text) {
  const combined = title + ' ' + text;
  const rules    = [
    [/배송/,              '배송형'],
    [/서울/,              '서울'],
    [/부산/,              '부산'],
    [/강남|서초|송파/,    '서울 강남'],
    [/홍대|마포|합정/,    '서울 마포'],
    [/제주/,              '제주도'],
    [/경기|판교|수원|성남/, '경기'],
    [/인천/,              '인천'],
    [/대구/,              '대구'],
    [/대전/,              '대전'],
  ];
  for (const [re, loc] of rules) if (re.test(combined)) return loc;
  return '전국';
}

function cleanTitle(title) {
  return title.replace(/\s+/g, ' ').replace(/^[\s\-·|]+|[\s\-·|]+$/g, '').trim();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
