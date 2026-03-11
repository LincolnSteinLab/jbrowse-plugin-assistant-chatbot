import { AbstractSessionModel } from '@jbrowse/core/util'

import { createTool, EmptySchema } from './base'

/**
 * Lists tracks available in the session: returns session.getTracksById()
 *
 * Factory args: (session: IAnyStateTreeNode)
 */
export const ListTracksTool = createTool({
  name: 'ListTracks',
  description:
    "List tracks available in the user's JBrowse session (id → config)",
  schema: EmptySchema,
  factory_fn:
    (session: AbstractSessionModel) =>
    // eslint-disable-next-line @typescript-eslint/require-await
    async ({}) => {
      // Some session types expose getTracksById(); fallback to session.tracks
      let tracksById: Record<string, unknown> | undefined = undefined
      if (typeof session.getTracksById === 'function') {
        tracksById = session.getTracksById()
      } else if (Array.isArray(session.tracks)) {
        // make a mapping from trackId to config if possible
        tracksById = {}
        for (const t of session.tracks) {
          const id = t?.trackId ?? t?.id ?? t?.name ?? JSON.stringify(t)
          tracksById[id] = t
        }
      } else {
        tracksById = {}
      }
      return { result: 'success', tracks: tracksById }
    },
})
