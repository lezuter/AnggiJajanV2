'use client'

import { useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface TabItem {
  id: string
  label: string
}

interface GreenTabsProps {
  tabs: TabItem[]
  activeTab: string
  onChange: (id: string) => void
}

export default function GreenTabs({ tabs = [], activeTab, onChange }: GreenTabsProps) {
  const [dimensions, setDimensions] = useState({ left: 0, width: 0, contentWidth: 0 })
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([])
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const items = tabs.length > 0 ? tabs : [{ id: 'Semua', label: 'Semua' }]
  const activeIndex = items.findIndex(t => t.id === activeTab)

  useEffect(() => {
    const measure = () => {
      if (activeIndex === -1 || !tabsRef.current[activeIndex] || !scrollContainerRef.current) return

      const currentTab = tabsRef.current[activeIndex]
      setDimensions({
        left: currentTab.offsetLeft,
        width: currentTab.offsetWidth,
        contentWidth: scrollContainerRef.current.scrollWidth
      })
    }

    measure()
    window.addEventListener('resize', measure)
    const timer = setTimeout(measure, 100)
    return () => {
      window.removeEventListener('resize', measure)
      clearTimeout(timer)
    }
  }, [activeTab, items, activeIndex])

  const Y_BOT = 38.5
  const Y_TOP = 0.5
  const R = 8
  const K = 4.418
  const L = dimensions.left
  const W = dimensions.width

  const fillPath = `M ${L - R} ${Y_BOT} C ${L - R + K} ${Y_BOT} ${L} ${31.5 + K} ${L} 31.5 V 8.5 C ${L} ${8.5 - K} ${L + R - K} ${Y_TOP} ${L + R} ${Y_TOP} H ${L + W - R} C ${L + W - R + K} ${Y_TOP} ${L + W} ${8.5 - K} ${L + W} 8.5 V 31.5 C ${L + W} ${31.5 + K} ${L + W + R - K} ${Y_BOT} ${L + W + R} ${Y_BOT} V 45 H ${L - R} Z`
  const strokePath = `M -5000 ${Y_BOT} H ${L - R} C ${L - R + K} ${Y_BOT} ${L} ${31.5 + K} ${L} 31.5 V 8.5 C ${L} ${8.5 - K} ${L + R - K} ${Y_TOP} ${L + R} ${Y_TOP} H ${L + W - R} C ${L + W - R + K} ${Y_TOP} ${L + W} ${8.5 - K} ${L + W} 8.5 V 31.5 C ${L + W} ${31.5 + K} ${L + W + R - K} ${Y_BOT} ${L + W + R} ${Y_BOT} H 10000`

  return (
    <div className='w-full relative h-[39px] font-sans overflow-visible'>
      <div ref={scrollContainerRef} className='flex items-end w-full h-full relative no-scrollbar overflow-y-visible'>
        <div className='flex items-end relative min-w-full h-full overflow-visible'>
          
          {/* LAYER 1: BG HITAM */}
          <div className='absolute top-0 left-0 h-[39px] pointer-events-none z-0'>
            <svg width={dimensions.contentWidth || '100%'} height='39' fill='none' style={{ overflow: 'visible' }}>
              <motion.path 
                d={fillPath} 
                fill='#000000' 
                animate={{ d: fillPath }} 
                transition={{ type: 'spring', stiffness: 400, damping: 35 }} 
              />
            </svg>
          </div>

          {/* LAYER 2: BUTTONS (Motion Enhanced) */}
          {items.map((tab, index) => {
            const isActive = activeTab === tab.id
            
            // 🔥 Logic Radius Dinamis
            let currentRadius = '0px'
            if (!isActive) {
              if (index === activeIndex + 1) {
                currentRadius = '8px 8px 0px 8px' 
              } else if (index === activeIndex - 1) {
                currentRadius = '8px 8px 8px 0px' 
              } else {
                currentRadius = '8px 8px 0px 0px'
              }
            }

            return (
              <motion.button
                key={tab.id}
                ref={el => { tabsRef.current[index] = el }}
                onClick={() => onChange(tab.id)}
                // 🔥 Animate radius biar "meleleh"
                animate={{ borderRadius: currentRadius }}
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                className={`relative h-[39px] flex items-center justify-center px-6 transition-all duration-300 whitespace-nowrap z-10 font-sans text-[15px] outline-none border
                  ${isActive 
                    ? 'border-transparent text-white pt-1' 
                    : 'border-[0.5px] border-[#707170] text-[#8A9886] hover:text-white bg-[#0D0D0D]'
                  }
                `}
                style={{ marginRight: '0px' }}
              >
                {/* Efek Hover Text */}
                <span className="relative z-20">{tab.label}</span>
                
                {/* Glow halus pas hover (Opsional) */}
                {!isActive && (
                  <motion.div 
                    className="absolute inset-0 bg-white/[0.02] opacity-0 hover:opacity-100 transition-opacity rounded-[inherit]"
                  />
                )}
              </motion.button>
            )
          })}

          {/* LAYER 3: STROKE IJO */}
          <div className='absolute top-0 left-0 h-[39px] pointer-events-none z-20 w-full overflow-visible'>
            <svg width='100%' height='39' fill='none' style={{ overflow: 'visible' }}>
              <motion.path 
                d={strokePath} 
                stroke='#9EFFBA' 
                strokeWidth='1.2' 
                strokeLinecap='round' 
                strokeLinejoin='round' 
                fill='none' 
                animate={{ d: strokePath }} 
                transition={{ type: 'spring', stiffness: 400, damping: 35 }} 
              />
            </svg>
          </div>

        </div>
      </div>
    </div>
  )
}