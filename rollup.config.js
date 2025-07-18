import { execSync } from 'node:child_process'
import globals from '@jbrowse/core/ReExports/list'
import { createRollupConfig } from '@jbrowse/development-tools'
import commonjs from '@rollup/plugin-commonjs'
import copy from 'rollup-plugin-copy'
import css from 'rollup-plugin-import-css'

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

const configs = createRollupConfig(globals.default, {
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
  const commonjsIndex = config.plugins.findIndex(plugin => plugin.name === 'commonjs')
  config.plugins[commonjsIndex] = commonjs({
    ignoreDynamicRequires: true,
  })
  config.plugins.push(
    css({
      transform: postcssTransform,
    }),
    copy({
      targets: [{
        src: 'node_modules/onnxruntime-web/dist/ort-*.{js,mjs,wasm}',
        dest: 'dist'
      }]
    })
  )
})

export default configs
