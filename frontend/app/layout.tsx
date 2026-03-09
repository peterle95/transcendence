import Header from '@/components/Header'
import Footer from '@/components/Footer'

export const metadata = {
  title: 'Pop Head Wars Game Platform',
  description: 'Pop Head Wars Game Platform',
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
