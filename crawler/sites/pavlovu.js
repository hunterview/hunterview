/**
 * 파블로체험단 (pavlovu.com) 크롤러
 * - PHP 서버사이드 렌더링 → axios + cheerio 사용
 * - Selector: .tanz_campaign_list_wrap ul > li
 */

const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://pavlovu.com';
const PAGES = [
  `${BASE_URL}/review_campaign_list.php`,
  `${BASE_URL}/review_campaign_list.php?page=2`,
  `${BASE_URL}/review_campaign_list.php?page=3`,
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Referer': 'https://pavlovu.com/',
};

module.exports = async function crawlPavlovu() {
  const all = [];
  const seenIds = new Set();

  for (const url of PAGES) {
    try {
      const { data: html } = await axios.get(url, { headers: HEADERS, timeout: 15000 });
      const items = parsePage(html);
      if (items.length === 0) break; // 빈 페이지면 중단

      for (const item of items) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          all.push(item);
        }
      }
      await sleep(800);
    } catch (err) {
      console.error(`  [파블로] ${url} 실패: ${err.message}`);
    }
  }

  return all;
};

function parsePage(html) {
  const $ = cheerio.load(html);
  const items = [];

  // 메인 셀렉터: .tanz_campaign_list_wrap ul > li
  const $cards = $('.tanz_campaign_list_wrap ul > li');

  $cards.each((_, el) => {
    try {
      const $card = $(el);

      // 링크 & ID 추출
      const $link = $card.find('a[href*="review_campaign.php?cp_id="]').first();
      if (!$link.length) return;

      const href = $link.attr('href') || '';
      const cpIdMatch = href.match(/cp_id=(\d+)/);
      if (!cpIdMatch) return;

      const cpId = cpIdMatch[1];
      const id = `pavlovu_${cpId}`;
      const url = href.startsWith('http') ? href : `${BASE_URL}/${href.replace(/^\.\//, '')}`;

      // 제목
      const title = $card.find('.it_name').text().trim() ||
                    $card.find('h3, h4, .title').first().text().trim();
      if (!title || title.length < 3) return;

      // 이미지
      let thumbnail = $card.find('img.it_img, .thumb img').first().attr('src') || '';
      if (thumbnail && !thumbnail.startsWith('http')) {
        thumbnail = `${BASE_URL}/${thumbnail.replace(/^\//, '')}`;
      }

      // 마감일: .dday → "N일 남음", "오늘 마감", "상시모집", "모집마감"
      const ddayText = $card.find('.dday').text().trim();
      let dday = 30;
      if (/상시/.test(ddayText)) dday = 99;
      else if (/오늘|D-0/.test(ddayText)) dday = 0;
      else if (/마감/.test(ddayText)) dday = -1;
      else {
        const m = ddayText.match(/(\d+)/);
        if (m) dday = parseInt(m[1]);
      }

      // 신청/모집 인원: .txt_num → 여러 개 있을 수 있음
      let applied = 0, total = 0;
      const numTexts = $card.find('.txt_num').map((_, e) => $(e).text().trim()).get();
      for (const t of numTexts) {
        const m = t.match(/(\d+)/);
        if (m && total === 0) total = parseInt(m[1]);
        else if (m && applied === 0) applied = parseInt(m[1]);
      }
      // 대안: 전체 텍스트에서 파싱
      if (total === 0) {
        const fullText = $card.text();
        const mm = fullText.match(/(\d+)\s*명\s*모집/);
        if (mm) total = parseInt(mm[1]);
      }

      // 타입: .option2 > span (방문형/배송형/기자단)
      const typeText = $card.find('.option2, .camp_type').text().trim();
      const types = inferTypes(title + ' ' + typeText);
      const tags = inferTags(title);
      const location = inferLocation(title, typeText);

      items.push({
        id,
        title: cleanTitle(title),
        platform: '파블로',
        dot: 'd-orange',
        url,
        thumbnail,
        type: types,
        tags,
        reward: '',
        rewardNum: 0,
        location,
        dday,
        applied,
        total,
        site: 'pavlovu.com',
        isNew: dday >= 25,
      });
    } catch (e) {
      // 개별 파싱 오류 무시
    }
  });

  // .tanz_campaign_list_wrap 없는 경우 대안 파싱
  if (items.length === 0) {
    $('a[href*="review_campaign.php?cp_id="]').each((_, el) => {
      try {
        const $el = $(el);
        const href = $el.attr('href') || '';
        const cpIdMatch = href.match(/cp_id=(\d+)/);
        if (!cpIdMatch) return;

        const cpId = cpIdMatch[1];
        const id = `pavlovu_${cpId}`;
        const url = href.startsWith('http') ? href : `${BASE_URL}/${href.replace(/^\.\//, '')}`;

        const title = $el.find('.it_name, h3, h4').first().text().trim() ||
                      $el.find('img').attr('alt') || '';
        if (!title || title.length < 3) return;

        let thumbnail = $el.find('img').first().attr('src') || '';
        if (thumbnail && !thumbnail.startsWith('http')) thumbnail = `${BASE_URL}/${thumbnail.replace(/^\//, '')}`;

        const fullText = $el.text();
        const ddayMatch = fullText.match(/(\d+)일/);
        const dday = ddayMatch ? parseInt(ddayMatch[1]) : 30;
        const types = inferTypes(title + ' ' + fullText);
        const tags = inferTags(title);
        const location = inferLocation(title, fullText);

        items.push({
          id, title: cleanTitle(title), platform: '파블로', dot: 'd-orange',
          url, thumbnail, type: types, tags, reward: '', rewardNum: 0,
          location, dday, applied: 0, total: 0, site: 'pavlovu.com', isNew: dday >= 25,
        });
      } catch(e) {}
    });
  }

  return items;
}

function inferTypes(text) {
  const types = [];
  if (/배송/.test(text)) types.push('배송');
  if (/방문|지역/.test(text)) types.push('방문');
  if (/블로그|포스팅/.test(text)) types.push('블로그');
  if (/인스타|instagram/i.test(text)) types.push('인스타');
  if (/릴스|숏폼|틱톡|유튜브|쇼츠/.test(text)) types.push('숏폼');
  if (/기자단/.test(text)) types.push('블로그');
  if (types.length === 0) types.push('블로그');
  return [...new Set(types)];
}

function inferTags(title) {
  const tags = [];
  const rules = [
    [/이유식|아기|유아|육아|아이/, '육아'],
    [/맛집|레스토랑|카페|식당|음식|요리|브런치|오마카세/, '맛집'],
    [/뷰티|스킨케어|화장품|립|파운데이션|세럼|크림|마스크팩/, '뷰티'],
    [/숙박|호텔|풀빌라|펜션|게스트하우스|리조트/, '숙박'],
    [/여행|관광|투어/, '여행'],
    [/반려|강아지|고양이|펫/, '반려동물'],
    [/식품|간식|음료|커피|과일|채소|쌀|김치/, '식품'],
    [/패션|의류|옷|신발|가방|악세서리/, '패션'],
    [/운동|헬스|필라테스|요가|스포츠/, '운동'],
    [/인테리어|가구|생활용품/, '생활'],
    [/네일|헤어|마사지|스파|피부관리/, '뷰티'],
  ];
  for (const [re, tag] of rules) {
    if (re.test(title)) tags.push(tag);
  }
  return tags;
}

function inferLocation(title, text) {
  const combined = title + ' ' + text;
  const rules = [
    [/배송/, '배송형'],
    [/서울/, '서울'],
    [/부산/, '부산'],
    [/강남|서초|송파/, '서울 강남'],
    [/홍대|마포|합정/, '서울 마포'],
    [/제주/, '제주도'],
    [/경기|판교|수원|성남|용인|화성/, '경기'],
    [/인천/, '인천'],
    [/대구/, '대구'],
    [/대전/, '대전'],
    [/광주/, '광주'],
    [/전주/, '전북'],
  ];
  for (const [re, loc] of rules) {
    if (re.test(combined)) return loc;
  }
  return '전국';
}

function cleanTitle(title) {
  return title.replace(/\s+/g, ' ').replace(/^[\s\-·|]+|[\s\-·|]+$/g, '').trim();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
