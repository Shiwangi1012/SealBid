import { useState, useCallback, useRef } from 'react'
import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
  FREIGHTER_ID,
} from '@creit.tech/stellar-wallets-kit'

const NETWORK =
  (import.meta.env.VITE_STELLAR_NETWORK === 'testnet'
    ? WalletNetwork.TESTNET
    : WalletNetwork.PUBLIC)

export interface WalletState {
  address: string | null
  isConnected: boolean
  connect: () => Promise<void>
  disconnect: () => void
  kit: StellarWalletsKit | null
  signTx: (xdr: string) => Promise<string>
}

export function useWallet(): WalletState {
  const [address, setAddress] = useState<string | null>(null)
  const kitRef = useRef<StellarWalletsKit | null>(null)

  const getKit = useCallback((): StellarWalletsKit => {
    if (!kitRef.current) {
      kitRef.current = new StellarWalletsKit({
        network: NETWORK,
        selectedWalletId: FREIGHTER_ID,
        modules: allowAllModules(),
      })
    }
    return kitRef.current
  }, [])

  const connect = useCallback(async () => {
    const kit = getKit()
    await kit.openModal({
      onWalletSelected: async (option) => {
        kit.setWallet(option.id)
        const { address: addr } = await kit.getAddress()
        setAddress(addr)
      },
    })
  }, [getKit])

  const disconnect = useCallback(() => {
    setAddress(null)
  }, [])

  const signTx = useCallback(
    async (xdr: string): Promise<string> => {
      const kit = getKit()
      if (!address) throw new Error('Wallet not connected')
      const { signedTxXdr } = await kit.signTransaction(xdr, {
        networkPassphrase:
          NETWORK === WalletNetwork.TESTNET
            ? 'Test SDF Network ; September 2015'
            : 'Public Global Stellar Network ; September 2015',
        address,
      })
      return signedTxXdr
    },
    [getKit, address],
  )

  return {
    address,
    isConnected: !!address,
    connect,
    disconnect,
    kit: kitRef.current,
    signTx,
  }
}
