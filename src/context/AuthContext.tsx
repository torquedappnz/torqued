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
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  userRole: 'customer' | 'mechanic' | null;
  isAuthReady: boolean;
  loginWithGoogle: (role: 'customer' | 'mechanic') => Promise<void>;
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

    // First sign-in — create profile
    const lastSelectedRole = (localStorage.getItem('signup_role') as 'customer' | 'mechanic') || 'customer';
    const newProfile = {
      id: supabaseUser.id,
      email: supabaseUser.email ?? '',
      name: supabaseUser.user_metadata?.full_name ?? supabaseUser.user_metadata?.name ?? 'User',
      role: lastSelectedRole,
      subscription_active: lastSelectedRole === 'mechanic' ? false : null,
    };

    const { error } = await supabase.from('profiles').insert(newProfile);
    if (error) console.error('Failed to create profile:', error.message);

    setUserProfile({ ...fromDbRow({ ...newProfile, phone: null, home_location: null, stripe_subscription_id: null }), vehicles: [] });
    setUserRole(lastSelectedRole);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const supabaseUser = session?.user ?? null;
      setUser(supabaseUser);
      if (supabaseUser) {
        await loadProfile(supabaseUser);
      } else {
        setUserProfile(null);
        setUserRole(null);
      }
      setIsAuthReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loginWithGoogle = async (role: 'customer' | 'mechanic') => {
    localStorage.setItem('signup_role', role);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
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
      ownerEmail: null, // Owner email lookup handled server-side for privacy
      vehicle: data ?? undefined,
    };
  };

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      userRole,
      isAuthReady,
      loginWithGoogle,
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
