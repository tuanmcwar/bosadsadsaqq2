
import axios from "axios";
import { config } from "./config.js";

const api = axios.create({
  baseURL: config.binanceRest,
  timeout: config.requestTimeout
});

const HOUR_MS = 60 * 60 * 1000;
const TRADE_WINDOW_MS = 10 * HOUR_MS;

const TRADE_PAGE_SIZE = 1000;

const MAX_TRADE_PAGES = Math.max(
  1,
  Number(process.env.MAX_TRADE_PAGES || 500)
);

const TRADE_REQUEST_DELAY_MS = Math.max(
  0,
  Number(process.env.TRADE_REQUEST_DELAY_MS || 150)
);

const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

export async function getExchangeInfo() {
  const { data } = await api.get(
    "/fapi/v1/exchangeInfo"
  );

  return data;
}

export async function getOrderBook(symbol) {
  const { data } = await api.get(
    "/fapi/v1/depth",
    {
      params: {
        symbol,
        limit: config.depthLimit
      }
    }
  );

  return data;
}

// Giữ lại API Trades cũ
export async function getTrades(symbol) {
  const { data } = await api.get(
    "/fapi/v1/aggTrades",
    {
      params: {
        symbol,
        limit: config.tradeLimit
      }
    }
  );

  return data;
}

// =======================================
// TAKER BUY/SELL VOLUME - 10 KỲ 1H
// =======================================

export async function getTakerVolume(symbol) {
  const { data } = await api.get(
    "/futures/data/takerlongshortRatio",
    {
      params: {
        symbol,
        period: "1h",
        limit: 10
      }
    }
  );

  if (!Array.isArray(data)) {
    throw new Error(
      "Taker Volume API không trả về mảng dữ liệu"
    );
  }

  return data;
}

// =======================================
// BASIS - GIỮ NGUYÊN 1H
// =======================================

export async function getBasis(symbol) {
  const { data } = await api.get(
    "/futures/data/basis",
    {
      params: {
        pair: symbol,
        contractType: "PERPETUAL",
        period: "1h",
        limit: 1
      }
    }
  );

  return data[0] || null;
}

// =======================================
// TRADES - 10 GIỜ GẦN NHẤT
// =======================================

async function fetchAggTrades(params) {
  const { data } = await api.get(
    "/fapi/v1/aggTrades",
    { params }
  );

  return data;
}

export async function getTrades24h(
  symbol,
  endTime = Date.now()
) {
  // Giữ tên hàm cũ để tương thích analyzer.js
  // nhưng cửa sổ thực tế là 10 giờ.
  const startTime = endTime - TRADE_WINDOW_MS;

  let takerBuy = 0;
  let takerSell = 0;
  let tradeCount = 0;

  let firstTradeTime = null;
  let lastTradeTime = null;

  let requestCount = 0;
  let complete = true;
  let errorMessage = null;

  let cursor = startTime;
  let lastProcessedId = null;

  while (cursor <= endTime) {
    if (requestCount >= MAX_TRADE_PAGES) {
      complete = false;
      errorMessage =
        `Đạt giới hạn ${MAX_TRADE_PAGES} trang API`;
      break;
    }

    const chunkEnd = Math.min(
      cursor + HOUR_MS - 1,
      endTime
    );

    let firstPage;

    try {
      firstPage = await fetchAggTrades({
        symbol,
        startTime: cursor,
        endTime: chunkEnd,
        limit: TRADE_PAGE_SIZE
      });

      requestCount++;
    } catch (error) {
      complete = false;
      errorMessage =
        error.response?.data?.msg ||
        error.message;
      break;
    }

    if (!firstPage.length) {
      cursor = chunkEnd + 1;
      continue;
    }

    let page = firstPage;
    let finishedChunk = false;

    while (!finishedChunk) {
      let crossedChunk = false;

      for (const trade of page) {
        const id = Number(trade.a);
        const time = Number(trade.T);

        if (
          lastProcessedId !== null &&
          id <= lastProcessedId
        ) {
          continue;
        }

        if (time > chunkEnd) {
          crossedChunk = true;
          break;
        }

        if (time < cursor) {
          continue;
        }

        const price = Number(trade.p);
        const quantity = Number(trade.q);
        const value = price * quantity;

        if (
          !Number.isFinite(value) ||
          value < 0
        ) {
          continue;
        }

        if (trade.m === true) {
          takerSell += value;
        } else {
          takerBuy += value;
        }

        tradeCount++;

        if (firstTradeTime === null) {
          firstTradeTime = time;
        }

        lastTradeTime = time;
        lastProcessedId = id;
      }

      if (
        crossedChunk ||
        page.length < TRADE_PAGE_SIZE
      ) {
        finishedChunk = true;
        break;
      }

      if (requestCount >= MAX_TRADE_PAGES) {
        complete = false;
        errorMessage =
          `Đạt giới hạn ${MAX_TRADE_PAGES} trang API`;
        break;
      }

      const nextId =
        Number(page[page.length - 1].a) + 1;

      if (
        !Number.isSafeInteger(nextId) ||
        (
          lastProcessedId !== null &&
          nextId <= lastProcessedId
        )
      ) {
        complete = false;
        errorMessage =
          "Không thể tiếp tục phân trang";
        break;
      }

      await sleep(TRADE_REQUEST_DELAY_MS);

      try {
        page = await fetchAggTrades({
          symbol,
          fromId: nextId,
          limit: TRADE_PAGE_SIZE
        });

        requestCount++;
      } catch (error) {
        complete = false;
        errorMessage =
          error.response?.data?.msg ||
          error.message;
        break;
      }

      if (!page.length) {
        finishedChunk = true;
      }
    }

    if (!complete) break;

    cursor = chunkEnd + 1;

    if (cursor <= endTime) {
      await sleep(TRADE_REQUEST_DELAY_MS);
    }
  }

  return {
    symbol,
    startTime,
    endTime,

    takerBuy,
    takerSell,
    tradeCount,

    firstTradeTime,
    lastTradeTime,

    requestCount,
    complete,
    errorMessage
  };
}

