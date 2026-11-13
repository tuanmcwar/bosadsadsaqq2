import "dotenv/config";

export const config = {
  binanceRest: "https://fapi.binance.com",
  binanceWs: "wss://fstream.binance.com/ws",

  telegramToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: String(
    process.env.TELEGRAM_CHAT_ID || ""
  ),

  windowMs:
    Number(process.env.WINDOW_MINUTES || 60) *
    60 * 1000,

  depthLimit: Number(process.env.DEPTH_LIMIT || 500),
  tradeLimit: Number(process.env.TRADE_LIMIT || 1000),

  requestTimeout: 15000,
  pollingInterval: 1500,

  maxActiveStreams: 30
};

if (!config.telegramToken) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN");
}

if (!config.telegramChatId) {
  throw new Error("Missing TELEGRAM_CHAT_ID");
}