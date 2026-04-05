/**
 * 티블 (tble.kr) 크롤러
 * - Node.js SSL DH key 호환 문제로 curl 사용
 * - URL: https://tble.kr/category.php
 */

const { execSync } = require('child_process');
const cheerio = require('cheerio');

const BASE_URL = 'https://tble.kr';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function fetchWithCurl(url) {
  const cmd = `curl -s -k --max-time 20 -A "${UA}" -H "Accept-Language: ko-KR,ko;q=0.9" -H "Referer: https://tble.kr/" "${url}"`;
  return execSync(cmd, { timeout: 25000, maxBuffer: 10 * 1024 * 1024 }).toString();
}

module.exports = async function crawlTble() {
  const all = [];
  const seenIds = new Set();

  const html = fetchWithCurl(`${BASE_URL}/category.php`);
  const items = parsePage(html);
  for (const item of items) {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      all.push(item);
    }
  }

  return all;
};

function parsePage(html) {
  const $ = cheerio.load(html);
  const items = [];
  const seen = new Set();

  // 각 캠페인 = a[이미지] + a[텍스트정보] 2개 쌍으로 존재
  // 텍스트 정보가 있는 링크만 선택 (.t2 포함)
  $('a[href*="cp_id="]').each((_, el) => {
    try {
      const $el = $(el);
      const href = $el.attr('href') || '';
      const cpIdMatch = href.match(/cp_id=(\d+)/);
      if (!cpIdMatch) return;

      const cpId = cpIdMatch[1];

      // 제목: .t2에서 가져옴 (없으면 이미지 카드라 스킵)
      const title = cleanTitle($el.find('.t2').text().trim());
      if (!title || title.length < 3) return;

      if (seen.has(cpId)) return;
      seen.add(cpId);

      const id = `tble_${cpId}`;
      const rawUrl = href.replace(/^\.\//, '');
      const url = rawUrl.startsWith('http') ? rawUrl : `${BASE_URL}/${rawUrl}`;

      // 썸네일: 같은 cp_id의 이미지 링크에서
      const imgLink = $(`a[href*="cp_id=${cpId}"] img`).first();
      let thumbnail = imgLink.attr('src') || '';
      if (thumbnail && !thumbnail.startsWith('http')) {
        thumbnail = `${BASE_URL}/${thumbnail.replace(/^\.\//, '')}`;
      }

      const fullText = $el.text().replace(/\s+/g, ' ').trim();

      // 체험혜택: .t3
      const benefit = $el.find('.t3').text().trim();

      // 마감일: .ps_remain "N일 남음" 또는 "오늘 마감" 또는 "모집 마감"
      let dday = 30;
      const remainText = $el.find('.ps_remain').text().trim();
      const ddayMatch = remainText.match(/(\d+)일\s*남음/);
      if (ddayMatch) dday = parseInt(ddayMatch[1]);
      else if (/오늘\s*마감/.test(remainText)) dday = 0;
      else if (/모집\s*마감|마감됨/.test(remainText)) dday = -1;

      // 신청/모집 인원
      let applied = 0, total = 0;
      const memberMatch = fullText.match(/신청\s*([\d,]+)명\s*\/\s*모집\s*([\d,]+)명/);
      if (memberMatch) {
        applied = parseInt(memberMatch[1].replace(/,/g, ''));
        total = parseInt(memberMatch[2].replace(/,/g, ''));
      }

      items.push({
        id,
        title,
        platform: '티블',
        dot: 'd-teal',
        url,
        thumbnail,
        type: inferTypes(title + ' ' + fullText),
        tags: inferTags(title),
        benefit,
        reward: '',
        rewardNum: 0,
        location: inferLocation(title, fullText),
        dday,
        applied,
        total,
        site: 'tble.kr',
        isNew: dday >= 25,
      });
    } catch (e) {
      // skip
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
  for (const [re, tag] of rules) if (re.test(title)) tags.push(tag);
  return tags;
}

function inferLocation(title, text) {
  const combined = title + ' ' + text;
  const rules = [
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
  for (const [re, loc] of rules) if (re.test(combined)) return loc;
  return '전국';
}

function cleanTitle(title) {
  return title.replace(/\s+/g, ' ').replace(/^[\s\-·|]+|[\s\-·|]+$/g, '').trim();
}
