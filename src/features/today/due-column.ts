/**
 * The due label's column on every Today row.
 *
 * A FIXED WIDTH, right-aligned, so every row's date lines up down the list
 * whatever the title is. As `shrink-0` alone the label was as wide as its own
 * text and sat wherever the title ended, so the dates zigzagged. Wide enough
 * for "12 days overdue" on one line at `sm`; on a phone the longest labels wrap
 * to two short lines inside the column rather than stealing width from the
 * title. Shared by the assessment row and the task/Moodle row so the two kinds
 * of row line up with each other too.
 */
export const DUE_COLUMN =
  'w-[5.25rem] shrink-0 text-right leading-tight break-words sm:w-[7.25rem]'
