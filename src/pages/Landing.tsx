import { Link } from 'react-router-dom'

const cigars=[
  {name:'Reserva 1926',origin:'Nicaragua',vitola:'Robusto',strength:'Media–fuerte',price:'$22',image:'/images/cigar-reserva-v2.webp'},
  {name:'Maduro Selección',origin:'República Dominicana',vitola:'Torpedo',strength:'Fuerte',price:'$19',image:'/images/cigar-maduro-v2.webp'},
  {name:'Connecticut Privada',origin:'Honduras',vitola:'Toro',strength:'Suave–media',price:'$14',image:'/images/cigar-connecticut-v2.webp'},
]

const plans=[
  {name:'Digital',price:'24.99',tag:'Organiza tu colección',items:['Catálogo personal','Valor de colección','Historial y notas','Acceso desde cualquier dispositivo']},
  {name:'Reserva',price:'120',tag:'Tu espacio en nuestro humidor',featured:true,items:['Hasta 40 piezas o cajas','Ubicación exacta','Control de temperatura y humedad','Solicitudes de entrada y retiro']},
  {name:'Colección',price:'175',tag:'Para coleccionistas',items:['Hasta 100 piezas o cajas','Atención prioritaria','Inventario y valoración','Acceso anticipado a ofertas']},
]

export function Landing(){return <div className="public-site">
  <header className="public-nav"><Link to="/" className="public-brand"><img src="/icon.svg" alt=""/><span>CigarrosPR</span></Link><nav><a href="#seleccion">Selección</a><a href="#membresias">Membresías</a><Link to="/demo">Demo</Link><Link className="btn sm" to="/login">Entrar</Link></nav></header>
  <main>
    <section className="cigar-hero">
      <img className="hero-photo" src="/images/cigarrospr-hero-v2.webp" alt="Humidor de cedro abierto con cigarros de colección"/>
      <div className="hero-copy"><span className="eyebrow">Humidor privado · Puerto Rico</span><h1>Tu colección,<br/><i>bien cuidada.</i></h1><p>Almacenamiento controlado, inventario con fotos de cada etiqueta y la ubicación exacta de cada cigarro.</p><div className="hero-actions"><Link className="btn public-cta" to="/login?signup=1">Crear mi cuenta</Link><Link className="text-link" to="/demo">Ver cómo funciona →</Link></div><div className="trust-row"><span>69% HR</span><span>Ubicación exacta</span><span>Inventario privado</span></div></div>
    </section>

    <section className="public-section cigar-selection" id="seleccion"><div className="section-heading"><div><span className="eyebrow">Selección CigarrosPR</span><h2>Conoce cada cigarro<br/>antes de escogerlo.</h2></div><p>Fotos grandes, etiqueta visible y la información que realmente importa. Sin ruido.</p></div><div className="cigar-product-grid">{cigars.map((c,i)=><article className={i===0?'wide':''} key={c.name}><div className="product-photo"><img src={c.image} alt={`${c.name}, cigarro ${c.vitola}`}/><span>{String(i+1).padStart(2,'0')}</span></div><div className="product-info"><div><small>{c.origin}</small><h3>{c.name}</h3><p>{c.vitola} · {c.strength}</p></div><strong>{c.price}</strong></div></article>)}</div></section>

    <section className="editorial-how" id="como"><div><span className="eyebrow">El proceso</span><h2>De la etiqueta<br/>a tu espacio.</h2></div><ol><li><b>01</b><div><h3>Fotografiamos</h3><p>La etiqueta queda unida a su ficha para reconocer cada pieza.</p></div></li><li><b>02</b><div><h3>Ubicamos</h3><p>Humidor, gaveta y espacio exacto, siempre visibles para ti.</p></div></li><li><b>03</b><div><h3>Cuidamos</h3><p>Ambiente estable y registro privado de toda tu colección.</p></div></li></ol></section>

    <section className="public-section plans-section" id="membresias"><span className="eyebrow">Membresías</span><h2>El espacio que tu colección necesita.</h2><div className="plan-grid">{plans.map(p=><article className={p.featured?'featured':''} key={p.name}>{p.featured&&<em>Más popular</em>}<h3>{p.name}</h3><p>{p.tag}</p><div className="plan-price"><strong>${p.price}</strong><span>/ mes</span></div><ul>{p.items.map(x=><li key={x}>✓ {x}</li>)}</ul><Link className="btn" to={`/login?signup=1&plan=${p.name.toLowerCase()}`}>Seleccionar</Link></article>)}</div></section>
    <section className="public-banner"><div><span className="eyebrow">CigarrosPR Humidor</span><h2>Menos listas. Más control.</h2><p>Ve cada etiqueta, ubicación y valor cuando quieras.</p></div><Link className="btn public-cta" to="/login?signup=1">Comenzar</Link></section>
  </main><footer className="public-footer"><span>© 2026 CigarrosPR</span><span>Puerto Rico · Servicio exclusivo para adultos 21+</span></footer>
</div>}
