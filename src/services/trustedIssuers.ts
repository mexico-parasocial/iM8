/**
 * Which issuer keys this client will accept on a proof artifact.
 *
 * This list is the client's root of trust for claims. It has to be pinned
 * rather than fetched from the broker: asking the broker which keys to trust
 * lets a compromised broker nominate its own, which reduces verification to
 * theatre. The point of verifying at all is to stop trusting the broker's word.
 *
 * Configured via EXPO_PUBLIC_M8_TRUSTED_ISSUERS as comma-separated 32-byte hex
 * keys, following the same convention as EXPO_PUBLIC_M8_BROKER_URL. Empty by
 * default and deliberately so — a wrong default here is worse than none, since
 * it would make artifacts look verified against a key nobody vetted.
 */

const HEX32 = /^[0-9a-fA-F]{64}$/

export function parseTrustedIssuers(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((key) => key.trim().toLowerCase())
    .filter((key) => HEX32.test(key))
}

/** Keys rejected as malformed, so misconfiguration is visible rather than silent. */
export function invalidTrustedIssuers(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((key) => key.trim())
    .filter((key) => key.length > 0 && !HEX32.test(key))
}

let warned = false

export function getTrustedIssuers(): string[] {
  const raw = process.env.EXPO_PUBLIC_M8_TRUSTED_ISSUERS
  const valid = parseTrustedIssuers(raw)

  if (__DEV__ && !warned) {
    warned = true
    const invalid = invalidTrustedIssuers(raw)
    if (invalid.length > 0) {
      console.warn(
        `[trustedIssuers] Ignoring ${invalid.length} malformed key(s); expected 64 hex chars.`,
      )
    }
    if (valid.length === 0) {
      console.warn(
        '[trustedIssuers] No trusted issuers configured — every proof artifact ' +
          'will verify as "untrusted-issuer". Set EXPO_PUBLIC_M8_TRUSTED_ISSUERS.',
      )
    }
  }

  return valid
}

/** True when this client can verify anything at all. */
export function canVerifyArtifacts(): boolean {
  return getTrustedIssuers().length > 0
}
