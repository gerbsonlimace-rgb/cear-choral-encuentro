// Uses the authorized admin snapshot and existing persisted tokens. Never registers attendance.
// node --env-file=.env --env-file=.env.local scripts/export-participant-cards.mjs
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import QRCode from "qrcode";

const out = path.resolve(process.argv[2] || "output/participant-cards");
const origin = process.env.PUBLIC_SITE_URL || "https://encontrocorosce.lovable.app";
const client = createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,
  {auth:{persistSession:false,autoRefreshToken:false}});
const source=ts.transpileModule(readFileSync("src/features/public-attendance/participantCardDetails.domain.ts","utf8"),
  {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {resolveParticipantCardLodging}=await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const results=await Promise.all([
  client.rpc("admin_registration_snapshot",{p_search:""}),
  client.from("lodging_plan").select("assignments,named_rooms,no_lodging_registration_ids,extra_people").maybeSingle(),
]);
for(const r of results)if(r.error)throw new Error(r.error.message);
const all=results[0].data.registrations;
if(!Array.isArray(all))throw new Error("Invalid admin snapshot.");
const roster=all.filter(row=>row.payment_status==="paid"&&!row.cancelled_at)
  .sort((a,b)=>a.name.localeCompare(b.name,"pt-BR"));
const tokens=new Map();
for(let start=0;;start+=1000){
  const r=await client.from("registration_attendance_cards").select("registration_id,token").order("registration_id").range(start,start+999);
  if(r.error)throw new Error(r.error.message);
  for(const row of r.data)tokens.set(row.registration_id,row.token);
  if(r.data.length<1000)break;
}
mkdirSync(path.join(out,"source","photos"),{recursive:true});
mkdirSync(path.join(out,"source","qr"),{recursive:true});
const cards=[];
let next=0,photoFailures=0;
await Promise.all(Array.from({length:6},async()=>{
  while(next<roster.length){
    const row=roster[next++], token=tokens.get(row.id);
    if(!token||!/^[a-f0-9]{64}$/.test(token))throw new Error(`Persisted card unavailable: ${row.id}`);
    const url=new URL("/cartao",origin);url.searchParams.set("token",token);
    const name=row.badge_name?.trim()||row.name;
    const slug=name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"participante";
    const filename=`${slug}-${row.id.slice(0,8)}.png`;
    const photoFile=path.join(out,"source","photos",row.id);
    let photoPath=null;
    if(row.photo_path){
      if(!existsSync(photoFile)){
        const p=await client.storage.from("registration-photos").download(row.photo_path);
        if(p.error)photoFailures++;else writeFileSync(photoFile,Buffer.from(await p.data.arrayBuffer()));
      }
      if(existsSync(photoFile))photoPath=photoFile;
    }
    const qr=QRCode.create(url.toString(),{errorCorrectionLevel:"M"});
    const scale=Math.floor(900/(qr.modules.size+8));
    const qrFile=path.join(out,"source","qr",filename);
    await QRCode.toFile(qrFile,url.toString(),{errorCorrectionLevel:"M",margin:4,scale,color:{dark:"#000000",light:"#ffffff"}});
    cards.push({id:row.id,name,fullName:row.name,choirName:row.choir_name,filename,cardUrl:url.toString(),
      photoPath,qrPath:qrFile,lodging:resolveParticipantCardLodging(row.id,results[1].data,all)});
  }
}));
cards.sort((a,b)=>a.fullName.localeCompare(b.fullName,"pt-BR"));
writeFileSync(path.join(out,"source","manifest.json"),JSON.stringify({generatedAt:new Date().toISOString(),origin,count:cards.length,cards},null,2));
const cell=value=>`"${(/^[\s]*[=+@\-\t\r]/.test(value)?"'":"")+value.replaceAll('"','""')}"`;
writeFileSync(path.join(out,"links-cartoes.csv"),"\uFEFF"+[["Nome de crachá","Nome completo","Coro","Quarto","Arquivo","Link"],...cards.map(c=>[c.name,c.fullName,c.choirName,c.lodging?.room||"",c.filename,c.cardUrl])].map(row=>row.map(cell).join(";")).join("\r\n"));
console.log(JSON.stringify({output:out,cards:cards.length,photos:cards.filter(c=>c.photoPath).length,photoFailures,withLodging:cards.filter(c=>c.lodging).length,uniqueLinks:new Set(cards.map(c=>c.cardUrl)).size}));
