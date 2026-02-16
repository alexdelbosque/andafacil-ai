// ─── ClawCommerce Backend Server ───
const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const app = express();
const PORT = 3000;
const STORES_DIR = path.join(__dirname, 'stores');

if (!fs.existsSync(STORES_DIR)) fs.mkdirSync(STORES_DIR, { recursive: true });

app.use(express.json());

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// ─── Helpers ───

function fetchUrl(url, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        const doFetch = (url, left) => {
            const lib = url.startsWith('https') ? https : http;
            const req = lib.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/json,*/*',
                    'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
                },
                timeout: 15000,
            }, (res) => {
                if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
                    if (left <= 0) return reject(new Error('Too many redirects'));
                    let loc = res.headers.location;
                    if (loc.startsWith('/')) { const u = new URL(url); loc = `${u.protocol}//${u.host}${loc}`; }
                    return doFetch(loc, left - 1);
                }
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        };
        doFetch(url, maxRedirects);
    });
}

function cleanHtml(str) {
    if (!str) return '';
    return str.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, '')
        .replace(/\s+/g, ' ').trim();
}

// ─── Platform Detection ───
async function detectPlatform(baseUrl) {
    const logs = [];

    // Try WordPress WooCommerce Store API
    try {
        logs.push({ msg: `Trying WordPress/WooCommerce API...`, type: 'info' });
        const r = await fetchUrl(`${baseUrl}/wp-json/wc/store/v1/products?per_page=1`);
        if (r.status === 200) {
            const d = JSON.parse(r.data);
            if (Array.isArray(d) && d.length > 0) {
                logs.push({ msg: `WordPress/WooCommerce Store API detected`, type: 'ok' });
                return { platform: 'wordpress-store-api', logs };
            }
        }
    } catch (e) {}

    // Try WP REST API
    try {
        const r = await fetchUrl(`${baseUrl}/wp-json/wp/v2/product?per_page=1`);
        if (r.status === 200) {
            const d = JSON.parse(r.data);
            if (Array.isArray(d) && d.length > 0) {
                logs.push({ msg: `WordPress REST API detected`, type: 'ok' });
                return { platform: 'wordpress-rest', logs };
            }
        }
    } catch (e) {}

    // Try Shopify
    try {
        logs.push({ msg: `Trying Shopify API...`, type: 'info' });
        const r = await fetchUrl(`${baseUrl}/products.json?limit=1`);
        if (r.status === 200) {
            const d = JSON.parse(r.data);
            if (d.products) {
                logs.push({ msg: `Shopify store detected`, type: 'ok' });
                return { platform: 'shopify', logs };
            }
        }
    } catch (e) {}

    // Generic HTML
    try {
        logs.push({ msg: `Trying HTML scraping...`, type: 'info' });
        const r = await fetchUrl(baseUrl);
        if (r.status === 200) {
            if (r.data.includes('__NEXT_DATA__')) {
                logs.push({ msg: `Next.js site detected`, type: 'ok' });
                return { platform: 'nextjs', logs, html: r.data };
            }
            if (r.data.includes('Shopify') || r.data.includes('cdn.shopify.com')) {
                logs.push({ msg: `Shopify (HTML fallback) detected`, type: 'ok' });
                return { platform: 'shopify-html', logs, html: r.data };
            }
            if (r.data.includes('wp-content') || r.data.includes('woocommerce')) {
                logs.push({ msg: `WordPress detected via HTML`, type: 'ok' });
                return { platform: 'wordpress-html', logs, html: r.data };
            }
            logs.push({ msg: `Generic HTML — will scrape`, type: 'warn' });
            return { platform: 'generic', logs, html: r.data };
        }
    } catch (e) {}

    return { platform: 'unknown', logs };
}

// ─── Crawlers ───

async function crawlWordPressStoreAPI(baseUrl, logs) {
    const products = [];
    let page = 1;
    while (true) {
        try {
            logs.push({ msg: `Fetching Store API page ${page}...`, type: 'info' });
            const r = await fetchUrl(`${baseUrl}/wp-json/wc/store/v1/products?per_page=100&page=${page}`);
            if (r.status !== 200) break;
            const data = JSON.parse(r.data);
            if (!Array.isArray(data) || data.length === 0) break;
            for (const p of data) {
                const images = (p.images || []).map(i => i.src || i.thumbnail).filter(Boolean);
                const minorUnit = p.prices?.currency_minor_unit || 2;
                const priceVal = p.prices?.price ? parseInt(p.prices.price) / Math.pow(10, minorUnit) : 0;
                products.push({
                    name: cleanHtml(p.name || ''),
                    price: priceVal ? `$${priceVal.toFixed(2)} ${p.prices?.currency_code || ''}`.trim() : '',
                    priceRaw: priceVal,
                    image: images[0] || '',
                    images,
                    description: cleanHtml(p.short_description || p.description || ''),
                    category: (p.categories || []).map(c => c.name).join(', ') || 'General',
                    url: p.permalink || `${baseUrl}/?p=${p.id}`,
                    sku: p.sku || '',
                    inStock: p.is_in_stock !== false,
                });
            }
            logs.push({ msg: `${products.length} products so far`, type: 'ok' });
            if (data.length < 100) break;
            page++;
        } catch (e) { break; }
    }
    return products;
}

async function crawlWordPressREST(baseUrl, logs) {
    const products = [];
    let page = 1;
    while (true) {
        try {
            logs.push({ msg: `Fetching WP REST page ${page}...`, type: 'info' });
            const r = await fetchUrl(`${baseUrl}/wp-json/wp/v2/product?per_page=100&page=${page}&_embed`);
            if (r.status !== 200) break;
            const data = JSON.parse(r.data);
            if (!Array.isArray(data) || data.length === 0) break;
            for (const p of data) {
                let image = '';
                if (p._embedded?.['wp:featuredmedia']?.[0]?.source_url) image = p._embedded['wp:featuredmedia'][0].source_url;
                if (!image && p.content?.rendered) { const m = p.content.rendered.match(/<img[^>]+src="([^"]+)"/); if (m) image = m[1]; }
                products.push({
                    name: cleanHtml(p.title?.rendered || ''),
                    price: '', priceRaw: 0,
                    image, images: image ? [image] : [],
                    description: cleanHtml(p.excerpt?.rendered || ''),
                    category: 'General',
                    url: p.link || '',
                    inStock: true,
                });
            }
            logs.push({ msg: `${products.length} products so far`, type: 'ok' });
            if (data.length < 100) break;
            page++;
        } catch (e) { break; }
    }
    return products;
}

async function crawlShopify(baseUrl, logs) {
    const products = [];
    let page = 1;
    while (true) {
        try {
            logs.push({ msg: `Fetching Shopify page ${page}...`, type: 'info' });
            const r = await fetchUrl(`${baseUrl}/products.json?limit=250&page=${page}`);
            if (r.status !== 200) break;
            const data = JSON.parse(r.data);
            if (!data.products || data.products.length === 0) break;
            for (const p of data.products) {
                const variant = p.variants?.[0] || {};
                const image = p.images?.[0]?.src || p.image?.src || '';
                products.push({
                    name: p.title || '',
                    price: variant.price ? `$${parseFloat(variant.price).toFixed(2)}` : '',
                    priceRaw: variant.price ? parseFloat(variant.price) : 0,
                    image,
                    images: (p.images || []).map(i => i.src).filter(Boolean),
                    description: cleanHtml(p.body_html || ''),
                    category: p.product_type || 'General',
                    url: `${baseUrl}/products/${p.handle}`,
                    sku: variant.sku || '',
                    inStock: variant.available !== false,
                    vendor: p.vendor || '',
                    tags: p.tags || [],
                });
            }
            logs.push({ msg: `${products.length} Shopify products extracted`, type: 'ok' });
            if (data.products.length < 250) break;
            page++;
        } catch (e) { break; }
    }
    return products;
}

async function crawlNextJS(baseUrl, html, logs) {
    const products = [];
    try {
        const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
        if (!match) { logs.push({ msg: `No __NEXT_DATA__ found`, type: 'warn' }); return products; }

        const nextData = JSON.parse(match[1]);
        logs.push({ msg: `__NEXT_DATA__ parsed`, type: 'ok' });

        const arrays = [];
        function findArrays(obj, depth = 0) {
            if (depth > 6 || !obj) return;
            if (Array.isArray(obj) && obj.length > 0 && typeof obj[0] === 'object' && (obj[0].title || obj[0].name || obj[0].handle)) {
                arrays.push(obj);
            }
            if (typeof obj === 'object' && !Array.isArray(obj)) {
                for (const k of Object.keys(obj)) findArrays(obj[k], depth + 1);
            }
        }
        findArrays(nextData?.props?.pageProps);
        if (arrays.length === 0) findArrays(nextData);

        if (arrays.length > 0) {
            const arr = arrays.sort((a, b) => b.length - a.length)[0];
            logs.push({ msg: `Found ${arr.length} items in __NEXT_DATA__`, type: 'ok' });
            for (const p of arr) {
                const name = p.title || p.name || '';
                if (!name) continue;
                const price = p.price || p.priceRange?.minVariantPrice?.amount || p.variants?.[0]?.price || '';
                const img = typeof p.image === 'string' ? p.image : (p.image?.src || p.images?.[0]?.src || p.featured_image || p.imageUrl || '');
                products.push({
                    name,
                    price: price ? `$${parseFloat(price).toFixed(2)}` : '',
                    priceRaw: price ? parseFloat(price) : 0,
                    image: img,
                    images: (p.images || []).map(i => typeof i === 'string' ? i : (i.src || '')).filter(Boolean),
                    description: cleanHtml(p.description || p.body_html || ''),
                    category: p.product_type || p.category || p.type || 'General',
                    url: p.handle ? `${baseUrl}/products/${p.handle}` : (p.url || baseUrl),
                    inStock: true,
                    tags: p.tags || [],
                });
            }
        }

        // If no products yet, crawl subpages
        if (products.length === 0) {
            const catLinks = new Set();
            const re = /href="(\/(?:collections|categories|shop|products)[^"]*?)"/g;
            let m2;
            while ((m2 = re.exec(html)) !== null) catLinks.add(m2[1]);
            
            for (const link of [...catLinks].slice(0, 8)) {
                try {
                    logs.push({ msg: `Crawling ${link}...`, type: 'info' });
                    const r = await fetchUrl(`${baseUrl}${link}`);
                    if (r.status === 200 && r.data.includes('__NEXT_DATA__')) {
                        const m3 = r.data.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
                        if (m3) {
                            const nd3 = JSON.parse(m3[1]);
                            const sub = [];
                            function findSub(obj, d = 0) {
                                if (d > 5 || !obj) return;
                                if (Array.isArray(obj) && obj.length > 0 && obj[0]?.title) sub.push(obj);
                                if (typeof obj === 'object' && !Array.isArray(obj)) for (const k of Object.keys(obj)) findSub(obj[k], d+1);
                            }
                            findSub(nd3?.props?.pageProps);
                            for (const a of sub) {
                                for (const p of a) {
                                    const nm = p.title || p.name || '';
                                    if (nm && !products.find(x => x.name === nm)) {
                                        products.push({
                                            name: nm,
                                            price: p.price ? `$${parseFloat(p.price).toFixed(2)}` : '',
                                            priceRaw: p.price ? parseFloat(p.price) : 0,
                                            image: p.image?.src || p.featured_image || '',
                                            images: [],
                                            description: cleanHtml(p.description || ''),
                                            category: p.product_type || p.category || 'General',
                                            url: p.handle ? `${baseUrl}/products/${p.handle}` : baseUrl,
                                            inStock: true,
                                        });
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {}
            }
        }
    } catch (e) {
        logs.push({ msg: `__NEXT_DATA__ error: ${e.message}`, type: 'warn' });
    }
    return products;
}

async function crawlGenericHTML(baseUrl, html, logs) {
    const products = [];
    try {
        // JSON-LD
        const jsonLdMatches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
        for (const m of jsonLdMatches) {
            try {
                const ld = JSON.parse(m[1]);
                const items = Array.isArray(ld) ? ld : [ld];
                for (const item of items) {
                    if (item['@type'] === 'Product') {
                        products.push({
                            name: item.name || '', price: item.offers?.price ? `$${item.offers.price}` : '', priceRaw: parseFloat(item.offers?.price) || 0,
                            image: typeof item.image === 'string' ? item.image : (item.image?.[0] || ''), images: [],
                            description: cleanHtml(item.description || ''), category: item.category || 'General', url: item.url || baseUrl, inStock: true,
                        });
                    }
                    if (item.itemListElement) {
                        for (const li of item.itemListElement) {
                            const p = li.item || li;
                            if (p.name) products.push({
                                name: p.name, price: p.offers?.price ? `$${p.offers.price}` : '', priceRaw: parseFloat(p.offers?.price) || 0,
                                image: typeof p.image === 'string' ? p.image : '', images: [],
                                description: cleanHtml(p.description || ''), category: 'General', url: p.url || baseUrl, inStock: true,
                            });
                        }
                    }
                }
            } catch (e) {}
        }
        if (products.length > 0) { logs.push({ msg: `Found ${products.length} products via JSON-LD`, type: 'ok' }); return products; }

        // Cheerio HTML scraping
        const cheerio = require('cheerio');
        const $ = cheerio.load(html);
        const selectors = ['.product-card','.product-item','.product','[data-product]','.wc-block-grid__product','.grid-item','.collection-product','.product-tile'];
        for (const sel of selectors) {
            $(sel).each((i, el) => {
                const $el = $(el);
                const name = $el.find('h2,h3,h4,.product-title,.product-name,[class*="title"],[class*="name"]').first().text().trim();
                const price = $el.find('.price,.product-price,[class*="price"]').first().text().trim();
                let img = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src') || '';
                const link = $el.find('a').first().attr('href') || '';
                if (name) {
                    if (img.startsWith('//')) img = 'https:' + img;
                    else if (img.startsWith('/')) img = baseUrl + img;
                    const fullUrl = link.startsWith('http') ? link : (link.startsWith('/') ? `${baseUrl}${link}` : `${baseUrl}/${link}`);
                    products.push({ name, price, priceRaw: 0, image: img, images: [], description: '', category: 'General', url: fullUrl, inStock: true });
                }
            });
            if (products.length > 0) break;
        }
        if (products.length > 0) logs.push({ msg: `Scraped ${products.length} products from HTML`, type: 'ok' });
        else logs.push({ msg: `No products found via HTML scraping`, type: 'warn' });
    } catch (e) { logs.push({ msg: `Scrape error: ${e.message}`, type: 'warn' }); }
    return products;
}

// ─── Extract store metadata ───
async function extractStoreMeta(baseUrl, html) {
    const meta = { name: '', favicon: '', description: '', color: '#8b5cf6' };
    try {
        if (!html) { const r = await fetchUrl(baseUrl); if (r.status === 200) html = r.data; }
        if (!html) return meta;
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch) meta.name = titleMatch[1].split(/[|\-–—]/)[0].trim();
        const favMatch = html.match(/<link[^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]+href=["']([^"']+)["']/i)
            || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["']/i);
        if (favMatch) { let f = favMatch[1]; if (f.startsWith('//')) f = 'https:' + f; else if (f.startsWith('/')) f = baseUrl + f; meta.favicon = f; }
        const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
        if (descMatch) meta.description = descMatch[1];
        const themeMatch = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i);
        if (themeMatch) meta.color = themeMatch[1];
    } catch (e) {}
    if (!meta.name) {
        try { const u = new URL(baseUrl); meta.name = u.hostname.replace('www.','').split('.')[0]; meta.name = meta.name.charAt(0).toUpperCase() + meta.name.slice(1); }
        catch(e) { meta.name = 'Store'; }
    }
    return meta;
}

// ═══════════════════════════════════
// API ROUTES
// ═══════════════════════════════════

// POST /api/crawl — Main crawl endpoint
app.post('/api/crawl', async (req, res) => {
    let { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    if (!url.startsWith('http')) url = 'https://' + url;
    url = url.replace(/\/+$/, '');

    const domain = (() => { try { return new URL(url).hostname.replace('www.',''); } catch(e) { return 'unknown'; } })();
    console.log(`\n🕷️  Crawling: ${url} (${domain})`);

    const logs = [];
    logs.push({ msg: `Starting crawl of ${url}`, type: 'info' });

    try {
        // Detect platform
        const detection = await detectPlatform(url);
        logs.push(...detection.logs);

        // Crawl based on platform
        let products = [];
        switch (detection.platform) {
            case 'wordpress-store-api':
                products = await crawlWordPressStoreAPI(url, logs);
                break;
            case 'wordpress-rest':
                products = await crawlWordPressREST(url, logs);
                if (products.length === 0 || !products[0]?.price) {
                    const sp = await crawlWordPressStoreAPI(url, logs);
                    if (sp.length > 0) products = sp;
                }
                break;
            case 'wordpress-html':
                products = await crawlWordPressStoreAPI(url, logs);
                if (products.length === 0) products = await crawlWordPressREST(url, logs);
                if (products.length === 0) products = await crawlGenericHTML(url, detection.html, logs);
                break;
            case 'shopify':
                products = await crawlShopify(url, logs);
                break;
            case 'shopify-html':
                products = await crawlShopify(url, logs);
                if (products.length === 0) products = await crawlGenericHTML(url, detection.html, logs);
                break;
            case 'nextjs':
                products = await crawlNextJS(url, detection.html, logs);
                if (products.length === 0) products = await crawlGenericHTML(url, detection.html, logs);
                break;
            default:
                if (detection.html) products = await crawlGenericHTML(url, detection.html, logs);
                break;
        }

        // Extract store metadata
        const meta = await extractStoreMeta(url, detection.html);
        logs.push({ msg: `Store: ${meta.name}`, type: 'ok' });

        // Get categories
        const categories = [...new Set(products.map(p => p.category).filter(c => c && c !== 'General'))];

        // Build store data
        const storeData = {
            domain,
            url,
            platform: detection.platform,
            meta,
            categories,
            productCount: products.length,
            crawledAt: new Date().toISOString(),
            products,
        };

        // Save to file
        const filePath = path.join(STORES_DIR, `${domain}.json`);
        fs.writeFileSync(filePath, JSON.stringify(storeData, null, 2));
        logs.push({ msg: `Saved ${products.length} products to stores/${domain}.json`, type: 'ok' });

        console.log(`✅ ${domain}: ${products.length} products, ${categories.length} categories`);

        res.json({
            success: true,
            domain,
            storeName: meta.name,
            platform: detection.platform,
            productCount: products.length,
            categories,
            chatUrl: `/chat/${domain}`,
            logs,
        });

    } catch (e) {
        console.error(`❌ Crawl error:`, e);
        logs.push({ msg: `Error: ${e.message}`, type: 'error' });
        res.status(500).json({ success: false, error: e.message, logs });
    }
});

// GET /api/products/:domain — Serve store products
app.get('/api/products/:domain', (req, res) => {
    const filePath = path.join(STORES_DIR, `${req.params.domain}.json`);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Store not found' });
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: 'Failed to read store data' });
    }
});

// GET /api/stores — List all crawled stores
app.get('/api/stores', (req, res) => {
    try {
        const files = fs.readdirSync(STORES_DIR).filter(f => f.endsWith('.json'));
        const stores = files.map(f => {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(STORES_DIR, f), 'utf-8'));
                return { domain: data.domain, name: data.meta?.name, productCount: data.productCount, platform: data.platform, crawledAt: data.crawledAt };
            } catch (e) { return null; }
        }).filter(Boolean);
        res.json(stores);
    } catch (e) { res.json([]); }
});

// GET /chat/:domain — Serve dynamic chatbot page
app.get('/chat/:domain', (req, res) => {
    const filePath = path.join(STORES_DIR, `${req.params.domain}.json`);
    if (!fs.existsSync(filePath)) return res.status(404).send('Store not found. Crawl it first via /api/crawl');
    res.sendFile(path.join(__dirname, 'chat.html'));
});

// Static files (serve after API routes)
app.use(express.static(__dirname));

app.listen(PORT, () => {
    console.log(`\n🐾 ClawCommerce server running on port ${PORT}`);
    console.log(`   Landing page: http://localhost:${PORT}/landing.html`);
    console.log(`   API crawl:    POST http://localhost:${PORT}/api/crawl`);
    console.log(`   Stores:       GET  http://localhost:${PORT}/api/stores\n`);
});
