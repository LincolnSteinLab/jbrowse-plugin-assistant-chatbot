import Card from '@mui/material/Card'

import ChatMessages from './ChatMessages'
import ChatHeader from './ChatHeader'
import ChatFooter from './ChatFooter'

export default function Chat() {
  return (
    <>
      <Card
        variant="outlined"
        sx={{
          width: '75%',
          height: '100%',
          overflow: 'hidden',
          overflowY: 'scroll',
        }}
      >
        <ChatHeader />
        <ChatMessages />
        <ChatFooter />
      </Card>
    </>
  )
}
