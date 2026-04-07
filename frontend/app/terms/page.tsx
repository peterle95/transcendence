export default function TermsOfService() {
	return (
		<div style={{ minHeight: '100vh', position: 'relative', display: 'flex', justifyContent: 'center', padding: '64px 16px' }}>
			<div
				style={{
					width: '100%',
					maxWidth: '800px',
					background: 'rgba(255,255,255,0.06)',
					border: '1px solid rgba(255,255,255,0.12)',
					borderRadius: '20px',
					padding: '40px 48px',
					boxSizing: 'border-box',
					backdropFilter: 'blur(20px)',
					boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
					color: '#e5e7eb'
				}}
			>
				<h1 className="text-4xl font-bold text-white mb-2">Terms of Service</h1>
				<p className="text-gray-400 mb-10">Last updated: March 2026</p>

				<section className="mb-8">
					<h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
					<p>By accessing or using this platform, you agree to be bound by these Terms of Service. If you do not agree, please do not use the platform.</p>
				</section>

				<section className="mb-8">
					<h2 className="text-xl font-semibold text-white mb-3">2. User Accounts</h2>
					<p>You are responsible for maintaining the confidentiality of your account credentials. You must not share your account or use another user's account without permission.</p>
				</section>

				<section className="mb-8">
					<h2 className="text-xl font-semibold text-white mb-3">3. Acceptable Use</h2>
					<p>You agree not to use the platform to harass other users, distribute harmful content, or attempt to compromise the security or integrity of the platform.</p>
				</section>

				<section className="mb-8">
					<h2 className="text-xl font-semibold text-white mb-3">4. Termination</h2>
					<p>We reserve the right to suspend or terminate accounts that violate these terms. You may also delete your account at any time.</p>
				</section>

				<section className="mb-8">
					<h2 className="text-xl font-semibold text-white mb-3">5. Changes to Terms</h2>
					<p>We may update these terms from time to time. Continued use of the platform after changes constitutes acceptance of the new terms.</p>
				</section>

				<section className="mb-8">
					<h2 className="text-xl font-semibold text-white mb-3">6. Contact</h2>
					<p>If you have any questions about these terms, please reach out through the platform.</p>
				</section>
			</div>
		</div>
	)
}
