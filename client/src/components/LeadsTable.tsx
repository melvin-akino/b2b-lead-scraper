import { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Check, Trash2, ExternalLink } from 'lucide-react';
import { Lead, deleteLead } from '../lib/api';
import clsx from 'clsx';

interface LeadsTableProps {
  leads: Lead[];
  onRefresh: () => void;
}

function HookCard({ hook, index }: { hook: string; index: number }) {
  const [copied, setCopied] = useState(false);
  const labels = ['Pain-Point Led', 'Aspiration Led', 'Proof / Curiosity'];
  const colors = [
    'border-rose-800/50 bg-rose-950/20',
    'border-violet-800/50 bg-violet-950/20',
    'border-amber-800/50 bg-amber-950/20',
  ];

  const copy = () => {
    navigator.clipboard.writeText(hook);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className={clsx('border rounded-lg p-3 relative group', colors[index])}>
      <p className="text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">{labels[index]}</p>
      <p className="text-sm text-slate-300 leading-relaxed pr-6">{hook}</p>
      <button
        onClick={copy}
        className="absolute top-3 right-3 text-slate-600 hover:text-slate-300 transition-colors opacity-0 group-hover:opacity-100"
        title="Copy hook"
      >
        {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
      </button>
    </div>
  );
}

function LeadRow({ lead, onDelete }: { lead: Lead; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete lead for ${lead.prospect_name}?`)) return;
    setDeleting(true);
    await deleteLead(lead.id);
    onDelete();
  };

  return (
    <>
      <tr
        className="border-b border-slate-800 hover:bg-slate-800/30 cursor-pointer transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-4 py-3">
          <p className="text-sm font-medium text-slate-100">{lead.prospect_name}</p>
          <p className="text-xs text-slate-500">{lead.role}</p>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-slate-300">{lead.company_name}</span>
            <a
              href={lead.website_url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-slate-600 hover:text-violet-400 transition-colors"
            >
              <ExternalLink size={12} />
            </a>
          </div>
        </td>
        <td className="px-4 py-3 max-w-xs">
          <p className="text-xs text-slate-400 line-clamp-2">{lead.business_focus ?? '—'}</p>
        </td>
        <td className="px-4 py-3">
          {lead.generated_hooks?.length ? (
            <span className="badge bg-emerald-900/40 text-emerald-400">{lead.generated_hooks.length} hooks</span>
          ) : (
            <span className="badge bg-slate-800 text-slate-500">pending</span>
          )}
        </td>
        <td className="px-4 py-3 text-xs text-slate-600">
          {lead.analyzed_at ? new Date(lead.analyzed_at).toLocaleDateString() : '—'}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-slate-700 hover:text-red-400 transition-colors"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
            {expanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-slate-800 bg-slate-900/50">
          <td colSpan={6} className="px-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Left: analysis */}
              <div className="space-y-3">
                {lead.pain_points?.length ? (
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Pain Points</p>
                    <div className="flex flex-wrap gap-1.5">
                      {lead.pain_points.map((p, i) => (
                        <span key={i} className="badge bg-slate-800 text-slate-300 text-xs">{p}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {lead.analysis_summary && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Analysis</p>
                    <p className="text-sm text-slate-400 leading-relaxed">{lead.analysis_summary}</p>
                  </div>
                )}
              </div>

              {/* Right: hooks */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Icebreaker Hooks</p>
                {lead.generated_hooks?.map((hook, i) => (
                  <HookCard key={i} hook={hook} index={i} />
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function LeadsTable({ leads, onRefresh }: LeadsTableProps) {
  if (!leads.length) {
    return (
      <div className="card px-6 py-16 text-center">
        <p className="text-slate-500 text-sm">No leads yet. Run the scraper to get started.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-800">
            {['Prospect', 'Company', 'Business Focus', 'Hooks', 'Date', ''].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <LeadRow key={lead.id} lead={lead} onDelete={onRefresh} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
