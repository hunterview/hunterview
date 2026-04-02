/**
 * revuCrawler.js — 레뷰 (revu.net)
 * AngularJS SPA → puppeteer로 렌더링 후 수집
 * 비로그인 공개 캠페인만 대상
 */

const { launchBrowser, newPage } = require('./base');

const SOURCE   = '레뷰';
const LIST_URL = 'https://www.revu.net/campaign/list';

async function crawl() {
  const browser = await launchBrowser();
  const results = [];

  try {
    const page = await newPage(browser);

    // Angular SPA: domcontentloaded 후 직접 대기 (networkidle0은 타임아웃 위험)
    await page.goto(LIST_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Angular 렌더링 완료 대기 (실제 캠페인 카드가 나타날 때까지)
    // 여러 가능한 셀렉터 중 하나라도 나타나면 계속
    await Promise.race([
      page.waitForSelector('ul.campaign-list li',          { timeout: 20000 }),
      page.waitForSelector('.campaign-item',               { timeout: 20000 }),
      page.waitForSelector('[class*="campaign-card"]',     { timeout: 20000 }),
      page.waitForSelector('a[href*="/campaign/detail"]',  { timeout: 20000 }),
      page.waitForSelector('a[href*="/campaign/view"]',    { timeout: 20000 }),
      new Promise(r => setTimeout(r, 20000)), // 최대 20초 후 그냥 진행
    ]);

    // 추가 렌더링 대기
    await new Promise(r => setTimeout(r, 3000));

    // 스크롤로 lazy-load 트리거
    await autoScroll(page);

    // 실제 렌더링된 HTML 덤프 후 분석
    const rendered = await page.evaluate(() => document.documentElement.innerHTML);

    // 링크 패턴으로 캠페인 추출
    const campaignLinks = [...new Set(
      [...rendered.matchAll(/href="(\/campaign\/(?:detail|view)\/[^"]+)"/g)]
        .map(m => m[1])
    )];

    if (campaignLinks.length === 0) {
      // 대안: 모든 내부 링크 중 campaign 포함
      const allLinks = [...new Set(
        [...rendered.matchAll(/href="(\/[^"]*campaign[^"]+)"/g)]
          .map(m => m[1])
          .filter(l => !l.includes('list') && !l.includes('register'))
      )];

      for (const href of allLinks.slice(0, 50)) {
        const link = `https://www.revu.net${href}`;
        results.push({
          title: href.split('/').pop() || '레뷰 캠페인',
          link,
          image: '',
          region: '정보없음',
          deadline: '',
          source: SOURCE,
        });
      }
    } else {
      // 각 링크에서 카드 정보 추출
      const items = await page.evaluate((links) => {
        return links.map(href => {
          const anchor = document.querySelector(`a[href="${href}"]`);
          if (!anchor) return null;
          const card = anchor.closest('li') || anchor.closest('[class*="item"]') || anchor.parentElement;
          const title = card?.querySelector('[class*="title"], h3, h4, strong')?.textContent?.trim() || '';
          const imgEl = card?.querySelector('img');
          const image = imgEl?.src || imgEl?.dataset?.src || '';
          const texts = card?.textContent || '';
          return { href, title, image, texts };
        }).filter(Boolean);
      }, campaignLinks);

      for (const item of items) {
        if (!item.title) continue;
        results.push({
          title: item.title,
          link: `https://www.revu.net${item.href}`,
          image: item.image,
          region: item.texts.includes('배송') ? '배송형' : item.texts.includes('방문') ? '방문형' : '정보없음',
          deadline: '',
          source: SOURCE,
        });
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 800;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 300);
      setTimeout(() => { clearInterval(timer); resolve(); }, 10000);
    });
  });
  await new Promise(r => setTimeout(r, 1500));
}

module.exports = crawl;
