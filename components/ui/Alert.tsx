import { cn } from '@/lib/utils'
import { HTMLAttributes, ReactNode } from 'react'
import { AlertCircle, CheckCircle, Info, XCircle, X } from 'lucide-react'

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'danger'
  title?: string
  onClose?: () => void
  children: ReactNode
}

export function Alert({
  className,
  variant = 'info',
  title,
  onClose,
  children,
  ...props
}: AlertProps) {
  const variants = {
    info: {
      container: 'bg-primary-50 border-primary-200',
      icon: 'text-primary-600',
      title: 'text-primary-800',
      text: 'text-primary-700',
    },
    success: {
      container: 'bg-success-50 border-success-200',
      icon: 'text-success-600',
      title: 'text-success-800',
      text: 'text-success-700',
    },
    warning: {
      container: 'bg-warning-50 border-warning-200',
      icon: 'text-warning-600',
      title: 'text-warning-800',
      text: 'text-warning-700',
    },
    danger: {
      container: 'bg-danger-50 border-danger-200',
      icon: 'text-danger-600',
      title: 'text-danger-800',
      text: 'text-danger-700',
    },
  }

  const icons = {
    info: Info,
    success: CheckCircle,
    warning: AlertCircle,
    danger: XCircle,
  }

  const Icon = icons[variant]
  const styles = variants[variant]

  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        styles.container,
        className
      )}
      {...props}
    >
      <div className="flex">
        <div className="flex-shrink-0">
          <Icon className={cn('h-5 w-5', styles.icon)} />
        </div>
        <div className="mr-3 flex-1">
          {title && (
            <h3 className={cn('text-sm font-medium', styles.title)}>
              {title}
            </h3>
          )}
          <div className={cn('text-sm', title ? 'mt-1' : '', styles.text)}>
            {children}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={cn('flex-shrink-0', styles.icon)}
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  )
}
