const { Telegraf } = require('telegraf');
const { PrismaClient } = require('@prisma/client');
const dayjs = require('dayjs');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const prisma = new PrismaClient();

async function findOrCreateUser(username) {
  if (!username) throw new Error('Người dùng chưa đặt username Telegram');

  let user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    user = await prisma.user.create({ data: { username } });
  }
  return user;
}

bot.start((ctx) => {
  ctx.reply('👋 Chào bạn! Gửi /thu hoặc /chi để ghi dòng tiền.');
});

bot.command('thu', async (ctx) => {
  const username = ctx.from.username;
  const amount = parseFloat(ctx.message.text.replace('/thu', '').trim());
  if (!username) return ctx.reply('⚠️ Bạn cần có username Telegram.');
  if (isNaN(amount)) return ctx.reply('Sai định dạng: /thu 100000');

  const user = await findOrCreateUser(username);
  await prisma.transaction.create({ data: { type: 'income', amount, userId: user.id } });

  ctx.reply(`✅ Ghi thu: ${amount.toLocaleString()} VND`);
});

bot.command('chi', async (ctx) => {
  const username = ctx.from.username;
  const amount = parseFloat(ctx.message.text.replace('/chi', '').trim());
  if (!username) return ctx.reply('⚠️ Bạn cần có username Telegram.');
  if (isNaN(amount)) return ctx.reply('Sai định dạng: /chi 50000');

  const user = await findOrCreateUser(username);
  await prisma.transaction.create({ data: { type: 'expense', amount, userId: user.id } });

  ctx.reply(`❌ Ghi chi: ${amount.toLocaleString()} VND`);
});

bot.command('thongke', async (ctx) => {
  const username = ctx.from.username;
  if (!username) return ctx.reply('⚠️ Bạn cần có username Telegram.');

  const input = ctx.message.text.replace('/thongke', '').trim();
  const month = input || dayjs().format('YYYY-MM');
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return ctx.reply('Dùng đúng: /thongke 2025-04');
  }

  const start = new Date(`${month}-01`);
  const end = new Date(dayjs(start).add(1, 'month').format('YYYY-MM-DD'));
  const user = await findOrCreateUser(username);

  const [income, expense] = await Promise.all([
    prisma.transaction.aggregate({ _sum: { amount: true }, where: { type: 'income', userId: user.id, date: { gte: start, lt: end } } }),
    prisma.transaction.aggregate({ _sum: { amount: true }, where: { type: 'expense', userId: user.id, date: { gte: start, lt: end } } }),
  ]);

  const totalIncome = income._sum.amount || 0;
  const totalExpense = expense._sum.amount || 0;

  ctx.reply(`📊 Thống kê tháng ${month}:
- Thu: ${totalIncome.toLocaleString()} VND
- Chi: ${totalExpense.toLocaleString()} VND
- Số dư: ${(totalIncome - totalExpense).toLocaleString()} VND`);
});

module.exports = bot;
