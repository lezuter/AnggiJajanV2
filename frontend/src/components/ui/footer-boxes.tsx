'use client'

import React from 'react'
import { motion } from 'framer-motion'

const columnCount = 26
const rowCount = 14
const cells = Array.from({ length: columnCount * rowCount })

const gridBlue = 'rgba(26, 128, 255, 0.18)'
const intersectionBlue = 'rgba(26, 128, 255, 0.24)'
const hoverMagenta = 'rgba(255, 51, 204, 0.22)'

function FooterBoxesCore ({
  className,
  enabled = true
}: {
  className?: string
  enabled?: boolean
}) {
  if (!enabled) return null

  return (
    <div
      aria-hidden='true'
      className={['absolute inset-0 overflow-hidden', className]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className='absolute -inset-x-24 -inset-y-20 grid origin-center border-l border-t'
        style={{
          borderColor: gridBlue,
          gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))`,
          transform: 'rotate(-2.25deg) skewY(-4.5deg) scale(1.06) translateZ(0)'
        }}
      >
        {cells.map((_, index) => {
          const columnIndex = index % columnCount
          const rowIndex = Math.floor(index / columnCount)
          const showIntersection = columnIndex % 2 === 0 && rowIndex % 2 === 0

          return (
            <motion.div
              key={`footer-box-${columnIndex}-${rowIndex}`}
              className='pointer-events-auto relative border-b border-r'
              style={{ borderColor: gridBlue }}
              initial={false}
              animate={{
                backgroundColor: 'rgba(0, 0, 0, 0)'
              }}
              whileHover={{
                backgroundColor: hoverMagenta,
                transition: {
                  duration: 0
                }
              }}
              transition={{
                duration: 1.6,
                ease: 'easeOut'
              }}
            >
              {showIntersection && (
                <svg
                  aria-hidden='true'
                  viewBox='0 0 24 24'
                  fill='none'
                  className='pointer-events-none absolute -left-3 -top-3 h-6 w-6'
                  style={{ color: intersectionBlue }}
                >
                  <path
                    d='M12 5v14M5 12h14'
                    stroke='currentColor'
                    strokeWidth='1'
                    strokeLinecap='round'
                  />
                </svg>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

export const FooterBoxes = React.memo(FooterBoxesCore)
