import type { SessionWithAddTracks } from '@jbrowse/core/util'
import { z } from 'zod'

import { createTool } from './base'

/**
 * Add a track configuration to the session.
 * Input:
 *  - track: object or JSON string of track configuration
 *
 * Factory args: (session: IAnyStateTreeNode)
 */
export const AddTrackTool = createTool({
  name: 'AddTrack',
  description:
    'Add a track configuration to the session (pass a track config object or JSON string)',
  schema: z.strictObject({
    track: z
      .record(z.string(), z.unknown())
      .describe('Track configuration object or JSON string'),
  }),
  factory_fn:
    (session: SessionWithAddTracks) =>
    // eslint-disable-next-line @typescript-eslint/require-await
    async ({ track }) => {
      let conf = track
      if (typeof track === 'string') {
        try {
          conf = JSON.parse(track)
        } catch {
          return { result: 'error', message: 'Failed to parse track JSON' }
        }
      }
      if (!conf) {
        return { result: 'error', message: 'Empty track config' }
      }
      if (typeof session.addTrackConf === 'function') {
        session.addTrackConf(conf)
        // if trackId present, return it
        const trackId = conf.trackId ?? conf.id ?? null
        return { result: 'success', trackId }
      } else {
        return {
          result: 'error',
          message: 'Session does not support addTrackConf or addTrack',
        }
      }
    },
})
