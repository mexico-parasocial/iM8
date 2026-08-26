import { useCallback, useEffect, useRef, useState } from 'react'
import { getBackupState, type BackupState } from '../services/seedVault'

/**
 * Decides when to put the recovery ceremony in front of the user.
 *
 * Enrollment creates a seed and hands back a session, so the app would
 * otherwise walk straight into the console with an identity that exists on
 * exactly one device and nowhere else. Losing the phone at that point loses
 * every credential derived from it, permanently.
 *
 * So the prompt is raised once per launch while the backup is still pending.
 * It is not a hard block: a user cornered by a modal on first run tends to
 * abandon onboarding rather than fetch a pen, and an abandoned signup protects
 * nobody. Dismissing leaves the amber card in Settings, which keeps asking.
 */
export function useBackupPrompt(hasSession: boolean) {
  const [backup, setBackup] = useState<BackupState>('none')
  const [visible, setVisible] = useState(false)
  const promptedThisLaunch = useRef(false)

  const refresh = useCallback(async () => {
    try {
      const state = await getBackupState()
      setBackup(state)
      return state
    } catch {
      // No keystore on this platform — there is no seed to back up, so there
      // is nothing to prompt about.
      setBackup('none')
      return 'none' as BackupState
    }
  }, [])

  useEffect(() => {
    if (!hasSession) {
      promptedThisLaunch.current = false
      return
    }
    void refresh().then((state) => {
      if (state === 'pending' && !promptedThisLaunch.current) {
        promptedThisLaunch.current = true
        setVisible(true)
      }
    })
  }, [hasSession, refresh])

  return {
    backup,
    visible,
    dismiss: () => setVisible(false),
    onConfirmed: () => {
      setVisible(false)
      void refresh()
    },
  }
}
