import { Group } from '../controls'
import { TokenPanel } from '@/features/tokens/TokenPanel'

/**
 * Settings → Developer.
 *
 * ITS OWN SECTION RATHER THAN A ROW UNDER ACCOUNT. A credential that outlives
 * a session, can be handed to a script, and needs revoking on its own is not a
 * profile field; burying it under Account would make it both hard to find and
 * easy to mistake for one.
 */
export function DeveloperSection() {
  return (
    <>
      <Group label="API tokens" padded>
        <TokenPanel scope="me" />
      </Group>

      <Group label="What you can do with one" padded>
        <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-subtle">
          <li>
            <code className="rounded bg-surface-2 px-1">GET /api/v1/me/courses</code> — your
            classes this term.
          </li>
          <li>
            <code className="rounded bg-surface-2 px-1">GET /api/v1/me/assignments</code> — every
            deadline, with its weight and status.
          </li>
          <li>
            <code className="rounded bg-surface-2 px-1">PATCH /api/v1/me/assignments/&#123;id&#125;</code>{' '}
            — tick something off, or record a grade.
          </li>
          <li>
            <code className="rounded bg-surface-2 px-1">GET /api/v1/me/gpa</code> — your standing,
            per course and overall.
          </li>
        </ul>
        <p className="mt-2 text-[11.5px] leading-relaxed text-subtle">
          A token reads and writes only your own account, and only the things the app itself lets
          you change — status, grades and notes. It cannot move a deadline, alter a weight, or
          touch anybody else&rsquo;s data.
        </p>
      </Group>
    </>
  )
}
