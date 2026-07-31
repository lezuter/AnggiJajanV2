import type { Metadata } from 'next'
import Link from 'next/link'

import HomePage from '@/app/page'
import ChromeBloomGridShader from '@/components/demo/chrome-bloom/chrome-bloom-grid-shader'

import styles from './chrome-bloom.module.css'

export const metadata: Metadata = {
  title: 'Chrome Bloom Theme Demo | Anggijajan',
  description: 'Eksplorasi tema visual Chrome Bloom untuk Anggijajan V2.'
}

export default function ChromeBloomThemeDemoPage () {
  return (
    <div
      data-theme-demo='chrome-bloom'
      className={styles.chromeBloomTheme}
    >
      <aside
        className={styles.demoIndicator}
        aria-label='Kontrol halaman demo tema Chrome Bloom'
      >
        <span className={styles.demoLabel}>Chrome Bloom theme demo</span>
        <Link
          href='/'
          className={styles.backLink}
        >
          Kembali ke halaman utama
        </Link>
      </aside>

      <div
        className={styles.shaderLayer}
        aria-hidden='true'
      >
        <ChromeBloomGridShader className={styles.shaderCanvas} />
        <div className={styles.shaderReflection} />
        <div className={styles.shaderFade} />
      </div>

      <div className={styles.pageContent}>
        <HomePage />
      </div>
    </div>
  )
}
