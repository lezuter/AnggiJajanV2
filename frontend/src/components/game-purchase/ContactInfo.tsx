'use client'

interface ContactInfoProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export default function ContactInfo ({
  value,
  onChange,
  disabled = false
}: ContactInfoProps) {
  return (
    <section
      aria-labelledby='contact-info-title'
      className='aj-public-glass relative rounded-[24px] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] sm:p-7'
    >
      <div className='max-w-2xl'>
        <p className='font-mono text-[10px] uppercase tracking-[0.12em] text-white/[0.42]'>
          Kontak (opsional)
        </p>
        <h2
          id='contact-info-title'
          className='mt-2 text-2xl font-medium tracking-[-0.03em] text-white sm:text-[28px]'
        >
          Informasi kontak
        </h2>
        <p className='mt-2 text-sm leading-6 text-white/[0.5]'>
          Pemberitahuan status dan bukti transaksi akan dikirimkan melalui email atau WhatsApp.
        </p>
      </div>

      <div className='mt-6 max-w-2xl'>
        <label
          htmlFor='contact-input'
          className='text-xs font-medium text-white/[0.68]'
        >
          Email / Nomor WhatsApp
        </label>
        <input
          id='contact-input'
          type='text'
          value={value}
          disabled={disabled}
          onChange={e => onChange(e.target.value)}
          placeholder='Masukkan email atau nomor WhatsApp'
          className='mt-3 h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 text-sm text-white outline-none transition-[border-color,background-color,box-shadow] duration-300 placeholder:text-white/[0.28] hover:border-white/[0.14] focus:!outline-none focus:border-fuchsia-400/55 focus:bg-fuchsia-400/[0.025] focus:shadow-[0_0_0_3px_rgba(232,121,249,0.10),0_0_24px_rgba(217,70,239,0.08)] disabled:cursor-not-allowed disabled:opacity-40 disabled:bg-white/[0.015] disabled:border-white/[0.05]'
        />
        
      </div>
    </section>
  )
}