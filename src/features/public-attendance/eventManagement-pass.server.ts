import { deleteCookie, getCookie, getRequest, setCookie } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getEventManagementAccess } from "./eventManagement-access.server";
const cookieName="event_management_lock";
const duration=8*60*60;
const attempts=new Map<string,{count:number;until:number}>();
const key=()=>crypto.subtle.importKey("raw",new TextEncoder().encode(process.env.SUPABASE_SERVICE_ROLE_KEY),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);
const encode=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");
const decode=(text:string)=>Uint8Array.from(atob(text.replaceAll("-","+").replaceAll("_","/")),c=>c.charCodeAt(0));

export async function unlockEventManagement(cpf:string) {
  const request=getRequest();
  const ip=request.headers.get("cf-connecting-ip")||request.headers.get("x-forwarded-for")?.split(",")[0]||"local";
  const now=Date.now(),attempt=attempts.get(ip);
  if(attempt&&attempt.until>now&&attempt.count>=8)throw new Error("Muitas tentativas. Aguarde 10 minutos e tente novamente.");
  if(attempts.size>5000)for(const [id,item]of attempts)if(item.until<now)attempts.delete(id);
  attempts.set(ip,{count:attempt&&attempt.until>now?attempt.count+1:1,until:attempt&&attempt.until>now?attempt.until:now+600000});
  const result=await supabaseAdmin.from("registrations").select("id").eq("cpf",cpf).is("cancelled_at",null).maybeSingle();
  if(result.error||!result.data)throw new Error("CPF não liberado para o Gerenciamento do evento.");
  const account=await supabaseAdmin.from("participant_accounts").select("user_id,access_status").eq("registration_id",result.data.id).maybeSingle();
  if(account.error||!account.data?.user_id||account.data.access_status!=="active")throw new Error("CPF não liberado para o Gerenciamento do evento.");
  const access=await getEventManagementAccess(account.data.user_id);
  if(!access.canReport&&!access.canScan&&!access.canArchive)throw new Error("CPF não liberado para o Gerenciamento do evento.");
  const payload=encode(new TextEncoder().encode(JSON.stringify({userId:account.data.user_id,registrationId:result.data.id,exp:Math.floor(now/1000)+duration})));
  const signature=encode(new Uint8Array(await crypto.subtle.sign("HMAC",await key(),new TextEncoder().encode(payload))));
  setCookie(cookieName,`${payload}.${signature}`,{httpOnly:true,sameSite:"strict",secure:new URL(request.url).protocol==="https:",path:"/",maxAge:duration});
  attempts.delete(ip);return access;
}
export async function readEventManagementPassIdentity(): Promise<{ userId: string; registrationId: string } | null> {
  try{
    const value=getCookie(cookieName);if(!value)return null;
    const [payload,signature,...rest]=value.split(".");if(rest.length||!payload||!signature)throw new Error();
    if(!await crypto.subtle.verify("HMAC",await key(),decode(signature),new TextEncoder().encode(payload)))throw new Error();
    const parsed=JSON.parse(new TextDecoder().decode(decode(payload)));
    if(typeof parsed.userId!=="string"||typeof parsed.registrationId!=="string"||typeof parsed.exp!=="number"||parsed.exp<Date.now()/1000)throw new Error();
    return {userId:parsed.userId,registrationId:parsed.registrationId};
  }catch{return null;}
}
export async function readEventManagementPass() {
  const identity=await readEventManagementPassIdentity();
  if(!identity)return {canScan:false,canReport:false,canArchive:false};
  try{return await getEventManagementAccess(identity.userId);}
  catch{return {canScan:false,canReport:false,canArchive:false};}
}
export function lockEventManagement(){deleteCookie(cookieName,{path:"/"});}
