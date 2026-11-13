
import axios from "axios";
import { config } from "./config.js";
import { getExchangeInfo } from "./binance.js";
import { analyzeSymbol } from "./analyzer.js";

const telegram = axios.create({
  baseURL:
    `https://api.telegram.org/bot${config.telegramToken}`,
  timeout: 65000
});

let allowedSymbols = new Set();
let offset = 0;
let running = true;

const processingChats = new Set();

export async function loadSymbols() {
  const data = await getExchangeInfo();

  allowedSymbols = new Set(
    data.symbols
      .filter(item =>
        item.contractType === "PERPETUAL" &&
        item.status === "TRADING" &&
        item.quoteAsset === "USDT" &&
        item.marginAsset === "USDT"
      )
      .map(item => item.symbol)
  );

  console.log(
    `[BINANCE] Loaded ${allowedSymbols.size} symbols`
  );
}

function normalizeSymbol(text) {
  let symbol = text.trim().toUpperCase();

  if (symbol.startsWith("/SCAN")) {
    symbol = symbol
      .replace(/^\/SCAN(?:@\w+)?\s*/, "")
      .trim();
  }

  if (!/^[A-Z0-9]{2,25}$/.test(symbol)) {
    return null;
  }

  if (!symbol.endsWith("USDT")) {
    symbol += "USDT";
  }

  return symbol;
}

export async function sendMessage(chatId, text) {
  const MAX_LENGTH = 3900;

  for (
    let i = 0;
    i < text.length;
    i += MAX_LENGTH
  ) {
    const chunk = text.slice(
      i,
      i + MAX_LENGTH
    );

    await telegram.post("/sendMessage", {
      chat_id: chatId,
      text: chunk
    });
  }
}

async function handleMessage(message) {
  if (!message?.text) return;

  const chatId = String(message.chat.id);

  if (chatId !== config.telegramChatId) {
    return;
  }

  const text = message.text.trim();

  if (text === "/start" || text === "/help") {
    await sendMessage(
      chatId,
      [
        "📊 BINANCE FUTURES MARKET FLOW",
        "",
        "Gửi tên coin để phân tích.",
        "",
        "Ví dụ:",
        "BTC",
        "ETH",
        "SOL",
        "BTCUSDT",
        "/scan BTC",
        "",
        "Trades: 24 giờ gần nhất",
        "tính đến lúc gửi tin nhắn."
      ].join("\n")
    );

    return;
  }

  const symbol = normalizeSymbol(text);

  if (!symbol || !allowedSymbols.has(symbol)) {
    await sendMessage(
      chatId,
      "❌ Coin không hợp lệ hoặc không phải " +
      "USDT Perpetual đang giao dịch."
    );

    return;
  }

  if (processingChats.has(chatId)) {
    await sendMessage(
      chatId,
      "⏳ Bot đang xử lý yêu cầu trước đó."
    );

    return;
  }

  processingChats.add(chatId);

  try {
    // Telegram date là Unix timestamp (giây).
    // Chuyển sang milliseconds cho Binance.
    const requestTime = Number(message.date) * 1000;

    if (
      !Number.isFinite(requestTime) ||
      requestTime <= 0
    ) {
      throw new Error(
        "Không xác định được thời điểm gửi tin nhắn"
      );
    }

    await sendMessage(
      chatId,
      `🔍 Đang phân tích ${symbol}...\n` +
      "💹 Đang tải Aggregate Trades 24H.\n" +
      "Coin có nhiều giao dịch có thể mất khá lâu."
    );

    const report = await analyzeSymbol(
      symbol,
      requestTime
    );

    await sendMessage(chatId, report);
  } catch (error) {
    console.error(
      "[ANALYZER ERROR]",
      error.message
    );

    await sendMessage(
      chatId,
      `❌ Lỗi phân tích ${symbol}: ${error.message}`
    );
  } finally {
    processingChats.delete(chatId);
  }
}

export async function startTelegram() {
  running = true;

  console.log("[TELEGRAM] Bot started");

  while (running) {
    try {
      const response = await telegram.get(
        "/getUpdates",
        {
          params: {
            offset,
            timeout: 30,
            allowed_updates: JSON.stringify([
              "message"
            ])
          },
          timeout: 40000
        }
      );

      const updates = response.data.result || [];

      for (const update of updates) {
        offset = update.update_id + 1;

        await handleMessage(update.message);
      }
    } catch (error) {
      console.error(
        "[TELEGRAM]",
        error.message
      );

      await new Promise(resolve =>
        setTimeout(resolve, 3000)
      );
    }
  }
}

export function stopTelegram() {
  running = false;
}
