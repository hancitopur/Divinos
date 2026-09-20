import { createContext, useContext, useState, type ReactNode } from 'react'

export type Lang = 'es' | 'en'

const dict = {
  es: {
    appName: 'Divinos',
    signIn: 'Iniciar sesión', signUp: 'Crear cuenta', signOut: 'Salir', email: 'Correo', password: 'Contraseña',
    fullName: 'Nombre', haveAccount: '¿Ya tienes cuenta?', noAccount: '¿No tienes cuenta?',
    checkEmail: 'Revisa tu correo para confirmar la cuenta.', notConfigured: 'Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.',
    dashboard: 'Resumen', bottles: 'Botellas', wines: 'Vinos', racks: 'Cava', clients: 'Clientes',
    inStorage: 'En storage', purchaseValue: 'Valor de compra', saleValue: 'Valor de venta', margin: 'Margen',
    occupancy: 'Ocupación', slots: 'espacios', valueByClient: 'Valor por cliente', client: 'Cliente',
    search: 'Buscar…', all: 'Todos', add: 'Agregar', save: 'Guardar', cancel: 'Cancelar', delete: 'Eliminar', edit: 'Editar',
    confirmDelete: '¿Eliminar? Esta acción no se puede deshacer.', loading: 'Cargando…', empty: 'Nada por aquí todavía.',
    wine: 'Vino', producer: 'Productor', vintage: 'Cosecha', region: 'Región', country: 'País', varietal: 'Uva', type: 'Tipo',
    size: 'Tamaño (ml)', notes: 'Notas', labelPhoto: 'Foto de etiqueta', takePhoto: 'Tomar / subir foto', changePhoto: 'Cambiar foto',
    purchasePrice: 'Precio de compra', salePrice: 'Precio de venta', status: 'Estado', location: 'Ubicación', noLocation: 'Sin ubicación',
    receivedAt: 'Recibida', releasedAt: 'Salida', rack: 'Rack', shelf: 'Shelf', position: 'Posición', selectSlot: 'Elegir espacio',
    free: 'libre', occupied: 'ocupado', name: 'Nombre', phone: 'Teléfono', active: 'Activo', inactive: 'Inactivo',
    shelves: 'Shelves', positionsPerShelf: 'Posiciones por shelf', description: 'Descripción', newRack: 'Nuevo rack',
    newWine: 'Nuevo vino', newBottle: 'Nueva botella', newClient: 'Nuevo cliente', addBottles: 'Cantidad de botellas',
    selectWine: 'Selecciona un vino', selectClient: 'Selecciona un cliente', nothingSelected: 'Sin asignar',
    bottleCount: 'botellas', total: 'Total', language: 'Idioma', chooseRack: 'Elige un rack', legend: 'Toca un espacio para ver la botella',
    markSold: 'Marcar vendida', moveTo: 'Mover a', errorSaving: 'Error al guardar', role: 'Rol',
    cellarView: 'Cava visual', slotView: 'Mapa de slots', visualHint: 'Toca una botella para ver su ficha', availableSlot: 'Espacio disponible',
    status_in_storage: 'En storage', status_sold: 'Vendida', status_consumed: 'Consumida', status_removed: 'Retirada',
    type_red: 'Tinto', type_white: 'Blanco', type_rose: 'Rosado', type_sparkling: 'Espumoso', type_dessert: 'Dulce', type_fortified: 'Fortificado', type_other: 'Otro',
    installHint: 'Instala la app: en iPhone usa Compartir → Añadir a pantalla de inicio.', perBottle: 'por botella',
  },
  en: {
    appName: 'Divinos',
    signIn: 'Sign in', signUp: 'Create account', signOut: 'Sign out', email: 'Email', password: 'Password',
    fullName: 'Name', haveAccount: 'Already have an account?', noAccount: 'No account yet?',
    checkEmail: 'Check your email to confirm your account.', notConfigured: 'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set.',
    dashboard: 'Overview', bottles: 'Bottles', wines: 'Wines', racks: 'Racks', clients: 'Clients',
    inStorage: 'In storage', purchaseValue: 'Purchase value', saleValue: 'Sale value', margin: 'Margin',
    occupancy: 'Occupancy', slots: 'slots', valueByClient: 'Value by client', client: 'Client',
    search: 'Search…', all: 'All', add: 'Add', save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit',
    confirmDelete: 'Delete? This cannot be undone.', loading: 'Loading…', empty: 'Nothing here yet.',
    wine: 'Wine', producer: 'Producer', vintage: 'Vintage', region: 'Region', country: 'Country', varietal: 'Grape', type: 'Type',
    size: 'Size (ml)', notes: 'Notes', labelPhoto: 'Label photo', takePhoto: 'Take / upload photo', changePhoto: 'Change photo',
    purchasePrice: 'Purchase price', salePrice: 'Sale price', status: 'Status', location: 'Location', noLocation: 'No location',
    receivedAt: 'Received', releasedAt: 'Released', rack: 'Rack', shelf: 'Shelf', position: 'Position', selectSlot: 'Pick a slot',
    free: 'free', occupied: 'occupied', name: 'Name', phone: 'Phone', active: 'Active', inactive: 'Inactive',
    shelves: 'Shelves', positionsPerShelf: 'Positions per shelf', description: 'Description', newRack: 'New rack',
    newWine: 'New wine', newBottle: 'New bottle', newClient: 'New client', addBottles: 'Number of bottles',
    selectWine: 'Select a wine', selectClient: 'Select a client', nothingSelected: 'Unassigned',
    bottleCount: 'bottles', total: 'Total', language: 'Language', chooseRack: 'Choose a rack', legend: 'Tap a slot to see the bottle',
    markSold: 'Mark sold', moveTo: 'Move to', errorSaving: 'Error saving', role: 'Role',
    cellarView: 'Visual cellar', slotView: 'Slot map', visualHint: 'Tap a bottle to open its details', availableSlot: 'Available space',
    status_in_storage: 'In storage', status_sold: 'Sold', status_consumed: 'Consumed', status_removed: 'Removed',
    type_red: 'Red', type_white: 'White', type_rose: 'Rosé', type_sparkling: 'Sparkling', type_dessert: 'Dessert', type_fortified: 'Fortified', type_other: 'Other',
    installHint: 'Install the app: on iPhone use Share → Add to Home Screen.', perBottle: 'per bottle',
  },
} as const

export type Key = keyof typeof dict.es

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string }>({
  lang: 'es', setLang: () => {}, t: (k) => k,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    // Divinos launches in Puerto Rico: start in Spanish unless the customer
    // has explicitly selected and saved another language.
    try { return (localStorage.getItem('lang') as Lang) || 'es' } catch { return 'es' }
  })
  const setLang = (l: Lang) => { setLangState(l); try { localStorage.setItem('lang', l) } catch {} }
  const t = (k: Key) => dict[lang][k] ?? dict.es[k] ?? k
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>
}

export const useT = () => useContext(Ctx)

export function money(n: number | string | null | undefined, lang: Lang = 'es') {
  const v = Number(n ?? 0)
  return new Intl.NumberFormat(lang === 'es' ? 'es-PR' : 'en-US', { style: 'currency', currency: 'USD' }).format(v)
}
