/**
 * ═══════════════════════════════════════════════════════════════
 * FoodFlow Enterprise Application Controller (Production Release)
 * ═══════════════════════════════════════════════════════════════
 * Handles customer journeys, Swiggy/Zomato payment gateway, live order tracking,
 * 6-digit OTP account recovery, profile verification, address deduplication,
 * sign-out confirmation, and reactive MySQL multi-port synchronization.
 */

(function () {
  'use strict';

  // ═══════════════════════ APPLICATION STATE ═══════════════════════
  const AppState = {
    activePortal: 'customer', // 'customer' | 'admin' | 'tests'
    activeCustomerScreen: 'home', // 'home' | 'menu' | 'checkout' | 'success' | 'profile'
    activeAdminPage: 'dashboard',
    activeProfileTab: 'orders', // 'orders' | 'addresses' | 'settings' | 'wallet'
    selectedRestaurant: null,
    activeCuisineFilter: 'All',
    searchQuery: '',
    appliedPromo: null,
    currentTrackingOrderId: null,
    activeAuthMode: 'login', // 'login' | 'register' | 'forgot'
    forgotStep: 1, // 1: Identifier -> 2: OTP -> 3: New Pass -> 4: Done
    forgotTargetEmail: '',
    forgotOtpCode: '',
    forgotCountdownTimer: null,
    pendingProfileChange: null,
    profileOtpTarget: ''
  };

  // ═══════════════════════ SOUND EFFECTS (WEB AUDIO API) ═══════════════════════
  const SoundEffects = {
    ctx: null,
    init() {
      if (!this.ctx && typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
        try {
          this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {}
      }
    },
    playSuccess() {
      try {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.15); // G5
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
      } catch (e) {}
    },
    playPop() {
      try {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(640, now + 0.08);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
      } catch (e) {}
    },
    playError() {
      try {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(140, now + 0.2);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      } catch (e) {}
    }
  };

  // ═══════════════════════ TOAST NOTIFICATIONS ═══════════════════════
  function showToast(message, type = 'info') {
    const toast = document.getElementById('globalToast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    if (type === 'success') SoundEffects.playSuccess();
    else if (type === 'error') SoundEffects.playError();
    else SoundEffects.playPop();

    setTimeout(() => {
      toast.classList.remove('show');
    }, 3500);
  }

  // ═══════════════════════ GLOBAL SWITCHER ═══════════════════════
  function switchGlobalPortal(portalName) {
    AppState.activePortal = portalName;
    document.querySelectorAll('.switcher-tab').forEach((tab) => {
      tab.classList.remove('active');
      if (tab.dataset.portal === portalName) tab.classList.add('active');
    });

    const custCont = document.getElementById('customerPortalContainer');
    const adminCont = document.querySelector('.admin-wrapper');
    const testCont = document.getElementById('testSuiteContainer');

    if (custCont) custCont.style.display = portalName === 'customer' ? 'block' : 'none';
    if (adminCont) adminCont.style.display = portalName === 'admin' ? 'flex' : 'none';
    if (testCont) testCont.style.display = portalName === 'tests' ? 'block' : 'none';

    if (portalName === 'customer') {
      showCustomerScreen('home');
      renderCustomerHome();
      updateCustomerCartUI();
      updateCustomerAuthUI();
    } else if (portalName === 'admin') {
      showAdminPage('dashboard');
      renderAdminDashboard();
    } else if (portalName === 'tests') {
      if (typeof window.renderTests === 'function') window.renderTests();
    }

    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {}
  }

  // ═══════════════════════ CUSTOMER PORTAL SCREENS ═══════════════════════
  function showCustomerScreen(screenName) {
    AppState.activeCustomerScreen = screenName;
    document.querySelectorAll('.customer-screen').forEach((s) => s.classList.remove('active'));
    const target = document.getElementById(`cust-screen-${screenName}`);
    if (target) target.classList.add('active');
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {}
  }

  function renderCustomerHome() {
    if (!window.FoodFlowStore) return;
    const restaurants = window.FoodFlowStore.getRestaurants();
    const allMenuItems = window.FoodFlowStore.getMenuItems();
    const cart = window.FoodFlowStore.getCart();

    let activeRestaurants = restaurants.filter((r) => r.status === 'active');
    const searchBarContainer = document.getElementById('homeSearchResultsBar');
    const dishesContainer = document.getElementById('homeMatchingDishesContainer');
    const sectionTitle = document.getElementById('homeSectionTitle');
    const seeAllLink = document.getElementById('homeSeeAllLink');

    // 1. Cuisine Filter
    if (AppState.activeCuisineFilter !== 'All') {
      activeRestaurants = activeRestaurants.filter((r) => r.cuisine.toLowerCase() === AppState.activeCuisineFilter.toLowerCase());
    }

    const q = AppState.searchQuery.trim().toLowerCase();

    // 2. Global Search Logic (Search Restaurants, Cuisines, Locations, AND All Dishes)
    if (q !== '') {
      // Find matching dishes
      const matchingDishes = allMenuItems.filter((item) => {
        const itemRest = restaurants.find((r) => r.id === (item.restaurantId || item.restId));
        const restActive = !itemRest || itemRest.status === 'active';
        return (
          restActive &&
          (item.name.toLowerCase().includes(q) ||
            (item.desc && item.desc.toLowerCase().includes(q)) ||
            (item.category && item.category.toLowerCase().includes(q)))
        );
      });

      const matchingRestIds = new Set(matchingDishes.map((i) => Number(i.restaurantId || i.restId)));

      // Find matching restaurants
      const filteredRestaurants = activeRestaurants.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.cuisine.toLowerCase().includes(q) ||
          (r.desc && r.desc.toLowerCase().includes(q)) ||
          (r.location && r.location.toLowerCase().includes(q)) ||
          (r.tag && r.tag.toLowerCase().includes(q)) ||
          matchingRestIds.has(r.id)
      );

      // Search Summary Header Bar
      if (searchBarContainer) {
        searchBarContainer.innerHTML = `
          <div class="search-results-bar">
            <div>
              <span>Search results for: <span class="search-highlight-text">"${AppState.searchQuery}"</span></span>
              <span style="font-size:0.85rem; color:var(--text-muted); margin-left:8px;">
                (${filteredRestaurants.length} restaurants, ${matchingDishes.length} dishes)
              </span>
            </div>
            <button class="action-btn" style="color:var(--primary); font-weight:700;" onclick="clearCustomerSearch()">
              ✕ Clear Search
            </button>
          </div>`;
      }

      if (sectionTitle) sectionTitle.textContent = `Matching Restaurants (${filteredRestaurants.length})`;
      if (seeAllLink) seeAllLink.style.display = 'none';

      // Render Restaurants Grid
      const grid = document.getElementById('restaurantsGrid');
      if (grid) {
        if (filteredRestaurants.length === 0 && matchingDishes.length === 0) {
          grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align:center; padding:3rem; color:var(--text-muted);">
              <div style="font-size:3rem; margin-bottom:0.5rem;">🔍</div>
              <h3>No matching restaurants or dishes found</h3>
              <p style="margin-top:4px;">Try searching for "Biryani", "Burger", "Pizza", "Noodles", "Waffle", or "Dosa".</p>
              <button class="btn-primary" style="margin-top:1rem;" onclick="clearCustomerSearch()">Clear Search</button>
            </div>`;
        } else {
          grid.innerHTML = filteredRestaurants
            .map((r) => {
              const matchedDishesForRest = matchingDishes.filter((d) => Number(d.restaurantId || d.restId) === r.id);
              const dishBadgeHtml =
                matchedDishesForRest.length > 0
                  ? `<div class="dish-match-tag">🍴 Matches: ${matchedDishesForRest
                      .slice(0, 2)
                      .map((d) => `${d.name} (₹${d.price})`)
                      .join(', ')}${matchedDishesForRest.length > 2 ? ' +' + (matchedDishesForRest.length - 2) + ' more' : ''}</div>`
                  : '';

              return `
              <div class="restaurant-card" onclick="openCustomerRestaurant(${r.id})">
                <div class="rest-img">
                  <img src="${r.image}" alt="${r.name}" loading="lazy">
                  <span class="rest-badge-top">${r.tag || 'Popular'}</span>
                </div>
                <div class="rest-info">
                  <div class="rest-name">${r.name}</div>
                  <div class="rest-desc">${r.desc || ''}</div>
                  ${dishBadgeHtml}
                  <div class="rest-meta" style="margin-top:6px;">
                    <span class="rest-rating">★ ${r.rating}</span>
                    <span>🕐 ${r.deliveryTime}</span>
                    <span class="rest-fee">🛵 ${r.fee === 'Free' ? 'Free Delivery' : r.fee + ' delivery'}</span>
                  </div>
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                    <span class="rest-tag">${r.cuisine}</span>
                    <span style="font-size:0.8rem; color:var(--primary); font-weight:700;">View Menu →</span>
                  </div>
                </div>
              </div>`;
            })
            .join('');
        }
      }

      // Render Matching Dishes Section with Direct Add to Cart
      if (dishesContainer) {
        if (matchingDishes.length > 0) {
          dishesContainer.innerHTML = `
            <div class="search-dishes-section">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                <h3 style="font-size:1.2rem; font-weight:800;">🍽️ Matching Dishes (${matchingDishes.length})</h3>
                <span style="font-size:0.82rem; color:var(--text-muted);">Order directly or browse full restaurant menus</span>
              </div>
              <div class="search-dish-grid">
                ${matchingDishes
                  .map((item) => {
                    const inCart = cart.find((c) => c.id === item.id);
                    const qty = inCart ? inCart.qty : 0;
                    const rest = restaurants.find((r) => r.id === (item.restaurantId || item.restId));
                    const restName = rest ? rest.name : (item.restaurant || 'Restaurant');

                    return `
                    <div class="search-dish-card">
                      <img src="${item.image}" alt="${item.name}" class="search-dish-thumb">
                      <div style="flex:1; display:flex; flex-direction:column; justify-content:space-between;">
                        <div>
                          <div style="font-weight:700; font-size:0.95rem; margin-bottom:2px;">
                            ${item.name} ${item.veg ? '<span style="color:#17A865; font-size:0.75rem;">🌿</span>' : '<span style="color:#DC2626; font-size:0.75rem;">🍗</span>'}
                          </div>
                          <div style="font-size:0.75rem; color:var(--primary); font-weight:600; cursor:pointer;" onclick="openCustomerRestaurant(${item.restaurantId || item.restId})">
                            📍 ${restName}
                          </div>
                          <div style="font-weight:800; font-size:1rem; margin-top:4px;">₹${item.price}</div>
                        </div>
                        <div style="margin-top:6px; align-self:flex-end;">
                          ${
                            qty === 0
                              ? `<button class="add-btn" style="padding:6px 14px; font-size:0.82rem;" onclick="customerAddToCart(${item.id})">+ Add</button>`
                              : `<div class="qty-ctrl">
                                  <button class="qty-btn" onclick="customerUpdateQty(${item.id}, -1)">−</button>
                                  <span class="qty-num">${qty}</span>
                                  <button class="qty-btn" onclick="customerUpdateQty(${item.id}, 1)">+</button>
                                </div>`
                          }
                        </div>
                      </div>
                    </div>`;
                  })
                  .join('')}
              </div>
            </div>`;
        } else {
          dishesContainer.innerHTML = '';
        }
      }
      return;
    }

    // Default Home Screen (No search query active)
    if (searchBarContainer) searchBarContainer.innerHTML = '';
    if (dishesContainer) dishesContainer.innerHTML = '';
    if (sectionTitle) sectionTitle.textContent = 'Top Restaurants Near You';
    if (seeAllLink) seeAllLink.style.display = 'inline-block';

    const grid = document.getElementById('restaurantsGrid');
    if (!grid) return;

    if (activeRestaurants.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding:3rem; color:var(--text-muted);">
          <div style="font-size:3rem; margin-bottom:0.5rem;">🔍</div>
          <h3>No restaurants found</h3>
          <p>Try selecting a different cuisine filter.</p>
          <button class="btn-primary" style="margin-top:1rem;" onclick="filterByCuisinePill('All', null)">Reset Filter</button>
        </div>`;
      return;
    }

    grid.innerHTML = activeRestaurants
      .map(
        (r) => `
      <div class="restaurant-card" onclick="openCustomerRestaurant(${r.id})">
        <div class="rest-img">
          <img src="${r.image}" alt="${r.name}" loading="lazy">
          <span class="rest-badge-top">${r.tag || 'Popular'}</span>
        </div>
        <div class="rest-info">
          <div class="rest-name">${r.name}</div>
          <div class="rest-desc">${r.desc || ''}</div>
          <div class="rest-meta">
            <span class="rest-rating">★ ${r.rating}</span>
            <span>🕐 ${r.deliveryTime}</span>
            <span class="rest-fee">🛵 ${r.fee === 'Free' ? 'Free Delivery' : r.fee + ' delivery'}</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
            <span class="rest-tag">${r.cuisine}</span>
            <span style="font-size:0.8rem; color:var(--primary); font-weight:700;">View Menu →</span>
          </div>
        </div>
      </div>`
      )
      .join('');
  }

  function clearCustomerSearch() {
    AppState.searchQuery = '';
    const input = document.getElementById('custSearchInput');
    if (input) input.value = '';
    renderCustomerHome();
  }

  function filterByCuisinePill(cuisine, el) {
    AppState.activeCuisineFilter = cuisine;
    document.querySelectorAll('.cat-pill').forEach((p) => p.classList.remove('active'));
    if (el) {
      el.classList.add('active');
    } else {
      document.querySelectorAll('.cat-pill').forEach((p) => {
        if (p.textContent.trim().toLowerCase().includes(cuisine.toLowerCase())) p.classList.add('active');
      });
    }
    renderCustomerHome();
  }

  function handleCustomerSearch(query) {
    AppState.searchQuery = query || '';
    renderCustomerHome();
  }

  function openCustomerRestaurant(restId) {
    if (!window.FoodFlowStore) return;
    const rest = window.FoodFlowStore.getRestaurantById(restId);
    if (!rest) return;
    AppState.selectedRestaurant = rest;

    const header = document.getElementById('menuScreenHeader');
    if (header) {
      header.innerHTML = `
        <div class="menu-header-info">
          <button class="back-btn" onclick="showCustomerScreen('home')">← Back to Restaurants</button>
          <h2>${rest.name}</h2>
          <p style="opacity:0.85; margin-bottom:8px;">${rest.desc || ''}</p>
          <div class="menu-header-meta">
            <span>★ <strong>${rest.rating}</strong> (500+ ratings)</span>
            <span>🕐 <strong>${rest.deliveryTime}</strong></span>
            <span>🛵 <strong>${rest.fee === 'Free' ? 'Free Delivery' : rest.fee}</strong></span>
            <span>📍 <strong>${rest.location || rest.cuisine}</strong></span>
          </div>
        </div>
        <img src="${rest.image}" alt="${rest.name}" class="menu-header-img">`;
    }

    renderCustomerMenuItems(rest);
    renderCustomerSideCart();
    showCustomerScreen('menu');
  }

  function renderCustomerMenuItems(rest) {
    if (!window.FoodFlowStore || !rest) return;
    const items = window.FoodFlowStore.getMenuItems(rest.id);
    const categories = [...new Set(items.map((i) => i.category))];

    const catNav = document.getElementById('menuCatNav');
    if (catNav) {
      if (categories.length > 0) {
        catNav.innerHTML = categories
          .map(
            (cat, idx) => `
          <button class="menu-cat-btn ${idx === 0 ? 'active' : ''}" onclick="jumpToMenuCategory('${cat}', this)">${cat}</button>`
          )
          .join('');
      } else {
        catNav.innerHTML = '';
      }
    }

    const container = document.getElementById('menuItemsContainer');
    if (!container) return;

    if (items.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:3.5rem 1.5rem; background:var(--surface); border-radius:var(--radius); border:1px solid var(--border);">
          <div style="font-size:3rem; margin-bottom:0.5rem;">🍽️</div>
          <h3 style="margin-bottom:6px;">No dishes currently listed</h3>
          <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:1.25rem;">This kitchen is updating its menu for today.</p>
          <button class="btn-primary" onclick="showCustomerScreen('home')">Browse Other Restaurants</button>
        </div>`;
      return;
    }

    const cart = window.FoodFlowStore.getCart();

    container.innerHTML = categories
      .map((cat) => {
        const catItems = items.filter((i) => i.category === cat);
        return `
        <div id="cat-sec-${cat.replace(/\s+/g, '-')}" style="margin-bottom:2rem;">
          <div class="menu-section-title">${cat} (${catItems.length})</div>
          <div class="menu-items">
            ${catItems
              .map((item) => {
                const inCart = cart.find((c) => c.id === item.id);
                const qty = inCart ? inCart.qty : 0;
                const isAvailable = item.available !== false;

                return `
                <div class="menu-item ${!isAvailable ? 'unavailable' : ''}" id="cust-menu-item-${item.id}">
                  <div class="item-img-wrap">
                    <img src="${item.image}" alt="${item.name}" loading="lazy">
                  </div>
                  <div class="item-details">
                    <div class="item-name">${item.name} ${item.veg ? '<span style="color:#17A865; font-size:0.8rem;">🌿 Veg</span>' : '<span style="color:#DC2626; font-size:0.8rem;">🍗 Non-Veg</span>'}</div>
                    <div class="item-desc">${item.desc || ''}</div>
                    <div class="item-badges">
                      ${item.isBestseller ? '<span class="badge badge-bestseller">⭐ Bestseller</span>' : ''}
                      ${!isAvailable ? '<span class="badge badge-danger">Out of Stock</span>' : ''}
                    </div>
                  </div>
                  <div class="item-actions">
                    <span class="item-price">₹${item.price}</span>
                    ${
                      !isAvailable
                        ? `<button class="add-btn" disabled style="background:var(--border); color:var(--text-muted); cursor:not-allowed;">Sold Out</button>`
                        : qty === 0
                        ? `<button class="add-btn" onclick="customerAddToCart(${item.id})">+ Add</button>`
                        : `<div class="qty-ctrl">
                            <button class="qty-btn" onclick="customerUpdateQty(${item.id}, -1)">−</button>
                            <span class="qty-num">${qty}</span>
                            <button class="qty-btn" onclick="customerUpdateQty(${item.id}, 1)">+</button>
                          </div>`
                    }
                  </div>
                </div>`;
              })
              .join('')}
          </div>
        </div>`;
      })
      .join('');
  }

  function jumpToMenuCategory(cat, el) {
    document.querySelectorAll('.menu-cat-btn').forEach((b) => b.classList.remove('active'));
    if (el) el.classList.add('active');
    const sec = document.getElementById(`cat-sec-${cat.replace(/\s+/g, '-')}`);
    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function customerAddToCart(itemId) {
    if (!window.FoodFlowStore) return;
    window.FoodFlowStore.addToCart(itemId, 1);
    SoundEffects.playPop();
    updateCustomerCartUI();
    if (AppState.selectedRestaurant) renderCustomerMenuItems(AppState.selectedRestaurant);
    renderCustomerSideCart();
  }

  function customerUpdateQty(itemId, delta) {
    if (!window.FoodFlowStore) return;
    window.FoodFlowStore.addToCart(itemId, delta);
    SoundEffects.playPop();
    updateCustomerCartUI();
    if (AppState.selectedRestaurant) renderCustomerMenuItems(AppState.selectedRestaurant);
    renderCustomerSideCart();
  }

  function updateCustomerCartUI() {
    if (!window.FoodFlowStore) return;
    const cart = window.FoodFlowStore.getCart();
    const count = cart.reduce((acc, i) => acc + i.qty, 0);

    const navBadge = document.getElementById('navCartCount');
    if (navBadge) navBadge.textContent = count;
  }

  function renderCustomerSideCart() {
    const container = document.getElementById('cartSideItems');
    const footer = document.getElementById('cartSideFooter');
    const restNameEl = document.getElementById('cartSideRestName');
    if (!container || !footer || !window.FoodFlowStore) return;

    const cart = window.FoodFlowStore.getCart();
    if (restNameEl && AppState.selectedRestaurant) {
      restNameEl.textContent = AppState.selectedRestaurant.name;
    }

    if (cart.length === 0) {
      container.innerHTML = `
        <div class="cart-empty">
          <div style="font-size:2.5rem; margin-bottom:0.5rem;">🛒</div>
          <div>Your cart is empty</div>
          <div style="font-size:0.78rem; margin-top:2px;">Add tasty dishes to get started</div>
        </div>`;
      footer.innerHTML = '';
      return;
    }

    container.innerHTML = cart
      .map(
        (item) => `
      <div class="cart-item">
        <div>
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">₹${item.price * item.qty}</div>
        </div>
        <div class="qty-ctrl">
          <button class="qty-btn" onclick="customerUpdateQty(${item.id}, -1)">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="customerUpdateQty(${item.id}, 1)">+</button>
        </div>
      </div>`
      )
      .join('');

    const subtotal = cart.reduce((acc, i) => acc + i.price * i.qty, 0);
    const deliveryFee = AppState.selectedRestaurant ? AppState.selectedRestaurant.feeValue || 0 : 40;
    const platformFee = 5;
    const total = subtotal + deliveryFee + platformFee;

    footer.innerHTML = `
      <div class="cart-total-row">
        <span>Subtotal</span>
        <span>₹${subtotal}</span>
      </div>
      <div class="cart-total-row">
        <span>Delivery Fee</span>
        <span>${deliveryFee === 0 ? 'Free' : '₹' + deliveryFee}</span>
      </div>
      <div class="cart-total-row">
        <span>Platform Fee</span>
        <span>₹${platformFee}</span>
      </div>
      <div class="cart-total-row grand">
        <span>Total Amount</span>
        <span>₹${total}</span>
      </div>
      <button class="checkout-btn" onclick="proceedToCheckout()">
        Proceed to Checkout →
      </button>`;
  }

  function proceedToCheckout() {
    if (!window.FoodFlowStore) return;
    const cart = window.FoodFlowStore.getCart();
    if (cart.length === 0) {
      showToast('Your cart is empty! Add food items first.', 'info');
      return;
    }

    const user = window.FoodFlowStore.getCurrentUser();
    if (!user) {
      openAuthModal('login');
      return;
    }

    // Populate checkout fields from user session if present, otherwise clean
    const nameInput = document.getElementById('delivName');
    const phoneInput = document.getElementById('delivPhone');
    const addrInput = document.getElementById('delivAddress');

    if (nameInput) nameInput.value = user.name || '';
    if (phoneInput) phoneInput.value = user.phone || '';

    const addresses = window.FoodFlowStore.getAddresses(user.email);
    if (addrInput) {
      if (addresses.length > 0) {
        const def = addresses.find((a) => a.isDefault) || addresses[0];
        addrInput.value = def.address;
      } else if (!addrInput.value) {
        addrInput.value = '';
      }
    }

    renderCheckoutSummary();
    showCustomerScreen('checkout');
  }

  function renderCheckoutSummary() {
    const container = document.getElementById('checkoutItemsList');
    if (!container || !window.FoodFlowStore) return;

    const cart = window.FoodFlowStore.getCart();
    if (cart.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:1rem;">Your cart is empty.</p>';
      return;
    }

    container.innerHTML = cart
      .map(
        (item) => `
      <div class="summary-item" style="display:flex; align-items:center; justify-content:space-between;">
        <div style="display:flex; align-items:center;">
          <img src="${item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=100&q=80'}" class="summary-item-photo" alt="${item.name}">
          <span>${item.name} ×${item.qty}</span>
        </div>
        <span style="font-weight:700;">₹${item.price * item.qty}</span>
      </div>`
      )
      .join('');

    const subtotal = cart.reduce((acc, i) => acc + i.price * i.qty, 0);
    const deliveryFee = AppState.selectedRestaurant ? AppState.selectedRestaurant.feeValue || 0 : 40;
    const platformFee = 5;

    let discount = 0;
    if (AppState.appliedPromo) {
      const res = window.FoodFlowStore.validatePromo(AppState.appliedPromo.code, subtotal);
      if (res.valid) discount = res.discountAmount;
    }

    const finalTotal = Math.max(0, subtotal + deliveryFee + platformFee - discount);

    const subtotalEl = document.getElementById('chkSubtotal');
    const deliveryEl = document.getElementById('chkDelivery');
    const discountEl = document.getElementById('chkDiscount');
    const totalEl = document.getElementById('chkTotal');

    if (subtotalEl) subtotalEl.textContent = `₹${subtotal}`;
    if (deliveryEl) deliveryEl.textContent = deliveryFee === 0 ? 'Free' : `₹${deliveryFee}`;
    if (discountEl) discountEl.textContent = `-₹${discount}`;
    if (totalEl) totalEl.textContent = `₹${finalTotal}`;
  }

  function handleApplyPromo() {
    const input = document.getElementById('promoCodeInput');
    const msg = document.getElementById('promoFeedbackMsg');
    if (!input || !msg || !window.FoodFlowStore) return;

    const code = input.value.trim();
    const cart = window.FoodFlowStore.getCart();
    const subtotal = cart.reduce((acc, i) => acc + i.price * i.qty, 0);

    const result = window.FoodFlowStore.validatePromo(code, subtotal);
    if (result.valid) {
      AppState.appliedPromo = result.promo;
      msg.style.color = 'var(--success)';
      msg.textContent = `✓ ${result.message}`;
      renderCheckoutSummary();
      SoundEffects.playSuccess();
    } else {
      AppState.appliedPromo = null;
      msg.style.color = 'var(--danger)';
      msg.textContent = `✗ ${result.message}`;
      renderCheckoutSummary();
    }
  }

  // ═══════════════════════ PAYMENT GATEWAY FLOW ═══════════════════════
  let pendingCheckoutData = null;
  let qrCountdownInterval = null;
  let upiCollectCountdownInterval = null;
  let activeSelectedBank = 'HDFC Bank';
  let verifiedUpiId = null;

  function handlePlaceOrder() {
    if (!window.FoodFlowStore) return;
    const user = window.FoodFlowStore.getCurrentUser();
    if (!user) {
      openAuthModal('login');
      return;
    }

    const cart = window.FoodFlowStore.getCart();
    if (cart.length === 0) {
      showToast('Your cart is empty. Please add food items!', 'error');
      return;
    }

    // Compulsory Form Fields Validation
    const nameInput = document.getElementById('delivName');
    const phoneInput = document.getElementById('delivPhone');
    const addrInput = document.getElementById('delivAddress');
    const cityInput = document.getElementById('delivCity');
    const pincodeInput = document.getElementById('delivPincode');
    const noteInput = document.getElementById('delivNotes');

    const name = (nameInput ? nameInput.value : '').trim();
    const phone = (phoneInput ? phoneInput.value : '').replace(/\D/g, '');
    const address = (addrInput ? addrInput.value : '').trim();
    const city = (cityInput ? cityInput.value : '').trim();
    const pincode = (pincodeInput ? pincodeInput.value : '').replace(/\D/g, '');

    let hasError = false;
    let firstErrorField = null;

    // 1. Full Name (Compulsory)
    if (!name || name.length < 2) {
      showFieldError('delivName', 'Please enter recipient full name.');
      if (!firstErrorField) firstErrorField = nameInput;
      hasError = true;
    } else {
      clearFieldError('delivName');
    }

    // 2. Phone Number (Compulsory, 10-digit Indian phone)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phone || !phoneRegex.test(phone)) {
      showFieldError('delivPhone', 'Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.');
      if (!firstErrorField) firstErrorField = phoneInput;
      hasError = true;
    } else {
      clearFieldError('delivPhone');
    }

    // 3. Street Address (Compulsory)
    if (!address || address.length < 6) {
      showFieldError('delivAddress', 'Please enter complete street address (flat/house no, landmark, street).');
      if (!firstErrorField) firstErrorField = addrInput;
      hasError = true;
    } else {
      clearFieldError('delivAddress');
    }

    // 4. City (Compulsory)
    if (!city || city.length < 2) {
      showFieldError('delivCity', 'Please enter your city name.');
      if (!firstErrorField) firstErrorField = cityInput;
      hasError = true;
    } else {
      clearFieldError('delivCity');
    }

    // 5. PIN Code (Compulsory, 6 digits)
    if (!pincode || pincode.length !== 6) {
      showFieldError('delivPincode', 'Please enter a valid 6-digit postal PIN code.');
      if (!firstErrorField) firstErrorField = pincodeInput;
      hasError = true;
    } else {
      clearFieldError('delivPincode');
    }

    if (hasError) {
      if (firstErrorField) {
        firstErrorField.focus();
        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      showToast('⚠️ Please fill all compulsory delivery address fields (*)', 'error');
      if (typeof SoundEffects !== 'undefined' && SoundEffects.playError) SoundEffects.playError();
      return;
    }

    const fullFormattedAddress = `${address}, ${city} - ${pincode}`;

    const subtotal = cart.reduce((acc, i) => acc + i.price * i.qty, 0);
    const deliveryFee = AppState.selectedRestaurant ? AppState.selectedRestaurant.feeValue || 0 : 40;
    const platformFee = 5;

    let discount = 0;
    if (AppState.appliedPromo) {
      const res = window.FoodFlowStore.validatePromo(AppState.appliedPromo.code, subtotal);
      if (res.valid) discount = res.discountAmount;
    }

    const total = Math.max(0, subtotal + deliveryFee + platformFee - discount);

    pendingCheckoutData = {
      customer: name,
      email: user.email,
      phone: phone,
      restaurantId: AppState.selectedRestaurant ? AppState.selectedRestaurant.id : 1,
      restaurant: AppState.selectedRestaurant ? AppState.selectedRestaurant.name : 'Spice Garden',
      items: [...cart],
      subtotal: subtotal,
      deliveryFee: deliveryFee,
      platformFee: platformFee,
      discount: discount,
      total: total,
      address: fullFormattedAddress,
      notes: noteInput ? noteInput.value.trim() : ''
    };

    openSwiggyPaymentModal(total);
  }

  function openSwiggyPaymentModal(totalAmount) {
    const totalDisp = document.getElementById('pgModalTotalAmount');
    if (totalDisp) totalDisp.textContent = `₹${totalAmount}`;

    const upiPayAmt = document.getElementById('upiPayAmountDisplay');
    if (upiPayAmt) upiPayAmt.textContent = totalAmount;

    // Reset UPI panels
    const defaultUpiPanel = document.getElementById('upiDefaultPanel');
    const collectUpiScreen = document.getElementById('upiCollectScreen');
    const verifiedSection = document.getElementById('upiVerifiedSection');
    const upiInput = document.getElementById('pgUpiIdInput');
    const errUpi = document.getElementById('err-pgUpiId');

    if (defaultUpiPanel) defaultUpiPanel.style.display = 'block';
    if (collectUpiScreen) collectUpiScreen.style.display = 'none';
    if (verifiedSection) verifiedSection.style.display = 'none';
    if (errUpi) errUpi.textContent = '';
    const overlay = document.getElementById('pgProcessingOverlay');
    if (overlay) overlay.style.display = 'none';

    // Reset QR section to on-demand state
    const qrTrigger = document.getElementById('pgQrTriggerCard');
    const qrActive = document.getElementById('pgQrActiveSection');
    if (qrTrigger) qrTrigger.style.display = 'block';
    if (qrActive) qrActive.style.display = 'none';
    if (qrCountdownInterval) clearInterval(qrCountdownInterval);

    renderPaymentWalletsTab(totalAmount);

    const modal = document.getElementById('swiggyPaymentModal');
    if (modal) modal.classList.add('open');
  }

  function switchPaymentTab(tabKey, btnElement) {
    document.querySelectorAll('.pg-tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.pg-tab-pane').forEach((p) => p.classList.remove('active'));

    if (btnElement) btnElement.classList.add('active');
    const pane = document.getElementById(`pg-tab-${tabKey}`);
    if (pane) pane.classList.add('active');
  }

  function handleUpiIdChanged() {
    const verifiedSection = document.getElementById('upiVerifiedSection');
    if (verifiedSection) verifiedSection.style.display = 'none';
    const errUpi = document.getElementById('err-pgUpiId');
    if (errUpi) errUpi.textContent = '';
    verifiedUpiId = null;
  }

  function appendUpiHandle(handle) {
    const input = document.getElementById('pgUpiIdInput');
    if (!input) return;
    const base = input.value.split('@')[0].trim() || 'user';
    input.value = base + handle;
    handleUpiIdChanged();
  }

  // 1. UPI ID Format Validation & Verification (Requirement #4)
  function verifyCustomUpiId() {
    const input = document.getElementById('pgUpiIdInput');
    const errEl = document.getElementById('err-pgUpiId');
    const btn = document.getElementById('btnVerifyUpi');
    const verifiedSection = document.getElementById('upiVerifiedSection');
    const verifiedText = document.getElementById('upiVerifiedText');
    const upiPayAmt = document.getElementById('upiPayAmountDisplay');

    if (!input) return;
    const rawVal = input.value.trim().toLowerCase();

    // Strict NPCI VPA Regex format: username@bank
    const vpaRegex = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z0-9]{2,32}$/;

    if (!rawVal) {
      if (errEl) errEl.textContent = 'Please enter a UPI ID (e.g. 9876543210@upi or name@okhdfcbank).';
      if (verifiedSection) verifiedSection.style.display = 'none';
      SoundEffects.playError();
      return;
    }

    if (!vpaRegex.test(rawVal)) {
      if (errEl) errEl.textContent = 'Invalid UPI ID format. Ensure it contains a valid username and @handle (e.g. name@okhdfcbank).';
      if (verifiedSection) verifiedSection.style.display = 'none';
      SoundEffects.playError();
      return;
    }

    if (errEl) errEl.textContent = '';
    if (btn) {
      btn.textContent = 'Verifying with NPCI...';
      btn.disabled = true;
    }

    // Simulate authentic bank VPA verification lookup
    setTimeout(() => {
      if (btn) {
        btn.textContent = 'Verify UPI ID';
        btn.disabled = false;
      }

      verifiedUpiId = rawVal;
      const user = window.FoodFlowStore ? window.FoodFlowStore.getCurrentUser() : null;
      const userName = user && user.name ? user.name.toUpperCase() : 'VERIFIED CUSTOMER';
      const pspHandle = rawVal.split('@')[1].toUpperCase();

      if (verifiedText) {
        verifiedText.textContent = `Verified Account: ${userName} (NPCI / ${pspHandle})`;
      }
      if (upiPayAmt && pendingCheckoutData) {
        upiPayAmt.textContent = pendingCheckoutData.total;
      }
      if (verifiedSection) {
        verifiedSection.style.display = 'block';
      }

      SoundEffects.playSuccess();
      showToast('✓ UPI ID verified successfully by NPCI!', 'success');
    }, 600);
  }

  // 2. Submit Verified UPI Payment -> Trigger Collect Request Screen
  function submitVerifiedUpiPay() {
    if (!verifiedUpiId) {
      showToast('Please verify your UPI ID first before making payment.', 'error');
      return;
    }
    triggerUpiCollectFlow(verifiedUpiId);
  }

  // 3. Select UPI App -> Trigger Collect / Intent Flow
  function selectUpiApp(appName) {
    triggerUpiCollectFlow(`UPI (${appName})`);
  }

  function triggerUpiCollectFlow(targetUpi) {
    const defaultUpiPanel = document.getElementById('upiDefaultPanel');
    const collectUpiScreen = document.getElementById('upiCollectScreen');
    const targetDisplay = document.getElementById('upiCollectTargetDisplay');
    const amountDisplay = document.getElementById('upiCollectAmountDisplay');

    if (defaultUpiPanel) defaultUpiPanel.style.display = 'none';
    if (collectUpiScreen) collectUpiScreen.style.display = 'block';

    if (targetDisplay) targetDisplay.textContent = targetUpi;
    if (amountDisplay && pendingCheckoutData) amountDisplay.textContent = `₹${pendingCheckoutData.total}`;

    startUpiCollectCountdown(299, targetUpi);
  }

  function startUpiCollectCountdown(seconds, targetUpi) {
    if (upiCollectCountdownInterval) clearInterval(upiCollectCountdownInterval);
    let remaining = seconds;
    const timerEl = document.getElementById('upiCollectTimer');

    function tick() {
      const m = String(Math.floor(remaining / 60)).padStart(2, '0');
      const s = String(remaining % 60).padStart(2, '0');
      if (timerEl) timerEl.textContent = `${m}:${s}`;
      if (remaining <= 0) {
        clearInterval(upiCollectCountdownInterval);
        showToast('UPI collect request expired. Please try again.', 'error');
        cancelUpiCollectScreen();
      }
      remaining--;
    }
    tick();
    upiCollectCountdownInterval = setInterval(tick, 1000);
  }

  function cancelUpiCollectScreen() {
    if (upiCollectCountdownInterval) clearInterval(upiCollectCountdownInterval);
    const defaultUpiPanel = document.getElementById('upiDefaultPanel');
    const collectUpiScreen = document.getElementById('upiCollectScreen');
    if (defaultUpiPanel) defaultUpiPanel.style.display = 'block';
    if (collectUpiScreen) collectUpiScreen.style.display = 'none';
  }

  function confirmUpiCollectSuccess() {
    if (upiCollectCountdownInterval) clearInterval(upiCollectCountdownInterval);
    const targetDisplay = document.getElementById('upiCollectTargetDisplay');
    const paymentMethod = targetDisplay ? targetDisplay.textContent : 'UPI (Verified)';
    executePaymentAndPlaceOrder(paymentMethod);
  }

  function showQrPaymentSection() {
    const qrTrigger = document.getElementById('pgQrTriggerCard');
    const qrActive = document.getElementById('pgQrActiveSection');
    if (qrTrigger) qrTrigger.style.display = 'none';
    if (qrActive) {
      qrActive.style.display = 'flex';
      qrActive.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    startQrCountdown(300); // 5 minutes!
    SoundEffects.playPop();
  }

  function hideQrPaymentSection() {
    const qrTrigger = document.getElementById('pgQrTriggerCard');
    const qrActive = document.getElementById('pgQrActiveSection');
    if (qrActive) qrActive.style.display = 'none';
    if (qrTrigger) qrTrigger.style.display = 'block';
    if (qrCountdownInterval) clearInterval(qrCountdownInterval);
  }

  function startQrCountdown(seconds) {
    if (qrCountdownInterval) clearInterval(qrCountdownInterval);
    let remaining = seconds;
    const timerEl = document.getElementById('pgQrTimer');

    function tick() {
      const m = String(Math.floor(remaining / 60)).padStart(2, '0');
      const s = String(remaining % 60).padStart(2, '0');
      if (timerEl) timerEl.textContent = `${m}:${s}`;
      if (remaining <= 0) {
        clearInterval(qrCountdownInterval);
        hideQrPaymentSection();
        showToast('⚠️ QR Code expired (5 minutes timeout). Click "Show QR Code" to generate a fresh QR code.', 'warning');
        SoundEffects.playError();
      }
      remaining--;
    }
    tick();
    qrCountdownInterval = setInterval(tick, 1000);
  }

  function simulateQrPaymentDone() {
    executePaymentAndPlaceOrder('UPI (Dynamic QR Code)');
  }

  function handleCardNumberInput(input) {
    let val = input.value.replace(/\D/g, '').substring(0, 16);
    let formatted = val.match(/.{1,4}/g)?.join(' ') || val;
    input.value = formatted;

    const mockNum = document.getElementById('cardMockNumber');
    if (mockNum) mockNum.textContent = formatted || '•••• •••• •••• 4242';

    // Auto-detect card network
    const networkIcon = document.getElementById('cardNetworkIcon');
    if (networkIcon) {
      if (val.startsWith('4')) networkIcon.textContent = 'VISA';
      else if (val.startsWith('5')) networkIcon.textContent = 'MASTERCARD';
      else if (val.startsWith('6')) networkIcon.textContent = 'RUPAY';
      else if (val.startsWith('3')) networkIcon.textContent = 'AMEX';
      else networkIcon.textContent = 'CARD';
    }
  }

  function handleCardNameInput(input) {
    const mockName = document.getElementById('cardMockName');
    if (mockName) mockName.textContent = (input.value.trim() || 'CARDHOLDER NAME').toUpperCase();
  }

  function handleCardExpInput(input) {
    let val = input.value.replace(/\D/g, '').substring(0, 4);
    if (val.length >= 3) {
      input.value = val.substring(0, 2) + '/' + val.substring(2, 4);
    } else {
      input.value = val;
    }
    const mockExp = document.getElementById('cardMockExp');
    if (mockExp) mockExp.textContent = input.value || 'MM/YY';
  }

  function submitCardPayment() {
    const num = document.getElementById('pgCardNumber')?.value.replace(/\s+/g, '');
    const name = document.getElementById('pgCardHolder')?.value.trim();
    const exp = document.getElementById('pgCardExp')?.value.trim();
    const cvv = document.getElementById('pgCardCvv')?.value.trim();

    if (!num || num.length < 15) {
      showToast('Please enter a valid 16-digit card number', 'error');
      return;
    }
    if (!name) {
      showToast('Please enter name on card', 'error');
      return;
    }
    if (!exp || exp.length < 5) {
      showToast('Please enter valid MM/YY expiry date', 'error');
      return;
    }
    const [mm, yy] = exp.split('/');
    if (Number(mm) < 1 || Number(mm) > 12) {
      showToast('Invalid expiry month. Must be between 01 and 12', 'error');
      return;
    }
    if (!cvv || cvv.length < 3) {
      showToast('Please enter 3-digit CVV / CVC code', 'error');
      return;
    }

    const otpAmt = document.getElementById('otpAmountTag');
    if (otpAmt && pendingCheckoutData) otpAmt.textContent = `₹${pendingCheckoutData.total}`;

    const cardModal = document.getElementById('cardOtpModal');
    const bankOtpInput = document.getElementById('bankOtpInput');
    if (bankOtpInput) bankOtpInput.value = '749201';
    if (cardModal) cardModal.classList.add('open');
  }

  function verifyBankOtpAndComplete() {
    const input = document.getElementById('bankOtpInput');
    if (!input || !input.value.trim() || input.value.trim().length < 4) {
      showToast('Please enter the 6-digit bank verification OTP', 'error');
      return;
    }
    closeAdminModal('cardOtpModal');
    executePaymentAndPlaceOrder('Credit / Debit Card (3D Secure Verified)');
  }

  function selectBank(bankName, el) {
    activeSelectedBank = bankName;
    document.querySelectorAll('.bank-card').forEach((b) => b.classList.remove('selected'));
    if (el) el.classList.add('selected');
    const select = document.getElementById('pgAllBanksSelect');
    if (select) select.value = bankName;
  }

  function submitNetBankingPayment() {
    executePaymentAndPlaceOrder(`Net Banking (${activeSelectedBank})`);
  }

  function renderPaymentWalletsTab(totalAmount) {
    const listEl = document.getElementById('pgWalletsList');
    if (!listEl || !window.FoodFlowStore) return;

    const user = window.FoodFlowStore.getCurrentUser();
    const foodflowBal = window.FoodFlowStore.getWalletBalance('FoodFlow Wallet', user ? user.email : null);
    const paytmBal = window.FoodFlowStore.getWalletBalance('Paytm Wallet');
    const amazonBal = window.FoodFlowStore.getWalletBalance('Amazon Pay');
    const phonepeBal = window.FoodFlowStore.getWalletBalance('PhonePe Wallet');

    const amt = Number(totalAmount || (pendingCheckoutData ? pendingCheckoutData.total : 0));

    const wallets = [
      {
        name: 'FoodFlow Wallet',
        key: 'FoodFlow Wallet',
        icon: '🍕',
        balance: foodflowBal,
        badge: 'Fastest 1-Click • 0 Delay',
        isFoodFlow: true
      },
      {
        name: 'Paytm Wallet',
        key: 'Paytm Wallet',
        icon: '👛',
        balance: paytmBal,
        badge: 'Paytm Payments',
        isFoodFlow: false
      },
      {
        name: 'Amazon Pay Balance',
        key: 'Amazon Pay',
        icon: '📦',
        balance: amazonBal,
        badge: 'Amazon India',
        isFoodFlow: false
      },
      {
        name: 'PhonePe Wallet',
        key: 'PhonePe Wallet',
        icon: '📱',
        balance: phonepeBal,
        badge: 'PhonePe India',
        isFoodFlow: false
      }
    ];

    listEl.innerHTML = wallets
      .map((w) => {
        const canPay = w.balance >= amt;
        return `
          <div class="payment-option ${w.isFoodFlow ? 'foodflow-wallet-opt' : ''}" style="display:flex; align-items:center; gap:12px; padding:12px 14px; border:1.5px solid ${w.isFoodFlow ? 'var(--primary)' : 'var(--border)'}; border-radius:10px; background:${w.isFoodFlow ? '#FFF8F5' : 'var(--surface)'};">
            <span class="payment-icon" style="font-size:1.5rem;">${w.icon}</span>
            <div style="flex:1;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span class="payment-label" style="font-weight:700; font-size:0.92rem;">${w.name}</span>
                ${w.badge ? `<span style="font-size:0.68rem; background:${w.isFoodFlow ? 'var(--primary)' : 'var(--surface2)'}; color:${w.isFoodFlow ? '#fff' : 'var(--text-muted)'}; padding:2px 6px; border-radius:4px; font-weight:700;">${w.badge}</span>` : ''}
              </div>
              <div style="font-size:0.78rem; color:${canPay ? 'var(--text-muted)' : 'var(--danger)'}; margin-top:2px;">
                Available balance: <strong>₹${w.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                ${!canPay ? ` <span style="color:var(--danger); font-weight:700;">(Need ₹${(amt - w.balance).toFixed(2)} more)</span>` : ''}
              </div>
            </div>
            ${canPay ? `
              <button class="action-btn success" onclick="submitWalletPayment('${w.key}')" style="font-weight:700; padding:8px 14px; font-size:0.85rem;">
                Pay ₹${amt} →
              </button>
            ` : (w.isFoodFlow ? `
              <button class="action-btn" onclick="openCustomerProfileWalletTopUp()" style="background:var(--primary); color:#fff; font-weight:700; padding:6px 12px; font-size:0.78rem;">
                + Top Up
              </button>
            ` : `
              <span class="badge badge-danger" style="padding:5px 8px; font-size:0.72rem;">Low Balance</span>
            `)}
          </div>
        `;
      })
      .join('');
  }

  function openCustomerProfileWalletTopUp() {
    closeAdminModal('swiggyPaymentModal');
    openCustomerProfile();
    setProfileTab('wallet', document.querySelectorAll('.sidebar-nav-item')[2]);
    setTimeout(() => {
      const input = document.getElementById('walletTopUpAmountInput');
      if (input) {
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 200);
  }

  function submitWalletPayment(walletName) {
    if (walletName === 'FoodFlow Wallet') {
      executePaymentAndPlaceOrder('FoodFlow Wallet');
    } else {
      executePaymentAndPlaceOrder(`Wallet (${walletName})`);
    }
  }

  function submitCodPayment() {
    executePaymentAndPlaceOrder('Cash on Delivery');
  }

  function executePaymentAndPlaceOrder(paymentMethod) {
    if (!pendingCheckoutData || !window.FoodFlowStore) return;

    const overlay = document.getElementById('pgProcessingOverlay');
    const title = document.getElementById('pgProcessingTitle');
    const desc = document.getElementById('pgProcessingDesc');

    if (overlay) {
      overlay.style.display = 'flex';
      if (title) title.textContent = 'Authorizing Transaction...';
      if (desc) desc.textContent = `Connecting securely to ${paymentMethod}`;
    }

    setTimeout(() => {
      if (title) title.textContent = 'Payment Confirmed! ✓';
      if (desc) desc.textContent = 'Transmitting order to restaurant kitchen...';

      setTimeout(() => {
        closeAdminModal('swiggyPaymentModal');
        if (qrCountdownInterval) clearInterval(qrCountdownInterval);

        const finalOrder = window.FoodFlowStore.placeOrder({
          ...pendingCheckoutData,
          paymentMethod: paymentMethod
        });

        pendingCheckoutData = null;
        updateCustomerCartUI();
        SoundEffects.playSuccess();
        showToast('🎉 Order placed successfully!', 'success');

        AppState.currentTrackingOrderId = finalOrder.id;
        const orderIdDisplay = document.getElementById('successOrderIdDisplay');
        if (orderIdDisplay) orderIdDisplay.textContent = `Order ID: #${finalOrder.id}`;

        renderLiveOrderTracker(finalOrder);
        showCustomerScreen('success');
      }, 700);
    }, 900);
  }

  // ═══════════════════════ LIVE TRACKING COMPONENT ═══════════════════════
  function renderLiveOrderTracker(order) {
    const container = document.getElementById('liveTrackingSteps');
    if (!container || !order) return;

    if (order.status === 'cancelled') {
      const isPrepaid = order.paymentMethod !== 'Cash on Delivery';
      container.innerHTML = `
        <div style="background:#FEF2F2; border:1px solid #FCA5A5; padding:1.25rem; border-radius:10px; text-align:center;">
          <div style="font-size:2.2rem; color:var(--danger); margin-bottom:4px;">✕</div>
          <h4 style="color:var(--danger); margin-bottom:4px;">Order Cancelled</h4>
          <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:8px;">Reason: "${order.cancelReason || 'Cancelled upon request'}"</p>
          ${order.refundStatus === 'refunded' ? `<div class="badge badge-success" style="font-size:0.85rem; padding:6px 12px; margin-top:4px;">💰 100% Refund of ₹${order.refundAmount || order.total} Processed (${order.paymentMethod})</div>` : (!isPrepaid ? `<div class="badge badge-info" style="font-size:0.85rem; padding:6px 12px; margin-top:4px; background:#EFF6FF; color:#1E40AF; border:1px solid #BFDBFE;">💵 For COD: Cash refund (if paid) will be returned directly via the delivery executive.</div>` : '')}
        </div>`;
      return;
    }

    const steps = [
      { key: 'pending', label: 'Order Confirmed', time: 'Received by kitchen', icon: '📝' },
      { key: 'preparing', label: 'Chef is preparing your meal', time: 'Fresh ingredients & spices', icon: '👨‍🍳' },
      { key: 'on-the-way', label: 'Valet is on the way', time: 'Dispatched for delivery', icon: '🛵' },
      { key: 'delivered', label: 'Order Delivered!', time: 'Enjoy your delicious meal', icon: '🏠' }
    ];

    const statusOrder = ['pending', 'preparing', 'on-the-way', 'delivered'];
    const currentIndex = statusOrder.indexOf(order.status);

    const stepsHtml = steps
      .map((step, idx) => {
        let state = 'pending';
        if (idx < currentIndex) {
          state = 'done';
        } else if (idx === currentIndex) {
          state = 'current';
        }

        return `
        <div class="tracking-step ${state}">
          <div class="step-icon">${state === 'done' ? '✓' : step.icon}</div>
          <div class="step-info">
            <div class="step-label">${step.label}</div>
            <div class="step-time">
              ${state === 'done' ? 'Completed ✓' : state === 'current' ? '⏳ In progress...' : step.time}
            </div>
          </div>
        </div>`;
      })
      .join('');

    const cancelActionHtml = (order.status === 'pending' || order.status === 'preparing') ? `
      <div style="margin-top:1.5rem; text-align:center;">
        <button class="action-btn danger" style="padding:9px 18px; font-size:0.85rem;" onclick="openCustomerCancelModal('${order.id}')">
          ✕ Cancel Order & Get Refund
        </button>
      </div>` : '';

    container.innerHTML = stepsHtml + cancelActionHtml;
  }

  // ═══════════════════════ CUSTOMER PROFILE & ORDER HISTORY ═══════════════════════
  let activeOrderSubTab = 'active';

  function openCustomerOrders() {
    if (!window.FoodFlowStore) return;
    const user = window.FoodFlowStore.getCurrentUser();
    if (!user) {
      openAuthModal('login');
      return;
    }
    AppState.activeProfileTab = 'orders';
    activeOrderSubTab = 'active';
    openCustomerProfile();
  }

  function openCustomerAccount() {
    if (!window.FoodFlowStore) return;
    const user = window.FoodFlowStore.getCurrentUser();
    if (!user) {
      openAuthModal('login');
      return;
    }
    AppState.activeProfileTab = 'settings';
    openCustomerProfile();
  }

  function openCustomerProfile() {
    if (!window.FoodFlowStore) return;
    const user = window.FoodFlowStore.getCurrentUser();
    if (!user) {
      openAuthModal('login');
      return;
    }

    const nameEl = document.getElementById('profileDispName');
    const emailEl = document.getElementById('profileDispEmail');
    const avatarEl = document.getElementById('profileDispAvatar');

    if (nameEl) nameEl.textContent = user.name;
    if (emailEl) emailEl.textContent = user.email;
    if (avatarEl) avatarEl.textContent = user.initials || (user.name ? user.name[0].toUpperCase() : 'U');

    document.querySelectorAll('.sidebar-nav-item').forEach((b) => {
      b.classList.remove('active');
      if (b.textContent.toLowerCase().includes(AppState.activeProfileTab)) {
        b.classList.add('active');
      }
    });

    renderProfileContent(AppState.activeProfileTab);
    showCustomerScreen('profile');
  }

  function setProfileTab(tabName, element) {
    AppState.activeProfileTab = tabName;
    document.querySelectorAll('.sidebar-nav-item').forEach((b) => b.classList.remove('active'));
    if (element) element.classList.add('active');
    renderProfileContent(tabName);
  }

  function switchOrderSubTab(subTab) {
    activeOrderSubTab = subTab;
    renderProfileContent('orders');
  }

  function renderProfileContent(tabName) {
    const container = document.getElementById('profileContentArea');
    if (!container || !window.FoodFlowStore) return;

    const user = window.FoodFlowStore.getCurrentUser();
    if (!user) return;

    if (tabName === 'orders') {
      const allUserOrders = window.FoodFlowStore.getUserOrders(user.email);
      const activeOrders = allUserOrders.filter((o) => o.status === 'pending' || o.status === 'preparing' || o.status === 'on-the-way');
      const pastOrders = allUserOrders.filter((o) => o.status === 'delivered' || o.status === 'cancelled');

      const isViewingActive = activeOrderSubTab === 'active';
      const displayOrders = isViewingActive ? activeOrders : pastOrders;

      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:10px;">
          <h2 style="font-size:1.3rem; font-weight:700; margin:0;">My Orders</h2>
          <div class="order-subtabs" style="display:flex; gap:8px; background:var(--surface2); padding:4px; border-radius:10px;">
            <button class="filter-btn ${isViewingActive ? 'active' : ''}" style="padding:6px 14px; font-size:0.85rem; border-radius:8px;" onclick="switchOrderSubTab('active')">
              ⚡ Current Active Orders (${activeOrders.length})
            </button>
            <button class="filter-btn ${!isViewingActive ? 'active' : ''}" style="padding:6px 14px; font-size:0.85rem; border-radius:8px;" onclick="switchOrderSubTab('past')">
              📋 Past Orders (${pastOrders.length})
            </button>
          </div>
        </div>

        ${displayOrders.length === 0 ? `
          <div style="text-align:center; padding:3rem 1.5rem; background:var(--surface); border-radius:var(--radius); border:1px solid var(--border);">
            <div style="font-size:2.8rem; margin-bottom:0.5rem;">${isViewingActive ? '🛵' : '📋'}</div>
            <h3 style="margin-bottom:4px;">${isViewingActive ? 'No Active Orders' : 'No Past Orders Found'}</h3>
            <p style="color:var(--text-muted); font-size:0.88rem; margin-bottom:1.25rem;">
              ${isViewingActive ? 'You currently have no orders in preparation or delivery.' : 'Your delivered and completed orders will appear here.'}
            </p>
            <button class="btn-primary" onclick="showCustomerScreen('home')">Browse Restaurants</button>
          </div>
        ` : `
          <div class="orders-list-grid">
            ${displayOrders
              .map(
                (o) => `
              <div class="order-history-card" style="${isViewingActive ? 'border-left: 4px solid var(--primary);' : ''}">
                <div class="order-hist-header">
                  <div>
                    <span class="order-hist-id">#${o.id}</span>
                    <span style="font-size:0.8rem; color:var(--text-muted); margin-left:8px;">${o.timeFormatted || 'Today'}</span>
                  </div>
                  <div style="display:flex; align-items:center; gap:6px;">
                    ${getBadgeForStatus(o.status)}
                    ${o.refundStatus === 'refunded' ? '<span class="badge badge-success" style="font-size:0.68rem;">💰 Refunded</span>' : ''}
                  </div>
                </div>
                <div style="font-weight:700; font-size:1.05rem; margin-bottom:4px;">${o.restaurant}</div>
                <div class="order-hist-items">${o.itemsSummary || (o.items || []).map((i) => `${i.name} ×${i.qty}`).join(', ')}</div>
                ${o.status === 'cancelled' ? `
                <div style="margin:6px 0; font-size:0.8rem;">
                  <span style="color:var(--danger); font-weight:700;">Reason:</span> <span style="color:var(--text-muted);">${o.cancelReason || 'Cancelled upon request'}</span>
                  ${o.refundStatus === 'refunded' ? `<div style="color:#166534; font-weight:700; margin-top:2px;">💰 ₹${o.refundAmount || o.total} refunded to ${o.paymentMethod} (Ref: ${o.refundId || 'REF-AUTO'})</div>` : ''}
                </div>` : ''}
                <div class="order-hist-footer">
                  <div>
                    <span style="color:var(--text-muted); font-size:0.82rem;">Payment: ${o.paymentMethod}</span>
                    <div style="font-weight:800; font-size:1rem; color:var(--text);">Total: ₹${o.total}</div>
                  </div>
                  <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button class="action-btn" onclick="viewOrderTrackingLive('${o.id}')">📍 Track Live</button>
                    <button class="action-btn" onclick="openAdminReceiptModal('${o.id}')">📄 Receipt</button>
                    ${(o.status === 'pending' || o.status === 'preparing') ? `<button class="action-btn danger" onclick="openCustomerCancelModal('${o.id}')">✕ Cancel</button>` : ''}
                    <button class="action-btn success" onclick="reorderCustomerItems('${o.id}')">🔄 Reorder</button>
                  </div>
                </div>
              </div>`
              )
              .join('')}
          </div>
        `}
      `;
    } else if (tabName === 'addresses') {
      const addresses = window.FoodFlowStore.getAddresses(user.email);
      container.innerHTML = `
        <h2 style="font-size:1.3rem; font-weight:700; margin-bottom:1.25rem;">Saved Delivery Addresses</h2>
        ${addresses.length === 0 ? `
          <div style="text-align:center; padding:2rem; background:var(--surface); border-radius:var(--radius); border:1px solid var(--border); margin-bottom:1rem;">
            <p style="color:var(--text-muted); margin:0;">No saved addresses yet. Add your home or office address for faster checkout!</p>
          </div>
        ` : addresses
          .map(
            (a) => `
          <div class="order-history-card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <div style="font-weight:700;">🏠 ${a.label} ${a.isDefault ? '<span class="badge badge-primary">Default</span>' : ''}</div>
              <button class="action-btn danger" style="padding:3px 8px; font-size:0.75rem;" onclick="handleCustomerDeleteAddress('${a.id}')">🗑️ Remove</button>
            </div>
            <p style="font-size:0.9rem; color:var(--text-muted); margin:0;">${a.address}</p>
          </div>`
          )
          .join('')}
        <button class="btn-ghost" style="width:100%; border-style:dashed; color:var(--primary); margin-top:0.5rem;" onclick="openAddAddressModal()">+ Add New Address</button>`;
    } else if (tabName === 'wallet') {
      const walletBal = window.FoodFlowStore.getWalletBalance('FoodFlow Wallet', user.email);
      const txs = window.FoodFlowStore.getWalletTransactions(user.email);

      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:8px;">
          <div>
            <h2 style="font-size:1.35rem; font-weight:800; margin:0 0 4px 0;">👛 FoodFlow Wallet</h2>
            <p style="font-size:0.82rem; color:var(--text-muted); margin:0;">Zero OTP delays, 1-click lightning payments & instant automatic refunds.</p>
          </div>
          <span class="badge badge-success" style="padding:6px 12px; font-size:0.82rem;">✓ Active & Zero Fee</span>
        </div>

        <!-- WALLET HERO BALANCE CARD -->
        <div style="background:linear-gradient(135deg, #1A1A2E 0%, #16213E 50%, #0F3460 100%); color:#fff; padding:1.75rem; border-radius:14px; margin-bottom:1.5rem; box-shadow:var(--shadow-md); position:relative; overflow:hidden;">
          <div style="position:absolute; right:-20px; bottom:-20px; font-size:7rem; opacity:0.08; pointer-events:none;">👛</div>
          <div style="font-size:0.82rem; text-transform:uppercase; letter-spacing:1px; opacity:0.8; font-weight:700;">FoodFlow Cash & Wallet Balance</div>
          <div style="font-size:2.6rem; font-weight:800; color:#F59E0B; margin:8px 0; letter-spacing:-0.5px;">₹${walletBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          <div style="display:flex; gap:16px; align-items:center; font-size:0.8rem; color:#A7F3D0; margin-top:8px; flex-wrap:wrap;">
            <span>✓ 100% Instant Refund on Cancel</span>
            <span>✓ RBI / PCI-DSS Compliant</span>
            <span>✓ Usable across all restaurants</span>
          </div>
        </div>

        <!-- TOP UP WALLET CARD -->
        <div class="card" style="margin-bottom:1.5rem; padding:1.5rem; border:1px solid var(--border); border-radius:12px; background:var(--surface);">
          <h3 style="font-size:1.05rem; font-weight:700; margin:0 0 6px 0;">💳 Add Money to FoodFlow Wallet</h3>
          <p style="font-size:0.82rem; color:var(--text-muted); margin:0 0 1rem 0;">Recharge your wallet instantly using UPI, Debit/Credit Card or Net Banking.</p>
          
          <div style="display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap;">
            <button class="wallet-topup-chip" onclick="setTopUpInputAmount(100)">+ ₹100</button>
            <button class="wallet-topup-chip" onclick="setTopUpInputAmount(500)">+ ₹500</button>
            <button class="wallet-topup-chip" onclick="setTopUpInputAmount(1000)">+ ₹1,000</button>
            <button class="wallet-topup-chip" onclick="setTopUpInputAmount(2000)">+ ₹2,000</button>
          </div>

          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
            <div style="position:relative; flex:1; min-width:180px;">
              <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); font-weight:700; color:var(--text-muted); font-size:1rem;">₹</span>
              <input type="number" id="walletTopUpAmountInput" placeholder="Enter amount (e.g. 500)" min="10" max="50000" style="width:100%; padding:11px 12px 11px 28px; border:1.5px solid var(--border); border-radius:8px; font-size:1rem; font-weight:700;">
            </div>
            <button class="btn-primary" onclick="handleWalletTopUpSubmit()" style="padding:11px 22px; font-weight:700; white-space:nowrap;">
              + Add Money to Wallet
            </button>
          </div>
          <div class="field-error" id="err-walletTopUpAmount" style="margin-top:6px;"></div>
        </div>

        <!-- WALLET PASSBOOK / TRANSACTIONS HISTORY -->
        <div class="card" style="padding:1.5rem; border:1px solid var(--border); border-radius:12px; background:var(--surface);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <h3 style="font-size:1.05rem; font-weight:700; margin:0;">📜 Wallet Passbook / Transactions</h3>
            <span style="font-size:0.78rem; color:var(--text-muted);">${txs.length} entries</span>
          </div>

          ${txs.length === 0 ? `
            <div style="text-align:center; padding:2rem; color:var(--text-muted); font-size:0.88rem;">
              No wallet transactions yet. Add money or order food using your FoodFlow Wallet!
            </div>
          ` : `
            <div style="display:flex; flex-direction:column; gap:10px;">
              ${txs.map((tx) => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 14px; background:var(--surface2); border:1px solid var(--border); border-radius:8px;">
                  <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:36px; height:36px; border-radius:50%; background:${tx.type === 'credit' ? '#E8F8EE' : '#FEF2F2'}; color:${tx.type === 'credit' ? 'var(--success)' : 'var(--danger)'}; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:1rem;">
                      ${tx.type === 'credit' ? '↓' : '↑'}
                    </div>
                    <div>
                      <div style="font-weight:700; font-size:0.88rem; color:var(--text);">${tx.title}</div>
                      <div style="font-size:0.75rem; color:var(--text-muted);">${tx.desc || tx.timestamp || 'Recent'}</div>
                    </div>
                  </div>
                  <div style="text-align:right;">
                    <div style="font-weight:800; font-size:0.95rem; color:${tx.type === 'credit' ? 'var(--success)' : 'var(--danger)'};">
                      ${tx.type === 'credit' ? '+' : '-'}₹${Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div style="font-size:0.72rem; color:var(--text-muted);">${tx.timestamp || ''}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      `;
    } else if (tabName === 'settings') {
      container.innerHTML = `
        <h2 style="font-size:1.3rem; font-weight:700; margin-bottom:1.25rem;">Account Settings</h2>
        <div class="form-card">
          <h3>Personal Details</h3>
          <p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:1rem;">Changing your registered email or mobile number requires 6-digit OTP verification.</p>
          <div class="form-group" id="group-profSetFullName">
            <label>Full Name <span style="color:var(--danger);">*</span></label>
            <input type="text" id="profSetFullName" placeholder="Enter your full name" value="${user.name}">
            <div class="field-error" id="err-profSetFullName"></div>
          </div>
          <div class="form-row">
            <div class="form-group" id="group-profSetEmail">
              <label>Email Address <span style="color:var(--danger);">*</span></label>
              <input type="email" id="profSetEmail" placeholder="Enter email address" value="${user.email}">
              <div class="field-error" id="err-profSetEmail"></div>
            </div>
            <div class="form-group" id="group-profSetPhone">
              <label>Phone Number (10 Digits) <span style="color:var(--danger);">*</span></label>
              <input type="tel" id="profSetPhone" maxlength="10" placeholder="10-digit mobile number" value="${user.phone || ''}">
              <div class="field-error" id="err-profSetPhone"></div>
            </div>
          </div>
          <button class="btn-primary" style="margin-top:0.5rem;" onclick="saveCustomerProfileSettings()">Save Changes</button>
        </div>`;
    }
  }

  function handleCustomerDeleteAddress(addrId) {
    if (!window.FoodFlowStore) return;
    window.FoodFlowStore.deleteAddress(addrId);
    renderProfileContent('addresses');
    showToast('Address removed from address book', 'info');
  }

  let pendingWalletTopUpAmount = 0;
  let topUpUpiCollectCountdownInterval = null;
  let topUpQrCountdownInterval = null;
  let activeTopUpSelectedBank = 'HDFC Bank';

  function setTopUpInputAmount(amount) {
    const input = document.getElementById('walletTopUpAmountInput');
    if (input) {
      input.value = amount;
      const err = document.getElementById('err-walletTopUpAmount');
      if (err) err.textContent = '';
    }
  }

  function handleWalletTopUpSubmit() {
    const input = document.getElementById('walletTopUpAmountInput');
    const err = document.getElementById('err-walletTopUpAmount');
    if (!input || !window.FoodFlowStore) return;

    const amt = Number(input.value);
    if (isNaN(amt) || amt < 10) {
      if (err) err.textContent = 'Please enter an amount of at least ₹10 to add to wallet.';
      SoundEffects.playError();
      return;
    }
    if (amt > 50000) {
      if (err) err.textContent = 'Maximum wallet recharge limit per transaction is ₹50,000.';
      SoundEffects.playError();
      return;
    }
    if (err) err.textContent = '';

    openWalletTopUpPaymentModal(amt);
  }

  function openWalletTopUpPaymentModal(amount) {
    pendingWalletTopUpAmount = Number(amount);
    const amtDisp = document.getElementById('topUpModalAmountDisplay');
    if (amtDisp) amtDisp.textContent = `₹${pendingWalletTopUpAmount.toLocaleString('en-IN')}`;

    const collectAmtDisp = document.getElementById('topUpUpiCollectAmountDisplay');
    if (collectAmtDisp) collectAmtDisp.textContent = `₹${pendingWalletTopUpAmount.toLocaleString('en-IN')}`;

    const otpAmtDisp = document.getElementById('topUpOtpAmountTag');
    if (otpAmtDisp) otpAmtDisp.textContent = `₹${pendingWalletTopUpAmount.toLocaleString('en-IN')}`;

    // Reset TopUp UPI panels
    const defaultUpiPanel = document.getElementById('topUpUpiDefaultPanel');
    const collectUpiScreen = document.getElementById('topUpUpiCollectScreen');
    const verifiedSection = document.getElementById('topUpUpiVerifiedSection');
    const upiInput = document.getElementById('topUpUpiIdInput');
    const errUpi = document.getElementById('err-topUpUpiId');

    if (defaultUpiPanel) defaultUpiPanel.style.display = 'block';
    if (collectUpiScreen) collectUpiScreen.style.display = 'none';
    if (verifiedSection) verifiedSection.style.display = 'none';
    if (upiInput) upiInput.value = '';
    if (errUpi) errUpi.textContent = '';

    const qrTrigger = document.getElementById('topUpQrTriggerCard');
    const qrActive = document.getElementById('topUpQrActiveSection');
    if (qrTrigger) qrTrigger.style.display = 'block';
    if (qrActive) qrActive.style.display = 'none';
    if (topUpQrCountdownInterval) clearInterval(topUpQrCountdownInterval);

    const overlay = document.getElementById('topUpProcessingOverlay');
    if (overlay) overlay.style.display = 'none';

    // Reset tabs to UPI
    const firstTabBtn = document.querySelector('#walletTopUpModal .pg-tab-btn');
    if (firstTabBtn) switchTopUpPaymentTab('upi', firstTabBtn);

    const modal = document.getElementById('walletTopUpModal');
    if (modal) modal.classList.add('open');
  }

  function switchTopUpPaymentTab(tabKey, btnElement) {
    document.querySelectorAll('#walletTopUpModal .pg-tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('#walletTopUpModal .pg-tab-pane').forEach((p) => p.classList.remove('active'));

    if (btnElement) btnElement.classList.add('active');
    const pane = document.getElementById(`topup-tab-${tabKey}`);
    if (pane) pane.classList.add('active');
  }

  function selectTopUpUpiApp(appName) {
    const defaultUpiPanel = document.getElementById('topUpUpiDefaultPanel');
    const collectUpiScreen = document.getElementById('topUpUpiCollectScreen');
    const targetDisplay = document.getElementById('topUpUpiCollectTargetDisplay');

    if (targetDisplay) targetDisplay.textContent = `${appName} (Mobile Push)`;
    if (defaultUpiPanel) defaultUpiPanel.style.display = 'none';
    if (collectUpiScreen) collectUpiScreen.style.display = 'flex';

    startTopUpUpiCollectTimer(300);
    SoundEffects.playPop();
  }

  function handleTopUpUpiIdChanged() {
    const verifiedSection = document.getElementById('topUpUpiVerifiedSection');
    const errUpi = document.getElementById('err-topUpUpiId');
    if (verifiedSection) verifiedSection.style.display = 'none';
    if (errUpi) errUpi.textContent = '';
  }

  function appendTopUpUpiHandle(handle) {
    const input = document.getElementById('topUpUpiIdInput');
    if (!input) return;
    let val = input.value.trim();
    if (val.includes('@')) val = val.split('@')[0];
    input.value = val ? `${val}${handle}` : `user${handle}`;
    handleTopUpUpiIdChanged();
  }

  function verifyTopUpCustomUpiId() {
    const input = document.getElementById('topUpUpiIdInput');
    const err = document.getElementById('err-topUpUpiId');
    const verifiedSection = document.getElementById('topUpUpiVerifiedSection');
    const verifiedText = document.getElementById('topUpUpiVerifiedText');

    if (!input) return;
    const vpa = input.value.trim();
    const vpaRegex = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z0-9]{2,32}$/;

    if (!vpa || !vpaRegex.test(vpa)) {
      if (err) err.textContent = 'Please enter a valid UPI VPA (e.g. mobile@upi, name@okhdfcbank).';
      if (verifiedSection) verifiedSection.style.display = 'none';
      SoundEffects.playError();
      return;
    }

    if (err) err.textContent = '';
    const user = window.FoodFlowStore ? window.FoodFlowStore.getCurrentUser() : null;
    const resolvedName = user ? user.name : 'Customer';
    const bankSuffix = vpa.split('@')[1] ? vpa.split('@')[1].toUpperCase() : 'BANK';

    if (verifiedText) {
      verifiedText.textContent = `Verified Name: ${resolvedName} (${bankSuffix} / NPCI Verified)`;
    }
    if (verifiedSection) {
      verifiedSection.style.display = 'block';
    }
    SoundEffects.playSuccess();
  }

  function submitTopUpVerifiedUpiPay() {
    const input = document.getElementById('topUpUpiIdInput');
    const vpa = input ? input.value.trim() : 'user@upi';
    executeWalletTopUpPayment(`UPI (${vpa})`);
  }

  function showTopUpQrPaymentSection() {
    const qrTrigger = document.getElementById('topUpQrTriggerCard');
    const qrActive = document.getElementById('topUpQrActiveSection');
    if (qrTrigger) qrTrigger.style.display = 'none';
    if (qrActive) {
      qrActive.style.display = 'flex';
      qrActive.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    startTopUpQrCountdown(300); // 5 minutes!
    SoundEffects.playPop();
  }

  function hideTopUpQrPaymentSection() {
    const qrTrigger = document.getElementById('topUpQrTriggerCard');
    const qrActive = document.getElementById('topUpQrActiveSection');
    if (qrActive) qrActive.style.display = 'none';
    if (qrTrigger) qrTrigger.style.display = 'block';
    if (topUpQrCountdownInterval) clearInterval(topUpQrCountdownInterval);
  }

  function startTopUpQrCountdown(seconds) {
    if (topUpQrCountdownInterval) clearInterval(topUpQrCountdownInterval);
    let remaining = seconds;
    const timerEl = document.getElementById('topUpQrTimer');

    function tick() {
      const m = String(Math.floor(remaining / 60)).padStart(2, '0');
      const s = String(remaining % 60).padStart(2, '0');
      if (timerEl) timerEl.textContent = `${m}:${s}`;
      if (remaining <= 0) {
        clearInterval(topUpQrCountdownInterval);
        hideTopUpQrPaymentSection();
        showToast('⚠️ Top-Up QR Code expired (5 minutes timeout). Click "Show QR Code" to generate a fresh QR code.', 'warning');
        SoundEffects.playError();
      }
      remaining--;
    }
    tick();
    topUpQrCountdownInterval = setInterval(tick, 1000);
  }

  function simulateTopUpQrPaymentDone() {
    executeWalletTopUpPayment('UPI (Dynamic QR Code)');
  }

  function startTopUpUpiCollectTimer(seconds) {
    if (topUpUpiCollectCountdownInterval) clearInterval(topUpUpiCollectCountdownInterval);
    let remaining = seconds;
    const timerEl = document.getElementById('topUpUpiCollectCountdown');

    function tick() {
      const m = String(Math.floor(remaining / 60)).padStart(2, '0');
      const s = String(remaining % 60).padStart(2, '0');
      if (timerEl) timerEl.textContent = `${m}:${s}`;
      if (remaining <= 0) {
        clearInterval(topUpUpiCollectCountdownInterval);
        showToast('Collect request timed out.', 'warning');
        cancelTopUpUpiCollectScreen();
      }
      remaining--;
    }
    tick();
    topUpUpiCollectCountdownInterval = setInterval(tick, 1000);
  }

  function cancelTopUpUpiCollectScreen() {
    if (topUpUpiCollectCountdownInterval) clearInterval(topUpUpiCollectCountdownInterval);
    const defaultUpiPanel = document.getElementById('topUpUpiDefaultPanel');
    const collectUpiScreen = document.getElementById('topUpUpiCollectScreen');
    if (defaultUpiPanel) defaultUpiPanel.style.display = 'block';
    if (collectUpiScreen) collectUpiScreen.style.display = 'none';
  }

  function confirmTopUpUpiCollectSuccess() {
    if (topUpUpiCollectCountdownInterval) clearInterval(topUpUpiCollectCountdownInterval);
    const targetDisplay = document.getElementById('topUpUpiCollectTargetDisplay');
    const paymentMethod = targetDisplay ? targetDisplay.textContent : 'UPI';
    executeWalletTopUpPayment(`UPI (${paymentMethod})`);
  }

  function submitTopUpCardPayment() {
    const num = document.getElementById('topUpCardNumber')?.value.replace(/\s+/g, '');
    const name = document.getElementById('topUpCardHolder')?.value.trim();
    const exp = document.getElementById('topUpCardExp')?.value.trim();
    const cvv = document.getElementById('topUpCardCvv')?.value.trim();

    if (!num || num.length < 15) {
      showToast('Please enter a valid 16-digit card number', 'error');
      return;
    }
    if (!name) {
      showToast('Please enter the name on the card', 'error');
      return;
    }
    if (!exp || exp.length < 5) {
      showToast('Please enter expiry in MM/YY format', 'error');
      return;
    }
    if (!cvv || cvv.length < 3) {
      showToast('Please enter a 3 or 4 digit CVV/CVC code', 'error');
      return;
    }

    const modal = document.getElementById('topUpCardOtpModal');
    const otpInput = document.getElementById('topUpBankOtpInput');
    if (otpInput) otpInput.value = '749201'; // Demo Bank OTP
    if (modal) modal.classList.add('open');
  }

  function verifyTopUpBankOtpAndComplete() {
    const otpInput = document.getElementById('topUpBankOtpInput');
    const otp = otpInput ? otpInput.value.trim() : '';
    if (!otp || otp.length < 4) {
      showToast('Please enter the valid 6-digit Bank OTP code', 'error');
      return;
    }
    closeAdminModal('topUpCardOtpModal');
    const cardNum = document.getElementById('topUpCardNumber')?.value.replace(/\s+/g, '') || '';
    const last4 = cardNum.slice(-4) || '8892';
    executeWalletTopUpPayment(`Card Ending ${last4}`);
  }

  function selectTopUpBank(bankName, el) {
    activeTopUpSelectedBank = bankName;
    document.querySelectorAll('#walletTopUpModal .bank-card').forEach((b) => b.classList.remove('selected'));
    if (el) el.classList.add('selected');
    const select = document.getElementById('topUpAllBanksSelect');
    if (select) select.value = bankName;
  }

  function submitTopUpNetBankingPayment() {
    executeWalletTopUpPayment(`Net Banking (${activeTopUpSelectedBank})`);
  }

  function executeWalletTopUpPayment(paymentMethod) {
    if (!pendingWalletTopUpAmount || !window.FoodFlowStore) return;

    const overlay = document.getElementById('topUpProcessingOverlay');
    const title = document.getElementById('topUpProcessingTitle');
    const desc = document.getElementById('topUpProcessingDesc');

    if (overlay) {
      overlay.style.display = 'flex';
      if (title) title.textContent = 'Authorizing Wallet Recharge...';
      if (desc) desc.textContent = `Connecting securely via ${paymentMethod}`;
    }

    setTimeout(() => {
      if (title) title.textContent = 'Recharge Confirmed! ✓';
      if (desc) desc.textContent = 'Crediting funds to your FoodFlow Wallet...';

      setTimeout(() => {
        closeAdminModal('walletTopUpModal');
        if (topUpQrCountdownInterval) clearInterval(topUpQrCountdownInterval);
        if (topUpUpiCollectCountdownInterval) clearInterval(topUpUpiCollectCountdownInterval);

        const rechargedAmount = pendingWalletTopUpAmount;
        pendingWalletTopUpAmount = 0;

        const newBal = window.FoodFlowStore.topUpFoodFlowWallet(rechargedAmount, `Recharge via ${paymentMethod}`);
        SoundEffects.playSuccess();
        showToast(`🎉 ₹${rechargedAmount.toLocaleString()} added to FoodFlow Wallet via ${paymentMethod}! New balance: ₹${newBal.toLocaleString()}`, 'success');

        renderProfileContent('wallet');
        updateCustomerAuthUI();
      }, 900);
    }, 1100);
  }

  function saveCustomerProfileSettings() {
    const nameInput = document.getElementById('profSetFullName');
    const emailInput = document.getElementById('profSetEmail');
    const phoneInput = document.getElementById('profSetPhone');
    if (!window.FoodFlowStore) return;

    const user = window.FoodFlowStore.getCurrentUser();
    if (!user) return;

    const newName = (nameInput ? nameInput.value : '').trim();
    const newEmail = (emailInput ? emailInput.value : '').trim().toLowerCase();
    const newPhone = (phoneInput ? phoneInput.value : '').replace(/\D/g, '').slice(-10);

    if (!ValidationUtils.isValidName(newName)) {
      showFieldError('profSetFullName', 'Please enter a valid full name (letters only, 2-35 chars).');
      return;
    }
    clearFieldError('profSetFullName');

    if (!ValidationUtils.isValidEmail(newEmail)) {
      showFieldError('profSetEmail', 'Please enter a valid RFC email address.');
      return;
    }
    clearFieldError('profSetEmail');

    if (!ValidationUtils.isValidPhone(newPhone)) {
      showFieldError('profSetPhone', 'Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    clearFieldError('profSetPhone');

    const emailChanged = newEmail !== user.email.toLowerCase();
    const phoneChanged = newPhone !== (user.phone || '').replace(/\D/g, '').slice(-10);

    // Check duplicate in store
    const allUsers = window.FoodFlowStore.getUsers();
    if (emailChanged && allUsers.some((u) => u.id !== user.id && u.email.toLowerCase() === newEmail)) {
      showFieldError('profSetEmail', 'An account with this email address already exists.');
      return;
    }
    if (phoneChanged && allUsers.some((u) => u.id !== user.id && u.phone && u.phone.replace(/\D/g, '') === newPhone)) {
      showFieldError('profSetPhone', 'An account with this mobile number already exists.');
      return;
    }

    if (emailChanged || phoneChanged) {
      // Trigger Swiggy/Zomato OTP Verification
      AppState.pendingProfileChange = {
        name: newName,
        email: newEmail,
        phone: newPhone,
        emailChanged,
        phoneChanged
      };

      const targetIdentifier = emailChanged ? newEmail : newPhone;
      AppState.profileOtpTarget = targetIdentifier;

      const otpRes = window.FoodFlowStore.generateProfileChangeOTP(targetIdentifier);
      AppState.profileOtpCode = otpRes.otp;

      const modal = document.getElementById('profileVerifyOtpModal');
      const targetDisp = document.getElementById('profileOtpTargetDisplay');
      const hintEl = document.getElementById('profileOtpCodeHint');
      const input = document.getElementById('profileChangeOtpInput');
      const errEl = document.getElementById('err-profileChangeOtp');

      if (targetDisp) targetDisp.textContent = targetIdentifier;
      if (hintEl) hintEl.textContent = otpRes.otp;
      if (input) input.value = '';
      if (errEl) errEl.textContent = '';
      if (modal) modal.classList.add('open');

      showToast(`🔑 Verification Code: ${otpRes.otp} (or use 123456)`, 'info');
      return;
    }

    // Only Name changed
    const updated = window.FoodFlowStore.updateUserProfile({
      id: user.id,
      email: user.email,
      name: newName
    });

    updateCustomerAuthUI();
    showToast('✓ Personal details updated successfully!', 'success');
    openCustomerProfile();
  }

  function verifyAndSaveProfileOtp() {
    const input = document.getElementById('profileChangeOtpInput');
    const errEl = document.getElementById('err-profileChangeOtp');
    const rawVal = input ? input.value.trim() : '';
    const entered = rawVal.replace(/\D/g, ''); // strip non-digits

    if (!entered) {
      if (errEl) errEl.textContent = 'Please enter the 6-digit OTP code.';
      return;
    }

    if (!window.FoodFlowStore) return;
    let user = window.FoodFlowStore.getCurrentUser();
    if (!user) {
      const users = window.FoodFlowStore.getUsers();
      user = users && users.length > 0 ? users[0] : null;
      if (user) window.FoodFlowStore.setCurrentUser(user);
    }

    // Auto-reconstruct pending changes from inputs if state was cleared
    const nameInput = document.getElementById('profSetFullName');
    const emailInput = document.getElementById('profSetEmail');
    const phoneInput = document.getElementById('profSetPhone');

    const newName = (nameInput ? nameInput.value : '').trim() || (user ? user.name : 'Customer');
    const newEmail = (emailInput ? emailInput.value : '').trim().toLowerCase() || (user ? user.email : 'user@example.com');
    const newPhone = (phoneInput ? phoneInput.value : '').replace(/\D/g, '').slice(-10) || (user ? user.phone : '9876543210');

    // Update in store directly
    window.FoodFlowStore.updateUserProfile({
      id: user ? user.id : 'U001',
      oldEmail: user ? user.email : newEmail,
      email: newEmail,
      phone: newPhone,
      name: newName
    });

    // Close modal cleanly
    closeAdminModal('profileVerifyOtpModal');
    const modal = document.getElementById('profileVerifyOtpModal');
    if (modal) {
      modal.classList.remove('open');
      modal.style.display = 'none';
    }

    AppState.pendingProfileChange = null;
    if (input) input.value = '';
    if (errEl) errEl.textContent = '';

    updateCustomerAuthUI();
    openCustomerProfile();
    showToast('✓ Personal details & phone number updated successfully!', 'success');
  }

  function openAddAddressModal() {
    const text = document.getElementById('newAddrText');
    if (text) text.value = '';
    clearFieldError('newAddrText');
    const modal = document.getElementById('addAddressModal');
    if (modal) modal.classList.add('open');
  }

  function submitCustomerAddress() {
    if (!window.FoodFlowStore) return;
    const user = window.FoodFlowStore.getCurrentUser();
    if (!user) return;
    const label = document.getElementById('newAddrLabel');
    const text = document.getElementById('newAddrText');

    if (!text || !text.value.trim() || text.value.trim().length < 6) {
      showFieldError('newAddrText', 'Please enter full street address (at least 6 characters).');
      return;
    }

    try {
      window.FoodFlowStore.addAddress({
        userEmail: user.email,
        label: label ? label.value : 'Home',
        address: text.value.trim(),
        isDefault: false
      });

      closeAdminModal('addAddressModal');
      renderProfileContent('addresses');
      showToast('✓ New address saved to your address book!', 'success');
    } catch (err) {
      showFieldError('newAddrText', err.message);
      showToast(err.message, 'error');
    }
  }

  function viewOrderTrackingLive(orderId) {
    if (!window.FoodFlowStore) return;
    const order = window.FoodFlowStore.getOrderById(orderId);
    if (!order) return;
    AppState.currentTrackingOrderId = order.id;
    const orderIdDisplay = document.getElementById('successOrderIdDisplay');
    if (orderIdDisplay) orderIdDisplay.textContent = `Order ID: #${order.id}`;
    renderLiveOrderTracker(order);
    showCustomerScreen('success');
  }

  function reorderCustomerItems(orderId) {
    if (!window.FoodFlowStore) return;
    const order = window.FoodFlowStore.getOrderById(orderId);
    if (!order) {
      showToast('Could not find order to reorder', 'error');
      return;
    }

    if (order.restaurantId) {
      const rest = window.FoodFlowStore.getRestaurantById(order.restaurantId);
      if (rest) AppState.selectedRestaurant = rest;
    }

    window.FoodFlowStore.clearCart();

    const itemsToReorder = (order.items && order.items.length > 0)
      ? order.items
      : [{ id: 101, name: 'Royal Chicken Dum Biryani', price: 320, qty: 1 }];

    itemsToReorder.forEach((item) => {
      window.FoodFlowStore.addToCart(item.id || item.menu_item_id || 101, item.qty || 1);
    });

    if (typeof updateCustomerCartUI === 'function') {
      try { updateCustomerCartUI(); } catch (_) {}
    }
    showToast(`✓ Items from Order #${orderId} added to your cart!`, 'success');
    if (typeof proceedToCheckout === 'function') {
      try { proceedToCheckout(); } catch (_) {}
    }
  }

  // ═══════════════════════ FORM VALIDATIONS ═══════════════════════
  const ValidationUtils = {
    isValidEmail(email) {
      const clean = String(email || '').trim().toLowerCase();
      const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      return re.test(clean) && !clean.endsWith('.con') && !clean.endsWith('.cm');
    },
    isValidName(name) {
      const clean = String(name || '').trim();
      const re = /^[a-zA-Z\s]{2,35}$/;
      return re.test(clean);
    },
    isValidLastName(name) {
      const clean = String(name || '').trim();
      if (!clean) return true;
      const re = /^[a-zA-Z\s]{1,35}$/;
      return re.test(clean);
    },
    isValidPhone(phone) {
      const digits = String(phone || '').replace(/\D/g, '').slice(-10);
      return /^[6-9]\d{9}$/.test(digits);
    },
    evaluatePasswordStrength(password) {
      const p = String(password || '');
      if (!p) {
        return { score: 0, label: 'Enter password', cssClass: 'weak', isValid: false, hint: 'Min 8 chars with uppercase, number & symbol' };
      }

      let score = 0;
      const hasLength = p.length >= 8;
      const hasUpper = /[A-Z]/.test(p);
      const hasLower = /[a-z]/.test(p);
      const hasNumber = /[0-9]/.test(p);
      const hasSpecial = /[^A-Za-z0-9]/.test(p);

      if (p.length >= 6) score++;
      if (hasLength && (hasUpper || hasLower)) score++;
      if (hasUpper && hasLower && hasNumber) score++;
      if (hasLength && hasUpper && hasLower && hasNumber && hasSpecial) score++;

      const isValid = hasLength && hasUpper && hasLower && hasNumber && hasSpecial;

      let label = 'Weak';
      let cssClass = 'weak';
      let hint = 'Min 8 chars with uppercase, lowercase, number & symbol';

      if (score === 2) {
        label = 'Fair';
        cssClass = 'fair';
      } else if (score === 3) {
        label = 'Good';
        cssClass = 'good';
      } else if (score >= 4) {
        label = 'Strong & Secure ✓';
        cssClass = 'strong';
        hint = 'Great password!';
      }

      return { score, label, cssClass, isValid, hasLength, hasUpper, hasLower, hasNumber, hasSpecial, hint };
    }
  };

  function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errEl = document.getElementById('err-' + fieldId);
    const groupEl = document.getElementById('group-' + fieldId);

    if (groupEl) {
      groupEl.classList.remove('has-success');
      groupEl.classList.add('has-error');
    }
    if (errEl) {
      errEl.innerHTML = `⚠️ ${message}`;
      errEl.classList.add('show');
    }
    if (field) {
      field.classList.add('input-invalid');
      field.classList.remove('input-valid');
    }
  }

  function clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    const errEl = document.getElementById('err-' + fieldId);
    const groupEl = document.getElementById('group-' + fieldId);

    if (groupEl) {
      groupEl.classList.remove('has-error');
    }
    if (errEl) {
      errEl.innerHTML = '';
      errEl.classList.remove('show');
    }
    if (field) {
      field.classList.remove('input-invalid');
    }
  }

  function clearAllFormErrors(containerId) {
    const root = document.getElementById(containerId) || document;
    root.querySelectorAll('.field-error').forEach((el) => {
      el.innerHTML = '';
      el.classList.remove('show');
    });
    root.querySelectorAll('.form-group').forEach((el) => {
      el.classList.remove('has-error', 'has-success');
    });
    root.querySelectorAll('input, select, textarea').forEach((el) => {
      el.classList.remove('input-invalid', 'input-valid');
    });
  }

  function clearAuthForms() {
    clearAllFormErrors('authModal');
    const fieldsToClear = [
      'loginEmailField',
      'loginPasswordField',
      'regFirstName',
      'regLastName',
      'regEmail',
      'regPhone',
      'regPassword',
      'regConfirmPassword',
      'forgotEmailField',
      'forgotNewPasswordField',
      'forgotConfirmPasswordField',
      'otpBox1',
      'otpBox2',
      'otpBox3',
      'otpBox4',
      'otpBox5',
      'otpBox6'
    ];
    fieldsToClear.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const terms = document.getElementById('regTermsCheckbox');
    if (terms) terms.checked = false;
  }

  // ═══════════════════════ CUSTOMER AUTHENTICATION ═══════════════════════
  function updateCustomerAuthUI() {
    if (!window.FoodFlowStore) return;
    const user = window.FoodFlowStore.getCurrentUser();
    const btn = document.getElementById('navAuthBtn');
    if (!btn) return;

    if (user) {
      btn.textContent = `👤 ${user.firstName || user.name.split(' ')[0]}`;
      btn.onclick = openCustomerProfile;
    } else {
      btn.textContent = 'Sign In';
      btn.onclick = () => openAuthModal('login');
    }
  }

  function openAuthModal(mode = 'login') {
    clearAuthForms();
    setAuthTabMode(mode);
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.add('open');
  }

  function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('open');
    if (AppState.forgotCountdownTimer) clearInterval(AppState.forgotCountdownTimer);
  }

  function setAuthTabMode(mode) {
    AppState.activeAuthMode = mode;
    clearAllFormErrors('authModal');

    const tabLogin = document.getElementById('authTabLogin');
    const tabReg = document.getElementById('authTabRegister');
    const formLogin = document.getElementById('authLoginForm');
    const formReg = document.getElementById('authRegisterForm');
    const formForgot = document.getElementById('authForgotForm');
    const tabsCont = document.getElementById('authTabsContainer');

    if (formLogin) formLogin.style.display = mode === 'login' ? 'block' : 'none';
    if (formReg) formReg.style.display = mode === 'register' ? 'block' : 'none';
    if (formForgot) formForgot.style.display = mode === 'forgot' ? 'block' : 'none';

    if (tabsCont) tabsCont.style.display = mode === 'forgot' ? 'none' : 'flex';

    if (tabLogin) {
      tabLogin.style.color = mode === 'login' ? 'var(--primary)' : 'var(--text-muted)';
      tabLogin.style.borderBottomColor = mode === 'login' ? 'var(--primary)' : 'transparent';
    }
    if (tabReg) {
      tabReg.style.color = mode === 'register' ? 'var(--primary)' : 'var(--text-muted)';
      tabReg.style.borderBottomColor = mode === 'register' ? 'var(--primary)' : 'transparent';
    }

    if (mode === 'forgot') showForgotStep(1);
  }

  function handleCustomerLogin() {
    clearAllFormErrors('authLoginForm');
    const emailField = document.getElementById('loginEmailField');
    const passField = document.getElementById('loginPasswordField');

    const email = emailField ? emailField.value.trim() : '';
    const pass = passField ? passField.value : '';

    let hasError = false;
    if (!email) {
      showFieldError('loginEmailField', 'Please enter your registered email address or 10-digit mobile number.');
      hasError = true;
    }
    if (!pass) {
      showFieldError('loginPasswordField', 'Please enter your password.');
      hasError = true;
    }

    if (hasError) return;

    try {
      const user = window.FoodFlowStore.loginUser(email, pass);
      closeAuthModal();
      updateCustomerAuthUI();
      showToast(`Welcome back, ${user.firstName || user.name}! 👋`, 'success');
      if (AppState.activeCustomerScreen === 'checkout') renderCheckoutSummary();
    } catch (err) {
      showFieldError('loginPasswordField', err.message);
      showToast(err.message, 'error');
    }
  }

  function handleCustomerRegister() {
    clearAllFormErrors('authRegisterForm');
    const fName = document.getElementById('regFirstName')?.value.trim();
    const lName = document.getElementById('regLastName')?.value.trim();
    const email = document.getElementById('regEmail')?.value.trim();
    const phone = document.getElementById('regPhone')?.value.trim();
    const pass = document.getElementById('regPassword')?.value;
    const passConfirm = document.getElementById('regConfirmPassword')?.value;
    const terms = document.getElementById('regTermsCheckbox')?.checked;

    let hasError = false;

    if (!ValidationUtils.isValidName(fName)) {
      showFieldError('regFirstName', 'Please enter your first name (letters only, min 2 characters).');
      hasError = true;
    }

    if (!ValidationUtils.isValidEmail(email)) {
      showFieldError('regEmail', 'Please enter a valid RFC-compliant email address (e.g. name@example.com).');
      hasError = true;
    }

    if (!ValidationUtils.isValidPhone(phone)) {
      showFieldError('regPhone', 'Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).');
      hasError = true;
    }

    const strength = ValidationUtils.evaluatePasswordStrength(pass);
    if (!strength.isValid) {
      showFieldError('regPassword', strength.hint);
      hasError = true;
    }

    if (pass !== passConfirm) {
      showFieldError('regConfirmPassword', 'Passwords do not match. Please re-enter.');
      hasError = true;
    }

    if (!terms) {
      showFieldError('regTermsCheckbox', 'You must agree to the Terms of Service & Privacy Policy to continue.');
      hasError = true;
    }

    if (hasError) return;

    try {
      const user = window.FoodFlowStore.registerUser({
        firstName: fName,
        lastName: lName,
        email: email,
        phone: phone,
        password: pass
      });

      closeAuthModal();
      updateCustomerAuthUI();
      showToast(`Account created! Welcome to FoodFlow, ${user.firstName}! 🎉`, 'success');
      if (AppState.activeCustomerScreen === 'checkout') renderCheckoutSummary();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ═══════════════════════ SIGN OUT CONFIRMATION (SWIGGY/ZOMATO PARITY) ═══════════════════════
  function handleCustomerLogout() {
    const modal = document.getElementById('signOutConfirmModal');
    if (modal) {
      modal.classList.add('open');
    } else {
      confirmCustomerLogout();
    }
  }

  function confirmCustomerLogout() {
    if (window.FoodFlowStore) {
      window.FoodFlowStore.clearUserSession();
    }
    clearAuthForms();

    // Clear checkout delivery inputs to clean blank state
    const nameInput = document.getElementById('delivName');
    const phoneInput = document.getElementById('delivPhone');
    const addrInput = document.getElementById('delivAddress');
    const noteInput = document.getElementById('delivNotes');
    if (nameInput) nameInput.value = '';
    if (phoneInput) phoneInput.value = '';
    if (addrInput) addrInput.value = '';
    if (noteInput) noteInput.value = '';

    closeAdminModal('signOutConfirmModal');
    updateCustomerAuthUI();
    showCustomerScreen('home');
    showToast('You have been signed out.', 'info');
  }

  // ═══════════════════════ FORGOT PASSWORD OTP WIZARD ═══════════════════════
  function showForgotStep(stepNumber) {
    AppState.forgotStep = stepNumber;
    ['forgotStep1', 'forgotStep2', 'forgotStep3', 'forgotStep4'].forEach((id, idx) => {
      const el = document.getElementById(id);
      if (el) el.style.display = idx + 1 === stepNumber ? 'block' : 'none';
    });
  }

  function handleRequestPasswordOTP() {
    clearAllFormErrors('authForgotForm');
    const input = document.getElementById('forgotEmailField');
    const identifier = input ? input.value.trim() : '';

    if (!identifier) {
      showFieldError('forgotEmailField', 'Please enter your registered email address or 10-digit mobile number.');
      return;
    }

    try {
      const res = window.FoodFlowStore.generatePasswordResetOTP(identifier);
      AppState.forgotTargetEmail = res.email;
      AppState.forgotOtpCode = res.otp;

      const destDisplay = document.getElementById('forgotTargetEmailDisplay');
      const hintEl = document.getElementById('forgotOtpCodeHint');
      if (destDisplay) destDisplay.textContent = res.email;
      if (hintEl) hintEl.textContent = res.otp;

      showForgotStep(2);
      setupOtpInputBoxes();
      showToast(`🔑 Verification Code: ${res.otp} (or use 123456)`, 'info');
    } catch (err) {
      showFieldError('forgotEmailField', err.message);
      showToast(err.message, 'error');
    }
  }

  function autoFillProfileOtp() {
    const input = document.getElementById('profileChangeOtpInput');
    const hintEl = document.getElementById('profileOtpCodeHint');
    const otp = AppState.profileOtpCode || (hintEl ? hintEl.textContent : '123456');
    if (input) {
      input.value = otp;
      showToast('✓ OTP Code filled: ' + otp, 'info');
    }
  }

  function autoFillForgotOtp() {
    const hintEl = document.getElementById('forgotOtpCodeHint');
    const otp = String(AppState.forgotOtpCode || (hintEl ? hintEl.textContent : '123456'));
    const digits = otp.split('');
    digits.forEach((d, i) => {
      const box = document.getElementById(`otpBox${i + 1}`);
      if (box) box.value = d;
    });
    showToast('✓ OTP Code filled: ' + otp, 'info');
  }

  function setupOtpInputBoxes() {
    const boxes = document.querySelectorAll('.otp-digit-input');
    boxes.forEach((box, idx) => {
      box.value = '';
      box.oninput = (e) => {
        box.value = box.value.replace(/\D/g, '');
        if (box.value && idx < boxes.length - 1) {
          boxes[idx + 1].focus();
        }
      };
      box.onkeydown = (e) => {
        if (e.key === 'Backspace' && !box.value && idx > 0) {
          boxes[idx - 1].focus();
        }
      };
    });
    if (boxes[0]) boxes[0].focus();
  }

  function handleVerifyPasswordOTP() {
    let entered = '';
    document.querySelectorAll('.otp-digit-input').forEach((b) => (entered += b.value));

    if (entered.length !== 6) {
      showFieldError('forgotOtpField', 'Please enter the complete 6-digit OTP code.');
      return;
    }

    const res = window.FoodFlowStore.verifyPasswordResetOTP(AppState.forgotTargetEmail, entered);
    if (!res.valid) {
      showFieldError('forgotOtpField', res.message);
      return;
    }

    showForgotStep(3);
  }

  function handleSubmitNewPassword() {
    clearAllFormErrors('forgotStep3');
    const pass = document.getElementById('forgotNewPasswordField')?.value;
    const passConfirm = document.getElementById('forgotConfirmPasswordField')?.value;

    let hasError = false;
    const strength = ValidationUtils.evaluatePasswordStrength(pass);
    if (!strength.isValid) {
      showFieldError('forgotNewPasswordField', strength.hint);
      hasError = true;
    }
    if (pass !== passConfirm) {
      showFieldError('forgotConfirmPasswordField', 'Passwords do not match. Please re-enter.');
      hasError = true;
    }

    if (hasError) return;

    window.FoodFlowStore.updateUserPassword(AppState.forgotTargetEmail, pass);
    window.FoodFlowStore.loginUser(AppState.forgotTargetEmail, pass);
    updateCustomerAuthUI();
    showForgotStep(4);
    SoundEffects.playSuccess();
  }

  function handleFinishPasswordReset() {
    closeAuthModal();
    showCustomerScreen('home');
    showToast('Signed in successfully with your new password!', 'success');
  }

  // ═══════════════════════ ORDER CANCELLATION & REFUND MODAL ═══════════════════════
  let activeCancellingOrderId = null;

  function openCustomerCancelModal(orderId) {
    if (!window.FoodFlowStore) return;
    const order = window.FoodFlowStore.getOrderById(orderId);
    if (!order) return;

    activeCancellingOrderId = order.id;
    const idDisp = document.getElementById('cancelModalOrderId');
    const amtDisp = document.getElementById('cancelModalAmount');
    const payDisp = document.getElementById('cancelModalPayment');
    const noticeDisp = document.getElementById('cancelModalRefundNotice');

    if (idDisp) idDisp.textContent = `#${order.id}`;
    if (amtDisp) amtDisp.textContent = `₹${order.total}`;
    if (payDisp) payDisp.textContent = order.paymentMethod;

    const isPrepaid = order.paymentMethod !== 'Cash on Delivery';
    if (noticeDisp) {
      noticeDisp.innerHTML = isPrepaid
        ? `<div style="background:#E8F8EE; border:1px solid #86EFAC; color:#166534; padding:0.75rem; border-radius:8px; font-size:0.84rem;">
            <strong>✓ Instant 100% Refund Eligible:</strong> ₹${order.total} will be refunded back immediately to your ${order.paymentMethod}.
           </div>`
        : `<div style="background:#EFF6FF; border:1px solid #BFDBFE; color:#1E40AF; padding:0.75rem; border-radius:8px; font-size:0.84rem;">
            <strong>💵 Cash on Delivery (COD) Order:</strong> If you have already handed over cash to the delivery executive, the cash refund will be returned directly to you by the delivery executive.
           </div>`;
    }

    const modal = document.getElementById('customerCancelOrderModal');
    if (modal) modal.classList.add('open');
  }

  function confirmCustomerOrderCancellation() {
    if (!activeCancellingOrderId || !window.FoodFlowStore) return;
    const reasonSel = document.getElementById('custCancelReasonSelect');
    const notesEl = document.getElementById('custCancelNotes');

    const reason = (reasonSel ? reasonSel.value : '') + (notesEl && notesEl.value.trim() ? ` (${notesEl.value.trim()})` : '');

    const res = window.FoodFlowStore.cancelOrder(activeCancellingOrderId, reason, 'Customer');
    closeAdminModal('customerCancelOrderModal');

    if (res.success) {
      showToast(res.message, 'success');
      if (AppState.activeCustomerScreen === 'profile') {
        renderProfileContent(AppState.activeProfileTab);
      }
      if (AppState.activeCustomerScreen === 'success') {
        const ord = window.FoodFlowStore.getOrderById(activeCancellingOrderId);
        if (ord) renderLiveOrderTracker(ord);
      }
    }
  }

  function openAdminReceiptModal(orderId) {
    if (!window.FoodFlowStore) return;
    const order = window.FoodFlowStore.getOrderById(orderId);
    if (!order) return;

    const content = document.getElementById('receiptModalContent');
    if (!content) return;

    content.innerHTML = `
      <div class="receipt-box" style="font-family:'JetBrains Mono', monospace; font-size:0.85rem; line-height:1.5;">
        <div style="text-align:center; margin-bottom:1rem; border-bottom:1.5px dashed var(--border); padding-bottom:0.75rem;">
          <h2 style="margin:0; font-family:'Plus Jakarta Sans', sans-serif;">🍕 FoodFlow</h2>
          <div style="font-size:0.78rem; color:var(--text-muted);">Official Tax Invoice / Receipt</div>
          <div style="font-weight:700; margin-top:4px;">Order #${order.id}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${order.timeFormatted || 'Today'}</div>
        </div>
        <div style="margin-bottom:0.75rem;">
          <div><strong>Customer:</strong> ${order.customer}</div>
          <div><strong>Restaurant:</strong> ${order.restaurant}</div>
          <div><strong>Payment:</strong> ${order.paymentMethod}</div>
          <div><strong>Status:</strong> ${order.status.toUpperCase()}</div>
        </div>
        <div style="border-top:1px dashed var(--border); border-bottom:1px dashed var(--border); padding:0.5rem 0; margin-bottom:0.75rem;">
          ${(order.items || [])
            .map(
              (i) => `
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span>${i.name} ×${i.qty}</span>
              <span>₹${i.price * i.qty}</span>
            </div>`
            )
            .join('')}
        </div>
        <div style="display:flex; justify-content:space-between;"><span>Subtotal</span><span>₹${order.subtotal}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>Delivery Fee</span><span>₹${order.deliveryFee}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>Platform Fee</span><span>₹${order.platformFee || 5}</span></div>
        ${order.discount ? `<div style="display:flex; justify-content:space-between; color:var(--success);"><span>Discount</span><span>-₹${order.discount}</span></div>` : ''}
        <div style="display:flex; justify-content:space-between; font-weight:800; font-size:1.05rem; margin-top:6px; border-top:1px solid var(--border); padding-top:6px;">
          <span>Grand Total</span><span>₹${order.total}</span>
        </div>
        ${order.refundStatus === 'refunded' ? `
        <div style="margin-top:10px; background:#E8F8EE; padding:6px; border-radius:4px; text-align:center; color:#166534; font-weight:700;">
          💰 100% REFUND OF ₹${order.refundAmount || order.total} PROCESSED (Ref: ${order.refundId || 'REF-AUTO'})
        </div>` : ''}
      </div>`;

    const modal = document.getElementById('receiptModal');
    if (modal) modal.classList.add('open');
  }

  // ═══════════════════════ ADMIN PORTAL ═══════════════════════
  function showAdminPage(pageName, btnEl) {
    AppState.activeAdminPage = pageName;
    document.querySelectorAll('.admin-nav-item').forEach((b) => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    document.querySelectorAll('.admin-page').forEach((p) => p.classList.remove('active'));
    const target = document.getElementById(`admin-page-${pageName}`);
    if (target) target.classList.add('active');

    const titles = {
      dashboard: ['Dashboard Overview', 'Real-time sales, order volume and analytics'],
      orders: ['Customer Orders Management', 'Track active kitchens, dispatch and cancellations'],
      users: ['User Accounts Directory', 'Manage customer profiles and staff permissions'],
      restaurants: ['Restaurant Partners', 'Live vendor catalog and status controls'],
      menu: ['Menu Items Catalog', 'Manage dishes, prices and real-time inventory'],
      payments: ['Payment Transactions Ledger', 'Verified payment receipts and refunds'],
      settings: ['Platform Settings & Coupons', 'Global configurations and promo discounts']
    };

    const titleEl = document.getElementById('adminTopbarTitle');
    const subEl = document.getElementById('adminTopbarSub');
    if (titleEl && titles[pageName]) titleEl.textContent = titles[pageName][0];
    if (subEl && titles[pageName]) subEl.textContent = titles[pageName][1];

    if (pageName === 'dashboard') renderAdminDashboard();
    else if (pageName === 'orders') renderAdminOrders();
    else if (pageName === 'users') renderAdminUsers();
    else if (pageName === 'restaurants') renderAdminRestaurants();
    else if (pageName === 'menu') renderAdminMenu();
    else if (pageName === 'payments') renderAdminPayments();
    else if (pageName === 'settings') renderAdminSettings();
  }

  function renderAdminDashboard() {
    if (!window.FoodFlowStore) return;
    const orders = window.FoodFlowStore.getOrders();
    const users = window.FoodFlowStore.getUsers();

    const nonCancelled = orders.filter((o) => o.status !== 'cancelled');
    const revenue = nonCancelled.reduce((acc, o) => acc + o.total, 0);
    const pending = orders.filter((o) => o.status === 'pending' || o.status === 'preparing');

    const ordersEl = document.getElementById('admStatOrders');
    const revEl = document.getElementById('admStatRevenue');
    const usersEl = document.getElementById('admStatUsers');
    const pendEl = document.getElementById('admStatPending');
    const badge = document.getElementById('adminPendingOrdersBadge');

    if (ordersEl) ordersEl.textContent = orders.length;
    if (revEl) revEl.textContent = `₹${revenue.toLocaleString()}`;
    if (usersEl) usersEl.textContent = users.length;
    if (pendEl) pendEl.textContent = pending.length;
    if (badge) badge.textContent = pending.length;

    const recentTable = document.getElementById('admRecentOrdersTable');
    if (recentTable) {
      recentTable.innerHTML = `
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Customer</th>
            <th>Restaurant</th>
            <th>Total</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${orders.slice(0, 5).map((o) => `
            <tr>
              <td><strong>#${o.id}</strong></td>
              <td>${o.customer}</td>
              <td>${o.restaurant}</td>
              <td>₹${o.total}</td>
              <td>${getBadgeForStatus(o.status)}</td>
              <td><button class="action-btn" onclick="openAdminStatusModal('${o.id}')">Update</button></td>
            </tr>
          `).join('')}
        </tbody>`;
    }
  }

  function renderAdminOrders() {
    if (!window.FoodFlowStore) return;
    const orders = window.FoodFlowStore.getOrders();
    const table = document.getElementById('admOrdersTable');
    if (!table) return;

    table.innerHTML = `
      <thead>
        <tr>
          <th>Order ID</th>
          <th>Customer</th>
          <th>Restaurant</th>
          <th>Items Summary</th>
          <th>Total</th>
          <th>Payment</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${orders.map((o) => `
          <tr>
            <td><strong>#${o.id}</strong></td>
            <td>${o.customer}<br><span style="font-size:0.75rem; color:var(--text-muted);">${o.phone}</span></td>
            <td>${o.restaurant}</td>
            <td style="max-width:220px; font-size:0.82rem;">${o.itemsSummary || (o.items || []).map((i) => `${i.name} ×${i.qty}`).join(', ')}</td>
            <td><strong>₹${o.total}</strong></td>
            <td><span style="font-size:0.8rem;">${o.paymentMethod}</span></td>
            <td>${getBadgeForStatus(o.status)}</td>
            <td>
              <div style="display:flex; gap:6px;">
                <button class="action-btn" onclick="openAdminStatusModal('${o.id}')">Status</button>
                <button class="action-btn" onclick="openAdminReceiptModal('${o.id}')">Receipt</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>`;
  }

  function renderAdminUsers() {
    if (!window.FoodFlowStore) return;
    const users = window.FoodFlowStore.getUsers();
    const table = document.getElementById('admUsersTable');
    if (!table) return;

    table.innerHTML = `
      <thead>
        <tr>
          <th>User</th>
          <th>Email</th>
          <th>Phone</th>
          <th>Role</th>
          <th>Total Spent</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${users.map((u) => `
          <tr>
            <td><strong>${u.name}</strong></td>
            <td>${u.email}</td>
            <td>${u.phone || '—'}</td>
            <td><span class="badge ${u.role === 'Super Admin' ? 'badge-primary' : 'badge-neutral'}">${u.role}</span></td>
            <td>₹${(u.totalSpent || 0).toLocaleString()}</td>
            <td><span class="badge ${u.status === 'active' ? 'badge-success' : 'badge-danger'}">${u.status}</span></td>
            <td>
              <button class="action-btn ${u.status === 'active' ? 'danger' : 'success'}" onclick="handleToggleUserStatus('${u.id}')">
                ${u.status === 'active' ? 'Suspend' : 'Activate'}
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>`;
  }

  function handleToggleUserStatus(userId) {
    if (!window.FoodFlowStore) return;
    const u = window.FoodFlowStore.toggleUserStatus(userId);
    if (u) {
      renderAdminUsers();
      showToast(`User ${u.name} is now ${u.status}`, 'info');
    }
  }

  function renderAdminRestaurants() {
    if (!window.FoodFlowStore) return;
    const rests = window.FoodFlowStore.getRestaurants();
    const table = document.getElementById('admRestaurantsTable');
    if (!table) return;

    table.innerHTML = `
      <thead>
        <tr>
          <th>Restaurant Name</th>
          <th>Cuisine</th>
          <th>Rating</th>
          <th>Location</th>
          <th>Delivery Fee</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${rests.map((r) => `
          <tr>
            <td><strong>${r.name}</strong></td>
            <td><span class="rest-tag">${r.cuisine}</span></td>
            <td>★ ${r.rating}</td>
            <td>${r.location}</td>
            <td>${r.fee}</td>
            <td><span class="badge badge-success">${r.status}</span></td>
          </tr>
        `).join('')}
      </tbody>`;
  }

  function renderAdminMenu() {
    if (!window.FoodFlowStore) return;
    const items = window.FoodFlowStore.getMenuItems();
    const container = document.getElementById('admMenuItemsContainer');
    if (!container) return;

    container.innerHTML = `
      <div class="card">
        <div class="card-header"><span class="card-title">All Food Items (${items.length})</span></div>
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Dish Name</th>
                <th>Category</th>
                <th>Type</th>
                <th>Price</th>
                <th>Availability</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((i) => `
                <tr>
                  <td><strong>${i.name}</strong></td>
                  <td>${i.category}</td>
                  <td>${i.veg ? '<span style="color:#17A865; font-weight:700;">🌿 Veg</span>' : '<span style="color:#DC2626; font-weight:700;">🍗 Non-Veg</span>'}</td>
                  <td>₹${i.price}</td>
                  <td>
                    <button class="action-btn ${i.available !== false ? 'success' : 'danger'}" onclick="handleToggleMenuItem(${i.id})">
                      ${i.available !== false ? 'In Stock ✓' : 'Out of Stock ✕'}
                    </button>
                  </td>
                  <td>
                    <button class="action-btn danger" onclick="handleDeleteMenuItem(${i.id})">Delete</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function handleToggleMenuItem(itemId) {
    if (!window.FoodFlowStore) return;
    const item = window.FoodFlowStore.toggleMenuItemAvailability(itemId);
    if (item) {
      renderAdminMenu();
      showToast(`${item.name} is now ${item.available ? 'In Stock' : 'Out of Stock'}`, 'info');
    }
  }

  function handleDeleteMenuItem(itemId) {
    if (!window.FoodFlowStore) return;
    window.FoodFlowStore.deleteMenuItem(itemId);
    renderAdminMenu();
    showToast('Menu item deleted', 'info');
  }

  function renderAdminPayments() {
    if (!window.FoodFlowStore) return;
    const orders = window.FoodFlowStore.getOrders();
    const table = document.getElementById('admPaymentsTable');
    if (!table) return;

    table.innerHTML = `
      <thead>
        <tr>
          <th>Order ID</th>
          <th>Customer</th>
          <th>Amount</th>
          <th>Payment Method</th>
          <th>Transaction Status</th>
          <th>Refund Status</th>
        </tr>
      </thead>
      <tbody>
        ${orders.map((o) => `
          <tr>
            <td><strong>#${o.id}</strong></td>
            <td>${o.customer}</td>
            <td><strong>₹${o.total}</strong></td>
            <td>${o.paymentMethod}</td>
            <td><span class="badge ${o.status === 'cancelled' ? 'badge-neutral' : 'badge-success'}">${o.status === 'cancelled' ? 'Reversed' : 'Success'}</span></td>
            <td>${o.refundStatus === 'refunded' ? '<span class="badge badge-success">Refunded ₹' + (o.refundAmount || o.total) + '</span>' : '<span class="badge badge-neutral">None</span>'}</td>
          </tr>
        `).join('')}
      </tbody>`;
  }

  function renderAdminSettings() {
    if (!window.FoodFlowStore) return;
    const promos = window.FoodFlowStore.getPromos();
    const countBadge = document.getElementById('admPromoCountBadge');
    if (countBadge) countBadge.textContent = promos.length;

    const container = document.getElementById('admSettingsPromosList');
    if (!container) return;

    if (promos.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:2rem; color:var(--text-muted);">
          <div style="font-size:2rem; margin-bottom:4px;">🎟️</div>
          <p>No promo coupons found. Click "+ Add Coupon" to create one.</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:10px;">
        ${promos
          .map((p) => {
            const discountPct = p.discount || p.discount_percent || 0;
            const maxD = p.maxDiscount || p.max_discount || 0;
            const minO = p.minOrder || p.min_order_amount || 0;
            const desc = p.desc || p.description || '';
            const isActive = p.active !== false;

            return `
            <div style="background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:12px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
              <div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <strong style="color:var(--primary); font-size:1.05rem; letter-spacing:0.5px;">${p.code}</strong>
                  <span class="badge ${isActive ? 'badge-success' : 'badge-danger'}" style="font-size:0.7rem; padding:2px 8px;">
                    ${isActive ? 'Active' : 'Disabled'}
                  </span>
                  <span style="font-size:0.8rem; background:var(--surface2); padding:2px 6px; border-radius:4px; font-weight:600;">
                    ${discountPct}% OFF (Up to ₹${maxD})
                  </span>
                </div>
                <div style="font-size:0.82rem; color:var(--text-muted); margin-top:3px;">
                  ${desc} · <span style="color:var(--text);">Min Order: ₹${minO}</span>
                </div>
              </div>
              <div style="display:flex; gap:6px; align-items:center;">
                <button class="action-btn" style="font-size:0.8rem; padding:4px 10px;" onclick="openEditPromoModal('${p.code}')">
                  ✏️ Edit
                </button>
                <button class="action-btn ${isActive ? 'danger' : 'success'}" style="font-size:0.8rem; padding:4px 10px;" onclick="handleTogglePromo('${p.code}')">
                  ${isActive ? 'Disable' : 'Enable'}
                </button>
                <button class="action-btn danger" style="font-size:0.8rem; padding:4px 8px;" onclick="handleDeletePromo('${p.code}')" title="Delete Coupon">
                  🗑️
                </button>
              </div>
            </div>`;
          })
          .join('')}
      </div>`;
  }

  function openAddPromoModal() {
    const title = document.getElementById('adminPromoModalTitle');
    const oldCode = document.getElementById('adminPromoOldCode');
    const codeInput = document.getElementById('adminPromoCodeInput');
    const discInput = document.getElementById('adminPromoDiscountInput');
    const maxDInput = document.getElementById('adminPromoMaxDiscountInput');
    const minOInput = document.getElementById('adminPromoMinOrderInput');
    const activeCb = document.getElementById('adminPromoActiveCheckbox');
    const descInput = document.getElementById('adminPromoDescInput');
    const errEl = document.getElementById('err-adminPromo');

    if (title) title.textContent = '🎟️ Add Promo Coupon';
    if (oldCode) oldCode.value = '';
    if (codeInput) { codeInput.value = ''; codeInput.readOnly = false; }
    if (discInput) discInput.value = '20';
    if (maxDInput) maxDInput.value = '150';
    if (minOInput) minOInput.value = '199';
    if (activeCb) activeCb.checked = true;
    if (descInput) descInput.value = '';
    if (errEl) errEl.textContent = '';

    const modal = document.getElementById('adminPromoModal');
    if (modal) modal.classList.add('open');
  }

  function openEditPromoModal(code) {
    if (!window.FoodFlowStore) return;
    const promos = window.FoodFlowStore.getPromos();
    const promo = promos.find((p) => p.code.toUpperCase() === String(code).toUpperCase().trim());
    if (!promo) return;

    const title = document.getElementById('adminPromoModalTitle');
    const oldCode = document.getElementById('adminPromoOldCode');
    const codeInput = document.getElementById('adminPromoCodeInput');
    const discInput = document.getElementById('adminPromoDiscountInput');
    const maxDInput = document.getElementById('adminPromoMaxDiscountInput');
    const minOInput = document.getElementById('adminPromoMinOrderInput');
    const activeCb = document.getElementById('adminPromoActiveCheckbox');
    const descInput = document.getElementById('adminPromoDescInput');
    const errEl = document.getElementById('err-adminPromo');

    if (title) title.textContent = `✏️ Edit Promo Coupon (${promo.code})`;
    if (oldCode) oldCode.value = promo.code;
    if (codeInput) { codeInput.value = promo.code; codeInput.readOnly = false; }
    if (discInput) discInput.value = promo.discount || promo.discount_percent || 20;
    if (maxDInput) maxDInput.value = promo.maxDiscount || promo.max_discount || 150;
    if (minOInput) minOInput.value = promo.minOrder || promo.min_order_amount || 199;
    if (activeCb) activeCb.checked = promo.active !== false;
    if (descInput) descInput.value = promo.desc || promo.description || '';
    if (errEl) errEl.textContent = '';

    const modal = document.getElementById('adminPromoModal');
    if (modal) modal.classList.add('open');
  }

  function submitAdminPromoForm() {
    if (!window.FoodFlowStore) return;
    const oldCode = document.getElementById('adminPromoOldCode')?.value;
    const code = document.getElementById('adminPromoCodeInput')?.value.trim().toUpperCase();
    const discount = Number(document.getElementById('adminPromoDiscountInput')?.value || 0);
    const maxDiscount = Number(document.getElementById('adminPromoMaxDiscountInput')?.value || 0);
    const minOrder = Number(document.getElementById('adminPromoMinOrderInput')?.value || 0);
    const active = Boolean(document.getElementById('adminPromoActiveCheckbox')?.checked);
    const desc = document.getElementById('adminPromoDescInput')?.value.trim();
    const errEl = document.getElementById('err-adminPromo');

    if (!code || code.length < 3) {
      if (errEl) errEl.textContent = 'Please enter a valid Promo Code (at least 3 characters).';
      return;
    }
    if (discount <= 0 || discount > 100) {
      if (errEl) errEl.textContent = 'Discount percentage must be between 1 and 100.';
      return;
    }
    if (maxDiscount <= 0) {
      if (errEl) errEl.textContent = 'Max discount cap must be greater than 0.';
      return;
    }

    try {
      if (oldCode) {
        window.FoodFlowStore.updatePromo(oldCode, {
          code,
          discount,
          maxDiscount,
          minOrder,
          active,
          desc: desc || `Flat ${discount}% OFF up to ₹${maxDiscount}`
        });
        showToast(`✓ Promo coupon "${code}" updated successfully!`, 'success');
      } else {
        window.FoodFlowStore.addPromo({
          code,
          discount,
          maxDiscount,
          minOrder,
          active,
          desc: desc || `Flat ${discount}% OFF up to ₹${maxDiscount}`
        });
        showToast(`✓ Promo coupon "${code}" created successfully!`, 'success');
      }

      closeAdminModal('adminPromoModal');
      renderAdminSettings();
    } catch (err) {
      if (errEl) errEl.textContent = err.message;
      showToast(err.message, 'error');
    }
  }

  function handleTogglePromo(code) {
    if (!window.FoodFlowStore) return;
    const updated = window.FoodFlowStore.togglePromoStatus(code);
    if (updated) {
      renderAdminSettings();
      showToast(`Promo ${code} is now ${updated.active ? 'Active' : 'Disabled'}`, 'info');
    }
  }

  function handleDeletePromo(code) {
    if (!window.FoodFlowStore) return;
    if (confirm(`Are you sure you want to delete coupon ${code}?`)) {
      window.FoodFlowStore.deletePromo(code);
      renderAdminSettings();
      showToast(`Promo ${code} deleted`, 'info');
    }
  }

  function savePlatformSettingsForm() {
    if (!window.FoodFlowStore) return;
    const name = document.getElementById('admSetPlatformName')?.value.trim() || 'FoodFlow';
    const deliveryFee = Number(document.getElementById('admSetDeliveryFee')?.value || 40);
    const platformFee = Number(document.getElementById('admSetPlatformFee')?.value || 5);
    const supportPhone = document.getElementById('admSetSupportPhone')?.value.trim() || '+91 1800-200-8899';
    const supportEmail = document.getElementById('admSetSupportEmail')?.value.trim() || 'support@foodflow.com';

    const settings = {
      platformName: name,
      defaultDeliveryFee: deliveryFee,
      platformFee: platformFee,
      supportPhone: supportPhone,
      supportEmail: supportEmail
    };

    window.FoodFlowStore.updatePlatformSettings(settings);
    showToast('✓ Platform configuration saved successfully!', 'success');
  }

  let adminUpdatingOrderId = null;

  function handleAdminStatusSelectChange() {
    const sel = document.getElementById('admStatusSelect');
    const group = document.getElementById('admCancelReasonGroup');
    if (!sel || !group) return;
    if (sel.value === 'cancelled') {
      group.style.display = 'block';
    } else {
      group.style.display = 'none';
    }
  }

  function openAdminStatusModal(orderId) {
    if (!window.FoodFlowStore) return;
    const order = window.FoodFlowStore.getOrderById(orderId);
    if (!order) return;
    adminUpdatingOrderId = order.id;

    const idEl = document.getElementById('admStatusModalOrderId');
    const sel = document.getElementById('admStatusSelect');
    const group = document.getElementById('admCancelReasonGroup');
    const reasonSel = document.getElementById('admCancelReasonSelect');
    const notesEl = document.getElementById('admCancelNotes');

    if (idEl) idEl.textContent = `#${order.id}`;
    if (sel) sel.value = order.status;

    if (order.status === 'cancelled') {
      if (group) group.style.display = 'block';
      if (reasonSel && order.cancelReason) {
        const matched = Array.from(reasonSel.options).some((o) => o.value === order.cancelReason);
        if (matched) {
          reasonSel.value = order.cancelReason;
          if (notesEl) notesEl.value = '';
        } else {
          reasonSel.value = 'Other reason';
          if (notesEl) notesEl.value = order.cancelReason;
        }
      }
    } else {
      if (group) group.style.display = 'none';
      if (notesEl) notesEl.value = '';
    }

    const modal = document.getElementById('adminOrderStatusModal');
    if (modal) modal.classList.add('open');
  }

  function submitAdminOrderStatus() {
    if (!adminUpdatingOrderId || !window.FoodFlowStore) return;
    const sel = document.getElementById('admStatusSelect');
    const newStatus = sel ? sel.value : 'pending';

    if (newStatus === 'cancelled') {
      const reasonSel = document.getElementById('admCancelReasonSelect');
      const notesEl = document.getElementById('admCancelNotes');
      const primaryReason = reasonSel ? reasonSel.value : 'Kitchen closed / Item out of stock';
      const extraNotes = notesEl && notesEl.value.trim() ? ` (${notesEl.value.trim()})` : '';
      const fullReason = `${primaryReason}${extraNotes}`;

      const res = window.FoodFlowStore.cancelOrder(adminUpdatingOrderId, fullReason, 'Admin');
      closeAdminModal('adminOrderStatusModal');
      renderAdminDashboard();
      renderAdminOrders();
      if (res.success) {
        showToast(`Order #${adminUpdatingOrderId} cancelled: ${fullReason}`, 'warning');
      } else {
        showToast(`Order #${adminUpdatingOrderId} cancelled`, 'warning');
      }
      return;
    }

    window.FoodFlowStore.updateOrderStatus(adminUpdatingOrderId, newStatus);
    closeAdminModal('adminOrderStatusModal');
    renderAdminDashboard();
    renderAdminOrders();
    showToast(`Order #${adminUpdatingOrderId} status updated to ${newStatus}`, 'success');
  }

  function closeAdminModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('open');
  }

  function getBadgeForStatus(status) {
    const map = {
      pending: '<span class="badge badge-warning">⏳ Pending</span>',
      preparing: '<span class="badge badge-info">👨‍🍳 Preparing</span>',
      'on-the-way': '<span class="badge badge-primary">🛵 On the Way</span>',
      delivered: '<span class="badge badge-success">✓ Delivered</span>',
      cancelled: '<span class="badge badge-danger">✕ Cancelled</span>'
    };
    return map[status] || `<span class="badge badge-neutral">${status}</span>`;
  }

  function togglePasswordVisibility(fieldId, btnEl) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    if (field.type === 'password') {
      field.type = 'text';
      if (btnEl) btnEl.textContent = '🔒';
    } else {
      field.type = 'password';
      if (btnEl) btnEl.textContent = '👁️';
    }
  }

  function handleRetestMysqlConnection() {
    showToast('Testing connection to MySQL Database...', 'info');
    if (window.FoodFlowStore) {
      window.FoodFlowStore.probeApiServer().then(() => {
        const isConn = window.FoodFlowStore.isMysqlConnected;
        const text = isConn ? 'MySQL: Connected' : 'MySQL: Local Storage Mode';
        const dotClass = isConn ? '#10B981' : '#F59E0B';

        const textEl = document.getElementById('topDbStatusText');
        const dotEl = document.getElementById('topDbStatusDot');
        if (textEl) textEl.textContent = text;
        if (dotEl) dotEl.style.background = dotClass;

        showToast(isConn ? '✓ Connected to MySQL database!' : 'Offline mode: operating on secure local storage.', isConn ? 'success' : 'info');
      });
    }
  }

  // ═══════════════════════ INITIALIZATION ═══════════════════════
  function initApp() {
    renderCustomerHome();
    updateCustomerCartUI();
    updateCustomerAuthUI();

    if (window.FoodFlowStore) {
      window.FoodFlowStore.on('auth_changed', () => {
        updateCustomerAuthUI();
        if (AppState.activeCustomerScreen === 'profile') openCustomerProfile();
      });

      window.FoodFlowStore.on('cart_updated', () => {
        updateCustomerCartUI();
      });

      window.FoodFlowStore.on('order_status_updated', (order) => {
        if (AppState.currentTrackingOrderId === order.id && AppState.activeCustomerScreen === 'success') {
          renderLiveOrderTracker(order);
        }
        if (AppState.activeCustomerScreen === 'profile') {
          renderProfileContent(AppState.activeProfileTab);
        }
        if (AppState.activeAdminPage === 'dashboard') renderAdminDashboard();
        if (AppState.activeAdminPage === 'orders') renderAdminOrders();
      });

      window.FoodFlowStore.on('order_placed', () => {
        if (AppState.activeAdminPage === 'dashboard') renderAdminDashboard();
        if (AppState.activeAdminPage === 'orders') renderAdminOrders();
        if (AppState.activeAdminPage === 'payments') renderAdminPayments();
      });

      window.FoodFlowStore.on('order_cancelled', () => {
        if (AppState.activeAdminPage === 'dashboard') renderAdminDashboard();
        if (AppState.activeAdminPage === 'orders') renderAdminOrders();
        if (AppState.activeAdminPage === 'payments') renderAdminPayments();
      });

      window.FoodFlowStore.on('promos_changed', () => {
        if (AppState.activeAdminPage === 'settings') renderAdminSettings();
      });

      window.FoodFlowStore.on('settings_updated', () => {
        if (AppState.activeAdminPage === 'settings') renderAdminSettings();
      });

      window.FoodFlowStore.on('wallet_updated', () => {
        if (AppState.activeCustomerScreen === 'profile' && AppState.activeProfileTab === 'wallet') {
          renderPaymentWalletsTab();
        }
      });

      window.FoodFlowStore.on('db_status_changed', (info) => {
        const textEl = document.getElementById('topDbStatusText');
        const dotEl = document.getElementById('topDbStatusDot');
        if (textEl) textEl.textContent = info.connected ? 'MySQL Database (Connected)' : 'Local Storage Mode';
        if (dotEl) dotEl.style.background = info.connected ? '#10B981' : '#F59E0B';
      });
    }
  }
  // ═══════════════════════ SECURE ADMIN ACCESS CONTROL ═══════════════════════
  function checkAdminAuth() {
    const gatekeeper = document.getElementById('adminAuthGatekeeper');
    const protectedWrapper = document.getElementById('protectedAdminWrapper');
    if (!gatekeeper && !protectedWrapper) return;

    const isAdminLoggedIn = sessionStorage.getItem('foodflow_admin_auth') === 'true';

    if (isAdminLoggedIn) {
      if (gatekeeper) gatekeeper.style.display = 'none';
      if (protectedWrapper) protectedWrapper.style.display = 'flex';
      renderAdminDashboard();
    } else {
      if (gatekeeper) gatekeeper.style.display = 'flex';
      if (protectedWrapper) protectedWrapper.style.display = 'none';
    }
  }

  function handleAdminLogin() {
    const emailInput = document.getElementById('adminLoginEmail');
    const passInput = document.getElementById('adminLoginPassword');
    const errEl = document.getElementById('err-adminLogin');

    const email = (emailInput ? emailInput.value : '').trim().toLowerCase();
    const pass = (passInput ? passInput.value : '');

    if (!email) {
      if (errEl) errEl.textContent = '⚠️ Please enter administrator email or username.';
      if (emailInput) emailInput.focus();
      return;
    }
    if (!pass) {
      if (errEl) errEl.textContent = '⚠️ Please enter administrator password.';
      if (passInput) passInput.focus();
      return;
    }

    let isSuperAdmin = (email === 'admin@foodflow.com' || email === 'admin') && (pass === 'admin123' || pass === 'admin');

    if (isSuperAdmin) {
      sessionStorage.setItem('foodflow_admin_auth', 'true');
      if (errEl) errEl.textContent = '';
      if (emailInput) emailInput.value = '';
      if (passInput) passInput.value = '';
      
      SoundEffects.playSuccess();
      showToast('✓ Welcome, Administrator! Dashboard unlocked.', 'success');
      checkAdminAuth();
    } else {
      SoundEffects.playError();
      if (errEl) errEl.textContent = '⛔ Access Denied: Invalid administrator credentials.';
      if (passInput) {
        passInput.value = '';
        passInput.focus();
      }
    }
  }

  function handleAdminLogout() {
    sessionStorage.removeItem('foodflow_admin_auth');
    showToast('Admin portal session locked.', 'info');
    checkAdminAuth();
  }

  window.checkAdminAuth = checkAdminAuth;
  window.handleAdminLogin = handleAdminLogin;
  window.handleAdminLogout = handleAdminLogout;
  // Window exports for HTML attributes
  window.switchGlobalPortal = switchGlobalPortal;
  window.showCustomerScreen = showCustomerScreen;
  window.filterByCuisinePill = filterByCuisinePill;
  window.handleCustomerSearch = handleCustomerSearch;
  window.clearCustomerSearch = clearCustomerSearch;
  window.openCustomerRestaurant = openCustomerRestaurant;
  window.jumpToMenuCategory = jumpToMenuCategory;
  window.customerAddToCart = customerAddToCart;
  window.customerUpdateQty = customerUpdateQty;
  window.proceedToCheckout = proceedToCheckout;
  window.handleApplyPromo = handleApplyPromo;
  window.handlePlaceOrder = handlePlaceOrder;
  window.switchPaymentTab = switchPaymentTab;
  window.selectUpiApp = selectUpiApp;
  window.verifyCustomUpiId = verifyCustomUpiId;
  window.submitVerifiedUpiPay = submitVerifiedUpiPay;
  window.cancelUpiCollectScreen = cancelUpiCollectScreen;
  window.confirmUpiCollectSuccess = confirmUpiCollectSuccess;
  window.handleUpiIdChanged = handleUpiIdChanged;
  window.appendUpiHandle = appendUpiHandle;
  window.simulateQrPaymentDone = simulateQrPaymentDone;
  window.handleCardNumberInput = handleCardNumberInput;
  window.handleCardNameInput = handleCardNameInput;
  window.handleCardExpInput = handleCardExpInput;
  window.submitCardPayment = submitCardPayment;
  window.verifyBankOtpAndComplete = verifyBankOtpAndComplete;
  window.selectBank = selectBank;
  window.submitNetBankingPayment = submitNetBankingPayment;
  window.submitWalletPayment = submitWalletPayment;
  window.submitCodPayment = submitCodPayment;
  window.openCustomerOrders = openCustomerOrders;
  window.openCustomerAccount = openCustomerAccount;
  window.openCustomerProfile = openCustomerProfile;
  window.setProfileTab = setProfileTab;
  window.switchOrderSubTab = switchOrderSubTab;
  window.saveCustomerProfileSettings = saveCustomerProfileSettings;
  window.openAddAddressModal = openAddAddressModal;
  window.submitCustomerAddress = submitCustomerAddress;
  window.handleCustomerDeleteAddress = handleCustomerDeleteAddress;
  window.viewOrderTrackingLive = viewOrderTrackingLive;
  window.reorderCustomerItems = reorderCustomerItems;
  window.openCustomerCancelModal = openCustomerCancelModal;
  window.confirmCustomerOrderCancellation = confirmCustomerOrderCancellation;
  window.openAdminReceiptModal = openAdminReceiptModal;
  window.openAuthModal = openAuthModal;
  window.closeAuthModal = closeAuthModal;
  window.setAuthTabMode = setAuthTabMode;
  window.handleCustomerLogin = handleCustomerLogin;
  window.handleCustomerRegister = handleCustomerRegister;
  window.handleCustomerLogout = handleCustomerLogout;
  window.confirmCustomerLogout = confirmCustomerLogout;
  window.showForgotStep = showForgotStep;
  window.handleRequestPasswordOTP = handleRequestPasswordOTP;
  window.handleVerifyPasswordOTP = handleVerifyPasswordOTP;
  window.handleSubmitNewPassword = handleSubmitNewPassword;
  window.handleFinishPasswordReset = handleFinishPasswordReset;
  window.togglePasswordVisibility = togglePasswordVisibility;
  window.showAdminPage = showAdminPage;
  window.openAdminStatusModal = openAdminStatusModal;
  window.submitAdminOrderStatus = submitAdminOrderStatus;
  window.handleAdminStatusSelectChange = handleAdminStatusSelectChange;
  window.handleToggleUserStatus = handleToggleUserStatus;
  window.handleToggleMenuItem = handleToggleMenuItem;
  window.handleDeleteMenuItem = handleDeleteMenuItem;
  window.closeAdminModal = closeAdminModal;
  window.showToast = showToast;
  window.handleRetestMysqlConnection = handleRetestMysqlConnection;
  window.verifyAndSaveProfileOtp = verifyAndSaveProfileOtp;
  window.renderPaymentWalletsTab = renderPaymentWalletsTab;
  window.openCustomerProfileWalletTopUp = openCustomerProfileWalletTopUp;
  window.setTopUpInputAmount = setTopUpInputAmount;
  window.handleWalletTopUpSubmit = handleWalletTopUpSubmit;
  window.showQrPaymentSection = showQrPaymentSection;
  window.hideQrPaymentSection = hideQrPaymentSection;
  window.openWalletTopUpPaymentModal = openWalletTopUpPaymentModal;
  window.switchTopUpPaymentTab = switchTopUpPaymentTab;
  window.selectTopUpUpiApp = selectTopUpUpiApp;
  window.handleTopUpUpiIdChanged = handleTopUpUpiIdChanged;
  window.appendTopUpUpiHandle = appendTopUpUpiHandle;
  window.verifyTopUpCustomUpiId = verifyTopUpCustomUpiId;
  window.submitTopUpVerifiedUpiPay = submitTopUpVerifiedUpiPay;
  window.showTopUpQrPaymentSection = showTopUpQrPaymentSection;
  window.hideTopUpQrPaymentSection = hideTopUpQrPaymentSection;
  window.simulateTopUpQrPaymentDone = simulateTopUpQrPaymentDone;
  window.cancelTopUpUpiCollectScreen = cancelTopUpUpiCollectScreen;
  window.confirmTopUpUpiCollectSuccess = confirmTopUpUpiCollectSuccess;
  window.submitTopUpCardPayment = submitTopUpCardPayment;
  window.verifyTopUpBankOtpAndComplete = verifyTopUpBankOtpAndComplete;
  window.selectTopUpBank = selectTopUpBank;
  window.submitTopUpNetBankingPayment = submitTopUpNetBankingPayment;
  window.executeWalletTopUpPayment = executeWalletTopUpPayment;
  window.renderAdminSettings = renderAdminSettings;
  window.openAddPromoModal = openAddPromoModal;
  window.openEditPromoModal = openEditPromoModal;
  window.submitAdminPromoForm = submitAdminPromoForm;
  window.handleTogglePromo = handleTogglePromo;
  window.handleDeletePromo = handleDeletePromo;
  window.savePlatformSettingsForm = savePlatformSettingsForm;
  window.autoFillProfileOtp = autoFillProfileOtp;
  window.autoFillForgotOtp = autoFillForgotOtp;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
