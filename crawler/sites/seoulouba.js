/**
 * 서울오빠 (seoulouba.co.kr) 크롤러
 * - SSR 페이지 + ?page=N 페이지네이션
 * - Selector: ul.campaign_wbox > li.campaign_content
 */

const axios   = require('axios');
const cheerio = require('cheerio');

const BASE_URL  = 'https://www.seoulouba.co.kr';
const LIST_URL  = `${BASE_URL}/campaign/`;
const MAX_PAGES = 30;

const HEADERS = {
  'User-Agent'     : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Referer'        : LIST_URL,
};

module.exports = async function crawlSeoulouba() {
  const all     = [];
  const seenIds = new Set();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = page === 1 ? LIST_URL : `${LIST_URL}?page=${page}`;
    try {
      const { data: html } = await axios.get(url, { headers: HEADERS, timeout: 15000 });
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

      await sleep(600);
    } catch (err) {
      console.error(`  [서울오빠] page ${page} 실패: ${err.message}`);
      break;
    }
  }

  return all;
};

function parsePage(html) {
  const $     = cheerio.load(html);
  const items = [];

  $('ul.campaign_wbox > li.campaign_content').each((_, el) => {
    try {
      const $li = $(el);

      // 링크 & ID: a.tum_img
      const $link = $li.find('a.tum_img').first();
      if (!$link.length) return;

      const href = $link.attr('href') || '';
      const cidMatch = href.match(/[?&]c=(\d+)/);
      if (!cidMatch) return;

      const cid = cidMatch[1];
      const id  = `seoulouba_${cid}`;

      // 제목: .s_campaign_title
      const title = $li.find('.s_campaign_title').text().trim();
      if (!title || title.length < 2) return;

      // 썸네일
      const thumbnail = $li.find('a.tum_img img').attr('src') || '';

      // 타입 태그: .icon_tag span (기자단, 배송형, 방문형 등)
      const typeText = $li.find('.icon_tag span').map((i, e) => $(e).text().trim()).get().join(' ');

      // 채널 이미지: thum_ch_blog, thum_ch_reels 등
      const chanSrc = $li.find('.icon_box img[src*="thum_ch"]').attr('src') || '';

      // D-Day + 신청/모집: .campaign_day_people
      const dpText = $li.find('.campaign_day_people').text().trim().replace(/\s+/g, ' ');

      // D-Day 파싱: "D-5", "D-day", "D-0", "모집마감"
      let dday = 30;
      const blindText = $li.find('.load_blind strong').text().trim();
      if (/모집마감/.test(blindText)) {
        dday = -1;
      } else if (/D-day|D-0/i.test(dpText)) {
        dday = 0;
      } else {
        const m = dpText.match(/D-(\d+)/i);
        if (m) dday = parseInt(m[1]);
      }

      // 신청/모집 인원: "신청 131 / 모집 50"
      let applied = 0, total = 0;
      const applyM  = dpText.match(/신청\s*([\d,]+)/);
      const totalM  = dpText.match(/모집\s*([\d,]+)/);
      if (applyM)  applied = parseInt(applyM[1].replace(/,/g, ''));
      if (totalM)  total   = parseInt(totalM[1].replace(/,/g, ''));

      // 혜택: .point_icon 또는 span에서 포인트 정보
      const benefit = $li.find('.s_campaign_reward, .load_benefit').first().text().trim();

      items.push({
        id,
        title    : cleanTitle(title),
        platform : '서울오빠',
        dot      : 'd-blue',
        url      : href,
        thumbnail,
        type     : inferTypes(typeText, chanSrc, title),
        tags     : inferTags(title),
        benefit,
        location : inferLocation(title, typeText),
        dday,
        applied,
        total,
        site     : 'seoulouba.co.kr',
        isNew    : dday >= 0 && dday >= 25,
      });
    } catch (e) { /* 개별 오류 무시 */ }
  });

  return items;
}

function inferTypes(typeText, chanSrc, title) {
  const combined = typeText + ' ' + title + ' ' + chanSrc;
  const types = [];
  if (/배송/.test(combined))               types.push('배송');
  if (/방문/.test(combined))               types.push('방문');
  if (/reels|릴스/i.test(combined))        types.push('숏폼');
  if (/clip|클립/i.test(combined))         types.push('숏폼');
  if (/인스타|instagram/i.test(combined))  types.push('인스타');
  if (/기자단|블로그|blog/i.test(combined) || types.length === 0) types.push('블로그');
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
    [/경기|판교|수원|성남/,  '경기'],
    [/인천/,                '인천'],
    [/대구/,                '대구'],
    [/대전/,                '대전'],
    [/광주/,                '광주'],
    [/울산/,                '울산'],
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
