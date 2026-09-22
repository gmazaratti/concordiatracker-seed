import { useNavigate } from 'react-router-dom'
import { CalendarPlus, FileUp, Image, PenSquare, Plus } from 'lucide-react'
import { DropdownMenu, type MenuItem } from '@/components/ui/DropdownMenu'
import { useMyOrgs } from '@/features/community/useMyOrgs'

/**
 * The `+` in the profile bar.
 *
 * WHAT IT OFFERS DEPENDS ON WHAT YOU ARE. Every student can share an outline
 * — that is the one thing a person publishes here. Somebody who runs a club
 * can also post, put up a story or add an event, and those three are the
 * club's, not theirs; they are listed under the club's name so it is never
 * ambiguous which account is about to speak.
 *
 * It is a MENU, not a composer. Each entry goes to the surface that already
 * owns that job rather than growing a fourth place to write a post — the
 * organizer portal and the blueprint browser are where those live, and
 * duplicating them here is how two composers end up disagreeing about what a
 * post is.
 */
export function ProfileCreateMenu() {
  const navigate = useNavigate()
  const { orgs } = useMyOrgs()
  const runsAClub = orgs.length > 0

  const items: MenuItem[] = [
    {
      id: 'outline',
      label: 'Share an outline',
      icon: FileUp,
      onSelect: () => navigate('/app/courses/blueprints'),
    },
  ]

  if (runsAClub) {
    items.push(
      {
        id: 'post',
        label: 'New post',
        icon: PenSquare,
        separated: true,
        onSelect: () => navigate(`/app/community/org/${orgs[0].handle.replace(/^@/, '')}?tab=posts`),
      },
      {
        id: 'story',
        label: 'New story',
        icon: Image,
        onSelect: () => navigate('/app/community'),
      },
      {
        id: 'event',
        label: 'New event',
        icon: CalendarPlus,
        onSelect: () => navigate('/organizer/event/new'),
      },
    )
  }

  return (
    <DropdownMenu
      items={items}
      ariaLabel="Create"
      icon={Plus}
      triggerClassName="grid size-9 place-items-center rounded-full text-fg transition-colors duration-150 hover:bg-surface-2"
    />
  )
}
