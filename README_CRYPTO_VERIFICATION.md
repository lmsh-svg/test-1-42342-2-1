# Bitcoin Transaction Verification System

## Overview

This system provides comprehensive Bitcoin transaction verification with both REST API and real-time WebSocket monitoring capabilities.

## Features

### ✅ REST API Verification
- **Endpoint**: `POST /api/crypto/verify-tx`
- Verifies Bitcoin, Ethereum, and Dogecoin transactions
- Checks against ALL configured wallet addresses
- Works with old and new transactions
- Automatic confirmation tracking

### 🔴 Real-Time WebSocket Monitoring
- **Endpoint**: `POST /api/crypto/websocket-monitor`
- Live monitoring of configured Bitcoin addresses
- Automatic transaction detection
- Real-time confirmation updates
- Auto-reconnection on disconnect

### 🔍 Debug Tools
- **Endpoint**: `POST /api/crypto/debug-tx`
- Shows exactly where transaction funds went
- Displays all output addresses
- Helps identify verification issues

## How to Use

### 1. Configure Wallet Addresses

Go to **Admin → Crypto Addresses** and add your Bitcoin wallet addresses:

```
Cryptocurrency: BTC
Address: bc1qk08xsenkczz4m7k26d7hqlgjdl503j44xrqlf4
Label: Main Bitcoin Wallet
Active: Yes
```

### 2. Start Real-Time Monitoring

On the Crypto Addresses page, click **"Start Monitoring"** in the WebSocket Monitor card. This will:
- Connect to mempool.space WebSocket
- Track ALL your configured addresses in real-time
- Automatically detect incoming transactions
- Update confirmation status as blocks are mined

### 3. Verify Transactions

**Method A: Admin Interface**
1. Go to Admin → Crypto Addresses
2. Enter transaction ID in "Test Transaction ID" section
3. Click "Test"

**Method B: API Call**
```bash
curl -X POST https://your-domain.com/api/crypto/verify-tx \
  -H "Content-Type: application/json" \
  -d '{"txid": "abc123...", "currency": "BTC"}'
```

### 4. Debug Issues

If a valid transaction shows as invalid:

1. Use the **Debug Transaction** tool on the Crypto Addresses page
2. Enter the transaction ID and click "Debug"
3. Check the output addresses - verify one matches your configured addresses
4. If no match, the transaction wasn't sent to your addresses

## API Responses

### Success (Matched and Confirmed)
```json
{
  "success": true,
  "verification": {
    "txid": "abc123...",
    "currency": "BTC",
    "matchedAddress": "bc1qk08xsen...",
    "amountFloat": 0.025,
    "confirmed": true,
    "confirmations": 6,
    "firstSeen": "2025-01-15T10:30:00Z",
    "lastChecked": "2025-01-15T10:45:00Z"
  },
  "message": "Transaction verified and confirmed with 6 confirmations"
}
```

### Success (Matched but Unconfirmed)
```json
{
  "success": true,
  "verification": {
    "txid": "abc123...",
    "currency": "BTC",
    "matchedAddress": "bc1qk08xsen...",
    "amountFloat": 0.025,
    "confirmed": false,
    "confirmations": 1,
    "firstSeen": "2025-01-15T10:30:00Z",
    "lastChecked": "2025-01-15T10:31:00Z"
  },
  "message": "Transaction verified but awaiting confirmation (1/2 confirmations)"
}
```

### Error (No Match)
```json
{
  "success": false,
  "error": "Transaction was not sent to any of your configured wallet addresses",
  "code": "ADDRESS_MISMATCH",
  "testedAddresses": [
    "BTC: Transaction was not sent to address bc1qk08xsen...",
    "BTC: Transaction was not sent to address bc1qexample2..."
  ]
}
```

### Error (Not Found)
```json
{
  "success": false,
  "error": "Transaction not found on blockchain",
  "code": "TRANSACTION_NOT_FOUND"
}
```

## Database Schema

### `incoming_verifications` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer | Primary key |
| `txid` | Text | Transaction ID (unique with currency) |
| `currency` | Text | BTC, ETH, or DOGE |
| `matchedAddress` | Text | Which wallet address matched |
| `amountSats` | Integer | Amount in satoshis |
| `amountFloat` | Real | Amount in BTC |
| `confirmed` | Boolean | Confirmation status |
| `confirmedAt` | Text | ISO timestamp of confirmation |
| `credited` | Boolean | Whether user was credited |
| `creditedAt` | Text | ISO timestamp of credit |
| `firstSeen` | Text | First detection timestamp |
| `lastChecked` | Text | Last check timestamp |
| `meta` | Text | JSON metadata (full transaction data) |
| `userId` | Integer | Associated user ID (nullable) |
| `retryCount` | Integer | Number of retry attempts |
| `errorMessage` | Text | Error details if any |

## Architecture

### REST API Flow
```
User/System → POST /api/crypto/verify-tx
                ↓
         Validate TXID format
                ↓
    Fetch from mempool.space API
                ↓
     Check against ALL addresses
                ↓
    Save/Update in database
                ↓
         Return result
```

### WebSocket Flow
```
Admin starts monitoring
         ↓
Connect to wss://mempool.space/api/v1/ws
         ↓
Send: { "track-addresses": ["bc1q...", ...] }
         ↓
Receive transaction updates
         ↓
Process and save to database
         ↓
Auto-reconnect on disconnect
```

## Common Issues

### "Invalid Transaction ID" Error

**Possible Causes:**
1. **Transaction not sent to your addresses** - Use debug tool to verify
2. **Wrong transaction ID** - Double-check the TXID
3. **Transaction doesn't exist** - Verify on blockchain explorer

**Solutions:**
1. Use the Debug Transaction tool to see all output addresses
2. Verify your configured wallet addresses are correct
3. Check transaction on https://mempool.space/tx/[txid]

### WebSocket Not Connecting

**Possible Causes:**
1. Server environment doesn't support WebSocket
2. Network/firewall blocking WebSocket connections
3. No active Bitcoin addresses configured

**Solutions:**
1. Check server logs for WebSocket errors
2. Verify network allows wss:// connections
3. Add at least one active Bitcoin address

## Testing

### Test with Real Transaction

1. Find a Bitcoin transaction on mempool.space
2. Note the transaction ID (64 hex characters)
3. Check which addresses received funds
4. Add one of those addresses to your crypto addresses
5. Test the transaction - should show as valid

### Example Test Transaction

Use this real Bitcoin transaction for testing:
- TXID: `9d3ea0d131c45450c135d549b62032019bc47a80368e14edc72caf38f5a88033`
- This transaction has multiple outputs
- Add any of the output addresses to test

## Production Deployment

### Environment Setup

No additional environment variables needed. The system uses:
- Existing database connection (Turso)
- Public mempool.space API (no key required)
- WebSocket connection (wss://mempool.space/api/v1/ws)

### Recommended Configuration

1. **Enable WebSocket Monitoring** - Start on server startup
2. **Background Polling** - Call `/api/crypto/poll-pending` every 5 minutes via cron
3. **Monitor Logs** - Check for WebSocket reconnection events

### Cron Job Example

```bash
# Check pending verifications every 5 minutes
*/5 * * * * curl -X POST https://your-domain.com/api/crypto/poll-pending
```

## Support

For issues or questions:
1. Check the debug transaction tool first
2. Verify addresses are configured correctly
3. Ensure WebSocket monitoring is running
4. Check server logs for errors

## API Reference

- `POST /api/crypto/verify-tx` - Verify single transaction
- `POST /api/crypto/debug-tx` - Debug transaction details
- `GET /api/crypto/verifications` - List all verifications
- `POST /api/crypto/verifications/[id]/retry` - Retry failed verification
- `GET /api/crypto/deposit-addresses` - List configured addresses
- `POST /api/crypto/websocket-monitor` - Start WebSocket monitoring
- `GET /api/crypto/websocket-monitor` - Check monitoring status
- `DELETE /api/crypto/websocket-monitor` - Stop monitoring
- `POST /api/crypto/poll-pending` - Check pending verifications

## Architecture Diagram

```
┌─────────────┐
│   Admin UI  │
└──────┬──────┘
       │
       ├─ Configure Addresses
       ├─ Start WebSocket Monitor
       ├─ Test Transactions
       └─ Debug Transactions
       │
┌──────▼───────────────────────────────────────┐
│           Backend API                         │
│                                              │
│  ┌─────────────┐         ┌────────────────┐│
│  │  REST API   │         │   WebSocket    ││
│  │  Endpoints  │         │    Monitor     ││
│  └──────┬──────┘         └────────┬───────┘│
│         │                         │        │
│         └────────┬────────────────┘        │
│                  │                         │
│           ┌──────▼──────┐                 │
│           │  Database   │                 │
│           │  (Turso)    │                 │
│           └─────────────┘                 │
└───────────────────────────────────────────┘
                  │
                  ▼
         ┌────────────────┐
         │ mempool.space  │
         │   REST API     │
         │   WebSocket    │
         └────────────────┘
```

## License

Part of the main application license.