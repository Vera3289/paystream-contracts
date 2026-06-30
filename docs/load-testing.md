# Load Testing Guide

This guide captures realistic load testing scenarios for the PayStream API using k6.

## Scenarios
- User registration load test
- Stream creation load test
- Withdrawal processing load test
- Concurrent usage patterns
- Peak load scenarios

## Suggested k6 script
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 20 },
    { duration: '3m', target: 50 },
    { duration: '1m', target: 0 },
  ],
};

export default function () {
  const res = http.get('http://127.0.0.1:3000/health');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
```

## Analysis and bottleneck identification
- Review latency, error rate, and throughput trends.
- Correlate spikes with CPU, memory, and database saturation.
- Tune rate-limiting, pooling, and caching where bottlenecks are observed.
