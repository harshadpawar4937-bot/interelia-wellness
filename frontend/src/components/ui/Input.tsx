import { cn } from '@/lib/utils'
import { forwardRef, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={cn(
          'w-full rounded-md border border-border bg-surface px-3 py-2.5 text-ink outline-none transition focus:border-ink',
          error && 'border-brand',
          className,
        )}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-brand">{error}</p>}
    </div>
  ),
)
Input.displayName = 'Input'
