'use client'

import Image from 'next/image'
import Link from 'next/link'
import { FooterBoxes } from '@/components/ui/footer-boxes'

import { Fragment, useRef } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform
} from 'framer-motion'

const footerStyles = `
.cinematic-footer-wrapper {
  --footer-background: #000000;
  --footer-foreground: #ededed;
  --footer-muted: rgba(237, 237, 237, 0.54);
  --footer-border: rgba(237, 237, 237, 0.1);

  --pill-bg-1: rgba(255, 255, 255, 0.045);
  --pill-bg-2: rgba(255, 255, 255, 0.018);
  --pill-shadow: rgba(0, 0, 0, 0.42);
  --pill-highlight: rgba(255, 255, 255, 0.08);
  --pill-inset-shadow: rgba(0, 0, 0, 0.34);
  --pill-border: rgba(255, 255, 255, 0.08);
  --pill-bg-1-hover: rgba(255, 255, 255, 0.065);
  --pill-bg-2-hover: rgba(255, 255, 255, 0.028);
  --pill-border-hover: rgba(255, 255, 255, 0.14);
  --pill-shadow-hover: rgba(0, 0, 0, 0.54);
  --pill-highlight-hover: rgba(255, 255, 255, 0.14);

  font-family: var(--font-inter), Arial, sans-serif;
  color: var(--footer-foreground);
  background: var(--footer-background);
  -webkit-font-smoothing: antialiased;
}

@keyframes footer-breathe {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.54;
  }
  100% {
    transform: translate(-50%, -50%) scale(1.08);
    opacity: 0.9;
  }
}

@keyframes footer-scroll-marquee {
  from {
    transform: translateX(0);
  }

  to {
    transform: translateX(calc(-100% / 6));
  }
}

.animate-footer-breathe {
  animation: footer-breathe 9s ease-in-out infinite alternate;
}

.animate-footer-scroll-marquee {
  animation: footer-scroll-marquee 42s linear infinite;
}

.footer-aurora {
  background:
    radial-gradient(
      circle at 34% 48%,
      rgba(59, 130, 246, 0.085) 0%,
      rgba(59, 130, 246, 0.025) 38%,
      transparent 68%
    ),
    radial-gradient(
      circle at 70% 58%,
      rgba(236, 72, 153, 0.045) 0%,
      rgba(236, 72, 153, 0.012) 34%,
      transparent 64%
    );
}

.footer-reveal-mask {
  mask-image: linear-gradient(
    to bottom,
    transparent 0,
    transparent 12px,
    rgba(0, 0, 0, 0.18) 28px,
    rgba(0, 0, 0, 0.5) 52px,
    rgba(0, 0, 0, 0.82) 76px,
    rgba(0, 0, 0, 0.96) 96px,
    black 116px,
    black 100%
  );

  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0,
    transparent 12px,
    rgba(0, 0, 0, 0.18) 28px,
    rgba(0, 0, 0, 0.5) 52px,
    rgba(0, 0, 0, 0.82) 76px,
    rgba(0, 0, 0, 0.96) 96px,
    black 116px,
    black 100%
  );
}

.footer-glass-surface {
  background:
    radial-gradient(
      ellipse at 14% 4%,
      rgba(168, 85, 247, 0.13) 0%,
      rgba(168, 85, 247, 0.032) 34%,
      transparent 62%
    ),
    radial-gradient(
      ellipse at 90% 100%,
      rgba(59, 130, 246, 0.12) 0%,
      rgba(59, 130, 246, 0.03) 36%,
      transparent 64%
    ),
    rgba(0, 0, 0, 0.035);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 22px 70px rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(12px) saturate(150%);
  -webkit-backdrop-filter: blur(12px) saturate(150%);
}

.footer-glass-pill {
  background: linear-gradient(145deg, var(--pill-bg-1), var(--pill-bg-2));
  border: 1px solid var(--pill-border);
  box-shadow:
    0 10px 30px -12px var(--pill-shadow),
    inset 0 1px 0 var(--pill-highlight),
    inset 0 -1px 0 var(--pill-inset-shadow);
  backdrop-filter: blur(12px) saturate(150%);
  -webkit-backdrop-filter: blur(12px) saturate(150%);
  transition:
    background 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    border-color 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    color 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.footer-glass-pill:hover {
  background: linear-gradient(145deg, var(--pill-bg-1-hover), var(--pill-bg-2-hover));
  border-color: var(--pill-border-hover);
  box-shadow:
    0 20px 40px -10px var(--pill-shadow-hover),
    inset 0 1px 1px var(--pill-highlight-hover);
}

.footer-nav-link {
  position: relative;
  display: inline-flex;
  width: fit-content;
  color: rgba(255, 255, 255, 0.68);
  transition:
    color 240ms ease,
    transform 240ms ease;
}

.footer-nav-link::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: -0.25rem;
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.42));
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
}

.footer-nav-link:hover,
.footer-nav-link:focus-visible {
  color: rgba(255, 255, 255, 0.95);
  transform: translateX(2px);
}

.footer-nav-link:hover::after,
.footer-nav-link:focus-visible::after {
  transform: scaleX(1);
}

@media (prefers-reduced-motion: reduce) {
  .animate-footer-breathe,
  .animate-footer-scroll-marquee {
    animation: none;
  }

  .footer-nav-link {
    transition: none;
  }
}
`

const marqueeItems = [
  'Instant Top Up',
  'No Hidden Price',
  'Fast Processing',
  'Track Your Order',
  'Ready To Play'
]

function MagneticSurface ({
  children,
  className = ''
}: {
  children: ReactNode
  className?: string
}) {
  const shouldReduceMotion = useReducedMotion()
  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)
  const rawRotateX = useMotionValue(0)
  const rawRotateY = useMotionValue(0)
  const rawScale = useMotionValue(1)
  const springConfig = { stiffness: 180, damping: 18, mass: 0.45 }

  const x = useSpring(rawX, springConfig)
  const y = useSpring(rawY, springConfig)
  const rotateX = useSpring(rawRotateX, springConfig)
  const rotateY = useSpring(rawRotateY, springConfig)
  const scale = useSpring(rawScale, springConfig)

  const reset = () => {
    rawX.set(0)
    rawY.set(0)
    rawRotateX.set(0)
    rawRotateY.set(0)
    rawScale.set(1)
  }

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (shouldReduceMotion || !window.matchMedia('(pointer: fine)').matches) {
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const offsetX = event.clientX - rect.left - rect.width / 2
    const offsetY = event.clientY - rect.top - rect.height / 2

    rawX.set(offsetX * 0.18)
    rawY.set(offsetY * 0.18)
    rawRotateX.set(offsetY * -0.05)
    rawRotateY.set(offsetX * 0.05)
    rawScale.set(1.02)
  }

  return (
    <motion.div
      className={className}
      style={{
        x,
        y,
        rotateX,
        rotateY,
        scale,
        transformPerspective: 800,
        transformStyle: 'preserve-3d'
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={reset}
      onBlur={reset}
    >
      {children}
    </motion.div>
  )
}

function CatalogIcon () {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      className='h-5 w-5 text-white/[0.58] transition-colors group-hover:text-white'
    >
      <path
        d='M8.5 8.5h7A5.5 5.5 0 0 1 21 14v2.2a2.8 2.8 0 0 1-4.8 2l-1.7-1.7h-5l-1.7 1.7a2.8 2.8 0 0 1-4.8-2V14a5.5 5.5 0 0 1 5.5-5.5Z'
        strokeWidth='1.7'
        strokeLinejoin='round'
      />
      <path d='M8 11v4M6 13h4' strokeWidth='1.7' strokeLinecap='round' />
      <circle cx='16' cy='12' r='1' fill='currentColor' stroke='none' />
      <circle cx='18' cy='14' r='1' fill='currentColor' stroke='none' />
      <path
        d='M9 8.5 10.2 5h3.6L15 8.5'
        strokeWidth='1.7'
        strokeLinejoin='round'
      />
    </svg>
  )
}

function OrderIcon () {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      className='h-5 w-5 text-white/[0.58] transition-colors group-hover:text-white'
    >
      <path
        d='M6.5 3.5h8l3 3v5.25M6.5 3.5A1.5 1.5 0 0 0 5 5v14a1.5 1.5 0 0 0 1.5 1.5H11'
        strokeWidth='1.7'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      <path d='M9 9h5M9 13h3' strokeWidth='1.7' strokeLinecap='round' />
      <circle cx='16.5' cy='16.5' r='3.5' strokeWidth='1.7' />
      <path d='m19 19 2 2' strokeWidth='1.7' strokeLinecap='round' />
    </svg>
  )
}

function ActionLink ({
  href,
  icon,
  children,
  tabIndex
}: {
  href: string
  icon: ReactNode
  children: ReactNode
  tabIndex: number
}) {
  return (
    <MagneticSurface>
      <Link
        href={href}
        tabIndex={tabIndex}
        prefetch={href.startsWith('/') ? false : undefined}
        className='footer-glass-pill pointer-events-auto group flex items-center gap-2 rounded-full px-5 py-3 text-xs font-semibold text-white sm:text-sm'
      >
        {icon}
        {children}
      </Link>
    </MagneticSurface>
  )
}

function FooterLink ({
  href,
  children,
  tabIndex
}: {
  href: string
  children: ReactNode
  tabIndex: number
}) {
  return (
    <Link
      href={href}
      tabIndex={tabIndex}
      prefetch={href.startsWith('/') ? false : undefined}
      className='footer-nav-link pointer-events-auto text-sm leading-6 focus-visible:outline-none'
    >
      {children}
    </Link>
  )
}

function MutedItem ({ children }: { children: ReactNode }) {
  return <span className='text-sm leading-6 text-white/[0.5]'>{children}</span>
}

function PaymentBadge ({ children }: { children: ReactNode }) {
  return (
    <span className='rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-white/[0.5]'>
      {children}
    </span>
  )
}

function MarqueeItem () {
  return (
    <div className='flex shrink-0 items-center space-x-12 px-6'>
      {marqueeItems.map(item => (
        <Fragment key={item}>
          <span className='whitespace-nowrap'>{item}</span>
          <svg
            aria-hidden='true'
            viewBox='0 0 20 32'
            fill='currentColor'
            className='h-7 w-[14px] shrink-0 text-white/[0.92]'
          >
            <path d='M10 1C10.35 9.4 11.7 14.15 16.5 16C11.7 17.85 10.35 22.6 10 31C9.65 22.6 8.3 17.85 3.5 16C8.3 14.15 9.65 9.4 10 1Z' />
          </svg>
        </Fragment>
      ))}
    </div>
  )
}

export default function SiteFooter () {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const shouldReduceMotion = useReducedMotion()
  const isFooterVisible = useInView(wrapperRef, { amount: 0.06 })
  const currentYear = new Date().getFullYear()

  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ['start 46%', 'end end']
  })

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 24,
    mass: 0.35
  })

  const brandY = useTransform(smoothProgress, [0, 0.7], [42, 0])
  const brandOpacity = useTransform(smoothProgress, [0, 0.68], [0, 1])
  const columnsY = useTransform(smoothProgress, [0.18, 1], [46, 0])
  const columnsOpacity = useTransform(smoothProgress, [0.18, 0.9], [0, 1])
  const surfaceY = useTransform(smoothProgress, [0, 0.72], [64, 0])
  const surfaceScale = useTransform(smoothProgress, [0, 0.72], [0.965, 1])
  const surfaceOpacity = useTransform(smoothProgress, [0, 0.5], [0, 1])

  const focusTabIndex = isFooterVisible ? 0 : -1

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: shouldReduceMotion ? 'auto' : 'smooth'
    })
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: footerStyles }} />

      <div
        ref={wrapperRef}
        id='contact'
        className='footer-reveal-mask relative z-0 h-[860px] w-full sm:h-[720px] lg:h-[600px]'
        style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)' }}
      >
        <footer
          aria-label='Footer Anggijajan'
          className='cinematic-footer-wrapper fixed bottom-0 left-0 flex h-[860px] w-full flex-col overflow-hidden sm:h-[720px] lg:h-[600px]'
        >
          <div
            aria-hidden='true'
            className='footer-aurora animate-footer-breathe pointer-events-none absolute left-1/2 top-1/2 z-0 h-[64vh] w-[82vw] -translate-x-1/2 -translate-y-1/2 rounded-[50%] blur-[88px]'
          />
          <div
            aria-hidden='true'
            className='absolute inset-0 z-0 overflow-hidden'
            style={{
              maskImage:
                'linear-gradient(to bottom, transparent 0px, transparent 88px, rgba(0,0,0,0.62) 108px, rgba(0,0,0,0.9) 126px, black 142px, black 100%)',
              WebkitMaskImage:
                'linear-gradient(to bottom, transparent 0px, transparent 88px, rgba(0,0,0,0.62) 108px, rgba(0,0,0,0.9) 126px, black 142px, black 100%)'
            }}
          >
            <FooterBoxes
              enabled={isFooterVisible}
              className='pointer-events-none'
            />

            <div className='pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,transparent_18%,rgba(0,0,0,0.58)_100%)]' />
          </div>

          <div
            aria-hidden='true'
            className='pointer-events-none absolute left-1/2 top-[72px] z-10 w-[114%] -translate-x-1/2 -rotate-[3deg] overflow-hidden border-y border-white/[0.16] bg-black/80 py-3.5 shadow-[0_18px_55px_rgba(0,0,0,0.72),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(255,255,255,0.035)] backdrop-blur-xl'
          >
            <div className='animate-footer-scroll-marquee flex w-max will-change-transform text-[11px] font-bold uppercase leading-none tracking-[0.3em] text-white/[0.92] sm:text-xs'>
              {Array.from({ length: 6 }, (_, index) => (
                <MarqueeItem key={`footer-marquee-${index}`} />
              ))}
            </div>
          </div>

          <div className='pointer-events-none relative z-10 mx-auto flex w-full max-w-6xl flex-1 items-end px-4 pb-5 pt-28 sm:px-6 sm:pb-7 lg:pt-32'>
            <motion.div
              style={
                shouldReduceMotion
                  ? {
                      y: 0,
                      scale: 1,
                      opacity: 1,
                      transformOrigin: '50% 100%'
                    }
                  : {
                      y: surfaceY,
                      scale: surfaceScale,
                      opacity: surfaceOpacity,
                      transformOrigin: '50% 100%'
                    }
              }
              className='footer-glass-surface pointer-events-none grid w-full gap-8 rounded-[28px] p-5 will-change-transform sm:rounded-[32px] sm:p-7 lg:grid-cols-[1.35fr_0.72fr_0.72fr_0.88fr] lg:gap-10 lg:p-9'
            >
              <motion.section
                style={
                  shouldReduceMotion
                    ? { y: 0, opacity: 1 }
                    : { y: brandY, opacity: brandOpacity }
                }
                className='min-w-0'
              >
                <div className='flex items-center gap-2'>
                  <Image
                    src='/images/logo/anggi-jajan-stick.svg'
                    alt=''
                    aria-hidden='true'
                    width={44}
                    height={44}
                    className='h-10 w-10 shrink-0 object-contain sm:h-11 sm:w-11'
                  />
                  <span className='translate-y-[2px] font-[family-name:var(--font-cendrick-node)] text-[15px] font-normal leading-none tracking-[0.015em] text-white sm:text-[16px]'>
                    ANGGIJAJAN
                  </span>
                </div>

                <p className='mt-5 max-w-md text-sm leading-6 text-white/[0.48] sm:text-[15px] sm:leading-7'>
                  Top up game dan produk digital dengan proses yang ringkas,
                  cepat, dan mudah dipantau.
                </p>

                <div className='mt-6 flex flex-wrap gap-3'>
                  <ActionLink
                    href='#catalog'
                    icon={<CatalogIcon />}
                    tabIndex={focusTabIndex}
                  >
                    Lihat katalog
                  </ActionLink>
                  <ActionLink
                    href='/cek-pesanan/'
                    icon={<OrderIcon />}
                    tabIndex={focusTabIndex}
                  >
                    Cek pesanan
                  </ActionLink>
                </div>
              </motion.section>

              <motion.section
                style={
                  shouldReduceMotion
                    ? { y: 0, opacity: 1 }
                    : { y: columnsY, opacity: columnsOpacity }
                }
              >
                <p className='font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-white/[0.5]'>
                  Jelajahi
                </p>
                <nav
                  aria-label='Navigasi footer'
                  className='mt-4 flex flex-col gap-2.5'
                >
                  <FooterLink href='/' tabIndex={focusTabIndex}>
                    Beranda
                  </FooterLink>
                  <FooterLink href='#catalog' tabIndex={focusTabIndex}>
                    Katalog produk
                  </FooterLink>
                  <FooterLink href='/cek-pesanan/' tabIndex={focusTabIndex}>
                    Status pesanan
                  </FooterLink>
                </nav>
              </motion.section>

              <motion.section
                style={
                  shouldReduceMotion
                    ? { y: 0, opacity: 1 }
                    : { y: columnsY, opacity: columnsOpacity }
                }
              >
                <p className='font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-white/[0.5]'>
                  Dukungan
                </p>
                <div className='mt-4 flex flex-col gap-2.5'>
                  <MutedItem>Pusat bantuan</MutedItem>
                  <MutedItem>Syarat layanan</MutedItem>
                  <MutedItem>Kebijakan privasi</MutedItem>
                </div>
                <p className='mt-4 text-xs leading-5 text-white/[0.28]'>
                  Halaman bantuan dan legal sedang disiapkan.
                </p>
              </motion.section>

              <motion.section
                style={
                  shouldReduceMotion
                    ? { y: 0, opacity: 1 }
                    : { y: columnsY, opacity: columnsOpacity }
                }
              >
                <p className='font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-white/[0.5]'>
                  Pembayaran
                </p>
                <div className='mt-4 flex flex-wrap gap-2'>
                  <PaymentBadge>QRIS</PaymentBadge>
                  <PaymentBadge>VA</PaymentBadge>
                  <PaymentBadge>E-Wallet</PaymentBadge>
                </div>
                <p className='mt-4 text-xs leading-5 text-white/[0.34]'>
                  Pilihan pembayaran akan ditampilkan saat checkout sesuai
                  ketersediaan.
                </p>
              </motion.section>
            </motion.div>
          </div>

          <div className='pointer-events-none relative z-20 w-full px-4 pb-5 pt-1 sm:px-6 sm:pb-7'>
            <div className='mx-auto flex w-full max-w-6xl items-center justify-between gap-2'>
              <div className='text-[10px] font-semibold uppercase tracking-[0.16em] text-white/[0.42] sm:text-xs'>
                © {currentYear} Anggijajan. Hak cipta dilindungi.
              </div>

              <MagneticSurface>
                <button
                  type='button'
                  onClick={scrollToTop}
                  tabIndex={focusTabIndex}
                  aria-label='Kembali ke atas'
                  className='footer-glass-pill pointer-events-auto group flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-white/[0.5] hover:text-white focus-visible:outline-none'
                >
                  <svg
                    aria-hidden='true'
                    className='h-[18px] w-[18px] transition-transform duration-300 group-hover:-translate-y-1'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='1.8'
                      d='M5 10l7-7m0 0 7 7m-7-7v18'
                    />
                  </svg>
                </button>
              </MagneticSurface>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
