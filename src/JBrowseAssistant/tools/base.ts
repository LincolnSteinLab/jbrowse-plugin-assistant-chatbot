import { Tool } from '@assistant-ui/react'
import { DynamicStructuredTool } from '@langchain/core/tools'
import z from 'zod'

export const EmptySchema = z.strictObject({})
type Empty = z.infer<typeof EmptySchema>

export class JBTool<
  DSToolT extends DynamicStructuredTool = DynamicStructuredTool,
> implements Tool<Empty, DSToolT>
{
  description: string
  lc_tool: DSToolT
  parameters = EmptySchema

  constructor(lc_tool: DSToolT) {
    this.description = lc_tool.description
    this.lc_tool = lc_tool
  }

  execute({}: Empty) {
    return this.lc_tool
  }
}

export function createTool<
  ArgsT,
  DSToolT extends DynamicStructuredTool = DynamicStructuredTool,
>(
  description: string,
  factory_fn: (description: string, args: ArgsT) => DSToolT,
) {
  return (args: ArgsT) => new JBTool<DSToolT>(factory_fn(description, args))
}
