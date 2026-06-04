// src/analysis/architecture/ast-parser.js
// Parses JavaScript and TypeScript files using @babel/parser.
// Extracts: imports, exports, function count, class count, line count.
// This is the foundation everything else in architecture analysis builds on.
//
// Why @babel/parser over alternatives:
//   - Handles modern JS: ES2022, JSX, TypeScript, decorators
//   - Same parser used by Prettier and Babel itself — battle-tested
//   - Returns a clean AST we can traverse with @babel/traverse
//   - Supports both .js and .ts without separate parsers

import { readFileSync } from 'fs'
import { parse }        from '@babel/parser'

// Extensions this parser handles
export const PARSEABLE_EXTENSIONS = new Set([
  '.js', '.jsx', '.mjs', '.cjs',
  '.ts', '.tsx', '.mts', '.cts',
])

// Parse a single file and extract architectural metrics
export function parseFile(filePath) {
  let content
  try {
    content = readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }

  // Skip very large files — likely generated
  if (content.length > 200_000) return null

  let ast
  try {
    ast = parse(content, {
      sourceType:  'module',
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction:  true,
      plugins: [
        'jsx',
        'typescript',
        'decorators-legacy',
        'classProperties',
        'classPrivateProperties',
        'classPrivateMethods',
        'dynamicImport',
        'optionalChaining',
        'nullishCoalescingOperator',
        'objectRestSpread',
      ],
      errorRecovery: true,  // continue parsing even with syntax errors
    })
  } catch {
    return null
  }

  // Walk the AST and collect metrics
  const metrics = {
    filePath,
    imports:       [],   // { source, specifiers }
    exports:       [],   // named exports
    functions:     [],   // function names
    classes:       [],   // class names + method counts
    linesOfCode:   content.split('\n').length,
    logicalLines:  content.split('\n').filter(l => l.trim() && !l.trim().startsWith('//')).length,
  }

  walkAST(ast, metrics)

  return metrics
}

// Simple AST walker — no @babel/traverse needed for our use case
// Why manual walk: @babel/traverse has ESM/CJS interop issues in Node 20
// Manual recursion over the AST nodes is just as effective for our metrics
function walkAST(node, metrics, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 50) return

  switch (node.type) {

    // import statements: import X from 'y', import { X } from 'y'
    case 'ImportDeclaration': {
      const source     = node.source?.value || ''
      const specifiers = (node.specifiers || []).map(s =>
        s.local?.name || s.imported?.name || '*'
      )
      metrics.imports.push({ source, specifiers })
      break
    }

    // require() calls: const x = require('y')
    case 'CallExpression': {
      if (
        node.callee?.name === 'require' &&
        node.arguments?.[0]?.type === 'StringLiteral'
      ) {
        metrics.imports.push({
          source:     node.arguments[0].value,
          specifiers: [],
          isRequire:  true,
        })
      }
      break
    }

    // Named exports: export const x = ..., export function x() {}
    case 'ExportNamedDeclaration': {
      if (node.declaration?.id?.name) {
        metrics.exports.push(node.declaration.id.name)
      }
      if (node.declaration?.declarations) {
        node.declaration.declarations.forEach(d => {
          if (d.id?.name) metrics.exports.push(d.id.name)
        })
      }
      break
    }

    // Function declarations: function foo() {}
    case 'FunctionDeclaration': {
      if (node.id?.name) metrics.functions.push(node.id.name)
      break
    }

    // Arrow functions assigned to variables: const foo = () => {}
    case 'VariableDeclarator': {
      if (
        node.id?.name &&
        (node.init?.type === 'ArrowFunctionExpression' ||
         node.init?.type === 'FunctionExpression')
      ) {
        metrics.functions.push(node.id.name)
      }
      break
    }

    // Class declarations: class Foo {}
    case 'ClassDeclaration':
    case 'ClassExpression': {
      const className = node.id?.name || 'anonymous'
      const methods   = (node.body?.body || [])
        .filter(m => m.type === 'ClassMethod' || m.type === 'ClassPrivateMethod')
        .map(m => m.key?.name || m.key?.id?.name || 'method')

      metrics.classes.push({
        name:        className,
        methods,
        methodCount: methods.length,
        // Properties = likely data fields
        properties: (node.body?.body || [])
          .filter(m => m.type === 'ClassProperty' || m.type === 'ClassPrivateProperty')
          .length,
      })
      break
    }
  }

  // Recurse into child nodes
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'loc' || key === 'start' || key === 'end') continue
    const child = node[key]
    if (Array.isArray(child)) {
      child.forEach(c => walkAST(c, metrics, depth + 1))
    } else if (child && typeof child === 'object' && child.type) {
      walkAST(child, metrics, depth + 1)
    }
  }
}
