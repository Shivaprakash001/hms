import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const Input = React.forwardRef(({
  label,
  error,
  helperText,
  className,
  containerClassName,
  size = 'md',
  type = 'text',
  ...props
}, ref) => {
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base',
  };

  const inputClasses = twMerge(
    clsx(
      'w-full rounded-lg bg-neutral-800 border text-neutral-100 placeholder-neutral-500',
      'focus:outline-none focus:ring-2 transition-colors',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      sizes[size],
      error
        ? 'border-red-500 focus:ring-red-500/50 focus:border-red-500'
        : 'border-neutral-700 focus:ring-indigo-500/50 focus:border-indigo-500',
      className
    )
  );

  return (
    <div className={twMerge(clsx('flex flex-col gap-1', containerClassName))}>
      {label && (
        <label className="text-sm font-medium text-neutral-300">
          {label}
        </label>
      )}
      <input
        ref={ref}
        type={type}
        className={inputClasses}
        {...props}
      />
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-xs text-neutral-500">{helperText}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
