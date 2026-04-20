/**
 * 구구다스 (99das.com) 크롤러
 * - API: POST https://99das.com/amz/list/cmpnList.do
 * - 페이지당 10개, pageNum 으로 페이지네이션
 * - 이미지 CDN: https://d26jvdwwu11rjl.cloudfront.net/{mainImgPath}
 */

const axios = require('axios');

const BASE_URL  = 'https://99das.com';
const API_URL   = `${BASE_URL}/amz/list/cmpnList.do`;
const IMG_CDN   = 'https://d26jvdwwu11rjl.cloudfront.net';
const PAGE_SIZE = 10;
const MAX_PAGES = 200;

const HEADERS = {
  'User-Agent'  : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept'      : 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  'Referer'     : `${BASE_URL}/amz/cmpn/amzCmpnList.do`,
  'Origin'      : BASE_URL,
  'X-Requested-With': 'XMLHttpRequest',
};

module.exports = async function crawlGugudas() {
  const all     = [];
  const seenIds = new Set();

  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const body = new URLSearchParams({
        area    : '',
        cate    : '',
        sns     : '',
        orderby : 'new',
        pageNum : String(page),
        pageSize: String(PAGE_SIZE),
        type    : 'cmpnList',
        tagId   : 'cmpnList',
      }).toString();

      const { data: res } = await axios.post(API_URL, body, {
        headers: HEADERS,
        timeout: 15000,
      });

      // 응답 검증 (API는 result 필드 없이 tagId/page/list/type 반환)
      if (!res || !Array.isArray(res.list)) break;

      const items = res.list;
      if (items.length === 0) break;

      let added = 0;
      for (const c of items) {
        const cmpnId = c.cmpnId || c.CMPN_ID;
        if (!cmpnId) continue;

        const id = `gugudas_${cmpnId}`;
        if (seenIds.has(id)) continue;
        seenIds.add(id);

        const title = (c.cmpnNm || c.CMPN_NM || '').trim();
        if (!title || title.length < 2) continue;

        // 썸네일
        const imgPath = c.mainImgPath || c.MAIN_IMG_PATH || '';
        const thumbnail = imgPath
          ? (imgPath.startsWith('http') ? imgPath : `${IMG_CDN}/${imgPath.replace(/^\//, '')}`)
          : '';

        // 마감일 파싱
        // recrtEnDy: "20260426" (YYYYMMDD), recrtEnDyTxt: "6일 남음"
        const dday = parseDday(c.recrtEnDy || '', c.recrtEnDyTxt || '');

        // 혜택
        const benefit = (c.oferBrekdn || c.OFER_BREKDN || '').trim();

        // 금액
        const rewardNum = parseAmount(c.realAmtTxt || c.REAL_AMT_TXT || '');

        // 타입 (chnnlNm: "스마트스토어", "인스타그램", "블로그" 등)
        const chnnl = ((c.chnnlNm || c.subChnnlNm || '')).toLowerCase();
        const type  = inferTypes(chnnl, title);

        // 신청/모집
        const applied = parseInt(c.aplyCnt  || c.APL_CNT  || '0') || 0;
        const total   = parseInt(c.recrtCnt || c.RECRT_CNT || '0') || 0;

        all.push({
          id,
          title    : cleanTitle(title),
          platform : '구구다스',
          dot      : 'd-orange',
          url      : `${BASE_URL}/amz/cmpn/amzCmpnDtl.do?cmpnId=${cmpnId}`,
          thumbnail,
          type,
          tags     : inferTags(title + ' ' + benefit),
          benefit,
          reward   : benefit || rewardNum ? `${rewardNum.toLocaleString()}원` : '',
          rewardNum,
          location : inferLocation(title),
          dday,
          applied,
          total,
          site     : '99das.com',
          isNew    : dday >= 25,
        });
        added++;
      }

      if (added === 0 && page > 1) break;

      // 마지막 페이지: 반환 항목이 PAGE_SIZE 미만이면 종료
      if (items.length < PAGE_SIZE) break;

      await sleep(400);
    } catch (err) {
      console.error(`  [구구다스] page ${page} 실패: ${err.message}`);
      break;
    }
  }

  return all;
};

/**
 * 마감일 → D-day 정수
 * @param {string} enDy   - "20260426" (YYYYMMDD) 형식
 * @param {string} enTxt  - "6일 남음" | "오늘마감" | "마감" 형식
 */
function parseDday(enDy, enTxt) {
  // YYYYMMDD 형식 우선 처리
  if (enDy && /^\d{8}$/.test(enDy.trim())) {
    const s = enDy.trim();
    const dateStr = `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
    const end = new Date(dateStr + 'T23:59:59+09:00');
    const now = new Date();
    return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  }

  // "N일 남음" 텍스트 파싱
  if (enTxt) {
    const t = enTxt.trim();
    if (/마감/.test(t) && !/남음/.test(t)) return -1;
    if (/오늘/.test(t)) return 0;
    const m = t.match(/(\d+)일\s*남음/);
    if (m) return parseInt(m[1]);
  }

  return 30;
}

/**
 * "20,000원" → 20000
 */
function parseAmount(raw) {
  if (!raw) return 0;
  return parseInt(raw.replace(/[^0-9]/g, '')) || 0;
}

function inferTypes(chnnl, title) {
  const types = [];
  if (/insta|instagram|인스타/.test(chnnl + title))  types.push('인스타');
  if (/youtube|유튜브/.test(chnnl + title))           types.push('유튜브');
  if (/shorts|reels|숏폼|쇼츠|릴스/.test(chnnl + title)) types.push('숏폼');
  if (/blog|블로그|naver|네이버/.test(chnnl + title)) types.push('블로그');
  if (/배송/.test(title))                             types.push('배송');
  if (/방문|체험|지역/.test(title))                   types.push('방문');
  if (types.length === 0) types.push('블로그');
  return [...new Set(types)];
}

function inferTags(text) {
  const tags  = [];
  const rules = [
    [/이유식|아기|유아|육아/,                    '육아'],
    [/맛집|레스토랑|카페|식당|음식|요리|브런치|오마카세/, '맛집'],
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
  for (const [re, tag] of rules) if (re.test(text)) tags.push(tag);
  return tags;
}

function inferLocation(title) {
  const rules = [
    [/배송/,                      '배송형'],
    [/서울/,                      '서울'],
    [/부산/,                      '부산'],
    [/강남|서초|송파/,            '서울 강남'],
    [/홍대|마포|합정/,            '서울 마포'],
    [/제주/,                      '제주도'],
    [/경기|판교|수원|성남|용인/,  '경기'],
    [/인천/,                      '인천'],
    [/대구/,                      '대구'],
    [/대전/,                      '대전'],
    [/광주/,                      '광주'],
    [/울산/,                      '울산'],
    [/천안|충남|충북|청주/,       '충청'],
    [/전주|전북|전남/,            '전라'],
    [/강원/,                      '강원'],
  ];
  for (const [re, loc] of rules) if (re.test(title)) return loc;
  return '전국';
}

function cleanTitle(title) {
  return title.replace(/\s+/g, ' ').trim();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
