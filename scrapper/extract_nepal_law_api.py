import requests
import time
from bs4 import BeautifulSoup
import re

API_URL = "https://nepallaws.com/wp-json/wp/v2/docs"
MAIN_DOC_ID = 2247
OUTPUT_FILE = "companies_act_2063.md"

def clean_html(html_content):
    if not html_content:
        return ""
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Remove any style or script tags
    for s in soup(['style', 'script']):
        s.decompose()
        
    # Process the text
    # Convert <p> tags to double newlines
    for p in soup.find_all('p'):
        p.append('\n\n')
    
    # Convert <li> tags to bullet points
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
    print(f"Starting API extraction for Companies Act (ID: {MAIN_DOC_ID})...")
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write("# Companies Act 2063 (2006)\n\n")
        f.write("Source: https://nepallaws.com/Laws/companies-act-2063-2006/\n\n---\n\n")

        # Get top-level children (Preamble, Chapters)
        top_level = fetch_all(MAIN_DOC_ID)
        print(f"Found {len(top_level)} top-level items (Chapters/Preamble).")

        for item in top_level:
            title = item['title']['rendered']
            item_id = item['id']
            print(f"Processing: {title} (ID: {item_id})")
            
            f.write(f"## {title}\n\n")
            
            # Check if this item has content itself (like Preamble)
            content = clean_html(item['content']['rendered'])
            if content:
                f.write(content + "\n\n")
            
            # Fetch sections for this chapter
            sections = fetch_all(item_id)
            if sections:
                print(f"  -> Found {len(sections)} sections.")
                for section in sections:
                    s_title = section['title']['rendered']
                    print(f"    - Fetching section: {s_title}")
                    f.write(f"### {s_title}\n\n")
                    
                    s_content = clean_html(section['content']['rendered'])
                    if s_content:
                        f.write(s_content + "\n\n")
                    else:
                        f.write("*[No content found for this section]*\n\n")
                    
                    f.write("---\n\n")
            
            f.write("\n---\n\n")
            time.sleep(0.2) # Minor delay

    print(f"\nExtraction complete! Saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    extract_all()
