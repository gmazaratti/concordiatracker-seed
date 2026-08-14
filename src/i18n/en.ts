/**
 * English strings — the SOURCE OF TRUTH for every translatable key.
 *
 * Flat, dot-namespaced keys rather than nested objects, so `Key` is a precise
 * union: a typo is a compile error, and `fr.ts` can only contain keys that
 * actually exist.
 *
 * Interpolation uses {braces}: t('today.greeting', { name: 'Alex' }).
 *
 * Adding a string: add it here, use `t('your.key')`, and translate in fr.ts when
 * convenient — an untranslated key falls back to English rather than breaking.
 */
export const en = {
  // ── Navigation ────────────────────────────────────────────────────────────
  'nav.today': 'Today',
  'nav.courses': 'Courses',
  'nav.calendar': 'Calendar',
  'nav.community': 'Community',
  'nav.search': 'Search',
  'nav.settings': 'Settings',
  'nav.feedback': 'Feedback',
  'nav.whatsNew': "What's new",
  'nav.takeTour': 'Take a tour',
  'nav.teacherPortal': 'Teacher portal',
  'nav.organizerPortal': 'Organizer portal',
  'nav.adminPanel': 'Admin Panel',
  'nav.landing': 'Landing page',
  'nav.signOut': 'Sign out',
  'nav.backToApp': 'Back to the app',

  // ── Common ────────────────────────────────────────────────────────────────
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.done': 'Done',
  'common.loading': 'Loading',
  'common.free': 'Free',
  'common.continue': 'Continue',
  'common.next': 'Next',
  'common.back': 'Back',
  'common.tryAgain': 'Please try again.',
  'common.somethingWrong': 'Something went wrong.',

  // ── Landing ───────────────────────────────────────────────────────────────
  'landing.eyebrow': 'For Concordia students',
  'landing.heroTitle': 'Stop guessing what’s',
  'landing.heroTitleAccent': 'due',
  'landing.heroSub':
    'Upload a syllabus and get every deadline, weight, and grade in one place — built for how Concordia actually works.',
  'landing.ctaPrimary': 'Open the app',
  'landing.ctaSecondary': 'See how it works',
  'landing.howItWorks': 'How it works',
  'landing.pricing': 'Pricing',
  'landing.forTeachers': 'For teachers',
  'landing.notAffiliated': 'Not affiliated with Concordia University.',

  // ── Pricing ───────────────────────────────────────────────────────────────
  'pricing.free.name': 'Free',
  'pricing.free.price': '$0',
  'pricing.free.tagline': 'Core features, no time limit.',
  'pricing.semester.name': 'Semester pass',
  'pricing.semester.badge': 'Best value',
  'pricing.semester.orMonthly': 'or $5 / month',
  'pricing.perSemester': '/ semester',
  'pricing.perMonth': '/ month',

  // ── Billing ───────────────────────────────────────────────────────────────
  'billing.title': 'Billing',
  'billing.currentPlan': 'Current',
  'billing.active': 'Active',
  'billing.trial': 'Trial',
  'billing.canceled': 'Canceled',
  'billing.paymentFailed': 'Payment failed',
  'billing.freePlan': 'Free plan',
  'billing.proPlan': 'ConcordiaTracker Pro',
  'billing.freeDesc': 'Core features, no time limit. Grade-needed calculator included.',
  'billing.proDesc': 'Full access — GPA prediction, unlimited scans, every feature.',
  'billing.getSemester': 'Get the Semester pass — $15',
  'billing.goMonthly': 'Or go monthly — $5 / month',
  'billing.switchToSemester': 'Switch to the Semester pass — $15',
  'billing.carryOver': 'Your remaining time carries over — you keep every paid day.',
  'billing.trialCarryOver': 'Your remaining trial days carry over — nothing is lost.',
  'billing.cancel': 'Cancel subscription',
  'billing.resume': 'Resume subscription',
  'billing.working': 'Working…',
  'billing.trialCharge': 'Free trial — your card is charged {date}.',
  'billing.cancelsOn': 'Cancels {date} — you keep access until then.',
  'billing.paymentFailedMsg': 'Your last payment failed. Update your card to keep Pro.',
  'billing.notConfigured': 'Payments aren’t configured in this environment.',
  'billing.autoRenewal': 'Auto-renewal',
  'billing.renewsOn': 'Renews automatically on {date}.',
  'billing.renewsGeneric':
    'Paid plans renew automatically at the end of each billing period (the Semester pass at term end; monthly plans each month).',
  'billing.cancelAnytime':
    'Cancel anytime here — access continues until the end of the paid period.',
  'billing.payment': 'Payment',
  'billing.paymentMethod': 'Payment method',
  'billing.paymentMethodDesc': 'Handled by Stripe — we never see or store card numbers.',
  'billing.updateCard': 'Update card',
  'billing.updateCardTitle': 'Update payment method',
  'billing.invoices': 'Invoices',
  'billing.noInvoices': 'No invoices yet',
  'billing.firstInvoice': 'Your first invoice will appear here.',
  'billing.onFreePlan': 'You’re on the free plan.',
  'billing.checkout': 'Checkout',
  'billing.closeCheckout': 'Close checkout',
  'billing.paid': 'Paid',
  'billing.due': 'Due',

  // ── Settings ──────────────────────────────────────────────────────────────
  'settings.general': 'General',
  'settings.account': 'Account',
  'settings.privacy': 'Privacy',
  'settings.billing': 'Billing',
  'settings.usage': 'Usage',
  'settings.appearance': 'Appearance',
  'settings.theme': 'Theme',
  'settings.language': 'Language',
  'settings.languageDesc': 'Interface language. Course content stays as your professor wrote it.',

  // ── Today ─────────────────────────────────────────────────────────────────
  'today.goodMorning': 'Good morning',
  'today.goodAfternoon': 'Good afternoon',
  'today.goodEvening': 'Good evening',
  'today.overdue': 'Overdue',
  'today.thisWeek': 'This week',
  'today.allCaughtUp': 'All caught up',
  'today.nothingDue': 'Nothing due right now.',
  'today.completedToday': 'Completed today',
  'today.undo': 'Undo',
  'today.debrief': 'Daily debrief',
  'today.planMyWeek': 'Plan my week',
  'today.prioritise': 'Prioritise:',
  'today.termByWeek': 'Your term, week by week',
  'today.workloadByWeight': 'Workload by weight',

  // ── Auth ──────────────────────────────────────────────────────────────────
  'auth.signIn': 'Sign in',
  'auth.signInGoogle': 'Continue with Google',
  'auth.signUpFree': 'Sign up free',
  'auth.welcomeBack': 'Welcome back to ConcordiaTracker.',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.or': 'OR',
} as const

export type Key = keyof typeof en
