import { sha256 } from '@noble/hashes/sha2'
import { utf8ToBytes } from '@noble/hashes/utils'
import { bytesToHex } from '@noble/curves/abstract/utils'
import {
  signIdentityChallenge,
  verifyIdentityAssertion,
  type SignedAssertion,
} from './identitySignature'
import type { IdentityLabel } from './keyDerivation'

/**
 * Per-message step-up ("2FA for your messages").
 *
 * Sending from a logged-in Matrix session proves nothing about the key:
 * whoever holds the access token can send. Approving a message signs a
 * challenge committing to room, body and timestamp with the identity key
 * under the `message-approve` purpose — purpose binding means a login
 * assertion can never approve a message and an approval can never log in.
 *
 * The 6-digit code is the human face of the signature: what the
 * confirm-send sheet shows. It is derived from the signature, so it is
 * different for every message and checkable against the approval.
 */

export const MESSAGE_CHALLENGE_DOMAIN = 'para-id/message/v1'

export type MessageApprovalInput = {
  roomId: string
  body: string
  sentAt: string
}

export function hashMessageBody(body: string): string {
  return bytesToHex(sha256(utf8ToBytes(body)))
}

/** Canonical challenge. Field order is fixed — verifiers must rebuild it. */
export function buildMessageChallenge(input: MessageApprovalInput): string {
  if (!input.roomId) throw new Error('roomId is required')
  if (!input.body) throw new Error('body is required')
  if (!input.sentAt) throw new Error('sentAt is required')
  return (
    `${MESSAGE_CHALLENGE_DOMAIN}\n` +
    `room:${input.roomId}\n` +
    `body:${hashMessageBody(input.body)}\n` +
    `at:${input.sentAt}`
  )
}

/** Six digits from the signature: stable per approval, unique per message. */
export function approvalCodeFor(signatureHex: string): string {
  const digest = sha256(utf8ToBytes(signatureHex))
  const value =
    ((digest[0] * 256 + digest[1]) * 256 + digest[2]) * 256 + digest[3]
  return (value % 1_000_000).toString().padStart(6, '0')
}

export type MessageApproval = SignedAssertion & {
  challenge: string
  code: string
}

export function approveMessage(
  seed: Uint8Array,
  label: IdentityLabel,
  input: MessageApprovalInput & { audience?: string; signedAt?: string },
  random?: Uint8Array,
): MessageApproval {
  const challenge = buildMessageChallenge(input)
  const signed = signIdentityChallenge(
    seed,
    label,
    {
      purpose: 'message-approve',
      audience: input.audience ?? 'matrix',
      challenge,
      signedAt: input.signedAt,
    },
    random,
  )
  return {
    ...signed,
    challenge,
    code: approvalCodeFor(signed.signature),
  }
}

/**
 * Verify an approval against the message it claims to approve. Any
 * mismatch — different room, edited body, wrong audience, login purpose —
 * is a rejection, never an exception.
 */
export function verifyMessageApproval(
  approval: SignedAssertion,
  input: MessageApprovalInput & { audience: string },
): boolean {
  let challenge: string
  try {
    challenge = buildMessageChallenge(input)
  } catch {
    return false
  }
  return verifyIdentityAssertion(approval, {
    purpose: 'message-approve',
    audience: input.audience,
    challenge,
  })
}
