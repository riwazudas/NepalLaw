import requests

url = 'https://nepallaws.com/Laws/%e0%a4%ac%e0%a5%8b%e0%a4%a8%e0%a4%b8-%e0%a4%90%e0%a4%a8-%e0%a5%a8%e0%a5%a6%e0%a5%a3%e0%a5%a6/'
try:
    r = requests.get(url, timeout=20, allow_redirects=True)
    print(f"URL: {r.url}")
    print(f"Status: {r.status_code}")
    print(r.text[:2000])
except Exception as e:
    print(f"Error: {e}")
