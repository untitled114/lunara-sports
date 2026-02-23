package com.playbyplay.enrichment;

import com.playbyplay.models.EnrichedEvent;
import com.playbyplay.models.GameEvent;
import com.playbyplay.models.ScoreboardSnapshot;
import org.apache.kafka.streams.kstream.ValueJoiner;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;

/**
 * Joins a raw GameEvent with a ScoreboardSnapshot to produce an EnrichedEvent.
 *
 * <p>The scoreboard provides team display names, venue, and abbreviations that
 * the raw play event doesn't carry. The enricher also computes the score
 * differential (home - away).</p>
 *
 * <p>Used as a {@link ValueJoiner} in a KStream–GlobalKTable left join.
 * If no scoreboard snapshot is available (null), the enricher still produces
 * an event with the fields it can populate from the play alone.</p>
 */
public class TeamEnricher implements ValueJoiner<GameEvent, ScoreboardSnapshot, EnrichedEvent> {

    private static final Logger log = LoggerFactory.getLogger(TeamEnricher.class);

    @Override
    public EnrichedEvent apply(GameEvent event, ScoreboardSnapshot scoreboard) {
        EnrichedEvent enriched = new EnrichedEvent();

        // Copy all play fields
        enriched.setGameId(event.getGameId());
        enriched.setPlayId(event.getPlayId());
        enriched.setSequenceNumber(event.getSequenceNumber());
        enriched.setQuarter(event.getQuarter());
        enriched.setClock(event.getClock());
        enriched.setEventType(event.getEventType());
        enriched.setEventText(event.getEventText());
        enriched.setDescription(event.getDescription());
        enriched.setTeam(event.getTeam());
        enriched.setPlayerName(event.getPlayerName());
        enriched.setHomeScore(event.getHomeScore());
        enriched.setAwayScore(event.getAwayScore());
        enriched.setScoringPlay(event.isScoringPlay());
        enriched.setScoreValue(event.getScoreValue());
        enriched.setWallclock(event.getWallclock());

        // Computed fields
        enriched.setScoreDifferential(event.getHomeScore() - event.getAwayScore());
        enriched.setEnrichedAt(Instant.now());

        // Resolve team metadata from scoreboard (if available)
        if (scoreboard != null) {
            enriched.setHomeTeam(scoreboard.getHomeTeam());
            enriched.setAwayTeam(scoreboard.getAwayTeam());
            enriched.setHomeTeamName(scoreboard.getHomeTeamName());
            enriched.setAwayTeamName(scoreboard.getAwayTeamName());
            enriched.setVenue(scoreboard.getVenue());
        } else {
            log.debug("No scoreboard snapshot for game {}, enriching without team metadata",
                    event.getGameId());
        }

        return enriched;
    }
}
