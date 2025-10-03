import React, { useEffect, useState } from 'react'

import { WebAuthVault } from '@/lib/vault'

import { ChatModelProvider } from '../agent/ChatModel'

export function ApiKeyManager({ provider }: { provider: ChatModelProvider }) {
  const [busy, setBusy] = useState(false)
  const [has, setHas] = useState<boolean>(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    WebAuthVault.hasSecret(provider)
      .then(v => !cancelled && setHas(v))
      .catch(e => !cancelled && setErr(String(e)))
    return () => {
      cancelled = true
    }
  }, [provider])

  function onSetUpdate() {
    setBusy(true)
    setErr(null)
    const val = window.prompt(`Enter ${provider} API key`)
    if (!val) return
    WebAuthVault.setSecret(provider, val)
      .then(() => setHas(true))
      .catch(e => setErr(String(e)))
      .finally(() => setBusy(false))
  }

  function onRemove() {
    setBusy(true)
    setErr(null)
    WebAuthVault.deleteSecret(provider)
      .then(() => setHas(false))
      .catch(e => setErr(String(e)))
      .finally(() => setBusy(false))
  }

  const needsKey = provider !== 'ollama'

  return (
    <div className="grid gap-2">
      {needsKey ? (
        <>
          <div>
            <strong>API key</strong>: {has ? 'stored (locked)' : 'not set'}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onSetUpdate} disabled={busy}>
              {has ? 'Update key' : 'Set key'}
            </button>
            {has ? (
              <button type="button" onClick={onRemove} disabled={busy}>
                Remove key
              </button>
            ) : null}
          </div>
          {err ? <div style={{ color: 'crimson' }}>{err}</div> : null}
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Stored locally, encrypted with a passkey. You’ll verify when used.
          </div>
        </>
      ) : (
        <div>Ollama does not require an API key.</div>
      )}
    </div>
  )
}
