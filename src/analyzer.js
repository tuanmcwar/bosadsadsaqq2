
import {
  getOrderBook,
  getTrades24h,
  getTakerVolume,
  getBasis
} from "./binance.js";

import {
  analyzeOrderBook,
  analyzeTrades24h,
  analyzeTakerVolume,
  analyzeBasis
} from "./marketData.js";

function money(value) {
  if (!Number.isFinite(value)) return "N/A";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2
  }).format(value);
}

function formatPrice(value) {
  if (!Number.isFinite(value)) return "N/A";
  return value.toFixed(8);
}

function percent(value) {
  if (!Number.isFinite(value)) return "N/A";
  return `${value.toFixed(2)}%`;
}

function formatTime(timestamp) {
  if (!timestamp) return "N/A";

  return new Date(timestamp).toLocaleString(
    "vi-VN",
    {
      timeZone: "Asia/Ho_Chi_Minh",
      hour12: false
    }
  );
}

function formatError(error) {
  return error?.response?.data?.msg ||
    error?.message ||
    "Unknown error";
}

async function safelyLoad(name, fn) {
  try {
    return {
      data: await fn(),
      error: null
    };
  } catch (error) {
    console.error(
      `[API] ${name}:`,
      formatError(error)
    );

    return {
      data: null,
      error: formatError(error)
    };
  }
}

export async function analyzeSymbol(
  symbol,
  endTime = Date.now()
) {
  const [
    bookResult,
    tradesResult,
    takerResult,
    basisResult
  ] = await Promise.all([
    safelyLoad(
      "Order Book",
      () => getOrderBook(symbol)
    ),
    safelyLoad(
      "Trades 10H",
      () => getTrades24h(symbol, endTime)
    ),
    safelyLoad(
      "Taker Volume 10H",
      () => getTakerVolume(symbol)
    ),
    safelyLoad(
      "Basis",
      () => getBasis(symbol)
    )
  ]);

  const book = bookResult.data
    ? analyzeOrderBook(bookResult.data)
    : null;

  const trades = tradesResult.data
    ? analyzeTrades24h(tradesResult.data)
    : null;

  let taker = null;
  let takerError = takerResult.error;

  if (takerResult.data) {
    try {
      taker = analyzeTakerVolume(takerResult.data);
    } catch (error) {
      takerError = formatError(error);
    }
  }

  const basis = basisResult.data
    ? analyzeBasis(basisResult.data)
    : null;

  return formatReport({
    symbol,
    endTime,
    book,
    trades,
    taker,
    basis,
    errors: {
      book: bookResult.error,
      trades: tradesResult.error,
      taker: takerError,
      basis: basisResult.error
    }
  });
}

function formatReport(data) {
  const {
    symbol,
    endTime,
    book,
    trades,
    taker,
    basis,
    errors
  } = data;

  const lines = [];

  lines.push("📊 BINANCE FUTURES MARKET FLOW");
  lines.push("━━━━━━━━━━━━━━━━━━");
  lines.push(`🪙 COIN: ${symbol}`);
  lines.push(
    `🕒 Thời điểm yêu cầu: ${formatTime(endTime)}`
  );
  lines.push("");

  // ORDER BOOK
  lines.push("📚 ORDER BOOK");

  if (book) {
    lines.push(
      `🟢 BUY Depth: ${money(book.buyTotal)} USDT`
    );
    lines.push(
      `🔴 SELL Depth: ${money(book.sellTotal)} USDT`
    );
    lines.push(
      `⚖️ Imbalance: ${percent(book.imbalance)}`
    );

    if (book.buyWall) {
      lines.push(
        `🟢 Buy Wall: ${formatPrice(book.buyWall.price)} ` +
        `| ${money(book.buyWall.notional)} USDT`
      );
    }

    if (book.sellWall) {
      lines.push(
        `🔴 Sell Wall: ${formatPrice(book.sellWall.price)} ` +
        `| ${money(book.sellWall.notional)} USDT`
      );
    }
  } else {
    lines.push(
      `Không có dữ liệu: ${errors.book || "Trống"}`
    );
  }

  lines.push("");

  // TRADES 10H
  lines.push("💹 TRADES (10H GẦN NHẤT)");

  if (trades) {
    lines.push(
      `🟢 Taker Buy: ${money(trades.takerBuy)} USDT`
    );
    lines.push(
      `🔴 Taker Sell: ${money(trades.takerSell)} USDT`
    );
    lines.push(
      `📊 Delta: ${money(trades.delta)} USDT`
    );
    lines.push(
      `📈 Buy Ratio: ${percent(trades.buyRatio)}`
    );
    lines.push(
      `📉 Sell Ratio: ${percent(trades.sellRatio)}`
    );
    lines.push(
      `🔢 Aggregate Trades: ${money(trades.tradeCount)}`
    );
    lines.push(
      `⏱ Từ: ${formatTime(trades.startTime)}`
    );
    lines.push(
      `⏱ Đến: ${formatTime(trades.endTime)}`
    );
    lines.push(
      `📡 Số request API: ${trades.requestCount}`
    );

    if (trades.complete) {
      lines.push(
        "✅ Đã duyệt hết cửa sổ 10H"
      );
    } else {
      lines.push(
        "⚠️ DỮ LIỆU TRADES CHƯA ĐẦY ĐỦ"
      );
      lines.push(
        `Lý do: ${trades.errorMessage || "Không rõ"}`
      );
      lines.push(
        "Các chỉ số Trades chỉ phản ánh phần đã tải."
      );
    }
  } else {
    lines.push(
      `Không có dữ liệu: ${errors.trades || "Trống"}`
    );
  }

  lines.push("");

  // TAKER VOLUME 10H
  lines.push("📊 TAKER BUY/SELL VOLUME (10H)");

  if (taker) {
    lines.push(
      `🟢 Buy Volume: ${money(taker.buy)}`
    );
    lines.push(
      `🔴 Sell Volume: ${money(taker.sell)}`
    );
    lines.push(
      `📊 Delta: ${money(taker.delta)}`
    );
    lines.push(
      `📈 Buy Ratio: ${percent(taker.buyRatio)}`
    );
    lines.push(
      `📉 Sell Ratio: ${percent(taker.sellRatio)}`
    );
    lines.push("Đơn vị: khối lượng coin");

    lines.push(
      `📚 Số kỳ: ${taker.periods}/${taker.expectedPeriods}`
    );
    lines.push(
      `⏱ Kỳ đầu: ${formatTime(taker.firstTimestamp)}`
    );
    lines.push(
      `⏱ Kỳ cuối: ${formatTime(taker.lastTimestamp)}`
    );

    if (taker.complete) {
      lines.push(
        "✅ Đủ 10 kỳ thống kê 1H liên tiếp"
      );
    } else {
      lines.push(
        "⚠️ TAKER VOLUME CHƯA ĐỦ 10 KỲ LIÊN TIẾP"
      );
    }
  } else {
    lines.push(
      `Không có dữ liệu: ${errors.taker || "Trống"}`
    );
  }

  lines.push("");

  // BASIS 1H
  lines.push("📈 BASIS (1H)");

  if (basis) {
    lines.push(
      `Basis: ${formatPrice(basis.basis)}`
    );
    lines.push(
      `Basis Rate: ${percent(basis.basisRate * 100)}`
    );
    lines.push(
      `Futures Price: ${formatPrice(basis.futuresPrice)}`
    );
    lines.push(
      `Index Price: ${formatPrice(basis.indexPrice)}`
    );
    lines.push(
      `Kỳ dữ liệu: ${formatTime(basis.timestamp)}`
    );
  } else {
    lines.push(
      `Không có dữ liệu: ${errors.basis || "Trống"}`
    );
  }

  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━");
  lines.push(
    "ℹ️ Dữ liệu thị trường, không phải tín hiệu đặt lệnh."
  );

  return lines.join("\n");
}
