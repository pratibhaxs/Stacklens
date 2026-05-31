// src/lib/prisma.js
// Why a singleton: Node's module cache means this file runs once.
// Without this, every file that imports prisma creates a new connection pool.
// In dev with --watch (hot reload), you'd quickly exhaust DB connections.
// This pattern is the official Prisma recommendation for Node.js apps.

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']  // log SQL queries in dev so you can see what's happening
    : ['error'],                   // only log errors in production
})

export default prisma
