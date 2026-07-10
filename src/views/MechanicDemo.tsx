import React, { useState } from 'react';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { useTheme } from '../context/ThemeContext';
import { cn, formatCurrency } from '../utils';
import {
  LayoutDashboard, Inbox, PenSquare, User, HeartPulse, MessageCircle,
  Calendar as CalendarIcon, Package, CreditCard, Sun, Moon, Monitor,
  Menu, X, TrendingUp, AlertCircle, Star, ChevronLeft, ChevronRight,
} from 'lucide-react';

// ============================================================================
// Demo-only mock data. Nothing here is ever read from or written to Supabase —
// this whole view is local React state that resets on refresh.
// ============================================================================

interface DemoJob {
  id: string;
  rego: string;
  vehicle: string;
  customer: string;
  service: string;
  price: number;
  date: string;
  time: string;
}

const SEED_TO_ACCEPT: DemoJob[] = [
  { id: 'ta-1', rego: 'RAH190', vehicle: '2019 Toyota Corolla', customer: 'Megan Fisher', service: 'Standard Service + WoF', price: 285, date: 'Mon, 13 Jul', time: '09:00' },
  { id: 'ta-2', rego: 'MMZ820', vehicle: '2021 Ford Ranger', customer: 'Dean Ropata', service: 'Brake Pads (Front & Rear)', price: 460, date: 'Mon, 13 Jul', time: '11:30' },
  { id: 'ta-3', rego: 'BQP442', vehicle: '2017 Subaru Outback', customer: 'Aroha Wilson', service: 'Warrant of Fitness', price: 75, date: 'Tue, 14 Jul', time: '08:30' },
];

const SEED_UPCOMING: DemoJob[] = [
  { id: 'up-1', rego: 'JTX501', vehicle: '2020 Mazda CX-5', customer: 'Liam O\'Connell', service: 'Full Service', price: 340, date: 'Wed, 15 Jul', time: '10:00' },
];

interface DemoPart { name: string; price: number; }
interface DemoQuote {
  id: string;
  rego: string;
  vehicle: string;
  customer: string;
  parts: DemoPart[];
  labourHours: number;
  labourRate: number;
  shopFee: number;
}

const SEED_TO_BE_QUOTED: DemoQuote[] = [
  {
    id: 'q-1', rego: 'HZR372', vehicle: '2016 Holden Commodore', customer: 'Priya Nair',
    parts: [{ name: 'Alternator', price: 320 }, { name: 'Drive belt', price: 45 }],
    labourHours: 1.5, labourRate: 145, shopFee: 25,
  },
  {
    id: 'q-2', rego: 'WKT218', vehicle: '2015 Nissan Navara', customer: 'Grant Ellison',
    parts: [{ name: 'Clutch kit', price: 480 }],
    labourHours: 4, labourRate: 145, shopFee: 25,
  },
];

const SEED_QUOTED: DemoQuote[] = [
  {
    id: 'q-3', rego: 'PLM905', vehicle: '2018 Kia Sportage', customer: 'Tania Marsh',
    parts: [{ name: 'Rear shock absorbers (pair)', price: 260 }],
    labourHours: 2, labourRate: 145, shopFee: 25,
  },
];

const quoteTotal = (q: DemoQuote) =>
  q.parts.reduce((s, p) => s + p.price, 0) + q.labourHours * q.labourRate + q.shopFee;

const DEMO_CUSTOMERS = [
  { name: 'Megan Fisher', email: 'megan.fisher@example.co.nz', phone: '021 334 8821', regos: 'RAH190' },
  { name: 'Dean Ropata', email: 'dean.r@example.co.nz', phone: '027 118 4432', regos: 'MMZ820' },
  { name: 'Aroha Wilson', email: 'aroha.w@example.co.nz', phone: '022 559 0071', regos: 'BQP442' },
  { name: "Liam O'Connell", email: 'liam.oc@example.co.nz', phone: '021 887 2210', regos: 'JTX501' },
  { name: 'Priya Nair', email: 'priya.nair@example.co.nz', phone: '027 441 9932', regos: 'HZR372' },
  { name: 'Grant Ellison', email: 'grant.e@example.co.nz', phone: '021 665 3387', regos: 'WKT218' },
];

type Severity = 'good' | 'due' | 'overdue' | 'info';
const DEMO_VEHICLE = { rego: 'RAH190', vehicle: '2019 Toyota Corolla GX' };
const DEMO_HEALTH: { severity: Severity; title: string; detail: string }[] = [
  { severity: 'good', title: 'Oil & Filter', detail: 'Changed 3,200km ago — next due around 10,000km.' },
  { severity: 'due', title: 'Front Brake Pads', detail: '3mm remaining — due within the next 1,000km.' },
  { severity: 'overdue', title: 'Warrant of Fitness', detail: 'Expired 12 days ago.' },
  { severity: 'info', title: 'Timing Chain', detail: 'Last inspected at 90,000km — chain-driven, no scheduled replacement.' },
];

const severityStyle: Record<Severity, string> = {
  good: 'border-emerald-500/20 bg-emerald-500/5',
  due: 'border-amber-500/20 bg-amber-500/5',
  overdue: 'border-torqued-red/30 bg-torqued-red/5',
  info: 'border-border bg-card',
};
const severityText: Record<Severity, string> = {
  good: 'text-emerald-600 dark:text-emerald-400',
  due: 'text-amber-600 dark:text-amber-400',
  overdue: 'text-torqued-red',
  info: 'text-foreground',
};
const severityIcon: Record<Severity, string> = { good: '✓', due: '🔔', overdue: '⚠', info: 'ℹ' };

const DEMO_PARTS = [
  { name: 'Oil filter (standard)', qty: 14, price: 18 },
  { name: 'Brake pads — front set', qty: 6, price: 65 },
  { name: '5W-30 synthetic oil (5L)', qty: 9, price: 62 },
  { name: 'Cabin air filter', qty: 3, price: 24 },
  { name: 'Spark plug (set of 4)', qty: 5, price: 48 },
];

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16];

interface DemoAppt { id: string; day: number; hour: number; label: string; type: 'maintenance' | 'repair' | 'other'; }
const SEED_APPOINTMENTS: DemoAppt[] = [
  { id: 'ap-1', day: 0, hour: 9, label: 'RAH190 — Standard Service', type: 'maintenance' },
  { id: 'ap-2', day: 1, hour: 11, label: 'MMZ820 — Brake Pads', type: 'repair' },
  { id: 'ap-3', day: 2, hour: 8, label: 'BQP442 — WoF', type: 'other' },
];
const apptColor: Record<DemoAppt['type'], string> = {
  maintenance: 'bg-blue-500', repair: 'bg-torqued-red', other: 'bg-emerald-500',
};

const SIDEBAR_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'jobs', label: 'My Jobs', icon: Inbox },
  { id: 'manual-quotes', label: 'Manual Quotes', icon: PenSquare },
  { id: 'customers', label: 'Customers', icon: User },
  { id: 'vehicle-health', label: 'Vehicle Health', icon: HeartPulse },
  { id: 'assistant', label: 'Assistant', icon: MessageCircle },
  { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
  { id: 'parts', label: 'Parts', icon: Package },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'profile', label: 'Profile', icon: User },
] as const;

export const MechanicDemo: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { theme, setTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2600); };

  // My Jobs
  const [toAccept, setToAccept] = useState<DemoJob[]>(SEED_TO_ACCEPT);
  const [upcoming, setUpcoming] = useState<DemoJob[]>(SEED_UPCOMING);
  const [jobsSubtab, setJobsSubtab] = useState<'accept' | 'upcoming'>('accept');
  const acceptJob = (id: string) => {
    const job = toAccept.find(j => j.id === id);
    if (!job) return;
    setToAccept(prev => prev.filter(j => j.id !== id));
    setUpcoming(prev => [...prev, job]);
    showToast('Job accepted (demo — nothing was saved)');
  };

  // Manual Quotes
  const [toBeQuoted, setToBeQuoted] = useState<DemoQuote[]>(SEED_TO_BE_QUOTED);
  const [quoted, setQuoted] = useState<DemoQuote[]>(SEED_QUOTED);
  const [quoteFilter, setQuoteFilter] = useState<'queue' | 'sent'>('queue');
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const updateQuoteField = (id: string, field: 'labourHours' | 'labourRate', value: number) => {
    setToBeQuoted(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q));
  };
  const sendQuote = (id: string) => {
    const q = toBeQuoted.find(x => x.id === id);
    if (!q) return;
    setToBeQuoted(prev => prev.filter(x => x.id !== id));
    setQuoted(prev => [...prev, q]);
    setEditingQuoteId(null);
    showToast('Quote "sent" — demo mode, nothing was emailed');
  };

  // Calendar
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('week');
  const [dayIndex, setDayIndex] = useState(0);
  const [appointments, setAppointments] = useState<DemoAppt[]>(SEED_APPOINTMENTS);
  const addAppointment = (day: number, hour: number) => {
    const label = window.prompt('Add a demo booking (e.g. "Oil Change — Mazda 3")');
    if (!label) return;
    setAppointments(prev => [...prev, { id: `ap-${Date.now()}`, day, hour, label, type: 'other' }]);
  };

  const navBtn = (active: boolean) => cn(
    'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold uppercase tracking-wider text-xs',
    active ? 'bg-torqued-red text-white' : 'text-muted hover:bg-card hover:text-foreground'
  );

  // ---- Tab renderers ----

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4"><p className="text-[10px] uppercase font-black text-muted">Today's Jobs</p><p className="text-2xl font-black text-foreground mt-1">2</p></Card>
        <Card className="p-4"><p className="text-[10px] uppercase font-black text-muted">Revenue (7d, net)</p><p className="text-2xl font-black text-foreground mt-1">{formatCurrency(2140)}</p></Card>
        <Card className="p-4"><p className="text-[10px] uppercase font-black text-muted">Pending</p><p className="text-2xl font-black text-foreground mt-1">{toAccept.length}</p></Card>
        <Card className="p-4 bg-torqued-red text-white"><p className="text-[10px] uppercase font-black text-white/70">Couriers Today</p><p className="text-2xl font-black mt-1">1</p></Card>
      </div>
      <Card className="p-6 space-y-3">
        <p className="text-sm font-black uppercase tracking-widest text-muted">Today's Schedule</p>
        {upcoming.concat(toAccept.slice(0, 1)).map(j => (
          <div key={j.id} className="flex items-center justify-between text-sm bg-background border border-border rounded-xl px-4 py-3">
            <span className="font-bold text-foreground">{j.time} · {j.rego}</span>
            <span className="text-muted">{j.service}</span>
          </div>
        ))}
      </Card>
    </div>
  );

  const renderMyJobs = () => (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-black tracking-tight text-foreground">My Jobs</h2><p className="text-sm text-muted">A couple of demo jobs — accept one to see it move to Upcoming.</p></div>
      <div className="flex gap-2">
        {([['accept', `To Accept (${toAccept.length})`], ['upcoming', `Upcoming (${upcoming.length})`]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setJobsSubtab(id)} className={cn('px-4 h-9 rounded-xl text-xs font-black uppercase tracking-wider transition-all', jobsSubtab === id ? 'bg-torqued-red text-white' : 'bg-card border border-border text-muted hover:text-foreground')}>{label}</button>
        ))}
      </div>
      <div className="space-y-3">
        {(jobsSubtab === 'accept' ? toAccept : upcoming).length === 0 && (
          <Card className="p-8 text-center text-sm text-muted italic">Nothing here right now.</Card>
        )}
        {(jobsSubtab === 'accept' ? toAccept : upcoming).map(j => (
          <Card key={j.id} className="p-4 sm:p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span className="torqued-badge text-[10px]">{j.rego}</span>
                <p className="font-black text-foreground">{j.customer}</p>
                <p className="text-xs text-muted">{j.vehicle}</p>
                <p className="text-xs text-muted">{j.service} · {j.date} at {j.time}</p>
              </div>
              <span className="font-black text-torqued-red text-lg shrink-0">{formatCurrency(j.price)}</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
              {jobsSubtab === 'accept' ? (
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => acceptJob(j.id)}>Accept Job</Button>
              ) : (
                <>
                  <Button size="sm" variant="outline" className="border-border text-foreground" onClick={() => showToast('Demo mode — no real message sent')}>Message Customer</Button>
                  <Button size="sm" variant="outline" className="border-border text-foreground" onClick={() => showToast('Demo mode — nothing exported')}>Export Invoice</Button>
                </>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderManualQuotes = () => {
    const list = quoteFilter === 'queue' ? toBeQuoted : quoted;
    return (
      <div className="space-y-6">
        <div><h2 className="text-2xl font-black tracking-tight text-foreground">Manual Quotes</h2><p className="text-sm text-muted">Build a demo quote and "send" it — nothing leaves this page.</p></div>
        <div className="flex gap-2">
          {([['queue', 'To Be Quoted', toBeQuoted.length], ['sent', 'Quoted', quoted.length]] as const).map(([id, label, count]) => (
            <button key={id} onClick={() => setQuoteFilter(id)} className={cn('px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all', quoteFilter === id ? 'bg-torqued-red text-white shadow' : 'text-muted hover:text-foreground bg-card border border-border')}>
              {label} <span className="ml-1.5 bg-white/20 text-inherit px-1.5 py-0.5 rounded-full">{count}</span>
            </button>
          ))}
        </div>
        <div className="space-y-4">
          {list.length === 0 && <Card className="p-8 text-center text-sm text-muted italic">Nothing here right now.</Card>}
          {list.map(q => {
            const total = quoteTotal(q);
            const editing = editingQuoteId === q.id;
            return (
              <Card key={q.id} className={cn('p-6 space-y-4', quoteFilter === 'sent' && 'border-emerald-500/30')}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="torqued-badge text-[10px]">{q.rego}</span>
                    <p className="text-xl font-bold text-foreground mt-1">{q.customer}</p>
                    <p className="text-xs text-muted">{q.vehicle}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] uppercase font-black text-muted">{quoteFilter === 'sent' ? 'Quoted Price' : 'Suggested Quote'}</p>
                    <p className="text-2xl font-black text-torqued-red">{formatCurrency(total)}</p>
                  </div>
                </div>
                <div className="text-xs text-muted space-y-1 border-t border-border pt-3">
                  {q.parts.map((p, i) => (
                    <div key={i} className="flex justify-between"><span className="text-foreground">{p.name}</span><span>{formatCurrency(p.price)}</span></div>
                  ))}
                  {editing ? (
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-foreground">Labour (hrs @ $/hr)</span>
                      <span className="flex items-center gap-1">
                        <input type="number" value={q.labourHours} onChange={e => updateQuoteField(q.id, 'labourHours', parseFloat(e.target.value) || 0)} className="w-14 bg-background border border-border rounded px-1 py-0.5 text-foreground text-xs" />
                        <span>@</span>
                        <input type="number" value={q.labourRate} onChange={e => updateQuoteField(q.id, 'labourRate', parseFloat(e.target.value) || 0)} className="w-16 bg-background border border-border rounded px-1 py-0.5 text-foreground text-xs" />
                      </span>
                    </div>
                  ) : (
                    <div className="flex justify-between"><span className="text-foreground">Labour ({q.labourHours}h @ {formatCurrency(q.labourRate)})</span><span>{formatCurrency(q.labourHours * q.labourRate)}</span></div>
                  )}
                  <div className="flex justify-between"><span className="text-foreground">Shop fee</span><span>{formatCurrency(q.shopFee)}</span></div>
                </div>
                {quoteFilter === 'queue' && (
                  <div className="flex gap-2 pt-2 border-t border-border">
                    {editing ? (
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => sendQuote(q.id)}>Send Quote (Demo — not actually sent)</Button>
                    ) : (
                      <Button size="sm" variant="outline" className="border-border text-foreground" onClick={() => setEditingQuoteId(q.id)}>Write / Build Quote</Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  const renderCustomers = () => (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-black tracking-tight text-foreground">Customers</h2><p className="text-sm text-muted">A few example customers — the demo doesn't support adding or editing.</p></div>
      <div className="space-y-2">
        {DEMO_CUSTOMERS.map(c => (
          <Card key={c.email} className="p-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-bold text-foreground">{c.name}</p>
              <p className="text-xs text-muted">{c.email} · {c.phone} · {c.regos}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderVehicleHealth = () => (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-black tracking-tight text-foreground">Vehicle Health Lookup</h2><p className="text-sm text-muted">Demo vehicle — {DEMO_VEHICLE.rego} · {DEMO_VEHICLE.vehicle}</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {DEMO_HEALTH.map((h, i) => (
          <Card key={i} className={cn('p-4 flex items-start gap-3', severityStyle[h.severity])}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-base font-bold bg-background">{severityIcon[h.severity]}</div>
            <div>
              <p className={cn('text-sm font-bold leading-tight', severityText[h.severity])}>{h.title}</p>
              <p className="text-xs text-muted mt-0.5 leading-snug">{h.detail}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderAssistant = () => (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-black tracking-tight text-foreground">Assistant</h2><p className="text-sm text-muted">Ask about parts, pricing, or diagnostics — this demo shows example answers only.</p></div>
      <Card className="p-6 space-y-4">
        <div className="bg-background border border-border rounded-2xl px-4 py-3 text-sm max-w-md">"What's the oil capacity for a 2019 Corolla?"</div>
        <div className="bg-torqued-red/5 border border-torqued-red/20 rounded-2xl px-4 py-3 text-sm max-w-md ml-auto text-right">4.2L of 0W-20 — plus a filter, ~$95 in parts at current market pricing.</div>
        <div className="bg-background border border-border rounded-2xl px-4 py-3 text-sm max-w-md">"Ballpark a clutch job on a 2015 Navara?"</div>
        <div className="bg-torqued-red/5 border border-torqued-red/20 rounded-2xl px-4 py-3 text-sm max-w-md ml-auto text-right">Around {formatCurrency(1050)} all-in at your labour rate — clutch kit plus ~4 hours.</div>
      </Card>
    </div>
  );

  const renderCalendar = () => (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-black tracking-tight text-foreground">Workshop Calendar</h2><p className="text-sm text-muted">Click an empty slot to drop in a demo booking.</p></div>
      <div className="flex gap-2">
        {(['day', 'week', 'month'] as const).map(v => (
          <button key={v} onClick={() => setCalendarView(v)} className={cn('px-6 py-2 rounded-lg text-xs font-bold uppercase transition-all', calendarView === v ? 'bg-torqued-red text-white' : 'text-muted hover:bg-card bg-background border border-border')}>{v}</button>
        ))}
      </div>

      {calendarView === 'week' && (
        <Card className="p-0 overflow-hidden overflow-x-auto">
          <div className="grid grid-cols-8 min-w-[720px]">
            <div className="border-r border-b border-border bg-foreground/5" />
            {DAY_LABELS.map((d, i) => (
              <div key={d} className="px-2 py-3 text-center border-r border-b border-border last:border-r-0">
                <p className="text-[10px] font-bold uppercase text-muted">{d}</p>
                <p className="text-[9px] font-black text-torqued-red mt-0.5">{appointments.filter(a => a.day === i).length} on</p>
              </div>
            ))}
            {HOURS.map(h => (
              <React.Fragment key={h}>
                <div className="border-r border-b border-border px-2 py-3 text-[10px] font-bold text-muted/60 text-right">{h}:00</div>
                {DAY_LABELS.map((_, dayIdx) => {
                  const appt = appointments.find(a => a.day === dayIdx && a.hour === h);
                  return (
                    <div key={dayIdx} onClick={() => !appt && addAppointment(dayIdx, h)} className="border-r border-b border-border last:border-r-0 min-h-[52px] p-1 cursor-pointer hover:bg-foreground/[0.03] transition-colors">
                      {appt ? (
                        <div className={cn('rounded-lg px-2 py-1 text-white text-[10px] font-bold leading-tight', apptColor[appt.type])}>{appt.label}</div>
                      ) : (
                        <span className="text-[10px] text-muted/30 block text-center">+</span>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </Card>
      )}

      {calendarView === 'day' && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setDayIndex(i => (i + 6) % 7)} className="p-2 hover:bg-background rounded-full"><ChevronLeft size={18} /></button>
            <p className="font-bold text-foreground">{DAY_LABELS[dayIndex]}</p>
            <button onClick={() => setDayIndex(i => (i + 1) % 7)} className="p-2 hover:bg-background rounded-full"><ChevronRight size={18} /></button>
          </div>
          <div className="space-y-2">
            {HOURS.map(h => {
              const appt = appointments.find(a => a.day === dayIndex && a.hour === h);
              return (
                <div key={h} onClick={() => !appt && addAppointment(dayIndex, h)} className="flex items-center gap-4 p-3 rounded-xl border border-border hover:bg-background cursor-pointer transition-colors">
                  <span className="w-14 text-sm font-bold text-muted">{h}:00</span>
                  {appt ? (
                    <span className={cn('flex-1 rounded-lg px-3 py-1.5 text-white text-xs font-bold', apptColor[appt.type])}>{appt.label}</span>
                  ) : (
                    <span className="flex-1 text-xs text-muted/50">+ Add booking</span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {calendarView === 'month' && (
        <Card className="p-6 space-y-3">
          <p className="text-sm text-muted">Demo month view — click a day to jump to it.</p>
          <div className="grid grid-cols-7 gap-2">
            {DAY_LABELS.map((d, i) => (
              <button key={d} onClick={() => { setDayIndex(i); setCalendarView('day'); }} className="p-4 rounded-xl border border-border hover:border-torqued-red/40 transition-all text-center">
                <p className="text-xs font-bold text-foreground">{d}</p>
                <p className="text-[10px] text-torqued-red font-black mt-1">{appointments.filter(a => a.day === i).length} booked</p>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );

  const renderParts = () => (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-black tracking-tight text-foreground">Parts Inventory</h2><p className="text-sm text-muted">Example stock — read-only in this demo.</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4 flex items-center gap-3"><Package className="text-torqued-red" size={20} /><div><p className="text-[10px] uppercase font-black text-muted">Stock Value</p><p className="font-black text-foreground">{formatCurrency(DEMO_PARTS.reduce((s, p) => s + p.qty * p.price, 0))}</p></div></Card>
        <Card className="p-4 flex items-center gap-3"><AlertCircle className="text-amber-500" size={20} /><div><p className="text-[10px] uppercase font-black text-muted">Low Stock</p><p className="font-black text-foreground">1 item</p></div></Card>
        <Card className="p-4 flex items-center gap-3"><TrendingUp className="text-emerald-500" size={20} /><div><p className="text-[10px] uppercase font-black text-muted">Distinct Parts</p><p className="font-black text-foreground">{DEMO_PARTS.length}</p></div></Card>
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-background text-[10px] uppercase font-black text-muted"><tr><th className="text-left p-3">Part</th><th className="text-left p-3">Qty</th><th className="text-left p-3">Unit Price</th><th className="text-left p-3">Total Value</th></tr></thead>
          <tbody>
            {DEMO_PARTS.map(p => (
              <tr key={p.name} className="border-t border-border">
                <td className="p-3 text-foreground font-bold">{p.name}</td>
                <td className={cn('p-3', p.qty <= 3 ? 'text-torqued-red font-bold' : 'text-muted')}>{p.qty}</td>
                <td className="p-3 text-muted">{formatCurrency(p.price)}</td>
                <td className="p-3 text-foreground font-bold">{formatCurrency(p.qty * p.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );

  const renderPayments = () => (
    <div className="flex items-center justify-center py-24">
      <p className="text-muted text-sm text-center max-w-sm">You'll see your revenue and subscription information here.</p>
    </div>
  );

  const renderProfile = () => (
    <div className="flex items-center justify-center py-24">
      <p className="text-muted text-sm text-center max-w-sm">You'll be able to manage your profile, and log-in details here.</p>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return renderDashboard();
      case 'jobs': return renderMyJobs();
      case 'manual-quotes': return renderManualQuotes();
      case 'customers': return renderCustomers();
      case 'vehicle-health': return renderVehicleHealth();
      case 'assistant': return renderAssistant();
      case 'calendar': return renderCalendar();
      case 'parts': return renderParts();
      case 'payments': return renderPayments();
      case 'profile': return renderProfile();
      default: return renderDashboard();
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row transition-colors duration-300 overflow-x-hidden">
      {/* Mobile Header */}
      <div className="md:hidden p-4 border-b border-border flex justify-between items-center bg-background sticky top-0 z-50">
        <Logo />
        <button onClick={() => setIsMobileMenuOpen(v => !v)} className="p-2 text-foreground">
          {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        'w-full md:w-72 bg-background/50 backdrop-blur-2xl text-foreground flex flex-col fixed md:sticky top-[64px] md:top-0 h-[calc(100vh-64px)] md:h-screen border-r border-border z-40 transition-transform md:translate-x-0',
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="p-8 border-b border-border h-24 hidden md:flex items-center"><Logo /></div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {SIDEBAR_ITEMS.map(item => {
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }} className={navBtn(activeTab === item.id)}>
                <Icon size={16} /> {item.label}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border space-y-3">
          <div className="p-4 bg-card rounded-xl border border-border space-y-2">
            <p className="font-black text-sm text-foreground">Reclaim your time with Torqued.</p>
            <p className="text-[11px] text-muted leading-relaxed">Torqued turns a rego plate into an itemised quote in seconds — based on your labour rates and market-backed parts' pricing.</p>
            <Button fullWidth size="sm" className="bg-torqued-red hover:bg-red-700 text-white text-[10px]" onClick={() => { window.location.href = '/mechanic'; }}>
              Create a Real Account — 90-Day Risk-Free Trial
            </Button>
          </div>
          {onBack && (
            <button onClick={onBack} className="w-full text-[10px] font-bold text-muted hover:text-foreground tracking-widest uppercase text-center py-1">
              ← Back to torqued.site
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto overflow-x-hidden min-w-0 bg-background">
        <div className="mb-6 flex items-start gap-3 bg-torqued-red/5 border border-torqued-red/20 rounded-2xl px-5 py-4">
          <Star size={18} className="text-torqued-red shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm text-foreground">
            <span className="font-black uppercase tracking-wide text-torqued-red">Demo mode</span> — this is a hypothetical workshop with made-up data. Nothing you do here is saved, and refreshing resets everything.
          </p>
        </div>
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-4xl text-foreground tracking-tighter font-bold capitalize">{SIDEBAR_ITEMS.find(i => i.id === activeTab)?.label || 'Dashboard'}</h1>
          <div className="flex gap-1 bg-card border border-border rounded-lg p-1">
            <button onClick={() => setTheme('light')} className={cn('p-2 rounded-lg transition-all', theme === 'light' ? 'bg-torqued-red text-white' : 'text-muted hover:text-foreground')}><Sun size={14} /></button>
            <button onClick={() => setTheme('dark')} className={cn('p-2 rounded-lg transition-all', theme === 'dark' ? 'bg-torqued-red text-white' : 'text-muted hover:text-foreground')}><Moon size={14} /></button>
            <button onClick={() => setTheme('system')} className={cn('p-2 rounded-lg transition-all', theme === 'system' ? 'bg-torqued-red text-white' : 'text-muted hover:text-foreground')}><Monitor size={14} /></button>
          </div>
        </div>
        {renderContent()}
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] bg-foreground text-background px-5 py-3 rounded-xl shadow-2xl text-sm font-bold">
          {toast}
        </div>
      )}
    </div>
  );
};
