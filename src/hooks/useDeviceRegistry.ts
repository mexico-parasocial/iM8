import { useCallback, useEffect, useMemo, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import {
  createDeviceRegistry,
  type KeyValueStore,
} from '../services/deviceRegistry'
import type { DeviceRecord } from '../types'

const asyncStorageStore: KeyValueStore = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
}

/** Touch this install's entry without subscribing to the list. */
export async function touchCurrentDevice(): Promise<void> {
  try {
    await createDeviceRegistry(asyncStorageStore).touchCurrentDevice(Platform.OS)
  } catch {
    // Registry writes must never break a bootstrap: the list is
    // informational, the session is not.
  }
}

/** Drop the whole registry, e.g. when the local identity leaves the device. */
export async function clearDeviceRegistry(): Promise<void> {
  try {
    await createDeviceRegistry(asyncStorageStore).clearAll()
  } catch {
    // Same as above: best effort only.
  }
}

export function useDeviceRegistry() {
  const [devices, setDevices] = useState<DeviceRecord[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const registry = useMemo(() => createDeviceRegistry(asyncStorageStore), [])

  const refresh = useCallback(async () => {
    try {
      const [loaded, install] = await Promise.all([
        registry.load(),
        registry.installId(),
      ])
      setDevices(loaded)
      setCurrentId(install)
    } catch {
      setDevices([])
    }
  }, [registry])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const removeDevice = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const result = await registry.removeDevice(id)
        setDevices(result.devices)
        return result.removed
      } catch {
        return false
      }
    },
    [registry],
  )

  const recordRestore = useCallback(async () => {
    try {
      setDevices(await registry.recordRestoreDevice(Platform.OS))
    } catch {
      // Restores already surface backup state; a missing device row is not fatal.
    }
  }, [registry])

  return { devices, currentId, refresh, removeDevice, recordRestore }
}
