import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  REGISTRY_SOURCE, REGISTRY_URL, REGISTRY_TOTAL, CLASS_DISTRIBUTION,
  S1_RECORDS, S2_RECORDS, ENVIRONMENT_DISTRIBUTION, REGISTRY_CHECKS, ALL_CHECKS_PASSED,
} from '@/lib/vfRegistryVerification';
import {
  CheckCircle2, XCircle, Database, Search, ChevronDown, ChevronRight, ShieldCheck, FileCheck2,
} from 'lucide-react';

export default function RegistryPanel() {
  const [showFullRegistry, setShowFullRegistry] = useState(false);
  const [registryData, setRegistryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');

  const loadFullRegistry = async () => {
    if (registryData) {
      setShowFullRegistry(!showFullRegistry);
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(REGISTRY_URL);
      const data = await resp.json();
      setRegistryData(data.records);
      setShowFullRegistry(true);
    } catch (e) {
      console.error('Failed to load registry', e);
    }
    setLoading(false);
  };

  const filteredRecords = useMemo(() => {
    if (!registryData) return [];
    return registryData.filter((r) => {
      if (classFilter !== 'all' && r.class !== classFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return r.symbol?.toLowerCase().includes(q) ||
          r.asset_name?.toLowerCase().includes(q) ||
          r.environment?.toLowerCase().includes(q) ||
          r.contract_or_native_identifier?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [registryData, search, classFilter]);

  return (
    <div className="space-y-4">
      {/* Verification Summary */}
      <Card className="p-5 bg-slate-900 border-emerald-500/30">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-400" />
              Approved Asset Registry — Field-Level Audit
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              VF-REG-011: {REGISTRY_TOTAL} records verified against Master Specification
            </p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${ALL_CHECKS_PASSED ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-rose-500/10 border border-rose-500/30'}`}>
            {ALL_CHECKS_PASSED ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-400" />
            )}
            <span className={`text-sm font-semibold ${ALL_CHECKS_PASSED ? 'text-emerald-400' : 'text-rose-400'}`}>
              {ALL_CHECKS_PASSED ? 'All Checks Passed' : 'Issues Found'}
            </span>
          </div>
        </div>

        {/* Provenance */}
        <div className="bg-slate-950/50 rounded-md p-3 mb-4 text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-2 mb-1">
            <FileCheck2 className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-300">Source:</span> {REGISTRY_SOURCE.file_name}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><span className="text-slate-500">Revision:</span> {REGISTRY_SOURCE.revision}</div>
            <div><span className="text-slate-500">Date:</span> {REGISTRY_SOURCE.date}</div>
            <div><span className="text-slate-500">SHA-256:</span> {REGISTRY_SOURCE.sha256.substring(0, 12)}...</div>
          </div>
        </div>

        {/* Distribution Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-slate-800/50 rounded-md p-3 text-center">
            <div className="text-2xl font-bold text-slate-100">{REGISTRY_TOTAL}</div>
            <div className="text-xs text-slate-400">Total Records</div>
          </div>
          <div className="bg-emerald-500/5 rounded-md p-3 text-center border border-emerald-500/20">
            <div className="text-2xl font-bold text-emerald-400">{CLASS_DISTRIBUTION.S1}</div>
            <div className="text-xs text-slate-400">S1 (USDC/USDT)</div>
          </div>
          <div className="bg-blue-500/5 rounded-md p-3 text-center border border-blue-500/20">
            <div className="text-2xl font-bold text-blue-400">{CLASS_DISTRIBUTION.S2}</div>
            <div className="text-xs text-slate-400">S2 (Native+Blue)</div>
          </div>
          <div className="bg-slate-700/30 rounded-md p-3 text-center">
            <div className="text-2xl font-bold text-slate-300">{CLASS_DISTRIBUTION.S3}</div>
            <div className="text-xs text-slate-400">S3 (Standard)</div>
          </div>
        </div>

        {/* Verification Checklist */}
        <div className="space-y-1.5">
          {REGISTRY_CHECKS.map((check) => (
            <div key={check.id} className="flex items-start gap-3 p-2 bg-slate-950/30 rounded-md">
              {check.passed ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-500">{check.id}</span>
                  <span className="text-xs text-slate-300">{check.title}</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  <span className="text-slate-600">Expected:</span> {check.expected}
                  <span className="mx-1.5 text-slate-700">·</span>
                  <span className="text-slate-600">Actual:</span> {check.actual}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* S1/S2 Detail */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 bg-slate-900 border-emerald-500/20">
          <h4 className="text-sm font-bold text-emerald-400 mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            S1 Assets — High-Custody Stablecoins (2)
          </h4>
          <div className="space-y-1.5">
            {S1_RECORDS.map((r) => (
              <div key={r.row} className="text-xs bg-slate-950/40 rounded p-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-200">{r.symbol}</span>
                  <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-500/30" variant="outline">S1</Badge>
                </div>
                <div className="text-slate-500 mt-0.5">{r.name} · {r.env}</div>
                <div className="text-slate-600 font-mono mt-0.5 truncate">{r.contract}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4 bg-slate-900 border-blue-500/20">
          <h4 className="text-sm font-bold text-blue-400 mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            S2 Assets — Native + Blue-Chip (5)
          </h4>
          <div className="space-y-1.5">
            {S2_RECORDS.map((r) => (
              <div key={r.row} className="text-xs bg-slate-950/40 rounded p-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-200">{r.symbol}</span>
                  <Badge className="bg-blue-600/20 text-blue-400 border-blue-500/30" variant="outline">S2</Badge>
                </div>
                <div className="text-slate-500 mt-0.5">{r.name} · {r.env}</div>
                <div className="text-slate-600 font-mono mt-0.5 truncate">{r.contract}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Environment Distribution */}
      <Card className="p-4 bg-slate-900 border-slate-700">
        <h4 className="text-sm font-bold text-slate-200 mb-3">Environment Distribution (17 environments)</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {ENVIRONMENT_DISTRIBUTION.map((e) => (
            <div key={e.env} className="flex items-center justify-between text-xs bg-slate-950/40 rounded px-2 py-1.5">
              <span className="text-slate-300 truncate">{e.env}</span>
              <span className="font-mono text-slate-400 ml-2">{e.count}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Full Registry Browser */}
      <Card className="p-5 bg-slate-900 border-slate-700">
        <button
          onClick={loadFullRegistry}
          className="w-full flex items-center justify-between"
        >
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-400" />
            Browse Full Registry ({REGISTRY_TOTAL} records)
          </h3>
          {showFullRegistry ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </button>

        {loading && (
          <div className="py-8 text-center text-sm text-slate-400">Loading 1,001 records...</div>
        )}

        {showFullRegistry && registryData && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-col md:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  placeholder="Search symbol, name, environment, or contract..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-slate-800 border-slate-600 pl-9 text-slate-100 text-sm"
                />
              </div>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100"
              >
                <option value="all">All Classes</option>
                <option value="S1">S1</option>
                <option value="S2">S2</option>
                <option value="S3">S3</option>
              </select>
            </div>

            <div className="text-xs text-slate-500">Showing {filteredRecords.length} of {REGISTRY_TOTAL} records</div>

            <div className="max-h-96 overflow-y-auto border border-slate-800 rounded-md">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-800">
                  <tr className="text-left text-slate-400">
                    <th className="px-3 py-2 font-medium">Row</th>
                    <th className="px-3 py-2 font-medium">Symbol</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Environment</th>
                    <th className="px-3 py-2 font-medium">Class</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredRecords.slice(0, 500).map((r) => (
                    <tr key={r.registry_row} className="hover:bg-slate-800/50">
                      <td className="px-3 py-1.5 text-slate-500 font-mono">{r.registry_row}</td>
                      <td className="px-3 py-1.5 text-slate-200 font-mono font-medium">{r.symbol}</td>
                      <td className="px-3 py-1.5 text-slate-400">{r.asset_name}</td>
                      <td className="px-3 py-1.5 text-slate-400">{r.environment}</td>
                      <td className="px-3 py-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          r.class === 'S1' ? 'bg-emerald-500/20 text-emerald-400' :
                          r.class === 'S2' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-slate-700 text-slate-400'
                        }`}>{r.class}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredRecords.length > 500 && (
              <div className="text-xs text-slate-500 text-center">
                Showing first 500 results. Refine your search to see more.
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}