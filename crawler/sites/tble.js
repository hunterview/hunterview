/**
 * 티블 (tble.kr) 크롤러
 * - 서버사이드 렌더링 → axios + cheerio 사용
 * - URL: https://tble.kr/category.php (전체), ?type=p (배송), ?type=l (지역)
 */

const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://tble.kr';
const PAGES = [
  `${BASE_URL}/category.php`,
  `${BASE_URL}/category.php?type=p`,
  `${BASE_URL}/category.php?type=l`,
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Referer': 'https://tble.kr/',
};

module.exports = async function crawlTble() {
  const all = [];
  const seenIds = new Set();

  for (const url of PAGES) {
    try {
      const { data: html } = await axios.get(url, { headers: HEADERS, timeout: 15000 });
      const items = parsePage(html);
      for (const item of items) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          all.push(item);
        }
      }
      await sleep(800);
    } catch (err) {
      console.error(`  [티블] ${url} 실패: ${err.message}`);
    }
  }

  return all;
};

function parsePage(html) {
  const $ = cheerio.load(html);
  const items = [];

  // 캠페인 링크 찾기: href에 view.php?cp_id= 포함
  $('a[href*="view.php?cp_id="]').each((_, el) => {
    try {
      const $el = $(el);
      const href = $el.attr('href') || '';
      const cpIdMatch = href.match(/cp_id=(\d+)/);
      if (!cpIdMatch) return;

      const cpId = cpIdMatch[1];
      const id = `tble_${cpId}`;
      const url = href.startsWith('http') ? href : `${BASE_URL}/${href.replace(/^\.\//, '')}`;

      // 이미지
      const img = $el.find('img').first();
      let thumbnail = img.attr('src') || '';
      if (thumbnail && !thumbnail.startsWith('http')) {
        thumbnail = `${BASE_URL}/${thumbnail.replace(/^\.\//, '')}`;
      }

      // 텍스트 전체 수집
      const fullText = $el.text().replace(/\s+/g, ' ').trim();

      // 제목: h3 또는 첫 번째 의미있는 텍스트
      let title = $el.find('h3, h4, .title, .cp_name').first().text().trim();
      if (!title) {
        // 이미지 alt에서 가져오기
        title = img.attr('alt') || '';
      }
      if (!title) {
        // 텍스트에서 첫 줄 추출
        const lines = fullText.split(/[\n·|]/).map(s => s.trim()).filter(s => s.length > 3);
        title = lines[0] || '';
      }
      if (!title || title.length < 3) return;

      // 마감일 파싱: "N일 남음", "오늘 마감", "마감"
      let dday = 30;
      const ddayMatch = fullText.match(/(\d+)일\s*남음/);
      const todayMatch = fullText.match(/오늘\s*마감/);
      const closedMatch = fullText.match(/모집\s*마감/);
      if (ddayMatch) dday = parseInt(ddayMatch[1]);
      else if (todayMatch) dday = 0;
      else if (closedMatch) dday = -1;

      // 신청 / 모집 인원
      let applied = 0, total = 0;
      const memberMatch = fullText.match(/신청\s*(\d+)명\s*\/\s*모집\s*(\d+)명/);
      if (memberMatch) {
        applied = parseInt(memberMatch[1]);
        total = parseInt(memberMatch[2]);
      }

      // 타입 분류 (제목/텍스트 기반)
      const types = inferTypes(title + ' ' + fullText);
      const tags = inferTags(title);

      // 위치
      const location = inferLocation(title, fullText);

      items.push({
        id,
        title: cleanTitle(title),
        platform: '티블',
        dot: 'd-teal',
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
        site: 'tble.kr',
        isNew: dday >= 25,
      });
    } catch (e) {
      // 개별 아이템 파싱 오류는 무시
    }
  });

  return items;
}

function inferTypes(text) {
  const types = [];
  if (/배송/.test(text)) types.push('배송');
  if (/방문|지역/.test(text)) types.push('방문');
  if (/블로그|포스팅/.test(text)) types.push('블로그');
  if (/인스타|instagram/i.test(text)) types.push('인스타');
  if (/릴스|숏폼|틱톡|유튜브|쇼츠/.test(text)) types.push('숏폼');
  if (types.length === 0) types.push('블로그');
  return types;
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
  ];
  for (const [re, tag] of rules) {
    if (re.test(title)) tags.push(tag);
  }
  return tags;
}

function inferLocation(title, text) {
  const locationRules = [
    [/배송/, '배송형'],
    [/서울/, '서울'],
    [/부산/, '부산'],
    [/강남/, '서울 강남'],
    [/홍대|마포/, '서울 마포'],
    [/제주/, '제주도'],
    [/경기|판교|수원|성남/, '경기'],
    [/인천/, '인천'],
    [/대구/, '대구'],
    [/대전/, '대전'],
    [/광주/, '광주'],
  ];
  for (const [re, loc] of locationRules) {
    if (re.test(title) || re.test(text)) return loc;
  }
  return '전국';
}

function cleanTitle(title) {
  return title.replace(/\s+/g, ' ').replace(/^[\s\-·|]+|[\s\-·|]+$/g, '').trim();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
