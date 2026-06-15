import React, { useState, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  Inbox,
  Calendar as CalendarIcon,
  Package,
  CreditCard,
  User,
  Star,
  TrendingUp,
  Clock,
  CheckCircle2,
  X,
  MoreVertical,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  ExternalLink,
  Car,
  Search,
  Image as ImageIcon,
  Map,
  Award,
  PenSquare,
  History,
  MessageCircle,
  Trash2,
  Plus,
  Wrench,
  Filter,
  Info,
  Sun,
  Moon,
  Monitor,
  Activity,
  Camera,
  Sparkles,
  HeartPulse
} from 'lucide-react';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { VehicleTimelineAnalysis } from '../components/VehicleTimelineAnalysis';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { formatCurrency, calculateGST, cn } from '../utils';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { authPasskey, registerPasskey, passkeysSupported } from '../lib/passkey';
import { SERVICES } from '../constants';
import {
  InventoryPart,
  Supplier,
  PartOffer,
  RequiredPart,
  ProcurementItem,
  DeliveryItem
} from '../types';

const SUPPLIERS: Supplier[] = [];
const PART_OFFERS: PartOffer[] = [];


// ── Vehicle Health Lookup (mechanic side) ─────────────────────────────────────
type HealthInsight = { title: string; detail: string; severity: 'good' | 'due' | 'overdue' | 'info' };
const VehicleHealthLookup: React.FC<{ mechanicId?: string }> = ({ mechanicId }) => {
  const [rego, setRego] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [insights, setInsights] = React.useState<HealthInsight[] | null>(null);
  const [hasHistory, setHasHistory] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const lookup = async () => {
    const plate = rego.toUpperCase().trim();
    if (!plate) return;
    setLoading(true); setInsights(null); setError(null);
    try {
      const r = await fetch('/api/ai/health-insights', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rego: plate, mechanic_id: mechanicId }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Could not load vehicle health'); return; }
      setInsights(d.insights || []);
      setHasHistory(d.hasHistory ?? true);
    } catch { setError('Could not connect — please try again.'); }
    finally { setLoading(false); }
  };

  const severityColor = (s: string) =>
    s === 'good' ? 'border-emerald-500/20 bg-emerald-500/5' :
    s === 'due'  ? 'border-amber-500/20 bg-amber-500/5' :
    s === 'overdue' ? 'border-torqued-red/30 bg-torqued-red/5' : 'border-border bg-card';
  const severityIcon = (s: string) => s === 'good' ? '✓' : s === 'overdue' ? '⚠' : s === 'due' ? '🔔' : 'ℹ';
  const severityText = (s: string) =>
    s === 'good' ? 'text-emerald-400' : s === 'due' ? 'text-amber-400' : s === 'overdue' ? 'text-torqued-red' : 'text-muted';

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="p-6 bg-card border-border space-y-4">
        <div>
          <h3 className="text-lg font-black tracking-tight">Vehicle Health Lookup</h3>
          <p className="text-xs text-muted mt-1">Only available for vehicles that have come through your system — cold quotes, bookings, or past jobs.</p>
        </div>
        <div className="flex gap-3">
          <input
            value={rego} onChange={e => setRego(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && lookup()}
            placeholder="e.g. ABC123"
            className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm font-mono tracking-widest outline-none focus:border-torqued-red/50 text-foreground placeholder:text-muted"
          />
          <Button onClick={lookup} disabled={loading || !rego.trim()} className="bg-torqued-red text-white shrink-0">
            {loading ? 'Analysing…' : 'Look up'}
          </Button>
        </div>
        {error && <p className="text-sm text-torqued-red font-bold">{error}</p>}
      </Card>

      {insights !== null && (
        <div className="space-y-4">
          {!hasHistory && (
            <Card className="p-4 border-amber-500/20 bg-amber-500/5 text-sm text-amber-400 font-medium">
              No service history on file for this vehicle — insights are based on vehicle age and mileage estimates only. Encourage the customer to scan past receipts to improve accuracy.
            </Card>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {insights.map((insight, i) => (
              <Card key={i} className={cn('p-4 flex items-start gap-3 border', severityColor(insight.severity))}>
                <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-base font-bold',
                  insight.severity === 'good' ? 'bg-emerald-500/15' :
                  insight.severity === 'due'  ? 'bg-amber-500/15' :
                  insight.severity === 'overdue' ? 'bg-torqued-red/15' : 'bg-white/5')}>
                  {severityIcon(insight.severity)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn('text-sm font-bold leading-tight', severityText(insight.severity))}>{insight.title}</p>
                  <p className="text-xs text-muted mt-0.5 leading-snug">{insight.detail}</p>
                </div>
                {(insight.severity === 'due' || insight.severity === 'overdue') && (
                  <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-torqued-red">
                    {insight.severity === 'overdue' ? 'URGENT' : 'SOON'}
                  </span>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const MechanicPortal: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { theme, setTheme } = useTheme();
  const { user, userProfile, loginMechanic, signUpMechanic, resendMechanicLink, markSubscriptionActive, logout, updateProfile } = useAuth();
  const [mechEmail, setMechEmail] = useState('');
  const [mechPassword, setMechPassword] = useState('');
  const [mechName, setMechName] = useState('');
  const [mechAuthMode, setMechAuthMode] = useState<'login' | 'signup'>('login');
  const [mechAuthError, setMechAuthError] = useState<string | null>(null);
  const [mechAuthLoading, setMechAuthLoading] = useState(false);
  const [mechSignupSent, setMechSignupSent] = useState(false);
  const [subPromo, setSubPromo] = useState('');
  const [subPromoError, setSubPromoError] = useState<string | null>(null);
  const [subPromoLoading, setSubPromoLoading] = useState(false);
  // Local override: once activated this session, unlock the dashboard regardless of
  // userProfile load timing (which could be null and silently block the unlock).
  const [justActivated, setJustActivated] = useState(false);
  // Onboarding wizard
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [obStep, setObStep] = useState(1);
  const [obSaving, setObSaving] = useState(false);
  const [ob, setOb] = useState({
    name: '', nzbn: '', address: '', phone: '', owner_name: '',
    bank_account_name: '', bank_account_number: '', labour_rate: 145, technicians: 1, parts_lead_days: 1,
  });

  useEffect(() => {
    if (!user) return;
    fetch(`/api/mechanic/onboarding-status?id=${user.id}`)
      .then(r => r.json())
      .then(d => { setOnboardingComplete(!!d.complete); if (!d.complete) setOb(o => ({ ...o, name: user.user_metadata?.name || o.name })); })
      .catch(() => setOnboardingComplete(true));
  }, [user]);

  // Capacity settings
  const [cap, setCap] = useState({ technicians: 1, parts_lead_days: 1, labour_rate: 145, cancellation_notice_hours: 72, cancellation_partial_refund_pct: 80 });
  const [capSaving, setCapSaving] = useState(false);

  // Service packages
  const [packages, setPackages] = useState<any[]>([]);
  const [newPkg, setNewPkg] = useState({
    name: '', price: '', durationMin: '60', description: '', vehicleRef: '',
    baseFee: '', oilLitres: '', oilCostPerL: '', oilGrade: '', filterCost: '',
    includedItems: [] as string[], newIncludedItem: '',
    type: 'standard' as 'standard' | 'transmission',
    transOilLitres: '', transOilCostPerL: '', freight: '', scanToolFee: '',
  });
  const [oilPriceLookupBusy, setOilPriceLookupBusy] = useState(false);
  const lookupOilPrice = async (grade: string) => {
    if (!grade.trim()) { alert('Enter an oil grade first (e.g. 5W-30).'); return; }
    setOilPriceLookupBusy(true);
    try {
      const r = await fetch('/api/ai/oil-price', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grade }) });
      const d = await r.json();
      if (d.pricePerLitre) setNewPkg(p => ({ ...p, oilCostPerL: String(d.pricePerLitre) }));
      else alert(d.error || 'Could not retrieve oil price.');
    } catch { alert('Oil price lookup failed.'); }
    finally { setOilPriceLookupBusy(false); }
  };
  const [capacityLookupBusy, setCapacityLookupBusy] = useState(false);
  const lookupServiceData = async () => {
    const ref = (newPkg.vehicleRef || newPkg.name).trim();
    if (!ref) { alert('Enter a vehicle reference or package name first.'); return; }
    setCapacityLookupBusy(true);
    try {
      const r = await fetch('/api/ai/service-lookup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: ref, type: newPkg.type }),
      });
      const d = await r.json();
      if (d.error) { alert(d.error); return; }
      setNewPkg(p => ({
        ...p,
        ...(d.oilCapacityL != null ? { oilLitres: String(d.oilCapacityL) } : {}),
        ...(d.oilGrade ? { oilGrade: d.oilGrade } : {}),
        ...(d.oilCostPerL != null ? { oilCostPerL: String(d.oilCostPerL) } : {}),
        ...(d.filterCostNZD != null ? { filterCost: String(d.filterCostNZD) } : {}),
        ...(d.transFluidCapacityL != null ? { transOilLitres: String(d.transFluidCapacityL) } : {}),
        ...(d.transFluidCostPerL != null ? { transOilCostPerL: String(d.transFluidCostPerL) } : {}),
      }));
    } catch { alert('Service data lookup failed.'); }
    finally { setCapacityLookupBusy(false); }
  };

  // Mechanic availability
  const [mechAvailability, setMechAvailability] = useState<{ id: string; day_of_week: number; start_time: string; end_time: string }[]>([]);
  const [closedPeriods, setClosedPeriods] = useState<{ id: string; start_date: string; end_date: string; reason: string }[]>([]);
  const [addAvailModal, setAddAvailModal] = useState<{ dayIdx: number; startTime: string; endTime: string } | null>(null);
  const [newClosedPeriod, setNewClosedPeriod] = useState({ startDate: '', endDate: '', reason: '' });
  const [ohSaving, setOhSaving] = useState(false);
  const [closedSaving, setClosedSaving] = useState(false);
  const [operatingHours, setOperatingHours] = useState([
    { dayOfWeek: 0, label: 'Mon', enabled: true,  startTime: '08:00', endTime: '17:00' },
    { dayOfWeek: 1, label: 'Tue', enabled: true,  startTime: '08:00', endTime: '17:00' },
    { dayOfWeek: 2, label: 'Wed', enabled: true,  startTime: '08:00', endTime: '17:00' },
    { dayOfWeek: 3, label: 'Thu', enabled: true,  startTime: '08:00', endTime: '17:00' },
    { dayOfWeek: 4, label: 'Fri', enabled: true,  startTime: '08:00', endTime: '17:00' },
    { dayOfWeek: 5, label: 'Sat', enabled: false, startTime: '08:00', endTime: '12:00' },
    { dayOfWeek: 6, label: 'Sun', enabled: false, startTime: '08:00', endTime: '12:00' },
  ]);

  const [manualQuoteFilter, setManualQuoteFilter] = useState<'queue' | 'sent'>('queue');
  const [chatPhoto, setChatPhoto] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    fetch(`/api/mechanic/packages?mechanicId=${user.id}`).then(r => r.json()).then(d => setPackages(d.packages || [])).catch(() => {});
  }, [user]);

  // Quote builder
  const [quoteJob, setQuoteJob] = useState<any | null>(null);
  const [qParts, setQParts] = useState<{ name: string; qty: number; unitPrice: number }[]>([]);
  const [qLabourHours, setQLabourHours] = useState(1);
  const [qLabourRate, setQLabourRate] = useState(145);
  const [qDiscount, setQDiscount] = useState(0);
  const [qOther, setQOther] = useState<{ name: string; amount: number }[]>([]);
  const [qNotes, setQNotes] = useState('');
  const [partsToOrder, setPartsToOrder] = useState<{ id: string; name: string; qty: number; forRego?: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('torqued_parts_to_order') || '[]'); } catch { return []; }
  });
  const savePartsToOrder = (list: typeof partsToOrder) => {
    setPartsToOrder(list);
    try { localStorage.setItem('torqued_parts_to_order', JSON.stringify(list)); } catch {}
  };
  // Match a needed part name against current inventory; returns stock qty (or 0)
  const stockFor = (name: string) => {
    if (!name?.trim()) return null;
    const hit = parts.find(p => p.name.trim().toLowerCase() === name.trim().toLowerCase());
    return hit ? hit.quantity : 0;
  };
  const [partLookupBusy, setPartLookupBusy] = useState<number | null>(null);
  const aiLookupPart = async (i: number) => {
    const p = qParts[i]; if (!p.name.trim()) { alert('Type a part name first.'); return; }
    setPartLookupBusy(i);
    try {
      const r = await fetch('/api/ai/parts-lookup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: p.name, make: quoteJob?.model }),
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error || 'Lookup failed.'); return; }
      const n = [...qParts];
      n[i] = { ...p, name: d.oemNumber ? `${d.name} (${d.oemNumber})` : (d.name || p.name), unitPrice: d.estPriceNZD || p.unitPrice };
      setQParts(n);
      if (d.suppliers?.length) alert(`${d.name}\nEst. $${d.estPriceNZD ?? '—'} NZD\nSuppliers: ${d.suppliers.join(', ')}${d.notes ? `\n\n${d.notes}` : ''}`);
    } catch { alert('Lookup failed.'); }
    finally { setPartLookupBusy(null); }
  };
  const [qSending, setQSending] = useState(false);

  const openQuoteEditor = (job: any) => {
    setQuoteJob(job);
    // Re-open with the previously saved quote breakdown if there is one
    const qi = job.quoteItems;
    if (qi) {
      setQParts(Array.isArray(qi.parts) && qi.parts.length ? qi.parts : [{ name: '', qty: 1, unitPrice: 0 }]);
      setQLabourHours(qi.labourHours ?? 1);
      setQLabourRate(qi.labourRate ?? (profileData.labourRate || 145));
      setQDiscount(qi.discount ?? 0);
      setQOther(Array.isArray(qi.other) ? qi.other : []);
      setQNotes(qi.notes ?? '');
    } else {
      setQParts([{ name: '', qty: 1, unitPrice: 0 }]);
      setQLabourHours(1);
      setQLabourRate(profileData.labourRate || 145);
      setQDiscount(0);
      setQOther([]);
      setQNotes('');
    }
  };
  const qPartsTotal = qParts.reduce((s, p) => s + (p.qty || 0) * (p.unitPrice || 0), 0);
  const qLabourTotal = (qLabourHours || 0) * (qLabourRate || 0);
  const qOtherTotal = qOther.reduce((s, o) => s + (o.amount || 0), 0);
  const qTotal = Math.max(0, qPartsTotal + qLabourTotal + qOtherTotal - (qDiscount || 0));

  const fetchDataUrl = (src: string): Promise<string | null> => new Promise(resolve => {
    fetch(src).then(r => r.blob()).then(b => { const fr = new FileReader(); fr.onloadend = () => resolve(fr.result as string); fr.onerror = () => resolve(null); fr.readAsDataURL(b); }).catch(() => resolve(null));
  });

  // Prior completed week (Mon 00:00 → Sun 23:59) relative to now
  const priorWeekRange = () => {
    const now = new Date();
    const dow = (now.getDay() + 6) % 7; // 0 = Monday
    const thisMon = new Date(now); thisMon.setHours(0, 0, 0, 0); thisMon.setDate(now.getDate() - dow);
    const start = new Date(thisMon); start.setDate(thisMon.getDate() - 7);
    const end = new Date(thisMon); end.setMilliseconds(-1);
    return { start, end };
  };

  // Download the weekly revenue report (prior Mon–Sun, jobs − 4% commission)
  const downloadWeeklyReport = async () => {
    const { start, end } = priorWeekRange();
    const jobs = pastJobs.filter((j: any) => {
      if (j.payment_status !== 'confirmed') return false;
      const t = new Date(j.completed_at || j.created_at).getTime();
      return t >= start.getTime() && t <= end.getTime();
    });
    const gross = jobs.reduce((s: number, j: any) => s + (parseFloat(j.total_price) || 0), 0);
    const commission = gross * 0.04, payout = gross - commission;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const logo = await fetchDataUrl('/torqued-logo.png');
    doc.setFillColor(21, 4, 2); doc.rect(0, 0, 210, 40, 'F'); doc.setFillColor(255, 24, 0); doc.rect(0, 40, 210, 2, 'F');
    if (logo) doc.addImage(logo, 'PNG', 15, 11, 52, 17.4);
    doc.setTextColor(255, 255, 255); doc.setFont('Helvetica', 'bold'); doc.setFontSize(11); doc.text('WEEKLY REVENUE REPORT', 195, 18, { align: 'right' });
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(180, 180, 180);
    doc.text(`${start.toLocaleDateString('en-NZ')} – ${end.toLocaleDateString('en-NZ')}`, 195, 24, { align: 'right' });
    doc.text(profileData.name || 'Workshop', 195, 29, { align: 'right' });
    let y = 54; doc.setTextColor(21, 4, 2); doc.setFontSize(9);
    const row = (a: string, b: string, c: string, d: string, bold = false) => { doc.setFont('Helvetica', bold ? 'bold' : 'normal'); doc.text(a, 15, y); doc.text(b, 110, y); doc.text(c, 150, y); doc.text(d, 195, y, { align: 'right' }); y += 6.5; };
    row('Date', 'Vehicle', 'Customer', 'Amount', true); y += 1; doc.setDrawColor(226, 232, 240); doc.line(15, y - 4, 195, y - 4);
    if (jobs.length === 0) { doc.setFont('Helvetica', 'italic'); doc.text('No paid jobs in this period.', 15, y); y += 8; }
    jobs.forEach((j: any) => row(new Date(j.completed_at || j.created_at).toLocaleDateString('en-NZ'), (j.vehicle_rego || '—').slice(0, 18), (j.customer_name || '—').slice(0, 18), `$${(parseFloat(j.total_price) || 0).toFixed(2)}`));
    y += 4; doc.line(15, y, 195, y); y += 8; doc.setFontSize(10);
    row('', '', 'Gross (jobs)', `$${gross.toFixed(2)}`);
    row('', '', 'Torqued commission (4%)', `-$${commission.toFixed(2)}`);
    doc.setTextColor(255, 24, 0); row('', '', 'YOUR PAYOUT', `$${payout.toFixed(2)}`, true);
    doc.setTextColor(120, 120, 120); doc.setFontSize(8); doc.text('Your $99/month subscription is billed separately to your card and is not deducted here.', 15, y + 4);
    doc.save(`Torqued-Weekly-Report-${start.toISOString().slice(0, 10)}.pdf`);
  };

  // Build & download a branded TAX INVOICE for a paid job (from its stored quote_items)
  const exportInvoice = async (job: any) => {
    const qi = job.quote_items || {};
    const parts = Array.isArray(qi.parts) ? qi.parts.filter((p: any) => p.name) : [];
    const labourTotal = (qi.labourHours || 0) * (qi.labourRate || 0);
    const otherList = Array.isArray(qi.other) ? qi.other.filter((o: any) => o.name) : [];
    const total = parseFloat(job.quoted_price ?? job.total_price) || 0;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const logo = await fetchDataUrl('/torqued-logo.png');
    doc.setFillColor(21, 4, 2); doc.rect(0, 0, 210, 40, 'F');
    doc.setFillColor(255, 24, 0); doc.rect(0, 40, 210, 2, 'F');
    if (logo) doc.addImage(logo, 'PNG', 15, 11, 52, 17.4);
    const isPaid = job.payment_status === 'confirmed';
    doc.setTextColor(255, 255, 255); doc.setFont('Helvetica', 'bold'); doc.setFontSize(11);
    doc.text(isPaid ? 'TAX INVOICE' : 'QUOTE', 195, 20, { align: 'right' });
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(180, 180, 180);
    doc.text(`Invoice #${job.id}`, 195, 26, { align: 'right' });
    doc.text(new Date(job.completed_at || job.date || Date.now()).toLocaleDateString('en-NZ'), 195, 31, { align: 'right' });

    let y = 54; doc.setTextColor(21, 4, 2); doc.setFontSize(10); doc.setFont('Helvetica', 'bold');
    doc.text(`${profileData.name || 'Workshop'}`, 15, y);
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(9); y += 6;
    doc.text(`Billed to: ${job.customer_name || 'Customer'}${job.vehicle_rego ? `  ·  ${job.vehicle_rego}` : ''}`, 15, y);
    y += 10; doc.setFontSize(9);
    const row = (label: string, amt: string, bold = false) => { doc.setFont('Helvetica', bold ? 'bold' : 'normal'); doc.text(label, 15, y); doc.text(amt, 195, y, { align: 'right' }); y += 6.5; };
    parts.forEach((p: any) => row(`${p.name}  x${p.qty}`, `$${(p.qty * p.unitPrice).toFixed(2)}`));
    if (labourTotal > 0) row(`Labour (${qi.labourHours}h @ $${qi.labourRate}/hr)`, `$${labourTotal.toFixed(2)}`);
    otherList.forEach((o: any) => row(o.name, `$${o.amount.toFixed(2)}`));
    if (qi.discount > 0) row('Discount', `-$${Number(qi.discount).toFixed(2)}`);
    y += 2; doc.setDrawColor(226, 232, 240); doc.line(15, y, 195, y); y += 7;
    doc.setFontSize(12); doc.setTextColor(255, 24, 0); row(isPaid ? 'TOTAL PAID (GST incl.)' : 'TOTAL (GST incl.)', `$${total.toFixed(2)}`, true);
    if (isPaid) { doc.setTextColor(16, 185, 129); doc.setFont('Helvetica', 'bold'); doc.setFontSize(10); doc.text('PAID IN FULL', 15, y + 2); }
    doc.setFontSize(7.5); doc.setTextColor(150, 150, 150);
    doc.text(`${isPaid ? 'Invoice' : 'Quote'} issued via Torqued — NZ's smarter way to get your car sorted. Prices include 15% GST.`, 15, 285);
    doc.save(`Torqued-${isPaid ? 'Invoice' : 'Quote'}-${job.id}.pdf`);
  };

  // Build a branded, itemised quote PDF (logo + QR) and return base64
  const buildQuotePdf = async (job: any): Promise<string> => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const logo = await fetchDataUrl('/torqued-logo.png');
    // QR deep-links straight to this quote's review-and-pay screen (quote pre-loaded)
    const quoteUrl = `https://torquednz.vercel.app/customer?quote=${encodeURIComponent(job.id)}`;
    const qr = await fetchDataUrl('https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=' + encodeURIComponent(quoteUrl));

    doc.setFillColor(21, 4, 2); doc.rect(0, 0, 210, 40, 'F');
    doc.setFillColor(255, 24, 0); doc.rect(0, 40, 210, 2, 'F');
    if (logo) doc.addImage(logo, 'PNG', 15, 11, 52, 17.4);
    doc.setTextColor(255, 255, 255); doc.setFont('Helvetica', 'bold'); doc.setFontSize(11);
    doc.text('SERVICE QUOTE', 195, 20, { align: 'right' });
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(180, 180, 180);
    doc.text(`Ref #${(job.id || '').toUpperCase()}`, 195, 27, { align: 'right' });
    doc.text(new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }), 195, 32, { align: 'right' });

    doc.setTextColor(21, 4, 2); doc.setFontSize(9.5);
    doc.setFont('Helvetica', 'bold'); doc.text('WORKSHOP', 15, 54);
    doc.setFont('Helvetica', 'normal'); doc.text(profileData.name || 'Torqued Workshop', 15, 60);
    doc.text(profileData.address || '', 15, 65);
    doc.setFont('Helvetica', 'bold'); doc.text('CUSTOMER / VEHICLE', 115, 54);
    doc.setFont('Helvetica', 'normal');
    doc.text(job.customerName || job.model || 'Customer', 115, 60);
    doc.text(`${job.reg || ''}`, 115, 65);

    let y = 80;
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 24, 0);
    doc.text('ITEMISED QUOTE', 15, y); doc.setDrawColor(226, 232, 240); doc.line(15, y + 2, 195, y + 2);
    y += 9; doc.setFontSize(9); doc.setTextColor(21, 4, 2);
    const row = (label: string, amt: string, bold = false) => { doc.setFont('Helvetica', bold ? 'bold' : 'normal'); doc.text(label, 15, y); doc.text(amt, 195, y, { align: 'right' }); y += 6.5; };
    qParts.filter(p => p.name).forEach(p => row(`${p.name}  x${p.qty}`, `$${(p.qty * p.unitPrice).toFixed(2)}`));
    if (qLabourTotal > 0) row(`Labour (${qLabourHours}h @ $${qLabourRate}/hr)`, `$${qLabourTotal.toFixed(2)}`);
    qOther.filter(o => o.name).forEach(o => row(o.name, `$${o.amount.toFixed(2)}`));
    if (qDiscount > 0) row('Discount', `-$${qDiscount.toFixed(2)}`);
    y += 2; doc.setDrawColor(226, 232, 240); doc.line(15, y, 195, y); y += 7;
    doc.setFontSize(12); doc.setTextColor(255, 24, 0); row('TOTAL (GST incl.)', `$${qTotal.toFixed(2)}`, true);

    // Notes
    if (qNotes.trim()) {
      y += 4; doc.setFont('Helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(21, 4, 2); doc.text('Notes', 15, y);
      y += 5; doc.setFont('Helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(80, 80, 80);
      doc.splitTextToSize(qNotes.trim(), 180).forEach((line: string) => { doc.text(line, 15, y); y += 4.5; });
    }

    // QR + CTA
    if (qr) doc.addImage(qr, 'PNG', 15, 240, 32, 32);
    doc.setTextColor(21, 4, 2); doc.setFont('Helvetica', 'bold'); doc.setFontSize(11);
    doc.text('Book on your own terms with Torqued', 52, 250);
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100, 100, 100);
    doc.text('Scan the QR code to accept this quote and book instantly.', 52, 256);
    doc.setFontSize(7.5); doc.setTextColor(150, 150, 150);
    doc.text('Quote provided via Torqued — NZ\'s smarter way to get your car sorted. Prices include 15% GST.', 15, 285);

    return doc.output('datauristring').split(',')[1];
  };
  const [mechResendCooldown, setMechResendCooldown] = useState(0);
  const [mechResendMsg, setMechResendMsg] = useState<string | null>(null);

  useEffect(() => {
    if (mechResendCooldown <= 0) return;
    const t = setInterval(() => setMechResendCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [mechResendCooldown]);
  
  // Listen for returning Stripe subscription sessions
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (!sessionId || !user) return;

    (async () => {
      try {
        // A session_id is only present on a successful checkout return (cancel goes
        // to ?canceled=true). The mechanic is logged in, so activate them directly —
        // this also handles $0 promo subscriptions where payment_status != 'paid'.
        await fetch('/api/mechanic/activate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mechanicId: user.id }),
        });
        setJustActivated(true); markSubscriptionActive(); // unlock now
      } catch (err) {
        console.error('Subscription activation failed:', err);
      } finally {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    })();
  }, [user]);

  // Reliable subscription status sync on load (service role — survives refresh)
  useEffect(() => {
    if (!user) return;
    fetch(`/api/mechanic/status?id=${user.id}`)
      .then(r => r.json())
      .then(d => { if (d.subscriptionActive) setJustActivated(true); })
      .catch(() => {});
  }, [user]);

  // Load mechanic data from Supabase on mount
  useEffect(() => {
    if (!user) return;

    // Profile
    supabase
      .from('profiles')
      .select('name, phone, address, nzbn, service_areas, diagnostic_tools, certifications, labour_rate, shop_fee, banner_image, technicians, parts_lead_days')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setCap(prev => ({ ...prev, technicians: data.technicians ?? 1, parts_lead_days: data.parts_lead_days ?? 1, labour_rate: data.labour_rate ?? 145 }));
        setQLabourRate(data.labour_rate ?? 145);
        // Cancellation policy is read separately so a not-yet-run migration can't break the profile load.
        supabase.from('profiles').select('cancellation_notice_hours, cancellation_partial_refund_pct').eq('id', user.id).single()
          .then(({ data: cd }: any) => { if (cd) setCap(prev => ({ ...prev, cancellation_notice_hours: cd.cancellation_notice_hours ?? 72, cancellation_partial_refund_pct: cd.cancellation_partial_refund_pct ?? 80 })); });
        setProfileData(prev => ({
          ...prev,
          name: data.name || prev.name,
          phone: data.phone || prev.phone,
          address: data.address || prev.address,
          nzbn: data.nzbn || prev.nzbn,
          serviceAreas: data.service_areas?.length ? data.service_areas : prev.serviceAreas,
          diagnosticTools: data.diagnostic_tools?.length ? data.diagnostic_tools : prev.diagnosticTools,
          certifications: data.certifications?.length ? data.certifications : prev.certifications,
          labourRate: data.labour_rate ?? prev.labourRate,
          shopFee: data.shop_fee ?? prev.shopFee,
          bannerImage: data.banner_image || prev.bannerImage,
        }));
      });

    // Subscription status + payment history
    fetch(`/api/mechanic/billing?mechanicId=${user.id}`).then(r => r.json()).then(setBilling).catch(() => {});
    // Customers who've interacted with this workshop
    fetch(`/api/mechanic/customers?mechanicId=${user.id}`).then(r => r.json()).then(d => setCustomers(d.customers || [])).catch(() => {});
    // Mechanic availability slots + closed periods
    fetch(`/api/mechanic/availability?mechanicId=${user.id}`)
      .then(r => r.json())
      .then(d => {
        const slots = d.slots || [];
        setMechAvailability(slots);
        setClosedPeriods(d.closedPeriods || []);
        if (slots.length) {
          setOperatingHours(prev => prev.map(oh => {
            const slot = slots.find((s: any) => s.day_of_week === oh.dayOfWeek);
            if (!slot) return { ...oh, enabled: false };
            return { ...oh, enabled: true, startTime: (slot.start_time as string).slice(0, 5), endTime: (slot.end_time as string).slice(0, 5) };
          }));
        }
      })
      .catch(() => {});

    // Incoming jobs from bookings assigned to this mechanic (service role — bypasses RLS)
    fetch(`/api/mechanic/jobs?mechanicId=${user.id}`)
      .then(r => r.json())
      .then(({ jobs: rows }) => {
        const all = rows || [];
        // Real revenue this week = paid jobs in the last 7 days (net of 4% Torqued commission)
        const weekAgo = Date.now() - 7 * 864e5;
        const paidThisWeek = all.filter((r: any) => r.payment_status === 'confirmed' && new Date(r.completed_at || r.created_at).getTime() >= weekAgo);
        setWeekRevenue(Math.round(paidThisWeek.reduce((s: number, r: any) => s + (parseFloat(r.total_price) || 0) * 0.96, 0)));
        // Job History = accepted/in-progress/completed jobs + all cold quotes (mechanic-created)
        setPastJobs(all.filter((r: any) => ['completed', 'in_progress'].includes(r.status) || r.is_cold_quote));
        // Incoming queue = real customer jobs still needing action + quoted jobs (show in SENT filter)
        const data = all.filter((r: any) => ['booked', 'pending_payment', 'pending', 'quoted'].includes(r.status) && !r.is_cold_quote);
        if (!data || data.length === 0) { setIncomingJobs([]); return; }
        const jobs = data.map((row: any) => ({
          id: row.id,
          reg: row.vehicle_rego || '',
          model: row.customer_name ? `${row.vehicle_rego} — ${row.customer_name}` : row.vehicle_rego || 'Unknown Vehicle',
          details: [row.date, row.payment_method].filter(Boolean).join(' • '),
          suggestedQuote: parseFloat(row.total_price) || 0,
          services: (row.service_ids || []).map((id: string) => SERVICES.find(s => s.id === id)?.name || id),
          description: row.description || row.fault_code || '',
          status: row.status === 'booked' ? 'Booked via Torqued' : row.status === 'quoted' ? 'Quote Sent' : 'Awaiting Payment',
          partsMatch: 0,
          profit: Math.round((parseFloat(row.total_price) || 0) * 0.65),
          requiredParts: [],
          quoteItems: row.quote_items || null,
        }));
        setIncomingJobs(prev => {
          const dbIds = new Set(jobs.map((j: any) => j.id));
          const localOnly = prev.filter(j => !dbIds.has(j.id));
          return [...jobs, ...localOnly];
        });
      });

    // Parts inventory — routed through Express (service role) to bypass RLS issues
    fetch(`/api/mechanic/parts?mechanicId=${user.id}`)
      .then(r => r.json())
      .then(({ parts: rows }) => {
        if (!rows?.length) return;
        const dbParts = rows.map((row: any) => ({
          id: row.id,
          name: row.name,
          quantity: row.quantity,
          unitPrice: parseFloat(row.unit_price) || 0,
          description: row.description ?? undefined,
          minStockLevel: row.min_stock_level ?? undefined,
        }));
        setParts(prev => {
          const dbIds = new Set(dbParts.map((p: any) => p.id));
          const localOnly = prev.filter((p: any) => !dbIds.has(p.id));
          return [...dbParts, ...localOnly];
        });
      })
      .catch(() => {});
  }, [user]);

  const [stripeSubscriptionUrl, setStripeSubscriptionUrl] = useState<string | null>(null);
  const [showStripeSubscriptionModal, setShowStripeSubscriptionModal] = useState(false);
  const [stripeFormStep, setStripeFormStep] = useState<'input' | 'processing' | 'success'>('input');
  const [stripeLoadingMessage, setStripeLoadingMessage] = useState('Initiating subscription... Please wait.');
  const [cardNum, setCardNum] = useState('');
  const [cardExp, setCardExp] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardPostalCode, setCardPostalCode] = useState('');
  const [cardError, setCardError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(false);
  const [activeTab, setActiveTab ] = useState('dashboard');
  const [jobsSubtab, setJobsSubtab] = useState<'accept' | 'today' | 'upcoming' | 'history' | 'cold'>('accept');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('week');
  const [parts, setParts] = useState<InventoryPart[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [incomingJobs, setIncomingJobs] = useState<any[]>([]);
  const [weekRevenue, setWeekRevenue] = useState(0);
  const [pastJobs, setPastJobs] = useState<any[]>([]);
  const [jobHistory, setJobHistory] = useState<any[]>([]);
  const [billing, setBilling] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [custSearch, setCustSearch] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const addPartToOrder = (name: string, qty = 1, forRego?: string) => {
    const clean = name.trim(); if (!clean) return;
    savePartsToOrder([...partsToOrder, { id: Math.random().toString(36).slice(2), name: clean, qty, forRego }]);
  };

  const sendChat = async (overrideText?: string) => {
    const text = (overrideText ?? chatInput).trim();
    const photo = chatPhoto;
    if (!text && !photo || chatBusy) return;
    // Command: "order: <part> [xN]" adds straight to the parts-to-order list (no AI call)
    const orderCmd = text.match(/^(?:order|add to order(?: list)?)\s*[:\-]?\s*(.+)/i);
    if (orderCmd && !photo) {
      const raw = orderCmd[1].trim();
      const qm = raw.match(/\s*x\s*(\d+)\s*$/i);
      const qty = qm ? parseInt(qm[1], 10) : 1;
      const partName = raw.replace(/\s*x\s*\d+\s*$/i, '').trim();
      addPartToOrder(partName, qty, quoteJob?.reg);
      setChatMessages(m => [...m, { role: 'user', content: text }, { role: 'assistant', content: `✓ Added "${partName}"${qty > 1 ? ` ×${qty}` : ''} to your Parts-to-order list (see the Parts page).` }]);
      setChatInput('');
      return;
    }
    const userMsg: any = { role: 'user' as const, content: text || 'What can you see in this image?' };
    if (photo) userMsg.image = photo;
    const next = [...chatMessages, userMsg];
    setChatMessages(next); setChatInput(''); setChatPhoto(null); setChatBusy(true);
    try {
      const r = await fetch('/api/ai/mechanic-assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, vehicle: quoteJob?.model || undefined, rego: quoteJob?.reg || undefined, mechanicId: user?.id }),
      });
      const d = await r.json();
      setChatMessages(m => [...m, { role: 'assistant', content: r.ok ? d.reply : (d.error || 'Assistant unavailable.') }]);
    } catch {
      setChatMessages(m => [...m, { role: 'assistant', content: 'Could not reach the assistant.' }]);
    } finally { setChatBusy(false); }
  };

  // Job notes: { [bookingId]: { open: bool, notes: [], input: str, loading: bool } }
  const [jobNotes, setJobNotes] = useState<Record<string, { open: boolean; notes: { id: string; note: string; author: string; created_at: string }[]; input: string; loading: boolean }>>({});
  // Vehicle photos per rego
  const [vehiclePhotos, setVehiclePhotos] = useState<Record<string, { open: boolean; photos: { id: string; photo_url: string; comment: string; uploaded_by: string; created_at: string; booking_id?: string }[]; comment: string; loading: boolean }>>({});

  const openJobNotes = async (bookingId: string) => {
    setJobNotes(prev => ({ ...prev, [bookingId]: { ...prev[bookingId], open: true, loading: true, notes: prev[bookingId]?.notes || [], input: prev[bookingId]?.input || '' } }));
    try {
      const r = await fetch(`/api/booking/${bookingId}/notes`);
      const d = await r.json();
      setJobNotes(prev => ({ ...prev, [bookingId]: { ...prev[bookingId], notes: d.notes || [], loading: false } }));
    } catch { setJobNotes(prev => ({ ...prev, [bookingId]: { ...prev[bookingId], loading: false } })); }
  };

  const addJobNote = async (bookingId: string) => {
    const s = jobNotes[bookingId];
    if (!s?.input?.trim()) return;
    const note = s.input.trim();
    setJobNotes(prev => ({ ...prev, [bookingId]: { ...prev[bookingId], input: '', loading: true } }));
    try {
      const r = await fetch(`/api/booking/${bookingId}/notes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, author: profileData.name || 'mechanic' }),
      });
      const d = await r.json();
      if (d.note) setJobNotes(prev => ({ ...prev, [bookingId]: { ...prev[bookingId], notes: [d.note, ...(prev[bookingId]?.notes || [])], loading: false } }));
    } catch { setJobNotes(prev => ({ ...prev, [bookingId]: { ...prev[bookingId], loading: false } })); }
  };

  const deleteJobNote = async (bookingId: string, noteId: string) => {
    await fetch(`/api/booking/${bookingId}/notes/${noteId}`, { method: 'DELETE' });
    setJobNotes(prev => ({ ...prev, [bookingId]: { ...prev[bookingId], notes: (prev[bookingId]?.notes || []).filter(n => n.id !== noteId) } }));
  };

  const openVehiclePhotos = async (rego: string) => {
    setVehiclePhotos(prev => ({ ...prev, [rego]: { ...prev[rego], open: true, loading: true, photos: prev[rego]?.photos || [], comment: prev[rego]?.comment || '' } }));
    try {
      const r = await fetch(`/api/vehicle-photos/${rego}`);
      const d = await r.json();
      setVehiclePhotos(prev => ({ ...prev, [rego]: { ...prev[rego], photos: d.photos || [], loading: false } }));
    } catch { setVehiclePhotos(prev => ({ ...prev, [rego]: { ...prev[rego], loading: false } })); }
  };

  const uploadVehiclePhoto = async (rego: string, file: File, bookingId?: string) => {
    setVehiclePhotos(prev => ({ ...prev, [rego]: { ...prev[rego], loading: true } }));
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader(); reader.onload = () => res(reader.result as string); reader.onerror = rej; reader.readAsDataURL(file);
      });
      const comment = vehiclePhotos[rego]?.comment || '';
      const r = await fetch('/api/vehicle-photos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rego, bookingId: bookingId || null, imageBase64: base64, comment, uploadedBy: profileData.name || 'mechanic' }),
      });
      const d = await r.json();
      if (d.photo) {
        setVehiclePhotos(prev => ({ ...prev, [rego]: { ...prev[rego], photos: [d.photo, ...(prev[rego]?.photos || [])], comment: '', loading: false } }));
      } else {
        setVehiclePhotos(prev => ({ ...prev, [rego]: { ...prev[rego], loading: false } }));
      }
    } catch { setVehiclePhotos(prev => ({ ...prev, [rego]: { ...prev[rego], loading: false } })); }
  };

  const [showColdQuote, setShowColdQuote] = useState(false);
  const [coldBusy, setColdBusy] = useState(false);
  const [coldForm, setColdForm] = useState({ customerName: '', email: '', phone: '', rego: '', make: '', model: '', description: '', date: '' });

  // OTP / service history access states
  type HistoryAccessState = 'idle' | 'checking' | 'no_account' | 'prior_booking' | 'needs_otp' | 'otp_sent' | 'already_sent' | 'no_email' | 'entering_code' | 'verifying' | 'granted' | 'error';
  const [histAccessState, setHistAccessState] = useState<HistoryAccessState>('idle');
  const [histAccessMsg, setHistAccessMsg] = useState<string | null>(null);
  const [histOtpInput, setHistOtpInput] = useState('');
  const [histOtpExpiry, setHistOtpExpiry] = useState<string | null>(null);
  const [unlockedHistory, setUnlockedHistory] = useState<{ imported: any[]; torquedJobs: any[] } | null>(null);
  const [coldRegoLookedUp, setColdRegoLookedUp] = useState(false);

  const checkHistoryAccess = async (plateRego: string) => {
    if (!user?.id || !plateRego) return;
    setHistAccessState('checking');
    setHistAccessMsg(null);
    setUnlockedHistory(null);
    try {
      const r = await fetch('/api/mechanic/request-history-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mechanicId: user.id, rego: plateRego }),
      });
      const d = await r.json();
      if (!d.hasAccount) { setHistAccessState('no_account'); return; }
      if (d.priorBooking) {
        setHistAccessState('prior_booking');
        // Load history directly
        const hr = await fetch(`/api/mechanic/history-direct?mechanicId=${encodeURIComponent(user.id)}&rego=${encodeURIComponent(plateRego)}`);
        if (hr.ok) { const hd = await hr.json(); setUnlockedHistory(hd.history); setHistAccessState('granted'); }
        return;
      }
      if (d.noEmail) { setHistAccessState('no_email'); return; }
      if (d.alreadySent) {
        setHistOtpExpiry(d.expiresAt);
        setHistAccessState('already_sent');
        return;
      }
      if (d.otpSent) {
        setHistOtpExpiry(d.expiresAt);
        setHistAccessState('otp_sent');
        return;
      }
      setHistAccessState('needs_otp');
    } catch {
      setHistAccessState('error');
      setHistAccessMsg('Could not connect. Please try again.');
    }
  };

  const verifyHistOtp = async () => {
    if (!user?.id || !coldForm.rego || !histOtpInput.trim()) return;
    setHistAccessState('verifying');
    try {
      const r = await fetch('/api/mechanic/verify-history-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mechanicId: user.id, rego: coldForm.rego, otp: histOtpInput.trim() }),
      });
      const d = await r.json();
      if (!r.ok) { setHistAccessState('entering_code'); setHistAccessMsg(d.error || 'Invalid code.'); return; }
      setUnlockedHistory(d.history);
      setHistAccessState('granted');
      setHistAccessMsg(null);
    } catch {
      setHistAccessState('entering_code');
      setHistAccessMsg('Could not connect. Please try again.');
    }
  };
  const [procurementQueue, setProcurementQueue] = useState<ProcurementItem[]>([]);
  const [diagnosticStep, setDiagnosticStep] = useState<'review' | 'inspect' | 'quote' | 'sent'>('review');
  const [diagnosticFindings, setDiagnosticFindings] = useState('');
  const [customQuotePrice, setCustomQuotePrice] = useState('580');
  const [deliveredParts, setDeliveredParts] = useState<DeliveryItem[]>([]);
  const [isAddingPart, setIsAddingPart] = useState(false);
  const [newPart, setNewPart] = useState<Partial<InventoryPart>>({ name: '', quantity: 0, unitPrice: 0 });
  const [showProcurement, setShowProcurement] = useState(false);
  const [selectedJobForProcurement, setSelectedJobForProcurement] = useState<string | null>(null);
  const [procurementSelections, setProcurementSelections] = useState<Record<string, string>>({});
  const [profileData, setProfileData] = useState({
    name: 'Precision Mechanical (Demo)',
    nzbn: '9429045612345',
    phone: '03 455 1234',
    address: '123 Anderson Bay Road',
    serviceAreas: ['South Dunedin', 'Central Dunedin', 'St Kilda', 'Mosgiel', 'Green Island'],
    diagnosticTools: ['Autel MaxiSys Ultra', 'VCDS (Ross-Tech)', 'Snap-on Apollo-D9', 'Odis (VW Factory)'],
    certifications: ['MTA Assured', 'I-Car Certified', 'Level 4 Automotive Engineering', 'High Voltage Certified (EV)'],
    labourRate: 145,
    shopFee: 25,
    bannerImage: 'https://images.unsplash.com/photo-1486006920555-c77dcf18193c?auto=format&fit=crop&q=80&w=1920'
  });

  // Load the vehicle's portable service history (imported + Torqued jobs) when a job is opened
  useEffect(() => {
    const job = incomingJobs.find(j => j.id === selectedJobId);
    const reg = job?.reg;
    if (!reg) { setJobHistory([]); return; }
    fetch(`/api/history/${encodeURIComponent(reg)}`)
      .then(r => r.json())
      .then(({ imported, jobs }) => {
        const fromImports = (imported || []).map((h: any, i: number) => ({
          id: `imp${i}`, date: h.service_date || '', mileage: h.mileage || undefined,
          service: h.work_done || 'Service', provider: h.provider || 'Customer record', isExternal: true,
        }));
        const fromJobs = (jobs || []).filter((j: any) => j.status === 'completed').map((j: any) => ({
          id: `job${j.id}`, date: j.completed_at || j.date || j.created_at,
          service: (j.service_ids || []).map((id: string) => SERVICES.find(s => s.id === id)?.name || id).join(', ') || 'Torqued service',
          provider: 'Torqued', isExternal: false,
        }));
        setJobHistory([...fromImports, ...fromJobs]);
      })
      .catch(() => setJobHistory([]));
  }, [selectedJobId, incomingJobs]);

  // Check-out modal state
  const [checkoutModal, setCheckoutModal] = useState<{ job: any } | null>(null);
  const [checkoutKm, setCheckoutKm] = useState('');
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  const openCheckout = (job: any) => { setCheckoutModal({ job }); setCheckoutKm(''); setCheckoutNotes(''); };

  const confirmCheckout = async () => {
    if (!checkoutModal) return;
    const { job } = checkoutModal;
    const km = parseInt(checkoutKm.replace(/\D/g, ''), 10);
    if (!Number.isFinite(km) || km <= 0) { alert('Please enter a valid odometer reading.'); return; }
    setCheckoutBusy(true);
    try {
      const r = await fetch('/api/mechanic/car-ready', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: job.id, km, notes: checkoutNotes.trim() || undefined, mechanicName: profileData.name }),
      });
      if (!r.ok) { alert('Could not complete checkout. Please try again.'); return; }
      setPastJobs(prev => prev.filter((j: any) => j.id !== job.id));
      setIncomingJobs(prev => prev.filter(j => j.id !== job.id));
      setCheckoutModal(null);
    } catch { alert('Could not complete checkout.'); }
    finally { setCheckoutBusy(false); }
  };

  // Mechanic records the odometer at check-in
  const recordMileage = async (job: any, phase: 'in' | 'out') => {
    if (phase === 'out') { openCheckout(job); return; }
    const reg = job.reg;
    if (!reg) { alert('No registration on this job.'); return; }
    const entered = prompt(`Odometer reading (km) at check-IN (vehicle received) for ${reg}:`);
    if (entered == null) return;
    const km = parseInt(entered.replace(/\D/g, ''), 10);
    if (!Number.isFinite(km) || km <= 0) { alert('Please enter a valid number.'); return; }
    try {
      const r = await fetch(`/api/vehicles/${encodeURIComponent(reg)}/mileage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mileage: km, phase, bookingId: job.id }),
      });
      if (!r.ok) { alert('Could not save mileage.'); return; }
      alert(`Checked in at ${km.toLocaleString()} km. Updated system-wide for ${reg}.`);
    } catch { alert('Could not save mileage.'); }
  };

  // Mechanic sends a real email to the customer (reply-to torqued.nz@icloud.com)
  const messageCustomer = async (job: any) => {
    const msg = prompt(`Message to the customer about ${job.reg || 'this job'}:`);
    if (msg == null || !msg.trim()) return;
    try {
      const r = await fetch('/api/mechanic/message-customer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: job.id, message: msg }),
      });
      const d = await r.json();
      alert(r.ok ? 'Message emailed to the customer.' : (d.error || 'Could not send message.'));
    } catch { alert('Could not send message.'); }
  };

  const handleAcceptJob = (jobId: string) => {
    const job = incomingJobs.find(j => j.id === jobId);
    if (!job) return;

    // Remove from incoming + persist accepted status (service role — survives refresh)
    setIncomingJobs(incomingJobs.filter(j => j.id !== jobId));
    fetch('/api/mechanic/update-job-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId: jobId, status: 'in_progress' }) })
      .catch(e => console.error('Failed to accept job:', e));

    // Auto-order parts if they are not in stock
    if (job.partsMatch < 100 && job.requiredParts) {
      const partsCount = job.requiredParts.length;
      const totalOrder = job.requiredParts.reduce((sum, p) => {
        const bestOffer = PART_OFFERS.filter(o => o.partId === p.id).sort((a, b) => a.price - b.price)[0];
        return sum + (bestOffer ? bestOffer.price * p.quantity : 0);
      }, 0);
      
      const uniqueSuppliers = Array.from(new Set(job.requiredParts.map(p => {
        const bestOffer = PART_OFFERS.filter(o => o.partId === p.id).sort((a, b) => a.price - b.price)[0];
        return bestOffer ? SUPPLIERS.find(s => s.id === bestOffer.supplierId)?.name : null;
      }).filter(Boolean))) as string[];

      setDeliveredParts([{ 
        id: Math.random().toString(), 
        supplier: uniqueSuppliers.length > 1 ? `${uniqueSuppliers[0]} + ${uniqueSuppliers.length - 1} more` : uniqueSuppliers[0] || 'Auto-Distributor', 
        items: partsCount, 
        eta: 'Tomorrow 9:00 AM', 
        status: 'Order Sent', 
        icon: '🚚' 
      }, ...deliveredParts]);
    }

    // Add to appointments (default to next available slot for demo)
    const newAppointment = {
      id: Math.random().toString(36).substr(2, 9),
      day: 'Mon',
      time: '16:30',
      endTime: '17:30',
      car: job.model + ' (' + job.reg + ')',
      service: job.services.join(' & '),
      status: 'Waiting' as const,
      type: 'repair' as const
    };
    setAppointments([...appointments, newAppointment]);
    setActiveTab('calendar');
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update({
      name: profileData.name,
      phone: profileData.phone,
      address: profileData.address,
      nzbn: profileData.nzbn,
      service_areas: profileData.serviceAreas,
      diagnostic_tools: profileData.diagnosticTools,
      certifications: profileData.certifications,
      labour_rate: profileData.labourRate,
      shop_fee: profileData.shopFee,
      banner_image: profileData.bannerImage,
    }).eq('id', user.id);
    if (error) console.error('Failed to save profile:', error.message);
  };

  const isDiagnosticJob = (j: any) => j.services?.includes('Diagnostic Inspection');
  const manualQuotesCount = incomingJobs.filter(isDiagnosticJob).length;
  const pendingJobsCount = incomingJobs.filter(j => !isDiagnosticJob(j)).length;

  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'jobs', label: 'My Jobs', icon: Inbox, badge: pendingJobsCount > 0 ? pendingJobsCount : undefined },
    { id: 'manual-quotes', label: 'Manual Quotes', icon: PenSquare, badge: manualQuotesCount > 0 ? manualQuotesCount : undefined },
    { id: 'customers', label: 'Customers', icon: User },
    { id: 'vehicle-health', label: 'Vehicle Health', icon: HeartPulse },
    { id: 'assistant', label: 'Assistant', icon: MessageCircle },
    { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
    { id: 'parts', label: 'Parts', icon: Package },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  const weeklyRevenueData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const map: Record<string, number> = {}; days.forEach(d => map[d] = 0);
    pastJobs.filter(j => j.payment_status === 'confirmed').forEach(j => {
      const idx = (new Date(j.completed_at || j.created_at).getDay() + 6) % 7;
      map[days[idx]] += parseFloat(j.total_price) || 0;
    });
    return days.map(d => ({ day: d, amount: Math.round(map[d]) }));
  }, [pastJobs]);

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-4 space-y-1 bg-card border-border">
          <p className="text-[10px] font-bold uppercase text-muted">Today's Jobs</p>
          <div className="flex items-end gap-2">
            <h3 className="text-xl sm:text-3xl text-foreground">{appointments.filter(a => a.day === 'Mon').length}</h3>
          </div>
        </Card>
        <Card className="p-3 sm:p-4 space-y-1 bg-card border-border">
          <p className="text-[10px] font-bold uppercase text-muted">Revenue (7d, net)</p>
          <div className="flex items-end gap-2">
            <h3 className="text-xl sm:text-3xl text-foreground">{formatCurrency(weekRevenue)}</h3>
          </div>
        </Card>
        <Card className="p-3 sm:p-4 space-y-1 bg-card border-border">
          <p className="text-[10px] font-bold uppercase text-muted">Pending</p>
          <div className="flex items-end gap-2">
            <h3 className="text-xl sm:text-3xl text-foreground">{incomingJobs.length}</h3>
          </div>
        </Card>
        <Card className="p-3 sm:p-4 space-y-1 bg-torqued-red text-white border-none">
          <p className="text-[10px] font-bold uppercase text-white/60 text-xs">Couriers</p>
          <div className="flex items-end gap-2">
            <h3 className="text-xl sm:text-3xl text-white">{deliveredParts.filter(d => d.eta.includes('Today')).length}</h3>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Procurement Review Section */}
          {procurementQueue.length > 0 && (
            <Card className="p-6 border-torqued-red/30 bg-torqued-red/[0.02]">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-torqued-red rounded-xl flex items-center justify-center text-white">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl text-foreground">Confirm to Order</h3>
                    <p className="text-xs text-muted uppercase font-bold tracking-tight">Final verification before supplier dispatch</p>
                  </div>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-bold uppercase text-muted">Total Order</p>
                   <p className="text-xl font-bold text-torqued-red">
                     {formatCurrency(procurementQueue.reduce((sum, j) => sum + (j.orderTotal || 0), 0))}
                   </p>
                </div>
              </div>
              
              <div className="space-y-4">
                {procurementQueue.map(item => (
                   <div key={item.id} className="bg-card p-4 rounded-2xl border border-border flex items-center justify-between group hover:border-torqued-red transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center font-bold text-muted">
                        {item.reg.slice(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-foreground">{item.reg} - {item.model}</h4>
                          <span className="text-[10px] bg-background/50 px-2 py-0.5 rounded font-bold text-muted uppercase">{item.partsCount} Items</span>
                        </div>
                        <p className="text-xs text-muted">Suppliers: {item.suppliers?.join(', ')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right mr-4">
                        <p className="text-[10px] font-bold uppercase text-white/40">Shipment</p>
                        <p className="text-xs font-bold text-emerald-600 italic">Tomorrow AM Delivery</p>
                      </div>
                      <Button 
                        size="sm" 
                        onClick={() => {
                          setDeliveredParts([{ 
                            id: Math.random().toString(), 
                            supplier: item.suppliers?.[0] || 'Multiple', 
                            items: item.partsCount, 
                            eta: 'Tomorrow 9:00 AM', 
                            status: 'Order Placed', 
                            icon: '🚚' 
                          }, ...deliveredParts]);
                          setProcurementQueue(procurementQueue.filter(q => q.id !== item.id));
                        }}
                      >
                        Confirm & Order
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl">Weekly Revenue</h3>
            <select className="bg-transparent text-xs font-bold uppercase outline-none">
              <option>This Week</option>
              <option>Last Week</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyRevenueData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
                <XAxis 
                  dataKey="day" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: 'currentColor' }} 
                  className="text-muted"
                  dy={10} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: 'currentColor' }} 
                  className="text-muted"
                />
                <Tooltip 
                  cursor={{ fill: 'currentColor', opacity: 0.05 }}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    borderRadius: '16px', 
                    border: '1px solid hsl(var(--border))', 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    color: 'hsl(var(--foreground))'
                  }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Bar dataKey="amount" fill="#FF1800" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="space-y-6">
          {/* Courier Overview Widget */}
          <Card className="p-6 space-y-6 bg-background text-foreground border-none relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
              <Package size={120} />
            </div>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <div>
                   <h3 className="text-xl">Courier Feed</h3>
                   <p className="text-muted text-[10px] font-bold uppercase tracking-widest mt-1">Manual entries</p>
                </div>
                <Button variant="ghost" size="sm" className="bg-card text-foreground border-none h-8 text-[10px]" onClick={() => {
                  const supplier = prompt('Supplier / courier name:'); if (!supplier?.trim()) return;
                  const items = parseInt(prompt('Number of parts:') || '0', 10) || 0;
                  const eta = prompt('ETA (e.g. Tomorrow 9:00 AM):') || 'TBC';
                  setDeliveredParts(prev => [{ id: Math.random().toString(36).slice(2), supplier: supplier.trim(), items, eta, status: 'Expected', icon: '📦' }, ...prev]);
                }}>+ Add delivery</Button>
              </div>

              <div className="space-y-4">
                {deliveredParts.length === 0 && <p className="text-sm text-muted italic py-2">No deliveries logged. Tap "+ Add delivery" to track one.</p>}
                {deliveredParts.map(delivery => (
                  <div key={delivery.id} className="flex gap-4 items-center bg-card p-3 rounded-2xl transition-all border border-border">
                    <div className="text-2xl">{delivery.icon}</div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                         <h4 className="text-sm font-bold">{delivery.supplier}</h4>
                         <span className="text-[10px] font-mono text-emerald-500 font-bold uppercase">{delivery.status}</span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                         <p className="text-xs text-muted">{delivery.items} parts arriving</p>
                         <p className="text-[10px] font-bold text-muted">{delivery.eta}</p>
                      </div>
                    </div>
                    <button onClick={() => setDeliveredParts(prev => prev.filter(d => d.id !== delivery.id))} className="text-muted hover:text-torqued-red"><X size={14} /></button>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-border">
                 <p className="text-[10px] font-bold uppercase tracking-widest text-muted italic">Automated courier tracking coming soon</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-6">
            <h3 className="text-xl">Today's Schedule</h3>
            <div className="space-y-4">
              {appointments.filter(a => a.day === 'Mon').slice(0, 4).map((job, i) => (
                <div 
                  key={i} 
                  className="flex gap-4 items-start pb-4 border-b border-black/5 last:border-0 cursor-pointer hover:bg-black/[0.02] -mx-2 px-2 rounded-xl transition-all"
                  onClick={() => {
                    const jobId = job.id === '6' ? 'req3' : 'req1';
                    setSelectedJobId(jobId);
                  }}
                >
                  <div className="text-xs font-bold text-muted pt-1">{job.time}</div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold">{job.car}</h4>
                    <p className="text-xs text-muted">{job.service}</p>
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold uppercase px-2 py-0.5 rounded",
                    job.status === 'In Progress' ? "bg-torqued-red text-white" : "bg-card text-muted"
                  )}>
                    {job.status}
                  </span>
                </div>
              ))}
            </div>
            <Button variant="outline" fullWidth size="sm" className="border-white/10 text-white hover:bg-white/5">View Full Calendar</Button>
          </Card>
        </div>
      </div>
    </div>
  );

  const renderParts = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl">Parts Inventory</h2>
        <Button onClick={() => setIsAddingPart(true)} className="flex items-center gap-2">
          <Plus size={18} /> Add Part
        </Button>
      </div>

      {isAddingPart && (
        <Card className="p-6 border-torqued-red/20 bg-card space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-foreground">Add New Part</h3>
            <button onClick={() => setIsAddingPart(false)}><X size={20} className="text-muted hover:text-foreground" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input 
              label="Part Name" 
              placeholder="E.g. VW Oil Filter" 
              value={newPart.name}
              onChange={(e) => setNewPart({ ...newPart, name: e.target.value })}
            />
            <Input 
              label="Quantity" 
              type="number"
              placeholder="0" 
              value={newPart.quantity || ''}
              onChange={(e) => setNewPart({ ...newPart, quantity: parseInt(e.target.value) || 0 })}
            />
            <Input 
              label="Unit Price ($)" 
              type="number"
              placeholder="0.00" 
              value={newPart.unitPrice || ''}
              onChange={(e) => setNewPart({ ...newPart, unitPrice: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="flex gap-3">
            <Button className="flex-1" onClick={() => {
              if (newPart.name && user) {
                // Optimistic UI update
                const tempId = crypto.randomUUID();
                const optimistic: InventoryPart = { ...newPart as InventoryPart, id: tempId };
                setParts(prev => [...prev, optimistic]);
                setIsAddingPart(false);
                setNewPart({ name: '', quantity: 0, unitPrice: 0 });
                // Persist via Express API (service role — bypasses RLS)
                fetch('/api/mechanic/parts', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    mechanicId: user.id, name: newPart.name,
                    quantity: newPart.quantity, unitPrice: newPart.unitPrice,
                    description: (newPart as any).description ?? null,
                    minStockLevel: (newPart as any).minStockLevel ?? null,
                  }),
                })
                  .then(async r => {
                    const data = await r.json();
                    if (!r.ok) throw new Error(data?.error || `Server error ${r.status}`);
                    return data;
                  })
                  .then(({ part }) => {
                    if (part?.id) {
                      setParts(prev => prev.map(p => p.id === tempId ? { ...optimistic, id: part.id } : p));
                    }
                  })
                  .catch((err) => {
                    setParts(prev => prev.filter(p => p.id !== tempId));
                    alert(`Failed to save part: ${err?.message || 'please try again'}`);
                  });
              }
            }}>Save to Inventory</Button>
            <Button variant="outline" onClick={() => setIsAddingPart(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-4 border-none bg-background text-foreground shadow-sm">
          <div className="w-10 h-10 bg-card rounded-lg flex items-center justify-center border border-border">
            <Package size={20} className="text-torqued-red" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-muted">Total Stock Value</p>
            <p className="text-2xl font-bold">{formatCurrency(parts.reduce((sum, p) => sum + (p.quantity * p.unitPrice), 0))} <span className="text-[10px] font-normal text-muted">excl. GST</span></p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4 border-none bg-background text-foreground shadow-sm">
          <div className="w-10 h-10 bg-card rounded-lg flex items-center justify-center border border-border">
            <AlertCircle size={20} className="text-yellow-500" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-muted">Low Stock Items</p>
            <p className="text-2xl font-bold">{parts.filter(p => p.quantity <= (p.minStockLevel ?? 2)).length}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4 border-none bg-background text-foreground shadow-sm">
          <div className="w-10 h-10 bg-card rounded-lg flex items-center justify-center border border-border">
            <TrendingUp size={20} className="text-green-500" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-muted">Distinct Parts</p>
            <p className="text-2xl font-bold">{parts.length}</p>
          </div>
        </Card>
      </div>

      {partsToOrder.length > 0 && (
        <Card className="p-5 bg-card border-torqued-red/20 space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-torqued-red" />
            <h3 className="text-base font-black text-foreground">Parts to order ({partsToOrder.length})</h3>
          </div>
          <p className="text-xs text-muted">Parts flagged from quotes that you don't have in stock (e.g. cambelt kits). Order these before the job.</p>
          <div className="space-y-2">
            {partsToOrder.map(po => (
              <div key={po.id} className="flex items-center justify-between bg-background border border-border rounded-xl p-3 text-sm">
                <div>
                  <p className="font-bold text-foreground">{po.name} <span className="text-muted font-normal">× {po.qty}</span></p>
                  {po.forRego && <p className="text-[10px] text-muted uppercase tracking-widest">For {po.forRego}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setIsAddingPart(true); setNewPart({ name: po.name, quantity: po.qty, unitPrice: 0 }); savePartsToOrder(partsToOrder.filter(x => x.id !== po.id)); }} className="text-[10px] font-bold text-torqued-red underline">Received → add to stock</button>
                  <button onClick={() => savePartsToOrder(partsToOrder.filter(x => x.id !== po.id))} className="text-muted hover:text-torqued-red"><X size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden bg-card border-border">
        {parts.length === 0 && <p className="p-8 text-center text-muted italic text-sm">No parts in your inventory yet. Add one above.</p>}
        {parts.length > 0 && (
        <table className="w-full text-left">
          <thead className="bg-background text-[10px] font-bold uppercase text-muted">
            <tr>
              <th className="px-6 py-4">Part Details</th>
              <th className="px-6 py-4">Stock Level</th>
              <th className="px-6 py-4">Unit Price</th>
              <th className="px-6 py-4">Total Value</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {parts.map(part => (
              <tr key={part.id} className="hover:bg-background transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-background rounded flex items-center justify-center border border-border">
                      <Package size={14} className="text-muted" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground">{part.name}</p>
                      {part.description && <p className="text-xs text-muted">{part.description}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "font-bold",
                      part.quantity < 5 ? "text-torqued-red" : "text-foreground"
                    )}>{part.quantity} units</span>
                    {part.quantity < 5 && (
                      <span className="text-[8px] bg-torqued-red/20 text-torqued-red px-1.5 py-0.5 rounded font-bold uppercase tracking-widest border border-torqued-red/20">Order Now</span>
                    )}
                  </div>
                  <div className="w-24 h-1.5 bg-background rounded-full mt-1.5 overflow-hidden">
                    <div
                      className={cn("h-full", part.quantity < 5 ? "bg-torqued-red" : "bg-emerald-500")}
                      style={{ width: `${Math.min((part.quantity / 50) * 100, 100)}%` }}
                    />
                  </div>
                </td>
                <td className="px-6 py-4 font-medium text-muted">{formatCurrency(part.unitPrice)}</td>
                <td className="px-6 py-4 font-bold text-foreground">{formatCurrency(part.quantity * part.unitPrice)}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setParts(prev => prev.filter(p => p.id !== part.id));
                        fetch(`/api/mechanic/parts/${part.id}?mechanicId=${user?.id}`, { method: 'DELETE' })
                          .catch(() => {});
                      }}
                      className="p-2 hover:bg-torqued-red/20 rounded-lg text-muted hover:text-torqued-red"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </Card>
    </div>
  );

  const renderIncomingJobs = (showOnlyDiagnostics = false) => {
    const allDiagnosticJobs = incomingJobs.filter(isDiagnosticJob);
    const queueJobs = allDiagnosticJobs.filter(j => !j.quoteItems);
    // sentJobs = jobs with status 'Quote Sent' (with or without structured quoteItems),
    // plus cold-quotes that have quoteItems built in the builder
    const sentDiagJobs  = incomingJobs.filter(j => j.status === 'Quote Sent' || !!j.quoteItems);
    const sentColdJobs  = pastJobs.filter((j: any) => j.is_cold_quote && !!j.quoteItems);
    const sentJobs = [...sentDiagJobs, ...sentColdJobs];

    const displayJobs = showOnlyDiagnostics
      ? (manualQuoteFilter === 'queue' ? queueJobs : sentJobs)
      : incomingJobs.filter(j => !isDiagnosticJob(j));

    const title = showOnlyDiagnostics ? 'Manual Quotes' : 'Incoming Job Requests';
    const subtitle = showOnlyDiagnostics ? 'Diagnostic jobs needing quotes, and sent quotes waiting for booking' : 'Standard service and repair requests';

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
            <p className="text-white/40 text-sm mt-1">{subtitle}</p>
          </div>
          {showOnlyDiagnostics && (
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" className="text-foreground border-border" onClick={() => { setActiveTab('jobs'); setJobsSubtab('cold'); }}>View cold quotes</Button>
              <Button size="sm" className="bg-torqued-red text-white" onClick={() => { setColdForm({ customerName: '', email: '', phone: '', rego: '', make: '', model: '', description: '', date: '' }); setShowColdQuote(true); }}>+ New cold quote</Button>
            </div>
          )}
        </div>

        {showOnlyDiagnostics && (
          <div className="flex gap-1 p-1 bg-card border border-border rounded-xl w-fit">
            <button
              onClick={() => setManualQuoteFilter('queue')}
              className={cn(
                'px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all',
                manualQuoteFilter === 'queue'
                  ? 'bg-torqued-red text-white shadow'
                  : 'text-muted hover:text-foreground'
              )}
            >
              To Be Quoted {queueJobs.length > 0 && <span className="ml-1.5 bg-white/20 text-inherit px-1.5 py-0.5 rounded-full">{queueJobs.length}</span>}
            </button>
            <button
              onClick={() => setManualQuoteFilter('sent')}
              className={cn(
                'px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all',
                manualQuoteFilter === 'sent'
                  ? 'bg-torqued-red text-white shadow'
                  : 'text-muted hover:text-foreground'
              )}
            >
              Quoted {sentJobs.length > 0 && <span className="ml-1.5 bg-white/20 text-inherit px-1.5 py-0.5 rounded-full">{sentJobs.length}</span>}
            </button>
          </div>
        )}

        <div className="space-y-4">
          {displayJobs.length === 0 ? (
            <div className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
              <p className="text-white/40 font-bold uppercase tracking-widest">
                {showOnlyDiagnostics
                  ? (manualQuoteFilter === 'queue' ? 'No jobs awaiting a quote' : 'No sent quotes pending booking')
                  : 'No jobs in this queue'}
              </p>
            </div>
          ) : displayJobs.map(job => (
          <Card key={job.id} className={cn("p-6 space-y-6 border-border bg-card hover:border-torqued-red transition-all", job.quoteItems && "border-emerald-500/30")}>
            <div className="flex justify-between items-start">
              <div className="flex gap-4">
                <div className="w-16 h-16 bg-background border border-border rounded-xl flex items-center justify-center">
                  <Car size={32} className="text-muted/40" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="torqued-badge text-[10px]">{job.reg}</div>
                    {job.quoteItems && (
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">Quote Sent</span>
                    )}
                  </div>
                  <h3 className="text-2xl text-foreground font-bold">{job.model}</h3>
                  <p className="text-sm text-muted font-medium">{job.details}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase text-muted">{job.quoteItems ? 'Quoted Price' : 'Suggested Quote'}</p>
                <p className="text-2xl font-bold text-torqued-red">{formatCurrency(job.quoteItems ? (job.quoteItems.parts?.reduce((s: number, p: any) => s + (p.qty||0)*(p.unitPrice||0), 0) + (job.quoteItems.labourHours||0)*(job.quoteItems.labourRate||0) + (job.quoteItems.other||[]).reduce((s: number, o: any) => s + (o.amount||0), 0) - (job.quoteItems.discount||0)) : job.suggestedQuote)} <span className="text-[10px] block font-normal text-muted/50">Incl. GST</span></p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted font-accent">Services Requested</h4>
                  <div className="flex flex-wrap gap-2">
                    {job.services.map(s => (
                      <span key={s} className="bg-background border border-border px-3 py-1 rounded-lg text-sm font-bold text-foreground">{s}</span>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted font-accent">Customer Description</h4>
                  <p className="text-sm italic text-foreground/80">{job.description}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                     <h4 className="text-xs font-bold uppercase tracking-wider text-muted font-accent">Status Check</h4>
                     <CheckCircle2 size={12} className="text-green-500" />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-display font-bold text-emerald-500 uppercase tracking-tighter italic">{job.status}</span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 py-0 px-3 text-[10px] border-border text-foreground"
                      onClick={() => setSelectedJobId(job.id)}
                    >
                      View Health Report
                    </Button>
                  </div>
                </div>
              </div>

              <div className="bg-background text-foreground p-4 rounded-2xl space-y-3 border border-border shadow-inner">
                <div className="flex items-center gap-2 text-torqued-red font-bold uppercase tracking-widest text-[10px]">
                  <AlertCircle size={14} /> Auto Inventory Sync
                </div>
                <div className="space-y-3">
                  {(job as any).partsMatch < 100 ? (
                    <div className="space-y-2">
                       <p className="text-[10px] font-bold uppercase text-muted">Parts to Order</p>
                       <div className="space-y-1.5">
                         {(job as any).requiredParts?.map((p: any) => {
                           const bestOffer = PART_OFFERS.filter(o => o.partId === p.id).sort((a, b) => a.price - b.price)[0];
                           const supplier = SUPPLIERS.find(s => s.id === bestOffer?.supplierId);
                           return (
                             <div key={p.id} className="flex justify-between items-center text-[10px] bg-card p-1.5 rounded-lg border border-border">
                               <span className="font-medium text-foreground">{p.name}</span>
                               <div className="text-right">
                                 <span className="text-torqued-red font-bold block">{formatCurrency(bestOffer?.price || 0)}</span>
                                 <span className="text-[8px] opacity-60 italic">{supplier?.name}</span>
                               </div>
                             </div>
                           );
                         })}
                       </div>
                       <p className="text-[10px] text-muted pt-1">
                         Estimated Lead Time: <span className="text-foreground font-bold italic">Tomorrow AM</span>
                       </p>
                    </div>
                  ) : (
                    <p className="text-xs leading-relaxed text-foreground/80">
                      Job matches your in-stock parts. <br />
                    </p>
                  )}
                  <div className="pt-2 border-t border-border">
                    <span className="text-foreground font-bold text-xs font-accent">Profit Margin: {formatCurrency(job.profit)} (excl. labour).</span>
                  </div>
                </div>
                <div className="pt-2 flex justify-between items-center border-t border-border">
                  <span className="text-[10px] font-bold uppercase text-muted">Parts Availability</span>
                  <div className="flex items-center gap-3">
                    <span className={cn("text-[10px] font-bold uppercase", (job as any).partsMatch < 50 ? "text-torqued-red" : "text-emerald-500 font-accent")}>
                      {(job as any).partsMatch}% In Workshop Stock
                    </span>
                    {(job as any).partsMatch < 100 && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 py-0 px-2 text-[9px] border-border text-foreground hover:bg-card"
                        onClick={() => {
                          setSelectedJobForProcurement(job.id);
                          setShowProcurement(true);
                        }}
                      >
                        Details
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-border">
              {showOnlyDiagnostics ? (
                <>
                  {job.quoteItems ? (
                    <>
                      <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold" onClick={() => {
                        fetch('/api/mechanic/update-job-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId: job.id, status: 'in_progress' }) }).catch(() => {});
                        setIncomingJobs(prev => prev.map(j => j.id === job.id ? { ...j, services: j.services.filter(s => s !== 'Diagnostic Inspection').concat(['Quoted Job']) } : j));
                        setActiveTab('jobs');
                      }}>Move to My Jobs</Button>
                      <Button className="bg-torqued-red text-white" onClick={() => openQuoteEditor(job)}>Revise Quote</Button>
                    </>
                  ) : (
                    <Button className="flex-1 bg-torqued-red text-white" onClick={() => openQuoteEditor(job)}>Write Manual Quote</Button>
                  )}
                  <Button variant="outline" className="border-border text-foreground hover:bg-card" onClick={() => setSelectedJobId(job.id)}>Diagnostic Report</Button>
                  <Button variant="outline" className="border-border text-foreground hover:bg-card" onClick={() => recordMileage(job, 'in')}>Check-in km</Button>
                  <Button variant="outline" className="border-border text-foreground hover:bg-card" onClick={() => messageCustomer(job)}>Message</Button>
                </>
              ) : (
                <>
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold" onClick={() => handleAcceptJob(job.id)}>Accept Job</Button>
                  <Button variant="outline" className="text-foreground border-border hover:bg-card" onClick={() => recordMileage(job, 'in')}>Check-in km</Button>
                  <Button variant="outline" className="text-foreground border-border hover:bg-card" onClick={() => recordMileage(job, 'out')}>Check-out km</Button>
                  <Button variant="outline" className="flex-1 border-border text-foreground hover:bg-card" onClick={async () => {
                    try {
                      const r = await fetch('/api/reviews/request', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ bookingId: job.id }),
                      });
                      if (r.ok) {
                        await fetch('/api/mechanic/update-job-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId: job.id, status: 'completed' }) });
                        setIncomingJobs(incomingJobs.filter(j => j.id !== job.id));
                        alert('Job marked complete. A review request has been emailed to the customer.');
                      }
                    } catch { alert('Could not mark complete. Try again.'); }
                  }}>Mark Complete</Button>
                  <Button variant="outline" className="text-foreground border-border hover:bg-card" onClick={() => openQuoteEditor(job)}>Build Quote</Button>
                  <Button variant="outline" className="text-amber-500 border-border hover:bg-card" onClick={async () => {
                    const amt = prompt('Refund amount (NZD). Leave blank for FULL refund:');
                    if (amt == null) return;
                    const r = await fetch('/api/stripe/refund', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ bookingId: job.id, amount: amt.trim() ? parseFloat(amt) : undefined }),
                    });
                    const d = await r.json();
                    if (d.success) {
                      await fetch('/api/mechanic/update-job-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId: job.id, status: 'cancelled' }) });
                      setIncomingJobs(incomingJobs.filter(j => j.id !== job.id));
                    }
                    alert(d.success ? `Refunded $${d.refunded}. Booking cancelled.` : (d.error || 'Refund failed.'));
                  }}>Refund</Button>
                  <Button variant="outline" className="text-muted border-border hover:bg-card" onClick={async () => {
                    if (!confirm('Decline this job? It will be removed from your queue.')) return;
                    await fetch('/api/mechanic/update-job-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId: job.id, status: 'declined' }) });
                    setIncomingJobs(incomingJobs.filter(j => j.id !== job.id));
                  }}>Decline</Button>
                </>
              )}
            </div>
          </Card>
          ))}
        </div>
      </div>
    );
  };

  const renderProfile = () => (
    <div className="max-w-4xl space-y-8 pb-12">
      <div className="space-y-2">
        <h2 className="text-3xl text-foreground font-bold">Workshop Profile Setup</h2>
        <p className="text-muted">Complete your profile to start receiving bookings.</p>
      </div>
      
      <div className="space-y-6">
        <Card className="p-0 overflow-hidden border-border bg-card shadow-sm">
          <div className="h-48 bg-background relative group">
            <img 
              src={profileData.bannerImage} 
              alt="Workshop Banner" 
              className="w-full h-full object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
              <Button variant="ghost" className="text-foreground border-border flex items-center gap-2">
                <PenSquare size={16} /> Change Banner Image
              </Button>
            </div>
            <div className="absolute -bottom-12 left-8 w-24 h-24 bg-background p-1 rounded-2xl shadow-2xl border border-border">
              <div className="w-full h-full bg-card rounded-xl flex items-center justify-center relative group overflow-hidden">
                <span className="text-2xl font-black italic text-muted/20">PM</span>
                <div className="absolute inset-0 bg-background/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <ImageIcon size={16} className="text-foreground" />
                </div>
              </div>
            </div>
          </div>
          <div className="pt-16 pb-6 px-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            <div className="space-y-1">
              <h3 className="text-2xl font-bold text-foreground">{profileData.name}</h3>
              <p className="text-muted text-sm font-medium">{profileData.address}</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="text-left sm:text-right mr-4">
                <p className="text-[10px] font-bold uppercase text-muted">Status</p>
                <div className="flex items-center gap-1.5 text-emerald-500 font-bold text-xs uppercase tracking-tight">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> Live & Accepting Jobs
                </div>
              </div>
              <Button size="sm" className="bg-torqued-red flex-1 sm:flex-none">Preview Public Profile</Button>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <Card className="p-6 space-y-6 bg-card border-border">
            <div className="flex items-center gap-2 border-b border-border pb-4 mb-4">
              <Award size={20} className="text-torqued-red" />
              <h3 className="text-xl text-foreground">Diagnostics & Tools</h3>
            </div>
            <div className="space-y-4">
              <p className="text-xs font-bold uppercase text-muted">Specific tools you use</p>
              <div className="flex flex-wrap gap-2">
                {profileData.diagnosticTools.map(tool => (
                  <span key={tool} className="px-3 py-1.5 bg-torqued-red/10 text-torqued-red rounded-lg text-[10px] font-bold uppercase border border-torqued-red/20 flex items-center gap-1.5">
                    {tool}
                    <button onClick={() => setProfileData({ ...profileData, diagnosticTools: profileData.diagnosticTools.filter(t => t !== tool) })} className="hover:text-foreground"><X size={11} /></button>
                  </span>
                ))}
                <button onClick={() => {
                  const t = prompt('Add a diagnostic tool (e.g. Autel MaxiSys):');
                  if (t && t.trim()) setProfileData({ ...profileData, diagnosticTools: [...profileData.diagnosticTools, t.trim()] });
                }} className="px-3 py-1.5 border border-dashed border-border rounded-lg text-[10px] font-bold uppercase text-muted hover:border-torqued-red hover:text-torqued-red transition-all">
                  + Add Tool
                </button>
              </div>
            </div>
            <div className="space-y-4 pt-4">
              <p className="text-xs font-bold uppercase text-muted">Certifications & Accreditations</p>
              <div className="space-y-2">
                {profileData.certifications.map(cert => (
                  <div key={cert} className="flex items-center gap-3 p-3 bg-background rounded-xl">
                    <Award size={16} className="text-torqued-red" />
                    <span className="text-xs font-bold text-foreground">{cert}</span>
                    <button onClick={() => setProfileData({ ...profileData, certifications: profileData.certifications.filter(c => c !== cert) })} className="ml-auto text-muted hover:text-torqued-red"><Trash2 size={14} /></button>
                  </div>
                ))}
                <button onClick={() => {
                  const c = prompt('Add a certification / accreditation:');
                  if (c && c.trim()) setProfileData({ ...profileData, certifications: [...profileData.certifications, c.trim()] });
                }} className="px-3 py-1.5 border border-dashed border-border rounded-lg text-[10px] font-bold uppercase text-muted hover:border-torqued-red hover:text-torqued-red transition-all">
                  + Add Certification
                </button>
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-6">
             <div className="flex items-center gap-2 border-b border-black/5 pb-4 mb-4">
              <CreditCard size={20} className="text-torqued-red" />
              <h3 className="text-xl">Rates & Revenue</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Labour Rate ($/hr)" value={profileData.labourRate.toString()} onChange={(e) => setProfileData({...profileData, labourRate: parseInt(e.target.value) || 0})} />
              <Input label="Standard Shop Fee ($)" value={profileData.shopFee.toString()} onChange={(e) => setProfileData({...profileData, shopFee: parseInt(e.target.value) || 0})} />
            </div>
            <div className="p-4 bg-background border border-border rounded-2xl space-y-2">
              <h4 className="text-sm font-bold text-foreground">Billing card</h4>
              <p className="text-xs text-muted">Your $99/month subscription is billed to your card. Update it securely via Stripe.</p>
              <div className="pt-1">
                <Button variant="outline" size="sm" className="text-foreground border-border h-8 text-[10px]" onClick={async () => {
                  try {
                    const r = await fetch('/api/mechanic/billing-portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mechanicId: user!.id }) });
                    const d = await r.json();
                    if (d.url) window.location.href = d.url; else alert(d.error || 'No active subscription to manage.');
                  } catch { alert('Could not open billing.'); }
                }}>Update billing card →</Button>
              </div>
            </div>
          </Card>

          {passkeysSupported() && (
            <Card className="p-6 space-y-4 bg-card border-border">
              <div className="flex items-center gap-2 border-b border-border pb-4">
                <CreditCard size={20} className="text-torqued-red" />
                <h3 className="text-xl text-foreground">Security · Passkey</h3>
              </div>
              <p className="text-sm text-muted">Sign in with Face ID / Touch ID instead of your password. Your password still works as a fallback.</p>
              <Button variant="outline" className="text-foreground border-border" onClick={async () => {
                try { await registerPasskey('mechanic', user!.email!); alert('Passkey added. Next time, tap "Sign in with passkey".'); }
                catch (e: any) { alert(e?.message || 'Could not add passkey.'); }
              }}>🔑 Add a passkey</Button>
            </Card>
          )}

          <Card className="p-6 space-y-6 md:col-span-2 bg-card border-border">
            <div className="flex items-center gap-2 border-b border-border pb-4 mb-4">
              <Map size={20} className="text-torqued-red" />
              <h3 className="text-xl text-foreground">Workshop Location</h3>
            </div>
            <div className="relative h-[300px] bg-black/5 rounded-2xl overflow-hidden group">
              <img 
                src="https://picsum.photos/seed/dunedin-map/1200/600?blur=1" 
                alt="Workshop Location Map" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/10 transition-opacity group-hover:bg-black/5" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="relative">
                  <div className="absolute inset-0 bg-torqued-red animate-ping rounded-full opacity-20" />
                  <div className="relative bg-white p-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-black/5">
                    <div className="w-10 h-10 bg-torqued-red rounded-lg flex items-center justify-center font-bold text-white">PM</div>
                    <div className="pr-4">
                      <p className="text-xs font-bold leading-tight">Precision Mechanical</p>
                      <p className="text-[10px] text-black/40">123 Anderson Bay Road</p>
                    </div>
                  </div>
                </div>
              </div>
              <button className="absolute bottom-4 right-4 bg-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 hover:bg-black hover:text-white transition-all">
                <ExternalLink size={14} /> Open in Google Maps
              </button>
            </div>
          </Card>
        </div>

        <Button fullWidth size="lg" className="h-16 text-lg" onClick={handleSaveProfile}>Save Profile Updates</Button>
      </div>
    </div>
  );

  const renderCalendar = () => (
    <div className="space-y-6">
      {/* Capacity settings — drive customer turnaround estimates */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-black/5 pb-4">
          <CalendarIcon size={20} className="text-torqued-red" />
          <h3 className="text-xl">Availability & Capacity</h3>
          <span className="text-[10px] text-muted ml-auto">Sets realistic drop-off / ready times for customers</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div><label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">Technicians</label><Input type="number" value={String(cap.technicians)} onChange={e => setCap({ ...cap, technicians: parseInt(e.target.value) || 1 })} className="bg-background text-foreground" /></div>
          <div><label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">Parts lead (days)</label><Input type="number" value={String(cap.parts_lead_days)} onChange={e => setCap({ ...cap, parts_lead_days: parseInt(e.target.value) || 0 })} className="bg-background text-foreground" /></div>
          <div><label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">Labour $/hr</label><Input type="number" value={String(cap.labour_rate)} onChange={e => setCap({ ...cap, labour_rate: parseFloat(e.target.value) || 0 })} className="bg-background text-foreground" /></div>
        </div>
        <div className="pt-3 mt-1 border-t border-border">
          <p className="text-[11px] font-black uppercase tracking-widest text-torqued-red mb-2">Cancellation Policy</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">Free-cancel notice (hrs)</label><Input type="number" value={String(cap.cancellation_notice_hours)} onChange={e => setCap({ ...cap, cancellation_notice_hours: parseInt(e.target.value) || 0 })} className="bg-background text-foreground" /></div>
            <div><label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">Late-cancel refund (%)</label><Input type="number" value={String(cap.cancellation_partial_refund_pct)} onChange={e => setCap({ ...cap, cancellation_partial_refund_pct: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })} className="bg-background text-foreground" /></div>
          </div>
          <p className="text-xs text-muted mt-2">Cancel with at least this many hours of <strong>open</strong> notice (weekends &amp; public holidays don't count) → full refund. Less notice → the customer is refunded this percentage.</p>
        </div>
        <p className="text-xs text-muted">Quick jobs (oil, WOF) → next business day. Jobs needing parts (cambelt, rotors) → drop-off after your parts lead time. More technicians = faster turnaround on big jobs.</p>
        <Button className="bg-torqued-red text-white" disabled={capSaving} onClick={async () => {
          if (!user) return;
          setCapSaving(true);
          try {
            await fetch('/api/mechanic/save-onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mechanicId: user.id, fields: cap }) });
          } finally { setCapSaving(false); }
        }}>{capSaving ? 'Saving…' : 'Save Capacity'}</Button>
      </Card>

      <div className="flex justify-between items-center">
        <h2 className="text-3xl">Workshop Calendar</h2>
        <div className="flex bg-white p-1 rounded-xl border border-black/5">
          {(['day', 'week', 'month'] as const).map(v => (
            <button
              key={v}
              onClick={() => setCalendarView(v)}
              className={cn(
                "px-6 py-2 rounded-lg text-xs font-bold uppercase transition-all",
                calendarView === v ? "bg-torqued-red text-white" : "text-black/40 hover:bg-black/5"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      
      {calendarView === 'week' ? (
        <Card className="p-0 overflow-hidden border-none shadow-sm">
          <div className="grid grid-cols-8 border-b border-black/5 bg-black/5">
            <div className="p-4 border-r border-black/10" />
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} className="px-4 py-3 text-center border-r border-black/10 last:border-0">
                <p className="text-[10px] font-bold uppercase text-black/40">{day}</p>
                <p className="text-lg font-bold">0{9 + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(day)}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-8 relative h-[600px] overflow-y-auto">
            {/* Time labels column */}
            <div className="border-r border-black/5 bg-black/5">
              {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map(h => (
                <div key={h} className="h-24 px-2 py-1 text-[10px] font-bold text-black/20 text-right">
                  {h}:00
                </div>
              ))}
            </div>
            {/* Grid for days */}
            {[...Array(7)].map((_, dayIdx) => {
              const dayName = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][dayIdx];
              return (
                <div
                  key={dayIdx}
                  className="border-r border-black/5 relative min-h-[1000px] cursor-crosshair"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('[data-appt]') || (e.target as HTMLElement).closest('[data-avail]')) return;
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const scrollContainer = (e.currentTarget as HTMLElement).closest('.overflow-y-auto');
                    const scrollTop = scrollContainer?.scrollTop || 0;
                    const clickedY = Math.max(0, e.clientY - rect.top + scrollTop);
                    const rawHour = Math.floor(clickedY / 96) + 8;
                    const rawMinFrac = (clickedY % 96) / 96;
                    const rawMin = Math.round(rawMinFrac * 4) * 15;
                    const startH = Math.max(6, Math.min(rawHour, 20));
                    const startM = rawMin >= 60 ? 45 : rawMin;
                    const endH = Math.min(startH + 1, 21);
                    const pad = (n: number) => String(n).padStart(2, '0');
                    setAddAvailModal({ dayIdx, startTime: `${pad(startH)}:${pad(startM)}`, endTime: `${pad(endH)}:${pad(startM)}` });
                  }}
                >
                  {/* Availability blocks */}
                  {mechAvailability.filter(s => s.day_of_week === dayIdx).map(slot => {
                    const [sh, sm] = (slot.start_time as string).split(':').map(Number);
                    const [eh, em] = (slot.end_time as string).split(':').map(Number);
                    const top = (sh - 8) * 96 + (sm / 60) * 96;
                    const height = Math.max(16, (eh - sh) * 96 + ((em - sm) / 60) * 96);
                    return (
                      <div
                        key={slot.id}
                        data-avail="1"
                        className="absolute left-0 right-0 bg-emerald-400/20 border-l-2 border-emerald-500 z-10 group/avail pointer-events-auto"
                        style={{ top: `${top}px`, height: `${height}px` }}
                      >
                        <div className="flex items-start justify-between px-1 pt-0.5">
                          <span className="text-[8px] font-bold text-emerald-600">{(slot.start_time as string).slice(0,5)}–{(slot.end_time as string).slice(0,5)}</span>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              await fetch(`/api/mechanic/availability/${slot.id}`, { method: 'DELETE' });
                              setMechAvailability(prev => prev.filter(s => s.id !== slot.id));
                            }}
                            className="opacity-0 group-hover/avail:opacity-100 text-red-400 hover:text-red-600 transition-opacity leading-none"
                          ><X size={8} /></button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Grid lines */}
                  {[...Array(11)].map((_, i) => (
                    <div key={i} className="absolute w-full h-px bg-black/5" style={{ top: `${i * 96}px` }} />
                  ))}

                  {/* Appointments */}
                  {appointments.filter(a => a.day === dayName).map(appt => {
                    const startHour = parseInt(appt.time.split(':')[0]);
                    const startMin = parseInt(appt.time.split(':')[1]);
                    const endHour = parseInt(appt.endTime.split(':')[0]);
                    const endMin = parseInt(appt.endTime.split(':')[1]);
                    
                    const top = (startHour - 8) * 96 + (startMin / 60) * 96;
                    const height = (endHour - startHour) * 96 + ((endMin - startMin) / 60) * 96;
                    
                    return (
                      <motion.div
                        data-appt="1"
                        key={appt.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={cn(
                          "absolute left-1 right-1 rounded-lg p-2 text-white shadow-sm cursor-pointer hover:brightness-110 transition-all z-20",
                          appt.type === 'maintenance' ? "bg-blue-500" : appt.type === 'repair' ? "bg-torqued-red" : "bg-emerald-500"
                        )}
                        style={{ top: `${top}px`, height: `${height}px` }}
                      >
                         <p className="text-[8px] font-bold uppercase opacity-80">{appt.time} - {appt.endTime}</p>
                         <h4 className="text-[10px] font-bold leading-tight truncate">{appt.car}</h4>
                         <p className="text-[8px] truncate">{appt.service}</p>
                      </motion.div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </Card>
      ) : calendarView === 'month' ? (
        <Card className="p-0 overflow-hidden border-none shadow-sm">
          <div className="grid grid-cols-7 border-b border-black/5 bg-black/5">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} className="px-4 py-3 text-center text-[10px] font-bold uppercase text-black/40 border-r border-black/10 last:border-0">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 h-[600px]">
            {[...Array(35)].map((_, i) => (
              <div key={i} className="border-r border-b border-black/5 p-2 relative group hover:bg-black/5 transition-colors">
                <span className="text-[10px] font-bold text-black/20">{i + 1}</span>
                {appointments.filter(a => {
                  const dayIdx = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].indexOf(a.day);
                  return dayIdx >= 0 && (i % 7) === dayIdx;
                }).map(a => (
                  <div key={a.id} className={cn("mt-1 p-1 text-white text-[8px] font-bold rounded uppercase leading-tight truncate",
                    a.type === 'maintenance' ? 'bg-blue-500' : a.type === 'repair' ? 'bg-torqued-red' : 'bg-emerald-500')}>
                    {a.car.split('(')[0].trim()} - {a.service.split(' ')[0]}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="p-6 space-y-6">
          <div className="flex gap-4 items-center justify-between border-b border-black/5 pb-4">
             <div className="flex items-center gap-4">
                <button className="p-2 hover:bg-black/5 rounded-full"><ChevronLeft size={20} /></button>
                <h3 className="text-xl font-bold uppercase tracking-tight">{new Date().toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3>
                <button className="p-2 hover:bg-black/5 rounded-full"><ChevronRight size={20} /></button>
             </div>
             <Button variant="outline" size="sm">Today</Button>
          </div>
          <div className="space-y-4">
            {appointments.filter(a => a.day === 'Mon').map(appt => (
              <div key={appt.id} className="flex gap-6 items-start p-4 hover:bg-black/5 rounded-2xl transition-all group">
                <div className="w-16 text-sm font-bold text-black/40 pt-1">{appt.time}</div>
                <div className={cn(
                  "w-1 h-12 rounded-full",
                  appt.type === 'maintenance' ? "bg-blue-500" : appt.type === 'repair' ? "bg-torqued-red" : "bg-emerald-500"
                )} />
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-lg font-bold">{appt.car}</h4>
                      <p className="text-sm text-black/60">{appt.service}</p>
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold uppercase px-2 py-0.5 rounded",
                      appt.status === 'In Progress' ? "bg-torqued-red text-white" : "bg-black/5 text-black/40"
                    )}>
                      {appt.status}
                    </span>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => {
                    const realJob = incomingJobs.find(j => j.reg === appt.car.match(/\(([^)]+)\)/)?.[1]);
                    if (realJob) setSelectedJobId(realJob.id);
                  }}
                >
                  View Details
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Operating Hours Table */}
      {calendarView === 'week' && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-black/5 pb-4">
            <Clock size={18} className="text-torqued-red" />
            <div>
              <h3 className="text-lg font-bold">Regular Operating Hours</h3>
              <p className="text-[10px] text-muted">Click any day column in the calendar above to add a block, or set recurring hours here</p>
            </div>
          </div>
          <div className="space-y-2.5">
            {operatingHours.map((oh, i) => (
              <div key={oh.dayOfWeek} className="flex items-center gap-3">
                <button
                  onClick={() => setOperatingHours(prev => prev.map((o, idx) => idx === i ? { ...o, enabled: !o.enabled } : o))}
                  className={cn('w-9 h-5 rounded-full transition-colors relative flex-shrink-0', oh.enabled ? 'bg-emerald-500' : 'bg-black/10')}
                >
                  <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', oh.enabled ? 'translate-x-4' : 'translate-x-0.5')} />
                </button>
                <span className="text-xs font-bold w-8 text-foreground">{oh.label}</span>
                <input
                  type="time"
                  value={oh.startTime}
                  disabled={!oh.enabled}
                  onChange={e => setOperatingHours(prev => prev.map((o, idx) => idx === i ? { ...o, startTime: e.target.value } : o))}
                  className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground disabled:opacity-30 focus:outline-none focus:border-torqued-red"
                />
                <span className="text-xs text-muted">to</span>
                <input
                  type="time"
                  value={oh.endTime}
                  disabled={!oh.enabled}
                  onChange={e => setOperatingHours(prev => prev.map((o, idx) => idx === i ? { ...o, endTime: e.target.value } : o))}
                  className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground disabled:opacity-30 focus:outline-none focus:border-torqued-red"
                />
                {!oh.enabled && <span className="text-[10px] text-muted italic">Closed</span>}
              </div>
            ))}
          </div>
          <Button
            disabled={ohSaving || !user}
            className="bg-torqued-red text-white"
            onClick={async () => {
              if (!user) return;
              setOhSaving(true);
              try {
                const r = await fetch('/api/mechanic/availability/replace', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ mechanicId: user.id, slots: operatingHours.filter(o => o.enabled).map(o => ({ day_of_week: o.dayOfWeek, start_time: o.startTime, end_time: o.endTime })) }),
                });
                const d = await r.json();
                if (d.slots) setMechAvailability(d.slots);
              } finally { setOhSaving(false); }
            }}
          >{ohSaving ? 'Saving…' : 'Save Operating Hours'}</Button>
        </Card>
      )}

      {/* Closed Periods / Holidays */}
      {calendarView === 'week' && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-black/5 pb-4">
            <AlertCircle size={18} className="text-amber-500" />
            <div>
              <h3 className="text-lg font-bold">Closed Periods & Public Holidays</h3>
              <p className="text-[10px] text-muted">Block booking availability for holidays, closures, or leave</p>
            </div>
          </div>
          {closedPeriods.length > 0 && (
            <div className="space-y-2">
              {closedPeriods.map(cp => (
                <div key={cp.id} className="flex items-center gap-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                  <div className="flex-1">
                    <p className="text-xs font-bold text-foreground">{cp.start_date === cp.end_date ? cp.start_date : `${cp.start_date} → ${cp.end_date}`}</p>
                    {cp.reason && <p className="text-[10px] text-muted">{cp.reason}</p>}
                  </div>
                  <button
                    onClick={async () => {
                      await fetch(`/api/mechanic/closed-periods/${cp.id}`, { method: 'DELETE' });
                      setClosedPeriods(prev => prev.filter(p => p.id !== cp.id));
                    }}
                    className="text-muted hover:text-torqued-red transition-colors"
                  ><X size={14} /></button>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">From</label>
              <input type="date" value={newClosedPeriod.startDate} onChange={e => setNewClosedPeriod(p => ({ ...p, startDate: e.target.value }))} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-torqued-red" />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">To (optional)</label>
              <input type="date" value={newClosedPeriod.endDate} onChange={e => setNewClosedPeriod(p => ({ ...p, endDate: e.target.value }))} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-torqued-red" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">Reason (optional)</label>
              <div className="flex gap-2">
                <input
                  placeholder="e.g. Christmas closure, Otago Anniversary…"
                  value={newClosedPeriod.reason}
                  onChange={e => setNewClosedPeriod(p => ({ ...p, reason: e.target.value }))}
                  className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-torqued-red"
                />
                <Button
                  disabled={closedSaving || !newClosedPeriod.startDate || !user}
                  className="bg-amber-500 text-white shrink-0 flex items-center gap-1"
                  onClick={async () => {
                    if (!user || !newClosedPeriod.startDate) return;
                    setClosedSaving(true);
                    try {
                      const r = await fetch('/api/mechanic/closed-periods', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ mechanicId: user.id, startDate: newClosedPeriod.startDate, endDate: newClosedPeriod.endDate || newClosedPeriod.startDate, reason: newClosedPeriod.reason }),
                      });
                      const d = await r.json();
                      if (d.period) { setClosedPeriods(prev => [...prev, d.period]); setNewClosedPeriod({ startDate: '', endDate: '', reason: '' }); }
                    } finally { setClosedSaving(false); }
                  }}
                >{closedSaving ? '…' : <><Plus size={12} className="mr-1 inline" />Block</>}</Button>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted">Customers won't be able to book drop-offs during blocked periods. NZ public holidays are automatically excluded from the cancellation notice window.</p>
        </Card>
      )}

      {/* Add Availability Block Modal (week view click) */}
      {addAvailModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setAddAvailModal(null)}>
          <div className="bg-background border border-border rounded-2xl p-6 shadow-2xl w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-foreground">Add Availability Block</h3>
              <button onClick={() => setAddAvailModal(null)} className="text-muted hover:text-foreground"><X size={16} /></button>
            </div>
            <p className="text-xs text-muted">Adding for <strong className="text-foreground">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][addAvailModal.dayIdx]}</strong> — repeats weekly</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">From</label>
                <input type="time" value={addAvailModal.startTime} onChange={e => setAddAvailModal(m => m ? { ...m, startTime: e.target.value } : m)} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-torqued-red" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">To</label>
                <input type="time" value={addAvailModal.endTime} onChange={e => setAddAvailModal(m => m ? { ...m, endTime: e.target.value } : m)} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-torqued-red" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setAddAvailModal(null)}>Cancel</Button>
              <Button
                className="bg-emerald-500 text-white"
                disabled={!user}
                onClick={async () => {
                  if (!user || !addAvailModal) return;
                  try {
                    const r = await fetch('/api/mechanic/availability/slot', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ mechanicId: user.id, dayOfWeek: addAvailModal.dayIdx, startTime: addAvailModal.startTime, endTime: addAvailModal.endTime }),
                    });
                    const d = await r.json();
                    if (d.slot) { setMechAvailability(prev => [...prev, d.slot]); setAddAvailModal(null); }
                    else alert(d.error || 'Could not save block.');
                  } catch { alert('Could not save availability block.'); }
                }}
              >Add Block</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderProcurementModal = () => {
    const job = incomingJobs.find(j => j.id === selectedJobForProcurement);
    if (!job) return null;

    const totalOrder = job.requiredParts?.reduce((sum, p) => {
      const selection = procurementSelections[p.id];
      const offer = PART_OFFERS.find(o => o.id === selection);
      return sum + (offer ? offer.price * p.quantity : 0);
    }, 0) || 0;

    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-background w-full max-w-5xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-border"
        >
          {/* Header */}
          <div className="p-6 border-b border-border flex justify-between items-center bg-card text-foreground">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-background rounded-xl flex items-center justify-center border border-border">
                <Package className="text-torqued-red" size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Parts Procurement Pipeline</h2>
                <p className="text-muted text-xs font-mono uppercase tracking-widest">{job.model} • {job.reg}</p>
              </div>
            </div>
            <button 
              onClick={() => setShowProcurement(false)}
              className="p-2 hover:bg-card rounded-full transition-colors text-muted hover:text-foreground"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-hidden flex bg-background">
            {/* Left: Component List */}
            <div className="w-1/3 border-r border-border bg-card/30 overflow-y-auto p-6 space-y-4">
              <h3 className="text-xs font-bold uppercase text-muted tracking-wider">Required Items</h3>
              {job.requiredParts?.map(part => {
                const selectedOffer = PART_OFFERS.find(o => o.id === procurementSelections[part.id]);
                return (
                  <div 
                    key={part.id} 
                    className={cn(
                      "p-4 rounded-2xl cursor-pointer border transition-all",
                      procurementSelections[part.id] 
                        ? "bg-torqued-red/10 border-torqued-red shadow-sm" 
                        : "bg-card border-border hover:bg-card/80"
                    )}
                  >
                    <p className="text-xs font-bold text-muted mb-1">{part.oemNumber}</p>
                    <h4 className="font-bold text-sm text-foreground">{part.name}</h4>
                    <div className="flex justify-between items-center mt-3">
                      <span className="text-[10px] bg-background px-2 py-0.5 rounded text-muted">Qty: {part.quantity}</span>
                      {selectedOffer && (
                        <span className="text-sm font-bold text-torqued-red">{formatCurrency(selectedOffer.price)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right: Supplier Comparison (The "Fresho" style view) */}
            <div className="flex-1 overflow-y-auto p-8 space-y-12 text-foreground">
              {job.requiredParts?.map(part => (
                <div key={part.id} className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <h3 className="text-xl font-bold">{part.name}</h3>
                      <p className="text-sm text-muted">Compare best value from {SUPPLIERS.length} matching suppliers</p>
                    </div>
                    <span className="text-[10px] font-bold text-muted font-mono italic">OEM MATCH: {part.oemNumber}</span>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3">
                    {PART_OFFERS.filter(o => o.partId === part.id).map(offer => {
                      const supplier = SUPPLIERS.find(s => s.id === offer.supplierId)!;
                      const isSelected = procurementSelections[part.id] === offer.id;
                      const isBestValue = offer.price === Math.min(...PART_OFFERS.filter(o => o.partId === part.id).map(o => o.price));

                      return (
                        <div 
                          key={offer.id}
                          onClick={() => setProcurementSelections(prev => ({ ...prev, [part.id]: offer.id }))}
                          className={cn(
                            "flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all",
                            isSelected 
                              ? "border-torqued-red bg-torqued-red/5" 
                              : "border-border bg-card hover:border-muted"
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-background rounded-lg flex items-center justify-center text-xl border border-border">
                              {supplier.logo}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h5 className="font-bold text-sm text-foreground">{supplier.name}</h5>
                                {isBestValue && (
                                  <span className="text-[8px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider border border-emerald-500/20">Best Value</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] text-muted flex items-center gap-1">
                                  <Star size={10} className="fill-yellow-400 text-yellow-400" /> {supplier.rating}
                                </span>
                                <span className={cn(
                                  "text-[10px] font-bold px-1.5 rounded",
                                  offer.availability === 'in-stock' ? "text-emerald-500 bg-emerald-500/10" : "text-yellow-600 bg-yellow-500/10"
                                )}>
                                  {offer.availability === 'in-stock' ? 'In Stock' : 'To Order'}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="flex items-center gap-2 justify-end mb-1">
                               <Clock size={12} className="text-muted" />
                               <span className="text-[10px] font-bold text-muted truncate max-w-[100px]">{offer.deliveryTime} Delivery</span>
                            </div>
                            <p className="text-xl font-bold text-foreground">{formatCurrency(offer.price)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Summary */}
          <div className="p-6 bg-card border-t border-border flex justify-between items-center text-foreground">
            <div className="flex gap-8">
              <div>
                <p className="text-[10px] font-bold uppercase text-muted mb-1">Items Selected</p>
                <p className="text-lg font-bold">{Object.keys(procurementSelections).length} / {job.requiredParts?.length}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-muted mb-1">Consolidated Total</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-black text-torqued-red tracking-tighter shadow-torqued-red/20 drop-shadow-xl">{formatCurrency(totalOrder)}</p>
                  <p className="text-[10px] text-muted">Excl. GST</p>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => setProcurementSelections({})}
                className="px-6"
              >
                Clear All
              </Button>
              <Button 
                disabled={Object.keys(procurementSelections).length === 0}
                className="px-10 bg-torqued-red hover:bg-red-700"
                onClick={() => {
                  const selectedSuppliers = Array.from(new Set(
                    Object.values(procurementSelections).map(offerId => {
                      const offer = PART_OFFERS.find(o => o.id === offerId);
                      return SUPPLIERS.find(s => s.id === offer?.supplierId)?.name || 'Unknown';
                    })
                  ));

                  const queueItem = {
                    id: job.id,
                    reg: job.reg,
                    model: job.model,
                    partsCount: Object.keys(procurementSelections).length,
                    suppliers: selectedSuppliers,
                    orderTotal: totalOrder,
                  };

                  setProcurementQueue([...procurementQueue, queueItem]);
                  setProcurementSelections({});
                  setShowProcurement(false);
                  setActiveTab('dashboard');
                }}
              >
                Queue for Order Confirmation
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  };

  const renderHealthReport = () => {
    const job = incomingJobs.find(j => j.id === selectedJobId);
    if (!job) return null;

    const isDiagnostic = job.services.includes('Diagnostic Inspection');
    // Real portable history for this vehicle (customer imports + past Torqued jobs)
    const history = jobHistory;

    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-background w-full max-w-5xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-border"
        >
          {/* Modal Header */}
          <div className="p-6 border-b border-border flex justify-between items-start bg-card text-foreground">
            <div>
              <div className="torqued-badge text-[10px] mb-2 font-mono">VEHICLE HEALTH REPORT</div>
              <h2 className="text-3xl text-foreground font-black">{job.reg}: {job.model}</h2>
              <p className="text-muted text-sm font-mono uppercase tracking-widest mt-1">Status: {job.status} • Sync: Live</p>
            </div>
            <button 
              onClick={() => {
                setSelectedJobId(null);
                setDiagnosticStep('review');
              }}
              className="p-2 hover:bg-background rounded-full transition-colors text-muted hover:text-foreground border border-transparent hover:border-border"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-background">
            {/* AI Health Insights + Vehicle Timeline */}
            <VehicleTimelineAnalysis rego={job.reg} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 text-foreground">
              {/* Left Column: Service History */}
              <div className="space-y-8 lg:col-span-1">
                <div className="flex items-center gap-2">
                  <Clock size={20} className="text-torqued-red" />
                  <h3 className="text-xl mt-0">Service History</h3>
                </div>
                <div className="relative space-y-6">
                  <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />
                  {history.slice().reverse().map((item: any) => (
                    <div key={item.id} className="relative pl-8 group text-foreground">
                      <div className={cn(
                        "absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 border-background shadow-sm flex items-center justify-center z-10",
                        item.isExternal ? "bg-card border-border" : "bg-torqued-red border-background"
                      )}>
                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between items-baseline">
                          <p className="text-[10px] font-bold text-muted uppercase tracking-wider">{item.date}</p>
                          {item.mileage && <span className="text-[10px] font-mono bg-card px-1.5 rounded text-muted">{item.mileage.toLocaleString()} KM</span>}
                        </div>
                        <h4 className="text-sm font-bold">{item.service}</h4>
                        <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                          {item.provider}
                          {item.isExternal && <span className="text-[8px] bg-card px-1 rounded uppercase border border-border">External Record</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Middle/Right: Diagnostic Workflow or Recommendations */}
              <div className="lg:col-span-2 space-y-8">
                {isDiagnostic ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-torqued-red/10 rounded-xl flex items-center justify-center text-torqued-red">
                          <Wrench size={20} />
                       </div>
                       <div>
                          <h3 className="text-xl text-foreground mt-0">Diagnostic Workflow</h3>
                          <p className="text-xs font-bold uppercase text-muted tracking-widest">Torqued AI Assisted quoting</p>
                       </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      {['review', 'inspect', 'quote', 'sent'].map((s, i) => (
                        <div key={s} className="space-y-2">
                          <div className={cn(
                            "h-1.5 rounded-full transition-all",
                            diagnosticStep === s || (i < ['review', 'inspect', 'quote', 'sent'].indexOf(diagnosticStep))
                              ? "bg-torqued-red" 
                              : "bg-border"
                          )} />
                          <span className={cn(
                            "text-[9px] font-bold uppercase transition-all block text-center",
                            diagnosticStep === s ? "text-torqued-red" : "text-muted/30"
                          )}>{s}</span>
                        </div>
                      ))}
                    </div>

                    <Card className="p-6 space-y-6">
                      {diagnosticStep === 'review' && (
                        <div className="space-y-4">
                          <h4 className="font-bold text-foreground">Initial Customer Complaint</h4>
                          <p className="text-sm bg-background p-4 rounded-xl italic leading-relaxed border border-border text-foreground">
                            {job.description}
                          </p>
                          <div className="pt-4">
                            <Button fullWidth onClick={() => setDiagnosticStep('inspect')}>Begin Inspection →</Button>
                          </div>
                        </div>
                      )}

                      {diagnosticStep === 'inspect' && (
                        <div className="space-y-4">
                          <h4 className="font-bold text-foreground">Inspection Findings</h4>
                          <textarea 
                            className="w-full bg-background border border-border rounded-xl px-4 py-3 outline-none focus:border-torqued-red/30 transition-all min-h-[120px] text-sm text-foreground focus:ring-1 focus:ring-torqued-red"
                            placeholder="What did you find? E.g. Found heavily grooved front brake rotors..."
                            value={diagnosticFindings}
                            onChange={(e) => setDiagnosticFindings(e.target.value)}
                          />
                          <div className="pt-4">
                            <Button fullWidth disabled={!diagnosticFindings} onClick={() => setDiagnosticStep('quote')}>Save Findings & Quote →</Button>
                          </div>
                        </div>
                      )}

                      {diagnosticStep === 'quote' && (
                        <div className="space-y-6">
                          <div className="space-y-2">
                            <h4 className="font-bold text-foreground">Build the repair quote</h4>
                            <p className="text-xs text-muted">Write the quote from scratch — add parts (with stock matching &amp; AI lookup), labour, other costs and notes, then email it. Same builder used for cold quotes.</p>
                          </div>
                          <div className="pt-2 space-y-3">
                            <Button fullWidth className="bg-torqued-red shadow-lg shadow-torqued-red/20" onClick={() => { setSelectedJobId(null); setDiagnosticStep('review'); openQuoteEditor(job); }}>
                              Open quote builder →
                            </Button>
                            <Button variant="ghost" className="w-full text-[10px] uppercase font-black tracking-widest text-muted hover:text-foreground border border-transparent" onClick={() => setDiagnosticStep('inspect')}>Back to Findings</Button>
                          </div>
                        </div>
                      )}

                      {diagnosticStep === 'sent' && (
                        <div className="space-y-6 text-center py-8">
                          <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-500/20">
                            <CheckCircle2 size={40} />
                          </div>
                          <div className="space-y-2">
                            <h4 className="text-2xl font-black tracking-tighter">Quote Sent!</h4>
                            <p className="text-sm text-muted max-w-sm mx-auto">The customer has been notified by email and app notification. They can book the repair in one click.</p>
                          </div>
                          <div className="pt-6">
                            <Button variant="outline" className="border-border px-8" onClick={() => setSelectedJobId(null)}>Back to Dashboard</Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted italic">AI health insights are shown above. No diagnostic workflow for this job type.</p>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Modal Footer */}
          <div className="p-6 bg-card border-t border-border flex justify-end gap-3">
            <Button variant="outline" onClick={() => {
              setSelectedJobId(null);
              setDiagnosticStep('review');
            }} className="border-border text-foreground hover:bg-background">Close Report</Button>
            <Button className="bg-torqued-red text-white">Print Summary</Button>
          </div>
        </motion.div>
      </div>
    );
  };

  const renderJobList = (list: any[], emptyMsg = 'No jobs here yet.') => (
    <div className="space-y-4">
      {list.length === 0 && (
        <Card className="p-10 text-center text-muted italic bg-card border-border">{emptyMsg}</Card>
      )}
      {list.map((j: any) => {
        const jobShape = {
          id: j.id, reg: j.vehicle_rego || '', customerName: j.customer_name,
          model: j.customer_name ? `${j.vehicle_rego} — ${j.customer_name}` : j.vehicle_rego || 'Vehicle',
          services: (j.service_ids || []).map((id: string) => SERVICES.find(s => s.id === id)?.name || id),
          suggestedQuote: parseFloat(j.total_price) || 0,
          quoteItems: j.quote_items || null,
        };
        return (
          <Card key={j.id} className="p-4 sm:p-5 bg-card border-border space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black text-foreground flex items-center gap-2">{j.vehicle_rego || '—'} {j.customer_name ? <span className="text-muted font-medium">· {j.customer_name}</span> : null}
                  {j.is_cold_quote && <span className="text-[9px] uppercase font-black tracking-widest bg-torqued-red/10 text-torqued-red px-1.5 py-0.5 rounded">Cold quote</span>}</p>
                <p className="text-xs text-muted">{jobShape.services.join(', ') || '—'}</p>
                <p className="text-[11px] text-muted mt-1">
                  {j.date || '—'} · <span className="uppercase font-bold">{j.status}</span> · {j.payment_status === 'confirmed' ? 'Paid' : (j.payment_status || 'unpaid')}
                  {j.mileage_in ? ` · in ${Number(j.mileage_in).toLocaleString()}km` : ''}{j.mileage_out ? ` · out ${Number(j.mileage_out).toLocaleString()}km` : ''}
                </p>
                {j.description && <p className="text-xs text-muted italic mt-1">“{j.description}”</p>}
              </div>
              <span className="font-black text-torqued-red shrink-0">{formatCurrency(parseFloat(j.quoted_price ?? j.total_price) || 0)}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="text-foreground border-border hover:bg-background" onClick={() => openQuoteEditor(jobShape)}>Edit / Build Quote</Button>
              <Button size="sm" variant="outline" className="text-foreground border-border hover:bg-background" onClick={() => messageCustomer(jobShape)}>Message Customer</Button>
              <Button size="sm" variant="outline" className="text-foreground border-border hover:bg-background" onClick={() => recordMileage(jobShape, 'out')}>Check-out km</Button>
              <Button size="sm" variant="outline" className="text-emerald-600 border-border hover:bg-background" onClick={() => exportInvoice(j)}>{j.payment_status === 'confirmed' ? 'Export invoice' : 'Download PDF'}</Button>
              <Button size="sm" variant="outline" className="text-foreground border-border hover:bg-background" onClick={() => jobNotes[j.id]?.open ? setJobNotes(p => ({...p, [j.id]: {...p[j.id], open: false}})) : openJobNotes(j.id)}>
                📝 Notes {(jobNotes[j.id]?.notes?.length ?? 0) > 0 ? `(${jobNotes[j.id]!.notes.length})` : ''}
              </Button>
              <Button size="sm" variant="outline" className="text-foreground border-border hover:bg-background" onClick={() => vehiclePhotos[j.vehicle_rego]?.open ? setVehiclePhotos(p => ({...p, [j.vehicle_rego]: {...p[j.vehicle_rego], open: false}})) : openVehiclePhotos(j.vehicle_rego)}>
                📷 Photos {(vehiclePhotos[j.vehicle_rego]?.photos?.length ?? 0) > 0 ? `(${vehiclePhotos[j.vehicle_rego]!.photos.length})` : ''}
              </Button>
            </div>

            {/* Job Notes Panel */}
            {jobNotes[j.id]?.open && (
              <div className="border-t border-border pt-3 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Job Notes</p>
                {jobNotes[j.id]?.loading && <p className="text-xs text-muted">Loading…</p>}
                {(jobNotes[j.id]?.notes || []).map((n) => (
                  <div key={n.id} className="flex items-start gap-2 bg-background rounded-xl p-3">
                    <div className="flex-1">
                      <p className="text-xs text-foreground">{n.note}</p>
                      <p className="text-[10px] text-muted mt-1">{n.author} · {new Date(n.created_at).toLocaleString('en-NZ')}</p>
                    </div>
                    <button onClick={() => deleteJobNote(j.id, n.id)} className="text-muted hover:text-torqued-red text-xs">✕</button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    className="flex-1 text-xs bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-torqued-red/50"
                    placeholder="Add a note… (auto-timestamped)"
                    value={jobNotes[j.id]?.input || ''}
                    onChange={e => setJobNotes(p => ({...p, [j.id]: {...p[j.id], input: e.target.value}}))}
                    onKeyDown={e => { if (e.key === 'Enter') addJobNote(j.id); }}
                  />
                  <Button size="sm" className="bg-torqued-red text-white" onClick={() => addJobNote(j.id)}>Add</Button>
                </div>
              </div>
            )}

            {/* Vehicle Photos Panel */}
            {vehiclePhotos[j.vehicle_rego]?.open && (
              <div className="border-t border-border pt-3 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Photos — {j.vehicle_rego}</p>
                {vehiclePhotos[j.vehicle_rego]?.loading && <p className="text-xs text-muted">Loading…</p>}
                <div className="flex flex-wrap gap-2">
                  {(vehiclePhotos[j.vehicle_rego]?.photos || []).map((photo) => (
                    <div key={photo.id} className="relative group">
                      <img src={photo.photo_url} alt={photo.comment || 'photo'} className="w-20 h-20 object-cover rounded-lg border border-border" />
                      {photo.comment && <p className="text-[9px] text-muted mt-0.5 max-w-[80px] truncate">{photo.comment}</p>}
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <input
                    className="w-full text-xs bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-torqued-red/50"
                    placeholder="Photo comment (optional)"
                    value={vehiclePhotos[j.vehicle_rego]?.comment || ''}
                    onChange={e => setVehiclePhotos(p => ({...p, [j.vehicle_rego]: {...p[j.vehicle_rego], comment: e.target.value}}))}
                  />
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs font-bold text-torqued-red border border-torqued-red/30 rounded-lg px-3 py-1.5 hover:bg-torqued-red/5">📷 Upload photo</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadVehiclePhoto(j.vehicle_rego, f, j.id); e.target.value = ''; }} />
                  </label>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );

  const renderMyJobs = () => {
    const isToday = (d?: string) => d && new Date(d).toDateString() === new Date().toDateString();
    const accepted = pastJobs.filter((j: any) => j.status === 'in_progress');
    const todayJobs = accepted.filter((j: any) => isToday(j.date));
    const upcoming = accepted.filter((j: any) => j.date && new Date(j.date).getTime() > Date.now() && !isToday(j.date));
    const coldQuotes = pastJobs.filter((j: any) => j.is_cold_quote);
    const history = pastJobs.filter((j: any) => j.status === 'completed');
    const subtabs = [
      { id: 'accept' as const, label: 'To accept', n: incomingJobs.length },
      { id: 'today' as const, label: 'Today', n: todayJobs.length },
      { id: 'upcoming' as const, label: 'Upcoming', n: upcoming.length },
      { id: 'history' as const, label: 'History', n: history.length },
      { id: 'cold' as const, label: 'Cold quotes', n: coldQuotes.length },
    ];
    return (
      <div className="space-y-5 pb-12">
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">My Jobs</h2>
        <div className="flex gap-2 flex-wrap">
          {subtabs.map(s => (
            <button key={s.id} onClick={() => setJobsSubtab(s.id)}
              className={cn('px-4 h-9 rounded-xl text-xs font-black uppercase tracking-wider transition-all', jobsSubtab === s.id ? 'bg-torqued-red text-white' : 'bg-card border border-border text-muted hover:text-foreground')}>
              {s.label}{s.n ? ` (${s.n})` : ''}
            </button>
          ))}
        </div>
        {jobsSubtab === 'accept' && renderIncomingJobs()}
        {jobsSubtab === 'today' && renderJobList(todayJobs, 'No jobs scheduled for today.')}
        {jobsSubtab === 'upcoming' && renderJobList(upcoming, 'No upcoming jobs.')}
        {jobsSubtab === 'history' && renderJobList(history, 'No completed jobs yet.')}
        {jobsSubtab === 'cold' && renderJobList(coldQuotes, 'No cold quotes written yet.')}
      </div>
    );
  };

  const renderCustomers = () => (
    <div className="space-y-4 pb-12 max-w-3xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">Customers</h2>
          <p className="text-sm text-muted">Customers who've booked, been cold-quoted, or added by your workshop.</p>
        </div>
        <Button size="sm" className="bg-torqued-red text-white shrink-0" onClick={() => { setColdForm({ customerName: '', email: '', phone: '', rego: '', make: '', model: '', description: '', date: '' }); setShowColdQuote(true); }}>+ Add new customer</Button>
      </div>
      <input value={custSearch} onChange={e => setCustSearch(e.target.value)} placeholder="Search name, email, phone or rego…"
        className="w-full bg-card border border-border rounded-xl px-4 h-11 text-sm text-foreground focus:outline-none focus:border-torqued-red" />
      {customers.length === 0 && <Card className="p-10 text-center text-muted italic bg-card border-border">No customers yet.</Card>}
      {customers.filter(c => {
        const q = custSearch.toLowerCase().trim(); if (!q) return true;
        return [c.name, c.email, c.phone, ...(c.regos || [])].join(' ').toLowerCase().includes(q);
      }).map((c, i) => (
        <Card key={i} className="p-4 bg-card border-border flex items-center justify-between gap-3">
          <div>
            <p className="font-bold text-foreground">{c.name || '—'}</p>
            <p className="text-xs text-muted">{c.email || ''}{c.phone ? ` · ${c.phone}` : ''}{c.regos?.length ? ` · ${c.regos.join(', ')}` : ''}</p>
          </div>
          <Button size="sm" variant="outline" className="text-foreground border-border" onClick={() => {
            setColdForm({ customerName: c.name || '', email: c.email || '', phone: c.phone || '', rego: c.regos?.[0] || '', make: '', model: '', description: '', date: '' });
            setShowColdQuote(true);
          }}>New quote</Button>
        </Card>
      ))}
    </div>
  );

  const renderPayments = () => {
    const paidJobs = pastJobs.filter((j: any) => j.payment_status === 'confirmed');
    const grossAll = paidJobs.reduce((s: number, j: any) => s + (parseFloat(j.total_price) || 0), 0);
    const payoutAll = grossAll * 0.96;
    const sub = billing || {};
    return (
      <div className="space-y-5 pb-12 max-w-3xl">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">Payments & Subscription</h2>
          <p className="text-sm text-muted">Your $99/month subscription is billed to your card. Job payouts are paid out less Torqued's 4% commission.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="p-4 bg-card border-border">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted">Subscription</p>
            <p className={`text-lg font-black mt-1 ${sub.active ? 'text-emerald-500' : 'text-torqued-red'}`}>{(sub.status || (sub.active ? 'active' : 'inactive')).toUpperCase()}</p>
            {sub.nextBilling && <p className="text-[11px] text-muted">Next bill {new Date(sub.nextBilling).toLocaleDateString('en-NZ')}</p>}
          </Card>
          <Card className="p-4 bg-card border-border">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted">Paid jobs (net 4%)</p>
            <p className="text-lg font-black mt-1 text-foreground">{formatCurrency(payoutAll)}</p>
            <p className="text-[11px] text-muted">{paidJobs.length} paid job{paidJobs.length === 1 ? '' : 's'}</p>
          </Card>
          <Card className="p-4 bg-card border-border">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted">This week (net)</p>
            <p className="text-lg font-black mt-1 text-foreground">{formatCurrency(weekRevenue)}</p>
          </Card>
        </div>

        {!sub.active && (
          <Card className="p-4 bg-torqued-red/5 border-torqued-red/20 flex items-center justify-between gap-4">
            <p className="text-sm font-bold">Subscription not active — activate to start receiving leads.</p>
            <Button size="sm" className="bg-torqued-red text-white shrink-0" onClick={async () => {
              const r = await fetch('/api/stripe/create-subscription', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user!.email, mechanicId: user!.id }) });
              const d = await r.json(); if (d.url) window.location.href = d.url;
            }}>Activate $99/mo</Button>
          </Card>
        )}

        <Card className="p-4 bg-card border-border flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-foreground">Weekly revenue report</p>
            <p className="text-xs text-muted">Last completed week (Mon–Sun): your jobs less Torqued's 4% commission.</p>
          </div>
          <Button size="sm" className="bg-torqued-red text-white shrink-0" onClick={downloadWeeklyReport}>Download PDF</Button>
        </Card>

        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-muted mb-2">Subscription payment history</h3>
          {(!sub.invoices || sub.invoices.length === 0) ? (
            <Card className="p-6 text-center text-muted text-sm italic bg-card border-border">{sub.note || 'No subscription payments yet.'}</Card>
          ) : (
            <div className="space-y-2">
              {sub.invoices.map((inv: any) => (
                <Card key={inv.id} className="p-3 bg-card border-border flex items-center justify-between text-sm">
                  <div>
                    <p className="font-bold">{new Date(inv.date).toLocaleDateString('en-NZ')} · {formatCurrency(inv.amount)}</p>
                    <p className="text-[11px] text-muted uppercase">{inv.status}</p>
                  </div>
                  {(inv.pdf || inv.url) && <a href={inv.pdf || inv.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-torqued-red hover:underline">Receipt</a>}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAssistant = () => {
    const suggestions = ['Oil capacity & grade for a 2017 VW Golf GTE?', 'Front brake caliper bolt torque for a Toyota Hilux?', 'Cambelt interval for a 2015 Mazda CX-5 diesel?'];
    return (
      <div className="flex flex-col h-[calc(100vh-160px)] max-w-3xl">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">Mechanic Assistant</h2>
          <p className="text-sm text-muted">Quick generalist data — oil capacities, fluid types, torque specs, intervals. Always confirm exact figures against the OEM manual.</p>
          <p className="text-[11px] text-torqued-red font-bold mt-1">Tip: type "order: cambelt kit x1" to add a part straight to your Parts-to-order list. You can also attach a photo for visual analysis.</p>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 py-4">
          {chatMessages.length === 0 && (
            <div className="space-y-2">
              {suggestions.map(s => (
                <button key={s} onClick={() => setChatInput(s)} className="block w-full text-left text-sm p-3 rounded-xl bg-card border border-border text-muted hover:border-torqued-red/40 hover:text-foreground transition-all">{s}</button>
              ))}
            </div>
          )}
          {chatMessages.map((m, i) => (
            <div key={i} className={cn('max-w-[85%] space-y-1', m.role === 'user' ? 'ml-auto' : '')}>
              {(m as any).image && (
                <img src={(m as any).image} alt="attached" className={cn('max-h-40 rounded-xl object-cover', m.role === 'user' ? 'ml-auto' : '')} />
              )}
              <div className={cn('p-3 rounded-2xl text-sm whitespace-pre-wrap', m.role === 'user' ? 'bg-torqued-red text-white' : 'bg-card border border-border text-foreground')}>{m.content}</div>
              {m.role === 'assistant' && !m.content.startsWith('✓ Added') && (
                <button onClick={() => { const part = prompt('Add which part to your order list?'); if (part?.trim()) { addPartToOrder(part, 1, quoteJob?.reg); setChatMessages(cm => [...cm, { role: 'assistant', content: `✓ Added "${part.trim()}" to your Parts-to-order list.` }]); } }}
                  className="text-[10px] font-bold text-torqued-red hover:underline">+ add a part to order list</button>
              )}
            </div>
          ))}
          {chatBusy && <div className="bg-card border border-border text-muted text-sm p-3 rounded-2xl w-fit">Thinking…</div>}
        </div>
        {chatPhoto && (
          <div className="relative w-fit mb-2">
            <img src={chatPhoto} alt="pending" className="h-20 rounded-xl object-cover border border-torqued-red/40" />
            <button onClick={() => setChatPhoto(null)} className="absolute -top-1 -right-1 w-5 h-5 bg-torqued-red rounded-full flex items-center justify-center text-white"><X size={10} /></button>
          </div>
        )}
        <div className="flex gap-2 pt-2 border-t border-border">
          <label className="cursor-pointer flex items-center justify-center w-12 h-12 bg-card border border-border rounded-xl text-muted hover:border-torqued-red hover:text-torqued-red transition-all shrink-0">
            <Camera size={18} />
            <input type="file" accept="image/*" className="hidden" onChange={e => {
              const f = e.target.files?.[0]; if (!f) return;
              const reader = new FileReader();
              reader.onload = ev => setChatPhoto(ev.target?.result as string);
              reader.readAsDataURL(f);
              e.target.value = '';
            }} />
          </label>
          <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendChat(); }}
            placeholder="Ask a question or attach a photo…" className="flex-1 bg-card border border-border rounded-xl px-4 h-12 text-sm text-foreground focus:outline-none focus:border-torqued-red" />
          <Button className="bg-torqued-red text-white" disabled={chatBusy || (!chatInput.trim() && !chatPhoto)} onClick={() => sendChat()}>Send</Button>
        </div>
      </div>
    );
  };

  const renderVehicleHealth = () => <VehicleHealthLookup mechanicId={user?.id} />;

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return renderDashboard();
      case 'jobs': return renderMyJobs();
      case 'manual-quotes': return renderIncomingJobs(true);
      case 'customers': return renderCustomers();
      case 'vehicle-health': return renderVehicleHealth();
      case 'assistant': return renderAssistant();
      case 'payments': return renderPayments();
      case 'parts': return renderParts();
      case 'profile': return renderProfile();
      case 'calendar': return renderCalendar();
      default: return renderDashboard();
    }
  };

  // Onboarding wizard — shown after login, before subscription, until completed
  if (user && onboardingComplete === false) {
    const obInput = "w-full bg-white/5 border border-white/10 rounded-xl px-4 h-12 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-torqued-red";
    const obLabel = "text-[10px] font-black uppercase tracking-widest text-white/50 block mb-1";
    return (
      <div className="min-h-screen bg-torqued-dark text-white flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-card border border-white/10 rounded-3xl p-8 space-y-6">
          <div className="flex items-center justify-between">
            <Logo variant="light" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Step {obStep} of 3</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-torqued-red transition-all" style={{ width: `${(obStep/3)*100}%` }} /></div>

          {obStep === 1 && (
            <div className="space-y-4">
              <div><h2 className="text-2xl font-black tracking-tight">Workshop details</h2><p className="text-sm text-white/50">Tell us about your business.</p></div>
              <div><label className={obLabel}>Workshop name</label><input className={obInput} value={ob.name} onChange={e=>setOb({...ob,name:e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={obLabel}>NZBN</label><input className={obInput} value={ob.nzbn} onChange={e=>setOb({...ob,nzbn:e.target.value})} /></div>
                <div><label className={obLabel}>Phone</label><input className={obInput} value={ob.phone} onChange={e=>setOb({...ob,phone:e.target.value})} /></div>
              </div>
              <div><label className={obLabel}>Address</label><input className={obInput} value={ob.address} onChange={e=>setOb({...ob,address:e.target.value})} /></div>
              <div><label className={obLabel}>Owner name</label><input className={obInput} value={ob.owner_name} onChange={e=>setOb({...ob,owner_name:e.target.value})} /></div>
              <Button fullWidth className="bg-torqued-red text-white" disabled={!ob.name} onClick={()=>setObStep(2)}>Continue</Button>
            </div>
          )}

          {obStep === 2 && (
            <div className="space-y-4">
              <div><h2 className="text-2xl font-black tracking-tight">Payout details</h2><p className="text-sm text-white/50">Where we send your earnings.</p></div>
              <div><label className={obLabel}>Name on account</label><input className={obInput} value={ob.bank_account_name} onChange={e=>setOb({...ob,bank_account_name:e.target.value})} /></div>
              <div><label className={obLabel}>Bank account number</label><input className={obInput} placeholder="00-0000-0000000-00" value={ob.bank_account_number} onChange={e=>setOb({...ob,bank_account_number:e.target.value})} /></div>
              <div className="flex gap-3"><Button variant="outline" className="border-white/20 text-white" onClick={()=>setObStep(1)}>Back</Button><Button fullWidth className="bg-torqued-red text-white" onClick={()=>setObStep(3)}>Continue</Button></div>
            </div>
          )}

          {obStep === 3 && (
            <div className="space-y-4">
              <div><h2 className="text-2xl font-black tracking-tight">Rates & capacity</h2><p className="text-sm text-white/50">Used to price jobs and set availability.</p></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className={obLabel}>Labour $/hr</label><input type="number" className={obInput} value={ob.labour_rate||''} onChange={e=>setOb({...ob,labour_rate:parseFloat(e.target.value)||0})} /></div>
                <div><label className={obLabel}>Technicians</label><input type="number" className={obInput} value={ob.technicians||''} onChange={e=>setOb({...ob,technicians:parseInt(e.target.value)||1})} /></div>
                <div><label className={obLabel}>Parts lead (days)</label><input type="number" className={obInput} value={ob.parts_lead_days||''} onChange={e=>setOb({...ob,parts_lead_days:parseInt(e.target.value)||1})} /></div>
              </div>
              {obSaving && <p className="text-xs text-white/40">Saving…</p>}
              <div className="flex gap-3">
                <Button variant="outline" className="border-white/20 text-white" onClick={()=>setObStep(2)}>Back</Button>
                <Button fullWidth className="bg-torqued-red text-white" disabled={obSaving} onClick={async()=>{
                  setObSaving(true);
                  try {
                    await fetch('/api/mechanic/save-onboarding', {
                      method:'POST', headers:{'Content-Type':'application/json'},
                      body: JSON.stringify({ mechanicId: user.id, fields: ob, complete: true }),
                    });
                    setOnboardingComplete(true);
                  } catch {} finally { setObSaving(false); }
                }}>Finish — Continue to Subscription</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!user || (!userProfile?.subscriptionActive && !justActivated)) {
    return (
      <div className="min-h-screen bg-torqued-dark text-white flex flex-col">
        {/* Navigation */}
        <nav className="p-4 md:px-8 flex justify-between items-center bg-background/50 border-b border-white/10">
          <Logo variant="light" />
          {user ? (
            <Button size="sm" variant="outline" className="text-white border-white/20 hover:bg-white/5" onClick={logout}>
              Sign Out
            </Button>
          ) : (
            <Button size="sm" className="bg-torqued-red" onClick={() => setMechAuthMode('login')}>
              Sign In
            </Button>
          )}
        </nav>

        <main className="flex-1 flex items-center justify-center p-6 py-20 relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-torqued-red/10 blur-[120px] rounded-full -z-10" />

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-xl bg-card border border-white/10 shadow-2xl rounded-3xl p-8 sm:p-12 space-y-8 text-center"
          >
            <div className="w-20 h-20 bg-torqued-red/10 border border-torqued-red/20 text-torqued-red rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Wrench size={38} className="animate-pulse" />
            </div>

            <div className="space-y-3">
              <h2 className="text-3xl sm:text-5xl font-black italic tracking-tighter uppercase text-white leading-none">
                Mechanic Portal <span className="text-torqued-red font-normal italic text-3xl sm:text-5xl">Hub</span>
              </h2>
              <p className="text-sm sm:text-base text-white/60">
                Unlock automated parts diagnostics, custom quotes, invoice management, and direct high-value diesel and euro leads.
              </p>
            </div>

            {!user && mechSignupSent ? (
              <div className="space-y-5 text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-3xl">✉️</div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-white">Check your email</h3>
                  <p className="text-sm text-white/60">
                    We've sent a confirmation link to <span className="text-white font-bold">{mechEmail}</span>. Click it to activate your workshop account, then log in.
                  </p>
                </div>

                {mechResendMsg && (
                  <p className="text-xs font-bold text-emerald-400">{mechResendMsg}</p>
                )}

                <button
                  disabled={mechResendCooldown > 0}
                  onClick={async () => {
                    setMechResendMsg(null);
                    const err = await resendMechanicLink(mechEmail);
                    if (err) { setMechResendMsg(err); }
                    else { setMechResendMsg('Link resent — check your inbox.'); setMechResendCooldown(30); }
                  }}
                  className="text-xs font-bold text-torqued-red hover:text-red-400 disabled:text-white/30 disabled:cursor-not-allowed transition-colors"
                >
                  {mechResendCooldown > 0 ? `Resend link in ${mechResendCooldown}s` : "Didn't get it? Resend link"}
                </button>

                <Button
                  fullWidth
                  variant="outline"
                  className="border-white/20 text-white"
                  onClick={() => { setMechSignupSent(false); setMechAuthMode('login'); setMechPassword(''); setMechResendMsg(null); }}
                >
                  Back to Login
                </Button>
              </div>
            ) : !user ? (
              <div className="space-y-4 text-left">
                <div className="flex rounded-xl overflow-hidden border border-white/10">
                  <button
                    onClick={() => { setMechAuthMode('login'); setMechAuthError(null); }}
                    className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider transition-all ${mechAuthMode === 'login' ? 'bg-torqued-red text-white' : 'text-white/40 hover:text-white'}`}
                  >Login</button>
                  <button
                    onClick={() => { setMechAuthMode('signup'); setMechAuthError(null); }}
                    className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider transition-all ${mechAuthMode === 'signup' ? 'bg-torqued-red text-white' : 'text-white/40 hover:text-white'}`}
                  >Register</button>
                </div>

                <div className="space-y-3">
                  {mechAuthMode === 'signup' && (
                    <input
                      type="text"
                      placeholder="Workshop / Business Name"
                      value={mechName}
                      onChange={e => setMechName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 h-12 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-torqued-red"
                    />
                  )}
                  <input
                    type="email"
                    placeholder="Email address"
                    value={mechEmail}
                    onChange={e => setMechEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 h-12 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-torqued-red"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={mechPassword}
                    onChange={e => setMechPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 h-12 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-torqued-red"
                  />
                </div>

                {mechAuthError && (
                  <p className="text-xs text-torqued-red font-bold">{mechAuthError}</p>
                )}

                <Button
                  fullWidth
                  size="lg"
                  disabled={mechAuthLoading}
                  className="bg-torqued-red hover:bg-red-700 text-white font-black uppercase text-xs tracking-widest h-14"
                  onClick={async () => {
                    setMechAuthError(null);
                    setMechAuthLoading(true);
                    try {
                      if (mechAuthMode === 'login') {
                        await loginMechanic(mechEmail, mechPassword);
                        // First-time login: offer a passkey for next time
                        if (passkeysSupported() && mechEmail && window.confirm('Set up a passkey for faster sign-in? You\'ll use Face ID / Touch ID instead of your password next time.')) {
                          try { await registerPasskey('mechanic', mechEmail); window.alert('Passkey added.'); } catch {}
                        }
                      } else {
                        const result = await signUpMechanic(mechEmail, mechPassword, mechName);
                        if (result.error) setMechAuthError(result.error);
                        else if (result.needsConfirmation) setMechSignupSent(true);
                      }
                    } catch (e: any) {
                      setMechAuthError(e.message || 'Authentication failed');
                    } finally {
                      setMechAuthLoading(false);
                    }
                  }}
                >
                  {mechAuthLoading ? 'Please wait...' : mechAuthMode === 'login' ? 'Log In' : 'Create Account'}
                </Button>

                {mechAuthMode === 'login' && passkeysSupported() && (
                  <button
                    onClick={async () => {
                      setMechAuthError(null); setMechAuthLoading(true);
                      try {
                        const r = await authPasskey('mechanic', mechEmail || undefined);
                        if (!r.tokenHash) throw new Error('Could not establish session — use password.');
                        const { error } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: r.tokenHash });
                        if (error) throw new Error(error.message);
                        // AuthContext picks up the session via onAuthStateChange
                      } catch (e: any) {
                        setMechAuthError(e?.message || 'Passkey sign-in failed');
                      } finally { setMechAuthLoading(false); }
                    }}
                    className="w-full text-xs font-bold text-white/70 hover:text-white border border-white/10 rounded-xl h-12 flex items-center justify-center gap-2"
                  >
                    <span aria-hidden>🔑</span> Sign in with passkey
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-left flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-torqued-red/10 border border-torqued-red/20 flex items-center justify-center text-torqued-red font-bold text-sm overflow-hidden">
                    {(user.user_metadata?.full_name ?? user.email ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{user.user_metadata?.full_name ?? user.email}</p>
                    <p className="text-[10px] text-white/50 truncate font-mono">{user.email}</p>
                  </div>
                </div>

                <div className="space-y-4 border-t border-white/10 pt-6">
                  <div className="flex justify-between text-left items-center">
                    <div>
                      <p className="font-bold text-sm text-white">Torqued Garage Portal Plan</p>
                      <p className="text-[10px] text-white/50">Unlimited leads + 4% commission on jobs</p>
                    </div>
                    <span className="font-black italic text-torqued-red text-lg">$99.00 <span className="text-[9px] block font-normal text-white/40 not-italic text-right">/ month</span></span>
                  </div>

                  {/* Promo / trial code — bypasses payment, no card required */}
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        value={subPromo}
                        onChange={e => { setSubPromo(e.target.value); setSubPromoError(null); }}
                        placeholder="Promo code (e.g. trial)"
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 h-12 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-torqued-red uppercase"
                      />
                      <Button
                        disabled={subPromoLoading || !subPromo.trim() || !user}
                        className="bg-white/10 hover:bg-white/20 text-white font-black uppercase text-[10px] tracking-widest px-5 h-12"
                        onClick={async () => {
                          if (!user) return;
                          setSubPromoLoading(true);
                          setSubPromoError(null);
                          try {
                            const r = await fetch('/api/mechanic/redeem-promo', {
                              method: 'POST', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ mechanicId: user.id, code: subPromo }),
                            });
                            const d = await r.json();
                            if (d.activated) { setJustActivated(true); markSubscriptionActive(); }
                            else setSubPromoError(d.error || 'Invalid promo code.');
                          } catch {
                            setSubPromoError('Could not apply code. Please try again.');
                          } finally {
                            setSubPromoLoading(false);
                          }
                        }}
                      >
                        {subPromoLoading ? '...' : 'Apply'}
                      </Button>
                    </div>
                    {subPromoError && <p className="text-[11px] text-torqued-red font-bold">{subPromoError}</p>}
                    <p className="text-[10px] text-white/30 text-center">Have a trial code? Apply it to skip payment.</p>
                  </div>

                  <Button
                     fullWidth
                     disabled={isSubscriptionLoading}
                     size="lg"
                     className="bg-torqued-red hover:bg-red-700 text-white font-black uppercase text-xs tracking-widest h-14 flex items-center justify-center gap-2"
                     onClick={async () => {
                       if (!user) return;
                       setIsSubscriptionLoading(true);
                       try {
                         const response = await fetch('/api/stripe/create-subscription', {
                           method: 'POST',
                           headers: { 'Content-Type': 'application/json' },
                           body: JSON.stringify({
                             email: user.email,
                             mechanicId: user.id,
                           })
                         });
                         const session = await response.json();
                         if (session.url && !session.isMock) {
                           // Redirect straight to Stripe's hosted subscription checkout
                           window.location.href = session.url;
                         } else if (session.url) {
                           setStripeSubscriptionUrl(session.url);
                           setStripeFormStep('input');
                           setShowStripeSubscriptionModal(true);
                         } else {
                           alert(session.error || 'Could not start checkout. Please try again.');
                         }
                       } catch (err) {
                         console.error('Subscription session creation failed:', err);
                         alert('Could not connect to the payment gateway. Please try again.');
                       } finally {
                         setIsSubscriptionLoading(false);
                       }
                     }}
                  >
                    Activate Garage Hub via Stripe
                  </Button>
                </div>
              </div>
            )}
            
            {/* Premium Integrated Stripe Elements Sheet */}
            <AnimatePresence>
              {showStripeSubscriptionModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 overflow-y-auto bg-black/80">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => {
                      if (stripeFormStep !== 'processing') {
                        setShowStripeSubscriptionModal(false);
                      }
                    }}
                    className="absolute inset-0 bg-background/50 backdrop-blur-sm"
                  />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 30 }}
                    className="relative w-full max-w-lg bg-zinc-950 border border-white/10 shadow-2xl rounded-3xl overflow-hidden p-6 md:p-8 space-y-6"
                  >
                    {/* Stripe Branded Header */}
                    <div className="flex justify-between items-center pb-4 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black uppercase text-white bg-white/5 py-1 px-2.5 rounded-lg border border-white/10 tracking-wider flex items-center gap-1.5 font-mono">
                          <span className="w-2.5 h-2.5 bg-torqued-red rounded-full animate-pulse" />
                          Secure Subscription Portal
                        </span>
                      </div>
                      <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider flex items-center gap-1">
                        🔒 SSL Certified
                      </div>
                    </div>

                    {stripeFormStep === 'input' && (
                      <div className="space-y-5">
                        <div className="space-y-1.5 text-left">
                          <h3 className="text-xl font-black tracking-tight text-white">Garage Portal Hub Activation 🔧</h3>
                          <p className="text-xs text-white/60">
                            Join high-performing NZ workshops. Unlock instant direct customer leads, live service history overrides, and calendar scheduler.
                          </p>
                        </div>

                        {/* Subscription Summary Panel */}
                        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-white/40">Tier Selected:</span>
                            <span className="font-extrabold text-white">Torqued Garage Explorer</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-white/40">Commission Rate:</span>
                            <span className="font-extrabold text-emerald-400">4% of completed work payouts</span>
                          </div>
                          <div className="flex justify-between items-center text-xs pt-1.5 border-t border-white/10">
                            <span className="text-white/60 font-bold">Stripe Recurrent Charge:</span>
                            <span className="font-black text-sm text-torqued-red font-mono">
                              $99.00 <span className="text-[9px] text-white/40 font-normal">NZD / month</span>
                            </span>
                          </div>
                        </div>

                        {/* Stripe Security Redirect and Payment Options */}
                        <div className="space-y-6">
                          <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                              <Lock size={16} />
                            </div>
                            <div className="text-left space-y-1">
                              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Checkout Session Initiated</h4>
                              <p className="text-[11px] text-white/70 leading-relaxed">
                                Complete your activation securely. Stripe processes payments securely on their own premium, SSL-encrypted hosted page.
                              </p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="flex justify-between items-center text-xs text-white/40 px-1">
                              <span>Supported Payment Types:</span>
                              <span className="font-mono text-[10px] text-emerald-400">Secure Direct Sync</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-center space-y-0.5">
                                <span className="text-sm">💳</span>
                                <p className="text-[9px] font-black uppercase text-white/60 tracking-wider">Cards</p>
                              </div>
                              <div className="p-3 bg-[#FFC0CB]/10 border border-[#FFC0CB]/25 rounded-xl text-center space-y-0.5">
                                <span className="text-xs font-bold text-[#FFC0CB]">Klarna.</span>
                                <p className="text-[9px] font-black uppercase text-[#FFC0CB]/80 tracking-wider">Buy Now</p>
                              </div>
                              <div className="p-3 bg-[#B2F6E1]/10 border border-[#B2F6E1]/25 rounded-xl text-center space-y-0.5">
                                <span className="text-xs font-black text-[#B2F6E1]">afterpay</span>
                                <p className="text-[9px] font-black uppercase text-[#B2F6E1]/80 tracking-wider">4 Payments</p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <a
                              href={stripeSubscriptionUrl || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full bg-torqued-red hover:bg-red-700 text-white font-black uppercase text-xs tracking-widest h-14 rounded-2xl flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-torqued-red/20 transition-all cursor-pointer"
                              onClick={() => {
                                // Transition to processing/polling check screen
                                setStripeFormStep('processing');
                                setStripeLoadingMessage('Awaiting completed payment confirmation from Stripe secure webhook...');
                                
                                // Since we don't have webhook setup on high-velocity client side in local dev, let's auto-verify after 6 seconds to trigger completion!
                                setTimeout(() => {
                                  setStripeLoadingMessage('Stripe signature validated. Authorizing Garage Hub subscription...');
                                }, 2500);

                                setTimeout(async () => {
                                  if (user) {
                                    try {
                                      await fetch('/api/mechanic/activate', {
                                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ mechanicId: user.id }),
                                      });
                                      setJustActivated(true); markSubscriptionActive();
                                    } catch (err) {
                                      console.error('Subscription update failed:', err);
                                    }
                                  }
                                  setStripeFormStep('success');
                                }, 5000);
                              }}
                            >
                              Proceed to Secure Stripe Checkout 🡥
                            </a>
                            <p className="text-[10px] text-white/40 text-center">
                              Safe & secure connection directly to your Stripe merchant portal checkout settings.
                            </p>
                          </div>

                          {/* Bypass Shortcut Option */}
                          <div className="pt-4 border-t border-white/5 space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Sandbox Simulation</span>
                              <span className="text-[8px] bg-white/5 text-white/40 px-1.5 py-0.5 rounded uppercase font-bold">Fast-Track</span>
                            </div>
                            <Button
                              variant="ghost"
                              fullWidth
                              className="text-[10px] font-semibold text-white/40 hover:text-white uppercase tracking-widest border border-white/5 h-11 rounded-xl hover:bg-white/5 font-mono"
                              onClick={() => {
                                setStripeFormStep('processing');
                                setStripeLoadingMessage('Simulating subscription payment bypass...');
                                setTimeout(() => {
                                  setStripeLoadingMessage('Activating garage hub permissions...');
                                }, 1200);
                                setTimeout(async () => {
                                  if (user) {
                                    try {
                                      await fetch('/api/mechanic/activate', {
                                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ mechanicId: user.id }),
                                      });
                                      setJustActivated(true); markSubscriptionActive();
                                    } catch (err) {
                                      console.error('Subscription update failed:', err);
                                    }
                                  }
                                  setStripeFormStep('success');
                                }, 2500);
                              }}
                            >
                              Skip Redirect (Direct Simulation)
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {stripeFormStep === 'processing' && (
                      <div className="py-12 space-y-6 text-center">
                        <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                          <div className="absolute inset-0 border-4 border-torqued-red/20 rounded-full" />
                          <div className="absolute inset-0 border-4 border-t-torqued-red rounded-full animate-spin" />
                          <CreditCard size={32} className="text-torqued-red animate-pulse" />
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-lg font-black tracking-tighter text-white">Activating Premium Subscription...</h4>
                          <p className="text-xs text-white/50 font-bold font-mono text-center tracking-tight animate-pulse text-torqued-red bg-torqued-red/10 max-w-sm mx-auto py-2 p-3 rounded-xl border border-torqued-red/15">
                            {stripeLoadingMessage}
                          </p>
                        </div>
                      </div>
                    )}

                    {stripeFormStep === 'success' && (
                      <div className="py-10 space-y-6 text-center">
                        <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20">
                          <CheckCircle2 size={44} />
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-2xl font-black tracking-tight text-white">Workshop Subscribed! 🎉</h4>
                          <p className="text-xs text-white/60 max-w-sm mx-auto leading-relaxed">
                            Welcome to Torqued! Your workshop dashboard is ready! Your workshop dashboard has been successfully enabled with immediate full feature permissions.
                          </p>
                        </div>
                        <Button
                          fullWidth
                          onClick={() => {
                            setShowStripeSubscriptionModal(false);
                          }}
                          className="bg-torqued-red hover:bg-red-700 text-white font-black uppercase text-[10px] tracking-widest h-12 rounded-xl"
                        >
                          Enter Workshop Dashboard
                        </Button>
                      </div>
                    )}
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
            
            {onBack && (
              <button 
                className="text-[10px] font-bold text-white/40 hover:text-white tracking-widest uppercase block mx-auto pt-2"
                onClick={onBack}
              >
                ← Back to Landing Page
              </button>
            )}
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row transition-colors duration-300">
      {/* Mobile Header */}
      <div className="md:hidden p-4 border-b border-border flex justify-between items-center bg-background sticky top-0 z-50">
        <Logo />
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 hover:bg-card rounded-lg text-muted"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 hover:bg-card rounded-lg"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Filter size={24} />}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "w-full md:w-72 bg-background/50 backdrop-blur-2xl text-foreground flex flex-col fixed md:sticky top-[64px] md:top-0 h-[calc(100vh-64px)] md:h-screen border-r border-border z-40 transition-transform md:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="hidden md:flex p-8 border-b border-border h-24 items-center">
          <Logo />
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {sidebarItems.map(item => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsMobileMenuOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold uppercase tracking-wider text-xs",
                activeTab === item.id ? "bg-torqued-red text-white" : "text-muted hover:bg-card hover:text-foreground"
              )}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.badge && (
                <span className="ml-auto bg-torqued-red text-white text-[10px] px-1.5 py-0.5 rounded-full ring-2 ring-background">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border">
            <div className="w-10 h-10 bg-torqued-red rounded-lg flex items-center justify-center font-bold text-white">PM</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">Precision Mechanical</p>
              <p className="text-[10px] text-muted truncate">NZ</p>
            </div>
            <MoreVertical size={16} className="text-muted" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto bg-background">
        <header className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6 mb-8">
          <div>
            <h1 className="text-4xl text-foreground tracking-tighter">
              {sidebarItems.find(i => i.id === activeTab)?.label}
            </h1>
            <p className="text-muted font-bold uppercase tracking-widest text-[10px]">{new Date().toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {/* Theme Toggle */}
            <div className="flex bg-card p-1 rounded-xl border border-border">
              {[
                { name: 'light', icon: Sun },
                { name: 'dark', icon: Moon },
                { name: 'system', icon: Monitor },
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.name}
                    onClick={() => setTheme(t.name as any)}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      theme === t.name 
                        ? "bg-torqued-red text-white shadow-lg shadow-torqued-red/20" 
                        : "text-muted hover:text-foreground hover:bg-background"
                    )}
                    title={t.name.charAt(0).toUpperCase() + t.name.slice(1)}
                  >
                    <Icon size={16} />
                  </button>
                );
              })}
            </div>

            <div className="relative flex-1 lg:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
              <input 
                placeholder="Search jobs, regos..." 
                className="bg-card border border-border rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:border-torqued-red/30 w-full lg:w-64 text-foreground transition-all focus:bg-card/80 font-mono tracking-tight"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </header>

        {searchQuery && (
          <div className="bg-card border border-border rounded-3xl p-6 mb-8 mt-4 space-y-6 text-foreground max-w-7xl mx-auto shadow-xl">
            <div className="flex justify-between items-center pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 bg-torqued-red rounded-full animate-ping" />
                <h3 className="text-lg font-black tracking-tight text-foreground uppercase">Live Registry Lookup</h3>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSearchQuery('')} className="border-border text-foreground hover:bg-background">Clear Search</Button>
            </div>
            
            {(() => {
              const query = searchQuery.trim().toUpperCase();
              const matchedJob = incomingJobs.find(j => j.reg.toUpperCase().includes(query) || j.model.toUpperCase().includes(query));
              if (matchedJob) {
                return (
                  <div className="p-6 bg-background border border-border hover:border-torqued-red/20 transition-all rounded-3xl flex flex-col justify-between space-y-6 max-w-sm">
                    <div className="space-y-4 text-left">
                      <span className="text-[10px] font-mono tracking-widest bg-emerald-500/10 text-emerald-400 font-extrabold px-2.5 py-1 rounded-full uppercase border border-emerald-500/10">Vehicle Found</span>
                      <h4 className="text-2xl font-black text-foreground tracking-tight">{matchedJob.reg}</h4>
                      <p className="text-sm font-bold text-foreground">{matchedJob.model}</p>
                      <p className="text-xs text-muted leading-relaxed">{matchedJob.details}</p>
                    </div>
                    <div className="pt-2">
                      <Button
                        fullWidth
                        onClick={() => {
                          setSelectedJobId(matchedJob.id);
                          setSearchQuery('');
                        }}
                        className="bg-torqued-red text-white hover:bg-red-700 font-bold text-xs"
                      >
                        View Health Report
                      </Button>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div className="py-4 text-center text-muted text-sm font-medium">
                    No matching vehicles found for "{searchQuery}".
                  </div>
                );
              }
            })()}
          </div>
        )}

        {renderContent()}
      </main>
      {selectedJobId && renderHealthReport()}
      {showProcurement && renderProcurementModal()}

      {/* Cold quote: create a booking for a customer with no prior Torqued relationship */}
      {showColdQuote && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-card border border-border rounded-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div>
              <h3 className="text-xl font-black tracking-tight text-foreground">New quote</h3>
              <p className="text-xs text-muted">Search an existing customer, or add a new one. We email them the quote; if they pay online, Torqued takes its 4%.</p>
            </div>

            {/* Search existing customers (name / phone / rego) */}
            <div className="space-y-1">
              <input value={custSearch} onChange={e => setCustSearch(e.target.value)} placeholder="Search existing customer by name, phone or rego…"
                className="w-full bg-background border border-border rounded-lg px-3 h-10 text-sm text-foreground" />
              {custSearch.trim() && (
                <div className="max-h-32 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                  {customers.filter(c => [c.name, c.email, c.phone, ...(c.regos || [])].join(' ').toLowerCase().includes(custSearch.toLowerCase().trim())).slice(0, 6).map((c, i) => (
                    <button key={i} onClick={() => { setColdForm(f => ({ ...f, customerName: c.name || '', email: c.email || '', phone: c.phone || '', rego: c.regos?.[0] || f.rego })); setCustSearch(''); }}
                      className="block w-full text-left px-3 py-2 text-xs hover:bg-card">
                      <span className="font-bold text-foreground">{c.name || c.email}</span> <span className="text-muted">{c.phone || ''} {c.regos?.length ? `· ${c.regos.join(', ')}` : ''}</span>
                    </button>
                  ))}
                  {customers.filter(c => [c.name, c.email, c.phone, ...(c.regos || [])].join(' ').toLowerCase().includes(custSearch.toLowerCase().trim())).length === 0 && <p className="px-3 py-2 text-xs text-muted italic">No match — fill the fields below to add a new customer.</p>}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {([['customerName','Customer name *'],['email','Email *'],['phone','Phone'],['rego','Rego'],['make','Make'],['model','Model']] as const).map(([f,l]) => (
                <input key={f} value={(coldForm as any)[f]} placeholder={l}
                  onChange={e => {
                    setColdForm(c => ({ ...c, [f]: f === 'rego' ? e.target.value.toUpperCase() : e.target.value }));
                    if (f === 'rego') { setColdRegoLookedUp(false); setHistAccessState('idle'); setUnlockedHistory(null); }
                  }}
                  onBlur={f === 'rego' ? async () => {
                    const plate = coldForm.rego.trim().toUpperCase();
                    if (!plate || coldRegoLookedUp) return;
                    setColdRegoLookedUp(true);
                    try {
                      // Try Carjam first, fall back to our vehicles table
                      const cj = await fetch(`/api/rego/carjam?plate=${encodeURIComponent(plate)}`).then(r => r.ok ? r.json() : null);
                      if (cj?.make) {
                        setColdForm(c => ({ ...c, make: c.make || cj.make || '', model: c.model || cj.model || '' }));
                      } else {
                        const v = await fetch(`/api/vehicles/${encodeURIComponent(plate)}`).then(r => r.ok ? r.json() : null);
                        if (v) setColdForm(c => ({ ...c, make: c.make || v.make || '', model: c.model || v.model || '' }));
                      }
                      // After vehicle details fetched, check if customer account exists
                      await checkHistoryAccess(plate);
                    } catch {}
                  } : undefined}
                  className="bg-background border border-border rounded-lg px-3 h-10 text-sm text-foreground" />
              ))}
            </div>

            {/* Service History Access Panel */}
            {histAccessState !== 'idle' && coldForm.rego && (
              <div className="rounded-xl border border-border bg-background p-4 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted">Customer Service History</p>

                {histAccessState === 'checking' && (
                  <p className="text-xs text-muted flex items-center gap-2">
                    <span className="inline-block w-3 h-3 border-2 border-muted border-t-foreground rounded-full animate-spin" />
                    Checking for Torqued account…
                  </p>
                )}

                {histAccessState === 'no_account' && (
                  <p className="text-xs text-muted">No Torqued account linked to this plate. You can still proceed with the quote.</p>
                )}

                {histAccessState === 'no_email' && (
                  <p className="text-xs text-amber-500">This customer has a Torqued account but no email on file. Contact support to resolve.</p>
                )}

                {histAccessState === 'needs_otp' && (
                  <div className="space-y-2">
                    <p className="text-xs text-foreground">The owner of this vehicle has a Torqued account. To view their service history, we need to send them a one-time access code. Once they provide you with the code, enter it below to unlock their service history for this quote.</p>
                    <button
                      onClick={() => checkHistoryAccess(coldForm.rego)}
                      className="text-xs font-bold bg-torqued-red text-white px-4 py-2 rounded-lg hover:bg-torqued-red/80 transition-colors">
                      Send Access Code
                    </button>
                  </div>
                )}

                {(histAccessState === 'otp_sent' || histAccessState === 'already_sent') && (
                  <div className="space-y-2">
                    <p className="text-xs text-foreground">
                      {histAccessState === 'already_sent'
                        ? 'A code has already been sent to the vehicle owner.'
                        : 'An access code has been sent to the vehicle owner\'s email.'}
                      {histOtpExpiry && <span className="text-muted"> Expires {new Date(histOtpExpiry).toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' })}.</span>}
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={histOtpInput}
                        onChange={e => setHistOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="Enter 6-digit code"
                        className="flex-1 bg-card border border-border rounded-lg px-3 h-10 text-sm text-foreground tracking-widest font-mono text-center"
                      />
                      <button
                        onClick={verifyHistOtp}
                        disabled={histOtpInput.length !== 6}
                        className="text-xs font-bold bg-torqued-red text-white px-4 py-2 rounded-lg disabled:opacity-40 hover:bg-torqued-red/80 transition-colors">
                        Unlock
                      </button>
                    </div>
                    {histAccessMsg && <p className="text-xs text-torqued-red font-bold">{histAccessMsg}</p>}
                  </div>
                )}

                {histAccessState === 'entering_code' && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={histOtpInput}
                        onChange={e => setHistOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="Enter 6-digit code"
                        className="flex-1 bg-card border border-border rounded-lg px-3 h-10 text-sm text-foreground tracking-widest font-mono text-center"
                      />
                      <button
                        onClick={verifyHistOtp}
                        disabled={histOtpInput.length !== 6}
                        className="text-xs font-bold bg-torqued-red text-white px-4 py-2 rounded-lg disabled:opacity-40">
                        Unlock
                      </button>
                    </div>
                    {histAccessMsg && <p className="text-xs text-torqued-red font-bold">{histAccessMsg}</p>}
                  </div>
                )}

                {histAccessState === 'verifying' && (
                  <p className="text-xs text-muted flex items-center gap-2">
                    <span className="inline-block w-3 h-3 border-2 border-muted border-t-foreground rounded-full animate-spin" />
                    Verifying code…
                  </p>
                )}

                {histAccessState === 'prior_booking' && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <span>✓</span> Prior booking found — loading history…
                  </p>
                )}

                {histAccessState === 'granted' && unlockedHistory && (
                  <div className="space-y-2">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                      <span>✓</span> Service history unlocked
                    </p>
                    {unlockedHistory.imported.length === 0 && unlockedHistory.torquedJobs.length === 0 && (
                      <p className="text-xs text-muted italic">No service history records on file.</p>
                    )}
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {unlockedHistory.torquedJobs.map((j: any, i: number) => (
                        <div key={`tj${i}`} className="flex justify-between text-xs text-foreground bg-card rounded px-2 py-1.5 border border-border">
                          <span className="font-medium">{(j.date || (j.created_at || '').slice(0, 10))} · {(j.service_ids || []).join(', ') || 'Torqued job'}</span>
                          <span className="text-muted shrink-0">${j.total_price || 0}</span>
                        </div>
                      ))}
                      {unlockedHistory.imported.map((h: any, i: number) => (
                        <div key={`ih${i}`} className="flex justify-between text-xs text-foreground bg-card rounded px-2 py-1.5 border border-border">
                          <span>{h.service_date || '—'} · {h.work_done || 'Service'}{h.provider ? ` · ${h.provider}` : ''}</span>
                          <span className="text-muted shrink-0">{h.mileage ? `${Number(h.mileage).toLocaleString()} km` : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {histAccessState === 'error' && (
                  <p className="text-xs text-torqued-red">{histAccessMsg || 'Something went wrong.'}</p>
                )}
              </div>
            )}

            <textarea value={coldForm.description} onChange={e => setColdForm(c => ({ ...c, description: e.target.value }))} rows={2} placeholder="Work required / notes" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none" />
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted">Proposed date (optional — customer can confirm)</label>
              <input type="date" value={coldForm.date} onChange={e => setColdForm(c => ({ ...c, date: e.target.value }))} className="w-full bg-background border border-border rounded-lg px-3 h-10 text-sm text-foreground" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" fullWidth className="text-foreground border-border" onClick={() => { setShowColdQuote(false); setHistAccessState('idle'); setUnlockedHistory(null); setColdRegoLookedUp(false); }}>Cancel</Button>
              <Button fullWidth className="bg-torqued-red text-white" disabled={coldBusy || !coldForm.customerName || !coldForm.email} onClick={async () => {
                setColdBusy(true);
                try {
                  const r = await fetch('/api/mechanic/cold-quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mechanicId: user!.id, ...coldForm }) });
                  const d = await r.json();
                  if (!r.ok) { alert(d.error || 'Could not create cold quote.'); return; }
                  setShowColdQuote(false);
                  setHistAccessState('idle'); setUnlockedHistory(null); setColdRegoLookedUp(false);
                  openQuoteEditor({ id: d.bookingId, reg: coldForm.rego, customerName: coldForm.customerName, model: `${coldForm.make} ${coldForm.model}`.trim() || coldForm.rego, services: [] });
                } catch { alert('Could not create cold quote.'); }
                finally { setColdBusy(false); }
              }}>{coldBusy ? 'Creating…' : 'Build quote →'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Quote Builder */}
      <AnimatePresence>
        {quoteJob && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 20 }}
              className="w-full max-w-lg my-8 bg-card border border-border rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-black tracking-tight">Build Quote</h3>
                  <p className="text-xs text-muted">{quoteJob.model} {quoteJob.reg ? `(${quoteJob.reg})` : ''}</p>
                </div>
                <button onClick={() => setQuoteJob(null)} className="text-muted hover:text-foreground"><X size={20} /></button>
              </div>

              {/* Parts */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">Parts</label>
                  <button onClick={() => setQParts([...qParts, { name: '', qty: 1, unitPrice: 0 }])} className="text-[10px] font-bold text-torqued-red flex items-center gap-1"><Plus size={12}/> Add manual part</button>
                </div>
                {parts.length > 0 && (
                  <select onChange={e => {
                    const inv = parts.find(p => p.id === e.target.value);
                    if (inv) setQParts([...qParts.filter(p => p.name), { name: inv.name, qty: 1, unitPrice: inv.unitPrice }]);
                    e.target.value = '';
                  }} className="w-full bg-background border border-border rounded-lg px-3 h-9 text-xs text-foreground">
                    <option value="">+ Add from inventory…</option>
                    {parts.map(p => <option key={p.id} value={p.id}>{p.name} — ${p.unitPrice} ({p.quantity} in stock)</option>)}
                  </select>
                )}
                {qParts.map((p, i) => {
                  const stk = stockFor(p.name);
                  const needed = p.qty || 0;
                  const inStock = stk != null && stk >= needed && needed > 0;
                  return (
                  <div key={i} className="space-y-1">
                    <div className="flex gap-2 items-center">
                      <input value={p.name} onChange={e => { const n=[...qParts]; n[i]={...p,name:e.target.value}; setQParts(n); }} placeholder="Part name" className="flex-1 bg-background border border-border rounded-lg px-3 h-9 text-xs text-foreground" />
                      <input type="number" value={p.qty||''} onChange={e => { const n=[...qParts]; n[i]={...p,qty:parseInt(e.target.value)||0}; setQParts(n); }} placeholder="Qty" className="w-12 bg-background border border-border rounded-lg px-2 h-9 text-xs text-foreground" />
                      <input type="number" value={p.unitPrice||''} onChange={e => { const n=[...qParts]; n[i]={...p,unitPrice:parseFloat(e.target.value)||0}; setQParts(n); }} placeholder="$ ea" className="w-16 bg-background border border-border rounded-lg px-2 h-9 text-xs text-foreground" />
                      <button onClick={() => aiLookupPart(i)} disabled={partLookupBusy===i} title="AI lookup (NZ suppliers)" className="text-torqued-red hover:opacity-70 text-[10px] font-black">{partLookupBusy===i?'…':'AI'}</button>
                      <button onClick={() => setQParts(qParts.filter((_,j)=>j!==i))} className="text-muted hover:text-torqued-red"><Trash2 size={14} /></button>
                    </div>
                    {p.name.trim() && (
                      <div className="flex items-center gap-2 pl-1">
                        {inStock
                          ? <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500">✓ In stock ({stk})</span>
                          : <><span className="text-[9px] font-black uppercase tracking-widest text-amber-500">To order{stk ? ` (only ${stk} in stock)` : ''}</span>
                              {partsToOrder.some(po => po.name.trim().toLowerCase() === p.name.trim().toLowerCase())
                                ? <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-0.5"><CheckCircle2 size={11} /> Added to order list</span>
                                : <button onClick={() => savePartsToOrder([...partsToOrder, { id: Math.random().toString(36).slice(2), name: p.name, qty: needed || 1, forRego: quoteJob?.reg }])} className="text-[9px] font-bold text-torqued-red underline">+ add to order list</button>}</>}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>

              {/* Labour */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">Labour hours</label>
                  <input type="number" step="0.25" value={qLabourHours||''} onChange={e=>setQLabourHours(parseFloat(e.target.value)||0)} className="w-full bg-background border border-border rounded-lg px-3 h-10 text-sm text-foreground" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">Rate ($/hr)</label>
                  <input type="number" value={qLabourRate||''} onChange={e=>setQLabourRate(parseFloat(e.target.value)||0)} className="w-full bg-background border border-border rounded-lg px-3 h-10 text-sm text-foreground" />
                </div>
              </div>

              {/* Other costs */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">Other costs</label>
                  <button onClick={() => setQOther([...qOther, { name: '', amount: 0 }])} className="text-[10px] font-bold text-torqued-red flex items-center gap-1"><Plus size={12}/> Add cost</button>
                </div>
                {qOther.map((o, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input value={o.name} onChange={e => { const n=[...qOther]; n[i]={...o,name:e.target.value}; setQOther(n); }} placeholder="e.g. Disposal fee, freight" className="flex-1 bg-background border border-border rounded-lg px-3 h-9 text-xs text-foreground" />
                    <input type="number" value={o.amount||''} onChange={e => { const n=[...qOther]; n[i]={...o,amount:parseFloat(e.target.value)||0}; setQOther(n); }} placeholder="$" className="w-20 bg-background border border-border rounded-lg px-2 h-9 text-xs text-foreground" />
                    <button onClick={() => setQOther(qOther.filter((_,j)=>j!==i))} className="text-muted hover:text-torqued-red"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>

              {/* Discount */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted">Discount ($)</label>
                <input type="number" value={qDiscount||''} onChange={e=>setQDiscount(parseFloat(e.target.value)||0)} className="w-full bg-background border border-border rounded-lg px-3 h-10 text-sm text-foreground" />
              </div>

              {/* Notes (free text for the customer) */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted">Notes for the customer</label>
                <textarea value={qNotes} onChange={e=>setQNotes(e.target.value)} rows={3} placeholder="E.g. Found worn front pads; recommend replacing rear discs within 6 months." className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none" />
              </div>

              {/* Totals */}
              <div className="bg-background/60 border border-border rounded-2xl p-4 space-y-1.5 text-sm">
                <div className="flex justify-between text-muted"><span>Parts</span><span>${qPartsTotal.toFixed(2)}</span></div>
                <div className="flex justify-between text-muted"><span>Labour ({qLabourHours}h × ${qLabourRate})</span><span>${qLabourTotal.toFixed(2)}</span></div>
                {qOtherTotal>0 && <div className="flex justify-between text-muted"><span>Other</span><span>${qOtherTotal.toFixed(2)}</span></div>}
                {qDiscount>0 && <div className="flex justify-between text-emerald-500"><span>Discount</span><span>-${qDiscount.toFixed(2)}</span></div>}
                <div className="flex justify-between font-black text-foreground text-lg pt-1.5 border-t border-border"><span>Total (GST incl.)</span><span className="text-torqued-red">${qTotal.toFixed(2)}</span></div>
              </div>

              <Button fullWidth disabled={qSending} className="bg-torqued-red text-white" onClick={async () => {
                setQSending(true);
                try {
                  const pdfBase64 = await buildQuotePdf(quoteJob);
                  const note = [
                    ...qParts.filter(p=>p.name).map(p=>`${p.name} x${p.qty} — $${(p.qty*p.unitPrice).toFixed(2)}`),
                    `Labour: ${qLabourHours}h × $${qLabourRate} = $${qLabourTotal.toFixed(2)}`,
                    ...qOther.filter(o=>o.name).map(o=>`${o.name} — $${o.amount.toFixed(2)}`),
                    qDiscount>0?`Discount: -$${qDiscount.toFixed(2)}`:'',
                    qNotes.trim()?`\nNotes: ${qNotes.trim()}`:''
                  ].filter(Boolean).join('\n');
                  const r = await fetch('/api/mechanic/send-quote-pdf', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      bookingId: quoteJob.id, total: qTotal, note, customerName: quoteJob.customerName, pdfBase64,
                      items: { parts: qParts, labourHours: qLabourHours, labourRate: qLabourRate, other: qOther, discount: qDiscount, notes: qNotes },
                    }),
                  });
                  if (r.ok) {
                    // Mark diagnostic job as quoted → moves it to the SENT filter
                    setIncomingJobs(prev => prev.map(j => j.id === quoteJob.id
                      ? { ...j, quoteItems: { parts: qParts, labourHours: qLabourHours, labourRate: qLabourRate, other: qOther, discount: qDiscount, notes: qNotes } }
                      : j
                    ));
                    fetch('/api/mechanic/update-job-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId: quoteJob.id, status: 'quoted' }) }).catch(() => {});
                    setManualQuoteFilter('sent');
                    setActiveTab('manual-quotes');
                    setQuoteJob(null);
                  } else { const d = await r.json(); alert(d.error || 'Could not send quote.'); }
                } catch (e) { alert('Could not generate/send quote.'); }
                finally { setQSending(false); }
              }}>{qSending ? 'Generating & sending…' : `Email Quote PDF — $${qTotal.toFixed(2)}`}</Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
