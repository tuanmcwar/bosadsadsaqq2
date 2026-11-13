
import 'dotenv/config';

export const config = {
  binanceRest:
    process.env.BINANCE_REST || 'https://fapi.binance.com',

  positiveThreshold: Number(
    process.env.BASIS_POSITIVE_THRESHOLD ?? 1
  ),

  negativeThreshold: Number(
    process.env.BASIS_NEGATIVE_THRESHOLD ?? -1
  ),

  timezone:
    process.env.TIMEZONE || 'Asia/Ho_Chi_Minh',

  telegramToken:
    process.env.TELEGRAM_BOT_TOKEN || '',

  telegramChatId:
    process.env.TELEGRAM_CHAT_ID || ''
};

if (
  !Number.isFinite(config.positiveThreshold) ||
  !Number.isFinite(config.negativeThreshold) ||
  config.positiveThreshold <= 0 ||
  config.negativeThreshold >= 0
) {
  throw new Error('Ngưỡng Basis Rate không hợp lệ');
}
