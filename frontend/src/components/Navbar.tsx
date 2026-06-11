'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import AnggiJajanLogo from './AnggiJajanLogo'

export default function Navbar () {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  // Logic deteksi scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Sembunyikan di halaman admin
  if (pathname.startsWith('/admin')) return null

  return (
    <nav
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 border-b-[0.5px] ${
        isScrolled
          ? 'bg-black/20 backdrop-blur-md border-[#9EFFBA]/30 py-3' // Efek blur muncul pas scroll
          : 'bg-transparent border-transparent backdrop-blur-none py-5' // Polos tanpa blur pas di top
      }`}
    >
      <div className='container mx-auto px-8 flex justify-between items-center'>
        {/* LOGO */}
        <Link href='/' className='flex items-center gap-2 group'>
          <AnggiJajanLogo />
        </Link>

        {/* MENU DESKTOP */}
        <div className='hidden md:flex items-center gap-10'>
          <Link
            href='/'
            className="font-['Minecraftia'] text-[13px] text-white hover:text-[#9EFFBA] transition-all"
          >
            BERANDA
          </Link>
          <Link
            href='/cek-pesanan'
            className="font-['Minecraftia'] text-[13px] text-white hover:text-[#9EFFBA] transition-all"
          >
            LACAK PESANAN
          </Link>
          <a
            href='https://wa.me/628123456789'
            target='_blank'
            className="font-['IBM_Plex_Mono'] px-6 py-2 bg-[#9EFFBA]/10 hover:bg-[#9EFFBA]/20 border border-[#9EFFBA]/40 rounded-full text-[13px] font-bold text-[#9EFFBA] transition-all"
          >
            HUBUNGI ADMIN
          </a>
        </div>

        {/* TOMBOL MOBILE */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className='md:hidden p-2 text-white'
        >
          <svg
            className='w-6 h-6'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d={
                isMobileMenuOpen
                  ? 'M6 18L18 6M6 6l12 12'
                  : 'M4 6h16M4 12h16M4 18h16'
              }
            />
          </svg>
        </button>
      </div>

      {/* MENU MOBILE (Dropdown) */}
      {isMobileMenuOpen && (
        <div className='md:hidden bg-black/80 backdrop-blur-xl border-t border-[#9EFFBA]/20 p-6 absolute w-full shadow-2xl'>
          <div className='flex flex-col gap-6'>
            <Link
              href='/'
              onClick={() => setIsMobileMenuOpen(false)}
              className="font-['Minecraftia'] text-white text-sm"
            >
              BERANDA
            </Link>
            <Link
              href='/cek-pesanan'
              onClick={() => setIsMobileMenuOpen(false)}
              className="font-['Minecraftia'] text-white text-sm"
            >
              LACAK PESANAN
            </Link>
            <hr className='border-[#9EFFBA]/10' />
            <a
              href='https://wa.me/62812345678'
              className="font-['IBM_Plex_Mono'] text-[#9EFFBA] font-bold text-sm text-center"
            >
              WHATSAPP ADMIN
            </a>
          </div>
        </div>
      )}
    </nav>
  )
}
