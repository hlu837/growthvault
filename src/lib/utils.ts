import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export function getTierDisplayName(tier: string | null): string {
  if (!tier) return "Starter";
  
  switch (tier) {
    case 'starter': return 'Bronze';
    case 'golden': return 'Silver';
    case 'premium': return 'Gold';
    case 'business': return 'Platinum';
    case 'platinum': return 'Diamond';
    case 'achiever': return 'Achiever';
    default: return 'Starter';
  }
}
