# Examples

## demo.py

Exercises every NLPipe endpoint against a running server. Useful as a smoke test and as a copy-paste reference for using the API from Python.

```bash
# Terminal 1: start the API
cd api && uvicorn main:app --reload

# Terminal 2: run the demo
pip install httpx
python examples/demo.py
```

This will hit each endpoint in turn: `/health`, `/sentiment`, `/sentiment/batch`, `/ner`, `/classify`, `/summarize`, `/keywords`, `/translate`.

First call to each task downloads the underlying HuggingFace model (a few hundred MB), so the first run is slow. Subsequent runs are fast (cached).
