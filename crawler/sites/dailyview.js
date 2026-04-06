/**
 * 데일리뷰 (dailyview.kr) 크롤러
 * - review_campaign_list.php?page=N 으로 전체 수집
 * - div.box > span.it_name / span.it_description / span.dday
 */

const axios   = require('axios');
const cheerio = require('cheerio');

const BASE_URL  = 'https://dailyview.kr';
const LIST_URL  = `${BASE_URL}/review_campaign_list.php`;
const MAX_PAGES = 50;

const HEADERS = {
  'User-Agent'     : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Referer'        : `${BASE_URL}/`,
};

module.exports = async function crawlDailyview() {
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

      const closedCount = items.filter(i => i.dday < 0).length;
      if (items.length > 0 && closedCount / items.length > 0.8) break;

      await sleep(500);
    } catch (err) {
      console.error(`  [데일리뷰] page ${page} 실패: ${err.message}`);
      break;
    }
  }

  return all;
};

function parsePage(html) {
  const $     = cheerio.load(html);
  const items = [];

  $('div.box').each((_, el) => {
    try {
      const $box  = $(el);
      const $a    = $box.find('a[href*="cp_id="]').first();
      const href  = $a.attr('href') || '';
      const match = href.match(/cp_id=(\d+)/);
      if (!match) return;

      const cpId = match[1];
      const id   = `dailyview_${cpId}`;
      const url  = `${BASE_URL}/review_campaign.php?cp_id=${cpId}`;

      const title = $box.find('span.it_name').text().trim();
      if (!title || title.length < 3) return;

      let thumbnail = $box.find('div.thumb img.it_img, img.it_img').attr('src') || '';
      if (thumbnail && !thumbnail.startsWith('http')) {
        thumbnail = `${BASE_URL}/${thumbnail.replace(/^\.\//, '')}`;
      }

      const ddayTxt = $box.find('span.dday').text().trim();
      let dday = 30;
      if (/상시/.test(ddayTxt))            dday = 99;
      else if (/마감/.test(ddayTxt))       dday = -1;
      else if (/D-Day\s*0/i.test(ddayTxt)) dday = 0;
      else {
        const m = ddayTxt.match(/D-Day\s*(\d+)/i) || ddayTxt.match(/(\d+)일\s*남음/);
        if (m) dday = parseInt(m[1]);
      }

      const typeText = $box.find('div.top_info span').map((_, e) => $(e).text()).get().join(' ');
      const benefit  = $box.find('span.it_description').text().trim();

      const nums    = $box.find('b.txt_num').map((_, e) => parseInt($(e).text())).get().filter(n => !isNaN(n));
      const applied = nums[0] || 0;
      const total   = nums[1] || 0;

      items.push({
        id       : id,
        title    : cleanTitle(title),
        platform : '데일리뷰',
        dot      : 'd-amber',
        url,
        thumbnail,
        type     : inferTypes(typeText + ' ' + title),
        tags     : inferTags(title),
        benefit,
        location : inferLocation(title, benefit),
        dday,
        applied,
        total,
        site     : 'dailyview.kr',
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

function inferLocation(title, text) {
  const combined = title + ' ' + text;
  const rules = [
    [/배송/,              '배송형'],
    [/서울/,              '서울'],
    [/부산/,              '부산'],
    [/강남|서초|송파/,    '서울 강남'],
    [/제주/,              '제주도'],
    [/수원|성남|용인|고양|안산|화성|경기/, '경기'],
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
