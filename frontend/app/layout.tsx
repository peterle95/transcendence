import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import GlobalBackground from '@/components/GlobalBackground'
import DevAuthBypass from '@/components/DevAuthBypass' // remove this for production

export const metadata = {
  title: 'Space Supremacy',
  description: 'Keep the Galaxy under your domain by defeating challengers Space Fleets',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <DevAuthBypass />
        <GlobalBackground />
        <Header />
        <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
          {children}
        </div>
        <Footer />
      </body>
    </html>
  )
}

