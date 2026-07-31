'use client'

import { LayoutGroup, motion, useReducedMotion } from 'framer-motion'

export type CatalogFilter = 'all' | 'popular' | 'game' | 'pulsa-data'

export type CatalogFilterCounts = Record<CatalogFilter, number>

interface CatalogFilterCapsulesProps {
  activeFilter: CatalogFilter
  counts: CatalogFilterCounts
  isLoading?: boolean
  onFilterChange: (filter: CatalogFilter) => void
}

const liquidEase = [0.22, 1, 0.36, 1] as const

const filterOptions: Array<{
  value: CatalogFilter
  label: string
}> = [
  { value: 'all', label: 'Semua' },
  { value: 'popular', label: 'Lagi Populer' },
  { value: 'game', label: 'Games' },
  { value: 'pulsa-data', label: 'Pulsa & Data' }
]

function CapsuleGlassSurface ({ isActive }: { isActive: boolean }) {
  return (
    <>
      <span
        aria-hidden='true'
        className={`pointer-events-none absolute inset-0 -z-20 transition-colors duration-300 ${
          isActive ? 'bg-black/[0.16]' : 'bg-black/[0.1]'
        }`}
      />

      {/* Neutral glass texture. No top glow for inactive capsules. */}
      <span
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 -z-10 opacity-[0.16] [background-image:linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.045)_44%,transparent_58%)]'
      />
    </>
  )
}

export default function CatalogFilterCapsules ({
  activeFilter,
  counts,
  isLoading = false,
  onFilterChange
}: CatalogFilterCapsulesProps) {
  const shouldReduceMotion = useReducedMotion()

  const visibleOptions = filterOptions.filter(
    option =>
      option.value === 'all' || isLoading || counts[option.value] > 0
  )

  const layoutTransition = shouldReduceMotion
    ? { duration: 0 }
    : {
        type: 'spring' as const,
        stiffness: 420,
        damping: 34,
        mass: 0.72
      }

  return (
    <LayoutGroup id='homepage-catalog-filter'>
      <div
        role='group'
        aria-label='Filter katalog'
        className='relative -mx-4 min-w-0 overflow-hidden px-4 sm:mx-0 sm:px-0'
      >
        <div className='pointer-events-none absolute inset-y-0 left-0 z-20 w-5 bg-gradient-to-r from-[#08080a] to-transparent sm:hidden' />
        <div className='pointer-events-none absolute inset-y-0 right-0 z-20 w-5 bg-gradient-to-l from-[#08080a] to-transparent sm:hidden' />

        <div className='flex w-full min-w-0 touch-pan-x gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
          {visibleOptions.map((option, index) => {
            const isActive = activeFilter === option.value
            const count = counts[option.value]

            return (
              <motion.button
                layout='position'
                key={option.value}
                type='button'
                aria-pressed={isActive}
                aria-label={`${option.label}${
                  isLoading ? '' : `, ${count} katalog`
                }`}
                onClick={() => onFilterChange(option.value)}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={
                  shouldReduceMotion || isActive ? undefined : { y: -1 }
                }
                whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
                transition={{
                  layout: layoutTransition,
                  opacity: {
                    duration: shouldReduceMotion ? 0 : 0.24,
                    delay: shouldReduceMotion ? 0 : index * 0.025,
                    ease: liquidEase
                  },
                  y: {
                    duration: shouldReduceMotion ? 0 : 0.22,
                    delay: shouldReduceMotion ? 0 : index * 0.025,
                    ease: liquidEase
                  },
                  scale: {
                    duration: shouldReduceMotion ? 0 : 0.16,
                    ease: liquidEase
                  }
                }}
                className={`group relative isolate flex min-h-10 shrink-0 items-center gap-2 overflow-hidden rounded-full border px-3.5 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.055em] outline-none backdrop-blur-md backdrop-saturate-150 transition-[border-color,color,box-shadow] duration-300 focus-visible:ring-2 focus-visible:ring-white/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#08080a] sm:min-h-11 sm:px-4 sm:text-xs ${
                  isActive
                    ? 'border-white/[0.2] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(255,255,255,0.025),0_14px_38px_rgba(0,0,0,0.28)]'
                    : 'border-white/[0.1] text-white/[0.68] shadow-[inset_0_-1px_0_rgba(255,255,255,0.015),0_10px_28px_rgba(0,0,0,0.18)] hover:border-white/[0.18] hover:text-white/[0.94]'
                }`}
              >
                <CapsuleGlassSurface isActive={isActive} />

                {isActive && (
                  <>
                    <motion.span
                      layoutId='active-catalog-capsule-fill'
                      aria-hidden='true'
                      className='pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-white/[0.045]'
                      transition={layoutTransition}
                    />

                    <motion.span
                      layoutId='active-catalog-capsule-glow'
                      aria-hidden='true'
                      className='pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-[radial-gradient(ellipse_at_18%_0%,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0.05)_36%,transparent_66%),radial-gradient(ellipse_at_88%_115%,rgba(59,130,246,0.075)_0%,rgba(59,130,246,0.018)_38%,transparent_68%)] mix-blend-screen'
                      transition={layoutTransition}
                    />

                    <motion.span
                      layoutId='active-catalog-capsule-top-light'
                      aria-hidden='true'
                      className='pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.3] to-transparent'
                      transition={layoutTransition}
                    />
                  </>
                )}

                <motion.span
                  layout='position'
                  className='relative z-10'
                  transition={{ layout: layoutTransition }}
                >
                  {option.label}
                </motion.span>

                {!isLoading && (
                  <motion.span
                    layout='position'
                    aria-hidden='true'
                    className={`relative z-10 min-w-5 rounded-full border px-1.5 py-0.5 text-center text-[9px] leading-none tracking-normal backdrop-blur-sm transition-[border-color,background-color,color] duration-300 sm:text-[10px] ${
                      isActive
                        ? 'border-white/[0.15] bg-white/[0.09] text-white/[0.88]'
                        : 'border-white/[0.08] bg-black/[0.14] text-white/[0.5] group-hover:text-white/[0.72]'
                    }`}
                    transition={{ layout: layoutTransition }}
                  >
                    {count}
                  </motion.span>
                )}
              </motion.button>
            )
          })}
        </div>
      </div>
    </LayoutGroup>
  )
}