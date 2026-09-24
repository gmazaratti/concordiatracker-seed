import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { useT } from '@/i18n/i18n'
import { LangSwitch } from '@/features/dev-landing/LangSwitch'
import { useNoIndex } from '@/app/hooks/useNoIndex'
import { DevLoginForm } from './DevLoginForm'
import { ProductPanel } from './ProductPanel'

/**
 * HIDDEN DRAFT of a new sign-in, at /dev/login (after Uplink's): the form on
 * the left, and on the right the product itself, a live Today view, instead of
 * decoration. The right panel only exists from `lg` up; below that the form is
 * the whole page, because a squeezed screenshot next to a form helps nobody.
 *
 * The live LoginScreen is untouched.
 */
export function DevLoginPage() {
  const t = useT()
  useNoIndex()
  useEffect(() => {
    const prev = document.title
    document.title = 'Sign in · ConcordiaTracker (draft)'
    return () => {
      document.title = prev
    }
  }, [])

  return (
    <div className="grid min-h-[100dvh] bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="flex min-w-0 flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between gap-3">
          <Link to="/dev/landing" aria-label="ConcordiaTracker home">
            <Logo />
          </Link>
          <LangSwitch />
        </div>

        <div className="flex flex-1 items-center justify-center py-12">
          <DevLoginForm />
        </div>

        <p className="text-[12px] text-subtle">{t('landing.notAffiliated')}</p>
      </div>

      <ProductPanel />
    </div>
  )
}
