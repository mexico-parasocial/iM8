import { useState, useCallback, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { buildPrompt, type AITaskType } from './aiPrompts'

// ── Kimi API config ──
const KIMI_API_URL = 'https://api.moonshot.cn/v1/chat/completions'
const KIMI_MODEL = 'kimi-k2.6'
const MAX_CALLS_PER_MIN = 10
const CACHE_TTL_MS = 1000 * 60 * 60 // 1 hour

export type AIAssistState = 'idle' | 'loading' | 'success' | 'error'

export type AIAssistResult = {
  task: AITaskType
  draftNodes: { type: string; content: string; reason: string }[]
  rawResponse: string
}

export function useAIAssist() {
  const [state, setState] = useState<AIAssistState>('idle')
  const [result, setResult] = useState<AIAssistResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const callTimestamps = useRef<number[]>([])

  // ── Rate limiting ──
  const checkRateLimit = async (): Promise<boolean> => {
    const now = Date.now()
    const oneMinAgo = now - 60000
    callTimestamps.current = callTimestamps.current.filter((t) => t > oneMinAgo)

    if (callTimestamps.current.length >= MAX_CALLS_PER_MIN) {
      setError('Rate limit: max 10 AI calls per minute. Try again soon.')
      setState('error')
      return false
    }
    return true
  }

  // ── Cache key ──
  const getCacheKey = (task: AITaskType, payloadHash: string) =>
    `@ai_cache_${task}_${payloadHash}`

  // ── Hash payload for cache ──
  const hashPayload = (payload: any): string => {
    const str = JSON.stringify(payload)
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash + char) | 0
    }
    return Math.abs(hash).toString(36)
  }

  // ── Main call ──
  const callAI = useCallback(
    async (
      task: AITaskType,
      payload: { claimContent?: string; claims?: any[]; edges?: any[] }
    ): Promise<AIAssistResult | null> => {
      setState('loading')
      setError(null)
      setResult(null)

      // Rate limit
      if (!(await checkRateLimit())) return null

      const payloadHash = hashPayload(payload)
      const cacheKey = getCacheKey(task, payloadHash)

      // Check cache
      try {
        const cached = await AsyncStorage.getItem(cacheKey)
        if (cached) {
          const parsed = JSON.parse(cached)
          if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
            setResult(parsed.data)
            setState('success')
            return parsed.data
          }
        }
      } catch {
        // Cache miss or corrupt, continue
      }

      // Build prompt
      const { system, user } = buildPrompt(task, payload)

      // Call Kimi API
      try {
        const apiKey = process.env.KIMI_API_KEY || ''
        if (!apiKey) {
          throw new Error('KIMI_API_KEY not configured')
        }

        const response = await fetch(KIMI_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: KIMI_MODEL,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
            temperature: 0.7,
            max_tokens: 2048,
            response_format: { type: 'json_object' },
          }),
        })

        if (!response.ok) {
          const errText = await response.text()
          throw new Error(`Kimi API ${response.status}: ${errText}`)
        }

        const data = await response.json()
        const content = data.choices?.[0]?.message?.content || ''

        // Parse JSON response
        let parsed: any
        try {
          parsed = JSON.parse(content)
        } catch {
          // Fallback: wrap raw text
          parsed = { raw: content }
        }

        // Convert to draft nodes
        const draftNodes = extractDraftNodes(task, parsed, payload.claimContent || '')

        const result: AIAssistResult = {
          task,
          draftNodes,
          rawResponse: content,
        }

        // Cache result
        await AsyncStorage.setItem(
          cacheKey,
          JSON.stringify({ timestamp: Date.now(), data: result })
        )

        // Track call
        callTimestamps.current.push(Date.now())

        setResult(result)
        setState('success')
        return result
      } catch (err: any) {
        setError(err.message || 'AI request failed')
        setState('error')
        return null
      }
    },
    []
  )

  const reset = useCallback(() => {
    setState('idle')
    setResult(null)
    setError(null)
  }, [])

  return { state, result, error, callAI, reset }
}

// ── Extract draft nodes from parsed response ──
function extractDraftNodes(
  task: AITaskType,
  parsed: any,
  originalContent: string
): { type: string; content: string; reason: string }[] {
  const drafts: { type: string; content: string; reason: string }[] = []

  switch (task) {
    case 'context':
      if (parsed.background) {
        parsed.background.forEach((bg: string, i: number) =>
          drafts.push({ type: 'note', content: bg, reason: 'Historical context' })
        )
      }
      if (parsed.missingAngle) {
        drafts.push({
          type: 'question',
          content: parsed.missingAngle,
          reason: 'Missing angle to consider',
        })
      }
      break

    case 'counter':
      if (parsed.counterClaims) {
        parsed.counterClaims.forEach((claim: string) =>
          drafts.push({ type: 'claim', content: claim, reason: 'Counter-argument' })
        )
      }
      if (parsed.rebuttalToUserPremise) {
        drafts.push({
          type: 'claim',
          content: parsed.rebuttalToUserPremise,
          reason: 'Core rebuttal',
        })
      }
      break

    case 'structure':
      if (parsed.gaps) {
        parsed.gaps.forEach((gap: string) =>
          drafts.push({ type: 'question', content: gap, reason: 'Logical gap' })
        )
      }
      if (parsed.suggestions) {
        parsed.suggestions.forEach((s: string) =>
          drafts.push({ type: 'note', content: s, reason: 'Structural suggestion' })
        )
      }
      break

    case 'sources':
      if (parsed.sources) {
        parsed.sources.forEach((src: any) =>
          drafts.push({
            type: 'source',
            content: `${src.title} — ${src.author}${src.url ? ` (${src.url})` : ''}`,
            reason: src.relevance || 'Source',
          })
        )
      }
      break
  }

  return drafts
}
