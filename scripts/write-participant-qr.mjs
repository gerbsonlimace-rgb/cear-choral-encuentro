// Deterministic alternate masks improve decoding of the same opaque URL.
import QRCode from "qrcode";
const [url,output,mask] = process.argv.slice(2);
const options={errorCorrectionLevel:"M",margin:4,...(mask===undefined?{}:{maskPattern:Number(mask)})};
const qr=QRCode.create(url,options);
await QRCode.toFile(output,url,{...options,scale:Math.floor(900/(qr.modules.size+8)),color:{dark:"#000000",light:"#ffffff"}});
