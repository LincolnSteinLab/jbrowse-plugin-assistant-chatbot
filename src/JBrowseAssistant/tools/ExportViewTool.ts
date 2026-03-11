import type { AbstractViewModel } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { z } from 'zod'

import { createTool } from './base'

/**
 * Export a view to SVG (or PNG where possible).
 *
 * Factory args:
 *  - session: the session model (used to lookup views)
 *  - views: AbstractViewModel[] (current session views)
 *
 * Notes:
 *  - If the view model provides exportSvg(opts) we call it (many views do).
 *  - For LinearGenomeView we attempt to import the renderToSvg helper from
 *    @jbrowse/plugin-linear-genome-view and serialize the returned React SVG
 *    element using react-dom/server.renderToStaticMarkup where available.
 */
export const ExportViewTool = createTool({
  name: 'ExportView',
  description:
    'Export a view as SVG or PNG. Provide viewId (or the focused view will be used), format (svg|png), and optional export options.',
  schema: z.strictObject({
    viewId: z.string().optional(),
    format: z.enum(['svg', 'png']).default('svg'),
  }),
  factory_fn:
    ({
      session,
      views,
    }: {
      session?: IAnyStateTreeNode
      views: AbstractViewModel[]
    }) =>
    async ({ viewId, format = 'svg' }) => {
      // choose view: by id, focused view, or first view
      let view: AbstractViewModel | undefined
      if (viewId) {
        view = views.find(v => v.id === viewId)
      }
      // prefer focused view if available
      if (!view && session?.focusedViewId) {
        view = views.find(v => v.id === session.focusedViewId)
      }
      view ??= views[0]
      if (!view) {
        return { result: 'error', message: 'No view available to export' }
      }

      // 1) If view provides exportSvg, call it (many view models do this and save the file)
      if (typeof (view as LinearGenomeViewModel).exportSvg === 'function') {
        // Many implementations call FileSaver internally and return a Promise<void>
        await (view as LinearGenomeViewModel).exportSvg()
        return {
          result: 'success',
          message:
            'Called view.exportSvg(). This typically triggers a file save/download in the browser.',
          viewId: view.id ?? null,
        }
      }

      // 2) If LinearGenomeView attempt to import renderToSvg and serialize
      if (view.type === 'LinearGenomeView') {
        // dynamic import of plugin export helper
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const m = await import('@jbrowse/plugin-linear-genome-view')
        const renderToSvg = m?.renderToSvg
        if (typeof renderToSvg !== 'function') {
          throw new Error(
            'renderToSvg not available from plugin-linear-genome-view',
          )
        }
        // renderToSvg typically returns a React element representing the <svg> content
        const reactSvg = await renderToSvg(view as LinearGenomeViewModel, {})
        if (!reactSvg) {
          throw new Error('renderToSvg returned null/undefined')
        }

        // Try using react-dom/server to serialize
        let svgString: string | undefined
        // renderToStaticMarkup is typically available, but it may bloat bundles.
        // Use it when available.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const rds = await import('react-dom/server')
        if (typeof rds.renderToStaticMarkup === 'function') {
          svgString = rds.renderToStaticMarkup(reactSvg)
        }

        // As a last resort, if reactSvg is a string, use it
        if (!svgString && typeof reactSvg === 'string') {
          svgString = reactSvg
        }

        if (!svgString) {
          return {
            result: 'error',
            message:
              'Could not serialize the view SVG (react-dom/server unavailable). Consider using a view with exportSvg or enabling server-side rendering utilities.',
          }
        }

        if (format === 'svg') {
          const dataUrl =
            'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString)
          return {
            result: 'success',
            dataUrl,
            svg: svgString,
            viewId: view.id,
          }
        } else {
          // convert SVG to PNG by drawing onto canvas
          const img = new Image()
          const svgDataUrl =
            'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString)
          // Ensure image has same pixel ratio as device for crispness
          const pngDataUrl = await new Promise<string>((resolve, reject) => {
            img.onload = () => {
              try {
                const canvas = document.createElement('canvas')
                canvas.width = img.width
                canvas.height = img.height
                const ctx = canvas.getContext('2d')
                if (!ctx) {
                  reject(new Error('Could not get canvas 2D context'))
                  return
                }
                ctx.drawImage(img, 0, 0)
                const url = canvas.toDataURL('image/png')
                resolve(url)
              } catch (e3) {
                reject(e3 as Error)
              }
            }
            img.onerror = () => reject(new Error(`Image load error`))
            img.src = svgDataUrl
          })
          return {
            result: 'success',
            dataUrl: pngDataUrl,
            viewId: view.id ?? null,
          }
        }
      }

      // Unsupported view export
      return {
        result: 'error',
        message:
          'View does not expose exportSvg and no specialized serializer available for this view type.',
        viewType: view.type,
        viewId: view.id,
      }
    },
})
