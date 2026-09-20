import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors={ 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS' }
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}})

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors})
  if(req.method!=='POST') return json({error:'Método no permitido.'},405)
  let reservedId:string|undefined
  try{
    const auth=req.headers.get('Authorization'); if(!auth) return json({error:'Inicia sesión.'},401)
    const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}})
    const {data:{user},error:userError}=await userClient.auth.getUser(); if(userError||!user) return json({error:'Sesión inválida.'},401)
    const {offerId,quantity=1,acceptAge,fulfillment='pickup'}=await req.json() as {offerId?:string;quantity?:number;acceptAge?:boolean;fulfillment?:'storage'|'pickup'}
    if(!offerId||!Number.isInteger(quantity)||quantity<1||quantity>12) return json({error:'Selección inválida.'},400)
    if(!['storage','pickup'].includes(fulfillment)) return json({error:'Selecciona guardar o recoger.'},400)
    if(acceptAge!==true) return json({error:'Debes confirmar que tienes 18 años o más.'},400)

    const clientId=Deno.env.get('PAYPAL_CLIENT_ID'),secret=Deno.env.get('PAYPAL_CLIENT_SECRET')
    if(!clientId||!secret) return json({error:'PayPal todavía no está conectado a Divinos.'},503)
    const mode=Deno.env.get('PAYPAL_MODE')==='live'?'live':'sandbox'
    const api=mode==='live'?'https://api-m.paypal.com':'https://api-m.sandbox.paypal.com'
    const tokenResponse=await fetch(`${api}/v1/oauth2/token`,{method:'POST',headers:{Authorization:`Basic ${btoa(`${clientId}:${secret}`)}`,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'})
    if(!tokenResponse.ok) return json({error:'PayPal rechazó las credenciales configuradas.'},502)
    const {access_token}=await tokenResponse.json()

    const admin=createClient(url,service)
    const {data:order,error:reserveError}=await admin.rpc('reserve_wine_order',{p_user_id:user.id,p_offer_id:offerId,p_quantity:quantity,p_fulfillment:fulfillment}).single()
    if(reserveError) return json({error:reserveError.message},409)
    reservedId=order.id
    const {data:offer,error:offerError}=await admin.from('wine_sale_offers').select('description,wines(name,producer,vintage)').eq('id',offerId).single()
    if(offerError) throw offerError
    if(String(offer.description||'').startsWith('[PAYPAL TEST]')){
      const {data:profile}=await admin.from('profiles').select('role').eq('id',user.id).maybeSingle()
      if(profile?.role!=='superadmin') throw new Error('Este producto está reservado para la prueba administrativa de PayPal.')
    }
    const wine=Array.isArray(offer.wines)?offer.wines[0]:offer.wines
    const site=Deno.env.get('PUBLIC_SITE_URL')||'https://divinos-iguw.onrender.com'
    const paypalResponse=await fetch(`${api}/v2/checkout/orders`,{
      method:'POST',headers:{Authorization:`Bearer ${access_token}`,'Content-Type':'application/json','PayPal-Request-Id':`wine-${order.id}`},
      body:JSON.stringify({intent:'CAPTURE',purchase_units:[{reference_id:order.id,custom_id:order.id,invoice_id:`DIV-${order.id}`,
        description:`${wine?.name||'Vino'} ${wine?.vintage||''} · ${fulfillment==='storage'?'Guardar en cava':'Recogido'}`.trim(),amount:{currency_code:'USD',value:Number(order.total).toFixed(2)}}],
        application_context:{brand_name:'Divinos',locale:'es-PR',user_action:'PAY_NOW',shipping_preference:'NO_SHIPPING',return_url:`${site}/?wine_order=${order.id}#/shop?paypal=return`,cancel_url:`${site}/?wine_order=${order.id}#/shop?paypal=cancelled`}})
    })
    const paypal=await paypalResponse.json()
    if(!paypalResponse.ok) throw new Error(paypal?.details?.[0]?.description||'PayPal no pudo crear la orden.')
    const approval=paypal.links?.find((link:any)=>link.rel==='approve')?.href
    if(!approval) throw new Error('PayPal no devolvió el enlace de aprobación.')
    const {error:updateError}=await admin.from('wine_orders').update({paypal_order_id:paypal.id}).eq('id',order.id)
    if(updateError) throw updateError
    return json({approval_url:approval,order_id:order.id,total:order.total,pricing_tier:order.pricing_tier,fulfillment:order.fulfillment_type})
  }catch(error){
    if(reservedId){try{const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);await admin.rpc('release_wine_order',{p_order_id:reservedId,p_status:'failed'})}catch{}}
    return json({error:error instanceof Error?error.message:'Error inesperado.'},500)
  }
})
