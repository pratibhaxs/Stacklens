'use client'
// components/dashboard/RepoInput.js — Phase 4
// Added: defaultValue prop (used when linking from history page)

import { useState } from 'react'
import { createScan } from '../../lib/api.js'

function isValidGithubUrl(url) {
  return /^(?:https?:\/\/)?github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+/.test(url.trim())
}

export function RepoInput({ onScanCreated, onUrlChange, defaultValue = '' }) {
  const [url,     setUrl]     = useState(defaultValue)
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setUrl(e.target.value)
    setError('')
    onUrlChange?.(e.target.value)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!url.trim()) { setError('Please enter a GitHub repository URL'); return }
    if (!isValidGithubUrl(url)) { setError('Invalid GitHub URL. Expected: https://github.com/owner/repo'); return }

    setLoading(true)
    try {
      const result = await createScan(url.trim())
      onScanCreated(result.scanId, result.cached)
      setUrl('')
      onUrlChange?.('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="text-zinc-400 font-mono text-xs tracking-wider uppercase">
          Repository URL
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={handleChange}
            placeholder="https://github.com/owner/repo"
            disabled={loading}
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-md px-4 py-3
                       font-mono text-sm text-white placeholder-zinc-600 focus:outline-none
                       focus:border-green-500 focus:ring-1 focus:ring-green-500/30
                       disabled:opacity-50 transition-colors duration-150"
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="px-6 py-3 bg-green-500 text-black font-mono font-medium text-sm
                       rounded-md hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors duration-150 whitespace-nowrap"
          >
            {loading ? 'Queuing...' : 'Analyze →'}
          </button>
        </div>
        {error && (
          <div className="flex items-center gap-2 text-red-400 font-mono text-xs">
            <span>✗</span><span>{error}</span>
          </div>
        )}
        <p className="text-zinc-600 font-mono text-xs">
          Public repos only · Results cached for 6 hours
        </p>
      </form>
    </div>
  )
}
