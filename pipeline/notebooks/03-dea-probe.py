"""Spike: grab DEA Diversion annual report PDF samples."""

from pathlib import Path
import httpx

OUT = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "dea"
OUT.mkdir(parents=True, exist_ok=True)

# Replace with actual URLs observed during the spike.
URLS = {
    "diversion_2012_sample.pdf": "https://www.deadiversion.usdoj.gov/REPLACE_WITH_2012_URL.pdf",
    "diversion_2014_sample.pdf": "https://www.deadiversion.usdoj.gov/REPLACE_WITH_2014_URL.pdf",
}

with httpx.Client(timeout=180.0, follow_redirects=True) as c:
    for fname, url in URLS.items():
        r = c.get(url)
        print(url, r.status_code, len(r.content))
        r.raise_for_status()
        (OUT / fname).write_bytes(r.content)
