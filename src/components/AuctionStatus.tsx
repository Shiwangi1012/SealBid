import { useState, useEffect, useCallback } from 'react'
import {
  getAuctionState,
  callFinalize,
  callClaimRefund,
  ContractError,
} from '../utils/contractCall'
import type { WalletState } from '../hooks/useWallet'

// Deadlines from .env (Unix timestamps set during initialize)
const BIDDING_DEADLINE = 1785938269
const REVEAL_DEADLINE = 1785940069

interface Props {
  wallet: WalletState
  onStateChange?: (phase: string) => void
}

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
  expired: boolean
}

function getTimeLeft(targetUnix: number): TimeLeft {
  const diff = targetUnix - Math.floor(Date.now() / 1000)
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true }
  return {
    days: Math.floor(diff / 86400),
    hours: Math.floor((diff % 86400) / 3600),
    minutes: Math.floor((diff % 3600) / 60),
    seconds: diff % 60,
    expired: false,
  }
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function AuctionStatus({ wallet, onStateChange }: Props) {
  const [phase, setPhase] = useState<'Bidding' | 'Reveal' | 'Finalized'>('Bidding')
  const [biddingLeft, setBiddingLeft] = useState<TimeLeft>(getTimeLeft(BIDDING_DEADLINE))
  const [revealLeft, setRevealLeft] = useState<TimeLeft>(getTimeLeft(REVEAL_DEADLINE))
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')
  const [txHash, setTxHash] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const refreshPhase = useCallback(async () => {
    const s = await getAuctionState()
    setPhase(s)
    onStateChange?.(s)
  }, [onStateChange])

  useEffect(() => {
    refreshPhase()
    const id = setInterval(refreshPhase, 10000)
    return () => clearInterval(id)
  }, [refreshPhase])

  // Countdown timer
  useEffect(() => {
    const id = setInterval(() => {
      setBiddingLeft(getTimeLeft(BIDDING_DEADLINE))
      setRevealLeft(getTimeLeft(REVEAL_DEADLINE))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const handleFinalize = async () => {
    if (!wallet.isConnected || !wallet.address) return
    try {
      setStatus('pending')
      setErrorMsg('')
      const r = await callFinalize(wallet.address, wallet.signTx)
      setTxHash(r.hash)
      setStatus('success')
      await refreshPhase()
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof ContractError || err instanceof Error ? err.message : 'Error')
    }
  }

  const handleClaimRefund = async () => {
    if (!wallet.isConnected || !wallet.address) return
    try {
      setStatus('pending')
      setErrorMsg('')
      const r = await callClaimRefund(wallet.address, wallet.signTx)
      setTxHash(r.hash)
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof ContractError || err instanceof Error ? err.message : 'Error')
    }
  }

  const phaseClass =
    phase === 'Bidding'
      ? 'phase-bidding'
      : phase === 'Reveal'
      ? 'phase-reveal'
      : 'phase-finalized'

  // Decide which countdown to show
  const activeDeadline = phase === 'Bidding' ? biddingLeft : revealLeft
  const deadlineLabel = phase === 'Bidding' ? 'Bidding closes in' : 'Reveal closes in'

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h2>Auction Status</h2>
        <span className={`phase-badge ${phaseClass}`}>{phase}</span>
      </div>

      {phase !== 'Finalized' && (
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 10 }}>
            {deadlineLabel}
          </p>
          <div className="countdown-row">
            {activeDeadline.days > 0 && (
              <div className="countdown-item">
                <div className="countdown-value">{pad(activeDeadline.days)}</div>
                <div className="countdown-label">Days</div>
              </div>
            )}
            <div className="countdown-item">
              <div className="countdown-value">{pad(activeDeadline.hours)}</div>
              <div className="countdown-label">Hours</div>
            </div>
            <div className="countdown-item">
              <div className="countdown-value">{pad(activeDeadline.minutes)}</div>
              <div className="countdown-label">Minutes</div>
            </div>
            <div className="countdown-item">
              <div className="countdown-value">{pad(activeDeadline.seconds)}</div>
              <div className="countdown-label">Seconds</div>
            </div>
          </div>
          {activeDeadline.expired && (
            <p style={{ color: 'var(--warning)', marginTop: 8, fontSize: '0.85rem' }}>
              ⚠️ Deadline has passed
            </p>
          )}
        </div>
      )}

      {phase === 'Finalized' && (
        <div style={{ color: 'var(--success)', marginBottom: 12 }}>
          🏆 Auction finalized — winner has been determined.
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
        {revealLeft.expired && phase !== 'Finalized' && (
          <button
            className="btn-primary"
            onClick={handleFinalize}
            disabled={status === 'pending' || !wallet.isConnected}
          >
            {status === 'pending' ? '⏳ Finalizing…' : 'Finalize Auction'}
          </button>
        )}
        {phase === 'Finalized' && (
          <button
            className="btn-secondary"
            onClick={handleClaimRefund}
            disabled={status === 'pending' || !wallet.isConnected}
          >
            {status === 'pending' ? '⏳ Claiming…' : 'Claim Refund'}
          </button>
        )}
      </div>

      {status === 'pending' && (
        <div className="status-box status-pending" style={{ marginTop: 12 }}>
          Processing transaction…
        </div>
      )}
      {status === 'success' && txHash && (
        <div className="status-box status-success" style={{ marginTop: 12 }}>
          ✅ Done!{' '}
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
        <div className="status-box status-error" style={{ marginTop: 12 }}>
          ❌ {errorMsg}
        </div>
      )}
    </div>
  )
}
