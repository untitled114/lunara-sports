package com.playbyplay.serdes;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.apache.kafka.common.serialization.Deserializer;
import org.apache.kafka.common.serialization.Serde;
import org.apache.kafka.common.serialization.Serializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Generic JSON Serde backed by Jackson ObjectMapper.
 *
 * Usage:
 *   Serde<GameEvent> serde = JsonSerde.of(GameEvent.class);
 */
public class JsonSerde<T> implements Serde<T> {

    private static final Logger log = LoggerFactory.getLogger(JsonSerde.class);

    private static final ObjectMapper MAPPER = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private final JsonSerializer<T> serializer;
    private final JsonDeserializer<T> deserializer;

    public JsonSerde(Class<T> clazz) {
        this.serializer = new JsonSerializer<>();
        this.deserializer = new JsonDeserializer<>(clazz);
    }

    /**
     * Factory method for creating a typed JsonSerde.
     */
    public static <T> Serde<T> of(Class<T> clazz) {
        return new JsonSerde<>(clazz);
    }

    @Override
    public Serializer<T> serializer() {
        return serializer;
    }

    @Override
    public Deserializer<T> deserializer() {
        return deserializer;
    }

    // --- Inner Serializer ---

    static class JsonSerializer<T> implements Serializer<T> {

        @Override
        public byte[] serialize(String topic, T data) {
            if (data == null) {
                return null;
            }
            try {
                return MAPPER.writeValueAsBytes(data);
            } catch (Exception e) {
                log.error("Failed to serialize value for topic {}: {}", topic, e.getMessage(), e);
                throw new RuntimeException("JSON serialization failed", e);
            }
        }
    }

    // --- Inner Deserializer ---

    static class JsonDeserializer<T> implements Deserializer<T> {

        private final Class<T> clazz;

        JsonDeserializer(Class<T> clazz) {
            this.clazz = clazz;
        }

        @Override
        public T deserialize(String topic, byte[] data) {
            if (data == null || data.length == 0) {
                return null;
            }
            try {
                return MAPPER.readValue(data, clazz);
            } catch (Exception e) {
                log.error("Failed to deserialize value from topic {}: {}", topic, e.getMessage(), e);
                throw new RuntimeException("JSON deserialization failed", e);
            }
        }
    }
}
