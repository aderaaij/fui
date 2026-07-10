import { useEffect, useState } from 'react'

export interface BootLine {
  /** ms before this line appears */
  delay: number
  text: string
}

/** Plays a scripted boot sequence, one line at a time, once `active`. */
export function useBootSequence(script: BootLine[], active = true) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!active) return
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
  }, [script, active])

  return {
    lines: script.slice(0, count).map((l) => l.text),
    done: count >= script.length,
  }
}
