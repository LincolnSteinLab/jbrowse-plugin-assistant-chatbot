import { DynamicStructuredTool } from '@langchain/core/tools'
import { IAnyStateTreeNode } from 'mobx-state-tree'

import { BaseTool, EmptySchema } from './BaseTool'

const description = 'Gets the current JBrowse session config JSON.'

function getJBrowseConfigTool(jbrowseConfig: IAnyStateTreeNode) {
  return new DynamicStructuredTool({
    name: 'JBrowseConfig',
    description: description,
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
