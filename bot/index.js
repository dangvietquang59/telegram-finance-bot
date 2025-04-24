const { Telegraf } = require('telegraf');
const { PrismaClient } = require('@prisma/client');
const dayjs = require('dayjs');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const prisma = new PrismaClient();

// Helper function to find or create user
async function findOrCreateUser(username) {
  if (!username) throw new Error('User has no Telegram username');

  let user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    user = await prisma.user.create({ data: { username, balance: 0 } });
  }
  return user;
}

// Helper function to find or create tags
async function findOrCreateTags(tagNames) {
  if (!tagNames || tagNames.length === 0) return [];
  
  const tags = await Promise.all(
    tagNames.map(async (name) => {
      let tag = await prisma.tag.findUnique({ where: { name } });
      if (!tag) {
        tag = await prisma.tag.create({ data: { name } });
      }
      return tag;
    })
  );
  return tags;
}

// Helper function to update user balance
async function updateUserBalance(userId, amount, type) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const newBalance = type === 'income' 
    ? user.balance + amount 
    : user.balance - amount;
  
  await prisma.user.update({
    where: { id: userId },
    data: { balance: newBalance }
  });
}

// Start command
bot.start((ctx) => {
  ctx.reply(`👋 Chào mừng! Đây là các lệnh có sẵn:
/help - Xem tất cả lệnh
/balance - Xem số dư hiện tại
/income [số tiền] [tag1,tag2,...] - Ghi thu nhập
/expense [số tiền] [tag1,tag2,...] - Ghi chi tiêu
/tags - Xem danh sách tag
/addtag [tên] - Thêm tag mới
/stats [tháng] - Thống kê theo tháng
/stats [ngày bắt đầu] [ngày kết thúc] - Thống kê theo khoảng thời gian
/stats_tag [tháng] - Thống kê theo tag`);
});

// Help command
bot.command('help', (ctx) => {
  ctx.reply(`Các lệnh có sẵn:
/help - Xem tất cả lệnh
/balance - Xem số dư hiện tại
/income [số tiền] [tag1,tag2,...] - Ghi thu nhập
/expense [số tiền] [tag1,tag2,...] - Ghi chi tiêu
/tags - Xem danh sách tag
/addtag [tên] - Thêm tag mới
/stats [tháng] - Thống kê theo tháng
/stats [ngày bắt đầu] [ngày kết thúc] - Thống kê theo khoảng thời gian
/stats_tag [tháng] - Thống kê theo tag`);
});

// Balance command
bot.command('balance', async (ctx) => {
  const username = ctx.from.username;
  if (!username) return ctx.reply('⚠️ Vui lòng đặt username Telegram trước.');

  const user = await findOrCreateUser(username);
  ctx.reply(`💰 Số dư hiện tại: ${user.balance.toLocaleString()} VND`);
});

// Income command
bot.command('income', async (ctx) => {
  const username = ctx.from.username;
  if (!username) return ctx.reply('⚠️ Vui lòng đặt username Telegram trước.');

  const parts = ctx.message.text.split(' ');
  if (parts.length < 2) return ctx.reply('Cách dùng: /income [số tiền] [tag1,tag2,...]');

  const amount = parseFloat(parts[1]);
  if (isNaN(amount)) return ctx.reply('Số tiền không hợp lệ');

  const tagNames = parts[2] ? parts[2].split(',') : [];
  const user = await findOrCreateUser(username);
  const tags = await findOrCreateTags(tagNames);

  const transaction = await prisma.transaction.create({
    data: {
      type: 'income',
      amount,
      userId: user.id,
      tags: {
        create: tags.map(tag => ({ tagId: tag.id }))
      }
    }
  });

  await updateUserBalance(user.id, amount, 'income');

  const tagList = tags.length > 0 ? `\nTag: ${tags.map(t => t.name).join(', ')}` : '';
  ctx.reply(`✅ Đã ghi thu nhập: ${amount.toLocaleString()} VND${tagList}`);
});

// Expense command
bot.command('expense', async (ctx) => {
  const username = ctx.from.username;
  if (!username) return ctx.reply('⚠️ Vui lòng đặt username Telegram trước.');

  const parts = ctx.message.text.split(' ');
  if (parts.length < 2) return ctx.reply('Cách dùng: /expense [số tiền] [tag1,tag2,...]');

  const amount = parseFloat(parts[1]);
  if (isNaN(amount)) return ctx.reply('Số tiền không hợp lệ');

  const tagNames = parts[2] ? parts[2].split(',') : [];
  const user = await findOrCreateUser(username);
  const tags = await findOrCreateTags(tagNames);

  const transaction = await prisma.transaction.create({
    data: {
      type: 'expense',
      amount,
      userId: user.id,
      tags: {
        create: tags.map(tag => ({ tagId: tag.id }))
      }
    }
  });

  await updateUserBalance(user.id, amount, 'expense');

  const tagList = tags.length > 0 ? `\nTag: ${tags.map(t => t.name).join(', ')}` : '';
  ctx.reply(`❌ Đã ghi chi tiêu: ${amount.toLocaleString()} VND${tagList}`);
});

// Tags command
bot.command('tags', async (ctx) => {
  const tags = await prisma.tag.findMany({
    orderBy: { name: 'asc' }
  });

  if (tags.length === 0) {
    return ctx.reply('Chưa có tag nào. Dùng /addtag để tạo tag mới.');
  }

  const tagList = tags.map(tag => `- ${tag.name}`).join('\n');
  ctx.reply(`Danh sách tag:\n${tagList}`);
});

// Add tag command
bot.command('addtag', async (ctx) => {
  const name = ctx.message.text.replace('/addtag', '').trim();
  if (!name) return ctx.reply('Cách dùng: /addtag [tên]');

  try {
    const tag = await prisma.tag.create({ data: { name } });
    ctx.reply(`✅ Đã tạo tag "${tag.name}" thành công`);
  } catch (error) {
    if (error.code === 'P2002') {
      ctx.reply('❌ Tag đã tồn tại');
    } else {
      ctx.reply('❌ Lỗi khi tạo tag');
    }
  }
});

// Stats command
bot.command('stats', async (ctx) => {
  const username = ctx.from.username;
  if (!username) return ctx.reply('⚠️ Vui lòng đặt username Telegram trước.');

  const input = ctx.message.text.replace('/stats', '').trim();
  let start, end;

  if (input) {
    const parts = input.split(' ');
    if (parts.length === 1) {
      // Monthly stats
      const month = parts[0];
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return ctx.reply('Định dạng tháng không hợp lệ. Dùng: /stats YYYY-MM');
      }
      start = new Date(`${month}-01`);
      end = new Date(dayjs(start).add(1, 'month').format('YYYY-MM-DD'));
    } else if (parts.length === 2) {
      // Date range stats
      start = new Date(parts[0]);
      end = new Date(parts[1]);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return ctx.reply('Định dạng ngày không hợp lệ. Dùng: /stats YYYY-MM-DD YYYY-MM-DD');
      }
    } else {
      return ctx.reply('Cách dùng: /stats [tháng] hoặc /stats [ngày bắt đầu] [ngày kết thúc]');
    }
  } else {
    // Current month stats
    start = new Date(dayjs().startOf('month').format('YYYY-MM-DD'));
    end = new Date(dayjs().endOf('month').format('YYYY-MM-DD'));
  }

  const user = await findOrCreateUser(username);

  const [income, expense] = await Promise.all([
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        type: 'income',
        userId: user.id,
        date: { gte: start, lt: end }
      }
    }),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        type: 'expense',
        userId: user.id,
        date: { gte: start, lt: end }
      }
    })
  ]);

  const totalIncome = income._sum.amount || 0;
  const totalExpense = expense._sum.amount || 0;

  ctx.reply(`📊 Thống kê từ ${dayjs(start).format('DD/MM/YYYY')} đến ${dayjs(end).format('DD/MM/YYYY')}:
- Thu nhập: ${totalIncome.toLocaleString()} VND
- Chi tiêu: ${totalExpense.toLocaleString()} VND
- Số dư: ${(totalIncome - totalExpense).toLocaleString()} VND`);
});

// Stats by tag command
bot.command('stats_tag', async (ctx) => {
  const username = ctx.from.username;
  if (!username) return ctx.reply('⚠️ Vui lòng đặt username Telegram trước.');

  const input = ctx.message.text.replace('/stats_tag', '').trim();
  let start, end;

  if (input) {
    const parts = input.split(' ');
    if (parts.length === 1) {
      // Monthly stats
      const month = parts[0];
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return ctx.reply('Định dạng tháng không hợp lệ. Dùng: /stats_tag YYYY-MM');
      }
      start = new Date(`${month}-01`);
      end = new Date(dayjs(start).add(1, 'month').format('YYYY-MM-DD'));
    } else if (parts.length === 2) {
      // Date range stats
      start = new Date(parts[0]);
      end = new Date(parts[1]);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return ctx.reply('Định dạng ngày không hợp lệ. Dùng: /stats_tag YYYY-MM-DD YYYY-MM-DD');
      }
    } else {
      return ctx.reply('Cách dùng: /stats_tag [tháng] hoặc /stats_tag [ngày bắt đầu] [ngày kết thúc]');
    }
  } else {
    // Current month stats
    start = new Date(dayjs().startOf('month').format('YYYY-MM-DD'));
    end = new Date(dayjs().endOf('month').format('YYYY-MM-DD'));
  }

  const user = await findOrCreateUser(username);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: user.id,
      date: { gte: start, lt: end }
    },
    include: {
      tags: {
        include: {
          tag: true
        }
      }
    }
  });

  const tagStats = {};
  transactions.forEach(transaction => {
    transaction.tags.forEach(tag => {
      const tagName = tag.tag.name;
      if (!tagStats[tagName]) {
        tagStats[tagName] = { income: 0, expense: 0 };
      }
      if (transaction.type === 'income') {
        tagStats[tagName].income += transaction.amount;
      } else {
        tagStats[tagName].expense += transaction.amount;
      }
    });
  });

  if (Object.keys(tagStats).length === 0) {
    return ctx.reply('Không tìm thấy giao dịch nào có tag trong khoảng thời gian này.');
  }

  const statsText = Object.entries(tagStats)
    .map(([tag, stats]) => {
      const net = stats.income - stats.expense;
      return `\n#${tag}:
- Thu nhập: ${stats.income.toLocaleString()} VND
- Chi tiêu: ${stats.expense.toLocaleString()} VND
- Số dư: ${net.toLocaleString()} VND`;
    })
    .join('\n');

  ctx.reply(`📊 Thống kê theo tag từ ${dayjs(start).format('DD/MM/YYYY')} đến ${dayjs(end).format('DD/MM/YYYY')}:${statsText}`);
});

// Set up webhook
bot.telegram.setWebhook(`https://${process.env.WEBHOOK_URL}/bot${process.env.BOT_TOKEN}`);
bot.startWebhook('/bot' + process.env.BOT_TOKEN, null, process.env.PORT || 3000);

module.exports = bot;
