import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { Card } from './Card';
import { cn } from '../utils';

interface VehicleTimelineAnalysisProps {
  rego?: string;
  onInsightsLoaded?: (insights: { title: string; detail: string; severity: string }[]) => void;
}

export const VehicleTimelineAnalysis: React.FC<VehicleTimelineAnalysisProps> = ({ rego, onInsightsLoaded }) => {
  const [insights, setInsights] = useState<{ title: string; detail: string; severity: string }[] | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  useEffect(() => {
    if (!rego) return;
    setInsights(null);
    setInsightsLoading(true);
    (async () => {
      try {
        const [vRes, hRes] = await Promise.all([
          fetch(`/api/vehicles/${encodeURIComponent(rego)}`).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`/api/history/${encodeURIComponent(rego)}`).then(r => r.ok ? r.json() : { imported: [], jobs: [] }).catch(() => ({ imported: [], jobs: [] })),
        ]);
        const history = [
          ...(hRes.imported || []).map((h: any) => ({ date: h.service_date, work: h.work_done, mileage: h.mileage })),
          ...(hRes.jobs || []).filter((j: any) => j.status === 'completed').map((j: any) => ({ date: j.completed_at || j.date, work: (j.service_ids || []).join(', ') })),
        ];
        const r = await fetch('/api/ai/health-insights', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rego, make: vRes?.make, model: vRes?.model, year: vRes?.year, mileage: vRes?.mileage, history }),
        });
        const d = await r.json();
        const loaded = r.ok && Array.isArray(d.insights) ? d.insights : [];
        setInsights(loaded);
        onInsightsLoaded?.(loaded);
      } catch {
        setInsights([]);
        onInsightsLoaded?.([]);
      } finally {
        setInsightsLoading(false);
      }
    })();
  }, [rego]); // eslint-disable-line react-hooks/exhaustive-deps

  const sevStyle = (s: string) =>
    s === 'overdue' ? 'border-red-500/30 bg-red-500/5 text-red-500'
    : s === 'due' ? 'border-amber-500/30 bg-amber-500/5 text-amber-500'
    : s === 'good' ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-500'
    : 'border-border bg-background text-muted';

  if (!rego) return null;

  return (
    <Card className="p-5 space-y-4 bg-card border border-border">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-torqued-red" />
        <h4 className="text-sm font-black uppercase tracking-widest text-foreground">AI Health Insights</h4>
        <span className="text-[10px] font-mono text-muted ml-1">{rego}</span>
      </div>
      {insightsLoading && (
        <p className="text-xs text-muted">Analysing service history…</p>
      )}
      {!insightsLoading && insights !== null && insights.length === 0 && (
        <p className="text-xs text-muted">Not enough service data yet — log jobs to build insights for this vehicle.</p>
      )}
      {!insightsLoading && insights && insights.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {insights.map((ins, i) => (
            <div key={i} className={cn('p-3 rounded-xl border', sevStyle(ins.severity))}>
              <p className="text-xs font-black uppercase tracking-wide">{ins.title}</p>
              <p className="text-xs text-foreground/80 mt-0.5">{ins.detail}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
