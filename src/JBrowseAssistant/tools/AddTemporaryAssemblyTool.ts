import { AbstractSessionModel } from '@jbrowse/core/util'
import { z } from 'zod'

import { createTool } from './base'

/**
 * Adds a temporary assembly configuration into the session.
 * Input: assembly (object)
 *
 * Factory args: session
 */
export const AddTemporaryAssemblyTool = createTool({
  name: 'AddTemporaryAssembly',
  description:
    'Add a temporary assembly to the session (useful for adding an in-memory sequence/assembly for quick inspections)',
  schema: z.strictObject({
    assembly: z
      .record(z.string(), z.unknown())
      .describe('Assembly configuration object'),
  }),
  factory_fn:
    (session: AbstractSessionModel) =>
    // eslint-disable-next-line @typescript-eslint/require-await
    async ({ assembly }) => {
      if (!assembly)
        return { result: 'error', message: 'Missing assembly object' }
      if (typeof session.addTemporaryAssembly === 'function') {
        session.addTemporaryAssembly(assembly)
        return { result: 'success' }
      } else {
        return {
          result: 'error',
          message: 'Session does not support addTemporaryAssembly',
        }
      }
    },
})
