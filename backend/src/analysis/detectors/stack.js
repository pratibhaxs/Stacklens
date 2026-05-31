// src/analysis/detectors/stack.js
// Detects the technology ecosystem of a repo by looking for known manifest files.
// Why detect stack first: every other analyzer needs to know what it's dealing with.
// A Python repo shouldn't run the npm parser. A Go repo can't check PyPI versions.
// Running the wrong parser produces wrong results — worse than no results.

import fs from 'fs'
import path from 'path'

// Ordered by priority — if multiple match, first one wins for primary stack
// Each entry: { files: manifests to look for, support: how well we handle it }
const STACK_DEFINITIONS = [
  {
    name: 'nodejs',
    label: 'Node.js',
    files: ['package.json'],
    support: 'full',
    versionFile: '.nvmrc',
    lockFiles: ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'],
  },
  {
    name: 'python',
    label: 'Python',
    files: ['requirements.txt', 'Pipfile', 'pyproject.toml', 'setup.py'],
    support: 'full',
    versionFile: '.python-version',
    lockFiles: ['Pipfile.lock', 'poetry.lock'],
  },
  {
    name: 'java',
    label: 'Java',
    files: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
    support: 'partial',
    lockFiles: [],
  },
  {
    name: 'go',
    label: 'Go',
    files: ['go.mod'],
    support: 'partial',
    lockFiles: ['go.sum'],
  },
  {
    name: 'rust',
    label: 'Rust',
    files: ['Cargo.toml'],
    support: 'limited',
    lockFiles: ['Cargo.lock'],
  },
  {
    name: 'ruby',
    label: 'Ruby',
    files: ['Gemfile'],
    support: 'limited',
    lockFiles: ['Gemfile.lock'],
  },
  {
    name: 'php',
    label: 'PHP',
    files: ['composer.json'],
    support: 'limited',
    lockFiles: ['composer.lock'],
  },
  {
    name: 'dotnet',
    label: '.NET',
    files: ['*.csproj', '*.sln', 'packages.config'],
    support: 'limited',
    lockFiles: [],
  },
]

// Framework detection — runs on top of stack detection
// Why: knowing it's Node.js is useful. Knowing it's Next.js + Express is better.
const FRAMEWORK_SIGNATURES = {
  nodejs: [
    { name: 'Next.js',    check: (pkg) => !!(pkg.dependencies?.next || pkg.devDependencies?.next) },
    { name: 'React',      check: (pkg) => !!(pkg.dependencies?.react) },
    { name: 'Vue',        check: (pkg) => !!(pkg.dependencies?.vue) },
    { name: 'Express',    check: (pkg) => !!(pkg.dependencies?.express) },
    { name: 'NestJS',     check: (pkg) => !!(pkg.dependencies?.['@nestjs/core']) },
    { name: 'Fastify',    check: (pkg) => !!(pkg.dependencies?.fastify) },
    { name: 'Svelte',     check: (pkg) => !!(pkg.devDependencies?.svelte) },
    { name: 'Angular',    check: (pkg) => !!(pkg.dependencies?.['@angular/core']) },
  ],
  python: [
    { name: 'Django',     check: (deps) => deps.some(d => d.toLowerCase().startsWith('django')) },
    { name: 'FastAPI',    check: (deps) => deps.some(d => d.toLowerCase().startsWith('fastapi')) },
    { name: 'Flask',      check: (deps) => deps.some(d => d.toLowerCase().startsWith('flask')) },
    { name: 'SQLAlchemy', check: (deps) => deps.some(d => d.toLowerCase().startsWith('sqlalchemy')) },
  ],
}

export function detectStack(rootDir, configFiles) {
  const stacks = []

  for (const def of STACK_DEFINITIONS) {
    const found = def.files.some(f => {
      // handle glob patterns like *.csproj
      if (f.includes('*')) {
        const ext = f.replace('*', '')
        return configFiles.some(cf => cf.name.endsWith(ext))
      }
      return fs.existsSync(path.join(rootDir, f))
    })

    if (found) {
      stacks.push({
        name: def.name,
        label: def.label,
        support: def.support,
        hasLockFile: def.lockFiles.some(lf => fs.existsSync(path.join(rootDir, lf))),
      })
    }
  }

  // Detect monorepo
  const MONOREPO_SIGNALS = ['apps', 'packages', 'services', 'libs']
  const monorepoWorkspaces = MONOREPO_SIGNALS.filter(d =>
    fs.existsSync(path.join(rootDir, d)) &&
    fs.statSync(path.join(rootDir, d)).isDirectory()
  )
  const isMonorepo = monorepoWorkspaces.length > 0

  // Detect frameworks for primary stack
  const primary = stacks[0] || null
  const frameworks = []

  if (primary?.name === 'nodejs') {
    const pkgPath = path.join(rootDir, 'package.json')
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      FRAMEWORK_SIGNATURES.nodejs.forEach(({ name, check }) => {
        if (check(pkg)) frameworks.push(name)
      })
    } catch { /* ignore */ }
  }

  if (primary?.name === 'python') {
    const reqPath = path.join(rootDir, 'requirements.txt')
    try {
      const deps = fs.readFileSync(reqPath, 'utf-8').split('\n').filter(Boolean)
      FRAMEWORK_SIGNATURES.python.forEach(({ name, check }) => {
        if (check(deps)) frameworks.push(name)
      })
    } catch { /* ignore */ }
  }

  return {
    primary,
    allStacks: stacks,
    frameworks,
    isMonorepo,
    monorepoWorkspaces,
    supportLevel: primary?.support || 'none',
    // Human-readable support message for the dashboard
    supportMessage: getSupportMessage(primary?.support, primary?.label),
  }
}

function getSupportMessage(support, label) {
  if (!support || support === 'none') {
    return 'Stack not recognized — limited analysis available'
  }
  const messages = {
    full:    `Full analysis available for ${label}`,
    partial: `Partial analysis available for ${label} — dependency CVEs may be incomplete`,
    limited: `Limited analysis for ${label} — showing git metrics and file structure only`,
  }
  return messages[support]
}
