
import { config } from './config.js';
import { getSymbols, getMarketData } from './binance.js';
import { scanBasis } from './basisScanner.js';
import { sendToTelegram } from './telegram.js';

const HOUR_MS = 60 * 60 * 1000;

const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

const time = date =>
  date.toLocaleString('vi-VN', {
    timeZone: config.timezone,
    hour12: false
  });

let running = true;

process.on('SIGINT', () => {
  running = false;
});

process.on('SIGTERM', () => {
  running = false;
});

// Chờ đến đầu giờ tiếp theo
// function getNextScanTime() {
//   const now = Date.now();

//   return (
//     Math.floor(now / HOUR_MS) + 1
//   ) * HOUR_MS;
// }

function getNextScanTime() {
  const now = Date.now();

  const HOUR_MS = 60 * 60 * 1000;
  const OFFSET_MS = 2 * 60 * 1000;

  const nextScan =
    Math.floor(now / HOUR_MS) * HOUR_MS +
    OFFSET_MS;

  return nextScan > now
    ? nextScan
    : nextScan + HOUR_MS;
}




// Nghỉ từng đoạn ngắn để có thể dừng bot
async function waitUntil(targetTime) {
  while (running) {
    const remaining = targetTime - Date.now();

    if (remaining <= 0) break;

    await sleep(Math.min(remaining, 1000));
  }
}

async function scanMarket() {
  const started = Date.now();

  console.log(
    `\n[${time(new Date())}] 🔍 Bắt đầu quét Binance Futures`
  );

  const symbols = await getSymbols();

  console.log(
    `📊 Tổng hợp đồng hợp lệ: ${symbols.length}`
  );

  const marketData = await getMarketData();

  const results = scanBasis(symbols, marketData);

  const positive = results.filter(
    item => item.side === 'POSITIVE'
  );

  const negative = results.filter(
    item => item.side === 'NEGATIVE'
  );

  console.log(
    `🟢 Basis > +${config.positiveThreshold}%: ${positive.length} coin`
  );

  console.log(
    `🔴 Basis < ${config.negativeThreshold}%: ${negative.length} coin`
  );

  let sent = 0;
  let errors = 0;

  for (const item of results) {
    if (!running) break;

    try {
      await sendToTelegram(item);
      sent++;
    } catch (error) {
      errors++;

      console.error(
        `❌ Telegram ${item.symbol}: ` +
        (error.response?.data?.description || error.message)
      );
    }

    // Tránh gửi Telegram quá dồn dập
    if (running) {
      await sleep(200);
    }
  }

  const elapsed = (Date.now() - started) / 1000;

  console.log(
    `✅ Hoàn tất: ${symbols.length} coin | ` +
    `Đạt điều kiện: ${results.length} | ` +
    `Đã gửi: ${sent} | Lỗi: ${errors}`
  );

  console.log(
    `⏱️ Thời gian xử lý: ${elapsed.toFixed(2)} giây`
  );
}

async function main() {
  console.log('🚀 BINANCE FUTURES BASIS SCANNER V1');
  console.log(`🟢 Positive > +${config.positiveThreshold}%`);
  console.log(`🔴 Negative < ${config.negativeThreshold}%`);
  console.log('⏱️ Lịch quét: Đầu mỗi giờ');
  console.log(`🌏 Timezone: ${config.timezone}`);
  console.log(`🆔 PID: ${process.pid}`);

  while (running) {
    const nextScan = getNextScanTime();

    console.log(
      `\n⏳ Next scan: ${time(new Date(nextScan))}`
    );

    await waitUntil(nextScan);

    if (!running) break;

    try {
      await scanMarket();
    } catch (error) {
      console.error(
        `❌ Scan error: ${error.message}`
      );

      const status = error.response?.status;

      if (status === 451) {
        console.error(
          '⛔ Binance chặn truy cập từ IP hiện tại.'
        );
        break;
      }

      if (status === 429 || status === 418) {
        console.error(
          '⚠️ Binance đang giới hạn API.'
        );
      }
    }
  }

  console.log('🛑 Scanner stopped.');
}

// Chỉ gọi main() đúng một lần
main().catch(error => {
  console.error('FATAL:', error);
  process.exitCode = 1;
});

