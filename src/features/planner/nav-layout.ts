import { useSyncExternalStore } from 'react'

/**
 * Where the planner's sections live — TEMPORARY, so four arrangements can be
 * compared on the real screens instead of argued about.
 *
 * - `top`    a tab strip under the page title. What it has always been.
 * - `rail`   a vertical list down the left of the content. Reads as a place
 *            you are IN rather than a page you switched to, and has room for
 *            the phase names as actual headings.
 * - `pills`  a single segmented control, centred. Least chrome of the four;
 *            works because six items is right at the edge of what a segment
 *            can hold before it becomes a menu.
 * - `menu`   the section name as a dropdown beside the title. Gives every
 *            pixel to the content, at the cost of not being able to see where
 *            else you could go.
 *
 * Same deal as the schedule builder's toggle: localStorage, admin-only, and
 * the whole module goes once a winner is picked. `top` is the fallback
 * everywhere, so deleting this cannot strand anyone.
 */
export type PlannerNav = 'top' | 'rail' | 'pills' | 'menu'

export const NAV_LAYOUTS: { id: PlannerNav; label: string; hint: string }[] = [
  { id: 'top', label: 'Top', hint: 'Tab strip under the title — what it is now' },
  { id: 'rail', label: 'Rail', hint: 'Vertical list on the left, grouped by phase' },
  { id: 'pills', label: 'Pills', hint: 'One centred segmented control' },
  { id: 'menu', label: 'Menu', hint: 'A dropdown beside the title; most room for content' },
]

const KEY = 'ct_planner_nav'
const listeners = new Set<() => void>()
let current: PlannerNav | null = null

function read(): PlannerNav {
  try {
    const v = localStorage.getItem(KEY)
    return NAV_LAYOUTS.some((l) => l.id === v) ? (v as PlannerNav) : 'top'
  } catch {
    return 'top'
  }
}

export function getPlannerNav(): PlannerNav {
  current ??= read()
  return current
}

export function setPlannerNav(next: PlannerNav) {
  current = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    /* private mode — it just won't persist */
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function usePlannerNav(): PlannerNav {
  return useSyncExternalStore(subscribe, getPlannerNav, () => 'top')
}
