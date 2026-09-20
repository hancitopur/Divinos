import { createContext, useContext, useState, type ReactNode } from 'react'

export type Lang = 'es' | 'en'

const dict = {
  es: {
    appName: 'CigarrosPR Humidor',
    signIn: 'Iniciar sesión', signUp: 'Crear cuenta', signOut: 'Salir', email: 'Correo', password: 'Contraseña',
    fullName: 'Nombre', haveAccount: '¿Ya tienes cuenta?', noAccount: '¿No tienes cuenta?',
    checkEmail: 'Revisa tu correo para confirmar la cuenta.', notConfigured: 'Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.',
    dashboard: 'Resumen', bottles: 'Inventario', wines: 'Catálogo', racks: 'Humidores', clients: 'Clientes',
    inStorage: 'En humidor', purchaseValue: 'Valor de compra', saleValue: 'Valor de venta', margin: 'Margen',
    occupancy: 'Ocupación', slots: 'espacios', valueByClient: 'Valor por cliente', client: 'Cliente',
    search: 'Buscar…', all: 'Todos', add: 'Agregar', save: 'Guardar', cancel: 'Cancelar', delete: 'Eliminar', edit: 'Editar',
    confirmDelete: '¿Eliminar? Esta acción no se puede deshacer.', loading: 'Cargando…', empty: 'Nada por aquí todavía.',
    wine: 'Cigarro o caja', producer: 'Marca', vintage: 'Año', region: 'Región de origen', country: 'País', varietal: 'Vitola', type: 'Fortaleza',
    size: 'Unidades por caja', notes: 'Notas', labelPhoto: 'Foto del producto', takePhoto: 'Tomar / subir foto', changePhoto: 'Cambiar foto',
    purchasePrice: 'Precio de compra', salePrice: 'Precio de venta', status: 'Estado', location: 'Ubicación', noLocation: 'Sin ubicación',
    receivedAt: 'Recibido', releasedAt: 'Salida', rack: 'Humidor', shelf: 'Gaveta', position: 'Espacio', selectSlot: 'Elegir espacio',
    free: 'libre', occupied: 'ocupado', name: 'Nombre', phone: 'Teléfono', active: 'Activo', inactive: 'Inactivo',
    shelves: 'Gavetas', positionsPerShelf: 'Espacios por gaveta', description: 'Descripción', newRack: 'Nuevo humidor',
    newWine: 'Nuevo producto', newBottle: 'Nueva entrada', newClient: 'Nuevo cliente', addBottles: 'Cantidad de cajas o unidades',
    selectWine: 'Selecciona un producto', selectClient: 'Selecciona un cliente', nothingSelected: 'Sin asignar',
    bottleCount: 'piezas', total: 'Total', language: 'Idioma', chooseRack: 'Elige un humidor', legend: 'Toca un espacio para ver su contenido',
    markSold: 'Marcar vendida', moveTo: 'Mover a', errorSaving: 'Error al guardar', role: 'Rol',
    status_in_storage: 'En humidor', status_sold: 'Vendido', status_consumed: 'Consumido', status_removed: 'Retirado',
    type_red: 'Suave', type_white: 'Suave–medio', type_rose: 'Medio', type_sparkling: 'Medio–fuerte', type_dessert: 'Fuerte', type_fortified: 'Extra fuerte', type_other: 'Sin clasificar',
    installHint: 'Instala CigarrosPR Humidor: en iPhone usa Compartir → Añadir a pantalla de inicio.', perBottle: 'por pieza',
  },
  en: {
    appName: 'CigarrosPR Humidor',
    signIn: 'Sign in', signUp: 'Create account', signOut: 'Sign out', email: 'Email', password: 'Password',
    fullName: 'Name', haveAccount: 'Already have an account?', noAccount: 'No account yet?',
    checkEmail: 'Check your email to confirm your account.', notConfigured: 'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set.',
    dashboard: 'Overview', bottles: 'Inventory', wines: 'Catalog', racks: 'Humidors', clients: 'Clients',
    inStorage: 'In humidor', purchaseValue: 'Purchase value', saleValue: 'Sale value', margin: 'Margin',
    occupancy: 'Occupancy', slots: 'slots', valueByClient: 'Value by client', client: 'Client',
    search: 'Search…', all: 'All', add: 'Add', save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit',
    confirmDelete: 'Delete? This cannot be undone.', loading: 'Loading…', empty: 'Nothing here yet.',
    wine: 'Cigar or box', producer: 'Brand', vintage: 'Year', region: 'Origin region', country: 'Country', varietal: 'Vitola', type: 'Strength',
    size: 'Units per box', notes: 'Notes', labelPhoto: 'Product photo', takePhoto: 'Take / upload photo', changePhoto: 'Change photo',
    purchasePrice: 'Purchase price', salePrice: 'Sale price', status: 'Status', location: 'Location', noLocation: 'No location',
    receivedAt: 'Received', releasedAt: 'Released', rack: 'Humidor', shelf: 'Drawer', position: 'Slot', selectSlot: 'Pick a slot',
    free: 'free', occupied: 'occupied', name: 'Name', phone: 'Phone', active: 'Active', inactive: 'Inactive',
    shelves: 'Drawers', positionsPerShelf: 'Slots per drawer', description: 'Description', newRack: 'New humidor',
    newWine: 'New product', newBottle: 'New intake', newClient: 'New client', addBottles: 'Number of boxes or units',
    selectWine: 'Select a product', selectClient: 'Select a client', nothingSelected: 'Unassigned',
    bottleCount: 'items', total: 'Total', language: 'Language', chooseRack: 'Choose a humidor', legend: 'Tap a slot to see its contents',
    markSold: 'Mark sold', moveTo: 'Move to', errorSaving: 'Error saving', role: 'Role',
    status_in_storage: 'In humidor', status_sold: 'Sold', status_consumed: 'Consumed', status_removed: 'Removed',
    type_red: 'Mild', type_white: 'Mild–medium', type_rose: 'Medium', type_sparkling: 'Medium–full', type_dessert: 'Full', type_fortified: 'Extra full', type_other: 'Unclassified',
    installHint: 'Install CigarrosPR Humidor: on iPhone use Share → Add to Home Screen.', perBottle: 'per item',
  },
} as const

export type Key = keyof typeof dict.es

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string }>({
  lang: 'es', setLang: () => {}, t: (k) => k,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try { return (localStorage.getItem('lang') as Lang) || (navigator.language.startsWith('en') ? 'en' : 'es') } catch { return 'es' }
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
