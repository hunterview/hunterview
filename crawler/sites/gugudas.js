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

      // 응답 검증
      if (!res || res.result !== 'Y') break;

      const items = res.list;
      if (!Array.isArray(items) || items.length === 0) break;

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

        // 마감일 파싱 (recrtEnDyTxt: "2026.04.30" 형태 또는 "D-7")
        const dday = parseDday(c.recrtEnDyTxt || c.RECRT_EN_DY_TXT || '');

        // 혜택
        const benefit = (c.oferBrekdn || c.OFER_BREKDN || '').trim();

        // 금액
        const rewardNum = parseAmount(c.realAmtTxt || c.REAL_AMT_TXT || '');

        // 타입 (subChnnlNm: "인스타그램", "블로그", "유튜브" 등)
        const chnnl = (c.subChnnlNm || c.SUB_CHNNL_NM || '').toLowerCase();
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

      // 더 이상 페이지가 없는 경우 (총 페이지 정보)
      const totalPage = parseInt(res.page || '0');
      if (totalPage > 0 && page >= totalPage) break;

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
 * 입력: "2026.04.30", "D-7", "07", "2026-04-30" 등
 */
function parseDday(raw) {
  if (!raw) return 30;

  const s = raw.trim();

  // D-N 형태
  const dm = s.match(/D[-]?(\d+)/i);
  if (dm) return parseInt(dm[1]);

  // YYYY.MM.DD 또는 YYYY-MM-DD
  const dm2 = s.match(/(\d{4})[.\-](\d{1,2})[.\-](\d{1,2})/);
  if (dm2) {
    const end  = new Date(`${dm2[1]}-${dm2[2].padStart(2,'0')}-${dm2[3].padStart(2,'0')}`);
    const now  = new Date();
    return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  }

  // 순수 숫자 (일수로 간주)
  const dn = s.match(/^(\d+)$/);
  if (dn) return parseInt(dn[1]);

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
