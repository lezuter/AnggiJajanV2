'use client'

interface CheckoutStepperProps {
  currentStep: number
}

const steps = [
  {
    step: 1,
    title: 'Data akun'
  },
  {
    step: 2,
    title: 'Pilih nominal'
  },
  {
    step: 3,
    title: 'Pembayaran'
  }
]

export default function CheckoutStepper ({
  currentStep
}: CheckoutStepperProps) {
  return (
    <nav
      aria-label='Progres pembelian'
      className='rounded-[22px] border border-white/[0.08] bg-black/[0.035] px-5 py-4 shadow-[0_18px_55px_rgba(0,0,0,0.18)] backdrop-blur-md backdrop-saturate-150 sm:px-6'
    >
      <ol className='flex min-w-0 items-start'>
        {steps.map(({ step, title }, index) => {
          const isCompleted = step < currentStep
          const isActive = step === currentStep

          return (
            <li
              key={step}
              className={`flex min-w-0 items-start ${
                index < steps.length - 1 ? 'flex-1' : ''
              }`}
            >
              <div className='flex min-w-0 flex-col items-center gap-2 sm:flex-row sm:gap-3'>
                <span
                  aria-current={isActive ? 'step' : undefined}
                  className={`
                    relative flex h-7 w-7 shrink-0 items-center justify-center
                    rounded-full border font-mono text-[9px]
                    transition-[border-color,background-color,color,box-shadow]
                    duration-300
                    ${
                      isCompleted
                        ? 'border-fuchsia-300/45 bg-fuchsia-300/15 text-fuchsia-200'
                        : isActive
                          ? 'border-fuchsia-300/55 bg-fuchsia-300/10 text-fuchsia-200 shadow-[0_0_18px_rgba(232,121,249,0.16)]'
                          : 'border-white/[0.1] bg-white/[0.025] text-white/[0.34]'
                    }
                  `}
                >
                  {isCompleted ? (
                    <svg
                      aria-hidden='true'
                      viewBox='0 0 20 20'
                      fill='none'
                      className='h-3.5 w-3.5'
                    >
                      <path
                        d='m5.5 10.2 2.8 2.8 6.2-6.4'
                        stroke='currentColor'
                        strokeWidth='1.7'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                      />
                    </svg>
                  ) : (
                    step
                  )}
                </span>

                <span
                  className={`
                    whitespace-nowrap text-center font-mono text-[8px]
                    uppercase tracking-[0.1em] sm:text-left sm:text-[9px]
                    ${
                      isActive
                        ? 'text-white/[0.75]'
                        : isCompleted
                          ? 'text-white/[0.58]'
                          : 'text-white/[0.3]'
                    }
                  `}
                >
                  {title}
                </span>
              </div>

              {index < steps.length - 1 && (
                <div className='mx-2 mt-3.5 h-px min-w-4 flex-1 overflow-hidden bg-white/[0.08] sm:mx-4'>
                  <div
                    className={`
                      h-full origin-left bg-gradient-to-r
                      from-fuchsia-300/60 to-violet-300/35
                      transition-transform duration-500
                      ${
                        isCompleted
                          ? 'scale-x-100'
                          : 'scale-x-0'
                      }
                    `}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}