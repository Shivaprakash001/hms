// Canonical fallback category list — used only before the API's `meta.categories`
// (backend/lib/services/expense-service.ts EXPENSE_CATEGORIES) has loaded.
export const EXPENSE_CATEGORIES = [
  'Food & Groceries',
  'Staff Salary',
  'Electricity',
  'Water',
  'Gas Cylinders',
  'Internet',
  'Cleaning Supplies',
  'Maintenance & Repairs',
  'Security',
  'Laundry',
  'Transportation',
  'Furniture & Equipment',
  'Licenses & Government',
  'Marketing',
  'Medical & Emergency',
  'Miscellaneous',
];

export const QUICK_PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Debit Card', 'Credit Card', 'Cheque'];

export const OPERATIONAL_TYPES = [
  { value: 'Operational', label: 'Operational', emoji: '⚙️' },
  { value: 'Utility', label: 'Utility', emoji: '💡' },
  { value: 'Maintenance', label: 'Maintenance', emoji: '🔧' },
  { value: 'Staff', label: 'Staff', emoji: '👨‍🍳' },
  { value: 'Emergency', label: 'Emergency', emoji: '🚨' },
];

export function categoryIcon(category: string): string {
  if (category.includes('Food')) return '🍚';
  if (category.includes('Electric')) return '⚡';
  if (category.includes('Water')) return '💧';
  if (category.includes('Staff')) return '👨‍🍳';
  if (category.includes('Repair') || category.includes('Maintenance')) return '🔧';
  if (category.includes('Gas')) return '🔥';
  if (category.includes('Internet')) return '📶';
  if (category.includes('Cleaning')) return '🧹';
  if (category.includes('Security')) return '🛡️';
  if (category.includes('Laundry')) return '🧺';
  if (category.includes('Transportation')) return '🛺';
  if (category.includes('Furniture') || category.includes('Equipment')) return '🧾';
  if (category.includes('Licenses') || category.includes('Government')) return '📄';
  if (category.includes('Marketing')) return '📣';
  if (category.includes('Medical')) return '🩺';
  return '•';
}

export function categoryTone(category: string): { chip: string; bar: string } {
  const tones: Record<string, { chip: string; bar: string }> = {
    'Food & Groceries': { chip: 'bg-warning/10 text-warning', bar: 'bg-warning' },
    Electricity: { chip: 'bg-destructive/10 text-destructive', bar: 'bg-destructive' },
    Water: { chip: 'bg-info/10 text-info', bar: 'bg-info' },
    'Gas Cylinders': { chip: 'bg-orange-500/10 text-orange-600', bar: 'bg-orange-500' },
    Internet: { chip: 'bg-accent/10 text-accent', bar: 'bg-accent' },
    'Staff Salary': { chip: 'bg-primary/10 text-primary', bar: 'bg-primary' },
    'Maintenance & Repairs': { chip: 'bg-primary/10 text-primary', bar: 'bg-primary' },
    'Cleaning Supplies': { chip: 'bg-emerald-500/10 text-emerald-600', bar: 'bg-emerald-500' },
    Security: { chip: 'bg-red-500/10 text-red-600', bar: 'bg-red-500' },
    Laundry: { chip: 'bg-sky-500/10 text-sky-600', bar: 'bg-sky-500' },
    Transportation: { chip: 'bg-amber-500/10 text-amber-600', bar: 'bg-amber-500' },
    'Furniture & Equipment': { chip: 'bg-purple-500/10 text-purple-600', bar: 'bg-purple-500' },
    'Licenses & Government': { chip: 'bg-slate-500/10 text-slate-600', bar: 'bg-slate-500' },
    Marketing: { chip: 'bg-pink-500/10 text-pink-600', bar: 'bg-pink-500' },
    'Medical & Emergency': { chip: 'bg-rose-500/10 text-rose-600', bar: 'bg-rose-500' },
  };
  return tones[category] || { chip: 'bg-muted text-muted-foreground', bar: 'bg-muted-foreground' };
}

// Zero-latency client-side mirror of the backend's suggestedCategory()/suggestedOperationalType()
// (lib/services/expense-service.ts) — kept in sync manually; a UX nicety, not a source of truth.
export function suggestCategory(title: string): string {
  const text = title.toLowerCase();
  if (/(electric|power|eb|current|bill)/.test(text)) return 'Electricity';
  if (/(food|rice|milk|grocery|vegetable|kitchen|meal|dal|oil)/.test(text)) return 'Food & Groceries';
  if (/(gas|cylinder|lpg)/.test(text)) return 'Gas Cylinders';
  if (/(wifi|internet|broadband|router|airtel|jio)/.test(text)) return 'Internet';
  if (/(repair|plumb|paint|fix|carpenter|maintenance)/.test(text)) return 'Maintenance & Repairs';
  if (/(clean|housekeep|soap|phenyl)/.test(text)) return 'Cleaning Supplies';
  if (/(salary|staff|warden|watchman)/.test(text)) return 'Staff Salary';
  if (/(security|guard|cctv)/.test(text)) return 'Security';
  if (/(laundry|washing)/.test(text)) return 'Laundry';
  if (/(transport|auto|fuel|petrol|diesel)/.test(text)) return 'Transportation';
  if (/(bed|mattress|furniture|fridge|geyser|fan|machine|equipment)/.test(text)) return 'Furniture & Equipment';
  if (/(license|licence|government|tax|permit)/.test(text)) return 'Licenses & Government';
  if (/(marketing|banner|ad|poster)/.test(text)) return 'Marketing';
  if (/(medical|emergency|first aid|doctor)/.test(text)) return 'Medical & Emergency';
  if (/(water|tanker)/.test(text)) return 'Water';
  return 'Miscellaneous';
}

export function suggestOperationalType(title: string, category: string): string {
  const text = `${title} ${category}`.toLowerCase();
  if (/(salary|staff|warden|watchman|cook|guard)/.test(text)) return 'Staff';
  if (/(electric|water|gas|internet|wifi|broadband|sewage)/.test(text)) return 'Utility';
  if (/(repair|plumb|paint|fix|carpenter|leak|pipe|roof|maintenance)/.test(text)) return 'Maintenance';
  if (/(emergency|urgent|flood|fire|accident|break)/.test(text)) return 'Emergency';
  return 'Operational';
}
