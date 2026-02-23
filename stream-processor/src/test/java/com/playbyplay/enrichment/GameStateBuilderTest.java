package com.playbyplay.enrichment;

import com.playbyplay.avro.EnrichedEvent;
import com.playbyplay.avro.GameState;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class GameStateBuilderTest {

    private final GameStateBuilder builder = new GameStateBuilder();
    private GameState state;

    @BeforeEach
    void setUp() {
        state = new GameState();
    }

    private EnrichedEvent event(int seq, int quarter, String clock, String eventType,
                                String desc, int homeScore, int awayScore,
                                boolean scoring, int scoreValue) {
        EnrichedEvent e = new EnrichedEvent();
        e.setGameId("G1");
        e.setPlayId("G1" + seq);
        e.setSequenceNumber(seq);
        e.setQuarter(quarter);
        e.setClock(clock);
        e.setEventType(eventType);
        e.setEventText(eventType);
        e.setDescription(desc);
        e.setHomeScore(homeScore);
        e.setAwayScore(awayScore);
        e.setScoringPlay(scoring);
        e.setScoreValue(scoreValue);
        e.setScoreDifferential(homeScore - awayScore);
        e.setEnrichedAt(Instant.now());
        e.setHomeTeam("BOS");
        e.setAwayTeam("LAL");
        e.setHomeTeamName("Boston Celtics");
        e.setAwayTeamName("Los Angeles Lakers");
        e.setVenue("TD Garden");
        return e;
    }

    @Test
    @DisplayName("First event initializes state")
    void firstEventInitializes() {
        state = builder.apply("G1", event(1, 1, "12:00", "jump_ball", "Tip-off", 0, 0, false, 0), state);

        assertEquals("G1", state.getGameId());
        assertEquals(0, state.getHomeScore());
        assertEquals(0, state.getAwayScore());
        assertEquals(1, state.getQuarter());
        assertEquals("12:00", state.getClock());
        assertEquals(1, state.getPlayCount());
        assertEquals(1, state.getLastPlaySequence());
        assertEquals("Tip-off", state.getLastPlayDescription());
        assertEquals("LIVE", state.getStatus());
        assertNotNull(state.getUpdatedAt());
    }

    @Test
    @DisplayName("Scoring play increments scoring count")
    void scoringPlayTracked() {
        state = builder.apply("G1", event(1, 1, "12:00", "jump_ball", "Tip", 0, 0, false, 0), state);
        state = builder.apply("G1", event(5, 1, "11:30", "jump_shot", "Makes 3", 3, 0, true, 3), state);

        assertEquals(2, state.getPlayCount());
        assertEquals(1, state.getScoringPlayCount());
        assertEquals(3, state.getHomeScore());
    }

    @Test
    @DisplayName("Duplicate sequence numbers skipped")
    void duplicatesSkipped() {
        state = builder.apply("G1", event(10, 1, "10:00", "jump_shot", "Play 1", 2, 0, true, 2), state);
        state = builder.apply("G1", event(10, 1, "10:00", "jump_shot", "Dup", 2, 0, true, 2), state);
        state = builder.apply("G1", event(5, 1, "10:30", "rebound", "Old", 0, 0, false, 0), state);

        assertEquals(1, state.getPlayCount());
        assertEquals(1, state.getScoringPlayCount());
        assertEquals("Play 1", state.getLastPlayDescription());
    }

    @Test
    @DisplayName("Team info set from first event")
    void teamInfoSetOnce() {
        state = builder.apply("G1", event(1, 1, "12:00", "jump_ball", "Tip", 0, 0, false, 0), state);

        assertEquals("BOS", state.getHomeTeam());
        assertEquals("LAL", state.getAwayTeam());
        assertEquals("Boston Celtics", state.getHomeTeamName());
        assertEquals("TD Garden", state.getVenue());
    }

    @Test
    @DisplayName("period_end Q2 → HALFTIME")
    void halftimeFromPeriodEnd() {
        state = builder.apply("G1", event(200, 2, "0:00", "period_end",
                "End of 2nd Quarter", 55, 48, false, 0), state);
        assertEquals("HALFTIME", state.getStatus());
    }

    @Test
    @DisplayName("period_end Q1 → stays LIVE")
    void endOfQ1StaysLive() {
        state = builder.apply("G1", event(100, 1, "0:00", "period_end",
                "End of 1st Quarter", 28, 25, false, 0), state);
        assertEquals("LIVE", state.getStatus());
    }

    @Test
    @DisplayName("period_end Q3 → stays LIVE")
    void endOfQ3StaysLive() {
        state = builder.apply("G1", event(300, 3, "0:00", "period_end",
                "End of 3rd Quarter", 80, 75, false, 0), state);
        assertEquals("LIVE", state.getStatus());
    }

    @Test
    @DisplayName("game_end → FINAL")
    void gameEnd() {
        state = builder.apply("G1", event(500, 4, "0:00", "game_end",
                "End of Game", 110, 102, false, 0), state);
        assertEquals("FINAL", state.getStatus());
    }

    @Test
    @DisplayName("State progresses through multiple events")
    void fullGameProgression() {
        state = builder.apply("G1", event(1, 1, "12:00", "jump_ball", "Tip", 0, 0, false, 0), state);
        state = builder.apply("G1", event(10, 1, "11:00", "jump_shot", "Score", 2, 0, true, 2), state);
        state = builder.apply("G1", event(100, 2, "0:00", "period_end", "Half", 55, 48, false, 0), state);
        state = builder.apply("G1", event(300, 3, "6:00", "layup", "Score", 78, 70, true, 2), state);
        state = builder.apply("G1", event(500, 4, "0:00", "game_end", "Final", 110, 102, false, 0), state);

        assertEquals("FINAL", state.getStatus());
        assertEquals(110, state.getHomeScore());
        assertEquals(102, state.getAwayScore());
        assertEquals(5, state.getPlayCount());
        assertEquals(2, state.getScoringPlayCount());
        assertEquals(500, state.getLastPlaySequence());
    }
}
