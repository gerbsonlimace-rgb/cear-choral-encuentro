import { createMiddleware } from "@tanstack/react-start";

export const requireEventAccess = createMiddleware({type:"function"}).server(async({next})=>{
  const {readEventManagementPass}=await import("./eventManagement-pass.server");
  const access=await readEventManagementPass();
  if(!access.canScan&&!access.canReport)throw new Error("Aplicativo bloqueado. Informe seu CPF de acesso.");
  return next();
});

export const requireEventReports = createMiddleware({ type: "function" })
  .server(async ({ next }) => {
    const { readEventManagementPass } = await import("./eventManagement-pass.server");
    const access = await readEventManagementPass();
    if (!access.canReport) throw new Error("Acesso não autorizado aos relatórios.");
    return next();
  });

export const requireEventScanner = createMiddleware({ type: "function" }).server(async({next})=>{
  const { readEventManagementPass }=await import("./eventManagement-pass.server");
  if(!(await readEventManagementPass()).canScan)throw new Error("Acesso não autorizado ao leitor QR.");
  return next();
});
