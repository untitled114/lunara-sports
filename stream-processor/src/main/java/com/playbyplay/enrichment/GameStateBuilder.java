package com.playbyplay.enrichment;

import com.playbyplay.models.EnrichedEvent;
import com.playbyplay.models.GameState;
import org.apache.kafka.streams.kstream.Aggregator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;

/**
 * Aggregator that incrementally builds GameState from enriched play events.
 *
 * <p>Each incoming event updates the running game state: score, quarter, clock,
 * play count, team info, and sequence watermark. Events with a sequence number
 * at or below the last-seen sequence are treated as duplicates and skipped.</p>
 *
 * <p>Game status is derived from event types:</p>
 * <ul>
 *   <li>{@code game_end} → FINAL</li>
 *   <li>{@code period_end} with quarter = 2 → HALFTIME</li>
 *   <li>anything else → LIVE</li>
 * </ul>
 */
public class GameStateBuilder implements Aggregator<String, EnrichedEvent, GameState> {

    private static final Logger log = LoggerFactory.getLogger(GameStateBuilder.class);

    @Override
    public GameState apply(String gameId, EnrichedEvent event, GameState state) {
        // Skip duplicate or out-of-order events
        if (event.getSequenceNumber() <= state.getLastPlaySequence()) {
            log.debug("Skipping duplicate seq={} for game {}", event.getSequenceNumber(), gameId);
            return state;
        }

        // Core state from play
        state.setGameId(gameId);
        state.setHomeScore(event.getHomeScore());
        state.setAwayScore(event.getAwayScore());
        state.setQuarter(event.getQuarter());
        state.setClock(event.getClock());
        state.setLastPlaySequence(event.getSequenceNumber());
        state.setPlayCount(state.getPlayCount() + 1);
        state.setUpdatedAt(Instant.now());

        // Last play info
        state.setLastPlayDescription(event.getDescription());
        state.setLastPlayType(event.getEventType());

        // Scoring stats
        if (event.isScoringPlay()) {
            state.setScoringPlayCount(state.getScoringPlayCount() + 1);
        }

        // Team info — set once from the first enriched event that has it
        if (state.getHomeTeam() == null && event.getHomeTeam() != null) {
            state.setHomeTeam(event.getHomeTeam());
            state.setAwayTeam(event.getAwayTeam());
            state.setHomeTeamName(event.getHomeTeamName());
            state.setAwayTeamName(event.getAwayTeamName());
            state.setVenue(event.getVenue());
        }

        // Derive game status from event type
        state.setStatus(deriveStatus(event));

        log.debug("Updated state: {}", state);
        return state;
    }

    static String deriveStatus(EnrichedEvent event) {
        String type = event.getEventType();
        if (type == null) {
            return "LIVE";
        }
        switch (type) {
            case "game_end":
                return "FINAL";
            case "period_end":
                // Quarter 2 end = halftime
                return event.getQuarter() == 2 ? "HALFTIME" : "LIVE";
            default:
                return "LIVE";
        }
    }
}
