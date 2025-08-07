import { DynamicStructuredTool } from '@langchain/core/tools'
import { IAnyStateTreeNode } from 'mobx-state-tree'

import { BaseTool, EmptySchema } from './BaseTool'

const description = "Get the current config.json of the user's JBrowse session"

function getJBrowseConfigTool(jbrowseConfig: IAnyStateTreeNode) {
  return new DynamicStructuredTool({
    name: 'JBrowseConfig',
    description,
    schema: EmptySchema,
    // eslint-disable-next-line @typescript-eslint/require-await
    func: async ({}) => JSON.stringify(jbrowseConfig, null, '\t'),
  })
}

export class JBrowseConfigTool extends BaseTool<
  ReturnType<typeof getJBrowseConfigTool>
> {
  description = description

  constructor(jbrowseConfig: IAnyStateTreeNode) {
    super()
    this.lc_tool = getJBrowseConfigTool(jbrowseConfig)
  }
}
