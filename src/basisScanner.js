
import { config } from './config.js';

export function scanBasis(symbols, marketData) {
  const results = [];

  const {
    futuresMap,
    indexMap
  } = marketData;

  for (const symbol of symbols) {
    const futures = futuresMap.get(symbol);
    const index = indexMap.get(symbol);

    if (!futures || !index) {
      continue;
    }

    const futuresPrice = futures.price;
    const indexPrice = index.price;

    const basis = futuresPrice - indexPrice;

    const basisRate =
      (basis / indexPrice) * 100;

    let side;

    if (basisRate > config.positiveThreshold) {
      side = 'POSITIVE';
    } else if (
      basisRate < config.negativeThreshold
    ) {
      side = 'NEGATIVE';
    } else {
      continue;
    }

    results.push({
      symbol,
      side,
      futuresPrice,
      futuresPriceText: futures.priceText,
      indexPrice,
      indexPriceText: index.priceText,
      basis,
      basisRate
    });
  }

  // Coin có độ lệch Basis lớn nhất đứng đầu
  results.sort(
    (a, b) =>
      Math.abs(b.basisRate) -
      Math.abs(a.basisRate)
  );

  return results;
}

