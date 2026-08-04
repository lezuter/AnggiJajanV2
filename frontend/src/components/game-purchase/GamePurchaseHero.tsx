'use client'

import { useState } from 'react'
import { GlareCard } from '@/components/ui/GlareCard'

interface GamePurchaseHeroProps {
  category: string
  publisher?: string
  region?: string
  description: string
  imageUrl?: string
  bannerUrl?: string
  characterVideoUrl?: string
  name: string
  shortName: string
}

function HeroBannerArtwork ({ bannerUrl }: { bannerUrl: string }) {
  const [hasFailed, setHasFailed] = useState(false)

  if (hasFailed) return null

  return (
    <div
      aria-hidden='true'
      className='
        pointer-events-none absolute -top-10 inset-x-0 z-0
        w-full aspect-[1920/550]
        overflow-hidden
        [mask-image:linear-gradient(to_right,transparent_0%,black_8%,black_92%,transparent_100%)]
        [-webkit-mask-image:linear-gradient(to_right,transparent_0%,black_8%,black_92%,transparent_100%)]
      '
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={bannerUrl}
        alt=''
        loading='eager'
        decoding='async'
        onError={() => setHasFailed(true)}
        className='h-full w-full object-cover object-center opacity-100'
      />
    </div>
  )
}

function HeroCharacterVideo ({ videoUrl }: { videoUrl: string }) {
  return (
    <div
      aria-hidden='true'
      className='pointer-events-none absolute -top-10 inset-x-0 z-20 hidden aspect-[1920/550] drop-shadow-[0_12px_30px_rgba(99,0,255,0.35)] md:block'
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        preload='auto'
        className='absolute -bottom-[18%] -right-[10%] h-[130%] w-[50%] object-contain object-right-bottom'
      >
        <source src={videoUrl} type='video/webm' />
      </video>
    </div>
  )
}

export default function GamePurchaseHero ({
  category,
  publisher,
  region,
  description,
  imageUrl,
  bannerUrl,
  characterVideoUrl,
  name,
  shortName
}: GamePurchaseHeroProps) {
  const publisherLabel = publisher?.trim() || category
  const hasRegion = Boolean(region?.trim())
  const isLongTitle = name.trim().length > 20

  return (
    <section className='relative z-20 min-w-0 pb-6 sm:pb-8 md:min-h-[clamp(300px,33vw,380px)] lg:pb-8'>
      {bannerUrl && <HeroBannerArtwork key={bannerUrl} bannerUrl={bannerUrl} />}

      {characterVideoUrl && (
        <HeroCharacterVideo
          key={characterVideoUrl}
          videoUrl={characterVideoUrl}
        />
      )}

      <div className='relative z-[2] mt-[76px] grid min-w-0 grid-cols-[104px_minmax(0,1fr)] items-end gap-x-5 gap-y-7 sm:mt-20 sm:grid-cols-[116px_minmax(0,1fr)] sm:gap-x-7 md:grid-cols-12 md:gap-x-6 lg:mt-[88px] lg:gap-x-8'>
        <GlareCard className='col-start-1 row-start-1 aspect-[4/5] w-[104px] sm:w-[116px] md:col-span-2 md:w-[188px] md:justify-self-end md:self-start'>
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={name}
              className='h-full w-full object-cover'
            />
          ) : (
            <div className='flex h-full w-full items-center justify-center text-2xl font-medium tracking-[-0.04em] text-white/[0.62] sm:text-3xl md:text-4xl'>
              {shortName}
            </div>
          )}

          <div className='pointer-events-none absolute inset-0 bg-gradient-to-t from-black/[0.38] via-transparent to-white/[0.035]' />

          <div
            aria-hidden='true'
            className='pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.3] to-transparent'
          />
        </GlareCard>

        <div className='relative col-start-2 row-start-1 min-w-0 md:col-span-10 md:col-start-3 md:self-start'>
          <span
            aria-hidden='true'
            className='pointer-events-none absolute -left-5 top-1/2 hidden -translate-y-1/2 select-none whitespace-nowrap text-[clamp(9rem,19vw,17rem)] font-semibold uppercase leading-none tracking-[-0.08em] text-white/[0.025] md:block'
          >
            {shortName}
          </span>

          <div className='relative z-10 min-w-0'>
            <div className='mt-0 flex min-w-0 flex-wrap items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-white/[0.58] [text-shadow:0_1px_5px_rgba(0,0,0,0.65)] sm:text-[11px]'>
              <span className='max-w-full truncate'>{publisherLabel}</span>
            </div>

            <h1
              className={`
                break-words font-medium leading-[0.95] tracking-[-0.05em]
                text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.65)]
                sm:text-balance md:-ml-[7px]
                ${
                  isLongTitle
                    ? 'max-w-[620px] text-[clamp(2rem,7.4vw,2.9rem)] md:text-[clamp(3.15rem,5.5vw,4.65rem)] lg:max-w-[680px]'
                    : 'max-w-[820px] text-[clamp(2rem,8.5vw,3rem)] md:text-[clamp(3.5rem,6.5vw,5.5rem)]'
                }
              `}
            >
              {name}
            </h1>

            <p className='mt-7 hidden max-w-[600px] text-[15px] leading-6 text-white/[0.68] [text-shadow:0_1px_6px_rgba(0,0,0,0.65)] md:block lg:text-base lg:leading-7'>
              {description}
              {hasRegion && <> · Region {region}</>}
            </p>
          </div>
        </div>

        <p className='col-span-2 row-start-2 max-w-[600px] text-sm leading-6 text-white/[0.68] [text-shadow:0_1px_6px_rgba(0,0,0,0.65)] sm:text-[15px] sm:leading-7 md:hidden'>
          {description}
          {hasRegion && <> · Region {region}</>}
        </p>
      </div>
    </section>
  )
}
