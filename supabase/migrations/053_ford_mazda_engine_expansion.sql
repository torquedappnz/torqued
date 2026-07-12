SET search_path TO public;

-- ============================================================
-- TORQUED — Migration 053: Ford & Mazda engine family expansion
-- Adds 20 new Ford + 19 new Mazda engine families (the two most
-- underserved brands relative to actual NZ used-import + new fleet
-- composition) with full oil/coolant/trans fluid specs, refill
-- capacities, service intervals, and moat pricing (cambelt/chain
-- full replacement, spark plugs, transmission service).
--
-- Methodology matches migrations 037/042/043/051/052:
--   engine_families / engine_family_fluids / service_schedule rows
--   are idempotent (ON CONFLICT DO NOTHING on the family PK).
--   ef_parts_data pricing = NZ GST-inclusive, confidence 2 (LLM
--   research anchor consistent with the rest of the moat dataset,
--   not yet workshop-verified against a specific supplier quote).
-- ============================================================

-- ── engine_families ──────────────────────────────────────────────────────────

INSERT INTO public.engine_families (
  family_id, common_name, manufacturer, displacement_l, cylinders,
  fuel, timing_type, cambelt_interval_km, cambelt_interval_years,
  oil_spec, oil_capacity_l, coolant_spec, segment_tier,
  service_interval_km, service_interval_months, notes
) VALUES
  ('FORD_SIGMA_13_14', 'Ford Sigma 1.3/1.4L', 'Ford', 1.4, 4, 'petrol', 'belt', 100000, 10, '5W-30 API SL/SM', 3.5, 'Ford Super Plus Premium (orange OAT)', 'economy', 10000, 12, 'Fiesta MK4/5/6 1.3/1.4, Ka Mk1. Belt — many owners unaware of interval, flag at intake if service history unknown.'),
  ('FORD_DURATEC_16_SIGMA', 'Ford Duratec 1.6L (Sigma)', 'Ford', 1.6, 4, 'petrol', 'belt', 160000, 10, '5W-30 API SL/SM', 3.8, 'Ford Super Plus Premium (orange OAT)', 'economy', 10000, 12, 'Fiesta MK6/7 1.6, Focus MK1/2 1.6 Duratec/Ti-VCT, Fusion. Belt — Ford quoted ''lifetime'' on early cars; workshop consensus is 160,000km/10yr.'),
  ('FORD_ZETEC_18_ZETEC_E', 'Ford Zetec-E 1.8L', 'Ford', 1.8, 4, 'petrol', 'belt', 100000, 10, '5W-30 API SL', 4.2, 'Ford Super Plus Premium (orange OAT)', 'economy', 10000, 12, 'Focus MK1 1.8 Zetec, Mondeo MK1/2/3 1.8, Escort. Belt 100,000km — interference engine, do not run over interval.'),
  ('FORD_ZETEC_20_ZETEC_E', 'Ford Zetec-E 2.0L', 'Ford', 2.0, 4, 'petrol', 'belt', 100000, 10, '5W-30 API SL', 4.5, 'Ford Super Plus Premium (orange OAT)', 'mid', 10000, 12, 'Mondeo MK1/2/3 2.0 Zetec, Focus MK1 2.0, Galaxy MK1. Belt 100,000km.'),
  ('FORD_DURATEC_20_MZR', 'Ford Duratec 2.0L (MZR-shared)', 'Ford', 2.0, 4, 'petrol', 'chain', NULL, NULL, '5W-30 API SN', 4.5, 'Ford Super Plus Premium (orange OAT)', 'mid', 10000, 12, 'Mondeo MK4 2.0 Duratec, Focus MK2 facelift 2.0, Kuga MK1 2.0 petrol, Escape ZD 2.0. Shares MZR architecture with Mazda. Chain.'),
  ('FORD_DURATEC_23_MZR', 'Ford Duratec 2.3L (MZR-shared)', 'Ford', 2.3, 4, 'petrol', 'chain', NULL, NULL, '5W-30 API SN', 4.8, 'Ford Super Plus Premium (orange OAT)', 'mid', 10000, 12, 'Mondeo MK4 2.3, Escape/Kuga 2.3 petrol (US/NZ grey import), Fusion (US) 2.3. Chain.'),
  ('FORD_ECOBOOST_10_3CYL', 'Ford EcoBoost 1.0L 3cyl Turbo', 'Ford', 1.0, 3, 'petrol', 'belt', 150000, 10, '5W-20 Ford WSS-M2C948-B', 3.7, 'Ford Super Plus Premium (orange OAT)', 'economy', 10000, 12, 'Fiesta/Focus MK3/4 1.0 EcoBoost 2012+, EcoSport 1.0T, Puma 1.0 (non-hybrid). Belt in this 3-cylinder — often missed at intake since most modern small Fords are chain. 150,000km/10yr Ford figure; many workshops recommend earlier.'),
  ('FORD_ECOBOOST_15_4CYL', 'Ford EcoBoost 1.5L Turbo', 'Ford', 1.5, 4, 'petrol', 'chain', NULL, NULL, '5W-20 Ford WSS-M2C948-B', 4.5, 'Ford Super Plus Premium (orange OAT)', 'mid', 10000, 12, 'Focus MK3/4 1.5 EcoBoost, Mondeo MK5 1.5, Kuga MK2 1.5, Escape 1.5 (US). Chain.'),
  ('FORD_ECOBOOST_16_TURBO', 'Ford EcoBoost 1.6L Turbo', 'Ford', 1.6, 4, 'petrol', 'chain', NULL, NULL, '5W-30 Ford WSS-M2C913-C', 4.5, 'Ford Super Plus Premium (orange OAT)', 'mid', 10000, 12, 'Fiesta ST/Focus ST MK3 1.6 EcoBoost 2010-2017, Kuga MK1 1.6T, EcoSport 1.6T (grey import), Transit Connect 1.6 Ti-VCT (NA variant separate). Chain.'),
  ('FORD_ECOBOOST_20_4CYL', 'Ford EcoBoost 2.0L Turbo', 'Ford', 2.0, 4, 'petrol', 'chain', NULL, NULL, '5W-30 Ford WSS-M2C913-C', 5.0, 'Ford Super Plus Premium (orange OAT)', 'mid', 10000, 12, 'Focus ST/RS MK3, Mondeo MK5 2.0T, Edge 2.0T, Explorer 2.0 EcoBoost. Chain.'),
  ('FORD_ECOBOOST_23_4CYL', 'Ford EcoBoost 2.3L Turbo', 'Ford', 2.3, 4, 'petrol', 'chain', NULL, NULL, '5W-30 Ford WSS-M2C913-C', 5.7, 'Ford Super Plus Premium (orange OAT)', 'premium', 10000, 12, 'Mustang 2.3 EcoBoost, Explorer ST, Ranger Raptor (US-spec petrol, grey import). Chain.'),
  ('FORD_DURATORQ_TDCI_16', 'Ford Duratorq TDCi 1.6L', 'Ford', 1.6, 4, 'diesel', 'belt', 200000, 10, '5W-30 Ford WSS-M2C913-D', 4.3, 'Ford Super Plus Premium (orange OAT)', 'economy', 10000, 12, 'Focus MK2/3 1.6 TDCi, Fiesta MK6/7 1.6 TDCi, C-Max MK1/2 1.6 TDCi, Mondeo MK4 1.6 TDCi. Belt 200,000km — DPF on later models.'),
  ('FORD_DURATORQ_TDCI_18', 'Ford Duratorq TDCi 1.8L', 'Ford', 1.8, 4, 'diesel', 'belt', 200000, 10, '5W-30 Ford WSS-M2C913-D', 5.0, 'Ford Super Plus Premium (orange OAT)', 'economy', 10000, 12, 'Focus MK1/2 1.8 TDCi, Mondeo MK3 1.8 TDCi, Transit Connect 1.8 TDCi. Belt 200,000km.'),
  ('FORD_DURATORQ_TDCI_20', 'Ford Duratorq TDCi 2.0L', 'Ford', 2.0, 4, 'diesel', 'belt', 200000, 10, '5W-30 Ford WSS-M2C913-D', 5.5, 'Ford Super Plus Premium (orange OAT)', 'mid', 10000, 12, 'Mondeo MK3/4 2.0 TDCi, Focus MK2 2.0 TDCi, S-Max/Galaxy MK1 2.0 TDCi, Kuga MK1 2.0 TDCi. Belt 200,000km — one of NZ''s most common used-import diesels.'),
  ('FORD_DURATORQ_TDCI_24_TRANSIT', 'Ford Duratorq TDCi 2.4L (Transit)', 'Ford', 2.4, 4, 'diesel', 'belt', 200000, 10, '5W-30 Ford WSS-M2C913-D', 7.0, 'Ford Super Plus Premium (orange OAT)', 'mid', 10000, 12, 'Transit MK6/7 2.4 TDCi 2000-2014 (pre-Puma-engine Transit vans, common NZ commercial fleet). Belt 200,000km.'),
  ('FORD_ECOBLUE_15_DIESEL', 'Ford EcoBlue 1.5L Diesel', 'Ford', 1.5, 4, 'diesel', 'belt', 200000, 10, '0W-30 Ford WSS-M2C913-D', 4.3, 'Ford Super Plus Premium (orange OAT)', 'economy', 10000, 12, 'Fiesta MK7/8 1.5 EcoBlue 2018+, Focus MK4 1.5 EcoBlue, Transit Connect MK2 1.5 EcoBlue. Belt 200,000km.'),
  ('FORD_ECOBLUE_20_DIESEL', 'Ford EcoBlue 2.0L Diesel', 'Ford', 2.0, 4, 'diesel', 'belt', 200000, 10, '0W-30 Ford WSS-M2C913-D', 5.7, 'Ford Super Plus Premium (orange OAT)', 'mid', 10000, 12, 'Focus MK4 2.0 EcoBlue, Mondeo MK5 2.0 EcoBlue, Kuga MK3 2.0 EcoBlue, Transit MK8 2.0 EcoBlue, Ranger/Everest single-turbo variants from 2019+. Belt 200,000km — successor to Duratorq.'),
  ('FORD_MONDEO_25_DURATEC_V6', 'Ford Duratec 2.5L V6', 'Ford', 2.5, 6, 'petrol', 'belt', 160000, 10, '5W-30 API SL', 5.5, 'Ford Super Plus Premium (orange OAT)', 'premium', 10000, 12, 'Mondeo MK3 ST220 2.5 V6, Jaguar-shared Duratec V6 (X-Type 2.5 grey import). Belt — rear bank access adds labour.'),
  ('FORD_KUGA_25_DURATEC', 'Ford Duratec 2.5L I4 (Kuga/Escape)', 'Ford', 2.5, 4, 'petrol', 'chain', NULL, NULL, '5W-30 API SN', 4.8, 'Ford Super Plus Premium (orange OAT)', 'mid', 10000, 12, 'Kuga MK1 2.5T (Volvo-shared), Escape/Maverick 2.5 (US-spec grey import), Focus RS Mk2 2.5T (5-cyl variant is separate — see notes if encountered). Chain.'),
  ('FORD_ESCORT_ZETEC_16', 'Ford Zetec-E 1.6L (Escort/Laser)', 'Ford', 1.6, 4, 'petrol', 'belt', 100000, 10, '10W-40 semi-synthetic API SL', 4.0, 'Ford Super Plus Premium (orange OAT)', 'economy', 10000, 12, 'Escort MK5/6 1.6 Zetec, Laser KJ/KN (Mazda-based badge-engineered — shares Zetec on some, B-series on others). Belt 100,000km.'),
  ('MAZ_MZR_16_BK', 'Mazda MZR 1.6L (L8)', 'Mazda', 1.6, 4, 'petrol', 'chain', NULL, NULL, '5W-30 API SL/SN', 4.0, 'Mazda FL22 (yellow)', 'economy', 10000, 12, 'Mazda3 BK 1.6 2003-2009, Mazda2/Demio DY 1.5 shares related L-series (see ZY-VE), Premacy CP. Chain.'),
  ('MAZ_MZR_20_LF', 'Mazda MZR 2.0L (LF)', 'Mazda', 2.0, 4, 'petrol', 'chain', NULL, NULL, '5W-30 API SL/SN', 4.3, 'Mazda FL22 (yellow)', 'mid', 10000, 12, 'Mazda3 BK/BL 2.0, Mazda6 GG/GH 2.0, CX-7 2.0 (grey import), Premacy CP/CR 2.0, MPV LW/LY. Chain.'),
  ('MAZ_MZR_23_L3', 'Mazda MZR 2.3L (L3)', 'Mazda', 2.3, 4, 'petrol', 'chain', NULL, NULL, '5W-30 API SL/SN', 4.5, 'Mazda FL22 (yellow)', 'mid', 10000, 12, 'Mazda6 GG/GH 2.3, Mazda3 MPS 2.3 turbo (L3-VDT, direct-injection turbo variant), CX-7 2.3 turbo, MX-5 NC 2.3 (naturally aspirated). Chain.'),
  ('MAZ_MZRCD_20_DIESEL', 'Mazda MZR-CD 2.0L Diesel', 'Mazda', 2.0, 4, 'diesel', 'belt', 150000, 10, '5W-30 ACEA C2 (Ford/PSA-derived)', 5.5, 'Mazda FL22 (yellow)', 'mid', 10000, 12, 'Mazda6 GG/GH 2.0 diesel, Mazda3 BK/BL 2.0 diesel, Premacy CP diesel. Shares Ford/PSA DW10-derived architecture. Belt 150,000km.'),
  ('MAZ_MZRCD_22_DIESEL', 'Mazda MZR-CD 2.2L Diesel', 'Mazda', 2.2, 4, 'diesel', 'chain', NULL, NULL, '5W-30 ACEA C2/C3', 6.0, 'Mazda FL22 (yellow)', 'mid', 10000, 12, 'Mazda6 GH facelift/GJ 2.2 diesel, CX-5 KE 2.2 diesel (early, pre-SkyActiv-D badge unification — see MAZ_SKYACTIVD_22 for later cars), CX-7 2.2 diesel. Chain. DPF.'),
  ('MAZ_SKYACTIVG_25T', 'Mazda SkyActiv-G 2.5L Turbo (PY-VPTS)', 'Mazda', 2.5, 4, 'petrol', 'chain', NULL, NULL, '0W-20 Mazda Original', 4.6, 'Mazda FL22 (yellow)', 'premium', 10000, 12, 'CX-9 TC 2.5T 2016+, Mazda6 GJ/GL 2.5T (Skyactiv-G Turbo), CX-5 KF 2.5T Signature, Mazda3 BP 2.5T. Chain. Premium fuel recommended for full turbo output (91 ok, 95+ for peak).'),
  ('MAZ_SKYACTIVX_20', 'Mazda SkyActiv-X 2.0L (P5-XPS)', 'Mazda', 2.0, 4, 'petrol', 'chain', NULL, NULL, '0W-20 Mazda Original SP', 4.6, 'Mazda FL22 (yellow)', 'premium', 10000, 12, 'Mazda3 BP SkyActiv-X 2019+, CX-30 SkyActiv-X. Spark-Controlled Compression Ignition (SPCCI) — mild-hybrid 24V system, specialist diagnostic tooling recommended. Chain.'),
  ('MAZ_SKYACTIVD_18', 'Mazda SkyActiv-D 1.8L (S8-VPTS)', 'Mazda', 1.8, 4, 'diesel', 'chain', NULL, NULL, '0W-30 Mazda Original DL-1', 4.3, 'Mazda FL22 (yellow)', 'mid', 10000, 12, 'Mazda2/Demio DJ diesel, CX-3 DK diesel 2015+, Mazda3 BM/BN 1.8 diesel. Low compression (14.4:1). Chain. DPF requires highway runs.'),
  ('MAZ_BT50_TF_30_DIESEL', 'Mazda BT-50 3.0L Diesel (TF, Isuzu 4JJ3)', 'Mazda', 3.0, 4, 'diesel', 'chain', NULL, NULL, '5W-30 ACEA C3', 7.0, 'Mazda FL22 (yellow)', 'mid', 10000, 12, 'BT-50 TF 2020+ (Isuzu D-Max co-development, 4JJ3-TCX). Chain. DPF. Distinct from earlier UR-generation BT-50 (shared Ford Ranger P5AT, wet belt).'),
  ('MAZ_MAZDA6_GG_L_23_MPS', 'Mazda MPS L3-VDT 2.3L Turbo', 'Mazda', 2.3, 4, 'petrol', 'chain', NULL, NULL, '5W-30 API SL (turbo synthetic)', 4.8, 'Mazda FL22 (yellow)', 'premium', 10000, 12, 'Mazda6 MPS GG 2005-2007, Mazda3 MPS BK/BL 2006-2013 (turbo, AWD on Mazda6 MPS). High-output DISI turbo — flag for premium fuel and more frequent oil (7,500km recommended).'),
  ('MAZ_FS_18_LEGACY', 'Mazda FS 1.8L (older Capella/Familia)', 'Mazda', 1.8, 4, 'petrol', 'belt', 100000, NULL, '10W-40 semi-synthetic API SL', 3.8, 'Mazda FL22 (yellow)', 'economy', 10000, 12, 'Capella/626 GF/GW 1.8 FS, Familia BG 1.8. Belt 100,000km — older JDM import, budget-tier oil.'),
  ('MAZ_KL_30_V6', 'Mazda KL 3.0L V6', 'Mazda', 3.0, 6, 'petrol', 'belt', 100000, NULL, '5W-30 API SL', 5.0, 'Mazda FL22 (yellow)', 'mid', 10000, 12, 'MPV LW 3.0 V6, Millenia/Xedos 9 TA 2.3/2.5 (related KJ V6 — see notes if 2.3/2.5 encountered), Capella Wagon GW V6. Belt — rear bank access adds labour.'),
  ('MAZ_WL_25_TURBODIESEL', 'Mazda WL 2.5L Turbo Diesel', 'Mazda', 2.5, 4, 'diesel', 'belt', 150000, 10, '15W-40 ACEA E5', 6.5, 'Mazda FL22 (yellow)', 'mid', 10000, 12, 'Bounty/B-series UN 2.5 TD 1999-2006 (pre-Ford-shared BT-50), Bongo SK2#. Belt 150,000km. Mechanical/early common-rail injection depending on year.'),
  ('MAZ_CX5_KF_20_SKYACTIVG_MHEV', 'Mazda SkyActiv-G 2.0L M-Hybrid (PE-VPSM)', 'Mazda', 2.0, 4, 'hybrid_petrol', 'chain', NULL, NULL, '0W-20 Mazda Original', 4.3, 'Mazda FL22 (yellow)', 'mid', 10000, 12, 'Mazda3 BP 2.0 M-Hybrid 2019+, CX-30 2.0 M-Hybrid, CX-5 KF facelift 2.0 M-Hybrid. 24V mild-hybrid belt-integrated starter-generator (separate from the main timing chain — do not confuse with a serviceable cambelt). Chain.'),
  ('MAZ_CX60_33_INLINE6_DIESEL', 'Mazda e-SkyActiv D 3.3L Inline-6 Diesel', 'Mazda', 3.3, 6, 'diesel', 'chain', NULL, NULL, '0W-20 Mazda Original DL-1', 7.5, 'Mazda FL22 (yellow)', 'luxury', 10000, 12, 'CX-60/CX-80/CX-90 3.3 inline-6 diesel 2022+ (48V mild-hybrid). Longitudinal RWD-based platform — new to the NZ market, limited independent workshop data yet. Chain.'),
  ('MAZ_CX90_34_TURBO_INLINE6', 'Mazda e-SkyActiv G 3.3L Turbo Inline-6', 'Mazda', 3.3, 6, 'petrol', 'chain', NULL, NULL, '0W-20 Mazda Original SP', 6.5, 'Mazda FL22 (yellow)', 'luxury', 10000, 12, 'CX-90 3.3 Turbo petrol 2023+, CX-60 3.3 Turbo (some markets). 48V mild-hybrid. Chain.'),
  ('MAZ_PEHEV_25_CX60', 'Mazda PHEV 2.5L (CX-60 e-SkyActiv PHEV)', 'Mazda', 2.5, 4, 'phev', 'chain', NULL, NULL, '0W-20 Mazda Original SP', 4.6, 'Mazda FL22 (yellow)', 'luxury', 10000, 12, 'CX-60 PHEV 2022+. 17.8kWh HV pack + 2.5 SkyActiv-G engine. Chain. Separate inverter coolant loop — flag if HV system fault codes present (specialist diagnosis).'),
  ('MAZ_MX30_BEV', 'Mazda MX-30 BEV', 'Mazda', 0.0, 0, 'bev', 'none', NULL, NULL, 'N/A (no engine oil)', NULL, 'Mazda FL22 (yellow)', 'bev', 20000, 12, 'MX-30 EV 2020+, 35.5kWh pack. No traditional cambelt/oil service — brake fluid, cabin filter, coolant loop (battery+motor) checks only.'),
  ('MAZ_RF_16_SKYACTIVG_MX5', 'Mazda SkyActiv-G 1.5L (MX-5 ND, P5-VPR)', 'Mazda', 1.5, 4, 'petrol', 'chain', NULL, NULL, '0W-20 Mazda Original', 4.0, 'Mazda FL22 (yellow)', 'premium', 10000, 12, 'MX-5 ND 1.5 2015+ (NA-tune, distinct calibration from Mazda2/CX-3 1.5). Chain.')
ON CONFLICT (family_id) DO NOTHING;

-- ── engine_family_fluids ─────────────────────────────────────────────────────

INSERT INTO public.engine_family_fluids (engine_family_id, oil_fluid_id, coolant_fluid_id, trans_fluid_id, brake_fluid_id) VALUES
  ('FORD_SIGMA_13_14', 'OIL_5W30_C3', 'COOLANT_OAT_RED', 'TRANS_MANUAL_GEAR', 'BRAKE_DOT4'),
  ('FORD_DURATEC_16_SIGMA', 'OIL_5W30_C3', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('FORD_ZETEC_18_ZETEC_E', 'OIL_5W30_C3', 'COOLANT_OAT_RED', 'TRANS_MANUAL_GEAR', 'BRAKE_DOT4'),
  ('FORD_ZETEC_20_ZETEC_E', 'OIL_5W30_C3', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('FORD_DURATEC_20_MZR', 'OIL_5W30_C3', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('FORD_DURATEC_23_MZR', 'OIL_5W30_C3', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('FORD_ECOBOOST_10_3CYL', 'OIL_5W30_C3', 'COOLANT_OAT_RED', 'TRANS_DSG_DCT', 'BRAKE_DOT4'),
  ('FORD_ECOBOOST_15_4CYL', 'OIL_5W30_C3', 'COOLANT_OAT_RED', 'TRANS_DSG_DCT', 'BRAKE_DOT4'),
  ('FORD_ECOBOOST_16_TURBO', 'OIL_5W30_C3', 'COOLANT_OAT_RED', 'TRANS_MANUAL_GEAR', 'BRAKE_DOT4'),
  ('FORD_ECOBOOST_20_4CYL', 'OIL_5W30_C3', 'COOLANT_OAT_RED', 'TRANS_DSG_DCT', 'BRAKE_DOT4'),
  ('FORD_ECOBOOST_23_4CYL', 'OIL_5W30_C3', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('FORD_DURATORQ_TDCI_16', 'OIL_5W30_DIESEL_LIGHT', 'COOLANT_OAT_RED', 'TRANS_MANUAL_GEAR', 'BRAKE_DOT4'),
  ('FORD_DURATORQ_TDCI_18', 'OIL_5W30_DIESEL_LIGHT', 'COOLANT_OAT_RED', 'TRANS_MANUAL_GEAR', 'BRAKE_DOT4'),
  ('FORD_DURATORQ_TDCI_20', 'OIL_5W30_DIESEL_LIGHT', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('FORD_DURATORQ_TDCI_24_TRANSIT', 'OIL_5W30_DIESEL_LIGHT', 'COOLANT_OAT_RED', 'TRANS_MANUAL_GEAR', 'BRAKE_DOT4'),
  ('FORD_ECOBLUE_15_DIESEL', 'OIL_5W30_DIESEL_LIGHT', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('FORD_ECOBLUE_20_DIESEL', 'OIL_5W30_DIESEL_LIGHT', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('FORD_MONDEO_25_DURATEC_V6', 'OIL_5W30_C3', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('FORD_KUGA_25_DURATEC', 'OIL_5W30_C3', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('FORD_ESCORT_ZETEC_16', 'OIL_10W40_SEMI', 'COOLANT_OAT_RED', 'TRANS_MANUAL_GEAR', 'BRAKE_DOT4'),
  ('MAZ_MZR_16_BK', 'OIL_5W30_C3', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('MAZ_MZR_20_LF', 'OIL_5W30_C3', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('MAZ_MZR_23_L3', 'OIL_5W30_C3', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('MAZ_MZRCD_20_DIESEL', 'OIL_5W30_DIESEL_LIGHT', 'COOLANT_OAT_RED', 'TRANS_MANUAL_GEAR', 'BRAKE_DOT4'),
  ('MAZ_MZRCD_22_DIESEL', 'OIL_5W30_DIESEL_LIGHT', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('MAZ_SKYACTIVG_25T', 'OIL_0W20_SP', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('MAZ_SKYACTIVX_20', 'OIL_0W20_SP', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('MAZ_SKYACTIVD_18', 'OIL_5W30_DIESEL_LIGHT', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('MAZ_BT50_TF_30_DIESEL', 'OIL_5W30_DIESEL_LIGHT', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('MAZ_MAZDA6_GG_L_23_MPS', 'OIL_5W40_A3B4', 'COOLANT_OAT_RED', 'TRANS_MANUAL_GEAR', 'BRAKE_DOT4'),
  ('MAZ_FS_18_LEGACY', 'OIL_10W40_SEMI', 'COOLANT_OAT_RED', 'TRANS_MANUAL_GEAR', 'BRAKE_DOT4'),
  ('MAZ_KL_30_V6', 'OIL_5W30_C3', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('MAZ_WL_25_TURBODIESEL', 'OIL_15W40_DIESEL', 'COOLANT_OAT_RED', 'TRANS_MANUAL_GEAR', 'BRAKE_DOT4'),
  ('MAZ_CX5_KF_20_SKYACTIVG_MHEV', 'OIL_0W20_SP', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('MAZ_CX60_33_INLINE6_DIESEL', 'OIL_5W30_DIESEL_LIGHT', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('MAZ_CX90_34_TURBO_INLINE6', 'OIL_0W20_SP', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('MAZ_PEHEV_25_CX60', 'OIL_0W20_SP', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('MAZ_MX30_BEV', NULL, 'COOLANT_OAT_RED', NULL, 'BRAKE_DOT4'),
  ('MAZ_RF_16_SKYACTIVG_MX5', 'OIL_0W20_SP', 'COOLANT_OAT_RED', 'TRANS_MANUAL_GEAR', 'BRAKE_DOT4')
ON CONFLICT (engine_family_id) DO NOTHING;

-- ── service_schedule ─────────────────────────────────────────────────────────

INSERT INTO public.service_schedule (
  engine_family_id, coolant_capacity_l, trans_capacity_l,
  oil_interval_km, oil_interval_months,
  coolant_interval_km, coolant_interval_months,
  brake_fluid_interval_months, trans_interval_km,
  aircon_refrigerant, confidence, notes
) VALUES
  ('FORD_SIGMA_13_14', 4.5, 2.0, 10000, 12, 100000, 60, 24, NULL, 'R134a', 2, NULL),
  ('FORD_DURATEC_16_SIGMA', 5.0, 4.0, 10000, 12, 100000, 60, 24, 60000, 'R134a', 2, NULL),
  ('FORD_ZETEC_18_ZETEC_E', 5.5, 2.0, 10000, 12, 80000, 48, 24, NULL, 'R134a', 2, NULL),
  ('FORD_ZETEC_20_ZETEC_E', 6.0, 4.0, 10000, 12, 80000, 48, 24, 60000, 'R134a', 2, NULL),
  ('FORD_DURATEC_20_MZR', 6.0, 4.0, 10000, 12, 160000, 100, 24, 60000, 'R134a', 2, NULL),
  ('FORD_DURATEC_23_MZR', 6.2, 4.0, 10000, 12, 160000, 100, 24, 60000, 'R134a', 2, NULL),
  ('FORD_ECOBOOST_10_3CYL', 4.2, 6.0, 10000, 12, 150000, 120, 24, 60000, 'R1234yf', 2, NULL),
  ('FORD_ECOBOOST_15_4CYL', 5.0, 6.5, 10000, 12, 160000, 120, 24, 60000, 'R1234yf', 2, NULL),
  ('FORD_ECOBOOST_16_TURBO', 5.2, 2.0, 10000, 12, 160000, 120, 24, NULL, 'R134a', 2, NULL),
  ('FORD_ECOBOOST_20_4CYL', 6.0, 7.0, 10000, 12, 160000, 120, 24, 60000, 'R1234yf', 2, NULL),
  ('FORD_ECOBOOST_23_4CYL', 6.5, 5.0, 10000, 12, 160000, 120, 24, 60000, 'R1234yf', 2, NULL),
  ('FORD_DURATORQ_TDCI_16', 5.5, 2.0, 10000, 12, 150000, 100, 24, NULL, 'R134a', 2, NULL),
  ('FORD_DURATORQ_TDCI_18', 6.0, 2.0, 10000, 12, 150000, 100, 24, NULL, 'R134a', 2, NULL),
  ('FORD_DURATORQ_TDCI_20', 6.5, 5.0, 10000, 12, 150000, 100, 24, 60000, 'R134a', 2, NULL),
  ('FORD_DURATORQ_TDCI_24_TRANSIT', 8.0, 2.0, 10000, 12, 150000, 100, 24, NULL, 'R134a', 2, NULL),
  ('FORD_ECOBLUE_15_DIESEL', 5.5, 5.0, 10000, 12, 180000, 120, 24, 60000, 'R1234yf', 2, NULL),
  ('FORD_ECOBLUE_20_DIESEL', 6.5, 6.0, 15000, 12, 180000, 120, 24, 60000, 'R1234yf', 2, NULL),
  ('FORD_MONDEO_25_DURATEC_V6', 7.0, 5.0, 10000, 12, 100000, 60, 24, 60000, 'R134a', 2, NULL),
  ('FORD_KUGA_25_DURATEC', 6.0, 4.0, 10000, 12, 160000, 100, 24, 60000, 'R134a', 2, NULL),
  ('FORD_ESCORT_ZETEC_16', 5.0, 2.0, 7500, 6, 50000, 36, 24, NULL, 'R134a', 2, NULL),
  ('MAZ_MZR_16_BK', 5.0, 4.0, 10000, 12, 100000, 60, 24, 60000, 'R134a', 2, NULL),
  ('MAZ_MZR_20_LF', 6.0, 4.0, 10000, 12, 100000, 60, 24, 60000, 'R134a', 2, NULL),
  ('MAZ_MZR_23_L3', 6.3, 4.0, 10000, 12, 100000, 60, 24, 60000, 'R134a', 2, NULL),
  ('MAZ_MZRCD_20_DIESEL', 6.5, 2.0, 10000, 12, 100000, 60, 24, NULL, 'R134a', 2, NULL),
  ('MAZ_MZRCD_22_DIESEL', 7.0, 4.0, 10000, 12, 150000, 100, 24, 60000, 'R134a', 2, NULL),
  ('MAZ_SKYACTIVG_25T', 6.5, 4.0, 10000, 12, 200000, 120, 24, 60000, 'R1234yf', 2, NULL),
  ('MAZ_SKYACTIVX_20', 6.0, 4.0, 10000, 12, 200000, 120, 24, 60000, 'R1234yf', 2, NULL),
  ('MAZ_SKYACTIVD_18', 5.5, 4.0, 10000, 12, 200000, 120, 24, 60000, 'R1234yf', 2, NULL),
  ('MAZ_BT50_TF_30_DIESEL', 8.5, 5.0, 10000, 12, 160000, 100, 24, 60000, 'R1234yf', 2, NULL),
  ('MAZ_MAZDA6_GG_L_23_MPS', 6.5, 2.0, 7500, 6, 100000, 60, 24, NULL, 'R134a', 2, NULL),
  ('MAZ_FS_18_LEGACY', 4.5, 2.0, 7500, 6, 50000, 36, 24, NULL, 'R134a', 2, NULL),
  ('MAZ_KL_30_V6', 6.5, 4.0, 10000, 12, 80000, 48, 24, 60000, 'R134a', 2, NULL),
  ('MAZ_WL_25_TURBODIESEL', 8.0, 2.0, 7500, 6, 60000, 36, 24, NULL, 'R134a', 2, NULL),
  ('MAZ_CX5_KF_20_SKYACTIVG_MHEV', 6.0, 4.0, 10000, 12, 200000, 120, 24, 60000, 'R1234yf', 2, NULL),
  ('MAZ_CX60_33_INLINE6_DIESEL', 9.0, 6.0, 10000, 12, 200000, 120, 24, 80000, 'R1234yf', 2, NULL),
  ('MAZ_CX90_34_TURBO_INLINE6', 8.5, 6.0, 10000, 12, 200000, 120, 24, 80000, 'R1234yf', 2, NULL),
  ('MAZ_PEHEV_25_CX60', 6.0, 4.0, 10000, 12, 200000, 120, 24, 60000, 'R1234yf', 2, NULL),
  ('MAZ_MX30_BEV', 8.0, NULL, 0, 0, 160000, 120, 24, NULL, 'R1234yf', 2, NULL),
  ('MAZ_RF_16_SKYACTIVG_MX5', 5.0, 2.0, 10000, 12, 200000, 120, 24, NULL, 'R1234yf', 2, NULL)
ON CONFLICT (engine_family_id) DO NOTHING;

-- ── Cambelt full replacement (belt families) → 'cambelt_full' ───────────────

INSERT INTO ef_parts_data (engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
SELECT v.* FROM (VALUES
  ('FORD_SIGMA_13_14', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 700, 870, 3.0, 4.5, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump; NZ GST-incl'),
  ('FORD_DURATEC_16_SIGMA', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 700, 870, 3.0, 4.5, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump; NZ GST-incl'),
  ('FORD_ZETEC_18_ZETEC_E', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 700, 870, 3.0, 4.5, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump; NZ GST-incl'),
  ('FORD_ZETEC_20_ZETEC_E', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 880, 1090, 3.8, 5.6, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump; NZ GST-incl'),
  ('FORD_ECOBOOST_10_3CYL', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 630, 780, 3.0, 4.5, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump; NZ GST-incl'),
  ('FORD_DURATORQ_TDCI_16', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 800, 1000, 3.0, 4.5, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump; NZ GST-incl'),
  ('FORD_DURATORQ_TDCI_18', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 800, 1000, 3.0, 4.5, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump; NZ GST-incl'),
  ('FORD_DURATORQ_TDCI_20', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 1010, 1250, 3.8, 5.6, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump; NZ GST-incl'),
  ('FORD_DURATORQ_TDCI_24_TRANSIT', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 1010, 1250, 3.8, 5.6, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump; NZ GST-incl'),
  ('FORD_ECOBLUE_15_DIESEL', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 800, 1000, 3.0, 4.5, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump; NZ GST-incl'),
  ('FORD_ECOBLUE_20_DIESEL', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 1010, 1250, 3.8, 5.6, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump; NZ GST-incl'),
  ('FORD_MONDEO_25_DURATEC_V6', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 1520, 1890, 4.7, 7.0, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump; NZ GST-incl'),
  ('FORD_ESCORT_ZETEC_16', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 700, 870, 3.0, 4.5, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump; NZ GST-incl'),
  ('MAZ_MZRCD_20_DIESEL', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 1010, 1250, 3.8, 5.6, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump; NZ GST-incl'),
  ('MAZ_FS_18_LEGACY', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 700, 870, 3.0, 4.5, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump; NZ GST-incl'),
  ('MAZ_KL_30_V6', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 1220, 1520, 3.8, 5.6, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump; NZ GST-incl'),
  ('MAZ_WL_25_TURBODIESEL', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 1010, 1250, 3.8, 5.6, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump; NZ GST-incl')
) AS v(engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
ON CONFLICT (engine_family_id, category_id) DO NOTHING;

-- ── Full timing chain replacement (chain families) → 'timing_chain_replacement' ──

INSERT INTO ef_parts_data (engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
SELECT v.* FROM (VALUES
  ('FORD_DURATEC_20_MZR', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 2000, 2480, 7.5, 11.2, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+sprockets+cam/crank seals+timing cover gasket+accessory belt; mid; NZ GST-incl'),
  ('FORD_DURATEC_23_MZR', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 2000, 2480, 7.5, 11.2, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+sprockets+cam/crank seals+timing cover gasket+accessory belt; mid; NZ GST-incl'),
  ('FORD_ECOBOOST_15_4CYL', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 2000, 2480, 7.5, 11.2, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+sprockets+cam/crank seals+timing cover gasket+accessory belt; mid; NZ GST-incl'),
  ('FORD_ECOBOOST_16_TURBO', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 2000, 2480, 7.5, 11.2, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+sprockets+cam/crank seals+timing cover gasket+accessory belt; mid; NZ GST-incl'),
  ('FORD_ECOBOOST_20_4CYL', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 2000, 2480, 7.5, 11.2, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+sprockets+cam/crank seals+timing cover gasket+accessory belt; mid; NZ GST-incl'),
  ('FORD_ECOBOOST_23_4CYL', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 2480, 3070, 9.3, 14.0, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+sprockets+cam/crank seals+timing cover gasket+accessory belt; premium; NZ GST-incl'),
  ('FORD_KUGA_25_DURATEC', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 2000, 2480, 7.5, 11.2, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+sprockets+cam/crank seals+timing cover gasket+accessory belt; mid; NZ GST-incl'),
  ('MAZ_MZR_16_BK', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 1600, 1980, 6.0, 9.0, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+sprockets+cam/crank seals+timing cover gasket+accessory belt; economy; NZ GST-incl'),
  ('MAZ_MZR_20_LF', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 2000, 2480, 7.5, 11.2, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+sprockets+cam/crank seals+timing cover gasket+accessory belt; mid; NZ GST-incl'),
  ('MAZ_MZR_23_L3', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 2000, 2480, 7.5, 11.2, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+sprockets+cam/crank seals+timing cover gasket+accessory belt; mid; NZ GST-incl'),
  ('MAZ_MZRCD_22_DIESEL', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 2300, 2850, 7.5, 11.2, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+sprockets+cam/crank seals+timing cover gasket+accessory belt; mid; NZ GST-incl'),
  ('MAZ_SKYACTIVG_25T', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 2480, 3070, 9.3, 14.0, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+sprockets+cam/crank seals+timing cover gasket+accessory belt; premium; NZ GST-incl'),
  ('MAZ_SKYACTIVX_20', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 2480, 3070, 9.3, 14.0, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+sprockets+cam/crank seals+timing cover gasket+accessory belt; premium; NZ GST-incl'),
  ('MAZ_SKYACTIVD_18', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 2300, 2850, 7.5, 11.2, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+sprockets+cam/crank seals+timing cover gasket+accessory belt; mid; NZ GST-incl'),
  ('MAZ_BT50_TF_30_DIESEL', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 2300, 2850, 7.5, 11.2, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+sprockets+cam/crank seals+timing cover gasket+accessory belt; mid; NZ GST-incl'),
  ('MAZ_MAZDA6_GG_L_23_MPS', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 2480, 3070, 9.3, 14.0, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+sprockets+cam/crank seals+timing cover gasket+accessory belt; premium; NZ GST-incl'),
  ('MAZ_CX5_KF_20_SKYACTIVG_MHEV', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 2000, 2480, 7.5, 11.2, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+sprockets+cam/crank seals+timing cover gasket+accessory belt; mid; NZ GST-incl'),
  ('MAZ_CX60_33_INLINE6_DIESEL', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 4890, 6060, 11.4, 17.1, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+sprockets+cam/crank seals+timing cover gasket+accessory belt; luxury; NZ GST-incl'),
  ('MAZ_CX90_34_TURBO_INLINE6', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 4260, 5270, 11.4, 17.1, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+sprockets+cam/crank seals+timing cover gasket+accessory belt; luxury; NZ GST-incl'),
  ('MAZ_PEHEV_25_CX60', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 3040, 3760, 11.4, 17.1, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+sprockets+cam/crank seals+timing cover gasket+accessory belt; luxury; NZ GST-incl'),
  ('MAZ_RF_16_SKYACTIVG_MX5', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 2480, 3070, 9.3, 14.0, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+sprockets+cam/crank seals+timing cover gasket+accessory belt; premium; NZ GST-incl')
) AS v(engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
ON CONFLICT (engine_family_id, category_id) DO NOTHING;

-- ── Spark plugs → 'spark_plugs' ──────────────────────────────────────────────

INSERT INTO ef_parts_data (engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
SELECT v.* FROM (VALUES
  ('FORD_SIGMA_13_14', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 240, 300, 0.5, 1.0, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('FORD_DURATEC_16_SIGMA', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 240, 300, 0.5, 1.0, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('FORD_ZETEC_18_ZETEC_E', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 240, 300, 0.5, 1.0, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('FORD_ZETEC_20_ZETEC_E', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 300, 380, 0.5, 1.0, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('FORD_DURATEC_20_MZR', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 300, 380, 0.5, 1.0, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('FORD_DURATEC_23_MZR', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 300, 380, 0.5, 1.0, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('FORD_ECOBOOST_10_3CYL', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 220, 270, 0.5, 1.0, 'moat_nz_gst_incl', 2, '3x Iridium; set NZ GST-incl'),
  ('FORD_ECOBOOST_15_4CYL', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 300, 380, 0.5, 1.0, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('FORD_ECOBOOST_16_TURBO', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 300, 380, 0.5, 1.0, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('FORD_ECOBOOST_20_4CYL', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 300, 380, 0.5, 1.0, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('FORD_ECOBOOST_23_4CYL', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 370, 460, 0.5, 1.0, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('FORD_MONDEO_25_DURATEC_V6', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 520, 650, 1.5, 2.5, 'moat_nz_gst_incl', 2, '6x Iridium; set NZ GST-incl'),
  ('FORD_KUGA_25_DURATEC', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 300, 380, 0.5, 1.0, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('FORD_ESCORT_ZETEC_16', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 240, 300, 0.5, 1.0, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('MAZ_MZR_16_BK', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 240, 300, 0.5, 1.0, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('MAZ_MZR_20_LF', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 300, 380, 0.5, 1.0, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('MAZ_MZR_23_L3', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 300, 380, 0.5, 1.0, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('MAZ_SKYACTIVG_25T', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 370, 460, 0.5, 1.0, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('MAZ_SKYACTIVX_20', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 370, 460, 0.5, 1.0, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('MAZ_MAZDA6_GG_L_23_MPS', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 370, 460, 0.5, 1.0, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('MAZ_FS_18_LEGACY', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 240, 300, 0.5, 1.0, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('MAZ_KL_30_V6', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 420, 520, 1.5, 2.5, 'moat_nz_gst_incl', 2, '6x Iridium; set NZ GST-incl'),
  ('MAZ_CX5_KF_20_SKYACTIVG_MHEV', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 300, 380, 0.5, 1.0, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('MAZ_CX90_34_TURBO_INLINE6', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 640, 800, 1.5, 2.5, 'moat_nz_gst_incl', 2, '6x Iridium; set NZ GST-incl'),
  ('MAZ_PEHEV_25_CX60', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 460, 570, 0.5, 1.0, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('MAZ_RF_16_SKYACTIVG_MX5', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 370, 460, 0.5, 1.0, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl')
) AS v(engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
ON CONFLICT (engine_family_id, category_id) DO NOTHING;

-- ── Transmission service → 'transmission_service' ───────────────────────────

INSERT INTO ef_parts_data (engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
SELECT v.* FROM (VALUES
  ('FORD_SIGMA_13_14', (SELECT id FROM part_categories WHERE slug='transmission_service'), 250, 370, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; economy; NZ GST-incl'),
  ('FORD_DURATEC_16_SIGMA', (SELECT id FROM part_categories WHERE slug='transmission_service'), 250, 370, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; economy; NZ GST-incl'),
  ('FORD_ZETEC_18_ZETEC_E', (SELECT id FROM part_categories WHERE slug='transmission_service'), 250, 370, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; economy; NZ GST-incl'),
  ('FORD_ZETEC_20_ZETEC_E', (SELECT id FROM part_categories WHERE slug='transmission_service'), 310, 460, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; mid; NZ GST-incl'),
  ('FORD_DURATEC_20_MZR', (SELECT id FROM part_categories WHERE slug='transmission_service'), 310, 460, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; mid; NZ GST-incl'),
  ('FORD_DURATEC_23_MZR', (SELECT id FROM part_categories WHERE slug='transmission_service'), 310, 460, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; mid; NZ GST-incl'),
  ('FORD_ECOBOOST_10_3CYL', (SELECT id FROM part_categories WHERE slug='transmission_service'), 250, 370, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; economy; NZ GST-incl'),
  ('FORD_ECOBOOST_15_4CYL', (SELECT id FROM part_categories WHERE slug='transmission_service'), 310, 460, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; mid; NZ GST-incl'),
  ('FORD_ECOBOOST_16_TURBO', (SELECT id FROM part_categories WHERE slug='transmission_service'), 310, 460, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; mid; NZ GST-incl'),
  ('FORD_ECOBOOST_20_4CYL', (SELECT id FROM part_categories WHERE slug='transmission_service'), 310, 460, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; mid; NZ GST-incl'),
  ('FORD_ECOBOOST_23_4CYL', (SELECT id FROM part_categories WHERE slug='transmission_service'), 390, 570, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; premium; NZ GST-incl'),
  ('FORD_DURATORQ_TDCI_16', (SELECT id FROM part_categories WHERE slug='transmission_service'), 250, 370, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; economy; NZ GST-incl'),
  ('FORD_DURATORQ_TDCI_18', (SELECT id FROM part_categories WHERE slug='transmission_service'), 250, 370, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; economy; NZ GST-incl'),
  ('FORD_DURATORQ_TDCI_20', (SELECT id FROM part_categories WHERE slug='transmission_service'), 310, 460, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; mid; NZ GST-incl'),
  ('FORD_DURATORQ_TDCI_24_TRANSIT', (SELECT id FROM part_categories WHERE slug='transmission_service'), 310, 460, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; mid; NZ GST-incl'),
  ('FORD_ECOBLUE_15_DIESEL', (SELECT id FROM part_categories WHERE slug='transmission_service'), 250, 370, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; economy; NZ GST-incl'),
  ('FORD_ECOBLUE_20_DIESEL', (SELECT id FROM part_categories WHERE slug='transmission_service'), 310, 460, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; mid; NZ GST-incl'),
  ('FORD_MONDEO_25_DURATEC_V6', (SELECT id FROM part_categories WHERE slug='transmission_service'), 390, 570, 1.0, 1.6, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; premium; NZ GST-incl'),
  ('FORD_KUGA_25_DURATEC', (SELECT id FROM part_categories WHERE slug='transmission_service'), 310, 460, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; mid; NZ GST-incl'),
  ('FORD_ESCORT_ZETEC_16', (SELECT id FROM part_categories WHERE slug='transmission_service'), 250, 370, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; economy; NZ GST-incl'),
  ('MAZ_MZR_16_BK', (SELECT id FROM part_categories WHERE slug='transmission_service'), 250, 370, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; economy; NZ GST-incl'),
  ('MAZ_MZR_20_LF', (SELECT id FROM part_categories WHERE slug='transmission_service'), 310, 460, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; mid; NZ GST-incl'),
  ('MAZ_MZR_23_L3', (SELECT id FROM part_categories WHERE slug='transmission_service'), 310, 460, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; mid; NZ GST-incl'),
  ('MAZ_MZRCD_20_DIESEL', (SELECT id FROM part_categories WHERE slug='transmission_service'), 310, 460, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; mid; NZ GST-incl'),
  ('MAZ_MZRCD_22_DIESEL', (SELECT id FROM part_categories WHERE slug='transmission_service'), 310, 460, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; mid; NZ GST-incl'),
  ('MAZ_SKYACTIVG_25T', (SELECT id FROM part_categories WHERE slug='transmission_service'), 390, 570, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; premium; NZ GST-incl'),
  ('MAZ_SKYACTIVX_20', (SELECT id FROM part_categories WHERE slug='transmission_service'), 390, 570, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; premium; NZ GST-incl'),
  ('MAZ_SKYACTIVD_18', (SELECT id FROM part_categories WHERE slug='transmission_service'), 310, 460, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; mid; NZ GST-incl'),
  ('MAZ_BT50_TF_30_DIESEL', (SELECT id FROM part_categories WHERE slug='transmission_service'), 310, 460, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; mid; NZ GST-incl'),
  ('MAZ_MAZDA6_GG_L_23_MPS', (SELECT id FROM part_categories WHERE slug='transmission_service'), 390, 570, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; premium; NZ GST-incl'),
  ('MAZ_FS_18_LEGACY', (SELECT id FROM part_categories WHERE slug='transmission_service'), 250, 370, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; economy; NZ GST-incl'),
  ('MAZ_KL_30_V6', (SELECT id FROM part_categories WHERE slug='transmission_service'), 310, 460, 1.0, 1.6, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; mid; NZ GST-incl'),
  ('MAZ_WL_25_TURBODIESEL', (SELECT id FROM part_categories WHERE slug='transmission_service'), 310, 460, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; mid; NZ GST-incl'),
  ('MAZ_CX5_KF_20_SKYACTIVG_MHEV', (SELECT id FROM part_categories WHERE slug='transmission_service'), 310, 460, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; mid; NZ GST-incl'),
  ('MAZ_CX60_33_INLINE6_DIESEL', (SELECT id FROM part_categories WHERE slug='transmission_service'), 480, 700, 1.0, 1.6, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; luxury; NZ GST-incl'),
  ('MAZ_CX90_34_TURBO_INLINE6', (SELECT id FROM part_categories WHERE slug='transmission_service'), 480, 700, 1.0, 1.6, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; luxury; NZ GST-incl'),
  ('MAZ_PEHEV_25_CX60', (SELECT id FROM part_categories WHERE slug='transmission_service'), 480, 700, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; luxury; NZ GST-incl'),
  ('MAZ_RF_16_SKYACTIVG_MX5', (SELECT id FROM part_categories WHERE slug='transmission_service'), 390, 570, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'ATF/CVT drain+fill; premium; NZ GST-incl')
) AS v(engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
ON CONFLICT (engine_family_id, category_id) DO NOTHING;
