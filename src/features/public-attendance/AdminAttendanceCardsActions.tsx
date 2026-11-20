import { useEffect, useState } from "react";
import { Download, QrCode, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prepareAdminAttendanceCards } from "@/lib/public-attendance.functions";
import { downloadAllParticipantCardImages } from "./participantCardImages.client";

export function AdminAttendanceCardsActions() {
  const [file,setFile]=useState<{url:string;filename:string;count:number}|null>(null);
  const [cards,setCards]=useState<Array<{name:string;choirName:string;token:string}>>([]);
  const [busy,setBusy]=useState(false),[zipBusy,setZipBusy]=useState(false),[error,setError]=useState("");
  const [progress,setProgress]=useState({done:0,total:0});
  useEffect(()=>()=>{if(file)URL.revokeObjectURL(file.url);},[file]);
  const prepare=async()=>{setBusy(true);setError("");try{
    const result=await prepareAdminAttendanceCards();
    setCards(result.cards);
    setFile({url:URL.createObjectURL(new Blob([result.csv],{type:"text/csv;charset=utf-8"})),filename:result.filename,count:result.count});
  }catch{setError("Não foi possível preparar os cartões. Tente novamente.");}finally{setBusy(false);}};
  const downloadImages=async()=>{setZipBusy(true);setError("");setProgress({done:0,total:cards.length});try{
    await downloadAllParticipantCardImages(cards,(done,total)=>setProgress({done,total}));
  }catch{setError("Não foi possível gerar todas as imagens. Tente novamente.");}finally{setZipBusy(false);}};
  return <section aria-label="Cartões dos participantes" className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white p-3">
    <Button variant="outline" asChild><a href="/chamada" target="_blank" rel="noopener noreferrer"><ScanLine className="size-4"/>Abrir chamada pública</a></Button>
    <Button variant="outline" disabled={busy} onClick={()=>void prepare()}><QrCode className="size-4"/>{busy?"Preparando cartões…":"Preparar links dos cartões"}</Button>
    {file&&<Button asChild><a href={file.url} download={file.filename}><Download className="size-4"/>Baixar {file.count} links (CSV)</a></Button>}
    {cards.length>0&&<Button disabled={zipBusy} onClick={()=>void downloadImages()}><Download className="size-4"/>{zipBusy?`Gerando ${progress.done}/${progress.total} imagens…`:`Baixar ${cards.length} cartões (PNG)`}</Button>}
    {error&&<p role="alert" className="w-full text-sm text-red-800">{error}</p>}
  </section>;
}
