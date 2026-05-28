# NLPipe

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11-3776ab?style=for-the-badge&logo=python&logoColor=white" alt="Python 3.11" />
  <img src="https://img.shields.io/badge/FastAPI-0.109+-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/HuggingFace-Transformers-FFD21F?style=for-the-badge&logo=huggingface&logoColor=black" alt="HuggingFace" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178c6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-18-61dafb?style=for-the-badge&logo=react&logoColor=black" alt="React 18" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ed?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License" />
  <img src="https://img.shields.io/github/actions/workflow/status/Shivansh2904/nlpipe/ci.yml?branch=main&style=for-the-badge&label=CI" alt="CI" />
</p>

<p align="center">
  <strong>A self-hosted NLP API serving 6 tasks through one unified REST interface — no API keys, no rate limits, runs on your hardware.</strong>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#supported-tasks">Tasks</a> ·
  <a href="#typescript-sdk">TypeScript SDK</a> ·
  <a href="#api-reference">API Reference</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#performance">Performance</a>
</p>

---

## What is NLPipe?

NLPipe is a production-grade NLP inference server that wraps best-in-class HuggingFace models behind a single, clean REST API. Drop it into any stack — call it from Python, TypeScript, curl, or any HTTP client. No cloud subscription, no per-request billing, no cold starts from someone else's servers.

```
┌──────────────────────────────────────────────────────────┐
│                        Your App                          │
│   Python · TypeScript SDK · curl · Any HTTP client       │
└──────────────────────────┬───────────────────────────────┘
                           │  REST / JSON
┌──────────────────────────▼───────────────────────────────┐
│                    NLPipe API (FastAPI)                   │
│  POST /sentiment  POST /ner  POST /classify              │
│  POST /summarize  POST /keywords  POST /translate        │
│  GET /health  GET /models                                │
└──────┬──────┬──────┬──────────┬──────┬────────────────────┘
       │      │      │          │      │
   distil  bert  bart-large  distilbart  sklearn  Helsinki-NLP
   -bert   NER   mnli        cnn-12-6    TF-IDF   opus-mt-*
```

---

## Supported Tasks

| Task | Model | Input | Output |
|------|-------|-------|--------|
| **Sentiment Analysis** | `distilbert-base-uncased-finetuned-sst-2-english` | text | `label` (POSITIVE/NEGATIVE) + `score` |
| **Batch Sentiment** | `distilbert-base-uncased-finetuned-sst-2-english` | list of texts (max 100) | list of `{ label, score, text }` + `count` |
| **Named Entity Recognition** | `dslim/bert-base-NER` | text | list of entities with type, score, offsets |
| **Zero-Shot Classification** | `facebook/bart-large-mnli` | text + candidate labels | per-label confidence scores |
| **Text Summarization** | `sshleifer/distilbart-cnn-12-6` | long text | abstractive summary |
| **Keyword Extraction** | NLTK/TF-IDF (sklearn) | text | ranked keywords + scores |
| **Translation** | `Helsinki-NLP/opus-mt-{src}-{target}` | text + language codes | translated text (loaded on demand per language pair) |
| **Language Detection** | `langdetect` (no model download) | text | ISO 639-1 language code + confidence |

---

## Deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Shivansh2904/nlpipe)

A `render.yaml` blueprint provisions the API on a Standard plan with a 10 GB persistent disk for HuggingFace model caching.

---

## Quick Start

### Option A — Docker Compose (recommended)

```bash
git clone https://github.com/Shivansh2904/nlpipe.git
cd nlpipe
docker-compose up
```

| Service | URL |
|---------|-----|
| API | http://localhost:8000 |
| Interactive Docs | http://localhost:8000/docs |
| React Playground | http://localhost:5173 |

> **First-run note:** HuggingFace models are downloaded on first request (~3 GB total) and cached in a Docker volume. Subsequent starts are instant.

### Option B — Local Development

**API:**
```bash
cd api
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Playground:**
```bash
cd playground
npm install
npm run dev        # opens http://localhost:5173
```

---

## curl Examples

```bash
# Sentiment Analysis
curl -X POST http://localhost:8000/sentiment \
  -H "Content-Type: application/json" \
  -d '{"text": "This product exceeded all my expectations!"}'
# → {"label":"POSITIVE","score":0.999832,"text":"..."}

# Batch Sentiment Analysis (up to 100 texts in one call)
curl -X POST http://localhost:8000/sentiment/batch \
  -H "Content-Type: application/json" \
  -d '{"texts": ["I love this!", "This is terrible.", "Meh, it works."]}'
# → {"results":[{"label":"POSITIVE","score":0.9998,"text":"I love this!"},...],"count":3}

# Named Entity Recognition
curl -X POST http://localhost:8000/ner \
  -H "Content-Type: application/json" \
  -d '{"text": "Elon Musk founded SpaceX in Hawthorne, California."}'
# → {"entities":[{"word":"Elon Musk","label":"PER","score":0.9993,...},...],"text":"..."}

# Zero-Shot Classification
curl -X POST http://localhost:8000/classify \
  -H "Content-Type: application/json" \
  -d '{"text": "The stock market surged 3% on rate cut hopes.", "labels": ["finance","sports","technology"]}'
# → {"scores":{"finance":0.9721,...},"top_label":"finance","text":"..."}

# Summarization
curl -X POST http://localhost:8000/summarize \
  -H "Content-Type: application/json" \
  -d '{"text": "...long article...", "max_length": 100, "min_length": 30}'
# → {"summary":"...","original_length":312,"summary_length":47}

# Keyword Extraction
curl -X POST http://localhost:8000/keywords \
  -H "Content-Type: application/json" \
  -d '{"text": "Machine learning transforms how we process natural language.", "top_k": 5}'
# → {"keywords":[{"word":"machine learning","score":0.8234},...],"text":"..."}

# Translation (Helsinki-NLP opus-mt, loaded on demand)
curl -X POST http://localhost:8000/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, how are you?", "source_lang": "en", "target_lang": "fr"}'
# → {"translation":"Bonjour, comment allez-vous ?","source_lang":"en","target_lang":"fr","text":"..."}

# Language Detection (langdetect, no model download)
curl -X POST http://localhost:8000/detect-language \
  -H "Content-Type: application/json" \
  -d '{"text": "Bonjour le monde, comment allez-vous?"}'
# → {"language":"fr","confidence":0.999998,"text":"..."}

# Health Check
curl http://localhost:8000/health
# → {"status":"ok","models_loaded":{...},"uptime_seconds":142.3}
```

> **Python demo:** A runnable end-to-end Python example that exercises every endpoint lives in [`examples/demo.py`](examples/demo.py). See [`examples/README.md`](examples/README.md) for usage.

---

## TypeScript SDK

Install from the `sdk/` directory (or publish to npm):

```bash
cd sdk && npm install && npm run build
```

```typescript
import { NLPipeClient } from 'nlpipe-sdk';

const nlp = new NLPipeClient('http://localhost:8000');

// Sentiment
const s = await nlp.sentiment('I love how simple this API is!');
console.log(s.label, s.score);  // POSITIVE  0.9998

// Batch Sentiment (up to 100 texts in a single call)
const batch = await nlp.sentimentBatch([
  'I love this!',
  'This is terrible.',
  'Meh, it works.',
]);
console.log(batch.count);  // 3
batch.results.forEach(r => console.log(r.label, r.text));

// NER
const n = await nlp.ner('Barack Obama was born in Honolulu, Hawaii.');
n.entities.forEach(e => console.log(e.word, e.label));  // Barack Obama PER  ...

// Zero-shot
const c = await nlp.classify('The game went into overtime.', ['sports', 'politics', 'tech']);
console.log(c.top_label);  // sports

// Summarize
const sum = await nlp.summarize(longArticle, { maxLength: 150, minLength: 40 });
console.log(sum.summary);

// Keywords
const kw = await nlp.keywords('Deep learning and transformer models...', 8);
kw.keywords.forEach(k => console.log(k.word, k.score));

// Translate (defaults: en → fr)
const tr = await nlp.translate('Hello, how are you?');
console.log(tr.translation);  // Bonjour, comment allez-vous ?

// Translate with explicit language codes
const tr2 = await nlp.translate('Good morning', 'en', 'de');
console.log(tr2.translation);  // Guten Morgen

// Detect language
const lang = await nlp.detectLanguage('Bonjour le monde');
console.log(lang.language, lang.confidence);  // fr 0.9999
```

All methods return fully typed `Promise<T>` results. Errors throw `NLPipeError` with `statusCode` and `detail` properties.

---

## API Reference

Interactive Swagger UI is served at **http://localhost:8000/docs**. ReDoc is at **/redoc**.

### `POST /sentiment`
| Field | Type | Description |
|-------|------|-------------|
| `text` | `string` | Input text (1–10,000 chars) |

Response: `{ label, score, text }`

### `POST /sentiment/batch`
| Field | Type | Description |
|-------|------|-------------|
| `texts` | `string[]` | List of texts to analyse (1–100 items, each 1–10,000 chars) |

Response: `{ results: [{ label, score, text }], count }`

### `POST /ner`
| Field | Type | Description |
|-------|------|-------------|
| `text` | `string` | Input text (1–10,000 chars) |

Response: `{ entities: [{ word, label, score, start, end }], text }`

### `POST /classify`
| Field | Type | Description |
|-------|------|-------------|
| `text` | `string` | Input text (1–10,000 chars) |
| `labels` | `string[]` | Candidate category labels |

Response: `{ scores: { label: score }, top_label, text }`

### `POST /summarize`
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `text` | `string` | — | Source text (1–10,000 chars) |
| `max_length` | `int` | `130` | Max output token length (30–512) |
| `min_length` | `int` | `30` | Min output token length (10–256) |

Response: `{ summary, original_length, summary_length }`

### `POST /keywords`
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `text` | `string` | — | Source text (1–10,000 chars) |
| `top_k` | `int` | `10` | Number of keywords to return (1–50) |

Response: `{ keywords: [{ word, score }], text }`

### `POST /translate`
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `text` | `string` | — | Source text to translate (1–5,000 chars) |
| `source_lang` | `string` | `"en"` | ISO 639-1 source language code |
| `target_lang` | `string` | `"fr"` | ISO 639-1 target language code |

Response: `{ translation, source_lang, target_lang, text }`

The appropriate `Helsinki-NLP/opus-mt-{src}-{target}` model is loaded on demand and cached for subsequent requests with the same language pair.

### `GET /health`
Response: `{ status, models_loaded: { sentiment, ner, classifier, summarizer, keywords }, uptime_seconds }`

### `GET /models`
Response: array of `{ name, task, loaded, approx_size_mb, description }`

### Rate Limiting

NLPipe ships with per-IP rate limiting (powered by [`slowapi`](https://github.com/laurentS/slowapi)) so that a self-hosted instance can safely be exposed to the public internet without a single client monopolizing inference time.

| Scope | Limit |
|-------|-------|
| **Default** (all endpoints) | `100` requests / minute / IP |
| `POST /summarize` (heavy) | `10` requests / minute / IP |
| `POST /translate` (heavy) | `15` requests / minute / IP |
| `POST /classify` | `20` requests / minute / IP |
| `POST /sentiment/batch` | `30` requests / minute / IP |
| `POST /sentiment`, `POST /ner`, `POST /keywords` | default `100/min` |

When a client exceeds its limit, the API responds with **HTTP `429 Too Many Requests`** and a `Retry-After` header indicating how many seconds to wait before retrying. Limits are tracked in-memory per server process and reset every rolling minute.

### Error codes
| Code | Meaning |
|------|---------|
| `422` | Validation error (empty text, bad input shape) |
| `413` | Text exceeds 10,000-character limit |
| `429` | Rate limit exceeded — see `Retry-After` header |
| `500` | Unexpected server error |

Every response includes an `X-Process-Time` header with inference duration in seconds.

---

## Architecture

```
nlpipe/
├── api/
│   ├── main.py          # FastAPI app, all endpoints, lazy model cache
│   ├── models.py        # Model loading functions (one per task)
│   ├── schemas.py       # Pydantic v2 request/response models
│   ├── requirements.txt
│   └── Dockerfile
├── sdk/
│   ├── src/
│   │   ├── index.ts     # NLPipeClient class + all TypeScript types
│   │   └── index.test.ts
│   ├── package.json
│   └── tsconfig.json
├── playground/
│   ├── src/
│   │   ├── App.tsx      # React playground UI (dark theme + Tailwind)
│   │   └── index.css
│   ├── index.html
│   ├── Dockerfile       # Multi-stage nginx build
│   └── nginx.conf
├── docker-compose.yml
└── .github/workflows/ci.yml
```

**Lazy model loading:** Models are stored in a module-level `_models: dict` in `main.py`. On the first request to each endpoint, the relevant model loads into memory and stays cached for all subsequent requests. This means zero startup latency for tasks you don't use.

**CORS:** All origins are allowed, making the API callable directly from browser-based applications.

**Request timing:** A middleware layer captures wall-clock time for every request and injects it into the `X-Process-Time` response header.

---

## Performance

> Benchmarks measured on an Apple M2 Pro (CPU inference, no GPU).

| Task | Model load (cold) | Inference (warm) |
|------|-------------------|------------------|
| Sentiment | ~4 s | ~80 ms |
| NER | ~8 s | ~120 ms |
| Zero-Shot | ~18 s | ~800 ms |
| Summarization | ~15 s | ~2–8 s (text length dependent) |
| Keywords | <1 s | <10 ms |

**GPU acceleration:** Set the device in `api/models.py` by passing `device=0` to each `pipeline()` call when a CUDA GPU is available. Inference latency drops 5–10x.

**Model caching:** Mount a persistent volume at `/cache` (configured in `docker-compose.yml`) to avoid re-downloading models on container restart.

---

## Development

### Running tests

```bash
# SDK unit tests (mocked fetch — no live server needed)
cd sdk && npm test

# Python syntax check
python -m py_compile api/main.py api/models.py api/schemas.py
```

### CI

GitHub Actions runs three parallel jobs on every push and pull request:
1. **Python** — `pyflakes` lint + compile check on all `.py` files
2. **SDK** — `npm ci` → `tsc` build → Jest unit tests
3. **Playground** — `npm ci` → `vite build`

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit your changes
4. Open a pull request

---

## License

[MIT](LICENSE) © 2025 Shivansh Mishra
