import { afterEach, describe, expect, it, vi } from "vitest";
import { startContinuousQrScanner } from "./continuousQrScanner";

afterEach(() => vi.unstubAllGlobals());
describe("continuous QR camera", () => {
  it("keeps reading codes without stopping or reacquiring the stream", async () => {
    let frame: (()=>void) | undefined;
    vi.stubGlobal("requestAnimationFrame",vi.fn((cb)=>{frame=cb; return 1;}));
    vi.stubGlobal("cancelAnimationFrame",vi.fn());
    const stop=vi.fn(), getUserMedia=vi.fn().mockResolvedValue({getTracks:()=>[{stop}]});
    Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia}});
    const detect=vi.fn().mockResolvedValueOnce([{rawValue:"ana"}]).mockResolvedValueOnce([{rawValue:"bia"}]).mockResolvedValue([]);
    vi.stubGlobal("BarcodeDetector",class {detect=detect;});
    const video={play:vi.fn().mockResolvedValue(undefined),srcObject:null} as unknown as HTMLVideoElement;
    const read=vi.fn(); const abort=new AbortController();
    const cleanup=await startContinuousQrScanner(video,read,abort.signal);
    await frame?.(); await Promise.resolve(); await frame?.(); await Promise.resolve();
    expect(read).toHaveBeenCalledWith("ana"); expect(read).toHaveBeenCalledWith("bia");
    expect(getUserMedia).toHaveBeenCalledTimes(1); expect(stop).not.toHaveBeenCalled();
    cleanup(); expect(stop).toHaveBeenCalledTimes(1); expect(video.srcObject).toBe(null);
  });
  it("stops tracks if the page closes while the permission request is pending", async () => {
    let resolve!: (stream: unknown)=>void; const stop=vi.fn();
    Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:()=>new Promise(ok=>{resolve=ok;})}});
    const abort=new AbortController();
    const result=startContinuousQrScanner({srcObject:null} as HTMLVideoElement,vi.fn(),abort.signal);
    abort.abort(); resolve({getTracks:()=>[{stop}]});
    await expect(result).rejects.toMatchObject({name:"AbortError"}); expect(stop).toHaveBeenCalledTimes(1);
  });
  it("uses a continuous fallback when the native detector is unavailable", async () => {
    vi.stubGlobal("BarcodeDetector",undefined);
    const stop=vi.fn(); const stream={getTracks:()=>[{stop}]};
    Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue(stream)}});
    const fallbackStop=vi.fn(), fallback=vi.fn(async (_s,_v,onRead)=>{onRead("ana");onRead("bia");return fallbackStop;});
    const read=vi.fn(), abort=new AbortController();
    const cleanup=await startContinuousQrScanner({srcObject:null} as HTMLVideoElement,read,abort.signal,fallback);
    expect(read.mock.calls).toEqual([["ana"],["bia"]]); cleanup(); expect(fallbackStop).toHaveBeenCalledTimes(1);
  });
});
