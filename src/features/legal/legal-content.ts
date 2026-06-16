/**
 * Legal copy is rendered from this structured data so the page component stays
 * a thin renderer. The text is the user's provided ToS + Privacy Policy, verbatim
 * except for clearly-bracketed review placeholders — [AGE_MINIMUM — TBD],
 * [REFUND POLICY — NEEDS REVIEW], [NOTICE PERIOD — TBD], [VERIFY], [PLACEHOLDER] —
 * which the renderer highlights. Nothing here is finalized legal text (DRAFT).
 */
export type ListItem = string | { label: string; text: string }

export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'list'; items: ListItem[] }
  | { kind: 'callout'; title?: string; text: string }
  | { kind: 'highlight'; text: string }
  | { kind: 'links'; items: { label: string; href: string; verify?: boolean }[] }

export interface LegalSection {
  n: number
  title: string
  blocks: Block[]
}

export interface LegalDoc {
  slug: 'terms' | 'privacy' | 'educator'
  title: string
  lastUpdated: string
  intro?: string
  sections: LegalSection[]
}

const LAST_UPDATED = 'June 15, 2026'

const privacy: LegalDoc = {
  slug: 'privacy',
  title: 'Privacy Policy',
  lastUpdated: LAST_UPDATED,
  intro: 'How ConcordiaTracker collects, uses, and protects your information.',
  sections: [
    {
      n: 1,
      title: 'Data Collection (Law 25 Compliance)',
      blocks: [
        {
          kind: 'p',
          text: 'In compliance with Quebec’s Law 25 (Act respecting the protection of personal information in the private sector), we disclose that we collect:',
        },
        {
          kind: 'list',
          items: [
            { label: 'Identification', text: 'Email address, display name, and profile picture (via Google OAuth).' },
            { label: 'Academic Data', text: 'Course names, assignment titles, weights, due dates, and grades — all entered voluntarily by the user.' },
            { label: 'Technical Data', text: 'IP address, browser type, and device information for security, analytics, and DDoS mitigation.' },
          ],
        },
      ],
    },
    {
      n: 2,
      title: 'Google OAuth & API Data Usage',
      blocks: [
        {
          kind: 'p',
          text: 'We use Google OAuth 2.0 solely for secure authentication. When you sign in with Google, we only request and access your basic profile information: email address, display name, and profile picture. We do not access your Google Drive, Gmail, Calendar, Contacts, or any other Google service data.',
        },
        {
          kind: 'callout',
          title: 'Google API Services User Data Policy Compliance',
          text: 'ConcordiaTracker’s use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.',
        },
        {
          kind: 'callout',
          title: 'AI / ML Disclosure',
          text: 'We do not share, sell, or use information received from Google APIs to train third-party artificial intelligence or machine learning models.',
        },
      ],
    },
    {
      n: 3,
      title: 'How We Use Your Data',
      blocks: [
        {
          kind: 'list',
          items: [
            'Provide grade calculations, GPA projections, and dashboard features.',
            'Send essential service updates and deadline notifications (if opted-in).',
            'Improve application performance and user experience through anonymized analytics.',
          ],
        },
        {
          kind: 'highlight',
          text: 'We do not, and will never, sell your personal or academic data to third parties. Your data is never used for advertising, profiling, or any purpose beyond providing the ConcordiaTracker service.',
        },
      ],
    },
    {
      n: 4,
      title: 'Data Storage & Security',
      blocks: [
        {
          kind: 'list',
          items: [
            { label: 'Encryption', text: 'All data is encrypted in transit (TLS 1.3) and at rest via Supabase [VERIFY] PostgreSQL infrastructure.' },
            { label: 'Row Level Security', text: 'Database access is enforced per-user via Supabase [VERIFY] RLS policies. You can only read and modify your own data.' },
            { label: 'Payment Info', text: 'Financial data is handled exclusively by Stripe [VERIFY]. We never store credit card numbers on our servers.' },
            { label: 'Authentication', text: 'Session tokens are managed by Supabase [VERIFY] Auth and are never exposed to client-side JavaScript.' },
          ],
        },
      ],
    },
    {
      n: 5,
      title: 'Data Retention & Deletion',
      blocks: [
        { kind: 'p', text: 'Your data is retained for as long as your account is active. You may delete your account and all associated data at any time using:' },
        {
          kind: 'list',
          items: [
            { label: 'In-app', text: 'The “Delete Account” button in the Settings page of your dashboard. This immediately and permanently removes all your courses, assignments, grades, notifications, and profile data.' },
            { label: 'By email', text: 'Emailing concordiatracker@gmail.com to request manual deletion.' },
          ],
        },
        { kind: 'p', text: 'Upon receiving a deletion request via email or our in-app settings, ConcordiaTracker will permanently delete all associated user data from our active databases within 30 days. Backups are automatically rotated and do not retain deleted user data beyond this period.' },
        { kind: 'p', text: 'Primary Support & Data Privacy Contact: concordiatracker@gmail.com' },
      ],
    },
    {
      n: 6,
      title: 'Your Rights',
      blocks: [
        { kind: 'p', text: 'Under Quebec’s Law 25 and applicable Canadian privacy legislation, you have the right to:' },
        {
          kind: 'list',
          items: [
            'Access a copy of all personal data we store about you.',
            'Request correction of inaccurate data.',
            'Request complete deletion of your data and account.',
            'Withdraw consent for data processing at any time.',
          ],
        },
        { kind: 'p', text: 'To exercise these rights, contact us at concordiatracker@gmail.com.' },
      ],
    },
    {
      n: 7,
      title: 'Third-Party Services',
      blocks: [
        { kind: 'p', text: 'We integrate with the following third-party providers. Each has their own privacy policy:' },
        {
          kind: 'links',
          items: [
            { label: 'Google (Authentication)', href: 'https://policies.google.com/privacy' },
            { label: 'Supabase (Database & Auth)', href: 'https://supabase.com/privacy', verify: true },
            { label: 'Stripe (Payments)', href: 'https://stripe.com/privacy', verify: true },
            { label: 'Vercel (Hosting)', href: 'https://vercel.com/legal/privacy-policy', verify: true },
          ],
        },
      ],
    },
    {
      n: 8,
      title: 'Cookies',
      blocks: [
        { kind: 'p', text: 'We use essential cookies only for session management via Supabase [VERIFY] Auth. These cookies are strictly necessary to keep you logged in and do not track your browsing activity. We do not use advertising, analytics, or third-party tracking cookies.' },
      ],
    },
    {
      n: 9,
      title: 'Age Requirement',
      blocks: [
        { kind: 'p', text: 'This service is not intended for children under the age of [AGE_MINIMUM — TBD]. By creating an account, you confirm that you are at least [AGE_MINIMUM — TBD] years of age. If we learn that we have collected personal information from a child under [AGE_MINIMUM — TBD] without parental consent, we will delete that information immediately.' },
      ],
    },
    {
      n: 10,
      title: 'Changes to This Policy',
      blocks: [
        { kind: 'p', text: 'We will notify users of material changes to this Privacy Policy via email or in-app notification at least 14 days before they take effect. Continued use of the service after changes become effective constitutes acceptance of the revised policy.' },
      ],
    },
  ],
}

const terms: LegalDoc = {
  slug: 'terms',
  title: 'Terms of Service',
  lastUpdated: LAST_UPDATED,
  intro: 'The agreement between you and ConcordiaTracker.',
  sections: [
    { n: 1, title: 'Acceptance of Terms', blocks: [{ kind: 'p', text: 'By accessing ConcordiaTracker.com (“the Site”), you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this site.' }] },
    { n: 2, title: 'Nature of Service', blocks: [{ kind: 'p', text: 'ConcordiaTracker is an independent academic productivity tool built by students for students. We are not officially affiliated with, endorsed by, or partnered with Concordia University or any educational institution. The service provides grade tracking, assignment management, and GPA projection tools.' }] },
    {
      n: 3,
      title: 'User Accounts & Authentication',
      blocks: [
        {
          kind: 'list',
          items: [
            'Accounts are created via Google OAuth 2.0. We only access your email, name, and profile picture for authentication purposes.',
            'You are responsible for maintaining the security of your Google account, which provides access to this service.',
            'You must be at least [AGE_MINIMUM — TBD] years of age to create an account.',
          ],
        },
      ],
    },
    {
      n: 4,
      title: 'Accuracy of Data & Academic Responsibility',
      blocks: [
        {
          kind: 'list',
          items: [
            { label: '“Running Grade” Disclaimer', text: 'All grade calculations, GPA predictions, and “Final Exam Safety Net” results are estimates only. Users are solely responsible for verifying their official grades via their institution’s systems (e.g., Moodle, my.concordia.ca).' },
            { label: 'Academic Integrity', text: 'This tool is intended for personal organization and time management. Use of this tool must comply with your institution’s Academic Code of Conduct.' },
            { label: 'Data Accuracy', text: 'We do not verify the accuracy of user-entered data. Incorrect inputs will produce incorrect calculations.' },
          ],
        },
      ],
    },
    {
      n: 5,
      title: 'Subscriptions & Payments',
      blocks: [
        {
          kind: 'list',
          items: [
            { label: 'Free Tier', text: 'Core features are available at no cost with no time limit.' },
            { label: 'Pro Accounts', text: 'Premium features require a paid subscription. Payments are processed securely via Stripe [VERIFY]. We do not store credit card information on our servers.' },
            { label: 'Auto-Renewal', text: 'Paid subscriptions renew automatically at the end of each billing period (the Semester pass at term end; monthly plans each month). We notify you [NOTICE PERIOD — TBD] before each renewal. You can cancel anytime before the renewal date via Settings → Billing; access continues until the end of the paid period.' },
            { label: 'Refunds', text: '[REFUND POLICY — NEEDS REVIEW]. Subscriptions can be canceled at any time to prevent future billing; access continues until the end of the current billing period.' },
            { label: 'Price Changes', text: 'We reserve the right to modify subscription pricing with 30 days’ notice to existing subscribers.' },
          ],
        },
      ],
    },
    {
      n: 6,
      title: 'Acceptable Use',
      blocks: [
        { kind: 'p', text: 'You agree not to:' },
        {
          kind: 'list',
          items: [
            'Use the service for any unlawful purpose or in violation of any applicable regulations.',
            'Attempt to reverse-engineer, decompile, or disassemble any part of the service.',
            'Upload malicious content, spam, or attempt to breach security measures.',
            'Share your account credentials or allow unauthorized access.',
          ],
        },
      ],
    },
    { n: 7, title: 'Intellectual Property', blocks: [{ kind: 'p', text: 'The ConcordiaTracker name, logo, user interface, and underlying code are the property of ConcordiaTracker and are protected by applicable intellectual property laws. User-entered data (courses, grades, assignments) remains the property of the user.' }] },
    { n: 8, title: 'Limitation of Liability', blocks: [{ kind: 'p', text: 'To the maximum extent permitted by law, ConcordiaTracker and its creators shall not be liable for any academic penalties, financial loss, missed deadlines, incorrect grade calculations, or data inaccuracies resulting from the use of this service. This service is provided “as is” and “as available” without warranties of any kind.' }] },
    { n: 9, title: 'Termination', blocks: [{ kind: 'p', text: 'We reserve the right to suspend or terminate your account at our sole discretion if you violate these Terms. You may delete your account at any time via the Settings page or by contacting concordiatracker@gmail.com.' }] },
    { n: 10, title: 'Governing Law', blocks: [{ kind: 'p', text: 'These Terms shall be governed by and construed in accordance with the laws of the Province of Quebec and the federal laws of Canada applicable therein, without regard to conflict of law principles.' }] },
  ],
}

const educator: LegalDoc = {
  slug: 'educator',
  title: 'Educator Agreement',
  lastUpdated: LAST_UPDATED,
  intro: 'Governs use of ConcordiaTracker by instructors and institutions. Its terms have not been drafted yet.',
  sections: [
    { n: 1, title: 'Purpose & Scope', blocks: [{ kind: 'p', text: '[PLACEHOLDER] — to be drafted.' }] },
    { n: 2, title: 'Eligibility & Verification', blocks: [{ kind: 'p', text: '[PLACEHOLDER] — to be drafted.' }] },
    { n: 3, title: 'Student Data & Privacy Responsibilities', blocks: [{ kind: 'p', text: '[PLACEHOLDER] — to be drafted. Will align with the Privacy Policy and Quebec Law 25.' }] },
    { n: 4, title: 'Acceptable Use', blocks: [{ kind: 'p', text: '[PLACEHOLDER] — to be drafted.' }] },
    { n: 5, title: 'Termination', blocks: [{ kind: 'p', text: '[PLACEHOLDER] — to be drafted.' }] },
  ],
}

export const LEGAL_DOCS: Record<LegalDoc['slug'], LegalDoc> = {
  privacy,
  terms,
  educator,
}
