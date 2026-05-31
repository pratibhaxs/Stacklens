#!/bin/sh
# backend/scripts/start.sh
# Production startup script — runs migrations then starts the server.
# Used as the Railway start command instead of running node directly.
#
# Why run migrations on startup:
#   Ensures the production DB is always in sync with the schema.
#   Safe to run multiple times — prisma migrate deploy is idempotent
#   (it only applies migrations that haven't been applied yet).
#
# Why not run migrations in Dockerfile:
#   The DB isn't available during docker build, only at runtime.

set -e  # exit immediately if any command fails

echo "[startup] Running database migrations..."
npx prisma migrate deploy

echo "[startup] Starting server..."
exec node src/server.js
