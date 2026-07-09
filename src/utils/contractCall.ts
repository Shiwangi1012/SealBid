/**
 * Helpers for calling the AuctionContract via Soroban RPC.
 * Uses @stellar/stellar-sdk's rpc module and manual tx building.
 */
import {
  Contract,
  Networks,
  nativeToScVal,
  Address,
  xdr,
  TransactionBuilder,
  TimeoutInfinite,
  BASE_FEE,
  rpc as SorobanRpc,
  Account,
} from '@stellar/stellar-sdk'

const RPC_URL =
  import.meta.env.VITE_SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org'
const NETWORK_PASSPHRASE = Networks.TESTNET
const AUCTION_ID = import.meta.env.VITE_AUCTION_CONTRACT_ID as string

const server = new SorobanRpc.Server(RPC_URL, { allowHttp: false })

export type TxStatus = 'pending' | 'success' | 'error'

export interface TxResult {
  hash: string
  status: TxStatus
  error?: string
}

/** Generic helper: simulate → sign → send → await */
async function invokeContract(
  signerAddress: string,
  signTx: (xdr: string) => Promise<string>,
  contractId: string,
  method: string,
  args: xdr.ScVal[],
): Promise<TxResult> {
  const contract = new Contract(contractId)
  const operation = contract.call(method, ...args)

  const account = await server.getAccount(signerAddress)

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(TimeoutInfinite)
    .build()

  // Simulate to get footprint
  const sim = await server.simulateTransaction(tx)
  if (SorobanRpc.Api.isSimulationError(sim)) {
    const msg = (sim as SorobanRpc.Api.SimulateTransactionErrorResponse).error ?? 'Simulation failed'
    throw new ContractError(mapContractError(msg), msg)
  }

  const prepared = SorobanRpc.assembleTransaction(tx, sim).build()
  const signedXdr = await signTx(prepared.toXDR())

  const sent = await server.sendTransaction(
    TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE),
  )
  if (sent.status === 'ERROR') {
    const raw = sent.errorResult?.toString() ?? ''
    throw new ContractError('Transaction rejected', raw)
  }

  // Poll for result
  let result = await server.getTransaction(sent.hash)
  let retries = 20
  while (result.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND && retries-- > 0) {
    await sleep(3000)
    result = await server.getTransaction(sent.hash)
  }

  if (result.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
    const raw = result.resultXdr?.toXDR('base64') ?? ''
    throw new ContractError(mapContractError(raw), raw)
  }

  return { hash: sent.hash, status: 'success' }
}

// ---- Public API -------------------------------------------------------

export async function callCommit(
  bidderAddress: string,
  commitmentHex: string,
  depositStroops: bigint,
  signTx: (xdr: string) => Promise<string>,
): Promise<TxResult> {
  const commitBytes = hexToScBytes32(commitmentHex)
  const args: xdr.ScVal[] = [
    new Address(bidderAddress).toScVal(),
    commitBytes,
    nativeToScVal(depositStroops, { type: 'i128' }),
  ]
  return invokeContract(bidderAddress, signTx, AUCTION_ID, 'commit', args)
}

export async function callReveal(
  bidderAddress: string,
  amountXlm: string,
  saltHex: string,
  signTx: (xdr: string) => Promise<string>,
): Promise<TxResult> {
  const stroops = BigInt(Math.round(parseFloat(amountXlm) * 1e7))
  const saltBytes = hexToScBytes32(saltHex)
  const args: xdr.ScVal[] = [
    new Address(bidderAddress).toScVal(),
    nativeToScVal(stroops, { type: 'u64' }),
    saltBytes,
  ]
  return invokeContract(bidderAddress, signTx, AUCTION_ID, 'reveal', args)
}

export async function callFinalize(
  callerAddress: string,
  signTx: (xdr: string) => Promise<string>,
): Promise<TxResult> {
  return invokeContract(callerAddress, signTx, AUCTION_ID, 'finalize', [])
}

export async function callClaimRefund(
  bidderAddress: string,
  signTx: (xdr: string) => Promise<string>,
): Promise<TxResult> {
  const args: xdr.ScVal[] = [new Address(bidderAddress).toScVal()]
  return invokeContract(bidderAddress, signTx, AUCTION_ID, 'claim_refund', args)
}

export async function getAuctionState(): Promise<'Bidding' | 'Reveal' | 'Finalized'> {
  try {
    const contract = new Contract(AUCTION_ID)
    const dummyAccount = new Account(
      'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
      '0',
    )
    const tx = new TransactionBuilder(dummyAccount, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('get_state'))
      .setTimeout(TimeoutInfinite)
      .build()

    const sim = await server.simulateTransaction(tx)
    if (SorobanRpc.Api.isSimulationError(sim)) return 'Bidding'
    if (!SorobanRpc.Api.isSimulationSuccess(sim)) return 'Bidding'

    const retVal = (sim as SorobanRpc.Api.SimulateTransactionSuccessResponse).result?.retval
    if (!retVal) return 'Bidding'

    // The enum discriminant comes back as an ScVal of type scvVec or contractEnum
    // Try to read the symbolic name from the enum tag
    try {
      // scvEnum has a discriminant that corresponds to the Rust enum variant
      const asAny = retVal as unknown as { _value?: { name?: string }; name?: () => string }
      const tag = retVal.value()
      if (typeof tag === 'object' && tag !== null) {
        const namedTag = tag as { name?: string }
        if (namedTag.name === 'Reveal') return 'Reveal'
        if (namedTag.name === 'Finalized') return 'Finalized'
        if (namedTag.name === 'Bidding') return 'Bidding'
      }
      if (typeof asAny._value?.name === 'string') {
        if (asAny._value.name === 'Reveal') return 'Reveal'
        if (asAny._value.name === 'Finalized') return 'Finalized'
      }
    } catch { /* ignore */ }
    return 'Bidding'
  } catch {
    return 'Bidding'
  }
}

// ---- Helpers ----------------------------------------------------------

function hexToScBytes32(hex: string): xdr.ScVal {
  const bytes = hexToBytes(hex)
  return xdr.ScVal.scvBytes(Buffer.from(bytes))
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return out
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

// ---- Error types ------------------------------------------------------

const ERROR_MAP: Record<string, string> = {
  'not in bidding phase': 'Bidding phase has ended — you can no longer submit bids.',
  'not in reveal phase': 'Reveal phase has not started or has ended.',
  'hash mismatch': 'Hash mismatch — your amount or salt does not match the commitment.',
  'reveal phase not ended': 'Cannot finalize yet — the reveal phase is still open.',
  'already committed': 'You have already submitted a bid for this auction.',
  'no commitment found': 'No commitment found — submit a bid first.',
  'not finalized yet': 'The auction has not been finalized yet.',
  'winner cannot claim refund': 'You are the winner — you cannot claim a refund.',
  'no deposit found': 'No deposit found for this address.',
  'already refunded': 'Your deposit has already been refunded.',
  'deposit must be positive': 'Deposit must be greater than zero.',
}

function mapContractError(raw: string): string {
  const lc = raw.toLowerCase()
  for (const [key, msg] of Object.entries(ERROR_MAP)) {
    if (lc.includes(key)) return msg
  }
  return `Contract error: ${raw.slice(0, 120)}`
}

export class ContractError extends Error {
  public readonly rawMessage: string
  constructor(message: string, raw: string) {
    super(message)
    this.name = 'ContractError'
    this.rawMessage = raw
  }
}
