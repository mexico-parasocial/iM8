/**
 * PARA hub summary: the civic-power hero at the top of the Identity tab.
 *
 * Pure derivation over plain inputs so it stays testable under `tsx
 * --test`. The component evaluates gated spaces with the already-tested
 * `evaluateProofGate` and passes the counts in.
 */

export type ParaHubSummary = {
  statusLabel: 'Unlocked' | 'Locked'
  statusTone: 'success' | 'neutral'
  receiptsLabel: string
  appsLabel: string
  spacesLabel: string
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

export function summarizeParaHub(input: {
  isVerified: boolean
  activeReceiptCount: number
  activeGrantCount: number
  admittedSpaceCount: number
  totalSpaceCount: number
}): ParaHubSummary {
  return {
    statusLabel: input.isVerified ? 'Unlocked' : 'Locked',
    statusTone: input.isVerified ? 'success' : 'neutral',
    receiptsLabel: countLabel(input.activeReceiptCount, 'receipt', 'receipts'),
    appsLabel: countLabel(input.activeGrantCount, 'grant', 'grants'),
    spacesLabel: `${input.admittedSpaceCount}/${input.totalSpaceCount}`,
  }
}
