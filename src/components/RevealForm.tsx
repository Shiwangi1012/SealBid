import { useState, useEffect } from 'react'
import { loadBidSecrets } from '../utils/commitment'
import { callReveal, ContractError } from '../utils/contractCall'
import type { WalletState } from '../hooks/useWallet'

interface Props {
  wallet: WalletState
  onRevealed?: () => void
}

export function RevealForm({ wallet, onRevealed }: Props) {
  const [amount, setAmount] = useState('')
  const [salt, setSalt] = useState('')
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')
  const [txHash, setTxHash] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Pre-fill from localStorage
  useEffect(() => {
    if (wallet.address) {
      const secrets = loadBidSecrets(wallet.address)
      if (secrets) {
        setAmount(secrets.amount)
        setSalt(secrets.salt)
      }
    }
  }, [wallet.address])

  const handleReveal = async () => {
    if (!wallet.isConnected || !wallet.address) {
      setErrorMsg('Connect your wallet first.')
      return
    }
    if (!amount || !salt) {
      setErrorMsg('Enter both amount and salt.')
      return
    }
    if (salt.length !== 64) {
      setErrorMsg('Salt must be 64 hex characters (32 bytes).')
      return
    }

    try {
      setStatus('pending')
      setErrorMsg('')
      const result = await callReveal(wallet.address, amount, salt, wallet.signTx)
      setTxHash(result.hash)
      setStatus('success')
      onRevealed?.()
    } catch (err) {
      setStatus('error')
      if (err instanceof ContractError) {
        setErrorMsg(err.message)
      } else if (err instanceof Error) {
        setErrorMsg(err.message)
      } else {
        setErrorMsg('Unknown error')
      }
    }
  }

  return (
    <div className="glass-card">
      <h2>Reveal Bid</h2>
      <p style={{ color: 'var(--text-muted)', marginTop: 6, marginBottom: 16, fontSize: '0.85rem' }}>
        Enter the exact amount and salt you used when committing. The contract will verify the hash.
      </p>

      <div className="field">
        <label>Bid Amount (XLM)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="e.g. 10.5"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={status === 'pending'}
        />
      </div>

      <div className="field">
        <label>Salt (64 hex chars)</label>
        <input
          type="text"
          placeholder="paste your 64-char salt here"
          value={salt}
          onChange={(e) => setSalt(e.target.value.toLowerCase().trim())}
          disabled={status === 'pending'}
          style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
        />
      </div>

      <button
        className="btn-primary"
        style={{ width: '100%' }}
        onClick={handleReveal}
        disabled={status === 'pending' || !wallet.isConnected}
      >
        {status === 'pending' ? '⏳ Revealing…' : 'Reveal Bid'}
      </button>

      {/* Error type explanations */}
      {status === 'pending' && (
        <div className="status-box status-pending">
          Waiting for wallet signature and on-chain confirmation…
        </div>
      )}
      {status === 'success' && (
        <div className="status-box status-success">
          ✅ Bid revealed on-chain!{' '}
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--success)' }}
          >
            View tx ↗
          </a>
        </div>
      )}
      {status === 'error' && (
        <div className="status-box status-error">
          ❌ {errorMsg}
          {errorMsg.toLowerCase().includes('hash mismatch') && (
            <div style={{ marginTop: 6, fontSize: '0.8rem' }}>
              Make sure the amount and salt exactly match what you committed. Even a small
              difference changes the hash.
            </div>
          )}
          {errorMsg.toLowerCase().includes('reveal phase') && (
            <div style={{ marginTop: 6, fontSize: '0.8rem' }}>
              Check the auction phase — reveals are only accepted between the bidding and reveal
              deadlines.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
