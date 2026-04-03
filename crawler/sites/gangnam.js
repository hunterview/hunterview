/**
 * 강남맛집 체험단 (xn--939au0g4vj8sq.net / 강남맛집.net) 크롤러
 * - SSR 초기 페이지 + AJAX 페이지네이션
 * - 초기 페이지: https://xn--939au0g4vj8sq.net/cp/
 * - 추가 페이지: /theme/go/_list_cmp_tpl.php?rpage=N&row_num=28
 */

const axios   = require('axios');
const cheerio = require('cheerio');

const BASE_URL  = 'https://xn--939au0g4vj8sq.net';
const LIST_URL  = `${BASE_URL}/cp/`;
const AJAX_URL  = `${BASE_URL}/theme/go/_list_cmp_tpl.php`;
const ROW_NUM   = 28;
const MAX_PAGES = 8; // 최대 ~224개

const HEADERS = {
  'User-Agent'     : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Referer'        : LIST_URL,
};

module.exports = async function crawlGangnam() {
  const all     = [];
  const seenIds = new Set();

  // 1. 초기 SSR 페이지
  try {
    const { data: html } = await axios.get(LIST_URL, { headers: HEADERS, timeout: 15000 });
    const items = parsePage(html);
    for (const item of items) {
      if (!seenIds.has(item.id)) { seenIds.add(item.id); all.push(item); }
    }
  } catch (err) {
    console.error(`  [강남맛집] 초기 페이지 실패: ${err.message}`);
    return all;
  }

  // 2. AJAX 페이지네이션 (rpage=1부터 시작)
  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      await sleep(700);
      const { data } = await axios.post(AJAX_URL, `rpage=${page}&row_num=${ROW_NUM}`, {
        headers: {
          ...HEADERS,
          'Content-Type' : 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
        },
        timeout: 15000,
      });

      // 빈 응답이면 중단
      if (!data || data.trim().length < 50) break;

      const items = parsePage(data);
      if (items.length === 0) break;

      let added = 0;
      for (const item of items) {
        if (!seenIds.has(item.id)) { seenIds.add(item.id); all.push(item); added++; }
      }
      if (added === 0) break; // 중복만 있으면 종료
    } catch (err) {
      console.error(`  [강남맛집] page ${page} 실패: ${err.message}`);
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
      const cpId = $li.attr('data-product') || '';
      if (!cpId) return;

      const id  = `gangnam_${cpId}`;
      const url = `${BASE_URL}/cp/?id=${cpId}`;

      // 제목
      const title = $li.find('dt.tit a').text().trim();
      if (!title || title.length < 2) return;

      // 이미지
      let thumbnail = $li.find('img.thumb_img').attr('src') || '';
      if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;

      // 마감: "N일 남음", "오늘 마감", "마감"
      const ddayTxt = $li.find('span.dday em.day_c').text().trim();
      let dday = 30;
      if (/마감/.test(ddayTxt) && !/남음/.test(ddayTxt)) dday = -1;
      else if (/오늘/.test(ddayTxt))                      dday = 0;
      else {
        const m = ddayTxt.match(/(\d+)일\s*남음/);
        if (m) dday = parseInt(m[1]);
      }

      // 신청/모집 인원
      const numbTxt = $li.find('span.numb').text();
      let applied = 0, total = 0;
      const applyM  = numbTxt.match(/신청\s*([\d,]+)/);
      const recruitM = numbTxt.match(/모집\s*([\d,]+)/);
      if (applyM)   applied = parseInt(applyM[1].replace(/,/g, ''));
      if (recruitM) total   = parseInt(recruitM[1].replace(/,/g, ''));

      // 타입: em.type → "배송형", "방문형"
      const typeText = $li.find('em.type').text().trim();
      // 채널: em.blog, em.insta 등
      const chanText = $li.find('span.label em:first-child').text().trim();

      // 혜택 설명: dd.sub_tit (예: "롯데상품권 (30만원)")
      const benefit = $li.find('dd.sub_tit').first().text().trim();

      items.push({
        id       : id,
        title    : cleanTitle(title),
        platform : '강남맛집체험단',
        dot      : 'd-red',
        url,
        thumbnail,
        type     : inferTypes(typeText + ' ' + chanText),
        tags     : inferTags(title),
        benefit,
        location : inferLocation(title),
        dday,
        applied,
        total,
        site     : '강남맛집.net',
        isNew    : dday >= 25,
      });
    } catch (e) { /* 개별 오류 무시 */ }
  });

  return items;
}

function inferTypes(text) {
  const types = [];
  if (/배송/.test(text))              types.push('배송');
  if (/방문/.test(text))              types.push('방문');
  if (/블로그|blog/i.test(text))      types.push('블로그');
  if (/인스타|instagram/i.test(text)) types.push('인스타');
  if (/릴스|숏폼|쇼츠|유튜브/.test(text)) types.push('숏폼');
  if (types.length === 0)             types.push('블로그');
  return [...new Set(types)];
}

function inferTags(title) {
  const tags  = [];
  const rules = [
    [/이유식|아기|유아|육아/,                    '육아'],
    [/맛집|레스토랑|카페|식당|음식|요리|브런치|갈비|오마카세/, '맛집'],
    [/뷰티|스킨케어|화장품|세럼|크림|마스크팩/, '뷰티'],
    [/숙박|호텔|풀빌라|펜션|리조트/,            '숙박'],
    [/여행|관광|투어/,                           '여행'],
    [/반려|강아지|고양이|펫/,                   '반려동물'],
    [/식품|간식|음료|커피|과일|쌀|김치|상품권/, '식품'],
    [/패션|의류|옷|신발|가방/,                  '패션'],
    [/운동|헬스|필라테스|요가/,                 '운동'],
    [/인테리어|가구|생활용품/,                  '생활'],
    [/네일|헤어|마사지|스파/,                   '뷰티'],
  ];
  for (const [re, tag] of rules) if (re.test(title)) tags.push(tag);
  return tags;
}

function inferLocation(title) {
  const rules = [
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
    [/울산/,              '울산'],
  ];
  for (const [re, loc] of rules) if (re.test(title)) return loc;
  return '전국';
}

function cleanTitle(title) {
  return title.replace(/\s+/g, ' ').replace(/^[\s\-·|]+|[\s\-·|]+$/g, '').trim();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
