import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  createDeviceRegistry,
  describeLastSeen,
  labelForPlatform,
  type KeyValueStore,
} from '../deviceRegistry'

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value)
    },
    removeItem: async (key) => {
      data.delete(key)
    },
  }
}

const NOW = Date.parse('2026-09-06T12:00:00.000Z')
let idCounter = 0

function testRegistry(store: KeyValueStore) {
  idCounter = 0
  return createDeviceRegistry(store, {
    generateId: () => `test-id-${++idCounter}`,
    now: () => NOW,
  })
}

describe('labelForPlatform', () => {
  it('names the common platforms', () => {
    assert.equal(labelForPlatform('ios'), 'iPhone')
    assert.equal(labelForPlatform('android'), 'Android device')
    assert.equal(labelForPlatform('web'), 'Web session')
  })

  it('falls back for anything unknown', () => {
    assert.equal(labelForPlatform('toaster'), 'Unknown device')
    assert.equal(labelForPlatform(''), 'Unknown device')
  })
})

describe('describeLastSeen', () => {
  it('says just now under a minute', () => {
    assert.equal(
      describeLastSeen(new Date(NOW - 30 * 1000).toISOString(), NOW),
      'Just now',
    )
  })

  it('counts minutes then hours then days', () => {
    assert.equal(
      describeLastSeen(new Date(NOW - 5 * 60 * 1000).toISOString(), NOW),
      '5 min ago',
    )
    assert.equal(
      describeLastSeen(new Date(NOW - 3 * 60 * 60 * 1000).toISOString(), NOW),
      '3 hours ago',
    )
    assert.equal(
      describeLastSeen(new Date(NOW - 60 * 60 * 1000).toISOString(), NOW),
      '1 hour ago',
    )
    assert.equal(
      describeLastSeen(new Date(NOW - 2 * 24 * 60 * 60 * 1000).toISOString(), NOW),
      '2 days ago',
    )
  })

  it('falls back to a date past thirty days and unknown for garbage', () => {
    const old = describeLastSeen(
      new Date(NOW - 60 * 24 * 60 * 60 * 1000).toISOString(),
      NOW,
    )
    assert.match(old, /2026/)
    assert.equal(describeLastSeen('not-a-date', NOW), 'Unknown')
  })
})

describe('device registry', () => {
  it('starts empty and creates the install entry on touch', async () => {
    const store = memoryStore()
    const registry = testRegistry(store)
    assert.deepEqual(await registry.load(), [])
    const devices = await registry.touchCurrentDevice('ios')
    assert.equal(devices.length, 1)
    assert.equal(devices[0].id, 'test-id-1')
    assert.equal(devices[0].label, 'iPhone')
    assert.equal(devices[0].source, 'this-install')
    assert.equal(devices[0].lastSeenAt, new Date(NOW).toISOString())
  })

  it('reuses the install id and only refreshes lastSeen on later touches', async () => {
    const store = memoryStore()
    const registry = testRegistry(store)
    await registry.touchCurrentDevice('ios')
    const later = createDeviceRegistry(store, {
      generateId: () => 'must-not-be-used',
      now: () => NOW + 60 * 1000,
    })
    const devices = await later.touchCurrentDevice('ios')
    assert.equal(devices.length, 1)
    assert.equal(devices[0].id, 'test-id-1')
    assert.equal(devices[0].lastSeenAt, new Date(NOW + 60 * 1000).toISOString())
  })

  it('records restores as separate entries', async () => {
    const store = memoryStore()
    const registry = testRegistry(store)
    await registry.touchCurrentDevice('ios')
    const devices = await registry.recordRestoreDevice('ios')
    assert.equal(devices.length, 2)
    const restored = devices.find((entry) => entry.source === 'restore')
    assert.ok(restored)
    assert.equal(restored.label, 'Restored device')
  })

  it('refuses to remove the current install', async () => {
    const store = memoryStore()
    const registry = testRegistry(store)
    await registry.touchCurrentDevice('ios')
    await registry.recordRestoreDevice('ios')
    const refused = await registry.removeDevice('test-id-1')
    assert.equal(refused.removed, false)
    assert.equal(refused.devices.length, 2)
    const removed = await registry.removeDevice('test-id-2')
    assert.equal(removed.removed, true)
    assert.equal(removed.devices.length, 1)
  })

  it('degrades to empty on corrupt storage instead of throwing', async () => {
    const store = memoryStore()
    await store.setItem('@m8/device-registry', 'not json{')
    const registry = testRegistry(store)
    assert.deepEqual(await registry.load(), [])
  })
})
