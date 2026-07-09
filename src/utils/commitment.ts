/**
 * Client-side commitment scheme matching the contract:
 *   sha256( amount_u64_le_bytes ++ salt_bytes_32 )
 */

/** Generates 32 cryptographically-random bytes, returned as lowercase hex */
export function generateSalt(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Encodes a 64-bit unsigned integer as 8 little-endian bytes */
function u64ToLeBytes(value: bigint): Uint8Array {
  const buf = new Uint8Array(8)
  let v = value
  for (let i = 0; i < 8; i++) {
    buf[i] = Number(v & 0xffn)
    v >>= 8n
  }
  return buf
}

/** Decodes a 64-hex-char salt string to 32 bytes */
function saltHexToBytes(saltHex: string): Uint8Array {
  if (saltHex.length !== 64) throw new Error('Salt must be 64 hex chars (32 bytes)')
  const bytes = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(saltHex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/**
 * Computes sha256(amount_u64_le_bytes ++ salt_bytes_32)
 *
 * @param amountXlm  - bid amount as string (e.g. "10.5"), interpreted in stroops (multiply by 1e7)
 * @param saltHex    - 64 hex chars (32 bytes)
 * @returns lowercase hex string of the 32-byte commitment
 */
export async function computeCommitment(amountXlm: string, saltHex: string): Promise<string> {
  const stroops = BigInt(Math.round(parseFloat(amountXlm) * 1e7))
  const amountBytes = u64ToLeBytes(stroops)
  const saltBytes = saltHexToBytes(saltHex)

  const data = new Uint8Array(8 + 32)
  data.set(amountBytes, 0)
  data.set(saltBytes, 8)

  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Save bid secrets to localStorage so the user can reveal later */
export function saveBidSecrets(address: string, amount: string, salt: string) {
  const key = `bid_secrets_${address}`
  localStorage.setItem(key, JSON.stringify({ amount, salt, savedAt: Date.now() }))
}

/** Load saved bid secrets for an address */
export function loadBidSecrets(address: string): { amount: string; salt: string } | null {
  const key = `bid_secrets_${address}`
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as { amount: string; salt: string }
  } catch {
    return null
  }
}
