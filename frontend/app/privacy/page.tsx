export default function PrivacyPolicy() {
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
				<h1 className="text-4xl font-bold text-white mb-2">Privacy Policy</h1>
				<p className="text-gray-400 mb-10">Last updated: March 2026</p>

				<section className="mb-8">
					<h2 className="text-xl font-semibold text-white mb-3">1. Information We Collect</h2>
					<p>We collect information you provide when creating an account, such as your username and password. We also collect basic usage data to keep the platform running.</p>
				</section>

				<section className="mb-8">
					<h2 className="text-xl font-semibold text-white mb-3">2. How We Use Your Information</h2>
					<p>Your information is used solely to operate and improve the platform — managing your account, enabling gameplay, and facilitating chat between users.</p>
				</section>

				<section className="mb-8">
					<h2 className="text-xl font-semibold text-white mb-3">3. Data Sharing</h2>
					<p>We do not sell or share your personal data with third parties. Your data stays within the platform.</p>
				</section>

				<section className="mb-8">
					<h2 className="text-xl font-semibold text-white mb-3">4. Data Retention</h2>
					<p>Your data is retained as long as your account is active. You may request account deletion at any time, after which your data will be permanently removed.</p>
				</section>

				<section className="mb-8">
					<h2 className="text-xl font-semibold text-white mb-3">5. Contact</h2>
					<p>If you have any questions about this policy, please reach out through the platform.</p>
				</section>
			</div>
		</div>
	)
}
