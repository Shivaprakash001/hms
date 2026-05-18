import React from 'react';
import { Phone, Mail, Home, Search, Loader2 } from 'lucide-react';

const SearchResultsDropdown = ({
    isOpen,
    isLoading,
    hasError,
    query,
    results,
    activeIndex,
    onSelect
}) => {
    if (!isOpen) return null;

    return (
        <div className="absolute top-full left-0 right-0 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/70">
            {isLoading ? (
                <div className="flex items-center gap-3 px-4 py-5 text-sm text-slate-500">
                    <Loader2 size={16} className="animate-spin text-ops-accent" />
                    <span>Searching tenants...</span>
                </div>
            ) : hasError ? (
                <div className="px-4 py-5 text-sm text-slate-500">
                    <div className="flex items-center gap-2 font-medium text-rose-700">
                        <Search size={16} className="text-rose-400" />
                        <span>Search unavailable</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">The tenant search API could not be reached. Please try again in a moment.</p>
                </div>
            ) : results.length === 0 ? (
                <div className="px-4 py-5 text-sm text-slate-500">
                    <div className="flex items-center gap-2 font-medium text-slate-700">
                        <Search size={16} className="text-slate-400" />
                        <span>No tenants found</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">Try name, phone, email, or room number for "{query}".</p>
                </div>
            ) : (
                <div className="max-h-96 overflow-y-auto py-2">
                    {results.map((tenant, index) => (
                        <button
                            key={tenant.id}
                            onClick={() => onSelect(tenant)}
                            className={`flex w-full items-start justify-between gap-4 px-4 py-3 text-left transition-colors ${
                                activeIndex === index ? 'bg-ops-accent/10' : 'hover:bg-slate-50'
                            }`}
                        >
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">{tenant.name}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                                    <span className="inline-flex items-center gap-1">
                                        <Home size={12} />
                                        Room {tenant.room || 'Unassigned'}
                                    </span>
                                    {tenant.phone ? (
                                        <span className="inline-flex items-center gap-1">
                                            <Phone size={12} />
                                            {tenant.phone}
                                        </span>
                                    ) : null}
                                    {tenant.email ? (
                                        <span className="inline-flex items-center gap-1">
                                            <Mail size={12} />
                                            {tenant.email}
                                        </span>
                                    ) : null}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SearchResultsDropdown;
