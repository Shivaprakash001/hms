import { AlertCircle } from 'lucide-react';

interface InlineErrorProps {
  message: string;
  className?: string;
  id?: string;
}

export function InlineError({ message, className = '', id }: InlineErrorProps) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      aria-live="polite"
      className={`flex items-start gap-1.5 text-xs text-red-600 font-medium mt-1.5 ${className}`}
    >
      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}
