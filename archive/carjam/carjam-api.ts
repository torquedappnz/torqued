/**
 * ARCHIVED — CarJam NZ plate lookup integration
 *
 * WHY ARCHIVED (June 2026):
 * CarJam is a paid API (~$0.xx per lookup). We switched to the NZ Government
 * FuelSaver (VFEL) API which is free and provides equivalent vehicle
 * identification data (make, model, submodel, year, engine size, transmission,
 * fuel type). CarJam's only unique fields not available from FuelSaver are:
 *   - VIN
 *   - stolenFlag (reported_stolen)
 *   - latestOdometer
 * If stolen-vehicle checking or VIN lookups become important, re-enable
 * CarJam selectively for those use cases only.
 *
 * HOW TO RE-ENABLE:
 * 1. Copy callCarjamAPI back into server.ts (above lookupPlateData).
 * 2. Restore the `callCarjamAPI(plate)` call inside lookupPlateData so it
 *    runs before callFuelSaverAPI (as the primary, FuelSaver as fallback).
 * 3. Restore the /api/rego/carjam endpoint.
 * 4. Ensure CARJAM_API_KEY is set in Vercel env vars.
 *
 * API KEY (last known, may have expired):
 *   8339E46EF74F7BA34A6BC1DA5572EAF290875E8F
 *   Set via env var: CARJAM_API_KEY
 */

// ── Shared types (still live in server.ts) ──────────────────────────────────
// CarjamVehicle interface is kept active in server.ts because FuelSaver reuses
// the same shape. Do not duplicate it here.

// ── Fuel code normaliser ────────────────────────────────────────────────────
// CarJam returns numeric codes; FuelSaver returns plain strings so this is not
// needed for FuelSaver lookups.
function normaliseCarjamFuel(code: string | null): string | null {
  if (!code) return null;
  const map: Record<string, string> = {
    '01': 'Petrol', '02': 'Diesel', '04': 'Electric', '05': 'LPG',
    '06': 'Petrol/Electric', '07': 'Diesel/Electric', '08': 'CNG',
  };
  return map[code] || code;
}

// ── CarJam API caller ────────────────────────────────────────────────────────
async function callCarjamAPI(plate: string): Promise<any | null> {
  const key = process.env.CARJAM_API_KEY || '8339E46EF74F7BA34A6BC1DA5572EAF290875E8F';
  try {
    const url = `https://www.carjam.co.nz/api/car/?plate=${encodeURIComponent(plate)}&key=${key}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;
    const d = await resp.json() as any;
    if (!d?.make || !d?.model) return null;
    const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    return {
      make: titleCase(String(d.make)),
      model: String(d.model),
      year: parseInt(d.year_of_manufacture, 10) || new Date().getFullYear(),
      variant: String(d.submodel || '').trim(),
      vin: d.vin ? String(d.vin).trim() : null,
      engineCc: d.cc_rating ? parseInt(d.cc_rating, 10) || null : null,
      transmissionType: d.transmission_type ? String(d.transmission_type) : null,
      fuelType: normaliseCarjamFuel(d.fuel_type ? String(d.fuel_type) : null),
      stolenFlag: String(d.reported_stolen || 'N').toUpperCase() === 'Y',
      latestOdometer: d.latest_odometer_reading ? parseInt(d.latest_odometer_reading, 10) || null : null,
      power: d.power ? parseInt(d.power, 10) || null : null,
      rawMake: String(d.make),
    };
  } catch (err: any) {
    console.warn('[carjam] lookup failed:', err?.message);
    return null;
  }
}

// ── Archived endpoint ────────────────────────────────────────────────────────
// Was registered as: GET /api/rego/carjam?plate=ABC123
// app.get('/api/rego/carjam', async (req, res) => {
//   const plate = String(req.query.plate || '').toUpperCase().trim();
//   if (!plate) return res.status(400).json({ error: 'plate required' });
//   const data = await callCarjamAPI(plate);
//   if (!data) return res.status(404).json({ error: 'Vehicle not found via Carjam' });
//   res.json(data);
// });
