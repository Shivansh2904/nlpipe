/**
 * NLPipe SDK – unit tests
 *
 * All tests mock the global `fetch` so no live server is required.
 */

import { NLPipeClient, NLPipeError } from './index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(status: number, body: unknown): jest.Mock {
  const mock = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  });
  global.fetch = mock;
  return mock;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('NLPipeClient', () => {
  let client: NLPipeClient;

  beforeEach(() => {
    client = new NLPipeClient('http://localhost:8000');
    jest.resetAllMocks();
  });

  // -------------------------------------------------------------------------
  // sentiment()
  // -------------------------------------------------------------------------

  describe('sentiment()', () => {
    it('returns label, score, and text on success', async () => {
      const payload = { label: 'POSITIVE', score: 0.9998, text: 'Great!' };
      mockFetch(200, payload);

      const result = await client.sentiment('Great!');

      expect(result.label).toBe('POSITIVE');
      expect(result.score).toBeCloseTo(0.9998);
      expect(result.text).toBe('Great!');
    });

    it('posts to /sentiment with correct body', async () => {
      mockFetch(200, { label: 'NEGATIVE', score: 0.8, text: 'Bad.' });
      const mock = global.fetch as jest.Mock;

      await client.sentiment('Bad.');

      expect(mock).toHaveBeenCalledWith(
        'http://localhost:8000/sentiment',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ text: 'Bad.' }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // ner()
  // -------------------------------------------------------------------------

  describe('ner()', () => {
    it('returns an entities array', async () => {
      const payload = {
        entities: [
          { word: 'London', label: 'LOC', score: 0.9991, start: 10, end: 16 },
        ],
        text: 'I live in London.',
      };
      mockFetch(200, payload);

      const result = await client.ner('I live in London.');

      expect(Array.isArray(result.entities)).toBe(true);
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].word).toBe('London');
      expect(result.entities[0].label).toBe('LOC');
      expect(result.entities[0].start).toBe(10);
      expect(result.entities[0].end).toBe(16);
    });

    it('returns empty entities array when no entities found', async () => {
      mockFetch(200, { entities: [], text: 'nothing here' });

      const result = await client.ner('nothing here');

      expect(result.entities).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // classify()
  // -------------------------------------------------------------------------

  describe('classify()', () => {
    it('returns a scores dict and top_label', async () => {
      const payload = {
        scores: { sports: 0.93, politics: 0.05, technology: 0.02 },
        top_label: 'sports',
        text: 'The match was thrilling.',
      };
      mockFetch(200, payload);

      const result = await client.classify('The match was thrilling.', [
        'sports',
        'politics',
        'technology',
      ]);

      expect(result.top_label).toBe('sports');
      expect(typeof result.scores['sports']).toBe('number');
      expect(Object.keys(result.scores)).toHaveLength(3);
    });

    it('includes labels in the POST body', async () => {
      mockFetch(200, { scores: {}, top_label: '', text: '' });
      const mock = global.fetch as jest.Mock;

      await client.classify('text', ['a', 'b']);

      const body = JSON.parse((mock.mock.calls[0][1] as RequestInit).body as string);
      expect(body.labels).toEqual(['a', 'b']);
    });
  });

  // -------------------------------------------------------------------------
  // summarize()
  // -------------------------------------------------------------------------

  describe('summarize()', () => {
    it('returns summary with word counts', async () => {
      const payload = {
        summary: 'A short summary.',
        original_length: 120,
        summary_length: 3,
      };
      mockFetch(200, payload);

      const result = await client.summarize('A long article...');

      expect(result.summary).toBe('A short summary.');
      expect(result.original_length).toBe(120);
      expect(result.summary_length).toBe(3);
    });

    it('forwards maxLength and minLength options', async () => {
      mockFetch(200, { summary: 'x', original_length: 10, summary_length: 1 });
      const mock = global.fetch as jest.Mock;

      await client.summarize('text', { maxLength: 200, minLength: 50 });

      const body = JSON.parse((mock.mock.calls[0][1] as RequestInit).body as string);
      expect(body.max_length).toBe(200);
      expect(body.min_length).toBe(50);
    });
  });

  // -------------------------------------------------------------------------
  // keywords()
  // -------------------------------------------------------------------------

  describe('keywords()', () => {
    it('returns keywords array with scores', async () => {
      const payload = {
        keywords: [
          { word: 'machine learning', score: 0.82 },
          { word: 'neural network', score: 0.75 },
        ],
        text: 'Machine learning and neural networks are great.',
      };
      mockFetch(200, payload);

      const result = await client.keywords('Machine learning and neural networks are great.');

      expect(result.keywords).toHaveLength(2);
      expect(result.keywords[0].word).toBe('machine learning');
      expect(result.keywords[0].score).toBeCloseTo(0.82);
    });

    it('includes top_k in the POST body when provided', async () => {
      mockFetch(200, { keywords: [], text: '' });
      const mock = global.fetch as jest.Mock;

      await client.keywords('text', 5);

      const body = JSON.parse((mock.mock.calls[0][1] as RequestInit).body as string);
      expect(body.top_k).toBe(5);
    });
  });

  // -------------------------------------------------------------------------
  // health()
  // -------------------------------------------------------------------------

  describe('health()', () => {
    it('returns status and models_loaded flags', async () => {
      const payload = {
        status: 'ok',
        models_loaded: {
          sentiment: true,
          ner: false,
          classifier: false,
          summarizer: false,
          keywords: true,
        },
        uptime_seconds: 42.5,
      };
      mockFetch(200, payload);

      const result = await client.health();

      expect(result.status).toBe('ok');
      expect(result.models_loaded.sentiment).toBe(true);
      expect(result.models_loaded.ner).toBe(false);
      expect(result.uptime_seconds).toBe(42.5);
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe('Error handling', () => {
    it('throws NLPipeError when API returns 422', async () => {
      mockFetch(422, { detail: 'text must not be empty' });

      await expect(client.sentiment('')).rejects.toThrow(NLPipeError);
    });

    it('NLPipeError has correct statusCode', async () => {
      mockFetch(422, { detail: 'text must not be empty' });

      try {
        await client.sentiment('');
        fail('Expected NLPipeError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(NLPipeError);
        const nlpErr = err as NLPipeError;
        expect(nlpErr.statusCode).toBe(422);
      }
    });

    it('NLPipeError has correct detail message', async () => {
      mockFetch(422, { detail: 'text must not be empty' });

      try {
        await client.sentiment('');
        fail('Expected NLPipeError to be thrown');
      } catch (err) {
        const nlpErr = err as NLPipeError;
        expect(nlpErr.detail).toBe('text must not be empty');
      }
    });

    it('throws NLPipeError on 413 (text too long)', async () => {
      mockFetch(413, { detail: 'text exceeds the 10,000-character limit' });

      await expect(client.sentiment('x'.repeat(10_001))).rejects.toThrow(NLPipeError);
    });

    it('throws NLPipeError with statusCode 0 on network failure', async () => {
      global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      try {
        await client.health();
        fail('Expected NLPipeError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(NLPipeError);
        const nlpErr = err as NLPipeError;
        expect(nlpErr.statusCode).toBe(0);
        expect(nlpErr.detail).toContain('Network error');
      }
    });

    it('NLPipeError.message contains status code and detail', async () => {
      mockFetch(500, { detail: 'Internal server error' });

      try {
        await client.health();
      } catch (err) {
        const nlpErr = err as NLPipeError;
        expect(nlpErr.message).toContain('500');
        expect(nlpErr.message).toContain('Internal server error');
      }
    });
  });

  // -------------------------------------------------------------------------
  // Base URL normalisation
  // -------------------------------------------------------------------------

  describe('Base URL handling', () => {
    it('strips trailing slash from baseUrl', async () => {
      const c = new NLPipeClient('http://localhost:8000/');
      mockFetch(200, { status: 'ok', models_loaded: {}, uptime_seconds: 0 });
      const mock = global.fetch as jest.Mock;

      await c.health();

      expect(mock.mock.calls[0][0]).toBe('http://localhost:8000/health');
    });

    it('uses http://localhost:8000 as default baseUrl', async () => {
      const c = new NLPipeClient();
      mockFetch(200, { status: 'ok', models_loaded: {}, uptime_seconds: 0 });
      const mock = global.fetch as jest.Mock;

      await c.health();

      expect((mock.mock.calls[0][0] as string).startsWith('http://localhost:8000')).toBe(true);
    });
  });
});
