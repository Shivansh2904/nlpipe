/**
 * NLPipe TypeScript SDK
 *
 * A fully-typed client for the NLPipe NLP inference API.
 *
 * @example
 * ```ts
 * import { NLPipeClient } from 'nlpipe-sdk';
 *
 * const nlp = new NLPipeClient('http://localhost:8000');
 * const result = await nlp.sentiment('I absolutely love this library!');
 * console.log(result.label, result.score); // POSITIVE 0.9998
 * ```
 */

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class NLPipeError extends Error {
  public readonly statusCode: number;
  public readonly detail: string;

  constructor(statusCode: number, detail: string) {
    super(`NLPipe API error ${statusCode}: ${detail}`);
    this.name = 'NLPipeError';
    this.statusCode = statusCode;
    this.detail = detail;
    // Maintain proper prototype chain in transpiled ES5
    Object.setPrototypeOf(this, NLPipeError.prototype);
  }
}

// ---------------------------------------------------------------------------
// Request / Response interfaces
// ---------------------------------------------------------------------------

export interface SentimentResult {
  label: 'POSITIVE' | 'NEGATIVE' | string;
  score: number;
  text: string;
}

export interface Entity {
  word: string;
  label: string;
  score: number;
  start: number;
  end: number;
}

export interface NERResult {
  entities: Entity[];
  text: string;
}

export interface ClassifyResult {
  scores: Record<string, number>;
  top_label: string;
  text: string;
}

export interface SummarizeOptions {
  maxLength?: number;
  minLength?: number;
}

export interface SummarizeResult {
  summary: string;
  original_length: number;
  summary_length: number;
}

export interface Keyword {
  word: string;
  score: number;
}

export interface KeywordsResult {
  keywords: Keyword[];
  text: string;
}

export interface TranslateResult {
  translation: string;
  source_lang: string;
  target_lang: string;
  text: string;
}

export interface ModelsLoaded {
  sentiment: boolean;
  ner: boolean;
  classifier: boolean;
  summarizer: boolean;
  keywords: boolean;
}

export interface HealthResult {
  status: string;
  models_loaded: ModelsLoaded;
  uptime_seconds: number;
}

export interface ModelInfo {
  name: string;
  task: string;
  loaded: boolean;
  approx_size_mb: number;
  description: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type HttpMethod = 'GET' | 'POST';

async function parseError(response: Response): Promise<NLPipeError> {
  let detail = `HTTP ${response.status}`;
  try {
    const body = (await response.json()) as { detail?: string } | null;
    detail = body?.detail ?? JSON.stringify(body);
  } catch {
    detail = await response.text().catch(() => detail);
  }
  return new NLPipeError(response.status, detail);
}

// ---------------------------------------------------------------------------
// NLPipeClient
// ---------------------------------------------------------------------------

export class NLPipeClient {
  private readonly baseUrl: string;

  /**
   * Create a new NLPipeClient.
   *
   * @param baseUrl - Base URL of the NLPipe API server.
   *                  Defaults to `http://localhost:8000`.
   */
  constructor(baseUrl: string = 'http://localhost:8000') {
    // Normalise: strip trailing slash
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  // -------------------------------------------------------------------------
  // Private request helper
  // -------------------------------------------------------------------------

  private async request<T>(
    method: HttpMethod,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const init: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new NLPipeError(0, `Network error: ${message}`);
    }

    if (!response.ok) {
      throw await parseError(response);
    }

    return response.json() as Promise<T>;
  }

  // -------------------------------------------------------------------------
  // Public API methods
  // -------------------------------------------------------------------------

  /**
   * Classify the sentiment of the given text.
   *
   * @param text - Input text (1–10,000 characters).
   */
  async sentiment(text: string): Promise<SentimentResult> {
    return this.request<SentimentResult>('POST', '/sentiment', { text });
  }

  /**
   * Classify the sentiment of multiple texts in a single batched call.
   *
   * @param texts - Array of texts to analyse (1–100 items, each 1–10,000 chars).
   */
  async sentimentBatch(
    texts: string[],
  ): Promise<{ results: SentimentResult[]; count: number }> {
    return this.request<{ results: SentimentResult[]; count: number }>(
      'POST',
      '/sentiment/batch',
      { texts },
    );
  }

  /**
   * Extract named entities from text (persons, organisations, locations, …).
   *
   * @param text - Input text (1–10,000 characters).
   */
  async ner(text: string): Promise<NERResult> {
    return this.request<NERResult>('POST', '/ner', { text });
  }

  /**
   * Classify text into one of the provided candidate labels (zero-shot).
   *
   * @param text   - Input text (1–10,000 characters).
   * @param labels - Array of candidate category strings.
   */
  async classify(text: string, labels: string[]): Promise<ClassifyResult> {
    return this.request<ClassifyResult>('POST', '/classify', { text, labels });
  }

  /**
   * Abstractively summarise text.
   *
   * @param text    - Source text (1–10,000 characters).
   * @param options - Optional length constraints for the summary.
   */
  async summarize(
    text: string,
    options: SummarizeOptions = {},
  ): Promise<SummarizeResult> {
    const payload: Record<string, unknown> = { text };
    if (options.maxLength !== undefined) payload['max_length'] = options.maxLength;
    if (options.minLength !== undefined) payload['min_length'] = options.minLength;
    return this.request<SummarizeResult>('POST', '/summarize', payload);
  }

  /**
   * Extract the most relevant keywords and keyphrases from text.
   *
   * @param text - Source text (1–10,000 characters).
   * @param topK - Number of keywords to return (default 10, max 50).
   */
  async keywords(text: string, topK?: number): Promise<KeywordsResult> {
    const payload: Record<string, unknown> = { text };
    if (topK !== undefined) payload['top_k'] = topK;
    return this.request<KeywordsResult>('POST', '/keywords', payload);
  }

  /**
   * Translate text from one language to another using Helsinki-NLP opus-mt models.
   *
   * @param text       - Source text to translate (1–5,000 characters).
   * @param sourceLang - ISO 639-1 source language code (default "en").
   * @param targetLang - ISO 639-1 target language code (default "fr").
   */
  async translate(
    text: string,
    sourceLang = 'en',
    targetLang = 'fr',
  ): Promise<TranslateResult> {
    return this.request<TranslateResult>('POST', '/translate', {
      text,
      source_lang: sourceLang,
      target_lang: targetLang,
    });
  }

  /**
   * Retrieve API health status and loaded model flags.
   */
  async health(): Promise<HealthResult> {
    return this.request<HealthResult>('GET', '/health');
  }

  /**
   * Retrieve metadata for all supported models.
   */
  async models(): Promise<ModelInfo[]> {
    return this.request<ModelInfo[]>('GET', '/models');
  }
}

export default NLPipeClient;
