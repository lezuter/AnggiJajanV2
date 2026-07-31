import GameDetailClient from './GameDetailClient'

interface CatalogLike {
  slug?: unknown
}

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
).replace(/\/+$/, '')

const getConfiguredSlugs = () =>
  (process.env.NEXT_PUBLIC_STATIC_GAME_SLUGS || '')
    .split(',')
    .map(slug => slug.trim())
    .filter(Boolean)

const extractCatalogs = (payload: unknown): CatalogLike[] => {
  if (Array.isArray(payload)) return payload as CatalogLike[]
  if (!payload || typeof payload !== 'object') return []

  const data = payload as Record<string, unknown>

  if (Array.isArray(data.catalogs)) {
    return data.catalogs as CatalogLike[]
  }

  if (Array.isArray(data.data)) {
    return data.data as CatalogLike[]
  }

  return []
}

export const dynamicParams = false

export async function generateStaticParams () {
  const slugs = new Set(getConfiguredSlugs())

  try {
    const response = await fetch(`${API_BASE_URL}/catalogs`)

    if (response.ok) {
      const payload: unknown = await response.json()

      extractCatalogs(payload).forEach(catalog => {
        if (typeof catalog.slug === 'string' && catalog.slug.trim()) {
          slugs.add(catalog.slug.trim())
        }
      })
    } else {
      console.warn(
        `Tidak bisa mengambil katalog saat build: HTTP ${response.status}`
      )
    }
  } catch (error) {
    console.warn(
      'Backend katalog tidak dapat dihubungi saat build. Menggunakan NEXT_PUBLIC_STATIC_GAME_SLUGS.',
      error
    )
  }

  if (slugs.size === 0) {
    throw new Error(
      'Tidak ada slug game untuk static export. Jalankan backend saat npm run build atau isi NEXT_PUBLIC_STATIC_GAME_SLUGS di frontend/.env.local.'
    )
  }

  return Array.from(slugs).map(slug => ({ slug }))
}

export default async function GameDetailPage ({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return <GameDetailClient slug={slug} />
}