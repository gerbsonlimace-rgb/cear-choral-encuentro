import { z } from "zod";

const dioceseValues = [
  "Arquidiocese de Fortaleza",
  "Diocese de Baturité",
  "Diocese do Crato",
  "Diocese de Crateús",
  "Diocese de Iguatu",
  "Diocese de Itapipoca",
  "Diocese de Limoeiro do Norte",
  "Diocese de Quixadá",
  "Diocese de Sobral",
  "Diocese de Tianguá",
] as const;

export const dioceseSchema = z.enum(dioceseValues);
export type Diocese = z.infer<typeof dioceseSchema>;

export const dioceseOptions: ReadonlyArray<{ value: Diocese; label: string }> = dioceseValues.map(
  (diocese) => ({ value: diocese, label: diocese }),
);
