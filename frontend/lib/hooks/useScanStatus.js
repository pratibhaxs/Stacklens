'use client'
// lib/hooks/useScanStatus.js
// Custom hook that polls the backend every 3 seconds until a scan finishes.
// Why polling: simpler than WebSockets, works fine for 30-60 second jobs,
// and automatically recovers if the network blips briefly.

import { useState, useEffect, useRef } from 'react'
import { getScanStatus, getScanResult } from '../api'

const POLL_INTERVAL = 3000  // 3 seconds

export function useScanStatus(scanId) {
  const [status, setStatus]   = useState(null)   // pending | running | completed | failed
  const [result, setResult]   = useState(null)   // full analysis result
  const [error, setError]     = useState(null)   // error message if failed
  const [loading, setLoading] = useState(false)  // initial load state
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!scanId) return

    setLoading(true)
    setError(null)

    async function poll() {
      try {
        const scan = await getScanStatus(scanId)
        setStatus(scan.status)

        if (scan.status === 'completed') {
          // Stop polling and fetch the full result
          clearInterval(intervalRef.current)
          const fullResult = await getScanResult(scanId)
          setResult(fullResult.result)
          setLoading(false)

        } else if (scan.status === 'failed') {
          // Stop polling and surface the error
          clearInterval(intervalRef.current)
          setError(scan.errorMsg || 'Analysis failed. Please try again.')
          setLoading(false)

        } else {
          // Still pending or running — keep polling
          setLoading(false)
        }

      } catch (err) {
        // Network error — don't stop polling, just log it
        // Why: a brief network blip shouldn't kill the polling loop
        console.warn('[useScanStatus] Poll error:', err.message)
      }
    }

    // Run immediately, then set up interval
    poll()
    intervalRef.current = setInterval(poll, POLL_INTERVAL)

    // Cleanup: stop polling when component unmounts or scanId changes
    return () => clearInterval(intervalRef.current)
  }, [scanId])

  return { status, result, error, loading }
}
