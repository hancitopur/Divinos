type Message = {
  to: string
  subject: string
  title: string
  preheader: string
  paragraphs: string[]
  details?: Array<[string, string]>
  actionLabel?: string
  actionUrl?: string
  idempotencyKey: string
}

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char]!)

export async function sendTransactionalEmail(message: Message) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RESEND_FROM_EMAIL')
  if (!apiKey || !from || !message.to) return { skipped: true }
  const replyTo = Deno.env.get('RESEND_REPLY_TO') || from.replace(/^.*<([^>]+)>.*$/, '$1')
  const details = message.details?.length ? `<dl style="margin:20px 0;padding:16px;background:#f6f1ec;border-radius:12px">${message.details.map(([label,value])=>`<div style="display:flex;justify-content:space-between;gap:16px;margin:7px 0"><dt style="color:#6f6064">${escapeHtml(label)}</dt><dd style="margin:0;font-weight:700;text-align:right">${escapeHtml(value)}</dd></div>`).join('')}</dl>` : ''
  const action = message.actionLabel && message.actionUrl ? `<p style="margin:26px 0"><a href="${escapeHtml(message.actionUrl)}" style="display:block;padding:14px 18px;color:#ffffff;background:#5b1a2b;border-radius:10px;text-align:center;text-decoration:none;font-weight:700">${escapeHtml(message.actionLabel)}</a></p>` : ''
  const html = `<!doctype html><html lang="es" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(message.subject)}</title></head><body style="margin:0;background:#f6f1ec;color:#241a1c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><div lang="es" dir="ltr" style="display:none;max-height:0;overflow:hidden">${escapeHtml(message.preheader)}</div><div lang="es" dir="ltr" style="max-width:560px;margin:0 auto;padding:28px 16px"><div style="padding:14px 18px;color:#ffffff;background:#5b1a2b;border-radius:14px 14px 0 0;font-size:22px;font-weight:800;letter-spacing:.04em">DIVINOS</div><main style="padding:28px 22px;background:#ffffff;border-radius:0 0 14px 14px"><h1 style="margin:0 0 18px;font:600 28px/1.1 Georgia,serif">${escapeHtml(message.title)}</h1>${message.paragraphs.map(p=>`<p style="margin:10px 0;color:#5f5054;font-size:16px;line-height:1.55">${escapeHtml(p)}</p>`).join('')}${details}${action}<p style="margin:26px 0 0;color:#7a6a6e;font-size:14px;line-height:1.5">Si necesitas ayuda, responde directamente a este correo.</p></main></div></body></html>`
  const text = [message.title, ...message.paragraphs, ...(message.details||[]).map(([label,value])=>`${label}: ${value}`), message.actionLabel&&message.actionUrl?`${message.actionLabel}: ${message.actionUrl}`:'', 'Si necesitas ayuda, responde directamente a este correo.'].filter(Boolean).join('\n\n')
  const response = await fetch('https://api.resend.com/emails', {
    method:'POST',
    headers:{ Authorization:`Bearer ${apiKey}`, 'Content-Type':'application/json', 'Idempotency-Key':message.idempotencyKey },
    body:JSON.stringify({ from, to:[message.to], reply_to:replyTo, subject:message.subject, html, text }),
  })
  if (!response.ok) throw new Error(`No se pudo enviar el correo transaccional (${response.status}).`)
  return response.json()
}
