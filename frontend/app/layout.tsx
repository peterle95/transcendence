import './globals.css'

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
          {children}
      </body>
    </html>
  )
}