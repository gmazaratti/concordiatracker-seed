import {
  Atom,
  Banknote,
  BarChart3,
  Beaker,
  Binary,
  Bot,
  Brain,
  Briefcase,
  Brush,
  Building2,
  Calculator,
  Camera,
  Cpu,
  Database,
  Dna,
  Drama,
  Dumbbell,
  Earth,
  Film,
  FlaskConical,
  Gavel,
  Globe2,
  Guitar,
  HeartPulse,
  Landmark,
  Languages,
  Laptop,
  Leaf,
  Lightbulb,
  Magnet,
  Map,
  Megaphone,
  Microscope,
  Music,
  Network,
  Newspaper,
  Palette,
  PenTool,
  PieChart,
  Plane,
  Ruler,
  Scale,
  Scissors,
  Server,
  Shapes,
  ShieldCheck,
  Sigma,
  Speech,
  Stethoscope,
  Telescope,
  TrendingUp,
  Users,
  Utensils,
  Wrench,
  Zap,
  BookOpen,
  type LucideIcon,
} from 'lucide-react'

/**
 * Making a class look like itself.
 *
 * A colour alone stops being an identity once you have six classes: two of them
 * are blue-ish and you read the code every time. An icon is recognised before
 * the text is, which is the whole job of the banner.
 *
 * Icons and gradients are SEMESTER-PASS features and the plain colours are not,
 * on the same line the themes draw: a readable, distinguishable class list is
 * the product; making it yours is the upgrade. Nothing here is ever load-bearing
 * — every card still shows the course code, so a lapsed pass costs decoration
 * and never information.
 */
export interface CourseIcon {
  id: string
  label: string
  icon: LucideIcon
}

/** Grouped so the picker can show them under headings rather than as a wall. */
export const COURSE_ICON_GROUPS: { label: string; icons: CourseIcon[] }[] = [
  {
    label: 'Science & maths',
    icons: [
      { id: 'sigma', label: 'Mathematics', icon: Sigma },
      { id: 'calculator', label: 'Calculator', icon: Calculator },
      { id: 'atom', label: 'Physics', icon: Atom },
      { id: 'flask', label: 'Chemistry', icon: FlaskConical },
      { id: 'beaker', label: 'Lab', icon: Beaker },
      { id: 'dna', label: 'Biology', icon: Dna },
      { id: 'microscope', label: 'Microscope', icon: Microscope },
      { id: 'telescope', label: 'Astronomy', icon: Telescope },
      { id: 'magnet', label: 'Magnetism', icon: Magnet },
      { id: 'leaf', label: 'Environment', icon: Leaf },
      { id: 'earth', label: 'Earth science', icon: Earth },
      { id: 'brain', label: 'Psychology', icon: Brain },
    ],
  },
  {
    label: 'Engineering & computing',
    icons: [
      { id: 'laptop', label: 'Computer science', icon: Laptop },
      { id: 'binary', label: 'Programming', icon: Binary },
      { id: 'cpu', label: 'Hardware', icon: Cpu },
      { id: 'server', label: 'Systems', icon: Server },
      { id: 'database', label: 'Databases', icon: Database },
      { id: 'network', label: 'Networks', icon: Network },
      { id: 'bot', label: 'Robotics', icon: Bot },
      { id: 'zap', label: 'Electrical', icon: Zap },
      { id: 'wrench', label: 'Mechanical', icon: Wrench },
      { id: 'ruler', label: 'Design & drafting', icon: Ruler },
      { id: 'building', label: 'Civil & building', icon: Building2 },
      { id: 'plane', label: 'Aerospace', icon: Plane },
      { id: 'shield', label: 'Cybersecurity', icon: ShieldCheck },
    ],
  },
  {
    label: 'Business',
    icons: [
      { id: 'briefcase', label: 'Management', icon: Briefcase },
      { id: 'banknote', label: 'Finance', icon: Banknote },
      { id: 'trending', label: 'Economics', icon: TrendingUp },
      { id: 'piechart', label: 'Accounting', icon: PieChart },
      { id: 'barchart', label: 'Analytics', icon: BarChart3 },
      { id: 'megaphone', label: 'Marketing', icon: Megaphone },
      { id: 'users', label: 'Human resources', icon: Users },
      { id: 'globe', label: 'International', icon: Globe2 },
      { id: 'landmark', label: 'Institutions', icon: Landmark },
    ],
  },
  {
    label: 'Arts & humanities',
    icons: [
      { id: 'book', label: 'Literature', icon: BookOpen },
      { id: 'pen', label: 'Writing', icon: PenTool },
      { id: 'languages', label: 'Languages', icon: Languages },
      { id: 'speech', label: 'Communication', icon: Speech },
      { id: 'newspaper', label: 'Journalism', icon: Newspaper },
      { id: 'palette', label: 'Fine arts', icon: Palette },
      { id: 'brush', label: 'Studio', icon: Brush },
      { id: 'camera', label: 'Photography', icon: Camera },
      { id: 'film', label: 'Film', icon: Film },
      { id: 'music', label: 'Music', icon: Music },
      { id: 'guitar', label: 'Performance', icon: Guitar },
      { id: 'drama', label: 'Theatre', icon: Drama },
      { id: 'map', label: 'Geography', icon: Map },
      { id: 'shapes', label: 'Design', icon: Shapes },
      { id: 'scissors', label: 'Craft', icon: Scissors },
    ],
  },
  {
    label: 'Health, law & other',
    icons: [
      { id: 'stethoscope', label: 'Medicine', icon: Stethoscope },
      { id: 'heart', label: 'Health', icon: HeartPulse },
      { id: 'dumbbell', label: 'Exercise science', icon: Dumbbell },
      { id: 'scale', label: 'Law', icon: Scale },
      { id: 'gavel', label: 'Justice', icon: Gavel },
      { id: 'utensils', label: 'Nutrition', icon: Utensils },
      { id: 'lightbulb', label: 'Elective', icon: Lightbulb },
    ],
  },
]

export const COURSE_ICONS: CourseIcon[] = COURSE_ICON_GROUPS.flatMap((g) => g.icons)

export function courseIcon(id: string | undefined): CourseIcon | null {
  if (!id) return null
  return COURSE_ICONS.find((i) => i.id === id) ?? null
}

/**
 * Two-stop gradients, as fixed hex like the flat colours.
 *
 * Not derived from the accent, and not theme tokens: a class keeps its identity
 * across light, dark and a custom theme, exactly as the eight flat colours do.
 * Every pair was picked to carry white text at the weight the banner uses.
 */
export interface CourseGradient {
  id: string
  label: string
  from: string
  to: string
  /** The single colour this reduces to — for dots, chips and the week grid,
   *  where a gradient on a 10px square is just a muddier flat colour. */
  hex: string
}

export const COURSE_GRADIENTS: CourseGradient[] = [
  { id: 'dusk', label: 'Dusk', from: '#5b6fd6', to: '#a94fb0', hex: '#7a5ec3' },
  { id: 'ember', label: 'Ember', from: '#d2603a', to: '#c0396b', hex: '#c94d51' },
  { id: 'forest', label: 'Forest', from: '#2f8f5b', to: '#1c7f8c', hex: '#268775' },
  { id: 'tide', label: 'Tide', from: '#2b7bbd', to: '#25a39a', hex: '#288f9f' },
  { id: 'sunrise', label: 'Sunrise', from: '#d99a2f', to: '#cf5a4e', hex: '#d47a3e' },
  { id: 'orchid', label: 'Orchid', from: '#9a54c0', to: '#cf5490', hex: '#b554a8' },
  { id: 'slateblue', label: 'Steel', from: '#4c6079', to: '#6e7f96', hex: '#5d6f87' },
  { id: 'moss', label: 'Moss', from: '#6f9a3c', to: '#3f8f6b', hex: '#579553' },
  { id: 'wine', label: 'Wine', from: '#8f2f4d', to: '#5a2a6b', hex: '#752c5c' },
  { id: 'copper', label: 'Copper', from: '#b06a35', to: '#8a4a52', hex: '#9d5a43' },
  { id: 'ice', label: 'Ice', from: '#3d7fa8', to: '#6a5fb0', hex: '#546fac' },
  { id: 'clay', label: 'Clay', from: '#a05f4a', to: '#7a6a4f', hex: '#8d654c' },
]

export function courseGradient(id: string | undefined): CourseGradient | null {
  if (!id) return null
  return COURSE_GRADIENTS.find((g) => g.id === id) ?? null
}

/**
 * The CSS background for a course banner, and the flat hex everything else uses.
 *
 * One function so the banner, the grid card, the dot beside a due row and the
 * block on the week grid can never disagree about what colour a class is.
 */
export function courseBanner(
  colorHex: string,
  gradientId?: string,
): { backgroundImage: string; hex: string } {
  const g = courseGradient(gradientId)
  if (g) {
    return { backgroundImage: `linear-gradient(125deg, ${g.from}, ${g.to})`, hex: g.hex }
  }
  return {
    backgroundImage: `linear-gradient(125deg, ${colorHex}, ${colorHex}cc)`,
    hex: colorHex,
  }
}
