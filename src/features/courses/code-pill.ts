/**
 * The pill a class code sits in. A fixed height with the text centred by flex,
 * and no line-height of its own: padding around a line box left the capitals
 * sitting above the middle, because a line box reserves room under the
 * baseline that a code in capitals never uses.
 */
export const CODE_PILL =
  'inline-flex h-[26px] items-center rounded-full bg-black/25 px-2.5 pt-px text-[12px] leading-none font-semibold backdrop-blur-md'
