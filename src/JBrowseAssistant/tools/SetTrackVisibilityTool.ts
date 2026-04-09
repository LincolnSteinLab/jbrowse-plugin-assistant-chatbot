import { AbstractViewModel } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { z } from 'zod'

import { ToolEnvelope, err, needsInput, ok } from './ToolEnvelope'
import { createTool } from './base'

interface SetTrackVisibilityData {
  viewId?: string
  shown: string[]
  hidden: string[]
  unmatched: string[]
  ambiguous: {
    query: string
    candidates: string[]
  }[]
}

function norm(value: string) {
  return value.trim().toLowerCase()
}

export const SetTrackVisibilityTool = createTool({
  name: 'SetTrackVisibility',
  description:
    'Show or hide tracks in a linear genome view by track ID or name, with matching diagnostics',
  schema: z.object({
    show: z.array(z.string()).optional().default([]),
    hide: z.array(z.string()).optional().default([]),
    viewId: z.string().optional(),
    matchMode: z.enum(['id', 'name', 'auto']).optional().default('auto'),
  }),
  factory_fn:
    (views: AbstractViewModel[]) =>
    async ({
      show,
      hide,
      viewId,
      matchMode,
      // eslint-disable-next-line @typescript-eslint/require-await
    }): Promise<ToolEnvelope<SetTrackVisibilityData>> => {
      if (show.length === 0 && hide.length === 0) {
        return err('Provide at least one track to show or hide', {
          shown: [],
          hidden: [],
          unmatched: [],
          ambiguous: [],
        })
      }

      const lgviews = views.filter(
        view => view.type === 'LinearGenomeView',
      ) as LinearGenomeViewModel[]

      if (lgviews.length === 0) {
        return err(
          'No Linear Genome View is open',
          {
            shown: [],
            hidden: [],
            unmatched: [...show, ...hide],
            ambiguous: [],
          },
          ['Open a LinearGenomeView and try again'],
        )
      }

      const target = viewId
        ? lgviews.find(view => view.id === viewId)
        : lgviews[0]

      const sessionTracks = (
        ((target as any).session?.jbrowse?.tracks ?? []) as any[]
      )
        .map(t => ({
          id: t?.trackId,
          name: t?.name,
        }))
        .filter(t => t.id ?? t.name)

      const shown: string[] = []
      const hidden: string[] = []
      const unmatched: string[] = []
      const ambiguous: { query: string; candidates: string[] }[] = []

      const resolve = (query: string) => {
        const q = norm(query)
        const matches = sessionTracks.filter(t => {
          const byId = !!t.id && norm(String(t.id)) === q
          const byName = !!t.name && norm(String(t.name)) === q
          const fuzzy =
            (!!t.id && norm(String(t.id)).includes(q)) ||
            (!!t.name && norm(String(t.name)).includes(q))
          if (matchMode === 'id') return byId
          if (matchMode === 'name') return byName
          return byId || byName || fuzzy
        })
        return matches
      }

      for (const q of show) {
        const matches = resolve(q)
        if (matches.length === 0) {
          unmatched.push(q)
          continue
        }
        if (matches.length > 1) {
          ambiguous.push({
            query: q,
            candidates: matches
              .map(m => String(m.id ?? m.name))
              .filter(Boolean)
              .slice(0, 8),
          })
          continue
        }
        const trackId = String(matches[0]?.id ?? '')
        if (!trackId) {
          unmatched.push(q)
          continue
        }
        target.showTrack(trackId)
        shown.push(trackId)
      }

      for (const q of hide) {
        const matches = resolve(q)
        if (matches.length === 0) {
          unmatched.push(q)
          continue
        }
        if (matches.length > 1) {
          ambiguous.push({
            query: q,
            candidates: matches
              .map(m => String(m.id ?? m.name))
              .filter(Boolean)
              .slice(0, 8),
          })
          continue
        }
        const trackId = String(matches[0]?.id ?? '')
        if (!trackId) {
          unmatched.push(q)
          continue
        }
        const hideTrack = target?.hideTrack.bind(target)
        if (typeof hideTrack === 'function') {
          hideTrack.call(target, trackId)
          hidden.push(trackId)
        } else {
          unmatched.push(q)
        }
      }

      if (ambiguous.length > 0) {
        return needsInput(
          'Some track queries matched multiple tracks',
          {
            viewId: target?.id,
            shown,
            hidden,
            unmatched,
            ambiguous,
          },
          ['Provide exact track IDs for ambiguous entries'],
        )
      }

      return ok('Track visibility updated', {
        viewId: target?.id,
        shown,
        hidden,
        unmatched,
        ambiguous,
      })
    },
})
