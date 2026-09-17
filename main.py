from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import httpx
import uvicorn
import os
import re
import time
from pathlib import Path
from typing import List, Dict, Any
import asyncio

app = FastAPI(title="Free TV App")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

HEALTH_CACHE = {}  # url -> (is_working, timestamp)
CACHE_TTL = 600    # 10 minutes cache

async def check_stream_health(client: httpx.AsyncClient, channel: dict) -> dict:
    url = channel.get('url')
    if not url:
        channel['working'] = False
        return channel
    
    # Check cache first
    now = time.time()
    if url in HEALTH_CACHE:
        is_working, ts = HEALTH_CACHE[url]
        if now - ts < CACHE_TTL:
            channel['working'] = is_working
            return channel
            
    try:
        # Quick stream GET request to read headers without downloading video body
        async with client.stream("GET", url, timeout=2.5, follow_redirects=True) as response:
            is_working = response.status_code < 400 or response.status_code in [401, 403, 405]
    except Exception:
        is_working = False
        
    HEALTH_CACHE[url] = (is_working, now)
    channel['working'] = is_working
    return channel

async def filter_working_channels(channels: list, max_verify: int = 80) -> list:
    if not channels:
        return []
        
    channels_to_verify = channels[:max_verify]
    
    limits = httpx.Limits(max_connections=100, max_keepalive_connections=20)
    async with httpx.AsyncClient(limits=limits, verify=False) as client:
        tasks = [check_stream_health(client, dict(c)) for c in channels_to_verify]
        results = await asyncio.gather(*tasks)
        
    working = [c for c in results if c.get('working')]
    
    # If stream health check returned working streams, return only working ones
    if len(working) >= 2:
        return working
    # Fallback to first 40 channels if verification timed out on all
    return channels[:40]

def parse_m3u(content: str):
    channels = []
    current_channel = {}
    
    attr_pattern = re.compile(r'([\w-]+)="([^"]*)"')
    
    for line in content.splitlines():
        line = line.strip()
        if not line:
            continue
        
        if line.startswith("#EXTINF:"):
            current_channel = {}
            parts = line.split(',', 1)
            name = parts[1].strip() if len(parts) > 1 else "Unknown"
            current_channel['name'] = name
            
            attrs = attr_pattern.findall(parts[0])
            for key, value in attrs:
                current_channel[key] = value
                
        elif not line.startswith("#"):
            if "name" in current_channel:
                current_channel["url"] = line
                channels.append(current_channel)
                current_channel = {}
                
    return channels

GLOBAL_CHANNELS = []
GLOBAL_CHANNELS_LOADED = False

CUSTOM_LK_CHANNELS = [
    {
        "name": "Sirasa TV",
        "tvg-logo": "https://upload.wikimedia.org/wikipedia/en/thumb/0/07/Sirasa_TV_logo.png/250px-Sirasa_TV_logo.png",
        "group-title": "General",
        "url": "https://edge2-moblive.yuppcdn.net/transsd/smil:sirtv09.smil/playlist.m3u8"
    },
    {
        "name": "TV Derana",
        "tvg-logo": "https://upload.wikimedia.org/wikipedia/en/d/db/TV_Derana_Logo.png",
        "group-title": "General",
        "url": "https://edge3-moblive.yuppcdn.net/transhd2/smil:detv04.smil/index.m3u8"
    },
    {
        "name": "ITN",
        "tvg-logo": "https://upload.wikimedia.org/wikipedia/en/3/30/Independent_Television_Network.png",
        "group-title": "General",
        "url": "https://edge4-moblive.yuppcdn.net/transsd/smil:itn43.smil/playlist.m3u8"
    },
    {
        "name": "Hiru TV",
        "tvg-logo": "https://upload.wikimedia.org/wikipedia/en/thumb/a/ae/Hiru_TV_logo.png/250px-Hiru_TV_logo.png",
        "group-title": "General",
        "url": "https://edge4-moblive.yuppcdn.net/transhd2/smil:hitv17.smil/index.m3u8"
    }
]

async def get_global_channels() -> List[Dict[str, Any]]:
    global GLOBAL_CHANNELS, GLOBAL_CHANNELS_LOADED
    if GLOBAL_CHANNELS_LOADED:
        return GLOBAL_CHANNELS
        
    url = "https://iptv-org.github.io/iptv/index.m3u"
    async with httpx.AsyncClient() as client:
        response = await client.get(url, timeout=120.0)
        response.raise_for_status()
        GLOBAL_CHANNELS = parse_m3u(response.text)
        GLOBAL_CHANNELS.extend(CUSTOM_LK_CHANNELS)
        GLOBAL_CHANNELS_LOADED = True
    return GLOBAL_CHANNELS

@app.get("/api/countries")
async def get_countries():
    url = "https://iptv-org.github.io/api/countries.json"
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, timeout=10.0)
            response.raise_for_status()
            countries = response.json()
            countries.sort(key=lambda x: x.get('name', ''))
            countries.insert(0, {"name": "🏏 Global Sports (Live Cricket First)", "code": "SPORTS"})
            countries.insert(1, {"name": "📻 Global Radio", "code": "RADIO"})
            return countries
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch countries: {str(e)}")

@app.get("/api/channels/{country_code}")
async def get_channels(country_code: str):
    is_country = country_code.upper() not in ["SPORTS", "RADIO"]
    
    if country_code.upper() == "SPORTS":
        url = "https://iptv-org.github.io/iptv/categories/sports.m3u"
    elif country_code.upper() == "RADIO":
        url = "https://iptv-org.github.io/iptv/categories/music.m3u"
    else:
        url = f"https://iptv-org.github.io/iptv/countries/{country_code.lower()}.m3u"
        
    async def fetch_tv(client):
        try:
            response = await client.get(url, timeout=20.0)
            if response.status_code == 404:
                return []
            response.raise_for_status()
            return parse_m3u(response.text)
        except Exception:
            return []

    async def fetch_radio(client):
        if not is_country:
            return []
        radio_url = f"https://de1.api.radio-browser.info/json/stations/bycountrycodeexact/{country_code.upper()}?limit=100&hidebroken=true&order=clickcount&reverse=true"
        try:
            response = await client.get(radio_url, timeout=10.0)
            if response.status_code == 200:
                stations = response.json()
                radio_channels = []
                for s in stations:
                    stream_url = s.get('url_resolved') or s.get('url')
                    if stream_url:
                        name = s.get('name', 'Unknown Radio').strip()
                        radio_channels.append({
                            "name": f"📻 {name}",
                            "tvg-logo": s.get('favicon', ''),
                            "group-title": "Radio",
                            "url": stream_url
                        })
                return radio_channels
        except Exception as ex:
            print(f"Failed to fetch radio: {ex}")
        return []

    async with httpx.AsyncClient() as client:
        try:
            if is_country:
                tv_channels, radio_channels = await asyncio.gather(fetch_tv(client), fetch_radio(client))
                channels = tv_channels + radio_channels
                if not channels:
                    return []
            else:
                response = await client.get(url, timeout=20.0)
                if response.status_code == 404:
                    return []
                response.raise_for_status()
                channels = parse_m3u(response.text)
            
            if country_code.lower() == "lk":
                channels = CUSTOM_LK_CHANNELS + channels
                
            if country_code.upper() == "SPORTS":
                cricket_keywords = ["cricket", "star sports", "willow", "fox cricket", "ptv sports", "ten sports", "sky sports"]
                def sort_key(c):
                    name = c.get('name', '').lower()
                    if any(kw in name for kw in cricket_keywords):
                        return 0
                    return 1
                channels.sort(key=sort_key)

            # Filter channels by checking live stream health before returning
            working_channels = await filter_working_channels(channels, max_verify=80)
            return working_channels
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch channels: {str(e)}")

@app.get("/api/search")
async def search_channels(q: str):
    if not q or len(q) < 2:
        return []
        
    try:
        channels = await get_global_channels()
        q_lower = q.lower()
        results = [c for c in channels if q_lower in c.get('name', '').lower()]
        working_results = await filter_working_channels(results[:60], max_verify=60)
        return working_results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@app.get("/api/parse_m3u_url")
async def parse_m3u_url(url: str):
    if not url:
        raise HTTPException(status_code=400, detail="URL parameter required")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, timeout=15.0, follow_redirects=True)
            response.raise_for_status()
            channels = parse_m3u(response.text)
            working_channels = await filter_working_channels(channels, max_verify=80)
            return working_channels
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch M3U playlist: {str(e)}")

PRESET_PLAYLISTS = [
    {"id": "sports", "name": "🏆 Global Sports & Cricket", "icon": "fa-trophy", "category": "Sports", "url": "https://iptv-org.github.io/iptv/categories/sports.m3u", "description": "Live Sports, Cricket, Football, Tennis & Racing"},
    {"id": "movies", "name": "🎬 Movies & Cinema", "icon": "fa-film", "category": "Movies", "url": "https://iptv-org.github.io/iptv/categories/movies.m3u", "description": "24/7 Movie Channels, Blockbusters & Classic Cinema"},
    {"id": "news", "name": "📰 World News 24/7", "icon": "fa-newspaper", "category": "News", "url": "https://iptv-org.github.io/iptv/categories/news.m3u", "description": "Breaking International News & Financial Updates"},
    {"id": "music", "name": "🎶 Music & Radio", "icon": "fa-music", "category": "Music", "url": "https://iptv-org.github.io/iptv/categories/music.m3u", "description": "Live Music Videos, Concerts & Global Radio Streams"},
    {"id": "kids", "name": "🧸 Kids & Animation", "icon": "fa-child", "category": "Kids", "url": "https://iptv-org.github.io/iptv/categories/animation.m3u", "description": "Cartoons, Animated Series & Children Shows"},
    {"id": "docs", "name": "📚 Science & Documentaries", "icon": "fa-book-atlas", "category": "Documentaries", "url": "https://iptv-org.github.io/iptv/categories/documentary.m3u", "description": "Nature, History, Science & Discovery Streams"},
    {"id": "series", "name": "🍿 Entertainment & Shows", "icon": "fa-tv", "category": "Entertainment", "url": "https://iptv-org.github.io/iptv/categories/entertainment.m3u", "description": "Drama, Comedy, Reality TV & Variety Shows"},
    {"id": "lk", "name": "🇱🇰 Sri Lanka TV & Radio", "icon": "fa-flag", "category": "Regional", "url": "https://iptv-org.github.io/iptv/countries/lk.m3u", "description": "Sirasa, Derana, ITN, Hiru & Local Sri Lankan Channels"},
    {"id": "in", "name": "🇮🇳 India Channels", "icon": "fa-flag", "category": "Regional", "url": "https://iptv-org.github.io/iptv/countries/in.m3u", "description": "Hindi, Tamil, Malayalam, Telugu & Indian TV Streams"},
    {"id": "us", "name": "🇺🇸 USA TV", "icon": "fa-flag", "category": "Regional", "url": "https://iptv-org.github.io/iptv/countries/us.m3u", "description": "American Networks, Local & National US Broadcasts"}
]

@app.get("/api/preset_playlists")
async def get_preset_playlists():
    return PRESET_PLAYLISTS

# Mount the static directory
static_dir = Path(__file__).parent / "static"
os.makedirs(static_dir, exist_ok=True)

index_file = static_dir / "index.html"
if not index_file.exists():
    index_file.write_text("<html><body>Frontend loading...</body></html>")

app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
