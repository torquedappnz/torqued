SET search_path TO public;

-- ============================================================
-- TORQUED — Migration 061: VAG + Toyota engine-family expansion
-- Fills the coverage gaps against the target family list:
--   VW/Audi/Skoda: 1.2 TSI (EA111 chain + EA211 belt), 1.5 TSI evo,
--   Golf 8/8.5 1.4 TSI torque-converter variant, 1.6 MPI, 1.6 TDI,
--   1.8 TSI EA888, EA288 2.0 TDI, 2.5 TDI R5 (T5), VR6 3.2/3.6,
--   4.2 V8 petrol + diesel. Toyota: M20A-FKS 2.0 + M20A-FXS 2.0 Hybrid.
-- Also backfills engine_family_fluids + service_schedule for 15
-- existing families that had none (Holden V6/V8, Lexus V8s, Honda F,
-- Pajero V6, i-MiEV, Subaru diesel, Suzuki BoosterJet, Ranger 2.2, etc).
-- Methodology matches migrations 037/042/043/051/052/053.
-- Applied directly to production 2026-07-21 (data-only inserts).
-- ============================================================

INSERT INTO public.engine_families (
  family_id, common_name, manufacturer, displacement_l, cylinders,
  fuel, timing_type, cambelt_interval_km, cambelt_interval_years,
  oil_spec, oil_capacity_l, coolant_spec, segment_tier,
  service_interval_km, service_interval_months, notes
) VALUES
  ('VW_EA111_12_TSI', 'VW EA111 1.2 TSI 8v (CBZ)', 'Volkswagen', 1.2, 4, 'petrol', 'chain', NULL, NULL, '5W-30 VW 504 00/507 00', 3.9, 'VW G13 (purple Si-OAT)', 'economy', 15000, 12, 'Polo 6R 1.2 TSI 2010-14, Golf 6 1.2 TSI, Skoda Fabia/Yeti 1.2 TSI. Chain — early CBZ chains stretch, listen for cold-start rattle. DQ200 7sp dry-clutch DSG or MQ200 5MT.'),
  ('VW_EA211_12_TSI', 'VW EA211 1.2 TSI (CJZ)', 'Volkswagen', 1.2, 4, 'petrol', 'belt', 180000, 10, '5W-30 VW 504 00/507 00', 4, 'VW G13 (purple Si-OAT)', 'economy', 15000, 12, 'Golf 7 1.2 TSI, Polo 6C 1.2 TSI, Octavia III 1.2 TSI, Fabia. Belt (VW quotes inspect-only; NZ workshop consensus 180,000km/10yr). DQ200 dry DSG or MQ200 manual.'),
  ('VW_EA211_15_TSI_EVO', 'VW EA211 evo 1.5 TSI', 'Volkswagen', 1.5, 4, 'petrol', 'belt', 180000, 10, '0W-20 VW 508 00/509 00', 4.5, 'VW G13 (purple Si-OAT)', 'mid', 15000, 12, 'Golf 7.5/8 1.5 TSI evo, T-Roc/T-Cross 1.5, Tiguan 1.5, Skoda Octavia/Karoq 1.5 TSI. ACT cylinder deactivation. Belt. DQ200 7sp dry-clutch DSG on FWD models — 2L DSG fluid + 1L final-drive gear oil.'),
  ('VW_EA211_14_TSI_TC', 'VW EA211 1.4 TSI + Aisin torque converter (Golf 8/8.5 NZ)', 'Volkswagen', 1.4, 4, 'petrol', 'belt', 180000, 10, '0W-20 VW 508 00', 4, 'VW G13 (purple Si-OAT)', 'mid', 15000, 12, 'Golf 8/8.5 1.4 TSI NZ-new with AQ250/AQ300 8-speed torque-converter automatic — NOT a DSG, conventional ATF service. Same base engine as VW_EA211_14_TSI; split so transmission fluid/pricing is correct.'),
  ('VW_EA111_16_MPI', 'VW EA111 1.6 MPI 8v (BSE/BGU)', 'Volkswagen', 1.6, 4, 'petrol', 'belt', 120000, 8, '5W-40 ACEA A3/B4 or 5W-30 VW 504 00', 4.5, 'VW G12+/G13', 'economy', 15000, 12, 'Golf 5/6 1.6 MPI, Jetta 1.6, Octavia II 1.6, Touran 1.6. Also covers EA211 1.6 MPI (CWVA — Polo/Skoda Rapid NZ-new). Belt. 6sp Aisin 09G torque-converter auto common.'),
  ('VW_EA189_16_TDI', 'VW 1.6 TDI (EA189 CAYC / EA288 DGD)', 'Volkswagen', 1.6, 4, 'diesel', 'belt', 150000, 10, '5W-30 VW 507 00', 4.3, 'VW G13 (purple Si-OAT)', 'economy', 15000, 12, 'Golf 6/7 1.6 TDI, Polo 1.6 TDI, Octavia 1.6 TDI, Caddy 1.6 TDI. DPF — flag short-trip use. DQ200 dry DSG or 5MT.'),
  ('VW_EA888_18_TSI', 'VW EA888 1.8 TSI', 'Volkswagen', 1.8, 4, 'petrol', 'chain', NULL, NULL, '5W-30/5W-40 VW 502 00/504 00', 5.2, 'VW G13 (purple Si-OAT)', 'mid', 15000, 12, 'Audi A4/A5 B8 1.8 TFSI, Passat/Octavia vRS-adjacent 1.8 TSI. Gen1/2 oil-consumption piston-ring issue — flag high oil use at intake. Multitronic CVT (Audi FWD), DQ250 DSG, or manual.'),
  ('VW_EA288_20_TDI', 'VW EA288 2.0 TDI', 'Volkswagen', 2, 4, 'diesel', 'belt', 150000, 10, '5W-30 VW 507 00', 4.6, 'VW G13 (purple Si-OAT)', 'mid', 15000, 12, 'Golf 7/7.5 2.0 TDI, Passat B8, Tiguan AD 2.0 TDI, Octavia III, Transporter T6 2.0 TDI (T6/4Motion use DQ500 7sp wet DSG). DQ381 wet-clutch DSG most common. DPF+SCR on later cars.'),
  ('VW_25_TDI_I5_T5', 'VW 2.5 TDI R5 (Transporter T5)', 'Volkswagen', 2.5, 5, 'diesel', 'chain', NULL, NULL, '5W-30 VW 505 01/507 00', 7.5, 'VW G12+', 'mid', 15000, 12, 'Transporter T5 2.5 TDI (AXD/AXE) 2003-09, Touareg R5 TDI. Gear-driven cam drive — no cambelt service. Known camshaft/lifter wear on early AXD — listen at idle. 6sp manual or ZF 6HP auto.'),
  ('VW_VR6_32_36', 'VW VR6 3.2/3.6 FSI', 'Volkswagen', 3.6, 6, 'petrol', 'chain', NULL, NULL, '5W-40 VW 502 00', 6, 'VW G12+/G13', 'premium', 15000, 12, 'Golf R32 Mk4/5 3.2, Audi TT/A3 3.2, Passat R36 3.6, Touareg 3.6 FSI. Chains at rear of engine — replacement is gearbox-out, quote accordingly. DQ250 wet DSG on R32/TT/R36.'),
  ('AUDI_42_FSI_V8', 'Audi 4.2 FSI/MPI V8', 'Audi', 4.2, 8, 'petrol', 'chain', NULL, NULL, '5W-40 VW 502 00', 8, 'VW G12+/G13', 'luxury', 15000, 12, 'RS4 B7 4.2 FSI, S5 8T 4.2, Q7 4.2 FSI, S4 B6/B7 4.2 MPI. Timing chains rear-mounted (engine-out to replace). ZF 6HP tiptronic.'),
  ('AUDI_42_TDI_V8', 'Audi 4.2 TDI V8', 'Audi', 4.2, 8, 'diesel', 'chain', NULL, NULL, '5W-30 VW 507 00', 9.5, 'VW G12+/G13', 'luxury', 15000, 12, 'Q7 4.2 TDI, A8 4.2 TDI. Chain. ZF 6HP/8HP tiptronic. DPF.'),
  ('TOY_M20AFKS_20', 'Toyota M20A-FKS 2.0L Dynamic Force', 'Toyota', 2, 4, 'petrol', 'chain', NULL, NULL, '0W-16 API SP', 4.5, 'Toyota SLLC pink', 'mid', 10000, 12, 'Corolla E210 2.0, RAV4 XA50 2.0 GX, C-HR 2.0 (some markets). Direct Shift-CVT with physical launch gear — Toyota CVT FE fluid.'),
  ('TOY_M20AFXS_20_HYBRID', 'Toyota M20A-FXS 2.0L Hybrid', 'Toyota', 2, 4, 'hybrid_petrol', 'chain', NULL, NULL, '0W-16 API SP', 4.5, 'Toyota SLLC pink', 'mid', 10000, 12, 'Corolla Cross Hybrid, C-HR Gen2 2.0 HEV, Corolla E210 2.0 hybrid, related Lexus UX250h. P610 eCVT transaxle — Toyota ATF WS. Separate inverter coolant loop.')
ON CONFLICT (family_id) DO NOTHING;

INSERT INTO public.engine_family_fluids (engine_family_id, oil_fluid_id, coolant_fluid_id, trans_fluid_id, brake_fluid_id) VALUES
  ('VW_EA111_12_TSI', 'OIL_5W30_VW504_507', 'COOLANT_OAT_PURPLE_G13', 'TRANS_DSG_DCT', 'BRAKE_DOT4'),
  ('VW_EA211_12_TSI', 'OIL_5W30_VW504_507', 'COOLANT_OAT_PURPLE_G13', 'TRANS_DSG_DCT', 'BRAKE_DOT4'),
  ('VW_EA211_15_TSI_EVO', 'OIL_0W20_SP', 'COOLANT_OAT_PURPLE_G13', 'TRANS_DSG_DCT', 'BRAKE_DOT4'),
  ('VW_EA211_14_TSI_TC', 'OIL_0W20_SP', 'COOLANT_OAT_PURPLE_G13', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('VW_EA111_16_MPI', 'OIL_5W40_A3B4', 'COOLANT_OAT_PURPLE_G13', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('VW_EA189_16_TDI', 'OIL_5W30_VW504_507', 'COOLANT_OAT_PURPLE_G13', 'TRANS_DSG_DCT', 'BRAKE_DOT4'),
  ('VW_EA888_18_TSI', 'OIL_5W30_VW504_507', 'COOLANT_OAT_PURPLE_G13', 'TRANS_DSG_DCT', 'BRAKE_DOT4'),
  ('VW_EA288_20_TDI', 'OIL_5W30_VW504_507', 'COOLANT_OAT_PURPLE_G13', 'TRANS_DSG_DCT', 'BRAKE_DOT4'),
  ('VW_25_TDI_I5_T5', 'OIL_5W30_DIESEL_LIGHT', 'COOLANT_OAT_PURPLE_G13', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('VW_VR6_32_36', 'OIL_5W40_A3B4', 'COOLANT_OAT_PURPLE_G13', 'TRANS_DSG_DCT', 'BRAKE_DOT4'),
  ('AUDI_42_FSI_V8', 'OIL_5W40_A3B4', 'COOLANT_OAT_PURPLE_G13', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('AUDI_42_TDI_V8', 'OIL_5W30_VW504_507', 'COOLANT_OAT_PURPLE_G13', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('TOY_M20AFKS_20', 'OIL_0W16_SP', 'COOLANT_OAT_RED', 'TRANS_CVT', 'BRAKE_DOT4'),
  ('TOY_M20AFXS_20_HYBRID', 'OIL_0W16_SP', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('FORD_P4AT_22_TDCI', 'OIL_5W30_DIESEL_LIGHT', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('HOL_ALLOYTEC_36_V6', 'OIL_5W30_C3', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('HOL_ECOTEC_38_V6', 'OIL_10W40_SEMI', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('HOL_LS_V8', 'OIL_5W30_C3', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('HON_F_SERIES_20_22_23', 'OIL_10W40_SEMI', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('HON_LDA_IMA_HYBRID', 'OIL_0W20_SP', 'COOLANT_OAT_RED', 'TRANS_CVT', 'BRAKE_DOT4'),
  ('HKM_LAMBDA_V6', 'OIL_5W30_C3', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('LEX_2GRFSE_35_D4S', 'OIL_0W20_SP', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('LEX_2URGSE_50_V8', 'OIL_5W30_C3', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('MIT_3A92_3B20_10_12', 'OIL_0W20_SP', 'COOLANT_OAT_RED', 'TRANS_CVT', 'BRAKE_DOT4'),
  ('MIT_4G15_4G18_15_16', 'OIL_10W40_SEMI', 'COOLANT_IAT_GREEN', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT3'),
  ('MIT_6G72_6G74_V6', 'OIL_10W40_SEMI', 'COOLANT_IAT_GREEN', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('MIT_IMIEV_BEV', NULL, 'COOLANT_OAT_BLUE', NULL, 'BRAKE_DOT4'),
  ('SUB_EE20_20_DIESEL', 'OIL_5W30_DIESEL_LIGHT', 'COOLANT_OAT_BLUE', 'TRANS_CVT', 'BRAKE_DOT4'),
  ('SUZ_K10C_10_TURBO', 'OIL_0W20_SP', 'COOLANT_OAT_BLUE', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4')
ON CONFLICT (engine_family_id) DO NOTHING;

INSERT INTO public.service_schedule (
  engine_family_id, coolant_capacity_l, trans_capacity_l,
  oil_interval_km, oil_interval_months,
  coolant_interval_km, coolant_interval_months,
  brake_fluid_interval_months, trans_interval_km,
  aircon_refrigerant, confidence, notes
) VALUES
  ('VW_EA111_12_TSI', 5, 2, 15000, 12, 150000, 60, 24, 60000, 'R134a', 2, 'DQ200: 2L DSG fluid + 1L 75W gear oil final drive'),
  ('VW_EA211_12_TSI', 5.5, 2, 15000, 12, 180000, 120, 24, 60000, 'R134a', 2, 'DQ200: 2L DSG fluid + 1L 75W gear oil final drive'),
  ('VW_EA211_15_TSI_EVO', 6, 2, 15000, 12, 200000, 120, 24, 60000, 'R1234yf', 2, 'DQ200: 2L DSG fluid + 1L 75W gear oil final drive'),
  ('VW_EA211_14_TSI_TC', 6, 5, 15000, 12, 200000, 120, 24, 60000, 'R1234yf', 2, 'Aisin AQ250/AQ300 torque converter — conventional ATF drain+fill ~5L'),
  ('VW_EA111_16_MPI', 6, 4, 15000, 12, 120000, 60, 24, 60000, 'R134a', 2, 'Aisin 09G 6AT drain+fill ~4L'),
  ('VW_EA189_16_TDI', 6, 2, 15000, 12, 180000, 120, 24, 60000, 'R134a', 2, 'DQ200: 2L DSG fluid + 1L 75W gear oil final drive'),
  ('VW_EA888_18_TSI', 7, 7, 15000, 12, 180000, 120, 24, 60000, 'R134a', 2, 'DQ250 wet DSG ~7L; Multitronic CVT on Audi FWD uses CVT-specific fluid'),
  ('VW_EA288_20_TDI', 7.5, 7, 15000, 12, 200000, 120, 24, 60000, 'R1234yf', 2, 'DQ381/DQ500 wet DSG ~7L'),
  ('VW_25_TDI_I5_T5', 10, 5, 15000, 12, 120000, 60, 24, 60000, 'R134a', 2, 'ZF 6HP auto — ATF + pan/filter recommended'),
  ('VW_VR6_32_36', 8, 7, 15000, 12, 150000, 60, 24, 60000, 'R134a', 2, 'DQ250 wet DSG ~7L on DSG cars; Tiptronic on Touareg uses ATF'),
  ('AUDI_42_FSI_V8', 11, 5, 15000, 12, 150000, 60, 24, 60000, 'R134a', 2, 'ZF 6HP tiptronic — ATF + pan/filter recommended'),
  ('AUDI_42_TDI_V8', 12, 5, 15000, 12, 150000, 60, 24, 60000, 'R134a', 2, 'ZF 6HP/8HP tiptronic — ATF + pan/filter recommended'),
  ('TOY_M20AFKS_20', 6.5, 4.5, 10000, 12, 160000, 120, 24, 60000, 'R1234yf', 2, 'Direct Shift-CVT — Toyota CVT FE fluid'),
  ('TOY_M20AFXS_20_HYBRID', 6.5, 3.5, 10000, 12, 160000, 120, 24, 60000, 'R1234yf', 2, 'P610 eCVT — Toyota ATF WS'),
  ('FORD_P4AT_22_TDCI', 9, 5, 10000, 12, 150000, 100, 24, 60000, 'R134a', 2, 'Ranger PX 2.2 TDCi — 6R80 auto drain+fill'),
  ('HOL_ALLOYTEC_36_V6', 8, 5, 10000, 12, 150000, 60, 24, 60000, 'R134a', 2, 'VZ/VE Commodore 3.6 — 5L40E/6L50 drain+fill'),
  ('HOL_ECOTEC_38_V6', 9, 4, 10000, 6, 80000, 48, 24, 60000, 'R134a', 2, 'VS-VY Commodore 3.8 — 4L60E drain+fill'),
  ('HOL_LS_V8', 11, 4.5, 10000, 12, 150000, 60, 24, 60000, 'R134a', 2, 'VZ-VF SS/HSV — 4L65E/6L80 drain+fill'),
  ('HON_F_SERIES_20_22_23', 5.5, 3, 10000, 12, 80000, 48, 24, 60000, 'R134a', 2, 'Accord/Odyssey F-series'),
  ('HON_LDA_IMA_HYBRID', 4.5, 3, 10000, 12, 100000, 60, 24, 60000, 'R134a', 2, 'Insight/Civic IMA — Honda HMMF CVT fluid'),
  ('HKM_LAMBDA_V6', 8.5, 4.5, 10000, 12, 150000, 100, 24, 60000, 'R134a', 2, 'Santa Fe/Sorento 3.3/3.8 V6'),
  ('LEX_2GRFSE_35_D4S', 9.2, 4, 10000, 12, 160000, 100, 24, 60000, 'R134a', 2, 'IS350/GS350 — Toyota ATF WS drain+fill'),
  ('LEX_2URGSE_50_V8', 10, 4.5, 10000, 12, 160000, 100, 24, 60000, 'R134a', 2, 'RC F/GS F/IS500 — Toyota ATF WS drain+fill'),
  ('MIT_3A92_3B20_10_12', 4.5, 3.5, 10000, 12, 100000, 60, 24, 60000, 'R134a', 2, 'Mirage CVT — spec-sensitive CVT fluid'),
  ('MIT_4G15_4G18_15_16', 5, 3.5, 7500, 6, 50000, 36, 24, 60000, 'R134a', 2, 'Lancer/Mirage 4sp auto'),
  ('MIT_6G72_6G74_V6', 8, 4.5, 10000, 6, 80000, 48, 24, 60000, 'R134a', 2, 'Pajero 3.0/3.5 V6'),
  ('MIT_IMIEV_BEV', 4, NULL, 0, 0, 105000, 96, 24, NULL, 'R134a', 2, 'BEV — no engine oil; battery/motor coolant loop + brake fluid only'),
  ('SUB_EE20_20_DIESEL', 7.5, 4.5, 10000, 12, 150000, 100, 24, 60000, 'R134a', 2, 'Outback/Forester diesel — Lineartronic CVT on autos'),
  ('SUZ_K10C_10_TURBO', 4.5, 3.5, 10000, 12, 150000, 100, 24, 60000, 'R1234yf', 2, 'Swift RS/Baleno 1.0 BoosterJet — 6AT')
ON CONFLICT (engine_family_id) DO NOTHING;

-- ── cambelt_full ──
INSERT INTO ef_parts_data (engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
SELECT v.* FROM (VALUES
  ('VW_EA211_12_TSI', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 900, 1150, 3, 4.5, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump; NZ GST-incl'),
  ('VW_EA211_15_TSI_EVO', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 950, 1200, 3, 4.5, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump; NZ GST-incl'),
  ('VW_EA211_14_TSI_TC', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 900, 1150, 3, 4.5, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump; NZ GST-incl'),
  ('VW_EA111_16_MPI', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 750, 950, 2.5, 3.8, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump; NZ GST-incl'),
  ('VW_EA189_16_TDI', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 900, 1150, 3, 4.5, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump; NZ GST-incl'),
  ('VW_EA288_20_TDI', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 1000, 1300, 3, 4.5, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump; NZ GST-incl')
) AS v(engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
ON CONFLICT (engine_family_id, category_id) DO NOTHING;

-- ── timing_chain_replacement ──
INSERT INTO ef_parts_data (engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
SELECT v.* FROM (VALUES
  ('VW_EA111_12_TSI', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 2200, 2750, 7.5, 11.2, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+sprockets+seals+cover gasket; economy; NZ GST-incl'),
  ('VW_EA888_18_TSI', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 2600, 3250, 9.3, 14, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+sprockets+seals+cover gasket; mid; NZ GST-incl'),
  ('VW_VR6_32_36', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 3800, 4800, 11.4, 17.1, 'moat_nz_gst_incl', 2, 'Rear-of-engine chains — gearbox out; premium; NZ GST-incl'),
  ('AUDI_42_FSI_V8', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 5500, 7000, 14, 20, 'moat_nz_gst_incl', 2, 'Rear-mounted chains — engine-out job; luxury; NZ GST-incl'),
  ('AUDI_42_TDI_V8', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 5800, 7200, 14, 20, 'moat_nz_gst_incl', 2, 'Rear-mounted chains — engine-out job; luxury; NZ GST-incl'),
  ('TOY_M20AFKS_20', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 2300, 2900, 7.5, 11.2, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+sprockets+seals+cover gasket; mid; NZ GST-incl'),
  ('TOY_M20AFXS_20_HYBRID', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 2300, 2900, 7.5, 11.2, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+sprockets+seals+cover gasket; mid; NZ GST-incl')
) AS v(engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
ON CONFLICT (engine_family_id, category_id) DO NOTHING;

-- ── spark_plugs ──
INSERT INTO ef_parts_data (engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
SELECT v.* FROM (VALUES
  ('VW_EA111_12_TSI', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 240, 300, 0.5, 1, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('VW_EA211_12_TSI', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 240, 300, 0.5, 1, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('VW_EA211_15_TSI_EVO', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 300, 380, 0.5, 1, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('VW_EA211_14_TSI_TC', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 280, 350, 0.5, 1, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('VW_EA111_16_MPI', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 200, 260, 0.5, 1, 'moat_nz_gst_incl', 2, '4x standard/Iridium; set NZ GST-incl'),
  ('VW_EA888_18_TSI', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 300, 380, 0.5, 1, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('VW_VR6_32_36', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 480, 600, 1.5, 2.5, 'moat_nz_gst_incl', 2, '6x Iridium; set NZ GST-incl'),
  ('AUDI_42_FSI_V8', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 640, 800, 2, 3, 'moat_nz_gst_incl', 2, '8x Iridium; set NZ GST-incl'),
  ('TOY_M20AFKS_20', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 300, 380, 0.5, 1, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl'),
  ('TOY_M20AFXS_20_HYBRID', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 300, 380, 0.5, 1, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl')
) AS v(engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
ON CONFLICT (engine_family_id, category_id) DO NOTHING;

-- ── transmission_service ──
INSERT INTO ef_parts_data (engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
SELECT v.* FROM (VALUES
  ('VW_EA111_12_TSI', (SELECT id FROM part_categories WHERE slug='transmission_service'), 380, 560, 1.75, 1.75, 'moat_nz_gst_incl', 2, 'DQ200 dry DSG: 2L fluid + 1L final-drive gear oil; NZ GST-incl'),
  ('VW_EA211_12_TSI', (SELECT id FROM part_categories WHERE slug='transmission_service'), 380, 560, 1.75, 1.75, 'moat_nz_gst_incl', 2, 'DQ200 dry DSG: 2L fluid + 1L final-drive gear oil; NZ GST-incl'),
  ('VW_EA211_15_TSI_EVO', (SELECT id FROM part_categories WHERE slug='transmission_service'), 380, 560, 1.75, 1.75, 'moat_nz_gst_incl', 2, 'DQ200 dry DSG: 2L fluid + 1L final-drive gear oil; NZ GST-incl'),
  ('VW_EA211_14_TSI_TC', (SELECT id FROM part_categories WHERE slug='transmission_service'), 310, 460, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'Aisin AQ torque converter ATF drain+fill; NZ GST-incl'),
  ('VW_EA111_16_MPI', (SELECT id FROM part_categories WHERE slug='transmission_service'), 310, 460, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'Aisin 09G ATF drain+fill; NZ GST-incl'),
  ('VW_EA189_16_TDI', (SELECT id FROM part_categories WHERE slug='transmission_service'), 380, 560, 1.75, 1.75, 'moat_nz_gst_incl', 2, 'DQ200 dry DSG: 2L fluid + 1L final-drive gear oil; NZ GST-incl'),
  ('VW_EA888_18_TSI', (SELECT id FROM part_categories WHERE slug='transmission_service'), 450, 650, 1.3, 1.8, 'moat_nz_gst_incl', 2, 'DQ250 wet DSG ~7L incl filter; NZ GST-incl'),
  ('VW_EA288_20_TDI', (SELECT id FROM part_categories WHERE slug='transmission_service'), 450, 650, 1.3, 1.8, 'moat_nz_gst_incl', 2, 'DQ381/DQ500 wet DSG ~7L incl filter; NZ GST-incl'),
  ('VW_25_TDI_I5_T5', (SELECT id FROM part_categories WHERE slug='transmission_service'), 380, 560, 1, 1.5, 'moat_nz_gst_incl', 2, 'ZF 6HP ATF + pan/filter; NZ GST-incl'),
  ('VW_VR6_32_36', (SELECT id FROM part_categories WHERE slug='transmission_service'), 450, 650, 1.3, 1.8, 'moat_nz_gst_incl', 2, 'DQ250 wet DSG ~7L incl filter; NZ GST-incl'),
  ('AUDI_42_FSI_V8', (SELECT id FROM part_categories WHERE slug='transmission_service'), 420, 620, 1, 1.5, 'moat_nz_gst_incl', 2, 'ZF 6HP ATF + pan/filter; NZ GST-incl'),
  ('AUDI_42_TDI_V8', (SELECT id FROM part_categories WHERE slug='transmission_service'), 420, 620, 1, 1.5, 'moat_nz_gst_incl', 2, 'ZF 6HP/8HP ATF + pan/filter; NZ GST-incl'),
  ('TOY_M20AFKS_20', (SELECT id FROM part_categories WHERE slug='transmission_service'), 310, 460, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'Direct Shift-CVT drain+fill (CVT FE); NZ GST-incl'),
  ('TOY_M20AFXS_20_HYBRID', (SELECT id FROM part_categories WHERE slug='transmission_service'), 310, 460, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'eCVT ATF WS drain+fill; NZ GST-incl')
) AS v(engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
ON CONFLICT (engine_family_id, category_id) DO NOTHING;

-- ── fleet_vehicles ──
INSERT INTO public.fleet_vehicles (vehicle_id, make, model, submodel, chassis_code, year_from, year_to, engine_family_id, fuel, body_type, drivetrain, notes) VALUES
  ('VW_POLO_6R_12TSI_10_14', 'Volkswagen', 'Polo', '1.2 TSI', '6R', 2010, 2014, 'VW_EA111_12_TSI', 'petrol', 'hatch', 'fwd', 'CBZB 77kW + DQ200 or 5MT'),
  ('VW_GOLF_MK7_12TSI_13_17', 'Volkswagen', 'Golf', '1.2 TSI', 'MK7', 2013, 2017, 'VW_EA211_12_TSI', 'petrol', 'hatch', 'fwd', 'CJZA 81kW + DQ200 or 6MT'),
  ('VW_GOLF_MK75_15TSI_17_20', 'Volkswagen', 'Golf', '1.5 TSI', 'MK7.5', 2017, 2020, 'VW_EA211_15_TSI_EVO', 'petrol', 'hatch', 'fwd', 'DADA 110kW evo + DQ200'),
  ('VW_TROC_15TSI_18_NOW', 'Volkswagen', 'T-Roc', '1.5 TSI', 'A11', 2018, NULL, 'VW_EA211_15_TSI_EVO', 'petrol', 'suv', 'fwd', '1.5 TSI evo + DQ200'),
  ('SKO_OCTAVIA_NX_15TSI_20_NOW', 'Skoda', 'Octavia', '1.5 TSI', 'NX', 2020, NULL, 'VW_EA211_15_TSI_EVO', 'petrol', 'wagon', 'fwd', '1.5 TSI evo + DQ200'),
  ('VW_GOLF_MK8_14TSI_21_NOW', 'Volkswagen', 'Golf', '1.4 TSI (8AT)', 'MK8', 2021, NULL, 'VW_EA211_14_TSI_TC', 'petrol', 'hatch', 'fwd', 'Golf 8/8.5 NZ 1.4 TSI + Aisin AQ 8sp torque converter (not DSG)'),
  ('VW_GOLF_MK5_16MPI_04_09', 'Volkswagen', 'Golf', '1.6 MPI', 'MK5', 2004, 2009, 'VW_EA111_16_MPI', 'petrol', 'hatch', 'fwd', 'BSE 75kW + Aisin 09G 6AT'),
  ('SKO_OCTAVIA2_16MPI_05_13', 'Skoda', 'Octavia', '1.6 MPI', '1Z', 2005, 2013, 'VW_EA111_16_MPI', 'petrol', 'wagon', 'fwd', 'BSE/BGU + 09G 6AT or 5MT'),
  ('VW_GOLF_MK6_16TDI_09_13', 'Volkswagen', 'Golf', '1.6 TDI', 'MK6', 2009, 2013, 'VW_EA189_16_TDI', 'diesel', 'hatch', 'fwd', 'CAYC 77kW + DQ200 or 5MT'),
  ('VW_POLO_6R_16TDI_10_14', 'Volkswagen', 'Polo', '1.6 TDI', '6R', 2010, 2014, 'VW_EA189_16_TDI', 'diesel', 'hatch', 'fwd', 'CAYC + DQ200 or 5MT'),
  ('AUDI_A4_B8_18TFSI_08_15', 'Audi', 'A4', '1.8 TFSI', 'B8', 2008, 2015, 'VW_EA888_18_TSI', 'petrol', 'sedan', 'fwd', 'CDHB/CJEB 118kW + Multitronic CVT or 6MT'),
  ('VW_PASSAT_B7_18TSI_11_15', 'Volkswagen', 'Passat', '1.8 TSI', 'B7', 2011, 2015, 'VW_EA888_18_TSI', 'petrol', 'sedan', 'fwd', 'CDAB 118kW + DQ250'),
  ('VW_TIGUAN_AD_20TDI_16_NOW', 'Volkswagen', 'Tiguan', '2.0 TDI', 'AD', 2016, NULL, 'VW_EA288_20_TDI', 'diesel', 'suv', 'awd', 'DFG 110kW + DQ381 4Motion'),
  ('VW_PASSAT_B8_20TDI_15_NOW', 'Volkswagen', 'Passat', '2.0 TDI', 'B8', 2015, NULL, 'VW_EA288_20_TDI', 'diesel', 'wagon', 'fwd', 'CRLB/DFCA + DQ381'),
  ('VW_T6_20TDI_15_NOW', 'Volkswagen', 'Transporter', '2.0 TDI', 'T6', 2015, NULL, 'VW_EA288_20_TDI', 'diesel', 'van', 'fwd', 'CXHA/CXEB + DQ500 7sp wet DSG or 5MT'),
  ('VW_T5_25TDI_03_09', 'Volkswagen', 'Transporter', '2.5 TDI', 'T5', 2003, 2009, 'VW_25_TDI_I5_T5', 'diesel', 'van', 'fwd', 'AXD/AXE R5 — gear-driven cams, no cambelt'),
  ('VW_GOLF_R32_MK5_05_08', 'Volkswagen', 'Golf', 'R32', 'MK5', 2005, 2008, 'VW_VR6_32_36', 'petrol', 'hatch', 'awd', 'BUB 3.2 VR6 + DQ250 or 6MT'),
  ('VW_PASSAT_R36_08_10', 'Volkswagen', 'Passat', 'R36', 'B6', 2008, 2010, 'VW_VR6_32_36', 'petrol', 'wagon', 'awd', 'BWS 3.6 FSI + DQ250 4Motion'),
  ('VW_TOUAREG_7P_36FSI_11_18', 'Volkswagen', 'Touareg', '3.6 FSI', '7P', 2011, 2018, 'VW_VR6_32_36', 'petrol', 'suv', 'awd', 'CGRA 3.6 FSI + 8sp tiptronic'),
  ('AUDI_RS4_B7_42FSI_06_08', 'Audi', 'RS4', '4.2 FSI', 'B7', 2006, 2008, 'AUDI_42_FSI_V8', 'petrol', 'sedan', 'awd', 'BNS 309kW + 6MT only'),
  ('AUDI_Q7_4L_42TDI_07_15', 'Audi', 'Q7', '4.2 TDI', '4L', 2007, 2015, 'AUDI_42_TDI_V8', 'diesel', 'suv', 'awd', 'BTR/CCFA + ZF 6HP/8HP tiptronic'),
  ('TOY_COROLLA_E210_20_19_NOW', 'Toyota', 'Corolla', '2.0 (M20A)', 'E210', 2019, NULL, 'TOY_M20AFKS_20', 'petrol', 'hatch', 'fwd', 'M20A-FKS 125kW + Direct Shift-CVT'),
  ('TOY_RAV4_XA50_20_19_NOW', 'Toyota', 'RAV4', '2.0 GX (M20A)', 'XA50', 2019, NULL, 'TOY_M20AFKS_20', 'petrol', 'suv', 'fwd', 'M20A-FKS + Direct Shift-CVT'),
  ('TOY_COROLLACROSS_20HEV_22_NOW', 'Toyota', 'Corolla Cross', '2.0 Hybrid', 'XG10', 2022, NULL, 'TOY_M20AFXS_20_HYBRID', 'hybrid_petrol', 'suv', 'fwd', 'M20A-FXS + P610 eCVT'),
  ('TOY_CHR_G2_20HEV_24_NOW', 'Toyota', 'C-HR', '2.0 Hybrid', 'AX10', 2024, NULL, 'TOY_M20AFXS_20_HYBRID', 'hybrid_petrol', 'suv', 'fwd', 'M20A-FXS + eCVT')
ON CONFLICT (vehicle_id) DO NOTHING;

-- ── ef_vehicle_aliases (no unique constraint — guard with NOT EXISTS) ──
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_POLO_6R_12TSI_10_14', 'Volkswagen', 'Polo', '1.2 TSI', 2010, 2014, 'CBZB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_POLO_6R_12TSI_10_14' AND alias_variant = '1.2 TSI');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_GOLF_MK7_12TSI_13_17', 'Volkswagen', 'Golf', '1.2 TSI', 2013, 2017, 'CJZA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_GOLF_MK7_12TSI_13_17' AND alias_variant = '1.2 TSI');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_GOLF_MK75_15TSI_17_20', 'Volkswagen', 'Golf', '1.5 TSI', 2017, 2020, 'DADA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_GOLF_MK75_15TSI_17_20' AND alias_variant = '1.5 TSI');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_TROC_15TSI_18_NOW', 'Volkswagen', 'T-Roc', '1.5 TSI', 2018, NULL, 'DPCA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_TROC_15TSI_18_NOW' AND alias_variant = '1.5 TSI');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'SKO_OCTAVIA_NX_15TSI_20_NOW', 'Skoda', 'Octavia', '1.5 TSI', 2020, NULL, 'DPCA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'SKO_OCTAVIA_NX_15TSI_20_NOW' AND alias_variant = '1.5 TSI');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_GOLF_MK8_14TSI_21_NOW', 'Volkswagen', 'Golf', '1.4 TSI', 2021, NULL, 'CZE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_GOLF_MK8_14TSI_21_NOW' AND alias_variant = '1.4 TSI');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_GOLF_MK5_16MPI_04_09', 'Volkswagen', 'Golf', '1.6', 2004, 2009, 'BSE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_GOLF_MK5_16MPI_04_09' AND alias_variant = '1.6');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'SKO_OCTAVIA2_16MPI_05_13', 'Skoda', 'Octavia', '1.6', 2005, 2013, 'BSE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'SKO_OCTAVIA2_16MPI_05_13' AND alias_variant = '1.6');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_GOLF_MK6_16TDI_09_13', 'Volkswagen', 'Golf', '1.6 TDI', 2009, 2013, 'CAYC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_GOLF_MK6_16TDI_09_13' AND alias_variant = '1.6 TDI');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_POLO_6R_16TDI_10_14', 'Volkswagen', 'Polo', '1.6 TDI', 2010, 2014, 'CAYC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_POLO_6R_16TDI_10_14' AND alias_variant = '1.6 TDI');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_A4_B8_18TFSI_08_15', 'Audi', 'A4', '1.8 TFSI', 2008, 2015, 'CDHB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_A4_B8_18TFSI_08_15' AND alias_variant = '1.8 TFSI');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_PASSAT_B7_18TSI_11_15', 'Volkswagen', 'Passat', '1.8 TSI', 2011, 2015, 'CDAB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_PASSAT_B7_18TSI_11_15' AND alias_variant = '1.8 TSI');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_TIGUAN_AD_20TDI_16_NOW', 'Volkswagen', 'Tiguan', '2.0 TDI', 2016, NULL, 'DFGA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_TIGUAN_AD_20TDI_16_NOW' AND alias_variant = '2.0 TDI');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_PASSAT_B8_20TDI_15_NOW', 'Volkswagen', 'Passat', '2.0 TDI', 2015, NULL, 'CRLB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_PASSAT_B8_20TDI_15_NOW' AND alias_variant = '2.0 TDI');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_T6_20TDI_15_NOW', 'Volkswagen', 'Transporter', '2.0 TDI', 2015, NULL, 'CXHA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_T6_20TDI_15_NOW' AND alias_variant = '2.0 TDI');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_T5_25TDI_03_09', 'Volkswagen', 'Transporter', '2.5 TDI', 2003, 2009, 'AXD', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_T5_25TDI_03_09' AND alias_variant = '2.5 TDI');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_GOLF_R32_MK5_05_08', 'Volkswagen', 'Golf', 'R32', 2005, 2008, 'BUB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_GOLF_R32_MK5_05_08' AND alias_variant = 'R32');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_PASSAT_R36_08_10', 'Volkswagen', 'Passat', 'R36', 2008, 2010, 'BWS', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_PASSAT_R36_08_10' AND alias_variant = 'R36');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'VW_TOUAREG_7P_36FSI_11_18', 'Volkswagen', 'Touareg', '3.6', 2011, 2018, 'CGRA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'VW_TOUAREG_7P_36FSI_11_18' AND alias_variant = '3.6');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_RS4_B7_42FSI_06_08', 'Audi', 'RS4', 'RS4', 2006, 2008, 'BNS', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_RS4_B7_42FSI_06_08' AND alias_variant = 'RS4');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'AUDI_Q7_4L_42TDI_07_15', 'Audi', 'Q7', '4.2 TDI', 2007, 2015, 'BTR', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'AUDI_Q7_4L_42TDI_07_15' AND alias_variant = '4.2 TDI');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_COROLLA_E210_20_19_NOW', 'Toyota', 'Corolla', '2.0', 2019, NULL, 'M20A-FKS', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_COROLLA_E210_20_19_NOW' AND alias_variant = '2.0');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_RAV4_XA50_20_19_NOW', 'Toyota', 'RAV4', '2.0', 2019, NULL, 'M20A-FKS', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_RAV4_XA50_20_19_NOW' AND alias_variant = '2.0');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_COROLLACROSS_20HEV_22_NOW', 'Toyota', 'Corolla Cross', 'Hybrid', 2022, NULL, 'M20A-FXS', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_COROLLACROSS_20HEV_22_NOW' AND alias_variant = 'Hybrid');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'TOY_CHR_G2_20HEV_24_NOW', 'Toyota', 'C-HR', 'Hybrid', 2024, NULL, 'M20A-FXS', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'TOY_CHR_G2_20HEV_24_NOW' AND alias_variant = 'Hybrid');

-- ── vehicle_models (legacy path) ──
INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes) VALUES
  ('Volkswagen', 'Polo', '1.2 TSI', '6R', 'CBZB', 2010, 2014, 'petrol', 1200, 'dct', 'fwd', 'hatch', 'chain', 'CBZB 77kW + DQ200 or 5MT'),
  ('Volkswagen', 'Golf', '1.2 TSI', 'MK7', 'CJZA', 2013, 2017, 'petrol', 1200, 'dct', 'fwd', 'hatch', 'belt', 'CJZA 81kW + DQ200 or 6MT'),
  ('Volkswagen', 'Golf', '1.5 TSI', 'MK7.5', 'DADA', 2017, 2020, 'petrol', 1500, 'dct', 'fwd', 'hatch', 'belt', 'DADA 110kW evo + DQ200'),
  ('Volkswagen', 'T-Roc', '1.5 TSI', 'A11', 'DPCA', 2018, NULL, 'petrol', 1500, 'dct', 'fwd', 'suv', 'belt', '1.5 TSI evo + DQ200'),
  ('Skoda', 'Octavia', '1.5 TSI', 'NX', 'DPCA', 2020, NULL, 'petrol', 1500, 'dct', 'fwd', 'wagon', 'belt', '1.5 TSI evo + DQ200'),
  ('Volkswagen', 'Golf', '1.4 TSI (8AT)', 'MK8', 'CZE', 2021, NULL, 'petrol', 1400, 'auto', 'fwd', 'hatch', 'belt', 'Golf 8/8.5 NZ 1.4 TSI + Aisin AQ 8sp torque converter (not DSG)'),
  ('Volkswagen', 'Golf', '1.6 MPI', 'MK5', 'BSE', 2004, 2009, 'petrol', 1600, 'auto', 'fwd', 'hatch', 'belt', 'BSE 75kW + Aisin 09G 6AT'),
  ('Skoda', 'Octavia', '1.6 MPI', '1Z', 'BSE', 2005, 2013, 'petrol', 1600, 'auto', 'fwd', 'wagon', 'belt', 'BSE/BGU + 09G 6AT or 5MT'),
  ('Volkswagen', 'Golf', '1.6 TDI', 'MK6', 'CAYC', 2009, 2013, 'diesel', 1600, 'dct', 'fwd', 'hatch', 'belt', 'CAYC 77kW + DQ200 or 5MT'),
  ('Volkswagen', 'Polo', '1.6 TDI', '6R', 'CAYC', 2010, 2014, 'diesel', 1600, 'dct', 'fwd', 'hatch', 'belt', 'CAYC + DQ200 or 5MT'),
  ('Audi', 'A4', '1.8 TFSI', 'B8', 'CDHB', 2008, 2015, 'petrol', 1800, 'cvt', 'fwd', 'sedan', 'chain', 'CDHB/CJEB 118kW + Multitronic CVT or 6MT'),
  ('Volkswagen', 'Passat', '1.8 TSI', 'B7', 'CDAB', 2011, 2015, 'petrol', 1800, 'dct', 'fwd', 'sedan', 'chain', 'CDAB 118kW + DQ250'),
  ('Volkswagen', 'Tiguan', '2.0 TDI', 'AD', 'DFGA', 2016, NULL, 'diesel', 2000, 'dct', 'awd', 'suv', 'belt', 'DFG 110kW + DQ381 4Motion'),
  ('Volkswagen', 'Passat', '2.0 TDI', 'B8', 'CRLB', 2015, NULL, 'diesel', 2000, 'dct', 'fwd', 'wagon', 'belt', 'CRLB/DFCA + DQ381'),
  ('Volkswagen', 'Transporter', '2.0 TDI', 'T6', 'CXHA', 2015, NULL, 'diesel', 2000, 'dct', 'fwd', 'van', 'belt', 'CXHA/CXEB + DQ500 7sp wet DSG or 5MT'),
  ('Volkswagen', 'Transporter', '2.5 TDI', 'T5', 'AXD', 2003, 2009, 'diesel', 2500, 'auto', 'fwd', 'van', 'chain', 'AXD/AXE R5 — gear-driven cams, no cambelt'),
  ('Volkswagen', 'Golf', 'R32', 'MK5', 'BUB', 2005, 2008, 'petrol', 3200, 'dct', 'awd', 'hatch', 'chain', 'BUB 3.2 VR6 + DQ250 or 6MT'),
  ('Volkswagen', 'Passat', 'R36', 'B6', 'BWS', 2008, 2010, 'petrol', 3600, 'dct', 'awd', 'wagon', 'chain', 'BWS 3.6 FSI + DQ250 4Motion'),
  ('Volkswagen', 'Touareg', '3.6 FSI', '7P', 'CGRA', 2011, 2018, 'petrol', 3600, 'auto', 'awd', 'suv', 'chain', 'CGRA 3.6 FSI + 8sp tiptronic'),
  ('Audi', 'RS4', '4.2 FSI', 'B7', 'BNS', 2006, 2008, 'petrol', 4200, 'manual', 'awd', 'sedan', 'chain', 'BNS 309kW + 6MT only'),
  ('Audi', 'Q7', '4.2 TDI', '4L', 'BTR', 2007, 2015, 'diesel', 4200, 'auto', 'awd', 'suv', 'chain', 'BTR/CCFA + ZF 6HP/8HP tiptronic'),
  ('Toyota', 'Corolla', '2.0 (M20A)', 'E210', 'M20A-FKS', 2019, NULL, 'petrol', 2000, 'cvt', 'fwd', 'hatch', 'chain', 'M20A-FKS 125kW + Direct Shift-CVT'),
  ('Toyota', 'RAV4', '2.0 GX (M20A)', 'XA50', 'M20A-FKS', 2019, NULL, 'petrol', 2000, 'cvt', 'fwd', 'suv', 'chain', 'M20A-FKS + Direct Shift-CVT'),
  ('Toyota', 'Corolla Cross', '2.0 Hybrid', 'XG10', 'M20A-FXS', 2022, NULL, 'hybrid', 2000, 'cvt', 'fwd', 'suv', 'chain', 'M20A-FXS + P610 eCVT'),
  ('Toyota', 'C-HR', '2.0 Hybrid', 'AX10', 'M20A-FXS', 2024, NULL, 'hybrid', 2000, 'cvt', 'fwd', 'suv', 'chain', 'M20A-FXS + eCVT')
ON CONFLICT (make, model, submodel, chassis_code, engine_code, year_from) DO NOTHING;
