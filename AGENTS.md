# AGENTS.md — Personal Data Hub

Guidance for AI coding agents working in this repository. Verified against the code in this repo (not only the README). Anything not verifiable is marked `TODO: confirm`.

---

## 1. Critical rules (read first)

**Security (non-negotiable)**

- Never add network calls, telemetry, analytics, crash reporting or external API requests. The app is offline-first.
- Known exception: the renderer calls `https://countriesnow.space` for country/state/city dropdowns in `app/auth/register/RegisterForm.js` and `components/settings/SettingsProfilePanel.jsx`. Do not add more external calls. TODO: confirm whether this should be removed or made offline.
- Never log, print, hard-code, or commit secrets, passwords, keys, decrypted vault/notes/todo data, or real user data. This includes test fixtures.
- Never weaken or bypass encryption, key storage (keytar), or role checks.
- The sysadmin must stay blocked from vault, notes and todos. Do not add code that lets an admin read those.
- Never change an encryption format, DB schema, or on-disk JSON shape without a written migration plan and a backward-compatible read path.
- Keep Electron security settings: `contextIsolation: true`, `nodeIntegration: false` in the renderer, and validate all IPC inputs in the main process.
- Do not add dependencies without justification. Native modules need extra scrutiny (ABI rebuilds, packaging, CI).
- Do not modify source code unless the task asks for it. Documentation tasks touch only docs.

**Architecture (non-negotiable)**

- The renderer (Next.js, React) has no Node access. All privileged work happens in the Electron main process (`electron/`, `database/`, `lib/`).
- The only bridge is `window.electronAPI`, defined in [electron/preload.js](electron/preload.js). Every channel must have a matching `ipcMain.handle`/`ipcMain.on` in `electron/ipc/`.
- Renderer-side checks (hidden sections, timers, routing) are UX only. Authorization must be enforced in the main process.

**Known deviations (do not assume these are secure)**

- MFA is client-side routing. `auth:mfa:verify-login` does not mark the main-process session as MFA-verified.
- Vault, notes, todos and several finance reads check only that a vault key exists, not `isAdmin`. The admin block is UI-only.
- `auth:register` takes `isAdmin` from the renderer. No main-process check exists that only one sysadmin can be created (the README says so).
- Password hashes use PBKDF2 with 1000 iterations and a non-constant-time comparison.
- `mfa_secret` (TOTP secret) and password hashes are stored unencrypted in `data/master.db`.
- Word and Excel exports write plaintext data to a user-chosen path with no warning.
- `settings:getProfile` accepts a `userId` from the renderer without an ownership check.

---

## 2. Project overview

| Item | Value (source) |
|---|---|
| Name | `personal-data-hub` (`package.json`) |
| Version | `1.2.0` (`package.json`). README badge says `1.1.1`. Mismatch. |
| Purpose | Personal, single-machine desktop app: password vault, secure notes, to-dos/reminders, bank accounts, statement import and analytics, investments, reports, Word/Excel export. |
| Offline-first | All data stays on the local machine, under Electron's `userData` directory. No server. |
| Target users | Individuals managing their own data. Multiple local accounts are supported, with a single `sysadmin` account for user administration (README). |
| Platforms | macOS (dmg, zip), Linux (AppImage, deb), Windows (nsis) per `build` config. |
| Language | JavaScript and JSX. No TypeScript sources. `jsconfig.json` only. |
| License | TODO: confirm (no LICENSE check performed) |

---

## 3. Tech stack (from `package.json` and installed `node_modules`)

| Library | Version | Role |
|---|---|---|
| `electron` | 41.2.0 | Desktop shell, main process, `protocol`, `Notification`, `dialog`, `Menu` |
| `next` | 16.2.3 | Renderer UI. Static export (`output: "export"`) to `out/` |
| `react` / `react-dom` | 19.2.4 | UI |
| `babel-plugin-react-compiler` | (dev) | Enabled via `reactCompiler: true` in [next.config.mjs](next.config.mjs) |
| `better-sqlite3` | 12.9.0 | Plain SQLite: `data/master.db` |
| `better-sqlite3-multiple-ciphers` | 12.9.0 | Encrypted SQLite (SQLCipher-compatible): `data/finance.db` |
| `keytar` | 7.9.0 | OS keychain for the per-user vault key and the finance DB key |
| `crypto-js` | declared | **Unused** in code |
| `bcryptjs` | declared | **Unused** in code (hashing uses Node `crypto.pbkdf2Sync`) |
| `lowdb` | declared | **Unused** in code (vault is a custom JSON store) |
| `speakeasy` | declared | TOTP generation and verification (MFA) |
| `qrcode` | declared | QR code for MFA setup |
| `docx` | declared | Word export (`vault:exportPasswords`, `vault:exportNotes`) |
| `xlsx` | declared | Excel export (`investments:exportToExcel`) and statement parsing |
| `pdf-parse` | declared | PDF parser code exists (`lib/parsers/pdfParser.js`), but `electron/ipc/finance/import.js` rejects PDFs, so it is not reachable from the UI |
| `csv-parse` | declared | CSV statement parsing (TODO: confirm call site) |
| `recharts` | declared | Charts in finance and report components |
| `marked` | declared | Help window markdown rendering in [electron/help.js](electron/help.js) |
| `uuid` | declared | IDs for todos (`todos.id` is a UUID string) |
| `electron-builder` | 25.1.8 | Packaging (dev dependency) |
| `electron-rebuild` | 3.2.9 | Native rebuild, run in `postinstall` for `keytar` only |
| `eslint` | 9.39.4 | Lint (flat config) |
| `eslint-config-next` | (dev) | Next rules (`core-web-vitals`) |
| `concurrently`, `wait-on`, `nodemon`, `cross-env` | (dev) | Dev orchestration |

Notes:
- `@electron/rebuild` is a devDependency, but `postinstall` uses `electron-rebuild`. TODO: confirm both are needed.
- `sharp` is required by [scripts/generate-icon.js](scripts/generate-icon.js) but is **not declared** in `package.json`. Install it before running that script. TODO: confirm.
- No test framework is installed. No Prettier config exists.

---

## 4. Architecture

### 4.1 Process model

```
┌──────────────────────── Electron main process (Node) ────────────────────────┐
│ electron/main.js                                                             │
│  - app:// protocol handler serving out/ (prod)                              │
│  - BrowserWindow (contextIsolation: true, nodeIntegration: false)           │
│  - registerAllHandlers()  (electron/ipc/index.js)                            │
│  - in-memory session (electron/ipc/auth.js → getSession/setSession)          │
│  - vault JSON store, finance DB, master DB, keytar                           │
│  - reminder scheduler (electron/ipc/todos/todos.js, 60 s interval)           │
└───────────────────────────▲──────────────────────────────────────────────────┘
                            │ ipcMain.handle("ns:action", …)
┌───────────────────────────┴──── preload (electron/preload.js) ───────────────┐
│ contextBridge.exposeInMainWorld("electronAPI", {...})                        │
└───────────────────────────▲──────────────────────────────────────────────────┘
                            │ window.electronAPI.<ns>.<fn>(...)
┌───────────────────────────┴──── Renderer (Next.js static export) ────────────┐
│ app/ (App Router, JS), components/, hooks/, lib/                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Loading the UI

| Mode | Source | Mechanism |
|---|---|---|
| Production (packaged) | `out/` (static export) | `protocol.handle("app", …)` in `main.js` serves files from `out/`. Falls back to `out/index.html`. Returns 204 for `_rsc=` and `__nextDataReq` requests. Has a path-prefix check against traversal. Window loads `app://./index.html`. |
| Development | `next dev -p 4000` | `isDev = process.env.NODE_ENV === "development"` in `main.js`. Window loads `http://localhost:4000` and opens DevTools. |

- `next.config.mjs` sets `output: "export"`, `distDir: "out"`, `trailingSlash: true`, `assetPrefix: ""`.
- `npm run start` (`next start -p 4000`) does not work with `output: "export"`. Treat it as unsupported. TODO: confirm.
- `electron-dev` does not reliably set `NODE_ENV` for Electron (see §14). If Electron loads the stale `out/` build in dev, that is the cause.

### 4.3 IPC conventions

- Channel names are `namespace:action` or `namespace:sub:action`, e.g. `auth:login`, `auth:mfa:verify-setup`, `vault:getAll`, `finance:getStatements`, `todos:syncVaultReminders`.
- Handlers return `{ success: boolean, ... }` objects. Some return data directly. Check the handler before using a new channel.
- Main process must validate every argument type and range. Renderer data is untrusted, even though it's the local UI.
- The renderer should never receive the vault key. `auth:session` returns only safe fields.

### 4.4 Preload API surface

Namespaces exposed on `window.electronAPI`, from [electron/preload.js](electron/preload.js):

| Namespace | Example channels |
|---|---|
| top-level | `register` (`auth:register`), `login`, `logout`, `getSession` (`auth:session`), `setHelpSection` (`help:setSection`) |
| `auth.mfa` | `auth:mfa:setup`, `auth:mfa:verify-setup`, `auth:mfa:verify-login`, `auth:mfa:reset` |
| `vault` | `vault:getAll`, `vault:add`, `vault:update`, `vault:delete`, `vault:exportPasswords`, `vault:exportNotes` |
| `notes` | `notes:*` (in `electron/ipc/vault/vault.js`) |
| `todos` | `todos:add`, `todos:update`, `todos:syncVaultReminders`, and CRUD |
| `banks` | `banks:*` (`electron/ipc/finance/banks.js`) |
| `accounts` | `accounts:add`, `accounts:update`, and reads |
| `investments` | `investments:*`, `investments:exportToExcel` |
| `finance` | `finance:selectStatementFile`, `finance:importStatements`, `finance:getStatements`, `finance:getStatementTransactions`, `finance:getTrendData`, `finance:clearStatementData`, `finance:addInstrumentType`, `finance:addInvestmentType` and related |
| `settings` | `settings:getProfile`, `settings:updateProfile`, `settings:changePassword` |
| `admin.users` | `admin:users:*`, including `admin:users:resetPassword` |

Verification: every channel in the preload has a handler in `electron/ipc/index.js`'s `registerAllHandlers`. Some handler declarations span several lines, so use multi-line search (`ipcMain.handle(\n`) when checking.

### 4.5 Help window

- `electron/help.js` opens a `data:` URL window that renders `help/*.md` with `marked`.
- `help:setSection` is an `ipcMain.on` channel that calls `require("../main").setCurrentSection`. This is a circular require. Avoid expanding it.

---

## 5. Repository structure

```
personal-data-hub/
├── AGENTS.md                  This file
├── README.md                  User-facing README (partly out of date, see §15)
├── package.json               Scripts, deps, electron-builder config
├── next.config.mjs            Next static export config
├── eslint.config.mjs          ESLint flat config (next core-web-vitals)
├── jsconfig.json              Path alias config (no tsconfig.json)
├── .gitignore                 Ignores node_modules, .next, out, dist, .env*, *.pem
├── app/                       Next.js App Router pages (renderer)
│   ├── page.js                Root: session check and redirect
│   ├── auth/                  login, register, verify-mfa, setup-mfa, reset-password, mfa-help
│   ├── dashboard/             Main dashboard (role gating in page.js), todos/ subroute
│   ├── finance/page.jsx       Finance/statements page
│   └── layout.js, globals.css
├── components/                React UI sections
│   ├── vault/                 PasswordsSection.js (calls todos:syncVaultReminders)
│   ├── notes/                 NotesSection.js
│   ├── finance/               BanksSection.jsx, charts and reports
│   └── …                      Settings, admin, dashboard widgets
├── hooks/
│   └── useInactivityLogout.js 5-minute renderer-only inactivity timer
├── lib/                       Renderer and shared helpers, including lib/db/bank.js (BankRepository)
├── constants/
│   ├── vaultSchemas.js        VAULT_SCHEMAS (bank, email, pan, pran, aadhaar, mf, passport, visa, customExpiry, custom) and NOTE_SCHEMA
│   └── sections.js            Sidebar sections and nav groups
├── types/                     JSDoc typedefs (e.g. types/bank.js)
├── electron/                  Main process
│   ├── main.js                Window, app:// protocol, lifecycle, menu, scheduler start/stop
│   ├── preload.js             contextBridge API (window.electronAPI)
│   ├── help.js                Help window (marked + data: URL)
│   ├── vault/vaultDb.js       AES-256-GCM JSON vault store, one file per user
│   └── ipc/
│       ├── index.js           registerAllHandlers()
│       ├── auth.js            register, login, logout, session, MFA
│       ├── settings/          profile, password change
│       ├── admin/users.js     user list, reset password (admin only)
│       ├── vault/vault.js     vault CRUD, notes CRUD, Word exports
│       ├── todos/todos.js     todo CRUD, reminder scheduler, vault-expiry reminders
│       ├── finance/           banks.js, investments.js, import.js (statements)
├── database/
│   ├── dbPath.js              getDbDir() = userData/data
│   ├── master/masterdb.js     Plain SQLite master.db: users, todos
│   ├── finance/financeDb.js   Encrypted finance.db: banks, accounts, investments, statements, transactions, summaries
│   └── migrations/006_add_bank_and_admin_features.sql   NOT applied by any code (see §15)
├── help/*.md                  In-app help topics (dashboard, passwords, notes, todos, banks, investments, reports-investments, settings-*, admin-users)
├── scripts/generate-icon.js   Icon generation (sharp), writes build/icon.*
├── public/                    Static assets (default Next SVGs)
├── build/                     Icons: icon.icns, icon.ico, icon.png, icon.iconset/
├── out/                       Next static export. Generated. Gitignored. Loaded in prod.
├── .next/                     Next build cache. Generated. Gitignored.
└── dist/                      electron-builder output (DMG, zip, etc.). Generated. Gitignored.
```

Generated folders: `out/`, `.next/`, `dist/`, `node_modules/`. Never edit them by hand.

---

## 6. Data layer

### 6.1 Storage locations

All runtime data lives under Electron's `userData` directory: `app.getPath("userData")/data` (from `database/dbPath.js`).

| File | Format | Encryption | Contents |
|---|---|---|---|
| `data/master.db` | SQLite (`better-sqlite3`) | None | `users`, `todos` |
| `data/vault_<username>.json` | JSON | Entries are AES-256-GCM encrypted per entry | `{ entries: [], notes: [] }` |
| `data/finance.db` | SQLite (`better-sqlite3-multiple-ciphers`) | Whole-file, `PRAGMA key` | Bank, account, investment, and statement tables |
| keychain (keytar) | OS keychain | OS-managed | Per-user vault key; finance DB key |

Lowdb is declared, but there is no lowdb code. The vault is a custom JSON file.

### 6.2 master.db schema

**`users`**

| Column | Notes |
|---|---|
| `id` | Primary key |
| `first_name`, `last_name` | Names |
| `username` | UNIQUE. Used in file names (`vault_<username>.json`) and as the keytar account. No validation regex. |
| `email`, `phone`, address fields | Contact data (PII) |
| `salt` | Random salt for PBKDF2 |
| `password_hash` | PBKDF2-SHA512, 1000 iterations, 64 bytes |
| `vault_path` | Stored path (TODO: confirm usage) |
| `requires_password_reset` | Forces reset after login |
| `is_admin` | Sysadmin flag. Added by an ad-hoc migration. |
| `mfa_secret` | **Plaintext** base32 TOTP secret |
| `mfa_enabled` | 0 or 1 |
| `created_at`, `updated_at` | Timestamps |

**`todos`** (shared across all users, there is no `user_id`)

| Column | Notes |
|---|---|
| `id` | TEXT UUID |
| `title`, `notes`, `priority`, `status`, `due_date`, `remind_at` | |
| `reminded` | 0/1 |
| `source` | `manual` or `vault` |
| `source_ref` | For vault reminders, the vault entry id (dedupe key) |
| `created_at`, `updated_at` | |

Migrations are ad-hoc: `PRAGMA table_info` checks followed by `ALTER TABLE`. Add new columns the same way.

### 6.3 Vault store (`electron/vault/vaultDb.js`)

- File: `data/vault_<username>.json`. Shape: `{ entries: [], notes: [] }`.
- Entry: `{ id, type, data, createdAt, updatedAt }`.
- `data` is an encrypted string: `iv_hex:authTag_hex:cipher_hex`. AES-256-GCM with a 12-byte IV.
- Key: the per-user 32-byte hex key from keytar (service `MyMultiUserVault`, account = username).
- `initVault(username, key)` loads the file on login. `closeVault()` runs on logout and on quit.
- Notes use the same encryption and live in the `notes` array.
- Entry types are defined in `constants/vaultSchemas.js`. Field-level encryption is handled in `vault.js`. TODO: confirm whether each field or the whole `data` object is encrypted.

### 6.4 Finance DB (`database/finance/financeDb.js`)

- Encrypted with `better-sqlite3-multiple-ciphers` and `PRAGMA key`.
- Key: one app-wide random 32-byte hex key. Stored in keytar with service `personal-data-finance`, account `finance-db-key`. Created on first use.
- Opened by `initFinanceDb()` on login. Closed by `closeFinanceDb()` on `window-all-closed`.

Tables:

| Table | Key columns and relationships |
|---|---|
| `bank_master` | Bank catalogue (shared) |
| `user_bank_accounts` | `user_id` owner. Links to `bank_master`. |
| `instrument_types` | Seeded: FD, MF, LIC, NPS, MI, ELSS, PPF, BONDS, LUMPSUM, SIP, SWP, STP (names as in code) |
| `investment_types` | Seeded instrument-type reference |
| `investments` | Per-user holdings |
| `statements` | One row per imported file |
| `statement_raw_data` | Raw parsed rows |
| `transactions` | UNIQUE (`fingerprint_hash`, `account_id`). De-duplication key. |
| `transaction_summaries` | UNIQUE (`account_id`, `date`) |
| `transaction_summaries_weekly`, `_monthly`, `_yearly` | Rollups |

Per-user separation: handlers check `account.user_id !== session.userId` (finance) and `session.userId` on writes. Read paths must do the same check.

Note: `electron/ipc/finance/import.js` deletes from `transaction_summaries_daily`, which is never created. `safeDelete` swallows the error. Harmless but stale.

### 6.5 Key management

| Secret | Store | Notes |
|---|---|---|
| Per-user vault key | keytar: service `MyMultiUserVault`, account `<username>` | Set at register. Read at login. |
| Finance DB key | keytar: service `personal-data-finance`, account `finance-db-key` | App-wide, not per user |
| Password | PBKDF2-SHA512, 1000 iterations, `salt` in `users` | Weak. See §15. |
| MFA secret | `users.mfa_secret`, **plaintext** | Deviation |

- `bcryptjs` and `crypto-js` are not used. Do not switch hashing or encryption without a migration plan.
- Node's built-in `crypto` is used for PBKDF2 and AES-GCM.

### 6.6 Per-user separation

- Vault: separate file per username, and the key is per user.
- Finance: a single DB file, separated by `user_id` / `account_id` checks.
- Todos: **not separated**. The `todos` table has no `user_id`. This is a known gap.

---

## 7. Authentication, authorization and roles

### 7.1 Login flow (`electron/ipc/auth.js`)

1. `auth:login` loads the user row, checks PBKDF2 (`===` comparison).
2. Gets the vault key from keytar.
3. Sets the in-memory session: `{ userId, username, vaultKey, names, isAdmin }`.
4. Calls `initVault` and `initFinanceDb`. **The vault opens before MFA.**
5. Returns flags: `requiresPasswordReset`, `requiresMfa` (mfa_enabled=1), `mfaSetupRequired` (mfa_enabled=0).

Renderer routing ([app/auth/login/LoginForm.js](app/auth/login/LoginForm.js) lines ~56–67): `requiresPasswordReset` → `reset-password`, `mfaSetupRequired` → `setup-mfa`, `requiresMfa` → `verify-mfa`, otherwise → dashboard.

### 7.2 Registration

- `auth:register` writes the `users` row and calls `keytar.setPassword("MyMultiUserVault", username, randomKeyHex)`. There is no transaction, so a failure can leave a DB row without a key, or a key without a row.
- `isAdmin` comes from the renderer. The UI `app/auth/register/RegisterForm.js` has admin defaults (`System`, `Administrator`, `sysadmin`). No server-side check enforces one sysadmin, or that the caller is an admin.
- Username has no validation. It is used in file paths and keychain accounts. Add validation before changing this.

### 7.3 MFA

- Setup: `auth:mfa:setup` generates a speakeasy secret, saves it to `users.mfa_secret`, and returns a QR code (`qrcode`).
- Verify setup: `auth:mfa:verify-setup` uses `speakeasy.totp.verify` with window 1, then sets `mfa_enabled=1`.
- Verify login: `auth:mfa:verify-login` checks the TOTP. **It does not set any flag in the main-process session.** The renderer then routes to the dashboard. Data access is not gated by MFA.
- Reset: `auth:mfa:reset` requires `session.isAdmin`.
- Setup and verify pages: `app/auth/setup-mfa/page.js` and `app/auth/verify-mfa/page.js`. Help: `app/auth/mfa-help/page.js`.

Fixing this requires a main-process "mfaVerified" flag that gates vault and finance handlers. Do not add it without testing.

### 7.4 Session and logout

- The session is a module-level object in `auth.js`. `getSession()` returns it by reference. Do not mutate it from other modules.
- `auth:session` returns only safe fields (never `vaultKey`).
- `auth:logout` calls `clearSession`, which nulls the session and calls `closeVault`.

### 7.5 Inactivity timeout

- [hooks/useInactivityLogout.js](hooks/useInactivityLogout.js): 5-minute timer (`TIMEOUT_MS`). Resets on mouse, key, scroll and touch events. Skips `/auth` paths.
- [app/dashboard/page.js](app/dashboard/page.js) `handleInactivityLogout`: calls `logout()`, sets `localStorage.sessionTimedOut`, and redirects to `/auth/login?reason=inactive`.
- **Renderer-only.** The main process keeps the session until `auth:logout` is called. A compromised renderer can still call IPC.

### 7.6 Roles

| Role | Flag | Can | Cannot (intended) |
|---|---|---|---|
| Regular user | `is_admin = 0` | Vault, notes, todos, finance for own data, settings | Admin functions |
| Sysadmin | `is_admin = 1` | User management, bank master, instrument/investment types, reset passwords, reset MFA, investment report | Vault, notes, todos (per README) |

Enforcement status:

| Area | Main process check | UI check |
|---|---|---|
| `admin/users.js` (list, reset password) | `session.isAdmin` ✅ | Yes |
| `auth:mfa:reset` | `session.isAdmin` ✅ | Yes |
| `finance/banks.js` (lines ~8–9) | `session.isAdmin` ✅ | Yes |
| `finance/investments.js` admin helpers (lines ~14–15) | `session.isAdmin` ✅ | Yes |
| Vault and notes (`vault.js`) | Vault key only ❌ | `AdminRestrictedSection` in `app/dashboard/page.js` (~110–165) |
| Todos (`todos.js`) | None ❌ | UI only |
| `settings:getProfile` | Takes renderer `userId`, no check ❌ | Yes |
| Finance account reads | `account.user_id === session.userId` ✅ | Yes |

Rule for new code: add `if (!session.isAdmin)` (or `if (session.isAdmin)` where blocking) in the main-process handler. Never rely on hidden UI.

---

## 8. Feature modules

For each module: files, data, and behaviour.

### 8.1 Vault (passwords and documents)
- Files: `components/vault/PasswordsSection.js`, `electron/ipc/vault/vault.js`, `electron/vault/vaultDb.js`, `constants/vaultSchemas.js`.
- Channels: `vault:getAll`, `vault:add`, `vault:update`, `vault:delete`, `vault:exportPasswords`.
- Types: `bank`, `email`, `pan`, `pran`, `aadhaar`, `mf`, `passport`, `visa`, `customExpiry`, `custom`.
- Data: encrypted entries in `vault_<username>.json`.
- Export: `dialog.showSaveDialog`, then `docx` `Packer` writes plaintext. No warning dialog. Deviation.

### 8.2 Notes
- Files: `components/notes/NotesSection.js`, `vault.js` (notes handlers), `NOTE_SCHEMA` in `constants/vaultSchemas.js`.
- Channels: `notes:*`. Export via `vault:exportNotes` (`docx`, plaintext).
- Data: encrypted, in the `notes` array of the vault file.

### 8.3 To-dos and reminders
- Files: `electron/ipc/todos/todos.js`, `components/` todo UI, `app/dashboard/todos/page.js`.
- Data: `master.db` `todos` table (shared, not per user).
- Scheduler: `startReminderScheduler()` runs `checkAndFireReminders()` immediately, then every 60 s. Stopped on `before-quit`. Runs whether or not anyone is logged in.
- Firing: selects `status='pending' AND reminded=0 AND remind_at <= now` (ISO string compare). Shows `new Notification(...)` with a priority emoji in the title. Sets `reminded=1`.
- Vault auto-reminders: `components/vault/PasswordsSection.js` decrypts entries (`vault:getAll`) and calls `todos:syncVaultReminders(entries)`.
  - `generateVaultReminders` looks at `expiryDate` and `issueDate` and creates a reminder 30 days before the date.
  - Likely bug: `issueDate` is treated as an expiry date. TODO: confirm intent.
  - Past dates are skipped.
  - Dedupe key is `source_ref = entry.id`. One reminder per entry. The first future date wins.
  - The main process trusts decrypted data sent by the renderer.

### 8.4 Banks and accounts
- Files: `electron/ipc/finance/banks.js`, `lib/db/bank.js` (`BankRepository`), `types/bank.js`, `components/finance/BanksSection.jsx`.
- Channels: `banks:*`, `accounts:*`.
- Data: `bank_master` (shared, admin-managed), `user_bank_accounts` (per user).
- Write access to `bank_master` is admin-only.

### 8.5 Investments
- Files: `electron/ipc/finance/investments.js`, `components/` investment UI, `app/` investment routes.
- Channels: `investments:*`, `finance:addInstrumentType`, `finance:updateInstrumentType`, `finance:addInvestmentType`, `finance:updateInvestmentType`.
- Data: `investments`, `instrument_types`, `investment_types` in `finance.db`.
- Export: `investments:exportToExcel` (XLSX via `XLSX.writeFile`).
- Admin-only: type catalogue management.
- Reads of investments: vault-key check only. See §7.6.

### 8.6 Statements and charts
- Files: `electron/ipc/finance/import.js`, `components/finance/` charts, `app/finance/page.jsx`.
- Channels: `finance:selectStatementFile`, `finance:importStatements`, `finance:getStatements`, `finance:getStatementTransactions`, `finance:getTrendData`, `finance:clearStatementData`.
- Data: `statements`, `statement_raw_data`, `transactions` (dedup by fingerprint), summary tables.
- Charts: `recharts`.

### 8.7 Reports
- Investment report: `reports-investments` section, admin-visible (per `constants/sections.js`). TODO: confirm whether regular users can see it.

### 8.8 Admin panel
- Files: `electron/ipc/admin/users.js`, `components/` admin UI, `settings-banks`, `settings-instrument-types`, `settings-investment-types`, `admin-users` sections in `constants/sections.js`.
- Channels: `admin:users:*`, including `admin:users:resetPassword`.
- Sysadmin only (main-process check).

### 8.9 Settings and password change
- Files: `electron/ipc/settings/settings.js`, settings UI.
- Channels: `settings:getProfile` (no ownership check, deviation), `settings:updateProfile` and `settings:changePassword` (use `session.userId`).

### 8.10 Word and Excel export
- `docx` for passwords and notes (`vault.js` ~lines 566–790). `xlsx` for investments.
- Both write plaintext. The path is chosen by the user through a save dialog.

---

## 9. Setup and commands

Only commands that exist in `package.json`:

| Task | Command |
|---|---|
| Install (runs `postinstall`) | `npm install` |
| Rebuild keytar for Electron | `npm run postinstall` (runs `electron-rebuild -f -w keytar`) |
| Next dev server only | `npm run next-dev` (port 4000) |
| Electron dev (watch) | `npm run electron-dev` |
| Dev (both) | `npm run dev` (concurrently) |
| Next build (static export) | `npm run build` |
| Start Next server | `npm run start` (port 4000; not for static export, see §4.2) |
| Package (macOS) | `npm run dist:mac` |
| Package (Linux) | `npm run dist:linux` |
| Package (Windows) | `npm run dist:win` |
| Lint | `npx eslint .` (no npm script) |

Missing from `package.json`: test, format, typecheck. There are no test files outside `node_modules` and `dist`.

Lint baseline:
- `npx eslint .` reports 6 problems (5 errors, 1 warning). Five of them are in `dist/` build output. `eslint.config.mjs` ignores `.next`, `out`, `build` but not `dist/`.
- Source-only (`npx eslint app components hooks electron lib database constants types scripts`): 3 errors, 1 warning:
  - `app/auth/login/LoginForm.js` 21:13: `react-hooks/set-state-in-effect`
  - `components/notes/NotesSection.js` 25:9: `react-hooks/set-state-in-effect`
  - `components/finance/BanksSection.jsx` 67:56: `react/no-unescaped-entities`
  - `app/auth/setup-mfa/page.js` 66:33: `@next/next/no-img-element` (warning)
- Do not fix these in unrelated work. If you touch those files, fix the one you changed.

Native module note: `postinstall` only rebuilds `keytar`. `better-sqlite3` and `better-sqlite3-multiple-ciphers` may need rebuilding against Electron's ABI. TODO: confirm (run `npm run electron-dev` on a fresh install and check the logs).

---

## 10. Coding conventions

Inferred from the code and ESLint config. Verify before changing.

- Language: JavaScript and JSX. Keep new code in JS/JSX to match the repo. Do not add TypeScript without a request.
- Modules: ESM in the renderer (`import`/`export`). CommonJS in `electron/` (`require`), except `main.js` and `electron/ipc/index.js` (TODO: confirm all `electron/` files).
- Naming: camelCase for functions and variables. PascalCase for React components and their files (`PasswordsSection.js`). `.jsx` is used for some components. Mixed usage. Follow the folder's existing style.
- IPC names: `namespace:action`, lowercase.
- Components: function components with hooks. React Compiler is on, so avoid manual `useMemo`/`useCallback` unless required.
- Styling: `app/globals.css` plus component-level styles. TODO: confirm CSS approach (no Tailwind config seen).
- State: local React state per component, plus the session from `auth:session`. No global store library found.
- Errors: IPC handlers return `{ success: false, error }`. Renderer shows messages in the component. Do not log secret values in errors.
- Comments: only where the logic needs clarification. Do not add decorative comments.
- JSDoc typedefs in `types/` (e.g. `types/bank.js`).
- ESLint: `eslint-config-next/core-web-vitals`. Flat config in `eslint.config.mjs`.
- Prettier: none. Match the surrounding file's indentation and quote style.
- tsconfig: none. `jsconfig.json` only (path aliases). TODO: confirm alias list.

---

## 11. Testing and verification

### 11.1 Automated checks
- No test framework or test files exist. Do not claim tests pass.
- Available check: `npx eslint .`, or the source-only variant in §9.
- Build check: `npm run build` (overwrites `out/` and `.next/`). Run it when a change affects the static export. TODO: confirm it succeeds on the current tree.

### 11.2 Manual verification after changes

Run `npm run dev` (or `npm run electron-dev`) and check:

1. **Register**: create a user. Confirm a `users` row and a keychain entry (`MyMultiUserVault`).
2. **Login**: correct and wrong password. Confirm the redirect for `requiresPasswordReset`, `mfaSetupRequired` and `requiresMfa`.
3. **MFA**: setup (QR), verify setup, verify login with a valid and an invalid code.
4. **Vault round trip**: add a password entry, quit, relaunch, log in, confirm the entry decrypts. Confirm the JSON on disk contains only ciphertext in `data`.
5. **Notes round trip**: same as vault.
6. **Role restrictions**: sysadmin sees admin sections. Regular user cannot call `admin:users:*` (try from DevTools). Confirm the UI blocks vault/notes/todos for sysadmin, and note that the main process currently does not.
7. **Finance**: import a statement, confirm rows in `finance.db`. Confirm another user cannot read the account.
8. **Reminders**: create a todo with `remind_at` one minute ahead. Confirm the notification fires once.
9. **Inactivity**: wait 5 minutes (or temporarily lower `TIMEOUT_MS` locally, and revert). Confirm redirect to `/auth/login?reason=inactive`.
10. **Packaged build**: `npm run dist:mac` on macOS. Open the app from `dist/`. Confirm the UI loads via `app://`, login works, and the DB is in the `userData` path.
11. **Other OS**: build on Linux and Windows if your change touches packaging, native modules, keychain, or paths. TODO: confirm that cross-OS builds were ever verified.

### 11.3 Pre-commit checklist

- [ ] `git status` shows only the intended files (no `out/`, `dist/`, `.next/`, `data/`).
- [ ] No secrets, keys, real user data, or decrypted content in the diff.
- [ ] No new network calls, telemetry or external URLs (the existing countriesnow.space calls are the only exception).
- [ ] New IPC channels exist in `preload.js` and `registerAllHandlers`, and validate their inputs.
- [ ] Any new privileged action checks `session` and `session.isAdmin` in the main process.
- [ ] No changes to encryption, key storage, or schema without a migration plan.
- [ ] `npx eslint` on the changed folders shows no new errors.
- [ ] Manual checks in §11.2 that match the change are done.
- [ ] Docs updated if behaviour changed (this file, `README.md`, `help/*.md` as relevant).

---

## 12. Packaging and release

- Config: `build` in `package.json`.
  - `appId`: `com.personal.data`. `productName`: `Personal Data Hub`.
  - `asar: false`.
  - `files`: `electron/**`, `database/**`, `help/**`, `lib/**`, `out/**`, `package.json`.
  - `extraResources`: copies `database/`.
- Targets:
  - macOS: dmg and zip (arm64 and x64 per `dist/`; TODO: confirm arch list).
  - Linux: AppImage and deb.
  - Windows: nsis.
- Signing: `mac.identity` is `null`. The build is **unsigned and not notarised**, as the README says. macOS Gatekeeper will block the app for other users.
- Output: `dist/` (gitignored). A macOS arm64 DMG and zip from an earlier build are present locally (dated Sep 1). Not current. TODO: confirm.
- Platform caveats (from README, not configured in `package.json`):
  - Linux AppImage may need `--no-sandbox`. TODO: confirm.
  - Linux keychain requires libsecret and a running secret service (e.g. gnome-keyring). Without it, keytar calls fail and login cannot get the vault key. TODO: confirm behaviour.
- Icons: generate with `node scripts/generate-icon.js` (uses `sharp`). Writes to `build/`.

---

## 13. Common pitfalls and gotchas

- **Native module ABI**: `keytar` is rebuilt for Electron in `postinstall`. `better-sqlite3` variants are not. After changing Electron versions, run `npm run postinstall` and check for `NODE_MODULE_VERSION` errors. TODO: confirm.
- **Port 4000**: `next-dev`, `start`, and the Electron dev URL all use 4000. A stale process causes the window to show an old UI or fail. Find it with `lsof -i :4000` and stop that PID.
- **`electron-dev` and `NODE_ENV`**: `cross-env NODE_ENV=development wait-on … && nodemon … electron` sets `NODE_ENV` only for `wait-on`. Electron then starts without it, so `isDev` is false and the window loads `app://` from the stale `out/`. Verified by a scoping test. TODO: confirm by running the app. To fix, set the env for the whole chain (not in scope for doc changes).
- **Dev vs packaged paths**: dev loads `http://localhost:4000`. Packaged loads `app://./index.html` from `out/` inside the asar-less bundle. Asset paths must work for both (`assetPrefix: ""`, `trailingSlash: true`).
- **`out/` is stale**: rebuild with `npm run build` after UI changes before testing `electron-dev` or packaged builds.
- **Keychain on Linux**: no secret service means login fails. Check the keytar error first.
- **Vault key lifetime**: the key lives in the in-memory session until logout. Quitting clears it.
- **Vault before MFA**: the vault file is loaded at password login, before MFA. Do not assume MFA gates data.
- **Todos are shared**: any user sees all todos. Do not add features that assume per-user todos without a schema change.
- **Reminders run without login**: the scheduler fires for todos from any user.
- **Circular require**: `electron/ipc/index.js` `help:setSection` requires `../main`. Changing `main.js` exports can break it.
- **Unused deps**: `lowdb`, `bcryptjs`, `crypto-js`. Do not assume they're used, and do not "fix" hashing by switching to them without a migration.
- **Migration 006 is not applied**: `database/migrations/006_add_bank_and_admin_features.sql` is not run by any code. Schema changes are in the ad-hoc migration functions in `masterdb.js` and `financeDb.js`.
- **Stale delete**: `transaction_summaries_daily` in `import.js` does not exist. Harmless.
- **Username in paths**: `vault_<username>.json`. Characters like `/` or `..` would be dangerous. Validate usernames before using them in paths.
- **Dist noise**: `npx eslint .` lints `dist/` build output and fails. Lint the source folders instead.
- **Version mismatch**: `package.json` 1.2.0, README badge 1.1.1.

---

## 14. Electron security posture

| Setting | Current | Target |
|---|---|---|
| `contextIsolation` | `true` | Keep |
| `nodeIntegration` | `false` | Keep |
| `sandbox` | Not set (default) | `true` if compatible. TODO: confirm impact on preload. |
| CSP | None found in `app/`, `components/`, `electron/`, `out/index.html` | Add a strict CSP for `app://` and `localhost` |
| IPC input validation | Partial. Many handlers check types and ownership, many do not. | Validate every argument in every handler |
| Remote content | None loaded | Keep it that way |
| `shell.openExternal` | Not used anywhere in `electron/`, `app/`, `components/` | Do not add without review |
| Plaintext exports | Word and Excel | Warn the user, or encrypt |

---

## 15. Known limitations and TODOs

**Security**
1. Sysadmin can access vault, notes and todos through IPC (UI-only block).
2. MFA is not enforced in the main process.
3. `isAdmin` accepted from the renderer at registration. No single-sysadmin rule.
4. PBKDF2 with 1000 iterations. Use a higher count, or a memory-hard KDF, with a migration path for existing hashes.
5. Password comparison uses `===`. Use `crypto.timingSafeEqual`.
6. `mfa_secret` and password hashes stored in plaintext in `master.db`.
7. `settings:getProfile` takes a renderer `userId`.
8. Plaintext Word and Excel exports, no warning.
9. Registration is not transactional (DB row and keytar key can diverge).
10. Username is not validated before use in file paths and keychain accounts.
11. Renderer-only inactivity timeout.
12. `todos` table has no owner. Data is shared across users.
13. Reminder scheduler runs without login and trusts renderer-supplied vault data.

**Correctness**
14. `issueDate` treated as expiry in `generateVaultReminders`. TODO: confirm intent.
15. `electron-dev` `NODE_ENV` scoping (§13).
16. Stale `transaction_summaries_daily` delete.
17. `help:setSection` circular require.
18. Unused dependencies: `lowdb`, `bcryptjs`, `crypto-js`. Duplicate `crypto` npm package is declared, but Node's built-in is used.
19. `database/migrations/006_add_bank_and_admin_features.sql` is not applied.
20. `@electron/rebuild` declared but not installed. Check the postinstall tool.

**Tooling**
21. No tests, no format script, no typecheck script.
22. ESLint does not ignore `dist/`.
23. Source lint errors: `set-state-in-effect` in `LoginForm.js` and `NotesSection.js`, unescaped `'` in `BanksSection.jsx`, `<img>` warning in `setup-mfa/page.js`.
24. `npm run start` is incompatible with static export. TODO: confirm.

**Packaging**
25. Unsigned, not notarised. TODO: notarisation plan.
26. Linux `--no-sandbox` and libsecret notes are not in the build config.
27. Version mismatch (1.2.0 vs README 1.1.1).

**Feature gaps**
28. README "Backup and Sync" is not present in the code. TODO: confirm by searching for sync and backup code.
29. Vault type `customExpiry` reminder logic. TODO: confirm.

