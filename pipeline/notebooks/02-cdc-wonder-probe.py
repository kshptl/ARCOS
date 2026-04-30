"""Spike: POST to WONDER D76, capture response, save fixture."""

from pathlib import Path

import httpx

OUT = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "cdc"
OUT.mkdir(parents=True, exist_ok=True)

# Minimal XML request body. Group by county + year, filter drug-poisoning
# underlying cause (ICD-10 X40-X44, X60-X64, X85, Y10-Y14). West Virginia only.
REQUEST_BODY = """<?xml version="1.0" encoding="utf-8"?>
<request-parameters>
  <parameter><name>accept_datause_restrictions</name><value>true</value></parameter>
  <parameter><name>B_1</name><value>D76.V1-level3</value></parameter>
  <parameter><name>B_2</name><value>D76.V1-level1</value></parameter>
  <parameter><name>F_D76.V1</name><value>2012</value><value>2013</value><value>2014</value></parameter>
  <parameter><name>F_D76.V9</name><value>54</value></parameter>
  <parameter><name>F_D76.V10</name><value>*All*</value></parameter>
  <parameter><name>F_D76.V2</name><value>*All*</value></parameter>
  <parameter><name>F_D76.V17</name><value>X40</value><value>X41</value><value>X42</value><value>X43</value><value>X44</value><value>X60</value><value>X61</value><value>X62</value><value>X63</value><value>X64</value><value>X85</value><value>Y10</value><value>Y11</value><value>Y12</value><value>Y13</value><value>Y14</value></parameter>
  <parameter><name>O_javascript</name><value>on</value></parameter>
  <parameter><name>O_precision</name><value>1</value></parameter>
  <parameter><name>O_rate_per</name><value>100000</value></parameter>
  <parameter><name>O_title</name><value>openarcos-spike-wv</value></parameter>
  <parameter><name>V_D76.V1</name><value/></parameter>
  <parameter><name>V_D76.V9</name><value/></parameter>
  <parameter><name>action-Send</name><value>Send</value></parameter>
  <parameter><name>stage</name><value>request</value></parameter>
</request-parameters>
"""

URL = "https://wonder.cdc.gov/controller/datarequest/D76"

(OUT / "wv_2012_2014_request.xml").write_text(REQUEST_BODY)

with httpx.Client(timeout=180.0, follow_redirects=True) as client:
    resp = client.post(URL, data={"request_xml": REQUEST_BODY})
    print("status:", resp.status_code)
    print("content-type:", resp.headers.get("content-type"))
    print("bytes:", len(resp.content))
    (OUT / "wv_2012_2014.xml").write_bytes(resp.content)

print("saved response fixture")
