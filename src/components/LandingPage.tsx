import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Hls from 'hls.js'
import type { WalletState } from '../hooks/useWallet'

const HLS_SRC = 'https://stream.mux.com/tLkHO1qZoaaQOUeVWo8hEBeGQfySP02EPS02BmnNFyXys.m3u8'

export function LandingPage({ wallet }: { wallet: WalletState }) {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  /* ---- HLS video setup ---- */
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: false })
      hls.loadSource(HLS_SRC)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {/* autoplay blocked — silent */})
      })
      return () => hls.destroy()
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari)
      video.src = HLS_SRC
      video.play().catch(() => {})
    }
  }, [])

  /* ---- Lock body scroll when menu open ---- */
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  return (
    <div className="lp-root">

      {/* ═══════════════════ BACKGROUND ═══════════════════ */}
      <div className="lp-bg">
        {/* HLS video */}
        <video
          ref={videoRef}
          className="lp-video"
          autoPlay
          muted
          loop
          playsInline
        />

        {/* 60% opacity dark film over video */}
        <div className="lp-video-film" />

        {/* Left-side gradient */}
        <div className="lp-grad-left" />

        {/* Bottom-up readability gradient */}
        <div className="lp-grad-bottom" />

        {/* Vertical grid lines — 25%, 50%, 75% */}
        <div className="lp-grid-lines">
          <div className="lp-grid-line" style={{ left: '25%' }} />
          <div className="lp-grid-line" style={{ left: '50%' }} />
          <div className="lp-grid-line" style={{ left: '75%' }} />
        </div>

        {/* Central SVG ellipse glow */}
        <svg className="lp-center-glow" viewBox="0 0 1200 200" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <defs>
            <filter id="glow-blur">
              <feGaussianBlur stdDeviation="25" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <ellipse
            cx="600"
            cy="80"
            rx="480"
            ry="55"
            fill="none"
            stroke="url(#glowGrad)"
            strokeWidth="1.5"
            filter="url(#glow-blur)"
            opacity="0.7"
          />
          <ellipse
            cx="600"
            cy="80"
            rx="480"
            ry="55"
            fill="url(#glowFill)"
            opacity="0.18"
            filter="url(#glow-blur)"
          />
          <defs>
            <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00ffcc" stopOpacity="0" />
              <stop offset="30%" stopColor="#00e5cc" stopOpacity="1" />
              <stop offset="50%" stopColor="#00ffd5" stopOpacity="1" />
              <stop offset="70%" stopColor="#0f7a6a" stopOpacity="1" />
              <stop offset="100%" stopColor="#00ffcc" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="glowFill" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#00e5cc" stopOpacity="1" />
              <stop offset="100%" stopColor="#0a3d35" stopOpacity="0" />
            </radialGradient>
          </defs>
        </svg>
      </div>

      {/* ═══════════════════ NAVBAR ═══════════════════ */}
      <nav className="lp-nav">
        <div className="lp-nav-brand">
          <img src="/logo.png" className="lp-logo" alt="SealBid" />
          <span className="lp-brand-name">SealBid</span>
        </div>

        {/* Desktop links */}
        <div className="lp-nav-links">
          <a href="#how-it-works">How It Works</a>
          <a href="#features">Features</a>
          <a
            href="https://stellar.expert/explorer/testnet/contract/CCDTXP7TMGEEMGUQT3FCWYW4YOTENQVCIMAI3Z4QAPM4BGUGDGMRWDCB"
            target="_blank"
            rel="noreferrer"
          >
            Contract ↗
          </a>
        </div>

        {/* Wallet / CTA */}
        <div className="lp-nav-cta">
          {wallet.isConnected ? (
            <button className="lp-btn-primary" onClick={() => navigate('/bidding')}>
              Open App →
            </button>
          ) : (
            <button className="lp-btn-outline" onClick={wallet.connect}>
              Connect Wallet
            </button>
          )}
        </div>

        {/* Hamburger */}
        <button
          className={`lp-hamburger ${menuOpen ? 'open' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>
      </nav>

      {/* ═══════════════════ MOBILE MENU OVERLAY ═══════════════════ */}
      <div className={`lp-mobile-menu ${menuOpen ? 'active' : ''}`}>
        <button className="lp-mobile-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">✕</button>
        <div className="lp-mobile-links">
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How It Works</a>
          <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
          <a
            href="https://stellar.expert/explorer/testnet/contract/CCDTXP7TMGEEMGUQT3FCWYW4YOTENQVCIMAI3Z4QAPM4BGUGDGMRWDCB"
            target="_blank"
            rel="noreferrer"
            onClick={() => setMenuOpen(false)}
          >
            Contract ↗
          </a>
          <div style={{ marginTop: 16 }}>
            {wallet.isConnected ? (
              <button className="lp-btn-primary" style={{ width: '100%' }} onClick={() => { setMenuOpen(false); navigate('/bidding') }}>
                Open App →
              </button>
            ) : (
              <button className="lp-btn-outline" style={{ width: '100%' }} onClick={() => { setMenuOpen(false); wallet.connect() }}>
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════ HERO CONTENT ═══════════════════ */}
      <section className="lp-hero">
        <div className="lp-hero-eyebrow">
          <span className="lp-eyebrow-dot" />
          Deployed on Stellar Testnet
        </div>

        <h1 className="lp-hero-title">
          Sealed Bids.<br />
          <span className="lp-title-accent">Zero Trust Required.</span>
        </h1>

        <p className="lp-hero-sub">
          SealBid is a fully on-chain, commit-reveal auction on Stellar. Submit a hashed bid,
          lock your deposit, then reveal when the phase opens — the smart contract does the rest.
          No auctioneers. No front-running. Verifiable fairness.
        </p>

        <div className="lp-hero-actions">
          {wallet.isConnected ? (
            <button className="lp-btn-primary lp-btn-lg" onClick={() => navigate('/bidding')}>
              Start Bidding →
            </button>
          ) : (
            <button className="lp-btn-primary lp-btn-lg" onClick={wallet.connect}>
              Connect Wallet to Bid
            </button>
          )}
          <a
            href="https://stellar.expert/explorer/testnet/contract/CCDTXP7TMGEEMGUQT3FCWYW4YOTENQVCIMAI3Z4QAPM4BGUGDGMRWDCB"
            target="_blank"
            rel="noreferrer"
            className="lp-btn-ghost lp-btn-lg"
          >
            View Contract ↗
          </a>
        </div>

        <div className="lp-hero-stats">
          <div className="lp-stat">
            <span className="lp-stat-val">3</span>
            <span className="lp-stat-label">Smart Contracts</span>
          </div>
          <div className="lp-stat-divider" />
          <div className="lp-stat">
            <span className="lp-stat-val">100%</span>
            <span className="lp-stat-label">On-Chain</span>
          </div>
          <div className="lp-stat-divider" />
          <div className="lp-stat">
            <span className="lp-stat-val">0</span>
            <span className="lp-stat-label">Trusted Parties</span>
          </div>
        </div>
      </section>

      {/* ═══════════════════ FEATURES ═══════════════════ */}
      <section className="lp-section" id="features">
        <div className="lp-section-inner">
          <p className="lp-section-eyebrow">Why SealBid</p>
          <h2 className="lp-section-title">Built for Fairness, From the Ground Up</h2>
          <div className="lp-features-grid">
            {[
              {
                icon: '🔒',
                title: 'No Front-Running',
                desc: 'Your bid is hashed client-side before submission. Nobody can see your amount during the bidding phase — not even the contract.',
              },
              {
                icon: '🤝',
                title: 'No Trusted Auctioneer',
                desc: 'The Soroban smart contract enforces every rule autonomously. There is no privileged party who can manipulate the outcome.',
              },
              {
                icon: '🏦',
                title: 'Trustless Fund Custody',
                desc: 'Your XLM deposit is locked in a decentralized vault contract. The winner keeps their claim; losers receive automatic refunds.',
              },
              {
                icon: '✅',
                title: 'Verifiable Fairness',
                desc: 'Commit-reveal cryptography ensures every revealed bid matches its commitment hash. Cheating is mathematically impossible.',
              },
            ].map((f) => (
              <div key={f.title} className="lp-feature-card">
                <div className="lp-feature-icon">{f.icon}</div>
                <h3 className="lp-feature-title">{f.title}</h3>
                <p className="lp-feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ HOW IT WORKS ═══════════════════ */}
      <section className="lp-section lp-section-alt" id="how-it-works">
        <div className="lp-section-inner">
          <p className="lp-section-eyebrow">The Process</p>
          <h2 className="lp-section-title">Four Steps to Place Your Bid</h2>
          <div className="lp-steps">
            {[
              { n: '01', title: 'Connect Wallet', desc: 'Link your Freighter wallet to Stellar Testnet. Your address becomes your bidder identity.' },
              { n: '02', title: 'Submit Hashed Bid', desc: 'Enter your amount. The app hashes it with a random salt and sends only the hash + deposit on-chain.' },
              { n: '03', title: 'Wait for Reveal Phase', desc: 'Once the bidding deadline passes the reveal window opens. Save your salt — you will need it.' },
              { n: '04', title: 'Reveal & Win', desc: 'Submit your original amount and salt. The contract verifies the hash; the highest bid wins.' },
            ].map((s, i) => (
              <div key={s.n} className="lp-step">
                <div className="lp-step-number">{s.n}</div>
                {i < 3 && <div className="lp-step-connector" />}
                <div className="lp-step-body">
                  <h3 className="lp-step-title">{s.title}</h3>
                  <p className="lp-step-desc">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ CTA BANNER ═══════════════════ */}
      <section className="lp-cta-banner">
        <div className="lp-cta-glow" />
        <h2 className="lp-cta-title">Ready to place a sealed bid?</h2>
        <p className="lp-cta-sub">
          Connect your Freighter wallet and join the auction. The bidding phase is live.
        </p>
        <div className="lp-hero-actions">
          {wallet.isConnected ? (
            <button className="lp-btn-primary lp-btn-lg" onClick={() => navigate('/bidding')}>
              Go to Bidding →
            </button>
          ) : (
            <button className="lp-btn-primary lp-btn-lg" onClick={wallet.connect}>
              Connect Wallet
            </button>
          )}
        </div>
      </section>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <footer className="lp-footer">
        <div className="lp-footer-brand">
          <img src="/logo.png" className="lp-logo" alt="SealBid" />
          <span className="lp-brand-name">SealBid</span>
        </div>
        <p className="lp-footer-sub">
          A commit-reveal auction demo on Stellar Testnet.{' '}
          <a
            href="https://stellar.expert/explorer/testnet/contract/CCDTXP7TMGEEMGUQT3FCWYW4YOTENQVCIMAI3Z4QAPM4BGUGDGMRWDCB"
            target="_blank"
            rel="noreferrer"
          >
            View on Stellar Expert ↗
          </a>
        </p>
      </footer>
    </div>
  )
}
