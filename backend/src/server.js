// src/server.js
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import scansRouter   from './routes/scans.js'
import historyRouter from './routes/history.js'

const app  = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})

app.use('/api/scans',   scansRouter)
app.use('/api/history', historyRouter)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: Math.round(process.uptime()) })
})

app.use((_req, res) => res.status(404).json({ error: 'Not found' }))

// eslint-disable-next-line no-unused-vars
app.use((error, _req, res, _next) => {
  console.error('[server] Unhandled error:', error)
  res.status(500).json({
    error:   'Internal server error',
    ...(process.env.NODE_ENV === 'development' ? { details: error.message } : {}),
  })
})

app.listen(PORT, () => {
  console.log(`[server] Running on http://localhost:${PORT}`)
  console.log(`[server] Environment: ${process.env.NODE_ENV || 'development'}`)
})

export default app
