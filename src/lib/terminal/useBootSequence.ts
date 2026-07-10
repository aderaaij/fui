import { useEffect, useState } from 'react'

export interface BootLine {
  /** ms before this line appears */
  delay: number
  text: string
}

/** Plays a scripted boot sequence, one line at a time. */
export function useBootSequence(script: BootLine[]) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    let timeout: number
    const schedule = (i: number) => {
      if (cancelled || i >= script.length) return
      timeout = window.setTimeout(() => {
        setCount(i + 1)
        schedule(i + 1)
      }, script[i].delay)
    }
    schedule(0)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      setCount(0)
    }
  }, [script])

  return {
    lines: script.slice(0, count).map((l) => l.text),
    done: count >= script.length,
  }
}
