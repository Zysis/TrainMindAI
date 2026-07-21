"""Quick end-to-end test: scrape 2 exercises and verify DB + media."""
import os
import sys
import json

# Limit scraper to only first 3 categories for testing
import scraper
from database import init_db, get_connection, export_to_json

# Clean up previous test data
for f in ["exercises.db", "exercises.json"]:
    path = os.path.join(os.path.dirname(__file__), f)
    if os.path.exists(path):
        os.remove(path)


def test_end_to_end():
    print("=== E2E Test: 3 categories, then 2 exercises ===\n")

    # Phase 1: Get categories from sitemap (only first 3)
    cats = scraper.get_category_urls_from_sitemap()
    if not cats:
        print("FAIL: no categories found")
        return False
    print(f"OK: {len(cats)} categories found, testing first 3\n")

    # Phase 2: Collect exercise links from 3 categories
    all_links = {}
    for cat_url in cats[:3]:
        links = scraper.collect_exercise_links_from_category(cat_url)
        for lk in links:
            all_links[lk["slug"]] = lk
        print(f"  {cat_url.split('/')[-1]}: {len(links)} exercises")

    links_list = list(all_links.values())
    print(f"\nUnique exercises from 3 categories: {len(links_list)}")
    if not links_list:
        print("FAIL: no exercise links found")
        return False

    # Phase 3: Scrape first 2 exercise detail pages + download media
    init_db()
    conn = get_connection()
    test_links = links_list[:2]

    for lk in test_links:
        print(f"\n--- Scraping: {lk['slug']} ---")
        success = scraper.process_single_exercise(lk, conn)
        print(f"  Result: {'OK' if success else 'FAIL'}")

    # Phase 4: Verify DB
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) as cnt FROM exercises")
    count = cur.fetchone()["cnt"]
    print(f"\nExercises in DB: {count}")

    cur.execute("SELECT name, slug, difficulty, equipment, primary_muscle_group_id, image_path, gif_path FROM exercises")
    for row in cur.fetchall():
        print(f"  {dict(row)}")

    cur.execute("SELECT * FROM muscle_groups")
    for row in cur.fetchall():
        print(f"  Muscle group: {dict(row)}")

    # Phase 5: Export JSON
    json_path = export_to_json()
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    print(f"\nJSON export: {len(data)} exercises")
    if data:
        print(f"  Sample keys: {list(data[0].keys())}")
        print(f"  First exercise name: {data[0].get('name')}")

    conn.close()
    print("\n=== Test complete ===")
    return count > 0


if __name__ == "__main__":
    ok = test_end_to_end()
    sys.exit(0 if ok else 1)
