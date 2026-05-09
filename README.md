# SAST / DAST Demo aplicado al proyecto Autenticación, RBAC y ABAC

Aplicación de demostración full-stack que ilustra patrones de seguridad estándar de la industria: autenticación multifactor, control de acceso basado en roles (RBAC) y control de acceso basado en atributos (ABAC). La API sigue la **Arquitectura Hexagonal (Puertos y Adaptadores)**, manteniendo toda la lógica de seguridad en un núcleo de dominio independiente del framework.

---

## Tabla de Contenidos

1. [Enfoque de Seguridad](#enfoque-de-seguridad)
   - [Autenticación](#1-autenticación)
   - [RBAC — Control de Acceso Basado en Roles](#2-rbac--control-de-acceso-basado-en-roles)
   - [ABAC — Control de Acceso Basado en Atributos](#3-abac--control-de-acceso-basado-en-atributos)
2. [Arquitectura](#arquitectura)
   - [Arquitectura Hexagonal — Fundamentos](#arquitectura-hexagonal--fundamentos)
   - [Las cuatro capas del proyecto](#las-cuatro-capas-del-proyecto)
   - [Arquitectura del Frontend](#arquitectura-del-frontend--feature-sliced)
   - [Estructura de carpetas completa](#estructura-de-carpetas-completa)
3. [Módulos](#módulos)
4. [Esquema de Base de Datos](#esquema-de-base-de-datos)
5. [Referencia de la API](#referencia-de-la-api)
6. [Roles y Permisos](#roles-y-permisos)
7. [Usuarios de Demostración](#usuarios-de-demostración)
8. [Casos de Uso — Roles y Permisos](#casos-de-uso--roles-y-permisos)
9. [Pruebas SAST](#pruebas-sast) — ESLint · npm audit · SonarQube Community
10. [Pruebas DAST](#pruebas-dast) — Script dirigido · OWASP ZAP
11. [Cómo Ejecutar](#cómo-ejecutar)

---

## Enfoque de Seguridad

### 1. Autenticación

La autenticación es un proceso de dos pasos: **verificación de credenciales** seguida de un **segundo factor TOTP** opcional.

#### Paso 1 — Autenticación por contraseña

- Las contraseñas se hashean con **bcrypt** (factor de costo 10) antes de almacenarse. Las contraseñas en texto plano nunca se persisten ni se registran en logs.
- Al iniciar sesión, `bcrypt.compare` realiza una comparación en tiempo constante para prevenir ataques de temporización.

#### Paso 2 — Autenticación Multifactor TOTP (RFC 6238)

- Cualquier usuario puede habilitar **MFA TOTP** desde su panel. Al habilitarlo, el inicio de sesión emite un **token temporal MFA** de corta duración (JWT, TTL de 5 minutos, secreto de firma independiente) en lugar de un token de acceso.
- El cliente debe enviar este token temporal junto con el OTP de 6 dígitos a `POST /api/auth/mfa/verify` para recibir un token de acceso completo.
- Los secretos TOTP se generan mediante **otplib**, se almacenan por usuario en la base de datos, y nunca se exponen después de la configuración inicial salvo a través del flujo del código QR de un solo uso.

#### Tokens de sesión

- Todos los endpoints protegidos utilizan **tokens JWT Bearer** (HS256, TTL de 8 horas).
- Se usan dos secretos de firma distintos: uno para tokens de acceso y otro para tokens temporales MFA, impidiendo que los tokens temporales se usen como tokens de acceso.
- Los tokens se validan en cada solicitud mediante `auth.middleware.js`; un token inválido o expirado retorna inmediatamente `401`.

---

### 2. RBAC — Control de Acceso Basado en Roles

El RBAC controla el acceso a los recursos administrativos (`users`, `roles`, `products`). Las decisiones de acceso se basan únicamente en los **roles** asignados al usuario que realiza la solicitud, no en los atributos del recurso.

#### Modelo de datos

```mermaid
graph LR
    U["users"] -- "asignado via" --> UR["user_roles"]
    UR -- "referencia" --> R["roles"]
    R -- "otorgado via" --> RP["role_permissions"]
    RP -- "referencia" --> P["permissions\n(resource, action)"]
```

Cada `permission` es un par `(resource, action)`. Los recursos son `users`, `roles` y `products`; las acciones son `create`, `read`, `update` y `delete`.

#### Roles predefinidos

Tres roles se configuran automáticamente al inicio. Ver [Roles y Permisos](#roles-y-permisos) para el detalle completo.

| Rol    | users        | roles        | products                  | Total de permisos |
|--------|:------------:|:------------:|:-------------------------:|:-----------------:|
| admin  | CRUD         | CRUD         | CRUD                      | 12                |
| editor | R            | R            | CRU _(sin eliminar)_      | 5                 |
| viewer | R            | R            | R                         | 3                 |

#### Aplicación

El middleware `requirePermission(resource, action)` consulta `user_roles → role_permissions → permissions` en cada solicitud. Si el usuario autenticado no posee ningún rol que otorgue el permiso requerido, la solicitud es rechazada con `403 Forbidden` y un campo `reason` legible por humanos.

---

### 3. ABAC — Control de Acceso Basado en Atributos

El ABAC controla el acceso al dominio de **Producto**. A diferencia del RBAC, las decisiones de acceso combinan atributos de tres fuentes:

| Fuente      | Atributos utilizados                                           |
|-------------|----------------------------------------------------------------|
| **Sujeto**  | `user.roles`, `user.department`, `user.id`                    |
| **Recurso** | `product.department`, `product.ownerId`, `product.status`     |
| **Acción**  | `select`, `insert`, `update`, `delete`                        |

#### Políticas (definidas en `AbacPolicy.js`)

| Acción   | Condición para PERMITIR                                                                        |
|----------|-----------------------------------------------------------------------------------------------|
| `select` | `user.isAdmin()` **O** `user.department === product.department`                               |
| `insert` | `user.isAdmin()` **O** `user.department === "sales"`                                          |
| `update` | `user.isAdmin()` **O** `product.ownerId === user.id`                                          |
| `delete` | `user.isAdmin()` **O** (`product.ownerId === user.id` **Y** `product.status === "draft"`)     |

Cada evaluación de política retorna `{ allow, reason, attributes }`. El campo `reason` y los `attributes` se reenvían al cliente para que la interfaz pueda mostrar una explicación transparente de por qué se concedió o denegó el acceso.

Las solicitudes `select` de usuarios no administradores filtran automáticamente los resultados a los productos que corresponden al departamento del usuario (sin filtración de datos entre departamentos).

---

## Arquitectura

### Arquitectura Hexagonal — Fundamentos

Propuesta por Alistair Cockburn en 2005, la **Arquitectura Hexagonal** (también conocida como *Ports & Adapters*) tiene como objetivo principal desacoplar la lógica de negocio de todos los detalles técnicos externos: bases de datos, frameworks HTTP, librerías de cifrado, servicios de terceros, etc.

La metáfora del hexágono representa que el núcleo de la aplicación puede conectarse con el mundo exterior a través de múltiples «lados» sin favorecer ninguna tecnología en particular. El núcleo es independiente; los adaptadores son intercambiables.

#### Principios aplicados en este proyecto

| Principio | Cómo se aplica |
|---|---|
| **Independencia del framework** | `core/` no importa Express, `pg`, `bcrypt`, `jwt` ni ninguna librería externa |
| **Inversión de dependencias** | Los casos de uso definen qué necesitan (constructor injection); los adaptadores proveen la implementación concreta |
| **Puertos de entrada (driving)** | Los controladores HTTP traducen solicitudes HTTP en llamadas a casos de uso |
| **Puertos de salida (driven)** | Los repositorios y servicios son inyectados en los casos de uso; el núcleo nunca los instancia directamente |
| **Regla de dependencias** | Las flechas de `import` apuntan siempre hacia adentro: `adapters → core/usecases → core/domain` |
| **Raíz de composición única** | `app.js` es el único lugar donde se instancian y ensamblan todos los componentes |
| **Testabilidad** | El núcleo puede probarse con mocks simples sin levantar base de datos ni servidor HTTP |

#### Regla de dependencias — dirección de los imports

```mermaid
graph LR
    A["adapters/driving\n(HTTP, controllers)"]
    B["adapters/driven\n(Pg repos, services)"]
    C["core/usecases\n(casos de uso)"]
    D["core/domain\n(entidades, políticas)"]

    A -->|"importa"| C
    B -->|"implementa interfaces de"| C
    C -->|"usa"| D

    style D fill:#16a34a22,stroke:#16a34a
    style C fill:#0284c722,stroke:#0284c7
    style A fill:#7c3aed22,stroke:#7c3aed
    style B fill:#f59e0b22,stroke:#f59e0b
```

> `core/domain` no importa nada. `core/usecases` solo importa de `core/domain`. Los adaptadores importan del núcleo, nunca al revés.

---

### Las cuatro capas del proyecto

#### 1. Capa de Dominio — `api/src/core/domain/`

Es el núcleo más interno. Contiene la lógica de negocio pura, sin ninguna dependencia externa.

| Archivo | Qué es | Por qué en el dominio |
|---|---|---|
| `User.js` | Entidad con métodos `isAdmin()`, `hasRole()`, `toPublic()` | Encapsula las reglas de identidad del usuario |
| `Product.js` | Entidad con `isOwnedBy()`, `isDraft()` | Encapsula las reglas de un producto |
| `AbacPolicy.js` | Evaluador ABAC sin estado | Lógica de autorización pura: dado un usuario, una acción y un producto, decide si se permite |
| `errors.js` | `DomainError`, `NotFoundError`, `ForbiddenError`, `ConflictError`, `UnauthorizedError` | Tipos de error semánticos, independientes de HTTP |

**Principio clave:** si se reemplaza PostgreSQL por MongoDB, o Express por Fastify, esta capa no cambia en absoluto.

#### 2. Capa de Aplicación (Casos de Uso) — `api/src/core/usecases/`

Orquesta los objetos de dominio y los puertos de salida para implementar los flujos de negocio. Cada clase recibe todas sus dependencias por constructor.

| Archivo | Responsabilidad |
|---|---|
| `auth/LoginUseCase.js` | Verifica credenciales, decide si emitir token de acceso o token MFA temporal |
| `auth/VerifyMfaUseCase.js` | Valida el token MFA temporal y el código TOTP; emite token de acceso |
| `auth/SetupMfaUseCase.js` | Genera secreto TOTP y código QR; almacena secreto pendiente de confirmación |
| `auth/EnableMfaUseCase.js` | Confirma el código OTP y activa MFA para el usuario |
| `auth/DisableMfaUseCase.js` | Confirma el código OTP y desactiva MFA |
| `UserService.js` | CRUD de usuarios + asignación/revocación de roles |
| `RoleService.js` | CRUD de roles |
| `ProductService.js` | CRUD de productos; invoca `AbacPolicy` en cada mutación antes de ejecutar |

**Principio clave:** los casos de uso no saben si son llamados desde HTTP, CLI o un test. Solo conocen entidades de dominio e interfaces de puertos.

#### 3. Adaptadores Driving (primarios) — `api/src/adapters/driving/http/`

Son el punto de entrada HTTP. Traducen solicitudes HTTP en llamadas a casos de uso y respuestas de dominio en respuestas HTTP.

```
driving/http/
├── middleware/
│   ├── auth.middleware.js    ← verifica JWT, adjunta req.user
│   └── rbac.middleware.js    ← consulta role_permissions, retorna 403 si falta permiso
├── controllers/
│   ├── auth.controller.js    ← delega en los 5 casos de uso de auth
│   ├── user.controller.js    ← delega en UserService
│   ├── role.controller.js    ← delega en RoleService
│   └── product.controller.js ← delega en ProductService; mapea ForbiddenError → 403
└── routes/
    ├── auth.routes.js        ← define los 6 endpoints de auth
    ├── user.routes.js        ← define los 8 endpoints de users con middleware RBAC
    ├── role.routes.js        ← define los 6 endpoints de roles con middleware RBAC
    └── product.routes.js     ← define los 5 endpoints de products (ABAC en servicio)
```

**Principio clave:** los controladores son deliberadamente delgados. No contienen lógica de negocio; solo traducen entre HTTP y el núcleo.

#### 4. Adaptadores Driven (secundarios) — `api/src/adapters/driven/`

Son las implementaciones concretas de los «puertos de salida». El núcleo los recibe inyectados y nunca sabe si se trata de PostgreSQL, SQLite u otro.

```
driven/
├── persistence/
│   ├── db.js                   ← pool de conexiones pg
│   ├── schema.js               ← DDL (CREATE TABLE IF NOT EXISTS)
│   ├── seed.js                 ← datos iniciales (roles, permisos, 3 usuarios, 3 productos)
│   ├── PgUserRepository.js     ← implementa las operaciones de users sobre PostgreSQL
│   ├── PgRoleRepository.js     ← implementa las operaciones de roles sobre PostgreSQL
│   └── PgProductRepository.js  ← implementa las operaciones de products sobre PostgreSQL
└── services/
    ├── JwtTokenService.js       ← firma y verifica tokens JWT (acceso + MFA temporal)
    ├── BcryptPasswordService.js ← hash y comparación de contraseñas con bcrypt
    └── OtplibTotpService.js     ← genera secretos TOTP y valida códigos OTP (RFC 6238)
```

**Principio clave:** si se necesita migrar de PostgreSQL a otro motor, solo se cambian los archivos de este directorio. Los casos de uso no se modifican.

#### 5. Raíz de composición — `api/app.js`

Es el único lugar en todo el proyecto donde se instancian los adaptadores concretos y se inyectan en los casos de uso. Es el «mapa del cableado».

```
createApp()
 ├── initSchema()           → crea tablas si no existen
 ├── seed()                 → inserta datos iniciales si la BD está vacía
 ├── new PgUserRepository() ──┐
 ├── new PgRoleRepository()   │ adaptadores driven
 ├── new PgProductRepository()│
 ├── new JwtTokenService()    │
 ├── new BcryptPasswordService│
 ├── new OtplibTotpService() ─┘
 ├── new LoginUseCase({ userRepository, passwordService, tokenService })
 ├── new UserService({ userRepository, roleRepository, passwordService })
 ├── ...                    → inyecta repos y servicios en cada caso de uso
 └── express()              → monta rutas con controladores y middleware
```

---

### Diagrama de flujo de una solicitud

```mermaid
sequenceDiagram
    participant C as Cliente HTTP
    participant MW as Middleware
    participant CTRL as Controller
    participant UC as Caso de Uso
    participant DOM as Dominio
    participant REPO as Repositorio Pg

    C->>MW: POST /api/products { ... }
    MW->>MW: auth.middleware verifica JWT
    MW->>CTRL: req.user adjunto
    CTRL->>UC: productService.createProduct(user, data)
    UC->>DOM: AbacPolicy.evaluateProduct(user, "insert")
    DOM-->>UC: { allow: true, reason: "..." }
    UC->>REPO: productRepository.create(data)
    REPO-->>UC: Product entity
    UC-->>CTRL: { product, evaluation }
    CTRL-->>C: 201 { product, evaluation }
```

---

### Diagrama de Componentes

```mermaid
graph TB
    subgraph Browser["Navegador — React SPA"]
        LoginPg["LoginPage\n(autenticación 2 pasos)"]
        DashPg["DashboardPage\n(gestor MFA)"]
        RBACPg["RBACPage\n(Usuarios · Roles · Asignaciones)\n— solo admin"]
        RBACProdPg["ProductsRBACPage\n(Products RBAC)\n— todos los usuarios"]
        ProdPg["ProductsPage\n(demo ABAC)"]
    end

    subgraph API["API — Node.js / Express"]
        subgraph Driving["Adaptadores Driving (HTTP)"]
            Routes["Rutas"]
            Ctrl["Controladores\n(auth · user · role · product)"]
            AuthMW["auth.middleware\n(verificación JWT)"]
            RbacMW["rbac.middleware\n(verificación de permiso)"]
        end

        subgraph Core["Núcleo — Hexágono"]
            subgraph App["Capa de Aplicación"]
                AuthUC["Casos de Uso Auth\nLogin · MFA ×4"]
                UserSvc["UserService"]
                RoleSvc["RoleService"]
                ProdSvc["ProductService\n+ AbacPolicy"]
            end
            subgraph Domain["Capa de Dominio"]
                UserE["Entidad User"]
                ProdE["Entidad Product"]
                ABAC["AbacPolicy\n(lógica pura)"]
            end
        end

        subgraph Driven["Adaptadores Driven"]
            PgRepos["Repositorios Pg\nUser · Role · Product"]
            JwtSvc["JwtTokenService\n(access + mfa temp)"]
            BcryptSvc["BcryptPasswordService"]
            TotpSvc["OtplibTotpService\n(RFC 6238)"]
        end
    end

    DB[("PostgreSQL 16")]

    RBACProdPg -->|"HTTP / JSON"| Routes
    Browser -->|"HTTP / JSON"| Routes
    Routes --> AuthMW
    Routes --> RbacMW
    Routes --> Ctrl
    Ctrl --> AuthUC
    Ctrl --> UserSvc
    Ctrl --> RoleSvc
    Ctrl --> ProdSvc
    AuthUC --> UserE
    ProdSvc --> ABAC
    ABAC --> ProdE
    AuthUC & UserSvc & RoleSvc & ProdSvc --> PgRepos
    AuthUC --> JwtSvc & BcryptSvc & TotpSvc
    PgRepos --> DB
```

---

### Arquitectura del Frontend — Feature-Sliced

El frontend usa una estructura **orientada a features** (vertical slices). Cada dominio funcional tiene su propia carpeta con páginas, componentes y hooks, evitando acoplamientos horizontales entre features.

#### Principios aplicados

| Principio | Aplicación |
|---|---|
| **Separación hooks / UI** | Los hooks (`useLogin`, `useProducts`, etc.) encapsulan toda la lógica de estado y peticiones HTTP. Los componentes solo renderizan. |
| **Un hook por dominio** | Cada feature expone un único hook de datos que centraliza el estado, el loading y el error. |
| **Shared por capas** | Los elementos reutilizables (`Layout`, `Modal`, `AuthContext`) viven en `shared/`, separados de las features. |
| **Contexto mínimo** | `AuthContext` almacena solo lo imprescindible: el usuario y las funciones de sesión. |
| **Interceptor global** | El cliente Axios agrega el token JWT automáticamente y redirige al login en cualquier `401`. |

---

### Estructura de carpetas completa

```
tarea-seguridad/
│
├── docker-compose.yml          ← orquesta db, api y web en Docker
│
├── api/                        ← API Node.js / Express
│   ├── Dockerfile              ← imagen de producción (node:22-alpine, 2 etapas)
│   ├── .dockerignore
│   ├── .env                    ← variables de entorno (no commitear)
│   ├── package.json
│   ├── index.js                ← punto de entrada: llama createApp() y levanta el servidor
│   ├── app.js                  ← raíz de composición DI: instancia y cablea todos los componentes
│   │
│   └── src/
│       ├── core/               ← EL HEXÁGONO — cero dependencias externas
│       │   ├── domain/         ← lógica de negocio pura
│       │   │   ├── User.js             entidad usuario (isAdmin, hasRole, toPublic)
│       │   │   ├── Product.js          entidad producto (isOwnedBy, isDraft)
│       │   │   ├── AbacPolicy.js       evaluador ABAC: user × action × product → {allow, reason}
│       │   │   └── errors.js           errores de dominio tipados con statusCode
│       │   │
│       │   └── usecases/       ← casos de uso: orquestan dominio + puertos
│       │       ├── auth/
│       │       │   ├── LoginUseCase.js         credenciales → token o tempToken MFA
│       │       │   ├── VerifyMfaUseCase.js      tempToken + OTP → token de acceso
│       │       │   ├── SetupMfaUseCase.js       genera secreto TOTP y código QR
│       │       │   ├── EnableMfaUseCase.js      confirma OTP y activa MFA
│       │       │   └── DisableMfaUseCase.js     confirma OTP y desactiva MFA
│       │       ├── UserService.js       CRUD usuarios + asignación/revocación de roles; soporta cambio de contraseña en update
│       │       ├── RoleService.js       CRUD roles + assignPermission / removePermission
│       │       └── ProductService.js   CRUD productos + invoca AbacPolicy en mutaciones
│       │
│       └── adapters/           ← implementaciones concretas (intercambiables)
│           │
│           ├── driven/         ← adaptadores de salida (el núcleo los llama)
│           │   ├── persistence/
│           │   │   ├── db.js                   pool de conexiones pg (pg.Pool)
│           │   │   ├── schema.js               DDL: CREATE TABLE IF NOT EXISTS
│           │   │   ├── seed.js                 datos iniciales: roles, permisos, 3 usuarios, 3 productos
│           │   │   ├── PgUserRepository.js     operaciones SQL sobre tabla users
│           │   │   ├── PgRoleRepository.js     operaciones SQL sobre tabla roles + permissions
│           │   │   └── PgProductRepository.js  operaciones SQL sobre tabla products
│           │   └── services/
│           │       ├── JwtTokenService.js      firma/verifica access token (8h) y mfa temp token (5m)
│           │       ├── BcryptPasswordService.js hash y compare de contraseñas
│           │       └── OtplibTotpService.js    genera secretos, QR codes y verifica OTP (RFC 6238)
│           │
│           └── driving/        ← adaptadores de entrada (llaman al núcleo)
│               └── http/
│                   ├── middleware/
│                   │   ├── auth.middleware.js   verifica JWT → adjunta req.user o retorna 401
│                   │   └── rbac.middleware.js   consulta role_permissions → retorna 403 si falta permiso
│                   ├── controllers/
│                   │   ├── auth.controller.js        delega en los 5 casos de uso de autenticación
│                   │   ├── user.controller.js        delega en UserService, mapea a HTTP
│                   │   ├── role.controller.js        delega en RoleService; incluye asignar/revocar permisos
│                   │   ├── product.controller.js     delega en ProductService (ABAC); captura ForbiddenError → 403
│                   │   └── rbac-product.controller.js CRUD directo al repositorio sin ABAC (solo RBAC)
│                   └── routes/
│                       ├── auth.routes.js            6 endpoints de autenticación y MFA
│                       ├── user.routes.js            8 endpoints de usuarios con guards RBAC
│                       ├── role.routes.js            8 endpoints de roles con guards RBAC (+ 2 de permisos)
│                       ├── product.routes.js         5 endpoints de productos con ABAC
│                       └── rbac-product.routes.js    4 endpoints /api/rbac/products con requirePermission
│
└── web/                        ← SPA React 18 + Vite 5
    ├── Dockerfile              ← imagen producción: vite build → nginx:1.27-alpine
    ├── .dockerignore
    ├── nginx.conf              ← proxy /api → api:4000, SPA fallback a index.html
    ├── package.json
    ├── vite.config.js          ← proxy de desarrollo /api → localhost:4000
    ├── index.html
    │
    └── src/
        ├── main.jsx            ← punto de entrada React (StrictMode)
        ├── App.jsx             ← router principal con rutas protegidas
        ├── index.css           ← design tokens CSS, estilos globales
        │
        ├── api/
        │   └── client.js       ← instancia Axios: agrega JWT, maneja 401 globalmente
        │
        ├── shared/             ← elementos reutilizables entre features
        │   ├── context/
        │   │   └── AuthContext.jsx    estado de sesión global (user, login, logout, refreshUser)
        │   └── components/
        │       ├── Layout.jsx         sidebar: admin ve RBAC Management + Products (RBAC); otros usuarios ven solo Products (RBAC)
        │       ├── ProtectedRoute.jsx redirige a / si no hay sesión activa
        │       └── Modal.jsx          modal accesible con cierre por Escape
        │
        └── features/           ← vertical slices por dominio funcional
            │
            ├── auth/           ← autenticación (login + MFA)
            │   ├── hooks/
            │   │   └── useLogin.js      máquina de estados: credentials → mfa → autenticado
            │   └── pages/
            │       └── LoginPage.jsx    formulario 2 pasos + credenciales de demo
            │
            ├── dashboard/      ← panel principal del usuario
            │   ├── pages/
            │   │   └── DashboardPage.jsx  perfil + resumen de arquitectura
            │   └── components/
            │       └── MfaManager.jsx    flujo completo de setup/enable/disable MFA
            │
            ├── rbac/           ← gestión RBAC (admin) + prueba de permisos (todos los usuarios)
            │   ├── hooks/
            │   │   ├── useUsers.js        CRUD usuarios + assignRole/removeRole; estado local sincronizado
            │   │   ├── useRoles.js        CRUD roles + assignPermission/removePermission; carga allPermissions
            │   │   └── useRbacProducts.js CRUD productos vía /api/rbac/products; detecta 403 (denied)
            │   ├── pages/
            │   │   ├── RBACPage.jsx          pestañas Usuarios/Roles/Asignaciones — solo admin
            │   │   └── ProductsRBACPage.jsx  página /products-rbac — accesible a todos los usuarios
            │   └── components/
            │       ├── UsersTab.jsx          CRUD usuarios; botón "Gestionar" abre modal de roles con toggle inmediato
            │       ├── RolesTab.jsx          CRUD roles; expandir fila muestra matriz interactiva de permisos
            │       ├── AssignmentsTab.jsx    matriz interactiva usuario × rol
            │       └── ProductsRBACTab.jsx   CRUD productos controlado por RBAC + panel de permisos efectivos
            │
            └── products/       ← dominio de productos con demo ABAC
                ├── hooks/
                │   └── useProducts.js   obtiene lista + vista previa ABAC en paralelo
                ├── pages/
                │   └── ProductsPage.jsx  tabla con botones deshabilitados según ABAC + motivo de denegación
                └── components/
                    └── PolicyExplainer.jsx  badge allow/deny con el reason de la política ABAC
```

---

## Módulos

### API — `api/`

| Ruta | Responsabilidad |
|------|----------------|
| `index.js` | Punto de entrada — espera `createApp()` e inicia el servidor HTTP |
| `app.js` | **Raíz de composición DI** — instancia todos los adaptadores, conecta casos de uso y rutas |
| `src/core/domain/` | Objetos de dominio sin dependencias de framework |
| `src/core/domain/User.js` | Entidad User con `isAdmin()`, `hasRole()`, `toPublic()` |
| `src/core/domain/Product.js` | Entidad Product con `isOwnedBy()`, `isDraft()` |
| `src/core/domain/AbacPolicy.js` | Evaluador ABAC sin estado — retorna `{ allow, reason, attributes }` |
| `src/core/domain/errors.js` | Errores de dominio tipados (`NotFoundError`, `ForbiddenError`, etc.) |
| `src/core/usecases/auth/` | Una clase por caso de uso de autenticación (Login, VerifyMfa, SetupMfa, EnableMfa, DisableMfa) |
| `src/core/usecases/UserService.js` | CRUD usuarios + asignación/revocación de roles; `updateUser` acepta contraseña opcional |
| `src/core/usecases/RoleService.js` | CRUD roles + `assignPermission` / `removePermission` |
| `src/core/usecases/ProductService.js` | CRUD productos con evaluación ABAC en cada mutación |
| `src/adapters/driven/persistence/` | Repositorios PostgreSQL (`PgUserRepository`, `PgRoleRepository`, `PgProductRepository`) |
| `src/adapters/driven/services/` | Servicios JWT, bcrypt y TOTP |
| `src/adapters/driving/http/middleware/` | `auth.middleware` (JWT), `rbac.middleware` (consulta de permisos) |
| `src/adapters/driving/http/controllers/auth.controller.js` | Login, MFA ×4, /me |
| `src/adapters/driving/http/controllers/user.controller.js` | CRUD usuarios + gestión de roles por usuario |
| `src/adapters/driving/http/controllers/role.controller.js` | CRUD roles + asignación/revocación de permisos en roles |
| `src/adapters/driving/http/controllers/product.controller.js` | CRUD productos con ABAC |
| `src/adapters/driving/http/controllers/rbac-product.controller.js` | CRUD productos con RBAC puro (sin ABAC) |
| `src/adapters/driving/http/routes/rbac-product.routes.js` | Rutas `/api/rbac/products` — acceso por `requirePermission` |

### Web — `web/`

| Ruta | Responsabilidad |
|------|----------------|
| `src/api/client.js` | Instancia Axios — agrega cabecera `Authorization`, maneja 401 globalmente |
| `src/shared/context/AuthContext.jsx` | Contexto React — almacena estado del usuario, expone `login`, `logout`, `refreshUser` |
| `src/shared/components/Layout.jsx` | Navegación lateral con enlaces condicionales por rol |
| `src/shared/components/ProtectedRoute.jsx` | Redirige usuarios no autenticados a `/` |
| `src/shared/components/Modal.jsx` | Modal accesible con cierre por tecla Escape |
| `src/features/auth/hooks/useLogin.js` | Encapsula la máquina de estados del inicio de sesión en 2 pasos |
| `src/features/auth/pages/LoginPage.jsx` | Formulario de credenciales → formulario OTP; clic para rellenar credenciales de demo |
| `src/features/dashboard/pages/DashboardPage.jsx` | Información del perfil + resumen de arquitectura |
| `src/features/dashboard/components/MfaManager.jsx` | Configuración con código QR, habilitación y deshabilitación de MFA |
| `src/features/rbac/hooks/useUsers.js` | CRUD usuarios + `assignRole` / `removeRole`; estado local sincronizado |
| `src/features/rbac/hooks/useRoles.js` | CRUD roles + `assignPermission` / `removePermission`; carga `allPermissions` en paralelo |
| `src/features/rbac/hooks/useRbacProducts.js` | CRUD productos vía `/api/rbac/products`; detecta `denied` (403) |
| `src/features/rbac/pages/RBACPage.jsx` | Pestañas Usuarios / Roles / Asignaciones — solo admin |
| `src/features/rbac/pages/ProductsRBACPage.jsx` | Página `/products-rbac` — accesible a todos los usuarios autenticados |
| `src/features/rbac/components/UsersTab.jsx` | CRUD usuarios; botón **Gestionar** abre `RoleManagerModal` con toggle inmediato por rol |
| `src/features/rbac/components/RolesTab.jsx` | CRUD roles; al expandir muestra **matriz interactiva** de permisos (recurso × acción) |
| `src/features/rbac/components/AssignmentsTab.jsx` | Matriz usuario × rol con toggle inmediato |
| `src/features/rbac/components/ProductsRBACTab.jsx` | Tabla de productos con panel de permisos efectivos del usuario; CRUD según rol |
| `src/features/products/hooks/useProducts.js` | Obtiene productos y vista previa ABAC en paralelo |
| `src/features/products/pages/ProductsPage.jsx` | Tabla de productos con control ABAC; muestra motivo de denegación por atributo |
| `src/features/products/components/PolicyExplainer.jsx` | Badge allow/deny con reason de la política ABAC |

---

## Esquema de Base de Datos

```mermaid
erDiagram
    users {
        serial      id PK
        text        email UK
        text        password_hash
        text        mfa_secret
        boolean     mfa_enabled
        text        department
        timestamptz created_at
    }
    roles {
        serial id PK
        text   name UK
        text   description
    }
    permissions {
        serial id PK
        text   resource
        text   action
    }
    role_permissions {
        integer role_id       FK
        integer permission_id FK
    }
    user_roles {
        integer user_id FK
        integer role_id FK
    }
    products {
        serial      id PK
        text        name
        text        description
        text        status
        integer     owner_id FK
        text        department
        numeric     price
        timestamptz created_at
    }

    users        ||--o{ user_roles       : "asignado"
    roles        ||--o{ user_roles       : "asignado a"
    roles        ||--o{ role_permissions : "otorga"
    permissions  ||--o{ role_permissions : "otorgado via"
    users        ||--o{ products         : "posee"
```

---

## Referencia de la API

Todos los endpoints protegidos requieren `Authorization: Bearer <token>`.  
Los endpoints protegidos por RBAC retornan `403` si los roles del usuario carecen del permiso requerido.  
Los endpoints protegidos por ABAC retornan `403 { error, reason }` con una explicación derivada del evaluador de políticas.

### Autenticación

| Método | Endpoint | Auth | Cuerpo | Descripción |
|--------|----------|------|--------|-------------|
| `POST` | `/api/auth/login` | — | `{ email, password }` | Inicio de sesión. Retorna `{ token, user }` o `{ mfaRequired: true, tempToken }` |
| `POST` | `/api/auth/mfa/verify` | — | `{ tempToken, code }` | Verifica código TOTP; retorna `{ token, user }` |
| `GET`  | `/api/auth/mfa/setup` | JWT | — | Genera secreto TOTP y URL del código QR |
| `POST` | `/api/auth/mfa/enable` | JWT | `{ code }` | Confirma OTP y activa MFA |
| `POST` | `/api/auth/mfa/disable` | JWT | `{ code }` | Confirma OTP y desactiva MFA |
| `GET`  | `/api/auth/me` | JWT | — | Retorna el perfil del usuario actual |

### Usuarios (RBAC)

| Método | Endpoint | Permiso | Cuerpo | Descripción |
|--------|----------|---------|--------|-------------|
| `GET`    | `/api/users` | `users:read` | — | Listar todos los usuarios |
| `POST`   | `/api/users` | `users:create` | `{ email, password, department, roleIds? }` | Crear usuario |
| `GET`    | `/api/users/:id` | `users:read` | — | Obtener usuario por ID |
| `PUT`    | `/api/users/:id` | `users:update` | `{ email?, department? }` | Actualizar usuario |
| `DELETE` | `/api/users/:id` | `users:delete` | — | Eliminar usuario |
| `GET`    | `/api/users/:id/roles` | `users:read` | — | Listar roles asignados al usuario |
| `POST`   | `/api/users/:id/roles` | `users:update` | `{ roleId }` | Asignar rol al usuario |
| `DELETE` | `/api/users/:id/roles/:roleId` | `users:update` | — | Quitar rol del usuario |

### Roles (RBAC)

| Método | Endpoint | Permiso | Cuerpo | Descripción |
|--------|----------|---------|--------|-------------|
| `GET`    | `/api/roles` | `roles:read` | — | Listar todos los roles con sus permisos |
| `POST`   | `/api/roles` | `roles:create` | `{ name, description? }` | Crear rol |
| `GET`    | `/api/roles/:id` | `roles:read` | — | Obtener rol por ID |
| `PUT`    | `/api/roles/:id` | `roles:update` | `{ name?, description? }` | Actualizar rol |
| `DELETE` | `/api/roles/:id` | `roles:delete` | — | Eliminar rol |
| `GET`    | `/api/roles/permissions` | `roles:read` | — | Listar todos los permisos disponibles |
| `POST`   | `/api/roles/:id/permissions` | `roles:update` | `{ permissionId }` | Asignar un permiso al rol |
| `DELETE` | `/api/roles/:id/permissions/:permId` | `roles:update` | — | Revocar un permiso del rol |

### Productos (RBAC)

Acceso controlado únicamente por el rol del usuario — sin filtro de departamento ni verificación de propiedad. Todos los usuarios autenticados pueden acceder; las operaciones se habilitan según los permisos RBAC asignados.

| Método | Endpoint | Permiso | Cuerpo | Descripción |
|--------|----------|---------|--------|-------------|
| `GET`    | `/api/rbac/products` | `products:read` | — | Listar **todos** los productos (sin filtro de departamento) |
| `POST`   | `/api/rbac/products` | `products:create` | `{ name, description?, status?, department?, price? }` | Crear producto |
| `PUT`    | `/api/rbac/products/:id` | `products:update` | `{ name?, description?, status?, price? }` | Actualizar producto |
| `DELETE` | `/api/rbac/products/:id` | `products:delete` | — | Eliminar producto |

### Productos (ABAC)

| Método | Endpoint | Política ABAC | Cuerpo | Descripción |
|--------|----------|---------------|--------|-------------|
| `GET`    | `/api/products` | `select` | — | Listar productos (no admin: filtrado por departamento del usuario) |
| `GET`    | `/api/products/abac-preview` | — | — | Matriz de evaluación de políticas para todos los productos × usuario actual |
| `POST`   | `/api/products` | `insert` | `{ name, description?, status?, department?, price? }` | Crear producto |
| `PUT`    | `/api/products/:id` | `update` | `{ name?, description?, status?, price? }` | Actualizar producto |
| `DELETE` | `/api/products/:id` | `delete` | — | Eliminar producto |

---

## Diagramas de Secuencia

### Inicio de Sesión — Solo Contraseña

```mermaid
sequenceDiagram
    actor U as Usuario
    participant W as React SPA
    participant A as API
    participant DB as PostgreSQL

    U->>W: Ingresa email + contraseña
    W->>A: POST /api/auth/login
    A->>DB: SELECT * FROM users WHERE email = $1
    DB-->>A: fila usuario (mfa_enabled = false)
    A->>A: bcrypt.compare(password, hash)
    A-->>W: 200 { token, user }
    W->>W: Guarda JWT en localStorage
    W-->>U: Redirige → /dashboard
```

### Inicio de Sesión — Con MFA

```mermaid
sequenceDiagram
    actor U as Usuario
    participant W as React SPA
    participant A as API
    participant DB as PostgreSQL
    participant OTP as App Autenticadora

    U->>W: Ingresa email + contraseña
    W->>A: POST /api/auth/login
    A->>DB: SELECT user WHERE email = $1
    DB-->>A: fila usuario (mfa_enabled = true)
    A->>A: bcrypt.compare(password, hash) ✓
    A->>A: firma token temporal MFA (TTL 5 min)
    A-->>W: 200 { mfaRequired: true, tempToken }
    W-->>U: Muestra campo de ingreso OTP

    U->>OTP: Lee código de 6 dígitos
    OTP-->>U: 123456
    U->>W: Envía código
    W->>A: POST /api/auth/mfa/verify { tempToken, code }
    A->>A: jwt.verify(tempToken, MFA_SECRET)
    A->>DB: SELECT mfa_secret WHERE id = $1
    DB-->>A: mfa_secret
    A->>A: authenticator.verify(code, secret)
    A->>A: firma token de acceso (TTL 8 h)
    A-->>W: 200 { token, user }
    W->>W: Guarda JWT en localStorage
    W-->>U: Redirige → /dashboard
```

### Configuración y Habilitación de MFA

```mermaid
sequenceDiagram
    actor U as Usuario
    participant W as React SPA
    participant A as API
    participant DB as PostgreSQL
    participant OTP as App Autenticadora

    U->>W: Clic en "Habilitar MFA"
    W->>A: GET /api/auth/mfa/setup
    A->>A: authenticator.generateSecret()
    A->>A: QRCode.toDataURL(otpUri)
    A->>DB: UPDATE users SET mfa_secret = $1
    A-->>W: { secret, qrCodeUrl }
    W-->>U: Muestra imagen del código QR

    U->>OTP: Escanea código QR
    OTP-->>U: Cuenta agregada, muestra código TOTP
    U->>W: Ingresa código de 6 dígitos para confirmar
    W->>A: POST /api/auth/mfa/enable { code }
    A->>DB: SELECT mfa_secret WHERE id = $1
    A->>A: authenticator.verify(code, secret)
    A->>DB: UPDATE users SET mfa_enabled = true
    A-->>W: 200 { message: "MFA enabled" }
    W-->>U: MFA ahora está activo
```

### Flujo de Autorización RBAC

```mermaid
sequenceDiagram
    actor U as Usuario
    participant W as React SPA
    participant A as API
    participant AM as auth.middleware
    participant RM as rbac.middleware
    participant C as Controlador
    participant DB as PostgreSQL

    U->>W: Acción (ej. eliminar usuario)
    W->>A: DELETE /api/users/3\nAuthorization: Bearer <token>
    A->>AM: Verifica JWT
    AM->>DB: SELECT user WHERE id = sub
    DB-->>AM: usuario + roles
    AM-->>A: req.user = { id, roles, department }

    A->>RM: requirePermission("users", "delete")
    RM->>DB: SELECT COUNT(*) FROM user_roles\nJOIN role_permissions JOIN permissions\nWHERE user_id=$1 AND resource=$2 AND action=$3
    alt permiso concedido (cnt > 0)
        RM-->>A: next()
        A->>C: deleteUser(id)
        C-->>W: 204 No Content
    else permiso denegado (cnt = 0)
        RM-->>W: 403 { error: "Forbidden", reason: "..." }
    end
```

### Evaluación de Política ABAC

```mermaid
flowchart TD
    REQ["Solicitud entrante\n(usuario autenticado + producto)"]
    EVAL["AbacPolicy.evaluateProduct\nusuario × acción × producto"]

    REQ --> EVAL

    EVAL --> A_SELECT{acción = select?}
    A_SELECT -->|admin| ALLOW_S["✓ PERMITIR\nAdmin sin restricciones de lectura"]
    A_SELECT -->|user.dept === product.dept| ALLOW_S2["✓ PERMITIR\ndepartamentos coinciden"]
    A_SELECT -->|no coinciden| DENY_S["✗ DENEGAR\ndepartamentos no coinciden"]

    EVAL --> A_INSERT{acción = insert?}
    A_INSERT -->|admin| ALLOW_I["✓ PERMITIR\nAdmin puede crear"]
    A_INSERT -->|user.dept = sales| ALLOW_I2["✓ PERMITIR\ndepartamento ventas"]
    A_INSERT -->|otro depto| DENY_I["✗ DENEGAR\nno es ventas/admin"]

    EVAL --> A_UPDATE{acción = update?}
    A_UPDATE -->|admin| ALLOW_U["✓ PERMITIR\nAdmin puede actualizar"]
    A_UPDATE -->|user.id = ownerId| ALLOW_U2["✓ PERMITIR\nes el propietario"]
    A_UPDATE -->|otro| DENY_U["✗ DENEGAR\nno es propietario/admin"]

    EVAL --> A_DELETE{acción = delete?}
    A_DELETE -->|admin| ALLOW_D["✓ PERMITIR\nAdmin puede eliminar"]
    A_DELETE -->|propietario + borrador| ALLOW_D2["✓ PERMITIR\npropietario y estado borrador"]
    A_DELETE -->|propietario + publicado| DENY_D1["✗ DENEGAR\nestado no es borrador"]
    A_DELETE -->|no es propietario| DENY_D2["✗ DENEGAR\nno es propietario/admin"]

    style ALLOW_S  fill:#16a34a22,stroke:#16a34a
    style ALLOW_S2 fill:#16a34a22,stroke:#16a34a
    style ALLOW_I  fill:#16a34a22,stroke:#16a34a
    style ALLOW_I2 fill:#16a34a22,stroke:#16a34a
    style ALLOW_U  fill:#16a34a22,stroke:#16a34a
    style ALLOW_U2 fill:#16a34a22,stroke:#16a34a
    style ALLOW_D  fill:#16a34a22,stroke:#16a34a
    style ALLOW_D2 fill:#16a34a22,stroke:#16a34a
    style DENY_S   fill:#dc262622,stroke:#dc2626
    style DENY_I   fill:#dc262622,stroke:#dc2626
    style DENY_U   fill:#dc262622,stroke:#dc2626
    style DENY_D1  fill:#dc262622,stroke:#dc2626
    style DENY_D2  fill:#dc262622,stroke:#dc2626
```

---

## Roles y Permisos

Tres roles se insertan automáticamente cuando la aplicación inicia por primera vez. Los roles se almacenan en la tabla `roles` y se vinculan a usuarios mediante `user_roles`. Cada rol contiene un conjunto de pares `(resource, action)` almacenados en `permissions` y vinculados mediante `role_permissions`.

### Descripción de roles

#### `admin` — Acceso total al sistema · 12 permisos

Posee todos los permisos sobre todos los recursos. Es el único rol autorizado para:

- **Crear, actualizar y eliminar usuarios** — gestiona quién tiene acceso al sistema.
- **Crear, actualizar y eliminar roles** — gestiona qué niveles de acceso existen.
- **Eliminar productos** — la política ABAC de eliminación se evalúa igualmente, pero admin siempre la satisface.

Asignado a: `admin@demo.com`

---

#### `editor` — Gestor de contenido · 5 permisos

Diseñado para miembros de un departamento que administran datos de productos pero no deben gestionar la configuración del sistema.

| Recurso    | crear | leer | actualizar | eliminar | Notas |
|------------|:-----:|:----:|:----------:|:--------:|-------|
| `users`    | ✗     | ✓    | ✗          | ✗        | Puede ver la lista de usuarios pero no modificarlos |
| `roles`    | ✗     | ✓    | ✗          | ✗        | Puede ver las definiciones de roles pero no cambiarlos |
| `products` | ✓     | ✓    | ✓          | ✗        | Puede gestionar productos — restringido además por ABAC |

> Aunque un editor posee `products:update`, la capa ABAC aplica igualmente las reglas de propiedad. Un editor solo puede actualizar los productos que le pertenecen.

Asignado a: `alice@demo.com` (departamento: sales)

---

#### `viewer` — Observador de solo lectura · 3 permisos

Otorga acceso de lectura a todos los recursos y nada más. Adecuado para partes interesadas que necesitan visibilidad sin capacidad de modificar nada.

| Recurso    | crear | leer | actualizar | eliminar |
|------------|:-----:|:----:|:----------:|:--------:|
| `users`    | ✗     | ✓    | ✗          | ✗        |
| `roles`    | ✗     | ✓    | ✗          | ✗        |
| `products` | ✗     | ✓    | ✗          | ✗        |

> En productos, también se aplica la política ABAC SELECT: un viewer solo ve los productos pertenecientes a su departamento.

Asignado a: `bob@demo.com` (departamento: marketing)

---

### Matriz de permisos completa

| Permiso            | admin | editor | viewer |
|--------------------|:-----:|:------:|:------:|
| `users:create`     | ✓     | ✗      | ✗      |
| `users:read`       | ✓     | ✓      | ✓      |
| `users:update`     | ✓     | ✗      | ✗      |
| `users:delete`     | ✓     | ✗      | ✗      |
| `roles:create`     | ✓     | ✗      | ✗      |
| `roles:read`       | ✓     | ✓      | ✓      |
| `roles:update`     | ✓     | ✗      | ✗      |
| `roles:delete`     | ✓     | ✗      | ✗      |
| `products:create`  | ✓     | ✓      | ✗      |
| `products:read`    | ✓     | ✓      | ✓      |
| `products:update`  | ✓     | ✓      | ✗      |
| `products:delete`  | ✓     | ✗      | ✗      |
| **Total**          | **12**| **5**  | **3**  |

### Diagrama Rol–Permiso

```mermaid
graph LR
    subgraph Roles
        A["🔴 admin"]
        E["🟡 editor"]
        V["🟢 viewer"]
    end

    subgraph Permisos usuarios
        UC["users:create"]
        UR["users:read"]
        UU["users:update"]
        UD["users:delete"]
    end

    subgraph Permisos roles
        RC["roles:create"]
        RR["roles:read"]
        RU["roles:update"]
        RD["roles:delete"]
    end

    subgraph Permisos productos
        PC["products:create"]
        PR["products:read"]
        PU["products:update"]
        PD["products:delete"]
    end

    A --> UC & UR & UU & UD
    A --> RC & RR & RU & RD
    A --> PC & PR & PU & PD

    E --> UR & RR
    E --> PC & PR & PU

    V --> UR & RR & PR

    style A fill:#7c3aed22,stroke:#7c3aed,color:#a78bfa
    style E fill:#0284c722,stroke:#0284c7,color:#38bdf8
    style V fill:#64748b22,stroke:#64748b,color:#94a3b8
```

### Cómo interactúan RBAC y ABAC en Productos

```mermaid
flowchart LR
    REQ["Solicitud entrante\nDELETE /api/products/2"]
    AUTH["auth.middleware\nVerifica JWT → req.user"]
    RBAC["rbac.middleware\nproducts:delete\n¿está en role_permissions?"]
    ABAC["AbacPolicy\nevaluateProduct\nusuario × delete × producto"]
    ALLOW["✓ 200 / 204"]
    DENY_RBAC["✗ 403\nEl rol no tiene products:delete"]
    DENY_ABAC["✗ 403\nPolítica ABAC denegada\n+ cadena reason"]

    REQ --> AUTH --> RBAC
    RBAC -->|"permiso encontrado"| ABAC
    RBAC -->|"permiso faltante"| DENY_RBAC
    ABAC -->|"allow = true"| ALLOW
    ABAC -->|"allow = false"| DENY_ABAC

    style ALLOW     fill:#16a34a22,stroke:#16a34a
    style DENY_RBAC fill:#dc262622,stroke:#dc2626
    style DENY_ABAC fill:#dc262622,stroke:#dc2626
```

> Solo las solicitudes que superan **ambas** verificaciones — RBAC (el rol tiene el permiso) y ABAC (los atributos satisfacen la política) — llegan al manejador del caso de uso.

---

## Usuarios de Demostración

| Email | Contraseña | Rol | Departamento | Sidebar visible |
|-------|-----------|-----|-------------|-----------------|
| `admin@demo.com` | `Admin123!` | admin | it | Dashboard · RBAC Management · Products (RBAC) · Products (ABAC) |
| `alice@demo.com` | `Alice123!` | editor | sales | Dashboard · Products (RBAC) · Products (ABAC) |
| `bob@demo.com` | `Bob123!` | viewer | marketing | Dashboard · Products (RBAC) · Products (ABAC) |

### Qué puede hacer cada usuario

| Acción | admin | alice (editor) | bob (viewer) |
|--------|:-----:|:--------------:|:------------:|
| Gestionar usuarios / roles / asignaciones | ✓ | ✗ | ✗ |
| Asignar permisos a roles | ✓ | ✗ | ✗ |
| Products RBAC — leer | ✓ | ✓ | ✓ |
| Products RBAC — crear | ✓ | ✓ | ✗ |
| Products RBAC — editar | ✓ | ✓ | ✗ |
| Products RBAC — eliminar | ✓ | ✗ | ✗ |
| Products ABAC — ver (filtrado por depto.) | todos | solo sales | solo marketing |
| Products ABAC — crear | ✓ | ✓ (depto. sales) | ✗ |
| Products ABAC — editar | ✓ | solo propios | ✗ |
| Products ABAC — eliminar | ✓ | solo propios en draft | ✗ |

### Escenarios de prueba ABAC

| Usuario | SELECT | INSERT | UPDATE P.Alpha (borrador de alice) | DELETE P.Beta (publicado de alice) |
|---------|--------|--------|------------------------------------|------------------------------------|
| admin | Todos los productos | ✓ | ✓ | ✓ |
| alice | Solo ventas | ✓ (depto. ventas) | ✓ (propietaria) | ✗ (estado = published) |
| bob | Solo marketing | ✗ (depto. marketing) | ✗ (no es propietario) | ✗ (no es propietario) |

---

## Casos de Uso — Roles y Permisos

Esta sección documenta **24 casos de uso** organizados en cuatro grupos que cubren la gestión de roles, asignación a usuarios, restricciones RBAC y evaluación de políticas ABAC. Cada caso de uso incluye su plantilla formal más el comando `curl` de verificación.

Todos los comandos asumen la aplicación corriendo en Docker (`http://localhost`). Para desarrollo local reemplaza por `http://localhost:4000`.

### Preparación — obtener tokens de acceso

Ejecuta este bloque una vez antes de cualquier prueba. Los tokens expiran en 8 h.

```bash
export BASE=http://localhost

export ADMIN_TOKEN=$(curl -sf -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"Admin123!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

export ALICE_TOKEN=$(curl -sf -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@demo.com","password":"Alice123!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

export BOB_TOKEN=$(curl -sf -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"bob@demo.com","password":"Bob123!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

echo "Tokens listos ✓"
```

---

### Grupo 1 — Gestión de roles (CRUD)

---

#### UC-01 · Listar roles y sus permisos

| Campo | Detalle |
|---|---|
| **Actor** | Administrador del sistema |
| **Pre-condición** | Usuario autenticado con rol `admin` |
| **Flujo principal** | 1. El administrador solicita `GET /api/roles` con su token. 2. El sistema consulta la tabla `roles` con sus `permissions` asociados. 3. Retorna el listado completo. |
| **Post-condición** | El administrador visualiza los tres roles iniciales con sus permisos. |
| **Resultado esperado** | `200 OK` — arreglo con `admin` (12 permisos), `editor` (5 permisos) y `viewer` (3 permisos). |

```bash
curl -s $BASE/api/roles \
  -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -m json.tool
```

```json
[
  { "id": 1, "name": "admin",  "permissions": [ "...12 permisos..." ] },
  { "id": 2, "name": "editor", "permissions": [ "...5 permisos..."  ] },
  { "id": 3, "name": "viewer", "permissions": [ "...3 permisos..."  ] }
]
```

---

#### UC-02 · Crear un rol personalizado

| Campo | Detalle |
|---|---|
| **Actor** | Administrador del sistema |
| **Pre-condición** | Usuario autenticado con `roles:create`. No existe un rol llamado `auditor`. |
| **Flujo principal** | 1. El administrador envía `POST /api/roles` con `name` y `description`. 2. `RoleService.createRole` verifica que el nombre no exista. 3. Inserta el rol en la tabla `roles`. 4. Retorna el rol creado con lista de permisos vacía. |
| **Post-condición** | Existe un nuevo rol `auditor` en la base de datos, sin permisos asignados. |
| **Resultado esperado** | `201 Created` con el objeto del nuevo rol. |

```bash
curl -sf -X POST $BASE/api/roles \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"auditor","description":"Auditor de solo lectura sobre productos"}' \
  | python3 -m json.tool
```

```json
{
  "id": 4,
  "name": "auditor",
  "description": "Auditor de solo lectura sobre productos",
  "permissions": []
}
```

Guarda el ID para casos de uso posteriores:

```bash
export AUDITOR_ROLE_ID=$(curl -sf $BASE/api/roles \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -c "import sys,json; r=[x for x in json.load(sys.stdin) if x['name']=='auditor']; print(r[0]['id'])")
echo "Auditor role ID: $AUDITOR_ROLE_ID"
```

---

#### UC-03 · Intentar crear un rol duplicado

| Campo | Detalle |
|---|---|
| **Actor** | Administrador del sistema |
| **Pre-condición** | Ya existe un rol con el nombre `auditor` (creado en UC-02). |
| **Flujo principal** | 1. El administrador intenta `POST /api/roles` con `name: "auditor"`. 2. `RoleService.createRole` detecta que el nombre ya existe. 3. Lanza `ConflictError` antes de intentar insertar. |
| **Flujo alternativo** | El sistema retorna `409` con mensaje explicativo. No se crea ningún registro. |
| **Post-condición** | El rol `auditor` original no es afectado; no se duplica. |
| **Resultado esperado** | `409 Conflict` con `error` indicando el conflicto de nombre. |

```bash
curl -s -X POST $BASE/api/roles \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"auditor","description":"duplicado"}' \
  -w "\nHTTP %{http_code}"
```

```json
{ "error": "Role \"auditor\" already exists" }
```

---

#### UC-04 · Editar la descripción de un rol

| Campo | Detalle |
|---|---|
| **Actor** | Administrador del sistema |
| **Pre-condición** | Existe el rol `auditor` con ID `$AUDITOR_ROLE_ID`. |
| **Flujo principal** | 1. El administrador envía `PUT /api/roles/:id` con campos a modificar. 2. `RoleService.updateRole` verifica que el rol existe. 3. Actualiza solo los campos enviados (`COALESCE`). 4. Retorna el rol actualizado con sus permisos. |
| **Post-condición** | La descripción del rol `auditor` está actualizada. Los permisos no son alterados. |
| **Resultado esperado** | `200 OK` con la nueva descripción en la respuesta. |

```bash
curl -sf -X PUT $BASE/api/roles/$AUDITOR_ROLE_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description":"Auditor externo — acceso de lectura a productos y usuarios"}' \
  | python3 -m json.tool
```

---

#### UC-05 · Listar permisos disponibles

| Campo | Detalle |
|---|---|
| **Actor** | Administrador del sistema |
| **Pre-condición** | Usuario autenticado con `roles:read`. |
| **Flujo principal** | 1. Solicita `GET /api/roles/permissions`. 2. El sistema retorna todos los pares `(resource, action)` de la tabla `permissions`. |
| **Post-condición** | El actor conoce los IDs necesarios para asignar permisos a un rol en la UI. |
| **Resultado esperado** | `200 OK` — lista de 12 objetos `{ id, resource, action }`. |

```bash
curl -s $BASE/api/roles/permissions \
  -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -m json.tool
```

```json
[
  { "id":  1, "resource": "products", "action": "create" },
  { "id":  2, "resource": "products", "action": "delete" },
  { "id":  3, "resource": "products", "action": "read"   },
  { "id":  4, "resource": "products", "action": "update" },
  { "id":  5, "resource": "roles",    "action": "create" }
]
```

---

### Grupo 2 — Asignación de roles a usuarios

---

#### UC-06 · Asignar el rol `auditor` a bob

| Campo | Detalle |
|---|---|
| **Actor** | Administrador del sistema |
| **Pre-condición** | Existe el rol `auditor` (`$AUDITOR_ROLE_ID`). Bob (`id=3`) existe con rol `viewer`. |
| **Flujo principal** | 1. El administrador envía `POST /api/users/3/roles` con `{ roleId }`. 2. `UserService.assignRole` verifica que tanto el usuario como el rol existen. 3. Inserta en `user_roles` (ignorando duplicados). 4. Retorna el perfil actualizado del usuario. |
| **Post-condición** | Bob posee los roles `viewer` y `auditor`. Sus permisos efectivos son la unión de ambos conjuntos. |
| **Resultado esperado** | `200 OK` — perfil de bob con arreglo `roles: ["auditor","viewer"]`. |

```bash
curl -sf -X POST $BASE/api/users/3/roles \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"roleId\": $AUDITOR_ROLE_ID}" \
  | python3 -m json.tool
```

```json
{
  "id": 3,
  "email": "bob@demo.com",
  "department": "marketing",
  "roles": ["auditor", "viewer"]
}
```

---

#### UC-07 · Verificar roles asignados a un usuario

| Campo | Detalle |
|---|---|
| **Actor** | Administrador del sistema |
| **Pre-condición** | Bob tiene los roles `viewer` y `auditor` asignados (UC-06). |
| **Flujo principal** | 1. El administrador solicita `GET /api/users/3/roles`. 2. El sistema consulta `user_roles` para el usuario dado. 3. Retorna el arreglo de nombres de roles. |
| **Post-condición** | El administrador confirma que la asignación previa se persistió correctamente. |
| **Resultado esperado** | `200 OK` — `["auditor","viewer"]`. |

```bash
curl -s $BASE/api/users/3/roles \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

```json
["auditor", "viewer"]
```

---

#### UC-08 · Revocar el rol `auditor` de bob

| Campo | Detalle |
|---|---|
| **Actor** | Administrador del sistema |
| **Pre-condición** | Bob tiene el rol `auditor` asignado. |
| **Flujo principal** | 1. El administrador envía `DELETE /api/users/3/roles/:roleId`. 2. `UserService.removeRole` elimina la fila de `user_roles`. 3. Retorna `204`. |
| **Post-condición** | Bob solo conserva el rol `viewer`. El rol `auditor` no se elimina del sistema, solo se desvincula de este usuario. |
| **Resultado esperado** | `204 No Content`. Consulta posterior retorna `["viewer"]`. |

```bash
curl -s -X DELETE $BASE/api/users/3/roles/$AUDITOR_ROLE_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -w "HTTP %{http_code}"
```

Verificar que solo queda `viewer`:

```bash
curl -s $BASE/api/users/3/roles -H "Authorization: Bearer $ADMIN_TOKEN"
# ["viewer"]
```

---

#### UC-09 · Intentar asignar un rol inexistente

| Campo | Detalle |
|---|---|
| **Actor** | Administrador del sistema |
| **Pre-condición** | No existe ningún rol con `id = 9999`. |
| **Flujo principal** | 1. El administrador envía `POST /api/users/3/roles` con `roleId: 9999`. 2. `UserService.assignRole` busca el rol y no lo encuentra. 3. Lanza `NotFoundError`. |
| **Flujo alternativo** | El sistema retorna `404` sin modificar `user_roles`. |
| **Post-condición** | Los roles de bob no cambian. |
| **Resultado esperado** | `404 Not Found` — `{ "error": "Role not found" }`. |

```bash
curl -s -X POST $BASE/api/users/3/roles \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"roleId": 9999}' \
  -w "\nHTTP %{http_code}"
```

```json
{ "error": "Role not found" }
```

---

#### UC-10 · Eliminar el rol `auditor` con cascada

| Campo | Detalle |
|---|---|
| **Actor** | Administrador del sistema |
| **Pre-condición** | Existe el rol `auditor`. Puede o no tener usuarios asignados. |
| **Flujo principal** | 1. El administrador envía `DELETE /api/roles/:id`. 2. `RoleService.deleteRole` elimina el registro. 3. `ON DELETE CASCADE` en `role_permissions` y `user_roles` elimina automáticamente todas las filas relacionadas. |
| **Post-condición** | El rol `auditor` no existe. Ningún usuario lo tiene asignado. No quedan permisos huérfanos. |
| **Resultado esperado** | `204 No Content`. El listado de roles muestra solo `admin`, `editor`, `viewer`. |

```bash
curl -s -X DELETE $BASE/api/roles/$AUDITOR_ROLE_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" -w "HTTP %{http_code}"
```

Confirmar que desapareció:

```bash
curl -s $BASE/api/roles -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -c "import sys,json; print([r['name'] for r in json.load(sys.stdin)])"
# ['admin', 'editor', 'viewer']
```

---

### Grupo 3 — Verificación de restricciones RBAC

---

#### UC-11 · Editor intenta eliminar un usuario

| Campo | Detalle |
|---|---|
| **Actor** | alice (rol `editor`) |
| **Pre-condición** | alice está autenticada. El rol `editor` no incluye `users:delete`. |
| **Flujo principal** | 1. alice envía `DELETE /api/users/3`. 2. `auth.middleware` valida el token y adjunta `req.user`. 3. `requirePermission("users","delete")` consulta `role_permissions` para alice. 4. El conteo es `0` → lanza respuesta `403`. |
| **Flujo alternativo** | El controlador nunca es invocado. |
| **Post-condición** | El usuario con `id=3` no es eliminado. |
| **Resultado esperado** | `403 Forbidden` con `reason` explicando el permiso faltante. |

```bash
curl -s -X DELETE $BASE/api/users/3 \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -w "\nHTTP %{http_code}"
```

```json
{
  "error": "Forbidden",
  "reason": "Your role does not have 'delete' permission on 'users'"
}
```

---

#### UC-12 · Viewer intenta crear un producto

| Campo | Detalle |
|---|---|
| **Actor** | bob (rol `viewer`, departamento `marketing`) |
| **Pre-condición** | bob está autenticado. El endpoint de productos usa ABAC (no `requirePermission`). |
| **Flujo principal** | 1. bob envía `POST /api/products`. 2. `auth.middleware` valida el token. 3. `ProductController.create` invoca `ProductService.createProduct`. 4. `AbacPolicy.evaluateProduct(bob,"insert")` evalúa `user.department = "marketing"` → `allow: false`. 5. Se lanza `ForbiddenError` con el motivo. |
| **Post-condición** | No se crea ningún producto. |
| **Resultado esperado** | `403 Forbidden` con `reason` indicando el departamento incorrecto. |

```bash
curl -s -X POST $BASE/api/products \
  -H "Authorization: Bearer $BOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Producto de bob","price":10}' \
  -w "\nHTTP %{http_code}"
```

```json
{
  "reason": "insert requires subject.department = \"sales\" or admin role (got \"marketing\")"
}
```

---

#### UC-13 · Viewer intenta modificar un rol

| Campo | Detalle |
|---|---|
| **Actor** | bob (rol `viewer`) |
| **Pre-condición** | bob está autenticado. El rol `viewer` solo tiene `roles:read`, no `roles:update`. |
| **Flujo principal** | 1. bob envía `PUT /api/roles/2`. 2. `requirePermission("roles","update")` no encuentra permiso. 3. Retorna `403` sin llegar al controlador. |
| **Post-condición** | El rol `editor` (id=2) no es modificado. |
| **Resultado esperado** | `403 Forbidden`. |

```bash
curl -s -X PUT $BASE/api/roles/2 \
  -H "Authorization: Bearer $BOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description":"modificado por bob"}' \
  -w "\nHTTP %{http_code}"
```

```json
{
  "error": "Forbidden",
  "reason": "Your role does not have 'update' permission on 'roles'"
}
```

---

#### UC-14 · Solicitud a endpoint protegido sin token

| Campo | Detalle |
|---|---|
| **Actor** | Cliente anónimo (sin autenticar) |
| **Pre-condición** | No se envía cabecera `Authorization`. |
| **Flujo principal** | 1. Cliente solicita `GET /api/users` sin cabecera. 2. `auth.middleware` detecta la ausencia. 3. Retorna `401` inmediatamente. |
| **Flujo alternativo** | Ninguna lógica de negocio ni consulta a BD es ejecutada. |
| **Post-condición** | El sistema no revela información alguna. |
| **Resultado esperado** | `401 Unauthorized` — `{ "error": "Missing Authorization header" }`. |

```bash
curl -s $BASE/api/users -w "\nHTTP %{http_code}"
```

```json
{ "error": "Missing Authorization header" }
```

---

### Grupo 4 — Evaluación de políticas ABAC (Productos)

---

#### UC-15 · Admin visualiza todos los productos sin restricción de departamento

| Campo | Detalle |
|---|---|
| **Actor** | Administrador del sistema |
| **Pre-condición** | Existen 3 productos en distintos departamentos (`sales` × 2, `marketing` × 1). |
| **Flujo principal** | 1. admin solicita `GET /api/products`. 2. `ProductService.listProducts` invoca `AbacPolicy.evaluateProduct(admin,"select")`. 3. `user.isAdmin() = true` → sin filtro de departamento. 4. Retorna todos los productos. |
| **Post-condición** | admin recibe los 3 productos. |
| **Resultado esperado** | `200 OK` — 3 productos de todos los departamentos. Evaluación: `"Subject has admin role → unrestricted read"`. |

```bash
curl -sf $BASE/api/products -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); [print(f'  [{p[\"department\"]}] {p[\"name\"]}') for p in d['products']]"
```

```
  [sales] Product Alpha
  [sales] Product Beta
  [marketing] Product Gamma
```

---

#### UC-16 · Alice visualiza solo los productos de su departamento

| Campo | Detalle |
|---|---|
| **Actor** | alice (rol `editor`, departamento `sales`) |
| **Pre-condición** | Existen productos en `sales` y en `marketing`. |
| **Flujo principal** | 1. alice solicita `GET /api/products`. 2. La política `select` evalúa `user.isAdmin() = false`. 3. Se filtra el resultado a `product.department === "sales"`. |
| **Post-condición** | alice recibe solo los productos de ventas; los de marketing no se exponen. |
| **Resultado esperado** | `200 OK` — 2 productos. Evaluación: `"Listing allowed; results filtered to department = 'sales'"`. |

```bash
curl -sf $BASE/api/products -H "Authorization: Bearer $ALICE_TOKEN" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); [print(f'  [{p[\"department\"]}] {p[\"name\"]}') for p in d['products']]"
```

```
  [sales] Product Alpha
  [sales] Product Beta
```

---

#### UC-17 · Alice crea un producto (INSERT permitido — departamento ventas)

| Campo | Detalle |
|---|---|
| **Actor** | alice (rol `editor`, departamento `sales`) |
| **Pre-condición** | alice está autenticada. Política `insert`: permite si `user.department = "sales"`. |
| **Flujo principal** | 1. alice envía `POST /api/products`. 2. `AbacPolicy.evaluateProduct(alice,"insert")` evalúa `user.department = "sales"` → `allow: true`. 3. Se crea el producto con `owner_id = alice.id` y `department = "sales"`. 4. Retorna el producto con la evaluación de política. |
| **Post-condición** | El producto existe en BD con alice como propietaria y estado `draft`. |
| **Resultado esperado** | `201 Created` con el producto y `evaluation.reason` indicando la política satisfecha. |

```bash
curl -sf -X POST $BASE/api/products \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Nuevo Producto Alice","status":"draft","price":89.99}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Creado: {d[\"product\"][\"name\"]} | Política: {d[\"evaluation\"][\"reason\"]}')"
```

```
Creado: Nuevo Producto Alice | Política: subject.department "sales" satisfies insert policy
```

Guarda el ID para casos posteriores:

```bash
export NEW_PRODUCT_ID=$(curl -sf $BASE/api/products \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  | python3 -c "import sys,json; ps=json.load(sys.stdin)['products']; print(max(p['id'] for p in ps))")
```

---

#### UC-18 · Bob intenta crear un producto (INSERT denegado — departamento marketing)

| Campo | Detalle |
|---|---|
| **Actor** | bob (rol `viewer`, departamento `marketing`) |
| **Pre-condición** | Política `insert`: solo permite `sales` o `admin`. |
| **Flujo principal** | 1. bob envía `POST /api/products`. 2. `AbacPolicy.evaluateProduct(bob,"insert")` evalúa `user.department = "marketing"` → `allow: false`. 3. `ProductService` lanza `ForbiddenError` con el motivo. |
| **Post-condición** | No se crea ningún producto. |
| **Resultado esperado** | `403 Forbidden` con atributo `reason` especificando el departamento incorrecto. |

```bash
curl -s -X POST $BASE/api/products \
  -H "Authorization: Bearer $BOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Producto Bob","price":20}' \
  -w "\nHTTP %{http_code}"
```

```json
{ "reason": "insert requires subject.department = \"sales\" or admin role (got \"marketing\")" }
```

---

#### UC-19 · Alice actualiza su propio producto (UPDATE permitido — es propietaria)

| Campo | Detalle |
|---|---|
| **Actor** | alice (rol `editor`, `id=2`) |
| **Pre-condición** | El producto `$NEW_PRODUCT_ID` existe con `owner_id = 2` (alice). |
| **Flujo principal** | 1. alice envía `PUT /api/products/:id`. 2. `ProductService.updateProduct` busca el producto. 3. `AbacPolicy.evaluateProduct(alice,"update",product)` evalúa `product.ownerId (2) === user.id (2)` → `allow: true`. 4. Actualiza los campos y retorna el producto con la evaluación. |
| **Post-condición** | El producto tiene el precio y descripción actualizados. |
| **Resultado esperado** | `200 OK` con el producto actualizado y `evaluation.reason` confirmando la propiedad. |

```bash
curl -sf -X PUT $BASE/api/products/$NEW_PRODUCT_ID \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"price":99.99,"description":"Descripción actualizada"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Precio: {d[\"product\"][\"price\"]} | Política: {d[\"evaluation\"][\"reason\"]}')"
```

```
Precio: 99.99 | Política: subject.id 2 === resource.ownerId 2
```

---

#### UC-20 · Bob intenta actualizar el producto de alice (UPDATE denegado — no es propietario)

| Campo | Detalle |
|---|---|
| **Actor** | bob (rol `viewer`, `id=3`) |
| **Pre-condición** | El producto `$NEW_PRODUCT_ID` existe con `owner_id = 2` (alice). bob no es admin. |
| **Flujo principal** | 1. bob envía `PUT /api/products/:id`. 2. `AbacPolicy.evaluateProduct(bob,"update",product)` evalúa `product.ownerId (2) ≠ user.id (3)` y `isAdmin() = false` → `allow: false`. 3. Se lanza `ForbiddenError`. |
| **Post-condición** | El producto de alice no es modificado. |
| **Resultado esperado** | `403 Forbidden` indicando que se requiere ser propietario o admin. |

```bash
curl -s -X PUT $BASE/api/products/$NEW_PRODUCT_ID \
  -H "Authorization: Bearer $BOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"price":1.00}' \
  -w "\nHTTP %{http_code}"
```

```json
{ "reason": "update requires admin role OR subject.id === resource.ownerId" }
```

---

#### UC-21 · Alice elimina su producto en borrador (DELETE permitido — propietaria + draft)

| Campo | Detalle |
|---|---|
| **Actor** | alice (rol `editor`, `id=2`) |
| **Pre-condición** | El producto `$NEW_PRODUCT_ID` existe con `owner_id=2` y `status="draft"`. |
| **Flujo principal** | 1. alice envía `DELETE /api/products/:id`. 2. La política evalúa: `isAdmin()=false`, `ownerId===user.id` ✓, `status="draft"` ✓ → `allow: true`. 3. El producto es eliminado de la BD. 4. Retorna `200` con la evaluación. |
| **Post-condición** | El producto no existe en la BD. |
| **Resultado esperado** | `200 OK` con `evaluation.reason` confirmando ambas condiciones satisfechas. |

```bash
curl -sf -X DELETE $BASE/api/products/$NEW_PRODUCT_ID \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Política: {d[\"evaluation\"][\"reason\"]}')"
```

```
Política: subject.id === resource.ownerId AND resource.status "draft" satisfies delete policy
```

---

#### UC-22 · Alice intenta eliminar su producto publicado (DELETE denegado — status incorrecto)

| Campo | Detalle |
|---|---|
| **Actor** | alice (rol `editor`, `id=2`) |
| **Pre-condición** | `Product Beta` (`id=2`) existe con `owner_id=2` y `status="published"`. |
| **Flujo principal** | 1. alice envía `DELETE /api/products/2`. 2. La política evalúa: propietaria ✓, pero `status="published" ≠ "draft"` ✗ → `allow: false`. 3. El campo `reason` especifica el atributo que falló. |
| **Post-condición** | `Product Beta` permanece en la BD sin cambios. |
| **Resultado esperado** | `403 Forbidden` explicando que el estado no es `draft`. |

```bash
curl -s -X DELETE $BASE/api/products/2 \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -w "\nHTTP %{http_code}"
```

```json
{ "reason": "subject.id === resource.ownerId but resource.status \"published\" ≠ \"draft\"" }
```

---

#### UC-23 · Bob intenta eliminar el producto de alice (DELETE denegado — no es propietario)

| Campo | Detalle |
|---|---|
| **Actor** | bob (rol `viewer`, `id=3`) |
| **Pre-condición** | `Product Beta` (`id=2`) existe con `owner_id=2`. bob no es propietario ni admin. |
| **Flujo principal** | 1. bob envía `DELETE /api/products/2`. 2. La política evalúa: `isAdmin()=false`, `ownerId (2) ≠ user.id (3)` → `allow: false`. 3. Se retorna `403` con el motivo genérico de delete. |
| **Post-condición** | `Product Beta` permanece sin cambios. |
| **Resultado esperado** | `403 Forbidden` indicando que se requiere ser admin o propietario de un borrador. |

```bash
curl -s -X DELETE $BASE/api/products/2 \
  -H "Authorization: Bearer $BOB_TOKEN" \
  -w "\nHTTP %{http_code}"
```

```json
{ "reason": "delete requires admin role OR (owner AND resource.status = \"draft\")" }
```

---

#### UC-24 · Admin elimina cualquier producto sin restricciones de atributo

| Campo | Detalle |
|---|---|
| **Actor** | Administrador del sistema |
| **Pre-condición** | `Product Beta` (`id=2`) existe con `status="published"` y `owner_id=2`. |
| **Flujo principal** | 1. admin envía `DELETE /api/products/2`. 2. `AbacPolicy.evaluateProduct(admin,"delete",product)` evalúa `user.isAdmin()=true` → `allow: true` sin verificar `ownerId` ni `status`. 3. El producto es eliminado. |
| **Post-condición** | El producto no existe en la BD. El rol `admin` omite todas las restricciones de atributo. |
| **Resultado esperado** | `200 OK` con `evaluation.reason` indicando el privilegio de admin. |

```bash
curl -sf -X DELETE $BASE/api/products/2 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Política: {d[\"evaluation\"][\"reason\"]}')"
```

```
Política: Subject has admin role → can delete any product
```

---

### Resumen de casos de uso

| ID | Grupo | Nombre | Actor | HTTP esperado |
|---|-------|--------|-------|:---:|
| UC-01 | CRUD Roles | Listar roles y permisos | admin | 200 |
| UC-02 | CRUD Roles | Crear rol personalizado | admin | 201 |
| UC-03 | CRUD Roles | Crear rol duplicado | admin | 409 |
| UC-04 | CRUD Roles | Editar descripción de rol | admin | 200 |
| UC-05 | CRUD Roles | Listar permisos disponibles | admin | 200 |
| UC-06 | Asignación | Asignar rol a usuario | admin | 200 |
| UC-07 | Asignación | Verificar roles de usuario | admin | 200 |
| UC-08 | Asignación | Revocar rol de usuario | admin | 204 |
| UC-09 | Asignación | Asignar rol inexistente | admin | 404 |
| UC-10 | CRUD Roles | Eliminar rol con cascada | admin | 204 |
| UC-11 | RBAC ✗ | Editor intenta eliminar usuario | alice | 403 |
| UC-12 | RBAC ✗ | Viewer intenta crear producto | bob | 403 |
| UC-13 | RBAC ✗ | Viewer intenta modificar rol | bob | 403 |
| UC-14 | RBAC ✗ | Solicitud sin token | anónimo | 401 |
| UC-15 | ABAC ✓ | Admin lista todos los productos | admin | 200 |
| UC-16 | ABAC ✓ | Alice lista solo sus productos | alice | 200 |
| UC-17 | ABAC ✓ | Alice crea producto (ventas) | alice | 201 |
| UC-18 | ABAC ✗ | Bob crea producto (marketing) | bob | 403 |
| UC-19 | ABAC ✓ | Alice actualiza producto propio | alice | 200 |
| UC-20 | ABAC ✗ | Bob actualiza producto de alice | bob | 403 |
| UC-21 | ABAC ✓ | Alice elimina borrador propio | alice | 200 |
| UC-22 | ABAC ✗ | Alice elimina producto publicado | alice | 403 |
| UC-23 | ABAC ✗ | Bob elimina producto de alice | bob | 403 |
| UC-24 | ABAC ✓ | Admin elimina cualquier producto | admin | 200 |

---

## Cómo Ejecutar

### Requisitos previos

- Node.js 22+
- Docker

### Inicio

```bash
# 1. Levantar todos los servicios (base de datos, API y web)
docker compose up --build

# — o para desarrollo local —

# 2. Iniciar la base de datos
docker compose up -d db

# 3. API — puerto 4000
cd api
npm install
npm run dev

# 4. Web — puerto 5173 (terminal separada)
cd web
npm install
npm run dev
```

Abre `http://localhost` (Docker) o `http://localhost:5173` (desarrollo local) y haz clic en cualquier fila de credenciales de demo para rellenar el formulario de inicio de sesión.

---

## Pruebas SAST

El proyecto incluye un `Makefile` en la raíz con tres herramientas de análisis estático de seguridad:

| Herramienta | Tipo | Cubre |
|---|---|---|
| **ESLint + eslint-plugin-security** | Análisis estático de código (AST) | Reglas de seguridad en API y Web |
| **npm audit** | Análisis de dependencias (CVE) | Vulnerabilidades en paquetes npm |
| **SonarQube Community** | SAST + calidad de código (dashboard) | Inyecciones, criptografía, hotspots, code smells, duplicaciones |

```bash
# ESLint + npm audit
make sast          # API + Web (completo)
make sast-api      # solo API
make sast-web      # solo Web
make sast-install  # instala dependencias SAST

# SonarQube Community (requiere Docker)
make sonar-start       # levanta el servidor SonarQube
make sonar-scan        # analiza API + Web (proyectos separados)
make sonar-scan-api    # analiza solo la API
make sonar-scan-web    # analiza solo el Web
make sonar-stop        # detiene SonarQube
make sonar             # sonar-start + sonar-scan en un paso

make help          # muestra todos los targets disponibles
```

---

### SAST — API

**Ruta de configuración:** `api/eslint.config.mjs`
**Comando:** `make sast-api`

#### Herramientas

**ESLint v9**
Linter estático que analiza el árbol AST del código JavaScript sin ejecutarlo. En la versión 9 se usa **flat config** (`eslint.config.mjs`), que permite una configuración explícita y componible por capas.
🔗 https://eslint.org

**eslint-plugin-security v3**
Plugin de ESLint con reglas específicas para Node.js. Detecta patrones como `eval`, regex inseguros (ReDoS), timing attacks, `child_process`, buffers sin inicializar, PRNG débiles e inyección de objetos.
🔗 https://github.com/eslint-community/eslint-plugin-security

**npm audit**
Herramienta de npm que cruza las dependencias instaladas contra la GitHub Advisory Database (NVD/CVE). Se ejecuta con `--audit-level=moderate` para reportar severidad media, alta y crítica.
🔗 https://docs.npmjs.com/cli/commands/npm-audit

**SonarQube Community**
Servidor de análisis estático self-hosted (Docker). Aplica el perfil **Sonar way** sobre `api/src/` detectando inyecciones (SQL, shell, path traversal), criptografía débil, credenciales hardcodeadas, hotspots de JWT/CORS, logging inseguro, bugs de promesas y duplicaciones. Complementa ESLint con métricas de deuda técnica y un dashboard visual persistente.
Comando: `make sonar-scan` (ver [SonarQube Community](#sonarqube-community-dashboard-local))

#### Reglas configuradas

| Regla | Severidad | Detecta |
|---|:---:|---|
| `security/detect-unsafe-regex` | 🔴 error | Expresiones regulares vulnerables a ReDoS |
| `security/detect-possible-timing-attacks` | 🔴 error | Comparación de strings con `==` — timing attack |
| `security/detect-child-process` | 🔴 error | Ejecución arbitraria de comandos del sistema |
| `security/detect-eval-with-expression` | 🔴 error | `eval()` con expresión dinámica |
| `security/detect-new-buffer` | 🔴 error | `new Buffer(string)` inseguro |
| `security/detect-pseudoRandomBytes` | 🔴 error | `Math.random()` para fines de seguridad |
| `security/detect-no-csrf-before-method-override` | 🔴 error | CSRF sin protección previa |
| `security/detect-disable-mustache-escape` | 🔴 error | Escape de plantilla deshabilitado |
| `no-eval` | 🔴 error | Uso directo de `eval()` |
| `no-implied-eval` | 🔴 error | `setTimeout("código")` / `setInterval("código")` |
| `no-new-func` | 🔴 error | `new Function(string)` |
| `security/detect-object-injection` | 🟡 warn | Acceso con clave dinámica `obj[key]` |
| `security/detect-non-literal-regexp` | 🟡 warn | `new RegExp(variable)` |
| `security/detect-non-literal-fs-filename` | 🟡 warn | Path traversal vía nombre de archivo dinámico |
| `security/detect-non-literal-require` | 🟡 warn | `require(variable)` dinámico |
| `no-process-exit` | 🟡 warn | `process.exit()` sin limpieza |

#### Resultado actual

```
[ 1/2 ] ESLint — Análisis estático de seguridad
  ✓ Sin hallazgos de ESLint

[ 2/2 ] npm audit — Vulnerabilidades en dependencias
  ✓ Sin vulnerabilidades moderate/high/critical
```

| Check | Estado |
|---|---|
| ESLint | ✅ 0 hallazgos |
| npm audit | ✅ 0 vulnerabilidades |

---

### SAST — Web

**Ruta de configuración:** `web/eslint.config.mjs`
**Comando:** `make sast-web`

#### Herramientas

**ESLint v9** — mismo motor que la API.
🔗 https://eslint.org

**eslint-plugin-security v3** — mismas reglas de seguridad generales que la API.
🔗 https://github.com/eslint-community/eslint-plugin-security

**eslint-plugin-react v7**
Plugin de ESLint con reglas específicas para React. En el contexto SAST se usa para detectar vulnerabilidades **XSS**: prohíbe `dangerouslySetInnerHTML` (inyecta HTML sin sanitizar) y URLs con esquema `javascript:` que ejecutan código en el navegador.
🔗 https://github.com/jsx-eslint/eslint-plugin-react

**npm audit** — mismo análisis de CVEs que la API.
🔗 https://docs.npmjs.com/cli/commands/npm-audit

**SonarQube Community**
Mismo servidor que la API. Aplica **Sonar way** sobre `web/src/` detectando XSS (`dangerouslySetInnerHTML`, `innerHTML`, `document.write`), almacenamiento sensible en `localStorage`/`sessionStorage`, URLs con esquema `javascript:`, bugs de hooks React (dependencias faltantes en `useEffect`, actualizaciones en componentes desmontados) y duplicaciones JSX.
Comando: `make sonar-scan` (ver [SonarQube Community](#sonarqube-community-dashboard-local))

#### Reglas configuradas

Incluye todas las reglas de la API más las siguientes exclusivas del frontend:

| Regla | Severidad | Detecta |
|---|:---:|---|
| `react/no-danger` | 🔴 error | `dangerouslySetInnerHTML` — XSS por inyección de HTML |
| `react/no-danger-with-children` | 🔴 error | `dangerouslySetInnerHTML` combinado con `children` |
| `no-script-url` | 🔴 error | URLs con esquema `javascript:` — ejecución de código en el navegador |

#### Resultado actual

```
[ 1/2 ] ESLint — Análisis estático de seguridad

web/src/features/products/pages/ProductsPage.jsx
  99:32  warning  Variable Assigned to Object Injection Sink  security/detect-object-injection

web/src/features/rbac/components/AssignmentsTab.jsx
  50:35  warning  Generic Object Injection Sink  security/detect-object-injection
  58:26  warning  Generic Object Injection Sink  security/detect-object-injection

web/src/features/rbac/components/RolesTab.jsx
   98:35  warning  Generic Object Injection Sink  security/detect-object-injection
  108:26  warning  Generic Object Injection Sink  security/detect-object-injection

✖ 5 problems (0 errors, 5 warnings)

[ 2/2 ] npm audit — Vulnerabilidades en dependencias
  esbuild <=0.24.2 — moderate (GHSA-67mh-4wv8-2f99)
  vite    <=6.4.1  — moderate (depende de esbuild vulnerable)
```

| Check | Estado | Detalle |
|---|---|---|
| ESLint | ⚠️ 5 warnings | `detect-object-injection` — falsos positivos controlados |
| npm audit | ⚠️ 2 moderate | `esbuild/vite` — solo afecta al servidor de desarrollo |

#### Análisis de los warnings — `detect-object-injection`

Los 5 warnings corresponden a accesos con clave dinámica como:

```javascript
busy[key]      // key = "roleId:permId" — string generado internamente, no desde input externo
obj[role.id]   // role.id = número de la BD — no proviene de input del usuario
```

Son **falsos positivos** controlados: las claves no provienen de input externo. La regla se mantiene en `warn` (no `error`) para visibilidad sin bloquear el análisis.

#### Análisis de las vulnerabilidades — `esbuild / vite`

La vulnerabilidad `GHSA-67mh-4wv8-2f99` permite que una web maliciosa envíe peticiones al servidor de desarrollo de Vite y lea la respuesta. **Solo aplica cuando el servidor de `vite dev` está corriendo y expuesto en red.** En producción, el contenido se sirve como build estático desde nginx — Vite no corre en el contenedor de producción.

El fix (`npm audit fix --force`) actualizaría a Vite 8, que es un cambio de versión mayor y rompedor. Se mantiene pendiente hasta validar compatibilidad.

### SonarQube Community (Dashboard local)

SonarQube Community es la edición gratuita y de código abierto de SonarQube. Corre completamente en local mediante Docker — **no requiere registro ni cuenta externa, y no tiene costo**. Complementa ESLint y npm audit con:

| Capacidad | ESLint | SonarQube |
|---|---|---|
| Reglas de seguridad (SAST) | ✅ | ✅ |
| Code smells y deuda técnica | ❌ | ✅ |
| Duplicaciones de código | ❌ | ✅ |
| Hotspots de seguridad agrupados | ❌ | ✅ |
| Dashboard visual persistente | ❌ | ✅ |
| Tendencias entre análisis | ❌ | ✅ |

#### Herramientas

| Herramienta | Versión | Rol |
|---|---|---|
| `sonarqube:community` (Docker) | latest | Servidor de análisis y dashboard |
| `sonarsource/sonar-scanner-cli` (Docker) | latest | Scanner que envía el código al servidor |

#### Cómo ejecutar

**Primer uso:**

```bash
make sonar-start          # levanta SonarQube (~90s primer inicio)
```

Abrí `http://localhost:9000` → login con `admin` / `admin` → el sistema pedirá cambiar la contraseña.

Luego generá un token de acceso: **Administration → Security → Users → admin → Tokens → Generate**.

```bash
SONAR_TOKEN=<tu-token> make sonar-scan        # analiza API y Web como proyectos separados
# o individualmente:
SONAR_TOKEN=<tu-token> make sonar-scan-api
SONAR_TOKEN=<tu-token> make sonar-scan-web
```

Dashboards de resultado:
- API → `http://localhost:9000/dashboard?id=security-demo-api`
- Web → `http://localhost:9000/dashboard?id=security-demo-web`

```bash
make sonar-stop           # detiene SonarQube (los resultados persisten en volúmenes Docker)
```

**Usos siguientes** (contraseña ya cambiada):

```bash
make sonar-start
SONAR_TOKEN=<tu-token> make sonar-scan
make sonar-stop
```

O en un solo comando (con el token predeterminado `admin` antes de cambiar contraseña):

```bash
make sonar
```

#### Variables disponibles

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `SONAR_HOST` | `http://host.docker.internal:9000` | URL del servidor SonarQube |
| `SONAR_TOKEN` | `admin` | Token o contraseña de autenticación |

> `host.docker.internal` permite que el contenedor del scanner alcance al servidor SonarQube expuesto en el puerto 9000 del host. Funciona automáticamente en macOS y Windows con Docker Desktop.

#### Proyectos y configuración

El análisis genera **dos proyectos separados** en SonarQube — cada uno con su propio dashboard, historial y quality gate:

| Proyecto | Project Key | Fuentes | Dashboard |
|---|---|---|---|
| API | `security-demo-api` | `api/src` | `localhost:9000/dashboard?id=security-demo-api` |
| Web | `security-demo-web` | `web/src` | `localhost:9000/dashboard?id=security-demo-web` |

Las propiedades compartidas (exclusiones, extensiones de archivo) se definen en `sonar-project.properties`; el project key y las fuentes se pasan por línea de comandos en el Makefile:

```properties
# sonar-project.properties — configuración base compartida
sonar.projectVersion=1.0
sonar.exclusions=**/node_modules/**,**/dist/**,**/build/**
sonar.javascript.file.suffixes=.js,.jsx
```

#### Reglas aplicadas por SonarQube — perfil *Sonar way* (JavaScript)

SonarQube aplica automáticamente su perfil de calidad **Sonar way** sobre todos los archivos `.js` y `.jsx`. No requiere configuración manual de reglas; las categorías y reglas más relevantes para este proyecto son:

**API — `api/src/` (Node.js / Express)**

| Categoría | Reglas destacadas |
|---|---|
| **Inyección** | Detección de concatenación de strings en queries SQL, comandos de shell (`child_process`) y accesos a sistema de archivos con rutas dinámicas |
| **Criptografía débil** | Uso de `MD5`, `SHA-1`, `Math.random()` para fines de seguridad; tamaño de clave insuficiente |
| **Credenciales embebidas** | Contraseñas, tokens o claves hardcodeadas en el fuente |
| **JWT / Auth** | Hotspot: verificación de firma JWT, algoritmo `none`, secretos débiles |
| **CORS** | Hotspot: orígenes comodín (`*`) o configuración demasiado permisiva |
| **Logging inseguro** | Registro de datos sensibles (passwords, tokens) en logs |
| **Code smells** | Complejidad cognitiva excesiva, funciones demasiado largas, código muerto, variables no utilizadas |
| **Bugs** | Promesas no manejadas, comparaciones siempre verdaderas/falsas, retornos inconsistentes |
| **Duplicaciones** | Bloques de código repetidos que deberían extraerse como función |

**Web — `web/src/` (React / JSX)**

| Categoría | Reglas destacadas |
|---|---|
| **XSS** | Hotspot: uso de `dangerouslySetInnerHTML`; asignación directa a `innerHTML` / `document.write` |
| **Almacenamiento sensible** | Hotspot: uso de `localStorage` / `sessionStorage` para tokens o datos sensibles |
| **URLs peligrosas** | Hotspot: esquemas `javascript:` en hrefs o event handlers |
| **Criptografía** | Uso de `Math.random()` donde se requiere aleatoriedad criptográfica |
| **Code smells** | Componentes con demasiada responsabilidad, props duplicadas, lógica repetida entre componentes |
| **Bugs** | Actualizaciones de estado en componentes desmontados, dependencias faltantes en `useEffect` |
| **Duplicaciones** | Fragmentos JSX idénticos que deberían convertirse en componente reutilizable |

> Las reglas de seguridad se clasifican en dos tipos: **vulnerabilidades** (issues directos) y **hotspots** (puntos que requieren revisión manual para determinar si son explotables según el contexto). El dashboard de SonarQube muestra ambas categorías por separado.

---

### Variables de entorno (`api/.env`)

| Variable | Valor por defecto | Descripción |
|----------|-------------------|-------------|
| `PORT` | `4000` | Puerto de escucha de la API |
| `DATABASE_URL` | `postgresql://demo:demo_pass@localhost:5432/security_demo` | Cadena de conexión PostgreSQL |
| `JWT_SECRET` | *(definido en .env)* | Clave de firma del token de acceso |
| `JWT_MFA_SECRET` | *(definido en .env)* | Clave de firma del token temporal MFA (independiente del de acceso) |

> **Nota de producción:** Reemplaza ambos secretos JWT con valores aleatorios criptográficamente seguros de al menos 256 bits antes de cualquier despliegue fuera de demo.

---

## Pruebas DAST

**DAST (Dynamic Application Security Testing)** prueba la aplicación *en ejecución* enviando peticiones HTTP reales y observando el comportamiento. A diferencia del SAST (que analiza el código fuente estático), el DAST detecta vulnerabilidades que solo se manifiestan en tiempo de ejecución: headers de seguridad ausentes, lógica de autorización incorrecta, tokens mal validados, etc.

### Herramientas

| Herramienta | Tipo | Rol |
|---|:---:|---|
| **Script dirigido** (`dast/dast.py`) | Pruebas de caja gris | Verifica autenticación, JWT, RBAC y la vulnerabilidad RCE conocida |
| **OWASP ZAP** (`ghcr.io/zaproxy/zaproxy:stable`) | Escaneo automático pasivo | Spider + 66 reglas de seguridad pasivas sobre la API |

### Comandos

```bash
make dast-scan   # pruebas dirigidas Python (requiere API corriendo)
make dast-zap    # OWASP ZAP baseline scan vía docker compose
make dast        # ambos en secuencia
```

ZAP corre como servicio Docker con perfil `dast` — no se inicia con `docker compose up`.  
Los reportes se guardan en `dast/reports/zap-report.html` y `dast/reports/zap-report.json`.

---

### Implementación

#### Arquitectura general

```
┌─────────────────────────────────────────────────────────┐
│                    make dast                            │
│                       │                                 │
│          ┌────────────┴────────────┐                   │
│          │                         │                   │
│   make dast-scan             make dast-zap              │
│          │                         │                   │
│   dast/dast.py              docker compose              │
│   (Python stdlib)           --profile dast run zap      │
│          │                         │                   │
│   6 suites de prueba        ZAP baseline scan           │
│   HTTP directas             spider + 66 reglas pasivas  │
│          │                         │                   │
│   stdout coloreado          dast/reports/               │
│   exit 1 si hay FAILs       zap-report.html/.json       │
└─────────────────────────────────────────────────────────┘
```

#### Script dirigido — `dast/dast.py`

Implementado en Python 3 usando únicamente la biblioteca estándar (`urllib`, `json`, `base64`): no requiere instalación de dependencias.

**Estructura interna:**

```
dast/dast.py
├── http()              helper HTTP — GET/POST con token JWT opcional
├── ok() / fail() / vuln() / warn()   salida coloreada + contador global
├── jwt_tamper_payload()   modifica campos del payload JWT (firma queda inválida)
├── jwt_alg_none()         cambia alg→"none" y elimina la firma
│
├── suite_headers()    [ 1/6 ] verifica headers de seguridad HTTP
├── suite_auth()       [ 2/6 ] login válido/inválido, SQL injection, DoS potencial
├── suite_jwt()        [ 3/6 ] ausencia de token, payload tamperado, alg:none
├── suite_rbac()       [ 4/6 ] viewer vs. admin en endpoints protegidos
├── suite_rce()        [ 5/6 ] explota GET /api/auth/debug/eval?expr=<código>
└── suite_sqli()       [ 6/6 ] 5 payloads SQL injection en login
```

**Helpers JWT:** el ataque *algorithm confusion* (`alg=none`) y el tampering de payload se implementan manipulando directamente la estructura Base64url del token:

```python
def jwt_alg_none(token):
    header_b64, payload_b64, _ = token.split(".")
    header = json.loads(b64url_decode(header_b64))
    header["alg"] = "none"
    new_header = b64url_encode(json.dumps(header).encode())
    return f"{new_header}.{payload_b64}."   # sin firma
```

Si el servidor acepta este token, significa que no valida el algoritmo de firma — vulnerabilidad crítica. En este proyecto la biblioteca `jsonwebtoken` rechaza `alg=none` por defecto → **PASS**.

#### OWASP ZAP — integración Docker Compose

ZAP se define como servicio con `profiles: ["dast"]`, lo que lo excluye del stack normal (`docker compose up`) y requiere invocación explícita:

```
docker compose up -d          # inicia: db, api, web, sonarqube  (ZAP excluido)
docker compose --profile dast run --rm zap   # ejecuta ZAP y termina
```

El `depends_on: api: condition: service_healthy` garantiza que ZAP no comienza hasta que la API responde correctamente. El healthcheck de la API usa Node.js (disponible en la imagen base) para verificar que el endpoint responde HTTP < 500:

```yaml
healthcheck:
  test: ["CMD-SHELL", "node -e \"require('http').get('http://localhost:4000/api/auth/me',
    r => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))\""]
```

ZAP escanea `http://api:4000` usando la **red interna de Docker Compose** (sin pasar por el host), lo que garantiza que el scan llega a la API aunque el puerto 4000 no esté expuesto externamente.

#### Estructura de archivos

```
tarea-seguridad/
├── dast/
│   ├── dast.py          script de pruebas dirigidas (Python stdlib)
│   └── reports/         reportes generados por ZAP (ignorados en git)
│       ├── zap-report.html
│       └── zap-report.json
└── Makefile             targets: dast, dast-scan, dast-zap
```

---

### DAST — Pruebas dirigidas (`dast/dast.py`)

Script Python sin dependencias externas (solo stdlib) que ejecuta 6 suites de prueba contra la API en ejecución.

#### Suites de prueba

| Suite | Verifica |
|---|---|
| **1. Headers HTTP de Seguridad** | Presencia de `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`, `Referrer-Policy` |
| **2. Autenticación** | Login válido/inválido, SQL injection en credenciales, DoS por password largo (bcrypt unbounded) |
| **3. Control de Sesión — JWT** | Sin token → 401; payload tamperado → 401; `alg=none` (algorithm confusion) → 401 |
| **4. Control de Acceso — RBAC** | Viewer sin permisos de escritura → 403; admin con acceso total → 200 |
| **5. Vulnerabilidad conocida — RCE** | Explota `GET /api/auth/debug/eval?expr=<código>` y confirma ejecución remota |
| **6. Inyección SQL** | 5 payloads clásicos en login → ninguno bypasea la autenticación |

#### Resultado actual

```
[ 1/6 ] Headers HTTP de Seguridad
  ✗ FAIL  X-Content-Type-Options — header ausente
  ✗ FAIL  X-Frame-Options — header ausente
  ✗ FAIL  Content-Security-Policy — header ausente
  ✗ FAIL  Referrer-Policy — header ausente
  ⚠ WARN  Strict-Transport-Security — omitido en HTTP local

[ 2/6 ] Autenticación
  ✓ PASS  Login válido → 200 + token JWT
  ✓ PASS  Credenciales incorrectas → 401
  ✓ PASS  Email inexistente → 401
  ✓ PASS  Cuerpo vacío → 401
  ✓ PASS  Password 10 000 chars → 401 (no crash de servidor)

[ 3/6 ] Control de Sesión — JWT
  ✓ PASS  Sin Authorization header → 401
  ✓ PASS  Token aleatorio (basura) → 401
  ✓ PASS  JWT con payload tamperado (firma inválida) → 401
  ✓ PASS  JWT alg=none (sin firma) → 401
  ✓ PASS  Bearer vacío → 401

[ 4/6 ] Control de Acceso — RBAC
  ✓ PASS  admin: GET /api/users → 200 (permitido)
  ✓ PASS  viewer: GET /api/users → 200 (users:read por diseño)
  ✓ PASS  viewer: POST /api/roles → 403 (denegado)
  ✓ PASS  viewer: DELETE /api/users/999 → 403 (denegado)
  ✓ PASS  viewer: POST /api/users → 403 (denegado)
  ✓ PASS  Sin auth: GET /api/users → 401

[ 5/6 ] Vulnerabilidad conocida — RCE via eval()
  ✗ VULN  eval(1+1) → result=2 — ejecución de código confirmada
  ✗ VULN  eval(process.env) → 12 variables de entorno accesibles
  ✗ VULN  eval(require('fs').readdirSync('.')) → listado del sistema de archivos

[ 6/6 ] Inyección SQL
  ✓ PASS  SQLi [OR clásico] → 401 (sin bypass)
  ✓ PASS  SQLi [OR con comentario] → 401 (sin bypass)
  ✓ PASS  SQLi [terminación de string] → 401 (sin bypass)
  ✓ PASS  SQLi [statement destructivo] → 401 (sin bypass)
  ✓ PASS  SQLi [UNION probe] → 401 (sin bypass)

════════════════════════════════════════
  Resumen DAST — 30 verificaciones
════════════════════════════════════════
  Pasaron:      22
  Fallaron:     7
  Advertencias: 1
```

| Check | Estado | Detalle |
|---|---|---|
| Headers de seguridad | ✗ 4 ausentes | `X-Content-Type-Options`, `X-Frame-Options`, `CSP`, `Referrer-Policy` — solucionable con `helmet` |
| Autenticación | ✅ 5/5 | Credenciales inválidas y SQL injection rechazados correctamente |
| JWT | ✅ 5/5 | Payload tamperado y `alg=none` rechazados con 401 |
| RBAC | ✅ 6/6 | Viewer bloqueado en todas las operaciones de escritura |
| RCE (eval) | ✗ 3 VULN | Endpoint `debug/eval` ejecuta código arbitrario — intencional para demo SAST |
| SQL Injection | ✅ 5/5 | Ningún payload bypasea la autenticación |

---

### DAST — OWASP ZAP Baseline Scan

OWASP ZAP (Zed Attack Proxy) es el escáner DAST open source más utilizado de la industria. En modo **baseline scan** realiza un spider pasivo de la aplicación y aplica reglas de detección sin lanzar ataques activos — apto para entornos de CI/CD.

Corre como servicio Docker con perfil `dast`, conectado a la red interna de Docker Compose para alcanzar la API en `http://api:4000` directamente.

#### Integración en Docker Compose

```yaml
zap:
  image: ghcr.io/zaproxy/zaproxy:stable
  profiles: ["dast"]           # no inicia con docker compose up
  depends_on:
    api:
      condition: service_healthy
  volumes:
    - ./dast/reports:/zap/wrk:rw
  command: >-
    zap-baseline.py -t http://api:4000
    -r zap-report.html -J zap-report.json -l WARN -I
```

#### Resultado actual

```
Total of 4 URLs
WARN-NEW: Server Leaks Information via "X-Powered-By" [10037] x 4
WARN-NEW: CSP: Failure to Define Directive with No Fallback [10055] x 4
WARN-NEW: Permissions Policy Header Not Set [10063] x 4

FAIL-NEW: 0  WARN-NEW: 3  PASS: 63
```

| Alerta ZAP | Regla | Descripción |
|---|:---:|---|
| `X-Powered-By: Express` expuesto | 10037 | Revela el stack tecnológico — facilita fingerprinting |
| Content-Security-Policy ausente | 10055 | Sin directiva `default-src` ni fallback — exposición a XSS |
| `Permissions-Policy` ausente | 10063 | Sin control de permisos del navegador (cámara, micrófono, geolocalización) |

**63 reglas pasadas** sin ningún FAIL. Los 3 warnings coinciden con los hallazgos del script dirigido, validando ambas herramientas de forma independiente.

> Los warnings de headers se corrigen agregando `helmet` a Express: `app.use(require('helmet'))`. Helmet configura automáticamente los 10+ headers de seguridad recomendados.
