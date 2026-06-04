import React, { useState, useEffect } from 'react';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import { authPasskey, registerPasskey, passkeysSupported } from '../lib/passkey';

// Admin back-office is always the dark theme; force the CSS vars so it's never washed out in app light mode.
const ADMIN_DARK = {
  // Override the Tailwind color tokens directly (the intermediate vars are inlined at build)
  '--color-background': '#150402',
  '--color-foreground': '#ffffff',
  '--color-card': 'rgba(255,255,255,0.06)',
  '--color-border': 'rgba(255,255,255,0.12)',
  '--color-muted': 'rgba(255,255,255,0.6)',
  '--bg-color': '#150402',
  '--fg-color': '#ffffff',
  '--card-bg': 'rgba(255,255,255,0.06)',
  '--border-color': 'rgba(255,255,255,0.12)',
  '--muted-color': 'rgba(255,255,255,0.6)',
} as React.CSSProperties;

export const AdminPortal: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const [key, setKey] = useState('');               // admin session token
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Password setup (from ?setup=token)
  const [setupToken, setSetupToken] = useState<string | null>(null);
  const [setupPw, setSetupPw] = useState('');
  const [setupDone, setSetupDone] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  const [tab, setTab] = useState<'overview' | 'search' | 'mechanics' | 'bookings' | 'postmvp'>('overview');
  const [overview, setOverview] = useState<any>(null);
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);

  // Search
  const [q, setQ] = useState('');
  const [sBookings, setSBookings] = useState<any[]>([]);
  const [sPeople, setSPeople] = useState<any[]>([]);
  const [sVehicles, setSVehicles] = useState<any[]>([]);
  const [sHistory, setSHistory] = useState<any[]>([]);
  const [edit, setEdit] = useState<{ kind: 'booking' | 'profile'; row: any } | null>(null);

  // Onboard-a-mechanic form
  const [onb, setOnb] = useState<{ name: string; email: string; address: string; phone: string; owner_name: string; labour_rate: string; technicians: string; parts_lead_days: string; billing: string; trialDays: string }>(
    { name: '', email: '', address: '', phone: '', owner_name: '', labour_rate: '', technicians: '1', parts_lead_days: '1', billing: 'stripe', trialDays: '30' });
  const [onbBusy, setOnbBusy] = useState(false);
  const [onbMsg, setOnbMsg] = useState<string | null>(null);
  const onboardMechanic = async () => {
    setOnbBusy(true); setOnbMsg(null);
    try {
      const res = await fetch('/api/admin/onboard-mechanic', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, ...onb }),
      });
      const d = await res.json();
      if (!res.ok) { setOnbMsg(d.error || 'Onboarding failed'); return; }
      setOnbMsg(d.activated
        ? `✓ ${onb.name} onboarded with complimentary access — live now. Login link emailed.`
        : `✓ ${onb.name} onboarded. Subscription activation link emailed${onb.billing === 'trial' ? ` (${onb.trialDays}-day free trial)` : ''} — they go live once payment is set up.`);
      setOnb({ name: '', email: '', address: '', phone: '', owner_name: '', labour_rate: '', technicians: '1', parts_lead_days: '1', billing: 'stripe', trialDays: '30' });
      await loadAll(key);
    } catch {
      setOnbMsg('Could not connect.');
    } finally { setOnbBusy(false); }
  };

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const s = p.get('setup');
    if (s) { setSetupToken(s); window.history.replaceState({}, document.title, window.location.pathname); }
  }, []);

  const loadAll = async (k: string) => {
    const res = await fetch(`/api/admin/overview?key=${encodeURIComponent(k)}`);
    if (!res.ok) return false;
    setOverview(await res.json());
    const [m, b] = await Promise.all([
      fetch(`/api/admin/mechanics?key=${encodeURIComponent(k)}`).then(r => r.json()),
      fetch(`/api/admin/bookings?key=${encodeURIComponent(k)}`).then(r => r.json()),
    ]);
    setMechanics(m.mechanics || []); setBookings(b.bookings || []);
    return true;
  };

  const login = async () => {
    setAuthError(null);
    const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const d = await res.json();
    if (!res.ok) { setAuthError(d.error || 'Login failed'); return; }
    setKey(d.key); await loadAll(d.key); setAuthed(true);
    // Offer to set up a passkey for faster future logins
    if (passkeysSupported() && email) {
      try {
        if (window.confirm('Set up a passkey for faster sign-in next time? You\'ll use Face ID / Touch ID instead of a password.')) {
          await registerPasskey('admin', email);
          window.alert('Passkey added. Next time, tap "Sign in with passkey".');
        }
      } catch { /* user cancelled or unsupported — password still works */ }
    }
  };

  const loginPasskey = async () => {
    setAuthError(null);
    try {
      const r = await authPasskey('admin', email || undefined);
      if (!r.key) throw new Error('No session returned');
      setKey(r.key); await loadAll(r.key); setAuthed(true);
    } catch (e: any) {
      setAuthError(e?.message || 'Passkey sign-in failed');
    }
  };

  const [mechDetail, setMechDetail] = useState<any | null>(null);
  const viewMechanic = async (id: string) => {
    setMechDetail({ loading: true });
    const r = await fetch(`/api/admin/mechanic/${encodeURIComponent(id)}?key=${encodeURIComponent(key)}`);
    const d = await r.json();
    setMechDetail(r.ok ? d : null);
  };
  const resetPassword = async (userId: string) => {
    if (!window.confirm('Email a password reset link to this user?')) return;
    const r = await fetch('/api/admin/reset-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, userId }),
    });
    const d = await r.json();
    window.alert(r.ok ? 'Password reset link emailed.' : (d.error || 'Could not send reset.'));
  };

  const [detail, setDetail] = useState<any | null>(null);
  const viewBooking = async (id: string) => {
    setDetail({ loading: true });
    const r = await fetch(`/api/admin/booking/${encodeURIComponent(id)}?key=${encodeURIComponent(key)}`);
    const d = await r.json();
    setDetail(r.ok ? d : null);
  };
  const refundBooking = async (b: any) => {
    const amt = window.prompt('Refund amount (NZD). Leave blank for a FULL refund:');
    if (amt == null) return;
    const r = await fetch('/api/stripe/refund', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: b.id, amount: amt.trim() ? parseFloat(amt) : undefined }),
    });
    const d = await r.json();
    window.alert(d.success ? `Refunded $${d.refunded}.` : (d.error || 'Refund failed.'));
    if (d.success) { await loadAll(key); if (q) runSearch(); }
  };

  const cancelBooking = async (b: any) => {
    if (!window.confirm(`Cancel booking ${b.id}${b.vehicle_rego ? ` (${b.vehicle_rego})` : ''}? This updates it system-wide.`)) return;
    await fetch('/api/admin/update-booking', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, id: b.id, fields: { status: 'cancelled' } }),
    });
    // Reflect immediately + reload from the system so admin matches everything else
    setSBookings(bs => bs.map(x => x.id === b.id ? { ...x, status: 'cancelled' } : x));
    setBookings(bs => bs.map(x => x.id === b.id ? { ...x, status: 'cancelled' } : x));
    await loadAll(key);
    if (q) runSearch();
  };

  const runSearch = async () => {
    const r = await fetch(`/api/admin/search?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}`).then(r => r.json());
    setSBookings(r.bookings || []); setSPeople(r.people || []);
    setSVehicles(r.vehicles || []); setSHistory(r.history || []);
  };

  const saveEdit = async () => {
    if (!edit) return;
    const url = edit.kind === 'booking' ? '/api/admin/update-booking' : '/api/admin/update-profile';
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, id: edit.row.id, fields: edit.row }) });
    setEdit(null);
    runSearch();
  };

  // ── Password setup screen ──
  if (setupToken && !setupDone) {
    return (
      <div style={ADMIN_DARK} className="dark min-h-screen bg-torqued-dark text-white flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-card border border-white/10 rounded-3xl p-8 space-y-5">
          <Logo variant="light" />
          <h1 className="text-2xl font-black uppercase tracking-tight">Create admin password</h1>
          <p className="text-sm text-white/50">Set a secure password (min 8 chars). This is yours alone.</p>
          <input type="password" value={setupPw} onChange={e => { setSetupPw(e.target.value); setSetupError(null); }} placeholder="New password"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 h-12 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-torqued-red" />
          {setupError && <p className="text-xs text-torqued-red font-bold">{setupError}</p>}
          <Button fullWidth className="bg-torqued-red text-white" onClick={async () => {
            const res = await fetch('/api/admin/set-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: setupToken, password: setupPw }) });
            const d = await res.json();
            if (!res.ok) { setSetupError(d.error || 'Could not set password'); return; }
            setEmail(d.email || ''); setSetupDone(true); setSetupToken(null);
          }}>Set Password</Button>
        </div>
      </div>
    );
  }

  // ── Login screen ──
  if (!authed) {
    return (
      <div style={ADMIN_DARK} className="dark min-h-screen bg-torqued-dark text-white flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-card border border-white/10 rounded-3xl p-8 space-y-4">
          <Logo variant="light" />
          <h1 className="text-2xl font-black uppercase tracking-tight">Admin Back-Office</h1>
          {setupDone && <p className="text-xs text-emerald-400 font-bold">Password set — log in below.</p>}
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Admin email"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 h-12 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-torqued-red" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password"
            onKeyDown={e => { if (e.key === 'Enter') login(); }}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 h-12 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-torqued-red" />
          {authError && <p className="text-xs text-torqued-red font-bold">{authError}</p>}
          <Button fullWidth className="bg-torqued-red text-white" onClick={login}>Log In</Button>
          {passkeysSupported() && (
            <button onClick={loginPasskey} className="w-full text-xs font-bold text-white/70 hover:text-white border border-white/10 rounded-xl h-11 flex items-center justify-center gap-2">
              <span aria-hidden>🔑</span> Sign in with passkey
            </button>
          )}
          {onBack && <button onClick={onBack} className="text-xs text-white/40 hover:text-white w-full">← Back</button>}
        </div>
      </div>
    );
  }

  const Stat = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
    <div className="bg-card border border-white/10 rounded-2xl p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-white/40">{label}</p>
      <p className={`text-2xl font-black tracking-tight mt-1 ${accent ? 'text-torqued-red' : 'text-white'}`}>{value}</p>
    </div>
  );
  const fld = "w-full bg-white/5 border border-white/10 rounded-lg px-3 h-10 text-sm text-white";

  return (
    <div style={ADMIN_DARK} className="dark min-h-screen bg-torqued-dark text-white">
      <nav className="p-4 md:px-8 flex justify-between items-center border-b border-white/10">
        <div className="flex items-center gap-3"><Logo variant="light" /><span className="text-xs font-black uppercase tracking-widest text-white/40">Admin</span></div>
        {onBack && <Button size="sm" variant="outline" className="text-white border-white/20" onClick={onBack}>Exit</Button>}
      </nav>

      <div className="px-4 md:px-8 py-4 flex gap-2 border-b border-white/10 overflow-x-auto">
        {(['overview','search','mechanics','bookings','postmvp'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap ${tab===t?'bg-torqued-red text-white':'text-white/40 hover:text-white'}`}>
            {t === 'postmvp' ? 'Post-MVP' : t}
          </button>
        ))}
      </div>

      <main className="p-4 md:p-8 space-y-6">
        {tab === 'overview' && overview && (
          <>
            <h2 className="text-lg font-black uppercase tracking-tight">Revenue</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Subscription income" value={`$${overview.subscriptionRevenue?.toFixed(2)}`} accent />
              <Stat label="Commission (4%)" value={`$${overview.commission?.toFixed(2)}`} accent />
              <Stat label="Refunds" value={`-$${overview.refunds?.toFixed(2)}`} />
              <Stat label="Net revenue" value={`$${overview.netRevenue?.toFixed(2)}`} accent />
            </div>
            <h2 className="text-lg font-black uppercase tracking-tight pt-2">Platform</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Mechanics" value={String(overview.mechanics)} />
              <Stat label="Active subs" value={String(overview.activeSubscriptions)} />
              <Stat label="Customers" value={String(overview.customers)} />
              <Stat label="Bookings (7d)" value={String(overview.bookingsLast7Days)} />
              <Stat label="Total bookings" value={String(overview.totalBookings)} />
              <Stat label="Completed" value={String(overview.completedBookings)} />
              <Stat label="Gross booking value" value={`$${overview.grossBookingValue?.toFixed(2)}`} />
            </div>
          </>
        )}

        {tab === 'search' && (
          <div className="space-y-4">
            <h2 className="text-lg font-black uppercase tracking-tight">Search jobs & customers</h2>
            <div className="flex gap-2 max-w-xl">
              <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') runSearch(); }}
                placeholder="Search by booking #, plate, email, or name…" className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 h-11 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-torqued-red" />
              <Button className="bg-torqued-red text-white" onClick={runSearch}>Search</Button>
            </div>

            {sBookings.length > 0 && <h3 className="text-sm font-black uppercase text-white/40">Bookings</h3>}
            {sBookings.map(b => (
              <div key={b.id} className="bg-card border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4 text-sm">
                <div>
                  <p className="font-bold">{b.vehicle_rego || '—'} <span className="text-white/30 font-mono text-xs">#{b.id}</span></p>
                  <p className="text-xs text-white/40">{b.customer_name || b.email || '—'} · {b.status} · {b.payment_status} · ${b.total_price || 0}{b.refunded_amount>0?` · refunded $${b.refunded_amount}`:''}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" className="text-white border-white/20 text-[10px]" onClick={() => viewBooking(b.id)}>View</Button>
                  <Button size="sm" variant="outline" className="text-white border-white/20 text-[10px]" onClick={() => setEdit({ kind: 'booking', row: { ...b } })}>Edit</Button>
                  {b.status !== 'cancelled' && <Button size="sm" variant="outline" className="text-torqued-red border-torqued-red/40 text-[10px]" onClick={() => cancelBooking(b)}>Cancel</Button>}
                </div>
              </div>
            ))}

            {sPeople.length > 0 && <h3 className="text-sm font-black uppercase text-white/40 pt-2">People</h3>}
            {sPeople.map(p => (
              <div key={p.id} className="bg-card border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4 text-sm">
                <div>
                  <p className="font-bold">{p.name} <span className="text-[10px] uppercase bg-white/10 px-1.5 py-0.5 rounded ml-1">{p.role}</span></p>
                  <p className="text-xs text-white/40">{p.email} {p.phone ? `· ${p.phone}` : ''}{p.role==='mechanic'?` · ${p.subscription_active?'active':'suspended'}`:''}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {p.role === 'mechanic' && <Button size="sm" variant="outline" className="text-white border-white/20 text-[10px]" onClick={() => viewMechanic(p.id)}>View</Button>}
                  <Button size="sm" variant="outline" className="text-white border-white/20 text-[10px]" onClick={() => setEdit({ kind: 'profile', row: { ...p } })}>Edit</Button>
                  <Button size="sm" variant="outline" className="text-white border-white/20 text-[10px]" onClick={() => resetPassword(p.id)}>Reset PW</Button>
                </div>
              </div>
            ))}
            {sVehicles.length > 0 && <h3 className="text-sm font-black uppercase text-white/40 pt-2">Vehicles & service history</h3>}
            {sVehicles.map(v => {
              const hist = sHistory.filter(h => h.rego === v.rego);
              return (
                <div key={v.rego} className="bg-card border border-white/10 rounded-2xl p-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-bold">{v.year} {v.make} {v.model} <span className="text-white/30 font-mono text-xs">{v.rego}</span></p>
                    <span className="text-[10px] text-white/40">{v.mileage ? `${Number(v.mileage).toLocaleString()} km` : ''} · {hist.length} record{hist.length === 1 ? '' : 's'}</span>
                  </div>
                  {hist.length > 0 && (
                    <div className="space-y-1 border-t border-white/10 pt-2">
                      {hist.map(h => (
                        <div key={h.id} className="flex justify-between text-xs text-white/60">
                          <span>{h.service_date || '—'} · {h.work_done || 'Service'}{h.provider ? ` · ${h.provider}` : ''}</span>
                          <span className="text-white/30">{h.mileage ? `${Number(h.mileage).toLocaleString()} km` : ''}{h.price ? ` · ${h.price}` : ''}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {q && sBookings.length === 0 && sPeople.length === 0 && sVehicles.length === 0 && <p className="text-white/40 text-sm">No matches.</p>}
          </div>
        )}

        {tab === 'mechanics' && (
          <div className="space-y-3">
            {/* Onboard a new workshop */}
            <div className="bg-card border border-torqued-red/20 rounded-2xl p-5 space-y-3">
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight">Onboard a workshop</h2>
                <p className="text-xs text-white/40">Creates a live, pre-confirmed mechanic account, geocodes the address for distance search, and emails them a login link.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {([
                  ['name', 'Workshop name *'], ['email', 'Email *'], ['address', 'Full address (for map/distance)'],
                  ['phone', 'Phone'], ['owner_name', 'Owner name'], ['labour_rate', 'Labour rate ($/hr)'],
                  ['technicians', '# Technicians'], ['parts_lead_days', 'Parts lead (days)'],
                ] as const).map(([field, label]) => (
                  <input key={field} value={(onb as any)[field]} placeholder={label}
                    onChange={e => setOnb(o => ({ ...o, [field]: e.target.value }))}
                    className={`bg-white/5 border border-white/10 rounded-xl px-3 h-11 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-torqued-red ${field === 'address' ? 'sm:col-span-2' : ''}`} />
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Billing</label>
                  <select value={onb.billing} onChange={e => setOnb(o => ({ ...o, billing: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 h-11 text-sm text-white focus:outline-none focus:border-torqued-red">
                    <option value="stripe">$99/mo — email Stripe activation link</option>
                    <option value="trial">Free trial then $99/mo — Stripe link</option>
                    <option value="comp">Complimentary (free, live now)</option>
                  </select>
                </div>
                {onb.billing === 'trial' && (
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Trial days</label>
                    <input value={onb.trialDays} onChange={e => setOnb(o => ({ ...o, trialDays: e.target.value }))} placeholder="30"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 h-11 text-sm text-white focus:outline-none focus:border-torqued-red" />
                  </div>
                )}
              </div>
              {onbMsg && <p className={`text-xs font-bold ${onbMsg.startsWith('✓') ? 'text-emerald-400' : 'text-torqued-red'}`}>{onbMsg}</p>}
              <Button className="bg-torqued-red text-white" disabled={onbBusy || !onb.name || !onb.email} onClick={onboardMechanic}>
                {onbBusy ? 'Onboarding…' : 'Onboard workshop'}
              </Button>
            </div>

            <h2 className="text-lg font-black uppercase tracking-tight pt-2">Mechanics</h2>
            {mechanics.map(m => (
              <div key={m.id} className="bg-card border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4 hover:border-torqued-red/40 transition-all cursor-pointer" onClick={() => viewMechanic(m.id)}>
                <div><p className="font-bold">{m.name}</p><p className="text-xs text-white/40">{m.email} · ★ {m.rating || 0} ({m.review_count || 0})</p></div>
                <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                  <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${m.subscription_active?'bg-emerald-500/15 text-emerald-400':'bg-white/10 text-white/40'}`}>{m.subscription_active?'Active':'Suspended'}</span>
                  <Button size="sm" variant="outline" className="text-white border-white/20 text-[10px]" onClick={() => viewMechanic(m.id)}>View</Button>
                  <Button size="sm" variant="outline" className="text-white border-white/20 text-[10px]" onClick={async () => {
                    await fetch('/api/admin/set-subscription', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, mechanicId: m.id, active: !m.subscription_active }) });
                    setMechanics(ms => ms.map(x => x.id === m.id ? { ...x, subscription_active: !m.subscription_active } : x));
                  }}>{m.subscription_active ? 'Suspend' : 'Reactivate'}</Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'bookings' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-lg font-black uppercase tracking-tight">Recent Bookings</h2>
              <Button size="sm" className="bg-torqued-red text-white" onClick={async () => {
                const r = await fetch(`/api/admin/weekly-report?key=${encodeURIComponent(key)}`);
                const d = await r.json();
                const rows = d.rows || [];
                const header = 'Mechanic,Jobs,Gross,Commission (4%),Payout\n';
                const body = rows.map((x: any) => `"${(x.name || '').replace(/"/g, '""')}",${x.jobs},${x.gross},${x.commission},${x.payout}`).join('\n');
                const totals = rows.reduce((a: any, x: any) => ({ jobs: a.jobs + x.jobs, gross: a.gross + x.gross, commission: a.commission + x.commission, payout: a.payout + x.payout }), { jobs: 0, gross: 0, commission: 0, payout: 0 });
                const csv = header + body + `\n"TOTAL",${totals.jobs},${totals.gross.toFixed(2)},${totals.commission.toFixed(2)},${totals.payout.toFixed(2)}`;
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url;
                a.download = `Torqued-Weekly-Report-${(d.periodStart || '').slice(0, 10)}.csv`; a.click();
                URL.revokeObjectURL(url);
              }}>Download weekly report (CSV)</Button>
            </div>
            {bookings.map(b => (
              <div key={b.id} className="bg-card border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4 text-sm">
                <div><p className="font-bold">{b.vehicle_rego || '—'} <span className="text-white/30 font-mono text-xs">#{b.id}</span></p>
                  <p className="text-xs text-white/40">{b.status} · {b.payment_status}</p></div>
                <div className="flex items-center gap-3">
                  <span className="font-black text-torqued-red">${b.quoted_price || b.total_price || 0}</span>
                  <Button size="sm" variant="outline" className="text-white border-white/20 text-[10px]" onClick={() => viewBooking(b.id)}>View</Button>
                  <Button size="sm" variant="outline" className="text-white border-white/20 text-[10px]" onClick={() => setEdit({ kind: 'booking', row: { ...b } })}>Edit</Button>
                  {b.status !== 'cancelled' && <Button size="sm" variant="outline" className="text-torqued-red border-torqued-red/40 text-[10px]" onClick={() => cancelBooking(b)}>Cancel</Button>}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'postmvp' && (
          <div className="space-y-4 max-w-2xl">
            <h2 className="text-lg font-black uppercase tracking-tight">Post-MVP Innovations</h2>
            <div className="bg-card border border-white/10 rounded-2xl p-6 space-y-3">
              <h3 className="font-black text-torqued-red uppercase text-sm">MBI Claims (parked)</h3>
              <p className="text-sm text-white/60 leading-relaxed">$99 diagnostic → mechanic manual quote → customer downloads quotes as PDF for their insurer. Infrastructure exists, hidden from the live flow. Future: MBI provider integrations + automatic parts ordering.</p>
            </div>
            <div className="bg-card border border-white/10 rounded-2xl p-6 space-y-2">
              <h3 className="font-black text-torqued-red uppercase text-sm">Roadmap</h3>
              <ul className="text-sm text-white/60 list-disc pl-5 space-y-1"><li>Carjam/NZTA live rego lookup</li><li>Mechanic churn / switching-cost calculator</li><li>Demand trends by service & region</li></ul>
            </div>
          </div>
        )}
      </main>

      {/* Mechanic detail modal */}
      {mechDetail && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl my-8 bg-card border border-white/10 rounded-3xl p-6 space-y-4">
            {mechDetail.loading ? <p className="text-white/60 text-sm py-8 text-center">Loading…</p> : (() => {
              const p = mechDetail.profile; const rev = mechDetail.revenue; const bl = mechDetail.billing;
              return (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-black uppercase text-white">{p.name}</h3>
                      <p className="text-xs text-white/40">{p.email} {p.phone ? `· ${p.phone}` : ''}</p>
                      <p className="text-xs text-white/40">{p.address || ''}</p>
                    </div>
                    <button onClick={() => setMechDetail(null)} className="text-white/40 hover:text-white text-2xl leading-none">×</button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="bg-white/5 rounded-xl p-3"><p className="text-[9px] uppercase font-black text-white/40">Jobs</p><p className="text-lg font-black text-white">{rev.jobs}</p></div>
                    <div className="bg-white/5 rounded-xl p-3"><p className="text-[9px] uppercase font-black text-white/40">Gross</p><p className="text-lg font-black text-white">${rev.gross}</p></div>
                    <div className="bg-white/5 rounded-xl p-3"><p className="text-[9px] uppercase font-black text-white/40">Commission</p><p className="text-lg font-black text-torqued-red">${rev.commission}</p></div>
                    <div className="bg-white/5 rounded-xl p-3"><p className="text-[9px] uppercase font-black text-white/40">Payout</p><p className="text-lg font-black text-emerald-400">${rev.payout}</p></div>
                  </div>

                  <div className="bg-white/5 rounded-xl p-3 text-sm flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-[10px] uppercase font-black text-white/40">Subscription</p>
                      <p className={`font-bold ${bl.active ? 'text-emerald-400' : 'text-torqued-red'}`}>{(bl.status || 'inactive').toUpperCase()}{bl.nextBilling ? ` · next ${new Date(bl.nextBilling).toLocaleDateString('en-NZ')}` : ''}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="text-white border-white/20 text-[10px]" onClick={() => resetPassword(p.id)}>Reset password</Button>
                      <Button size="sm" variant="outline" className="text-white border-white/20 text-[10px]" onClick={async () => {
                        await fetch('/api/admin/set-subscription', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, mechanicId: p.id, active: !p.subscription_active }) });
                        setMechDetail({ ...mechDetail, profile: { ...p, subscription_active: !p.subscription_active } });
                        loadAll(key);
                      }}>{p.subscription_active ? 'Suspend' : 'Reactivate'}</Button>
                    </div>
                  </div>

                  {bl.invoices?.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase font-black text-white/40 mb-1">Subscription transactions</p>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {bl.invoices.map((inv: any) => (
                          <div key={inv.id} className="flex justify-between text-xs text-white/60 bg-white/5 rounded px-2 py-1">
                            <span>{new Date(inv.date).toLocaleDateString('en-NZ')} · ${inv.amount} · {inv.status}</span>
                            {inv.url && <a href={inv.url} target="_blank" rel="noreferrer" className="text-torqued-red font-bold">Receipt</a>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-[10px] uppercase font-black text-white/40 mb-1">Jobs through the platform ({mechDetail.jobs.length})</p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {mechDetail.jobs.length === 0 && <p className="text-xs text-white/40 italic">No jobs yet.</p>}
                      {mechDetail.jobs.map((j: any) => (
                        <div key={j.id} className="flex justify-between items-center text-xs text-white/60 bg-white/5 rounded px-2 py-1.5">
                          <span>{(j.date || (j.created_at || '').slice(0, 10))} · {j.vehicle_rego || '—'} · {j.status}</span>
                          <span className="flex items-center gap-2">${j.quoted_price || j.total_price || 0}
                            <button onClick={() => { setMechDetail(null); viewBooking(j.id); }} className="text-torqued-red font-bold">Open</button>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Booking detail modal */}
      {detail && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg my-8 bg-card border border-white/10 rounded-3xl p-6 space-y-4">
            {detail.loading ? <p className="text-white/60 text-sm py-8 text-center">Loading…</p> : (() => {
              const b = detail.booking; const m = detail.mechanic; const v = detail.vehicle;
              return (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-black uppercase text-white">{b.vehicle_rego || '—'} <span className="font-mono text-xs text-white/30">#{b.id}</span></h3>
                      <p className="text-xs text-white/40">{b.status} · {b.payment_status}{b.is_cold_quote ? ' · cold quote' : ''}{b.refunded_amount > 0 ? ` · refunded $${b.refunded_amount}` : ''}</p>
                    </div>
                    <button onClick={() => setDetail(null)} className="text-white/40 hover:text-white text-2xl leading-none">×</button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-white/5 rounded-xl p-3">
                      <p className="text-[10px] uppercase font-black text-white/40 mb-1">Customer</p>
                      <p className="text-white font-bold">{b.customer_name || '—'}</p>
                      <p className="text-white/50 text-xs">{b.email || '—'}</p>
                      <p className="text-white/50 text-xs">{b.customer_phone || b.phone || ''}</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3">
                      <p className="text-[10px] uppercase font-black text-white/40 mb-1">Mechanic</p>
                      <p className="text-white font-bold">{m?.name || '—'}</p>
                      <p className="text-white/50 text-xs">{m?.email || ''}</p>
                      <p className="text-white/50 text-xs">{m?.address || ''}</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3">
                      <p className="text-[10px] uppercase font-black text-white/40 mb-1">Vehicle</p>
                      <p className="text-white font-bold">{v ? `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim() : (b.vehicle_rego || '—')}</p>
                      <p className="text-white/50 text-xs">{v?.variant || ''}</p>
                      <p className="text-white/50 text-xs">{v?.mileage ? `${Number(v.mileage).toLocaleString()} km` : ''}</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3">
                      <p className="text-[10px] uppercase font-black text-white/40 mb-1">This job</p>
                      <p className="text-white/70 text-xs">{(b.service_ids || []).join(', ') || '—'}</p>
                      <p className="text-torqued-red font-black mt-1">${b.quoted_price || b.total_price || 0}</p>
                      {b.description && <p className="text-white/40 text-xs italic mt-1">“{b.description}”</p>}
                    </div>
                  </div>

                  {detail.torquedJobs?.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase font-black text-white/40 mb-1">Previous Torqued jobs ({detail.torquedJobs.length})</p>
                      <div className="space-y-1 max-h-28 overflow-y-auto">
                        {detail.torquedJobs.map((j: any) => (
                          <div key={j.id} className="flex justify-between text-xs text-white/60 bg-white/5 rounded px-2 py-1">
                            <span>{j.date || (j.created_at || '').slice(0, 10)} · {(j.service_ids || []).join(', ') || '—'}</span>
                            <span>{j.status} · ${j.quoted_price || j.total_price || 0}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {detail.history?.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase font-black text-white/40 mb-1">Service history ({detail.history.length})</p>
                      <div className="space-y-1 max-h-28 overflow-y-auto">
                        {detail.history.map((h: any) => (
                          <div key={h.id} className="flex justify-between text-xs text-white/60 bg-white/5 rounded px-2 py-1">
                            <span>{h.service_date || '—'} · {h.work_done || 'Service'}{h.provider ? ` · ${h.provider}` : ''}</span>
                            <span>{h.mileage ? `${Number(h.mileage).toLocaleString()} km` : ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
                    <Button size="sm" className="bg-white/10 text-white text-[10px]" onClick={() => { setEdit({ kind: 'booking', row: { ...b } }); setDetail(null); }}>Edit</Button>
                    <Button size="sm" variant="outline" className="text-amber-400 border-amber-400/40 text-[10px]" onClick={() => refundBooking(b)}>Refund / Partial</Button>
                    {b.status !== 'cancelled' && <Button size="sm" variant="outline" className="text-torqued-red border-torqued-red/40 text-[10px]" onClick={async () => { await cancelBooking(b); setDetail(null); }}>Cancel booking</Button>}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Edit modal */}
      {edit && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md my-8 bg-card border border-white/10 rounded-3xl p-6 space-y-4">
            <h3 className="text-lg font-black uppercase">Edit {edit.kind}</h3>
            <div className="space-y-3">
              {(edit.kind === 'booking'
                ? ['status','payment_status','total_price','quoted_price','date','customer_name','email','phone','vehicle_rego']
                : ['name','email','phone','role','subscription_active','address','labour_rate']
              ).map(f => (
                <div key={f}>
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-1">{f.replace(/_/g,' ')}</label>
                  <input className={fld} value={edit.row[f] ?? ''} onChange={e => setEdit({ ...edit, row: { ...edit.row, [f]: e.target.value } })} />
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <Button fullWidth className="bg-torqued-red text-white" onClick={saveEdit}>Save</Button>
              <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
