import { DynamicStructuredTool } from '@langchain/core/tools'
import { IAnyStateTreeNode } from 'mobx-state-tree'

import { createTool, EmptySchema } from './factory'

export const JBrowseConfigTool = createTool(
  "Get the current config.json of the user's JBrowse session",
  (description, jbrowseConfig: IAnyStateTreeNode) =>
    new DynamicStructuredTool({
      name: 'JBrowseConfig',
      description,
      schema: EmptySchema,
      // eslint-disable-next-line @typescript-eslint/require-await
      func: async ({}) => JSON.stringify(jbrowseConfig, null, '\t'),
    }),
)
