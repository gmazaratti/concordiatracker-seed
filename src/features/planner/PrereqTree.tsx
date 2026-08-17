import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ListTree,
  Loader2,
  Lock,
  Network,
  Search,
  Unlock,
  X,
} from "lucide-react";
import { useAppData } from "@/app/providers/app-data";
import { loadAcademicProfile, summarizeRecord } from "@/lib/academic-record";
import { normalizeCode } from "@/lib/prereq";
import {
  coursesByCodes,
  searchCourses,
  unlockedBy,
  type CatalogCourse,
} from "@/lib/catalog";
import { parseCourseCode } from "@/lib/course-sections";
import { buildPrereqTree, outstanding, type TreeNode } from "@/lib/prereq-tree";
import { PrereqGraph } from "./PrereqGraph";
import { cn } from "@/lib/cn";

/**
 * What a course needs, and what it opens up.
 *
 * Two views, because the two questions are different. The LIST answers "what do
 * I still owe, in what order" — indentation says everything a layout engine
 * would, and it works on a phone. The BOARD answers "if I take this, what does
 * it get me", which is a shape, not an order, and wants room to spread out.
 *
 * Colouring follows the same gate as everywhere else: without a record marked
 * complete, nothing is called met or missing, because telling someone in red
 * that they lack a course they took two years ago is worse than staying quiet.
 */
export function PrereqTree() {
  const { pastCourses, courses, assessments } = useAppData();
  const [view, setView] = useState<"list" | "board">("list");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<CatalogCourse[]>([]);
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [opens, setOpens] = useState<CatalogCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const [trusted, setTrusted] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadAcademicProfile().then(
      (p) => alive && setTrusted(p.recordComplete),
    );
    return () => {
      alive = false;
    };
  }, []);

  const completed = useMemo(() => {
    const summary = summarizeRecord(pastCourses, assessments);
    const set = new Set(summary.completedCodes.map(normalizeCode));
    for (const c of courses) if (c.code.trim()) set.add(normalizeCode(c.code));
    return set;
  }, [pastCourses, courses, assessments]);

  // Typeahead, so a code does not have to be remembered exactly.
  useEffect(() => {
    const needle = query.trim();
    if (needle.length < 2 || tree) return;
    let alive = true;
    const id = window.setTimeout(() => {
      void searchCourses(needle, 6)
        .then((r) => alive && setSuggestions(r))
        .catch(() => alive && setSuggestions([]));
    }, 220);
    return () => {
      alive = false;
      window.clearTimeout(id);
    };
  }, [query, tree]);

  const open = useCallback(
    async (code: string) => {
      const parsed = parseCourseCode(code);
      if (!parsed) return;
      const label = `${parsed.subject} ${parsed.catalog}`;
      setLoading(true);
      setSuggestions([]);
      setQuery(label);
      const [built, next] = await Promise.all([
        buildPrereqTree(label, completed, coursesByCodes),
        unlockedBy(label, 60),
      ]);
      setTree(built);
      setOpens(next);
      setLoading(false);
    },
    [completed],
  );

  const left = tree ? outstanding(tree) : [];

  /**
   * Somewhere to start.
   *
   * The page used to open on an empty search box, which asks the student to
   * already know the answer. These are courses they are in or have taken —
   * the ones whose chains they actually care about — so there is always
   * something to press.
   */
  const starters = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of [...courses, ...pastCourses]) {
      const code = c.code.trim();
      if (!code || seen.has(normalizeCode(code))) continue;
      seen.add(normalizeCode(code));
      out.push(code);
      if (out.length === 8) break;
    }
    return out;
  }, [courses, pastCourses]);

  return (
    <div>
      {/* The switch leads, so both views start at the top. The board carries
          its own search inside its library; a second one up here meant two
          places to start and no reason to prefer either. */}
      <div className="mb-4 flex justify-center">
        <div className="inline-flex gap-0.5 rounded-lg border border-border bg-surface p-1">
          {(["list", "board"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors duration-150",
                view === v
                  ? "bg-accent-soft text-fg"
                  : "text-muted hover:text-fg",
              )}
            >
              {v === "list" ? (
                <ListTree size={13} aria-hidden />
              ) : (
                <Network size={13} aria-hidden />
              )}
              {v === "list" ? "List" : "Board"}
            </button>
          ))}
        </div>
      </div>

      {view === "board" && (
        <PrereqGraph
          completed={completed}
          trusted={trusted}
          starters={starters}
          onOpenList={(code) => {
            setView("list");
            void open(code);
          }}
        />
      )}

      {view === "list" && (
        <div className="mx-auto max-w-xl">
          <div className="relative">
            <Search
              size={16}
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-subtle"
            />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setTree(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void open(query);
              }}
              placeholder="A course you are aiming for, e.g. COMP 352"
              aria-label="Course to map"
              className="w-full rounded-xl border border-border bg-surface py-3 pr-10 pl-10 text-[14px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
            />
            {(query || tree) && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setTree(null);
                  setSuggestions([]);
                }}
                aria-label="Clear"
                className="absolute top-1/2 right-3 -translate-y-1/2 text-subtle transition-colors duration-150 hover:text-fg"
              >
                <X size={15} aria-hidden />
              </button>
            )}
          </div>

          {suggestions.length > 0 && !tree && (
            <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
              {suggestions.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => void open(`${c.subject} ${c.catalog}`)}
                    className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left transition-colors duration-150 hover:bg-surface-2"
                  >
                    <span className="shrink-0 text-[13px] font-semibold text-fg">
                      {c.subject} {c.catalog}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-subtle">
                      {c.title}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!tree &&
            !loading &&
            suggestions.length === 0 &&
            starters.length > 0 && (
              <div className="mt-4 text-center">
                <p className="text-[12px] text-subtle">
                  Or start from one of yours
                </p>
                <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                  {starters.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => void open(code)}
                      className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[12.5px] font-medium text-muted transition-colors duration-150 hover:border-accent hover:text-fg"
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>
            )}
        </div>
      )}

      {view === "list" && !trusted && tree && (
        <p className="mt-3 rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-[12px] leading-relaxed text-subtle">
          Mark your record complete in My record and this will show which of
          these you have already cleared.
        </p>
      )}

      {view === "list" && loading && (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-5 animate-spin text-accent" aria-hidden />
        </div>
      )}

      {view === "list" && tree && !loading && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="min-w-0">
            <h2 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-fg">
              <Lock size={13} className="text-subtle" aria-hidden />
              What it needs
              {trusted && left.length > 0 && (
                <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-subtle">
                  {left.length} still to do
                </span>
              )}
            </h2>

            {tree.children.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-subtle">
                {tree.course?.prerequisites
                  ? "Its prerequisite names no specific course, so there is no chain to draw."
                  : "No prerequisites. You can take this whenever it runs."}
              </p>
            ) : (
              <ul className="overflow-hidden rounded-xl border border-border bg-surface">
                <Branch
                  node={tree}
                  trusted={trusted}
                  onOpen={(c) => void open(c)}
                  isRoot
                />
              </ul>
            )}

            {tree.course?.prerequisites && (
              <p className="mt-2 text-[11.5px] leading-relaxed text-subtle">
                Read from the calendar: “{tree.course.prerequisites}”
              </p>
            )}
          </section>

          <section className="min-w-0">
            <h2 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-fg">
              <Unlock size={13} className="text-subtle" aria-hidden />
              What it opens up
              {opens.length > 0 && (
                <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-subtle">
                  {opens.length}
                </span>
              )}
            </h2>
            {opens.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-subtle">
                No course in the calendar names this one as a prerequisite.
              </p>
            ) : (
              <ul className="max-h-[52vh] divide-y divide-border overflow-y-auto rounded-xl border border-border bg-surface">
                {opens.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => void open(`${c.subject} ${c.catalog}`)}
                      className="flex w-full items-center gap-2 px-3.5 py-2 text-left transition-colors duration-150 hover:bg-surface-2"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="text-[12.5px] font-semibold text-fg">
                          {c.subject} {c.catalog}
                        </span>
                        <span className="ml-2 text-[11.5px] text-subtle">
                          {c.title}
                        </span>
                      </span>
                      <ArrowUpRight
                        size={13}
                        className="shrink-0 text-subtle"
                        aria-hidden
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[11.5px] leading-relaxed text-subtle">
              Courses that name this one. Meeting a prerequisite is not the only
              condition a course can have.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

/** One node and everything under it, indented. */
function Branch({
  node,
  trusted,
  onOpen,
  isRoot = false,
}: {
  node: TreeNode;
  trusted: boolean;
  onOpen: (code: string) => void;
  isRoot?: boolean;
}) {
  const label = node.course
    ? `${node.course.subject} ${node.course.catalog}`
    : node.code.replace(/^([A-Z]+)(\d.*)$/, "$1 $2");

  return (
    <>
      <li
        className={cn(
          "flex items-center gap-2 border-b border-border/50 py-2 pr-3",
          isRoot && "bg-surface-2",
        )}
        // Indentation IS the tree. Capped so a deep chain cannot push the text
        // off a phone screen entirely.
        style={{ paddingLeft: 12 + Math.min(node.depth, 4) * 16 }}
      >
        <span
          className={cn(
            "grid size-4 shrink-0 place-items-center rounded-full text-[9px]",
            !trusted || isRoot
              ? "bg-surface-2 text-subtle"
              : node.done
                ? "bg-success/20 text-success"
                : "bg-danger/15 text-danger",
          )}
          aria-hidden
        >
          {trusted && !isRoot && node.done ? <Check size={9} /> : null}
        </span>

        <span className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onOpen(label)}
            className="block max-w-full truncate text-left text-[12.5px] transition-colors duration-150 hover:text-accent"
          >
            <span className={cn("font-medium", isRoot ? "text-fg" : "text-fg")}>
              {label}
            </span>
            {node.course?.title && (
              <span className="ml-2 text-[11.5px] text-subtle">
                {node.course.title}
              </span>
            )}
          </button>
          {node.repeated && (
            <span className="text-[10.5px] text-subtle">
              already shown above
            </span>
          )}
          {!node.course && !isRoot && (
            <span className="text-[10.5px] text-subtle">
              not in the calendar we mirror
            </span>
          )}
        </span>

        {trusted && !isRoot && (
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-medium",
              node.done
                ? "bg-success/15 text-success"
                : "bg-danger/10 text-danger",
            )}
          >
            {node.done ? "Done" : "Needed"}
          </span>
        )}
      </li>

      {node.children.map((child) => (
        <Branch
          key={`${child.code}-${child.depth}`}
          node={child}
          trusted={trusted}
          onOpen={onOpen}
        />
      ))}
    </>
  );
}
