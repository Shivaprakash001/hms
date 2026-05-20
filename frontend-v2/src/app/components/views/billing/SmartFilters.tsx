import React from 'react';
import { Search, Filter } from 'lucide-react';

export function SmartFilters() {
  return (
    <div className="p-4 border-b border-border bg-muted/10 flex flex-col sm:flex-row gap-3 items-center justify-between">
      <div className="relative w-full sm:w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input 
          type="text" 
          placeholder="Search tenant, room, receipt..." 
          className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="flex w-full sm:w-auto gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
        <button className="flex items-center gap-2 px-3 py-1.5 border border-border bg-background rounded-md text-xs font-medium shrink-0">
          <Filter className="w-3 h-3" /> Status
        </button>
        <button className="flex items-center gap-2 px-3 py-1.5 border border-border bg-background rounded-md text-xs font-medium shrink-0">
          <Filter className="w-3 h-3" /> Hostel
        </button>
      </div>
    </div>
  );
}
