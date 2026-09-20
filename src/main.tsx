import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import { registerSW } from 'virtual:pwa-register'

// Install new releases as soon as Render publishes them.  Calling updateSW(true)
// also reloads tabs that would otherwise keep an old precached sales page open.
let applyingUpdate = false
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    if (applyingUpdate) return
    applyingUpdate = true
    void updateSW(true)
  },
  onRegisterError(error) {
    console.error('No se pudo actualizar Divinos.', error)
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
)
