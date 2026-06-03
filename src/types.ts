export type UserRole = 'customer' | 'mechanic';

export interface Vehicle {
  id: string;
  rego: string;
  make: string;
  model: string;
  year: number;
  variant?: string;
  mileage: number;
  thumbnail?: string;
}

export interface Part {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InventoryPart {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  description?: string;
  minStockLevel?: number;
}

export interface LabourTask {
  id: string;
  name: string;
  cost: number;
}

export interface Service {
  id: string;
  name: string;
  icon: string;
  basePrice: number; // For simple display
  parts?: Part[];
  labour?: LabourTask[];
  otherCosts?: { name: string; cost: number }[];
  category: 'maintenance' | 'repair' | 'inspection';
}

export interface Mechanic {
  id: string;
  name: string;
  logo: string;
  bannerImage?: string;
  suburb: string;
  address?: string;
  mapsUrl?: string;
  distance: number;
  rating: number;
  reviews: number;
  specialisations: string[];
  serviceAreas?: string[];
  diagnosticTools?: string[];
  certifications?: string[];
  nzbn?: string;
  phone?: string;
  labourRate?: number;
  shopFee?: number;
  nextAvailable: string;
  isFeatured?: boolean;
  estimatedPrice: number;
  technicians?: number;
  partsLeadDays?: number;
}

export interface Job {
  id: string;
  vehicleId: string;
  serviceIds: string[];
  mechanicId: string;
  status: 'booked' | 'pending' | 'parts_ordered' | 'dropped_off' | 'in_progress' | 'ready' | 'completed';
  paymentStatus: 'pending' | 'confirmed' | 'partially_paid' | 'awaiting_approval';
  paymentMethod: string;
  date: string;
  totalPrice: number;
  depositPaid?: number;
  faultCode?: string;
  description?: string;
  customerName?: string;
  email?: string;
  phone?: string;
}

export interface WorkshopStats {
  todayJobs: number;
  todayRevenue: number;
  pendingQuotes: number;
  weeklyRevenue: { day: string; amount: number }[];
  adminTimeSaved: number;
}

export interface VehicleHistoryItem {
  id: string;
  date: string;
  mileage?: number;
  service: string;
  provider: string;
  isExternal?: boolean;
}

export interface Recommendation {
  id: string;
  trigger: string;
  task: string;
  priority: 'low' | 'medium' | 'high';
}

export interface Supplier {
  id: string;
  name: string;
  logo: string;
  rating: number;
  deliveryEstimate: string;
}

export interface PartOffer {
  id: string;
  partId: string;
  supplierId: string;
  price: number;
  availability: 'in-stock' | 'to-order' | 'out-of-stock';
  deliveryTime: string;
}

export interface RequiredPart {
  id: string;
  name: string;
  oemNumber?: string;
  quantity: number;
  selectedOfferId?: string;
}

export interface ProcurementItem {
  id: string;
  reg: string;
  model: string;
  partsCount: number;
  suppliers: string[];
  orderTotal: number;
}

export interface DeliveryItem {
  id: string;
  supplier: string;
  items: number;
  eta: string;
  status: string;
  icon: string;
}

export interface UserServiceItem {
  id: string;
  name: string;
  lastDoneMileage?: number;
  lastDoneDate?: string;
  intervalMileage?: number;
  intervalMonths?: number;
}
