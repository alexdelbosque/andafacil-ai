#!/bin/bash
# Mock Stripe Payment Link Generator for Hackathon Demo
# Replace with real Stripe API calls when keys are available

# Usage: ./stripe-mock.sh "Product Name" "Price in cents" "Currency"
# Example: ./stripe-mock.sh "Andafacil Pro" 2999900 mxn

PRODUCT_NAME="${1:-Andafacil Pro}"
PRICE_CENTS="${2:-2999900}"
CURRENCY="${3:-mxn}"

# Generate a mock payment link ID
MOCK_ID="plink_mock_$(date +%s)_$(shuf -i 1000-9999 -n 1)"
MOCK_URL="https://buy.stripe.com/${MOCK_ID}"

# Calculate display price
PRICE_DISPLAY=$(echo "scale=2; ${PRICE_CENTS}/100" | bc)

cat << EOF
{
  "id": "${MOCK_ID}",
  "object": "payment_link",
  "active": true,
  "url": "${MOCK_URL}",
  "currency": "${CURRENCY}",
  "product_name": "${PRODUCT_NAME}",
  "amount_display": "\$${PRICE_DISPLAY} MXN",
  "payment_methods": ["card", "oxxo"],
  "mode": "mock_demo"
}
EOF
