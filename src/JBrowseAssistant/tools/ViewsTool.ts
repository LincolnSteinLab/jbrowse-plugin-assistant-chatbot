import { AbstractViewModel } from '@jbrowse/core/util'

import { createTool, EmptySchema } from './base'

export const ViewsTool = createTool({
  name: 'Views',
  description: 'Display info about all views in the JBrowse session',
  schema: EmptySchema,
  factory_fn:
    (views: AbstractViewModel[]) =>
    // eslint-disable-next-line @typescript-eslint/require-await
    async ({}) =>
      JSON.stringify(views, null, '\t'),
})
