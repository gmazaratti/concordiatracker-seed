import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Logo } from '@/components/Logo'
import { Mascot } from '@/components/Mascot'

export function NotFoundPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo />
      {/* Looking for something it cannot find, which is the honest description
          of what just happened. */}
      <Mascot mood="thinking" size="lg" soft className="text-accent" />
      <h1 className="font-display text-4xl font-medium text-fg">404</h1>
      <p className="max-w-sm text-sm text-muted">
        We couldn&rsquo;t find that page. It may have moved, or the link may be wrong.
      </p>
      <Link to="/app">
        <Button>Go to Today</Button>
      </Link>
    </div>
  )
}
