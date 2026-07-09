import { useNavigate } from 'react-router-dom'
import type { WalletState } from '../hooks/useWallet'

export function LandingPage({ wallet }: { wallet: WalletState }) {
  const navigate = useNavigate()

  return (
    <div className="hero-section page-transition">
      <h1>Welcome to SealBid</h1>
      <p>
        Experience the future of on-chain auctions. A decentralized, sealed-bid auction system where 
        your bids remain completely hidden until the bidding phase concludes.
      </p>

      {wallet.isConnected ? (
        <button 
          className="btn-primary hero-btn"
          onClick={() => navigate('/bidding')}
        >
          Start Bidding
        </button>
      ) : (
        <div className="glass-card" style={{ maxWidth: '400px', margin: '0 auto 40px' }}>
          <h3 style={{ marginBottom: 12 }}>Ready to bid?</h3>
          <p style={{ fontSize: '0.9rem', marginBottom: 20 }}>Connect your wallet to participate.</p>
          <div style={{ color: 'var(--accent)', fontWeight: 600 }}>
            ↑ Connect your wallet above ↑
          </div>
        </div>
      )}

      <div className="landing-grid">
        <div className="glass-card need-card">
          <h3>No Trusted Auctioneer</h3>
          <p>Normally, a sealed-bid auction needs a trustworthy third party. Here, the smart contract does the job securely.</p>
        </div>
        <div className="glass-card need-card">
          <h3>No Front-Running</h3>
          <p>Since you only submit a hash of your bid initially, no one can see your actual bid amount to outbid you at the last second.</p>
        </div>
        <div className="glass-card need-card">
          <h3>Trustless Fund Custody</h3>
          <p>Your XLM deposit is securely locked in a decentralized vault contract. The auctioneer never touches your funds.</p>
        </div>
        <div className="glass-card need-card">
          <h3>Verifiable Fairness</h3>
          <p>Once the reveal phase is over, the highest bid is verified on-chain, and losers receive automatic refunds.</p>
        </div>
      </div>

      <div className="steps-container">
        <h2>How to Bid</h2>
        <div className="steps-list">
          <div className="step-item">
            <div className="step-number">1</div>
            <div>
              <div style={{ fontWeight: 600 }}>Connect Wallet</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Link your Freighter wallet to the testnet.</div>
            </div>
          </div>
          <div className="step-item">
            <div className="step-number">2</div>
            <div>
              <div style={{ fontWeight: 600 }}>Submit Hashed Bid</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Lock your deposit. Your bid amount remains a secret hash.</div>
            </div>
          </div>
          <div className="step-item">
            <div className="step-number">3</div>
            <div>
              <div style={{ fontWeight: 600 }}>Wait for Countdown</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Wait until the bidding deadline passes.</div>
            </div>
          </div>
          <div className="step-item">
            <div className="step-number">4</div>
            <div>
              <div style={{ fontWeight: 600 }}>Reveal Actual Amount</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Submit your secret salt to reveal your bid and win!</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
