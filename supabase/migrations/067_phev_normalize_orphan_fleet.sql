SET search_path TO public;

-- ============================================================
-- TORQUED — Migration 067: PHEV model normalization + orphan-family fleet rows
-- 1. Golf GTE / Passat GTE / A3 e-tron fleet rows moved to base model names
--    (model "Golf" + submodel "GTE 1.4 PHEV") with trim aliases, so registry
--    model "GOLF" + variant "GTE" resolves the DQ400e family instead of an
--    arbitrary same-model row (was pricing GTE as DQ200 1.4 TSI).
-- 2. Fleet vehicles + aliases + vehicle_models for the 44 engine families
--    that had zero fleet rows (entire migration 053 Ford/Mazda set was
--    unreachable via plate lookup).
-- Applied directly to production 2026-07-23 (data-only).
-- ============================================================

UPDATE public.fleet_vehicles SET model = 'Golf',   submodel = 'GTE 1.4 PHEV'    WHERE vehicle_id = 'VW_GOLF_GTE_14_20';
UPDATE public.fleet_vehicles SET model = 'Passat', submodel = 'GTE 1.4 PHEV'    WHERE vehicle_id = 'VW_PASSAT_B8_GTE_15_NOW';
UPDATE public.fleet_vehicles SET model = 'A3',     submodel = 'e-tron 1.4 PHEV' WHERE vehicle_id = 'AUDI_A3_ETRON_8V_14_20';

INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, source)
SELECT fv.vehicle_id, fv.make, 'Golf', 'GTE', fv.year_from, fv.year_to, 'manual' FROM public.fleet_vehicles fv
WHERE fv.vehicle_id = 'VW_GOLF_GTE_14_20' AND NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases a WHERE a.vehicle_id = 'VW_GOLF_GTE_14_20' AND a.alias_variant = 'GTE');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, source)
SELECT fv.vehicle_id, fv.make, 'Passat', 'GTE', fv.year_from, fv.year_to, 'manual' FROM public.fleet_vehicles fv
WHERE fv.vehicle_id = 'VW_PASSAT_B8_GTE_15_NOW' AND NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases a WHERE a.vehicle_id = 'VW_PASSAT_B8_GTE_15_NOW' AND a.alias_variant = 'GTE');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, source)
SELECT fv.vehicle_id, fv.make, 'A3', 'e-tron', fv.year_from, fv.year_to, 'manual' FROM public.fleet_vehicles fv
WHERE fv.vehicle_id = 'AUDI_A3_ETRON_8V_14_20' AND NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases a WHERE a.vehicle_id = 'AUDI_A3_ETRON_8V_14_20' AND a.alias_variant = 'e-tron');

INSERT INTO public.fleet_vehicles (vehicle_id, make, model, submodel, chassis_code, year_from, year_to, engine_family_id, fuel, body_type, drivetrain, notes) VALUES
  ('FORD_FIESTA_MK6_14_02_08', 'Ford', 'Fiesta', '1.3/1.4', 'MK6', 2002, 2008, 'FORD_SIGMA_13_14', 'petrol', 'hatch', 'fwd', 'Sigma 1.3/1.4 — belt'),
  ('FORD_FIESTA_MK67_16_05_17', 'Ford', 'Fiesta', '1.6', 'MK6/7', 2005, 2017, 'FORD_DURATEC_16_SIGMA', 'petrol', 'hatch', 'fwd', 'Duratec 1.6 Ti-VCT'),
  ('FORD_FOCUS_MK1_18_98_05', 'Ford', 'Focus', '1.8 Zetec', 'MK1', 1998, 2005, 'FORD_ZETEC_18_ZETEC_E', 'petrol', 'hatch', 'fwd', 'Zetec-E 1.8 — belt'),
  ('FORD_MONDEO_MK3_20_00_07', 'Ford', 'Mondeo', '2.0 Zetec', 'MK3', 2000, 2007, 'FORD_ZETEC_20_ZETEC_E', 'petrol', 'sedan', 'fwd', 'Zetec/Duratec HE 2.0'),
  ('FORD_MONDEO_MK4_20_07_14', 'Ford', 'Mondeo', '2.0', 'MK4', 2007, 2014, 'FORD_DURATEC_20_MZR', 'petrol', 'sedan', 'fwd', 'Duratec 2.0 MZR-shared — chain'),
  ('FORD_MONDEO_MK4_23_07_14', 'Ford', 'Mondeo', '2.3', 'MK4', 2007, 2014, 'FORD_DURATEC_23_MZR', 'petrol', 'sedan', 'fwd', 'Duratec 2.3 — chain'),
  ('FORD_FIESTA_MK7_10T_13_17', 'Ford', 'Fiesta', '1.0 EcoBoost', 'MK7', 2013, 2017, 'FORD_ECOBOOST_10_3CYL', 'petrol', 'hatch', 'fwd', '1.0T 3cyl — BELT, often missed'),
  ('FORD_FOCUS_MK34_15T_15_NOW', 'Ford', 'Focus', '1.5 EcoBoost', 'MK3/4', 2015, NULL, 'FORD_ECOBOOST_15_4CYL', 'petrol', 'hatch', 'fwd', '1.5T — chain'),
  ('FORD_FIESTA_ST_16T_13_17', 'Ford', 'Fiesta', 'ST 1.6T', 'MK7', 2013, 2017, 'FORD_ECOBOOST_16_TURBO', 'petrol', 'hatch', 'fwd', '1.6 EcoBoost ST — chain'),
  ('FORD_FOCUS_ST_20T_12_18', 'Ford', 'Focus', 'ST 2.0T', 'MK3', 2012, 2018, 'FORD_ECOBOOST_20_4CYL', 'petrol', 'hatch', 'fwd', '2.0 EcoBoost ST — chain'),
  ('FORD_MUSTANG_23T_15_NOW', 'Ford', 'Mustang', '2.3 EcoBoost', 'S550/S650', 2015, NULL, 'FORD_ECOBOOST_23_4CYL', 'petrol', 'coupe', 'rwd', '2.3T — chain'),
  ('FORD_FIESTA_16TDCI_08_17', 'Ford', 'Fiesta', '1.6 TDCi', 'MK6/7', 2008, 2017, 'FORD_DURATORQ_TDCI_16', 'diesel', 'hatch', 'fwd', 'DV6-shared 1.6 TDCi — belt'),
  ('FORD_FOCUS_18TDCI_05_11', 'Ford', 'Focus', '1.8 TDCi', 'MK2', 2005, 2011, 'FORD_DURATORQ_TDCI_18', 'diesel', 'hatch', 'fwd', '1.8 TDCi — belt'),
  ('FORD_MONDEO_20TDCI_07_14', 'Ford', 'Mondeo', '2.0 TDCi', 'MK4', 2007, 2014, 'FORD_DURATORQ_TDCI_20', 'diesel', 'wagon', 'fwd', '2.0 TDCi — belt, big NZ volume'),
  ('FORD_TRANSIT_24TDCI_00_14', 'Ford', 'Transit', '2.4 TDCi', 'MK6/7', 2000, 2014, 'FORD_DURATORQ_TDCI_24_TRANSIT', 'diesel', 'van', 'rwd', '2.4 TDCi — belt'),
  ('FORD_FIESTA_15D_18_NOW', 'Ford', 'Fiesta', '1.5 EcoBlue', 'MK8', 2018, NULL, 'FORD_ECOBLUE_15_DIESEL', 'diesel', 'hatch', 'fwd', '1.5 EcoBlue — belt'),
  ('FORD_TRANSIT_20D_16_NOW', 'Ford', 'Transit', '2.0 EcoBlue', 'MK8', 2016, NULL, 'FORD_ECOBLUE_20_DIESEL', 'diesel', 'van', 'fwd', '2.0 EcoBlue — belt'),
  ('FORD_MONDEO_ST220_25V6_02_07', 'Ford', 'Mondeo', 'ST220 2.5/3.0 V6', 'MK3', 2002, 2007, 'FORD_MONDEO_25_DURATEC_V6', 'petrol', 'sedan', 'fwd', 'Duratec V6 — belt, rear bank labour'),
  ('FORD_KUGA_25T_08_12', 'Ford', 'Kuga', '2.5T', 'MK1', 2008, 2012, 'FORD_KUGA_25_DURATEC', 'petrol', 'suv', 'awd', 'Volvo-shared 2.5 — chain'),
  ('FORD_ESCORT_16_95_01', 'Ford', 'Escort', '1.6', 'MK6', 1995, 2001, 'FORD_ESCORT_ZETEC_16', 'petrol', 'hatch', 'fwd', 'Zetec-E 1.6 — belt'),
  ('MAZ_3_BK_16_03_09', 'Mazda', 'Mazda3', '1.6 (BK)', 'BK', 2003, 2009, 'MAZ_MZR_16_BK', 'petrol', 'hatch', 'fwd', 'MZR L8 1.6 — chain'),
  ('MAZ_3_BKBL_20_03_13', 'Mazda', 'Mazda3', '2.0 (BK/BL)', 'BK/BL', 2003, 2013, 'MAZ_MZR_20_LF', 'petrol', 'hatch', 'fwd', 'MZR LF 2.0 — chain'),
  ('MAZ_6_GG_23_02_08', 'Mazda', 'Mazda6', '2.3 (GG)', 'GG', 2002, 2008, 'MAZ_MZR_23_L3', 'petrol', 'sedan', 'fwd', 'MZR L3 2.3 — chain'),
  ('MAZ_6_GG_20D_02_08', 'Mazda', 'Mazda6', '2.0 Diesel', 'GG', 2002, 2008, 'MAZ_MZRCD_20_DIESEL', 'diesel', 'sedan', 'fwd', 'MZR-CD 2.0 — belt'),
  ('MAZ_6_GH_22D_08_12', 'Mazda', 'Mazda6', '2.2 Diesel', 'GH', 2008, 2012, 'MAZ_MZRCD_22_DIESEL', 'diesel', 'sedan', 'fwd', 'MZR-CD 2.2 — chain, DPF'),
  ('MAZ_6_GJ_25T_18_NOW', 'Mazda', 'Mazda6', '2.5T', 'GJ/GL', 2018, NULL, 'MAZ_SKYACTIVG_25T', 'petrol', 'sedan', 'fwd', 'SkyActiv-G 2.5 Turbo'),
  ('MAZ_3_BP_X20_19_NOW', 'Mazda', 'Mazda3', 'SkyActiv-X 2.0', 'BP', 2019, NULL, 'MAZ_SKYACTIVX_20', 'petrol', 'hatch', 'fwd', 'SPCCI mild hybrid'),
  ('MAZ_CX3_18D_18_NOW', 'Mazda', 'CX-3', '1.8 Diesel', 'DK', 2018, NULL, 'MAZ_SKYACTIVD_18', 'diesel', 'suv', 'fwd', 'SkyActiv-D 1.8'),
  ('MAZ_BT50_TF_30_20_NOW', 'Mazda', 'BT-50', '3.0 Diesel', 'TF', 2020, NULL, 'MAZ_BT50_TF_30_DIESEL', 'diesel', 'ute', '4wd', 'Isuzu 4JJ3-shared'),
  ('MAZ_6_MPS_23T_05_07', 'Mazda', 'Mazda6', 'MPS 2.3T', 'GG', 2005, 2007, 'MAZ_MAZDA6_GG_L_23_MPS', 'petrol', 'sedan', 'awd', 'L3-VDT DISI turbo'),
  ('MAZ_626_18_97_02', 'Mazda', '626', '1.8', 'GF', 1997, 2002, 'MAZ_FS_18_LEGACY', 'petrol', 'sedan', 'fwd', 'FS 1.8 — belt'),
  ('MAZ_MPV_30V6_99_06', 'Mazda', 'MPV', '3.0 V6', 'LW', 1999, 2006, 'MAZ_KL_30_V6', 'petrol', 'van', 'fwd', 'KL/AJ V6 — belt'),
  ('MAZ_BOUNTY_25TD_99_06', 'Mazda', 'Bounty', '2.5 TD', 'UN', 1999, 2006, 'MAZ_WL_25_TURBODIESEL', 'diesel', 'ute', '4wd', 'WL-T 2.5 — belt'),
  ('MAZ_3_BP_20MHEV_19_NOW', 'Mazda', 'Mazda3', '2.0 M-Hybrid', 'BP', 2019, NULL, 'MAZ_CX5_KF_20_SKYACTIVG_MHEV', 'hybrid_petrol', 'hatch', 'fwd', '24V mild hybrid'),
  ('MAZ_CX60_33D_22_NOW', 'Mazda', 'CX-60', '3.3 Diesel', 'KH', 2022, NULL, 'MAZ_CX60_33_INLINE6_DIESEL', 'diesel', 'suv', 'awd', 'e-SkyActiv D inline-6 48V'),
  ('MAZ_CX90_33T_23_NOW', 'Mazda', 'CX-90', '3.3 Turbo', 'KK', 2023, NULL, 'MAZ_CX90_34_TURBO_INLINE6', 'petrol', 'suv', 'awd', 'e-SkyActiv G inline-6 48V'),
  ('MAZ_CX60_PHEV_22_NOW', 'Mazda', 'CX-60', '2.5 PHEV', 'KH', 2022, NULL, 'MAZ_PEHEV_25_CX60', 'phev', 'suv', 'awd', '17.8kWh + 2.5 SkyActiv-G'),
  ('MAZ_MX30_BEV_20_NOW', 'Mazda', 'MX-30', 'BEV', 'DR', 2020, NULL, 'MAZ_MX30_BEV', 'bev', 'suv', 'fwd', '35.5kWh BEV'),
  ('MAZ_MX5_ND_15_15_NOW', 'Mazda', 'MX-5', '1.5 (ND)', 'ND', 2015, NULL, 'MAZ_RF_16_SKYACTIVG_MX5', 'petrol', 'convertible', 'rwd', 'SkyActiv-G 1.5'),
  ('HON_ACCORD_F23_98_02', 'Honda', 'Accord', '2.3 VTi', 'CG', 1998, 2002, 'HON_F_SERIES_20_22_23', 'petrol', 'sedan', 'fwd', 'F23A — belt'),
  ('MIT_PAJERO_35V6_99_06', 'Mitsubishi', 'Pajero', '3.5 V6', 'NM/NP', 1999, 2006, 'MIT_6G72_6G74_V6', 'petrol', 'suv', '4wd', '6G74 — belt'),
  ('MIT_LANCER_16_96_07', 'Mitsubishi', 'Lancer', '1.5/1.6', 'CE/CS', 1996, 2007, 'MIT_4G15_4G18_15_16', 'petrol', 'sedan', 'fwd', '4G15/4G18 — belt'),
  ('SUB_OUTBACK_20D_09_14', 'Subaru', 'Outback', '2.0 Diesel', 'BR', 2009, 2014, 'SUB_EE20_20_DIESEL', 'diesel', 'wagon', 'awd', 'EE20 boxer diesel — chain'),
  ('HOL_COMMODORE_38_95_04', 'Holden', 'Commodore', '3.8 V6', 'VS/VT/VX/VY', 1995, 2004, 'HOL_ECOTEC_38_V6', 'petrol', 'sedan', 'rwd', 'Ecotec L36 — chain (internal)')
ON CONFLICT (vehicle_id) DO NOTHING;

INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_FIESTA_MK6_14_02_08', 'Ford', 'Fiesta', '1.4', 2002, 2008, 'FXJA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_FIESTA_MK6_14_02_08' AND alias_variant = '1.4');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_FIESTA_MK67_16_05_17', 'Ford', 'Fiesta', '1.6', 2005, 2017, 'HXJA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_FIESTA_MK67_16_05_17' AND alias_variant = '1.6');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_FOCUS_MK1_18_98_05', 'Ford', 'Focus', '1.8', 1998, 2005, 'EYDB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_FOCUS_MK1_18_98_05' AND alias_variant = '1.8');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_MONDEO_MK3_20_00_07', 'Ford', 'Mondeo', '2.0', 2000, 2007, 'CJBA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_MONDEO_MK3_20_00_07' AND alias_variant = '2.0');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_MONDEO_MK4_20_07_14', 'Ford', 'Mondeo', '2.0', 2007, 2014, 'AOBA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_MONDEO_MK4_20_07_14' AND alias_variant = '2.0');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_MONDEO_MK4_23_07_14', 'Ford', 'Mondeo', '2.3', 2007, 2014, 'SEBA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_MONDEO_MK4_23_07_14' AND alias_variant = '2.3');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_FIESTA_MK7_10T_13_17', 'Ford', 'Fiesta', '1.0', 2013, 2017, 'M1JE', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_FIESTA_MK7_10T_13_17' AND alias_variant = '1.0');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_FOCUS_MK34_15T_15_NOW', 'Ford', 'Focus', '1.5', 2015, NULL, 'M8DB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_FOCUS_MK34_15T_15_NOW' AND alias_variant = '1.5');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_FIESTA_ST_16T_13_17', 'Ford', 'Fiesta', 'ST', 2013, 2017, 'JTJA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_FIESTA_ST_16T_13_17' AND alias_variant = 'ST');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_FOCUS_ST_20T_12_18', 'Ford', 'Focus', 'ST', 2012, 2018, 'R9DA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_FOCUS_ST_20T_12_18' AND alias_variant = 'ST');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_MUSTANG_23T_15_NOW', 'Ford', 'Mustang', '2.3', 2015, NULL, 'H23', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_MUSTANG_23T_15_NOW' AND alias_variant = '2.3');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_FIESTA_16TDCI_08_17', 'Ford', 'Fiesta', '1.6 TDCi', 2008, 2017, 'HHJC', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_FIESTA_16TDCI_08_17' AND alias_variant = '1.6 TDCi');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_FOCUS_18TDCI_05_11', 'Ford', 'Focus', '1.8 TDCi', 2005, 2011, 'KKDA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_FOCUS_18TDCI_05_11' AND alias_variant = '1.8 TDCi');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_MONDEO_20TDCI_07_14', 'Ford', 'Mondeo', '2.0 TDCi', 2007, 2014, 'QXBA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_MONDEO_20TDCI_07_14' AND alias_variant = '2.0 TDCi');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_TRANSIT_24TDCI_00_14', 'Ford', 'Transit', '2.4 TDCi', 2000, 2014, 'PHFA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_TRANSIT_24TDCI_00_14' AND alias_variant = '2.4 TDCi');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_FIESTA_15D_18_NOW', 'Ford', 'Fiesta', '1.5 EcoBlue', 2018, NULL, 'XUJB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_FIESTA_15D_18_NOW' AND alias_variant = '1.5 EcoBlue');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_TRANSIT_20D_16_NOW', 'Ford', 'Transit', '2.0 EcoBlue', 2016, NULL, 'YMF6', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_TRANSIT_20D_16_NOW' AND alias_variant = '2.0 EcoBlue');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_MONDEO_ST220_25V6_02_07', 'Ford', 'Mondeo', 'ST220', 2002, 2007, 'MEBA', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_MONDEO_ST220_25V6_02_07' AND alias_variant = 'ST220');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_KUGA_25T_08_12', 'Ford', 'Kuga', '2.5', 2008, 2012, 'HYDB', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_KUGA_25T_08_12' AND alias_variant = '2.5');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'FORD_ESCORT_16_95_01', 'Ford', 'Escort', '1.6', 1995, 2001, 'L1E', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'FORD_ESCORT_16_95_01' AND alias_variant = '1.6');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_3_BK_16_03_09', 'Mazda', 'Mazda3', '1.6', 2003, 2009, 'L8', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_3_BK_16_03_09' AND alias_variant = '1.6');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_3_BKBL_20_03_13', 'Mazda', 'Mazda3', '2.0', 2003, 2013, 'LF', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_3_BKBL_20_03_13' AND alias_variant = '2.0');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_6_GG_23_02_08', 'Mazda', 'Mazda6', '2.3', 2002, 2008, 'L3', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_6_GG_23_02_08' AND alias_variant = '2.3');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_6_GG_20D_02_08', 'Mazda', 'Mazda6', '2.0 D', 2002, 2008, 'RF', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_6_GG_20D_02_08' AND alias_variant = '2.0 D');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_6_GH_22D_08_12', 'Mazda', 'Mazda6', '2.2 D', 2008, 2012, 'R2', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_6_GH_22D_08_12' AND alias_variant = '2.2 D');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_6_GJ_25T_18_NOW', 'Mazda', 'Mazda6', '2.5T', 2018, NULL, 'PY-VPTS', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_6_GJ_25T_18_NOW' AND alias_variant = '2.5T');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_3_BP_X20_19_NOW', 'Mazda', 'Mazda3', 'X20', 2019, NULL, 'HF-VPH', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_3_BP_X20_19_NOW' AND alias_variant = 'X20');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_CX3_18D_18_NOW', 'Mazda', 'CX-3', '1.8 D', 2018, NULL, 'S8-VPTS', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_CX3_18D_18_NOW' AND alias_variant = '1.8 D');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_BT50_TF_30_20_NOW', 'Mazda', 'BT-50', '3.0 D', 2020, NULL, '4JJ3', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_BT50_TF_30_20_NOW' AND alias_variant = '3.0 D');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_6_MPS_23T_05_07', 'Mazda', 'Mazda6', 'MPS', 2005, 2007, 'L3-VDT', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_6_MPS_23T_05_07' AND alias_variant = 'MPS');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_626_18_97_02', 'Mazda', '626', '1.8', 1997, 2002, 'FS', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_626_18_97_02' AND alias_variant = '1.8');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_MPV_30V6_99_06', 'Mazda', 'MPV', '3.0 V6', 1999, 2006, 'AJ', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_MPV_30V6_99_06' AND alias_variant = '3.0 V6');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_BOUNTY_25TD_99_06', 'Mazda', 'Bounty', '2.5 TD', 1999, 2006, 'WL-T', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_BOUNTY_25TD_99_06' AND alias_variant = '2.5 TD');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_3_BP_20MHEV_19_NOW', 'Mazda', 'Mazda3', '2.0 MH', 2019, NULL, 'PE-VPSM', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_3_BP_20MHEV_19_NOW' AND alias_variant = '2.0 MH');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_CX60_33D_22_NOW', 'Mazda', 'CX-60', '3.3 D', 2022, NULL, 'T3-VPTS', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_CX60_33D_22_NOW' AND alias_variant = '3.3 D');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_CX90_33T_23_NOW', 'Mazda', 'CX-90', '3.3T', 2023, NULL, 'T3-VPT', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_CX90_33T_23_NOW' AND alias_variant = '3.3T');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_CX60_PHEV_22_NOW', 'Mazda', 'CX-60', 'PHEV', 2022, NULL, 'PY-VPS', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_CX60_PHEV_22_NOW' AND alias_variant = 'PHEV');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_MX30_BEV_20_NOW', 'Mazda', 'MX-30', 'EV', 2020, NULL, NULL, 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_MX30_BEV_20_NOW' AND alias_variant = 'EV');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MAZ_MX5_ND_15_15_NOW', 'Mazda', 'MX-5', '1.5', 2015, NULL, 'P5-VPR', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MAZ_MX5_ND_15_15_NOW' AND alias_variant = '1.5');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HON_ACCORD_F23_98_02', 'Honda', 'Accord', '2.3', 1998, 2002, 'F23A', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HON_ACCORD_F23_98_02' AND alias_variant = '2.3');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MIT_PAJERO_35V6_99_06', 'Mitsubishi', 'Pajero', '3.5 V6', 1999, 2006, '6G74', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MIT_PAJERO_35V6_99_06' AND alias_variant = '3.5 V6');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'MIT_LANCER_16_96_07', 'Mitsubishi', 'Lancer', '1.6', 1996, 2007, '4G18', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'MIT_LANCER_16_96_07' AND alias_variant = '1.6');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'SUB_OUTBACK_20D_09_14', 'Subaru', 'Outback', '2.0 D', 2009, 2014, 'EE20', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'SUB_OUTBACK_20D_09_14' AND alias_variant = '2.0 D');
INSERT INTO public.ef_vehicle_aliases (vehicle_id, alias_make, alias_model, alias_variant, year_from, year_to, engine_code, source)
SELECT 'HOL_COMMODORE_38_95_04', 'Holden', 'Commodore', '3.8', 1995, 2004, 'L36', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.ef_vehicle_aliases WHERE vehicle_id = 'HOL_COMMODORE_38_95_04' AND alias_variant = '3.8');

INSERT INTO public.vehicle_models (make, model, submodel, chassis_code, engine_code, year_from, year_to, fuel, engine_cc, transmission, drive, body_type, timing_drive, notes) VALUES
  ('Ford', 'Fiesta', '1.3/1.4', 'MK6', 'FXJA', 2002, 2008, 'petrol', 1400, 'auto', 'fwd', 'hatch', 'belt', 'Sigma 1.3/1.4 — belt'),
  ('Ford', 'Fiesta', '1.6', 'MK6/7', 'HXJA', 2005, 2017, 'petrol', 1600, 'auto', 'fwd', 'hatch', 'belt', 'Duratec 1.6 Ti-VCT'),
  ('Ford', 'Focus', '1.8 Zetec', 'MK1', 'EYDB', 1998, 2005, 'petrol', 1800, 'manual', 'fwd', 'hatch', 'belt', 'Zetec-E 1.8 — belt'),
  ('Ford', 'Mondeo', '2.0 Zetec', 'MK3', 'CJBA', 2000, 2007, 'petrol', 2000, 'auto', 'fwd', 'sedan', 'belt', 'Zetec/Duratec HE 2.0'),
  ('Ford', 'Mondeo', '2.0', 'MK4', 'AOBA', 2007, 2014, 'petrol', 2000, 'auto', 'fwd', 'sedan', 'chain', 'Duratec 2.0 MZR-shared — chain'),
  ('Ford', 'Mondeo', '2.3', 'MK4', 'SEBA', 2007, 2014, 'petrol', 2300, 'auto', 'fwd', 'sedan', 'chain', 'Duratec 2.3 — chain'),
  ('Ford', 'Fiesta', '1.0 EcoBoost', 'MK7', 'M1JE', 2013, 2017, 'petrol', 1000, 'auto', 'fwd', 'hatch', 'belt', '1.0T 3cyl — BELT, often missed'),
  ('Ford', 'Focus', '1.5 EcoBoost', 'MK3/4', 'M8DB', 2015, NULL, 'petrol', 1500, 'auto', 'fwd', 'hatch', 'chain', '1.5T — chain'),
  ('Ford', 'Fiesta', 'ST 1.6T', 'MK7', 'JTJA', 2013, 2017, 'petrol', 1600, 'manual', 'fwd', 'hatch', 'chain', '1.6 EcoBoost ST — chain'),
  ('Ford', 'Focus', 'ST 2.0T', 'MK3', 'R9DA', 2012, 2018, 'petrol', 2000, 'manual', 'fwd', 'hatch', 'chain', '2.0 EcoBoost ST — chain'),
  ('Ford', 'Mustang', '2.3 EcoBoost', 'S550/S650', 'H23', 2015, NULL, 'petrol', 2300, 'auto', 'rwd', 'coupe', 'chain', '2.3T — chain'),
  ('Ford', 'Fiesta', '1.6 TDCi', 'MK6/7', 'HHJC', 2008, 2017, 'diesel', 1600, 'manual', 'fwd', 'hatch', 'belt', 'DV6-shared 1.6 TDCi — belt'),
  ('Ford', 'Focus', '1.8 TDCi', 'MK2', 'KKDA', 2005, 2011, 'diesel', 1800, 'manual', 'fwd', 'hatch', 'belt', '1.8 TDCi — belt'),
  ('Ford', 'Mondeo', '2.0 TDCi', 'MK4', 'QXBA', 2007, 2014, 'diesel', 2000, 'auto', 'fwd', 'wagon', 'belt', '2.0 TDCi — belt, big NZ volume'),
  ('Ford', 'Transit', '2.4 TDCi', 'MK6/7', 'PHFA', 2000, 2014, 'diesel', 2400, 'manual', 'rwd', 'van', 'belt', '2.4 TDCi — belt'),
  ('Ford', 'Fiesta', '1.5 EcoBlue', 'MK8', 'XUJB', 2018, NULL, 'diesel', 1500, 'manual', 'fwd', 'hatch', 'belt', '1.5 EcoBlue — belt'),
  ('Ford', 'Transit', '2.0 EcoBlue', 'MK8', 'YMF6', 2016, NULL, 'diesel', 2000, 'manual', 'fwd', 'van', 'belt', '2.0 EcoBlue — belt'),
  ('Ford', 'Mondeo', 'ST220 2.5/3.0 V6', 'MK3', 'MEBA', 2002, 2007, 'petrol', 2500, 'manual', 'fwd', 'sedan', 'belt', 'Duratec V6 — belt, rear bank labour'),
  ('Ford', 'Kuga', '2.5T', 'MK1', 'HYDB', 2008, 2012, 'petrol', 2500, 'auto', 'awd', 'suv', 'chain', 'Volvo-shared 2.5 — chain'),
  ('Ford', 'Escort', '1.6', 'MK6', 'L1E', 1995, 2001, 'petrol', 1600, 'manual', 'fwd', 'hatch', 'belt', 'Zetec-E 1.6 — belt'),
  ('Mazda', 'Mazda3', '1.6 (BK)', 'BK', 'L8', 2003, 2009, 'petrol', 1600, 'auto', 'fwd', 'hatch', 'chain', 'MZR L8 1.6 — chain'),
  ('Mazda', 'Mazda3', '2.0 (BK/BL)', 'BK/BL', 'LF', 2003, 2013, 'petrol', 2000, 'auto', 'fwd', 'hatch', 'chain', 'MZR LF 2.0 — chain'),
  ('Mazda', 'Mazda6', '2.3 (GG)', 'GG', 'L3', 2002, 2008, 'petrol', 2300, 'auto', 'fwd', 'sedan', 'chain', 'MZR L3 2.3 — chain'),
  ('Mazda', 'Mazda6', '2.0 Diesel', 'GG', 'RF', 2002, 2008, 'diesel', 2000, 'manual', 'fwd', 'sedan', 'belt', 'MZR-CD 2.0 — belt'),
  ('Mazda', 'Mazda6', '2.2 Diesel', 'GH', 'R2', 2008, 2012, 'diesel', 2200, 'manual', 'fwd', 'sedan', 'chain', 'MZR-CD 2.2 — chain, DPF'),
  ('Mazda', 'Mazda6', '2.5T', 'GJ/GL', 'PY-VPTS', 2018, NULL, 'petrol', 2500, 'auto', 'fwd', 'sedan', 'chain', 'SkyActiv-G 2.5 Turbo'),
  ('Mazda', 'Mazda3', 'SkyActiv-X 2.0', 'BP', 'HF-VPH', 2019, NULL, 'petrol', 2000, 'auto', 'fwd', 'hatch', 'chain', 'SPCCI mild hybrid'),
  ('Mazda', 'CX-3', '1.8 Diesel', 'DK', 'S8-VPTS', 2018, NULL, 'diesel', 1800, 'auto', 'fwd', 'suv', 'chain', 'SkyActiv-D 1.8'),
  ('Mazda', 'BT-50', '3.0 Diesel', 'TF', '4JJ3', 2020, NULL, 'diesel', 3000, 'auto', '4wd', 'ute', 'chain', 'Isuzu 4JJ3-shared'),
  ('Mazda', 'Mazda6', 'MPS 2.3T', 'GG', 'L3-VDT', 2005, 2007, 'petrol', 2300, 'manual', 'awd', 'sedan', 'chain', 'L3-VDT DISI turbo'),
  ('Mazda', '626', '1.8', 'GF', 'FS', 1997, 2002, 'petrol', 1800, 'auto', 'fwd', 'sedan', 'belt', 'FS 1.8 — belt'),
  ('Mazda', 'MPV', '3.0 V6', 'LW', 'AJ', 1999, 2006, 'petrol', 3000, 'auto', 'fwd', 'van', 'belt', 'KL/AJ V6 — belt'),
  ('Mazda', 'Bounty', '2.5 TD', 'UN', 'WL-T', 1999, 2006, 'diesel', 2500, 'manual', '4wd', 'ute', 'belt', 'WL-T 2.5 — belt'),
  ('Mazda', 'Mazda3', '2.0 M-Hybrid', 'BP', 'PE-VPSM', 2019, NULL, 'hybrid', 2000, 'auto', 'fwd', 'hatch', 'chain', '24V mild hybrid'),
  ('Mazda', 'CX-60', '3.3 Diesel', 'KH', 'T3-VPTS', 2022, NULL, 'diesel', 3300, 'auto', 'awd', 'suv', 'chain', 'e-SkyActiv D inline-6 48V'),
  ('Mazda', 'CX-90', '3.3 Turbo', 'KK', 'T3-VPT', 2023, NULL, 'petrol', 3300, 'auto', 'awd', 'suv', 'chain', 'e-SkyActiv G inline-6 48V'),
  ('Mazda', 'CX-60', '2.5 PHEV', 'KH', 'PY-VPS', 2022, NULL, 'phev', 2500, 'auto', 'awd', 'suv', 'chain', '17.8kWh + 2.5 SkyActiv-G'),
  ('Mazda', 'MX-30', 'BEV', 'DR', NULL, 2020, NULL, 'bev', NULL, 'single_speed', 'fwd', 'suv', 'na', '35.5kWh BEV'),
  ('Mazda', 'MX-5', '1.5 (ND)', 'ND', 'P5-VPR', 2015, NULL, 'petrol', 1500, 'manual', 'rwd', 'convertible', 'chain', 'SkyActiv-G 1.5'),
  ('Honda', 'Accord', '2.3 VTi', 'CG', 'F23A', 1998, 2002, 'petrol', 2300, 'auto', 'fwd', 'sedan', 'belt', 'F23A — belt'),
  ('Mitsubishi', 'Pajero', '3.5 V6', 'NM/NP', '6G74', 1999, 2006, 'petrol', 3500, 'auto', '4wd', 'suv', 'belt', '6G74 — belt'),
  ('Mitsubishi', 'Lancer', '1.5/1.6', 'CE/CS', '4G18', 1996, 2007, 'petrol', 1600, 'auto', 'fwd', 'sedan', 'belt', '4G15/4G18 — belt'),
  ('Subaru', 'Outback', '2.0 Diesel', 'BR', 'EE20', 2009, 2014, 'diesel', 2000, 'manual', 'awd', 'wagon', 'belt', 'EE20 boxer diesel — chain'),
  ('Holden', 'Commodore', '3.8 V6', 'VS/VT/VX/VY', 'L36', 1995, 2004, 'petrol', 3800, 'auto', 'rwd', 'sedan', 'chain', 'Ecotec L36 — chain (internal)')
ON CONFLICT (make, model, submodel, chassis_code, engine_code, year_from) DO NOTHING;
