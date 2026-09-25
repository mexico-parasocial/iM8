/**
 * Clipboard writes behind an injectable function so rows stay testable
 * under `tsx --test` without native modules. Production passes
 * `expo-clipboard`'s `setStringAsync`.
 *
 * Returns whether the write succeeded so callers can show "Copied" or
 * stay quiet — a failed copy must never look like a confirmed one.
 */
export async function copyText(
  write: (text: string) => Promise<unknown> | unknown,
  text: string,
): Promise<boolean> {
  try {
    await write(text)
    return true
  } catch {
    return false
  }
}
