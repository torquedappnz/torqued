import { startRegistration, startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';

export type ActorType = 'customer' | 'mechanic' | 'admin';

export const passkeysSupported = () => {
  try { return browserSupportsWebAuthn(); } catch { return false; }
};

/** Register a new passkey for the given actor. Throws on failure / user cancel. */
export async function registerPasskey(actorType: ActorType, ownerRef: string): Promise<void> {
  const optRes = await fetch('/api/passkey/register-options', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actorType, ownerRef }),
  });
  const optData = await optRes.json();
  if (!optRes.ok) throw new Error(optData.error || 'Could not start passkey setup');

  const attResp = await startRegistration({ optionsJSON: optData.options });

  const verRes = await fetch('/api/passkey/register-verify', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeToken: optData.challengeToken, response: attResp }),
  });
  const verData = await verRes.json();
  if (!verRes.ok || !verData.success) throw new Error(verData.error || 'Could not save passkey');
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
}

/** Authenticate with a passkey. ownerRef optional (usernameless for discoverable creds). */
export async function authPasskey(actorType: ActorType, ownerRef?: string): Promise<PasskeyAuthResult> {
  const optRes = await fetch('/api/passkey/auth-options', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actorType, ownerRef }),
  });
  const optData = await optRes.json();
  if (!optRes.ok) throw new Error(optData.error || 'No passkey found');

  const authResp = await startAuthentication({ optionsJSON: optData.options });

  const verRes = await fetch('/api/passkey/auth-verify', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeToken: optData.challengeToken, response: authResp }),
  });
  const verData = await verRes.json();
  if (!verRes.ok || !verData.success) throw new Error(verData.error || 'Passkey sign-in failed');
  return verData as PasskeyAuthResult;
}
