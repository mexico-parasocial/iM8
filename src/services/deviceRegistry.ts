import type { DeviceRecord } from '../types'

/**
 * Multi-device registry for a local-first identity.
 *
 * There is no server session list to query — this install is the source of
 * truth. The registry persists the devices known to hold this identity:
 * this install's own entry (created on first launch, `lastSeenAt` touched
 * on every bootstrap) plus one entry per identity restored here from
 * another device's phrase (the other holder stays listed until removed).
 *
 * This module imports no native code so the logic stays testable under
 * `tsx --test`. Callers inject a key-value store; production passes an
 * AsyncStorage adapter.
 */

export type KeyValueStore = {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
  removeItem: (key: string) => Promise<void>
}

export const DEVICE_REGISTRY_KEY = '@m8/device-registry'
export const DEVICE_INSTALL_ID_KEY = '@m8/device-install-id'

export function labelForPlatform(os: string): string {
  if (os === 'ios') return 'iPhone'
  if (os === 'android') return 'Android device'
  if (os === 'web') return 'Web session'
  if (os === 'macos') return 'Mac'
  if (os === 'windows') return 'Windows PC'
  return 'Unknown device'
}

function isoNow(now: () => number): string {
  return new Date(now()).toISOString()
}

/** Human "last seen" for a device row. `nowMs` is injectable for tests. */
export function describeLastSeen(iso: string, nowMs?: number): string {
  const seen = Date.parse(iso)
  if (Number.isNaN(seen)) return 'Unknown'
  const now = nowMs ?? Date.now()
  const diff = now - seen
  if (diff < 0) return 'Just now'
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return 'Just now'
  if (diff < hour) {
    const minutes = Math.floor(diff / minute)
    return `${minutes} min ago`
  }
  if (diff < day) {
    const hours = Math.floor(diff / hour)
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  }
  if (diff < 30 * day) {
    const days = Math.floor(diff / day)
    return `${days} day${days === 1 ? '' : 's'} ago`
  }
  return new Date(seen).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function defaultId(): string {
  return `dev-${Date.now().toString(36)}-${Math.floor(Math.random() * 2 ** 32).toString(36)}`
}

export function createDeviceRegistry(
  store: KeyValueStore,
  opts?: { generateId?: () => string; now?: () => number },
) {
  const generateId = opts?.generateId ?? defaultId
  const now = opts?.now ?? Date.now

  async function load(): Promise<DeviceRecord[]> {
    const raw = await store.getItem(DEVICE_REGISTRY_KEY)
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw) as DeviceRecord[]
      if (!Array.isArray(parsed)) return []
      return parsed.filter(
        (entry) =>
          entry &&
          typeof entry.id === 'string' &&
          typeof entry.lastSeenAt === 'string',
      )
    } catch {
      return []
    }
  }

  async function save(devices: DeviceRecord[]): Promise<void> {
    await store.setItem(DEVICE_REGISTRY_KEY, JSON.stringify(devices))
  }

  async function installId(): Promise<string> {
    const existing = await store.getItem(DEVICE_INSTALL_ID_KEY)
    if (existing) return existing
    const id = generateId()
    await store.setItem(DEVICE_INSTALL_ID_KEY, id)
    return id
  }

  /** Ensure this install has an entry and refresh its `lastSeenAt`. */
  async function touchCurrentDevice(
    platform: string,
    label?: string,
  ): Promise<DeviceRecord[]> {
    const id = await installId()
    const devices = await load()
    const stamped = isoNow(now)
    const existing = devices.find((entry) => entry.id === id)
    const next: DeviceRecord[] = existing
      ? devices.map((entry) =>
          entry.id === id ? { ...entry, lastSeenAt: stamped } : entry,
        )
      : [
          ...devices,
          {
            id,
            label: label ?? labelForPlatform(platform),
            platform,
            source: 'this-install' as const,
            addedAt: stamped,
            lastSeenAt: stamped,
          },
        ]
    await save(next)
    return next
  }

  /**
   * Record an identity restored here from another device's phrase. The
   * restored-from holder keeps its own entry so it stays visible.
   */
  async function recordRestoreDevice(
    platform: string,
    label?: string,
  ): Promise<DeviceRecord[]> {
    const devices = await load()
    const stamped = isoNow(now)
    const next = [
      ...devices,
      {
        id: generateId(),
        label: label ?? 'Restored device',
        platform,
        source: 'restore' as const,
        addedAt: stamped,
        lastSeenAt: stamped,
      },
    ]
    await save(next)
    return next
  }

  /**
   * Remove a device. The current install refuses: signing out is the way
   * off this device, and a disabled button alone would read as a bug if
   * the guard ever failed open.
   */
  async function removeDevice(
    id: string,
  ): Promise<{ devices: DeviceRecord[]; removed: boolean }> {
    const current = await store.getItem(DEVICE_INSTALL_ID_KEY)
    if (current && id === current) {
      return { devices: await load(), removed: false }
    }
    const devices = await load()
    const next = devices.filter((entry) => entry.id !== id)
    const removed = next.length !== devices.length
    if (removed) await save(next)
    return { devices: next, removed }
  }

  async function clearAll(): Promise<void> {
    await store.removeItem(DEVICE_REGISTRY_KEY)
    await store.removeItem(DEVICE_INSTALL_ID_KEY)
  }

  return {
    installId,
    load,
    touchCurrentDevice,
    recordRestoreDevice,
    removeDevice,
    clearAll,
  }
}
