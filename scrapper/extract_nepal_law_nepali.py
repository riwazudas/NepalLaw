import requests
import time
from bs4 import BeautifulSoup
import re

API_URL = "https://nepallaws.com/wp-json/wp/v2/docs"
MAIN_DOC_ID = 17287
OUTPUT_FILE = "companies_act_2063_nepali.md"

def clean_html(html_content):
    if not html_content:
        return ""
    soup = BeautifulSoup(html_content, 'html.parser')
    for s in soup(['style', 'script']):
        s.decompose()
    for p in soup.find_all('p'):
        p.append('\n\n')
    for li in soup.find_all('li'):
        li.insert(0, '- ')
        li.append('\n')
    return soup.get_text().strip()

def fetch_all(parent_id):
    params = {
        'parent': parent_id,
        'per_page': 100,
        'orderby': 'menu_order',
        'order': 'asc'
    }
    try:
        response = requests.get(API_URL, params=params, timeout=20)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error fetching children of {parent_id}: {e}")
        return []

def extract_all():
    print(f"Starting API extraction for Companies Act Nepali (ID: {MAIN_DOC_ID})...")
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write("# कम्पनी ऐन, २०६३\n\n")
        f.write("Source: https://nepallaws.com/Laws/%e0%a4%95%e0%a4%ae%e0%a5%8d%e0%a4%aa%e0%a4%a8%e0%a5%80-%e0%a4%90%e0%a4%a8-%e0%a5%a8%e0%a5%a6%e0%a5%ac%e0%a5%a9/\n\n---\n\n")

        top_level = fetch_all(MAIN_DOC_ID)
        print(f"Found {len(top_level)} top-level items.")

        for item in top_level:
            title = item['title']['rendered']
            item_id = item['id']
            f.write(f"## {title}\n\n")
            
            content = clean_html(item['content']['rendered'])
            if content:
                f.write(content + "\n\n")
            
            sections = fetch_all(item_id)
            if sections:
                for section in sections:
                    s_title = section['title']['rendered']
                    f.write(f"### {s_title}\n\n")
                    s_content = clean_html(section['content']['rendered'])
                    if s_content:
                        f.write(s_content + "\n\n")
                    f.write("---\n\n")
            
            f.write("\n---\n\n")
            time.sleep(0.2)

    print(f"\nExtraction complete! Saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    extract_all()
