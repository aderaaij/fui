import { useEffect, useState } from 'react'

/** Square-wave boolean for block cursors. */
export function useBlink(intervalMs = 530): boolean {
  const [on, setOn] = useState(true)

  useEffect(() => {
    const id = window.setInterval(() => setOn((o) => !o), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])

  return on
}
