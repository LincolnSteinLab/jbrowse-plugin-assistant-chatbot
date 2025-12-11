import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import React from 'react'

import { getTools } from '../tools'

export const McpProvider = observer(function ({
  pluginManager,
  session,
}: {
  pluginManager: PluginManager
  session?: AbstractSessionModel
}) {
  if (!session) return <></>
  const tools = getTools(pluginManager, session)
  return (
    <>
      {Object.entries(tools).map(([k, v]) => {
        const ToolMCP = v.mcp
        return <ToolMCP key={k} />
      })}
    </>
  )
})
