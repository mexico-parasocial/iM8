import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { URL } from 'node:url'
import {
  type ProofBrokerGrantApproveInput,
  type ProofBrokerGrantRequestInput,
  type ProofBrokerGrantRevokeInput,
  type ProofBrokerSessionStartInput,
} from '../../src/contracts/proofBroker.ts'
import type {
  M8IdentityRequestInput,
  M8WalletPresentation,
} from '../../src/contracts/identityWallet.ts'
import { ProofBrokerStore } from './store.ts'

const SESSION_HEADER = 'x-m8-session-id'

function setCorsHeaders(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-m8-session-id, authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown, sessionId?: string) {
  setCorsHeaders(res)
  if (sessionId) {
    res.setHeader(SESSION_HEADER, sessionId)
  }
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function sendError(res: ServerResponse, statusCode: number, message: string) {
  sendJson(res, statusCode, { error: message })
}

async function readJsonBody(req: IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  if (chunks.length === 0) {
    return {}
  }

  const text = Buffer.concat(chunks).toString('utf8')

  if (!text.trim()) {
    return {}
  }

  return JSON.parse(text) as Record<string, unknown>
}

function getSessionId(
  req: IncomingMessage,
  url: URL,
  body?: Record<string, unknown>
) {
  const header = req.headers[SESSION_HEADER]
  const headerValue = Array.isArray(header) ? header[0] : header
  const authValue =
    typeof req.headers.authorization === 'string'
      ? req.headers.authorization.replace(/^Bearer\s+/i, '')
      : null

  return (
    body?.sessionId ??
    body?.session_id ??
    url.searchParams.get('sessionId') ??
    url.searchParams.get('session_id') ??
    authValue ??
    headerValue ??
    ''
  ).toString()
}

function parseStartInput(body: Record<string, unknown>): ProofBrokerSessionStartInput {
  const identifier = body.identifier

  if (typeof identifier !== 'string' || !identifier.trim()) {
    throw new Error('identifier is required')
  }

  return { identifier }
}

function parseGrantRequestInput(body: Record<string, unknown>): ProofBrokerGrantRequestInput {
  return body as ProofBrokerGrantRequestInput
}

function parseGrantApproveInput(body: Record<string, unknown>): ProofBrokerGrantApproveInput {
  return body as ProofBrokerGrantApproveInput
}

function parseGrantRevokeInput(body: Record<string, unknown>): ProofBrokerGrantRevokeInput {
  return body as ProofBrokerGrantRevokeInput
}

function parseIdentityRequestInput(body: Record<string, unknown>): M8IdentityRequestInput {
  return body as M8IdentityRequestInput
}

export function createProofBrokerServer(store: ProofBrokerStore) {
  return createServer(async (req, res) => {
    setCorsHeaders(res)

    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }

    if (!req.url) {
      sendError(res, 400, 'Missing request URL')
      return
    }

    const url = new URL(req.url, `http://${req.headers.host ?? '127.0.0.1'}`)

    try {
      if (req.method === 'POST' && url.pathname === '/session/start') {
        const body = await readJsonBody(req)
        const input = parseStartInput(body)
        const response = await store.startSession(input)
        sendJson(res, 200, response, response.attempt.sessionId)
        return
      }

      if (req.method === 'GET' && url.pathname === '/session/current') {
        const sessionId = getSessionId(req, url)

        if (!sessionId) {
          sendError(res, 401, 'Session token is required')
          return
        }

        const session = await store.getSession(sessionId)
        const ledger = store.getLedger(sessionId)
        sendJson(res, 200, { session, ledger }, sessionId)
        return
      }

      if (req.method === 'POST' && url.pathname === '/grants/request') {
        const body = await readJsonBody(req)
        const input = parseGrantRequestInput(body)
        const sessionId = getSessionId(req, url, body)

        if (!sessionId) {
          sendError(res, 401, 'Session token is required')
          return
        }

        const request = await store.requestGrant(sessionId, input)
        sendJson(res, 200, request, sessionId)
        return
      }

      if (req.method === 'POST' && url.pathname === '/claims/verify') {
        const body = await readJsonBody(req)
        const sessionId = getSessionId(req, url, body)
        const requestId = typeof body.requestId === 'string' ? body.requestId : ''

        if (!sessionId) {
          sendError(res, 401, 'Session token is required')
          return
        }

        if (!requestId) {
          sendError(res, 400, 'requestId is required')
          return
        }

        const proofs = await store.previewClaimRequest(sessionId, requestId)
        sendJson(res, 200, { proofs }, sessionId)
        return
      }

      if (req.method === 'POST' && url.pathname === '/identity/request') {
        const body = await readJsonBody(req)
        const sessionId = getSessionId(req, url, body)

        if (!sessionId) {
          sendError(res, 401, 'Session token is required')
          return
        }

        const request = store.createIdentityDocumentRequest(sessionId, parseIdentityRequestInput(body))
        sendJson(res, 200, request, sessionId)
        return
      }

      if (req.method === 'POST' && url.pathname === '/identity/demo/present') {
        const body = await readJsonBody(req)
        const sessionId = getSessionId(req, url, body)
        const requestId = typeof body.requestId === 'string' ? body.requestId : ''

        if (!sessionId) {
          sendError(res, 401, 'Session token is required')
          return
        }

        if (!requestId) {
          sendError(res, 400, 'requestId is required')
          return
        }

        const selectedElementIds = Array.isArray(body.selectedElementIds)
          ? (body.selectedElementIds as M8IdentityRequestInput['requestedElements'][number]['id'][])
          : undefined
        const presentation = store.createDemoIdentityPresentation(sessionId, requestId, selectedElementIds)
        sendJson(res, 200, { presentation }, sessionId)
        return
      }

      if (req.method === 'POST' && url.pathname === '/identity/verify') {
        const body = await readJsonBody(req)
        const sessionId = getSessionId(req, url, body)
        const requestId = typeof body.requestId === 'string' ? body.requestId : ''
        const presentation = body.presentation as M8WalletPresentation | undefined

        if (!sessionId) {
          sendError(res, 401, 'Session token is required')
          return
        }

        if (!requestId) {
          sendError(res, 400, 'requestId is required')
          return
        }

        if (!presentation) {
          sendError(res, 400, 'presentation is required')
          return
        }

        const result = store.verifyIdentityPresentation(sessionId, requestId, presentation)
        sendJson(res, result.valid ? 200 : 409, result, sessionId)
        return
      }

      const approveMatch = url.pathname.match(/^\/grants\/([^/]+)\/approve$/)
      if (req.method === 'POST' && approveMatch) {
        const body = await readJsonBody(req)
        const input = parseGrantApproveInput(body)
        const sessionId = getSessionId(req, url, body)

        if (!sessionId) {
          sendError(res, 401, 'Session token is required')
          return
        }

        const result = await store.approveGrant(sessionId, decodeURIComponent(approveMatch[1]), input)
        sendJson(res, 200, result, sessionId)
        return
      }

      const revokeMatch = url.pathname.match(/^\/grants\/([^/]+)\/revoke$/)
      if (req.method === 'POST' && revokeMatch) {
        const body = await readJsonBody(req)
        const input = parseGrantRevokeInput(body)
        const sessionId = getSessionId(req, url, body)

        if (!sessionId) {
          sendError(res, 401, 'Session token is required')
          return
        }

        const result = await store.revokeGrant(sessionId, decodeURIComponent(revokeMatch[1]), input)
        sendJson(res, 200, result, sessionId)
        return
      }

      if (req.method === 'GET' && url.pathname === '/providers/para/status') {
        const sessionId = getSessionId(req, url)

        if (!sessionId) {
          sendError(res, 401, 'Session token is required')
          return
        }

        const status = await store.getParaStatus(sessionId)
        sendJson(res, 200, status, sessionId)
        return
      }

      sendError(res, 404, `No route for ${req.method} ${url.pathname}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected broker error'
      const lowerMessage = message.toLowerCase()
      const statusCode =
        lowerMessage.includes('required') || lowerMessage.includes('missing')
          ? 400
          : lowerMessage.includes('not found')
            ? 404
            : lowerMessage.includes('could not confirm')
              ? 409
              : lowerMessage.includes('only proof-only')
              ? 400
              : 500

      sendError(res, statusCode, message)
    }
  })
}
