import React, { useState, useEffect, useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Task = 'sentiment' | 'ner' | 'classify' | 'summarize' | 'keywords';

interface SentimentResult {
  label: string;
  score: number;
  text: string;
}

interface Entity {
  word: string;
  label: string;
  score: number;
  start: number;
  end: number;
}

interface NERResult {
  entities: Entity[];
  text: string;
}

interface ClassifyResult {
  scores: Record<string, number>;
  top_label: string;
  text: string;
}

interface SummarizeResult {
  summary: string;
  original_length: number;
  summary_length: number;
}

interface Keyword {
  word: string;
  score: number;
}

interface KeywordsResult {
  keywords: Keyword[];
  text: string;
}

type AnyResult = SentimentResult | NERResult | ClassifyResult | SummarizeResult | KeywordsResult;

interface HealthStatus {
  online: boolean;
  uptime?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE = 'http://localhost:8000';
const MAX_CHARS = 2000;

const TASKS: { id: Task; label: string; icon: string; description: string }[] = [
  { id: 'sentiment', label: 'Sentiment', icon: '😊', description: 'Positive / negative analysis' },
  { id: 'ner',       label: 'NER',       icon: '🏷️', description: 'Named entity recognition' },
  { id: 'classify',  label: 'Zero-Shot', icon: '🎯', description: 'Label without fine-tuning' },
  { id: 'summarize', label: 'Summarize', icon: '📝', description: 'Abstractive summarization' },
  { id: 'keywords',  label: 'Keywords',  icon: '🔑', description: 'TF-IDF keyword extraction' },
];

const ENTITY_COLORS: Record<string, { bg: string; text: string }> = {
  PER:  { bg: 'bg-purple-500/20', text: 'text-purple-300' },
  ORG:  { bg: 'bg-blue-500/20',   text: 'text-blue-300'   },
  LOC:  { bg: 'bg-green-500/20',  text: 'text-green-300'  },
  MISC: { bg: 'bg-yellow-500/20', text: 'text-yellow-300' },
  PER_: { bg: 'bg-purple-500/20', text: 'text-purple-300' },
};

function getEntityColor(label: string) {
  const key = label.replace(/[^A-Z]/g, '').slice(0, 4);
  return ENTITY_COLORS[key] ?? { bg: 'bg-gray-500/20', text: 'text-gray-300' };
}

const SAMPLE_TEXTS: Record<Task, string> = {
  sentiment: 'The new MacBook Pro is absolutely incredible. The performance is stunning and the build quality is flawless. Best laptop I have ever owned.',
  ner:       'Apple CEO Tim Cook announced yesterday that the company will open a new headquarters in Austin, Texas, partnering with Amazon and Google on cloud infrastructure.',
  classify:  'Scientists have discovered a new species of deep-sea fish near the Mariana Trench, exhibiting bioluminescent properties never seen before in vertebrates.',
  summarize: `Artificial intelligence has rapidly transformed industries across the globe, from healthcare to finance, and from transportation to education. Machine learning algorithms now power recommendation systems that suggest products, movies, and music to billions of users daily. In the medical field, AI systems have demonstrated remarkable ability to detect diseases like cancer from imaging data, sometimes outperforming experienced radiologists. Autonomous vehicles use deep learning to navigate complex urban environments, processing vast amounts of sensor data in real time. In finance, algorithmic trading systems execute millions of transactions per second based on pattern recognition and predictive analytics. The education sector has seen the rise of personalised learning platforms that adapt curriculum to individual students' strengths and weaknesses. Despite these advances, significant challenges remain around bias in training data, explainability of model decisions, and the societal implications of large-scale automation.`,
  keywords:  'Deep learning models are revolutionising natural language processing tasks such as machine translation, text generation, and question answering. Transformer architectures like BERT and GPT have set new benchmarks across numerous NLP benchmarks.',
};

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function apiFetch<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Sub-components: Results
// ---------------------------------------------------------------------------

function SentimentDisplay({ result }: { result: SentimentResult }) {
  const isPositive = result.label === 'POSITIVE';
  const pct = (result.score * 100).toFixed(1);
  return (
    <div className="flex flex-col items-center gap-6 py-6">
      <div
        className={`text-7xl font-black tracking-tight ${
          isPositive ? 'text-green-400' : 'text-red-400'
        }`}
      >
        {isPositive ? '👍' : '👎'}
      </div>
      <span
        className={`badge text-lg px-5 py-2 ${
          isPositive
            ? 'bg-green-500/15 text-green-300 ring-1 ring-green-500/30'
            : 'bg-red-500/15 text-red-300 ring-1 ring-red-500/30'
        }`}
      >
        {result.label}
      </span>
      <div className="w-full max-w-sm">
        <div className="flex justify-between text-xs text-gray-400 mb-2">
          <span>Confidence</span>
          <span className="font-mono font-semibold text-gray-200">{pct}%</span>
        </div>
        <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full bar-animated ${
              isPositive ? 'bg-green-500' : 'bg-red-500'
            }`}
            style={{ '--bar-width': `${pct}%`, width: `${pct}%` } as React.CSSProperties}
          />
        </div>
      </div>
    </div>
  );
}

function NERDisplay({ result }: { result: NERResult }) {
  if (result.entities.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500">
        No named entities found in the text.
      </div>
    );
  }

  // Build annotated segments
  const text = result.text;
  const segments: { content: string; entity?: Entity }[] = [];
  let cursor = 0;
  const sorted = [...result.entities].sort((a, b) => a.start - b.start);

  for (const ent of sorted) {
    if (ent.start > cursor) {
      segments.push({ content: text.slice(cursor, ent.start) });
    }
    segments.push({ content: text.slice(ent.start, ent.end), entity: ent });
    cursor = ent.end;
  }
  if (cursor < text.length) {
    segments.push({ content: text.slice(cursor) });
  }

  return (
    <div className="space-y-6">
      <div className="leading-9 text-gray-200 text-sm font-sans">
        {segments.map((seg, i) =>
          seg.entity ? (
            <span key={i} className="inline-flex items-baseline gap-1">
              <span className={`px-1 rounded font-medium ${getEntityColor(seg.entity.label).bg} ${getEntityColor(seg.entity.label).text}`}>
                {seg.content}
              </span>
              <span className={`entity-tag ${getEntityColor(seg.entity.label).bg} ${getEntityColor(seg.entity.label).text}`}>
                {seg.entity.label}
              </span>
            </span>
          ) : (
            <span key={i}>{seg.content}</span>
          ),
        )}
      </div>

      <div className="border-t border-gray-800 pt-4">
        <p className="text-xs text-gray-500 mb-3 uppercase tracking-widest">Entities found</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {sorted.map((ent, i) => (
            <div
              key={i}
              className={`flex items-center justify-between px-3 py-2 rounded-lg ${getEntityColor(ent.label).bg}`}
            >
              <span className={`font-medium text-sm ${getEntityColor(ent.label).text}`}>
                {ent.word}
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold ${getEntityColor(ent.label).text}`}>
                  {ent.label}
                </span>
                <span className="text-xs text-gray-500 font-mono">
                  {(ent.score * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ClassifyDisplay({ result }: { result: ClassifyResult }) {
  const entries = Object.entries(result.scores).sort(([, a], [, b]) => b - a);
  const max = entries[0]?.[1] ?? 1;

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Label scores</p>
      {entries.map(([label, score]) => {
        const pct = (score * 100).toFixed(1);
        const barWidth = ((score / max) * 100).toFixed(1);
        const isTop = label === result.top_label;
        return (
          <div key={label} className="space-y-1">
            <div className="flex justify-between items-center text-sm">
              <span className={`font-medium ${isTop ? 'text-brand-300' : 'text-gray-300'}`}>
                {label}
                {isTop && (
                  <span className="ml-2 text-xs badge bg-brand-500/20 text-brand-300 ring-1 ring-brand-500/30">
                    top
                  </span>
                )}
              </span>
              <span className="font-mono text-xs text-gray-400">{pct}%</span>
            </div>
            <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full bar-animated ${isTop ? 'bg-brand-500' : 'bg-gray-600'}`}
                style={{ '--bar-width': `${barWidth}%`, width: `${barWidth}%` } as React.CSSProperties}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SummarizeDisplay({ result }: { result: SummarizeResult }) {
  const reduction = (
    ((result.original_length - result.summary_length) / result.original_length) *
    100
  ).toFixed(0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Original words', value: result.original_length },
          { label: 'Summary words', value: result.summary_length },
          { label: 'Reduction', value: `${reduction}%` },
        ].map((stat) => (
          <div key={stat.label} className="card p-4 text-center">
            <div className="text-2xl font-bold text-brand-400">{stat.value}</div>
            <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>
      <div className="card p-5">
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Summary</p>
        <p className="text-gray-200 text-sm leading-relaxed">{result.summary}</p>
      </div>
    </div>
  );
}

function KeywordsDisplay({ result }: { result: KeywordsResult }) {
  if (result.keywords.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500">No keywords extracted.</div>
    );
  }

  const max = result.keywords[0]?.score ?? 1;

  return (
    <div className="space-y-6">
      {/* Tag cloud */}
      <div className="flex flex-wrap gap-2 py-2">
        {result.keywords.map((kw, i) => {
          const relSize = 0.75 + (kw.score / max) * 0.75; // 0.75rem – 1.5rem
          const opacity = 0.5 + (kw.score / max) * 0.5;
          return (
            <span
              key={i}
              className="px-3 py-1.5 rounded-full bg-brand-600/15 text-brand-300 ring-1 ring-brand-500/20 font-medium cursor-default hover:bg-brand-600/30 transition-colors"
              style={{ fontSize: `${relSize}rem`, opacity }}
              title={`Score: ${kw.score.toFixed(4)}`}
            >
              {kw.word}
            </span>
          );
        })}
      </div>

      {/* Table */}
      <div className="border-t border-gray-800 pt-4">
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">TF-IDF scores</p>
        <div className="space-y-1.5">
          {result.keywords.map((kw, i) => {
            const barWidth = ((kw.score / max) * 100).toFixed(1);
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-4 text-right">{i + 1}</span>
                <span className="text-sm text-gray-200 w-40 truncate font-medium">{kw.word}</span>
                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand-500 bar-animated"
                    style={{ '--bar-width': `${barWidth}%`, width: `${barWidth}%` } as React.CSSProperties}
                  />
                </div>
                <span className="font-mono text-xs text-gray-500 w-16 text-right">
                  {kw.score.toFixed(4)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

function Spinner() {
  return (
    <svg
      className="spinner w-5 h-5 text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------

export default function App() {
  const [activeTask, setActiveTask] = useState<Task>('sentiment');
  const [text, setText] = useState(SAMPLE_TEXTS['sentiment']);
  const [labels, setLabels] = useState('technology, politics, sports, science, entertainment');
  const [maxLength, setMaxLength] = useState(130);
  const [minLength, setMinLength] = useState(30);
  const [topK, setTopK] = useState(10);
  const [result, setResult] = useState<AnyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processTime, setProcessTime] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthStatus>({ online: false });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Health check on mount and every 30 s
  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = await res.json();
          setHealth({ online: true, uptime: data.uptime_seconds });
        } else {
          setHealth({ online: false });
        }
      } catch {
        setHealth({ online: false });
      }
    }
    checkHealth();
    const id = setInterval(checkHealth, 30_000);
    return () => clearInterval(id);
  }, []);

  const switchTask = useCallback((task: Task) => {
    setActiveTask(task);
    setText(SAMPLE_TEXTS[task]);
    setResult(null);
    setError(null);
    setProcessTime(null);
    setSidebarOpen(false);
  }, []);

  const runInference = useCallback(async () => {
    if (!text.trim()) return;
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);
    setResult(null);
    setProcessTime(null);

    const t0 = performance.now();

    try {
      let data: AnyResult;
      switch (activeTask) {
        case 'sentiment':
          data = await apiFetch<SentimentResult>('/sentiment', { text });
          break;
        case 'ner':
          data = await apiFetch<NERResult>('/ner', { text });
          break;
        case 'classify': {
          const labelList = labels
            .split(',')
            .map((l) => l.trim())
            .filter(Boolean);
          if (labelList.length === 0) throw new Error('Please enter at least one label');
          data = await apiFetch<ClassifyResult>('/classify', { text, labels: labelList });
          break;
        }
        case 'summarize':
          data = await apiFetch<SummarizeResult>('/summarize', {
            text,
            max_length: maxLength,
            min_length: minLength,
          });
          break;
        case 'keywords':
          data = await apiFetch<KeywordsResult>('/keywords', { text, top_k: topK });
          break;
      }
      setResult(data);
      setProcessTime(`${((performance.now() - t0) / 1000).toFixed(2)}s`);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [activeTask, text, labels, maxLength, minLength, topK]);

  const currentTask = TASKS.find((t) => t.id === activeTask)!;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* ------------------------------------------------------------------ */}
      {/* Top bar */}
      {/* ------------------------------------------------------------------ */}
      <header className="border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile menu toggle */}
            <button
              className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
              onClick={() => setSidebarOpen((o) => !o)}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center font-black text-white text-sm">
                NL
              </div>
              <span className="font-bold text-lg tracking-tight gradient-text">NLPipe</span>
              <span className="hidden sm:inline text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full font-mono">
                v1.0
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* API status */}
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`w-2 h-2 rounded-full ${health.online ? 'bg-green-400 pulse-dot' : 'bg-red-500'}`}
              />
              <span className={health.online ? 'text-green-400' : 'text-red-400'}>
                {health.online ? 'API online' : 'API offline'}
              </span>
              {health.online && health.uptime !== undefined && (
                <span className="text-gray-600 hidden sm:inline">
                  · up {Math.floor(health.uptime / 60)}m
                </span>
              )}
            </div>

            <a
              href={`${API_BASE}/docs`}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              API Docs
            </a>
          </div>
        </div>
      </header>

      {/* API offline banner */}
      {!health.online && (
        <div className="bg-red-900/40 border-b border-red-800/50 px-4 py-2.5 text-center text-sm text-red-300">
          ⚠️  Cannot reach the NLPipe API at <code className="font-mono text-red-200">{API_BASE}</code>.
          &nbsp;Start the server with <code className="font-mono text-red-200">docker-compose up</code> or{' '}
          <code className="font-mono text-red-200">uvicorn main:app --reload</code>.
        </div>
      )}

      <div className="flex flex-1 max-w-screen-xl mx-auto w-full">
        {/* ---------------------------------------------------------------- */}
        {/* Sidebar */}
        {/* ---------------------------------------------------------------- */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-30 w-64 bg-gray-950 border-r border-gray-800/60 pt-20 pb-8 px-4
            transform transition-transform duration-300 lg:static lg:transform-none lg:pt-8
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}
        >
          {/* Overlay (mobile) */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/60 z-[-1] lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          <div className="space-y-1">
            <p className="text-xs text-gray-600 font-semibold uppercase tracking-widest px-4 mb-3">
              Tasks
            </p>
            {TASKS.map((task) => (
              <button
                key={task.id}
                onClick={() => switchTask(task.id)}
                className={`sidebar-item w-full text-left ${
                  activeTask === task.id ? 'sidebar-item-active' : 'sidebar-item-inactive'
                }`}
              >
                <span className="text-lg leading-none">{task.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{task.label}</div>
                  <div
                    className={`text-xs truncate ${
                      activeTask === task.id ? 'text-brand-200' : 'text-gray-600'
                    }`}
                  >
                    {task.description}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-8 px-4">
            <div className="card p-4 space-y-2">
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest">
                About
              </p>
              <p className="text-xs text-gray-400 leading-relaxed">
                Self-hosted NLP inference. 5 tasks, 0 API keys. All models run locally on your hardware.
              </p>
              <a
                href="https://github.com/shivansh-mishra/nlpipe"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-brand-400 hover:text-brand-300 transition"
              >
                GitHub →
              </a>
            </div>
          </div>
        </aside>

        {/* ---------------------------------------------------------------- */}
        {/* Main content */}
        {/* ---------------------------------------------------------------- */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 min-w-0">
          {/* Task header */}
          <div className="flex items-center gap-3">
            <span className="text-3xl">{currentTask.icon}</span>
            <div>
              <h1 className="text-xl font-bold text-white">{currentTask.label}</h1>
              <p className="text-sm text-gray-400">{currentTask.description}</p>
            </div>
          </div>

          {/* Input card */}
          <div className="card p-5 space-y-4">
            {/* Text area */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                  Input Text
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setText(SAMPLE_TEXTS[activeTask])}
                    className="text-xs text-brand-400 hover:text-brand-300 transition"
                  >
                    Load sample
                  </button>
                  <span
                    className={`text-xs font-mono ${
                      text.length > MAX_CHARS * 0.9 ? 'text-red-400' : 'text-gray-600'
                    }`}
                  >
                    {text.length} / {MAX_CHARS}
                  </span>
                </div>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
                placeholder={`Enter text for ${currentTask.label.toLowerCase()}…`}
                rows={6}
                className="input-base"
              />
            </div>

            {/* Zero-shot labels */}
            {activeTask === 'classify' && (
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block mb-2">
                  Candidate Labels{' '}
                  <span className="text-gray-600 normal-case font-normal">(comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={labels}
                  onChange={(e) => setLabels(e.target.value)}
                  placeholder="e.g. technology, sports, politics"
                  className="input-base"
                />
              </div>
            )}

            {/* Summarize sliders */}
            {activeTask === 'summarize' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block mb-2">
                    Max length <span className="text-brand-400 font-mono">{maxLength}</span>
                  </label>
                  <input
                    type="range"
                    min={50}
                    max={512}
                    step={10}
                    value={maxLength}
                    onChange={(e) => setMaxLength(Number(e.target.value))}
                    className="w-full accent-brand-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block mb-2">
                    Min length <span className="text-brand-400 font-mono">{minLength}</span>
                  </label>
                  <input
                    type="range"
                    min={10}
                    max={200}
                    step={5}
                    value={minLength}
                    onChange={(e) => setMinLength(Number(e.target.value))}
                    className="w-full accent-brand-500"
                  />
                </div>
              </div>
            )}

            {/* Keywords top-k */}
            {activeTask === 'keywords' && (
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block mb-2">
                  Top-K keywords <span className="text-brand-400 font-mono">{topK}</span>
                </label>
                <input
                  type="range"
                  min={3}
                  max={30}
                  step={1}
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  className="w-full accent-brand-500"
                />
              </div>
            )}

            {/* Run button */}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={runInference}
                disabled={loading || !text.trim()}
                className="btn-primary"
              >
                {loading ? (
                  <>
                    <Spinner />
                    Running…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Run {currentTask.label}
                  </>
                )}
              </button>
              {processTime && !loading && (
                <span className="text-xs text-gray-500 font-mono">
                  Completed in {processTime}
                </span>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="card border-red-800/50 bg-red-900/20 p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-red-300">Error</p>
                <p className="text-xs text-red-400 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Results */}
          {result && !loading && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                  Results
                </p>
                <button
                  onClick={() => setResult(null)}
                  className="text-xs text-gray-600 hover:text-gray-400 transition"
                >
                  Clear
                </button>
              </div>

              {activeTask === 'sentiment' && (
                <SentimentDisplay result={result as SentimentResult} />
              )}
              {activeTask === 'ner' && (
                <NERDisplay result={result as NERResult} />
              )}
              {activeTask === 'classify' && (
                <ClassifyDisplay result={result as ClassifyResult} />
              )}
              {activeTask === 'summarize' && (
                <SummarizeDisplay result={result as SummarizeResult} />
              )}
              {activeTask === 'keywords' && (
                <KeywordsDisplay result={result as KeywordsResult} />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
