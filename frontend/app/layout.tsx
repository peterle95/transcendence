import Header from '@/components/Header'
import Footer from '@/components/Footer'

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
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  )
}
