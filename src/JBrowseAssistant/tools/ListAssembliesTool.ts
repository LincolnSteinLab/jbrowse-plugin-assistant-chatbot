import { AbstractSessionModel } from '@jbrowse/core/util'

import { createTool, EmptySchema } from './base'

/**
 * Returns high-level info about the session/jbrowse assemblies
 *
 * Factory args: (session: IAnyStateTreeNode)
 */
export const ListAssembliesTool = createTool({
  name: 'ListAssemblies',
  description:
    'List configured assemblies and simple metadata in the running JBrowse session',
  schema: EmptySchema,
  factory_fn:
    (session: AbstractSessionModel) =>
    // eslint-disable-next-line @typescript-eslint/require-await
    async ({}) => {
      // session.assemblies may be configuration objects; stringify selectively
      const assemblies = (session?.assemblies || []).map(a => {
        // Try to extract common fields
        const name = a?.name ?? a?.assemblyName ?? null
        const alias = a?.aliases ?? a?.refNameAliases ?? null
        const regionsCount = a?.regions ? a.regions.length : undefined
        return { name, alias, regionsCount, raw: a }
      })
      return { result: 'success', assemblies }
    },
})
