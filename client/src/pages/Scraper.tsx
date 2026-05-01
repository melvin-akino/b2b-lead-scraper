import { useState } from 'react';
import { ProgressEvent } from '../lib/api';
import ScrapeForm from '../components/ScrapeForm';
import LogFeed from '../components/LogFeed';
import { CheckCircle } from 'lucide-react';

export default function Scraper() {
  const [logs, setLogs] = useState<ProgressEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [done, setDone] = useState(false);

  const handleLog = (event: ProgressEvent) => {
    setLogs((prev) => [...prev, event]);
  };

  const handleComplete = () => {
    setDone(true);
  };

  const handleReset = () => {
    setLogs([]);
    setDone(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Scraper</h1>
        <p className="text-sm text-slate-500 mt-0.5">Scrape → Research → Personalize → Store</p>
      </div>

      {done && (
        <div className="flex items-center justify-between bg-emerald-950/40 border border-emerald-800/50 rounded-xl px-5 py-3">
          <div className="flex items-center gap-3">
            <CheckCircle size={18} className="text-emerald-400" />
            <p className="text-sm text-emerald-300 font-medium">Pipeline complete! Leads saved to the dashboard.</p>
          </div>
          <button onClick={handleReset} className="text-xs text-emerald-400 hover:text-emerald-300 underline">
            Run another
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-5 items-start">
        {/* Left: form */}
        <div>
          <p className="text-xs text-slate-500 uppercase font-medium tracking-wide mb-3">Lead Input</p>
          <ScrapeForm
            onLog={handleLog}
            onComplete={handleComplete}
            onRunningChange={setIsRunning}
          />
        </div>

        {/* Right: live log */}
        <div>
          <p className="text-xs text-slate-500 uppercase font-medium tracking-wide mb-3">Live Pipeline Log</p>
          <LogFeed logs={logs} isRunning={isRunning} />
        </div>
      </div>
    </div>
  );
}
