import requests
import time
import os
import re
import sys
import argparse
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

API_URL = "https://nepallaws.com/wp-json/wp/v2/docs"

class LawScraper:
    def __init__(self, output_dir="."):
        self.output_dir = output_dir
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

    def get_soup(self, url):
        try:
            response = requests.get(url, headers=self.headers, timeout=20)
            response.raise_for_status()
            return BeautifulSoup(response.text, 'html.parser')
        except Exception as e:
            print(f"Error fetching {url}: {e}")
            return None

    def clean_html(self, html_content):
        if not html_content:
            return ""
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Remove style and script tags
        for s in soup(['style', 'script']):
            s.decompose()
            
        # Handle links (convert to simple text or markdown)
        for a in soup.find_all('a'):
            a.replace_with(a.get_text())

        # Handle paragraphs
        for p in soup.find_all('p'):
            p.append('\n\n')
        
        # Handle lists
        for li in soup.find_all('li'):
            li.insert(0, '- ')
            li.append('\n')
            
        # Handle tables (basic text conversion)
        for table in soup.find_all('table'):
            rows = []
            for tr in table.find_all('tr'):
                cols = [td.get_text(strip=True) for td in tr.find_all(['td', 'th'])]
                rows.append(" | ".join(cols))
            table.replace_with("\n" + "\n".join(rows) + "\n\n")

        text = soup.get_text()
        # Clean up excessive whitespace
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text.strip()

    def fetch_api_all(self, parent_id):
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
                if response.status_code == 400: # Often happens if page exceeds count
                    break
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
                print(f"  Error fetching API data for parent {parent_id}, page {page}: {e}")
                break
        return all_items

    def scrape_via_api(self, law_id, law_title, output_file):
        print(f"Scraping via API (ID: {law_id})...")
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(f"# {law_title}\n\n")
            f.write("---\n\n")

            # Recursive function to handle any level of nesting
            def process_level(parent_id, level=2):
                items = self.fetch_api_all(parent_id)
                prefix = "#" * level
                
                for item in items:
                    title = item['title']['rendered']
                    item_id = item['id']
                    print(f"  {'  ' * (level-2)}Processing: {title}")
                    
                    f.write(f"{prefix} {title}\n\n")
                    
                    content = self.clean_html(item['content']['rendered'])
                    if content:
                        f.write(content + "\n\n")
                    
                    # Recurse
                    process_level(item_id, level + 1)
                    
                    if level == 2:
                        f.write("\n---\n\n")
                    time.sleep(0.05)

            process_level(law_id)

    def scrape_via_html(self, url, law_title, output_file):
        print(f"Falling back to HTML scraping for {url}...")
        soup = self.get_soup(url)
        if not soup:
            return

        # Try to find sidebar links
        sidebar = soup.select('.ezd-scroll')
        links = []
        if sidebar:
            links = sidebar[0].select('a.nav-link')
        else:
            # Fallback: find any links that look like sections
            base_path = urlparse(url).path.strip('/')
            links = soup.find_all('a', href=re.compile(f'/{base_path}/'))

        processed_urls = []
        section_links = []
        for link in links:
            href = link.get('href')
            if href and href not in processed_urls:
                if href.strip('/') == url.strip('/'):
                    continue
                processed_urls.append(href)
                section_links.append((link.text.strip(), href))

        print(f"Found {len(section_links)} sections/chapters.")

        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(f"# {law_title}\n\n")
            f.write(f"Source: {url}\n\n---\n\n")

            for i, (title, s_url) in enumerate(section_links):
                print(f"[{i+1}/{len(section_links)}] Fetching: {title}")
                s_soup = self.get_soup(s_url)
                if not s_soup:
                    continue

                heading = s_soup.select_one('h1.ezd-title') or s_soup.select_one('h1')
                content_div = s_soup.select_one('.ezd-content') or s_soup.select_one('article') or s_soup.select_one('main')

                f.write(f"## {heading.text.strip() if heading else title}\n\n")
                if content_div:
                    f.write(self.clean_html(str(content_div)) + "\n\n")
                else:
                    f.write("*Content not found.*\n\n")
                
                f.write("---\n\n")
                time.sleep(0.2)

    def run(self, url, output_file=None):
        print(f"URL: {url}")
        soup = self.get_soup(url)
        if not soup:
            return

        # Extract Title
        title_tag = soup.find('title')
        law_title = title_tag.text.split('|')[0].strip() if title_tag else "Law Document"
        
        # Determine output filename if not provided
        if not output_file:
            safe_title = re.sub(r'[^\w\s-]', '', law_title).strip().lower()
            safe_title = re.sub(r'[-\s]+', '_', safe_title)
            output_file = os.path.join(self.output_dir, f"{safe_title}.md")

        # Check for Post ID
        postid_match = re.search(r'postid-(\d+)', str(soup))
        if postid_match:
            postid = postid_match.group(1)
            self.scrape_via_api(postid, law_title, output_file)
        else:
            self.scrape_via_html(url, law_title, output_file)

        print(f"\nDone! Saved to {output_file}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Unified Nepal Law Scraper")
    parser.add_argument("url", help="The URL of the law document to scrape")
    parser.add_argument("-o", "--output", help="Output filename (optional)")
    
    args = parser.parse_args()
    
    scraper = LawScraper()
    scraper.run(args.url, args.output)
