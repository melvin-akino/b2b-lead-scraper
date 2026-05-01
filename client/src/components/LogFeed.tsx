import { useEffect, useRef } from 'react';
import { ProgressEvent } from '../lib/api';
import clsx from 'clsx';

interface LogFeedProps {
  logs: ProgressEvent[];
  isRunning: boolean;
}

const typeStyles: Record<ProgressEvent['type'], string> = {
  info:       'text-slate-400',
  success:    'text-emerald-400',
  error:      'text-red-400',
  step_start: 'text-violet-400',
  step_done:  'text-emerald-400',
  lead_start: 'text-cyan-400 font-semibold',
  lead_done:  'text-emerald-300 font-semibold',
  complete:   'text-yellow-400 font-bold',
};

const typePrefix: Record<ProgressEvent['type'], string> = {
  info:       '  ·',
  success:    '  ✓',
  error:      '  ✗',
  step_start: '  ▶',
  step_done:  '  ✓',
  lead_start: '▶▶',
  lead_done:  '✓✓',
  complete:   '══',
};

export default function LogFeed({ logs, isRunning }: LogFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl h-full min-h-[400px] flex flex-col">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500/70" />
          <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
          <span className="w-3 h-3 rounded-full bg-green-500/70" />
        </div>
        <span className="text-xs text-slate-500 ml-2 font-mono">pipeline output</span>
        {isRunning && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-violet-400">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            running
          </span>
        )}
      </div>

      {/* Log lines */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1">
        {logs.length === 0 && (
          <p className="text-slate-600 italic">Waiting for pipeline to start...</p>
        )}
        {logs.map((log, i) => (
          <div key={i} className={clsx('flex gap-2', typeStyles[log.type])}>
            <span className="flex-shrink-0 w-5 text-right opacity-60">{typePrefix[log.type]}</span>
            <span>{log.message}</span>
          </div>
        ))}
        {isRunning && (
          <div className="flex gap-2 text-slate-500">
            <span className="w-5 text-right">  ·</span>
            <span className="animate-pulse">_</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
