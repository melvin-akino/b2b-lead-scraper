import { useEffect, useState } from 'react';
import { Eye, EyeOff, CheckCircle, XCircle, Loader } from 'lucide-react';
import { fetchSettings, saveSettings, testApiKey } from '../lib/api';

type TestState = 'idle' | 'loading' | 'ok' | 'fail';

export default function Settings() {
  const [apiKey, setApiKey]         = useState('');
  const [headless, setHeadless]     = useState(true);
  const [apiKeySet, setApiKeySet]   = useState(false);
  const [showKey, setShowKey]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [testState, setTestState]   = useState<TestState>('idle');
  const [testMsg, setTestMsg]       = useState('');

  useEffect(() => {
    fetchSettings().then((s) => {
      setApiKeySet(s.apiKeySet);
      setHeadless(s.headless);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await saveSettings({ apiKey: apiKey || undefined, headless });
    setSaving(false);
    setSaved(true);
    setApiKeySet(true);
    setApiKey('');
    setTimeout(() => setSaved(false), 2500);
  };

  const handleTest = async () => {
    setTestState('loading');
    setTestMsg('');
    const result = await testApiKey();
    setTestState(result.success ? 'ok' : 'fail');
    setTestMsg(result.message ?? result.error ?? '');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Configure your API key and scraper behaviour</p>
      </div>

      {/* API Key card */}
      <div className="card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">Anthropic API Key</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Required to run the research and personalisation pipeline.
            Get one at <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" className="text-violet-400 hover:underline">console.anthropic.com</a>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type={showKey ? 'text' : 'password'}
              className="input pr-10"
              placeholder={apiKeySet ? 'sk-ant-...••••••  (saved)' : 'sk-ant-api03-...'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <button
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <button
            onClick={handleTest}
            disabled={!apiKeySet && !apiKey}
            className="btn-secondary text-sm py-2 px-3 whitespace-nowrap"
          >
            {testState === 'loading' ? <Loader size={14} className="animate-spin" /> : 'Test Key'}
          </button>
        </div>

        {testState !== 'idle' && testState !== 'loading' && (
          <div className={`flex items-center gap-2 text-sm ${testState === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
            {testState === 'ok' ? <CheckCircle size={14} /> : <XCircle size={14} />}
            {testMsg}
          </div>
        )}

        {apiKeySet && (
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <CheckCircle size={12} /> API key is saved
          </div>
        )}
      </div>

      {/* Scraper config */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-200">Scraper Config</h2>

        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative mt-0.5">
            <input
              type="checkbox"
              className="sr-only"
              checked={headless}
              onChange={(e) => setHeadless(e.target.checked)}
            />
            <div className={`w-9 h-5 rounded-full transition-colors ${headless ? 'bg-violet-600' : 'bg-slate-700'}`} />
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${headless ? 'translate-x-4' : ''}`} />
          </div>
          <div>
            <p className="text-sm text-slate-300 font-medium">Headless mode</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Run browser in the background. Disable to watch scraping in real time (slower, useful for debugging).
            </p>
          </div>
        </label>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving || (!apiKey && true)}
        className="btn-primary flex items-center gap-2"
      >
        {saving ? (
          <><Loader size={14} className="animate-spin" /> Saving...</>
        ) : saved ? (
          <><CheckCircle size={14} /> Saved!</>
        ) : (
          'Save Settings'
        )}
      </button>
    </div>
  );
}
