# Auth Service - Architecture Blueprint

This directory contains the architecture and database schema(blueprint) for the  authentication service.

## Structure:
- `Dockerfile` - Container configuration
- `package.json` - Dependencies specification
- `prisma/schema.prisma` - Database schema definition
- `env.example` - Environment variables template

## Status:
**Architecture Only** - No implementation code included


### Key Endpoints to Implement:
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User authentication
- `GET /api/users/:id` - Get user profile
- `GET /api/users/stats` - Get user statistics
- `GET /api/leaderboard` - Get game leaderboard

## Database:
- PostgreSQL database (`auth_db`)
- Schema defined in `prisma/schema.prisma`
- Includes User model with authentication and game statistics and friendships table
- Optimally could seperate game stats from user table

## Environment Variables:
Copy `env.example` to `.env` and configure:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT token generation
- `SERVICE_SECRET` - Inter-service authentication secret

