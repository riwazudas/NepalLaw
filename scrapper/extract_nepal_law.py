import requests
from bs4 import BeautifulSoup
import time
import os
import re

def get_soup(url):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        return BeautifulSoup(response.text, 'html.parser')
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None

def extract_law(main_url, output_file):
    print(f"Starting extraction from {main_url}...")
    soup = get_soup(main_url)
    if not soup:
        print("Failed to fetch main page.")
        return

    # Find all links in the sidebar
    # The subagent identified '.ezd-scroll a.nav-link'
    sidebar = soup.select('.ezd-scroll')
    if not sidebar:
        print("Sidebar not found. Trying alternative selection...")
        # Fallback to looking for all links that might be sections
        links = soup.find_all('a', href=re.compile(r'/Laws/companies-act-2063-2006/'))
    else:
        links = sidebar[0].select('a.nav-link')

    # Collect unique URLs in order
    processed_urls = []
    section_links = []
    
    for link in links:
        url = link.get('href')
        if url and url not in processed_urls:
            # Skip the main index itself if it appears
            if url.strip('/') == main_url.strip('/'):
                continue
            processed_urls.append(url)
            section_links.append((link.text.strip(), url))

    print(f"Found {len(section_links)} sections/chapters.")

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(f"# Companies Act 2063 (2006)\n\n")
        f.write(f"Source: {main_url}\n\n---\n\n")

        for i, (title, url) in enumerate(section_links):
            print(f"[{i+1}/{len(section_links)}] Fetching: {title}")
            
            # Simple retry logic
            section_soup = None
            for _ in range(3):
                section_soup = get_soup(url)
                if section_soup:
                    break
                time.sleep(2)
            
            if not section_soup:
                f.write(f"\n\n## {title}\n\n*Error: Could not fetch content for this section.*\n\n")
                continue

            # Extract content
            # Based on subagent: h1.ezd-title and .ezd-content
            heading = section_soup.select_one('h1.ezd-title')
            content_div = section_soup.select_one('.ezd-content')

            if heading:
                # Use the heading from the page if available
                f.write(f"## {heading.text.strip()}\n\n")
            else:
                f.write(f"## {title}\n\n")

            if content_div:
                # Clean up the content
                # Remove any print buttons or internal nav if they are inside .ezd-content
                # Usually ezd-content is pretty clean.
                
                # Convert html to markdown-like text
                for p in content_div.find_all(['p', 'div', 'table', 'li']):
                    # Handle tables if they exist
                    if p.name == 'table':
                        # Simple table conversion (optional, but good for completeness)
                        f.write("\n" + p.get_text(separator=' ', strip=True) + "\n")
                    else:
                        text = p.get_text().strip()
                        if text:
                            f.write(text + "\n\n")
            else:
                f.write("*Content not found in expected container.*\n\n")

            f.write("---\n\n")
            
            # Be nice to the server
            time.sleep(0.5)

    print(f"Extraction complete! Saved to {output_file}")

if __name__ == "__main__":
    url = "https://nepallaws.com/Laws/companies-act-2063-2006/"
    output = "companies_act_2063.md"
    extract_law(url, output)
