-- ============================================================
-- TORQUED — Migration 004: Part / Job Categories
-- The canonical list of quotable jobs. labour times + parts
-- pricing reference these by category_id.
-- ============================================================

insert into part_categories (slug, display, job_group, is_job, notes) values
-- Engine / timing
('cambelt',              'Cambelt / timing belt',        'engine',      true,  'belt-driven engines only; usually incl. tensioner + idler'),
('water_pump',           'Water pump',                   'engine',      true,  'often bundled with cambelt on belt engines'),
('serpentine_belt',      'Serpentine / accessory belt',  'engine',      true,  null),
('water_pump_belt',      'Water pump / aux drive belt',  'engine',      true,  'separate aux belt where fitted'),
('oil_pump',             'Oil pump',                     'engine',      true,  'major internal job'),
('oil_filter',           'Oil filter',                   'engine',      true,  'consumable; usually part of a service'),
('ignition_coils',       'Ignition coils',               'engine',      true,  'priced per coil set'),
('fuel_injectors',       'Fuel injectors',               'fuel',        true,  'set; diesel injectors far dearer'),
('fuel_pump',            'Fuel pump',                    'fuel',        true,  'in-tank assembly typical'),
-- Cooling
('radiator',             'Radiator',                     'cooling',     true,  null),
('radiator_hoses',       'Radiator hoses',               'cooling',     true,  'upper + lower'),
-- Brakes
('front_brake_pads',     'Front brake pads',             'brakes',      true,  'per axle'),
('front_rotors',         'Front brake rotors',           'brakes',      true,  'pair'),
('rear_brake_pads',      'Rear brake pads',              'brakes',      true,  'per axle'),
('rear_rotors',          'Rear brake rotors',            'brakes',      true,  'pair'),
('drum_brake_parts',     'Rear drum brake parts',        'brakes',      true,  'shoes + hardware where drums fitted'),
('brake_calipers',       'Brake calipers',               'brakes',      true,  'per corner; remanufactured common'),
('brake_booster',        'Brake booster',                'brakes',      true,  null),
('brake_master_cylinder','Brake master cylinder',        'brakes',      true,  'the "brake fluid pump"'),
-- Driveline / clutch
('clutch',               'Clutch kit',                   'driveline',   true,  'manual only; incl. R&R'),
('cv_joints',            'CV joints / driveshaft',       'driveline',   true,  'per side'),
('wheel_bearings',       'Wheel bearings',               'driveline',   true,  'per corner'),
-- Suspension / steering
('shock_absorbers',      'Shock absorbers',              'suspension',  true,  'rear shocks / pair'),
('macpherson_struts',    'MacPherson struts',            'suspension',  true,  'front strut assy / pair'),
('control_arms',         'Control arms',                 'suspension',  true,  'lower; per side'),
('suspension_bushings',  'Suspension bushings',          'suspension',  true,  'set per arm'),
('tie_rods',             'Tie rod ends',                 'steering',    true,  'per side'),
('steering_rack',        'Steering rack',                'steering',    true,  null),
('power_steering_pump',  'Power steering pump',          'steering',    true,  'hydraulic systems only'),
-- Electrical / sensors
('alternator',           'Alternator',                   'electrical',  true,  null),
('starter_motor',        'Starter motor',                'electrical',  true,  null),
('battery_12v',          '12V battery',                  'electrical',  true,  'supply + fit'),
('abs_sensor',           'ABS wheel speed sensor',       'electrical',  true,  'per corner'),
-- HVAC
('aircon_components',    'Air conditioning components',  'hvac',        true,  'compressor / condenser / regas'),
('cabin_air_filter',     'Cabin air filter',             'hvac',        true,  'consumable'),
-- Body / glass
('side_mirror_glass',    'Side mirror glass',            'body',        true,  'glass only vs full assy'),
('window_regulator',     'Window regulator',             'body',        true,  'per door'),
('headlights',           'Headlight unit',               'body',        true,  'per side; LED/HID far dearer'),
-- Filters
('transmission_filter',  'Transmission fluid filter',    'driveline',   true,  'auto; often with fluid service')
on conflict (slug) do nothing;
