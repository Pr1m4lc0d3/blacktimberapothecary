/* Coherence + compliance check for blacktimberapothecary.com
   Run: node tools/check.mjs   (from site/)

   The HTML carries baked values so the pages work without JS and are readable by
   crawlers. data/product.json stays the single source of truth. This script is what
   keeps those two honest with each other. Exits non-zero on any failure. */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const data = JSON.parse(readFileSync(join(root, 'data/product.json'), 'utf8'));
const p = data.products.buckshot;
const pr = data.pricing;

/* Root pages plus the Journal.
   ⚠ This used to be readdirSync(root) alone, which meant every blog article
   bypassed the compliance gate completely — no FDA disclaimer check, no medical
   claim verbs, no price check. That is exactly backwards: long-form herb writing
   is far likelier to reach for "remedy" or "treats" than a four-page brochure is.
   Added 2026-09-07 when the Journal shipped. */
const pages = [
  ...readdirSync(root).filter(f => f.endsWith('.html')),
  ...(existsSync(join(root, 'blog'))
      ? readdirSync(join(root, 'blog'))
          .filter(f => f.endsWith('.html'))
          .map(f => join('blog', f))
      : []),
];
const fails = [];
const fail = (page, msg) => fails.push(`${page}: ${msg}`);

/* Every dollar figure printed anywhere must be one the data file authorises. */
const allowed = new Set([
  p.msrp,
  ...pr.tiers.map(t => t.perPackage),
  ...pr.tiers.map(t => t.perCase),
]);

/* House style: no AI vocabulary (only "advanced technology" is allowed), no "science" claim,
   no plural-agent framings. Machines are real blending equipment only. */
const bannedWords = [
  /\bcouncil\b/i, /\bagents\b/i,
  /* ⚠ Was /\bdeliberat/i, which also banned "deliberately" and "deliberate" —
     ordinary words that never appeared in four brochure pages and appear
     constantly in long-form writing. The provenance risk is the noun sense
     (a council deliberating), so match that and let the adverb through. */
  /\bdeliberation/i, /\bdeliberative\b/i,
  /\bAI\b/, /artificial intelligence/i, /\bscien/i,
  /no machine/i, /didn't taste/i,
];

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

  /* No phone number and no street address, anywhere, on any page.
     design.md has always said contact is a form and nothing else. Since
     2026-09-07 there is a second reason: the owner's real address and mobile
     were written down for the Google Business Profile, which is a service-area
     listing where Google hides the address. A stray paste from that file into a
     page would publish both, and this repo is public.

     These patterns are deliberately GENERIC. Matching the literal number would
     mean storing the literal number in a public repository, which is the thing
     being prevented. Shape only — the guard leaks nothing. */
  const phoneRe = /(?:\+?1[-.\s])?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g;
  for (const m of text.matchAll(phoneRe)) {
    fail(page, `phone number in page source: ${m[0]} — contact is the form only`);
  }

  const streetRe = /\b\d{2,5}\s+(?:[NSEW]\.?|North|South|East|West)?\s*[A-Z][a-z]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Main|Way|Court|Ct)\b/g;
  for (const m of text.matchAll(streetRe)) {
    fail(page, `street address in page source: "${m[0]}" — the site publishes locality only`);
  }

  for (const re of bannedWords) {
    const hit = text.match(re);
    if (hit) fail(page, `banned provenance word "${hit[0]}" — see design.md Provenance rules`);
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
