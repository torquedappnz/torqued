SET search_path TO public;

-- ============================================================
-- TORQUED — Migration 062: Citroen/Peugeot + Renault + Fiat expansion
-- Adds the 3 makes with zero engine-family coverage: PSA PureTech
-- 1.2T (wet belt), DV6 1.6 HDi, DW10 2.0 HDi; Renault TCe (0.9/1.2/1.3),
-- K4M 1.6, K9K 1.5 dCi; Fiat FIRE 1.2/1.4, MultiAir 1.4T (Abarth),
-- 2.3 MultiJet (Ducato). Peugeot/Citroen 1.6 THP vehicles reuse the
-- existing MINI_PRINCE_16 family (same Prince engine); Renault Megane
-- 2.0/Koleos 2.5 reuse Nissan MR20/QR25 families (shared engines).
-- Methodology matches migrations 037/042/043/051/052/053/061.
-- Applied directly to production 2026-07-21 (data-only inserts).
-- ============================================================

INSERT INTO public.engine_families (
  family_id, common_name, manufacturer, displacement_l, cylinders,
  fuel, timing_type, cambelt_interval_km, cambelt_interval_years,
  oil_spec, oil_capacity_l, coolant_spec, segment_tier,
  service_interval_km, service_interval_months, notes
) VALUES
  ('PSA_PURETECH_12T', 'PSA PureTech 1.2 Turbo 3cyl (EB2DT)', 'Peugeot-Citroen', 1.2, 3, 'petrol', 'belt', 100000, 6, '0W-30 PSA B71 2312', 3.5, 'PSA OAT (orange/blue)', 'economy', 15000, 12, 'Peugeot 208/2008/308 1.2 PureTech, Citroen C3/C4/C3 Aircross, Opel-shared. WET belt-in-oil — belts degrade early if wrong oil/short trips; inspect at every service, replace 100,000km/6yr max. Oil spec critical. EAT6/EAT8 Aisin torque-converter auto.'),
  ('PSA_DV6_16_HDI', 'PSA DV6 1.6 HDi/BlueHDi', 'Peugeot-Citroen', 1.6, 4, 'diesel', 'belt', 150000, 10, '5W-30 ACEA C2', 3.8, 'PSA OAT (orange/blue)', 'economy', 15000, 12, 'Peugeot 208/308/Partner 1.6 HDi, Citroen C3/C4/Berlingo 1.6 HDi. Same DV6 architecture as Ford 1.6 TDCi/Volvo D2/Mini One D. DPF on BlueHDi. Belt 150,000km.'),
  ('PSA_DW10_20_HDI', 'PSA DW10 2.0 HDi/BlueHDi', 'Peugeot-Citroen', 2, 4, 'diesel', 'belt', 150000, 10, '5W-30 ACEA C2/C3', 5.3, 'PSA OAT (orange/blue)', 'mid', 15000, 12, 'Peugeot 308/3008/508 2.0 HDi/BlueHDi, Citroen C5/Grand Picasso 2.0 HDi. Shared with Ford 2.0 TDCi. Belt 150,000km. DPF+AdBlue on BlueHDi.'),
  ('REN_TCE_09_13_TURBO', 'Renault TCe 0.9/1.2/1.3 Turbo', 'Renault', 1.3, 4, 'petrol', 'chain', NULL, NULL, '5W-30 RN17 / 0W-30', 4.8, 'Renault Glaceol RX Type D (yellow OAT)', 'economy', 15000, 12, 'Clio IV 0.9 TCe (H4Bt 3cyl), Clio/Captur 1.2 TCe (H5Ft), Captur/Duster/Arkana 1.3 TCe (H5Ht, shared Mercedes M282). Chain. EDC dual dry-clutch auto on many — DCT fluid, ~2L.'),
  ('REN_K4M_16_16V', 'Renault K4M 1.6 16v', 'Renault', 1.6, 4, 'petrol', 'belt', 120000, 6, '5W-40 ACEA A3/B4', 4.8, 'Renault Glaceol RX Type D (yellow OAT)', 'economy', 10000, 12, 'Clio II/III 1.6, Megane II 1.6, Scenic II 1.6. Belt 120,000km/6yr — interference engine, strict interval. 4sp DP0 auto (known weak point) or 5MT.'),
  ('REN_K9K_15_DCI', 'Renault K9K 1.5 dCi', 'Renault', 1.5, 4, 'diesel', 'belt', 120000, 6, '5W-30 ACEA C4 low-SAPS', 4.4, 'Renault Glaceol RX Type D (yellow OAT)', 'economy', 15000, 12, 'Clio III/IV 1.5 dCi, Megane 1.5 dCi, Captur 1.5 dCi — also Nissan Qashqai/Juke/Note 1.5 dCi (same K9K). Belt 120,000km/6yr. DPF on later. Injector-coding on replacement.'),
  ('FIAT_FIRE_12_14', 'Fiat FIRE 1.2/1.4 8v-16v', 'Fiat', 1.4, 4, 'petrol', 'belt', 100000, 6, '5W-40 ACEA A3/B4', 2.8, 'Fiat Paraflu UP (red OAT)', 'economy', 10000, 12, 'Fiat 500 1.2/1.4, Panda, Punto/Grande Punto. Belt 100,000km/6yr (Fiat quotes 120k — NZ consensus earlier). Dualogic AMT is a robotised manual — gear oil + actuator, not ATF.'),
  ('FIAT_MULTIAIR_14T', 'Fiat MultiAir 1.4 Turbo', 'Fiat', 1.4, 4, 'petrol', 'belt', 100000, 6, '5W-40 ACEA A3/B4', 2.9, 'Fiat Paraflu UP (red OAT)', 'premium', 10000, 12, 'Abarth 500/595/695 1.4 T-Jet/MultiAir, Punto Evo 1.4 MultiAir, Alfa MiTo shared. Belt 100,000km/6yr. MultiAir hydraulic intake actuator — oil quality critical, flag noisy top-end.'),
  ('FIAT_F1A_23_MULTIJET', 'Fiat 2.3 MultiJet (Ducato, Iveco F1A)', 'Fiat', 2.3, 4, 'diesel', 'chain', NULL, NULL, '5W-30 ACEA C3', 6.2, 'Fiat Paraflu UP (red OAT)', 'mid', 15000, 12, 'Ducato 2.3 MultiJet 2007+ — dominant NZ motorhome/van base. Chain. 6sp manual or Comfort-Matic AMT (robotised manual — gear oil). DPF on Euro5+.')
ON CONFLICT (family_id) DO NOTHING;

INSERT INTO public.engine_family_fluids (engine_family_id, oil_fluid_id, coolant_fluid_id, trans_fluid_id, brake_fluid_id) VALUES
  ('PSA_PURETECH_12T', 'OIL_5W30_C3', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('PSA_DV6_16_HDI', 'OIL_5W30_DIESEL_LIGHT', 'COOLANT_OAT_RED', 'TRANS_MANUAL_GEAR', 'BRAKE_DOT4'),
  ('PSA_DW10_20_HDI', 'OIL_5W30_DIESEL_LIGHT', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('REN_TCE_09_13_TURBO', 'OIL_5W30_C3', 'COOLANT_OAT_RED', 'TRANS_DSG_DCT', 'BRAKE_DOT4'),
  ('REN_K4M_16_16V', 'OIL_5W40_A3B4', 'COOLANT_OAT_RED', 'TRANS_ATF_CONVENTIONAL', 'BRAKE_DOT4'),
  ('REN_K9K_15_DCI', 'OIL_5W30_DIESEL_LIGHT', 'COOLANT_OAT_RED', 'TRANS_MANUAL_GEAR', 'BRAKE_DOT4'),
  ('FIAT_FIRE_12_14', 'OIL_5W40_A3B4', 'COOLANT_OAT_RED', 'TRANS_MANUAL_GEAR', 'BRAKE_DOT4'),
  ('FIAT_MULTIAIR_14T', 'OIL_5W40_A3B4', 'COOLANT_OAT_RED', 'TRANS_MANUAL_GEAR', 'BRAKE_DOT4'),
  ('FIAT_F1A_23_MULTIJET', 'OIL_5W30_DIESEL_LIGHT', 'COOLANT_OAT_RED', 'TRANS_MANUAL_GEAR', 'BRAKE_DOT4')
ON CONFLICT (engine_family_id) DO NOTHING;

INSERT INTO public.service_schedule (
  engine_family_id, coolant_capacity_l, trans_capacity_l,
  oil_interval_km, oil_interval_months,
  coolant_interval_km, coolant_interval_months,
  brake_fluid_interval_months, trans_interval_km,
  aircon_refrigerant, confidence, notes
) VALUES
  ('PSA_PURETECH_12T', 5.5, 4, 15000, 12, 120000, 60, 24, 60000, 'R1234yf', 2, 'EAT6/EAT8 Aisin ATF drain+fill; wet-belt inspection every service'),
  ('PSA_DV6_16_HDI', 6, 2, 15000, 12, 120000, 60, 24, NULL, 'R134a', 2, 'Mostly manual; ETG/EAT6 autos exist — ATF if fitted'),
  ('PSA_DW10_20_HDI', 7, 4.5, 15000, 12, 120000, 60, 24, 60000, 'R134a', 2, 'EAT6/EAT8 ATF drain+fill'),
  ('REN_TCE_09_13_TURBO', 5.5, 2, 15000, 12, 120000, 60, 24, 60000, 'R1234yf', 2, 'EDC dry dual-clutch ~2L DCT fluid; CVT on Nissan-shared platforms'),
  ('REN_K4M_16_16V', 6, 3.5, 10000, 12, 80000, 48, 24, 60000, 'R134a', 2, 'DP0/AL4 4sp auto — fluid health critical, service on time'),
  ('REN_K9K_15_DCI', 6, 2, 15000, 12, 120000, 60, 24, NULL, 'R134a', 2, 'Mostly 5MT; EDC on some Clio IV/Captur'),
  ('FIAT_FIRE_12_14', 4.5, 2, 10000, 12, 100000, 60, 24, NULL, 'R134a', 2, 'Dualogic AMT = robotised manual — gear oil, not ATF'),
  ('FIAT_MULTIAIR_14T', 4.8, 2, 10000, 12, 100000, 60, 24, NULL, 'R134a', 2, 'Abarth — more frequent oil recommended (7,500km hard use)'),
  ('FIAT_F1A_23_MULTIJET', 10, 2.5, 15000, 12, 120000, 60, 24, NULL, 'R134a', 2, 'Ducato — 6MT or Comfort-Matic AMT (gear oil)')
ON CONFLICT (engine_family_id) DO NOTHING;

INSERT INTO ef_parts_data (engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
SELECT v.* FROM (VALUES
  ('PSA_PURETECH_12T', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 950, 1250, 3.5, 5, 'moat_nz_gst_incl', 2, 'WET belt-in-oil kit incl oil+filter change + tensioner; NZ GST-incl'),
  ('PSA_DV6_16_HDI', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 800, 1000, 3, 4.5, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump; NZ GST-incl'),
  ('PSA_DW10_20_HDI', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 900, 1150, 3, 4.5, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump; NZ GST-incl'),
  ('REN_K4M_16_16V', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 700, 900, 3, 4.5, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump; NZ GST-incl'),
  ('REN_K9K_15_DCI', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 800, 1000, 3, 4.5, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump; NZ GST-incl'),
  ('FIAT_FIRE_12_14', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 650, 850, 2.5, 3.8, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump; NZ GST-incl'),
  ('FIAT_MULTIAIR_14T', (SELECT id FROM part_categories WHERE slug='cambelt_full'), 750, 950, 3, 4.5, 'moat_nz_gst_incl', 2, 'Cambelt kit incl tensioner+idlers+water pump; NZ GST-incl')
) AS v(engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
ON CONFLICT (engine_family_id, category_id) DO NOTHING;

INSERT INTO ef_parts_data (engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
SELECT v.* FROM (VALUES
  ('REN_TCE_09_13_TURBO', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 2000, 2480, 7.5, 11.2, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+sprockets+seals+cover gasket; economy; NZ GST-incl'),
  ('FIAT_F1A_23_MULTIJET', (SELECT id FROM part_categories WHERE slug='timing_chain_replacement'), 2300, 2850, 7.5, 11.2, 'moat_nz_gst_incl', 2, 'Chain+guides+tensioner+sprockets+seals+cover gasket; mid; NZ GST-incl')
) AS v(engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
ON CONFLICT (engine_family_id, category_id) DO NOTHING;

INSERT INTO ef_parts_data (engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
SELECT v.* FROM (VALUES
  ('PSA_PURETECH_12T', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 220, 270, 0.5, 1, 'moat_nz_gst_incl', 2, '3x Iridium; set NZ GST-incl'),
  ('REN_TCE_09_13_TURBO', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 240, 330, 0.5, 1, 'moat_nz_gst_incl', 2, '3-4x Iridium; set NZ GST-incl'),
  ('REN_K4M_16_16V', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 200, 260, 0.5, 1, 'moat_nz_gst_incl', 2, '4x standard/Iridium; set NZ GST-incl'),
  ('FIAT_FIRE_12_14', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 200, 260, 0.5, 1, 'moat_nz_gst_incl', 2, '4x standard/Iridium; set NZ GST-incl'),
  ('FIAT_MULTIAIR_14T', (SELECT id FROM part_categories WHERE slug='spark_plugs'), 240, 330, 0.5, 1, 'moat_nz_gst_incl', 2, '4x Iridium; set NZ GST-incl')
) AS v(engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
ON CONFLICT (engine_family_id, category_id) DO NOTHING;

INSERT INTO ef_parts_data (engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
SELECT v.* FROM (VALUES
  ('PSA_PURETECH_12T', (SELECT id FROM part_categories WHERE slug='transmission_service'), 310, 460, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'EAT6/EAT8 ATF drain+fill; NZ GST-incl'),
  ('PSA_DW10_20_HDI', (SELECT id FROM part_categories WHERE slug='transmission_service'), 310, 460, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'EAT6/EAT8 ATF drain+fill; NZ GST-incl'),
  ('REN_TCE_09_13_TURBO', (SELECT id FROM part_categories WHERE slug='transmission_service'), 380, 560, 1.3, 1.8, 'moat_nz_gst_incl', 2, 'EDC dual-clutch fluid change; NZ GST-incl'),
  ('REN_K4M_16_16V', (SELECT id FROM part_categories WHERE slug='transmission_service'), 310, 460, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'DP0/AL4 drain+fill — service on time; NZ GST-incl'),
  ('FIAT_F1A_23_MULTIJET', (SELECT id FROM part_categories WHERE slug='transmission_service'), 280, 420, 0.8, 1.3, 'moat_nz_gst_incl', 2, 'Manual/Comfort-Matic gear oil change; NZ GST-incl')
) AS v(engine_family_id, category_id, total_job_low, total_job_high, hours_low, hours_high, source_anchor, confidence, notes)
ON CONFLICT (engine_family_id, category_id) DO NOTHING;

INSERT INTO public.fleet_vehicles (vehicle_id, make, model, submodel, chassis_code, year_from, year_to, engine_family_id, fuel, body_type, drivetrain, notes) VALUES
  ('PEU_208_12PT_15_NOW', 'Peugeot', '208', '1.2 PureTech', 'A9/P21', 2015, NULL, 'PSA_PURETECH_12T', 'petrol', 'hatch', 'fwd', 'EB2 wet belt — inspect every service'),
  ('PEU_2008_12PT_15_NOW', 'Peugeot', '2008', '1.2 PureTech', 'A94/P24', 2015, NULL, 'PSA_PURETECH_12T', 'petrol', 'suv', 'fwd', 'EB2 wet belt'),
  ('PEU_308_12PT_15_21', 'Peugeot', '308', '1.2 PureTech', 'T9', 2015, 2021, 'PSA_PURETECH_12T', 'petrol', 'hatch', 'fwd', 'EB2 wet belt'),
  ('CIT_C3_12PT_17_NOW', 'Citroen', 'C3', '1.2 PureTech', 'B618', 2017, NULL, 'PSA_PURETECH_12T', 'petrol', 'hatch', 'fwd', 'EB2 wet belt'),
  ('PEU_308_16THP_08_14', 'Peugeot', '308', '1.6 THP', 'T7', 2008, 2014, 'MINI_PRINCE_16', 'petrol', 'hatch', 'fwd', 'EP6DT Prince shared with Mini N14 — same family data'),
  ('PEU_208GTI_16THP_13_18', 'Peugeot', '208', 'GTi 1.6 THP', 'A9', 2013, 2018, 'MINI_PRINCE_16', 'petrol', 'hatch', 'fwd', 'EP6FDTX 147kW — Prince family'),
  ('CIT_DS3_16THP_10_16', 'Citroen', 'DS3', '1.6 THP', 'A55', 2010, 2016, 'MINI_PRINCE_16', 'petrol', 'hatch', 'fwd', 'EP6DT Prince family'),
  ('CIT_BERLINGO_16HDI_10_18', 'Citroen', 'Berlingo', '1.6 HDi', 'B9', 2010, 2018, 'PSA_DV6_16_HDI', 'diesel', 'van', 'fwd', 'DV6 — common NZ trade van'),
  ('PEU_PARTNER_16HDI_10_18', 'Peugeot', 'Partner', '1.6 HDi', 'B9', 2010, 2018, 'PSA_DV6_16_HDI', 'diesel', 'van', 'fwd', 'DV6'),
  ('PEU_3008_20HDI_17_NOW', 'Peugeot', '3008', '2.0 BlueHDi', 'P84', 2017, NULL, 'PSA_DW10_20_HDI', 'diesel', 'suv', 'fwd', 'DW10F GT — EAT6/EAT8'),
  ('CIT_C5_20HDI_08_17', 'Citroen', 'C5', '2.0 HDi', 'X7', 2008, 2017, 'PSA_DW10_20_HDI', 'diesel', 'sedan', 'fwd', 'DW10 — hydropneumatic suspension note'),
  ('REN_CLIO4_09TCE_13_19', 'Renault', 'Clio', '0.9 TCe', 'X98', 2013, 2019, 'REN_TCE_09_13_TURBO', 'petrol', 'hatch', 'fwd', 'H4Bt 3cyl'),
  ('REN_CAPTUR_13TCE_20_NOW', 'Renault', 'Captur', '1.3 TCe', 'XJB', 2020, NULL, 'REN_TCE_09_13_TURBO', 'petrol', 'suv', 'fwd', 'H5Ht shared Mercedes M282 — EDC'),
  ('REN_ARKANA_13TCE_21_NOW', 'Renault', 'Arkana', '1.3 TCe', 'LJL', 2021, NULL, 'REN_TCE_09_13_TURBO', 'petrol', 'suv', 'fwd', 'H5Ht + EDC'),
  ('REN_CLIO3_16_06_13', 'Renault', 'Clio', '1.6', 'X85', 2006, 2013, 'REN_K4M_16_16V', 'petrol', 'hatch', 'fwd', 'K4M + DP0 4sp auto'),
  ('REN_MEGANE2_16_04_09', 'Renault', 'Megane', '1.6', 'X84', 2004, 2009, 'REN_K4M_16_16V', 'petrol', 'hatch', 'fwd', 'K4M + DP0'),
  ('REN_CLIO4_15DCI_13_19', 'Renault', 'Clio', '1.5 dCi', 'X98', 2013, 2019, 'REN_K9K_15_DCI', 'diesel', 'hatch', 'fwd', 'K9K'),
  ('REN_MEGANE3_20_08_16', 'Renault', 'Megane', '2.0 CVT', 'X95', 2008, 2016, 'NIS_MR20DE_20', 'petrol', 'hatch', 'fwd', 'M4R = Nissan MR20 shared — CVT'),
  ('REN_KOLEOS_25_16_NOW', 'Renault', 'Koleos', '2.5 CVT', 'HZG', 2016, NULL, 'NIS_QR25DE_25', 'petrol', 'suv', 'fwd', '2TR = Nissan QR25 shared — Xtronic CVT'),
  ('FIAT_500_12FIRE_08_NOW', 'Fiat', '500', '1.2 FIRE', '312', 2008, NULL, 'FIAT_FIRE_12_14', 'petrol', 'hatch', 'fwd', '1.2 8v FIRE — Dualogic AMT common'),
  ('FIAT_PUNTO_14FIRE_06_13', 'Fiat', 'Punto', '1.4 FIRE', '199', 2006, 2013, 'FIAT_FIRE_12_14', 'petrol', 'hatch', 'fwd', 'Grande Punto 1.4 8v/16v'),
  ('FIAT_ABARTH595_14T_12_NOW', 'Fiat', '595', 'Abarth 1.4T', '312', 2012, NULL, 'FIAT_MULTIAIR_14T', 'petrol', 'hatch', 'fwd', 'Abarth 595/695 — registry make ABARTH normalises to Fiat'),
  ('FIAT_DUCATO_23MJ_07_NOW', 'Fiat', 'Ducato', '2.3 MultiJet', '250', 2007, NULL, 'FIAT_F1A_23_MULTIJET', 'diesel', 'van', 'fwd', 'NZ motorhome base — F1AE/F1AGL')
ON CONFLICT (vehicle_id) DO NOTHING;

INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'PEU_208_12PT_15_NOW', 'Peugeot', '208', '1.2 PureTech', 2015, NULL, 'EB2DT', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'PEU_208_12PT_15_NOW' AND alias_variant = '1.2 PureTech');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'PEU_2008_12PT_15_NOW', 'Peugeot', '2008', '1.2 PureTech', 2015, NULL, 'EB2DT', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'PEU_2008_12PT_15_NOW' AND alias_variant = '1.2 PureTech');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'PEU_308_12PT_15_21', 'Peugeot', '308', '1.2 PureTech', 2015, 2021, 'EB2DT', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'PEU_308_12PT_15_21' AND alias_variant = '1.2 PureTech');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'CIT_C3_12PT_17_NOW', 'Citroen', 'C3', '1.2 PureTech', 2017, NULL, 'EB2DT', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'CIT_C3_12PT_17_NOW' AND alias_variant = '1.2 PureTech');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'PEU_308_16THP_08_14', 'Peugeot', '308', '1.6 THP', 2008, 2014, 'EP6DT', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'PEU_308_16THP_08_14' AND alias_variant = '1.6 THP');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'PEU_208GTI_16THP_13_18', 'Peugeot', '208', 'GTi', 2013, 2018, 'EP6FDTX', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'PEU_208GTI_16THP_13_18' AND alias_variant = 'GTi');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'CIT_DS3_16THP_10_16', 'Citroen', 'DS3', '1.6 THP', 2010, 2016, 'EP6DT', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'CIT_DS3_16THP_10_16' AND alias_variant = '1.6 THP');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'CIT_BERLINGO_16HDI_10_18', 'Citroen', 'Berlingo', '1.6 HDi', 2010, 2018, 'DV6', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'CIT_BERLINGO_16HDI_10_18' AND alias_variant = '1.6 HDi');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'PEU_PARTNER_16HDI_10_18', 'Peugeot', 'Partner', '1.6 HDi', 2010, 2018, 'DV6', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'PEU_PARTNER_16HDI_10_18' AND alias_variant = '1.6 HDi');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'PEU_3008_20HDI_17_NOW', 'Peugeot', '3008', '2.0 BlueHDi', 2017, NULL, 'DW10F', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'PEU_3008_20HDI_17_NOW' AND alias_variant = '2.0 BlueHDi');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'CIT_C5_20HDI_08_17', 'Citroen', 'C5', '2.0 HDi', 2008, 2017, 'DW10', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'CIT_C5_20HDI_08_17' AND alias_variant = '2.0 HDi');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'REN_CLIO4_09TCE_13_19', 'Renault', 'Clio', '0.9 TCe', 2013, 2019, 'H4Bt', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'REN_CLIO4_09TCE_13_19' AND alias_variant = '0.9 TCe');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'REN_CAPTUR_13TCE_20_NOW', 'Renault', 'Captur', '1.3 TCe', 2020, NULL, 'H5Ht', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'REN_CAPTUR_13TCE_20_NOW' AND alias_variant = '1.3 TCe');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'REN_ARKANA_13TCE_21_NOW', 'Renault', 'Arkana', '1.3 TCe', 2021, NULL, 'H5Ht', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'REN_ARKANA_13TCE_21_NOW' AND alias_variant = '1.3 TCe');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'REN_CLIO3_16_06_13', 'Renault', 'Clio', '1.6', 2006, 2013, 'K4M', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'REN_CLIO3_16_06_13' AND alias_variant = '1.6');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'REN_MEGANE2_16_04_09', 'Renault', 'Megane', '1.6', 2004, 2009, 'K4M', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'REN_MEGANE2_16_04_09' AND alias_variant = '1.6');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'REN_CLIO4_15DCI_13_19', 'Renault', 'Clio', '1.5 dCi', 2013, 2019, 'K9K', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'REN_CLIO4_15DCI_13_19' AND alias_variant = '1.5 dCi');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'REN_MEGANE3_20_08_16', 'Renault', 'Megane', '2.0', 2008, 2016, 'M4R', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'REN_MEGANE3_20_08_16' AND alias_variant = '2.0');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'REN_KOLEOS_25_16_NOW', 'Renault', 'Koleos', '2.5', 2016, NULL, 'QR25DE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'REN_KOLEOS_25_16_NOW' AND alias_variant = '2.5');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FIAT_500_12FIRE_08_NOW', 'Fiat', '500', '1.2', 2008, NULL, '169A4000', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FIAT_500_12FIRE_08_NOW' AND alias_variant = '1.2');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FIAT_PUNTO_14FIRE_06_13', 'Fiat', 'Punto', '1.4', 2006, 2013, '350A1000', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FIAT_PUNTO_14FIRE_06_13' AND alias_variant = '1.4');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FIAT_ABARTH595_14T_12_NOW', 'Fiat', '595', 'Abarth', 2012, NULL, '312A3000', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FIAT_ABARTH595_14T_12_NOW' AND alias_variant = 'Abarth');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FIAT_DUCATO_23MJ_07_NOW', 'Fiat', 'Ducato', '2.3 MultiJet', 2007, NULL, 'F1AE3481', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FIAT_DUCATO_23MJ_07_NOW' AND alias_variant = '2.3 MultiJet');

INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes) VALUES
  ('Peugeot', '208', '1.2 PureTech', 'A9/P21', 'EB2DT', 2015, NULL, 'petrol', 1200, 'auto', 'fwd', 'hatch', 'belt', 'EB2 wet belt — inspect every service'),
  ('Peugeot', '2008', '1.2 PureTech', 'A94/P24', 'EB2DT', 2015, NULL, 'petrol', 1200, 'auto', 'fwd', 'suv', 'belt', 'EB2 wet belt'),
  ('Peugeot', '308', '1.2 PureTech', 'T9', 'EB2DT', 2015, 2021, 'petrol', 1200, 'auto', 'fwd', 'hatch', 'belt', 'EB2 wet belt'),
  ('Citroen', 'C3', '1.2 PureTech', 'B618', 'EB2DT', 2017, NULL, 'petrol', 1200, 'auto', 'fwd', 'hatch', 'belt', 'EB2 wet belt'),
  ('Peugeot', '308', '1.6 THP', 'T7', 'EP6DT', 2008, 2014, 'petrol', 1600, 'auto', 'fwd', 'hatch', 'chain', 'EP6DT Prince shared with Mini N14 — same family data'),
  ('Peugeot', '208', 'GTi 1.6 THP', 'A9', 'EP6FDTX', 2013, 2018, 'petrol', 1600, 'manual', 'fwd', 'hatch', 'chain', 'EP6FDTX 147kW — Prince family'),
  ('Citroen', 'DS3', '1.6 THP', 'A55', 'EP6DT', 2010, 2016, 'petrol', 1600, 'manual', 'fwd', 'hatch', 'chain', 'EP6DT Prince family'),
  ('Citroen', 'Berlingo', '1.6 HDi', 'B9', 'DV6', 2010, 2018, 'diesel', 1600, 'manual', 'fwd', 'van', 'belt', 'DV6 — common NZ trade van'),
  ('Peugeot', 'Partner', '1.6 HDi', 'B9', 'DV6', 2010, 2018, 'diesel', 1600, 'manual', 'fwd', 'van', 'belt', 'DV6'),
  ('Peugeot', '3008', '2.0 BlueHDi', 'P84', 'DW10F', 2017, NULL, 'diesel', 2000, 'auto', 'fwd', 'suv', 'belt', 'DW10F GT — EAT6/EAT8'),
  ('Citroen', 'C5', '2.0 HDi', 'X7', 'DW10', 2008, 2017, 'diesel', 2000, 'auto', 'fwd', 'sedan', 'belt', 'DW10 — hydropneumatic suspension note'),
  ('Renault', 'Clio', '0.9 TCe', 'X98', 'H4Bt', 2013, 2019, 'petrol', 900, 'manual', 'fwd', 'hatch', 'chain', 'H4Bt 3cyl'),
  ('Renault', 'Captur', '1.3 TCe', 'XJB', 'H5Ht', 2020, NULL, 'petrol', 1300, 'dct', 'fwd', 'suv', 'chain', 'H5Ht shared Mercedes M282 — EDC'),
  ('Renault', 'Arkana', '1.3 TCe', 'LJL', 'H5Ht', 2021, NULL, 'petrol', 1300, 'dct', 'fwd', 'suv', 'chain', 'H5Ht + EDC'),
  ('Renault', 'Clio', '1.6', 'X85', 'K4M', 2006, 2013, 'petrol', 1600, 'auto', 'fwd', 'hatch', 'belt', 'K4M + DP0 4sp auto'),
  ('Renault', 'Megane', '1.6', 'X84', 'K4M', 2004, 2009, 'petrol', 1600, 'auto', 'fwd', 'hatch', 'belt', 'K4M + DP0'),
  ('Renault', 'Clio', '1.5 dCi', 'X98', 'K9K', 2013, 2019, 'diesel', 1500, 'manual', 'fwd', 'hatch', 'belt', 'K9K'),
  ('Renault', 'Megane', '2.0 CVT', 'X95', 'M4R', 2008, 2016, 'petrol', 2000, 'cvt', 'fwd', 'hatch', 'chain', 'M4R = Nissan MR20 shared — CVT'),
  ('Renault', 'Koleos', '2.5 CVT', 'HZG', 'QR25DE', 2016, NULL, 'petrol', 2500, 'cvt', 'fwd', 'suv', 'chain', '2TR = Nissan QR25 shared — Xtronic CVT'),
  ('Fiat', '500', '1.2 FIRE', '312', '169A4000', 2008, NULL, 'petrol', 1200, 'manual', 'fwd', 'hatch', 'belt', '1.2 8v FIRE — Dualogic AMT common'),
  ('Fiat', 'Punto', '1.4 FIRE', '199', '350A1000', 2006, 2013, 'petrol', 1400, 'manual', 'fwd', 'hatch', 'belt', 'Grande Punto 1.4 8v/16v'),
  ('Fiat', '595', 'Abarth 1.4T', '312', '312A3000', 2012, NULL, 'petrol', 1400, 'manual', 'fwd', 'hatch', 'belt', 'Abarth 595/695 — registry make ABARTH normalises to Fiat'),
  ('Fiat', 'Ducato', '2.3 MultiJet', '250', 'F1AE3481', 2007, NULL, 'diesel', 2300, 'manual', 'fwd', 'van', 'chain', 'NZ motorhome base — F1AE/F1AGL')
ON CONFLICT (make, model, submodel, chassis_code, engine_code, year_from) DO NOTHING;
