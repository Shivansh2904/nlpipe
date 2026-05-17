"""
Pydantic v2 request and response schemas for NLPipe API.
"""

from __future__ import annotations

from typing import Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Shared validators
# ---------------------------------------------------------------------------

def _non_empty_text(v: str) -> str:
    v = v.strip()
    if not v:
        raise ValueError("text must not be empty")
    if len(v) > 10_000:
        raise ValueError("text must not exceed 10,000 characters")
    return v


# ---------------------------------------------------------------------------
# Sentiment
# ---------------------------------------------------------------------------

class SentimentRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10_000, description="Input text to analyse")

    @field_validator("text")
    @classmethod
    def validate_text(cls, v: str) -> str:
        return _non_empty_text(v)


class SentimentResponse(BaseModel):
    label: str = Field(..., description="POSITIVE or NEGATIVE")
    score: float = Field(..., description="Confidence score between 0 and 1")
    text: str = Field(..., description="Original input text")


# ---------------------------------------------------------------------------
# Named Entity Recognition
# ---------------------------------------------------------------------------

class NERRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10_000)

    @field_validator("text")
    @classmethod
    def validate_text(cls, v: str) -> str:
        return _non_empty_text(v)


class Entity(BaseModel):
    word: str
    label: str
    score: float
    start: int
    end: int


class NERResponse(BaseModel):
    entities: List[Entity]
    text: str


# ---------------------------------------------------------------------------
# Zero-Shot Classification
# ---------------------------------------------------------------------------

class ClassifyRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10_000)
    labels: List[str] = Field(..., min_length=1, description="Candidate labels")

    @field_validator("text")
    @classmethod
    def validate_text(cls, v: str) -> str:
        return _non_empty_text(v)

    @field_validator("labels")
    @classmethod
    def validate_labels(cls, v: List[str]) -> List[str]:
        if not v:
            raise ValueError("labels must not be empty")
        cleaned = [lbl.strip() for lbl in v if lbl.strip()]
        if not cleaned:
            raise ValueError("labels must contain at least one non-empty string")
        return cleaned


class ClassifyResponse(BaseModel):
    scores: Dict[str, float] = Field(..., description="Label → confidence score mapping")
    top_label: str = Field(..., description="Label with the highest score")
    text: str


# ---------------------------------------------------------------------------
# Summarization
# ---------------------------------------------------------------------------

class SummarizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10_000)
    max_length: int = Field(130, ge=30, le=512)
    min_length: int = Field(30, ge=10, le=256)

    @field_validator("text")
    @classmethod
    def validate_text(cls, v: str) -> str:
        return _non_empty_text(v)


class SummarizeResponse(BaseModel):
    summary: str
    original_length: int = Field(..., description="Word count of the original text")
    summary_length: int = Field(..., description="Word count of the summary")


# ---------------------------------------------------------------------------
# Keyword Extraction
# ---------------------------------------------------------------------------

class KeywordsRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10_000)
    top_k: int = Field(10, ge=1, le=50)

    @field_validator("text")
    @classmethod
    def validate_text(cls, v: str) -> str:
        return _non_empty_text(v)


class Keyword(BaseModel):
    word: str
    score: float


class KeywordsResponse(BaseModel):
    keywords: List[Keyword]
    text: str


# ---------------------------------------------------------------------------
# Translation
# ---------------------------------------------------------------------------

class TranslateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    source_lang: str = Field("en", description="ISO 639-1 source language code")
    target_lang: str = Field("fr", description="ISO 639-1 target language code")


class TranslateResponse(BaseModel):
    translation: str
    source_lang: str
    target_lang: str
    text: str


# ---------------------------------------------------------------------------
# Health & Models
# ---------------------------------------------------------------------------

class ModelsLoaded(BaseModel):
    sentiment: bool = False
    ner: bool = False
    classifier: bool = False
    summarizer: bool = False
    keywords: bool = False


class HealthResponse(BaseModel):
    status: str
    models_loaded: ModelsLoaded
    uptime_seconds: float


class ModelInfo(BaseModel):
    name: str
    task: str
    loaded: bool
    approx_size_mb: int
    description: str
