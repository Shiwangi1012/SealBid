import { useState, useEffect } from 'react'
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import { useWallet } from './hooks/useWallet'
import { useBalance } from './hooks/useBalance'
import { WalletButton } from './components/WalletButton'
import { BidForm } from './components/BidForm'
import { RevealForm } from './components/RevealForm'
import { AuctionStatus } from './components/AuctionStatus'
import { RevealFeed } from './components/RevealFeed'
import { LandingPage } from './components/LandingPage'

export default function App() {
  const wallet = useWallet()
  const { balance: xlmBalance } = useBalance(wallet.address)
  const [phase, setPhase] = useState<string>('Bidding')
  const location = useLocation()

  // Update page title
  useEffect(() => {
    document.title = 'SealBid — Secure. Private. Fair.'
  }, [])

  const isLandingPage = location.pathname === '/'

  // Landing page renders completely outside the app shell
  if (isLandingPage) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage wallet={wallet} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  return (
    <>
      {/* ---- Header ---- */}
      <header className="app-header">
        <div className="brand">
          <img src="/logo.png" className="logo-img" alt="SealBid Logo" />
          <div className="brand-text">
            <h1>SealBid</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4, letterSpacing: '0.05em' }}>
              Secure. Private. Fair.
            </p>
          </div>
        </div>
        <WalletButton wallet={wallet} />
      </header>

      {/* ---- XLM Balance Card (Only when connected) ---- */}
      {wallet.isConnected && (
        <div className="glass-card balance-card">
          <div className="bal-label">Your Balance</div>
          <div className="bal-amount">
            {xlmBalance !== '—' ? `${xlmBalance} XLM` : 'Loading...'}
          </div>
        </div>
      )}

      {/* ---- Always-visible status ---- */}
      <AuctionStatus wallet={wallet} onStateChange={setPhase} />

      {/* ---- Navigation ---- */}
      <nav className="nav-links">
        <NavLink to="/bidding" className={({ isActive }) => (isActive ? 'active' : '')}>
          Bid
        </NavLink>
        <NavLink to="/reveal" className={({ isActive }) => (isActive ? 'active' : '')}>
          Reveal
        </NavLink>
        <NavLink to="/feed" className={({ isActive }) => (isActive ? 'active' : '')}>
          Live Feed
        </NavLink>
      </nav>

      {/* ---- Main Content Area ---- */}
      <main className="page-transition" key={location.pathname}>
        <Routes>
          <Route path="/" element={<LandingPage wallet={wallet} />} />

          <Route path="/bidding" element={
            !wallet.isConnected ? (
              <Navigate to="/" replace />
            ) : phase === 'Bidding' ? (
              <BidForm wallet={wallet} />
            ) : (
              <div className="glass-card status-box status-warning" style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
                Bidding phase is closed. The auction is currently in the {phase} phase.
              </div>
            )
          } />

          <Route path="/reveal" element={
            !wallet.isConnected ? (
              <Navigate to="/" replace />
            ) : phase === 'Reveal' ? (
              <RevealForm wallet={wallet} />
            ) : phase === 'Bidding' ? (
              <div className="glass-card status-box" style={{ background: 'rgba(94, 67, 243, 0.1)' }}>
                Reveal phase hasn't started yet. Check back when bidding ends!
              </div>
            ) : (
              <div className="glass-card status-box status-success">
                Auction is finalized.
              </div>
            )
          } />

          <Route path="/feed" element={
            !wallet.isConnected ? (
              <Navigate to="/" replace />
            ) : (
              <div className="glass-card">
                <h2 style={{ marginBottom: 16 }}>Live Reveal Feed</h2>
                <RevealFeed />
              </div>
            )
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* ---- Footer ---- */}
      <footer style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '40px 0 20px', marginTop: 'auto' }}>
        Deployed on Stellar Testnet ·{' '}
        <a
          href={`https://stellar.expert/explorer/testnet/contract/${import.meta.env.VITE_AUCTION_CONTRACT_ID}`}
          target="_blank"
          rel="noreferrer"
          style={{ color: 'var(--accent)', textDecoration: 'none' }}
        >
          View AuctionContract ↗
        </a>
      </footer>
    </>
  )
}
