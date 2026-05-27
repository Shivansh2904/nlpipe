"""
Model loading functions for NLPipe.

Each function returns a HuggingFace pipeline (or sklearn vectoriser for
keywords).  Models are intentionally loaded lazily — call these functions
only when the first request for a task arrives.
"""

from __future__ import annotations

from typing import Any

# ---------------------------------------------------------------------------
# Sentiment Analysis
# ---------------------------------------------------------------------------

def load_sentiment() -> Any:
    """
    Return a HuggingFace sentiment-analysis pipeline backed by
    distilbert-base-uncased-finetuned-sst-2-english (~67 MB).
    """
    from transformers import pipeline  # type: ignore

    return pipeline(
        "sentiment-analysis",
        model="distilbert-base-uncased-finetuned-sst-2-english",
        tokenizer="distilbert-base-uncased-finetuned-sst-2-english",
        truncation=True,
        max_length=512,
    )


# ---------------------------------------------------------------------------
# Named Entity Recognition
# ---------------------------------------------------------------------------

def load_ner() -> Any:
    """
    Return a HuggingFace NER pipeline backed by dslim/bert-base-NER (~420 MB).
    Uses aggregation_strategy='simple' to merge sub-word tokens automatically.
    """
    from transformers import pipeline  # type: ignore

    return pipeline(
        "ner",
        model="dslim/bert-base-NER",
        tokenizer="dslim/bert-base-NER",
        aggregation_strategy="simple",
        truncation=True,
        max_length=512,
    )


# ---------------------------------------------------------------------------
# Zero-Shot Classification
# ---------------------------------------------------------------------------

def load_classifier() -> Any:
    """
    Return a HuggingFace zero-shot-classification pipeline backed by
    facebook/bart-large-mnli (~1.6 GB).
    """
    from transformers import pipeline  # type: ignore

    return pipeline(
        "zero-shot-classification",
        model="facebook/bart-large-mnli",
        truncation=True,
    )


# ---------------------------------------------------------------------------
# Summarization
# ---------------------------------------------------------------------------

def load_summarizer() -> Any:
    """
    Return a HuggingFace summarization pipeline backed by
    sshleifer/distilbart-cnn-12-6 (~1.2 GB).
    """
    from transformers import pipeline  # type: ignore

    return pipeline(
        "summarization",
        model="sshleifer/distilbart-cnn-12-6",
        tokenizer="sshleifer/distilbart-cnn-12-6",
        truncation=True,
    )


# ---------------------------------------------------------------------------
# Keyword Extraction (TF-IDF via sklearn)
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Translation (Helsinki-NLP opus-mt)
# ---------------------------------------------------------------------------

_translator_cache: dict = {}


def load_translator(src: str, target: str) -> Any:
    """
    Return a HuggingFace translation pipeline backed by
    Helsinki-NLP/opus-mt-{src}-{target}.  Results are cached by (src, target).
    """
    key = (src, target)
    if key not in _translator_cache:
        from transformers import pipeline  # type: ignore

        model_name = f"Helsinki-NLP/opus-mt-{src}-{target}"
        _translator_cache[key] = pipeline(
            "translation",
            model=model_name,
            device=-1,
        )
    return _translator_cache[key]


# ---------------------------------------------------------------------------
# Keyword Extraction (TF-IDF via sklearn)
# ---------------------------------------------------------------------------

def load_keyword_extractor() -> Any:
    """
    Return a configured sklearn TfidfVectorizer suitable for keyword
    extraction.  English stop-words are filtered automatically.
    """
    from sklearn.feature_extraction.text import TfidfVectorizer  # type: ignore

    vectorizer = TfidfVectorizer(
        stop_words="english",
        ngram_range=(1, 2),       # unigrams + bigrams
        max_features=5_000,
        sublinear_tf=True,        # log-scale TF
        strip_accents="unicode",
        analyzer="word",
        token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z0-9\-]{1,}\b",  # skip single chars / numbers
        min_df=1,
    )
    return vectorizer
