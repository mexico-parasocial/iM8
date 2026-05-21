# Migrando el backend de m8: de Fastify a AdonisJS sin romper nada

> **Contexto**: m8 es el gestor de identidad de PARA — un broker de pruebas, wallet de credenciales y servicio de políticas de confianza para la participación cívica digital. Este post documenta la migración incremental de nuestro backend de Fastify a AdonisJS, en producción, sin downtime y sin reescribir la lógica de dominio.

---

## Tabla de contenidos

1. [Qué es m8 y por qué un framework importa](#qué-es-m8-y-por-qué-un-framework-importa)
2. [El punto de inflexión: cuando Fastify dejó de escalar para *nosotros*](#el-punto-de-inflexión)
3. [Por qué AdonisJS y no Express/Nest/Fastify+DI](#por-qué-adonisjs)
4. [Estrategia de migración: dual runtime](#estrategia-de-migración)
5. [Fase 1: Bootstrap del runtime Adonis](#fase-1-bootstrap)
6. [Fase 2: De rutas inline a controllers con tipos](#fase-2-rutas-a-controllers)
7. [Fase 3: Middleware, auth e i18n](#fase-3-middleware-auth-i18n)
8. [Antes y después: código real](#antes-y-después)
9. [Decisiones arquitectónicas difíciles](#decisiones-arquitectónicas)
10. [Lecciones aprendidas](#lecciones-aprendidas)
11. [Estado actual y roadmap](#estado-actual-y-roadmap)

---

## Qué es m8 y por qué un framework importa

m8 no es un CRUD más. Es un **gestor de identidad soberana** que permite a ciudadanos mexicanos:

- Crear una identidad digital portable (DID) vinculada a su INE.
- Emitir y revocar **pruebas de conocimiento cero** (ZKP) sobre atributos de su identidad sin revelar los datos subyacentes.
- Gestionar *grants* — permisos fine-grained que aplicaciones de terceros solicitan sobre atributos específicos.
- Participar en espacios cívicos (PARA) con múltiples personas (cards) pero **una sola voz, un solo voto**.

El backend de m8 tiene ~10 módulos de ruta, ~15 servicios de dominio, ZKP con Circom/SnarkJS, resolución DID de AT Protocol, SQLite con better-sqlite3, y un sistema de ledger de auditoría completo. No es un proyecto donde "cualquier framework sirve". Necesitamos **estructura**, **tipado fuerte**, y **convenciones que escalen con un equipo pequeño**.

---

## El punto de inflexión: cuando Fastify dejó de escalar para *nosotros*

Fastify es un framework excepcional. Es rápido, tiene un excelente ecosistema de plugins, y su sistema de hooks es potente. Lo usamos durante más de un año y nos dio velocidad. Pero a medida que creció m8, empezamos a ver patrones que no escalaban con nuestro modelo mental:

### 1. Todo en un solo archivo

Nuestras rutas Fastify se parecían a esto:

```typescript
// src/routes/identity.ts — 552 líneas
export async function identityRoutes(fastify: FastifyInstance) {
  fastify.post('/identity/request', { preHandler: requireAuth }, async (request, reply) => {
    const body = identityRequestSchema.parse(request.body)
    const req = createIdentityRequest(request.sessionId!, body)
    // ... 30 líneas de SQL inline
    return reply.status(201).send(req)
  })

  fastify.post('/identity/present', { preHandler: requireAuth }, async (request, reply) => {
    // ... 40 líneas más
  })

  // ... 15 endpoints más en el mismo archivo
}
```

Esto funcionaba para 3 endpoints. Para 15 endpoints con ZKP, INE, chat key backup, revocation y CRL, el archivo se volvió imposible de navegar.

### 2. No hay separación entre "qué URL atiendo" y "qué hago"

En Fastify, la ruta *es* el controller. Eso es libertad, pero también es anarquía cuando tienes 10 archivos de rutas y cada uno inventa su propio patrón de validación, su propio manejo de errores, y su propia forma de acceder a la DB.

### 3. El auth se colgaba de `request.sessionId`

Nuestro middleware de auth inyectaba `sessionId` en el objeto `request` de Fastify vía declaración de tipo global. Funcionaba, pero era mágico. Un nuevo developer no sabía de dónde venía `request.sessionId` sin leer el middleware.

### 4. i18n acoplada al ciclo de vida de Fastify

El `request.t()` era seteado en un hook `onRequest`. Funcionaba, pero no podíamos usarlo fuera del contexto de una petición HTTP (por ejemplo, en un job o en un test unitario sin levantar el servidor).

### 5. No hay estructura de proyecto impuesta

Cada developer añadía archivos donde quería. Teníamos `src/routes/`, `src/services/`, `src/middleware/`, pero no había convención sobre dónde poner utilidades, dónde poner schemas de validación, o cómo organizar tests.

---

## Por qué AdonisJS y no Express/Nest/Fastify+DI

Evaluamos tres opciones seriamente:

| Opción | Pros | Contras |
|--------|------|---------|
| **Fastify + DI manual** | Mínimo cambio, conocimiento existente | Seguimos sin estructura, el DI es homemade |
| **NestJS** | Muy maduro, ecosistema enorme | Demasiado boilerplate para un equipo de 2-3 personas. Decoradores everywhere. |
| **AdonisJS v6** | Framework completo pero ligero. Convenciones sensatas. TypeScript nativo. DI container built-in. Test runner integrado. | Curva de aprendizaje inicial. Ecosistema menor que Nest. |

**Elegimos AdonisJS v6** por tres razones fundamentales:

1. **Convenciones sin ser opresivo**: Adonis tiene una estructura de carpetas estándar (`app/controllers/`, `app/middleware/`, `start/routes.ts`), pero no te obliga a usarla al 100%. Puedes integrar código legacy gradualmente.

2. **DI container transparente**: No usamos `@Injectable()` en cada clase. Adonis resuelve dependencias vía imports directos o vía el container cuando es necesario. Es lo suficientemente mágico para ser productivo, pero lo suficientemente explícito para no perder el control.

3. **HttpContext como primer ciudadano**: En Fastify, el `request` y `reply` son objetos separados que mutan. En Adonis, `HttpContext` encapsula request, response, auth, i18n, y logger en un solo objeto inmutable que se pasa explícitamente. Esto hace que las funciones puras sean más fáciles de testear.

---

## Estrategia de migración: dual runtime

La regla de oro fue: **no reescribir la lógica de dominio**. Los servicios en `src/services/` funcionan bien. Lo que necesitábamos era una nueva capa de "transporte HTTP".

### El plan

```
Semana 1: Bootstrap Adonis junto a Fastify
Semana 2: Migrar health, sessions (smoke test)
Semana 3: Migrar grants, claims, providers
Semana 4: Migrar anonymous identities
Semana 5: Migrar identity (INE, ZKP, wallet)
Semana 6: Migrar karma, ledger, issuers
```

El `package.json` mantiene dos comandos:

```json
{
  "scripts": {
    "dev": "node ace serve --watch",
    "start:fastify": "tsx watch src/index.ts"
  }
}
```

`npm run dev` usa Adonis. `start:fastify` es el fallback legacy. Si algo rompe en Adonis, podemos volver a Fastify en segundos.

---

## Fase 1: Bootstrap del runtime Adonis

### Configuración mínima

Adonis v6 no requiere una estructura monolítica. Empezamos con lo mínimo:

```typescript
// adonisrc.ts
import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    () => import('@adonisjs/core/providers/vinejs_provider'),
    () => import('@adonisjs/cors/cors_provider'),
  ],
  preloads: [
    () => import('#start/m8'),     // init DB, schema, DID cache
    () => import('#start/routes'), // registro de rutas
    () => import('#start/kernel'), // middleware global
  ],
})
```

El archivo `#start/m8.ts` es crítico. Es donde inicializamos todo lo que antes hacía `buildApp()` en Fastify:

```typescript
// start/m8.ts
import { ensureSchema, runMigrations } from '#src/db/migrate'
import { ensureDidCacheSchema } from '#src/services/didResolver'

ensureSchema()
runMigrations()
ensureDidCacheSchema()
```

Nota los imports con `#src/`. Adonis v6 usa subpath imports definidos en `package.json`:

```json
{
  "imports": {
    "#controllers/*": "./app/controllers/*.js",
    "#middleware/*": "./app/middleware/*.js",
    "#support/*": "./app/support/*.js",
    "#src/*": "./src/*.js"
  }
}
```

Esto nos permite importar servicios legacy desde controllers Adonis sin rutas relativas locas (`../../src/services/...` vs `#src/services/...`).

---

## Fase 2: De rutas inline a controllers con tipos

### Antes: Fastify

```typescript
// src/routes/sessions.ts
export async function sessionRoutes(fastify: FastifyInstance) {
  fastify.post('/sessions/start', async (request, reply) => {
    const body = startSessionSchema.parse(request.body)
    const result = await createSession(body)
    // ... lógica de tokens, OAuth, DB
    return reply.send({ ...result, tokens: { accessToken, refreshToken } })
  })

  fastify.get('/sessions/me', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send({
      session: hydrateSession(request.sessionId!),
      anonymousProfile: getAnonymousProfile(request.sessionId!),
    })
  })
}
```

### Después: Adonis

```typescript
// app/controllers/sessions_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import { requireSessionId, validateBody, signAccessToken } from '#support/http'

const startSessionSchema = z.object({
  identifier: z.string().min(1).max(256),
})

export default class SessionsController {
  async start(ctx: HttpContext) {
    const body = validateBody(ctx, startSessionSchema)
    if (!body) return

    const result = await createSession(body)
    const accessToken = signAccessToken(result.attempt.sessionId)
    // ...
    return ctx.response.send({ ...result, tokens: { accessToken } })
  }

  me(ctx: HttpContext) {
    const sessionId = requireSessionId(ctx)
    if (!sessionId) return

    return ctx.response.send({
      session: hydrateSession(sessionId),
      anonymousProfile: getAnonymousProfile(sessionId),
    })
  }
}
```

**Diferencias clave**:

1. **Separación de responsabilidades**: El controller solo orquesta. No hay SQL inline (eso sigue en los servicios).
2. **Tipado explícito**: `HttpContext` es tipado por Adonis. No hay `request.sessionId!` con non-null assertion.
3. **Validación con early return**: `validateBody()` hace `ctx.response.status(422).send(...)` y retorna `null`. El controller hace `if (!body) return`. Es explícito y fácil de seguir.
4. **Un controller, múltiples acciones**: `SessionsController` agrupa `start`, `me`, `refresh`, `enableAnonymous`, etc. En Fastify, cada archivo de rutas era un namespace plano.

---

## Fase 3: Middleware, auth e i18n

### Auth: de hook mágico a helper explícito

En Fastify, el auth era un plugin que mutaba `request`:

```typescript
// Fastify — middleware/auth.ts
app.addHook('onRequest', async (request) => {
  const token = extractBearer(request.headers.authorization)
  request.sessionId = verifyJwt(token)?.sub
})
```

Esto significaba que `request.sessionId` aparecía "por arte de magia" en cualquier handler.

En Adonis, hicimos un helper explícito:

```typescript
// app/support/http.ts
export function requireSessionId(ctx: HttpContext): string | null {
  const authorization = ctx.request.header('authorization') ?? ''
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]
  const payload = token ? verifyAccessToken(token) : null

  if (!payload?.sub) {
    ctx.response.status(401).send({ error: 'Unauthorized' })
    return null
  }

  return payload.sub
}
```

Cada controller que necesita auth lo llama explícitamente:

```typescript
async me(ctx: HttpContext) {
  const sessionId = requireSessionId(ctx)
  if (!sessionId) return
  // ...
}
```

**¿Por qué no middleware de Adonis?** Porque teníamos muchos endpoints públicos (CRL, ZKP assets, issuers) mezclados con endpoints protegidos. Un middleware global que requiera auth rompería esos endpoints. Prefirimos el helper explícito sobre un middleware que requiera lista de excepciones.

### i18n: de hook a helper de contexto

En Fastify, i18n era un hook:

```typescript
app.addHook('onRequest', async (request) => {
  request.t = createT(resolveLocale(request.headers['accept-language']))
})
```

En Adonis, un helper que recibe `HttpContext`:

```typescript
// app/support/http.ts
export function t(ctx: HttpContext) {
  const locale = resolveLocale(ctx.request.header('accept-language') ?? undefined)
  return createT(locale)
}
```

Uso:

```typescript
const $t = t(ctx)
return ctx.response.status(404).send({ error: $t('errors.revoke.notFound') })
```

Esto tiene una ventaja sutil: `t(ctx)` funciona en cualquier función que reciba `HttpContext`, no solo en handlers HTTP. Podemos extraerlo a servicios de aplicación si queremos.

---

## Antes y después: código real

### El caso más complejo: Identity + INE + ZKP

El módulo de identidad tenía 552 líneas en Fastify. Lo dividimos en un `IdentitiesController` de 19 métodos.

#### INE credential issuance

**Fastify**:

```typescript
fastify.post('/identity/ine/credential', { preHandler: requireAuth }, async (request, reply) => {
  const body = request.body as { extracted: IneExtractedData; verification: IneVerificationResult }
  const db = getDb()

  // Calculate age-based claims
  const birthDate = new Date(body.extracted.birthDate)
  // ... 80 líneas de lógica inline

  db.prepare(`INSERT INTO grants ...`).run(...)
  db.prepare(`INSERT INTO proof_artifacts ...`).run(...)
  db.prepare(`INSERT INTO ledger ...`).run(...)

  return reply.send({ credential: { claims, ... }, proofArtifactId, ... })
})
```

**Adonis**:

```typescript
async ineCredential(ctx: HttpContext) {
  const sessionId = requireSessionId(ctx)
  if (!sessionId) return

  const body = ctx.request.body() as { extracted: IneExtractedData; verification: IneVerificationResult }
  const db = getDb()
  const $t = t(ctx)

  // Lógica de dominio (sin cambios)
  const birthDate = new Date(body.extracted.birthDate)
  // ...

  db.prepare(`INSERT INTO grants ...`).run(grantId, sessionId, ...)
  // ...

  return ctx.response.send({ credential: { claims, ... }, ... })
}
```

La estructura es idéntica. Lo que cambia es:
- `request.sessionId!` → `requireSessionId(ctx)` con early return
- `request.t(...)` → `t(ctx)(...)` explícito
- `reply.send()` → `ctx.response.send()`

La lógica de dominio (cálculo de claims, ZKP commitment, ledger) no se tocó.

#### ZKP static assets

Los archivos estáticos del prover (`.wasm`, `.zkey`, `.html`) se sirven directamente desde el filesystem. En Fastify usábamos `readFileSync` y seteábamos headers manualmente. En Adonis es idéntico, pero encapsulado en métodos de controller:

```typescript
zkpProverHtml({ response }: HttpContext) {
  const html = readFileSync(PROVER_HTML, 'utf8')
  return response.header('content-type', 'text/html').send(html)
}
```

---

## Decisiones arquitectónicas difíciles

### 1. ¿Preservar o reemplazar el router de Fastify?

Adonis tiene su propio router (`@adonisjs/core/services/router`). Decidimos usarlo en vez de intentar montar el router de Fastify dentro de Adonis. Esto significó reescribir todas las definiciones de rutas, pero nos dio:

- Generación automática de URL helpers
- Route groups con prefix
- Named routes (para tests y redirecciones)

### 2. ¿Mantener Zod o migrar a VineJS?

Adonis v6 promociona VineJS como validador por defecto. Pero nuestros schemas Zod están en ~15 archivos, algunos muy complejos (especialmente los de ZKP y wallet). Decidimos **mantener Zod** en los controllers Adonis. No hay conflicto técnico: `validateBody(ctx, zodSchema)` funciona perfectamente.

### 3. ¿Qué hacer con los tests?

Nuestros tests de integración legacy corren contra el servidor Fastify (`src/index.ts`). No los tocamos. El plan es:
- Fase A: Mantener tests legacy contra Fastify (garantiza que la lógica de dominio sigue funcionando)
- Fase B: Escribir tests de integración Adonis usando el test runner de Adonis
- Fase C: Deprecar tests Fastify cuando la cobertura Adonis sea 100%

Actualmente estamos en Fase A→B.

### 4. ¿Mantener SQLite o migrar a PostgreSQL?

Adonis tiene Lucid ORM con soporte nativo para PostgreSQL, MySQL, SQLite, etc. Pero nuestros servicios usan SQL crudo con `better-sqlite3` y el schema es muy específico (tablas para ZKP, nullifiers, karma, ledger). Decidimos **mantener better-sqlite3** por ahora y no forzar Lucid. Si en el futuro migramos a PostgreSQL, lo haremos en una migración separada.

---

## Lecciones aprendidas

### 1. No reescribas la lógica de dominio

El error más común en migraciones es aprovechar para "refactorizar todo". No lo hagas. La lógica de ZKP, INE, y wallet es frágil y bien testeada. Migrar el framework ya es suficiente cambio. Los servicios en `src/services/` no se movieron ni se reescribieron.

### 2. Dual runtime es tu amigo

Tener `npm run dev` (Adonis) y `npm run start:fastify` (legacy) corriendo en paralelo nos dio tranquilidad. Durante 3 semanas, cualquier PR se testeaba contra ambos runtimes.

### 3. Empieza por los endpoints simples

Health check fue el primero. Luego sessions. Luego grants. Dejamos identity (el más complejo) para el final. Esto nos permitió descubrir patrones (cómo hacer auth, cómo hacer i18n, cómo estructurar controllers) antes de enfrentarnos a los 552 líneas de `identity.ts`.

### 4. Los imports subpath (#) valen la pena

Sin los subpath imports de Node.js (`#controllers/`, `#src/`, `#support/`), tendríamos rutas relativas imposibles como `../../../../src/services/zkpService.js` desde `app/controllers/`. El `package.json` `imports` field es una característica infraestimada de Node.js moderno.

### 5. TypeScript estricto paga dividendos

Adonis v6 está diseñado para TypeScript estricto. Durante la migración, TS nos detectó:
- 3 usos de `any` que escondían bugs reales
- 2 endpoints donde el body podía ser `null` y no lo estábamos chequeando
- 1 caso donde `request.params` tenía un tipo incorrecto

---

## Estado actual y roadmap

### ✅ Completado

- [x] Runtime Adonis v6 bootstrap (`ace`, `adonisrc.ts`, `bin/server.ts`)
- [x] Middleware global (CORS, JSON response, container bindings)
- [x] Auth helper explícito basado en JWT HMAC
- [x] i18n helper basado en `Accept-Language`
- [x] Todos los controllers migrados:
  - Health, Sessions, Grants, Claims, Providers
  - Anonymous Identities, Device Trust
  - Identity (wallet, INE, ZKP, chat key backup, revocation, CRL)
  - Issuers, Karma, Ledger
- [x] `npm run lint` pasa (`tsc --noEmit`)
- [x] `npm run build` pasa (`node ace build`)
- [x] Smoke tests contra `/v1/health`, `/v1/sessions/start`, `/v1/sessions/me`

### 🔄 En progreso

- [ ] Tests de integración contra Adonis (usando el test runner de Adonis)
- [ ] Evaluación de `@para/m8-types` para compartir tipos entre frontend y backend
- [ ] Documentación de API con Swagger/Scalar

### 📋 Próximos pasos

- [ ] Migrar `start:fastify` a modo "compatibilidad" y eventualmente eliminarlo
- [ ] Considerar Lucid ORM para nuevas tablas (sin migrar las existentes)
- [ ] Rate limiting con `@adonisjs/limiter`
- [ ] Queue system para procesamiento async de ZKP

---

## Conclusión

Migrar de Fastify a AdonisJS no fue una decisión de "Fastify es malo". Fastify sigue siendo excelente. Fue una decisión de **escalar el equipo y el codebase**. Con Adonis, un nuevo contributor puede abrir el proyecto y saber dónde van los controllers, dónde van las rutas, y cómo funciona el auth — sin leer 500 líneas de configuración manual.

El enfoque incremental (dual runtime, servicios intactos, migrar endpoint por endpoint) nos permitió hacer la transición sin downtime, sin reescribir lógica de dominio, y sin perder la confianza en el sistema.

Si estás considerando una migración similar, la pregunta clave no es "¿Fastify o Adonis?" sino **"¿mi equipo tiene una estructura clara que escale sin que yo esté presente?"**. Si la respuesta es no, tal vez es hora de pensar en convenciones.

---

*Publicado por el equipo de PARA. Código disponible en [github.com/mexico-parasocial/m8-app](https://github.com/mexico-parasocial/m8-app).*
