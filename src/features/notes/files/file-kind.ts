import { FileImage, FileSpreadsheet, FileText, FileType2, Presentation, type LucideIcon } from 'lucide-react'
import { isImageFile, isPdfFile, type NoteFile } from './files-api'

/** The icon and colour that say what kind of file this is at a glance. */
export function fileKind(f: Pick<NoteFile, 'mime' | 'name'>): { icon: LucideIcon; label: string; tint: string } {
  if (isPdfFile(f)) return { icon: FileText, label: 'PDF', tint: '#e5484d' }
  if (isImageFile(f)) return { icon: FileImage, label: 'Image', tint: '#3e9b8f' }
  const n = f.name.toLowerCase()
  if (/\.(pptx?|key)$/.test(n)) return { icon: Presentation, label: 'Slides', tint: '#e8833a' }
  if (/\.(xlsx?|csv)$/.test(n)) return { icon: FileSpreadsheet, label: 'Sheet', tint: '#30a46c' }
  if (/\.(docx?)$/.test(n)) return { icon: FileType2, label: 'Word', tint: '#3e63dd' }
  return { icon: FileText, label: 'File', tint: '#8b8898' }
}
