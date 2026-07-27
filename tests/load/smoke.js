import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    health: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.RATE || 25),
      timeUnit: '1s',
      duration: __ENV.DURATION || '1m',
      preAllocatedVUs: 20,
      maxVUs: 100,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<300', 'p(99)<800'],
  },
};

const baseUrl = __ENV.API_URL || 'http://localhost:4000/api';

export default function () {
  const health = http.get(`${baseUrl}/health`);
  check(health, {
    'health is reachable': (response) => response.status === 200,
    'database is up': (response) => response.json('database') === 'up',
  });
  sleep(0.2);
}
