# 🦽 Andafacil AI — Ecommerce Agent

> An AI-powered sales assistant that knows your entire product catalog, answers customer questions, generates payment links, collects delivery addresses, and creates social media ad campaigns — all from a chat interface.

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────┐
│                ANDAFACIL AI AGENT                 │
├────────────┬─────────────────┬───────────────────┤
│   INGEST   │    CHATBOT      │   AD GENERATOR    │
│            │                 │                   │
│ WP Crawl   │ Product Q&A     │ Audience Research │
│ Products   │ Recommendations │ Ad Copy (ES)      │
│ Images     │ Stripe Payment  │ Video Scripts     │
│ Reviews    │ Address Collect  │ Targeting Recs    │
│ Specs      │ Order Confirm   │ Seasonal Calendar │
├────────────┴─────────────────┴───────────────────┤
│        OpenClaw (Memory + Cron + Skills)         │
├──────────────────────────────────────────────────┤
│         WhatsApp / Telegram / Web Chat           │
└──────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
andafacil/
├── README.md                    # This file
├── products/                    # Crawled product catalog (markdown files)
│   ├── andafacil-pro.md
│   ├── andafacil-easy-go.md
│   └── ...
├── catalog-index.md             # Product index with prices & categories
├── testimonials.md              # Customer reviews from the website
├── ad-research/
│   └── strategy-brief.md        # Comprehensive ad research findings
├── ads-output/                  # Generated ad creatives per product
│   ├── andafacil-pro-ads.md
│   └── ...
└── chatbot/
    ├── SYSTEM-PROMPT.md          # Chatbot personality & behavior
    ├── PURCHASE-FLOW.md          # Stripe payment + address flow
    └── stripe-mock.sh            # Mock payment link generator (demo)
```

## 🚀 How It Works

### 1. Data Ingestion
- Crawls andafacil.com via WordPress REST API + sitemap
- Extracts all product data: names, descriptions, specs, images, prices
- Stores as structured markdown for the AI to reference

### 2. Sales Chatbot
- Customer messages on WhatsApp/Telegram
- AI answers product questions using the knowledge base
- Recommends products based on needs assessment
- Generates Stripe payment links for purchase
- Collects delivery address post-payment
- Confirms order with full summary

### 3. Ad Campaign Generator
- Researches best-performing ad strategies for senior/mobility market
- Generates Meta ad creatives for each product
- Multiple emotional angles: independence, family gift, safety, dignity
- Spanish-language copy optimized for Mexican audience
- Video scripts with shot-by-shot breakdowns
- Scheduled weekly refresh via cron

## 🔧 Setup

### Prerequisites
- OpenClaw instance running
- Telegram Bot Token (via @BotFather) or WhatsApp Business
- Stripe API key (for real payment links)

### Quick Start
1. Products are auto-crawled on setup
2. Connect messaging channel (Telegram recommended for demo)
3. Add Stripe key for real payment links (mock mode works without)
4. Run ad generator for any product

## 🎪 Hackathon Demo Script

1. **Show the catalog** — "We crawled 25+ products automatically"
2. **Customer chat** — Ask about a product, get instant expert answer
3. **Purchase flow** — "Quiero comprarla" → payment link → address → confirmation
4. **Ad generation** — Generate 3 ad variations for a product with research-backed strategy
5. **Automation** — Show cron job for weekly ad refresh

## 📊 Why This Wins

| Criteria | How We Score |
|----------|-------------|
| **Authenticity** | Built by an ecommerce founder solving their own problem |
| **Creativity** | Full sales funnel + ad generation in a single chat agent |
| **Practical Use** | Any WooCommerce store can replicate this setup |
