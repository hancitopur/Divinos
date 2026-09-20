import { Link } from 'react-router-dom'
import { Brand } from '../components/Brand'

export const TERMS_VERSION = '2026-09-20-draft'

export function Terms() {
  return (
    <div className="legal-page">
      <header className="legal-head"><Link to="/"><Brand /></Link><Link className="btn secondary sm" to="/login">Volver</Link></header>
      <main className="legal-copy">
        <span className="landing-kicker">Condiciones del servicio</span>
        <h1>Acuerdo de almacenamiento y custodia de vinos</h1>
        <p className="legal-alert"><strong>Borrador operativo.</strong> Antes de aceptar almacenamiento físico, Divinos completará la entidad legal, dirección, tarifas, seguro y plazos aplicables en la orden final.</p>
        <p>El pago reserva o activa el servicio. La aceptación física de botellas puede requerir que el cliente complete y firme la orden y este acuerdo. El inventario, la orden y estas condiciones forman conjuntamente el contrato.</p>
        <h2>1. Servicio e inventario</h2>
        <p>Divinos almacenará los vinos aceptados en el espacio contratado. El cliente conserva la propiedad. El inventario digital puede incluir fotografías, marca, añada, cantidad, tamaño, valor informado y condición aparente; no certifica autenticidad, procedencia ni calidad interna.</p>
        <h2>2. Pagos, acceso y planes</h2>
        <p>Los cargos recurrentes vencen según la orden. El acceso depende de que la cuenta permanezca activa. Digital, Reserva y Colección incluyen las mismas herramientas digitales; Reserva y Colección añaden capacidad física según el plan contratado.</p>
        <h2>3. Conservación y seguridad</h2>
        <p>Divinos aplicará cuidado razonable, control de temperatura, videovigilancia y controles de acceso según el servicio. El vino puede afectarse por envejecimiento natural, cierres defectuosos, humedad, luz, vibración o defectos de fabricación. El cliente debe informar por escrito cualquier botella de valor excepcional.</p>
        <h2>4. Seguro y responsabilidad</h2>
        <p>El cliente debe confirmar si mantiene seguro propio. Cualquier límite, deducible o protección adicional deberá constar claramente en la orden y aplicará solamente en la medida permitida por ley.</p>
        <h2>5. Mora, retención y disposición</h2>
        <p>La falta de pago no transfiere automáticamente la propiedad a Divinos. Divinos podrá suspender acceso y ejercer los remedios permitidos por la ley de Puerto Rico, luego de los avisos correspondientes. Cualquier venta o disposición seguirá un procedimiento legal válido y, cuando corresponda, utilizará personas autorizadas para manejar bebidas alcohólicas.</p>
        <h2>6. Terminación, emergencias y controversias</h2>
        <p>El cliente podrá terminar el servicio conforme a la orden, pagando el balance y retirando sus bienes. Ante emergencia o riesgo de pérdida, Divinos podrá mover temporalmente los bienes a un lugar seguro. Este acuerdo se regirá por las leyes de Puerto Rico.</p>
        <h2>7. Privacidad y cuenta digital</h2>
        <p>Cada cliente puede consultar únicamente su propia colección. No debe compartir credenciales. Divinos utiliza proveedores de infraestructura y pago para operar la cuenta, conservar fotografías y procesar la membresía.</p>
        <p className="muted small">Versión {TERMS_VERSION}. La aceptación electrónica registra la versión y fecha aceptada.</p>
      </main>
    </div>
  )
}
