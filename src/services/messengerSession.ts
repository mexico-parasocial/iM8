import {
  approvalCodeFor,
  verifyMessageApproval,
} from './messageApproval'
import type { SignedAssertion } from './identitySignature'

/**
 * Messenger-only mode.
 *
 * A Matrix token held with self-restriction: the session allows sending,
 * reading, and room membership — nothing that touches identity, profile,
 * devices, or the account. Enforcement here is client-side (the Matrix
 * API has no per-endpoint scopes for Synapse to check); server-backed
 * scoping (MAS client, short TTL) is Phase B. What this module does
 * guarantee, tested below:
 *
 * - Entry requires a well-formed 6-digit messenger code. Shape validation
 *   is local; redeeming the code against MAS is the Phase B hook point.
 * - Actions outside the allowlist are refused in every state, including
 *   `active`. There is no state in which this session may touch identity.
 * - Every send must carry a message approval (see messageApproval.ts)
 *   whose code matches what the confirm sheet showed: `assertSendApproval`
 *   re-verifies signature, room, body, timestamp, audience, and code.
 *
 * Pure logic, no native imports: testable under `tsx --test`.
 */

export const MESSENGER_CODE_PATTERN = /^\d{6}$/

export type MessengerState = 'idle' | 'code-entered' | 'active' | 'locked'

export type MessengerSession = {
  state: MessengerState
  enteredAt?: string
  activeAt?: string
  deviceId?: string
}

export const MESSENGER_ALLOWED_ACTIONS = [
  'message.send',
  'message.read',
  'room.create',
  'room.join',
  'room.leave',
  'sync',
] as const

export type MessengerAction = (typeof MESSENGER_ALLOWED_ACTIONS)[number]

export class MessengerCodeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MessengerCodeError'
  }
}

export class MessengerStateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MessengerStateError'
  }
}

export function createMessengerSession(): MessengerSession {
  return { state: 'idle' }
}

/**
 * Shape check only: six digits. Whether the code redeems is decided by
 * MAS in Phase B; a well-formed code that redeems nothing still cannot
 * activate this session (see activateMessengerSession).
 */
export function isValidMessengerCode(code: string): boolean {
  return MESSENGER_CODE_PATTERN.test(code.trim())
}

export function enterMessengerCode(
  session: MessengerSession,
  code: string,
  at?: string,
): MessengerSession {
  if (session.state !== 'idle' && session.state !== 'locked') {
    throw new MessengerStateError(
      `cannot enter a code while ${session.state}`,
    )
  }
  const clean = code.trim()
  if (!isValidMessengerCode(clean)) {
    throw new MessengerCodeError('messenger codes are 6 digits')
  }
  return {
    state: 'code-entered',
    enteredAt: at ?? new Date().toISOString(),
  }
}

export function activateMessengerSession(
  session: MessengerSession,
  deviceId: string,
  at?: string,
): MessengerSession {
  if (session.state !== 'code-entered') {
    throw new MessengerStateError(
      `cannot activate from ${session.state}: enter a code first`,
    )
  }
  if (!deviceId) throw new MessengerStateError('deviceId is required')
  return {
    ...session,
    state: 'active',
    deviceId,
    activeAt: at ?? new Date().toISOString(),
  }
}

export function lockMessengerSession(session: MessengerSession): MessengerSession {
  return { ...session, state: 'locked' }
}

export function isMessengerActionAllowed(action: string): boolean {
  return (MESSENGER_ALLOWED_ACTIONS as readonly string[]).includes(action)
}

/** Throw unless the session is active and the action is allowlisted. */
export function assertMessengerAction(
  session: MessengerSession,
  action: string,
): void {
  if (session.state !== 'active') {
    throw new MessengerStateError(
      `messenger action ${action} refused while ${session.state}`,
    )
  }
  if (!isMessengerActionAllowed(action)) {
    throw new MessengerStateError(
      `messenger sessions never allow ${action}`,
    )
  }
}

export type SendApprovalExpectation = {
  roomId: string
  body: string
  sentAt: string
  audience: string
  code: string
}

/**
 * Gate a send on its approval: the signature must verify for this exact
 * room/body/timestamp/audience, AND the code must equal what the confirm
 * sheet displayed. Either check failing refuses the send.
 */
export function assertSendApproval(
  approval: SignedAssertion,
  expected: SendApprovalExpectation,
): void {
  if (!verifyMessageApproval(approval, expected)) {
    throw new MessengerStateError('message approval does not verify')
  }
  let code: string
  try {
    code = approvalCodeFor(approval.signature)
  } catch {
    throw new MessengerStateError('message approval is malformed')
  }
  if (code !== expected.code) {
    throw new MessengerStateError('approval code does not match the confirm sheet')
  }
}
