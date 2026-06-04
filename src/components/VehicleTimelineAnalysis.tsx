import React, { useState, useEffect } from 'react';
import { 
  motion, 
  AnimatePresence 
} from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  Legend, 
  ReferenceLine 
} from 'recharts';
import { 
  Car, 
  Wrench, 
  Milestone, 
  TrendingUp, 
  AlertTriangle, 
  ShieldCheck, 
  Calendar, 
  CalendarDays, 
  Activity, 
  Clock, 
  Info,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { Card } from './Card';
import { Button } from './Button';
import { cn, formatCurrency } from '../utils';

// Model interface for our vehicle data
interface TimelinePoint {
  date: string;
  displayDate: string;
  mileage: number;
  service: string | null;
  provider: string | null;
  isEvent: boolean;
  cost: number | null;
  type: 'purchase' | 'maintenance' | 'repair' | 'upgrade' | 'milestone' | 'current';
}

interface VehicleTimelineData {
  id: string;
  rego: string;
  make: string;
  model: string;
  year: number;
  engine: string;
  color: string;
  currentMilage: number;
  avgMonthlyKm: number;
  usageClassification: 'Low-Usage Commuter' | 'High-Duty Workhorse' | 'Active Highway Asset';
  trendScore: 'Optimal' | 'Warning' | 'Critical';
  timeline: TimelinePoint[];
}

const VEHICLE_DATASETS: Record<string, VehicleTimelineData> = {
  RAH190: {
    id: '1',
    rego: 'RAH190',
    make: 'Volkswagen',
    model: 'Golf GTE Hybrid',
    year: 2017,
    engine: '1.4 TSI Plug-in Hybrid',
    color: 'Pure White (Blue accents)',
    currentMilage: 108500,
    avgMonthlyKm: 1350,
    usageClassification: 'Active Highway Asset',
    trendScore: 'Optimal',
    timeline: [
      { date: '2025-01-01', displayDate: 'Jan 25', mileage: 91200, service: 'Purchased (import check)', provider: 'Japanese Import Center', isEvent: true, cost: 450, type: 'purchase' },
      { date: '2025-01-14', displayDate: 'Jan 25', mileage: 93000, service: 'Coolant Flush & EV Bleeding', provider: 'VAG Dealership Otago', isEvent: true, cost: 280, type: 'maintenance' },
      { date: '2025-04-10', displayDate: 'Apr 25', mileage: 97500, service: 'Routine Check-up', provider: null, isEvent: false, cost: null, type: 'milestone' },
      { date: '2025-07-07', displayDate: 'Jul 25', mileage: 101500, service: 'Engine Full Lube Service', provider: 'Anthony Motors', isEvent: true, cost: 350, type: 'maintenance' },
      { date: '2025-07-09', displayDate: 'Jul 25', mileage: 102000, service: 'DSG Dual-Clutch Oil Flush', provider: 'Precision Mechanical', isEvent: true, cost: 580, type: 'maintenance' },
      { date: '2025-10-10', displayDate: 'Oct 25', mileage: 105400, service: 'AGM 12v System Battery Upgrade', provider: 'Auto Electricians Dunedin', isEvent: true, cost: 440, type: 'upgrade' },
      { date: '2025-11-20', displayDate: 'Nov 25', mileage: 107000, service: 'Intermittent Fault Scan', provider: null, isEvent: false, cost: null, type: 'milestone' },
      { date: '2026-01-22', displayDate: 'Jan 26', mileage: 108500, service: 'Water Pump & Engine Cambelt Kit', provider: 'Precision Mechanical', isEvent: true, cost: 1250, type: 'repair' },
    ]
  },
  HMT921: {
    id: '2',
    rego: 'HMT921',
    make: 'Subaru',
    model: 'Outback 2.5i',
    year: 2020,
    engine: '2.5L FB25 Boxer 4',
    color: 'Magnetite Gray',
    currentMilage: 42500,
    avgMonthlyKm: 1850,
    usageClassification: 'High-Duty Workhorse',
    trendScore: 'Optimal',
    timeline: [
      { date: '2024-01-15', displayDate: 'Jan 24', mileage: 20500, service: 'Annual Full Service', provider: 'Precision Mechanical', isEvent: true, cost: 380, type: 'maintenance' },
      { date: '2024-04-20', displayDate: 'Apr 24', mileage: 25000, service: 'Quarterly Check-up', provider: null, isEvent: false, cost: null, type: 'milestone' },
      { date: '2024-06-18', displayDate: 'Jun 24', mileage: 28400, service: 'Pirelli Scorpion tyre balance', provider: 'Dunedin Tyre Lab', isEvent: true, cost: 240, type: 'maintenance' },
      { date: '2024-10-05', displayDate: 'Oct 24', mileage: 33800, service: 'Front/Rear Brake Pad Refurbish', provider: 'Subaru Service Otago', isEvent: true, cost: 680, type: 'repair' },
      { date: '2025-01-22', displayDate: 'Jan 25', mileage: 36800, service: 'Laser Sparkplug & filter pack', provider: 'Repco Trade Garage', isEvent: true, cost: 420, type: 'maintenance' },
      { date: '2025-04-12', displayDate: 'Apr 25', mileage: 40000, service: 'Milestone milestone Check', provider: null, isEvent: false, cost: null, type: 'milestone' },
      { date: '2025-05-25', displayDate: 'May 25', mileage: 42500, service: 'Basic Oil Change & Annual WoF', provider: 'Precision Mechanical', isEvent: true, cost: 195, type: 'maintenance' },
    ]
  },
  CGA689: {
    id: '3',
    rego: 'CGA689',
    make: 'Toyota',
    model: 'Yaris Petrol',
    year: 2004,
    engine: '1.3L 2NZ-FE Petrol Manual',
    color: 'Starlight Silver',
    currentMilage: 220000,
    avgMonthlyKm: 620,
    usageClassification: 'Low-Usage Commuter',
    trendScore: 'Warning',
    timeline: [
      { date: '2024-01-10', displayDate: 'Jan 24', mileage: 202500, service: 'Lube & Oil Filter Change', provider: 'Dave Ward Mechanical', isEvent: true, cost: 120, type: 'maintenance' },
      { date: '2024-04-05', displayDate: 'Apr 24', mileage: 205000, service: 'Manual Transmission sync oil', provider: 'Local Shop', isEvent: true, cost: 180, type: 'repair' },
      { date: '2024-08-11', displayDate: 'Aug 24', mileage: 209000, service: 'Brake Fluid Flush & new hoses', provider: 'Anthony Motors', isEvent: true, cost: 290, type: 'repair' },
      { date: '2024-12-15', displayDate: 'Dec 24', mileage: 212500, service: 'Spark plugs & air intake seals', provider: 'Precision Mechanical', isEvent: true, cost: 240, type: 'maintenance' },
      { date: '2025-04-20', displayDate: 'Apr 25', mileage: 216000, service: 'Routine service logging', provider: null, isEvent: false, cost: null, type: 'milestone' },
      { date: '2025-10-10', displayDate: 'Oct 25', mileage: 218500, service: 'Front Wheel Hub alignment & boots', provider: 'Dunedin Alignment Specialists', isEvent: true, cost: 450, type: 'repair' },
      { date: '2026-05-15', displayDate: 'May 26', mileage: 220000, service: 'Rear Brake drums & WoF check-up', provider: 'Precision Mechanical', isEvent: true, cost: 350, type: 'repair' },
    ]
  }
};

interface VehicleTimelineAnalysisProps {
  rego?: string;
}

export const VehicleTimelineAnalysis: React.FC<VehicleTimelineAnalysisProps> = ({ rego }) => {
  const [selectedRego, setSelectedRego] = useState<string>('RAH190');

  useEffect(() => {
    if (rego) {
      setSelectedRego(rego);
    }
  }, [rego]);

  const [hoveredPoint, setHoveredPoint] = useState<TimelinePoint | null>(null);
  const [activeTab, setActiveTab] = useState<'mileage' | 'cost'>('mileage');

  // Live AI insights from the vehicle's REAL mileage + service history
  const [insights, setInsights] = useState<{ title: string; detail: string; severity: string }[] | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  useEffect(() => {
    if (!rego) return;
    setInsights(null); setInsightsLoading(true);
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
        setInsights(r.ok && Array.isArray(d.insights) ? d.insights : []);
      } catch { setInsights([]); }
      finally { setInsightsLoading(false); }
    })();
  }, [rego]);

  const knownDemo = !!VEHICLE_DATASETS[selectedRego];
  const selectedVehicle = VEHICLE_DATASETS[selectedRego] || VEHICLE_DATASETS.RAH190;
  
  // Calculate handy statistics dynamically
  const eventPoints = selectedVehicle.timeline.filter(p => p.isEvent);
  const firstPoint = selectedVehicle.timeline[0];
  const lastPoint = selectedVehicle.timeline[selectedVehicle.timeline.length - 1];
  
  const totalMonths = (() => {
    if (!firstPoint || !lastPoint) return 12;
    const start = new Date(firstPoint.date);
    const end = new Date(lastPoint.date);
    return Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
  })();

  const totalKmDriven = lastPoint.mileage - firstPoint.mileage;
  const calculatedAvgMonthlyKm = Math.round(totalKmDriven / totalMonths) || selectedVehicle.avgMonthlyKm;
  const totalCostSpanned = eventPoints.reduce((sum, item) => sum + (item.cost || 0), 0);
  
  // Predicted time/mileage to next schedule (Rule of thumb: 10,000 KM or 6 months from last service)
  const lastServiceEvent = [...eventPoints].reverse().find(e => e.type === 'maintenance' || e.type === 'repair');
  const nextServiceMileageThreshold = lastServiceEvent ? lastServiceEvent.mileage + 10000 : selectedVehicle.currentMilage + 5000;
  const kmRemaining = nextServiceMileageThreshold - selectedVehicle.currentMilage;

  const getUsageBadgeStyles = (classification: string) => {
    switch (classification) {
      case 'High-Duty Workhorse':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'Active Highway Asset':
        return 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20';
      default:
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    }
  };

  const getScoreBadgeStyles = (score: string) => {
    switch (score) {
      case 'Warning':
        return 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30';
      case 'Critical':
        return 'bg-red-500/15 text-red-500 border-red-500/30';
      default:
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    }
  };

  // Recharts Customized Dot Component
  const renderCustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (payload.isEvent) {
      const isCritical = payload.type === 'repair' || payload.type === 'upgrade';
      return (
        <g key={`dot-${payload.date}-${payload.mileage}`}>
          <circle 
            cx={cx} 
            cy={cy} 
            r={10} 
            fill={isCritical ? "rgba(255, 24, 0, 0.2)" : "rgba(16, 185, 129, 0.2)"} 
            className="animate-ping" 
          />
          <circle 
            cx={cx} 
            cy={cy} 
            r={6} 
            fill={isCritical ? "#FF1800" : "#10B981"} 
            stroke="#FFF" 
            strokeWidth={1.5} 
            className="cursor-pointer shadow-lg"
          />
        </g>
      );
    }
    return (
      <circle 
        key={`dot-norm-${payload.date}-${payload.mileage}`}
        cx={cx} 
        cy={cy} 
        r={3.5} 
        fill="hsl(var(--muted))" 
        stroke="hsl(var(--border))" 
        strokeWidth={1}
      />
    );
  };

  // Custom Tooltip component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data: TimelinePoint = payload[0].payload;
      return (
        <div className="bg-card/95 border border-border backdrop-blur-md rounded-2xl p-4 shadow-xl max-w-xs space-y-3.5 text-left text-foreground">
          <div className="flex justify-between items-center pb-2 border-b border-border">
            <span className="text-[10px] uppercase font-black text-muted tracking-wider">
              {new Date(data.date).toLocaleDateString('en-NZ', { month: 'short', year: 'numeric', day: 'numeric' })}
            </span>
            <span className="text-[10px] font-mono bg-foreground/5 text-foreground font-black px-2 py-0.5 rounded-lg border border-border">
              {data.mileage.toLocaleString()} KM
            </span>
          </div>
          
          {data.isEvent ? (
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <div className={cn(
                  "w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
                  data.type === 'repair' ? "bg-red-500/10 text-red-500" : 
                  data.type === 'upgrade' ? "bg-amber-500/10 text-amber-500" :
                  data.type === 'purchase' ? "bg-blue-500/10 text-blue-500" : "bg-emerald-500/10 text-emerald-500"
                )}>
                  <Wrench size={12} />
                </div>
                <div>
                  <h5 className="text-xs font-black text-foreground uppercase tracking-tight leading-tight">{data.service}</h5>
                  <p className="text-[10px] text-muted">{data.provider}</p>
                </div>
              </div>
              {data.cost && (
                <div className="flex justify-between items-center pt-2 mt-1 border-t border-border/40 text-[10px]">
                  <span className="text-muted">Transaction Secured:</span>
                  <span className="font-extrabold text-foreground font-mono">{formatCurrency(data.cost)}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-muted flex items-center gap-1">
              <Activity size={12} className="text-emerald-500 animate-pulse" />
              <span>Standard transit logging / normal usage.</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const sevStyle = (s: string) => s === 'overdue' ? 'border-red-500/30 bg-red-500/5 text-red-500'
    : s === 'due' ? 'border-amber-500/30 bg-amber-500/5 text-amber-500'
    : s === 'good' ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-500'
    : 'border-border bg-background text-muted';

  return (
    <Card className="p-5 md:p-6 space-y-6 bg-card border border-border relative overflow-hidden flex flex-col justify-between">
      {/* Visual background details */}
      <div className="absolute top-0 right-0 p-8 opacity-5">
        <Activity size={180} />
      </div>

      {/* Live AI insights from real mileage + service history */}
      {rego && (
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-torqued-red" />
            <h4 className="text-sm font-black uppercase tracking-widest text-foreground">AI Health Insights</h4>
          </div>
          {insightsLoading && <p className="text-xs text-muted">Analysing service history…</p>}
          {!insightsLoading && insights && insights.length === 0 && <p className="text-xs text-muted">Not enough data yet — log services to build insights.</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(insights || []).map((ins, i) => (
              <div key={i} className={cn('p-3 rounded-xl border', sevStyle(ins.severity))}>
                <p className="text-xs font-black uppercase tracking-wide">{ins.title}</p>
                <p className="text-xs text-foreground/80 mt-0.5">{ins.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!knownDemo && (
        <div className="relative z-10 p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted">
          The full service timeline chart builds automatically as jobs are logged for this vehicle through Torqued.
        </div>
      )}

      {knownDemo && <>
      {/* Visual background details */}

      {/* Header Panel */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 text-left">
          <div className="flex items-center gap-2">
            <span className="p-1 px-2.5 bg-red-500/10 text-torqued-red border border-red-500/20 text-[9px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1.5 font-mono">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              Live Telemetry Analytics
            </span>
          </div>
          <h3 className="text-xl md:text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
            Vehicle Health Timeline Engine
          </h3>
          <p className="text-xs text-muted">
            Tracking dynamic mileage accumulation and servicing correlation across active customer records.
          </p>
        </div>

        {/* Dropdown controls */}
        <div className="flex items-center gap-2.5">
          <div className="text-right hidden sm:block">
            <p className="text-[9px] font-black uppercase text-muted tracking-wide">Select Tracked Asset</p>
            <p className="text-xs font-bold font-mono text-foreground">{selectedVehicle.rego}</p>
          </div>
          <select 
            value={selectedRego}
            onChange={(e) => setSelectedRego(e.target.value)}
            className="bg-background border border-border text-foreground text-xs font-extrabold rounded-xl py-2 px-3 focus:outline-none focus:ring-1 focus:ring-torqued-red tracking-wider transition-all"
          >
            {Object.keys(VEHICLE_DATASETS).map(rego => (
              <option key={rego} value={rego} className="bg-card text-foreground font-bold">
                {rego} - {VEHICLE_DATASETS[rego].make} {VEHICLE_DATASETS[rego].model}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* General Specs Information Bar */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-muted/40 border border-border/80 rounded-2xl text-left">
        <div className="space-y-0.5">
          <p className="text-[9px] font-black uppercase text-muted tracking-widest">Selected Vehicle</p>
          <p className="text-sm font-extrabold text-foreground truncate">{selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-[9px] font-black uppercase text-muted tracking-widest">Engine Powerplant</p>
          <p className="text-sm font-extrabold text-foreground truncate font-mono">{selectedVehicle.engine}</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-[9px] font-black uppercase text-muted tracking-widest">Usage Pattern</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border tracking-tight",
              getUsageBadgeStyles(selectedVehicle.usageClassification)
            )}>
              {selectedVehicle.usageClassification}
            </span>
          </div>
        </div>
        <div className="space-y-0.5">
          <p className="text-[9px] font-black uppercase text-muted tracking-widest">Reliability Score</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={cn(
              "px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border tracking-wider",
              getScoreBadgeStyles(selectedVehicle.trendScore)
            )}>
              {selectedVehicle.trendScore} Status
            </span>
          </div>
        </div>
      </div>

      {/* Visual Plotting Container */}
      <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 w-full items-stretch">
        
        {/* Plotting Column */}
        <div className="lg:col-span-3 space-y-3 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 bg-torqued-red rounded-full border border-white/5 shadow animate-ping mr-1" />
              <p className="text-xs font-bold text-foreground">Interactive Timeline Curve</p>
              <span className="text-[10px] text-muted">(Click/Hover nodes for history records)</span>
            </div>
            
            {/* Mode selection */}
            <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border border-border">
              <button 
                onClick={() => setActiveTab('mileage')}
                className={cn(
                  "px-2.5 py-1 rounded text-[10px] uppercase font-black tracking-wider transition-all",
                  activeTab === 'mileage' ? "bg-card text-foreground shadow-sm" : "text-muted hover:text-foreground"
                )}
              >
                Mileage Plot
              </button>
              <button 
                onClick={() => setActiveTab('cost')}
                className={cn(
                  "px-2.5 py-1 rounded text-[10px] uppercase font-black tracking-wider transition-all",
                  activeTab === 'cost' ? "bg-card text-foreground shadow-sm" : "text-muted hover:text-foreground"
                )}
              >
                Cost Weighting
              </button>
            </div>
          </div>

          <div className="h-[250px] w-full bg-card rounded-2xl border border-border/60 p-4 shadow-inner relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              {activeTab === 'mileage' ? (
                <AreaChart 
                  data={selectedVehicle.timeline}
                  margin={{ top: 15, right: 15, left: -25, bottom: -10 }}
                  onMouseMove={(state: any) => {
                    if (state && state.activePayload && state.activePayload.length) {
                      setHoveredPoint(state.activePayload[0].payload);
                    } else {
                      setHoveredPoint(null);
                    }
                  }}
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  <defs>
                    <linearGradient id="mileageGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF1800" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#FF1800" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-5" />
                  <XAxis 
                    dataKey="displayDate" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fontWeight: 700, fill: 'currentColor' }}
                    className="text-muted font-mono"
                    dy={5}
                  />
                  <YAxis 
                    domain={['dataMin - 2000', 'dataMax + 2000']}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => `${Math.round(val / 1000)}k`}
                    tick={{ fontSize: 9, fontWeight: 700, fill: 'currentColor' }}
                    className="text-muted font-mono"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="mileage" 
                    stroke="#FF1800" 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#mileageGrad)" 
                    dot={renderCustomDot}
                  />
                </AreaChart>
              ) : (
                <LineChart 
                  data={selectedVehicle.timeline}
                  margin={{ top: 15, right: 5, left: -25, bottom: -10 }}
                  onMouseMove={(state: any) => {
                    if (state && state.activePayload && state.activePayload.length) {
                      setHoveredPoint(state.activePayload[0].payload);
                    } else {
                      setHoveredPoint(null);
                    }
                  }}
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-5" />
                  <XAxis 
                    dataKey="displayDate" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fontWeight: 700, fill: 'currentColor' }}
                    className="text-muted font-mono"
                    dy={5}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => `$${val}`}
                    tick={{ fontSize: 9, fontWeight: 700, fill: 'currentColor' }}
                    className="text-muted font-mono"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line 
                    type="monotone" 
                    dataKey="cost" 
                    stroke="#10B981" 
                    strokeWidth={2.5}
                    connectNulls
                    dot={renderCustomDot}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sidebar Information / Live Hover Card */}
        <div className="lg:col-span-1 flex flex-col justify-between p-4 bg-muted/30 border border-border/80 rounded-2xl text-left">
          <AnimatePresence mode="wait">
            {hoveredPoint ? (
              <motion.div 
                key={hoveredPoint.date + hoveredPoint.mileage}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div>
                  <span className="text-[9px] font-black uppercase text-torqued-red tracking-widest block">Telemetric Node Selected</span>
                  <h4 className="text-base font-black tracking-tight text-foreground">{hoveredPoint.displayDate} • Info</h4>
                </div>

                <div className="space-y-3 text-xs leading-relaxed">
                  <div>
                    <span className="text-[10px] text-muted block">Mileage Point:</span>
                    <span className="font-extrabold text-foreground font-mono">{hoveredPoint.mileage.toLocaleString()} KM</span>
                  </div>

                  {hoveredPoint.isEvent ? (
                    <>
                      <div>
                        <span className="text-[10px] text-muted block">Transaction Class:</span>
                        <span className={cn(
                          "px-2 py-0.5 font-bold uppercase rounded text-[9px] tracking-wide inline-block mt-0.5",
                          hoveredPoint.type === 'repair' ? "bg-red-500/10 text-red-400 border border-red-500/15" :
                          hoveredPoint.type === 'upgrade' ? "bg-amber-500/10 text-amber-400 border border-amber-500/15" :
                          "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15"
                        )}>
                          {hoveredPoint.type}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted block">Description:</span>
                        <span className="font-extrabold text-foreground">{hoveredPoint.service}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted block">Authenticated Provider:</span>
                        <span className="font-medium text-muted-foreground">{hoveredPoint.provider}</span>
                      </div>
                    </>
                  ) : (
                    <div className="p-3 bg-muted border border-border rounded-xl text-center">
                      <span className="text-[10px] text-muted">Standard vehicle usage with no manual service overrides.</span>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="default-trend"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <div>
                  <span className="text-[9px] font-black uppercase text-muted tracking-widest block">Live Trend Diagnostics</span>
                  <h4 className="text-base font-black tracking-tight text-foreground">Usage Summary</h4>
                </div>

                <div className="space-y-3.5 text-xs">
                  <div className="flex justify-between items-center p-2.5 bg-background rounded-xl border border-border">
                    <span className="text-muted font-bold">Total Events Spanned:</span>
                    <span className="font-black text-foreground font-mono">{eventPoints.length}</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 bg-background rounded-xl border border-border">
                    <span className="text-muted font-bold">Avg Monthly Km:</span>
                    <span className="font-black text-foreground font-mono">{calculatedAvgMonthlyKm} km</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 bg-background rounded-xl border border-border">
                    <span className="text-muted font-bold">Total Service Spend:</span>
                    <span className="font-black text-emerald-400 font-mono">{formatCurrency(totalCostSpanned)}</span>
                  </div>
                </div>

                <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl space-y-1">
                  <p className="text-[9px] text-emerald-400 font-black uppercase tracking-widest">Active Prognosis</p>
                  <p className="text-[10px] text-muted leading-snug">
                    Symmetrical mileage trend curves show optimal component duty cycles and service adherence.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-[9px] text-muted italic text-center mt-3">
            ⚠️ Analytics based on odometer logging from Torqued service events.
          </p>
        </div>
      </div>

      {/* Grid of helper bento cards */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
        {/* Bento Card 1: Accumulation Velocity */}
        <div className="p-4 bg-muted/40 border border-border rounded-2xl text-left flex items-start gap-3 relative hover:bg-muted/60 transition-all">
          <div className="p-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/15 rounded-xl">
            <Milestone size={16} />
          </div>
          <div className="space-y-0.5 flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase text-muted tracking-widest">Accumulation Rate</p>
            <p className="text-base font-extrabold text-foreground">{calculatedAvgMonthlyKm.toLocaleString()} KM / month</p>
            <p className="text-[10px] text-muted truncate">
              Estimated usage of approx {Math.round(calculatedAvgMonthlyKm * 12).toLocaleString()} KM annually.
            </p>
          </div>
        </div>

        {/* Bento Card 2: Density Analysis */}
        <div className="p-4 bg-muted/40 border border-border rounded-2xl text-left flex items-start gap-3 relative hover:bg-muted/60 transition-all">
          <div className="p-2 bg-torqued-red/10 text-torqued-red border border-torqued-red/15 rounded-xl">
            <Wrench size={16} />
          </div>
          <div className="space-y-0.5 flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase text-muted tracking-widest">Servicing Density</p>
            <p className="text-base font-extrabold text-foreground">
              ~{Math.round(totalKmDriven / Math.max(1, eventPoints.length)).toLocaleString()} KM Interval
            </p>
            <p className="text-[10px] text-muted truncate">
              Span frequency across {eventPoints.length} certified shop check-ins.
            </p>
          </div>
        </div>

        {/* Bento Card 3: Dynamic Scheduler Target */}
        <div className="p-4 bg-muted/40 border border-border rounded-2xl text-left flex items-start gap-3 relative hover:bg-muted/60 transition-all">
          <div className="p-2 bg-blue-500/10 text-blue-500 border border-blue-500/15 rounded-xl">
            <CalendarDays size={16} />
          </div>
          <div className="space-y-0.5 flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase text-muted tracking-widest">Proactive Target Scheduler</p>
            <p className={cn(
              "text-base font-extrabold",
              kmRemaining < 1500 ? "text-torqued-red" : "text-foreground"
            )}>
              {kmRemaining > 0 ? `Due in ~${kmRemaining.toLocaleString()} KM` : 'Service is OVERDUE! ❗'}
            </p>
            <p className="text-[10px] text-muted truncate">
              Dynamic estimate: approx {new Date(new Date().getTime() + (Math.max(1, kmRemaining) / (calculatedAvgMonthlyKm || 1000)) * 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-NZ', { month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>
      </>}
    </Card>
  );
};
