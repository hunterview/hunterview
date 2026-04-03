/**
 * 리뷰플레이스 (reviewplace.co.kr) 크롤러
 * - SSR PHP 기반
 * - 컨테이너: a[href*="/pr/?id="] (img 포함)
 * - 제목: .it_name
 * - 마감: 전체 텍스트에서 "D - N" 파싱
 * - 신청/모집: "신청 N / N명" 파싱
 */

const axios   = require('axios');
const cheerio = require('cheerio');

const BASE_URL  = 'https://reviewplace.co.kr';
const MAX_PAGES = 5;

const HEADERS = {
  'User-Agent'     : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Referer'        : `${BASE_URL}/`,
};

module.exports = async function crawlReviewplace() {
  const all     = [];
  const seenIds = new Set();

  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const url = page === 1
        ? `${BASE_URL}/pr/`
        : `${BASE_URL}/pr/?page=${page}`;
      const { data: html } = await axios.get(url, { headers: HEADERS, timeout: 15000 });
      const items = parsePage(html);
      if (items.length === 0) break;

      let added = 0;
      for (const item of items) {
        if (!seenIds.has(item.id)) { seenIds.add(item.id); all.push(item); added++; }
      }
      if (added === 0) break;
      await sleep(700);
    } catch (err) {
      console.error(`  [리뷰플레이스] page ${page} 실패: ${err.message}`);
      break;
    }
  }

  return all;
};

function parsePage(html) {
  const $     = cheerio.load(html);
  const items = [];

  $('a[href*="/pr/?id="]').filter((_, el) => $(el).find('img').length > 0).each((_, el) => {
    try {
      const $a   = $(el);
      const href = $a.attr('href') || '';
      const idM  = href.match(/id=(\d+)/);
      if (!idM) return;

      const prId = idM[1];
      const id   = `reviewplace_${prId}`;
      const url  = `${BASE_URL}/pr/?id=${prId}`;

      // 제목
      const title = $a.find('.it_name, .pr_name, h3, h4').first().text().trim() ||
                    $a.text().split(/\n/)[0].trim().substring(0, 60);
      if (!title || title.length < 3) return;

      // 이미지
      const thumbnail = $a.find('img.thumbimg, img').first().attr('src') || '';

      // 전체 텍스트 기반 파싱
      const fullTxt = $a.text().replace(/\s+/g, ' ').trim();

      // 마감: "D - N" 또는 "상시" 또는 "마감"
      let dday = 30;
      if (/상시/.test(fullTxt))                 dday = 99;
      else if (/마감/.test(fullTxt) && !/D\s*-/.test(fullTxt)) dday = -1;
      else {
        const m = fullTxt.match(/D\s*-\s*(\d+)/);
        if (m) dday = parseInt(m[1]);
      }

      // 혜택: 제목 바로 다음 줄 (상품명 + 수량)
      const titleIdx  = fullTxt.indexOf(title);
      const afterTitle = titleIdx >= 0 ? fullTxt.slice(titleIdx + title.length).trim() : '';
      const benefitRaw = afterTitle.split(/D\s*-\s*\d+|상시|마감/)[0].trim();
      const benefit    = benefitRaw.length > 3 && benefitRaw.length < 120 ? benefitRaw : '';

      // 신청/모집: "신청 N / N명"
      const recruitM = fullTxt.match(/신청\s*([\d,]+)\s*\/\s*([\d,]+)명/);
      const applied  = recruitM ? parseInt(recruitM[1].replace(/,/g, '')) : 0;
      const total    = recruitM ? parseInt(recruitM[2].replace(/,/g, '')) : 0;

      // 타입 감지
      const typeText = $a.find('.blog_icon, .insta_icon, [class*="icon"]').map((_, e) => $(e).attr('class') || '').get().join(' ');

      items.push({
        id       : id,
        title    : cleanTitle(title),
        platform : '리뷰플레이스',
        dot      : 'd-green',
        url,
        thumbnail,
        type     : inferTypes(typeText + ' ' + title),
        tags     : inferTags(title),
        benefit,
        location : inferLocation(title, benefit),
        dday,
        applied,
        total,
        site     : 'reviewplace.co.kr',
        isNew    : dday >= 25,
      });
    } catch (e) { /* 개별 오류 무시 */ }
  });

  return items;
}

function inferTypes(text) {
  const types = [];
  if (/배송/.test(text))                 types.push('배송');
  if (/방문|지역/.test(text))            types.push('방문');
  if (/blog|블로그|스마트스토어|쇼핑몰|로켓/i.test(text)) types.push('블로그');
  if (/insta|instagram/i.test(text))     types.push('인스타');
  if (/릴스|숏폼|쇼츠|틱톡|유튜브/.test(text)) types.push('숏폼');
  if (types.length === 0)                types.push('블로그');
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
    [/네일|헤어|마사지|스파/,                   '뷰티'],
  ];
  for (const [re, tag] of rules) if (re.test(title)) tags.push(tag);
  return tags;
}

function inferLocation(title, text) {
  const combined = title + ' ' + text;
  const rules = [
    [/배송/,              '배송형'],
    [/서울/,              '서울'],
    [/부산/,              '부산'],
    [/강남|서초|송파/,    '서울 강남'],
    [/제주/,              '제주도'],
    [/수원|성남|용인|고양|화성|경기/, '경기'],
    [/인천/,              '인천'],
    [/대구/,              '대구'],
    [/대전/,              '대전'],
    [/광주/,              '광주'],
    [/울산/,              '울산'],
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
