import packageJSON from './package.json' with { type: 'json' }

import { execSync } from 'node:child_process'
import globals from '@jbrowse/core/ReExports/list'
import { createRollupConfig } from '@jbrowse/development-tools'
import alias from '@rollup/plugin-alias'
import css from 'rollup-plugin-import-css'
import { importAsString } from 'rollup-plugin-string-import'

function postcssTransform(code) {
  return execSync('npx postcss', {
    input: code,
    encoding: 'utf8',
  })
}

function stringToBoolean(string) {
  if (string === undefined) {
    return undefined
  }
  if (string === 'true') {
    return true
  }
  if (string === 'false') {
    return false
  }
  throw new Error('unknown boolean string')
}

const includeUMD = stringToBoolean(process.env.JB_UMD)
const includeCJS = stringToBoolean(process.env.JB_CJS)
const includeESMBundle = stringToBoolean(process.env.JB_ESM_BUNDLE)
const includeNPM = stringToBoolean(process.env.JB_NPM)

const configs = createRollupConfig(globals, {
  includeUMD,
  includeCJS,
  includeESMBundle,
  includeNPM,
})

const ignoreWarningCodes = [
  'MODULE_LEVEL_DIRECTIVE',  // removes 'use client' directives for bundling
  'THIS_IS_UNDEFINED',  // replaces top-level `this` with `undefined`
]
const ignoreWarningPrefixes = [
  'Circular dependency: node_modules/',  // 3rd party circulars not our problem
  'Circular dependency: \x00polyfill-node.'  // rollup-plugin-polyfill-node
]

configs.forEach(config => {
  config.onwarn = (warning, warn) => {
    if (
      ignoreWarningCodes.includes(warning.code) ||
      ignoreWarningPrefixes.some(prefix => warning.message.startsWith(prefix))
    ) {
      return
    }
    warn(warning)
  }
  config.output.forEach(output => {
    if (output.format === 'umd') {
      output.name = `JBrowsePlugin${packageJSON['jbrowse-plugin'].name}`
    }
  })

  /* Omit certain imports by dependencies */
  const innerExternal = config.external.bind()
  config.external = id => innerExternal(id) || [
    'fast-glob',  // Node only
  ].includes(id)

  /* Manage Node.js resolutions for browser */
  const polyfillNodeIdx = config.plugins.findIndex(
    plugin => plugin.name === 'polyfill-node'
  )

  if (polyfillNodeIdx !== -1) {  // not a Node.js build

    /* Package aliasing */
    const nodeResolveIdx = config.plugins.findIndex(
      plugin => plugin.name === 'node-resolve'
    )
    config.plugins.splice(nodeResolveIdx, 0, alias({
      entries: [

        // custom shims for Node.js builtins
        { find: 'node:child_process', replacement: '@/shims/child_process' },
        { find: 'node:fs/promises', replacement: '@/shims/empty' },

        // rollup-plugin-polyfill-node doesn't handle "node:" prefix
        { find: /^node:([^/]*)$/, replacement: '$1' },

        // temporary workaround for deepagents -> langsmith dep
        { find: 'langsmith/experimental/sandbox', replacement: 'langsmith/sandbox' },

        // temporary for MCP-B Zod 3->4 transition
        { find: 'zod-to-json-schema', replacement: '@/shims/zod-to-json-schema' },
      ],
    }))
  }

  /* Import markdown files as strings */
  config.plugins.push(
    importAsString({
      include: '**/*.md',
    })
  )

  /* Build, Minify, & Inject CSS */
  config.plugins.push(
    css({
      transform: postcssTransform,
    })
  )
})

export default configs
