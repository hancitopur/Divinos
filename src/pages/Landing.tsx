import { Link } from 'react-router-dom'
import { Brand } from '../components/Brand'

const membershipUrl = import.meta.env.VITE_STRIPE_MEMBERSHIP_URL as string | undefined
const rentalUrl = import.meta.env.VITE_STRIPE_RENTAL_URL as string | undefined

const features = [
  ['Inventario visual', 'Encuentra cada botella por nombre, etiqueta, marca, región o ubicación.'],
  ['Valor de tu colección', 'Conoce inversión, precio de venta y valor total en tiempo real.'],
  ['Tu cava, organizada', 'Mapa por rack, sección y posición para saber exactamente dónde está todo.'],
  ['Desde el teléfono', 'Registra entradas, movimientos y fotos de etiqueta mientras estás frente a la cava.'],
]

function PayLink({ href, children, secondary = false }: { href?: string; children: string; secondary?: boolean }) {
  if (href) return <a className={`btn landing-btn ${secondary ? 'secondary' : ''}`} href={href}>{children}</a>
  return <a className={`btn landing-btn ${secondary ? 'secondary' : ''}`} href="mailto:info@grafichee.com?subject=Quiero%20Divinos">{children}</a>
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
            <h1>La forma inteligente de organizar y valorar tus vinos.</h1>
            <p>Divinos convierte tu cava en un inventario claro y visual. Registra botellas, identifica etiquetas y conoce el valor de tu colección desde cualquier lugar.</p>
            <div className="hero-actions">
              <Jump className="btn landing-btn" to="planes">Comenzar</Jump>
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

        <section className="landing-strip" aria-label="Beneficios principales">
          <span>Etiqueta o foto</span><i /> <span>Ubicación exacta</span><i /> <span>Valor actualizado</span><i /> <span>Acceso móvil</span>
        </section>

        <section className="landing-section" id="como-funciona">
          <div className="section-heading"><span className="landing-kicker">Todo en su lugar</span><h2>Menos tiempo buscando. Más tiempo disfrutando.</h2></div>
          <div className="feature-grid">
            {features.map(([title, body], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{body}</p></article>)}
          </div>
        </section>

        <section className="landing-section plans-section" id="planes">
          <div className="section-heading"><span className="landing-kicker">Elige cómo usar Divinos</span><h2>Tu cava digital, con o sin espacio físico.</h2><p>Empieza administrando tu propia colección o solicita almacenamiento profesional.</p></div>
          <div className="plan-grid">
            <article className="plan-card featured">
              <span className="plan-label">Membresía</span><h3>Divinos Digital</h3>
              <p>Para coleccionistas que quieren organizar, valorar y controlar su propia cava.</p>
              <ul><li>Inventario de botellas</li><li>Búsqueda de etiquetas</li><li>Mapa de racks</li><li>Valor y movimientos</li></ul>
              <PayLink href={membershipUrl}>Obtener membresía</PayLink>
            </article>
            <article className="plan-card dark">
              <span className="plan-label">Renta</span><h3>Cava administrada</h3>
              <p>Espacio climatizado y control digital para guardar tu colección con trazabilidad.</p>
              <ul><li>Espacio según capacidad</li><li>Inventario incluido</li><li>Recepción y ubicación</li><li>Acceso a tu colección</li></ul>
              <PayLink href={rentalUrl} secondary>Solicitar espacio</PayLink>
            </article>
          </div>
          {!membershipUrl && <p className="payment-note">La solicitud está activa. El cobro en línea se habilitará al definir precios y conectar la cuenta de pagos.</p>}
        </section>

        <section className="landing-final">
          <Brand light />
          <h2>Tu colección merece más que una lista.</h2>
          <p>Descubre dónde está cada botella, cuánto vale y cómo está creciendo tu cava.</p>
          <Jump className="btn landing-btn gold" to="planes">Comenzar con Divinos</Jump>
        </section>
      </main>

      <footer className="landing-footer"><Brand /><span>© 2026 Divinos · Puerto Rico</span><Link to="/login">Acceso de clientes</Link></footer>
    </div>
  )
}
