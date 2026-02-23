package com.playbyplay.topology;

import com.playbyplay.enrichment.GameStateBuilder;
import com.playbyplay.enrichment.TeamEnricher;
import com.playbyplay.models.EnrichedEvent;
import com.playbyplay.models.GameEvent;
import com.playbyplay.models.GameState;
import com.playbyplay.models.ScoreboardSnapshot;
import com.playbyplay.serdes.JsonSerde;
import org.apache.kafka.common.serialization.Serdes;
import org.apache.kafka.common.utils.Bytes;
import org.apache.kafka.streams.StreamsBuilder;
import org.apache.kafka.streams.Topology;
import org.apache.kafka.streams.kstream.*;
import org.apache.kafka.streams.state.KeyValueStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Defines the Kafka Streams topology for processing play-by-play events.
 *
 * <pre>
 *   raw.scoreboard ─── GlobalKTable (team metadata lookup)
 *                              │
 *   raw.plays ─── KStream ── leftJoin ── TeamEnricher ──► enriched.plays
 *                                              │
 *                                        groupByKey
 *                                              │
 *                                     GameStateBuilder ──► game.state
 * </pre>
 *
 * <p>The scoreboard GlobalKTable provides team display names, venue, and
 * abbreviations. Plays are enriched via a left join (so plays still flow
 * even if no scoreboard snapshot exists yet for a game). Enriched events
 * are then aggregated into per-game state with score, quarter, clock,
 * play count, and derived game status.</p>
 */
public class GameEventTopology {

    private static final Logger log = LoggerFactory.getLogger(GameEventTopology.class);

    // Input topics
    public static final String PLAYS_TOPIC = "raw.plays";
    public static final String SCOREBOARD_TOPIC = "raw.scoreboard";

    // Output topics
    public static final String ENRICHED_TOPIC = "enriched.plays";
    public static final String GAME_STATE_TOPIC = "game.state";

    // State store names
    public static final String GAME_STATE_STORE = "game-state-store";
    public static final String SCOREBOARD_STORE = "scoreboard-store";

    private GameEventTopology() {}

    /**
     * Builds and returns the stream processing topology.
     */
    public static Topology build() {
        StreamsBuilder builder = new StreamsBuilder();

        // Serdes
        var stringSerde = Serdes.String();
        var gameEventSerde = JsonSerde.of(GameEvent.class);
        var scoreboardSerde = JsonSerde.of(ScoreboardSnapshot.class);
        var enrichedEventSerde = JsonSerde.of(EnrichedEvent.class);
        var gameStateSerde = JsonSerde.of(GameState.class);

        // ── 1. Scoreboard GlobalKTable (team metadata registry) ──────────
        //
        // Every scoreboard poll produces snapshots keyed by game_id.
        // The GlobalKTable keeps the latest snapshot per game, available
        // on all stream processor instances for join lookups.
        GlobalKTable<String, ScoreboardSnapshot> scoreboardTable = builder.globalTable(
                SCOREBOARD_TOPIC,
                Consumed.with(stringSerde, scoreboardSerde),
                Materialized.<String, ScoreboardSnapshot, KeyValueStore<Bytes, byte[]>>as(SCOREBOARD_STORE)
                        .withKeySerde(stringSerde)
                        .withValueSerde(scoreboardSerde)
        );

        // ── 2. Raw play-by-play events ──────────────────────────────────
        KStream<String, GameEvent> rawPlays = builder.stream(
                PLAYS_TOPIC,
                Consumed.with(stringSerde, gameEventSerde)
        );

        // ── 3. Enrich plays with team metadata via left join ────────────
        //
        // Key mapper: both stream and table are keyed by game_id, so the
        // mapper extracts the stream record key directly.
        // Left join ensures plays flow even before the first scoreboard poll.
        KStream<String, EnrichedEvent> enrichedPlays = rawPlays.leftJoin(
                scoreboardTable,
                (key, play) -> key,     // map stream key → GlobalKTable key
                new TeamEnricher()
        );

        // ── 4. Write enriched events to output topic ────────────────────
        enrichedPlays.to(
                ENRICHED_TOPIC,
                Produced.with(stringSerde, enrichedEventSerde)
        );

        // ── 5. Aggregate enriched events into per-game state ────────────
        //
        // Enriched events carry team names from the scoreboard join, so the
        // aggregated GameState gets team info on the first event.
        KTable<String, GameState> gameState = enrichedPlays
                .groupByKey(Grouped.with(stringSerde, enrichedEventSerde))
                .aggregate(
                        GameState::new,
                        new GameStateBuilder(),
                        Materialized.<String, GameState, KeyValueStore<Bytes, byte[]>>as(GAME_STATE_STORE)
                                .withKeySerde(stringSerde)
                                .withValueSerde(gameStateSerde)
                );

        // ── 6. Write game state changelog to output topic ───────────────
        gameState.toStream().to(
                GAME_STATE_TOPIC,
                Produced.with(stringSerde, gameStateSerde)
        );

        Topology topology = builder.build();
        log.info("Built topology: [{}, {}] → [{}, {}]",
                PLAYS_TOPIC, SCOREBOARD_TOPIC, ENRICHED_TOPIC, GAME_STATE_TOPIC);

        return topology;
    }
}
