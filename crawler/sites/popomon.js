/**
 * 포포몬 (popomon.com) 크롤러
 * - API: https://popomon.com/api_p/campaign/fetch_getCampaignList?pageNum=N
 * - 페이지당 12개, 총 ~3500개
 */

const axios = require('axios');

const BASE_URL = 'https://popomon.com';
const API_URL  = `${BASE_URL}/api_p/campaign/fetch_getCampaignList`;
const MAX_PAGES = 400;

const HEADERS = {
  'User-Agent'     : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept'         : 'application/json',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Referer'        : `${BASE_URL}/`,
  'Origin'         : BASE_URL,
};

module.exports = async function crawlPopomon() {
  const all     = [];
  const seenIds = new Set();

  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const { data: res } = await axios.get(API_URL, {
        params : { pageNum: page },
        headers: HEADERS,
        timeout: 15000,
      });

      if (!res.success || !res.data) break;

      const items = res.data.contentsData || [];
      if (items.length === 0) break;

      let added = 0;
      for (const c of items) {
        if (c.C_state !== 'ONGOING') continue;

        const id = `popomon_${c.C_idx}`;
        if (seenIds.has(id)) continue;
        seenIds.add(id);

        // 마감일 계산
        const dday = typeof c.C_regi_end_date_count === 'number'
          ? c.C_regi_end_date_count
          : calcDday(c.C_regi_end_date);

        const title = (c.C_title || '').trim();
        if (!title || title.length < 2) continue;

        // 썸네일
        const thumbnail = c.thumb_img || '';

        // 타입
        const type = inferTypes(c.C_recruit_type, c.CS_type, title);

        // 혜택
        const benefit = (c.C_provision || '').trim();

        all.push({
          id,
          title    : cleanTitle(title),
          platform : '포포몬',
          dot      : 'd-violet',
          url      : `${BASE_URL}/next/campaign/${c.C_idx}`,
          thumbnail,
          type,
          tags     : inferTags(title + ' ' + benefit),
          benefit,
          reward   : benefit,
          rewardNum: parseInt(c.C_provision_price) || 0,
          location : inferLocation(title),
          dday,
          applied  : parseInt(c.C_volunteer_count) || 0,
          total    : parseInt(c.C_choice_count) || 0,
          site     : 'popomon.com',
          isNew    : dday >= 25,
        });
        added++;
      }

      if (added === 0 && page > 1) break;
      await sleep(300);
    } catch (err) {
      console.error(`  [포포몬] page ${page} 실패: ${err.message}`);
      break;
    }
  }

  return all;
};

function calcDday(endDateStr) {
  if (!endDateStr) return 30;
  const end  = new Date(endDateStr);
  const now  = new Date();
  const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  return diff;
}

function inferTypes(recruitType, csType, title) {
  const types = [];
  if (/visiting|local/.test(recruitType))     types.push('방문');
  if (/delivery|product/.test(recruitType))   types.push('배송');
  if (/BLOG|RECEIPT/i.test(csType))           types.push('블로그');
  if (/INSTA|INSTAGRAM/i.test(csType))        types.push('인스타');
  if (/SHORTS|REELS|YOUTUBE/i.test(csType))   types.push('숏폼');
  if (/블로그|포스팅/i.test(title))           types.push('블로그');
  if (/인스타|instagram/i.test(title))        types.push('인스타');
  if (types.length === 0)                      types.push('블로그');
  return [...new Set(types)];
}

function inferTags(text) {
  const tags  = [];
  const rules = [
    [/이유식|아기|유아|육아/,                    '육아'],
    [/맛집|레스토랑|카페|식당|음식|요리|브런치|오마카세/, '맛집'],
    [/뷰티|스킨케어|화장품|세럼|크림|마스크팩/, '뷰티'],
    [/숙박|호텔|풀빌라|펜션|리조트|resort/i,   '숙박'],
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
