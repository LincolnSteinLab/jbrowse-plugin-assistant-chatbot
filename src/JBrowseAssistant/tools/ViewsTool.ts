import { AbstractViewModel } from '@jbrowse/core/util'
import { DynamicStructuredTool } from '@langchain/core/tools'

import { createTool, EmptySchema } from './base'

export const ViewsTool = createTool(
  'Display info about all views in the JBrowse session',
  (description, views: AbstractViewModel[]) =>
    new DynamicStructuredTool({
      name: 'Views',
      description,
      schema: EmptySchema,
      // eslint-disable-next-line @typescript-eslint/require-await
      func: async ({}) => JSON.stringify(views, null, '\t'),
    }),
)
