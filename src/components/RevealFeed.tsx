import { useAuctionEvents } from '../hooks/useAuctionEvents'

export function RevealFeed() {
  const events = useAuctionEvents()

  return (
    <>
      {events.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          No reveals yet — polling every 8 seconds…
        </p>
      ) : (
        <div className="reveal-feed">
          {events.map((ev) => (
            <div className="reveal-item" key={ev.id}>
              <span className="addr" title={ev.bidder}>
                {ev.bidder.slice(0, 6)}…{ev.bidder.slice(-4)}
              </span>
              <span className="amount">{ev.amount} XLM</span>
              <span className="time">
                {new Date(ev.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
