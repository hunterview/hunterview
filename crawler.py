"""
헌터뷰 Playwright 크롤러
- JS 렌더링 사이트 포함 6개 체험단 사이트 크롤링
- 아싸뷰, 파블로체험단, 디너의여왕, 미블, 포블로그, 모두의체험단
"""

import asyncio
import json
import re
from datetime import datetime
from playwright.async_api import async_playwright

OUTPUT_FILE = "data.json"


def parse_deadline(text):
    if not text: return ""
    m = re.search(r'(\d{4})[./](\d{1,2})[./](\d{1,2})', text)
    if m:
        y, mo, d = m.groups()
        return f"{y}-{int(mo):02d}-{int(d):02d}"
    return ""

def clean(text):
    if not text: return ""
    return re.sub(r'\s+', ' ', text).strip()[:100]

def detect_type(text):
    if "릴스" in text or "숏츠" in text or "클립" in text: return "숏폼"
    if "인스타" in text: return "인스타"
    return "블로그"

def detect_location(text):
    if "배송" in text: return "배송형"
    if "구매" in text: return "구매형"
    return "방문형"


async def crawl_assaview(page):
    print("🔍 아싸뷰 크롤링...")
    results = []
    try:
        await page.goto("https://assaview.co.kr/campaign_list.php", timeout=20000)
        await page.wait_for_timeout(2000)
        items = await page.query_selector_all("a[href*='campaign.php?cp_id']")
        for item in items[:50]:
            try:
                href = await item.get_attribute("href") or ""
                link = "https://assaview.co.kr/" + href if not href.startswith("http") else href
                text = await item.inner_text()
                lines = [l.strip() for l in text.split('\n') if l.strip()]

                title, reward, deadline = "", "", ""
                location = "배송형"
                applied, total = 0, 10

                for line in lines:
                    if re.match(r'\d{4}/\d{2}/\d{2}', line):
                        deadline = line[:10].replace("/", "-")
                    elif "방문형" in line: location = "방문형"
                    elif "배송형" in line: location = "배송형"
                    elif "구매형" in line: location = "구매형"
                    elif re.match(r'^\d+$', line) and int(line) < 5000:
                        applied = int(line)
                    elif line.endswith("명") and line[:-1].isdigit():
                        total = int(line[:-1])
                    elif len(line) > len(title) and len(line) > 5:
                        skip = ["신청","참여 조건","아싸뷰","타임","맞춤","기자단"]
                        if not any(k in line for k in skip):
                            title = line
                    elif len(line) > 10 and line != title and "신청" not in line and len(line) > len(reward):
                        reward = line[:60]

                img_el = await item.query_selector("img[src*='thumb']")
                image = await img_el.get_attribute("src") if img_el else ""
                if image.startswith("/"): image = "https://assaview.co.kr" + image

                review_type = detect_type(text)

                if title and len(title) > 4:
                    results.append({
                        "title": title, "reward": reward, "platform": "아싸뷰",
                        "link": link, "image": image, "deadline": deadline,
                        "location": location, "review_type": review_type,
                        "applied": applied, "total": total
                    })
            except: continue
    except Exception as e:
        print(f"  오류: {e}")
    print(f"  ✅ {len(results)}개")
    return results


async def crawl_pavlovu(page):
    print("🔍 파블로체험단 크롤링...")
    results = []
    try:
        await page.goto("https://pavlovu.com/review_campaign_list.php", timeout=20000)
        await page.wait_for_timeout(2000)
        items = await page.query_selector_all("a[href*='review_campaign_view']")
        for item in items[:40]:
            try:
                href = await item.get_attribute("href") or ""
                link = "https://pavlovu.com" + href if href.startswith("/") else href
                text = await item.inner_text()
                lines = [l.strip() for l in text.split('\n') if l.strip() and len(l.strip()) > 2]
                if not lines: continue
                title = max(lines, key=len)
                img_el = await item.query_selector("img")
                image = await img_el.get_attribute("src") if img_el else ""
                if image and image.startswith("/"): image = "https://pavlovu.com" + image
                if title and len(title) > 4:
                    results.append({
                        "title": clean(title), "reward": "", "platform": "파블로체험단",
                        "link": link, "image": image, "deadline": parse_deadline(text),
                        "location": detect_location(text), "review_type": detect_type(text),
                        "applied": 0, "total": 10
                    })
            except: continue
    except Exception as e:
        print(f"  오류: {e}")
    print(f"  ✅ {len(results)}개")
    return results


async def crawl_dinnerqueen(page):
    print("🔍 디너의여왕 크롤링...")
    results = []
    try:
        await page.goto("https://dinnerqueen.net/taste", timeout=25000)
        await page.wait_for_timeout(3500)
        items = await page.query_selector_all("a[href*='/taste/']")
        for item in items[:40]:
            try:
                href = await item.get_attribute("href") or ""
                if "/taste/" not in href: continue
                link = "https://dinnerqueen.net" + href if href.startswith("/") else href
                text = await item.inner_text()
                lines = [l.strip() for l in text.split('\n') if l.strip() and len(l.strip()) > 3]
                if not lines: continue
                title = max(lines, key=len)
                img_el = await item.query_selector("img")
                image = await img_el.get_attribute("src") if img_el else ""
                if image and image.startswith("/"): image = "https://dinnerqueen.net" + image
                if title and len(title) > 4:
                    results.append({
                        "title": clean(title), "reward": "", "platform": "디너의여왕",
                        "link": link, "image": image, "deadline": parse_deadline(text),
                        "location": detect_location(text), "review_type": detect_type(text),
                        "applied": 0, "total": 10
                    })
            except: continue
    except Exception as e:
        print(f"  오류: {e}")
    print(f"  ✅ {len(results)}개")
    return results


async def crawl_mrblog(page):
    print("🔍 미블 크롤링...")
    results = []
    try:
        await page.goto("https://www.mrblog.net/campaigns", timeout=25000)
        await page.wait_for_timeout(3000)
        items = await page.query_selector_all("a[href*='/campaign/']")
        for item in items[:40]:
            try:
                href = await item.get_attribute("href") or ""
                if "/campaign/" not in href: continue
                link = "https://www.mrblog.net" + href if href.startswith("/") else href
                text = await item.inner_text()
                lines = [l.strip() for l in text.split('\n') if l.strip() and len(l.strip()) > 3]
                if not lines: continue
                title = max(lines, key=len)
                img_el = await item.query_selector("img")
                image = await img_el.get_attribute("src") if img_el else ""
                if title and len(title) > 4:
                    results.append({
                        "title": clean(title), "reward": "", "platform": "미블",
                        "link": link, "image": image, "deadline": parse_deadline(text),
                        "location": detect_location(text), "review_type": detect_type(text),
                        "applied": 0, "total": 10
                    })
            except: continue
    except Exception as e:
        print(f"  오류: {e}")
    print(f"  ✅ {len(results)}개")
    return results


async def crawl_4blog(page):
    print("🔍 포블로그 크롤링...")
    results = []
    try:
        await page.goto("https://4blog.net/list/all", timeout=25000)
        await page.wait_for_timeout(3000)
        items = await page.query_selector_all("a[href*='/view/']")
        for item in items[:40]:
            try:
                href = await item.get_attribute("href") or ""
                link = "https://4blog.net" + href if href.startswith("/") else href
                text = await item.inner_text()
                lines = [l.strip() for l in text.split('\n') if l.strip() and len(l.strip()) > 3]
                if not lines: continue
                title = max(lines, key=len)
                img_el = await item.query_selector("img")
                image = await img_el.get_attribute("src") if img_el else ""
                if title and len(title) > 4:
                    results.append({
                        "title": clean(title), "reward": "", "platform": "포블로그",
                        "link": link, "image": image, "deadline": parse_deadline(text),
                        "location": detect_location(text), "review_type": detect_type(text),
                        "applied": 0, "total": 10
                    })
            except: continue
    except Exception as e:
        print(f"  오류: {e}")
    print(f"  ✅ {len(results)}개")
    return results


async def crawl_modan(page):
    print("🔍 모두의체험단 크롤링...")
    results = []
    urls = [
        ("https://www.modan.kr/matzip", "방문형"),
        ("https://www.modan.kr/beauty", "방문형"),
        ("https://www.modan.kr/delivery", "배송형"),
        ("https://www.modan.kr/product", "배송형"),
    ]
    try:
        for url, loc in urls:
            await page.goto(url, timeout=20000)
            await page.wait_for_timeout(2000)
            items = await page.query_selector_all("a[href]")
            for item in items[:20]:
                try:
                    href = await item.get_attribute("href") or ""
                    if not href or len(href) < 5: continue
                    link = "https://www.modan.kr" + href if href.startswith("/") else href
                    if "modan.kr" not in link: continue
                    text = await item.inner_text()
                    lines = [l.strip() for l in text.split('\n') if l.strip() and len(l.strip()) > 4]
                    if not lines: continue
                    title = max(lines, key=len)
                    if len(title) < 5: continue
                    img_el = await item.query_selector("img")
                    image = await img_el.get_attribute("src") if img_el else ""
                    if image and image.startswith("/"): image = "https://www.modan.kr" + image
                    results.append({
                        "title": clean(title), "reward": "", "platform": "모두의체험단",
                        "link": link, "image": image, "deadline": "",
                        "location": loc, "review_type": "블로그",
                        "applied": 0, "total": 10
                    })
                except: continue
    except Exception as e:
        print(f"  오류: {e}")
    seen = set()
    unique = [c for c in results if c["link"] not in seen and not seen.add(c["link"])]
    print(f"  ✅ {len(unique)}개")
    return unique


async def main():
    print("=" * 50)
    print("🎯 헌터뷰 Playwright 크롤러")
    print(f"⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 50)

    all_campaigns = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, args=["--no-sandbox"])
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800}
        )
        page = await context.new_page()

        all_campaigns += await crawl_assaview(page)
        all_campaigns += await crawl_pavlovu(page)
        all_campaigns += await crawl_dinnerqueen(page)
        all_campaigns += await crawl_mrblog(page)
        all_campaigns += await crawl_4blog(page)
        all_campaigns += await crawl_modan(page)

        await browser.close()

    # 중복 제거 & ID 부여
    seen = set()
    unique = []
    for c in all_campaigns:
        if c["link"] not in seen:
            seen.add(c["link"])
            unique.append(c)
    for i, c in enumerate(unique):
        c["id"] = i + 1

    print(f"\n📊 총 {len(unique)}개 수집 완료!")

    output = {
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "total": len(unique),
        "campaigns": unique
    }
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"💾 {OUTPUT_FILE} 저장 완료!")


if __name__ == "__main__":
    asyncio.run(main())
