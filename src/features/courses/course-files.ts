import { supabase } from '@/lib/supabase'
import { localUser } from '@/lib/local-user'

/**
 * The files a student keeps with a course — for now, the syllabus they
 * uploaded. Stored privately in the `course-files` bucket under
 * <user id>/<course id>/…, readable only by them (db/notes.sql).
 *
 * Until this existed only FAILED uploads were kept (for 30 days, so an admin
 * could re-run them). A syllabus that parsed fine was read and thrown away,
 * so the one document the course was built from could never be opened again.
 */
export interface CourseFile {
  id: string
  courseId: string
  kind: 'syllabus' | 'slides' | 'other'
  path: string
  name: string
  sizeBytes: number | null
  createdAt: string
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Keep the PDF a syllabus was read from. Fire-and-forget from the importer: it
 * never blocks adding the course, and a failure costs the "open syllabus" card,
 * not the import.
 *
 * The course row can still be on its way to the database when this runs (the
 * app adds courses optimistically), and the file record is refused until it
 * exists, so the record is retried for a few seconds before giving up.
 */
export async function storeSyllabusFile(courseId: string, file: File): Promise<boolean> {
  const { data } = await localUser()
  const uid = data.user?.id
  if (!uid) return false
  const ext = file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'bin'
  const path = `${uid}/${courseId}/${crypto.randomUUID()}.${ext}`
  const up = await supabase.storage.from('course-files').upload(path, file, {
    contentType: file.type || 'application/pdf',
    upsert: false,
  })
  if (up.error) return false
  for (let attempt = 0; attempt < 4; attempt++) {
    const { error } = await supabase.from('course_files').insert({
      course_id: courseId,
      kind: 'syllabus',
      path,
      name: file.name.slice(0, 200),
      mime: file.type || 'application/pdf',
      size_bytes: file.size,
    })
    if (!error) return true
    await sleep(1500)
  }
  // Nothing points at the upload, so do not leave it behind.
  await supabase.storage.from('course-files').remove([path])
  return false
}

export async function listCourseFiles(courseId: string): Promise<CourseFile[]> {
  const { data, error } = await supabase
    .from('course_files')
    .select('id,course_id,kind,path,name,size_bytes,created_at')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (
    (data ?? []) as {
      id: string
      course_id: string
      kind: CourseFile['kind']
      path: string
      name: string
      size_bytes: number | null
      created_at: string
    }[]
  ).map((r) => ({
    id: r.id,
    courseId: r.course_id,
    kind: r.kind,
    path: r.path,
    name: r.name,
    sizeBytes: r.size_bytes,
    createdAt: r.created_at,
  }))
}

/** A short-lived link to view a private file. Ten minutes: long enough to read,
 *  short enough that a link copied out of the page stops working. */
export async function courseFileUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('course-files').createSignedUrl(path, 600)
  return error ? null : data.signedUrl
}

export async function deleteCourseFile(file: CourseFile): Promise<boolean> {
  const { error } = await supabase.from('course_files').delete().eq('id', file.id)
  if (error) return false
  await supabase.storage.from('course-files').remove([file.path])
  return true
}
