export type PublicCatalog = {
  name: string
  slug: string
  shortName: string
  category: string
  description: string
  accent: string
}

export const publicCatalogs: PublicCatalog[] = [
  {
    name: 'Mobile Legends',
    slug: 'mobile-legends',
    shortName: 'ML',
    category: 'Mobile Game',
    description: 'Diamond Mobile Legends',
    accent: '#38bdf8'
  },
  {
    name: 'Free Fire',
    slug: 'free-fire',
    shortName: 'FF',
    category: 'Mobile Game',
    description: 'Diamond Free Fire',
    accent: '#22c55e'
  },
  {
    name: 'PUBG Mobile',
    slug: 'pubg-mobile',
    shortName: 'PUBG',
    category: 'Mobile Game',
    description: 'UC PUBG Mobile',
    accent: '#60a5fa'
  },
  {
    name: 'Valorant',
    slug: 'valorant',
    shortName: 'VAL',
    category: 'PC Game',
    description: 'Valorant Points',
    accent: '#f43f5e'
  },
  {
    name: 'Genshin Impact',
    slug: 'genshin-impact',
    shortName: 'GI',
    category: 'Multi Platform',
    description: 'Genesis Crystals',
    accent: '#a78bfa'
  },
  {
    name: 'Delta Force',
    slug: 'delta-force',
    shortName: 'DF',
    category: 'Multi Platform',
    description: 'Delta Coins',
    accent: '#2dd4bf'
  }
]

export const findPublicCatalog = (slug: string) =>
  publicCatalogs.find(catalog => catalog.slug === slug)
