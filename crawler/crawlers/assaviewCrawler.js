/**
 * assaviewCrawler.js — 아싸뷰 (assaview.co.kr)
 * SSR 페이지 → fetch로 HTML 파싱
 * 대상: https://assaview.co.kr/campaign_list.php
 */

const https = require('https');
const { parseDeadline } = require('./base');

const SOURCE   = '아싸뷰';
const BASE_URL = 'https://assaview.co.kr';
const LIST_URL = `${BASE_URL}/campaign_list.php`;

function fetchPage(url, redirectCount = 0) {
  if (redirectCount > 5) return Promise.reject(new Error('Too many redirects'));
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : require('http');
    mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html',
        'Accept-Encoding': 'identity',
      }
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        return resolve(fetchPage(next, redirectCount + 1));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function crawl() {
  const results = [];
  const html = await fetchPage(LIST_URL);

  // <li data-cp-id="숫자"> 기준으로 카드 분리
  const blocks = html.split(/<li data-cp-id="(\d+)"/);

  // blocks 구조: [앞부분, cp_id1, 카드내용1, cp_id2, 카드내용2, ...]
  for (let i = 1; i < blocks.length - 1; i += 2) {
    const cpId   = blocks[i];
    const content = blocks[i + 1];

    try {
      // 링크
      const link = `${BASE_URL}/campaign.php?cp_id=${cpId}`;

      // 이미지
      const imgMatch = content.match(/src="(\.\/data\/campaign\/thumb\/[^"]+)"/);
      const image = imgMatch
        ? BASE_URL + '/' + imgMatch[1].replace(/^\.\//, '')
        : '';

      // 마감일: imgBox class 속성 또는 data-countdown 안에 포함
      const dateMatch = content.match(/(\d{4}\/\d{2}\/\d{2})/);
      const deadline = dateMatch ? dateMatch[1].replace(/\//g, '-') : '';

      // 지역/유형: class="방문형 desc " 또는 <span>배송형</span>
      const regionMatch = content.match(/class="(방문형|배송형|구매형)\s/);
      const spanMatch   = content.match(/<span>(방문형|배송형|구매형)<\/span>/);
      const region = (regionMatch || spanMatch) ? (regionMatch || spanMatch)[1] : '정보없음';

      // 제목: class="subject" 내부
      const titleMatch = content.match(/class="subject"[^>]*>\s*([\s\S]*?)\s*<\/div>/);
      const title = titleMatch
        ? titleMatch[1].replace(/\s+/g, ' ').trim()
        : '';

      if (!title || title.length < 3) continue;

      results.push({ title, link, image, region, deadline, source: SOURCE });
    } catch (_) {
      continue;
    }
  }

  return results;
}

module.exports = crawl;
