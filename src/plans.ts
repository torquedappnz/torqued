// Torqued subscription tiers — subscription-only model, no per-job commission.
// Prices are NZD + GST per month. Every tier: unlimited technicians, jobs and
// marketplace bookings. Mirrors PLAN_TIERS in server.ts (keep in sync).

export type PlanTier = 'starter' | 'pro' | 'max';

export interface Plan {
  id: PlanTier;
  name: string;
  exGst: number;
  audience: string;
  features: string[];
}

export const PLANS: Plan[] = [
  {
    id: 'starter', name: 'Starter', exGst: 89,
    audience: 'Workshops replacing MechanicDesk',
    features: ['Quoting & customer communication', 'Customer & vehicle history', 'Job cards', 'Invoicing with GST', 'CSV data import', 'Marketplace listing'],
  },
  {
    id: 'pro', name: 'Pro', exGst: 149,
    audience: 'Workshops that want more work and less admin',
    features: ['Everything in Starter', 'Online & automated bookings', 'Scheduling & automated customer alerts', 'In-app quotes & flexible payments', 'Promoted marketplace placement', 'Parts management'],
  },
  {
    id: 'max', name: 'Max', exGst: 249,
    audience: 'Workshops that want it run for them',
    features: ['Everything in Pro', 'AI-assisted quoting for complex jobs', 'AI assistance across the platform (fair use)', 'Pre-purchase inspection reports', 'Migration, setup & marketing done for you', 'Multi-site & priority support'],
  },
];

export const LAUNCH_OFFER = { months1to3PctOff: 50, months4to6PctOff: 25 };

export const planById = (id?: string | null): Plan | undefined => PLANS.find(p => p.id === id);
