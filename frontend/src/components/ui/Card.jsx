import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const Card = ({
  children,
  className,
  padding = 'md',
  hover = false,
  ...props
}) => {
  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={twMerge(
        clsx(
          'bg-neutral-900 border border-neutral-800 rounded-xl',
          paddings[padding],
          hover && 'transition-colors hover:border-neutral-700 hover:bg-neutral-800/50',
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
};

const CardHeader = ({ children, className, ...props }) => (
  <div
    className={twMerge(clsx('flex items-center justify-between mb-4', className))}
    {...props}
  >
    {children}
  </div>
);

const CardTitle = ({ children, className, ...props }) => (
  <h3
    className={twMerge(clsx('text-base font-semibold text-neutral-100', className))}
    {...props}
  >
    {children}
  </h3>
);

const CardContent = ({ children, className, ...props }) => (
  <div className={twMerge(clsx('text-neutral-300', className))} {...props}>
    {children}
  </div>
);

const Badge = ({
  children,
  variant = 'default',
  size = 'md',
  className,
  ...props
}) => {
  const variants = {
    default: 'bg-neutral-800 text-neutral-300 border border-neutral-700',
    primary: 'bg-indigo-600/20 text-indigo-400 border border-indigo-600/30',
    success: 'bg-green-600/20 text-green-400 border border-green-600/30',
    warning: 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30',
    danger: 'bg-red-600/20 text-red-400 border border-red-600/30',
    info: 'bg-blue-600/20 text-blue-400 border border-blue-600/30',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center rounded-full font-medium',
          variants[variant],
          sizes[size],
          className
        )
      )}
      {...props}
    >
      {children}
    </span>
  );
};

Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Content = CardContent;

export { Card, Badge };
export default Card;
