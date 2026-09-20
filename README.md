# CigarrosPR Humidor

Inventario y custodia de cigarros para clientes. PWA bilingüe (React + Vite) sobre Supabase, lista para Render.

- Cajas o cigarros por cliente con precio de compra / venta y valor total
- Ubicación exacta: humidor → gaveta → espacio, con mapa visual
- Humedad y temperatura por humidor con fecha de la última lectura
- Fotos del producto y de cada entrada desde la cámara del teléfono
- Historial de movimientos (auditoría automática)
- Interfaz en español / inglés
- Instalable como app en iPhone / Android (PWA)

## Stack

| Capa | Herramienta |
|---|---|
| Frontend | React 18 + TypeScript + Vite, `vite-plugin-pwa` |
| Datos / Auth / Fotos | Supabase (Postgres + RLS, Auth, Storage) |
| Hosting | Render Static Site (deploy automático desde Git) |

No hay backend propio: la app habla directo con Supabase y la seguridad la hacen las políticas RLS de la migración.

## 1. Supabase

1. Crea un proyecto en <https://supabase.com>.
2. **SQL Editor** → pega y ejecuta `supabase/migrations/0001_init.sql`.
   Crea tablas, vistas de valor, políticas RLS y el bucket `labels`.
3. **Authentication → Providers → Email**: deja Email habilitado. Para pruebas puedes desactivar "Confirm email".
4. **Settings → API**: copia `Project URL` y `anon public` key.
5. Después de crear tu primer usuario desde la app, hazlo admin (SQL Editor):
   ```sql
   update public.profiles set role='admin'
   where id = (select id from auth.users order by created_at limit 1);
   ```
   Si no quieres que cualquiera pueda registrarse, desactiva "Enable sign ups" en Auth y crea usuarios desde el dashboard.

## 2. Local

```bash
cp .env.example .env      # pon tu URL y anon key
npm install
npm run dev
```

## 3. Git + Render

```bash
git init && git add -A && git commit -m "Cava: wine storage inventory"
gh repo create cava --private --source=. --push   # o crea el repo en GitHub y haz push
```

En Render:

1. **New → Blueprint** → conecta el repo. Render lee `render.yaml` (static site, build `npm ci && npm run build`, publica `dist`, rewrite `/* → /index.html`).
2. En **Environment** agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. Deploy. Cada push a `main` redeploya solo.

En Supabase → **Authentication → URL Configuration** agrega la URL de Render como Site URL / Redirect URL.

## 4. Instalar como app

- **iPhone**: abre la URL en Safari → Compartir → *Añadir a pantalla de inicio*.
- **Android**: Chrome muestra "Instalar app" (o menú ⋮ → *Instalar aplicación*).

Si más adelante la quieres en App Store / Play Store, este mismo código se envuelve con Capacitor (`npm i @capacitor/core @capacitor/ios @capacitor/android`) sin cambios en la app.

## Modelo de datos

```
clients ──< bottles >── wines
              │
              └── slots >── racks   (slots se generan solos: shelves × positions_per_shelf)
movements (log automático de cambios de slot / estado)
```

Vistas: `bottle_details` (todo junto), `client_values` (valor por cliente), `storage_summary` (totales y ocupación).
Al marcar una botella como vendida/consumida/retirada, el slot se libera automáticamente.

## Estructura

```
supabase/migrations/0001_init.sql   esquema completo
src/lib/        supabase client, auth, i18n, tipos
src/components/ UI base, SlotPicker (mapa de rack)
src/pages/      Dashboard, Bottles, Wines, Racks, Clients, Login
render.yaml     blueprint de Render
```
