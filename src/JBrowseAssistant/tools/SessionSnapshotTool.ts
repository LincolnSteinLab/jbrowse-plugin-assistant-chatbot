import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import {
  AbstractSessionModel,
  AbstractTrackModel,
  AbstractViewModel,
  Region,
} from '@jbrowse/core/util'
import { z } from 'zod'

import { ToolEnvelope, ok } from './ToolEnvelope'
import { createTool } from './base'

export interface SessionSnapshotData {
  assemblies: {
    name: string
    refNameCount?: number
  }[]
  availableTracks?: {
    id: string
    name?: string
    assemblyNames?: string[]
    type?: string
  }[]
  views: {
    id?: string
    type: string
    name?: string
    assemblyNames?: string[]
    displayedRegions?: string[]
    shownTrackIds?: string[]
  }[]
  defaults?: {
    preferredViewId?: string
    preferredAssembly?: string
  }
}

function hasDisplayedRegions(
  view: AbstractViewModel,
): view is AbstractViewModel & { displayedRegions: Region[] } {
  return 'displayedRegions' in view
}

function hasTracks(
  view: AbstractViewModel,
): view is AbstractViewModel & { tracks: AbstractTrackModel[] } {
  return 'tracks' in view
}

function hasAssemblyNames(view: unknown): view is { assemblyNames: string[] } {
  return typeof view === 'object' && view !== null && 'assemblyNames' in view
}

export const SessionSnapshotTool = createTool({
  name: 'SessionSnapshot',
  description:
    'Summarize current JBrowse session state including views, assemblies, regions, and track visibility',
  schema: z.object({
    includeTracks: z.boolean().optional().default(true),
    includeRegions: z.boolean().optional().default(true),
  }),
  factory_fn:
    (session: AbstractSessionModel) =>
    async ({
      includeTracks,
      includeRegions,
      // eslint-disable-next-line @typescript-eslint/require-await
    }): Promise<ToolEnvelope<SessionSnapshotData>> => {
      const assemblies = session.assemblyManager.assemblies
      const availableTracks = includeTracks
        ? (session.jbrowse.tracks as AnyConfigurationModel[])
            .map(track => ({
              id: String(track.trackId ?? ''),
              name: track.name,
              assemblyNames: Array.isArray(track.assemblyNames)
                ? track.assemblyNames.map(name => String(name))
                : undefined,
              type: track.type,
            }))
            .filter(track => !!track.id)
        : undefined
      const views = session.views.map(view => {
        const v = view
        const displayedRegions =
          includeRegions && hasDisplayedRegions(v)
            ? v.displayedRegions
                .map(r => JSON.stringify(r) ?? r.refName)
                .filter(Boolean)
            : undefined
        const shownTrackIds =
          includeTracks && hasTracks(v)
            ? v.tracks.map(t => t.configuration.trackId).filter(Boolean)
            : undefined

        return {
          id: v.id,
          type: v.type,
          name: v.displayName,
          assemblyNames: hasAssemblyNames(v) ? v.assemblyNames : undefined,
          displayedRegions,
          shownTrackIds,
        }
      })

      const firstLGV = views.find(v => v.type === 'LinearGenomeView')
      const preferredAssembly =
        firstLGV?.assemblyNames?.[0] ?? assemblies?.[0]?.name

      return ok('Session snapshot retrieved', {
        assemblies: assemblies.map(a => ({
          name: a.name,
          refNameCount: a.allRefNames?.length,
        })),
        availableTracks,
        views,
        defaults: {
          preferredViewId: firstLGV?.id,
          preferredAssembly,
        },
      })
    },
})
