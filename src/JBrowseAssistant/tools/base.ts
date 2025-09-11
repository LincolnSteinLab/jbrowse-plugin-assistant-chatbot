import {
  AssistantToolUI,
  makeAssistantToolUI,
  Tool,
  tool,
  ToolCallMessagePartComponent,
} from '@assistant-ui/react'
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager'
import {
  ToolInputSchemaOutputType,
  ToolRunnableConfig,
} from '@langchain/core/dist/tools/types'
import { DynamicStructuredTool } from '@langchain/core/tools'
import z from 'zod'

export const EmptySchema = z.strictObject({})
type Empty = z.infer<typeof EmptySchema>

export interface JBTool<
  DSToolT extends DynamicStructuredTool = DynamicStructuredTool,
> {
  tool: Tool<Empty, DSToolT> & { execute: ({}) => DSToolT }
  ui?: AssistantToolUI
}

export function createTool<
  FactoryArgsT,
  InputSchemaT,
  OutputT,
  InputT = ToolInputSchemaOutputType<InputSchemaT>,
>({
  name,
  description,
  schema,
  factory_fn,
  render_fn,
}: {
  name: string
  description: string
  schema: InputSchemaT
  factory_fn: (
    args: FactoryArgsT,
  ) => (
    input: InputT,
    runManager?: CallbackManagerForToolRun,
    config?: ToolRunnableConfig,
  ) => Promise<OutputT>
  render_fn?: ToolCallMessagePartComponent<InputT, OutputT>
}) {
  return (args: FactoryArgsT) => ({
    tool: tool({
      description,
      parameters: EmptySchema,
      execute({}: Empty) {
        return new DynamicStructuredTool({
          name,
          description,
          schema,
          func: factory_fn(args),
        })
      },
    }),
    ...(render_fn && {
      ui: makeAssistantToolUI<InputT, OutputT>({
        toolName: name,
        render: render_fn,
      }),
    }),
  })
}
