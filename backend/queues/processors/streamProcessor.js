async function processStreamJob(job) {
  // Minimal implementation: handle different stream-related job types
  const { name, data } = job;
  console.log(`Processing stream job ${job.id} (${name})`);

  try {
    switch (name) {
      case 'recalculate-balance':
        // Placeholder: integrate with existing services/db
        console.log('Recalculating balance for', data);
        break;
      case 'send-notification':
        console.log('Sending notification', data);
        break;
      case 'cleanup-stale':
        console.log('Cleaning up stale data', data);
        break;
      default:
        console.log('Unknown stream job type', name);
    }

    return { ok: true };
  } catch (err) {
    console.error('Processor error', err);
    throw err;
  }
}

module.exports = { processStreamJob };
