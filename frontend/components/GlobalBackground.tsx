'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'

const PixelBlast = dynamic(() => import('@/components/PixelBlast'), {
  ssr: false,
})

export default function GlobalBackground() {
  const pathname = usePathname()

  // Define colors based on route
  const isBlueRoute = pathname?.startsWith('/profile') || pathname?.startsWith('/friends')
  const baseColor = isBlueRoute ? '#2563eb' : '#592deb'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        background: '#07070f',
        pointerEvents: 'none',
      }}
    >
      <PixelBlast
        variant="square"
        pixelSize={2}
        color={baseColor}
        patternScale={3.75}
        patternDensity={1.2}
        pixelSizeJitter={0.4}
        enableRipples
        rippleSpeed={0.4}
        rippleThickness={0.12}
        rippleIntensityScale={1.5}
        liquid={false}
        speed={0.5}
        edgeFade={0.25}
        transparent
      />
    </div>
  )
}
