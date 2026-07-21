import os
import re
import json
import logging
import time
import sys
from urllib.parse import urlparse
from typing import Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

from curl_cffi import requests as cffi_requests

from database import init_db, get_connection, upsert_exercise, exercise_exists, export_to_json


# cd excercise_web_scraper
# pip install -r requirements.txt
# python scraper.py

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BASE_URL = "https://musclewiki.com"
INTERNAL_DOMAIN = "http://api:8000"
IMAGES_DIR = os.path.join(os.path.dirname(__file__), "images")
CACHE_DIR = os.path.join(os.path.dirname(__file__), "_cache")
REQUEST_DELAY = 0.5       # seconds between requests (politeness)
MAX_RETRIES = 3
DOWNLOAD_WORKERS = 4      # parallel media download threads

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("scraper")


# ---------------------------------------------------------------------------
# HTTP helpers (curl_cffi bypasses Cloudflare)
# ---------------------------------------------------------------------------
def fetch(url: str, retries: int = MAX_RETRIES) -> Optional[str]:
    """Fetch a URL using curl_cffi with Chrome TLS impersonation."""
    for attempt in range(1, retries + 1):
        try:
            resp = cffi_requests.get(url, impersonate="chrome", timeout=30)
            if resp.status_code == 200 and "been blocked" not in resp.text[:500].lower():
                return resp.text
            if "been blocked" in resp.text[:500].lower():
                log.warning("Blocked by Cloudflare on attempt %d: %s", attempt, url)
            else:
                log.warning("HTTP %d on attempt %d: %s", resp.status_code, attempt, url)
        except Exception as e:
            log.warning("Request error on attempt %d for %s: %s", attempt, url, e)
        time.sleep(REQUEST_DELAY * attempt)
    return None


def download_file(url: str, dest: str) -> Optional[str]:
    """Download a binary file. Returns local path on success."""
    if not url:
        return None
    if os.path.exists(dest):
        return dest
    try:
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        resp = cffi_requests.get(url, impersonate="chrome", timeout=60)
        if resp.status_code != 200:
            log.warning("Download failed (%d): %s", resp.status_code, url)
            return None
        with open(dest, "wb") as f:
            f.write(resp.content)
        return dest
    except Exception as e:
        log.warning("Download error for %s: %s", url, e)
        return None


def sanitize_filename(name: str) -> str:
    name = re.sub(r'[<>:"/\\|?*]', "_", name)
    name = re.sub(r"\s+", "_", name).strip("_")
    return name[:200]


# ---------------------------------------------------------------------------
# Phase 1 – Collect all exercise URLs
# ---------------------------------------------------------------------------
def get_category_urls_from_sitemap() -> list[str]:
    """Parse sitemap.xml to get all Italian muscle-group category page URLs."""
    log.info("Fetching sitemap...")
    xml = fetch(f"{BASE_URL}/sitemap.xml")
    if not xml:
        log.error("Failed to fetch sitemap")
        return []

    raw_urls = re.findall(r"<loc>(.*?)</loc>", xml)
    log.info("Sitemap contains %d URLs total", len(raw_urls))

    category_urls = []
    for u in raw_urls:
        fixed = u.replace(INTERNAL_DOMAIN, BASE_URL)
        # Match /it-it/exercises/{slug} but not /it-it/exercises alone
        if re.match(r".*/it-it/exercises/[a-z]", fixed):
            category_urls.append(fixed)

    log.info("Found %d Italian category pages", len(category_urls))
    return category_urls


def collect_exercise_links_from_category(cat_url: str) -> list[dict]:
    """Fetch a category page and extract exercise detail links + basic info."""
    html = fetch(cat_url)
    if not html:
        return []

    # The category slug is the muscle group name
    muscle_group = cat_url.rstrip("/").split("/")[-1]

    # Extract individual exercise links: /it-it/exercise/{slug}
    links = re.findall(r'href="(/it-it/exercise/([^"]+))"', html)

    results = []
    seen = set()
    for path, slug in links:
        if slug in seen:
            continue
        seen.add(slug)
        url = f"{BASE_URL}{path}"
        results.append({
            "url": url,
            "slug": slug,
            "muscle_group_source": muscle_group,
        })

    return results


def collect_all_exercise_links(category_urls: list[str]) -> list[dict]:
    """Scrape all category pages to collect unique exercise URLs."""
    all_exercises = {}
    total = len(category_urls)

    for i, cat_url in enumerate(category_urls):
        exercises = collect_exercise_links_from_category(cat_url)
        new_count = 0
        for ex in exercises:
            if ex["slug"] not in all_exercises:
                all_exercises[ex["slug"]] = ex
                new_count += 1

        log.info(
            "[%d/%d] %s -> %d links (%d new) | Total unique: %d",
            i + 1, total,
            cat_url.split("/")[-1],
            len(exercises), new_count,
            len(all_exercises),
        )
        time.sleep(REQUEST_DELAY)

    return list(all_exercises.values())


# ---------------------------------------------------------------------------
# Phase 2 – Scrape exercise detail pages (schema.org + media URLs)
# ---------------------------------------------------------------------------
def extract_schema_org(html: str) -> list[dict]:
    """Extract JSON-LD schema.org objects from HTML."""
    pattern = r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>'
    matches = re.findall(pattern, html, re.DOTALL)
    results = []
    for m in matches:
        try:
            results.append(json.loads(m))
        except (json.JSONDecodeError, ValueError):
            pass
    return results


def scrape_exercise_detail(url: str, slug: str, muscle_group_hint: str) -> Optional[dict]:
    """Fetch an exercise detail page and extract all data."""
    html = fetch(url)
    if not html:
        return None

    data = {
        "name": "",
        "slug": slug,
        "url": url,
        "description": "",
        "difficulty": "",
        "equipment": "",
        "primary_muscle_group": muscle_group_hint.replace("-", " ").title(),
        "secondary_muscles": [],
        "steps": [],
        "image_urls": [],
        "video_urls": [],
    }

    # 1. Extract from schema.org ExerciseAction (most reliable source)
    schemas = extract_schema_org(html)
    for s in schemas:
        if s.get("@type") == "ExerciseAction":
            data["name"] = s.get("name", "")
            data["description"] = s.get("description", "")
            data["difficulty"] = s.get("difficulty", "")
            data["equipment"] = s.get("exerciseType", "") or s.get("equipment", "")
            if s.get("muscleGroup"):
                mg = s["muscleGroup"]
                if isinstance(mg, list):
                    data["primary_muscle_group"] = mg[0] if mg else ""
                else:
                    data["primary_muscle_group"] = str(mg)
            if s.get("secondaryMuscleGroups"):
                sec = s["secondaryMuscleGroups"]
                if isinstance(sec, list):
                    data["secondary_muscles"] = sec
                elif isinstance(sec, str):
                    data["secondary_muscles"] = [sec]
            break

    # 2. Extract steps from HTML (numbered instructions)
    step_matches = re.findall(
        r'<li[^>]*>\s*(?:<[^>]+>)*\s*(\d+)\s*(.+?)\s*</li>',
        html, re.DOTALL
    )
    if step_matches:
        data["steps"] = [
            re.sub(r"<[^>]+>", "", f"{num}. {text}").strip()
            for num, text in step_matches
        ]

    # Fallback: extract steps from schema description HTML
    if not data["steps"] and data["description"]:
        li_steps = re.findall(r"<li>(.*?)</li>", data["description"])
        if li_steps:
            data["steps"] = [re.sub(r"<[^>]+>", "", s).strip() for s in li_steps if len(s.strip()) > 5]

    # 3. Extract media URLs from HTML
    data["video_urls"] = list(set(
        re.findall(r'(https://media\.musclewiki\.com/[^"\'\s]+\.mp4)', html)
    ))
    data["image_urls"] = list(set(
        re.findall(r'(https://media\.musclewiki\.com/[^"\'\s]+\.(?:jpg|jpeg|png|webp))', html)
    ))

    # Fallback name from slug
    if not data["name"]:
        data["name"] = slug.replace("-", " ").title()

    # Clean description: strip HTML tags for DB storage
    if data["description"]:
        data["description"] = re.sub(r"<[^>]+>", " ", data["description"])
        data["description"] = re.sub(r"\s+", " ", data["description"]).strip()

    return data


# ---------------------------------------------------------------------------
# Phase 3 – Download media files
# ---------------------------------------------------------------------------
def download_exercise_media(exercise: dict) -> tuple[Optional[str], Optional[str]]:
    """Download images and videos for an exercise. Returns (image_path, video_path)."""
    group = exercise.get("primary_muscle_group", "uncategorized")
    group_dir = sanitize_filename(group) if group else "uncategorized"
    dest_dir = os.path.join(IMAGES_DIR, group_dir)
    os.makedirs(dest_dir, exist_ok=True)

    slug = exercise["slug"]
    base_dir = os.path.dirname(__file__)
    image_path = None
    video_path = None

    # Download images (body maps, OG images)
    for i, img_url in enumerate(exercise.get("image_urls", [])):
        ext = os.path.splitext(urlparse(img_url).path)[1] or ".jpg"
        fname = f"{sanitize_filename(slug)}{f'_{i}' if i > 0 else ''}{ext}"
        dest = os.path.join(dest_dir, fname)
        result = download_file(img_url, dest)
        if result and image_path is None:
            image_path = os.path.relpath(result, base_dir)

    # Download videos (mp4 demonstrations)
    for i, vid_url in enumerate(exercise.get("video_urls", [])):
        fname = f"{sanitize_filename(slug)}{f'_{i}' if i > 0 else ''}.mp4"
        dest = os.path.join(dest_dir, fname)
        result = download_file(vid_url, dest)
        if result and video_path is None:
            video_path = os.path.relpath(result, base_dir)

    return image_path, video_path


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------
def save_links_cache(links: list[dict]) -> str:
    os.makedirs(CACHE_DIR, exist_ok=True)
    path = os.path.join(CACHE_DIR, "exercise_links.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(links, f, ensure_ascii=False, indent=2)
    return path


def load_links_cache() -> Optional[list[dict]]:
    path = os.path.join(CACHE_DIR, "exercise_links.json")
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def process_single_exercise(link: dict, conn) -> bool:
    """Process one exercise: scrape detail + download media + save to DB."""
    slug = link["slug"]

    if exercise_exists(conn, slug):
        return False

    detail = scrape_exercise_detail(
        link["url"], slug, link.get("muscle_group_source", "")
    )
    if not detail:
        log.warning("Failed to scrape: %s", slug)
        return False

    # Download media
    image_path, video_path = download_exercise_media(detail)
    detail["image_path"] = image_path
    detail["gif_path"] = video_path
    detail["video_url"] = detail["video_urls"][0] if detail.get("video_urls") else None

    # Save to database
    upsert_exercise(conn, detail)
    log.info("Saved: %s", detail["name"])
    return True


def main():
    log.info("=== MuscleWiki Exercise Scraper ===")
    start_time = time.time()

    init_db()
    conn = get_connection()
    log.info("Database initialized")

    # Phase 1: Collect exercise links
    links = load_links_cache()
    if links:
        log.info("Loaded %d exercise links from cache", len(links))
    else:
        log.info("--- Phase 1: Collecting exercise links from category pages ---")
        category_urls = get_category_urls_from_sitemap()
        if not category_urls:
            log.error("No category URLs found. Exiting.")
            return
        links = collect_all_exercise_links(category_urls)
        cache_path = save_links_cache(links)
        log.info("Cached %d exercise links to %s", len(links), cache_path)

    if not links:
        log.error("No exercise links found. Exiting.")
        conn.close()
        return

    # Phase 2 & 3: Scrape details + download media
    log.info("--- Phase 2: Scraping %d exercise details ---", len(links))
    saved = 0
    skipped = 0
    failed = 0

    for i, link in enumerate(links):
        slug = link["slug"]

        if exercise_exists(conn, slug):
            skipped += 1
            continue

        try:
            success = process_single_exercise(link, conn)
            if success:
                saved += 1
            else:
                failed += 1
        except Exception as e:
            log.error("Error processing %s: %s", slug, e)
            failed += 1

        if (i + 1) % 25 == 0:
            log.info(
                "Progress: %d/%d (saved=%d, skipped=%d, failed=%d)",
                i + 1, len(links), saved, skipped, failed,
            )

        time.sleep(REQUEST_DELAY)

    log.info("Scraping complete: saved=%d, skipped=%d, failed=%d", saved, skipped, failed)

    # Phase 4: Export JSON
    log.info("--- Phase 3: Exporting JSON ---")
    json_path = export_to_json()
    log.info("JSON exported to: %s", json_path)

    conn.close()
    elapsed = time.time() - start_time
    log.info("=== Done! Elapsed: %.1f minutes ===", elapsed / 60)


if __name__ == "__main__":
    main()
