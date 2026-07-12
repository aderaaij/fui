import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { exhibits } from '@/exhibits/registry'

const boot = (i: number) => ({ '--i': i }) as CSSProperties

export function IndexPage() {
  const online = exhibits.filter((e) => e.status === 'online').length

  // The reveal is a transition off this class flip, not a delayed animation —
  // see the .boot rules. Two rAFs put the flip a clean frame after the
  // opacity-0 state has painted, so the stagger reliably transitions.
  const [booted, setBooted] = useState(false)
  useEffect(() => {
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => setBooted(true))
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <main className="archive crt-dom">
      <div className={booted ? 'archive-inner booted' : 'archive-inner'}>
        <p className="archive-sys boot" style={boot(0)}>
          FUI//ARCHIVE — NODE 07 — PUBLIC READ TERMINAL
        </p>
        <p className="archive-sys boot" style={boot(1)}>
          {exhibits.length} RECORDS · {online} ONLINE · ACCESS GRANTED
        </p>

        <h1 className="archive-title boot" style={boot(2)}>
          FUI ARCHIVE
        </h1>
        <p className="archive-tagline boot" style={boot(3)}>
          INTERFACES RECOVERED FROM FICTION, RESTORED TO WORKING ORDER
        </p>

        <ol className="archive-list">
          {exhibits.map((e, i) => {
            const row = (
              <>
                <span className="row-idx">{String(i + 1).padStart(3, '0')}</span>
                <span className="row-title">{e.title}</span>
                <span className="row-src">
                  {e.source.title.toUpperCase()} / {e.source.year}
                </span>
                <span className="row-status">
                  {e.status === 'online' ? '● ONLINE' : '○ IN RESTORATION'}
                </span>
              </>
            )
            return (
              <li key={e.id} className="boot" style={boot(4 + i)}>
                {e.status === 'online' ? (
                  <Link to={`/${e.id}`} className="archive-row">
                    {row}
                  </Link>
                ) : (
                  <span className="archive-row is-offline">{row}</span>
                )}
              </li>
            )
          })}
        </ol>

        <p className="archive-prompt boot" style={boot(4 + exhibits.length)}>
          {'>'} AWAITING SELECTION<span className="blink">█</span>
        </p>

        <footer className="archive-footer boot" style={boot(5 + exhibits.length)}>
          A CONTINUING RESTORATION PROJECT — EVERY INTERFACE INTERACTIVE.
          <br />
          ALL PROPERTIES BELONG TO THEIR RESPECTIVE STUDIOS. THIS IS FAN PRESERVATION WORK.
        </footer>
      </div>
    </main>
  )
}
