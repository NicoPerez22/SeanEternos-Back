-- Ejecutar en el esquema de la API. Resultado esperado: 67 filas con estado OK.
-- No ejecuta procedimientos ni modifica datos.
WITH expected AS (
SELECT 'sp_ap_count_team_events' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_delete_team_events' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_get_transfer_players_with_teams' AS procedureName, 0 AS expectedParameters
UNION ALL
SELECT 'sp_ap_count_transfer_offers' AS procedureName, 2 AS expectedParameters
UNION ALL
SELECT 'sp_ap_list_transfer_offers' AS procedureName, 4 AS expectedParameters
UNION ALL
SELECT 'sp_ap_create_draft_status' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_find_tournament' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_delete_tournament_events' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_delete_tournament_reports' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_delete_tournament_rounds' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_delete_tournament_ties' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_delete_tournament_teams' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_delete_tournament_statistics' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_delete_tournament' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_get_standings' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_get_ranking_league' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_get_ranking_groups' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_get_tournament_stats' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_get_scorers' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_get_cards_leaders' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_get_team_stats' AS procedureName, 2 AS expectedParameters
UNION ALL
SELECT 'sp_ap_get_rounds_by_team' AS procedureName, 2 AS expectedParameters
UNION ALL
SELECT 'sp_ap_get_ko_rounds' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_get_draft_status' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_acquire_draft_lock' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_get_draft_teams' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_delete_draft_log' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_release_draft_players' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_get_draft_pool' AS procedureName, 0 AS expectedParameters
UNION ALL
SELECT 'sp_ap_release_draft_lock' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_get_round_teams' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_find_season_week' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_find_group_matchday' AS procedureName, 2 AS expectedParameters
UNION ALL
SELECT 'sp_ap_find_ko_round' AS procedureName, 2 AS expectedParameters
UNION ALL
SELECT 'sp_ap_find_week_assignment' AS procedureName, 4 AS expectedParameters
UNION ALL
SELECT 'sp_ap_create_week_assignment' AS procedureName, 4 AS expectedParameters
UNION ALL
SELECT 'sp_ap_assign_group_week' AS procedureName, 3 AS expectedParameters
UNION ALL
SELECT 'sp_ap_assign_ko_week' AS procedureName, 3 AS expectedParameters
UNION ALL
SELECT 'sp_ap_get_season_weeks' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_get_season_assignments' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_get_unassigned_rounds_summary' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_find_season' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_find_week_by_number' AS procedureName, 2 AS expectedParameters
UNION ALL
SELECT 'sp_ap_create_season_week' AS procedureName, 4 AS expectedParameters
UNION ALL
SELECT 'sp_ap_delete_week_assignment' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_delete_week_assignments' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_delete_season_week' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_remove_players_from_teams' AS procedureName, 0 AS expectedParameters
UNION ALL
SELECT 'sp_ap_persist_draft_assignments' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_insert_draft_log' AS procedureName, 2 AS expectedParameters
UNION ALL
SELECT 'sp_ap_get_round_result' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_get_round_result_events' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_lock_round_for_result' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_ap_replace_match_result' AS procedureName, 4 AS expectedParameters
UNION ALL
SELECT 'sp_create_match_report_draft' AS procedureName, 6 AS expectedParameters
UNION ALL
SELECT 'sp_create_tournament' AS procedureName, 6 AS expectedParameters
UNION ALL
SELECT 'sp_create_transfer_offer' AS procedureName, 4 AS expectedParameters
UNION ALL
SELECT 'sp_get_injured_players' AS procedureName, 0 AS expectedParameters
UNION ALL
SELECT 'sp_get_match_report_draft_detail' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_get_team_detail' AS procedureName, 1 AS expectedParameters
UNION ALL
SELECT 'sp_get_tournament_rounds_by_matchday_paginated' AS procedureName, 2 AS expectedParameters
UNION ALL
SELECT 'sp_list_match_report_drafts' AS procedureName, 2 AS expectedParameters
UNION ALL
SELECT 'sp_mark_round_as_null_match' AS procedureName, 4 AS expectedParameters
UNION ALL
SELECT 'sp_preview_match_report' AS procedureName, 5 AS expectedParameters
UNION ALL
SELECT 'sp_review_match_report_draft' AS procedureName, 4 AS expectedParameters
UNION ALL
SELECT 'sp_review_transfer_offer' AS procedureName, 4 AS expectedParameters
UNION ALL
SELECT 'sp_save_match_report' AS procedureName, 5 AS expectedParameters
), actual_parameters AS (
 SELECT SPECIFIC_SCHEMA, SPECIFIC_NAME, COUNT(*) AS parameterCount
 FROM information_schema.PARAMETERS
 WHERE ORDINAL_POSITION > 0 AND SPECIFIC_SCHEMA = DATABASE()
 GROUP BY SPECIFIC_SCHEMA, SPECIFIC_NAME
)
SELECT e.procedureName, e.expectedParameters,
 COALESCE(p.parameterCount, 0) AS actualParameters,
 CASE WHEN r.ROUTINE_NAME IS NULL THEN 'FALTA'
      WHEN COALESCE(p.parameterCount, 0) <> e.expectedParameters THEN 'REVISAR PARAMETROS'
      ELSE 'OK' END AS status
FROM expected e
LEFT JOIN information_schema.ROUTINES r ON r.ROUTINE_SCHEMA = DATABASE()
 AND r.ROUTINE_NAME = e.procedureName AND r.ROUTINE_TYPE = 'PROCEDURE'
LEFT JOIN actual_parameters p ON p.SPECIFIC_SCHEMA = r.ROUTINE_SCHEMA
 AND p.SPECIFIC_NAME = r.ROUTINE_NAME
ORDER BY e.procedureName;
