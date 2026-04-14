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
				<p className="text-gray-400 mb-10">Last updated: April 2026</p>

				<section className="mb-8">
					<h2 className="text-xl font-semibold text-white mb-3">1. What This Is</h2>
					<p>This is a multiplayer browser game platform — think Battleships, playable solo, locally with up to four players, or online against others. By creating an account and using the platform, you agree to these terms.</p>
				</section>

				<section className="mb-8">
					<h2 className="text-xl font-semibold text-white mb-3">2. Your Account</h2>
					<p className="mb-3">You register with a username, email, and password. You are responsible for keeping your credentials private. Do not share your account or use someone else's.</p>
					<p>To protect the platform, registration is rate-limited and accounts may be temporarily locked after too many failed login attempts. This is a security measure, not a punishment.</p>
				</section>

				<section className="mb-8">
					<h2 className="text-xl font-semibold text-white mb-3">3. Profile and Avatars</h2>
					<p>You can upload a profile picture (JPEG or PNG, up to 2 MB). By uploading an image, you confirm you have the right to use it and that it does not contain illegal content. Your avatar is publicly accessible — anyone with the URL can view it, no login required.</p>
				</section>

				<section className="mb-8">
					<h2 className="text-xl font-semibold text-white mb-3">4. Game Stats and Leaderboard</h2>
					<p>Every game you play is recorded: the result, shots fired, ships destroyed, placement, and match duration. These stats contribute to the public leaderboard, which is visible to all users. By playing, you accept that your username and stats will appear there.</p>
				</section>

				<section className="mb-8">
					<h2 className="text-xl font-semibold text-white mb-3">5. Messaging</h2>
					<p>You can send direct messages to users on your friend list. Messages are stored indefinitely and are visible to both participants. Keep messages reasonable — harassment, threats, and spam are not acceptable. Messages are capped at 2,000 characters each.</p>
				</section>

				<section className="mb-8">
					<h2 className="text-xl font-semibold text-white mb-3">6. Friends and Blocking</h2>
					<p>You can send friend requests, accept or decline incoming ones, and block users. Blocking prevents that user from interacting with you. These actions are yours to manage freely from your profile.</p>
				</section>

				<section className="mb-8">
					<h2 className="text-xl font-semibold text-white mb-3">7. Acceptable Use</h2>
					<p className="mb-3">Don't try to break things. Attempting to exploit vulnerabilities, impersonate other users, interfere with ongoing games, or gain unfair advantages undermines the platform for everyone and is not allowed.</p>
					<p>This platform is self-hosted and non-commercial. It is not a production service with guaranteed uptime, and we make no warranties about availability or stability.</p>
				</section>

				<section className="mb-8">
					<h2 className="text-xl font-semibold text-white mb-3">8. Account Deletion and Termination</h2>
					<p className="mb-3">You can delete your account at any time from your profile settings. This permanently removes your personal data — username, email, password, avatar, friends, and messages.</p>
					<p>We reserve the right to suspend or remove accounts that repeatedly violate these terms.</p>
				</section>

				<section className="mb-8">
					<h2 className="text-xl font-semibold text-white mb-3">9. Changes</h2>
					<p>We may update these terms as the platform evolves. Continuing to use the platform after a change means you accept the updated terms.</p>
				</section>

				<section className="mb-8">
					<h2 className="text-xl font-semibold text-white mb-3">10. Contact</h2>
					<p>Questions or concerns? Reach out through the platform.</p>
				</section>
			</div>
		</div>
	)
}
