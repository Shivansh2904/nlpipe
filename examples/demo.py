"""Demo all 6 NLPipe tasks against a local server.

Start the server first:
    cd api && uvicorn main:app --reload

Then run:
    python examples/demo.py
"""
from __future__ import annotations

import os
import sys
from textwrap import shorten

import httpx

API = os.environ.get("NLPIPE_API", "http://localhost:8000")

# Sample inputs
SAMPLE_REVIEW = "I absolutely loved this product. The build quality is fantastic and customer service was responsive."
SAMPLE_NEWS = (
    "Apple announced today that it has acquired the London-based AI startup Mintly for $400 million. "
    "The deal, finalised on Tuesday, is expected to strengthen Apple's machine learning division "
    "under VP Sarah Chen. Mintly was founded in 2019 by ex-DeepMind researchers."
)
SAMPLE_LONG = (
    "Climate scientists at the IPCC released a report showing that global temperatures have risen by 1.1°C "
    "since pre-industrial times. The report warns that without drastic emission cuts, warming could exceed "
    "2°C by 2050, leading to widespread crop failure, sea level rise, and more frequent extreme weather "
    "events. The findings are based on data from over 200 research institutions across 65 countries. "
    "The authors call for an immediate transition to renewable energy and reforestation at scale. "
    "Several governments have already pledged carbon neutrality by 2050 but critics argue current policies "
    "fall far short of meeting these targets."
)


def banner(title: str) -> None:
    print()
    print("=" * 60)
    print(f"  {title}")
    print("=" * 60)


def call(client: httpx.Client, path: str, body: dict) -> dict:
    r = client.post(f"{API}{path}", json=body, timeout=120)
    r.raise_for_status()
    return r.json()


def main() -> None:
    with httpx.Client() as client:
        # 0. Health
        banner("/health")
        health = client.get(f"{API}/health").json()
        print(f"  status: {health['status']}")
        print(f"  uptime: {health['uptime_seconds']}s")

        # 1. Sentiment
        banner("/sentiment - single")
        result = call(client, "/sentiment", {"text": SAMPLE_REVIEW})
        print(f"  text: {shorten(SAMPLE_REVIEW, 60)}")
        print(f"  -> {result['label']} (score={result['score']:.4f})")

        # 2. Sentiment batch
        banner("/sentiment/batch - 3 texts")
        batch = call(client, "/sentiment/batch", {
            "texts": [
                "This was the worst experience of my life.",
                "Mediocre but acceptable for the price.",
                "Best purchase of the year, no regrets!",
            ]
        })
        for r in batch["results"]:
            print(f"  {r['label']:<8} {r['score']:.4f}  {shorten(r['text'], 50)}")

        # 3. NER
        banner("/ner")
        result = call(client, "/ner", {"text": SAMPLE_NEWS})
        for ent in result["entities"]:
            print(f"  {ent['label']:<6} {ent['word']:<25} (score={ent['score']:.3f})")

        # 4. Classify (zero-shot)
        banner("/classify - zero-shot")
        result = call(client, "/classify", {
            "text": SAMPLE_NEWS,
            "labels": ["technology", "sports", "politics", "business", "entertainment"],
        })
        print(f"  top: {result['top_label']}")
        for label, score in sorted(result["scores"].items(), key=lambda x: -x[1]):
            print(f"    {label:<15} {score:.4f}")

        # 5. Summarize
        banner("/summarize")
        result = call(client, "/summarize", {"text": SAMPLE_LONG})
        print(f"  original: {result['original_length']} words")
        print(f"  summary ({result['summary_length']} words):")
        print(f"    {result['summary']}")

        # 6. Keywords
        banner("/keywords")
        result = call(client, "/keywords", {"text": SAMPLE_LONG, "top_k": 8})
        for kw in result["keywords"]:
            print(f"  {kw['word']:<25} {kw['score']:.4f}")

        # 7. Translate
        banner("/translate (en -> fr)")
        result = call(client, "/translate", {
            "text": "The quick brown fox jumps over the lazy dog.",
            "source_lang": "en",
            "target_lang": "fr",
        })
        print(f"  source: {result['text']}")
        print(f"  target: {result['translation']}")

        print()
        print("All 7 endpoints demoed successfully.")


if __name__ == "__main__":
    try:
        main()
    except httpx.ConnectError:
        print(f"Could not reach {API}. Start the server first: cd api && uvicorn main:app --reload", file=sys.stderr)
        sys.exit(1)
    except httpx.HTTPStatusError as exc:
        print(f"HTTP {exc.response.status_code}: {exc.response.text}", file=sys.stderr)
        sys.exit(1)
