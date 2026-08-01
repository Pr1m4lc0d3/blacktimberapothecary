/* Coherence + compliance check for blacktimberapothecary.com
   Run: node tools/check.mjs   (from site/)

   The HTML carries baked values so the pages work without JS and are readable by
   crawlers. data/product.json stays the single source of truth. This script is what
   keeps those two honest with each other. Exits non-zero on any failure. */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const data = JSON.parse(readFileSync(join(root, 'data/product.json'), 'utf8'));
const p = data.products.buckshot;
const pr = data.pricing;

const pages = readdirSync(root).filter(f => f.endsWith('.html'));
const fails = [];
const fail = (page, msg) => fails.push(`${page}: ${msg}`);

/* Every dollar figure printed anywhere must be one the data file authorises. */
const allowed = new Set([
  p.msrp,
  ...pr.tiers.map(t => t.perPackage),
  ...pr.tiers.map(t => t.perCase),
]);

/* House style: the provenance copy describes a single specialist. Plural framings drift. */
const bannedWords = [/\bcouncil\b/i, /\bagents\b/i, /\bdeliberat/i];

/* No contact address may appear in page source, on any page. */
const emailRe = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

for (const page of pages) {
  const html = readFileSync(join(root, page), 'utf8');
  const text = html.replace(/<!--[\s\S]*?-->/g, '');

  for (const m of text.matchAll(/\$(\d+(?:\.\d{2})?)\b/g)) {
    const v = Number(m[1]);
    if (!allowed.has(v)) fail(page, `unauthorised price $${m[1]} — not in product.json`);
  }

  for (const m of text.matchAll(/(\d+)\s*(?:free\s+)?(?:compostable\s+)?tea\s?bags/gi)) {
    if (Number(m[1]) !== p.teabagsIncluded) {
      fail(page, `teabag count ${m[1]} ≠ product.json (${p.teabagsIncluded})`);
    }
  }

  for (const m of text.matchAll(emailRe)) {
    fail(page, `email address in page source: ${m[0]}`);
  }

  for (const re of bannedWords) {
    const hit = text.match(re);
    if (hit) fail(page, `banned provenance word "${hit[0]}" — it was one specialist`);
  }

  for (const bad of [/\bLLC\b/, /\bInc\.?\b/, /®/, /™/]) {
    if (bad.test(text)) fail(page, `entity marker ${bad} — not part of the current brand mark`);
  }

  /* The required disclaimer must itself say "treat, cure" — scan the copy around it, not it. */
  const body = text.replace(/<p class="disclaimer">[\s\S]*?<\/p>/g, '');
  for (const bad of [/\bcures?\b/i, /\btreats?\b/i, /\bheals?\b/i, /\bremed(y|ies)\b/i]) {
    if (bad.test(body)) fail(page, `medical claim verb ${bad} — not permitted on an herbal product`);
  }

  if (!/not intended to diagnose, treat, cure, or prevent any disease/i.test(html)) {
    fail(page, 'missing FDA disclaimer in footer');
  }
}

/* Wholesale page must print every tier exactly as the data file has it. */
const wholesale = readFileSync(join(root, 'wholesale.html'), 'utf8');
for (const t of pr.tiers) {
  if (!wholesale.includes(`$${t.perPackage}`) || !wholesale.includes(`$${t.perCase}`)) {
    fail('wholesale.html', `tier ${t.label} missing $${t.perPackage}/pkg or $${t.perCase}/case`);
  }
}
if (!wholesale.includes(pr.leadTime)) fail('wholesale.html', `lead time "${pr.leadTime}" missing`);
if (!wholesale.includes(`${pr.retailerMarginPct}%`)) fail('wholesale.html', 'retailer margin missing');

/* A case must stay self-consistent: 8 × 2 oz = 16 oz = 1 lb. */
const ozPerPackage = parseFloat(p.netWeight);
if (pr.case.packages * ozPerPackage !== pr.case.weightLb * 16) {
  fails.push(`data: case is ${pr.case.packages} × ${ozPerPackage} oz but claims ${pr.case.weightLb} lb`);
}
for (const t of pr.tiers) {
  if (t.perPackage * pr.case.packages !== t.perCase) {
    fails.push(`data: tier ${t.label} — $${t.perPackage} × ${pr.case.packages} ≠ $${t.perCase}`);
  }
}

if (fails.length) {
  console.error(`\n✗ ${fails.length} problem(s):\n`);
  for (const f of fails) console.error('  ' + f);
  process.exit(1);
}
console.log(`✓ ${pages.length} pages clean — prices, teabag count, contact, provenance, compliance.`);
