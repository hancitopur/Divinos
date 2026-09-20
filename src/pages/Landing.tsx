import { Link } from 'react-router-dom'
import { Brand } from '../components/Brand'

const features = [
  ['Registra', 'Fotografía la etiqueta y Divinos completa los datos disponibles.'],
  ['Organiza', 'Cada botella queda asignada a un rack y una posición exacta.'],
  ['Protege', 'Temperatura controlada, cámaras y seguridad 24 horas.'],
  ['Disfruta', 'Encuentra tu vino y conoce el valor de tu colección desde el teléfono.'],
]

const storagePlans = [
  { name: 'Digital', capacity: 'Tu propia cava', price: '9', total: '9.68', note: 'Inventario y aplicación' },
  { name: 'Reserva', capacity: 'Hasta 72 botellas', price: '49', total: '52.68', note: '6 cajas almacenadas', featured: true },
  { name: 'Colección', capacity: 'Hasta 144 botellas', price: '79', total: '84.93', note: '12 cajas almacenadas' },
]

function PayLink({ plan, children, secondary = false }: { plan: string; children: string; secondary?: boolean }) {
  return <Link className={`btn landing-btn ${secondary ? 'secondary' : ''}`} to={`/login?plan=${plan}`}>{children}</Link>
}

function Jump({ to, className = '', children }: { to: string; className?: string; children: string }) {
  return <a className={className} href={`#${to}`} onClick={(event) => { event.preventDefault(); document.getElementById(to)?.scrollIntoView({ behavior: 'smooth' }) }}>{children}</a>
}

export function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Link to="/" aria-label="Divinos, inicio"><Brand /></Link>
        <nav aria-label="Navegación principal">
          <Jump to="como-funciona">Cómo funciona</Jump>
          <Jump to="planes">Planes</Jump>
          <Link className="landing-signin" to="/login">Entrar</Link>
        </nav>
      </header>

      <main>
        <section className="landing-hero">
          <div className="hero-copy">
            <span className="landing-kicker">Tu colección. Siempre localizada.</span>
            <h1>Tu colección merece el lugar correcto.</h1>
            <p>Almacenamiento climatizado y control digital para proteger, localizar y conocer el valor de cada botella.</p>
            <div className="hero-actions">
              <Jump className="btn landing-btn" to="planes">Reservar mi espacio</Jump>
              <Link className="btn landing-btn secondary" to="/demo">Ver demo</Link>
            </div>
          </div>
          <div className="cellar-visual" aria-label="Vista resumida de una colección en Divinos">
            <div className="visual-top"><Brand compact light /><span>Mi cava</span><b>96 botellas</b></div>
            <div className="visual-value"><small>Valor de la colección</small><strong>$10,248</strong><span>+12 botellas este mes</span></div>
            <div className="visual-racks">
              {[82, 64, 91].map((value, i) => <div key={value}><span>Rack {String.fromCharCode(65 + i)}</span><i><em style={{ width: `${value}%` }} /></i><b>{value}%</b></div>)}
            </div>
            <div className="visual-bottles">
              <span>Rioja</span><span>Napa Valley</span><span>Mendoza</span><span>Bordeaux</span>
            </div>
          </div>
        </section>

        <section className="landing-strip security-strip" aria-label="Protección de la cava">
          <span><b>55–58°F</b> Temperatura controlada</span><i /> <span><b>24/7</b> Seguridad</span><i /> <span><b>Siempre</b> Cámaras activas</span><i /> <span><b>En vivo</b> Inventario digital</span>
        </section>

        <section className="landing-section" id="como-funciona">
          <div className="section-heading"><span className="landing-kicker">Simple desde el primer día</span><h2>De la etiqueta a tu cava en cuatro pasos.</h2></div>
          <div className="feature-grid">
            {features.map(([title, body], index) => <article key={title}><span>{index + 1}</span><div><h3>{title}</h3><p>{body}</p></div></article>)}
          </div>
        </section>

        <section className="landing-section plans-section" id="planes">
          <div className="section-heading"><span className="landing-kicker">Planes claros</span><h2>Empieza pequeño. Crece sin mover tu colección.</h2><p>Todos los planes físicos incluyen inventario digital, temperatura controlada, cámaras y seguridad 24 horas.</p></div>
          <div className="pricing-line">
            {storagePlans.map((plan) => (
              <article className={plan.featured ? 'featured' : ''} key={plan.name}>
                {plan.featured && <span className="popular">Más elegido</span>}
                <span className="plan-label">{plan.name}</span>
                <strong><sup>$</sup>{plan.price}<small>/mes</small></strong>
                <span className="plan-total">Total con servicio: ${plan.total}/mes</span>
                <h3>{plan.capacity}</h3><p>{plan.note}</p>
                <PayLink plan={plan.name.toLowerCase()} secondary={plan.name !== 'Digital'}>{plan.name === 'Digital' ? 'Activar app' : 'Reservar'}</PayLink>
              </article>
            ))}
          </div>
          <div className="included-line"><span>Incluido con almacenamiento</span><b>Control de temperatura</b><b>Videovigilancia</b><b>Seguridad 24/7</b><b>Inventario en Divinos</b></div>
          <p className="payment-note">A cada plan se añade un cargo de servicio de 7.5%, claramente desglosado antes de pagar. Pago recurrente protegido por PayPal; la cuenta se activa solamente cuando PayPal confirma la suscripción.</p>
        </section>

        <section className="landing-final">
          <Brand light />
          <h2>Protege hoy lo que quieres abrir mañana.</h2>
          <p>Reserva el espacio adecuado y controla tu colección completa desde el teléfono.</p>
          <Jump className="btn landing-btn gold" to="planes">Ver disponibilidad</Jump>
        </section>
      </main>

      <footer className="landing-footer"><Brand /><span>© 2026 Divinos · Puerto Rico</span><Link to="/login">Acceso de clientes</Link></footer>
      <div className="mobile-buybar"><span>Organiza tu cava</span><Jump className="btn" to="planes">Ver planes</Jump></div>
    </div>
  )
}
