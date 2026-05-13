import { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes'
import {
  AbstractViewModel,
  AssemblyManager,
  getConfAssemblyNames,
  Region,
} from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
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
    displayedRegions?: Region[]
    shownTrackIds?: string[]
  }[]
  defaults?: {
    preferredViewId?: string
    preferredAssembly?: string
  }
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
    ({
      allTracks,
      assemblyManager,
      views,
    }: {
      allTracks: (AnyConfigurationModel & BaseTrackModel)[]
      assemblyManager: AssemblyManager
      views: AbstractViewModel[]
    }) =>
    async ({
      includeTracks,
      includeRegions,
      // eslint-disable-next-line @typescript-eslint/require-await
    }): Promise<ToolEnvelope<SessionSnapshotData>> => {
      const assemblies: Assembly[] =
        assemblyManager.assemblyList as AnyConfigurationModel[] & Assembly[]
      const availableTracks = includeTracks
        ? allTracks.map(track => ({
            id: track.id,
            name: track.name,
            assemblyNames: getConfAssemblyNames(track),
            type: track.type,
          }))
        : undefined

      const firstLGV = views.find(v => v.type === 'LinearGenomeView') as
        | LinearGenomeViewModel
        | undefined
      const preferredAssembly =
        firstLGV?.assemblyNames?.[0] ?? assemblies[0].name

      return ok('Session snapshot retrieved', {
        assemblies: assemblies.map(a => ({
          name: a.name,
          refNameCount: a.allRefNames?.length,
        })),
        ...(includeTracks && { availableTracks }),
        views: views.map(v => ({
          id: v.id,
          type: v.type,
          name: v.displayName,
          assemblyNames: (v as LinearGenomeViewModel).assemblyNames,
          ...(includeRegions && {
            displayedRegions: (v as LinearGenomeViewModel).displayedRegions,
          }),
          ...(includeTracks && {
            shownTrackIds: (
              (v as LinearGenomeViewModel).tracks as
                | BaseTrackModel[]
                | undefined
            )?.map(t => t.id),
          }),
        })),
        defaults: {
          preferredViewId: firstLGV?.id,
          preferredAssembly,
        },
      })
    },
})
