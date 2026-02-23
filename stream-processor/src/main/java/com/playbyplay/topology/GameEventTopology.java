package com.playbyplay.topology;

import com.playbyplay.avro.EnrichedEvent;
import com.playbyplay.avro.GameState;
import com.playbyplay.avro.PlayEvent;
import com.playbyplay.avro.ScoreboardEvent;
import com.playbyplay.enrichment.GameStateBuilder;
import com.playbyplay.enrichment.TeamEnricher;
import io.confluent.kafka.streams.serdes.avro.SpecificAvroSerde;
import org.apache.avro.specific.SpecificRecord;
import org.apache.kafka.common.serialization.Serdes;
import org.apache.kafka.common.utils.Bytes;
import org.apache.kafka.streams.StreamsBuilder;
import org.apache.kafka.streams.Topology;
import org.apache.kafka.streams.kstream.*;
import org.apache.kafka.streams.state.KeyValueStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Collections;
import java.util.Map;

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
     * Creates a configured SpecificAvroSerde for the given type.
     */
    private static <T extends SpecificRecord> SpecificAvroSerde<T> avroSerde(
            String schemaRegistryUrl, boolean isKey) {
        SpecificAvroSerde<T> serde = new SpecificAvroSerde<>();
        Map<String, String> config = Collections.singletonMap(
                "schema.registry.url", schemaRegistryUrl);
        serde.configure(config, isKey);
        return serde;
    }

    /**
     * Builds and returns the stream processing topology.
     *
     * @param schemaRegistryUrl URL of the Confluent Schema Registry.
     */
    public static Topology build(String schemaRegistryUrl) {
        StreamsBuilder builder = new StreamsBuilder();

        // Serdes
        var stringSerde = Serdes.String();
        SpecificAvroSerde<PlayEvent> playEventSerde = avroSerde(schemaRegistryUrl, false);
        SpecificAvroSerde<ScoreboardEvent> scoreboardSerde = avroSerde(schemaRegistryUrl, false);
        SpecificAvroSerde<EnrichedEvent> enrichedEventSerde = avroSerde(schemaRegistryUrl, false);
        SpecificAvroSerde<GameState> gameStateSerde = avroSerde(schemaRegistryUrl, false);

        // ── 1. Scoreboard GlobalKTable (team metadata registry) ──────────
        GlobalKTable<String, ScoreboardEvent> scoreboardTable = builder.globalTable(
                SCOREBOARD_TOPIC,
                Consumed.with(stringSerde, scoreboardSerde),
                Materialized.<String, ScoreboardEvent, KeyValueStore<Bytes, byte[]>>as(SCOREBOARD_STORE)
                        .withKeySerde(stringSerde)
                        .withValueSerde(scoreboardSerde)
        );

        // ── 2. Raw play-by-play events ──────────────────────────────────
        KStream<String, PlayEvent> rawPlays = builder.stream(
                PLAYS_TOPIC,
                Consumed.with(stringSerde, playEventSerde)
        );

        // ── 3. Enrich plays with team metadata via left join ────────────
        KStream<String, EnrichedEvent> enrichedPlays = rawPlays.leftJoin(
                scoreboardTable,
                (key, play) -> key,
                new TeamEnricher()
        );

        // ── 4. Write enriched events to output topic ────────────────────
        enrichedPlays.to(
                ENRICHED_TOPIC,
                Produced.with(stringSerde, enrichedEventSerde)
        );

        // ── 5. Aggregate enriched events into per-game state ────────────
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

    /**
     * Backwards-compatible build with default Schema Registry URL.
     */
    public static Topology build() {
        return build("http://localhost:8081");
    }
}
