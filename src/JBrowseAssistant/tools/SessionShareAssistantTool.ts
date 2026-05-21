import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes'
import {
  AbstractViewModel,
  assembleLocString,
  isTrackModel,
} from '@jbrowse/core/util'
import { z } from 'zod'

import { ToolEnvelope, err, ok } from './ToolEnvelope'
import { createTool } from './base'
import { getLinearGenomeViews, selectOrFirst } from './bookmarkState'

export interface SessionShareAssistantData {
  shareable: boolean
  viewId?: string
  displayedLocations: string[]
  shownTrackIds: string[]
  missingForReproducibility: string[]
  operatorInstructions: string[]
}

export const SessionShareAssistantTool = createTool({
  name: 'SessionShareAssistant',
  description:
    'Generate a reproducibility/shareability bundle from the current JBrowse view. Returns exact location, assembly, and shown track IDs plus operator instructions for sharing the investigation context.',
  mcp: false,
  schema: z.object({
    viewId: z
      .string()
      .optional()
      .describe('Target LinearGenomeView ID. Defaults to first open LGV.'),
    includeVisibleTrackNames: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include human-friendly track display names in instructions.'),
  }),
  factory_fn:
    ([allTracks, views]: [
      allTracks: (AnyConfigurationModel & BaseTrackModel)[],
      views: AbstractViewModel[],
    ]) =>
    async ({
      viewId,
      includeVisibleTrackNames,
      // eslint-disable-next-line @typescript-eslint/require-await
    }): Promise<ToolEnvelope<SessionShareAssistantData>> => {
      const lgviews = getLinearGenomeViews(views)

      if (lgviews.length === 0) {
        return err(
          'No LinearGenomeView is open',
          {
            shareable: false,
            displayedLocations: [],
            shownTrackIds: [],
            missingForReproducibility: ['Open a LinearGenomeView'],
            operatorInstructions: ['Open a LinearGenomeView using EnsureView'],
          },
          ['Open a LinearGenomeView first'],
        )
      }

      const view = selectOrFirst(lgviews, { id: viewId })

      if (!view) {
        return err(
          'Could not find view with specified ID',
          {
            shareable: false,
            viewId: viewId ?? '',
            displayedLocations: [],
            shownTrackIds: [],
            missingForReproducibility: [
              'Ensure the view ID is correct and the view is open',
            ],
            operatorInstructions: [
              'Ensure the view ID is correct and the view is open',
            ],
          },
          ['Ensure the view ID is correct and the view is open'],
        )
      }

      const displayedLocations = view.displayedRegions.map(region =>
        assembleLocString(region),
      )

      const shownTrackIds = isTrackModel(view)
        ? (view.tracks as BaseTrackModel[]).map(track => track.trackId)
        : []

      const missingForReproducibility: string[] = []
      if (displayedLocations.length === 0) {
        missingForReproducibility.push('No displayed location is available')
      }

      const shownTrackNames = shownTrackIds
        .map(id => allTracks.find(track => track.trackId === id)?.name)
        .filter((name): name is string => Boolean(name))

      const operatorInstructions = [
        'Open the same assembly before applying the location and track context.',
        displayedLocations.length > 0
          ? `Navigate to ${displayedLocations.join(' and ')}.`
          : 'Navigate to the target locus before enabling tracks.',
        shownTrackIds.length > 0
          ? `Enable track IDs: ${shownTrackIds.join(', ')}.`
          : 'Enable the relevant tracks for this analysis.',
      ]

      if (includeVisibleTrackNames && shownTrackNames.length > 0) {
        operatorInstructions.push(
          `Track display names in this view: ${shownTrackNames.join(', ')}.`,
        )
      }

      const shareable = missingForReproducibility.length === 0

      return ok(
        shareable
          ? 'Built a reproducible session-sharing bundle'
          : 'Built a partial session-sharing bundle; more context is needed for full reproducibility',
        {
          shareable,
          viewId: view.id,
          displayedLocations,
          shownTrackIds,
          missingForReproducibility,
          operatorInstructions,
        },
      )
    },
})
