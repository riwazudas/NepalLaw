import requests
import time
from bs4 import BeautifulSoup

API_URL = "https://nepallaws.com/wp-json/wp/v2/docs"

LAWS = [
    {"id": 25735, "name": "fitta_act_2075_english.md", "title": "Foreign Investment and Technology Transfer Act, 2075 (2019)"},
    {"id": 25514, "name": "fitta_act_2075_nepali.md", "title": "विदेशी लगानी तथा प्रविधि हस्तान्तरण ऐन, २०७५"}
]

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

def extract_law(law_id, output_file, law_title):
    print(f"Starting extraction for ID: {law_id}...")
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(f"# {law_title}\n\n")
        f.write("---\n\n")

        top_level = fetch_all(law_id)
        print(f"Found {len(top_level)} top-level items.")

        for item in top_level:
            title = item['title']['rendered']
            item_id = item['id']
            print(f"Processing item ID: {item_id}")
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
            time.sleep(0.1)

    print(f"Extraction complete! Saved to {output_file}\n")

if __name__ == "__main__":
    for law in LAWS:
        extract_law(law["id"], law["name"], law["title"])
