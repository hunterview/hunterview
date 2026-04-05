/**
 * 디너의여왕 (dinnerqueen.net) 크롤러
 * - SSR, axios + cheerio 사용
 * - URL: https://dinnerqueen.net/taste (전체 캠페인 목록)
 */

const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://dinnerqueen.net';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Referer': 'https://dinnerqueen.net/',
};

module.exports = async function crawlDinnerqueen() {
  const all = [];
  const seenIds = new Set();

  for (let page = 1; page <= 5; page++) {
    const url = page === 1 ? `${BASE_URL}/taste` : `${BASE_URL}/taste?page=${page}`;
    try {
      const { data: html } = await axios.get(url, { headers: HEADERS, timeout: 15000 });
      const items = parsePage(html);
      if (items.length === 0) break;

      let added = 0;
      for (const item of items) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          all.push(item);
          added++;
        }
      }
      if (added === 0) break;

      await sleep(600);
    } catch (err) {
      console.error(`  [디너의여왕] page ${page} 실패: ${err.message}`);
      break;
    }
  }

  return all;
};

function parsePage(html) {
  const $ = cheerio.load(html);
  const items = [];

  $('.qz-dq-card').each((_, el) => {
    try {
      const $el = $(el);

      const link = $el.find('a.qz-dq-card__link').first();
      const href = link.attr('href') || '';
      const idMatch = href.match(/\/taste\/(\d+)/);
      if (!idMatch) return;

      const cpId = idMatch[1];
      const id = `dinnerqueen_${cpId}`;
      const url = href.startsWith('http') ? href : `${BASE_URL}${href}`;

      const title = (link.attr('title') || '').replace(/\s*신청하기\s*$/, '').trim();
      if (!title || title.length < 3) return;

      const img = link.find('img');
      const thumbnail = img.attr('src') || '';

      const fullText = $el.text().replace(/\s+/g, ' ').trim();

      let dday = 30;
      const ddayMatch = fullText.match(/D-(\d+)/i);
      if (ddayMatch) dday = parseInt(ddayMatch[1]);
      else if (/오늘\s*마감/.test(fullText)) dday = 0;
      else if (/마감됨|모집\s*완료/.test(fullText)) dday = -1;

      let applied = 0, total = 0;
      const memberMatch = fullText.match(/신청\s*([\d,]+)\s*\/\s*모집\s*([\d,]+)/);
      if (memberMatch) {
        applied = parseInt(memberMatch[1].replace(/,/g, ''));
        total = parseInt(memberMatch[2].replace(/,/g, ''));
      }

      items.push({
        id,
        title,
        platform: '디너의여왕',
        dot: 'd-coral',
        url,
        thumbnail,
        type: inferTypes(title + ' ' + fullText),
        tags: inferTags(title),
        benefit: '',
        reward: '',
        rewardNum: 0,
        location: inferLocation(title, fullText),
        dday,
        applied,
        total,
        site: 'dinnerqueen.net',
        isNew: dday >= 25,
      });
    } catch (e) {
      // skip
    }
  });

  return items;
}

function inferTypes(text) {
  const types = [];
  if (/배송/.test(text)) types.push('배송');
  if (/방문|지역/.test(text)) types.push('방문');
  if (/블로그|포스팅/.test(text)) types.push('블로그');
  if (/인스타|instagram/i.test(text)) types.push('인스타');
  if (/릴스|숏폼|클립/.test(text)) types.push('숏폼');
  if (types.length === 0) types.push('블로그');
  return types;
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
  for (const [re, tag] of rules) if (re.test(title)) tags.push(tag);
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
    [/광주/, '광주'],
  ];
  for (const [re, loc] of rules) if (re.test(combined)) return loc;
  return '전국';
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
