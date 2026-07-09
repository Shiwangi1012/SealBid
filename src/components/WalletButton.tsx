import { useBalance } from '../hooks/useBalance'
import type { WalletState } from '../hooks/useWallet'

interface Props {
  wallet: WalletState
}

export function WalletButton({ wallet }: Props) {
  const { balance } = useBalance(wallet.address)

  if (!wallet.isConnected) {
    return (
      <button className="btn-primary" onClick={wallet.connect}>
        Connect Wallet
      </button>
    )
  }

  const short = wallet.address
    ? `${wallet.address.slice(0, 5)}…${wallet.address.slice(-4)}`
    : ''

  return (
    <div className="wallet-area">
      <div className="balance-chip">
        {short} · <span>{balance} XLM</span>
      </div>
      <button className="btn-secondary" onClick={wallet.disconnect}>
        Disconnect
      </button>
    </div>
  )
}
