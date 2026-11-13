
import axios from 'axios';
import { config } from './config.js';

const api = axios.create({
  baseURL: config.binanceRest,
  timeout: 20000
});

export async function getSymbols() {
  const { data } = await api.get('/fapi/v1/exchangeInfo');

  return data.symbols
    .filter(item =>
      item.contractType === 'PERPETUAL' &&
      item.status === 'TRADING' &&
      item.quoteAsset === 'USDT' &&
      item.marginAsset === 'USDT'
    )
    .map(item => item.symbol);
}

export async function getMarketData() {
  // Giá giao dịch Futures gần nhất
  const futuresRequest = api.get('/fapi/v1/ticker/price');

  // Index Price của các hợp đồng
  const indexRequest = api.get('/fapi/v1/premiumIndex');

  const [futuresResponse, indexResponse] =
    await Promise.all([
      futuresRequest,
      indexRequest
    ]);

  const futuresMap = new Map();
  const indexMap = new Map();

  for (const item of futuresResponse.data) {
    const price = Number(item.price);

    if (Number.isFinite(price) && price > 0) {
      futuresMap.set(item.symbol, {
        price,
        priceText: item.price
      });
    }
  }

  for (const item of indexResponse.data) {
    const price = Number(item.indexPrice);

    if (Number.isFinite(price) && price > 0) {
      indexMap.set(item.symbol, {
        price,
        priceText: item.indexPrice
      });
    }
  }

  return {
    futuresMap,
    indexMap
  };
}

