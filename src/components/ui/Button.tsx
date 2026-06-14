import { cn } from '@/lib/cn'

type Variant = 'primary' | 'outline' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-contrast hover:bg-accent-hover font-medium shadow-sm',
  outline:
    'border border-border-strong text-fg hover:bg-surface-2 hover:border-border-strong',
  ghost: 'text-muted hover:text-fg hover:bg-surface-2',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] rounded-md gap-1.5',
  md: 'h-10 px-4 text-sm rounded-lg gap-2',
  lg: 'h-12 px-6 text-[15px] rounded-xl gap-2',
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  )
}
