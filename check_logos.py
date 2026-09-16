import httpx
r = httpx.get("https://iptv-org.github.io/iptv/countries/us.m3u")
lines = r.text.splitlines()
c = 0
for l in lines:
    if l.startswith("#EXTINF"):
        print(l)
        c += 1
        if c > 5: break
