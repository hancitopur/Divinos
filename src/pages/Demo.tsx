import { Link } from 'react-router-dom'
import { Brand } from '../components/Brand'

const clients = [
  { name: 'Familia Rivera', bottles: 84, value: '$18,640', change: '+6 este mes' },
  { name: 'Colección Méndez', bottles: 61, value: '$14,280', change: '+12 este mes' },
  { name: 'Reserva Corporativa', bottles: 43, value: '$9,750', change: '+4 este mes' },
]

const activity = [
  ['Château Margaux 2018', 'Rack A · S3 · P08', 'Recibida'],
  ['Opus One 2019', 'Rack B · S1 · P04', 'Movida'],
  ['Vega Sicilia Único 2014', 'Rack A · S5 · P11', 'Entregada'],
]

export function Demo() {
  return (
    <div className="demo-shell">
      <header className="demo-topbar">
        <div className="demo-brand"><Brand light /></div>
        <div className="row">
          <span className="demo-pill">Demo interactivo</span>
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
                <span className="demo-bottle">🍷</span><div><strong>{wine}</strong><small>{location}</small></div><span className="badge">{action}</span>
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
