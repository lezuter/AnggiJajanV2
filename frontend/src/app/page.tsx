'use client'

import Link from 'next/link'
import { flushSync } from 'react-dom'
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import {
  animate,
  motion,
  type MotionValue,
  useMotionValue,
  useReducedMotion,
  useTransform
} from 'framer-motion'

import CatalogFilterCapsules, {
  type CatalogFilter,
  type CatalogFilterCounts
} from '@/components/CatalogFilterCapsules'
import CatalogSection from '@/components/CatalogSection'
import CatalogSuggestionBanner from '@/components/CatalogSuggestionBanner'
import CyberneticGridShader from '@/components/ui/cybernetic-grid-shader'
import Navbar from '@/components/Navbar'
import SiteFooter from '@/components/SiteFooter'
import type { HomepageCatalog } from '@/components/PublicCatalogCard'
import { publicCatalogs } from '@/data/publicCatalogs'

const liquidEase = [0.22, 1, 0.36, 1] as const
const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
).replace(/\/+$/, '')
const CATALOGS_API_URL = `${API_BASE_URL}${
  API_BASE_URL.endsWith('/api') ? '' : '/api'
}/catalogs`

interface ApiCatalog {
  cardcode: string
  name: string
  slug: string
  image_url: string
  category: string
  description?: string
  short_name?: string
  is_popular: boolean
  sort_order: number
  is_public: boolean
  is_active: boolean
}

const fallbackCatalogs: HomepageCatalog[] = publicCatalogs.map(
  (catalog, index) => ({
    cardcode: catalog.slug.toUpperCase(),
    name: catalog.name,
    slug: catalog.slug,
    imageUrl: '',
    category: 'game',
    description: catalog.description,
    shortName: catalog.shortName,
    isPopular: false,
    sortOrder: index + 1
  })
)

// TEMPORARY: dummy katalog untuk mengecek layout 3 kolom dan tombol View More.
// Ubah ke false atau hapus blok ini setelah pengujian selesai.
const ENABLE_VIEW_MORE_DEMO = true

const viewMoreDemoCatalogs: HomepageCatalog[] = Array.from(
  { length: 12 },
  (_, index) => {
    const number = String(index + 1).padStart(2, '0')

    return {
      cardcode: `DEMO-${number}`,
      name: `Demo Game ${number}`,
      slug: `demo-game-${number}`,
      imageUrl: '',
      category: 'game',
      description: 'Data sementara untuk menguji animasi View More.',
      shortName: number,
      isPopular: index < 8,
      sortOrder: 900 + index
    }
  }
)

function appendViewMoreDemoCatalogs (
  sourceCatalogs: HomepageCatalog[]
): HomepageCatalog[] {
  if (!ENABLE_VIEW_MORE_DEMO) return sourceCatalogs

  const existingSlugs = new Set(sourceCatalogs.map(catalog => catalog.slug))

  return [
    ...sourceCatalogs,
    ...viewMoreDemoCatalogs.filter(catalog => !existingSlugs.has(catalog.slug))
  ]
}

function isApiCatalog (value: unknown): value is ApiCatalog {
  if (typeof value !== 'object' || value === null) return false

  const catalog = value as Record<string, unknown>

  return (
    typeof catalog.cardcode === 'string' &&
    typeof catalog.name === 'string' &&
    catalog.name.trim().length > 0 &&
    typeof catalog.slug === 'string' &&
    catalog.slug.trim().length > 0 &&
    typeof catalog.image_url === 'string' &&
    typeof catalog.category === 'string' &&
    typeof catalog.is_popular === 'boolean' &&
    typeof catalog.sort_order === 'number' &&
    Number.isFinite(catalog.sort_order) &&
    typeof catalog.is_public === 'boolean' &&
    typeof catalog.is_active === 'boolean'
  )
}

function normalizeApiCatalog (apiCatalog: ApiCatalog): HomepageCatalog {
  const metadata = publicCatalogs.find(item => item.slug === apiCatalog.slug)

  return {
    cardcode: apiCatalog.cardcode,
    name: apiCatalog.name,
    slug: apiCatalog.slug,
    imageUrl: apiCatalog.image_url.trim(),
    category: apiCatalog.category.trim().toLowerCase(),
    isPopular: apiCatalog.is_popular,
    sortOrder: apiCatalog.sort_order,
    description:
      apiCatalog.description?.trim()
        ? apiCatalog.description
        : metadata?.description ?? '',
    shortName:
      apiCatalog.short_name?.trim() ||
      metadata?.shortName ||
      apiCatalog.name.trim().slice(0, 2).toUpperCase()
  }
}

const catalogFilterSectionCopy: Record<
  Exclude<CatalogFilter, 'all'>,
  { title: string; eyebrow: string }
> = {
  popular: { title: 'POPULER', eyebrow: 'Pilihan pengguna' },
  game: { title: 'GAMES', eyebrow: 'Katalog' },
  'pulsa-data': { title: 'PULSA & DATA', eyebrow: 'Digital' }
}

interface HeroSlide {
  eyebrow: string
  title: string
  description: string
  meta: string
  href: string
  action: string
}

const heroSlides: HeroSlide[] = [
  {
    eyebrow: 'Anggijajan preview',
    title: 'Top Up Game Tanpa Ribet',
    description:
      'Katalog game sudah bisa dibuka untuk preview. Checkout akan aktif setelah layanan publik dibuka.',
    meta: 'Purchase locked',
    href: '#catalog',
    action: 'Lihat katalog'
  },
  {
    eyebrow: 'Status layanan',
    title: 'Pembelian Online Sedang Ditutup',
    description:
      'Website sedang dalam tahap finalisasi. Semua tombol checkout tetap dikunci sampai sistem pembayaran siap.',
    meta: 'Finalisasi',
    href: '/cek-pesanan/',
    action: 'Cek pesanan'
  },
  {
    eyebrow: 'Katalog awal',
    title: 'Mobile Legends, Free Fire, Valorant',
    description:
      'Dummy catalog tetap dipakai sebagai sumber preview agar storefront tidak bergantung ke backend saat pembelian dimatikan.',
    meta: 'Static catalog',
    href: '#catalog',
    action: 'Browse game'
  }
]

function CarouselLightSurface () {
  return (
    <div
      aria-hidden='true'
      className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_14%_4%,rgba(168,85,247,0.13)_0%,rgba(168,85,247,0.032)_34%,transparent_62%),radial-gradient(ellipse_at_90%_100%,rgba(59,130,246,0.12)_0%,rgba(59,130,246,0.03)_36%,transparent_64%)] mix-blend-screen'
    />
  )
}

interface CarouselDotProps {
  dotIndex: number
  activeSlide: number
  slideCount: number
  swipeX: MotionValue<number>
  morphDistance: number
  shouldReduceMotion: boolean | null
  onClick: () => void
  label: string
}

function CarouselDot ({
  dotIndex,
  activeSlide,
  slideCount,
  swipeX,
  morphDistance,
  shouldReduceMotion,
  onClick,
  label
}: CarouselDotProps) {
  const width = useTransform(swipeX, value => {
    if (shouldReduceMotion || morphDistance <= 0) {
      return dotIndex === activeSlide ? 32 : 10
    }

    const forwardProgress = clamp01(-value / morphDistance)
    const backwardProgress = clamp01(value / morphDistance)
    const nextIndex = (activeSlide + 1) % slideCount
    const previousIndex = (activeSlide - 1 + slideCount) % slideCount
    const activeProgress = Math.max(forwardProgress, backwardProgress)

    if (dotIndex === activeSlide) return 32 - 22 * activeProgress
    if (dotIndex === nextIndex) return 10 + 22 * forwardProgress
    if (dotIndex === previousIndex) return 10 + 22 * backwardProgress

    return 10
  })

  const opacity = useTransform(swipeX, value => {
    if (shouldReduceMotion || morphDistance <= 0) {
      return dotIndex === activeSlide ? 1 : 0.32
    }

    const forwardProgress = clamp01(-value / morphDistance)
    const backwardProgress = clamp01(value / morphDistance)
    const nextIndex = (activeSlide + 1) % slideCount
    const previousIndex = (activeSlide - 1 + slideCount) % slideCount
    const activeProgress = Math.max(forwardProgress, backwardProgress)

    if (dotIndex === activeSlide) return 1 - 0.68 * activeProgress
    if (dotIndex === nextIndex) return 0.32 + 0.68 * forwardProgress
    if (dotIndex === previousIndex) return 0.32 + 0.68 * backwardProgress

    return 0.32
  })

  return (
    <motion.button
      type='button'
      onClick={onClick}
      style={{ width, opacity }}
      whileHover={shouldReduceMotion ? undefined : { scale: 1.08 }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
      className='h-2.5 shrink-0 rounded-full bg-white outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black'
      aria-label={label}
      aria-current={dotIndex === activeSlide ? 'true' : undefined}
    />
  )
}

interface AutoFitHeroTitleProps {
  text: string
}

function getHeroTitleSizeRange () {
  const viewportWidth = window.innerWidth

  if (viewportWidth >= 1280) return { min: 60, max: 98 }
  if (viewportWidth >= 1024) return { min: 54, max: 88 }
  if (viewportWidth >= 768) return { min: 46, max: 72 }
  if (viewportWidth >= 640) return { min: 38, max: 58 }

  return { min: 30, max: 42 }
}

function AutoFitHeroTitle ({ text }: AutoFitHeroTitleProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)

  const fitTitle = useCallback(() => {
    const container = containerRef.current
    const title = titleRef.current

    if (!container || !title) return

    const { min, max } = getHeroTitleSizeRange()
    let smallest = min
    let largest = max
    let bestFit = min

    while (smallest <= largest) {
      const candidate = Math.floor((smallest + largest) / 2)
      title.style.fontSize = `${candidate}px`

      const computedStyle = window.getComputedStyle(title)
      const lineHeight = Number.parseFloat(computedStyle.lineHeight)
      const lineCount =
        Number.isFinite(lineHeight) && lineHeight > 0
          ? Math.round(title.scrollHeight / lineHeight)
          : 1

      // Jangan hanya mengecek overflow teknis. Sisakan ruang aman supaya
      // glyph, line-height, dan panel kanan tidak terlihat saling menabrak.
      const fitsHeight = title.scrollHeight <= container.clientHeight - 10
      const fitsWidth = title.scrollWidth <= container.clientWidth + 1
      const fitsLineLimit = lineCount <= 3

      if (fitsHeight && fitsWidth && fitsLineLimit) {
        bestFit = candidate
        smallest = candidate + 1
      } else {
        largest = candidate - 1
      }
    }

    title.style.fontSize = `${bestFit}px`
  }, [])

  useLayoutEffect(() => {
    fitTitle()

    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver(fitTitle)
    resizeObserver.observe(container)

    void document.fonts?.ready.then(fitTitle)

    return () => resizeObserver.disconnect()
  }, [fitTitle, text])

  return (
    <div
      ref={containerRef}
      className='mt-3 h-[140px] min-w-0 overflow-hidden sm:mt-4 sm:h-[168px] md:h-[184px] lg:h-[196px] xl:h-[206px]'
    >
      <h1
        ref={titleRef}
        className='max-w-4xl text-balance break-words font-medium leading-[1.02] tracking-[-0.045em] text-white text-[42px] sm:text-[58px] md:text-[72px] lg:text-[88px] xl:text-[98px]'
      >
        {text}
      </h1>
    </div>
  )
}

interface HeroSlideFullContentProps {
  slide: HeroSlide
  index: number
}

function HeroSlideFullContent ({ slide, index }: HeroSlideFullContentProps) {
  return (
    <div className='relative z-10 grid h-full min-w-0 gap-6 p-6 pb-14 sm:p-8 sm:pb-16 lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-8 lg:px-9 lg:pb-16 lg:pt-10'>
      <div className='min-w-0 lg:pr-3'>
        <p className='font-mono text-[11px] uppercase tracking-[0.08em] text-white/[0.58] sm:text-xs'>
          {slide.eyebrow}
        </p>

        <AutoFitHeroTitle text={slide.title} />

        <p className='mt-5 max-w-2xl text-sm leading-6 text-white/[0.66] sm:mt-6 sm:text-base sm:leading-7'>
          {slide.description}
        </p>
      </div>

      <div className='grid min-w-0 grid-cols-1 items-stretch gap-3 sm:grid-cols-[minmax(0,1fr)_auto] lg:flex lg:h-full lg:flex-col lg:justify-end lg:gap-4'>
        <div className='rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3 backdrop-blur-md sm:p-4'>
          <p className='font-mono text-[10px] uppercase tracking-[0.08em] text-white/[0.5] sm:text-[11px]'>
            Slide {String(index + 1).padStart(2, '0')}
          </p>

          <p className='mt-2 text-lg leading-[1.05] tracking-tight text-white sm:mt-3 sm:text-[24px]'>
            {slide.meta}
          </p>
        </div>

        <Link
          href={slide.href}
          className='inline-flex min-h-12 w-full items-center justify-center rounded-full bg-white px-5 font-mono text-[11px] uppercase tracking-[0.08em] text-[#141414] transition-colors hover:bg-white/[0.84] sm:w-auto sm:px-6 sm:text-xs lg:w-full'
        >
          {slide.action}
        </Link>
      </div>
    </div>
  )
}

export default function HomePage () {
  const [search, setSearch] = useState('')
  const [activeCatalogFilter, setActiveCatalogFilter] =
    useState<CatalogFilter>('all')
  const [activeSlide, setActiveSlide] = useState(0)
  const [catalogs, setCatalogs] = useState<HomepageCatalog[]>([])
  const [isCatalogLoading, setIsCatalogLoading] = useState(true)
  const [isCarouselHovered, setIsCarouselHovered] = useState(false)
  const [hasCarouselFocus, setHasCarouselFocus] = useState(false)
  const [isCarouselDragging, setIsCarouselDragging] = useState(false)
  const [carouselWidth, setCarouselWidth] = useState(0)
  const catalogRef = useRef<HTMLDivElement>(null)
  const carouselTrackRef = useRef<HTMLDivElement>(null)
  const isSnappingRef = useRef(false)
  const carouselAnimationRef = useRef<{ stop: () => void } | null>(null)
  const swipeX = useMotionValue(0)
  const shouldReduceMotion = useReducedMotion()
  const hasActiveSearch = search.trim().length > 0
  const isCarouselPaused =
    isCarouselHovered || hasCarouselFocus || isCarouselDragging

  const previousPreviousSlideIndex =
    (activeSlide - 2 + heroSlides.length) % heroSlides.length
  const previousSlideIndex =
    (activeSlide - 1 + heroSlides.length) % heroSlides.length
  const nextSlideIndex = (activeSlide + 1) % heroSlides.length
  const nextNextSlideIndex = (activeSlide + 2) % heroSlides.length

  // Compact: LARGE + SMALL. Lebar: SMALL + LARGE + SMALL.
  // Dua slot tambahan tetap dirender di luar viewport agar preview pengganti
  // sudah tersedia selama animasi snap berlangsung.
  const showBothPeeks = carouselWidth >= 640
  const smallItemWidth = showBothPeeks ? 56 : 48
  const itemGap = showBothPeeks ? 16 : 12
  const visibleSmallItemCount = showBothPeeks ? 2 : 1
  const largeItemWidth = Math.max(
    0,
    carouselWidth -
      smallItemWidth * visibleSmallItemCount -
      itemGap * visibleSmallItemCount
  )
  const morphDistance = Math.max(140, carouselWidth * 0.28)
  const itemWidthDelta = Math.max(0, largeItemWidth - smallItemWidth)
  const swipeThreshold = Math.min(96, Math.max(56, morphDistance * 0.22))

  const previousItemWidth = useTransform(swipeX, value => {
    const progress = clamp01(value / morphDistance)
    return smallItemWidth + itemWidthDelta * progress
  })

  const activeItemWidth = useTransform(swipeX, value => {
    const progress = clamp01(Math.abs(value) / morphDistance)
    return largeItemWidth - itemWidthDelta * progress
  })

  const nextItemWidth = useTransform(swipeX, value => {
    const progress = clamp01(-value / morphDistance)
    return smallItemWidth + itemWidthDelta * progress
  })

  const previousItemRadius = useTransform(swipeX, value => {
    const progress = clamp01(value / morphDistance)
    return 24 + 4 * progress
  })

  const activeItemRadius = useTransform(swipeX, value => {
    const progress = clamp01(Math.abs(value) / morphDistance)
    return 28 - 4 * progress
  })

  const nextItemRadius = useTransform(swipeX, value => {
    const progress = clamp01(-value / morphDistance)
    return 24 + 4 * progress
  })

  const carouselTrackX = useTransform(swipeX, value => {
    // Pada layout lebar, previous dimulai tepat di sisi kiri viewport.
    // Pada compact, previous disembunyikan sehingga active dimulai dari kiri.
    const restingOffset = showBothPeeks
      ? -(smallItemWidth + itemGap)
      : -2 * (smallItemWidth + itemGap)

    if (value < 0) {
      return (
        restingOffset -
        clamp01(-value / morphDistance) * (smallItemWidth + itemGap)
      )
    }

    if (value > 0) {
      return (
        restingOffset +
        clamp01(value / morphDistance) * (smallItemWidth + itemGap)
      )
    }

    return restingOffset
  })

  const activeContentOpacity = useTransform(swipeX, value => {
    const progress = clamp01(Math.abs(value) / morphDistance)
    return 1 - clamp01(progress / 0.55)
  })
  const activePreviewOpacity = useTransform(swipeX, value => {
    const progress = clamp01(Math.abs(value) / morphDistance)
    return clamp01((progress - 0.45) / 0.55)
  })
  const previousContentOpacity = useTransform(swipeX, value => {
    const progress = clamp01(value / morphDistance)
    return clamp01((progress - 0.35) / 0.65)
  })
  const previousPreviewOpacity = useTransform(swipeX, value => {
    const progress = clamp01(value / morphDistance)
    return 1 - clamp01(progress / 0.45)
  })
  const nextContentOpacity = useTransform(swipeX, value => {
    const progress = clamp01(-value / morphDistance)
    return clamp01((progress - 0.35) / 0.65)
  })
  const nextPreviewOpacity = useTransform(swipeX, value => {
    const progress = clamp01(-value / morphDistance)
    return 1 - clamp01(progress / 0.45)
  })

  const popularCatalogs = useMemo(
    () => catalogs.filter(catalog => catalog.isPopular),
    [catalogs]
  )

  const gameCatalogs = useMemo(
    () => catalogs.filter(catalog => catalog.category === 'game'),
    [catalogs]
  )

  const pulsaDataCatalogs = useMemo(
    () =>
      catalogs.filter(
        catalog =>
          catalog.category === 'pulsa-data' || catalog.category === 'pulsa_data'
      ),
    [catalogs]
  )

  const catalogFilterCounts = useMemo<CatalogFilterCounts>(
    () => ({
      all: catalogs.length,
      popular: popularCatalogs.length,
      game: gameCatalogs.length,
      'pulsa-data': pulsaDataCatalogs.length
    }),
    [
      catalogs.length,
      gameCatalogs.length,
      popularCatalogs.length,
      pulsaDataCatalogs.length
    ]
  )

  const activeFilterCatalogs = useMemo(() => {
    switch (activeCatalogFilter) {
      case 'popular':
        return popularCatalogs
      case 'game':
        return gameCatalogs
      case 'pulsa-data':
        return pulsaDataCatalogs
      default:
        return catalogs
    }
  }, [
    activeCatalogFilter,
    catalogs,
    gameCatalogs,
    popularCatalogs,
    pulsaDataCatalogs
  ])

  const filteredCatalogs = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return activeFilterCatalogs

    return activeFilterCatalogs.filter(catalog =>
      [catalog.name, catalog.category, catalog.description].some(value =>
        value.toLowerCase().includes(keyword)
      )
    )
  }, [activeFilterCatalogs, search])

  const activeFilterSection =
    activeCatalogFilter === 'all'
      ? null
      : catalogFilterSectionCopy[activeCatalogFilter]

  useEffect(() => {
    if (isCatalogLoading || activeCatalogFilter === 'all') return
    if (catalogFilterCounts[activeCatalogFilter] > 0) return

    setActiveCatalogFilter('all')
  }, [activeCatalogFilter, catalogFilterCounts, isCatalogLoading])

  useEffect(() => {
    if (isCatalogLoading || !hasActiveSearch) return

    const scrollTimer = window.setTimeout(() => {
      catalogRef.current?.scrollIntoView({
        behavior: shouldReduceMotion ? 'auto' : 'smooth',
        block: 'start'
      })
    }, 220)

    return () => window.clearTimeout(scrollTimer)
  }, [hasActiveSearch, isCatalogLoading, shouldReduceMotion])

  useEffect(() => {
    const controller = new AbortController()

    async function loadCatalogs () {
      try {
        const response = await fetch(CATALOGS_API_URL, {
          cache: 'no-store',
          signal: controller.signal
        })

        if (!response.ok) {
          throw new Error(`Catalog API returned ${response.status}`)
        }

        const payload: unknown = await response.json()

        if (!Array.isArray(payload)) {
          throw new Error('Catalog API response is not an array')
        }

        const apiCatalogs = payload.filter(isApiCatalog)

        if (apiCatalogs.length !== payload.length) {
          throw new Error('Catalog API response contains invalid items')
        }

        const normalizedCatalogs = apiCatalogs
          .filter(catalog => catalog.is_active && catalog.is_public)
          .map(normalizeApiCatalog)
          .sort((a, b) => {
            if (a.sortOrder !== b.sortOrder) {
              return a.sortOrder - b.sortOrder
            }

            return a.name.localeCompare(b.name)
          })

        setCatalogs(appendViewMoreDemoCatalogs(normalizedCatalogs))
      } catch (error) {
        if (controller.signal.aborted) return

        console.error('Gagal memuat katalog aktif:', error)
        setCatalogs(appendViewMoreDemoCatalogs(fallbackCatalogs))
      } finally {
        if (!controller.signal.aborted) setIsCatalogLoading(false)
      }
    }

    loadCatalogs()

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const carouselNode = carouselTrackRef.current
    if (!carouselNode) return

    const updateCarouselWidth = () => {
      setCarouselWidth(carouselNode.clientWidth)
    }

    const resizeObserver = new ResizeObserver(updateCarouselWidth)
    resizeObserver.observe(carouselNode)
    updateCarouselWidth()

    return () => resizeObserver.disconnect()
  }, [])

  const snapCarousel = useCallback(
    (direction: 1 | -1) => {
      if (isSnappingRef.current || carouselWidth <= 0) return

      const targetSlide =
        (activeSlide + direction + heroSlides.length) % heroSlides.length

      const commitSlide = () => {
        // Reset progress sebelum slot di-map ke slide baru. Kalau state diganti
        // lebih dulu, satu frame dapat memakai index baru dengan progress lama
        // dan terlihat seperti blink.
        carouselAnimationRef.current = null
        swipeX.set(0)

        flushSync(() => {
          setActiveSlide(targetSlide)
        })

        isSnappingRef.current = false
        setIsCarouselDragging(false)
      }

      if (shouldReduceMotion) {
        commitSlide()
        return
      }

      carouselAnimationRef.current?.stop()
      isSnappingRef.current = true
      setIsCarouselDragging(true)

      carouselAnimationRef.current = animate(
        swipeX,
        direction === 1 ? -morphDistance : morphDistance,
        {
          duration: 0.5,
          ease: liquidEase,
          onComplete: commitSlide
        }
      )
    },
    [activeSlide, carouselWidth, morphDistance, shouldReduceMotion, swipeX]
  )

  const resetCarouselPosition = useCallback(() => {
    if (isSnappingRef.current) return

    if (shouldReduceMotion) {
      swipeX.set(0)
      setIsCarouselDragging(false)
      return
    }

    carouselAnimationRef.current?.stop()
    carouselAnimationRef.current = animate(swipeX, 0, {
      duration: 0.34,
      ease: liquidEase,
      onComplete: () => {
        carouselAnimationRef.current = null
        setIsCarouselDragging(false)
      }
    })
  }, [shouldReduceMotion, swipeX])

  const goToSlide = useCallback(
    (targetIndex: number) => {
      const normalizedIndex =
        (targetIndex + heroSlides.length) % heroSlides.length

      if (normalizedIndex === activeSlide) return

      const forwardDistance =
        (normalizedIndex - activeSlide + heroSlides.length) % heroSlides.length

      snapCarousel(forwardDistance <= heroSlides.length / 2 ? 1 : -1)
    },
    [activeSlide, snapCarousel]
  )

  useEffect(() => {
    if (isCarouselPaused || shouldReduceMotion) return

    const timer = window.setTimeout(() => {
      snapCarousel(1)
    }, 5200)

    return () => window.clearTimeout(timer)
  }, [activeSlide, isCarouselPaused, shouldReduceMotion, snapCarousel])

  useEffect(() => {
    return () => carouselAnimationRef.current?.stop()
  }, [])

  const handleCarouselKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      snapCarousel(1)
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      snapCarousel(-1)
    }
  }

  return (
    <div className='relative isolate w-full overflow-x-clip bg-black text-white'>
      <div className='relative z-50'>
        <Navbar showSearch searchValue={search} onSearchChange={setSearch} />
      </div>

      <main className='relative z-10 isolate min-h-screen w-full overflow-x-clip rounded-b-[30px] bg-black sm:rounded-b-[38px]'>
        {/* Grid hanya hidup di area atas/hero, lalu melebur halus ke hitam. */}
        <div className='pointer-events-none absolute inset-x-0 top-0 -z-20 h-[calc(100svh+220px)] min-h-[860px] max-h-[1120px] overflow-hidden'>
          <CyberneticGridShader />

          <div className='absolute inset-0 bg-[radial-gradient(circle_at_50%_34%,transparent_0%,rgba(0,0,0,0.16)_52%,rgba(0,0,0,0.68)_100%)]' />
          <div className='absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-b from-transparent via-black/[0.72] to-black' />
        </div>

        {/* Bagian katalog tidak memakai grid; hanya ambient glow yang sangat lembut. */}
        <div className='pointer-events-none absolute inset-x-0 top-[72vh] bottom-0 -z-10 overflow-hidden'>
          <motion.div
            aria-hidden='true'
            className='absolute -left-44 top-72 h-[430px] w-[430px] rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.14)_0%,rgba(168,85,247,0.045)_44%,transparent_72%)] blur-[92px]'
            animate={
              shouldReduceMotion
                ? undefined
                : {
                    x: [0, 44, 0],
                    y: [0, -18, 0],
                    opacity: [0.46, 0.68, 0.46]
                  }
            }
            transition={{
              duration: 18,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          />

          <motion.div
            aria-hidden='true'
            className='absolute -right-48 top-[620px] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.12)_0%,rgba(59,130,246,0.04)_46%,transparent_74%)] blur-[108px]'
            animate={
              shouldReduceMotion
                ? undefined
                : {
                    x: [0, -52, 0],
                    y: [0, 24, 0],
                    opacity: [0.4, 0.62, 0.4]
                  }
            }
            transition={{
              duration: 22,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 1.5
            }}
          />
        </div>

        <section className='relative mx-auto flex min-h-screen max-w-6xl flex-col justify-end px-4 pb-6 pt-28 md:px-6 md:pb-8'>
          <div
            className='relative min-w-0 w-full'
            onMouseEnter={() => setIsCarouselHovered(true)}
            onMouseLeave={() => setIsCarouselHovered(false)}
            onFocusCapture={() => setHasCarouselFocus(true)}
            onBlurCapture={event => {
              if (
                !event.currentTarget.contains(
                  event.relatedTarget as Node | null
                )
              ) {
                setHasCarouselFocus(false)
              }
            }}
          >
            <div className='w-full min-w-0 overflow-hidden'>
              <motion.div
                ref={carouselTrackRef}
                role='region'
                aria-roledescription='carousel'
                aria-label='Sorotan Anggijajan'
                tabIndex={0}
                onKeyDown={handleCarouselKeyDown}
                onPointerDown={() => {
                  window.getSelection()?.removeAllRanges()
                }}
                onClickCapture={event => {
                  if (isCarouselDragging || isSnappingRef.current) {
                    event.preventDefault()
                    event.stopPropagation()
                  }
                }}
                onWheel={event => {
                  if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return
                  if (Math.abs(event.deltaX) < 24) return

                  event.preventDefault()
                  snapCarousel(event.deltaX > 0 ? 1 : -1)
                }}
                onPanStart={() => {
                  if (isSnappingRef.current) return
                  carouselAnimationRef.current?.stop()
                  carouselAnimationRef.current = null
                  setIsCarouselDragging(true)
                }}
                onPan={(_, info) => {
                  if (isSnappingRef.current || carouselWidth <= 0) return

                  swipeX.set(
                    Math.max(
                      -morphDistance,
                      Math.min(morphDistance, info.offset.x)
                    )
                  )
                }}
                onPanEnd={(_, info) => {
                  if (isSnappingRef.current) return

                  const swipeIntent = info.offset.x + info.velocity.x * 0.14

                  if (swipeIntent <= -swipeThreshold) {
                    snapCarousel(1)
                    return
                  }

                  if (swipeIntent >= swipeThreshold) {
                    snapCarousel(-1)
                    return
                  }

                  resetCarouselPosition()
                }}
                className='relative h-[580px] w-full min-w-0 cursor-grab touch-pan-y select-none overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-white/60 active:cursor-grabbing sm:h-[540px] md:h-[500px] lg:h-[430px]'
              >
                {carouselWidth > 0 && (
                  <motion.div
                    className='absolute inset-y-0 left-0 flex'
                    style={{ x: carouselTrackX, gap: `${itemGap}px` }}
                  >
                    {[
                      {
                        slot: 'previousPrevious',
                        index: previousPreviousSlideIndex,
                        direction: -1 as const,
                        width: smallItemWidth,
                        radius: 24,
                        contentOpacity: 0,
                        previewOpacity: 1
                      },
                      {
                        slot: 'previous',
                        index: previousSlideIndex,
                        direction: -1 as const,
                        width: previousItemWidth,
                        radius: previousItemRadius,
                        contentOpacity: previousContentOpacity,
                        previewOpacity: previousPreviewOpacity
                      },
                      {
                        slot: 'active',
                        index: activeSlide,
                        direction: 0 as const,
                        width: activeItemWidth,
                        radius: activeItemRadius,
                        contentOpacity: activeContentOpacity,
                        previewOpacity: activePreviewOpacity
                      },
                      {
                        slot: 'next',
                        index: nextSlideIndex,
                        direction: 1 as const,
                        width: nextItemWidth,
                        radius: nextItemRadius,
                        contentOpacity: nextContentOpacity,
                        previewOpacity: nextPreviewOpacity
                      },
                      {
                        slot: 'nextNext',
                        index: nextNextSlideIndex,
                        direction: 1 as const,
                        width: smallItemWidth,
                        radius: 24,
                        contentOpacity: 0,
                        previewOpacity: 1
                      }
                    ].map(item => {
                      const slide = heroSlides[item.index]
                      const isActiveItem = item.slot === 'active'
                      const isVisiblePreview =
                        item.slot === 'next' ||
                        (showBothPeeks && item.slot === 'previous')
                      const isHiddenEdgeItem =
                        item.slot === 'previousPrevious' ||
                        item.slot === 'nextNext' ||
                        (!showBothPeeks && item.slot === 'previous')

                      return (
                        <motion.article
                          key={item.slot}
                          role='group'
                          aria-roledescription='slide'
                          aria-label={`Slide ${item.index + 1} dari ${
                            heroSlides.length
                          }`}
                          aria-current={isActiveItem ? 'true' : undefined}
                          aria-hidden={isHiddenEdgeItem ? 'true' : undefined}
                          className='relative h-full shrink-0 overflow-hidden border border-white/[0.08] bg-black/[0.035] shadow-[0_22px_70px_rgba(0,0,0,0.22)] backdrop-blur-md backdrop-saturate-150'
                          style={{
                            width: item.width,
                            borderRadius: item.radius
                          }}
                        >
                          <CarouselLightSurface />

                          {isActiveItem && !shouldReduceMotion && (
                            <motion.div
                              aria-hidden='true'
                              className='pointer-events-none absolute -bottom-1/2 -top-1/2 left-[-32%] z-[2] w-[48%] bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.15)_0%,rgba(59,130,246,0.085)_44%,transparent_72%)] blur-3xl mix-blend-screen'
                              initial={{ x: '-30%', opacity: 0, scaleX: 0.75 }}
                              animate={{
                                x: ['-30%', '80%', '230%', '340%'],
                                opacity: [0, 0.3, 0.09, 0],
                                scaleX: [0.75, 1.18, 1.32, 0.9]
                              }}
                              transition={{
                                duration: 0.92,
                                ease: liquidEase,
                                times: [0, 0.18, 0.68, 1]
                              }}
                            />
                          )}

                          <motion.div
                            aria-hidden={!isActiveItem}
                            className='absolute inset-0 h-full overflow-hidden'
                            style={{
                              opacity: item.contentOpacity,
                              pointerEvents: isActiveItem ? 'auto' : 'none'
                            }}
                          >
                            <HeroSlideFullContent
                              slide={slide}
                              index={item.index}
                            />
                          </motion.div>

                          {isActiveItem ? (
                            <motion.div
                              aria-hidden='true'
                              className='pointer-events-none absolute inset-0 z-10 flex items-start justify-center px-2 pt-5 text-center sm:px-3 sm:pt-6'
                              style={{ opacity: item.previewOpacity }}
                            >
                              <span className='font-mono text-[9px] uppercase tracking-[0.08em] text-white/[0.62] sm:text-[10px]'>
                                {String(item.index + 1).padStart(2, '0')}
                              </span>
                            </motion.div>
                          ) : isVisiblePreview ? (
                            <motion.button
                              type='button'
                              onClick={() => {
                                if (item.direction === 0) return

                                snapCarousel(item.direction)
                                window.requestAnimationFrame(() => {
                                  carouselTrackRef.current?.focus({
                                    preventScroll: true
                                  })
                                })
                              }}
                              className='absolute inset-0 z-10 flex h-full w-full items-start justify-center px-2 pt-5 text-center sm:px-3 sm:pt-6'
                              style={{ opacity: item.previewOpacity }}
                              aria-label={`Buka slide ${item.index + 1}: ${
                                slide.title
                              }`}
                            >
                              <span className='font-mono text-[9px] uppercase tracking-[0.08em] text-white/[0.62] sm:text-[10px]'>
                                {String(item.index + 1).padStart(2, '0')}
                              </span>
                            </motion.button>
                          ) : (
                            <motion.div
                              aria-hidden='true'
                              className='pointer-events-none absolute inset-0 z-10 flex h-full w-full items-start justify-center px-2 pt-5 text-center sm:px-3 sm:pt-6'
                              style={{ opacity: item.previewOpacity }}
                            >
                              <span className='font-mono text-[9px] uppercase tracking-[0.08em] text-white/[0.62] sm:text-[10px]'>
                                {String(item.index + 1).padStart(2, '0')}
                              </span>
                            </motion.div>
                          )}
                        </motion.article>
                      )
                    })}
                  </motion.div>
                )}

                <div className='absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2'>
                  {heroSlides.map((dotSlide, dotIndex) => (
                    <CarouselDot
                      key={dotSlide.title}
                      dotIndex={dotIndex}
                      activeSlide={activeSlide}
                      slideCount={heroSlides.length}
                      swipeX={swipeX}
                      morphDistance={morphDistance}
                      shouldReduceMotion={shouldReduceMotion}
                      onClick={() => {
                        goToSlide(dotIndex)
                        window.requestAnimationFrame(() => {
                          carouselTrackRef.current?.focus({
                            preventScroll: true
                          })
                        })
                      }}
                      label={`Buka slide ${dotIndex + 1}`}
                    />
                  ))}
                </div>
              </motion.div>
            </div>

            <p
              className='sr-only'
              aria-live={
                shouldReduceMotion || isCarouselPaused ? 'polite' : 'off'
              }
              aria-atomic='true'
            >
              Slide {activeSlide + 1} dari {heroSlides.length}:{' '}
              {heroSlides[activeSlide].title}
            </p>
          </div>

          <div className='mt-10 sm:mt-12'>
            <CatalogFilterCapsules
              activeFilter={activeCatalogFilter}
              counts={catalogFilterCounts}
              isLoading={isCatalogLoading}
              onFilterChange={setActiveCatalogFilter}
            />
          </div>

          <div
            ref={catalogRef}
            id='catalog'
            aria-busy={isCatalogLoading}
            className={`mt-7 scroll-mt-28 sm:mt-8 ${
              hasActiveSearch ? 'min-h-[calc(100svh-7rem)]' : ''
            }`}
          >
            {isCatalogLoading ? (
              <div className='grid grid-cols-3 content-start items-stretch gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-5 lg:gap-4'>
                {Array.from({ length: 10 }, (_, index) => {
                  const visibilityClass =
                    index < 6
                      ? ''
                      : index < 8
                      ? 'hidden sm:block'
                      : 'hidden lg:block'

                  return (
                    <div
                      key={`catalog-skeleton-${index}`}
                      aria-hidden='true'
                      className={`${visibilityClass} aspect-[4/5] animate-pulse rounded-[18px] border border-white/[0.06] bg-white/[0.045] shadow-[0_18px_50px_rgba(0,0,0,0.12)] [animation-duration:2.4s]`}
                    />
                  )
                })}
              </div>
            ) : filteredCatalogs.length === 0 ? (
              <div className='rounded-[22px] border border-white/[0.08] bg-white/[0.025] px-5 py-12 text-center backdrop-blur-xl sm:px-8 sm:py-16'>
                <p className='font-mono text-[10px] uppercase tracking-[0.1em] text-white/[0.48] sm:text-[11px]'>
                  Katalog tidak ditemukan
                </p>
                <p className='mx-auto mt-3 max-w-md text-sm leading-6 text-white/[0.68] sm:text-base'>
                  Coba pilih filter lain atau gunakan kata pencarian yang lebih
                  umum.
                </p>
              </div>
            ) : hasActiveSearch ? (
              <CatalogSection
                title='HASIL PENCARIAN'
                items={filteredCatalogs}
              />
            ) : activeFilterSection ? (
              <CatalogSection
                title={activeFilterSection.title}
                eyebrow={activeFilterSection.eyebrow}
                items={filteredCatalogs}
              />
            ) : (
              <div className='space-y-12 sm:space-y-14'>
                {popularCatalogs.length > 0 && (
                  <CatalogSection
                    title='POPULER'
                    eyebrow='Pilihan pengguna'
                    items={popularCatalogs}
                  />
                )}

                {gameCatalogs.length > 0 && (
                  <CatalogSection
                    title='GAMES'
                    eyebrow='Katalog'
                    items={gameCatalogs}
                  />
                )}

                {pulsaDataCatalogs.length > 0 && (
                  <CatalogSection
                    title='PULSA & DATA'
                    eyebrow='Digital'
                    items={pulsaDataCatalogs}
                  />
                )}
              </div>
            )}
          </div>

          {!isCatalogLoading && (
            <CatalogSuggestionBanner className='mt-14 sm:mt-16' />
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
