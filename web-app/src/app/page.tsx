import { Box } from '@mui/material'
import Chat from '../components/Chat'

export default function Home() {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '5px',
      }}
    >
      <Chat />
    </Box>
  )
}
