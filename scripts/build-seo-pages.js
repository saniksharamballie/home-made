const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const demoPath = path.join(root, "src", "seo", "demo-sellers.json");
const siteUrl = "https://www.home-made.co.za";

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function categoryLabel(value) {
  const labels = {
    african: "Traditional African",
    bbq: "Braai and BBQ",
    indian: "Indian Cuisine",
    seafood: "Seafood",
    street: "Street Food"
  };
  return labels[value] || String(value || "Homemade Food").replace(/\b\w/g, (c) => c.toUpperCase());
}

function dataOf(seller) {
  return seller.data && typeof seller.data === "object" ? seller.data : {};
}

function imageUrl(seller) {
  const img = dataOf(seller).img || "/icons/icon-512.png";
  return img.startsWith("http") ? img : `${siteUrl}${img}`;
}

function sellerSlug(seller) {
  return slugify(seller.slug || seller.name);
}

function sellerUrl(seller) {
  return `${siteUrl}/seller/${sellerSlug(seller)}`;
}

function suburbUrl(region) {
  return `${siteUrl}/durban/${slugify(region)}`;
}

function cuisineUrl(category) {
  return `${siteUrl}/cuisine/${slugify(category)}`;
}

function breadcrumbData(items) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  };
}

function pageShell({ title, description, canonical, body, structuredData, image = `${siteUrl}/icons/icon-512.png` }) {
  const jsonLd = structuredData
    ? `<script type="application/ld+json">${JSON.stringify(structuredData).replace(/</g, "\\u003c")}</script>`
    : "";
  return `<!DOCTYPE html>
<html lang="en-ZA">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="theme-color" content="#D96A1D"/>
  <meta name="description" content="${esc(description)}"/>
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1"/>
  <link rel="canonical" href="${esc(canonical)}"/>
  <link rel="icon" type="image/png" sizes="48x48" href="/icons/icon-48.png"/>
  <meta property="og:type" content="website"/>
  <meta property="og:site_name" content="Home-Made"/>
  <meta property="og:title" content="${esc(title)}"/>
  <meta property="og:description" content="${esc(description)}"/>
  <meta property="og:url" content="${esc(canonical)}"/>
  <meta property="og:image" content="${esc(image)}"/>
  <meta property="og:image:alt" content="${esc(title)}"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${esc(title)}"/>
  <meta name="twitter:description" content="${esc(description)}"/>
  <meta name="twitter:image" content="${esc(image)}"/>
  <title>${esc(title)}</title>
  ${jsonLd}
  <style>
    :root{--bg:#f7f1e8;--surface:#fffdf9;--line:#e8ddd1;--text:#2e1c12;--muted:#765f52;--accent:#c95616;--olive:#66763f;--gold:#a87300}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:Arial,sans-serif;line-height:1.55}a{color:inherit}
    header{background:var(--surface);border-bottom:1px solid var(--line)}.nav{max-width:1100px;margin:auto;min-height:72px;padding:10px 20px;display:flex;align-items:center;gap:18px}.brand{display:flex;align-items:center;gap:10px;font-weight:800;text-decoration:none}.brand img{width:48px;height:48px;border-radius:8px}.navlinks{margin-left:auto;display:flex;gap:15px;flex-wrap:wrap}.navlinks a{text-decoration:none;font-size:14px;font-weight:700;color:var(--muted)}
    main{max-width:1100px;margin:auto;padding:36px 20px 64px}.crumbs{font-size:13px;color:var(--muted);margin-bottom:20px}.crumbs a{color:var(--accent)}h1{font-family:Georgia,serif;font-size:clamp(31px,5vw,52px);line-height:1.08;margin:0 0 12px}h2{font-family:Georgia,serif;font-size:25px;margin:34px 0 14px}p{margin:0 0 14px}.lead{max-width:760px;color:var(--muted);font-size:18px}.actions{display:flex;gap:10px;flex-wrap:wrap;margin:24px 0}.btn{display:inline-block;padding:11px 16px;border-radius:6px;text-decoration:none;font-weight:800;border:1px solid var(--accent);background:var(--accent);color:#fff}.btn.alt{background:transparent;color:var(--accent)}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(235px,1fr));gap:14px}.card{background:var(--surface);border:1px solid var(--line);border-radius:8px;overflow:hidden}.card img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}.card-body{padding:15px}.card h2,.card h3{font-family:Georgia,serif;font-size:20px;margin:0 0 7px}.meta{font-size:13px;color:var(--muted)}.tags{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.tag{padding:3px 8px;border-radius:4px;background:#f3e9dc;color:var(--muted);font-size:12px;font-weight:700}.tier{color:var(--gold);text-transform:capitalize;font-weight:800}.list{display:grid;gap:10px}.item{display:flex;justify-content:space-between;gap:20px;padding:13px 0;border-bottom:1px solid var(--line)}.item strong{display:block}.item span{color:var(--muted);font-size:13px}.price{font-weight:800;white-space:nowrap}.links{display:flex;gap:10px;flex-wrap:wrap}.links a{padding:8px 11px;background:var(--surface);border:1px solid var(--line);border-radius:5px;text-decoration:none;font-weight:700;color:var(--accent)}
    .profile{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(260px,.7fr);gap:24px}.hero-img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;border:1px solid var(--line)}aside{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:18px;height:max-content}footer{padding:24px 20px;text-align:center;color:var(--muted);border-top:1px solid var(--line);background:var(--surface);font-size:13px}
    @media(max-width:720px){main{padding-top:26px}.profile{grid-template-columns:1fr}.navlinks{gap:9px}.navlinks a{font-size:12px}}
  </style>
</head>
<body>
  <header><nav class="nav" aria-label="Primary"><a class="brand" href="/"><img src="/icons/icon-96.png" alt="Home-Made logo"/>Home-Made</a><div class="navlinks"><a href="/browse-sellers">Browse sellers</a><a href="/durban">Durban areas</a><a href="/cuisine">Cuisines</a><a href="/markets-events">Markets &amp; events</a><a href="/">Open app</a></div></nav></header>
  ${body}
  <footer>&copy; 2026 Home-Made. All rights reserved. &middot; <a href="/terms">Terms</a> &middot; <a href="/privacy">Privacy</a> &middot; <a href="/legal">Legal notices</a></footer>
</body>
</html>`;
}

function sellerCard(seller) {
  const data = dataOf(seller);
  const tags = [...(data.dietary || []), ...(data.healthTags || [])].slice(0, 3);
  return `<article class="card">
    <a href="/seller/${esc(sellerSlug(seller))}"><img src="${esc(data.img || "/icons/icon-512.png")}" alt="${esc(seller.name)} food preview"/></a>
    <div class="card-body">
      <div class="meta"><span class="tier">${esc(seller.tier)}</span> &middot; ${esc(seller.region)}</div>
      <h3><a href="/seller/${esc(sellerSlug(seller))}">${esc(seller.name)}</a></h3>
      <p class="meta">${esc(data.desc || `Homemade food from ${seller.region}.`)}</p>
      <div class="tags">${tags.map((tag) => `<span class="tag">${esc(tag)}</span>`).join("")}</div>
    </div>
  </article>`;
}

function collectionPage({ title, description, canonical, sellers, intro, links = [], breadcrumbs = [] }) {
  const body = `<main>
    <div class="crumbs"><a href="/">Home</a> / <a href="/browse-sellers">Browse sellers</a>${breadcrumbs.length ? ` / ${esc(breadcrumbs[breadcrumbs.length - 1].name)}` : ""}</div>
    <h1>${esc(title)}</h1>
    <p class="lead">${esc(intro || description)}</p>
    ${links.length ? `<div class="links">${links.map((link) => `<a href="${esc(link.href)}">${esc(link.label)}</a>`).join("")}</div>` : ""}
    <h2>Local kitchens</h2>
    <div class="grid">${sellers.map(sellerCard).join("") || "<p>No kitchens are listed here yet. Please check back soon.</p>"}</div>
  </main>`;
  return pageShell({
    title,
    description,
    canonical,
    body,
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "CollectionPage",
          name: title,
          url: canonical,
          description
        },
        breadcrumbData([
          { name: "Home", url: `${siteUrl}/` },
          { name: "Browse sellers", url: `${siteUrl}/browse-sellers` },
          ...breadcrumbs
        ]),
        {
          "@type": "ItemList",
          name: title,
          itemListElement: sellers.map((seller, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: sellerUrl(seller),
            name: seller.name
          }))
        }
      ]
    }
  });
}

function sellerPage(seller) {
  const data = dataOf(seller);
  const description = data.desc || `Explore homemade food from ${seller.name} in ${seller.region}, Durban.`;
  const tags = [...(data.dietary || []), ...(data.healthTags || [])];
  const items = Array.isArray(data.items) ? data.items : [];
  const whatsApp = String(seller.wa || "").replace(/\D/g, "");
  const url = sellerUrl(seller);
  const body = `<main>
    <div class="crumbs"><a href="/">Home</a> / <a href="/browse-sellers">Browse sellers</a> / ${esc(seller.name)}</div>
    <div class="profile">
      <section>
        <img class="hero-img" src="${esc(data.img || "/icons/icon-512.png")}" alt="${esc(seller.name)} homemade food"/>
        <h1>${esc(seller.name)}</h1>
        <p class="lead">${esc(description)}</p>
        <div class="tags">${tags.map((tag) => `<span class="tag">${esc(tag)}</span>`).join("")}</div>
        <h2>Menu highlights</h2>
        <div class="list">${items.map((item) => `<div class="item"><div><strong>${esc(item.n)}</strong><span>${esc(item.svs || "Homemade serving")}</span></div><div class="price">R${esc(item.p)}</div></div>`).join("") || "<p>Menu details will be added soon.</p>"}</div>
      </section>
      <aside>
        <div class="meta"><span class="tier">${esc(seller.tier)}</span> seller</div>
        <h2>${esc(categoryLabel(seller.category))}</h2>
        <p>Based in ${esc(seller.region)}, Durban. Exact collection details are shared privately when needed.</p>
        <p class="meta">Independent seller listing. Confirm ingredients and allergens directly with the seller. <a href="/legal">Read notices</a>.</p>
        ${data.rat ? `<p><strong>${esc(data.rat)} / 5</strong> from ${esc(data.rev || 0)} reviews</p>` : ""}
        <div class="actions">${whatsApp ? `<a class="btn" href="https://wa.me/${esc(whatsApp)}" rel="nofollow">Chat on WhatsApp</a>` : ""}<a class="btn alt" href="/">Open marketplace</a></div>
        <div class="links"><a href="/durban/${esc(slugify(seller.region))}">More in ${esc(seller.region)}</a><a href="/cuisine/${esc(slugify(seller.category))}">More ${esc(categoryLabel(seller.category))}</a></div>
      </aside>
    </div>
  </main>`;
  const localBusiness = {
    "@context": "https://schema.org",
    "@type": "FoodEstablishment",
    name: seller.name,
    url,
    image: imageUrl(seller),
    description,
    servesCuisine: categoryLabel(seller.category),
    address: {
      "@type": "PostalAddress",
      addressLocality: seller.region,
      addressRegion: "KwaZulu-Natal",
      addressCountry: "ZA"
    }
  };
  if (whatsApp) localBusiness.telephone = `+${whatsApp}`;
  const prices = items.map((item) => Number(item.p)).filter((price) => Number.isFinite(price));
  if (prices.length) {
    localBusiness.priceRange = `R${Math.min(...prices)}-R${Math.max(...prices)}`;
  }
  if (data.seoReviewsVerified === true && data.rat && data.rev) {
    localBusiness.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(data.rat),
      reviewCount: Number(data.rev),
      bestRating: 5
    };
  }
  return pageShell({
    title: `${seller.name} | Homemade Food in ${seller.region} | Home-Made`,
    description,
    canonical: url,
    image: imageUrl(seller),
    body,
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        localBusiness,
        breadcrumbData([
          { name: "Home", url: `${siteUrl}/` },
          { name: "Browse sellers", url: `${siteUrl}/browse-sellers` },
          { name: seller.name, url }
        ])
      ]
    }
  });
}

function writeHtml(relativePath, html) {
  const output = path.join(publicDir, relativePath);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, html, "utf8");
}

function clearGeneratedPages() {
  for (const entry of ["seller", "browse", "categories", "durban", "cuisine"]) {
    fs.rmSync(path.join(publicDir, entry), { recursive: true, force: true });
  }
  for (const entry of ["browse-sellers.html", "markets-events.html", "durban.html", "cuisine.html"]) {
    fs.rmSync(path.join(publicDir, entry), { force: true });
  }
}

async function loadSellers() {
  const fallback = JSON.parse(fs.readFileSync(demoPath, "utf8"));
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) return fallback;
  try {
    const response = await fetch(`${base}/rest/v1/seller_directory?select=*&active=eq.true&order=tier.desc,name.asc`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
    const sellers = await response.json();
    return sellers.length ? sellers : fallback;
  } catch (error) {
    console.warn(`SEO pages: using local seller fallback (${error.message})`);
    return fallback;
  }
}

function sitemapEntry(loc, lastmod, priority = "0.7") {
  return `  <url><loc>${esc(loc)}</loc><lastmod>${esc(lastmod)}</lastmod><priority>${priority}</priority></url>`;
}

async function buildSeoPages() {
  clearGeneratedPages();
  const sellers = await loadSellers();
  const updated = new Date().toISOString().slice(0, 10);
  const suburbs = [...new Set(sellers.map((seller) => seller.region).filter(Boolean))].sort();
  const categories = [...new Set(sellers.map((seller) => seller.category).filter(Boolean))].sort();
  const filters = [
    ...suburbs.map((region) => ({ href: `/durban/${slugify(region)}`, label: region })),
    ...categories.map((category) => ({ href: `/cuisine/${slugify(category)}`, label: categoryLabel(category) }))
  ];

  writeHtml("browse-sellers.html", collectionPage({
    title: "Browse Home Chefs in Durban",
    description: "Explore local home chefs, homemade meals, catering and community food sellers across Durban and eThekwini.",
    canonical: `${siteUrl}/browse-sellers`,
    sellers,
    intro: "Discover homemade food near you. Browse public kitchen profiles by suburb or cuisine, then open the marketplace when you are ready to order.",
    links: filters
  }));

  for (const seller of sellers) {
    writeHtml(path.join("seller", `${sellerSlug(seller)}.html`), sellerPage(seller));
  }

  writeHtml("durban.html", collectionPage({
    title: "Homemade Food Across Durban",
    description: "Browse homemade food, local home chefs and community kitchens by Durban suburb and eThekwini area.",
    canonical: `${siteUrl}/durban`,
    sellers,
    intro: "Explore Durban's independent home kitchens by neighbourhood. Exact collection details remain private and are shared only when needed.",
    links: suburbs.map((region) => ({ href: `/durban/${slugify(region)}`, label: region })),
    breadcrumbs: [{ name: "Durban areas", url: `${siteUrl}/durban` }]
  }));

  for (const region of suburbs) {
    const regionSellers = sellers.filter((seller) => seller.region === region);
    writeHtml(path.join("durban", `${slugify(region)}.html`), collectionPage({
      title: `Home Chefs in ${region}`,
      description: `Browse homemade meals and local food sellers in ${region}, Durban.`,
      canonical: suburbUrl(region),
      sellers: regionSellers,
      intro: `Find independent home chefs and homemade food sellers serving ${region} and nearby Durban communities.`,
      links: categories.map((category) => ({ href: `/cuisine/${slugify(category)}`, label: categoryLabel(category) })),
      breadcrumbs: [{ name: region, url: suburbUrl(region) }]
    }));
  }

  writeHtml("cuisine.html", collectionPage({
    title: "Browse Homemade Food by Cuisine",
    description: "Discover homemade meals in Durban by cuisine, from traditional African food and Indian curries to braai packs, seafood and street food.",
    canonical: `${siteUrl}/cuisine`,
    sellers,
    intro: "Browse Durban home chefs by the kind of food you are craving, then visit a public kitchen profile or open the marketplace to order.",
    links: categories.map((category) => ({ href: `/cuisine/${slugify(category)}`, label: categoryLabel(category) })),
    breadcrumbs: [{ name: "Cuisines", url: `${siteUrl}/cuisine` }]
  }));

  for (const category of categories) {
    const categorySellers = sellers.filter((seller) => seller.category === category);
    writeHtml(path.join("cuisine", `${slugify(category)}.html`), collectionPage({
      title: `${categoryLabel(category)} in Durban`,
      description: `Browse ${categoryLabel(category).toLowerCase()} from local home chefs across Durban and eThekwini.`,
      canonical: cuisineUrl(category),
      sellers: categorySellers,
      intro: `Discover local Durban sellers offering ${categoryLabel(category).toLowerCase()} through the Home-Made marketplace.`,
      links: suburbs.map((region) => ({ href: `/durban/${slugify(region)}`, label: region })),
      breadcrumbs: [{ name: categoryLabel(category), url: cuisineUrl(category) }]
    }));
  }

  writeHtml("markets-events.html", pageShell({
    title: "Durban Food Markets and Events | Home-Made",
    description: "Discover local Durban food markets, weekend pop-ups and community events featuring Home-Made sellers.",
    canonical: `${siteUrl}/markets-events`,
    body: `<main><div class="crumbs"><a href="/">Home</a> / Markets &amp; events</div><h1>Durban Food Markets and Events</h1><p class="lead">Browse community markets, food fairs and weekend pop-ups through the Home-Made marketplace. Event listings will be published here as sellers confirm their dates.</p><div class="actions"><a class="btn" href="/">Explore the live marketplace</a><a class="btn alt" href="/browse-sellers">Browse local sellers</a></div></main>`,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Durban Food Markets and Events",
      url: `${siteUrl}/markets-events`,
      description: "Community markets, food fairs and weekend pop-ups featuring local Home-Made sellers."
    }
  }));

  const urls = [
    sitemapEntry(`${siteUrl}/`, updated, "1.0"),
    sitemapEntry(`${siteUrl}/browse-sellers`, updated, "0.9"),
    sitemapEntry(`${siteUrl}/durban`, updated, "0.9"),
    sitemapEntry(`${siteUrl}/cuisine`, updated, "0.9"),
    sitemapEntry(`${siteUrl}/markets-events`, updated, "0.7"),
    sitemapEntry(`${siteUrl}/terms`, updated, "0.3"),
    sitemapEntry(`${siteUrl}/privacy`, updated, "0.3"),
    sitemapEntry(`${siteUrl}/legal`, updated, "0.3"),
    ...sellers.map((seller) => sitemapEntry(sellerUrl(seller), String(seller.updated_at || updated).slice(0, 10), "0.8")),
    ...suburbs.map((region) => sitemapEntry(suburbUrl(region), updated)),
    ...categories.map((category) => sitemapEntry(cuisineUrl(category), updated))
  ];
  fs.writeFileSync(path.join(publicDir, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`, "utf8");
  console.log(`Built ${sellers.length} seller SEO pages, ${suburbs.length} suburb pages and ${categories.length} category pages`);
}

module.exports = { buildSeoPages };
