/**
 * 링블 (ringble.co.kr) 크롤러
 * - SSR, 테이블 기반 레이아웃
 * - 컨테이너: td.store_list_wrap
 * - 제목: a.list_title (날짜 텍스트 제외)
 * - 마감: a.list_title 의 "N일 남음 / 오늘마감 / 마감"
 * - 이미지: img (상대경로)
 * - href: a[href*="detail.php"]
 */

const axios   = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.ringble.co.kr';
const MAX_PAGES = 300;

const HEADERS = {
  'User-Agent'     : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Referer'        : BASE_URL,
};

module.exports = async function crawlRingble() {
  const all     = [];
  const seenIds = new Set();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = page === 1
      ? `${BASE_URL}/`
      : `${BASE_URL}/index.php?page=${page}`;
    try {
      const { data: html } = await axios.get(url, { headers: HEADERS, timeout: 30000 });
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

      // Stop if >80% of page items are closed
      const closedCount = items.filter(i => i.dday < 0).length;
      if (items.length > 0 && closedCount / items.length > 0.8) break;

      await sleep(500);
    } catch (err) {
      console.error(`  [링블] page ${page} 실패: ${err.message}`);
      break;
    }
  }

  return all;
};

function parsePage(html) {
  const $     = cheerio.load(html);
  const items = [];

  $('td.store_list_wrap').each((_, el) => {
    try {
      const $td  = $(el);

      // ID / URL: detail.php?number=NNN
      const $detailA = $td.find('a[href*="detail.php"]').first();
      const href     = $detailA.attr('href') || '';
      const numMatch = href.match(/number=(\d+)/);
      if (!numMatch) return;

      const num = numMatch[1];
      const id  = `ringble_${num}`;
      const url = `${BASE_URL}/${href}`;

      // 제목: a.list_title 중 날짜 아닌 것
      const titleEl = $td.find('a.list_title').filter((_, a) =>
        !/일 남음|오늘|마감/.test($(a).text())
      ).first();
      const title = titleEl.text().trim();
      if (!title || title.length < 2) return;

      // 이미지
      let thumbnail = $td.find('img').first().attr('src') || '';
      if (thumbnail && !thumbnail.startsWith('http')) {
        thumbnail = `${BASE_URL}/${thumbnail.replace(/^\.\//, '')}`;
      }

      // 마감: a.list_title 중 날짜 포함하는 것
      const dayEl  = $td.find('a.list_title').filter((_, a) =>
        /일 남음|오늘|마감/.test($(a).text())
      ).first();
      const ddayTxt = dayEl.text().trim();
      let dday = 30;
      if (/마감/.test(ddayTxt) && !/남음/.test(ddayTxt)) dday = -1;
      else if (/오늘/.test(ddayTxt))                      dday = 0;
      else {
        const m = ddayTxt.match(/(\d+)일\s*남음/);
        if (m) dday = parseInt(m[1]);
      }

      // 신청/모집
      const fullTxt = $td.text().replace(/\s+/g, ' ');
      const applyM   = fullTxt.match(/신청\s*([\d,]+)/);
      const recruitM = fullTxt.match(/모집\s*([\d,]+)/);
      const applied  = applyM   ? parseInt(applyM[1].replace(/,/g, ''))  : 0;
      const total    = recruitM ? parseInt(recruitM[1].replace(/,/g, '')) : 0;

      // 혜택: 제목 뒤에 오는 상품 설명 텍스트
      // a.list_title 아닌 텍스트 노드에서 추출
      const allText = $td.clone()
        .find('a.list_title, img, br').remove().end()
        .text().replace(/\s+/g, ' ').trim();
      // 신청/모집 앞 부분이 혜택 설명
      const benefitRaw = allText.split(/신청/)[0].trim();
      const benefit    = benefitRaw.length > 3 && benefitRaw.length < 80 ? benefitRaw : '';

      items.push({
        id       : id,
        title    : cleanTitle(title),
        platform : '링블',
        dot      : 'd-coral',
        url,
        thumbnail,
        type     : inferTypes(title),
        tags     : inferTags(title),
        benefit,
        location : inferLocation(title),
        dday,
        applied,
        total,
        site     : 'ringble.co.kr',
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
  if (/블로그|blog/i.test(text))         types.push('블로그');
  if (/인스타|instagram/i.test(text))    types.push('인스타');
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

function inferLocation(title) {
  const rules = [
    [/배송/,                                 '배송형'],
    [/서울/,                                 '서울'],
    [/부산/,                                 '부산'],
    [/강남|서초|송파/,                       '서울 강남'],
    [/제주/,                                 '제주도'],
    [/수원|성남|용인|고양|안산|화성|경기/,   '경기'],
    [/인천/,                                 '인천'],
    [/대구/,                                 '대구'],
    [/대전/,                                 '대전'],
    [/광주/,                                 '광주'],
    [/울산/,                                 '울산'],
    [/천안|충남|충북|청주/,                  '충청'],
    [/전주|전북|전남/,                       '전라'],
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
