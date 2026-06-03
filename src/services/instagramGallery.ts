import type {
  AppBskyEmbedGallery,
  InstagramGalleryImageInput,
  InstagramGalleryPlan,
} from '../types'

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

export function buildInstagramGalleryEmbed(
  images: InstagramGalleryImageInput[]
): AppBskyEmbedGallery {
  return {
    $type: INSTAGRAM_GALLERY_EMBED_TYPE,
    items: images.slice(0, INSTAGRAM_GALLERY_MAX_ITEMS).map((image) => ({
      $type: 'app.bsky.embed.gallery#image',
      image: image.blob,
      alt: image.alt,
      aspectRatio: image.aspectRatio,
    })),
  }
}

function normalizeInstagramHandle(handle: string): string {
  return handle.trim().replace(/^@/, '') || 'instagram'
}
