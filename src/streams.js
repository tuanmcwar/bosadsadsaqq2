
import WebSocket from "ws";
import { config } from "./config.js";

const streams = new Map();

const DEPTH_TIMEOUT_MS = 30000;
const HEALTH_CHECK_MS = 10000;

function cleanEvents(events) {
  const cutoff = Date.now() - config.windowMs;

  while (
    events.length &&
    events[0].time < cutoff
  ) {
    events.shift();
  }
}

function createState(symbol) {
  return {
    symbol,
    startedAt: Date.now(),

    depthEvents: [],
    liquidationEvents: [],

    connected: false,
    connectedAt: null,

    lastDepthTime: null,
    lastLiquidationTime: null,

    depthReady: false,

    ws: null,
    reconnectTimer: null,
    healthTimer: null,

    reconnects: 0,
    gaps: 0,
    stopped: false
  };
}

export function watchSymbol(symbol) {
  if (streams.has(symbol)) {
    return streams.get(symbol);
  }

  if (streams.size >= config.maxActiveStreams) {
    throw new Error(
      "Đã đạt giới hạn coin đang theo dõi"
    );
  }

  const state = createState(symbol);

  streams.set(symbol, state);
  connect(state);

  return state;
}

function connect(state) {
  if (state.stopped) return;

  const symbol = state.symbol.toLowerCase();

  const combinedUrl =
    "wss://fstream.binance.com/stream?streams=" +
    `${symbol}@depth@1000ms/` +
    `${symbol}@forceOrder`;

  const ws = new WebSocket(combinedUrl);

  state.ws = ws;
  state.connected = false;
  state.depthReady = false;
  state.connectedAt = null;

  if (state.healthTimer) {
    clearInterval(state.healthTimer);
    state.healthTimer = null;
  }

  ws.on("open", () => {
    if (state.stopped || state.ws !== ws) return;

    state.connected = true;
    state.connectedAt = Date.now();

    console.log(
      `[WS] Connected: ${state.symbol}`
    );

    state.healthTimer = setInterval(() => {
      if (
        state.stopped ||
        state.ws !== ws ||
        ws.readyState !== WebSocket.OPEN
      ) {
        return;
      }

      const now = Date.now();

      const lastActivity =
        state.lastDepthTime &&
        state.lastDepthTime >= state.connectedAt
          ? state.lastDepthTime
          : state.connectedAt;

      if (
        lastActivity &&
        now - lastActivity > DEPTH_TIMEOUT_MS
      ) {
        console.warn(
          `[WS] Depth timeout: ${state.symbol} ` +
          `(${Math.round(
            (now - lastActivity) / 1000
          )}s)`
        );

        // Đóng kết nối cũ để kích hoạt reconnect
        ws.terminate();
      }
    }, HEALTH_CHECK_MS);
  });

  ws.on("message", raw => {
    if (state.stopped || state.ws !== ws) return;

    try {
      const message = JSON.parse(raw.toString());

      const data = message.data;

      if (!data) {
        console.log(
          `[WS] Non-data message: ${state.symbol}`,
          message
        );
        return;
      }

      if (data.e === "depthUpdate") {
        handleDepth(state, data);
      } else if (data.e === "forceOrder") {
        handleLiquidation(state, data);
      } else {
        console.log(
          `[WS] Unknown event: ${state.symbol}`,
          data.e
        );
      }
    } catch (error) {
      console.error(
        `[WS] Parse error ${state.symbol}:`,
        error.message
      );
    }
  });

  ws.on("error", error => {
    console.error(
      `[WS] Error ${state.symbol}:`,
      error.message
    );
  });

  ws.on("close", (code, reason) => {
    if (state.ws !== ws) return;

    state.connected = false;
    state.depthReady = false;
    state.connectedAt = null;

    if (state.healthTimer) {
      clearInterval(state.healthTimer);
      state.healthTimer = null;
    }

    console.warn(
      `[WS] Closed: ${state.symbol}`,
      `code=${code}`,
      `reason=${reason.toString()}`
    );

    if (state.stopped) return;

    state.gaps++;
    state.reconnects++;

    const delay = Math.min(
      30000,
      1000 * 2 ** Math.min(state.reconnects, 5)
    );

    console.log(
      `[WS] Reconnecting ${state.symbol} ` +
      `in ${delay / 1000}s`
    );

    state.reconnectTimer = setTimeout(() => {
      state.reconnectTimer = null;
      connect(state);
    }, delay);
  });
}

function handleDepth(state, data) {
  const time = Date.now();

  state.lastDepthTime = time;

  state.depthEvents.push({
    time,
    bidLevelsChanged:
      Array.isArray(data.b) ? data.b.length : 0,
    askLevelsChanged:
      Array.isArray(data.a) ? data.a.length : 0
  });

  cleanEvents(state.depthEvents);

  if (!state.depthReady) {
    state.depthReady = true;

    console.log(
      `[WS] First depth received: ${state.symbol}`
    );
  }
}

function handleLiquidation(state, data) {
  const order = data.o;

  if (!order) return;

  const price = Number(order.ap || order.p);
  const quantity = Number(order.z || order.q);

  if (
    !Number.isFinite(price) ||
    !Number.isFinite(quantity) ||
    price <= 0 ||
    quantity <= 0
  ) {
    return;
  }

  const time = Date.now();

  const event = {
    time,
    side: order.S,
    price,
    quantity,
    notional: price * quantity
  };

  state.liquidationEvents.push(event);
  state.lastLiquidationTime = time;

  cleanEvents(state.liquidationEvents);

  console.log(
    `[WS] Liquidation ${state.symbol}: ` +
    `${event.side} ` +
    `${event.notional.toFixed(2)} USDT`
  );
}

export function getStreamData(symbol) {
  const state = streams.get(symbol);

  if (!state) return null;

  cleanEvents(state.depthEvents);
  cleanEvents(state.liquidationEvents);

  let longLiquidated = 0;
  let shortLiquidated = 0;

  for (const event of state.liquidationEvents) {
    if (event.side === "SELL") {
      longLiquidated += event.notional;
    }

    if (event.side === "BUY") {
      shortLiquidated += event.notional;
    }
  }

  const depth = state.depthEvents.reduce(
    (acc, event) => {
      acc.bidChanges += event.bidLevelsChanged;
      acc.askChanges += event.askLevelsChanged;
      return acc;
    },
    {
      bidChanges: 0,
      askChanges: 0
    }
  );

  const now = Date.now();

  const depthAgeSeconds =
    state.lastDepthTime === null
      ? null
      : Math.floor(
          (now - state.lastDepthTime) / 1000
        );

  const depthActive =
    state.connected &&
    state.depthReady &&
    depthAgeSeconds !== null &&
    depthAgeSeconds <= 30;

  return {
    connected: state.connected,

    depthActive,
    depthAgeSeconds,

    collectingMinutes:
      Math.min(
        config.windowMs,
        now - state.startedAt
      ) / 60000,

    completeWindow:
      now - state.startedAt >= config.windowMs &&
      state.gaps === 0 &&
      depthActive,

    gaps: state.gaps,

    depthEvents: state.depthEvents.length,
    bidChanges: depth.bidChanges,
    askChanges: depth.askChanges,

    longLiquidated,
    shortLiquidated,

    liquidationEvents:
      state.liquidationEvents.length,

    lastDepthTime: state.lastDepthTime,
    lastLiquidationTime:
      state.lastLiquidationTime
  };
}

export function stopAllStreams() {
  for (const state of streams.values()) {
    state.stopped = true;

    if (state.reconnectTimer) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
    }

    if (state.healthTimer) {
      clearInterval(state.healthTimer);
      state.healthTimer = null;
    }

    if (state.ws) {
      state.ws.close();
    }
  }

  streams.clear();
}
