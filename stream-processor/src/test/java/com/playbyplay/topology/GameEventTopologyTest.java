package com.playbyplay.topology;

import com.playbyplay.avro.EnrichedEvent;
import com.playbyplay.avro.GameState;
import com.playbyplay.avro.PlayEvent;
import com.playbyplay.avro.ScoreboardEvent;
import io.confluent.kafka.schemaregistry.client.MockSchemaRegistryClient;
import io.confluent.kafka.streams.serdes.avro.SpecificAvroSerde;
import org.apache.avro.specific.SpecificRecord;
import org.apache.kafka.common.serialization.Serdes;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.apache.kafka.streams.*;
import org.junit.jupiter.api.*;

import java.time.Instant;
import java.util.Collections;
import java.util.Map;
import java.util.Properties;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests the Kafka Streams topology using TopologyTestDriver.
 * No running Kafka broker needed — everything is in-memory.
 * Uses MockSchemaRegistryClient to avoid needing a running Schema Registry.
 */
class GameEventTopologyTest {

    private static final String MOCK_REGISTRY_URL = "mock://test";

    private TopologyTestDriver driver;
    private TestInputTopic<String, ScoreboardEvent> scoreboardInput;
    private TestInputTopic<String, PlayEvent> playsInput;
    private TestOutputTopic<String, EnrichedEvent> enrichedOutput;
    private TestOutputTopic<String, GameState> gameStateOutput;

    private MockSchemaRegistryClient schemaRegistryClient;

    private <T extends SpecificRecord> SpecificAvroSerde<T> mockAvroSerde(boolean isKey) {
        SpecificAvroSerde<T> serde = new SpecificAvroSerde<>(schemaRegistryClient);
        Map<String, String> config = Collections.singletonMap("schema.registry.url", MOCK_REGISTRY_URL);
        serde.configure(config, isKey);
        return serde;
    }

    @BeforeEach
    void setUp() {
        schemaRegistryClient = new MockSchemaRegistryClient();
        Topology topology = GameEventTopology.build(MOCK_REGISTRY_URL);

        Properties props = new Properties();
        props.put(StreamsConfig.APPLICATION_ID_CONFIG, "test-app");
        props.put(StreamsConfig.BOOTSTRAP_SERVERS_CONFIG, "dummy:9092");
        props.put(StreamsConfig.DEFAULT_KEY_SERDE_CLASS_CONFIG, Serdes.StringSerde.class);

        driver = new TopologyTestDriver(topology, props);

        SpecificAvroSerde<ScoreboardEvent> scoreboardSerde = mockAvroSerde(false);
        SpecificAvroSerde<PlayEvent> playEventSerde = mockAvroSerde(false);
        SpecificAvroSerde<EnrichedEvent> enrichedSerde = mockAvroSerde(false);
        SpecificAvroSerde<GameState> gameStateSerde = mockAvroSerde(false);

        scoreboardInput = driver.createInputTopic(
                GameEventTopology.SCOREBOARD_TOPIC,
                new StringSerializer(),
                scoreboardSerde.serializer()
        );
        playsInput = driver.createInputTopic(
                GameEventTopology.PLAYS_TOPIC,
                new StringSerializer(),
                playEventSerde.serializer()
        );
        enrichedOutput = driver.createOutputTopic(
                GameEventTopology.ENRICHED_TOPIC,
                new StringDeserializer(),
                enrichedSerde.deserializer()
        );
        gameStateOutput = driver.createOutputTopic(
                GameEventTopology.GAME_STATE_TOPIC,
                new StringDeserializer(),
                gameStateSerde.deserializer()
        );
    }

    @AfterEach
    void tearDown() {
        if (driver != null) {
            driver.close();
        }
    }

    // -- Helpers --

    private ScoreboardEvent scoreboard(String gameId, String homeTeam, String awayTeam) {
        ScoreboardEvent s = new ScoreboardEvent();
        s.setGameId(gameId);
        s.setHomeTeam(homeTeam);
        s.setAwayTeam(awayTeam);
        s.setHomeTeamName(homeTeam + " Team");
        s.setAwayTeamName(awayTeam + " Team");
        s.setHomeScore(0);
        s.setAwayScore(0);
        s.setStatus("live");
        s.setStatusDetail("");
        s.setVenue(venue);
        s.setStartTime(Instant.now());
        s.setPolledAt(Instant.now());
        return s;
    }

    private PlayEvent play(String gameId, int seq, int quarter, String clock,
                           String eventType, String desc, int homeScore, int awayScore,
                           boolean scoring, int scoreValue) {
        PlayEvent e = new PlayEvent();
        e.setGameId(gameId);
        e.setPlayId(gameId + seq);
        e.setSequenceNumber(seq);
        e.setQuarter(quarter);
        e.setClock(clock);
        e.setEventType(eventType);
        e.setEventText(eventType);
        e.setDescription(desc);
        e.setTeam("BOS");
        e.setPlayerName("Test Player");
        e.setHomeScore(homeScore);
        e.setAwayScore(awayScore);
        e.setScoringPlay(scoring);
        e.setScoreValue(scoreValue);
        e.setPolledAt(Instant.now());
        return e;
    }

    private static final String venue = "Test Arena";

    // -- Tests --

    @Test
    @DisplayName("Play event flows through to enriched.plays")
    void playProducesEnrichedEvent() {
        String gameId = "G1";
        scoreboardInput.pipeInput(gameId, scoreboard(gameId, "BOS", "LAL"));
        playsInput.pipeInput(gameId, play(gameId, 1, 1, "12:00", "jump_ball",
                "Tip-off", 0, 0, false, 0));

        assertFalse(enrichedOutput.isEmpty());
        KeyValue<String, EnrichedEvent> record = enrichedOutput.readKeyValue();
        assertEquals(gameId, record.key);
        assertEquals("jump_ball", record.value.getEventType());
        assertEquals(1, record.value.getSequenceNumber());
    }

    @Test
    @DisplayName("Enriched event has team names from scoreboard")
    void enrichmentResolvesTeamNames() {
        String gameId = "G2";
        scoreboardInput.pipeInput(gameId, scoreboard(gameId, "GS", "SA"));
        playsInput.pipeInput(gameId, play(gameId, 5, 1, "11:30", "jump_shot",
                "Curry makes three", 3, 0, true, 3));

        EnrichedEvent enriched = enrichedOutput.readValue();
        assertEquals("GS", enriched.getHomeTeam());
        assertEquals("SA", enriched.getAwayTeam());
        assertEquals("GS Team", enriched.getHomeTeamName());
        assertEquals("SA Team", enriched.getAwayTeamName());
        assertEquals("Test Arena", enriched.getVenue());
    }

    @Test
    @DisplayName("Score differential computed correctly")
    void scoreDifferentialComputed() {
        String gameId = "G3";
        scoreboardInput.pipeInput(gameId, scoreboard(gameId, "BOS", "LAL"));
        playsInput.pipeInput(gameId, play(gameId, 10, 2, "5:00", "jump_shot",
                "Score play", 55, 48, true, 2));

        EnrichedEvent enriched = enrichedOutput.readValue();
        assertEquals(7, enriched.getScoreDifferential()); // home - away = 55 - 48
    }

    @Test
    @DisplayName("Play without scoreboard still enriches (left join)")
    void leftJoinWorksWithoutScoreboard() {
        String gameId = "UNKNOWN_GAME";
        // No scoreboard snapshot published for this game
        playsInput.pipeInput(gameId, play(gameId, 1, 1, "12:00", "jump_ball",
                "Tip-off", 0, 0, false, 0));

        assertFalse(enrichedOutput.isEmpty());
        EnrichedEvent enriched = enrichedOutput.readValue();
        assertEquals(gameId, enriched.getGameId());
        assertNull(enriched.getHomeTeam());  // no scoreboard data
        assertNull(enriched.getVenue());
    }

    @Test
    @DisplayName("Game state aggregates from play events")
    void gameStateAggregates() {
        String gameId = "G4";
        scoreboardInput.pipeInput(gameId, scoreboard(gameId, "MIA", "NYK"));

        // Send 3 plays
        playsInput.pipeInput(gameId, play(gameId, 1, 1, "12:00", "jump_ball",
                "Tip-off", 0, 0, false, 0));
        playsInput.pipeInput(gameId, play(gameId, 5, 1, "11:30", "jump_shot",
                "Butler makes jumper", 2, 0, true, 2));
        playsInput.pipeInput(gameId, play(gameId, 8, 1, "11:15", "rebound_defensive",
                "Brunson rebounds", 2, 0, false, 0));

        // Read all 3 state updates (each play produces one)
        var records = gameStateOutput.readKeyValuesToList();
        assertEquals(3, records.size());

        // Final state should reflect the latest
        GameState latest = records.get(2).value;
        assertEquals(gameId, latest.getGameId());
        assertEquals(2, latest.getHomeScore());
        assertEquals(0, latest.getAwayScore());
        assertEquals(1, latest.getQuarter());
        assertEquals("11:15", latest.getClock());
        assertEquals(3, latest.getPlayCount());
        assertEquals(1, latest.getScoringPlayCount());
        assertEquals("Brunson rebounds", latest.getLastPlayDescription());
        assertEquals("rebound_defensive", latest.getLastPlayType());
        assertEquals("LIVE", latest.getStatus());
    }

    @Test
    @DisplayName("Game state sets team info from first enriched event")
    void gameStateGetsTeamInfo() {
        String gameId = "G5";
        scoreboardInput.pipeInput(gameId, scoreboard(gameId, "DEN", "LAC"));
        playsInput.pipeInput(gameId, play(gameId, 1, 1, "12:00", "jump_ball",
                "Tip-off", 0, 0, false, 0));

        GameState state = gameStateOutput.readValue();
        assertEquals("DEN", state.getHomeTeam());
        assertEquals("LAC", state.getAwayTeam());
        assertEquals("DEN Team", state.getHomeTeamName());
        assertEquals("LAC Team", state.getAwayTeamName());
        assertEquals("Test Arena", state.getVenue());
    }

    @Test
    @DisplayName("Game state derives HALFTIME from period_end Q2")
    void halftimeStatus() {
        String gameId = "G6";
        scoreboardInput.pipeInput(gameId, scoreboard(gameId, "BOS", "LAL"));
        playsInput.pipeInput(gameId, play(gameId, 200, 2, "0:00", "period_end",
                "End of 2nd Quarter", 55, 48, false, 0));

        GameState state = gameStateOutput.readValue();
        assertEquals("HALFTIME", state.getStatus());
    }

    @Test
    @DisplayName("Game state derives FINAL from game_end")
    void finalStatus() {
        String gameId = "G7";
        scoreboardInput.pipeInput(gameId, scoreboard(gameId, "BOS", "LAL"));
        playsInput.pipeInput(gameId, play(gameId, 500, 4, "0:00", "game_end",
                "End of Game", 110, 102, false, 0));

        GameState state = gameStateOutput.readValue();
        assertEquals("FINAL", state.getStatus());
        assertEquals(110, state.getHomeScore());
        assertEquals(102, state.getAwayScore());
    }

    @Test
    @DisplayName("Duplicate sequence numbers are skipped in aggregation")
    void duplicateEventsSkipped() {
        String gameId = "G8";
        scoreboardInput.pipeInput(gameId, scoreboard(gameId, "BOS", "LAL"));

        playsInput.pipeInput(gameId, play(gameId, 10, 1, "10:00", "jump_shot",
                "First play", 2, 0, true, 2));
        // Duplicate
        playsInput.pipeInput(gameId, play(gameId, 10, 1, "10:00", "jump_shot",
                "Duplicate!", 2, 0, true, 2));
        // Real next play
        playsInput.pipeInput(gameId, play(gameId, 15, 1, "9:45", "rebound_defensive",
                "Rebound", 2, 0, false, 0));

        var records = gameStateOutput.readKeyValuesToList();
        // 3 outputs (each input produces one), but play_count should be 2 (dup skipped)
        GameState latest = records.get(records.size() - 1).value;
        assertEquals(2, latest.getPlayCount()); // not 3
        assertEquals(15, latest.getLastPlaySequence());
    }

    @Test
    @DisplayName("Multiple games tracked independently")
    void multipleGamesIndependent() {
        scoreboardInput.pipeInput("A", scoreboard("A", "BOS", "LAL"));
        scoreboardInput.pipeInput("B", scoreboard("B", "GS", "SA"));

        playsInput.pipeInput("A", play("A", 1, 1, "12:00", "jump_ball", "Game A tip", 0, 0, false, 0));
        playsInput.pipeInput("B", play("B", 1, 1, "12:00", "jump_ball", "Game B tip", 0, 0, false, 0));
        playsInput.pipeInput("A", play("A", 5, 1, "11:30", "jump_shot", "Game A score", 3, 0, true, 3));

        // Both should appear in enriched output
        var enriched = enrichedOutput.readKeyValuesToList();
        assertEquals(3, enriched.size());

        // Game state outputs — 3 total (2 for A, 1 for B)
        var states = gameStateOutput.readKeyValuesToMap();
        // Map collapses to latest per key
        assertEquals(2, states.size()); // "A" and "B"
        assertEquals(3, states.get("A").getHomeScore());
        assertEquals(0, states.get("B").getHomeScore());
    }
}
