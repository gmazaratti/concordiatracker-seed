import { BrowserRouter } from 'react-router-dom'
import { AppProviders } from '@/app/providers/AppProviders'
import { AppRoutes } from '@/router'

export default function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProviders>
  )
}
