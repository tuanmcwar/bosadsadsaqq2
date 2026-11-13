import { loadSymbols, startTelegram, stopTelegram }
  from "./telegram.js";


let shuttingDown = false;

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🚀 BINANCE FUTURES MARKET FLOW");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━");

  await loadSymbols();

  console.log("📡 Binance API: READY");
  console.log("🤖 Telegram: STARTING");
  console.log("📊 Mode: ON-DEMAND");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━");

  await startTelegram();
}

function shutdown(signal) {
  if (shuttingDown) return;

  shuttingDown = true;

  console.log(`\n[${signal}] Shutting down...`);

  stopTelegram();
  stopAllStreams();

  setTimeout(() => process.exit(0), 1000);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

main().catch(error => {
  console.error(
    "[FATAL]",
    error.message
  );

  process.exit(1);
});