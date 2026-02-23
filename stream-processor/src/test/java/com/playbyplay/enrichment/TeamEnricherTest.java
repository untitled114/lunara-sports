package com.playbyplay.enrichment;

import com.playbyplay.models.EnrichedEvent;
import com.playbyplay.models.GameEvent;
import com.playbyplay.models.ScoreboardSnapshot;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class TeamEnricherTest {

    private final TeamEnricher enricher = new TeamEnricher();

    private GameEvent makePlay(int homeScore, int awayScore) {
        GameEvent e = new GameEvent();
        e.setGameId("G1");
        e.setPlayId("G1_10");
        e.setSequenceNumber(10);
        e.setQuarter(2);
        e.setClock("5:30");
        e.setEventType("jump_shot");
        e.setEventText("Jump Shot");
        e.setDescription("Player makes jumper");
        e.setTeam("BOS");
        e.setPlayerName("Jayson Tatum");
        e.setHomeScore(homeScore);
        e.setAwayScore(awayScore);
        e.setScoringPlay(true);
        e.setScoreValue(2);
        e.setWallclock(Instant.parse("2026-02-17T02:00:00Z"));
        e.setPolledAt(Instant.parse("2026-02-17T02:00:01Z"));
        return e;
    }

    private ScoreboardSnapshot makeScoreboard() {
        ScoreboardSnapshot s = new ScoreboardSnapshot();
        s.setGameId("G1");
        s.setHomeTeam("BOS");
        s.setAwayTeam("LAL");
        s.setHomeTeamName("Boston Celtics");
        s.setAwayTeamName("Los Angeles Lakers");
        s.setVenue("TD Garden");
        s.setStatus("live");
        return s;
    }

    @Test
    @DisplayName("Copies all play fields to enriched event")
    void copiesPlayFields() {
        GameEvent play = makePlay(55, 48);
        EnrichedEvent result = enricher.apply(play, makeScoreboard());

        assertEquals("G1", result.getGameId());
        assertEquals("G1_10", result.getPlayId());
        assertEquals(10, result.getSequenceNumber());
        assertEquals(2, result.getQuarter());
        assertEquals("5:30", result.getClock());
        assertEquals("jump_shot", result.getEventType());
        assertEquals("Jump Shot", result.getEventText());
        assertEquals("Player makes jumper", result.getDescription());
        assertEquals("BOS", result.getTeam());
        assertEquals("Jayson Tatum", result.getPlayerName());
        assertEquals(55, result.getHomeScore());
        assertEquals(48, result.getAwayScore());
        assertTrue(result.isScoringPlay());
        assertEquals(2, result.getScoreValue());
        assertNotNull(result.getWallclock());
    }

    @Test
    @DisplayName("Resolves team metadata from scoreboard")
    void resolvesTeamMetadata() {
        EnrichedEvent result = enricher.apply(makePlay(55, 48), makeScoreboard());

        assertEquals("BOS", result.getHomeTeam());
        assertEquals("LAL", result.getAwayTeam());
        assertEquals("Boston Celtics", result.getHomeTeamName());
        assertEquals("Los Angeles Lakers", result.getAwayTeamName());
        assertEquals("TD Garden", result.getVenue());
    }

    @Test
    @DisplayName("Computes score differential (home - away)")
    void computesScoreDifferential() {
        EnrichedEvent homeLeading = enricher.apply(makePlay(55, 48), makeScoreboard());
        assertEquals(7, homeLeading.getScoreDifferential());

        EnrichedEvent tied = enricher.apply(makePlay(50, 50), makeScoreboard());
        assertEquals(0, tied.getScoreDifferential());

        EnrichedEvent awayLeading = enricher.apply(makePlay(40, 52), makeScoreboard());
        assertEquals(-12, awayLeading.getScoreDifferential());
    }

    @Test
    @DisplayName("Sets enrichedAt timestamp")
    void setsEnrichedAt() {
        EnrichedEvent result = enricher.apply(makePlay(0, 0), makeScoreboard());
        assertNotNull(result.getEnrichedAt());
    }

    @Test
    @DisplayName("Handles null scoreboard (left join miss)")
    void handlesNullScoreboard() {
        EnrichedEvent result = enricher.apply(makePlay(55, 48), null);

        // Play fields still present
        assertEquals("G1", result.getGameId());
        assertEquals(55, result.getHomeScore());
        assertEquals(7, result.getScoreDifferential());

        // Team metadata absent
        assertNull(result.getHomeTeam());
        assertNull(result.getAwayTeam());
        assertNull(result.getHomeTeamName());
        assertNull(result.getVenue());
    }
}
