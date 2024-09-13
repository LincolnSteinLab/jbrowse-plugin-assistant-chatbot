import { CardHeader } from '@mui/material'
import AssistantIcon from '@mui/icons-material/Assistant'

export default function ChatHeader() {
  return (
    <CardHeader
      title="Configuration assistant"
      avatar={<AssistantIcon />}
      sx={{
        boxShadow: '0px 1px 2px 1px #ededed',
      }}
      titleTypographyProps={{ variant: 'body1', fontWeight: '500' }}
    ></CardHeader>
  )
}
