/**
 * experienceCrawler.js — 체험단닷컴 (chehumdan.com)
 * 정적 HTML → axios + 정규식 파싱
 */

const https = require('https');
const http  = require('http');

const SOURCE   = '체험단닷컴';
const BASE_URL = 'http://chehumdan.com';
const LIST_URL = `${BASE_URL}/html_file.php?file=all_campaign.html`;

function fetchPage(url, redirectCount = 0) {
  if (redirectCount > 5) return Promise.reject(new Error('Too many redirects'));
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
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

async function getExperienceCampaigns() {
  const results = [];
  const html = await fetchPage(LIST_URL);

  // thum-box 기준으로 카드 분리
  const blocks = html.split('<div class="thum-box">');

  for (const block of blocks.slice(1)) {
    try {
      // 링크 + number 추출
      const linkMatch = block.match(/href='(detail\.php\?number=\d+[^']*)'/);
      if (!linkMatch) continue;
      const link = BASE_URL + '/' + linkMatch[1];

      // 이미지
      const imgMatch = block.match(/src="(\.\/mallimg\/[^"]+)"/);
      const image = imgMatch
        ? BASE_URL + '/' + imgMatch[1].replace(/^\.\//, '')
        : '';

      // 제목: class="list-tit"
      const titleMatch = block.match(/class="list-tit">\s*<a[^>]*>([^<]+)<\/a>/);
      const title = titleMatch ? titleMatch[1].trim() : '';
      if (!title || title.length < 2) continue;

      // 지역: list-day 내 [지역명] 패턴
      const dayBlock = block.match(/class="list-day">([\s\S]*?)<\/p>/);
      const dayText  = dayBlock
        ? dayBlock[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        : '';

      const regionMatch = dayText.match(/\[([^\]]+)\]/);
      const region = regionMatch ? regionMatch[1] : '정보없음';

      // 마감일: "상시모집" 이면 빈 문자열, 날짜 패턴 있으면 파싱
      const deadlineMatch = dayText.match(/(\d{4}[./-]\d{1,2}[./-]\d{1,2})/);
      let deadline = '';
      if (deadlineMatch) {
        deadline = deadlineMatch[1].replace(/[./]/g, '-');
      }

      results.push({ title, link, image, region, deadline, source: SOURCE });
    } catch (_) {
      continue;
    }
  }

  return results;
}

module.exports = getExperienceCampaigns;
