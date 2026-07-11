-- ============================================================
-- TORQUED — Migration 052: Transmission service pricing gap-fill
-- ~19 engine families had no transmission_service price and so fell through to
-- the "Quote · ~1 hr" path (notably the Toyota/Lexus/Honda hybrids incl. Prius
-- 2ZR-FXE, and several V6/V8 autos). This seeds NZ GST-INCLUSIVE pricing for a
-- fluid drain-and-fill (± filter/gasket kit where applicable). e-CVT/IMA hybrid
-- transaxles are a simple ATF-WS drain-and-fill (no conventional filter).
--
-- Uses the existing 'transmission_service' slug + the migration-043 convention:
-- total_job = parts (fluid × NZ $/L + kit + sundries) + hours_high * 130.
-- confidence=2. Idempotent (ON CONFLICT DO NOTHING).
--
-- Service interval: handled in code, not seeded here — the endpoint defaults to
-- 60,000 km unless service_schedule.trans_interval_km states a lower figure
-- (e.g. 40,000 km on DSG/wet-clutch units, which already carry their own data).
-- ============================================================

-- Transmission service (gap-fill families) -> category 'transmission_service'
INSERT INTO ef_parts_data (engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
SELECT v.* FROM (VALUES
  ('FORD_P4AT_22_TDCI', (SELECT id FROM part_categories WHERE slug='transmission_service'), 345, 505, 1.0, 1.5, 'moat_nz_gst_incl', 2, 'Ranger/Transit 2.2 TDCi auto ATF drain+fill'),
  ('HKM_LAMBDA_V6', (SELECT id FROM part_categories WHERE slug='transmission_service'), 363, 533, 1.0, 1.6, 'moat_nz_gst_incl', 2, 'Hyundai/Kia Lambda V6 auto ATF service'),
  ('HOL_ALLOYTEC_36_V6', (SELECT id FROM part_categories WHERE slug='transmission_service'), 358, 518, 1.0, 1.6, 'moat_nz_gst_incl', 2, 'Commodore Alloytec V6 auto ATF service'),
  ('HOL_ECOTEC_38_V6', (SELECT id FROM part_categories WHERE slug='transmission_service'), 358, 518, 1.0, 1.6, 'moat_nz_gst_incl', 2, 'Commodore Ecotec V6 auto ATF service'),
  ('HOL_LS_V8', (SELECT id FROM part_categories WHERE slug='transmission_service'), 389, 559, 1.0, 1.8, 'moat_nz_gst_incl', 2, 'LS V8 6L80 auto ATF service'),
  ('HON_F_SERIES_20_22_23', (SELECT id FROM part_categories WHERE slug='transmission_service'), 259, 359, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'Accord/CR-V F-series 5AT ATF drain+fill'),
  ('HON_LDA_IMA_HYBRID', (SELECT id FROM part_categories WHERE slug='transmission_service'), 226, 311, 0.8, 1.2, 'moat_nz_gst_incl', 2, 'Civic/Insight IMA hybrid CVT drain+fill'),
  ('LEX_2GRFSE_35_D4S', (SELECT id FROM part_categories WHERE slug='transmission_service'), 368, 533, 1.0, 1.6, 'moat_nz_gst_incl', 2, 'Lexus IS/GS 2GR-FSE auto ATF-WS fill-to-temp'),
  ('LEX_2URGSE_50_V8', (SELECT id FROM part_categories WHERE slug='transmission_service'), 460, 655, 1.2, 2.0, 'moat_nz_gst_incl', 2, 'Lexus IS-F/GS-F 2UR V8 8AT ATF-WS service'),
  ('MIT_3A92_3B20_10_12', (SELECT id FROM part_categories WHERE slug='transmission_service'), 295, 410, 1.0, 1.5, 'moat_nz_gst_incl', 2, 'Mirage/Colt 3A92 CVT drain+fill'),
  ('MIT_4G15_4G18_15_16', (SELECT id FROM part_categories WHERE slug='transmission_service'), 295, 410, 1.0, 1.5, 'moat_nz_gst_incl', 2, 'Lancer/Colt 4G1x auto/CVT service'),
  ('MIT_6G72_6G74_V6', (SELECT id FROM part_categories WHERE slug='transmission_service'), 358, 518, 1.0, 1.6, 'moat_nz_gst_incl', 2, 'Pajero/Triton 6G7x V6 auto ATF service'),
  ('MIT_OUTLANDER_PHEV_24', (SELECT id FROM part_categories WHERE slug='transmission_service'), 221, 311, 0.8, 1.2, 'moat_nz_gst_incl', 2, 'Outlander PHEV single-speed transaxle drain+fill'),
  ('SUB_EE20_20_DIESEL', (SELECT id FROM part_categories WHERE slug='transmission_service'), 300, 425, 1.0, 1.5, 'moat_nz_gst_incl', 2, 'Outback/Forester EE20 diesel CVT drain+fill'),
  ('SUZ_K10C_10_TURBO', (SELECT id FROM part_categories WHERE slug='transmission_service'), 272, 382, 1.0, 1.4, 'moat_nz_gst_incl', 2, 'Swift/Baleno K10C CVT drain+fill'),
  ('TOY_1NZFXE_15_HYBRID', (SELECT id FROM part_categories WHERE slug='transmission_service'), 213, 278, 0.8, 1.1, 'moat_nz_gst_incl', 2, 'Aqua/Prius C 1NZ-FXE eCVT transaxle drain+fill'),
  ('TOY_2ARFXE_25_HYBRID', (SELECT id FROM part_categories WHERE slug='transmission_service'), 231, 296, 0.8, 1.2, 'moat_nz_gst_incl', 2, 'Camry/RAV4 2AR-FXE eCVT transaxle drain+fill'),
  ('TOY_2ZRFXE_18_HYBRID', (SELECT id FROM part_categories WHERE slug='transmission_service'), 226, 291, 0.8, 1.2, 'moat_nz_gst_incl', 2, 'Prius/Corolla Hybrid 2ZR-FXE eCVT transaxle drain+fill'),
  ('TOY_A25AFXS_25_HYBRID', (SELECT id FROM part_categories WHERE slug='transmission_service'), 231, 296, 0.8, 1.2, 'moat_nz_gst_incl', 2, 'RAV4/Camry A25A-FXS eCVT transaxle drain+fill')
) AS v(engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
ON CONFLICT (engine_family_id, category_id) DO NOTHING;
