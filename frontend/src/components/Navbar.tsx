'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import Image from 'next/image'

interface NavbarProps {
  searchValue?: string
  onSearchChange?: (value: string) => void
  showSearch?: boolean
}

export default function Navbar ({
  searchValue = '',
  onSearchChange,
  showSearch = false
}: NavbarProps) {
  const pathname = usePathname()

  if (pathname.startsWith('/admin')) return null

  return (
    <nav className='aj-frosted-glass fixed left-1/2 top-5 z-30 w-[calc(100%-24px)] max-w-6xl -translate-x-1/2 rounded-full px-3 py-2 sm:w-[calc(100%-32px)] sm:px-4'>
      <div className='flex min-h-11 items-center justify-between gap-2 sm:gap-3'>
        <Link
          href='/'
          className='flex min-w-0 shrink-0 items-center gap-2 text-white'
          aria-label='Anggijajan homepage'
        >
          <Image
            src='/images/logo/anggi-jajan-stick.svg'
            alt=''
            aria-hidden='true'
            width={44}
            height={44}
            priority
            className='h-10 w-10 shrink-0 object-contain sm:h-11 sm:w-11'
          />
          <span className='hidden translate-y-[2px] font-[family-name:var(--font-cendrick-node)] text-[16px] font-normal leading-none tracking-[0.015em] text-white sm:block sm:text-[15px]'>
            ANGGIJAJAN
          </span>
        </Link>

        <div className='flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3'>
          {showSearch && (
            <div className='relative w-full max-w-[178px] sm:max-w-xs md:max-w-sm'>
              <svg
                viewBox='0 0 24 24'
                fill='none'
                aria-hidden='true'
                className='pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/[0.42]'
              >
                <path
                  d='m21 21-4.35-4.35m2.35-5.15a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z'
                  stroke='currentColor'
                  strokeLinecap='round'
                  strokeWidth='1.7'
                />
              </svg>

              <input
                type='search'
                value={searchValue}
                onChange={event => onSearchChange?.(event.target.value)}
                placeholder='Cari katalog...'
                aria-label='Cari katalog game'
                className='h-10 w-full rounded-full border border-white/[0.08] bg-white/[0.02] pl-10 pr-4 text-xs text-white outline-none backdrop-blur-md transition-colors placeholder:text-white/[0.38] focus:border-white/[0.18] focus:bg-white/[0.04] sm:h-11 sm:text-sm'
              />
            </div>
          )}

          <button
            type='button'
            disabled
            title='Login pengguna segera tersedia'
            className='inline-flex h-10 shrink-0 cursor-not-allowed items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.045] px-4 text-xs font-medium text-white/[0.68] backdrop-blur-md sm:h-11 sm:px-5 sm:text-sm'
          >
            Login
          </button>
        </div>
      </div>
    </nav>
  )
}
