# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Language detection** — `POST /detect-language` (powered by `langdetect`, no model download) returns an ISO 639-1 code + confidence; mirrored by `detectLanguage()` in the SDK with 2 new tests
- `Makefile` orchestrating api, sdk, and playground subprojects
- Render.com `render.yaml` deploy blueprint (Standard plan + 10 GB HF cache disk)
- GitHub issue and PR templates
- `examples/demo.py` exercising all endpoints
- Weekly Dependabot updates for pip (`/api`), npm (`/sdk` and `/playground`), and GitHub Actions
- `CONTRIBUTING.md` covering API, SDK, and playground development

### Fixed
- SDK `test` script now runs on Windows too (was `node_modules/.bin/jest`, a shell wrapper that Node can't parse on Windows; now points at `node_modules/jest/bin/jest.js`)

## [1.3.0] — 2026-05-27

### Added
- **Rate limiting** via `slowapi` — default 100/min per IP, with tighter limits on heavy endpoints:
  - `/summarize` → 10/min
  - `/translate` → 15/min
  - `/classify` → 20/min
  - `/sentiment/batch` → 30/min
- 429 responses include `Retry-After` headers

## [1.2.0] — 2026-05-27

### Added
- `POST /sentiment/batch` — process up to 100 texts in one batched inference call
- `sentimentBatch(texts)` method on the TypeScript SDK
- 2 new SDK Jest tests covering batch sentiment

### Fixed
- SDK build: type-asserted `response.json()` result to fix TS2339 on `body.detail`

## [1.1.0] — 2026-05-27

### Added
- `POST /translate` endpoint backed by Helsinki-NLP opus-mt models, models lazy-loaded per (source, target) language pair
- `translate(text, source, target)` method on the SDK with 3 Jest tests

### Fixed
- CI: removed unused imports (`re`, `string`, `Optional`) flagged by pyflakes
- CI: committed `sdk/` and `playground/` `package-lock.json` for npm cache to work

## [1.0.0] — 2026-05-17

### Added
- Initial release
- FastAPI server with 5 NLP tasks: sentiment, NER, zero-shot classification, summarization, keywords
- Lazy-loaded HuggingFace pipelines + sklearn TF-IDF for keywords
- TypeScript SDK (`NLPipeClient`) with full typing
- React playground UI for trying all tasks in the browser
- `/health` and `/models` meta endpoints
- 10K-char input limit + per-endpoint validation
- Docker Compose, GitHub Actions CI
