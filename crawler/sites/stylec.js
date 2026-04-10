/**
 * 스타일씨 (stylec.co.kr) 크롤러
 * - REST API: https://api2.stylec.co.kr:6439/v1/trial
 * - JSON 응답, page/count 페이지네이션
 */

const axios = require('axios');

const API_HOST = 'https://api2.stylec.co.kr:6439/v1';
const BASE_URL = 'https://www.stylec.co.kr';
const PAGE_SIZE = 50;
const MAX_PAGES = 30;

const HEADERS = {
  'User-Agent' : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept'     : 'application/json',
  'Referer'    : `${BASE_URL}/trials/`,
  'Origin'     : BASE_URL,
};

module.exports = async function crawlStylec() {
  const all     = [];
  const seenIds = new Set();

  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const { data: res } = await axios.get(`${API_HOST}/trial`, {
        params : { order: 'wr_last', page, count: PAGE_SIZE, include_finish: false },
        headers: HEADERS,
        timeout: 15000,
      });

      if (!res.success) break;

      const items = res.data?.data || [];
      if (items.length === 0) break;

      let added = 0;
      for (const item of items) {
        const id = `stylec_${item.wr_id}`;
        if (seenIds.has(id)) continue;
        seenIds.add(id);

        const dday = typeof item.dday === 'number' ? item.dday : (item.diffdays ?? 30);

        all.push({
          id,
          title    : cleanTitle(item.wr_subject || ''),
          platform : '스타일씨',
          dot      : 'd-purple',
          url      : item.link.startsWith('http') ? item.link : `${BASE_URL}${item.link}`,
          thumbnail: item.img || '',
          type     : inferTypes(item.sns_type, item.wr_type_label, item.wr_subject),
          tags     : inferTags(item.ca_name, item.wr_subject),
          benefit  : item.wr_type_label || '',
          location : inferLocation(item.wr_subject),
          dday,
          applied  : item.tr_enroll_cnt || 0,
          total    : item.tr_recruit_max || 0,
          site     : 'stylec.co.kr',
          isNew    : dday >= 0 && dday >= 25,
        });
        added++;
      }

      if (added === 0) break;

      // 전체 페이지 초과 시 중단
      const total = res.data?.Total || 0;
      if (page * PAGE_SIZE >= total) break;

      await sleep(400);
    } catch (err) {
      console.error(`  [스타일씨] page ${page} 실패: ${err.message}`);
      break;
    }
  }

  return all;
};

function inferTypes(snsType, typeLabel, title) {
  const combined = (snsType || '') + ' ' + (typeLabel || '') + ' ' + (title || '');
  const types = [];
  if (/배달/.test(combined))               types.push('배달');
  if (/방문/.test(combined))               types.push('방문');
  if (/reels|릴스/i.test(combined))        types.push('숏폼');
  if (/shorts|숏츠/i.test(combined))       types.push('숏폼');
  if (/tiktok|틱톡/i.test(combined))       types.push('숏폼');
  if (/clip|클립/i.test(combined))         types.push('숏폼');
  if (/youtube|유튜브/i.test(combined))    types.push('숏폼');
  if (/instagram|인스타/i.test(combined))  types.push('인스타');
  if (/naverblog|블로그/i.test(combined) || types.length === 0) types.push('블로그');
  return [...new Set(types)];
}

function inferTags(caName, title) {
  const combined = (caName || '') + ' ' + (title || '');
  const tags = [];
  const rules = [
    [/이유식|아기|유아|육아|출산/,                    '육아'],
    [/맛집|레스토랑|카페|식당|음식|요리|브런치|오마카세/, '맛집'],
    [/뷰티|스킨케어|화장품|립|세럼|크림|마스크팩|헤어|네일/, '뷰티'],
    [/숙박|호텔|풀빌라|펜션|리조트/,                 '숙박'],
    [/여행|관광|투어/,                              '여행'],
    [/반려|강아지|고양이|펫/,                        '반려동물'],
    [/식품|간식|음료|커피|과일|쌀|김치|건강식품/,      '식품'],
    [/패션|의류|옷|신발|가방|잡화/,                  '패션'],
    [/운동|헬스|필라테스|요가|스포츠/,               '운동'],
    [/인테리어|가구|생활용품|주방/,                  '생활'],
    [/전자|디지털|가전/,                            '디지털'],
  ];
  for (const [re, tag] of rules) if (re.test(combined)) tags.push(tag);
  return tags;
}

function inferLocation(title) {
  const rules = [
    [/배달|배송/,           '배송형'],
    [/서울/,               '서울'],
    [/부산/,               '부산'],
    [/강남|서초|송파/,      '서울 강남'],
    [/홍대|마포|합정/,      '서울 마포'],
    [/제주/,               '제주도'],
    [/경기|판교|수원|성남/, '경기'],
    [/인천/,               '인천'],
    [/대구/,               '대구'],
    [/대전/,               '대전'],
    [/광주/,               '광주'],
    [/울산/,               '울산'],
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
