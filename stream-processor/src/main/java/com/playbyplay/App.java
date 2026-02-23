package com.playbyplay;

import com.playbyplay.serdes.DlqDeserializationHandler;
import com.playbyplay.topology.GameEventTopology;
import org.apache.kafka.streams.KafkaStreams;
import org.apache.kafka.streams.StreamsConfig;
import org.apache.kafka.streams.Topology;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Properties;

/**
 * Main entrypoint for the Play-by-Play stream processor.
 *
 * Builds a Kafka Streams topology that reads raw play-by-play events,
 * enriches them with team metadata, aggregates game state, and writes
 * results to downstream topics.
 */
public class App {

    private static final Logger log = LoggerFactory.getLogger(App.class);

    public static void main(String[] args) {
        String schemaRegistryUrl = System.getenv("SCHEMA_REGISTRY_URL");
        if (schemaRegistryUrl == null || schemaRegistryUrl.isBlank()) {
            schemaRegistryUrl = "http://localhost:8081";
        }

        Properties props = buildConfig();
        Topology topology = GameEventTopology.build(schemaRegistryUrl);

        log.info("Starting Play-by-Play stream processor");
        log.info("Topology:\n{}", topology.describe());

        KafkaStreams streams = new KafkaStreams(topology, props);

        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            log.info("Shutting down stream processor");
            streams.close();
        }));

        streams.setUncaughtExceptionHandler((thread, exception) -> {
            log.error("Uncaught exception in stream thread {}", thread.getName(), exception);
            streams.close();
        });

        streams.start();
    }

    static Properties buildConfig() {
        Properties props = new Properties();

        String bootstrapServers = System.getenv("KAFKA_BOOTSTRAP_SERVERS");
        if (bootstrapServers == null || bootstrapServers.isBlank()) {
            bootstrapServers = "localhost:9092";
        }

        props.put(StreamsConfig.APPLICATION_ID_CONFIG, "playbyplay-stream-processor");
        props.put(StreamsConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);

        // Exactly-once processing semantics
        props.put(StreamsConfig.PROCESSING_GUARANTEE_CONFIG, StreamsConfig.EXACTLY_ONCE_V2);

        // Commit interval — low latency for live sports
        props.put(StreamsConfig.COMMIT_INTERVAL_MS_CONFIG, 100);

        // Route deserialization failures to DLQ topics instead of crashing
        props.put(
                StreamsConfig.DEFAULT_DESERIALIZATION_EXCEPTION_HANDLER_CLASS_CONFIG,
                DlqDeserializationHandler.class
        );

        return props;
    }
}
