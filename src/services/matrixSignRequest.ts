import { requestJson } from './brokerApi'
import { signChallenge } from './seedVault'
import type { IdentityLabel } from './keyDerivation'

/*
 * Matrix sign-request fulfillment (CD-M6 client adoption, W1a).
 *
 * PARA cannot sign — the identity keys never leave this wallet. When the user
 * opens PARA's chat, PARA deposits a bridge challenge on the shared M8
 * session (mubEZ /matrix/sign-requests) and polls for the signature. This
 * service is the wallet's half: list what is waiting for this session, and —
 * behind the user's explicit approval — sign it with the identity key and
 * post it back.
 *
 * The signing goes through `signChallenge`, whose allowlist refuses the
 * ballot (`civic`) identity, so nothing here can ever make the ballot key
 * sign. Purpose is fixed to `matrix-login`; the audience selects which
 * bridge interaction (identity probe, session, join, attest) the signature
 * is good for, and the bridge refuses any other use.
 */

export interface MatrixSignRequest {
  id: string
  challenge: string
  audience: string
  status: 'pending' | 'fulfilled'
  createdAt: string
  expiresAt: string
}

/** Which identity the user is approving a chat signature for. `public` is
 *  the default; `anonymous` lets the user chat under their pseudonymous card
 *  if PARA asked for that audience — decided by the approval UI, not by the
 *  requester. */
export type SigningIdentity = Extract<IdentityLabel, 'public' | 'anonymous'>

export async function listPendingMatrixSignRequests(): Promise<
  MatrixSignRequest[]
> {
  const res = await requestJson<{ requests: MatrixSignRequest[] }>(
    '/matrix/sign-requests',
    { method: 'GET' },
  )
  return res.requests ?? []
}

export async function getMatrixSignRequest(
  id: string,
): Promise<MatrixSignRequest | { status: 'fulfilled'; assertion: unknown }> {
  return requestJson<MatrixSignRequest>(`/matrix/sign-requests/${id}`, {
    method: 'GET',
  })
}

/**
 * Sign one pending request and submit it. The caller (approval UI) decides
 * the identity label; the request supplies challenge and audience verbatim.
 */
export async function approveMatrixSignRequest(
  id: string,
  identity: SigningIdentity = 'public',
): Promise<{ status: 'fulfilled' }> {
  const request = (await getMatrixSignRequest(id)) as MatrixSignRequest
  if (request.status !== 'pending') {
    throw new Error('Sign request is not pending')
  }
  const signed = await signChallenge(identity, {
    purpose: 'matrix-login',
    audience: request.audience,
    challenge: request.challenge,
  })
  return requestJson<{ status: 'fulfilled' }>(
    `/matrix/sign-requests/${id}/fulfill`,
    { method: 'POST', body: JSON.stringify(signed) },
  )
}
