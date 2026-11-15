SET search_path TO public;

-- ============================================================
-- TORQUED — Migration 070: NZ-fleet gap fill
-- Audit of 301 model/year probes drawn from the most-registered vehicles in
-- the NZ light fleet (NZ-new + used imports) found 90 misses. This adds:
--   * 18 engine families (1ZZ-FE, 4GR-FSE, M15A petrol + hybrid, 8NR-FTS,
--     1VD-FTV V8 TD, F33A-FTV V6 TD, Hyundai/Kia Beta/Alpha/Kappa/D4CB,
--     Holden Duramax LWN + GM Family 1, BMW N46/N43, MG 1.5 NA, Pentastar,
--     HEMI 5.7, GM EcoTec3 V8) with fluids, schedule and job pricing
--   * 98 fleet vehicles + aliases + variant-picker rows
--   * 4 mapping fixes (Yaris/Aqua gen2 → M15A, Corolla E210 2.0 → M20A,
--     MG ZS → 1.5 NA)
--   * name aliases so registry strings match combined/regional model names
--     ("Mazda2/Demio" ← DEMIO, Prado ← LAND CRUISER PRADO, Kluger ← HIGHLANDER,
--     Jazz ← FIT, C200 ← C 200, Corolla Fielder ← FIELDER)
-- Pricing GST-incl, confidence 2 (market anchors, not supplier quotes).
-- Applied directly to production 2026-11-15 (data-only, idempotent).
-- ============================================================

INSERT INTO public.engine_families (family_id, common_name, manufacturer, displacement_l, cylinders, fuel, timing_type, cambelt_interval_km, cambelt_interval_years, oil_spec, oil_capacity_l, coolant_spec, segment_tier, service_interval_km, service_interval_months, notes) VALUES
  ('TOY_1ZZFE_18', 'Toyota 1ZZ-FE 1.8L', 'Toyota', 1.8, 4, 'petrol', 'chain', NULL, NULL, '5W-30 API SN', 3.7, 'Toyota SLLC pink', 'economy', 10000, 12, 'Corolla ZZE122 2000-07, Wish ANE10, Caldina, Allion/Premio 1.8, Celica. Chain. Pre-2005 builds prone to oil consumption (piston rings) — check level at intake.'),
  ('TOY_4GRFSE_25_V6', 'Toyota 4GR-FSE 2.5L V6 D-4', 'Toyota', 2.5, 6, 'petrol', 'chain', NULL, NULL, '0W-20 / 5W-30 API SN', 6.1, 'Toyota SLLC pink', 'premium', 10000, 12, 'Mark X GRX120/130 2.5, Crown 2.5, Lexus IS250/GS250. Direct injection — intake carbon build-up. Chain. 6AT (ATF WS).'),
  ('TOY_M15AFKS_15', 'Toyota M15A-FKS 1.5L 3cyl (Dynamic Force)', 'Toyota', 1.5, 3, 'petrol', 'chain', NULL, NULL, '0W-16 API SP', 3.6, 'Toyota SLLC pink', 'economy', 10000, 12, 'Yaris XP210 2020+ petrol, Yaris Cross 1.5 petrol. Chain. CVT.'),
  ('TOY_M15AFXE_15_HYBRID', 'Toyota M15A-FXE 1.5L Hybrid (3cyl)', 'Toyota', 1.5, 3, 'hybrid_petrol', 'chain', NULL, NULL, '0W-16 API SP', 3.5, 'Toyota SLLC pink', 'economy', 10000, 12, 'Aqua MXPK10 2021+, Yaris Hybrid 2020+, Yaris Cross Hybrid. eCVT (Toyota ATF WS). Separate inverter coolant loop.'),
  ('TOY_8NRFTS_12T', 'Toyota 8NR-FTS 1.2L Turbo', 'Toyota', 1.2, 4, 'petrol', 'chain', NULL, NULL, '0W-20 API SN', 4.2, 'Toyota SLLC pink', 'mid', 10000, 12, 'C-HR NGX10/50 1.2T 2016-2023, Corolla E210 1.2T (JDM/EU). Chain. CVT.'),
  ('TOY_1VDFTV_45_V8_DIESEL', 'Toyota 1VD-FTV 4.5L V8 Diesel', 'Toyota', 4.5, 8, 'diesel', 'chain', NULL, NULL, '5W-30 ACEA C2/C3 / Toyota DL-1', 10.5, 'Toyota SLLC pink', 'luxury', 10000, 12, 'Land Cruiser 200 VDJ200 2007-21 (twin turbo), Land Cruiser 70 VDJ76/78/79 2007-23 (single turbo). Gear + chain drive. Early units: oil consumption and injector wear. Oil capacity varies 10.2-10.8L by variant (estimate).'),
  ('TOY_F33AFTV_33_V6_DIESEL', 'Toyota F33A-FTV 3.3L V6 Twin-Turbo Diesel', 'Toyota', 3.3, 6, 'diesel', 'chain', NULL, NULL, '0W-20 / 5W-30 Toyota DL-1', 6.6, 'Toyota SLLC pink', 'luxury', 10000, 12, 'Land Cruiser 300 FJA300 2021+. 10-speed auto. Oil 6.6L (some sources 7.2L) — confirm per manual.'),
  ('HKM_BETA_20_BELT', 'Hyundai/Kia Beta 2.0L (G4GC)', 'Hyundai-Kia', 2, 4, 'petrol', 'belt', 90000, 6, '5W-30 API SL', 4, 'Hyundai/Kia long-life coolant', 'economy', 10000, 12, 'Tucson JM 2004-10, Sportage KM 2004-10, Elantra XD, i30 FD 2.0. Belt 90,000km — interference engine. 4AT.'),
  ('HKM_ALPHA_14_16_BELT', 'Hyundai/Kia Alpha 1.4/1.6L (G4EE/G4ED)', 'Hyundai-Kia', 1.6, 4, 'petrol', 'belt', 90000, 6, '5W-30 API SL', 3.3, 'Hyundai/Kia long-life coolant', 'economy', 10000, 12, 'Getz TB 2002-11, Accent MC 2006-10, Rio JB 2005-11. Belt 90,000km. 4AT.'),
  ('HKM_KAPPA_12_14', 'Hyundai/Kia Kappa 1.25/1.4L', 'Hyundai-Kia', 1.4, 4, 'petrol', 'chain', NULL, NULL, '5W-30 API SN', 3.6, 'Hyundai/Kia long-life coolant', 'economy', 10000, 12, 'Picanto JA 2017+, Rio YB 2017-23, Stonic 1.4, i20 GB. Chain. 4AT/6AT/CVT.'),
  ('HKM_D4CB_25_DIESEL', 'Hyundai/Kia D4CB 2.5L CRDi', 'Hyundai-Kia', 2.5, 4, 'diesel', 'chain', NULL, NULL, '5W-30 ACEA C3', 7.4, 'Hyundai/Kia long-life coolant', 'mid', 10000, 12, 'iLoad/iMax TQ 2008-21, Sorento BL 2.5. Chain (known stretch on early units — listen on cold start). 5AT. Common NZ trade van.'),
  ('HOL_LWN_28_DURAMAX', 'Holden Duramax 2.8L Diesel (LWH/LWN)', 'Holden', 2.8, 4, 'diesel', 'belt', 150000, 10, '5W-30 dexos2', 6.5, 'GM Dex-Cool (orange)', 'mid', 15000, 12, 'Colorado RG 2012-20, Trailblazer. Timing BELT (interference) — GM 150,000km; many NZ workshops advise ~100,000km. 6AT (6L50). Oil capacity estimate. DPF.'),
  ('HOL_GM_FAMILY1_16_18', 'Holden/GM Family 1 1.6/1.8L (F16D4/F18D4)', 'Holden', 1.8, 4, 'petrol', 'belt', 150000, 10, '5W-30 dexos2', 4.5, 'GM Dex-Cool (orange)', 'economy', 15000, 12, 'Cruze JG/JH 1.8 2009-16, Barina TM 1.6 2011-18. Belt — water pump failures common, replace pump with belt. 6AT.'),
  ('BMW_N46_N43_20', 'BMW N46/N43 2.0L (E90 320i)', 'BMW', 2, 4, 'petrol', 'chain', NULL, NULL, '5W-30 BMW LL-04', 4.25, 'BMW blue coolant', 'premium', 15000, 12, 'E90/E91 320i 2005-12, E87 118i/120i. Chain. N46: oil consumption, valve-stem seals, VANOS; N43: injectors. ZF 6HP (sealed-for-life; service ~80,000km).'),
  ('MG_SAIC_15_NA', 'MG/SAIC 1.5L VTi-Tech (15S4C)', 'MG', 1.5, 4, 'petrol', 'chain', NULL, NULL, '5W-30 API SN', 4, 'MG OAT coolant', 'economy', 10000, 12, 'MG3 2019+, MG ZS 1.5 2018+. Naturally aspirated, chain. 4AT/CVT.'),
  ('JEEP_PENTASTAR_36_V6', 'FCA Pentastar 3.6L V6', 'Jeep', 3.6, 6, 'petrol', 'chain', NULL, NULL, '0W-20 / 5W-20 MS-6395', 5.7, 'Mopar OAT', 'premium', 10000, 12, 'Grand Cherokee WK2 2011-21, Wrangler JK 2012-18 / JL 2018+, Ram 1500 V6. Chain. Early units: left-head rocker/lifter failure. ZF 8HP.'),
  ('RAM_HEMI_57_V8', 'Chrysler HEMI 5.7L V8', 'Ram', 5.7, 8, 'petrol', 'chain', NULL, NULL, '5W-20 MS-6395', 6.6, 'Mopar OAT', 'luxury', 10000, 12, 'Ram 1500 DS/DT (NZ RHD conversions), Grand Cherokee 5.7. Pushrod, chain. 16 spark plugs. MDS lifter failures. 8AT.'),
  ('GM_ECOTEC3_53_62_V8', 'GM EcoTec3 5.3/6.2L V8 (L84/L87)', 'Chevrolet', 6.2, 8, 'petrol', 'chain', NULL, NULL, '0W-20 dexos1', 7.6, 'GM Dex-Cool (orange)', 'luxury', 10000, 12, 'Silverado 1500 2019+ (NZ RHD conversions). Pushrod, chain. AFM/DFM lifter failures known. 10-speed auto.')
ON CONFLICT (family_id) DO NOTHING;

INSERT INTO public.engine_family_fluids (engine_family_id, oil_fluid_id, coolant_fluid_id, trans_fluid_id, brake_fluid_id) VALUES
  ('TOY_1ZZFE_18', 'OIL_5W30_C3', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('TOY_4GRFSE_25_V6', 'OIL_0W20_SP', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('TOY_M15AFKS_15', 'OIL_0W16_SP', 'COOLANT_OAT_RED', 'TRANS_CVT', 'BRAKE_DOT4'),
  ('TOY_M15AFXE_15_HYBRID', 'OIL_0W16_SP', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('TOY_8NRFTS_12T', 'OIL_0W20_SP', 'COOLANT_OAT_RED', 'TRANS_CVT', 'BRAKE_DOT4'),
  ('TOY_1VDFTV_45_V8_DIESEL', 'OIL_5W30_DIESEL_HD', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('TOY_F33AFTV_33_V6_DIESEL', 'OIL_5W30_DIESEL_LIGHT', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('HKM_BETA_20_BELT', 'OIL_5W30_C3', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('HKM_ALPHA_14_16_BELT', 'OIL_5W30_C3', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('HKM_KAPPA_12_14', 'OIL_5W30_C3', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('HKM_D4CB_25_DIESEL', 'OIL_5W30_DIESEL_LIGHT', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('HOL_LWN_28_DURAMAX', 'OIL_5W30_DIESEL_LIGHT', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('HOL_GM_FAMILY1_16_18', 'OIL_5W30_C3', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('BMW_N46_N43_20', 'OIL_5W30_C3', 'COOLANT_OAT_BLUE', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('MG_SAIC_15_NA', 'OIL_5W30_C3', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('JEEP_PENTASTAR_36_V6', 'OIL_0W20_SP', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('RAM_HEMI_57_V8', 'OIL_5W30_C3', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('GM_ECOTEC3_53_62_V8', 'OIL_0W20_SP', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4')
ON CONFLICT (engine_family_id) DO NOTHING;

INSERT INTO public.service_schedule (engine_family_id, coolant_capacity_l, trans_capacity_l, oil_interval_km, oil_interval_months, coolant_interval_km, coolant_interval_months, brake_fluid_interval_months, trans_interval_km, aircon_refrigerant, confidence, notes) VALUES
  ('TOY_1ZZFE_18', 6, 3.5, 10000, 12, 160000, 120, 24, 60000, 'R134a', 2, 'U341E 4AT drain+fill'),
  ('TOY_4GRFSE_25_V6', 8, 3.5, 10000, 12, 160000, 120, 24, 60000, 'R134a', 2, '6AT ATF WS drain+fill'),
  ('TOY_M15AFKS_15', 5, 4, 10000, 12, 160000, 120, 24, 60000, 'R1234yf', 2, 'Direct Shift-CVT — Toyota CVT FE'),
  ('TOY_M15AFXE_15_HYBRID', 5, 3.3, 10000, 12, 160000, 120, 24, 60000, 'R1234yf', 2, 'eCVT — Toyota ATF WS'),
  ('TOY_8NRFTS_12T', 5.5, 4.5, 10000, 12, 160000, 120, 24, 60000, 'R1234yf', 2, 'CVT — Toyota CVT FE'),
  ('TOY_1VDFTV_45_V8_DIESEL', 16, 4, 10000, 12, 160000, 120, 24, 80000, 'R134a', 2, '6AT (LC200) / 5MT (LC70)'),
  ('TOY_F33AFTV_33_V6_DIESEL', 13, 4.5, 10000, 12, 160000, 120, 24, 80000, 'R1234yf', 2, '10AT drain+fill'),
  ('HKM_BETA_20_BELT', 6.5, 4, 10000, 12, 80000, 48, 24, 60000, 'R134a', 2, '4AT drain+fill'),
  ('HKM_ALPHA_14_16_BELT', 5.5, 3.5, 10000, 12, 80000, 48, 24, 60000, 'R134a', 2, '4AT drain+fill'),
  ('HKM_KAPPA_12_14', 5, 4, 10000, 12, 160000, 120, 24, 60000, 'R1234yf', 2, '4AT/6AT/CVT'),
  ('HKM_D4CB_25_DIESEL', 9.5, 4, 10000, 12, 160000, 120, 24, 60000, 'R134a', 2, '5AT drain+fill'),
  ('HOL_LWN_28_DURAMAX', 10.5, 5, 15000, 12, 240000, 120, 24, 80000, 'R134a', 2, '6L50 6AT drain+fill'),
  ('HOL_GM_FAMILY1_16_18', 6.5, 4, 15000, 12, 240000, 120, 24, 60000, 'R134a', 2, '6T40 6AT drain+fill'),
  ('BMW_N46_N43_20', 7, 5, 15000, 12, 120000, 48, 24, 80000, 'R134a', 2, 'ZF 6HP — ATF + pan/filter'),
  ('MG_SAIC_15_NA', 5.5, 4, 10000, 12, 120000, 60, 24, 60000, 'R1234yf', 2, '4AT/CVT drain+fill'),
  ('JEEP_PENTASTAR_36_V6', 10.5, 5, 10000, 12, 240000, 120, 24, 100000, 'R134a', 2, 'ZF 8HP — ATF + pan/filter'),
  ('RAM_HEMI_57_V8', 15, 5, 10000, 12, 240000, 120, 24, 100000, 'R1234yf', 2, '8HP — ATF + pan/filter'),
  ('GM_ECOTEC3_53_62_V8', 13.5, 6, 10000, 12, 240000, 120, 24, 100000, 'R1234yf', 2, '10L80 10AT drain+fill')
ON CONFLICT (engine_family_id) DO NOTHING;

INSERT INTO public.ef_parts_data (engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
SELECT v.* FROM (VALUES
  ('HKM_BETA_20_BELT', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 880, 1090, 3.8, 5.6, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump; NZ GST-incl'),
  ('HKM_ALPHA_14_16_BELT', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 700, 870, 3, 4.5, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump; NZ GST-incl'),
  ('HOL_LWN_28_DURAMAX', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 1100, 1400, 4, 6, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump; interference diesel; NZ GST-incl'),
  ('HOL_GM_FAMILY1_16_18', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 750, 950, 3, 4.5, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump (pump strongly advised); NZ GST-incl')
) AS v(engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
ON CONFLICT (engine_family_id, category_id) DO NOTHING;

INSERT INTO public.ef_parts_data (engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
SELECT v.* FROM (VALUES
  ('TOY_1ZZFE_18', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 1600, 1980, 6, 9, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+seals+cover gasket; economy; NZ GST-incl'),
  ('TOY_4GRFSE_25_V6', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 3040, 3760, 11.4, 17.1, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioners+seals+cover gasket; V6; NZ GST-incl'),
  ('TOY_M15AFKS_15', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 1600, 1980, 6, 9, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+seals+cover gasket; economy; NZ GST-incl'),
  ('TOY_M15AFXE_15_HYBRID', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 1600, 1980, 6, 9, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+seals+cover gasket; economy; NZ GST-incl'),
  ('TOY_8NRFTS_12T', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 2000, 2480, 7.5, 11.2, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+seals+cover gasket; mid; NZ GST-incl'),
  ('TOY_1VDFTV_45_V8_DIESEL', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 4890, 6060, 11.4, 17.1, 'moat_nz_gst_incl', 2, 'Chain+gears+tensioners+seals; V8 diesel; NZ GST-incl'),
  ('TOY_F33AFTV_33_V6_DIESEL', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 4890, 6060, 11.4, 17.1, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioners+seals; V6 TT diesel; NZ GST-incl'),
  ('HKM_KAPPA_12_14', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 1600, 1980, 6, 9, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+seals+cover gasket; economy; NZ GST-incl'),
  ('HKM_D4CB_25_DIESEL', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 2300, 2850, 7.5, 11.2, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioners+seals; diesel; NZ GST-incl'),
  ('BMW_N46_N43_20', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 2480, 3070, 9.3, 14, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+seals; premium; NZ GST-incl'),
  ('MG_SAIC_15_NA', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 1600, 1980, 6, 9, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+seals+cover gasket; economy; NZ GST-incl'),
  ('JEEP_PENTASTAR_36_V6', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 3040, 3760, 11.4, 17.1, 'moat_nz_gst_incl', 2, 'Chains+guides+tensioners+seals; V6; NZ GST-incl'),
  ('RAM_HEMI_57_V8', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 3200, 4000, 10, 15, 'moat_nz_gst_incl', 2, 'Chain+sprockets+tensioner+cover gasket; pushrod V8; NZ GST-incl'),
  ('GM_ECOTEC3_53_62_V8', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 3200, 4000, 10, 15, 'moat_nz_gst_incl', 2, 'Chain+sprockets+tensioner+cover gasket; pushrod V8; NZ GST-incl')
) AS v(engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
ON CONFLICT (engine_family_id, category_id) DO NOTHING;

INSERT INTO public.ef_parts_data (engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
SELECT v.* FROM (VALUES
  ('TOY_1ZZFE_18', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 240, 300, 0.5, 1, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('TOY_4GRFSE_25_V6', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 520, 650, 1.5, 2.5, 'moat_nz_gst_incl', 2, '6x Iridium; set NZ GST-incl'),
  ('TOY_M15AFKS_15', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 220, 270, 0.5, 1, 'moat_nz_gst_incl', 2, '3x Iridium; set NZ GST-incl'),
  ('TOY_M15AFXE_15_HYBRID', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 220, 270, 0.5, 1, 'moat_nz_gst_incl', 2, '3x Iridium; set NZ GST-incl'),
  ('TOY_8NRFTS_12T', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 300, 380, 0.5, 1, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('HKM_BETA_20_BELT', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 240, 300, 0.5, 1, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('HKM_ALPHA_14_16_BELT', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 200, 260, 0.5, 1, 'moat_nz_gst_incl', 2, '4x standard/Iridium; set NZ GST-incl'),
  ('HKM_KAPPA_12_14', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 220, 280, 0.5, 1, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('HOL_GM_FAMILY1_16_18', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 220, 280, 0.5, 1, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('BMW_N46_N43_20', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 300, 380, 0.5, 1, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('MG_SAIC_15_NA', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 220, 280, 0.5, 1, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('JEEP_PENTASTAR_36_V6', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 560, 700, 2, 3, 'moat_nz_gst_incl', 2, '6x Iridium (rear bank needs intake plenum off); set NZ GST-incl'),
  ('RAM_HEMI_57_V8', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 900, 1150, 2.5, 3.5, 'moat_nz_gst_incl', 2, '16x Iridium (2 per cylinder); set NZ GST-incl'),
  ('GM_ECOTEC3_53_62_V8', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 640, 800, 2, 3, 'moat_nz_gst_incl', 2, '8x Iridium; set NZ GST-incl')
) AS v(engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
ON CONFLICT (engine_family_id, category_id) DO NOTHING;

INSERT INTO public.ef_parts_data (engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
SELECT v.* FROM (VALUES
  ('TOY_1ZZFE_18', (SELECT id FROM part_categories WHERE slug='transmission_service'), 250, 370, 0.8, 1.3, 'moat_nz_gst_incl', 2, '4AT ATF drain+fill; economy; NZ GST-incl'),
  ('TOY_4GRFSE_25_V6', (SELECT id FROM part_categories WHERE slug='transmission_service'), 380, 560, 1, 1.5, 'moat_nz_gst_incl', 2, '6AT ATF WS drain+fill; premium; NZ GST-incl'),
  ('TOY_M15AFKS_15', (SELECT id FROM part_categories WHERE slug='transmission_service'), 250, 370, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'CVT FE drain+fill; economy; NZ GST-incl'),
  ('TOY_M15AFXE_15_HYBRID', (SELECT id FROM part_categories WHERE slug='transmission_service'), 250, 370, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'eCVT ATF WS drain+fill; economy; NZ GST-incl'),
  ('TOY_8NRFTS_12T', (SELECT id FROM part_categories WHERE slug='transmission_service'), 310, 460, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'CVT FE drain+fill; mid; NZ GST-incl'),
  ('TOY_1VDFTV_45_V8_DIESEL', (SELECT id FROM part_categories WHERE slug='transmission_service'), 420, 620, 1, 1.5, 'moat_nz_gst_incl', 2, '6AT ATF WS drain+fill; luxury; NZ GST-incl'),
  ('TOY_F33AFTV_33_V6_DIESEL', (SELECT id FROM part_categories WHERE slug='transmission_service'), 420, 620, 1, 1.5, 'moat_nz_gst_incl', 2, '10AT ATF drain+fill; luxury; NZ GST-incl'),
  ('HKM_BETA_20_BELT', (SELECT id FROM part_categories WHERE slug='transmission_service'), 250, 370, 0.8, 1.3, 'moat_nz_gst_incl', 2, '4AT ATF drain+fill; NZ GST-incl'),
  ('HKM_ALPHA_14_16_BELT', (SELECT id FROM part_categories WHERE slug='transmission_service'), 250, 370, 0.8, 1.3, 'moat_nz_gst_incl', 2, '4AT ATF drain+fill; NZ GST-incl'),
  ('HKM_KAPPA_12_14', (SELECT id FROM part_categories WHERE slug='transmission_service'), 250, 370, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; NZ GST-incl'),
  ('HKM_D4CB_25_DIESEL', (SELECT id FROM part_categories WHERE slug='transmission_service'), 310, 460, 0.8, 1.3, 'moat_nz_gst_incl', 2, '5AT ATF drain+fill; NZ GST-incl'),
  ('HOL_LWN_28_DURAMAX', (SELECT id FROM part_categories WHERE slug='transmission_service'), 310, 460, 0.8, 1.3, 'moat_nz_gst_incl', 2, '6L50 ATF drain+fill; NZ GST-incl'),
  ('HOL_GM_FAMILY1_16_18', (SELECT id FROM part_categories WHERE slug='transmission_service'), 250, 370, 0.8, 1.3, 'moat_nz_gst_incl', 2, '6T40 ATF drain+fill; NZ GST-incl'),
  ('BMW_N46_N43_20', (SELECT id FROM part_categories WHERE slug='transmission_service'), 420, 620, 1, 1.5, 'moat_nz_gst_incl', 2, 'ZF 6HP ATF + pan/filter; NZ GST-incl'),
  ('MG_SAIC_15_NA', (SELECT id FROM part_categories WHERE slug='transmission_service'), 250, 370, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; NZ GST-incl'),
  ('JEEP_PENTASTAR_36_V6', (SELECT id FROM part_categories WHERE slug='transmission_service'), 420, 620, 1, 1.5, 'moat_nz_gst_incl', 2, 'ZF 8HP ATF + pan/filter; NZ GST-incl'),
  ('RAM_HEMI_57_V8', (SELECT id FROM part_categories WHERE slug='transmission_service'), 420, 620, 1, 1.5, 'moat_nz_gst_incl', 2, '8HP ATF + pan/filter; NZ GST-incl'),
  ('GM_ECOTEC3_53_62_V8', (SELECT id FROM part_categories WHERE slug='transmission_service'), 450, 650, 1, 1.5, 'moat_nz_gst_incl', 2, '10L80 ATF drain+fill; NZ GST-incl')
) AS v(engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
ON CONFLICT (engine_family_id, category_id) DO NOTHING;

INSERT INTO public.fleet_vehicles (vehicle_id, make, model, submodel, chassis_code, year_from, year_to, engine_family_id, fuel, body_type, drivetrain, notes) VALUES
  ('TOY_VITZ_NCP10_13_99_05', 'Toyota', 'Vitz', '1.3', 'NCP10', 1999, 2005, 'TOY_2NZFE_13', 'petrol', 'hatch', 'fwd', 'First-gen Vitz 1.3 — very common NZ import'),
  ('TOY_VITZ_NCP13_15_01_05', 'Toyota', 'Vitz', '1.5 RS', 'NCP13', 2001, 2005, 'TOY_1NZFE_15', 'petrol', 'hatch', 'fwd', 'Vitz RS 1.5'),
  ('TOY_COROLLA_ZZE122_18_00_07', 'Toyota', 'Corolla', '1.8', 'ZZE122', 2000, 2007, 'TOY_1ZZFE_18', 'petrol', 'sedan', 'fwd', 'E120 Corolla 1.8 (NZ-new GLX/Levin)'),
  ('TOY_FIELDER_NZE141_15_06_12', 'Toyota', 'Corolla Fielder', '1.5 (E140)', 'NZE141G', 2006, 2012, 'TOY_1NZFE_15', 'petrol', 'wagon', 'fwd', 'E140 Fielder 1.5 — top-20 NZ used import'),
  ('TOY_FIELDER_ZRE142_18_06_12', 'Toyota', 'Corolla Fielder', '1.8 (E140)', 'ZRE142G', 2006, 2012, 'TOY_2ZRFE_18', 'petrol', 'wagon', 'fwd', 'E140 Fielder 1.8 S/Aerotourer'),
  ('TOY_AXIO_NZE141_15_06_12', 'Toyota', 'Corolla Axio', '1.5 (E140)', 'NZE141', 2006, 2012, 'TOY_1NZFE_15', 'petrol', 'sedan', 'fwd', 'E140 Axio 1.5'),
  ('TOY_WISH_ANE10_18_03_09', 'Toyota', 'Wish', '1.8', 'ZNE10G', 2003, 2009, 'TOY_1ZZFE_18', 'petrol', 'wagon', 'fwd', 'Wish 1.8 7-seat — very common NZ import'),
  ('TOY_WISH_ZGE20_18_09_17', 'Toyota', 'Wish', '1.8 (ZGE20)', 'ZGE20G', 2009, 2017, 'TOY_2ZRFE_18', 'petrol', 'wagon', 'fwd', 'Wish gen2 1.8 Valvematic'),
  ('TOY_MARKX_GRX120_25_04_09', 'Toyota', 'Mark X', '2.5', 'GRX120', 2004, 2009, 'TOY_4GRFSE_25_V6', 'petrol', 'sedan', 'rwd', 'Mark X 250G — popular NZ import'),
  ('TOY_MARKX_GRX130_25_09_19', 'Toyota', 'Mark X', '2.5 (GRX130)', 'GRX130', 2009, 2019, 'TOY_4GRFSE_25_V6', 'petrol', 'sedan', 'rwd', 'Mark X gen2 250G/250S'),
  ('TOY_MARKX_GRX133_35_09_19', 'Toyota', 'Mark X', '3.5 (GRX133)', 'GRX133', 2009, 2019, 'LEX_2GRFSE_35_D4S', 'petrol', 'sedan', 'rwd', 'Mark X 350S/350RDS 3.5 D-4S'),
  ('TOY_CHR_NGX_12T_16_23', 'Toyota', 'C-HR', '1.2 Turbo', 'NGX10/50', 2016, 2023, 'TOY_8NRFTS_12T', 'petrol', 'suv', 'fwd', 'C-HR 1.2T (NZ-new + JDM)'),
  ('TOY_CHR_ZYX10_HEV_16_23', 'Toyota', 'C-HR', '1.8 Hybrid', 'ZYX10', 2016, 2023, 'TOY_2ZRFXE_18_HYBRID', 'hybrid_petrol', 'suv', 'fwd', 'C-HR Hybrid 1.8'),
  ('TOY_YARIS_MXPH10_HEV_20_NOW', 'Toyota', 'Yaris', '1.5 Hybrid', 'MXPH10', 2020, NULL, 'TOY_M15AFXE_15_HYBRID', 'hybrid_petrol', 'hatch', 'fwd', 'XP210 Yaris Hybrid'),
  ('TOY_YARISCROSS_HEV_20_NOW', 'Toyota', 'Yaris Cross', '1.5 Hybrid', 'MXPJ10', 2020, NULL, 'TOY_M15AFXE_15_HYBRID', 'hybrid_petrol', 'suv', 'fwd', 'Yaris Cross Hybrid (AWD-i uses rear e-motor, no mechanical diff)'),
  ('TOY_YARISCROSS_15_20_NOW', 'Toyota', 'Yaris Cross', '1.5', 'MXPB10', 2020, NULL, 'TOY_M15AFKS_15', 'petrol', 'suv', 'fwd', 'Yaris Cross 1.5 petrol'),
  ('TOY_LC200_VDJ200_07_21', 'Toyota', 'Land Cruiser', 'LC200 4.5 V8 TD', 'VDJ200', 2007, 2021, 'TOY_1VDFTV_45_V8_DIESEL', 'diesel', 'suv', '4wd', 'Land Cruiser 200 Series 4.5 V8 twin-turbo diesel'),
  ('TOY_LC300_FJA300_21_NOW', 'Toyota', 'Land Cruiser', 'LC300 3.3 V6 TD', 'FJA300', 2021, NULL, 'TOY_F33AFTV_33_V6_DIESEL', 'diesel', 'suv', '4wd', 'Land Cruiser 300 Series'),
  ('TOY_LC70_VDJ7X_07_23', 'Toyota', 'Land Cruiser 70', '4.5 V8 TD', 'VDJ76/78/79', 2007, 2023, 'TOY_1VDFTV_45_V8_DIESEL', 'diesel', 'ute', '4wd', 'LC70 single-turbo 1VD (ute/wagon/troopy) — common NZ farm/trade'),
  ('TOY_LC70_GDJ7X_28_23_NOW', 'Toyota', 'Land Cruiser 70', '2.8 TD', 'GDJ76/79', 2023, NULL, 'TOY_1GDFTV_28_DIESEL', 'diesel', 'ute', '4wd', 'LC70 2.8 1GD (2023+)'),
  ('TOY_HIGHLANDER_AXUH78_HEV_20_NOW', 'Toyota', 'Highlander', '2.5 Hybrid', 'AXUH78', 2020, NULL, 'TOY_A25AFXS_25_HYBRID', 'hybrid_petrol', 'suv', 'awd', 'XU70 Highlander Hybrid AWD (E-Four — rear e-motor, no mechanical rear diff)'),
  ('TOY_NOAH_ZRR80_20_14_22', 'Toyota', 'Noah', '2.0 (R80)', 'ZRR80', 2014, 2022, 'TOY_2ZRFE_18', 'petrol', 'van', 'fwd', 'Noah R80 2.0 3ZR-FAE (ZR family)'),
  ('TOY_NOAH_ZWR80_HEV_14_22', 'Toyota', 'Noah', '1.8 Hybrid (R80)', 'ZWR80', 2014, 2022, 'TOY_2ZRFXE_18_HYBRID', 'hybrid_petrol', 'van', 'fwd', 'Noah Hybrid'),
  ('FORD_RANGER_PJ_25_06_11', 'Ford', 'Ranger', '2.5/3.0 TDi (PJ/PK)', 'PJ/PK', 2006, 2011, 'MAZ_WL_25_TURBODIESEL', 'diesel', 'ute', '4wd', 'PJ/PK Ranger — Mazda WL-C 2.5 / WE-C 3.0 (3.0 priced on WL family)'),
  ('FORD_FALCON_BA_40_02_08', 'Ford', 'Falcon', '4.0 I6 (BA/BF)', 'BA/BF', 2002, 2008, 'FORD_BARRA_40_I6', 'petrol', 'sedan', 'rwd', 'BA/BF Falcon Barra 4.0'),
  ('FORD_EVEREST_UB_20_22_NOW', 'Ford', 'Everest', '2.0 BiT (UB)', 'UB', 2022, NULL, 'FORD_YN2S_20_BITURBO', 'diesel', 'suv', '4wd', 'Next-gen Everest 2.0 Bi-Turbo'),
  ('FORD_ESCAPE_ZG_15T_17_20', 'Ford', 'Escape', '1.5 EcoBoost (ZG)', 'ZG', 2017, 2020, 'FORD_ECOBOOST_15_4CYL', 'petrol', 'suv', 'fwd', 'Escape ZG 1.5T'),
  ('FORD_ESCAPE_ZH_20T_20_NOW', 'Ford', 'Escape', '2.0 EcoBoost (ZH)', 'ZH', 2020, NULL, 'FORD_ECOBOOST_20_4CYL', 'petrol', 'suv', 'awd', 'Escape ZH 2.0T AWD'),
  ('FORD_KUGA_TF_16T_13_16', 'Ford', 'Kuga', '1.6 EcoBoost', 'TF', 2013, 2016, 'FORD_ECOBOOST_16_TURBO', 'petrol', 'suv', 'awd', 'Kuga Mk2 1.6T AWD (NZ-new)'),
  ('MAZ_ATENZA_GH_20_08_12', 'Mazda', 'Mazda6/Atenza', '2.0 (GH)', 'GH', 2008, 2012, 'MAZ_MZR_20_LF', 'petrol', 'sedan', 'fwd', 'Atenza GH 2.0 — common import'),
  ('MAZ_ATENZA_GH_25_08_12', 'Mazda', 'Mazda6/Atenza', '2.5 (GH)', 'GH', 2008, 2012, 'MAZ_MZR_23_L3', 'petrol', 'sedan', 'fwd', 'Atenza GH 2.5 L5-VE (MZR L-family)'),
  ('MAZ_CX30_DM_20_19_NOW', 'Mazda', 'CX-30', '2.0 SkyActiv-G', 'DM', 2019, NULL, 'MAZ_SKYACTIVG_20', 'petrol', 'suv', 'fwd', 'CX-30 2.0'),
  ('MAZ_CX30_DM_25_19_NOW', 'Mazda', 'CX-30', '2.5 SkyActiv-G', 'DM', 2019, NULL, 'MAZ_SKYACTIVG_25', 'petrol', 'suv', 'awd', 'CX-30 2.5 AWD'),
  ('MAZ_PREMACY_CR_20_05_10', 'Mazda', 'Premacy', '2.0 (CR)', 'CREW', 2005, 2010, 'MAZ_MZR_20_LF', 'petrol', 'van', 'fwd', 'Premacy 7-seat'),
  ('MAZ_PREMACY_CW_20_10_18', 'Mazda', 'Premacy', '2.0 (CW)', 'CWEFW', 2010, 2018, 'MAZ_SKYACTIVG_20', 'petrol', 'van', 'fwd', 'Premacy gen3 2.0'),
  ('MAZ_BT50_UN_25_06_11', 'Mazda', 'BT-50', '2.5/3.0 (UN)', 'UN', 2006, 2011, 'MAZ_WL_25_TURBODIESEL', 'diesel', 'ute', '4wd', 'BT-50 UN — WL-C 2.5 / WE-C 3.0 (shared with PJ Ranger)'),
  ('NIS_QASHQAI_J12_13T_21_NOW', 'Nissan', 'Qashqai', '1.3 DIG-T (J12)', 'J12', 2021, NULL, 'REN_TCE_09_13_TURBO', 'petrol', 'suv', 'fwd', 'Qashqai J12 1.3 turbo mild hybrid (HR13DDT = Renault H5Ht)'),
  ('NIS_TEANA_J31_23_03_08', 'Nissan', 'Teana', '2.3/3.5 V6 (J31)', 'J31', 2003, 2008, 'NIS_VQ25_VQ30_V6', 'petrol', 'sedan', 'fwd', 'Teana J31 230JK/350JM'),
  ('NIS_TEANA_J32_25_08_14', 'Nissan', 'Teana', '2.5 V6 (J32)', 'J32', 2008, 2014, 'NIS_VQ25_VQ30_V6', 'petrol', 'sedan', 'fwd', 'Teana J32 250XL/250XV'),
  ('NIS_WINGROAD_Y12_15_05_18', 'Nissan', 'Wingroad', '1.5 (Y12)', 'Y12', 2005, 2018, 'NIS_HR15DE_15', 'petrol', 'wagon', 'fwd', 'Wingroad Y12 1.5'),
  ('NIS_JUKE_F15_15_10_19', 'Nissan', 'Juke', '1.5 (F15)', 'F15', 2010, 2019, 'NIS_HR15DE_15', 'petrol', 'suv', 'fwd', 'Juke 15RX (JDM import)'),
  ('NIS_MURANO_Z50_35_04_08', 'Nissan', 'Murano', '3.5 V6 (Z50)', 'Z50', 2004, 2008, 'NIS_VQ35DE_35_V6', 'petrol', 'suv', 'awd', 'Murano Z50 3.5'),
  ('NIS_MURANO_Z51_35_08_15', 'Nissan', 'Murano', '3.5 V6 (Z51)', 'Z51', 2008, 2015, 'NIS_VQ35DE_35_V6', 'petrol', 'suv', 'awd', 'Murano Z51 3.5'),
  ('NIS_ELGRAND_E51_35_02_10', 'Nissan', 'Elgrand', '3.5 V6 (E51)', 'E51', 2002, 2010, 'NIS_VQ35DE_35_V6', 'petrol', 'van', 'rwd', 'Elgrand E51 — popular NZ people-mover import'),
  ('HON_FIT_GR_13_20_NOW', 'Honda', 'Fit', '1.3 (GR)', 'GR1', 2020, NULL, 'HON_L13_L15_13_15', 'petrol', 'hatch', 'fwd', 'Fit 4th gen 1.3'),
  ('HON_FIT_GR_EHEV_20_NOW', 'Honda', 'Fit', 'e:HEV (GR)', 'GR3', 2020, NULL, 'HON_LEB_15_IDCD_HYBRID', 'hybrid_petrol', 'hatch', 'fwd', 'Fit e:HEV 1.5 i-MMD (LEB family)'),
  ('HON_CRV_RD5_20_24_01_06', 'Honda', 'CR-V', '2.0/2.4 (RD4/RD5)', 'RD4/RD5', 2001, 2006, 'HON_K24_24', 'petrol', 'suv', 'awd', 'CR-V gen2 K20/K24'),
  ('HON_HRV_RU_18_15_21', 'Honda', 'HR-V', '1.8 (RU)', 'RU5', 2015, 2021, 'HON_R18A_18', 'petrol', 'suv', 'fwd', 'HR-V 1.8 (NZ-new, petrol)'),
  ('MIT_OUTLANDER_ZG_24_06_12', 'Mitsubishi', 'Outlander', '2.4 (ZG/ZH)', 'ZG/ZH', 2006, 2012, 'MIT_4B11_4B12_20_24', 'petrol', 'suv', 'awd', 'Outlander gen2 2.4'),
  ('SUZ_SWIFT_RS415_15_04_10', 'Suzuki', 'Swift', '1.3/1.5 (RS413/RS415)', 'RS413', 2004, 2010, 'SUZ_M16A_16', 'petrol', 'hatch', 'fwd', 'Swift gen2 M13A/M15A (M-series)'),
  ('SUZ_SWIFTSPORT_ZC31_16_05_11', 'Suzuki', 'Swift Sport', '1.6 (ZC31)', 'ZC31S', 2005, 2011, 'SUZ_M16A_16', 'petrol', 'hatch', 'fwd', 'Swift Sport ZC31'),
  ('SUZ_IGNIS_MF_12_16_NOW', 'Suzuki', 'Ignis', '1.2', 'MF', 2016, NULL, 'SUZ_K12B_12', 'petrol', 'hatch', 'fwd', 'Ignis 1.2 K12C (K12 family)'),
  ('SUZ_SX4_15_06_14', 'Suzuki', 'SX4', '1.5/1.6', 'YA/YB', 2006, 2014, 'SUZ_M16A_16', 'petrol', 'hatch', 'awd', 'SX4 M15A/M16A'),
  ('HOL_COLORADO_RC_30_08_12', 'Holden', 'Colorado', '3.0 TD (RC)', 'RC', 2008, 2012, 'ISU_4JJ1_30_DIESEL', 'diesel', 'ute', '4wd', 'Colorado RC — Isuzu 4JJ1 (shared with D-Max)'),
  ('HOL_COLORADO_RG_28_12_20', 'Holden', 'Colorado', '2.8 TD (RG)', 'RG', 2012, 2020, 'HOL_LWN_28_DURAMAX', 'diesel', 'ute', '4wd', 'Colorado RG 2.8 Duramax'),
  ('HOL_CRUZE_JH_18_09_16', 'Holden', 'Cruze', '1.8 (JG/JH)', 'JG/JH', 2009, 2016, 'HOL_GM_FAMILY1_16_18', 'petrol', 'sedan', 'fwd', 'Cruze 1.8'),
  ('HOL_BARINA_TM_16_11_18', 'Holden', 'Barina', '1.6 (TM)', 'TM', 2011, 2018, 'HOL_GM_FAMILY1_16_18', 'petrol', 'hatch', 'fwd', 'Barina TM 1.6'),
  ('HYU_TUCSON_JM_20_04_10', 'Hyundai', 'Tucson', '2.0 (JM)', 'JM', 2004, 2010, 'HKM_BETA_20_BELT', 'petrol', 'suv', 'awd', 'Tucson JM 2.0 Beta (belt)'),
  ('HYU_TUCSON_LM_20_10_15', 'Hyundai', 'Tucson', '2.0/2.4 (ix35)', 'LM', 2010, 2015, 'HKM_THETA_II_20_24', 'petrol', 'suv', 'awd', 'ix35/Tucson LM Theta II'),
  ('HYU_TUCSON_LM_20D_10_15', 'Hyundai', 'Tucson', '2.0 CRDi (ix35)', 'LM', 2010, 2015, 'HKM_D4HA_20_DIESEL', 'diesel', 'suv', 'awd', 'ix35/Tucson LM 2.0 CRDi'),
  ('HYU_TUCSON_NX4_20_21_NOW', 'Hyundai', 'Tucson', '2.0 (NX4)', 'NX4', 2021, NULL, 'HKM_G4FG_G4NA_CHAIN', 'petrol', 'suv', 'fwd', 'Tucson NX4 2.0 MPi (Nu)'),
  ('HYU_SANTAFE_CM_24_06_12', 'Hyundai', 'Santa Fe', '2.4 (CM)', 'CM', 2006, 2012, 'HKM_THETA_II_20_24', 'petrol', 'suv', 'awd', 'Santa Fe CM 2.4 Theta'),
  ('HYU_SANTAFE_CM_22D_06_12', 'Hyundai', 'Santa Fe', '2.2 CRDi (CM)', 'CM', 2006, 2012, 'HKM_D4HA_20_DIESEL', 'diesel', 'suv', 'awd', 'Santa Fe CM 2.2 CRDi D4EB (priced on R-series diesel family — similar service)'),
  ('HYU_SANTAFE_TM_22D_18_NOW', 'Hyundai', 'Santa Fe', '2.2 CRDi (TM)', 'TM', 2018, NULL, 'HKM_D4HA_20_DIESEL', 'diesel', 'suv', 'awd', 'Santa Fe TM 2.2 CRDi R-series'),
  ('HYU_SANTAFE_TM_35_18_NOW', 'Hyundai', 'Santa Fe', '3.5 V6 (TM)', 'TM', 2018, NULL, 'HKM_LAMBDA_V6', 'petrol', 'suv', 'awd', 'Santa Fe TM 3.5 V6'),
  ('HYU_GETZ_TB_14_02_11', 'Hyundai', 'Getz', '1.4/1.6', 'TB', 2002, 2011, 'HKM_ALPHA_14_16_BELT', 'petrol', 'hatch', 'fwd', 'Getz Alpha (belt)'),
  ('HYU_ELANTRA_MD_18_11_15', 'Hyundai', 'Elantra', '1.8 (MD)', 'MD', 2011, 2015, 'HKM_G4FG_G4NA_CHAIN', 'petrol', 'sedan', 'fwd', 'Elantra MD 1.8 Nu'),
  ('HYU_ACCENT_RB_16_11_19', 'Hyundai', 'Accent', '1.6 (RB)', 'RB', 2011, 2019, 'HKM_G4FC_16', 'petrol', 'sedan', 'fwd', 'Accent RB 1.6 Gamma'),
  ('HYU_ILOAD_TQ_25D_08_21', 'Hyundai', 'iLoad', '2.5 CRDi', 'TQ', 2008, 2021, 'HKM_D4CB_25_DIESEL', 'diesel', 'van', 'rwd', 'iLoad/iMax — common NZ trade van'),
  ('HYU_IONIQ_AE_HEV_16_22', 'Hyundai', 'Ioniq', '1.6 Hybrid', 'AE', 2016, 2022, 'HKM_SMARTSTREAM_16_HYBRID', 'hybrid_petrol', 'hatch', 'fwd', 'Ioniq Hybrid (Kappa 1.6 GDi)'),
  ('HYU_IONIQ_AE_EV_16_22', 'Hyundai', 'Ioniq', 'Electric', 'AE', 2016, 2022, 'HKM_EV_BEV', 'bev', 'hatch', 'fwd', 'Ioniq Electric 28/38kWh'),
  ('KIA_SPORTAGE_KM_20_04_10', 'Kia', 'Sportage', '2.0 (KM)', 'KM', 2004, 2010, 'HKM_BETA_20_BELT', 'petrol', 'suv', 'awd', 'Sportage KM 2.0 Beta (belt)'),
  ('KIA_SORENTO_XM_24_09_15', 'Kia', 'Sorento', '2.4 (XM)', 'XM', 2009, 2015, 'HKM_THETA_II_20_24', 'petrol', 'suv', 'awd', 'Sorento XM 2.4'),
  ('KIA_SORENTO_XM_22D_09_15', 'Kia', 'Sorento', '2.2 CRDi (XM)', 'XM', 2009, 2015, 'HKM_D4HA_20_DIESEL', 'diesel', 'suv', 'awd', 'Sorento XM 2.2 CRDi R-series'),
  ('KIA_SORENTO_MQ4_22D_20_NOW', 'Kia', 'Sorento', '2.2 CRDi (MQ4)', 'MQ4', 2020, NULL, 'HKM_D4HA_20_DIESEL', 'diesel', 'suv', 'awd', 'Sorento MQ4 2.2 CRDi'),
  ('KIA_SORENTO_MQ4_HEV_20_NOW', 'Kia', 'Sorento', '1.6T Hybrid (MQ4)', 'MQ4', 2020, NULL, 'HKM_SMARTSTREAM_16_HYBRID', 'hybrid_petrol', 'suv', 'awd', 'Sorento HEV/PHEV'),
  ('KIA_RIO_YB_14_17_23', 'Kia', 'Rio', '1.4 (YB)', 'YB', 2017, 2023, 'HKM_KAPPA_12_14', 'petrol', 'hatch', 'fwd', 'Rio YB 1.4 Kappa — common NZ rental/fleet'),
  ('KIA_SELTOS_SP2_20_19_NOW', 'Kia', 'Seltos', '2.0 (SP2)', 'SP2', 2019, NULL, 'HKM_G4FG_G4NA_CHAIN', 'petrol', 'suv', 'fwd', 'Seltos 2.0 MPi (Nu)'),
  ('KIA_STONIC_YB_14_17_NOW', 'Kia', 'Stonic', '1.4', 'YB', 2017, NULL, 'HKM_KAPPA_12_14', 'petrol', 'suv', 'fwd', 'Stonic 1.4 Kappa'),
  ('KIA_NIRO_SG2_HEV_22_NOW', 'Kia', 'Niro', '1.6 Hybrid (SG2)', 'SG2', 2022, NULL, 'HKM_SMARTSTREAM_16_HYBRID', 'hybrid_petrol', 'suv', 'fwd', 'Niro gen2 HEV'),
  ('KIA_NIRO_SG2_EV_22_NOW', 'Kia', 'Niro', 'EV (SG2)', 'SG2', 2022, NULL, 'HKM_EV_BEV', 'bev', 'suv', 'fwd', 'Niro EV gen2 64.8kWh'),
  ('KIA_CARNIVAL_YP_22D_14_20', 'Kia', 'Carnival', '2.2 CRDi (YP)', 'YP', 2014, 2020, 'HKM_D4HA_20_DIESEL', 'diesel', 'van', 'fwd', 'Carnival YP 2.2 CRDi'),
  ('KIA_CARNIVAL_KA4_22D_20_NOW', 'Kia', 'Carnival', '2.2 CRDi (KA4)', 'KA4', 2020, NULL, 'HKM_D4HA_20_DIESEL', 'diesel', 'van', 'fwd', 'Carnival KA4 2.2 CRDi'),
  ('KIA_CARNIVAL_KA4_35_20_NOW', 'Kia', 'Carnival', '3.5 V6 (KA4)', 'KA4', 2020, NULL, 'HKM_LAMBDA_V6', 'petrol', 'van', 'fwd', 'Carnival KA4 3.5 V6'),
  ('KIA_PICANTO_JA_12_17_NOW', 'Kia', 'Picanto', '1.25 (JA)', 'JA', 2017, NULL, 'HKM_KAPPA_12_14', 'petrol', 'hatch', 'fwd', 'Picanto JA 1.25 Kappa'),
  ('VW_POLO_9N_14_02_09', 'Volkswagen', 'Polo', '1.4/1.6 (9N)', '9N', 2002, 2009, 'VW_EA111_16_MPI', 'petrol', 'hatch', 'fwd', 'Polo 9N MPI (EA111 belt)'),
  ('VW_AMAROK_2H_20TDI_10_20', 'Volkswagen', 'Amarok', '2.0 BiTDI', '2H', 2010, 2020, 'VW_EA189_20_TDI', 'diesel', 'ute', '4wd', 'Amarok 2.0 TDI/BiTDI (EA189 CDCA)'),
  ('VW_AMAROK_2H_30V6_17_20', 'Volkswagen', 'Amarok', '3.0 V6 TDI', '2H', 2017, 2020, 'AUDI_30_TDI_V6', 'diesel', 'ute', '4wd', 'Amarok V6 3.0 TDI'),
  ('VW_AMAROK_NG_20BIT_23_NOW', 'Volkswagen', 'Amarok', '2.0 BiT (Ranger-based)', 'NG', 2023, NULL, 'FORD_YN2S_20_BITURBO', 'diesel', 'ute', '4wd', 'Amarok 2023+ — built on Ford Ranger platform'),
  ('MB_C200_W204_18_07_14', 'Mercedes-Benz', 'C200', '1.8 Kompressor/CGI (W204)', 'W204', 2007, 2014, 'MB_M271_18_FORCED', 'petrol', 'sedan', 'rwd', 'W204 C200 Kompressor / CGI 1.8 M271'),
  ('BMW_320I_E90_20_05_12', 'BMW', '320i', '2.0 (E90)', 'E90', 2005, 2012, 'BMW_N46_N43_20', 'petrol', 'sedan', 'rwd', 'E90/E91 320i — very common NZ import'),
  ('MG_MG3_15_19_NOW', 'MG', 'MG3', '1.5', 'SZP', 2019, NULL, 'MG_SAIC_15_NA', 'petrol', 'hatch', 'fwd', 'MG3 1.5 VTi-Tech'),
  ('VOLVO_XC60_DZ_T5_08_17', 'Volvo', 'XC60', '2.0 T5 (gen1)', 'DZ', 2008, 2017, 'FORD_ECOBOOST_20_4CYL', 'petrol', 'suv', 'fwd', 'XC60 gen1 T5 2.0 (B4204T6 = Ford EcoBoost 2.0)'),
  ('JEEP_GRANDCHEROKEE_WK2_36_11_21', 'Jeep', 'Grand Cherokee', '3.6 V6 (WK2)', 'WK2', 2011, 2021, 'JEEP_PENTASTAR_36_V6', 'petrol', 'suv', '4wd', 'Grand Cherokee WK2 3.6 Pentastar'),
  ('JEEP_WRANGLER_JK_36_12_18', 'Jeep', 'Wrangler', '3.6 V6 (JK)', 'JK', 2012, 2018, 'JEEP_PENTASTAR_36_V6', 'petrol', 'suv', '4wd', 'Wrangler JK 3.6 Pentastar'),
  ('JEEP_WRANGLER_JL_36_18_NOW', 'Jeep', 'Wrangler', '3.6 V6 (JL)', 'JL', 2018, NULL, 'JEEP_PENTASTAR_36_V6', 'petrol', 'suv', '4wd', 'Wrangler JL 3.6'),
  ('RAM_1500_DS_57_19_NOW', 'Ram', '1500', '5.7 HEMI V8', 'DS/DT', 2019, NULL, 'RAM_HEMI_57_V8', 'petrol', 'ute', '4wd', 'Ram 1500 Express/Laramie (NZ RHD conversion)'),
  ('CHEV_SILVERADO_T1_62_19_NOW', 'Chevrolet', 'Silverado', '6.2 V8 (1500)', 'T1', 2019, NULL, 'GM_ECOTEC3_53_62_V8', 'petrol', 'ute', '4wd', 'Silverado 1500 LTZ/Trail Boss (NZ RHD conversion)')
ON CONFLICT (vehicle_id) DO NOTHING;

INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_VITZ_NCP10_13_99_05', 'Toyota', 'Vitz', '1.3', 1999, 2005, '2NZ-FE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_VITZ_NCP10_13_99_05' AND lower(alias_variant) = lower('1.3'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_VITZ_NCP10_13_99_05', 'Toyota', 'Vitz', 'RS', 1999, 2005, '2NZ-FE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_VITZ_NCP10_13_99_05' AND lower(alias_variant) = lower('RS'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_VITZ_NCP10_13_99_05', 'Toyota', 'Vitz', 'F', 1999, 2005, '2NZ-FE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_VITZ_NCP10_13_99_05' AND lower(alias_variant) = lower('F'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_VITZ_NCP10_13_99_05', 'Toyota', 'Vitz', 'U', 1999, 2005, '2NZ-FE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_VITZ_NCP10_13_99_05' AND lower(alias_variant) = lower('U'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_VITZ_NCP13_15_01_05', 'Toyota', 'Vitz', '1.5', 2001, 2005, '1NZ-FE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_VITZ_NCP13_15_01_05' AND lower(alias_variant) = lower('1.5'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_VITZ_NCP13_15_01_05', 'Toyota', 'Vitz', 'RS 1.5', 2001, 2005, '1NZ-FE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_VITZ_NCP13_15_01_05' AND lower(alias_variant) = lower('RS 1.5'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_COROLLA_ZZE122_18_00_07', 'Toyota', 'Corolla', '1.8', 2000, 2007, '1ZZ-FE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_COROLLA_ZZE122_18_00_07' AND lower(alias_variant) = lower('1.8'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_COROLLA_ZZE122_18_00_07', 'Toyota', 'Corolla', 'GLX', 2000, 2007, '1ZZ-FE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_COROLLA_ZZE122_18_00_07' AND lower(alias_variant) = lower('GLX'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_COROLLA_ZZE122_18_00_07', 'Toyota', 'Corolla', 'Levin', 2000, 2007, '1ZZ-FE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_COROLLA_ZZE122_18_00_07' AND lower(alias_variant) = lower('Levin'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_FIELDER_NZE141_15_06_12', 'Toyota', 'Corolla Fielder', '1.5', 2006, 2012, '1NZ-FE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_FIELDER_NZE141_15_06_12' AND lower(alias_variant) = lower('1.5'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_FIELDER_NZE141_15_06_12', 'Toyota', 'Corolla Fielder', 'X', 2006, 2012, '1NZ-FE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_FIELDER_NZE141_15_06_12' AND lower(alias_variant) = lower('X'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_FIELDER_NZE141_15_06_12', 'Toyota', 'Corolla Fielder', 'G', 2006, 2012, '1NZ-FE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_FIELDER_NZE141_15_06_12' AND lower(alias_variant) = lower('G'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_FIELDER_ZRE142_18_06_12', 'Toyota', 'Corolla Fielder', '1.8', 2006, 2012, '2ZR-FE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_FIELDER_ZRE142_18_06_12' AND lower(alias_variant) = lower('1.8'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_FIELDER_ZRE142_18_06_12', 'Toyota', 'Corolla Fielder', 'S', 2006, 2012, '2ZR-FE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_FIELDER_ZRE142_18_06_12' AND lower(alias_variant) = lower('S'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_FIELDER_ZRE142_18_06_12', 'Toyota', 'Corolla Fielder', 'Aerotourer', 2006, 2012, '2ZR-FE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_FIELDER_ZRE142_18_06_12' AND lower(alias_variant) = lower('Aerotourer'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_AXIO_NZE141_15_06_12', 'Toyota', 'Corolla Axio', '1.5', 2006, 2012, '1NZ-FE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_AXIO_NZE141_15_06_12' AND lower(alias_variant) = lower('1.5'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_AXIO_NZE141_15_06_12', 'Toyota', 'Corolla Axio', 'X', 2006, 2012, '1NZ-FE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_AXIO_NZE141_15_06_12' AND lower(alias_variant) = lower('X'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_AXIO_NZE141_15_06_12', 'Toyota', 'Corolla Axio', 'G', 2006, 2012, '1NZ-FE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_AXIO_NZE141_15_06_12' AND lower(alias_variant) = lower('G'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_WISH_ANE10_18_03_09', 'Toyota', 'Wish', '1.8', 2003, 2009, '1ZZ-FE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_WISH_ANE10_18_03_09' AND lower(alias_variant) = lower('1.8'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_WISH_ANE10_18_03_09', 'Toyota', 'Wish', 'X', 2003, 2009, '1ZZ-FE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_WISH_ANE10_18_03_09' AND lower(alias_variant) = lower('X'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_WISH_ANE10_18_03_09', 'Toyota', 'Wish', 'Z', 2003, 2009, '1ZZ-FE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_WISH_ANE10_18_03_09' AND lower(alias_variant) = lower('Z'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_WISH_ZGE20_18_09_17', 'Toyota', 'Wish', '1.8', 2009, 2017, '2ZR-FAE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_WISH_ZGE20_18_09_17' AND lower(alias_variant) = lower('1.8'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_WISH_ZGE20_18_09_17', 'Toyota', 'Wish', 'X', 2009, 2017, '2ZR-FAE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_WISH_ZGE20_18_09_17' AND lower(alias_variant) = lower('X'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_WISH_ZGE20_18_09_17', 'Toyota', 'Wish', 'S', 2009, 2017, '2ZR-FAE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_WISH_ZGE20_18_09_17' AND lower(alias_variant) = lower('S'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_MARKX_GRX120_25_04_09', 'Toyota', 'Mark X', '2.5', 2004, 2009, '4GR-FSE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_MARKX_GRX120_25_04_09' AND lower(alias_variant) = lower('2.5'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_MARKX_GRX120_25_04_09', 'Toyota', 'Mark X', '250G', 2004, 2009, '4GR-FSE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_MARKX_GRX120_25_04_09' AND lower(alias_variant) = lower('250G'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_MARKX_GRX120_25_04_09', 'Toyota', 'Mark X', '250G S', 2004, 2009, '4GR-FSE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_MARKX_GRX120_25_04_09' AND lower(alias_variant) = lower('250G S'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_MARKX_GRX130_25_09_19', 'Toyota', 'Mark X', '2.5', 2009, 2019, '4GR-FSE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_MARKX_GRX130_25_09_19' AND lower(alias_variant) = lower('2.5'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_MARKX_GRX130_25_09_19', 'Toyota', 'Mark X', '250G', 2009, 2019, '4GR-FSE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_MARKX_GRX130_25_09_19' AND lower(alias_variant) = lower('250G'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_MARKX_GRX130_25_09_19', 'Toyota', 'Mark X', '250S', 2009, 2019, '4GR-FSE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_MARKX_GRX130_25_09_19' AND lower(alias_variant) = lower('250S'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_MARKX_GRX130_25_09_19', 'Toyota', 'Mark X', '250RDS', 2009, 2019, '4GR-FSE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_MARKX_GRX130_25_09_19' AND lower(alias_variant) = lower('250RDS'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_MARKX_GRX133_35_09_19', 'Toyota', 'Mark X', '3.5', 2009, 2019, '2GR-FSE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_MARKX_GRX133_35_09_19' AND lower(alias_variant) = lower('3.5'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_MARKX_GRX133_35_09_19', 'Toyota', 'Mark X', '350S', 2009, 2019, '2GR-FSE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_MARKX_GRX133_35_09_19' AND lower(alias_variant) = lower('350S'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_MARKX_GRX133_35_09_19', 'Toyota', 'Mark X', '350RDS', 2009, 2019, '2GR-FSE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_MARKX_GRX133_35_09_19' AND lower(alias_variant) = lower('350RDS'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_CHR_NGX_12T_16_23', 'Toyota', 'C-HR', '1.2T', 2016, 2023, '8NR-FTS', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_CHR_NGX_12T_16_23' AND lower(alias_variant) = lower('1.2T'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_CHR_NGX_12T_16_23', 'Toyota', 'C-HR', '1.2 Turbo', 2016, 2023, '8NR-FTS', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_CHR_NGX_12T_16_23' AND lower(alias_variant) = lower('1.2 Turbo'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_CHR_NGX_12T_16_23', 'Toyota', 'C-HR', 'S-T', 2016, 2023, '8NR-FTS', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_CHR_NGX_12T_16_23' AND lower(alias_variant) = lower('S-T'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_CHR_NGX_12T_16_23', 'Toyota', 'C-HR', 'G-T', 2016, 2023, '8NR-FTS', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_CHR_NGX_12T_16_23' AND lower(alias_variant) = lower('G-T'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_CHR_ZYX10_HEV_16_23', 'Toyota', 'C-HR', 'Hybrid', 2016, 2023, '2ZR-FXE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_CHR_ZYX10_HEV_16_23' AND lower(alias_variant) = lower('Hybrid'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_CHR_ZYX10_HEV_16_23', 'Toyota', 'C-HR', 'S', 2016, 2023, '2ZR-FXE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_CHR_ZYX10_HEV_16_23' AND lower(alias_variant) = lower('S'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_CHR_ZYX10_HEV_16_23', 'Toyota', 'C-HR', 'G', 2016, 2023, '2ZR-FXE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_CHR_ZYX10_HEV_16_23' AND lower(alias_variant) = lower('G'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_YARIS_MXPH10_HEV_20_NOW', 'Toyota', 'Yaris', 'Hybrid', 2020, NULL, 'M15A-FXE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_YARIS_MXPH10_HEV_20_NOW' AND lower(alias_variant) = lower('Hybrid'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_YARIS_MXPH10_HEV_20_NOW', 'Toyota', 'Yaris', 'ZR Hybrid', 2020, NULL, 'M15A-FXE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_YARIS_MXPH10_HEV_20_NOW' AND lower(alias_variant) = lower('ZR Hybrid'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_YARIS_MXPH10_HEV_20_NOW', 'Toyota', 'Yaris', 'SX Hybrid', 2020, NULL, 'M15A-FXE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_YARIS_MXPH10_HEV_20_NOW' AND lower(alias_variant) = lower('SX Hybrid'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_YARISCROSS_HEV_20_NOW', 'Toyota', 'Yaris Cross', 'Hybrid', 2020, NULL, 'M15A-FXE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_YARISCROSS_HEV_20_NOW' AND lower(alias_variant) = lower('Hybrid'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_YARISCROSS_HEV_20_NOW', 'Toyota', 'Yaris Cross', 'GXL Hybrid', 2020, NULL, 'M15A-FXE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_YARISCROSS_HEV_20_NOW' AND lower(alias_variant) = lower('GXL Hybrid'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_YARISCROSS_HEV_20_NOW', 'Toyota', 'Yaris Cross', 'ZR Hybrid', 2020, NULL, 'M15A-FXE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_YARISCROSS_HEV_20_NOW' AND lower(alias_variant) = lower('ZR Hybrid'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_YARISCROSS_15_20_NOW', 'Toyota', 'Yaris Cross', '1.5', 2020, NULL, 'M15A-FKS', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_YARISCROSS_15_20_NOW' AND lower(alias_variant) = lower('1.5'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_YARISCROSS_15_20_NOW', 'Toyota', 'Yaris Cross', 'GX', 2020, NULL, 'M15A-FKS', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_YARISCROSS_15_20_NOW' AND lower(alias_variant) = lower('GX'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_LC200_VDJ200_07_21', 'Toyota', 'Land Cruiser', '200', 2007, 2021, '1VD-FTV', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_LC200_VDJ200_07_21' AND lower(alias_variant) = lower('200'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_LC200_VDJ200_07_21', 'Toyota', 'Land Cruiser', 'LC200', 2007, 2021, '1VD-FTV', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_LC200_VDJ200_07_21' AND lower(alias_variant) = lower('LC200'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_LC200_VDJ200_07_21', 'Toyota', 'Land Cruiser', '4.5 V8', 2007, 2021, '1VD-FTV', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_LC200_VDJ200_07_21' AND lower(alias_variant) = lower('4.5 V8'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_LC200_VDJ200_07_21', 'Toyota', 'Land Cruiser', 'VX', 2007, 2021, '1VD-FTV', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_LC200_VDJ200_07_21' AND lower(alias_variant) = lower('VX'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_LC200_VDJ200_07_21', 'Toyota', 'Land Cruiser', 'Sahara', 2007, 2021, '1VD-FTV', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_LC200_VDJ200_07_21' AND lower(alias_variant) = lower('Sahara'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_LC200_VDJ200_07_21', 'Toyota', 'Land Cruiser', 'GXL', 2007, 2021, '1VD-FTV', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_LC200_VDJ200_07_21' AND lower(alias_variant) = lower('GXL'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_LC300_FJA300_21_NOW', 'Toyota', 'Land Cruiser', '300', 2021, NULL, 'F33A-FTV', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_LC300_FJA300_21_NOW' AND lower(alias_variant) = lower('300'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_LC300_FJA300_21_NOW', 'Toyota', 'Land Cruiser', 'LC300', 2021, NULL, 'F33A-FTV', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_LC300_FJA300_21_NOW' AND lower(alias_variant) = lower('LC300'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_LC300_FJA300_21_NOW', 'Toyota', 'Land Cruiser', '3.3 V6', 2021, NULL, 'F33A-FTV', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_LC300_FJA300_21_NOW' AND lower(alias_variant) = lower('3.3 V6'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_LC300_FJA300_21_NOW', 'Toyota', 'Land Cruiser', 'VX', 2021, NULL, 'F33A-FTV', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_LC300_FJA300_21_NOW' AND lower(alias_variant) = lower('VX'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_LC300_FJA300_21_NOW', 'Toyota', 'Land Cruiser', 'Sahara', 2021, NULL, 'F33A-FTV', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_LC300_FJA300_21_NOW' AND lower(alias_variant) = lower('Sahara'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_LC300_FJA300_21_NOW', 'Toyota', 'Land Cruiser', 'GR Sport', 2021, NULL, 'F33A-FTV', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_LC300_FJA300_21_NOW' AND lower(alias_variant) = lower('GR Sport'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_LC70_VDJ7X_07_23', 'Toyota', 'Land Cruiser 70', '4.5 V8', 2007, 2023, '1VD-FTV', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_LC70_VDJ7X_07_23' AND lower(alias_variant) = lower('4.5 V8'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_LC70_VDJ7X_07_23', 'Toyota', 'Land Cruiser 70', 'GX', 2007, 2023, '1VD-FTV', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_LC70_VDJ7X_07_23' AND lower(alias_variant) = lower('GX'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_LC70_VDJ7X_07_23', 'Toyota', 'Land Cruiser 70', 'GXL', 2007, 2023, '1VD-FTV', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_LC70_VDJ7X_07_23' AND lower(alias_variant) = lower('GXL'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_LC70_VDJ7X_07_23', 'Toyota', 'Land Cruiser 70', '70', 2007, 2023, '1VD-FTV', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_LC70_VDJ7X_07_23' AND lower(alias_variant) = lower('70'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_LC70_GDJ7X_28_23_NOW', 'Toyota', 'Land Cruiser 70', '2.8', 2023, NULL, '1GD-FTV', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_LC70_GDJ7X_28_23_NOW' AND lower(alias_variant) = lower('2.8'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_LC70_GDJ7X_28_23_NOW', 'Toyota', 'Land Cruiser 70', 'GX', 2023, NULL, '1GD-FTV', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_LC70_GDJ7X_28_23_NOW' AND lower(alias_variant) = lower('GX'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_LC70_GDJ7X_28_23_NOW', 'Toyota', 'Land Cruiser 70', 'GXL', 2023, NULL, '1GD-FTV', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_LC70_GDJ7X_28_23_NOW' AND lower(alias_variant) = lower('GXL'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_HIGHLANDER_AXUH78_HEV_20_NOW', 'Toyota', 'Highlander', 'Hybrid', 2020, NULL, 'A25A-FXS', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_HIGHLANDER_AXUH78_HEV_20_NOW' AND lower(alias_variant) = lower('Hybrid'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_HIGHLANDER_AXUH78_HEV_20_NOW', 'Toyota', 'Highlander', 'ZR Hybrid', 2020, NULL, 'A25A-FXS', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_HIGHLANDER_AXUH78_HEV_20_NOW' AND lower(alias_variant) = lower('ZR Hybrid'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_HIGHLANDER_AXUH78_HEV_20_NOW', 'Toyota', 'Highlander', 'GXL Hybrid', 2020, NULL, 'A25A-FXS', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_HIGHLANDER_AXUH78_HEV_20_NOW' AND lower(alias_variant) = lower('GXL Hybrid'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_NOAH_ZRR80_20_14_22', 'Toyota', 'Noah', '2.0', 2014, 2022, '3ZR-FAE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_NOAH_ZRR80_20_14_22' AND lower(alias_variant) = lower('2.0'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_NOAH_ZRR80_20_14_22', 'Toyota', 'Noah', 'Si', 2014, 2022, '3ZR-FAE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_NOAH_ZRR80_20_14_22' AND lower(alias_variant) = lower('Si'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_NOAH_ZRR80_20_14_22', 'Toyota', 'Noah', 'X', 2014, 2022, '3ZR-FAE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_NOAH_ZRR80_20_14_22' AND lower(alias_variant) = lower('X'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_NOAH_ZRR80_20_14_22', 'Toyota', 'Noah', 'G', 2014, 2022, '3ZR-FAE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_NOAH_ZRR80_20_14_22' AND lower(alias_variant) = lower('G'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_NOAH_ZWR80_HEV_14_22', 'Toyota', 'Noah', 'Hybrid', 2014, 2022, '2ZR-FXE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_NOAH_ZWR80_HEV_14_22' AND lower(alias_variant) = lower('Hybrid'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_NOAH_ZWR80_HEV_14_22', 'Toyota', 'Noah', 'Si Hybrid', 2014, 2022, '2ZR-FXE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_NOAH_ZWR80_HEV_14_22' AND lower(alias_variant) = lower('Si Hybrid'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_RANGER_PJ_25_06_11', 'Ford', 'Ranger', '2.5 TDi', 2006, 2011, 'WL-C', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_RANGER_PJ_25_06_11' AND lower(alias_variant) = lower('2.5 TDi'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_RANGER_PJ_25_06_11', 'Ford', 'Ranger', '3.0 TDi', 2006, 2011, 'WL-C', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_RANGER_PJ_25_06_11' AND lower(alias_variant) = lower('3.0 TDi'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_RANGER_PJ_25_06_11', 'Ford', 'Ranger', 'XL', 2006, 2011, 'WL-C', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_RANGER_PJ_25_06_11' AND lower(alias_variant) = lower('XL'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_RANGER_PJ_25_06_11', 'Ford', 'Ranger', 'XLT', 2006, 2011, 'WL-C', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_RANGER_PJ_25_06_11' AND lower(alias_variant) = lower('XLT'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_FALCON_BA_40_02_08', 'Ford', 'Falcon', '4.0', 2002, 2008, 'Barra 182', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_FALCON_BA_40_02_08' AND lower(alias_variant) = lower('4.0'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_FALCON_BA_40_02_08', 'Ford', 'Falcon', 'XT', 2002, 2008, 'Barra 182', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_FALCON_BA_40_02_08' AND lower(alias_variant) = lower('XT'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_FALCON_BA_40_02_08', 'Ford', 'Falcon', 'XR6', 2002, 2008, 'Barra 182', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_FALCON_BA_40_02_08' AND lower(alias_variant) = lower('XR6'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_FALCON_BA_40_02_08', 'Ford', 'Falcon', 'Fairmont', 2002, 2008, 'Barra 182', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_FALCON_BA_40_02_08' AND lower(alias_variant) = lower('Fairmont'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_EVEREST_UB_20_22_NOW', 'Ford', 'Everest', '2.0 BiT', 2022, NULL, 'YN2S', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_EVEREST_UB_20_22_NOW' AND lower(alias_variant) = lower('2.0 BiT'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_EVEREST_UB_20_22_NOW', 'Ford', 'Everest', 'Trend', 2022, NULL, 'YN2S', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_EVEREST_UB_20_22_NOW' AND lower(alias_variant) = lower('Trend'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_EVEREST_UB_20_22_NOW', 'Ford', 'Everest', 'Sport', 2022, NULL, 'YN2S', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_EVEREST_UB_20_22_NOW' AND lower(alias_variant) = lower('Sport'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_EVEREST_UB_20_22_NOW', 'Ford', 'Everest', 'Platinum', 2022, NULL, 'YN2S', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_EVEREST_UB_20_22_NOW' AND lower(alias_variant) = lower('Platinum'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_ESCAPE_ZG_15T_17_20', 'Ford', 'Escape', '1.5', 2017, 2020, 'M8DA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_ESCAPE_ZG_15T_17_20' AND lower(alias_variant) = lower('1.5'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_ESCAPE_ZG_15T_17_20', 'Ford', 'Escape', 'Ambiente', 2017, 2020, 'M8DA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_ESCAPE_ZG_15T_17_20' AND lower(alias_variant) = lower('Ambiente'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_ESCAPE_ZG_15T_17_20', 'Ford', 'Escape', 'Trend', 2017, 2020, 'M8DA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_ESCAPE_ZG_15T_17_20' AND lower(alias_variant) = lower('Trend'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_ESCAPE_ZH_20T_20_NOW', 'Ford', 'Escape', '2.0', 2020, NULL, 'YLMA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_ESCAPE_ZH_20T_20_NOW' AND lower(alias_variant) = lower('2.0'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_ESCAPE_ZH_20T_20_NOW', 'Ford', 'Escape', 'ST-Line', 2020, NULL, 'YLMA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_ESCAPE_ZH_20T_20_NOW' AND lower(alias_variant) = lower('ST-Line'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_ESCAPE_ZH_20T_20_NOW', 'Ford', 'Escape', 'Vignale', 2020, NULL, 'YLMA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_ESCAPE_ZH_20T_20_NOW' AND lower(alias_variant) = lower('Vignale'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_KUGA_TF_16T_13_16', 'Ford', 'Kuga', '1.6', 2013, 2016, 'JQMA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_KUGA_TF_16T_13_16' AND lower(alias_variant) = lower('1.6'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_KUGA_TF_16T_13_16', 'Ford', 'Kuga', 'Trend', 2013, 2016, 'JQMA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_KUGA_TF_16T_13_16' AND lower(alias_variant) = lower('Trend'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_KUGA_TF_16T_13_16', 'Ford', 'Kuga', 'Titanium', 2013, 2016, 'JQMA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_KUGA_TF_16T_13_16' AND lower(alias_variant) = lower('Titanium'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_ATENZA_GH_20_08_12', 'Mazda', 'Mazda6/Atenza', '2.0', 2008, 2012, 'LF-VD', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_ATENZA_GH_20_08_12' AND lower(alias_variant) = lower('2.0'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_ATENZA_GH_20_08_12', 'Mazda', 'Mazda6/Atenza', '20C', 2008, 2012, 'LF-VD', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_ATENZA_GH_20_08_12' AND lower(alias_variant) = lower('20C'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_ATENZA_GH_20_08_12', 'Mazda', 'Mazda6/Atenza', '20S', 2008, 2012, 'LF-VD', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_ATENZA_GH_20_08_12' AND lower(alias_variant) = lower('20S'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_ATENZA_GH_25_08_12', 'Mazda', 'Mazda6/Atenza', '2.5', 2008, 2012, 'L5-VE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_ATENZA_GH_25_08_12' AND lower(alias_variant) = lower('2.5'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_ATENZA_GH_25_08_12', 'Mazda', 'Mazda6/Atenza', '25S', 2008, 2012, 'L5-VE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_ATENZA_GH_25_08_12' AND lower(alias_variant) = lower('25S'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_ATENZA_GH_25_08_12', 'Mazda', 'Mazda6/Atenza', 'Limited', 2008, 2012, 'L5-VE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_ATENZA_GH_25_08_12' AND lower(alias_variant) = lower('Limited'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_CX30_DM_20_19_NOW', 'Mazda', 'CX-30', '2.0', 2019, NULL, 'PE-VPS', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_CX30_DM_20_19_NOW' AND lower(alias_variant) = lower('2.0'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_CX30_DM_20_19_NOW', 'Mazda', 'CX-30', 'G20', 2019, NULL, 'PE-VPS', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_CX30_DM_20_19_NOW' AND lower(alias_variant) = lower('G20'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_CX30_DM_20_19_NOW', 'Mazda', 'CX-30', 'GTX', 2019, NULL, 'PE-VPS', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_CX30_DM_20_19_NOW' AND lower(alias_variant) = lower('GTX'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_CX30_DM_25_19_NOW', 'Mazda', 'CX-30', '2.5', 2019, NULL, 'PY-VPS', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_CX30_DM_25_19_NOW' AND lower(alias_variant) = lower('2.5'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_CX30_DM_25_19_NOW', 'Mazda', 'CX-30', 'G25', 2019, NULL, 'PY-VPS', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_CX30_DM_25_19_NOW' AND lower(alias_variant) = lower('G25'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_CX30_DM_25_19_NOW', 'Mazda', 'CX-30', 'Limited', 2019, NULL, 'PY-VPS', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_CX30_DM_25_19_NOW' AND lower(alias_variant) = lower('Limited'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_PREMACY_CR_20_05_10', 'Mazda', 'Premacy', '2.0', 2005, 2010, 'LF-DE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_PREMACY_CR_20_05_10' AND lower(alias_variant) = lower('2.0'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_PREMACY_CR_20_05_10', 'Mazda', 'Premacy', '20S', 2005, 2010, 'LF-DE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_PREMACY_CR_20_05_10' AND lower(alias_variant) = lower('20S'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_PREMACY_CR_20_05_10', 'Mazda', 'Premacy', '20C', 2005, 2010, 'LF-DE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_PREMACY_CR_20_05_10' AND lower(alias_variant) = lower('20C'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_PREMACY_CW_20_10_18', 'Mazda', 'Premacy', '2.0', 2010, 2018, 'PE-VPS', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_PREMACY_CW_20_10_18' AND lower(alias_variant) = lower('2.0'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_PREMACY_CW_20_10_18', 'Mazda', 'Premacy', '20S', 2010, 2018, 'PE-VPS', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_PREMACY_CW_20_10_18' AND lower(alias_variant) = lower('20S'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_PREMACY_CW_20_10_18', 'Mazda', 'Premacy', '20E', 2010, 2018, 'PE-VPS', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_PREMACY_CW_20_10_18' AND lower(alias_variant) = lower('20E'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_BT50_UN_25_06_11', 'Mazda', 'BT-50', '2.5', 2006, 2011, 'WL-C', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_BT50_UN_25_06_11' AND lower(alias_variant) = lower('2.5'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_BT50_UN_25_06_11', 'Mazda', 'BT-50', '3.0', 2006, 2011, 'WL-C', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_BT50_UN_25_06_11' AND lower(alias_variant) = lower('3.0'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_BT50_UN_25_06_11', 'Mazda', 'BT-50', 'DX', 2006, 2011, 'WL-C', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_BT50_UN_25_06_11' AND lower(alias_variant) = lower('DX'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_BT50_UN_25_06_11', 'Mazda', 'BT-50', 'SDX', 2006, 2011, 'WL-C', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_BT50_UN_25_06_11' AND lower(alias_variant) = lower('SDX'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'NIS_QASHQAI_J12_13T_21_NOW', 'Nissan', 'Qashqai', '1.3', 2021, NULL, 'HR13DDT', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'NIS_QASHQAI_J12_13T_21_NOW' AND lower(alias_variant) = lower('1.3'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'NIS_QASHQAI_J12_13T_21_NOW', 'Nissan', 'Qashqai', 'ST', 2021, NULL, 'HR13DDT', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'NIS_QASHQAI_J12_13T_21_NOW' AND lower(alias_variant) = lower('ST'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'NIS_QASHQAI_J12_13T_21_NOW', 'Nissan', 'Qashqai', 'ST-L', 2021, NULL, 'HR13DDT', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'NIS_QASHQAI_J12_13T_21_NOW' AND lower(alias_variant) = lower('ST-L'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'NIS_QASHQAI_J12_13T_21_NOW', 'Nissan', 'Qashqai', 'Ti', 2021, NULL, 'HR13DDT', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'NIS_QASHQAI_J12_13T_21_NOW' AND lower(alias_variant) = lower('Ti'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'NIS_TEANA_J31_23_03_08', 'Nissan', 'Teana', '230JK', 2003, 2008, 'VQ23DE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'NIS_TEANA_J31_23_03_08' AND lower(alias_variant) = lower('230JK'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'NIS_TEANA_J31_23_03_08', 'Nissan', 'Teana', '230JM', 2003, 2008, 'VQ23DE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'NIS_TEANA_J31_23_03_08' AND lower(alias_variant) = lower('230JM'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'NIS_TEANA_J31_23_03_08', 'Nissan', 'Teana', '2.3', 2003, 2008, 'VQ23DE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'NIS_TEANA_J31_23_03_08' AND lower(alias_variant) = lower('2.3'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'NIS_TEANA_J31_23_03_08', 'Nissan', 'Teana', '350JM', 2003, 2008, 'VQ23DE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'NIS_TEANA_J31_23_03_08' AND lower(alias_variant) = lower('350JM'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'NIS_TEANA_J32_25_08_14', 'Nissan', 'Teana', '250XL', 2008, 2014, 'VQ25DE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'NIS_TEANA_J32_25_08_14' AND lower(alias_variant) = lower('250XL'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'NIS_TEANA_J32_25_08_14', 'Nissan', 'Teana', '250XV', 2008, 2014, 'VQ25DE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'NIS_TEANA_J32_25_08_14' AND lower(alias_variant) = lower('250XV'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'NIS_TEANA_J32_25_08_14', 'Nissan', 'Teana', '2.5', 2008, 2014, 'VQ25DE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'NIS_TEANA_J32_25_08_14' AND lower(alias_variant) = lower('2.5'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'NIS_WINGROAD_Y12_15_05_18', 'Nissan', 'Wingroad', '1.5', 2005, 2018, 'HR15DE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'NIS_WINGROAD_Y12_15_05_18' AND lower(alias_variant) = lower('1.5'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'NIS_WINGROAD_Y12_15_05_18', 'Nissan', 'Wingroad', '15M', 2005, 2018, 'HR15DE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'NIS_WINGROAD_Y12_15_05_18' AND lower(alias_variant) = lower('15M'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'NIS_WINGROAD_Y12_15_05_18', 'Nissan', 'Wingroad', '15S', 2005, 2018, 'HR15DE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'NIS_WINGROAD_Y12_15_05_18' AND lower(alias_variant) = lower('15S'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'NIS_WINGROAD_Y12_15_05_18', 'Nissan', 'Wingroad', 'Rider', 2005, 2018, 'HR15DE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'NIS_WINGROAD_Y12_15_05_18' AND lower(alias_variant) = lower('Rider'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'NIS_JUKE_F15_15_10_19', 'Nissan', 'Juke', '1.5', 2010, 2019, 'HR15DE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'NIS_JUKE_F15_15_10_19' AND lower(alias_variant) = lower('1.5'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'NIS_JUKE_F15_15_10_19', 'Nissan', 'Juke', '15RX', 2010, 2019, 'HR15DE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'NIS_JUKE_F15_15_10_19' AND lower(alias_variant) = lower('15RX'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'NIS_JUKE_F15_15_10_19', 'Nissan', 'Juke', '15RS', 2010, 2019, 'HR15DE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'NIS_JUKE_F15_15_10_19' AND lower(alias_variant) = lower('15RS'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'NIS_MURANO_Z50_35_04_08', 'Nissan', 'Murano', '3.5', 2004, 2008, 'VQ35DE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'NIS_MURANO_Z50_35_04_08' AND lower(alias_variant) = lower('3.5'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'NIS_MURANO_Z50_35_04_08', 'Nissan', 'Murano', '350XV', 2004, 2008, 'VQ35DE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'NIS_MURANO_Z50_35_04_08' AND lower(alias_variant) = lower('350XV'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'NIS_MURANO_Z51_35_08_15', 'Nissan', 'Murano', '3.5', 2008, 2015, 'VQ35DE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'NIS_MURANO_Z51_35_08_15' AND lower(alias_variant) = lower('3.5'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'NIS_MURANO_Z51_35_08_15', 'Nissan', 'Murano', '350XV', 2008, 2015, 'VQ35DE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'NIS_MURANO_Z51_35_08_15' AND lower(alias_variant) = lower('350XV'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'NIS_MURANO_Z51_35_08_15', 'Nissan', 'Murano', 'Ti', 2008, 2015, 'VQ35DE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'NIS_MURANO_Z51_35_08_15' AND lower(alias_variant) = lower('Ti'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'NIS_ELGRAND_E51_35_02_10', 'Nissan', 'Elgrand', '3.5', 2002, 2010, 'VQ35DE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'NIS_ELGRAND_E51_35_02_10' AND lower(alias_variant) = lower('3.5'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'NIS_ELGRAND_E51_35_02_10', 'Nissan', 'Elgrand', '350Highway Star', 2002, 2010, 'VQ35DE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'NIS_ELGRAND_E51_35_02_10' AND lower(alias_variant) = lower('350Highway Star'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'NIS_ELGRAND_E51_35_02_10', 'Nissan', 'Elgrand', 'VG', 2002, 2010, 'VQ35DE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'NIS_ELGRAND_E51_35_02_10' AND lower(alias_variant) = lower('VG'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'NIS_ELGRAND_E51_35_02_10', 'Nissan', 'Elgrand', 'X', 2002, 2010, 'VQ35DE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'NIS_ELGRAND_E51_35_02_10' AND lower(alias_variant) = lower('X'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HON_FIT_GR_13_20_NOW', 'Honda', 'Fit', '1.3', 2020, NULL, 'L13B', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HON_FIT_GR_13_20_NOW' AND lower(alias_variant) = lower('1.3'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HON_FIT_GR_13_20_NOW', 'Honda', 'Fit', 'Basic', 2020, NULL, 'L13B', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HON_FIT_GR_13_20_NOW' AND lower(alias_variant) = lower('Basic'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HON_FIT_GR_13_20_NOW', 'Honda', 'Fit', 'Home', 2020, NULL, 'L13B', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HON_FIT_GR_13_20_NOW' AND lower(alias_variant) = lower('Home'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HON_FIT_GR_EHEV_20_NOW', 'Honda', 'Fit', 'e:HEV', 2020, NULL, 'LEB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HON_FIT_GR_EHEV_20_NOW' AND lower(alias_variant) = lower('e:HEV'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HON_FIT_GR_EHEV_20_NOW', 'Honda', 'Fit', 'Hybrid', 2020, NULL, 'LEB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HON_FIT_GR_EHEV_20_NOW' AND lower(alias_variant) = lower('Hybrid'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HON_FIT_GR_EHEV_20_NOW', 'Honda', 'Fit', 'Home', 2020, NULL, 'LEB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HON_FIT_GR_EHEV_20_NOW' AND lower(alias_variant) = lower('Home'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HON_FIT_GR_EHEV_20_NOW', 'Honda', 'Fit', 'Crosstar', 2020, NULL, 'LEB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HON_FIT_GR_EHEV_20_NOW' AND lower(alias_variant) = lower('Crosstar'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HON_CRV_RD5_20_24_01_06', 'Honda', 'CR-V', '2.0', 2001, 2006, 'K24A', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HON_CRV_RD5_20_24_01_06' AND lower(alias_variant) = lower('2.0'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HON_CRV_RD5_20_24_01_06', 'Honda', 'CR-V', '2.4', 2001, 2006, 'K24A', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HON_CRV_RD5_20_24_01_06' AND lower(alias_variant) = lower('2.4'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HON_CRV_RD5_20_24_01_06', 'Honda', 'CR-V', 'iL', 2001, 2006, 'K24A', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HON_CRV_RD5_20_24_01_06' AND lower(alias_variant) = lower('iL'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HON_CRV_RD5_20_24_01_06', 'Honda', 'CR-V', 'iX', 2001, 2006, 'K24A', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HON_CRV_RD5_20_24_01_06' AND lower(alias_variant) = lower('iX'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HON_HRV_RU_18_15_21', 'Honda', 'HR-V', '1.8', 2015, 2021, 'R18Z', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HON_HRV_RU_18_15_21' AND lower(alias_variant) = lower('1.8'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HON_HRV_RU_18_15_21', 'Honda', 'HR-V', 'S', 2015, 2021, 'R18Z', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HON_HRV_RU_18_15_21' AND lower(alias_variant) = lower('S'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HON_HRV_RU_18_15_21', 'Honda', 'HR-V', 'L', 2015, 2021, 'R18Z', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HON_HRV_RU_18_15_21' AND lower(alias_variant) = lower('L'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HON_HRV_RU_18_15_21', 'Honda', 'HR-V', 'RS', 2015, 2021, 'R18Z', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HON_HRV_RU_18_15_21' AND lower(alias_variant) = lower('RS'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MIT_OUTLANDER_ZG_24_06_12', 'Mitsubishi', 'Outlander', '2.4', 2006, 2012, '4B12', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MIT_OUTLANDER_ZG_24_06_12' AND lower(alias_variant) = lower('2.4'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MIT_OUTLANDER_ZG_24_06_12', 'Mitsubishi', 'Outlander', 'LS', 2006, 2012, '4B12', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MIT_OUTLANDER_ZG_24_06_12' AND lower(alias_variant) = lower('LS'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MIT_OUTLANDER_ZG_24_06_12', 'Mitsubishi', 'Outlander', 'VR-X', 2006, 2012, '4B12', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MIT_OUTLANDER_ZG_24_06_12' AND lower(alias_variant) = lower('VR-X'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MIT_OUTLANDER_ZG_24_06_12', 'Mitsubishi', 'Outlander', 'XLS', 2006, 2012, '4B12', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MIT_OUTLANDER_ZG_24_06_12' AND lower(alias_variant) = lower('XLS'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'SUZ_SWIFT_RS415_15_04_10', 'Suzuki', 'Swift', '1.3', 2004, 2010, 'M15A', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'SUZ_SWIFT_RS415_15_04_10' AND lower(alias_variant) = lower('1.3'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'SUZ_SWIFT_RS415_15_04_10', 'Suzuki', 'Swift', '1.5', 2004, 2010, 'M15A', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'SUZ_SWIFT_RS415_15_04_10' AND lower(alias_variant) = lower('1.5'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'SUZ_SWIFT_RS415_15_04_10', 'Suzuki', 'Swift', 'XG', 2004, 2010, 'M15A', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'SUZ_SWIFT_RS415_15_04_10' AND lower(alias_variant) = lower('XG'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'SUZ_SWIFT_RS415_15_04_10', 'Suzuki', 'Swift', 'XS', 2004, 2010, 'M15A', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'SUZ_SWIFT_RS415_15_04_10' AND lower(alias_variant) = lower('XS'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'SUZ_SWIFTSPORT_ZC31_16_05_11', 'Suzuki', 'Swift Sport', '1.6', 2005, 2011, 'M16A', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'SUZ_SWIFTSPORT_ZC31_16_05_11' AND lower(alias_variant) = lower('1.6'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'SUZ_SWIFTSPORT_ZC31_16_05_11', 'Suzuki', 'Swift Sport', 'Sport', 2005, 2011, 'M16A', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'SUZ_SWIFTSPORT_ZC31_16_05_11' AND lower(alias_variant) = lower('Sport'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'SUZ_IGNIS_MF_12_16_NOW', 'Suzuki', 'Ignis', '1.2', 2016, NULL, 'K12C', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'SUZ_IGNIS_MF_12_16_NOW' AND lower(alias_variant) = lower('1.2'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'SUZ_IGNIS_MF_12_16_NOW', 'Suzuki', 'Ignis', 'GLX', 2016, NULL, 'K12C', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'SUZ_IGNIS_MF_12_16_NOW' AND lower(alias_variant) = lower('GLX'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'SUZ_SX4_15_06_14', 'Suzuki', 'SX4', '1.5', 2006, 2014, 'M16A', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'SUZ_SX4_15_06_14' AND lower(alias_variant) = lower('1.5'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'SUZ_SX4_15_06_14', 'Suzuki', 'SX4', '1.6', 2006, 2014, 'M16A', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'SUZ_SX4_15_06_14' AND lower(alias_variant) = lower('1.6'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HOL_COLORADO_RC_30_08_12', 'Holden', 'Colorado', '3.0', 2008, 2012, '4JJ1-TC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HOL_COLORADO_RC_30_08_12' AND lower(alias_variant) = lower('3.0'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HOL_COLORADO_RC_30_08_12', 'Holden', 'Colorado', 'LX', 2008, 2012, '4JJ1-TC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HOL_COLORADO_RC_30_08_12' AND lower(alias_variant) = lower('LX'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HOL_COLORADO_RC_30_08_12', 'Holden', 'Colorado', 'LT', 2008, 2012, '4JJ1-TC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HOL_COLORADO_RC_30_08_12' AND lower(alias_variant) = lower('LT'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HOL_COLORADO_RG_28_12_20', 'Holden', 'Colorado', '2.8', 2012, 2020, 'LWN', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HOL_COLORADO_RG_28_12_20' AND lower(alias_variant) = lower('2.8'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HOL_COLORADO_RG_28_12_20', 'Holden', 'Colorado', 'LS', 2012, 2020, 'LWN', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HOL_COLORADO_RG_28_12_20' AND lower(alias_variant) = lower('LS'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HOL_COLORADO_RG_28_12_20', 'Holden', 'Colorado', 'LTZ', 2012, 2020, 'LWN', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HOL_COLORADO_RG_28_12_20' AND lower(alias_variant) = lower('LTZ'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HOL_COLORADO_RG_28_12_20', 'Holden', 'Colorado', 'Z71', 2012, 2020, 'LWN', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HOL_COLORADO_RG_28_12_20' AND lower(alias_variant) = lower('Z71'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HOL_CRUZE_JH_18_09_16', 'Holden', 'Cruze', '1.8', 2009, 2016, 'F18D4', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HOL_CRUZE_JH_18_09_16' AND lower(alias_variant) = lower('1.8'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HOL_CRUZE_JH_18_09_16', 'Holden', 'Cruze', 'CD', 2009, 2016, 'F18D4', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HOL_CRUZE_JH_18_09_16' AND lower(alias_variant) = lower('CD'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HOL_CRUZE_JH_18_09_16', 'Holden', 'Cruze', 'Equipe', 2009, 2016, 'F18D4', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HOL_CRUZE_JH_18_09_16' AND lower(alias_variant) = lower('Equipe'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HOL_CRUZE_JH_18_09_16', 'Holden', 'Cruze', 'CDX', 2009, 2016, 'F18D4', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HOL_CRUZE_JH_18_09_16' AND lower(alias_variant) = lower('CDX'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HOL_BARINA_TM_16_11_18', 'Holden', 'Barina', '1.6', 2011, 2018, 'F16D4', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HOL_BARINA_TM_16_11_18' AND lower(alias_variant) = lower('1.6'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HOL_BARINA_TM_16_11_18', 'Holden', 'Barina', 'CD', 2011, 2018, 'F16D4', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HOL_BARINA_TM_16_11_18' AND lower(alias_variant) = lower('CD'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HOL_BARINA_TM_16_11_18', 'Holden', 'Barina', 'RS', 2011, 2018, 'F16D4', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HOL_BARINA_TM_16_11_18' AND lower(alias_variant) = lower('RS'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_TUCSON_JM_20_04_10', 'Hyundai', 'Tucson', '2.0', 2004, 2010, 'G4GC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_TUCSON_JM_20_04_10' AND lower(alias_variant) = lower('2.0'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_TUCSON_JM_20_04_10', 'Hyundai', 'Tucson', 'City', 2004, 2010, 'G4GC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_TUCSON_JM_20_04_10' AND lower(alias_variant) = lower('City'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_TUCSON_JM_20_04_10', 'Hyundai', 'Tucson', 'Elite', 2004, 2010, 'G4GC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_TUCSON_JM_20_04_10' AND lower(alias_variant) = lower('Elite'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_TUCSON_LM_20_10_15', 'Hyundai', 'Tucson', '2.0', 2010, 2015, 'G4KD', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_TUCSON_LM_20_10_15' AND lower(alias_variant) = lower('2.0'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_TUCSON_LM_20_10_15', 'Hyundai', 'Tucson', '2.4', 2010, 2015, 'G4KD', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_TUCSON_LM_20_10_15' AND lower(alias_variant) = lower('2.4'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_TUCSON_LM_20_10_15', 'Hyundai', 'Tucson', 'ix35', 2010, 2015, 'G4KD', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_TUCSON_LM_20_10_15' AND lower(alias_variant) = lower('ix35'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_TUCSON_LM_20_10_15', 'Hyundai', 'Tucson', 'Elite', 2010, 2015, 'G4KD', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_TUCSON_LM_20_10_15' AND lower(alias_variant) = lower('Elite'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_TUCSON_LM_20D_10_15', 'Hyundai', 'Tucson', '2.0 CRDi', 2010, 2015, 'D4HA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_TUCSON_LM_20D_10_15' AND lower(alias_variant) = lower('2.0 CRDi'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_TUCSON_LM_20D_10_15', 'Hyundai', 'Tucson', 'ix35 CRDi', 2010, 2015, 'D4HA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_TUCSON_LM_20D_10_15' AND lower(alias_variant) = lower('ix35 CRDi'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_TUCSON_NX4_20_21_NOW', 'Hyundai', 'Tucson', '2.0', 2021, NULL, 'G4NL', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_TUCSON_NX4_20_21_NOW' AND lower(alias_variant) = lower('2.0'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_TUCSON_NX4_20_21_NOW', 'Hyundai', 'Tucson', 'Elite', 2021, NULL, 'G4NL', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_TUCSON_NX4_20_21_NOW' AND lower(alias_variant) = lower('Elite'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_SANTAFE_CM_24_06_12', 'Hyundai', 'Santa Fe', '2.4', 2006, 2012, 'G4KE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_SANTAFE_CM_24_06_12' AND lower(alias_variant) = lower('2.4'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_SANTAFE_CM_24_06_12', 'Hyundai', 'Santa Fe', 'Elite', 2006, 2012, 'G4KE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_SANTAFE_CM_24_06_12' AND lower(alias_variant) = lower('Elite'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_SANTAFE_CM_22D_06_12', 'Hyundai', 'Santa Fe', '2.2 CRDi', 2006, 2012, 'D4EB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_SANTAFE_CM_22D_06_12' AND lower(alias_variant) = lower('2.2 CRDi'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_SANTAFE_CM_22D_06_12', 'Hyundai', 'Santa Fe', '2.2', 2006, 2012, 'D4EB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_SANTAFE_CM_22D_06_12' AND lower(alias_variant) = lower('2.2'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_SANTAFE_TM_22D_18_NOW', 'Hyundai', 'Santa Fe', '2.2 CRDi', 2018, NULL, 'D4HB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_SANTAFE_TM_22D_18_NOW' AND lower(alias_variant) = lower('2.2 CRDi'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_SANTAFE_TM_22D_18_NOW', 'Hyundai', 'Santa Fe', 'Elite', 2018, NULL, 'D4HB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_SANTAFE_TM_22D_18_NOW' AND lower(alias_variant) = lower('Elite'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_SANTAFE_TM_22D_18_NOW', 'Hyundai', 'Santa Fe', 'Limited', 2018, NULL, 'D4HB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_SANTAFE_TM_22D_18_NOW' AND lower(alias_variant) = lower('Limited'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_SANTAFE_TM_35_18_NOW', 'Hyundai', 'Santa Fe', '3.5', 2018, NULL, 'G6DC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_SANTAFE_TM_35_18_NOW' AND lower(alias_variant) = lower('3.5'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_SANTAFE_TM_35_18_NOW', 'Hyundai', 'Santa Fe', '3.5 V6', 2018, NULL, 'G6DC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_SANTAFE_TM_35_18_NOW' AND lower(alias_variant) = lower('3.5 V6'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_GETZ_TB_14_02_11', 'Hyundai', 'Getz', '1.4', 2002, 2011, 'G4EE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_GETZ_TB_14_02_11' AND lower(alias_variant) = lower('1.4'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_GETZ_TB_14_02_11', 'Hyundai', 'Getz', '1.5', 2002, 2011, 'G4EE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_GETZ_TB_14_02_11' AND lower(alias_variant) = lower('1.5'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_GETZ_TB_14_02_11', 'Hyundai', 'Getz', '1.6', 2002, 2011, 'G4EE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_GETZ_TB_14_02_11' AND lower(alias_variant) = lower('1.6'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_GETZ_TB_14_02_11', 'Hyundai', 'Getz', 'GL', 2002, 2011, 'G4EE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_GETZ_TB_14_02_11' AND lower(alias_variant) = lower('GL'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_ELANTRA_MD_18_11_15', 'Hyundai', 'Elantra', '1.8', 2011, 2015, 'G4NB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_ELANTRA_MD_18_11_15' AND lower(alias_variant) = lower('1.8'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_ELANTRA_MD_18_11_15', 'Hyundai', 'Elantra', 'Elite', 2011, 2015, 'G4NB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_ELANTRA_MD_18_11_15' AND lower(alias_variant) = lower('Elite'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_ACCENT_RB_16_11_19', 'Hyundai', 'Accent', '1.6', 2011, 2019, 'G4FC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_ACCENT_RB_16_11_19' AND lower(alias_variant) = lower('1.6'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_ACCENT_RB_16_11_19', 'Hyundai', 'Accent', 'Active', 2011, 2019, 'G4FC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_ACCENT_RB_16_11_19' AND lower(alias_variant) = lower('Active'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_ILOAD_TQ_25D_08_21', 'Hyundai', 'iLoad', '2.5 CRDi', 2008, 2021, 'D4CB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_ILOAD_TQ_25D_08_21' AND lower(alias_variant) = lower('2.5 CRDi'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_ILOAD_TQ_25D_08_21', 'Hyundai', 'iLoad', 'Crew', 2008, 2021, 'D4CB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_ILOAD_TQ_25D_08_21' AND lower(alias_variant) = lower('Crew'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_ILOAD_TQ_25D_08_21', 'Hyundai', 'iLoad', 'Van', 2008, 2021, 'D4CB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_ILOAD_TQ_25D_08_21' AND lower(alias_variant) = lower('Van'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_IONIQ_AE_HEV_16_22', 'Hyundai', 'Ioniq', 'Hybrid', 2016, 2022, 'G4LE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_IONIQ_AE_HEV_16_22' AND lower(alias_variant) = lower('Hybrid'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_IONIQ_AE_HEV_16_22', 'Hyundai', 'Ioniq', 'Elite', 2016, 2022, 'G4LE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_IONIQ_AE_HEV_16_22' AND lower(alias_variant) = lower('Elite'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_IONIQ_AE_EV_16_22', 'Hyundai', 'Ioniq', 'Electric', 2016, 2022, NULL, 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_IONIQ_AE_EV_16_22' AND lower(alias_variant) = lower('Electric'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HYU_IONIQ_AE_EV_16_22', 'Hyundai', 'Ioniq', 'EV', 2016, 2022, NULL, 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HYU_IONIQ_AE_EV_16_22' AND lower(alias_variant) = lower('EV'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_SPORTAGE_KM_20_04_10', 'Kia', 'Sportage', '2.0', 2004, 2010, 'G4GC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_SPORTAGE_KM_20_04_10' AND lower(alias_variant) = lower('2.0'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_SPORTAGE_KM_20_04_10', 'Kia', 'Sportage', 'LX', 2004, 2010, 'G4GC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_SPORTAGE_KM_20_04_10' AND lower(alias_variant) = lower('LX'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_SPORTAGE_KM_20_04_10', 'Kia', 'Sportage', 'EX', 2004, 2010, 'G4GC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_SPORTAGE_KM_20_04_10' AND lower(alias_variant) = lower('EX'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_SORENTO_XM_24_09_15', 'Kia', 'Sorento', '2.4', 2009, 2015, 'G4KE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_SORENTO_XM_24_09_15' AND lower(alias_variant) = lower('2.4'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_SORENTO_XM_24_09_15', 'Kia', 'Sorento', 'LX', 2009, 2015, 'G4KE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_SORENTO_XM_24_09_15' AND lower(alias_variant) = lower('LX'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_SORENTO_XM_24_09_15', 'Kia', 'Sorento', 'EX', 2009, 2015, 'G4KE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_SORENTO_XM_24_09_15' AND lower(alias_variant) = lower('EX'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_SORENTO_XM_22D_09_15', 'Kia', 'Sorento', '2.2 CRDi', 2009, 2015, 'D4HB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_SORENTO_XM_22D_09_15' AND lower(alias_variant) = lower('2.2 CRDi'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_SORENTO_XM_22D_09_15', 'Kia', 'Sorento', 'EX', 2009, 2015, 'D4HB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_SORENTO_XM_22D_09_15' AND lower(alias_variant) = lower('EX'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_SORENTO_XM_22D_09_15', 'Kia', 'Sorento', 'LTD', 2009, 2015, 'D4HB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_SORENTO_XM_22D_09_15' AND lower(alias_variant) = lower('LTD'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_SORENTO_MQ4_22D_20_NOW', 'Kia', 'Sorento', '2.2 CRDi', 2020, NULL, 'D4HE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_SORENTO_MQ4_22D_20_NOW' AND lower(alias_variant) = lower('2.2 CRDi'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_SORENTO_MQ4_22D_20_NOW', 'Kia', 'Sorento', 'EX', 2020, NULL, 'D4HE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_SORENTO_MQ4_22D_20_NOW' AND lower(alias_variant) = lower('EX'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_SORENTO_MQ4_22D_20_NOW', 'Kia', 'Sorento', 'GT-Line', 2020, NULL, 'D4HE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_SORENTO_MQ4_22D_20_NOW' AND lower(alias_variant) = lower('GT-Line'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_SORENTO_MQ4_HEV_20_NOW', 'Kia', 'Sorento', 'Hybrid', 2020, NULL, 'G4FT', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_SORENTO_MQ4_HEV_20_NOW' AND lower(alias_variant) = lower('Hybrid'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_SORENTO_MQ4_HEV_20_NOW', 'Kia', 'Sorento', 'PHEV', 2020, NULL, 'G4FT', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_SORENTO_MQ4_HEV_20_NOW' AND lower(alias_variant) = lower('PHEV'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_RIO_YB_14_17_23', 'Kia', 'Rio', '1.4', 2017, 2023, 'G4LC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_RIO_YB_14_17_23' AND lower(alias_variant) = lower('1.4'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_RIO_YB_14_17_23', 'Kia', 'Rio', 'LX', 2017, 2023, 'G4LC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_RIO_YB_14_17_23' AND lower(alias_variant) = lower('LX'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_RIO_YB_14_17_23', 'Kia', 'Rio', 'EX', 2017, 2023, 'G4LC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_RIO_YB_14_17_23' AND lower(alias_variant) = lower('EX'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_SELTOS_SP2_20_19_NOW', 'Kia', 'Seltos', '2.0', 2019, NULL, 'G4NH', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_SELTOS_SP2_20_19_NOW' AND lower(alias_variant) = lower('2.0'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_SELTOS_SP2_20_19_NOW', 'Kia', 'Seltos', 'LX', 2019, NULL, 'G4NH', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_SELTOS_SP2_20_19_NOW' AND lower(alias_variant) = lower('LX'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_SELTOS_SP2_20_19_NOW', 'Kia', 'Seltos', 'EX', 2019, NULL, 'G4NH', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_SELTOS_SP2_20_19_NOW' AND lower(alias_variant) = lower('EX'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_SELTOS_SP2_20_19_NOW', 'Kia', 'Seltos', 'Sport', 2019, NULL, 'G4NH', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_SELTOS_SP2_20_19_NOW' AND lower(alias_variant) = lower('Sport'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_STONIC_YB_14_17_NOW', 'Kia', 'Stonic', '1.4', 2017, NULL, 'G4LC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_STONIC_YB_14_17_NOW' AND lower(alias_variant) = lower('1.4'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_STONIC_YB_14_17_NOW', 'Kia', 'Stonic', 'LX', 2017, NULL, 'G4LC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_STONIC_YB_14_17_NOW' AND lower(alias_variant) = lower('LX'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_STONIC_YB_14_17_NOW', 'Kia', 'Stonic', 'EX', 2017, NULL, 'G4LC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_STONIC_YB_14_17_NOW' AND lower(alias_variant) = lower('EX'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_NIRO_SG2_HEV_22_NOW', 'Kia', 'Niro', 'Hybrid', 2022, NULL, 'G4LL', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_NIRO_SG2_HEV_22_NOW' AND lower(alias_variant) = lower('Hybrid'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_NIRO_SG2_HEV_22_NOW', 'Kia', 'Niro', 'HEV', 2022, NULL, 'G4LL', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_NIRO_SG2_HEV_22_NOW' AND lower(alias_variant) = lower('HEV'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_NIRO_SG2_HEV_22_NOW', 'Kia', 'Niro', 'EX', 2022, NULL, 'G4LL', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_NIRO_SG2_HEV_22_NOW' AND lower(alias_variant) = lower('EX'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_NIRO_SG2_EV_22_NOW', 'Kia', 'Niro', 'EV', 2022, NULL, NULL, 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_NIRO_SG2_EV_22_NOW' AND lower(alias_variant) = lower('EV'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_NIRO_SG2_EV_22_NOW', 'Kia', 'Niro', 'Electric', 2022, NULL, NULL, 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_NIRO_SG2_EV_22_NOW' AND lower(alias_variant) = lower('Electric'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_CARNIVAL_YP_22D_14_20', 'Kia', 'Carnival', '2.2 CRDi', 2014, 2020, 'D4HB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_CARNIVAL_YP_22D_14_20' AND lower(alias_variant) = lower('2.2 CRDi'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_CARNIVAL_YP_22D_14_20', 'Kia', 'Carnival', 'S', 2014, 2020, 'D4HB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_CARNIVAL_YP_22D_14_20' AND lower(alias_variant) = lower('S'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_CARNIVAL_YP_22D_14_20', 'Kia', 'Carnival', 'SLi', 2014, 2020, 'D4HB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_CARNIVAL_YP_22D_14_20' AND lower(alias_variant) = lower('SLi'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_CARNIVAL_KA4_22D_20_NOW', 'Kia', 'Carnival', '2.2 CRDi', 2020, NULL, 'D4HE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_CARNIVAL_KA4_22D_20_NOW' AND lower(alias_variant) = lower('2.2 CRDi'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_CARNIVAL_KA4_22D_20_NOW', 'Kia', 'Carnival', 'S', 2020, NULL, 'D4HE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_CARNIVAL_KA4_22D_20_NOW' AND lower(alias_variant) = lower('S'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_CARNIVAL_KA4_22D_20_NOW', 'Kia', 'Carnival', 'SLi', 2020, NULL, 'D4HE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_CARNIVAL_KA4_22D_20_NOW' AND lower(alias_variant) = lower('SLi'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_CARNIVAL_KA4_22D_20_NOW', 'Kia', 'Carnival', 'Platinum', 2020, NULL, 'D4HE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_CARNIVAL_KA4_22D_20_NOW' AND lower(alias_variant) = lower('Platinum'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_CARNIVAL_KA4_35_20_NOW', 'Kia', 'Carnival', '3.5', 2020, NULL, 'G6DP', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_CARNIVAL_KA4_35_20_NOW' AND lower(alias_variant) = lower('3.5'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_CARNIVAL_KA4_35_20_NOW', 'Kia', 'Carnival', '3.5 V6', 2020, NULL, 'G6DP', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_CARNIVAL_KA4_35_20_NOW' AND lower(alias_variant) = lower('3.5 V6'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_PICANTO_JA_12_17_NOW', 'Kia', 'Picanto', '1.25', 2017, NULL, 'G4LA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_PICANTO_JA_12_17_NOW' AND lower(alias_variant) = lower('1.25'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_PICANTO_JA_12_17_NOW', 'Kia', 'Picanto', 'LX', 2017, NULL, 'G4LA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_PICANTO_JA_12_17_NOW' AND lower(alias_variant) = lower('LX'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'KIA_PICANTO_JA_12_17_NOW', 'Kia', 'Picanto', 'GT-Line', 2017, NULL, 'G4LA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'KIA_PICANTO_JA_12_17_NOW' AND lower(alias_variant) = lower('GT-Line'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_POLO_9N_14_02_09', 'Volkswagen', 'Polo', '1.4', 2002, 2009, 'BBY', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_POLO_9N_14_02_09' AND lower(alias_variant) = lower('1.4'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_POLO_9N_14_02_09', 'Volkswagen', 'Polo', '1.6', 2002, 2009, 'BBY', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_POLO_9N_14_02_09' AND lower(alias_variant) = lower('1.6'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_POLO_9N_14_02_09', 'Volkswagen', 'Polo', 'Comfortline', 2002, 2009, 'BBY', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_POLO_9N_14_02_09' AND lower(alias_variant) = lower('Comfortline'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_AMAROK_2H_20TDI_10_20', 'Volkswagen', 'Amarok', '2.0 TDI', 2010, 2020, 'CDCA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_AMAROK_2H_20TDI_10_20' AND lower(alias_variant) = lower('2.0 TDI'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_AMAROK_2H_20TDI_10_20', 'Volkswagen', 'Amarok', '2.0 BiTDI', 2010, 2020, 'CDCA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_AMAROK_2H_20TDI_10_20' AND lower(alias_variant) = lower('2.0 BiTDI'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_AMAROK_2H_20TDI_10_20', 'Volkswagen', 'Amarok', 'Highline', 2010, 2020, 'CDCA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_AMAROK_2H_20TDI_10_20' AND lower(alias_variant) = lower('Highline'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_AMAROK_2H_20TDI_10_20', 'Volkswagen', 'Amarok', 'Trendline', 2010, 2020, 'CDCA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_AMAROK_2H_20TDI_10_20' AND lower(alias_variant) = lower('Trendline'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_AMAROK_2H_30V6_17_20', 'Volkswagen', 'Amarok', '3.0 V6', 2017, 2020, 'DDXC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_AMAROK_2H_30V6_17_20' AND lower(alias_variant) = lower('3.0 V6'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_AMAROK_2H_30V6_17_20', 'Volkswagen', 'Amarok', 'V6', 2017, 2020, 'DDXC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_AMAROK_2H_30V6_17_20' AND lower(alias_variant) = lower('V6'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_AMAROK_2H_30V6_17_20', 'Volkswagen', 'Amarok', 'Aventura', 2017, 2020, 'DDXC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_AMAROK_2H_30V6_17_20' AND lower(alias_variant) = lower('Aventura'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_AMAROK_2H_30V6_17_20', 'Volkswagen', 'Amarok', 'Highline V6', 2017, 2020, 'DDXC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_AMAROK_2H_30V6_17_20' AND lower(alias_variant) = lower('Highline V6'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_AMAROK_NG_20BIT_23_NOW', 'Volkswagen', 'Amarok', '2.0 BiT', 2023, NULL, 'YN2S', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_AMAROK_NG_20BIT_23_NOW' AND lower(alias_variant) = lower('2.0 BiT'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_AMAROK_NG_20BIT_23_NOW', 'Volkswagen', 'Amarok', 'Life', 2023, NULL, 'YN2S', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_AMAROK_NG_20BIT_23_NOW' AND lower(alias_variant) = lower('Life'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_AMAROK_NG_20BIT_23_NOW', 'Volkswagen', 'Amarok', 'Style', 2023, NULL, 'YN2S', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_AMAROK_NG_20BIT_23_NOW' AND lower(alias_variant) = lower('Style'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_AMAROK_NG_20BIT_23_NOW', 'Volkswagen', 'Amarok', 'PanAmericana', 2023, NULL, 'YN2S', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_AMAROK_NG_20BIT_23_NOW' AND lower(alias_variant) = lower('PanAmericana'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MB_C200_W204_18_07_14', 'Mercedes-Benz', 'C200', '1.8', 2007, 2014, 'M271', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MB_C200_W204_18_07_14' AND lower(alias_variant) = lower('1.8'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MB_C200_W204_18_07_14', 'Mercedes-Benz', 'C200', 'Kompressor', 2007, 2014, 'M271', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MB_C200_W204_18_07_14' AND lower(alias_variant) = lower('Kompressor'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MB_C200_W204_18_07_14', 'Mercedes-Benz', 'C200', 'CGI', 2007, 2014, 'M271', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MB_C200_W204_18_07_14' AND lower(alias_variant) = lower('CGI'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MB_C200_W204_18_07_14', 'Mercedes-Benz', 'C200', 'Avantgarde', 2007, 2014, 'M271', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MB_C200_W204_18_07_14' AND lower(alias_variant) = lower('Avantgarde'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MB_C200_W204_18_07_14', 'Mercedes-Benz', 'C200', 'Elegance', 2007, 2014, 'M271', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MB_C200_W204_18_07_14' AND lower(alias_variant) = lower('Elegance'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'BMW_320I_E90_20_05_12', 'BMW', '320i', '2.0', 2005, 2012, 'N46B20', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'BMW_320I_E90_20_05_12' AND lower(alias_variant) = lower('2.0'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'BMW_320I_E90_20_05_12', 'BMW', '320i', 'Touring', 2005, 2012, 'N46B20', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'BMW_320I_E90_20_05_12' AND lower(alias_variant) = lower('Touring'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'BMW_320I_E90_20_05_12', 'BMW', '320i', 'SE', 2005, 2012, 'N46B20', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'BMW_320I_E90_20_05_12' AND lower(alias_variant) = lower('SE'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'BMW_320I_E90_20_05_12', 'BMW', '320i', 'M Sport', 2005, 2012, 'N46B20', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'BMW_320I_E90_20_05_12' AND lower(alias_variant) = lower('M Sport'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MG_MG3_15_19_NOW', 'MG', 'MG3', '1.5', 2019, NULL, '15S4C', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MG_MG3_15_19_NOW' AND lower(alias_variant) = lower('1.5'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MG_MG3_15_19_NOW', 'MG', 'MG3', 'Core', 2019, NULL, '15S4C', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MG_MG3_15_19_NOW' AND lower(alias_variant) = lower('Core'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MG_MG3_15_19_NOW', 'MG', 'MG3', 'Excite', 2019, NULL, '15S4C', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MG_MG3_15_19_NOW' AND lower(alias_variant) = lower('Excite'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VOLVO_XC60_DZ_T5_08_17', 'Volvo', 'XC60', 'T5', 2008, 2017, 'B4204T6', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VOLVO_XC60_DZ_T5_08_17' AND lower(alias_variant) = lower('T5'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VOLVO_XC60_DZ_T5_08_17', 'Volvo', 'XC60', '2.0 T5', 2008, 2017, 'B4204T6', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VOLVO_XC60_DZ_T5_08_17' AND lower(alias_variant) = lower('2.0 T5'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VOLVO_XC60_DZ_T5_08_17', 'Volvo', 'XC60', 'R-Design', 2008, 2017, 'B4204T6', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VOLVO_XC60_DZ_T5_08_17' AND lower(alias_variant) = lower('R-Design'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'JEEP_GRANDCHEROKEE_WK2_36_11_21', 'Jeep', 'Grand Cherokee', '3.6', 2011, 2021, 'ERB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'JEEP_GRANDCHEROKEE_WK2_36_11_21' AND lower(alias_variant) = lower('3.6'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'JEEP_GRANDCHEROKEE_WK2_36_11_21', 'Jeep', 'Grand Cherokee', 'Laredo', 2011, 2021, 'ERB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'JEEP_GRANDCHEROKEE_WK2_36_11_21' AND lower(alias_variant) = lower('Laredo'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'JEEP_GRANDCHEROKEE_WK2_36_11_21', 'Jeep', 'Grand Cherokee', 'Limited', 2011, 2021, 'ERB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'JEEP_GRANDCHEROKEE_WK2_36_11_21' AND lower(alias_variant) = lower('Limited'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'JEEP_GRANDCHEROKEE_WK2_36_11_21', 'Jeep', 'Grand Cherokee', 'Overland', 2011, 2021, 'ERB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'JEEP_GRANDCHEROKEE_WK2_36_11_21' AND lower(alias_variant) = lower('Overland'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'JEEP_WRANGLER_JK_36_12_18', 'Jeep', 'Wrangler', '3.6', 2012, 2018, 'ERB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'JEEP_WRANGLER_JK_36_12_18' AND lower(alias_variant) = lower('3.6'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'JEEP_WRANGLER_JK_36_12_18', 'Jeep', 'Wrangler', 'Sport', 2012, 2018, 'ERB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'JEEP_WRANGLER_JK_36_12_18' AND lower(alias_variant) = lower('Sport'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'JEEP_WRANGLER_JK_36_12_18', 'Jeep', 'Wrangler', 'Sahara', 2012, 2018, 'ERB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'JEEP_WRANGLER_JK_36_12_18' AND lower(alias_variant) = lower('Sahara'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'JEEP_WRANGLER_JK_36_12_18', 'Jeep', 'Wrangler', 'Rubicon', 2012, 2018, 'ERB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'JEEP_WRANGLER_JK_36_12_18' AND lower(alias_variant) = lower('Rubicon'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'JEEP_WRANGLER_JK_36_12_18', 'Jeep', 'Wrangler', 'Unlimited', 2012, 2018, 'ERB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'JEEP_WRANGLER_JK_36_12_18' AND lower(alias_variant) = lower('Unlimited'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'JEEP_WRANGLER_JL_36_18_NOW', 'Jeep', 'Wrangler', '3.6', 2018, NULL, 'ERC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'JEEP_WRANGLER_JL_36_18_NOW' AND lower(alias_variant) = lower('3.6'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'JEEP_WRANGLER_JL_36_18_NOW', 'Jeep', 'Wrangler', 'Sport', 2018, NULL, 'ERC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'JEEP_WRANGLER_JL_36_18_NOW' AND lower(alias_variant) = lower('Sport'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'JEEP_WRANGLER_JL_36_18_NOW', 'Jeep', 'Wrangler', 'Overland', 2018, NULL, 'ERC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'JEEP_WRANGLER_JL_36_18_NOW' AND lower(alias_variant) = lower('Overland'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'JEEP_WRANGLER_JL_36_18_NOW', 'Jeep', 'Wrangler', 'Rubicon', 2018, NULL, 'ERC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'JEEP_WRANGLER_JL_36_18_NOW' AND lower(alias_variant) = lower('Rubicon'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'JEEP_WRANGLER_JL_36_18_NOW', 'Jeep', 'Wrangler', 'Unlimited', 2018, NULL, 'ERC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'JEEP_WRANGLER_JL_36_18_NOW' AND lower(alias_variant) = lower('Unlimited'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'RAM_1500_DS_57_19_NOW', 'Ram', '1500', '5.7', 2019, NULL, 'EZH', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'RAM_1500_DS_57_19_NOW' AND lower(alias_variant) = lower('5.7'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'RAM_1500_DS_57_19_NOW', 'Ram', '1500', 'HEMI', 2019, NULL, 'EZH', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'RAM_1500_DS_57_19_NOW' AND lower(alias_variant) = lower('HEMI'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'RAM_1500_DS_57_19_NOW', 'Ram', '1500', 'Express', 2019, NULL, 'EZH', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'RAM_1500_DS_57_19_NOW' AND lower(alias_variant) = lower('Express'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'RAM_1500_DS_57_19_NOW', 'Ram', '1500', 'Laramie', 2019, NULL, 'EZH', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'RAM_1500_DS_57_19_NOW' AND lower(alias_variant) = lower('Laramie'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'RAM_1500_DS_57_19_NOW', 'Ram', '1500', 'Warlock', 2019, NULL, 'EZH', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'RAM_1500_DS_57_19_NOW' AND lower(alias_variant) = lower('Warlock'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'CHEV_SILVERADO_T1_62_19_NOW', 'Chevrolet', 'Silverado', '6.2', 2019, NULL, 'L87', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'CHEV_SILVERADO_T1_62_19_NOW' AND lower(alias_variant) = lower('6.2'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'CHEV_SILVERADO_T1_62_19_NOW', 'Chevrolet', 'Silverado', '1500', 2019, NULL, 'L87', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'CHEV_SILVERADO_T1_62_19_NOW' AND lower(alias_variant) = lower('1500'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'CHEV_SILVERADO_T1_62_19_NOW', 'Chevrolet', 'Silverado', 'LTZ', 2019, NULL, 'L87', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'CHEV_SILVERADO_T1_62_19_NOW' AND lower(alias_variant) = lower('LTZ'));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'CHEV_SILVERADO_T1_62_19_NOW', 'Chevrolet', 'Silverado', 'Trail Boss', 2019, NULL, 'L87', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'CHEV_SILVERADO_T1_62_19_NOW' AND lower(alias_variant) = lower('Trail Boss'));

-- variant-picker rows
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Toyota', 'Vitz', '1.3', 'NCP10', '2NZ-FE', 1999, 2005, 'petrol', 1300, 'auto', 'fwd', 'hatch', 'chain', 'First-gen Vitz 1.3 — very common NZ import'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Toyota') AND lower(model) = lower('Vitz') AND lower(submodel) = lower('1.3') AND year_from = 1999);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Toyota', 'Vitz', '1.5 RS', 'NCP13', '1NZ-FE', 2001, 2005, 'petrol', 1500, 'auto', 'fwd', 'hatch', 'chain', 'Vitz RS 1.5'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Toyota') AND lower(model) = lower('Vitz') AND lower(submodel) = lower('1.5 RS') AND year_from = 2001);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Toyota', 'Corolla', '1.8', 'ZZE122', '1ZZ-FE', 2000, 2007, 'petrol', 1800, 'auto', 'fwd', 'sedan', 'chain', 'E120 Corolla 1.8 (NZ-new GLX/Levin)'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Toyota') AND lower(model) = lower('Corolla') AND lower(submodel) = lower('1.8') AND year_from = 2000);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Toyota', 'Corolla Fielder', '1.5 (E140)', 'NZE141G', '1NZ-FE', 2006, 2012, 'petrol', 1500, 'cvt', 'fwd', 'wagon', 'chain', 'E140 Fielder 1.5 — top-20 NZ used import'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Toyota') AND lower(model) = lower('Corolla Fielder') AND lower(submodel) = lower('1.5 (E140)') AND year_from = 2006);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Toyota', 'Corolla Fielder', '1.8 (E140)', 'ZRE142G', '2ZR-FE', 2006, 2012, 'petrol', 1800, 'cvt', 'fwd', 'wagon', 'chain', 'E140 Fielder 1.8 S/Aerotourer'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Toyota') AND lower(model) = lower('Corolla Fielder') AND lower(submodel) = lower('1.8 (E140)') AND year_from = 2006);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Toyota', 'Corolla Axio', '1.5 (E140)', 'NZE141', '1NZ-FE', 2006, 2012, 'petrol', 1500, 'cvt', 'fwd', 'sedan', 'chain', 'E140 Axio 1.5'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Toyota') AND lower(model) = lower('Corolla Axio') AND lower(submodel) = lower('1.5 (E140)') AND year_from = 2006);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Toyota', 'Wish', '1.8', 'ZNE10G', '1ZZ-FE', 2003, 2009, 'petrol', 1800, 'auto', 'fwd', 'wagon', 'chain', 'Wish 1.8 7-seat — very common NZ import'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Toyota') AND lower(model) = lower('Wish') AND lower(submodel) = lower('1.8') AND year_from = 2003);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Toyota', 'Wish', '1.8 (ZGE20)', 'ZGE20G', '2ZR-FAE', 2009, 2017, 'petrol', 1800, 'cvt', 'fwd', 'wagon', 'chain', 'Wish gen2 1.8 Valvematic'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Toyota') AND lower(model) = lower('Wish') AND lower(submodel) = lower('1.8 (ZGE20)') AND year_from = 2009);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Toyota', 'Mark X', '2.5', 'GRX120', '4GR-FSE', 2004, 2009, 'petrol', 2500, 'auto', 'rwd', 'sedan', 'chain', 'Mark X 250G — popular NZ import'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Toyota') AND lower(model) = lower('Mark X') AND lower(submodel) = lower('2.5') AND year_from = 2004);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Toyota', 'Mark X', '2.5 (GRX130)', 'GRX130', '4GR-FSE', 2009, 2019, 'petrol', 2500, 'auto', 'rwd', 'sedan', 'chain', 'Mark X gen2 250G/250S'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Toyota') AND lower(model) = lower('Mark X') AND lower(submodel) = lower('2.5 (GRX130)') AND year_from = 2009);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Toyota', 'Mark X', '3.5 (GRX133)', 'GRX133', '2GR-FSE', 2009, 2019, 'petrol', 3500, 'auto', 'rwd', 'sedan', 'chain', 'Mark X 350S/350RDS 3.5 D-4S'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Toyota') AND lower(model) = lower('Mark X') AND lower(submodel) = lower('3.5 (GRX133)') AND year_from = 2009);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Toyota', 'C-HR', '1.2 Turbo', 'NGX10/50', '8NR-FTS', 2016, 2023, 'petrol', 1200, 'cvt', 'fwd', 'suv', 'chain', 'C-HR 1.2T (NZ-new + JDM)'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Toyota') AND lower(model) = lower('C-HR') AND lower(submodel) = lower('1.2 Turbo') AND year_from = 2016);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Toyota', 'C-HR', '1.8 Hybrid', 'ZYX10', '2ZR-FXE', 2016, 2023, 'hybrid', 1800, 'cvt', 'fwd', 'suv', 'chain', 'C-HR Hybrid 1.8'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Toyota') AND lower(model) = lower('C-HR') AND lower(submodel) = lower('1.8 Hybrid') AND year_from = 2016);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Toyota', 'Yaris', '1.5 Hybrid', 'MXPH10', 'M15A-FXE', 2020, NULL, 'hybrid', 1500, 'cvt', 'fwd', 'hatch', 'chain', 'XP210 Yaris Hybrid'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Toyota') AND lower(model) = lower('Yaris') AND lower(submodel) = lower('1.5 Hybrid') AND year_from = 2020);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Toyota', 'Yaris Cross', '1.5 Hybrid', 'MXPJ10', 'M15A-FXE', 2020, NULL, 'hybrid', 1500, 'cvt', 'fwd', 'suv', 'chain', 'Yaris Cross Hybrid (AWD-i uses rear e-motor, no mechanical diff)'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Toyota') AND lower(model) = lower('Yaris Cross') AND lower(submodel) = lower('1.5 Hybrid') AND year_from = 2020);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Toyota', 'Yaris Cross', '1.5', 'MXPB10', 'M15A-FKS', 2020, NULL, 'petrol', 1500, 'cvt', 'fwd', 'suv', 'chain', 'Yaris Cross 1.5 petrol'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Toyota') AND lower(model) = lower('Yaris Cross') AND lower(submodel) = lower('1.5') AND year_from = 2020);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Toyota', 'Land Cruiser', 'LC200 4.5 V8 TD', 'VDJ200', '1VD-FTV', 2007, 2021, 'diesel', 4500, 'auto', '4wd', 'suv', 'chain', 'Land Cruiser 200 Series 4.5 V8 twin-turbo diesel'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Toyota') AND lower(model) = lower('Land Cruiser') AND lower(submodel) = lower('LC200 4.5 V8 TD') AND year_from = 2007);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Toyota', 'Land Cruiser', 'LC300 3.3 V6 TD', 'FJA300', 'F33A-FTV', 2021, NULL, 'diesel', 3300, 'auto', '4wd', 'suv', 'chain', 'Land Cruiser 300 Series'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Toyota') AND lower(model) = lower('Land Cruiser') AND lower(submodel) = lower('LC300 3.3 V6 TD') AND year_from = 2021);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Toyota', 'Land Cruiser 70', '4.5 V8 TD', 'VDJ76/78/79', '1VD-FTV', 2007, 2023, 'diesel', 4500, 'manual', '4wd', 'ute', 'chain', 'LC70 single-turbo 1VD (ute/wagon/troopy) — common NZ farm/trade'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Toyota') AND lower(model) = lower('Land Cruiser 70') AND lower(submodel) = lower('4.5 V8 TD') AND year_from = 2007);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Toyota', 'Land Cruiser 70', '2.8 TD', 'GDJ76/79', '1GD-FTV', 2023, NULL, 'diesel', 2800, 'auto', '4wd', 'ute', 'chain', 'LC70 2.8 1GD (2023+)'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Toyota') AND lower(model) = lower('Land Cruiser 70') AND lower(submodel) = lower('2.8 TD') AND year_from = 2023);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Toyota', 'Highlander', '2.5 Hybrid', 'AXUH78', 'A25A-FXS', 2020, NULL, 'hybrid', 2500, 'cvt', 'awd', 'suv', 'chain', 'XU70 Highlander Hybrid AWD (E-Four — rear e-motor, no mechanical rear diff)'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Toyota') AND lower(model) = lower('Highlander') AND lower(submodel) = lower('2.5 Hybrid') AND year_from = 2020);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Toyota', 'Noah', '2.0 (R80)', 'ZRR80', '3ZR-FAE', 2014, 2022, 'petrol', 2000, 'cvt', 'fwd', 'van', 'chain', 'Noah R80 2.0 3ZR-FAE (ZR family)'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Toyota') AND lower(model) = lower('Noah') AND lower(submodel) = lower('2.0 (R80)') AND year_from = 2014);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Toyota', 'Noah', '1.8 Hybrid (R80)', 'ZWR80', '2ZR-FXE', 2014, 2022, 'hybrid', 1800, 'cvt', 'fwd', 'van', 'chain', 'Noah Hybrid'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Toyota') AND lower(model) = lower('Noah') AND lower(submodel) = lower('1.8 Hybrid (R80)') AND year_from = 2014);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Ford', 'Ranger', '2.5/3.0 TDi (PJ/PK)', 'PJ/PK', 'WL-C', 2006, 2011, 'diesel', 2500, 'manual', '4wd', 'ute', 'belt', 'PJ/PK Ranger — Mazda WL-C 2.5 / WE-C 3.0 (3.0 priced on WL family)'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Ford') AND lower(model) = lower('Ranger') AND lower(submodel) = lower('2.5/3.0 TDi (PJ/PK)') AND year_from = 2006);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Ford', 'Falcon', '4.0 I6 (BA/BF)', 'BA/BF', 'Barra 182', 2002, 2008, 'petrol', 4000, 'auto', 'rwd', 'sedan', 'chain', 'BA/BF Falcon Barra 4.0'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Ford') AND lower(model) = lower('Falcon') AND lower(submodel) = lower('4.0 I6 (BA/BF)') AND year_from = 2002);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Ford', 'Everest', '2.0 BiT (UB)', 'UB', 'YN2S', 2022, NULL, 'diesel', 2000, 'auto', '4wd', 'suv', 'chain', 'Next-gen Everest 2.0 Bi-Turbo'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Ford') AND lower(model) = lower('Everest') AND lower(submodel) = lower('2.0 BiT (UB)') AND year_from = 2022);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Ford', 'Escape', '1.5 EcoBoost (ZG)', 'ZG', 'M8DA', 2017, 2020, 'petrol', 1500, 'auto', 'fwd', 'suv', 'chain', 'Escape ZG 1.5T'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Ford') AND lower(model) = lower('Escape') AND lower(submodel) = lower('1.5 EcoBoost (ZG)') AND year_from = 2017);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Ford', 'Escape', '2.0 EcoBoost (ZH)', 'ZH', 'YLMA', 2020, NULL, 'petrol', 2000, 'auto', 'awd', 'suv', 'chain', 'Escape ZH 2.0T AWD'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Ford') AND lower(model) = lower('Escape') AND lower(submodel) = lower('2.0 EcoBoost (ZH)') AND year_from = 2020);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Ford', 'Kuga', '1.6 EcoBoost', 'TF', 'JQMA', 2013, 2016, 'petrol', 1600, 'auto', 'awd', 'suv', 'chain', 'Kuga Mk2 1.6T AWD (NZ-new)'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Ford') AND lower(model) = lower('Kuga') AND lower(submodel) = lower('1.6 EcoBoost') AND year_from = 2013);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Mazda', 'Mazda6/Atenza', '2.0 (GH)', 'GH', 'LF-VD', 2008, 2012, 'petrol', 2000, 'auto', 'fwd', 'sedan', 'chain', 'Atenza GH 2.0 — common import'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Mazda') AND lower(model) = lower('Mazda6/Atenza') AND lower(submodel) = lower('2.0 (GH)') AND year_from = 2008);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Mazda', 'Mazda6/Atenza', '2.5 (GH)', 'GH', 'L5-VE', 2008, 2012, 'petrol', 2500, 'auto', 'fwd', 'sedan', 'chain', 'Atenza GH 2.5 L5-VE (MZR L-family)'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Mazda') AND lower(model) = lower('Mazda6/Atenza') AND lower(submodel) = lower('2.5 (GH)') AND year_from = 2008);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Mazda', 'CX-30', '2.0 SkyActiv-G', 'DM', 'PE-VPS', 2019, NULL, 'petrol', 2000, 'auto', 'fwd', 'suv', 'chain', 'CX-30 2.0'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Mazda') AND lower(model) = lower('CX-30') AND lower(submodel) = lower('2.0 SkyActiv-G') AND year_from = 2019);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Mazda', 'CX-30', '2.5 SkyActiv-G', 'DM', 'PY-VPS', 2019, NULL, 'petrol', 2500, 'auto', 'awd', 'suv', 'chain', 'CX-30 2.5 AWD'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Mazda') AND lower(model) = lower('CX-30') AND lower(submodel) = lower('2.5 SkyActiv-G') AND year_from = 2019);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Mazda', 'Premacy', '2.0 (CR)', 'CREW', 'LF-DE', 2005, 2010, 'petrol', 2000, 'auto', 'fwd', 'van', 'chain', 'Premacy 7-seat'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Mazda') AND lower(model) = lower('Premacy') AND lower(submodel) = lower('2.0 (CR)') AND year_from = 2005);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Mazda', 'Premacy', '2.0 (CW)', 'CWEFW', 'PE-VPS', 2010, 2018, 'petrol', 2000, 'auto', 'fwd', 'van', 'chain', 'Premacy gen3 2.0'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Mazda') AND lower(model) = lower('Premacy') AND lower(submodel) = lower('2.0 (CW)') AND year_from = 2010);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Mazda', 'BT-50', '2.5/3.0 (UN)', 'UN', 'WL-C', 2006, 2011, 'diesel', 2500, 'manual', '4wd', 'ute', 'belt', 'BT-50 UN — WL-C 2.5 / WE-C 3.0 (shared with PJ Ranger)'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Mazda') AND lower(model) = lower('BT-50') AND lower(submodel) = lower('2.5/3.0 (UN)') AND year_from = 2006);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Nissan', 'Qashqai', '1.3 DIG-T (J12)', 'J12', 'HR13DDT', 2021, NULL, 'petrol', 1300, 'cvt', 'fwd', 'suv', 'chain', 'Qashqai J12 1.3 turbo mild hybrid (HR13DDT = Renault H5Ht)'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Nissan') AND lower(model) = lower('Qashqai') AND lower(submodel) = lower('1.3 DIG-T (J12)') AND year_from = 2021);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Nissan', 'Teana', '2.3/3.5 V6 (J31)', 'J31', 'VQ23DE', 2003, 2008, 'petrol', 2300, 'cvt', 'fwd', 'sedan', 'chain', 'Teana J31 230JK/350JM'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Nissan') AND lower(model) = lower('Teana') AND lower(submodel) = lower('2.3/3.5 V6 (J31)') AND year_from = 2003);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Nissan', 'Teana', '2.5 V6 (J32)', 'J32', 'VQ25DE', 2008, 2014, 'petrol', 2500, 'cvt', 'fwd', 'sedan', 'chain', 'Teana J32 250XL/250XV'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Nissan') AND lower(model) = lower('Teana') AND lower(submodel) = lower('2.5 V6 (J32)') AND year_from = 2008);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Nissan', 'Wingroad', '1.5 (Y12)', 'Y12', 'HR15DE', 2005, 2018, 'petrol', 1500, 'cvt', 'fwd', 'wagon', 'chain', 'Wingroad Y12 1.5'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Nissan') AND lower(model) = lower('Wingroad') AND lower(submodel) = lower('1.5 (Y12)') AND year_from = 2005);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Nissan', 'Juke', '1.5 (F15)', 'F15', 'HR15DE', 2010, 2019, 'petrol', 1500, 'cvt', 'fwd', 'suv', 'chain', 'Juke 15RX (JDM import)'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Nissan') AND lower(model) = lower('Juke') AND lower(submodel) = lower('1.5 (F15)') AND year_from = 2010);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Nissan', 'Murano', '3.5 V6 (Z50)', 'Z50', 'VQ35DE', 2004, 2008, 'petrol', 3500, 'cvt', 'awd', 'suv', 'chain', 'Murano Z50 3.5'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Nissan') AND lower(model) = lower('Murano') AND lower(submodel) = lower('3.5 V6 (Z50)') AND year_from = 2004);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Nissan', 'Murano', '3.5 V6 (Z51)', 'Z51', 'VQ35DE', 2008, 2015, 'petrol', 3500, 'cvt', 'awd', 'suv', 'chain', 'Murano Z51 3.5'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Nissan') AND lower(model) = lower('Murano') AND lower(submodel) = lower('3.5 V6 (Z51)') AND year_from = 2008);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Nissan', 'Elgrand', '3.5 V6 (E51)', 'E51', 'VQ35DE', 2002, 2010, 'petrol', 3500, 'auto', 'rwd', 'van', 'chain', 'Elgrand E51 — popular NZ people-mover import'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Nissan') AND lower(model) = lower('Elgrand') AND lower(submodel) = lower('3.5 V6 (E51)') AND year_from = 2002);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Honda', 'Fit', '1.3 (GR)', 'GR1', 'L13B', 2020, NULL, 'petrol', 1300, 'cvt', 'fwd', 'hatch', 'chain', 'Fit 4th gen 1.3'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Honda') AND lower(model) = lower('Fit') AND lower(submodel) = lower('1.3 (GR)') AND year_from = 2020);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Honda', 'Fit', 'e:HEV (GR)', 'GR3', 'LEB', 2020, NULL, 'hybrid', 1500, 'cvt', 'fwd', 'hatch', 'chain', 'Fit e:HEV 1.5 i-MMD (LEB family)'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Honda') AND lower(model) = lower('Fit') AND lower(submodel) = lower('e:HEV (GR)') AND year_from = 2020);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Honda', 'CR-V', '2.0/2.4 (RD4/RD5)', 'RD4/RD5', 'K24A', 2001, 2006, 'petrol', 2400, 'auto', 'awd', 'suv', 'chain', 'CR-V gen2 K20/K24'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Honda') AND lower(model) = lower('CR-V') AND lower(submodel) = lower('2.0/2.4 (RD4/RD5)') AND year_from = 2001);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Honda', 'HR-V', '1.8 (RU)', 'RU5', 'R18Z', 2015, 2021, 'petrol', 1800, 'cvt', 'fwd', 'suv', 'chain', 'HR-V 1.8 (NZ-new, petrol)'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Honda') AND lower(model) = lower('HR-V') AND lower(submodel) = lower('1.8 (RU)') AND year_from = 2015);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Mitsubishi', 'Outlander', '2.4 (ZG/ZH)', 'ZG/ZH', '4B12', 2006, 2012, 'petrol', 2400, 'cvt', 'awd', 'suv', 'chain', 'Outlander gen2 2.4'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Mitsubishi') AND lower(model) = lower('Outlander') AND lower(submodel) = lower('2.4 (ZG/ZH)') AND year_from = 2006);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Suzuki', 'Swift', '1.3/1.5 (RS413/RS415)', 'RS413', 'M15A', 2004, 2010, 'petrol', 1500, 'auto', 'fwd', 'hatch', 'chain', 'Swift gen2 M13A/M15A (M-series)'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Suzuki') AND lower(model) = lower('Swift') AND lower(submodel) = lower('1.3/1.5 (RS413/RS415)') AND year_from = 2004);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Suzuki', 'Swift Sport', '1.6 (ZC31)', 'ZC31S', 'M16A', 2005, 2011, 'petrol', 1600, 'manual', 'fwd', 'hatch', 'chain', 'Swift Sport ZC31'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Suzuki') AND lower(model) = lower('Swift Sport') AND lower(submodel) = lower('1.6 (ZC31)') AND year_from = 2005);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Suzuki', 'Ignis', '1.2', 'MF', 'K12C', 2016, NULL, 'petrol', 1200, 'cvt', 'fwd', 'hatch', 'chain', 'Ignis 1.2 K12C (K12 family)'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Suzuki') AND lower(model) = lower('Ignis') AND lower(submodel) = lower('1.2') AND year_from = 2016);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Suzuki', 'SX4', '1.5/1.6', 'YA/YB', 'M16A', 2006, 2014, 'petrol', 1600, 'auto', 'awd', 'hatch', 'chain', 'SX4 M15A/M16A'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Suzuki') AND lower(model) = lower('SX4') AND lower(submodel) = lower('1.5/1.6') AND year_from = 2006);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Holden', 'Colorado', '3.0 TD (RC)', 'RC', '4JJ1-TC', 2008, 2012, 'diesel', 3000, 'manual', '4wd', 'ute', 'chain', 'Colorado RC — Isuzu 4JJ1 (shared with D-Max)'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Holden') AND lower(model) = lower('Colorado') AND lower(submodel) = lower('3.0 TD (RC)') AND year_from = 2008);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Holden', 'Colorado', '2.8 TD (RG)', 'RG', 'LWN', 2012, 2020, 'diesel', 2800, 'auto', '4wd', 'ute', 'belt', 'Colorado RG 2.8 Duramax'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Holden') AND lower(model) = lower('Colorado') AND lower(submodel) = lower('2.8 TD (RG)') AND year_from = 2012);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Holden', 'Cruze', '1.8 (JG/JH)', 'JG/JH', 'F18D4', 2009, 2016, 'petrol', 1800, 'auto', 'fwd', 'sedan', 'belt', 'Cruze 1.8'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Holden') AND lower(model) = lower('Cruze') AND lower(submodel) = lower('1.8 (JG/JH)') AND year_from = 2009);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Holden', 'Barina', '1.6 (TM)', 'TM', 'F16D4', 2011, 2018, 'petrol', 1600, 'auto', 'fwd', 'hatch', 'belt', 'Barina TM 1.6'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Holden') AND lower(model) = lower('Barina') AND lower(submodel) = lower('1.6 (TM)') AND year_from = 2011);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Hyundai', 'Tucson', '2.0 (JM)', 'JM', 'G4GC', 2004, 2010, 'petrol', 2000, 'auto', 'awd', 'suv', 'belt', 'Tucson JM 2.0 Beta (belt)'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Hyundai') AND lower(model) = lower('Tucson') AND lower(submodel) = lower('2.0 (JM)') AND year_from = 2004);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Hyundai', 'Tucson', '2.0/2.4 (ix35)', 'LM', 'G4KD', 2010, 2015, 'petrol', 2000, 'auto', 'awd', 'suv', 'chain', 'ix35/Tucson LM Theta II'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Hyundai') AND lower(model) = lower('Tucson') AND lower(submodel) = lower('2.0/2.4 (ix35)') AND year_from = 2010);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Hyundai', 'Tucson', '2.0 CRDi (ix35)', 'LM', 'D4HA', 2010, 2015, 'diesel', 2000, 'auto', 'awd', 'suv', 'chain', 'ix35/Tucson LM 2.0 CRDi'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Hyundai') AND lower(model) = lower('Tucson') AND lower(submodel) = lower('2.0 CRDi (ix35)') AND year_from = 2010);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Hyundai', 'Tucson', '2.0 (NX4)', 'NX4', 'G4NL', 2021, NULL, 'petrol', 2000, 'auto', 'fwd', 'suv', 'chain', 'Tucson NX4 2.0 MPi (Nu)'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Hyundai') AND lower(model) = lower('Tucson') AND lower(submodel) = lower('2.0 (NX4)') AND year_from = 2021);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Hyundai', 'Santa Fe', '2.4 (CM)', 'CM', 'G4KE', 2006, 2012, 'petrol', 2400, 'auto', 'awd', 'suv', 'chain', 'Santa Fe CM 2.4 Theta'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Hyundai') AND lower(model) = lower('Santa Fe') AND lower(submodel) = lower('2.4 (CM)') AND year_from = 2006);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Hyundai', 'Santa Fe', '2.2 CRDi (CM)', 'CM', 'D4EB', 2006, 2012, 'diesel', 2200, 'auto', 'awd', 'suv', 'chain', 'Santa Fe CM 2.2 CRDi D4EB (priced on R-series diesel family — similar service)'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Hyundai') AND lower(model) = lower('Santa Fe') AND lower(submodel) = lower('2.2 CRDi (CM)') AND year_from = 2006);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Hyundai', 'Santa Fe', '2.2 CRDi (TM)', 'TM', 'D4HB', 2018, NULL, 'diesel', 2200, 'auto', 'awd', 'suv', 'chain', 'Santa Fe TM 2.2 CRDi R-series'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Hyundai') AND lower(model) = lower('Santa Fe') AND lower(submodel) = lower('2.2 CRDi (TM)') AND year_from = 2018);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Hyundai', 'Santa Fe', '3.5 V6 (TM)', 'TM', 'G6DC', 2018, NULL, 'petrol', 3500, 'auto', 'awd', 'suv', 'chain', 'Santa Fe TM 3.5 V6'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Hyundai') AND lower(model) = lower('Santa Fe') AND lower(submodel) = lower('3.5 V6 (TM)') AND year_from = 2018);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Hyundai', 'Getz', '1.4/1.6', 'TB', 'G4EE', 2002, 2011, 'petrol', 1400, 'auto', 'fwd', 'hatch', 'belt', 'Getz Alpha (belt)'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Hyundai') AND lower(model) = lower('Getz') AND lower(submodel) = lower('1.4/1.6') AND year_from = 2002);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Hyundai', 'Elantra', '1.8 (MD)', 'MD', 'G4NB', 2011, 2015, 'petrol', 1800, 'auto', 'fwd', 'sedan', 'chain', 'Elantra MD 1.8 Nu'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Hyundai') AND lower(model) = lower('Elantra') AND lower(submodel) = lower('1.8 (MD)') AND year_from = 2011);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Hyundai', 'Accent', '1.6 (RB)', 'RB', 'G4FC', 2011, 2019, 'petrol', 1600, 'auto', 'fwd', 'sedan', 'belt', 'Accent RB 1.6 Gamma'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Hyundai') AND lower(model) = lower('Accent') AND lower(submodel) = lower('1.6 (RB)') AND year_from = 2011);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Hyundai', 'iLoad', '2.5 CRDi', 'TQ', 'D4CB', 2008, 2021, 'diesel', 2500, 'auto', 'rwd', 'van', 'chain', 'iLoad/iMax — common NZ trade van'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Hyundai') AND lower(model) = lower('iLoad') AND lower(submodel) = lower('2.5 CRDi') AND year_from = 2008);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Hyundai', 'Ioniq', '1.6 Hybrid', 'AE', 'G4LE', 2016, 2022, 'hybrid', 1600, 'dct', 'fwd', 'hatch', 'chain', 'Ioniq Hybrid (Kappa 1.6 GDi)'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Hyundai') AND lower(model) = lower('Ioniq') AND lower(submodel) = lower('1.6 Hybrid') AND year_from = 2016);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Hyundai', 'Ioniq', 'Electric', 'AE', NULL, 2016, 2022, 'bev', NULL, 'single_speed', 'fwd', 'hatch', 'na', 'Ioniq Electric 28/38kWh'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Hyundai') AND lower(model) = lower('Ioniq') AND lower(submodel) = lower('Electric') AND year_from = 2016);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Kia', 'Sportage', '2.0 (KM)', 'KM', 'G4GC', 2004, 2010, 'petrol', 2000, 'auto', 'awd', 'suv', 'belt', 'Sportage KM 2.0 Beta (belt)'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Kia') AND lower(model) = lower('Sportage') AND lower(submodel) = lower('2.0 (KM)') AND year_from = 2004);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Kia', 'Sorento', '2.4 (XM)', 'XM', 'G4KE', 2009, 2015, 'petrol', 2400, 'auto', 'awd', 'suv', 'chain', 'Sorento XM 2.4'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Kia') AND lower(model) = lower('Sorento') AND lower(submodel) = lower('2.4 (XM)') AND year_from = 2009);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Kia', 'Sorento', '2.2 CRDi (XM)', 'XM', 'D4HB', 2009, 2015, 'diesel', 2200, 'auto', 'awd', 'suv', 'chain', 'Sorento XM 2.2 CRDi R-series'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Kia') AND lower(model) = lower('Sorento') AND lower(submodel) = lower('2.2 CRDi (XM)') AND year_from = 2009);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Kia', 'Sorento', '2.2 CRDi (MQ4)', 'MQ4', 'D4HE', 2020, NULL, 'diesel', 2200, 'dct', 'awd', 'suv', 'chain', 'Sorento MQ4 2.2 CRDi'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Kia') AND lower(model) = lower('Sorento') AND lower(submodel) = lower('2.2 CRDi (MQ4)') AND year_from = 2020);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Kia', 'Sorento', '1.6T Hybrid (MQ4)', 'MQ4', 'G4FT', 2020, NULL, 'hybrid', 1600, 'auto', 'awd', 'suv', 'chain', 'Sorento HEV/PHEV'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Kia') AND lower(model) = lower('Sorento') AND lower(submodel) = lower('1.6T Hybrid (MQ4)') AND year_from = 2020);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Kia', 'Rio', '1.4 (YB)', 'YB', 'G4LC', 2017, 2023, 'petrol', 1400, 'auto', 'fwd', 'hatch', 'chain', 'Rio YB 1.4 Kappa — common NZ rental/fleet'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Kia') AND lower(model) = lower('Rio') AND lower(submodel) = lower('1.4 (YB)') AND year_from = 2017);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Kia', 'Seltos', '2.0 (SP2)', 'SP2', 'G4NH', 2019, NULL, 'petrol', 2000, 'cvt', 'fwd', 'suv', 'chain', 'Seltos 2.0 MPi (Nu)'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Kia') AND lower(model) = lower('Seltos') AND lower(submodel) = lower('2.0 (SP2)') AND year_from = 2019);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Kia', 'Stonic', '1.4', 'YB', 'G4LC', 2017, NULL, 'petrol', 1400, 'auto', 'fwd', 'suv', 'chain', 'Stonic 1.4 Kappa'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Kia') AND lower(model) = lower('Stonic') AND lower(submodel) = lower('1.4') AND year_from = 2017);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Kia', 'Niro', '1.6 Hybrid (SG2)', 'SG2', 'G4LL', 2022, NULL, 'hybrid', 1600, 'dct', 'fwd', 'suv', 'chain', 'Niro gen2 HEV'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Kia') AND lower(model) = lower('Niro') AND lower(submodel) = lower('1.6 Hybrid (SG2)') AND year_from = 2022);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Kia', 'Niro', 'EV (SG2)', 'SG2', NULL, 2022, NULL, 'bev', NULL, 'single_speed', 'fwd', 'suv', 'na', 'Niro EV gen2 64.8kWh'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Kia') AND lower(model) = lower('Niro') AND lower(submodel) = lower('EV (SG2)') AND year_from = 2022);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Kia', 'Carnival', '2.2 CRDi (YP)', 'YP', 'D4HB', 2014, 2020, 'diesel', 2200, 'auto', 'fwd', 'van', 'chain', 'Carnival YP 2.2 CRDi'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Kia') AND lower(model) = lower('Carnival') AND lower(submodel) = lower('2.2 CRDi (YP)') AND year_from = 2014);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Kia', 'Carnival', '2.2 CRDi (KA4)', 'KA4', 'D4HE', 2020, NULL, 'diesel', 2200, 'auto', 'fwd', 'van', 'chain', 'Carnival KA4 2.2 CRDi'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Kia') AND lower(model) = lower('Carnival') AND lower(submodel) = lower('2.2 CRDi (KA4)') AND year_from = 2020);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Kia', 'Carnival', '3.5 V6 (KA4)', 'KA4', 'G6DP', 2020, NULL, 'petrol', 3500, 'auto', 'fwd', 'van', 'chain', 'Carnival KA4 3.5 V6'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Kia') AND lower(model) = lower('Carnival') AND lower(submodel) = lower('3.5 V6 (KA4)') AND year_from = 2020);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Kia', 'Picanto', '1.25 (JA)', 'JA', 'G4LA', 2017, NULL, 'petrol', 1250, 'auto', 'fwd', 'hatch', 'chain', 'Picanto JA 1.25 Kappa'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Kia') AND lower(model) = lower('Picanto') AND lower(submodel) = lower('1.25 (JA)') AND year_from = 2017);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Volkswagen', 'Polo', '1.4/1.6 (9N)', '9N', 'BBY', 2002, 2009, 'petrol', 1400, 'auto', 'fwd', 'hatch', 'belt', 'Polo 9N MPI (EA111 belt)'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Volkswagen') AND lower(model) = lower('Polo') AND lower(submodel) = lower('1.4/1.6 (9N)') AND year_from = 2002);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Volkswagen', 'Amarok', '2.0 BiTDI', '2H', 'CDCA', 2010, 2020, 'diesel', 2000, 'auto', '4wd', 'ute', 'belt', 'Amarok 2.0 TDI/BiTDI (EA189 CDCA)'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Volkswagen') AND lower(model) = lower('Amarok') AND lower(submodel) = lower('2.0 BiTDI') AND year_from = 2010);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Volkswagen', 'Amarok', '3.0 V6 TDI', '2H', 'DDXC', 2017, 2020, 'diesel', 3000, 'auto', '4wd', 'ute', 'chain', 'Amarok V6 3.0 TDI'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Volkswagen') AND lower(model) = lower('Amarok') AND lower(submodel) = lower('3.0 V6 TDI') AND year_from = 2017);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Volkswagen', 'Amarok', '2.0 BiT (Ranger-based)', 'NG', 'YN2S', 2023, NULL, 'diesel', 2000, 'auto', '4wd', 'ute', 'chain', 'Amarok 2023+ — built on Ford Ranger platform'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Volkswagen') AND lower(model) = lower('Amarok') AND lower(submodel) = lower('2.0 BiT (Ranger-based)') AND year_from = 2023);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Mercedes-Benz', 'C200', '1.8 Kompressor/CGI (W204)', 'W204', 'M271', 2007, 2014, 'petrol', 1800, 'auto', 'rwd', 'sedan', 'chain', 'W204 C200 Kompressor / CGI 1.8 M271'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Mercedes-Benz') AND lower(model) = lower('C200') AND lower(submodel) = lower('1.8 Kompressor/CGI (W204)') AND year_from = 2007);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'BMW', '320i', '2.0 (E90)', 'E90', 'N46B20', 2005, 2012, 'petrol', 2000, 'auto', 'rwd', 'sedan', 'chain', 'E90/E91 320i — very common NZ import'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('BMW') AND lower(model) = lower('320i') AND lower(submodel) = lower('2.0 (E90)') AND year_from = 2005);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'MG', 'MG3', '1.5', 'SZP', '15S4C', 2019, NULL, 'petrol', 1500, 'auto', 'fwd', 'hatch', 'chain', 'MG3 1.5 VTi-Tech'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('MG') AND lower(model) = lower('MG3') AND lower(submodel) = lower('1.5') AND year_from = 2019);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Volvo', 'XC60', '2.0 T5 (gen1)', 'DZ', 'B4204T6', 2008, 2017, 'petrol', 2000, 'auto', 'fwd', 'suv', 'chain', 'XC60 gen1 T5 2.0 (B4204T6 = Ford EcoBoost 2.0)'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Volvo') AND lower(model) = lower('XC60') AND lower(submodel) = lower('2.0 T5 (gen1)') AND year_from = 2008);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Jeep', 'Grand Cherokee', '3.6 V6 (WK2)', 'WK2', 'ERB', 2011, 2021, 'petrol', 3600, 'auto', '4wd', 'suv', 'chain', 'Grand Cherokee WK2 3.6 Pentastar'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Jeep') AND lower(model) = lower('Grand Cherokee') AND lower(submodel) = lower('3.6 V6 (WK2)') AND year_from = 2011);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Jeep', 'Wrangler', '3.6 V6 (JK)', 'JK', 'ERB', 2012, 2018, 'petrol', 3600, 'auto', '4wd', 'suv', 'chain', 'Wrangler JK 3.6 Pentastar'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Jeep') AND lower(model) = lower('Wrangler') AND lower(submodel) = lower('3.6 V6 (JK)') AND year_from = 2012);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Jeep', 'Wrangler', '3.6 V6 (JL)', 'JL', 'ERC', 2018, NULL, 'petrol', 3600, 'auto', '4wd', 'suv', 'chain', 'Wrangler JL 3.6'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Jeep') AND lower(model) = lower('Wrangler') AND lower(submodel) = lower('3.6 V6 (JL)') AND year_from = 2018);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Ram', '1500', '5.7 HEMI V8', 'DS/DT', 'EZH', 2019, NULL, 'petrol', 5700, 'auto', '4wd', 'ute', 'chain', 'Ram 1500 Express/Laramie (NZ RHD conversion)'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Ram') AND lower(model) = lower('1500') AND lower(submodel) = lower('5.7 HEMI V8') AND year_from = 2019);
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes)
SELECT 'Chevrolet', 'Silverado', '6.2 V8 (1500)', 'T1', 'L87', 2019, NULL, 'petrol', 6200, 'auto', '4wd', 'ute', 'chain', 'Silverado 1500 LTZ/Trail Boss (NZ RHD conversion)'
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_models WHERE lower(make) = lower('Chevrolet') AND lower(model) = lower('Silverado') AND lower(submodel) = lower('6.2 V8 (1500)') AND year_from = 2019);

-- mapping fixes
UPDATE public.fleet_vehicles SET engine_family_id = 'TOY_M15AFKS_15' WHERE vehicle_id = 'TOY_YARIS_MXPA10_20_NOW'; -- XP210 Yaris 1.5 is the M15A-FKS 3cyl, not the 1NR/2NR
UPDATE public.fleet_vehicles SET engine_family_id = 'TOY_M15AFXE_15_HYBRID' WHERE vehicle_id = 'TOY_AQUA_MXPK10_21_NOW'; -- Aqua gen2 is the M15A-FXE hybrid, not the 1NZ-FXE
UPDATE public.fleet_vehicles SET engine_family_id = 'TOY_M20AFKS_20' WHERE vehicle_id = 'TOY_COROLLA_E210_18_NOW'; -- E210 Corolla 2.0 is the M20A-FKS, not the 1.8 2ZR
UPDATE public.fleet_vehicles SET engine_family_id = 'MG_SAIC_15_NA', submodel = '1.5' WHERE vehicle_id = 'MG_ZS_18_NOW'; -- NZ MG ZS 1.5 is the naturally aspirated 15S4C, not a turbo

-- name aliases (registry strings → stored combined/regional model names)
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, source)
SELECT fv.vehicle_id, fv.make, trim(part), COALESCE(fv.submodel, ''), fv.year_from, fv.year_to, 'name_alias_070'
FROM public.fleet_vehicles fv, unnest(string_to_array(fv.model, '/')) AS part
WHERE position('/' in fv.model) > 0
  AND NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases a WHERE a.vehicle_id = fv.vehicle_id AND lower(a.alias_model) = lower(trim(part)));
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, source)
SELECT fv.vehicle_id, fv.make, x.alias, COALESCE(fv.submodel, ''), fv.year_from, fv.year_to, 'name_alias_070'
FROM public.fleet_vehicles fv
CROSS JOIN LATERAL (VALUES
  (CASE WHEN fv.model ILIKE 'prado' THEN 'Land Cruiser Prado' END),
  (CASE WHEN fv.model ILIKE 'kluger' AND fv.year_from >= 2007 THEN 'Highlander' END),
  (CASE WHEN fv.model ILIKE 'jazz' OR fv.model ILIKE 'fit hybrid' THEN 'Fit' END),
  (CASE WHEN fv.make = 'Mercedes-Benz' AND fv.model ~ '^[A-Z]{1,3}[0-9]{3}' THEN regexp_replace(fv.model, '^([A-Z]{1,3})([0-9]{3})', '\1 \2') END),
  (CASE WHEN fv.model ~* '^corolla (fielder|axio)$' THEN regexp_replace(fv.model, '^corolla ', '', 'i') END)
) AS x(alias)
WHERE x.alias IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases a WHERE a.vehicle_id = fv.vehicle_id AND lower(a.alias_model) = lower(x.alias));

-- Atenza is the JDM name for every Mazda6 generation
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, source)
SELECT fv.vehicle_id, 'Mazda', 'Atenza', COALESCE(fv.submodel, ''), fv.year_from, fv.year_to, 'name_alias_070'
FROM public.fleet_vehicles fv WHERE fv.make = 'Mazda' AND fv.model = 'Mazda6'
  AND NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases a WHERE a.vehicle_id = fv.vehicle_id AND lower(a.alias_model) = 'atenza');

-- Amarok uses a ZF 8HP torque-converter auto (or 6MT), not a DSG: clone the engine families with ATF transmission data
INSERT INTO public.engine_families (family_id, common_name, manufacturer, displacement_l, cylinders, fuel, timing_type, cambelt_interval_km, cambelt_interval_years, oil_spec, oil_capacity_l, coolant_spec, segment_tier, service_interval_km, service_interval_months, notes)
SELECT 'VW_EA189_20_TDI_AMAROK', 'VW EA189 2.0 BiTDI (Amarok, ZF 8HP auto)', manufacturer, displacement_l, cylinders, fuel, timing_type, cambelt_interval_km, cambelt_interval_years, oil_spec, oil_capacity_l, coolant_spec, segment_tier, service_interval_km, service_interval_months, 'VW EA189 2.0 BiTDI (Amarok, ZF 8HP auto). Engine data as VW_EA189_20_TDI; transmission is the ZF 8HP45 8-speed auto — ATF + pan/filter service.'
FROM public.engine_families WHERE family_id = 'VW_EA189_20_TDI' ON CONFLICT (family_id) DO NOTHING;
INSERT INTO public.engine_family_fluids (engine_family_id, oil_fluid_id, coolant_fluid_id, trans_fluid_id, brake_fluid_id)
SELECT 'VW_EA189_20_TDI_AMAROK', oil_fluid_id, coolant_fluid_id, 'TRANS_ATF_CONVENTIONAL', brake_fluid_id FROM public.engine_family_fluids WHERE engine_family_id = 'VW_EA189_20_TDI' ON CONFLICT (engine_family_id) DO NOTHING;
INSERT INTO public.service_schedule (engine_family_id, coolant_capacity_l, trans_capacity_l, oil_interval_km, oil_interval_months, coolant_interval_km, coolant_interval_months, brake_fluid_interval_months, trans_interval_km, aircon_refrigerant, confidence, notes)
SELECT 'VW_EA189_20_TDI_AMAROK', coolant_capacity_l, 5.0, oil_interval_km, oil_interval_months, coolant_interval_km, coolant_interval_months, brake_fluid_interval_months, 80000, aircon_refrigerant, confidence, 'ZF 8HP — ATF + pan/filter' FROM public.service_schedule WHERE engine_family_id = 'VW_EA189_20_TDI' ON CONFLICT (engine_family_id) DO NOTHING;
INSERT INTO public.ef_parts_data (engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
SELECT 'VW_EA189_20_TDI_AMAROK', category_id,
  CASE WHEN category_id = (SELECT id FROM part_categories WHERE slug='transmission_service') THEN 420 ELSE total_job_low END,
  CASE WHEN category_id = (SELECT id FROM part_categories WHERE slug='transmission_service') THEN 620 ELSE total_job_high END,
  CASE WHEN category_id = (SELECT id FROM part_categories WHERE slug='transmission_service') THEN 1.0 ELSE hours_low END,
  CASE WHEN category_id = (SELECT id FROM part_categories WHERE slug='transmission_service') THEN 1.5 ELSE hours_high END,
  source_anchor, confidence, notes
FROM public.ef_parts_data WHERE engine_family_id = 'VW_EA189_20_TDI' ON CONFLICT (engine_family_id, category_id) DO NOTHING;
UPDATE public.fleet_vehicles SET engine_family_id = 'VW_EA189_20_TDI_AMAROK' WHERE vehicle_id = 'VW_AMAROK_2H_20TDI_10_20';
INSERT INTO public.engine_families (family_id, common_name, manufacturer, displacement_l, cylinders, fuel, timing_type, cambelt_interval_km, cambelt_interval_years, oil_spec, oil_capacity_l, coolant_spec, segment_tier, service_interval_km, service_interval_months, notes)
SELECT 'VW_30_TDI_V6_AMAROK', 'VW 3.0 V6 TDI (Amarok, ZF 8HP auto)', manufacturer, displacement_l, cylinders, fuel, timing_type, cambelt_interval_km, cambelt_interval_years, oil_spec, oil_capacity_l, coolant_spec, segment_tier, service_interval_km, service_interval_months, 'VW 3.0 V6 TDI (Amarok, ZF 8HP auto). Engine data as AUDI_30_TDI_V6; transmission is the ZF 8HP45 8-speed auto — ATF + pan/filter service.'
FROM public.engine_families WHERE family_id = 'AUDI_30_TDI_V6' ON CONFLICT (family_id) DO NOTHING;
INSERT INTO public.engine_family_fluids (engine_family_id, oil_fluid_id, coolant_fluid_id, trans_fluid_id, brake_fluid_id)
SELECT 'VW_30_TDI_V6_AMAROK', oil_fluid_id, coolant_fluid_id, 'TRANS_ATF_CONVENTIONAL', brake_fluid_id FROM public.engine_family_fluids WHERE engine_family_id = 'AUDI_30_TDI_V6' ON CONFLICT (engine_family_id) DO NOTHING;
INSERT INTO public.service_schedule (engine_family_id, coolant_capacity_l, trans_capacity_l, oil_interval_km, oil_interval_months, coolant_interval_km, coolant_interval_months, brake_fluid_interval_months, trans_interval_km, aircon_refrigerant, confidence, notes)
SELECT 'VW_30_TDI_V6_AMAROK', coolant_capacity_l, 5.0, oil_interval_km, oil_interval_months, coolant_interval_km, coolant_interval_months, brake_fluid_interval_months, 80000, aircon_refrigerant, confidence, 'ZF 8HP — ATF + pan/filter' FROM public.service_schedule WHERE engine_family_id = 'AUDI_30_TDI_V6' ON CONFLICT (engine_family_id) DO NOTHING;
INSERT INTO public.ef_parts_data (engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
SELECT 'VW_30_TDI_V6_AMAROK', category_id,
  CASE WHEN category_id = (SELECT id FROM part_categories WHERE slug='transmission_service') THEN 420 ELSE total_job_low END,
  CASE WHEN category_id = (SELECT id FROM part_categories WHERE slug='transmission_service') THEN 620 ELSE total_job_high END,
  CASE WHEN category_id = (SELECT id FROM part_categories WHERE slug='transmission_service') THEN 1.0 ELSE hours_low END,
  CASE WHEN category_id = (SELECT id FROM part_categories WHERE slug='transmission_service') THEN 1.5 ELSE hours_high END,
  source_anchor, confidence, notes
FROM public.ef_parts_data WHERE engine_family_id = 'AUDI_30_TDI_V6' ON CONFLICT (engine_family_id, category_id) DO NOTHING;
UPDATE public.fleet_vehicles SET engine_family_id = 'VW_30_TDI_V6_AMAROK' WHERE vehicle_id = 'VW_AMAROK_2H_30V6_17_20';
