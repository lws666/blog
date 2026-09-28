/**
 * RFC 6238 TOTP (time-based one-time password) — Google Authenticator compatible.
 *
 * Self-contained on purpose: WebCrypto HMAC-SHA1 + RFC 4648 base32, no
 * third-party dependency (otplib and friends pull in Node-only APIs).
 *
 * Secrets are stored/st-shared as base32 (what authenticator apps scan and
 * display). Codes are 6 digits, 30s step, ±1 window (clock drift tolerance).
 */

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(bytes: Uint8Array): string {
  let out = ''
  let bits = 0
  let value = 0
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0)
    out += B32_ALPHABET[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(input: string): Uint8Array {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '')
  const out: number[] = []
  let bits = 0
  let value = 0
  for (const char of clean) {
    value = (value << 5) | B32_ALPHABET.indexOf(char)
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return new Uint8Array(out)
}

export function generateTotpSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20))
  return base32Encode(bytes)
}

/** RFC 4226 HOTP: truncate HMAC-SHA1(key, counter) to 6 digits */
export async function hotp(key: Uint8Array, counter: number): Promise<string> {
  const msg = new ArrayBuffer(8)
  const view = new DataView(msg)
  view.setUint32(0, Math.floor(counter / 2 ** 32))
  view.setUint32(4, counter >>> 0)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as unknown as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, msg))

  const offset = mac[19]! & 0x0f
  const binary
    = ((mac[offset]! & 0x7f) << 24)
      | (mac[offset + 1]! << 16)
      | (mac[offset + 2]! << 8)
      | mac[offset + 3]!
  return String(binary % 1_000_000).padStart(6, '0')
}

/** Constant-time string comparison (no early exit on the shared prefix) */
export function timingSafeEqual(a: string, b: string): boolean {
  let diff = a.length === b.length ? 0 : 1
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++)
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  return diff === 0
}

export const TOTP_STEP_SECONDS = 30

/**
 * Verify a 6-digit TOTP code against a base32 secret.
 * Accepts codes from the previous/current/next step (clock drift).
 */
export async function verifyTotpCode(
  secretBase32: string,
  code: string,
  window = 1,
): Promise<{ ok: boolean, matchedStep?: number }> {
  const normalized = code.trim()
  if (!/^\d{6}$/.test(normalized))
    return { ok: false }

  const key = base32Decode(secretBase32)
  if (key.length === 0)
    return { ok: false }

  const current = Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS)
  for (let i = -window; i <= window; i++) {
    const expected = await hotp(key, current + i)
    if (timingSafeEqual(expected, normalized))
      return { ok: true, matchedStep: current + i }
  }
  return { ok: false }
}
