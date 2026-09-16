import asyncio
import httpx
import time

async def check_stream(client, url):
    try:
        # Use GET with stream to just read the headers and drop the body
        async with client.stream("GET", url, timeout=2.0, follow_redirects=True) as response:
            return response.status_code < 400 or response.status_code in [401, 403, 405]
    except Exception:
        return False

async def main():
    urls = [
        "https://dtil.tmsimg.com/assets/GNLZZGG0025TCMR.png", # not m3u8 but valid
        "https://broken.stream.local/stream.m3u8", # broken
        "https://jmp2.uk/plu-62ea45010d0611000839868c.m3u8" # from the sports.m3u list
    ]
    
    start = time.time()
    async with httpx.AsyncClient() as client:
        tasks = [check_stream(client, u) for u in urls]
        results = await asyncio.gather(*tasks)
        
    print(f"Results: {results} in {time.time() - start:.2f}s")

if __name__ == "__main__":
    asyncio.run(main())
