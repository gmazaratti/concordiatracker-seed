import { useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { ImageCropper } from '@/components/ui/ImageCropper'
import { IMAGE_ACCEPT_ATTR, uploadOrgImage } from '@/lib/imageUpload'
import { Row } from '../controls'
import { UserAvatar } from '@/components/UserAvatar'

/**
 * Change your profile picture: pick an image, position it in the circle it
 * will be shown in, and it is re-encoded and uploaded (lib/imageUpload strips
 * anything that is not pixels). "Remove" goes back to the Google photo for a
 * Google account, and to initials otherwise.
 *
 * An uploaded photo is never overwritten by Google's on the next sign-in:
 * useSupabaseProfile only syncs the Google picture while the stored one IS
 * Google's.
 */
export function ProfilePhotoRow({ provider }: { provider: string }) {
  const { user, updateProfile } = useAppData()
  const input = useRef<HTMLInputElement>(null)
  const [cropping, setCropping] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const own = !!user.avatarUrl && !/googleusercontent\.com/.test(user.avatarUrl)

  async function upload(file: File) {
    setBusy(true)
    setErr('')
    try {
      const url = await uploadOrgImage(file, 'logo')
      updateProfile({ avatar_url: url })
      setCropping(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'That photo did not upload. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const description = own
    ? 'Your photo, shown on your profile and next to what you post.'
    : provider === 'google'
      ? 'Your Google photo. Upload one to use something else.'
      : 'Your initials, until you add a photo.'

  return (
    <Row label="Profile photo" description={err || description}>
      <div className="flex items-center gap-2">
        <UserAvatar className="size-9" textClass="text-[12px]" />
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-fg transition-colors hover:bg-surface-2 disabled:opacity-50"
        >
          {busy ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Camera size={13} aria-hidden />}
          {user.avatarUrl ? 'Change' : 'Add photo'}
        </button>
        {own && (
          <button
            type="button"
            onClick={() => updateProfile({ avatar_url: null })}
            className="rounded-lg px-2 py-1.5 text-[12px] font-medium text-muted transition-colors hover:text-fg"
          >
            Remove
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept={IMAGE_ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) setCropping(f)
          }}
        />
      </div>
      {cropping && (
        <ImageCropper
          file={cropping}
          kind="logo"
          noun="photo"
          busy={busy}
          onCancel={() => setCropping(null)}
          onDone={(f) => void upload(f)}
        />
      )}
    </Row>
  )
}
