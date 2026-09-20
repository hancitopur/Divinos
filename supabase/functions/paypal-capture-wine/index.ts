import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors={ 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS' }
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}})

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors})
  if(req.method!=='POST') return json({error:'Método no permitido.'},405)
  try{
    const auth=req.headers.get('Authorization');if(!auth)return json({error:'Inicia sesión.'},401)
    const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}})
    const {data:{user},error:userError}=await userClient.auth.getUser();if(userError||!user)return json({error:'Sesión inválida.'},401)
    const {paypalOrderId}=await req.json() as {paypalOrderId?:string};if(!paypalOrderId)return json({error:'Orden requerida.'},400)
    const admin=createClient(url,service)
    const {data:order,error:orderError}=await admin.from('wine_orders').select('*').eq('paypal_order_id',paypalOrderId).eq('user_id',user.id).single()
    if(orderError||!order)return json({error:'Orden no encontrada.'},404)
    if(order.status==='completed')return json({completed:true,order_id:order.id})
    const clientId=Deno.env.get('PAYPAL_CLIENT_ID'),secret=Deno.env.get('PAYPAL_CLIENT_SECRET');if(!clientId||!secret)return json({error:'PayPal no configurado.'},503)
    const mode=Deno.env.get('PAYPAL_MODE')==='live'?'live':'sandbox',api=mode==='live'?'https://api-m.paypal.com':'https://api-m.sandbox.paypal.com'
    const tokenResponse=await fetch(`${api}/v1/oauth2/token`,{method:'POST',headers:{Authorization:`Basic ${btoa(`${clientId}:${secret}`)}`,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'})
    if(!tokenResponse.ok)return json({error:'PayPal rechazó las credenciales.'},502)
    const {access_token}=await tokenResponse.json()
    const captureResponse=await fetch(`${api}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,{method:'POST',headers:{Authorization:`Bearer ${access_token}`,'Content-Type':'application/json','PayPal-Request-Id':`capture-${order.id}`},body:'{}'})
    const capture=await captureResponse.json()
    if(!captureResponse.ok&&capture?.name!=='ORDER_ALREADY_CAPTURED')return json({error:capture?.details?.[0]?.description||'No se pudo confirmar el pago.'},502)
    const verified=capture?.name==='ORDER_ALREADY_CAPTURED'?await (await fetch(`${api}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`,{headers:{Authorization:`Bearer ${access_token}`}})).json():capture
    const unit=verified.purchase_units?.[0],payment=unit?.payments?.captures?.find((item:any)=>item.status==='COMPLETED')
    if(verified.status!=='COMPLETED'||!payment||unit.custom_id!==order.id||Math.round(Number(payment.amount?.value)*100)!==Math.round(Number(order.total)*100)){
      await admin.from('wine_orders').update({status:'manual_review'}).eq('id',order.id)
      return json({error:'El pago requiere revisión antes de entregar la botella.'},409)
    }
    const {data:placed,error:completeError}=await admin.rpc('complete_wine_order',{p_order_id:order.id,p_paypal_order_id:paypalOrderId,p_capture_id:payment.id}).single()
    if(completeError)return json({error:completeError.message},409)
    return json({completed:true,order_id:order.id,locations:placed.rack_locations,bottles:placed.bottles_created})
  }catch(error){return json({error:error instanceof Error?error.message:'Error inesperado.'},500)}
})
