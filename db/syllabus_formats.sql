-- Syllabus uploads take more than PDF (2026-11-10): Word .docx, photos and
-- plain text. The two buckets that hold an uploaded outline accept them too:
-- `parse-failures` (a failed upload kept for an admin retry) and
-- `course-files` (the outline kept on the course). Sizes unchanged.
update storage.buckets
   set allowed_mime_types = array[
     'application/pdf',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'image/jpeg', 'image/png', 'image/webp',
     'text/plain'
   ]
 where id in ('parse-failures', 'course-files');
