import { useState, useEffect, useRef } from 'react'
import { rpc as SorobanRpc } from '@stellar/stellar-sdk'

const RPC_URL = import.meta.env.VITE_SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org'
const AUCTION_ID = import.meta.env.VITE_AUCTION_CONTRACT_ID as string

export interface RevealEvent {
  id: string
  bidder: string
  amount: string // XLM formatted string
  timestamp: number
}

/**
 * Polls Soroban for "reveal" contract events from the AuctionContract.
 * Returns a live list of reveal events, newest first.
 */
export function useAuctionEvents(): RevealEvent[] {
  const [events, setEvents] = useState<RevealEvent[]>([])
  const seenIds = useRef(new Set<string>())

  useEffect(() => {
    const server = new SorobanRpc.Server(RPC_URL, { allowHttp: false })

    async function fetchEvents() {
      try {
        const result = await server.getEvents({
          startLedger: 1,
          filters: [
            {
              type: 'contract',
              contractIds: [AUCTION_ID],
              topics: [
                ['*'], // topic[0]: any
              ],
            },
          ],
          limit: 50,
        })

        if (!result?.events) return

        const newEvts: RevealEvent[] = []

        for (const ev of result.events) {
          if (seenIds.current.has(ev.id)) continue

          // Check if this is a "reveal" event: topic[0] should be Symbol("reveal")
          const topics = ev.topic
          if (!topics || topics.length < 1) continue

          const firstTopic = topics[0]
          // firstTopic is an xdr.ScVal; check if it's a Symbol "reveal"
          try {
            if (firstTopic.switch().name !== 'scvSymbol') continue
            const sym = firstTopic.sym().toString()
            if (sym !== 'reveal') continue
          } catch { continue }

          // topic[1] is the bidder Address
          let bidder = 'unknown'
          try {
            const addrVal = topics[1]
            if (addrVal?.switch().name === 'scvAddress') {
              // accountId() returns a raw XDR AccountID; ed25519 key is at index 0
              const acct = addrVal.address().accountId()
              const keyBytes = acct.ed25519()
              bidder = Buffer.from(keyBytes).toString('hex').slice(0, 12) + '…'
            }
          } catch { /* ignore */ }

          // value is the revealed amount (u64 stroops)
          let amountXlm = '?'
          try {
            const val = ev.value
            if (val?.switch().name === 'scvU64') {
              const stroops = Number(val.u64().toString())
              amountXlm = (stroops / 1e7).toFixed(7).replace(/\.?0+$/, '')
            }
          } catch { /* ignore */ }

          seenIds.current.add(ev.id)
          newEvts.push({
            id: ev.id,
            bidder,
            amount: amountXlm,
            timestamp: Date.now(),
          })
        }

        if (newEvts.length > 0) {
          setEvents((prev) => [...newEvts.reverse(), ...prev].slice(0, 100))
        }
      } catch {
        // Network errors are expected; silently retry
      }
    }

    fetchEvents()
    const id = setInterval(fetchEvents, 8000)
    return () => clearInterval(id)
  }, [])

  return events
}
