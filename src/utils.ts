import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD',
  }).format(amount);
}

export function calculateGST(amount: number) {
  return amount * 0.15;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
