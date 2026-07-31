import type { Metadata } from 'next'
import Link from 'next/link'

import HomePage from '@/app/page'

import styles from './orchid-theme.module.css'

export const metadata: Metadata = {
  title: 'Orchid Theme Demo | Anggijajan',
  description: 'Eksplorasi tema visual Orchid untuk Anggijajan V2.'
}

export default function OrchidThemeDemoPage () {
  return (
    <div
      data-theme-demo='orchid'
      className={styles.orchidTheme}
    >
      <aside
        className={styles.demoIndicator}
        aria-label='Kontrol halaman demo tema Orchid'
      >
        <span className={styles.demoLabel}>Orchid theme demo</span>
        <Link
          href='/'
          className={styles.backLink}
        >
          Kembali ke halaman utama
        </Link>
      </aside>

      <div className={styles.pageContent}>
        <HomePage />
      </div>
    </div>
  )
}
