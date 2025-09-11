import { IAnyStateTreeNode } from 'mobx-state-tree'

import { createTool, EmptySchema } from './base'

export const JBrowseConfigTool = createTool({
  name: 'JBrowseConfig',
  description: "Get the current config.json of the user's JBrowse session",
  schema: EmptySchema,
  factory_fn:
    (jbrowseConfig: IAnyStateTreeNode) =>
    // eslint-disable-next-line @typescript-eslint/require-await
    async ({}) =>
      JSON.stringify(jbrowseConfig, null, '\t'),
})
