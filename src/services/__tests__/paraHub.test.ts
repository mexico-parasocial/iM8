import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { summarizeParaHub } from '../paraHub'

describe('summarizeParaHub', () => {
  it('unlocks with verification and counts everything', () => {
    assert.deepEqual(
      summarizeParaHub({
        isVerified: true,
        activeReceiptCount: 2,
        activeGrantCount: 1,
        admittedSpaceCount: 2,
        totalSpaceCount: 3,
      }),
      {
        statusLabel: 'Unlocked',
        statusTone: 'success',
        receiptsLabel: '2 receipts',
        appsLabel: '1 grant',
        spacesLabel: '2/3',
      },
    )
  })

  it('locks without verification and handles zero states', () => {
    const summary = summarizeParaHub({
      isVerified: false,
      activeReceiptCount: 0,
      activeGrantCount: 0,
      admittedSpaceCount: 0,
      totalSpaceCount: 3,
    })
    assert.equal(summary.statusLabel, 'Locked')
    assert.equal(summary.statusTone, 'neutral')
    assert.equal(summary.receiptsLabel, '0 receipts')
    assert.equal(summary.spacesLabel, '0/3')
  })
})
