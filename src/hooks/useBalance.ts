import { useState, useEffect, useCallback } from 'react'

const HORIZON = import.meta.env.VITE_HORIZON_URL ?? 'https://horizon-testnet.stellar.org'

export function useBalance(address: string | null): {
  balance: string
  loading: boolean
  refresh: () => void
} {
  const [balance, setBalance] = useState<string>('—')
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!address) {
      setBalance('—')
      return
    }
    let cancelled = false
    setLoading(true)

    fetch(`${HORIZON}/accounts/${address}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data.balances) {
          const xlm = (data.balances as Array<{ asset_type: string; balance: string }>).find(
            (b) => b.asset_type === 'native',
          )
          setBalance(xlm ? parseFloat(xlm.balance).toFixed(2) : '0.00')
        }
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setBalance('?')
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [address, tick])

  return { balance, loading, refresh }
}
