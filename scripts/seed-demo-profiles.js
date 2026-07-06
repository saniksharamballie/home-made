const base = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yemdirpmtqzzduxtgfqh.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const demoPassword = process.env.HM_DEMO_PASSWORD || "HomeMadeDemo!2026";
const demoSellerWhatsApp = String(process.env.DEMO_SELLER_WHATSAPP || "").replace(/\D/g, "");

if (!key) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  Prefer: "return=representation"
};

const buyers = [
  { email: "demo.buyer.ayanda@home-made.co.za", name: "Ayanda Naidoo", phone: "+27820001001" },
  { email: "demo.buyer.lerato@home-made.co.za", name: "Lerato Mkhize", phone: "+27820001002" },
  { email: "demo.buyer.kiran@home-made.co.za", name: "Kiran Pillay", phone: "+27820001003" },
  { email: "demo.buyer.zama@home-made.co.za", name: "Zama Dlamini", phone: "+27820001004" },
  { email: "demo.buyer.michael@home-made.co.za", name: "Michael Jacobs", phone: "+27820001005" }
];

const sellers = [
  {
    email: "demo.seller.thandi@home-made.co.za",
    name: "Thandi's Spice Pot",
    seller: "Thandi",
    region: "Chatsworth",
    category: "indian",
    tier: "platinum",
    wa: demoSellerWhatsApp,
    lat: -29.9061,
    lng: 30.9402,
    data: {
      desc: "Durban curries, bunny chow and breyani cooked from a family spice blend.",
      dietary: ["Halaal"],
      healthTags: ["Mild Spice"],
      del: true,
      fee: 35,
      pu: true,
      rat: 4.9,
      rev: 86,
      ord: "320+",
      e: "🍛",
      img: "/images/home-passion-income.jpeg",
      bg: "linear-gradient(135deg,#FFF0E0,#FFE0C0)",
      ec: "#C44410",
      items: [
        { n: "Mutton Bunny Chow", p: 95, svs: "1 person" },
        { n: "Chicken Breyani", p: 80, svs: "1 person" },
        { n: "Veg Curry & Roti", p: 65, svs: "1 person" }
      ],
      discounts: [{ qty: 4, pct: 10 }, { qty: 8, pct: 15 }],
      cx: { x: 32, y: 72 }
    }
  },
  {
    email: "demo.seller.naledi@home-made.co.za",
    name: "Gogo Naledi's Kitchen",
    seller: "Naledi",
    region: "Umhlanga",
    category: "african",
    tier: "gold",
    wa: demoSellerWhatsApp,
    lat: -29.73,
    lng: 31.08,
    data: {
      desc: "Comforting Sunday plates with samp, beans, chakalaka and slow-cooked stews.",
      dietary: [],
      healthTags: ["High Protein", "Senior-Friendly"],
      del: true,
      fee: 45,
      pu: true,
      rat: 4.8,
      rev: 54,
      ord: "180+",
      e: "🥘",
      img: "/images/home-passion-income.jpeg",
      bg: "linear-gradient(135deg,#F2EAD8,#DDE8C6)",
      ec: "#7A8B52",
      items: [
        { n: "Beef Stew Sunday Plate", p: 90, svs: "1 person" },
        { n: "Samp & Beans Bowl", p: 55, svs: "1 person" },
        { n: "Chakalaka Side", p: 25, svs: "side" }
      ],
      discounts: [{ qty: 5, pct: 10 }],
      cx: { x: 70, y: 20 }
    }
  },
  {
    email: "demo.seller.coastal@home-made.co.za",
    name: "Coastal Curry Cart",
    seller: "Ravi",
    region: "Durban CBD",
    category: "seafood",
    tier: "standard",
    wa: demoSellerWhatsApp,
    lat: -29.862,
    lng: 31.02,
    data: {
      desc: "Seafood curry trays, soft rotis and beach-day family portions.",
      dietary: ["Pescatarian"],
      healthTags: ["High Protein"],
      del: false,
      fee: 0,
      pu: true,
      rat: 4.6,
      rev: 21,
      ord: "45+",
      e: "🦞",
      img: "/images/home-passion-income.jpeg",
      bg: "linear-gradient(135deg,#E8F8FF,#FFEBD4)",
      ec: "#0094C8",
      items: [
        { n: "Prawn Curry & Rice", p: 120, svs: "1 person" },
        { n: "Fish Curry & Roti", p: 95, svs: "1 person" },
        { n: "Family Seafood Tray", p: 420, svs: "4 people" }
      ],
      discounts: [{ qty: 3, pct: 8 }],
      cx: { x: 54, y: 48 }
    }
  },
  {
    email: "demo.seller.lunchbox@home-made.co.za",
    name: "Mama's Lunchbox",
    seller: "Priya",
    region: "Westville",
    category: "street",
    tier: "gold",
    wa: demoSellerWhatsApp,
    lat: -29.833,
    lng: 30.922,
    data: {
      desc: "Weekday lunch packs, school boxes and family-friendly heat-and-eat meals.",
      dietary: ["Vegetarian"],
      healthTags: ["Lunchbox-Friendly", "Kidney-Friendly"],
      del: true,
      fee: 30,
      pu: true,
      rat: 4.7,
      rev: 42,
      ord: "130+",
      e: "🌮",
      img: "/images/home-passion-income.jpeg",
      bg: "linear-gradient(135deg,#FFE4EC,#FFF3D6)",
      ec: "#D96A1D",
      items: [
        { n: "Chicken Wrap Lunchbox", p: 60, svs: "1 person" },
        { n: "Veg Pasta Tub", p: 55, svs: "1 person" },
        { n: "Family Lasagne Tray", p: 260, svs: "4 people" }
      ],
      discounts: [{ qty: 5, pct: 12 }],
      cx: { x: 42, y: 39 }
    }
  },
  {
    email: "demo.seller.sipho@home-made.co.za",
    name: "Sipho's Smokehouse",
    seller: "Sipho",
    region: "Pinetown",
    category: "bbq",
    tier: "platinum",
    wa: demoSellerWhatsApp,
    lat: -29.819,
    lng: 30.867,
    data: {
      desc: "Low-and-slow shisa nyama, sticky ribs and weekend braai packs.",
      dietary: [],
      healthTags: ["High Protein"],
      del: true,
      fee: 50,
      pu: true,
      rat: 5.0,
      rev: 73,
      ord: "260+",
      e: "🍖",
      img: "/images/home-passion-income.jpeg",
      bg: "linear-gradient(135deg,#2E1C12,#7A2E12)",
      ec: "#D48A00",
      items: [
        { n: "Sticky Rib Plate", p: 135, svs: "1 person" },
        { n: "Shisa Nyama Box", p: 110, svs: "1 person" },
        { n: "Weekend Braai Pack", p: 520, svs: "4 people" }
      ],
      discounts: [{ qty: 4, pct: 10 }, { qty: 8, pct: 18 }],
      cx: { x: 24, y: 30 }
    }
  }
];

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, { headers, ...options });
  const text = await response.text();
  if (!response.ok) throw new Error(`${options.method || "GET"} ${path}: ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function getAuthUsers() {
  const response = await fetch(`${base}/auth/v1/admin/users?page=1&per_page=1000`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`GET /auth/v1/admin/users: ${response.status} ${text}`);
  return JSON.parse(text).users || [];
}

async function upsertAuthUser(account, role, users) {
  const existing = users.find((user) => (user.email || "").toLowerCase() === account.email.toLowerCase());
  const body = {
    email: account.email,
    password: demoPassword,
    email_confirm: true,
    user_metadata: { full_name: account.name },
    app_metadata: { role }
  };

  if (existing) {
    const response = await fetch(`${base}/auth/v1/admin/users/${existing.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(body)
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`PUT /auth/v1/admin/users/${existing.id}: ${response.status} ${text}`);
    return JSON.parse(text);
  }

  const response = await fetch(`${base}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`POST /auth/v1/admin/users: ${response.status} ${text}`);
  return JSON.parse(text);
}

async function upsertProfile(user, account, role) {
  return request("/rest/v1/profiles?on_conflict=id", {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      id: user.id,
      email: account.email,
      display_name: account.name,
      role
    })
  });
}

async function upsertBuyers(authByEmail = new Map()) {
  return request("/rest/v1/buyers?on_conflict=email", {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(buyers.map((buyer) => ({
      ...buyer,
      auth_id: authByEmail.get(buyer.email.toLowerCase()) || null
    })))
  });
}

async function upsertSeller(row, authId = null) {
  const existing = await request(`/rest/v1/sellers?select=id&email=eq.${encodeURIComponent(row.email)}&limit=1`);
  if (existing.length) {
    return request(`/rest/v1/sellers?id=eq.${existing[0].id}`, {
      method: "PATCH",
      body: JSON.stringify({ ...row, auth_id: authId, active: true })
    });
  }
  return request("/rest/v1/sellers", {
    method: "POST",
    body: JSON.stringify({ ...row, auth_id: authId, active: true })
  });
}

async function main() {
  const authByEmail = new Map();
  const existingUsers = await getAuthUsers();

  for (const buyer of buyers) {
    const user = await upsertAuthUser(buyer, "buyer", existingUsers);
    authByEmail.set(buyer.email.toLowerCase(), user.id);
    await upsertProfile(user, buyer, "buyer");
  }

  for (const seller of sellers) {
    const user = await upsertAuthUser(seller, "seller", existingUsers);
    authByEmail.set(seller.email.toLowerCase(), user.id);
    await upsertProfile(user, seller, "seller");
  }

  const buyerRows = await upsertBuyers(authByEmail);
  const sellerRows = [];
  for (const seller of sellers) sellerRows.push(await upsertSeller(seller, authByEmail.get(seller.email.toLowerCase())));

  const verifySellers = await request("/rest/v1/sellers?select=id,email,auth_id,name,tier,region&email=like.demo.seller.*&order=email.asc");
  const verifyBuyers = await request("/rest/v1/buyers?select=id,email,auth_id,name&email=like.demo.buyer.*&order=email.asc");
  const verifyProfiles = await request("/rest/v1/profiles?select=email,role&email=like.demo.%&order=email.asc");
  console.log(JSON.stringify({
    demoPassword,
    insertedOrUpdatedBuyers: buyerRows.length,
    insertedOrUpdatedSellers: sellerRows.length,
    verifiedBuyerCount: verifyBuyers.length,
    verifiedSellerCount: verifySellers.length,
    linkedBuyerCount: verifyBuyers.filter((buyer) => buyer.auth_id).length,
    linkedSellerCount: verifySellers.filter((seller) => seller.auth_id).length,
    profileCount: verifyProfiles.length,
    sellers: verifySellers
  }, null, 2));
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
