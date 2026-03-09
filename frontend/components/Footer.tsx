import Link from 'next/link'

export default function Footer() {
	return (
		<footer className="bg-black/40 backdrop-blur border-t border-white/10">
			<div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between">
				<p className="text-gray-400 text-sm">© 2025 Antigravity. All rights reserved.</p>
				<div className="flex gap-6">
					<Link href="/privacy" className="text-gray-400 text-sm hover:text-white transition-colors">
						Privacy Policy
					</Link>
					<Link href="/terms" className="text-gray-400 text-sm hover:text-white transition-colors">
						Terms of Service
					</Link>
				</div>
			</div>
		</footer>
	)
}
