import React, { useState, useMemo, useRef } from 'react';
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
  HeartPulse,
  LogOut,
  Link2,
  Copy
} from 'lucide-react';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { VehicleTimelineAnalysis } from '../components/VehicleTimelineAnalysis';
import { PrePurchaseInspection } from '../components/PrePurchaseInspection';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { formatCurrency, calculateGST, cn } from '../utils';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { authPasskey, registerPasskey, passkeysSupported, hasPasskey } from '../lib/passkey';
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

const MECH_DARK = {
  '--color-background': '#150402',
  '--color-foreground': '#ffffff',
  '--color-card': 'rgba(255,255,255,0.06)',
  '--color-border': 'rgba(255,255,255,0.12)',
  '--color-muted': 'rgba(255,255,255,0.55)',
} as React.CSSProperties;

// Short job title from quote parts/notes when there are no standard service ids.
// Format a Date as YYYY-MM-DD using LOCAL components (avoids UTC shift from toISOString in +12 NZ).
function localISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function jobSummaryTitle(j: any): string {
  if ((j?.service_ids || []).includes('ppi')) return 'Pre-Purchase Inspection';
  const qi = j?.quote_items || j?.quoteItems;
  const parts: string[] = Array.isArray(qi?.parts) ? qi.parts.filter((p: any) => p?.name).map((p: any) => String(p.name)) : [];
  const text = (parts.join(' ') + ' ' + (qi?.notes || '') + ' ' + (j?.description || '') + ' ' + (j?.services?.join(' ') || '')).toLowerCase();
  if (/pre.?purchase|ppi/.test(text)) return 'Pre-Purchase Inspection';
  const cats: [RegExp, string][] = [
    [/brake|rotor|caliper|pad|disc/, 'Brake Service'],
    [/control arm|bush|suspension|strut|shock|ball joint|tie rod/, 'Suspension Repair'],
    [/clutch|flywheel/, 'Clutch Repair'],
    [/cambelt|timing belt|timing chain/, 'Cambelt Service'],
    [/spark plug|ignition coil/, 'Spark Plugs & Ignition'],
    [/oil|filter|service/, 'Vehicle Service'],
    [/battery|alternator|starter/, 'Electrical Repair'],
    [/radiator|coolant|water pump|thermostat/, 'Cooling System Repair'],
    [/transmission|gearbox/, 'Transmission Service'],
    [/exhaust|muffler|catalytic/, 'Exhaust Repair'],
  ];
  for (const [re, label] of cats) if (re.test(text)) return label;
  if (parts.length === 1) return parts[0];
  if (parts.length > 1) return `${parts[0]} + ${parts.length - 1} more`;
  return 'Custom Quote';
}

export const MechanicPortal: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { theme, setTheme } = useTheme();
  const { user, userProfile, isAuthReady, loginMechanic, signUpMechanic, resendMechanicLink, markSubscriptionActive, logout, updateProfile } = useAuth();
  const [mechEmail, setMechEmail] = useState('');
  const [mechPassword, setMechPassword] = useState('');
  const [mechName, setMechName] = useState('');
  const [mechAuthError, setMechAuthError] = useState<string | null>(null);
  const [mechAuthLoading, setMechAuthLoading] = useState(false);
  const [mechSignupSent, setMechSignupSent] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [subPromo, setSubPromo] = useState('');
  const [subPromoError, setSubPromoError] = useState<string | null>(null);
  const [subPromoLoading, setSubPromoLoading] = useState(false);
  // Local override: once activated this session, unlock the dashboard regardless of
  // userProfile load timing (which could be null and silently block the unlock).
  const [justActivated, setJustActivated] = useState(false);
  // Onboarding wizard
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  // Separate from onboardingComplete: admin-onboarded accounts start with
  // onboarding_complete already true (business details pre-filled by admin) but
  // still need to sign the contract themselves on first login.
  const [agreementSigned, setAgreementSigned] = useState(true);
  const [obStep, setObStep] = useState(0);
  const [obSaving, setObSaving] = useState(false);
  const [ob, setOb] = useState<{
    name: string; legal_name: string; nzbn: string; address: string; phone: string;
    owner_name: string; owner_phone: string; years_in_trade: string; bio: string;
    bank_account_name: string; bank_account_number: string; labour_rate: number;
    technicians: number; parts_lead_days: number; billing_start_date: string;
    signer_title: string; gst_number: string; wants_wof: boolean;
  }>({
    name: '', legal_name: '', nzbn: '', address: '', phone: '', owner_name: '', owner_phone: '',
    years_in_trade: '', bio: '',
    bank_account_name: '', bank_account_number: '', labour_rate: 145, technicians: 1, parts_lead_days: 1,
    billing_start_date: (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })(),
    signer_title: '', gst_number: '', wants_wof: false,
  });
  // OTP email verification (step 0)
  const [obEmail, setObEmail] = useState('');
  const [obOtpSent, setObOtpSent] = useState(false);
  const [obOtp, setObOtp] = useState('');
  const [obOtpVerified, setObOtpVerified] = useState(false);
  const [obOtpError, setObOtpError] = useState('');
  const [obOtpLoading, setObOtpLoading] = useState(false);
  // Address autocomplete (onboarding)
  const [addrSuggestions, setAddrSuggestions] = useState<{ display_name: string }[]>([]);
  const [addrTimer, setAddrTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  // Address autocomplete (profile / Workshop Location card)
  const [profileAddrSuggestions, setProfileAddrSuggestions] = useState<{ display_name: string }[]>([]);
  const profileAddrTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/mechanic/onboarding-status?id=${user.id}`)
      .then(r => r.json())
      .then(d => {
        setOnboardingComplete(!!d.complete);
        setAgreementSigned(!!d.agreementSigned);
        if (!d.complete) {
          setOb(o => ({ ...o, name: user.user_metadata?.name || o.name }));
        } else if (!d.agreementSigned && d.profile) {
          // Admin-onboarded account: business details are already filled in — only
          // the contract-signing step is outstanding, so jump straight to it.
          setOb(o => ({
            ...o,
            name: d.profile.name || o.name, legal_name: d.profile.legal_name || o.legal_name,
            address: d.profile.address || o.address, nzbn: d.profile.nzbn || o.nzbn,
            owner_name: d.profile.owner_name || o.owner_name, owner_phone: d.profile.owner_phone || o.owner_phone,
            phone: d.profile.phone || o.phone, years_in_trade: d.profile.years_in_trade ? String(d.profile.years_in_trade) : o.years_in_trade,
          }));
          setObStep(4);
        }
      })
      .catch(() => { setOnboardingComplete(true); setAgreementSigned(true); });
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
  // Staff roster
  type RosterStaff = { id: string; name: string; role?: string | null };
  type RosterShift = { id: string; staff_id: string; shift_date: string; start_time: string; end_time: string; break_start?: string | null; break_end?: string | null };
  const [rosterStaff, setRosterStaff] = useState<RosterStaff[]>([]);
  const [rosterShifts, setRosterShifts] = useState<RosterShift[]>([]);
  const [rosterLoaded, setRosterLoaded] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('');
  const [rosterWeekStart, setRosterWeekStart] = useState<string>(() => {
    const d = new Date(); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day);
    return localISO(d);
  });
  const [shiftModal, setShiftModal] = useState<{ date: string; staffId: string; startTime: string; endTime: string; breakStart: string; breakEnd: string } | null>(null);
  const [newClosedPeriod, setNewClosedPeriod] = useState({ startDate: '', endDate: '', reason: '' });
  const [ohSaving, setOhSaving] = useState(false);
  const [ohStatus, setOhStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [ohError, setOhError] = useState<string | null>(null);
  const [closedSaving, setClosedSaving] = useState(false);
  const [closedError, setClosedError] = useState<string | null>(null);
  const [closedSuccess, setClosedSuccess] = useState(false);
  const [capSaveStatus, setCapSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [profileSaveStatus, setProfileSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [addressUpdateStatus, setAddressUpdateStatus] = useState<'idle' | 'updating' | 'updated' | 'error'>('idle');
  const [mechLocating, setMechLocating] = useState(false);
  const [portalLoading, setPortalLoading] = useState(true);
  const [capSaveError, setCapSaveError] = useState<string | null>(null);
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
  const [qShopFee, setQShopFee] = useState(0);
  const [qLeadTimeDays, setQLeadTimeDays] = useState(0);
  const [qNotes, setQNotes] = useState('');
  // Parts-to-order is cached locally PER MECHANIC so one workshop never sees another's
  // list on a shared browser. Keyed by the signed-in user's id.
  const [partsToOrder, setPartsToOrder] = useState<{ id: string; name: string; qty: number; forRego?: string }[]>([]);
  const partsKey = user?.id ? `torqued_parts_to_order_${user.id}` : null;
  useEffect(() => {
    // Drop any legacy global cache so it can't leak between accounts.
    try { localStorage.removeItem('torqued_parts_to_order'); } catch {}
    if (!partsKey) { setPartsToOrder([]); return; }
    try { setPartsToOrder(JSON.parse(localStorage.getItem(partsKey) || '[]')); } catch { setPartsToOrder([]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  const savePartsToOrder = (list: typeof partsToOrder) => {
    setPartsToOrder(list);
    if (partsKey) { try { localStorage.setItem(partsKey, JSON.stringify(list)); } catch {} }
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
      setQShopFee(qi.shopFee ?? profileData.shopFee ?? 25);
      setQLeadTimeDays(qi.leadTimeDays ?? 0);
      setQDiscount(qi.discount ?? 0);
      setQOther(Array.isArray(qi.other) ? qi.other : []);
      setQNotes(qi.notes ?? '');
    } else {
      setQParts([{ name: '', qty: 1, unitPrice: 0 }]);
      setQLabourHours(1);
      setQLabourRate(profileData.labourRate || 145);
      setQShopFee(profileData.shopFee ?? 25);
      setQLeadTimeDays(0);
      setQDiscount(0);
      setQOther([]);
      setQNotes('');
    }
  };
  const qPartsTotal = qParts.reduce((s, p) => s + (p.qty || 0) * (p.unitPrice || 0), 0);
  const qLabourTotal = (qLabourHours || 0) * (qLabourRate || 0);
  const qOtherTotal = qOther.reduce((s, o) => s + (o.amount || 0), 0);
  const qTotal = Math.max(0, qPartsTotal + qLabourTotal + qOtherTotal + (qShopFee || 0) - (qDiscount || 0));

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
    if (logo) doc.addImage(logo, 'PNG', 15, 8, 52, 17.4);
    doc.setFillColor(255, 24, 0); doc.rect(0, 30, 210, 2, 'F');
    doc.setTextColor(21, 4, 2); doc.setFont('Helvetica', 'bold'); doc.setFontSize(11); doc.text('WEEKLY REVENUE REPORT', 195, 16, { align: 'right' });
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(80, 80, 80);
    doc.text(`${start.toLocaleDateString('en-NZ')} – ${end.toLocaleDateString('en-NZ')}`, 195, 22, { align: 'right' });
    doc.text(profileData.name || 'Workshop', 195, 27, { align: 'right' });
    let y = 44; doc.setTextColor(21, 4, 2); doc.setFontSize(9);
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
    let parts = Array.isArray(qi.parts) ? qi.parts.filter((p: any) => p.name) : [];
    const labourTotal = (qi.labourHours || 0) * (qi.labourRate || 0);
    const otherList = Array.isArray(qi.other) ? qi.other.filter((o: any) => o.name) : [];
    const total = parseFloat(job.quoted_price ?? job.total_price) || 0;

    // Older/manually-created bookings don't always carry a quote_items breakdown.
    // Rather than print blank prices next to each service, re-derive per-service
    // prices from live fleet pricing (or split the known total evenly) so every
    // invoice is always itemised.
    if (parts.length === 0 && labourTotal === 0 && (job.service_ids || []).length > 0) {
      const svcIds: string[] = job.service_ids;
      const svcNames = svcIds.map((id: string) => SERVICES.find(s => s.id === id)?.name || id);
      let priced: Record<string, any> = {};
      if (job.vehicle_rego) {
        try {
          const r = await fetch(`/api/fleet-prices?rego=${encodeURIComponent(job.vehicle_rego)}`);
          if (r.ok) priced = await r.json();
        } catch { /* fall through to even split below */ }
      }
      const known = svcIds.map(id => priced?.[id]?.high).filter((n: any) => typeof n === 'number' && n > 0);
      const knownSum = known.reduce((s: number, n: number) => s + n, 0);
      const unknownCount = svcIds.length - known.length;
      const remainder = Math.max(0, total - knownSum);
      parts = svcIds.map((id: string, i: number) => {
        const fp = priced?.[id]?.high;
        const unitPrice = (typeof fp === 'number' && fp > 0) ? fp : (unknownCount > 0 ? remainder / unknownCount : 0);
        return { name: svcNames[i], qty: 1, unitPrice };
      });
    }
    const isPaid = job.payment_status === 'confirmed';
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const logo = await fetchDataUrl('/torqued-logo.png');
    if (logo) doc.addImage(logo, 'PNG', 15, 8, 52, 17.4);
    doc.setFillColor(255, 24, 0); doc.rect(0, 30, 210, 2, 'F');
    doc.setTextColor(21, 4, 2); doc.setFont('Helvetica', 'bold'); doc.setFontSize(11);
    doc.text(isPaid ? 'TAX INVOICE' : 'QUOTE', 195, 16, { align: 'right' });
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(80, 80, 80);
    doc.text(`Ref #${(job.id || '').toUpperCase()}`, 195, 22, { align: 'right' });
    doc.text(new Date(job.completed_at || job.date || Date.now()).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }), 195, 27, { align: 'right' });

    // Three-column header: WORKSHOP | CUSTOMER | VEHICLE
    doc.setTextColor(21, 4, 2); doc.setFontSize(9.5);
    doc.setFont('Helvetica', 'bold'); doc.text('WORKSHOP', 15, 44);
    doc.setFont('Helvetica', 'normal');
    const wLines = [profileData.name || 'Workshop', ...(profileData.address || '').split(',').slice(0, 3)].filter(Boolean);
    wLines.forEach((l, i) => { doc.text(l.trim(), 15, 50 + i * 5); });

    doc.setFont('Helvetica', 'bold'); doc.text('CUSTOMER', 85, 44);
    doc.setFont('Helvetica', 'normal');
    const custName = job.customer_name && job.customer_name !== job.vehicle_rego ? job.customer_name : '';
    const custEmail = job.email || '';
    const custPhone = job.customer_phone || qi.customerPhone || '';
    let cy = 50;
    if (custName) { doc.text(custName, 85, cy); cy += 5; }
    if (custEmail) { doc.text(custEmail, 85, cy); cy += 5; }
    if (custPhone) { doc.text(custPhone, 85, cy); }

    doc.setFont('Helvetica', 'bold'); doc.text('VEHICLE', 155, 44);
    doc.setFont('Helvetica', 'normal');
    const rego = job.vehicle_rego || '';
    const vehicleDesc = job.vehicle_label || (job.vehicle_make ? `${job.vehicle_year ? job.vehicle_year + ' ' : ''}${job.vehicle_make}${job.vehicle_model ? ' ' + job.vehicle_model : ''}`.trim() : '') || qi.vehicleLabel || '';
    if (vehicleDesc) { doc.text(vehicleDesc, 155, 50); doc.text(rego, 155, 55); }
    else if (rego) { doc.text(rego, 155, 50); }
    if (job.mileage_in) doc.text(`${Number(job.mileage_in).toLocaleString()} km`, 155, vehicleDesc ? 60 : 55);

    let y = 75;
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 24, 0);
    doc.text('ITEMISED INVOICE', 15, y); doc.setDrawColor(226, 232, 240); doc.line(15, y + 2, 195, y + 2);
    y += 9; doc.setFontSize(9); doc.setTextColor(21, 4, 2);
    const row = (label: string, amt: string, bold = false) => { doc.setFont('Helvetica', bold ? 'bold' : 'normal'); doc.text(label, 15, y); if (amt) doc.text(amt, 195, y, { align: 'right' }); y += 6.5; };

    if (parts.length > 0 || labourTotal > 0) {
      parts.forEach((p: any) => row(`${p.name}${p.qty > 1 ? '  x' + p.qty : ''}`, `$${((p.qty || 1) * (p.unitPrice || 0)).toFixed(2)}`));
      if (labourTotal > 0) row(`Labour (${qi.labourHours}h @ $${qi.labourRate}/hr)`, `$${labourTotal.toFixed(2)}`);
      otherList.forEach((o: any) => row(o.name, `$${Number(o.amount || 0).toFixed(2)}`));
      if (qi.shopFee > 0) row('Workshop fee (freight, sundries & consumables)', `$${Number(qi.shopFee).toFixed(2)}`);
      if (qi.discount > 0) row('Discount', `-$${Number(qi.discount).toFixed(2)}`);
    } else {
      const svcNames = (job.service_ids || []).map((id: string) => SERVICES.find(s => s.id === id)?.name || id);
      svcNames.forEach((name: string) => row(name, ''));
    }

    y += 2; doc.setDrawColor(226, 232, 240); doc.line(15, y, 195, y); y += 7;
    doc.setFontSize(12); doc.setTextColor(255, 24, 0); row(isPaid ? 'TOTAL PAID (GST incl.)' : 'TOTAL (GST incl.)', `$${total.toFixed(2)}`, true);
    if (isPaid) { y += 1; doc.setTextColor(16, 185, 129); doc.setFont('Helvetica', 'bold'); doc.setFontSize(10); doc.text('PAID IN FULL', 15, y); y += 8; }

    // Booking & payment
    y += 4;
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 24, 0);
    doc.text('BOOKING & PAYMENT', 15, y); doc.setDrawColor(226, 232, 240); doc.line(15, y + 2, 195, y + 2); y += 9;
    doc.setFontSize(9);
    const bRow = (label: string, val: string) => { doc.setFont('Helvetica', 'normal'); doc.setTextColor(120, 120, 120); doc.text(label, 15, y); doc.setTextColor(21, 4, 2); doc.text(val, 195, y, { align: 'right' }); y += 6; };
    if (job.date) bRow('Drop-off', new Date(job.date).toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    if (job.payment_method) bRow('Payment method', job.payment_method);
    bRow('Payment status', isPaid ? 'PAID IN FULL' : (job.payment_status || 'Pending'));
    if (qi.notes) { y += 4; doc.setFont('Helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(21, 4, 2); doc.text('Notes', 15, y); y += 5; doc.setFont('Helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(80, 80, 80); doc.splitTextToSize(String(qi.notes), 180).forEach((line: string) => { doc.text(line, 15, y); y += 4.5; }); }

    doc.setFontSize(7.5); doc.setTextColor(150, 150, 150);
    doc.text("Tax invoice provided via Torqued - NZ's smarter way to get your car sorted. Prices include 15% GST.", 15, 285);
    doc.save(`Torqued-Invoice-${(job.id || '').toUpperCase()}.pdf`);
  };

  // Build a branded, itemised quote PDF (logo + QR) and return base64
  const buildQuotePdf = async (job: any): Promise<string> => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const logo = await fetchDataUrl('/torqued-logo.png');
    // QR deep-links straight to this quote's review-and-pay screen (quote pre-loaded)
    const quoteUrl = `https://torqued.site/customer?quote=${encodeURIComponent(job.id)}`;
    const qr = await fetchDataUrl('https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=' + encodeURIComponent(quoteUrl));

    if (logo) doc.addImage(logo, 'PNG', 15, 8, 52, 17.4);
    doc.setFillColor(255, 24, 0); doc.rect(0, 30, 210, 2, 'F');
    doc.setTextColor(21, 4, 2); doc.setFont('Helvetica', 'bold'); doc.setFontSize(11);
    doc.text('SERVICE QUOTE', 195, 16, { align: 'right' });
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(80, 80, 80);
    doc.text(`Ref #${(job.id || '').toUpperCase()}`, 195, 22, { align: 'right' });
    doc.text(new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }), 195, 27, { align: 'right' });

    doc.setTextColor(21, 4, 2); doc.setFontSize(9.5);
    doc.setFont('Helvetica', 'bold'); doc.text('WORKSHOP', 15, 44);
    doc.setFont('Helvetica', 'normal'); doc.text(profileData.name || 'Torqued Workshop', 15, 50);
    doc.text(profileData.address || '', 15, 55);
    doc.setFont('Helvetica', 'bold'); doc.text('CUSTOMER', 115, 44);
    doc.setFont('Helvetica', 'normal');
    const custName = job.customerName || job.customer_name || '';
    const custEmail = job.email || job.customer_email || '';
    const custPhone = job.phone || job.customer_phone || '';
    if (custName) { doc.text(custName, 115, 50); }
    if (custEmail) { doc.text(custEmail, 115, custName ? 55 : 50); }
    if (custPhone) { doc.text(custPhone, 115, custName ? (custEmail ? 60 : 55) : 50); }

    doc.setFont('Helvetica', 'bold'); doc.text('VEHICLE', 155, 44);
    doc.setFont('Helvetica', 'normal');
    const rego = job.vehicleRego || job.rego || job.vehicleId || job.reg || '';
    const vehicleDesc = job.vehicleLabel || (job.year && job.make ? `${job.year} ${job.make} ${job.vehicleModel || ''}`.trim() : '');
    const mileage = job.mileage || job.odometer || null;
    if (vehicleDesc) doc.text(vehicleDesc, 155, 50);
    doc.text(rego, 155, vehicleDesc ? 55 : 50);
    if (mileage) doc.text(`${Number(mileage).toLocaleString()} km`, 155, vehicleDesc ? 60 : 55);

    let y = 68;
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 24, 0);
    doc.text('ITEMISED QUOTE', 15, y); doc.setDrawColor(226, 232, 240); doc.line(15, y + 2, 195, y + 2);
    y += 9; doc.setFontSize(9); doc.setTextColor(21, 4, 2);
    const row = (label: string, amt: string, bold = false) => { doc.setFont('Helvetica', bold ? 'bold' : 'normal'); doc.text(label, 15, y); doc.text(amt, 195, y, { align: 'right' }); y += 6.5; };
    qParts.filter(p => p.name).forEach(p => row(`${p.name}  x${p.qty}`, `$${(p.qty * p.unitPrice).toFixed(2)}`));
    if (qLabourTotal > 0) row(`Labour (${qLabourHours}h @ $${qLabourRate}/hr)`, `$${qLabourTotal.toFixed(2)}`);
    qOther.filter(o => o.name).forEach(o => row(o.name, `$${o.amount.toFixed(2)}`));
    if (qShopFee > 0) row('Workshop fee (freight, sundries & consumables)', `$${qShopFee.toFixed(2)}`);
    if (qDiscount > 0) row('Discount', `-$${qDiscount.toFixed(2)}`);
    y += 2; doc.setDrawColor(226, 232, 240); doc.line(15, y, 195, y); y += 7;
    doc.setFontSize(12); doc.setTextColor(255, 24, 0); row('TOTAL (GST incl.)', `$${qTotal.toFixed(2)}`, true);

    // Notes
    if (qNotes.trim()) {
      y += 4; doc.setFont('Helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(21, 4, 2); doc.text('Notes', 15, y);
      y += 5; doc.setFont('Helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(80, 80, 80);
      doc.splitTextToSize(qNotes.trim(), 180).forEach((line: string) => { doc.text(line, 15, y); y += 4.5; });
    }

    // QR + CTA — placed after notes; spill to a new page if less than 50mm remaining
    const QR_BLOCK_H = 42; // 32mm image + padding
    if (y + QR_BLOCK_H > 272) { doc.addPage(); y = 18; }
    y += 8;
    if (qr) doc.addImage(qr, 'PNG', 15, y, 32, 32);
    doc.setTextColor(21, 4, 2); doc.setFont('Helvetica', 'bold'); doc.setFontSize(11);
    doc.text('Book on your own terms with Torqued', 52, y + 10);
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100, 100, 100);
    doc.text('Scan the QR code to accept this quote and book instantly.', 52, y + 16);
    y += QR_BLOCK_H;
    // Footer always at bottom of last page
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5); doc.setTextColor(150, 150, 150);
      doc.text('Quote provided via Torqued — NZ\'s smarter way to get your car sorted. Prices include 15% GST.', 15, 290);
    }

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
        await fetch('/api/mechanic/save-onboarding', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mechanicId: user.id, fields: {}, complete: true }),
        });
        setOnboardingComplete(true);
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

  // Reset profile to empty defaults when the logged-in user changes (prevents stale data leaking between accounts)
  useEffect(() => {
    setProfileData({
      name: '', phone: '', address: '', nzbn: '',
      serviceAreas: [], diagnosticTools: [], certifications: [],
      labourRate: 145, shopFee: 25, offersPpi: false,
      bio: '', profilePhotoUrl: '',
      bannerImage: 'https://images.unsplash.com/photo-1486006920555-c77dcf18193c?auto=format&fit=crop&q=80&w=1920',
    });
  }, [user?.id]);

  // Load mechanic data from Supabase on mount
  useEffect(() => {
    if (!user) return;

    // Profile — use admin-backed endpoint to bypass any RLS restrictions
    fetch(`/api/mechanic/profile?mechanicId=${user.id}`)
      .then(r => r.json())
      .then(({ profile: data }) => {
        if (!data) return;
        setCap(prev => ({
          ...prev,
          technicians: data.technicians ?? prev.technicians,
          parts_lead_days: data.parts_lead_days ?? prev.parts_lead_days,
          labour_rate: data.labour_rate ?? prev.labour_rate,
          cancellation_notice_hours: data.cancellation_notice_hours ?? prev.cancellation_notice_hours,
          cancellation_partial_refund_pct: data.cancellation_partial_refund_pct ?? prev.cancellation_partial_refund_pct,
        }));
        if (data.labour_rate != null) setQLabourRate(data.labour_rate);
        if (data.billing_start_date) setBillingStartDate(data.billing_start_date);
        setProfileData({
          name: data.name || '',
          phone: data.phone || '',
          address: data.address || '',
          nzbn: data.nzbn || '',
          serviceAreas: data.service_areas || [],
          diagnosticTools: data.diagnostic_tools || [],
          certifications: data.certifications || [],
          labourRate: data.labour_rate ?? 145,
          shopFee: data.shop_fee ?? 25,
          offersPpi: !!data.offers_ppi,
          bio: data.bio || '',
          profilePhotoUrl: data.profile_photo_url || '',
          bannerImage: data.banner_image || 'https://images.unsplash.com/photo-1486006920555-c77dcf18193c?auto=format&fit=crop&q=80&w=1920',
        });
      })
      .catch(err => console.error('[mechanic profile load]', err));

    // Subscription status + payment history
    fetch(`/api/mechanic/billing?mechanicId=${user.id}`).then(r => r.json()).then(setBilling).catch(() => {});
    // Staff roster (team members + shifts)
    fetch(`/api/mechanic/roster?mechanicId=${user.id}`)
      .then(r => r.json())
      .then(d => { setRosterStaff(d.staff || []); setRosterShifts(d.shifts || []); setRosterLoaded(true); })
      .catch(() => setRosterLoaded(true));
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
        setPastJobs(all.filter((r: any) => ['completed', 'in_progress', 'accepted'].includes(r.status) || r.is_cold_quote));
        // Incoming queue = real customer jobs still needing action + quoted jobs (show in SENT filter)
        const data = all.filter((r: any) => ['booked', 'pending_payment', 'pending', 'quoted'].includes(r.status) && !r.is_cold_quote);
        if (!data || data.length === 0) { setIncomingJobs([]); setPortalLoading(false); return; }
        const jobs = data.map((row: any) => ({
          id: row.id,
          reg: row.vehicle_rego || '',
          customerName: row.customer_name || '',
          customerEmail: row.email || '',
          vehicleLabel: row.vehicle_label || '',
          vehicleMake: row.vehicle_make || '',
          vehicleModel: row.vehicle_model || '',
          vehicleYear: row.vehicle_year || null,
          model: row.vehicle_rego || (row.customer_name || 'Unknown Vehicle'),
          details: [row.date, row.payment_method].filter(Boolean).join(' • '),
          suggestedQuote: parseFloat(row.total_price) || 0,
          services: (row.description || '').startsWith('[EV Quote Request]')
            ? ['Manual Quote']
            : (row.service_ids || []).map((id: string) => SERVICES.find(s => s.id === id)?.name || id),
          description: (row.description || row.fault_code || '').replace(/^\[EV Quote Request\]\s*/, ''),
          status: row.status === 'booked' ? 'Booked via Torqued' : row.status === 'quoted' ? 'Quote Sent'
            : (row.status === 'pending' && (parseFloat(row.total_price) || 0) === 0) ? 'Quote Requested'
            : 'Awaiting Payment',
          rawStatus: row.status,
          payment_status: row.payment_status,
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
        setPortalLoading(false);
      }).catch(() => { setPortalLoading(false); });

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

  const [searchQuery, setSearchQuery] = useState('');
  const [billingStartDate, setBillingStartDate] = useState<string | null>(null);
  const [activeTab, setActiveTab ] = useState('dashboard');
  const [jobsSubtab, setJobsSubtab] = useState<'accept' | 'today' | 'upcoming' | 'history' | 'cold'>('accept');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [modalInsights, setModalInsights] = useState<{ title: string; detail: string; severity: string }[]>([]);
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('week');
  const [calendarMonth, setCalendarMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const [calendarDayDate, setCalendarDayDate] = useState<string>(() => localISO(new Date()));
  const [parts, setParts] = useState<InventoryPart[]>([]);
  const [incomingJobs, setIncomingJobs] = useState<any[]>([]);
  const [weekRevenue, setWeekRevenue] = useState(0);
  const [pastJobs, setPastJobs] = useState<any[]>([]);
  const [jobHistory, setJobHistory] = useState<any[]>([]);
  const [billing, setBilling] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [custSearch, setCustSearch] = useState('');
  const [healthSubtab, setHealthSubtab] = useState<'health' | 'ppi'>('health');
  const [ppiPreloadRego, setPpiPreloadRego] = useState('');
  const [ppiPreloadName, setPpiPreloadName] = useState('');
  const [ppiPreloadEmail, setPpiPreloadEmail] = useState('');
  const [ppiPreloadMileage, setPpiPreloadMileage] = useState('');
  // Editing a customer's contact details from the Customers tab
  const [editCustomer, setEditCustomer] = useState<any | null>(null);
  const [editCustForm, setEditCustForm] = useState({ name: '', email: '', phone: '' });
  const [editCustBusy, setEditCustBusy] = useState(false);

  const openEditCustomer = (c: any) => {
    setEditCustomer(c);
    setEditCustForm({ name: c.name || '', email: c.email || '', phone: c.phone || '' });
  };
  const saveEditCustomer = async () => {
    if (!editCustomer || !user) return;
    setEditCustBusy(true);
    try {
      const r = await fetch('/api/mechanic/update-customer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mechanicId: user.id,
          regos: editCustomer.regos || [],
          oldEmail: editCustomer.email || undefined,
          oldPhone: editCustomer.phone || undefined,
          name: editCustForm.name, email: editCustForm.email, phone: editCustForm.phone,
        }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || 'Could not save customer.'); return; }
      setCustomers(prev => prev.map(c => c === editCustomer ? { ...c, ...editCustForm } : c));
      setEditCustomer(null);
    } catch { alert('Could not save customer.'); }
    finally { setEditCustBusy(false); }
  };
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
      // Now emails the owner a 12-hour ACCESS LINK (no code to relay).
      const r = await fetch('/api/mechanic/request-history-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mechanicId: user.id, rego: plateRego, customerEmail: coldForm.email || undefined }),
      });
      const d = await r.json();
      if (!d.hasAccount) { setHistAccessState('no_account'); return; }
      if (d.priorBooking) {
        const sr = await fetch(`/api/mechanic/history-access-status?mechanicId=${encodeURIComponent(user.id)}&rego=${encodeURIComponent(plateRego)}`);
        if (sr.ok) { const sd = await sr.json(); if (sd.granted) { setUnlockedHistory({ imported: sd.imported || [], torquedJobs: sd.jobs || [] }); setHistAccessState('granted'); return; } }
        setHistAccessState('prior_booking');
        return;
      }
      if (d.noEmail) { setHistAccessState('no_email'); return; }
      if (d.alreadySent) { setHistOtpExpiry(d.expiresAt); setHistAccessState('already_sent'); return; }
      if (d.linkSent) { setHistOtpExpiry(d.expiresAt); setHistAccessState('otp_sent'); return; }
      setHistAccessState('needs_otp');
    } catch {
      setHistAccessState('error');
      setHistAccessMsg('Could not connect. Please try again.');
    }
  };

  // Poll whether the customer has tapped their access link yet.
  const verifyHistOtp = async () => {
    if (!user?.id || !coldForm.rego) return;
    setHistAccessState('verifying');
    try {
      const r = await fetch(`/api/mechanic/history-access-status?mechanicId=${encodeURIComponent(user.id)}&rego=${encodeURIComponent(coldForm.rego)}`);
      const d = await r.json();
      if (!r.ok || !d.granted) { setHistAccessState('otp_sent'); setHistAccessMsg('Not granted yet — ask the customer to tap the link in their email, then check again.'); return; }
      setUnlockedHistory({ imported: d.imported || [], torquedJobs: d.jobs || [] });
      setHistAccessState('granted');
      setHistAccessMsg(null);
    } catch {
      setHistAccessState('otp_sent');
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
  const [bookingLinkCopied, setBookingLinkCopied] = useState(false);
  const [profileData, setProfileData] = useState({
    name: '',
    nzbn: '',
    phone: '',
    address: '',
    serviceAreas: [] as string[],
    diagnosticTools: [] as string[],
    certifications: [] as string[],
    labourRate: 145,
    shopFee: 25,
    offersPpi: false,
    bio: '',
    profilePhotoUrl: '',
    bannerImage: 'https://images.unsplash.com/photo-1486006920555-c77dcf18193c?auto=format&fit=crop&q=80&w=1920'
  });
  const [profilePhotoUploading, setProfilePhotoUploading] = useState(false);

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
  const [rescheduleModal, setRescheduleModal] = useState<{ job: any } | null>(null);
  const [refundModal, setRefundModal] = useState<{ job: any } | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundBusy, setRefundBusy] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleComment, setRescheduleComment] = useState('');
  const [rescheduleSending, setRescheduleSending] = useState(false);
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

  // Mechanic sends a real email to the customer (reply-to hello@torqued.site)
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

  const handleAcceptJob = async (jobId: string) => {
    const job = incomingJobs.find(j => j.id === jobId);
    if (!job) return;

    // Remove from incoming + persist accepted status (service role — survives refresh)
    const customerName = (job as any).customerName || (job.model.includes(' — ') ? job.model.split(' — ').slice(1).join(' — ') : '');
    // Check billing_start_date before accepting
    const acceptResp = await fetch('/api/mechanic/update-job-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId: jobId, status: 'accepted' }) });
    if (acceptResp.status === 403) {
      const d = await acceptResp.json();
      alert(d.error || 'Your subscription has not yet started. You cannot accept jobs yet.');
      return;
    }
    setIncomingJobs(incomingJobs.filter(j => j.id !== jobId));
    // Add to pastJobs so it appears immediately in Today / Upcoming tabs
    setPastJobs(prev => [{
      id: job.id, vehicle_rego: job.reg, customer_name: customerName || job.model,
      service_ids: [], total_price: String(job.suggestedQuote), quote_items: job.quoteItems,
      status: 'accepted', date: job.details?.split(' • ')?.[0] || null,
      payment_status: 'confirmed', description: job.description, is_cold_quote: false,
    }, ...prev]);

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

    setActiveTab('calendar');
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setProfileSaveStatus('idle'); setProfileSaveError(null);
    try {
      const r = await fetch('/api/mechanic/save-onboarding', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mechanicId: user.id, fields: {
          name: profileData.name, phone: profileData.phone, address: profileData.address,
          nzbn: profileData.nzbn, service_areas: profileData.serviceAreas,
          diagnostic_tools: profileData.diagnosticTools, certifications: profileData.certifications,
          labour_rate: profileData.labourRate, shop_fee: profileData.shopFee,
          offers_ppi: profileData.offersPpi, bio: profileData.bio,
        }}),
      });
      const d = await r.json();
      if (!r.ok) { setProfileSaveStatus('error'); setProfileSaveError(d.error || 'Could not save profile.'); return; }
      // Keep cap in sync with the saved labour rate
      setCap(prev => ({ ...prev, labour_rate: profileData.labourRate }));
      setProfileSaveStatus('saved');
      setTimeout(() => setProfileSaveStatus('idle'), 3000);
      // Trigger server-side geocode for updated address
      if (profileData.address) {
        setAddressUpdateStatus('updating');
        try {
          await fetch('/api/mechanic/update-address', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mechanicId: user.id, address: profileData.address }),
          });
          setAddressUpdateStatus('updated');
          setTimeout(() => setAddressUpdateStatus('idle'), 3000);
        } catch { setAddressUpdateStatus('error'); }
      }
    } catch { setProfileSaveStatus('error'); setProfileSaveError('Connection error. Please try again.'); }
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

  const renderDashboard = () => {
    const isConfirmedCalendarJob = (j: any) => !!j.date && (j.status === 'accepted' || j.status === 'in_progress' || j.status === 'completed' || j.payment_status === 'confirmed');
    const todaysJobs = pastJobs.filter((j: any) => isConfirmedCalendarJob(j) && localISO(new Date(j.date)) === localISO(new Date()))
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-4 space-y-1 bg-card border-border">
          <p className="text-[10px] font-bold uppercase text-muted">Today's Jobs</p>
          <div className="flex items-end gap-2">
            <h3 className="text-xl sm:text-3xl text-foreground">{todaysJobs.length}</h3>
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

          <Card className="p-6 space-y-6 bg-card border-border">
            <h3 className="text-xl text-foreground">Today's Schedule</h3>
            <div className="space-y-4">
              {todaysJobs.length === 0 && <p className="text-xs text-muted italic">No jobs scheduled for today.</p>}
              {todaysJobs.slice(0, 4).map((job: any) => (
                <div
                  key={job.id}
                  className="flex gap-4 items-start pb-4 border-b border-border last:border-0 cursor-pointer hover:bg-background -mx-2 px-2 rounded-xl transition-all"
                  onClick={() => { setActiveTab('jobs'); setJobsSubtab(job.status === 'completed' ? 'history' : 'today'); }}
                >
                  <div className="text-xs font-bold text-muted pt-1">{new Date(job.date).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' })}</div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-foreground">{job.vehicle_label || job.vehicle_rego || job.customer_name || 'Job'}</h4>
                    <p className="text-xs text-muted">{(job.service_ids || []).map((id: string) => SERVICES.find((s: any) => s.id === id)?.name || id).join(', ') || jobSummaryTitle(job)}</p>
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold uppercase px-2 py-0.5 rounded shrink-0",
                    job.status === 'in_progress' ? "bg-torqued-red text-white" : "bg-background text-muted"
                  )}>
                    {job.status === 'in_progress' ? 'In Progress' : job.status}
                  </span>
                </div>
              ))}
            </div>
            <Button variant="outline" fullWidth size="sm" className="border-border text-foreground hover:bg-background" onClick={() => setActiveTab('calendar')}>View Full Calendar</Button>
          </Card>
        </div>
      </div>
    </div>
    );
  };

  const renderParts = () => (
    <div className="space-y-6">
      <div className="flex justify-end items-center">
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
    // plus cold-quotes that have quoteItems built in the builder.
    // Once a quote is PAID it's a real job — drop it out of "Quoted" into My Jobs.
    const sentDiagJobs  = incomingJobs.filter(j => (j.status === 'Quote Sent' || !!j.quoteItems) && j.payment_status !== 'confirmed');
    const sentColdJobs  = pastJobs.filter((j: any) => j.is_cold_quote && !!j.quoteItems && j.payment_status !== 'confirmed');
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
            <p className="text-muted text-sm">{subtitle}</p>
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
            <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border">
              <p className="text-muted font-bold uppercase tracking-widest">
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
                    {job.reg && <div className="torqued-badge text-[10px]">{job.reg}</div>}
                    {job.quoteItems && (
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">Quote Sent</span>
                    )}
                  </div>
                  <h3 className="text-2xl text-foreground font-bold">{(job as any).customerName || (job.reg ? job.reg : 'Unknown Vehicle')}</h3>
                  {(() => { const vd = (job as any).vehicleLabel || ((job as any).vehicleMake ? `${(job as any).vehicleYear ? (job as any).vehicleYear + ' ' : ''}${(job as any).vehicleMake}${(job as any).vehicleModel ? ' ' + (job as any).vehicleModel : ''}`.trim() : null); return vd ? <p className="text-sm text-muted font-medium">{vd}</p> : null; })()}
                  <p className="text-xs text-muted">{job.details}</p>
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
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted font-accent">Customer</h4>
                  {(job as any).customerName && (job as any).customerName !== job.reg ? (
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-foreground">{(job as any).customerName}</p>
                      {(job as any).customerEmail && <p className="text-xs text-muted">{(job as any).customerEmail}</p>}
                      <button onClick={() => { setActiveTab('customers'); setCustSearch((job as any).customerName || ''); }}
                        className="text-[10px] text-torqued-red hover:underline">View customer profile →</button>
                    </div>
                  ) : (
                    <p className="text-sm italic text-muted">No customer details recorded</p>
                  )}
                  {job.description && (
                    <div className="mt-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">Description</p>
                      <p className="text-sm italic text-foreground/80">{job.description}</p>
                    </div>
                  )}
                </div>
                {job.quoteItems && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted font-accent">What You Quoted</h4>
                    <div className="rounded-xl border border-border bg-background p-3 space-y-1.5">
                      {(job.quoteItems.parts || []).filter((p: any) => p.name).map((p: any, i: number) => (
                        <div key={`p${i}`} className="flex justify-between text-xs">
                          <span className="text-foreground">{p.name}{p.qty > 1 ? ` ×${p.qty}` : ''}</span>
                          <span className="text-muted font-mono">{formatCurrency((p.qty || 0) * (p.unitPrice || 0))}</span>
                        </div>
                      ))}
                      {(job.quoteItems.labourHours > 0) && (
                        <div className="flex justify-between text-xs">
                          <span className="text-foreground">Labour ({job.quoteItems.labourHours}h @ {formatCurrency(job.quoteItems.labourRate || 0)})</span>
                          <span className="text-muted font-mono">{formatCurrency((job.quoteItems.labourHours || 0) * (job.quoteItems.labourRate || 0))}</span>
                        </div>
                      )}
                      {(job.quoteItems.shopFee > 0) && (
                        <div className="flex justify-between text-xs"><span className="text-foreground">Workshop fee</span><span className="text-muted font-mono">{formatCurrency(job.quoteItems.shopFee)}</span></div>
                      )}
                      {(job.quoteItems.other || []).filter((o: any) => o.label || o.amount).map((o: any, i: number) => (
                        <div key={`o${i}`} className="flex justify-between text-xs"><span className="text-foreground">{o.label || 'Other'}</span><span className="text-muted font-mono">{formatCurrency(o.amount || 0)}</span></div>
                      ))}
                      {(job.quoteItems.discount > 0) && (
                        <div className="flex justify-between text-xs"><span className="text-emerald-600">Discount</span><span className="text-emerald-600 font-mono">−{formatCurrency(job.quoteItems.discount)}</span></div>
                      )}
                      {job.quoteItems.notes && <p className="text-[11px] italic text-muted pt-1 border-t border-border">{job.quoteItems.notes}</p>}
                    </div>
                  </div>
                )}
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
                  {/* Check-out records the odometer, marks the job complete, emails the customer their car is ready + a review link, and files it to history. One step. */}
                  <Button variant="outline" className="flex-1 text-emerald-600 border-border hover:bg-card font-bold" onClick={() => recordMileage(job, 'out')}>Check-out km & Complete</Button>
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
                  <Button variant="outline" className="text-blue-500 border-border hover:bg-card" onClick={() => { setRescheduleModal({ job }); setRescheduleDate(''); setRescheduleComment(''); }}>Request Reschedule</Button>
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
        <p className="text-muted">Complete your profile to start receiving bookings.</p>
      </div>

      <div className="space-y-6">
        <Card className="p-0 overflow-hidden border-border bg-card shadow-sm">
          <div className="h-48 bg-gradient-to-br from-torqued-red/10 to-background relative">
            <div className="absolute -bottom-12 left-8 w-24 h-24 bg-background p-1 rounded-2xl shadow-2xl border border-border group">
              <div className="w-full h-full bg-card rounded-xl flex items-center justify-center overflow-hidden">
                {profileData.profilePhotoUrl ? (
                  <img src={profileData.profilePhotoUrl} alt="Workshop profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-black italic text-torqued-red/40">
                    {(profileData.name || user?.email || 'W').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                )}
              </div>
              <label className="absolute inset-1 rounded-xl bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center cursor-pointer">
                {profilePhotoUploading ? (
                  <span className="text-[9px] font-bold text-white uppercase">Uploading…</span>
                ) : (
                  <Camera size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={profilePhotoUploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file || !user?.id) return;
                    setProfilePhotoUploading(true);
                    try {
                      const imageBase64: string = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                      });
                      const r = await fetch('/api/mechanic/profile-photo', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ mechanicId: user.id, imageBase64 }),
                      });
                      const d = await r.json();
                      if (r.ok && d.url) setProfileData(p => ({ ...p, profilePhotoUrl: d.url }));
                      else alert(d.error || 'Could not upload photo.');
                    } catch { alert('Could not upload photo.'); }
                    finally { setProfilePhotoUploading(false); }
                  }}
                />
              </label>
            </div>
          </div>
          <div className="pt-16 pb-6 px-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-foreground">{profileData.name || user?.email || 'My Workshop'}</h3>
              {profileData.address && (
                <p className="text-sm text-muted font-medium">{profileData.address}</p>
              )}
              <p className="text-[10px] text-muted">Square image suggested, 512×512px.</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="text-left sm:text-right mr-4">
                <p className="text-[10px] font-bold uppercase text-muted">Status</p>
                <div className="flex items-center gap-1.5 text-emerald-500 font-bold text-xs uppercase tracking-tight">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> Live & Accepting Jobs
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4 bg-card border-border">
          <div className="flex items-center gap-2 border-b border-border pb-4">
            <Link2 size={20} className="text-torqued-red" />
            <h3 className="text-xl text-foreground">Public Booking Link</h3>
          </div>
          <p className="text-sm text-muted leading-relaxed">
            Share this link on social media, your website, or directly with a customer. It opens straight to your profile with a <span className="text-foreground font-semibold">Book with {profileData.name || 'Your Workshop'}</span> button — they go through the normal booking flow, but pricing and the job always come to you. No workshop-browsing, no other mechanics shown.
          </p>
          {user?.id ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 min-w-0 bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground font-mono truncate">
                {`https://torqued.site/customer?book=${user.id}`}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  className="bg-torqued-red text-white h-auto px-5"
                  onClick={() => {
                    navigator.clipboard.writeText(`https://torqued.site/customer?book=${user.id}`);
                    setBookingLinkCopied(true);
                    setTimeout(() => setBookingLinkCopied(false), 2000);
                  }}
                >
                  <Copy size={14} className="mr-1.5" /> {bookingLinkCopied ? 'Copied!' : 'Copy Link'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border text-foreground hover:bg-background h-auto px-5"
                  onClick={() => window.open(`https://torqued.site/customer?book=${user.id}`, '_blank')}
                >
                  Preview
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted italic">Save your profile to activate your booking link.</p>
          )}
        </Card>

        <Card className="p-6 space-y-4 bg-card border-border">
          <div className="flex items-center gap-2 border-b border-border pb-4">
            <Award size={20} className="text-torqued-red" />
            <h3 className="text-xl text-foreground">Workshop Details</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Trading / Workshop Name" value={profileData.name} placeholder="e.g. North Mechanical" onChange={(e) => setProfileData({ ...profileData, name: e.target.value })} />
            <Input label="Contact Phone" value={profileData.phone} placeholder="e.g. 021 234 5678" onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase text-muted">Workshop bio</label>
            <textarea
              value={profileData.bio}
              placeholder="Tell customers a bit about your workshop — experience, specialities, what makes you different…"
              rows={4}
              onChange={(e) => {
                const words = e.target.value.split(/\s+/).filter(Boolean);
                if (words.length <= 200) setProfileData({ ...profileData, bio: e.target.value });
              }}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted outline-none focus:border-torqued-red transition-colors resize-none"
            />
            <p className="text-[10px] text-muted">{profileData.bio.split(/\s+/).filter(Boolean).length} / 200 words</p>
          </div>
          {/* Pre-Purchase Inspection opt-in */}
          <div className="border-t border-border pt-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">Offer Pre-Purchase Inspections</p>
              <p className="text-xs text-muted mt-0.5">Customers can book a $199 flat-fee PPI with your workshop. Excludes high-voltage (hybrid/EV) battery testing. You can also start one any time under Vehicle Health.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={profileData.offersPpi}
              onClick={() => setProfileData({ ...profileData, offersPpi: !profileData.offersPpi })}
              className={cn('shrink-0 w-12 h-7 rounded-full transition-all relative', profileData.offersPpi ? 'bg-torqued-red' : 'bg-border')}
            >
              <span className={cn('absolute top-1 w-5 h-5 bg-white rounded-full transition-all', profileData.offersPpi ? 'left-6' : 'left-1')} />
            </button>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
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
              <p className="text-xs text-muted">Manage your payment method securely via Stripe.</p>
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
              <p className="text-sm text-muted">Sign in with passkey instead of your password. Your password still works as a fallback.</p>
              <Button variant="outline" className="text-foreground border-border" onClick={async () => {
                try { await registerPasskey('mechanic', user!.email!); alert('Passkey added. Next time, tap "Sign in with passkey".'); }
                catch (e: any) { alert(e?.message || 'Could not add passkey.'); }
              }}>🔑 Add a passkey</Button>
            </Card>
          )}

          <Card className="p-6 space-y-4 md:col-span-2 bg-card border-border">
            <div className="flex items-center gap-2 border-b border-border pb-4">
              <Map size={20} className="text-torqued-red" />
              <h3 className="text-xl text-foreground">Workshop Location</h3>
            </div>
            <p className="text-xs text-muted">Your address is used to match you with nearby customers. Geocoded automatically on save — updates your pin on the customer map.</p>
            <div className="flex items-start gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={profileData.address}
                  onChange={e => {
                    const val = e.target.value;
                    setProfileData({ ...profileData, address: val });
                    if (profileAddrTimer.current) clearTimeout(profileAddrTimer.current);
                    if (val.length < 3) { setProfileAddrSuggestions([]); return; }
                    profileAddrTimer.current = setTimeout(async () => {
                      try {
                        const res = await fetch(
                          `https://nominatim.openstreetmap.org/search?format=json&countrycodes=nz&limit=5&q=${encodeURIComponent(val)}`,
                          { headers: { 'User-Agent': 'TorquedNZ/1.0 (torquedapp.nz@gmail.com)' } }
                        );
                        setProfileAddrSuggestions(await res.json() || []);
                      } catch { setProfileAddrSuggestions([]); }
                    }, 380);
                  }}
                  placeholder="Start typing your workshop address…"
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted outline-none focus:border-torqued-red transition-colors"
                />
                {profileAddrSuggestions.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl overflow-hidden shadow-2xl">
                    {profileAddrSuggestions.map((s, i) => (
                      <button key={i} type="button"
                        className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-torqued-red/10 border-b border-border last:border-0"
                        onClick={() => { setProfileData(p => ({ ...p, address: s.display_name })); setProfileAddrSuggestions([]); }}>
                        {s.display_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                disabled={addressUpdateStatus === 'updating' || !profileData.address}
                className="shrink-0 mt-1 px-4 py-3 rounded-xl bg-torqued-red text-white text-xs font-bold disabled:opacity-40 hover:bg-torqued-red/90 transition-colors"
                onClick={async () => {
                  if (!user || !profileData.address) return;
                  setAddressUpdateStatus('updating');
                  setProfileAddrSuggestions([]);
                  try {
                    const r = await fetch('/api/mechanic/update-address', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ mechanicId: user.id, address: profileData.address }),
                    });
                    if (r.ok) { setAddressUpdateStatus('updated'); setTimeout(() => setAddressUpdateStatus('idle'), 3000); }
                    else { setAddressUpdateStatus('error'); }
                  } catch { setAddressUpdateStatus('error'); }
                }}
              >
                {addressUpdateStatus === 'updating' ? 'Saving…' : 'Save'}
              </button>
            </div>
            <button
              type="button"
              disabled={mechLocating}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-torqued-red hover:opacity-70 disabled:opacity-40 transition-opacity"
              onClick={() => {
                if (!navigator.geolocation) { alert('Geolocation is not supported on this device.'); return; }
                setMechLocating(true);
                navigator.geolocation.getCurrentPosition(async (pos) => {
                  try {
                    const { latitude, longitude } = pos.coords;
                    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`, { headers: { 'User-Agent': 'TorquedNZ/1.0 (torquedapp.nz@gmail.com)' } });
                    const d = await r.json();
                    if (d.display_name) setProfileData(p => ({ ...p, address: d.display_name }));
                  } catch { alert('Could not resolve your location.'); }
                  finally { setMechLocating(false); }
                }, () => { setMechLocating(false); alert('Location permission denied.'); }, { enableHighAccuracy: true, timeout: 10000 });
              }}
            >
              <Map size={14} /> {mechLocating ? 'Locating…' : 'Use my current GPS location'}
            </button>
            {addressUpdateStatus === 'updated' && <p className="text-xs text-emerald-500 font-bold">Location updated — pin moved on customer map ✓</p>}
            {addressUpdateStatus === 'error' && <p className="text-xs text-torqued-red font-bold">Geocode failed — check the address and try again.</p>}
          </Card>
        </div>

        {/* Capacity & Cancellation Policy (moved here from Calendar) */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-black/5 pb-4">
            <CalendarIcon size={20} className="text-torqued-red" />
            <h3 className="text-xl text-foreground">Capacity & Cancellation Policy</h3>
            <span className="text-[10px] text-muted ml-auto">Sets realistic drop-off / ready times for customers</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">Parts lead (days)</label><Input type="number" value={String(cap.parts_lead_days)} onChange={e => setCap({ ...cap, parts_lead_days: parseInt(e.target.value) || 0 })} className="bg-background text-foreground" /></div>
          </div>
          <div className="pt-3 mt-1 border-t border-border">
            <p className="text-[11px] font-black uppercase tracking-widest text-torqued-red mb-2">Cancellation Policy</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">Free-cancel notice (hrs)</label><Input type="number" value={String(cap.cancellation_notice_hours)} onChange={e => setCap({ ...cap, cancellation_notice_hours: parseInt(e.target.value) || 0 })} className="bg-background text-foreground" /></div>
              <div><label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">Late-cancel refund (%)</label><Input type="number" value={String(cap.cancellation_partial_refund_pct)} onChange={e => setCap({ ...cap, cancellation_partial_refund_pct: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })} className="bg-background text-foreground" /></div>
            </div>
            <p className="text-xs text-muted mt-2">Cancel with at least this many hours of <strong>open</strong> notice (weekends &amp; public holidays don't count) → full refund. Less notice → the customer is refunded this percentage.</p>
          </div>
          <p className="text-xs text-muted">Quick jobs (oil, WOF) → next business day. Jobs needing parts (cambelt, rotors) → drop-off after your parts lead time. Daily capacity is driven by your <strong>Staff Roster</strong> in the Calendar.</p>
          <div className="flex items-center gap-3">
            <Button className="bg-torqued-red text-white" disabled={capSaving} onClick={async () => {
              if (!user) return;
              setCapSaving(true); setCapSaveStatus('idle'); setCapSaveError(null);
              try {
                const r = await fetch('/api/mechanic/save-onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mechanicId: user.id, fields: cap }) });
                const d = await r.json();
                if (!r.ok) { setCapSaveStatus('error'); setCapSaveError(d.error || 'Could not save. Please try again.'); return; }
                setCapSaveStatus('saved');
                setTimeout(() => setCapSaveStatus('idle'), 3000);
              } catch { setCapSaveStatus('error'); setCapSaveError('Connection error. Please try again.'); }
              finally { setCapSaving(false); }
            }}>{capSaving ? 'Saving…' : 'Save Capacity'}</Button>
            {capSaveStatus === 'saved' && <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">✓ Saved</span>}
            {capSaveStatus === 'error' && <span className="text-xs text-torqued-red font-bold">{capSaveError}</span>}
          </div>
        </Card>

        <div className="space-y-2">
          <Button fullWidth size="lg" className="h-16 text-lg bg-torqued-red text-white" onClick={handleSaveProfile}>Save Profile Updates</Button>
          {profileSaveStatus === 'saved' && <p className="text-xs text-emerald-600 font-bold text-center">✓ Profile saved</p>}
          {profileSaveStatus === 'error' && <p className="text-xs text-torqued-red font-bold text-center">{profileSaveError}</p>}
        </div>
      </div>
    </div>
  );

  const renderCalendar = () => {
    // Confirmed jobs with a real scheduled date/time — the source of truth for the calendar
    // (accepted/in-progress/paid jobs; completed jobs still show if scheduled for a past date).
    const isConfirmedCalendarJob = (j: any) => !!j.date && (j.status === 'accepted' || j.status === 'in_progress' || j.status === 'completed' || j.payment_status === 'confirmed');
    const confirmedJobs = pastJobs.filter(isConfirmedCalendarJob);
    const jobsOnDate = (iso: string) => confirmedJobs.filter((j: any) => localISO(new Date(j.date)) === iso);
    const jobLabel = (j: any) => j.vehicle_label || j.vehicle_rego || j.customer_name || 'Job';
    const jobServiceLabel = (j: any) => (j.service_ids || []).map((id: string) => SERVICES.find((s: any) => s.id === id)?.name || id).join(', ') || jobSummaryTitle(j);
    const openJobFromCalendar = (j: any) => {
      setActiveTab('jobs');
      setJobsSubtab(j.status === 'completed' ? 'history' : (localISO(new Date(j.date)) === localISO(new Date()) ? 'today' : 'upcoming'));
    };
    return (
    <div className="space-y-6">
      {/* Staff Roster */}
      {(() => {
        const weekDates = [...Array(7)].map((_, i) => {
          const d = new Date(rosterWeekStart + 'T00:00:00'); d.setDate(d.getDate() + i);
          return localISO(d);
        });
        const dayLabel = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' });
        const shiftsFor = (staffId: string, date: string) => rosterShifts.filter(s => s.staff_id === staffId && s.shift_date === date);
        const onCountFor = (date: string) => new Set(rosterShifts.filter(s => s.shift_date === date).map(s => s.staff_id)).size;
        const shiftWeek = (s: RosterShift) => weekDates.includes(s.shift_date);

        const printRoster = () => {
          const rows = rosterStaff.map(st => {
            const cells = weekDates.map(d => {
              const sh = shiftsFor(st.id, d);
              return `<td style="border:1px solid #ccc;padding:6px;font-size:11px;vertical-align:top">${sh.map(x => `${x.start_time.slice(0,5)}–${x.end_time.slice(0,5)}${x.break_start ? `<br><span style="color:#999">break ${x.break_start.slice(0,5)}–${(x.break_end||'').slice(0,5)}</span>` : ''}`).join('<br>') || '—'}</td>`;
            }).join('');
            return `<tr><td style="border:1px solid #ccc;padding:6px;font-weight:bold;font-size:11px">${st.name}${st.role ? `<br><span style="color:#999;font-weight:normal">${st.role}</span>` : ''}</td>${cells}</tr>`;
          }).join('');
          const head = weekDates.map(d => `<th style="border:1px solid #ccc;padding:6px;font-size:11px;background:#f5f5f5">${dayLabel(d)}<br><span style="color:#777;font-weight:normal">${onCountFor(d)} on</span></th>`).join('');
          const w = window.open('', '_blank');
          if (!w) return;
          w.document.write(`<html><head><title>Roster — week of ${dayLabel(weekDates[0])}</title></head><body style="font-family:Arial,sans-serif"><h2>${profileData.name || 'Workshop'} — Staff Roster</h2><p>Week of ${dayLabel(weekDates[0])}</p><table style="border-collapse:collapse;width:100%"><thead><tr><th style="border:1px solid #ccc;padding:6px;font-size:11px;background:#f5f5f5">Staff</th>${head}</tr></thead><tbody>${rows}</tbody></table></body></html>`);
          w.document.close(); w.print();
        };

        return (
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-black/5 pb-4">
              <CalendarIcon size={20} className="text-torqued-red" />
              <h3 className="text-xl">Staff Roster</h3>
              <span className="text-[10px] text-muted ml-auto">Schedule who's working each day — drives daily capacity</span>
            </div>

            {/* Team members */}
            <div className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-widest text-muted">Team Members</p>
              <div className="flex flex-wrap gap-2">
                {rosterStaff.map(st => (
                  <span key={st.id} className="inline-flex items-center gap-1.5 bg-background border border-border rounded-full pl-3 pr-1.5 py-1 text-xs font-bold">
                    {st.name}{st.role ? <span className="text-muted font-normal">· {st.role}</span> : null}
                    <button onClick={async () => {
                      if (!confirm(`Remove ${st.name} and their shifts?`)) return;
                      await fetch(`/api/mechanic/staff/${st.id}`, { method: 'DELETE' });
                      setRosterStaff(prev => prev.filter(s => s.id !== st.id));
                      setRosterShifts(prev => prev.filter(s => s.staff_id !== st.id));
                    }} className="text-muted hover:text-torqued-red"><X size={12} /></button>
                  </span>
                ))}
                {rosterStaff.length === 0 && <span className="text-xs text-muted">No team members yet — add your technicians below.</span>}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Input value={newStaffName} onChange={e => setNewStaffName(e.target.value)} placeholder="Name (e.g. Jordan)" className="bg-background text-foreground flex-1 min-w-[140px]" />
                <Input value={newStaffRole} onChange={e => setNewStaffRole(e.target.value)} placeholder="Role (optional)" className="bg-background text-foreground flex-1 min-w-[140px]" />
                <Button className="bg-torqued-red text-white" disabled={!user || !newStaffName.trim()} onClick={async () => {
                  if (!user || !newStaffName.trim()) return;
                  const r = await fetch('/api/mechanic/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mechanicId: user.id, name: newStaffName, role: newStaffRole }) });
                  const d = await r.json();
                  if (d.staff) { setRosterStaff(prev => [...prev, d.staff]); setNewStaffName(''); setNewStaffRole(''); }
                  else alert(d.error || 'Could not add team member. Have you run roster-schema.sql in Supabase?');
                }}>Add</Button>
              </div>
            </div>

            {/* Week navigation */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                <button onClick={() => setRosterWeekStart(prev => { const d = new Date(prev + 'T00:00:00'); d.setDate(d.getDate() - 7); return localISO(d); })} className="p-2 hover:bg-background rounded-full"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg></button>
                <span className="text-sm font-bold">Week of {dayLabel(weekDates[0])}</span>
                <button onClick={() => setRosterWeekStart(prev => { const d = new Date(prev + 'T00:00:00'); d.setDate(d.getDate() + 7); return localISO(d); })} className="p-2 hover:bg-background rounded-full"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg></button>
              </div>
              <Button variant="outline" size="sm" className="border-border text-foreground" disabled={rosterStaff.length === 0} onClick={printRoster}>🖨 Print Roster</Button>
            </div>

            {/* Roster grid */}
            {rosterStaff.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[640px]">
                  <thead>
                    <tr>
                      <th className="border border-border p-2 text-[10px] font-black uppercase tracking-widest text-muted text-left">Staff</th>
                      {weekDates.map(d => (
                        <th key={d} className="border border-border p-2 text-center">
                          <p className="text-[10px] font-bold text-foreground">{dayLabel(d)}</p>
                          <p className="text-[9px] text-torqued-red font-black">{onCountFor(d)} on</p>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rosterStaff.map(st => (
                      <tr key={st.id}>
                        <td className="border border-border p-2 text-xs font-bold align-top">{st.name}{st.role ? <span className="block text-[10px] text-muted font-normal">{st.role}</span> : null}</td>
                        {weekDates.map(d => {
                          const sh = shiftsFor(st.id, d);
                          return (
                            <td key={d} className="border border-border p-1 align-top cursor-pointer hover:bg-background transition-colors"
                              onClick={() => setShiftModal({ date: d, staffId: st.id, startTime: '08:00', endTime: '17:00', breakStart: '', breakEnd: '' })}>
                              {sh.map(x => (
                                <div key={x.id} className="group/sh bg-emerald-400/15 border-l-2 border-emerald-500 rounded px-1.5 py-1 mb-1 text-[10px]">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-emerald-700 dark:text-emerald-400">{x.start_time.slice(0,5)}–{x.end_time.slice(0,5)}</span>
                                    <button onClick={async (e) => { e.stopPropagation(); await fetch(`/api/mechanic/roster/shift/${x.id}`, { method: 'DELETE' }); setRosterShifts(prev => prev.filter(s => s.id !== x.id)); }} className="opacity-0 group-hover/sh:opacity-100 text-red-400 hover:text-red-600"><X size={10} /></button>
                                  </div>
                                  {x.break_start && <span className="text-muted">break {x.break_start.slice(0,5)}–{(x.break_end||'').slice(0,5)}</span>}
                                </div>
                              ))}
                              {sh.length === 0 && <span className="text-[10px] text-muted/40 block text-center py-1">+</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      })()}

      <div className="flex justify-between items-center">
        <h2 className="text-3xl">Workshop Calendar</h2>
        <div className="flex bg-card p-1 rounded-xl border border-border">
          {(['day', 'week', 'month'] as const).map(v => (
            <button
              key={v}
              onClick={() => setCalendarView(v)}
              className={cn(
                "px-6 py-2 rounded-lg text-xs font-bold uppercase transition-all",
                calendarView === v ? "bg-torqued-red text-white" : "text-muted hover:bg-background"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      
      {calendarView === 'week' ? (
        <Card className="p-0 overflow-hidden border-none shadow-sm">
          <div className="grid grid-cols-8 border-b border-border bg-foreground/5">
            <div className="p-4 border-r border-border" />
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
              const d = new Date(rosterWeekStart + 'T00:00:00'); d.setDate(d.getDate() + i);
              const iso = localISO(d);
              const rosteredCount = new Set(rosterShifts.filter(s => s.shift_date === iso).map(s => s.staff_id)).size;
              return (
                <div key={day} className="px-4 py-3 text-center border-r border-border last:border-0">
                  <p className="text-[10px] font-bold uppercase text-muted">{day}</p>
                  <p className="text-lg font-bold text-foreground">{String(d.getDate()).padStart(2, '0')}</p>
                  <p className="text-[9px] font-black text-torqued-red mt-0.5">{rosteredCount} on</p>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-8 relative h-[600px] overflow-y-auto">
            {/* Time labels column */}
            <div className="border-r border-border bg-foreground/5">
              {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map(h => (
                <div key={h} className="h-24 px-2 py-1 text-[10px] font-bold text-muted/50 text-right">
                  {h}:00
                </div>
              ))}
            </div>
            {/* Grid for days */}
            {[...Array(7)].map((_, dayIdx) => {
              const colDate = new Date(rosterWeekStart + 'T00:00:00'); colDate.setDate(colDate.getDate() + dayIdx);
              const colIso = localISO(colDate);
              return (
                <div
                  key={dayIdx}
                  className="border-r border-border relative min-h-[1000px] cursor-crosshair"
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
                    <div key={i} className="absolute w-full h-px bg-border" style={{ top: `${i * 96}px` }} />
                  ))}

                  {/* Confirmed jobs scheduled for this day */}
                  {jobsOnDate(colIso).map((job: any) => {
                    const d = new Date(job.date);
                    const startHour = d.getHours();
                    const startMin = d.getMinutes();
                    const top = (startHour - 8) * 96 + (startMin / 60) * 96;
                    const height = 96; // default 1hr block — no duration data on bookings yet

                    return (
                      <motion.div
                        data-appt="1"
                        key={job.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={cn(
                          "absolute left-1 right-1 rounded-lg p-2 text-white shadow-sm cursor-pointer hover:brightness-110 transition-all z-20",
                          job.status === 'completed' ? "bg-emerald-500" : job.status === 'in_progress' ? "bg-torqued-red" : "bg-blue-500"
                        )}
                        style={{ top: `${top}px`, height: `${height}px` }}
                        onClick={() => openJobFromCalendar(job)}
                      >
                         <p className="text-[8px] font-bold uppercase opacity-80">{d.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' })}</p>
                         <h4 className="text-[10px] font-bold leading-tight truncate">{jobLabel(job)}</h4>
                         <p className="text-[8px] truncate">{jobServiceLabel(job)}</p>
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
          {/* Month navigation header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-foreground/5">
            <button onClick={() => setCalendarMonth(m => { const d = new Date(m.year, m.month - 1); return { year: d.getFullYear(), month: d.getMonth() }; })} className="p-2 hover:bg-card rounded-full transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <h3 className="text-base font-black uppercase tracking-tight">
              {new Date(calendarMonth.year, calendarMonth.month).toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' })}
            </h3>
            <button onClick={() => setCalendarMonth(m => { const d = new Date(m.year, m.month + 1); return { year: d.getFullYear(), month: d.getMonth() }; })} className="p-2 hover:bg-card rounded-full transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
          <div className="grid grid-cols-7 border-b border-border">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} className="px-2 py-3 text-center text-[10px] font-bold uppercase text-muted border-r border-border last:border-0">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {(() => {
              const firstDay = new Date(calendarMonth.year, calendarMonth.month, 1);
              const lastDay = new Date(calendarMonth.year, calendarMonth.month + 1, 0);
              const startOffset = (firstDay.getDay() + 6) % 7; // Mon=0
              const totalDays = lastDay.getDate();
              const cells = startOffset + totalDays;
              const rows = Math.ceil(cells / 7);
              const today = new Date();
              return [...Array(rows * 7)].map((_, i) => {
                const dayNum = i - startOffset + 1;
                const isValid = dayNum >= 1 && dayNum <= totalDays;
                const cellDate = isValid ? new Date(calendarMonth.year, calendarMonth.month, dayNum) : null;
                const isToday = cellDate && cellDate.toDateString() === today.toDateString();
                const iso = cellDate ? localISO(cellDate) : '';
                const dayJobs = iso ? jobsOnDate(iso) : [];
                return (
                  <div
                    key={i}
                    className={cn("border-r border-b border-border p-2 min-h-[80px] relative", isValid ? 'hover:bg-foreground/[0.03] transition-colors cursor-pointer' : 'bg-foreground/[0.02]')}
                    onClick={() => { if (isValid && iso) { setCalendarDayDate(iso); setCalendarView('day'); } }}
                  >
                    {isValid && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className={cn("text-xs font-bold", isToday ? 'w-6 h-6 rounded-full bg-torqued-red text-white flex items-center justify-center text-[10px]' : 'text-muted')}>{dayNum}</span>
                          {(() => {
                            const n = new Set(rosterShifts.filter(s => s.shift_date === iso).map(s => s.staff_id)).size;
                            return n > 0 ? <span className="text-[8px] font-black text-torqued-red">{n} on</span> : null;
                          })()}
                        </div>
                        {dayJobs.slice(0, 3).map((job: any) => (
                          <div
                            key={job.id}
                            onClick={(e) => { e.stopPropagation(); openJobFromCalendar(job); }}
                            className={cn("mt-1 p-1 text-white text-[8px] font-bold rounded uppercase leading-tight truncate",
                            job.status === 'completed' ? 'bg-emerald-500' : job.status === 'in_progress' ? 'bg-torqued-red' : 'bg-blue-500')}>
                            {jobLabel(job).split('(')[0].trim()}
                          </div>
                        ))}
                        {dayJobs.length > 3 && <p className="text-[8px] text-muted font-bold mt-0.5">+{dayJobs.length - 3} more</p>}
                      </>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </Card>
      ) : (() => {
        const dayJobs = jobsOnDate(calendarDayDate).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const shiftDate = (delta: number) => { const d = new Date(calendarDayDate + 'T00:00:00'); d.setDate(d.getDate() + delta); setCalendarDayDate(localISO(d)); };
        const dayRevenue = dayJobs.reduce((s: number, j: any) => s + (parseFloat(j.total_price) || 0), 0);
        return (
        <Card className="p-6 space-y-6">
          <div className="flex gap-4 items-center justify-between border-b border-border pb-4 flex-wrap">
             <div className="flex items-center gap-4">
                <button onClick={() => shiftDate(-1)} className="p-2 hover:bg-card rounded-full text-foreground"><ChevronLeft size={20} /></button>
                <h3 className="text-xl font-bold uppercase tracking-tight text-foreground">{new Date(calendarDayDate + 'T00:00:00').toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3>
                <button onClick={() => shiftDate(1)} className="p-2 hover:bg-card rounded-full text-foreground"><ChevronRight size={20} /></button>
             </div>
             <Button variant="outline" size="sm" className="border-border text-foreground" onClick={() => setCalendarDayDate(localISO(new Date()))}>Today</Button>
          </div>
          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-background border border-border rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-foreground">{dayJobs.length}</p>
              <p className="text-[10px] font-bold uppercase text-muted">Jobs scheduled</p>
            </div>
            <div className="bg-background border border-border rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-foreground">{dayJobs.filter((j: any) => j.status === 'completed').length}</p>
              <p className="text-[10px] font-bold uppercase text-muted">Completed</p>
            </div>
            <div className="bg-background border border-border rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-foreground">{formatCurrency(dayRevenue)}</p>
              <p className="text-[10px] font-bold uppercase text-muted">Scheduled revenue</p>
            </div>
          </div>
          <div className="space-y-3">
            {dayJobs.length === 0 && <p className="text-sm text-muted italic text-center py-8">No confirmed jobs scheduled for this day.</p>}
            {dayJobs.map((job: any) => (
              <div key={job.id} className="flex gap-6 items-start p-4 hover:bg-foreground/[0.03] rounded-2xl transition-all group cursor-pointer" onClick={() => openJobFromCalendar(job)}>
                <div className="w-16 text-sm font-bold text-muted pt-1">{new Date(job.date).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' })}</div>
                <div className={cn(
                  "w-1 h-12 rounded-full shrink-0",
                  job.status === 'completed' ? "bg-emerald-500" : job.status === 'in_progress' ? "bg-torqued-red" : "bg-blue-500"
                )} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <h4 className="text-lg font-bold text-foreground truncate">{jobLabel(job)}</h4>
                      <p className="text-sm text-muted truncate">{jobServiceLabel(job)}</p>
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold uppercase px-2 py-0.5 rounded shrink-0",
                      job.status === 'in_progress' ? "bg-torqued-red text-white" : "bg-foreground/5 text-muted"
                    )}>
                      {job.status === 'in_progress' ? 'In Progress' : job.status}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={(e) => { e.stopPropagation(); openJobFromCalendar(job); }}
                >
                  View Details
                </Button>
              </div>
            ))}
          </div>
        </Card>
        );
      })()}

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
          <div className="flex items-center gap-3">
            <Button
              disabled={ohSaving || !user}
              className="bg-torqued-red text-white"
              onClick={async () => {
                if (!user) return;
                setOhSaving(true); setOhStatus('idle'); setOhError(null);
                try {
                  const r = await fetch('/api/mechanic/availability/replace', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mechanicId: user.id, slots: operatingHours.filter(o => o.enabled).map(o => ({ day_of_week: o.dayOfWeek, start_time: o.startTime, end_time: o.endTime })) }),
                  });
                  const d = await r.json();
                  if (!r.ok) { setOhStatus('error'); setOhError(d.error || 'Could not save hours. Please try again.'); return; }
                  if (d.slots) setMechAvailability(d.slots);
                  setOhStatus('saved');
                  setTimeout(() => setOhStatus('idle'), 3000);
                } catch { setOhStatus('error'); setOhError('Connection error. Please try again.'); }
                finally { setOhSaving(false); }
              }}
            >{ohSaving ? 'Saving…' : 'Save Operating Hours'}</Button>
            {ohStatus === 'saved' && <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">✓ Saved</span>}
            {ohStatus === 'error' && <span className="text-xs text-torqued-red font-bold">{ohError}</span>}
          </div>
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
                    setClosedSaving(true); setClosedError(null); setClosedSuccess(false);
                    try {
                      const r = await fetch('/api/mechanic/closed-periods', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ mechanicId: user.id, startDate: newClosedPeriod.startDate, endDate: newClosedPeriod.endDate || newClosedPeriod.startDate, reason: newClosedPeriod.reason }),
                      });
                      const d = await r.json();
                      if (!r.ok) { setClosedError(d.error || 'Could not save. Please try again.'); return; }
                      if (d.period) {
                        setClosedPeriods(prev => [...prev, d.period]);
                        setNewClosedPeriod({ startDate: '', endDate: '', reason: '' });
                        setClosedSuccess(true);
                        setTimeout(() => setClosedSuccess(false), 3000);
                      } else {
                        setClosedError('Unexpected response from server.');
                      }
                    } catch { setClosedError('Connection error. Please try again.'); }
                    finally { setClosedSaving(false); }
                  }}
                >{closedSaving ? '…' : <><Plus size={12} className="mr-1 inline" />Block</>}</Button>
              </div>
            </div>
          </div>
          {closedError && <p className="text-xs text-torqued-red font-bold">{closedError}</p>}
          {closedSuccess && <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">✓ Period blocked — customers won't be able to book these dates.</p>}
          <p className="text-xs text-muted">Customers won't be able to book drop-offs during blocked periods. NZ public holidays are automatically excluded from the cancellation notice window.</p>
        </Card>
      )}

      {/* Roster Shift Modal */}
      {shiftModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShiftModal(null)}>
          <div className="bg-background border border-border rounded-2xl p-6 shadow-2xl w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-foreground">Roster Shift</h3>
              <button onClick={() => setShiftModal(null)} className="text-muted hover:text-foreground"><X size={16} /></button>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">Staff Member</label>
              <select value={shiftModal.staffId} onChange={e => setShiftModal(m => m ? { ...m, staffId: e.target.value } : m)} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-torqued-red">
                {rosterStaff.map(st => <option key={st.id} value={st.id}>{st.name}{st.role ? ` · ${st.role}` : ''}</option>)}
              </select>
            </div>
            <p className="text-xs text-muted">{new Date(shiftModal.date + 'T00:00:00').toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">Start</label>
                <input type="time" value={shiftModal.startTime} onChange={e => setShiftModal(m => m ? { ...m, startTime: e.target.value } : m)} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-torqued-red" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">End</label>
                <input type="time" value={shiftModal.endTime} onChange={e => setShiftModal(m => m ? { ...m, endTime: e.target.value } : m)} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-torqued-red" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">Break from <span className="text-muted/50 normal-case">(opt)</span></label>
                <input type="time" value={shiftModal.breakStart} onChange={e => setShiftModal(m => m ? { ...m, breakStart: e.target.value } : m)} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-torqued-red" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">Break to <span className="text-muted/50 normal-case">(opt)</span></label>
                <input type="time" value={shiftModal.breakEnd} onChange={e => setShiftModal(m => m ? { ...m, breakEnd: e.target.value } : m)} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-torqued-red" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShiftModal(null)}>Cancel</Button>
              <Button className="bg-emerald-500 text-white" disabled={!user || !shiftModal.staffId} onClick={async () => {
                if (!user || !shiftModal) return;
                const r = await fetch('/api/mechanic/roster/shift', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ mechanicId: user.id, staffId: shiftModal.staffId, shiftDate: shiftModal.date, startTime: shiftModal.startTime, endTime: shiftModal.endTime, breakStart: shiftModal.breakStart || null, breakEnd: shiftModal.breakEnd || null }),
                });
                const d = await r.json();
                if (d.shift) { setRosterShifts(prev => [...prev, d.shift]); setShiftModal(null); }
                else alert(d.error || 'Could not save shift.');
              }}>Roster On</Button>
            </div>
          </div>
        </div>
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
  };

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
                setModalInsights([]);
              }}
              className="p-2 hover:bg-background rounded-full transition-colors text-muted hover:text-foreground border border-transparent hover:border-border"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-background">
            {/* AI Health Insights + Vehicle Timeline */}
            <VehicleTimelineAnalysis rego={job.reg} onInsightsLoaded={setModalInsights} />

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
              setModalInsights([]);
            }} className="border-border text-foreground hover:bg-background">Close Report</Button>
            <Button className="bg-torqued-red text-white" onClick={async () => {
              const { jsPDF } = await import('jspdf');
              const doc = new jsPDF({ unit: 'mm', format: 'a4' });
              const red: [number, number, number] = [220, 38, 38];
              const dark: [number, number, number] = [17, 17, 17];
              const muted: [number, number, number] = [120, 120, 120];
              let y = 18;

              // Header
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(8);
              doc.setTextColor(...red);
              doc.text('VEHICLE HEALTH REPORT — TORQUED NZ', 14, y);
              y += 8;
              doc.setFontSize(20);
              doc.setTextColor(...dark);
              doc.text(`${job.reg}: ${job.model}`, 14, y);
              y += 7;
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(8);
              doc.setTextColor(...muted);
              doc.text(`STATUS: ${(job.status || '').toUpperCase()}  •  PRINTED: ${new Date().toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' })}`, 14, y);
              y += 10;

              // Divider
              doc.setDrawColor(...red);
              doc.setLineWidth(0.4);
              doc.line(14, y, 196, y);
              y += 8;

              // AI Health Insights
              if (modalInsights.length > 0) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(...dark);
                doc.text('AI HEALTH INSIGHTS', 14, y);
                y += 6;

                const cols = [14, 107];
                let col = 0;
                let rowY = y;
                let maxRowY = y;

                for (const ins of modalInsights) {
                  const x = cols[col];
                  const boxW = 90;
                  const lines = doc.splitTextToSize(ins.detail, boxW - 6);
                  const boxH = 6 + lines.length * 4.5 + 3;

                  const c: [number, number, number] =
                    ins.severity === 'good' ? [16, 185, 129] :
                    ins.severity === 'due' ? [245, 158, 11] :
                    ins.severity === 'overdue' ? [220, 38, 38] : [100, 100, 100];

                  doc.setDrawColor(...c);
                  doc.setFillColor(255, 255, 255);
                  doc.roundedRect(x, rowY, boxW, boxH, 3, 3, 'FD');

                  doc.setFont('helvetica', 'bold');
                  doc.setFontSize(8);
                  doc.setTextColor(...c);
                  doc.text(ins.title.toUpperCase(), x + 3, rowY + 5);

                  doc.setFont('helvetica', 'normal');
                  doc.setFontSize(7.5);
                  doc.setTextColor(...dark);
                  doc.text(lines, x + 3, rowY + 10);

                  maxRowY = Math.max(maxRowY, rowY + boxH);
                  col++;
                  if (col === 2) { col = 0; rowY = maxRowY + 3; maxRowY = rowY; }
                }
                y = maxRowY + 8;
              }

              // Service History
              if (jobHistory.length > 0) {
                if (y > 220) { doc.addPage(); y = 18; }
                doc.setDrawColor(220, 220, 220);
                doc.setLineWidth(0.2);
                doc.line(14, y, 196, y);
                y += 7;

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(...dark);
                doc.text('SERVICE HISTORY', 14, y);
                y += 6;

                for (const h of jobHistory) {
                  if (y > 265) { doc.addPage(); y = 18; }
                  doc.setFont('helvetica', 'bold');
                  doc.setFontSize(8);
                  doc.setTextColor(...dark);
                  const dateStr = h.service_date || h.date || '';
                  const kmStr = h.mileage ? ` · ${Number(h.mileage).toLocaleString()} km` : '';
                  doc.text(`${dateStr}${kmStr}`, 14, y);
                  y += 4.5;
                  doc.setFont('helvetica', 'normal');
                  doc.setFontSize(7.5);
                  doc.setTextColor(...muted);
                  const desc = h.work_done || h.service || '';
                  const lines = doc.splitTextToSize(desc, 180);
                  doc.text(lines, 14, y);
                  y += lines.length * 4 + 3;
                }
              }

              // Footer
              const pageCount = (doc as any).internal.getNumberOfPages();
              for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                doc.setTextColor(...muted);
                doc.text('Generated by Torqued NZ — torqued.site', 14, 290);
                doc.text(`Page ${i} of ${pageCount}`, 190, 290, { align: 'right' });
              }

              doc.save(`${job.reg}-health-report-${new Date().toISOString().slice(0, 10)}.pdf`);
            }}>Print Summary</Button>
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
          email: j.email || j.customer_email || '',
          phone: j.customer_phone || '',
          model: j.customer_name ? `${j.vehicle_rego} — ${j.customer_name}` : j.vehicle_rego || 'Vehicle',
          vehicleLabel: j.vehicle_label || j.vehicle_rego || '',
          mileage: j.vehicle_mileage || null,
          year: j.vehicle_year || null,
          make: j.vehicle_make || '',
          vehicleModel: j.vehicle_model || '',
          services: (j.service_ids || []).map((id: string) => SERVICES.find(s => s.id === id)?.name || id),
          suggestedQuote: parseFloat(j.total_price) || 0,
          quoteItems: j.quote_items || null,
        };
        return (
          <Card key={j.id} className="p-4 sm:p-5 bg-card border-border space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {j.vehicle_rego && <span className="torqued-badge text-[10px]">{j.vehicle_rego}</span>}
                  {j.is_cold_quote && <span className="text-[9px] uppercase font-black tracking-widest bg-torqued-red/10 text-torqued-red px-1.5 py-0.5 rounded">Cold quote</span>}
                  {j.transaction_id && <span className="text-[9px] uppercase font-black tracking-widest bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded">Linked job</span>}
                </div>
                {(() => {
                  const custName = j.customer_name && j.customer_name !== j.vehicle_rego ? j.customer_name : null;
                  const carDesc = j.vehicle_label || (j.vehicle_make ? `${j.vehicle_year ? j.vehicle_year + ' ' : ''}${j.vehicle_make}${j.vehicle_model ? ' ' + j.vehicle_model : ''}`.trim() : null);
                  return (
                    <div>
                      <p className="font-black text-foreground">{custName || j.vehicle_rego || 'Unknown Vehicle'}</p>
                      {carDesc && <p className="text-xs text-muted">{carDesc}</p>}
                      {custName && (j.email || j.customer_email || j.customer_phone) && (
                        <p className="text-[11px] text-muted">{j.email || j.customer_email || ''}{j.customer_phone ? ` · ${j.customer_phone}` : ''}</p>
                      )}
                    </div>
                  );
                })()}
                <p className="text-xs text-muted">{j.quote_items ? jobSummaryTitle(j) : (jobShape.services.join(', ') || jobSummaryTitle(j))}</p>
                <p className="text-[11px] text-muted flex items-center gap-1">
                  {j.date || '—'} {j.status === 'completed' && <span className="text-emerald-600 font-bold">✓</span>} · <span className="uppercase font-bold">{j.status}</span> · {j.payment_status === 'confirmed' ? 'Paid' : (j.payment_status || 'unpaid')}
                  {j.mileage_in ? ` · in ${Number(j.mileage_in).toLocaleString()}km` : ''}{j.mileage_out ? ` · out ${Number(j.mileage_out).toLocaleString()}km` : ''}
                </p>
                {j.description && j.description !== j.customer_name && <p className="text-xs text-muted italic mt-0.5">&ldquo;{j.description}&rdquo;</p>}
              </div>
              <div className="text-right shrink-0 space-y-1">
                <span className="font-black text-torqued-red block">{formatCurrency(parseFloat(j.quoted_price ?? j.total_price) || 0)}</span>
                {(j.customer_name || j.email) && (
                  <button onClick={() => { setActiveTab('customers'); setCustSearch(j.customer_name || j.email || ''); }}
                    className="text-[10px] text-torqued-red/70 hover:text-torqued-red underline underline-offset-2">View profile →</button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(j.service_ids || []).includes('ppi') && j.status !== 'completed' && (
                <Button size="sm" className="bg-torqued-red text-white" onClick={() => {
                  setPpiPreloadRego(j.vehicle_rego || '');
                  setPpiPreloadName(j.customer_name && j.customer_name !== j.vehicle_rego ? j.customer_name : '');
                  setPpiPreloadEmail(j.email || j.customer_email || '');
                  setPpiPreloadMileage(j.mileage_in ? String(j.mileage_in) : '');
                  setActiveTab('health'); setHealthSubtab('ppi');
                }}>Start PPI</Button>
              )}
              {(j.service_ids || []).includes('ppi') && j.status === 'completed' && (
                <Button size="sm" variant="outline" className="text-foreground border-border hover:bg-background" onClick={() => {
                  setPpiPreloadRego(j.vehicle_rego || '');
                  setPpiPreloadName(j.customer_name && j.customer_name !== j.vehicle_rego ? j.customer_name : '');
                  setPpiPreloadEmail(j.email || j.customer_email || '');
                  setPpiPreloadMileage(j.mileage_out ? String(j.mileage_out) : j.mileage_in ? String(j.mileage_in) : '');
                  setActiveTab('health'); setHealthSubtab('ppi');
                }}>Download PPI Report</Button>
              )}
              <Button size="sm" variant="outline" className="text-foreground border-border hover:bg-background" onClick={() => openQuoteEditor(jobShape)}>Edit / Build Quote</Button>
              <Button size="sm" variant="outline" className="text-foreground border-border hover:bg-background" onClick={() => messageCustomer(jobShape)}>Message Customer</Button>
              {j.status === 'in_progress' && (
                <Button size="sm" variant="outline" className="text-blue-500 border-border hover:bg-background" onClick={() => { setRescheduleModal({ job: jobShape }); setRescheduleDate(''); setRescheduleComment(''); }}>Request Reschedule</Button>
              )}
              <Button size="sm" variant="outline" className="text-foreground border-border hover:bg-background" onClick={() => recordMileage(jobShape, 'out')}>Check-out km</Button>
              <Button size="sm" variant="outline" className="text-emerald-600 border-border hover:bg-background" onClick={() => exportInvoice(j)}>{j.payment_status === 'confirmed' ? 'Export invoice' : 'Download PDF'}</Button>
              {j.status === 'completed' && j.payment_status === 'confirmed' && (
                <Button size="sm" variant="outline" className="text-amber-500 border-border hover:bg-background" onClick={() => { setRefundModal({ job: j }); setRefundAmount(''); setRefundReason(''); }}>Refund</Button>
              )}
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
    // A job is "active" once it's accepted OR paid (incl. paid cold quotes) — but not completed.
    const isActiveJob = (j: any) => j.status !== 'completed' && (j.status === 'in_progress' || j.status === 'booked' || j.payment_status === 'confirmed');
    const accepted = pastJobs.filter(isActiveJob);
    const todayJobs = accepted.filter((j: any) => isToday(j.date));
    const upcoming = accepted.filter((j: any) => j.date && new Date(j.date).getTime() > Date.now() && !isToday(j.date));
    // Cold quotes still awaiting payment/acceptance only — paid ones move into the active lists above.
    const coldQuotes = pastJobs.filter((j: any) => j.is_cold_quote && !isActiveJob(j) && j.status !== 'completed');
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
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" className="text-foreground border-border" onClick={() => openEditCustomer(c)}>Edit</Button>
            <Button size="sm" variant="outline" className="text-foreground border-border" onClick={() => {
              setColdForm({ customerName: c.name || '', email: c.email || '', phone: c.phone || '', rego: c.regos?.[0] || '', make: '', model: '', description: '', date: '' });
              setShowColdQuote(true);
            }}>New quote</Button>
          </div>
        </Card>
      ))}

      {editCustomer && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-foreground/30 backdrop-blur-sm" onClick={() => !editCustBusy && setEditCustomer(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-background border border-border rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-foreground">Edit customer</h3>
              <button onClick={() => setEditCustomer(null)} className="text-muted hover:text-foreground text-xl">✕</button>
            </div>
            {editCustomer.regos?.length ? <p className="text-xs text-muted">Vehicles: {editCustomer.regos.join(', ')}</p> : null}
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">Name</label>
                <input value={editCustForm.name} onChange={e => setEditCustForm(f => ({ ...f, name: e.target.value }))} placeholder="Customer name"
                  className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-torqued-red" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">Email</label>
                <input type="email" value={editCustForm.email} onChange={e => setEditCustForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com"
                  className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-torqued-red" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">Phone</label>
                <input value={editCustForm.phone} onChange={e => setEditCustForm(f => ({ ...f, phone: e.target.value }))} placeholder="021 234 5678"
                  className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-torqued-red" />
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 border-border text-foreground" disabled={editCustBusy} onClick={() => setEditCustomer(null)}>Cancel</Button>
              <Button className="flex-1 bg-torqued-red text-white" disabled={editCustBusy || !editCustForm.name.trim()} onClick={saveEditCustomer}>{editCustBusy ? 'Saving…' : 'Save changes'}</Button>
            </div>
          </div>
        </div>
      )}
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

  const renderVehicleHealth = () => (
    <div className="space-y-5">
      <div className="flex gap-2">
        <button onClick={() => setHealthSubtab('health')}
          className={cn('px-4 h-9 rounded-xl text-xs font-black uppercase tracking-wider transition-all', healthSubtab === 'health' ? 'bg-torqued-red text-white' : 'bg-card border border-border text-muted hover:text-foreground')}>Health Lookup</button>
        <button onClick={() => setHealthSubtab('ppi')}
          className={cn('px-4 h-9 rounded-xl text-xs font-black uppercase tracking-wider transition-all', healthSubtab === 'ppi' ? 'bg-torqued-red text-white' : 'bg-card border border-border text-muted hover:text-foreground')}>Pre-Purchase Inspection</button>
      </div>
      {healthSubtab === 'health'
        ? <VehicleHealthLookup mechanicId={user?.id} />
        : <PrePurchaseInspection key={ppiPreloadRego || 'ppi'} mechanicId={user?.id} workshopName={profileData.name} workshopAddress={profileData.address} initialRego={ppiPreloadRego || undefined} initialCustomerName={ppiPreloadName || undefined} initialCustomerEmail={ppiPreloadEmail || undefined} initialMileage={ppiPreloadMileage || undefined} />}
    </div>
  );

  // ── Contract PDF generation ───────────────────────────────────────────────────
  const generateContractPdf = (signerTitle: string): string => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = 210;
    const margin = 15;
    const contentW = pageW - margin * 2;
    let y = 20;

    const addPage = () => { doc.addPage(); y = 20; };
    const checkY = (needed = 10) => { if (y + needed > 277) addPage(); };

    const writeText = (text: string, size: number, bold = false, color: [number, number, number] = [0, 0, 0]) => {
      doc.setFontSize(size);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(text, contentW);
      checkY(lines.length * (size * 0.4));
      doc.text(lines, margin, y);
      y += lines.length * (size * 0.4) + 2;
    };

    const writePara = (text: string) => {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 30, 30);
      const lines = doc.splitTextToSize(text, contentW);
      checkY(lines.length * 4);
      doc.text(lines, margin, y);
      y += lines.length * 4 + 3;
    };

    const writeSection = (title: string) => {
      checkY(14);
      y += 4;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 24, 0);
      doc.text(title, margin, y);
      y += 6;
      doc.setTextColor(0, 0, 0);
    };

    const today = new Date();
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const todayStr = `${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;
    const workshopName = ob.legal_name || ob.name || '[Workshop]';
    const tradingName = ob.name || '[Trading Name]';
    const address = ob.address ? `${ob.address}, New Zealand` : '[Workshop Address], New Zealand';
    const nzbn = ob.nzbn || '[NZBN]';
    const gst = (ob as any).gst_number || 'Not registered';
    const signerName = ob.owner_name || '[Signer Name]';
    const title = signerTitle || 'Owner';
    const now = new Date();
    const h = now.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hh = String(h > 12 ? h - 12 : h === 0 ? 12 : h).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const mechSignedAt = `${dd}/${mo}/${yyyy} at ${hh}:${mm} ${ampm}`;

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(21, 4, 2);
    doc.text('TORQUED', margin, 12);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 24, 0);
    doc.text('NZ MECHANIC PLATFORM', margin + 30, 12);
    doc.setFillColor(255, 24, 0);
    doc.rect(0, 18, 210, 2, 'F');
    y = 28;

    writeText('TORQUED NZ MECHANIC PLATFORM AGREEMENT', 14, true, [21, 4, 2]);
    y += 2;
    writeText(`Date: ${todayStr}`, 9, false, [80, 80, 80]);
    y += 3;

    // Parties
    writeSection('PARTIES');
    writePara(`This Mechanic Platform Agreement ("Agreement") is entered into as of ${todayStr} between:`);
    writePara(`Platform Operator: Torqued Limited, a company incorporated in New Zealand ("Torqued"), operating the Torqued platform at torqued.site.`);
    writePara(`Workshop / Service Partner: ${workshopName} ("Workshop" or "Partner"), trading as: ${tradingName}, of ${address}, NZBN: ${nzbn}, GST Number: ${gst}.`);
    writePara(`Together referred to as the "Parties."`);

    writeSection('1. DEFINITIONS');
    writePara(`1.1 "Platform" means the Torqued web and mobile application, APIs, and associated infrastructure operated by Torqued.`);
    writePara(`1.2 "Services" means the automotive repair, maintenance, and diagnostic services offered by the Workshop through the Platform.`);
    writePara(`1.3 "Customer" means any individual or entity that books Services through the Platform.`);
    writePara(`1.4 "Booking" means a confirmed appointment made by a Customer for Services through the Platform.`);
    writePara(`1.5 "Commission" means the fee payable to Torqued as a percentage of each completed Booking's total invoiced value.`);
    writePara(`1.6 "Subscription Fee" means the recurring monthly fee payable by the Workshop to access the Platform.`);
    writePara(`1.7 "Payout" means the net payment made to the Workshop after deducting Commission and applicable fees.`);

    writeSection('2. PLATFORM ACCESS & SUBSCRIPTION');
    writePara(`2.1 Subscription Fee: The Workshop agrees to pay Torqued a subscription fee of NZD $99.00 per month (inclusive of GST) for access to the Platform, billed monthly in advance via the Workshop's nominated payment method through Stripe.`);
    writePara(`2.2 Billing Start Date: Billing shall commence on the date agreed during onboarding (the "Billing Start Date"). The Workshop may configure its profile and add services before the Billing Start Date, but listing visibility and the ability to accept Bookings will only activate from the Billing Start Date.`);
    writePara(`2.3 Trial Periods: Where Torqued grants a trial period, no subscription fee is charged during that period. On expiry of the trial period, the standard subscription fee applies automatically unless the Workshop cancels before the trial ends.`);
    writePara(`2.4 Promotional Pricing: Where Torqued offers promotional pricing (e.g. 50% discount for the first three months), such pricing is as described at the time of signup and is subject to Torqued's discretion to modify or withdraw.`);
    writePara(`2.5 Cancellation: Either Party may cancel this Agreement by providing 30 days' written notice. Subscription fees are non-refundable for the current billing period on cancellation.`);

    writeSection('3. COMMISSION & PAYOUTS');
    writePara(`3.1 Commission Rate: Torqued charges a commission of 4% (plus GST) on the total invoiced value of each completed Booking facilitated through the Platform.`);
    writePara(`3.2 Payout Schedule: Torqued will process Payouts to the Workshop's nominated NZ bank account on a weekly basis (each Monday for the prior week's completed Bookings), subject to all funds having been received from Customers.`);
    writePara(`3.3 Payment Processing: Customer payments are processed through Stripe. Torqued acts as the merchant of record for Customer-facing transactions. Payouts to the Workshop will be net of Commission and any Stripe processing fees.`);
    writePara(`3.4 GST: All fees and commissions stated are exclusive of GST unless otherwise specified. Where the Workshop is GST-registered, GST will be added to commissions and subscription fees as applicable.`);
    writePara(`3.5 Disputes: In the event of a disputed payment, Torqued reserves the right to withhold Payout pending resolution, not to exceed 30 days.`);

    writeSection('4. WORKSHOP OBLIGATIONS');
    writePara(`4.1 The Workshop agrees to: (a) maintain all necessary licences, certifications, and registrations required under New Zealand law to provide the Services; (b) provide Services to the standard of a reasonably competent automotive professional; (c) comply with all applicable New Zealand legislation, including (without limitation) the Consumer Guarantees Act 1993 ("CGA"), the Fair Trading Act 1986, the Health and Safety at Work Act 2015, and the Privacy Act 2020; (d) respond to Booking requests within the timeframes specified on the Platform (or within 24 hours where no timeframe is specified); (e) honour confirmed Bookings unless cancellation is permitted under this Agreement; (f) maintain adequate public liability insurance (minimum $1,000,000 per event) and notify Torqued of any material change to coverage; (g) promptly notify Torqued of any complaint, claim, or regulatory investigation relating to Services provided through the Platform.`);
    writePara(`4.2 Pricing Accuracy: The Workshop is solely responsible for setting accurate and lawful prices for Services on the Platform. Torqued bears no liability for pricing errors made by the Workshop.`);
    writePara(`4.3 Consumer Guarantees Act Compliance: The Workshop acknowledges that Services provided to consumers are subject to guarantees under the CGA and agrees to resolve any CGA claims in accordance with the Act. Torqued may facilitate resolution but is not liable for Workshop obligations under the CGA.`);

    writeSection('5. TORQUED OBLIGATIONS');
    writePara(`5.1 Torqued agrees to: (a) provide the Workshop with access to the Platform in accordance with this Agreement; (b) process Customer payments in a timely manner and make Payouts in accordance with clause 3.2; (c) provide reasonable technical support for Platform-related issues; (d) maintain reasonable security standards for data processed through the Platform; (e) notify the Workshop of any material changes to Platform fees or terms with at least 30 days' notice.`);
    writePara(`5.2 Platform Availability: Torqued does not guarantee uninterrupted access to the Platform and may perform maintenance that temporarily affects availability. Torqued will endeavour to provide advance notice of planned outages.`);

    writeSection('6. CANCELLATIONS & REFUNDS');
    writePara(`6.1 Cancellation Policy: The Workshop's cancellation policy (as configured on the Platform) applies to Customer Bookings. The Workshop is responsible for honouring its stated policy.`);
    writePara(`6.2 Refunds: Where a Customer is entitled to a refund (whether under the Workshop's cancellation policy, the CGA, or otherwise), the Workshop authorises Torqued to process such refund from the Workshop's Payout. Torqued will notify the Workshop of any refund processed.`);
    writePara(`6.3 Disputes Between Workshop and Customer: Torqued may, at its discretion, facilitate dispute resolution between the Workshop and Customer but is not obligated to do so and bears no liability for the outcome of any dispute.`);

    writeSection('7. INTELLECTUAL PROPERTY');
    writePara(`7.1 Platform IP: All intellectual property in the Platform (including software, trademarks, and content developed by Torqued) remains the exclusive property of Torqued.`);
    writePara(`7.2 Workshop Content: The Workshop grants Torqued a non-exclusive, royalty-free licence to use the Workshop's trading name, logo, descriptions, and photos on the Platform for the purpose of providing the Services.`);
    writePara(`7.3 Restrictions: The Workshop must not reverse-engineer, copy, or create derivative works from the Platform or its underlying technology.`);

    writeSection('8. PRIVACY & DATA');
    writePara(`8.1 Data Handling: Torqued collects and handles personal information in accordance with its Privacy Policy at torqued.site/privacy and the Privacy Act 2020.`);
    writePara(`8.2 Customer Data: The Workshop acknowledges that Customer personal information accessed through the Platform may only be used for the purpose of providing Services under a confirmed Booking and must not be used for unsolicited marketing, sold to third parties, or retained beyond what is necessary under applicable law.`);
    writePara(`8.3 Data Breach: Each Party must promptly notify the other of any actual or reasonably suspected data breach affecting the other's data.`);

    writeSection('9. LIABILITY & INDEMNITY');
    writePara(`9.1 Limitation of Liability: To the maximum extent permitted by New Zealand law, Torqued's total liability to the Workshop under or in connection with this Agreement is limited to the total subscription fees paid by the Workshop in the 3 months immediately preceding the event giving rise to the claim.`);
    writePara(`9.2 Excluded Loss: Torqued is not liable for any indirect, consequential, special, or punitive loss, including loss of profit, revenue, or opportunity, arising from this Agreement.`);
    writePara(`9.3 Workshop Indemnity: The Workshop indemnifies Torqued against any claim, loss, damage, or expense (including legal costs) arising from: (a) the Workshop's breach of this Agreement; (b) the Workshop's provision of (or failure to provide) Services; (c) any infringement by the Workshop of a third party's intellectual property; or (d) the Workshop's non-compliance with applicable law.`);
    writePara(`9.4 Consumer Law: Nothing in this Agreement limits any rights the Workshop may have under the Consumer Guarantees Act 1993 or the Fair Trading Act 1986 where those Acts apply.`);

    writeSection('10. TERM & TERMINATION');
    writePara(`10.1 Term: This Agreement commences on the date it is signed and continues until terminated in accordance with this clause.`);
    writePara(`10.2 Termination by Notice: Either Party may terminate this Agreement on 30 days' written notice to the other Party at legal@torquedapp.nz.`);
    writePara(`10.3 Immediate Termination: Torqued may terminate this Agreement immediately and without notice if the Workshop: (a) breaches any material provision of this Agreement and fails to remedy the breach within 7 days of notice; (b) becomes insolvent or enters liquidation or receivership; (c) engages in fraudulent, illegal, or seriously harmful conduct; or (d) receives repeated Customer complaints that Torqued reasonably considers to reflect a systemic failure in service quality.`);
    writePara(`10.4 Effect of Termination: On termination: (a) all outstanding Payouts owed to the Workshop will be paid within 14 days, net of any amounts owed to Torqued; (b) the Workshop's access to the Platform will be suspended; and (c) clauses 7, 8, 9, and 11 survive termination.`);

    writeSection('11. GOVERNING LAW & DISPUTES');
    writePara(`11.1 Governing Law: This Agreement is governed by the laws of New Zealand.`);
    writePara(`11.2 Dispute Resolution: The Parties agree to attempt to resolve any dispute in good faith through negotiation before initiating legal proceedings. If the dispute is not resolved within 20 business days of one Party giving written notice, either Party may refer the dispute to mediation under the AMINZ mediation rules, or (if mediation fails) to arbitration or the courts of New Zealand.`);
    writePara(`11.3 Consumer Disputes: Nothing in this clause limits the Workshop's right to make a complaint to the Commerce Commission or bring proceedings in the Disputes Tribunal.`);

    writeSection('12. GENERAL');
    writePara(`12.1 Entire Agreement: This Agreement constitutes the entire agreement between the Parties regarding its subject matter and supersedes all prior representations, discussions, or agreements.`);
    writePara(`12.2 Amendments: Torqued may amend this Agreement by providing at least 30 days' written notice to the Workshop. Continued use of the Platform after the effective date of an amendment constitutes acceptance.`);
    writePara(`12.3 Waiver: A failure by a Party to exercise a right under this Agreement does not constitute a waiver of that right.`);
    writePara(`12.4 Severability: If any provision of this Agreement is unenforceable, the remaining provisions continue in full force.`);
    writePara(`12.5 Notices: Notices under this Agreement may be given by email to the addresses on file for each Party. Torqued's legal contact is legal@torquedapp.nz.`);
    writePara(`12.6 Relationship: The Parties are independent contractors. Nothing in this Agreement creates an employment, partnership, agency, or joint venture relationship.`);

    // Signature block
    checkY(70);
    y += 6;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(21, 4, 2);
    doc.text('SIGNATURES', margin, y);
    y += 8;

    // Torqued signatory
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('For and on behalf of Torqued Limited:', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text('Signed: Sri Berry', margin, y); y += 5;
    doc.text('Title: Director / Co-Founder', margin, y); y += 5;
    doc.text('Date/Time: 15/06/2026 at 9:00 AM', margin, y); y += 10;

    // Workshop signatory
    doc.setFont('helvetica', 'bold');
    doc.text(`For and on behalf of ${workshopName}:`, margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(`Signed: ${signerName}`, margin, y); y += 5;
    doc.text(`Title: ${title}`, margin, y); y += 5;
    doc.text(`Trading as: ${tradingName}`, margin, y); y += 5;
    doc.text(`Date/Time: ${mechSignedAt}`, margin, y); y += 10;

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('By electronically signing this Agreement, the Workshop confirms it has read, understood, and agrees to be bound by its terms.', margin, y);

    return doc.output('datauristring').split(',')[1];
  };

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

  // Password setup — shown when mechanic arrived via magic link and hasn't set a password yet
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [passwordSetStatus, setPasswordSetStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [passwordSetError, setPasswordSetError] = useState<string | null>(null);
  const needsPassword = typeof window !== 'undefined' && localStorage.getItem('torqued_needs_password') === '1';

  // Self-contained reset/onboarding link: ?reset_token=<signed>. Captured once at mount.
  const [resetToken] = useState(() => new URLSearchParams(window.location.search).get('reset_token'));
  const [passwordSetConfirmed, setPasswordSetConfirmed] = useState(false);
  if (resetToken && !passwordSetConfirmed) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card border border-border rounded-3xl p-8 space-y-6 shadow-xl">
          <Logo />
          {passwordSetStatus === 'done' ? (
            <div className="space-y-4 text-center">
              <div className="w-14 h-14 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto"><CheckCircle2 size={28} /></div>
              <div className="space-y-1">
                <h2 className="text-2xl font-black tracking-tighter">Password set</h2>
                <p className="text-sm text-muted">Your password has been updated. Sign in below with your new password.</p>
              </div>
              <button
                className="w-full h-12 bg-torqued-red text-white rounded-xl font-bold text-sm"
                onClick={() => { window.history.replaceState({}, document.title, window.location.pathname); setPasswordSetConfirmed(true); }}
              >
                Continue to sign in →
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <h2 className="text-2xl font-black tracking-tighter">Set your password</h2>
                <p className="text-sm text-muted">Choose a password for your Torqued workshop account.</p>
              </div>
              <div className="space-y-3">
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password (min 8 characters)" className="w-full bg-background border border-border rounded-xl px-4 h-12 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-torqued-red" />
                <input type="password" value={newPasswordConfirm} onChange={e => setNewPasswordConfirm(e.target.value)} placeholder="Confirm password" className="w-full bg-background border border-border rounded-xl px-4 h-12 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-torqued-red" />
                {passwordSetError && <p className="text-xs text-torqued-red font-bold">{passwordSetError}</p>}
                <button
                  disabled={passwordSetStatus === 'saving' || newPassword.length < 8 || newPassword !== newPasswordConfirm}
                  className="w-full h-12 bg-torqued-red text-white rounded-xl font-bold text-sm disabled:opacity-40"
                  onClick={async () => {
                    if (newPassword !== newPasswordConfirm) { setPasswordSetError('Passwords do not match.'); return; }
                    if (newPassword.length < 8) { setPasswordSetError('Password must be at least 8 characters.'); return; }
                    setPasswordSetStatus('saving'); setPasswordSetError(null);
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 15000);
                    try {
                      const r = await fetch('/api/auth/set-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: resetToken, password: newPassword }), signal: controller.signal });
                      const d = await r.json();
                      if (!r.ok) { setPasswordSetStatus('error'); setPasswordSetError(d.error || 'Could not set password.'); return; }
                      setPasswordSetStatus('done');
                    } catch (e: any) {
                      setPasswordSetStatus('error');
                      setPasswordSetError(e?.name === 'AbortError' ? 'That took too long. Please check your connection and try again.' : (e?.message || 'Could not set password.'));
                    } finally { clearTimeout(timeout); }
                  }}
                >
                  {passwordSetStatus === 'saving' ? 'Setting password…' : 'Set password →'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (user && needsPassword && passwordSetStatus !== 'done') {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card border border-border rounded-3xl p-8 space-y-6 shadow-xl">
          <Logo />
          <div className="space-y-1">
            <h2 className="text-2xl font-black tracking-tighter">Set your password</h2>
            <p className="text-sm text-muted">You're in via a magic link. Create a password so you can sign in next time.</p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">New password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 8 characters" className="w-full bg-background border border-border rounded-xl px-4 h-12 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-torqued-red" />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">Confirm password</label>
              <input type="password" value={newPasswordConfirm} onChange={e => setNewPasswordConfirm(e.target.value)} placeholder="Repeat password" className="w-full bg-background border border-border rounded-xl px-4 h-12 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-torqued-red" />
            </div>
            {passwordSetError && <p className="text-xs text-torqued-red font-bold">{passwordSetError}</p>}
            <button
              disabled={passwordSetStatus === 'saving' || newPassword.length < 8 || newPassword !== newPasswordConfirm}
              className="w-full h-12 bg-torqued-red text-white rounded-xl font-bold text-sm disabled:opacity-40"
              onClick={async () => {
                if (newPassword !== newPasswordConfirm) { setPasswordSetError('Passwords do not match.'); return; }
                if (newPassword.length < 8) { setPasswordSetError('Password must be at least 8 characters.'); return; }
                setPasswordSetStatus('saving');
                setPasswordSetError(null);
                try {
                  const { error } = await supabase.auth.updateUser({ password: newPassword });
                  if (error) { setPasswordSetStatus('error'); setPasswordSetError(error.message); return; }
                  localStorage.removeItem('torqued_needs_password');
                  setPasswordSetStatus('done');
                } catch (e: any) { setPasswordSetStatus('error'); setPasswordSetError(e?.message || 'Could not set password.'); }
              }}
            >
              {passwordSetStatus === 'saving' ? 'Setting password…' : 'Set password & continue →'}
            </button>
            <button className="w-full text-xs text-muted hover:text-foreground py-2" onClick={() => { localStorage.removeItem('torqued_needs_password'); setPasswordSetStatus('done'); }}>
              Skip for now
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Wait for auth + onboarding-status to fully resolve before deciding what to render —
  // otherwise the paywall/login gate below briefly flashes while userProfile/onboardingComplete
  // are still their initial null values.
  if (!isAuthReady || (user && onboardingComplete === null)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-border border-t-torqued-red rounded-full animate-spin" />
      </div>
    );
  }

  // Onboarding wizard — shown after login, before subscription, until completed.
  // Also shown (jumped straight to the contract step) for admin-onboarded accounts
  // that have business details filled in but haven't signed the contract yet.
  if (user && (onboardingComplete === false || !agreementSigned)) {
    const obInput = "w-full bg-card border border-border rounded-xl px-4 h-12 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-torqued-red";
    const obLabel = "text-[10px] font-black uppercase tracking-widest text-muted block mb-1";
    const OB_STEPS = 5;
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-card border border-border rounded-3xl p-8 space-y-6 shadow-xl">
          <div className="flex items-center justify-between">
            <Logo />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted">Step {obStep + 1} of {OB_STEPS}</span>
          </div>
          <div className="h-1.5 bg-border rounded-full overflow-hidden"><div className="h-full bg-torqued-red transition-all" style={{ width: `${((obStep + 1)/OB_STEPS)*100}%` }} /></div>

          {/* Step 0: Email OTP verification */}
          {obStep === 0 && (
            <div className="space-y-4">
              <div><h2 className="text-2xl font-black tracking-tight">Verify Your Workshop Email</h2><p className="text-sm text-muted">Enter the email address the workshop owner can access.</p></div>
              <div>
                <label className={obLabel}>Workshop Email <span className="text-torqued-red">*</span></label>
                <input className={obInput} type="email" placeholder="workshop@example.com" value={obEmail} onChange={e => { setObEmail(e.target.value); setObOtpSent(false); setObOtp(''); setObOtpError(''); }} disabled={obOtpVerified} />
              </div>
              {!obOtpVerified && !obOtpSent && (
                <Button fullWidth className="bg-torqued-red text-white" disabled={!obEmail || obOtpLoading} onClick={async () => {
                  setObOtpLoading(true); setObOtpError('');
                  try {
                    const r = await fetch('/api/mechanic/send-email-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: obEmail, mechanicId: user.id }) });
                    const d = await r.json();
                    if (r.ok) setObOtpSent(true);
                    else setObOtpError(d.error || 'Could not send code');
                  } catch { setObOtpError('Could not connect'); } finally { setObOtpLoading(false); }
                }}>{obOtpLoading ? 'Sending…' : 'Send Verification Code'}</Button>
              )}
              {obOtpSent && !obOtpVerified && (
                <div className="space-y-3">
                  <p className="text-xs text-muted">A 6-digit code was sent to <strong className="text-foreground">{obEmail}</strong>.</p>
                  <div>
                    <label className={obLabel}>Verification Code</label>
                    <input className={obInput} type="text" inputMode="numeric" maxLength={6} placeholder="000000" value={obOtp} onChange={e => { setObOtp(e.target.value); setObOtpError(''); }} />
                  </div>
                  {obOtpError && <p className="text-xs text-torqued-red">{obOtpError}</p>}
                  <div className="flex gap-3">
                    <Button variant="outline" className="border-border text-white" disabled={obOtpLoading} onClick={async () => {
                      setObOtpLoading(true); setObOtpError('');
                      try {
                        const r = await fetch('/api/mechanic/send-email-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: obEmail, mechanicId: user.id }) });
                        if (!r.ok) { const d = await r.json(); setObOtpError(d.error || 'Could not resend'); }
                      } catch { setObOtpError('Could not connect'); } finally { setObOtpLoading(false); }
                    }}>Resend</Button>
                    <Button fullWidth className="bg-torqued-red text-white" disabled={obOtp.length < 6 || obOtpLoading} onClick={async () => {
                      setObOtpLoading(true); setObOtpError('');
                      try {
                        const r = await fetch('/api/mechanic/verify-email-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: obEmail, code: obOtp, mechanicId: user.id }) });
                        const d = await r.json();
                        if (d.verified) { setObOtpVerified(true); setObOtpError(''); }
                        else setObOtpError(d.error || 'Invalid or expired code');
                      } catch { setObOtpError('Could not connect'); } finally { setObOtpLoading(false); }
                    }}>{obOtpLoading ? 'Verifying…' : 'Verify'}</Button>
                  </div>
                </div>
              )}
              {obOtpVerified && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-bold"><span>✓</span><span>Email verified: {obEmail}</span></div>
                  <Button fullWidth className="bg-torqued-red text-white" onClick={() => setObStep(1)}>Continue</Button>
                </div>
              )}
            </div>
          )}

          {obStep === 1 && (
            <div className="space-y-4">
              <div><h2 className="text-2xl font-black tracking-tight">Workshop Details</h2><p className="text-sm text-muted">Tell us about your business.</p></div>
              <div><label className={obLabel}>Trading / Workshop Name <span className="text-torqued-red">*</span></label><input className={obInput} placeholder="e.g. Smith's Auto" value={ob.name} onChange={e=>setOb({...ob,name:e.target.value})} /></div>
              <div><label className={obLabel}>Legal Name (if different from trading name)</label><input className={obInput} placeholder="Leave blank if same as above" value={ob.legal_name} onChange={e=>setOb({...ob,legal_name:e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={obLabel}>NZBN <span className="text-torqued-red">*</span></label><input className={obInput} placeholder="13-digit NZBN" value={ob.nzbn} onChange={e=>setOb({...ob,nzbn:e.target.value})} /></div>
                <div><label className={obLabel}>Years in Trade <span className="text-torqued-red">*</span></label><input type="number" className={obInput} placeholder="e.g. 12" value={ob.years_in_trade} onChange={e=>setOb({...ob,years_in_trade:e.target.value})} /></div>
              </div>
              {/* Address with Nominatim autocomplete */}
              <div className="relative">
                <label className={obLabel}>Workshop Address <span className="text-torqued-red">*</span></label>
                <input className={obInput} value={ob.address} onChange={e => {
                  const val = e.target.value;
                  setOb({...ob, address: val});
                  setAddrSuggestions([]);
                  if (addrTimer) clearTimeout(addrTimer);
                  if (val.length > 3) {
                    setAddrTimer(setTimeout(async () => {
                      try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=nz&limit=5&q=${encodeURIComponent(val)}`);
                        const data = await res.json();
                        setAddrSuggestions(data || []);
                      } catch { setAddrSuggestions([]); }
                    }, 400));
                  }
                }} placeholder="Start typing your address…" />
                {addrSuggestions.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl overflow-hidden shadow-2xl">
                    {addrSuggestions.map((s, i) => (
                      <button key={i} type="button" className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-muted/20 border-b border-border last:border-0"
                        onClick={() => { setOb({...ob, address: s.display_name}); setAddrSuggestions([]); }}>
                        {s.display_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div><label className={obLabel}>Workshop Phone <span className="text-torqued-red">*</span></label><input className={obInput} value={ob.phone} onChange={e=>setOb({...ob,phone:e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={obLabel}>Owner Name <span className="text-torqued-red">*</span></label><input className={obInput} value={ob.owner_name} onChange={e=>setOb({...ob,owner_name:e.target.value})} /></div>
                <div><label className={obLabel}>Owner Contact Number</label><input className={obInput} value={ob.owner_phone} onChange={e=>setOb({...ob,owner_phone:e.target.value})} /></div>
              </div>
              <div>
                <label className={obLabel}>About You & Your Expertise <span className="text-torqued-red">*</span> <span className="text-muted ml-1">(up to 250 words)</span></label>
                <textarea className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-muted focus:outline-none focus:border-torqued-red resize-none" rows={4}
                  placeholder="In 250 words or less, tell us about yourself and your expertise / specialties…"
                  value={ob.bio} onChange={e => { const words = e.target.value.split(/\s+/).filter(Boolean); if (words.length <= 250) setOb({...ob, bio: e.target.value}); }} />
                <p className="text-[10px] text-muted mt-1">{ob.bio.split(/\s+/).filter(Boolean).length} / 250 words</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">Offer Warrant of Fitness (WoF) inspections?</p>
                    <p className="text-xs text-muted mt-0.5">You'll need to hold a WoF Authority to offer these.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={ob.wants_wof}
                    onClick={() => setOb({ ...ob, wants_wof: !ob.wants_wof })}
                    className={`shrink-0 w-12 h-7 rounded-full transition-all relative ${ob.wants_wof ? 'bg-emerald-500' : 'bg-border'}`}
                  >
                    <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${ob.wants_wof ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>
                {ob.wants_wof && (
                  <p className="text-xs text-muted">Great — we'll follow up by email for a scan of your WoF Authority before this goes live.</p>
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="border-border text-white" onClick={()=>setObStep(0)}>Back</Button>
                <Button fullWidth className="bg-torqued-red text-white" disabled={!ob.name || !ob.nzbn || !ob.years_in_trade || !ob.address || !ob.phone || !ob.owner_name || !ob.bio} onClick={()=>setObStep(2)}>Continue</Button>
              </div>
            </div>
          )}

          {obStep === 2 && (
            <div className="space-y-4">
              <div><h2 className="text-2xl font-black tracking-tight">Payout Details</h2><p className="text-sm text-muted">Where we send your earnings.</p></div>
              <div><label className={obLabel}>Name on account</label><input className={obInput} value={ob.bank_account_name} onChange={e=>setOb({...ob,bank_account_name:e.target.value})} /></div>
              <div><label className={obLabel}>Bank account number</label><input className={obInput} placeholder="00-0000-0000000-00" value={ob.bank_account_number} onChange={e=>setOb({...ob,bank_account_number:e.target.value})} /></div>
              <div className="flex gap-3"><Button variant="outline" className="border-border text-white" onClick={()=>setObStep(1)}>Back</Button><Button fullWidth className="bg-torqued-red text-white" onClick={()=>setObStep(3)}>Continue</Button></div>
            </div>
          )}

          {obStep === 3 && (
            <div className="space-y-4">
              <div><h2 className="text-2xl font-black tracking-tight">Rates & Subscription</h2><p className="text-sm text-muted">Set your pricing and select your start date.</p></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className={obLabel}>Labour $/hr</label><input type="number" className={obInput} value={ob.labour_rate||''} onChange={e=>setOb({...ob,labour_rate:parseFloat(e.target.value)||0})} /></div>
                <div><label className={obLabel}>Technicians</label><input type="number" className={obInput} value={ob.technicians||''} onChange={e=>setOb({...ob,technicians:parseInt(e.target.value)||1})} /></div>
                <div><label className={obLabel}>Parts lead (days)</label><input type="number" className={obInput} value={ob.parts_lead_days||''} onChange={e=>setOb({...ob,parts_lead_days:parseInt(e.target.value)||1})} /></div>
              </div>
              <div>
                <label className={obLabel}>Subscription Start Date <span className="text-torqued-red">*</span></label>
                <input type="date" className={obInput} value={ob.billing_start_date} onChange={e=>setOb({...ob,billing_start_date:e.target.value})}
                  min={new Date().toISOString().slice(0,10)} />
                <p className="text-[10px] text-muted mt-1">You can configure your profile and add parts before this date. You'll be listed and able to accept jobs from this date onwards.</p>
              </div>
              {obSaving && <p className="text-xs text-muted">Saving…</p>}
              <div className="flex gap-3">
                <Button variant="outline" className="border-border text-white" onClick={()=>setObStep(2)}>Back</Button>
                <Button fullWidth className="bg-torqued-red text-white" disabled={obSaving || !ob.billing_start_date} onClick={()=>setObStep(4)}>Continue to Subscription</Button>
              </div>
            </div>
          )}

          {obStep === 4 && (
            <div className="space-y-4">
              <div><h2 className="text-2xl font-black tracking-tight">Mechanic Agreement</h2><p className="text-sm text-muted">Review and sign to complete your registration.</p></div>
              <div className="bg-card border border-border rounded-xl p-4 space-y-3 max-h-48 overflow-y-auto text-xs text-foreground/60 leading-relaxed">
                <p className="font-bold text-foreground/80 text-sm">Mechanic Platform Agreement</p>
                <p className="text-muted">Effective Date: {new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                <p className="text-muted font-bold">Key Terms: NZD $99.00/month subscription (incl. GST) · 4% commission per completed job · Weekly Monday payouts · NZ law governs</p>
                <p><span className="font-bold text-foreground/80">1. Parties</span><br />Torqued NZ, Dunedin, New Zealand, NZBN: 9429053747006 ("Torqued")<br />AND {ob.legal_name || ob.name || '[Workshop Legal Name]'} trading as {ob.name || '[Trading Name]'}, {ob.address || '[Address]'}, NZBN: {ob.nzbn || '[NZBN]'} ("Mechanic Partner")</p>
                <p><span className="font-bold text-foreground/80">2. Platform Access</span><br />Torqued grants a non-exclusive licence to list services and receive bookings, subject to ongoing subscription payment. The Partner must hold valid NZ business registration, appropriate qualifications, and public liability insurance.</p>
                <p><span className="font-bold text-foreground/80">3. Obligations</span><br />The Partner must perform all services with reasonable care and skill, maintain accurate listings and pricing, communicate professionally, and comply with all applicable NZ laws and trade standards.</p>
                <p><span className="font-bold text-foreground/80">4. Fees & Payment</span><br />Subscription: NZD $99.00 + GST/month via Stripe.<br />Commission: 4% of Job Value (incl. GST) per Completed Job, deducted from Weekly Payout.<br />Weekly Payout = Total Job Value – 4% Commission, disbursed every Monday via Stripe Connect.</p>
                <p><span className="font-bold text-foreground/80">5. Consumer Guarantees</span><br />The Partner is the supplier under the Consumer Guarantees Act 1993 and is solely responsible for service quality, defects, and customer claims. Torqued operates as a marketplace only.</p>
                <p><span className="font-bold text-foreground/80">6. Liability & Indemnity</span><br />The Partner indemnifies Torqued against all losses arising from services performed, breach of this Agreement, or negligence. Torqued's liability is limited to 3 months' subscription fees paid.</p>
                <p><span className="font-bold text-foreground/80">7. Intellectual Property</span><br />All Platform IP is owned by Torqued. The Partner grants Torqued a licence to use their business name and listings to operate the Platform.</p>
                <p><span className="font-bold text-foreground/80">8. Privacy & Confidentiality</span><br />Both parties must comply with the Privacy Act 2020. Confidential information must not be disclosed for 2 years post-termination.</p>
                <p><span className="font-bold text-foreground/80">9. Term & Termination</span><br />Rolling monthly. Either party may terminate: Partner by cancelling subscription (access continues to end of billing cycle); Torqued on 30 days' notice or immediately for material breach, insolvency, or safety risk.</p>
                <p><span className="font-bold text-foreground/80">10. Dispute Resolution</span><br />Good faith negotiation (14 days) → AMINZ mediation → NZ courts.</p>
                <p><span className="font-bold text-foreground/80">11. General</span><br />Governed by New Zealand law. Independent contractor relationship. Torqued may amend on 30 days' notice.</p>
                <p className="text-muted border-t border-border pt-2">Signed on behalf of Torqued:<br />Sri Berry · Torqued NZ · NZBN 9429053747006<br />Digitally signed {new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })} at 9:00 AM</p>
              </div>
              <div className="space-y-3">
                <div><label className={obLabel}>Signer's Full Name <span className="text-torqued-red">*</span></label><input className={obInput} placeholder="e.g. Jane Smith" value={ob.owner_name} onChange={e=>setOb({...ob,owner_name:e.target.value})} /></div>
                <div><label className={obLabel}>Signer's Title</label><input className={obInput} placeholder="e.g. Director, Owner" value={ob.signer_title} onChange={e=>setOb({...ob, signer_title: e.target.value})} /></div>
              </div>
              {obSaving && <p className="text-xs text-muted">Processing…</p>}
              <div className="flex gap-3">
                <Button variant="outline" className="border-border text-white" onClick={()=>setObStep(3)}>Back</Button>
                <Button fullWidth className="bg-torqued-red text-white" disabled={obSaving || !ob.owner_name} onClick={async()=>{
                  setObSaving(true);
                  try {
                    await fetch('/api/mechanic/save-onboarding', {
                      method:'POST', headers:{'Content-Type':'application/json'},
                      body: JSON.stringify({ mechanicId: user.id, fields: { ...ob, agreement_signed_at: new Date().toISOString(), agreement_signed_by: ob.owner_name }, complete: true }),
                    });
                    try {
                      const pdfBase64 = generateContractPdf(ob.signer_title || 'Owner');
                      await fetch('/api/mechanic/email-contract', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ mechanicId: user.id, pdfBase64, email: user.email, workshopName: ob.legal_name || ob.name, ownerName: ob.owner_name }),
                      });
                    } catch (e) { console.error('Contract email failed (non-blocking):', e); }
                    setOnboardingComplete(true);
                    setAgreementSigned(true);
                  } catch {} finally { setObSaving(false); }
                }}>I Agree & Complete Registration</Button>
              </div>
              <p className="text-[10px] text-muted text-center">By clicking above, you confirm you have authority to sign on behalf of {ob.legal_name || ob.name} and agree to the Torqued Mechanic Agreement. A PDF copy will be emailed to you.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
{/* Navigation */}
        <nav className="p-4 md:px-8 flex justify-between items-center bg-background/80 border-b border-border backdrop-blur-sm">
          <Logo />
          <Button size="sm" className="bg-torqued-red text-white" onClick={() => { setShowSignupModal(false); setMechSignupSent(false); }}>
            Sign In
          </Button>
        </nav>

        <main className="flex-1 flex items-center justify-center p-6 py-20 relative overflow-y-auto">
          {/* Subtle background glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-torqued-red/10 blur-[120px] rounded-full -z-10" />

          <div className="w-full max-w-xl space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full bg-card border border-border shadow-2xl rounded-3xl p-8 sm:p-12 space-y-8 text-center"
            >
              <div className="w-20 h-20 bg-torqued-red/10 border border-torqued-red/20 text-torqued-red rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <Wrench size={38} className="animate-pulse" />
              </div>

              <div className="space-y-3">
                <h2 className="text-3xl sm:text-5xl font-black tracking-tighter uppercase text-foreground leading-none">
                  Mechanic Sign-In
                </h2>
              </div>

              {mechSignupSent ? (
                <div className="space-y-5 text-center">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-3xl">✉️</div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-foreground">Check your email</h3>
                    <p className="text-sm text-muted">
                      We've sent a confirmation link to <span className="text-foreground font-bold">{mechEmail}</span>. Click it to activate your workshop account, then log in.
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
                    className="text-xs font-bold text-torqued-red hover:text-red-400 disabled:text-muted disabled:cursor-not-allowed transition-colors"
                  >
                    {mechResendCooldown > 0 ? `Resend link in ${mechResendCooldown}s` : "Didn't get it? Resend link"}
                  </button>

                  <Button
                    fullWidth
                    variant="outline"
                    className="border-border text-foreground"
                    onClick={() => { setMechSignupSent(false); setMechPassword(''); setMechResendMsg(null); }}
                  >
                    Back to Login
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 text-left">
                  <div className="space-y-3">
                    <input
                      type="email"
                      placeholder="Email address"
                      value={mechEmail}
                      onChange={e => setMechEmail(e.target.value)}
                      className="w-full bg-card border border-border rounded-xl px-4 h-12 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-torqued-red"
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      value={mechPassword}
                      onChange={e => setMechPassword(e.target.value)}
                      className="w-full bg-card border border-border rounded-xl px-4 h-12 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-torqued-red"
                    />
                  </div>

                  {mechAuthError && (
                    <p className="text-xs text-torqued-red font-bold">{mechAuthError}</p>
                  )}

                  <div className="text-right -mt-1">
                    <button
                      type="button"
                      disabled={mechAuthLoading}
                      onClick={async () => {
                        if (!mechEmail) { setMechAuthError('Enter your email above first, then tap "Forgot password".'); return; }
                        setMechAuthError(null); setMechResendMsg(null); setMechAuthLoading(true);
                        try {
                          const r = await fetch('/api/mechanic/forgot-password', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: mechEmail }),
                          });
                          const d = await r.json();
                          if (!r.ok) setMechAuthError(d.error || 'Could not send reset link.');
                          else setMechResendMsg('✓ Password reset link sent — check your email.');
                        } catch { setMechAuthError('Could not connect. Please try again.'); }
                        finally { setMechAuthLoading(false); }
                      }}
                      className="text-[11px] font-bold text-muted hover:text-torqued-red transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  {mechResendMsg && <p className="text-xs text-emerald-500 font-bold">{mechResendMsg}</p>}

                  <Button
                    fullWidth
                    size="lg"
                    disabled={mechAuthLoading}
                    className="bg-torqued-red hover:bg-red-700 text-white font-black uppercase text-xs tracking-widest h-14"
                    onClick={async () => {
                      setMechAuthError(null);
                      setMechAuthLoading(true);
                      try {
                        await loginMechanic(mechEmail, mechPassword);
                        // Offer a passkey only if this account doesn't already have one.
                        if (passkeysSupported() && mechEmail && !(await hasPasskey('mechanic', mechEmail)) && window.confirm('Set up a passkey for faster sign-in? You\'ll use passkey instead of your password next time.')) {
                          try { await registerPasskey('mechanic', mechEmail); window.alert('Passkey added.'); } catch {}
                        }
                      } catch (e: any) {
                        setMechAuthError(e.message || 'Authentication failed');
                      } finally {
                        setMechAuthLoading(false);
                      }
                    }}
                  >
                    {mechAuthLoading ? 'Please wait...' : 'Log In'}
                  </Button>

                  {passkeysSupported() && (
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
                      className="w-full text-xs font-bold text-muted hover:text-foreground border border-border rounded-xl h-12 flex items-center justify-center gap-2"
                    >
                      <span aria-hidden>🔑</span> Sign in with passkey
                    </button>
                  )}
                </div>
              )}

              {onBack && (
                <button
                  className="text-[10px] font-bold text-white/40 hover:text-white tracking-widest uppercase block mx-auto pt-2"
                  onClick={onBack}
                >
                  ← Back to Landing Page
                </button>
              )}
            </motion.div>

            {!mechSignupSent && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="w-full bg-card border border-border rounded-3xl p-6 sm:p-8 text-center space-y-3"
              >
                <h3 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">Join Torqued.</h3>
                <p className="text-sm text-muted">Reclaim your time.</p>
                <Button
                  fullWidth
                  className="bg-torqued-red hover:bg-red-700 text-white"
                  onClick={() => { setMechAuthError(null); setShowSignupModal(true); }}
                >
                  Sign Up
                </Button>
              </motion.div>
            )}
          </div>
        </main>

        {/* Workshop signup popup */}
        <AnimatePresence>
          {showSignupModal && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 overflow-y-auto bg-black/80">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowSignupModal(false)}
                className="absolute inset-0 bg-background/50 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 30 }}
                className="relative w-full max-w-md bg-card border border-border shadow-2xl rounded-3xl p-6 sm:p-8 space-y-5"
              >
                <div className="space-y-1.5 text-left">
                  <h3 className="text-2xl font-black tracking-tight text-foreground">Join Torqued</h3>
                  <p className="text-sm text-muted">Set up your workshop account — you'll verify your workshop email next.</p>
                </div>

                <div className="space-y-3 text-left">
                  <input
                    type="text"
                    placeholder="Workshop / Business Name"
                    value={mechName}
                    onChange={e => setMechName(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 h-12 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-torqued-red"
                  />
                  <input
                    type="email"
                    placeholder="Email address"
                    value={mechEmail}
                    onChange={e => setMechEmail(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 h-12 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-torqued-red"
                  />
                </div>

                {mechAuthError && (
                  <p className="text-xs text-torqued-red font-bold">{mechAuthError}</p>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" className="border-border text-foreground" onClick={() => setShowSignupModal(false)}>Cancel</Button>
                  <Button
                    fullWidth
                    disabled={mechAuthLoading}
                    className="bg-torqued-red hover:bg-red-700 text-white font-black uppercase text-xs tracking-widest h-12"
                    onClick={async () => {
                      setMechAuthError(null);
                      setMechAuthLoading(true);
                      try {
                        const result = await signUpMechanic(mechEmail, mechName);
                        if (result.error) setMechAuthError(result.error);
                        else {
                          // Carry the details they just gave us straight into onboarding
                          // step 1 — no re-typing the workshop name/email.
                          setObEmail(mechEmail);
                          setOb(o => ({ ...o, name: mechName }));
                          if (result.needsConfirmation) { setShowSignupModal(false); setMechSignupSent(true); }
                        }
                      } catch (e: any) {
                        setMechAuthError(e.message || 'Authentication failed');
                      } finally {
                        setMechAuthLoading(false);
                      }
                    }}
                  >
                    {mechAuthLoading ? 'Please wait...' : 'Create Account'}
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // New signups land here after signing the onboarding agreement, until an admin
  // reviews and approves the account — no Stripe/paywall step until then.
  // Only gate on an EXPLICIT pending/rejected status — missing/undefined (accounts
  // created before this column existed, or before migration 050 has been run) must
  // never be treated as "not approved", or every existing mechanic gets locked out.
  if (userProfile?.reviewStatus === 'pending' || userProfile?.reviewStatus === 'rejected') {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <nav className="p-4 md:px-8 flex justify-between items-center bg-background/80 border-b border-border backdrop-blur-sm">
          <Logo />
          <Button size="sm" variant="outline" className="border-border" onClick={() => { setIncomingJobs([]); setCustomers([]); setBilling(null); setJobNotes({}); setVehiclePhotos({}); setProfileData({ name: '', nzbn: '', phone: '', address: '', serviceAreas: [], diagnosticTools: [], certifications: [], labourRate: 145, shopFee: 25, offersPpi: false, bio: '', profilePhotoUrl: '', bannerImage: '' }); logout(); }}>
            Sign Out
          </Button>
        </nav>

        <main className="flex-1 flex items-center justify-center p-6 py-20 relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-torqued-red/10 blur-[120px] rounded-full -z-10" />

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-xl bg-card border border-border shadow-2xl rounded-3xl p-8 sm:p-12 space-y-6 text-center"
          >
            <div className="w-20 h-20 bg-torqued-red/10 border border-torqued-red/20 text-torqued-red rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Clock size={38} />
            </div>

            <div className="space-y-3">
              <h2 className="text-3xl sm:text-4xl font-black tracking-tighter uppercase text-foreground leading-none">
                Application Under Review
              </h2>
              <p className="text-sm sm:text-base text-muted">
                Thanks for signing up — we're reviewing your account and will be in touch if we need anything else from you. Keep an eye on your inbox.
              </p>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row transition-colors duration-300 overflow-x-hidden">
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
        <div className="p-4 border-t border-border space-y-2">
          <div className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border">
            <div className="w-10 h-10 bg-torqued-red rounded-lg flex items-center justify-center font-bold text-white text-xs">
              {(profileData.name || 'W').split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">{profileData.name || 'Workshop'}</p>
              <p className="text-[10px] text-muted truncate">{profileData.address ? profileData.address.split(',')[0] : user?.email || ''}</p>
            </div>
          </div>
          <button
            onClick={() => { setIncomingJobs([]); setCustomers([]); setBilling(null); setJobNotes({}); setVehiclePhotos({}); setProfileData({ name: '', nzbn: '', phone: '', address: '', serviceAreas: [], diagnosticTools: [], certifications: [], labourRate: 145, shopFee: 25, offersPpi: false, bio: '', profilePhotoUrl: '', bannerImage: '' }); logout(); }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-xs font-bold text-muted hover:text-torqued-red hover:border-torqued-red/40 hover:bg-torqued-red/5 transition-all"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto overflow-x-hidden min-w-0 bg-background">
        {portalLoading && (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-border border-t-torqued-red rounded-full animate-spin" />
          </div>
        )}
        {!portalLoading && billingStartDate && new Date(billingStartDate) > new Date() && (
          <div className="mb-6 flex items-start gap-3 bg-amber-500/10 border border-amber-500/25 rounded-2xl px-5 py-4">
            <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-foreground">Listing activates on {new Date(billingStartDate).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p className="text-xs text-muted mt-0.5">You can configure your profile and add services now. Your workshop will appear in customer search and you can accept jobs from your subscription start date.</p>
            </div>
          </div>
        )}
        {!portalLoading && <><header className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6 mb-8">
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

        {renderContent()}</>}
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
                      // Auto-fill customer name/email from most recent booking for this rego
                      if (user?.id) {
                        const custRes = await fetch(`/api/mechanic/customer-lookup?mechanicId=${encodeURIComponent(user.id)}&rego=${encodeURIComponent(plate)}`).then(r => r.ok ? r.json() : null).catch(() => null);
                        if (custRes?.customer) {
                          if (custRes.customer.customer_name && !coldForm.customerName) setColdForm(c => ({ ...c, customerName: custRes.customer.customer_name }));
                          if (custRes.customer.email && !coldForm.email) setColdForm(c => ({ ...c, email: custRes.customer.email }));
                          if (custRes.customer.customer_phone && !coldForm.phone) setColdForm(c => ({ ...c, phone: custRes.customer.customer_phone }));
                        }
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
                    <p className="text-xs text-foreground">The owner of this vehicle has a Torqued account. We'll email them a secure link to grant you 12 hours of access to their service history — no code to relay.</p>
                    <button
                      onClick={() => checkHistoryAccess(coldForm.rego)}
                      className="text-xs font-bold bg-torqued-red text-white px-4 py-2 rounded-lg hover:bg-torqued-red/80 transition-colors">
                      Email access link
                    </button>
                  </div>
                )}

                {(histAccessState === 'otp_sent' || histAccessState === 'already_sent' || histAccessState === 'entering_code') && (
                  <div className="space-y-2">
                    <p className="text-xs text-foreground">
                      {histAccessState === 'already_sent'
                        ? 'An access link has already been emailed to the vehicle owner.'
                        : 'A 12-hour access link has been emailed to the vehicle owner.'}
                      {histOtpExpiry && <span className="text-muted"> Valid until {new Date(histOtpExpiry).toLocaleString('en-NZ', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}.</span>}
                    </p>
                    <p className="text-[11px] text-muted">Once they've tapped it, check for access:</p>
                    <div className="flex gap-2">
                      <button
                        onClick={verifyHistOtp}
                        className="text-xs font-bold bg-torqued-red text-white px-4 py-2 rounded-lg hover:bg-torqued-red/80 transition-colors">
                        {histAccessState === 'verifying' ? 'Checking…' : 'Check access'}
                      </button>
                      <button
                        onClick={() => checkHistoryAccess(coldForm.rego)}
                        className="text-xs font-bold border border-border text-foreground px-4 py-2 rounded-lg hover:bg-card transition-colors">
                        Resend link
                      </button>
                    </div>
                    {histAccessMsg && <p className="text-xs text-amber-500 font-bold">{histAccessMsg}</p>}
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

              {/* Shop Fee */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted">Workshop Fee ($) <span className="font-normal normal-case tracking-normal text-muted/60">— freight, sundries &amp; consumables</span></label>
                <input type="number" value={qShopFee||''} onChange={e=>setQShopFee(parseFloat(e.target.value)||0)} className="w-full bg-background border border-border rounded-lg px-3 h-10 text-sm text-foreground" />
              </div>

              {/* Parts Lead Time */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted">Parts Lead Time <span className="font-normal normal-case tracking-normal text-muted/60">— business days until parts arrive (0 = no wait)</span></label>
                <div className="flex items-center gap-3">
                  <input type="number" min={0} max={30} value={qLeadTimeDays||''} onChange={e=>setQLeadTimeDays(Math.max(0,parseInt(e.target.value)||0))} placeholder="0" className="w-24 bg-background border border-border rounded-lg px-3 h-10 text-sm text-foreground" />
                  {qLeadTimeDays > 0 && (
                    <p className="text-xs text-amber-400">Customer's earliest drop-off will be {qLeadTimeDays} business day{qLeadTimeDays!==1?'s':''} from now</p>
                  )}
                </div>
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
                {qShopFee>0 && <div className="flex justify-between text-muted"><span>Workshop fee</span><span>${qShopFee.toFixed(2)}</span></div>}
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
                    qShopFee>0?`Workshop fee — $${qShopFee.toFixed(2)}`:'',
                    qDiscount>0?`Discount: -$${qDiscount.toFixed(2)}`:'',
                    qNotes.trim()?`\nNotes: ${qNotes.trim()}`:''
                  ].filter(Boolean).join('\n');
                  const r = await fetch('/api/mechanic/send-quote-pdf', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      bookingId: quoteJob.id, total: qTotal, note, customerName: quoteJob.customerName, pdfBase64,
                      items: { parts: qParts, labourHours: qLabourHours, labourRate: qLabourRate, shopFee: qShopFee, other: qOther, discount: qDiscount, notes: qNotes, leadTimeDays: qLeadTimeDays || 0 },
                    }),
                  });
                  if (r.ok) {
                    // Mark diagnostic job as quoted → moves it to the SENT filter
                    setIncomingJobs(prev => prev.map(j => j.id === quoteJob.id
                      ? { ...j, quoteItems: { parts: qParts, labourHours: qLabourHours, labourRate: qLabourRate, shopFee: qShopFee, other: qOther, discount: qDiscount, notes: qNotes, leadTimeDays: qLeadTimeDays || 0 } }
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

      {/* Refund Modal */}
      {refundModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-foreground/30 backdrop-blur-sm" onClick={() => !refundBusy && setRefundModal(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black">Issue Refund</h3>
              <button onClick={() => !refundBusy && setRefundModal(null)} className="text-muted hover:text-foreground text-xl">✕</button>
            </div>
            <p className="text-xs text-muted">Job <strong className="text-foreground">#{refundModal.job.id}</strong> · {refundModal.job.vehicle_rego || refundModal.job.reg} · <strong className="text-foreground">${Number(refundModal.job.total_price || refundModal.job.suggestedQuote || 0).toFixed(2)} paid</strong></p>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">Refund Amount (NZD) — leave blank for full refund</label>
                <input type="number" min={0} step={0.01} value={refundAmount} onChange={e => setRefundAmount(e.target.value)} placeholder={`Full refund ($${Number(refundModal.job.total_price || 0).toFixed(2)})`} className="w-full bg-background border border-border rounded-xl px-3 h-10 text-sm text-foreground" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">Reason (required)</label>
                <textarea value={refundReason} onChange={e => setRefundReason(e.target.value)} rows={3} placeholder="Describe the reason for this refund…" className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground resize-none" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => !refundBusy && setRefundModal(null)} className="flex-1 px-4 h-10 rounded-xl border border-border text-sm font-bold text-foreground hover:bg-background">Cancel</button>
              <button disabled={refundBusy || !refundReason.trim()} onClick={async () => {
                setRefundBusy(true);
                const r = await fetch('/api/stripe/refund', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ bookingId: refundModal.job.id, amount: refundAmount.trim() ? parseFloat(refundAmount) : undefined, reason: refundReason.trim() }),
                });
                const d = await r.json();
                setRefundBusy(false);
                if (d.success) {
                  alert(`Refunded $${d.refunded}. Recorded with reason: "${refundReason}"`);
                  setRefundModal(null);
                } else { alert(d.error || 'Refund failed — check Stripe dashboard.'); }
              }} className="flex-1 px-4 h-10 rounded-xl bg-amber-500 text-white text-sm font-black disabled:opacity-50">
                {refundBusy ? 'Processing…' : 'Issue Refund'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Request Modal */}
      <AnimatePresence>
        {rescheduleModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-foreground/30 backdrop-blur-sm" onClick={() => setRescheduleModal(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-background border border-border rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-black text-foreground">Request Reschedule</h3>
                <button onClick={() => setRescheduleModal(null)} className="text-muted hover:text-foreground text-xl">✕</button>
              </div>
              <p className="text-sm text-muted">Propose a new date & time to the customer for job <strong className="text-foreground">#{rescheduleModal.job.id}</strong>. They will receive an email to accept or contact you.</p>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">Proposed Date & Time</label>
                  <input type="datetime-local" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-torqued-red" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">Reason / Comment (optional)</label>
                  <textarea value={rescheduleComment} onChange={e => setRescheduleComment(e.target.value)} rows={3} placeholder="e.g. Parts delayed, technician unavailable…"
                    className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-torqued-red resize-none" />
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 border-border text-foreground" onClick={() => setRescheduleModal(null)}>Cancel</Button>
                <Button disabled={!rescheduleDate || rescheduleSending} className="flex-1 bg-torqued-red text-white" onClick={async () => {
                  setRescheduleSending(true);
                  try {
                    const r = await fetch('/api/mechanic/reschedule-request', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ bookingId: rescheduleModal.job.id, proposedDate: rescheduleDate, comment: rescheduleComment, mechanicName: profileData.name }),
                    });
                    const d = await r.json();
                    if (r.ok) { alert('Reschedule request sent to the customer.'); setRescheduleModal(null); }
                    else alert(d.error || 'Could not send request. Try again.');
                  } catch { alert('Connection error. Try again.'); }
                  finally { setRescheduleSending(false); }
                }}>{rescheduleSending ? 'Sending…' : 'Send Request'}</Button>
              </div>
            </motion.div>
          </div>
        )}

        {checkoutModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-foreground/30 backdrop-blur-sm" onClick={() => !checkoutBusy && setCheckoutModal(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-background border border-border rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-black text-foreground">Check-out · Car Ready</h3>
                <button onClick={() => setCheckoutModal(null)} className="text-muted hover:text-foreground text-xl">✕</button>
              </div>
              <p className="text-sm text-muted">Record the odometer for job <strong className="text-foreground">#{checkoutModal.job.id}</strong>. The customer will be notified their vehicle is ready.</p>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">Odometer at check-out (km)</label>
                  <input type="text" inputMode="numeric" value={checkoutKm} onChange={e => setCheckoutKm(e.target.value)} placeholder="e.g. 124500"
                    className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-torqued-red" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">Notes for the customer (optional)</label>
                  <textarea value={checkoutNotes} onChange={e => setCheckoutNotes(e.target.value)} rows={3} placeholder="e.g. Replaced front pads, recommend rear pads next service…"
                    className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-torqued-red resize-none" />
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 border-border text-foreground" disabled={checkoutBusy} onClick={() => setCheckoutModal(null)}>Cancel</Button>
                <Button disabled={!checkoutKm.trim() || checkoutBusy} className="flex-1 bg-torqued-red text-white" onClick={confirmCheckout}>{checkoutBusy ? 'Saving…' : 'Mark car ready'}</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
