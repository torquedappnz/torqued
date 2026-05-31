-- ============================================================
-- Torqued: Mock parts catalog
-- A browsable catalog mechanics can order from / reference.
-- ============================================================

create table if not exists public.parts_catalog (
  id          uuid default gen_random_uuid() primary key,
  name        text not null,
  category    text not null,
  oem_number  text,
  fits        text[],           -- makes/models this part suits
  unit_price  numeric(10,2),
  supplier    text,
  in_stock    boolean default true,
  created_at  timestamptz default now()
);

alter table public.parts_catalog enable row level security;

-- Publicly readable (mechanics and customers can browse)
create policy "Parts catalog is publicly readable"
  on public.parts_catalog for select using (true);

-- Seed common NZ auto parts
insert into public.parts_catalog (name, category, oem_number, fits, unit_price, supplier) values
  ('Engine Oil Filter - Universal', 'Filters', 'Z418', ARRAY['Toyota','Holden','Ford','Nissan'], 12.50, 'Repco'),
  ('Air Filter - Panel', 'Filters', 'A1500', ARRAY['Toyota','Holden','Ford'], 28.00, 'Repco'),
  ('Cabin Air Filter', 'Filters', 'CAF1234', ARRAY['Toyota','Honda','Mazda'], 35.00, 'BNT'),
  ('Brake Pads Front - Semi-Metallic', 'Brakes', 'DB1269', ARRAY['Toyota','Holden','Subaru'], 65.00, 'Repco'),
  ('Brake Pads Rear - Ceramic', 'Brakes', 'DB1270', ARRAY['Toyota','Honda','Mazda'], 72.00, 'Repco'),
  ('Brake Rotor Front - Solid', 'Brakes', 'BR5312', ARRAY['Toyota Corolla','Toyota Camry'], 95.00, 'BNT'),
  ('Brake Fluid DOT4 500ml', 'Fluids', NULL, ARRAY['Universal'], 18.00, 'Repco'),
  ('Engine Oil 5W-30 Synthetic 5L', 'Fluids', NULL, ARRAY['Universal'], 68.00, 'Repco'),
  ('Coolant/Antifreeze 2L', 'Fluids', NULL, ARRAY['Universal'], 22.00, 'BNT'),
  ('Power Steering Fluid 1L', 'Fluids', NULL, ARRAY['Universal'], 16.00, 'Repco'),
  ('Spark Plug - Standard', 'Ignition', 'NGK BKR6E', ARRAY['Toyota','Honda','Nissan'], 8.50, 'Repco'),
  ('Spark Plug - Iridium', 'Ignition', 'NGK ILTR6A8G', ARRAY['Toyota','Honda','Subaru'], 28.00, 'EuroParts'),
  ('Ignition Coil Pack', 'Ignition', 'UF495', ARRAY['Toyota','Holden'], 85.00, 'BNT'),
  ('12V Battery 55Ah', 'Electrical', 'DIN55', ARRAY['Universal'], 180.00, 'Repco'),
  ('Alternator Remanufactured', 'Electrical', 'ALT1145', ARRAY['Toyota Hilux','Ford Ranger'], 320.00, 'BNT'),
  ('Starter Motor Remanufactured', 'Electrical', 'SMR4421', ARRAY['Toyota','Holden'], 285.00, 'BNT'),
  ('Timing Belt Kit', 'Engine', 'TB-VW-1.4', ARRAY['Volkswagen'], 215.00, 'EuroParts'),
  ('Water Pump - OEM Equivalent', 'Engine', 'WP-VW-1.4', ARRAY['Volkswagen'], 180.00, 'EuroParts'),
  ('Cambelt & Water Pump Kit VAG', 'Engine', 'INA-KIT-001', ARRAY['Volkswagen','Audi','Skoda'], 395.00, 'EuroParts'),
  ('VW DCT Transmission Oil 1L', 'Transmission', 'G052182A2', ARRAY['Volkswagen','Skoda'], 48.50, 'EuroParts'),
  ('Automatic Transmission Fluid 1L', 'Transmission', 'ATF-D6', ARRAY['Toyota','Ford','Holden'], 32.00, 'Repco'),
  ('CV Joint Boot Kit', 'Driveline', 'CV-BK-001', ARRAY['Universal'], 45.00, 'Repco'),
  ('Wheel Bearing Front', 'Suspension', 'WB-F1234', ARRAY['Toyota Corolla','Toyota Camry'], 125.00, 'BNT'),
  ('Shock Absorber Front (each)', 'Suspension', 'KYB-334371', ARRAY['Toyota Hilux'], 210.00, 'Repco'),
  ('Control Arm Bush Kit', 'Suspension', 'CAB-5501', ARRAY['Toyota','Nissan'], 65.00, 'BNT'),
  ('Wiper Blades Set (pair)', 'Accessories', NULL, ARRAY['Universal'], 42.00, 'Repco'),
  ('Engine Air Intake Hose', 'Engine', 'AIH-VW-001', ARRAY['Volkswagen Golf'], 95.00, 'EuroParts'),
  ('Thermostat & Housing VAG', 'Cooling', 'TH-VAG-1.4', ARRAY['Volkswagen','Audi'], 120.00, 'EuroParts'),
  ('Radiator Cap', 'Cooling', 'RC-108', ARRAY['Universal'], 14.00, 'Repco'),
  ('Oxygen Sensor (Lambda)', 'Exhaust', 'OS-12345', ARRAY['Toyota','Holden','Ford'], 145.00, 'BNT')
on conflict do nothing;
