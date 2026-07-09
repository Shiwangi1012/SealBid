import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { generateSalt, computeCommitment, saveBidSecrets } from '../utils/commitment'
import { callCommit, ContractError } from '../utils/contractCall'
import type { WalletState } from '../hooks/useWallet'

interface Props {
  wallet: WalletState
  onBidSubmitted?: () => void
}

export function BidForm({ wallet, onBidSubmitted }: Props) {
  const navigate = useNavigate()
  const [amount, setAmount] = useState('')
  const [salt, setSalt] = useState(() => generateSalt())
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')
  const [txHash, setTxHash] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [copied, setCopied] = useState(false)

  // Regenerate salt if user clears the amount (fresh bid)
  const refreshSalt = () => setSalt(generateSalt())

  useEffect(() => {
    // Pre-fill with saved secrets if available
    if (wallet.address) {
      const saved = localStorage.getItem(`bid_secrets_${wallet.address}`)
      if (saved) {
        try {
          const { amount: a, salt: s } = JSON.parse(saved) as { amount: string; salt: string }
          setAmount(a)
          setSalt(s)
        } catch { /* ignore */ }
      }
    }
  }, [wallet.address])

  const handleSubmit = async () => {
    if (!wallet.isConnected || !wallet.address) {
      setErrorMsg('Connect your wallet first.')
      return
    }
    const amtNum = parseFloat(amount)
    if (isNaN(amtNum) || amtNum <= 0) {
      setErrorMsg('Enter a valid positive bid amount.')
      return
    }

    try {
      setStatus('pending')
      setErrorMsg('')

      const commitment = await computeCommitment(amount, salt)
      const depositStroops = BigInt(Math.round(amtNum * 1e7))

      const result = await callCommit(wallet.address, commitment, depositStroops, wallet.signTx)
      setTxHash(result.hash)
      setStatus('success')
      saveBidSecrets(wallet.address, amount, salt)
      onBidSubmitted?.()
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

  const copySalt = () => {
    navigator.clipboard.writeText(salt).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="glass-card">
      <h2>Submit Bid</h2>
      <p style={{ color: 'var(--text-muted)', marginTop: 8, marginBottom: 20, fontSize: '0.85rem' }}>
        Your bid is hashed client-side. Save the salt — you'll need it to reveal.
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
        <label>Salt (auto-generated — click to copy, save this!)</label>
        <div className="salt-box" onClick={copySalt} title="Click to copy">
          {salt}
          {copied && (
            <span style={{ position: 'absolute', right: 10, top: 8, color: 'var(--success)', fontSize: '0.75rem' }}>
              Copied!
            </span>
          )}
        </div>
        <button
          className="btn-secondary"
          style={{ marginTop: 8, fontSize: '0.8rem', padding: '6px 14px' }}
          onClick={refreshSalt}
          disabled={status === 'pending'}
        >
          New Salt
        </button>
      </div>

      <button
        className="btn-primary"
        style={{ width: '100%', marginTop: 4 }}
        onClick={handleSubmit}
        disabled={status === 'pending' || !wallet.isConnected}
      >
        {status === 'pending' ? '⏳ Submitting…' : 'Submit Bid'}
      </button>

      {status === 'pending' && (
        <div className="status-box status-pending">
          Waiting for wallet signature and on-chain confirmation…
        </div>
      )}
      {status === 'success' && (
        <div className="status-box status-success" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div>
            ✅ Bid committed on-chain!{' '}
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--success)' }}
            >
              View tx ↗
            </a>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button 
              className="btn-primary" 
              style={{ flex: 1, padding: '8px 16px', fontSize: '0.9rem' }}
              onClick={() => navigate('/reveal')}
            >
              Prepare to Reveal
            </button>
            <button 
              className="btn-secondary" 
              style={{ flex: 1, padding: '8px 16px', fontSize: '0.9rem' }}
              onClick={() => navigate('/feed')}
            >
              Go to Live Feed
            </button>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div className="status-box status-error">
          ❌ {errorMsg}
        </div>
      )}
    </div>
  )
}
