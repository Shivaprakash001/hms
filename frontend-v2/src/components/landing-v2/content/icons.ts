import {
  Bed,
  Building2,
  Cctv,
  Droplet,
  FileCheck,
  Home,
  Key,
  Lock,
  Phone,
  Shield,
  Sparkles,
  UtensilsCrossed,
  WashingMachine,
  Wifi,
  Zap,
  MapPin,
  Camera,
  Shirt,
  Utensils,
  ArrowUpSquare,
  ArrowUpDown,
  SquareArrowUp,
} from 'lucide-react';

export const landingIconMap = {
  // Legacy aliases
  bed: Bed,
  building: Building2,
  cctv: Cctv,
  cleaning: Sparkles,
  document: FileCheck,
  food: UtensilsCrossed,
  home: Home,
  key: Key,
  laundry: WashingMachine,
  location: MapPin,
  phone: Phone,
  power: Zap,
  security: Shield,
  storage: Lock,
  water: Droplet,
  wifi: Wifi,

  // Direct Lucide name mappings from Sanity
  utensils: Utensils,
  droplet: Droplet,
  sparkles: Sparkles,
  shield: Shield,
  camera: Cctv,
  shirt: Shirt,
  lock: Lock,
  zap: Zap,
  'arrow-up-square': ArrowUpSquare || SquareArrowUp || ArrowUpDown,
  lift: ArrowUpSquare || SquareArrowUp || ArrowUpDown,
};

export function getLandingIcon(name: string | undefined, fallback: keyof typeof landingIconMap = 'home') {
  const normalized = (name || '').toLowerCase().trim();
  return landingIconMap[normalized as keyof typeof landingIconMap] || 
         landingIconMap[(name || fallback) as keyof typeof landingIconMap] || 
         landingIconMap[fallback];
}

