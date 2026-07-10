const state = {
  boot: null,
  route: location.hash.slice(1) || "/",
  user: JSON.parse(localStorage.getItem("domeUser") || "null"),
  token: localStorage.getItem("domeToken") || "",
  adminKey: localStorage.getItem("domeAdminKey") || (["localhost", "127.0.0.1"].includes(location.hostname) ? "DOMEADMIN" : ""),
  menuOpen: false,
  filters: { search: "", type: "All", category: "All" },
  admin: null,
  adminTab: "applications",
  profile: null,
  gstLookup: null,
  gstLookupTarget: "",
  loginMode: "phone",
  identity: {
    phone: "",
    email: "",
    phoneOtp: "",
    emailOtp: "",
    phoneCodeSent: false,
    emailCodeSent: false,
    phoneVerified: false,
    emailVerified: false
  },
  loginIdentity: {
    phone: "",
    email: "",
    phoneOtp: "",
    emailOtp: "",
    phoneCodeSent: false,
    emailCodeSent: false,
    phoneVerified: false,
    emailVerified: false,
    phoneVerifying: false,
    emailVerifying: false,
    needsRegistration: false,
    consent: false,
    marketingConsent: false
  },
  revealedContacts: {},
  authorizationRequests: [],
  productDraftRows: null
};

const app = document.querySelector("#app");
let gstLookupTimer = null;

const money = (value) => `Rs ${Number(value || 0).toLocaleString("en-IN")}`;
const today = () => new Date().toISOString().slice(0, 10);
const oemPlans = () => state.boot?.config?.oemPlans || {};

function productName(product) {
  return typeof product === "string" ? product : product?.name || "";
}

function productGemUrl(product) {
  return typeof product === "string" ? "" : product?.gemUrl || product?.gemLink || "";
}

function productInputValue(products = []) {
  return products.map((product) => {
    const name = productName(product);
    const gemUrl = productGemUrl(product);
    return [name, gemUrl].filter(Boolean).join(" | ");
  }).join("\n");
}

function productRowsFromForm(form) {
  return [...form.querySelectorAll("[data-product-row]")].map((row) => ({
    name: row.querySelector('[name="productName"]')?.value.trim() || "",
    gemUrl: row.querySelector('[name="productGemUrl"]')?.value.trim() || "",
    category: row.querySelector('[name="productCategory"]')?.value.trim() || ""
  })).filter((product) => product.name || product.gemUrl || product.category);
}

function productEditorRows(products = []) {
  const rows = state.productDraftRows || products.map((product) => ({
    name: productName(product),
    gemUrl: productGemUrl(product),
    category: product?.category || ""
  }));
  return rows.length ? rows : [{ name: "", gemUrl: "", category: "" }];
}

function currentOemPlan(entity = {}) {
  const plans = oemPlans();
  return entity.oemPlan === "domePlus" || (entity.domePlusPaidUntil && entity.domePlusPaidUntil >= today())
    ? plans.domePlus
    : plans.basic;
}

function displayType(type) {
  return type === "Vendor" ? "Reseller" : type;
}

function gstStateName(code) {
  return ({
    "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand",
    "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar",
    "19": "West Bengal", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
    "27": "Maharashtra", "29": "Karnataka", "32": "Kerala", "33": "Tamil Nadu", "36": "Telangana",
    "37": "Andhra Pradesh"
  })[String(code || "").padStart(2, "0")] || "";
}

function gstKey(value) {
  return String(value || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function formatGstValue(value) {
  if (Array.isArray(value)) return value.map(formatGstValue).filter(Boolean).join(", ");
  if (value && typeof value === "object") {
    const addressKeys = ["flno", "bno", "bnm", "st", "loc", "city", "dst", "stcd", "pncd"];
    const parts = addressKeys.map((key) => value[key]).filter(Boolean);
    if (parts.length) return [...new Set(parts.map(String))].join(", ");
    return "";
  }
  return String(value || "").trim();
}

function pickGstValue(result, keys) {
  for (const requestedKey of keys) {
    const wanted = gstKey(requestedKey);
    let found = "";
    function visit(value) {
      if (found || !value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        if (gstKey(key) === wanted) {
          const formatted = formatGstValue(child);
          if (formatted) {
            found = formatted;
            return;
          }
        }
        visit(child);
        if (found) return;
      }
    }
    visit(result);
    if (found) return found;
  }
  return "";
}

function applyGstLookupToForm(form, result) {
  const tradeName = pickGstValue(result, ["tradeName", "tradeNam", "trade_name", "businessName"]);
  const legalName = pickGstValue(result, ["legalName", "legalNam", "lgnm"]);
  const businessName = tradeName || legalName;
  const stateCode = pickGstValue(result, ["stateCode", "stcd"]);
  const gstState = pickGstValue(result, ["stateName", "state", "pradrState", "stcd"]) || gstStateName(stateCode);
  const city = pickGstValue(result, ["city", "district", "dst", "pradrCity", "loc"]);
  const address = pickGstValue(result, ["address", "principalPlace", "pradrAdr", "addr"]);
  const nature = pickGstValue(result, ["natureOfBusiness", "nba", "businessNature"]);
  const constitution = pickGstValue(result, ["constitution", "constitutionOfBusiness", "ctb"]);
  const status = pickGstValue(result, ["status", "gstStatus", "sts"]);
  const contactPerson = pickGstValue(result, ["contactPerson", "authorizedSignatory", "authorisedSignatory", "proprietorName"]);
  if (form.elements.businessName && businessName) form.elements.businessName.value = businessName;
  if (form.elements.state && gstState) form.elements.state.value = gstState;
  if (form.elements.city && city) form.elements.city.value = city;
  if (form.elements.contactPerson && contactPerson && !form.elements.contactPerson.value) form.elements.contactPerson.value = contactPerson;
  if (form.elements.about && !form.elements.about.value && (businessName || address || nature)) {
    const identity = [constitution, nature ? `engaged in ${nature}` : ""].filter(Boolean).join(" business ");
    const location = [city, gstState].filter(Boolean).join(", ");
    form.elements.about.value = [
      `${businessName || "The organization"} is a ${identity || "GST-registered business"}${location ? ` based in ${location}` : ""}.`,
      address ? `Registered business address: ${address}.` : "",
      status ? `GST status: ${status}.` : ""
    ].filter(Boolean).join(" ");
  }
}

async function api(path, options = {}) {
  const headers = { "content-type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.authorization = `Bearer ${state.token}`;
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Request failed");
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Could not load Razorpay Checkout."));
    document.head.appendChild(script);
  });
}

async function performPayment(service) {
  const result = await api("/api/payments/start", { method: "POST", body: JSON.stringify({ service }) });
  if (result.mode === "mock") return result;
  await loadRazorpayCheckout();
  const checkout = result.checkout;
  return new Promise((resolve, reject) => {
    const razorpay = new Razorpay({
      key: checkout.key,
      amount: checkout.amount,
      currency: checkout.currency,
      name: checkout.name,
      description: checkout.description,
      order_id: checkout.orderId,
      prefill: checkout.prefill,
      theme: { color: "#0d6b58" },
      handler: async (response) => {
        try {
          resolve(await api("/api/payments/verify", {
            method: "POST",
            body: JSON.stringify({ paymentId: result.payment.id, ...response })
          }));
        } catch (error) {
          reject(error);
        }
      },
      modal: {
        ondismiss: () => reject(new Error("Payment was not completed."))
      }
    });
    razorpay.open();
  });
}

function setRoute(route) {
  location.hash = route;
}

function resetLoginIdentity() {
  state.loginIdentity = {
    phone: "", email: "", phoneOtp: "", emailOtp: "",
    phoneCodeSent: false, emailCodeSent: false,
    phoneVerified: false, emailVerified: false,
    phoneVerifying: false, emailVerifying: false,
    needsRegistration: false, consent: false, marketingConsent: false
  };
}

function routeParameter(name) {
  const query = state.route.split("?")[1] || "";
  return new URLSearchParams(query).get(name) || "";
}

function safeReturnRoute() {
  const route = routeParameter("next");
  return route.startsWith("/") && !route.startsWith("//") ? route : "";
}

function storeSession(result) {
  state.user = result.user;
  state.profile = result.profile || null;
  state.revealedContacts = Object.fromEntries((result.revealedContacts || []).map((item) => [item.businessId, item]));
  state.authorizationRequests = result.authorizationRequests || [];
  state.token = result.token;
  localStorage.setItem("domeUser", JSON.stringify(result.user));
  localStorage.setItem("domeToken", result.token);
}

function continueAfterLogin(result) {
  storeSession(result);
  const next = safeReturnRoute();
  setRoute(result.user.role === "Admin" ? "/admin" : next || "/dashboard");
}

async function createAccountFromLogin() {
  if (!state.loginIdentity.emailVerified) return;
  if (!state.loginIdentity.consent) {
    notice("Accept the Terms and Privacy Policy to create your account.", "error", "#loginCodeNotice");
    focusFirstInvalid(document.querySelector("#loginForm"));
    return;
  }
  try {
    const result = await api("/api/register", {
      method: "POST",
      body: JSON.stringify({
        phone: state.loginIdentity.phone,
        email: state.loginIdentity.email,
        consent: state.loginIdentity.consent,
        marketingConsent: state.loginIdentity.marketingConsent
      })
    });
    storeSession(result);
    const next = safeReturnRoute();
    if (next) localStorage.setItem("domePostProfileRoute", next);
    setRoute("/profile-setup");
  } catch (error) {
    notice(error.message, "error", "#loginCodeNotice");
  }
}

async function verifyRegistrationOtp(channel) {
  const verifyingKey = `${channel}Verifying`;
  const otpKey = `${channel}Otp`;
  if (state.identity[verifyingKey] || state.identity[`${channel}Verified`]) return;
  const code = state.identity[otpKey];
  if (!/^\d{6}$/.test(code)) return;
  state.identity[verifyingKey] = true;
  notice("Checking code...", "", `#${channel}CodeNotice`);
  try {
    await api("/api/otp/verify", {
      method: "POST",
      body: JSON.stringify({ channel, [channel]: state.identity[channel], code })
    });
    state.identity[`${channel}Verified`] = true;
    render();
    notice(channel === "email" ? "Email verified." : "Mobile verified.", "success", `#${channel}CodeNotice`);
  } catch (error) {
    state.identity[otpKey] = "";
    render();
    notice(error.message, "error", `#${channel}CodeNotice`);
    document.querySelector(`[data-otp-code="${channel}"]`)?.focus();
  } finally {
    state.identity[verifyingKey] = false;
  }
}

async function verifyLoginOtp(channel) {
  const verifyingKey = `${channel}Verifying`;
  const otpKey = `${channel}Otp`;
  if (state.loginIdentity[verifyingKey]) return;
  const code = state.loginIdentity[otpKey];
  if (!/^\d{6}$/.test(code)) return;
  state.loginIdentity[verifyingKey] = true;
  notice("Checking code...", "", "#loginCodeNotice");
  try {
    await api("/api/otp/verify", {
      method: "POST",
      body: JSON.stringify({ channel, [channel]: state.loginIdentity[channel], code })
    });
    state.loginIdentity[`${channel}Verified`] = true;

    if (channel === "email" && state.loginIdentity.needsRegistration) {
      render();
      notice("Email verified. Your Dome account is ready to create.", "success", "#loginCodeNotice");
      if (state.loginIdentity.consent) await createAccountFromLogin();
      return;
    }

    const result = await api("/api/session/otp", {
      method: "POST",
      body: JSON.stringify({ channel, [channel]: state.loginIdentity[channel] })
    });
    continueAfterLogin(result);
  } catch (error) {
    if (channel === "phone" && error.status === 404 && state.loginIdentity.phoneVerified) {
      state.loginIdentity.needsRegistration = true;
      state.loginIdentity.email = "";
      state.loginIdentity.emailOtp = "";
      state.loginIdentity.emailCodeSent = false;
      render();
      notice("Mobile verified. Add and verify your email to create your Dome account.", "success", "#loginCodeNotice");
      return;
    }
    state.loginIdentity[otpKey] = "";
    render();
    notice(error.message, "error", "#loginCodeNotice");
    document.querySelector(`[data-login-otp="${channel}"]`)?.focus();
  } finally {
    state.loginIdentity[verifyingKey] = false;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function navLink(route, label) {
  return `<a class="nav-link ${state.route === route ? "active" : ""}" href="#${route}">${label}</a>`;
}

function shell(content) {
  const userLabel = state.user ? `${state.user.role}: ${state.user.businessName}` : "";
  return `
    <div class="shell">
      ${state.user ? `
        <div class="auth-strip">
          <div class="auth-strip-inner">
            <strong>${escapeHtml(userLabel)}</strong>
            <button class="button small ghost" data-action="logout">Log out</button>
          </div>
        </div>` : ""}
      <header class="topbar">
        <nav class="nav" aria-label="Main navigation">
          <a class="brand" href="#/">
            <span class="brand-mark">D</span>
            <span>Dome <small>by PrintoDome</small></span>
          </a>
          <div class="nav-links">
            ${navLink("/", "Home")}
            ${navLink("/about", "About Dome")}
            ${navLink("/directory", "OEMs/Resellers")}
            ${navLink("/learn", "Learn")}
            ${navLink("/webinars", "Webinars")}
            ${state.user ? navLink("/dashboard", "Dashboard") : ""}
            ${state.user?.role === "Admin" ? navLink("/admin", "Admin") : ""}
          </div>
          <div class="nav-actions">
            ${state.user ? `<button class="button small secondary" data-action="logout">Log out</button>` : `<a class="nav-link" href="#/login">Log in</a><a class="button" href="#/login">Join Dome</a>`}
          </div>
          <button class="menu-button" data-action="toggle-menu" aria-label="Menu">Menu</button>
        </nav>
        <div class="mobile-panel ${state.menuOpen ? "open" : ""}">
          ${navLink("/", "Home")}
          ${navLink("/about", "About Dome")}
          ${navLink("/directory", "OEMs/Resellers")}
          ${navLink("/learn", "Learn")}
          ${navLink("/webinars", "Webinars")}
          ${state.user ? `${navLink("/dashboard", "Dashboard")}<button class="button small secondary" data-action="logout">Log out</button>` : `<a class="nav-link" href="#/login">Log in</a><a class="button" href="#/login">Join Dome</a>`}
          ${state.user?.role === "Admin" ? navLink("/admin", "Admin") : ""}
        </div>
      </header>
      ${content}
      ${footer()}
    </div>
  `;
}

function footer() {
  return `
    <footer class="footer">
      <div class="footer-inner">
        <div>
          <div class="brand"><span class="brand-mark">D</span><span>Dome <small>by PrintoDome</small></span></div>
          <p>The growth platform for businesses building serious OEM, reseller and buyer relationships around GeM.</p>
        </div>
        <div>
          <strong>Community</strong>
          <a href="#/about">About Dome</a>
          <a href="#/learn">Learn hub</a>
          <a href="#/webinars">Webinars</a>
        </div>
        <div>
          <strong>For Business</strong>
          <a href="#/directory?type=OEM">Discover OEMs</a>
          <a href="#/login">Become a reseller</a>
          <a href="#/login">List as an OEM</a>
        </div>
        <div>
          <strong>Dome</strong>
          <a href="#/dashboard">Member dashboard</a>
          <a href="#/login">Verified signup</a>
          <a href="#/about">How it works</a>
        </div>
      </div>
    </footer>
  `;
}

function businessCard(item) {
  return `
    <a class="card profile-card" href="#/profile/${item.id}">
      <div class="avatar">${escapeHtml(item.initials)}</div>
      <h3>${escapeHtml(item.name)}</h3>
      <div class="tags">
        <span class="tag">${escapeHtml(displayType(item.type))}</span>
        <span class="tag">${escapeHtml(item.category)}</span>
        ${item.badge ? `<span class="tag dark">${escapeHtml(item.badge)}</span>` : ""}
      </div>
      <p>${escapeHtml(item.description)}</p>
      <div class="meta-row">
        <span>${escapeHtml(item.network)}</span>
        <span>${escapeHtml(item.city)}</span>
        <span>${escapeHtml(item.rating)} rating</span>
      </div>
    </a>
  `;
}

function homePage() {
  const featured = state.boot.businesses.slice(0, 6).map(businessCard).join("");
  return shell(`
    <main>
      <section class="hero">
        <div class="hero-inner">
          <p class="eyebrow">The business network built for GeM growth</p>
          <h1>Build the partnerships behind every GeM opportunity.</h1>
          <p>Dome brings OEMs, resellers and buyers into one trusted network for discovery, authorization, product visibility and channel growth.</p>
          <div class="hero-actions">
            <a class="button" href="#/login">Join Dome</a>
            <a class="button secondary" href="#/directory">Explore OEMs/Resellers</a>
          </div>
          <div class="hero-stats" aria-label="Platform signals">
            <div class="hero-stat"><strong>23 lakh+</strong><span>sellers on GeM</span></div>
            <div class="hero-stat"><strong>10,900+</strong><span>product categories</span></div>
            <div class="hero-stat"><strong>4 roles</strong><span>OEM, Reseller, Buyer, Admin</span></div>
            <div class="hero-stat"><strong>5 requests</strong><span>per authorization bundle</span></div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="section-head">
            <div>
              <p class="eyebrow">Pick your path</p>
              <h2>Three ways to grow with Dome</h2>
            </div>
          </div>
          <div class="grid three">
            <article class="card">
              <h3>Build your GeM readiness</h3>
              <p>Practical guidance for registration, catalogues, compliance, bidding and fulfilment.</p>
              <a class="button secondary" href="#/learn">Learn the basics</a>
            </article>
            <article class="card">
              <h3>Grow as a Reseller</h3>
              <p>Find OEMs, request authorization, track the relationship and show Buyers which OEMs you represent.</p>
              <a class="button secondary" href="#/login">Join as Reseller</a>
            </article>
            <article class="card">
              <h3>Enable as an OEM</h3>
              <p>Build a reseller network, share rate lists and sales kits, and make your catalogue visible to Resellers and Buyers.</p>
              <a class="button secondary" href="#/login">List as OEM</a>
            </article>
          </div>
        </div>
      </section>

      <section class="section alt">
        <div class="container">
          <div class="section-head">
            <div>
              <p class="eyebrow">Directory</p>
              <h2>OEMs and Resellers already shaped for launch</h2>
            </div>
            <a class="button" href="#/directory">View all</a>
          </div>
          <div class="grid three">${featured}</div>
        </div>
      </section>

      <section class="section dark">
        <div class="container">
          <div class="section-head">
            <div>
              <p class="eyebrow">A clearer workflow</p>
              <h2>Dome helps members move from profile to partnership conversations.</h2>
            </div>
          </div>
          <div class="grid four">
            ${["Create a verified account", "Complete your business profile", "Request OEM authorization", "Track progress and enquiries"].map((text, index) => `
              <article class="card">
                <div class="dot">${index + 1}</div>
                <h3>${text}</h3>
                <p>${index === 2 ? "Submit a structured request through Dome and follow its progress from review to OEM action." : "Move from verified identity to a credible profile, relevant discovery and active business relationships."}</p>
              </article>
            `).join("")}
          </div>
        </div>
      </section>
    </main>
  `);
}

function aboutPage() {
  return shell(`
    <main class="page">
      <header class="page-head">
        <p class="eyebrow">About Dome</p>
        <h1>The network that turns GeM participation into business growth.</h1>
        <p>Winning on GeM takes more than an account. It takes the right catalogue, credible partners, timely authorization, current product information and a team that can move from opportunity to fulfilment. Dome brings that commercial journey into one focused platform.</p>
      </header>
      <section class="section">
        <div class="container grid three">
          <article class="card"><span class="tag">For OEMs</span><h2>Turn product strength into channel reach.</h2><p>Publish a credible microsite, keep GeM product links current, receive structured authorization requests and build a reseller network that can carry the catalogue into more opportunities.</p></article>
          <article class="card"><span class="tag">For Resellers</span><h2>Find the right OEMs and move with context.</h2><p>Show where you sell, what categories you understand and what you have delivered. Request authorization through a managed workflow and track every reachout from your dashboard.</p></article>
          <article class="card"><span class="tag">For Buyers</span><h2>Discover businesses with a clearer operating picture.</h2><p>Explore OEM and reseller profiles, product coverage and GeM links in a network built for business discovery around public procurement.</p></article>
        </div>
      </section>
      <section class="section alt">
        <div class="container split about-split">
          <div>
            <p class="eyebrow">The Dome advantage</p>
            <h2>One place for the work between registration and revenue.</h2>
            <p class="lead-copy">GeM is where official marketplace actions happen. Dome is where businesses become ready for those actions and build the relationships that make them productive.</p>
          </div>
          <div class="timeline">
            ${[
              ["Get ready", "Use practical learning and a role-specific profile to organize the business information that matters."],
              ["Get discovered", "Present products, GeM links, categories, reach and operating experience in a searchable network."],
              ["Build authorization", "Route reseller requests through Dome with verified account and profile context already attached."],
              ["Grow the network", "Give OEMs and resellers a shared view of relationship progress, active products and next actions."]
            ].map(([title, text], index) => `<div class="timeline-step"><span class="dot">${index + 1}</span><div><h3>${title}</h3><p>${text}</p></div></div>`).join("")}
          </div>
        </div>
      </section>
      <section class="section dark">
        <div class="container boundary-copy">
          <p class="eyebrow">Built around GeM, clear about the boundary</p>
          <h2>Dome keeps the commercial journey connected while GeM remains the official marketplace.</h2>
          <p>Dome helps members prepare, learn, publish profiles, discover partners, exchange authorization context and track relationship progress. When a step becomes an official marketplace action - registration, catalogue submission, OEM verification on GeM, bidding, order acceptance, invoicing or another transaction - the member completes it on GeM.</p>
          <p>That boundary is a feature: Dome gives the network a dependable place to coordinate without confusing a business-enablement platform with the government marketplace itself.</p>
          <div class="hero-actions"><a class="button" href="#/login">Join Dome</a><a class="button secondary" href="#/directory">Explore the network</a></div>
        </div>
      </section>
    </main>
  `);
}

function directoryResults() {
  const { search, type, category } = state.filters;
  const results = state.boot.businesses.filter((item) => {
    const haystack = `${item.name} ${item.type} ${item.category} ${item.secondaryCategory || ""} ${item.city} ${item.description}`.toLowerCase();
    return (!search || haystack.includes(search.toLowerCase()))
      && (type === "All" || item.type === type)
      && (category === "All" || item.category === category || item.secondaryCategory === category);
  });
  return results.length ? `<div class="grid three">${results.map(businessCard).join("")}</div>` : `<div class="empty">No businesses match those filters yet.</div>`;
}

function directoryPage() {
  const { search, type, category } = state.filters;

  return shell(`
    <main class="page">
      <header class="page-head">
        <p class="eyebrow">OEMs and Resellers on Dome</p>
        <h1>Find an OEM or Reseller to grow with.</h1>
        <p>Search by business name, city, category or role. Sign in or register to send enquiries and use Dome's managed authorization workflow.</p>
      </header>
      <div class="container">
        <div class="filters">
          <input class="input" data-filter="search" placeholder="Search by name, city, category..." value="${escapeHtml(search)}">
          <select class="select" data-filter="type">
            <option value="All" ${type === "All" ? "selected" : ""}>All</option>
            <option value="OEM" ${type === "OEM" ? "selected" : ""}>OEM</option>
            <option value="Vendor" ${type === "Vendor" ? "selected" : ""}>Reseller</option>
          </select>
          <select class="select" data-filter="category">
            ${["All", ...state.boot.categories].map((option) => `<option ${option === category ? "selected" : ""}>${option}</option>`).join("")}
          </select>
        </div>
        <div id="directoryResults">${directoryResults()}</div>
      </div>
    </main>
  `);
}

function profilePage(id) {
  const business = state.boot.businesses.find((item) => item.id === id);
  if (!business) return shell(`<main class="page"><div class="container empty">Profile not found.</div></main>`);
  const isOem = business.type === "OEM";
  const isOwner = Boolean(state.user?.businessId && state.user.businessId === business.id);
  const revealed = state.revealedContacts[business.id];
  const plan = isOem ? currentOemPlan(business) : null;
  const productLimit = plan?.productLimit || business.productLimit || (business.products || []).length;
  const totalProducts = business.productCount || (business.products || []).length;
  const authorized = (business.authorizedOems || []).map((oemId) => state.boot.businesses.find((item) => item.id === oemId)).filter(Boolean);

  return shell(`
    <main>
      <section class="profile-hero">
        <div class="profile-hero-inner">
          <div>
            <p class="eyebrow">${escapeHtml(displayType(business.type))} profile</p>
            <h1>${escapeHtml(business.name)}</h1>
            <div class="tags">
              <span class="tag">${escapeHtml(business.category)}</span>
              <span class="tag">${escapeHtml(business.city)}</span>
              <span class="tag">${escapeHtml(business.rating)} rating</span>
              ${business.badge ? `<span class="tag">${escapeHtml(business.badge)}</span>` : ""}
            </div>
            <p>${escapeHtml(business.description)}</p>
            <div class="hero-actions">
              ${isOem && revealed ? `<a class="button" href="#/request-authorization/${business.id}">Request authorization</a>` : ""}
              ${isOem && !revealed && !isOwner && state.user ? `<button class="button secondary" data-action="reveal-contact" data-business-id="${business.id}">Start authorization request - ${money(state.boot.config.revealBundlePrice)} / ${state.boot.config.revealBundleCredits} OEMs</button>` : ""}
              ${isOem && !revealed && !isOwner && !state.user ? `<a class="button" href="#/login?next=${encodeURIComponent(`/profile/${business.id}`)}">Request authorization through Dome</a>` : ""}
              ${isOem && isOwner ? `<a class="button secondary" href="#/profile-setup">Edit microsite</a>` : ""}
              ${!isOem ? `<a class="button secondary" href="#/contact/${business.id}">Send enquiry</a>` : ""}
            </div>
            <div id="revealNotice" class="profile-message">
              ${isOem && !revealed && !isOwner ? `<p class="notice warn">${state.user ? "Start a paid authorization request and send it directly to the OEM for review." : "Enter your mobile number to continue. Existing members sign in; new members create an account in the same flow."}</p>` : ""}
              ${isOem && revealed ? `<p class="notice success"><strong>Authorization form unlocked.</strong><br>Submit your request directly to the OEM for approval.</p>` : ""}
            </div>
          </div>
          <div class="big-avatar">${escapeHtml(business.initials)}</div>
        </div>
      </section>
      <section class="section">
        <div class="container split">
          <div class="grid">
            <article class="card">
              <h2>${isOem ? "Products on this microsite" : "Authorized OEMs"}</h2>
              ${isOem ? `
                <div class="plan-strip">
                  <span class="tag dark">${escapeHtml(plan?.name || "Basic")} microsite</span>
                  <span class="muted">${Math.min(totalProducts, productLimit)} of ${productLimit} product slots visible${isOwner && totalProducts > productLimit ? ` (${totalProducts - productLimit} saved for Dome+)` : ""}</span>
                </div>
                <div class="grid two">${(business.products || []).slice(0, productLimit).map((product) => `
                  <div class="product-card">
                    <strong>${escapeHtml(productName(product))}</strong>
                    <span>${escapeHtml(business.category)} catalogue item</span>
                    ${productGemUrl(product) ? `<a class="inline-link" href="${escapeHtml(productGemUrl(product))}" target="_blank" rel="noreferrer">Open GeM listing</a>` : `<span class="muted">GeM link can be added by the OEM</span>`}
                  </div>
                `).join("")}</div>
              ` : authorized.length ? `
                <div class="grid two">${authorized.map((oem) => `<a class="notice" href="#/profile/${oem.id}"><strong>${escapeHtml(oem.name)}</strong><br><span class="muted">${escapeHtml(oem.category)} - GeM profile</span></a>`).join("")}</div>
              ` : `<div class="empty">No active OEM partnerships are visible yet.</div>`}
            </article>
            <article class="card">
              <h2>${isOem ? (isOwner ? "OEM plan" : "Authorization through Dome") : "Sales enablement"}</h2>
              ${isOem && isOwner ? `
                <div class="plan-card ${plan?.id === "domePlus" ? "featured" : ""}">
                  <div>
                    <span class="tag">${escapeHtml(plan?.name || "Basic")}</span>
                    <h3>${escapeHtml(plan?.headline || "OEM microsite")}</h3>
                    <p>${plan?.id === "domePlus" ? "This OEM can publish a larger catalogue and is ready for deeper reseller discovery." : "Basic keeps the OEM discoverable with a focused catalogue. Dome+ expands product slots and reseller growth tools."}</p>
                  </div>
                  ${plan?.id === "domePlus" ? `<strong class="price-line">Active</strong>` : `<strong class="price-line">${money(oemPlans().domePlus?.price || 4999)} / year</strong>`}
                </div>
              ` : isOem ? `
                <p class="notice">Dome collects reseller authorization requests and sends them to the right OEM workflow. OEM phone and email are not shown publicly.</p>
              ` : `
                <p class="notice">Sales kits are available to authorized resellers.</p>
                <div class="tags">${(business.kits || ["Brochures", "Rate list", "Bid samples"]).map((kit) => `<span class="tag">${escapeHtml(kit)}</span>`).join("")}</div>
              `}
            </article>
          </div>
          <aside class="grid">
            <article class="card">
              <h2>Highlights</h2>
              <div class="timeline">${(business.highlights || []).map((item, index) => `<div class="timeline-step"><span class="dot">${index + 1}</span><p>${escapeHtml(item)}</p></div>`).join("")}</div>
            </article>
            <article class="card">
              <h2>GeM profile</h2>
              <p>Open this business on GeM when you are ready to continue the official process.</p>
              <a class="button secondary" href="${escapeHtml(business.gemUrl || "https://gem.gov.in")}" target="_blank" rel="noreferrer">Open GeM</a>
            </article>
          </aside>
        </div>
      </section>
    </main>
  `);
}

function learnPage() {
  return shell(`
    <main class="page">
      <header class="page-head">
        <p class="eyebrow">Learn hub</p>
        <h1>Practical knowledge for every stage of GeM growth.</h1>
        <p>Build readiness, understand catalogue and authorization workflows, and strengthen the operating habits behind successful fulfilment.</p>
      </header>
      <div class="container learn-layout">
        <section class="learn-section">
          <div class="section-head"><div><p class="eyebrow">Start here</p><h2>Guides and playbooks</h2></div></div>
          <div class="grid three">${state.boot.content.guides.map((item) => `
            <article class="card learn-card">
              <span class="tag">${escapeHtml(item.kind)}</span>
              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(item.summary)}</p>
              <div class="learn-card-footer"><span class="muted">${item.minutes} min read</span><a class="inline-link" href="#/learn/${escapeHtml(item.slug)}">Read guide</a></div>
            </article>
          `).join("")}</div>
        </section>
        <section class="learn-section">
          <div class="section-head"><div><p class="eyebrow">Dome field notes</p><h2>From the blog</h2></div></div>
          <div class="grid three">${state.boot.content.articles.map((item) => `
            <article class="card learn-card">
              <span class="tag">${escapeHtml(item.tag)}</span>
              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(item.summary)}</p>
              <div class="learn-card-footer"><span class="muted">${item.minutes} min read</span><a class="inline-link" href="#/learn/${escapeHtml(item.slug)}">Read article</a></div>
            </article>
          `).join("")}</div>
        </section>
      </div>
    </main>
  `);
}

function learnArticlePage(slug) {
  const items = [...state.boot.content.guides, ...state.boot.content.articles];
  const item = items.find((entry) => entry.slug === slug);
  if (!item) return shell(`<main class="page"><div class="container empty">Learning article not found.</div></main>`);
  return shell(`
    <main class="page article-page">
      <header class="page-head article-head">
        <a class="back-link" href="#/learn">Back to Learn</a>
        <p class="eyebrow">${escapeHtml(item.kind || item.tag)} · ${item.minutes} min read</p>
        <h1>${escapeHtml(item.title)}</h1>
        <p>${escapeHtml(item.intro)}</p>
        <div class="tags"><span class="tag dark">For ${escapeHtml(item.audience)}</span></div>
      </header>
      <div class="container article-layout">
        <article class="article-body">
          ${item.sections.map((section) => `
            <section>
              <h2>${escapeHtml(section.title)}</h2>
              ${(section.paragraphs || []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
              ${section.bullets?.length ? `<ul>${section.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>` : ""}
            </section>
          `).join("")}
          <div class="notice"><strong>Use the live rule.</strong><br>GeM processes and category requirements can change. Confirm the current requirement on GeM before an official action.</div>
        </article>
        <aside class="article-sources">
          <div class="card">
            <p class="eyebrow">Official references</p>
            <h2>Continue with GeM</h2>
            <p>These official materials support this guide and are the right place to verify the current process.</p>
            ${item.sources.map((source) => `<a class="source-link" href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.label)}<span>Open source</span></a>`).join("")}
          </div>
        </aside>
      </div>
    </main>
  `);
}

function webinarsPage() {
  return shell(`
    <main class="page">
      <header class="page-head">
        <p class="eyebrow">Webinars and events</p>
        <h1>Learn live, with the OEMs.</h1>
        <p>Register for practical live sessions with OEMs and the Dome team.</p>
      </header>
      <div class="container grid three">
        ${state.boot.webinars.map((item) => `
          <article class="card">
            <span class="tag">${escapeHtml(item.status)}</span>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.summary)}</p>
            <div class="meta-row">
              <span>${escapeHtml(item.date)}</span>
              <span>${escapeHtml(item.time)}</span>
              <span>${escapeHtml(item.language)}</span>
            </div>
            <p><strong>${item.fee ? money(item.fee) : "Free replay"}</strong> with ${escapeHtml(item.host)}</p>
            <a class="button secondary" href="#/webinar/${item.id}">${item.status === "Replay" ? "Get replay link" : "Register"}</a>
          </article>
        `).join("")}
      </div>
    </main>
  `);
}

function registerPage() {
  const phoneSent = state.identity.phoneCodeSent;
  const emailSent = state.identity.emailCodeSent;
  return shell(`
    <main class="page">
      <header class="page-head">
        <p class="eyebrow">Verified identity</p>
        <h1>Create your Dome account.</h1>
        <p>Create a secure Dome account, then shape the business profile your partners will discover and trust.</p>
      </header>
      <div class="container split">
        <form class="card" id="registerForm">
          <div id="formNotice"></div>
          <div class="verify-stack">
            <section class="verify-card ${state.identity.phoneVerified ? "verified" : ""}">
              <div class="verify-head">
                <span class="step-dot">${state.identity.phoneVerified ? "✓" : "1"}</span>
                <div><h3>Mobile number</h3><p>Your secure sign-in for Dome.</p></div>
              </div>
              <div class="verify-fields ${phoneSent ? "has-code" : ""}">
                <label><span class="label">Mobile number</span><input class="input" name="phone" data-identity-field="phone" placeholder="+91XXXXXXXXXX" required value="${escapeHtml(state.identity.phone)}" ${state.identity.phoneVerified ? "readonly" : ""}></label>
                ${phoneSent && !state.identity.phoneVerified ? `<label><span class="label">Verification code</span><input class="input otp-input" name="phoneOtp" data-otp-code="phone" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="6 digits" value="${escapeHtml(state.identity.phoneOtp)}" autofocus></label>` : ""}
              </div>
              <div class="form-actions compact">
                ${!state.identity.phoneVerified ? `<button class="button secondary" type="button" data-action="send-register-code" data-channel="phone">${phoneSent ? "Send again" : "Send code"}</button>` : `<span class="verified-label">Mobile verified</span>`}
              </div>
              ${phoneSent && !state.identity.phoneVerified ? `<p class="auto-verify-hint">The code is checked automatically when all 6 digits are entered.</p>` : ""}
              <div id="phoneCodeNotice" class="step-notice" aria-live="polite"></div>
            </section>
            <section class="verify-card ${state.identity.emailVerified ? "verified" : ""}">
              <div class="verify-head">
                <span class="step-dot">${state.identity.emailVerified ? "✓" : "2"}</span>
                <div><h3>Email address</h3><p>For account records, confirmations and communication.</p></div>
              </div>
              <div class="verify-fields ${emailSent ? "has-code" : ""}">
                <label><span class="label">Email</span><input class="input" name="email" data-identity-field="email" type="email" required value="${escapeHtml(state.identity.email)}" ${state.identity.emailVerified ? "readonly" : ""}></label>
                ${emailSent && !state.identity.emailVerified ? `<label><span class="label">Verification code</span><input class="input otp-input" name="emailOtp" data-otp-code="email" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="6 digits" value="${escapeHtml(state.identity.emailOtp)}"></label>` : ""}
              </div>
              <div class="form-actions compact">
                ${!state.identity.emailVerified ? `<button class="button secondary" type="button" data-action="send-register-code" data-channel="email">${emailSent ? "Send again" : "Send code"}</button>` : `<span class="verified-label">Email verified</span>`}
              </div>
              ${emailSent && !state.identity.emailVerified ? `<p class="auto-verify-hint">The code is checked automatically when all 6 digits are entered.</p>` : ""}
              <div id="emailCodeNotice" class="step-notice" aria-live="polite"></div>
            </section>
          </div>
          <div class="form-grid" style="margin-top:18px">
            <label class="full"><input type="checkbox" name="consent" required> I accept the Terms and Privacy Policy.</label>
            <label class="full"><input type="checkbox" name="marketingConsent"> Send me Dome learning and event updates.</label>
          </div>
          <div class="form-actions">
            <button class="button" type="submit" ${state.identity.phoneVerified && state.identity.emailVerified ? "" : "disabled"}>Create account and continue</button>
          </div>
        </form>
        <aside class="grid">
          <div class="card">
            <h2>A trusted identity first</h2>
            <p>Verified contact details protect the network. Your role, GST record, products, categories and operating experience are added in the next step.</p>
          </div>
          <div class="card">
            <h2>After signup</h2>
            <p>Choose Reseller, OEM or Buyer, complete your profile and begin discovering the right partners.</p>
            <a class="button secondary" href="#/profile-setup">Open profile setup</a>
          </div>
        </aside>
      </div>
    </main>
  `);
}

function loginPage() {
  const isNewAccount = state.loginIdentity.needsRegistration;
  const isPhone = !isNewAccount && state.loginMode === "phone";
  const channel = isNewAccount ? "email" : isPhone ? "phone" : "email";
  const codeSent = state.loginIdentity[`${channel}CodeSent`];
  const isLocalDemo = ["localhost", "127.0.0.1"].includes(location.hostname);
  return shell(`
    <main class="page">
      <header class="page-head">
        <p class="eyebrow">${isNewAccount ? "Create your account" : "Enter Dome"}</p>
        <h1>${isNewAccount ? "One more step to join Dome." : "Continue with your mobile number."}</h1>
        <p>${isNewAccount ? "Your mobile number is verified. Add your email to finish creating your secure account." : "Existing members sign in automatically. New members continue into account setup without starting over."}</p>
      </header>
      <div class="container split">
        <form class="card" id="loginForm">
          <div id="formNotice"></div>
          ${isNewAccount ? `
            <div class="request-identity verified-identity">
              <span class="step-dot">✓</span>
              <div><strong>Mobile verified</strong><p>${escapeHtml(state.loginIdentity.phone)}</p></div>
            </div>
            <label><span class="label">Email address</span><input class="input" name="loginEmail" data-login-field="email" type="email" required value="${escapeHtml(state.loginIdentity.email)}" ${state.loginIdentity.emailVerified ? "readonly" : ""}></label>
            ${codeSent && !state.loginIdentity.emailVerified ? `<label><span class="label">Verification code</span><input class="input otp-input" name="loginEmailOtp" data-login-otp="email" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="6 digits" value="${escapeHtml(state.loginIdentity.emailOtp)}" autofocus></label>` : ""}
            ${!state.loginIdentity.emailVerified ? `<div class="form-actions"><button class="button secondary" type="button" data-action="send-login-code" data-channel="email">${codeSent ? "Send again" : "Send email code"}</button></div>` : `<p class="notice success">Email verified.</p>`}
            <div class="form-grid consent-fields">
              <label class="full"><input type="checkbox" name="consent" data-login-consent="consent" required ${state.loginIdentity.consent ? "checked" : ""}> I accept the Terms and Privacy Policy.</label>
              <label class="full"><input type="checkbox" name="marketingConsent" data-login-consent="marketingConsent" ${state.loginIdentity.marketingConsent ? "checked" : ""}> Send me Dome learning and event updates.</label>
            </div>
            ${state.loginIdentity.emailVerified ? `<div class="form-actions"><button class="button" type="submit">Create account and continue</button></div>` : ""}
          ` : isPhone ? `
            <label><span class="label">Mobile number</span><input class="input" name="loginPhone" data-login-field="phone" placeholder="+919000000001" required value="${escapeHtml(state.loginIdentity.phone)}"></label>
            ${codeSent ? `<label><span class="label">Verification code</span><input class="input otp-input" name="loginPhoneOtp" data-login-otp="phone" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="6 digits" value="${escapeHtml(state.loginIdentity.phoneOtp)}" autofocus></label>` : ""}
            <button class="link-button" type="button" data-login-mode="email">Log in another way</button>
          ` : `
            <label><span class="label">Email</span><input class="input" name="loginEmail" data-login-field="email" type="email" required placeholder="vendor@dome.com" value="${escapeHtml(state.loginIdentity.email)}"></label>
            ${codeSent ? `<label><span class="label">Verification code</span><input class="input otp-input" name="loginEmailOtp" data-login-otp="email" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="6 digits" value="${escapeHtml(state.loginIdentity.emailOtp)}" autofocus></label>` : ""}
            <button class="link-button" type="button" data-login-mode="phone">Use mobile number</button>
          `}
          ${!isNewAccount ? `<div class="form-actions">
            <button class="button secondary" type="button" data-action="send-login-code" data-channel="${channel}">${codeSent ? "Send again" : "Send code"}</button>
          </div>` : ""}
          ${codeSent && !state.loginIdentity[`${channel}Verified`] ? `<p class="auto-verify-hint">The code is checked automatically when all 6 digits are entered.</p>` : ""}
          <div id="loginCodeNotice" class="step-notice" aria-live="polite"></div>
        </form>
        <aside class="grid">
          ${isLocalDemo ? `<div class="card">
            <h2>Demo identities</h2>
            <p>Use code <strong>123456</strong> locally.</p>
            <div class="tags">
              <span class="tag">+919000000001 Reseller</span>
              <span class="tag">+919000000002 OEM</span>
              <span class="tag">+919000000003 Buyer</span>
              <span class="tag">+919000000004 Admin</span>
            </div>
          </div>` : `<div class="card">
            <h2>Secure access</h2>
            <p>Enter your mobile number once. Dome will recognize an existing account or guide a new member through email verification.</p>
          </div>`}
        </aside>
      </div>
    </main>
  `);
}

function dashboardPage() {
  if (!state.user) return loginPage();
  const role = state.user.role;
  const isAdminUser = role === "Admin";
  const isOem = role === "OEM";
  const isVendor = role === "Vendor" || role === "Reseller";
  const cards = isAdminUser ? [
    ["Pending approvals", "Review member applications", "#/admin"],
    ["Setup requests", "Fulfil paid admin-assisted setup", "#/admin"],
    ["Audit trail", "Track platform decisions", "#/admin"]
  ] : isOem ? [
    ["Complete profile", "GST, products, contacts and microsite plan", "#/profile-setup"],
    ["Reseller discovery", "Find capable resellers", "#/directory"],
    ["Authorization requests", "Review incoming reseller requests", "#/dashboard"],
    ["Sales kits", "Share brochures, pricing and sales material", "#/learn"]
  ] : isVendor ? [
    ["Complete profile", "GST, GeM seller ID, categories and order count", "#/profile-setup"],
    ["OEM discovery", "Request authorization from profiles", "#/directory?type=OEM"],
    ["Authorization status", "Track OEM requests submitted through Dome", "#/dashboard"]
  ] : [
    ["Complete profile", "Choose Buyer, Reseller or OEM details", "#/profile-setup"],
    ["Supplier search", "Find OEMs and Resellers", "#/directory"],
    ["Supplier enquiries", "Send structured enquiries from supplier profiles", "#/directory"],
    ["Webinars", "Register for learning sessions", "#/webinars"]
  ];

  return shell(`
    <main class="page">
      <header class="page-head">
        <p class="eyebrow">${escapeHtml(role)} dashboard</p>
        <h1>Welcome back, ${escapeHtml(state.user.businessName)}.</h1>
        <p>${isAdminUser ? "Run the launch queue and monitor captured activity." : "Complete your profile, discover partners and keep your GeM growth activity organized."}</p>
      </header>
      <div class="container grid three">
        ${cards.map(([title, text, href]) => `
          <a class="card profile-card" href="${href}">
            <h3>${title}</h3>
            <p>${text}</p>
          </a>
        `).join("")}
      </div>
      ${isVendor ? `
        <section class="section">
          <div class="container">
            <div class="section-head">
              <div>
                <p class="eyebrow">OEM reachouts</p>
                <h2>Authorization request status</h2>
              </div>
            </div>
            ${state.authorizationRequests.length ? `
              <div class="grid three">${state.authorizationRequests.map((request) => `
                <article class="card status-card">
                  <span class="tag dark">${escapeHtml(request.status)}</span>
                  <h3>${escapeHtml(request.oemName)}</h3>
                  <p>${request.status === "Accepted"
                    ? `Accepted by the OEM for ${escapeHtml(request.category)}. Dome will add the contact-routing step once that workflow is finalized.`
                    : request.status === "Declined"
                      ? `The OEM declined this ${escapeHtml(request.category)} request. You can review the category fit before trying again.`
                      : `${escapeHtml(request.category)} request submitted ${new Date(request.createdAt).toLocaleDateString()} and awaiting OEM review.`}</p>
                  <a class="inline-link" href="#/profile/${escapeHtml(request.oemId)}">Open OEM profile</a>
                </article>
              `).join("")}</div>
            ` : `<div class="empty">No OEM authorization requests yet. Open an OEM profile and start a request when ready.</div>`}
          </div>
        </section>
      ` : ""}
      ${isOem ? `
        <section class="section" id="authorizationRequests">
          <div class="container">
            <div class="section-head">
              <div>
                <p class="eyebrow">Channel pipeline</p>
                <h2>Incoming authorization requests</h2>
              </div>
            </div>
            ${state.authorizationRequests.length ? `
              <div class="grid three">${state.authorizationRequests.map((request) => `
                <article class="card status-card">
                  <span class="tag dark">${escapeHtml(request.status)}</span>
                  <h3>${escapeHtml(request.vendorName || "Dome reseller")}</h3>
                  <p><strong>${escapeHtml(request.category)}</strong><br>Submitted ${new Date(request.createdAt).toLocaleDateString()} by ${escapeHtml(request.contactName || "verified reseller contact")}.</p>
                  ${request.status === "Requested" ? `
                    <p class="muted">Approve or decline this request as the OEM. Contact exchange will be added as a separate routed step.</p>
                    <div class="form-actions compact">
                      <button class="button small" type="button" data-authorization-action="Accepted" data-authorization-id="${escapeHtml(request.id)}">Accept</button>
                      <button class="button small danger" type="button" data-authorization-action="Declined" data-authorization-id="${escapeHtml(request.id)}">Decline</button>
                    </div>
                  ` : `<p class="notice ${request.status === "Accepted" ? "success" : "warn"}">${request.status === "Accepted" ? "Accepted. Contact routing is the next workflow to define." : "Declined by your OEM team."}</p>`}
                </article>
              `).join("")}</div>
            ` : `<div class="empty">No incoming authorization requests yet. New reseller requests for your OEM profile will appear here.</div>`}
          </div>
        </section>
      ` : ""}
    </main>
  `);
}

function profileSetupPage() {
  if (!state.user) return loginPage();
  const role = state.profile?.role || (state.user.role === "OEM" ? "OEM" : state.user.role === "Buyer" ? "Buyer" : "Reseller");
  const isOem = role === "OEM";
  const plan = isOem ? currentOemPlan(state.profile || {}) : null;
  const plans = oemPlans();
  const savedProducts = state.profile?.products || [];
  const productRows = productEditorRows(savedProducts);
  const productLimit = plan?.productLimit || plans.basic?.productLimit || 3;
  const gstAutoEnabled = state.boot.config.gstLookupMode === "provider";
  return shell(`
    <main class="page">
      <header class="page-head">
        <p class="eyebrow">Profile setup</p>
        <h1>Complete your ${escapeHtml(role)} profile.</h1>
        <p>Business details live here, not in registration. This keeps signup fast while still giving Dome the data needed for verification, matching and paid discovery.</p>
      </header>
      <div class="container split">
        <form class="card" id="profileForm">
          <div id="formNotice"></div>
          <div class="form-grid">
            <label><span class="label">I am joining as</span><select class="select" name="role" data-profile-role>
              ${["Reseller", "OEM", "Buyer"].map((item) => `<option ${item === role ? "selected" : ""}>${item}</option>`).join("")}
            </select></label>
            <label><span class="label">Business / organization name</span><input class="input" name="businessName" required value="${escapeHtml(state.profile?.businessName || "")}"></label>
            <label><span class="label">GST Number</span><input class="input" name="gstNumber" maxlength="15" ${gstAutoEnabled ? "data-gst-auto" : ""} value="${escapeHtml(state.profile?.gstNumber || "")}"><span id="gstLookupNotice" class="field-note" aria-live="polite">${gstAutoEnabled ? "" : "Automatic lookup is not connected. Enter the registered details manually."}</span></label>
            <label><span class="label">Orders completed on GeM</span><input class="input" name="ordersCompleted" type="number" min="0" value="${escapeHtml(state.profile?.ordersCompleted || "")}"></label>
            <label><span class="label">State</span><input class="input" name="state" value="${escapeHtml(state.profile?.state || "")}"></label>
            <label><span class="label">City</span><input class="input" name="city" value="${escapeHtml(state.profile?.city || "")}"></label>
            <label><span class="label">Contact person</span><input class="input" name="contactPerson" value="${escapeHtml(state.profile?.contactPerson || "")}"></label>
            ${role === "Reseller" ? `
              <label><span class="label">GeM seller ID</span><input class="input" name="gemSellerId" value="${escapeHtml(state.profile?.gemSellerId || "")}"></label>
              <label class="full"><span class="label">OEM categories looking for</span><input class="input" name="lookingForCategories" placeholder="Printer Cartridges, IT Hardware" value="${escapeHtml((state.profile?.lookingForCategories || []).join(", "))}"></label>
            ` : ""}
            ${role === "OEM" ? `
              <label><span class="label">GeM listing/profile link</span><input class="input" name="gemLink" type="url" value="${escapeHtml(state.profile?.gemLink || "")}"></label>
              <div class="full product-editor">
                <div class="section-head compact">
                  <div>
                    <h3>Products with GeM links</h3>
                    <p class="muted">Basic shows 3 products publicly. Dome+ shows up to 10.</p>
                  </div>
                  <button class="button small secondary" type="button" data-action="add-product-row">Add product</button>
                </div>
                <div class="product-row-list">
                  ${productRows.map((product, index) => `
                    <div class="product-row" data-product-row>
                      <label><span class="label">Product ${index + 1}</span><input class="input" name="productName" value="${escapeHtml(product.name || "")}" placeholder="Product name"></label>
                      <label><span class="label">GeM link</span><input class="input" name="productGemUrl" type="url" value="${escapeHtml(product.gemUrl || "")}" placeholder="https://gem.gov.in/..."></label>
                      <label><span class="label">Category</span><input class="input" name="productCategory" value="${escapeHtml(product.category || "")}" placeholder="Printer Cartridges"></label>
                      ${productRows.length > 1 ? `<button class="button small danger" type="button" data-action="remove-product-row" data-product-index="${index}">Remove</button>` : ""}
                    </div>
                  `).join("")}
                </div>
              </div>
              <label class="full"><span class="label">Contact list</span><textarea class="textarea" name="contactList" placeholder="Purpose | Name | Phone | Email">${escapeHtml((state.profile?.contactList || []).map((item) => [item.purpose, item.name, item.phone, item.email].filter(Boolean).join(" | ")).join("\n"))}</textarea></label>
            ` : ""}
            <label class="full"><span class="label">About the business</span><textarea class="textarea" name="about">${escapeHtml(state.profile?.about || "")}</textarea></label>
          </div>
          <div class="form-actions">
            <button class="button" type="submit">Save profile</button>
          </div>
        </form>
        <aside class="grid">
          <div class="card">
            <h2>Profile completion</h2>
            <p class="notice">${state.profile?.completion || 0}% complete. Profiles above 80% become review-ready for directory and partnership workflows.</p>
          </div>
          <div class="card">
            <h2>GST verification</h2>
            <p>${gstAutoEnabled ? "Enter a valid GSTIN and Dome will fill only the business fields returned by the connected GST provider." : "No GST provider is connected, so Dome will not guess or fabricate business information. Enter the details exactly as they appear on the GST registration."}</p>
            ${state.gstLookup ? `
              <div class="notice success gst-summary">
                <strong>${escapeHtml(pickGstValue(state.gstLookup.result, ["tradeName", "tradeNam", "legalName", "lgnm"]))}</strong>
                <span>${escapeHtml(pickGstValue(state.gstLookup.result, ["status", "gstStatus", "sts"]) || "Record found")}</span>
                <span>${escapeHtml(pickGstValue(state.gstLookup.result, ["constitution", "constitutionOfBusiness", "ctb"]))}</span>
                <span>${escapeHtml(pickGstValue(state.gstLookup.result, ["registrationDate", "rgdt"]))}</span>
              </div>` : ""}
          </div>
          ${isOem ? `
            <div class="card plan-panel">
              <div class="plan-head">
                <span class="tag dark">${escapeHtml(plan?.name || "Basic")}</span>
                <h2>OEM microsite plan</h2>
                <p>${escapeHtml(savedProducts.length)} products saved. ${Math.min(savedProducts.length, productLimit)} can show publicly on your current plan.</p>
              </div>
              <div class="plan-options">
                <div class="plan-option ${plan?.id === "basic" ? "active" : ""}">
                  <strong>Basic</strong>
                  <span>Free forever</span>
                  <p>Public microsite with up to ${plans.basic?.productLimit || 3} products and GeM links.</p>
                </div>
                <div class="plan-option ${plan?.id === "domePlus" ? "active featured" : "featured"}">
                  <strong>Dome+</strong>
                  <span>${money(plans.domePlus?.price || 4999)} / year</span>
                  <p>Up to ${plans.domePlus?.productLimit || 10} products, stronger profile presentation and reseller outreach tools as they launch.</p>
                </div>
              </div>
              ${plan?.id === "domePlus" ? `<p class="notice success">Dome+ active until ${escapeHtml(state.profile?.domePlusPaidUntil || state.profile?.micrositePaidUntil || "next renewal")}.</p>` : `<button class="button" type="button" data-action="upgrade-oem-plan">Upgrade to Dome+</button>`}
            </div>
          ` : ""}
        </aside>
      </div>
    </main>
  `);
}

function simpleFormPage(kind, id = "") {
  const business = state.boot.businesses.find((item) => item.id === id);
  const webinar = state.boot.webinars.find((item) => item.id === id);

  if (kind === "contact" && business) {
    return shell(`
      <main class="page"><div class="container split">
        <header class="page-head"><p class="eyebrow">Enquiry</p><h1>Contact ${escapeHtml(business.name)}.</h1><p>Share your requirement and the business can follow up through Dome.</p></header>
        <form class="card" id="contactForm" data-business-id="${business.id}">
          <div id="formNotice"></div>
          ${contactFields()}
          <label><span class="label">Intent</span><select class="select" name="intent"><option>Buyer enquiry</option><option>Partnership discussion</option><option>Catalogue question</option><option>Support request</option></select></label>
          <label><span class="label">Message</span><textarea class="textarea" name="message" required></textarea></label>
          <div class="form-actions"><button class="button" type="submit">Send enquiry</button></div>
        </form>
      </div></main>`);
  }

  if (kind === "authorization" && business) {
    if (!state.revealedContacts[business.id]) {
      return shell(`
        <main class="page">
          <div class="container split">
            <header class="page-head">
              <p class="eyebrow">Request access required</p>
              <h1>Start the paid request workflow for ${escapeHtml(business.name)}.</h1>
              <p>Dome collects your reseller details, reviews the request and routes it to the OEM team.</p>
              <a class="button" href="#/profile/${business.id}">Go to OEM profile</a>
            </header>
          </div>
        </main>
      `);
    }
    const resellerName = state.profile?.businessName || state.user?.businessName || "";
    const contactName = state.profile?.contactPerson || "";
    const preferredCategories = state.profile?.lookingForCategories || [];
    const categoryOptions = [...new Set([business.category, ...preferredCategories, ...state.boot.categories])];
    return shell(`
      <main class="page"><div class="container split">
        <header class="page-head"><p class="eyebrow">Authorization request</p><h1>Request authorization from ${escapeHtml(business.name)}.</h1><p>Dome will attach your verified account and reseller profile, then send the request directly to the OEM for approval.</p></header>
        <form class="card" id="authorizationForm" data-oem-id="${business.id}">
          <div id="formNotice"></div>
          <div class="request-identity">
            <span class="avatar small-avatar">${escapeHtml((resellerName || "D").split(/\s+/).map((part) => part[0]).join("").slice(0, 2))}</span>
            <div><strong>${escapeHtml(resellerName)}</strong><p>${escapeHtml(contactName || "Profile contact")} · ${escapeHtml(state.user?.email || "")} · ${escapeHtml(state.user?.phone || "")}</p></div>
          </div>
          <label><span class="label">Product category</span><select class="select" name="category" required>${categoryOptions.map((cat) => `<option>${escapeHtml(cat)}</option>`).join("")}</select></label>
          <p class="muted">Need to change these details? <a class="inline-link" href="#/profile-setup">Update your profile</a> before submitting.</p>
          <div class="form-actions"><button class="button" type="submit">Send authorization request</button></div>
        </form>
      </div></main>`);
  }

  if (kind === "webinar" && webinar) {
    const webinarValues = {
      name: state.profile?.contactPerson || state.profile?.contactList?.[0]?.name || state.user?.businessName || "",
      organization: state.profile?.businessName || state.user?.businessName || "",
      email: state.user?.email || "",
      phone: state.user?.phone || ""
    };
    return shell(`
      <main class="page"><div class="container split">
        <header class="page-head"><p class="eyebrow">Webinar registration</p><h1>${escapeHtml(webinar.title)}</h1><p>${escapeHtml(webinar.summary)} Fee: ${webinar.fee ? money(webinar.fee) : "Free"}.</p></header>
        <form class="card" id="webinarForm" data-webinar-id="${webinar.id}">
          <div id="formNotice"></div>
          ${contactFields(true, webinarValues)}
          <div class="form-actions"><button class="button" type="submit">Register</button></div>
          ${webinar.fee ? `<p class="notice warn">Paid sessions reserve your seat after payment confirmation.</p>` : ""}
        </form>
      </div></main>`);
  }

  return shell(`
    <main class="page"><div class="container split">
      <header class="page-head"><p class="eyebrow">Admin-assisted setup</p><h1>Let Dome set up your profile.</h1><p>Share your details and the Dome team can prepare your business profile for review.</p></header>
      <form class="card" id="setupForm">
        <div id="formNotice"></div>
        <label><span class="label">Business name</span><input class="input" name="businessName" required></label>
        <label><span class="label">Role</span><select class="select" name="role"><option>Reseller</option><option>OEM</option></select></label>
        ${contactFields()}
        <label><span class="label">Notes for setup team</span><textarea class="textarea" name="notes"></textarea></label>
        <p class="notice">One-time setup fee: ${money(4999)}.</p>
        <div class="form-actions"><button class="button" type="submit">Request setup</button></div>
      </form>
    </div></main>`);
}

function contactFields(includeOrganization = false, values = {}) {
  return `
    <label><span class="label">Name</span><input class="input" name="name" required value="${escapeHtml(values.name || "")}"></label>
    ${includeOrganization ? `<label><span class="label">Organization</span><input class="input" name="organization" required value="${escapeHtml(values.organization || "")}"></label>` : `<label><span class="label">Organization</span><input class="input" name="organization" value="${escapeHtml(values.organization || "")}"></label>`}
    <label><span class="label">Email</span><input class="input" name="email" type="email" required value="${escapeHtml(values.email || "")}"></label>
    <label><span class="label">Phone</span><input class="input" name="phone" required value="${escapeHtml(values.phone || "")}"></label>
  `;
}

function adminPage() {
  if (state.user?.role !== "Admin") return loginPage();
  const admin = state.admin || { applications: [], businessProfiles: [], contacts: [], authorizationRequests: [], revealPurchases: [], revealBundles: [], setupRequests: [], webinarRegistrations: [], payments: [], auditLog: [] };
  const tab = state.adminTab;
  const rows = {
    applications: admin.applications,
    profiles: admin.businessProfiles || [],
    contacts: admin.contacts,
    authorizations: admin.authorizationRequests,
    reveals: admin.revealPurchases || [],
    bundles: admin.revealBundles || [],
    setup: admin.setupRequests,
    webinars: admin.webinarRegistrations,
    payments: admin.payments,
    audit: admin.auditLog
  };

  return shell(`
    <main class="page">
      <header class="page-head">
        <p class="eyebrow">Admin portal</p>
        <h1>Launch operations queue.</h1>
        <p>Review member applications, authorization requests, setup work, registrations and platform activity.</p>
      </header>
      <div class="container">
        <div class="card">
          <label><span class="label">Admin key</span><input class="input" data-admin-key value="${escapeHtml(state.adminKey)}"></label>
          <div class="form-actions"><button class="button" data-action="load-admin">Load admin data</button></div>
        </div>
        <div class="tabs">
          ${Object.keys(rows).map((name) => `<button class="tab ${tab === name ? "active" : ""}" data-admin-tab="${name}">${name} (${rows[name].length})</button>`).join("")}
        </div>
        ${adminTable(tab, rows[tab])}
      </div>
    </main>
  `);
}

function adminTable(tab, rows) {
  if (!rows.length) return `<div class="empty">No ${tab} records yet.</div>`;
  if (tab === "applications") {
    return `<div class="table-wrap"><table><thead><tr><th>Applicant</th><th>Contact</th><th>Status</th><th>Submitted</th><th>Action</th></tr></thead><tbody>${rows.map((row) => `
      <tr>
        <td><strong>${escapeHtml(row.businessName)}</strong><br>${escapeHtml(row.role)} - ${escapeHtml(row.category)} - ${escapeHtml(row.city)}</td>
        <td>${escapeHtml(row.contactName)}<br>${escapeHtml(row.email)}<br>${escapeHtml(row.phone)}</td>
        <td>${escapeHtml(row.status)}</td>
        <td>${new Date(row.createdAt).toLocaleString()}</td>
        <td>${row.status === "pending" ? `<button class="button small" data-application-action="approved" data-id="${row.id}">Approve</button> <button class="button small danger" data-application-action="rejected" data-id="${row.id}">Reject</button>` : ""}</td>
      </tr>`).join("")}</tbody></table></div>`;
  }

  return `<div class="table-wrap"><table><thead><tr>${Object.keys(rows[0]).slice(0, 7).map((key) => `<th>${escapeHtml(key)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `
    <tr>${Object.values(row).slice(0, 7).map((value) => `<td>${escapeHtml(Array.isArray(value) ? value.length + " items" : value)}</td>`).join("")}</tr>
  `).join("")}</tbody></table></div>`;
}

function notice(message, type = "", selector = "#formNotice") {
  const target = document.querySelector(selector);
  if (target) target.innerHTML = `<p class="notice ${type}">${escapeHtml(message)}</p>`;
}

function formPayload(form) {
  const data = new FormData(form);
  const payload = {};
  for (const [key, value] of data.entries()) {
    payload[key] = value === "on" ? true : value;
  }
  if (form.id === "profileForm") {
    const products = productRowsFromForm(form);
    if (products.length) payload.products = products;
  }
  for (const checkbox of form.querySelectorAll('input[type="checkbox"]')) {
    payload[checkbox.name] = checkbox.checked;
  }
  return payload;
}

function focusFirstInvalid(form) {
  if (!form) return;
  const field = form.querySelector(":invalid");
  if (!field) return;
  field.classList.add("field-invalid");
  field.focus({ preventScroll: true });
  field.scrollIntoView({ behavior: "smooth", block: "center" });
}

function handleInvalid(event) {
  const form = event.target.closest("form");
  if (!form || form.querySelector(":invalid") !== event.target) return;
  requestAnimationFrame(() => focusFirstInvalid(form));
}

async function onSubmit(event) {
  const form = event.target.closest("form");
  if (!form) return;
  event.preventDefault();
  try {
    const payload = formPayload(form);
    if (form.id === "registerForm") {
      const result = await api("/api/register", { method: "POST", body: JSON.stringify(payload) });
      state.user = result.user;
      state.token = result.token;
      localStorage.setItem("domeUser", JSON.stringify(result.user));
      localStorage.setItem("domeToken", result.token);
      notice("Identity verified. Opening profile setup...");
      setTimeout(() => setRoute("/profile-setup"), 500);
    }
    if (form.id === "profileForm") {
      payload.gstLookup = state.gstLookup;
      const result = await api("/api/profile", { method: "POST", body: JSON.stringify(payload) });
      state.user = result.user;
      state.profile = result.profile;
      state.productDraftRows = null;
      localStorage.setItem("domeUser", JSON.stringify(result.user));
      const returnTo = localStorage.getItem("domePostProfileRoute") || "";
      localStorage.removeItem("domePostProfileRoute");
      setRoute(returnTo || "/dashboard");
    }
    if (form.id === "loginForm") {
      if (state.loginIdentity.needsRegistration && state.loginIdentity.emailVerified) await createAccountFromLogin();
    }
    if (form.id === "contactForm") {
      payload.businessId = form.dataset.businessId;
      await api("/api/contact", { method: "POST", body: JSON.stringify(payload) });
      notice("Enquiry sent. The business can follow up from Dome.");
      form.reset();
    }
    if (form.id === "authorizationForm") {
      payload.oemId = form.dataset.oemId;
      const result = await api("/api/authorization", { method: "POST", body: JSON.stringify(payload) });
      state.authorizationRequests = [result.request, ...state.authorizationRequests.filter((request) => request.id !== result.request.id)];
      setRoute("/dashboard");
    }
    if (form.id === "webinarForm") {
      payload.webinarId = form.dataset.webinarId;
      const result = await api("/api/webinar-registration", { method: "POST", body: JSON.stringify(payload) });
      notice(result.registration.accessLink ? `Registered. Access link: ${result.registration.accessLink}` : "Registration saved. Seat confirmation follows payment.");
      form.reset();
    }
    if (form.id === "setupForm") {
      await api("/api/setup-request", { method: "POST", body: JSON.stringify(payload) });
      notice("Setup request received. The Dome team can follow up for payment and profile material.");
      form.reset();
    }
  } catch (error) {
    notice(error.message, "error");
    focusFirstInvalid(form);
  }
}

async function handleClick(event) {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "toggle-menu") {
    state.menuOpen = !state.menuOpen;
    render();
  }
  if (action === "logout") {
    localStorage.removeItem("domeUser");
    localStorage.removeItem("domeToken");
    localStorage.removeItem("domePostProfileRoute");
    state.user = null;
    state.token = "";
    state.profile = null;
    state.revealedContacts = {};
    state.authorizationRequests = [];
    state.productDraftRows = null;
    resetLoginIdentity();
    setRoute("/");
  }
  const modeButton = event.target.closest("[data-login-mode]");
  if (modeButton) {
    state.loginMode = modeButton.dataset.loginMode;
    render();
    return;
  }
  if (action === "send-register-code") {
    const channel = event.target.closest("[data-channel]")?.dataset.channel;
    const form = document.querySelector("#registerForm");
    const field = form.elements[channel];
    if (!field?.checkValidity()) {
      field?.reportValidity();
      focusFirstInvalid(form);
      return;
    }
    try {
      const payload = formPayload(form);
      const body = channel === "email"
        ? { channel, email: payload.email, purpose: "registration" }
        : { channel, phone: payload.phone, purpose: "registration" };
      const result = await api("/api/otp/start", { method: "POST", body: JSON.stringify(body) });
      state.identity[`${channel}CodeSent`] = true;
      state.identity[`${channel}Otp`] = "";
      render();
      notice(result.devCode ? `Code sent. Demo code: ${result.devCode}.` : "Code sent. Enter the 6-digit code below.", "success", `#${channel}CodeNotice`);
    } catch (error) {
      notice(error.message, "error", `#${channel}CodeNotice`);
      field?.focus();
      field?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
  if (action === "verify-register-code") {
    const channel = event.target.closest("[data-channel]")?.dataset.channel;
    await verifyRegistrationOtp(channel);
  }
  if (action === "send-login-code") {
    const channel = event.target.closest("[data-channel]")?.dataset.channel;
    const form = document.querySelector("#loginForm");
    const field = form.elements[channel === "email" ? "loginEmail" : "loginPhone"];
    if (!field?.checkValidity()) {
      field?.reportValidity();
      focusFirstInvalid(form);
      return;
    }
    try {
      const payload = formPayload(form);
      const body = channel === "email"
        ? { channel, email: payload.loginEmail, purpose: state.loginIdentity.needsRegistration ? "registration" : "login" }
        : { channel, phone: payload.loginPhone, purpose: "access" };
      const result = await api("/api/otp/start", { method: "POST", body: JSON.stringify(body) });
      state.loginIdentity[`${channel}CodeSent`] = true;
      state.loginIdentity[`${channel}Otp`] = "";
      render();
      notice(result.devCode ? `Code sent. Demo code: ${result.devCode}.` : "Code sent. Enter the 6-digit code below.", "success", "#loginCodeNotice");
    } catch (error) {
      notice(error.message, "error", "#loginCodeNotice");
      field?.focus();
      field?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
  if (action === "verify-login-code") {
    const channel = event.target.closest("[data-channel]")?.dataset.channel;
    await verifyLoginOtp(channel);
  }
  if (action === "send-phone-otp" || action === "send-otp") {
    const form = document.querySelector("#registerForm");
    try {
      const payload = formPayload(form);
      const result = await api("/api/otp/start", { method: "POST", body: JSON.stringify({ channel: "phone", phone: payload.phone, purpose: "registration" }) });
      notice(result.devCode ? `Phone code sent. Use ${result.devCode}.` : "Phone code sent.");
    } catch (error) {
      notice(error.message, "error");
    }
  }
  if (action === "verify-phone-otp" || action === "verify-otp") {
    const form = document.querySelector("#registerForm");
    try {
      const payload = formPayload(form);
      await api("/api/otp/verify", { method: "POST", body: JSON.stringify({ channel: "phone", phone: payload.phone, code: payload.phoneOtp || payload.otp }) });
      notice("Mobile number verified.");
    } catch (error) {
      notice(error.message, "error");
    }
  }
  if (action === "send-email-otp") {
    const form = document.querySelector("#registerForm");
    try {
      const payload = formPayload(form);
      const result = await api("/api/otp/start", { method: "POST", body: JSON.stringify({ channel: "email", email: payload.email, purpose: "registration" }) });
      notice(result.devCode ? `Email code sent. Use ${result.devCode}.` : "Email code sent.");
    } catch (error) {
      notice(error.message, "error");
    }
  }
  if (action === "verify-email-otp") {
    const form = document.querySelector("#registerForm");
    try {
      const payload = formPayload(form);
      await api("/api/otp/verify", { method: "POST", body: JSON.stringify({ channel: "email", email: payload.email, code: payload.emailOtp }) });
      notice("Email address verified.");
    } catch (error) {
      notice(error.message, "error");
    }
  }
  if (action === "add-product-row") {
    const form = document.querySelector("#profileForm");
    state.productDraftRows = [...productRowsFromForm(form), { name: "", gemUrl: "", category: "" }];
    render();
    return;
  }
  if (action === "remove-product-row") {
    const form = document.querySelector("#profileForm");
    const index = Number(event.target.closest("[data-product-index]")?.dataset.productIndex || 0);
    const rows = productRowsFromForm(form);
    rows.splice(index, 1);
    state.productDraftRows = rows.length ? rows : [{ name: "", gemUrl: "", category: "" }];
    render();
    return;
  }
  if (action === "lookup-gst") {
    const form = document.querySelector("#profileForm");
    try {
      const payload = formPayload(form);
      state.gstLookup = await api("/api/gst/lookup", { method: "POST", body: JSON.stringify({ gstNumber: payload.gstNumber }) });
      applyGstLookupToForm(form, state.gstLookup.result || {});
      notice(`GST lookup ready: ${state.gstLookup.result.tradeName || state.gstLookup.result.legalName}.`);
    } catch (error) {
      notice(error.message, "error");
    }
  }
  if (action === "upgrade-oem-plan") {
    try {
      const result = await performPayment("oem_dome_plus");
      state.user = result.user;
      state.profile = result.profile;
      localStorage.setItem("domeUser", JSON.stringify(result.user));
      render();
      notice(result.mode === "mock" ? `Dome+ activated. ${money(result.payment.amount)} recorded for this demo.` : "Dome+ payment verified and plan activated.");
    } catch (error) {
      notice(error.message, "error");
    }
  }
  if (action === "reveal-contact") {
    const businessId = event.target.closest("[data-business-id]")?.dataset.businessId;
    const target = document.querySelector("#revealNotice");
    if (!state.user || !state.token) {
      setRoute(`/login?next=${encodeURIComponent(`/profile/${businessId}`)}`);
      return;
    }
    try {
      const result = await api("/api/reveal-contact", { method: "POST", body: JSON.stringify({ businessId }) });
      state.revealedContacts[businessId] = result.unlock;
      setRoute(`/request-authorization/${businessId}`);
    } catch (error) {
      if (error.status === 402 && error.data?.paymentRequiredService) {
        try {
          await performPayment(error.data.paymentRequiredService);
          const result = await api("/api/reveal-contact", { method: "POST", body: JSON.stringify({ businessId }) });
          state.revealedContacts[businessId] = result.unlock;
          setRoute(`/request-authorization/${businessId}`);
          return;
        } catch (paymentError) {
          if (target) target.innerHTML = `<p class="notice error">${escapeHtml(paymentError.message)}</p>`;
          return;
        }
      }
      if (target) target.innerHTML = `<p class="notice error">${escapeHtml(error.message)}</p>`;
    }
  }
  if (action === "load-admin") {
    await loadAdmin();
  }

  const demo = event.target.closest("[data-demo-login]");
  if (demo) {
    const email = demo.dataset.demoLogin;
    const password = demo.dataset.demoPassword;
    try {
      const result = await api("/api/session", { method: "POST", body: JSON.stringify({ email, password }) });
      state.user = result.user;
      state.token = result.token;
      localStorage.setItem("domeUser", JSON.stringify(result.user));
      localStorage.setItem("domeToken", result.token);
      setRoute(result.user.role === "Admin" ? "/admin" : "/dashboard");
    } catch (error) {
      notice(error.message, "error");
    }
  }

  const tab = event.target.closest("[data-admin-tab]");
  if (tab) {
    state.adminTab = tab.dataset.adminTab;
    render();
  }

  const authorizationAction = event.target.closest("[data-authorization-action]");
  if (authorizationAction) {
    authorizationAction.disabled = true;
    try {
      const result = await api(`/api/authorization/${authorizationAction.dataset.authorizationId}/status`, {
        method: "POST",
        body: JSON.stringify({ status: authorizationAction.dataset.authorizationAction })
      });
      state.authorizationRequests = state.authorizationRequests.map((request) => request.id === result.request.id ? result.request : request);
      render();
    } catch (error) {
      authorizationAction.disabled = false;
      alert(error.message);
    }
  }

  const applicationAction = event.target.closest("[data-application-action]");
  if (applicationAction) {
    try {
      await api(`/api/admin/applications/${applicationAction.dataset.id}`, {
        method: "POST",
        headers: { "x-admin-key": state.adminKey },
        body: JSON.stringify({ status: applicationAction.dataset.applicationAction })
      });
      await loadAdmin(false);
    } catch (error) {
      alert(error.message);
    }
  }
}

async function loadAdmin(shouldRender = true) {
  const keyInput = document.querySelector("[data-admin-key]");
  if (keyInput) {
    state.adminKey = keyInput.value;
    localStorage.setItem("domeAdminKey", state.adminKey);
  }
  state.admin = await api("/api/admin", { headers: { "x-admin-key": state.adminKey } });
  if (shouldRender) render();
  else render();
}

function handleInput(event) {
  const identityField = event.target.dataset.identityField;
  if (identityField) state.identity[identityField] = event.target.value;

  const loginField = event.target.dataset.loginField;
  if (loginField) state.loginIdentity[loginField] = event.target.value;

  const loginConsent = event.target.dataset.loginConsent;
  if (loginConsent) {
    state.loginIdentity[loginConsent] = event.target.checked;
    if (loginConsent === "consent" && event.target.checked && state.loginIdentity.emailVerified) void createAccountFromLogin();
  }

  const otpChannel = event.target.dataset.otpCode;
  if (otpChannel) {
    event.target.value = event.target.value.replace(/\D/g, "").slice(0, 6);
    state.identity[`${otpChannel}Otp`] = event.target.value;
    if (event.target.value.length === 6) void verifyRegistrationOtp(otpChannel);
  }

  const loginOtpChannel = event.target.dataset.loginOtp;
  if (loginOtpChannel) {
    event.target.value = event.target.value.replace(/\D/g, "").slice(0, 6);
    state.loginIdentity[`${loginOtpChannel}Otp`] = event.target.value;
    if (event.target.value.length === 6) void verifyLoginOtp(loginOtpChannel);
  }

  if (event.target.matches("[data-profile-role]")) {
    state.profile = { ...(state.profile || {}), role: event.target.value };
    state.productDraftRows = null;
    render();
    return;
  }
  if (event.target.matches("[data-gst-auto]")) {
    const input = event.target;
    input.value = input.value.toUpperCase();
    const gstNumber = input.value.trim();
    if (gstLookupTimer) clearTimeout(gstLookupTimer);
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstNumber) || state.gstLookupTarget === gstNumber) return;
    gstLookupTimer = setTimeout(async () => {
      const form = document.querySelector("#profileForm");
      if (!form || form.elements.gstNumber.value.trim().toUpperCase() !== gstNumber) return;
      try {
        state.gstLookupTarget = gstNumber;
        state.gstLookup = await api("/api/gst/lookup", { method: "POST", body: JSON.stringify({ gstNumber }) });
        applyGstLookupToForm(form, state.gstLookup.result || {});
        const gstName = pickGstValue(state.gstLookup.result, ["tradeName", "tradeNam", "legalName", "lgnm"]);
        notice(`GST details found${gstName ? ` for ${gstName}` : ""}. Business fields have been filled where available.`, "success", "#gstLookupNotice");
      } catch (error) {
        notice(error.message, "error", "#gstLookupNotice");
      }
    }, 450);
  }
  const filter = event.target.dataset.filter;
  if (filter) {
    state.filters[filter] = event.target.value;
    const results = document.querySelector("#directoryResults");
    if (results) results.innerHTML = directoryResults();
  }
  if (event.target.matches("[data-admin-key]")) {
    state.adminKey = event.target.value;
  }
}

function render() {
  const [pathname, id] = state.route.split("?")[0].split("/").filter(Boolean);
  const route = state.route.split("?")[0];
  if (state.route.includes("type=OEM")) state.filters.type = "OEM";
  let html;
  if (route === "/" || route === "") html = homePage();
  else if (route === "/about") html = aboutPage();
  else if (route === "/directory") html = directoryPage();
  else if (pathname === "profile") html = profilePage(id);
  else if (route === "/learn") html = learnPage();
  else if (pathname === "learn" && id) html = learnArticlePage(id);
  else if (route === "/webinars") html = webinarsPage();
  else if (route === "/register") html = registerPage();
  else if (route === "/login") html = loginPage();
  else if (route === "/dashboard") html = dashboardPage();
  else if (route === "/profile-setup") html = profileSetupPage();
  else if (route === "/admin") html = adminPage();
  else if (pathname === "contact") html = simpleFormPage("contact", id);
  else if (pathname === "request-authorization") html = simpleFormPage("authorization", id);
  else if (pathname === "webinar") html = simpleFormPage("webinar", id);
  else if (route === "/setup-request") html = simpleFormPage("setup");
  else html = shell(`<main class="page"><div class="container empty">Page not found.</div></main>`);
  app.innerHTML = html;
}

async function refreshAdminOnRoute() {
  if (state.route.split("?")[0] !== "/admin" || state.user?.role !== "Admin") return;
  try {
    state.admin = await api("/api/admin", { headers: { "x-admin-key": state.adminKey } });
    render();
  } catch {
    state.admin = null;
  }
}

async function init() {
  state.boot = await loadBootstrapWithRetry();
  if (state.user && !state.token) {
    localStorage.removeItem("domeUser");
    state.user = null;
  }
  if (state.user?.role === "Admin") {
    try {
      state.admin = await api("/api/admin", { headers: { "x-admin-key": state.adminKey } });
    } catch {
      state.admin = null;
    }
  }
  if (state.user && state.token) {
    try {
      const current = await api("/api/profile");
      state.user = current.user;
      state.profile = current.profile;
      state.revealedContacts = Object.fromEntries((current.revealedContacts || []).map((item) => [item.businessId, item]));
      state.authorizationRequests = current.authorizationRequests || [];
      localStorage.setItem("domeUser", JSON.stringify(current.user));
    } catch (error) {
      state.profile = null;
      if (!state.token || /sign in|required|session/i.test(error.message)) {
        localStorage.removeItem("domeUser");
        localStorage.removeItem("domeToken");
        state.user = null;
        state.token = "";
      }
    }
  }
  render();
}

async function loadBootstrapWithRetry() {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await api("/api/bootstrap");
    } catch (error) {
      lastError = error;
      app.innerHTML = `<div class="loading">Connecting to Dome... retry ${attempt}/4</div>`;
      await new Promise((resolve) => setTimeout(resolve, attempt * 900));
    }
  }
  throw lastError;
}

window.addEventListener("hashchange", () => {
  state.route = location.hash.slice(1) || "/";
  state.menuOpen = false;
  render();
  refreshAdminOnRoute();
  scrollTo({ top: 0, behavior: "instant" });
});

app.addEventListener("click", handleClick);
app.addEventListener("submit", onSubmit);
app.addEventListener("input", handleInput);
app.addEventListener("invalid", handleInvalid, true);

init().catch((error) => {
  app.innerHTML = `
    <div class="loading">
      <div>
        <strong>Could not load Dome yet.</strong>
        <p>${escapeHtml(error.message)}</p>
        <button class="button" onclick="location.reload()">Try again</button>
      </div>
    </div>
  `;
});
