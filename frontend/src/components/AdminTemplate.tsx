'use client'

import { useState, useEffect, useRef } from 'react' // Tambah useRef
import { usePathname } from 'next/navigation'
import AdminSidebar from './AdminSidebar'

export default function AdminTemplate ({
  children
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      if (scrollRef.current) {
        // Threshold 10px biar langsung kerasa efek blurnya pas scroll dikit
        setIsScrolled(scrollRef.current.scrollTop > 10)
      }
    }
    const currentContainer = scrollRef.current
    currentContainer?.addEventListener('scroll', handleScroll)
    return () => currentContainer?.removeEventListener('scroll', handleScroll)
  }, [])

  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  return (
    <div className='flex h-screen w-full bg-black text-white font-sans overflow-hidden'>
      <AdminSidebar
        isCollapsed={isCollapsed}
        toggleSidebar={() => setIsCollapsed(!isCollapsed)}
      />

      <div
        className={`flex-1 flex flex-col h-full transition-all duration-300 ${
          isCollapsed ? 'ml-20' : 'ml-[255px]'
        }`}
      >
        {/* --- AREA SCROLLABLE (Kunci utamanya di ref={scrollRef}) --- */}
        <div
          ref={scrollRef}
          className='flex-1 relative overflow-y-auto custom-scrollbar'
        >
          {/* BACKGROUND: Taruh di paling atas sebagai sibling Header & Main */}
          <div className='absolute inset-0 -z-10 overflow-hidden pointer-events-none'>
            <div
              className='absolute top-0 left-0 w-full'
              style={{
                height: '1772px',
                background:
                  'linear-gradient(180deg, #18230F 0%, #000000 53.37%)'
              }}
            />
            <div
              className='absolute left-0 w-full bg-no-repeat bg-top'
              style={{
                top: '0',
                height: '1053px',
                backgroundImage: "url('/green_spike_bg.png')",
                backgroundSize: '100% auto'
              }}
            />
          </div>

          {/* HEADER: Sticky top-0 biar "Niban" konten & background */}
          <header
            className={`h-[65px] sticky top-0 z-50 flex items-center justify-between px-8 transition-all duration-500 border-b-[0.5px] ${
              isScrolled
                ? 'bg-black/20 backdrop-blur-md border-[#9EFFBA]/30' // Blur pas di-scroll
                : 'bg-transparent border-transparent backdrop-blur-none' // Bening total pas di Top
            }`}
          >
            <div className='text-sm text-gray-400 font-mono'>
              Admin Panel <span className='text-[#9EFFBA]/50'>/</span>
              <span className='text-[#9EFFBA] font-bold'> products</span>
            </div>

            <div className='flex items-center gap-4'>
              {/* Notif Bell Lu */}
              <button className='relative p-2 rounded-xl text-gray-400 hover:text-[#9EFFBA] transition-all'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  fill='none'
                  viewBox='0 0 24 24'
                  strokeWidth='2'
                  stroke='currentColor'
                  className='w-6 h-6'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    d='M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0'
                  />
                </svg>
                <span className='absolute top-1.5 right-2 flex h-2.5 w-2.5'>
                  <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-[#9EFFBA] opacity-75'></span>
                  <span className='relative inline-flex rounded-full h-2.5 w-2.5 bg-[#9EFFBA] border border-gray-900'></span>
                </span>
              </button>
            </div>
          </header>

          <div className='min-h-full relative isolate'>
            {/* BACKGROUND LAYERS */}
            <div className='absolute inset-0 -z-10 overflow-hidden pointer-events-none'>
              <div
                className='absolute top-0 left-0 w-full'
                style={{
                  height: '1772px',
                  background:
                    'linear-gradient(180deg, #18230F 0%, #000000 53.37%)'
                }}
              />
              <div
                className='absolute left-0 w-full bg-no-repeat bg-top'
                style={{
                  top: '-4px',
                  height: '1053px',
                  backgroundImage: "url('/green_spike_bg.png')",
                  backgroundSize: '100% auto'
                }}
              />
            </div>

            {/* KONTEN UTAMA */}
            <main className='relative z-10'>{children}</main>
          </div>
        </div>
      </div>
    </div>
  )
}
