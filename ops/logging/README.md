# Logging infrastructure

This folder contains a minimal ELK-based deployment template for local development and experimentation.

## Components
- Elasticsearch: log storage
- Logstash: log processing
- Kibana: log viewing and search
- Container log drivers: forward application logs into the pipeline

## Retention and alerts
- Retain logs for 90 days in the configured storage layer.
- Configure index lifecycle management and alerting rules for error patterns.
