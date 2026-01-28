# Game Service - Architecture Blueprint

This directory contains the architecture and database schema for the Game Service.

## Structure:
- `Dockerfile` - Container configuration
- `package.json` - Dependencies specification
- `prisma/schema.prisma` - Database schema definition

## Database:
- PostgreSQL database (`game_db`)
- Schema defined in `prisma/schema.prisma`
- Potentially includes static variables relative to the game(?)/currently includes session details

## Game Server Integration:
This service is designed to spawn and manage containerized game server instances.

## Environment Variables:
- `DATABASE_URL` - PostgreSQL connection string
- `AUTH_SERVICE_URL` - Auth service URL for user validation
- `SERVICE_SECRET` - Inter-service authentication secret
- `DOCKER_HOST` - Docker socket for spawning isolated game server containers
