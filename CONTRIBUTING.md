# Contributing to NLPipe

Thanks for considering a contribution! This repo has three parts — pick whichever you want to work on.

## Repository layout

- `api/` — Python FastAPI server (the inference API)
- `sdk/` — TypeScript SDK
- `playground/` — React playground UI

## Working on the API

```bash
cd api
pip install -r requirements.txt
uvicorn main:app --reload
# Swagger: http://localhost:8000/docs
```

Code style: type hints everywhere, Pydantic v2 schemas, lazy-load models from `models.py`.

Adding a new task:
1. Add `load_<task>` function to `api/models.py`
2. Add request/response Pydantic schemas to `api/schemas.py`
3. Add endpoint to `api/main.py` with `_validate_text_length` + `_get_model` pattern
4. Register the model in the `/models` listing
5. Optional: apply `@limiter.limit("...")` if it's heavy

## Working on the SDK

```bash
cd sdk
npm install
npm test
npm run build
```

When you add an API endpoint, mirror it in `sdk/src/index.ts` and add a Jest test in `sdk/src/index.test.ts`.

## Working on the playground

```bash
cd playground
npm install
npm run dev
# UI: http://localhost:5173
```

The playground talks to the API at `VITE_API_BASE` (defaults to `http://localhost:8000`).

## Style

- Python: PEP 8, type hints, Pydantic v2
- TypeScript: strict mode, full types on public methods
- No silent failures — errors should bubble up to the user

## Submitting a PR

1. Fork, branch, commit
2. Tests pass in whichever subproject you touched
3. Update the README endpoint table if you add an endpoint

## License

By contributing, you agree your contributions are licensed under MIT.
