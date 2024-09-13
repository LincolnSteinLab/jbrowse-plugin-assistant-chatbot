import { CardActions } from '@mui/material'
import ChatInput from './ChatInput'

export default function ChatFooter() {
  return (
    <CardActions
      sx={{
        margin: '5px',
        backgroundColor: '#ededed',
        borderRadius: '4px',
      }}
    >
      <ChatInput />
    </CardActions>
  )
}
