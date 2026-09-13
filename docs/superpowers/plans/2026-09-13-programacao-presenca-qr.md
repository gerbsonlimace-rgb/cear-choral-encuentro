# Programacao e Presenca por QR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar uma fonte unica de programacao com CRUD administrativo, QR fixo revogavel, presenca opcionalmente validada por geocerca, percentual do participante e PDF A4 com todos os codigos ativos.

**Architecture:** `event_activities` e `event_activity_attendances` ficam privadas no Supabase e sao acessadas apenas por server functions autenticadas, exceto por uma leitura publica com campos estritamente selecionados. Tokens HMAC permanentes carregam `activityId` e `qrVersion`; o banco revalida versao, janela e geocerca dentro da operacao idempotente de presenca. A pagina principal, o guia do participante, o administrativo e o PDF consomem o mesmo dominio.

**Tech Stack:** React 19, TanStack Start/Router, TypeScript, Zod, Supabase/Postgres, `qrcode` 1.5.4, `pdf-lib` 1.17.1, Vitest 5, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-13-programacao-presenca-qr-design.md`

## Global Constraints

- Preservar todas as alteracoes nao relacionadas no checkout compartilhado; a execucao deve usar uma worktree isolada e transferir somente os arquivos listados neste plano.
- Manter o menu final aprovado: Resumo, Inscricoes, Coros, Programacao, Patrocinadores, Documentos e Configuracoes.
- O denominador e formado somente por atividades ativas marcadas com QR.
- `verifyLocation=false` significa nao chamar `navigator.geolocation` e persistir campos geograficos nulos.
- `verifyLocation=true` exige coordenadas da atividade, raio entre 10 e 5.000 m, posicao com no maximo dois minutos e precisao de ate 100 m.
- A janela de presenca abre 30 minutos antes do inicio e fecha 30 minutos depois do fim, usando `America/Fortaleza`.
- Nunca usar `user_metadata` para autorizacao; usar `requireAdmin` e `requireParticipantAccess`.
- `ATTENDANCE_QR_SECRET` fica no servidor, tem no minimo 32 bytes e so e lido em operacoes de QR.
- Nenhum SQL remoto, push ou deploy faz parte da implementacao local sem autorizacao explicita separada.
- Rodar Vitest focado com `--no-file-parallelism --maxWorkers=1` e excluir qualquer resultado de `.worktrees` quando o comando partir do checkout raiz.

---

## File Structure

- `supabase/migrations/20260912200441_create_event_activity_attendance.sql`: tabelas privadas, restricoes, RPC atomica e carga das 24 atividades.
- `src/features/event-activities/eventActivity.domain.ts`: schemas, tipos publicos e calculo do percentual.
- `src/features/event-activities/eventGeofence.ts`: validacao de posicao e distancia Haversine sem dependencias de UI.
- `src/features/event-activities/eventAttendanceToken.server.ts`: emissao e verificacao de tokens HMAC versionados e permanentes.
- `src/features/event-activities/eventActivity.repository.server.ts`: acesso Supabase, mapeamento de linhas, contagens e RPC.
- `src/features/event-activities/eventActivity.server.ts`: regras de negocio, QR, preflight, presenca e composicao do PDF.
- `src/features/event-activities/eventActivityQrPdf.server.ts`: documento A4, uma atividade por pagina.
- `src/lib/event-activity.functions.ts`: fronteiras TanStack server function publicas, administrativas e do participante.
- `src/features/event-activities/AdminEventActivitiesPage.tsx`: CRUD, QR, PDF e entrada para detalhes de presenca.
- `src/features/event-activities/AdminActivityAttendancesDialog.tsx`: participantes, distancia e link do mapa.
- `src/features/event-activities/attendanceQrScanner.ts`: leitura de QR pela camera e extracao segura do token.
- `src/features/event-activities/participantGeolocation.ts`: unica fronteira com `navigator.geolocation`.
- `src/features/event-activities/ParticipantAttendancePage.tsx`: preflight, localizacao condicional, check-in e painel.
- `src/features/event-activities/PublicProgramme.tsx`: agrupamento e apresentacao reutilizavel da agenda publica.
- `src/routes/admin.atividades.tsx`: rota administrativa protegida.
- `src/routes/participante.presenca.tsx`: rota de leitura e confirmacao.
- `src/routes/index.tsx`: loader publico e substituicao da lista hardcoded.
- `src/features/participant/ChoristerEventGuideTab.tsx`: injecao do loader real e acesso ao leitor.
- `src/features/admin/AdminNavigation.tsx`: setima aba Programacao.
- `src/routeTree.gen.ts`: saida gerada pelo plugin do TanStack Router.

---

### Task 1: Persistencia, carga inicial e dominio

**Files:**
- Modify: `package.json`
- Modify: `bun.lock`
- Create: `supabase/migrations/20260912200441_create_event_activity_attendance.sql`
- Create: `src/features/event-activities/eventActivity.migration.test.ts`
- Create: `src/features/event-activities/eventActivity.domain.ts`
- Create: `src/features/event-activities/eventActivity.domain.test.ts`

**Interfaces:**
- Produces: `EventActivity`, `AdminEventActivity`, `PublicEventActivity`, `EventActivityCreate`, `EventActivityUpdate`, `AttendanceLocationInput`, `ParticipantAttendanceDashboard`, `calculateAttendancePercentage()`.
- Consumes: existing `participant_accounts` and `registrations` tables.

- [ ] **Step 1: Install the exact QR dependency versions already selected in the local scaffold**

Run:

```powershell
bun add qrcode@1.5.4
bun add --dev @types/qrcode@1.5.6
```

Expected: `package.json` contains `qrcode: "1.5.4"`, dev dependency `@types/qrcode: "1.5.6"`, and `bun.lock` changes only for those packages and transitive dependencies.

- [ ] **Step 2: Write failing domain and migration tests**

Create assertions that lock the approved combinations and the 24-title seed:

```ts
const SEEDED_TITLES = [
  "Credenciamento", "Vesperas", "Jantar", "Abertura oficial", "1a Conferencia", "Completas",
  "Santa Missa", "Cafe da manha", "2a Conferencia", "Coffee break", "3a Conferencia",
  "Ensaio 1", "Almoco", "4a Conferencia", "Ensaio 2", "Coffee break",
  "Visita ao Santuario", "Concerto na Catedral", "Jantar", "Laudes", "Cafe da manha",
  "Ensaio 3", "Missa Solene na Catedral", "Almoco e despedida",
];

it("requires coordinates only when location verification is active", () => {
  expect(eventActivityCreateSchema.safeParse(baseActivity).success).toBe(true);
  expect(eventActivityCreateSchema.safeParse({
    ...baseActivity,
    requiresQr: true,
    verifyLocation: true,
    latitude: null,
    longitude: null,
    radiusMeters: null,
  }).success).toBe(false);
});

it("calculates participation from active QR activities only", () => {
  expect(calculateAttendancePercentage([
    { isActive: true, requiresQr: true, attended: true },
    { isActive: true, requiresQr: true, attended: false },
    { isActive: true, requiresQr: false, attended: true },
    { isActive: false, requiresQr: true, attended: true },
  ])).toEqual({ attended: 1, required: 2, percentage: 50 });
});
```

The migration test must normalize accents before comparing and assert 24 inserted rows, six category values, RLS on both tables, server-only grants, the unique attendance key, QR version, nullable location fields when verification is off, and the exact titles in order.

- [ ] **Step 3: Run the focused tests and observe failure**

Run:

```powershell
bunx vitest run src/features/event-activities/eventActivity.domain.test.ts src/features/event-activities/eventActivity.migration.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the domain and migration do not yet exist or lack the approved fields.

- [ ] **Step 4: Implement the domain schemas and types**

Use one schema as the source for create/update validation:

```ts
export const eventActivityCategorySchema = z.enum([
  "welcome", "celebration", "meal", "conference", "music", "visit",
]);

export const eventActivityCreateSchema = z.object({
  title: z.string().trim().min(2).max(160),
  activityDate: z.string().date(),
  startsAt: clockTimeSchema,
  endsAt: clockTimeSchema,
  location: nullableText,
  description: nullableText,
  category: eventActivityCategorySchema,
  sortOrder: z.number().int().min(0).max(999),
  isActive: z.boolean(),
  requiresQr: z.boolean(),
  verifyLocation: z.boolean(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  radiusMeters: z.number().int().min(10).max(5000).nullable(),
}).superRefine((value, context) => {
  if (value.requiresQr && (!value.startsAt || !value.endsAt)) {
    context.addIssue({ code: "custom", path: ["requiresQr"], message: "Informe inicio e fim para usar QR Code." });
  }
  if (value.verifyLocation && !value.requiresQr) {
    context.addIssue({ code: "custom", path: ["verifyLocation"], message: "Ative o QR Code antes de verificar localizacao." });
  }
  if (value.verifyLocation && (value.latitude == null || value.longitude == null || value.radiusMeters == null)) {
    context.addIssue({ code: "custom", path: ["verifyLocation"], message: "Informe coordenadas e raio." });
  }
  if (!value.verifyLocation && (value.latitude != null || value.longitude != null || value.radiusMeters != null)) {
    context.addIssue({ code: "custom", path: ["verifyLocation"], message: "Desative os dados de geocerca." });
  }
  if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt) {
    context.addIssue({ code: "custom", path: ["endsAt"], message: "O fim deve ser posterior ao inicio." });
  }
});
```

Define `AdminEventActivity` with `attendanceCount: number`, `qrVersion: number`, timestamps, and all create fields. Define `AttendanceLocationInput` as `{ latitude; longitude; accuracyMeters; collectedAt }` and keep public/participant types as explicit `Pick` projections.

- [ ] **Step 5: Implement tables, checks and the exact seed**

Create the migration with this shape before adding the RPC in Task 3:

```sql
create table public.event_activities (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 2 and 160),
  activity_date date not null,
  starts_at time,
  ends_at time,
  location text,
  description text,
  category text not null check (category in ('welcome','celebration','meal','conference','music','visit')),
  sort_order integer not null check (sort_order between 0 and 999),
  is_active boolean not null default true,
  requires_qr boolean not null default false,
  verify_location boolean not null default false,
  latitude double precision,
  longitude double precision,
  radius_meters integer,
  qr_version integer not null default 1 check (qr_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is not null),
  check (starts_at is null or ends_at is null or ends_at > starts_at),
  check (requires_qr = false or (starts_at is not null and ends_at is not null)),
  check (verify_location = false or requires_qr = true),
  check ((verify_location and latitude is not null and longitude is not null and radius_meters between 10 and 5000)
      or (not verify_location and latitude is null and longitude is null and radius_meters is null)),
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180)
);

create table public.event_activity_attendances (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.event_activities(id) on delete restrict,
  participant_account_id uuid not null references public.participant_accounts(id) on delete restrict,
  registration_id uuid not null references public.registrations(id) on delete restrict,
  qr_version integer not null,
  checked_in_at timestamptz not null default clock_timestamp(),
  latitude double precision,
  longitude double precision,
  accuracy_meters double precision,
  position_collected_at timestamptz,
  distance_meters double precision,
  unique (activity_id, participant_account_id)
);
```

Enable RLS, revoke `public`, `anon`, and `authenticated`, and grant the minimum table privileges to `service_role`. Insert all 24 rows from the approved public schedule with `is_active=true`, `requires_qr=false`, `verify_location=false`, and the matching category. Preserve `null` end times instead of inventing values.

- [ ] **Step 6: Run the focused tests**

Run the Step 3 command. Expected: PASS.

- [ ] **Step 7: Commit the schema and domain**

```powershell
git add package.json bun.lock supabase/migrations/20260912200441_create_event_activity_attendance.sql src/features/event-activities/eventActivity.domain.ts src/features/event-activities/eventActivity.domain.test.ts src/features/event-activities/eventActivity.migration.test.ts
git commit -m "feat: add event activity attendance schema"
```

### Task 2: Token permanente e geocerca

**Files:**
- Create: `src/features/event-activities/eventAttendanceToken.server.ts`
- Create: `src/features/event-activities/eventAttendanceToken.server.test.ts`
- Create: `src/features/event-activities/eventGeofence.ts`
- Create: `src/features/event-activities/eventGeofence.test.ts`

**Interfaces:**
- Produces: `AttendanceTokenCodec.issue(activityId, qrVersion)`, `AttendanceTokenCodec.verify(token)`, `calculateDistanceMeters()`, `validateAttendanceLocation()`.
- Consumes: `AttendanceLocationInput` from Task 1.

- [ ] **Step 1: Write failing token and geofence tests**

```ts
it("keeps printed tokens valid until their version is revoked", () => {
  const codec = createAttendanceTokenCodec("x".repeat(32));
  const issued = codec.issue(ACTIVITY_ID, 3);
  expect(codec.verify(issued.token)).toMatchObject({ activityId: ACTIVITY_ID, qrVersion: 3 });
});

it("rejects a changed signature", () => {
  const codec = createAttendanceTokenCodec("x".repeat(32));
  const token = codec.issue(ACTIVITY_ID, 1).token;
  expect(() => codec.verify(`${token}x`)).toThrow("QR Code invalido");
});

it("accepts a fresh precise position inside the configured radius", () => {
  expect(validateAttendanceLocation({
    activity: { latitude: -4.9708, longitude: -39.0167, radiusMeters: 150 },
    position: { latitude: -4.9709, longitude: -39.0168, accuracyMeters: 20, collectedAt: "2026-11-21T12:00:00Z" },
    now: new Date("2026-11-21T12:01:00Z"),
  }).distanceMeters).toBeLessThan(150);
});
```

Also cover 31-byte secrets, malformed payloads, wrong version format, coordinates outside bounds, future timestamps over 30 seconds, timestamps older than two minutes, accuracy over 100 m, and distance greater than the radius.

- [ ] **Step 2: Run the tests and observe failure**

```powershell
bunx vitest run src/features/event-activities/eventAttendanceToken.server.test.ts src/features/event-activities/eventGeofence.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement a versioned permanent HMAC token**

```ts
type TokenPayload = { v: 2; activityId: string; qrVersion: number };

export function createAttendanceTokenCodec(secret: string): AttendanceTokenCodec {
  if (Buffer.byteLength(secret, "utf8") < 32) throw new Error("Chave de QR insegura.");
  return {
    issue(activityId, qrVersion) {
      const payload = tokenPayloadSchema.parse({ v: 2, activityId, qrVersion });
      const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
      const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
      return { token: `v2.${encoded}.${signature}` };
    },
    verify(token) {
      const [version, encoded, signatureText, extra] = token.split(".");
      if (version !== "v2" || !encoded || !signatureText || extra) throw new Error("QR Code invalido.");
      const expected = createHmac("sha256", secret).update(encoded).digest();
      const supplied = Buffer.from(signatureText, "base64url");
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
        throw new Error("QR Code invalido.");
      }
      return tokenPayloadSchema.parse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")));
    },
  };
}
```

The implementation must have no `exp` field. Revocation is performed by comparing `qrVersion` to the database value.

- [ ] **Step 4: Implement Haversine and approved validation limits**

```ts
export function calculateDistanceMeters(from: Coordinates, to: Coordinates): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(to.latitude - from.latitude);
  const dLon = radians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function validateAttendanceLocation(input: ValidationInput) {
  if (input.position.accuracyMeters > 100) throw new Error("A localizacao esta com baixa precisao.");
  const ageMs = input.now.getTime() - new Date(input.position.collectedAt).getTime();
  if (ageMs > 120_000 || ageMs < -30_000) throw new Error("Obtenha uma localizacao atual.");
  const distanceMeters = calculateDistanceMeters(input.activity, input.position);
  if (distanceMeters > input.activity.radiusMeters) throw new Error("Voce esta fora da area desta atividade.");
  return { distanceMeters };
}
```

- [ ] **Step 5: Run tests and commit**

Run the Step 2 command. Expected: PASS.

```powershell
git add src/features/event-activities/eventAttendanceToken.server.ts src/features/event-activities/eventAttendanceToken.server.test.ts src/features/event-activities/eventGeofence.ts src/features/event-activities/eventGeofence.test.ts
git commit -m "feat: secure activity qr and geofence"
```

### Task 3: Repositorio, RPC atomica e servicos

**Files:**
- Modify: `supabase/migrations/20260912200441_create_event_activity_attendance.sql`
- Create: `src/features/event-activities/eventActivity.repository.server.ts`
- Create: `src/features/event-activities/eventActivity.repository.server.test.ts`
- Create: `src/features/event-activities/eventActivity.server.ts`
- Create: `src/features/event-activities/eventActivity.server.test.ts`
- Create: `src/lib/event-activity.functions.ts`
- Create: `src/lib/event-activity.functions.test.ts`

**Interfaces:**
- Produces: `EventActivityRepository`, `createEventActivityService()`, admin CRUD functions, `prepareParticipantEventAttendance`, `recordParticipantEventAttendance`, `getParticipantAttendanceDashboard`, `getParticipantEventActivities`, `getPublicEventProgramme`.
- Consumes: Task 1 domain and Task 2 token/geofence utilities, `supabaseAdmin`, `requireAdmin`, `requireParticipantAccess`.

- [ ] **Step 1: Write failing repository and service tests**

Pin lazy secret access, version checks, sanitized public output and server-confirmed participant IDs:

```ts
it("does not read ATTENDANCE_QR_SECRET during ordinary CRUD", async () => {
  const readSecret = vi.fn().mockReturnValue(undefined);
  const service = createEventActivityService(repository(), createEnvironmentAttendanceTokenCodec(readSecret), qrRenderer);
  await service.listAdmin();
  expect(readSecret).not.toHaveBeenCalled();
});

it("preflights location without revealing coordinates", async () => {
  await expect(service.prepareCheckIn("signed-token")).resolves.toEqual({
    activityId: ACTIVITY_ID,
    activityTitle: "2a Conferencia",
    verifyLocation: true,
  });
});

it("sends authenticated account and registration IDs to the repository", async () => {
  await service.checkIn({ token: "signed-token", location: validLocation }, participantAccess);
  expect(recordAttendance).toHaveBeenCalledWith(expect.objectContaining({
    participantAccountId: participantAccess.accountId,
    registrationId: participantAccess.registrationId,
    qrVersion: 2,
  }));
});
```

Repository tests must verify exact snake_case mappings, sorted queries, count aggregation, attendance detail mapping, conditional null locations, QR version increment, and user-facing errors for foreign-key delete failures.

- [ ] **Step 2: Run tests and observe failure**

```powershell
bunx vitest run src/features/event-activities/eventActivity.repository.server.test.ts src/features/event-activities/eventActivity.server.test.ts src/lib/event-activity.functions.test.ts src/features/event-activities/eventActivity.migration.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because repository, service, functions and RPC are missing.

- [ ] **Step 3: Add the atomic attendance RPC to the migration**

Use `security invoker`, empty `search_path`, `clock_timestamp()`, explicit participant/payment checks and a Haversine calculation inside the transaction:

```sql
create function public.record_event_activity_attendance(
  p_activity_id uuid,
  p_qr_version integer,
  p_participant_account_id uuid,
  p_registration_id uuid,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_accuracy_meters double precision default null,
  p_position_collected_at timestamptz default null
) returns table (status text, activity_title text, checked_in_at timestamptz, distance_meters double precision)
language plpgsql security invoker set search_path = '' as $$
declare
  v_activity public.event_activities%rowtype;
  v_distance double precision;
  v_checked_in_at timestamptz;
begin
  select * into v_activity from public.event_activities
  where id = p_activity_id and is_active and requires_qr for share;
  if not found or v_activity.qr_version <> p_qr_version then
    raise exception using errcode = '22023', message = 'EVENT_ATTENDANCE_QR_REVOKED';
  end if;
  if clock_timestamp() < ((v_activity.activity_date + v_activity.starts_at) at time zone 'America/Fortaleza') - interval '30 minutes'
     or clock_timestamp() > ((v_activity.activity_date + v_activity.ends_at) at time zone 'America/Fortaleza') + interval '30 minutes' then
    raise exception using errcode = '22023', message = 'EVENT_ATTENDANCE_OUTSIDE_WINDOW';
  end if;

  perform 1 from public.participant_accounts account
  join public.registrations registration on registration.id = account.registration_id
  where account.id = p_participant_account_id
    and account.registration_id = p_registration_id
    and account.access_status = 'active'
    and account.user_id is not null
    and registration.payment_status = 'paid'
  for share of account, registration;
  if not found then
    raise exception using errcode = '42501', message = 'EVENT_ATTENDANCE_PARTICIPANT_UNAUTHORIZED';
  end if;

  if v_activity.verify_location then
    if p_latitude is null or p_longitude is null or p_accuracy_meters is null or p_position_collected_at is null then
      raise exception using errcode = '22023', message = 'EVENT_ATTENDANCE_LOCATION_REQUIRED';
    end if;
    if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
      raise exception using errcode = '22023', message = 'EVENT_ATTENDANCE_LOCATION_INVALID';
    end if;
    if p_accuracy_meters < 0 or p_accuracy_meters > 100 then
      raise exception using errcode = '22023', message = 'EVENT_ATTENDANCE_LOCATION_INACCURATE';
    end if;
    if p_position_collected_at < clock_timestamp() - interval '2 minutes'
       or p_position_collected_at > clock_timestamp() + interval '30 seconds' then
      raise exception using errcode = '22023', message = 'EVENT_ATTENDANCE_LOCATION_STALE';
    end if;
    v_distance := 6371000 * 2 * asin(sqrt(least(1, greatest(0,
      power(sin(radians(p_latitude - v_activity.latitude) / 2), 2)
      + cos(radians(v_activity.latitude)) * cos(radians(p_latitude))
      * power(sin(radians(p_longitude - v_activity.longitude) / 2), 2)
    ))));
    if v_distance > v_activity.radius_meters then
      raise exception using errcode = '22023', message = 'EVENT_ATTENDANCE_OUTSIDE_GEOFENCE';
    end if;
  else
    p_latitude := null;
    p_longitude := null;
    p_accuracy_meters := null;
    p_position_collected_at := null;
    v_distance := null;
  end if;

  insert into public.event_activity_attendances (
    activity_id, participant_account_id, registration_id, qr_version,
    latitude, longitude, accuracy_meters, position_collected_at, distance_meters
  ) values (
    p_activity_id, p_participant_account_id, p_registration_id, p_qr_version,
    p_latitude, p_longitude, p_accuracy_meters, p_position_collected_at, v_distance
  )
  on conflict (activity_id, participant_account_id) do nothing
  returning event_activity_attendances.checked_in_at into v_checked_in_at;

  if v_checked_in_at is null then
    select attendance.checked_in_at, attendance.distance_meters
      into v_checked_in_at, v_distance
    from public.event_activity_attendances attendance
    where attendance.activity_id = p_activity_id
      and attendance.participant_account_id = p_participant_account_id;
    return query select 'already_recorded'::text, v_activity.title, v_checked_in_at, v_distance;
  end if;
  return query select 'recorded'::text, v_activity.title, v_checked_in_at, v_distance;
end;
$$;
```

Revoke execution from `public`, `anon`, and `authenticated`; grant only to `service_role` using the full eight-argument function signature.

- [ ] **Step 4: Implement the repository contract**

```ts
export type EventActivityRepository = {
  listAdminActivities(): Promise<AdminEventActivity[]>;
  listPublicActivities(): Promise<PublicEventActivity[]>;
  createActivity(input: EventActivityCreate): Promise<AdminEventActivity>;
  updateActivity(input: EventActivityUpdate): Promise<AdminEventActivity>;
  deleteActivity(activityId: string): Promise<void>;
  findActivity(activityId: string): Promise<AdminEventActivity | null>;
  incrementQrVersion(activityId: string): Promise<AdminEventActivity>;
  recordAttendance(input: RepositoryAttendanceInput): Promise<AttendanceCheckInResult>;
  listParticipantAttendance(registrationId: string): Promise<ParticipantActivityAttendance[]>;
  listActivityAttendances(activityId: string): Promise<AdminActivityAttendance[]>;
};
```

Select columns explicitly. Never return activity latitude, longitude, radius, QR version or attendance data from `listPublicActivities()`.

- [ ] **Step 5: Implement the service and lazy codec**

```ts
export function createEnvironmentAttendanceTokenCodec(readSecret = () => process.env.ATTENDANCE_QR_SECRET) {
  const configured = () => {
    const secret = readSecret();
    if (!secret) throw new Error("A assinatura dos QR Codes ainda nao foi configurada.");
    return createAttendanceTokenCodec(secret);
  };
  return {
    issue: (activityId: string, qrVersion: number) => configured().issue(activityId, qrVersion),
    verify: (token: string) => configured().verify(token),
  };
}
```

`prepareCheckIn()` verifies the signature, loads the activity, compares the version, and returns only `{ activityId, activityTitle, verifyLocation }`. `checkIn()` repeats those checks, requires location exactly when configured, runs `validateAttendanceLocation()` for early user feedback, and still delegates the authoritative transaction to the RPC.

- [ ] **Step 6: Expose narrow TanStack server functions**

```ts
export const getPublicEventProgramme = createServerFn({ method: "GET" })
  .handler(async () => {
    try { return { status: "ready" as const, activities: await service().publicProgramme() }; }
    catch { return { status: "unavailable" as const, activities: [] }; }
  });

export const listAdminEventActivities = createServerFn({ method: "GET" })
  .middleware([requireAdmin]).handler(async () => service().listAdmin());

export const prepareParticipantEventAttendance = createServerFn({ method: "POST" })
  .middleware([requireParticipantAccess]).validator(tokenInput)
  .handler(async ({ data }) => service().prepareCheckIn(data.token));

export const recordParticipantEventAttendance = createServerFn({ method: "POST" })
  .middleware([requireParticipantAccess]).validator(checkInInput)
  .handler(async ({ data, context }) => service().checkIn(data, context.participantAccess));
```

Add create/update/delete/regenerate/list-attendances/admin-QR functions with `requireAdmin`, and dashboard/guide functions with `requireParticipantAccess`.

- [ ] **Step 7: Run focused tests and commit**

Run the Step 2 command. Expected: PASS.

```powershell
git add supabase/migrations/20260912200441_create_event_activity_attendance.sql src/features/event-activities/eventActivity.repository.server.ts src/features/event-activities/eventActivity.repository.server.test.ts src/features/event-activities/eventActivity.server.ts src/features/event-activities/eventActivity.server.test.ts src/lib/event-activity.functions.ts src/lib/event-activity.functions.test.ts
git commit -m "feat: add activity attendance service"
```

### Task 4: PDF A4 de QR Codes

**Files:**
- Create: `src/features/event-activities/eventActivityQrPdf.server.ts`
- Create: `src/features/event-activities/eventActivityQrPdf.server.test.ts`
- Modify: `src/features/event-activities/eventActivity.server.ts`
- Modify: `src/features/event-activities/eventActivity.server.test.ts`
- Modify: `src/lib/event-activity.functions.ts`

**Interfaces:**
- Produces: `buildEventActivityQrPdf(input): Promise<{ bytes: Uint8Array; filename: string }>` and admin server function `downloadAdminEventActivityQrPdf(): Promise<{ base64: string; filename: string }>`.
- Consumes: active QR activities, `AttendanceTokenCodec`, `qrcode.toDataURL`, event logo PNG and `pdf-lib`.

- [ ] **Step 1: Write a failing PDF test**

```ts
it("creates one A4 page for every active QR activity", async () => {
  const result = await buildEventActivityQrPdf({
    generatedAt: new Date("2026-09-13T12:00:00Z"),
    logoBytes,
    activities: [qrActivity("Conferencia", qrPng), qrActivity("Ensaio", qrPng)],
  });
  const pdf = await PDFDocument.load(result.bytes);
  expect(pdf.getPageCount()).toBe(2);
  expect(pdf.getPages()[0].getSize()).toEqual({ width: PageSizes.A4[0], height: PageSizes.A4[1] });
  expect(result.filename).toBe("encontro-coros-qrcodes-2026-09-13.pdf");
  expect(extractDrawnText(pdf)).toContain("Conferencia");
  expect(extractDrawnText(pdf)).toContain("Ensaio");
});
```

Also assert that the service rejects PDF generation when no active QR activities exist and never includes inactive/non-QR activities.

- [ ] **Step 2: Run the tests and observe failure**

```powershell
bunx vitest run src/features/event-activities/eventActivityQrPdf.server.test.ts src/features/event-activities/eventActivity.server.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the builder and service method are absent.

- [ ] **Step 3: Build one page per activity**

```ts
export async function buildEventActivityQrPdf(input: QrPdfInput) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const logo = await document.embedPng(input.logoBytes);
  for (const activity of input.activities) {
    const page = document.addPage(PageSizes.A4);
    const qr = await document.embedPng(dataUrlToBytes(activity.qrPngDataUrl));
    page.drawImage(logo, { x: 48, y: 742, width: 96, height: 52 });
    page.drawText(activity.title, { x: 48, y: 690, size: 24, font: bold });
    page.drawText(formatActivityDateTime(activity), { x: 48, y: 655, size: 13, font: regular });
    page.drawImage(qr, { x: 118, y: 220, width: 360, height: 360 });
    page.drawText("Escaneie para confirmar sua presenca", { x: 150, y: 180, size: 14, font: bold });
  }
  return { bytes: await document.save(), filename: filenameFor(input.generatedAt) };
}
```

Use text wrapping for long titles/locations and metadata title/author matching the event.

- [ ] **Step 4: Compose QR PNGs server-side and return a download payload**

The service filters `isActive && requiresQr`, calls `tokens.issue(activity.id, activity.qrVersion)`, creates each scan URL, renders PNG with `qrcode.toDataURL`, reads `src/assets/logo-coros-preto.png`, then calls the builder. Convert bytes with `Buffer.from(bytes).toString("base64")` only at the server-function boundary.

- [ ] **Step 5: Run tests and commit**

Run the Step 2 command. Expected: PASS.

```powershell
git add src/features/event-activities/eventActivityQrPdf.server.ts src/features/event-activities/eventActivityQrPdf.server.test.ts src/features/event-activities/eventActivity.server.ts src/features/event-activities/eventActivity.server.test.ts src/lib/event-activity.functions.ts
git commit -m "feat: generate printable activity qr pdf"
```

### Task 5: CRUD administrativo, presencas e navegacao

**Files:**
- Create: `src/features/event-activities/AdminEventActivitiesPage.tsx`
- Create: `src/features/event-activities/AdminEventActivitiesPage.test.tsx`
- Create: `src/features/event-activities/AdminActivityAttendancesDialog.tsx`
- Create: `src/features/event-activities/AdminActivityAttendancesDialog.test.tsx`
- Create: `src/routes/admin.atividades.tsx`
- Modify: `src/features/admin/AdminNavigation.tsx`
- Modify: `src/features/admin/AdminNavigation.test.tsx`

**Interfaces:**
- Consumes: all admin server functions from Task 3 and PDF payload from Task 4.
- Produces: `/admin/atividades` and the `activities` navigation state.

- [ ] **Step 1: Write failing UI and navigation tests**

```tsx
it("does not show or submit geofence fields while verification is off", async () => {
  const emptyDependencies = {
    loadActivities: vi.fn().mockResolvedValue([]),
    createActivity: vi.fn(), updateActivity: vi.fn(), deleteActivity: vi.fn(),
    generateQr: vi.fn(), regenerateQr: vi.fn(), downloadQrPdf: vi.fn(),
    listAttendances: vi.fn().mockResolvedValue([]),
  };
  render(<AdminEventActivitiesPage {...emptyDependencies} />);
  await user.click(screen.getByRole("button", { name: "Cadastrar atividade" }));
  expect(screen.queryByLabelText("Latitude")).not.toBeInTheDocument();
  await user.click(screen.getByRole("switch", { name: "Controlar presenca por QR Code" }));
  expect(screen.queryByLabelText("Latitude")).not.toBeInTheDocument();
  await user.click(screen.getByRole("switch", { name: "Verificar localizacao" }));
  expect(screen.getByLabelText("Latitude")).toBeRequired();
  expect(screen.getByLabelText("Longitude")).toBeRequired();
  expect(screen.getByLabelText("Raio permitido em metros")).toBeRequired();
});

it("downloads one collective QR PDF", async () => {
  await user.click(screen.getByRole("button", { name: "Baixar PDF dos QR Codes" }));
  expect(downloadQrPdf).toHaveBeenCalledTimes(1);
});
```

Navigation tests must assert the seven labels in exact order and `/admin/atividades` marked with `aria-current="page"`. Attendance-dialog tests must assert count, participant name, formatted time, distance, accuracy and `https://www.google.com/maps?q=<lat>,<lon>` with `target="_blank"` and `rel="noreferrer"`.

- [ ] **Step 2: Run the tests and observe failure**

```powershell
bunx vitest run src/features/event-activities/AdminEventActivitiesPage.test.tsx src/features/event-activities/AdminActivityAttendancesDialog.test.tsx src/features/admin/AdminNavigation.test.tsx --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the page/dialog do not exist and the navigation lacks Programacao.

- [ ] **Step 3: Implement the seven-item responsive navigation**

Extend the current approved union rather than reverting it:

```ts
type AdminSection = "summary" | "registrations" | "choirs" | "activities" | "sponsors" | "documents" | "settings";
export type AdminNavigationPath =
  | "/admin/resumo" | "/admin/inscricoes" | "/admin/coros" | "/admin/atividades"
  | "/admin/patrocinadores" | "/admin/documentos" | "/admin/configuracoes";
```

Render Programacao after Coros. Keep minimum 44 px touch targets and use horizontal overflow on narrow screens so seven items never collapse into unreadable labels.

- [ ] **Step 4: Implement CRUD with conditional location fields**

Use a dialog form backed by `EventActivityCreate`. When QR is turned off, immediately set `verifyLocation=false` and clear latitude/longitude/radius. When location is turned off, clear the three location fields. Disable PDF with explanatory copy when `activities.every(a => !a.isActive || !a.requiresQr)`.

```ts
function withoutGeofence(draft: EventActivityCreate): EventActivityCreate {
  return { ...draft, verifyLocation: false, latitude: null, longitude: null, radiusMeters: null };
}
```

Add create, edit, delete, active/QR badges, attendance count, show QR, regenerate QR confirmation, PDF download and the attendance-dialog action. Preserve form values after a failed save.

- [ ] **Step 5: Implement browser PDF download cleanup**

```ts
export function downloadBase64Pdf(file: { base64: string; filename: string }) {
  const bytes = Uint8Array.from(atob(file.base64), (char) => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const anchor = document.createElement("a");
  try { anchor.href = url; anchor.download = file.filename; document.body.append(anchor); anchor.click(); }
  finally { anchor.remove(); URL.revokeObjectURL(url); }
}
```

- [ ] **Step 6: Implement attendance details and the protected route**

`AdminActivityAttendancesDialog` loads only after opening, displays a skeleton/error/empty state, and uses the explicit map URL. `admin.atividades.tsx` checks `getAdminAccess()` in `beforeLoad`, redirects unauthorized users to `/acessar`, renders the page, and sets `noindex,nofollow`.

- [ ] **Step 7: Run tests and commit**

Run the Step 2 command. Expected: PASS.

```powershell
git add src/features/event-activities/AdminEventActivitiesPage.tsx src/features/event-activities/AdminEventActivitiesPage.test.tsx src/features/event-activities/AdminActivityAttendancesDialog.tsx src/features/event-activities/AdminActivityAttendancesDialog.test.tsx src/routes/admin.atividades.tsx src/features/admin/AdminNavigation.tsx src/features/admin/AdminNavigation.test.tsx
git commit -m "feat: add programme administration"
```

### Task 6: Leitor do participante e localizacao condicional

**Files:**
- Create: `src/features/event-activities/attendanceQrScanner.ts`
- Create: `src/features/event-activities/attendanceQrScanner.client.test.ts`
- Create: `src/features/event-activities/participantGeolocation.ts`
- Create: `src/features/event-activities/participantGeolocation.test.ts`
- Create: `src/features/event-activities/ParticipantAttendancePage.tsx`
- Create: `src/features/event-activities/ParticipantAttendancePage.test.tsx`
- Create: `src/routes/participante.presenca.tsx`

**Interfaces:**
- Produces: `scanAttendanceQr()`, `extractAttendanceTokenFromScan()`, `requestParticipantPosition()`, `/participante/presenca`.
- Consumes: preflight, check-in and dashboard functions from Task 3.

- [ ] **Step 1: Write failing scanner, geolocation and page tests**

```tsx
it("never requests location when the activity flag is off", async () => {
  const requestPosition = vi.fn();
  render(<ParticipantAttendancePage token="signed" prepare={resolved({ verifyLocation: false })}
    checkIn={recorded()} requestPosition={requestPosition} loadDashboard={dashboard()} onBack={vi.fn()} />);
  expect(await screen.findByText("Presenca confirmada")).toBeInTheDocument();
  expect(requestPosition).not.toHaveBeenCalled();
  expect(checkIn).toHaveBeenCalledWith({ data: { token: "signed", location: null } });
});

it("blocks check-in when required location is denied", async () => {
  render(<ParticipantAttendancePage token="signed" prepare={resolved({ verifyLocation: true })}
    requestPosition={vi.fn().mockRejectedValue(new Error("Permita a localizacao para confirmar a presenca."))}
    checkIn={checkIn} loadDashboard={dashboard()} onBack={vi.fn()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Permita a localizacao");
  expect(checkIn).not.toHaveBeenCalled();
});
```

Test geolocation options exactly `{ enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }`, map permission/timeout/unavailable errors to Portuguese, and use `position.timestamp` for `collectedAt`. Scanner tests must reject unrelated URLs and always stop camera tracks.

- [ ] **Step 2: Run tests and observe failure**

```powershell
bunx vitest run src/features/event-activities/attendanceQrScanner.client.test.ts src/features/event-activities/participantGeolocation.test.ts src/features/event-activities/ParticipantAttendancePage.test.tsx --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the modules and page do not exist.

- [ ] **Step 3: Implement the geolocation boundary**

```ts
export function requestParticipantPosition(): Promise<AttendanceLocationInput> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("A localizacao nao esta disponivel neste aparelho."));
    navigator.geolocation.getCurrentPosition(
      ({ coords, timestamp }) => resolve({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracyMeters: coords.accuracy,
        collectedAt: new Date(timestamp).toISOString(),
      }),
      (error) => reject(mapGeolocationError(error)),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );
  });
}
```

- [ ] **Step 4: Implement QR scanning with cleanup**

Use `BarcodeDetector` with `qr_code`, rear camera preference, a 60-second timeout and an `AbortSignal`. In `finally`, stop every media track and clear `video.srcObject`. If the API is unavailable, instruct the participant to use the phone camera to open the printed URL.

- [ ] **Step 5: Implement the two-phase participant flow**

For either a query-string token or camera token: call preflight; if `verifyLocation=false`, call check-in with `location:null`; if true, show why location is needed, request it once, then submit it. After recorded/already-recorded, reload the dashboard. Render the percent, `attended de required`, and each QR activity as Presente/Pendente.

- [ ] **Step 6: Implement the route**

Validate search with `z.object({ token: z.string().max(2048).catch("") })`, render the page, return to `/participante`, and add `noindex,nofollow`. Authorization remains on both server functions so a forged client route cannot bypass access checks.

- [ ] **Step 7: Run tests and commit**

Run the Step 2 command. Expected: PASS.

```powershell
git add src/features/event-activities/attendanceQrScanner.ts src/features/event-activities/attendanceQrScanner.client.test.ts src/features/event-activities/participantGeolocation.ts src/features/event-activities/participantGeolocation.test.ts src/features/event-activities/ParticipantAttendancePage.tsx src/features/event-activities/ParticipantAttendancePage.test.tsx src/routes/participante.presenca.tsx
git commit -m "feat: add participant qr attendance flow"
```

### Task 7: Programacao publica e guia do participante

**Files:**
- Create: `src/features/event-activities/PublicProgramme.tsx`
- Create: `src/features/event-activities/PublicProgramme.test.tsx`
- Modify: `src/routes/index.tsx`
- Modify: `src/routes/index.test.tsx`
- Modify: `src/features/participant/ChoristerEventGuideTab.tsx`
- Modify: `src/features/participant/ChoristerEventGuideTab.test.tsx`

**Interfaces:**
- Consumes: `getPublicEventProgramme()` and `getParticipantEventActivities()` from Task 3.
- Produces: one database-backed schedule used on the homepage and participant guide.

- [ ] **Step 1: Write failing public-program and guide tests**

```tsx
it("renders database activities by day and category", () => {
  render(<PublicProgramme result={{ status: "ready", activities: programme }} />);
  expect(screen.getByRole("heading", { name: "20 de novembro" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Credenciamento" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Acolhimento" })).toBeInTheDocument();
});

it("keeps a programme failure inside the section", () => {
  render(<PublicProgramme result={{ status: "unavailable", activities: [] }} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Nao foi possivel carregar a programacao");
});
```

Update the guide test to omit the injected mock and verify that the default loader is `getParticipantEventActivities`. Keep the CoroApp-event fallback and deduplication behavior.

- [ ] **Step 2: Run tests and observe failure**

```powershell
bunx vitest run src/features/event-activities/PublicProgramme.test.tsx src/features/participant/ChoristerEventGuideTab.test.tsx src/routes/index.test.tsx --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because `PublicProgramme` is absent and the homepage still uses the constant.

- [ ] **Step 3: Extract category presentation and dynamic grouping**

```ts
export function groupPublicProgramme(activities: PublicEventActivity[]): ProgrammeDay[] {
  const groups = new Map<string, PublicEventActivity[]>();
  for (const activity of activities) groups.set(activity.activityDate, [...(groups.get(activity.activityDate) ?? []), activity]);
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => ({
    date,
    items: items.sort((a, b) => a.sortOrder - b.sortOrder || (a.startsAt ?? "99:99").localeCompare(b.startsAt ?? "99:99")),
  }));
}
```

Render the existing carousel/three-column design from database fields and the same category icons. Format dates and times in Portuguese without deriving business data from display strings.

- [ ] **Step 4: Replace the hardcoded homepage constant with route loader data**

```ts
// Insert this property into the existing createFileRoute("/") options object;
// retain its current component and complete head callback unchanged.
loader: () => getPublicEventProgramme(),

function Index() {
  const programme = Route.useLoaderData();
  return <main>{/* existing sections */}<PublicProgramme result={programme} />{/* existing sections */}</main>;
}
```

Delete `const schedule` from `index.tsx`; keep static category presentation only in `PublicProgramme.tsx`.

- [ ] **Step 5: Wire the real participant guide loader**

Import `getParticipantEventActivities` and make it the default `loadActivities`. Preserve injected loaders for focused tests and the existing event-feed fallback when the activity call fails.

- [ ] **Step 6: Run tests and commit**

Run the Step 2 command. Expected: PASS.

```powershell
git add src/features/event-activities/PublicProgramme.tsx src/features/event-activities/PublicProgramme.test.tsx src/routes/index.tsx src/routes/index.test.tsx src/features/participant/ChoristerEventGuideTab.tsx src/features/participant/ChoristerEventGuideTab.test.tsx
git commit -m "feat: load public programme from activities"
```

### Task 8: Integracao de rotas e verificacao final local

**Files:**
- Modify: `src/routes/access-routes.test.tsx`
- Modify: `src/routeTree.gen.ts`
- Modify: `src/integrations/supabase/types.ts`
- Test: all event-activity files created above.

**Interfaces:**
- Consumes: every interface from Tasks 1-7.
- Produces: a buildable route tree and generated database typings consistent with the migration.

- [ ] **Step 1: Add route-boundary tests before generating files**

Assert `/admin/atividades` redirects a missing/non-admin session to `/acessar`, authorized admin access reaches the page, `/participante/presenca?token=...` preserves the bounded token, and public `/` still renders when programme status is unavailable.

```tsx
expect(routeTreeText).toContain("/admin/atividades");
expect(routeTreeText).toContain("/participante/presenca");
expect(screen.getByRole("navigation", { name: "Navegacao administrativa" })).toBeInTheDocument();
```

- [ ] **Step 2: Run route tests and observe failure**

```powershell
bunx vitest run src/routes/access-routes.test.tsx --no-file-parallelism --maxWorkers=1
```

Expected: FAIL until the route tree includes the new routes and mocks cover the new server functions.

- [ ] **Step 3: Generate the route tree and database types**

Run a production build once to invoke the TanStack route generator:

```powershell
bun run build
```

Inspect `src/routeTree.gen.ts` and retain only expected entries for `/admin/atividades` and `/participante/presenca`; restore ordering-only noise if the generator rewrites unrelated routes. Update `src/integrations/supabase/types.ts` with exact row/insert/update/function shapes for `event_activities`, `event_activity_attendances`, and `record_event_activity_attendance`.

- [ ] **Step 4: Run the complete focused serial suite**

```powershell
bunx vitest run src/features/event-activities src/features/admin/AdminNavigation.test.tsx src/features/participant/ChoristerEventGuideTab.test.tsx src/routes/index.test.tsx src/routes/access-routes.test.tsx --no-file-parallelism --maxWorkers=1
```

Expected: all focused tests PASS with no unhandled rejection or open camera stream.

- [ ] **Step 5: Run static and production checks**

```powershell
bunx tsc --noEmit
bun run build
```

Expected: both exit 0. If a global failure is unrelated and reproducible from `origin/main`, record it separately; do not call the full suite green.

- [ ] **Step 6: Inspect the final diff and migration without mutating remote state**

```powershell
git diff --check origin/main...HEAD
git status --short
git diff --stat origin/main...HEAD
```

Expected: no whitespace errors, only planned files, no secrets, and no generated build artifacts. Confirm the root checkout still has its original dirty-file hash inventory.

- [ ] **Step 7: Commit integration output**

```powershell
git add src/routes/access-routes.test.tsx src/routeTree.gen.ts src/integrations/supabase/types.ts
git commit -m "test: verify programme attendance integration"
```

- [ ] **Step 8: Produce separate release evidence**

Record local HEAD, focused-test count, TypeScript result, build result, migration filename and the fact that Supabase remote SQL, Git push and Lovable deployment were not performed. Any later remote migration or publication requires its own target verification and authorization.
