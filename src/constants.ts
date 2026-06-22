import { Mechanic, Service, Vehicle } from './types';

export const SERVICES: Service[] = [
  { id: 'oil', name: 'Standard Service', icon: '🔧', basePrice: 0, category: 'maintenance' },
  { id: 'wof', name: 'Warrant of Fitness', icon: '📋', basePrice: 0, category: 'inspection' },
  { id: 'full', name: 'Full Service', icon: '🚗', basePrice: 0, category: 'maintenance' },
  { id: 'brakes_front_pads', name: 'Front Brake Pads', icon: '🛑', basePrice: 0, category: 'repair' },
  { id: 'brakes_front_rotors', name: 'Front Rotors & Pads', icon: '🛑', basePrice: 0, category: 'repair' },
  { id: 'brakes_rear_pads', name: 'Rear Brake Pads', icon: '🛑', basePrice: 0, category: 'repair' },
  { id: 'brakes_rear_rotors', name: 'Rear Rotors & Pads', icon: '🛑', basePrice: 0, category: 'repair' },
  { id: 'timing', name: 'Cambelt / Timing Chain', icon: '⚙️', basePrice: 0, category: 'maintenance' },
  { id: 'transmission', name: 'Transmission Service', icon: '⚙️', basePrice: 0, category: 'maintenance' },
  { id: 'battery', name: 'Battery (12V)', icon: '🔋', basePrice: 0, category: 'repair' },
  { id: 'diag_inspection', name: 'Diagnostic Inspection', icon: '🔍', basePrice: 99, category: 'inspection' },
  { id: 'spark_plugs', name: 'Spark Plugs', icon: '🔌', basePrice: 0, category: 'maintenance' },
  { id: 'cabin_filter', name: 'Cabin Air Filter', icon: '🌬️', basePrice: 0, category: 'maintenance' },
  { id: 'brake_fluid', name: 'Brake Fluid Flush', icon: '🧪', basePrice: 0, category: 'maintenance' },
  { id: 'coolant_flush', name: 'Coolant Flush', icon: '🧊', basePrice: 0, category: 'maintenance' },
  { id: 'ignition_coils', name: 'Ignition Coils', icon: '⚡', basePrice: 0, category: 'repair' },
  { id: 'water_pump', name: 'Water Pump Replacement', icon: '💧', basePrice: 0, category: 'repair' },
  { id: 'thermostat_housing', name: 'Thermostat Housing Replacement', icon: '🌡️', basePrice: 0, category: 'repair' },
  { id: 'ppi', name: 'Pre-Purchase Inspection', icon: '🔎', basePrice: 199, category: 'inspection' },
];

export const MOCK_MECHANICS: Mechanic[] = [];

export const MOCK_VEHICLES: Record<string, Vehicle> = {
  'RAH190': {
    id: 'v1',
    rego: 'RAH190',
    make: 'Volkswagen',
    model: 'Golf GTE',
    year: 2017,
    variant: '1.4TSI/6DSG DQ400e',
    mileage: 98000,
    thumbnail: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&q=80&w=400',
  },
  'CGA689': {
    id: 'v2',
    rego: 'CGA689',
    make: 'Toyota',
    model: 'Yaris',
    year: 2004,
    variant: '1.3L Petrol Manual',
    mileage: 220000,
    thumbnail: 'https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&q=80&w=400',
  },
  'MTESLA': {
    id: 'v3',
    rego: 'MTESLA',
    make: 'Tesla',
    model: 'Model 3',
    year: 2020,
    variant: 'Long Range Dual Motor',
    mileage: 120000,
    thumbnail: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&q=80&w=400',
  }
};

export const MOCK_VEHICLE = MOCK_VEHICLES['RAH190'];
