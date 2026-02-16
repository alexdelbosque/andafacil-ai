#!/bin/bash
# Build products.json from crawled markdown files
# Reads all .md files in ../products/ and extracts structured data

PRODUCTS_DIR="/root/.openclaw/workspace/andafacil/products"
OUTPUT="/root/.openclaw/workspace/andafacil/web/products.json"

node -e "
const fs = require('fs');
const path = require('path');

const dir = '$PRODUCTS_DIR';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));

const products = [];

for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf-8');
    const lines = content.split('\n');

    const product = { slug: file.replace('.md', '') };

    // Extract fields
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('# ')) {
            product.name = trimmed.replace('# ', '').replace(/®/g, '');
        }
        if (trimmed.startsWith('- **URL:**')) {
            product.url = trimmed.replace('- **URL:**', '').trim();
        }
        if (trimmed.startsWith('- **Precio:**')) {
            product.price = trimmed.replace('- **Precio:**', '').trim().split('(')[0].trim();
        }
        if (trimmed.startsWith('- **Precio regular:**')) {
            product.regularPrice = trimmed.replace('- **Precio regular:**', '').trim();
        }
        if (trimmed.match(/Precio regular:\s*\\\$/)) {
            const m = trimmed.match(/Precio regular:\s*(\\\$[\d,.]+ MXN)/);
            if (m) product.regularPrice = m[1];
        }
        if (trimmed.startsWith('- **Categoría:**')) {
            product.category = trimmed.replace('- **Categoría:**', '').trim();
        }
        if (trimmed.startsWith('- **Disponibilidad:**')) {
            product.availability = trimmed.replace('- **Disponibilidad:**', '').trim();
        }
    }

    // Extract specs from bullet points under Especificaciones
    const specsMatch = content.match(/## Especificaciones.*?\n([\s\S]*?)(?=\n##|\n---|\$)/);
    if (specsMatch) {
        product.specs = specsMatch[1]
            .split('\n')
            .filter(l => l.trim().startsWith('- '))
            .map(l => l.trim().replace(/^- \*\*/, '').replace(/\*\*/g, '').trim())
            .filter(l => l.length > 0)
            .slice(0, 6);
    }

    // Extract first image
    const imgMatch = content.match(/https?:\/\/andafacil\.com\/wp-content\/uploads\/[^\s)\"]+\.(jpg|jpeg|png|webp)/i);
    if (imgMatch) {
        product.image = imgMatch[0];
    }

    // Extract description (first paragraph after Descripción heading)
    const descMatch = content.match(/## Descripción.*?\n\n([\s\S]*?)(?=\n##|\n---)/);
    if (descMatch) {
        product.description = descMatch[1].trim().substring(0, 400).replace(/\n/g, ' ');
    }

    if (product.name) {
        products.push(product);
    }
}

// Sort: main products first, accessories last
products.sort((a, b) => {
    const aIsAcc = a.slug.startsWith('accesorio') || a.slug.startsWith('bateria') || a.slug.startsWith('cargador');
    const bIsAcc = b.slug.startsWith('accesorio') || b.slug.startsWith('bateria') || b.slug.startsWith('cargador');
    if (aIsAcc && !bIsAcc) return 1;
    if (!aIsAcc && bIsAcc) return -1;
    return 0;
});

fs.writeFileSync('$OUTPUT', JSON.stringify(products, null, 2));
console.log('Built products.json with ' + products.length + ' products');
"
