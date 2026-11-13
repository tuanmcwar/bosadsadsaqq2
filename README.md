# Binance Futures Telegram On-Demand Market Flow Bot

Node.js >=20. Telegram: gửi `BTC`, `ETH`, `SOL`, `BTCUSDT`, hoặc `/scan BTC` để nhận phân tích ngay.

## Cài đặt

1. `npm install`
2. Copy `.env.example` thành `.env`, điền `TELEGRAM_BOT_TOKEN`, và `TELEGRAM_CHAT_ID` (khuyến nghị để giới hạn quyền sử dụng).
3. `npm start`

Bot sử dụng Telegram getUpdates (long polling). Không chạy đồng thời webhook hoặc nhiều bản bot cùng token. Trên Railway dùng worker/service chạy liên tục và điền environment variables; không cần public domain.

## Dữ liệu

- Order Book: snapshot REST 100 mức mỗi bên; sau khi bắt đầu theo dõi dùng partial depth stream 20 mức (không phải order book đầy đủ).
- Trades: tối đa 1000 aggregate trades gần nhất; không đại diện cố định cho 15 phút.
- Taker Buy/Sell M15: từ quote volume của nến 15m **đã đóng**; đây là tổng giá trị giao dịch chủ động bằng USDT.
- Live aggTrades và liquidation: tích lũy trong RAM kể từ lúc người dùng lần đầu yêu cầu coin. Khởi động lại sẽ mất số liệu. `forceOrder` chỉ phát snapshot, không bao phủ mọi thanh lý.
- Basis: endpoint Binance `/futures/data/basis` 5m; có thể không hỗ trợ một số cặp hoặc gặp lỗi. Khi đó N/A.
- Không tự đặt lệnh. Không có xác nhận tín hiệu giao dịch. Tránh dùng trực tiếp để giao dịch tiền thật.

**Chú ý**: Binance có thể trả HTTP 451 theo vị trí máy chủ. Khi đó cần deploy ở khu vực Binance cho phép, tuân thủ quy định và điều khoản dịch vụ. Endpoint Binance có thể thay đổi.
# binance-basis-scanner
