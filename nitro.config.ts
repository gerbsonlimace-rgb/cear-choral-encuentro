import { defineConfig } from "nitro/config";

export default defineConfig({
  // Prefer libraries' ESM exports when bundling the server. In particular,
  // tslib 1.x's "import" wrapper used by pdf-lib expects a CJS default export
  // that Rolldown does not provide; its "module" export uses native ESM.
  exportConditions: ["module"],
});
