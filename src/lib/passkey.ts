import { startRegistration, startAuthentication, browserSupportsWebAuthn, browserSupportsWebAuthnAutofill, WebAuthnAbortService } from '@simplewebauthn/browser';
import { supabase } from './supabase';

export type ActorType = 'customer' | 'mechanic' | 'admin';

const CUSTOMER_SESSION_KEY = 'torqued_customer_session';

export const passkeysSupported = () => {
  try { return browserSupportsWebAuthn(); } catch { return false; }
};

/** Face ID / Touch ID / Windows Hello / Android screen lock available on this device. */
export async function platformPasskeyAvailable(): Promise<boolean> {
  try { return passkeysSupported() && await (window as any).PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }
  catch { return false; }
}

/** Passkeys can be offered in the browser's autofill list (conditional UI). */
export async function passkeyAutofillSupported(): Promise<boolean> {
  try { return await browserSupportsWebAuthnAutofill(); } catch { return false; }
}

/** Stop a pending autofill passkey request (e.g. when the user switches to a code). */
export const cancelPasskeyRequest = () => { try { WebAuthnAbortService.cancelCeremony(); } catch { /* none pending */ } };

/** Proof the caller is signed in: Supabase session (workshop), admin key, or a customer grant. */
async function authHeaders(actorType: ActorType, adminKey?: string): Promise<Record<string, string>> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (actorType === 'mechanic') {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) h.Authorization = `Bearer ${data.session.access_token}`;
  } else if (actorType === 'admin') {
    if (adminKey) h['x-passkey-grant'] = adminKey;
  } else {
    try { const s = JSON.parse(localStorage.getItem(CUSTOMER_SESSION_KEY) || 'null'); if (s?.pkGrant) h['x-passkey-grant'] = s.pkGrant; } catch { /* no session */ }
  }
  return h;
}

/** Plain-English errors for the WebAuthn failures people actually hit. */
function friendlyError(e: any, phase: 'add' | 'signin'): Error {
  const name = e?.name || e?.cause?.name || '';
  const code = e?.code || '';
  if (name === 'NotAllowedError' || code === 'ERROR_CEREMONY_ABORTED') {
    return new Error(phase === 'add' ? 'Passkey setup was cancelled or timed out.' : 'No passkey was chosen. If this device has none, pick “Use a phone or tablet” to scan a QR code, or use another sign-in option.');
  }
  if (name === 'InvalidStateError' || code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED') return Object.assign(new Error('This device already has a Torqued passkey for your account.'), { alreadyRegistered: true });
  if (name === 'SecurityError') return new Error('Passkeys only work on torqued.site — open the site there and try again.');
  if (name === 'AbortError') return Object.assign(new Error('Cancelled.'), { aborted: true });
  return e instanceof Error ? e : new Error(String(e || 'Passkey error'));
}

export interface PasskeyAddResult { added: boolean; alreadyRegistered?: boolean; synced?: boolean }

/**
 * Add a passkey to the signed-in account. ownerRef must be the account email.
 * Resolves { alreadyRegistered: true } if this device already holds one.
 */
export async function registerPasskey(actorType: ActorType, ownerRef: string, opts: { displayName?: string; adminKey?: string } = {}): Promise<PasskeyAddResult> {
  const headers = await authHeaders(actorType, opts.adminKey);
  const optRes = await fetch('/api/passkey/register-options', {
    method: 'POST', headers, body: JSON.stringify({ actorType, ownerRef, displayName: opts.displayName }),
  });
  const optData = await optRes.json().catch(() => ({}));
  if (!optRes.ok) throw new Error(optData.error || 'Could not start passkey setup');
  let attResp;
  try { attResp = await startRegistration({ optionsJSON: optData.options }); }
  catch (e: any) {
    const err: any = friendlyError(e, 'add');
    if (err.alreadyRegistered) return { added: false, alreadyRegistered: true };
    throw err;
  }
  const verRes = await fetch('/api/passkey/register-verify', {
    method: 'POST', headers, body: JSON.stringify({ challengeToken: optData.challengeToken, response: attResp }),
  });
  const verData = await verRes.json().catch(() => ({}));
  if (verRes.status === 409) return { added: false, alreadyRegistered: true };
  if (!verRes.ok || !verData.success) throw new Error(verData.error || 'Could not save passkey');
  return { added: true, synced: !!verData.synced };
}

export interface PasskeyAuthResult {
  actorType: ActorType;
  // admin
  key?: string;
  // mechanic
  email?: string;
  tokenHash?: string | null;
  // customer
  rego?: string;
  ownerId?: string | null;
  vehicles?: any[];
  vt?: string | null;
  pkGrant?: string | null;
}

/**
 * Sign in with a passkey. ownerRef (email, or a customer's plate) is optional: without it,
 * or if the server knows no passkey for it, any Torqued passkey on this device — or on a
 * phone via QR — can be used. autofill: offer passkeys in the field's autofill list instead
 * of a dialog (the input needs autocomplete="username webauthn").
 */
export async function authPasskey(actorType: ActorType, ownerRef?: string, opts: { autofill?: boolean } = {}): Promise<PasskeyAuthResult> {
  const optRes = await fetch('/api/passkey/auth-options', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actorType, ownerRef: opts.autofill ? undefined : ownerRef }),
  });
  const optData = await optRes.json().catch(() => ({}));
  if (!optRes.ok) throw new Error(optData.error || 'Could not start passkey sign-in');
  let authResp;
  try { authResp = await startAuthentication({ optionsJSON: optData.options, useBrowserAutofill: !!opts.autofill }); }
  catch (e: any) { throw friendlyError(e, 'signin'); }
  const verRes = await fetch('/api/passkey/auth-verify', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeToken: optData.challengeToken, response: authResp }),
  });
  const verData = await verRes.json().catch(() => ({}));
  if (!verRes.ok || !verData.success) throw new Error(verData.error || 'Passkey sign-in failed');
  return verData as PasskeyAuthResult;
}

/** Whether this account (email, or a customer's plate) has a passkey. */
export async function hasPasskey(actorType: ActorType, ownerRef: string): Promise<boolean> {
  if (!ownerRef) return false;
  try {
    const r = await fetch(`/api/passkey/has?actorType=${encodeURIComponent(actorType)}&ownerRef=${encodeURIComponent(ownerRef)}`);
    const d = await r.json();
    return !!d.has;
  } catch { return false; }
}

export interface PasskeyRow { id: string; created_at: string; device_name?: string | null; backed_up?: boolean | null; last_used_at?: string | null; transports?: string[] | null }

/** The signed-in account's passkeys. */
export async function listPasskeys(actorType: ActorType, adminKey?: string): Promise<PasskeyRow[]> {
  const r = await fetch(`/api/passkey/list?actorType=${encodeURIComponent(actorType)}`, { headers: await authHeaders(actorType, adminKey) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Could not load passkeys');
  return d.passkeys || [];
}

export async function deletePasskey(actorType: ActorType, id: string, adminKey?: string): Promise<void> {
  const r = await fetch('/api/passkey/delete', { method: 'DELETE', headers: await authHeaders(actorType, adminKey), body: JSON.stringify({ id, actorType }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Could not remove passkey');
}

/** "iPhone · synced · last used 3 Nov" */
export function describePasskey(p: PasskeyRow): string {
  const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  return [p.device_name || 'Passkey', p.backed_up ? 'synced across your devices' : p.backed_up === false ? 'this device only' : null,
    p.last_used_at ? `last used ${fmt(p.last_used_at)}` : `added ${fmt(p.created_at)}`].filter(Boolean).join(' · ');
}
