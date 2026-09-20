import { Link } from 'react-router-dom'
import { Brand } from '../components/Brand'

export const TERMS_VERSION = '2026-09-20-v4-draft'
export const BILLING_VERSION = '2026-09-20-v2-service-fee'

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
        <h2>2. Pagos, cargos, acceso y planes</h2>
        <p>Al precio mensual base del plan seleccionado se añade un cargo de servicio de 7.5%. La suma se renueva automáticamente mediante PayPal hasta su cancelación y podrán añadirse los impuestos exigidos por ley. Cualquier manejo, entrega, recogido, seguro opcional u otro servicio adicional se cobrará únicamente si su importe se divulga y el cliente lo acepta antes de prestarse.</p>
        <p>El acceso depende de que la cuenta permanezca pagada y activa. Digital, Reserva y Colección incluyen las mismas herramientas digitales; Reserva y Colección añaden capacidad física según el plan contratado.</p>
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
        <h2>8. Compras de vino y recogido</h2>
        <p>Las compras están sujetas a disponibilidad, verificación de edad y confirmación del pago. El precio presentado antes de PayPal es el precio final del producto con el servicio incluido, sin perjuicio de impuestos que deban divulgarse. Divinos no enviará bebidas alcohólicas por correo. El comprador deberá presentar identificación válida y cumplir el procedimiento de recogido autorizado.</p>
        <h2>9. Cancelaciones, reembolsos y excepciones</h2>
        <p>Una orden duplicada, un pago que no coincida con la orden, falta de inventario o cualquier alerta del proveedor de pago quedará en revisión antes de entregar o mover la botella. La política final deberá establecer por escrito cuándo procede cancelar o reembolsar, los plazos de solicitud y cualquier excepción aplicable a vinos ya recogidos o incorporados al almacenamiento.</p>
        <h2>10. Información que debe constar en la orden final</h2>
        <p>Antes de aceptar custodia física deberán identificarse la entidad que presta el servicio, dirección, contacto, alcance del seguro, límites de responsabilidad, procedimiento de reclamación, reglas de acceso y cualquier licencia o requisito regulatorio aplicable.</p>
        <p className="muted small">Términos {TERMS_VERSION} · Divulgación de cargos {BILLING_VERSION}. La aceptación electrónica registra la versión, plan, importe y fecha aceptada.</p>
      </main>
    </div>
  )
}
