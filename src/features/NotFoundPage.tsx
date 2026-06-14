import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Logo } from '@/components/Logo'

export function NotFoundPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo />
      <h1 className="font-display text-4xl font-medium text-fg">404</h1>
      <p className="max-w-sm text-sm text-muted">
        That page doesn't exist in this seed build.
      </p>
      <Link to="/app">
        <Button>Go to Today</Button>
      </Link>
    </div>
  )
}
