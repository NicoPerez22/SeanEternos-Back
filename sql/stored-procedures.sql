-- MySQL 8.0.21+ / 8.4. Importar sobre la base existente ANTES de desplegar la API.
-- No crea tablas ni reemplaza los SP preexistentes de negocio.
-- Los procedimientos sp_ap_* participan en las transacciones de la API:
-- deliberadamente no contienen START TRANSACTION, COMMIT ni ROLLBACK.
-- Reimportar reemplaza exclusivamente los procedimientos sp_ap_* de este archivo.
SET NAMES utf8mb4;
DELIMITER $$

-- src/team/team.service.ts:delete
DROP PROCEDURE IF EXISTS sp_ap_count_team_events$$
CREATE PROCEDURE sp_ap_count_team_events(IN p_id INT)
SQL SECURITY INVOKER
BEGIN
  SELECT COUNT(*) AS total FROM match_events WHERE teamId = p_id;
END$$

-- src/team/team.service.ts:delete
DROP PROCEDURE IF EXISTS sp_ap_delete_team_events$$
CREATE PROCEDURE sp_ap_delete_team_events(IN p_id INT)
SQL SECURITY INVOKER
BEGIN
  DELETE FROM match_events WHERE teamId = p_id;
  SELECT ROW_COUNT() AS affectedRows;
END$$

-- src/player/player.service.ts:fetchPlayersWithTeams
DROP PROCEDURE IF EXISTS sp_ap_get_transfer_players_with_teams$$
CREATE PROCEDURE sp_ap_get_transfer_players_with_teams()
SQL SECURITY INVOKER
BEGIN
  SELECT
    p.id,
    p.name,
    p.lastName,
    p.valoration,
    p.photo,
    p.isHabilitado,
    p.position,
    p.idTeam,

    t.id           AS teamId,
    t.name         AS teamName,
    t.abreviatura  AS teamAbreviatura,
    t.idLogo       AS teamIdLogo,
    t.userId       AS teamUserId
  FROM players p
  LEFT JOIN teams t ON t.id = p.idTeam
  WHERE p.isTransfer = 1
  ORDER BY p.valoration DESC, p.id ASC;
END$$

-- src/player/player.service.ts:listPending, src/player/player.service.ts:getOffersByTeam
DROP PROCEDURE IF EXISTS sp_ap_count_transfer_offers$$
CREATE PROCEDURE sp_ap_count_transfer_offers(IN p_team_id INT, IN p_status VARCHAR(16))
SQL SECURITY INVOKER
BEGIN
  SELECT COUNT(*) AS total FROM transfer_offers o WHERE (p_team_id IS NULL OR o.fromTeamId = p_team_id OR o.toTeamId = p_team_id) AND (p_status IS NULL OR o.status = p_status);
END$$

-- src/player/player.service.ts:listPending, src/player/player.service.ts:getOffersByTeam
DROP PROCEDURE IF EXISTS sp_ap_list_transfer_offers$$
CREATE PROCEDURE sp_ap_list_transfer_offers(IN p_team_id INT, IN p_status VARCHAR(16), IN p_limit INT, IN p_offset INT)
SQL SECURITY INVOKER
BEGIN
  SELECT
    o.id,
    o.status,
    CASE o.status
      WHEN 'pending'   THEN 'Pendiente'
      WHEN 'approved'  THEN 'Aprobada'
      WHEN 'rejected'  THEN 'Rechazada'
      WHEN 'cancelled' THEN 'Cancelada'
      ELSE o.status
    END AS statusEs,

    o.fromTeamId,
    tf.name AS fromTeamName,
    imgFrom.secureUrl AS fromTeamLogoUrl,

    o.toTeamId,
    tt.name AS toTeamName,
    imgTo.secureUrl AS toTeamLogoUrl,

    -- Targets (array)
    (
      SELECT COALESCE(
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'id', pT.id,
            'name', pT.name,
            'lastName', pT.lastName,
            'teamId', pT.idTeam,
            'valoration', pT.valoration
          )
        ),
        JSON_ARRAY()
      )
      FROM transfer_offer_targets tot
      JOIN players pT ON pT.id = tot.targetPlayerId
      WHERE tot.offerId = o.id
    ) AS targetPlayers,

    -- Offered (array)
    (
      SELECT COALESCE(
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'id', pO.id,
            'name', pO.name,
            'lastName', pO.lastName,
            'teamId', pO.idTeam,
            'valoration', pO.valoration
          )
        ),
        JSON_ARRAY()
      )
      FROM transfer_offer_players top
      JOIN players pO ON pO.id = top.offeredPlayerId
      WHERE top.offerId = o.id
    ) AS offeredPlayers

  FROM transfer_offers o
  LEFT JOIN teams tf ON tf.id = o.fromTeamId
  LEFT JOIN teams tt ON tt.id = o.toTeamId

  LEFT JOIN image imgFrom ON imgFrom.id = tf.idLogo
  LEFT JOIN image imgTo   ON imgTo.id   = tt.idLogo

  WHERE (p_team_id IS NULL OR o.fromTeamId = p_team_id OR o.toTeamId = p_team_id) AND (p_status IS NULL OR o.status = p_status)
  ORDER BY o.createdAt DESC
  LIMIT p_limit OFFSET p_offset;
END$$

-- src/tournament/tournament.service.ts:createTournament
DROP PROCEDURE IF EXISTS sp_ap_create_draft_status$$
CREATE PROCEDURE sp_ap_create_draft_status(IN p_tournament_id INT)
SQL SECURITY INVOKER
BEGIN
  INSERT INTO draft_status (tournamentId, status, message)
  VALUES (p_tournament_id, 'pending', 'Draft pendiente');
  SELECT ROW_COUNT() AS affectedRows, LAST_INSERT_ID() AS insertId;
END$$

-- src/tournament/tournament.service.ts:removeTournament, src/tournament/tournament.service.ts:addAssignmentsToWeek
DROP PROCEDURE IF EXISTS sp_ap_find_tournament$$
CREATE PROCEDURE sp_ap_find_tournament(IN p_tournament_id INT)
SQL SECURITY INVOKER
BEGIN
  SELECT id FROM tournament WHERE id = p_tournament_id LIMIT 1;
END$$

-- src/tournament/tournament.service.ts:removeTournament
DROP PROCEDURE IF EXISTS sp_ap_delete_tournament_events$$
CREATE PROCEDURE sp_ap_delete_tournament_events(IN p_tournament_id INT)
SQL SECURITY INVOKER
BEGIN
  DELETE me
  FROM match_events me
  JOIN match_reports mr ON mr.id = me.reportId
  WHERE mr.tournamentId = p_tournament_id;
  SELECT ROW_COUNT() AS affectedRows;
END$$

-- src/tournament/tournament.service.ts:removeTournament
DROP PROCEDURE IF EXISTS sp_ap_delete_tournament_reports$$
CREATE PROCEDURE sp_ap_delete_tournament_reports(IN p_tournament_id INT)
SQL SECURITY INVOKER
BEGIN
  DELETE FROM match_reports WHERE tournamentId = p_tournament_id;
  SELECT ROW_COUNT() AS affectedRows;
END$$

-- src/tournament/tournament.service.ts:removeTournament
DROP PROCEDURE IF EXISTS sp_ap_delete_tournament_rounds$$
CREATE PROCEDURE sp_ap_delete_tournament_rounds(IN p_tournament_id INT)
SQL SECURITY INVOKER
BEGIN
  DELETE FROM rounds WHERE tournamentId = p_tournament_id;
  SELECT ROW_COUNT() AS affectedRows;
END$$

-- src/tournament/tournament.service.ts:removeTournament
DROP PROCEDURE IF EXISTS sp_ap_delete_tournament_ties$$
CREATE PROCEDURE sp_ap_delete_tournament_ties(IN p_tournament_id INT)
SQL SECURITY INVOKER
BEGIN
  DELETE FROM ties WHERE tournamentId = p_tournament_id;
  SELECT ROW_COUNT() AS affectedRows;
END$$

-- src/tournament/tournament.service.ts:removeTournament
DROP PROCEDURE IF EXISTS sp_ap_delete_tournament_teams$$
CREATE PROCEDURE sp_ap_delete_tournament_teams(IN p_tournament_id INT)
SQL SECURITY INVOKER
BEGIN
  DELETE FROM tournament_teams WHERE tournamentId = p_tournament_id;
  SELECT ROW_COUNT() AS affectedRows;
END$$

-- src/tournament/tournament.service.ts:removeTournament
DROP PROCEDURE IF EXISTS sp_ap_delete_tournament_statistics$$
CREATE PROCEDURE sp_ap_delete_tournament_statistics(IN p_tournament_id INT)
SQL SECURITY INVOKER
BEGIN
  DELETE FROM tournament_statistics WHERE tournamentId = p_tournament_id;
  SELECT ROW_COUNT() AS affectedRows;
END$$

-- src/tournament/tournament.service.ts:removeTournament
DROP PROCEDURE IF EXISTS sp_ap_delete_tournament$$
CREATE PROCEDURE sp_ap_delete_tournament(IN p_tournament_id INT)
SQL SECURITY INVOKER
BEGIN
  DELETE FROM tournament WHERE id = p_tournament_id;
  SELECT ROW_COUNT() AS affectedRows;
END$$

-- src/tournament/tournament.service.ts:getStandings
DROP PROCEDURE IF EXISTS sp_ap_get_standings$$
CREATE PROCEDURE sp_ap_get_standings(IN p_tournament_id INT)
SQL SECURITY INVOKER
BEGIN
  WITH
  played_home AS (
    SELECT r.home AS teamId, r.homeGoals AS gf, r.awayGoals AS ga,
      COALESCE(r.isNullMatch, 0) AS nullM
    FROM rounds r
    WHERE r.tournamentId = p_tournament_id
      AND r.state = 1
      AND r.homeGoals IS NOT NULL
      AND r.awayGoals IS NOT NULL
  ),
  played_away AS (
    SELECT r.away AS teamId, r.awayGoals AS gf, r.homeGoals AS ga,
      COALESCE(r.isNullMatch, 0) AS nullM
    FROM rounds r
    WHERE r.tournamentId = p_tournament_id
      AND r.state = 1
      AND r.homeGoals IS NOT NULL
      AND r.awayGoals IS NOT NULL
  ),
  all_rows AS (
    SELECT * FROM played_home
    UNION ALL
    SELECT * FROM played_away
  ),
  stats AS (
    SELECT
      teamId,
      COUNT(*) AS matchesPlayed,
      SUM(CASE WHEN nullM = 0 AND gf > ga THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN nullM = 0 AND gf = ga THEN 1 ELSE 0 END) AS draws,
      SUM(CASE WHEN nullM = 0 AND gf < ga THEN 1 ELSE 0 END) AS losses,
      SUM(CASE WHEN nullM = 0 THEN gf ELSE 0 END) AS goalsFor,
      SUM(CASE WHEN nullM = 0 THEN ga ELSE 0 END) AS goalsAgainst,
      SUM(CASE WHEN nullM = 0 THEN gf - ga ELSE 0 END) AS goalDifference,
      SUM(CASE WHEN nullM = 0 THEN CASE WHEN gf > ga THEN 3 WHEN gf = ga THEN 1 ELSE 0 END ELSE 0 END) AS points
    FROM all_rows
    GROUP BY teamId
  )
    SELECT
      p_tournament_id AS tournamentId,
      t.id AS teamId,
      t.name AS teamName,
      img.secureUrl AS logoUrl,
      img.publicId AS logoPublicId,
      img.originalName AS logoOriginalName,
      COALESCE(s.points, 0) AS points,
      COALESCE(s.goalDifference, 0) AS goalDifference,
      COALESCE(s.goalsFor, 0) AS goalsFor,
      COALESCE(s.goalsAgainst, 0) AS goalsAgainst,
      COALESCE(s.matchesPlayed, 0) AS matchesPlayed,
      COALESCE(s.wins, 0) AS wins,
      COALESCE(s.draws, 0) AS draws,
      COALESCE(s.losses, 0) AS losses
    FROM tournament_teams tt
    JOIN teams t ON t.id = tt.teamsId
    LEFT JOIN image img ON img.id = t.idLogo
    LEFT JOIN stats s ON s.teamId = t.id
    WHERE tt.tournamentId = p_tournament_id
    ORDER BY points DESC, goalDifference DESC, goalsFor DESC, teamName ASC;
END$$

-- src/tournament/tournament.service.ts:getRankingLeague
DROP PROCEDURE IF EXISTS sp_ap_get_ranking_league$$
CREATE PROCEDURE sp_ap_get_ranking_league(IN p_tournament_id INT)
SQL SECURITY INVOKER
BEGIN
  WITH
  played_home AS (
    SELECT r.home AS teamId, r.homeGoals AS gf, r.awayGoals AS ga,
      COALESCE(r.isNullMatch, 0) AS nullM
    FROM rounds r
    WHERE r.tournamentId = p_tournament_id
      AND r.state = 1
      AND r.homeGoals IS NOT NULL
      AND r.awayGoals IS NOT NULL
  ),
  played_away AS (
    SELECT r.away AS teamId, r.awayGoals AS gf, r.homeGoals AS ga,
      COALESCE(r.isNullMatch, 0) AS nullM
    FROM rounds r
    WHERE r.tournamentId = p_tournament_id
      AND r.state = 1
      AND r.homeGoals IS NOT NULL
      AND r.awayGoals IS NOT NULL
  ),
  all_rows AS (
    SELECT * FROM played_home
    UNION ALL
    SELECT * FROM played_away
  ),
  stats AS (
    SELECT
      teamId,
      COUNT(*) AS matchesPlayed,
      SUM(CASE WHEN nullM = 0 AND gf > ga THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN nullM = 0 AND gf = ga THEN 1 ELSE 0 END) AS draws,
      SUM(CASE WHEN nullM = 0 AND gf < ga THEN 1 ELSE 0 END) AS losses,
      SUM(CASE WHEN nullM = 0 THEN gf ELSE 0 END) AS goalsFor,
      SUM(CASE WHEN nullM = 0 THEN ga ELSE 0 END) AS goalsAgainst,
      SUM(CASE WHEN nullM = 0 THEN gf - ga ELSE 0 END) AS goalDifference,
      SUM(CASE WHEN nullM = 0 THEN CASE WHEN gf > ga THEN 3 WHEN gf = ga THEN 1 ELSE 0 END ELSE 0 END) AS points
    FROM all_rows
    GROUP BY teamId
  )
  SELECT
    t.id AS teamId,
    t.name AS teamName,

    img.secureUrl AS logoUrl,
    img.publicId AS logoPublicId,
    img.originalName AS logoOriginalName,

    COALESCE(s.points, 0) AS points,
    COALESCE(s.goalDifference, 0) AS goalDifference,
    COALESCE(s.goalsFor, 0) AS goalsFor,
    COALESCE(s.goalsAgainst, 0) AS goalsAgainst,
    COALESCE(s.matchesPlayed, 0) AS matchesPlayed,
    COALESCE(s.wins, 0) AS wins,
    COALESCE(s.draws, 0) AS draws,
    COALESCE(s.losses, 0) AS losses
  FROM tournament_teams tt
  JOIN teams t ON t.id = tt.teamsId
  LEFT JOIN image img ON img.id = t.idLogo
  LEFT JOIN stats s ON s.teamId = t.id
  WHERE tt.tournamentId = p_tournament_id
  ORDER BY points DESC, goalDifference DESC, goalsFor DESC, teamName ASC;
END$$

-- src/tournament/tournament.service.ts:getRankingGroups
DROP PROCEDURE IF EXISTS sp_ap_get_ranking_groups$$
CREATE PROCEDURE sp_ap_get_ranking_groups(IN p_tournament_id INT)
SQL SECURITY INVOKER
BEGIN
  WITH teams_in_group AS (
    SELECT DISTINCT r.groupNumber AS groupNumber, r.home AS teamId
    FROM rounds r
    WHERE r.tournamentId = p_tournament_id AND r.groupNumber IS NOT NULL

    UNION DISTINCT

    SELECT DISTINCT r.groupNumber AS groupNumber, r.away AS teamId
    FROM rounds r
    WHERE r.tournamentId = p_tournament_id AND r.groupNumber IS NOT NULL
  ),
  played AS (
    SELECT r.groupNumber AS groupNumber, r.home AS teamId, r.homeGoals AS gf, r.awayGoals AS ga,
      COALESCE(r.isNullMatch, 0) AS nullM
    FROM rounds r
    WHERE r.tournamentId = p_tournament_id
      AND r.groupNumber IS NOT NULL
      AND r.state = 1
      AND r.homeGoals IS NOT NULL
      AND r.awayGoals IS NOT NULL

    UNION ALL

    SELECT r.groupNumber AS groupNumber, r.away AS teamId, r.awayGoals AS gf, r.homeGoals AS ga,
      COALESCE(r.isNullMatch, 0) AS nullM
    FROM rounds r
    WHERE r.tournamentId = p_tournament_id
      AND r.groupNumber IS NOT NULL
      AND r.state = 1
      AND r.homeGoals IS NOT NULL
      AND r.awayGoals IS NOT NULL
  ),
  stats AS (
    SELECT
      groupNumber,
      teamId,
      COUNT(*) AS matchesPlayed,
      SUM(CASE WHEN nullM = 0 AND gf > ga THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN nullM = 0 AND gf = ga THEN 1 ELSE 0 END) AS draws,
      SUM(CASE WHEN nullM = 0 AND gf < ga THEN 1 ELSE 0 END) AS losses,
      SUM(CASE WHEN nullM = 0 THEN gf ELSE 0 END) AS goalsFor,
      SUM(CASE WHEN nullM = 0 THEN ga ELSE 0 END) AS goalsAgainst,
      SUM(CASE WHEN nullM = 0 THEN gf - ga ELSE 0 END) AS goalDifference,
      SUM(CASE WHEN nullM = 0 THEN CASE WHEN gf > ga THEN 3 WHEN gf = ga THEN 1 ELSE 0 END ELSE 0 END) AS points
    FROM played
    GROUP BY groupNumber, teamId
  )
  SELECT
    tig.groupNumber AS groupNumber,
    CONCAT('Grupo ', tig.groupNumber) AS groupName,

    t.id AS teamId,
    t.name AS teamName,

    img.secureUrl AS logoUrl,
    img.publicId AS logoPublicId,
    img.originalName AS logoOriginalName,

    COALESCE(s.points, 0) AS points,
    COALESCE(s.goalDifference, 0) AS goalDifference,
    COALESCE(s.goalsFor, 0) AS goalsFor,
    COALESCE(s.goalsAgainst, 0) AS goalsAgainst,
    COALESCE(s.matchesPlayed, 0) AS matchesPlayed,
    COALESCE(s.wins, 0) AS wins,
    COALESCE(s.draws, 0) AS draws,
    COALESCE(s.losses, 0) AS losses
  FROM teams_in_group tig
  JOIN teams t ON t.id = tig.teamId
  LEFT JOIN image img ON img.id = t.idLogo
  LEFT JOIN stats s ON s.groupNumber = tig.groupNumber AND s.teamId = tig.teamId
  ORDER BY tig.groupNumber ASC, points DESC, goalDifference DESC, goalsFor DESC, teamName ASC;
END$$

-- src/tournament/tournament.service.ts:getTournamentStats
DROP PROCEDURE IF EXISTS sp_ap_get_tournament_stats$$
CREATE PROCEDURE sp_ap_get_tournament_stats(IN p_tournament_id INT)
SQL SECURITY INVOKER
BEGIN
  SELECT *
  FROM tournament_statistics
  WHERE tournamentId = p_tournament_id;
END$$

-- src/tournament/tournament.service.ts:getHighlights
DROP PROCEDURE IF EXISTS sp_ap_get_scorers$$
CREATE PROCEDURE sp_ap_get_scorers(IN p_tournament_id INT)
SQL SECURITY INVOKER
BEGIN
  SELECT
    me.playerId,
    TRIM(CONCAT(COALESCE(p.name,''), ' ', COALESCE(p.lastName,''))) AS playerName,
    p.teamId AS teamId,
    t.name AS teamName,
    i.secureUrl AS teamLogo,

    COUNT(*) AS goals,

    (
      SELECT COUNT(*)
      FROM rounds r
      WHERE r.tournamentId = p_tournament_id
        AND r.state = 1
        AND (r.home = p.teamId OR r.away = p.teamId)
    ) AS matchesPlayed

  FROM match_events me
  INNER JOIN match_reports mr ON mr.id = me.reportId
  LEFT JOIN players p ON p.id = me.playerId
  LEFT JOIN teams t ON t.id = p.teamId
  LEFT JOIN image i ON i.id = t.idLogo

  WHERE mr.tournamentId = p_tournament_id
    AND me.eventType = 'GOAL'
    AND me.playerId IS NOT NULL

  GROUP BY me.playerId, playerName, teamId, teamName, teamLogo, matchesPlayed
  ORDER BY goals DESC, matchesPlayed ASC, playerName ASC
  LIMIT 10;
END$$

-- src/tournament/tournament.service.ts:getCardsLeaders
DROP PROCEDURE IF EXISTS sp_ap_get_cards_leaders$$
CREATE PROCEDURE sp_ap_get_cards_leaders(IN p_tournament_id INT)
SQL SECURITY INVOKER
BEGIN
  SELECT
    me.playerId,
    TRIM(CONCAT(COALESCE(p.name,''), ' ', COALESCE(p.lastName,''))) AS playerName,
    COALESCE(p.idTeam, me.teamId) AS teamId,
    t.name AS teamName,
    i.secureUrl AS teamLogo,

    SUM(CASE WHEN me.eventType = 'YELLOW' THEN 1 ELSE 0 END) AS yellows,
    SUM(CASE WHEN me.eventType = 'RED' THEN 1 ELSE 0 END) AS reds,
    COUNT(*) AS totalCards,

    CASE
      WHEN ps.id IS NOT NULL THEN 1
      ELSE 0
    END AS hasSuspension,

    ps.suspensionType,
    ps.status AS suspensionStatus,
    ps.unitType AS suspensionUnitType,
    ps.fromUnitValue AS suspensionFromDate,
    ps.untilUnitValue AS suspensionUntilDate,
    ps.matchesToServe,

    CASE
      WHEN ps.id IS NULL THEN NULL
      WHEN ps.unitType = 'MATCHDAY' THEN CONCAT('Fecha ', ps.fromUnitValue)
      WHEN ps.unitType = 'ROUND' THEN CONCAT('Ronda ', ps.fromUnitValue)
      ELSE NULL
    END AS suspensionLabel

  FROM match_events me

  INNER JOIN match_reports mr
    ON mr.id = me.reportId

  LEFT JOIN players p
    ON p.id = me.playerId

  LEFT JOIN teams t
    ON t.id = COALESCE(p.idTeam, me.teamId)

  LEFT JOIN image i
    ON i.id = t.idLogo

  LEFT JOIN player_tournament_suspensions ps
    ON ps.playerId = me.playerId
    AND ps.tournamentId = mr.tournamentId
    AND ps.status = 'ACTIVE'

  WHERE mr.tournamentId = p_tournament_id
    AND me.playerId IS NOT NULL
    AND me.eventType IN ('YELLOW', 'RED')

  GROUP BY
    me.playerId,
    playerName,
    teamId,
    teamName,
    teamLogo,
    ps.id,
    ps.suspensionType,
    ps.status,
    ps.unitType,
    ps.fromUnitValue,
    ps.untilUnitValue,
    ps.matchesToServe

  ORDER BY
    teamName DESC,
    totalCards DESC,
    reds DESC,
    yellows DESC,
    playerName ASC;
END$$

-- src/tournament/tournament.service.ts:getTeamStats
DROP PROCEDURE IF EXISTS sp_ap_get_team_stats$$
CREATE PROCEDURE sp_ap_get_team_stats(IN p_tournament_id INT, IN p_team_id INT)
SQL SECURITY INVOKER
BEGIN
  WITH
  played_home AS (
    SELECT r.home AS teamId, r.homeGoals AS gf, r.awayGoals AS ga,
      COALESCE(r.isNullMatch, 0) AS nullM
    FROM rounds r
    WHERE r.tournamentId = p_tournament_id
      AND r.state = 1
      AND r.homeGoals IS NOT NULL
      AND r.awayGoals IS NOT NULL
  ),
  played_away AS (
    SELECT r.away AS teamId, r.awayGoals AS gf, r.homeGoals AS ga,
      COALESCE(r.isNullMatch, 0) AS nullM
    FROM rounds r
    WHERE r.tournamentId = p_tournament_id
      AND r.state = 1
      AND r.homeGoals IS NOT NULL
      AND r.awayGoals IS NOT NULL
  ),
  all_rows AS (
    SELECT * FROM played_home
    UNION ALL
    SELECT * FROM played_away
  ),
  stats AS (
    SELECT
      teamId,
      COUNT(*) AS matchesPlayed,
      SUM(CASE WHEN nullM = 0 AND gf > ga THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN nullM = 0 AND gf = ga THEN 1 ELSE 0 END) AS draws,
      SUM(CASE WHEN nullM = 0 AND gf < ga THEN 1 ELSE 0 END) AS losses,
      SUM(CASE WHEN nullM = 0 THEN gf ELSE 0 END) AS goalsFor,
      SUM(CASE WHEN nullM = 0 THEN ga ELSE 0 END) AS goalsAgainst,
      SUM(CASE WHEN nullM = 0 THEN gf - ga ELSE 0 END) AS goalDifference,
      SUM(CASE WHEN nullM = 0 THEN CASE WHEN gf > ga THEN 3 WHEN gf = ga THEN 1 ELSE 0 END ELSE 0 END) AS points
    FROM all_rows
    GROUP BY teamId
  )
    SELECT
      p_tournament_id AS tournamentId,
      t.id AS teamId,
      t.name AS teamName,
      COALESCE(s.points, 0) AS points,
      COALESCE(s.goalDifference, 0) AS goalDifference,
      COALESCE(s.goalsFor, 0) AS goalsFor,
      COALESCE(s.goalsAgainst, 0) AS goalsAgainst,
      COALESCE(s.matchesPlayed, 0) AS matchesPlayed,
      COALESCE(s.wins, 0) AS wins,
      COALESCE(s.draws, 0) AS draws,
      COALESCE(s.losses, 0) AS losses
    FROM stats s
    JOIN teams t ON t.id = s.teamId
    INNER JOIN tournament_teams tt ON tt.teamsId = s.teamId AND tt.tournamentId = p_tournament_id
    WHERE s.teamId = p_team_id
    LIMIT 1;
END$$

-- src/tournament/tournament.service.ts:getRoundsByTeamId
DROP PROCEDURE IF EXISTS sp_ap_get_rounds_by_team$$
CREATE PROCEDURE sp_ap_get_rounds_by_team(IN p_team_id INT, IN p_tournament_id INT)
SQL SECURITY INVOKER
BEGIN
  SELECT
    r.id           AS idRound,
    r.tournamentId AS tournamentId,
    t.name         AS tournamentName,
    r.matchday     AS matchday,
    r.groupNumber  AS groupNumber,
    r.round        AS round,
    r.state        AS state,
    r.stage        AS stage,
    r.tieId        AS tieId,
    r.leg          AS leg,

    r.home         AS homeTeamId,
    th.name        AS homeTeamName,
    th.idLogo      AS homeIdLogo,
    ih.secureUrl   AS homeLogoUrl,

    r.away         AS awayTeamId,
    ta.name        AS awayTeamName,
    ta.idLogo      AS awayIdLogo,
    ia.secureUrl   AS awayLogoUrl,

    r.homeGoals    AS homeGoals,
    r.awayGoals    AS awayGoals

  FROM rounds r
  INNER JOIN tournament t ON t.id = r.tournamentId
  INNER JOIN teams th ON th.id = r.home
  INNER JOIN teams ta ON ta.id = r.away
  LEFT JOIN image ih ON ih.id = th.idLogo
  LEFT JOIN image ia ON ia.id = ta.idLogo

  WHERE (r.home = p_team_id OR r.away = p_team_id)
  AND (p_tournament_id IS NULL OR r.tournamentId = p_tournament_id)

  ORDER BY
    r.tournamentId ASC,
    r.round ASC,
    r.tieId ASC,
    r.leg ASC,
    r.id ASC;
END$$

-- src/tournament/tournament.service.ts:getKORoundsByTournamentId
DROP PROCEDURE IF EXISTS sp_ap_get_ko_rounds$$
CREATE PROCEDURE sp_ap_get_ko_rounds(IN p_tournament_id INT)
SQL SECURITY INVOKER
BEGIN
  SELECT
    t.id AS tieId,
    t.round,

    t.teamA,
    ta.name AS teamAName,
    ta.idLogo AS teamAIdLogo,
    ia.secureUrl AS teamALogo,

    t.teamB,
    tb.name AS teamBName,
    tb.idLogo AS teamBIdLogo,
    ib.secureUrl AS teamBLogo,

    r.id AS matchId,
    r.matchday,
    r.home,
    r.away,
    r.homeGoals,
    r.awayGoals,
    r.state

  FROM ties t
  JOIN rounds r ON r.tieId = t.id
  JOIN teams ta ON ta.id = t.teamA
  JOIN teams tb ON tb.id = t.teamB
  LEFT JOIN image ia ON ia.id = ta.idLogo
  LEFT JOIN image ib ON ib.id = tb.idLogo

  WHERE t.tournamentId = p_tournament_id

  ORDER BY t.round ASC, t.id ASC, r.matchday ASC;
END$$

-- src/tournament/tournament.service.ts:getDraftStatus
DROP PROCEDURE IF EXISTS sp_ap_get_draft_status$$
CREATE PROCEDURE sp_ap_get_draft_status(IN p_tournament_id INT)
SQL SECURITY INVOKER
BEGIN
  SELECT * FROM draft_status WHERE tournamentId=p_tournament_id;
END$$

-- src/tournament/tournament.service.ts:executeDraftAsync, src/tournament/tournament.service.ts:runDraft
DROP PROCEDURE IF EXISTS sp_ap_acquire_draft_lock$$
CREATE PROCEDURE sp_ap_acquire_draft_lock(IN p_lock_name VARCHAR(64))
SQL SECURITY INVOKER
BEGIN
  SELECT GET_LOCK(p_lock_name, 2) AS gotLock;
END$$

-- src/tournament/tournament.service.ts:executeDraftAsync, src/tournament/tournament.service.ts:runDraft
DROP PROCEDURE IF EXISTS sp_ap_get_draft_teams$$
CREATE PROCEDURE sp_ap_get_draft_teams(IN p_tournament_id INT)
SQL SECURITY INVOKER
BEGIN
  SELECT teamsId AS teamId
  FROM tournament_teams
  WHERE tournamentId = p_tournament_id
  ORDER BY teamsId ASC;
END$$

-- src/tournament/tournament.service.ts:executeDraftAsync, src/tournament/tournament.service.ts:runDraft
DROP PROCEDURE IF EXISTS sp_ap_delete_draft_log$$
CREATE PROCEDURE sp_ap_delete_draft_log(IN p_tournament_id INT)
SQL SECURITY INVOKER
BEGIN
  DELETE FROM draft_log WHERE tournamentId = p_tournament_id;
  SELECT ROW_COUNT() AS affectedRows;
END$$

-- src/tournament/tournament.service.ts:executeDraftAsync, src/tournament/tournament.service.ts:runDraft
DROP PROCEDURE IF EXISTS sp_ap_release_draft_players$$
CREATE PROCEDURE sp_ap_release_draft_players(IN p_tournament_id INT)
SQL SECURITY INVOKER
BEGIN
  UPDATE players
  SET idTeam = NULL
  WHERE idTeam IN (
    SELECT teamsId
    FROM tournament_teams
    WHERE tournamentId = p_tournament_id
  );
  SELECT ROW_COUNT() AS affectedRows;
END$$

-- src/tournament/tournament.service.ts:executeDraftAsync, src/tournament/tournament.service.ts:runDraft
DROP PROCEDURE IF EXISTS sp_ap_get_draft_pool$$
CREATE PROCEDURE sp_ap_get_draft_pool()
SQL SECURITY INVOKER
BEGIN
  SELECT id, valoration, position
  FROM players
  WHERE isHabilitado = 1
    AND valoration BETWEEN 77 AND 94
    AND idTeam IS NULL;
END$$

-- src/tournament/tournament.service.ts:executeDraftAsync, src/tournament/tournament.service.ts:runDraft
DROP PROCEDURE IF EXISTS sp_ap_release_draft_lock$$
CREATE PROCEDURE sp_ap_release_draft_lock(IN p_lock_name VARCHAR(64))
SQL SECURITY INVOKER
BEGIN
  SELECT RELEASE_LOCK(p_lock_name);
END$$

-- src/tournament/tournament.service.ts:getTeamsByRound
DROP PROCEDURE IF EXISTS sp_ap_get_round_teams$$
CREATE PROCEDURE sp_ap_get_round_teams(IN p_round_id INT)
SQL SECURITY INVOKER
BEGIN
  SELECT
    r.id        AS roundId,
    r.home      AS homeId,
    th.name     AS homeName,
    r.away      AS awayId,
    ta.name     AS awayName
  FROM rounds r
  INNER JOIN teams th ON th.id = r.home
  INNER JOIN teams ta ON ta.id = r.away
  WHERE r.id = p_round_id;
END$$

-- src/tournament/tournament.service.ts:addAssignmentsToWeek, src/tournament/tournament.service.ts:deleteWeek
DROP PROCEDURE IF EXISTS sp_ap_find_season_week$$
CREATE PROCEDURE sp_ap_find_season_week(IN p_season_week_id INT)
SQL SECURITY INVOKER
BEGIN
  SELECT id
  FROM season_weeks
  WHERE id = p_season_week_id;
END$$

-- src/tournament/tournament.service.ts:addAssignmentsToWeek
DROP PROCEDURE IF EXISTS sp_ap_find_group_matchday$$
CREATE PROCEDURE sp_ap_find_group_matchday(IN p_tournament_id INT, IN p_stage_number INT)
SQL SECURITY INVOKER
BEGIN
  SELECT 1
  FROM rounds
  WHERE tournamentId = p_tournament_id
    AND stage = 'GROUP'
    AND matchday = p_stage_number
  LIMIT 1;
END$$

-- src/tournament/tournament.service.ts:addAssignmentsToWeek
DROP PROCEDURE IF EXISTS sp_ap_find_ko_round$$
CREATE PROCEDURE sp_ap_find_ko_round(IN p_tournament_id INT, IN p_stage_number INT)
SQL SECURITY INVOKER
BEGIN
  SELECT 1
  FROM rounds
  WHERE tournamentId = p_tournament_id
    AND stage = 'KO'
    AND round = p_stage_number
  LIMIT 1;
END$$

-- src/tournament/tournament.service.ts:addAssignmentsToWeek
DROP PROCEDURE IF EXISTS sp_ap_find_week_assignment$$
CREATE PROCEDURE sp_ap_find_week_assignment(IN p_season_week_id INT, IN p_tournament_id INT, IN p_stage_type VARCHAR(16), IN p_stage_number INT)
SQL SECURITY INVOKER
BEGIN
  SELECT id
  FROM season_week_assignments
  WHERE seasonWeekId = p_season_week_id
    AND tournamentId = p_tournament_id
    AND stageType = p_stage_type
    AND stageNumber = p_stage_number;
END$$

-- src/tournament/tournament.service.ts:addAssignmentsToWeek
DROP PROCEDURE IF EXISTS sp_ap_create_week_assignment$$
CREATE PROCEDURE sp_ap_create_week_assignment(IN p_season_week_id INT, IN p_tournament_id INT, IN p_stage_type VARCHAR(16), IN p_stage_number INT)
SQL SECURITY INVOKER
BEGIN
  INSERT INTO season_week_assignments
  (
    seasonWeekId,
    tournamentId,
    stageType,
    stageNumber
  )
  VALUES (p_season_week_id, p_tournament_id, p_stage_type, p_stage_number);
  SELECT ROW_COUNT() AS affectedRows, LAST_INSERT_ID() AS insertId;
END$$

-- src/tournament/tournament.service.ts:addAssignmentsToWeek
DROP PROCEDURE IF EXISTS sp_ap_assign_group_week$$
CREATE PROCEDURE sp_ap_assign_group_week(IN p_season_week_id INT, IN p_tournament_id INT, IN p_stage_number INT)
SQL SECURITY INVOKER
BEGIN
  UPDATE rounds
  SET seasonWeekId = p_season_week_id
  WHERE tournamentId = p_tournament_id
    AND stage = 'GROUP'
    AND matchday = p_stage_number;
  SELECT ROW_COUNT() AS affectedRows;
END$$

-- src/tournament/tournament.service.ts:addAssignmentsToWeek
DROP PROCEDURE IF EXISTS sp_ap_assign_ko_week$$
CREATE PROCEDURE sp_ap_assign_ko_week(IN p_season_week_id INT, IN p_tournament_id INT, IN p_stage_number INT)
SQL SECURITY INVOKER
BEGIN
  UPDATE rounds
  SET seasonWeekId = p_season_week_id
  WHERE tournamentId = p_tournament_id
    AND stage = 'KO'
    AND round = p_stage_number;
  SELECT ROW_COUNT() AS affectedRows;
END$$

-- src/tournament/tournament.service.ts:getWeeks
DROP PROCEDURE IF EXISTS sp_ap_get_season_weeks$$
CREATE PROCEDURE sp_ap_get_season_weeks(IN p_season_id INT)
SQL SECURITY INVOKER
BEGIN
  SELECT
      id,
      weekNumber,
      startDate,
      endDate
  FROM season_weeks
  WHERE seasonId = p_season_id
  ORDER BY weekNumber;
END$$

-- src/tournament/tournament.service.ts:getWeeks
DROP PROCEDURE IF EXISTS sp_ap_get_season_assignments$$
CREATE PROCEDURE sp_ap_get_season_assignments(IN p_season_id INT)
SQL SECURITY INVOKER
BEGIN
  SELECT
      swa.id,
      swa.seasonWeekId,
      swa.tournamentId,
      t.name AS tournamentName,
      swa.stageType,
      swa.stageNumber
  FROM season_week_assignments swa
  INNER JOIN tournament t
      ON t.id = swa.tournamentId
  INNER JOIN season_weeks sw
      ON sw.id = swa.seasonWeekId
  WHERE sw.seasonId = p_season_id
  ORDER BY
      sw.weekNumber,
      t.name,
      swa.stageNumber;
END$$

-- src/tournament/tournament.service.ts:getRoundsSummary
DROP PROCEDURE IF EXISTS sp_ap_get_unassigned_rounds_summary$$
CREATE PROCEDURE sp_ap_get_unassigned_rounds_summary(IN p_id_tournament INT)
SQL SECURITY INVOKER
BEGIN
  SELECT
    r.tournamentId,
    t.name AS tournamentName,
    t.logo AS tournamentLogo,
    r.matchday AS matchday,
    NULL AS round
  FROM rounds r
  INNER JOIN tournament t ON t.id = r.tournamentId
  WHERE r.tournamentId = p_id_tournament
    AND r.stage = 'GROUP'
    AND r.matchday IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM season_week_assignments swa
      WHERE swa.tournamentId = r.tournamentId
        AND swa.stageType = 'GROUP'
        AND swa.stageNumber = r.matchday
    )
  GROUP BY r.tournamentId, t.name, t.logo, r.matchday

  UNION ALL

  SELECT
    r.tournamentId,
    t.name AS tournamentName,
    t.logo AS tournamentLogo,
    NULL AS matchday,
    r.round AS round
  FROM rounds r
  INNER JOIN tournament t ON t.id = r.tournamentId
  WHERE r.tournamentId = p_id_tournament
    AND r.stage = 'KO'
    AND NOT EXISTS (
      SELECT 1
      FROM season_week_assignments swa
      WHERE swa.tournamentId = r.tournamentId
        AND swa.stageType = 'KO'
        AND swa.stageNumber = r.round
    )
  GROUP BY r.tournamentId, t.name, t.logo, r.round

  ORDER BY matchday ASC, round ASC;
END$$

-- src/tournament/tournament.service.ts:createWeek
DROP PROCEDURE IF EXISTS sp_ap_find_season$$
CREATE PROCEDURE sp_ap_find_season(IN p_season_id INT)
SQL SECURITY INVOKER
BEGIN
  SELECT id
  FROM seasons
  WHERE id = p_season_id;
END$$

-- src/tournament/tournament.service.ts:createWeek
DROP PROCEDURE IF EXISTS sp_ap_find_week_by_number$$
CREATE PROCEDURE sp_ap_find_week_by_number(IN p_season_id INT, IN p_week_number INT)
SQL SECURITY INVOKER
BEGIN
  SELECT id
  FROM season_weeks
  WHERE seasonId = p_season_id
    AND weekNumber = p_week_number;
END$$

-- src/tournament/tournament.service.ts:createWeek
DROP PROCEDURE IF EXISTS sp_ap_create_season_week$$
CREATE PROCEDURE sp_ap_create_season_week(IN p_season_id INT, IN p_week_number INT, IN p_start_date DATETIME, IN p_end_date DATETIME)
SQL SECURITY INVOKER
BEGIN
  INSERT INTO season_weeks
  (
    seasonId,
    weekNumber,
    startDate,
    endDate
  )
  VALUES
  (
    p_season_id,
    p_week_number,
    p_start_date,
    p_end_date
  );
  SELECT ROW_COUNT() AS affectedRows, LAST_INSERT_ID() AS insertId;
END$$

-- src/tournament/tournament.service.ts:removeAssignmentFromWeek
DROP PROCEDURE IF EXISTS sp_ap_delete_week_assignment$$
CREATE PROCEDURE sp_ap_delete_week_assignment(IN p_assignment_id INT)
SQL SECURITY INVOKER
BEGIN
  DELETE FROM season_week_assignments
  WHERE id = p_assignment_id;
  SELECT ROW_COUNT() AS affectedRows;
END$$

-- src/tournament/tournament.service.ts:deleteWeek
DROP PROCEDURE IF EXISTS sp_ap_delete_week_assignments$$
CREATE PROCEDURE sp_ap_delete_week_assignments(IN p_week_id INT)
SQL SECURITY INVOKER
BEGIN
  DELETE FROM season_week_assignments
  WHERE seasonWeekId = p_week_id;
  SELECT ROW_COUNT() AS affectedRows;
END$$

-- src/tournament/tournament.service.ts:deleteWeek
DROP PROCEDURE IF EXISTS sp_ap_delete_season_week$$
CREATE PROCEDURE sp_ap_delete_season_week(IN p_week_id INT)
SQL SECURITY INVOKER
BEGIN
  DELETE FROM season_weeks
  WHERE id = p_week_id;
  SELECT ROW_COUNT() AS affectedRows;
END$$

-- src/player/player.service.ts:removeAllPlayersFromTeams
DROP PROCEDURE IF EXISTS sp_ap_remove_players_from_teams$$
CREATE PROCEDURE sp_ap_remove_players_from_teams()
SQL SECURITY INVOKER
BEGIN
  UPDATE players SET idTeam = NULL WHERE idTeam IS NOT NULL;
  SELECT ROW_COUNT() AS affectedRows;
END$$

-- src/tournament/tournament.service.ts:persistAssignments
DROP PROCEDURE IF EXISTS sp_ap_persist_draft_assignments$$
CREATE PROCEDURE sp_ap_persist_draft_assignments(IN p_assignments JSON)
SQL SECURITY INVOKER
BEGIN
  UPDATE players p
  JOIN JSON_TABLE(p_assignments, '$[*]' COLUMNS (
    playerId INT PATH '$.playerId' ERROR ON EMPTY ERROR ON ERROR,
    teamId INT PATH '$.teamId' ERROR ON EMPTY ERROR ON ERROR
  )) AS a ON a.playerId = p.id
  SET p.idTeam = a.teamId, p.isTransfer = 0;
  SELECT ROW_COUNT() AS affectedRows;
END$$

-- src/tournament/tournament.service.ts:insertDraftLog
DROP PROCEDURE IF EXISTS sp_ap_insert_draft_log$$
CREATE PROCEDURE sp_ap_insert_draft_log(IN p_tournament_id INT, IN p_assignments JSON)
SQL SECURITY INVOKER
BEGIN
  INSERT INTO draft_log (tournamentId, teamId, playerId, action, message)
  SELECT p_tournament_id, a.teamId, a.playerId, 'ASSIGN',
    CONCAT('Jugador ', a.playerId, ' asignado al equipo ', a.teamId)
  FROM JSON_TABLE(p_assignments, '$[*]' COLUMNS (
    playerId INT PATH '$.playerId' ERROR ON EMPTY ERROR ON ERROR,
    teamId INT PATH '$.teamId' ERROR ON EMPTY ERROR ON ERROR
  )) AS a;
  SELECT ROW_COUNT() AS affectedRows, LAST_INSERT_ID() AS insertId;
END$$

-- src/tournament/round-result.service.ts:getResult
DROP PROCEDURE IF EXISTS sp_ap_get_round_result$$
CREATE PROCEDURE sp_ap_get_round_result(IN p_round_id INT)
SQL SECURITY INVOKER
BEGIN
  SELECT r.id AS roundId, r.tournamentId, r.home AS homeTeamId, r.away AS awayTeamId,
    r.homeGoals, r.awayGoals, r.state, COALESCE(r.isNullMatch, 0) AS isNullMatch,
    r.stage, COALESCE(t.isFinished, 0) AS tieFinished
  FROM rounds r
  LEFT JOIN ties t ON t.id = r.tieId
  WHERE r.id = p_round_id;
END$$

-- src/tournament/round-result.service.ts:getResult / updateResult
-- Incluye eventos de todos los reportes de la ronda y el nombre del jugador
-- aunque ya no pertenezca al plantel.
DROP PROCEDURE IF EXISTS sp_ap_get_round_result_events$$
CREATE PROCEDURE sp_ap_get_round_result_events(IN p_round_id INT)
SQL SECURITY INVOKER
BEGIN
  SELECT me.id AS eventId, me.teamId, me.playerId,
    CAST(me.eventType AS CHAR) AS eventType, me.minute, me.notes,
    p.name AS playerName, p.lastName AS playerLastName
  FROM match_events me
  JOIN match_reports mr ON mr.id = me.reportId
  LEFT JOIN players p ON p.id = me.playerId
  WHERE mr.roundId = p_round_id
  ORDER BY me.minute IS NULL, me.minute, me.id;
END$$

-- src/tournament/round-result.service.ts:updateResult
-- Bloquea la ronda dentro de la transaccion de la API antes de validarla.
DROP PROCEDURE IF EXISTS sp_ap_lock_round_for_result$$
CREATE PROCEDURE sp_ap_lock_round_for_result(IN p_round_id INT)
SQL SECURITY INVOKER
BEGIN
  SELECT r.id AS roundId, r.tournamentId, r.home AS homeTeamId, r.away AS awayTeamId,
    r.homeGoals, r.awayGoals, r.state, COALESCE(r.isNullMatch, 0) AS isNullMatch,
    r.stage, COALESCE(t.isFinished, 0) AS tieFinished
  FROM rounds r
  LEFT JOIN ties t ON t.id = r.tieId
  WHERE r.id = p_round_id
  FOR UPDATE;
END$$

-- src/tournament/round-result.service.ts:updateResult
-- Reemplaza el resultado de una ronda ya jugada. Compara los eventos recibidos
-- con los guardados por (equipo, jugador, tipo, minuto): los coincidentes se
-- conservan con su id, para no alterar el orden de tarjetas, la semana de inicio
-- de las lesiones ni el estado de sanciones ya cumplidas. Los eventos quitados
-- se borran con sus tarjetas, lesiones y sanciones; los nuevos se insertan con
-- las mismas reglas que sp_save_match_report. Despues se recalculan las
-- sanciones de doble amarilla de la ronda y las de acumulacion de los
-- jugadores afectados (en orden cronologico), y las estadisticas del torneo.
DROP PROCEDURE IF EXISTS sp_ap_replace_match_result$$
CREATE PROCEDURE sp_ap_replace_match_result(IN p_round_id INT, IN p_home_goals INT, IN p_away_goals INT, IN p_events JSON)
SQL SECURITY INVOKER
BEGIN
  DECLARE v_tournament_id INT;
  DECLARE v_home_team INT;
  DECLARE v_away_team INT;
  DECLARE v_matchday INT;
  DECLARE v_unit_type VARCHAR(16);
  DECLARE v_unit_value INT;
  DECLARE v_week INT;
  DECLARE v_report_id INT;
  DECLARE v_locked INT;
  DECLARE v_invalid INT DEFAULT 0;
  DECLARE v_max_suspension BIGINT UNSIGNED DEFAULT 0;
  DECLARE v_red_units INT DEFAULT 2;
  DECLARE v_yellow_limit INT DEFAULT 3;
  DECLARE v_yellow_units INT DEFAULT 1;
  DECLARE v_injury_weeks INT DEFAULT 2;
  DECLARE v_kept INT DEFAULT 0;
  DECLARE v_added INT DEFAULT 0;
  DECLARE v_removed INT DEFAULT 0;

  SELECT r.tournamentId, r.home, r.away, r.matchday,
    CASE WHEN r.matchday IS NOT NULL THEN 'MATCHDAY' ELSE 'ROUND' END,
    COALESCE(r.matchday, r.round),
    COALESCE(sw.weekNumber, fn_get_current_week(t.seasonId), 1)
  INTO v_tournament_id, v_home_team, v_away_team, v_matchday,
    v_unit_type, v_unit_value, v_week
  FROM rounds r
  JOIN tournament t ON t.id = r.tournamentId
  LEFT JOIN season_weeks sw ON sw.id = r.seasonWeekId
  WHERE r.id = p_round_id;

  IF v_tournament_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El partido no existe';
  END IF;

  -- Serializa ediciones del mismo torneo: la acumulacion de amarillas es global.
  SELECT t.id INTO v_locked FROM tournament t WHERE t.id = v_tournament_id FOR UPDATE;

  -- Mismas reglas y valores por defecto que sp_save_match_report.
  IF EXISTS (SELECT 1 FROM tournament_rules WHERE tournamentId = v_tournament_id) THEN
    SELECT COALESCE(injuryWeeks, 2), COALESCE(redSuspensionUnits, 1),
      yellowCardsForSuspension, COALESCE(yellowSuspensionUnits, 1)
    INTO v_injury_weeks, v_red_units, v_yellow_limit, v_yellow_units
    FROM tournament_rules
    WHERE tournamentId = v_tournament_id;
  END IF;

  SELECT MAX(mr.id) INTO v_report_id FROM match_reports mr WHERE mr.roundId = p_round_id;
  IF v_report_id IS NULL THEN
    INSERT INTO match_reports (roundId, tournamentId, homeGoals, awayGoals)
    VALUES (p_round_id, v_tournament_id, p_home_goals, p_away_goals);
    SET v_report_id = LAST_INSERT_ID();
  END IF;
  UPDATE match_reports
  SET homeGoals = p_home_goals, awayGoals = p_away_goals
  WHERE roundId = p_round_id;

  DROP TEMPORARY TABLE IF EXISTS tmp_ap_new_events;
  DROP TEMPORARY TABLE IF EXISTS tmp_ap_old_events;
  DROP TEMPORARY TABLE IF EXISTS tmp_ap_added_events;
  DROP TEMPORARY TABLE IF EXISTS tmp_ap_card_players;
  DROP TEMPORARY TABLE IF EXISTS tmp_ap_accumulation;

  -- Tipos comparados por codigo numerico (orden del ENUM de match_events) para
  -- evitar mezclas de collation entre JSON_TABLE y la tabla.
  CREATE TEMPORARY TABLE tmp_ap_new_events (
    seq INT NOT NULL PRIMARY KEY,
    teamId INT NULL,
    playerId BIGINT UNSIGNED NULL,
    typeCode INT NOT NULL,
    minute INT NULL,
    notes VARCHAR(255) NULL,
    hasNotes TINYINT NOT NULL,
    rn INT NOT NULL,
    matchedEventId INT NULL
  );
  INSERT INTO tmp_ap_new_events (seq, teamId, playerId, typeCode, minute, notes, hasNotes, rn)
  SELECT j.seq, j.teamId, j.playerId,
    FIELD(j.eventType, 'GOAL', 'YELLOW', 'RED', 'INJURY'),
    j.minute, j.notes, j.hasNotes,
    ROW_NUMBER() OVER (
      PARTITION BY j.teamId, j.playerId,
        FIELD(j.eventType, 'GOAL', 'YELLOW', 'RED', 'INJURY'), j.minute
      ORDER BY j.seq
    )
  FROM JSON_TABLE(p_events, '$[*]' COLUMNS (
    seq FOR ORDINALITY,
    teamId INT PATH '$.teamId',
    playerId BIGINT PATH '$.playerId',
    eventType VARCHAR(16) PATH '$.eventType',
    minute INT PATH '$.minute',
    notes VARCHAR(255) PATH '$.notes',
    hasNotes TINYINT EXISTS PATH '$.notes'
  )) AS j;

  SELECT COUNT(*) INTO v_invalid
  FROM tmp_ap_new_events n
  WHERE n.typeCode = 0
    OR n.teamId IS NULL
    OR n.teamId NOT IN (v_home_team, v_away_team);
  IF v_invalid > 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Hay eventos con tipo o equipo invalido para este partido';
  END IF;

  CREATE TEMPORARY TABLE tmp_ap_old_events (
    eventId INT NOT NULL PRIMARY KEY,
    teamId INT NOT NULL,
    playerId BIGINT UNSIGNED NULL,
    typeCode INT NOT NULL,
    minute INT NULL,
    rn INT NOT NULL,
    keepEvent TINYINT NOT NULL DEFAULT 0
  );
  INSERT INTO tmp_ap_old_events (eventId, teamId, playerId, typeCode, minute, rn)
  SELECT me.id, me.teamId, me.playerId, me.eventType + 0, me.minute,
    ROW_NUMBER() OVER (
      PARTITION BY me.teamId, me.playerId, me.eventType + 0, me.minute
      ORDER BY me.id
    )
  FROM match_events me
  JOIN match_reports mr ON mr.id = me.reportId
  WHERE mr.roundId = p_round_id;

  UPDATE tmp_ap_new_events n
  JOIN tmp_ap_old_events o
    ON o.teamId = n.teamId
    AND o.playerId <=> n.playerId
    AND o.typeCode = n.typeCode
    AND o.minute <=> n.minute
    AND o.rn = n.rn
  SET n.matchedEventId = o.eventId, o.keepEvent = 1;

  SELECT COUNT(*) INTO v_kept FROM tmp_ap_old_events WHERE keepEvent = 1;
  SELECT COUNT(*) INTO v_removed FROM tmp_ap_old_events WHERE keepEvent = 0;

  -- Jugadores con tarjetas agregadas o quitadas en esta ronda.
  CREATE TEMPORARY TABLE tmp_ap_card_players (
    playerId BIGINT UNSIGNED NOT NULL PRIMARY KEY
  );
  INSERT IGNORE INTO tmp_ap_card_players (playerId)
  SELECT c.playerId
  FROM player_tournament_cards c
  JOIN tmp_ap_old_events o ON o.eventId = c.eventId
  WHERE o.keepEvent = 0;

  -- Eventos quitados: primero lo que depende de ellos.
  DELETE ps FROM player_tournament_suspensions ps
  JOIN player_tournament_cards c ON c.id = ps.sourceCardId
  JOIN tmp_ap_old_events o ON o.eventId = c.eventId
  WHERE o.keepEvent = 0;

  DELETE pu FROM player_unavailability pu
  JOIN tmp_ap_old_events o ON o.eventId = pu.sourceEventId
  WHERE o.keepEvent = 0;

  DELETE c FROM player_tournament_cards c
  JOIN tmp_ap_old_events o ON o.eventId = c.eventId
  WHERE o.keepEvent = 0;

  DELETE me FROM match_events me
  JOIN tmp_ap_old_events o ON o.eventId = me.id
  WHERE o.keepEvent = 0;

  UPDATE match_events me
  JOIN tmp_ap_new_events n ON n.matchedEventId = me.id
  SET me.notes = n.notes
  WHERE n.hasNotes = 1;

  INSERT INTO match_events (reportId, teamId, playerId, eventType, minute, notes)
  SELECT v_report_id, n.teamId, n.playerId,
    ELT(n.typeCode, 'GOAL', 'YELLOW', 'RED', 'INJURY'), n.minute, n.notes
  FROM tmp_ap_new_events n
  WHERE n.matchedEventId IS NULL
  ORDER BY n.seq;
  SET v_added = ROW_COUNT();

  CREATE TEMPORARY TABLE tmp_ap_added_events (
    eventId INT NOT NULL PRIMARY KEY
  );
  INSERT INTO tmp_ap_added_events (eventId)
  SELECT me.id
  FROM match_events me
  WHERE me.reportId = v_report_id
    AND NOT EXISTS (SELECT 1 FROM tmp_ap_old_events o WHERE o.eventId = me.id);

  INSERT INTO player_tournament_cards (
    tournamentId, roundId, matchday, reportId, eventId, playerId, teamId, cardType
  )
  SELECT v_tournament_id, p_round_id, v_matchday, me.reportId, me.id,
    me.playerId, me.teamId, CAST(me.eventType AS CHAR)
  FROM match_events me
  JOIN tmp_ap_added_events a ON a.eventId = me.id
  WHERE me.eventType IN ('YELLOW', 'RED')
    AND me.playerId IS NOT NULL;

  INSERT IGNORE INTO tmp_ap_card_players (playerId)
  SELECT c.playerId
  FROM player_tournament_cards c
  JOIN tmp_ap_added_events a ON a.eventId = c.eventId;

  INSERT INTO player_unavailability (
    playerId, teamId, reason, sourceTournamentId, sourceRoundId,
    sourceReportId, sourceEventId, startWeekNumber, durationWeeks, notes
  )
  SELECT me.playerId, me.teamId, 'INJURY', v_tournament_id, p_round_id,
    me.reportId, me.id, v_week, v_injury_weeks, me.notes
  FROM match_events me
  JOIN tmp_ap_added_events a ON a.eventId = me.id
  WHERE me.eventType = 'INJURY'
    AND me.playerId IS NOT NULL;

  UPDATE rounds
  SET homeGoals = p_home_goals,
    awayGoals = p_away_goals,
    teamWin = CASE
      WHEN p_home_goals > p_away_goals THEN home
      WHEN p_away_goals > p_home_goals THEN away
      ELSE NULL
    END,
    teamLose = CASE
      WHEN p_home_goals < p_away_goals THEN home
      WHEN p_away_goals < p_home_goals THEN away
      ELSE NULL
    END,
    state = 1
  WHERE id = p_round_id;

  SELECT COALESCE(MAX(id), 0) INTO v_max_suspension FROM player_tournament_suspensions;

  -- Doble amarilla que dejo de serlo (se quito una amarilla o se agrego una roja).
  DELETE ps FROM player_tournament_suspensions ps
  JOIN player_tournament_cards c ON c.id = ps.sourceCardId
  WHERE c.roundId = p_round_id
    AND ps.suspensionType = 'DOUBLE_YELLOW'
    AND (
      (SELECT COUNT(*) FROM player_tournament_cards y
        WHERE y.roundId = p_round_id AND y.playerId = c.playerId
          AND y.cardType = 'YELLOW') < 2
      OR EXISTS (SELECT 1 FROM player_tournament_cards x
        WHERE x.roundId = p_round_id AND x.playerId = c.playerId
          AND x.cardType = 'RED')
    );

  INSERT INTO player_tournament_suspensions (
    tournamentId, playerId, teamId, sourceCardId, suspensionType,
    unitType, fromUnitValue, untilUnitValue, matchesToServe, status
  )
  SELECT v_tournament_id, c.playerId, c.teamId, MAX(c.id), 'DOUBLE_YELLOW',
    v_unit_type, v_unit_value + 1, v_unit_value + v_yellow_units,
    v_yellow_units, 'ACTIVE'
  FROM player_tournament_cards c
  JOIN tmp_ap_card_players cp ON cp.playerId = c.playerId
  WHERE c.roundId = p_round_id
    AND c.cardType = 'YELLOW'
    AND NOT EXISTS (SELECT 1 FROM player_tournament_cards x
      WHERE x.roundId = p_round_id AND x.playerId = c.playerId
        AND x.cardType = 'RED')
    AND NOT EXISTS (SELECT 1 FROM player_tournament_suspensions ps
      JOIN player_tournament_cards s ON s.id = ps.sourceCardId
      WHERE ps.suspensionType = 'DOUBLE_YELLOW'
        AND s.roundId = p_round_id AND s.playerId = c.playerId)
  GROUP BY c.playerId, c.teamId
  HAVING COUNT(*) >= 2;

  INSERT INTO player_tournament_suspensions (
    tournamentId, playerId, teamId, sourceCardId, suspensionType,
    unitType, fromUnitValue, untilUnitValue, matchesToServe, status
  )
  SELECT v_tournament_id, c.playerId, c.teamId, c.id, 'RED',
    v_unit_type, v_unit_value + 1, v_unit_value + v_red_units,
    v_red_units, 'ACTIVE'
  FROM player_tournament_cards c
  JOIN tmp_ap_added_events a ON a.eventId = c.eventId
  WHERE c.cardType = 'RED';

  -- Acumulacion: se recalcula el torneo completo de los jugadores afectados,
  -- contando amarillas en orden cronologico (fase, fecha o ronda, id).
  IF v_yellow_limit IS NOT NULL AND v_yellow_limit > 0 THEN
    CREATE TEMPORARY TABLE tmp_ap_accumulation (
      cardId BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      playerId BIGINT UNSIGNED NOT NULL,
      teamId INT NOT NULL,
      unitType VARCHAR(16) NOT NULL,
      unitValue INT NOT NULL
    );
    INSERT INTO tmp_ap_accumulation (cardId, playerId, teamId, unitType, unitValue)
    SELECT x.id, x.playerId, x.teamId, x.unitType, x.unitValue
    FROM (
      SELECT c.id, c.playerId, c.teamId,
        CASE WHEN r.matchday IS NOT NULL THEN 'MATCHDAY' ELSE 'ROUND' END AS unitType,
        COALESCE(r.matchday, r.round) AS unitValue,
        ROW_NUMBER() OVER (
          PARTITION BY c.playerId
          ORDER BY r.stage + 0, COALESCE(r.matchday, r.round), c.roundId, c.id
        ) AS yellowNumber,
        COUNT(*) OVER (PARTITION BY c.playerId, c.roundId) AS roundYellows
      FROM player_tournament_cards c
      JOIN rounds r ON r.id = c.roundId
      JOIN tmp_ap_card_players cp ON cp.playerId = c.playerId
      WHERE c.tournamentId = v_tournament_id
        AND c.cardType = 'YELLOW'
    ) x
    WHERE x.yellowNumber MOD v_yellow_limit = 0
      AND x.roundYellows < 2;

    DELETE ps FROM player_tournament_suspensions ps
    JOIN tmp_ap_card_players cp ON cp.playerId = ps.playerId
    LEFT JOIN tmp_ap_accumulation a ON a.cardId = ps.sourceCardId
    WHERE ps.tournamentId = v_tournament_id
      AND ps.suspensionType = 'YELLOW_ACCUMULATION'
      AND a.cardId IS NULL;

    INSERT INTO player_tournament_suspensions (
      tournamentId, playerId, teamId, sourceCardId, suspensionType,
      unitType, fromUnitValue, untilUnitValue, matchesToServe, status
    )
    SELECT v_tournament_id, a.playerId, a.teamId, a.cardId, 'YELLOW_ACCUMULATION',
      a.unitType, a.unitValue + 1, a.unitValue + v_yellow_units,
      v_yellow_units, 'ACTIVE'
    FROM tmp_ap_accumulation a
    WHERE NOT EXISTS (SELECT 1 FROM player_tournament_suspensions ps
      WHERE ps.sourceCardId = a.cardId
        AND ps.suspensionType = 'YELLOW_ACCUMULATION');
  END IF;

  -- Sanciones nuevas cuyo periodo ya paso: se marcan cumplidas en el primer
  -- partido jugado por el equipo dentro del periodo.
  UPDATE player_tournament_suspensions ps
  SET ps.servedRoundId = (
    SELECT r.id
    FROM rounds r
    WHERE r.tournamentId = ps.tournamentId
      AND r.state = 1
      AND ps.teamId IN (r.home, r.away)
      AND (
        (ps.unitType = 'MATCHDAY'
          AND r.matchday BETWEEN ps.fromUnitValue AND ps.untilUnitValue)
        OR (ps.unitType = 'ROUND' AND r.matchday IS NULL
          AND r.round BETWEEN ps.fromUnitValue AND ps.untilUnitValue)
      )
    ORDER BY COALESCE(r.matchday, r.round), r.id
    LIMIT 1
  )
  WHERE ps.tournamentId = v_tournament_id
    AND ps.id > v_max_suspension
    AND ps.status = 'ACTIVE';

  UPDATE player_tournament_suspensions ps
  SET ps.status = 'SERVED'
  WHERE ps.tournamentId = v_tournament_id
    AND ps.id > v_max_suspension
    AND ps.status = 'ACTIVE'
    AND ps.servedRoundId IS NOT NULL;

  CALL sp_recalculate_statistics(v_tournament_id);

  DROP TEMPORARY TABLE IF EXISTS tmp_ap_new_events;
  DROP TEMPORARY TABLE IF EXISTS tmp_ap_old_events;
  DROP TEMPORARY TABLE IF EXISTS tmp_ap_added_events;
  DROP TEMPORARY TABLE IF EXISTS tmp_ap_card_players;
  DROP TEMPORARY TABLE IF EXISTS tmp_ap_accumulation;

  SELECT v_report_id AS reportId, v_kept AS eventsKept,
    v_added AS eventsAdded, v_removed AS eventsRemoved;
END$$

DELIMITER ;
