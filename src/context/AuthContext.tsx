import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Vehicle } from '../types';

interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: 'customer' | 'mechanic';
  phone?: string;
  homeLocation?: string;
  vehicles?: Vehicle[];
  subscriptionActive?: boolean;
  stripeSubscriptionId?: string;
  reviewStatus?: 'pending' | 'approved' | 'rejected';
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  userRole: 'customer' | 'mechanic' | null;
  isAuthReady: boolean;
  // Mechanic auth (email + password)
  loginMechanic: (email: string, password: string) => Promise<void>;
  signUpMechanic: (email: string, name: string) => Promise<{ error?: string; needsConfirmation?: boolean }>;
  resendMechanicLink: (email: string) => Promise<string | null>;
  markSubscriptionActive: () => void;
  // Shared
  logout: () => Promise<void>;
  registerVehicle: (vehicle: Vehicle) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  checkPlateExists: (rego: string) => Promise<{ exists: boolean; ownerEmail: string | null; vehicle?: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function toDbFields(profile: Partial<UserProfile>) {
  const fields: Record<string, any> = {};
  if (profile.email !== undefined) fields.email = profile.email;
  if (profile.name !== undefined) fields.name = profile.name;
  if (profile.role !== undefined) fields.role = profile.role;
  if (profile.phone !== undefined) fields.phone = profile.phone;
  if (profile.homeLocation !== undefined) fields.home_location = profile.homeLocation;
  if (profile.subscriptionActive !== undefined) fields.subscription_active = profile.subscriptionActive;
  if (profile.stripeSubscriptionId !== undefined) fields.stripe_subscription_id = profile.stripeSubscriptionId;
  return fields;
}

function fromDbRow(row: any): UserProfile {
  return {
    uid: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    phone: row.phone ?? undefined,
    homeLocation: row.home_location ?? undefined,
    subscriptionActive: row.subscription_active ?? undefined,
    stripeSubscriptionId: row.stripe_subscription_id ?? undefined,
    reviewStatus: row.review_status ?? undefined,
    vehicles: [],
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userRole, setUserRole] = useState<'customer' | 'mechanic' | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const loadProfile = async (supabaseUser: User) => {
    const { data: row } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', supabaseUser.id)
      .single();

    if (row) {
      const profile = fromDbRow(row);

      if (profile.role === 'customer') {
        const { data: vehicleRows } = await supabase
          .from('vehicles')
          .select('*')
          .eq('owner_id', supabaseUser.id);

        profile.vehicles = (vehicleRows ?? []).map((v: any) => ({
          id: v.rego,
          rego: v.rego,
          make: v.make,
          model: v.model,
          year: v.year,
          variant: v.variant ?? undefined,
          mileage: v.mileage,
          thumbnail: v.thumbnail ?? undefined,
        }));
      }

      setUserProfile(profile);
      setUserRole(profile.role);
      return;
    }

    // No row returned. Create one only if it truly doesn't exist (ignoreDuplicates
    // so we never clobber an existing subscription_active), then re-read the truth.
    const role = (supabaseUser.user_metadata?.role as 'customer' | 'mechanic') || 'mechanic';
    const newProfile = {
      id: supabaseUser.id,
      email: supabaseUser.email ?? '',
      name: supabaseUser.user_metadata?.name ?? supabaseUser.user_metadata?.full_name ?? 'User',
      role,
      subscription_active: role === 'mechanic' ? false : null,
    };

    await supabase.from('profiles').upsert(newProfile, { onConflict: 'id', ignoreDuplicates: true });

    // Re-read so we reflect any existing subscription_active rather than the default
    const { data: fresh } = await supabase.from('profiles').select('*').eq('id', supabaseUser.id).single();
    const finalRow = fresh || { ...newProfile, phone: null, home_location: null, stripe_subscription_id: null };
    setUserProfile({ ...fromDbRow(finalRow), vehicles: [] });
    setUserRole(finalRow.role);
  };

  useEffect(() => {
    let mounted = true;

    // Resolve initial auth state explicitly so the app never hangs on the
    // loading screen if onAuthStateChange is delayed or loadProfile throws.
    const init = async () => {
      try {
        // detectSessionInUrl is false to prevent freezes, so we process
        // magic-link / recovery tokens manually on first load. Supabase can deliver
        // these two ways depending on project flow settings:
        //   (a) implicit  → tokens in the URL hash  (#access_token=…&type=recovery)
        //   (b) PKCE      → a single-use code in the query  (?code=…)
        // We handle both so reset/onboarding links are not silently dropped.
        const hashStr = window.location.hash.substring(1);
        const queryParams = new URLSearchParams(window.location.search);
        // Surface an expired/used link instead of leaving the user on a blank screen.
        const errDesc = new URLSearchParams(hashStr).get('error_description') || queryParams.get('error_description');
        if (errDesc) {
          console.warn('Auth link error:', errDesc);
          try { localStorage.setItem('torqued_auth_error', errDesc); } catch {}
          window.history.replaceState({}, '', window.location.pathname);
        }
        if (hashStr.includes('access_token=')) {
          const hp = new URLSearchParams(hashStr);
          const at = hp.get('access_token');
          const rt = hp.get('refresh_token');
          const linkType = hp.get('type');
          if (at && rt) {
            try {
              await supabase.auth.setSession({ access_token: at, refresh_token: rt });
              if (linkType === 'recovery' || linkType === 'magiclink' || linkType === 'invite') {
                localStorage.setItem('torqued_needs_password', '1');
              }
            } catch (e) { console.warn('Hash session error:', e); }
            window.history.replaceState({}, '', window.location.pathname + window.location.search);
          }
        } else if (queryParams.get('code')) {
          // PKCE flow: exchange the one-time code for a session.
          try {
            await supabase.auth.exchangeCodeForSession(queryParams.get('code')!);
            // Recovery/invite/magic links should prompt a password reset on arrival.
            const t = queryParams.get('type');
            if (!t || t === 'recovery' || t === 'magiclink' || t === 'invite') {
              localStorage.setItem('torqued_needs_password', '1');
            }
          } catch (e) { console.warn('Code exchange error:', e); }
          window.history.replaceState({}, '', window.location.pathname);
        }
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        const u = session?.user ?? null;
        setUser(u);
        if (u) {
          try { await loadProfile(u); } catch (e) { console.error('loadProfile failed:', e); }
        }
      } catch (e) {
        console.error('Auth init failed:', e);
      } finally {
        if (mounted) setIsAuthReady(true);
      }
    };
    init();

    // Hard safety net: never let the loading screen hang past 5s.
    const failsafe = setTimeout(() => { if (mounted) setIsAuthReady(true); }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const supabaseUser = session?.user ?? null;
      setUser(supabaseUser);
      if (supabaseUser) {
        try { await loadProfile(supabaseUser); } catch (e) { console.error('loadProfile failed:', e); }
      } else {
        setUserProfile(null);
        setUserRole(null);
      }
      if (mounted) setIsAuthReady(true);
    });

    return () => { mounted = false; clearTimeout(failsafe); subscription.unsubscribe(); };
  }, []);

  // ── Mechanic auth ──────────────────────────────────────────
  const loginMechanic = async (email: string, password: string) => {
    let { error } = await supabase.auth.signInWithPassword({ email, password });
    // Auto-heal accounts that were left unconfirmed by the earlier link flow
    if (error && /not confirmed/i.test(error.message)) {
      await fetch('/api/mechanic/ensure-confirmed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      ({ error } = await supabase.auth.signInWithPassword({ email, password }));
    }
    if (error) throw new Error(error.message);
  };

  // No password is collected at signup — that's set later in onboarding. The
  // server generates one, creates the account pre-confirmed, and returns it
  // once so we can establish the session silently right here.
  const signUpMechanic = async (email: string, name: string): Promise<{ error?: string; needsConfirmation?: boolean }> => {
    const res = await fetch('/api/mechanic/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || 'Sign up failed' };
    const { error } = await supabase.auth.signInWithPassword({ email, password: data.tempPassword });
    if (error) return { error: error.message };
    return {};
  };

  // Flip the local subscription flag immediately (server already persisted it via
  // service role). Kept out of the DB path so it can't be reverted by a reload.
  const markSubscriptionActive = () => {
    setUserProfile(prev => prev ? { ...prev, subscriptionActive: true } : prev);
  };

  const resendMechanicLink = async (email: string): Promise<string | null> => {
    const res = await fetch('/api/mechanic/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) return data.error || 'Could not resend link';
    return null;
  };

  // ── Shared ─────────────────────────────────────────────────
  const logout = async () => {
    // Clear local UI state immediately so the button always responds, even if the
    // network sign-out call hangs or errors (e.g. an already-expired token).
    setUser(null);
    setUserProfile(null);
    setUserRole(null);
    // scope:'local' clears the persisted session without a server round-trip that
    // can fail and leave the user "stuck" signed in.
    try { await supabase.auth.signOut({ scope: 'local' }); } catch (e) { console.warn('signOut error (ignored):', e); }
    // Belt-and-braces: remove any lingering supabase session keys.
    try {
      Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k));
    } catch {}
  };

  const registerVehicle = async (vehicle: Vehicle) => {
    if (!user || userRole !== 'customer') return;

    const { error } = await supabase.from('vehicles').upsert({
      owner_id: user.id,
      rego: vehicle.rego.toUpperCase(),
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      variant: vehicle.variant ?? null,
      mileage: vehicle.mileage,
      thumbnail: vehicle.thumbnail ?? null,
    }, { onConflict: 'rego' });

    if (error) throw new Error(error.message);
    setUserProfile(prev => prev ? { ...prev, vehicles: [...(prev.vehicles ?? []), vehicle] } : null);
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    const dbFields = toDbFields(updates);
    if (Object.keys(dbFields).length === 0) return;
    const { error } = await supabase.from('profiles').update(dbFields).eq('id', user.id);
    if (error) throw new Error(error.message);
    setUserProfile(prev => prev ? { ...prev, ...updates } : null);
  };

  const checkPlateExists = async (rego: string) => {
    const formattedRego = rego.toUpperCase().trim();
    const { data } = await supabase
      .from('vehicles')
      .select('rego, make, model, year, owner_id')
      .eq('rego', formattedRego)
      .single();

    return {
      exists: !!data,
      ownerEmail: null,
      vehicle: data ?? undefined,
    };
  };

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      userRole,
      isAuthReady,
      loginMechanic,
      signUpMechanic,
      resendMechanicLink,
      markSubscriptionActive,
      logout,
      registerVehicle,
      updateProfile,
      checkPlateExists,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
