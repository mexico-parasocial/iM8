/**
 * Followed civic interests per category, as stored on a surface override.
 *
 * The Edit-surface browser renders one Switch per interest; this module
 * owns the toggle math so it stays testable under `tsx --test` without
 * native modules. Maps are never mutated in place — every toggle returns
 * a new object, which is also what React state updates require.
 */

export type FollowedInterests = Record<string, string[]>

export function toggleInterestFollowed(
  followed: FollowedInterests,
  categoryId: string,
  interest: string,
): FollowedInterests {
  const current = followed[categoryId] ?? []
  const next = current.includes(interest)
    ? current.filter((item) => item !== interest)
    : [...current, interest]
  return { ...followed, [categoryId]: next }
}

export function countFollowedInterests(
  followed: FollowedInterests,
  categoryId: string,
  total: number,
): { active: number; total: number } {
  return { active: followed[categoryId]?.length ?? 0, total }
}

export function totalFollowedInterests(followed: FollowedInterests): number {
  return Object.values(followed).reduce((sum, list) => sum + list.length, 0)
}
