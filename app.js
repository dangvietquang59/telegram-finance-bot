const express = require('express');
const bot = require('./bot');
require('dotenv').config();

const app = express();

bot.launch(); // Khởi động bot
console.log('🤖 Bot Telegram đang chạy...');

app.get('/', (req, res) => res.send('Telegram Finance Bot OK!'));
app.listen(process.env.PORT, () => {
  console.log(`🌐 Server http://localhost:${process.env.PORT}`);
});
