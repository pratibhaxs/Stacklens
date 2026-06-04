'use client'
// components/dashboard/ShareButton.js
// Copies the public report URL to clipboard.
// The share URL is just /report/:scanId — no auth required to view.

import { useState } from 'react'

export function ShareButton({ scanId }) {
  const [copied, setCopied] = useState(false)

  if (!scanId) return null

  const shareUrl = `${window.location.origin}/report/${scanId}`

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback for browsers that don't support clipboard API
      const input = document.createElement('input')
      input.value = shareUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-2 px-3 py-1.5 border rounded font-mono text-xs
                  transition-all duration-200
                  ${copied
                    ? 'border-green-700 bg-green-950 text-green-400'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'}`}
    >
      {copied ? (
        <>
          <span>✓</span>
          <span>Link copied</span>
        </>
      ) : (
        <>
          <span>↗</span>
          <span>Share report</span>
        </>
      )}
    </button>
  )
}
