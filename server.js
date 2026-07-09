const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const zlib = require("node:zlib");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT || 8080);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_FILE = path.resolve(ROOT, process.env.DATA_FILE || "data/dome-db.json");
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const ADMIN_KEY = process.env.ADMIN_KEY || (IS_PRODUCTION ? "" : "DOMEADMIN");
const SESSION_SECRET = process.env.SESSION_SECRET || (IS_PRODUCTION ? crypto.randomBytes(32).toString("hex") : "change-this-before-production");
const OTP_TTL_MS = 10 * 60 * 1000;
const REVEAL_BUNDLE_PRICE = 500;
const REVEAL_BUNDLE_CREDITS = 5;
const PAYMENT_MODE = process.env.PAYMENT_MODE || "mock";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const categories = [
  "Printer Cartridges",
  "Toner & Ink",
  "IT Hardware",
  "Office Furniture",
  "Housekeeping",
  "Electrical & Lighting",
  "Water Purifiers",
  "Office Supplies"
];

const businesses = [
  {
    id: "printodome",
    type: "OEM",
    name: "PrintoDome",
    initials: "PD",
    category: "Printer Cartridges",
    city: "New Delhi",
    badge: "Anchor OEM",
    rating: 4.8,
    network: "1,300 vendors",
    phone: "+91 98765 41000",
    email: "growth@printodome.in",
    gemUrl: "https://gem.gov.in",
    website: "https://printodome.com",
    callingActiveUntil: "2026-08-07",
    description: "Make-in-India OEM of compatible printer consumables since 2015, known for X-Range compatible colour laser cartridges and institutional support.",
    highlights: ["4,300+ GeM orders", "98% on-time delivery", "400+ catalogue products", "ISO 9001:2015"],
    products: [
      "X-Range Colour Laser Cartridge",
      "Drum Unit DU-220",
      "Inkjet Cartridge IJ-310",
      "Toner Refill Kit TR-5",
      "Office Printer Bundle OPB-100"
    ],
    certifications: ["ISO 9001:2015", "RoHS", "MSME"],
    kits: ["X-Range product brochure", "Sample bid response messages", "Market rate list", "Product images and banners"]
  },
  {
    id: "cleartone",
    type: "OEM",
    name: "ClearTone India",
    initials: "CT",
    category: "Toner & Ink",
    city: "Mumbai",
    rating: 4.5,
    network: "180 vendors",
    phone: "+91 98765 41001",
    email: "partners@cleartone.in",
    gemUrl: "https://gem.gov.in",
    description: "Refill toners and bulk ink systems for high-volume government printing with strong coverage in western India.",
    highlights: ["180 vendors", "West India support", "Bulk ink systems", "Rate-list support"],
    products: ["Bulk toner refill", "Ink tank supplies", "Government-bulk kits"],
    certifications: ["MSME", "ISO process aligned"],
    kits: ["Regional price sheet", "Ink storage guide"]
  },
  {
    id: "novatech",
    type: "OEM",
    name: "NovaTech Systems",
    initials: "NT",
    category: "IT Hardware",
    city: "Bengaluru",
    rating: 4.6,
    network: "420 vendors",
    phone: "+91 98765 41002",
    email: "channel@novatech.in",
    gemUrl: "https://gem.gov.in",
    description: "Laptops, desktops and peripherals with strong PSU and ministry demand across India.",
    highlights: ["420 vendors", "PSU demand", "Pan-India support", "Warranty desk"],
    products: ["Desktop systems", "Laptops", "Peripherals"],
    certifications: ["ISO 9001", "BIS categories"]
  },
  {
    id: "deskcraft",
    type: "OEM",
    name: "DeskCraft",
    initials: "DC",
    category: "Office Furniture",
    city: "Jodhpur",
    rating: 4.3,
    network: "150 vendors",
    email: "sales@deskcraft.in",
    gemUrl: "https://gem.gov.in",
    description: "Modular office furniture and seating built for institutional buyers and bulk fit-outs.",
    highlights: ["Bulk fit-outs", "150 vendors", "Custom modular lines", "Institutional seating"],
    products: ["Office chairs", "Workstations", "Storage units"]
  },
  {
    id: "purespace",
    type: "OEM",
    name: "PureSpace Hygiene",
    initials: "PS",
    category: "Housekeeping",
    city: "Pune",
    rating: 4.4,
    network: "260 vendors",
    email: "gem@purespace.in",
    gemUrl: "https://gem.gov.in",
    description: "Sanitation and housekeeping supplies for government offices, hospitals and PSUs.",
    highlights: ["Hospital supply", "260 vendors", "Consumables", "Rapid dispatch"],
    products: ["Cleaning chemicals", "Sanitation kits", "Housekeeping tools"]
  },
  {
    id: "shyam",
    type: "Vendor",
    name: "Shyam Enterprises",
    initials: "SE",
    category: "Printer Cartridges",
    secondaryCategory: "IT Hardware",
    city: "New Delhi",
    rating: 4.7,
    network: "3 OEM ties",
    phone: "+91 98100 22334",
    email: "sales@shyamenterprises.in",
    gemUrl: "https://gem.gov.in",
    description: "Reseller serving central government buyers in printers, consumables and IT hardware.",
    highlights: ["Central government buyers", "3 active OEM authorizations", "Fast bid response", "North India coverage"],
    authorizedOems: ["printodome", "cleartone", "novatech"],
    certifications: ["GST verified", "GeM seller profile"]
  },
  {
    id: "anand",
    type: "Vendor",
    name: "Anand Infotech",
    initials: "AI",
    category: "IT Hardware",
    secondaryCategory: "Electrical & Lighting",
    city: "Pune",
    rating: 4.6,
    network: "4 OEM ties",
    email: "hello@anandinfotech.in",
    gemUrl: "https://gem.gov.in",
    description: "Active reseller across IT hardware and electrical, strong on GeM bids.",
    highlights: ["IT hardware", "Electrical category", "Maharashtra coverage", "4 OEM ties"],
    authorizedOems: ["novatech"]
  },
  {
    id: "veer",
    type: "Vendor",
    name: "Veer Traders",
    initials: "VT",
    category: "Office Supplies",
    secondaryCategory: "Office Furniture",
    city: "Jaipur",
    rating: 4.4,
    network: "2 OEM ties",
    email: "gem@veertraders.in",
    gemUrl: "https://gem.gov.in",
    description: "Office supplies reseller serving state departments in Rajasthan.",
    highlights: ["State departments", "Rajasthan coverage", "Office supplies", "Furniture add-ons"],
    authorizedOems: ["deskcraft"]
  },
  {
    id: "sai",
    type: "Vendor",
    name: "Sai Distributors",
    initials: "SD",
    category: "Printer Cartridges",
    city: "Ahmedabad",
    rating: 4.6,
    network: "3 OEM ties",
    email: "orders@saidistributors.in",
    gemUrl: "https://gem.gov.in",
    description: "Printer consumables reseller with strong coverage across western India.",
    highlights: ["Western India", "Consumables", "Fast procurement desk", "3 OEM ties"],
    authorizedOems: ["printodome", "cleartone"]
  }
];

const content = {
  guides: [
    { title: "How to register on GeM, step by step", kind: "Guide", minutes: 6, summary: "A practical checklist for new sellers preparing their GeM profile." },
    { title: "Vendor Assessment, explained", kind: "Guide", minutes: 5, summary: "What the QCI assessment is and how to prepare your documents." },
    { title: "OEM authorization for resellers", kind: "Playbook", minutes: 5, summary: "How resellers request, receive and confirm authorization beside GeM." }
  ],
  articles: [
    { title: "Q2 vs Q3/Q4 categories, in plain language", tag: "How-to", summary: "Why authorization differs by category and what resellers should check first." },
    { title: "How a fresher won their first GeM order in 3 weeks", tag: "Story", summary: "From registration to first purchase order, without skipping compliance." },
    { title: "Why an OEM market rate list saves everyone time", tag: "Growth", summary: "Consistent pricing makes vendors faster and bids cleaner." }
  ],
  roadmap: [
    "Real Razorpay/PayU payment capture and GST invoices",
    "Document upload and verification workflow",
    "Live messaging, read status, attachments and notifications",
    "DLT-compliant SMS/WhatsApp alerts",
    "Cloud telephony for masked buyer calls",
    "Hindi and multilingual content"
  ]
};

const webinars = [
  {
    id: "gem-30-days",
    date: "2026-07-28",
    time: "6:00 PM IST",
    host: "PrintoDome",
    title: "Start selling on GeM in 30 days",
    summary: "For freshers and small businesses: register, list and prepare for a first order.",
    fee: 499,
    language: "Hindi + English",
    status: "Upcoming"
  },
  {
    id: "cross-sell-oems",
    date: "2026-08-05",
    time: "6:00 PM IST",
    host: "NovaTech Systems",
    title: "Cross-sell with multiple OEMs",
    summary: "For existing vendors: get authorized by more OEMs and widen your catalogue.",
    fee: 799,
    language: "English",
    status: "Upcoming"
  },
  {
    id: "authorization-right-way",
    date: "2026-06-20",
    time: "Replay",
    host: "PrintoDome",
    title: "Getting OEM authorization the right way",
    summary: "A 32-minute walkthrough of requesting and completing authorization on GeM.",
    fee: 0,
    language: "Hindi + English",
    status: "Replay"
  }
];

const users = [
  { role: "Reseller", email: "vendor@dome.com", password: "vendor123", businessName: "Shyam Enterprises", businessId: "shyam", status: "approved" },
  { role: "OEM", email: "oem@dome.com", password: "oem123", businessName: "PrintoDome", businessId: "printodome", status: "approved" },
  { role: "Buyer", email: "buyer@dome.com", password: "buyer123", businessName: "City Buyer Office", status: "approved" },
  { role: "Admin", email: "admin@dome.com", password: "admin123", businessName: "Dome Admin", status: "approved" }
];

let dbCache;
let dbInitPromise;

async function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const key = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => error ? reject(error) : resolve(derivedKey));
  });
  return `${salt}:${key.toString("hex")}`;
}

async function verifyPassword(password, stored) {
  const [salt] = String(stored || "").split(":");
  if (!salt) return false;
  const candidate = await hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(stored));
}

async function seedDb() {
  const hashedUsers = [];
  for (const user of users) {
    hashedUsers.push({
      id: crypto.randomUUID(),
      role: user.role,
      email: user.email.toLowerCase(),
      phone: user.role === "Admin" ? "+910000000000" : "",
      businessName: user.businessName,
      businessId: user.businessId || "",
      status: user.status,
      passwordHash: await hashPassword(user.password),
      createdAt: new Date().toISOString()
    });
  }

  return {
    meta: { createdAt: new Date().toISOString(), version: 1 },
    businesses,
    categories,
    content,
    webinars,
    users: hashedUsers,
    applications: [
      {
        id: crypto.randomUUID(),
        role: "Vendor",
        businessName: "Metro Supplies",
        city: "Lucknow",
        state: "Uttar Pradesh",
        category: "Office Supplies",
        contactName: "Amit Verma",
        email: "metro@example.in",
        phone: "+919876500100",
        status: "pending",
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        consent: true,
        source: "Prototype seed"
      },
      {
        id: crypto.randomUUID(),
        role: "OEM",
        businessName: "GreenLeaf Stationery",
        city: "Indore",
        state: "Madhya Pradesh",
        category: "Office Supplies",
        contactName: "Neha Jain",
        email: "hello@greenleaf.in",
        phone: "+919876500101",
        status: "pending",
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        consent: true,
        source: "Prototype seed"
      }
    ],
    contacts: [],
    authorizationRequests: [],
    revealPurchases: [],
    revealBundles: [],
    businessProfiles: [
      {
        userEmail: "vendor@dome.com",
        role: "Reseller",
        completion: 100,
        state: "Delhi",
        city: "New Delhi",
        contactPerson: "Shyam Kumar",
        gstNumber: "07ABCDE1234F1Z5",
        gemSellerId: "GEM/2020/B/SHYAM",
        lookingForCategories: ["Printer Cartridges", "IT Hardware"],
        ordersCompleted: 86,
        profileStatus: "verified"
      },
      {
        userEmail: "oem@dome.com",
        role: "OEM",
        completion: 100,
        gstNumber: "07PRINT1234F1Z8",
        ordersCompleted: 4300,
        gemLink: "https://gem.gov.in",
        products: ["X-Range Colour Laser Cartridge", "Drum Unit DU-220", "Inkjet Cartridge IJ-310"],
        contactList: [
          { purpose: "Reseller onboarding", name: "Channel Desk", phone: "+91 98765 41000", email: "growth@printodome.in" },
          { purpose: "Buyer enquiries", name: "Government Sales", phone: "+91 98765 41010", email: "sales@printodome.in" }
        ],
        micrositePaidUntil: "2027-03-31",
        profileStatus: "verified"
      }
    ],
    setupRequests: [],
    webinarRegistrations: [],
    payments: [],
    auditLog: [],
    otps: []
  };
}

function migrateDb(db) {
  db.users ||= [];
  db.applications ||= [];
  db.contacts ||= [];
  db.authorizationRequests ||= [];
  db.revealPurchases ||= [];
  db.revealBundles ||= [];
  db.businessProfiles ||= [];
  db.setupRequests ||= [];
  db.webinarRegistrations ||= [];
  db.payments ||= [];
  db.auditLog ||= [];
  db.otps ||= [];
  for (const user of db.users) {
    if (user.role === "Vendor") user.role = "Reseller";
    user.emailVerified = Boolean(user.emailVerified || user.status === "approved");
    user.phoneVerified = Boolean(user.phoneVerified || user.status === "approved");
  }
  for (const app of db.applications) {
    if (app.role === "Vendor") app.role = "Reseller";
  }
  return db;
}

async function ensureDb() {
  if (dbCache) return dbCache;
  if (dbInitPromise) return dbInitPromise;
  dbInitPromise = (async () => {
    try {
      const raw = await fs.readFile(DATA_FILE, "utf8");
      dbCache = migrateDb(JSON.parse(raw));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      dbCache = migrateDb(await seedDb());
      await saveDb();
    }
    return dbCache;
  })();
  return dbInitPromise;
}

async function saveDb() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  const tmp = `${DATA_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(dbCache, null, 2));
  await fs.rename(tmp, DATA_FILE);
}

function publicBootstrap(db) {
  return {
    businesses: db.businesses,
    categories: db.categories,
    content: db.content,
    webinars: db.webinars,
    config: {
      revealBundlePrice: REVEAL_BUNDLE_PRICE,
      revealBundleCredits: REVEAL_BUNDLE_CREDITS,
      paymentMode: PAYMENT_MODE,
      gstLookupMode: process.env.GST_API_URL ? "provider" : "demo"
    },
    counts: {
      applications: db.applications.length,
      approvedUsers: db.users.filter((user) => user.status === "approved").length,
      contacts: db.contacts.length,
      authorizations: db.authorizationRequests.length
    }
  };
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(body);
}

function send(req, res, status, headers, body) {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const acceptEncoding = req.headers["accept-encoding"] || "";
  const contentType = headers["content-type"] || "";
  const shouldZip = buffer.length > 1024 && /\b(gzip)\b/.test(acceptEncoding) && /^(text\/|application\/json|application\/javascript|image\/svg)/.test(contentType);

  if (!shouldZip) {
    res.writeHead(status, { ...headers, "content-length": buffer.length });
    if (req.method === "HEAD") return res.end();
    return res.end(buffer);
  }

  zlib.gzip(buffer, { level: 6 }, (error, zipped) => {
    if (error) {
      res.writeHead(status, { ...headers, "content-length": buffer.length });
      if (req.method === "HEAD") return res.end();
      return res.end(buffer);
    }
    res.writeHead(status, {
      ...headers,
      "content-encoding": "gzip",
      "content-length": zipped.length,
      vary: "Accept-Encoding"
    });
    if (req.method === "HEAD") return res.end();
    res.end(zipped);
  });
}

function jsonWithReq(req, res, status, payload) {
  send(req, res, status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  }, JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function required(payload, fields) {
  return fields.filter((field) => !String(payload[field] || "").trim());
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

function isPhone(value) {
  return /^\+?[0-9]{10,15}$/.test(String(value || "").replace(/\s+/g, ""));
}

function normalizePhone(value) {
  const compact = String(value || "").replace(/\s+/g, "");
  if (compact.startsWith("+")) return compact;
  if (compact.length === 10) return `+91${compact}`;
  return compact;
}

function validatePassword(value) {
  const text = String(value || "");
  return text.length >= 8 && /[A-Za-z]/.test(text) && /[0-9]/.test(text);
}

function isAdmin(req) {
  if (!ADMIN_KEY) return false;
  return req.headers["x-admin-key"] === ADMIN_KEY;
}

function signToken(user) {
  const payload = {
    id: user.id,
    role: user.role,
    email: user.email,
    businessName: user.businessName,
    businessId: user.businessId || "",
    exp: Date.now() + 1000 * 60 * 60 * 8
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

function verifyToken(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(encoded).digest("base64url");
  if (expected !== sig) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

function cleanUser(user) {
  return {
    id: user.id,
    role: user.role,
    email: user.email,
    phone: user.phone || "",
    emailVerified: Boolean(user.emailVerified),
    phoneVerified: Boolean(user.phoneVerified),
    businessName: user.businessName,
    businessId: user.businessId || "",
    status: user.status,
    profileComplete: Boolean(user.profileComplete)
  };
}

function addAudit(db, actor, action, detail) {
  db.auditLog.unshift({
    id: crypto.randomUUID(),
    actor,
    action,
    detail,
    at: new Date().toISOString()
  });
  db.auditLog = db.auditLog.slice(0, 300);
}

function slugify(value) {
  return String(value || "business")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || crypto.randomUUID().slice(0, 8);
}

function initialsFor(value) {
  const words = String(value || "Dome").trim().split(/\s+/).slice(0, 2);
  return words.map((word) => word[0]?.toUpperCase() || "").join("") || "D";
}

function profileCompletion(role, profile) {
  const checks = role === "OEM"
    ? ["businessName", "gstNumber", "ordersCompleted", "products", "gemLink", "contactList"]
    : role === "Reseller"
      ? ["businessName", "state", "city", "contactPerson", "gstNumber", "gemSellerId", "lookingForCategories", "ordersCompleted"]
      : ["businessName", "contactPerson", "state", "city"];
  const complete = checks.filter((field) => {
    const value = profile[field];
    return Array.isArray(value) ? value.length > 0 : String(value ?? "").trim().length > 0;
  }).length;
  return Math.round((complete / checks.length) * 100);
}

function syncBusinessFromProfile(db, user, profile) {
  if (!["OEM", "Reseller"].includes(profile.role)) return;
  if (profile.role === "OEM" && !profile.micrositePaidUntil) return;
  const id = user.businessId || slugify(profile.businessName);
  let business = db.businesses.find((item) => item.id === id);
  if (!business) {
    business = { id };
    db.businesses.push(business);
  }
  user.businessId = id;
  user.businessName = profile.businessName || user.businessName;
  business.type = profile.role === "Reseller" ? "Vendor" : "OEM";
  business.name = profile.businessName || user.businessName;
  business.initials = initialsFor(business.name);
  business.category = profile.role === "OEM" ? (profile.products?.[0]?.category || profile.primaryCategory || "General") : (profile.lookingForCategories?.[0] || "General");
  business.city = profile.city || business.city || "";
  business.rating = business.rating || 4.2;
  business.network = profile.role === "OEM" ? `${Number(profile.ordersCompleted || 0).toLocaleString("en-IN")} orders` : `${Number(profile.ordersCompleted || 0).toLocaleString("en-IN")} orders`;
  business.phone = profile.contactList?.[0]?.phone || profile.phone || user.phone;
  business.email = profile.contactList?.[0]?.email || user.email;
  business.gemUrl = profile.gemLink || business.gemUrl || "https://gem.gov.in";
  business.description = profile.about || `${business.name} is building its GeM growth profile on Dome.`;
  business.products = profile.products?.map((item) => item.name || item).filter(Boolean) || business.products || [];
  business.highlights = [
    `${Number(profile.ordersCompleted || 0).toLocaleString("en-IN")} GeM orders completed`,
    profile.gstNumber ? "GST captured" : "GST pending",
    profile.micrositePaidUntil ? "Microsite active" : "Microsite payment pending"
  ];
}

function profileForUser(db, user) {
  return db.businessProfiles.find((profile) => profile.userId === user.id || profile.userEmail === user.email);
}

async function sendEmailOtp(email, code) {
  if (process.env.RESEND_API_KEY) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Dome <onboarding@resend.dev>",
        to: email,
        subject: "Your Dome verification code",
        text: `Your Dome verification code is ${code}. It expires in 10 minutes.`
      })
    });
    if (!response.ok) throw new Error(`Email provider error: ${(await response.text()).slice(0, 160)}`);
    return { sent: true, provider: "resend" };
  }

  if (process.env.SENDGRID_API_KEY) {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: process.env.EMAIL_FROM || "no-reply@example.com", name: "Dome" },
        subject: "Your Dome verification code",
        content: [{ type: "text/plain", value: `Your Dome verification code is ${code}. It expires in 10 minutes.` }]
      })
    });
    if (!response.ok) throw new Error(`Email provider error: ${(await response.text()).slice(0, 160)}`);
    return { sent: true, provider: "sendgrid" };
  }

  return { sent: false, provider: "dev" };
}

async function sendSmsOtp(phone, code) {
  if (process.env.MSG91_AUTH_KEY && process.env.MSG91_TEMPLATE_ID) {
    const response = await fetch("https://control.msg91.com/api/v5/otp", {
      method: "POST",
      headers: {
        authkey: process.env.MSG91_AUTH_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        template_id: process.env.MSG91_TEMPLATE_ID,
        mobile: phone.replace(/^\+/, ""),
        otp: code
      })
    });
    if (!response.ok) throw new Error(`SMS provider error: ${(await response.text()).slice(0, 160)}`);
    return { sent: true, provider: "msg91" };
  }

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) {
    return { sent: false, provider: "dev" };
  }

  const body = new URLSearchParams({
    To: phone,
    From: TWILIO_FROM,
    Body: `Your Dome verification code is ${code}. It expires in 10 minutes.`
  });

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`SMS provider error: ${message.slice(0, 160)}`);
  }
  return { sent: true, provider: "twilio" };
}

async function sendOtp(target, code, channel) {
  return channel === "email" ? sendEmailOtp(target, code) : sendSmsOtp(target, code);
}

function otpTarget(payload) {
  const channel = payload.channel === "email" ? "email" : "phone";
  const target = channel === "email"
    ? String(payload.email || payload.target || "").toLowerCase().trim()
    : normalizePhone(payload.phone || payload.target);
  return { channel, target };
}

function hasVerifiedOtp(db, target, channel, purpose = "registration") {
  return db.otps.some((entry) => {
    const entryTarget = entry.target || entry.phone;
    return entryTarget === target
      && entry.channel === channel
      && entry.verified
      && (!entry.purpose || entry.purpose === purpose)
      && new Date(entry.expiresAt).getTime() > Date.now();
  });
}

async function api(req, res, pathname) {
  const db = await ensureDb();

  if (req.method === "GET" && pathname === "/api/bootstrap") {
    return json(res, 200, publicBootstrap(db));
  }

  if (req.method === "GET" && pathname === "/api/admin") {
    if (!isAdmin(req)) return json(res, 401, { error: "Admin key required." });
    return json(res, 200, {
      applications: db.applications,
      contacts: db.contacts,
      authorizationRequests: db.authorizationRequests,
      revealPurchases: db.revealPurchases,
      revealBundles: db.revealBundles,
      businessProfiles: db.businessProfiles,
      setupRequests: db.setupRequests,
      webinarRegistrations: db.webinarRegistrations,
      payments: db.payments,
      auditLog: db.auditLog.slice(0, 100),
      users: db.users.map(cleanUser)
    });
  }

  if (req.method === "POST" && pathname === "/api/otp/start") {
    const payload = await readBody(req);
    const { channel, target } = otpTarget(payload);
    if (channel === "email" && !isEmail(target)) return json(res, 422, { error: "Enter a valid email address." });
    if (channel === "phone" && !isPhone(target)) return json(res, 422, { error: "Enter a valid mobile number with country code or 10 Indian digits." });
    const hasLiveProvider = channel === "email"
      ? Boolean(process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY)
      : Boolean(process.env.MSG91_AUTH_KEY || process.env.TWILIO_ACCOUNT_SID);
    const code = process.env.NODE_ENV === "production" && hasLiveProvider
      ? String(crypto.randomInt(100000, 999999))
      : "123456";
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
    db.otps = db.otps.filter((otp) => (otp.target || otp.phone) !== target || otp.channel !== channel || otp.verified);
    db.otps.push({ target, channel, codeHash: crypto.createHash("sha256").update(code).digest("hex"), purpose: payload.purpose || "registration", expiresAt, verified: false });
    const result = await sendOtp(target, code, channel);
    await saveDb();
    return json(res, 200, {
      ok: true,
      target,
      channel,
      expiresAt,
      provider: result.provider,
      devCode: result.provider === "dev" ? code : undefined
    });
  }

  if (req.method === "POST" && pathname === "/api/otp/verify") {
    const payload = await readBody(req);
    const { channel, target } = otpTarget(payload);
    const codeHash = crypto.createHash("sha256").update(String(payload.code || "")).digest("hex");
    const record = db.otps.find((otp) => (otp.target || otp.phone) === target && otp.channel === channel && otp.codeHash === codeHash && new Date(otp.expiresAt).getTime() > Date.now());
    if (!record) return json(res, 422, { error: "The OTP is invalid or expired." });
    record.verified = true;
    record.verifiedAt = new Date().toISOString();
    await saveDb();
    return json(res, 200, { ok: true, target, channel });
  }

  if (req.method === "POST" && pathname === "/api/register") {
    const payload = await readBody(req);
    const missing = required(payload, ["email", "phone"]);
    if (missing.length) return json(res, 422, { error: `Missing required fields: ${missing.join(", ")}` });
    if (!isEmail(payload.email)) return json(res, 422, { error: "Enter a valid email address." });
    const phone = normalizePhone(payload.phone);
    if (!isPhone(phone)) return json(res, 422, { error: "Enter a valid mobile number." });
    if (!payload.consent) return json(res, 422, { error: "Consent to Terms and Privacy Policy is required before creating an account." });
    const email = String(payload.email).toLowerCase().trim();
    if (!hasVerifiedOtp(db, phone, "phone")) return json(res, 422, { error: "Please verify the mobile number by OTP first." });
    if (!hasVerifiedOtp(db, email, "email")) return json(res, 422, { error: "Please verify the email address by OTP first." });
    const duplicate = db.users.some((user) => user.email === email || user.phone === phone);
    if (duplicate) return json(res, 409, { error: "An account or application already exists with this email or phone." });

    const role = ["OEM", "Reseller", "Buyer"].includes(payload.role) ? payload.role : "Member";
    const user = {
      id: crypto.randomUUID(),
      role,
      email,
      phone,
      businessName: role === "Member" ? "Profile pending" : `${role} profile pending`,
      businessId: "",
      status: "approved",
      emailVerified: true,
      phoneVerified: true,
      profileComplete: false,
      passwordHash: payload.password && validatePassword(payload.password) ? await hashPassword(payload.password) : await hashPassword(crypto.randomBytes(18).toString("hex")),
      createdAt: new Date().toISOString()
    };
    db.users.push(user);
    db.applications.unshift({
      id: crypto.randomUUID(),
      role,
      email,
      phone,
      status: "identity_verified",
      createdAt: user.createdAt,
      consent: Boolean(payload.consent),
      marketingConsent: Boolean(payload.marketingConsent),
      source: "identity_registration"
    });
    addAudit(db, "system", "identity_registered", `${role} ${email}`);
    await saveDb();
    return json(res, 201, { ok: true, user: cleanUser(user), token: signToken(user) });
  }

  if (req.method === "POST" && pathname === "/api/session") {
    const payload = await readBody(req);
    const email = String(payload.email || "").toLowerCase().trim();
    const user = db.users.find((item) => item.email === email);
    if (!user || !(await verifyPassword(payload.password, user.passwordHash))) return json(res, 401, { error: "Invalid email or password." });
    if (user.status !== "approved") return json(res, 403, { error: `Your account is ${user.status}. Admin approval is required before access.` });
    return json(res, 200, { ok: true, token: signToken(user), user: cleanUser(user) });
  }

  if (req.method === "POST" && pathname === "/api/contact") {
    const payload = await readBody(req);
    const missing = required(payload, ["businessId", "name", "email", "phone", "message"]);
    if (missing.length) return json(res, 422, { error: `Missing required fields: ${missing.join(", ")}` });
    if (!isEmail(payload.email)) return json(res, 422, { error: "Enter a valid email address." });
    const record = {
      id: crypto.randomUUID(),
      businessId: payload.businessId,
      businessName: db.businesses.find((item) => item.id === payload.businessId)?.name || payload.businessId,
      name: String(payload.name).trim(),
      organization: String(payload.organization || "").trim(),
      role: String(payload.role || "Visitor").trim(),
      email: String(payload.email).toLowerCase().trim(),
      phone: normalizePhone(payload.phone),
      message: String(payload.message).trim(),
      intent: String(payload.intent || "General enquiry").trim(),
      status: "new",
      createdAt: new Date().toISOString()
    };
    db.contacts.unshift(record);
    addAudit(db, "system", "contact_created", `${record.name} to ${record.businessName}`);
    await saveDb();
    return json(res, 201, { ok: true, contact: record });
  }

  if (req.method === "POST" && pathname === "/api/authorization") {
    const payload = await readBody(req);
    const missing = required(payload, ["oemId", "vendorName", "contactName", "email", "phone", "category", "message"]);
    if (missing.length) return json(res, 422, { error: `Missing required fields: ${missing.join(", ")}` });
    const oem = db.businesses.find((item) => item.id === payload.oemId && item.type === "OEM");
    if (!oem) return json(res, 404, { error: "OEM profile not found." });
    const request = {
      id: crypto.randomUUID(),
      oemId: oem.id,
      oemName: oem.name,
      vendorName: String(payload.vendorName).trim(),
      contactName: String(payload.contactName).trim(),
      email: String(payload.email).toLowerCase().trim(),
      phone: normalizePhone(payload.phone),
      category: String(payload.category).trim(),
      message: String(payload.message).trim(),
      status: "Requested",
      timeline: [{ stage: "Requested", at: new Date().toISOString(), by: "Vendor" }],
      createdAt: new Date().toISOString()
    };
    db.authorizationRequests.unshift(request);
    addAudit(db, "system", "authorization_requested", `${request.vendorName} -> ${oem.name}`);
    await saveDb();
    return json(res, 201, { ok: true, request });
  }

  if (req.method === "POST" && pathname === "/api/setup-request") {
    const payload = await readBody(req);
    const missing = required(payload, ["businessName", "role", "name", "email", "phone"]);
    if (missing.length) return json(res, 422, { error: `Missing required fields: ${missing.join(", ")}` });
    const request = {
      id: crypto.randomUUID(),
      businessName: String(payload.businessName).trim(),
      role: String(payload.role).trim(),
      name: String(payload.name).trim(),
      email: String(payload.email).toLowerCase().trim(),
      phone: normalizePhone(payload.phone),
      notes: String(payload.notes || "").trim(),
      paymentStatus: "provider_pending",
      amount: 4999,
      status: "new",
      createdAt: new Date().toISOString()
    };
    db.setupRequests.unshift(request);
    db.payments.unshift({
      id: crypto.randomUUID(),
      service: "Admin-assisted profile setup",
      payer: request.businessName,
      amount: request.amount,
      status: "provider_pending",
      createdAt: request.createdAt
    });
    addAudit(db, "system", "setup_request_created", request.businessName);
    await saveDb();
    return json(res, 201, { ok: true, request });
  }

  if (req.method === "POST" && pathname === "/api/webinar-registration") {
    const payload = await readBody(req);
    const missing = required(payload, ["webinarId", "name", "email", "phone", "organization"]);
    if (missing.length) return json(res, 422, { error: `Missing required fields: ${missing.join(", ")}` });
    const webinar = db.webinars.find((item) => item.id === payload.webinarId);
    if (!webinar) return json(res, 404, { error: "Webinar not found." });
    const existing = db.webinarRegistrations.find((entry) => entry.webinarId === webinar.id && entry.email === String(payload.email).toLowerCase().trim());
    if (existing) return json(res, 200, { ok: true, registration: existing, existing: true });
    const registration = {
      id: crypto.randomUUID(),
      webinarId: webinar.id,
      webinarTitle: webinar.title,
      name: String(payload.name).trim(),
      organization: String(payload.organization).trim(),
      email: String(payload.email).toLowerCase().trim(),
      phone: normalizePhone(payload.phone),
      paymentStatus: webinar.fee ? "provider_pending" : "free",
      accessLink: webinar.fee ? "" : `https://meet.dome.local/${webinar.id}`,
      createdAt: new Date().toISOString()
    };
    db.webinarRegistrations.unshift(registration);
    if (webinar.fee) {
      db.payments.unshift({
        id: crypto.randomUUID(),
        service: "Webinar registration",
        payer: registration.organization,
        amount: webinar.fee,
        status: "provider_pending",
        createdAt: registration.createdAt
      });
    }
    addAudit(db, "system", "webinar_registration", `${registration.organization} -> ${webinar.title}`);
    await saveDb();
    return json(res, 201, { ok: true, registration });
  }

  const appMatch = pathname.match(/^\/api\/admin\/applications\/([^/]+)$/);
  if (req.method === "POST" && appMatch) {
    if (!isAdmin(req)) return json(res, 401, { error: "Admin key required." });
    const payload = await readBody(req);
    const application = db.applications.find((item) => item.id === appMatch[1]);
    if (!application) return json(res, 404, { error: "Application not found." });
    if (!["approved", "rejected"].includes(payload.status)) return json(res, 422, { error: "Use approved or rejected status." });
    application.status = payload.status;
    application.adminNote = String(payload.note || "").trim();
    application.reviewedAt = new Date().toISOString();
    const user = db.users.find((item) => item.applicationId === application.id);
    if (user) user.status = payload.status;
    addAudit(db, "admin", `application_${payload.status}`, `${application.role} ${application.businessName}`);
    await saveDb();
    return json(res, 200, { ok: true, application });
  }

  const setupMatch = pathname.match(/^\/api\/admin\/setup-requests\/([^/]+)$/);
  if (req.method === "POST" && setupMatch) {
    if (!isAdmin(req)) return json(res, 401, { error: "Admin key required." });
    const request = db.setupRequests.find((item) => item.id === setupMatch[1]);
    if (!request) return json(res, 404, { error: "Setup request not found." });
    request.status = "completed";
    request.completedAt = new Date().toISOString();
    addAudit(db, "admin", "setup_completed", request.businessName);
    await saveDb();
    return json(res, 200, { ok: true, request });
  }

  const tokenUser = verifyToken(req);
  if (req.method === "GET" && pathname === "/api/me") {
    if (!tokenUser) return json(res, 401, { error: "Sign in required." });
    const liveUser = db.users.find((user) => user.id === tokenUser.id) || tokenUser;
    return json(res, 200, { user: cleanUser(liveUser), profile: profileForUser(db, liveUser) || null });
  }

  if (req.method === "GET" && pathname === "/api/profile") {
    if (!tokenUser) return json(res, 401, { error: "Sign in required." });
    const liveUser = db.users.find((user) => user.id === tokenUser.id);
    if (!liveUser) return json(res, 401, { error: "Session user not found." });
    return json(res, 200, { user: cleanUser(liveUser), profile: profileForUser(db, liveUser) || null });
  }

  if (req.method === "POST" && pathname === "/api/profile") {
    if (!tokenUser) return json(res, 401, { error: "Sign in required." });
    const liveUser = db.users.find((user) => user.id === tokenUser.id);
    if (!liveUser) return json(res, 401, { error: "Session user not found." });
    const payload = await readBody(req);
    const role = payload.role === "OEM" ? "OEM" : payload.role === "Buyer" ? "Buyer" : "Reseller";
    const previousProfile = profileForUser(db, liveUser);
    const hadMicrosite = Boolean(previousProfile?.micrositePaidUntil);
    const profile = {
      ...(previousProfile || {}),
      id: previousProfile?.id || crypto.randomUUID(),
      userId: liveUser.id,
      userEmail: liveUser.email,
      role,
      businessName: String(payload.businessName || "").trim(),
      state: String(payload.state || "").trim(),
      city: String(payload.city || "").trim(),
      contactPerson: String(payload.contactPerson || "").trim(),
      gstNumber: String(payload.gstNumber || "").trim().toUpperCase(),
      gemSellerId: String(payload.gemSellerId || "").trim(),
      gemLink: String(payload.gemLink || "").trim(),
      ordersCompleted: Number(payload.ordersCompleted || 0),
      lookingForCategories: Array.isArray(payload.lookingForCategories) ? payload.lookingForCategories : String(payload.lookingForCategories || "").split(",").map((item) => item.trim()).filter(Boolean),
      products: Array.isArray(payload.products) ? payload.products : String(payload.products || "").split("\n").map((name) => ({ name: name.trim() })).filter((item) => item.name),
      contactList: Array.isArray(payload.contactList) ? payload.contactList : String(payload.contactList || "").split("\n").map((line) => {
        const [purpose = "", name = "", phone = "", email = ""] = line.split("|").map((item) => item.trim());
        return { purpose, name, phone, email };
      }).filter((item) => item.purpose || item.name || item.phone || item.email),
      about: String(payload.about || "").trim(),
      gstLookup: payload.gstLookup || null,
      micrositeRequested: Boolean(payload.micrositeRequested),
      micrositePaidUntil: payload.micrositePaidUntil || (payload.micrositeRequested && PAYMENT_MODE === "mock" ? "2027-03-31" : ""),
      updatedAt: new Date().toISOString()
    };
    profile.completion = profileCompletion(role, profile);
    profile.profileStatus = profile.completion >= 80 ? "review_ready" : "incomplete";
    const existingIndex = db.businessProfiles.findIndex((item) => item.id === profile.id || item.userId === liveUser.id || item.userEmail === liveUser.email);
    if (existingIndex >= 0) db.businessProfiles[existingIndex] = profile;
    else db.businessProfiles.unshift(profile);
    liveUser.role = role;
    liveUser.businessName = profile.businessName || liveUser.businessName;
    liveUser.profileComplete = profile.completion >= 80;
    if (role === "OEM" && profile.micrositeRequested && !hadMicrosite) {
      db.payments.unshift({
        id: crypto.randomUUID(),
        service: "OEM microsite activation",
        payer: profile.businessName || liveUser.email,
        amount: 4999,
        status: PAYMENT_MODE === "mock" ? "paid_mock" : "provider_pending",
        createdAt: new Date().toISOString()
      });
    }
    syncBusinessFromProfile(db, liveUser, profile);
    addAudit(db, liveUser.email, "profile_saved", `${role} profile ${profile.completion}%`);
    await saveDb();
    return json(res, 200, { ok: true, user: cleanUser(liveUser), profile });
  }

  if (req.method === "POST" && pathname === "/api/gst/lookup") {
    const payload = await readBody(req);
    const gstNumber = String(payload.gstNumber || "").trim().toUpperCase();
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstNumber)) return json(res, 422, { error: "Enter a valid 15-character GSTIN." });
    if (process.env.GST_API_URL && process.env.GST_API_KEY) {
      const response = await fetch(`${process.env.GST_API_URL}?gstin=${encodeURIComponent(gstNumber)}`, {
        headers: { authorization: `Bearer ${process.env.GST_API_KEY}` }
      });
      if (!response.ok) return json(res, 502, { error: "GST provider lookup failed." });
      return json(res, 200, { ok: true, mode: "provider", result: await response.json() });
    }
    return json(res, 200, {
      ok: true,
      mode: "demo",
      result: {
        gstNumber,
        legalName: "Demo GST verified business",
        tradeName: "Dome Demo Seller",
        stateCode: gstNumber.slice(0, 2),
        status: "Active",
        note: "Demo data. Connect a GST API provider before relying on this for verification."
      }
    });
  }

  if (req.method === "POST" && pathname === "/api/reveal-contact") {
    if (!tokenUser) return json(res, 401, { error: "Sign in required to reveal OEM contact information." });
    const liveUser = db.users.find((user) => user.id === tokenUser.id);
    if (!liveUser) return json(res, 401, { error: "Session user not found." });
    const payload = await readBody(req);
    const business = db.businesses.find((item) => item.id === payload.businessId && item.type === "OEM");
    if (!business) return json(res, 404, { error: "OEM profile not found." });
    let bundle = db.revealBundles.find((item) => item.userId === liveUser.id && item.creditsRemaining > 0);
    if (!bundle) {
      bundle = {
        id: crypto.randomUUID(),
        userId: liveUser.id,
        creditsTotal: REVEAL_BUNDLE_CREDITS,
        creditsRemaining: PAYMENT_MODE === "mock" ? REVEAL_BUNDLE_CREDITS : 0,
        amount: REVEAL_BUNDLE_PRICE,
        status: PAYMENT_MODE === "mock" ? "paid_mock" : "provider_pending",
        createdAt: new Date().toISOString()
      };
      db.revealBundles.unshift(bundle);
      db.payments.unshift({
        id: crypto.randomUUID(),
        service: "Reveal OEM contact bundle",
        payer: liveUser.businessName || liveUser.email,
        amount: REVEAL_BUNDLE_PRICE,
        status: bundle.status,
        createdAt: bundle.createdAt
      });
    }
    if (bundle.creditsRemaining <= 0) {
      await saveDb();
      return json(res, 402, { error: "Payment is required before contact details can be revealed.", bundle });
    }
    const alreadyRevealed = db.revealPurchases.find((item) => item.userId === liveUser.id && item.businessId === business.id);
    if (!alreadyRevealed) bundle.creditsRemaining -= 1;
    const reveal = alreadyRevealed || {
      id: crypto.randomUUID(),
      userId: liveUser.id,
      businessId: business.id,
      businessName: business.name,
      revealedAt: new Date().toISOString()
    };
    if (!alreadyRevealed) db.revealPurchases.unshift(reveal);
    addAudit(db, liveUser.email, "contact_revealed", business.name);
    await saveDb();
    return json(res, 200, {
      ok: true,
      paymentMode: PAYMENT_MODE,
      bundle,
      reveal,
      contact: {
        businessName: business.name,
        phone: business.phone || "Contact phone pending",
        email: business.email || "Contact email pending",
        gemUrl: business.gemUrl || "https://gem.gov.in"
      }
    });
  }

  return json(res, 404, { error: "API endpoint not found." });
}

function cacheControlFor(ext, pathname) {
  if (ext === ".html") return "public, max-age=60, stale-while-revalidate=600";
  if (pathname.startsWith("/assets/")) return "public, max-age=31536000, immutable";
  if ([".js", ".css"].includes(ext)) return "public, max-age=300, must-revalidate";
  return "public, max-age=3600";
}

async function staticFile(req, res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) throw Object.assign(new Error("Directory"), { code: "EISDIR" });
    const ext = path.extname(filePath);
    const body = await fs.readFile(filePath);
    send(req, res, 200, {
      "content-type": mimeTypes[ext] || "application/octet-stream",
      "cache-control": cacheControlFor(ext, safePath)
    }, body);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      const body = await fs.readFile(path.join(PUBLIC_DIR, "index.html"));
      send(req, res, 200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }, body);
    } else {
      res.writeHead(500);
      res.end("Server error");
    }
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === "/healthz") {
      return jsonWithReq(req, res, 200, {
        ok: true,
        service: "dome-platform",
        time: new Date().toISOString()
      });
    }
    if (url.pathname === "/readyz") {
      await ensureDb();
      return jsonWithReq(req, res, 200, {
        ok: true,
        service: "dome-platform",
        dataReady: true,
        time: new Date().toISOString()
      });
    }
    if (url.pathname.startsWith("/api/")) {
      await api(req, res, url.pathname);
    } else {
      await staticFile(req, res, url.pathname);
    }
  } catch (error) {
    console.error(error);
    json(res, 500, { error: error.message || "Server error" });
  }
});

server.listen(PORT, () => {
  console.log(`Dome Platform running on http://localhost:${PORT}`);
});

ensureDb().catch((error) => {
  console.error("Failed to initialize Dome Platform data", error);
  if (process.env.NODE_ENV === "production") {
    process.exitCode = 1;
  }
});
