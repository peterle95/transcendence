/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
        mono: ['"Share Tech Mono"', 'monospace'],
      },
      colors: {
        cyber: {
          bg:      '#07070f',
          surface: '#0d0d1a',
          border:  '#1a1a35',
          cyan:    '#00e5ff',
          pink:    '#ff006e',
          purple:  '#9d00ff',
          green:   '#39ff14',
          red:     '#ff2244',
          text:    '#c8d0e8',
          muted:   '#4a5068',
        },
      },
      boxShadow: {
        'neon-cyan': '0 0 8px #00e5ff, 0 0 20px rgba(0,229,255,0.3)',
        'neon-pink': '0 0 8px #ff006e, 0 0 20px rgba(255,0,110,0.3)',
      },
    },
  },
  plugins: [],
};
