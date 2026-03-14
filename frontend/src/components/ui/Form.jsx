import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const Input = ({ label, error, className, ...props }) => {
  return (
    <div className="space-y-1 w-full">
      {label && (
        <label className="block text-sm font-medium text-neutral-400">
          {label}
        </label>
      )}
      <input
        className={twMerge(
          clsx(
            'w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2 text-neutral-100 transition-all outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 placeholder:text-neutral-600',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
            className
          )
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
};

export const Select = ({ label, error, options, className, ...props }) => {
  return (
    <div className="space-y-1 w-full">
      {label && (
        <label className="block text-sm font-medium text-neutral-400">
          {label}
        </label>
      )}
      <select
        className={twMerge(
          clsx(
            'w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2 text-neutral-100 transition-all outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 appearance-none',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
            className
          )
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
};

export const Label = ({ children, className, ...props }) => (
  <label className={twMerge('block text-sm font-medium text-neutral-400', className)} {...props}>
    {children}
  </label>
);
