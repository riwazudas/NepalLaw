import requests
import time
from bs4 import BeautifulSoup

API_URL = "https://nepallaws.com/wp-json/wp/v2/docs"

LAWS = [
    {"id": 38848, "name": "social_security_act_2074_english.md", "title": "Contribution-based Social Security Act, 2074 (2017)"},
    {"id": 38607, "name": "social_security_act_2074_nepali.md", "title": "योगदानमा आधारित सामाजिक सुरक्षा ऐन, २०७४"}
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
        return []

def extract_law(law_id, output_file, law_title):
    print(f"Extracting ID: {law_id} to {output_file}")
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(f"# {law_title}\n\n")
        f.write("---\n\n")

        top_level = fetch_all(law_id)

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
            time.sleep(0.1)

if __name__ == "__main__":
    for law in LAWS:
        extract_law(law["id"], law["name"], law["title"])
    print("Done!")
