import type { InstagramGalleryPlan } from '../types'

export const INSTAGRAM_GALLERY_EMBED_TYPE = 'app.bsky.embed.gallery' as const
export const INSTAGRAM_GALLERY_MAX_ITEMS = 20

export function buildInstagramGalleryPlan(handle: string): InstagramGalleryPlan {
  const sourceHandle = normalizeInstagramHandle(handle)
  return {
    embedType: INSTAGRAM_GALLERY_EMBED_TYPE,
    sourceProvider: 'instagram',
    sourceHandle,
    status: 'planned',
    maxItems: INSTAGRAM_GALLERY_MAX_ITEMS,
    postStrategy: 'profile-gallery',
    summary:
      `When @${sourceHandle} connects Instagram media, iM8 will publish it as an app.bsky.embed.gallery record instead of compressing it into the four-image Bluesky embed.`,
  }
}

function normalizeInstagramHandle(handle: string): string {
  return handle.trim().replace(/^@/, '') || 'instagram'
}
