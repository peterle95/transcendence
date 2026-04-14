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
				<p className="text-gray-400 mb-10">Last updated: April 2026</p>

				<section className="mb-8">
					<h2 className="text-xl font-semibold text-white mb-3">1. What We Collect</h2>
					<p className="mb-3">When you create an account, we store your username, email address, and a hashed version of your password — the raw password is never stored. If you upload a profile picture, the image file is stored on our server (JPEG or PNG, up to 2 MB).</p>
					<p>As you use the platform, we also accumulate gameplay data tied to your account: match history, wins and losses, shots fired and hit, ships destroyed and lost, and overall placement across games. Your friend list and the status of each relationship (pending, accepted, or blocked) are stored as well.</p>
				</section>

				<section className="mb-8">
					<h2 className="text-xl font-semibold text-white mb-3">2. Messages</h2>
					<p>Direct messages you send to other users are stored in our database and are not deleted when a conversation ends. Each message includes the sender, the recipient, the content (up to 2,000 characters), and a timestamp. Messages are only accessible to the two people in the conversation.</p>
				</section>

				<section className="mb-8">
					<h2 className="text-xl font-semibold text-white mb-3">3. How We Use Your Data</h2>
					<p className="mb-3">Your data exists to make the platform work — logging you in, showing your profile and stats, running games, delivering messages in real time, and managing your friendships. We do not use it for advertising, profiling, or any purpose beyond operating the platform itself.</p>
					<p>Game statistics are used to build the public leaderboard. Your username and stats will be visible there to all users. Your avatar is served publicly by URL; no login is required to view it.</p>
				</section>

				<section className="mb-8">
					<h2 className="text-xl font-semibent text-white mb-3">4. Authentication and Sessions</h2>
					<p>When you log in, a signed JWT session token is created and stored in an HTTP-only cookie — it cannot be read by JavaScript in the browser. Sessions expire after 24 hours. There is no server-side session store; the token itself carries your identity. It is verified on every API request and WebSocket connection.</p>
				</section>

				<section className="mb-8">
					<h2 className="text-xl font-semibold text-white mb-3">5. How Data Is Stored</h2>
					<p>Account data, game sessions, and friend relationships are stored in PostgreSQL databases. Chat messages are stored in a separate MongoDB database. Avatar images are stored as files on the server. All databases run within our own infrastructure — we do not use any external cloud storage or third-party data processors.</p>
				</section>

				<section className="mb-8">
					<h2 className="text-xl font-semibold text-white mb-3">6. Third Parties</h2>
					<p>We do not share, sell, or transmit your personal data to any third party. There are no external analytics services, advertising networks, or OAuth providers involved. All services (authentication, game, chat) run entirely within our own infrastructure and communicate only with each other.</p>
				</section>

				<section className="mb-8">
					<h2 className="text-xl font-semibold text-white mb-3">7. Data Retention and Deletion</h2>
					<p className="mb-3">Your data is kept for as long as your account exists. You can delete your account at any time from your profile settings. Doing so permanently removes your username, email, hashed password, avatar, friend list, and chat messages from our systems.</p>
					<p>Game session records (match history, scores, placements) may be retained after deletion to preserve the integrity of the leaderboard history.</p>
				</section>

				<section className="mb-8">
					<h2 className="text-xl font-semibold text-white mb-3">8. Your Rights</h2>
					<p>You can update your username, email, and avatar at any time from your profile. You can block other users, remove friends, and delete your account yourself — no need to contact us. If you have questions about your data that aren't covered here, reach out through the platform.</p>
				</section>

				<section className="mb-8">
					<h2 className="text-xl font-semibold text-white mb-3">9. Contact</h2>
					<p>Questions about this policy? Send us a message through the platform.</p>
				</section>
			</div>
		</div>
	)
}
