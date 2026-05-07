import { useEffect, useState } from 'react';
import { Eye, EyeOff, CheckCircle, XCircle, Loader, ExternalLink, Zap } from 'lucide-react';
import {
  fetchSettings, saveSettings, testApiKey, fetchProviderModels,
  Settings, ProviderName, ModelOption,
} from '../lib/api';
import clsx from 'clsx';

type TestState = 'idle' | 'loading' | 'ok' | 'fail';

// ── Provider metadata ─────────────────────────────────────────────────────────

const PROVIDER_DOCS: Record<ProviderName, { url: string; keyUrl: string; desc: string; color: string }> = {
  anthropic: {
    url: 'https://anthropic.com',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    desc: 'Most reliable JSON output. Prompt caching cuts costs 80% on batches.',
    color: 'border-orange-700/50 bg-orange-950/20',
  },
  groq: {
    url: 'https://groq.com',
    keyUrl: 'https://console.groq.com/keys',
    desc: 'Fastest inference available (LPU hardware). Generous free tier.',
    color: 'border-pink-700/50 bg-pink-950/20',
  },
  gemini: {
    url: 'https://ai.google.dev',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    desc: 'Free via Google AI Studio. gemini-1.5-flash has a 1M token context window.',
    color: 'border-blue-700/50 bg-blue-950/20',
  },
  ollama: {
    url: 'https://ollama.com',
    keyUrl: 'https://ollama.com/download',
    desc: '100% local — no API costs, no data leaves your machine. Needs Ollama installed.',
    color: 'border-emerald-700/50 bg-emerald-950/20',
  },
  openrouter: {
    url: 'https://openrouter.ai',
    keyUrl: 'https://openrouter.ai/keys',
    desc: 'One key, 50+ models. Many permanently free (Llama, Mistral, Gemma).',
    color: 'border-violet-700/50 bg-violet-950/20',
  },
};

const PROVIDER_ICONS: Record<ProviderName, string> = {
  anthropic:  '🟠',
  groq:       '⚡',
  gemini:     '🔵',
  ollama:     '🟢',
  openrouter: '🔀',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function Settings() {
  const [settings, setSettings]           = useState<Settings | null>(null);
  const [allModels, setAllModels]         = useState<Record<ProviderName, ModelOption[]> | null>(null);
  const [activeProvider, setActiveProvider] = useState<ProviderName>('anthropic');

  // Per-provider form state
  const [keyInputs, setKeyInputs]         = useState<Partial<Record<ProviderName, string>>>({});
  const [modelInputs, setModelInputs]     = useState<Partial<Record<ProviderName, string>>>({});
  const [ollamaUrl, setOllamaUrl]         = useState('http://localhost:11434');
  const [headless, setHeadless]           = useState(true);

  const [showKeys, setShowKeys]           = useState<Partial<Record<ProviderName, boolean>>>({});
  const [saving, setSaving]               = useState(false);
  const [saved, setSaved]                 = useState(false);
  const [testState, setTestState]         = useState<TestState>('idle');
  const [testMsg, setTestMsg]             = useState('');

  useEffect(() => {
    Promise.all([fetchSettings(), fetchProviderModels()]).then(([s, m]) => {
      setSettings(s);
      setAllModels(m);
      setActiveProvider(s.provider);
      setHeadless(s.headless);
      setOllamaUrl(s.ollamaUrl ?? 'http://localhost:11434');
      // Pre-populate model selections from saved settings
      setModelInputs(s.providerModels as Partial<Record<ProviderName, string>>);
    });
  }, []);

  const handleProviderSelect = async (p: ProviderName) => {
    setActiveProvider(p);
    setTestState('idle');
    setTestMsg('');
    await saveSettings({ provider: p });
    setSettings((prev) => prev ? { ...prev, provider: p } : prev);
  };

  const handleSaveKey = async (provider: ProviderName) => {
    const key = keyInputs[provider];
    const model = modelInputs[provider];
    setSaving(true);
    await saveSettings({ provider, providerKey: key, model });
    // Refresh settings to get updated masked key
    const updated = await fetchSettings();
    setSettings(updated);
    setKeyInputs((prev) => ({ ...prev, [provider]: '' }));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSaveModel = async (provider: ProviderName, model: string) => {
    setModelInputs((prev) => ({ ...prev, [provider]: model }));
    await saveSettings({ provider, model });
  };

  const handleSaveOllama = async () => {
    setSaving(true);
    await saveSettings({ ollamaUrl, headless });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSaveHeadless = async (val: boolean) => {
    setHeadless(val);
    await saveSettings({ headless: val });
  };

  const handleTest = async () => {
    setTestState('loading');
    setTestMsg('');
    const result = await testApiKey();
    setTestState(result.success ? 'ok' : 'fail');
    setTestMsg(result.message ?? result.error ?? '');
  };

  if (!settings || !allModels) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader size={20} className="animate-spin text-violet-400" />
      </div>
    );
  }

  const activeProviderMeta = settings.providers.find((p) => p.value === activeProvider);
  const docs = PROVIDER_DOCS[activeProvider];
  const models = allModels[activeProvider] ?? [];
  const savedMaskedKey = settings.providerKeys[activeProvider] ?? '';
  const savedModel = settings.providerModels[activeProvider]
    ?? settings.defaultModels[activeProvider] ?? '';
  const currentModel = modelInputs[activeProvider] ?? savedModel;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Choose your AI provider and configure credentials</p>
      </div>

      {/* ── Provider selector ──────────────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-200">AI Provider</h2>
        <div className="grid grid-cols-5 gap-2">
          {settings.providers.map((p) => (
            <button
              key={p.value}
              onClick={() => handleProviderSelect(p.value)}
              className={clsx(
                'flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-center transition-all',
                activeProvider === p.value
                  ? 'border-violet-500 bg-violet-600/20 text-violet-300'
                  : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-300'
              )}
            >
              <span className="text-2xl">{PROVIDER_ICONS[p.value]}</span>
              <span className="text-xs font-medium leading-tight">{p.label}</span>
              {p.free && (
                <span className="badge bg-emerald-900/40 text-emerald-400 text-[10px]">FREE</span>
              )}
            </button>
          ))}
        </div>

        {/* Active provider indicator */}
        {settings.provider === activeProvider && (
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <CheckCircle size={12} /> Active provider
          </div>
        )}
      </div>

      {/* ── Provider config card ───────────────────────────────────────────── */}
      <div className={clsx('card p-5 space-y-4 border', docs.color)}>
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">{PROVIDER_ICONS[activeProvider]}</span>
              <h2 className="text-sm font-semibold text-slate-200">
                {activeProviderMeta?.label ?? activeProvider}
              </h2>
              {activeProviderMeta?.free && (
                <span className="badge bg-emerald-900/40 text-emerald-400">Free</span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">{docs.desc}</p>
          </div>
          <a
            href={docs.keyUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors whitespace-nowrap"
          >
            {activeProvider === 'ollama' ? 'Install Ollama' : 'Get API key'}
            <ExternalLink size={11} />
          </a>
        </div>

        {/* API key field (not shown for Ollama) */}
        {activeProvider !== 'ollama' && (
          <div>
            <label className="label">
              API Key {savedMaskedKey && <span className="text-emerald-500 normal-case font-normal">— {savedMaskedKey} saved</span>}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKeys[activeProvider] ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder={savedMaskedKey ? 'Enter new key to update...' : `Paste your ${activeProvider} API key`}
                  value={keyInputs[activeProvider] ?? ''}
                  onChange={(e) => setKeyInputs((prev) => ({ ...prev, [activeProvider]: e.target.value }))}
                />
                <button
                  onClick={() => setShowKeys((prev) => ({ ...prev, [activeProvider]: !prev[activeProvider] }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showKeys[activeProvider] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                onClick={() => handleSaveKey(activeProvider)}
                disabled={saving || (!keyInputs[activeProvider] && !savedMaskedKey)}
                className="btn-primary text-sm py-2 px-4 whitespace-nowrap"
              >
                {saving ? <Loader size={14} className="animate-spin" /> : saved ? '✓ Saved' : 'Save Key'}
              </button>
            </div>
          </div>
        )}

        {/* Ollama base URL */}
        {activeProvider === 'ollama' && (
          <div>
            <label className="label">Ollama Base URL</label>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                placeholder="http://localhost:11434"
              />
              <button onClick={handleSaveOllama} disabled={saving} className="btn-primary text-sm py-2 px-4">
                {saving ? <Loader size={14} className="animate-spin" /> : saved ? '✓ Saved' : 'Save'}
              </button>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Make sure Ollama is running locally. Run <code className="text-violet-400">ollama pull llama3.2</code> to download a model.
            </p>
          </div>
        )}

        {/* Model selector */}
        <div>
          <label className="label">Model</label>
          <select
            className="input"
            value={currentModel}
            onChange={(e) => handleSaveModel(activeProvider, e.target.value)}
          >
            {models.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Test connection */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleTest}
            disabled={testState === 'loading' || (activeProvider !== 'ollama' && !savedMaskedKey && !keyInputs[activeProvider])}
            className="btn-secondary text-sm py-1.5 flex items-center gap-2"
          >
            {testState === 'loading'
              ? <><Loader size={14} className="animate-spin" /> Testing...</>
              : <><Zap size={14} /> Test Connection</>}
          </button>
          {testState !== 'idle' && testState !== 'loading' && (
            <span className={clsx('flex items-center gap-1.5 text-sm', testState === 'ok' ? 'text-emerald-400' : 'text-red-400')}>
              {testState === 'ok' ? <CheckCircle size={14} /> : <XCircle size={14} />}
              {testMsg}
            </span>
          )}
        </div>
      </div>

      {/* ── Scraper config ─────────────────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-200">Scraper Config</h2>
        <label className="flex items-start gap-3 cursor-pointer">
          <div className="relative mt-0.5 flex-shrink-0">
            <input type="checkbox" className="sr-only" checked={headless} onChange={(e) => handleSaveHeadless(e.target.checked)} />
            <div className={clsx('w-9 h-5 rounded-full transition-colors', headless ? 'bg-violet-600' : 'bg-slate-700')} />
            <div className={clsx('absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform', headless ? 'translate-x-4' : '')} />
          </div>
          <div>
            <p className="text-sm text-slate-300 font-medium">Headless mode</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Run browser invisibly. Disable to watch scraping in real time — useful for debugging.
            </p>
          </div>
        </label>
      </div>

      {/* ── Free providers guide ───────────────────────────────────────────── */}
      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">Free Provider Quick-Start</h2>
        <div className="grid grid-cols-2 gap-3 text-xs">
          {[
            { icon: '⚡', name: 'Groq', steps: ['Sign up at console.groq.com', 'Create an API key (free)', 'Recommended: llama-3.3-70b-versatile'] },
            { icon: '🔵', name: 'Gemini', steps: ['Go to aistudio.google.com', 'Click "Get API key" (free)', 'Recommended: gemini-1.5-flash'] },
            { icon: '🟢', name: 'Ollama', steps: ['Install from ollama.com', 'Run: ollama pull llama3.2', 'No API key needed'] },
            { icon: '🔀', name: 'OpenRouter', steps: ['Sign up at openrouter.ai', 'Create API key (free models available)', 'Use any model ending in :free'] },
          ].map(({ icon, name, steps }) => (
            <div key={name} className="bg-slate-950 rounded-lg p-3 space-y-1.5">
              <p className="font-semibold text-slate-300">{icon} {name}</p>
              {steps.map((s, i) => (
                <p key={i} className="text-slate-500 flex gap-1.5">
                  <span className="text-slate-700">{i + 1}.</span> {s}
                </p>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
