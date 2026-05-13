// ── AI Prompt Templates for MyBase ──
// Pure prompt engineering — no model training, no fine-tuning.
// These are system prompts + structured user inputs for Kimi API.

export type AITaskType = 'context' | 'counter' | 'structure' | 'sources'

export const AI_TASK_LABELS: Record<AITaskType, string> = {
  context: 'Generate context',
  counter: 'Counter-arguments',
  structure: 'Structure helper',
  sources: 'Find sources',
}

export const AI_TASK_ICONS: Record<AITaskType, string> = {
  context: '📚',
  counter: '⚔️',
  structure: '🏗️',
  sources: '🔗',
}

// ── System prompts ──
const SYSTEM_BASE = `You are a research assistant for Mexican civic discourse and policy analysis.
Your user is building a knowledge graph of political claims, positions, and evidence.
Be concise, factual, and neutral. Cite real Mexican institutions when possible (INE, SHCP, CONEVAL, etc.).
Always return valid JSON matching the requested schema. No markdown outside JSON.`

export function buildContextPrompt(claimContent: string): { system: string; user: string } {
  return {
    system: SYSTEM_BASE,
    user: `Given this claim about Mexican politics or policy, provide background context:

Claim: "${claimContent}"

Return JSON with this exact schema:
{
  "background": ["2-3 historical precedents or relevant facts"],
  "sources": ["1-2 credible sources with URLs if known"],
  "missingAngle": "1 angle the user probably hasn't considered"
}`,
  }
}

export function buildCounterPrompt(positionContent: string): { system: string; user: string } {
  return {
    system: SYSTEM_BASE + '\nYou are a devil\'s advocate. Generate the strongest good-faith opposition. Do not strawman.',
    user: `Given this position, generate the strongest counter-arguments:

Position: "${positionContent}"

Return JSON with this exact schema:
{
  "counterClaims": ["2-3 strong opposing claims"],
  "rebuttalToUserPremise": "The core flaw or weak assumption in the user's position",
  "strongestEvidence": "The single strongest piece of evidence against this position"
}`,
  }
}

export function buildStructurePrompt(
  claims: { id: string; content: string; type: string }[],
  edges: { from: string; to: string; label: string }[]
): { system: string; user: string } {
  return {
    system: SYSTEM_BASE + '\nYou analyze argument maps for logical gaps and structural issues.',
    user: `Analyze this argument map:

Claims:
${claims.map((c) => `- [${c.type}] ${c.content}`).join('\n')}

Connections:
${edges.map((e) => `- "${e.from}" ${e.label} "${e.to}"`).join('\n')}

Return JSON with this exact schema:
{
  "gaps": ["Logical gaps or missing intermediate claims"],
  "suggestions": ["Specific suggestions to improve the argument structure"],
  "reorganizedOrder": ["Suggested order of claims for clearer flow"]
}`,
  }
}

export function buildSourcesPrompt(claimContent: string): { system: string; user: string } {
  return {
    system: SYSTEM_BASE,
    user: `Find credible sources for this claim about Mexican politics/policy:

Claim: "${claimContent}"

Return JSON with this exact schema:
{
  "sources": [
    {
      "title": "Source title",
      "author": "Author or institution",
      "url": "URL if known, else null",
      "credibility": "high|medium|low",
      "relevance": "Why this source matters for this claim"
    }
  ],
  "gaps": ["What evidence is still missing?"]
}`,
  }
}

// ── Unified builder ──
export function buildPrompt(
  task: AITaskType,
  payload: { claimContent?: string; claims?: any[]; edges?: any[] }
): { system: string; user: string } {
  switch (task) {
    case 'context':
      return buildContextPrompt(payload.claimContent || '')
    case 'counter':
      return buildCounterPrompt(payload.claimContent || '')
    case 'structure':
      return buildStructurePrompt(payload.claims || [], payload.edges || [])
    case 'sources':
      return buildSourcesPrompt(payload.claimContent || '')
    default:
      return buildContextPrompt(payload.claimContent || '')
  }
}

// ── Re-exports for convenience ──
export { useAIAssist } from './useAIAssist'
export type { AIAssistState, AIAssistResult } from './useAIAssist'
