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
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
const DOME_PLUS_PRICE = Number(process.env.DOME_PLUS_PRICE || 4999);
const DOME_PLUS_DAYS = Number(process.env.DOME_PLUS_DAYS || 365);
const GST_API_URL = process.env.GST_API_URL || "";
const GST_API_KEY = process.env.GST_API_KEY || "";
const GST_API_KEY_HEADER = process.env.GST_API_KEY_HEADER || "authorization";
const GST_API_KEY_PREFIX = process.env.GST_API_KEY_PREFIX ?? "Bearer ";
const GST_PROVIDER = process.env.GST_PROVIDER || "";
const GST_SANDBOX_API_KEY = process.env.GST_SANDBOX_API_KEY || "";
const GST_SANDBOX_API_SECRET = process.env.GST_SANDBOX_API_SECRET || "";
const GST_SANDBOX_BASE_URL = process.env.GST_SANDBOX_BASE_URL || "https://api.sandbox.co.in";
let gstSandboxToken = { value: "", expiresAt: 0 };
const OEM_PLANS = {
  basic: {
    id: "basic",
    name: "Basic",
    price: 0,
    productLimit: 3,
    headline: "Free OEM microsite",
    features: ["Public OEM microsite", "Up to 3 products with GeM links", "Resellers can request authorization through Dome"]
  },
  domePlus: {
    id: "domePlus",
    name: "Dome+",
    price: DOME_PLUS_PRICE,
    productLimit: 10,
    headline: "Growth microsite for active OEMs",
    features: ["Up to 10 products with GeM links", "Priority profile presentation", "Reseller outreach tools when messaging launches"]
  }
};

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
    {
      slug: "seller-registration-readiness",
      title: "Get ready for GeM seller registration",
      kind: "Guide",
      minutes: 8,
      summary: "Prepare the identity, tax and business records that make registration and profile completion smoother.",
      audience: "New sellers and service providers",
      intro: "Registration is easier when the authorized person and the organization records are aligned before the first login. Use this as a readiness check, then complete every official step on GeM.",
      sections: [
        { title: "Start with the authorized person", paragraphs: ["GeM's published prerequisites say the seller account should be created by an authorized person, such as a proprietor, partner, director or another permitted key person. Keep the personal identity details used for Aadhaar or PAN verification available, along with an active email address and mobile access."] },
        { title: "Prepare the organization record", bullets: ["Business constitution and organization PAN", "Date of incorporation or registration", "CIN where applicable", "Office address and bank details for profile completion", "ITR details when required for Bid or Reverse Auction participation"] },
        { title: "Complete the seller journey in order", paragraphs: ["Create the seller account on GeM, complete the organization profile, and then add products or services through Catalogue. The official GeM seller learning journey separately covers account management, catalogue management, Bid and RA participation, and order fulfilment."], bullets: ["Use the exact legal details held in the source records", "Review every auto-fetched field before confirming", "Keep proof for claims made in the organization and catalogue profile", "Treat Dome as your preparation and partner workspace; complete transactions on GeM"] }
      ],
      sources: [
        { label: "GeM seller registration prerequisites", url: "https://assets-bg.gem.gov.in/resources/pdf/seller-registration-pre-requisites-v1.2.pdf" },
        { label: "Official GeM Seller Journey", url: "https://elearning.gem.gov.in/course/index.php?categoryid=2" }
      ]
    },
    {
      slug: "vendor-assessment-readiness",
      title: "Prepare for Vendor Assessment",
      kind: "Guide",
      minutes: 9,
      summary: "Organize the evidence behind your location, financial capacity and production capability before assessment.",
      audience: "OEMs and assessed sellers",
      intro: "Vendor Assessment is evidence-led. A clean document trail and an assessment-ready facility reduce avoidable clarification cycles.",
      sections: [
        { title: "Understand the assessment shape", paragraphs: ["GeM's published Vendor Assessment methodology groups assessment around physical location, financial capacity and production capability. The process described in the manual includes a desktop review of submitted information and a video assessment that validates the declared facility and process."] },
        { title: "Build one evidence folder", bullets: ["Current organization and factory or office records", "Financial records that match the entity being assessed", "Manufacturing or production-flow evidence", "Machinery, testing and quality-control records where applicable", "Product and brand evidence consistent with the GeM catalogue"] },
        { title: "Run a consistency review", paragraphs: ["Names, addresses, dates and capacities should agree across source documents, the GeM profile and the evidence shown during assessment. Resolve discrepancies before submission and answer any non-compliance observation with the exact supporting record requested."] }
      ],
      sources: [
        { label: "GeM Vendor Assessment methodology", url: "https://assets-bg.gem.gov.in/resources/pdf/user_manual_gem_va.pdf" },
        { label: "Official GeM Seller Journey", url: "https://elearning.gem.gov.in/course/index.php?categoryid=2" }
      ]
    },
    {
      slug: "oem-authorization-workflow",
      title: "Build a clean OEM authorization workflow",
      kind: "Playbook",
      minutes: 7,
      summary: "Give OEMs the business context they need and keep every authorization status visible to both sides.",
      audience: "Resellers and OEM channel teams",
      intro: "Authorization works best as a managed relationship, not a one-off document request. Dome collects a reseller's verified business context, routes the request and keeps the progress visible.",
      sections: [
        { title: "For resellers", bullets: ["Complete the reseller profile and GeM seller details", "Choose the relevant product category", "Submit the authorization request through the OEM microsite", "Respond promptly if Dome or the OEM asks for category, territory or capability evidence", "Keep sourcing and chain documents required for the product and catalogue route"] },
        { title: "For OEMs", bullets: ["Publish accurate products and GeM links", "Review the reseller's location, category fit and order history", "Define the authorization scope and internal owner", "Keep the reseller status current so the network can act on it"] },
        { title: "Remember the catalogue rules", paragraphs: ["GeM catalogue treatment varies by category quadrant. Official GeM material describes different participation rules for OEMs and resellers across Q1 to Q4, so members should confirm the current category requirement on GeM before listing, bidding or accepting an order."] }
      ],
      sources: [
        { label: "GeM overview and catalogue quadrant policy", url: "https://assets-bg.gem.gov.in/resources/upload/shared_doc/gem-overview-ppt-2-september-2024-1_1725964078.pdf" },
        { label: "GeM General Terms and Conditions", url: "https://assets-bg.gem.gov.in/resources/upload/shared_doc/gtc/general-te-1675401798.pdf" }
      ]
    }
  ],
  articles: [
    {
      slug: "gem-catalogue-quadrants",
      title: "Q1 to Q4: what the catalogue route changes",
      tag: "Catalogue",
      minutes: 6,
      summary: "A working view of who can create or pair a catalogue and where OEM approval matters.",
      audience: "OEMs and product resellers",
      intro: "The category quadrant affects how an OEM or reseller participates in catalogue creation. Check the live category rule on GeM before acting because category configuration and policy can change.",
      sections: [
        { title: "The practical distinction", bullets: ["Q1: catalogue participation is restricted to OEMs", "Q2: OEMs and their authorized resellers participate", "Q3: OEMs and/or authorized resellers may participate concurrently", "Q4: OEMs and resellers can participate, subject to the applicable obligations"] },
        { title: "What a reseller should verify", paragraphs: ["Confirm the quadrant shown for the exact category, whether the OEM has verified the reseller on GeM, and what undertaking or sourcing evidence applies. In Q3 and Q4, GeM's published terms describe an undertaking route when a reseller is not approved by the OEM; the reseller remains responsible for genuine sourcing and chain documentation."], bullets: ["Exact category and quadrant", "OEM verification status", "Catalogue pairing or upload route", "Warranty responsibility", "Required chain and compliance documents"] },
        { title: "Where Dome fits", paragraphs: ["Dome helps the parties find each other, exchange the business context required for authorization and track the relationship. The catalogue, undertaking, bid and order actions remain on GeM."] }
      ],
      sources: [
        { label: "GeM catalogue quadrant overview", url: "https://assets-bg.gem.gov.in/resources/upload/shared_doc/gem-overview-ppt-2-september-2024-1_1725964078.pdf" },
        { label: "GeM General Terms and Conditions", url: "https://assets-bg.gem.gov.in/resources/upload/shared_doc/gtc/general-te-1675401798.pdf" }
      ]
    },
    {
      slug: "first-order-readiness",
      title: "Your first GeM order starts before the bid",
      tag: "Operations",
      minutes: 7,
      summary: "Build the catalogue, compliance and fulfilment discipline needed before pursuing an opportunity.",
      audience: "New and early-stage sellers",
      intro: "A first order is rarely won by registration alone. Readiness comes from a usable catalogue, accurate commercial assumptions and a fulfilment plan that can survive the order terms.",
      sections: [
        { title: "Make the account usable", bullets: ["Complete organization and bank details", "Add the correct product or service catalogue", "Keep tax, experience and eligibility records current", "Assign internal responsibility for bids, orders and delivery"] },
        { title: "Read before you respond", paragraphs: ["Study the specification, quantity, delivery location, bid dates, eligibility conditions and buyer-added terms. Match the offer to an approved catalogue and cost delivery, tax, warranty and service obligations before fixing a price."] },
        { title: "Prepare fulfilment before award", bullets: ["Confirm stock or supply capacity", "Plan dispatch and proof of delivery", "Keep invoice and acceptance documentation aligned", "Track order milestones and raise issues through the official GeM process"] }
      ],
      sources: [
        { label: "Official GeM Seller Journey", url: "https://elearning.gem.gov.in/course/index.php?categoryid=2" },
        { label: "GeM seller registration guide", url: "https://assets-bg.gem.gov.in/resources/pdf/register-on-gem-consolidated-11-languages.pdf" }
      ]
    },
    {
      slug: "oem-reseller-sales-kit",
      title: "The OEM sales kit every reseller can use",
      tag: "Growth",
      minutes: 5,
      summary: "Turn product, pricing and fulfilment knowledge into a channel-ready package.",
      audience: "OEM channel and government-sales teams",
      intro: "Resellers move faster when the OEM gives them one reliable operating pack. The goal is consistency across discovery, catalogue matching, quotation and fulfilment.",
      sections: [
        { title: "The core pack", bullets: ["Product catalogue with current GeM links", "Category and specification mapping", "Commercial guidance with validity dates", "Territory, stock and delivery information", "Warranty and escalation path", "Brand assets and approved product copy"] },
        { title: "Keep control without creating friction", paragraphs: ["Give every file an owner, version date and expiry date. Separate public product material from reseller-only commercial material, and make obsolete versions unavailable. Dome can become the shared layer where the OEM publishes the current microsite and the reseller sees the material relevant to the relationship."] },
        { title: "Measure usefulness", bullets: ["Time from request to reseller response", "Catalogue-link accuracy", "Number of active reseller relationships", "Authorization turnaround time", "Expired document or price-sheet incidents"] }
      ],
      sources: [
        { label: "Official GeM Seller Journey", url: "https://elearning.gem.gov.in/course/index.php?categoryid=2" },
        { label: "GeM General Terms and Conditions", url: "https://assets-bg.gem.gov.in/resources/upload/shared_doc/gtc/general-te-1675401798.pdf" }
      ]
    }
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

const learnUpgrades = {
  "seller-registration-readiness": {
    minutes: 12,
    updated: "July 2026",
    summary: "Build a registration pack that keeps personal identity, organization records, tax data and the intended seller journey aligned from day one.",
    intro: "A GeM account becomes useful only when the person creating it, the legal entity behind it and the records used later for catalogue, bids and orders all agree. This guide turns registration into a controlled readiness exercise rather than a sequence of corrections.",
    takeaways: ["Know who should create the primary seller account", "Prepare the organization record before the first login", "Separate account creation from catalogue and bid readiness", "Never pay a third party for GeM registration"],
    sections: [
      { title: "Choose the correct authorized person", paragraphs: ["GeM's published prerequisites identify the account creator as an authorized person such as a proprietor, partner, director or another permitted key person. Decide this before registration because personal Aadhaar or PAN verification, mobile access and email ownership sit with that person."], bullets: ["Confirm authority under the entity's constitution", "Use an active mobile number controlled by the authorized person", "Match personal PAN name and date of birth exactly", "Use an email account that can be retained and recovered"] },
      { title: "Assemble the organization master", paragraphs: ["Create one reviewed source sheet for the legal name, constitution, organization PAN, incorporation or registration date, registered address, CIN where applicable and bank information. Differences in spelling, dates or entity type create avoidable friction later."], bullets: ["Legal and trade name", "Business constitution", "Organization PAN", "Incorporation or registration date", "CIN for companies", "Registered and operating addresses", "Bank account and IFSC"] },
      { title: "Understand where ITR fits", paragraphs: ["The published prerequisite note says verified ITR details are relevant for Bid and Reverse Auction participation, with stated exceptions for newer entities or entities exempt from filing. Treat this as a participation-readiness item and verify the current rule on GeM for the entity before bidding."] },
      { title: "Move through the seller journey in order", bullets: ["Create and secure the seller account", "Complete the organization profile", "Set internal users and responsibilities", "Add products or services through the applicable catalogue route", "Prepare separately for Bid/RA participation", "Prepare order fulfilment ownership before pursuing business"] },
      { title: "Run a ten-minute quality check", paragraphs: ["Before confirming any fetched or entered record, compare it against the source document. Keep a dated registration pack and record who approved it internally. Dome can hold the readiness record and partner context; official registration, catalogue, bid and order actions remain on GeM."], bullets: ["Names and dates match source records", "Mobile and email can receive verification", "Entity type is correct", "No one has been paid for registration", "Internal owner is assigned for the next step"] }
    ]
  },
  "vendor-assessment-readiness": {
    minutes: 14,
    updated: "July 2026",
    summary: "Prepare the evidence, facility and internal owners needed for a consistent desktop and video assessment.",
    intro: "Vendor Assessment is not a document-upload contest. The submitted profile, financial evidence, production capability and the facility shown during validation must tell the same story.",
    takeaways: ["Organize evidence around location, financial capacity and production capability", "Make every claim traceable to a source record", "Rehearse the facility walkthrough before video assessment", "Close inconsistencies before submission"],
    sections: [
      { title: "Map the assessment to three evidence rooms", paragraphs: ["GeM's published methodology groups OEM assessment around physical location, financial capacity and production capability. Build a folder for each area, with an index that names the document, period, owner and claim it supports."] },
      { title: "Make the desktop assessment reviewable", bullets: ["Use current entity and facility records", "Keep financial documents for the same legal entity", "Show production flow from input to finished product", "Link machinery and testing evidence to declared products", "Keep brand and catalogue evidence consistent with GeM"] },
      { title: "Prepare the video assessment", paragraphs: ["The official manual describes video assessment as validation of the process and facility represented in the desktop submission. Plan the route, connectivity, permissions and people required to show the declared capability without improvisation."], bullets: ["Test mobile connectivity across the facility", "Identify the person who can explain each process", "Make machinery identifiers and records accessible", "Prepare safe access to production and quality-control areas", "Keep original or verifiable records available"] },
      { title: "Treat non-compliance as a controlled response", paragraphs: ["When a clarification or non-compliance observation is raised, answer the exact point with the exact record. Avoid broad explanations that introduce new contradictions. Record the issue, owner, response and closure evidence."] },
      { title: "Use assessment readiness commercially", paragraphs: ["A clean capability record is also useful for reseller onboarding. OEMs can reuse approved descriptions, product scope, quality processes and support information in Dome microsites and sales kits without exposing confidential assessment material."] }
    ]
  },
  "oem-authorization-workflow": {
    minutes: 13,
    updated: "July 2026",
    summary: "Turn a reseller request into a traceable GeM collaboration record with identity, category, scope, validity and a decision timeline.",
    intro: "Authorization should be managed as a living OEM-reseller relationship. The useful record is not only an approval: it captures who the reseller is on GeM, what category and brand are covered, who authorized it and how long it remains valid.",
    takeaways: ["Start with the reseller's GeM Seller ID", "Define category and product scope precisely", "Record authorization number, agency and validity when issued", "Keep the same status visible to both parties"],
    sections: [
      { title: "The reseller request pack", bullets: ["Verified business name and GeM Seller ID", "Category and products requested", "State, city or operating territory", "Relevant GeM order experience", "Named business contact held privately by Dome", "Reasonable evidence requested by the OEM for category fit"] },
      { title: "The OEM review", paragraphs: ["Review identity before reach. A large order count does not replace category fit, support capability or sourcing discipline. Use Under Consideration while the team validates the request, then make an explicit Accepted or Rejected decision."], bullets: ["Confirm Seller ID and business identity", "Check category and product fit", "Review territory and fulfilment capability", "Assign an internal authorization owner", "Define any limitations before acceptance"] },
      { title: "The shared authorization record", paragraphs: ["The GeM OEM panel shown to Dome includes fields such as category, brand, authorization number, authorization agency, authorization date, validity period and GeM Seller ID. Dome mirrors this operating structure so the OEM and reseller can work from one shared record while the official action remains on GeM."], bullets: ["Category", "Brand", "Authorization number", "Authorization agency", "Authorization date", "Valid from and valid to", "GeM Seller ID"] },
      { title: "Status means something", bullets: ["Under Consideration: the OEM is validating identity, category or capability", "Accepted: the OEM has approved the collaboration and can record authorization details", "Rejected: the OEM has closed this request; the reseller should review fit before a fresh request"] },
      { title: "Keep catalogue obligations separate", paragraphs: ["Authorization does not remove the need to follow the current catalogue route, category conditions, sourcing obligations, warranty responsibilities or GeM terms. Confirm the live category rule and complete the official OEM or reseller action on GeM."] }
    ]
  },
  "gem-catalogue-quadrants": {
    minutes: 11,
    updated: "July 2026",
    summary: "Use category configuration to decide who may create, pair or offer a catalogue and what evidence the reseller must retain.",
    intro: "The quadrant is an operating rule for a specific category, not a permanent label for a business. The same seller may encounter different participation routes across categories, so every decision starts with the live category configuration.",
    takeaways: ["Check the exact category, not a broad product family", "Do not assume one quadrant applies everywhere", "Separate catalogue eligibility from bid eligibility", "Retain sourcing, warranty and authorization evidence"],
    sections: [
      { title: "A practical reading of Q1 to Q4", bullets: ["Q1 generally centers catalogue participation on the OEM", "Q2 generally involves OEMs and OEM-authorized resellers", "Q3 permits a broader concurrent OEM or reseller route subject to applicable requirements", "Q4 permits OEM and reseller participation subject to the category and GeM obligations"] },
      { title: "Start with the exact category", paragraphs: ["Search the exact category and inspect the current participation route before building a catalogue or committing to a bid. Product similarity is not enough: category configuration, specifications and required credentials can differ."] },
      { title: "Authorization and undertaking are not interchangeable habits", paragraphs: ["Where GeM terms provide different routes for authorized and non-authorized resellers, understand the consequence of the route being used. A reseller remains responsible for genuine sourcing, chain documents, warranty and the claims made in the catalogue or bid."] },
      { title: "The pre-bid control list", bullets: ["Exact category and current quadrant", "Catalogue ownership or pairing route", "OEM approval status", "Required undertaking or declarations", "Source and supply-chain evidence", "Warranty and service responsibility", "Bid-specific eligibility and buyer-added terms"] },
      { title: "How Dome should be used", paragraphs: ["Use Dome to find the right OEM, keep reseller identity and authorization status visible, and share current product links. Use GeM for the official catalogue, undertaking, bid, order and compliance action."] }
    ]
  },
  "first-order-readiness": {
    minutes: 13,
    updated: "July 2026",
    summary: "Build a bid-to-payment control sheet before pursuing the first order, including catalogue fit, landed economics, delivery and acceptance evidence.",
    intro: "The first order is won twice: first in a compliant offer, then in fulfilment that survives delivery, acceptance and payment. Readiness means the commercial and operating team agree before a bid is submitted.",
    takeaways: ["Bid only against a catalogue and specification you can fulfil", "Calculate landed obligations before fixing price", "Assign owners for every order milestone", "Preserve delivery and acceptance evidence"],
    sections: [
      { title: "Make the seller account operational", bullets: ["Complete organization, bank and tax information", "Use the correct product or service catalogue", "Keep required experience and eligibility records current", "Assign primary and backup users", "Set an internal bid approval threshold"] },
      { title: "Read the opportunity as a contract precursor", paragraphs: ["Review specification, quantity, consignee locations, delivery period, eligibility, inspection, warranty, payment and buyer-added terms. Raise questions through the official route where available; do not price around an assumption that changes the obligation."] },
      { title: "Build landed economics", bullets: ["Product or service cost", "Packing and transport", "Tax treatment", "Installation or commissioning", "Warranty and service visits", "Finance and working-capital period", "Performance security or other applicable commitments", "Risk allowance for the delivery geography"] },
      { title: "Prepare fulfilment before award", bullets: ["Reserve supply or production capacity", "Confirm consignee and delivery documentation", "Plan inspection and acceptance evidence", "Align invoice data with the order", "Track dispatch, delivery and acceptance milestones", "Escalate exceptions through the official GeM process"] },
      { title: "Run a post-order review", paragraphs: ["After completion, compare promised and actual margin, dispatch time, acceptance time and payment cycle. Feed the result back into catalogue, pricing and partner decisions before the next bid."] }
    ]
  },
  "oem-reseller-sales-kit": {
    minutes: 10,
    updated: "July 2026",
    summary: "Build a controlled channel pack that gives resellers current product, category, commercial and fulfilment information without version chaos.",
    intro: "A reseller cannot represent an OEM well with a brochure alone. The useful sales kit connects the product to its GeM category, catalogue link, commercial validity, delivery reality and escalation owner.",
    takeaways: ["Create one governed source for current channel material", "Link every product to category and GeM listing", "Separate public content from reseller-only commercial material", "Expire old prices and documents deliberately"],
    sections: [
      { title: "Build the product truth layer", bullets: ["Product name and model", "GeM category and current listing link", "Specification and approved product copy", "Images and brochure", "Certification or compliance evidence where relevant", "Warranty and service scope"] },
      { title: "Add the operating layer", bullets: ["Stock or production lead time", "Delivery coverage and exclusions", "Installation requirements", "Escalation contacts by purpose", "Commercial guidance with issue and expiry dates", "Authorization scope and validity where applicable"] },
      { title: "Design access by audience", paragraphs: ["Public microsite visitors need accurate product and brand information. Authorized resellers may need commercial guidance, sales material and support routes. Keep confidential price or partner material out of the public profile."] },
      { title: "Govern versions", bullets: ["Give every file an owner", "Show issue and expiry dates", "Archive superseded versions", "Notify active resellers of material changes", "Check links and prices on a fixed cadence"] },
      { title: "Measure channel usefulness", bullets: ["Time from OEM request to reseller response", "Percentage of current GeM links", "Authorization turnaround time", "Active reseller relationships by category", "Expired price-sheet incidents", "Bid losses caused by missing product information"] }
    ]
  }
};

for (const item of [...content.guides, ...content.articles]) {
  if (learnUpgrades[item.slug]) Object.assign(item, learnUpgrades[item.slug]);
}

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
  { role: "Reseller", email: "vendor@dome.com", phone: "+919000000001", password: "vendor123", businessName: "Shyam Enterprises", businessId: "shyam", status: "approved" },
  { role: "OEM", email: "oem@dome.com", phone: "+919000000002", password: "oem123", businessName: "PrintoDome", businessId: "printodome", status: "approved" },
  { role: "Buyer", email: "buyer@dome.com", phone: "+919000000003", password: "buyer123", businessName: "City Buyer Office", status: "approved" },
  { role: "Admin", email: "admin@dome.com", phone: "+919000000004", password: "admin123", businessName: "Dome Admin", status: "approved" }
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
      phone: user.phone,
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
        products: [
          { name: "X-Range Colour Laser Cartridge", gemUrl: "https://gem.gov.in" },
          { name: "Drum Unit DU-220", gemUrl: "https://gem.gov.in" },
          { name: "Inkjet Cartridge IJ-310", gemUrl: "https://gem.gov.in" }
        ],
        contactList: [
          { purpose: "Reseller onboarding", name: "Channel Desk", phone: "+91 98765 41000", email: "growth@printodome.in" },
          { purpose: "Buyer enquiries", name: "Government Sales", phone: "+91 98765 41010", email: "sales@printodome.in" }
        ],
        oemPlan: "domePlus",
        domePlusPaidUntil: "2027-03-31",
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
  db.businesses ||= [];
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
  db.paymentOrders ||= [];
  db.auditLog ||= [];
  db.otps ||= [];
  db.content = content;
  for (const user of db.users) {
    if (user.role === "Vendor") user.role = "Reseller";
    const demoPhoneByEmail = {
      "vendor@dome.com": "+919000000001",
      "oem@dome.com": "+919000000002",
      "buyer@dome.com": "+919000000003",
      "admin@dome.com": "+919000000004"
    };
    if (!user.phone && demoPhoneByEmail[user.email]) user.phone = demoPhoneByEmail[user.email];
    user.emailVerified = Boolean(user.emailVerified || user.status === "approved");
    user.phoneVerified = Boolean(user.phoneVerified || user.status === "approved");
  }
  for (const app of db.applications) {
    if (app.role === "Vendor") app.role = "Reseller";
  }
  for (const profile of db.businessProfiles) {
    const hasDemoGstData = profile.gstLookup?.mode === "demo"
      || profile.gstLookup?.result?.tradeName === "Dome Demo Seller"
      || profile.gstLookup?.result?.legalName === "Demo GST verified business";
    if (hasDemoGstData) {
      if (["Dome Demo Seller", "Demo GST verified business"].includes(profile.businessName)) profile.businessName = "";
      if (profile.contactPerson === "Demo Authorised Signatory") profile.contactPerson = "";
      if (String(profile.about || "").startsWith("Dome Demo Seller is a Proprietorship business")) profile.about = "";
      profile.gstLookup = null;
      const profileUser = db.users.find((user) => user.id === profile.userId || user.email === profile.userEmail);
      if (profileUser && ["Dome Demo Seller", "Demo GST verified business"].includes(profileUser.businessName)) {
        profileUser.businessName = "Profile pending";
        profileUser.businessId = "";
        profileUser.profileComplete = false;
      }
    }
    if (profile.role === "OEM") {
      if (profile.micrositePaidUntil && !profile.domePlusPaidUntil) profile.domePlusPaidUntil = profile.micrositePaidUntil;
      profile.oemPlan = profile.domePlusPaidUntil ? "domePlus" : (profile.oemPlan || "basic");
      profile.products = normalizeProducts(profile.products);
    }
  }
  for (const request of db.authorizationRequests) {
    if (request.status === "Requested") request.status = "Under Consideration";
    if (request.status === "Declined") request.status = "Rejected";
    request.timeline = (request.timeline || []).map((item) => ({
      ...item,
      stage: item.stage === "Requested" ? "Request submitted" : item.stage === "OEM review" ? "Under Consideration" : item.stage === "Declined" ? "Rejected" : item.stage
    }));
  }
  db.businesses = db.businesses.filter((business) => !["Dome Demo Seller", "Demo GST verified business"].includes(business.name));
  for (const business of db.businesses) {
    if (business.type === "OEM") {
      business.oemPlan ||= business.id === "printodome" ? "domePlus" : "basic";
      business.products = normalizeProducts(business.products);
    }
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
      paymentMode: paymentMode(),
      razorpayKeyId: RAZORPAY_KEY_ID,
      oemPlans: OEM_PLANS,
      gstLookupMode: gstLookupConfigured() ? "provider" : "manual",
      gstProvider: GST_PROVIDER === "sandbox" ? "Sandbox GST" : GST_API_URL ? "Configured GST service" : ""
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

function addDays(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function moneyText(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN")}`;
}

function normalizeProducts(products) {
  if (!Array.isArray(products)) return [];
  return products.map((product) => {
    if (typeof product === "string") return { name: product.trim(), gemUrl: "" };
    return {
      name: String(product?.name || "").trim(),
      gemUrl: String(product?.gemUrl || product?.gemLink || "").trim(),
      category: String(product?.category || "").trim()
    };
  }).filter((product) => product.name);
}

function parseProductsInput(value) {
  if (Array.isArray(value)) return normalizeProducts(value);
  return String(value || "")
    .split("\n")
    .map((line) => {
      const [name = "", gemUrl = "", category = ""] = line.split("|").map((item) => item.trim());
      return { name, gemUrl, category };
    })
    .filter((product) => product.name);
}

function oemPlanForProfile(profile) {
  if (profile?.domePlusPaidUntil && profile.domePlusPaidUntil >= new Date().toISOString().slice(0, 10)) return OEM_PLANS.domePlus;
  return OEM_PLANS.basic;
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
  const products = normalizeProducts(profile.products);
  const plan = profile.role === "OEM" ? oemPlanForProfile(profile) : null;
  business.category = profile.role === "OEM" ? (products[0]?.category || profile.primaryCategory || "General") : (profile.lookingForCategories?.[0] || "General");
  business.city = profile.city || business.city || "";
  business.rating = business.rating || 4.2;
  business.network = profile.role === "OEM" ? `${Number(profile.ordersCompleted || 0).toLocaleString("en-IN")} orders` : `${Number(profile.ordersCompleted || 0).toLocaleString("en-IN")} orders`;
  business.phone = profile.contactList?.[0]?.phone || profile.phone || user.phone;
  business.email = profile.contactList?.[0]?.email || user.email;
  business.gemUrl = profile.gemLink || business.gemUrl || "https://gem.gov.in";
  business.description = profile.about || `${business.name} is building its GeM growth profile on Dome.`;
  business.products = profile.role === "OEM" ? products.slice(0, plan.productLimit) : products;
  business.productCount = products.length;
  business.productLimit = plan?.productLimit || products.length;
  business.oemPlan = plan?.id || "";
  business.domePlusPaidUntil = profile.domePlusPaidUntil || "";
  business.highlights = [
    `${Number(profile.ordersCompleted || 0).toLocaleString("en-IN")} GeM orders completed`,
    profile.gstNumber ? "GST captured" : "GST pending",
    profile.role === "OEM" ? `${plan.name} microsite` : "Reseller profile"
  ];
}

function profileForUser(db, user) {
  return db.businessProfiles.find((profile) => profile.userId === user.id || profile.userEmail === user.email);
}

function revealedContactsForUser(db, user) {
  return db.revealPurchases
    .filter((item) => item.userId === user.id)
    .map((item) => {
      const business = db.businesses.find((entry) => entry.id === item.businessId);
      if (!business) return null;
      return {
        businessId: business.id,
        businessName: business.name,
        unlockedAt: item.revealedAt,
        gemUrl: business.gemUrl || "https://gem.gov.in"
      };
    })
    .filter(Boolean);
}

function authorizationRequestsForUser(db, user) {
  const isOem = user.role === "OEM" && user.businessId;
  const isAdminUser = user.role === "Admin";
  return db.authorizationRequests
    .filter((request) => isAdminUser
      ? true
      : isOem
      ? request.oemId === user.businessId
      : request.userId === user.id || request.userEmail === user.email || request.email === user.email)
    .map((request) => ({
      id: request.id,
      oemId: request.oemId,
      oemName: request.oemName,
      vendorName: request.vendorName,
      contactName: request.contactName,
      category: request.category,
      brand: request.brand || request.oemName,
      reference: request.reference || `DOME-${request.id.slice(0, 8).toUpperCase()}`,
      gemSellerId: request.gemSellerId || "",
      requestedProducts: request.requestedProducts || "",
      territory: request.territory || "",
      city: request.city || "",
      state: request.state || "",
      ordersCompleted: Number(request.ordersCompleted || 0),
      authorizationNumber: request.authorizationNumber || "",
      authorizationAgency: request.authorizationAgency || "",
      authorizationDate: request.authorizationDate || "",
      validFrom: request.validFrom || "",
      validTo: request.validTo || "",
      adminNote: request.adminNote || "",
      status: request.status,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt || request.createdAt,
      timeline: request.timeline || []
    }));
}

function paymentMode() {
  return PAYMENT_MODE === "razorpay" && RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET ? "razorpay" : "mock";
}

function gstLookupConfigured() {
  if (GST_PROVIDER === "sandbox") return Boolean(GST_SANDBOX_API_KEY && GST_SANDBOX_API_SECRET);
  return Boolean(GST_API_URL && GST_API_KEY);
}

async function sandboxGstAccessToken() {
  if (gstSandboxToken.value && gstSandboxToken.expiresAt > Date.now()) return gstSandboxToken.value;
  const response = await fetch(`${GST_SANDBOX_BASE_URL}/authenticate`, {
    method: "POST",
    headers: {
      "x-api-key": GST_SANDBOX_API_KEY,
      "x-api-secret": GST_SANDBOX_API_SECRET,
      "x-api-version": "1.0.0",
      "content-type": "application/json"
    }
  });
  const payload = await response.json().catch(() => ({}));
  const token = payload?.data?.access_token;
  if (!response.ok || !token) throw new Error("GST provider authentication failed.");
  gstSandboxToken = { value: token, expiresAt: Date.now() + 23 * 60 * 60 * 1000 };
  return token;
}

async function lookupGstin(gstNumber) {
  if (GST_PROVIDER === "sandbox") {
    const token = await sandboxGstAccessToken();
    const response = await fetch(`${GST_SANDBOX_BASE_URL}/gst/compliance/public/gstin/search`, {
      method: "POST",
      headers: {
        "x-api-key": GST_SANDBOX_API_KEY,
        authorization: token,
        "x-api-version": "1.0.0",
        "x-accept-cache": "true",
        "content-type": "application/json"
      },
      body: JSON.stringify({ gstin: gstNumber })
    });
    const payload = await response.json().catch(() => ({}));
    const result = payload?.data?.data;
    if (!response.ok || !result || typeof result !== "object") throw new Error("GSTIN was not found by the GST provider.");
    return { provider: "sandbox", result };
  }

  let providerUrl;
  if (GST_API_URL.includes("{gstin}")) {
    providerUrl = GST_API_URL.replace("{gstin}", encodeURIComponent(gstNumber));
  } else {
    const url = new URL(GST_API_URL);
    url.searchParams.set("gstin", gstNumber);
    providerUrl = url.toString();
  }
  const response = await fetch(providerUrl, {
    headers: { [GST_API_KEY_HEADER]: `${GST_API_KEY_PREFIX}${GST_API_KEY}` }
  });
  if (!response.ok) throw new Error("GST provider lookup failed.");
  const providerResult = await response.json();
  const result = providerResult.data || providerResult.result || providerResult;
  if (!result || typeof result !== "object") throw new Error("GST provider returned an unreadable record.");
  return { provider: "custom", result };
}

function paymentService(service) {
  if (service === "oem_dome_plus") {
    return {
      service,
      label: "Dome+ OEM microsite",
      amount: OEM_PLANS.domePlus.price,
      currency: "INR",
      activates: "domePlus"
    };
  }
  if (service === "contact_bundle") {
    return {
      service,
    label: "OEM authorization request bundle",
      amount: REVEAL_BUNDLE_PRICE,
      currency: "INR",
      activates: "contactBundle"
    };
  }
  return null;
}

async function createRazorpayOrder(payment) {
  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      authorization: `Basic ${auth}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      amount: payment.amount * 100,
      currency: payment.currency,
      receipt: payment.id.slice(0, 40),
      notes: {
        service: payment.service,
        payer: payment.payer
      }
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.description || "Could not create Razorpay order.");
  return data;
}

function verifyRazorpaySignature(orderId, paymentId, signature) {
  const expected = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const received = String(signature || "");
  if (received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

function activatePaidService(db, user, payment) {
  if (payment.service === "contact_bundle") {
    const bundle = {
      id: crypto.randomUUID(),
      userId: user.id,
      creditsTotal: REVEAL_BUNDLE_CREDITS,
      creditsRemaining: REVEAL_BUNDLE_CREDITS,
      amount: REVEAL_BUNDLE_PRICE,
      status: payment.status,
      paymentId: payment.id,
      createdAt: new Date().toISOString()
    };
    db.revealBundles.unshift(bundle);
    addAudit(db, user.email, "contact_bundle_activated", `${REVEAL_BUNDLE_CREDITS} credits`);
    return { bundle };
  }
  if (payment.service !== "oem_dome_plus") return null;
  const profile = profileForUser(db, user);
  if (!profile || profile.role !== "OEM") throw new Error("Save an OEM profile before upgrading to Dome+.");
  profile.oemPlan = "domePlus";
  profile.domePlusPaidUntil = addDays(DOME_PLUS_DAYS);
  profile.micrositePaidUntil = profile.domePlusPaidUntil;
  profile.updatedAt = new Date().toISOString();
  syncBusinessFromProfile(db, user, profile);
  user.role = "OEM";
  user.businessName = profile.businessName || user.businessName;
  user.profileComplete = profile.completion >= 80;
  addAudit(db, user.email, "dome_plus_activated", profile.domePlusPaidUntil);
  return profile;
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
  const acceptedPurposes = purpose === "registration"
    ? ["registration", "access"]
    : purpose === "login"
      ? ["login", "access"]
      : [purpose];
  return db.otps.some((entry) => {
    const entryTarget = entry.target || entry.phone;
    return entryTarget === target
      && entry.channel === channel
      && entry.verified
      && (!entry.purpose || acceptedPurposes.includes(entry.purpose))
      && new Date(entry.expiresAt).getTime() > Date.now();
  });
}

async function api(req, res, pathname) {
  const db = await ensureDb();
  const tokenUser = verifyToken(req);

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
    db.otps = db.otps.filter((otp) => (otp.target || otp.phone) !== target || otp.channel !== channel);
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
    const code = String(payload.code || "").trim();
    if (!/^\d{6}$/.test(code)) return json(res, 422, { error: "Enter the 6-digit verification code." });
    const codeHash = crypto.createHash("sha256").update(code).digest("hex");
    const record = [...db.otps].reverse().find((otp) => (otp.target || otp.phone) === target && otp.channel === channel && otp.codeHash === codeHash && new Date(otp.expiresAt).getTime() > Date.now());
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

  if (req.method === "POST" && pathname === "/api/session/otp") {
    const payload = await readBody(req);
    const { channel, target } = otpTarget(payload);
    if (channel === "phone" && !isPhone(target)) return json(res, 422, { error: "Enter a valid mobile number." });
    if (channel === "email" && !isEmail(target)) return json(res, 422, { error: "Enter a valid email address." });
    if (!hasVerifiedOtp(db, target, channel, "login")) return json(res, 422, { error: "Please verify the code first." });
    const user = db.users.find((item) => channel === "phone" ? item.phone === target : item.email === target);
    if (!user) return json(res, 404, { error: "No Dome account found for this verified identity." });
    if (user.status !== "approved") return json(res, 403, { error: `Your account is ${user.status}.` });
    addAudit(db, user.email, "otp_login", channel);
    await saveDb();
    return json(res, 200, { ok: true, token: signToken(user), user: cleanUser(user), profile: profileForUser(db, user) || null, revealedContacts: revealedContactsForUser(db, user), authorizationRequests: authorizationRequestsForUser(db, user) });
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
    if (!tokenUser) return json(res, 401, { error: "Sign in required to request OEM authorization." });
    const liveUser = db.users.find((user) => user.id === tokenUser.id);
    if (!liveUser) return json(res, 401, { error: "Session user not found." });
    if (!["Reseller", "Vendor"].includes(liveUser.role)) return json(res, 403, { error: "Only a completed Reseller profile can request OEM authorization." });
    const payload = await readBody(req);
    const missing = required(payload, ["oemId", "category"]);
    if (missing.length) return json(res, 422, { error: `Missing required fields: ${missing.join(", ")}` });
    const oem = db.businesses.find((item) => item.id === payload.oemId && item.type === "OEM");
    if (!oem) return json(res, 404, { error: "OEM profile not found." });
    const requesterProfile = profileForUser(db, liveUser);
    if (!requesterProfile || requesterProfile.role !== "Reseller" || !requesterProfile.gemSellerId) return json(res, 422, { error: "Add your GeM Seller ID to the Reseller profile before requesting authorization." });
    const existing = db.authorizationRequests.find((item) => item.userId === liveUser.id && item.oemId === oem.id && !["Rejected", "Declined", "Closed"].includes(item.status));
    if (existing) return json(res, 200, { ok: true, request: authorizationRequestsForUser(db, liveUser).find((item) => item.id === existing.id), existing: true });
    const createdAt = new Date().toISOString();
    const request = {
      id: crypto.randomUUID(),
      userId: liveUser.id,
      userEmail: liveUser.email,
      oemId: oem.id,
      oemName: oem.name,
      vendorName: requesterProfile?.businessName || liveUser.businessName || "Dome member",
      contactName: requesterProfile?.contactPerson || liveUser.businessName || "Dome member",
      email: liveUser.email,
      phone: normalizePhone(liveUser.phone),
      category: String(payload.category).trim(),
      brand: oem.name,
      gemSellerId: requesterProfile.gemSellerId,
      requestedProducts: String(payload.requestedProducts || "").trim(),
      territory: [requesterProfile.city, requesterProfile.state].filter(Boolean).join(", "),
      city: requesterProfile.city || "",
      state: requesterProfile.state || "",
      ordersCompleted: Number(requesterProfile.ordersCompleted || 0),
      status: "Under Consideration",
      timeline: [{ stage: "Request submitted", at: createdAt, by: requesterProfile.businessName || liveUser.businessName || "Reseller" }, { stage: "Under Consideration", at: createdAt, by: oem.name }],
      createdAt
    };
    request.reference = `DOME-${request.id.slice(0, 8).toUpperCase()}`;
    db.authorizationRequests.unshift(request);
    addAudit(db, "system", "authorization_requested", `${request.vendorName} -> ${oem.name}`);
    await saveDb();
    return json(res, 201, { ok: true, request: authorizationRequestsForUser(db, liveUser).find((item) => item.id === request.id) });
  }

  const authorizationStatusMatch = pathname.match(/^\/api\/authorization\/([^/]+)\/status$/);
  if (req.method === "POST" && authorizationStatusMatch) {
    if (!tokenUser) return json(res, 401, { error: "Sign in required." });
    const liveUser = db.users.find((user) => user.id === tokenUser.id);
    if (!liveUser) return json(res, 401, { error: "Session user not found." });
    const adminUpdate = liveUser.role === "Admin" && isAdmin(req);
    if (!adminUpdate && (liveUser.role !== "OEM" || !liveUser.businessId)) return json(res, 403, { error: "Only the requested OEM or Dome admin can update this authorization request." });
    const request = db.authorizationRequests.find((item) => item.id === authorizationStatusMatch[1]);
    if (!request) return json(res, 404, { error: "Authorization request not found." });
    if (!adminUpdate && request.oemId !== liveUser.businessId) return json(res, 403, { error: "This request belongs to another OEM." });
    const payload = await readBody(req);
    const status = String(payload.status || "");
    if (!["Under Consideration", "Accepted", "Rejected"].includes(status)) return json(res, 422, { error: "Choose Under Consideration, Accepted or Rejected." });
    const validFrom = String(payload.validFrom || "");
    const validTo = String(payload.validTo || "");
    if (validFrom && validTo && validFrom > validTo) return json(res, 422, { error: "Authorization validity end date must be after the start date." });
    const previousStatus = request.status;
    request.status = status;
    request.authorizationNumber = String(payload.authorizationNumber || "").trim();
    request.authorizationAgency = String(payload.authorizationAgency || "").trim();
    request.authorizationDate = String(payload.authorizationDate || "");
    request.validFrom = validFrom;
    request.validTo = validTo;
    if (adminUpdate) request.adminNote = String(payload.adminNote || "").trim();
    request.updatedAt = new Date().toISOString();
    request.timeline ||= [];
    if (previousStatus !== status) request.timeline.push({ stage: status, at: request.updatedAt, by: adminUpdate ? "Dome Admin" : liveUser.businessName || "OEM" });
    if (status === "Accepted") request.acceptedAt = request.updatedAt;
    if (status === "Rejected") request.rejectedAt = request.updatedAt;
    addAudit(db, liveUser.email, `authorization_${status.toLowerCase().replaceAll(" ", "_")}`, `${request.vendorName} -> ${request.oemName}`);
    await saveDb();
    return json(res, 200, { ok: true, request: authorizationRequestsForUser(db, liveUser).find((item) => item.id === request.id) });
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

  if (req.method === "GET" && pathname === "/api/me") {
    if (!tokenUser) return json(res, 401, { error: "Sign in required." });
    const liveUser = db.users.find((user) => user.id === tokenUser.id) || tokenUser;
    return json(res, 200, { user: cleanUser(liveUser), profile: profileForUser(db, liveUser) || null, revealedContacts: revealedContactsForUser(db, liveUser), authorizationRequests: authorizationRequestsForUser(db, liveUser) });
  }

  if (req.method === "GET" && pathname === "/api/profile") {
    if (!tokenUser) return json(res, 401, { error: "Sign in required." });
    const liveUser = db.users.find((user) => user.id === tokenUser.id);
    if (!liveUser) return json(res, 401, { error: "Session user not found." });
    return json(res, 200, { user: cleanUser(liveUser), profile: profileForUser(db, liveUser) || null, revealedContacts: revealedContactsForUser(db, liveUser), authorizationRequests: authorizationRequestsForUser(db, liveUser) });
  }

  if (req.method === "POST" && pathname === "/api/profile") {
    if (!tokenUser) return json(res, 401, { error: "Sign in required." });
    const liveUser = db.users.find((user) => user.id === tokenUser.id);
    if (!liveUser) return json(res, 401, { error: "Session user not found." });
    const payload = await readBody(req);
    if (!["OEM", "Reseller", "Buyer"].includes(payload.role)) return json(res, 422, { error: "Choose OEM, Reseller or Buyer before saving the profile." });
    const role = payload.role;
    if (role === "OEM" && !String(payload.gstNumber || "").trim()) return json(res, 422, { error: "GST Number is required for an OEM profile." });
    if (role === "Reseller" && !String(payload.gemSellerId || "").trim()) return json(res, 422, { error: "GeM Seller ID is required for a Reseller profile." });
    const previousProfile = profileForUser(db, liveUser);
    const previousDomePlusUntil = previousProfile?.domePlusPaidUntil || previousProfile?.micrositePaidUntil || "";
    const products = parseProductsInput(payload.products);
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
      products,
      contactList: Array.isArray(payload.contactList) ? payload.contactList.map((contact) => ({
        designation: String(contact?.designation || contact?.purpose || "").trim(),
        purpose: String(contact?.designation || contact?.purpose || "").trim(),
        name: String(contact?.name || "").trim(),
        phone: normalizePhone(contact?.phone || ""),
        email: String(contact?.email || "").toLowerCase().trim()
      })).filter((item) => item.purpose || item.name || item.phone || item.email) : String(payload.contactList || "").split("\n").map((line) => {
        const [purpose = "", name = "", phone = "", email = ""] = line.split("|").map((item) => item.trim());
        return { purpose, name, phone, email };
      }).filter((item) => item.purpose || item.name || item.phone || item.email),
      about: String(payload.about || "").trim(),
      gstLookup: payload.gstLookup || null,
      oemPlan: role === "OEM" && previousDomePlusUntil >= todayString() ? "domePlus" : "basic",
      domePlusPaidUntil: role === "OEM" ? previousDomePlusUntil : "",
      micrositePaidUntil: role === "OEM" ? previousDomePlusUntil : "",
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
    syncBusinessFromProfile(db, liveUser, profile);
    addAudit(db, liveUser.email, "profile_saved", `${role} profile ${profile.completion}%`);
    await saveDb();
    return json(res, 200, { ok: true, user: cleanUser(liveUser), profile });
  }

  if (req.method === "POST" && pathname === "/api/payments/start") {
    if (!tokenUser) return json(res, 401, { error: "Sign in required." });
    const liveUser = db.users.find((user) => user.id === tokenUser.id);
    if (!liveUser) return json(res, 401, { error: "Session user not found." });
    const payload = await readBody(req);
    const service = paymentService(payload.service);
    if (!service) return json(res, 422, { error: "Payment service not found." });
    if (service.service === "oem_dome_plus") {
      const profile = profileForUser(db, liveUser);
      if (!profile || profile.role !== "OEM") return json(res, 422, { error: "Save an OEM profile before upgrading to Dome+." });
    }

    const mode = paymentMode();
    const payment = {
      id: crypto.randomUUID(),
      userId: liveUser.id,
      userEmail: liveUser.email,
      service: service.service,
      label: service.label,
      payer: liveUser.businessName || liveUser.email,
      amount: service.amount,
      currency: service.currency,
      provider: mode,
      status: mode === "mock" ? "paid_mock" : "created",
      createdAt: new Date().toISOString()
    };

    let activation = null;
    let checkout = null;
    if (mode === "mock") {
      activation = activatePaidService(db, liveUser, payment);
      payment.paidAt = new Date().toISOString();
    } else {
      const order = await createRazorpayOrder(payment);
      payment.providerOrderId = order.id;
      checkout = {
        key: RAZORPAY_KEY_ID,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        name: "Dome by PrintoDome",
        description: service.label,
        prefill: {
          name: liveUser.businessName || "",
          email: liveUser.email,
          contact: liveUser.phone || ""
        }
      };
    }

    db.payments.unshift(payment);
    addAudit(db, liveUser.email, mode === "mock" ? "mock_payment_completed" : "payment_order_created", service.label);
    await saveDb();
    return json(res, 200, { ok: true, mode, payment, checkout, user: cleanUser(liveUser), profile: profileForUser(db, liveUser) || null, activation });
  }

  if (req.method === "POST" && pathname === "/api/payments/verify") {
    if (!tokenUser) return json(res, 401, { error: "Sign in required." });
    const liveUser = db.users.find((user) => user.id === tokenUser.id);
    if (!liveUser) return json(res, 401, { error: "Session user not found." });
    const payload = await readBody(req);
    const payment = db.payments.find((item) => item.id === payload.paymentId && item.userId === liveUser.id);
    if (!payment) return json(res, 404, { error: "Payment not found." });
    if (payment.status === "paid" || payment.status === "paid_mock") return json(res, 200, { ok: true, payment, user: cleanUser(liveUser), profile: profileForUser(db, liveUser) || null });
    if (payment.provider !== "razorpay") return json(res, 422, { error: "This payment does not need Razorpay verification." });
    const orderId = String(payload.razorpay_order_id || "");
    const paymentId = String(payload.razorpay_payment_id || "");
    const signature = String(payload.razorpay_signature || "");
    if (orderId !== payment.providerOrderId || !verifyRazorpaySignature(orderId, paymentId, signature)) {
      payment.status = "verification_failed";
      await saveDb();
      return json(res, 422, { error: "Payment verification failed." });
    }
    payment.status = "paid";
    payment.providerPaymentId = paymentId;
    payment.paidAt = new Date().toISOString();
    const activation = activatePaidService(db, liveUser, payment);
    addAudit(db, liveUser.email, "payment_verified", payment.label);
    await saveDb();
    return json(res, 200, { ok: true, payment, user: cleanUser(liveUser), profile: profileForUser(db, liveUser) || null, activation });
  }

  if (req.method === "POST" && pathname === "/api/gst/lookup") {
    const payload = await readBody(req);
    const gstNumber = String(payload.gstNumber || "").trim().toUpperCase();
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstNumber)) return json(res, 422, { error: "Enter a valid 15-character GSTIN." });
    if (gstLookupConfigured()) {
      try {
        const lookup = await lookupGstin(gstNumber);
        return json(res, 200, { ok: true, mode: "provider", provider: lookup.provider, result: lookup.result });
      } catch (error) {
        return json(res, 502, { error: error.message || "GST provider lookup failed." });
      }
    }
    return json(res, 503, { error: "Automatic GST lookup is not connected yet. Enter the business details manually." });
  }

  if (req.method === "POST" && pathname === "/api/reveal-contact") {
    if (!tokenUser) return json(res, 401, { error: "Sign in required to request OEM authorization." });
    const liveUser = db.users.find((user) => user.id === tokenUser.id);
    if (!liveUser) return json(res, 401, { error: "Session user not found." });
    if (!["Reseller", "Vendor"].includes(liveUser.role)) return json(res, 403, { error: "Only Reseller profiles can start OEM authorization requests." });
    const requesterProfile = profileForUser(db, liveUser);
    if (!requesterProfile?.gemSellerId) return json(res, 422, { error: "Add your GeM Seller ID before starting an OEM authorization request." });
    const payload = await readBody(req);
    const business = db.businesses.find((item) => item.id === payload.businessId && item.type === "OEM");
    if (!business) return json(res, 404, { error: "OEM profile not found." });
    const mode = paymentMode();
    let bundle = db.revealBundles.find((item) => item.userId === liveUser.id && item.creditsRemaining > 0);
    if (!bundle && mode !== "mock") {
      return json(res, 402, {
        error: `Purchase ${REVEAL_BUNDLE_CREDITS} OEM authorization requests for ${moneyText(REVEAL_BUNDLE_PRICE)} before starting this request.`,
        paymentRequiredService: "contact_bundle",
        price: REVEAL_BUNDLE_PRICE,
        credits: REVEAL_BUNDLE_CREDITS
      });
    }
    if (!bundle) {
      bundle = {
        id: crypto.randomUUID(),
        userId: liveUser.id,
        creditsTotal: REVEAL_BUNDLE_CREDITS,
        creditsRemaining: mode === "mock" ? REVEAL_BUNDLE_CREDITS : 0,
        amount: REVEAL_BUNDLE_PRICE,
        status: mode === "mock" ? "paid_mock" : "provider_pending",
        createdAt: new Date().toISOString()
      };
      db.revealBundles.unshift(bundle);
      db.payments.unshift({
        id: crypto.randomUUID(),
        service: "OEM authorization request bundle",
        payer: liveUser.businessName || liveUser.email,
        amount: REVEAL_BUNDLE_PRICE,
        status: bundle.status,
        createdAt: bundle.createdAt
      });
    }
    if (bundle.creditsRemaining <= 0) {
      await saveDb();
      return json(res, 402, { error: "Payment is required before starting this authorization request.", bundle });
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
    addAudit(db, liveUser.email, "authorization_form_unlocked", business.name);
    await saveDb();
    return json(res, 200, {
      ok: true,
      paymentMode: mode,
      bundle,
      reveal,
      unlock: {
        businessId: business.id,
        businessName: business.name,
        unlockedAt: reveal.revealedAt,
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
