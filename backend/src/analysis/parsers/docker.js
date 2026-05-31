// src/analysis/parsers/docker.js
// Parses Dockerfiles as plain text — never executes them.
// Why plain text parsing: Dockerfiles are structured text. No library needed.
// Line-by-line parsing handles all edge cases: multi-stage, FROM scratch,
// malformed files, missing files — all without crashing.

import fs from 'fs'
import path from 'path'

export function parseDockerfile(rootDir, configFiles) {
  // Look for Dockerfile in root and common subdirectories
  const possiblePaths = [
    path.join(rootDir, 'Dockerfile'),
    path.join(rootDir, 'dockerfile'),
    path.join(rootDir, 'docker', 'Dockerfile'),
    path.join(rootDir, '.docker', 'Dockerfile'),
  ]

  const dockerfilePath = possiblePaths.find(p => fs.existsSync(p))

  if (!dockerfilePath) {
    return { found: false, hasDocker: false }
  }

  let lines
  try {
    lines = fs.readFileSync(dockerfilePath, 'utf-8').split('\n')
  } catch (e) {
    return { found: true, hasDocker: true, parseError: e.message }
  }

  // Parse FROM statements — multiple = multi-stage build
  const fromStatements = lines
    .map(l => l.trim())
    .filter(l => l.toUpperCase().startsWith('FROM'))
    .map(l => {
      const parts = l.split(/\s+/)
      return {
        image:    parts[1] || 'unknown',
        alias:    parts[3] || null,          // "AS builder" alias
        isScatch: parts[1] === 'scratch',
      }
    })

  // Extract base image names for issue detection
  const baseImages = fromStatements.map(f => f.image)

  // Detect issues
  const issues = []

  // Using 'latest' tag is bad practice — unpredictable builds
  const latestImages = baseImages.filter(img => img.endsWith(':latest') || !img.includes(':'))
  if (latestImages.length > 0) {
    issues.push({
      severity: 'medium',
      issue: `Using 'latest' or untagged base image: ${latestImages.join(', ')}`,
      fix: 'Pin base images to specific versions for reproducible builds',
    })
  }

  // Running as root (no USER instruction)
  const hasUserInstruction = lines.some(l => l.trim().toUpperCase().startsWith('USER'))
  if (!hasUserInstruction && fromStatements.length > 0) {
    issues.push({
      severity: 'medium',
      issue: 'No USER instruction — container runs as root by default',
      fix: 'Add "USER nonroot" or create a dedicated user',
    })
  }

  // No HEALTHCHECK
  const hasHealthcheck = lines.some(l => l.trim().toUpperCase().startsWith('HEALTHCHECK'))
  if (!hasHealthcheck) {
    issues.push({
      severity: 'low',
      issue: 'No HEALTHCHECK instruction',
      fix: 'Add a HEALTHCHECK for container orchestration health monitoring',
    })
  }

  // COPY . . (copies everything, often includes secrets/node_modules)
  const hasBroadCopy = lines.some(l => l.trim().match(/^COPY\s+\.\s+\./i))
  if (hasBroadCopy) {
    issues.push({
      severity: 'low',
      issue: 'COPY . . copies entire directory — ensure .dockerignore excludes sensitive files',
      fix: 'Verify .dockerignore excludes .env, node_modules, .git, secrets',
    })
  }

  // Check for .dockerignore
  const hasDockerignore = fs.existsSync(path.join(rootDir, '.dockerignore'))

  return {
    found: true,
    hasDocker: true,
    isMultiStage: fromStatements.length > 1,
    stageCount: fromStatements.length,
    baseImages,
    fromStatements,
    hasDockerignore,
    hasHealthcheck,
    issues,
    issueCount: issues.length,
  }
}

// Parses docker-compose.yml to understand service architecture
export function parseDockerCompose(rootDir) {
  const composePaths = [
    path.join(rootDir, 'docker-compose.yml'),
    path.join(rootDir, 'docker-compose.yaml'),
  ]

  const composePath = composePaths.find(p => fs.existsSync(p))
  if (!composePath) return { found: false }

  try {
    const content = fs.readFileSync(composePath, 'utf-8')

    // Count services — rough parse, no YAML library needed
    const serviceLines = content.match(/^  [a-zA-Z0-9_-]+:$/gm) || []

    return {
      found: true,
      serviceCount: serviceLines.length,
      services: serviceLines.map(l => l.trim().replace(':', '')),
      hasVolumes: content.includes('volumes:'),
      hasNetworks: content.includes('networks:'),
    }
  } catch (e) {
    return { found: true, parseError: e.message }
  }
}
