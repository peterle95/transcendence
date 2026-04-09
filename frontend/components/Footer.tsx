import Link from 'next/link'

export default function Footer() {
  return (
    <footer
      style={{
        position: 'relative',
        zIndex: 10,
        borderTop: '1px solid rgba(255,255,255,0.08)',
        background: 'transparent',
        backdropFilter: 'blur(4px)',
      }}
    >
      <style>{`
        .footer-link {
          color: rgba(255,255,255,0.45);
          font-size: 0.8rem;
          text-decoration: none;
          transition: color 0.2s;
        }
        .footer-link:hover {
          color: #a78bfa;
        }
      `}</style>

      <div
        style={{
          maxWidth: '1152px',
          margin: '0 auto',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >

        <div style={{ display: 'flex', gap: '20px' }}>
          <Link href="/privacy" className="footer-link">
            Privacy Policy
          </Link>
          <Link href="/terms" className="footer-link">
            Terms of Service
          </Link>
        </div>
      </div>
    </footer>
  )
}