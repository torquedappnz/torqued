-- ============================================================
-- Torqued: Vehicle database seed + specs table
-- Run in Supabase SQL Editor
-- ============================================================

-- Vehicle specs table (service intervals, fluids, pricing per vehicle)
create table if not exists public.vehicle_specs (
  rego                          text primary key references public.vehicles(rego) on delete cascade,
  engine_code                   text,
  engine_type                   text,
  engine_capacity_cc            integer,
  transmission_type             text,
  drive_type                    text,
  oil_type                      text,
  oil_capacity_litres           numeric,
  oil_service_interval_km       integer,
  transmission_fluid_type       text,
  transmission_service_interval_km integer,
  cambelt_or_chain              text,
  cambelt_interval_km           integer,
  cambelt_interval_years        integer,
  service_prices                jsonb default '{}'
);

alter table public.vehicle_specs enable row level security;
create policy "Vehicle specs publicly readable"
  on public.vehicle_specs for select using (true);

-- ── Vehicles ────────────────────────────────────────────────
insert into public.vehicles (rego, make, model, year, variant, mileage, thumbnail)
values
  ('RAH190','Volkswagen','Golf GTE',2017,'1.4 TSI PHEV EA211',84000,
   'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&q=80&w=400'),
  ('MTESLA','Tesla','Model 3',2020,'Long Range AWD Dual Motor',46000,
   'https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&q=80&w=400'),
  ('CGA689','Toyota','Echo',2004,'1.3L 2NZ-FE Automatic',178000,
   'https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&q=80&w=400'),
  ('RMG206','Kia','Seltos',2025,'2.0L MPI FWD CVT',7500,
   'https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5?auto=format&fit=crop&q=80&w=400'),
  ('QSN620','Volkswagen','Tiguan R-Line',2021,'1.4 TSI EVO 7-Speed DSG',42000,
   'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&q=80&w=400'),
  ('MAF800','Toyota','Avensis',2007,'2.0L 1AZ-FSE Automatic',154000,
   'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&q=80&w=400'),
  ('HELT0Y','Mercedes-AMG','G63',2017,'5.5L Biturbo V8 AMG',62000,
   'https://images.unsplash.com/photo-1563720360172-67b8f3dce741?auto=format&fit=crop&q=80&w=400'),
  ('BMW704','BMW','X2',2018,'S20i 2.0L sDrive F39',71000,
   'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&q=80&w=400'),
  ('EFL155','Honda','Civic',2006,'2.0L R20A Automatic',162000,
   'https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5?auto=format&fit=crop&q=80&w=400')
on conflict (rego) do update set
  make = excluded.make, model = excluded.model, year = excluded.year,
  variant = excluded.variant, mileage = excluded.mileage, thumbnail = excluded.thumbnail;

-- ── Vehicle specs + service pricing ─────────────────────────
insert into public.vehicle_specs (rego, engine_code, engine_type, engine_capacity_cc, transmission_type, drive_type, oil_type, oil_capacity_litres, oil_service_interval_km, transmission_fluid_type, transmission_service_interval_km, cambelt_or_chain, cambelt_interval_km, cambelt_interval_years, service_prices)
values
  ('RAH190','CUK','Plug-in Hybrid (Petrol + Electric)',1395,'DSG Dual Clutch Auto','FWD',
   'VW 508.00/509.00 0W-20 Full Synthetic',3.5,15000,'VW G052182A2 DSG Fluid',60000,
   'Timing Belt (EA211)',120000,5,
   '{"oil":140,"wof":69,"full":380,"battery":220,"diag_inspection":145,"spark_plugs":120,"cabin_filter":55,"brake_fluid":28,"timing":1000,"brakes_front_pads":240,"brakes_front_rotors":480,"brakes_rear_pads":195,"brakes_rear_rotors":390,"transmission":140}'::jsonb),

  ('MTESLA','N/A (Electric)','Electric (Dual Motor)',0,'Single Speed Reduction Gear','AWD',
   'N/A (Electric)',0,0,'N/A (Sealed Unit)',0,
   'N/A (Electric)',0,0,
   '{"wof":69,"diag_inspection":180,"brake_fluid":25,"brakes_front_pads":520,"brakes_front_rotors":0,"brakes_rear_pads":420,"brakes_rear_rotors":0,"battery":250,"cabin_filter":55}'::jsonb),

  ('CGA689','2NZ-FE','Petrol',1299,'4-Speed Automatic','FWD',
   '5W-30 Semi-Synthetic',3.5,10000,'Toyota T-IV ATF',80000,
   'Timing Chain',0,0,
   '{"oil":85,"wof":69,"full":220,"battery":155,"diag_inspection":120,"spark_plugs":55,"cabin_filter":25,"brake_fluid":22,"brakes_front_pads":220,"brakes_front_rotors":0,"brakes_rear_pads":180,"brakes_rear_rotors":0,"transmission":75}'::jsonb),

  ('RMG206','Nu MPI','Petrol',1999,'CVT','FWD',
   '5W-30 Full Synthetic',4.2,10000,'Kia/Hyundai SP-IV CVT Fluid',90000,
   'Timing Chain',0,0,
   '{"oil":110,"wof":69,"full":290,"battery":195,"diag_inspection":145,"spark_plugs":85,"cabin_filter":40,"brake_fluid":28,"brakes_front_pads":320,"brakes_front_rotors":0,"brakes_rear_pads":260,"brakes_rear_rotors":0,"transmission":110}'::jsonb),

  ('QSN620','DGEA','Petrol Turbo',1395,'7-Speed DSG Dual Clutch Auto','FWD',
   'VW 508.00 0W-20 Full Synthetic',4.6,15000,'VW G052182A2 DSG Fluid',60000,
   'Timing Belt (EA211)',120000,5,
   '{"oil":135,"wof":69,"full":360,"battery":215,"diag_inspection":145,"spark_plugs":110,"cabin_filter":42,"brake_fluid":28,"timing":1060,"brakes_front_pads":460,"brakes_front_rotors":0,"brakes_rear_pads":370,"brakes_rear_rotors":0,"transmission":140}'::jsonb),

  ('MAF800','1AZ-FSE','Petrol Direct Inject',1998,'4-Speed Automatic','FWD',
   '5W-30 Full Synthetic',4.7,10000,'Toyota T-IV ATF',80000,
   'Timing Belt',100000,6,
   '{"oil":95,"wof":69,"full":250,"battery":165,"diag_inspection":120,"spark_plugs":75,"cabin_filter":30,"brake_fluid":22,"timing":615,"brakes_front_pads":280,"brakes_front_rotors":0,"brakes_rear_pads":220,"brakes_rear_rotors":0,"transmission":85}'::jsonb),

  ('HELT0Y','M157','Petrol Biturbo V8',5461,'7-Speed AMG SPEEDSHIFT PLUS','AWD',
   'MB 229.5 5W-40 Full Synthetic',9.0,10000,'MB 236.15 ATF',60000,
   'Timing Chain (Twin)',0,0,
   '{"oil":280,"wof":69,"full":950,"battery":380,"diag_inspection":180,"spark_plugs":320,"cabin_filter":85,"brake_fluid":45,"brakes_front_pads":1200,"brakes_front_rotors":0,"brakes_rear_pads":980,"brakes_rear_rotors":0,"transmission":220}'::jsonb),

  ('BMW704','B48B20A','Petrol Turbo',1998,'7-Speed DCT Steptronic','FWD',
   'BMW Longlife-04 5W-30 Full Synthetic',5.0,15000,'BMW ATF 3+ DCT Fluid',80000,
   'Timing Chain',0,0,
   '{"oil":165,"wof":69,"full":480,"battery":280,"diag_inspection":160,"spark_plugs":140,"cabin_filter":55,"brake_fluid":35,"brakes_front_pads":580,"brakes_front_rotors":0,"brakes_rear_pads":460,"brakes_rear_rotors":0,"transmission":155}'::jsonb),

  ('EFL155','R20A','Petrol',1997,'5-Speed Automatic','FWD',
   'Honda Genuine 5W-30 Full Synthetic',4.0,10000,'Honda ATF-Z1',80000,
   'Timing Chain',0,0,
   '{"oil":90,"wof":69,"full":245,"battery":160,"diag_inspection":120,"spark_plugs":70,"cabin_filter":28,"brake_fluid":22,"brakes_front_pads":260,"brakes_front_rotors":0,"brakes_rear_pads":210,"brakes_rear_rotors":0,"transmission":80}'::jsonb)
on conflict (rego) do update set service_prices = excluded.service_prices;
