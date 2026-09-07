require('dotenv').config({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env' });
const http = require('http');
const app = require('./app');
const { initSocket } = require('./sockets/socket.manager');
const { startDueDateReminderJob } = require('./jobs/dueDateReminders.job');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

initSocket(server);
startDueDateReminderJob();

server.listen(PORT, () => {
  console.log(`TaskFlow Backend running on port ${PORT}`);
});