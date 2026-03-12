import '@/lib/monaco-environment'
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from '@/components/ui/sonner'
import { FontProvider } from './context/font-provider'
import { ThemeProvider } from './context/theme-provider'
import { NavigationProvider } from './context/navigation-provider'
import { App } from './App'
import './styles/index.css'

const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <ThemeProvider>
        <FontProvider>
          <NavigationProvider>
            <App />
            <Toaster duration={5000} />
          </NavigationProvider>
        </FontProvider>
      </ThemeProvider>
    </StrictMode>,
  )
}
