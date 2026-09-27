# ConcordiaTracker Brand System

Everything here is read from the code, not invented. Source of truth:

| What | Where |
| --- | --- |
| Color tokens, every theme, fonts, radii | `src/index.css` |
| Theme list (free / Pro) | `src/app/providers/theme.ts` |
| Custom-theme derivation (contrast maths) | `src/lib/color.ts` |
| Course identity colors | `src/lib/course-color.ts` |
| Community category colors | `src/features/community/category.ts` |
| Buttons, cards, inputs, select, checkbox | `src/components/ui/*`, `src/features/settings/controls.tsx` |
| Logo | `src/components/Logo.tsx`, `public/favicon.svg` |
| Email palette | `api/_email.ts` |

If this file and those disagree, the code wins. Update this file when a token changes.

---

## 1. Identity

ConcordiaTracker is an academic hub for Concordia University students: deadlines, grades, calendar and campus events. It is **independent**: never use Concordia University's logo or crest, and public pages carry "Not affiliated with Concordia University."

**Personality**

- **Calm, not loud.** Near-black canvas with a faint cool cast, one muted sage accent. Saturated color is reserved for urgency (overdue in red).
- **Honest.** Every date carries a provenance badge: Official, Confirmed by N students, Unverified.
- **Typography-led.** Hierarchy comes from size and weight, not boxes and color.
- **Restrained motion.** 150–260ms almost everywhere. One hero moment: the syllabus-parse reveal.

**The mark**

- Tile: 32×32 rounded square, corner radius 7 (about 22%), filled with Surface 2.
- Symbol: an open "C" arc (`M21.6 11.4a6.7 6.7 0 1 0 0 9.2`), 3-unit stroke, round caps, in the accent, with a dot (r 1.8 at 22.6, 16) closing its mouth. Reads as a C and as a progress ring.
- Wordmark: Hanken Grotesk 500. "Concordia" in Foreground, "Tracker" in Muted, no space. 17px in the app bar, 34px large.
- Gap mark to word: 8px (large 14px).
- Assets: `favicon.svg`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`, `og-image.png`.
- Browser theme color: `#0F0F16`.

---

## 2. Core palette: Refined Dark (default)

Tokens are named by job, not hue (`--ct-*` in CSS, the same names as Tailwind utilities: `bg-canvas`, `text-fg`, …).

### Surfaces and lines

| Token | Hex | Use |
| --- | --- | --- |
| `canvas` | `#0F0F16` | Page background, app shell |
| `surface` | `#191926` | Cards, panels, sheets |
| `surface-2` | `#222231` | Raised fills, inputs, hover |
| `border` | `#2C2C3D` | Hairlines, dividers |
| `border-strong` | `#3B3B50` | Control outlines, scrollbar thumb |

### Text

| Token | Hex | Use |
| --- | --- | --- |
| `fg` | `#F4F3F7` | Primary text, titles |
| `muted` | `#B2B0C2` | Secondary text |
| `subtle` | `#8B8898` | Captions, placeholders (tuned to at least 4.5:1) |

### Accent (primary brand color)

| Token | Value | Use |
| --- | --- | --- |
| `accent` | `#8FB39A` sage / eucalyptus | Primary buttons, active nav, progress, focus |
| `accent-hover` | `#A6C6AF` | Hover (lightens on dark themes) |
| `accent-contrast` | `#0E1C14` | Text on accent fills |
| `accent-soft` | `rgba(143,179,154,0.14)` | Selected rows, tinted chips, selection |
| `accent-ring` | `rgba(143,179,154,0.5)` | Focus outline |
| `brand` | `#8FB39A` | Brand surface tint (used sparingly) |

### Status

| Token | Hex | Meaning |
| --- | --- | --- |
| `success` | `#4EC9A5` | Done, saved |
| `warning` | `#E7A93A` | Due today, done late |
| `danger` | `#F0676B` | Overdue, missed, destructive |
| `info` | `#5AA9F0` | In progress, verified seal |

### Provenance

| Token | Hex | Meaning |
| --- | --- | --- |
| `prov-official` | `#4EC9A5` | From the syllabus or registrar |
| `prov-confirmed` | `#5AA9F0` | Corroborated by classmates |
| `prov-unverified` | `#CF9A52` | Self-entered or single source |

### Assessment status → color

| Status | Dot and label | Meaning |
| --- | --- | --- |
| Not started | `subtle` | Open |
| In progress | `info` | Open, being worked on |
| Done | `success` | Finished on time |
| Done late | `warning` | Finished after the deadline |
| Missed | `danger` | Not submitted |
| Extension, Awaiting grade | `accent` | Needs a follow-up |
| Due-date text | `danger` / `warning` / `fg` | Overdue / due today / otherwise |

---

## 3. All themes

Dark and Light are free; Concordia Maroon, Purple Dark and Light Rose are Semester-pass themes. Students can also build a custom theme: an accent and optionally a page color. Surfaces, borders and all three text levels are derived with measured WCAG contrast; text is never user-chosen.

| Token | Refined Dark | Light | Concordia Maroon | Purple Dark | Light Rose |
| --- | --- | --- | --- | --- | --- |
| scheme | dark | light | dark | dark | light |
| canvas | `#0F0F16` | `#F5F6F4` | `#1A0D12` | `#181A3D` | `#FDF6F8` |
| surface | `#191926` | `#FFFFFF` | `#261620` | `#1C243C` | `#FFFFFF` |
| surface-2 | `#222231` | `#ECEEEA` | `#321B28` | `#283353` | `#F7E9EE` |
| border | `#2C2C3D` | `#E3E5E0` | `#422530` | `#2C3658` | `#F0DDE4` |
| border-strong | `#3B3B50` | `#CDD0C9` | `#56333F` | `#3C4870` | `#DDC0CC` |
| fg | `#F4F3F7` | `#1A1C1A` | `#F8F0F1` | `#EEF0FB` | `#221A1D` |
| muted | `#B2B0C2` | `#555B54` | `#D3B2BA` | `#B6BBDB` | `#5C4A51` |
| subtle | `#8B8898` | `#697066` | `#B08D97` | `#8C92BA` | `#7A6670` |
| accent | `#8FB39A` | `#46785A` | `#E8B84B` | `#7C3AED` | `#C04A72` |
| accent-hover | `#A6C6AF` | `#3C6A4F` | `#F1C869` | `#8D57F1` | `#A83C62` |
| accent-contrast | `#0E1C14` | `#FFFFFF` | `#1B0D04` | `#FFFFFF` | `#FFFFFF` |
| accent-soft | sage 14% | `rgba(70,120,90,.12)` | `rgba(232,184,75,.14)` | `rgba(124,58,237,.16)` | `rgba(192,74,114,.12)` |
| accent-ring | sage 50% | `rgba(70,120,90,.45)` | `rgba(232,184,75,.55)` | `rgba(124,58,237,.55)` | `rgba(192,74,114,.45)` |
| brand | `#8FB39A` | `#46785A` | `#912338` | `#6039DC` | `#C04A72` |
| success | `#4EC9A5` | `#13774F` | `#5BBF9B` | `#34D399` | `#13774F` |
| warning | `#E7A93A` | `#8A5D0A` | `#E7A93A` | `#F0B03F` | `#8A5D0A` |
| danger | `#F0676B` | `#D33F43` | `#E7696D` | `#F76E74` | `#CF3A2F` |
| info | `#5AA9F0` | `#2F6FCE` | `#6AA6E0` | `#6AA6F5` | `#2F6FCE` |
| prov-official | `#4EC9A5` | `#13774F` | `#5BBF9B` | `#34D399` | `#13774F` |
| prov-confirmed | `#5AA9F0` | `#2F6FCE` | `#6AA6E0` | `#6AA6F5` | `#2F6FCE` |
| prov-unverified | `#CF9A52` | `#8A5D0A` | `#D49F57` | `#D6A45C` | `#8A5D0A` |

Notes:

- **Two sages.** On light surfaces use the deeper `#46785A`; the pale `#8FB39A` fails contrast on white.
- Concordia Maroon's `brand` is Concordia maroon `#912338`; its accent is gold.
- Purple Dark's `#7C3AED` is Tailwind's stock violet, which the project otherwise avoids. It is an optional Pro theme, not the brand.
- **High contrast** (`prefers-contrast: more`): Border becomes Border strong, Subtle becomes Muted, backdrop blur is removed.
- **Print**: white page, text `#141614`, muted `#3F443E`, subtle `#5C625A`, borders `#C9CCC6` / `#A8ACA5`, accent `#35604A`, no shadows.

---

## 4. Fixed identity colors

These never change with the theme. Soft fills are the same hex at 16% opacity.

**Course colors** (chosen per class)

| Name | Hex |
| --- | --- |
| Blue | `#3F7FD6` |
| Teal | `#1C9C91` |
| Green | `#4F9D5B` |
| Amber | `#D29A36` |
| Orange | `#CF7039` |
| Rose | `#CF5470` |
| Purple | `#8869C4` |
| Slate | `#647084` |

**Community event categories**

| Category | Hex |
| --- | --- |
| Clubs | `#A78BFA` |
| Career | `#5B9CF6` |
| Academic | `#E0A13C` |
| Official | `#4FB89A` |
| Nightlife | `#E0619A` |

**Story ring (unseen stories):** `#F0A13A → #F0523A → #D63AA4 → #7B61FF → #3AB7F0 → #F0A13A`.

---

## 5. Typography

| Role | Family | Weights loaded | Stack |
| --- | --- | --- | --- |
| Display | Hanken Grotesk | 400, 500, 600, 700, 800 | `'Hanken Grotesk', 'Inter', system-ui, sans-serif` |
| UI and body | Inter | 400, 500, 600, 700 | `'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif` |

Both load from Google Fonts. Hanken Grotesk is used with restraint: wordmark, page titles, landing headlines. Never for labels or body text.

**Scale in use**

| Role | Setting |
| --- | --- |
| Landing hero | Hanken 500, `clamp(2.5rem, 5vw, 4.5rem)` (40–72px), line height 1.02, tracking −0.022em |
| Landing section heading | Hanken 500, `clamp(1.8rem, 3.4vw, 2.6rem)`, line height 1.1 |
| App page title | Hanken 500–600, 22 / 26 / 28px |
| Admin stat value | Hanken 600, 19px |
| Panel heading | Inter 600, 14–16px |
| Chat and long reading | Inter 400, 15px, line height 1.625 |
| Body / row title | Inter 400–500, 13–14px |
| Secondary | Inter 400, 12–12.5px, Muted |
| Caption / meta | Inter 400, 11–11.5px, Subtle |
| Micro label | Inter 600, 10–10.5px, uppercase, tracking +0.025em (up to 0.12em) |

- Most-used sizes: 12px, 13px, 12.5px, 11px, 11.5px, 14px. The UI is small and dense.
- Working weight is Medium 500; Semibold 600 for headings and labels; Bold is rare.
- Line heights: relaxed 1.625 (running text), snug 1.375, tight 1.25 (headings), none 1 (wordmark, numbers).
- Rendering: antialiased, `text-rendering: optimizeLegibility`, `tabular-nums` wherever digits align.
- On screens under 768px, form fields are forced to 16px so iOS never zooms on focus.

---

## 6. Spacing, layout, radius, shadow

**Spacing** is Tailwind's 4px scale. Most used: 8px (gap-2, py-2), 6px, 12px, 4px, 10px, 16px (card padding), 20px (page gutter).

**Layout**

- Page gutter: 20px, 24px from 640px up.
- Content width: 1024px (Today, Courses), 768px (reading pages, profiles), 1600px (Planner).
- Sidebar 256px (68px collapsed); course side panel 300px; glance rail 272px.
- Breakpoints: Tailwind defaults 640 / 768 / 1024 / 1280. Two-column layouts start at 1024.

**Radius** (four steps overridden in `index.css`)

| Token | Value | Use |
| --- | --- | --- |
| `rounded` | 4px | Chips, small badges |
| checkbox | 5px | Checkbox |
| `rounded-md` | 10px | Small buttons, text inputs |
| `rounded-lg` | 14px | Medium buttons, selects, rows (most used) |
| `rounded-xl` | 18px | Cards, large buttons |
| `rounded-2xl` | 24px | Dialogs, sheets |
| `rounded-full` | 9999px | Pills, avatars, dots |

**Shadow**

| Name | Value | Use |
| --- | --- | --- |
| `--ct-shadow` (dark) | `0 1px 2px rgba(0,0,0,.4), 0 12px 28px -10px rgba(0,0,0,.55)` | Floating cards |
| `--ct-shadow` (light) | `0 1px 2px rgba(20,30,20,.06), 0 12px 28px -10px rgba(20,30,20,.16)` | Same, light themes |
| `shadow-sm` | Tailwind default | Primary buttons, switch knob |
| `shadow-lg` | Tailwind default | Toasts, grade prompt |
| `shadow-2xl` | `0 25px 50px -12px rgba(0,0,0,.25)` | Dialogs, dropdowns, popovers, command palette |

Cards on the page have **no shadow**: a 1px border separates them. Shadow is for things that float.

---

## 7. Components

### Buttons

| Variant | Style |
| --- | --- |
| Primary | Accent fill, Accent-contrast text, weight 500, `shadow-sm`. Hover: Accent hover. |
| Outline | 1px Border strong, Foreground text. Hover: Surface 2 fill. |
| Ghost | No border, Muted text. Hover: Foreground text on Surface 2. |

| Size | Height | Padding | Text | Radius |
| --- | --- | --- | --- | --- |
| sm | 32px | 12px | 13px | 10px |
| md | 40px | 16px | 14px | 14px |
| lg | 48px | 24px | 15px | 18px |

States: press scales to 97% on pointer-down (150ms); disabled is 50% opacity; focus is a 2px Accent-ring outline, offset 2px.

### Cards and lists

- Card: Surface fill, 1px Border, radius 18px, no shadow.
- List rows are separated by 1px Border dividers, not boxed individually.
- Secondary rails recede: Surface at 50% opacity, Border at 60%.

### Inputs and controls

| Control | Style |
| --- | --- |
| Text field | Surface 2 fill, 1px Border, radius 10px, 8×10px padding, 13px. Placeholder Subtle. Focus: Accent border. Error: Danger border plus a Danger message beneath. |
| Select (field) | Canvas fill, 1px Border, radius 14px, 8×12px, 13px. Custom list, never the native menu; the list floats with `shadow-2xl`. |
| Select (control) | Surface 2 fill, Border strong, 4×10px, 12px medium, optional 6px status dot. |
| Checkbox | 18px, radius 5px. Off: Canvas + Border strong. On: Accent fill, Accent-contrast check. |
| Switch | 36×20 pill, 16px white knob inset 2px with `shadow-sm`, slides 16px in 150ms. On: Accent. Off: Surface 2 with a 1px Border ring. |
| Range | 4px Border-strong track, 13px Accent thumb. |
| Scrollbar | 10px, Border-strong thumb on a transparent track, Subtle on hover. |

Native `<select>`, date and color inputs are never used; the app has custom ones.

### Chips, badges, nudges

- **Course chip:** the course hex at 16% as fill, full hex as text, 11px semibold, radius 4px, 2×6px padding.
- **Provenance badge:** 6px dot + label in the provenance color. The quiet variant keeps the dot and drops the label to Subtle.
- **Status:** 6px dot + label in the status color.
- **Upgrade chip:** Accent-soft fill, radius 14px, an uppercase "Pro" tag. Free users only.
- **Verified seal:** filled scalloped disc in Info with a white check, for authenticated clubs.
- **Loading:** a shimmer sweeping Surface 2 → Border → Surface 2 over 1.4s. No spinners over content.

### Icons

Lucide, outline, default 2px stroke, round caps. Check marks inside filled circles use a 3px stroke.

---

## 8. Motion and layering

CSS transitions and keyframes only. Reduced motion (OS setting or the in-app switch) zeroes every duration.

| Moment | Duration | Easing / movement |
| --- | --- | --- |
| Hover, color, press | 150ms | ease; press scale 0.97 |
| Fade in | 160ms | ease-out |
| Pop in (menus, toasts, palette) | 190ms | `cubic-bezier(0.2, 0.8, 0.2, 1)`, rise 8px, scale 0.985 → 1 |
| Bottom sheet | 220ms | `cubic-bezier(0.32, 0.72, 0, 1)` |
| Section change | 240ms | `cubic-bezier(0.32, 0.72, 0, 1)` |
| Side panels | 260ms | `cubic-bezier(0.32, 0.72, 0, 1)` |
| Task check-off | 320ms | `cubic-bezier(0.4, 0, 0.2, 1)`, accent wash + check burst |
| Syllabus-parse hero | 1100ms scan, 420ms per item | scan line sweeps, dates cascade in with a 230ms stagger |
| Landing preview | 480ms | `cubic-bezier(0.2, 0.8, 0.2, 1)`, slides in from 48px right |
| Skeleton shimmer | 1.4s loop | ease-in-out |

| Layer | z-index |
| --- | --- |
| Floating helper card | 30 |
| Full-page overlays (composers, story viewer, side panels) | 70–90 |
| Dialogs | 100 |
| Image cropper, full-screen preview | 110 |
| Undo toast / grade prompt / error toast | 120 / 125 / 130 |
| Popovers / select lists | 200 / 210 |

---

## 9. Email

Emails are deliberately light: mail clients recolor or strip dark emails.

| Role | Hex |
| --- | --- |
| Accent (buttons, links) | `#46785A` |
| Ink (headings) | `#16181C` |
| Body | `#43474E` |
| Subtle (footer, meta) | `#767B85` |
| Line | `#E3E5E8` |
| Canvas | `#F5F6F4` |
| Card | `#FFFFFF` |

Font stack: `'Hanken Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`. Wordmark 17px bold, heading 21px semibold at line height 1.3, both at −0.01em. Table-based layout, under 4KB.

---

## 10. Brief for an image AI

```
Brand: ConcordiaTracker, an academic planner app for university students (Concordia University, Montreal). Independent, not the university's official brand; no crests or university logos.

Mood: calm, focused, modern product design. Quiet confidence, not playful, not corporate. Dark mode first.

Palette:
- Background: near-black with a faint cool blue cast, #0F0F16
- Cards and panels: #191926, raised elements #222231
- Hairline borders: #2C2C3D
- Main text: off-white #F4F3F7; secondary text: lavender grey #B2B0C2
- Single accent: muted sage / eucalyptus green #8FB39A (use sparingly: one button, one highlight, a progress ring)
- Status colors only where meaning requires it: teal green #4EC9A5, amber #E7A93A, coral red #F0676B, sky blue #5AA9F0
- Optional class colors as small dots or chips: #3F7FD6 blue, #1C9C91 teal, #CF5470 rose, #D29A36 amber, #8869C4 purple

Type: geometric grotesque headlines (Hanken Grotesk, medium weight, tight letter-spacing), clean neutral UI text (Inter). Small, dense interface text.

Shapes: soft rounded rectangles (10 to 24px corners), 1px borders instead of heavy shadows, generous negative space, thin outline icons (Lucide, 2px stroke, rounded caps).

Logo: a rounded dark square holding an open letter "C" drawn as a thick sage green arc with a small dot closing its opening, next to the wordmark "ConcordiaTracker" where "Tracker" is a lighter grey.

Avoid: purple-to-blue gradients, neon glow, glossy 3D, stock photos of students, clutter, bright white backgrounds (the light variant uses a soft off-white #F5F6F4 with a deeper sage #46785A).
```

---

## 11. Rules

- **One accent per screen.** Sage marks the primary action and progress; everything else is neutral.
- **Color means something.** Red is overdue or destructive, amber is today or late. Never decoration.
- **Borders before shadows.** Cards are flat with a 1px line; only floating things cast a shadow.
- **Display face sparingly.** Hanken Grotesk for titles and the wordmark only.
- **Class colors stay fixed.** A course is the same color in every theme.
- **Readable in every theme.** Subtle text clears 4.5:1. Keep it that way when adding a theme.
- **All tokens live in `src/index.css`.** A re-skin is a one-file change.
