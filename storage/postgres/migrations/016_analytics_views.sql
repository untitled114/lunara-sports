-- Analytics over games and plays: read-only views in their own schema.
--
-- They read only plays that carry ESPN's time order (espn_order), i.e. plays written or
-- reconciled since migration 015; the sequence number is not a time order. Points come from
-- ESPN's own per-play score value, so they add up to ESPN's box score.
CREATE SCHEMA IF NOT EXISTS analytics;

-- Every play in time order, with the side that made it, the points it scored and the margin
-- (home minus away) after it.
CREATE OR REPLACE VIEW analytics.play_flow AS
SELECT
    p.game_id,
    p.espn_order,
    p.quarter,
    p.clock,
    p.team,
    p.player_name,
    p.event_type,
    p.description,
    p.home_score,
    p.away_score,
    p.home_score - p.away_score AS margin,
    CASE WHEN p.team = g.home_team THEN 'home'
         WHEN p.team = g.away_team THEN 'away' END AS side,
    CASE WHEN p.scoring_play THEN COALESCE(p.score_value, 0) ELSE 0 END AS points
FROM plays p
JOIN games g ON g.id = p.game_id
WHERE p.espn_order IS NOT NULL;

-- Points per team per quarter (overtimes are quarters 5, 6, ...).
CREATE OR REPLACE VIEW analytics.quarter_scoring AS
SELECT
    game_id,
    quarter,
    COALESCE(SUM(points) FILTER (WHERE side = 'home'), 0) AS home_points,
    COALESCE(SUM(points) FILTER (WHERE side = 'away'), 0) AS away_points
FROM analytics.play_flow
GROUP BY game_id, quarter;

-- Points per player per game, with how they were scored.
CREATE OR REPLACE VIEW analytics.player_points AS
SELECT
    game_id,
    team,
    player_name,
    SUM(points) AS points,
    COUNT(*) FILTER (WHERE points = 3) AS threes,
    COUNT(*) FILTER (WHERE points = 2) AS twos,
    COUNT(*) FILTER (WHERE points = 1) AS free_throws
FROM analytics.play_flow
WHERE points > 0
GROUP BY game_id, team, player_name;

-- Scoring runs: consecutive points by one side with no points by the other (gaps and
-- islands over the scoring plays in time order).
CREATE OR REPLACE VIEW analytics.scoring_runs AS
WITH scoring AS (
    SELECT
        game_id, espn_order, quarter, clock, side, team, points,
        ROW_NUMBER() OVER (PARTITION BY game_id ORDER BY espn_order)
          - ROW_NUMBER() OVER (PARTITION BY game_id, side ORDER BY espn_order) AS island
    FROM analytics.play_flow
    WHERE points > 0 AND side IS NOT NULL
)
SELECT
    game_id,
    side,
    MIN(team) AS team,
    SUM(points) AS points,
    COUNT(*) AS scoring_plays,
    MIN(espn_order) AS first_play,
    MAX(espn_order) AS last_play,
    (ARRAY_AGG(quarter ORDER BY espn_order))[1] AS start_quarter,
    (ARRAY_AGG(clock ORDER BY espn_order))[1] AS start_clock,
    (ARRAY_AGG(quarter ORDER BY espn_order DESC))[1] AS end_quarter,
    (ARRAY_AGG(clock ORDER BY espn_order DESC))[1] AS end_clock
FROM scoring
GROUP BY game_id, side, island;

-- One row per game: lead changes, ties, largest leads, the longest run and the final margin.
-- A lead change is the margin's sign flipping between leads; a tie is a score that turns the
-- margin to zero (the 0-0 start is not a tie).
CREATE OR REPLACE VIEW analytics.game_flow AS
WITH after_scores AS (
    SELECT game_id, espn_order, margin,
           LAG(margin) OVER (PARTITION BY game_id ORDER BY espn_order) AS prev_margin
    FROM analytics.play_flow
    WHERE points > 0
),
leads AS (
    SELECT game_id, espn_order, SIGN(margin) AS leader,
           LAG(SIGN(margin)) OVER (PARTITION BY game_id ORDER BY espn_order) AS prev_leader
    FROM after_scores
    WHERE margin <> 0
),
longest AS (
    SELECT DISTINCT ON (game_id) game_id, team AS longest_run_team, points AS longest_run_points
    FROM analytics.scoring_runs
    ORDER BY game_id, points DESC, first_play
)
SELECT
    g.id AS game_id,
    g.home_team,
    g.away_team,
    (SELECT COUNT(*) FROM leads l
      WHERE l.game_id = g.id AND l.prev_leader IS NOT NULL AND l.leader <> l.prev_leader)
        AS lead_changes,
    (SELECT COUNT(*) FROM after_scores a
      WHERE a.game_id = g.id AND a.margin = 0 AND COALESCE(a.prev_margin, 0) <> 0) AS times_tied,
    (SELECT GREATEST(MAX(margin), 0) FROM analytics.play_flow f WHERE f.game_id = g.id)
        AS largest_home_lead,
    (SELECT GREATEST(-MIN(margin), 0) FROM analytics.play_flow f WHERE f.game_id = g.id)
        AS largest_away_lead,
    lg.longest_run_team,
    lg.longest_run_points,
    g.home_score - g.away_score AS final_margin
FROM games g
LEFT JOIN longest lg ON lg.game_id = g.id
WHERE EXISTS (SELECT 1 FROM analytics.play_flow f WHERE f.game_id = g.id);
