import {
  AbstractSessionModel,
  AbstractTrackModel,
  AbstractViewModel,
} from '@jbrowse/core/util'
import { z } from 'zod'

import { ToolEnvelope, err, ok } from './ToolEnvelope'
import { createTool } from './base'
import {
  getBookmarkViewState,
  getLinearGenomeViews,
  selectLinearGenomeView,
} from './bookmarkState'
import { getSessionTracks } from './sessionState'

export interface SessionShareAssistantData {
  shareable: boolean
  viewId?: string
  assembly?: string
  displayedLocations: string[]
  shownTrackIds: string[]
  missingForReproducibility: string[]
  operatorInstructions: string[]
}

function hasTracks(
  view: AbstractViewModel,
): view is AbstractViewModel & { tracks: AbstractTrackModel[] } {
  return 'tracks' in view
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
    ({
      session,
      views,
    }: {
      session: AbstractSessionModel
      views: AbstractViewModel[]
    }) =>
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

      const view = selectLinearGenomeView(lgviews, viewId)
      const { assembly, locations } = getBookmarkViewState(view)
      const displayedLocations = locations.map(location => location.locString)

      const shownTrackIds = hasTracks(view)
        ? view.tracks
            .map(track => String(track.configuration.trackId))
            .filter(Boolean)
        : []

      const missingForReproducibility: string[] = []
      if (!assembly) {
        missingForReproducibility.push('Active assembly could not be resolved')
      }
      if (displayedLocations.length === 0) {
        missingForReproducibility.push('No displayed location is available')
      }

      const allTracks = getSessionTracks(session)
      const shownTrackNames = shownTrackIds
        .map(id => allTracks.find(track => track.id === id)?.name)
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
          assembly,
          displayedLocations,
          shownTrackIds,
          missingForReproducibility,
          operatorInstructions,
        },
      )
    },
})
