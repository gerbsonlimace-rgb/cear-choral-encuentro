type Detector = { detect(video: HTMLVideoElement): Promise<Array<{rawValue: string}>> };
type DetectorClass = new (options: { formats: string[] }) => Detector;
export type ContinuousQrFallback = (stream: MediaStream, video: HTMLVideoElement, onRead: (value: string)=>void, signal: AbortSignal) => Promise<()=>void>;

const zxingFallback: ContinuousQrFallback = async (stream, video, onRead, signal) => {
  const { BrowserQRCodeReader } = await import("@zxing/browser");
  if (signal.aborted) throw new DOMException("Leitura encerrada.","AbortError");
  const controls = await new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 0, delayBetweenScanSuccess: 0 })
    .decodeFromStream(stream,video,result=> { if (result && !signal.aborted) onRead(result.getText()); });
  if (signal.aborted) controls.stop();
  return () => controls.stop();
};

export async function startContinuousQrScanner(
  video: HTMLVideoElement, onRead: (value: string)=>void, signal: AbortSignal,
  fallback: ContinuousQrFallback = zxingFallback,
  onError: (error: Error)=>void = () => {},
): Promise<()=>void> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("A câmera não está disponível. Abra esta página em HTTPS no navegador do celular.");
  if (signal.aborted) throw new DOMException("Leitura encerrada.","AbortError");
  const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}},audio:false});
  let stopped=false, frame=0, stopFallback: (()=>void)|undefined;
  const cleanup=()=>{
    if(stopped) return; stopped=true; signal.removeEventListener("abort",cleanup);
    if(frame) cancelAnimationFrame(frame);
    stopFallback?.(); stream.getTracks().forEach(track=>track.stop()); video.srcObject=null;
  };
  signal.addEventListener("abort",cleanup,{once:true});
  try {
    if (signal.aborted) throw new DOMException("Leitura encerrada.","AbortError");
    const Native=(globalThis as {BarcodeDetector?:DetectorClass}).BarcodeDetector;
    let detector: Detector | undefined;
    if(Native) { try { detector=new Native({formats:["qr_code"]}); } catch { /* Fallback for incomplete browser implementations. */ } }
    if (!detector) {
      stopFallback=await fallback(stream,video,onRead,signal);
      if(signal.aborted) { stopFallback(); throw new DOMException("Leitura encerrada.","AbortError"); }
    } else {
      video.srcObject=stream; await video.play();
      if(signal.aborted) throw new DOMException("Leitura encerrada.","AbortError");
      const readFrame=async()=>{
        if(stopped) return;
        try {
          const values=await detector!.detect(video);
          if(stopped) return;
          for(const value of values) if(value.rawValue) onRead(value.rawValue);
          frame=requestAnimationFrame(()=>void readFrame());
        } catch {
          if(!stopped) { cleanup(); onError(new Error("A câmera parou. Toque em Retomar câmera para continuar.")); }
        }
      };
      frame=requestAnimationFrame(()=>void readFrame());
    }
    return cleanup;
  } catch(error) { cleanup(); throw error; }
}
