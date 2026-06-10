import { Mechanic, Service, Vehicle } from './types';

export const SERVICES: Service[] = [
  { 
    id: 'oil', 
    name: 'Oil Change', 
    icon: '🔧', 
    basePrice: 180,
    category: 'maintenance',
    parts: [
      { id: 'p1', name: 'Edge 5w30 LL 5L Oil', quantity: 1, unitPrice: 73.60, total: 73.60 },
      { id: 'p2', name: 'Oil Filter', quantity: 1, unitPrice: 23.63, total: 23.63 }
    ],
    labour: [{ id: 'l1', name: 'Oil & Filter Service Labour', cost: 80.00 }]
  },
  { 
    id: 'wof', 
    name: 'Warrant of Fitness', 
    icon: '📋', 
    basePrice: 65,
    category: 'inspection'
  },
  { 
    id: 'full', 
    name: 'Full Service', 
    icon: '🚗', 
    basePrice: 350,
    category: 'maintenance'
  },
  { 
    id: 'brakes_front_pads', 
    name: 'Front Brake Pads', 
    icon: '🛑', 
    basePrice: 220,
    category: 'repair'
  },
  { 
    id: 'brakes_front_rotors', 
    name: 'Front Rotors & Pads', 
    icon: '🛑', 
    basePrice: 580,
    category: 'repair'
  },
  { 
    id: 'brakes_rear_pads', 
    name: 'Rear Brake Pads', 
    icon: '🛑', 
    basePrice: 190,
    category: 'repair'
  },
  { 
    id: 'brakes_rear_rotors', 
    name: 'Rear Rotors & Pads', 
    icon: '🛑', 
    basePrice: 480,
    category: 'repair'
  },
  { 
    id: 'timing', 
    name: 'Cambelt / Timing Chain',
    icon: '⚙️', 
    basePrice: 2289,
    category: 'maintenance',
    parts: [
      { id: 'p3', name: 'Water Pump & Thermostat Housing VAG', quantity: 1, unitPrice: 517.62, total: 517.62 },
      { id: 'p4', name: 'Cambelt Kit VAG INA', quantity: 1, unitPrice: 215.27, total: 215.27 },
      { id: 'p5', name: 'Model Specific Tooling Hire', quantity: 1, unitPrice: 119.97, total: 119.97 },
      { id: 'p6', name: 'Volkswagen Antifreeze 4L', quantity: 4, unitPrice: 24.65, total: 98.60 },
      { id: 'p7', name: 'Toothed Water Pump Belt VAG', quantity: 1, unitPrice: 52.19, total: 52.19 },
      { id: 'p8', name: 'Cam Gear Sealing Plug VAG', quantity: 1, unitPrice: 20.99, total: 20.99 },
      { id: 'p9', name: 'Cam Gear Bolt', quantity: 1, unitPrice: 14.62, total: 14.62 }
    ],
    labour: [{ id: 'l2', name: 'Engine Service Labour', cost: 802.50 }],
    otherCosts: [
      { name: 'Cleaning & Sundries', cost: 11.50 },
      { name: 'Freight Courier OE Parts', cost: 40.00 }
    ]
  },
  { 
    id: 'transmission', 
    name: 'Transmission Service',
    icon: '⚙️', 
    basePrice: 621,
    category: 'maintenance',
    parts: [
      { id: 'p10', name: 'VW DCT Transmission Oil', quantity: 8, unitPrice: 48.50, total: 388.00 }
    ],
    labour: [{ id: 'l3', name: 'Transmission Service Labour', cost: 107.00 }],
    otherCosts: [
      { name: 'Cleaning & Sundries', cost: 11.50 },
      { name: 'Freight Courier', cost: 9.00 },
      { name: 'Service Light Health Scan', cost: 25.00 }
    ]
  },
  { id: 'battery', name: 'Battery (12V)', icon: '🔋', basePrice: 280, category: 'repair' },
  { id: 'diag_inspection', name: 'Diagnostic Inspection', icon: '🔍', basePrice: 99, category: 'inspection' },
  { id: 'spark_plugs', name: 'Spark Plugs', icon: '🔌', basePrice: 240, category: 'maintenance' },
  { id: 'cabin_filter', name: 'Cabin Air Filter', icon: '🌬️', basePrice: 110, category: 'maintenance' },
  { id: 'brake_fluid', name: 'Brake Fluid Flush', icon: '🧪', basePrice: 145, category: 'maintenance' },
];

export const MOCK_MECHANICS: Mechanic[] = [
  {
    id: 'm1',
    name: 'Precision Mechanical Dunedin',
    logo: 'https://picsum.photos/seed/precision/100/100',
    suburb: 'South Dunedin',
    address: '123 Anderson Bay Road, Dunedin',
    mapsUrl: 'https://www.google.com/maps/search/Precision+Mechanical+Dunedin',
    distance: 1.2,
    rating: 4.9,
    reviews: 156,
    specialisations: ['European Vehicles', 'VAG Specialists', 'Transmission'],
    nextAvailable: 'Tomorrow, 8am',
    isFeatured: true,
    estimatedPrice: 0,
  },
  {
    id: 'm2',
    name: 'R&D European',
    logo: 'https://picsum.photos/seed/rd/100/100',
    suburb: 'South Dunedin',
    address: '45 Hillside Road, Dunedin',
    mapsUrl: 'https://www.google.com/maps/search/R%26D+European+Dunedin',
    distance: 2.3,
    rating: 4.8,
    reviews: 124,
    specialisations: ['European Vehicles', 'Diagnostics', 'Transmission'],
    nextAvailable: 'Tomorrow, 9am',
    isFeatured: false,
    estimatedPrice: 0,
  },
  {
    id: 'm3',
    name: 'City Auto Care',
    logo: 'https://picsum.photos/seed/city/100/100',
    suburb: 'Central City',
    address: '88 Cumberland Street, Dunedin',
    mapsUrl: 'https://www.google.com/maps/search/City+Auto+Care+Dunedin',
    distance: 1.1,
    rating: 4.5,
    reviews: 89,
    specialisations: ['General Service', 'WOF', 'Brakes'],
    nextAvailable: 'Today, 2pm',
    estimatedPrice: 0,
  },
];

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
