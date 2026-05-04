import requests
url = "https://nepallaws.com/Laws/companies-act-2063-2006/laws-chapter-1-preliminary-2251/short-title-and-commencement-2493/"
headers = {'User-Agent': 'Mozilla/5.0'}
r = requests.get(url, headers=headers)
print(r.text[:2000])
if ".ezd-content" in r.text:
    print("\nFOUND .ezd-content")
else:
    print("\nNOT FOUND .ezd-content")
