import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { Leva } from 'leva'
import { getExhibit } from '@/exhibits/registry'
import { isMuted, setMuted } from '@/lib/sound'

const HUD_HIDE_MS = 2800

/** The archive chrome yields the screen to the exhibit: it fades out after a
 *  few idle seconds and returns on pointer movement. Keyboard input stays with
 *  the exhibit (terminals type on window), so keys never wake it. */
function useAutoHideHud(pinned: boolean) {
  const [visible, setVisible] = useState(true)
  const hoverRef = useRef(false)
  const timer = useRef(0)

  useEffect(() => {
    if (pinned) {
      setVisible(true)
      return
    }
    const arm = () => {
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        if (hoverRef.current) arm()
        else setVisible(false)
      }, HUD_HIDE_MS)
    }
    const wake = () => {
      setVisible(true)
      arm()
    }
    arm()
    window.addEventListener('pointermove', wake)
    window.addEventListener('pointerdown', wake)
    return () => {
      window.clearTimeout(timer.current)
      window.removeEventListener('pointermove', wake)
      window.removeEventListener('pointerdown', wake)
    }
  }, [pinned])

  return { visible, hoverRef }
}

export function ExhibitPage() {
  const { exhibitId } = useParams()
  const navigate = useNavigate()
  const [notesOpen, setNotesOpen] = useState(false)
  const { visible: hudVisible, hoverRef } = useAutoHideHud(notesOpen)
  const meta = getExhibit(exhibitId)

  // Every route serves the same index.html, so title and canonical follow
  // the exhibit here; the static tags in index.html describe the archive.
  useEffect(() => {
    if (!meta || meta.status !== 'online') return
    const canonical = document.querySelector('link[rel="canonical"]')
    document.title = `${meta.title} — FUI ARCHIVE`
    canonical?.setAttribute('href', `https://fui.arden.nl/${meta.id}`)
    return () => {
      document.title = 'FUI ARCHIVE'
      canonical?.setAttribute('href', 'https://fui.arden.nl/')
    }
  }, [meta])

  // Escape backs out one layer: notes first, then the exhibit itself
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (notesOpen) setNotesOpen(false)
      else navigate('/')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [notesOpen, navigate])

  if (!meta || meta.status !== 'online' || !meta.component) {
    return <Navigate to="/" replace />
  }
  const Exhibit = meta.component

  return (
    <main className={hudVisible ? 'stage' : 'stage stage-idle'}>
      <Suspense fallback={<div className="stage-loading">RETRIEVING MEDIA…</div>}>
        <Exhibit />
      </Suspense>

      <header
        className="stage-hud"
        onPointerEnter={() => {
          hoverRef.current = true
        }}
        onPointerLeave={() => {
          hoverRef.current = false
        }}
      >
        <Link to="/">◂ ARCHIVE</Link>
        <span className="stage-title">
          {meta.title} · {meta.source.title.toUpperCase()} / {meta.source.year}
        </span>
        <span className="stage-actions">
          {meta.sound && <SoundToggle />}
          <button
            type="button"
            onClick={(e) => {
              // Return focus to the exhibit — terminals listen on window
              e.currentTarget.blur()
              setNotesOpen((o) => !o)
            }}
          >
            {notesOpen ? 'CLOSE' : 'NOTES'}
          </button>
        </span>
      </header>

      {notesOpen && (
        <aside className="stage-notes">
          <h2>RESTORATION NOTES</h2>
          <ul>
            {meta.accuracyNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </aside>
      )}

      <Leva hidden={!import.meta.env.DEV} collapsed />
    </main>
  )
}

/** Archive-wide mute. The click that unmutes doubles as the user gesture
 *  browsers demand before audio may start on a cold-opened tab. */
function SoundToggle() {
  const [muted, setMutedState] = useState(isMuted)
  return (
    <button
      type="button"
      aria-label={muted ? 'Sound: off' : 'Sound: on'}
      title={muted ? 'SOUND: OFF' : 'SOUND: ON'}
      aria-pressed={!muted}
      onClick={(e) => {
        // Return focus to the exhibit — terminals listen on window
        e.currentTarget.blur()
        setMuted(!muted)
        setMutedState(!muted)
      }}
    >
      <SpeakerIcon muted={muted} />
    </button>
  )
}

/** The TV-OSD speaker, laid out on a pixel grid so it reads as terminal
 *  type rather than an app glyph: waves when live, the blocky X when
 *  muted. currentColor keeps the hover inversion working. */
function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      viewBox="0 0 12 8"
      width="1.5em"
      height="1em"
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden
      style={{ verticalAlign: '-0.15em' }}
    >
      <path d="M0 2h2l3-2v8l-3-2H0z" />
      {muted ? (
        <>
          <rect x="6" y="2" width="1" height="1" />
          <rect x="9" y="2" width="1" height="1" />
          <rect x="7" y="3" width="1" height="1" />
          <rect x="8" y="3" width="1" height="1" />
          <rect x="7" y="4" width="1" height="1" />
          <rect x="8" y="4" width="1" height="1" />
          <rect x="6" y="5" width="1" height="1" />
          <rect x="9" y="5" width="1" height="1" />
        </>
      ) : (
        <>
          <rect x="6" y="2" width="1" height="1" />
          <rect x="7" y="3" width="1" height="2" />
          <rect x="6" y="5" width="1" height="1" />
          <rect x="8" y="0" width="1" height="1" />
          <rect x="9" y="1" width="1" height="1" />
          <rect x="10" y="2" width="1" height="4" />
          <rect x="9" y="6" width="1" height="1" />
          <rect x="8" y="7" width="1" height="1" />
        </>
      )}
    </svg>
  )
}
