const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const siteUrl = "https://www.home-made.co.za";
const effectiveDate = "2 June 2026";

function shell({ title, description, slug, content }) {
  const canonical = `${siteUrl}/${slug}`;
  return `<!DOCTYPE html>
<html lang="en-ZA">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="theme-color" content="#D96A1D"/>
  <meta name="description" content="${description}"/>
  <meta name="robots" content="index,follow"/>
  <link rel="canonical" href="${canonical}"/>
  <link rel="icon" type="image/png" sizes="48x48" href="/icons/icon-48.png"/>
  <title>${title} | Home-Made</title>
  <style>
    :root{--bg:#f7f1e8;--surface:#fffdf9;--line:#e8ddd1;--text:#2e1c12;--muted:#765f52;--accent:#c95616;--warn:#fff8e1}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.65 Arial,sans-serif}a{color:var(--accent)}header,footer{background:var(--surface);border-bottom:1px solid var(--line)}footer{border-top:1px solid var(--line);border-bottom:0;padding:22px;text-align:center;color:var(--muted);font-size:13px}.nav{max-width:980px;margin:auto;padding:12px 20px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}.brand{display:flex;gap:9px;align-items:center;text-decoration:none;color:var(--text);font-weight:800}.brand img{display:block;width:220px;max-width:58vw;height:54px;object-fit:contain;object-position:left center}.links{margin-left:auto;display:flex;gap:12px;flex-wrap:wrap}.links a{font-size:13px;font-weight:700;text-decoration:none}main{max-width:860px;margin:auto;padding:38px 20px 60px}h1,h2{font-family:Georgia,serif;line-height:1.15}h1{font-size:clamp(32px,6vw,50px);margin:0 0 10px}h2{font-size:22px;margin:32px 0 8px}.lead{color:var(--muted);font-size:17px}.notice{background:var(--warn);border:1px solid #ead087;border-radius:8px;padding:13px 15px;margin:20px 0;color:#644b00}.toc{display:flex;gap:8px;flex-wrap:wrap;margin:20px 0}.toc a{background:var(--surface);border:1px solid var(--line);border-radius:5px;padding:6px 9px;font-size:13px;font-weight:700;text-decoration:none}ul{padding-left:20px}li{margin:5px 0}.small{color:var(--muted);font-size:13px}
  </style>
</head>
<body>
  <header><nav class="nav" aria-label="Primary"><a class="brand" href="/"><img src="/icons/home-made-desktop-logo.jpeg" alt="Home-Made"/></a><div class="links"><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/legal">Legal notices</a><a href="/">Open app</a></div></nav></header>
  <main>${content}</main>
  <footer>&copy; 2026 Home-Made. All rights reserved. &middot; <a href="/terms">Terms</a> &middot; <a href="/privacy">Privacy</a> &middot; <a href="/legal">Legal notices</a></footer>
</body>
</html>`;
}

function write(slug, title, description, content) {
  fs.writeFileSync(path.join(publicDir, `${slug}.html`), shell({ title, description, slug, content }), "utf8");
}

function buildLegalPages() {
  fs.mkdirSync(publicDir, { recursive: true });
  const draft = `<div class="notice"><strong>Testing-phase notice:</strong> These notices are an operational draft based on the current platform model. They must be reviewed by a qualified South African legal practitioner before commercial launch.</div>`;
  const toc = `<div class="toc"><a href="/terms">Terms of use</a><a href="/privacy">Privacy notice</a><a href="/legal">Legal notices</a></div>`;

  write("terms", "Terms of Use", "Terms governing use of the Home-Made marketplace by buyers and sellers.", `
    <h1>Terms of Use</h1><p class="lead">Effective ${effectiveDate}. Home-Made connects independent home-food sellers with buyers. Please read these terms before using the platform.</p>${draft}${toc}
    <h2>1. Platform role</h2><p>Home-Made is a technology intermediary. We do not prepare, inspect, package, store, deliver, or sell food and we are not a party to transactions between buyers and sellers.</p>
    <h2>2. Eligibility and accounts</h2><p>You must be at least 18 years old to create an account or transact. Information supplied must be accurate and current. You are responsible for activity under your account.</p>
    <h2>3. Buyer terms</h2><p>Food is prepared by independent sellers. Confirm ingredients, allergens, availability, collection or delivery arrangements, price, payment terms, and refund terms directly with the seller before ordering. An order is confirmed only when the seller accepts it.</p>
    <h2>4. Seller terms</h2><p>Sellers are responsible for lawful operation, permits or certificates where required, accurate listings, safe food handling, hygiene, pricing, availability, ingredient and allergen disclosure, and any claimed certification. Sellers offering catering are responsible for any additional event requirements.</p><p><strong>Launch action required:</strong> paid seller-tier billing, cancellation, and refund terms must be finalised before paid subscriptions are activated.</p>
    <h2>5. WhatsApp orders and payments</h2><p>WhatsApp enquiries, messages, and order codes are provided for convenience. They are not proof of payment or guaranteed fulfilment. Home-Made does not currently process payments. Do not send card details, banking passwords, or one-time PINs through WhatsApp.</p>
    <h2>6. Consumer rights</h2><p>Nothing in these terms limits rights that apply under South African consumer law, including the Consumer Protection Act 68 of 2008.</p>
    <h2>7. Prohibited use</h2><ul><li>No unlawful, misleading, fraudulent, or unsafe listings.</li><li>No harassment, false reviews, scraping, security interference, or impersonation.</li><li>No misrepresentation of ingredients, origin, allergens, safety, or certifications.</li></ul>
    <h2>8. Liability</h2><p>To the fullest extent permitted by law, Home-Made is not liable for food quality, illness, injury, delivery, payment disputes, third-party services, user content, or indirect losses. Rights that cannot lawfully be excluded remain unaffected.</p>
    <h2>9. Governing law</h2><p>These terms are governed by the laws of the Republic of South Africa. Material amendments will be published with an updated effective date.</p>`);

  write("privacy", "Privacy Notice", "Privacy notice for users of the Home-Made marketplace under South African data-protection law.", `
    <h1>Privacy Notice</h1><p class="lead">Effective ${effectiveDate}. This notice explains how Home-Made processes personal information under the Protection of Personal Information Act 4 of 2013 (POPIA).</p>${draft}${toc}
    <div class="notice"><strong>Launch action required:</strong> The appointed Information Officer's name, contact details, and the final POPIA request channel must be published here before launch.</div>
    <h2>1. Information collected</h2><ul><li>Account information such as name, email address, and phone number.</li><li>Seller profile, suburb, order, preference, and listing information.</li><li>Messages sent through the platform inbox and technical usage information needed to operate and secure the service.</li><li>Exact collection or delivery details only where supplied for fulfilment. Public storefront pages show an area, not a precise address.</li></ul>
    <h2>2. Why it is used</h2><p>We process information to provide accounts, connect buyers and sellers, operate the marketplace, reduce fraud, improve the service, send transactional messages, and comply with legal obligations.</p>
    <h2>3. Sharing</h2><p>We do not sell personal information. Information may be shared with buyers, sellers, hosting and service providers, or authorities only where reasonably necessary or legally required.</p>
    <h2>4. Retention and security</h2><p>Information is retained only as long as reasonably necessary for the purpose collected or as required by law. We use reasonable safeguards, but no online system is completely secure.</p>
    <h2>5. Your rights</h2><p>Subject to applicable law, you may request access, correction, deletion, or objection to processing. You may also complain to the Information Regulator of South Africa through <a href="https://inforegulator.org.za/" rel="nofollow">inforegulator.org.za</a>.</p>
    <h2>6. Local storage and essential cookies</h2><p>The app uses browser storage and similar technologies for essential functions such as sessions, preferences, safety prompts, offline support, and saved items. Any optional analytics or marketing tracking must be disclosed and consented to where required before activation.</p>`);

  write("legal", "Legal Notices", "Copyright, food-safety, WhatsApp, catering, and intellectual-property notices for Home-Made.", `
    <h1>Legal Notices</h1><p class="lead">Effective ${effectiveDate}. Important notices for buyers, sellers, and visitors.</p>${draft}${toc}
    <h2>Copyright and intellectual property</h2><p><strong>Copyright &copy; 2026 Home-Made. All rights reserved.</strong> The Home-Made name, logo, branding, design, software, interface, and original platform content are protected by applicable intellectual-property laws, including the Copyright Act 98 of 1978 and Trade Marks Act 194 of 1993. They may not be copied, modified, republished, framed, scraped, reverse-engineered, or redistributed without written permission.</p>
    <h2>Seller-uploaded content</h2><p>Sellers retain ownership of their photographs, menus, and listing content. By uploading content, a seller grants Home-Made a non-exclusive, royalty-free licence to display, reproduce, and distribute that content solely to operate and market the platform. Sellers must upload only content they are authorised to use.</p>
    <h2>Food-safety and allergen disclaimer</h2><p>Home-Made does not inspect, audit, or certify seller kitchens or food. Sellers are responsible for compliance with applicable food-safety laws, including the hygiene requirements in Regulation R638 of 22 June 2018 and obtaining a Certificate of Acceptability where required. Buyers must confirm ingredients and allergen risks directly with sellers, especially when ordering for vulnerable persons. Platform health tags are preference indicators, not medical or nutritional advice.</p>
    <h2>WhatsApp notice</h2><p>WhatsApp is operated by Meta Platforms, Inc. Home-Made is not affiliated with, endorsed by, or sponsored by Meta. WhatsApp messages, order references, and enquiries do not guarantee fulfilment and must not be treated as proof of payment.</p>
    <h2>Catering and events</h2><p>Catering enquiries are preliminary communications. A catering agreement arises only when buyer and seller agree the date, venue, quantity, services, and price. Sellers are responsible for permits, food safety, serving temperatures, delivery, and adequate quantities.</p>
    <h2>Third-party rights</h2><p>Third-party trade marks belong to their respective owners. To report suspected infringement or unlawful content, use the in-app reporting feature while the public legal contact channel is being finalised.</p>`);
}

module.exports = { buildLegalPages };
