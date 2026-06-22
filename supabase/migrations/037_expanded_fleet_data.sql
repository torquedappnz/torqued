SET search_path TO public;

-- ============================================================
-- TORQUED — Migration 037: Expanded Fleet Data
-- Incorporates: chunk_d_families, chunk_d_vehicles, fluid_pricing,
--   chunk_b_service_schedule, chunk_c_job_times, chunk_e_parts_pricing
-- GST RULES:
--   ef_parts_data.total_job_low/high → NZD GST-INCLUSIVE
--   tier_parts_reference → EX-GST (engine applies ×1.15)
--   fluid_pricing.cost_per_litre → GST-INCLUSIVE (NO ×1.15)
--   refrigerant_cost → EX-GST (engine applies ×1.15)
-- ============================================================

-- ── SECTION 1: Part category slugs ───────────────────────────────────────────

INSERT INTO public.part_categories (slug, display, job_group, is_job, notes) VALUES
  ('brake_pads_front',         'Front brake pads (per axle)',          'brakes',    true, 'pads only per axle'),
  ('brake_pads_rear',          'Rear brake pads (per axle)',           'brakes',    true, 'pads only per axle'),
  ('brake_pads_and_rotors_front','Front brake pads + rotors',          'brakes',    true, 'pads + pair of rotors'),
  ('timing_chain_replacement', 'Timing chain replacement',             'engine',    true, 'chain + guides + tensioner'),
  ('cambelt_boxer',            'Cambelt – boxer engine',               'engine',    true, 'Subaru EJ access penalty'),
  ('cambelt_v6',               'Cambelt – V6 engine',                  'engine',    true, 'rear bank access penalty'),
  ('oil_change',               'Oil & filter change',                  'service',   true, 'oil + filter consumable'),
  ('coolant_flush',            'Coolant flush',                        'cooling',   true, 'drain, flush, refill'),
  ('brake_fluid_flush',        'Brake fluid flush',                    'brakes',    true, 'bleed all corners'),
  ('transmission_service',     'Transmission fluid service',           'driveline', true, 'drain/fill ATF or CVT'),
  ('dsg_service',              'DSG / DCT service',                    'driveline', true, 'DSG oil + filter'),
  ('spark_plugs',              'Spark plugs (set)',                    'engine',    true, 'full set'),
  ('spark_plugs_v6',           'Spark plugs – V6 (set)',               'engine',    true, '6-plug set, rear bank access'),
  ('water_pump_standalone',    'Water pump (standalone)',              'cooling',   true, 'not bundled with cambelt'),
  ('aircon_regas',             'Air conditioning regas',               'hvac',      true, 'R134a or R1234yf'),
  ('12v_battery',              '12V battery replacement',              'electrical',true, 'supply + fit'),
  ('ignition_coil',            'Ignition coil (each)',                 'engine',    true, 'per coil'),
  ('cabin_filter',             'Cabin / pollen filter',                'hvac',      true, 'cabin air filter'),
  ('air_filter',               'Engine air filter',                    'engine',    true, 'intake air filter'),
  ('front_shock_absorber',     'Front shock absorber (each)',          'suspension',true, 'per side'),
  ('control_arm',              'Control arm (each)',                   'suspension',true, 'with bushes'),
  ('wheel_bearing',            'Wheel bearing (each)',                 'driveline', true, 'per corner'),
  ('cv_joint',                 'CV joint / driveshaft',                'driveline', true, 'outer CV or shaft'),
  ('cabin_pollen_wiper_set',   'Wiper blade pair',                    'body',      true, 'pair'),
  ('ev_cabin_filter',          'EV cabin filter',                      'hvac',      true, 'Tesla/BYD/Hyundai EV'),
  ('hv_coolant_service',       'HV inverter coolant service',          'ev_hybrid', true, 'inverter/battery loop')
ON CONFLICT (slug) DO NOTHING;

-- ── SECTION 2: New engine families (chunk_d) ─────────────────────────────────

INSERT INTO public.engine_families (
  family_id, common_name, manufacturer,
  displacement_l, cylinders, fuel, timing_type,
  cambelt_interval_km, cambelt_interval_years,
  oil_spec, oil_capacity_l, coolant_spec,
  segment_tier, service_interval_km, service_interval_months, notes
) VALUES
  -- Land Rover / Range Rover
  ('LR_INGENIUM_20_DIESEL','JLR Ingenium 2.0L Diesel (AJ200D)','Land Rover',
   2.0,4,'diesel','wet_belt',240000,NULL,
   '0W-20 / 5W-30 ACEA C2 (STJLR.03.5007)',6.0,'JLR OAT coolant (orange)',
   'luxury',16000,12,
   'Discovery Sport L550, Range Rover Evoque L538/L551, Range Rover Velar, Disco 5 (4cyl), Jaguar XE/XF/F-Pace 2.0D. WET BELT — the big gotcha.'),
  ('LR_INGENIUM_20_PETROL','JLR Ingenium 2.0L Petrol (AJ200P)','Land Rover',
   2.0,4,'petrol','chain',NULL,NULL,
   '0W-20 ACEA C5 (STJLR.51.5122)',5.5,'JLR OAT coolant (orange)',
   'luxury',16000,12,
   'Evoque P200/P250/P300, Velar P250/P300, Disco Sport P200/P250, Jaguar E-Pace/F-Pace P250. Chain (petrol). P300e is PHEV variant.'),
  ('LR_AJ_V6_30_DIESEL','JLR AJ-V6 3.0L Diesel (TDV6/SDV6)','Land Rover',
   3.0,6,'diesel','wet_belt',190000,NULL,
   '5W-30 ACEA C1 (STJLR.03.5004)',7.2,'JLR OAT coolant (orange)',
   'luxury',16000,12,
   'Range Rover L405 TDV6/SDV6, RR Sport L494, Discovery 4/5 3.0 TDV6, Jaguar XF/XJ 3.0D. WET BELT at rear of engine.'),
  ('LR_50_SC_V8','JLR 5.0L Supercharged V8 (AJ133)','Land Rover',
   5.0,8,'petrol','chain',NULL,NULL,
   '5W-30 ACEA C1 / STJLR.03.5004',8.5,'JLR OAT coolant (orange)',
   'luxury',16000,12,
   'Range Rover L405/L460 5.0 SC, RR Sport SVR, Jaguar F-Type R, XKR. Chain. Supercharger snout bearing a known wear item.'),
  -- Mini
  ('MINI_PRINCE_16','Mini/PSA Prince 1.6L (N12/N14/N16/N18)','Mini',
   1.6,4,'petrol','chain',NULL,NULL,
   '5W-30 ACEA C3 / BMW Longlife-04',4.2,'BMW/Mini blue coolant',
   'premium',15000,12,
   'Mini Cooper/Cooper S R56/R55/R60 2006-2014 (Prince engine). N14/N18 timing chain TENSIONER failure is THE known Mini problem.'),
  ('MINI_B38_15_TURBO','Mini B38 1.5L 3cyl Turbo','Mini',
   1.5,3,'petrol','chain',NULL,NULL,
   '0W-30 / 5W-30 BMW Longlife-14 FE+',4.25,'BMW blue coolant',
   'premium',15000,12,
   'Mini Cooper F56/F55/F54 2014+ (1.5 3cyl), BMW 218i, X1 sDrive18i. Shares architecture with BMW B-series.'),
  -- BMW higher spec
  ('BMW_B58_30_TURBO','BMW B58 3.0L Inline-6 Turbo','BMW',
   3.0,6,'petrol','chain',NULL,NULL,
   '0W-30 / 5W-30 BMW Longlife-17 FE+',6.5,'BMW blue coolant',
   'luxury',15000,12,
   '340i/440i/540i F30/F32/G20/G30, X3 M40i, X4 M40i, Z4 M40i, Supra GR A90. Very strong reliable engine. Chain.'),
  ('BMW_N57_30_DIESEL','BMW N57 3.0L Inline-6 Diesel','BMW',
   3.0,6,'diesel','chain',NULL,NULL,
   '5W-30 BMW Longlife-04',6.5,'BMW blue coolant',
   'luxury',20000,12,
   '330d/335d/530d/535d F30/F10, X3/X5 xDrive30d, 730d. Rear timing chain (gearbox end) — engine out. Major job on early N57.'),
  -- Mercedes higher spec
  ('MB_M256_30_TURBO_MHEV','Mercedes M256 3.0L Inline-6 Turbo (mild hybrid)','Mercedes-Benz',
   3.0,6,'petrol','chain',NULL,NULL,
   '0W-30 MB 229.71',7.0,'MB coolant (blue OAT)',
   'luxury',15000,12,
   'C43/E450/GLE450 etc, S500 W223. 48V integrated starter-generator (ISG) mild hybrid. EQ Boost. Chain.'),
  ('MB_OM654_20_DIESEL','Mercedes OM654 2.0L Diesel','Mercedes-Benz',
   2.0,4,'diesel','chain',NULL,NULL,
   '0W-20 / 5W-30 MB 229.71 / 229.52',5.8,'MB coolant (blue OAT)',
   'luxury',20000,12,
   'C220d/E220d W205/W213, GLC220d, Sprinter (later). Replaced OM651. Alloy block, much improved. Chain.'),
  -- Audi / VW more
  ('AUDI_EA839_30_TFSI_V6','Audi EA839 3.0L TFSI V6','Audi',
   3.0,6,'petrol','chain',NULL,NULL,
   '5W-40 / 0W-40 VW 502 00 / 508 00',6.6,'VW G13 (purple/lilac)',
   'luxury',15000,12,
   'S4/S5 B9 3.0T, SQ5, A6/A7 55 TFSI, Q7 55 TFSI. Single twin-scroll turbo in V. Chain. Replaced supercharged 3.0 TFSI.'),
  ('VW_EA211_10_TSI_3CYL','VW EA211 1.0L TSI 3cyl','Volkswagen',
   1.0,3,'petrol','belt',210000,NULL,
   '5W-30 VW 508 00 / 504 00',4.0,'VW G13 (purple/lilac)',
   'mid',15000,12,
   'Polo AW 1.0 TSI, Golf MK7.5/8 1.0 TSI, T-Cross, T-Roc 1.0, Audi A1 30 TFSI, Skoda Fabia/Scala 1.0. Belt 210,000km.'),
  -- Volvo
  ('VOLVO_VEA_20_PETROL','Volvo VEA 2.0L (B4204T petrol)','Volvo',
   2.0,4,'petrol','wet_belt',240000,NULL,
   '0W-20 ACEA C5 / VCC RBS0-2AE',5.7,'Volvo coolant (yellow/green hybrid OAT)',
   'luxury',15000,12,
   'XC60, XC90, S60/V60, S90/V90, XC40 (T-series). T5/T6/T8 are boost/hybrid variants. Wet belt oil-pump drive.'),
  ('VOLVO_VEA_20_DIESEL','Volvo VEA 2.0L (D4204T diesel)','Volvo',
   2.0,4,'diesel','wet_belt',240000,NULL,
   '0W-30 ACEA C3 / VCC RBS0-2AE',5.9,'Volvo coolant (yellow/green hybrid OAT)',
   'luxury',15000,12,
   'XC60 D4/D5, XC90 D5, V60/V90 D4. Twin-turbo D5 (PowerPulse). DPF. Wet belt.'),
  -- Chinese expanded
  ('GWM_GW4D20_20_DIESEL','GWM GW4D20 2.0L Diesel','GWM',
   2.0,4,'diesel','chain',NULL,NULL,
   '5W-30 ACEA C3',6.0,'GWM coolant (pink)',
   'mid',10000,12,
   'GWM Cannon ute, Cannon Alpha (diesel variant), Tank 300 diesel. Chain. NZ pricing confidence 2.'),
  ('BYD_DMI_15_HYBRID','BYD DM-i 1.5L Hybrid (Xiaoyun)','BYD',
   1.5,4,'phev','chain',NULL,NULL,
   '0W-20 API SP',4.0,'BYD coolant (engine + battery loops)',
   'hybrid',10000,12,
   'BYD Sealion 6 DM-i, Shark 6 PHEV ute. Atkinson-cycle 1.5 as generator/range-extender + electric drive. LFP blade battery.'),
  ('CHERY_15_TURBO','Chery 1.5L Turbo (SQRE4T15)','Chery',
   1.5,4,'petrol','chain',NULL,NULL,
   '5W-30 API SP',4.0,'Chery coolant (pink)',
   'economy',10000,12,
   'Chery Tiggo 4/7/8 Pro, Omoda 5, Jaecoo. Growing NZ presence 2023+. Chain. Confidence 2.')
ON CONFLICT (family_id) DO NOTHING;

-- ── SECTION 3: New fleet vehicles (chunk_d) ──────────────────────────────────

INSERT INTO public.fleet_vehicles (
  vehicle_id, make, model, submodel, chassis_code,
  year_from, year_to, engine_family_id, fuel, body_type, drivetrain,
  is_jdm_import, notes
) VALUES
  -- Land Rover / Jaguar
  ('LR_DISCO_SPORT_L550_20D_14_NOW','Land Rover','Discovery Sport','2.0 TD4','L550',2014,NULL,'LR_INGENIUM_20_DIESEL','diesel','suv','4wd',FALSE,'Wet belt Ingenium'),
  ('LR_DISCO_SPORT_L550_20P_14_NOW','Land Rover','Discovery Sport','2.0 P250','L550',2014,NULL,'LR_INGENIUM_20_PETROL','petrol','suv','4wd',FALSE,NULL),
  ('LR_EVOQUE_L538_20D_11_18','Land Rover','Range Rover Evoque','2.0 TD4','L538',2011,2018,'LR_INGENIUM_20_DIESEL','diesel','suv','4wd',FALSE,NULL),
  ('LR_EVOQUE_L551_20D_18_NOW','Land Rover','Range Rover Evoque','2.0 D','L551',2018,NULL,'LR_INGENIUM_20_DIESEL','diesel','suv','4wd',FALSE,NULL),
  ('LR_EVOQUE_L551_20P_18_NOW','Land Rover','Range Rover Evoque','2.0 P250','L551',2018,NULL,'LR_INGENIUM_20_PETROL','petrol','suv','4wd',FALSE,NULL),
  ('LR_VELAR_20D_17_NOW','Land Rover','Range Rover Velar','2.0 D','L560',2017,NULL,'LR_INGENIUM_20_DIESEL','diesel','suv','4wd',FALSE,NULL),
  ('LR_VELAR_30D_17_NOW','Land Rover','Range Rover Velar','3.0 SDV6','L560',2017,NULL,'LR_AJ_V6_30_DIESEL','diesel','suv','4wd',FALSE,NULL),
  ('LR_DISCO5_L462_30D_17_NOW','Land Rover','Discovery 5','3.0 TDV6','L462',2017,NULL,'LR_AJ_V6_30_DIESEL','diesel','suv','4wd',FALSE,NULL),
  ('LR_DISCO4_L319_30D_09_16','Land Rover','Discovery 4','3.0 TDV6/SDV6','L319',2009,2016,'LR_AJ_V6_30_DIESEL','diesel','suv','4wd',FALSE,NULL),
  ('LR_RRSPORT_L494_30D_13_22','Land Rover','Range Rover Sport','3.0 SDV6','L494',2013,2022,'LR_AJ_V6_30_DIESEL','diesel','suv','4wd',FALSE,NULL),
  ('LR_RRSPORT_L494_50SC_13_22','Land Rover','Range Rover Sport','5.0 SC V8','L494',2013,2022,'LR_50_SC_V8','petrol','suv','4wd',FALSE,NULL),
  ('LR_RR_L405_30D_12_21','Land Rover','Range Rover','3.0 TDV6/SDV6','L405',2012,2021,'LR_AJ_V6_30_DIESEL','diesel','suv','4wd',FALSE,NULL),
  ('LR_RR_L405_50SC_12_21','Land Rover','Range Rover','5.0 SC V8','L405',2012,2021,'LR_50_SC_V8','petrol','suv','4wd',FALSE,NULL),
  ('JAG_FPACE_20D_16_NOW','Jaguar','F-Pace','2.0 D','X761',2016,NULL,'LR_INGENIUM_20_DIESEL','diesel','suv','awd',FALSE,NULL),
  ('JAG_XE_20D_15_NOW','Jaguar','XE','2.0 D','X760',2015,NULL,'LR_INGENIUM_20_DIESEL','diesel','sedan','rwd',FALSE,NULL),
  -- Mini
  ('MINI_COOPER_R56_16_06_13','Mini','Cooper','1.6','R56',2006,2013,'MINI_PRINCE_16','petrol','hatch','fwd',FALSE,'Prince NA — Cooper S is N14/N18 turbo'),
  ('MINI_COOPER_S_R56_16T_06_13','Mini','Cooper S','1.6T','R56',2006,2013,'MINI_PRINCE_16','petrol','hatch','fwd',FALSE,'Timing chain rattle = flag'),
  ('MINI_COUNTRYMAN_R60_16_10_16','Mini','Countryman','1.6','R60',2010,2016,'MINI_PRINCE_16','petrol','suv','awd',FALSE,NULL),
  ('MINI_COOPER_F56_15T_14_NOW','Mini','Cooper','1.5T 3cyl','F56',2014,NULL,'MINI_B38_15_TURBO','petrol','hatch','fwd',FALSE,NULL),
  ('MINI_COOPER_S_F56_20T_14_NOW','Mini','Cooper S','2.0T','F56',2014,NULL,'BMW_B48_20_TURBO','petrol','hatch','fwd',FALSE,'Uses BMW B48'),
  ('MINI_COUNTRYMAN_F60_20_17_NOW','Mini','Countryman','2.0T','F60',2017,NULL,'BMW_B48_20_TURBO','petrol','suv','awd',FALSE,NULL),
  -- BMW B58 / N57
  ('BMW_340I_F30_B58_15_19','BMW','340i','3.0T','F30',2015,2019,'BMW_B58_30_TURBO','petrol','sedan','rwd',FALSE,NULL),
  ('BMW_440I_F32_B58_16_20','BMW','440i','3.0T','F32',2016,2020,'BMW_B58_30_TURBO','petrol','coupe','rwd',FALSE,NULL),
  ('BMW_M340I_G20_B58_19_NOW','BMW','M340i','3.0T','G20',2019,NULL,'BMW_B58_30_TURBO','petrol','sedan','awd',FALSE,NULL),
  ('BMW_X3_M40I_G01_B58_17_NOW','BMW','X3 M40i','3.0T','G01',2017,NULL,'BMW_B58_30_TURBO','petrol','suv','awd',FALSE,NULL),
  ('BMW_330D_F30_N57_12_19','BMW','330d','3.0D','F30',2012,2019,'BMW_N57_30_DIESEL','diesel','sedan','rwd',FALSE,NULL),
  ('BMW_530D_F10_N57_10_17','BMW','530d','3.0D','F10',2010,2017,'BMW_N57_30_DIESEL','diesel','sedan','rwd',FALSE,NULL),
  ('BMW_X5_E70_N57_30D_07_13','BMW','X5 xDrive30d','3.0D','E70',2007,2013,'BMW_N57_30_DIESEL','diesel','suv','awd',FALSE,NULL),
  -- Mercedes M256 / OM654
  ('MB_E450_W213_M256_17_NOW','Mercedes-Benz','E450','3.0T','W213',2017,NULL,'MB_M256_30_TURBO_MHEV','petrol','sedan','awd',FALSE,NULL),
  ('MB_C43_W205_M256_18_NOW','Mercedes-Benz','C43 AMG','3.0T','W205',2018,NULL,'MB_M256_30_TURBO_MHEV','petrol','sedan','awd',FALSE,NULL),
  ('MB_GLE450_V167_M256_19_NOW','Mercedes-Benz','GLE450','3.0T','V167',2019,NULL,'MB_M256_30_TURBO_MHEV','petrol','suv','awd',FALSE,NULL),
  ('MB_C220D_W205_OM654_18_NOW','Mercedes-Benz','C220d','2.0D','W205',2018,NULL,'MB_OM654_20_DIESEL','diesel','sedan','rwd',FALSE,NULL),
  ('MB_E220D_W213_OM654_16_NOW','Mercedes-Benz','E220d','2.0D','W213',2016,NULL,'MB_OM654_20_DIESEL','diesel','sedan','rwd',FALSE,NULL),
  ('MB_GLC220D_X253_OM654_19_NOW','Mercedes-Benz','GLC220d','2.0D','X253',2019,NULL,'MB_OM654_20_DIESEL','diesel','suv','awd',FALSE,NULL),
  -- Audi / VW EA839 / 1.0 TSI
  ('AUDI_S4_B9_EA839_16_NOW','Audi','S4','3.0T','B9',2016,NULL,'AUDI_EA839_30_TFSI_V6','petrol','sedan','awd',FALSE,NULL),
  ('AUDI_S5_B9_EA839_16_NOW','Audi','S5','3.0T','B9',2016,NULL,'AUDI_EA839_30_TFSI_V6','petrol','coupe','awd',FALSE,NULL),
  ('AUDI_SQ5_FY_EA839_17_NOW','Audi','SQ5','3.0T','FY',2017,NULL,'AUDI_EA839_30_TFSI_V6','petrol','suv','awd',FALSE,NULL),
  ('VW_POLO_AW_10TSI_3CYL_17_NOW','Volkswagen','Polo','1.0 TSI','AW',2017,NULL,'VW_EA211_10_TSI_3CYL','petrol','hatch','fwd',FALSE,NULL),
  ('VW_TCROSS_10TSI_19_NOW','Volkswagen','T-Cross','1.0 TSI','C1',2019,NULL,'VW_EA211_10_TSI_3CYL','petrol','suv','fwd',FALSE,NULL),
  ('VW_GOLF_MK8_10TSI_20_NOW','Volkswagen','Golf','1.0 TSI','MK8',2020,NULL,'VW_EA211_10_TSI_3CYL','petrol','hatch','fwd',FALSE,NULL),
  ('AUDI_A1_30TFSI_GB_18_NOW','Audi','A1','30 TFSI 1.0','GB',2018,NULL,'VW_EA211_10_TSI_3CYL','petrol','hatch','fwd',FALSE,NULL),
  ('SKODA_FABIA_10TSI_21_NOW','Skoda','Fabia','1.0 TSI','PJ',2021,NULL,'VW_EA211_10_TSI_3CYL','petrol','hatch','fwd',FALSE,NULL),
  -- Volvo
  ('VOLVO_XC60_20P_T5_17_NOW','Volvo','XC60','2.0 T5','SPA',2017,NULL,'VOLVO_VEA_20_PETROL','petrol','suv','awd',FALSE,NULL),
  ('VOLVO_XC60_20D_D4_17_NOW','Volvo','XC60','2.0 D4','SPA',2017,NULL,'VOLVO_VEA_20_DIESEL','diesel','suv','awd',FALSE,NULL),
  ('VOLVO_XC90_20P_T6_15_NOW','Volvo','XC90','2.0 T6','SPA',2015,NULL,'VOLVO_VEA_20_PETROL','petrol','suv','awd',FALSE,NULL),
  ('VOLVO_XC90_20D_D5_15_NOW','Volvo','XC90','2.0 D5','SPA',2015,NULL,'VOLVO_VEA_20_DIESEL','diesel','suv','awd',FALSE,NULL),
  ('VOLVO_XC40_20P_T4_18_NOW','Volvo','XC40','2.0 T4','CMA',2018,NULL,'VOLVO_VEA_20_PETROL','petrol','suv','awd',FALSE,NULL),
  ('VOLVO_S60_20P_T5_18_NOW','Volvo','S60','2.0 T5','SPA',2018,NULL,'VOLVO_VEA_20_PETROL','petrol','sedan','awd',FALSE,NULL),
  ('VOLVO_V60_20D_D4_18_NOW','Volvo','V60','2.0 D4','SPA',2018,NULL,'VOLVO_VEA_20_DIESEL','diesel','wagon','awd',FALSE,NULL),
  -- Chinese expanded
  ('GWM_CANNON_20D_20_NOW','GWM','Cannon','2.0 D','P series',2020,NULL,'GWM_GW4D20_20_DIESEL','diesel','ute','4wd',FALSE,NULL),
  ('GWM_CANNON_ALPHA_20D_23_NOW','GWM','Cannon Alpha','2.0 D','P series',2023,NULL,'GWM_GW4D20_20_DIESEL','diesel','ute','4wd',FALSE,NULL),
  ('GWM_TANK300_20D_23_NOW','GWM','Tank 300','2.0 D','B07',2023,NULL,'GWM_GW4D20_20_DIESEL','diesel','suv','4wd',FALSE,NULL),
  ('BYD_SEALION6_DMI_24_NOW','BYD','Sealion 6','DM-i PHEV','EA1',2024,NULL,'BYD_DMI_15_HYBRID','phev','suv','awd',FALSE,NULL),
  ('BYD_SHARK6_DMI_25_NOW','BYD','Shark 6','DM-i PHEV ute','EA1',2025,NULL,'BYD_DMI_15_HYBRID','phev','ute','awd',FALSE,NULL),
  ('CHERY_TIGGO7_15T_23_NOW','Chery','Tiggo 7 Pro','1.5T','T1E',2023,NULL,'CHERY_15_TURBO','petrol','suv','fwd',FALSE,NULL),
  ('CHERY_TIGGO8_15T_23_NOW','Chery','Tiggo 8 Pro','1.5T','T1E',2023,NULL,'CHERY_15_TURBO','petrol','suv','fwd',FALSE,NULL),
  ('OMODA_5_15T_23_NOW','Omoda','5','1.5T','T1E',2023,NULL,'CHERY_15_TURBO','petrol','suv','fwd',FALSE,NULL),
  ('TES_MODELY_LR_22_NOW','Tesla','Model Y','Long Range','Y',2022,NULL,'TES_MODEL3_BEV','bev','suv','awd',FALSE,NULL)
ON CONFLICT (vehicle_id) DO NOTHING;

-- ── SECTION 4: fluid_pricing table ───────────────────────────────────────────
-- cost_per_litre values are GST-INCLUSIVE — do NOT apply ×1.15

CREATE TABLE IF NOT EXISTS public.fluid_pricing (
  fluid_id             TEXT PRIMARY KEY,
  category             TEXT NOT NULL,
  spec                 TEXT NOT NULL,
  viscosity            TEXT,
  cost_per_litre_low   NUMERIC NOT NULL,
  cost_per_litre_high  NUMERIC NOT NULL,
  pack_basis           TEXT,
  example_product      TEXT,
  confidence           INTEGER DEFAULT 2,
  notes                TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.fluid_pricing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fluid_pricing_public_read" ON public.fluid_pricing;
CREATE POLICY "fluid_pricing_public_read" ON public.fluid_pricing FOR SELECT USING (true);
DROP POLICY IF EXISTS "fluid_pricing_service_all" ON public.fluid_pricing;
CREATE POLICY "fluid_pricing_service_all" ON public.fluid_pricing USING (auth.role() = 'service_role');

INSERT INTO public.fluid_pricing (fluid_id, category, spec, viscosity, cost_per_litre_low, cost_per_litre_high, pack_basis, example_product, confidence, notes) VALUES
  ('OIL_5W30_C3','engine_oil','5W-30 ACEA C3 / API SN-SP','5W-30',12.00,26.00,'5L pack','Repco Full Synthetic 5W-30 C3 / Castrol Edge 5W-30',3,'Most common modern petrol+light diesel spec. Budget house $12/L, Castrol Edge premium $22-26/L. DPF-safe.'),
  ('OIL_5W30_VW504_507','engine_oil','5W-30 VW 504 00 / 507 00','5W-30',22.00,40.00,'5L pack (Castrol) / 1L (Motul, Liqui Moly)','Castrol Edge 5W-30 LL / Motul Specific 504 00 507 00',3,'VAG low-SAPS long-life. Used by EA211, EA888, EA189, EA113, Audi 3.0 TDI.'),
  ('OIL_0W20_SP','engine_oil','0W-20 API SN-SP / ILSAC GF-5/6','0W-20',16.00,30.00,'5L pack','Penrite Enviro+ 0W-20 / Mobil Super 3000 0W-20',3,'Modern Toyota/Honda/Mazda/Subaru petrol+hybrid. Hybrid-rated variants at top of range.'),
  ('OIL_0W16_SP','engine_oil','0W-16 API SP','0W-16',20.00,34.00,'1L / 4L pack','Toyota Genuine 0W-16 / Penrite specialty',2,'Newest TNGA Toyota (A25A). Thinner, specialty, less common on shelf.'),
  ('OIL_5W40_A3B4','engine_oil','5W-40 ACEA A3/B4 / API SN','5W-40',14.00,28.00,'5L pack','Penrite HPR 5 5W-40 / Castrol Edge 5W-40',3,'Performance petrol + older Euro turbo (Subaru EJ turbo, some VW).'),
  ('OIL_5W30_DIESEL_LIGHT','engine_oil','5W-30 ACEA C2/C3 light diesel','5W-30',13.00,26.00,'5L pack','Repco Full Synthetic 5W-30 C3 / Penrite HPR Diesel',3,'Modern common-rail diesel with DPF (Toyota 1GD, Ford 2.0 BiT, BMW/MB diesel).'),
  ('OIL_5W30_DIESEL_HD','engine_oil','5W-30 ACEA C2 / Toyota D-4D heavy','5W-30',14.00,26.00,'5L / 10L pack','Penrite HPR Diesel / Castrol Magnatec Diesel',2,'Toyota 1KD/2KD D-4D (7.5L capacity, big fills).'),
  ('OIL_15W40_DIESEL','engine_oil','15W-40 ACEA E5/E7 / API CI-4','15W-40',8.00,16.00,'5L / 20L pack','Gulf Western / Penrite HD diesel mineral',2,'Older heavy diesel (Toyota 1HZ 9.6L, 1KZ-TE, Nissan ZD30, Mitsubishi 4D56/4M41).'),
  ('OIL_10W40_SEMI','engine_oil','10W-40 semi-synthetic API SL/SN','10W-40',8.00,16.00,'5L pack','Penrite Semi Synthetic 10W-40 / Shell Helix HX7',3,'Older high-km petrol (90s-2000s JDM imports, 4A-FE, B-series, SR20).'),
  ('OIL_10W40_ROTARY','engine_oil','10W-40 mineral rotary-safe','10W-40',10.00,18.00,'5L pack','Penrite mineral / rotary-specific (NOT full synthetic)',2,'Mazda 13B rotary — apex seals need mineral/specific, NOT full synth.'),
  ('TRANS_ATF_CONVENTIONAL','transmission','ATF Dexron VI / multi-vehicle',NULL,14.00,26.00,'4L pack','Penrite ATF LV / Castrol Transmax',3,'Conventional torque-converter autos (Toyota Aisin 4/5/6AT, ZF where Dexron). 4L ~$60-90.'),
  ('TRANS_CVT','transmission','CVT fluid (Jatco/Aisin/Toyota CVT)',NULL,16.00,30.00,'4L pack','Penrite CVT Fluid V / Penrite Low Viscosity CVT',3,'Nissan/Toyota/Suzuki/Honda CVT. Spec-sensitive — wrong CVT fluid damages the box.'),
  ('TRANS_DSG_DCT','transmission','DSG / DCT wet-clutch fluid (VW G052182)',NULL,28.00,50.00,'1L bottle','Febi DSG-DCT / Nulon Multi-Vehicle DSG/DCT / Ravenol',3,'VW DQ200/DQ250/DQ381/DQ400e, Ford PowerShift, Hyundai 7DCT. Sold mostly in 1L.'),
  ('TRANS_MANUAL_GEAR','transmission','Manual gearbox oil 75W-90 GL-4/5','75W-90',16.00,30.00,'1L bottle','Penrite / Castrol manual transmission fluid',2,'Manual boxes.'),
  ('COOLANT_OAT_RED','coolant','OAT red/pink (Toyota SLLC, Glysantin G40)',NULL,9.00,17.00,'5L concentrate','Penrite Red OEM (Glysantin G40) / Repco Red OAT',3,'Toyota Super Long Life pink, Mazda FL22, Honda Type2, Hyundai/Kia. 5L concentrate. Mixed 50:50.'),
  ('COOLANT_OAT_BLUE','coolant','OAT blue (Subaru, Nissan, BMW, Glysantin G30)',NULL,9.00,17.00,'5L concentrate','Penrite Blue OEM (Glysantin G30)',3,'Subaru Super Coolant, Nissan blue LLC, BMW blue.'),
  ('COOLANT_OAT_PURPLE_G13','coolant','VW G13 purple/lilac (Si-OAT)',NULL,11.00,20.00,'5L concentrate','Penrite OEM purple G13 / Glysantin G40 equivalent',2,'VW Group G13. EA211, EA888, EA189, EA113.'),
  ('COOLANT_IAT_GREEN','coolant','IAT green (older vehicles)',NULL,6.00,12.00,'5L concentrate','Penrite Green / Repco Green',3,'Pre-2000 JDM and older engines on green IAT. Cheapest tier. Shorter interval than OAT.'),
  ('BRAKE_DOT4','brake','DOT 4 (most modern passenger)',NULL,12.00,22.00,'1L bottle','Repco DOT 4 / Penrite Super DOT 4 / Castrol DOT 4',3,'Standard for nearly all modern cars. Most brake jobs use under 1L for a flush.'),
  ('BRAKE_DOT5_1','brake','DOT 5.1 (performance/high-temp)',NULL,22.00,38.00,'1L bottle','Penrite / Motul DOT 5.1',3,'Performance (some BMW M, track use). Higher boiling point.'),
  ('BRAKE_DOT3','brake','DOT 3 (older/light-duty)',NULL,10.00,18.00,'1L bottle','Repco / Penrite DOT 3',3,'Older vehicles. Cheapest brake fluid tier.'),
  ('PS_FLUID','power_steering','Power steering fluid / ATF-type',NULL,14.00,26.00,'1L bottle','Penrite power steering fluid / Dexron ATF',2,'Only hydraulic PS systems (older vehicles, some utes). Newer cars use electric PS.')
ON CONFLICT (fluid_id) DO NOTHING;

-- ── SECTION 5: engine_family_fluids table ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.engine_family_fluids (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engine_family_id TEXT NOT NULL UNIQUE REFERENCES public.engine_families(family_id),
  oil_fluid_id     TEXT REFERENCES public.fluid_pricing(fluid_id),
  coolant_fluid_id TEXT REFERENCES public.fluid_pricing(fluid_id),
  trans_fluid_id   TEXT REFERENCES public.fluid_pricing(fluid_id),
  brake_fluid_id   TEXT REFERENCES public.fluid_pricing(fluid_id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.engine_family_fluids ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "engine_family_fluids_public_read" ON public.engine_family_fluids;
CREATE POLICY "engine_family_fluids_public_read" ON public.engine_family_fluids FOR SELECT USING (true);
DROP POLICY IF EXISTS "engine_family_fluids_service_all" ON public.engine_family_fluids;
CREATE POLICY "engine_family_fluids_service_all" ON public.engine_family_fluids USING (auth.role() = 'service_role');

INSERT INTO public.engine_family_fluids (engine_family_id, oil_fluid_id, coolant_fluid_id, trans_fluid_id, brake_fluid_id) VALUES
  -- Toyota petrol
  ('TOY_1NZFE_15','OIL_5W30_C3','COOLANT_OAT_RED','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('TOY_2NZFE_13','OIL_5W30_C3','COOLANT_OAT_RED','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('TOY_1KRFE_10','OIL_0W20_SP','COOLANT_OAT_RED','TRANS_CVT','BRAKE_DOT4'),
  ('TOY_2ZRFE_18','OIL_0W20_SP','COOLANT_OAT_RED','TRANS_CVT','BRAKE_DOT4'),
  ('TOY_1ZRFE_16','OIL_5W30_C3','COOLANT_OAT_RED','TRANS_CVT','BRAKE_DOT4'),
  ('TOY_2ARFE_25','OIL_0W20_SP','COOLANT_OAT_RED','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('TOY_1AZFE_20','OIL_5W30_C3','COOLANT_OAT_RED','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('TOY_2AZFE_24','OIL_5W30_C3','COOLANT_OAT_RED','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('TOY_2GRFE_35_V6','OIL_5W30_C3','COOLANT_OAT_RED','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('TOY_1GRFE_40_V6','OIL_5W30_C3','COOLANT_OAT_RED','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('TOY_1MZFE_30_V6','OIL_5W30_C3','COOLANT_OAT_RED','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('TOY_3MZFE_33_V6','OIL_5W30_C3','COOLANT_OAT_RED','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('TOY_5VZFE_34_V6','OIL_5W30_C3','COOLANT_IAT_GREEN','TRANS_ATF_CONVENTIONAL','BRAKE_DOT3'),
  ('TOY_4AFE_7AFE_16_18','OIL_10W40_SEMI','COOLANT_IAT_GREEN','TRANS_ATF_CONVENTIONAL','BRAKE_DOT3'),
  ('TOY_1NR_2NR_13_15','OIL_0W20_SP','COOLANT_OAT_RED','TRANS_CVT','BRAKE_DOT4'),
  ('TOY_1JZ_25_I6','OIL_5W40_A3B4','COOLANT_IAT_GREEN','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('TOY_2JZ_30_I6','OIL_5W40_A3B4','COOLANT_IAT_GREEN','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  -- Toyota hybrid
  ('TOY_1NZFXE_15_HYBRID','OIL_0W20_SP','COOLANT_OAT_RED',NULL,'BRAKE_DOT4'),
  ('TOY_2ZRFXE_18_HYBRID','OIL_0W20_SP','COOLANT_OAT_RED',NULL,'BRAKE_DOT4'),
  ('TOY_2ARFXE_25_HYBRID','OIL_0W20_SP','COOLANT_OAT_RED',NULL,'BRAKE_DOT4'),
  ('TOY_A25AFXS_25_HYBRID','OIL_0W16_SP','COOLANT_OAT_RED',NULL,'BRAKE_DOT4'),
  -- Toyota diesel
  ('TOY_1KDFTV_30_DIESEL','OIL_5W30_DIESEL_HD','COOLANT_OAT_RED','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('TOY_2KDFTV_25_DIESEL','OIL_5W30_DIESEL_HD','COOLANT_OAT_RED','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('TOY_1GDFTV_28_DIESEL','OIL_5W30_DIESEL_LIGHT','COOLANT_OAT_RED','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('TOY_2GDFTV_24_DIESEL','OIL_5W30_DIESEL_LIGHT','COOLANT_OAT_RED','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('TOY_1KZTE_30_TDIESEL','OIL_15W40_DIESEL','COOLANT_IAT_GREEN','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('TOY_1HZ_42_DIESEL_I6','OIL_15W40_DIESEL','COOLANT_IAT_GREEN','TRANS_MANUAL_GEAR','BRAKE_DOT4'),
  ('TOY_5LE_30_DIESEL','OIL_15W40_DIESEL','COOLANT_IAT_GREEN','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  -- VW Group
  ('VW_EA211_14_TSI','OIL_5W30_VW504_507','COOLANT_OAT_PURPLE_G13','TRANS_DSG_DCT','BRAKE_DOT4'),
  ('VW_EA888_20_TSI','OIL_5W30_VW504_507','COOLANT_OAT_PURPLE_G13','TRANS_DSG_DCT','BRAKE_DOT4'),
  ('VW_EA189_20_TDI','OIL_5W30_VW504_507','COOLANT_OAT_PURPLE_G13','TRANS_DSG_DCT','BRAKE_DOT4'),
  ('VW_EA211_GTE_PHEV','OIL_5W30_VW504_507','COOLANT_OAT_PURPLE_G13','TRANS_DSG_DCT','BRAKE_DOT4'),
  ('VW_EA111_14_TSI','OIL_5W30_VW504_507','COOLANT_OAT_PURPLE_G13','TRANS_DSG_DCT','BRAKE_DOT4'),
  ('VW_EA113_20_TFSI','OIL_5W30_VW504_507','COOLANT_OAT_PURPLE_G13','TRANS_DSG_DCT','BRAKE_DOT4'),
  ('AUDI_30_TDI_V6','OIL_5W30_VW504_507','COOLANT_OAT_PURPLE_G13','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  -- Nissan
  ('NIS_HR15DE_15','OIL_5W30_C3','COOLANT_OAT_BLUE','TRANS_CVT','BRAKE_DOT4'),
  ('NIS_MR18DE_18','OIL_5W30_C3','COOLANT_OAT_BLUE','TRANS_CVT','BRAKE_DOT4'),
  ('NIS_MR20DE_20','OIL_5W30_C3','COOLANT_OAT_BLUE','TRANS_CVT','BRAKE_DOT4'),
  ('NIS_QR25DE_25','OIL_5W30_C3','COOLANT_OAT_BLUE','TRANS_CVT','BRAKE_DOT4'),
  ('NIS_VQ35DE_35_V6','OIL_5W30_C3','COOLANT_OAT_BLUE','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('NIS_VQ25_VQ30_V6','OIL_5W30_C3','COOLANT_IAT_GREEN','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('NIS_SR20_20','OIL_10W40_SEMI','COOLANT_IAT_GREEN','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('NIS_YD25_25_DIESEL','OIL_5W30_DIESEL_LIGHT','COOLANT_OAT_BLUE','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('NIS_ZD30_30_DIESEL','OIL_15W40_DIESEL','COOLANT_IAT_GREEN','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('NIS_VK56_56_V8','OIL_5W30_C3','COOLANT_OAT_BLUE','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('NIS_LEAF_BEV',NULL,'COOLANT_OAT_BLUE',NULL,'BRAKE_DOT4'),
  -- Mazda
  ('MAZ_SKYACTIVG_20','OIL_0W20_SP','COOLANT_OAT_RED','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('MAZ_SKYACTIVG_25','OIL_0W20_SP','COOLANT_OAT_RED','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('MAZ_SKYACTIVG_15','OIL_0W20_SP','COOLANT_OAT_RED','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('MAZ_SKYACTIVD_22','OIL_5W30_DIESEL_LIGHT','COOLANT_OAT_RED','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('MAZ_ZY_VE_15','OIL_5W30_C3','COOLANT_OAT_RED','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('MAZ_B6_BP_FS_LEGACY','OIL_10W40_SEMI','COOLANT_IAT_GREEN','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('MAZ_13B_ROTARY','OIL_10W40_ROTARY','COOLANT_IAT_GREEN','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  -- Honda
  ('HON_L13_L15_13_15','OIL_0W20_SP','COOLANT_OAT_BLUE','TRANS_CVT','BRAKE_DOT4'),
  ('HON_L15B_15T','OIL_0W20_SP','COOLANT_OAT_BLUE','TRANS_CVT','BRAKE_DOT4'),
  ('HON_R18A_18','OIL_5W30_C3','COOLANT_OAT_BLUE','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('HON_K20_20','OIL_5W30_C3','COOLANT_OAT_BLUE','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('HON_K24_24','OIL_5W30_C3','COOLANT_OAT_BLUE','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('HON_B_SERIES_16_18_20','OIL_10W40_SEMI','COOLANT_IAT_GREEN','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('HON_J_SERIES_V6','OIL_5W30_C3','COOLANT_OAT_BLUE','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('HON_LEB_15_IDCD_HYBRID','OIL_0W20_SP','COOLANT_OAT_BLUE','TRANS_DSG_DCT','BRAKE_DOT4'),
  -- Subaru
  ('SUB_EJ25_25_BOXER_BELT','OIL_5W30_C3','COOLANT_OAT_BLUE','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('SUB_EJ20_20_TURBO','OIL_5W40_A3B4','COOLANT_OAT_BLUE','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('SUB_FB25_25_CHAIN','OIL_0W20_SP','COOLANT_OAT_BLUE','TRANS_CVT','BRAKE_DOT4'),
  ('SUB_FB20_20_CHAIN','OIL_0W20_SP','COOLANT_OAT_BLUE','TRANS_CVT','BRAKE_DOT4'),
  ('SUB_EZ30_EZ36_H6','OIL_5W30_C3','COOLANT_OAT_BLUE','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  -- Ford
  ('FORD_P5AT_32_TDCI','OIL_5W30_DIESEL_LIGHT','COOLANT_OAT_RED','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('FORD_YN2S_20_BITURBO','OIL_5W30_DIESEL_LIGHT','COOLANT_OAT_RED','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('FORD_BARRA_40_I6','OIL_5W30_C3','COOLANT_OAT_RED','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  -- Mitsubishi
  ('MIT_4N15_24_DIESEL','OIL_5W30_DIESEL_LIGHT','COOLANT_IAT_GREEN','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('MIT_4B11_4B12_20_24','OIL_0W20_SP','COOLANT_IAT_GREEN','TRANS_CVT','BRAKE_DOT4'),
  ('MIT_4D56_25_DIESEL','OIL_15W40_DIESEL','COOLANT_IAT_GREEN','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('MIT_4M41_32_DIESEL','OIL_5W30_DIESEL_LIGHT','COOLANT_IAT_GREEN','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('MIT_4G63_20_TURBO','OIL_5W40_A3B4','COOLANT_IAT_GREEN','TRANS_MANUAL_GEAR','BRAKE_DOT4'),
  ('MIT_OUTLANDER_PHEV_24','OIL_0W20_SP','COOLANT_IAT_GREEN',NULL,'BRAKE_DOT4'),
  -- Suzuki
  ('SUZ_K12B_12','OIL_0W20_SP','COOLANT_OAT_BLUE','TRANS_CVT','BRAKE_DOT4'),
  ('SUZ_K14_14','OIL_0W20_SP','COOLANT_OAT_BLUE','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('SUZ_M16A_16','OIL_5W30_C3','COOLANT_OAT_BLUE','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('SUZ_K6A_F6A_KEI','OIL_5W30_C3','COOLANT_IAT_GREEN','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  -- Hyundai/Kia
  ('HKM_G4FC_16','OIL_5W30_C3','COOLANT_OAT_RED','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('HKM_G4FG_G4NA_CHAIN','OIL_5W30_C3','COOLANT_OAT_RED','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('HKM_D4HA_20_DIESEL','OIL_5W30_DIESEL_LIGHT','COOLANT_OAT_RED','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('HKM_THETA_II_20_24','OIL_5W30_C3','COOLANT_OAT_RED','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('HKM_SMARTSTREAM_16_HYBRID','OIL_0W20_SP','COOLANT_OAT_RED','TRANS_DSG_DCT','BRAKE_DOT4'),
  ('HKM_EV_BEV',NULL,'COOLANT_OAT_RED',NULL,'BRAKE_DOT4'),
  -- BMW / Mercedes existing
  ('BMW_N20_20_TURBO','OIL_5W30_VW504_507','COOLANT_OAT_BLUE','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('BMW_B48_20_TURBO','OIL_5W30_VW504_507','COOLANT_OAT_BLUE','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('BMW_B47_20_DIESEL','OIL_5W30_DIESEL_LIGHT','COOLANT_OAT_BLUE','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('MB_M274_20_TURBO','OIL_5W30_VW504_507','COOLANT_OAT_BLUE','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('MB_OM651_21_DIESEL','OIL_5W30_DIESEL_LIGHT','COOLANT_OAT_BLUE','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('MB_M271_18_FORCED','OIL_5W40_A3B4','COOLANT_OAT_BLUE','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  -- BEV
  ('TES_MODEL3_BEV',NULL,'COOLANT_OAT_BLUE',NULL,'BRAKE_DOT4'),
  ('BYD_BLADE_BEV',NULL,'COOLANT_OAT_BLUE',NULL,'BRAKE_DOT4'),
  -- Isuzu / others
  ('ISU_4JJ1_30_DIESEL','OIL_5W30_DIESEL_LIGHT','COOLANT_IAT_GREEN','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('MG_SAIC_15_TURBO','OIL_5W30_C3','COOLANT_OAT_RED','TRANS_DSG_DCT','BRAKE_DOT4'),
  ('GWM_4N20_20_TURBO','OIL_5W30_C3','COOLANT_OAT_RED','TRANS_DSG_DCT','BRAKE_DOT4'),
  ('LDV_MAXUS_DIESEL','OIL_5W30_DIESEL_LIGHT','COOLANT_IAT_GREEN','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('DAI_KF_KEI','OIL_5W30_C3','COOLANT_IAT_GREEN','TRANS_CVT','BRAKE_DOT4'),
  -- Chunk D new families
  ('LR_INGENIUM_20_DIESEL','OIL_5W30_DIESEL_LIGHT','COOLANT_OAT_RED','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('LR_INGENIUM_20_PETROL','OIL_0W20_SP','COOLANT_OAT_RED','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('LR_AJ_V6_30_DIESEL','OIL_5W30_DIESEL_LIGHT','COOLANT_OAT_RED','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('LR_50_SC_V8','OIL_5W30_C3','COOLANT_OAT_RED','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('MINI_PRINCE_16','OIL_5W30_VW504_507','COOLANT_OAT_BLUE','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('MINI_B38_15_TURBO','OIL_5W30_VW504_507','COOLANT_OAT_BLUE','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('BMW_B58_30_TURBO','OIL_5W30_VW504_507','COOLANT_OAT_BLUE','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('BMW_N57_30_DIESEL','OIL_5W30_VW504_507','COOLANT_OAT_BLUE','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('MB_M256_30_TURBO_MHEV','OIL_5W30_VW504_507','COOLANT_OAT_BLUE','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('MB_OM654_20_DIESEL','OIL_5W30_DIESEL_LIGHT','COOLANT_OAT_BLUE','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('AUDI_EA839_30_TFSI_V6','OIL_5W30_VW504_507','COOLANT_OAT_PURPLE_G13','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('VW_EA211_10_TSI_3CYL','OIL_5W30_VW504_507','COOLANT_OAT_PURPLE_G13','TRANS_DSG_DCT','BRAKE_DOT4'),
  ('VOLVO_VEA_20_PETROL','OIL_0W20_SP','COOLANT_OAT_BLUE','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('VOLVO_VEA_20_DIESEL','OIL_5W30_C3','COOLANT_OAT_BLUE','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('GWM_GW4D20_20_DIESEL','OIL_5W30_DIESEL_LIGHT','COOLANT_OAT_RED','TRANS_ATF_CONVENTIONAL','BRAKE_DOT4'),
  ('BYD_DMI_15_HYBRID','OIL_0W20_SP','COOLANT_OAT_BLUE',NULL,'BRAKE_DOT4'),
  ('CHERY_15_TURBO','OIL_5W30_C3','COOLANT_OAT_RED','TRANS_CVT','BRAKE_DOT4')
ON CONFLICT (engine_family_id) DO NOTHING;

-- ── SECTION 6: service_schedule table ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.service_schedule (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engine_family_id          TEXT NOT NULL UNIQUE REFERENCES public.engine_families(family_id),
  coolant_capacity_l        NUMERIC,
  trans_capacity_l          NUMERIC,
  oil_interval_km           INTEGER NOT NULL DEFAULT 10000,
  oil_interval_months       INTEGER NOT NULL DEFAULT 12,
  coolant_interval_km       INTEGER NOT NULL DEFAULT 100000,
  coolant_interval_months   INTEGER NOT NULL DEFAULT 60,
  brake_fluid_interval_months INTEGER NOT NULL DEFAULT 24,
  trans_interval_km         INTEGER,
  aircon_refrigerant        TEXT NOT NULL DEFAULT 'R134a',
  confidence                INTEGER DEFAULT 2,
  notes                     TEXT,
  created_at                TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.service_schedule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_schedule_public_read" ON public.service_schedule;
CREATE POLICY "service_schedule_public_read" ON public.service_schedule FOR SELECT USING (true);
DROP POLICY IF EXISTS "service_schedule_service_all" ON public.service_schedule;
CREATE POLICY "service_schedule_service_all" ON public.service_schedule USING (auth.role() = 'service_role');

INSERT INTO public.service_schedule (
  engine_family_id, coolant_capacity_l, trans_capacity_l,
  oil_interval_km, oil_interval_months,
  coolant_interval_km, coolant_interval_months,
  brake_fluid_interval_months, trans_interval_km,
  aircon_refrigerant, confidence, notes
) VALUES
  -- Toyota petrol
  ('TOY_1NZFE_15',5.5,2.0,10000,12,160000,120,24,60000,'R134a',3,'Toyota SLLC 160,000km/120mo first change then 80,000km. Aisin ATF lifetime-officially, 60k practical.'),
  ('TOY_2NZFE_13',5.0,2.0,10000,12,160000,120,24,60000,'R134a',3,NULL),
  ('TOY_1KRFE_10',4.5,6.5,10000,12,160000,120,24,60000,'R134a',3,'CVT fluid ~6.5L drain/fill, 60k interval'),
  ('TOY_2ZRFE_18',5.5,6.5,10000,12,160000,120,24,60000,'R134a/R1234yf',3,'Later E210 uses R1234yf'),
  ('TOY_1ZRFE_16',5.5,6.5,10000,12,160000,120,24,60000,'R134a',3,NULL),
  ('TOY_2ARFE_25',6.5,4.0,10000,12,160000,120,24,60000,'R1234yf',3,NULL),
  ('TOY_1AZFE_20',6.0,4.0,10000,12,160000,120,24,60000,'R134a',3,NULL),
  ('TOY_2AZFE_24',6.5,4.0,10000,12,160000,120,24,60000,'R134a',3,NULL),
  ('TOY_2GRFE_35_V6',6.5,4.0,10000,12,160000,120,24,60000,'R134a',3,NULL),
  ('TOY_1GRFE_40_V6',8.5,4.0,10000,12,160000,120,24,60000,'R134a',3,NULL),
  ('TOY_1MZFE_30_V6',6.0,4.0,10000,12,80000,60,24,60000,'R134a',3,'Older red LLC, shorter interval pre-2004'),
  ('TOY_3MZFE_33_V6',6.5,4.0,10000,12,160000,120,24,60000,'R134a',3,NULL),
  ('TOY_5VZFE_34_V6',8.0,4.0,10000,12,80000,48,24,60000,'R134a',2,NULL),
  ('TOY_4AFE_7AFE_16_18',5.5,2.0,7500,6,50000,36,24,50000,'R134a',2,'Older green IAT, 2-3yr coolant'),
  ('TOY_1NR_2NR_13_15',5.0,6.5,10000,12,160000,120,24,60000,'R1234yf',3,NULL),
  ('TOY_1JZ_25_I6',7.5,4.0,7500,6,50000,36,24,60000,'R134a',2,'JDM import, green IAT typical'),
  ('TOY_2JZ_30_I6',8.0,4.0,7500,6,50000,36,24,60000,'R134a',2,NULL),
  -- Toyota hybrid
  ('TOY_1NZFXE_15_HYBRID',5.5,NULL,10000,12,160000,120,36,NULL,'R134a',3,'e-CVT sealed. Inverter coolant separate, check at service.'),
  ('TOY_2ZRFXE_18_HYBRID',5.5,NULL,10000,12,160000,120,36,NULL,'R134a/R1234yf',3,NULL),
  ('TOY_2ARFXE_25_HYBRID',6.5,NULL,10000,12,160000,120,36,NULL,'R1234yf',3,NULL),
  ('TOY_A25AFXS_25_HYBRID',4.5,NULL,10000,12,160000,120,36,NULL,'R1234yf',3,NULL),
  -- Toyota diesel
  ('TOY_1KDFTV_30_DIESEL',10.5,4.0,10000,12,100000,48,24,80000,'R134a',3,'Big oil capacity 7.5L. Cambelt 150,000km from engine_families.'),
  ('TOY_2KDFTV_25_DIESEL',9.0,4.0,10000,12,100000,48,24,80000,'R134a',3,NULL),
  ('TOY_1GDFTV_28_DIESEL',10.5,4.0,10000,12,160000,120,24,80000,'R134a',3,'Chain, no cambelt. DPF regen needs highway runs.'),
  ('TOY_2GDFTV_24_DIESEL',9.5,4.0,10000,12,160000,120,24,80000,'R134a',3,NULL),
  ('TOY_1KZTE_30_TDIESEL',9.0,4.0,7500,6,50000,36,24,60000,'R134a',2,NULL),
  ('TOY_1HZ_42_DIESEL_I6',13.0,4.5,5000,6,50000,36,24,NULL,'R134a',2,'Heavy duty, 5,000km oil interval, manual box'),
  ('TOY_5LE_30_DIESEL',9.5,4.0,5000,6,50000,36,24,60000,'R134a',2,NULL),
  -- VW Group
  ('VW_EA211_14_TSI',6.0,7.0,15000,12,210000,120,36,60000,'R134a/R1234yf',3,'VW long-life oil 15k/12mo. DSG DQ200/DQ381 60,000km, ~7L. Cambelt 210k.'),
  ('VW_EA888_20_TSI',7.5,7.0,15000,12,210000,120,36,60000,'R134a/R1234yf',3,NULL),
  ('VW_EA189_20_TDI',7.0,7.0,15000,12,210000,120,36,60000,'R134a',3,'Cambelt 140,000km from engine_families.'),
  ('VW_EA211_GTE_PHEV',6.0,6.0,15000,12,210000,120,36,60000,'R1234yf',3,'DQ400e wet-clutch DCT G055540, 60k. Separate inverter loop.'),
  ('VW_EA111_14_TSI',6.5,7.0,15000,12,120000,60,36,60000,'R134a',2,'Chain (not belt). Earlier oil interval some markets.'),
  ('VW_EA113_20_TFSI',7.5,7.0,15000,12,120000,60,36,60000,'R134a',2,'Belt 160,000km.'),
  ('AUDI_30_TDI_V6',10.0,8.0,15000,12,210000,120,36,80000,'R134a',2,NULL),
  -- Nissan
  ('NIS_HR15DE_15',5.0,7.0,10000,12,160000,90,24,60000,'R134a',3,'Nissan blue LLC. CVT RE0F08 fluid NS-2/NS-3, 60k.'),
  ('NIS_MR18DE_18',6.0,7.0,10000,12,160000,90,24,60000,'R134a',3,NULL),
  ('NIS_MR20DE_20',6.5,8.0,10000,12,160000,90,24,60000,'R134a',3,NULL),
  ('NIS_QR25DE_25',7.0,8.0,10000,12,160000,90,24,60000,'R134a',3,NULL),
  ('NIS_VQ35DE_35_V6',7.0,5.0,10000,12,160000,90,24,60000,'R134a',3,NULL),
  ('NIS_VQ25_VQ30_V6',6.5,5.0,7500,6,50000,36,24,60000,'R134a',2,NULL),
  ('NIS_SR20_20',5.5,4.0,7500,6,50000,36,24,50000,'R134a',2,NULL),
  ('NIS_YD25_25_DIESEL',9.5,5.0,10000,12,100000,48,24,80000,'R134a',2,NULL),
  ('NIS_ZD30_30_DIESEL',10.0,4.0,5000,6,50000,36,24,NULL,'R134a',2,NULL),
  ('NIS_VK56_56_V8',9.0,5.0,10000,12,160000,90,24,80000,'R134a',2,NULL),
  ('NIS_LEAF_BEV',1.5,NULL,0,0,160000,120,36,NULL,'R134a/R1234yf',3,'No engine oil. Inverter/motor coolant only ~1.5L check. ZE1 uses R1234yf.'),
  -- Mazda
  ('MAZ_SKYACTIVG_20',6.0,4.0,10000,12,200000,120,24,60000,'R134a/R1234yf',3,'Mazda FL22 yellow, very long life. SkyActiv-Drive 6AT ATF FZ.'),
  ('MAZ_SKYACTIVG_25',6.5,4.0,10000,12,200000,120,24,60000,'R1234yf',3,NULL),
  ('MAZ_SKYACTIVG_15',5.5,4.0,10000,12,200000,120,24,60000,'R1234yf',3,NULL),
  ('MAZ_SKYACTIVD_22',8.0,4.0,10000,12,200000,120,24,60000,'R1234yf',3,'DPF, DL-1 oil. Low compression diesel.'),
  ('MAZ_ZY_VE_15',5.0,4.0,10000,12,160000,80,24,60000,'R134a',2,NULL),
  ('MAZ_B6_BP_FS_LEGACY',4.5,4.0,7500,6,50000,36,24,50000,'R134a',2,NULL),
  ('MAZ_13B_ROTARY',5.0,4.0,5000,6,50000,36,24,60000,'R134a',2,'Rotary needs frequent oil. Apex seal life is the real concern.'),
  -- Honda
  ('HON_L13_L15_13_15',4.0,3.5,10000,12,160000,120,24,40000,'R134a',3,'Honda Type2 blue. CVT fluid HMMF/HCF-2 ~3.5L, shorter 40k interval.'),
  ('HON_L15B_15T',4.0,3.5,10000,12,160000,120,24,40000,'R1234yf',3,NULL),
  ('HON_R18A_18',4.0,3.0,10000,12,160000,120,24,60000,'R134a',3,NULL),
  ('HON_K20_20',4.5,3.0,10000,12,160000,120,24,60000,'R134a',3,NULL),
  ('HON_K24_24',4.5,3.0,10000,12,160000,120,24,60000,'R134a',3,NULL),
  ('HON_B_SERIES_16_18_20',4.0,3.0,7500,6,50000,36,24,50000,'R134a',2,NULL),
  ('HON_J_SERIES_V6',4.5,3.5,10000,12,160000,120,24,60000,'R134a',2,NULL),
  ('HON_LEB_15_IDCD_HYBRID',3.7,2.5,10000,12,160000,120,36,40000,'R1234yf',3,'i-DCD 7-speed DCT needs specific fluid, 40k.'),
  -- Subaru
  ('SUB_EJ25_25_BOXER_BELT',6.0,4.0,10000,12,160000,96,24,60000,'R134a',3,'Cambelt 160,000km. Boxer access adds labour.'),
  ('SUB_EJ20_20_TURBO',5.0,4.0,7500,6,100000,60,24,60000,'R134a',3,'Turbo, more frequent oil. Cambelt 160k but many do 100k.'),
  ('SUB_FB25_25_CHAIN',6.0,12.0,10000,12,160000,132,24,60000,'R1234yf',3,'Lineartronic CVT TR580 ~12L total, high-temp fluid.'),
  ('SUB_FB20_20_CHAIN',5.5,12.0,10000,12,160000,132,24,60000,'R1234yf',3,NULL),
  ('SUB_EZ30_EZ36_H6',7.0,4.0,10000,12,160000,132,24,60000,'R134a',2,NULL),
  -- Ford
  ('FORD_P5AT_32_TDCI',10.5,4.0,15000,12,240000,120,24,60000,'R134a',3,'Wet belt 240,000km BUT oil discipline critical. Oil 8.5L. 6R80 ATF.'),
  ('FORD_YN2S_20_BITURBO',8.0,4.0,15000,12,160000,120,24,60000,'R1234yf',3,'Chain. 10R80 10-speed auto.'),
  ('FORD_BARRA_40_I6',7.5,5.0,15000,12,160000,120,24,60000,'R134a',2,NULL),
  -- Mitsubishi
  ('MIT_4N15_24_DIESEL',8.5,4.0,15000,12,160000,120,24,80000,'R134a',3,'Chain. DPF. MIVEC diesel.'),
  ('MIT_4B11_4B12_20_24',5.5,8.0,15000,12,160000,120,24,60000,'R134a',3,'Jatco CVT JF011E ~8L.'),
  ('MIT_4D56_25_DIESEL',8.5,4.0,7500,6,100000,48,24,60000,'R134a',2,'Cambelt 100,000km mandatory.'),
  ('MIT_4M41_32_DIESEL',10.0,4.0,10000,12,100000,60,24,80000,'R134a',2,NULL),
  ('MIT_4G63_20_TURBO',5.0,4.0,7500,6,100000,48,24,NULL,'R134a',2,'EVO. Cambelt 100k. Manual box.'),
  ('MIT_OUTLANDER_PHEV_24',5.5,NULL,15000,12,160000,120,36,NULL,'R1234yf',3,'Twin motor e-CVT. Separate inverter coolant.'),
  -- Suzuki
  ('SUZ_K12B_12',3.5,6.0,10000,12,160000,120,24,60000,'R134a',3,NULL),
  ('SUZ_K14_14',4.0,4.0,10000,12,160000,120,24,60000,'R1234yf',3,NULL),
  ('SUZ_M16A_16',4.5,4.0,10000,12,160000,100,24,60000,'R134a',3,NULL),
  ('SUZ_K6A_F6A_KEI',3.0,4.0,7500,6,80000,48,24,50000,'R134a',2,'Kei turbo, frequent oil.'),
  -- Hyundai/Kia
  ('HKM_G4FC_16',4.0,4.0,15000,12,200000,120,24,60000,'R134a',3,'Cambelt 160,000km. OAT coolant long life.'),
  ('HKM_G4FG_G4NA_CHAIN',4.5,4.0,15000,12,200000,120,24,60000,'R1234yf',3,NULL),
  ('HKM_D4HA_20_DIESEL',7.0,4.0,15000,12,200000,120,24,80000,'R1234yf',3,'Chain. DPF. R-series CRDi.'),
  ('HKM_THETA_II_20_24',5.0,4.0,15000,12,200000,120,24,60000,'R134a',3,'2.4 GDI known failures high km — flag at intake.'),
  ('HKM_SMARTSTREAM_16_HYBRID',4.0,2.5,15000,12,200000,120,36,40000,'R1234yf',3,'6-speed DCT hybrid, specific fluid.'),
  ('HKM_EV_BEV',1.5,NULL,0,0,200000,120,36,NULL,'R1234yf',3,'No engine oil. Battery+motor coolant loops.'),
  -- BMW / Mercedes existing
  ('BMW_N20_20_TURBO',6.5,8.0,15000,12,200000,60,24,80000,'R134a',3,'ZF8HP ''lifetime'' but 80k recommended. Chain known to stretch.'),
  ('BMW_B48_20_TURBO',6.5,8.0,15000,12,200000,60,24,80000,'R1234yf',3,NULL),
  ('BMW_B47_20_DIESEL',7.0,8.0,20000,12,200000,60,24,80000,'R1234yf',3,'N57 predecessor had chain issues; B47 improved.'),
  ('MB_M274_20_TURBO',7.0,7.0,15000,12,200000,60,24,80000,'R134a/R1234yf',3,'7G/9G-Tronic. MB 229.5 oil.'),
  ('MB_OM651_21_DIESEL',8.5,7.0,20000,12,200000,60,24,80000,'R1234yf',3,NULL),
  ('MB_M271_18_FORCED',7.0,7.0,15000,12,200000,60,24,80000,'R134a',2,NULL),
  -- BEV
  ('TES_MODEL3_BEV',0.0,NULL,0,0,0,48,24,NULL,'R1234yf',3,'No engine oil, no coolant flush schedule (sealed). Brake fluid 2yr, cabin filter, A/C desiccant.'),
  ('BYD_BLADE_BEV',0.0,NULL,0,0,0,48,24,NULL,'R1234yf',3,'LFP blade. Cell-to-pack, minimal thermal service.'),
  -- Isuzu / Chinese existing
  ('ISU_4JJ1_30_DIESEL',10.0,4.0,10000,12,100000,60,24,80000,'R134a',2,NULL),
  ('MG_SAIC_15_TURBO',4.5,6.0,10000,12,160000,120,24,60000,'R1234yf',2,NULL),
  ('GWM_4N20_20_TURBO',5.0,6.0,10000,12,160000,120,24,60000,'R1234yf',2,NULL),
  ('LDV_MAXUS_DIESEL',7.0,4.0,15000,12,100000,60,24,80000,'R134a',2,NULL),
  ('DAI_KF_KEI',2.8,4.0,7500,6,80000,48,24,50000,'R134a',2,NULL),
  -- Chunk D new families
  ('LR_INGENIUM_20_DIESEL',8.5,8.0,16000,12,200000,120,24,80000,'R1234yf',2,'JLR wet belt. Oil 6.0L. ZF8HP ATF. JLR coolant long-life OAT.'),
  ('LR_INGENIUM_20_PETROL',8.5,8.0,16000,12,200000,120,24,80000,'R1234yf',2,'Chain. Oil 5.5L. ZF8HP ATF.'),
  ('LR_AJ_V6_30_DIESEL',11.0,8.0,16000,12,200000,120,24,80000,'R1234yf',2,'Wet belt at rear. Oil 7.2L. ZF8HP ATF. Notorious failure if oil neglected.'),
  ('LR_50_SC_V8',13.0,8.0,16000,12,200000,120,24,80000,'R1234yf',2,'Chain. Oil 8.5L. ZF8HP ATF. Large capacity V8.'),
  ('MINI_PRINCE_16',5.5,5.0,15000,12,80000,60,36,60000,'R134a',2,'Chain. N14/N18 timing chain tensioner failure is THE known Mini problem. Pre-2014 era R134a.'),
  ('MINI_B38_15_TURBO',5.5,5.0,15000,12,200000,120,36,60000,'R1234yf',2,'Chain 3cyl. 7DCT or Aisin AT.'),
  ('BMW_B58_30_TURBO',9.0,8.0,15000,12,200000,60,24,80000,'R1234yf',2,'Chain I6. ZF8HP ''lifetime'' but 80k recommended.'),
  ('BMW_N57_30_DIESEL',9.0,8.0,20000,12,200000,60,24,80000,'R1234yf',2,'Chain I6 diesel. Rear timing chain on early N57.'),
  ('MB_M256_30_TURBO_MHEV',9.5,7.0,15000,12,200000,60,24,80000,'R1234yf',2,'Chain I6 MHEV. 9G-Tronic. MB OAT coolant.'),
  ('MB_OM654_20_DIESEL',8.0,7.0,20000,12,200000,60,24,80000,'R1234yf',2,'Chain I4 diesel. 9G-Tronic. Improved over OM651.'),
  ('AUDI_EA839_30_TFSI_V6',9.5,8.0,15000,12,210000,120,36,80000,'R1234yf',2,'Chain V6 TFSI. ZF8HP or S-Tronic DL501.'),
  ('VW_EA211_10_TSI_3CYL',6.0,7.0,15000,12,210000,120,36,60000,'R1234yf',2,'Belt 3cyl. DSG DQ200 ~7L. 210k belt interval.'),
  ('VOLVO_VEA_20_PETROL',8.5,6.0,15000,12,200000,120,24,80000,'R1234yf',2,'Wet belt drives oil pump. T5/T6/T8 variants. Aisin 8AT.'),
  ('VOLVO_VEA_20_DIESEL',8.5,6.0,15000,12,200000,120,24,80000,'R1234yf',2,'Wet belt diesel. D4/D5. DPF. Aisin 8AT.'),
  ('GWM_GW4D20_20_DIESEL',7.0,5.0,10000,12,100000,60,24,60000,'R1234yf',2,'Chain. ZF8AT or 6MT. NZ data confidence 2.'),
  ('BYD_DMI_15_HYBRID',5.0,NULL,10000,12,0,48,36,NULL,'R1234yf',2,'Atkinson/PHEV. e-CVT sealed. LFP blade battery. Engine + battery coolant loops.'),
  ('CHERY_15_TURBO',5.0,4.5,10000,12,100000,60,24,60000,'R1234yf',2,'Chain. CVT or 7DCT. Emerging NZ market data.')
ON CONFLICT (engine_family_id) DO NOTHING;

-- ── SECTION 7: job_times_reference ───────────────────────────────────────────
-- Brake pad floor: hours_high minimum 2.25hr for brake_pads_front,
-- brake_pads_rear, brake_pads_and_rotors_front (where < 2.25)

CREATE TABLE IF NOT EXISTS public.job_times_reference (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_slug   TEXT NOT NULL,
  tier       TEXT NOT NULL,
  hours_low  NUMERIC NOT NULL,
  hours_high NUMERIC NOT NULL,
  confidence INTEGER DEFAULT 3,
  notes      TEXT,
  UNIQUE(job_slug, tier)
);

ALTER TABLE public.job_times_reference ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "job_times_reference_public_read" ON public.job_times_reference;
CREATE POLICY "job_times_reference_public_read" ON public.job_times_reference FOR SELECT USING (true);
DROP POLICY IF EXISTS "job_times_reference_service_all" ON public.job_times_reference;
CREATE POLICY "job_times_reference_service_all" ON public.job_times_reference USING (auth.role() = 'service_role');

INSERT INTO public.job_times_reference (job_slug, tier, hours_low, hours_high, confidence, notes) VALUES
  -- Oil / basic service
  ('oil_change','economy',0.4,0.6,3,NULL),
  ('oil_change','mid',0.4,0.7,3,NULL),
  ('oil_change','premium',0.5,0.8,3,NULL),
  ('oil_change','luxury',0.6,0.9,3,'Undertray + reset service computer'),
  ('oil_change','hybrid',0.4,0.7,3,NULL),
  ('oil_change','diesel',0.5,0.8,3,'Larger oil volume, more drain time'),
  ('basic_service','economy',0.6,1.0,3,'Oil, filter, inspection, top-ups'),
  ('basic_service','mid',0.7,1.1,3,NULL),
  ('basic_service','premium',0.8,1.2,3,NULL),
  ('basic_service','luxury',0.9,1.4,3,NULL),
  ('basic_service','hybrid',0.6,1.1,3,NULL),
  ('basic_service','diesel',0.8,1.3,3,'Fuel filter check, DPF status'),
  ('comprehensive_service','economy',1.2,1.8,3,NULL),
  ('comprehensive_service','mid',1.4,2.0,3,NULL),
  ('comprehensive_service','premium',1.5,2.2,3,NULL),
  ('comprehensive_service','luxury',1.6,2.4,3,NULL),
  ('comprehensive_service','hybrid',1.4,2.0,3,NULL),
  ('comprehensive_service','diesel',1.5,2.4,3,NULL),
  -- Brakes — 2.25hr floor applied to hours_high on pad-only rows
  ('brake_pads_front','economy',0.8,2.25,3,'Pads only ~0.8hr — floor 2.25hr applied'),
  ('brake_pads_front','mid',0.9,2.25,3,NULL),
  ('brake_pads_front','premium',1.0,2.25,3,NULL),
  ('brake_pads_front','luxury',1.2,2.25,3,'Electronic parking brake retract tool'),
  ('brake_pads_front','hybrid',0.9,2.25,3,NULL),
  ('brake_pads_rear','economy',0.8,2.25,3,NULL),
  ('brake_pads_rear','mid',0.9,2.25,3,NULL),
  ('brake_pads_rear','premium',1.0,2.25,3,NULL),
  ('brake_pads_rear','luxury',1.2,2.25,3,'EPB rear common, needs scan tool'),
  ('brake_pads_rear','hybrid',1.0,2.25,3,NULL),
  ('brake_pads_and_rotors_front','economy',1.2,2.25,3,NULL),
  ('brake_pads_and_rotors_front','mid',1.4,2.25,3,NULL),
  ('brake_pads_and_rotors_front','premium',1.5,2.25,3,NULL),
  ('brake_pads_and_rotors_front','luxury',1.8,2.5,3,'Above 2.25hr floor — stays 2.5hr'),
  -- Timing
  ('cambelt_full','economy',3.0,4.5,3,'Belt+tensioner+water pump, inline 4'),
  ('cambelt_full','mid',3.5,5.0,3,NULL),
  ('cambelt_full','premium',4.0,5.5,3,'VW EA211, Subaru boxer access'),
  ('cambelt_full','luxury',4.5,6.5,3,'Euro V6/V engine, more teardown'),
  ('cambelt_full','diesel',4.0,6.0,3,'Toyota KD diesel, more ancillaries'),
  ('cambelt_boxer','premium',4.5,6.5,3,'Subaru EJ — engine access penalty'),
  ('cambelt_v6','premium',4.5,6.0,3,'1MZ/2JZ/6G7x — rear bank access'),
  ('wet_belt_replacement','wet_belt',6.0,9.0,3,'Ford Ranger 3.2 — belt in oil bath'),
  -- Fluid services
  ('coolant_flush','economy',0.8,1.2,3,NULL),
  ('coolant_flush','mid',0.9,1.4,3,NULL),
  ('coolant_flush','premium',1.0,1.6,3,'Bleed procedure on some Euro'),
  ('coolant_flush','luxury',1.2,1.8,3,NULL),
  ('coolant_flush','hybrid',1.0,1.6,3,'Two loops: engine + inverter'),
  ('brake_fluid_flush','economy',0.5,0.8,3,NULL),
  ('brake_fluid_flush','mid',0.5,0.9,3,NULL),
  ('brake_fluid_flush','premium',0.6,1.0,3,NULL),
  ('brake_fluid_flush','luxury',0.7,1.2,3,'Scan-tool ABS bleed'),
  ('transmission_service','economy',0.8,1.3,3,'Drain/fill ATF or CVT'),
  ('transmission_service','mid',0.9,1.5,3,NULL),
  ('transmission_service','premium',1.0,1.8,3,NULL),
  ('transmission_service','luxury',1.5,2.5,3,'ZF8HP pan+filter, fill-to-temp'),
  ('dsg_service','premium',1.5,2.5,3,'DSG/DCT oil+filter, fill procedure'),
  -- Common repairs
  ('spark_plugs','economy',0.5,1.0,3,NULL),
  ('spark_plugs','mid',0.6,1.2,3,NULL),
  ('spark_plugs','premium',0.8,1.5,3,'Coil-on-plug, intake removal some'),
  ('spark_plugs','luxury',1.0,2.0,3,NULL),
  ('spark_plugs_v6','premium',1.5,2.5,3,'Rear bank under intake manifold'),
  ('water_pump_standalone','mid',1.5,3.0,2,'If not done with cambelt'),
  ('alternator','mid',1.0,2.0,2,NULL),
  ('starter_motor','mid',1.0,2.5,2,NULL),
  ('aircon_regas','economy',0.5,1.0,3,'R1234yf gas much dearer than R134a')
ON CONFLICT (job_slug, tier) DO NOTHING;

-- ── SECTION 8: body_type_multiplier ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.body_type_multiplier (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  body_type   TEXT UNIQUE NOT NULL,
  multiplier  NUMERIC NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.body_type_multiplier ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "body_type_multiplier_public_read" ON public.body_type_multiplier;
CREATE POLICY "body_type_multiplier_public_read" ON public.body_type_multiplier FOR SELECT USING (true);
DROP POLICY IF EXISTS "body_type_multiplier_service_all" ON public.body_type_multiplier;
CREATE POLICY "body_type_multiplier_service_all" ON public.body_type_multiplier USING (auth.role() = 'service_role');

INSERT INTO public.body_type_multiplier (body_type, multiplier) VALUES
  ('hatch',       1.00),
  ('sedan',       1.00),
  ('wagon',       1.00),
  ('coupe',       1.05),
  ('convertible', 1.05),
  ('suv',         1.10),
  ('ute',         1.15),
  ('van',         1.15),
  ('kei',         0.95)
ON CONFLICT (body_type) DO NOTHING;

-- ── SECTION 9: body_type_exempt_jobs ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.body_type_exempt_jobs (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_slug TEXT UNIQUE NOT NULL
);

ALTER TABLE public.body_type_exempt_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "body_type_exempt_jobs_public_read" ON public.body_type_exempt_jobs;
CREATE POLICY "body_type_exempt_jobs_public_read" ON public.body_type_exempt_jobs FOR SELECT USING (true);
DROP POLICY IF EXISTS "body_type_exempt_jobs_service_all" ON public.body_type_exempt_jobs;
CREATE POLICY "body_type_exempt_jobs_service_all" ON public.body_type_exempt_jobs USING (auth.role() = 'service_role');

INSERT INTO public.body_type_exempt_jobs (job_slug) VALUES
  ('oil_change'),
  ('brake_fluid_flush'),
  ('aircon_regas'),
  ('spark_plugs')
ON CONFLICT (job_slug) DO NOTHING;

-- ── SECTION 10: tier_parts_reference — EX-GST, engine applies ×1.15 ─────────

CREATE TABLE IF NOT EXISTS public.tier_parts_reference (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_slug              TEXT NOT NULL,
  tier                  TEXT NOT NULL,
  part_cost_low_ex_gst  NUMERIC NOT NULL,
  part_cost_high_ex_gst NUMERIC NOT NULL,
  confidence            INTEGER DEFAULT 2,
  notes                 TEXT,
  UNIQUE(job_slug, tier)
);

ALTER TABLE public.tier_parts_reference ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tier_parts_reference_public_read" ON public.tier_parts_reference;
CREATE POLICY "tier_parts_reference_public_read" ON public.tier_parts_reference FOR SELECT USING (true);
DROP POLICY IF EXISTS "tier_parts_reference_service_all" ON public.tier_parts_reference;
CREATE POLICY "tier_parts_reference_service_all" ON public.tier_parts_reference USING (auth.role() = 'service_role');

INSERT INTO public.tier_parts_reference (job_slug, tier, part_cost_low_ex_gst, part_cost_high_ex_gst, confidence, notes) VALUES
  -- Brake pads (per axle, ex-GST)
  ('brake_pads_front','economy',35,110,3,'Aftermarket pads/axle, NZ'),
  ('brake_pads_front','mid',60,160,3,NULL),
  ('brake_pads_front','premium',90,220,3,'VW/Subaru OE-quality'),
  ('brake_pads_front','luxury',140,350,3,'BMW/Merc/JLR pads'),
  ('brake_pads_front','hybrid',70,180,3,NULL),
  ('brake_pads_rear','economy',35,110,3,NULL),
  ('brake_pads_rear','mid',60,160,3,NULL),
  ('brake_pads_rear','premium',90,220,3,NULL),
  ('brake_pads_rear','luxury',140,350,3,NULL),
  ('brake_pads_and_rotors_front','economy',110,240,2,'Pads + 2 rotors'),
  ('brake_pads_and_rotors_front','mid',160,360,2,NULL),
  ('brake_pads_and_rotors_front','premium',240,500,2,NULL),
  ('brake_pads_and_rotors_front','luxury',380,850,2,NULL),
  -- Cambelt kit (ex-GST)
  ('cambelt_full','economy',120,280,3,'Gates/Dayco kit + water pump'),
  ('cambelt_full','mid',180,380,3,NULL),
  ('cambelt_full','premium',280,550,3,'VW EA211, Subaru boxer kit'),
  ('cambelt_full','luxury',400,800,2,'Euro V6 / premium OE kit'),
  ('cambelt_full','diesel',250,550,3,'Toyota KD diesel kit'),
  ('wet_belt_replacement','wet_belt',200,450,2,'Ford/JLR/Volvo wet belt kit + oil pump screen. Labour is the big cost.'),
  -- Oil filter (ex-GST)
  ('oil_filter','economy',8,20,3,'Spin-on or cartridge'),
  ('oil_filter','mid',10,25,3,NULL),
  ('oil_filter','premium',14,35,3,'VW/Euro cartridge'),
  ('oil_filter','luxury',18,45,3,'BMW/Merc/JLR OE cartridge'),
  ('oil_filter','hybrid',10,28,3,NULL),
  ('oil_filter','diesel',14,35,3,NULL),
  -- Cabin / air filters (ex-GST)
  ('cabin_filter','economy',12,30,3,NULL),
  ('cabin_filter','mid',15,38,3,NULL),
  ('cabin_filter','premium',20,50,3,NULL),
  ('cabin_filter','luxury',28,70,3,NULL),
  ('air_filter','economy',12,32,3,NULL),
  ('air_filter','mid',15,40,3,NULL),
  ('air_filter','premium',22,55,3,NULL),
  ('air_filter','luxury',30,75,3,NULL),
  -- Spark plugs (set, ex-GST)
  ('spark_plugs','economy',25,70,3,'4cyl iridium set'),
  ('spark_plugs','mid',35,90,3,NULL),
  ('spark_plugs','premium',50,130,3,'Turbo, twin-plug some'),
  ('spark_plugs','luxury',70,180,3,'6cyl premium iridium'),
  ('spark_plugs_v6','premium',60,160,2,'6 plugs'),
  -- Common wear parts (ex-GST)
  ('water_pump_standalone','mid',60,200,2,NULL),
  ('alternator','mid',180,550,2,'Reco vs new range'),
  ('starter_motor','mid',150,450,2,NULL),
  ('front_shock_absorber','mid',80,250,2,'Each'),
  ('control_arm','mid',90,280,2,'Each, with bushes'),
  ('wheel_bearing','mid',60,220,2,'Each'),
  ('cv_joint','mid',80,260,2,'Outer CV / shaft'),
  ('12v_battery','economy',120,220,3,'Std flooded'),
  ('12v_battery','premium',200,380,3,'AGM stop-start'),
  ('radiator','mid',150,450,2,NULL),
  ('ignition_coil','mid',40,140,2,'Each'),
  ('cabin_pollen_wiper_set','economy',25,70,2,'Wiper blade pair'),
  -- EV/Hybrid consumables (ex-GST)
  ('ev_cabin_filter','bev',18,55,2,'Tesla/BYD/Hyundai EV cabin filter'),
  ('hv_coolant_service','hybrid',30,90,2,'Inverter/battery loop coolant')
ON CONFLICT (job_slug, tier) DO NOTHING;

-- ── SECTION 11: refrigerant_cost — EX-GST ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.refrigerant_cost (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gas_type                   TEXT UNIQUE NOT NULL,
  cost_per_charge_low_ex_gst NUMERIC NOT NULL,
  cost_per_charge_high_ex_gst NUMERIC NOT NULL,
  confidence                 INTEGER DEFAULT 3,
  notes                      TEXT
);

ALTER TABLE public.refrigerant_cost ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "refrigerant_cost_public_read" ON public.refrigerant_cost;
CREATE POLICY "refrigerant_cost_public_read" ON public.refrigerant_cost FOR SELECT USING (true);
DROP POLICY IF EXISTS "refrigerant_cost_service_all" ON public.refrigerant_cost;
CREATE POLICY "refrigerant_cost_service_all" ON public.refrigerant_cost USING (auth.role() = 'service_role');

INSERT INTO public.refrigerant_cost (gas_type, cost_per_charge_low_ex_gst, cost_per_charge_high_ex_gst, confidence, notes) VALUES
  ('R134a', 40, 90, 3, 'Older systems pre-2017. ~$15-30/100g gas. Full charge ~500-900g.'),
  ('R1234yf', 150, 320, 3, 'Mandatory newer systems. ~$80-160/100g — 6-10x R134a. Big cost step. Many NZ workshops still tooling up for it.')
ON CONFLICT (gas_type) DO NOTHING;

-- ── SECTION 12: ef_parts_data for 17 new chunk_d engine families ─────────────
-- total_job_low/high are NZD GST-INCLUSIVE (direct from job_anchor prices)

INSERT INTO public.ef_parts_data (
  engine_family_id, category_id,
  total_job_low, total_job_high, hours_low, hours_high,
  source_anchor, confidence, notes
)
SELECT v.engine_family_id,
       (SELECT id FROM public.part_categories WHERE slug = v.slug),
       v.low, v.high, v.hl, v.hh, v.anchor, v.conf, v.notes
FROM (VALUES
  -- LR_INGENIUM_20_DIESEL
  ('LR_INGENIUM_20_DIESEL','wet_belt_replacement',2000,3200,6.0,9.0,'cambelt_ford_ranger_wet_belt',2,'Ingenium wet belt — JLR-specific oil mandatory'),
  ('LR_INGENIUM_20_DIESEL','brake_pads_front',450,700,0.8,1.3,'brake_pads_luxury',3,NULL),
  ('LR_INGENIUM_20_DIESEL','basic_service',450,650,1.0,1.5,'basic_service_premium',3,NULL),
  -- LR_INGENIUM_20_PETROL
  ('LR_INGENIUM_20_PETROL','brake_pads_front',450,700,0.8,1.3,'brake_pads_luxury',3,NULL),
  ('LR_INGENIUM_20_PETROL','basic_service',450,650,1.0,1.5,'basic_service_premium',3,NULL),
  -- LR_AJ_V6_30_DIESEL
  ('LR_AJ_V6_30_DIESEL','wet_belt_replacement',2500,4000,7.0,11.0,'cambelt_ford_ranger_wet_belt',2,'Rear-mounted wet belt — engine/box drop. Major job.'),
  ('LR_AJ_V6_30_DIESEL','brake_pads_front',500,800,0.9,1.4,'brake_pads_luxury',3,NULL),
  ('LR_AJ_V6_30_DIESEL','basic_service',500,750,1.2,1.8,'comprehensive_service_premium',3,NULL),
  -- LR_50_SC_V8
  ('LR_50_SC_V8','brake_pads_front',700,1100,1.0,1.6,'brake_pads_luxury',3,'Large brembo-style brakes, big rotors'),
  ('LR_50_SC_V8','basic_service',600,850,1.2,1.8,'comprehensive_service_premium',3,NULL),
  -- MINI_PRINCE_16
  ('MINI_PRINCE_16','brake_pads_front',350,550,0.7,1.1,'brake_pads_premium',3,NULL),
  ('MINI_PRINCE_16','basic_service',350,500,0.8,1.2,'basic_service_premium',3,NULL),
  ('MINI_PRINCE_16','timing_chain_replacement',1200,2000,4.0,6.0,'comprehensive_service_premium',2,'N14/N18 timing chain TENSIONER failure — death rattle on cold start. Common at 80-120k.'),
  -- MINI_B38_15_TURBO
  ('MINI_B38_15_TURBO','brake_pads_front',380,580,0.7,1.1,'brake_pads_premium',3,NULL),
  ('MINI_B38_15_TURBO','basic_service',380,520,0.8,1.2,'basic_service_premium',3,NULL),
  -- BMW_B58_30_TURBO
  ('BMW_B58_30_TURBO','brake_pads_front',500,800,0.7,1.2,'brake_pads_luxury',3,NULL),
  ('BMW_B58_30_TURBO','basic_service',450,650,0.9,1.4,'comprehensive_service_premium',3,NULL),
  -- BMW_N57_30_DIESEL
  ('BMW_N57_30_DIESEL','brake_pads_front',500,750,0.7,1.2,'brake_pads_luxury',3,NULL),
  ('BMW_N57_30_DIESEL','basic_service',450,650,0.9,1.4,'comprehensive_service_premium',3,NULL),
  ('BMW_N57_30_DIESEL','timing_chain_replacement',2500,4500,8.0,14.0,'comprehensive_service_premium',2,'N57 timing chain is at the REAR (gearbox end) — engine out.'),
  -- MB_M256_30_TURBO_MHEV
  ('MB_M256_30_TURBO_MHEV','brake_pads_front',550,850,0.8,1.3,'brake_pads_luxury',3,NULL),
  ('MB_M256_30_TURBO_MHEV','basic_service',500,700,0.9,1.4,'comprehensive_service_premium',3,NULL),
  -- MB_OM654_20_DIESEL
  ('MB_OM654_20_DIESEL','brake_pads_front',450,700,0.7,1.2,'brake_pads_luxury',3,NULL),
  ('MB_OM654_20_DIESEL','basic_service',450,650,0.9,1.4,'comprehensive_service_premium',3,NULL),
  -- AUDI_EA839_30_TFSI_V6
  ('AUDI_EA839_30_TFSI_V6','brake_pads_front',500,800,0.7,1.2,'brake_pads_luxury',3,NULL),
  ('AUDI_EA839_30_TFSI_V6','basic_service',480,680,0.9,1.4,'comprehensive_service_premium',3,NULL),
  -- VW_EA211_10_TSI_3CYL
  ('VW_EA211_10_TSI_3CYL','cambelt_full',850,1200,4.0,5.5,'cambelt_vw_ea211',3,'Same EA211 belt family — 210,000km kevlar belt'),
  ('VW_EA211_10_TSI_3CYL','brake_pads_front',280,420,0.6,1.0,'brake_pads_mid',3,NULL),
  ('VW_EA211_10_TSI_3CYL','basic_service',280,380,0.8,1.2,'basic_service_mid',3,NULL),
  -- VOLVO_VEA_20_PETROL
  ('VOLVO_VEA_20_PETROL','wet_belt_replacement',1500,2500,5.0,8.0,'cambelt_ford_ranger_wet_belt',2,'VEA wet belt drives oil pump'),
  ('VOLVO_VEA_20_PETROL','brake_pads_front',400,650,0.7,1.2,'brake_pads_luxury',3,NULL),
  ('VOLVO_VEA_20_PETROL','basic_service',400,580,0.9,1.4,'basic_service_premium',3,NULL),
  -- VOLVO_VEA_20_DIESEL
  ('VOLVO_VEA_20_DIESEL','wet_belt_replacement',1500,2500,5.0,8.0,'cambelt_ford_ranger_wet_belt',2,NULL),
  ('VOLVO_VEA_20_DIESEL','brake_pads_front',400,650,0.7,1.2,'brake_pads_luxury',3,NULL),
  ('VOLVO_VEA_20_DIESEL','basic_service',400,580,0.9,1.4,'basic_service_premium',3,NULL),
  -- GWM_GW4D20_20_DIESEL
  ('GWM_GW4D20_20_DIESEL','brake_pads_front',220,340,0.6,1.0,'brake_pads_mid',2,NULL),
  ('GWM_GW4D20_20_DIESEL','basic_service',220,310,0.8,1.2,'basic_service_mid',2,'NZ workshop data limited'),
  -- BYD_DMI_15_HYBRID
  ('BYD_DMI_15_HYBRID','brake_pads_front',220,340,0.5,0.9,'brake_pads_mid',2,NULL),
  ('BYD_DMI_15_HYBRID','basic_service',200,290,0.6,1.0,'basic_service_mid',2,'Confidence 2 — emerging market'),
  -- CHERY_15_TURBO
  ('CHERY_15_TURBO','brake_pads_front',180,280,0.5,0.8,'brake_pads_economy',2,NULL),
  ('CHERY_15_TURBO','basic_service',180,260,0.6,1.0,'basic_service_economy',2,'Confidence 2 — emerging market')
) AS v(engine_family_id, slug, low, high, hl, hh, anchor, conf, notes)
WHERE (SELECT id FROM public.part_categories WHERE slug = v.slug) IS NOT NULL
ON CONFLICT (engine_family_id, category_id) DO NOTHING;

-- ── SECTION 13: Final row count report ───────────────────────────────────────

DO $$
DECLARE
  v_families      INTEGER;
  v_vehicles      INTEGER;
  v_fluids        INTEGER;
  v_ef_fluids     INTEGER;
  v_schedules     INTEGER;
  v_job_times     INTEGER;
  v_body_mult     INTEGER;
  v_body_exempt   INTEGER;
  v_tier_parts    INTEGER;
  v_refrigerant   INTEGER;
  v_ef_parts      INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_families    FROM public.engine_families;
  SELECT COUNT(*) INTO v_vehicles    FROM public.fleet_vehicles;
  SELECT COUNT(*) INTO v_fluids      FROM public.fluid_pricing;
  SELECT COUNT(*) INTO v_ef_fluids   FROM public.engine_family_fluids;
  SELECT COUNT(*) INTO v_schedules   FROM public.service_schedule;
  SELECT COUNT(*) INTO v_job_times   FROM public.job_times_reference;
  SELECT COUNT(*) INTO v_body_mult   FROM public.body_type_multiplier;
  SELECT COUNT(*) INTO v_body_exempt FROM public.body_type_exempt_jobs;
  SELECT COUNT(*) INTO v_tier_parts  FROM public.tier_parts_reference;
  SELECT COUNT(*) INTO v_refrigerant FROM public.refrigerant_cost;
  SELECT COUNT(*) INTO v_ef_parts    FROM public.ef_parts_data;

  RAISE NOTICE '=== Migration 037 row counts ===';
  RAISE NOTICE 'engine_families:       %', v_families;
  RAISE NOTICE 'fleet_vehicles:        %', v_vehicles;
  RAISE NOTICE 'fluid_pricing:         %', v_fluids;
  RAISE NOTICE 'engine_family_fluids:  %', v_ef_fluids;
  RAISE NOTICE 'service_schedule:      %', v_schedules;
  RAISE NOTICE 'job_times_reference:   %', v_job_times;
  RAISE NOTICE 'body_type_multiplier:  %', v_body_mult;
  RAISE NOTICE 'body_type_exempt_jobs: %', v_body_exempt;
  RAISE NOTICE 'tier_parts_reference:  %', v_tier_parts;
  RAISE NOTICE 'refrigerant_cost:      %', v_refrigerant;
  RAISE NOTICE 'ef_parts_data:         %', v_ef_parts;
  RAISE NOTICE '================================';
END $$;
