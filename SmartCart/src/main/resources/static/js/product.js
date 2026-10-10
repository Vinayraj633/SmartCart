/* ========================================================================
   SmartCart — Product Detail Page
   ======================================================================== */

(async function initProductPage() {
  if (typeof PAGE === "undefined" || PAGE !== "product") return;

  const params = new URLSearchParams(window.location.search);
  const productId = params.get("id");

  if (!productId) {
    document.getElementById("productPage").innerHTML =
      `<div class="product-error"><h2>Product not found</h2>
       <a href="index.html" class="btn-primary">Back to shop</a></div>`;
    return;
  }

  try {
    const [product, rating, reviews, wishIds] = await Promise.all([
      fetch(`${API}/products/${productId}`).then(r => r.json()),
      fetch(`${API}/products/${productId}/rating`).then(r => r.json()),
      fetch(`${API}/products/${productId}/reviews`).then(r => r.json()),
      fetch(`${API}/user/wishlist/ids`).then(r => r.json()).catch(() => [])
    ]);

    if (product.error) {
      document.getElementById("productPage").innerHTML =
        `<div class="product-error"><h2>Product not found</h2>
         <a href="index.html" class="btn-primary">Back to shop</a></div>`;
      return;
    }

    const inWishlist = Array.isArray(wishIds) && wishIds.includes(product.productId);
    renderProductDetail(product, rating, reviews, inWishlist);
    renderReviewsSection(reviews);
    updateWishlistBadge(Array.isArray(wishIds) ? wishIds.length : 0);

  } catch (e) {
    console.error(e);
    document.getElementById("productPage").innerHTML =
      `<div class="product-error"><h2>Could not load product</h2>
       <a href="index.html" class="btn-primary">Back to shop</a></div>`;
  }
})();

function renderProductDetail(p, rating, reviews, inWishlist) {
  const outStock = p.stock <= 0;
  const lowStock = p.stock > 0 && p.stock <= 5;

  const stockLabel = outStock ? "Out of stock"
                   : lowStock ? `Only ${p.stock} left`
                   : "In stock";

  const stockClass = outStock ? "qty-out"
                   : lowStock ? "qty-low"
                   : "qty-ok";

  document.getElementById("productPage").innerHTML = `
    <div class="product-grid">

      <div class="product-gallery">
        <div class="product-image-main">
          <img src="images/${p.productId}.jpg" alt="${escapeHtml(p.name)}"
               id="mainProductImage"
               onerror="this.onerror=null;this.src='${productPlaceholder(p)}'">
        </div>
      </div>

      <div class="product-info">

        <h1 class="product-title">${escapeHtml(p.name)}</h1>

        <div class="product-rating-row" id="productRatingRow">
          ${renderStars(rating.average, 18)}
          <span class="product-rating-text">
            ${rating.count > 0
              ? `${rating.average.toFixed(1)} · ${rating.count} review${rating.count !== 1 ? "s" : ""}`
              : "No reviews yet"}
          </span>
        </div>

        <div class="product-price">${money(p.price)}</div>

        <div class="product-stock">
          <span class="qty-badge ${stockClass}">${stockLabel}</span>
        </div>

        <div class="product-desc">
          Premium quality ${escapeHtml(p.category)} product from SmartCart.
          Backed by our satisfaction guarantee and fast shipping.
        </div>

        <div class="product-actions">
          <button class="card-btn solid product-add-btn"
                  ${outStock ? "disabled" : ""}
                  onclick="addToCart('${p.productId}')">
            ${outStock ? "Out of Stock" : "Add to Cart"}
          </button>

          <button class="wishlist-btn ${inWishlist ? 'active' : ''}"
                  id="wishToggle"
                  onclick="toggleWishlist('${p.productId}', this)"
                  title="${inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}">
            ${inWishlist ? "♥" : "♡"}
          </button>
        </div>

        <div class="product-trust">
          <div class="trust-item"><span>🚚</span> Free shipping over ₹500</div>
          <div class="trust-item"><span>↩️</span> 7-day returns</div>
          <div class="trust-item"><span>🔒</span> Secure checkout</div>
        </div>

      </div>
    </div>

    <section class="product-reviews-wrap" id="reviewsSection">
      <h2 class="section-heading">
        Customer reviews
        ${rating.count > 0 ? `<span class="section-sub">(${rating.count})</span>` : ""}
      </h2>
      <div id="reviewsList"></div>
    </section>
  `;
}

function renderReviewsSection(reviews) {
  const el = document.getElementById("reviewsList");
  if (!el) return;

  if (!Array.isArray(reviews) || reviews.length === 0) {
    el.innerHTML = `
      <div class="reviews-empty-large">
        <div style="font-size:48px">💬</div>
        <h3>No reviews yet</h3>
        <p>Be the first to share your experience.</p>
      </div>`;
    return;
  }

  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  const rounded = Math.round(avg * 10) / 10;

  // Star distribution
  const dist = [0, 0, 0, 0, 0];
  reviews.forEach(r => dist[r.rating - 1]++);
  const total = reviews.length;

  el.innerHTML = `
    <div class="reviews-layout">

      <aside class="reviews-summary-side">
        <div class="reviews-avg-num">${rounded.toFixed(1)}</div>
        <div class="reviews-avg-stars">${renderStars(rounded, 20)}</div>
        <div class="reviews-avg-count">${total} review${total !== 1 ? "s" : ""}</div>

        <div class="star-dist">
          ${[5,4,3,2,1].map(star => {
            const c = dist[star - 1];
            const pct = total > 0 ? (c / total) * 100 : 0;
            return `
              <div class="star-dist-row">
                <span class="star-dist-label">${star}★</span>
                <div class="star-dist-bar"><div style="width:${pct}%"></div></div>
                <span class="star-dist-count">${c}</span>
              </div>`;
          }).join("")}
        </div>
      </aside>

      <div class="reviews-list-side">
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
          </div>
        `).join("")}
      </div>

    </div>`;
}

function updateWishlistBadge(count) {
  const el = document.getElementById("wishCount");
  if (!el) return;
  if (count > 0) {
    el.textContent = count;
    el.style.display = "inline-block";
  } else {
    el.style.display = "none";
  }
}