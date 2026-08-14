'use client'

import Link from 'next/link'
import { useState } from 'react'

export interface HomepageCatalog {
  cardcode: string
  name: string
  slug: string
  imageUrl: string
  category: string
  description: string
  shortName: string
  isPopular: boolean
  sortOrder: number
}

export type CatalogCardVariant = 'featured' | 'poster' | 'provider'

interface PublicCatalogCardProps {
  catalog: HomepageCatalog
  variant?: CatalogCardVariant
  rank?: number
}

export function formatCategoryLabel (category: string) {
  switch (category) {
    case 'game':
      return 'Game'
    case 'pulsa-data':
    case 'pulsa_data':
      return 'Pulsa & Data'
    case 'internal':
      return 'Internal'
    default:
      return category
  }
}

function CatalogArtwork ({
  catalog,
  fit = 'cover',
  className
}: {
  catalog: HomepageCatalog
  fit?: 'cover' | 'contain'
  className: string
}) {
  const [imageFailed, setImageFailed] = useState(false)

  if (!catalog.imageUrl || imageFailed) {
    return (
      <div
        role='img'
        aria-label={`Gambar ${catalog.name} tidak tersedia`}
        className='flex h-full w-full items-center justify-center bg-transparent text-2xl font-medium tracking-[-0.03em] text-white/[0.58]'
      >
        {catalog.shortName}
      </div>
    )
  }

  return (
    // URL gambar berasal dari database, sehingga elemen img sengaja dipakai.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={catalog.imageUrl}
      alt={catalog.name}
      loading='lazy'
      decoding='async'
      onError={() => setImageFailed(true)}
      className={`h-full w-full ${
        fit === 'contain' ? 'object-contain' : 'object-cover'
      } ${className}`}
    />
  )
}

const cardClassNames: Record<CatalogCardVariant, string> = {
  featured:
    'group relative block aspect-[16/10] overflow-hidden rounded-[22px] border border-white/[0.1] bg-black/[0.06] shadow-[0_20px_60px_rgba(0,0,0,0.24)] transition-[transform,border-color,box-shadow] duration-500 ease-out hover:-translate-y-1 hover:border-white/[0.2] hover:shadow-[0_26px_80px_rgba(59,130,246,0.12)] focus-visible:outline-none',
  poster:
    'group relative block aspect-[4/5] overflow-hidden rounded-[18px] border border-white/[0.08] bg-black/[0.035] shadow-[0_18px_50px_rgba(0,0,0,0.2)] transition-[border-color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-white/[0.14] hover:shadow-[0_26px_68px_rgba(0,0,0,0.32),0_8px_28px_rgba(255,255,255,0.035)] focus-visible:border-white/[0.14] focus-visible:outline-none',
  provider:
    'group relative block aspect-[5/4] overflow-hidden rounded-[18px] border border-white/[0.08] bg-white/[0.035] p-5 shadow-[0_16px_45px_rgba(0,0,0,0.16)] transition-[transform,background-color,border-color,box-shadow] duration-[400ms] ease-out hover:-translate-y-1 hover:border-white/[0.16] hover:bg-white/[0.055] hover:shadow-[0_22px_60px_rgba(59,130,246,0.1)] focus-visible:outline-none'
}

export default function PublicCatalogCard ({
  catalog,
  variant = 'poster',
  rank
}: PublicCatalogCardProps) {
  return (
    <Link
      href={`/game/${catalog.slug}/`}
      className={cardClassNames[variant]}
    >
      {variant === 'featured' && (
        <>
          <CatalogArtwork
            catalog={catalog}
            fit='cover'
            className='transition-transform duration-700 ease-out group-hover:scale-[1.045] group-focus-visible:scale-[1.045]'
          />

          <div className='pointer-events-none absolute inset-0 bg-gradient-to-t from-black/[0.82] via-black/[0.08] to-transparent' />
          <div className='pointer-events-none absolute inset-0 bg-gradient-to-t from-black/[0.18] via-black/[0.04] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100' />

          {rank !== undefined && (
            <span className='absolute left-3 top-3 z-20 rounded-full border border-white/[0.12] bg-black/[0.28] px-2.5 py-1 font-mono text-[10px] tracking-[0.08em] text-white/[0.76] backdrop-blur-md'>
              {String(rank).padStart(2, '0')}
            </span>
          )}

          <div className='absolute inset-x-0 bottom-0 z-10 p-4 sm:p-5'>
            <p className='text-lg font-medium tracking-[-0.025em] text-white sm:text-xl'>
              {catalog.name}
            </p>

            <div className='mt-1.5 flex translate-y-3 items-center justify-between opacity-0 transition-[transform,opacity] duration-[400ms] group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100'>
              <span className='text-xs text-white/[0.62]'>
                {formatCategoryLabel(catalog.category)}
              </span>

              <span className='font-mono text-[10px] uppercase tracking-[0.08em] text-white/[0.7]'>
                Lihat detail →
              </span>
            </div>
          </div>
        </>
      )}

      {variant === 'poster' && (
        <>
          <CatalogArtwork
            catalog={catalog}
            fit='cover'
            className=''
          />

          <div className='pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(5,6,12,0.68)_0%,rgba(7,9,18,0.24)_34%,transparent_72%)] opacity-0 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100 group-focus-visible:opacity-100' />

          <div className='pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[82px] translate-y-full transform-gpu bg-[linear-gradient(145deg,rgba(255,255,255,0.085),rgba(255,255,255,0.028))] px-3 pb-3 pt-3 shadow-[0_-16px_38px_rgba(0,0,0,0.22)] backdrop-blur-[10px] backdrop-saturate-150 [mask-image:linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.28)_18%,black_46%,black_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.28)_18%,black_46%,black_100%)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform group-hover:translate-y-0 group-focus-visible:translate-y-0 sm:h-[104px] sm:px-[18px] sm:pb-[18px] sm:pt-4'>
            <div className='flex h-full flex-col justify-end'>
              <div className='mb-2 flex items-center gap-1.5 sm:mb-2.5 sm:gap-2'>
                <span className='h-1 w-1 rounded-full bg-white/[0.78] shadow-[0_0_10px_rgba(255,255,255,0.65)] sm:h-1.5 sm:w-1.5' />
                <span className='font-mono text-[8px] font-medium uppercase tracking-[0.12em] text-white/[0.64] sm:text-[10px] sm:tracking-[0.14em]'>
                  {formatCategoryLabel(catalog.category)}
                </span>
              </div>

              <p className='truncate text-xs font-semibold leading-[1.2] tracking-[-0.025em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] sm:text-base'>
                {catalog.name}
              </p>
            </div>
          </div>
        </>
      )}

      {variant === 'provider' && (
        <>
          <CatalogArtwork
            catalog={catalog}
            fit='contain'
            className='transition-transform duration-500 ease-out group-hover:scale-[1.045] group-focus-visible:scale-[1.045]'
          />

          <div className='absolute inset-x-3 bottom-3 translate-y-2 rounded-xl border border-white/[0.08] bg-black/[0.3] px-3 py-2 text-center opacity-0 backdrop-blur-md transition-[transform,opacity] duration-[400ms] group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100'>
            <p className='truncate text-xs font-medium text-white'>
              {catalog.name}
            </p>
          </div>
        </>
      )}

      <div
        aria-hidden='true'
        className='catalog-card-shine pointer-events-none absolute z-[15]'
      />

      {variant !== 'provider' && (
        <div className='pointer-events-none absolute inset-x-4 top-0 z-20 h-px bg-gradient-to-r from-transparent via-white/[0.26] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100' />
      )}
    </Link>
  )
}
