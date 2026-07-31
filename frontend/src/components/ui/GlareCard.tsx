'use client'

import {
  useRef,
  type CSSProperties,
  type PointerEvent,
  type ReactNode
} from 'react'

type CSSVariables = CSSProperties & Record<`--${string}`, string | number>

interface GlareCardProps {
  children: ReactNode
  className?: string
}

export function GlareCard ({ children, className = '' }: GlareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  const containerStyle: CSSVariables = {
    '--m-x': '50%',
    '--m-y': '50%',
    '--r-x': '0deg',
    '--r-y': '0deg',
    '--bg-x': '50%',
    '--bg-y': '50%',
    '--duration': '240ms',
    '--opacity': '0',
    '--radius': '18px',
    '--easing': 'cubic-bezier(0.22, 1, 0.36, 1)',
    '--foil-size': '100%'
  }

  const foilStyle: CSSVariables = {
    '--step': '5%',
    '--foil-svg': `url("data:image/svg+xml,%3Csvg width='26' height='26' viewBox='0 0 26 26' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M2.99994 3.419C2.99994 3.419 21.6142 7.43646 22.7921 12.153C23.97 16.8695 3.41838 23.0306 3.41838 23.0306' stroke='white' stroke-width='5' stroke-miterlimit='3.86874' stroke-linecap='round'/%3E%3C/svg%3E")`,
    '--pattern': 'var(--foil-svg) center / var(--foil-size) no-repeat',
    '--rainbow':
      'repeating-linear-gradient(0deg, rgb(255,119,115) calc(var(--step) * 1), rgba(255,237,95,1) calc(var(--step) * 2), rgba(168,255,95,1) calc(var(--step) * 3), rgba(131,255,247,1) calc(var(--step) * 4), rgba(120,148,255,1) calc(var(--step) * 5), rgb(216,117,255) calc(var(--step) * 6), rgb(255,119,115) calc(var(--step) * 7)) 0% var(--bg-y) / 200% 700% no-repeat',
    '--diagonal':
      'repeating-linear-gradient(128deg, #0e152e 0%, hsl(180,10%,60%) 3.8%, hsl(180,10%,60%) 4.5%, hsl(180,10%,60%) 5.2%, #0e152e 10%, #0e152e 12%) var(--bg-x) var(--bg-y) / 300% no-repeat',
    '--shade':
      'radial-gradient(farthest-corner circle at var(--m-x) var(--m-y), rgba(255,255,255,0.08) 12%, rgba(255,255,255,0.14) 28%, rgba(255,255,255,0.24) 120%) var(--bg-x) var(--bg-y) / 300% no-repeat',
    backgroundBlendMode: 'hue, hue, overlay, soft-light'
  }

  const setProperty = (property: string, value: string) => {
    cardRef.current?.style.setProperty(property, value)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return

    const rect = event.currentTarget.getBoundingClientRect()

    const x = ((event.clientX - rect.left) / rect.width) * 100
    const y = ((event.clientY - rect.top) / rect.height) * 100

    const deltaX = x - 50
    const deltaY = y - 50

    setProperty('--m-x', `${x}%`)
    setProperty('--m-y', `${y}%`)
    setProperty('--bg-x', `${50 + deltaX * 0.25}%`)
    setProperty('--bg-y', `${50 + deltaY * 0.25}%`)

    // Rotasi sengaja kecil supaya cover tidak terlalu liar.
    setProperty('--r-x', `${deltaX * 0.085}deg`)
    setProperty('--r-y', `${-deltaY * 0.075}deg`)
    setProperty('--duration', '140ms')
  }

  const handlePointerEnter = () => {
    setProperty('--opacity', '0.38')
    setProperty('--duration', '160ms')
  }

  const handlePointerLeave = () => {
    setProperty('--opacity', '0')
    setProperty('--r-x', '0deg')
    setProperty('--r-y', '0deg')
    setProperty('--m-x', '50%')
    setProperty('--m-y', '50%')
    setProperty('--bg-x', '50%')
    setProperty('--bg-y', '50%')
    setProperty('--duration', '420ms')
  }

  return (
    <div
      ref={cardRef}
      style={containerStyle}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerLeave}
      className={`
        relative isolate touch-pan-y
        [contain:layout_style]
        [perspective:600px]
        ${className}
      `}
    >
      <div
        className='
          grid h-full w-full origin-center overflow-hidden
          rounded-[var(--radius)]
          border border-white/[0.1]
          bg-black/[0.035]
          shadow-[0_22px_70px_rgba(0,0,0,0.22)]
          backdrop-blur-md backdrop-saturate-150
          transition-transform duration-[var(--duration)]
          ease-[var(--easing)]
          will-change-transform
          [transform-style:preserve-3d]
          [transform:rotateY(var(--r-x))_rotateX(var(--r-y))]
        '
      >
        <div className='relative h-full w-full [grid-area:1/1] overflow-hidden'>
          {children}
        </div>

        <div
          aria-hidden='true'
          className='
            pointer-events-none h-full w-full [grid-area:1/1]
            opacity-[var(--opacity)]
            mix-blend-soft-light
            transition-opacity duration-[var(--duration)]
            ease-[var(--easing)]
            [background:radial-gradient(circle_at_var(--m-x)_var(--m-y),rgba(255,255,255,0.85)_0%,rgba(255,255,255,0.28)_18%,transparent_58%)]
          '
        />

        <div
          aria-hidden='true'
          style={foilStyle}
          className='
            pointer-events-none relative h-full w-full [grid-area:1/1]
            opacity-[var(--opacity)]
            mix-blend-color-dodge
            transition-opacity duration-[var(--duration)]
            ease-[var(--easing)]
            [background:var(--pattern),_var(--rainbow),_var(--diagonal),_var(--shade)]
          '
        />
      </div>
    </div>
  )
}
