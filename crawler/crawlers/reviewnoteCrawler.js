/**
 * reviewnoteCrawler.js — 리뷰노트 (reviewnote.co.kr)
 * SSR 페이지라 puppeteer 불필요 → fetch로 처리
 */

const https = require('https');
const { parseDeadline } = require('./base');

const SOURCE   = '리뷰노트';
const BASE_URL = 'https://reviewnote.co.kr';
const LIST_URL = `${BASE_URL}/campaigns`;

function fetchPage(url, redirectCount = 0) {
  if (redirectCount > 5) return Promise.reject(new Error('Too many redirects'));
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : require('http');
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Accept-Encoding': 'identity',
      }
    };
    mod.get(url, options, (res) => {
      // 리다이렉트 처리
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        resolve(fetchPage(next, redirectCount + 1));
        return;
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

  // 카드 블록 분리: class="relative pl-[2.5px]"> 기준
  const blocks = html.split('class="relative pl-[2.5px]">');

  for (const block of blocks.slice(1)) {
    try {
      // 링크
      const linkMatch = block.match(/href="(\/campaigns\/(\d+))"/);
      if (!linkMatch) continue;
      const link = BASE_URL + linkMatch[1];

      // 이미지: _next/image?url=ENCODED_URL
      const imgMatch = block.match(/url=(https?[^&"'\s]+)/);
      const image = imgMatch ? decodeURIComponent(imgMatch[1]) : '';

      // 텍스트 추출 (태그 제거)
      const clean = block
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // 마감일: "N 일 남음"
      const ddayMatch = clean.match(/(\d+)\s*일\s*남음/);
      let deadline = '';
      if (ddayMatch) {
        const d = new Date();
        d.setDate(d.getDate() + parseInt(ddayMatch[1]));
        deadline = d.toISOString().slice(0, 10);
      }

      // 지역/유형: 배송형 | 방문형 | 구매형
      const regionMatch = clean.match(/(배송형|방문형|구매형)/);
      const region = regionMatch ? regionMatch[1] : '정보없음';

      // 제목 추출: 유형 키워드 이후 텍스트
      // 구조: "N 일 남음 신청 X / Y 배송형 [제목] [제목반복]..."
      let title = '';
      if (regionMatch) {
        const afterRegion = clean.slice(clean.indexOf(regionMatch[1]) + regionMatch[1].length).trim();
        // 제목이 두 번 반복됨 → 앞 절반만 사용
        const half = Math.ceil(afterRegion.length / 2);
        let candidate = afterRegion.slice(0, half).trim();
        // 네비게이션 텍스트 제거: '체험단 검색' 이후 내용 잘라냄
        const cutAt = candidate.search(/체험단 검색|커뮤니티|공지|이용약관|고객센터/);
        if (cutAt > 0) candidate = candidate.slice(0, cutAt).trim();
        title = candidate.replace(/\s+$/, '').trim();
        if (title.length > 100) title = title.slice(0, 100);
      }

      if (!title || title.length < 3) continue;

      results.push({
        title,
        link,
        image,
        region,
        deadline,
        source: SOURCE,
      });
    } catch (_) {
      continue;
    }
  }

  return results;
}

module.exports = crawl;
