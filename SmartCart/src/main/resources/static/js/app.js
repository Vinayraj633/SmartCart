/* ========================================================================
   SmartCart — unified frontend logic
   ======================================================================== */

const API = "api";
const PAGE = document.body.dataset.page || "products";

let CURRENT_USER = null;
let USER_LOAD_PROMISE = null;

let ALL_PRODUCTS = [];
let CURRENT_CATEGORY = "all";
let CURRENT_SEARCH = "";

let ADMIN_CACHE = { products: [], orders: [], users: [] };
let ADMIN_FILTERED_USERS = [];
let ADMIN_FILTERED_PRODUCTS = [];
let ADMIN_FILTERED_ORDERS = [];

/* Reviews state */
let MY_REVIEWS = [];
let PRODUCT_RATINGS = {};

/* Wishlist state */
let MY_WISHLIST = [];

/* Filter + sort state */
let FILTER_STATE = {
  sort: "relevance",
  minPrice: null,
  maxPrice: null,
  minRating: 0,
  inStockOnly: false
};

/* Membership state */
let MY_MEMBERSHIP = null;
let MY_BILLING_HISTORY = [];

const TIER_PRICING = {
  REGULAR: { amount: 0,    label: "Free",          cycle: "forever" },
  PREMIUM: { amount: 999,  label: "₹999 / year",   cycle: "yearly"  },
  VIP:     { amount: 2999, label: "₹2,999 / year", cycle: "yearly"  }
};

/* ========================================================================
   UTILITIES
   ======================================================================== */
function showToast(msg, isError = false) {
  const t = document.getElementById("toast");
  if (!t) return alert(msg);

  const icon = isError ? "⚠️" : "✓";
  t.innerHTML = `<span style="margin-right:8px;font-size:15px;display:inline-block;vertical-align:middle;">${icon}</span>${escapeHtml(msg)}`;

  t.style.background = isError
    ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
    : "linear-gradient(135deg, #0a0a0a 0%, #000000 100%)";

  t.style.display = "block";

  t.style.animation = "none";
  void t.offsetWidth;
  t.style.animation = "";

  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => { t.style.display = "none"; }, 3000);
}

function money(v) {
  const n = Number(v);
  if (!isFinite(n) || isNaN(n)) return "₹0.00";
  return "₹" + n.toFixed(2);
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return res.json();
}

function initials(name) {
  return (name || "?").split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function tierClass(t) {
  t = (t || "REGULAR").toUpperCase();
  if (t === "VIP") return "tier-vip";
  if (t === "PREMIUM") return "tier-premium";
  return "tier-regular";
}

function escapeHtml(s) {
  return String(s || "").replace(/[<>&'"]/g, c => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&#39;", '"': "&quot;"
  }[c]));
}

/* ========================================================================
   PASSWORD SHOW/HIDE TOGGLE
   ======================================================================== */
function togglePassword(inputId, btnEl) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isHidden = input.type === "password";
  input.type = isHidden ? "text" : "password";
  if (btnEl) btnEl.textContent = isHidden ? "🙈" : "👁️";
}

/* ========================================================================
   SCROLL-REVEAL
   ======================================================================== */
function initScrollReveal() {
  const els = document.querySelectorAll(".reveal, .reveal-stagger");
  if (!els.length) return;
  if (!("IntersectionObserver" in window)) {
    els.forEach(el => el.classList.add("reveal-in"));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("reveal-in");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -60px 0px" });
  els.forEach(el => observer.observe(el));
}
function refreshScrollReveal() { initScrollReveal(); }

/* ========================================================================
   SKELETON LOADERS
   ======================================================================== */
function renderSkeletonCards(container, count = 8) {
  if (!container) return;
  container.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const skel = document.createElement("div");
    skel.className = "skel-card";
    skel.innerHTML = `
      <div class="skel-card-img"></div>
      <div class="skel-card-body">
        <div class="skel-line w-90"></div>
        <div class="skel-line w-60"></div>
        <div class="skel-line w-40 tall"></div>
        <div class="skel-btn"></div>
      </div>`;
    container.appendChild(skel);
  }
}

function renderSkeletonReviews(container, count = 3) {
  if (!container) return;
  container.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const skel = document.createElement("div");
    skel.style.cssText = `padding:16px;border:1px solid var(--line);border-radius:12px;background:#fff;margin-bottom:12px;`;
    skel.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;">
        <div class="skel-line" style="width:36px;height:36px;border-radius:50%;"></div>
        <div style="flex:1;">
          <div class="skel-line w-40" style="margin-bottom:6px;"></div>
          <div class="skel-line w-60" style="height:10px;"></div>
        </div>
      </div>
      <div class="skel-line w-100" style="margin-bottom:6px;"></div>
      <div class="skel-line w-80"></div>`;
    container.appendChild(skel);
  }
}

/* ========================================================================
   STAR RENDERING
   ======================================================================== */
function renderStars(rating, size = 14) {
  const r = Math.max(0, Math.min(5, Number(rating) || 0));
  const full = Math.floor(r);
  const hasHalf = (r - full) >= 0.25 && (r - full) < 0.75;
  const fullAdjusted = (r - full) >= 0.75 ? full + 1 : full;
  const halfAdjusted = (r - full) >= 0.75 ? false : hasHalf;
  let html = "";
  for (let i = 1; i <= 5; i++) {
    if (i <= fullAdjusted) html += `<span class="star-static filled">★</span>`;
    else if (i === fullAdjusted + 1 && halfAdjusted) html += `<span class="star-static half">★</span>`;
    else html += `<span class="star-static empty">★</span>`;
  }
  return `<span class="star-static-wrap" style="font-size:${size}px">${html}</span>`;
}

/* ========================================================================
   PRODUCT IMAGE
   ======================================================================== */
function productImage(product) { return `images/${product.productId}.jpg`; }

function productPlaceholder(product) {
  const catColors = {
    "Electronics": ["#3b82f6", "#1e40af"],
    "Accessories": ["#8b5cf6", "#6d28d9"],
    "Furniture":   ["#10b981", "#047857"],
    "Home":        ["#f59e0b", "#b45309"],
    "Stationery":  ["#06b6d4", "#0e7490"]
  };
  const [c1, c2] = catColors[product.category] || ["#6366f1", "#4338ca"];
  const ini = (product.name || "?").split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/>` +
      `</linearGradient></defs>` +
      `<rect width="600" height="600" fill="url(#g)"/>` +
      `<text x="300" y="350" text-anchor="middle" fill="#ffffff" ` +
        `font-family="Inter,Arial,sans-serif" font-size="220" font-weight="900" opacity="0.95">${ini}</text>` +
    `</svg>`;
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

function attachImageFallback(imgEl, product) {
  if (!imgEl) return;
  if (imgEl.complete && imgEl.naturalWidth === 0 && imgEl.src) {
    imgEl.src = productPlaceholder(product);
    return;
  }
  imgEl.addEventListener("error", function handler() {
    imgEl.removeEventListener("error", handler);
    imgEl.onerror = null;
    imgEl.src = productPlaceholder(product);
  });
}

/* ========================================================================
   CART POPUP
   ======================================================================== */
function showCartPopup(productName) {
  const existing = document.getElementById("cartPopup");
  if (existing) existing.remove();
  const popup = document.createElement("div");
  popup.id = "cartPopup";
  popup.className = "cart-popup";
  popup.innerHTML = `
    <div class="cart-popup-head">
      <div class="cart-popup-check">✓</div>
      <div>
        <div class="cart-popup-title">Added to cart</div>
        <div class="cart-popup-product">${escapeHtml(productName)}</div>
      </div>
    </div>`;
  document.body.appendChild(popup);
  requestAnimationFrame(() => popup.classList.add("show"));
  window._cartPopupTimer = setTimeout(() => hideCartPopup(), 3000);
}
function hideCartPopup() {
  const popup = document.getElementById("cartPopup");
  if (!popup) return;
  popup.classList.remove("show");
  clearTimeout(window._cartPopupTimer);
  setTimeout(() => popup.remove(), 250);
}
function animateCartBadge() {
  const badge = document.getElementById("cartCount");
  if (!badge) return;
  badge.classList.remove("bump");
  void badge.offsetWidth;
  badge.classList.add("bump");
  setTimeout(() => badge.classList.remove("bump"), 400);
}

/* ========================================================================
   USER LOADING
   ======================================================================== */
async function fetchUser() {
  try {
    const res = await fetch(`${API}/user/me`);
    const data = await res.json();
    CURRENT_USER = data.loggedIn ? data.user : null;
    if (CURRENT_USER) CURRENT_USER.isAdmin = !!data.isAdmin;
  } catch (e) { CURRENT_USER = null; }
  return CURRENT_USER;
}
function ensureUserLoaded() {
  if (!USER_LOAD_PROMISE) USER_LOAD_PROMISE = fetchUser();
  return USER_LOAD_PROMISE;
}
async function loadUserHeader() {
  await ensureUserLoaded();
  const info   = document.getElementById("userInfo");
  const login  = document.getElementById("loginLink");
  const logout = document.getElementById("logoutLink");
  const signup = document.getElementById("signupLink");

  if (CURRENT_USER) {
    // Logged in → show "Hi, Name" + Logout only
    if (info)   info.textContent = `Hi, ${CURRENT_USER.name.split(" ")[0]} · ${CURRENT_USER.customerType}`;
    if (login)  login.style.display  = "none";
    if (signup) signup.style.display = "none";
    if (logout) logout.style.display = "inline";
  } else {
    // Not logged in → show Login + Create Account
    if (info)   info.textContent = "";
    if (login)  login.style.display  = "inline";
    if (signup) signup.style.display = "inline";
    if (logout) logout.style.display = "none";
  }
}
async function loadCartCount() {
  const el = document.getElementById("cartCount");
  if (!el) return;
  try {
    const res = await fetch(`${API}/cart`);
    const cart = await res.json();
    const count = (cart.items || []).reduce((s, it) => s + it.quantity, 0);
    el.textContent = count;
  } catch (e) {}
}
async function requireLogin() {
  await ensureUserLoaded();
  if (!CURRENT_USER) {
    showToast("Please login to continue", true);
    setTimeout(() => window.location.href = "login.html", 1200);
    return false;
  }
  return true;
}

/* ========================================================================
   LOGOUT
   ======================================================================== */
function logout() {
  const modal = document.getElementById("logoutModal");
  if (modal) modal.classList.add("show");
  else if (confirm("Are you sure you want to logout?")) confirmLogout();
}
function cancelLogout() {
  const modal = document.getElementById("logoutModal");
  if (modal) modal.classList.remove("show");
}
async function confirmLogout() {
  const modal = document.getElementById("logoutModal");
  if (modal) modal.classList.remove("show");
  await postJson(`${API}/user/logout`, {});
  CURRENT_USER = null;
  USER_LOAD_PROMISE = null;
  window.location.href = "index.html";
}

/* ========================================================================
   PAGE: PRODUCTS
   ======================================================================== */
async function loadProducts() {
  const container = document.getElementById("productList");
  renderSkeletonCards(container, 8);
  try {
    const res = await fetch(`${API}/products`);
    ALL_PRODUCTS = await res.json();
    applyFilters();
  } catch (e) {
    if (container) container.innerHTML = `<div class="no-results"><h3>Failed to load products</h3></div>`;
  }
}

function applyFilters() {
  const term = (document.getElementById("searchInput")?.value || "").trim().toLowerCase();
  CURRENT_SEARCH = term;

  FILTER_STATE.sort        = document.getElementById("sortSelect")?.value || "relevance";
  FILTER_STATE.minPrice    = parseFloat(document.getElementById("priceMin")?.value) || null;
  FILTER_STATE.maxPrice    = parseFloat(document.getElementById("priceMax")?.value) || null;
  FILTER_STATE.inStockOnly = !!document.getElementById("inStockOnly")?.checked;

  let filtered = ALL_PRODUCTS.slice();

  if (CURRENT_CATEGORY !== "all") filtered = filtered.filter(p => p.category === CURRENT_CATEGORY);
  if (term) filtered = filtered.filter(p => p.name.toLowerCase().includes(term) || p.category.toLowerCase().includes(term));
  if (FILTER_STATE.minPrice != null) filtered = filtered.filter(p => Number(p.price) >= FILTER_STATE.minPrice);
  if (FILTER_STATE.maxPrice != null) filtered = filtered.filter(p => Number(p.price) <= FILTER_STATE.maxPrice);
  if (FILTER_STATE.inStockOnly) filtered = filtered.filter(p => p.stock > 0);
  if (FILTER_STATE.minRating > 0) {
    filtered = filtered.filter(p => {
      const r = PRODUCT_RATINGS[p.productId];
      return r && r.average >= FILTER_STATE.minRating;
    });
  }

  switch (FILTER_STATE.sort) {
    case "price-asc":  filtered.sort((a, b) => Number(a.price) - Number(b.price)); break;
    case "price-desc": filtered.sort((a, b) => Number(b.price) - Number(a.price)); break;
    case "name-asc":   filtered.sort((a, b) => a.name.localeCompare(b.name)); break;
    case "stock-desc": filtered.sort((a, b) => Number(b.stock) - Number(a.stock)); break;
    case "rating-desc":
      filtered.sort((a, b) => {
        const ra = PRODUCT_RATINGS[a.productId]?.average || 0;
        const rb = PRODUCT_RATINGS[b.productId]?.average || 0;
        return rb - ra;
      });
      break;
  }

  const container = document.getElementById("productList");
  if (!container) return;
  container.innerHTML = "";

  const countEl = document.getElementById("productCount");
  if (countEl) countEl.textContent = `${filtered.length} item${filtered.length !== 1 ? "s" : ""}`;

  const noResults = document.getElementById("noResults");
  if (noResults) noResults.style.display = filtered.length === 0 ? "block" : "none";

  filtered.forEach(p => {
    const outStock = p.stock <= 0;
    const lowStock = p.stock > 0 && p.stock <= 5;
    let qtyClass = "qty-ok";
    let qtyLabel = `In stock · ${p.stock}`;
    if (outStock) { qtyClass = "qty-out"; qtyLabel = "Out of stock"; }
    else if (lowStock) { qtyClass = "qty-low"; qtyLabel = `Only ${p.stock} left`; }
    const inWish = MY_WISHLIST.includes(p.productId);

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-img-wrap" onclick="location.href='product.html?id=${p.productId}'" style="cursor:pointer;">
        <img src="${productImage(p)}" alt="${escapeHtml(p.name)}" class="card-img">
        <button class="heart-btn ${inWish ? 'active' : ''}" data-product="${p.productId}"
                onclick="event.stopPropagation(); toggleWishlist('${p.productId}', this)"
                title="${inWish ? 'Remove from wishlist' : 'Add to wishlist'}">
          ${inWish ? "♥" : "♡"}
        </button>
      </div>
      <div class="card-body">
        <h3 class="card-title" onclick="location.href='product.html?id=${p.productId}'" style="cursor:pointer;">
          ${escapeHtml(p.name)}
        </h3>
        <div class="card-rating" id="rating-${p.productId}">
          ${renderStars(0, 14)}
          <span class="card-rating-count">Loading…</span>
        </div>
        <div class="qty-row">
          <span class="qty-badge ${qtyClass}">${qtyLabel}</span>
        </div>
        <div class="card-price">${money(p.price)}</div>
        <button class="card-btn solid" ${outStock ? "disabled" : ""}
                onclick="addToCart('${p.productId}')">
          ${outStock ? "Out of Stock" : "Add to Cart"}
        </button>
      </div>`;

    attachImageFallback(card.querySelector(".card-img"), p);
    container.appendChild(card);

    const ratingEl = card.querySelector(`#rating-${p.productId}`);
    hydrateRatingEl(ratingEl, p.productId, 14).then(() => {
      if (FILTER_STATE.sort === "rating-desc" && !container._ratingResortPending) {
        container._ratingResortPending = true;
        setTimeout(() => {
          container._ratingResortPending = false;
          if (FILTER_STATE.sort === "rating-desc") applyFilters();
        }, 400);
      }
    });
  });

  refreshScrollReveal();
}

function setRatingFilter(minRating) {
  FILTER_STATE.minRating = minRating;
  document.querySelectorAll(".rating-chip").forEach(chip => {
    chip.classList.toggle("active", parseInt(chip.dataset.min, 10) === minRating);
  });
  applyFilters();
}

function clearAllFilters() {
  const sortSel = document.getElementById("sortSelect");
  const priceMin = document.getElementById("priceMin");
  const priceMax = document.getElementById("priceMax");
  const inStock = document.getElementById("inStockOnly");
  if (sortSel) sortSel.value = "relevance";
  if (priceMin) priceMin.value = "";
  if (priceMax) priceMax.value = "";
  if (inStock) inStock.checked = false;
  FILTER_STATE = { sort: "relevance", minPrice: null, maxPrice: null, minRating: 0, inStockOnly: false };
  document.querySelectorAll(".rating-chip").forEach(chip => {
    chip.classList.toggle("active", chip.dataset.min === "0");
  });
  applyFilters();
  showToast("Filters cleared");
}

function selectCategory(cat) {
  CURRENT_CATEGORY = cat;
  document.querySelectorAll(".chip").forEach(c => {
    c.classList.toggle("active", c.dataset.cat === cat);
  });
  applyFilters();
}

async function addToCart(productId) {
  const data = await postJson(`${API}/cart/add`, { productId, quantity: 1 });
  if (data.error) return showToast(data.error, true);
  const product = ALL_PRODUCTS.find(p => p.productId === productId);
  const name = product ? product.name : "Item";
  showCartPopup(name);
  loadCartCount();
  animateCartBadge();
}

/* ========================================================================
   PAGE: CART
   ======================================================================== */
async function refreshCart() {
  const res = await fetch(`${API}/cart`);
  const cart = await res.json();
  const box = document.getElementById("cartItems");
  if (!box) return;
  box.innerHTML = "";

  const items = cart.items || [];
  const totalCount = items.reduce((s, it) => s + it.quantity, 0);
  const cartCount = document.getElementById("cartCount");
  if (cartCount) cartCount.textContent = totalCount;
  const itemCountEl = document.getElementById("itemCount");
  if (itemCountEl) itemCountEl.textContent = totalCount;

  const custTypeEl = document.getElementById("custType");
  if (custTypeEl) custTypeEl.textContent = cart.customerType || "REGULAR";

  const sideBox = document.querySelector(".side-box");
  const cartFooter = document.querySelector(".cart-footer");

  if (items.length === 0) {
    box.innerHTML = `
      <div class="empty-cart">
        <div class="empty-icon">🛒</div>
        <h3>Your cart is empty</h3>
        <p>Looks like you haven't added anything yet.</p>
        <a href="index.html" class="empty-btn">Continue Shopping</a>
      </div>`;
    if (sideBox) sideBox.style.display = "none";
    if (cartFooter) cartFooter.style.display = "none";
    return;
  }
  if (sideBox) sideBox.style.display = "";
  if (cartFooter) cartFooter.style.display = "";

  let subtotal = 0;
  items.forEach(it => {
    subtotal += it.product.price * it.quantity;
    const row = document.createElement("div");
    row.className = "cart-row";
    row.innerHTML = `
      <img class="cart-img" src="${productImage(it.product)}" alt="${escapeHtml(it.product.name)}">
      <div class="cart-info">
        <div class="cart-title">${escapeHtml(it.product.name)}</div>
        <div class="cart-cat">${it.product.category}</div>
      </div>
      <div class="cart-price">${money(it.product.price)}</div>
      <div class="cart-qty">
        <button onclick="updateQty('${it.product.productId}', ${it.quantity - 1})">−</button>
        <span>${it.quantity}</span>
        <button onclick="updateQty('${it.product.productId}', ${it.quantity + 1})">+</button>
      </div>
      <div class="cart-line-total">${money(it.product.price * it.quantity)}</div>
      <button class="cart-del" onclick="removeItem('${it.product.productId}')">✕</button>
    `;
    attachImageFallback(row.querySelector(".cart-img"), it.product);
    box.appendChild(row);
  });

  const subtotalEl = document.getElementById("subtotal");
  if (subtotalEl) subtotalEl.textContent = money(subtotal);

  const guestHint = document.getElementById("guestHint");
  if (guestHint) guestHint.style.display = CURRENT_USER ? "none" : "block";

  await refreshBill();
}

function resetSummary() {
  const ids = ["s-subtotal","s-bulk","s-cat","s-cust","s-coupon","s-gst","s-final"];
  const defaults = ["₹0.00","-₹0.00","-₹0.00","-₹0.00","-₹0.00","₹0.00","₹0.00"];
  ids.forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.textContent = defaults[i];
  });
}

async function refreshBill() {
  try {
    const res = await fetch(`${API}/cart/bill`);
    const bill = await res.json();
    if (bill.error) { resetSummary(); return; }
    if (bill.empty || bill.subtotal === undefined) { resetSummary(); return; }
    const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    set("s-subtotal", money(bill.subtotal));
    set("s-bulk",     "-" + money(bill.bulkDiscount));
    set("s-cat",      "-" + money(bill.categoryDiscount));
    set("s-cust",     "-" + money(bill.customerDiscount));
    set("s-coupon",   "-" + money(bill.couponDiscount));
    set("s-gst",      money(bill.gst));
    set("s-final",    money(bill.finalAmount));
  } catch (e) { resetSummary(); }
}

async function updateQty(productId, qty) {
  const res = await fetch(`${API}/cart/update`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId, quantity: qty })
  });
  const data = await res.json();
  if (data.error) return showToast(data.error, true);
  await refreshCart();
}

async function removeItem(productId) {
  await fetch(`${API}/cart/remove?productId=${productId}`, { method: "DELETE" });
  await refreshCart();
}

/* ========================================================================
   COUPON
   ======================================================================== */
async function applyCoupon() {
  const input = document.getElementById("couponInput");
  const code = input.value.trim().toUpperCase();
  if (!code) return;
  if (!/^[A-Z0-9]+$/.test(code)) {
    showToast("Coupon code must contain only A–Z and 0–9 (no spaces or symbols)", true);
    input.value = "";
    return;
  }
  input.value = code;
  const data = await postJson(`${API}/coupon`, { code });
  if (data.error) {
    input.value = "";
    showToast(data.error, true);
    await refreshBill();
    return;
  }
  showToast("Coupon applied ✓");
  await refreshBill();
}

function initCouponInputRestriction() {
  const input = document.getElementById("couponInput");
  if (!input) return;
  input.setAttribute("maxlength", "20");
  input.setAttribute("autocapitalize", "characters");
  input.setAttribute("autocomplete", "off");
  input.setAttribute("spellcheck", "false");
  input.addEventListener("input", (e) => {
    const cleaned = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (e.target.value !== cleaned) e.target.value = cleaned;
  });
  input.addEventListener("paste", (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData("text");
    const cleaned = pasted.toUpperCase().replace(/[^A-Z0-9]/g, "");
    document.execCommand("insertText", false, cleaned);
  });
}

async function checkout() {
  if (!await requireLogin()) return;
  window.location.href = "checkout.html";
}

/* ========================================================================
   PAGE: CHECKOUT
   ======================================================================== */
async function loadCheckout() {
  if (!await requireLogin()) return;
  const res = await fetch(`${API}/cart`);
  const cart = await res.json();
  const items = cart.items || [];

  if (items.length === 0) {
    showToast("Your cart is empty", true);
    setTimeout(() => window.location.href = "index.html", 1200);
    return;
  }

  const nameEl = document.getElementById("co-name");
  if (nameEl && CURRENT_USER) nameEl.value = CURRENT_USER.name;

  const box = document.getElementById("checkoutItems");
  if (box) {
    const eta = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const etaText = eta.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
    box.innerHTML = items.map(it => `
      <div class="co-amz-item">
        <img src="${productImage(it.product)}" alt="${escapeHtml(it.product.name)}"
             class="co-amz-img"
             onerror="this.onerror=null;this.src='${productPlaceholder(it.product)}'">
        <div class="co-amz-info">
          <div class="co-amz-name">${escapeHtml(it.product.name)}</div>
          <div class="co-amz-meta">
            <span class="co-amz-qty">Qty ${it.quantity}</span>
            <span class="co-amz-eta">Delivery by ${etaText}</span>
          </div>
        </div>
        <div class="co-amz-price">${money(it.product.price * it.quantity)}</div>
      </div>
    `).join("");
    const subEl = document.getElementById("coItemsSub");
    if (subEl) {
      const totalQty = items.reduce((s, it) => s + it.quantity, 0);
      subEl.textContent = `${totalQty} item${totalQty !== 1 ? "s" : ""}`;
    }
  }

  const custTypeEl = document.getElementById("custType");
  if (custTypeEl) custTypeEl.textContent = cart.customerType || "REGULAR";

  const wireDeliverTo = () => {
    const name = document.getElementById("co-name")?.value.trim() || CURRENT_USER?.name || "Customer";
    const addr = document.getElementById("co-address")?.value.trim();
    const city = document.getElementById("co-city")?.value.trim();
    const state = document.getElementById("co-state")?.value.trim();
    const pin = document.getElementById("co-pincode")?.value.trim();

    const nameEl = document.getElementById("coDeliverName");
    const addrEl = document.getElementById("coDeliverAddr");
    const etaEl  = document.getElementById("coDeliverEta");

    if (nameEl) nameEl.textContent = name;
    const parts = [addr, city, state, pin].filter(Boolean);
    if (addrEl) addrEl.innerHTML = parts.length ? parts.join(", ") : "Add your delivery address";
    if (etaEl) {
      const eta = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const etaText = eta.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
      etaEl.innerHTML = `Estimated delivery: <b>${etaText}</b>`;
    }
  };

  ["co-name", "co-address", "co-city", "co-state", "co-pincode"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.removeEventListener("input", wireDeliverTo);
      el.addEventListener("input", wireDeliverTo);
    }
  });
  wireDeliverTo();

  const phone = document.getElementById("co-phone");
  if (phone) {
    phone.setAttribute("maxlength", "10");
    phone.setAttribute("inputmode", "numeric");
    phone.addEventListener("input", (e) => {
      const cleaned = e.target.value.replace(/\D/g, "").slice(0, 10);
      if (e.target.value !== cleaned) e.target.value = cleaned;
    });
  }

  const pin = document.getElementById("co-pincode");
  if (pin) {
    pin.setAttribute("maxlength", "6");
    pin.setAttribute("inputmode", "numeric");
    pin.addEventListener("input", (e) => {
      const cleaned = e.target.value.replace(/\D/g, "").slice(0, 6);
      if (e.target.value !== cleaned) e.target.value = cleaned;
    });
  }

  await refreshBill();
}

async function placeOrder(e) {
  if (e) e.preventDefault();
  const addressLine = document.getElementById("co-address").value.trim();
  const city        = document.getElementById("co-city").value.trim();
  const state       = document.getElementById("co-state").value.trim();
  const pincode     = document.getElementById("co-pincode").value.trim();
  const phone       = document.getElementById("co-phone").value.trim();

  if (!addressLine || !city || !state || !pincode || !phone) {
    showToast("Please fill all address fields", true);
    return false;
  }
  if (phone.length !== 10) { showToast("Phone number must be exactly 10 digits", true); return false; }
  if (pincode.length !== 6) { showToast("PIN code must be exactly 6 digits", true); return false; }

  const data = await postJson(`${API}/checkout`, { addressLine, city, state, pincode, phone });
  if (!data.success) {
    showToast(data.error || "Checkout failed", true);
    return false;
  }

  // ✅ Flipkart-style success screen (auto-redirects to home after 3s)
  showOrderSuccess(data.orderId, data.bill.finalAmount);
  return false;
}

/* ========================================================================
   ORDER SUCCESS SCREEN (Flipkart-style)
   ======================================================================== */
function showOrderSuccess(orderId, amount) {
  const old = document.getElementById("orderSuccessOverlay");
  if (old) old.remove();

  const overlay = document.createElement("div");
  overlay.id = "orderSuccessOverlay";
  overlay.className = "order-success-overlay";
  overlay.innerHTML = `
    <div class="order-success-card">
      <div class="order-success-check">
        <svg viewBox="0 0 52 52">
          <circle cx="26" cy="26" r="24" fill="none" stroke="#16a34a" stroke-width="3"/>
          <path d="M14 27 L22 35 L38 19"
                fill="none" stroke="#16a34a" stroke-width="4"
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <h2 class="order-success-title">Order Placed Successfully!</h2>
      <p class="order-success-sub">Thank you for shopping with SmartCart</p>
      <div class="order-success-details">
        <div class="order-success-row">
          <span>Order ID</span>
          <b>#${orderId}</b>
        </div>
        <div class="order-success-row">
          <span>Total Paid</span>
          <b>${money(amount)}</b>
        </div>
        <div class="order-success-row">
          <span>Estimated Delivery</span>
          <b>Tomorrow</b>
        </div>
      </div>
      <div class="order-success-progress">
        <div class="order-success-bar"></div>
      </div>
      <p class="order-success-redirect">Redirecting to home…</p>
    </div>
  `;
  document.body.appendChild(overlay);

  requestAnimationFrame(() => overlay.classList.add("show"));

  setTimeout(() => {
    const bar = overlay.querySelector(".order-success-bar");
    if (bar) bar.style.width = "100%";
  }, 100);

  setTimeout(() => {
    overlay.classList.remove("show");
    setTimeout(() => { window.location.href = "index.html"; }, 300);
  }, 3000);
}

/* ========================================================================
   PAGE: PROFILE
   ======================================================================== */
async function loadProfile() {
  if (!await requireLogin()) return;

  document.getElementById("avatar").textContent = initials(CURRENT_USER.name);
  document.getElementById("profileName").textContent = CURRENT_USER.name;
  document.getElementById("profileEmail").textContent = CURRENT_USER.email;

  const tierBadge = document.getElementById("profileTier");
  if (tierBadge) {
    tierBadge.textContent = CURRENT_USER.customerType;
    tierBadge.className = "profile-tier-badge " + tierClass(CURRENT_USER.customerType);
  }

  const sidebarAvatar = document.getElementById("sidebarAvatar");
  const sidebarName = document.getElementById("sidebarName");
  if (sidebarAvatar) sidebarAvatar.textContent = initials(CURRENT_USER.name);
  if (sidebarName) sidebarName.textContent = CURRENT_USER.name.split(" ")[0];

  const infoName = document.getElementById("infoName");
  const infoEmail = document.getElementById("infoEmail");
  const infoTier = document.getElementById("infoTier");
  const infoId = document.getElementById("infoId");
  if (infoName) infoName.textContent = CURRENT_USER.name;
  if (infoEmail) infoEmail.textContent = CURRENT_USER.email;
  if (infoTier) infoTier.textContent = CURRENT_USER.customerType;
  if (infoId) infoId.textContent = "#" + CURRENT_USER.id;

  await renderMembershipSection();
  await loadMyReviews();
  await loadMyOrders();
}

function switchAccountPanel(panelId, element) {
  document.querySelectorAll(".account-panel").forEach(p => p.classList.remove("active"));
  const panel = document.getElementById(panelId);
  if (panel) panel.classList.add("active");
  document.querySelectorAll(".account-nav .nav-item").forEach(n => n.classList.remove("active"));
  if (element) element.classList.add("active");
}

/* ========================================================================
   MEMBERSHIP
   ======================================================================== */
async function renderMembershipSection() {
  const container = document.getElementById("memberGrid");
  if (!container) return;
  container.innerHTML = `<div class="orders-loading">Loading membership…</div>`;

  try {
    const res = await fetch(`${API}/user/membership`);
    const data = await res.json();
    MY_MEMBERSHIP = data.membership || { tier: CURRENT_USER.customerType, autoRenew: true };
    MY_BILLING_HISTORY = data.history || [];
  } catch (e) {
    MY_MEMBERSHIP = { tier: CURRENT_USER.customerType, autoRenew: true };
    MY_BILLING_HISTORY = [];
  }

  renderMembershipUI();
}

function renderMembershipUI() {
  const container = document.getElementById("memberGrid");
  if (!container) return;

  const currentTier = (MY_MEMBERSHIP.tier || CURRENT_USER.customerType || "REGULAR").toUpperCase();
  const renewsAt = MY_MEMBERSHIP.renewsAt ? new Date(MY_MEMBERSHIP.renewsAt) : null;
  const autoRenew = !!MY_MEMBERSHIP.autoRenew;

  const daysLeft = renewsAt
    ? Math.max(0, Math.ceil((renewsAt - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const fmtDate = d => d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  const tiers = [
    { name: "REGULAR", rate: "0%",  desc: "Standard pricing for everyone",
      features: ["No discount", "Standard support", "Access to all products"] },
    { name: "PREMIUM", rate: "5%",  desc: "Save 5% on every order",
      features: ["5% off all orders", "Priority support", "Exclusive deals"] },
    { name: "VIP",     rate: "10%", desc: "Best savings tier", vip: true,
      features: ["10% off all orders", "Access to VIP20 coupon", "Free priority support", "Early access to new products"] }
  ];

  const plansHTML = tiers.map(t => {
    const isCurrent = currentTier === t.name;

    let btnLabel, btnDisabled, btnAction;
    if (isCurrent) {
      btnLabel = "Current Plan";
      btnDisabled = "disabled";
      btnAction = "";
    } else if (t.name === "REGULAR") {
      btnLabel = "Switch to REGULAR";
      btnDisabled = "";
      btnAction = `onclick="downgradeToRegular()"`;
    } else {
      const price = TIER_PRICING[t.name]?.amount || 0;
      btnLabel = `Upgrade · ₹${price}`;
      btnDisabled = "";
      btnAction = `onclick="upgradeTier('${t.name}')"`;
    }

    const renewalInfo = (isCurrent && renewsAt)
      ? `<div class="member-renewal">
           <div class="member-renewal-row">
             <span>Next renewal</span>
             <b>${fmtDate(renewsAt)}</b>
           </div>
           <div class="member-renewal-row">
             <span>Renews in</span>
             <b>${daysLeft} day${daysLeft !== 1 ? "s" : ""}</b>
           </div>
         </div>`
      : "";

    return `
      <div class="member-card ${t.vip ? 'vip-card' : ''} ${isCurrent ? 'current' : ''}">
        <div class="member-name">${t.name}</div>
        <div class="member-rate">${t.rate}</div>
        <div class="member-desc">${t.desc}</div>
        <ul class="member-features">
          ${t.features.map(f => `<li>${f}</li>`).join("")}
        </ul>
        ${renewalInfo}
        <button class="member-btn" ${btnDisabled} ${btnAction}>${btnLabel}</button>
      </div>`;
  }).join("");

  const historyHTML = MY_BILLING_HISTORY.length === 0
    ? `<div class="mem-history-empty">
         <div style="font-size:40px;opacity:0.5;">🧾</div>
         <p>No billing history yet. Your payments will appear here.</p>
       </div>`
    : `
      <div class="mem-history-table-wrap">
        <table class="mem-history-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Plan</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Status</th>
              <th>Invoice</th>
            </tr>
          </thead>
          <tbody>
            ${MY_BILLING_HISTORY.map(p => {
              const d = p.paidAt ? new Date(p.paidAt) : null;
              const dateStr = d ? d.toLocaleDateString("en-IN", {
                day: "numeric", month: "short", year: "numeric"
              }) : "—";
              const methodLabel = {
                card: "Card", upi: "UPI", netbanking: "Net Banking"
              }[p.method] || p.method || "—";

              return `
                <tr>
                  <td>${dateStr}</td>
                  <td><span class="mem-tier-pill tier-${p.tier.toLowerCase()}">${p.tier}</span></td>
                  <td><b>${money(p.amount)}</b></td>
                  <td>${escapeHtml(methodLabel)}</td>
                  <td><span class="mem-status-pill status-${(p.status || 'paid').toLowerCase()}">${p.status || "PAID"}</span></td>
                  <td><code>${escapeHtml(p.invoiceNo || "—")}</code></td>
                </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>`;

    container.innerHTML = `
      <div class="member-grid member-grid-3">${plansHTML}</div>
      <div class="section-subtitle">Billing history</div>
      ${historyHTML}
    `;
}

function upgradeTier(tier) {
  if (!CURRENT_USER) { showToast("Please login to upgrade", true); return; }
  if (CURRENT_USER.customerType === tier) { showToast("You are already on this tier"); return; }
  if (tier === "REGULAR") { showToast("You cannot downgrade to REGULAR here"); return; }

  const pricing = TIER_PRICING[tier];
  if (!pricing) return showToast("Unknown tier", true);
  openPaymentModal(tier, pricing);
}

function openPaymentModal(tier, pricing) {
  const old = document.getElementById("paymentModal");
  if (old) old.remove();

  const modal = document.createElement("div");
  modal.id = "paymentModal";
  modal.className = "modal-overlay show";
  modal.innerHTML = `
    <div class="modal-box payment-modal">
      <div class="payment-modal-head">
        <button class="payment-close" id="paymentClose" title="Close">✕</button>
        <div class="payment-badge">${tier}</div>
        <h3 class="modal-title" style="text-align:left;">Upgrade to ${tier}</h3>
        <p class="payment-sub">Unlock all the perks of ${tier} tier</p>
        <div class="payment-amount">${pricing.label}</div>
      </div>

      <div class="payment-methods">
        <label class="payment-method selected" data-method="card">
          <input type="radio" name="payMethod" value="card" checked>
          <span class="pay-icon">💳</span>
          <div class="pay-info">
            <div class="pay-name">Credit / Debit Card</div>
            <div class="pay-desc">Visa, Mastercard, RuPay</div>
          </div>
        </label>
        <label class="payment-method" data-method="upi">
          <input type="radio" name="payMethod" value="upi">
          <span class="pay-icon">📱</span>
          <div class="pay-info">
            <div class="pay-name">UPI</div>
            <div class="pay-desc">GPay, PhonePe, Paytm</div>
          </div>
        </label>
        <label class="payment-method" data-method="netbanking">
          <input type="radio" name="payMethod" value="netbanking">
          <span class="pay-icon">🏦</span>
          <div class="pay-info">
            <div class="pay-name">Net Banking</div>
            <div class="pay-desc">All major banks supported</div>
          </div>
        </label>
      </div>

      <div class="payment-form" id="cardForm">
        <label>Card number</label>
        <input type="text" id="pm-card" placeholder="1234 5678 9012 3456"
               inputmode="numeric" maxlength="19" autocomplete="cc-number">
        <div class="payment-form-row">
          <div>
            <label>Expiry</label>
            <input type="text" id="pm-expiry" placeholder="MM / YY"
                   inputmode="numeric" maxlength="7" autocomplete="cc-exp">
          </div>
          <div>
            <label>CVV</label>
            <input type="text" id="pm-cvv" placeholder="123"
                   inputmode="numeric" maxlength="4" autocomplete="cc-csc">
          </div>
        </div>
        <label>Name on card</label>
        <input type="text" id="pm-name" placeholder="John Doe" autocomplete="cc-name">
      </div>

      <div class="payment-form" id="upiForm" style="display:none;">
        <label>UPI ID</label>
        <input type="text" id="pm-upi" placeholder="yourname@upi" autocomplete="off">
      </div>

      <div class="payment-form" id="netbankingForm" style="display:none;">
        <label>Select your bank</label>
        <select id="pm-bank">
          <option value="">Choose a bank…</option>
          <option value="hdfc">HDFC Bank</option>
          <option value="icici">ICICI Bank</option>
          <option value="sbi">State Bank of India</option>
          <option value="axis">Axis Bank</option>
          <option value="kotak">Kotak Mahindra</option>
        </select>
      </div>

      <div class="payment-summary">
        <div class="payment-summary-row">
          <span>Amount</span>
          <span><b>${pricing.label}</b></span>
        </div>
      </div>

      <div class="modal-actions">
        <button class="modal-btn cancel" id="payCancel">Cancel</button>
        <button class="modal-btn admin-confirm" id="paySubmit">
          Pay ${pricing.label.split(" ")[0]} & Upgrade
        </button>
      </div>

      <div class="payment-secure">🔒 Secured by SmartCart Pay · Demo — no real money</div>
    </div>`;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector("#paymentClose").addEventListener("click", close);
  modal.querySelector("#payCancel").addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });

  let selectedMethod = "card";
  const methodLabels = modal.querySelectorAll(".payment-method");
  const forms = {
    card:        modal.querySelector("#cardForm"),
    upi:         modal.querySelector("#upiForm"),
    netbanking:  modal.querySelector("#netbankingForm")
  };

  methodLabels.forEach(label => {
    label.addEventListener("click", () => {
      selectedMethod = label.dataset.method;
      methodLabels.forEach(l => l.classList.toggle("selected", l === label));
      Object.keys(forms).forEach(k => {
        forms[k].style.display = k === selectedMethod ? "" : "none";
      });
    });
  });

  const cardEl = modal.querySelector("#pm-card");
  cardEl.addEventListener("input", (e) => {
    let v = e.target.value.replace(/\D/g, "").slice(0, 16);
    v = v.replace(/(.{4})/g, "$1 ").trim();
    e.target.value = v;
  });
  const expiryEl = modal.querySelector("#pm-expiry");
  expiryEl.addEventListener("input", (e) => {
    let v = e.target.value.replace(/\D/g, "").slice(0, 4);
    if (v.length >= 3) v = v.slice(0, 2) + " / " + v.slice(2);
    e.target.value = v;
  });
  const cvvEl = modal.querySelector("#pm-cvv");
  cvvEl.addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
  });

  modal.querySelector("#paySubmit").addEventListener("click", async () => {
    const payBtn = modal.querySelector("#paySubmit");

    if (selectedMethod === "card") {
      const num = cardEl.value.replace(/\s/g, "");
      const exp = expiryEl.value.replace(/\s/g, "");
      const cvv = cvvEl.value;
      if (num.length < 16) return showToast("Enter a valid 16-digit card number", true);
      if (exp.length < 5)  return showToast("Enter a valid expiry (MM / YY)", true);
      if (cvv.length < 3)  return showToast("Enter a valid CVV", true);
    }
    if (selectedMethod === "upi") {
      const upi = modal.querySelector("#pm-upi").value.trim();
      if (!upi.includes("@")) return showToast("Enter a valid UPI ID", true);
    }
    if (selectedMethod === "netbanking") {
      const bank = modal.querySelector("#pm-bank").value;
      if (!bank) return showToast("Please select your bank", true);
    }

    payBtn.disabled = true;
    payBtn.textContent = "Processing payment…";

    await new Promise(r => setTimeout(r, 1200));

    try {
      const data = await postJson(`${API}/user/upgrade/paid`, {
        customerType: tier,
        paymentMethod: selectedMethod,
        amount: pricing.amount
      });

      if (data.error) {
        showToast(data.error, true);
        payBtn.disabled = false;
        payBtn.textContent = `Pay ${pricing.label.split(" ")[0]} & Upgrade`;
        return;
      }

      close();
      showToast(`Payment successful! Welcome to ${tier} ✓`);
      CURRENT_USER = data.user;
      USER_LOAD_PROMISE = null;

      await renderMembershipSection();
      loadUserHeader();

    } catch (err) {
      showToast("Payment failed. Please try again.", true);
      payBtn.disabled = false;
      payBtn.textContent = `Pay ${pricing.label.split(" ")[0]} & Upgrade`;
    }
  });
}

function confirmCancelMembership() {
  const old = document.getElementById("cancelMembershipModal");
  if (old) old.remove();

  const modal = document.createElement("div");
  modal.id = "cancelMembershipModal";
  modal.className = "modal-overlay show";
  modal.innerHTML = `
    <div class="modal-box cancel-modal">
      <div class="modal-icon warn-icon">⚠</div>
      <h3 class="modal-title">Cancel membership?</h3>
      <p class="modal-message">
        You'll lose your ${(MY_MEMBERSHIP?.tier || "").toUpperCase()} benefits immediately and switch back to REGULAR pricing.
      </p>
      <div class="cancel-reason-wrap">
        <label class="cancel-reason-label">Reason (optional)</label>
        <select id="cancelMemReason" class="cancel-reason-select">
          <option value="">Select a reason…</option>
          <option value="Too expensive">Too expensive</option>
          <option value="Not using it enough">Not using it enough</option>
          <option value="Found a better option">Found a better option</option>
          <option value="Just testing">Just testing</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div class="modal-actions">
        <button class="modal-btn cancel" id="memKeep">Keep membership</button>
        <button class="modal-btn confirm" id="memConfirm">Yes, cancel</button>
      </div>
    </div>`;

  document.body.appendChild(modal);

  const cleanup = (result) => { modal.remove(); if (result !== null) doCancelMembership(result); };
  modal.querySelector("#memKeep").addEventListener("click", () => cleanup(null));
  modal.querySelector("#memConfirm").addEventListener("click", () => {
    const reason = modal.querySelector("#cancelMemReason").value || "Not specified";
    cleanup(reason);
  });
  modal.addEventListener("click", (e) => { if (e.target === modal) cleanup(null); });
}

async function doCancelMembership(reason) {
  try {
    const data = await postJson(`${API}/user/membership/cancel`, { reason });
    if (data.error) { showToast(data.error, true); return; }

    showToast("Membership cancelled. You are back on REGULAR.");
    CURRENT_USER = data.user;
    USER_LOAD_PROMISE = null;

    await renderMembershipSection();
    loadUserHeader();
  } catch (e) {
    showToast("Failed to cancel. Try again.", true);
  }
}

async function downgradeToRegular() {
  if (!confirm("Switch to REGULAR? You'll lose all premium benefits immediately.")) return;
  try {
    const data = await postJson(`${API}/user/upgrade`, { customerType: "REGULAR" });
    if (data.error) { showToast(data.error, true); return; }
    showToast("Switched to REGULAR");
    CURRENT_USER = data.user;
    USER_LOAD_PROMISE = null;
    await renderMembershipSection();
    loadUserHeader();
  } catch (e) {
    showToast("Failed to switch. Try again.", true);
  }
}

/* ========================================================================
   REVIEWS — DATA
   ======================================================================== */
async function loadMyReviews() {
  try {
    const res = await fetch(`${API}/user/reviews/my`);
    const data = await res.json();
    MY_REVIEWS = Array.isArray(data) ? data : [];
  } catch (e) { MY_REVIEWS = []; }
}
function hasReviewed(productId) {
  const pid = String(productId);
  return MY_REVIEWS.some(r => String(r.productId) === pid);
}
async function loadProductRating(productId, force = false) {
  const pid = String(productId);
  if (!force && PRODUCT_RATINGS[pid]) return PRODUCT_RATINGS[pid];
  try {
    const res = await fetch(`${API}/products/${pid}/rating`);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const safe = { average: Number(data.average) || 0, count: Number(data.count) || 0 };
    PRODUCT_RATINGS[pid] = safe;
    return safe;
  } catch (e) { return { average: 0, count: 0 }; }
}
async function hydrateRatingEl(el, productId, size = 14) {
  if (!el) return;
  const r = await loadProductRating(productId);
  const target = document.getElementById(el.id);
  if (!target) return;
  if (r.count === 0) {
    target.innerHTML = `${renderStars(0, size)} <span class="card-rating-count">No reviews</span>`;
  } else {
    target.innerHTML = `${renderStars(r.average, size)} ` +
                       `<span class="card-rating-count">${r.average.toFixed(1)} (${r.count})</span>`;
  }
}

/* ========================================================================
   REVIEWS — SUBMIT MODAL
   ======================================================================== */
function openReviewModal(orderId, productId, productName) {
  const old = document.getElementById("reviewModal");
  if (old) old.remove();
  const modal = document.createElement("div");
  modal.id = "reviewModal";
  modal.className = "modal-overlay show";
  modal.innerHTML = `
    <div class="modal-box review-modal">
      <h3 class="modal-title">Rate & review</h3>
      <div class="review-product-name">${escapeHtml(productName)}</div>
      <div class="review-stars" id="reviewStars">
        ${[1,2,3,4,5].map(n => `<button type="button" class="star" data-value="${n}">★</button>`).join("")}
      </div>
      <div class="review-rating-label" id="reviewRatingLabel">Tap a star to rate</div>
      <textarea id="reviewFeedback" class="review-feedback"
                placeholder="Share your experience (optional)"
                maxlength="500" rows="4"></textarea>
      <div class="modal-actions review-actions">
        <button class="modal-btn cancel" id="reviewCancel">Cancel</button>
        <button class="modal-btn view-all" id="reviewViewAll">View all reviews</button>
        <button class="modal-btn confirm" id="reviewSubmit" disabled>Submit</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  let selectedRating = 0;
  const starsWrap = modal.querySelector("#reviewStars");
  const ratingLabel = modal.querySelector("#reviewRatingLabel");
  const submitBtn = modal.querySelector("#reviewSubmit");
  const feedbackEl = modal.querySelector("#reviewFeedback");
  const labels = ["", "Very poor", "Poor", "Average", "Good", "Excellent"];

  starsWrap.querySelectorAll(".star").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedRating = parseInt(btn.dataset.value, 10);
      starsWrap.querySelectorAll(".star").forEach(s => {
        s.classList.toggle("active", parseInt(s.dataset.value, 10) <= selectedRating);
      });
      ratingLabel.textContent = `${selectedRating} / 5 · ${labels[selectedRating]}`;
      submitBtn.disabled = false;
    });
    btn.addEventListener("mouseenter", () => {
      const v = parseInt(btn.dataset.value, 10);
      starsWrap.querySelectorAll(".star").forEach(s => {
        s.classList.toggle("hover", parseInt(s.dataset.value, 10) <= v);
      });
    });
  });
  starsWrap.addEventListener("mouseleave", () => {
    starsWrap.querySelectorAll(".star").forEach(s => s.classList.remove("hover"));
  });

  const cleanup = () => modal.remove();
  modal.querySelector("#reviewCancel").addEventListener("click", cleanup);
  modal.addEventListener("click", (e) => { if (e.target === modal) cleanup(); });

  modal.querySelector("#reviewViewAll").addEventListener("click", () => {
    cleanup();
    showReviewsForProduct(productId, productName);
  });

  submitBtn.addEventListener("click", async () => {
    if (selectedRating < 1) return;
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting…";
    try {
      const data = await postJson(`${API}/user/reviews/submit`, {
        orderId, productId, rating: selectedRating,
        feedback: feedbackEl.value.trim()
      });
      if (data.error) {
        showToast(data.error, true);
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit";
        return;
      }
      showToast("Thanks for your review ✓");
      cleanup();
      delete PRODUCT_RATINGS[String(productId)];
      await loadMyReviews();
      await loadMyOrders();
      const el = document.getElementById(`rating-${productId}`);
      if (el) hydrateRatingEl(el, productId, 14);
    } catch (err) {
      showToast("Failed to submit review", true);
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
    }
  });
}

/* ========================================================================
   REVIEWS — VIEW ALL MODAL
   ======================================================================== */
async function showReviewsForProduct(productId, productName) {
  const old = document.getElementById("reviewsViewModal");
  if (old) old.remove();

  const modal = document.createElement("div");
  modal.id = "reviewsViewModal";
  modal.className = "modal-overlay show";
  modal.innerHTML = `
    <div class="modal-box reviews-view-modal">
      <div class="reviews-view-head">
        <h3 class="modal-title">Customer reviews</h3>
        <button class="reviews-close" id="reviewsClose">✕</button>
      </div>
      <div class="review-product-name">${escapeHtml(productName)}</div>
      <div id="reviewsList"></div>
    </div>`;
  document.body.appendChild(modal);

  const listEl = modal.querySelector("#reviewsList");
  const cleanup = () => modal.remove();
  modal.querySelector("#reviewsClose").addEventListener("click", cleanup);
  modal.addEventListener("click", (e) => { if (e.target === modal) cleanup(); });

  renderSkeletonReviews(listEl, 3);

  try {
    const res = await fetch(`${API}/products/${productId}/reviews`);
    const reviews = await res.json();

    if (!Array.isArray(reviews) || reviews.length === 0) {
      listEl.innerHTML = `
        <div class="reviews-empty">
          <div style="font-size:40px">💬</div>
          <h4>No reviews yet</h4>
          <p>Be the first to review this product!</p>
        </div>`;
      return;
    }

    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    const roundedAvg = Math.round(avg * 10) / 10;

    listEl.innerHTML = `
      <div class="reviews-summary">
        <div class="reviews-avg">
          <div class="reviews-avg-num">${roundedAvg.toFixed(1)}</div>
          <div class="reviews-avg-stars">${renderStars(roundedAvg, 18)}</div>
          <div class="reviews-avg-count">${reviews.length} review${reviews.length !== 1 ? "s" : ""}</div>
        </div>
      </div>
      <div class="reviews-items">
        ${reviews.map(r => `
          <div class="review-item">
            <div class="review-item-head">
              <div class="review-avatar">${initials(r.userName || "?")}</div>
              <div>
                <div class="review-user">${escapeHtml(r.userName || "Anonymous")}</div>
                <div class="review-date">${(r.createdAt || "").substring(0, 16)}</div>
              </div>
            </div>
            <div class="review-stars-line">${renderStars(r.rating, 16)}</div>
            ${r.feedback ? `<div class="review-text">${escapeHtml(r.feedback)}</div>` : ""}
          </div>`).join("")}
      </div>`;
  } catch (e) {
    listEl.innerHTML = `<div class="reviews-empty"><h4>Error loading reviews</h4></div>`;
  }
}

/* ========================================================================
   PAGE: PROFILE — MY ORDERS
   ======================================================================== */
async function loadMyOrders() {
  const container = document.getElementById("myOrdersList");
  if (!container) return;
  try {
    const res = await fetch(`${API}/user/orders`);
    const orders = await res.json();
    if (!Array.isArray(orders) || orders.length === 0) {
      container.innerHTML = `
        <div class="orders-empty-side">
          <div class="empty-icon-side">📦</div>
          <h4>No orders yet</h4>
          <p>Your order history will appear here.</p>
          <a href="index.html" class="btn-shop">Start Shopping</a>
        </div>`;
      return;
    }
    container.innerHTML = orders.map(o => renderOrderSideCard(o)).join("");
  } catch (e) {
    container.innerHTML = `<div class="orders-empty-side">Error: ${escapeHtml(e.message)}</div>`;
  }
}

function renderOrderSideCard(o) {
  const items = o.items || [];
  const totalItems = items.reduce((s, it) => s + it.quantity, 0);

  const thumbs = items.slice(0, 4).map(it => `
    <div class="amz-thumb">
      <img src="images/${it.productId}.jpg" alt="${escapeHtml(it.productName || it.productId)}"
           onerror="this.onerror=null;this.style.display='none'">
    </div>`).join("");

  const moreCount = items.length > 4 ? `<div class="amz-more">+${items.length - 4}</div>` : "";
  const namesPreview = items.slice(0, 2).map(it => escapeHtml(it.productName || it.productId))
    .join(", ") + (items.length > 2 ? ` and ${items.length - 2} more` : "");

  const placedAt = new Date(o.createdAt || Date.now());
  const now = Date.now();
  const msSince = now - placedAt.getTime();
  const minutesSince = msSince / (1000 * 60);
  const hoursSince   = msSince / (1000 * 60 * 60);

  const fmtDate = d => d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const fmtDateTime = d => d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const deliveredAt = new Date(placedAt.getTime() + 24 * 60 * 60 * 1000);
  const msToDelivery    = Math.max(0, deliveredAt.getTime() - now);
  const minsToDelivery  = Math.floor(msToDelivery / (1000 * 60));
  const hoursToDelivery = Math.floor(minsToDelivery / 60);
  const remMins         = minsToDelivery % 60;

  function remainingText() {
    if (hoursToDelivery >= 1) return `${hoursToDelivery}h ${remMins}m left`;
    return `${minsToDelivery}m left`;
  }

  const dbStatus = (o.status || "").toUpperCase();
  let status, canCancel, headline, subtext, progressStep;

  if (dbStatus === "CANCELLED") {
    status = "CANCELLED"; canCancel = false;
    headline = "Order cancelled"; subtext = `Cancelled on ${fmtDate(placedAt)}`; progressStep = -1;
  } else if (dbStatus === "DELIVERED") {
    status = "DELIVERED"; canCancel = false;
    headline = "Delivered"; subtext = `Delivered at ${fmtDateTime(deliveredAt)}`; progressStep = 3;
  } else if (minutesSince < 30) {
    status = "ORDERED"; canCancel = true;
    headline = "Order placed"; subtext = `Arriving by ${fmtDateTime(deliveredAt)} · ${remainingText()}`; progressStep = 0;
  } else if (hoursSince < 6) {
    status = "SHIPPED"; canCancel = true;
    headline = "Shipped"; subtext = `Arriving by ${fmtDateTime(deliveredAt)} · ${remainingText()}`; progressStep = 1;
  } else if (hoursSince < 24) {
    status = "OUT_FOR_DELIVERY"; canCancel = true;
    headline = "Out for delivery"; subtext = `Arriving by ${fmtDateTime(deliveredAt)} · ${remainingText()}`; progressStep = 2;
  } else {
    status = "DELIVERED"; canCancel = false;
    headline = "Delivered"; subtext = `Delivered at ${fmtDateTime(deliveredAt)}`; progressStep = 3;
  }

  let cancelHint = "";
  if (canCancel) {
    if (hoursToDelivery >= 1) cancelHint = `You can cancel any time before delivery · ${hoursToDelivery}h ${remMins}m left`;
    else cancelHint = `You can cancel any time before delivery · ${minsToDelivery}m left`;
  }

  const steps = ["Ordered", "Shipped", "Out for delivery", "Delivered"];
  const progressBar = status !== "CANCELLED"
    ? `
      <div class="amz-progress">
        ${steps.map((s, i) => `
          <div class="amz-step ${i <= progressStep ? 'done' : ''} ${i === progressStep ? 'active' : ''}">
            <div class="amz-step-dot">${i <= progressStep ? "✓" : i + 1}</div>
            <div class="amz-step-label">${s}</div>
          </div>
          ${i < steps.length - 1 ? `<div class="amz-step-line ${i < progressStep ? 'done' : ''}"></div>` : ""}
        `).join("")}
      </div>` : "";

  const pillClass = status === "CANCELLED" ? "cancelled"
                  : status === "DELIVERED" ? "delivered"
                  : status === "OUT_FOR_DELIVERY" ? "out-for-delivery"
                  : status === "SHIPPED" ? "shipped" : "placed";
  const pillLabel = status === "CANCELLED" ? "Cancelled"
                  : status === "DELIVERED" ? "Delivered"
                  : status === "OUT_FOR_DELIVERY" ? "Out for delivery"
                  : status === "SHIPPED" ? "Shipped" : "Ordered";

  const cancelReason = o.cancelReason
    ? `<div class="amz-cancel-reason">Reason: ${escapeHtml(o.cancelReason)}</div>` : "";

  return `
    <div class="amz-order ${status === 'CANCELLED' ? 'amz-cancelled' : ''}">
      <div class="amz-order-head">
        <div class="amz-col">
          <div class="amz-label">Order placed</div>
          <div class="amz-value">${fmtDate(placedAt)}</div>
        </div>
        <div class="amz-col">
          <div class="amz-label">Total</div>
          <div class="amz-value">${money(o.finalAmount)}</div>
        </div>
        <div class="amz-col amz-col-actions">
          <button class="amz-details-btn" onclick="toggleOrderSideBody(${o.orderId}, this)">
            <span>Order details</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="amz-headline">
        <div class="amz-headline-main">
          <span class="amz-status-pill ${pillClass}">${pillLabel}</span>
          <span class="amz-headline-text">${headline}</span>
        </div>
        <div class="amz-headline-sub">${subtext}</div>
      </div>

      ${progressBar}

      <div class="amz-order-body">
        <div class="amz-thumbs">${thumbs}${moreCount}</div>
        <div class="amz-info">
          <div class="amz-title">${namesPreview}</div>
          <div class="amz-meta">
            <span class="order-badge-side ${(o.customerType || 'regular').toLowerCase()}">${o.customerType || "REGULAR"}</span>
            ${o.couponCode ? `<span class="amz-coupon">🎟️ ${o.couponCode}</span>` : ""}
            <span class="amz-dot">·</span>
            <span>${totalItems} item${totalItems !== 1 ? "s" : ""}</span>
          </div>
        </div>
        ${o.addressLine ? `
          <div class="amz-ship-to">
            <div class="amz-ship-to-label">Ship to</div>
            <div class="amz-ship-to-name">${escapeHtml((CURRENT_USER && CURRENT_USER.name) || "Customer")}</div>
            <div class="amz-ship-to-addr">
              ${escapeHtml(o.addressLine)}<br>
              ${escapeHtml(o.city || "")}, ${escapeHtml(o.state || "")} — ${escapeHtml(o.pincode || "")}
            </div>
            ${o.phone ? `<div class="amz-ship-to-phone">📞 ${escapeHtml(o.phone)}</div>` : ""}
          </div>` : ""}
        <div class="amz-status">
          <div class="amz-status-date">${subtext}</div>
        </div>
      </div>

      <div class="amz-order-actions">
        ${canCancel
          ? `<div class="amz-cancel-wrap">
               <button class="amz-cancel-btn" onclick="cancelOrder(${o.orderId})">
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                   <circle cx="12" cy="12" r="10"/>
                   <line x1="15" y1="9" x2="9" y2="15"/>
                   <line x1="9" y1="9" x2="15" y2="15"/>
                 </svg>
                 Cancel order
               </button>
               <div class="amz-cancel-hint">${cancelHint}</div>
             </div>`
          : status === "CANCELLED"
            ? `<span class="amz-cancelled-note">
                 This order was cancelled${o.cancelReason ? ` · ${escapeHtml(o.cancelReason)}` : ""}
               </span>`
            : `<span class="amz-delivered-note">✓ Delivered — order complete</span>`
        }
      </div>

      <div class="order-side-body" id="order-side-body-${o.orderId}">
        <div class="amz-details">
          <h4>Items in this order</h4>
          ${items.map(it => {
            const reviewed = hasReviewed(it.productId);
            const showReviewBtn = (dbStatus === "DELIVERED") && !reviewed;
            const safeName = escapeHtml(it.productName || it.productId).replace(/'/g, "\\'");
            return `
              <div class="amz-line-item">
                <img src="images/${it.productId}.jpg" alt=""
                     onerror="this.onerror=null;this.style.display='none'">
                <div class="amz-line-info">
                  <div class="amz-line-name">${escapeHtml(it.productName || it.productId)}</div>
                  <div class="amz-line-meta">Qty ${it.quantity} · ${money(it.unitPrice)} each</div>
                </div>
                <div class="amz-line-price">${money(it.lineTotal)}</div>
                ${showReviewBtn ? `
                  <button class="amz-review-btn"
                          onclick="openReviewModal(${o.orderId}, '${it.productId}', '${safeName}')">
                    ★ Rate this product
                  </button>
                ` : reviewed ? `
                  <span class="amz-reviewed-note">✓ Reviewed</span>
                ` : ""}
              </div>`;
          }).join("")}
          <div class="amz-bill">
            <div class="row"><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
            <div class="row"><span>Total discount</span><span class="green">−${money(o.totalDiscount)}</span></div>
            <div class="row"><span>GST</span><span>${money(o.gst)}</span></div>
            <div class="row total"><span>Grand Total</span><span>${money(o.finalAmount)}</span></div>
          </div>
          ${cancelReason}
        </div>
      </div>
    </div>`;
}

function toggleOrderSideBody(orderId, btn) {
  const body = document.getElementById(`order-side-body-${orderId}`);
  if (!body) return;
  const isOpen = body.classList.toggle("open");
  btn.classList.toggle("open", isOpen);
  const span = btn.querySelector("span");
  if (span) span.textContent = isOpen ? "Hide details" : "Order details";
}

async function cancelOrder(orderId) {
  const reason = await showCancelConfirm(orderId);
  if (!reason) return;
  try {
    const data = await postJson(`${API}/user/orders/cancel`, { orderId, reason });
    if (data.error) { showToast(data.error, true); return; }
    showToast("Order cancelled ✓");
    await loadMyOrders();
  } catch (e) { showToast("Failed to cancel order", true); }
}

function showCancelConfirm(orderId) {
  return new Promise(resolve => {
    const old = document.getElementById("cancelOrderModal");
    if (old) old.remove();
    const modal = document.createElement("div");
    modal.id = "cancelOrderModal";
    modal.className = "modal-overlay show";
    modal.innerHTML = `
      <div class="modal-box cancel-modal">
        <div class="modal-icon warn-icon">⚠</div>
        <h3 class="modal-title">Cancel order #${orderId}?</h3>
        <p class="modal-message">Tell us why you're cancelling. Your feedback helps us improve.</p>
        <div class="cancel-reason-wrap">
          <label class="cancel-reason-label">Reason for cancellation</label>
          <select id="cancelReasonSelect" class="cancel-reason-select">
            <option value="">Select a reason…</option>
            <option value="Changed my mind">Changed my mind</option>
            <option value="Ordered by mistake">Ordered by mistake</option>
            <option value="Found a better price elsewhere">Found a better price elsewhere</option>
            <option value="Delivery time too long">Delivery time too long</option>
            <option value="Item no longer needed">Item no longer needed</option>
            <option value="Other">Other (please specify)</option>
          </select>
          <textarea id="cancelReasonOther" class="cancel-reason-other"
                    placeholder="Tell us more…" rows="2" style="display:none;" maxlength="200"></textarea>
        </div>
        <div class="modal-actions">
          <button class="modal-btn cancel" id="cancelOrderNo">Keep order</button>
          <button class="modal-btn confirm" id="cancelOrderYes" disabled>Yes, cancel</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const select   = modal.querySelector("#cancelReasonSelect");
    const otherBox = modal.querySelector("#cancelReasonOther");
    const yesBtn   = modal.querySelector("#cancelOrderYes");
    const noBtn    = modal.querySelector("#cancelOrderNo");
    select.addEventListener("change", () => {
      if (select.value === "Other") { otherBox.style.display = "block"; otherBox.focus(); }
      else { otherBox.style.display = "none"; otherBox.value = ""; }
      updateYesState();
    });
    otherBox.addEventListener("input", updateYesState);
    function updateYesState() {
      if (select.value === "Other") yesBtn.disabled = otherBox.value.trim().length < 3;
      else yesBtn.disabled = select.value === "";
    }
    const cleanup = (result) => { modal.remove(); resolve(result); };
    noBtn.addEventListener("click", () => cleanup(null));
    yesBtn.addEventListener("click", () => {
      const reason = select.value === "Other" ? otherBox.value.trim() : select.value;
      cleanup(reason || "Not specified");
    });
    modal.addEventListener("click", (e) => { if (e.target === modal) cleanup(null); });
  });
}

/* ========================================================================
   WISHLIST
   ======================================================================== */
async function loadMyWishlist() {
  try {
    const res = await fetch(`${API}/user/wishlist/ids`);
    const data = await res.json();
    MY_WISHLIST = Array.isArray(data) ? data : [];
  } catch (e) { MY_WISHLIST = []; }
  updateWishlistBadge(MY_WISHLIST.length);
}
function updateWishlistBadge(count) {
  const el = document.getElementById("wishCount");
  if (!el) return;
  if (count > 0) { el.textContent = count; el.style.display = "inline-block"; }
  else { el.style.display = "none"; }
}
async function toggleWishlist(productId, btnEl) {
  await ensureUserLoaded();
  if (!CURRENT_USER) {
    showToast("Please login to use wishlist", true);
    setTimeout(() => window.location.href = "login.html", 1200);
    return;
  }
  const inWish = MY_WISHLIST.includes(productId);
  const endpoint = inWish ? "remove" : "add";
  try {
    const res = await postJson(`${API}/user/wishlist/${endpoint}`, { productId });
    if (res.error) { showToast(res.error, true); return; }
    if (inWish) {
      MY_WISHLIST = MY_WISHLIST.filter(id => id !== productId);
      showToast("Removed from wishlist");
    } else {
      MY_WISHLIST.push(productId);
      showToast("Added to wishlist ♥");
    }
    if (btnEl) {
      btnEl.classList.toggle("active", !inWish);
      btnEl.textContent = inWish ? "♡" : "♥";
    }
    updateWishlistBadge(MY_WISHLIST.length);
    if (PAGE === "wishlist") await renderWishlist();
  } catch (e) { showToast("Wishlist update failed", true); }
}
async function renderWishlist() {
  const grid = document.getElementById("wishlistGrid");
  const empty = document.getElementById("wishlistEmpty");
  const count = document.getElementById("wishlistCount");
  if (!grid) return;
  if (!await requireLogin()) return;
  renderSkeletonCards(grid, 4);
  try {
    const res = await fetch(`${API}/user/wishlist`);
    const items = await res.json();
    if (!Array.isArray(items) || items.length === 0) {
      grid.innerHTML = "";
      if (empty) empty.style.display = "block";
      if (count) count.textContent = "0 items";
      return;
    }
    if (empty) empty.style.display = "none";
    if (count) count.textContent = `${items.length} item${items.length !== 1 ? "s" : ""}`;
    grid.innerHTML = "";
    items.forEach(p => {
      const outStock = p.stock <= 0;
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="card-img-wrap" onclick="location.href='product.html?id=${p.productId}'" style="cursor:pointer;">
          <img src="images/${p.productId}.jpg" alt="${escapeHtml(p.name)}" class="card-img"
               onerror="this.onerror=null;this.src='${productPlaceholder(p)}'">
          <button class="heart-btn active"
                  onclick="event.stopPropagation(); toggleWishlist('${p.productId}', this)">♥</button>
        </div>
        <div class="card-body">
          <h3 class="card-title" onclick="location.href='product.html?id=${p.productId}'" style="cursor:pointer;">
            ${escapeHtml(p.name)}
          </h3>
          <div class="card-rating" id="rating-${p.productId}">
            ${renderStars(0, 14)}
            <span class="card-rating-count">Loading…</span>
          </div>
          <div class="card-price">${money(p.price)}</div>
          <button class="card-btn solid" ${outStock ? "disabled" : ""}
                  onclick="addToCart('${p.productId}')">
            ${outStock ? "Out of Stock" : "Add to Cart"}
          </button>
        </div>`;
      grid.appendChild(card);
      hydrateRatingEl(card.querySelector(`#rating-${p.productId}`), p.productId, 14);
    });
  } catch (e) { if (empty) empty.style.display = "block"; }
}

/* ========================================================================
   LIVE SEARCH SUGGESTIONS
   ======================================================================== */
function initSearchSuggestions() {
  const input = document.getElementById("searchInput");
  if (!input) return;
  let wrap = input.closest(".search-input-wrap");
  if (!wrap) return;
  let drop = document.getElementById("searchSuggest");
  if (!drop) {
    drop = document.createElement("div");
    drop.id = "searchSuggest";
    drop.className = "search-suggest";
    wrap.appendChild(drop);
  }
  let debounceId = null;
  input.addEventListener("input", () => {
    clearTimeout(debounceId);
    const q = input.value.trim().toLowerCase();
    if (!q) { drop.classList.remove("show"); drop.innerHTML = ""; return; }
    debounceId = setTimeout(() => {
      const matches = ALL_PRODUCTS
        .filter(p =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.productId.toLowerCase().includes(q))
        .slice(0, 6);
      if (matches.length === 0) {
        drop.innerHTML = `<div class="suggest-empty">No products match "${escapeHtml(input.value)}"</div>`;
        drop.classList.add("show");
        return;
      }
      drop.innerHTML = matches.map(p => `
        <div class="suggest-item" onmousedown="event.preventDefault(); location.href='product.html?id=${p.productId}'">
          <img src="images/${p.productId}.jpg" alt="" onerror="this.onerror=null;this.src='${productPlaceholder(p)}'">
          <div class="suggest-info">
            <div class="suggest-name">${escapeHtml(p.name)}</div>
            <div class="suggest-cat">${p.category}</div>
          </div>
          <div class="suggest-price">${money(p.price)}</div>
        </div>`).join("");
      drop.classList.add("show");
    }, 180);
  });
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") { drop.classList.remove("show"); applyFilters(); }
    if (e.key === "Escape") drop.classList.remove("show");
  });
  document.addEventListener("click", e => {
    if (!wrap.contains(e.target)) drop.classList.remove("show");
  });
}

/* ========================================================================
   LOGIN / SIGNUP
   ======================================================================== */
async function doLogin(e) {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const btn = document.getElementById("loginBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Signing in…"; }
  try {
    const data = await postJson(`${API}/user/login`, { email, password });
    if (data.error) {
      showToast(data.error, true);
      if (btn) { btn.disabled = false; btn.textContent = "Sign In"; }
      return false;
    }
    if (data.isAdmin === true) {
      showToast("Welcome, admin! Redirecting…");
      setTimeout(() => window.location.href = "admin.html", 700);
    } else {
      showToast("Login successful! Redirecting…");
      setTimeout(() => window.location.href = "index.html", 700);
    }
  } catch (err) {
    showToast("Login failed. Try again.", true);
    if (btn) { btn.disabled = false; btn.textContent = "Sign In"; }
  }
  return false;
}

async function doSignup(e) {
  e.preventDefault();
  await ensureUserLoaded();
  if (CURRENT_USER) {
    showToast("You are already logged in");
    setTimeout(() => window.location.href = "index.html", 900);
    return false;
  }
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const mismatchEl = document.getElementById("passwordMismatch");
  const btn = document.getElementById("signupBtn");
  if (mismatchEl) mismatchEl.style.display = "none";
  if (!name) { showToast("Please enter your full name", true); return false; }
  if (!email || !email.includes("@")) { showToast("Please enter a valid email", true); return false; }

  // Strong password validation
  if (password.length < 6) { showToast("Password must be at least 6 characters", true); return false; }
  if (!/[A-Z]/.test(password)) { showToast("Password must contain at least one uppercase letter", true); return false; }
  if (!/[a-z]/.test(password)) { showToast("Password must contain at least one lowercase letter", true); return false; }
  if (!/[0-9]/.test(password)) { showToast("Password must contain at least one number", true); return false; }
  if (!/[!@#$%^&*(),.?":{}|<>_\-]/.test(password)) { showToast("Password must contain at least one special character (!@#$%^&*)", true); return false; }

  if (password !== confirmPassword) {
    if (mismatchEl) mismatchEl.style.display = "block";
    showToast("Passwords do not match", true);
    document.getElementById("confirmPassword").focus();
    return false;
  }
  if (btn) { btn.disabled = true; btn.textContent = "Creating account…"; }
  const customerType = "REGULAR";
  try {
    const data = await postJson(`${API}/user/signup`, { name, email, password, customerType });
    if (data.error) {
      showToast(data.error, true);
      if (btn) { btn.disabled = false; btn.textContent = "Create Account"; }
      return false;
    }
    try { sessionStorage.setItem("prefillEmail", email); } catch (_) {}
    showToast("Account created — please log in to continue");
    setTimeout(() => window.location.href = "login.html", 1200);
  } catch (err) {
    showToast("Signup failed. Please try again.", true);
    if (btn) { btn.disabled = false; btn.textContent = "Create Account"; }
  }
  return false;
}

function prefillLoginEmail() {
  const emailInput = document.getElementById("email");
  if (!emailInput) return;
  try {
    const saved = sessionStorage.getItem("prefillEmail");
    if (saved && !emailInput.value) {
      emailInput.value = saved;
      sessionStorage.removeItem("prefillEmail");
      document.getElementById("password")?.focus();
    }
  } catch (_) {}
}

/* ========================================================================
   ADMIN PANEL
   ======================================================================== */
async function adminLogout() {
  if (!confirm("Logout from admin panel?")) return;
  await postJson(`${API}/user/logout`, {});
  CURRENT_USER = null;
  USER_LOAD_PROMISE = null;
  window.location.href = "login.html";
}

async function loadAdminDashboard() {
  const me = await fetch(`${API}/user/me`).then(r => r.json());
  if (!me.loggedIn || !me.isAdmin) { window.location.href = "login.html"; return; }
  const adminInfo = document.getElementById("adminInfo");
  if (adminInfo) adminInfo.textContent = `Admin: ${me.user.name}`;
  const stats = await fetch(`${API}/admin/stats`).then(r => r.json());
  const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setTxt("statProducts", stats.totalProducts ?? 0);
  setTxt("statOrders",   stats.totalOrders ?? 0);
  setTxt("statUsers",    stats.totalUsers ?? 0);
  setTxt("statRevenue",  money(stats.totalRevenue ?? 0));
  await loadAdminProducts();
  await loadAdminOrders();
  await loadAdminUsers();
}

async function loadAdminProducts() {
  const products = await fetch(`${API}/admin/products`).then(r => r.json());
  ADMIN_CACHE.products = products;
  ADMIN_FILTERED_PRODUCTS = products;
  renderAdminProducts(products);
}

function renderAdminProducts(products) {
  const tbody = document.getElementById("adminProductBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const noResults = document.getElementById("adminNoProducts");
  if (noResults) noResults.style.display = products.length === 0 ? "block" : "none";
  products.forEach(p => {
    const isActive = p.active !== false;
    const tr = document.createElement("tr");
    if (!isActive) tr.style.opacity = "0.55";
    tr.innerHTML = `
      <td><code>${p.productId}</code></td>
      <td>
        ${escapeHtml(p.name)}
        ${!isActive ? '<span style="background:#fef2f2;color:#dc2626;font-size:10px;font-weight:800;padding:2px 8px;border-radius:10px;margin-left:8px;">INACTIVE</span>' : ''}
      </td>
      <td><span class="cat-pill cat-${p.category.toLowerCase()}">${p.category}</span></td>
      <td>${money(p.price)}</td>
      <td>${p.stock}</td>
      <td>
        <button class="tbl-btn edit" onclick="editProduct('${p.productId}')">Edit</button>
        ${isActive
          ? `<button class="tbl-btn del" onclick="deleteProduct('${p.productId}')">Delete</button>`
          : `<button class="tbl-btn" style="color:#16a34a;border-color:#16a34a;" onclick="restoreProduct('${p.productId}')">Restore</button>`
        }
      </td>`;
    tbody.appendChild(tr);
  });
}

function filterAdminProducts() {
  const q = (document.getElementById("adminProductSearch")?.value || "").trim().toLowerCase();
  ADMIN_FILTERED_PRODUCTS = !q
    ? ADMIN_CACHE.products
    : ADMIN_CACHE.products.filter(p =>
        p.productId.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q));
  renderAdminProducts(ADMIN_FILTERED_PRODUCTS);
}

async function loadAdminOrders() {
  const orders = await fetch(`${API}/admin/orders`).then(r => r.json());
  ADMIN_CACHE.orders = orders;
  ADMIN_FILTERED_ORDERS = orders;
  renderAdminOrders(orders);
}

function renderAdminOrders(orders) {
  const list = document.getElementById("adminOrdersList");
  const count = document.getElementById("orderCount");
  const noResults = document.getElementById("adminNoOrders");
  if (!list) return;
  if (count) count.textContent = `${orders.length} total`;
  if (noResults) noResults.style.display = orders.length === 0 ? "block" : "none";
  if (orders.length === 0) { list.innerHTML = ""; return; }
  list.innerHTML = orders.map(o => `
    <div class="order-card">
      <div class="order-head">
        <div>
          <div class="order-customer clickable" onclick="showUserDetails(${o.orderId})">
              <span class="order-avatar">${initials(o.userName || "?")}</span>
              <div>
                  <div class="order-id">${escapeHtml(o.userName || "Guest")} <span style="font-size:11px;color:#888;font-weight:500;">▸ view details</span></div>
                  <div class="order-meta">${escapeHtml(o.userEmail || "no email")} · Order #${o.orderId}</div>
              </div>
          </div>
          <div class="order-submeta">
            ${o.createdAt} · ${o.customerType}${o.couponCode ? ' · Coupon: ' + o.couponCode : ''}
            ${o.status === 'CANCELLED' ? ` · <b style="color:#dc2626;">CANCELLED</b>${o.cancelReason ? ' — ' + escapeHtml(o.cancelReason) : ''}` : ''}
          </div>
        </div>
        <div class="order-total">${money(o.finalAmount)}</div>
      </div>
      <div class="order-items">
        ${o.items.map(it => `
          <div class="order-item-row">
            <span class="order-item-product">
              <code>${it.productId}</code>
              <b>${escapeHtml(it.productName || it.productId)}</b>
            </span>
            <span>× ${it.quantity}</span>
            <span>${money(it.unitPrice)}</span>
            <span>${money(it.lineTotal)}</span>
          </div>`).join("")}
      </div>
      <div class="order-summary">
        <span>Subtotal: ${money(o.subtotal)}</span>
        <span>Discount: −${money(o.totalDiscount)}</span>
        <span>GST: ${money(o.gst)}</span>
        <span><b>Total: ${money(o.finalAmount)}</b></span>
      </div>
    </div>
  `).join("");
}

function filterAdminOrders() {
  const q = (document.getElementById("adminOrderSearch")?.value || "").trim().toLowerCase();
  ADMIN_FILTERED_ORDERS = !q
    ? ADMIN_CACHE.orders
    : ADMIN_CACHE.orders.filter(o =>
        String(o.orderId).includes(q) ||
        (o.userName || "").toLowerCase().includes(q) ||
        (o.userEmail || "").toLowerCase().includes(q) ||
        (o.customerType || "").toLowerCase().includes(q) ||
        (o.couponCode || "").toLowerCase().includes(q));
  renderAdminOrders(ADMIN_FILTERED_ORDERS);
}

/* ========================================================================
   ADMIN — USER DETAILS MODAL  (TOP LEVEL)
   ======================================================================== */
function showUserDetails(orderId) {
  const order = (ADMIN_CACHE.orders || []).find(o => o.orderId === orderId);
  if (!order) { showToast("Order not found", true); return; }

  const modal = document.getElementById("userDetailsModal");
  const body  = document.getElementById("userDetailsBody");
  if (!modal || !body) return;

  const items = order.items || [];
  const addr  = [order.addressLine, order.city, order.state, order.pincode]
                  .filter(Boolean).join(", ") || "—";

  const rows = [
    ["Order ID",      "#" + order.orderId],
    ["Customer Name", order.userName  || "Guest"],
    ["Email",         order.userEmail || "—"],
    ["Phone",         order.phone     || "—"],
    ["Customer Type", order.customerType || "REGULAR"],
    ["Order Status",  order.status || "PLACED"],
    ["Coupon",        order.couponCode || "—"],
    ["Delivery Address", addr],
    ["Order Date",    order.createdAt || "—"]
  ];

  const itemRows = items.map(it => `
    <tr>
      <td><code>${escapeHtml(it.productId)}</code></td>
      <td>${escapeHtml(it.productName || it.productId)}</td>
      <td>× ${it.quantity}</td>
      <td>${money(it.unitPrice)}</td>
      <td><b>${money(it.lineTotal)}</b></td>
    </tr>`).join("");

  body.innerHTML = `
    <div class="user-details-section">
      <div class="user-details-label">Customer Information</div>
      <table class="user-details-table">
        <tbody>
          ${rows.map(([k, v]) => `
            <tr>
              <td class="ud-key">${escapeHtml(k)}</td>
              <td class="ud-val">${escapeHtml(String(v))}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>

    <div class="user-details-section">
      <div class="user-details-label">Items Ordered (${items.length})</div>
      <table class="user-details-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Product</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Line Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>
    </div>

    <div class="user-details-section">
      <div class="user-details-label">Bill Summary</div>
      <table class="user-details-table">
        <tbody>
          <tr><td class="ud-key">Subtotal</td>       <td class="ud-val">${money(order.subtotal)}</td></tr>
          <tr><td class="ud-key">Total Discount</td> <td class="ud-val" style="color:#16a34a;">−${money(order.totalDiscount)}</td></tr>
          <tr><td class="ud-key">GST</td>            <td class="ud-val">${money(order.gst)}</td></tr>
          <tr class="ud-total-row"><td class="ud-key">Grand Total</td> <td class="ud-val"><b>${money(order.finalAmount)}</b></td></tr>
        </tbody>
      </table>
    </div>
  `;

  modal.classList.add("show");
}

function closeUserDetails() {
  const modal = document.getElementById("userDetailsModal");
  if (modal) modal.classList.remove("show");
}

document.addEventListener("click", (e) => {
  const modal = document.getElementById("userDetailsModal");
  if (modal && e.target === modal) modal.classList.remove("show");
});

/* ========================================================================
   ADMIN — USERS TAB  (TOP LEVEL)
   ======================================================================== */
async function loadAdminUsers() {
  try {
    const res = await fetch(`${API}/admin/users`);
    if (!res.ok) {
      console.error("loadAdminUsers: HTTP", res.status);
      return;
    }
    const users = await res.json();
    ADMIN_CACHE.users = Array.isArray(users) ? users : [];
    ADMIN_FILTERED_USERS = ADMIN_CACHE.users;
    renderAdminUsers(ADMIN_CACHE.users);
  } catch (e) {
    console.error("Failed to load users:", e);
  }
}

function renderAdminUsers(users) {
  const tbody = document.getElementById("adminUserBody");
  const count = document.getElementById("userCount");
  const noRes = document.getElementById("adminNoUsers");
  if (!tbody) return;

  if (count) count.textContent = `${users.length} total`;
  if (noRes) noRes.style.display = users.length === 0 ? "block" : "none";

  tbody.innerHTML = "";

  users.forEach(u => {
    const tr = document.createElement("tr");
    const isAdmin = u.isAdmin === true;

    tr.innerHTML = `
      <td><code>#${u.id}</code></td>
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="order-avatar" style="width:34px;height:34px;font-size:12px;">${initials(u.name)}</span>
          <b>${escapeHtml(u.name)}</b>
        </div>
      </td>
      <td>${escapeHtml(u.email)}</td>
      <td><span class="order-badge-side ${(u.customerType || 'regular').toLowerCase()}">${escapeHtml(u.customerType || "REGULAR")}</span></td>
      <td>${isAdmin ? '<span style="background:#fef3c7;color:#92400e;font-weight:800;font-size:11px;padding:3px 8px;border-radius:8px;">ADMIN</span>' : '<span style="color:#888;font-size:12px;">User</span>'}</td>
      <td style="font-size:12px;color:#666;">${escapeHtml(u.createdAt || "—")}</td>
    `;
    tbody.appendChild(tr);
  });
}

function filterAdminUsers() {
  const q = (document.getElementById("adminUserSearch")?.value || "").trim().toLowerCase();
  const all = ADMIN_CACHE.users || [];
  ADMIN_FILTERED_USERS = !q ? all : all.filter(u =>
    String(u.id).includes(q) ||
    (u.name || "").toLowerCase().includes(q) ||
    (u.email || "").toLowerCase().includes(q) ||
    (u.customerType || "").toLowerCase().includes(q)
  );
  renderAdminUsers(ADMIN_FILTERED_USERS);
}

function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.tab === tab));
  const tp = document.getElementById("tab-products");
  const to = document.getElementById("tab-orders");
  const tu = document.getElementById("tab-users");
  if (tp) tp.style.display = tab === "products" ? "" : "none";
  if (to) to.style.display = tab === "orders"   ? "" : "none";
  if (tu) tu.style.display = tab === "users"    ? "" : "none";
}

function openProductModal() {
  document.getElementById("productModalTitle").textContent = "Add Product";
  document.getElementById("pm-mode").value = "create";
  document.getElementById("pm-id").value = "";
  document.getElementById("pm-name").value = "";
  document.getElementById("pm-category").value = "Electronics";
  document.getElementById("pm-price").value = "";
  document.getElementById("pm-stock").value = "";
  document.getElementById("pm-id").disabled = false;
  fetch(`${API}/admin/next-id`).then(r => r.json()).then(d => {
    if (d.productId) document.getElementById("pm-id").value = d.productId;
  });
  document.getElementById("productModal").classList.add("show");
}

function editProduct(pid) {
  const p = ADMIN_CACHE.products.find(x => x.productId === pid);
  if (!p) return;
  document.getElementById("productModalTitle").textContent = "Edit Product";
  document.getElementById("pm-mode").value = "update";
  document.getElementById("pm-id").value = p.productId;
  document.getElementById("pm-id").disabled = true;
  document.getElementById("pm-name").value = p.name;
  document.getElementById("pm-category").value = p.category;
  document.getElementById("pm-price").value = p.price;
  document.getElementById("pm-stock").value = p.stock;
  document.getElementById("productModal").classList.add("show");
}
function closeProductModal() {
  document.getElementById("productModal").classList.remove("show");
}

async function saveProduct(e) {
  e.preventDefault();
  const mode = document.getElementById("pm-mode").value;
  const productId = document.getElementById("pm-id").value.trim();
  const name      = document.getElementById("pm-name").value.trim();
  const category  = document.getElementById("pm-category").value;
  const price     = document.getElementById("pm-price").value;
  const stock     = document.getElementById("pm-stock").value;
  const url = mode === "create" ? `${API}/admin/product/create` : `${API}/admin/product/update`;
  const data = await postJson(url, { productId, name, category, price, stock });
  if (data.error) { showToast(data.error, true); return false; }
  showToast(mode === "create" ? "Product created" : "Product updated");
  closeProductModal();
  await loadAdminProducts();
  const stats = await fetch(`${API}/admin/stats`).then(r => r.json());
  const el = document.getElementById("statProducts");
  if (el) el.textContent = stats.totalProducts ?? 0;
  return false;
}

async function deleteProduct(pid) {
  if (!confirm(`Delete product ${pid}?`)) return;
  const res = await fetch(`${API}/admin/product?productId=${pid}`, { method: "DELETE" });
  const data = await res.json();
  if (data.error) return showToast(data.error, true);
  showToast("Product deleted");
  await loadAdminProducts();
}

async function restoreProduct(pid) {
  const data = await postJson(`${API}/admin/product/restore`, { productId: pid });
  if (data.error) return showToast(data.error, true);
  showToast("Product restored ✓");
  await loadAdminProducts();
}

/* ========================================================================
   BOOTSTRAP — must be the LAST block in the file
   ======================================================================== */
(async function init() {
  if (PAGE === "admin") { await loadAdminDashboard(); return; }
  if (PAGE === "login") { prefillLoginEmail(); return; }

  if (PAGE === "signup") {
    const pw = document.getElementById("password");
    const cpw = document.getElementById("confirmPassword");
    const mismatchEl = document.getElementById("passwordMismatch");
    const reqsBox = document.getElementById("passwordReqs");

    // Live validation for each requirement
    const validatePassword = () => {
      const val = pw.value;
      const checks = {
        length:  val.length >= 6,
        upper:   /[A-Z]/.test(val),
        lower:   /[a-z]/.test(val),
        number:  /[0-9]/.test(val),
        special: /[!@#$%^&*(),.?":{}|<>_\-]/.test(val)
      };
      if (reqsBox) {
        Object.keys(checks).forEach(key => {
          const el = reqsBox.querySelector(`[data-req="${key}"]`);
          if (el) el.classList.toggle("valid", checks[key]);
        });
      }
      return Object.values(checks).every(Boolean);
    };

    // Confirm password match check
    const checkMatch = () => {
      if (!cpw.value) {
        if (mismatchEl) mismatchEl.style.display = "none";
        cpw.style.borderColor = "";
        return;
      }
      const ok = pw.value === cpw.value;
      if (mismatchEl) mismatchEl.style.display = ok ? "none" : "block";
      cpw.style.borderColor = ok ? "" : "#dc2626";
    };

    pw?.addEventListener("input", () => { validatePassword(); checkMatch(); });
    cpw?.addEventListener("input", checkMatch);
    validatePassword();
    return;
  }

  await loadUserHeader();
  await loadCartCount();
  await loadMyWishlist();
  initScrollReveal();

  document.querySelectorAll(".rating-chip").forEach(chip => {
    chip.classList.toggle("active", chip.dataset.min === "0");
  });

  if (PAGE === "products") {
    await loadProducts();
    initSearchSuggestions();
  }
  else if (PAGE === "cart") { await refreshCart(); initCouponInputRestriction(); }
  else if (PAGE === "checkout") await loadCheckout();
  else if (PAGE === "profile") await loadProfile();
  else if (PAGE === "wishlist") await renderWishlist();
})();