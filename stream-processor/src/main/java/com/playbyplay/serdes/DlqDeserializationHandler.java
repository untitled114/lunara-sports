package com.playbyplay.serdes;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.serialization.ByteArraySerializer;
import org.apache.kafka.streams.errors.DeserializationExceptionHandler;
import org.apache.kafka.streams.processor.ProcessorContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;
import java.util.Properties;

/**
 * Routes records that fail deserialization to a dead-letter-queue topic
 * ({@code dlq.<original-topic>}) and tells Kafka Streams to continue
 * processing the remaining records.
 */
public class DlqDeserializationHandler implements DeserializationExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(DlqDeserializationHandler.class);

    private KafkaProducer<byte[], byte[]> dlqProducer;

    @Override
    public void configure(Map<String, ?> configs) {
        Properties props = new Properties();
        Object servers = configs.get("bootstrap.servers");
        if (servers == null) {
            servers = "localhost:9092";
        }
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, servers.toString());
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, ByteArraySerializer.class.getName());
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, ByteArraySerializer.class.getName());
        dlqProducer = new KafkaProducer<>(props);
    }

    @Override
    public DeserializationHandlerResponse handle(
            ProcessorContext context,
            ConsumerRecord<byte[], byte[]> record,
            Exception exception) {

        String dlqTopic = "dlq." + record.topic();
        log.error("Deserialization failed for topic={}, partition={}, offset={}. Routing to {}",
                record.topic(), record.partition(), record.offset(), dlqTopic, exception);

        try {
            dlqProducer.send(new ProducerRecord<>(dlqTopic, record.key(), record.value()));
        } catch (Exception e) {
            log.error("Failed to send record to DLQ topic {}", dlqTopic, e);
        }

        return DeserializationHandlerResponse.CONTINUE;
    }
}
