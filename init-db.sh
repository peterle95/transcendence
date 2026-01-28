#!/bin/bash
# PostgreSQL Initialization Script
# Creates multiple databases for different services

set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    -- Auth Service Database
    CREATE DATABASE auth_db;
    GRANT ALL PRIVILEGES ON DATABASE auth_db TO postgres;
    
    -- Game Service Database  
    CREATE DATABASE game_db;
    GRANT ALL PRIVILEGES ON DATABASE game_db TO postgres;
    
    -- List all databases
    \list
EOSQL

echo "✅ PostgreSQL databases initialized successfully"
