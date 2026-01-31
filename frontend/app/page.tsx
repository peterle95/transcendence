export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
      <div className="text-center text-white p-8">
        <h1 className="text-6xl font-bold mb-4">Cub3D Platform</h1>
        <p className="text-2xl mb-8">Architecture Blueprint - Coming Soon</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6">
            <h2 className="text-xl font-bold mb-2">Auth Service</h2>
            <p className="text-sm">User authentication & management</p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6">
            <h2 className="text-xl font-bold mb-2">Chat Service</h2>
            <p className="text-sm">Real-time messaging</p>
            <a 
              href="http://localhost:3001" 
              target="_blank"
              className="mt-4 inline-block bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              ✓ Visit Chat Demo
            </a>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6">
            <h2 className="text-xl font-bold mb-2">Game Service</h2>
            <p className="text-sm">Multiplayer game sessions</p>
          </div>
        </div>
      </div>
    </main>
  );
}