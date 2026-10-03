import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
const root = createRoot(document.getElementById('root')!)
if (import.meta.env.DEV && new URLSearchParams(location.search).has('demo'))
  import('./Demo').then(({ default: Demo }) => root.render(<Demo />))
else
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
