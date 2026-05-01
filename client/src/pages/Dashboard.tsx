import { useEffect, useState } from 'react';
import { Download, RefreshCw, Trash2, Users, CheckCircle, Clock } from 'lucide-react';
import { fetchLeads, clearLeads, exportLeadsUrl, Lead } from '../lib/api';
import LeadsTable from '../components/LeadsTable';

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setLeads(await fetchLeads());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleClear = async () => {
    if (!confirm('Delete all stored leads? This cannot be undone.')) return;
    await clearLeads();
    setLeads([]);
  };

  const withHooks = leads.filter((l) => l.generated_hooks?.length).length;
  const today = leads.filter((l) => l.scraped_at && new Date(l.scraped_at).toDateString() === new Date().toDateString()).length;

  const stats = [
    { label: 'Total Leads',   value: leads.length,  icon: Users,       color: 'text-violet-400' },
    { label: 'With Hooks',    value: withHooks,      icon: CheckCircle, color: 'text-emerald-400' },
    { label: 'Scraped Today', value: today,          icon: Clock,       color: 'text-cyan-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">All enriched B2B leads</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm py-1.5">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          {leads.length > 0 && (
            <>
              <a href={exportLeadsUrl()} className="btn-secondary flex items-center gap-2 text-sm py-1.5">
                <Download size={14} /> Export CSV
              </a>
              <button onClick={handleClear} className="btn-danger flex items-center gap-2 text-sm py-1.5">
                <Trash2 size={14} /> Clear All
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card px-5 py-4 flex items-center gap-4">
            <div className={`${color} bg-slate-800 p-2.5 rounded-lg`}>
              <Icon size={18} className={color} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-100">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="card px-6 py-16 text-center">
          <p className="text-slate-500 text-sm animate-pulse">Loading leads...</p>
        </div>
      ) : (
        <LeadsTable leads={leads} onRefresh={load} />
      )}
    </div>
  );
}
