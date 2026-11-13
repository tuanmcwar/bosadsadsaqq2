
function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function sum(values) {
  return values.reduce((a, b) => a + b, 0);
}

// =======================================
// ORDER BOOK
// =======================================

export function analyzeOrderBook(book) {
  const bids = book.bids.map(([p, q]) => ({
    price: num(p),
    quantity: num(q),
    notional: num(p) * num(q)
  }));

  const asks = book.asks.map(([p, q]) => ({
    price: num(p),
    quantity: num(q),
    notional: num(p) * num(q)
  }));

  const buyTotal = sum(bids.map(x => x.notional));
  const sellTotal = sum(asks.map(x => x.notional));
  const total = buyTotal + sellTotal;

  const imbalance = total > 0
    ? ((buyTotal - sellTotal) / total) * 100
    : 0;

  const buyWall = [...bids].sort(
    (a, b) => b.notional - a.notional
  )[0];

  const sellWall = [...asks].sort(
    (a, b) => b.notional - a.notional
  )[0];

  return {
    buyTotal,
    sellTotal,
    imbalance,
    buyWall,
    sellWall
  };
}

// =======================================
// TRADES CŨ
// =======================================

export function analyzeTrades(trades) {
  let takerBuy = 0;
  let takerSell = 0;

  for (const trade of trades) {
    const value = num(trade.p) * num(trade.q);

    if (trade.m === true) {
      takerSell += value;
    } else {
      takerBuy += value;
    }
  }

  const total = takerBuy + takerSell;

  return {
    takerBuy,
    takerSell,
    delta: takerBuy - takerSell,
    buyRatio: total > 0
      ? takerBuy / total * 100
      : 0,
    tradeCount: trades.length,
    firstTradeTime: trades.length
      ? trades[0].T
      : null,
    lastTradeTime: trades.length
      ? trades[trades.length - 1].T
      : null
  };
}

// =======================================
// TRADES 10H - GIỮ NGUYÊN
// =======================================

export function analyzeTrades24h(data) {
  if (!data) return null;

  const takerBuy = num(data.takerBuy);
  const takerSell = num(data.takerSell);
  const total = takerBuy + takerSell;

  return {
    takerBuy,
    takerSell,
    delta: takerBuy - takerSell,
    buyRatio: total > 0
      ? takerBuy / total * 100
      : 0,
    sellRatio: total > 0
      ? takerSell / total * 100
      : 0,
    tradeCount: data.tradeCount,
    startTime: data.startTime,
    endTime: data.endTime,
    firstTradeTime: data.firstTradeTime,
    lastTradeTime: data.lastTradeTime,
    requestCount: data.requestCount,
    complete: data.complete,
    errorMessage: data.errorMessage
  };
}

// =======================================
// TAKER BUY/SELL VOLUME - 10H
// =======================================

export function analyzeTakerVolume(data) {
  if (!Array.isArray(data) || !data.length) {
    return null;
  }

  const HOUR_MS = 60 * 60 * 1000;
  const EXPECTED_PERIODS = 10;

  const sorted = [...data].sort(
    (a, b) => Number(a.timestamp) -
              Number(b.timestamp)
  );

  let buy = 0;
  let sell = 0;
  const timestamps = [];

  for (const item of sorted) {
    const buyVol = Number(item.buyVol);
    const sellVol = Number(item.sellVol);
    const timestamp = Number(item.timestamp);

    if (
      !Number.isFinite(buyVol) ||
      !Number.isFinite(sellVol) ||
      !Number.isFinite(timestamp) ||
      buyVol < 0 ||
      sellVol < 0 ||
      timestamp <= 0
    ) {
      throw new Error(
        "Taker Volume chứa dữ liệu không hợp lệ"
      );
    }

    buy += buyVol;
    sell += sellVol;
    timestamps.push(timestamp);
  }

  const uniqueTimes = new Set(timestamps);

  const consecutive = timestamps.every(
    (time, index) =>
      index === 0 ||
      time - timestamps[index - 1] === HOUR_MS
  );

  const complete =
    sorted.length === EXPECTED_PERIODS &&
    uniqueTimes.size === EXPECTED_PERIODS &&
    consecutive;

  const total = buy + sell;

  return {
    buy,
    sell,
    delta: buy - sell,
    buyRatio: total > 0
      ? buy / total * 100
      : 0,
    sellRatio: total > 0
      ? sell / total * 100
      : 0,
    periods: sorted.length,
    expectedPeriods: EXPECTED_PERIODS,
    complete,
    firstTimestamp: timestamps[0],
    lastTimestamp: timestamps[timestamps.length - 1]
  };
}

// =======================================
// BASIS
// =======================================

export function analyzeBasis(data) {
  if (!data) return null;

  return {
    basis: num(data.basis),
    basisRate: num(data.basisRate),
    futuresPrice: num(data.futuresPrice),
    indexPrice: num(data.indexPrice),
    timestamp: data.timestamp
  };
}

