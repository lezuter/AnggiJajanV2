'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'

import PublicCatalogCard, {
  type CatalogCardVariant,
  type HomepageCatalog
} from '@/components/PublicCatalogCard'

interface CatalogSectionProps {
  title: string
  eyebrow?: string
  items: HomepageCatalog[]
  variant?: CatalogCardVariant
}

const gridClassNames: Record<CatalogCardVariant, string> = {
  featured: 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3',
  poster:
    'grid grid-cols-3 content-start items-stretch gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-5 lg:gap-4',
  provider:
    'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5 xl:grid-cols-6'
}

const emptyStateClassNames: Record<CatalogCardVariant, string> = {
  featured: 'col-span-1 sm:col-span-2 lg:col-span-3',
  poster: 'col-span-3 sm:col-span-4 lg:col-span-5',
  provider: 'col-span-2 sm:col-span-3 lg:col-span-5 xl:col-span-6'
}

const collapsedItemCounts: Record<
  CatalogCardVariant,
  { base: number; sm: number; lg: number }
> = {
  featured: { base: 3, sm: 4, lg: 6 },
  poster: { base: 6, sm: 8, lg: 10 },
  provider: { base: 6, sm: 9, lg: 10 }
}

function createSectionId (title: string) {
  return `catalog-section-${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}`
}

function useCollapsedItemCount (variant: CatalogCardVariant) {
  const [count, setCount] = useState(collapsedItemCounts[variant].base)

  useEffect(() => {
    const smQuery = window.matchMedia('(min-width: 640px)')
    const lgQuery = window.matchMedia('(min-width: 1024px)')

    const updateCount = () => {
      const limits = collapsedItemCounts[variant]

      if (lgQuery.matches) {
        setCount(limits.lg)
        return
      }

      if (smQuery.matches) {
        setCount(limits.sm)
        return
      }

      setCount(limits.base)
    }

    updateCount()
    smQuery.addEventListener('change', updateCount)
    lgQuery.addEventListener('change', updateCount)

    return () => {
      smQuery.removeEventListener('change', updateCount)
      lgQuery.removeEventListener('change', updateCount)
    }
  }, [variant])

  return count
}

export default function CatalogSection ({
  title,
  eyebrow,
  items,
  variant = 'poster'
}: CatalogSectionProps) {
  const sectionId = createSectionId(title)
  const gridId = `${sectionId}-grid`
  const shouldReduceMotion = useReducedMotion()
  const collapsedItemCount = useCollapsedItemCount(variant)
  const sectionStateKey = useMemo(
    () => `${title}:${variant}:${items.map(item => item.slug).join('|')}`,
    [items, title, variant]
  )
  const [expandedSectionKey, setExpandedSectionKey] = useState<string | null>(
    null
  )
  const isExpanded = expandedSectionKey === sectionStateKey

  const visibleItems = useMemo(
    () => (isExpanded ? items : items.slice(0, collapsedItemCount)),
    [collapsedItemCount, isExpanded, items]
  )

  const hiddenItemCount = Math.max(0, items.length - collapsedItemCount)
  const canToggle = hiddenItemCount > 0

  return (
    <section aria-labelledby={sectionId}>
      <div className='mb-5 flex items-end justify-between gap-4'>
        <div>
          {eyebrow && (
            <p className='font-mono text-[10px] uppercase tracking-[0.14em] text-white/[0.48]'>
              {eyebrow}
            </p>
          )}

          <h2
            id={sectionId}
            className='mt-1 text-2xl font-medium tracking-[-0.035em] text-white sm:text-3xl'
          >
            {title}
          </h2>
        </div>

      </div>

      <motion.div
        id={gridId}
        layout={!shouldReduceMotion}
        className={gridClassNames[variant]}
      >
        {items.length === 0 ? (
          <div
            className={`${emptyStateClassNames[variant]} rounded-2xl border border-white/[0.08] bg-black/[0.035] p-6 text-sm text-white/[0.66] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-md backdrop-saturate-150`}
          >
            Game tidak ditemukan.
          </div>
        ) : (
          <AnimatePresence initial={false} mode='popLayout'>
            {visibleItems.map((catalog, index) => (
              <motion.div
                key={catalog.slug}
                layout={!shouldReduceMotion ? 'position' : false}
                initial={
                  shouldReduceMotion
                    ? false
                    : { opacity: 0, y: 14, scale: 0.985 }
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: -8, scale: 0.985 }
                }
                transition={{
                  duration: shouldReduceMotion ? 0.12 : 0.34,
                  ease: [0.22, 1, 0.36, 1],
                  delay:
                    isExpanded && !shouldReduceMotion
                      ? Math.min(index * 0.018, 0.14)
                      : 0
                }}
                className='min-w-0'
              >
                <PublicCatalogCard
                  catalog={catalog}
                  variant={variant}
                  rank={variant === 'featured' ? index + 1 : undefined}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </motion.div>

      {canToggle && (
        <div className='mt-7 flex justify-center sm:mt-8'>
          <motion.button
            type='button'
            aria-expanded={isExpanded}
            aria-controls={gridId}
            onClick={() =>
              setExpandedSectionKey(current =>
                current === sectionStateKey ? null : sectionStateKey
              )
            }
            whileHover={
              shouldReduceMotion
                ? undefined
                : { y: -2, scale: 1.012 }
            }
            whileTap={
              shouldReduceMotion
                ? undefined
                : { scale: 0.975 }
            }
            transition={{
              duration: 0.28,
              ease: [0.22, 1, 0.36, 1]
            }}
            className='relative isolate min-h-11 overflow-hidden rounded-full border border-white/[0.1] bg-white/[0.04] px-5 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-white/[0.76] shadow-[0_12px_38px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-xl backdrop-saturate-150 transition-colors hover:border-white/[0.18] hover:bg-white/[0.065] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/[0.6] focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:min-h-12 sm:px-6 sm:text-[11px]'
          >
            <span
              aria-hidden='true'
              className='pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.18] to-transparent'
            />

            <AnimatePresence initial={false} mode='wait'>
              <motion.span
                key={isExpanded ? 'show-less' : 'view-more'}
                initial={
                  shouldReduceMotion ? false : { opacity: 0, y: 5 }
                }
                animate={{ opacity: 1, y: 0 }}
                exit={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: -5 }
                }
                transition={{
                  duration: shouldReduceMotion ? 0.1 : 0.22,
                  ease: [0.22, 1, 0.36, 1]
                }}
                className='relative z-10 inline-flex items-center'
              >
                {isExpanded ? 'SHOW LESS' : `VIEW MORE · ${hiddenItemCount}`}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </div>
      )}
    </section>
  )
}
