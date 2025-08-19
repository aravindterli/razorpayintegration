# razorpayintegration


Razorpay Integration: End-to-End Process
Follow this sequence to run a secure, reliable Razorpay payment flow. This assumes code for backend, frontend, and webhooks already exists.

1) Prerequisites and Setup
Generate API keys in Dashboard (Test/Live) and set environment variables:

RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET

Enable required payment methods in Dashboard.

Use HTTPS for all production endpoints.

2) Create Order (Server)
Receive amount, currency, receipt, and notes from app/business logic.

Create Razorpay Order on the server in smallest currency unit (e.g., ₹500 → 50000).

Return the full order payload (especially order.id) to the client.

Persist an internal order record with:

internal_order_id, razorpay_order_id, expected_amount, currency, status=pending.

3) Open Checkout (Client)
Load Razorpay Checkout script.

Initialize Checkout with:

key (public Key ID), order_id, amount, currency, name/description, prefill, notes, theme.

Handle events:

On success: receive razorpay_payment_id, razorpay_order_id, razorpay_signature.

On failure/cancel: log and show error UI.

4) Server-Side Signature Verification
POST the success payload from client to server.

Compute HMAC-SHA256 of "order_id|payment_id" using Key Secret.

Compare with razorpay_signature.

If mismatch → mark attempt failed and return error.

If match → proceed to capture (if manual) or mark authorized.

5) Capture (If Manual Capture Enabled)
Call capture API with amount and currency.

On successful capture:

Mark internal order as paid.

Store payment_id, captured_at, amount_captured.

On failure:

Mark as capture_failed and initiate remediation (retry or alert)
