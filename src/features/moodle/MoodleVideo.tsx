import { TutorialClip } from '@/components/TutorialClip'

/** The Moodle setup walkthrough (see TutorialClip for why it has no controls). */
export function MoodleVideo({ className }: { className?: string }) {
  return (
    <TutorialClip
      src="/moodle/setup.mp4"
      poster="/moodle/setup-poster.jpg"
      label="The Moodle setup, start to finish"
      className={className}
    />
  )
}
