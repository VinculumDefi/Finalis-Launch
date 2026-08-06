import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { STATUS, STATUS_META, REQUIREMENTS, CATEGORIES } from '@/lib/vfComplianceData';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';

export default function ComplianceTable() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expandedCat, setExpandedCat] = useState(null);

  const filtered = useMemo(() => {
    return REQUIREMENTS.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          r.id.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.trace.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [search, statusFilter, categoryFilter]);

  // Group by category
  const grouped = useMemo(() => {
    const g = {};
    for (const r of filtered) {
      if (!g[r.category]) g[r.category] = [];
      g[r.category].push(r);
    }
    return g;
  }, [filtered]);

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    ...Object.values(STATUS).map((s) => ({ value: s, label: STATUS_META[s].label })),
  ];

  return (
    <Card className="p-5 bg-slate-900 border-slate-700">
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search by ID, title, or trace..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-slate-800 border-slate-600 pl-9 text-slate-100"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100"
        >
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100"
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="text-xs text-slate-500 mb-3">
        Showing {filtered.length} of {REQUIREMENTS.length} requirements
      </div>

      <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
        {Object.keys(grouped).length === 0 && (
          <div className="text-center py-8 text-slate-500 text-sm">No requirements match your filters.</div>
        )}
        {CATEGORIES.map((cat) => {
          const items = grouped[cat];
          if (!items || items.length === 0) return null;
          const isExpanded = expandedCat === cat || search !== '' || statusFilter !== 'all';
          return (
            <div key={cat} className="border border-slate-800 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedCat(isExpanded ? null : cat)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-800/50 hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  <span className="text-sm font-semibold text-slate-200">{cat}</span>
                </div>
                <span className="text-xs text-slate-500">{items.length} requirement{items.length !== 1 ? 's' : ''}</span>
              </button>
              {isExpanded && (
                <div className="divide-y divide-slate-800">
                  {items.map((r) => {
                    const meta = STATUS_META[r.status];
                    return (
                      <div key={r.id} className="px-4 py-2.5 hover:bg-slate-800/30 transition-colors">
                        <div className="flex items-start gap-3">
                          <span className="text-xs font-mono text-slate-500 shrink-0 mt-0.5">{r.id}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-200">{r.title}</p>
                            <p className="text-xs text-slate-500 font-mono mt-0.5 truncate">{r.trace}</p>
                          </div>
                          <div className={`shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded-md ${meta.bg} ${meta.border} border`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`}></span>
                            <span className={`text-xs font-medium ${meta.text}`}>{meta.label}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}