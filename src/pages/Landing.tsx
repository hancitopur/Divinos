import { Link } from 'react-router-dom'
import { Brand } from '../components/Brand'

const features = [
  ['Fotografía', 'Toma la etiqueta. Completamos la información disponible.'],
  ['Guardamos', 'Asignamos cada botella a una posición exacta.'],
  ['Disfruta', 'Encuéntrala desde tu teléfono cuando la quieras.'],
]

const storagePlans = [
  { name: 'Digital', capacity: 'Tu propia cava', total: '9.68', note: 'Inventario y aplicación' },
  { name: 'Reserva', capacity: 'Hasta 72 botellas', total: '52.68', note: '6 cajas almacenadas', featured: true },
  { name: 'Colección', capacity: 'Hasta 144 botellas', total: '84.93', note: '12 cajas almacenadas' },
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
          <Link className="store-nav-cta" to="/shop">Comprar vinos</Link>
          <Link className="landing-signin" to="/login">Entrar</Link>
        </nav>
      </header>

      <main>
        <section className="landing-hero">
          <div className="hero-copy">
            <span className="landing-kicker">Tu colección. Siempre localizada.</span>
            <h1>Tu vino, protegido y siempre localizado.</h1>
            <p>Guardamos tu colección en condiciones controladas. Tú la ves y la encuentras desde el teléfono.</p>
            <div className="hero-actions">
              <Jump className="btn landing-btn" to="planes">Reservar mi espacio</Jump>
              <Link className="btn landing-btn store-hero-cta" to="/shop"><span>Comprar vinos</span><small>Entra sin registrarte</small></Link>
            </div>
          </div>
          <figure className="cellar-photo"><img src="/divinos-cellar-hero.webp" alt="Colección organizada en una cava de vinos con acceso desde el teléfono" /><figcaption><b>Tu cava en el teléfono</b><span>Inventario, ubicación y valor en un solo lugar.</span></figcaption></figure>
        </section>

        <section className="landing-strip security-strip" aria-label="Protección de la cava">
          <span><b>55–58°F</b> Temperatura controlada</span><i /> <span><b>24/7</b> Seguridad</span><i /> <span><b>Siempre</b> Cámaras activas</span><i /> <span><b>En vivo</b> Inventario digital</span>
        </section>

        <section className="landing-section" id="como-funciona">
          <div className="process-layout"><figure className="process-photo"><img src="/divinos-scan-cellar.webp" alt="Registro de una botella fotografiando su etiqueta" /></figure><div><div className="section-heading"><span className="landing-kicker">Así de fácil</span><h2>Fotografía. Guarda. Disfruta.</h2></div><div className="feature-grid">{features.map(([title, body], index) => <article key={title}><span>{index + 1}</span><div><h3>{title}</h3><p>{body}</p></div></article>)}</div></div></div>
        </section>

        <section className="landing-section plans-section" id="planes">
          <div className="section-heading"><span className="landing-kicker">Elige tu espacio</span><h2>Un plan para cada colección.</h2><p>Los planes físicos incluyen protección, cámaras e inventario digital.</p></div>
          <div className="pricing-line">
            {storagePlans.map((plan) => (
              <article className={plan.featured ? 'featured' : ''} key={plan.name}>
                {plan.featured && <span className="popular">Más elegido</span>}
                <span className="plan-label">{plan.name}</span>
                <strong><sup>$</sup>{plan.total}<small>/mes</small></strong>
                <span className="plan-total">Precio final</span>
                <h3>{plan.capacity}</h3><p>{plan.note}</p>
                <PayLink plan={plan.name.toLowerCase()} secondary={plan.name !== 'Digital'}>{plan.name === 'Digital' ? 'Activar app' : 'Reservar'}</PayLink>
              </article>
            ))}
          </div>
          <div className="included-line"><span>Incluido con almacenamiento</span><b>Control de temperatura</b><b>Videovigilancia</b><b>Seguridad 24/7</b><b>Inventario en Divinos</b></div>
          <p className="payment-note">Precios finales con servicio incluido. Pago recurrente protegido por PayPal.</p>
        </section>

        <section className="landing-final">
          <Brand light />
          <h2>Protege hoy lo que quieres abrir mañana.</h2>
          <p>Reserva el espacio adecuado y controla tu colección completa desde el teléfono.</p>
          <Jump className="btn landing-btn gold" to="planes">Ver disponibilidad</Jump>
        </section>
      </main>

      <footer className="landing-footer"><Brand /><span>© 2026 Divinos · Puerto Rico</span><Link to="/shop">Tienda de vinos</Link><Link to="/login">Acceso de clientes</Link></footer>
      <div className="mobile-buybar"><span>Vinos disponibles</span><Link className="btn" to="/shop">Ver tienda</Link></div>
    </div>
  )
}
