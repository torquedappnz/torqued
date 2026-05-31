-- ============================================================
-- Torqued: Seed test vehicles (rego lookup database)
-- Add your test plates here and run in Supabase SQL Editor.
-- owner_id must match a real profile id, or use NULL for
-- unregistered plates (OTP will use the fallback email).
-- ============================================================

-- To add a plate without a registered owner (mechanic can still look up):
-- INSERT INTO public.vehicles (rego, make, model, year, variant, mileage)
-- VALUES ('ABC123', 'Toyota', 'Corolla', 2019, '1.8L Petrol', 85000);

-- Example plates — replace with real ones:
INSERT INTO public.vehicles (rego, make, model, year, variant, mileage, thumbnail)
VALUES
  ('RAH190', 'Volkswagen', 'Golf GTE', 2017, '1.4TSI/6DSG DQ400e Plug-In Hybrid', 105400,
   'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&q=80&w=400'),
  ('CGA689', 'Toyota', 'Yaris', 2004, '1.3L Petrol Manual', 220000,
   'https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&q=80&w=400'),
  ('MTESLA', 'Tesla', 'Model 3', 2020, 'Long Range Dual Motor', 120000,
   'https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&q=80&w=400')
ON CONFLICT (rego) DO NOTHING;

-- To add more plates, copy this pattern:
-- INSERT INTO public.vehicles (rego, make, model, year, variant, mileage)
-- VALUES ('YOUR_REGO', 'Make', 'Model', Year, 'Variant', Mileage)
-- ON CONFLICT (rego) DO NOTHING;
