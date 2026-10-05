SET search_path TO public;

-- ============================================================
-- TORQUED — Migration 069: EA888 1.8 expansion + Audi quattro / Haldex AWD coverage
-- 1. EA888 1.8 TFSI/TSI: adds the NZ used-import staples that were missing
--    (A3 8P/8V incl. quattro, A5 8T, TT 8J, Octavia II, Superb II, Yeti 4x4,
--    Passat CC / B6). Each row carries engine codes + import-style variant
--    aliases ("Sportback 1.8 TFSI quattro", "1.8T") for plate-lookup matching.
-- 2. Two new engine families so transmission service is priced correctly:
--    AUDI_EA888_18_MULTITRONIC (FWD CVT cars, CVT fluid) and
--    AUDI_EA888_20_TSI_LONG (pre-2016 longitudinal; mixed gearboxes → precise quote).
-- 3. Quattro AWD variants: A3/S3/TT/Q3 (Haldex), A4/A5/Q5 (longitudinal).
--    Differential pricing is code-side (server.ts HALDEX_SPEC / QUATTRO_REAR_SPEC):
--    Haldex = ~0.8L Haldex oil + filter, not plain gear oil.
-- Applied directly to production 2026-10-05 (data-only, idempotent).
-- ============================================================

-- ── family AUDI_EA888_18_MULTITRONIC (clone of VW_EA888_18_TSI) ──
INSERT INTO public.engine_families (family_id, common_name, manufacturer, displacement_l, cylinders, fuel, timing_type, cambelt_interval_km, cambelt_interval_years, oil_spec, oil_capacity_l, coolant_spec, segment_tier, service_interval_km, service_interval_months, notes)
SELECT 'AUDI_EA888_18_MULTITRONIC', 'Audi EA888 1.8 TFSI + Multitronic CVT (FWD)', manufacturer, displacement_l, cylinders, fuel, timing_type, cambelt_interval_km, cambelt_interval_years, oil_spec, oil_capacity_l, coolant_spec, segment_tier, service_interval_km, service_interval_months, 'FWD Audi A4 B8 / A5 8T 1.8 TFSI with Multitronic CVT (01J/0AW) — separate from the DSG-equipped EA888 1.8 so the transmission service is priced as CVT fluid, not wet-DSG fluid. Multitronic is fluid-sensitive: use the VAG-spec CVT fluid only; ~6L service exchange (estimate, confidence 2). Gen1/2 EA888 1.8 have a known piston-ring oil-consumption issue and timing-chain tensioner wear — flag at intake.'
FROM public.engine_families WHERE family_id = 'VW_EA888_18_TSI'
ON CONFLICT (family_id) DO NOTHING;

INSERT INTO public.engine_family_fluids (engine_family_id, oil_fluid_id, coolant_fluid_id, trans_fluid_id, brake_fluid_id)
SELECT 'AUDI_EA888_18_MULTITRONIC', oil_fluid_id, coolant_fluid_id, 'TRANS_CVT', brake_fluid_id
FROM public.engine_family_fluids WHERE engine_family_id = 'VW_EA888_18_TSI'
ON CONFLICT (engine_family_id) DO NOTHING;

INSERT INTO public.service_schedule (engine_family_id, coolant_capacity_l, trans_capacity_l, oil_interval_km, oil_interval_months, coolant_interval_km, coolant_interval_months, brake_fluid_interval_months, trans_interval_km, aircon_refrigerant, confidence, notes)
SELECT 'AUDI_EA888_18_MULTITRONIC', coolant_capacity_l, 6, oil_interval_km, oil_interval_months, coolant_interval_km, coolant_interval_months, brake_fluid_interval_months, 60000, aircon_refrigerant, confidence, 'Multitronic CVT service-exchange volume (~6L, estimate)'
FROM public.service_schedule WHERE engine_family_id = 'VW_EA888_18_TSI'
ON CONFLICT (engine_family_id) DO NOTHING;

INSERT INTO public.ef_parts_data (engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
SELECT 'AUDI_EA888_18_MULTITRONIC', category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes
FROM public.ef_parts_data WHERE engine_family_id = 'VW_EA888_18_TSI'
ON CONFLICT (engine_family_id, category_id) DO NOTHING;

-- ── family AUDI_EA888_20_TSI_LONG (clone of VW_EA888_20_TSI) ──
INSERT INTO public.engine_families (family_id, common_name, manufacturer, displacement_l, cylinders, fuel, timing_type, cambelt_interval_km, cambelt_interval_years, oil_spec, oil_capacity_l, coolant_spec, segment_tier, service_interval_km, service_interval_months, notes)
SELECT 'AUDI_EA888_20_TSI_LONG', 'Audi EA888 2.0 TFSI (pre-2016 longitudinal: A4 B8 / A5 8T / Q5 8R)', manufacturer, displacement_l, cylinders, fuel, timing_type, cambelt_interval_km, cambelt_interval_years, oil_spec, oil_capacity_l, coolant_spec, segment_tier, service_interval_km, service_interval_months, 'Longitudinal 2.0 TFSI in A4 B8, A5 8T and Q5 8R. Transmission varies by car (6-speed manual, Multitronic CVT, 7-speed S tronic DL501, 8-speed tiptronic) with different fluids/capacities, so no transmission service is priced — it routes to a precise workshop quote instead of guessing a DSG figure.'
FROM public.engine_families WHERE family_id = 'VW_EA888_20_TSI'
ON CONFLICT (family_id) DO NOTHING;

INSERT INTO public.engine_family_fluids (engine_family_id, oil_fluid_id, coolant_fluid_id, trans_fluid_id, brake_fluid_id)
SELECT 'AUDI_EA888_20_TSI_LONG', oil_fluid_id, coolant_fluid_id, NULL, brake_fluid_id
FROM public.engine_family_fluids WHERE engine_family_id = 'VW_EA888_20_TSI'
ON CONFLICT (engine_family_id) DO NOTHING;

INSERT INTO public.service_schedule (engine_family_id, coolant_capacity_l, trans_capacity_l, oil_interval_km, oil_interval_months, coolant_interval_km, coolant_interval_months, brake_fluid_interval_months, trans_interval_km, aircon_refrigerant, confidence, notes)
SELECT 'AUDI_EA888_20_TSI_LONG', coolant_capacity_l, NULL, oil_interval_km, oil_interval_months, coolant_interval_km, coolant_interval_months, brake_fluid_interval_months, NULL, aircon_refrigerant, confidence, 'Transmission varies — precise quote'
FROM public.service_schedule WHERE engine_family_id = 'VW_EA888_20_TSI'
ON CONFLICT (engine_family_id) DO NOTHING;

INSERT INTO public.ef_parts_data (engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
SELECT 'AUDI_EA888_20_TSI_LONG', category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes
FROM public.ef_parts_data WHERE engine_family_id = 'VW_EA888_20_TSI'
ON CONFLICT (engine_family_id, category_id) DO NOTHING;

-- ── fleet_vehicles ──
INSERT INTO public.fleet_vehicles (vehicle_id, make, model, submodel, chassis_code, year_from, year_to, engine_family_id, fuel, body_type, drivetrain, notes) VALUES
  ('AUDI_A3_8P_18TFSI_08_13', 'Audi', 'A3', '1.8 TFSI', '8P', 2008, 2013, 'VW_EA888_18_TSI', 'petrol', 'hatch', 'fwd', 'A3/Sportback 8P facelift 1.8 TFSI (BZB) + 6sp S tronic (DQ250) or 6MT. Common UK/JDM import.'),
  ('AUDI_A3_8V_18TFSI_13_20', 'Audi', 'A3', '1.8 TFSI', '8V', 2013, 2020, 'VW_EA888_18_TSI', 'petrol', 'hatch', 'fwd', 'A3/Sportback/Sedan 8V 1.8 TFSI (CJSA, EA888 gen3) + 7sp S tronic.'),
  ('AUDI_A3_8V_18TFSI_QUATTRO_13_20', 'Audi', 'A3', '1.8 TFSI quattro', '8V', 2013, 2020, 'VW_EA888_18_TSI', 'petrol', 'hatch', 'awd', 'A3 Sportback 8V 1.8 TFSI quattro + 7sp S tronic — Haldex AWD. Sold new in Japan/UK; common JDM import.'),
  ('AUDI_TT_8J_18TFSI_08_14', 'Audi', 'TT', '1.8 TFSI', '8J', 2008, 2014, 'VW_EA888_18_TSI', 'petrol', 'coupe', 'fwd', 'TT 8J 1.8 TFSI (CDAA) FWD + S tronic/6MT.'),
  ('SKODA_OCTAVIA_1Z_18TSI_09_13', 'Skoda', 'Octavia', '1.8 TSI', '1Z', 2009, 2013, 'VW_EA888_18_TSI', 'petrol', 'hatch', 'fwd', 'Octavia II facelift 1.8 TSI (CDAA) + DQ250 DSG/6MT. Common UK import.'),
  ('SKODA_SUPERB_3T_18TSI_08_15', 'Skoda', 'Superb', '1.8 TSI', '3T', 2008, 2015, 'VW_EA888_18_TSI', 'petrol', 'hatch', 'fwd', 'Superb II 1.8 TSI (CDAB) + DQ250 DSG/6MT.'),
  ('SKODA_YETI_5L_18TSI_4X4_10_17', 'Skoda', 'Yeti', '1.8 TSI 4x4', '5L', 2010, 2017, 'VW_EA888_18_TSI', 'petrol', 'suv', 'awd', 'Yeti 1.8 TSI 4x4 (CDAB) — Haldex AWD + DQ250 DSG/6MT.'),
  ('VW_PASSAT_CC_18TSI_08_12', 'Volkswagen', 'Passat CC', '1.8 TSI', '35', 2008, 2012, 'VW_EA888_18_TSI', 'petrol', 'sedan', 'fwd', 'Passat CC 1.8 TSI (CDAB) + DQ250 DSG.'),
  ('VW_PASSAT_B6_18TSI_08_10', 'Volkswagen', 'Passat', '1.8 TSI (B6)', 'B6', 2008, 2010, 'VW_EA888_18_TSI', 'petrol', 'sedan', 'fwd', 'Passat B6 1.8 TSI (BZB) + DQ250 DSG/6MT.'),
  ('AUDI_A5_8T_18TFSI_08_16', 'Audi', 'A5', '1.8 TFSI', '8T', 2008, 2016, 'AUDI_EA888_18_MULTITRONIC', 'petrol', 'coupe', 'fwd', 'A5/Sportback/Cabriolet 8T 1.8 TFSI (CDHA/CJEB) FWD + Multitronic CVT or 6MT.'),
  ('AUDI_S3_8P_20TFSI_06_12', 'Audi', 'S3', '2.0 TFSI quattro', '8P', 2006, 2012, 'VW_EA113_20_TFSI', 'petrol', 'hatch', 'awd', 'S3 8P 2.0 TFSI (CDLB) quattro — Haldex AWD + 6sp S tronic (DQ250)/6MT.'),
  ('AUDI_TT_8J_20TFSI_QUATTRO_08_14', 'Audi', 'TT', '2.0 TFSI quattro', '8J', 2008, 2014, 'VW_EA888_20_TSI', 'petrol', 'coupe', 'awd', 'TT 8J 2.0 TFSI quattro (CDLA/CESA) — Haldex AWD + S tronic/6MT.'),
  ('AUDI_TT_8S_20TFSI_QUATTRO_15_NOW', 'Audi', 'TT', '2.0 TFSI quattro', '8S', 2015, NULL, 'VW_EA888_20_TSI', 'petrol', 'coupe', 'awd', 'TT 8S 2.0 TFSI quattro — Haldex gen5 AWD + 6sp S tronic.'),
  ('AUDI_Q3_8U_20TFSI_QUATTRO_11_18', 'Audi', 'Q3', '2.0 TFSI quattro', '8U', 2011, 2018, 'VW_EA888_20_TSI', 'petrol', 'suv', 'awd', 'Q3 8U 2.0 TFSI quattro (CULA) — Haldex AWD + 7sp S tronic. Common JDM/UK import.'),
  ('AUDI_Q3_F3_20TFSI_QUATTRO_18_NOW', 'Audi', 'Q3', '2.0 TFSI quattro', 'F3', 2018, NULL, 'VW_EA888_20_TSI', 'petrol', 'suv', 'awd', 'Q3 F3 40/45 TFSI quattro — Haldex AWD + 7sp S tronic.'),
  ('AUDI_A4_B8_20TFSI_QUATTRO_08_15', 'Audi', 'A4', '2.0 TFSI quattro', 'B8', 2008, 2015, 'AUDI_EA888_20_TSI_LONG', 'petrol', 'sedan', 'awd', 'A4/Avant/allroad B8 2.0 TFSI quattro (CDNC/CNCD) — Torsen/crown-gear centre diff. Transmission varies (6MT / S tronic / tiptronic).'),
  ('AUDI_A5_8T_20TFSI_QUATTRO_08_16', 'Audi', 'A5', '2.0 TFSI quattro', '8T', 2008, 2016, 'AUDI_EA888_20_TSI_LONG', 'petrol', 'coupe', 'awd', 'A5/Sportback/Cabriolet 8T 2.0 TFSI quattro (CDNC/CNCD). Transmission varies.'),
  ('AUDI_Q5_8R_20TFSI_QUATTRO_08_17', 'Audi', 'Q5', '2.0 TFSI quattro', '8R', 2008, 2017, 'AUDI_EA888_20_TSI_LONG', 'petrol', 'suv', 'awd', 'Q5 8R 2.0 TFSI quattro (CNCD) — Torsen/crown-gear centre diff. Transmission varies (6MT / S tronic DL501 / tiptronic).'),
  ('AUDI_A4_B9_20TFSI_QUATTRO_15_NOW', 'Audi', 'A4', '2.0 TFSI quattro', 'B9', 2015, NULL, 'VW_EA888_20_TSI', 'petrol', 'sedan', 'awd', 'A4/Avant/allroad B9 2.0 TFSI quattro (ultra on most) + 7sp S tronic (DL382).'),
  ('AUDI_A5_F5_20TFSI_QUATTRO_16_NOW', 'Audi', 'A5', '2.0 TFSI quattro', 'F5', 2016, NULL, 'VW_EA888_20_TSI', 'petrol', 'coupe', 'awd', 'A5/Sportback/Cabriolet F5 2.0 TFSI quattro (ultra) + 7sp S tronic (DL382).')
ON CONFLICT (vehicle_id) DO NOTHING;

-- ── aliases (import-friendly variant strings + engine codes; no unique key, so guarded) ──
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A3_8P_18TFSI_08_13', 'Audi', 'A3', '1.8 TFSI', 2008, 2013, 'BZB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A3_8P_18TFSI_08_13' AND lower(alias_variant) = lower('1.8 TFSI'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A3_8P_18TFSI_08_13', 'Audi', 'A3', '1.8T', 2008, 2013, 'BZB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A3_8P_18TFSI_08_13' AND lower(alias_variant) = lower('1.8T'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A3_8P_18TFSI_08_13', 'Audi', 'A3', 'Sportback 1.8 TFSI', 2008, 2013, 'BZB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A3_8P_18TFSI_08_13' AND lower(alias_variant) = lower('Sportback 1.8 TFSI'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A3_8P_18TFSI_08_13', 'Audi', 'A3', 'BZB', 2008, 2013, 'BZB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A3_8P_18TFSI_08_13' AND lower(alias_variant) = lower('BZB'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A3_8V_18TFSI_13_20', 'Audi', 'A3', '1.8 TFSI', 2013, 2020, 'CJSA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A3_8V_18TFSI_13_20' AND lower(alias_variant) = lower('1.8 TFSI'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A3_8V_18TFSI_13_20', 'Audi', 'A3', '1.8T', 2013, 2020, 'CJSA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A3_8V_18TFSI_13_20' AND lower(alias_variant) = lower('1.8T'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A3_8V_18TFSI_13_20', 'Audi', 'A3', 'Sportback 1.8 TFSI', 2013, 2020, 'CJSA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A3_8V_18TFSI_13_20' AND lower(alias_variant) = lower('Sportback 1.8 TFSI'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A3_8V_18TFSI_13_20', 'Audi', 'A3', 'CJSA', 2013, 2020, 'CJSA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A3_8V_18TFSI_13_20' AND lower(alias_variant) = lower('CJSA'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A3_8V_18TFSI_QUATTRO_13_20', 'Audi', 'A3', '1.8 TFSI quattro', 2013, 2020, 'CJSA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A3_8V_18TFSI_QUATTRO_13_20' AND lower(alias_variant) = lower('1.8 TFSI quattro'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A3_8V_18TFSI_QUATTRO_13_20', 'Audi', 'A3', '1.8T quattro', 2013, 2020, 'CJSA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A3_8V_18TFSI_QUATTRO_13_20' AND lower(alias_variant) = lower('1.8T quattro'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A3_8V_18TFSI_QUATTRO_13_20', 'Audi', 'A3', 'Sportback 1.8 TFSI quattro', 2013, 2020, 'CJSA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A3_8V_18TFSI_QUATTRO_13_20' AND lower(alias_variant) = lower('Sportback 1.8 TFSI quattro'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A3_8V_18TFSI_QUATTRO_13_20', 'Audi', 'A3', 'CJSA quattro', 2013, 2020, 'CJSA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A3_8V_18TFSI_QUATTRO_13_20' AND lower(alias_variant) = lower('CJSA quattro'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_TT_8J_18TFSI_08_14', 'Audi', 'TT', '1.8 TFSI', 2008, 2014, 'CDAA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_TT_8J_18TFSI_08_14' AND lower(alias_variant) = lower('1.8 TFSI'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_TT_8J_18TFSI_08_14', 'Audi', 'TT', '1.8T', 2008, 2014, 'CDAA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_TT_8J_18TFSI_08_14' AND lower(alias_variant) = lower('1.8T'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_TT_8J_18TFSI_08_14', 'Audi', 'TT', 'Coupe 1.8 TFSI', 2008, 2014, 'CDAA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_TT_8J_18TFSI_08_14' AND lower(alias_variant) = lower('Coupe 1.8 TFSI'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_TT_8J_18TFSI_08_14', 'Audi', 'TT', 'CDAA', 2008, 2014, 'CDAA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_TT_8J_18TFSI_08_14' AND lower(alias_variant) = lower('CDAA'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'SKODA_OCTAVIA_1Z_18TSI_09_13', 'Skoda', 'Octavia', '1.8 TSI', 2009, 2013, 'CDAA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'SKODA_OCTAVIA_1Z_18TSI_09_13' AND lower(alias_variant) = lower('1.8 TSI'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'SKODA_OCTAVIA_1Z_18TSI_09_13', 'Skoda', 'Octavia', '1.8T', 2009, 2013, 'CDAA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'SKODA_OCTAVIA_1Z_18TSI_09_13' AND lower(alias_variant) = lower('1.8T'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'SKODA_OCTAVIA_1Z_18TSI_09_13', 'Skoda', 'Octavia', '1.8 TSI Elegance', 2009, 2013, 'CDAA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'SKODA_OCTAVIA_1Z_18TSI_09_13' AND lower(alias_variant) = lower('1.8 TSI Elegance'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'SKODA_OCTAVIA_1Z_18TSI_09_13', 'Skoda', 'Octavia', 'CDAA', 2009, 2013, 'CDAA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'SKODA_OCTAVIA_1Z_18TSI_09_13' AND lower(alias_variant) = lower('CDAA'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'SKODA_SUPERB_3T_18TSI_08_15', 'Skoda', 'Superb', '1.8 TSI', 2008, 2015, 'CDAB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'SKODA_SUPERB_3T_18TSI_08_15' AND lower(alias_variant) = lower('1.8 TSI'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'SKODA_SUPERB_3T_18TSI_08_15', 'Skoda', 'Superb', '1.8T', 2008, 2015, 'CDAB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'SKODA_SUPERB_3T_18TSI_08_15' AND lower(alias_variant) = lower('1.8T'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'SKODA_SUPERB_3T_18TSI_08_15', 'Skoda', 'Superb', '1.8 TSI Elegance', 2008, 2015, 'CDAB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'SKODA_SUPERB_3T_18TSI_08_15' AND lower(alias_variant) = lower('1.8 TSI Elegance'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'SKODA_SUPERB_3T_18TSI_08_15', 'Skoda', 'Superb', 'CDAB', 2008, 2015, 'CDAB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'SKODA_SUPERB_3T_18TSI_08_15' AND lower(alias_variant) = lower('CDAB'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'SKODA_YETI_5L_18TSI_4X4_10_17', 'Skoda', 'Yeti', '1.8 TSI 4x4', 2010, 2017, 'CDAB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'SKODA_YETI_5L_18TSI_4X4_10_17' AND lower(alias_variant) = lower('1.8 TSI 4x4'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'SKODA_YETI_5L_18TSI_4X4_10_17', 'Skoda', 'Yeti', '1.8 TSI Elegance 4x4', 2010, 2017, 'CDAB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'SKODA_YETI_5L_18TSI_4X4_10_17' AND lower(alias_variant) = lower('1.8 TSI Elegance 4x4'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'SKODA_YETI_5L_18TSI_4X4_10_17', 'Skoda', 'Yeti', '1.8T 4x4', 2010, 2017, 'CDAB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'SKODA_YETI_5L_18TSI_4X4_10_17' AND lower(alias_variant) = lower('1.8T 4x4'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'SKODA_YETI_5L_18TSI_4X4_10_17', 'Skoda', 'Yeti', 'CDAB', 2010, 2017, 'CDAB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'SKODA_YETI_5L_18TSI_4X4_10_17' AND lower(alias_variant) = lower('CDAB'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_PASSAT_CC_18TSI_08_12', 'Volkswagen', 'Passat CC', '1.8 TSI', 2008, 2012, 'CDAB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_PASSAT_CC_18TSI_08_12' AND lower(alias_variant) = lower('1.8 TSI'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_PASSAT_CC_18TSI_08_12', 'Volkswagen', 'Passat CC', '1.8T', 2008, 2012, 'CDAB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_PASSAT_CC_18TSI_08_12' AND lower(alias_variant) = lower('1.8T'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_PASSAT_CC_18TSI_08_12', 'Volkswagen', 'Passat CC', 'CDAB', 2008, 2012, 'CDAB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_PASSAT_CC_18TSI_08_12' AND lower(alias_variant) = lower('CDAB'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_PASSAT_B6_18TSI_08_10', 'Volkswagen', 'Passat', '1.8 TSI', 2008, 2010, 'BZB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_PASSAT_B6_18TSI_08_10' AND lower(alias_variant) = lower('1.8 TSI'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_PASSAT_B6_18TSI_08_10', 'Volkswagen', 'Passat', '1.8 TSI B6', 2008, 2010, 'BZB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_PASSAT_B6_18TSI_08_10' AND lower(alias_variant) = lower('1.8 TSI B6'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_PASSAT_B6_18TSI_08_10', 'Volkswagen', 'Passat', '1.8T', 2008, 2010, 'BZB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_PASSAT_B6_18TSI_08_10' AND lower(alias_variant) = lower('1.8T'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_PASSAT_B6_18TSI_08_10', 'Volkswagen', 'Passat', 'BZB', 2008, 2010, 'BZB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_PASSAT_B6_18TSI_08_10' AND lower(alias_variant) = lower('BZB'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A5_8T_18TFSI_08_16', 'Audi', 'A5', '1.8 TFSI', 2008, 2016, 'CDHA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A5_8T_18TFSI_08_16' AND lower(alias_variant) = lower('1.8 TFSI'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A5_8T_18TFSI_08_16', 'Audi', 'A5', '1.8T', 2008, 2016, 'CDHA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A5_8T_18TFSI_08_16' AND lower(alias_variant) = lower('1.8T'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A5_8T_18TFSI_08_16', 'Audi', 'A5', 'Sportback 1.8 TFSI', 2008, 2016, 'CDHA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A5_8T_18TFSI_08_16' AND lower(alias_variant) = lower('Sportback 1.8 TFSI'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A5_8T_18TFSI_08_16', 'Audi', 'A5', 'CDHA', 2008, 2016, 'CDHA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A5_8T_18TFSI_08_16' AND lower(alias_variant) = lower('CDHA'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A5_8T_18TFSI_08_16', 'Audi', 'A5', 'CJEB', 2008, 2016, 'CDHA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A5_8T_18TFSI_08_16' AND lower(alias_variant) = lower('CJEB'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_S3_8P_20TFSI_06_12', 'Audi', 'S3', '2.0 TFSI quattro', 2006, 2012, 'CDLB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_S3_8P_20TFSI_06_12' AND lower(alias_variant) = lower('2.0 TFSI quattro'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_S3_8P_20TFSI_06_12', 'Audi', 'S3', 'S3 Sportback', 2006, 2012, 'CDLB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_S3_8P_20TFSI_06_12' AND lower(alias_variant) = lower('S3 Sportback'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_S3_8P_20TFSI_06_12', 'Audi', 'S3', 'CDLB', 2006, 2012, 'CDLB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_S3_8P_20TFSI_06_12' AND lower(alias_variant) = lower('CDLB'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_TT_8J_20TFSI_QUATTRO_08_14', 'Audi', 'TT', '2.0 TFSI quattro', 2008, 2014, 'CDLA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_TT_8J_20TFSI_QUATTRO_08_14' AND lower(alias_variant) = lower('2.0 TFSI quattro'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_TT_8J_20TFSI_QUATTRO_08_14', 'Audi', 'TT', 'Coupe 2.0 TFSI quattro', 2008, 2014, 'CDLA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_TT_8J_20TFSI_QUATTRO_08_14' AND lower(alias_variant) = lower('Coupe 2.0 TFSI quattro'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_TT_8J_20TFSI_QUATTRO_08_14', 'Audi', 'TT', 'TTS', 2008, 2014, 'CDLA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_TT_8J_20TFSI_QUATTRO_08_14' AND lower(alias_variant) = lower('TTS'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_TT_8J_20TFSI_QUATTRO_08_14', 'Audi', 'TT', 'CDLA', 2008, 2014, 'CDLA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_TT_8J_20TFSI_QUATTRO_08_14' AND lower(alias_variant) = lower('CDLA'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_TT_8S_20TFSI_QUATTRO_15_NOW', 'Audi', 'TT', '2.0 TFSI quattro', 2015, NULL, 'CJXC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_TT_8S_20TFSI_QUATTRO_15_NOW' AND lower(alias_variant) = lower('2.0 TFSI quattro'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_TT_8S_20TFSI_QUATTRO_15_NOW', 'Audi', 'TT', 'Coupe 2.0 TFSI quattro', 2015, NULL, 'CJXC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_TT_8S_20TFSI_QUATTRO_15_NOW' AND lower(alias_variant) = lower('Coupe 2.0 TFSI quattro'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_TT_8S_20TFSI_QUATTRO_15_NOW', 'Audi', 'TT', '45 TFSI quattro', 2015, NULL, 'CJXC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_TT_8S_20TFSI_QUATTRO_15_NOW' AND lower(alias_variant) = lower('45 TFSI quattro'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_TT_8S_20TFSI_QUATTRO_15_NOW', 'Audi', 'TT', 'CJXC', 2015, NULL, 'CJXC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_TT_8S_20TFSI_QUATTRO_15_NOW' AND lower(alias_variant) = lower('CJXC'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_Q3_8U_20TFSI_QUATTRO_11_18', 'Audi', 'Q3', '2.0 TFSI quattro', 2011, 2018, 'CULA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_Q3_8U_20TFSI_QUATTRO_11_18' AND lower(alias_variant) = lower('2.0 TFSI quattro'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_Q3_8U_20TFSI_QUATTRO_11_18', 'Audi', 'Q3', '2.0 TFSI', 2011, 2018, 'CULA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_Q3_8U_20TFSI_QUATTRO_11_18' AND lower(alias_variant) = lower('2.0 TFSI'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_Q3_8U_20TFSI_QUATTRO_11_18', 'Audi', 'Q3', 'CULA', 2011, 2018, 'CULA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_Q3_8U_20TFSI_QUATTRO_11_18' AND lower(alias_variant) = lower('CULA'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_Q3_F3_20TFSI_QUATTRO_18_NOW', 'Audi', 'Q3', '2.0 TFSI quattro', 2018, NULL, 'DNUA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_Q3_F3_20TFSI_QUATTRO_18_NOW' AND lower(alias_variant) = lower('2.0 TFSI quattro'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_Q3_F3_20TFSI_QUATTRO_18_NOW', 'Audi', 'Q3', '40 TFSI quattro', 2018, NULL, 'DNUA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_Q3_F3_20TFSI_QUATTRO_18_NOW' AND lower(alias_variant) = lower('40 TFSI quattro'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_Q3_F3_20TFSI_QUATTRO_18_NOW', 'Audi', 'Q3', '45 TFSI quattro', 2018, NULL, 'DNUA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_Q3_F3_20TFSI_QUATTRO_18_NOW' AND lower(alias_variant) = lower('45 TFSI quattro'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_Q3_F3_20TFSI_QUATTRO_18_NOW', 'Audi', 'Q3', 'DNUA', 2018, NULL, 'DNUA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_Q3_F3_20TFSI_QUATTRO_18_NOW' AND lower(alias_variant) = lower('DNUA'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A4_B8_20TFSI_QUATTRO_08_15', 'Audi', 'A4', '2.0 TFSI quattro', 2008, 2015, 'CDNC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A4_B8_20TFSI_QUATTRO_08_15' AND lower(alias_variant) = lower('2.0 TFSI quattro'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A4_B8_20TFSI_QUATTRO_08_15', 'Audi', 'A4', 'Avant 2.0 TFSI quattro', 2008, 2015, 'CDNC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A4_B8_20TFSI_QUATTRO_08_15' AND lower(alias_variant) = lower('Avant 2.0 TFSI quattro'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A4_B8_20TFSI_QUATTRO_08_15', 'Audi', 'A4', 'allroad 2.0 TFSI quattro', 2008, 2015, 'CDNC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A4_B8_20TFSI_QUATTRO_08_15' AND lower(alias_variant) = lower('allroad 2.0 TFSI quattro'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A4_B8_20TFSI_QUATTRO_08_15', 'Audi', 'A4', 'CDNC', 2008, 2015, 'CDNC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A4_B8_20TFSI_QUATTRO_08_15' AND lower(alias_variant) = lower('CDNC'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A5_8T_20TFSI_QUATTRO_08_16', 'Audi', 'A5', '2.0 TFSI quattro', 2008, 2016, 'CDNC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A5_8T_20TFSI_QUATTRO_08_16' AND lower(alias_variant) = lower('2.0 TFSI quattro'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A5_8T_20TFSI_QUATTRO_08_16', 'Audi', 'A5', 'Sportback 2.0 TFSI quattro', 2008, 2016, 'CDNC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A5_8T_20TFSI_QUATTRO_08_16' AND lower(alias_variant) = lower('Sportback 2.0 TFSI quattro'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A5_8T_20TFSI_QUATTRO_08_16', 'Audi', 'A5', 'CDNC', 2008, 2016, 'CDNC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A5_8T_20TFSI_QUATTRO_08_16' AND lower(alias_variant) = lower('CDNC'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_Q5_8R_20TFSI_QUATTRO_08_17', 'Audi', 'Q5', '2.0 TFSI quattro', 2008, 2017, 'CNCD', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_Q5_8R_20TFSI_QUATTRO_08_17' AND lower(alias_variant) = lower('2.0 TFSI quattro'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_Q5_8R_20TFSI_QUATTRO_08_17', 'Audi', 'Q5', '2.0 TFSI', 2008, 2017, 'CNCD', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_Q5_8R_20TFSI_QUATTRO_08_17' AND lower(alias_variant) = lower('2.0 TFSI'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_Q5_8R_20TFSI_QUATTRO_08_17', 'Audi', 'Q5', 'CNCD', 2008, 2017, 'CNCD', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_Q5_8R_20TFSI_QUATTRO_08_17' AND lower(alias_variant) = lower('CNCD'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A4_B9_20TFSI_QUATTRO_15_NOW', 'Audi', 'A4', '2.0 TFSI quattro', 2015, NULL, 'CVKB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A4_B9_20TFSI_QUATTRO_15_NOW' AND lower(alias_variant) = lower('2.0 TFSI quattro'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A4_B9_20TFSI_QUATTRO_15_NOW', 'Audi', 'A4', '40 TFSI quattro', 2015, NULL, 'CVKB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A4_B9_20TFSI_QUATTRO_15_NOW' AND lower(alias_variant) = lower('40 TFSI quattro'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A4_B9_20TFSI_QUATTRO_15_NOW', 'Audi', 'A4', '45 TFSI quattro', 2015, NULL, 'CVKB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A4_B9_20TFSI_QUATTRO_15_NOW' AND lower(alias_variant) = lower('45 TFSI quattro'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A4_B9_20TFSI_QUATTRO_15_NOW', 'Audi', 'A4', 'Avant 2.0 TFSI quattro', 2015, NULL, 'CVKB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A4_B9_20TFSI_QUATTRO_15_NOW' AND lower(alias_variant) = lower('Avant 2.0 TFSI quattro'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A4_B9_20TFSI_QUATTRO_15_NOW', 'Audi', 'A4', 'CVKB', 2015, NULL, 'CVKB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A4_B9_20TFSI_QUATTRO_15_NOW' AND lower(alias_variant) = lower('CVKB'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A5_F5_20TFSI_QUATTRO_16_NOW', 'Audi', 'A5', '2.0 TFSI quattro', 2016, NULL, 'DETA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A5_F5_20TFSI_QUATTRO_16_NOW' AND lower(alias_variant) = lower('2.0 TFSI quattro'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A5_F5_20TFSI_QUATTRO_16_NOW', 'Audi', 'A5', '40 TFSI quattro', 2016, NULL, 'DETA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A5_F5_20TFSI_QUATTRO_16_NOW' AND lower(alias_variant) = lower('40 TFSI quattro'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A5_F5_20TFSI_QUATTRO_16_NOW', 'Audi', 'A5', '45 TFSI quattro', 2016, NULL, 'DETA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A5_F5_20TFSI_QUATTRO_16_NOW' AND lower(alias_variant) = lower('45 TFSI quattro'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A5_F5_20TFSI_QUATTRO_16_NOW', 'Audi', 'A5', 'DETA', 2016, NULL, 'DETA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A5_F5_20TFSI_QUATTRO_16_NOW' AND lower(alias_variant) = lower('DETA'));

-- ── variant picker rows ──
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Audi', 'A3', '1.8 TFSI', '8P', 'BZB', 2008, 2013, 'petrol', 1800, 'dct', 'fwd', 'hatch', 'chain', 'A3/Sportback 8P facelift 1.8 TFSI (BZB) + 6sp S tronic (DQ250) or 6MT. Common UK/JDM import.'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Audi') AND lower(model) = lower('A3') AND lower(submodel) = lower('1.8 TFSI') AND year_from = 2008);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Audi', 'A3', '1.8 TFSI', '8V', 'CJSA', 2013, 2020, 'petrol', 1800, 'dct', 'fwd', 'hatch', 'chain', 'A3/Sportback/Sedan 8V 1.8 TFSI (CJSA, EA888 gen3) + 7sp S tronic.'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Audi') AND lower(model) = lower('A3') AND lower(submodel) = lower('1.8 TFSI') AND year_from = 2013);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Audi', 'A3', '1.8 TFSI quattro', '8V', 'CJSA', 2013, 2020, 'petrol', 1800, 'dct', 'awd', 'hatch', 'chain', 'A3 Sportback 8V 1.8 TFSI quattro + 7sp S tronic — Haldex AWD. Sold new in Japan/UK; common JDM import.'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Audi') AND lower(model) = lower('A3') AND lower(submodel) = lower('1.8 TFSI quattro') AND year_from = 2013);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Audi', 'TT', '1.8 TFSI', '8J', 'CDAA', 2008, 2014, 'petrol', 1800, 'dct', 'fwd', 'coupe', 'chain', 'TT 8J 1.8 TFSI (CDAA) FWD + S tronic/6MT.'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Audi') AND lower(model) = lower('TT') AND lower(submodel) = lower('1.8 TFSI') AND year_from = 2008);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Skoda', 'Octavia', '1.8 TSI', '1Z', 'CDAA', 2009, 2013, 'petrol', 1800, 'dct', 'fwd', 'hatch', 'chain', 'Octavia II facelift 1.8 TSI (CDAA) + DQ250 DSG/6MT. Common UK import.'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Skoda') AND lower(model) = lower('Octavia') AND lower(submodel) = lower('1.8 TSI') AND year_from = 2009);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Skoda', 'Superb', '1.8 TSI', '3T', 'CDAB', 2008, 2015, 'petrol', 1800, 'dct', 'fwd', 'hatch', 'chain', 'Superb II 1.8 TSI (CDAB) + DQ250 DSG/6MT.'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Skoda') AND lower(model) = lower('Superb') AND lower(submodel) = lower('1.8 TSI') AND year_from = 2008);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Skoda', 'Yeti', '1.8 TSI 4x4', '5L', 'CDAB', 2010, 2017, 'petrol', 1800, 'dct', 'awd', 'suv', 'chain', 'Yeti 1.8 TSI 4x4 (CDAB) — Haldex AWD + DQ250 DSG/6MT.'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Skoda') AND lower(model) = lower('Yeti') AND lower(submodel) = lower('1.8 TSI 4x4') AND year_from = 2010);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Volkswagen', 'Passat CC', '1.8 TSI', '35', 'CDAB', 2008, 2012, 'petrol', 1800, 'dct', 'fwd', 'sedan', 'chain', 'Passat CC 1.8 TSI (CDAB) + DQ250 DSG.'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Volkswagen') AND lower(model) = lower('Passat CC') AND lower(submodel) = lower('1.8 TSI') AND year_from = 2008);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Volkswagen', 'Passat', '1.8 TSI (B6)', 'B6', 'BZB', 2008, 2010, 'petrol', 1800, 'dct', 'fwd', 'sedan', 'chain', 'Passat B6 1.8 TSI (BZB) + DQ250 DSG/6MT.'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Volkswagen') AND lower(model) = lower('Passat') AND lower(submodel) = lower('1.8 TSI (B6)') AND year_from = 2008);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Audi', 'A5', '1.8 TFSI', '8T', 'CDHA', 2008, 2016, 'petrol', 1800, 'cvt', 'fwd', 'coupe', 'chain', 'A5/Sportback/Cabriolet 8T 1.8 TFSI (CDHA/CJEB) FWD + Multitronic CVT or 6MT.'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Audi') AND lower(model) = lower('A5') AND lower(submodel) = lower('1.8 TFSI') AND year_from = 2008);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Audi', 'S3', '2.0 TFSI quattro', '8P', 'CDLB', 2006, 2012, 'petrol', 2000, 'dct', 'awd', 'hatch', 'belt', 'S3 8P 2.0 TFSI (CDLB) quattro — Haldex AWD + 6sp S tronic (DQ250)/6MT.'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Audi') AND lower(model) = lower('S3') AND lower(submodel) = lower('2.0 TFSI quattro') AND year_from = 2006);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Audi', 'TT', '2.0 TFSI quattro', '8J', 'CDLA', 2008, 2014, 'petrol', 2000, 'dct', 'awd', 'coupe', 'chain', 'TT 8J 2.0 TFSI quattro (CDLA/CESA) — Haldex AWD + S tronic/6MT.'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Audi') AND lower(model) = lower('TT') AND lower(submodel) = lower('2.0 TFSI quattro') AND year_from = 2008);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Audi', 'TT', '2.0 TFSI quattro', '8S', 'CJXC', 2015, NULL, 'petrol', 2000, 'dct', 'awd', 'coupe', 'chain', 'TT 8S 2.0 TFSI quattro — Haldex gen5 AWD + 6sp S tronic.'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Audi') AND lower(model) = lower('TT') AND lower(submodel) = lower('2.0 TFSI quattro') AND year_from = 2015);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Audi', 'Q3', '2.0 TFSI quattro', '8U', 'CULA', 2011, 2018, 'petrol', 2000, 'dct', 'awd', 'suv', 'chain', 'Q3 8U 2.0 TFSI quattro (CULA) — Haldex AWD + 7sp S tronic. Common JDM/UK import.'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Audi') AND lower(model) = lower('Q3') AND lower(submodel) = lower('2.0 TFSI quattro') AND year_from = 2011);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Audi', 'Q3', '2.0 TFSI quattro', 'F3', 'DNUA', 2018, NULL, 'petrol', 2000, 'dct', 'awd', 'suv', 'chain', 'Q3 F3 40/45 TFSI quattro — Haldex AWD + 7sp S tronic.'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Audi') AND lower(model) = lower('Q3') AND lower(submodel) = lower('2.0 TFSI quattro') AND year_from = 2018);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Audi', 'A4', '2.0 TFSI quattro', 'B8', 'CDNC', 2008, 2015, 'petrol', 2000, NULL, 'awd', 'sedan', 'chain', 'A4/Avant/allroad B8 2.0 TFSI quattro (CDNC/CNCD) — Torsen/crown-gear centre diff. Transmission varies (6MT / S tronic / tiptronic).'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Audi') AND lower(model) = lower('A4') AND lower(submodel) = lower('2.0 TFSI quattro') AND year_from = 2008);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Audi', 'A5', '2.0 TFSI quattro', '8T', 'CDNC', 2008, 2016, 'petrol', 2000, NULL, 'awd', 'coupe', 'chain', 'A5/Sportback/Cabriolet 8T 2.0 TFSI quattro (CDNC/CNCD). Transmission varies.'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Audi') AND lower(model) = lower('A5') AND lower(submodel) = lower('2.0 TFSI quattro') AND year_from = 2008);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Audi', 'Q5', '2.0 TFSI quattro', '8R', 'CNCD', 2008, 2017, 'petrol', 2000, NULL, 'awd', 'suv', 'chain', 'Q5 8R 2.0 TFSI quattro (CNCD) — Torsen/crown-gear centre diff. Transmission varies (6MT / S tronic DL501 / tiptronic).'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Audi') AND lower(model) = lower('Q5') AND lower(submodel) = lower('2.0 TFSI quattro') AND year_from = 2008);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Audi', 'A4', '2.0 TFSI quattro', 'B9', 'CVKB', 2015, NULL, 'petrol', 2000, 'dct', 'awd', 'sedan', 'chain', 'A4/Avant/allroad B9 2.0 TFSI quattro (ultra on most) + 7sp S tronic (DL382).'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Audi') AND lower(model) = lower('A4') AND lower(submodel) = lower('2.0 TFSI quattro') AND year_from = 2015);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Audi', 'A5', '2.0 TFSI quattro', 'F5', 'DETA', 2016, NULL, 'petrol', 2000, 'dct', 'awd', 'coupe', 'chain', 'A5/Sportback/Cabriolet F5 2.0 TFSI quattro (ultra) + 7sp S tronic (DL382).'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Audi') AND lower(model) = lower('A5') AND lower(submodel) = lower('2.0 TFSI quattro') AND year_from = 2016);

-- ── repoint rows priced against the wrong transmission ──
UPDATE public.fleet_vehicles SET engine_family_id = 'AUDI_EA888_18_MULTITRONIC' WHERE vehicle_id = 'AUDI_A4_B8_18TFSI_08_15'; -- A4 B8 1.8 TFSI is FWD with Multitronic CVT (or 6MT) — not DSG
UPDATE public.fleet_vehicles SET engine_family_id = 'AUDI_EA888_20_TSI_LONG' WHERE vehicle_id = 'AUDI_A4_B8_20TFSI_08_15'; -- A4 B8 2.0 TFSI FWD: Multitronic/6MT, not the transverse DQ381 DSG the base EA888 family prices
