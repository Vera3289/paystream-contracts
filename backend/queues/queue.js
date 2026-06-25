const { Queue, Worker, QueueScheduler } = require('bullmq');
const IORedis = require('ioredis');
const path = require('path');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const connection = new IORedis(redisUrl);

const streamQueueName = 'stream-operations';
const dlqName = `${streamQueueName}:dlq`;

const queueScheduler = new QueueScheduler(streamQueueName, { connection });
const streamQueue = new Queue(streamQueueName, { connection });
const dlqQueue = new Queue(dlqName, { connection });

const { processStreamJob } = require('./processors/streamProcessor');

// Worker with retry + exponential backoff logic
const worker = new Worker(
  streamQueueName,
  async job => {
    return processStreamJob(job);
  },
  {
    connection,
    // auto-retry handled per job options; fallback global concurrency
    concurrency: 5,
  }
);

worker.on('failed', async (job, err) => {
  console.error(`Job ${job.id} failed:`, err?.message || err);
  // move to DLQ after attempts exhausted
  if (job.attemptsMade >= (job.opts.attempts || 0)) {
    try {
      await dlqQueue.add(job.name || 'failed', { original: job.data, failedReason: err?.message }, { removeOnComplete: false });
    } catch (e) {
      console.error('Failed to enqueue to DLQ:', e.message || e);
    }
  }
});

worker.on('completed', job => {
  console.log(`Job ${job.id} completed`);
});

process.on('SIGINT', async () => {
  await worker.close();
  await queueScheduler.close();
  await streamQueue.close();
  await dlqQueue.close();
  connection.disconnect();
  process.exit(0);
});

// Helper to add jobs with exponential backoff and retries
async function addStreamJob(name, data, opts = {}) {
  const defaultOpts = {
    attempts: opts.attempts || 5,
    backoff: {
      type: 'exponential',
      delay: opts.delay || 1000,
    },
    removeOnComplete: { age: 3600 },
  };
  return streamQueue.add(name, data, Object.assign({}, defaultOpts, opts));
}

module.exports = {
  addStreamJob,
  streamQueue,
  dlqQueue,
};

if (require.main === module) {
  console.log('Queue worker started for', streamQueueName);
}
