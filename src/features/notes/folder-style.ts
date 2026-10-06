import {
  BookOpen,
  Briefcase,
  Calculator,
  ChartLine,
  Code2,
  FlaskConical,
  Folder,
  Globe,
  GraduationCap,
  Heart,
  Landmark,
  Lightbulb,
  Music,
  Palette,
  PenLine,
  Star,
  type LucideIcon,
} from 'lucide-react'
import { COURSE_COLORS, courseColor } from '@/lib/course-color'

/** Folder icons a student can pick. Stored by key, so renaming an icon import
 *  never breaks a folder that was saved with it. */
export const FOLDER_ICONS: { key: string; icon: LucideIcon; label: string }[] = [
  { key: 'folder', icon: Folder, label: 'Folder' },
  { key: 'graduation-cap', icon: GraduationCap, label: 'Class' },
  { key: 'book', icon: BookOpen, label: 'Book' },
  { key: 'pen', icon: PenLine, label: 'Writing' },
  { key: 'flask', icon: FlaskConical, label: 'Lab' },
  { key: 'calculator', icon: Calculator, label: 'Math' },
  { key: 'chart', icon: ChartLine, label: 'Finance' },
  { key: 'briefcase', icon: Briefcase, label: 'Business' },
  { key: 'code', icon: Code2, label: 'Code' },
  { key: 'globe', icon: Globe, label: 'Languages' },
  { key: 'landmark', icon: Landmark, label: 'History' },
  { key: 'palette', icon: Palette, label: 'Art' },
  { key: 'music', icon: Music, label: 'Music' },
  { key: 'lightbulb', icon: Lightbulb, label: 'Ideas' },
  { key: 'star', icon: Star, label: 'Important' },
  { key: 'heart', icon: Heart, label: 'Personal' },
]

/** Look an icon up by key. A plain map, so a component can index it during
 *  render without the compiler treating it as a component made on the fly. */
export const FOLDER_ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(FOLDER_ICONS.map((i) => [i.key, i.icon]))
export const DEFAULT_FOLDER_ICON = Folder

/** The same fixed palette classes use, so a folder and a class sit together
 *  in one grid without looking like two systems. */
export const FOLDER_COLORS = COURSE_COLORS

export function folderHex(color: string): string {
  return courseColor(color).hex
}
