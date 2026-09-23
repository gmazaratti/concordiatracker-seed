import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { uploadOrgVideo, uploadRenderedImage } from '@/lib/imageUpload'
import { publishPost, saveDraftPost, type PostDraft, type PostMedia } from '@/lib/social-posts'
import { collabMessage, inviteCollaborator, type OrgOption } from '@/lib/collab'
import { EMPTY_DETAILS, type PostDetailsValue } from '@/lib/post-details'
import { isDemoOrgId, demoAddPost, demoSaveDraft } from '@/lib/demo-org'
import type { PublishableOrg } from '../useMyOrgs'
import { PickStep, MAX_ITEMS } from './compose/PickStep'
import { EditStep } from './compose/EditStep'
import { ShareStep } from './compose/ShareStep'
import { itemFromFile, itemFromStored, release, type ComposeItem } from './compose/items'
import { combine, isIdentity, presetAdjust, ratioFor, type AspectId } from './compose/photo-edit'
import { renderPhoto } from './compose/render-photo'

type Step = 'pick' | 'edit' | 'share'

/**
 * Make a post: choose, edit, share — three screens, not one.
 *
 * THIS REPLACED A SINGLE SHEET that uploaded each file the moment it was
 * picked and piled the caption, the settings and the collaborators underneath
 * the thumbnails. Two things were wrong with that beyond the layout: a pick
 * that failed to upload looked like nothing had happened, and there was no way
 * to change the photo itself. Now the photos live in memory until Share, and
 * everything done to them on screen 2 is baked into the file that uploads.
 *
 * `draft` opens an existing draft on the last screen, so the person who
 * finishes a post somebody else started lands where the decisions are.
 * `canPublish = false` is a role that may draft but not publish.
 */
export function PostComposer({
  orgs,
  onClose,
  onPosted,
  onSwitchToStory,
  canPublish = true,
  draft,
}: {
  orgs: PublishableOrg[]
  onClose: () => void
  onPosted: () => void
  onSwitchToStory?: () => void
  canPublish?: boolean
  draft?: PostDraft
}) {
  const [org, setOrg] = useState(orgs[0])
  const [step, setStep] = useState<Step>(draft ? 'share' : 'pick')
  const [items, setItems] = useState<ComposeItem[]>(() => (draft ? draft.media.map(itemFromStored) : []))
  const [selected, setSelected] = useState<string[]>(() => items.map((i) => i.key))
  const [focusKey, setFocusKey] = useState<string | null>(() => items[0]?.key ?? null)
  const [multi, setMulti] = useState(false)
  const [aspect, setAspect] = useState<AspectId>(draft ? 'original' : 'square')
  const [caption, setCaption] = useState(draft?.caption ?? '')
  const [details, setDetails] = useState<PostDetailsValue>(draft?.details ?? EMPTY_DETAILS)
  const [invitees, setInvitees] = useState<OrgOption[]>([])
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState<'share' | 'draft' | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Object URLs are released when the composer goes, not per render.
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])
  useEffect(() => () => release(itemsRef.current), [])

  useEffect(() => {
    /* `defaultPrevented`: a sheet opened from the details screen (Link an
       event, Add location…) handles Escape itself and marks it handled. Without
       this check the same keypress ALSO closed the whole composer, throwing
       away the post being written. */
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !e.defaultPrevented && busy === null && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose, busy])

  const chosen = useMemo(
    () => selected.map((k) => items.find((i) => i.key === k)).filter((i): i is ComposeItem => !!i),
    [selected, items],
  )
  const focus = items.find((i) => i.key === focusKey) ?? chosen[0] ?? null
  const ratio = ratioFor(aspect, chosen[0] ?? focus)

  const addFiles = async (files: File[]) => {
    setError(null)
    const problems: string[] = []
    const added: ComposeItem[] = []
    for (const f of files) {
      try {
        added.push(await itemFromFile(f))
      } catch (e) {
        problems.push(e instanceof Error ? e.message : `${f.name} could not be opened.`)
      }
    }
    if (problems.length) setError(problems.join(' '))
    if (!added.length) return
    setItems((prev) => [...added, ...prev])
    setFocusKey(added[0].key)
    setSelected((prev) => {
      if (!multi) return [added[0].key]
      const room = MAX_ITEMS - prev.length
      return [...prev, ...added.slice(0, Math.max(0, room)).map((a) => a.key)]
    })
  }

  const toggle = (key: string) => {
    setFocusKey(key)
    setSelected((prev) => {
      if (!multi) return [key]
      if (prev.includes(key)) return prev.length === 1 ? prev : prev.filter((k) => k !== key)
      if (prev.length >= MAX_ITEMS) {
        setError(`A post holds up to ${MAX_ITEMS} photos.`)
        return prev
      }
      return [...prev, key]
    })
  }

  const patch = (key: string, p: Partial<ComposeItem>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...p } : i)))

  /** Draw and upload what is on screen. Throws with a readable message. */
  const prepare = async (): Promise<PostMedia[]> => {
    const out: PostMedia[] = []
    for (const [n, it] of chosen.entries()) {
      setProgress(chosen.length > 1 ? `Preparing ${n + 1} of ${chosen.length}…` : 'Preparing your post…')
      if (it.kind === 'video') {
        out.push(it.stored ?? (await uploadOrgVideo(it.file!)))
        continue
      }
      const adjust = combine(presetAdjust(it.filter), it.slider)
      const untouched =
        it.stored && isIdentity(adjust) && it.texts.length === 0 && it.panX === 0.5 && it.panY === 0.5 &&
        Math.abs(ratio - it.w / it.h) < 0.01
      if (untouched && it.stored) {
        out.push(it.stored)
        continue
      }
      const r = await renderPhoto({ src: it.src, ratio, panX: it.panX, panY: it.panY, adjust, texts: it.texts })
      const url = await uploadRenderedImage(r.blob, 'post')
      out.push({ url, w: r.w, h: r.h })
    }
    return out
  }

  const finish = async (mode: 'share' | 'draft') => {
    if (busy || chosen.length === 0) return
    setBusy(mode)
    setError(null)
    try {
      // The demo org is a sandbox: nothing leaves this browser.
      if (isDemoOrgId(org.id)) {
        const media = chosen.map((c) => ({ url: c.src, w: c.w, h: c.h }))
        // Picking up a draft updates THAT draft (and posts it on Share)
        // rather than leaving the old one behind next to a new copy.
        if (draft) demoSaveDraft(draft.id, caption, media, mode === 'share')
        else demoAddPost(org.id, { caption, media, draft: mode === 'draft' })
        onPosted()
        onClose()
        return
      }
      const media = await prepare()
      setProgress(mode === 'draft' ? 'Saving the draft…' : 'Posting…')
      let postId: string | null = null
      if (draft) {
        const err = await saveDraftPost(draft.id, caption, media, details, mode === 'share')
        if (err) throw new Error(err)
        postId = draft.id
      } else {
        const made = await publishPost(org.id, caption, media, details, { draft: mode === 'draft' })
        if ('error' in made) throw new Error(made.error)
        postId = made.id
      }
      // Collaborators are asked once the post is OUT; a draft is nobody's news.
      const failed: string[] = []
      if (mode === 'share' && postId) {
        for (const o of invitees) {
          const r = await inviteCollaborator(postId, o.id)
          if (r !== 'ok') failed.push(`${o.handle}: ${collabMessage(r)}`)
        }
      }
      onPosted()
      if (failed.length) {
        setError(`Posted. Could not invite ${failed.join(' · ')}`)
        setBusy(null)
        setProgress(null)
        return
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post that. Nothing was published.')
      setBusy(null)
      setProgress(null)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[75] flex items-stretch justify-center bg-black/70 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="New post">
      {/* A phone-shaped panel on a desktop: these three screens were drawn
          for one column, and stretching them across 1440px would put the
          photo in one corner and Share in another. */}
      <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-canvas sm:h-[min(880px,calc(100dvh-2rem))] sm:max-w-[470px] sm:rounded-2xl sm:border sm:border-border">
        {step === 'pick' && (
          <PickStep
            orgs={orgs}
            org={org}
            onOrg={setOrg}
            items={items}
            selected={selected}
            focus={focus}
            multi={multi}
            aspect={aspect}
            ratio={ratio}
            error={error}
            onFiles={(f) => void addFiles(f)}
            onToggle={toggle}
            onMulti={() => {
              setMulti((m) => !m)
              // Leaving multi-select keeps the one in focus, as the reference does.
              if (multi && focusKey) setSelected([focusKey])
            }}
            onAspect={setAspect}
            onClose={onClose}
            onNext={() => {
              setError(null)
              setStep('edit')
            }}
            onSwitchToStory={onSwitchToStory}
          />
        )}
        {step === 'edit' && (
          <EditStep
            items={chosen}
            ratio={ratio}
            aspect={aspect}
            onAspect={setAspect}
            onChange={patch}
            onBack={() => setStep('pick')}
            onAddMore={() => {
              setMulti(true)
              setStep('pick')
            }}
            onNext={() => setStep('share')}
          />
        )}
        {step === 'share' && (
          <ShareStep
            org={org}
            items={chosen}
            ratio={ratio}
            caption={caption}
            onCaption={setCaption}
            details={details}
            onDetails={(p) => setDetails((d) => ({ ...d, ...p }))}
            invitees={invitees}
            pickingCollab={picking}
            onCollabOpen={() => setPicking(true)}
            onCollabClose={() => setPicking(false)}
            onCollabAdd={(o) => {
              setInvitees((prev) => (prev.some((x) => x.id === o.id) ? prev : [...prev, o]))
              setPicking(false)
            }}
            onCollabRemove={(id) => setInvitees((prev) => prev.filter((x) => x.id !== id))}
            canPublish={canPublish}
            editingDraft={!!draft}
            busy={busy}
            progress={progress}
            error={error}
            onError={setError}
            onBack={() => setStep('edit')}
            onShare={() => void finish('share')}
            onSaveDraft={() => void finish('draft')}
          />
        )}
      </div>
    </div>,
    document.body,
  )
}
