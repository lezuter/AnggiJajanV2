'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'

interface CatalogSuggestionBannerProps {
  href?: string
  className?: string
}

const liquidEase = [0.22, 1, 0.36, 1] as const

function SuggestionArtwork ({
  shouldReduceMotion
}: {
  shouldReduceMotion: boolean | null
}) {
  return (
    <div className='relative mx-auto h-[150px] w-[220px] sm:h-[170px] sm:w-[250px]'>
      <motion.div
        aria-hidden='true'
        className='absolute left-1/2 top-1/2 h-28 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.18)_0%,rgba(168,85,247,0.07)_42%,transparent_72%)] blur-2xl'
        animate={
          shouldReduceMotion
            ? undefined
            : {
                scale: [0.96, 1.06, 0.96],
                opacity: [0.5, 0.78, 0.5]
              }
        }
        transition={{
          duration: 5.4,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
      />

      <motion.svg
        viewBox='0 0 260 180'
        role='img'
        aria-label='Ilustrasi kotak pencarian produk'
        className='relative z-10 h-full w-full overflow-visible'
        initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        animate={
          shouldReduceMotion
            ? undefined
            : {
                y: [0, -4, 0]
              }
        }
        transition={{
          opacity: { duration: 0.5, ease: liquidEase },
          y: {
            duration: 4.8,
            repeat: Infinity,
            ease: 'easeInOut'
          }
        }}
      >
        <defs>
          <linearGradient id='box-front' x1='0' y1='0' x2='1' y2='1'>
            <stop offset='0%' stopColor='rgba(255,255,255,0.13)' />
            <stop offset='100%' stopColor='rgba(255,255,255,0.035)' />
          </linearGradient>
          <linearGradient id='box-side' x1='0' y1='0' x2='1' y2='1'>
            <stop offset='0%' stopColor='rgba(59,130,246,0.14)' />
            <stop offset='100%' stopColor='rgba(168,85,247,0.06)' />
          </linearGradient>
          <linearGradient id='glass-lens' x1='0' y1='0' x2='1' y2='1'>
            <stop offset='0%' stopColor='rgba(255,255,255,0.28)' />
            <stop offset='100%' stopColor='rgba(59,130,246,0.08)' />
          </linearGradient>
          <filter id='soft-shadow' x='-30%' y='-30%' width='160%' height='160%'>
            <feDropShadow
              dx='0'
              dy='12'
              stdDeviation='10'
              floodColor='black'
              floodOpacity='0.34'
            />
          </filter>
        </defs>

        <ellipse
          cx='132'
          cy='150'
          rx='78'
          ry='13'
          fill='rgba(0,0,0,0.34)'
        />

        <g filter='url(#soft-shadow)'>
          <path
            d='M54 76 126 54l76 22-74 25Z'
            fill='rgba(255,255,255,0.055)'
            stroke='rgba(255,255,255,0.15)'
            strokeWidth='1.2'
          />
          <path
            d='m54 76 74 25v48L54 123Z'
            fill='url(#box-front)'
            stroke='rgba(255,255,255,0.13)'
            strokeWidth='1.2'
          />
          <path
            d='m128 101 74-25v47l-74 26Z'
            fill='url(#box-side)'
            stroke='rgba(255,255,255,0.11)'
            strokeWidth='1.2'
          />

          <path
            d='m54 76-19 19 67 20 26-14Z'
            fill='rgba(255,255,255,0.075)'
            stroke='rgba(255,255,255,0.13)'
            strokeWidth='1.2'
          />
          <path
            d='m202 76 22 18-68 21-28-14Z'
            fill='rgba(59,130,246,0.09)'
            stroke='rgba(255,255,255,0.12)'
            strokeWidth='1.2'
          />

          <path
            d='M91 72c7-26 24-38 39-38 15 0 31 12 37 36'
            fill='none'
            stroke='rgba(255,255,255,0.34)'
            strokeWidth='3'
            strokeLinecap='round'
            strokeDasharray='5 7'
          />

          <circle
            cx='128'
            cy='48'
            r='23'
            fill='url(#glass-lens)'
            stroke='rgba(255,255,255,0.5)'
            strokeWidth='3'
          />
          <circle
            cx='128'
            cy='48'
            r='12'
            fill='rgba(0,0,0,0.28)'
            stroke='rgba(255,255,255,0.12)'
          />
          <path
            d='m145 65 24 24'
            stroke='rgba(255,255,255,0.72)'
            strokeWidth='7'
            strokeLinecap='round'
          />

          <path
            d='M111 43c4-6 9-9 15-10'
            fill='none'
            stroke='rgba(255,255,255,0.74)'
            strokeWidth='3'
            strokeLinecap='round'
          />

          <path
            d='M79 97v32M96 103v31M112 109v31'
            stroke='rgba(255,255,255,0.06)'
          />
          <path
            d='M149 108v30M166 102v30M183 96v29'
            stroke='rgba(59,130,246,0.07)'
          />
        </g>

        <motion.path
          d='M42 49c-17-12-20-27-8-34 9-5 19 0 17 9-2 8-14 12-27 7'
          fill='none'
          stroke='rgba(255,255,255,0.44)'
          strokeWidth='1.5'
          strokeLinecap='round'
          strokeDasharray='4 6'
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  pathLength: [0.35, 1, 0.35],
                  opacity: [0.28, 0.72, 0.28]
                }
          }
          transition={{
            duration: 4.4,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      </motion.svg>
    </div>
  )
}

export default function CatalogSuggestionBanner ({
  href = '#contact',
  className = ''
}: CatalogSuggestionBannerProps) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.section
      aria-labelledby='catalog-suggestion-title'
      initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.24 }}
      transition={{
        duration: shouldReduceMotion ? 0 : 0.62,
        ease: liquidEase
      }}
      className={`relative isolate overflow-hidden rounded-[26px] border border-white/[0.09] bg-black/[0.13] px-5 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-xl backdrop-saturate-150 sm:px-7 sm:py-7 lg:px-9 lg:py-8 ${className}`}
    >
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_8%_28%,rgba(59,130,246,0.11)_0%,rgba(59,130,246,0.025)_38%,transparent_66%),radial-gradient(ellipse_at_96%_110%,rgba(168,85,247,0.08)_0%,rgba(168,85,247,0.018)_38%,transparent_66%)]'
      />

      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 -z-10 opacity-[0.11] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:36px_36px] [mask-image:linear-gradient(90deg,transparent,black_32%,black_72%,transparent)]'
      />

      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.22] to-transparent'
      />

      <div className='grid items-center gap-5 sm:gap-7 lg:grid-cols-[250px_minmax(0,1fr)_auto] lg:gap-9'>
        <SuggestionArtwork shouldReduceMotion={shouldReduceMotion} />

        <div className='min-w-0 text-center lg:text-left'>
          <p className='font-mono text-[10px] uppercase tracking-[0.14em] text-white/[0.46] sm:text-[11px]'>
            Saran katalog
          </p>

          <h2
            id='catalog-suggestion-title'
            className='mt-2 text-balance text-2xl font-medium tracking-[-0.035em] text-white sm:text-3xl'
          >
            Belum nemu yang kamu cari?
          </h2>

          <p className='mx-auto mt-3 max-w-xl text-sm leading-6 text-white/[0.64] sm:text-base sm:leading-7 lg:mx-0'>
            Kasih tahu kami game atau produk digital yang perlu hadir di
            Anggijajan. Masukan kamu bantu kami menentukan katalog berikutnya.
          </p>
        </div>

        <div className='flex justify-center lg:justify-end'>
          <motion.div
            whileHover={
              shouldReduceMotion ? undefined : { y: -2, scale: 1.012 }
            }
            whileTap={shouldReduceMotion ? undefined : { scale: 0.975 }}
            transition={{
              duration: 0.26,
              ease: liquidEase
            }}
          >
            <Link
              href={href}
              className='group relative isolate inline-flex min-h-12 items-center justify-center gap-3 overflow-hidden rounded-full border border-white/[0.13] bg-black/[0.18] px-5 font-mono text-[10px] font-medium uppercase tracking-[0.09em] text-white/[0.9] shadow-[0_14px_42px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(255,255,255,0.02)] backdrop-blur-xl backdrop-saturate-150 transition-[border-color,background-color,color,box-shadow] duration-300 hover:border-white/[0.22] hover:bg-black/[0.1] hover:text-white hover:shadow-[0_18px_48px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.17)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/[0.6] focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:min-h-13 sm:px-6 sm:text-[11px]'
            >
              <span
                aria-hidden='true'
                className='pointer-events-none absolute inset-0 -z-20 bg-black/[0.08]'
              />

              <span
                aria-hidden='true'
                className='pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_18%_0%,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.04)_38%,transparent_68%),radial-gradient(ellipse_at_88%_115%,rgba(59,130,246,0.07)_0%,rgba(59,130,246,0.015)_40%,transparent_70%)] mix-blend-screen'
              />

              <span
                aria-hidden='true'
                className='pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.28] to-transparent'
              />

              <span className='relative z-10'>Kirim saran produk</span>

              <span
                aria-hidden='true'
                className='relative z-10 text-sm text-white/[0.72] transition-transform duration-300 group-hover:translate-x-1'
              >
                →
              </span>
            </Link>
          </motion.div>
        </div>
      </div>
    </motion.section>
  )
}