import { useMemo, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@shared/ui';
import { categoryIcon, EXPENSE_CATEGORIES } from '@features/expenses/constants';

// Replaces the old 8-button "quick pick" grid + redundant <select> with one
// searchable combobox: a "recently used" section (personalized from the
// owner's own frequent expenses) followed by the full category list.
export function CategoryPicker({
  value,
  onChange,
  categories,
  frequentExpenses = [],
  categorySpend,
}: {
  value: string;
  onChange: (category: string) => void;
  categories: string[];
  frequentExpenses?: Array<{ category?: string }>;
  categorySpend?: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);

  const recentCategories = useMemo(() => {
    const seen = new Set<string>();
    const recents: string[] = [];
    for (const item of frequentExpenses) {
      const category = item?.category;
      if (category && !seen.has(category)) {
        seen.add(category);
        recents.push(category);
      }
      if (recents.length >= 6) break;
    }
    if (recents.length === 0) {
      // No history yet — fall back to the canonical order so the picker isn't empty on day one.
      return (categories.length ? categories : EXPENSE_CATEGORIES).slice(0, 6);
    }
    return recents;
  }, [frequentExpenses, categories]);

  const otherCategories = useMemo(
    () => categories.filter((category) => !recentCategories.includes(category)),
    [categories, recentCategories],
  );

  const select = (category: string) => {
    onChange(category);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-3 text-left text-sm outline-none focus:ring-2 focus:ring-accent/20"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="text-lg leading-none">{value ? categoryIcon(value) : '❔'}</span>
            <span className={`truncate font-semibold ${value ? 'text-foreground' : 'text-muted-foreground'}`}>
              {value || 'Choose a category'}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] max-h-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search categories..." />
          <CommandList>
            <CommandEmpty>No matching category.</CommandEmpty>
            {recentCategories.length > 0 && (
              <CommandGroup heading="Recently used">
                {recentCategories.map((category) => (
                  <CategoryRow
                    key={`recent-${category}`}
                    category={category}
                    selected={value === category}
                    amount={categorySpend?.[category]}
                    onSelect={select}
                  />
                ))}
              </CommandGroup>
            )}
            <CommandGroup heading="All categories">
              {otherCategories.map((category) => (
                <CategoryRow
                  key={category}
                  category={category}
                  selected={value === category}
                  amount={categorySpend?.[category]}
                  onSelect={select}
                />
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function CategoryRow({
  category,
  selected,
  amount,
  onSelect,
}: {
  category: string;
  selected: boolean;
  amount?: number;
  onSelect: (category: string) => void;
}) {
  return (
    <CommandItem value={category} onSelect={() => onSelect(category)}>
      <span className="mr-2">{categoryIcon(category)}</span>
      <span className="flex-1 truncate">{category}</span>
      {Boolean(amount) && (
        <span className="mr-1 text-xs text-muted-foreground">₹{Number(amount).toLocaleString('en-IN')}</span>
      )}
      {selected && <Check className="h-4 w-4 text-accent" />}
    </CommandItem>
  );
}
