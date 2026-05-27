"""
NLPipe — Production-grade NLP Inference API
FastAPI application serving sentiment analysis, NER, zero-shot classification,
text summarization and keyword extraction through a unified REST interface.
"""

from __future__ import annotations

import time
from typing import Any, Dict, List

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from schemas import (
    ClassifyRequest,
    ClassifyResponse,
    Entity,
    HealthResponse,
    Keyword,
    KeywordsRequest,
    KeywordsResponse,
    ModelInfo,
    ModelsLoaded,
    NERRequest,
    NERResponse,
    SentimentBatchRequest,
    SentimentBatchResponse,
    SentimentRequest,
    SentimentResponse,
    SummarizeRequest,
    SummarizeResponse,
    TranslateRequest,
    TranslateResponse,
)
from models import (
    load_classifier,
    load_keyword_extractor,
    load_ner,
    load_sentiment,
    load_summarizer,
    load_translator,
)

# ---------------------------------------------------------------------------
# App bootstrap
# ---------------------------------------------------------------------------

_START_TIME = time.monotonic()

app = FastAPI(
    title="NLPipe",
    description=(
        "A self-hosted NLP API serving 5 tasks through one unified REST "
        "interface — no API keys, no rate limits, runs on your hardware."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Allow all origins (playground dev server, curl, SDK consumers)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Timing middleware
# ---------------------------------------------------------------------------

@app.middleware("http")
async def add_process_time_header(request: Request, call_next: Any) -> Response:
    start = time.perf_counter()
    response: Response = await call_next(request)
    elapsed = time.perf_counter() - start
    response.headers["X-Process-Time"] = f"{elapsed:.4f}s"
    return response


# ---------------------------------------------------------------------------
# Lazy model registry
# ---------------------------------------------------------------------------

_models: Dict[str, Any] = {}


def _get_model(task: str) -> Any:
    """Load and cache a model on first access."""
    if task not in _models:
        loaders = {
            "sentiment": load_sentiment,
            "ner": load_ner,
            "classifier": load_classifier,
            "summarizer": load_summarizer,
            "keywords": load_keyword_extractor,
        }
        if task not in loaders:
            raise ValueError(f"Unknown task: {task}")
        _models[task] = loaders[task]()
    return _models[task]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _validate_text_length(text: str) -> None:
    """Raise HTTPException for edge cases that Pydantic may miss at runtime."""
    if not text.strip():
        raise HTTPException(status_code=422, detail="text must not be empty")
    if len(text) > 10_000:
        raise HTTPException(
            status_code=413,
            detail="text exceeds the 10,000-character limit",
        )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse, tags=["Meta"])
def health() -> HealthResponse:
    """Return API health status and which models are currently loaded."""
    loaded = ModelsLoaded(
        sentiment="sentiment" in _models,
        ner="ner" in _models,
        classifier="classifier" in _models,
        summarizer="summarizer" in _models,
        keywords="keywords" in _models,
    )
    return HealthResponse(
        status="ok",
        models_loaded=loaded,
        uptime_seconds=round(time.monotonic() - _START_TIME, 2),
    )


@app.get("/models", response_model=List[ModelInfo], tags=["Meta"])
def list_models() -> List[ModelInfo]:
    """Return metadata for every supported model."""
    return [
        ModelInfo(
            name="distilbert-base-uncased-finetuned-sst-2-english",
            task="sentiment",
            loaded="sentiment" in _models,
            approx_size_mb=67,
            description="DistilBERT fine-tuned on SST-2 for binary sentiment analysis.",
        ),
        ModelInfo(
            name="dslim/bert-base-NER",
            task="ner",
            loaded="ner" in _models,
            approx_size_mb=420,
            description="BERT-base fine-tuned on CoNLL-2003 for named entity recognition.",
        ),
        ModelInfo(
            name="facebook/bart-large-mnli",
            task="classifier",
            loaded="classifier" in _models,
            approx_size_mb=1_600,
            description="BART-large fine-tuned on MNLI for zero-shot text classification.",
        ),
        ModelInfo(
            name="sshleifer/distilbart-cnn-12-6",
            task="summarizer",
            loaded="summarizer" in _models,
            approx_size_mb=1_200,
            description="DistilBART fine-tuned on CNN/DailyMail for abstractive summarization.",
        ),
        ModelInfo(
            name="sklearn TF-IDF (NLTK stopwords)",
            task="keywords",
            loaded="keywords" in _models,
            approx_size_mb=1,
            description="TF-IDF vectorizer with unigram + bigram support for keyword extraction.",
        ),
        ModelInfo(
            name="Helsinki-NLP/opus-mt-{src}-{target}",
            task="translate",
            loaded=False,
            approx_size_mb=300,
            description=(
                "Helsinki-NLP opus-mt translation models. Loaded on demand per "
                "language pair (e.g. opus-mt-en-fr). ~300 MB per pair."
            ),
        ),
    ]


@app.post("/sentiment", response_model=SentimentResponse, tags=["NLP"])
def sentiment(req: SentimentRequest) -> SentimentResponse:
    """
    Classify the sentiment of input text as POSITIVE or NEGATIVE.

    - **text**: The string to analyse (1–10,000 characters).
    """
    _validate_text_length(req.text)
    pipe = _get_model("sentiment")
    result = pipe(req.text)[0]
    return SentimentResponse(
        label=result["label"],
        score=round(float(result["score"]), 6),
        text=req.text,
    )


@app.post("/sentiment/batch", response_model=SentimentBatchResponse, tags=["NLP"])
def sentiment_batch(req: SentimentBatchRequest) -> SentimentBatchResponse:
    """Process up to 100 texts in a single batched inference call."""
    pipe = _get_model("sentiment")
    raw = pipe(req.texts)
    results = [
        SentimentResponse(label=r["label"], score=round(float(r["score"]), 6), text=t)
        for r, t in zip(raw, req.texts)
    ]
    return SentimentBatchResponse(results=results, count=len(results))


@app.post("/ner", response_model=NERResponse, tags=["NLP"])
def ner(req: NERRequest) -> NERResponse:
    """
    Identify named entities (persons, organisations, locations, etc.) in text.

    Returns a list of entities with their type, confidence score, and character
    offsets in the original string.
    """
    _validate_text_length(req.text)
    pipe = _get_model("ner")
    raw: List[Dict[str, Any]] = pipe(req.text)
    entities = [
        Entity(
            word=ent["word"],
            label=ent["entity_group"],
            score=round(float(ent["score"]), 6),
            start=int(ent["start"]),
            end=int(ent["end"]),
        )
        for ent in raw
    ]
    return NERResponse(entities=entities, text=req.text)


@app.post("/classify", response_model=ClassifyResponse, tags=["NLP"])
def classify(req: ClassifyRequest) -> ClassifyResponse:
    """
    Zero-shot classification: assign confidence scores to each candidate label
    without any task-specific training.

    - **text**: Input text.
    - **labels**: List of candidate category strings.
    """
    _validate_text_length(req.text)
    if not req.labels:
        raise HTTPException(status_code=422, detail="labels must not be empty")
    pipe = _get_model("classifier")
    result = pipe(req.text, candidate_labels=req.labels)
    scores: Dict[str, float] = {
        label: round(float(score), 6)
        for label, score in zip(result["labels"], result["scores"])
    }
    top_label: str = result["labels"][0]
    return ClassifyResponse(scores=scores, top_label=top_label, text=req.text)


@app.post("/summarize", response_model=SummarizeResponse, tags=["NLP"])
def summarize(req: SummarizeRequest) -> SummarizeResponse:
    """
    Abstractively summarize long-form text.

    - **text**: Source text to condense.
    - **max_length**: Maximum token length of the output (default 130).
    - **min_length**: Minimum token length of the output (default 30).
    """
    _validate_text_length(req.text)

    # Ensure min_length < max_length to avoid model errors
    min_len = min(req.min_length, req.max_length - 1)

    pipe = _get_model("summarizer")
    result = pipe(
        req.text,
        max_length=req.max_length,
        min_length=min_len,
        do_sample=False,
    )
    summary: str = result[0]["summary_text"].strip()
    return SummarizeResponse(
        summary=summary,
        original_length=len(req.text.split()),
        summary_length=len(summary.split()),
    )


@app.post("/keywords", response_model=KeywordsResponse, tags=["NLP"])
def keywords(req: KeywordsRequest) -> KeywordsResponse:
    """
    Extract the most important keywords and keyphrases from text using TF-IDF.

    - **text**: Source text.
    - **top_k**: Number of keywords to return (default 10, max 50).
    """
    _validate_text_length(req.text)
    import numpy as np  # type: ignore

    vectorizer = _get_model("keywords")

    # Fit on the single document to get term scores
    try:
        tfidf_matrix = vectorizer.fit_transform([req.text])
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    feature_names: List[str] = vectorizer.get_feature_names_out().tolist()
    scores_array = tfidf_matrix.toarray()[0]

    # Sort descending and take top_k
    top_indices = np.argsort(scores_array)[::-1][: req.top_k]
    kw_list = [
        Keyword(
            word=feature_names[i],
            score=round(float(scores_array[i]), 6),
        )
        for i in top_indices
        if scores_array[i] > 0
    ]

    return KeywordsResponse(keywords=kw_list, text=req.text)


@app.post("/translate", response_model=TranslateResponse, tags=["NLP"])
def translate(req: TranslateRequest) -> TranslateResponse:
    """
    Translate text between languages using Helsinki-NLP opus-mt models.

    - **text**: Source text to translate (1–5,000 characters).
    - **source_lang**: ISO 639-1 source language code (default "en").
    - **target_lang**: ISO 639-1 target language code (default "fr").

    Models are loaded on demand per language pair and cached for subsequent
    requests.
    """
    if not req.text.strip():
        raise HTTPException(status_code=422, detail="text must not be empty")

    try:
        pipe = load_translator(req.source_lang, req.target_lang)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not load translation model for {req.source_lang}→{req.target_lang}: {exc}",
        ) from exc

    result = pipe(req.text)
    translation: str = result[0]["translation_text"]
    return TranslateResponse(
        translation=translation,
        source_lang=req.source_lang,
        target_lang=req.target_lang,
        text=req.text,
    )
