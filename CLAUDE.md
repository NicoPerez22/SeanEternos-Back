# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

NestJS 11 + TypeORM REST API ("API - Sean Eternos") over an existing MySQL schema for managing a league: users/auth, teams, players (transfers/offers, injuries), tournaments (rounds, matches, standings, draft, match reports), dashboard and image uploads (Cloudinary). All routes are under the global prefix `api/v1`. Code comments, messages and docs are in Spanish.

## Commands

```bash
npm run start:dev      # watch mode, loads .env-dev
npm run start:prod     # node dist/main, loads .env
npm run build          # nest build (build:dev / build:prod pick the env file)
npm run lint           # eslint --fix over src/test
npm run format         # prettier (singleQuote, trailingComma: all)

# Main test suite (stored-procedure contract tests + all src/**/*.spec.ts).
# Use this config: it maps the absolute `src/` and `shared/` imports.
node node_modules/jest/bin/jest.js --config test/stored-procedures.jest.json --runInBand

# Single test file / single test
node node_modules/jest/bin/jest.js --config test/stored-procedures.jest.json src/player/player-management.spec.ts
node node_modules/jest/bin/jest.js --config test/stored-procedures.jest.json -t "test name"

npm run test:e2e       # test/jest-e2e.json
```

Tests run without a database (services/executors are mocked).

## Environment

`src/config/resolve-env-file.ts` chooses the env file: `CONFIG_ENV_FILE` if set (npm scripts set it), else `.env` when `NODE_ENV=production`, else `.env-dev`. Variables: `MYSQLHOST/PORT/USER/PASSWORD/DATABASE`, `PORT`, `CLOUDINARY_NAME/API_KEY/API_SECRET`. Both env files are gitignored.

## Architecture

- **Module per domain** in `src/` (`auth`, `user`, `team`, `player`, `tournament`, `dashboard`, `upload`), each with controller/service/module plus `entity/` (TypeORM entities, auto-loaded via `*.entity{.ts,.js}`) and `dto/` or `models/`. Modules import each other's services directly (e.g. `TeamController` uses `TournamentService`).
- **`shared/`** sits outside `src/` and is imported by absolute path (`shared/...`, resolved through `baseUrl: ./`): the stored-procedure adapter, `ApiResponse`, and `ImagesService`.
- **Response convention**: services generally do not throw; they catch errors and return a plain object spread from `new ApiResponse()` with `{ data, httpCode, message, code }`. Follow this pattern in new service methods.
- **Auth**: JWT via `@nestjs/jwt` (registered globally in `AuthModule`, 1d expiry). There is no global guard — protected routes opt in with `@UseGuards(AuthGuard)` (`src/auth/auth.guard.ts`), which puts the payload on `request.user`. Admin role is `idRol = 1`, checked against the DB. Admin password-reset flow is documented in `docs/password-reset.md`.
- **`synchronize: false`**: entities don't fully describe the schema; never rely on TypeORM to create/alter tables.

## Database access: stored procedures

Raw SQL and QueryBuilder were migrated to MySQL stored procedures (see `sql/README.md`). Rules for new/changed DB code:

- Call procedures through `callProcedureRows` (reads) / `callProcedureCommand` (writes) in `shared/database/stored-procedure.ts`. These only accept names matching `sp_ap_[a-z0-9_]+`.
- Write procedures must end returning `ROW_COUNT() AS affectedRows` (and `LAST_INSERT_ID() AS insertId` for inserts); the adapter rejects results without it.
- Procedures are defined in `sql/stored-procedures.sql` as `DROP PROCEDURE IF EXISTS` + `CREATE PROCEDURE ... SQL SECURITY INVOKER` inside `DELIMITER $$`. They must not COMMIT/ROLLBACK/START TRANSACTION: services own transactions and pass the same `EntityManager`/`QueryRunner` as the executor.
- `test/stored-procedures.spec.ts` parses that SQL file and the TS sources, asserting every `callProcedure*` call references a defined procedure with matching `IN p_` parameter count. When adding a procedure, update `sql/stored-procedures.sql` and the expected count in `sql/verify-stored-procedures.sql` too.
- Older `sp_*` procedures (without `ap_`, e.g. `sp_get_team_detail`, `sp_create_tournament`) are called directly with `dataSource.query('CALL ...')`; their definitions live only in the database, not in this repo.
- TypeORM repositories are still used for simple CRUD.
- Draft assignments/logs are sent as JSON batches (700/800 rows) and expanded with `JSON_TABLE`.
- The actual database (dev) is **MariaDB 11.8** with non-strict `sql_mode`, even though `sql/README.md` mentions MySQL 8: invalid ENUM values (e.g. an unknown `match_events.eventType`) are stored as `''` silently, so validate in TS. Write SQL compatible with both. Several legacy SPs (`sp_recalculate_statistics`, `sp_advance_winners`, …) have a different DEFINER and their source is not readable with the API account.
- Saving a match report (`sp_save_match_report`) derives `player_tournament_cards`, `player_tournament_suspensions`, `player_unavailability` (injuries) and `tournament_statistics` from `match_events`; standings and scorers are computed on read. Editing a result goes through `sp_ap_replace_match_result` (see `sql/README.md`, "Edición de resultados").
