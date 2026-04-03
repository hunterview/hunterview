/**
 * 핌블 (pimble.co.kr) 크롤러
 * - SSR + axios + cheerio
 * - URL: https://pimble.co.kr
 * - selector: a[href^="campaign.php?cp_id="], span.it_name, img.it_img, span.dday
 */

const axios   = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://pimble.co.kr';
const PAGES    = [
  `${BASE_URL}/index.php`,
  `${BASE_URL}/index.php?page=2`,
  `${BASE_URL}/index.php?page=3`,
];

const HEADERS = {
  'User-Agent'     : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Referer'        : `${BASE_URL}/`,
};

module.exports = async function crawlPimble() {
  const all     = [];
  const seenIds = new Set();

  for (const url of PAGES) {
    try {
      const { data: html } = await axios.get(url, { headers: HEADERS, timeout: 15000 });
      const items = parsePage(html);
      if (items.length === 0) break;

      for (const item of items) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          all.push(item);
        }
      }
      await sleep(700);
    } catch (err) {
      console.error(`  [핌블] ${url} 실패: ${err.message}`);
    }
  }

  return all;
};

function parsePage(html) {
  const $     = cheerio.load(html);
  const items = [];

  // 캠페인 카드 단위: div.box (이미지 링크 + 정보 링크가 형제 구조)
  $('div.box').each((_, el) => {
    try {
      const $box  = $(el);
      const $a    = $box.find('a[href*="campaign.php?cp_id="]').first();
      const href  = $a.attr('href') || '';
      const match = href.match(/cp_id=(\d+)/);
      if (!match) return;

      const cpId = match[1];
      const id   = `pimble_${cpId}`;
      const url  = `${BASE_URL}/campaign.php?cp_id=${cpId}`;

      const title = $box.find('span.it_name').text().trim();
      if (!title || title.length < 3) return;

      // 이미지는 div.thumb > a > img 구조
      let thumbnail = $box.find('div.thumb img.it_img, img.it_img').attr('src') || '';
      if (thumbnail && !thumbnail.startsWith('http')) {
        thumbnail = `${BASE_URL}/${thumbnail.replace(/^\.\//, '')}`;
      }

      // 마감: span.dday → "D-Day 60", "상시모집", "모집마감"
      const ddayTxt = $box.find('span.dday').text().trim();
      let dday = 30;
      if (/상시/.test(ddayTxt))           dday = 99;
      else if (/마감/.test(ddayTxt))      dday = -1;
      else if (/D-Day\s*0/i.test(ddayTxt)) dday = 0;
      else {
        const m = ddayTxt.match(/D-Day\s*(\d+)/i);
        if (m) dday = parseInt(m[1]);
      }

      // 타입 배지: .blog, .insta, .naver, .coupang 등
      const typeText = $box.find('div.top_info span').map((_, e) => $(e).text()).get().join(' ');
      const descText = $box.find('span.it_description').text();
      const loc      = inferLocation(title, descText);

      items.push({
        id       : id,
        title    : cleanTitle(title),
        platform : '핌블',
        dot      : 'd-pink',
        url,
        thumbnail,
        type     : inferTypes(typeText + ' ' + title),
        tags     : inferTags(title),
        reward   : '',
        rewardNum: 0,
        location : loc,
        dday,
        applied  : 0,
        total    : 0,
        site     : 'pimble.co.kr',
        isNew    : dday >= 25,
      });
    } catch (e) { /* 개별 아이템 오류 무시 */ }
  });

  return items;
}

function inferTypes(text) {
  const types = [];
  if (/배송/.test(text))              types.push('배송');
  if (/방문|지역/.test(text))         types.push('방문');
  if (/블로그|포스팅|blog/i.test(text)) types.push('블로그');
  if (/인스타|instagram/i.test(text)) types.push('인스타');
  if (/릴스|숏폼|쇼츠|틱톡|유튜브/.test(text)) types.push('숏폼');
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
    [/패션|의류|옷|신발|가방/,                  '패션'],
    [/운동|헬스|필라테스|요가|스포츠/,          '운동'],
    [/인테리어|가구|생활용품/,                  '생활'],
    [/네일|헤어|마사지|스파|샴푸/,              '뷰티'],
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
    [/광주/,              '광주'],
  ];
  for (const [re, loc] of rules) if (re.test(combined)) return loc;
  return '전국';
}

function cleanTitle(title) {
  return title.replace(/\[포토\]\s*/g, '').replace(/\s+/g, ' ').replace(/^[\s\-·|]+|[\s\-·|]+$/g, '').trim();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
