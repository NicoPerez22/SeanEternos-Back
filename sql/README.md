# Migración del SQL explícito a procedimientos almacenados

Archivo de instalación: [stored-procedures.sql](stored-procedures.sql).

Se migraron 60 llamadas de equipos, jugadores y torneos a 50 procedimientos con prefijo **sp_ap_**. Incluye el QueryBuilder activo, filtros opcionales, clasificaciones, calendario y persistencia del draft en lotes JSON. Los repositorios de TypeORM permanecen como estaban, según el alcance acordado.

## Importación

Requiere MySQL 8.0.21 o posterior (incluido 8.4) y el esquema existente. No es un instalador de una base vacía: no crea tablas ni carga datos.

1. Abrir stored-procedures.sql en MySQL Workbench.
2. Seleccionar como esquema predeterminado la misma base que usa la API.
3. Ejecutar el archivo completo, incluidos los delimitadores.
4. Ejecutar [verify-stored-procedures.sql](verify-stored-procedures.sql). Debe devolver 63 filas con estado OK: 50 SP nuevos y 13 preexistentes. Comprueba presencia y cantidad de parámetros, sin ejecutar lógica de negocio.
5. Desplegar la API después de importar y probar sobre una base de prueba.

Alternativamente, desde la raíz del proyecto, iniciar el cliente:

~~~text
mysql --host=TU_HOST --user=TU_USUARIO --password --database=TU_BASE --default-character-set=utf8mb4
~~~

Dentro del cliente:

~~~sql
SOURCE sql/stored-procedures.sql;
SOURCE sql/verify-stored-procedures.sql;
~~~

La cuenta que importa necesita permisos para crear y reemplazar rutinas. La cuenta de la API necesita EXECUTE y los permisos sobre tablas que ya usaba: los SP nuevos utilizan SQL SECURITY INVOKER.

Cada definición contiene DROP PROCEDURE IF EXISTS seguido de CREATE PROCEDURE. Reimportar reemplaza exclusivamente los SP incluidos con prefijo sp_ap_; no elimina tablas ni ejecuta escrituras de negocio. Revisar las concesiones específicas de rutinas después de reemplazarlas.

## Resultados y transacciones

Las lecturas nuevas devuelven un conjunto de filas. Las escrituras devuelven explícitamente affectedRows y, en los INSERT, insertId. El adaptador shared/database/stored-procedure.ts extrae ese resultado de CALL y descarta el paquete final del protocolo.

Los SP nuevos no hacen COMMIT, ROLLBACK ni inician transacciones. Los servicios mantienen sus transacciones y pasan el mismo EntityManager o QueryRunner al adaptador. Los bloqueos del draft también se adquieren y liberan en esa conexión.

Las asignaciones y logs del draft se envían como JSON parametrizado y se procesan con JSON_TABLE, manteniendo lotes de 700 y 800 registros. La selección de jugadores y las reglas del draft continúan en TypeScript.

Los listados de ofertas comparten consultas con subconsultas independientes para jugadores solicitados y ofrecidos. Esto evita multiplicar los arrays al combinar ambas relaciones y reemplaza el JSON_ARRAYAGG(DISTINCT ...) anterior de pendientes, que no es sintaxis admitida por MySQL.

## SP preexistentes

La API ya invocaba estos procedimientos, pero sus definiciones no están en el repositorio. Deben conservarse o exportarse desde la base original. El archivo no los modifica ni inventa su lógica:

- sp_create_match_report_draft
- sp_create_tournament
- sp_create_transfer_offer
- sp_get_injured_players
- sp_get_match_report_draft_detail
- sp_get_team_detail
- sp_get_tournament_rounds_by_matchday_paginated
- sp_list_match_report_drafts
- sp_mark_round_as_null_match
- sp_preview_match_report
- sp_review_match_report_draft
- sp_review_transfer_offer
- sp_save_match_report

Para trasladar la aplicación a otra base, exportar también el esquema y estos SP preexistentes.

## Validación

~~~text
npm run build
node node_modules/jest/bin/jest.js --config test/stored-procedures.jest.json --runInBand
~~~

La suite incluye las pruebas existentes y pruebas de contratos de parámetros, resultados, IDs generados, rollback, lotes JSON y filtros con paginación.

En este entorno se validaron la compilación y las pruebas sin una base de datos. No se ejecutó la importación ni se probaron los SP contra MySQL. Antes del despliegue, validar estadísticas, ofertas, bajas, semanas y draft sobre una copia del esquema real.

Se conservaron los nombres y relaciones originales, incluidos los usos de players.teamId y players.idTeam. También se conserva la eliminación de tournament_statistics: debe ser un objeto actualizable, como ya exigía el código anterior. Las entidades del repositorio no describen todas las tablas usadas; no sustituyen la validación con el esquema real.

Referencias: [CALL y sus resultados](https://dev.mysql.com/doc/refman/8.4/en/call.html), [JSON_TABLE](https://dev.mysql.com/doc/refman/8.0/en/json-table-functions.html), [funciones de agregación JSON](https://dev.mysql.com/doc/refman/8.0/en/aggregate-functions.html).
