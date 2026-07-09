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
  gstLookup: null
};

const app = document.querySelector("#app");

const money = (value) => `Rs ${Number(value || 0).toLocaleString("en-IN")}`;
const today = () => new Date().toISOString().slice(0, 10);

async function api(path, options = {}) {
  const headers = { "content-type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.authorization = `Bearer ${state.token}`;
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function setRoute(route) {
  location.hash = route;
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
            ${navLink("/about", "About GeM")}
            ${navLink("/directory", "OEMs/Resellers")}
            ${navLink("/learn", "Learn")}
            ${navLink("/webinars", "Webinars")}
            ${state.user ? navLink("/dashboard", "Dashboard") : ""}
            ${state.user?.role === "Admin" ? navLink("/admin", "Admin") : ""}
          </div>
          <div class="nav-actions">
            ${state.user ? "" : `<a class="nav-link" href="#/login">Log in</a><a class="button" href="#/register">Join Dome</a>`}
          </div>
          <button class="menu-button" data-action="toggle-menu" aria-label="Menu">Menu</button>
        </nav>
        <div class="mobile-panel ${state.menuOpen ? "open" : ""}">
          ${navLink("/", "Home")}
          ${navLink("/about", "About GeM")}
          ${navLink("/directory", "OEMs/Resellers")}
          ${navLink("/learn", "Learn")}
          ${navLink("/webinars", "Webinars")}
          ${state.user ? navLink("/dashboard", "Dashboard") : `<a class="nav-link" href="#/login">Log in</a><a class="button" href="#/register">Join Dome</a>`}
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
          <p>The GeM growth community. Learn it, connect both ways, grow together, while all official GeM actions stay on the real GeM portal.</p>
        </div>
        <div>
          <strong>Community</strong>
          <a href="#/about">About GeM</a>
          <a href="#/learn">Learn hub</a>
          <a href="#/webinars">Webinars</a>
        </div>
        <div>
          <strong>For Business</strong>
          <a href="#/directory?type=OEM">Discover OEMs</a>
          <a href="#/register">Become a reseller</a>
          <a href="#/register">List as an OEM</a>
        </div>
        <div>
          <strong>Launch Notes</strong>
          <a href="#/admin">Admin queue</a>
          <a href="#/register">Phone OTP</a>
          <a href="#/about">GeM boundary</a>
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
        <span class="tag">${escapeHtml(item.type)}</span>
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
          <p class="eyebrow">The GeM growth community</p>
          <h1>Where OEMs, vendors and buyers grow beside GeM.</h1>
          <p>Dome helps businesses understand GeM, build authorized OEM-Vendor relationships, share sales kits, and get discovered. Dome never performs official GeM actions; it coordinates the journey around them.</p>
          <div class="hero-actions">
            <a class="button" href="#/register">Join Dome</a>
            <a class="button secondary" href="#/directory">Explore OEMs/Resellers</a>
            <a class="button ghost" href="#/about">Learn the boundary</a>
          </div>
          <div class="hero-stats" aria-label="Platform signals">
            <div class="hero-stat"><strong>23 lakh+</strong><span>sellers on GeM</span></div>
            <div class="hero-stat"><strong>10,900+</strong><span>product categories</span></div>
            <div class="hero-stat"><strong>4 roles</strong><span>OEM, Reseller, Buyer, Admin</span></div>
            <div class="hero-stat"><strong>30 day</strong><span>premium calling cycle</span></div>
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
              <h3>Start on GeM</h3>
              <p>Plain-language learning for newcomers preparing registration, vendor assessment, catalogues and first sales conversations.</p>
              <a class="button secondary" href="#/learn">Learn the basics</a>
            </article>
            <article class="card">
              <h3>Grow as a Reseller</h3>
              <p>Find OEMs, request authorization, track the relationship and show Buyers which OEMs you represent.</p>
              <a class="button secondary" href="#/register">Join as Reseller</a>
            </article>
            <article class="card">
              <h3>Enable as an OEM</h3>
              <p>Build a reseller network, share rate lists and sales kits, and make your catalogue visible to Vendors and Buyers.</p>
              <a class="button secondary" href="#/register">List as OEM</a>
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
              <p class="eyebrow">Beside GeM, never inside it</p>
              <h2>Dome records the business workflow without claiming to be GeM.</h2>
            </div>
          </div>
          <div class="grid four">
            ${["Register and get approved", "Complete profile or request paid setup", "Request OEM authorization", "Record progress and enquiries"].map((text, index) => `
              <article class="card">
                <div class="dot">${index + 1}</div>
                <h3>${text}</h3>
                <p>${index === 2 ? "Authorization codes and validation are tracked, but the actual code entry remains on the official GeM portal." : "Launch workflow is captured in Dome with audit-friendly records and clear next actions."}</p>
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
        <p class="eyebrow">About GeM and Dome</p>
        <h1>Dome is the coordination layer for GeM growth.</h1>
        <p>GeM remains the official marketplace. Dome helps OEMs, Vendors and Buyers prepare, discover each other, communicate, and record relationship progress around that official process.</p>
      </header>
      <div class="container split">
        <section class="card">
          <h2>What Dome does</h2>
          <div class="timeline">
            ${[
              "Educates newcomers through guides, webinars and practical checklists.",
              "Creates searchable public profiles for OEMs and Vendors.",
              "Captures registration, approval and onboarding workflows.",
              "Tracks OEM-Vendor authorization requests and status history.",
              "Captures Buyer enquiries and premium calling readiness."
            ].map((item, index) => `<div class="timeline-step"><span class="dot">${index + 1}</span><p>${item}</p></div>`).join("")}
          </div>
        </section>
        <aside class="card">
          <h2>What Dome does not do</h2>
          <p class="notice warn">Dome does not register users on GeM, submit bids, validate codes, create official purchase orders or claim to act as the Government e-Marketplace.</p>
          <p>Whenever an official action is required, Dome should link members to the GeM portal and ask them to record their confirmation once the action is complete.</p>
        </aside>
      </div>
    </main>
  `);
}

function directoryPage() {
  const { search, type, category } = state.filters;
  const results = state.boot.businesses.filter((item) => {
    const haystack = `${item.name} ${item.type} ${item.category} ${item.secondaryCategory || ""} ${item.city} ${item.description}`.toLowerCase();
    return (!search || haystack.includes(search.toLowerCase()))
      && (type === "All" || item.type === type)
      && (category === "All" || item.category === category || item.secondaryCategory === category);
  });

  return shell(`
    <main class="page">
      <header class="page-head">
        <p class="eyebrow">OEMs and Resellers on Dome</p>
        <h1>Find an OEM or Reseller to grow with.</h1>
        <p>Search by business name, city, category or role. Sign in or register to request authorization, send enquiries, and use member-only contact workflows.</p>
      </header>
      <div class="container">
        <div class="filters">
          <input class="input" data-filter="search" placeholder="Search by name, city, category..." value="${escapeHtml(search)}">
          <select class="select" data-filter="type">
            ${["All", "OEM", "Vendor"].map((option) => `<option ${option === type ? "selected" : ""}>${option}</option>`).join("")}
          </select>
          <select class="select" data-filter="category">
            ${["All", ...state.boot.categories].map((option) => `<option ${option === category ? "selected" : ""}>${option}</option>`).join("")}
          </select>
        </div>
        ${results.length ? `<div class="grid three">${results.map(businessCard).join("")}</div>` : `<div class="empty">No businesses match those filters yet.</div>`}
      </div>
    </main>
  `);
}

function profilePage(id) {
  const business = state.boot.businesses.find((item) => item.id === id);
  if (!business) return shell(`<main class="page"><div class="container empty">Profile not found.</div></main>`);
  const isOem = business.type === "OEM";
  const canCall = state.user && state.user.businessId !== business.id && business.callingActiveUntil && business.callingActiveUntil >= today();
  const authorized = (business.authorizedOems || []).map((oemId) => state.boot.businesses.find((item) => item.id === oemId)).filter(Boolean);

  return shell(`
    <main>
      <section class="profile-hero">
        <div class="profile-hero-inner">
          <div>
            <p class="eyebrow">${business.type} profile</p>
            <h1>${escapeHtml(business.name)}</h1>
            <div class="tags">
              <span class="tag">${escapeHtml(business.category)}</span>
              <span class="tag">${escapeHtml(business.city)}</span>
              <span class="tag">${escapeHtml(business.rating)} rating</span>
              ${business.badge ? `<span class="tag">${escapeHtml(business.badge)}</span>` : ""}
            </div>
            <p>${escapeHtml(business.description)}</p>
            <div class="hero-actions">
              ${isOem ? `<a class="button" href="#/request-authorization/${business.id}">Request authorization</a>` : ""}
              ${isOem ? `<button class="button secondary" data-action="reveal-contact" data-business-id="${business.id}">Reveal contact info</button>` : `<a class="button secondary" href="#/contact/${business.id}">Send enquiry</a>`}
              ${canCall ? `<a class="button warn" href="tel:${escapeHtml(business.phone || "")}">Call ${escapeHtml(business.name)}</a>` : `<span class="tag">Calling ${business.callingActiveUntil ? "visible after sign-in" : "coming up"}</span>`}
            </div>
            <div id="revealNotice" style="margin-top:16px"></div>
          </div>
          <div class="big-avatar">${escapeHtml(business.initials)}</div>
        </div>
      </section>
      <section class="section">
        <div class="container split">
          <div class="grid">
            <article class="card">
              <h2>${isOem ? "Products and GeM performance" : "Authorized OEMs"}</h2>
              ${isOem ? `
                <div class="grid two">${(business.products || []).map((product) => `<div class="notice"><strong>${escapeHtml(product)}</strong><br><span class="muted">${escapeHtml(business.category)} catalogue item. GeM listing link can be added by the OEM.</span></div>`).join("")}</div>
              ` : authorized.length ? `
                <div class="grid two">${authorized.map((oem) => `<a class="notice" href="#/profile/${oem.id}"><strong>${escapeHtml(oem.name)}</strong><br><span class="muted">${escapeHtml(oem.category)} - ${escapeHtml(oem.gemUrl || "GeM link pending")}</span></a>`).join("")}</div>
              ` : `<div class="empty">No active OEM partnerships are visible yet.</div>`}
            </article>
            <article class="card">
              <h2>Sales enablement</h2>
              <p class="notice">Sales kits are available to authorized Vendors. File upload/download, notifications and access controls are marked for the next production phase.</p>
              <div class="tags">${(business.kits || ["Brochures", "Rate list", "Bid samples"]).map((kit) => `<span class="tag">${escapeHtml(kit)}</span>`).join("")}</div>
            </article>
          </div>
          <aside class="grid">
            <article class="card">
              <h2>Highlights</h2>
              <div class="timeline">${(business.highlights || []).map((item, index) => `<div class="timeline-step"><span class="dot">${index + 1}</span><p>${escapeHtml(item)}</p></div>`).join("")}</div>
            </article>
            <article class="card">
              <h2>Compliance boundary</h2>
              <p>Dome can record that a code was shared, linked or enabled. The official code entry, validation and purchase order actions remain on GeM.</p>
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
        <h1>Everything you need to win on GeM.</h1>
        <p>Plain-language guides for sellers, OEMs and Buyers. Article detail pages, content admin and video playback are coming up after launch.</p>
      </header>
      <div class="container split">
        <section>
          <div class="section-head"><h2>Guides</h2></div>
          <div class="grid">${state.boot.content.guides.map((item) => `
            <article class="card">
              <span class="tag">${escapeHtml(item.kind)}</span>
              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(item.summary)}</p>
              <span class="muted">${item.minutes} min read</span>
            </article>
          `).join("")}</div>
        </section>
        <aside>
          <div class="section-head"><h2>From the blog</h2></div>
          <div class="grid">${state.boot.content.articles.map((item) => `
            <article class="card">
              <span class="tag">${escapeHtml(item.tag)}</span>
              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(item.summary)}</p>
            </article>
          `).join("")}</div>
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
        <p>Registration is captured now. Payment gateway and real meeting provider integration are provider-ready and listed as production setup items.</p>
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
  return shell(`
    <main class="page">
      <header class="page-head">
        <p class="eyebrow">Verified identity</p>
        <h1>Join Dome with phone and email verification.</h1>
        <p>Registration captures only your login identity. Business details move into the role-specific profile after verification.</p>
      </header>
      <div class="container split">
        <form class="card" id="registerForm">
          <div id="formNotice"></div>
          <div class="form-grid">
            <label><span class="label">Email</span><input class="input" name="email" type="email" required></label>
            <label><span class="label">Mobile number</span><input class="input" name="phone" placeholder="+91XXXXXXXXXX" required></label>
            <label><span class="label">Phone OTP</span><input class="input" name="phoneOtp" placeholder="123456"></label>
            <label><span class="label">Email OTP</span><input class="input" name="emailOtp" placeholder="123456"></label>
            <label class="full"><input type="checkbox" name="consent" required> I accept the Terms, Privacy Policy and consent to Dome creating my verified account.</label>
            <label class="full"><input type="checkbox" name="marketingConsent"> I agree to receive useful Dome learning and event updates.</label>
          </div>
          <div class="form-actions">
            <button class="button secondary" type="button" data-action="send-phone-otp">Send phone OTP</button>
            <button class="button secondary" type="button" data-action="verify-phone-otp">Verify phone</button>
            <button class="button secondary" type="button" data-action="send-email-otp">Send email OTP</button>
            <button class="button secondary" type="button" data-action="verify-email-otp">Verify email</button>
            <button class="button" type="submit">Create account</button>
          </div>
        </form>
        <aside class="grid">
          <div class="card">
            <h2>Why so little?</h2>
            <p>Identity should be fast. GST, GeM seller ID, categories, contact people, products and order counts belong in the profile where the form changes by user type.</p>
          </div>
          <div class="card">
            <h2>After signup</h2>
            <p>Choose Reseller, OEM or Buyer, complete the right profile, then unlock discovery, paid microsites and contact reveal workflows.</p>
            <a class="button secondary" href="#/profile-setup">Open profile setup</a>
          </div>
        </aside>
      </div>
    </main>
  `);
}

function loginPage() {
  return shell(`
    <main class="page">
      <header class="page-head">
        <p class="eyebrow">Member access</p>
        <h1>Log in to Dome.</h1>
        <p>Use the seeded demo accounts while the launch data is being prepared.</p>
      </header>
      <div class="container split">
        <form class="card" id="loginForm">
          <div id="formNotice"></div>
          <label><span class="label">Email</span><input class="input" name="email" type="email" required placeholder="vendor@dome.com"></label>
          <label><span class="label">Password</span><input class="input" name="password" type="password" required placeholder="vendor123"></label>
          <div class="form-actions"><button class="button" type="submit">Log in</button></div>
        </form>
        <aside class="grid">
          ${[
            ["Vendor", "vendor@dome.com", "vendor123"],
            ["OEM", "oem@dome.com", "oem123"],
            ["Buyer", "buyer@dome.com", "buyer123"],
            ["Admin", "admin@dome.com", "admin123"]
          ].map(([role, email, password]) => `
            <button class="card" data-demo-login="${email}" data-demo-password="${password}">
              <strong>${role}</strong><br><span class="muted">${email} - ${password}</span>
            </button>
          `).join("")}
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
    ["Complete profile", "GST, products, contacts and paid microsite", "#/profile-setup"],
    ["Vendor discovery", "Find capable resellers", "#/directory"],
    ["Authorization requests", "Review and advance partner requests", "#/admin"],
    ["Sales kits", "File sharing is coming up", "#/learn"]
  ] : isVendor ? [
    ["Complete profile", "GST, GeM seller ID, categories and order count", "#/profile-setup"],
    ["OEM discovery", "Request authorization from profiles", "#/directory?type=OEM"],
    ["My microsite", "Your public profile shows authorized OEMs", `#/profile/${state.user.businessId || "shyam"}`],
    ["Orders", "PO tracking is coming up after deeper workflow build", "#/about"]
  ] : [
    ["Complete profile", "Choose Buyer, Reseller or OEM details", "#/profile-setup"],
    ["Supplier search", "Find OEMs and Vendors", "#/directory"],
    ["Messages", "Enquiry capture is live, inbox is coming up", "#/directory"],
    ["Webinars", "Register for learning sessions", "#/webinars"]
  ];

  return shell(`
    <main class="page">
      <header class="page-head">
        <p class="eyebrow">${escapeHtml(role)} dashboard</p>
        <h1>Welcome back, ${escapeHtml(state.user.businessName)}.</h1>
        <p>${isAdminUser ? "Run the launch queue and monitor captured activity." : "Your role-specific workspace is ready for launch workflows. Deeper operational modules are marked where provider or database decisions are still needed."}</p>
      </header>
      <div class="container grid three">
        ${cards.map(([title, text, href]) => `
          <a class="card profile-card" href="${href}">
            <h3>${title}</h3>
            <p>${text}</p>
          </a>
        `).join("")}
      </div>
    </main>
  `);
}

function profileSetupPage() {
  if (!state.user) return loginPage();
  const role = state.profile?.role || (state.user.role === "OEM" ? "OEM" : state.user.role === "Buyer" ? "Buyer" : "Reseller");
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
            <label><span class="label">GST Number</span><input class="input" name="gstNumber" maxlength="15" value="${escapeHtml(state.profile?.gstNumber || "")}"></label>
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
              <label class="full"><span class="label">Products</span><textarea class="textarea" name="products" placeholder="One product per line">${escapeHtml((state.profile?.products || []).map((item) => item.name || item).join("\n"))}</textarea></label>
              <label class="full"><span class="label">Contact list</span><textarea class="textarea" name="contactList" placeholder="Purpose | Name | Phone | Email">${escapeHtml((state.profile?.contactList || []).map((item) => [item.purpose, item.name, item.phone, item.email].filter(Boolean).join(" | ")).join("\n"))}</textarea></label>
              <label class="full"><input type="checkbox" name="micrositeRequested" ${state.profile?.micrositeRequested ? "checked" : ""}> Activate OEM microsite as a paid feature</label>
            ` : ""}
            <label class="full"><span class="label">About the business</span><textarea class="textarea" name="about">${escapeHtml(state.profile?.about || "")}</textarea></label>
          </div>
          <div class="form-actions">
            <button class="button secondary" type="button" data-action="lookup-gst">Lookup GST</button>
            <button class="button" type="submit">Save profile</button>
          </div>
        </form>
        <aside class="grid">
          <div class="card">
            <h2>Profile completion</h2>
            <p class="notice">${state.profile?.completion || 0}% complete. Profiles above 80% become review-ready for directory and partnership workflows.</p>
          </div>
          <div class="card">
            <h2>GST API</h2>
            <p>Dome can connect to a GST provider. Demo mode shows clearly marked sample lookup data until provider credentials are added.</p>
            ${state.gstLookup ? `<p class="notice"><strong>${escapeHtml(state.gstLookup.result.tradeName || state.gstLookup.result.legalName)}</strong><br>${escapeHtml(state.gstLookup.result.status)} - ${escapeHtml(state.gstLookup.mode)} lookup</p>` : ""}
          </div>
          <div class="card">
            <h2>Paid OEM microsite</h2>
            <p>For OEMs, saved profile data becomes the content source for their public microsite. Activation is recorded as a paid feature.</p>
          </div>
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
        <header class="page-head"><p class="eyebrow">Enquiry</p><h1>Contact ${escapeHtml(business.name)}.</h1><p>This creates a persistent enquiry record for admin follow-up and future inbox delivery.</p></header>
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
    return shell(`
      <main class="page"><div class="container split">
        <header class="page-head"><p class="eyebrow">Authorization request</p><h1>Request authorization from ${escapeHtml(business.name)}.</h1><p>Dome records the request and status history. Code entry and validation happen on GeM.</p></header>
        <form class="card" id="authorizationForm" data-oem-id="${business.id}">
          <div id="formNotice"></div>
          <label><span class="label">Vendor business name</span><input class="input" name="vendorName" required></label>
          <label><span class="label">Contact person</span><input class="input" name="contactName" required></label>
          <label><span class="label">Email</span><input class="input" name="email" type="email" required></label>
          <label><span class="label">Phone</span><input class="input" name="phone" required></label>
          <label><span class="label">Product category</span><select class="select" name="category"><option>${escapeHtml(business.category)}</option>${state.boot.categories.map((cat) => `<option>${escapeHtml(cat)}</option>`).join("")}</select></label>
          <label><span class="label">Message</span><textarea class="textarea" name="message" required placeholder="Tell the OEM why you want authorization and where you sell."></textarea></label>
          <div class="form-actions"><button class="button" type="submit">Create request</button></div>
        </form>
      </div></main>`);
  }

  if (kind === "webinar" && webinar) {
    return shell(`
      <main class="page"><div class="container split">
        <header class="page-head"><p class="eyebrow">Webinar registration</p><h1>${escapeHtml(webinar.title)}</h1><p>${escapeHtml(webinar.summary)} Fee: ${webinar.fee ? money(webinar.fee) : "Free"}.</p></header>
        <form class="card" id="webinarForm" data-webinar-id="${webinar.id}">
          <div id="formNotice"></div>
          ${contactFields(true)}
          <div class="form-actions"><button class="button" type="submit">Register</button></div>
          ${webinar.fee ? `<p class="notice warn">Payment is marked provider_pending until Razorpay/PayU is connected.</p>` : ""}
        </form>
      </div></main>`);
  }

  return shell(`
    <main class="page"><div class="container split">
      <header class="page-head"><p class="eyebrow">Admin-assisted setup</p><h1>Let Dome set up your profile.</h1><p>This captures the paid setup queue. The payment provider is pending, so requests are marked provider_pending.</p></header>
      <form class="card" id="setupForm">
        <div id="formNotice"></div>
        <label><span class="label">Business name</span><input class="input" name="businessName" required></label>
        <label><span class="label">Role</span><select class="select" name="role"><option>Vendor</option><option>OEM</option></select></label>
        ${contactFields()}
        <label><span class="label">Notes for setup team</span><textarea class="textarea" name="notes"></textarea></label>
        <p class="notice">One-time setup fee: ${money(4999)}. Real payment and GST invoice will be connected in production.</p>
        <div class="form-actions"><button class="button" type="submit">Request setup</button></div>
      </form>
    </div></main>`);
}

function contactFields(includeOrganization = false) {
  return `
    <label><span class="label">Name</span><input class="input" name="name" required></label>
    ${includeOrganization ? `<label><span class="label">Organization</span><input class="input" name="organization" required></label>` : `<label><span class="label">Organization</span><input class="input" name="organization"></label>`}
    <label><span class="label">Email</span><input class="input" name="email" type="email" required></label>
    <label><span class="label">Phone</span><input class="input" name="phone" required></label>
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
        <p>Enter the deployment admin key to review applications, setup requests, enquiries and audit activity. Local development uses <strong>DOMEADMIN</strong>.</p>
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

function notice(message, type = "") {
  const target = document.querySelector("#formNotice");
  if (target) target.innerHTML = `<p class="notice ${type}">${escapeHtml(message)}</p>`;
}

function formPayload(form) {
  const data = new FormData(form);
  const payload = {};
  for (const [key, value] of data.entries()) {
    payload[key] = value === "on" ? true : value;
  }
  for (const checkbox of form.querySelectorAll('input[type="checkbox"]')) {
    payload[checkbox.name] = checkbox.checked;
  }
  return payload;
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
      localStorage.setItem("domeUser", JSON.stringify(result.user));
      notice(`Profile saved. Completion is ${result.profile.completion}%.`);
    }
    if (form.id === "loginForm") {
      const result = await api("/api/session", { method: "POST", body: JSON.stringify(payload) });
      state.user = result.user;
      state.token = result.token;
      localStorage.setItem("domeUser", JSON.stringify(result.user));
      localStorage.setItem("domeToken", result.token);
      setRoute(result.user.role === "Admin" ? "/admin" : "/dashboard");
    }
    if (form.id === "contactForm") {
      payload.businessId = form.dataset.businessId;
      await api("/api/contact", { method: "POST", body: JSON.stringify(payload) });
      notice("Enquiry captured. The next production step is routing this into member inboxes and notifications.");
      form.reset();
    }
    if (form.id === "authorizationForm") {
      payload.oemId = form.dataset.oemId;
      await api("/api/authorization", { method: "POST", body: JSON.stringify(payload) });
      notice("Authorization request created in Requested status.");
      form.reset();
    }
    if (form.id === "webinarForm") {
      payload.webinarId = form.dataset.webinarId;
      const result = await api("/api/webinar-registration", { method: "POST", body: JSON.stringify(payload) });
      notice(result.registration.accessLink ? `Registered. Access link: ${result.registration.accessLink}` : "Registration captured. Payment provider is pending before access link release.");
      form.reset();
    }
    if (form.id === "setupForm") {
      await api("/api/setup-request", { method: "POST", body: JSON.stringify(payload) });
      notice("Setup request captured. Payment is marked provider_pending until the gateway is connected.");
      form.reset();
    }
  } catch (error) {
    notice(error.message, "error");
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
    state.user = null;
    state.token = "";
    setRoute("/");
  }
  if (action === "send-phone-otp" || action === "send-otp") {
    const form = document.querySelector("#registerForm");
    try {
      const payload = formPayload(form);
      const result = await api("/api/otp/start", { method: "POST", body: JSON.stringify({ channel: "phone", phone: payload.phone, purpose: "registration" }) });
      notice(result.devCode ? `Phone OTP sent in demo mode. Use ${result.devCode}.` : "Phone OTP sent.");
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
      notice(result.devCode ? `Email OTP sent in demo mode. Use ${result.devCode}.` : "Email OTP sent.");
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
  if (action === "lookup-gst") {
    const form = document.querySelector("#profileForm");
    try {
      const payload = formPayload(form);
      state.gstLookup = await api("/api/gst/lookup", { method: "POST", body: JSON.stringify({ gstNumber: payload.gstNumber }) });
      notice(`GST lookup ready: ${state.gstLookup.result.tradeName || state.gstLookup.result.legalName}.`);
    } catch (error) {
      notice(error.message, "error");
    }
  }
  if (action === "reveal-contact") {
    const businessId = event.target.closest("[data-business-id]")?.dataset.businessId;
    const target = document.querySelector("#revealNotice");
    if (!state.user || !state.token) {
      if (target) target.innerHTML = `<p class="notice warn">Please log in or register before revealing OEM contact information.</p>`;
      return;
    }
    try {
      const result = await api("/api/reveal-contact", { method: "POST", body: JSON.stringify({ businessId }) });
      if (target) target.innerHTML = `<p class="notice"><strong>${escapeHtml(result.contact.businessName)}</strong><br>Phone: ${escapeHtml(result.contact.phone)}<br>Email: ${escapeHtml(result.contact.email)}<br>${result.bundle.creditsRemaining} reveal credits remaining.</p>`;
    } catch (error) {
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
  if (event.target.matches("[data-profile-role]")) {
    state.profile = { ...(state.profile || {}), role: event.target.value };
    render();
    return;
  }
  const filter = event.target.dataset.filter;
  if (filter) {
    state.filters[filter] = event.target.value;
    render();
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
      app.innerHTML = `<div class="loading">Waking the Dome demo... retry ${attempt}/4</div>`;
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
