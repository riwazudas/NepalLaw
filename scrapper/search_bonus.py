import requests
import json

url = 'https://nepallaws.com/wp-json/wp/v2/docs?search=बोनस'
r = requests.get(url)
data = r.json()

results = []
for d in data:
    results.append({
        "id": d["id"],
        "title": d["title"]["rendered"],
        "link": d["link"]
    })

with open('search_results.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, ensure_ascii=False, indent=2)
