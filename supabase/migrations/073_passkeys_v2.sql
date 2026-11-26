-- 073: Passkeys v2 — device labels, sync status, last used, relying party.
-- Safe to run more than once. Passkeys keep working before this runs
-- (the server falls back to the original columns).

alter table public.webauthn_credentials add column if not exists device_name  text;
alter table public.webauthn_credentials add column if not exists backed_up    boolean;      -- true = synced passkey (iCloud Keychain, Google Password Manager, 1Password…)
alter table public.webauthn_credentials add column if not exists last_used_at timestamptz;
alter table public.webauthn_credentials add column if not exists rp_id        text;         -- 'torqued.site' (or 'localhost' in development)

-- Customer passkeys are now keyed by the customer's email (lower case).
update public.webauthn_credentials set owner_ref = lower(owner_ref) where owner_ref <> lower(owner_ref);
