import React, { useState } from 'react';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';

interface Overview {
  mechanics: number; activeSubscriptions: number; customers: number;
  totalBookings: number; completedBookings: number; bookingsLast7Days: number;
  grossBookingValue: number; commission: number; subscriptionRevenue: number;
  refunds: number; netRevenue: number;
}

export const AdminPortal: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const [key, setKey] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'mechanics' | 'bookings' | 'postmvp'>('overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);

  const load = async (k: string) => {
    const res = await fetch(`/api/admin/overview?key=${encodeURIComponent(k)}`);
    if (!res.ok) { setAuthError('Invalid admin password.'); return false; }
    setOverview(await res.json());
    const [m, b] = await Promise.all([
      fetch(`/api/admin/mechanics?key=${encodeURIComponent(k)}`).then(r => r.json()),
      fetch(`/api/admin/bookings?key=${encodeURIComponent(k)}`).then(r => r.json()),
    ]);
    setMechanics(m.mechanics || []);
    setBookings(b.bookings || []);
    return true;
  };

  const toggleSub = async (id: string, active: boolean) => {
    await fetch('/api/admin/set-subscription', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, mechanicId: id, active }),
    });
    setMechanics(ms => ms.map(m => m.id === id ? { ...m, subscription_active: active } : m));
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-torqued-dark text-white flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-card border border-white/10 rounded-3xl p-8 space-y-5">
          <Logo variant="light" />
          <h1 className="text-2xl font-black uppercase tracking-tight">Admin Back-Office</h1>
          <input
            type="password" value={key} onChange={e => { setKey(e.target.value); setAuthError(null); }}
            placeholder="Admin password"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 h-12 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-torqued-red"
            onKeyDown={async e => { if (e.key === 'Enter') { if (await load(key)) setAuthed(true); } }}
          />
          {authError && <p className="text-xs text-torqued-red font-bold">{authError}</p>}
          <Button fullWidth className="bg-torqued-red text-white" onClick={async () => { if (await load(key)) setAuthed(true); }}>Enter</Button>
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

  return (
    <div className="min-h-screen bg-torqued-dark text-white">
      <nav className="p-4 md:px-8 flex justify-between items-center border-b border-white/10">
        <div className="flex items-center gap-3"><Logo variant="light" /><span className="text-xs font-black uppercase tracking-widest text-white/40">Admin</span></div>
        {onBack && <Button size="sm" variant="outline" className="text-white border-white/20" onClick={onBack}>Exit</Button>}
      </nav>

      <div className="px-4 md:px-8 py-4 flex gap-2 border-b border-white/10 overflow-x-auto">
        {(['overview','mechanics','bookings','postmvp'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap ${tab===t?'bg-torqued-red text-white':'text-white/40 hover:text-white'}`}>
            {t === 'postmvp' ? 'Post-MVP' : t}
          </button>
        ))}
      </div>

      <main className="p-4 md:p-8 space-y-6">
        {tab === 'overview' && overview && (
          <>
            <h2 className="text-lg font-black uppercase tracking-tight">Revenue (connected to Stripe model)</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Subscription income" value={`$${overview.subscriptionRevenue.toFixed(2)}`} accent />
              <Stat label="Commission (4%)" value={`$${overview.commission.toFixed(2)}`} accent />
              <Stat label="Refunds" value={`-$${overview.refunds.toFixed(2)}`} />
              <Stat label="Net revenue" value={`$${overview.netRevenue.toFixed(2)}`} accent />
            </div>
            <h2 className="text-lg font-black uppercase tracking-tight pt-2">Platform</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Mechanics" value={String(overview.mechanics)} />
              <Stat label="Active subs" value={String(overview.activeSubscriptions)} />
              <Stat label="Customers" value={String(overview.customers)} />
              <Stat label="Bookings (7d)" value={String(overview.bookingsLast7Days)} />
              <Stat label="Total bookings" value={String(overview.totalBookings)} />
              <Stat label="Completed" value={String(overview.completedBookings)} />
              <Stat label="Gross booking value" value={`$${overview.grossBookingValue.toFixed(2)}`} />
            </div>
          </>
        )}

        {tab === 'mechanics' && (
          <div className="space-y-3">
            <h2 className="text-lg font-black uppercase tracking-tight">Mechanics</h2>
            {mechanics.map(m => (
              <div key={m.id} className="bg-card border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold">{m.name}</p>
                  <p className="text-xs text-white/40">{m.email} · ★ {m.rating || 0} ({m.review_count || 0})</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${m.subscription_active?'bg-emerald-500/15 text-emerald-400':'bg-white/10 text-white/40'}`}>{m.subscription_active?'Active':'Suspended'}</span>
                  <Button size="sm" variant="outline" className="text-white border-white/20 text-[10px]" onClick={() => toggleSub(m.id, !m.subscription_active)}>
                    {m.subscription_active ? 'Suspend' : 'Reactivate'}
                  </Button>
                </div>
              </div>
            ))}
            {mechanics.length === 0 && <p className="text-white/40 text-sm">No mechanics yet.</p>}
          </div>
        )}

        {tab === 'bookings' && (
          <div className="space-y-3">
            <h2 className="text-lg font-black uppercase tracking-tight">Recent Bookings</h2>
            {bookings.map(b => (
              <div key={b.id} className="bg-card border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4 text-sm">
                <div>
                  <p className="font-bold">{b.vehicle_rego || '—'} <span className="text-white/30 font-mono text-xs">#{b.id}</span></p>
                  <p className="text-xs text-white/40">{b.status} · {b.payment_status}{b.refunded_amount>0?` · refunded $${b.refunded_amount}`:''}</p>
                </div>
                <span className="font-black text-torqued-red">${b.total_price || 0}</span>
              </div>
            ))}
            {bookings.length === 0 && <p className="text-white/40 text-sm">No bookings yet.</p>}
          </div>
        )}

        {tab === 'postmvp' && (
          <div className="space-y-4 max-w-2xl">
            <h2 className="text-lg font-black uppercase tracking-tight">Post-MVP Innovations</h2>
            <div className="bg-card border border-white/10 rounded-2xl p-6 space-y-3">
              <h3 className="font-black text-torqued-red uppercase text-sm">MBI Claims (parked)</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Mechanical Breakdown Insurance pipeline: customer pays $99 diagnostic → mechanic submits manual quote →
                customer can download all quotes as a PDF for their insurer. Infrastructure exists in the codebase, hidden from the live flow.
                Future: liaise with MBI providers for easy claims + automatic parts ordering.
              </p>
            </div>
            <div className="bg-card border border-white/10 rounded-2xl p-6 space-y-2">
              <h3 className="font-black text-torqued-red uppercase text-sm">Roadmap ideas</h3>
              <ul className="text-sm text-white/60 list-disc pl-5 space-y-1">
                <li>Carjam/NZTA live rego lookup</li>
                <li>Switching-cost calculator for churning mechanics</li>
                <li>Internal trends board (demand by service/region)</li>
                <li>Automated parts ordering with suppliers</li>
              </ul>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
