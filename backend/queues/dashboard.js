const express = require('express');
const { setQueues, BullMQAdapter } = require('@bull-board/api');
const { ExpressAdapter } = require('@bull-board/express');
const { streamQueue, dlqQueue } = require('./queue');

const port = process.env.BULL_DASHBOARD_PORT || 7357;
const app = express();

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

setQueues([
  new BullMQAdapter(streamQueue),
  new BullMQAdapter(dlqQueue),
]);

app.use('/admin/queues', serverAdapter.getRouter());

app.listen(port, () => {
  console.log(`Bull Board running at http://localhost:${port}/admin/queues`);
});
