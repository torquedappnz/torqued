import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, MapPin, ChevronRight, Info, Lock, CheckCircle2, Star, Calendar, CreditCard, Car, History, Wrench, AlertTriangle, Plus, Edit2, ArrowLeft, Clock, Sun, Moon, Monitor, Download, Ticket, Mail, Send, Smartphone, X, Upload, Sparkles, Camera, Settings, Trash2, Repeat } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';
import { SERVICES, MOCK_MECHANICS, MOCK_VEHICLE, MOCK_VEHICLES } from '../constants';
import { Vehicle, Mechanic, Service, Job, UserServiceItem } from '../types';
import { cn } from '../utils';
import { useTheme } from '../context/ThemeContext';

import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { authPasskey, registerPasskey, passkeysSupported, hasPasskey } from '../lib/passkey';

const BRAND_LOGOS: Record<string, string> = {
  volkswagen: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Volkswagen_logo_2019.svg/120px-Volkswagen_logo_2019.svg.png',
  vw: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Volkswagen_logo_2019.svg/120px-Volkswagen_logo_2019.svg.png',
  toyota: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Toyota_carlogo.svg/120px-Toyota_carlogo.svg.png',
  lexus: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Lexus_division_emblem.svg/120px-Lexus_division_emblem.svg.png',
  audi: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Audi-Logo_2016.svg/120px-Audi-Logo_2016.svg.png',
  skoda: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/ŠKODA_AUTO_logo.svg/120px-ŠKODA_AUTO_logo.svg.png',
  ford: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Ford_logo_flat.svg/120px-Ford_logo_flat.svg.png',
  nissan: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Nissan_2020_logo.svg/120px-Nissan_2020_logo.svg.png',
  honda: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Honda.svg/120px-Honda.svg.png',
  mazda: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Mazda_logo.svg/120px-Mazda_logo.svg.png',
  hyundai: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Hyundai_Motor_Company_logo.svg/120px-Hyundai_Motor_Company_logo.svg.png',
  kia: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Kia-logo.svg/120px-Kia-logo.svg.png',
  subaru: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Subaru_logo.svg/120px-Subaru_logo.svg.png',
  mitsubishi: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Mitsubishi_logo.svg/120px-Mitsubishi_logo.svg.png',
  suzuki: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Suzuki_logo_2.svg/120px-Suzuki_logo_2.svg.png',
  mercedes: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Mercedes-Logo.svg/120px-Mercedes-Logo.svg.png',
  'mercedes-benz': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Mercedes-Logo.svg/120px-Mercedes-Logo.svg.png',
  bmw: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/BMW.svg/120px-BMW.svg.png',
  tesla: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Tesla_T_symbol.svg/120px-Tesla_T_symbol.svg.png',
  byd: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/BYD_Auto_logo.svg/120px-BYD_Auto_logo.svg.png',
  holden: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Holden_logo.svg/120px-Holden_logo.svg.png',
  isuzu: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Isuzu_logo.svg/120px-Isuzu_logo.svg.png',
  jeep: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Jeep_logo.svg/120px-Jeep_logo.svg.png',
  land_rover: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Land_Rover_logo_2020.svg/120px-Land_Rover_logo_2020.svg.png',
  'land rover': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Land_Rover_logo_2020.svg/120px-Land_Rover_logo_2020.svg.png',
  peugeot: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Peugeot_2021_logo.svg/120px-Peugeot_2021_logo.svg.png',
  volvo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Volvo_logo.svg/120px-Volvo_logo.svg.png',
};

function getCarBrandLogo(make: string): string | null {
  if (!make) return null;
  return BRAND_LOGOS[make.toLowerCase().trim()] || null;
}

// Turn a quote's line items into a short job summary, e.g. "Brake Service".
function summariseQuote(qi: any, isDiag: boolean): string {
  const parts: string[] = Array.isArray(qi?.parts) ? qi.parts.filter((p: any) => p?.name).map((p: any) => String(p.name)) : [];
  const text = (parts.join(' ') + ' ' + (qi?.notes || '')).toLowerCase();
  const categories: [RegExp, string][] = [
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
    [/wof|warrant/, 'WoF Repairs'],
  ];
  for (const [re, label] of categories) if (re.test(text)) return label;
  if (parts.length === 1) return parts[0];
  if (parts.length > 1) return `${parts[0]} + ${parts.length - 1} more`;
  return isDiag ? 'Repair Quote' : 'Your Quote';
}

type HealthInsight = { title: string; detail: string; severity: 'good' | 'due' | 'overdue' | 'info' };
// localStorage-backed AI insights cache — persists across page refreshes.
// Only invalidated when historyVersion increments (history add/edit/delete).
const HEALTH_CACHE_PREFIX = 'torqued_health:';
function readHealthCache(key: string): { insights: HealthInsight[]; hasHistory: boolean } | null {
  try {
    const raw = localStorage.getItem(HEALTH_CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.insights)) return parsed;
  } catch {}
  return null;
}
function writeHealthCache(key: string, data: { insights: HealthInsight[]; hasHistory: boolean }) {
  try { localStorage.setItem(HEALTH_CACHE_PREFIX + key, JSON.stringify(data)); } catch {}
}
// Purge stale cache keys for a rego when a new version is written
function pruneHealthCache(rego: string, currentVersion: number) {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(HEALTH_CACHE_PREFIX + rego + ':') && !k.endsWith(':' + currentVersion))
      .forEach(k => localStorage.removeItem(k));
  } catch {}
}

// Map a health-insight title to a bookable SERVICES id (best-effort).
function insightToServiceId(title: string): string | null {
  const t = title.toLowerCase();
  if (t.includes('spark plug') || t.includes('ignition coil')) return 'spark_plugs';
  if (t.includes('cambelt') || t.includes('timing belt') || t.includes('timing chain')) return 'timing';
  if (t.includes('brake fluid')) return 'brake_fluid';
  if (t.includes('coolant')) return 'coolant_flush';
  if (t.includes('cabin filter') || t.includes('pollen filter')) return 'cabin_filter';
  if (t.includes('transmission')) return 'transmission';
  if (t.includes('battery')) return 'battery';
  if (t.includes('water pump')) return 'water_pump';
  if (t.includes('front brake')) return 'brakes_front_pads';
  if (t.includes('rear brake')) return 'brakes_rear_pads';
  if (t.includes('brake')) return 'brakes_front_pads';
  if (t.includes('oil') || t.includes('service')) return 'oil';
  if (t.includes('wof') || t.includes('warrant')) return 'wof';
  return null;
}

// ── ProfileView ──────────────────────────────────────────────────────────────
interface ProfileViewProps {
  userName: string | null; setUserName: (n: string) => void;
  customerEmail: string | null;
  customerOwnerId: string | null;
  location: string; setLocation: (l: string) => void;
  user: any; updateProfile: (p: any) => Promise<any>;
  rego: string; vehicle: any; garageVehicles: any[];
  passkeyCardState: string; setPasskeyCardState: (s: any) => void;
  mechanicAccess: any[]; accessLoading: boolean;
  loadMechanicAccess: () => void; revokeMechanicAccess: (id: string) => void;
  clearCustomerSession: () => void; logout: () => void;
  setView: (v: string) => void;
  onVehicleTransferred?: (rego: string) => void;
}

// ── EVQuoteRequest ────────────────────────────────────────────────────────────
const EVQuoteRequest: React.FC<{
  vehicle: any; rego: string; realMechanics: any[];
  customerEmail: string | null; customerOwnerId: string | null;
  userName: string | null;
  customerCoords: { lat: number; lng: number } | null;
  requestLocation: () => void;
  locationAsked: boolean;
  onSubmitted: (job: any) => void;
}> = ({ vehicle, rego, realMechanics, customerEmail, customerOwnerId, userName, customerCoords, requestLocation, locationAsked, onSubmitted }) => {
  const [evStep, setEvStep] = React.useState<'details' | 'mechanic' | 'done'>('details');
  const [concern, setConcern] = React.useState('');
  const [mechId, setMechId] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (realMechanics.length === 1 && !mechId) setMechId(realMechanics[0].id);
  }, [realMechanics]);

  const submit = async () => {
    if (!concern.trim() || !mechId) return;
    setBusy(true);
    const bookingId = (crypto as any).randomUUID ? crypto.randomUUID() : `ev_${Date.now()}`;
    const mech = realMechanics.find((m: any) => m.id === mechId);
    const payload = {
      id: bookingId,
      mechanicId: mechId,
      vehicleId: (vehicle?.rego || rego || '').toUpperCase(),
      serviceIds: ['diag_inspection'],
      totalPrice: 0,
      paymentMethod: 'TBD',
      paymentStatus: 'pending',
      status: 'pending',
      date: null,
      customerName: userName || '',
      email: customerEmail || '',
      description: `[EV Quote Request] ${concern.trim()}`,
      customerId: customerOwnerId || undefined,
    };
    try {
      const r = await fetch('/api/bookings/persist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingData: payload, userId: customerOwnerId }),
      });
      if (r.ok) {
        setEvStep('done');
        onSubmitted({
          id: bookingId, mechanicId: mechId,
          mechanicName: mech?.name || 'Your mechanic',
          serviceIds: ['diag_inspection'],
          date: null, status: 'pending',
          paymentStatus: 'pending', paymentMethod: 'TBD',
          totalPrice: 0,
          description: `[EV Quote Request] ${concern.trim()}`,
        });
      }
    } catch {}
    setBusy(false);
  };

  if (evStep === 'done') return (
    <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center space-y-2">
      <p className="text-lg font-black text-emerald-400">Quote request sent ✓</p>
      <p className="text-sm text-muted">Your mechanic will review this and send you a quote. You'll receive an email when it's ready.</p>
    </div>
  );

  if (evStep === 'mechanic') return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setEvStep('details')} className="text-muted hover:text-foreground transition-all">
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="text-sm font-black">Choose your workshop</p>
          <p className="text-xs text-muted">Select a Torqued mechanic to send this quote request to.</p>
        </div>
      </div>
      {!customerCoords && realMechanics.length === 0 && (
        <div className="p-4 bg-card border border-border rounded-xl flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold flex items-center gap-1.5"><MapPin size={14} className="text-torqued-red" /> Find workshops near you</p>
            <p className="text-xs text-muted mt-0.5">{locationAsked ? 'Location unavailable — showing all workshops.' : 'Allow location to see the closest mechanics near you.'}</p>
          </div>
          {!locationAsked && <button onClick={requestLocation} className="shrink-0 h-8 px-3 rounded-lg bg-torqued-red text-white text-xs font-bold">Use my location</button>}
        </div>
      )}
      <div className="space-y-2">
        {!customerCoords && realMechanics.length === 0 && locationAsked && (
          <p className="text-xs text-muted text-center py-4">Loading nearby workshops…</p>
        )}
        {customerCoords && realMechanics.length === 0 && (
          <p className="text-xs text-muted text-center py-4">Loading nearby workshops…</p>
        )}
        {realMechanics.map((m: any) => (
          <button
            key={m.id}
            onClick={() => setMechId(m.id)}
            className={cn(
              'w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all',
              mechId === m.id
                ? 'border-torqued-red bg-torqued-red/8'
                : 'border-border bg-card hover:border-torqued-red/40'
            )}
          >
            <div className="w-10 h-10 rounded-xl bg-torqued-red/10 flex items-center justify-center shrink-0 text-torqued-red font-black text-sm">
              {(m.name || '?').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{m.name}</p>
              {m.address && <p className="text-xs text-muted truncate">{m.address}</p>}
            </div>
            {mechId === m.id && <CheckCircle2 size={18} className="text-torqued-red shrink-0" />}
          </button>
        ))}
      </div>
      <button
        onClick={submit}
        disabled={busy || !mechId}
        className="w-full h-12 rounded-2xl bg-torqued-red text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50 transition-all"
      >
        {busy ? 'Sending…' : 'Request Quote →'}
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-black">What do you need quoted?</p>
        <p className="text-xs text-muted">Describe the work — your mechanic will send you a price. No inspection fee.</p>
      </div>
      <textarea
        value={concern}
        onChange={e => setConcern(e.target.value)}
        placeholder="e.g. Annual service, tyre rotation, software check, brake pad inspection…"
        rows={4}
        className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-torqued-red resize-none transition-all"
        autoFocus
      />
      <button
        onClick={() => setEvStep('mechanic')}
        disabled={!concern.trim()}
        className="w-full h-12 rounded-2xl bg-torqued-red text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50 transition-all"
      >
        Next — Choose Workshop →
      </button>
    </div>
  );
};

const ProfileView: React.FC<ProfileViewProps> = (props) => {
  const { userName, setUserName, customerEmail, customerOwnerId, location, setLocation, user, updateProfile,
    rego, vehicle, garageVehicles, passkeyCardState, setPasskeyCardState,
    mechanicAccess, accessLoading, loadMechanicAccess, revokeMechanicAccess,
    clearCustomerSession, logout, onVehicleTransferred } = props;

  const [editName, setEditName] = React.useState(userName || '');
  const [editEmail, setEditEmail] = React.useState(customerEmail || '');
  const [editLocation, setEditLocation] = React.useState(location || '');
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [passkeys, setPasskeys] = React.useState<any[]>([]);
  const [passkeysLoading, setPasskeysLoading] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [locating, setLocating] = React.useState(false);
  // Transfer ownership state
  const [txRego, setTxRego] = React.useState('');
  const [txEmail, setTxEmail] = React.useState('');
  const [txLoading, setTxLoading] = React.useState(false);
  const [txResult, setTxResult] = React.useState<{ ok: boolean; message: string } | null>(null);

  const useMyLocation = () => {
    if (!navigator.geolocation) { alert('Geolocation is not supported on this device.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude, longitude } = pos.coords;
        const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
        const d = await r.json();
        const place = [d.city || d.locality, d.principalSubdivision].filter(Boolean).join(', ');
        if (place) setEditLocation(place);
      } catch { alert('Could not resolve your location.'); }
      finally { setLocating(false); }
    }, () => { setLocating(false); alert('Location permission denied.'); }, { enableHighAccuracy: true, timeout: 10000 });
  };

  React.useEffect(() => { setEditName(userName || ''); }, [userName]);
  React.useEffect(() => { setEditEmail(customerEmail || ''); }, [customerEmail]);
  React.useEffect(() => { setEditLocation(location || ''); }, [location]);

  React.useEffect(() => {
    if (!customerEmail) return;
    setPasskeysLoading(true);
    fetch(`/api/passkey/list?actorType=customer&ownerRef=${encodeURIComponent(customerEmail)}`)
      .then(r => r.json()).then(d => setPasskeys(d.passkeys || [])).catch(() => {}).finally(() => setPasskeysLoading(false));
  }, [customerEmail]);

  const removePasskey = async (id: string) => {
    if (!customerEmail) return;
    setRemovingId(id);
    await fetch('/api/passkey/delete', { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, actorType: 'customer', ownerRef: customerEmail }) });
    setPasskeys(prev => prev.filter(p => p.id !== id));
    setRemovingId(null);
  };

  const addPasskey = async () => {
    const plate = (rego || vehicle?.rego || garageVehicles[0]?.rego || '').toUpperCase();
    if (!plate) return;
    setPasskeyCardState('adding');
    try {
      await registerPasskey('customer', customerEmail || plate);
      setPasskeyCardState('added');
      // Re-fetch list
      if (customerEmail) {
        const d = await fetch(`/api/passkey/list?actorType=customer&ownerRef=${encodeURIComponent(customerEmail)}`).then(r => r.json());
        setPasskeys(d.passkeys || []);
      }
    } catch { setPasskeyCardState('error'); }
  };

  const saveProfile = async () => {
    setSaving(true);
    setUserName(editName);
    setLocation(editLocation);
    let ok = false;
    try {
      // Always prefer the admin-keyed server endpoint when we have an ownerId — it bypasses RLS
      // and is reliable regardless of Supabase auth session state.
      if (customerOwnerId || customerEmail) {
        const r = await fetch('/api/customer/save-profile', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: customerEmail, ownerId: customerOwnerId, name: editName, email_update: editEmail !== customerEmail ? editEmail : undefined, homeLocation: editLocation }),
        });
        const d = await r.json().catch(() => ({}));
        ok = d.ok === true;
      } else if (user) {
        await updateProfile({ name: editName, homeLocation: editLocation });
        ok = true;
      }
    } catch { ok = false; }
    setSaving(false);
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      alert('Could not save profile — please try again.');
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8 max-w-lg">
      <div className="space-y-1">
        <h2 className="text-3xl font-black tracking-tight">My Profile</h2>
        <p className="text-sm text-muted">Manage your account details and security.</p>
      </div>

      {/* Account details */}
      <Card className="p-6 bg-card border-border space-y-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted">Account Details</p>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted">Display Name</label>
            <input value={editName} onChange={e => setEditName(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-torqued-red transition-all"
              placeholder="Your name" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted">Email Address</label>
            <input value={editEmail} onChange={e => setEditEmail(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-torqued-red transition-all"
              placeholder="your@email.com" />
            <p className="text-[10px] text-muted">Changing your email will require re-verification on next login.</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted">City / Location</label>
            <div className="flex gap-2">
              <input value={editLocation} onChange={e => setEditLocation(e.target.value)}
                className="flex-1 bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-torqued-red transition-all"
                placeholder="e.g. Dunedin, Wellington" />
              <button type="button" onClick={useMyLocation} disabled={locating}
                className="shrink-0 px-3 rounded-xl border border-border text-torqued-red text-xs font-bold flex items-center gap-1.5 hover:bg-torqued-red/5 disabled:opacity-50 transition-all">
                <MapPin size={14} /> {locating ? 'Locating…' : 'Use GPS'}
              </button>
            </div>
            <p className="text-[10px] text-muted">Used to find nearby workshops for your quotes. Tap "Use GPS" for live location.</p>
          </div>
        </div>
        <button
          onClick={saveProfile}
          disabled={saving}
          className="w-full h-11 rounded-2xl bg-torqued-red text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-60 transition-all"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </Card>

      {/* Passkeys */}
      {passkeysSupported() && (
        <Card className="p-6 bg-card border-border space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted">Passkeys</p>
            <button
              onClick={addPasskey}
              disabled={passkeyCardState === 'adding'}
              className="text-[10px] font-black uppercase tracking-widest text-torqued-red hover:opacity-70 disabled:opacity-40 transition-all"
            >
              {passkeyCardState === 'adding' ? 'Adding…' : '+ Add Passkey'}
            </button>
          </div>
          {passkeyCardState === 'error' && <p className="text-xs text-torqued-red font-bold">Could not add passkey — try again.</p>}
          {passkeyCardState === 'added' && <p className="text-xs text-emerald-500 font-bold">Passkey added successfully.</p>}
          {passkeysLoading ? (
            <p className="text-xs text-muted">Loading passkeys…</p>
          ) : passkeys.length === 0 ? (
            <div className="p-4 bg-background rounded-xl border border-border text-center space-y-2">
              <p className="text-sm font-bold">No passkeys yet</p>
              <p className="text-xs text-muted">Add a passkey to sign in instantly without an email code.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {passkeys.map(pk => (
                <div key={pk.id} className="flex items-center justify-between p-3 bg-background border border-border rounded-xl">
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold">🔑 {pk.device_name || 'Passkey'}</p>
                    <p className="text-[10px] text-muted">Added {new Date(pk.created_at).toLocaleDateString('en-NZ')}</p>
                  </div>
                  <button
                    onClick={() => removePasskey(pk.id)}
                    disabled={removingId === pk.id}
                    className="text-[10px] font-black uppercase tracking-widest text-torqued-red hover:opacity-70 disabled:opacity-40 transition-all"
                  >
                    {removingId === pk.id ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Mechanic Access */}
      <Card className="p-6 bg-card border-border space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted">Mechanic Access</p>
          <button onClick={loadMechanicAccess} disabled={accessLoading} className="text-[10px] font-black uppercase tracking-widest text-torqued-red hover:opacity-70 disabled:opacity-40">
            {accessLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        {mechanicAccess.length === 0 ? (
          <p className="text-xs text-muted text-center py-3">No mechanics currently have access to your profile.</p>
        ) : (
          <div className="space-y-3">
            {mechanicAccess.map((m: any) => (
              <div key={m.mechanicId} className="p-4 bg-background border border-border rounded-xl space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-foreground">{m.mechanicName}</p>
                    {m.mechanicAddress && <p className="text-xs text-muted">{m.mechanicAddress}</p>}
                    {m.mechanicPhone && <p className="text-xs text-muted">{m.mechanicPhone}</p>}
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Access since</p>
                    <p className="text-xs text-foreground font-bold">{m.accessStarted ? new Date(m.accessStarted).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown'}</p>
                  </div>
                </div>
                <div className="space-y-1 border-t border-border pt-2">
                  {m.vehicles?.length > 0 && (
                    <p className="text-xs text-muted">Vehicle{m.vehicles.length > 1 ? 's' : ''}: <span className="text-foreground font-bold">{m.vehicles.join(', ')}</span></p>
                  )}
                  <p className="text-xs text-muted">Data: <span className="text-foreground">{(m.dataTypes?.length ? m.dataTypes : ['Service history', 'Job records']).join(' · ')}</span></p>
                  <p className="text-xs text-muted">{m.bookingCount || 0} booking{(m.bookingCount || 0) !== 1 ? 's' : ''} through Torqued</p>
                </div>
                <button
                  onClick={() => revokeMechanicAccess(m.mechanicId)}
                  className="w-full h-8 rounded-xl border border-torqued-red/30 text-torqued-red text-[10px] font-black uppercase tracking-widest hover:bg-torqued-red/5 transition-all"
                >
                  Revoke Access
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Transfer Vehicle Ownership */}
      {(customerOwnerId || user) && garageVehicles.length > 0 && (
        <Card className="p-5 space-y-4 bg-card border-border">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-muted mb-1">Transfer Vehicle Ownership</p>
            <p className="text-xs text-muted leading-relaxed">Transfer a vehicle and its full service history to another Torqued user. If they don't have an account yet, they'll receive an invite link to join and claim the vehicle.</p>
          </div>

          {txResult ? (
            <div className={cn("p-4 rounded-2xl space-y-2", txResult.ok ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-torqued-red/10 border border-torqued-red/20")}>
              <p className={cn("text-sm font-bold", txResult.ok ? "text-emerald-400" : "text-torqued-red")}>{txResult.ok ? '✓ Done' : '✗ Failed'}</p>
              <p className="text-xs text-muted leading-relaxed">{txResult.message}</p>
              <button onClick={() => { setTxResult(null); setTxEmail(''); setTxRego(''); }} className="text-xs font-bold text-muted underline">Transfer another vehicle</button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted uppercase tracking-widest">Vehicle</label>
                <select
                  value={txRego}
                  onChange={e => setTxRego(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm font-medium focus:outline-none focus:border-torqued-red/50 transition-colors appearance-none"
                >
                  <option value="">Select a vehicle…</option>
                  {garageVehicles.map(v => (
                    <option key={v.rego} value={v.rego}>{v.year} {v.make} {v.model} ({v.rego})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted uppercase tracking-widest">New Owner's Email</label>
                <input
                  type="email"
                  value={txEmail}
                  onChange={e => setTxEmail(e.target.value)}
                  placeholder="new.owner@email.com"
                  className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm font-medium focus:outline-none focus:border-torqued-red/50 transition-colors"
                />
                <p className="text-[11px] text-muted leading-relaxed">If they don't have a Torqued account, they'll receive an invite email with a secure link to claim the vehicle.</p>
              </div>
              <div className="p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl">
                <p className="text-[11px] text-amber-400 leading-relaxed">⚠ This is permanent. You will lose access to this vehicle and its service history once transferred.</p>
              </div>
              <button
                disabled={txLoading || !txRego || !txEmail.trim().includes('@')}
                onClick={async () => {
                  setTxLoading(true);
                  try {
                    const r = await fetch('/api/customer/transfer-vehicle', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ ownerId: customerOwnerId, rego: txRego, recipientEmail: txEmail.trim() }),
                    });
                    const d = await r.json();
                    if (!r.ok) {
                      setTxResult({ ok: false, message: d.error || 'Transfer failed — please try again.' });
                    } else if (d.invited) {
                      setTxResult({ ok: true, message: `Invite sent to ${txEmail.trim()}. They'll receive an email with a secure link to join Torqued and claim ${txRego}. The vehicle stays in your garage until they accept.` });
                    } else {
                      setTxResult({ ok: true, message: `${txRego} has been transferred to ${d.recipientName || txEmail.trim()}. It has been removed from your garage.` });
                      onVehicleTransferred?.(txRego);
                    }
                  } catch {
                    setTxResult({ ok: false, message: 'Network error — please try again.' });
                  } finally {
                    setTxLoading(false);
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-torqued-red text-white text-sm font-black hover:bg-red-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {txLoading ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Transferring…</> : 'Transfer Ownership'}
              </button>
            </div>
          )}
        </Card>
      )}

      {/* Sign out */}
      <button
        onClick={() => { clearCustomerSession(); logout(); }}
        className="w-full h-11 rounded-2xl border border-border text-sm font-bold text-muted hover:text-torqued-red hover:border-torqued-red/30 hover:bg-torqued-red/5 transition-all"
      >
        Sign Out
      </button>
    </motion.div>
  );
};

// Maps a raw /api/mechanics (or /api/mechanic/public/:id) record into the shape
// used throughout the booking flow. Shared by the mechanic-list fetch and the
// direct-booking-link landing screen so both paths behave identically.
function mapMechanicRecord(m: any): Mechanic {
  return {
    id: m.id,
    name: m.name || 'Workshop',
    logo: `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name || 'W')}&background=FF1800&color=fff&bold=true`,
    suburb: m.address ? String(m.address).split(',').slice(-1)[0].trim() : 'NZ',
    address: m.address || undefined,
    mapsUrl: m.latitude && m.longitude
      ? `https://www.google.com/maps?q=${m.latitude},${m.longitude}`
      : m.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(m.address)}`
        : undefined,
    distance: 999,
    rating: m.rating || 5.0,
    reviews: m.review_count || 0,
    labourRate: m.labour_rate || undefined,
    nextAvailable: 'Tomorrow, 8am',
    isFeatured: true,
    estimatedPrice: 0,
    technicians: m.technicians || 1,
    partsLeadDays: m.parts_lead_days ?? 1,
    latitude: m.latitude ?? undefined,
    longitude: m.longitude ?? undefined,
    offersPpi: !!m.offers_ppi,
    wofDisabled: !!m.wof_disabled,
  } as any;
}

export const CustomerPortal: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { theme, setTheme } = useTheme();
  const { user, userProfile, logout, checkPlateExists, registerVehicle, updateProfile } = useAuth();

  const loadImageDataUrl = (src: string): Promise<string | null> =>
    new Promise((resolve) => {
      fetch(src)
        .then(r => r.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        })
        .catch(() => resolve(null));
    });

  // One branded document in the Torqued QUOTE design language. It becomes an INVOICE
  // once paid, and grows BOOKING/PAYMENT + CANCELLATION sections only when relevant.
  const generateBookingPDF = async (job: Job) => {
    const j = job as any;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    const detail = jobDetail[job.id] || {};
    const qi = j.quoteItems || detail.quoteItems || null;
    const isPaid = job.paymentStatus === 'confirmed';
    const isCompleted = job.status === 'completed';
    const isBooked = isPaid || (!!job.date && ['booked', 'in_progress', 'completed'].includes(job.status));
    const isInvoice = isPaid || isCompleted;
    const docTitle = isInvoice ? 'TAX INVOICE' : 'SERVICE QUOTE';

    const mechName  = j.mechanicName || 'Your Workshop';
    const mechAddr  = j.mechanicAddress || '';
    const noticeHrs = j.cancellationNoticeHours ?? 24;
    const refundPct = j.cancellationRefundPct ?? 50;
    const cName  = job.customerName || userProfile?.name || '';
    const cEmail = job.email || userProfile?.email || customerEmail || '';
    const rego = (job.vehicleId || vehicle?.rego || '').toUpperCase();
    const vehicleDesc = vehicle ? [vehicle.year, vehicle.make, vehicle.model, (vehicle as any).variant || null].filter(Boolean).join(' ') : '';
    const mileage = vehicle?.mileage || null;

    let bookingDateStr = '';
    if (job.date) { const d = new Date(job.date); bookingDateStr = isNaN(d.getTime()) ? String(job.date) : d.toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }

    const parts = qi && Array.isArray(qi.parts) ? qi.parts.filter((p: any) => p.name) : [];
    const labourTotal = qi ? (qi.labourHours || 0) * (qi.labourRate || 0) : 0;
    const other = qi && Array.isArray(qi.other) ? qi.other.filter((o: any) => o.name || o.label) : [];
    const shopFee = qi ? Number(qi.shopFee) || 0 : 0;
    const discount = qi ? qi.discount || 0 : 0;
    const total = detail.total > 0 ? detail.total : (j.quotedPrice ?? job.totalPrice);
    const notes = qi?.notes || j.quoteNote || j.description || '';

    // ── Header (Torqued quote style) ──
    const logo = await loadImageDataUrl('/torqued-logo.png');
    if (logo) doc.addImage(logo, 'PNG', 15, 8, 52, 17.4);
    doc.setFillColor(255, 24, 0); doc.rect(0, 30, 210, 2, 'F');
    doc.setTextColor(21, 4, 2); doc.setFont('Helvetica', 'bold'); doc.setFontSize(11);
    doc.text(docTitle, 195, 16, { align: 'right' });
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(80, 80, 80);
    doc.text(`Ref #${job.id.toUpperCase()}`, 195, 22, { align: 'right' });
    doc.text(new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }), 195, 27, { align: 'right' });

    // ── Workshop / Customer / Vehicle ──
    doc.setTextColor(21, 4, 2); doc.setFontSize(9.5);
    doc.setFont('Helvetica', 'bold'); doc.text('WORKSHOP', 15, 44);
    doc.setFont('Helvetica', 'normal'); doc.text(mechName, 15, 50);
    if (mechAddr) doc.splitTextToSize(mechAddr, 90).forEach((ln: string, i: number) => doc.text(ln, 15, 55 + i * 5));
    doc.setFont('Helvetica', 'bold'); doc.text('CUSTOMER', 115, 44);
    doc.setFont('Helvetica', 'normal');
    if (cName) doc.text(cName, 115, 50);
    if (cEmail) doc.text(cEmail.length > 32 ? cEmail.slice(0, 30) + '…' : cEmail, 115, cName ? 55 : 50);
    doc.setFont('Helvetica', 'bold'); doc.text('VEHICLE', 165, 44);
    doc.setFont('Helvetica', 'normal');
    let vY = 50;
    if (vehicleDesc) { doc.splitTextToSize(vehicleDesc, 40).forEach((ln: string) => { doc.text(ln, 165, vY); vY += 5; }); }
    doc.text(rego, 165, vY); vY += 5;
    if (mileage) doc.text(`${Number(mileage).toLocaleString()} km`, 165, vY);

    let y = 72;
    const row = (label: string, amt: string, bold = false) => { doc.setFont('Helvetica', bold ? 'bold' : 'normal'); const ll = doc.splitTextToSize(label, 150); doc.text(ll, 15, y); if (amt) doc.text(amt, 195, y, { align: 'right' }); y += 6.5 + (ll.length - 1) * 4.5; };
    const heading = (label: string) => { doc.setFont('Helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 24, 0); doc.text(label, 15, y); doc.setDrawColor(226, 232, 240); doc.line(15, y + 2, 195, y + 2); y += 9; doc.setFontSize(9); doc.setTextColor(21, 4, 2); };

    // ── Itemised ──
    heading(isInvoice ? 'ITEMISED INVOICE' : 'ITEMISED QUOTE');
    if (qi) {
      parts.forEach((p: any) => row(`${p.name}  x${p.qty || 1}`, `$${((p.qty || 1) * (p.unitPrice || 0)).toFixed(2)}`));
      if (labourTotal > 0) row(`Labour (${qi.labourHours}h @ $${qi.labourRate}/hr)`, `$${labourTotal.toFixed(2)}`);
      other.forEach((o: any) => row(o.name || o.label, `$${Number(o.amount || 0).toFixed(2)}`));
      if (shopFee > 0) row('Workshop fee (freight, sundries & consumables)', `$${shopFee.toFixed(2)}`);
      if (discount > 0) row('Discount', `-$${discount.toFixed(2)}`);
    } else {
      const isEVQuoteJob = (job.description || '').startsWith('[EV Quote Request]');
      if (isEVQuoteJob) {
        row('Prequalified Quote Request', '');
        const rawDesc = (job.description || '').replace('[EV Quote Request] ', '');
        if (rawDesc) row(rawDesc, '');
      } else {
        job.serviceIds.forEach((sid: string) => row(SERVICES.find((s: any) => s.id === sid)?.name || sid, ''));
      }
    }
    y += 2; doc.setDrawColor(226, 232, 240); doc.line(15, y, 195, y); y += 7;
    doc.setFontSize(12); doc.setTextColor(255, 24, 0); row('TOTAL (GST incl.)', `$${Number(total).toFixed(2)}`, true);

    // ── Booking & payment (only when relevant) ──
    if (isBooked) {
      y += 4; heading('BOOKING & PAYMENT');
      if (bookingDateStr) row('Drop-off', bookingDateStr);
      row('Payment method', job.paymentMethod || 'Card');
      row('Payment status', isPaid ? 'PAID IN FULL' : 'Awaiting payment');
      if (isCompleted) row('Job status', 'Completed');
    }

    // ── Notes ──
    if (notes) {
      y += 4; doc.setFont('Helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(21, 4, 2); doc.text('Notes', 15, y);
      y += 5; doc.setFont('Helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(80, 80, 80);
      doc.splitTextToSize(notes.trim(), 180).forEach((line: string) => { doc.text(line, 15, y); y += 4.5; });
    }

    // ── Cancellation policy (only for upcoming, not-yet-completed jobs) ──
    if (isBooked && !isCompleted) {
      y += 6; doc.setFont('Helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(21, 4, 2); doc.text('Cancellation policy', 15, y);
      y += 5; doc.setFont('Helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(80, 80, 80);
      const policyText = `Full refund if cancelled ${noticeHrs}+ hours before drop-off (excluding weekends & public holidays). Cancellations within ${noticeHrs} hours receive a ${refundPct}% refund per ${mechName}'s policy.`;
      doc.splitTextToSize(policyText, 180).forEach((line: string) => { doc.text(line, 15, y); y += 4.5; });
    }

    // ── QR "book" block — only for an open, unbooked quote ──
    if (!isBooked) {
      const quoteUrl = `https://torqued.site/customer?quote=${encodeURIComponent(job.id)}`;
      const qr = await loadImageDataUrl('https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=' + encodeURIComponent(quoteUrl));
      if (qr) doc.addImage(qr, 'PNG', 15, 240, 32, 32);
      doc.setTextColor(21, 4, 2); doc.setFont('Helvetica', 'bold'); doc.setFontSize(11);
      doc.text('Book on your own terms with Torqued', 52, 250);
      doc.setFont('Helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100, 100, 100);
      doc.text('Scan the QR code to accept this quote and book instantly.', 52, 256);
    } else {
      doc.setTextColor(21, 4, 2); doc.setFont('Helvetica', 'bold'); doc.setFontSize(11);
      doc.text(isCompleted ? 'Thank you — this job is complete.' : 'Thank you — your booking is confirmed.', 15, 252);
    }

    // ── Footer ──
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(150, 150, 150);
    doc.text(`${isInvoice ? 'Tax invoice' : 'Quote'} provided via Torqued — NZ's smarter way to get your car sorted. Prices include 15% GST.`, 15, 285);

    doc.save(`Torqued-${isInvoice ? 'Invoice' : 'Quote'}-${job.id.toUpperCase()}.pdf`);
  };
  const [step, setStep] = useState(1);
  const [rego, setRego] = useState('');
  const [isSearchingRego, setIsSearchingRego] = useState(false);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [mileage, setMileage] = useState<string>('');
  const [quotePath, setQuotePath] = useState<'service' | 'fault' | null>('service');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [faultCode, setFaultCode] = useState('');
  const [aiTranslation, setAiTranslation] = useState('');
  const [location, setLocation] = useState('');
  const [radius, setRadius] = useState('10km');
  const [selectedMechanic, setSelectedMechanic] = useState<Mechanic | null>(null);
  const [paymentOption, setPaymentOption] = useState<'full' | 'deposit'>('full');
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [view, setView] = useState<'quote' | 'dashboard' | 'profile'>('quote');
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);
  // Split the garage job list: current/upcoming work vs finished history
  const [jobsView, setJobsView] = useState<'active' | 'past'>('active');
  const [isEditingDate, setIsEditingDate] = useState<string | null>(null);
  const [newDate, setNewDate] = useState('');
  const [userServiceItems, setUserServiceItems] = useState<UserServiceItem[]>([
    { id: '1', name: 'WOF Inspection', lastDoneDate: '2025-05-10', intervalMonths: 12 },
    { id: '2', name: 'Timing Belt', lastDoneMileage: 0, intervalMileage: 120000 },
  ]);
  const [isAddingServiceItem, setIsAddingServiceItem] = useState(false);
  const [newServiceItemName, setNewServiceItemName] = useState('');
  const [newServiceItemMileage, setNewServiceItemMileage] = useState('');
  const [suggestedJobs, setSuggestedJobs] = useState<string[]>([]);

  // Scheduling state
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // Default to next weekday 2 business days from today
    const d = new Date();
    let added = 0;
    while (added < 2) {
      d.setDate(d.getDate() + 1);
      const day = d.getDay();
      if (day !== 0 && day !== 6) added++;
    }
    return d.toISOString().slice(0, 10);
  });
  const [selectedTime, setSelectedTime] = useState<string>('09:00');
  // Real next-available drop-off dates computed server-side from the workshop's
  // availability + parts lead time + business-day calendar.
  const [availableDates, setAvailableDates] = useState<{ date: string; day: string; label: string }[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [estimatedReadyTime, setEstimatedReadyTime] = useState<string>('5:00 PM');
  const [collectNextDay, setCollectNextDay] = useState(false);
  
  // New user / history state
  const [isNewVehicle, setIsNewVehicle] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchaseMileage, setPurchaseMileage] = useState('');
  const [manualHistory, setManualHistory] = useState<{date: string, service: string, provider: string, mileage?: string, price?: string, notes?: string, source_type?: string, id?: string, ai_summary?: string | null}[]>([]);
  const [showHistoryEntry, setShowHistoryEntry] = useState(false);
  const [showHistorySheet, setShowHistorySheet] = useState(false);
  const [entryDate, setEntryDate] = useState('');
  const [entryService, setEntryService] = useState('');
  const [entryProvider, setEntryProvider] = useState('');
  const [entryMileage, setEntryMileage] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [entryNotes, setEntryNotes] = useState('');
  const [isParsingReceipt, setIsParsingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  // Mechanic access permissions
  const [mechanicAccess, setMechanicAccess] = useState<Array<{ mechanicId: string; mechanicName: string; mechanicEmail: string; grantedAt: string; accessType: string }>>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  // Multi-file drag-and-drop service-history import
  type ParsedRecord = { id: string; date: string; service: string; provider: string; mileage: string; price: string; notes: string; fileName: string };
  const [parsedBatch, setParsedBatch] = useState<ParsedRecord[]>([]);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [batchSaving, setBatchSaving] = useState(false);
  const [showBatchReview, setShowBatchReview] = useState(false);
  const [isDiagnosticMode, setIsDiagnosticMode] = useState(false);
  const [diagnosticComment, setDiagnosticComment] = useState('');
  const [evQuoteConcern, setEvQuoteConcern] = useState('');
  const [brakeRotorCheckMode, setBrakeRotorCheckMode] = useState(false);
  const [isDiagnosticSimulatedComplete, setIsDiagnosticSimulatedComplete] = useState(false);
  const [isRepairFromDiagnostic, setIsRepairFromDiagnostic] = useState(false);
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState('');
  const [hasMBI, setHasMBI] = useState(false);
  const [mbiStatus, setMbiStatus] = useState<'none' | 'pre-approved' | 'not-claimed'>('none');
  const [claimNumber, setClaimNumber] = useState('');
  const [dob, setDob] = useState('');
  const [userName, setUserName] = useState<string | null>(null);
  const [isClaimApproved, setIsClaimApproved] = useState(false);

  // Verification states for registered plates
  const [showVerificationRequired, setShowVerificationRequired] = useState(false);
  const [verifiedEmailTarget, setVerifiedEmailTarget] = useState<string | null>(null);
  const [plateMatchError, setPlateMatchError] = useState<string | null>(null);

  // New customer registration
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  // Manual vehicle entry fallback when rego lookup returns 404
  const [showManualVehicle, setShowManualVehicle] = useState(false);
  const [manualYear, setManualYear] = useState('');
  const [manualMake, setManualMake] = useState('');
  const [manualModel, setManualModel] = useState('');
  const [manualSubmodel, setManualSubmodel] = useState('');
  const [manualVehicleLoading, setManualVehicleLoading] = useState(false);
  const [manualVehicleError, setManualVehicleError] = useState<string | null>(null);
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerError, setNewCustomerError] = useState<string | null>(null);
  const [newCustomerLoading, setNewCustomerLoading] = useState(false);
  const [returningCustomerName, setReturningCustomerName] = useState<string | null>(null);
  // The customer's real email (from onboarding/verification) — used for Stripe checkout
  const [customerEmail, setCustomerEmail] = useState<string>('');
  // Per-vehicle service pricing loaded from the DB for the active vehicle
  const [vehiclePrices, setVehiclePrices] = useState<Record<string, number>>({});
  // Vehicle oil spec (from vehicle_specs) — used to calculate mechanic package price for this vehicle
  const [vehicleOilCapacity, setVehicleOilCapacity] = useState<number | null>(null);
  const [vehicleOilType, setVehicleOilType] = useState<string | null>(null);
  // Mechanic's service packages fetched when a mechanic is selected
  const [mechanicPackages, setMechanicPackages] = useState<any[]>([]);
  // The customer's garage — all vehicles on their account
  const [garageVehicles, setGarageVehicles] = useState<Vehicle[]>([]);
  const [customerOwnerId, setCustomerOwnerId] = useState<string | null>(null);
  // ── My Garage session gate: verified via passkey or magic link, valid 48h, this browser only ──
  const SESSION_KEY = 'torqued_customer_session';
  const SESSION_TTL = 48 * 60 * 60 * 1000;
  const [customerVerifiedAt, setCustomerVerifiedAt] = useState<number | null>(null);
  const garageUnlocked = customerVerifiedAt != null && (Date.now() - customerVerifiedAt) < SESSION_TTL;
  const persistCustomerSession = (s: { ownerId: string | null; email: string; rego: string; vehicles: any[] }) => {
    const at = Date.now();
    setCustomerVerifiedAt(at);
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ ...s, verifiedAt: at })); } catch {}
  };
  const clearCustomerSession = () => {
    setCustomerVerifiedAt(null); setCustomerOwnerId(null); setCustomerEmail(''); setGarageVehicles([]);
    try { localStorage.removeItem(SESSION_KEY); } catch {}
  };
  // Real mechanics from the DB (so bookings route to a real mechanic account)
  const [realMechanics, setRealMechanics] = useState<Mechanic[]>([]);

  // Fleet quote lookup state (vehicle_models + parts_data)
  const [fleetQuoteState, setFleetQuoteState] = useState<'loading' | 'instant' | 'fallback' | null>(null);
  const [fleetQuoteRange, setFleetQuoteRange] = useState<{ low: number; high: number } | null>(null);
  const [fleetVehicleId, setFleetVehicleId] = useState<string | null>(null);
  const [fleetPricesRaw, setFleetPricesRaw] = useState<Record<string, any>>({});
  const [waterPumpInDB, setWaterPumpInDB] = useState(false);
  const [differentialInDB, setDifferentialInDB] = useState(false);
  const [differentialApplicable, setDifferentialApplicable] = useState(false);
  const [vehicleTimingDrive, setVehicleTimingDrive] = useState<'belt' | 'chain' | 'na' | null>(null);
  const isEV = vehicle?.make?.toLowerCase() === 'tesla' ||
               !!vehicle?.fuelType?.toLowerCase()?.includes('electric') ||
               (vehicleTimingDrive === 'na' && !!vehicle?.make);
  const [fleetShopFee, setFleetShopFee] = useState<number | null>(null);
  const [waterPumpRecommended, setWaterPumpRecommended] = useState(false);
  const [waterPump, setWaterPump] = useState<{ partsLow: number; partsHigh: number; labourExtra: number; low: number; high: number } | null>(null);
  const [timingIntervalKm, setTimingIntervalKm] = useState<number | null>(null);
  const [addWaterPump, setAddWaterPump] = useState(false);
  const [customServiceQuery, setCustomServiceQuery] = useState('');
  const [customSearchResults, setCustomSearchResults] = useState<Array<{ id: string; name: string; indicativePrice: number }>>([]);
  const [customSearchDone, setCustomSearchDone] = useState(false);
  const [customSearchLoading, setCustomSearchLoading] = useState(false);
  const [editingMileage, setEditingMileage] = useState(false);

  // Service log inline editing
  const [editingLogIdx, setEditingLogIdx] = useState<number | null>(null);
  const [editLogDate, setEditLogDate] = useState('');
  const [editLogService, setEditLogService] = useState('');
  const [editLogProvider, setEditLogProvider] = useState('');
  const [editLogMileage, setEditLogMileage] = useState('');
  const [editLogPrice, setEditLogPrice] = useState('');
  const [editLogNotes, setEditLogNotes] = useState('');

  // "Job not listed here" quote request
  const [showUnlistedQuote, setShowUnlistedQuote] = useState(false);
  const [carjamVehicle, setCarjamVehicle] = useState<{
    make: string; model: string; year: number; variant: string;
    vin: string | null; engineCc: number | null; transmissionType: string | null;
    fuelType: string | null; stolenFlag: boolean; latestOdometer: number | null;
    power: number | null; rawMake: string;
    // legacy compat
    bodyType?: string; fuel?: string;
  } | null>(null);
  const [carjamStolenWarning, setCarjamStolenWarning] = useState(false);
  const [vehicleModelSpec, setVehicleModelSpec] = useState<{ engine_code: string | null; engine_cc: number | null; fuel: string | null; transmission: string | null; timing_drive: string | null; submodel?: string | null } | null>(null);
  const [vehicleModelOptions, setVehicleModelOptions] = useState<any[]>([]);
  const [showSubmodelPicker, setShowSubmodelPicker] = useState(false);
  const [quoteFallbackCategoryId, setQuoteFallbackCategoryId] = useState<number | null>(null);

  const [mechanicsLoading, setMechanicsLoading] = useState(true);
  useEffect(() => {
    fetch('/api/mechanics')
      .then(r => r.json())
      .then(d => {
        setRealMechanics((d.mechanics || []).map(mapMechanicRecord));
        setMechanicsLoading(false);
      })
      .catch(() => { setMechanicsLoading(false); });
  }, []);

  // Consumer location for distance-based mechanic search (Google/device location services)
  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationAsked, setLocationAsked] = useState(false);

  // ── Customer AI assistant (diagnostic + maintenance chat) ──
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; text: string; image?: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatPhoto, setChatPhoto] = useState<string | null>(null);
  const chatStarters = [
    'When are my spark plugs due?',
    'Grinding noise when I brake — what is it?',
    'My car is overdue a service, what do I need?',
    'A warning light is on — is it safe to drive?',
  ];
  const sendChat = async (text: string, photo?: string | null) => {
    const t = text.trim();
    const img = photo ?? chatPhoto;
    if (!t && !img || chatBusy) return;
    const userMsg: { role: 'user'; text: string; image?: string } = { role: 'user', text: t || 'What can you see in this photo?' };
    if (img) userMsg.image = img;
    const next = [...chatMessages, userMsg];
    setChatMessages(next);
    setChatInput('');
    setChatPhoto(null);
    setChatBusy(true);
    try {
      const res = await fetch('/api/ai/customer-assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.text, ...(m.image ? { image: m.image } : {}) })),
          ownerId: customerOwnerId, rego: vehicle?.rego,
          lat: customerCoords?.lat, lng: customerCoords?.lng,
        }),
      });
      const d = await res.json();
      setChatMessages(m => [...m, { role: 'assistant', text: res.ok ? (d.reply || 'Sorry, I could not answer that.') : (d.error || 'Assistant unavailable.') }]);
    } catch {
      setChatMessages(m => [...m, { role: 'assistant', text: 'The assistant is unavailable right now. Please try again.' }]);
    } finally {
      setChatBusy(false);
    }
  };
  const requestLocation = () => {
    setLocationAsked(true);
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => setCustomerCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { /* denied — fall back to showing all mechanics */ },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );
  };
  const haversineKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const R = 6371, toRad = (d: number) => d * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)) * 10) / 10;
  };
  // Mechanics with a real distance from the consumer (when location known)
  const mechanicsByDistance = useMemo(() => {
    if (!customerCoords) return realMechanics;
    return realMechanics
      .map(m => (m.latitude != null && m.longitude != null && m.latitude !== 0 && m.longitude !== 0)
        ? { ...m, distance: haversineKm(customerCoords, { lat: m.latitude, lng: m.longitude }) }
        : m)
      .sort((a, b) => a.distance - b.distance);
  }, [realMechanics, customerCoords]);

  // Per-mechanic estimated price for the mechanic-list step. Each workshop has its
  // own labour_rate/shop_fee, so the headline "Est. Quote" must be re-priced per
  // mechanic via the same endpoint (passing ?mechanic=<id>) rather than reusing one
  // generic total for every card.
  const [mechanicPrices, setMechanicPrices] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!rego || mechanicsByDistance.length === 0 || selectedServices.length === 0) return;
    let cancelled = false;
    mechanicsByDistance.forEach(async (m) => {
      if (!m.id || mechanicPrices[m.id] !== undefined) return;
      try {
        const r = await fetch(`/api/fleet-prices?rego=${encodeURIComponent(rego)}&mechanic=${encodeURIComponent(m.id)}`);
        const fp = await r.json();
        if (cancelled) return;
        let t = selectedServices.reduce((sum, id) => sum + (Number(fp?.[id]?.high) || 0), 0);
        if (addWaterPump && waterPump && (selectedServices.includes('timing') || selectedServices.includes('timing_chain_full'))) {
          t += Number(fp?.['thermostat_housing']?.high) || waterPump.high;
        }
        const isDiagOnly = selectedServices.length === 1 && selectedServices[0] === 'diag_inspection';
        if (t > 0 && !isDiagOnly && fp?.shopFee) t += fp.shopFee;
        if (t > 0) setMechanicPrices(prev => ({ ...prev, [m.id]: t }));
      } catch { /* keep the generic totalPrice fallback for this card */ }
    });
    return () => { cancelled = true; };
  }, [rego, mechanicsByDistance, selectedServices, addWaterPump, waterPump]);

  // OTP Verification States
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSentEmail, setOtpSentEmail] = useState('');
  const [otpVerificationError, setOtpVerificationError] = useState('');
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);
  const [otpResendMsg, setOtpResendMsg] = useState<string | null>(null);
  // Magic-link verification state
  const [magicSentTo, setMagicSentTo] = useState<string | null>(null);
  const [magicFallbackLink, setMagicFallbackLink] = useState<string | null>(null);
  const [magicVerifying, setMagicVerifying] = useState(false);
  // Pending vehicle claim (from transfer invite link ?claim=<token>)
  const [claimToken, setClaimToken] = useState<string | null>(() => new URLSearchParams(window.location.search).get('claim'));
  const [claimInfo, setClaimInfo] = useState<{ rego: string; vehicleLabel: string; recipientEmail: string } | null>(null);
  const [claimOtpSent, setClaimOtpSent] = useState(false);
  const [claimOtp, setClaimOtp] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimDone, setClaimDone] = useState(false);

  // Restore a recent (≤48h) verified session on this browser
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s.verifiedAt && (Date.now() - s.verifiedAt) < SESSION_TTL) {
        setCustomerVerifiedAt(s.verifiedAt);
        if (s.ownerId) setCustomerOwnerId(s.ownerId);
        if (s.email) setCustomerEmail(s.email);
        if (Array.isArray(s.vehicles) && s.vehicles.length) {
          setGarageVehicles(s.vehicles.map((r: any) => ({ id: r.rego, rego: r.rego, make: r.make, model: r.model, year: r.year, variant: r.variant ?? undefined, mileage: r.mileage ?? 0, thumbnail: r.thumbnail ?? undefined })));
        }
        // A returning, verified customer should land on their garage — not the quote flow —
        // unless they arrived via a special link (standalone quote, payment return, etc.).
        const sp = new URLSearchParams(window.location.search);
        if (!sp.get('quote') && !sp.get('session_id') && !sp.get('reschedule_accept') && !sp.get('vt')) {
          setView('dashboard');
        }
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    } catch {}
  }, []);

  // Load ALL of this customer's real bookings (multiple jobs, persistent across refresh)
  const loadCustomerBookings = async () => {
    const regos = garageVehicles.map(g => g.rego).filter(Boolean);
    if (!customerOwnerId && regos.length === 0) return;
    try {
      const qs = new URLSearchParams();
      if (customerOwnerId) qs.set('ownerId', customerOwnerId);
      if (regos.length) qs.set('regos', regos.join(','));
      const res = await fetch(`/api/customer/bookings?${qs.toString()}`);
      const { bookings } = await res.json();
      if (!Array.isArray(bookings)) return;
      const mapped: Job[] = bookings
        .filter((r: any) => !['cancelled', 'declined'].includes(r.status))
        .map((r: any) => ({
          id: r.id, vehicleId: r.vehicle_rego || '', serviceIds: r.service_ids || [],
          mechanicId: r.mechanic_id || '', status: r.status || 'booked',
          paymentStatus: r.payment_status === 'confirmed' ? 'confirmed' : r.payment_status || 'pending',
          paymentMethod: r.payment_method || '', date: r.date || '',
          totalPrice: parseFloat(r.total_price) || 0,
          quotedPrice: r.quoted_price != null ? parseFloat(r.quoted_price) : undefined,
          quoteNote: r.quote_note || undefined,
          quoteItems: r.quote_items || undefined,
          depositPaid: r.deposit_paid ?? undefined,
          description: r.description || undefined, customerName: r.customer_name || undefined,
          email: r.email || undefined, phone: r.phone || undefined,
          // Mechanic profile fields — enriched server-side
          transactionId: r.transaction_id || undefined,
          mechanicName: r.mechanic_name || undefined,
          mechanicAddress: r.mechanic_address || undefined,
          mechanicPhone: r.mechanic_phone || undefined,
          cancellationNoticeHours: r.cancellation_notice_hours ?? 24,
          cancellationRefundPct: r.cancellation_partial_refund_pct ?? 50,
        } as any));
      setActiveJobs(mapped);
    } catch { /* keep local jobs */ }
  };
  // Sync vehicle list from server when garage unlocks — clears stale cached vehicles
  useEffect(() => {
    if (!garageUnlocked || !customerOwnerId) return;
    fetch(`/api/customer/vehicles?ownerId=${encodeURIComponent(customerOwnerId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.vehicles) {
          const fresh = d.vehicles.map((r: any) => ({ id: r.rego, rego: r.rego, make: r.make, model: r.model, year: r.year, variant: r.variant ?? undefined, mileage: r.mileage ?? 0, thumbnail: r.thumbnail ?? undefined }));
          setGarageVehicles(fresh);
          persistCustomerSession({ ownerId: customerOwnerId, email: customerEmail, rego: fresh[0]?.rego ?? '', vehicles: fresh });
        }
      }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [garageUnlocked, customerOwnerId]);

  useEffect(() => { if (garageUnlocked) loadCustomerBookings(); /* eslint-disable-next-line */ }, [garageUnlocked, customerOwnerId, garageVehicles.length]);

  // Auto-select the first non-archived vehicle when the garage opens so service history shows immediately
  useEffect(() => {
    if (!garageUnlocked || view !== 'garage') return;
    const first = garageVehicles.find(gv => !archivedRegos.includes(gv.rego));
    if (first && first.rego !== vehicle?.rego) loadVehicleByRego(first.rego);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [garageUnlocked, garageVehicles.length, view]);

  // Verify a magic link on load (?vt=token)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vt = params.get('vt');
    if (!vt) return;
    setMagicVerifying(true);
    window.history.replaceState({}, document.title, window.location.pathname);
    fetch(`/api/customer/verify-link?token=${encodeURIComponent(vt)}`)
      .then(r => r.json())
      .then(async (d) => {
        if (!d.success) { setPlateMatchError(d.error || 'Link invalid or expired.'); return; }
        if (d.email) setCustomerEmail(d.email);
        if (d.ownerId) setCustomerOwnerId(d.ownerId);
        if (Array.isArray(d.vehicles) && d.vehicles.length) {
          setGarageVehicles(d.vehicles.map((r: any) => ({ id: r.rego, rego: r.rego, make: r.make, model: r.model, year: r.year, variant: r.variant ?? undefined, mileage: r.mileage ?? 0, thumbnail: r.thumbnail ?? undefined })));
        }
        setRego(d.rego);
        persistCustomerSession({ ownerId: d.ownerId ?? null, email: d.email ?? '', rego: d.rego, vehicles: d.vehicles ?? [] });
        setView('dashboard');
        await loadVehicleByRego(d.rego);
      })
      .catch(() => setPlateMatchError('Verification failed. Please try again.'))
      .finally(() => setMagicVerifying(false));
  }, []);
  // QR deep-link → review-and-pay with the mechanic's quote pre-loaded
  const [quoteReview, setQuoteReview] = useState<any | null>(null);
  const [quotePaying, setQuotePaying] = useState(false);
  const [quoteOnlyMode, setQuoteOnlyMode] = useState(() => !!new URLSearchParams(window.location.search).get('quote'));

  // Direct-booking link (?book=<mechanicId>) — a mechanic's own shareable link.
  // Shows a standalone "Book with [Name]" landing screen; once confirmed, the
  // customer goes through the normal flow but the mechanic-choice step is
  // skipped entirely and every price/booking is locked to this one mechanic.
  const [directBookMechanicIdParam] = useState(() => new URLSearchParams(window.location.search).get('book'));
  const [directBookProfile, setDirectBookProfile] = useState<Mechanic | null>(null);
  const [directBookConfirmed, setDirectBookConfirmed] = useState(false);
  const [directBookError, setDirectBookError] = useState(false);
  useEffect(() => {
    if (!directBookMechanicIdParam) return;
    window.history.replaceState({}, document.title, window.location.pathname);
    fetch(`/api/mechanic/public/${encodeURIComponent(directBookMechanicIdParam)}`)
      .then(r => r.json())
      .then(d => { if (d?.mechanic) setDirectBookProfile(mapMechanicRecord(d.mechanic)); else setDirectBookError(true); })
      .catch(() => setDirectBookError(true));
  }, [directBookMechanicIdParam]);

  useEffect(() => {
    // Load transfer claim info if arriving via invite link
    if (claimToken) {
      window.history.replaceState({}, document.title, window.location.pathname);
      fetch(`/api/customer/transfer-invite?token=${encodeURIComponent(claimToken)}`)
        .then(r => r.json())
        .then(d => { if (d.rego) setClaimInfo(d); else { setClaimError('This invite link is invalid or has expired.'); setClaimToken(null); } })
        .catch(() => { setClaimError('Could not load invite. Try again.'); setClaimToken(null); });
    }

    const params = new URLSearchParams(window.location.search);
    const qid = params.get('quote');
    if (!qid) return;
    window.history.replaceState({}, document.title, window.location.pathname);
    fetch(`/api/quote/${encodeURIComponent(qid)}`).then(r => r.json()).then(d => { if (d && d.id) setQuoteReview(d); else setQuoteOnlyMode(false); }).catch(() => setQuoteOnlyMode(false));
  }, []);
  const payQuote = async () => {
    if (!quoteReview) return;
    setQuotePaying(true);
    try {
      // Stripe checkout is a full page navigation away and back — all in-memory
      // React state (quoteReview, quoteOnlyMode) is lost. Persist just enough to
      // rebuild the confirmation screen on return, or the customer lands on a
      // blank "Enter Your Car" with no sign their payment succeeded.
      localStorage.setItem('pending_quote_payment', JSON.stringify({
        id: quoteReview.id, rego: quoteReview.rego, vehicleLabel: quoteReview.vehicleLabel,
        mechanicName: quoteReview.mechanicName, serviceIds: quoteReview.serviceIds,
        note: quoteReview.note, total: quoteReview.total,
      }));
      const res = await fetch('/api/stripe/create-payment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: quoteReview.total, bookingId: quoteReview.id, customerEmail: customerEmail || undefined, description: `Torqued quote ${quoteReview.id}` }),
      });
      const session = await res.json();
      if (session?.url) { window.location.href = session.url; return; }
      localStorage.removeItem('pending_quote_payment');
      setQuotePaying(false);
    } catch { localStorage.removeItem('pending_quote_payment'); setQuotePaying(false); }
  };

  // Verify a returning customer with a passkey. Magic link remains the fallback.
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [passkeyCardState, setPasskeyCardState] = useState<'idle' | 'adding' | 'added' | 'error'>('idle');
  const verifyWithPasskey = async (plate: string) => {
    setPasskeyError(null);
    setMagicVerifying(true);
    try {
      const r = await authPasskey('customer', plate);
      if (r.email) setCustomerEmail(r.email);
      if (r.ownerId) setCustomerOwnerId(r.ownerId);
      if (Array.isArray(r.vehicles) && r.vehicles.length) {
        setGarageVehicles(r.vehicles.map((v: any) => ({ id: v.rego, rego: v.rego, make: v.make, model: v.model, year: v.year, variant: v.variant ?? undefined, mileage: v.mileage ?? 0, thumbnail: v.thumbnail ?? undefined })));
      }
      setRego((r.rego || plate));
      persistCustomerSession({ ownerId: r.ownerId ?? null, email: r.email ?? '', rego: r.rego || plate, vehicles: r.vehicles ?? [] });
      setMagicSentTo(null);
      setView('dashboard');
      await loadVehicleByRego(r.rego || plate);
    } catch (e: any) {
      setPasskeyError(e?.message?.toLowerCase().includes('passkey') ? 'No passkey on this device — use “Email me a verification code” above instead.' : (e?.message || 'Passkey sign-in failed — use the verification code instead.'));
    } finally {
      setMagicVerifying(false);
    }
  };

  // First booking → offer to create a passkey for faster future logins
  const [pkPrompted, setPkPrompted] = useState(false);
  useEffect(() => {
    if (step !== 7) return;
    const plate = (rego || vehicle?.rego || '').toUpperCase();
    if (!plate) return;
    // Booking + payment proves ownership → grant a 48h garage session
    if (!garageUnlocked) {
      persistCustomerSession({ ownerId: customerOwnerId, email: customerEmail, rego: plate, vehicles: garageVehicles });
    }
    if (pkPrompted || !passkeysSupported()) return;
    setPkPrompted(true);
    const t = setTimeout(async () => {
      try {
        if (await hasPasskey('customer', customerEmail || plate)) return; // already has one
        if (window.confirm('Booking confirmed! 🎉\n\nWant faster access next time? Create a passkey to sign in with passkey — no email link needed.')) {
          await registerPasskey('customer', customerEmail || plate);
          window.alert('Passkey created. Next time you enter your plate, just tap "Verify with passkey".');
        }
      } catch { /* cancelled — magic link still works */ }
    }, 1200);
    return () => clearTimeout(t);
  }, [step, pkPrompted, rego, vehicle]);

  // Review flow (opened from the review link in the completion email)
  const [reviewCtx, setReviewCtx] = useState<{ bookingId: string; mechanicId: string } | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewDone, setReviewDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rb = params.get('review_booking');
    const m = params.get('m');
    if (rb && m) {
      setReviewCtx({ bookingId: rb, mechanicId: m });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Service-history grant link: ?grant_history=<token>
  const [grantHistoryMode] = useState(() => !!new URLSearchParams(window.location.search).get('grant_history'));
  const [grantState, setGrantState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('grant_history');
    if (!token) return;
    window.history.replaceState({}, document.title, window.location.pathname);
    setGrantState('loading');
    fetch('/api/history/grant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      .then(r => r.json()).then(d => setGrantState(d.success ? 'done' : 'error')).catch(() => setGrantState('error'));
  }, []);

  // Handle reschedule accept links: ?reschedule_accept=<bookingId>&proposed=<datetime>
  // Captured before the query string is stripped so the standalone page can render.
  const [rescheduleMode] = useState(() => !!new URLSearchParams(window.location.search).get('reschedule_accept'));
  const [rescheduleAcceptState, setRescheduleAcceptState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [rescheduleAcceptDate, setRescheduleAcceptDate] = useState('');
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bookingId = params.get('reschedule_accept');
    const proposed = params.get('proposed');
    if (!bookingId || !proposed) return;
    window.history.replaceState({}, document.title, window.location.pathname);
    setRescheduleAcceptState('loading');
    fetch('/api/mechanic/accept-reschedule', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, proposedDate: proposed }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) { setRescheduleAcceptDate(d.dateStr || proposed); setRescheduleAcceptState('done'); }
        else setRescheduleAcceptState('error');
      })
      .catch(() => setRescheduleAcceptState('error'));
  }, []);
  const [isBookingLoading, setIsBookingLoading] = useState(false);

  // New state to tracking the last booked job for dynamic Step 7 messaging
  const [latestBooking, setLatestBooking] = useState<Job | null>(null);

  // Promo Code and Email confirmation states
  
  const [emittedEmailHtml, setEmittedEmailHtml] = useState<string | null>(null);
  const [emittedMechanicHtml, setEmittedMechanicHtml] = useState<string | null>(null);
  const [emittedDropoffHtml, setEmittedDropoffHtml] = useState<string | null>(null);
  const [emittedServiceReminderHtml, setEmittedServiceReminderHtml] = useState<string | null>(null);
  const [emittedSmsText, setEmittedSmsText] = useState<string | null>(null);

  const [showEmailModal, setShowEmailModal] = useState(false);

  // Email Sandbox UI states
  const [selectedEmailTab, setSelectedEmailTab] = useState<'customer' | 'mechanic' | 'dropoff' | 'service' | 'sms'>('customer');
  const [testEmailAddress, setTestEmailAddress] = useState('sri.140nz@gmail.com');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testSendStatus, setTestSendStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [testSendStatusMsg, setTestSendStatusMsg] = useState('');

  const triggerEmailConfirmation = async (job: any) => {
    try {
      const mechanic = realMechanics.find(m => m.id === (job.mechanicId || selectedMechanic?.id)) || selectedMechanic || null;
      const serviceNames = job.serviceIds.map((id: string) => SERVICES.find(s => s.id === id)?.name || id);
      const rawDate = job.date || selectedDate || '';
      let formattedDate = rawDate;
      if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) formattedDate = d.toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      }
      const custName = userProfile?.name || userName || (job.email || userProfile?.email || user?.email || '').split('@')[0] || '';

      // A booking is a quote request (not a paid booking) when every service on it
      // has no instant price — the mechanic must send a manual quote within 1
      // business hour, so the emails must NOT say "payment confirmed".
      const isQuoteRequest = Array.isArray(job.serviceIds) && job.serviceIds.length > 0
        && job.serviceIds.every((id: string) => isQuoteJob(id));

      const payload = {
        email: job.email || userProfile?.email || user?.email || customerEmail || 'customer@torqued.nz',
        customerName: custName,
        bookingId: job.id,
        date: formattedDate,
        time: selectedTime || '09:00 AM',
        readyTime: estimatedReadyTime || '04:30 PM',
        vehicle: vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : '',
        plate: vehicle?.plate || vehicle?.rego || '',
        mechanicName: mechanic?.name || 'Your Workshop',
        mechanicAddress: mechanic?.address || '',
        mechanicId: mechanic?.id || job.mechanicId || '',
        paymentMethod: job.paymentMethod || 'Credit / Debit',
        services: serviceNames,
        price: job.totalPrice,
        paymentOption: paymentOption,
        depositPaid: job.depositPaid,
        isQuoteRequest,
      };

      const res = await fetch('/api/email/confirm-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const result = await res.json();
        if (result.html) setEmittedEmailHtml(result.html);
        if (result.mechanicHtml) setEmittedMechanicHtml(result.mechanicHtml);
        if (result.dropoffHtml) setEmittedDropoffHtml(result.dropoffHtml);
        if (result.serviceReminderHtml) setEmittedServiceReminderHtml(result.serviceReminderHtml);
        if (result.smsText) setEmittedSmsText(result.smsText);
      }
    } catch (err) {
      console.error('Trigger confirmation mail error:', err);
    }
  };

  const handleSendTestSingle = async () => {
    if (!testEmailAddress) {
      setTestSendStatus('failed');
      setTestSendStatusMsg('Recipient email is required.');
      return;
    }
    
    setIsSendingTest(true);
    setTestSendStatus('idle');
    setTestSendStatusMsg('');
    
    try {
      const servicesArray = latestBooking 
        ? latestBooking.serviceIds.map(id => SERVICES.find(s => s.id === id)?.name || id)
        : selectedServices.map(id => SERVICES.find(s => s.id === id)?.name || id);

      const payload = {
        recipient: testEmailAddress,
        templateType: selectedEmailTab,
        bookingData: {
          customerName: userProfile?.name || userName || '',
          bookingId: latestBooking?.id || '',
          date: latestBooking?.date || selectedDate,
          time: selectedTime || '09:00 AM',
          readyTime: estimatedReadyTime || '04:30 PM',
          vehicle: vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : '',
          plate: vehicle?.rego || '',
          mechanicName: selectedMechanic?.name || 'your selected mechanic',
          mechanicAddress: selectedMechanic?.address || 'your mechanics address',
          paymentMethod: latestBooking?.paymentMethod || paymentMethod || 'Credit / Debit',
          services: servicesArray.length > 0 ? servicesArray : ['Full Dual-Clutch Transmission (DCT) Service & Calibration'],
          price: latestBooking?.totalPrice || 349.00,
          paymentOption: paymentOption,
          depositPaid: latestBooking?.depositPaid || 0,
  
  
        }
      };

      const res = await fetch('/api/email/send-test-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const result = await res.json();
        if (result.sentRealEmail) {
          setTestSendStatus('success');
          setTestSendStatusMsg(`Successfully dispatched LIVE SMTP email directly to ${testEmailAddress}! Check your inbox!`);
        } else if (result.smtpError) {
          setTestSendStatus('failed');
          setTestSendStatusMsg(`SMTP CONFIG ERROR: Direct dispatch failed. The mail server responded: "${result.smtpError}". Please verify host port, TLS protocol, and authentication logins.`);
        } else {
          setTestSendStatus('success');
          setTestSendStatusMsg(`SIMULATED: Fallback log printed in terminal! SMTP credentials not configured yet, but template generated successfully!`);
        }
      } else {
        const errJson = await res.json();
        setTestSendStatus('failed');
        setTestSendStatusMsg(errJson.error || 'Failed to dispatch test email.');
      }
    } catch (e) {
      console.error(e);
      setTestSendStatus('failed');
      setTestSendStatusMsg(e instanceof Error ? e.message : 'Failed to connect to backend server endpoint.');
    } finally {
      setIsSendingTest(false);
    }
  };

  // Automatically fetch rendered email templates when the email sandbox modal is loaded
  useEffect(() => {
    if (showEmailModal && latestBooking) {
      triggerEmailConfirmation(latestBooking);
    }
  }, [showEmailModal, latestBooking]);

  // Custom Embedded Stripe states

  const filteredProviders: string[] = [];

  // Suggest jobs based on mileage and vehicle type
  useEffect(() => {
    const km = parseInt(mileage);
    if (!km) return;

    const suggestions: string[] = [];
    const isEV = vehicle?.make === 'Tesla';

    if (km > 90000 && km < 120000 && !isEV) {
      suggestions.push('timing'); // Cambelt due
      suggestions.push('transmission'); // DCT service
    }

    if (km > 200000 && vehicle?.make === 'Toyota') {
      suggestions.push('full'); // Major service
      suggestions.push('battery'); // Old car battery
    }
    
    if (isEV) {
      if (km > 100000) {
        suggestions.push('cabin_filter');
        suggestions.push('brake_fluid');
      }
    } else {
      if (km % 10000 < 1000) {
        suggestions.push('oil');
      }
    }

    setSuggestedJobs(suggestions);
  }, [mileage, vehicle]);

  // Listen for Stripe sessions and handle verification login defaults
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const bookingId = params.get('booking_id');
    if (sessionId && bookingId) {
      const initPaymentVerification = async () => {
        // A mechanic-built quote paid via payQuote() — restore the quote confirmation
        // screen (same UI the customer saw before checkout) instead of silently
        // refreshing bookings in the background with no visible confirmation.
        const savedQuotePayment = localStorage.getItem('pending_quote_payment');
        let quoteDraft: any = null;
        try { quoteDraft = savedQuotePayment ? JSON.parse(savedQuotePayment) : null; } catch { quoteDraft = null; }
        if (quoteDraft && quoteDraft.id === bookingId) {
          try { await fetch(`/api/stripe/verify-session?session_id=${sessionId}`); } catch {}
          localStorage.removeItem('pending_quote_payment');
          window.history.replaceState({}, document.title, window.location.pathname);
          setQuoteReview({ ...quoteDraft, paymentStatus: 'confirmed' });
          setQuoteOnlyMode(true);
          await loadCustomerBookings();
          return;
        }

        const savedPending = localStorage.getItem('pending_booking');
        let pendingDraft: any = null;
        try { pendingDraft = savedPending ? JSON.parse(savedPending) : null; } catch { pendingDraft = null; }
        // Only treat this as a standard-flow confirmation if the saved draft is for THIS
        // booking. Otherwise it's a repair/quote payment (or a stale draft) — never show
        // another job's summary. This was causing the wrong "Diagnostic + Spark Plugs"
        // confirmation + emails for unrelated payments.
        if (!pendingDraft || pendingDraft.id !== bookingId) {
          try { await fetch(`/api/stripe/verify-session?session_id=${sessionId}`); } catch {}
          localStorage.removeItem('pending_booking'); // clear any stale draft
          window.history.replaceState({}, document.title, window.location.pathname);
          await loadCustomerBookings();
          setJobsView('active');
          return;
        }
        if (savedPending) {
          try {
            const booking = JSON.parse(savedPending);
            
            // Retrieve customer details from Stripe checkout session
            let customerEmailStr = '';
            let customerNameStr = '';
            let customerPhoneStr = '';
            try {
              const res = await fetch(`/api/stripe/verify-session?session_id=${sessionId}`);
              if (res.ok) {
                const data = await res.json();
                if (data.status === 'succeeded') {
                  if (data.email) customerEmailStr = data.email;
                  if (data.name) customerNameStr = data.name;
                  if (data.phone) customerPhoneStr = data.phone;
                }
              }
            } catch (err) {
              console.error('Verify session api call failed:', err);
            }

            booking.paymentStatus = 'confirmed';
            booking.status = 'booked';
            if (customerEmailStr) booking.email = customerEmailStr;
            if (customerNameStr) booking.customerName = customerNameStr;
            if (customerPhoneStr) booking.phone = customerPhoneStr;
            
            // Update profiling with collected details
            if (updateProfile) {
              updateProfile({ 
                email: customerEmailStr || undefined,
                name: customerNameStr || undefined,
                phone: customerPhoneStr || undefined
              });
            }
            
            setActiveJobs(prev => [...prev, booking]);
            setLatestBooking(booking);
            localStorage.removeItem('pending_booking'); // consumed — never reuse for another payment
            setStep(7); // Jump straight to confirmed step!
            setView('quote');
            
            // Trigger confirmation email
            await triggerEmailConfirmation(booking);
            
            // Clear URL query parameters for a clean experience
            window.history.replaceState({}, document.title, window.location.pathname);
          } catch (err) {
            console.error('Stripe response processing failure:', err);
          }
        }
      };
      
      initPaymentVerification();
    }
  }, []);

  // Update details when auth profiles stream
  useEffect(() => {
    if (userProfile) {
      setUserName(userProfile.name);
      if (userProfile.homeLocation) {
        setLocation(userProfile.homeLocation);
      }
    }
  }, [userProfile]);

  // For OTP-verified customers (no Supabase auth session), load profile name/location from server
  useEffect(() => {
    if (userProfile || !customerOwnerId) return;
    fetch(`/api/customer/profile?ownerId=${encodeURIComponent(customerOwnerId)}`)
      .then(r => r.json())
      .then(d => {
        if (d.name) setUserName(d.name);
        if (d.homeLocation) setLocation(d.homeLocation);
      })
      .catch(() => {});
  }, [customerOwnerId, userProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load persisted bookings from Supabase when user is available
  useEffect(() => {
    if (!user) return;
    supabase
      .from('bookings')
      .select('*')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) { console.error('Failed to load bookings:', error.message); return; }
        if (!data || data.length === 0) return;
        const loaded: Job[] = data.map((row: any) => ({
          id: row.id,
          vehicleId: row.vehicle_rego || '',
          serviceIds: row.service_ids || [],
          mechanicId: row.mechanic_id,
          status: row.status,
          paymentStatus: row.payment_status,
          paymentMethod: row.payment_method || '',
          date: row.date || '',
          totalPrice: parseFloat(row.total_price) || 0,
          depositPaid: row.deposit_paid != null ? parseFloat(row.deposit_paid) : undefined,
          customerName: row.customer_name || undefined,
          email: row.email || undefined,
          phone: row.phone || undefined,
        }));
        // Merge: DB is source of truth; keep any in-memory bookings not yet written to DB
        setActiveJobs(prev => {
          const dbIds = new Set(loaded.map(j => j.id));
          const localOnly = prev.filter(j => !dbIds.has(j.id));
          return [...loaded, ...localOnly];
        });
      });
  }, [user]);

  // OTP resend cooldown ticker
  useEffect(() => {
    if (otpResendCooldown <= 0) return;
    const t = setInterval(() => setOtpResendCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [otpResendCooldown]);

  // Dynamic display name for a service — timing name depends on vehicle's drive type.
  const serviceDisplayName = (id: string, fallback: string) => {
    if (id === 'timing') {
      if (vehicleTimingDrive === 'belt') return 'Cambelt';
      if (vehicleTimingDrive === 'chain') return 'Timing Chain';
      if (vehicleTimingDrive === 'na') return 'Timing Service';
      return fallback;
    }
    if (id === 'water_pump') return 'Water Pump & Thermostat Housing';
    if (id === 'thermostat_housing') return 'Thermostat Housing (with Water Pump)';
    return fallback;
  };

  // Price for a service on the ACTIVE vehicle: use the vehicle's real DB pricing
  // (vehicle_specs.service_prices) when available, else fall back to the generic base.
  const priceFor = (id: string) => {
    const v = vehiclePrices[id];
    if (typeof v === 'number' && v > 0) return v;
    return SERVICES.find(s => s.id === id)?.basePrice || 0;
  };

  // Have the real per-vehicle prices arrived from /api/fleet-prices yet?
  const fleetPricesLoaded = Object.keys(fleetPricesRaw).length > 0;
  // A service that is offered but has no real instant price. We never invent a
  // number — these route to a precise quote the workshop returns within 1
  // business hour. (e.g. timing chain, water pump, unknown-fluid transmission.)
  const isQuoteJob = (id: string) =>
    fleetPricesLoaded && !fleetPricesRaw[id] && !(SERVICES.find(s => s.id === id)?.basePrice);
  // Services currently selected that will be sent as a precise-quote request.
  const selectedQuoteJobs = selectedServices.filter(id => id !== 'thermostat_housing' && isQuoteJob(id));

  // Calculate total price based on selected services (per-vehicle pricing)
  const totalPrice = useMemo(() => {
    let t = selectedServices.reduce((sum, id) => sum + priceFor(id), 0);
    if (addWaterPump && waterPump && (selectedServices.includes('timing') || selectedServices.includes('timing_chain_full'))) {
      t += waterPump.high;
    }
    // Workshop fee applies to every job EXCEPT a standalone $99 diagnostic inspection.
    const isDiagOnly = selectedServices.length === 1 && selectedServices[0] === 'diag_inspection';
    if (t > 0 && !isDiagOnly && fleetShopFee) {
      t += fleetShopFee;
    }
    return t;
  }, [selectedServices, vehiclePrices, addWaterPump, waterPump, fleetShopFee]);

  const handleConfirmOTP = async () => {
    if (otpCode.trim().length !== 6) {
      setOtpVerificationError('Verification code must be exactly 6 digits.');
      return;
    }
    const formattedRego = rego.toUpperCase().trim();

    // Verify OTP server-side before unlocking vehicle data
    try {
      const verifyRes = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rego: formattedRego, code: otpCode.trim() }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyData.success) {
        setOtpVerificationError(verifyData.error || 'Invalid or expired code. Please try again.');
        return;
      }
      const verifiedEmail = verifyData.email || customerEmail || '';
      const verifiedOwnerId = verifyData.ownerId || customerOwnerId || null;
      let verifiedVehicles = garageVehicles;
      if (verifyData.email) setCustomerEmail(verifyData.email);
      if (verifyData.ownerId) setCustomerOwnerId(verifyData.ownerId);
      if (Array.isArray(verifyData.vehicles) && verifyData.vehicles.length) {
        verifiedVehicles = verifyData.vehicles.map((r: any) => ({
          id: r.rego, rego: r.rego, make: r.make, model: r.model,
          year: r.year, variant: r.variant ?? undefined, mileage: r.mileage ?? 0,
          thumbnail: r.thumbnail ?? undefined,
        }));
        setGarageVehicles(verifiedVehicles);
      }
      // Unlock the garage: this sets customerVerifiedAt (→ garageUnlocked) and a 48h
      // session. Without it the gate just re-renders and the user "goes back a step".
      persistCustomerSession({ ownerId: verifiedOwnerId, email: verifiedEmail, rego: formattedRego, vehicles: verifiedVehicles });
    } catch {
      setOtpVerificationError('Verification failed. Please try again.');
      return;
    }

    // No setView here: the garage gate lives under view==='dashboard' (so the user is
    // already there), while the booking flow uses view==='quote' and must stay put.
    // persistCustomerSession above flips garageUnlocked, which re-renders the garage.
    setShowOTPModal(false);
    setOtpCode('');
    setOtpVerificationError('');
    await loadVehicleByRego(formattedRego);
  };

  // Parses DD/MM/YYYY, ISO, and other common date formats → ms timestamp (0 if unparseable)
  const parseServiceDate = (dateStr: string): number => {
    if (!dateStr) return 0;
    // DD/MM/YYYY
    const ddmm = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmm) return new Date(`${ddmm[3]}-${ddmm[2].padStart(2,'0')}-${ddmm[1].padStart(2,'0')}`).getTime() || 0;
    return new Date(dateStr).getTime() || 0;
  };

  const loadVehicleByRego = async (rego: string) => {
    setManualHistory([]);
    try {
      const res = await fetch(`/api/vehicles/${rego}`);
      if (!res.ok) throw new Error('Vehicle not found');
      const data = await res.json();
      const v: Vehicle = {
        id: data.rego,
        rego: data.rego,
        make: data.make,
        model: data.model,
        year: data.year,
        variant: data.variant ?? undefined,
        mileage: data.mileage ?? 0,
        thumbnail: data.thumbnail ?? undefined,
      };
      setVehicle(v);
      setMileage((data.mileage ?? 0).toString());
      setVehicleModelSpec(null);
      setVehicleModelOptions([]);
      setShowSubmodelPicker(false);
      // Look up engine/gearbox spec from vehicle_models DB
      if (data.make && data.model && data.year) {
        fetch(`/api/vehicles/lookup?make=${encodeURIComponent(data.make)}&model=${encodeURIComponent(data.model)}&year=${encodeURIComponent(data.year)}`)
          .then(r => r.ok ? r.json() : null)
          .then((d: any) => {
            const results = d?.results ?? [];
            // Always keep the full candidate list, even when exactly one matched and
            // got auto-selected — otherwise clicking "change" later has nothing to
            // show (vehicleModelOptions stayed empty), and a single coarse match
            // (e.g. only a performance "R" trim on file for that year) gets silently
            // locked in with no way to correct it to the actual variant.
            setVehicleModelOptions(results);
            if (results.length === 1) {
              setVehicleModelSpec(results[0]);
            } else if (results.length > 1) {
              setShowSubmodelPicker(true);
            }
          }).catch(() => {});
      }

      setUserName(userProfile?.name || null);
      // Per-vehicle service pricing and oil specs from the DB
      const specs = Array.isArray(data.vehicle_specs) ? data.vehicle_specs[0] : data.vehicle_specs;
      // Start with any legacy vehicle_specs.service_prices, then overlay fleet DB midpoints
      const legacyPrices: Record<string, number> = specs?.service_prices || {};
      setVehiclePrices(legacyPrices);
      setVehicleOilCapacity(specs?.oil_capacity_litres ?? null);
      setVehicleOilType(specs?.oil_type ?? null);
      // Fetch fleet prices in background and overlay onto vehiclePrices so the
      // Step 2 tally and Step 4 mechanic list reflect real parts_data midpoints.
      fetch(`/api/fleet-prices?rego=${encodeURIComponent(rego)}`)
        .then(r => r.json())
        .then((fp: any) => {
          if (fp?.vehicleId) setFleetVehicleId(fp.vehicleId);
          if (fp?.timingDrive) setVehicleTimingDrive(fp.timingDrive as 'belt' | 'chain' | 'na');
          setWaterPumpRecommended(!!fp?.waterPumpRecommended);
          setWaterPump(fp?.waterPump ?? null);
          setTimingIntervalKm(fp?.timingIntervalKm ?? null);
          setAddWaterPump(false);
          if (fp?.shopFee) setFleetShopFee(fp.shopFee);
          if (fp?.prices && Object.keys(fp.prices).length > 0) {
            const fleetHighs: Record<string, number> = {};
            for (const [svcId, p] of Object.entries(fp.prices as Record<string, any>)) {
              fleetHighs[svcId] = p.high;
            }
            setVehiclePrices({ ...legacyPrices, ...fleetHighs });
            setFleetPricesRaw(fp.prices);
            if (fp?.waterPumpInDB !== undefined) setWaterPumpInDB(!!fp.waterPumpInDB);
            if (fp?.differentialInDB !== undefined) setDifferentialInDB(!!fp.differentialInDB);
            if (fp?.differentialApplicable !== undefined) setDifferentialApplicable(!!fp.differentialApplicable);
          }
        })
        .catch(() => {/* fleet prices are best-effort */});
      // Load any saved/imported service history for this vehicle
      if (Array.isArray(data.history) && data.history.length) {
        setManualHistory(data.history.map((h: any) => ({
          id: h.id || undefined,
          date: h.service_date || '', service: h.work_done || '', provider: h.provider || '',
          mileage: h.mileage != null ? String(h.mileage) : '', price: h.price || '', notes: h.notes || '',
          source_type: h.source_type || 'customer_manual',
          ai_summary: h.ai_summary || null,
        })));
      }
      // Ensure this car is in the garage list + auto-save to account if logged in
      setGarageVehicles(prev => prev.some(g => g.rego === v.rego) ? prev : [...prev, v]);
      if (customerOwnerId) {
        fetch('/api/customer/add-vehicle', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ownerId: customerOwnerId, rego: v.rego, make: v.make, model: v.model, year: v.year, variant: v.variant }),
        }).catch(() => {});
      } else if (user) {
        try { await registerVehicle(v); } catch {}
      }
    } catch {
      // Fallback if API unavailable
      setVehicle({ id: rego, rego, make: 'Unknown', model: 'Vehicle', year: 2020, mileage: 0 });
      setMileage('0');
    }
  };

  // ── Fleet quote lookup (vehicle_models + parts_data) ──────────────────────

  // Maps SERVICES ids to part_categories slugs in migration 018.
  const SERVICE_TO_CATEGORY_SLUG: Record<string, string> = {
    oil: 'oil_filter',
    timing: 'cambelt',
    timing_chain_full: 'timing_chain_replacement',
    brakes_front_pads: 'front_brake_pads',
    brakes_front_rotors: 'front_rotors',
    brakes_rear_pads: 'rear_brake_pads',
    brakes_rear_rotors: 'rear_rotors',
    battery: 'battery_12v',
    spark_plugs: 'ignition_coils',
    cabin_filter: 'cabin_air_filter',
    transmission: 'transmission_filter',
  };

  const lookupFleetQuote = async () => {
    setFleetQuoteState('loading');
    setFleetQuoteRange(null);
    setQuoteFallbackCategoryId(null);
    try {
      const make = vehicle?.make ?? '';
      const model = vehicle?.model ?? '';
      if (!make || !model) { setFleetQuoteState(null); return; }
      setCarjamVehicle({
        make, model, year: vehicle?.year ?? 0,
        variant: vehicle?.variant ?? '', rawMake: make,
        vin: null, engineCc: null, transmissionType: null, fuelType: null,
        stolenFlag: false, latestOdometer: null, power: null,
      });

      // Sum all selected services' pre-computed low/high from fleet-prices.
      // Thermostat housing is bundled inside water_pump so exclude it when both are selected.
      const pricedServices = selectedServices
        .filter(id => !(id === 'thermostat_housing' && selectedServices.includes('water_pump')))
        .filter(id => fleetPricesRaw[id]);
      if (pricedServices.length > 0) {
        const shopFeeAmt = fleetShopFee || 0;
        const totalLow  = pricedServices.reduce((s, id) => s + (fleetPricesRaw[id].low  || 0), 0) + shopFeeAmt;
        const totalHigh = pricedServices.reduce((s, id) => s + (fleetPricesRaw[id].high || 0), 0) + shopFeeAmt;
        setFleetQuoteRange({ low: totalLow, high: totalHigh });
        setFleetQuoteState('instant');
        return;
      }

      // Fallback: no pre-computed price — use segment average
      const matchedId = fleetVehicleId;
      const firstSlug = selectedServices.map(id => SERVICE_TO_CATEGORY_SLUG[id]).find(Boolean);
      const vmData = matchedId
        ? ((await supabase.from('vehicle_models').select('body_type, fuel').eq('id', matchedId).single()).data as { body_type?: string; fuel?: string } | null)
        : null;
      if (firstSlug) {
        const { data: cat } = await supabase.from('part_categories').select('id').eq('slug', firstSlug).single();
        if (cat) setQuoteFallbackCategoryId((cat as any).id);
        await _resolveSegmentFallback(matchedId, vmData, { make, model, year: vehicle?.year ?? 0, bodyType: '', fuel: '' }, cat ? (cat as any).id : null, firstSlug);
      } else {
        await _resolveSegmentFallback(matchedId, vmData, { make, model, year: vehicle?.year ?? 0, bodyType: '', fuel: '' }, null);
      }
    } catch {
      setFleetQuoteState(null);
    }
  };

  const SERVICE_INDICATIVE_RANGES: Record<string, [number, number]> = {
    ignition_coils: [220, 480], spark_plugs: [200, 420],
    cabin_air_filter: [80, 180], battery_12v: [220, 450],
    front_brake_pads: [250, 500], rear_brake_pads: [220, 450],
    front_rotors: [300, 600], rear_rotors: [280, 550],
    transmission_filter: [350, 900], cambelt: [500, 1400],
    oil_filter: [90, 200], wheel_bearings: [280, 550],
  };

  const _resolveSegmentFallback = async (
    matchedVehicleId: string | null,
    vmData: { body_type?: string; fuel?: string } | null,
    carjam: { make: string; model: string; year: number; bodyType: string; fuel: string },
    catId: number | null,
    slug?: string,
  ) => {
    let rangeLow = 150;
    let rangeHigh = 2500;
    try {
      if (catId !== null) {
        const bodyType = vmData?.body_type ?? carjam.bodyType;
        const fuel = vmData?.fuel ?? carjam.fuel;
        const { data: segVehicles } = await supabase
          .from('vehicle_models').select('id').eq('body_type', bodyType).eq('fuel', fuel);
        const ids = (segVehicles ?? []).map((v: any) => v.id);
        if (ids.length > 0) {
          const { data: prices } = await supabase
            .from('parts_data').select('part_cost_low, part_cost_high')
            .in('vehicle_id', ids).eq('category_id', catId);
          if (prices && prices.length > 0) {
            const avgL = prices.reduce((s: number, r: any) => s + Number(r.part_cost_low), 0) / prices.length;
            const avgH = prices.reduce((s: number, r: any) => s + Number(r.part_cost_high), 0) / prices.length;
            rangeLow = Math.round(avgL / 50) * 50 || 150;
            rangeHigh = Math.round(avgH / 50) * 50 || 2500;
          }
        }
      }
    } catch {}
    // If DB found nothing, use service-specific indicative range instead of 150/2500
    if (rangeLow === 150 && rangeHigh === 2500 && slug && SERVICE_INDICATIVE_RANGES[slug]) {
      [rangeLow, rangeHigh] = SERVICE_INDICATIVE_RANGES[slug];
    }
    setFleetQuoteRange({ low: rangeLow, high: rangeHigh });
    setFleetQuoteState('fallback');

    // Insert quote_requests row + call edge function stub
    try {
      const { data: row } = await supabase
        .from('quote_requests')
        .insert({
          vehicle_id: matchedVehicleId,
          carjam_plate: rego.toUpperCase(),
          carjam_make: carjam.make,
          carjam_model: carjam.model,
          carjam_year: carjam.year,
          category_id: catId,
          customer_email: customerEmail || 'unknown@pending.nz',
          customer_name: userName || returningCustomerName || null,
          range_low: rangeLow,
          range_high: rangeHigh,
        })
        .select('id')
        .single();
      if (row?.id) {
        supabase.functions.invoke('handle_manual_quote_request', {
          body: { quoteRequestId: row.id, plate: rego, make: carjam.make, model: carjam.model, rangeLow, rangeHigh },
        }).catch(() => {});
      }
    } catch {}
  };

  // Switch the active vehicle in the garage (loads its specs/pricing + history)
  const selectGarageVehicle = async (rego: string) => {
    await loadVehicleByRego(rego);
    // stays in garage view — service history loads below the vehicle cards
  };

  // ── Active-job cancellation + reschedule (uses the shared backend policy/refund engine) ──
  const [jobDetail, setJobDetail] = useState<Record<string, any>>({});   // bookingId → detail
  const [jobBusy, setJobBusy] = useState<string | null>(null);
  // Repair-quote acceptance: pick a real drop-off date from the workshop's schedule, then pay.
  const [repairAccept, setRepairAccept] = useState<{ job: any; amount: number } | null>(null);
  const [repairDates, setRepairDates] = useState<{ date: string; day: string; label: string }[]>([]);
  const [repairDatesLoading, setRepairDatesLoading] = useState(false);
  const [repairSelectedDate, setRepairSelectedDate] = useState('');
  const [repairDropTime, setRepairDropTime] = useState('09:00');
  const [repairBusy, setRepairBusy] = useState(false);

  // Estimated collection. Turnaround = 2× the job's labour hours (e.g. a 2-hour job
  // dropped at 9am is ready ~1pm). The mechanic can adjust the ETA later.
  const repairReadyEstimate = (job: any, dropTime: string): string => {
    const qi = (job as any)?.quoteItems || jobDetail[job?.id]?.quoteItems;
    const labour = Number(qi?.labourHours) || 1;
    const turnaround = Math.ceil(labour * 2);
    const [h] = dropTime.split(':').map(Number);
    let readyHour = h + turnaround;
    if (turnaround >= 8 || readyHour >= 17) return 'Ready next business day — collect any time';
    const ampm = readyHour >= 12 ? 'PM' : 'AM';
    if (readyHour > 12) readyHour -= 12;
    return `Estimated ready ~${readyHour}:00 ${ampm} (mechanic confirms the final ETA)`;
  };

  const openRepairAccept = async (job: any, amount: number) => {
    setRepairAccept({ job, amount });
    setRepairDates([]); setRepairSelectedDate(''); setRepairDropTime('09:00'); setRepairDatesLoading(true);
    try {
      const qi = (job as any).quoteItems;
      const leadDays = (qi?.leadTimeDays != null && qi.leadTimeDays > 0) ? qi.leadTimeDays : null;
      const params = new URLSearchParams({ mechanicId: job.mechanicId, needsParts: '1', count: '3' });
      if (leadDays !== null) params.set('leadDays', String(leadDays));
      const r = await fetch(`/api/mechanic/next-available?${params}`);
      const d = await r.json();
      const dates = Array.isArray(d.dates) ? d.dates : [];
      setRepairDates(dates);
      if (dates[0]?.date) setRepairSelectedDate(dates[0].date);
    } catch { setRepairDates([]); }
    finally { setRepairDatesLoading(false); }
  };

  const confirmRepairAccept = async () => {
    if (!repairAccept) return;
    const { job, amount } = repairAccept;
    if (!amount) return;
    setRepairBusy(true);
    try {
      // Persist the chosen drop-off date (default 9am) before sending them to checkout.
      if (repairSelectedDate) {
        await fetch('/api/customer/reschedule', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId: job.id, date: `${repairSelectedDate}T${repairDropTime}` }),
        }).catch(() => {});
      }
      const res = await fetch('/api/stripe/create-payment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, bookingId: job.id, customerEmail: customerEmail || user?.email, description: `Torqued repair quote ${job.id}` }),
      });
      const session = await res.json();
      if (session?.url) { window.location.href = session.url; return; }
      alert('Could not open checkout. Please try again.');
    } catch { alert('Could not open checkout.'); }
    finally { setRepairBusy(false); }
  };
  // Pre-Purchase Inspection booking ($199 flat, PPI-offering workshops only)
  const [ppiOpen, setPpiOpen] = useState(false);
  const [ppiRego, setPpiRego] = useState('');
  const [ppiMechId, setPpiMechId] = useState('');
  const [ppiBusy, setPpiBusy] = useState(false);
  const ppiWorkshops = realMechanics.filter(m => (m as any).offersPpi);
  const bookPPI = async () => {
    const mech = realMechanics.find(m => m.id === ppiMechId);
    if (!ppiRego.trim() || !mech) return;
    setPpiBusy(true);
    try {
      const bookingId = (crypto as any).randomUUID ? crypto.randomUUID() : `ppi_${Date.now()}`;
      const res = await fetch('/api/stripe/create-payment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 199, bookingId, customerEmail: customerEmail || user?.email,
          description: 'Pre-Purchase Inspection',
          bookingData: {
            id: bookingId, mechanicId: mech.id, vehicleId: ppiRego.toUpperCase().trim(),
            serviceIds: ['ppi'], totalPrice: 199, paymentMethod: 'Card',
            customerName: userProfile?.name || undefined, email: customerEmail || user?.email || undefined,
            description: 'Pre-Purchase Inspection',
          },
        }),
      });
      const session = await res.json();
      if (session?.url) { window.location.href = session.url; return; }
      alert('Could not open checkout. Please try again.');
    } catch { alert('Could not open checkout.'); }
    finally { setPpiBusy(false); }
  };
  const [reschedJob, setReschedJob] = useState<string | null>(null);
  const [reschedDate, setReschedDate] = useState('');
  const [reschedTime, setReschedTime] = useState('09:00');
  const RESCHED_SLOTS = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00'];

  const loadJobDetail = async (job: Job) => {
    try {
      const r = await fetch(`/api/booking/${job.id}/detail`);
      const d = await r.json();
      if (r.ok) setJobDetail(prev => ({ ...prev, [job.id]: d }));
      return r.ok ? d : null;
    } catch { return null; }
  };

  const cancelJob = async (job: Job) => {
    setJobBusy(job.id);
    try {
      const d = jobDetail[job.id] || await loadJobDetail(job);
      const c = d?.cancellation;
      const policyMsg = c
        ? (c.fullRefund
            ? `You're cancelling with enough notice (policy: ${c.requiredHours}h of open time, excluding weekends/public holidays).\n\nYou'll receive a FULL refund${c.paid ? ` of $${c.refundAmount.toFixed(2)}` : ''}.`
            : `This is short notice — less than ${c.requiredHours}h of open time before drop-off.\n\nPer ${d?.mechanic?.name || 'the workshop'}'s policy you'll be refunded ${c.refundPct}%${c.paid ? ` ($${c.refundAmount.toFixed(2)})` : ''}.`)
        : 'Cancel this booking?';
      if (!window.confirm(`${policyMsg}\n\nConfirm cancellation?`)) { setJobBusy(null); return; }
      const res = await fetch('/api/customer/request-cancellation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: job.id }),
      });
      const out = await res.json();
      if (!res.ok) { alert(out.error || 'Could not cancel.'); setJobBusy(null); return; }
      setActiveJobs(prev => prev.filter(j => j.id !== job.id));
      alert(out.fullRefund ? `Cancelled — full refund issued${out.refundAmount ? ` ($${out.refundAmount.toFixed(2)})` : ''}.`
                           : `Cancelled — ${out.refundPct}% refund issued${out.refundAmount ? ` ($${out.refundAmount.toFixed(2)})` : ''}.`);
    } finally { setJobBusy(null); }
  };

  const saveReschedule = async (job: Job) => {
    if (!reschedDate) return;
    setJobBusy(job.id);
    try {
      const iso = new Date(`${reschedDate}T${reschedTime}:00`).toISOString();
      const res = await fetch('/api/customer/reschedule', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: job.id, date: iso }),
      });
      const out = await res.json();
      if (!res.ok) { alert(out.error || 'Could not reschedule.'); return; }
      setActiveJobs(prev => prev.map(j => j.id === job.id ? { ...j, date: iso } : j));
      setReschedJob(null);
    } finally { setJobBusy(null); }
  };

  // Preload booking detail (itemised quote + policy) for each active job.
  useEffect(() => {
    activeJobs.forEach(j => { if (!jobDetail[j.id]) loadJobDetail(j); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJobs]);

  // AI-summarised headlines for service-history work (OpenAI here; the iOS app uses on-device Apple AI).
  const [histSummaries, setHistSummaries] = useState<Record<string, string>>({});

  // ── Vehicle Health Overview (AI) ────────────────────────────────────────────
  const [healthInsights, setHealthInsights] = useState<HealthInsight[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);
  const [showAllInsights, setShowAllInsights] = useState(false);
  const [healthHasHistory, setHealthHasHistory] = useState(true);
  const [historyVersion, setHistoryVersion] = useState(0);

  useEffect(() => {
    if (!vehicle?.rego || !garageUnlocked) return;
    const cacheKey = `${vehicle.rego}:${historyVersion}`;
    const cached = readHealthCache(cacheKey);
    if (cached) {
      setHealthInsights(cached.insights);
      setHealthHasHistory(cached.hasHistory);
      setHealthLoading(false);
      return;
    }
    setHealthInsights([]);
    setHealthLoading(true);
    fetch('/api/ai/health-insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rego: vehicle.rego,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        mileage: vehicle.mileage,
        ownerId: customerOwnerId,
      }),
    })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d?.error); return d; })
      .then(d => {
        if (Array.isArray(d.insights)) {
          const entry = { insights: d.insights, hasHistory: d.hasHistory ?? true };
          writeHealthCache(cacheKey, entry);
          pruneHealthCache(vehicle.rego, historyVersion);
          setHealthInsights(d.insights);
          setHealthHasHistory(entry.hasHistory);
        }
      })
      .catch((err) => { console.warn('[health-insights]', err?.message); })
      .finally(() => setHealthLoading(false));
  }, [vehicle?.rego, historyVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Vehicle photos
  const [vehiclePhotos, setVehiclePhotos] = useState<{ id: string; photo_url: string; comment: string; uploaded_by: string; created_at: string }[]>([]);
  const [photoComment, setPhotoComment] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);

  useEffect(() => {
    const rego = vehicle?.rego;
    if (!rego || !garageUnlocked) return;
    fetch(`/api/vehicle-photos/${rego}`).then(r => r.json()).then(d => setVehiclePhotos(d.photos || [])).catch(() => {});
  }, [vehicle?.rego, garageUnlocked]);

  const uploadPhoto = async (file: File) => {
    const rego = vehicle?.rego;
    if (!rego || !file) return;
    setPhotoUploading(true);
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader(); reader.onload = () => res(reader.result as string); reader.onerror = rej; reader.readAsDataURL(file);
      });
      const r = await fetch('/api/vehicle-photos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rego, imageBase64: base64, comment: photoComment, uploadedBy: 'customer' }),
      });
      const d = await r.json();
      if (d.photo) { setVehiclePhotos(p => [d.photo, ...p]); setPhotoComment(''); }
    } finally { setPhotoUploading(false); }
  };

  // Load the FULL service history (imported receipts + completed Torqued jobs) for the active vehicle —
  // same source as the iOS app and mechanic side, so the web My Garage now shows it too.
  useEffect(() => {
    const rego = vehicle?.rego;
    if (!rego) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/history/${rego}`);
        const d = await r.json();
        if (cancelled || !r.ok) return;
        const imported = (d.imported || []).map((h: any) => ({
          id: h.id || undefined,
          date: h.service_date || '', service: h.work_done || 'Service', provider: h.provider || 'Customer record',
          mileage: h.mileage != null ? String(h.mileage) : '', price: h.price || '', notes: h.notes || '',
          source_type: h.source_type || 'customer_manual',
        }));
        const jobs = (d.jobs || []).filter((j: any) => j.status === 'completed').map((j: any) => ({
          id: j.id || undefined,
          date: j.completed_at || j.date || '',
          // Describe the work: standard services, else summarise the quote items.
          service: (j.service_ids || []).map((id: string) => SERVICES.find(s => s.id === id)?.name || id).join(', ')
            || (j.quote_items ? summariseQuote(j.quote_items, false) : 'Torqued service'),
          provider: j.mechanic_name || 'Torqued workshop',
          mileage: j.mileage_out != null ? String(j.mileage_out) : '',
          price: j.total_price != null ? String(j.total_price) : '',
          notes: '',
          source_type: 'torqued_job',
        }));
        // Newest first, by service/completed date.
        const merged = [...imported, ...jobs].sort((a, b) => {
          const ta = new Date(a.date).getTime() || 0;
          const tb = new Date(b.date).getTime() || 0;
          return tb - ta;
        });
        if (merged.length) setManualHistory(merged);
      } catch {}
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle?.rego]);

  // Summarise long work descriptions into a short 5-word headline, cached in vehicle_history.ai_summary.
  useEffect(() => {
    // Pre-populate from DB-saved summaries first (zero API calls for already-summarised entries)
    const preloaded: Record<string, string> = {};
    manualHistory.forEach(h => { if (h.ai_summary && h.service) preloaded[h.service] = h.ai_summary; });
    if (Object.keys(preloaded).length > 0) setHistSummaries(prev => ({ ...preloaded, ...prev }));

    // Only call AI for long entries without a saved summary
    manualHistory.forEach(async (h) => {
      const key = h.service;
      if (!key || key.length < 40 || h.ai_summary || histSummaries[key]) return;
      try {
        const r = await fetch('/api/ai/summarize', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: key, style: 'title', historyId: h.id }),
        });
        const d = await r.json();
        if (r.ok && d.summary) setHistSummaries(prev => ({ ...prev, [key]: d.summary }));
      } catch {}
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualHistory]);

  // Simulate/Perform Rego Lookup
  const handleReceiptUpload = async (file: File | null) => {
    if (!file) return;
    setReceiptError(null);
    setIsParsingReceipt(true);
    try {
      // Read file as base64 (strip the data: prefix)
      const base64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/ai/parse-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileData: base64, mimeType: file.type }),
      });
      const data = await res.json();
      if (!res.ok) { setReceiptError(data.error || 'Could not scan receipt.'); return; }

      // Pre-fill the entry form with the extracted details
      if (data.date) setEntryDate(data.date);
      if (data.service) setEntryService(data.service);
      if (data.provider) setEntryProvider(data.provider);
      if (data.mileage) setEntryMileage(String(data.mileage));
      if (data.price) setEntryPrice(data.price);
      setEntryNotes(data.notes ? `${data.notes} (scanned)` : 'Scanned from receipt');
      setShowHistoryEntry(true);
    } catch {
      setReceiptError('Could not read that file. Try a clear photo or PDF.');
    } finally {
      setIsParsingReceipt(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // Parse MANY receipts/PDFs at once (drag-and-drop or multi-select) into editable records
  const handleMultiUpload = async (files: File[]) => {
    const list = files.filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
    if (list.length === 0) { setReceiptError('Only images or PDFs are supported.'); return; }
    setReceiptError(null);
    setBatchProgress({ done: 0, total: list.length });
    setShowBatchReview(true);
    const results: ParsedRecord[] = [];
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      try {
        const base64 = await fileToBase64(file);
        const res = await fetch('/api/ai/parse-receipt', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileData: base64, mimeType: file.type }),
        });
        const d = await res.json();
        if (res.ok) {
          results.push({
            id: `${Date.now()}-${i}`, date: d.date || '', service: d.service || '', provider: d.provider || '',
            mileage: d.mileage ? String(d.mileage) : '', price: d.price || '', notes: d.notes || '', fileName: file.name,
          });
        } else {
          results.push({ id: `${Date.now()}-${i}`, date: '', service: '', provider: '', mileage: '', price: '', notes: `⚠️ Could not read (${d.error || 'parse failed'})`, fileName: file.name });
        }
      } catch {
        results.push({ id: `${Date.now()}-${i}`, date: '', service: '', provider: '', mileage: '', price: '', notes: '⚠️ Could not read this file', fileName: file.name });
      }
      setBatchProgress({ done: i + 1, total: list.length });
      setParsedBatch([...results]);
    }
    setBatchProgress(null);
  };

  const updateBatchRecord = (id: string, field: keyof ParsedRecord, value: string) =>
    setParsedBatch(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  const removeBatchRecord = (id: string) => setParsedBatch(prev => prev.filter(r => r.id !== id));

  // Persist the reviewed batch against the vehicle + customer in the Torqued DB
  const saveBatch = async () => {
    const plate = (rego || vehicle?.rego || '').toUpperCase();
    if (!plate) { setReceiptError('No vehicle selected.'); return; }
    setBatchSaving(true);
    try {
      const res = await fetch('/api/customer/save-history', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rego: plate, ownerId: customerOwnerId,
          records: parsedBatch.map(r => ({ date: r.date, service: r.service, provider: r.provider, mileage: r.mileage ? Number(r.mileage) : null, price: r.price, notes: r.notes })),
        }),
      });
      const d = await res.json();
      if (!res.ok) { setReceiptError(d.error || 'Could not save history.'); return; }
      // Reflect saved records in the on-screen history immediately
      setManualHistory(prev => [
        ...parsedBatch.map(r => ({ date: r.date, service: r.service, provider: r.provider, mileage: r.mileage || '', price: r.price, notes: r.notes })),
        ...prev,
      ]);
      setParsedBatch([]); setShowBatchReview(false);
    } catch {
      setReceiptError('Could not save. Please try again.');
    } finally {
      setBatchSaving(false);
    }
  };

  const handleRegoLookup = async () => {
    if (!rego) return;
    const formattedRego = rego.toUpperCase().trim();
    setIsSearchingRego(true);
    setPlateMatchError(null);
    setShowNewCustomerForm(false);
    setReturningCustomerName(null);

    try {
      const res = await fetch('/api/customer/check-plate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rego: formattedRego }),
      });

      const data = await res.json();

      if (res.status === 404 || data.notFound) {
        // Plate not in registry (Carjam also failed) — offer manual entry
        setShowManualVehicle(true);
        return;
      }

      if (data.isNew) {
        if (data.carjamData) {
          // Carjam identified the vehicle — auto-populate
          const cj = data.carjamData;
          setCarjamVehicle(cj);
          setCarjamStolenWarning(cj.stolenFlag === true);

          // Pre-fill manual fields in case user wants to edit
          setManualMake(cj.make);
          setManualModel(cj.model);
          setManualYear(String(cj.year || ''));
          setManualSubmodel(cj.variant || '');

          // Set engine/spec from DB match
          const match = data.vehicleModelMatch;
          if (match && !Array.isArray(match)) {
            setVehicleModelSpec(match);
            setVehicleModelOptions([]);
            setShowSubmodelPicker(false);
          } else if (Array.isArray(match) && match.length > 0) {
            setVehicleModelOptions(match);
            setVehicleModelSpec(null);
            setShowSubmodelPicker(true);
          }

          // If this customer is already verified, register the Carjam vehicle and load it
          if (customerOwnerId) {
            const addRes = await fetch('/api/customer/manual-vehicle', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                rego: formattedRego,
                year: cj.year || null,
                make: cj.make,
                model: cj.model,
                submodel: cj.variant || null,
                ownerId: customerOwnerId,
              }),
            });
            if (addRes.ok) {
              await loadVehicleByRego(formattedRego);
              return;
            }
          }
          // New customer — create vehicle record first (so register endpoint just sets owner_id)
          await fetch('/api/customer/manual-vehicle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rego: formattedRego,
              year: cj.year || null,
              make: cj.make,
              model: cj.model,
              submodel: cj.variant || null,
              vehicleModelId: !Array.isArray(data.vehicleModelMatch) && data.vehicleModelMatch?.id ? data.vehicleModelMatch.id : null,
            }),
          });
          setShowNewCustomerForm(true);
          return;
        }

        // Plate exists in DB but no owner — standard new customer path
        if (customerOwnerId) {
          const addRes = await fetch('/api/customer/add-vehicle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ownerId: customerOwnerId, rego: formattedRego }),
          });
          if (addRes.ok) {
            await loadVehicleByRego(formattedRego);
            return;
          }
        }
        setShowNewCustomerForm(true);
      } else {
        // Returning customer — 6-digit code emailed
        setReturningCustomerName(data.customerName);
        setOtpSentEmail(data.maskedEmail || 'your registered email');
        setShowOTPModal(true);
      }
    } catch (err) {
      setPlateMatchError('Could not connect. Please try again.');
    } finally {
      setIsSearchingRego(false);
    }
  };

  // Real AI fault code translation via Gemini
  useEffect(() => {
    if (faultCode.length < 4) { setAiTranslation(''); return; }
    setAiTranslation(`Interpreting ${faultCode.toUpperCase()}...`);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/ai/fault-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: faultCode, make: vehicle?.make, model: vehicle?.model, year: vehicle?.year, mileage, ownerId: customerOwnerId }),
        });
        const data = await res.json();
        setAiTranslation(data.translation || '');
      } catch {
        setAiTranslation('Unable to interpret code right now.');
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [faultCode, vehicle]);

  // Select a mechanic and fetch their custom packages/pricing for this vehicle,
  // then advance to scheduling. Shared by the normal mechanic-list step and the
  // direct-booking-link flow (?book=<mechanicId>), which auto-invokes this with
  // the locked mechanic instead of showing the mechanic-choice step at all.
  const chooseMechanic = (mechanic: Mechanic) => {
    setSelectedMechanic({ ...mechanic, estimatedPrice: totalPrice });
    setMechanicPackages([]);
    fetch(`/api/mechanic/${mechanic.id}/package-price${vehicle?.rego ? `?rego=${vehicle.rego}` : ''}`)
      .then(r => r.json())
      .then(d => {
        const pkgs: any[] = d.packages || [];
        setMechanicPackages(pkgs);
        if (!pkgs.length) return;
        const hasTransmission = selectedServices.includes('transmission');
        const standardServices = selectedServices.filter(s => s !== 'transmission');
        const standardPkgs = pkgs.filter((p: any) => p.pkg_type === 'standard');
        const transPkgs = pkgs.filter((p: any) => p.pkg_type === 'transmission');
        let pkgTotal = 0;
        if (standardServices.length && standardPkgs.length) pkgTotal += Math.min(...standardPkgs.map((p: any) => p.calculatedPrice || p.price || 0));
        else if (standardServices.length) pkgTotal += totalPrice;
        if (hasTransmission && transPkgs.length) pkgTotal += transPkgs[0].calculatedPrice || transPkgs[0].price || 0;
        else if (hasTransmission) pkgTotal += SERVICES.find(s => s.id === 'transmission')?.basePrice || 0;
        if (pkgTotal > 0) setSelectedMechanic(prev => prev ? { ...prev, estimatedPrice: pkgTotal } : null);
      })
      .catch(() => {});
    setStep(5);
  };

  // Direct-booking link: whenever the flow would normally reach the mechanic-
  // choice step, silently lock in the mechanic behind the link instead of ever
  // rendering the list of workshops. Fires regardless of which button/path led
  // into step 4, so no individual "continue" handler needs to know about this.
  useEffect(() => {
    if (step === 4 && directBookConfirmed && directBookProfile) {
      chooseMechanic(directBookProfile);
    }
  }, [step, directBookConfirmed, directBookProfile]);

  const toggleService = (id: string) => {
    setSelectedServices(prev => {
      // Water pump and thermostat housing are always a combined job
      if (id === 'water_pump' || id === 'thermostat_housing') {
        const bundle = ['water_pump', 'thermostat_housing'];
        const removing = bundle.some(b => prev.includes(b));
        return removing ? prev.filter(s => !bundle.includes(s)) : [...prev, ...bundle.filter(b => !prev.includes(b))];
      }
      return prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id];
    });
  };

  // Typical job durations (minutes) per service
  const SERVICE_DURATIONS: Record<string, number> = {
    oil: 45, wof: 60, full: 180, brakes_front_pads: 90, brakes_front_rotors: 120,
    brakes_rear_pads: 90, brakes_rear_rotors: 120, timing: 480, timing_chain_full: 600, transmission: 240,
    battery: 30, diag_inspection: 60, spark_plugs: 90, cabin_filter: 20, brake_fluid: 60,
    coolant_flush: 60, ignition_coils: 120, water_pump: 150, thermostat_housing: 120,
  };
  // Services that usually need parts ordered in (incur the workshop's parts lead time)
  const NEEDS_PARTS = new Set(['timing', 'timing_chain_full', 'transmission', 'brakes_front_rotors', 'brakes_rear_rotors', 'spark_plugs', 'ignition_coils', 'water_pump', 'thermostat_housing']);

  const addBusinessDays = (from: Date, days: number) => {
    const d = new Date(from);
    let added = 0;
    while (added < days) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) added++; }
    return d;
  };

  // Capacity-aware turnaround: parts lead time + job duration + technician capacity
  useEffect(() => {
    if (!selectedTime) return;
    const totalMins = selectedServices.reduce((s, id) => s + (SERVICE_DURATIONS[id] || 60), 0);
    const technicians = selectedMechanic?.technicians || 1;
    const partsLead = selectedMechanic?.partsLeadDays ?? 1;
    const needsParts = selectedServices.some(id => NEEDS_PARTS.has(id));
    // Effective bay-hours: longer jobs split across technicians
    const effectiveHours = (totalMins / 60) / Math.max(1, technicians);

    // Drop-off: next business day, or +partsLead if parts must be ordered
    const earliestDrop = needsParts ? addBusinessDays(new Date(), Math.max(1, partsLead) + 1) : addBusinessDays(new Date(), 1);
    setSelectedDate(earliestDrop.toISOString().slice(0, 10));

    const [hour, min] = selectedTime.split(':').map(Number);
    // Turnaround = 2× the hands-on job time (e.g. a 2-hour job dropped at 9am → ready ~1pm).
    const turnaround = effectiveHours * 2;
    if (turnaround >= 8) {
      // Full-day+ job → ready next business day 5pm
      setEstimatedReadyTime('Next day, 5:00 PM');
    } else {
      let readyHour = hour + Math.ceil(turnaround);
      if (readyHour >= 17) { setEstimatedReadyTime('Same day, 5:00 PM'); return; }
      const ampm = readyHour >= 12 ? 'PM' : 'AM';
      if (readyHour > 12) readyHour -= 12;
      setEstimatedReadyTime(`${readyHour}:${min === 0 ? '00' : min} ${ampm}`);
    }
  }, [selectedServices, selectedTime, selectedMechanic]);

  // Fetch the workshop's genuine next-available drop-off dates whenever the chosen
  // mechanic or services change, then default the selection to the soonest one.
  useEffect(() => {
    const mechId = selectedMechanic?.id;
    if (!mechId) { setAvailableDates([]); return; }
    const needsParts = selectedServices.some(id => NEEDS_PARTS.has(id));
    let cancelled = false;
    setAvailabilityLoading(true);
    fetch(`/api/mechanic/next-available?mechanicId=${encodeURIComponent(mechId)}&needsParts=${needsParts ? 1 : 0}&count=3`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        const dates = Array.isArray(d.dates) ? d.dates : [];
        setAvailableDates(dates);
        if (dates[0]?.date) setSelectedDate(dates[0].date);
      })
      .catch(() => { if (!cancelled) setAvailableDates([]); })
      .finally(() => { if (!cancelled) setAvailabilityLoading(false); });
    return () => { cancelled = true; };
  }, [selectedMechanic?.id, selectedServices]);

  const handleBooking = async () => {
    if (!selectedMechanic || !paymentMethod) return;
    setIsBookingLoading(true);

    // Auto-save separate quote request when mixed mode (pre-qualified + unlisted concern)
    if (evQuoteConcern.trim()) {
      const evQuoteId = (crypto as any).randomUUID ? crypto.randomUUID() : `ev_${Date.now()}`;
      fetch('/api/bookings/persist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingData: {
            id: evQuoteId,
            mechanicId: selectedMechanic.id,
            vehicleId: vehicle?.rego || rego,
            serviceIds: ['diag_inspection'],
            totalPrice: 0,
            paymentMethod: 'TBD',
            paymentStatus: 'pending',
            status: 'pending',
            date: null,
            customerName: userName || '',
            email: customerEmail || '',
            description: `[EV Quote Request] ${evQuoteConcern.trim()}`,
          },
          userId: user?.id ?? customerOwnerId ?? null,
        }),
      }).catch(e => console.error('Failed to save EV quote alongside booking:', e));
      setEvQuoteConcern('');
    }

    // Split the selection into instantly-priced jobs and precise-quote jobs
    // (services with no instant price for this vehicle).
    const pricedServiceIds = selectedServices.filter(id => !isQuoteJob(id));
    const quoteServiceIds = selectedServices.filter(id => isQuoteJob(id));
    const bookingDateTime = selectedDate ? `${selectedDate}T${selectedTime || '09:00'}` : null;

    // Precise-quote jobs create a SINGLE quote-request entry that carries the
    // chosen repair date and the full service list. The mechanic builds the quote
    // (within 1 business hour); it then folds into that one entry and becomes
    // bookable — we do NOT also create a $0 "booked" entry.
    let quoteRequestId: string | null = null;
    if (quoteServiceIds.length > 0) {
      const quoteNames = quoteServiceIds
        .filter(id => id !== 'thermostat_housing')
        .map(id => serviceDisplayName(id, SERVICES.find(s => s.id === id)?.name || id))
        .join(', ');
      quoteRequestId = (crypto as any).randomUUID ? crypto.randomUUID() : `q_${Date.now()}`;
      await fetch('/api/bookings/persist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingData: {
            id: quoteRequestId,
            mechanicId: selectedMechanic.id,
            vehicleId: vehicle?.rego || rego,
            serviceIds: quoteServiceIds,
            totalPrice: 0,
            paymentMethod: paymentMethod || 'TBD',
            paymentStatus: 'pending',
            status: 'pending',
            date: bookingDateTime,
            customerName: userName || '',
            email: customerEmail || userProfile?.email || user?.email || '',
            description: `[Quote Request — respond within 1 business hour] ${quoteNames} for ${vehicle?.year || ''} ${vehicle?.make || ''} ${vehicle?.model || ''}`.trim(),
          },
          userId: user?.id ?? customerOwnerId ?? null,
        }),
      }).catch(e => console.error('Failed to save precise-quote request:', e));
    }

    // If EVERY selected job needs a quote, we're done: no payment, no $0 booking —
    // exactly one quote-request entry (created above). Confirm as "quote requested".
    if (pricedServiceIds.length === 0 && quoteServiceIds.length > 0) {
      const quoteJob: any = {
        id: quoteRequestId,
        vehicleId: vehicle?.id || 'v1',
        serviceIds: quoteServiceIds,
        mechanicId: selectedMechanic.id,
        mechanicName: selectedMechanic.name,
        status: 'pending',
        paymentStatus: 'pending',
        paymentMethod,
        date: bookingDateTime || undefined,
        totalPrice: 0,
        email: customerEmail || userProfile?.email || user?.email || null,
        description: '[Quote Request — respond within 1 business hour]',
      };
      setActiveJobs(prev => [...prev, quoteJob]);
      setLatestBooking(quoteJob);
      await triggerEmailConfirmation(quoteJob);
      setIsBookingLoading(false);
      setStep(7);
      return;
    }

    const isFinanceNow = paymentMethod === 'Finance Now';
    const isImmediatePayment = ['Afterpay', 'Klarna', 'Latitude', 'Q Card', 'Credit / Debit', 'Credit or Debit Card'].includes(paymentMethod);

    // Dynamic price calculation
    const baseAmtPrice = isClaimApproved ? 450 : (selectedMechanic.estimatedPrice || totalPrice);
    const calculatedPrice = typeof baseAmtPrice === 'string' ? parseFloat(baseAmtPrice) : baseAmtPrice;
    
    // Total price is discounted on confirmation if promo code is applied
    const finalCalculatedPrice = calculatedPrice;

    // Build an itemised breakdown so the invoice/quote PDF shows per-service
    // prices (bookings otherwise persist only a single total_price). Reuses the
    // exact per-service prices the customer just saw. vehicleLabel + customerPhone
    // are snapshotted here because bookings store neither the vehicle make/model
    // nor (from this flow) the phone.
    const catalogIds = pricedServiceIds.length > 0 ? pricedServiceIds : selectedServices;
    const catalogParts = catalogIds
      .filter(id => id !== 'thermostat_housing')
      .map(id => ({ name: serviceDisplayName(id, SERVICES.find(s => s.id === id)?.name || id), qty: 1, unitPrice: priceFor(id) }));
    if (addWaterPump && waterPump && (selectedServices.includes('timing') || selectedServices.includes('timing_chain_full'))) {
      catalogParts.push({ name: 'Water Pump & Thermostat Housing', qty: 1, unitPrice: waterPump.high });
    }
    const isDiagOnlyBooking = catalogIds.length === 1 && catalogIds[0] === 'diag_inspection';
    const catalogQuoteItems = {
      parts: catalogParts,
      labourHours: 0,
      labourRate: 0,
      shopFee: (!isDiagOnlyBooking && fleetShopFee) ? fleetShopFee : 0,
      vehicleLabel: `${vehicle?.year || ''} ${vehicle?.make || ''} ${vehicle?.model || ''}`.trim() || undefined,
      customerPhone: userProfile?.phone || undefined,
    };
    const catalogCustomerName = userProfile?.name || userName || undefined;

    // The paid booking covers only jobs with a real instant price. Any precise-
    // quote jobs are handled by the single quote-request entry created above.
    const newJob: Job = {
      id: Math.random().toString(36).substr(2, 9),
      vehicleId: vehicle?.id || 'v1',
      serviceIds: pricedServiceIds.length > 0 ? pricedServiceIds : selectedServices,
      mechanicId: selectedMechanic.id,
      mechanicName: selectedMechanic.name,
      mechanicAddress: (selectedMechanic as any).address || undefined,
      mechanicPhone: (selectedMechanic as any).phone || undefined,
      status: (isFinanceNow || mbiStatus === 'not-claimed') ? 'pending' : 'booked',
      paymentStatus: isClaimApproved ? 'confirmed' : (isFinanceNow || mbiStatus === 'not-claimed' ? 'awaiting_approval' : 'confirmed'),
      paymentMethod: mbiStatus === 'not-claimed' ? 'Provident Insurance' : paymentMethod,
      date: bookingDateTime || undefined,
      totalPrice: finalCalculatedPrice,
      depositPaid: undefined,
      description: diagnosticComment?.trim() || faultCode || undefined,
    };

    if (isImmediatePayment) {
      // Torqued is prepaid in full — the customer pays the whole amount up front.
      const todayAmountToPay = calculatedPrice;

      // GUARD: If $219.00 OFF code brings due amount to $0, confirm directly without going to Stripe checkout
      if (todayAmountToPay === 0) {
        newJob.paymentStatus = 'confirmed';
        newJob.status = 'booked';
        localStorage.setItem('pending_booking', JSON.stringify(newJob));

        // Persist via service role so it shows in mechanic/admin portals even for anonymous customers
        fetch('/api/bookings/persist', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingData: { ...newJob, email: customerEmail || userProfile?.email || user?.email || null, customerName: catalogCustomerName, customerPhone: catalogQuoteItems.customerPhone, quoteItems: catalogQuoteItems },
            userId: user?.id ?? customerOwnerId ?? null,
          }),
        }).catch(e => console.error('Failed to persist $0 booking:', e));

        setActiveJobs(prev => [...prev, newJob]);
        setLatestBooking(newJob);
        await triggerEmailConfirmation(newJob);
        
        setIsBookingLoading(false);
        setStep(7); // Jump directly to success screen
        return;
      }

      localStorage.setItem('pending_booking', JSON.stringify(newJob));

      try {
        const response = await fetch('/api/stripe/create-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: todayAmountToPay,
            bookingId: newJob.id,
            customerEmail: customerEmail || userProfile?.email || user?.email || 'customer@torqued.nz',
            description: `Torqued Repair Booking Ref ${newJob.id}`,
            bookingData: { ...newJob, email: customerEmail || userProfile?.email || user?.email || null, customerName: catalogCustomerName, customerPhone: catalogQuoteItems.customerPhone, quoteItems: catalogQuoteItems },
            userId: user?.id ?? customerOwnerId ?? null,
          })
        });

        if (!response.ok) {
          let errorMsg = `HTTP Error Status ${response.status}`;
          try {
            const errData = await response.json();
            if (errData && errData.error) { errorMsg = errData.error; }
          } catch (e) {}
          throw new Error(errorMsg);
        }

        const session = await response.json();
        if (session && session.url && !session.isMock) {
          // Real Stripe — redirect straight to hosted checkout
          window.location.href = session.url;
          return;
        }

        // No Stripe keys configured (dev / not-yet-live) — confirm the booking directly.
        newJob.paymentStatus = 'confirmed';
        newJob.status = 'booked';
        setActiveJobs(prev => [...prev, newJob]);
        setLatestBooking(newJob);
        await triggerEmailConfirmation(newJob);
        setIsBookingLoading(false);
        setStep(7);
      } catch (err) {
        console.error('Error fetching checkout session:', err);
        setIsBookingLoading(false);
        alert(err instanceof Error ? err.message : 'Could not start payment. Please try again.');
      }

      return;
    }

    // Default local & auth fallback (Finance Now, pending approvals, etc.)
    if (user) {
      supabase.from('bookings').upsert({
        id: newJob.id,
        customer_id: user.id,
        mechanic_id: newJob.mechanicId,
        vehicle_rego: newJob.vehicleId || null,
        service_ids: newJob.serviceIds,
        status: newJob.status,
        payment_status: newJob.paymentStatus,
        payment_method: newJob.paymentMethod,
        date: newJob.date,
        total_price: newJob.totalPrice,
        deposit_paid: newJob.depositPaid ?? null,
        customer_name: catalogCustomerName ?? null,
        customer_phone: catalogQuoteItems.customerPhone ?? null,
        quote_items: catalogQuoteItems,
      }, { onConflict: 'id' }).then(({ error }) => {
        if (error) console.error('Failed to persist booking:', error.message);
      });
    }
    setActiveJobs(prev => [...prev, newJob]);
    setLatestBooking(newJob);
    // Send email for fallback
    await triggerEmailConfirmation(newJob);
    setStep(7);
    setIsBookingLoading(false);
  };

  const deleteHistory = (index: number) => {
    setManualHistory(prev => prev.filter((_, i) => i !== index));
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="space-y-4">
              <h2 className="text-3xl sm:text-4xl md:text-5xl tracking-tighter">
                Step 1: Enter Your Car
              </h2>

              {/* Rego input — always shown first, auto-filled when coming from garage */}
              {!vehicle && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="ENTER NUMBER PLATE (E.G. RAH190)"
                      value={rego}
                      onChange={(e) => { setRego(e.target.value.toUpperCase()); setCarjamVehicle(null); setCarjamStolenWarning(false); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && rego && !isSearchingRego) {
                          e.preventDefault();
                          handleRegoLookup();
                        }
                      }}
                      className="text-lg sm:text-2xl font-display font-bold placeholder:font-normal bg-card border-border text-foreground placeholder:text-muted focus:ring-1 focus:ring-torqued-red"
                    />
                  </div>
                  <Button onClick={handleRegoLookup} disabled={isSearchingRego || !rego} className="bg-torqued-red">
                    {isSearchingRego ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search size={20} />}
                  </Button>
                </div>
              )}

              {carjamStolenWarning && (
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/30">
                  <span className="text-red-500 text-lg leading-none mt-0.5">⚠️</span>
                  <div>
                    <p className="text-sm font-bold text-red-500">Stolen vehicle alert</p>
                    <p className="text-xs text-muted mt-0.5">This plate (<span className="font-bold text-foreground">{rego.toUpperCase()}</span>) has been reported as stolen on the NZ Motor Vehicle Register. We cannot process a booking for this vehicle. Please contact NZ Police if you believe this is an error.</p>
                  </div>
                </div>
              )}

              {carjamVehicle && !vehicle && !carjamStolenWarning && (
                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-emerald-500 text-base leading-none mt-0.5">✓</span>
                  <div>
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Vehicle identified via NZ Motor Vehicle Register</p>
                    <p className="text-xs text-muted mt-0.5">{carjamVehicle.year} {carjamVehicle.make} {carjamVehicle.model}{carjamVehicle.variant ? ` · ${carjamVehicle.variant}` : ''}{carjamVehicle.engineCc ? ` · ${(carjamVehicle.engineCc / 1000).toFixed(1)}L` : ''}</p>
                  </div>
                </div>
              )}

              {!vehicle && (
                <p className="text-muted text-sm">
                  We'll use your rego to pull exact specs for accurate parts pricing.
                </p>
              )}
            </div>

            {vehicle && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <Card className="p-3 sm:p-4 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 border-border bg-card shadow-2xl">
                  {(() => {
                    const logo = getCarBrandLogo(vehicle.make);
                    return vehicle.thumbnail
                      ? <img src={vehicle.thumbnail} alt="Vehicle" className="w-16 h-16 sm:w-24 sm:h-24 rounded-xl object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      : logo
                        ? <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-xl bg-card border border-border flex items-center justify-center p-2 shrink-0"><img src={logo} alt={vehicle.make} className="w-full h-full object-contain" /></div>
                        : <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-xl bg-card border border-border flex items-center justify-center shrink-0"><Car size={28} className="text-muted" /></div>;
                  })()}
                  <div className="flex-1 text-center sm:text-left">
                    <div className="torqued-badge mb-1">{vehicle.rego}</div>
                    <h3 className="text-xl sm:text-2xl">{vehicle.year} {vehicle.make} {vehicle.model}</h3>
                    {vehicle.variant && <p className="text-xs sm:text-sm text-muted">{vehicle.variant}</p>}
                    {vehicleModelSpec && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5 justify-center sm:justify-start">
                        {vehicleModelSpec.engine_cc && <span className="text-[10px] font-bold bg-torqued-red/10 text-torqued-red px-2 py-0.5 rounded-full">{(vehicleModelSpec.engine_cc / 1000).toFixed(1)}L {vehicleModelSpec.fuel || ''}</span>}
                        {vehicleModelSpec.engine_code && <span className="text-[10px] font-bold bg-card border border-border text-muted px-2 py-0.5 rounded-full">{vehicleModelSpec.engine_code}</span>}
                        {vehicleModelSpec.transmission && <span className="text-[10px] font-bold bg-card border border-border text-muted px-2 py-0.5 rounded-full">{vehicleModelSpec.transmission}</span>}
                        {vehicleModelSpec.timing_drive && <span className="text-[10px] font-bold bg-card border border-border text-muted px-2 py-0.5 rounded-full">Timing {vehicleModelSpec.timing_drive}</span>}
                        <button onClick={() => { setShowSubmodelPicker(true); setVehicleModelSpec(null); }} className="text-[10px] font-bold text-muted hover:text-foreground underline">change</button>
                      </div>
                    )}
                    {showSubmodelPicker && !vehicleModelSpec && vehicleModelOptions.length > 0 && (
                      <div className="mt-2 space-y-1.5 w-full text-left">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted">Confirm your exact variant</p>
                        {vehicleModelOptions.map((opt: any, i: number) => {
                          const variant = [opt.submodel, opt.engine_code].filter(Boolean).join(' · ') || opt.model;
                          const specs = [
                            opt.engine_cc ? `${(opt.engine_cc / 1000).toFixed(1)}L` : null,
                            opt.fuel,
                            opt.transmission,
                            opt.timing_drive ? `Timing ${opt.timing_drive}` : null,
                          ].filter(Boolean).join(' · ');
                          const years = opt.year_from ? `${opt.year_from}–${opt.year_to || 'present'}` : null;
                          return (
                            <button
                              key={i}
                              onClick={() => {
                                setVehicleModelSpec(opt);
                                setShowSubmodelPicker(false);
                                // Re-fetch fleet prices using the confirmed vehicle_models row
                                if (opt.id) {
                                  const regoParam = vehicle?.rego || rego;
                                  fetch(`/api/fleet-prices?rego=${encodeURIComponent(regoParam)}&vehicleModelId=${encodeURIComponent(opt.id)}`)
                                    .then(r => r.json())
                                    .then((fp: any) => {
                                      if (fp?.vehicleId) setFleetVehicleId(fp.vehicleId);
                                      if (fp?.timingDrive) setVehicleTimingDrive(fp.timingDrive as 'belt' | 'chain' | 'na');
                                      setWaterPumpRecommended(!!fp?.waterPumpRecommended);
                                      setWaterPump(fp?.waterPump ?? null);
                                      setTimingIntervalKm(fp?.timingIntervalKm ?? null);
                                      if (fp?.shopFee) setFleetShopFee(fp.shopFee);
                                      if (fp?.prices && Object.keys(fp.prices).length > 0) {
                                        const highs: Record<string, number> = {};
                                        for (const [svcId, p] of Object.entries(fp.prices as Record<string, any>)) highs[svcId] = (p as any).high;
                                        setVehiclePrices(prev => ({ ...prev, ...highs }));
                                        setFleetPricesRaw(fp.prices);
                                        if (fp?.waterPumpInDB !== undefined) setWaterPumpInDB(!!fp.waterPumpInDB);
            if (fp?.differentialInDB !== undefined) setDifferentialInDB(!!fp.differentialInDB);
            if (fp?.differentialApplicable !== undefined) setDifferentialApplicable(!!fp.differentialApplicable);
                                      }
                                    }).catch(() => {});
                                }
                              }}
                              className="w-full text-left px-3 py-2.5 rounded-xl border border-border hover:border-torqued-red/50 bg-background hover:bg-card transition-all space-y-0.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-foreground">{variant}</span>
                                {years && <span className="text-[10px] text-muted shrink-0">{years}</span>}
                              </div>
                              {specs && <p className="text-[10px] text-muted">{specs}</p>}
                            </button>
                          );
                        })}
                        <p className="text-[10px] text-muted pt-1">Don't see your exact variant? <button onClick={() => setShowSubmodelPicker(false)} className="underline">Skip</button> — pricing will still be accurate.</p>
                      </div>
                    )}
                  </div>
                  <CheckCircle2 className="hidden sm:block ml-auto text-green-500" size={32} />
                </Card>
                <div className="mt-8 space-y-4">
                  {/* Last Known Mileage — tap to edit */}
                  {editingMileage ? (
                    <Input
                      label="Last Known Mileage (km)"
                      placeholder="E.g. 98000"
                      type="number"
                      value={mileage}
                      autoFocus
                      onChange={(e) => setMileage(e.target.value)}
                      onBlur={() => {
                        setEditingMileage(false);
                        const km = parseInt(mileage, 10);
                        const plate = (vehicle?.rego || rego || '').toUpperCase();
                        if (plate && Number.isFinite(km) && km > 0) {
                          fetch(`/api/vehicles/${encodeURIComponent(plate)}/mileage`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ mileage: km, phase: 'customer' }),
                          }).catch(() => {});
                        }
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      className="bg-card border-border text-foreground"
                    />
                  ) : (
                    <button
                      onClick={() => setEditingMileage(true)}
                      className="w-full text-left p-3 rounded-xl border border-border bg-card hover:border-torqued-red/40 transition-all group"
                    >
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted group-hover:text-torqued-red transition-colors">Last Known Mileage · Tap to Edit</p>
                      <p className="text-lg font-bold mt-0.5">{mileage ? `${Number(mileage).toLocaleString()} km` : <span className="text-muted font-normal text-sm">Enter mileage…</span>}</p>
                    </button>
                  )}

                  {/* New to Torqued — hidden when vehicle is already in the garage */}
                  {!garageUnlocked && (
                  <div className="pt-4 border-t border-border space-y-4">
                      <div className="flex items-center justify-between">
                         <label className="text-sm font-bold">New to Torqued?</label>
                         <button
                          onClick={() => setIsNewVehicle(!isNewVehicle)}
                          className={cn(
                            "w-12 h-6 rounded-full transition-all relative",
                            isNewVehicle ? "bg-torqued-red" : "bg-card"
                          )}
                         >
                           <div className={cn(
                               "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                               isNewVehicle ? "left-7" : "left-1"
                           )} />
                         </button>
                      </div>
                      
                      {isNewVehicle && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          className="space-y-4 overflow-hidden"
                        >
                          <p className="text-xs text-muted italic">Adding your purchase details helps us fine-tune your "Auto" assisted schedule.</p>
                          <div className="grid grid-cols-2 gap-4">
                            <Input 
                              label="Purchase Date" 
                              type="date"
                              value={purchaseDate}
                              onChange={(e) => setPurchaseDate(e.target.value)}
                              className="bg-card border-border text-foreground"
                            />
                            <Input 
                              label="Purchase Mileage" 
                              type="number"
                              placeholder="Km at purchase"
                              value={purchaseMileage}
                              onChange={(e) => setPurchaseMileage(e.target.value)}
                              className="bg-card border-border text-foreground"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted">Service History (Optional)</label>
                            <div className="space-y-2">
                              {manualHistory.map((item, i) => (
                                <div key={i} className="flex justify-between items-center p-2 bg-card rounded-lg text-xs">
                                  <div className="space-y-0.5">
                                    <div className="font-bold">{item.date} - {item.service}</div>
                                    <div className="opacity-60 flex gap-2">
                                      <span>{item.provider}</span>
                                      {item.mileage && <span>• {item.mileage} km</span>}
                                    </div>
                                  </div>
                                </div>
                              ))}
                              
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  fullWidth
                                  size="sm"
                                  className="text-[10px] h-8 border-border"
                                  onClick={() => setShowHistoryEntry(!showHistoryEntry)}
                                >
                                  <Plus size={12} className="mr-1" /> Add Manual Entry
                                </Button>
                                <label className={cn(
                                  "flex-1 text-[10px] h-8 inline-flex items-center justify-center rounded-md font-bold cursor-pointer transition-all border",
                                  isParsingReceipt ? "border-border text-muted cursor-wait" : "border-torqued-red/40 text-torqued-red hover:bg-torqued-red/10"
                                )}>
                                  {isParsingReceipt ? (
                                    <><div className="w-3 h-3 border-2 border-torqued-red/30 border-t-torqued-red rounded-full animate-spin mr-1.5" /> Scanning…</>
                                  ) : (
                                    <><Mail size={12} className="mr-1" /> Scan Receipt (AI)</>
                                  )}
                                  <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    className="hidden"
                                    disabled={isParsingReceipt}
                                    onChange={(e) => { handleReceiptUpload(e.target.files?.[0] || null); e.target.value = ''; }}
                                  />
                                </label>
                              </div>
                              {receiptError && <p className="text-[10px] text-torqued-red font-bold">{receiptError}</p>}

                              {showHistoryEntry && (
                                <div className="p-3 bg-card rounded-xl space-y-2 border border-border">
                                  <Input
                                    label="Service Date"
                                    type="date"
                                    className="h-8 text-xs bg-background border-border"
                                    value={entryDate}
                                    onChange={(e) => setEntryDate(e.target.value)}
                                  />
                                  <Input
                                    label="Service Performed"
                                    placeholder="Oil change..."
                                    className="h-8 text-xs bg-background border-border"
                                    value={entryService}
                                    onChange={(e) => setEntryService(e.target.value)}
                                  />
                                  <Input
                                    label="Mileage (km)"
                                    placeholder="E.g. 85000"
                                    type="number"
                                    className="h-8 text-xs bg-background border-border"
                                    value={entryMileage}
                                    onChange={(e) => setEntryMileage(e.target.value)}
                                  />
                                  <div className="relative">
                                    <Input
                                      label="Provider"
                                      placeholder="Precision Mech..."
                                      className="h-8 text-xs bg-background border-border"
                                      value={entryProvider}
                                      onChange={(e) => setEntryProvider(e.target.value)}
                                    />
                                    {filteredProviders.length > 0 && (
                                      <div className="absolute z-10 w-full bg-card border border-border rounded-lg mt-1 shadow-lg overflow-hidden">
                                        {filteredProviders.map(p => (
                                          <button
                                            key={p}
                                            className="w-full text-left px-3 py-1.5 text-[10px] hover:bg-torqued-red/5 hover:text-torqued-red transition-all border-b border-border last:border-0"
                                            onClick={() => setEntryProvider(p)}
                                          >
                                            {p}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <Button size="sm" fullWidth onClick={() => {
                                    if (!entryDate || !entryService) return;
                                    const newItem = { date: entryDate, service: entryService, provider: entryProvider || 'Unknown', mileage: entryMileage };
                                    setManualHistory(prev => [...prev, newItem].sort((a, b) => parseServiceDate(b.date) - parseServiceDate(a.date)));
                                    setShowHistoryEntry(false);
                                    setEntryDate('');
                                    setEntryService('');
                                    setEntryProvider('');
                                    setEntryMileage('');
                                  }}>Save Entry</Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}

                  {/* AI Recommendations inline — shown when health insights are available */}
                  {(healthInsights.length > 0 || healthLoading) && garageUnlocked && (
                    <div className="space-y-3 pt-4 border-t border-border">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-black uppercase tracking-widest text-muted">Vehicle Health</p>
                        <button
                          onClick={() => setShowHistorySheet(true)}
                          className="text-xs text-torqued-red font-bold hover:underline"
                        >Review / Edit →</button>
                      </div>

                      {/* AI insight cards */}
                      {healthLoading ? (
                        <div className="flex items-center gap-3 py-3 px-3 bg-background rounded-xl border border-border">
                          <div className="w-4 h-4 border-2 border-torqued-red/30 border-t-torqued-red rounded-full animate-spin shrink-0" />
                          <p className="text-xs text-muted font-bold">Analysing your vehicle history…</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {healthInsights.filter(ins => ins.severity !== 'good').map((insight, i) => {
                            const sid = insightToServiceId(insight.title);
                            const isAdded = sid ? selectedServices.includes(sid) : false;
                            return (
                              <div key={i} className={cn(
                                "flex items-start gap-3 p-3 rounded-xl border",
                                insight.severity === 'overdue' ? "border-torqued-red/30 bg-torqued-red/5" : "border-amber-500/20 bg-amber-500/5"
                              )}>
                                <div className="flex-1 min-w-0">
                                  <p className={cn("text-xs font-bold", insight.severity === 'overdue' ? "text-torqued-red" : "text-amber-400")}>{insight.title}</p>
                                  <p className="text-[10px] text-muted mt-0.5 leading-snug">{insight.detail}</p>
                                </div>
                                {sid && (
                                  <button
                                    onClick={() => setSelectedServices(prev => isAdded ? prev.filter(s => s !== sid) : [...prev, sid])}
                                    className={cn(
                                      "shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                      isAdded ? "bg-emerald-500/20 text-emerald-400" : "bg-torqued-red text-white hover:bg-red-600"
                                    )}
                                  >
                                    {isAdded ? '✓ Added' : '+ Add'}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                          {selectedServices.length > 0 && (
                            <button
                              onClick={() => setStep(2)}
                              className="w-full mt-1 py-2 text-xs font-black uppercase tracking-widest text-torqued-red border border-torqued-red/40 rounded-xl hover:bg-torqued-red/5 transition-all"
                            >
                              Review Work Order ({selectedServices.length} item{selectedServices.length !== 1 ? 's' : ''}) →
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <Button fullWidth onClick={() => setStep(2)} disabled={!mileage} className="bg-torqued-red">Continue to Services →</Button>
                </div>
              </motion.div>
            )}
          </motion.div>
        );

      case 2:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="flex items-center gap-4">
              <button onClick={() => setStep(1)} className="p-2 hover:bg-card rounded-full transition-all">
                <ArrowLeft size={24} />
              </button>
              <div className="space-y-1">
                <h2 className="text-2xl sm:text-3xl md:text-4xl">Step 2: What Do You Need?</h2>
                <p className="text-sm sm:text-base text-muted">
                  Select a standard service or describe a problem.
                </p>
              </div>
            </div>

            {/* Submodel confirmation — shown when multiple variants exist and user hasn't picked one */}
            {vehicleModelOptions.length > 1 && !vehicleModelSpec && (
              <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-amber-500 text-lg leading-none mt-0.5">⚠</span>
                  <div>
                    <p className="text-sm font-bold text-foreground">Confirm your exact variant for accurate pricing</p>
                    <p className="text-xs text-muted mt-0.5">We found multiple engine/transmission options for your vehicle. Prices for parts like oil and transmission fluid differ by spec.</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {vehicleModelOptions.map((opt: any, i: number) => {
                    const variant = [opt.submodel, opt.engine_code].filter(Boolean).join(' · ') || opt.model;
                    const specs = [
                      opt.engine_cc ? `${(opt.engine_cc / 1000).toFixed(1)}L` : null,
                      opt.fuel, opt.transmission,
                      opt.timing_drive ? `Timing ${opt.timing_drive}` : null,
                    ].filter(Boolean).join(' · ');
                    const years = opt.year_from ? `${opt.year_from}–${opt.year_to || 'present'}` : null;
                    return (
                      <button key={i} onClick={() => {
                        setVehicleModelSpec(opt);
                        const regoParam = vehicle?.rego || rego;
                        if (opt.id) {
                          fetch(`/api/fleet-prices?rego=${encodeURIComponent(regoParam)}&vehicleModelId=${encodeURIComponent(opt.id)}`)
                            .then(r => r.json())
                            .then((fp: any) => {
                              if (fp?.vehicleId) setFleetVehicleId(fp.vehicleId);
                              if (fp?.timingDrive) setVehicleTimingDrive(fp.timingDrive as 'belt' | 'chain' | 'na');
                              setWaterPumpRecommended(!!fp?.waterPumpRecommended);
                              setWaterPump(fp?.waterPump ?? null);
                              setTimingIntervalKm(fp?.timingIntervalKm ?? null);
                              if (fp?.shopFee) setFleetShopFee(fp.shopFee);
                              if (fp?.prices && Object.keys(fp.prices).length > 0) {
                                const highs: Record<string, number> = {};
                                for (const [svcId, p] of Object.entries(fp.prices as Record<string, any>)) highs[svcId] = (p as any).high;
                                setVehiclePrices(prev => ({ ...prev, ...highs }));
                                setFleetPricesRaw(fp.prices);
                                if (fp?.waterPumpInDB !== undefined) setWaterPumpInDB(!!fp.waterPumpInDB);
            if (fp?.differentialInDB !== undefined) setDifferentialInDB(!!fp.differentialInDB);
            if (fp?.differentialApplicable !== undefined) setDifferentialApplicable(!!fp.differentialApplicable);
                              }
                            }).catch(() => {});
                        }
                      }}
                        className="w-full text-left px-3 py-2.5 rounded-xl border border-border hover:border-torqued-red/50 bg-background hover:bg-card transition-all space-y-0.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-foreground">{variant}</span>
                          {years && <span className="text-[10px] text-muted shrink-0">{years}</span>}
                        </div>
                        {specs && <p className="text-[10px] text-muted">{specs}</p>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {vehicleModelSpec && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
                <span className="text-emerald-500 font-bold">✓</span>
                <span className="text-foreground font-bold">
                  {[vehicleModelSpec.submodel, vehicleModelSpec.engine_code].filter(Boolean).join(' · ') || vehicle?.variant || 'Variant confirmed'}
                  {vehicleModelSpec.engine_cc ? ` · ${(vehicleModelSpec.engine_cc / 1000).toFixed(1)}L` : ''}
                  {vehicleModelSpec.transmission ? ` · ${vehicleModelSpec.transmission}` : ''}
                </span>
                <button onClick={() => { setVehicleModelSpec(null); setShowSubmodelPicker(true); }} className="ml-auto text-muted hover:text-foreground underline text-[10px]">change</button>
              </div>
            )}

            {quotePath === 'service' ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {SERVICES.filter(service => {
                    if (service.id === 'thermostat_housing') return false;
                    if (service.id === 'water_pump' && !waterPumpInDB) return false;
                    if (service.id === 'differential' && !differentialApplicable) return false;
                    // Full Timing Chain Replacement only shows for chain engines that
                    // have a real price (migration 051); never as an unpriced quote card.
                    if (service.id === 'timing_chain_full' && !fleetPricesRaw['timing_chain_full']) return false;
                    // On chain engines the priced 'Full Timing Chain Replacement' card
                    // replaces the generic 'Timing Chain' quote card — don't show both.
                    if (service.id === 'timing' && vehicleTimingDrive === 'chain' && fleetPricesRaw['timing_chain_full']) return false;
                    if (isEV) {
                      const EV_OK = new Set(['wof','brakes_front_pads','brakes_front_rotors','brakes_rear_pads','brakes_rear_rotors','diag_inspection','cabin_filter','brake_fluid','ppi']);
                      return EV_OK.has(service.id);
                    }
                    return true;
                  }).map(service => {
                    const fp = fleetPricesRaw[service.id];
                    const selected = selectedServices.includes(service.id) || (service.id === 'water_pump' && selectedServices.includes('thermostat_housing'));
                    return (
                      <button
                        key={service.id}
                        onClick={() => toggleService(service.id)}
                        className={cn(
                          "p-4 rounded-xl border text-left transition-all flex flex-col gap-2",
                          selected
                            ? "border-torqued-red bg-torqued-red/10 text-torqued-red"
                            : "border-border bg-card hover:border-border/60 text-foreground"
                        )}
                      >
                        <div className="flex flex-col items-center gap-1 w-full text-center">
                          <span className="text-2xl">{service.icon}</span>
                          <span className="text-xs font-bold uppercase tracking-tight leading-tight">{serviceDisplayName(service.id, service.name)}</span>
                          {fp
                            ? <span className="text-[10px] text-muted">${fp.high}</span>
                            : fleetPricesLoaded
                              ? <span className="text-[10px] text-amber-500 font-semibold">Quote · ~1 hr</span>
                              : null}
                        </div>
                      </button>
                    );
                  })}
                  {/* Job not listed here */}
                  <button
                    onClick={() => { setShowUnlistedQuote(true); }}
                    className={cn(
                      "p-4 rounded-xl border text-left transition-all flex flex-col gap-2",
                      showUnlistedQuote
                        ? "border-torqued-red bg-torqued-red/10"
                        : evQuoteConcern.trim() && !showUnlistedQuote
                          ? "border-emerald-500/50 bg-emerald-500/8"
                          : "border-dashed border-border bg-card hover:border-torqued-red/40 text-foreground"
                    )}
                  >
                    <div className="flex flex-col items-center gap-1 w-full text-center">
                      <span className="text-2xl">{evQuoteConcern.trim() && !showUnlistedQuote ? '✓' : '💬'}</span>
                      <span className={cn("text-xs font-bold uppercase tracking-tight leading-tight", evQuoteConcern.trim() && !showUnlistedQuote ? "text-emerald-500" : "text-muted")}>
                        {evQuoteConcern.trim() && !showUnlistedQuote ? 'Quote Added' : 'Job Not Listed Here'}
                      </span>
                      <span className="text-[10px] text-muted/70 text-center leading-tight">
                        {evQuoteConcern.trim() && !showUnlistedQuote ? 'Tap to edit' : 'Know what you need?'}
                      </span>
                    </div>
                  </button>
                </div>

                {/* Unlisted job request panel */}
                {showUnlistedQuote && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-card border border-border rounded-2xl space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold">Request a Custom Quote</p>
                        <p className="text-xs text-muted mt-0.5">
                          {selectedServices.length > 0
                            ? 'Describe the extra work — your mechanic will price it separately. Your other selected services continue as normal.'
                            : 'Describe the work you need — your chosen mechanic will send you a price. No inspection fee.'}
                        </p>
                      </div>
                      <button onClick={() => { setShowUnlistedQuote(false); setEvQuoteConcern(''); }} className="p-1 hover:bg-background rounded text-muted hover:text-foreground transition-all"><X size={14} /></button>
                    </div>

                    {selectedServices.length > 0 ? (
                      /* Mixed mode — pre-qualified services selected + extra unlisted work */
                      <div className="space-y-3">
                        <textarea
                          rows={3}
                          placeholder="Describe the unlisted work (e.g. 'front passenger window won't go up'). Your mechanic will quote it separately."
                          value={evQuoteConcern}
                          onChange={(e) => setEvQuoteConcern(e.target.value)}
                          className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-torqued-red transition-all resize-none"
                        />
                        <p className="text-[10px] text-muted leading-relaxed">
                          This quote request will be sent to your chosen mechanic alongside your booking. They'll price it and get back to you separately — no inspection fee.
                        </p>
                        <div className="flex gap-2">
                          <button
                            disabled={!evQuoteConcern.trim()}
                            onClick={() => {
                              if (!evQuoteConcern.trim()) return;
                              setShowUnlistedQuote(false);
                              // quote will auto-submit when handleBooking fires (mixed-mode logic)
                            }}
                            className="flex-1 py-2.5 text-xs font-black uppercase tracking-widest bg-torqued-red text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-600 transition-all"
                          >
                            Add to Booking →
                          </button>
                          <button
                            onClick={() => { setShowUnlistedQuote(false); setEvQuoteConcern(''); }}
                            className="px-4 py-2.5 text-xs font-bold text-muted border border-border rounded-xl hover:bg-background transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Standalone mode — no pre-qualified services selected */
                      <EVQuoteRequest
                        vehicle={vehicle}
                        rego={rego}
                        realMechanics={realMechanics}
                        customerEmail={customerEmail}
                        customerOwnerId={customerOwnerId}
                        userName={userName}
                        customerCoords={customerCoords}
                        requestLocation={requestLocation}
                        locationAsked={locationAsked}
                        onSubmitted={(job) => {
                          setActiveJobs(prev => [job, ...prev]);
                          setShowUnlistedQuote(false);
                          setView('dashboard');
                        }}
                      />
                    )}
                  </motion.div>
                )}

                {/* Service comparison card — shown when Standard Service or Gold Service is selected */}
                {(selectedServices.includes('oil') || selectedServices.includes('full')) && (
                  <div className="p-4 bg-card border border-border rounded-xl space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted">What's included</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className={cn("p-3 rounded-lg border space-y-2 transition-all", selectedServices.includes('oil') ? "border-torqued-red bg-torqued-red/5" : "border-border opacity-60")}>
                        <p className="text-xs font-black uppercase tracking-tight text-foreground">Standard Service</p>
                        <ul className="space-y-1">
                          {['Oil and filter change', 'Check coolant', 'Check brake fluid', 'Check wipers & top-up wiper fluid', 'Check tyre pressures'].map(item => (
                            <li key={item} className="text-[10px] text-muted flex items-start gap-1"><span className="text-torqued-red mt-0.5">✓</span>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div className={cn("p-3 rounded-lg border space-y-2 transition-all", selectedServices.includes('full') ? "border-torqued-red bg-torqued-red/5" : "border-border opacity-60")}>
                        <p className="text-xs font-black uppercase tracking-tight text-foreground">Gold Service</p>
                        <ul className="space-y-1">
                          {['Everything in Standard Service', 'Check and test 12V battery', 'Check transmission fluid', 'Check diff. oil levels (if relevant)', 'Inspect drive belts', 'Clean air filter', 'Check all lights', 'Fully inspect brakes', 'Check exhaust system', 'Check wheel bearings', 'Scan computer / inspect sensors', 'Check clutch operation (if relevant)', 'Check spark plugs', 'Check suspension and steering'].map(item => (
                            <li key={item} className="text-[10px] text-muted flex items-start gap-1"><span className="text-torqued-red mt-0.5">✓</span>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Brake pad rotor machining info — shown when front or rear pads selected */}
                {(selectedServices.includes('brakes_front_pads') || selectedServices.includes('brakes_rear_pads')) &&
                 !selectedServices.includes('brakes_front_rotors') && !selectedServices.includes('brakes_rear_rotors') && (
                  <div className="p-4 bg-amber-500/8 border border-amber-500/25 rounded-xl space-y-2">
                    <div className="flex items-start gap-3">
                      <span className="text-lg shrink-0">🛑</span>
                      <div className="space-y-1.5">
                        <p className="text-sm font-bold text-amber-400">Rotor machining included — here's why it matters</p>
                        <p className="text-[11px] text-muted leading-relaxed">When brake pads wear down, they score grooves into your rotors. Fitting new pads on scored rotors causes uneven contact — leading to brake shudder, reduced stopping power, and pads wearing out faster. Your mechanic will machine (resurface) your rotors as part of this job at no extra charge, restoring a flat surface for the new pads to bed in correctly.</p>
                        <p className="text-[10px] text-amber-400/80 font-bold">✓ Rotor machining cost included in your quote</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Full timing chain replacement — what's included + diagnostic pathway */}
                {selectedServices.includes('timing_chain_full') && (
                  <div className="p-4 bg-card border border-border rounded-xl space-y-2.5">
                    <div className="flex items-start gap-3">
                      <span className="text-lg shrink-0">⛓️</span>
                      <div className="space-y-2">
                        <p className="text-sm font-bold text-foreground">What a full timing chain replacement includes</p>
                        <ul className="text-[11px] text-muted leading-relaxed list-disc pl-4 space-y-0.5">
                          <li>Timing chain(s)</li>
                          <li>Tensioner &amp; chain guides</li>
                          <li>Camshaft &amp; crankshaft sprockets</li>
                          <li>Camshaft &amp; crankshaft oil seals</li>
                          <li>Timing cover gasket &amp; seals</li>
                          <li>Drive / accessory belt</li>
                        </ul>
                        <p className="text-[11px] text-muted leading-relaxed">
                          Timing chains are built to last the life of the engine, so there's no fixed replacement interval — they're renewed when they stretch, rattle on cold start, or throw a timing-related fault. <span className="text-foreground font-semibold">Not sure yours needs doing?</span> A ${''}
                          <button onClick={() => { if (!selectedServices.includes('diag_inspection')) toggleService('diag_inspection'); }} className="underline font-bold text-torqued-red hover:text-red-400">$99 Diagnostic Inspection</button> confirms its condition first — and the fee comes off the job if you go ahead.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Belt water-pump nudge — pump sits behind the cambelt, so doing both together shares labour */}
                {selectedServices.includes('water_pump') && vehicleTimingDrive === 'belt' && !selectedServices.includes('timing') && (
                  <div className="p-4 bg-blue-500/10 border border-blue-500/25 rounded-xl">
                    <div className="flex items-start gap-3">
                      <Info size={16} className="text-blue-400 mt-0.5 shrink-0" />
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-blue-400">Save on labour — do it with your cambelt</p>
                        <p className="text-[11px] text-muted leading-relaxed">On this engine the water pump sits behind the timing belt cover, so most of the labour overlaps with a cambelt replacement. If your cambelt is due, doing both together saves you a second strip-down. Your workshop will advise on the day.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Water pump recommendation card — shown alongside any timing job (cambelt or full chain) */}
                {waterPumpRecommended && waterPump && (selectedServices.includes('timing') || selectedServices.includes('timing_chain_full')) && (
                  <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl space-y-3">
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={16} className="text-orange-400 mt-0.5 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <p className="text-sm font-bold text-orange-500">Water Pump & Thermostat Housing strongly recommended</p>
                        <p className="text-[11px] text-muted">The water pump sits behind the same timing cover, so replacing it at the same time avoids a second strip-down and labour charge. Includes pump, thermostat housing, and coolant refill.</p>
                        {timingIntervalKm && (
                          <p className="text-[11px] text-orange-400/90 font-semibold">Manufacturer schedule replaces the water pump alongside the timing service — roughly every {timingIntervalKm.toLocaleString()} km.</p>
                        )}
                        <div className="space-y-1 text-[10px] text-muted border-t border-orange-500/20 pt-2">
                          <div className="flex justify-between"><span>Parts (pump kit + auxiliary belt)</span><span>${waterPump.partsHigh}</span></div>
                          {(waterPump as any).coolantHigh > 0 && <div className="flex justify-between"><span>Coolant refill</span><span>${(waterPump as any).coolantHigh}</span></div>}
                          <div className="flex justify-between"><span>Labour (1 hr extra)</span><span>${waterPump.labourExtra}</span></div>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <div className="text-[11px] font-bold text-orange-500">Add-on total: ${waterPump.high}</div>
                          <button
                            onClick={() => setAddWaterPump(v => !v)}
                            className={cn(
                              "px-3 py-1 rounded-lg text-[11px] font-bold transition-all",
                              addWaterPump
                                ? "bg-orange-500 text-white"
                                : "bg-orange-500/20 text-orange-300 hover:bg-orange-500/30"
                            )}
                          >
                            {addWaterPump ? '✓ Added' : 'Add to booking'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {(totalPrice > 0 || selectedServices.length > 0) && (
                  <div className="p-4 bg-card rounded-xl border border-border space-y-2">
                    {(() => {
                      // No invented numbers: a service is either priced from real
                      // per-vehicle data, or it's a precise-quote job (workshop
                      // responds within 1 business hour).
                      const hasTH = selectedServices.includes('thermostat_housing');
                      const displayServices = selectedServices.filter(id => id !== 'thermostat_housing');
                      return displayServices.map(id => {
                        const fp = fleetPricesRaw[id];
                        const svc = SERVICES.find(s => s.id === id);
                        if (!svc) return null;
                        const combinedPrice = (id === 'water_pump' && hasTH && fp)
                          ? fp.high + (fleetPricesRaw['thermostat_housing']?.high ?? 0)
                          : fp?.high;
                        return (
                          <div key={id} className="flex justify-between text-xs text-muted">
                            <span>{id === 'water_pump' && hasTH ? 'Water Pump & Thermostat Housing' : serviceDisplayName(id, svc.name)}</span>
                            {combinedPrice
                              ? <span>${combinedPrice}</span>
                              : <span className="text-amber-500">Precise quote · ~1 business hr</span>}
                          </div>
                        );
                      });
                    })()}
                    {addWaterPump && waterPump && selectedServices.includes('timing') && (
                      <div className="flex justify-between text-xs text-orange-500">
                        <span>Water Pump &amp; Thermostat Housing</span>
                        <span>${waterPump.high}</span>
                      </div>
                    )}
                    {evQuoteConcern.trim() && !showUnlistedQuote && (
                      <div className="flex justify-between text-xs text-emerald-500">
                        <span className="truncate mr-2">Custom quote: "{evQuoteConcern.trim().slice(0, 40)}{evQuoteConcern.trim().length > 40 ? '…' : ''}"</span>
                        <button onClick={() => setEvQuoteConcern('')} className="shrink-0 text-muted hover:text-torqued-red">×</button>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t border-border">
                      <span className="text-xs font-bold uppercase text-muted">
                        {selectedQuoteJobs.length > 0 && totalPrice > 0 ? 'Estimated Total (priced jobs)' : 'Estimated Total'}
                      </span>
                      <span className="text-xl font-bold text-torqued-red">${totalPrice}</span>
                    </div>
                    {selectedQuoteJobs.length > 0 && (
                      <div className="flex items-start gap-2 pt-2 mt-1 border-t border-border/60">
                        <Clock size={13} className="text-amber-500 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-muted leading-relaxed">
                          {selectedQuoteJobs.map(id => serviceDisplayName(id, SERVICES.find(s => s.id === id)?.name || id)).join(', ')}
                          {selectedQuoteJobs.length === 1 ? ' needs' : ' need'} a precise quote — your workshop confirms the exact price within <span className="text-foreground font-semibold">1 business hour</span>, before any work starts. You can still book your priced jobs now.
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {isEV && (
                  <div className="mt-6 space-y-4">
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2">
                      <p className="text-sm font-bold text-amber-400">Limited Tesla & EV coverage</p>
                      <p className="text-xs text-muted">At this stage, there are a limited number of workshops that provide service for your Tesla. We're sorry about this — we can still request a quote to your chosen mechanic, and we're actively working on expanding our Tesla & Electric Vehicle network.</p>
                    </div>
                    {selectedServices.length === 0 ? (
                      // EV-only: full self-contained quote request flow (mechanic picker + submit)
                      <EVQuoteRequest
                        vehicle={vehicle}
                        rego={rego}
                        realMechanics={realMechanics}
                        customerEmail={customerEmail}
                        customerOwnerId={customerOwnerId}
                        userName={userName}
                        customerCoords={customerCoords}
                        requestLocation={requestLocation}
                        locationAsked={locationAsked}
                        onSubmitted={(job) => {
                          setActiveJobs(prev => [job, ...prev]);
                          setView('dashboard');
                        }}
                      />
                    ) : (
                      // Mixed mode: pre-qualified services selected — collect concern text only.
                      // Auto-submitted as a separate quote job alongside the standard booking.
                      <div className="p-4 bg-card border border-border rounded-xl space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted">Anything else to quote? <span className="normal-case text-muted/60 font-normal">(optional)</span></p>
                        <p className="text-[11px] text-muted">We'll send a separate quote request to your chosen workshop for any additional EV work — no extra steps needed.</p>
                        <textarea
                          value={evQuoteConcern}
                          onChange={e => setEvQuoteConcern(e.target.value)}
                          placeholder="e.g. Annual service, battery health check, software update…"
                          rows={3}
                          className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-torqued-red resize-none transition-all"
                        />
                      </div>
                    )}
                  </div>
                )}
                {/* Something else — service search */}
                <div className="space-y-3 p-4 bg-card rounded-xl border border-border">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">Something else?</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customServiceQuery}
                      onChange={e => { setCustomServiceQuery(e.target.value); setCustomSearchDone(false); }}
                      onKeyDown={e => { if (e.key === 'Enter') {
                        const q = customServiceQuery.trim();
                        if (!q) return;
                        setCustomSearchLoading(true); setCustomSearchDone(false); setCustomSearchResults([]);
                        fetch(`/api/services/search?q=${encodeURIComponent(q)}`)
                          .then(r => r.json()).then(d => { setCustomSearchResults(d.results ?? []); setCustomSearchDone(true); })
                          .catch(() => { setCustomSearchResults([]); setCustomSearchDone(true); })
                          .finally(() => setCustomSearchLoading(false));
                      }}}
                      placeholder="e.g. AC regas, coolant flush, battery…"
                      className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-torqued-red/40"
                    />
                    <button
                      onClick={() => {
                        const q = customServiceQuery.trim();
                        if (!q) return;
                        setCustomSearchLoading(true); setCustomSearchDone(false); setCustomSearchResults([]);
                        fetch(`/api/services/search?q=${encodeURIComponent(q)}`)
                          .then(r => r.json()).then(d => { setCustomSearchResults(d.results ?? []); setCustomSearchDone(true); })
                          .catch(() => { setCustomSearchResults([]); setCustomSearchDone(true); })
                          .finally(() => setCustomSearchLoading(false));
                      }}
                      disabled={!customServiceQuery.trim() || customSearchLoading}
                      className="px-4 py-2 bg-torqued-red text-white text-sm font-bold rounded-lg disabled:opacity-40"
                    >
                      {customSearchLoading ? '…' : 'Search'}
                    </button>
                  </div>
                  {customSearchDone && customSearchResults.length === 0 && customServiceQuery.trim() && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted">No fixed pricing for "{customServiceQuery.trim()}" — add it and your workshop will quote it.</p>
                      <button
                        onClick={() => {
                          const q = customServiceQuery.trim();
                          if (!q) return;
                          if (!selectedServices.includes('diag_inspection')) toggleService('diag_inspection');
                          setDiagnosticComment(prev => prev.includes(q) ? prev : `Requested: ${q}${prev ? '\n' + prev : ''}`);
                          setCustomServiceQuery('');
                          setCustomSearchDone(false);
                          setCustomSearchResults([]);
                        }}
                        className="w-full px-4 py-2 bg-torqued-red text-white text-sm font-bold rounded-lg"
                      >
                        + Add "{customServiceQuery.trim()}" to my booking
                      </button>
                    </div>
                  )}
                  {customSearchDone && customSearchResults.length > 0 && (
                    <div className="space-y-2">
                      {customSearchResults.map((r, idx) => {
                        const isSelected = selectedServices.includes(r.id);
                        return (
                          <button
                            key={`${r.id}-${idx}`}
                            type="button"
                            onClick={() => toggleService(r.id)}
                            className={cn(
                              "w-full flex justify-between items-center px-3 py-2 rounded-lg text-sm border transition-all cursor-pointer",
                              isSelected
                                ? "border-torqued-red bg-torqued-red/10 text-torqued-red"
                                : "border-border bg-card text-foreground hover:border-torqued-red/40 hover:bg-background"
                            )}
                          >
                            <span className="font-medium">{r.name}</span>
                            <span className="text-xs opacity-60 flex items-center gap-1.5">
                              {isSelected && <span className="font-bold">✓ Added</span>}
                              {!isSelected && r.indicativePrice > 0 && `from $${r.indicativePrice}`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {!(isEV && selectedServices.length === 0) && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted">
                      {selectedServices.includes('diag_inspection') ? 'Describe your concern *' : 'Additional Notes'}
                    </label>
                    <textarea
                      value={diagnosticComment}
                      onChange={e => setDiagnosticComment(e.target.value)}
                      className={cn(
                        "w-full bg-background border rounded-xl px-4 py-3 outline-none focus:bg-card transition-all min-h-[100px] text-foreground",
                        selectedServices.includes('diag_inspection') && !diagnosticComment.trim()
                          ? "border-torqued-red/60 focus:border-torqued-red"
                          : "border-border focus:border-torqued-red/30"
                      )}
                      placeholder={selectedServices.includes('diag_inspection')
                        ? `Describe your concern about your ${[vehicle?.make, vehicle?.model].filter(Boolean).join(' ') || 'vehicle'} here`
                        : 'Anything else we should know?'}
                    />
                    {selectedServices.includes('diag_inspection') && !diagnosticComment.trim() && (
                      <p className="text-[10px] text-torqued-red">Required for diagnostic bookings — your mechanic reviews this before the inspection.</p>
                    )}
                  </div>
                )}
                {!(isEV && selectedServices.length === 0) && (
                  <div className="flex gap-4">
                    <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                    <Button className="flex-1 bg-torqued-red" onClick={() => { lookupFleetQuote(); setStep(3); }}
                      disabled={selectedServices.length === 0 || (selectedServices.includes('diag_inspection') && !diagnosticComment.trim())}>
                      Continue →
                    </Button>
                  </div>
                )}
                {isEV && selectedServices.length === 0 && (
                  <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted">Describe the issue</label>
                  <textarea
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 outline-none focus:bg-card focus:border-torqued-red/30 transition-all min-h-[120px] text-foreground"
                    placeholder="E.g. Squeaking when braking, engine light is on..."
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted">Fault Code (Optional)</label>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-torqued-red uppercase bg-torqued-red/10 px-2 py-0.5 rounded">
                      <Lock size={10} /> Torqued Pro
                    </div>
                  </div>
                  <Input
                    placeholder="E.G. P0301"
                    value={faultCode}
                    onChange={(e) => setFaultCode(e.target.value)}
                    className="bg-background border-border text-foreground"
                  />
                  {aiTranslation && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-card border border-border text-foreground rounded-xl text-xs leading-relaxed"
                    >
                      <div className="flex items-center gap-2 mb-1 text-torqued-red font-bold uppercase tracking-widest text-[10px]">
                        <Info size={12} /> Auto Interpretation
                      </div>
                      {aiTranslation}
                    </motion.div>
                  )}
                </div>
                <div className="flex gap-4">
                  <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                  <Button className="flex-1 bg-torqued-red" onClick={() => {
                    if (!faultCode) {
                      setIsDiagnosticMode(true);
                    } else {
                      lookupFleetQuote(); setStep(3);
                    }
                  }}>Continue →</Button>
                </div>
              </div>
            )}

            {isDiagnosticMode && !isDiagnosticSimulatedComplete && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
              >
                <Card className="max-w-md w-full p-8 space-y-6 overflow-hidden relative border-border bg-background">
                   <button 
                    onClick={() => setIsDiagnosticMode(false)}
                    className="absolute top-4 right-4 text-muted hover:text-white transition-colors"
                   >
                     ✕
                   </button>
                   <div className="space-y-2">
                     <div className="w-12 h-12 bg-torqued-red/10 rounded-full flex items-center justify-center">
                        <Wrench size={24} className="text-torqued-red" />
                     </div>
                     <h3 className="text-3xl font-bold tracking-tight text-white">Diagnostic Needed</h3>
                     <p className="text-muted">Since there's no fault code, we need a physical inspection to quote accurately.</p>
                   </div>

                   <div className="space-y-4 pt-4">
                      {[
                        { step: 1, text: "Book a diagnostic appointment ($99 set fee)." },
                        { step: 2, text: "Visit your mechanic for a 45min inspection." },
                        { step: 3, text: "Your mechanic will generate a quote within seconds of diagnosing the problem." },
                        { step: 4, text: "Receive and compare your quote to market averages." },
                        { step: 5, text: "Book your repair with Torqued simplicity." }
                      ].map(s => (
                        <div key={s.step} className="flex gap-4 items-start text-white">
                          <div className="w-6 h-6 rounded-full bg-torqued-red text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {s.step}
                          </div>
                          <p className="text-sm font-medium leading-snug">{s.text}</p>
                        </div>
                      ))}
                   </div>

                   <div className="space-y-2 pt-2 text-left">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/50">What are you experiencing? (optional)</label>
                      <textarea
                        value={diagnosticComment}
                        onChange={(e) => setDiagnosticComment(e.target.value)}
                        rows={3}
                        placeholder="E.g. Grinding noise when braking, judder at 80km/h, warning light on dash…"
                        className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-white placeholder:text-muted/70 resize-none focus:outline-none focus:border-torqued-red"
                      />
                      <p className="text-[11px] text-muted">Your mechanic sees this before diagnosing.</p>
                   </div>

                   <div className="pt-2">
                      <Button fullWidth size="lg" className="bg-torqued-red text-white hover:bg-red-700" onClick={() => {
                        setIsDiagnosticMode(false);
                        setSelectedServices(['diag_inspection']);
                        setStep(3); // Find a mechanic, then pay — quote comes after inspection
                      }}>Book Diagnostic Appointment →</Button>
                   </div>
                </Card>
              </motion.div>
            )}
          </motion.div>
        );

      case 3:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="flex items-center gap-4">
              <button onClick={() => setStep(2)} className="p-2 hover:bg-card rounded-full transition-all">
                <ArrowLeft size={24} />
              </button>
              <div className="space-y-1">
                <h2 className="text-3xl sm:text-4xl md:text-5xl tracking-tighter">Step 3: Your Location</h2>
                <p className="text-sm sm:text-base text-muted">Find mechanics near you.</p>
              </div>
            </div>

            <div className="space-y-6">
              <Input 
                label="Suburb or Postcode"
                placeholder="E.g. South Auckland"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                icon={<MapPin size={20} />}
                className="bg-card border-border"
              />
              
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted">Search Radius</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['5km', '10km', '25km', 'Any'].map(r => (
                    <button
                      key={r}
                      onClick={() => setRadius(r)}
                      className={cn(
                        "py-3 rounded-xl border font-bold text-sm transition-all",
                        radius === r ? "border-torqued-red bg-torqued-red text-white" : "border-border bg-card text-foreground hover:bg-background"
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {fleetQuoteState === 'fallback' ? (() => {
                const greetName = (userName || returningCustomerName || '').split(' ')[0] || 'there';
                const makeModel = carjamVehicle
                  ? `${carjamVehicle.make} ${carjamVehicle.model}`
                  : `${vehicle?.make ?? ''} ${vehicle?.model ?? ''}`.trim() || 'your vehicle';
                const low = fleetQuoteRange?.low ?? 150;
                const high = fleetQuoteRange?.high ?? 2500;
                const hasRange = low !== 150 || high !== 2500;
                return (
                  <Card className="p-6 sm:p-8 bg-card border-border text-foreground space-y-5 shadow-xl">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-widest">
                        <Info size={10} /> Indicative estimate · Confirmed quote coming
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted text-[10px] font-bold uppercase tracking-widest">Estimated Price Range</p>
                      <h3 className="text-4xl sm:text-5xl text-torqued-red tracking-tighter font-black">${low} – ${high}</h3>
                      {!hasRange && (
                        <p className="text-xs text-muted italic">varies significantly by vehicle</p>
                      )}
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed border-t border-border pt-4">
                      Hi {greetName}, we don't have exact pricing for your {makeModel} yet.
                      Based on similar vehicles, this job typically costs <span className="font-bold text-foreground">${low}–${high}</span>.
                      We're crunching the exact numbers — you'll get a confirmed quote by email within 2 hours.
                    </p>
                  </Card>
                );
              })() : fleetQuoteState === 'instant' && fleetQuoteRange ? (
                <Card className="p-8 bg-card border-border text-foreground space-y-6 shadow-xl">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-torqued-red/10 border border-torqued-red/20 text-torqued-red text-[10px] font-bold uppercase tracking-widest">
                      <Info size={10} /> Indicative estimate
                    </span>
                  </div>
                  <div className="flex justify-between items-end">
                    <div className="space-y-1">
                      <p className="text-muted text-[10px] font-bold uppercase tracking-widest">Estimated Price Range</p>
                      <h3 className="text-4xl sm:text-5xl text-torqued-red tracking-tighter font-black">${fleetQuoteRange.low.toLocaleString()} – ${fleetQuoteRange.high.toLocaleString()}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted uppercase font-bold tracking-widest">Fleet data</p>
                    </div>
                  </div>
                  <div className="border-t border-border pt-4 space-y-1">
                    {fleetShopFee && fleetShopFee > 0 && (
                      <p className="text-[10px] text-muted">Includes ${fleetShopFee} workshop fee (freight, sundries & consumables).</p>
                    )}
                    <p className="text-xs text-muted italic">*Final price confirmed by your matched mechanic before work begins.</p>
                  </div>
                </Card>
              ) : (
                <Card className="p-8 bg-card border-border text-foreground space-y-6 shadow-xl">
                  <div className="flex justify-between items-end">
                    <div className="space-y-1">
                      <p className="text-muted text-[10px] font-bold uppercase tracking-widest">Estimated Price Range</p>
                      <h3 className="text-4xl sm:text-5xl text-torqued-red tracking-tighter font-black">${Math.floor(totalPrice * 0.9)} – ${Math.ceil(totalPrice * 1.2)}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted uppercase font-bold tracking-widest">Market data</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted italic border-t border-border pt-4">
                    *Final price confirmed by your matched mechanic before work begins.
                  </p>
                </Card>
              )}

              <Button fullWidth size="lg" className="h-16 text-lg rounded-2xl bg-torqued-red text-white shadow-xl shadow-torqued-red/10" onClick={() => setStep(4)}>Match Me with a Mechanic →</Button>
            </div>
          </motion.div>
        );

      case 4: {
        // Direct-booking link: the useEffect above fires after this renders, so
        // without this guard the full mechanic list (competitors included) would
        // flash for a frame before jumping to step 5. Render a spinner instead.
        if (directBookConfirmed && directBookProfile) {
          return (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-border border-t-torqued-red rounded-full animate-spin" />
            </div>
          );
        }
        // Workshops without a WoF Authority can be excluded from WoF jobs by an admin.
        const needsWof = selectedServices.includes('wof');
        const wofFiltered = needsWof
          ? mechanicsByDistance.filter(m => !(m as any).wofDisabled)
          : mechanicsByDistance;
        const visibleMechanics = customerCoords
          ? wofFiltered.filter(m => !m.latitude || !m.longitude || m.distance <= 100)
          : wofFiltered;
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="flex items-center gap-4">
              <button onClick={() => setStep(3)} className="p-2 hover:bg-card rounded-full transition-all">
                <ArrowLeft size={24} />
              </button>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                {mechanicsLoading ? 'Finding Mechanics…' : `${visibleMechanics.length} Mechanic${visibleMechanics.length !== 1 ? 's' : ''} Found`}
              </h2>
            </div>

            <div className="bg-torqued-red/5 p-4 sm:p-6 rounded-2xl border border-torqued-red/10 flex items-start gap-4">
              <div className="bg-torqued-red text-white p-2 rounded-xl shadow-lg shrink-0">
                <Wrench size={18} />
              </div>
              <p className="text-xs font-medium leading-relaxed text-foreground">
                <span className="font-black text-torqued-red uppercase tracking-widest text-[10px] block mb-1">Smart Match</span>
                Based on your {vehicle?.year} {vehicle?.make}, we've prioritised mechanics with {
                  vehicle?.make === 'Tesla' ? 'EV and Technology specialist' : 
                  (vehicle?.make === 'Volkswagen' || vehicle?.make === 'Audi' || vehicle?.make === 'BMW') ? 'European vehicle expertise' :
                  'General maintenance and multi-brand'
                } experience.
              </p>
            </div>

            <div className="space-y-4">
              {mechanicsLoading && (
                <div className="flex items-center justify-center h-32">
                  <div className="w-8 h-8 border-4 border-border border-t-torqued-red rounded-full animate-spin" />
                </div>
              )}
              {!mechanicsLoading && !customerCoords && (
                <Card className="p-4 bg-card border-border flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold flex items-center gap-1.5"><MapPin size={14} className="text-torqued-red" /> Find workshops near you</p>
                    <p className="text-xs text-muted mt-0.5">{locationAsked ? 'Location unavailable — showing all workshops.' : 'Allow location to see the closest mechanics within 100 km.'}</p>
                  </div>
                  {!locationAsked && <Button size="sm" className="bg-torqued-red text-white shrink-0" onClick={requestLocation}>Use my location</Button>}
                </Card>
              )}
              {!mechanicsLoading && visibleMechanics.length === 0 && (
                <Card className="p-8 text-center bg-card border-border">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-torqued-red/10 flex items-center justify-center text-torqued-red mb-3"><MapPin size={20} /></div>
                  <p className="text-sm font-bold">Coming soon to your area</p>
                  <p className="text-xs text-muted mt-1">{customerCoords ? 'No Torqued workshops within 100 km yet.' : 'We\'re onboarding trusted local mechanics.'} We\'ll notify you the moment one is available nearby.</p>
                </Card>
              )}
              {!mechanicsLoading && visibleMechanics
                .map((mechanic, idx) => (
                <motion.div
                  key={mechanic.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <Card className="p-6 space-y-6 relative bg-card border-border shadow-md hover:shadow-xl transition-all group/card">
                    {mechanic.isFeatured && (
                      <div className="absolute top-0 right-0 bg-torqued-red text-white text-[10px] font-bold px-4 py-1.5 rounded-bl-2xl uppercase tracking-widest flex items-center gap-1.5 shadow-lg">
                        <Star size={12} className="fill-current" /> Trusted Match
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-6">
                      <div className="flex gap-4 flex-1">
                        <div className="relative">
                          <img src={mechanic.logo} alt={mechanic.name} className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover ring-1 ring-border group-hover/card:ring-torqued-red/30 transition-all" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <h3 className="text-xl sm:text-2xl leading-tight tracking-tight font-black">{mechanic.name}</h3>
                          <div className="flex items-center gap-1.5 text-xs text-muted font-medium">
                            <MapPin size={12} className="text-torqued-red" />
                            <span>
                              {mechanic.suburb}
                              {customerCoords && mechanic.latitude && mechanic.longitude && mechanic.distance < 900
                                ? ` • ${mechanic.distance.toFixed(1)} km away`
                                : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-2">
                            <Star size={12} className="text-yellow-400 fill-current" />
                            <span className="text-sm font-bold">{mechanic.rating}</span>
                            <span className="text-xs text-muted">({mechanic.reviews} reviews)</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex sm:flex-col justify-between sm:justify-center items-center sm:items-end gap-1.5 border-t sm:border-t-0 border-border pt-4 sm:pt-0">
                        <p className="text-[10px] font-bold uppercase text-muted tracking-widest">Est. Quote</p>
                        <p className="text-2xl sm:text-3xl font-black text-torqued-red tracking-tighter">${mechanicPrices[mechanic.id] ?? totalPrice}</p>
                      </div>
                    </div>
                    
                    {mechanic.address && (
                      <a 
                        href={mechanic.mapsUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-4 bg-background border border-border rounded-2xl hover:bg-torqued-red/5 hover:border-torqued-red/20 transition-all group/loc"
                      >
                        <div className="w-10 h-10 bg-card rounded-xl flex items-center justify-center border border-border shadow-sm group-hover/loc:bg-torqued-red group-hover/loc:text-white transition-all">
                          <MapPin size={18} />
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] font-bold uppercase text-muted leading-none mb-1.5 tracking-widest">Workshop Address</p>
                          <p className="text-sm font-medium text-foreground truncate">{mechanic.address}</p>
                        </div>
                        <ChevronRight size={18} className="text-muted group-hover/loc:text-torqued-red transition-all" />
                      </a>
                    )}
                    
                    <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-border gap-4">
                      <div className="flex items-center gap-2 text-emerald-500 w-full sm:w-auto">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        <span className="text-xs font-bold uppercase tracking-widest">Next Available: {mechanic.nextAvailable}</span>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="outline" size="sm" className="flex-1 sm:flex-initial border-border text-foreground hover:bg-card h-10 px-6 font-bold uppercase tracking-widest text-[10px]">Profile</Button>
                        <Button size="sm" className="flex-[2] sm:flex-initial bg-torqued-red hover:bg-red-700 text-white h-10 px-8 font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-torqued-red/20" onClick={() => chooseMechanic(mechanic)}>{selectedServices.includes('diag_inspection') ? 'Book Diagnostic' : 'Select & Schedule'}</Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>

            {isDiagnosticSimulatedComplete && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/95 backdrop-blur-md"
              >
                <div className="max-w-xl w-full space-y-8 text-center text-white">
                   <div className="space-y-4">
                      <div className="w-20 h-20 bg-torqued-red rounded-full flex items-center justify-center mx-auto animate-pulse">
                         <CheckCircle2 size={40} />
                      </div>
                      <h2 className="text-5xl font-bold">Your Quote is Ready!</h2>
                      <p className="text-muted text-lg">Your diagnostic was successful. We've matched the fault to a specific major repair.</p>
                   </div>

                   <Card className="p-8 bg-background text-white text-left space-y-6 border border-border shadow-2xl">
                      <div className="flex justify-between items-start">
                         <div>
                            <h4 className="text-xs font-bold uppercase tracking-widest text-muted">Diagnosed Problem</h4>
                            <p className="text-xl font-bold">DQ400e Hybrid Mechatronics Unit Failure</p>
                            <p className="text-xs text-muted mt-1">Requires unit replacement & system recalibration</p>
                         </div>
                         <div className="px-3 py-1 bg-torqued-red text-white text-[10px] font-bold uppercase rounded">
                            Verified Fix
                         </div>
                      </div>

                      <div className="space-y-3">
                        <div className="p-4 bg-red-50 rounded-xl border border-torqued-red/10 flex items-center justify-between">
                           <div>
                              <p className="text-[10px] font-bold uppercase text-torqued-red">Repair Estimate</p>
                              <p className="text-3xl font-bold">$6,997.00</p>
                           </div>
                           <div className="text-right">
                              <p className="text-[10px] font-bold uppercase text-muted">Comparison</p>
                              <p className="text-xs font-bold text-torqued-red inline-flex items-center gap-1">
                                <AlertTriangle size={12} /> Fair Market Price
                              </p>
                              <p className="text-[9px] text-muted leading-none">High-value specialized hybrid component</p>
                           </div>
                        </div>
                        
                        <div className="bg-card p-4 rounded-xl border border-border/50">
                           <div className="flex justify-between text-xs mb-2">
                             <span className="text-muted">DQ400e Mechatronics Unit</span>
                             <span className="font-bold">$5,297.00</span>
                           </div>
                           <div className="flex justify-between text-xs mb-2">
                             <span className="text-muted">Import Fees & Customs</span>
                             <span className="font-bold">$1,000.00</span>
                           </div>
                           <div className="flex justify-between text-xs mb-2">
                             <span className="text-muted">Express Freight (Germany)</span>
                             <span className="font-bold">$100.00</span>
                           </div>
                           <div className="flex justify-between text-xs">
                             <span className="text-muted">Specialized Labour (4 Hours)</span>
                             <span className="font-bold">$600.00</span>
                           </div>
                        </div>
                      </div>

                      <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-4">
                         <div className="flex items-center gap-4">
                            <div className="bg-emerald-500 text-white p-2 rounded-lg">
                               <Info size={20} />
                            </div>
                            <div className="flex-1">
                               <p className="text-sm font-bold text-emerald-900 leading-tight">Got Provident MBI?</p>
                               <p className="text-xs text-emerald-700">Mechatronic units are typically covered.</p>
                            </div>
                         </div>
                         
                         <div className="grid grid-cols-2 gap-2">
                           <button 
                            onClick={() => {
                              setHasMBI(true);
                              setMbiStatus('pre-approved');
                            }}
                            className={cn(
                              "p-2 rounded-lg text-[10px] font-bold uppercase tracking-wider text-center transition-all",
                              mbiStatus === 'pre-approved' ? "bg-emerald-600 text-white" : "bg-card border border-border text-muted"
                            )}
                           >
                              Pre-Approved
                           </button>
                           <button 
                            onClick={() => {
                              setHasMBI(true);
                              setMbiStatus('not-claimed');
                            }}
                            className={cn(
                              "p-2 rounded-lg text-[10px] font-bold uppercase tracking-wider text-center transition-all",
                              mbiStatus === 'not-claimed' ? "bg-emerald-600 text-white" : "bg-card border border-border text-muted"
                            )}
                           >
                              No Claim Yet
                           </button>
                         </div>
                      </div>

                      <div className="space-y-3">
                         <p className="text-xs text-muted leading-relaxed italic">"Torqued simplicity - finance and book online, we will save the service history for next time."</p>
                         <Button fullWidth size="lg" onClick={() => {
                            setSelectedServices(['mechatronics_replace']);
                            if (selectedMechanic) {
                              setSelectedMechanic({ ...selectedMechanic, estimatedPrice: 6997 });
                            }
                            setIsRepairFromDiagnostic(true);
                            setIsDiagnosticSimulatedComplete(false);
                            setStep(5); // Proceed to scheduling the actual repair
                         }}>Proceed with Repair →</Button>
                         <Button variant="outline" fullWidth onClick={() => {
                            setIsDiagnosticSimulatedComplete(false);
                            setStep(1); // For demo, let them reset or go back
                         }}>Decline Quote</Button>
                      </div>
                   </Card>
                </div>
              </motion.div>
            )}
          </motion.div>
        );
      }

      case 5:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="flex items-center gap-4">
              <button onClick={() => setStep(4)} className="p-2 hover:bg-card rounded-full transition-all">
                <ArrowLeft size={24} />
              </button>
              <div className="space-y-1">
                <h2 className="text-3xl sm:text-4xl md:text-5xl tracking-tighter">Step 5: When works?</h2>
                <p className="text-sm sm:text-base text-muted">Select drop-off for {selectedMechanic?.name}.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-8">
                <div className="space-y-4">
                   <label className="text-xs font-black uppercase tracking-widest text-muted">Drop off Day</label>
                   {availabilityLoading ? (
                     <p className="text-xs text-muted italic">Checking {selectedMechanic?.name || 'the workshop'}'s availability…</p>
                   ) : availableDates.length === 0 ? (
                     <p className="text-xs text-muted italic">No upcoming availability published — we'll confirm a drop-off date with you after booking.</p>
                   ) : (
                   <div className="grid grid-cols-3 gap-3">
                      {availableDates.map((d, idx) => (
                        <button
                          key={d.date}
                          onClick={() => setSelectedDate(d.date)}
                          className={cn(
                            "relative p-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all text-center",
                            selectedDate === d.date ? "border-torqued-red bg-torqued-red text-white shadow-lg shadow-torqued-red/20" : "border-border bg-card text-muted hover:border-torqued-red/30 hover:text-torqued-red"
                          )}
                        >
                          {idx === 0 && <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[7px] px-1.5 py-0.5 rounded-full">Soonest</span>}
                          {d.label}
                        </button>
                      ))}
                   </div>
                   )}
                </div>

                <div className="space-y-4">
                   <label className="text-xs font-black uppercase tracking-widest text-muted">Preferred Time</label>
                   <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {['08:00', '09:00', '10:00', '11:00', '13:00', '14:00'].map(t => (
                        <button 
                          key={t}
                          onClick={() => setSelectedTime(t)}
                          className={cn(
                            "p-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all text-center",
                            selectedTime === t ? "border-torqued-red bg-torqued-red text-white shadow-lg shadow-torqued-red/20" : "border-border bg-card text-muted hover:border-torqued-red/30 hover:text-torqued-red"
                          )}
                        >
                          {t}
                        </button>
                      ))}
                   </div>
                </div>

                <Card className="p-8 bg-card border-border border-l-4 border-l-torqued-red shadow-xl space-y-6">
                   <div className="flex items-center gap-4 text-torqued-red">
                      <Clock size={24} />
                      <h4 className="font-black uppercase tracking-widest text-[10px]">Booking Window: {selectedDate} @ {selectedTime}</h4>
                   </div>
                   <div className="pt-6 border-t border-border">
                      <p className="text-[10px] font-bold uppercase text-muted mb-2 tracking-widest">Estimated Collection</p>
                      <p className="text-4xl sm:text-5xl font-black tracking-tighter text-torqued-red">{estimatedReadyTime}</p>
                      <p className="text-[10px] text-muted mt-4 italic leading-relaxed">
                        {selectedServices.some(s => s.includes('timing')) ? 
                          "*Major repairs typically require the vehicle for the full day." : 
                          "*Standard service turnaround is approximately 4 hours."}
                      </p>
                   </div>
                </Card>

                <Button fullWidth size="lg" className="h-16 text-base rounded-2xl bg-torqued-red text-white shadow-xl shadow-torqued-red/20 flex flex-col gap-0.5" onClick={() => setStep(6)}>
                  <span>Accept &amp; Pay →</span>
                  {availableDates[0] && <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Soonest drop-off: {availableDates.find(d => d.date === selectedDate)?.label || availableDates[0].label}</span>}
                </Button>
              </div>

              <div className="space-y-6">
                 <h4 className="text-xs font-black uppercase tracking-widest text-muted">Awaiting your arrival</h4>
                 <div className="p-6 bg-emerald-500/5 rounded-3xl border border-emerald-500/10 flex gap-5">
                    <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
                       <CheckCircle2 size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-emerald-600">Workshop Capacity Confirmed</p>
                        <p className="text-xs text-muted leading-relaxed mt-1">We've tentatively reserved this slot. Completing payment will lock it in.</p>
                    </div>
                 </div>
                 
                 <div className="p-8 border border-border rounded-3xl space-y-6 bg-card">
                    <h5 className="text-[10px] font-black uppercase text-muted tracking-[0.2em]">Drop-off Instructions</h5>
                    <div className="space-y-6">
                       <div className="flex gap-4">
                          <div className="w-6 h-6 bg-background border border-border rounded-lg flex items-center justify-center text-[10px] font-black shrink-0">1</div>
                          <p className="text-sm text-foreground/80">Arrive at the workshop at your booked drop-off time.</p>
                       </div>
                       <div className="flex gap-4">
                          <div className="w-6 h-6 bg-background border border-border rounded-lg flex items-center justify-center text-[10px] font-black shrink-0">2</div>
                          <p className="text-sm text-foreground/80">Hand your keys to reception and confirm your booking reference.</p>
                       </div>
                       <div className="flex gap-4">
                          <div className="w-6 h-6 bg-background border border-border rounded-lg flex items-center justify-center text-[10px] font-black shrink-0">3</div>
                          <p className="text-sm text-foreground/80">We'll notify you via email when collection is ready.</p>
                       </div>
                    </div>
                 </div>
              </div>
            </div>
          </motion.div>
        );

      case 6: {
        const totalJobHours = (() => {
          let h = 0;
          for (const id of selectedServices) {
            const fp = fleetPricesRaw[id];
            if (fp?.labourHours) h += parseFloat(fp.labourHours) || 0;
          }
          if (addWaterPump && selectedServices.includes('timing')) h += 0.5;
          return h;
        })();
        const isComplexJob = totalJobHours >= 3;
        const mechanicClosingTime = '5:30 PM';
        const mechanicOpeningTime = '8:00 AM';
        // Scheduling: complex (3+ hrs) drop off by 9am → ready 4–5pm same day
        //             simple (< 3hrs) drop off by 12pm → ready by close of business
        const dropOffDeadline = isComplexJob ? '9:00 AM' : '12:00 PM';
        const samePickupWindow = isComplexJob ? '4:00 PM – 5:00 PM' : mechanicClosingTime;
        const nextBizDay = (() => {
          const d = new Date(selectedDate + 'T00:00:00');
          const dow = d.getDay();
          d.setDate(d.getDate() + (dow === 5 ? 3 : dow === 6 ? 2 : 1));
          return d.toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' });
        })();
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="flex items-center gap-4">
              <button onClick={() => setStep(5)} className="p-2 hover:bg-card rounded-full transition-all">
                <ArrowLeft size={24} />
              </button>
              <div className="space-y-1">
                <h2 className="text-3xl sm:text-4xl md:text-5xl tracking-tighter">Finalise Booking</h2>
                <p className="text-sm sm:text-base text-muted">Drop off by {dropOffDeadline} on {selectedDate}.</p>
              </div>
            </div>

            <div className="space-y-8">
              <Card className="p-8 bg-card border-border shadow-xl space-y-8">
                <div className="flex justify-between items-center border-b border-border pb-6">
                  <span className="text-[10px] font-black uppercase text-muted tracking-widest">Vehicle</span>
                  <span className="text-lg font-black text-foreground">{vehicle?.year} {vehicle?.make} {vehicle?.model}</span>
                </div>
                
                <div className="space-y-4">
                  <span className="text-[10px] font-black uppercase text-muted tracking-widest block">Job Breakdown</span>
                  {selectedServices.filter(id => !(id === 'thermostat_housing' && selectedServices.includes('water_pump'))).map(id => {
                    const service = SERVICES.find(s => s.id === id);
                    if (!service) return null;
                    const isTransmission = id === 'transmission';
                    const matchedPkg = mechanicPackages.find((p: any) => isTransmission ? p.pkg_type === 'transmission' : p.pkg_type === 'standard');
                    const displayPrice = matchedPkg ? (matchedPkg.calculatedPrice || matchedPkg.price) : priceFor(id);
                    return (
                      <div key={id} className="space-y-3 bg-background/50 p-4 rounded-2xl border border-border">
                        <div className="flex justify-between items-center text-foreground">
                          <span className="text-sm font-semibold">{matchedPkg ? matchedPkg.name : serviceDisplayName(id, service.name)}</span>
                          <span className="text-sm font-semibold">{displayPrice > 0 ? `$${displayPrice}` : <span className="text-amber-500 text-xs font-semibold">Precise quote · ~1 business hr</span>}</span>
                        </div>
                        {displayPrice === 0 && !matchedPkg && isQuoteJob(id) && (
                          <p className="text-[11px] text-muted leading-relaxed border-t border-border/50 pt-3">
                            No fixed menu price for this job on your vehicle. Your workshop reviews it and sends a precise, itemised quote within <span className="text-foreground font-semibold">1 business hour</span> — you approve it before any work begins. Nothing is charged for this line today.
                          </p>
                        )}
                        {matchedPkg ? (
                          <div className="border-t border-border/50 pt-3 space-y-1.5">
                            {matchedPkg.base_fee != null && (
                              <div className="flex justify-between text-xs text-muted">
                                <span>Labour / base</span><span>${matchedPkg.base_fee}</span>
                              </div>
                            )}
                            {matchedPkg.pkg_type === 'standard' && matchedPkg.oil_cost_per_l != null && (
                              <div className="flex justify-between text-xs text-muted">
                                <span>{matchedPkg.vehicleOilCapacity ?? matchedPkg.oil_litres ?? '?'}L {matchedPkg.oil_grade || 'oil'} @${matchedPkg.oil_cost_per_l}/L{matchedPkg.vehicleOilCapacity ? ' (vehicle spec)' : ''}</span>
                                <span>${((matchedPkg.vehicleOilCapacity ?? matchedPkg.oil_litres ?? 0) * matchedPkg.oil_cost_per_l).toFixed(2)}</span>
                              </div>
                            )}
                            {matchedPkg.filter_cost != null && matchedPkg.pkg_type === 'standard' && (
                              <div className="flex justify-between text-xs text-muted">
                                <span>Oil filter</span><span>${matchedPkg.filter_cost}</span>
                              </div>
                            )}
                            {matchedPkg.pkg_type === 'transmission' && matchedPkg.trans_oil_cost_per_l != null && (
                              <div className="flex justify-between text-xs text-muted">
                                <span>{matchedPkg.trans_oil_litres ?? '?'}L trans fluid @${matchedPkg.trans_oil_cost_per_l}/L</span>
                                <span>${((matchedPkg.trans_oil_litres ?? 0) * matchedPkg.trans_oil_cost_per_l).toFixed(2)}</span>
                              </div>
                            )}
                            {matchedPkg.freight != null && <div className="flex justify-between text-xs text-muted"><span>Freight</span><span>${matchedPkg.freight}</span></div>}
                            {matchedPkg.scan_tool_fee != null && <div className="flex justify-between text-xs text-muted"><span>Scan tool</span><span>${matchedPkg.scan_tool_fee}</span></div>}
                            {Array.isArray(matchedPkg.included_items) && matchedPkg.included_items.length > 0 && (
                              <div className="pt-2 border-t border-border/30">
                                <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5">Included</p>
                                {matchedPkg.included_items.map((item: string, i: number) => (
                                  <div key={i} className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                                    <span>✓</span><span>{item}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {(vehicleOilType || vehicleOilCapacity) && matchedPkg.pkg_type === 'standard' && (
                              <div className="flex items-center gap-2 py-1 px-2 rounded-lg bg-torqued-red/5 border border-torqued-red/20 mt-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-torqued-red">Oil Spec</span>
                                <span className="text-xs text-foreground font-medium">{vehicleOilCapacity ? `${vehicleOilCapacity}L · ` : ''}Manufacturer Approved {vehicleOilType || 'Engine Oil'}</span>
                              </div>
                            )}
                          </div>
                        ) : (() => {
                          const fp = fleetPricesRaw[id];
                          if (!fp || (fp.partsLow === 0 && fp.labourLow === 0)) return null;
                          const isFluid = id === 'transmission' || id === 'brake_fluid' || id === 'coolant_flush';
                          // oil/full(Gold)/transmission are consumable-based: real fluid cost
                          // (capacity x $/L) + real filter cost + fixed labour + an explicit fee
                          // (freight for oil/Gold, shop fee for transmission) — never a bundled guess.
                          const isConsumableService = id === 'oil' || id === 'full' || id === 'transmission';
                          if (isConsumableService && fp.filterCostHigh !== undefined) {
                            return (
                              <div className="border-t border-border/50 pt-3 space-y-1.5">
                                {fp.fluidType && (
                                  <div className="flex items-center gap-2 py-1 px-2 rounded-lg bg-torqued-red/5 border border-torqued-red/20">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-torqued-red">{id === 'transmission' ? 'Trans Fluid' : 'Oil Spec'}</span>
                                    <span className="text-xs text-foreground font-medium">{fp.fluidCapacityL ? `${fp.fluidCapacityL}L · ` : ''}{fp.fluidType}</span>
                                  </div>
                                )}
                                <div className="flex justify-between text-xs text-muted">
                                  <span>{id === 'transmission' ? 'Transmission fluid' : 'Engine oil'}{fp.fluidCapacityL ? ` (${fp.fluidCapacityL}L)` : ''}</span>
                                  <span>${fp.fluidCostHigh}</span>
                                </div>
                                <div className="flex justify-between text-xs text-muted">
                                  <span>{fp.filterName || 'Filter'}</span>
                                  <span>${fp.filterCostHigh}</span>
                                </div>
                                <div className="flex justify-between text-xs text-muted">
                                  <span>Labour{fp.labourHours ? ` (${fp.labourHours} hrs)` : ''}</span>
                                  <span>${fp.labourLow}</span>
                                </div>
                                {fp.feeAmount > 0 && (
                                  <div className="flex justify-between text-xs text-muted">
                                    <span>{fp.feeType === 'shop' ? 'Shop fee' : 'Freight'}</span>
                                    <span>${fp.feeAmount}</span>
                                  </div>
                                )}
                              </div>
                            );
                          }
                          return (
                            <div className="border-t border-border/50 pt-3 space-y-1.5">
                              {isFluid && fp.fluidType && (
                                <div className="flex justify-between text-xs text-muted">
                                  <span>Fluid ({fp.fluidType}{fp.fluidCapacityL ? ` · ${fp.fluidCapacityL}L` : ''})</span>
                                  <span>${fp.fluidCostHigh ?? fp.partsHigh}</span>
                                </div>
                              )}
                              {!isFluid && fp.partsLow > 0 && (
                                <div className="flex justify-between text-xs text-muted">
                                  <span>Parts</span>
                                  <span>${fp.partsHigh}</span>
                                </div>
                              )}
                              {fp.labourLow > 0 && (
                                <div className="flex justify-between text-xs text-muted">
                                  <span>Labour{fp.labourHours ? ` (${fp.labourHours} hrs)` : ''}</span>
                                  <span>${fp.labourLow}</span>
                                </div>
                              )}
                              {id === 'differential' && fp.shopFee > 0 && (
                                <div className="flex justify-between text-xs text-muted"><span>Shop fee</span><span>${fp.shopFee}</span></div>
                              )}
                              {(id === 'brake_fluid' || id === 'coolant_flush') && fp.sundries > 0 && (
                                <div className="flex justify-between text-xs text-muted"><span>Sundries</span><span>${fp.sundries}</span></div>
                              )}
                              {fp.indicative && (
                                <p className="text-[10px] text-muted italic">Indicative range — exact quote confirmed by workshop after inspection.</p>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}

                  {/* Water pump add-on line item */}
                  {addWaterPump && waterPump && selectedServices.includes('timing') && (
                    <div className="space-y-3 bg-orange-500/5 p-4 rounded-2xl border border-orange-500/20">
                      <div className="flex justify-between items-center text-foreground">
                        <span className="text-sm font-semibold text-orange-400">Water Pump & Thermostat Housing</span>
                        <span className="text-sm font-semibold">${waterPump.high}</span>
                      </div>
                      <div className="border-t border-orange-500/20 pt-3 space-y-1.5">
                        <div className="flex justify-between text-xs text-muted">
                          <span>Parts (pump kit + auxiliary belt)</span>
                          <span>${waterPump.partsHigh}</span>
                        </div>
                        {(waterPump as any).coolantHigh > 0 && (
                          <div className="flex justify-between text-xs text-muted">
                            <span>Coolant refill</span>
                            <span>${(waterPump as any).coolantHigh}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-xs text-muted">
                          <span>Labour (1 hr extra)</span>
                          <span>${waterPump.labourExtra}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {fleetShopFee && fleetShopFee > 0 && (
                  <div className="flex justify-between text-xs text-muted border-t border-border pt-4">
                    <span>Workshop shop fee (freight, sundries & consumables)</span>
                    <span>${fleetShopFee}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-6 border-t border-b border-border">
                  <span className="text-[10px] font-black uppercase text-muted tracking-widest">Total Estimate (incl. GST)</span>
                  {(selectedMechanic?.estimatedPrice || totalPrice) > 0
                    ? <span className="text-4xl font-black text-torqued-red tracking-tighter">${selectedMechanic?.estimatedPrice || totalPrice}</span>
                    : <span className="text-lg font-black text-muted">Confirmed by matched workshop</span>
                  }
                </div>
                {!fleetShopFee && (
                  <p className="text-[10px] text-muted italic leading-relaxed">
                    Estimates include a standard workshop fee covering freight, sundries, and consumables (e.g. rags, thread seal, drip trays) required to complete the service.
                  </p>
                )}
                {isRepairFromDiagnostic && (
                  <div className="pt-2">
                    <p className="text-[10px] text-emerald-600 font-bold bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10 italic leading-relaxed text-center">
                      * $99 Diagnostic Fee from previous visit was already paid and is excluded from this quote.
                    </p>
                  </div>
                )}

                {hasMBI && mbiStatus === 'pre-approved' && !isClaimApproved && (
                  <div className="pt-4 space-y-5 bg-emerald-500/5 p-6 rounded-3xl border border-emerald-500/10">
                    <div className="flex items-center gap-3">
                       <div className="bg-emerald-500 text-white p-1.5 rounded-lg shadow-lg shadow-emerald-500/20">
                          <CheckCircle2 size={16} />
                       </div>
                       <label className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Pre-Approved Provident Claim</label>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Claim Number</label>
                        <Input 
                          placeholder="CL-998877" 
                          value={claimNumber}
                          onChange={(e) => setClaimNumber(e.target.value)}
                          className="bg-card border-border h-12"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Date of Birth</label>
                        <Input 
                          type="text"
                          placeholder="DD/MM/YYYY" 
                          value={dob}
                          onChange={(e) => setDob(e.target.value)}
                          className="bg-card border-border h-12"
                        />
                      </div>
                    </div>

                    <Button 
                      fullWidth 
                      size="lg" 
                      className="bg-emerald-600 hover:bg-emerald-700 h-14 text-white uppercase tracking-widest text-[10px] font-black rounded-2xl shadow-xl shadow-emerald-600/20"
                      disabled={!claimNumber || !dob}
                      onClick={() => setIsClaimApproved(true)}
                    >
                      Verify & Link Claim
                    </Button>
                    
                    <p className="text-[10px] text-emerald-600/60 font-medium leading-relaxed text-center max-w-xs mx-auto">
                      Your mechatronics unit repair was pre-approved. Verifying will deduct the covered amount from your total.
                    </p>
                  </div>
                )}

                {hasMBI && mbiStatus === 'not-claimed' && (
                  <div className="pt-4 space-y-4 bg-torqued-red/5 p-6 rounded-3xl border border-torqued-red/10 italic">
                    <div className="flex items-center gap-3 mb-1">
                       <Info size={18} className="text-torqued-red" />
                       <span className="text-[10px] font-black uppercase text-torqued-red tracking-widest">Insurance Claim Required</span>
                    </div>
                    <p className="text-[10px] text-muted leading-relaxed">
                      We'll submit this $6,997 quote to Provident Insurance for approval on your behalf. Your booking will remain <span className="font-black text-torqued-red uppercase">Pending Insurance Approval</span> until processed.
                    </p>
                  </div>
                )}

                {isClaimApproved && (
                  <div className="pt-4 space-y-4">
                    <div className="p-6 bg-emerald-500 text-white rounded-3xl flex items-center justify-between shadow-2xl shadow-emerald-500/20 border-core border-background -mx-2">
                       <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase opacity-80 tracking-widest">MBI Approved</p>
                          <p className="font-black text-xl leading-none">Claim {claimNumber}</p>
                       </div>
                       <div className="text-right space-y-1">
                          <p className="text-[10px] font-black uppercase opacity-80 tracking-widest">Covered</p>
                          <p className="font-black text-xl text-emerald-100 leading-none">$6,547.00</p>
                       </div>
                    </div>
                    <div className="flex justify-between items-center px-2 pt-2">
                      <span className="text-[10px] font-black uppercase text-muted tracking-widest">Excess to Pay Today</span>
                      <span className="text-3xl font-black text-emerald-500 tracking-tighter">$450.00</span>
                    </div>
                  </div>
                )}
              </Card>

              {/* Pickup scheduling */}
              <div className="p-5 bg-card border border-border rounded-2xl space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted">Collection Schedule</p>
                {/* Same-day pickup */}
                <button
                  type="button"
                  onClick={() => setCollectNextDay(false)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${!collectNextDay ? 'border-torqued-red bg-torqued-red/5' : 'border-border bg-background/50 hover:border-torqued-red/30'}`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${!collectNextDay ? 'border-torqued-red bg-torqued-red' : 'border-border'}`}>
                      {!collectNextDay && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      {isComplexJob ? `Ready between ${samePickupWindow} on ${selectedDate}` : `Ready by ${samePickupWindow} on ${selectedDate}`}
                    </span>
                  </div>
                  <p className="text-xs text-muted pl-5">
                    {isComplexJob
                      ? `Drop off by ${dropOffDeadline}. Your workshop closes at ${mechanicClosingTime} — we'll send you an email when your vehicle is ready.`
                      : `Drop off by ${dropOffDeadline}. We'll send you an email when your vehicle is ready to collect.`}
                  </p>
                </button>
                {/* Next day option */}
                <button
                  type="button"
                  onClick={() => setCollectNextDay(true)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${collectNextDay ? 'border-torqued-red bg-torqued-red/5' : 'border-border bg-background/50 hover:border-torqued-red/30'}`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${collectNextDay ? 'border-torqued-red bg-torqued-red' : 'border-border'}`}>
                      {collectNextDay && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <span className="text-sm font-semibold text-foreground">Collect next business day instead</span>
                  </div>
                  <p className="text-xs text-muted pl-5">{nextBizDay} — between {mechanicOpeningTime} and {mechanicClosingTime}. Workshop will confirm your preferred time by email.</p>
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-widest text-muted block">Direct Secure Payments (Via Stripe)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { name: 'Credit or Debit Card', label: 'Credit or Debit Card', sublabel: '', icon: <CreditCard size={18} />, color: 'bg-blue-600', internalName: 'Credit or Debit Card' },
                      { name: 'Afterpay', label: 'Afterpay', sublabel: 'Pay in 4 Today', icon: <Repeat size={20} strokeWidth={2.5} />, color: 'bg-[#B2FCE4]', iconText: 'text-black', internalName: 'Afterpay' },
                      { name: 'Klarna', label: 'Klarna', sublabel: 'Pay in 4 Today', icon: <span className="text-base font-black italic leading-none">K.</span>, color: 'bg-[#FFB3C7]', iconText: 'text-black', internalName: 'Klarna' },
                    ].map(method => (
                      <button
                        key={method.name}
                        type="button"
                        onClick={() => setPaymentMethod(method.internalName)}
                        className={cn(
                          "p-5 border rounded-2xl flex flex-col items-center gap-3 transition-all relative group cursor-pointer",
                          paymentMethod === method.internalName ? "border-torqued-red bg-torqued-red text-white shadow-xl shadow-torqued-red/20" : "border-border bg-card hover:border-torqued-red/30"
                        )}
                      >
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110",
                          paymentMethod === method.internalName ? "bg-white text-torqued-red" : `${method.color} ${method.iconText || 'text-white'}`
                        )}>
                          {method.icon}
                        </div>
                        <span className="flex flex-col items-center gap-0.5">
                          <span className="text-[10px] font-black uppercase tracking-tight text-center">{method.label}</span>
                          {method.sublabel && <span className={cn("text-[9px] font-semibold uppercase tracking-wide text-center", paymentMethod === method.internalName ? "text-white/80" : "text-muted")}>{method.sublabel}</span>}
                        </span>
                        {paymentMethod === method.internalName && <div className="absolute top-2 right-2"><CheckCircle2 size={12} /></div>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <Button 
                fullWidth 
                size="lg" 
                disabled={!paymentMethod || isBookingLoading} 
                onClick={handleBooking} 
                className="h-16 text-lg rounded-2xl bg-torqued-red text-white shadow-2xl shadow-torqued-red/20 uppercase tracking-widest font-black flex items-center justify-center gap-3"
              >
                {isBookingLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Processing Payment...</span>
                  </>
                ) : (
                  paymentMethod === 'Finance Now' ? 'Apply for Finance Now' : 'Confirm & Secure Booking'
                )}
              </Button>
            </div>
          </motion.div>
        );
      }

      case 7: {
        const isConfirmed = latestBooking?.paymentStatus === 'confirmed';
        const isPartiallyPaid = latestBooking?.paymentStatus === 'partially_paid';
        const isAwaitingApproval = latestBooking?.paymentStatus === 'awaiting_approval';
        
        let stepTitle = "Booking Requested!";
        let stepSubtitle = "Your reservation request is submitted and pending payment approval.";
        let iconBgColor = "bg-amber-500 shadow-amber-500/40";
        let iconElement = <Clock size={56} className="text-white" />;
        
        if (isConfirmed) {
          stepTitle = "Booking Confirmed!";
          stepSubtitle = "Your workshop has been notified and your slot is locked in.";
          iconBgColor = "bg-emerald-500 shadow-emerald-500/40";
          iconElement = <CheckCircle2 size={56} className="text-white" />;
        } else if (isPartiallyPaid) {
          stepTitle = "Deposit Processed!";
          stepSubtitle = "Your payment was successful. Your slot is locked in.";
          iconBgColor = "bg-emerald-500 shadow-emerald-500/40";
          iconElement = <CheckCircle2 size={56} className="text-white" />;
        } else if (isAwaitingApproval) {
          if (latestBooking?.paymentMethod === 'Finance Now') {
            stepTitle = "Application Sent!";
            stepSubtitle = "Your Finance Now application has been submitted. Your booking is reserved pending finance approval.";
            iconBgColor = "bg-blue-500 shadow-blue-500/40";
            iconElement = <Monitor size={56} className="text-white" />;
          } else if (latestBooking?.paymentMethod === 'Provident Insurance') {
            stepTitle = "Claim Submitted!";
            stepSubtitle = "Your Provident Insurance claim details have been prepared. Your slot is reserved pending insurance clearance.";
            iconBgColor = "bg-purple-500 shadow-purple-500/40";
            iconElement = <Info size={56} className="text-white" />;
          }
        }

        return (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-12 text-center py-8"
          >
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full" />
              <div className={`relative w-28 h-28 ${iconBgColor} rounded-full flex items-center justify-center mx-auto shadow-2xl border-4 border-background`}>
                {iconElement}
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter">{stepTitle}</h2>
              <p className="text-muted text-lg">{stepSubtitle}</p>
            </div>

            <Card className="p-8 bg-card border-border text-left space-y-6 max-w-md mx-auto shadow-xl">
              <div className="flex justify-between items-center border-b border-border pb-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase text-muted tracking-widest">Workshop</p>
                  <p className="text-lg font-bold">{selectedMechanic?.name || latestBooking?.mechanicName || 'Your Workshop'}</p>
                  {selectedMechanic?.address && <p className="text-xs text-muted">{selectedMechanic.address.split(',').slice(0, 2).join(',')}</p>}
                </div>
                {selectedMechanic?.mapsUrl ? (
                  <a href={selectedMechanic.mapsUrl} target="_blank" rel="noreferrer" className="w-12 h-12 bg-background rounded-xl flex items-center justify-center border border-border hover:border-torqued-red/50 hover:bg-torqued-red/5 transition-all">
                    <MapPin size={20} className="text-torqued-red" />
                  </a>
                ) : (
                  <div className="w-12 h-12 bg-background rounded-xl flex items-center justify-center border border-border opacity-40">
                    <MapPin size={20} className="text-muted" />
                  </div>
                )}
              </div>

              {(() => {
                const svcIds = latestBooking?.serviceIds || [];
                const diagServices = svcIds.filter((id: string) => id === 'diag_inspection');
                const repairServices = svcIds.filter((id: string) => id !== 'diag_inspection');
                const isDual = diagServices.length > 0 && repairServices.length > 0;
                return (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase text-muted tracking-widest">
                      {isDual ? 'Bookings (2 jobs created)' : 'Services'}
                    </p>
                    {isDual ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 px-3 py-2 bg-background rounded-xl border border-border">
                          <span className="w-2 h-2 rounded-full bg-torqued-red shrink-0" />
                          <span className="text-xs font-bold text-foreground">Diagnostic Inspection</span>
                          <span className="ml-auto text-[10px] text-muted">Job 1</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2 bg-background rounded-xl border border-border">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          <span className="text-xs font-bold text-foreground">{repairServices.map((id: string) => SERVICES.find(s => s.id === id)?.name || id).join(', ')}</span>
                          <span className="ml-auto text-[10px] text-muted">Job 2</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm font-bold">{svcIds.map((id: string) => SERVICES.find(s => s.id === id)?.name || id).join(', ')}</p>
                    )}
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase text-muted tracking-widest">Drop-off</p>
                  <p className="text-sm font-bold">{selectedDate}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[10px] font-bold uppercase text-muted tracking-widest">Time</p>
                  <p className="text-sm font-bold">{selectedTime}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-border flex justify-between items-center">
                <p className="text-[10px] font-bold uppercase text-muted tracking-widest">Payment Info</p>
                <div className="text-right">
                  <span className="text-xs font-bold text-foreground mr-2">{latestBooking?.paymentMethod || paymentMethod}</span>
                  {isConfirmed || isPartiallyPaid ? (
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-500 px-2 py-0.5 rounded font-black uppercase">PAID</span>
                  ) : (
                    <span className="text-[10px] bg-amber-500/15 text-amber-500 px-2 py-0.5 rounded font-black uppercase">PENDING APPROVAL</span>
                  )}
                </div>
              </div>
            </Card>

            {/* Email Preview Terminal Button */}

            <div className="pt-8 space-y-6 max-w-md mx-auto">
              <Button 
                fullWidth 
                size="lg" 
                className="bg-torqued-red shadow-xl shadow-torqued-red/20 text-white text-lg h-16 rounded-2xl"
                onClick={() => {
                  setStep(1);
                  setView('dashboard');
                }}
              >
                Go to My Garage →
              </Button>
              <button 
                className="w-full text-xs font-bold uppercase tracking-[0.2em] text-muted hover:text-foreground transition-colors"
                onClick={() => {
                  setVehicle(null);
                  setRego('');
                  setStep(1);
                  setView('quote');
                }}
              >
                + Add Another Vehicle
              </button>
            </div>
          </motion.div>
        );
      }

      default:
        return null;
    }
  };

  const [isManagingGarage, setIsManagingGarage] = useState(false);
  const ARCHIVE_KEY = 'torqued_archived_regos';
  const [archivedRegos, setArchivedRegos] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]'); } catch { return []; }
  });
  const [showArchived, setShowArchived] = useState(false);
  const toggleArchive = (rego: string) => {
    setArchivedRegos(prev => {
      const next = prev.includes(rego) ? prev.filter(r => r !== rego) : [...prev, rego];
      try { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const [removingRego, setRemovingRego] = useState<string | null>(null);
  const removeVehicle = async (rego: string) => {
    if (!window.confirm(`Remove ${rego} from your account?\n\nWe'll remove this vehicle from your account. See our privacy policy to learn more about how we handle service history data.`)) return;
    setRemovingRego(rego);
    try {
      if (customerOwnerId) {
        const r = await fetch('/api/customer/remove-vehicle', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ownerId: customerOwnerId, rego }),
        });
        // 404 = already gone from DB; 403 handled by email fallback on server — either way remove locally
        if (!r.ok && r.status !== 404 && r.status !== 403) {
          const d = await r.json(); alert(d.error || 'Could not remove vehicle'); return;
        }
      }
      // Remove from local state and persisted session regardless
      const updated = garageVehicles.filter(v => v.rego !== rego);
      setGarageVehicles(updated);
      persistCustomerSession({ ownerId: customerOwnerId, email: customerEmail, rego: updated[0]?.rego ?? '', vehicles: updated });
      if (vehicle?.rego === rego) setVehicle(null);
    } catch { alert('Could not remove vehicle — try again.'); }
    finally { setRemovingRego(null); }
  };

  const loadMechanicAccess = async () => {
    setAccessLoading(true);
    try {
      const qs = new URLSearchParams();
      if (customerOwnerId) qs.set('ownerId', customerOwnerId);
      else {
        const regoList = garageVehicles.map(v => v.rego).filter(Boolean);
        if (regoList.length) qs.set('regos', regoList.join(','));
      }
      const res = await fetch(`/api/customer/mechanic-access?${qs.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMechanicAccess(data.mechanics || []);
      }
    } catch (err) {
      console.error('Failed to load mechanic access:', err);
    } finally {
      setAccessLoading(false);
    }
  };

  const revokeMechanicAccess = async (mechanicId: string) => {
    if (!confirm('Revoke this mechanic\'s access to your vehicle details and service history?\n\nThey will only regain access if you book or request another quote with them.')) return;

    try {
      const regoList = garageVehicles.map(v => v.rego).filter(Boolean);
      const res = await fetch('/api/customer/mechanic-access/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mechanicId, ownerId: customerOwnerId || undefined, regos: regoList }),
      });

      if (res.ok) {
        setMechanicAccess(prev => prev.filter(m => m.mechanicId !== mechanicId));
        alert('Access revoked. This mechanic can no longer see your data unless you request another quote from them.');
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'Failed to revoke access. Have you run roster-schema.sql in Supabase?');
      }
    } catch (err) {
      console.error('Failed to revoke mechanic access:', err);
      alert('Error revoking access.');
    }
  };

  const renderProfile = () => {
    return (
      <ProfileView
        userName={userName}
        setUserName={setUserName}
        customerEmail={customerEmail}
        customerOwnerId={customerOwnerId}
        location={location}
        setLocation={setLocation}
        user={user}
        updateProfile={updateProfile}
        rego={rego}
        vehicle={vehicle}
        garageVehicles={garageVehicles}
        passkeyCardState={passkeyCardState}
        setPasskeyCardState={setPasskeyCardState}
        mechanicAccess={mechanicAccess}
        accessLoading={accessLoading}
        loadMechanicAccess={loadMechanicAccess}
        revokeMechanicAccess={revokeMechanicAccess}
        clearCustomerSession={clearCustomerSession}
        logout={logout}
        setView={setView}
        onVehicleTransferred={(r) => {
          setGarageVehicles(prev => prev.filter(v => v.rego !== r));
          if (vehicle?.rego === r) setVehicle(null);
        }}
      />
    );
  };

  const renderDashboard = () => {
    // Gate: My Garage requires a verification (passkey or magic link) within the last 48h, on this browser
    if (!garageUnlocked) {
      return (
        <div className="max-w-md mx-auto py-10">
          <Card className="p-8 space-y-5 bg-card border-border text-center shadow-md">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-torqued-red/10 border border-torqued-red/20 flex items-center justify-center text-torqued-red"><Lock size={22} /></div>
            <div className="space-y-1.5">
              <h3 className="text-2xl font-black tracking-tight">Verify it's you</h3>
              <p className="text-sm text-muted">Access to My Garage expires after 48 hours and on new devices.</p>
            </div>
            <div className="space-y-3">
              <Input value={rego} onChange={e => setRego(e.target.value.toUpperCase())} placeholder="Number plate (e.g. RAH190)" className="text-center text-lg font-black tracking-widest" />
              {plateMatchError && <p className="text-xs text-torqued-red font-bold">{plateMatchError}</p>}
              {/* Primary: email a 6-digit verification code to the plate's registered owner */}
              <Button fullWidth className="bg-torqued-red text-white" disabled={!rego || isSearchingRego} onClick={handleRegoLookup}>
                {isSearchingRego ? 'Sending…' : 'Email me a verification code'}
              </Button>
              {/* Secondary: passkey for those who set one up. Gracefully tells you to use the code if none exists. */}
              {passkeysSupported() && (
                <button
                  type="button"
                  disabled={!rego || magicVerifying}
                  onClick={() => verifyWithPasskey(rego.toUpperCase().trim())}
                  className="w-full text-xs font-bold text-muted hover:text-foreground py-2 disabled:opacity-40"
                >
                  {magicVerifying ? 'Checking passkey…' : '🔑 Or sign in with a passkey'}
                </button>
              )}
              {passkeyError && <p className="text-xs text-torqued-red font-bold">{passkeyError}</p>}
            </div>
          </Card>
        </div>
      );
    }
    return (
      <div className="space-y-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div className="space-y-2">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter leading-tight">
              G'day, {userName || 'Sri'} 👋 <br />
            </h2>
            <div className="flex gap-2" />
          </div>
          <div className="w-12 h-12 bg-torqued-red rounded-full flex items-center justify-center text-white font-bold shadow-lg shadow-torqued-red/20 border border-border">
            {(userName || 'S').charAt(0).toUpperCase()}
          </div>
        </div>


        {/* Manage Garage Modal */}
        <AnimatePresence>
          {isManagingGarage && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsManagingGarage(false)}
                className="absolute inset-0 bg-background/90 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-md bg-card border border-border shadow-2xl rounded-3xl overflow-hidden"
              >
                <div className="p-8 space-y-8">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h3 className="text-2xl font-black tracking-tighter">My Profile</h3>
                      <p className="text-sm text-muted">Update your details and account preferences.</p>
                    </div>
                    <button
                      onClick={() => setIsManagingGarage(false)}
                      className="p-2 hover:bg-background rounded-full transition-all"
                    >
                      <Plus className="rotate-45" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-muted tracking-widest">Display Name</label>
                      <Input
                        value={userName || ''}
                        onChange={(e) => setUserName(e.target.value)}
                        className="bg-background border-border"
                        placeholder="Your name"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-muted tracking-widest">Email Address</label>
                      <Input
                        value={customerEmail || ''}
                        readOnly
                        className="bg-background border-border opacity-70 cursor-not-allowed"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-muted tracking-widest">City / Location</label>
                      <Input
                        placeholder="e.g. Dunedin, Wellington, Auckland"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="bg-background border-border"
                      />
                      <p className="text-[10px] text-muted">Used to find nearby workshops for your quotes.</p>
                    </div>
                  </div>

                  <Button
                    fullWidth
                    size="lg"
                    className="bg-torqued-red text-white h-14 rounded-2xl shadow-xl shadow-torqued-red/20 uppercase tracking-widest font-black text-[10px]"
                    onClick={async () => {
                      if (user) {
                        await updateProfile({ name: userName || 'Sri', homeLocation: location });
                      }
                      setIsManagingGarage(false);
                    }}
                  >
                    Save Changes
                  </Button>

                  {/* Passkey */}
                  {passkeysSupported() && passkeyCardState !== 'added' && (
                    <div className="border-t border-border pt-5 space-y-3">
                      <p className="text-[10px] font-black uppercase text-muted tracking-widest">Security</p>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-bold">🔑 Passkey (passkey)</p>
                          <p className="text-xs text-muted mt-0.5">{passkeyCardState === 'error' ? 'Could not add — try again.' : 'Skip the email link next time.'}</p>
                        </div>
                        <Button size="sm" className="bg-torqued-red text-white shrink-0" disabled={passkeyCardState === 'adding'} onClick={async () => {
                          const plate = (rego || vehicle?.rego || garageVehicles[0]?.rego || '').toUpperCase();
                          if (!plate) return;
                          setPasskeyCardState('adding');
                          try { await registerPasskey('customer', customerEmail || plate); setPasskeyCardState('added'); }
                          catch { setPasskeyCardState('error'); }
                        }}>{passkeyCardState === 'adding' ? 'Adding…' : 'Add passkey'}</Button>
                      </div>
                    </div>
                  )}

                  {/* Sign out */}
                  <div className="border-t border-border pt-4">
                    <Button
                      fullWidth
                      variant="ghost"
                      className="text-muted hover:text-torqued-red hover:bg-torqued-red/5 border border-border text-sm font-bold"
                      onClick={() => {
                        clearCustomerSession();
                        logout();
                        setIsManagingGarage(false);
                      }}
                    >
                      Sign Out
                    </Button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <div className="space-y-6">
          <section className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-bold tracking-tight">My Vehicles</h3>
            </div>

            {vehicle && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted">Currently viewing:</span>
                <span className="font-black text-foreground">{vehicle.make} {vehicle.model}</span>
                <span className="torqued-badge text-[10px]">{vehicle.rego}</span>
              </div>
            )}

            <div className="space-y-3">
              {(() => {
                const base = garageVehicles.length > 0 ? garageVehicles : (vehicle ? [vehicle] : []);
                const list = base.filter(gv => showArchived ? archivedRegos.includes(gv.rego) : !archivedRegos.includes(gv.rego));
                return list.map(gv => {
                const isActive = vehicle?.rego === gv.rego;
                const isArchived = archivedRegos.includes(gv.rego);
                return (
                  <Card
                    key={gv.rego}
                    className={cn(
                      "overflow-hidden transition-all",
                      isArchived ? "opacity-60 border-border" : "liquid-glass border-border",
                      isActive ? "border-torqued-red ring-2 ring-torqued-red bg-torqued-red/5" : "hover:border-torqued-red/30"
                    )}
                  >
                    {/* Vehicle identity row — tap to select & load history */}
                    <div
                      onClick={() => !isArchived && selectGarageVehicle(gv.rego)}
                      className={cn("p-4 flex items-center gap-4", !isArchived && "cursor-pointer active:scale-[0.99]")}
                    >
                      {(() => {
                        const brandLogo = getCarBrandLogo(gv.make);
                        if (gv.thumbnail) return <img src={gv.thumbnail} alt="Car" className="w-16 h-16 rounded-xl object-cover ring-1 ring-white/10 shrink-0" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />;
                        if (brandLogo) return <div className="w-16 h-16 rounded-xl bg-card border border-border flex items-center justify-center p-2.5 shrink-0"><img src={brandLogo} alt={gv.make} className="w-full h-full object-contain" /></div>;
                        return <div className="w-16 h-16 rounded-xl bg-card flex items-center justify-center ring-1 ring-white/10 shrink-0"><Car size={24} className="text-muted" /></div>;
                      })()}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="torqued-badge text-[10px]">{gv.rego}</div>
                          {isActive && <span className="text-[9px] font-black uppercase bg-torqued-red text-white px-2 py-0.5 rounded-full tracking-widest">✓ Viewing</span>}
                        </div>
                        <h4 className="text-base leading-tight font-bold truncate">{gv.year} {gv.make} {gv.model}</h4>
                        {gv.variant && <p className="text-xs text-muted mt-0.5 truncate">{gv.variant}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleArchive(gv.rego); }}
                          className="text-[10px] font-bold uppercase tracking-widest text-muted hover:text-torqued-red px-2"
                        >{isArchived ? 'Restore' : 'Archive'}</button>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeVehicle(gv.rego); }}
                          disabled={removingRego === gv.rego}
                          className="text-[10px] font-bold uppercase tracking-widest text-muted hover:text-torqued-red px-2 disabled:opacity-40"
                        >{removingRego === gv.rego ? '…' : 'Remove'}</button>
                      </div>
                    </div>
                    {/* Get a Quote CTA — only on active (non-archived) vehicles */}
                    {!isArchived && (
                      <div className="px-4 pb-4">
                        <button
                          onClick={async () => {
                            setRego(gv.rego);
                            setSelectedServices([]);
                            setStep(1);
                            await loadVehicleByRego(gv.rego);
                            setView('quote');
                          }}
                          className="w-full py-2.5 rounded-xl bg-torqued-red text-white text-sm font-black tracking-tight hover:bg-red-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                          <Wrench size={14} /> Get a Quote
                        </button>
                      </div>
                    )}
                  </Card>
                );
                });
              })()}

              {garageVehicles.length === 0 && !vehicle && (
                <p className="text-sm text-muted text-center py-4">No vehicles yet. Add one below to start tracking its history.</p>
              )}

              {archivedRegos.length > 0 && (
                <button onClick={() => setShowArchived(s => !s)} className="w-full text-xs font-bold text-muted hover:text-foreground py-2">
                  {showArchived ? '← Back to active vehicles' : `View archived (${archivedRegos.length})`}
                </button>
              )}

              <button
                onClick={() => {
                  setVehicle(null);
                  setRego('');
                  setVehiclePrices({});
                  setStep(1);
                  setView('quote');
                }}
                className="w-full p-4 border border-dashed border-border rounded-2xl flex items-center justify-center gap-2 text-muted hover:text-foreground hover:border-border/80 hover:bg-card transition-all text-sm font-bold active:scale-[0.98]"
              >
                <Plus size={16} /> Add Another Vehicle
              </button>
            </div>
          </section>

              {/* Vehicle Health */}
              <section className="space-y-4">
                <div className="flex justify-between items-center gap-3">
                  <div>
                    <h3 className="text-2xl font-bold tracking-tight">Vehicle Health</h3>
                    {vehicle && <p className="text-xs text-muted mt-0.5">{vehicle.year} {vehicle.make} {vehicle.model}</p>}
                  </div>
                  <div className="flex gap-2">
                    <input id="history-upload-input" type="file" accept="image/*,application/pdf" multiple className="hidden"
                      onChange={(e) => { handleMultiUpload(Array.from(e.target.files || [])); e.target.value = ''; }} />
                    <button
                      className="flex items-center gap-1 px-3 py-1 rounded-lg border border-torqued-red/30 text-torqued-red text-[11px] font-bold hover:bg-torqued-red/5 transition-colors"
                      onClick={() => setShowHistorySheet(true)}>
                      Review / Edit
                    </button>
                  </div>
                </div>

                {/* AI health cards */}
                {!vehicle ? (
                  <Card className="p-6 bg-card border-border text-center text-sm text-muted italic">Select a vehicle above to see personalised service recommendations.</Card>
                ) : healthLoading ? (
                  <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-16 rounded-2xl bg-card animate-pulse" />
                    ))}
                  </div>
                ) : healthInsights.length === 0 ? (
                  <Card className="p-6 bg-card border-border text-center space-y-2">
                    <p className="text-sm text-muted">Could not load vehicle health insights.</p>
                    <p className="text-xs text-muted/60">This may be a temporary issue — try refreshing the page.</p>
                  </Card>
                ) : (
                  <div className="space-y-3">
                  {!healthHasHistory && (
                    <Card className="p-4 border-amber-500/20 bg-amber-500/5">
                      <p className="text-sm text-amber-400 font-medium">No service history on file for this vehicle — insights are estimated from vehicle age and mileage. <button onClick={() => setShowHistorySheet(true)} className="underline font-bold">Add a record</button> to improve accuracy.</p>
                    </Card>
                  )}
                  {/* Sort: overdue → due → good/info. Actionable items first. */}
                  {(() => {
                    const sevOrder = { overdue: 0, due: 1, good: 2, info: 3 };
                    const sorted = [...healthInsights].sort((a, b) => (sevOrder[a.severity as keyof typeof sevOrder] ?? 3) - (sevOrder[b.severity as keyof typeof sevOrder] ?? 3));
                    const LIMIT = 6;
                    const visible = showAllInsights ? sorted : sorted.slice(0, LIMIT);
                    return (
                      <>
                        <div className="space-y-3">
                          {visible.map((insight, i) => {
                            const isGood     = insight.severity === 'good';
                            const isDue      = insight.severity === 'due';
                            const isOverdue  = insight.severity === 'overdue';
                            return (
                              <Card
                                key={i}
                                className={cn(
                                  "p-4 flex items-start gap-3 border transition-all",
                                  isGood    && "border-emerald-500/20 bg-emerald-500/5",
                                  isDue     && "border-amber-500/20 bg-amber-500/5",
                                  isOverdue && "border-torqued-red/30 bg-torqued-red/5",
                                  !isGood && !isDue && !isOverdue && "border-border bg-card"
                                )}
                              >
                                <div className={cn(
                                  "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-base",
                                  isGood    && "bg-emerald-500/15",
                                  isDue     && "bg-amber-500/15",
                                  isOverdue && "bg-torqued-red/15",
                                  !isGood && !isDue && !isOverdue && "bg-card"
                                )}>
                                  {isGood ? '✓' : isOverdue ? '⚠' : isDue ? '🔔' : 'ℹ'}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className={cn(
                                    "text-sm font-bold leading-tight",
                                    isGood    && "text-emerald-400",
                                    isDue     && "text-amber-400",
                                    isOverdue && "text-torqued-red",
                                  )}>{insight.title}</p>
                                  <p className="text-xs text-muted mt-0.5 leading-snug">{insight.detail}</p>
                                </div>
                                {(isDue || isOverdue) && (
                                  <button
                                    onClick={async () => {
                                      const sid = insightToServiceId(insight.title);
                                      setRego(vehicle.rego);
                                      setSelectedServices(sid ? [sid] : []);
                                      setStep(sid ? 2 : 1);
                                      await loadVehicleByRego(vehicle.rego);
                                      setView('quote');
                                    }}
                                    className="shrink-0 text-[10px] font-black uppercase tracking-widest text-torqued-red hover:underline"
                                  >Book →</button>
                                )}
                              </Card>
                            );
                          })}
                        </div>
                        {sorted.length > LIMIT && (
                          <button
                            onClick={() => setShowAllInsights(v => !v)}
                            className="w-full py-2.5 text-xs font-bold text-muted hover:text-foreground border border-dashed border-border rounded-xl transition-colors"
                          >
                            {showAllInsights ? 'Show less ↑' : `See ${sorted.length - LIMIT} more insight${sorted.length - LIMIT !== 1 ? 's' : ''} ↓`}
                          </button>
                        )}
                        {/* AI disclaimer */}
                        <div className="flex items-start gap-2 px-3 py-2.5 bg-card rounded-xl border border-border">
                          <span className="text-muted text-[11px] shrink-0 mt-0.5">ℹ</span>
                          <p className="text-[11px] text-muted leading-relaxed">
                            These insights are generated by AI and may not be fully accurate.{' '}
                            <button onClick={() => setShowHistorySheet(true)} className="underline font-bold text-foreground/70 hover:text-foreground">View your service history in-full</button>
                          </p>
                        </div>
                      </>
                    );
                  })()}
                  </div>
                )}

                {/* History log — managed via the Service History sheet (Review / Edit button) */}
                {false && manualHistory.length > 0 && (
                  <details className="group">
                    <summary className="cursor-pointer text-xs font-bold text-muted hover:text-foreground py-1 list-none flex items-center gap-1">
                      <span className="group-open:hidden">▸</span>
                      <span className="hidden group-open:inline">▾</span>
                      View full service log ({manualHistory.length} record{manualHistory.length !== 1 ? 's' : ''})
                    </summary>
                    <div className="space-y-2 mt-3">
                      {[...manualHistory].sort((a, b) => parseServiceDate(b.date) - parseServiceDate(a.date)).map((history, idx) => {
                        const originalIdx = manualHistory.indexOf(history);
                        const headline = histSummaries[history.service] || history.service;
                        const isTorqued = history.source_type === 'torqued_job';
                        const isAI = history.source_type === 'ai_autoscan';
                        const isEditing = editingLogIdx === idx;
                        return (
                          <Card key={idx} className="p-3 bg-card border-border space-y-3">
                            {isEditing ? (
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  <Input label="Date" placeholder="E.g. Oct 14th 2025" className="bg-background text-xs" value={editLogDate} onChange={e => setEditLogDate(e.target.value)} />
                                  <Input label="Mileage (km)" placeholder="E.g. 103,000" className="bg-background text-xs" value={editLogMileage} onChange={e => setEditLogMileage(e.target.value)} />
                                </div>
                                <Input label="Service Performed" placeholder="Oil change..." className="bg-background text-xs" value={editLogService} onChange={e => setEditLogService(e.target.value)} />
                                <div className="grid grid-cols-2 gap-2">
                                  <Input label="Provider" placeholder="Workshop name" className="bg-background text-xs" value={editLogProvider} onChange={e => setEditLogProvider(e.target.value)} />
                                  <Input label="Price" placeholder="E.g. $150" className="bg-background text-xs" value={editLogPrice} onChange={e => setEditLogPrice(e.target.value)} />
                                </div>
                                <Input label="Notes (Optional)" placeholder="Any extra details" className="bg-background text-xs" value={editLogNotes} onChange={e => setEditLogNotes(e.target.value)} />
                                <div className="flex gap-2 pt-1">
                                  <button
                                    onClick={async () => {
                                      const updated = { ...history, date: editLogDate, service: editLogService, provider: editLogProvider, mileage: editLogMileage, price: editLogPrice, notes: editLogNotes };
                                      setManualHistory(prev => prev.map((h, i) => i === originalIdx ? updated : h));
                                      setEditingLogIdx(null);
                                      if (history.id) {
                                        await fetch('/api/customer/update-history', {
                                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ id: history.id, fields: { date: editLogDate, service: editLogService, provider: editLogProvider, mileage: editLogMileage, price: editLogPrice, notes: editLogNotes } }),
                                        }).catch(() => {});
                                      }
                                    }}
                                    className="flex-1 py-1.5 bg-torqued-red text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-all"
                                  >Save Changes</button>
                                  <button onClick={() => setEditingLogIdx(null)} className="px-3 py-1.5 border border-border text-xs font-bold rounded-lg hover:bg-card transition-all">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 min-w-0">
                                  <Clock size={14} className="text-muted shrink-0 mt-0.5" />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="text-xs font-bold truncate">{headline}</p>
                                      {isTorqued && <span className="text-[9px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded">Torqued Completed Job</span>}
                                      {isAI && <span className="text-[9px] font-bold uppercase tracking-widest bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded">AI Autoscan</span>}
                                      {!isTorqued && !isAI && <span className="text-[9px] font-bold uppercase tracking-widest bg-muted/10 text-muted px-1.5 py-0.5 rounded">Manual Entry</span>}
                                    </div>
                                    <p className="text-[10px] text-muted">{history.date}{history.provider ? ` · ${history.provider}` : ''}</p>
                                  </div>
                                </div>
                                <div className="flex items-start gap-2 shrink-0">
                                  <div className="text-right">
                                    {history.mileage && <p className="text-[10px] font-mono text-muted">{Number(history.mileage).toLocaleString()} km</p>}
                                    {history.price && <p className="text-xs font-bold text-torqued-red">{String(history.price).startsWith('$') ? history.price : `$${history.price}`}</p>}
                                  </div>
                                  {!isTorqued && (
                                    <>
                                      <button
                                        onClick={() => {
                                          setEditingLogIdx(idx);
                                          setEditLogDate(history.date || '');
                                          setEditLogService(history.service || '');
                                          setEditLogProvider(history.provider || '');
                                          setEditLogMileage(history.mileage || '');
                                          setEditLogPrice(history.price || '');
                                          setEditLogNotes(history.notes || '');
                                        }}
                                        className="p-1 hover:bg-card rounded text-muted hover:text-foreground transition-colors"
                                        title="Edit record"
                                      >
                                        <Edit2 size={11} />
                                      </button>
                                      <button
                                        onClick={() => setManualHistory(prev => prev.filter((_, i) => i !== originalIdx))}
                                        className="p-1 hover:bg-torqued-red/10 rounded text-muted hover:text-torqued-red transition-colors"
                                        title="Delete record"
                                      >
                                        <Plus size={11} className="rotate-45" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </Card>
                        );
                      })}
                    </div>
                  </details>
                )}
              </section>


          <section className="space-y-6">
            {(() => {
              const sortByDate = (a: Job, b: Job) => (new Date(b.date || '').getTime() || 0) - (new Date(a.date || '').getTime() || 0);
              // Only show jobs for the currently selected vehicle
              const currentVehicleRego = vehicle?.rego?.toUpperCase();
              const vehicleJobs = currentVehicleRego
                ? activeJobs.filter(j => {
                    const jobRego = ((j as any).vehicle_rego || j.vehicleId || '').toUpperCase();
                    return !jobRego || jobRego === currentVehicleRego;
                  })
                : activeJobs;
              const upcomingJobs = vehicleJobs.filter(j => j.status !== 'completed').sort(sortByDate);
              const pastJobs = vehicleJobs.filter(j => j.status === 'completed').sort(sortByDate);
              const visibleJobs = jobsView === 'past' ? pastJobs : upcomingJobs;
              return (
            <>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="text-2xl font-bold tracking-tight">My Jobs</h3>
              <div className="flex rounded-xl border border-border overflow-hidden text-xs font-black">
                <button type="button" onClick={() => setJobsView('active')} className={`px-4 py-2 transition-all ${jobsView === 'active' ? 'bg-torqued-red text-white' : 'bg-card text-muted hover:text-foreground'}`}>Upcoming{upcomingJobs.length ? ` (${upcomingJobs.length})` : ''}</button>
                <button type="button" onClick={() => setJobsView('past')} className={`px-4 py-2 transition-all ${jobsView === 'past' ? 'bg-torqued-red text-white' : 'bg-card text-muted hover:text-foreground'}`}>Completed{pastJobs.length ? ` (${pastJobs.length})` : ''}</button>
              </div>
            </div>
            {visibleJobs.length === 0 ? (
              <Card className="p-12 text-center text-muted italic bg-card border-border">{jobsView === 'past' ? 'No completed jobs yet.' : 'No upcoming jobs. Book a service to see it here.'}</Card>
            ) : (
              visibleJobs.map(job => (
                <Card key={job.id} className="p-6 space-y-6 bg-card border-border">
                  <div className="flex justify-between items-start">
                    <div>
                      {(() => {
                        const isDiag = job.serviceIds.length === 1 && job.serviceIds[0] === 'diag_inspection';
                        const qi = (job as any).quoteItems || jobDetail[job.id]?.quoteItems;
                        if (qi) {
                          const isEVQuote = (job.description || '').startsWith('[EV Quote Request]');
                          const rawDesc = isEVQuote ? (job.description || '').replace('[EV Quote Request] ', '') : null;
                          const quoteTitle = isEVQuote ? (rawDesc || summariseQuote(qi, false)) : summariseQuote(qi, isDiag);
                          const isPaid = job.paymentStatus === 'confirmed';
                          const isCompleted = job.status === 'completed';
                          const subLine = isCompleted ? null : isPaid ? '✓ Booked, scheduled & paid'
                            : isEVQuote ? '✓ Quote ready — no inspection fee'
                            : isDiag ? '✓ Diagnostic inspection complete'
                            : '✓ Your quote is ready';
                          const jobRego = ((job as any).vehicle_rego || job.vehicleId || vehicle?.rego || '').toUpperCase();
                          const jobVehicle = garageVehicles.find(gv => gv.rego?.toUpperCase() === jobRego) || (vehicle?.rego?.toUpperCase() === jobRego ? vehicle : null);
                          const vehicleLabel = jobVehicle ? [jobVehicle.year, jobVehicle.make, jobVehicle.model, (jobVehicle as any).variant || null].filter(Boolean).join(' ') : '';
                          const vehicleMileage = jobVehicle?.mileage ? `${Number(jobVehicle.mileage).toLocaleString()} km` : '';
                          return (
                            <div className="space-y-0.5">
                              <h4 className="text-xl font-bold tracking-tight">{quoteTitle}</h4>
                              {jobRego && <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{jobRego}{vehicleLabel ? ` · ${vehicleLabel}` : ''}{vehicleMileage ? ` · ${vehicleMileage}` : ''}</p>}
                              {subLine && <p className="text-xs text-emerald-500 font-bold">{subLine}</p>}
                            </div>
                          );
                        }
                        return (() => {
                          const isCompleted = job.status === 'completed';
                          const jobTotal = jobDetail[job.id]?.total || (job as any).totalPrice || (job as any).quotedPrice;
                          const isEVQuote = (job.description || '').startsWith('[EV Quote Request]');
                          const names = isEVQuote ? 'Quote Pending' : job.serviceIds.map(id => SERVICES.find(s => s.id === id)?.name || id).join(' & ') || 'Torqued Service';
                          const jobRego2 = ((job as any).vehicle_rego || job.vehicleId || vehicle?.rego || '').toUpperCase();
                          const jobVehicle2 = garageVehicles.find(gv => gv.rego?.toUpperCase() === jobRego2) || (vehicle?.rego?.toUpperCase() === jobRego2 ? vehicle : null);
                          const vehicleLabel2 = jobVehicle2 ? [jobVehicle2.year, jobVehicle2.make, jobVehicle2.model, (jobVehicle2 as any).variant || null].filter(Boolean).join(' ') : '';
                          const vehicleMileage2 = jobVehicle2?.mileage ? `${Number(jobVehicle2.mileage).toLocaleString()} km` : '';
                          return (
                            <div className="space-y-0.5">
                              <h4 className="text-xl font-bold tracking-tight">{names}</h4>
                              {jobRego2 && <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{jobRego2}{vehicleLabel2 ? ` · ${vehicleLabel2}` : ''}{vehicleMileage2 ? ` · ${vehicleMileage2}` : ''}</p>}
                              {isEVQuote && <p className="text-xs text-amber-400 font-bold">Your mechanic will review and send you a price.</p>}
                              {!isEVQuote && jobTotal > 0 && <p className="text-xs text-muted font-bold">${Number(jobTotal).toFixed(2)} {isCompleted ? '· Completed' : ''}</p>}
                            </div>
                          );
                        })();
                      })()}
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <span>at {(job as any).mechanicName || realMechanics.find(m => m.id === job.mechanicId)?.name || 'your workshop'}</span>
                        {!(job.description || '').startsWith('[EV Quote Request]') && (
                          <>
                            <span>•</span>
                            {isEditingDate === job.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="date"
                                  className="bg-background border border-border rounded-xl px-2 py-1 outline-none text-foreground text-[10px] focus:border-torqued-red transition-all"
                                  value={newDate}
                                  onChange={(e) => setNewDate(e.target.value)}
                                />
                                <button onClick={() => {
                                  setActiveJobs(prev => prev.map(j => j.id === job.id ? { ...j, date: newDate } : j));
                                  setIsEditingDate(null);
                                }} className="text-torqued-red font-bold">Save</button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <span>{job.date ? (() => { const d = new Date(job.date); return isNaN(d.getTime()) ? job.date : d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }); })() : 'TBC'}</span>
                                <button onClick={() => {
                                  setIsEditingDate(job.id);
                                  setNewDate(job.date);
                                }} className="p-1 hover:bg-background rounded">
                                  <Edit2 size={12} className="text-muted" />
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    {job.status !== 'completed' && (
                      <div className="text-right">
                        <span className={cn(
                          "text-[10px] font-bold uppercase px-2 py-1 rounded",
                          job.paymentStatus === 'confirmed' ? "bg-emerald-500/10 text-emerald-400" :
                          job.paymentStatus === 'awaiting_approval' ? "bg-indigo-500/10 text-indigo-400" :
                          (job.description || '').startsWith('[EV Quote Request]') ? "bg-amber-500/10 text-amber-400" :
                          "bg-torqued-red/10 text-torqued-red"
                        )}>
                          {job.paymentStatus === 'confirmed' ? 'Confirmed' :
                           job.paymentStatus === 'awaiting_approval' ? 'Pending Approval' :
                           job.paymentStatus === 'partially_paid' ? 'Partially Paid' :
                           (job.description || '').startsWith('[EV Quote Request]') ? 'Quote Requested' :
                           'Pending Payment'}
                        </span>
                        <p className="text-[10px] text-muted mt-1 uppercase font-bold tracking-widest">{job.paymentMethod}</p>
                      </div>
                    )}
                  </div>

                  {(() => {
                    const isDiag = job.serviceIds.includes('diag_inspection');
                    const qi = (job as any).quoteItems || jobDetail[job.id]?.quoteItems;
                    const hasQuote = !!qi;
                    const isPaid = job.paymentStatus === 'confirmed';
                    const isCompleted = job.status === 'completed';
                    // Paid & upcoming → confirmation banner
                    if (hasQuote && isPaid && !isCompleted) {
                      const dateStr = job.date ? (() => { const dt = new Date(job.date); return isNaN(dt.getTime()) ? job.date : dt.toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' }); })() : null;
                      return (
                        <div className="p-4 bg-emerald-500/8 border border-emerald-500/20 rounded-2xl flex items-start gap-3">
                          <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-foreground">Booked, scheduled & paid.</p>
                            {dateStr && <p className="text-xs text-muted">Drop off {dateStr}. We'll let you know when your vehicle is ready.</p>}
                          </div>
                        </div>
                      );
                    }
                    // Quote ready — only show for non-completed jobs
                    if (hasQuote && !isCompleted) {
                      const isEVQuote = (job.description || '').startsWith('[EV Quote Request]');
                      return (
                        <div className="p-4 bg-emerald-500/8 border border-emerald-500/20 rounded-2xl flex items-start gap-3">
                          <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-foreground">
                              {isEVQuote ? 'Your quote is ready — review and accept below.'
                               : isDiag ? 'Inspection complete — your repair quote is ready below.'
                               : 'Your quote is ready — review the details below.'}
                            </p>
                            {isDiag && !isEVQuote && <p className="text-xs text-muted">The $99 diagnostic fee has already been paid and is not included in the quote total.</p>}
                          </div>
                        </div>
                      );
                    }
                    // EV quote request — pending quote (no diag fee)
                    if (isDiag && (job.description || '').startsWith('[EV Quote Request]')) {
                      return (
                        <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex items-start gap-3">
                          <Info size={16} className="text-amber-400 mt-0.5 shrink-0" />
                          <p className="text-xs text-foreground/80 leading-relaxed">
                            <span className="font-bold">Quote request sent.</span> Your mechanic will review the work requested and send you a price. You'll receive an email when your quote is ready.
                          </p>
                        </div>
                      );
                    }
                    // Diagnostic booked but not yet quoted
                    if (isDiag) {
                      return (
                        <div className="p-4 bg-torqued-red/5 border border-torqued-red/15 rounded-2xl flex items-start gap-3">
                          <Info size={16} className="text-torqued-red mt-0.5 shrink-0" />
                          <p className="text-xs text-foreground/80 leading-relaxed">
                            <span className="font-bold">Diagnostic Inspection booked.</span> We'll let you know once the mechanic has diagnosed your vehicle, and you'll be able to review and accept your repair quote right here.
                          </p>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {(() => {
                    const isDiag = job.serviceIds.includes('diag_inspection');
                    const isEVQuotePending = (job.description || '').startsWith('[EV Quote Request]') && job.status !== 'completed';
                    if (isEVQuotePending) return null;
                    const hasQuote = !!jobDetail[job.id]?.quoteItems;
                    const progress = job.status === 'completed' ? '100%'
                      : job.status === 'in_progress' ? '50%'
                      : isDiag && hasQuote ? '66%'
                      : isDiag ? '20%'
                      : ['booked', 'accepted', 'confirmed'].includes(job.status) ? '10%'
                      : '5%';
                    return (
                      <div className="space-y-3">
                        <div className="flex justify-between text-[10px] font-bold uppercase text-muted">
                          <span>Booked</span>
                          <span>In Progress</span>
                          <span>Ready</span>
                        </div>
                        <div className="h-2 bg-border rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: progress }} className="h-full bg-torqued-red" />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Itemised quote (parts + labour) — loaded on demand from the booking detail */}
                  {(() => {
                    const d = jobDetail[job.id];
                    const qi = d?.quoteItems || (job as any).quoteItems;
                    if (!qi) return null;
                    const isDiag = job.serviceIds.includes('diag_inspection');
                    const parts = Array.isArray(qi.parts) ? qi.parts.filter((p: any) => p.name) : [];
                    const labourTotal = (qi.labourHours || 0) * (qi.labourRate || 0);
                    // Compute a fallback total if the booking detail hasn't loaded yet.
                    const computedTotal = parts.reduce((s: number, p: any) => s + (p.unitPrice || 0) * (p.qty || 1), 0)
                      + labourTotal + (Number(qi.shopFee) || 0)
                      + (Array.isArray(qi.other) ? qi.other.reduce((s: number, o: any) => s + (o.amount || 0), 0) : 0)
                      - (qi.discount || 0);
                    const displayTotal = d?.total > 0 ? d.total : computedTotal;
                    return (
                      <div className="pt-4 border-t border-border space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted">Itemised Quote</p>
                        {parts.length === 0 && labourTotal === 0 ? (
                          // Flat quote — mechanic set a total without a parts breakdown
                          <div className="flex justify-between text-xs">
                            <span className="text-foreground/80">{job.serviceIds.map((id: string) => SERVICES.find(s => s.id === id)?.name || id).join(' & ') || 'Workshop Service'}</span>
                            <span className="font-mono">{displayTotal > 0 ? `$${Number(displayTotal).toFixed(2)}` : '—'}</span>
                          </div>
                        ) : (
                          <>
                            {parts.map((p: any, i: number) => (
                              <div key={i} className="flex justify-between text-xs">
                                <span className="text-foreground/80">{p.name}{p.qty > 1 ? ` ×${p.qty}` : ''}</span>
                                <span className="font-mono">${((p.unitPrice || 0) * (p.qty || 1)).toFixed(2)}</span>
                              </div>
                            ))}
                            {labourTotal > 0 && (
                              <div className="flex justify-between text-xs">
                                <span className="text-foreground/80">Labour ({qi.labourHours}h @ ${qi.labourRate}/hr)</span>
                                <span className="font-mono">${labourTotal.toFixed(2)}</span>
                              </div>
                            )}
                            {qi.shopFee > 0 && (
                              <div className="flex justify-between text-xs">
                                <span className="text-foreground/80">Workshop fee</span>
                                <span className="font-mono">${Number(qi.shopFee).toFixed(2)}</span>
                              </div>
                            )}
                          </>
                        )}
                        {displayTotal > 0 && (
                          <div className="flex justify-between text-sm font-bold pt-2 border-t border-border">
                            <span>Total (GST incl.)</span>
                            <span className="text-torqued-red font-mono">${Number(displayTotal).toFixed(2)}</span>
                          </div>
                        )}
                        {!displayTotal && (
                          <p className="text-xs text-muted italic">Total awaiting confirmation from workshop.</p>
                        )}
                        {isDiag && (
                          <p className="text-[10px] text-muted italic pt-1">$99 diagnostic inspection fee already paid — not included above.</p>
                        )}
                        {!['confirmed'].includes(job.paymentStatus) && !['completed', 'cancelled'].includes(job.status) && (
                          <Button fullWidth className="bg-torqued-red text-white mt-2" onClick={() => {
                            const amount = d?.total || (job as any).quotedPrice || job.totalPrice;
                            if (!amount) return;
                            openRepairAccept(job, amount);
                          }}>
                            {isDiag ? 'Accept & pay for this repair' : 'Accept & pay for this quote'}
                          </Button>
                        )}
                      </div>
                    );
                  })()}

                  {/* Reschedule editor (business-day date + workshop time slots, like the initial booking) */}
                  {reschedJob === job.id && (
                    <div className="pt-4 border-t border-border space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted">Reschedule drop-off</p>
                      <input type="date" min={new Date().toISOString().slice(0, 10)} value={reschedDate}
                        onChange={(e) => setReschedDate(e.target.value)}
                        className="bg-background border border-border rounded-xl px-3 py-2 outline-none text-foreground text-sm focus:border-torqued-red w-full" />
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {RESCHED_SLOTS.map(t => (
                          <button key={t} onClick={() => setReschedTime(t)}
                            className={cn("p-2 rounded-lg border text-[11px] font-bold transition-all",
                              reschedTime === t ? "border-torqued-red bg-torqued-red text-white" : "border-border bg-card text-muted hover:border-torqued-red/30")}>{t}</button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" disabled={!reschedDate || jobBusy === job.id} onClick={() => saveReschedule(job)} className="bg-torqued-red">{jobBusy === job.id ? 'Saving…' : 'Save new time'}</Button>
                        <Button size="sm" variant="ghost" onClick={() => setReschedJob(null)}>Cancel</Button>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-border flex flex-wrap gap-2 justify-end">
                    {job.status !== 'completed' && job.status !== 'cancelled' && job.paymentStatus !== 'awaiting_approval' && (
                      <Button size="sm" variant="outline"
                        className="border-border text-foreground hover:bg-background flex items-center gap-1.5 h-9 rounded-xl font-bold text-xs"
                        onClick={() => { setReschedJob(reschedJob === job.id ? null : job.id); setReschedDate((job.date || '').slice(0, 10)); loadJobDetail(job); }}>
                        <Edit2 size={14} className="text-torqued-red" /> Reschedule
                      </Button>
                    )}
                    {job.status !== 'completed' && job.status !== 'cancelled' && (
                      <Button size="sm" variant="outline"
                        className="border-border text-foreground hover:bg-background flex items-center gap-1.5 h-9 rounded-xl font-bold text-xs"
                        disabled={jobBusy === job.id}
                        onClick={() => cancelJob(job)}>
                        <X size={14} className="text-torqued-red" /> Cancel booking
                      </Button>
                    )}
                    <Button size="sm" variant="outline"
                      className="border-border text-foreground hover:bg-background flex items-center gap-1.5 h-9 rounded-xl font-bold text-xs"
                      onClick={() => generateBookingPDF(job)}>
                      <Download size={14} className="text-torqued-red" /> {(job.paymentStatus === 'confirmed' || job.status === 'completed') ? 'Download Invoice' : 'Download Quote PDF'}
                    </Button>
                    {job.serviceIds?.includes('ppi') && job.status === 'completed' && (
                      <Button size="sm" variant="outline"
                        className="border-border text-foreground hover:bg-background flex items-center gap-1.5 h-9 rounded-xl font-bold text-xs"
                        onClick={async () => {
                          const rego = (job as any).vehicleId || '';
                          const res = await fetch(`/api/customer/ppi-report?rego=${encodeURIComponent(rego)}`);
                          const d = await res.json();
                          if (!d.ppi) { alert('PPI report not found. The mechanic may not have completed the digital report yet.'); return; }
                          const ppi = d.ppi;
                          const jsPDF = (await import('jspdf')).default;
                          const doc = new jsPDF({ unit: 'mm', format: 'a4' });
                          doc.setFillColor(255, 24, 0); doc.rect(0, 30, 210, 2, 'F');
                          doc.setTextColor(21, 4, 2); doc.setFont('Helvetica', 'bold'); doc.setFontSize(11);
                          doc.text('PRE-PURCHASE INSPECTION REPORT', 195, 16, { align: 'right' });
                          doc.setFont('Helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(80, 80, 80);
                          doc.text(new Date(ppi.completed_at || ppi.created_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }), 195, 24);
                          doc.setTextColor(21, 4, 2); doc.setFontSize(9.5); doc.setFont('Helvetica', 'bold'); doc.text('VEHICLE', 15, 44);
                          doc.setFont('Helvetica', 'normal');
                          const vDesc = [ppi.make, ppi.model, ppi.submodel].filter(Boolean).join(' ');
                          if (vDesc) doc.text(vDesc, 15, 50); doc.text(String(ppi.rego || rego), 15, vDesc ? 55 : 50);
                          if (ppi.mileage) doc.text(`${Number(ppi.mileage).toLocaleString()} km`, 15, 60);
                          doc.setFont('Helvetica', 'bold'); doc.text('CUSTOMER', 115, 44);
                          doc.setFont('Helvetica', 'normal');
                          if (ppi.customer_name) doc.text(ppi.customer_name, 115, 50);
                          if (ppi.customer_email) doc.text(ppi.customer_email, 115, ppi.customer_name ? 55 : 50);
                          let y = 70;
                          const checklist = Array.isArray(ppi.checklist) ? ppi.checklist : [];
                          let lastCat = '';
                          checklist.forEach((c: any) => {
                            if (c.category !== lastCat) {
                              if (y + 14 > 280) { doc.addPage(); y = 20; }
                              doc.setFont('Helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 24, 0);
                              doc.text(c.category.toUpperCase(), 15, y); doc.setDrawColor(226, 232, 240); doc.line(15, y + 2, 195, y + 2);
                              y += 8; lastCat = c.category;
                            }
                            if (y + 6 > 280) { doc.addPage(); y = 20; }
                            doc.setFontSize(8.5); doc.setFont('Helvetica', 'normal'); doc.setTextColor(21, 4, 2);
                            doc.text(doc.splitTextToSize(c.item, 150), 15, y);
                            const stColor: [number,number,number] = c.status === 'Pass' ? [16,185,129] : c.status === 'Fail' ? [255,24,0] : c.status === 'Attention Needed' ? [217,119,6] : [120,120,120];
                            doc.setFont('Helvetica', 'bold'); doc.setTextColor(...stColor); doc.text(c.status, 195, y, { align: 'right' });
                            doc.setTextColor(21, 4, 2); y += 5;
                            if (c.note) { doc.setFont('Helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(100,100,100); doc.splitTextToSize(`— ${c.note}`, 170).forEach((l: string) => { doc.text(l, 18, y); y += 4; }); }
                          });
                          const block = (t: string, txt: string) => { if (!txt?.trim()) return; if (y + 14 > 280) { doc.addPage(); y = 20; } doc.setFont('Helvetica','bold'); doc.setFontSize(10); doc.setTextColor(255,24,0); doc.text(t, 15, y); y += 6; doc.setFont('Helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(21,4,2); doc.splitTextToSize(txt.trim(), 180).forEach((l: string) => { if (y + 5 > 280) { doc.addPage(); y = 20; } doc.text(l, 15, y); y += 4.5; }); y += 3; };
                          block("INSPECTOR'S COMMENTS", ppi.inspector_comments); block('RECOMMENDATIONS', ppi.recommendations);
                          doc.setFontSize(7.5); doc.setTextColor(150,150,150);
                          doc.text('Pre-Purchase Inspection via Torqued. A visual & functional assessment only — not a guarantee of future reliability.', 15, 285, { maxWidth: 180 });
                          doc.save(`Torqued-PPI-${String(ppi.rego || rego).toUpperCase()}.pdf`);
                        }}>
                        <Download size={14} className="text-torqued-red" /> Download PPI Report
                      </Button>
                    )}
                  </div>
                </Card>
              ))
            )}
            </>
              );
            })()}
          </section>

          {/* Ask Torqued AI — customer diagnostic assistant */}
          <section className="space-y-4">
            <Card className="p-6 bg-gradient-to-br from-torqued-red/10 to-card border-torqued-red/20 flex items-center gap-4 cursor-pointer hover:border-torqued-red/40 transition-all"
              onClick={() => setChatOpen(true)}>
              <div className="w-12 h-12 rounded-2xl bg-torqued-red/15 flex items-center justify-center shrink-0">
                <Sparkles size={22} className="text-torqued-red" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-lg font-bold">Ask Torqued AI</h4>
                <p className="text-sm text-muted">Not sure what's wrong? Describe it and get tailored help, then book.</p>
              </div>
              <ChevronRight size={20} className="text-muted shrink-0" />
            </Card>
          </section>

          {/* Pre-Purchase Inspection — routes into the standard quote flow */}
          {ppiWorkshops.length > 0 && (
            <section className="space-y-4">
              <Card className="p-6 bg-card border-border flex items-center gap-4 cursor-pointer hover:border-torqued-red/40 transition-all"
                onClick={() => { setSelectedServices(['ppi']); setStep(1); setView('quote'); }}>
                <div className="w-12 h-12 rounded-2xl bg-torqued-red/15 flex items-center justify-center shrink-0 text-xl">🔎</div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-lg font-bold">Pre-Purchase Inspection</h4>
                  <p className="text-sm text-muted">Buying a used car? Get an independent $199 inspection by a Torqued workshop.</p>
                </div>
                <ChevronRight size={20} className="text-muted shrink-0" />
              </Card>
            </section>
          )}

          {/* Sign out — always visible at the bottom of the garage */}
          {(user || customerVerifiedAt) && (
            <div className="pt-4 border-t border-border">
              <button
                onClick={async () => { clearCustomerSession(); try { await logout(); } catch {} }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-border text-sm font-bold text-muted hover:text-torqued-red hover:border-torqued-red/40 hover:bg-torqued-red/5 transition-all"
              >
                Sign Out
              </button>
            </div>
          )}

        </div>
      </div>
    );
  };

  // Full-screen standalone service-history grant page
  if (grantHistoryMode) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="flex justify-center"><Logo /></div>
          {grantState === 'loading' || grantState === 'idle' ? (
            <div className="space-y-3"><div className="w-10 h-10 border-4 border-torqued-red border-t-transparent rounded-full animate-spin mx-auto" /><p className="text-sm text-muted font-bold">Granting access…</p></div>
          ) : grantState === 'done' ? (
            <div className="bg-card border border-border rounded-3xl p-8 space-y-4 shadow-xl">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500"><CheckCircle2 size={26} /></div>
              <h2 className="text-2xl font-black tracking-tight">Access granted</h2>
              <p className="text-sm text-muted">The workshop can now view your vehicle's Torqued service history for the next 12 hours. You can close this page.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-3xl p-8 space-y-4 shadow-xl">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-torqued-red/10 border border-torqued-red/20 flex items-center justify-center text-torqued-red"><X size={26} /></div>
              <h2 className="text-2xl font-black tracking-tight">Link expired</h2>
              <p className="text-sm text-muted">This access link is invalid or has expired (links last 12 hours). Ask the workshop to send a new one.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Full-screen standalone reschedule-confirmation page — no portal chrome / rego gate
  if (rescheduleMode) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="flex justify-center"><Logo /></div>
          {rescheduleAcceptState === 'loading' || rescheduleAcceptState === 'idle' ? (
            <div className="space-y-3">
              <div className="w-10 h-10 border-4 border-torqued-red border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted font-bold">Confirming your new appointment…</p>
            </div>
          ) : rescheduleAcceptState === 'done' ? (
            <div className="bg-card border border-border rounded-3xl p-8 space-y-4 shadow-xl">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500"><CheckCircle2 size={26} /></div>
              <h2 className="text-2xl font-black tracking-tight">Reschedule confirmed</h2>
              <p className="text-sm text-muted">Your new appointment is</p>
              <p className="text-lg font-black text-torqued-red">{rescheduleAcceptDate}</p>
              <p className="text-xs text-muted">Your mechanic has been notified. You can close this page.</p>
              <Button fullWidth className="bg-torqued-red text-white mt-2" onClick={() => { window.location.href = '/customer'; }}>Go to My Garage</Button>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-3xl p-8 space-y-4 shadow-xl">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-torqued-red/10 border border-torqued-red/20 flex items-center justify-center text-torqued-red"><X size={26} /></div>
              <h2 className="text-2xl font-black tracking-tight">Couldn't confirm</h2>
              <p className="text-sm text-muted">This reschedule link may have expired or already been used. Please contact your workshop directly.</p>
              <Button fullWidth variant="outline" className="border-border text-foreground mt-2" onClick={() => { window.location.href = '/customer'; }}>Go to My Garage</Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Full-screen standalone direct-booking-link landing page — no portal chrome.
  // A mechanic's own shareable link (?book=<mechanicId>): shows their public
  // profile with a single "Book with [Name]" CTA. Confirming it proceeds into
  // the normal Step 1 flow with the mechanic-choice step silently skipped.
  if (directBookMechanicIdParam && !directBookConfirmed) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <Logo />
          {directBookError ? (
            <div className="bg-card border border-border rounded-3xl p-8 space-y-4 shadow-xl text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-torqued-red/10 border border-torqued-red/20 flex items-center justify-center text-torqued-red"><X size={26} /></div>
              <h2 className="text-2xl font-black tracking-tight">Link unavailable</h2>
              <p className="text-sm text-muted">This booking link isn't active right now. You can still book with any Torqued workshop below.</p>
              <Button fullWidth className="bg-torqued-red text-white mt-2" onClick={() => setDirectBookError(false)}>Browse All Workshops</Button>
            </div>
          ) : !directBookProfile ? (
            <div className="text-center space-y-3">
              <div className="w-10 h-10 border-4 border-torqued-red border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted font-bold">Loading workshop profile…</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-xl">
              <div className="h-28 bg-gradient-to-br from-torqued-red/20 to-background" />
              <div className="px-7 pb-7 -mt-12 space-y-5">
                <img src={directBookProfile.logo} alt={directBookProfile.name} className="w-20 h-20 rounded-2xl object-cover ring-4 ring-card shadow-lg" />
                <div className="space-y-1">
                  <h2 className="text-2xl font-black tracking-tight">{directBookProfile.name}</h2>
                  {directBookProfile.address && (
                    <p className="text-xs text-muted flex items-center gap-1"><MapPin size={12} className="text-torqued-red shrink-0" />{directBookProfile.address}</p>
                  )}
                  <div className="flex items-center gap-1.5 pt-1">
                    <Star size={13} className="text-yellow-400 fill-current" />
                    <span className="text-sm font-bold">{directBookProfile.rating}</span>
                    <span className="text-xs text-muted">({directBookProfile.reviews} reviews)</span>
                  </div>
                </div>
                <p className="text-xs text-muted leading-relaxed border-t border-border pt-4">
                  You've been invited to book directly with <span className="text-foreground font-semibold">{directBookProfile.name}</span>. Your quote and job will go straight to this workshop — no need to choose from a list.
                </p>
                <Button fullWidth size="lg" className="bg-torqued-red text-white h-14 rounded-2xl shadow-xl shadow-torqued-red/10" onClick={() => setDirectBookConfirmed(true)}>
                  Book with {directBookProfile.name} →
                </Button>
                <button
                  className="w-full text-center text-xs text-muted hover:text-foreground underline"
                  onClick={() => setDirectBookProfile(null)}
                >
                  Not what you're after? Browse all workshops instead
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Full-screen standalone quote page — no portal chrome
  if (quoteOnlyMode) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <Logo />
          {!quoteReview ? (
            <div className="text-center space-y-3">
              <div className="w-10 h-10 border-4 border-torqued-red border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted font-bold">Loading your quote…</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-3xl p-7 space-y-5 shadow-xl">
              <div className="space-y-1">
                <span className="torqued-badge text-[10px]">YOUR QUOTE IS READY</span>
                <h2 className="text-2xl font-black tracking-tight mt-2">{quoteReview.vehicleLabel || quoteReview.rego}</h2>
                {quoteReview.mechanicName && <p className="text-sm text-muted">Prepared by {quoteReview.mechanicName}</p>}
              </div>

              <div className="rounded-2xl border border-border bg-background p-4 space-y-2">
                {(quoteReview.serviceIds || []).map((id: string) => (
                  <div key={id} className="flex justify-between text-sm">
                    <span className="font-medium">{SERVICES.find(s => s.id === id)?.name || id}</span>
                    <span className="text-muted text-xs uppercase font-bold tracking-widest">Included</span>
                  </div>
                ))}
                {quoteReview.note && <p className="text-xs text-muted border-t border-border pt-2 mt-1">{quoteReview.note}</p>}
                <div className="flex justify-between items-end border-t border-border pt-3 mt-1">
                  <span className="text-xs font-black uppercase tracking-widest text-muted">Total (GST incl.)</span>
                  <span className="text-2xl font-black text-torqued-red">${Number(quoteReview.total).toFixed(2)}</span>
                </div>
              </div>

              {quoteReview.paymentStatus === 'confirmed' ? (
                <div className="text-center text-emerald-500 font-bold text-sm py-2">✓ This quote has already been paid.</div>
              ) : (
                <Button fullWidth size="lg" className="bg-torqued-red text-white" disabled={quotePaying} onClick={payQuote}>
                  {quotePaying ? 'Opening secure checkout…' : 'Review & pay securely'}
                </Button>
              )}
              <p className="text-[11px] text-muted text-center">Flexible payment options (incl. Afterpay, Klarna) at checkout.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-300 flex flex-col",
      "bg-background text-foreground"
    )}>
      <nav className="px-6 md:px-12 flex justify-between items-center h-20 sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border relative group transition-all">
        {/* Subtle top glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-torqued-red/30 to-transparent" />
        
        <button onClick={() => onBack ? onBack() : (window.location.href = '/')} className="focus:outline-none hover:opacity-80 transition-opacity">
          <Logo />
        </button>
        <div className="flex gap-4 items-center">
          <div className="hidden sm:flex bg-card p-1 rounded-xl border border-border">
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
                  <Icon size={14} />
                </button>
              );
            })}
          </div>

          <div className="flex gap-2 items-center">
            <Button
              variant="outline"
              size="sm"
              className={cn("text-[10px] font-bold uppercase tracking-widest border-border transition-all", view === 'profile' ? 'bg-torqued-red text-white border-torqued-red' : 'text-foreground hover:text-torqued-red hover:bg-card')}
              onClick={() => setView('profile')}
              title="Manage profile and permissions"
            >
              <Settings size={14} className="mr-1.5" /> Profile
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-foreground hover:text-torqued-red hover:bg-card rounded-full px-6 font-bold uppercase tracking-widest text-[10px] border-border transition-all"
              onClick={() => {
                setStep(1);
                setView(view === 'quote' ? 'dashboard' : 'quote');
              }}
            >
              {view === 'quote' ? <><Car size={16} className="mr-2" /> My Garage</> : <><Wrench size={16} className="mr-2" /> Get Quote</>}
            </Button>
          </div>
        </div>
      </nav>

      {rescheduleAcceptState !== 'idle' && (
        <div className={`w-full px-4 py-3 text-sm font-bold text-center ${rescheduleAcceptState === 'done' ? 'bg-emerald-500/10 text-emerald-600 border-b border-emerald-500/20' : rescheduleAcceptState === 'error' ? 'bg-torqued-red/10 text-torqued-red border-b border-torqued-red/20' : 'bg-muted/10 text-muted border-b border-border'}`}>
          {rescheduleAcceptState === 'loading' && 'Confirming your reschedule…'}
          {rescheduleAcceptState === 'done' && `Reschedule confirmed. New appointment: ${rescheduleAcceptDate}. Your mechanic has been notified.`}
          {rescheduleAcceptState === 'error' && 'Could not confirm reschedule — the link may have expired. Please contact us directly.'}
        </div>
      )}

      {/* Vehicle claim flow — triggered by ?claim=<token> invite link */}
      {(claimToken || claimInfo || claimDone || claimError) && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm bg-card border border-border rounded-3xl shadow-2xl p-6 space-y-5">
            <div className="text-center space-y-2">
              <div className="torqued-badge text-[10px] w-fit mx-auto mb-2">VEHICLE INVITE</div>
              {claimDone ? (
                <>
                  <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto text-white text-2xl">✓</div>
                  <h3 className="text-xl font-black tracking-tight">Vehicle claimed!</h3>
                  <p className="text-sm text-muted">It's now in your Torqued garage. You can view its full service history and get quotes.</p>
                  <button onClick={() => { setClaimToken(null); setClaimInfo(null); setClaimDone(false); setView('dashboard'); }} className="w-full mt-2 py-2.5 rounded-xl bg-torqued-red text-white text-sm font-black hover:bg-red-600 transition-all">Go to My Garage →</button>
                </>
              ) : claimError ? (
                <>
                  <h3 className="text-lg font-black tracking-tight text-torqued-red">Invite error</h3>
                  <p className="text-sm text-muted">{claimError}</p>
                </>
              ) : !claimInfo ? (
                <div className="py-6 flex flex-col items-center gap-3">
                  <div className="w-5 h-5 border-2 border-torqued-red/30 border-t-torqued-red rounded-full animate-spin" />
                  <p className="text-sm text-muted">Loading invite…</p>
                </div>
              ) : (
                <>
                  <h3 className="text-xl font-black tracking-tight">You've been sent a vehicle</h3>
                  <div className="p-3 bg-torqued-red/8 border border-torqued-red/20 rounded-xl">
                    <p className="text-sm font-bold text-foreground">{claimInfo.vehicleLabel}</p>
                    <p className="text-[10px] font-mono text-muted uppercase tracking-widest">{claimInfo.rego}</p>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">Including its full service history. To claim it, we'll send a 6-digit code to <strong className="text-foreground">{claimInfo.recipientEmail}</strong>.</p>
                  {claimOtpSent ? (
                    <div className="space-y-3 pt-2">
                      <input
                        type="tel" maxLength={6} value={claimOtp} onChange={e => setClaimOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="000000"
                        className="w-full text-center text-2xl font-black tracking-[0.4em] px-4 py-3 rounded-xl bg-background border border-border focus:outline-none focus:border-torqued-red/50"
                      />
                      {claimError && <p className="text-xs text-torqued-red font-bold">{claimError}</p>}
                      <button
                        disabled={claimLoading || claimOtp.length !== 6}
                        onClick={async () => {
                          setClaimLoading(true); setClaimError(null);
                          try {
                            // Verify OTP and get ownerId
                            const vr = await fetch('/api/otp/verify', {
                              method: 'POST', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ email: claimInfo.recipientEmail, code: claimOtp }),
                            });
                            const vd = await vr.json();
                            if (!vr.ok || !vd.ownerId) { setClaimError(vd.error || 'Incorrect code — try again.'); return; }
                            // Execute transfer claim
                            const cr = await fetch('/api/customer/claim-transfer', {
                              method: 'POST', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ token: claimToken, ownerId: vd.ownerId }),
                            });
                            const cd = await cr.json();
                            if (!cr.ok) { setClaimError(cd.error || 'Could not claim vehicle.'); return; }
                            // Bootstrap session for new user
                            setCustomerOwnerId(vd.ownerId);
                            setCustomerEmail(claimInfo.recipientEmail);
                            setCustomerVerifiedAt(Date.now());
                            persistCustomerSession({ ownerId: vd.ownerId, email: claimInfo.recipientEmail, rego: claimInfo.rego, vehicles: cd.vehicles || [] });
                            setGarageVehicles(cd.vehicles || []);
                            setClaimDone(true);
                          } catch { setClaimError('Something went wrong — please try again.'); }
                          finally { setClaimLoading(false); }
                        }}
                        className="w-full py-2.5 rounded-xl bg-torqued-red text-white text-sm font-black disabled:opacity-40 hover:bg-red-600 transition-all flex items-center justify-center gap-2"
                      >
                        {claimLoading ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Verifying…</> : 'Claim Vehicle'}
                      </button>
                    </div>
                  ) : (
                    <button
                      disabled={claimLoading}
                      onClick={async () => {
                        setClaimLoading(true); setClaimError(null);
                        try {
                          const r = await fetch('/api/otp/send', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: claimInfo.recipientEmail }),
                          });
                          const d = await r.json();
                          if (!r.ok) { setClaimError(d.error || 'Could not send code.'); return; }
                          setClaimOtpSent(true);
                        } catch { setClaimError('Network error — try again.'); }
                        finally { setClaimLoading(false); }
                      }}
                      className="w-full py-2.5 rounded-xl bg-torqued-red text-white text-sm font-black disabled:opacity-40 hover:bg-red-600 transition-all flex items-center justify-center gap-2"
                    >
                      {claimLoading ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending…</> : 'Send me a code →'}
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}

      <main className="flex-1 max-w-4xl mx-auto w-full p-6 py-8 md:py-16">
        <AnimatePresence mode="wait">
          {view === 'quote' ? renderStep() : view === 'profile' ? renderProfile() : renderDashboard()}
        </AnimatePresence>
      </main>

      {/* Load mechanic access on profile view mount */}
      <> {view === 'profile' && !accessLoading && mechanicAccess.length === 0 && (customerOwnerId || garageVehicles.length > 0) && (() => { setTimeout(loadMechanicAccess, 0); return null; })()}</>

      {/* Verification overlay for registered plates */}
      <AnimatePresence>
        {showVerificationRequired && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowVerificationRequired(false)}
              className="absolute inset-0 bg-background/90 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-card border border-border shadow-2xl rounded-3xl overflow-hidden text-center p-8 space-y-6"
            >
              <div className="w-16 h-16 bg-torqued-red/10 text-torqued-red rounded-full flex items-center justify-center mx-auto shadow-inner">
                <Lock size={32} />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-2xl font-black tracking-tighter leading-tight text-foreground">Car History Locked 🔒</h3>
                <p className="text-sm text-muted text-balance mx-auto">
                  This vehicle's records are protected on Torqued. To proceed and schedule services, verify your email login.
                </p>
              </div>

              <div className="p-4 bg-background/50 border border-border rounded-xl text-left space-y-1">
                <span className="text-[10px] uppercase font-black tracking-widest text-muted">Awaiting Verification Owner</span>
                <p className="text-xs font-bold text-foreground truncate">{verifiedEmailTarget || 'S**@g****.com'}</p>
              </div>

              <div className="space-y-3">
                <Button
                  fullWidth
                  size="lg"
                  className="bg-torqued-red text-white uppercase tracking-widest font-black text-[10px] h-12"
                  onClick={() => {
                    setShowVerificationRequired(false);
                    setTimeout(() => handleRegoLookup(), 100);
                  }}
                >
                  Try Again
                </Button>
                <Button 
                  variant="ghost" 
                  fullWidth 
                  className="text-[10px] text-muted tracking-widest uppercase font-black hover:text-foreground h-10"
                  onClick={() => setShowVerificationRequired(false)}
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Verified Review Modal */}
      <AnimatePresence>
        {reviewCtx && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-card border border-border rounded-3xl p-8 space-y-5 shadow-2xl text-center"
            >
              {reviewDone ? (
                <>
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400"><CheckCircle2 size={32} /></div>
                  <h3 className="text-2xl font-black tracking-tight">Thanks for your review!</h3>
                  <p className="text-sm text-muted">Your verified review helps other NZ drivers choose with confidence.</p>
                  <Button fullWidth className="bg-torqued-red text-white" onClick={() => { setReviewCtx(null); setReviewDone(false); }}>Done</Button>
                </>
              ) : (
                <>
                  <h3 className="text-2xl font-black tracking-tight">Rate your service</h3>
                  <p className="text-sm text-muted">How was your experience? Your review is verified against a real booking.</p>
                  <div className="flex justify-center gap-2 py-2">
                    {[1,2,3,4,5].map(n => (
                      <button key={n} onClick={() => setReviewRating(n)} className="transition-transform active:scale-90">
                        <Star size={36} className={n <= reviewRating ? 'text-yellow-400 fill-current' : 'text-muted/30'} />
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={reviewComment}
                    onChange={e => setReviewComment(e.target.value)}
                    placeholder="Tell us about the work, communication, value… (optional)"
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-torqued-red min-h-[90px]"
                  />
                  <div className="flex gap-3">
                    <Button fullWidth className="bg-torqued-red text-white" onClick={async () => {
                      try {
                        await fetch('/api/reviews/submit', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ bookingId: reviewCtx.bookingId, mechanicId: reviewCtx.mechanicId, rating: reviewRating, comment: reviewComment, email: customerEmail, name: userName }),
                        });
                        setReviewDone(true);
                      } catch {}
                    }}>Submit Review</Button>
                    <Button variant="ghost" onClick={() => setReviewCtx(null)}>Skip</Button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Customer Registration Modal */}
      <AnimatePresence>
        {showNewCustomerForm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-card border border-border rounded-3xl p-8 space-y-6 shadow-2xl"
            >
              <div className="space-y-1">
                <h3 className="text-2xl font-black tracking-tight">Welcome to Torqued</h3>
                {carjamVehicle ? (
                  <p className="text-sm text-muted">We've identified your <span className="font-semibold text-foreground">{carjamVehicle.year} {carjamVehicle.make} {carjamVehicle.model}</span>. Enter your details to create your account.</p>
                ) : (
                  <p className="text-sm text-muted">We found your plate in our system. Enter your details to create your account.</p>
                )}
              </div>

              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="First name"
                  value={newCustomerName}
                  onChange={e => setNewCustomerName(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 h-12 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-torqued-red"
                />
                <input
                  type="email"
                  placeholder="Email address"
                  value={newCustomerEmail}
                  onChange={e => setNewCustomerEmail(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 h-12 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-torqued-red"
                />
                <input
                  type="tel"
                  placeholder="Phone number (e.g. 021 123 4567)"
                  value={newCustomerPhone}
                  onChange={e => setNewCustomerPhone(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 h-12 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-torqued-red"
                />
              </div>

              {newCustomerError && (
                <p className="text-xs text-torqued-red font-bold">{newCustomerError}</p>
              )}

              <div className="flex gap-3">
                <Button
                  fullWidth
                  disabled={newCustomerLoading}
                  className="bg-torqued-red text-white"
                  onClick={async () => {
                    if (!newCustomerName || !newCustomerEmail) {
                      setNewCustomerError('Name and email are required.');
                      return;
                    }
                    setNewCustomerLoading(true);
                    setNewCustomerError(null);
                    try {
                      const res = await fetch('/api/customer/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          rego: rego.toUpperCase().trim(),
                          name: newCustomerName,
                          email: newCustomerEmail,
                          phone: newCustomerPhone,
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok) { setNewCustomerError(data.error || 'Registration failed'); return; }
                      setUserName(newCustomerName);
                      setCustomerEmail(newCustomerEmail);
                      setShowNewCustomerForm(false);
                      setMagicSentTo(data.maskedEmail || newCustomerEmail);
                      setMagicFallbackLink(data.fallbackLink || null);
                    } catch {
                      setNewCustomerError('Could not connect. Please try again.');
                    } finally {
                      setNewCustomerLoading(false);
                    }
                  }}
                >
                  {newCustomerLoading ? 'Creating account...' : 'Get Started →'}
                </Button>
                <Button variant="ghost" onClick={() => setShowNewCustomerForm(false)}>Cancel</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Magic-link verifying overlay */}
      <AnimatePresence>
        {magicVerifying && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center bg-background">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 border-4 border-torqued-red border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-muted font-bold text-sm uppercase tracking-widest">Verifying your link…</p>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual vehicle entry — shown when rego lookup returns 404 */}
      <AnimatePresence>
        {showManualVehicle && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-card border border-border rounded-3xl p-8 space-y-6 shadow-2xl"
            >
              <div className="space-y-1">
                <h3 className="text-2xl font-black tracking-tight">Enter your vehicle details</h3>
                <p className="text-sm text-muted">We couldn't find <span className="font-bold text-foreground">{rego.toUpperCase()}</span> in our registry — no worries, just fill this in and we'll get you sorted.</p>
              </div>
              <div className="space-y-3">
                <input
                  type="number"
                  placeholder="Year (e.g. 2018)"
                  min={1980} max={new Date().getFullYear() + 1}
                  value={manualYear}
                  onChange={e => setManualYear(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 h-12 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-torqued-red"
                />
                <input
                  type="text"
                  placeholder="Make (e.g. Toyota)"
                  value={manualMake}
                  onChange={e => setManualMake(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 h-12 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-torqued-red"
                />
                <input
                  type="text"
                  placeholder="Model (e.g. Corolla)"
                  value={manualModel}
                  onChange={e => setManualModel(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 h-12 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-torqued-red"
                />
                <input
                  type="text"
                  placeholder="Submodel / variant (e.g. GX, Limited — optional)"
                  value={manualSubmodel}
                  onChange={e => setManualSubmodel(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 h-12 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-torqued-red"
                />
              </div>
              {manualVehicleError && <p className="text-xs text-torqued-red font-bold">{manualVehicleError}</p>}
              <div className="flex gap-3">
                <Button variant="outline" fullWidth onClick={() => { setShowManualVehicle(false); setManualVehicleError(null); }}>Back</Button>
                <Button
                  fullWidth
                  className="bg-torqued-red text-white"
                  disabled={!manualMake || !manualModel || manualVehicleLoading}
                  onClick={async () => {
                    setManualVehicleLoading(true);
                    setManualVehicleError(null);
                    try {
                      const res = await fetch('/api/customer/manual-vehicle', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          rego: rego.toUpperCase().trim(),
                          year: manualYear ? Number(manualYear) : null,
                          make: manualMake.trim(),
                          model: manualModel.trim(),
                          submodel: manualSubmodel.trim() || null,
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok) { setManualVehicleError(data.error || 'Could not save vehicle'); return; }
                      setShowManualVehicle(false);
                      // isNew will always be true for manually entered vehicles without an owner
                      if (customerOwnerId) {
                        await loadVehicleByRego(rego.toUpperCase().trim());
                      } else {
                        setShowNewCustomerForm(true);
                      }
                    } catch {
                      setManualVehicleError('Could not connect. Please try again.');
                    } finally {
                      setManualVehicleLoading(false);
                    }
                  }}
                >
                  {manualVehicleLoading ? 'Saving…' : 'Continue →'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Batch service-history review modal */}
      <AnimatePresence>
        {showBatchReview && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 20 }}
              className="w-full max-w-2xl max-h-[88vh] overflow-y-auto bg-card border border-border rounded-3xl p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black tracking-tight">Review imported records</h3>
                  <p className="text-xs text-muted">Edit anything the AI got wrong, remove unwanted rows, then save to your vehicle.</p>
                </div>
                <button onClick={() => { if (!batchSaving) { setShowBatchReview(false); setParsedBatch([]); } }} className="text-muted hover:text-foreground text-2xl leading-none">×</button>
              </div>

              {batchProgress && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted">
                    <span>Reading files…</span><span>{batchProgress.done} / {batchProgress.total}</span>
                  </div>
                  <div className="h-1.5 bg-background rounded-full overflow-hidden"><div className="h-full bg-torqued-red transition-all" style={{ width: `${(batchProgress.done / batchProgress.total) * 100}%` }} /></div>
                </div>
              )}

              {parsedBatch.length === 0 && !batchProgress && <p className="text-sm text-muted italic text-center py-8">No records parsed.</p>}

              <div className="space-y-3">
                {parsedBatch.map(r => (
                  <div key={r.id} className="p-3 bg-background border border-border rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted/60 truncate">{r.fileName}</p>
                      <button onClick={() => removeBatchRecord(r.id)} className="text-torqued-red text-[10px] font-bold hover:underline">Remove</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={r.date} onChange={e => updateBatchRecord(r.id, 'date', e.target.value)} placeholder="Date" className="bg-card border border-border rounded-lg px-2.5 h-9 text-xs" />
                      <input value={r.mileage} onChange={e => updateBatchRecord(r.id, 'mileage', e.target.value)} placeholder="Mileage (km)" className="bg-card border border-border rounded-lg px-2.5 h-9 text-xs" />
                      <input value={r.service} onChange={e => updateBatchRecord(r.id, 'service', e.target.value)} placeholder="Work done" className="bg-card border border-border rounded-lg px-2.5 h-9 text-xs col-span-2" />
                      <input value={r.provider} onChange={e => updateBatchRecord(r.id, 'provider', e.target.value)} placeholder="Provider" className="bg-card border border-border rounded-lg px-2.5 h-9 text-xs" />
                      <input value={r.price} onChange={e => updateBatchRecord(r.id, 'price', e.target.value)} placeholder="Price" className="bg-card border border-border rounded-lg px-2.5 h-9 text-xs" />
                      <input value={r.notes} onChange={e => updateBatchRecord(r.id, 'notes', e.target.value)} placeholder="Notes" className="bg-card border border-border rounded-lg px-2.5 h-9 text-xs col-span-2" />
                    </div>
                  </div>
                ))}
              </div>

              {receiptError && <p className="text-xs text-torqued-red font-bold">{receiptError}</p>}
              <div className="flex gap-3 pt-1">
                <Button variant="ghost" fullWidth disabled={batchSaving} onClick={() => { setShowBatchReview(false); setParsedBatch([]); }}>Cancel</Button>
                <Button fullWidth className="bg-torqued-red text-white" disabled={batchSaving || !!batchProgress || parsedBatch.length === 0} onClick={saveBatch}>
                  {batchSaving ? 'Saving…' : `Save ${parsedBatch.length} record${parsedBatch.length === 1 ? '' : 's'}`}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>



      {/* Upload or Add Service History sheet */}
      <AnimatePresence>
        {showHistorySheet && (
          <div className="fixed inset-0 z-[125] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setShowHistorySheet(false); setShowHistoryEntry(false); setEditingLogIdx(null); }}>
            <motion.div
              initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
              className="w-full max-w-md bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[88vh]"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
                <div className="flex items-center gap-2">
                  {(showHistoryEntry || editingLogIdx !== null) && (
                    <button onClick={() => { setShowHistoryEntry(false); setEditingLogIdx(null); }} className="text-muted hover:text-foreground">
                      <ArrowLeft size={16} />
                    </button>
                  )}
                  <h3 className="text-lg font-black tracking-tight">
                    {editingLogIdx !== null ? 'Edit Record' : showHistoryEntry ? 'Add Record' : 'Service History'}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {!showHistoryEntry && editingLogIdx === null && (
                    <button
                      onClick={() => { setEntryDate(''); setEntryService(''); setEntryProvider(''); setEntryMileage(''); setEntryPrice(''); setEntryNotes(''); setShowHistoryEntry(true); }}
                      className="h-7 px-3 text-[10px] font-black rounded-lg bg-torqued-red/10 text-torqued-red hover:bg-torqued-red/20 transition-all flex items-center gap-1"
                    >
                      <Plus size={11} /> Enter Manually
                    </button>
                  )}
                  <button onClick={() => { setShowHistorySheet(false); setShowHistoryEntry(false); setEditingLogIdx(null); }} className="text-muted hover:text-foreground text-2xl leading-none">×</button>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto flex-1 px-6 pb-6 space-y-3">

                {/* List view */}
                {!showHistoryEntry && editingLogIdx === null && (
                  <>
                    <button
                      onClick={() => { setShowHistorySheet(false); document.getElementById('history-upload-input')?.click(); }}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl border border-dashed border-border hover:border-torqued-red/40 hover:bg-torqued-red/5 transition-all text-left"
                    >
                      <div className="w-8 h-8 rounded-xl bg-torqued-red/10 flex items-center justify-center shrink-0">
                        <Upload size={15} className="text-torqued-red" />
                      </div>
                      <div>
                        <p className="text-xs font-bold">Scan Receipt</p>
                        <p className="text-[10px] text-muted">Upload a photo or PDF — we'll extract the details automatically.</p>
                      </div>
                    </button>
                    {manualHistory.length === 0 ? (
                      <p className="text-xs text-muted text-center py-4">No records yet. Add one above.</p>
                    ) : (
                      <div className="space-y-2">
                        {[...manualHistory].sort((a, b) => parseServiceDate(b.date) - parseServiceDate(a.date)).map((item, idx) => {
                          const originalIdx = manualHistory.indexOf(item);
                          const isTorqued = item.source_type === 'torqued_job';
                          return (
                            <div key={idx} className="p-3 bg-background rounded-xl border border-border">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold truncate">{item.service}</p>
                                  <p className="text-[10px] text-muted">{item.date}{item.provider ? ` · ${item.provider}` : ''}{item.mileage ? ` · ${Number(item.mileage).toLocaleString()} km` : ''}</p>
                                  {item.price && <p className="text-[10px] font-bold text-torqued-red mt-0.5">{String(item.price).startsWith('$') ? item.price : `$${item.price}`}</p>}
                                </div>
                                {!isTorqued && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      onClick={() => { setEditingLogIdx(idx); setEditLogDate(item.date||''); setEditLogService(item.service||''); setEditLogProvider(item.provider||''); setEditLogMileage(item.mileage||''); setEditLogPrice(item.price||''); setEditLogNotes(item.notes||''); }}
                                      className="p-1.5 hover:bg-card rounded-lg text-muted hover:text-foreground transition-colors"
                                    ><Edit2 size={12} /></button>
                                    <button
                                      onClick={() => { setManualHistory(prev => prev.filter((_, i) => i !== originalIdx)); setHistoryVersion(v => v + 1); }}
                                      className="p-1.5 hover:bg-torqued-red/10 rounded-lg text-muted hover:text-torqued-red transition-colors"
                                    ><Plus size={12} className="rotate-45" /></button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {/* Add form */}
                {showHistoryEntry && editingLogIdx === null && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted">Date *</label>
                        <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)}
                          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-torqued-red transition-all" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted">Mileage (km)</label>
                        <input type="text" value={entryMileage} onChange={e => setEntryMileage(e.target.value)} placeholder="e.g. 103000"
                          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-torqued-red transition-all" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted">Service Performed *</label>
                      <input type="text" value={entryService} onChange={e => setEntryService(e.target.value)} placeholder="e.g. Oil & filter change"
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-torqued-red transition-all" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted">Provider</label>
                        <input type="text" value={entryProvider} onChange={e => setEntryProvider(e.target.value)} placeholder="e.g. Precision Mech"
                          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-torqued-red transition-all" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted">Price</label>
                        <input type="text" value={entryPrice} onChange={e => setEntryPrice(e.target.value)} placeholder="e.g. $250"
                          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-torqued-red transition-all" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted">Notes</label>
                      <input type="text" value={entryNotes} onChange={e => setEntryNotes(e.target.value)} placeholder="e.g. Full synthetic oil used"
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-torqued-red transition-all" />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button variant="ghost" size="sm" onClick={() => setShowHistoryEntry(false)}>Back</Button>
                      <Button size="sm" className="flex-1 bg-torqued-red text-white" disabled={!entryDate || !entryService} onClick={() => {
                        const newItem = { date: entryDate, service: entryService, provider: entryProvider || 'Unknown', mileage: entryMileage, price: entryPrice, notes: entryNotes };
                        setManualHistory(prev => [...prev, newItem].sort((a, b) => parseServiceDate(b.date) - parseServiceDate(a.date)));
                        setHistoryVersion(v => v + 1);
                        setShowHistoryEntry(false);
                        setEntryDate(''); setEntryService(''); setEntryProvider(''); setEntryMileage(''); setEntryPrice(''); setEntryNotes('');
                      }}>Save Record</Button>
                    </div>
                  </div>
                )}

                {/* Edit form */}
                {editingLogIdx !== null && (() => {
                  const sorted = [...manualHistory].sort((a, b) => parseServiceDate(b.date) - parseServiceDate(a.date));
                  const item = sorted[editingLogIdx];
                  const originalIdx = manualHistory.indexOf(item);
                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-muted">Date</label>
                          <input type="date" value={editLogDate} onChange={e => setEditLogDate(e.target.value)}
                            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-torqued-red transition-all" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-muted">Mileage (km)</label>
                          <input type="text" value={editLogMileage} onChange={e => setEditLogMileage(e.target.value)}
                            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-torqued-red transition-all" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted">Service Performed</label>
                        <input type="text" value={editLogService} onChange={e => setEditLogService(e.target.value)}
                          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-torqued-red transition-all" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-muted">Provider</label>
                          <input type="text" value={editLogProvider} onChange={e => setEditLogProvider(e.target.value)}
                            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-torqued-red transition-all" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-muted">Price</label>
                          <input type="text" value={editLogPrice} onChange={e => setEditLogPrice(e.target.value)}
                            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-torqued-red transition-all" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted">Notes</label>
                        <input type="text" value={editLogNotes} onChange={e => setEditLogNotes(e.target.value)}
                          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-torqued-red transition-all" />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditingLogIdx(null)}>Cancel</Button>
                        <Button size="sm" className="flex-1 bg-torqued-red text-white" onClick={async () => {
                          const updated = { ...item, date: editLogDate, service: editLogService, provider: editLogProvider, mileage: editLogMileage, price: editLogPrice, notes: editLogNotes };
                          setManualHistory(prev => prev.map((h, i) => i === originalIdx ? updated : h));
                          setHistoryVersion(v => v + 1);
                          setEditingLogIdx(null);
                          if (item.id) await fetch('/api/customer/update-history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, fields: { date: editLogDate, service: editLogService, provider: editLogProvider, mileage: editLogMileage, price: editLogPrice } }) }).catch(() => {});
                        }}>Save Changes</Button>
                      </div>
                    </div>
                  );
                })()}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Review-and-pay modal (opened from a quote QR / link) */}
      <AnimatePresence>
        {quoteReview && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 20 }}
              className="w-full max-w-md bg-card border border-border rounded-3xl p-7 space-y-5 shadow-2xl"
            >
              <div className="text-center space-y-1">
                <div className="torqued-badge text-[10px] mx-auto">YOUR QUOTE IS READY</div>
                <h3 className="text-2xl font-black tracking-tight">{quoteReview.vehicleLabel || quoteReview.rego}</h3>
                {quoteReview.mechanicName && <p className="text-sm text-muted">Prepared by {quoteReview.mechanicName}</p>}
              </div>

              <div className="rounded-2xl border border-border bg-background p-4 space-y-2">
                {(quoteReview.serviceIds || []).map((id: string) => (
                  <div key={id} className="flex justify-between text-sm">
                    <span className="font-medium">{serviceDisplayName(id, SERVICES.find(s => s.id === id)?.name || id)}</span>
                    <span className="text-muted text-xs uppercase font-bold tracking-widest">Included</span>
                  </div>
                ))}
                {quoteReview.note && <p className="text-xs text-muted border-t border-border pt-2 mt-1">{quoteReview.note}</p>}
                <div className="flex justify-between items-end border-t border-border pt-3 mt-1">
                  <span className="text-xs font-black uppercase tracking-widest text-muted">Total (GST incl.)</span>
                  <span className="text-2xl font-black text-torqued-red">${Number(quoteReview.total).toFixed(2)}</span>
                </div>
              </div>

              {quoteReview.paymentStatus === 'confirmed' ? (
                <div className="text-center text-emerald-500 font-bold text-sm">✓ This quote has already been paid.</div>
              ) : (
                <Button fullWidth size="lg" className="bg-torqued-red text-white" disabled={quotePaying} onClick={payQuote}>
                  {quotePaying ? 'Opening secure checkout…' : 'Review & pay securely'}
                </Button>
              )}
              <p className="text-[11px] text-muted text-center">Flexible payment options (incl. Afterpay, Klarna) at checkout.</p>
              <button onClick={() => setQuoteReview(null)} className="w-full text-xs text-muted hover:text-foreground">Close</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Magic-link sent modal */}
      <AnimatePresence>
        {magicSentTo && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-card border border-border rounded-3xl p-8 space-y-5 text-center shadow-2xl"
            >
              <div className="w-16 h-16 mx-auto rounded-2xl bg-torqued-red/10 border border-torqued-red/20 flex items-center justify-center text-torqued-red text-3xl">✉️</div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black tracking-tight">
                  {returningCustomerName ? `Welcome back, ${returningCustomerName}` : 'Check your email'}
                </h3>
                <p className="text-sm text-muted">
                  We've emailed a secure verification link to <span className="font-bold text-foreground">{magicSentTo}</span>. Tap it to access your vehicle — it expires in 15 minutes.
                </p>
              </div>
              {magicFallbackLink && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-left space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">Email delivery is down — use this link to continue testing:</p>
                  <a href={magicFallbackLink} className="text-xs text-torqued-red font-bold break-all underline">{magicFallbackLink}</a>
                </div>
              )}
              {passkeysSupported() && (
                <>
                  <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted/50"><span className="flex-1 h-px bg-border" />faster<span className="flex-1 h-px bg-border" /></div>
                  <Button fullWidth className="bg-torqued-red text-white" onClick={() => verifyWithPasskey(rego)}>
                    🔑 Verify instantly with passkey
                  </Button>
                  {passkeyError && <p className="text-xs text-torqued-red font-bold">{passkeyError}</p>}
                </>
              )}
              <Button variant="ghost" fullWidth onClick={() => { setMagicSentTo(null); setMagicFallbackLink(null); setPasskeyError(null); }}>Close</Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Verification Code OTP Modal */}
      <AnimatePresence>
        {ppiOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={() => !ppiBusy && setPpiOpen(false)}>
            <div onClick={e => e.stopPropagation()} className="bg-card border border-border rounded-3xl p-7 w-full max-w-md space-y-5 shadow-2xl">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-black tracking-tight text-foreground">Pre-Purchase Inspection</h3>
                  <p className="text-sm text-muted">$199 flat fee · independent inspection before you buy. Excludes high-voltage (hybrid/EV) battery testing.</p>
                </div>
                <button onClick={() => setPpiOpen(false)} className="text-muted hover:text-foreground text-xl leading-none">✕</button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">Number plate to inspect</label>
                  <input value={ppiRego} onChange={e => setPpiRego(e.target.value.toUpperCase())} placeholder="e.g. ABC123" className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm font-mono tracking-widest text-foreground outline-none focus:border-torqued-red" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">Choose a workshop</label>
                  <select value={ppiMechId} onChange={e => setPpiMechId(e.target.value)} className="w-full bg-background border border-border rounded-xl px-3 h-11 text-sm text-foreground outline-none focus:border-torqued-red">
                    {ppiWorkshops.map(m => <option key={m.id} value={m.id}>{m.name}{m.suburb ? ` · ${m.suburb}` : ''}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-border">
                <span className="text-sm font-bold text-foreground">Total</span>
                <span className="text-xl font-black text-torqued-red font-mono">$199.00</span>
              </div>
              <Button fullWidth className="bg-torqued-red text-white" disabled={ppiBusy || !ppiRego.trim() || !ppiMechId} onClick={bookPPI}>
                {ppiBusy ? 'Opening checkout…' : 'Book & pay $199 →'}
              </Button>
            </div>
          </div>
        )}

        {repairAccept && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={() => !repairBusy && setRepairAccept(null)}>
            <div onClick={e => e.stopPropagation()} className="bg-card border border-border rounded-3xl p-7 w-full max-w-md space-y-5 shadow-2xl">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h3 className="text-xl font-black tracking-tight text-foreground">Choose your drop-off</h3>
                  <p className="text-sm text-muted">Earliest dates from {(repairAccept.job as any).mechanicName || 'your workshop'}'s schedule.</p>
                  {(() => { const lead = (repairAccept.job as any).quoteItems?.leadTimeDays; return lead > 0 ? (
                    <p className="text-[11px] text-amber-400 font-bold">Parts lead time: {lead} business day{lead !== 1 ? 's' : ''} — earliest date already adjusted</p>
                  ) : null; })()}
                </div>
                <button onClick={() => setRepairAccept(null)} className="text-muted hover:text-foreground text-xl leading-none">✕</button>
              </div>
              {repairDatesLoading ? (
                <p className="text-sm text-muted italic py-2">Checking availability…</p>
              ) : repairDates.length === 0 ? (
                <p className="text-sm text-muted italic py-2">No published availability — your workshop will confirm a drop-off date after payment.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {repairDates.map((d, idx) => (
                    <button key={d.date} onClick={() => setRepairSelectedDate(d.date)}
                      className={cn('relative p-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all text-center',
                        repairSelectedDate === d.date ? 'border-torqued-red bg-torqued-red text-white' : 'border-border bg-background text-muted hover:border-torqued-red/40 hover:text-torqued-red')}>
                      {idx === 0 && <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[7px] px-1.5 py-0.5 rounded-full">Soonest</span>}
                      {d.label}
                    </button>
                  ))}
                </div>
              )}
              {repairDates.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted">Preferred drop-off time</p>
                  <div className="grid grid-cols-3 gap-2">
                    {['08:00', '09:00', '10:00', '11:00', '13:00', '14:00'].map(t => (
                      <button key={t} onClick={() => setRepairDropTime(t)}
                        className={cn('p-2 rounded-lg border text-[11px] font-black transition-all text-center',
                          repairDropTime === t ? 'border-torqued-red bg-torqued-red text-white' : 'border-border bg-background text-muted hover:border-torqued-red/40 hover:text-torqued-red')}>
                        {t}
                      </button>
                    ))}
                  </div>
                  <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/20 px-3 py-2 flex items-start gap-2">
                    <Clock size={13} className="text-emerald-500 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-foreground/80">{repairReadyEstimate(repairAccept.job, repairDropTime)}.</p>
                  </div>
                </div>
              )}
              <div className="flex justify-between items-center pt-1 border-t border-border">
                <span className="text-sm font-bold text-foreground">Total</span>
                <span className="text-xl font-black text-torqued-red font-mono">${Number(repairAccept.amount).toFixed(2)}</span>
              </div>
              <Button fullWidth className="bg-torqued-red text-white" disabled={repairBusy || repairDatesLoading} onClick={confirmRepairAccept}>
                {repairBusy ? 'Opening checkout…' : repairSelectedDate ? `Confirm ${repairDates.find(d => d.date === repairSelectedDate)?.label || ''} & pay →` : 'Confirm & pay →'}
              </Button>
            </div>
          </div>
        )}

        {showOTPModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowOTPModal(false)}
              className="absolute inset-0 bg-background/90 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-card border border-border shadow-2xl rounded-3xl overflow-hidden p-8 space-y-6 text-center"
            >
              <div className="w-16 h-16 bg-torqued-red/10 border border-torqued-red/20 text-torqued-red rounded-full flex items-center justify-center mx-auto shadow-inner animate-bounce">
                <Lock size={32} />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black tracking-tighter leading-tight text-foreground">
                  {returningCustomerName ? `Welcome back, ${returningCustomerName} 👋` : 'Check Your Email 🔐'}
                </h3>
                <p className="text-xs text-muted leading-relaxed">
                  We sent a 6-digit verification code to
                </p>
                <div className="p-3 bg-muted/40 border border-border rounded-xl">
                  <p className="text-sm font-extrabold text-foreground truncate">{otpSentEmail}</p>
                </div>
                <p className="text-[10px] text-muted leading-relaxed">
                  Enter the code from your email to continue.
                </p>
              </div>

              <div className="space-y-2 text-left">
                <label className="text-[10px] font-black uppercase text-muted tracking-widest block mb-1">6-Digit Verification Code</label>
                <Input 
                  type="text" 
                  maxLength={6}
                  placeholder="E.G. 123456" 
                  value={otpCode}
                  onChange={(e) => {
                    setOtpCode(e.target.value.replace(/\D/g, ''));
                    setOtpVerificationError('');
                  }}
                  className="text-center text-3xl font-display font-black tracking-[0.3em] h-14 bg-background border-border text-foreground dark:text-white"
                />
                {otpVerificationError && (
                  <p className="text-xs font-bold text-torqued-red mt-1">{otpVerificationError}</p>
                )}
              </div>

              <div className="space-y-3 pt-2">
                <Button
                  fullWidth
                  size="lg"
                  className="bg-torqued-red text-white uppercase tracking-widest font-black text-[10px] h-12"
                  onClick={handleConfirmOTP}
                >
                  Verify & Unlock History
                </Button>

                <div className="text-center">
                  {otpResendMsg && <p className="text-[10px] font-bold text-emerald-500 mb-1">{otpResendMsg}</p>}
                  <button
                    disabled={otpResendCooldown > 0}
                    onClick={async () => {
                      setOtpResendMsg(null);
                      setOtpVerificationError('');
                      try {
                        const r = await fetch('/api/customer/send-code', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ rego: rego.toUpperCase().trim() }),
                        });
                        const rd = await r.json();
                        if (r.ok && rd.sent) { setOtpResendMsg('New code sent — check your email.'); setOtpResendCooldown(30); }
                        else { setOtpVerificationError('Could not resend. Please try again.'); }
                      } catch {
                        setOtpVerificationError('Could not resend. Please try again.');
                      }
                    }}
                    className="text-[10px] font-black uppercase tracking-widest text-torqued-red hover:text-red-400 disabled:text-muted/40 disabled:cursor-not-allowed transition-colors"
                  >
                    {otpResendCooldown > 0 ? `Resend code in ${otpResendCooldown}s` : "Didn't get it? Resend code"}
                  </button>
                </div>

                <Button
                  variant="ghost"
                  fullWidth
                  className="text-[10px] text-muted tracking-widest uppercase font-black hover:text-foreground h-10"
                  onClick={() => {
                    setShowOTPModal(false);
                    setOtpCode('');
                    setOtpVerificationError('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Customer AI assistant chat modal */}
      <AnimatePresence>
        {chatOpen && (
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-background/80 backdrop-blur-md" onClick={() => setChatOpen(false)}>
            <motion.div
              initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-lg h-[85vh] sm:h-[640px] bg-card border border-border sm:rounded-3xl rounded-t-3xl flex flex-col overflow-hidden shadow-2xl">
              <div className="flex items-center gap-3 p-4 border-b border-border">
                <div className="w-9 h-9 rounded-xl bg-torqued-red/15 flex items-center justify-center"><Sparkles size={18} className="text-torqued-red" /></div>
                <div className="flex-1"><h3 className="font-bold leading-none">Torqued Assistant</h3><p className="text-[11px] text-muted mt-0.5">{vehicle ? `Helping with your ${vehicle.make} ${vehicle.model}` : 'Diagnostic & maintenance help'}</p></div>
                <button onClick={() => setChatOpen(false)} className="p-2 hover:bg-background rounded-lg"><X size={18} className="text-muted" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.length === 0 && (
                  <div className="space-y-3">
                    <Card className="p-4 bg-background border-border"><p className="text-sm text-muted">Tell me what's worrying you about your car, or ask a maintenance question. I can see your vehicles and service history to tailor the answer — then help you book.</p></Card>
                    {chatStarters.map(s => (
                      <button key={s} onClick={() => sendChat(s)} className="w-full text-left text-sm p-3 rounded-xl border border-border bg-background hover:border-torqued-red/30 transition-all flex items-center justify-between gap-2">
                        <span>{s}</span><ChevronRight size={16} className="text-torqued-red shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
                {chatMessages.map((m, i) => (
                  <div key={i} className={cn('flex flex-col', m.role === 'user' ? 'items-end' : 'items-start')}>
                    {m.image && (
                      <img src={m.image} alt="attached" className="max-h-36 rounded-xl object-cover mb-1 border border-border" />
                    )}
                    <div className={cn('max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap', m.role === 'user' ? 'bg-torqued-red text-white' : 'bg-background border border-border text-foreground')}>
                      {m.text}
                      {m.role === 'assistant' && i === chatMessages.length - 1 && !chatBusy && (
                        <button onClick={() => { setChatOpen(false); setView('quote'); setStep(2); }} className="mt-3 inline-flex items-center gap-1.5 bg-torqued-red text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                          <Wrench size={13} /> Book a service
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {chatBusy && <div className="flex justify-start"><div className="bg-background border border-border rounded-2xl px-4 py-3 text-sm text-muted">Thinking…</div></div>}
              </div>

              <div className="p-3 border-t border-border space-y-2">
                {chatPhoto && (
                  <div className="relative w-fit">
                    <img src={chatPhoto} alt="pending" className="h-16 rounded-xl object-cover border border-torqued-red/40" />
                    <button onClick={() => setChatPhoto(null)} className="absolute -top-1 -right-1 w-5 h-5 bg-torqued-red rounded-full flex items-center justify-center text-white text-[10px]">✕</button>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <label className="cursor-pointer flex items-center justify-center w-10 h-10 bg-background border border-border rounded-xl text-muted hover:border-torqued-red hover:text-torqued-red transition-all shrink-0">
                    <Camera size={17} />
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const f = e.target.files?.[0]; if (!f) return;
                      const reader = new FileReader();
                      reader.onload = ev => setChatPhoto(ev.target?.result as string);
                      reader.readAsDataURL(f);
                      e.target.value = '';
                    }} />
                  </label>
                  <textarea
                    value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(chatInput); } }}
                    rows={1} placeholder="Ask about your car or attach a photo…"
                    className="flex-1 resize-none bg-background border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-torqued-red text-foreground max-h-28" />
                  <button onClick={() => sendChat(chatInput)} disabled={chatBusy || (!chatInput.trim() && !chatPhoto)} className="w-10 h-10 rounded-xl bg-torqued-red text-white flex items-center justify-center disabled:opacity-40 shrink-0">
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic Email Confirmation Layout Modal */}
      <AnimatePresence>
        {showEmailModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 15 }}
              className="bg-background border border-border w-full max-w-4xl h-[88vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl relative"
            >
              {/* Header */}
              <div className="p-6 border-b border-border bg-card">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase text-torqued-red tracking-widest leading-none">Otago Service Relay Operations</span>
                    <h3 className="text-xl font-black uppercase tracking-tight text-foreground">Interactive Email & SMS Terminal</h3>
                    <p className="text-xs text-muted">Verify secure consumer dispatches and active Otago mechanic alerts.</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowEmailModal(false);
                      setTestSendStatus('idle');
                    }}
                    className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center hover:bg-background text-foreground transition-colors font-bold text-sm"
                  >
                    ✕
                  </button>
                </div>

                {/* Tab Selector */}
                <div className="flex flex-wrap items-center gap-1.5 mt-5 border-t border-border/50 pt-4">
                  {[
                    { id: 'customer', label: '1. Client Confirmation', icon: <Mail size={12} /> },
                    { id: 'mechanic', label: '2. Workshop Dispatch', icon: <Wrench size={12} /> },
                    { id: 'dropoff', label: '3. 12h Dropoff Alert', icon: <Clock size={12} /> },
                    { id: 'service', label: '4. Service Reminder', icon: <Info size={12} /> },
                    { id: 'sms', label: '5. SMS Secure Notice', icon: <Smartphone size={12} /> },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setSelectedEmailTab(tab.id as any);
                        setTestSendStatus('idle');
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all",
                        selectedEmailTab === tab.id
                          ? "bg-torqued-red text-white shadow-md shadow-torqued-red/10"
                          : "bg-background text-muted hover:text-foreground hover:bg-muted border border-border/80"
                      )}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* View Content Canvas */}
              <div className="flex-1 bg-zinc-100 p-2 overflow-hidden relative dark:bg-zinc-950">
                {selectedEmailTab === 'sms' ? (
                  <div className="flex items-center justify-center h-full bg-zinc-200 p-4 dark:bg-zinc-900 rounded-2xl overflow-y-auto">
                    <div className="w-full max-w-xs bg-black rounded-[40px] p-4 pt-10 pb-10 shadow-2xl border-[6px] border-zinc-800 relative my-auto">
                      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-4 bg-black rounded-full flex justify-center items-center">
                        <div className="w-10 h-1 bg-zinc-800 rounded-full" />
                      </div>
                      <div className="bg-zinc-950 rounded-[28px] p-4 text-white min-h-[220px] flex flex-col justify-between font-sans">
                        <div className="flex items-center gap-2 border-b border-zinc-900 pb-2 mb-4">
                          <div className="w-8 h-8 rounded-full bg-torqued-red flex items-center justify-center font-bold text-xs text-white">TQ</div>
                          <div>
                            <p className="text-xs font-bold text-zinc-100">Torqued NZ</p>
                            <p className="text-[9px] text-zinc-500">Secure Direct Notify</p>
                          </div>
                        </div>
                        <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl p-3.5 text-xs text-zinc-200 leading-relaxed font-semibold self-end shadow-md max-w-[90%] relative">
                          {emittedSmsText || (latestBooking ? `TORQUED: Booking Ref #${latestBooking.id} is confirmed for vehicle (${vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : vehicle?.rego || ''} - ${vehicle?.rego || ''}). Drop off date is ${latestBooking.date} @ ${selectedTime}.` : 'Booking confirmation SMS will appear here.')}
                        </div>
                        <div className="text-[8px] text-zinc-600 text-center font-mono mt-4">Authorized Otago Dispatch Hub</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  (() => {
                    let activeHtml = '';
                    if (selectedEmailTab === 'customer') activeHtml = emittedEmailHtml || '';
                    else if (selectedEmailTab === 'mechanic') activeHtml = emittedMechanicHtml || '';
                    else if (selectedEmailTab === 'dropoff') activeHtml = emittedDropoffHtml || '';
                    else if (selectedEmailTab === 'service') activeHtml = emittedServiceReminderHtml || '';

                    return (
                      <iframe
                        title="Email Template Sandbox Preview"
                        srcDoc={activeHtml || `
                          <html>
                            <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background-color: #150402; color: white; margin: 0; padding: 20px; box-sizing: border-box; text-align: center;">
                              <div>
                                <p style="font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #FF1800; letter-spacing: 0.5px;">⌛ GENERATING DYNAMIC DATA STYLES</p>
                                <p style="font-size: 11px; color: rgba(255,255,255,0.6); max-width: 320px; line-height: 1.5; margin: 0 auto;">Establishing secure connection to mail delivery network. Please confirm booking details if preview results do not update automatically.</p>
                              </div>
                            </body>
                          </html>
                        `}
                        className="w-full h-full border-0 rounded-2xl bg-white"
                        referrerPolicy="no-referrer"
                      />
                    );
                  })()
                )}
              </div>

              {/* SMTP Sandbox Send test console */}
              <div className="p-4 bg-card border-t border-border flex flex-col md:flex-row items-center gap-3.5 justify-between">
                <div className="flex items-center gap-2.5 w-full md:w-auto">
                  <div className="p-2 bg-torqued-red/10 text-torqued-red rounded-xl">
                    <Mail size={16} />
                  </div>
                  <div className="space-y-0.5 text-left">
                    <span className="text-[10px] font-black uppercase text-muted tracking-wide leading-none">SMTP Relay Test</span>
                    <h4 className="text-xs font-extrabold text-foreground leading-none">DELIVER DRAFT COPIES TO INBOX</h4>
                  </div>
                </div>

                <div className="flex gap-2 w-full md:w-auto flex-1 max-w-lg">
                  <input
                    type="email"
                    placeholder="Recipient e.g. sri.140nz@gmail.com"
                    value={testEmailAddress || ''}
                    onChange={(e) => setTestEmailAddress(e.target.value)}
                    className="flex-1 bg-background text-sm px-3 py-2 rounded-xl border border-border focus:outline-none focus:border-torqued-red text-foreground font-semibold placeholder:text-muted/40 h-10"
                  />
                  <Button
                    onClick={handleSendTestSingle}
                    disabled={isSendingTest || selectedEmailTab === 'sms'}
                    className="bg-torqued-red hover:bg-torqued-red/90 text-white font-black text-xs uppercase px-5 rounded-xl shrink-0 h-10 flex gap-2 items-center shadow-lg shadow-torqued-red/10"
                  >
                    {isSendingTest ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-border border-t-white rounded-full animate-spin" />
                        Relaying...
                      </>
                    ) : (
                      <>
                        <Send size={12} />
                        Dispatch live test
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Notifications */}
              {testSendStatus !== 'idle' && (
                <div className={cn(
                  "px-6 py-2.5 border-t text-xs font-bold font-mono tracking-tight text-center sm:text-left",
                  testSendStatus === 'success' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-red-500/10 border-red-500/20 text-red-500"
                )}>
                  {testSendStatus === 'success' ? '✓ ' : '✗ '} {testSendStatusMsg}
                </div>
              )}

              {/* Close Footer controls */}
              <div className="p-5 border-t border-border bg-card flex justify-between items-center bg-card/50">
                <p className="text-[9px] text-muted font-black uppercase tracking-wider">
                  SPEC: RACING COAL (#150402) & SOLID SCARLET (#FF1800)
                </p>
                <Button
                  onClick={() => {
                    setShowEmailModal(false);
                    setTestSendStatus('idle');
                  }}
                  className="bg-zinc-800 hover:bg-zinc-700 hover:text-white border border border-border text-foreground font-black text-xs uppercase px-6 h-11 rounded-xl shadow-md"
                >
                  Close Terminal
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {view === 'quote' && step < 5 && (
        <div className="p-4 border-t border-border bg-background md:hidden">
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6].map(s => (
                <div key={s} className={cn("h-1 w-6 rounded-full", s <= step ? "bg-torqued-red" : "bg-border")} />
              ))}
            </div>
            <span className="text-[10px] font-bold uppercase text-muted">Step {step} of 6</span>
          </div>
        </div>
      )}
    </div>
  );
};

