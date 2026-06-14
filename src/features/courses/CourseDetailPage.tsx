import { useParams } from 'react-router-dom'
import { PagePlaceholder } from '@/components/PagePlaceholder'

export function CourseDetailPage() {
  const { courseId } = useParams()
  return (
    <PagePlaceholder
      eyebrow={`Course · ${courseId ?? '—'}`}
      title="Course detail"
      description="Grades, notes, provenance, calculators, and the parse-reveal live here. Dynamic routing is already wired. Built in step 3."
    />
  )
}
