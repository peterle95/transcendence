# Frontend - Architecture Blueprint


## Structure:
- `Dockerfile` - Container configuration
- `package.json` - Dependencies specification
- `next.config.js` - Next.js configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `postcss.config.js` - PostCSS configuration
- `jsconfig.json` - JavaScript configuration
- `env.example` - Environment variables template


### Service Integration:
- **Auth Service** (`http://auth_srvc:3000`) - User authentication
- **Chat Service** (`http://chat_srvc:3001`) - Real-time messaging
- **Game Service** (`http://game_srvc:3002`) - Game session management

## Environment Variables:
Copy `env.example` to `.env` and configure:
- `AUTH_SERVICE_URL` - Internal auth service URL
- `CHAT_SERVICE_URL` - Internal chat service URL
- `NEXT_PUBLIC_CHAT_SERVICE_URL` - Public chat service URL (browser access)
- `NODE_ENV` - Environment (development/production)
