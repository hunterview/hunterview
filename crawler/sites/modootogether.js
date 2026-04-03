/**
 * 모두모여체험단 (modootogether.com) 크롤러
 * - JSON API 방식 (axios, 로그인 불필요)
 * - API: https://modootogether.com/campaign_list.php?json=list&page=N
 * - 총 2000개+, 페이지당 20개
 */

const axios = require('axios');

const BASE_URL = 'https://modootogether.com';
const API_URL  = `${BASE_URL}/campaign_list.php`;
const MAX_PAGES = 10; // 200개 수집

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': `${BASE_URL}/`,
  'Accept': 'application/json',
};

module.exports = async function crawlModootogether() {
  const all     = [];
  const seenIds = new Set();

  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const { data } = await axios.get(API_URL, {
        params : { json: 'list', page },
        headers: HEADERS,
        timeout: 15000,
      });

      if (!data || (data.result !== 'success' && data.result !== 'ok')) break;

      const list = data.list || [];
      if (list.length === 0) break;

      for (const c of list) {
        const id = `modootogether_${c.cp_id}`;
        if (seenIds.has(id)) continue;
        seenIds.add(id);

        const title = (c.cp_subject || '').trim();
        if (!title || title.length < 3) continue;

        const url       = `${BASE_URL}/campaign.php?cp_id=${c.cp_id}`;
        let thumbnail   = c.cp_img || '';
        if (thumbnail && !thumbnail.startsWith('http')) {
          thumbnail = `${BASE_URL}/${thumbnail.replace(/^\.\//, '')}`;
        }

        // D-day 파싱: "D-Day 56" / "D-Day 0" / "상시모집" / "모집마감"
        let dday = 30;
        const cp_day = String(c.cp_day || '');
        if (/상시/.test(cp_day))               dday = 99;
        else if (/마감/.test(cp_day))           dday = -1;
        else if (/D-Day\s*0/.test(cp_day))      dday = 0;
        else {
          const m = cp_day.match(/D-Day\s*(\d+)/i);
          if (m) dday = parseInt(m[1]);
        }

        const applied = parseInt(c.cp_order   || 0);
        const total   = parseInt(c.cp_recruit || 0);
        const tags    = inferTags(title);
        const loc     = inferLocation(title);

        all.push({
          id,
          title      : cleanTitle(title),
          platform   : '모두모여체험단',
          dot        : 'd-green',
          url,
          thumbnail,
          type       : inferTypes(c.cp_type || '', title),
          tags,
          reward     : c.cp_point ? `${c.cp_point}P` : '',
          rewardNum  : 0,
          location   : loc,
          dday,
          applied,
          total,
          site       : 'modootogether.com',
          isNew      : dday >= 25,
        });
      }

      // 마지막 페이지면 중단
      if (page >= (parseInt(data.last_page) || MAX_PAGES)) break;

      await sleep(600);
    } catch (err) {
      console.error(`  [모두모여체험단] page ${page} 실패: ${err.message}`);
      break;
    }
  }

  return all;
};

function inferTypes(cpType, title) {
  const text  = cpType + ' ' + title;
  const types = [];
  if (/배송/.test(text))                   types.push('배송');
  if (/방문|지역/.test(text))              types.push('방문');
  if (/블로그|기자단|포스팅/.test(text))   types.push('블로그');
  if (/인스타|instagram/i.test(text))      types.push('인스타');
  if (/릴스|숏폼|틱톡|유튜브|쇼츠/.test(text)) types.push('숏폼');
  if (types.length === 0)                  types.push('블로그');
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
    [/패션|의류|옷|신발|가방|악세서리/,         '패션'],
    [/운동|헬스|필라테스|요가|스포츠/,          '운동'],
    [/인테리어|가구|생활용품/,                  '생활'],
    [/네일|헤어|마사지|스파|피부관리/,          '뷰티'],
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
    [/전주/,              '전북'],
  ];
  for (const [re, loc] of rules) if (re.test(title)) return loc;
  return '전국';
}

function cleanTitle(title) {
  return title.replace(/\[상품평\]\s*/g, '').replace(/\s+/g, ' ').trim();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
