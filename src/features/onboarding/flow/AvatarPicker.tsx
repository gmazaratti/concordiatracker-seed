import { useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { ImageCropper } from '@/components/ui/ImageCropper'
import { IMAGE_ACCEPT_ATTR, uploadOrgImage } from '@/lib/imageUpload'
import { UserAvatar } from '@/components/UserAvatar'

/**
 * The profile picture in onboarding. Someone who signed up with Google
 * already has one; anyone else (email, Apple) sees their initials with a
 * camera on them, and can add a photo right here. Same crop-and-upload path as
 * Settings (ProfilePhotoRow), so the file is re-encoded before it is stored.
 */
export function AvatarPicker() {
  const { user, updateProfile } = useAppData()
  const input = useRef<HTMLInputElement>(null)
  const [cropping, setCropping] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function upload(file: File) {
    setBusy(true)
    setErr('')
    try {
      updateProfile({ avatar_url: await uploadOrgImage(file, 'logo') })
      setCropping(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'That photo did not upload. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="relative shrink-0">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label={user.avatarUrl ? 'Change your profile photo' : 'Add a profile photo'}
        title={err || (user.avatarUrl ? 'Change photo' : 'Add a photo')}
        className="group relative block rounded-full"
      >
        <UserAvatar className="size-14" textClass="text-[17px]" />
        <span className="absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full border-2 border-canvas bg-accent text-accent-contrast transition-transform duration-200 group-hover:scale-110">
          {busy ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Camera size={12} aria-hidden />}
        </span>
      </button>
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
      {cropping && (
        <ImageCropper file={cropping} kind="logo" noun="photo" busy={busy} onCancel={() => setCropping(null)} onDone={(f) => void upload(f)} />
      )}
    </span>
  )
}
