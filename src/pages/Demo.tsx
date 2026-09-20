import { Link } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { wineProductPhoto } from '../lib/productPhotos'

const clients = [
  { name: 'Familia Rivera', bottles: 84, value: '$18,640', change: '+6 este mes' },
  { name: 'Colección Méndez', bottles: 61, value: '$14,280', change: '+12 este mes' },
  { name: 'Reserva Corporativa', bottles: 43, value: '$9,750', change: '+4 este mes' },
]

const activity = [
  ['Artemis Cabernet Sauvignon 2021', 'Rack A · S3 · P08', 'Recibida'],
  ['Opus One 2019', 'Rack B · S1 · P04', 'Movida'],
  ['Tignanello 2020', 'Rack A · S5 · P11', 'Entregada'],
]

const inventory = [
  { name: 'Artemis Cabernet Sauvignon', vintage: '2021', origin: 'Napa Valley, USA', price: '$95', location: 'A · S3 · P08' },
  { name: 'Opus One', vintage: '2019', origin: 'Napa Valley, USA', price: '$425', location: 'B · S1 · P04' },
  { name: 'Tignanello', vintage: '2020', origin: 'Toscana, Italia', price: '$219', location: 'A · S5 · P11' },
  { name: 'Gran Reserva 904', vintage: '2015', origin: 'Rioja, España', price: '$89', location: 'C · S2 · P06' },
  { name: 'Dom Pérignon Vintage', vintage: '2013', origin: 'Champagne, Francia', price: '$289', location: 'D · S1 · P02' },
  { name: 'Erdener Prälat Riesling', vintage: '2020', origin: 'Mosel, Alemania', price: '$145', location: 'B · S4 · P09' },
]

function BottlePhoto({ wine, compact = false }: { wine: typeof inventory[number]; compact?: boolean }) {
  return (
    <div className={`demo-wine-photo ${compact ? 'compact' : ''}`}>
      <img src={wineProductPhoto(`${wine.name} ${wine.vintage}`)} alt={`Botella de ${wine.name} ${wine.vintage}`} loading="lazy" />
    </div>
  )
}

export function Demo() {
  return (
    <div className="demo-shell">
      <header className="demo-topbar">
        <div className="demo-brand"><Brand light /></div>
        <div className="row">
          <span className="demo-pill">Cómo funciona</span>
          <Link className="btn sm demo-login" to="/login">Entrar</Link>
        </div>
      </header>

      <main className="demo-main stack">
        <section className="demo-hero">
          <div>
            <span className="demo-eyebrow">Control total de cada botella</span>
            <h1>Una cava organizada también es un negocio más rentable.</h1>
            <p>Inventario, clientes, valor, ubicación y movimientos en una sola plataforma diseñada para operar desde el teléfono.</p>
          </div>
          <div className="demo-hero-card">
            <span>Valor de venta administrado</span>
            <strong>$42,670</strong>
            <small>188 botellas activas · datos simulados</small>
          </div>
        </section>

        <section className="grid4">
          <div className="stat"><div className="label">En almacenamiento</div><div className="value">188</div><div className="sub">botellas</div></div>
          <div className="stat"><div className="label">Valor de compra</div><div className="value">$31,420</div><div className="sub">capital registrado</div></div>
          <div className="stat"><div className="label">Margen proyectado</div><div className="value ok">$11,250</div><div className="sub">35.8% potencial</div></div>
          <div className="stat"><div className="label">Clientes activos</div><div className="value">12</div><div className="sub">colecciones</div></div>
        </section>

        <section className="demo-inventory-section">
          <div className="demo-section-head">
            <div><span className="demo-kicker">Inventario visual</span><h2>Cada botella se reconoce por su etiqueta</h2></div>
            <span className="demo-count">6 de 188</span>
          </div>
          <div className="demo-wine-grid">
            {inventory.map((wine) => (
              <article className="demo-wine" key={`${wine.name}-${wine.vintage}`}>
                <BottlePhoto wine={wine} />
                <div className="demo-wine-info">
                  <small>{wine.origin}</small>
                  <h3>{wine.name} <span>{wine.vintage}</span></h3>
                  <div><b>{wine.price}</b><em>{wine.location}</em></div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="demo-shop-preview">
          <div className="demo-section-head"><div><span className="demo-kicker">Nuevo · acceso anticipado</span><h2>Compra y vende dentro de Divinos</h2><p>Encuentra nuevas llegadas de Divinos o botellas verificadas de otros miembros. Cada venta entre miembros requiere aprobación antes de publicarse.</p></div><Link className="btn" to="/login?plan=reserva">Quiero acceso</Link></div>
          <div className="demo-shop-grid">{inventory.slice(3,5).map((wine,index)=><article key={wine.name}><BottlePhoto wine={wine}/><div><small>{index===0?'INVENTARIO DIVINOS':'COLECCIÓN DE MIEMBRO'} · {wine.origin}</small><h3>{wine.name} {wine.vintage}</h3><p>{index===0?'12 botellas disponibles':'1 botella verificada'}</p><strong>{index===0?'$342.93':'$310.68'} <small>con servicio</small></strong><span>{index===0?'Compra → inventario → rack asignado':'Miembro solicita → Divinos aprueba → se publica'}</span></div></article>)}</div>
        </section>

        <section className="demo-intake">
          <div className="demo-intake-copy">
            <span className="demo-eyebrow">Entrada del cliente</span>
            <h2>Tan fácil como tomar una foto.</h2>
            <p>El cliente puede preparar su colección desde el teléfono. Busca el vino o fotografía la etiqueta; Divinos completa los datos disponibles y el equipo confirma precio, condición y ubicación al recibirla.</p>
            <ol className="demo-intake-steps">
              <li><b>01</b><span><strong>Foto o búsqueda</strong><small>Escanea la etiqueta o escribe el nombre.</small></span></li>
              <li><b>02</b><span><strong>Confirmar datos</strong><small>Confirma añada, cantidad y precio si lo conoce.</small></span></li>
              <li><b>03</b><span><strong>Enviar colección</strong><small>Queda pendiente para revisión de Divinos.</small></span></li>
            </ol>
          </div>
          <div className="intake-phone" aria-label="Ejemplo del formulario móvil para registrar una botella">
            <div className="intake-phone-top"><span>9:41</span><b>DIVINOS</b><span>•••</span></div>
            <div className="intake-phone-body">
              <div className="intake-progress"><i /><i /><i /></div>
              <small className="demo-kicker">Botella 1 de 6</small>
              <h3>Añadir a mi colección</h3>
              <div className="intake-photo">
                <BottlePhoto wine={inventory[2]} compact />
                <div><b>Etiqueta encontrada</b><span>Datos completados automáticamente</span><button type="button">Cambiar foto</button></div>
              </div>
              <label>Vino<input readOnly value="Vega Sicilia Único" /></label>
              <div className="intake-fields"><label>Añada<input readOnly value="2014" /></label><label>Cantidad<input readOnly value="6" /></label></div>
              <label>Precio de compra (opcional)<input readOnly value="$ 395.00" /></label>
              <button type="button" className="intake-submit">Añadir 6 botellas</button>
              <span className="intake-note">Divinos verificará la información al recibirlas.</span>
            </div>
          </div>
        </section>

        <section className="demo-grid">
          <div className="card stack">
            <div className="row between"><div><span className="demo-kicker">Almacenamiento</span><h2>Ocupación de la cava</h2></div><strong>78%</strong></div>
            <div className="demo-progress"><span style={{ width: '78%' }} /></div>
            <div className="demo-racks">
              {[82, 68, 91, 54].map((pct, index) => (
                <div className="demo-rack" key={pct}><span>Rack {String.fromCharCode(65 + index)}</span><b>{pct}%</b><i><em style={{ width: `${pct}%` }} /></i></div>
              ))}
            </div>
          </div>

          <div className="card stack">
            <div><span className="demo-kicker">Portafolio</span><h2>Valor por cliente</h2></div>
            {clients.map((client) => (
              <div className="demo-client" key={client.name}>
                <div><strong>{client.name}</strong><small>{client.bottles} botellas · {client.change}</small></div>
                <b>{client.value}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="card stack">
          <div className="row between"><div><span className="demo-kicker">Trazabilidad</span><h2>Actividad reciente</h2></div><span className="badge in_storage">En vivo</span></div>
          <div className="demo-activity">
            {activity.map(([wine, location, action]) => (
              <div className="demo-activity-row" key={wine}>
                <BottlePhoto wine={inventory.find((item) => wine.startsWith(item.name)) ?? inventory[0]} compact /><div><strong>{wine}</strong><small>{location}</small></div><span className="badge">{action}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="demo-cta">
          <div><span className="demo-eyebrow">De la cava a la data</span><h2>¿Listo para controlar tu inventario?</h2><p>Configura racks, registra clientes y conoce el valor real de cada colección.</p></div>
          <Link className="btn" to="/">Solicitar acceso</Link>
        </section>
        <p className="demo-disclaimer">Esta pantalla usa información simulada y no muestra datos de clientes reales.</p>
      </main>
    </div>
  )
}
