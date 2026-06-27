const { createAuthRateLimiter, resetAuthRateLimitState, applyAuthFailure } = require('./authRateLimiter');

function createMockResponse() {
  return {
    statusCode: 200,
    status(status) {
      this.statusCode = status;
      return this;
    },
    json(payload) {
      return payload;
    },
    send(payload) {
      return payload;
    },
  };
}

describe('auth rate limiter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetAuthRateLimitState();
  });

  afterEach(() => {
    jest.useRealTimers();
    resetAuthRateLimitState();
  });

  it('locks an address after repeated failures', () => {
    const limiter = createAuthRateLimiter({ maxAttempts: 2, lockoutMs: 1000, baseDelayMs: 0 });
    const req = { ip: '203.0.113.10', body: { address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' } };
    const res = createMockResponse();
    const next = jest.fn();

    limiter(req, res, next);
    applyAuthFailure(req);
    applyAuthFailure(req);

    const secondResponse = createMockResponse();
    limiter(req, secondResponse, next);

    expect(next).toHaveBeenCalled();
    expect(secondResponse.statusCode).toBe(429);
  });

  it('blocks requests while the account is locked', () => {
    const limiter = createAuthRateLimiter({ maxAttempts: 1, lockoutMs: 1000, baseDelayMs: 0 });
    const req = { ip: '203.0.113.20', body: { address: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' } };
    const res = createMockResponse();
    const next = jest.fn();

    limiter(req, res, next);
    applyAuthFailure(req);

    const lockedResponse = createMockResponse();
    limiter(req, lockedResponse, next);

    expect(lockedResponse.statusCode).toBe(429);
  });
});
