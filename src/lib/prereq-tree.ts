import type { CatalogCourse } from '@/lib/catalog'
import { normalizeCode, parsePrereq, type Term } from '@/lib/prereq'

/**
 * Walking the prerequisite chain in both directions.
 *
 * Backwards is "what do I need before this", which is a tree: each requirement
 * has its own requirements. Forwards is "what does this open up", which is a
 * flat list, because the interesting answer is what becomes available NEXT, and
 * two levels of that is already a hundred courses nobody reads.
 */

export interface TreeNode {
  code: string
  course: CatalogCourse | null
  /** Requirements, each of which is a group of alternatives. */
  terms: Term[]
  children: TreeNode[]
  /** True when the student has finished this course. */
  done: boolean
  /** Already on the path above this node: expanded there, stopped here. */
  repeated: boolean
  depth: number
}

/** Fetch a whole level of the chain at once. Injected, so the walk itself has
 *  no data-layer dependency and can be exercised without a database. */
export type FetchLevel = (codes: string[]) => Promise<CatalogCourse[]>

/** How a course's code reads once normalised, from its catalogue row. */
export const codeOf = (c: CatalogCourse): string => normalizeCode(`${c.subject}${c.catalog}`)

/**
 * Build the requirement tree beneath a course.
 *
 * Fetches a LEVEL at a time rather than a course at a time: a chain four deep
 * with three branches each is forty requests one way and four the other.
 *
 * Three things stop it running away, and all three are necessary:
 *   - a depth limit, because the chain can be long;
 *   - a global seen-set, so a course reached by two different paths is only
 *     expanded once;
 *   - a per-path check, so a cycle in the data cannot loop forever. Prerequisite
 *     chains should never cycle, but "should never" is not a guarantee about
 *     text somebody typed.
 *
 * A course the student has already finished is a leaf. What it required stops
 * mattering the moment it is done, and expanding it buries the part they still
 * have to act on.
 */
export async function buildPrereqTree(
  rootCode: string,
  completed: Set<string>,
  fetchLevel: FetchLevel,
  maxDepth = 4,
): Promise<TreeNode> {
  const norm = normalizeCode(rootCode)
  const [rootCourse] = await fetchLevel([rootCode])

  const root: TreeNode = {
    code: norm,
    course: rootCourse ?? null,
    terms: parsePrereq(rootCourse?.prerequisites).terms,
    children: [],
    done: completed.has(norm),
    repeated: false,
    depth: 0,
  }

  const expanded = new Set<string>([norm])
  let frontier: { node: TreeNode; path: Set<string> }[] = [{ node: root, path: new Set([norm]) }]

  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth++) {
    // Every code this level needs, deduplicated, so the fetch is one call.
    // Codes already on the path are still fetched: the node is drawn as a
    // repeat rather than expanded, and drawing it needs its title.
    const wanted = new Set<string>()
    for (const { node } of frontier) {
      if (node.done) continue
      for (const term of node.terms) {
        for (const alt of term.alternatives) if (alt.code) wanted.add(alt.code)
      }
    }
    if (wanted.size === 0) break

    const rows = await fetchLevel([...wanted])
    const byCode = new Map(rows.map((c) => [codeOf(c), c]))
    const next: { node: TreeNode; path: Set<string> }[] = []

    for (const { node, path } of frontier) {
      if (node.done) continue
      const seenHere = new Set<string>()
      for (const term of node.terms) {
        for (const alt of term.alternatives) {
          if (!alt.code || seenHere.has(alt.code)) continue
          seenHere.add(alt.code)
          const course = byCode.get(alt.code) ?? null
          // Seen anywhere before, or seen on the way down to here. The second
          // is what makes a cycle terminate; the first stops a diamond being
          // expanded twice.
          const already = expanded.has(alt.code) || path.has(alt.code)
          const child: TreeNode = {
            code: alt.code,
            course,
            terms: already ? [] : parsePrereq(course?.prerequisites).terms,
            children: [],
            done: completed.has(alt.code),
            repeated: already,
            depth,
          }
          node.children.push(child)
          if (!already && !child.done) {
            expanded.add(alt.code)
            next.push({ node: child, path: new Set([...path, alt.code]) })
          }
        }
      }
    }
    frontier = next
  }

  return root
}

/** Every node in the tree, flattened, for counting and for a list view. */
export function flatten(node: TreeNode): TreeNode[] {
  return [node, ...node.children.flatMap(flatten)]
}

/**
 * What is left to do, ignoring the alternatives you have already satisfied.
 *
 * A term counts as satisfied when ANY of its alternatives is done, so a student
 * who took COMP 232 is not told they still owe COEN 231.
 */
export function outstanding(node: TreeNode): TreeNode[] {
  return flatten(node).filter(
    (n) => n !== node && !n.done && !n.repeated && n.course !== null,
  )
}
