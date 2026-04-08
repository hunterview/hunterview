/**
 * 가보자 체험단 (xn--o39a04kpnjo4k9hgflp.com / 가보자체험단.com) 크롤러
 * - AJAX POST: /main/ajax/_ajax.cmpSubList.php
 * - 무한스크롤 방식: page=0, 1, 2... (page당 20개)
 */

const axios   = require('axios');
const cheerio = require('cheerio');

const BASE_URL  = 'https://www.xn--o39a04kpnjo4k9hgflp.com';
const AJAX_URL  = `${BASE_URL}/main/ajax/_ajax.cmpSubList.php`;
const MAX_PAGES = 50;

const HEADERS = {
  'User-Agent'      : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language' : 'ko-KR,ko;q=0.9',
  'Content-Type'    : 'application/x-www-form-urlencoded; charset=UTF-8',
  'X-Requested-With': 'XMLHttpRequest',
  'Referer'         : `${BASE_URL}/cmp/`,
};

module.exports = async function crawlGaboja() {
  const all     = [];
  const seenIds = new Set();

  for (let page = 0; page < MAX_PAGES; page++) {
    try {
      const body = `ct1=&ct2=&channel=&sst=&stx=&page=${page}&list=20&lc=&st=&sf=&empty=0`;
      const { data: html } = await axios.post(AJAX_URL, body, { headers: HEADERS, timeout: 15000 });

      // 빈 응답이면 중단
      if (!html || html.trim().length < 50) break;

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

      // 80% 이상 마감이면 중단
      const closedCount = items.filter(i => i.dday < 0).length;
      if (items.length > 0 && closedCount / items.length > 0.8) break;

      await sleep(500);
    } catch (err) {
      console.error(`  [가보자] page ${page} 실패: ${err.message}`);
      break;
    }
  }

  return all;
};

function parsePage(html) {
  const $     = cheerio.load(html);
  const items = [];

  $('li.list_item').each((_, el) => {
    try {
      const $li = $(el);

      // 링크 & ID
      const $link = $li.find('a.list_link').first();
      if (!$link.length) return;

      const href = $link.attr('href') || '';
      const idMatch = href.match(/[?&]id=(\d+)/);
      if (!idMatch) return;

      const cid = idMatch[1];
      const id  = `gaboja_${cid}`;
      const url = href.startsWith('http') ? href : `${BASE_URL}${href}`;

      // 제목
      const title = $li.find('dl dt').text().trim();
      if (!title || title.length < 2) return;

      // 썸네일
      let thumbnail = $li.find('.img_area img').attr('src') || '';
      if (thumbnail && !thumbnail.startsWith('http')) {
        thumbnail = `${BASE_URL}${thumbnail}`;
      }

      // 혜택 설명
      const benefit = $li.find('dl dd').first().text().trim();

      // 카테고리 li 목록: 첫번째=채널/타입, 두번째=남은일수
      const $cateItems = $li.find('ul.cate li');

      // 채널 타입: i 태그 class (clip, reels, shorts, tiktok, blog, insta 등) + span 텍스트
      const typeIconClass = $cateItems.first().find('i').attr('class') || '';
      const typeText      = $cateItems.first().find('span').text().trim();

      // D-Day: "6일 남음", "오늘마감", "마감" 등
      const ddayText = $cateItems.eq(1).text().trim();
      let dday = 30;
      if (/마감/.test(ddayText) && !/남음/.test(ddayText)) {
        dday = -1;
      } else if (/오늘/.test(ddayText)) {
        dday = 0;
      } else {
        const m = ddayText.match(/(\d+)/);
        if (m) dday = parseInt(m[1]);
      }

      // 신청/모집 인원: "신청 0 / 모집 9"
      let applied = 0, total = 0;
      const countText = $li.find('.current').text().trim();
      const applyM = countText.match(/신청\s*([\d,]+)/);
      const totalM = countText.match(/모집\s*([\d,]+)/);
      if (applyM) applied = parseInt(applyM[1].replace(/,/g, ''));
      if (totalM) total   = parseInt(totalM[1].replace(/,/g, ''));

      items.push({
        id,
        title    : cleanTitle(title),
        platform : '가보자',
        dot      : 'd-green',
        url,
        thumbnail,
        type     : inferTypes(typeText, typeIconClass, title),
        tags     : inferTags(title),
        benefit,
        location : inferLocation(title, typeText),
        dday,
        applied,
        total,
        site     : '가보자체험단.com',
        isNew    : dday >= 0 && dday >= 25,
      });
    } catch (e) { /* 개별 오류 무시 */ }
  });

  return items;
}

function inferTypes(typeText, iconClass, title) {
  const combined = typeText + ' ' + iconClass + ' ' + title;
  const types = [];
  if (/배송/.test(combined))               types.push('배송');
  if (/방문/.test(combined))               types.push('방문');
  if (/reels|릴스/i.test(combined))        types.push('숏폼');
  if (/shorts|숏츠/i.test(combined))       types.push('숏폼');
  if (/tiktok|틱톡/i.test(combined))       types.push('숏폼');
  if (/clip|클립/i.test(combined))         types.push('숏폼');
  if (/인스타|instagram/i.test(combined))  types.push('인스타');
  if (/블로그|blog/i.test(combined) || types.length === 0) types.push('블로그');
  return [...new Set(types)];
}

function inferTags(title) {
  const tags  = [];
  const rules = [
    [/이유식|아기|유아|육아/,                         '육아'],
    [/맛집|레스토랑|카페|식당|음식|요리|브런치|오마카세/, '맛집'],
    [/뷰티|스킨케어|화장품|립|세럼|크림|마스크팩/,      '뷰티'],
    [/숙박|호텔|풀빌라|펜션|리조트/,                  '숙박'],
    [/여행|관광|투어/,                               '여행'],
    [/반려|강아지|고양이|펫/,                         '반려동물'],
    [/식품|간식|음료|커피|과일|쌀|김치/,               '식품'],
    [/패션|의류|옷|신발|가방/,                        '패션'],
    [/운동|헬스|필라테스|요가/,                       '운동'],
    [/인테리어|가구|생활용품/,                        '생활'],
    [/네일|헤어|마사지|스파/,                         '뷰티'],
  ];
  for (const [re, tag] of rules) if (re.test(title)) tags.push(tag);
  return tags;
}

function inferLocation(title, typeText) {
  const combined = title + ' ' + typeText;
  const rules = [
    [/배송/,                '배송형'],
    [/서울/,                '서울'],
    [/부산/,                '부산'],
    [/강남|서초|송파/,       '서울 강남'],
    [/홍대|마포|합정/,       '서울 마포'],
    [/제주/,                '제주도'],
    [/경기|판교|수원|성남|용인|화성/, '경기'],
    [/인천/,                '인천'],
    [/대구/,                '대구'],
    [/대전/,                '대전'],
    [/광주/,                '광주'],
    [/울산/,                '울산'],
    [/경남|창원|진주|김해/,  '경남'],
    [/경북|포항|안동/,       '경북'],
    [/전남|여수|순천/,       '전남'],
    [/전북|전주/,            '전북'],
    [/충남|천안|아산/,       '충남'],
    [/충북|청주/,            '충북'],
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
