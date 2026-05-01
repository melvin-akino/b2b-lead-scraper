import { useState } from 'react';
import { Plus, Trash2, Upload, ChevronDown, ChevronUp } from 'lucide-react';
import { LeadInput, ProgressEvent, scrape } from '../lib/api';
import clsx from 'clsx';

interface ScrapeFormProps {
  onLog: (event: ProgressEvent) => void;
  onComplete: () => void;
  onRunningChange: (v: boolean) => void;
}

const emptyLead = (): LeadInput => ({
  prospect_name: '',
  role: '',
  company_name: '',
  website_url: '',
  linkedin_url: '',
});

export default function ScrapeForm({ onLog, onComplete, onRunningChange }: ScrapeFormProps) {
  const [tab, setTab] = useState<'single' | 'batch'>('single');
  const [inputs, setInputs] = useState<LeadInput[]>([emptyLead()]);
  const [batchText, setBatchText] = useState('');
  const [context, setContext] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);

  const updateInput = (i: number, field: keyof LeadInput, val: string) => {
    setInputs((prev) => prev.map((inp, idx) => idx === i ? { ...inp, [field]: val } : inp));
  };

  const addRow = () => {
    setInputs((prev) => [...prev, emptyLead()]);
    setExpandedIdx(inputs.length);
  };

  const removeRow = (i: number) => {
    setInputs((prev) => prev.filter((_, idx) => idx !== i));
    setExpandedIdx(null);
  };

  const handleSubmit = async () => {
    setError('');
    let payload: LeadInput[];

    if (tab === 'batch') {
      try {
        payload = JSON.parse(batchText) as LeadInput[];
        if (!Array.isArray(payload)) throw new Error('Must be a JSON array');
      } catch (e) {
        setError(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
    } else {
      payload = inputs;
    }

    // Basic validation
    for (const [i, inp] of payload.entries()) {
      if (!inp.prospect_name || !inp.role || !inp.company_name || !inp.website_url) {
        setError(`Lead ${i + 1} is missing required fields (name, role, company, website).`);
        return;
      }
    }

    setIsRunning(true);
    onRunningChange(true);

    try {
      for await (const event of scrape({ inputs: payload, context: context || undefined })) {
        onLog(event);
        if (event.type === 'complete') {
          onComplete();
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      onLog({ type: 'error', message: msg });
    } finally {
      setIsRunning(false);
      onRunningChange(false);
    }
  };

  return (
    <div className="card p-5 space-y-5">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-slate-950 p-1 rounded-lg w-fit">
        {(['single', 'batch'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize',
              tab === t ? 'bg-slate-800 text-slate-100' : 'text-slate-500 hover:text-slate-300'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Single mode */}
      {tab === 'single' && (
        <div className="space-y-3">
          {inputs.map((inp, i) => (
            <div key={i} className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-slate-300 hover:bg-slate-800/50 transition-colors"
                onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
              >
                <span className="font-medium">
                  {inp.prospect_name || `Lead ${i + 1}`}
                  {inp.company_name && <span className="text-slate-500 font-normal"> @ {inp.company_name}</span>}
                </span>
                <div className="flex items-center gap-2">
                  {inputs.length > 1 && (
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); removeRow(i); }}
                      className="text-slate-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </span>
                  )}
                  {expandedIdx === i ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </button>

              {expandedIdx === i && (
                <div className="px-4 pb-4 grid grid-cols-2 gap-3 border-t border-slate-800 pt-4">
                  {(
                    [
                      { f: 'prospect_name', label: 'Full Name *', placeholder: 'Maria Santos' },
                      { f: 'role',          label: 'Role / Title *', placeholder: 'CEO' },
                      { f: 'company_name',  label: 'Company *', placeholder: 'Kumu' },
                      { f: 'website_url',   label: 'Website URL *', placeholder: 'https://kumu.live' },
                    ] as { f: keyof LeadInput; label: string; placeholder: string }[]
                  ).map(({ f, label, placeholder }) => (
                    <div key={f}>
                      <label className="label">{label}</label>
                      <input
                        className="input"
                        placeholder={placeholder}
                        value={inp[f] ?? ''}
                        onChange={(e) => updateInput(i, f, e.target.value)}
                      />
                    </div>
                  ))}
                  <div className="col-span-2">
                    <label className="label">LinkedIn URL (optional)</label>
                    <input
                      className="input"
                      placeholder="https://linkedin.com/company/kumu-ph"
                      value={inp.linkedin_url ?? ''}
                      onChange={(e) => updateInput(i, 'linkedin_url', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}

          <button onClick={addRow} className="flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition-colors">
            <Plus size={14} /> Add another lead
          </button>
        </div>
      )}

      {/* Batch mode */}
      {tab === 'batch' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="label mb-0">Paste JSON array of leads</label>
            <button
              className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
              onClick={() => setBatchText(JSON.stringify([
                { prospect_name: 'Maria Santos', role: 'CEO', company_name: 'Kumu', website_url: 'https://kumu.live' }
              ], null, 2))}
            >
              <Upload size={12} /> Load example
            </button>
          </div>
          <textarea
            className="input font-mono h-52 resize-none"
            placeholder={'[\n  {\n    "prospect_name": "Maria Santos",\n    "role": "CEO",\n    "company_name": "Kumu",\n    "website_url": "https://kumu.live"\n  }\n]'}
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
          />
        </div>
      )}

      {/* Context field */}
      <div>
        <label className="label">Campaign Context (optional)</label>
        <input
          className="input"
          placeholder='e.g. "SaaS Founders in Manila struggling with user retention"'
          value={context}
          onChange={(e) => setContext(e.target.value)}
        />
        <p className="text-xs text-slate-600 mt-1">Helps Claude tailor the pain-point analysis to your campaign.</p>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <button onClick={handleSubmit} disabled={isRunning} className="btn-primary w-full">
        {isRunning ? 'Pipeline running...' : 'Run Pipeline'}
      </button>
    </div>
  );
}
