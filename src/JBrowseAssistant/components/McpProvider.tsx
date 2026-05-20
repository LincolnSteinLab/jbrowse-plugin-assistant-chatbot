import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import React, { useMemo } from 'react'

import { getSkills } from '../skills'
import { getTools } from '../tools'

export const McpProvider = observer(function ({
  pluginManager,
  session,
}: {
  pluginManager: PluginManager
  session?: AbstractSessionModel
}) {
  if (!session) return <></>
  const skills = useMemo(getSkills, [])
  const tools = getTools(pluginManager, session)
  return (
    <>
      {Object.entries(skills).map(([k, v]) => {
        const SkillMCP = v.mcp
        return <SkillMCP key={k} />
      })}
      {Object.entries(tools)
        .filter(([, v]) => v.mcp)
        .map(([k, v]) => {
          const ToolMCP = v.mcp!
          return <ToolMCP key={k} />
        })}
    </>
  )
})
