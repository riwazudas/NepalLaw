import requests
import time
from bs4 import BeautifulSoup

API_URL = "https://nepallaws.com/wp-json/wp/v2/docs"

LAWS = [
    {"id": 36664, "name": "constitution_2072_nepali.md", "title": "नेपालको संविधान २०७२"}
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
    all_items = []
    page = 1
    while True:
        params = {
            'parent': parent_id,
            'per_page': 100,
            'page': page,
            'orderby': 'menu_order',
            'order': 'asc'
        }
        try:
            response = requests.get(API_URL, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            if not data:
                break
            all_items.extend(data)
            if len(data) < 100:
                break
            page += 1
            time.sleep(0.1)
        except Exception as e:
            break
    return all_items

def extract_law(law_id, output_file, law_title):
    print(f"Extracting ID: {law_id}...")
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(f"# {law_title}\n\n")
        f.write("---\n\n")

        parts = fetch_all(law_id)

        for part in parts:
            p_title = part['title']['rendered']
            p_id = part['id']
            f.write(f"## {p_title}\n\n")
            
            p_content = clean_html(part['content']['rendered'])
            if p_content:
                f.write(p_content + "\n\n")
            
            articles = fetch_all(p_id)
            if articles:
                for article in articles:
                    a_title = article['title']['rendered']
                    a_id = article['id']
                    f.write(f"### {a_title}\n\n")
                    a_content = clean_html(article['content']['rendered'])
                    if a_content:
                        f.write(a_content + "\n\n")
                    
                    sub_levels = fetch_all(a_id)
                    if sub_levels:
                        for sub in sub_levels:
                            s_title = sub['title']['rendered']
                            f.write(f"#### {s_title}\n\n")
                            s_content = clean_html(sub['content']['rendered'])
                            if s_content:
                                f.write(s_content + "\n\n")
                            f.write("---\n\n")
                    
                    f.write("---\n\n")
            
            f.write("\n---\n\n")
            time.sleep(0.1)

if __name__ == "__main__":
    for law in LAWS:
        extract_law(law["id"], law["name"], law["title"])
    print("Done!")
