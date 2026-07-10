import { Suspense, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { Leva } from 'leva'
import { getExhibit } from '@/exhibits/registry'

export function ExhibitPage() {
  const { exhibitId } = useParams()
  const [notesOpen, setNotesOpen] = useState(false)
  const meta = getExhibit(exhibitId)

  if (!meta || meta.status !== 'online' || !meta.component) {
    return <Navigate to="/" replace />
  }
  const Exhibit = meta.component

  return (
    <main className="stage">
      <Suspense fallback={<div className="stage-loading">RETRIEVING MEDIA…</div>}>
        <Exhibit />
      </Suspense>

      <header className="stage-hud">
        <Link to="/">◂ ARCHIVE</Link>
        <span className="stage-title">
          {meta.title} · {meta.source.title.toUpperCase()} / {meta.source.year}
        </span>
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
