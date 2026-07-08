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
  { role: "Vendor", email: "vendor@dome.com", password: "vendor123", businessName: "Shyam Enterprises", businessId: "shyam", status: "approved" },
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
    setupRequests: [],
    webinarRegistrations: [],
    payments: [],
    auditLog: [],
    otps: []
  };
}

async function ensureDb() {
  if (dbCache) return dbCache;
  if (dbInitPromise) return dbInitPromise;
  dbInitPromise = (async () => {
    try {
      const raw = await fs.readFile(DATA_FILE, "utf8");
      dbCache = JSON.parse(raw);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      dbCache = await seedDb();
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
    businessName: user.businessName,
    businessId: user.businessId || "",
    status: user.status
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

async function sendOtp(phone, code) {
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
      setupRequests: db.setupRequests,
      webinarRegistrations: db.webinarRegistrations,
      payments: db.payments,
      auditLog: db.auditLog.slice(0, 100),
      users: db.users.map(cleanUser)
    });
  }

  if (req.method === "POST" && pathname === "/api/otp/start") {
    const payload = await readBody(req);
    const phone = normalizePhone(payload.phone);
    if (!isPhone(phone)) return json(res, 422, { error: "Enter a valid mobile number with country code or 10 Indian digits." });
    const code = process.env.NODE_ENV === "production" && process.env.TWILIO_ACCOUNT_SID
      ? String(crypto.randomInt(100000, 999999))
      : "123456";
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
    db.otps = db.otps.filter((otp) => otp.phone !== phone || otp.verified);
    db.otps.push({ phone, codeHash: crypto.createHash("sha256").update(code).digest("hex"), purpose: payload.purpose || "registration", expiresAt, verified: false });
    const result = await sendOtp(phone, code);
    await saveDb();
    return json(res, 200, {
      ok: true,
      phone,
      expiresAt,
      provider: result.provider,
      devCode: result.provider === "dev" ? code : undefined
    });
  }

  if (req.method === "POST" && pathname === "/api/otp/verify") {
    const payload = await readBody(req);
    const phone = normalizePhone(payload.phone);
    const codeHash = crypto.createHash("sha256").update(String(payload.code || "")).digest("hex");
    const record = db.otps.find((otp) => otp.phone === phone && otp.codeHash === codeHash && new Date(otp.expiresAt).getTime() > Date.now());
    if (!record) return json(res, 422, { error: "The OTP is invalid or expired." });
    record.verified = true;
    await saveDb();
    return json(res, 200, { ok: true, phone });
  }

  if (req.method === "POST" && pathname === "/api/register") {
    const payload = await readBody(req);
    const missing = required(payload, ["role", "businessName", "city", "state", "category", "contactName", "email", "phone", "password"]);
    if (missing.length) return json(res, 422, { error: `Missing required fields: ${missing.join(", ")}` });
    const role = String(payload.role);
    if (!["Vendor", "OEM", "Buyer"].includes(role)) return json(res, 422, { error: "Choose Vendor, OEM or Buyer." });
    if (!isEmail(payload.email)) return json(res, 422, { error: "Enter a valid email address." });
    const phone = normalizePhone(payload.phone);
    if (!isPhone(phone)) return json(res, 422, { error: "Enter a valid mobile number." });
    if (!validatePassword(payload.password)) return json(res, 422, { error: "Password must be at least 8 characters and include letters and numbers." });
    if (!payload.consent) return json(res, 422, { error: "Consent to Terms and Privacy Policy is required before creating an account." });
    const otp = db.otps.find((entry) => entry.phone === phone && entry.verified && new Date(entry.expiresAt).getTime() > Date.now());
    if (!otp) return json(res, 422, { error: "Please verify the mobile number by OTP first." });
    const email = String(payload.email).toLowerCase().trim();
    const duplicate = db.users.some((user) => user.email === email || user.phone === phone)
      || db.applications.some((app) => ["pending", "approved"].includes(app.status) && (app.email === email || app.phone === phone));
    if (duplicate) return json(res, 409, { error: "An account or application already exists with this email or phone." });

    const application = {
      id: crypto.randomUUID(),
      role,
      businessName: String(payload.businessName).trim(),
      legalName: String(payload.legalName || "").trim(),
      city: String(payload.city).trim(),
      state: String(payload.state).trim(),
      category: String(payload.category).trim(),
      contactName: String(payload.contactName).trim(),
      designation: String(payload.designation || "").trim(),
      email,
      phone,
      gst: String(payload.gst || "").trim(),
      pan: String(payload.pan || "").trim(),
      gemUrl: String(payload.gemUrl || "").trim(),
      website: String(payload.website || "").trim(),
      need: String(payload.need || "").trim(),
      source: String(payload.source || "").trim(),
      consent: Boolean(payload.consent),
      marketingConsent: Boolean(payload.marketingConsent),
      status: "pending",
      createdAt: new Date().toISOString()
    };
    db.applications.unshift(application);
    db.users.push({
      id: crypto.randomUUID(),
      role,
      email,
      phone,
      businessName: application.businessName,
      businessId: "",
      status: "pending",
      passwordHash: await hashPassword(payload.password),
      createdAt: application.createdAt,
      applicationId: application.id
    });
    addAudit(db, "system", "registration_submitted", `${role} ${application.businessName}`);
    await saveDb();
    return json(res, 201, { ok: true, application });
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
    return json(res, 200, { user: tokenUser });
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
