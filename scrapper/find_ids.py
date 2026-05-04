import requests
import re

urls = [
    'https://nepallaws.com/Laws/the-contribution-based-social-security-act-2074/',
    'https://nepallaws.com/Laws/%e0%a4%b8%e0%a4%be%e0%a4%ae%e0%a4%be%e0%a4%9c%e0%a4%bf%e0%a4%95-%e0%a4%b8%e0%a5%81%e0%a4%b0%e0%a4%95%e0%a5%8d%e0%a4%b7%e0%a4%be-%e0%a4%90%e0%a4%a8-%e0%a5%a8%e0%a5%a6%e0%a5%ad%e0%a5%ab/'
]

for url in urls:
    try:
        r = requests.get(url, timeout=20)
        m = re.search(r'postid-(\d+)', r.text)
        print(f"{url}: {m.group(1) if m else 'Not found'}")
    except Exception as e:
        print(f"{url}: Error - {e}")
