import React, { useState, useEffect } from 'react';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';

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
  const [edit, setEdit] = useState<{ kind: 'booking' | 'profile'; row: any } | null>(null);

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
  };

  const runSearch = async () => {
    const r = await fetch(`/api/admin/search?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}`).then(r => r.json());
    setSBookings(r.bookings || []); setSPeople(r.people || []);
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
      <div className="min-h-screen bg-torqued-dark text-white flex items-center justify-center p-4">
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
      <div className="min-h-screen bg-torqued-dark text-white flex items-center justify-center p-4">
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
    <div className="min-h-screen bg-torqued-dark text-white">
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
                <Button size="sm" variant="outline" className="text-white border-white/20 text-[10px]" onClick={() => setEdit({ kind: 'booking', row: { ...b } })}>Edit</Button>
              </div>
            ))}

            {sPeople.length > 0 && <h3 className="text-sm font-black uppercase text-white/40 pt-2">People</h3>}
            {sPeople.map(p => (
              <div key={p.id} className="bg-card border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4 text-sm">
                <div>
                  <p className="font-bold">{p.name} <span className="text-[10px] uppercase bg-white/10 px-1.5 py-0.5 rounded ml-1">{p.role}</span></p>
                  <p className="text-xs text-white/40">{p.email} {p.phone ? `· ${p.phone}` : ''}{p.role==='mechanic'?` · ${p.subscription_active?'active':'suspended'}`:''}</p>
                </div>
                <Button size="sm" variant="outline" className="text-white border-white/20 text-[10px]" onClick={() => setEdit({ kind: 'profile', row: { ...p } })}>Edit</Button>
              </div>
            ))}
            {q && sBookings.length === 0 && sPeople.length === 0 && <p className="text-white/40 text-sm">No matches.</p>}
          </div>
        )}

        {tab === 'mechanics' && (
          <div className="space-y-3">
            <h2 className="text-lg font-black uppercase tracking-tight">Mechanics</h2>
            {mechanics.map(m => (
              <div key={m.id} className="bg-card border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div><p className="font-bold">{m.name}</p><p className="text-xs text-white/40">{m.email} · ★ {m.rating || 0} ({m.review_count || 0})</p></div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${m.subscription_active?'bg-emerald-500/15 text-emerald-400':'bg-white/10 text-white/40'}`}>{m.subscription_active?'Active':'Suspended'}</span>
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
            <h2 className="text-lg font-black uppercase tracking-tight">Recent Bookings</h2>
            {bookings.map(b => (
              <div key={b.id} className="bg-card border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4 text-sm">
                <div><p className="font-bold">{b.vehicle_rego || '—'} <span className="text-white/30 font-mono text-xs">#{b.id}</span></p>
                  <p className="text-xs text-white/40">{b.status} · {b.payment_status}</p></div>
                <div className="flex items-center gap-3">
                  <span className="font-black text-torqued-red">${b.total_price || 0}</span>
                  <Button size="sm" variant="outline" className="text-white border-white/20 text-[10px]" onClick={() => setEdit({ kind: 'booking', row: { ...b } })}>Edit</Button>
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
