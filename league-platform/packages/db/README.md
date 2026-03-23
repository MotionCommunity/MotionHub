# @motion/db

Prisma schema and migrations for the league platform.

## Environment

Set `DATABASE_URL` (PostgreSQL), e.g. in `.env` next to this package or in the monorepo root (`league-platform/packages/db/.env` is loaded automatically when you run Prisma from this folder).

## Commands

| Script | Purpose |
|--------|---------|
| `npm run db:generate` | `prisma generate` — refresh the client after schema changes |
| `npm run db:migrate` | `prisma migrate dev` — create/apply migrations in development |
| `npm run db:migrate:deploy` | `prisma migrate deploy` — apply pending migrations (CI/production) |
| `npm run db:push` | `prisma db push` — sync schema without migration files (safe for dev when you must **not** drop data) |

## `migrate dev` wants to reset — what to do

**Why:** Prisma sees a mismatch between your **real database** and what the **migration history** would produce (e.g. missing foreign keys or indexes that the schema expects). It offers to **drop `public` and replay all migrations**, which **deletes all data**.

**Exit code 130** usually means you pressed **Ctrl+C** at the reset prompt (cancelled).

### Keep your data (typical local dev)

1. From `league-platform`:

   ```bash
   npm run db:push
   npm run db:generate
   ```

   `db:push` updates the database to match `schema.prisma` **without** wiping tables.

2. (Optional) If you use Migrate and want the baseline marked as applied so future `migrate dev` is calmer:

   ```bash
   cd packages\db
   npx prisma migrate resolve --applied 20250312120000_init_schema
   ```

   Only do this after `db push` (or you’ve confirmed the DB matches the schema). It records “this migration already ran” without executing the big `CREATE TABLE` script again.

### OK to wipe this database

If the DB is disposable (no real data):

```bash
cd packages\db
npx prisma migrate reset
```

That drops data, reapplies migrations, and runs seed if configured.

## Migrations layout

- **`20250312120000_init_schema`** — full baseline from an empty database (all tables, including `Match` Discord pod columns). This fixes shadow-database errors from an `ALTER TABLE`-only migration that ran before `Match` existed.

### New / empty database

From `league-platform` (or `packages/db`):

```bash
cd C:\Users\Halep\MotionHub\league-platform
npm run db:migrate:deploy
npm run db:generate
```

### Existing database (you previously used `db push`)

If tables **already exist**, `migrate deploy` will try to `CREATE` them again and can fail.

1. Check drift (from `packages/db`):

   ```bash
   npx prisma migrate diff --from-url "%DATABASE_URL%" --to-schema-datamodel prisma/schema.prisma --script
   ```

2. If the script is **empty** (or you’re happy with the diff), **mark the baseline as already applied** without running it:

   ```bash
   npx prisma migrate resolve --applied 20250312120000_init_schema
   ```

3. If the script shows **only** missing columns (e.g. pod fields), apply them with:

   ```bash
   npm run db:push
   ```

   then run step 2 if you still need migration history in sync.

### Windows: `EPERM` on `prisma generate`

The query engine `.dll` is locked. Try:

- Stop **Node** dev servers (`league-api`, `league-site`, etc.) and **retry**.
- Close other apps using the repo (sometimes **Cursor/VS Code** locks `node_modules`).
- Temporarily pause **real-time antivirus** scan on the project folder, or run the terminal **as Administrator** (last resort).

## Match Discord pod columns

`Match` includes optional `discordPodTextChannelId`, `discordPodVoiceAChannelId`, `discordPodVoiceBChannelId` (included in `init_schema`).
