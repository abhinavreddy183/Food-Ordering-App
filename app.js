/**
 * FoodFlow - Core Application Controller (Crash-Proof, High-Performance & Fully Bound)
 * All click, form, search, modal and filter handlers are directly bound to the global window scope.
 */

(function () {
  'use strict';

  // Global App State
  const AppState = {
    activePortal: 'customer',
    activeCustomerScreen: 'home',
    activeAdminPage: 'dashboard',
    selectedRestaurant: null,
    activeCuisineFilter: 'All',
    searchQuery: '',
    appliedPromo: null,
    currentTrackingOrderId: null,
    activeProfileTab: 'orders'
  };

  // Web Audio API Synthesizer for chimes
  const SoundEffects = {
    playChime(freq = 587.33, type = 'sine') {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } catch (e) {}
    },
    playSuccess() {
      this.playChime(523.25);
    },
    playAlert() {
      this.playChime(440, 'triangle');
    }
  };

  // Global Toast System
  function showToast(message, type = 'info') {
    const toast = document.getElementById('globalToast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast show';
    if (type === 'success') {
      toast.style.borderLeftColor = 'var(--success)';
      SoundEffects.playSuccess();
    } else if (type === 'error') {
      toast.style.borderLeftColor = 'var(--danger)';
      SoundEffects.playAlert();
    } else {
      toast.style.borderLeftColor = 'var(--primary)';
    }

    setTimeout(() => {
      if (toast) toast.classList.remove('show');
    }, 3500);
  }

  // ═══════════════════════ PORTAL SWITCHING & DEMO ROLE ═══════════════════════
  function switchPortal(portalName) {
    AppState.activePortal = portalName;

    document.querySelectorAll('.switcher-tab').forEach((tab) => {
      const target = tab.getAttribute('data-portal');
      tab.classList.toggle('active', target === portalName);
    });

    const custContainer = document.getElementById('customerPortalContainer');
    const adminContainer = document.getElementById('adminPortalContainer');
    const docsContainer = document.getElementById('docsPortalContainer');
    const testsContainer = document.getElementById('testsPortalContainer');

    if (custContainer) custContainer.style.display = portalName === 'customer' ? 'block' : 'none';
    if (adminContainer) adminContainer.style.display = portalName === 'admin' ? 'block' : 'none';
    if (docsContainer) docsContainer.style.display = portalName === 'docs' ? 'block' : 'none';
    if (testsContainer) testsContainer.style.display = portalName === 'tests' ? 'block' : 'none';

    if (portalName === 'admin') {
      renderAdminDashboard();
      renderAdminOrders();
      renderAdminUsers();
      renderAdminRestaurants();
      renderAdminMenu();
      renderAdminPayments();
      renderAdminSettingsPromos();
      updateAdminBadges();
    } else if (portalName === 'customer') {
      renderCustomerHome();
      updateCustomerCartUI();
      updateCustomerAuthUI();
    }

    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {}
  }

  function handleDemoRoleSwitch(roleValue) {
    if (!window.FoodFlowStore) return;
    if (roleValue === 'super_admin') {
      window.FoodFlowStore.loginUser('admin@foodflow.com', 'Super Admin');
      showToast('Switched to Super Admin (admin@foodflow.com)', 'success');
      switchPortal('admin');
    } else if (roleValue === 'rest_admin') {
      window.FoodFlowStore.loginUser('admin@spicegarden.com', 'Restaurant Admin');
      showToast('Switched to Spice Garden Admin', 'success');
      switchPortal('admin');
    } else if (roleValue === 'customer_ravi') {
      window.FoodFlowStore.loginUser('ravi@example.com', 'Customer');
      showToast('Switched to Customer: Ravi Kumar', 'success');
      switchPortal('customer');
    } else if (roleValue === 'customer_priya') {
      window.FoodFlowStore.loginUser('priya@example.com', 'Customer');
      showToast('Switched to Customer: Priya Sharma', 'success');
      switchPortal('customer');
    }
  }

  // ═══════════════════════ CUSTOMER PORTAL CONTROLLERS ═══════════════════════
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
    let filtered = restaurants.filter((r) => r.status === 'active');

    if (AppState.activeCuisineFilter !== 'All') {
      filtered = filtered.filter((r) => r.cuisine === AppState.activeCuisineFilter);
    }

    if (AppState.searchQuery.trim() !== '') {
      const q = AppState.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.cuisine.toLowerCase().includes(q) ||
          (r.desc && r.desc.toLowerCase().includes(q))
      );
    }

    const grid = document.getElementById('restaurantsGrid');
    if (!grid) return;

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding:3rem; color:var(--text-muted);">
          <div style="font-size:3rem; margin-bottom:0.5rem;">🔍</div>
          <h3>No restaurants found</h3>
          <p>Try searching for a different cuisine or keyword.</p>
          <button class="btn-primary" style="margin-top:1rem;" onclick="filterByCuisinePill('All', null)">Reset Filter</button>
        </div>`;
      return;
    }

    grid.innerHTML = filtered
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
            <span>🕐 ${r.deliveryTime} min</span>
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

  function filterByCuisinePill(cuisine, el) {
    AppState.activeCuisineFilter = cuisine;
    document.querySelectorAll('.cat-pill').forEach((p) => p.classList.remove('active'));
    if (el) {
      el.classList.add('active');
    } else {
      document.querySelectorAll('.cat-pill').forEach((p) => {
        if (p.textContent.trim().includes(cuisine)) p.classList.add('active');
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
            <span>🕐 <strong>${rest.deliveryTime} mins</strong></span>
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

    // Category Nav Pills
    const catNav = document.getElementById('menuCatNav');
    if (catNav) {
      catNav.innerHTML = categories
        .map(
          (cat, idx) => `
        <button class="menu-cat-btn ${idx === 0 ? 'active' : ''}" onclick="jumpToMenuCategory('${cat}', this)">${cat}</button>`
        )
        .join('');
    }

    const container = document.getElementById('menuItemsContainer');
    if (!container) return;

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
                const badgesHtml = (item.badges || [])
                  .map(
                    (b) =>
                      `<span class="badge badge-${b}">${b === 'veg' ? '🌿 Veg' : b === 'spicy' ? '🌶️ Spicy' : '⭐ Bestseller'}</span>`
                  )
                  .join(' ');

                return `
                <div class="menu-item ${!isAvailable ? 'unavailable' : ''}" id="cust-menu-item-${item.id}">
                  <div class="item-img-wrap">
                    <img src="${item.image}" alt="${item.name}" loading="lazy">
                  </div>
                  <div class="item-details">
                    <div class="item-name">${item.name} ${item.veg ? '<span style="color:#17A865; font-size:0.8rem;">🌿 Veg</span>' : '<span style="color:#DC2626; font-size:0.8rem;">🍗 Non-Veg</span>'}</div>
                    <div class="item-desc">${item.desc || ''}</div>
                    <div class="item-badges">
                      ${badgesHtml}
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
    const success = window.FoodFlowStore.addToCart(itemId, 1);
    if (success) {
      SoundEffects.playSuccess();
      updateCustomerCartUI();
      if (AppState.selectedRestaurant) {
        renderCustomerMenuItems(AppState.selectedRestaurant);
        renderCustomerSideCart();
      }
    } else {
      showToast('This item is currently unavailable.', 'error');
    }
  }

  function customerUpdateQty(itemId, delta) {
    if (!window.FoodFlowStore) return;
    window.FoodFlowStore.updateCartQty(itemId, delta);
    updateCustomerCartUI();
    if (AppState.selectedRestaurant) {
      renderCustomerMenuItems(AppState.selectedRestaurant);
      renderCustomerSideCart();
    }
  }

  function updateCustomerCartUI() {
    if (!window.FoodFlowStore) return;
    const cart = window.FoodFlowStore.getCart();
    const count = cart.reduce((acc, i) => acc + i.qty, 0);
    const countBadge = document.getElementById('navCartCount');
    if (countBadge) countBadge.textContent = count;
    renderCustomerSideCart();
    renderCheckoutSummary();
  }

  function renderCustomerSideCart() {
    const content = document.getElementById('cartSideItems');
    const footer = document.getElementById('cartSideFooter');
    const restNameLabel = document.getElementById('cartSideRestName');
    if (!content || !footer) return;

    if (!window.FoodFlowStore) return;
    const cart = window.FoodFlowStore.getCart();
    if (restNameLabel) {
      restNameLabel.textContent = AppState.selectedRestaurant ? AppState.selectedRestaurant.name : '';
    }

    if (cart.length === 0) {
      content.innerHTML = `
        <div class="cart-empty">
          <div class="cart-empty-icon">🛒</div>
          <p style="font-weight:600;">Your cart is empty</p>
          <p style="font-size:0.8rem; margin-top:4px;">Add tasty dishes to get started</p>
        </div>`;
      footer.innerHTML = '';
      return;
    }

    content.innerHTML = cart
      .map(
        (item) => `
      <div class="cart-item">
        <img src="${item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=100&q=80'}" class="cart-item-photo" alt="${item.name}">
        <div class="cart-item-name">
          <div>${item.name}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">₹${item.price} each</div>
        </div>
        <div class="cart-item-qty">
          <button class="cart-qty-btn" onclick="customerUpdateQty(${item.id}, -1)">−</button>
          <span style="font-weight:700; min-width:18px; text-align:center;">${item.qty}</span>
          <button class="cart-qty-btn" onclick="customerUpdateQty(${item.id}, 1)">+</button>
        </div>
        <span class="cart-item-price">₹${item.price * item.qty}</span>
      </div>`
      )
      .join('');

    const subtotal = cart.reduce((acc, i) => acc + i.price * i.qty, 0);
    const deliveryFee = AppState.selectedRestaurant ? AppState.selectedRestaurant.feeValue || 0 : 40;
    const platformFee = 5;
    const total = subtotal + deliveryFee + platformFee;

    footer.innerHTML = `
      <div class="cart-row"><span>Subtotal</span><span>₹${subtotal}</span></div>
      <div class="cart-row"><span>Delivery Fee</span><span>${deliveryFee === 0 ? 'Free' : '₹' + deliveryFee}</span></div>
      <div class="cart-row"><span>Platform Fee</span><span>₹${platformFee}</span></div>
      <div class="cart-row total"><span>Total</span><span>₹${total}</span></div>
      <button class="checkout-btn" onclick="proceedToCheckout()">Proceed to Checkout →</button>`;
  }

  function proceedToCheckout() {
    if (!window.FoodFlowStore) return;
    const user = window.FoodFlowStore.getCurrentUser();
    if (!user) {
      openAuthModal('login');
      showToast('Please sign in to place your order', 'info');
      return;
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

  function selectPaymentMethod(element) {
    document.querySelectorAll('.payment-option').forEach((opt) => opt.classList.remove('selected'));
    element.classList.add('selected');
    const radio = element.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;
  }

  // ═══════════════════════ SWIGGY / ZOMATO PAYMENT GATEWAY FLOW ═══════════════════════
  let pendingCheckoutData = null;
  let qrCountdownInterval = null;
  let activeSelectedBank = 'HDFC Bank';
  let activeSelectedUpiApp = 'Google Pay';

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

    const nameInput = document.getElementById('delivName');
    const phoneInput = document.getElementById('delivPhone');
    const addrInput = document.getElementById('delivAddress');
    const noteInput = document.getElementById('delivNotes');

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
      customer: nameInput && nameInput.value.trim() ? nameInput.value.trim() : user.name,
      email: user.email,
      phone: phoneInput && phoneInput.value.trim() ? phoneInput.value.trim() : user.phone,
      restaurantId: AppState.selectedRestaurant ? AppState.selectedRestaurant.id : 1,
      restaurant: AppState.selectedRestaurant ? AppState.selectedRestaurant.name : 'Spice Garden',
      items: [...cart],
      subtotal: subtotal,
      deliveryFee: deliveryFee,
      platformFee: platformFee,
      discount: discount,
      total: total,
      address: addrInput && addrInput.value.trim() ? addrInput.value.trim() : 'Flat 4B, Palm Grove Apartments, Hyderabad',
      notes: noteInput ? noteInput.value.trim() : ''
    };

    openSwiggyPaymentModal(total);
  }

  function openSwiggyPaymentModal(totalAmount) {
    const totalDisp = document.getElementById('pgModalTotalAmount');
    const otpDisp = document.getElementById('otpAmountTag');
    if (totalDisp) totalDisp.textContent = `₹${totalAmount}`;
    if (otpDisp) otpDisp.textContent = `Amount: ₹${totalAmount}`;

    // Reset processing overlay
    const overlay = document.getElementById('pgProcessingOverlay');
    if (overlay) overlay.style.display = 'none';

    // Start 3 min QR Timer
    startQrCountdown(180);

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

  function selectUpiApp(appName) {
    activeSelectedUpiApp = appName;
    executePaymentAndPlaceOrder(`UPI (${appName})`, { app: appName });
  }

  function submitCustomUpiPay() {
    const input = document.getElementById('pgUpiIdInput');
    const val = input ? input.value.trim() : '';
    if (!val || !val.includes('@')) {
      showToast('Please enter a valid UPI ID (e.g. name@okhdfcbank)', 'error');
      return;
    }
    executePaymentAndPlaceOrder(`UPI (${val})`, { vpa: val });
  }

  function appendUpiHandle(handle) {
    const input = document.getElementById('pgUpiIdInput');
    if (!input) return;
    const base = input.value.split('@')[0] || 'user';
    input.value = base + handle;
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
      }
      remaining--;
    }
    tick();
    qrCountdownInterval = setInterval(tick, 1000);
  }

  function simulateQrPaymentDone() {
    executePaymentAndPlaceOrder('UPI (Dynamic QR)', { method: 'QR Scanner' });
  }

  function handleCardNumberInput(input) {
    let val = input.value.replace(/\D/g, '').substring(0, 16);
    let formatted = val.match(/.{1,4}/g)?.join(' ') || val;
    input.value = formatted;

    const mockNum = document.getElementById('cardMockNumber');
    if (mockNum) mockNum.textContent = formatted || '•••• •••• •••• 4242';

    const netIcon = document.getElementById('cardNetworkIcon');
    if (netIcon) {
      if (val.startsWith('4')) netIcon.textContent = 'VISA';
      else if (val.startsWith('5')) netIcon.textContent = 'MASTERCARD';
      else if (val.startsWith('6')) netIcon.textContent = 'RUPAY';
      else netIcon.textContent = 'CARD';
    }
  }

  function handleCardNameInput(input) {
    const mockName = document.getElementById('cardMockName');
    if (mockName) mockName.textContent = input.value.toUpperCase() || 'RAVI KUMAR';
  }

  function handleCardExpInput(input) {
    let val = input.value.replace(/\D/g, '').substring(0, 4);
    if (val.length >= 3) {
      val = val.substring(0, 2) + '/' + val.substring(2);
    }
    input.value = val;
    const mockExp = document.getElementById('cardMockExp');
    if (mockExp) mockExp.textContent = val || '12/28';
  }

  function submitCardPayment() {
    const num = document.getElementById('pgCardNumber');
    const cvv = document.getElementById('pgCardCvv');
    if (!num || num.value.replace(/\s/g, '').length < 15) {
      showToast('Please enter a valid 16-digit card number', 'error');
      return;
    }
    if (!cvv || cvv.value.length < 3) {
      showToast('Please enter a valid 3-digit CVV', 'error');
      return;
    }

    // Open 3D Secure OTP verification
    const cardOtp = document.getElementById('cardOtpModal');
    if (cardOtp) cardOtp.classList.add('open');
  }

  function verifyBankOtpAndComplete() {
    const otpInput = document.getElementById('bankOtpInput');
    if (!otpInput || !otpInput.value) {
      otpInput.value = '123456';
    }
    closeAdminModal('cardOtpModal');
    const cardNum = document.getElementById('pgCardNumber');
    const last4 = cardNum ? cardNum.value.slice(-4) : '4242';
    const network = document.getElementById('cardNetworkIcon') ? document.getElementById('cardNetworkIcon').textContent : 'Visa';
    executePaymentAndPlaceOrder(`Credit Card (${network} •••• ${last4})`, { type: 'card' });
  }

  function selectBank(bankName, cardEl) {
    activeSelectedBank = bankName;
    document.querySelectorAll('.bank-card').forEach((c) => c.classList.remove('selected'));
    if (cardEl) cardEl.classList.add('selected');
  }

  function submitNetBankingPayment() {
    executePaymentAndPlaceOrder(`Net Banking (${activeSelectedBank})`, { bank: activeSelectedBank });
  }

  function submitWalletPayment(walletName) {
    executePaymentAndPlaceOrder(walletName, { wallet: walletName });
  }

  function submitCodPayment() {
    executePaymentAndPlaceOrder('Cash on Delivery', { cod: true });
  }

  function executePaymentAndPlaceOrder(paymentMethodName, meta = {}) {
    const overlay = document.getElementById('pgProcessingOverlay');
    const title = document.getElementById('pgProcessingTitle');
    const desc = document.getElementById('pgProcessingDesc');

    if (overlay) overlay.style.display = 'flex';
    if (title) title.textContent = 'Connecting to Payment Gateway...';
    if (desc) desc.textContent = `Authorizing ₹${pendingCheckoutData.total} via ${paymentMethodName}...`;

    setTimeout(() => {
      if (title) title.textContent = 'Verifying Bank Authorization...';
      setTimeout(() => {
        if (title) title.innerHTML = 'Payment Approved ✓';
        if (desc) desc.textContent = 'Generating tax invoice and confirming order...';

        setTimeout(() => {
          if (qrCountdownInterval) clearInterval(qrCountdownInterval);
          closeAdminModal('swiggyPaymentModal');

          if (!pendingCheckoutData || !window.FoodFlowStore) return;
          pendingCheckoutData.paymentMethod = paymentMethodName;

          const newOrder = window.FoodFlowStore.placeOrder(pendingCheckoutData);
          AppState.currentTrackingOrderId = newOrder.id;

          window.FoodFlowStore.clearCart();
          AppState.appliedPromo = null;
          updateCustomerCartUI();

          const orderIdDisplay = document.getElementById('successOrderIdDisplay');
          if (orderIdDisplay) orderIdDisplay.textContent = `Order ID: #${newOrder.id}`;

          renderLiveOrderTracker(newOrder);
          showCustomerScreen('success');
          showToast(`🎉 Order #${newOrder.id} placed & paid via ${paymentMethodName}!`, 'success');
        }, 600);
      }, 700);
    }, 600);
  }

  // ═══════════════════════ ORDER CANCELLATION & REFUND CONTROLLER ═══════════════════════
  let activeCancelOrderId = null;

  function openCustomerCancelModal(orderId) {
    if (!window.FoodFlowStore) return;
    const order = window.FoodFlowStore.getOrderById(orderId);
    if (!order) return;

    activeCancelOrderId = orderId;
    const idEl = document.getElementById('cancelModalOrderId');
    const amtEl = document.getElementById('cancelModalAmount');
    const payEl = document.getElementById('cancelModalPayment');
    const refundBox = document.getElementById('cancelModalRefundNotice');

    if (idEl) idEl.textContent = `#${order.id}`;
    if (amtEl) amtEl.textContent = `₹${order.total}`;
    if (payEl) payEl.textContent = order.paymentMethod;

    const isPrepaid = order.paymentMethod !== 'Cash on Delivery';

    if (refundBox) {
      if (isPrepaid) {
        refundBox.innerHTML = `
          <div class="refund-card-highlight">
            <div class="refund-icon">💰</div>
            <div>
              <div style="font-weight:700; font-size:0.92rem; color:#166534;">100% Instant Refund Guaranteed</div>
              <div style="font-size:0.82rem; color:#14532D; margin-top:2px;">
                ₹${order.total} will be refunded directly to your original payment source (<strong>${order.paymentMethod}</strong>).
              </div>
            </div>
          </div>`;
      } else {
        refundBox.innerHTML = `
          <div class="cancel-reason-box" style="background:#F0FDF4; border-color:#BBF7D0; color:#166534;">
            ℹ️ This order was placed with <strong>Cash on Delivery</strong>. No payment deduction to refund.
          </div>`;
      }
    }

    const modal = document.getElementById('customerCancelOrderModal');
    if (modal) modal.classList.add('open');
  }

  function confirmCustomerOrderCancellation() {
    if (!activeCancelOrderId || !window.FoodFlowStore) return;
    const reasonSel = document.getElementById('custCancelReasonSelect');
    const notesEl = document.getElementById('custCancelNotes');
    
    let reason = reasonSel ? reasonSel.value : 'Customer requested cancellation';
    if (notesEl && notesEl.value.trim()) {
      reason += ` (${notesEl.value.trim()})`;
    }

    const res = window.FoodFlowStore.cancelOrder(activeCancelOrderId, reason, 'Customer');
    closeAdminModal('customerCancelOrderModal');

    if (AppState.currentTrackingOrderId === activeCancelOrderId) {
      renderLiveOrderTracker(res.order);
    }
    if (AppState.activeCustomerScreen === 'profile') {
      renderProfileContent('orders');
    }

    showToast(`Order #${activeCancelOrderId} cancelled. ${res.message}`, 'error');
  }

  // ═══════════════════════ LIVE ORDER TRACKING ═══════════════════════
  function renderLiveOrderTracker(order) {
    const container = document.getElementById('liveTrackingSteps');
    if (!container || !order) return;

    if (order.status === 'cancelled') {
      const isPrepaid = order.refundStatus === 'refunded';
      container.innerHTML = `
        <div class="cancel-reason-box" style="margin-bottom:1.25rem;">
          <div style="font-weight:800; font-size:1rem; margin-bottom:4px;">❌ This order has been cancelled</div>
          <div><strong>Reason:</strong> ${order.cancelReason || 'Cancelled upon request'}</div>
          <div style="font-size:0.78rem; opacity:0.8; margin-top:2px;">Cancelled by: ${order.cancelledBy || 'Customer'}</div>
        </div>
        ${isPrepaid ? `
        <div class="refund-card-highlight">
          <div class="refund-icon">✓</div>
          <div>
            <div style="font-weight:800; font-size:0.95rem; color:#166534;">💰 ₹${order.refundAmount || order.total} Refunded Successfully</div>
            <div style="font-size:0.82rem; color:#14532D; margin-top:2px;">
              Refund credited to <strong>${order.paymentMethod}</strong>.
            </div>
            <div style="font-size:0.75rem; color:#166534; margin-top:4px;">
              Refund Reference ID: <code>${order.refundId || 'REF-AUTO'}</code>
            </div>
          </div>
        </div>` : `
        <div style="background:var(--surface2); padding:10px 14px; border-radius:8px; font-size:0.84rem; color:var(--text-muted); text-align:center;">
          Cash on Delivery order — no payment deduction required a refund.
        </div>`}
      `;
      return;
    }

    const steps = [
      { key: 'pending', label: 'Order Confirmed', time: 'Received by kitchen', icon: '✓' },
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

  function simulateNextTrackingStep() {
    if (!AppState.currentTrackingOrderId || !window.FoodFlowStore) return;
    const order = window.FoodFlowStore.getOrderById(AppState.currentTrackingOrderId);
    if (!order) return;

    const nextMap = { pending: 'preparing', preparing: 'on-the-way', 'on-the-way': 'delivered', delivered: 'delivered' };
    const nextStatus = nextMap[order.status] || 'preparing';
    window.FoodFlowStore.updateOrderStatus(order.id, nextStatus, 'Simulated advancement');
    showToast(`Simulated status change: ${nextStatus.toUpperCase()}`, 'info');
  }

  // ═══════════════════════ CUSTOMER PROFILE & ORDER HISTORY ═══════════════════════
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
    if (avatarEl) avatarEl.textContent = user.initials || 'U';

    renderProfileContent(AppState.activeProfileTab);
    showCustomerScreen('profile');
  }

  function setProfileTab(tabName, element) {
    AppState.activeProfileTab = tabName;
    document.querySelectorAll('.sidebar-nav-item').forEach((b) => b.classList.remove('active'));
    if (element) element.classList.add('active');
    renderProfileContent(tabName);
  }

  function renderProfileContent(tabName) {
    const container = document.getElementById('profileContentArea');
    if (!container || !window.FoodFlowStore) return;

    const user = window.FoodFlowStore.getCurrentUser();
    if (!user) return;

    if (tabName === 'orders') {
      const userOrders = window.FoodFlowStore.getUserOrders(user.email);
      if (userOrders.length === 0) {
        container.innerHTML = `
          <h2 style="font-size:1.3rem; font-weight:700; margin-bottom:1rem;">My Order History</h2>
          <div style="text-align:center; padding:3rem; background:var(--surface); border-radius:var(--radius); border:1px solid var(--border);">
            <div style="font-size:3rem; margin-bottom:0.5rem;">📋</div>
            <h3>No orders yet</h3>
            <p style="color:var(--text-muted); margin-bottom:1rem;">Discover great dishes from top restaurants!</p>
            <button class="btn-primary" onclick="showCustomerScreen('home')">Browse Restaurants</button>
          </div>`;
        return;
      }

      container.innerHTML = `
        <h2 style="font-size:1.3rem; font-weight:700; margin-bottom:1.25rem;">My Order History (${userOrders.length})</h2>
        ${userOrders
          .map(
            (o) => `
          <div class="order-history-card">
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
                <button class="action-btn" onclick="viewOrderTrackingLive('${o.id}')">📍 Track</button>
                <button class="action-btn" onclick="openAdminReceiptModal('${o.id}')">📄 Receipt</button>
                ${(o.status === 'pending' || o.status === 'preparing') ? `<button class="action-btn danger" onclick="openCustomerCancelModal('${o.id}')">✕ Cancel</button>` : ''}
                <button class="action-btn success" onclick="reorderCustomerItems('${o.id}')">🔄 Reorder</button>
              </div>
            </div>
          </div>`
          )
          .join('')}`;
    } else if (tabName === 'addresses') {
      const addresses = window.FoodFlowStore.getAddresses(user.email);
      container.innerHTML = `
        <h2 style="font-size:1.3rem; font-weight:700; margin-bottom:1.25rem;">Saved Delivery Addresses</h2>
        ${addresses
          .map(
            (a) => `
          <div class="order-history-card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <div style="font-weight:700;">🏠 ${a.label} ${a.isDefault ? '<span class="badge badge-primary">Default</span>' : ''}</div>
            </div>
            <p style="font-size:0.9rem; color:var(--text-muted);">${a.address}</p>
          </div>`
          )
          .join('')}
        <button class="btn-ghost" style="width:100%; border-style:dashed; color:var(--primary); margin-top:0.5rem;" onclick="openAddAddressModal()">+ Add New Address</button>`;
    } else if (tabName === 'settings') {
      container.innerHTML = `
        <h2 style="font-size:1.3rem; font-weight:700; margin-bottom:1.25rem;">Account Settings</h2>
        <div class="form-card">
          <h3>Personal Details</h3>
          <div class="form-row">
            <div class="form-group"><label>Full Name</label><input type="text" id="profSetFullName" value="${user.name}"></div>
            <div class="form-group"><label>Email Address</label><input type="email" value="${user.email}" disabled></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Phone Number</label><input type="tel" id="profSetPhone" value="${user.phone}"></div>
            <div class="form-group"><label>Role</label><input type="text" value="${user.role}" disabled></div>
          </div>
          <button class="btn-primary" onclick="saveCustomerProfileSettings()">Save Changes</button>
        </div>`;
    }
  }

  function saveCustomerProfileSettings() {
    const nameInput = document.getElementById('profSetFullName');
    const phoneInput = document.getElementById('profSetPhone');
    if (!window.FoodFlowStore) return;
    const user = window.FoodFlowStore.getCurrentUser();
    if (user && nameInput) {
      const newName = nameInput.value.trim() || user.name;
      const newPhone = phoneInput ? (phoneInput.value.trim() || user.phone) : user.phone;

      const updated = window.FoodFlowStore.updateUserProfile({
        id: user.id,
        email: user.email,
        name: newName,
        phone: newPhone
      });

      updateCustomerAuthUI();
      showToast('✓ Profile changes saved & synced to MySQL Database!', 'success');
      openCustomerProfile();
    }
  }

  function openAddAddressModal() {
    const modal = document.getElementById('addAddressModal');
    if (modal) modal.classList.add('open');
  }

  function submitCustomerAddress() {
    if (!window.FoodFlowStore) return;
    const user = window.FoodFlowStore.getCurrentUser();
    if (!user) return;
    const label = document.getElementById('newAddrLabel');
    const text = document.getElementById('newAddrText');

    if (!text || !text.value.trim()) {
      showToast('Please enter full street address', 'error');
      return;
    }

    window.FoodFlowStore.addAddress({
      userEmail: user.email,
      label: label ? label.value : 'Home',
      address: text.value.trim(),
      isDefault: false
    });

    closeAdminModal('addAddressModal');
    renderProfileContent('addresses');
    showToast('✓ New address saved!', 'success');
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
    if (!order || !order.items) return;
    order.items.forEach((item) => {
      window.FoodFlowStore.addToCart(item.id, item.qty);
    });
    updateCustomerCartUI();
    showToast(`Items from Order #${orderId} added to cart!`, 'success');
    proceedToCheckout();
  }

  // ═══════════════════════ FORM VALIDATION & SECURITY UTILITIES ═══════════════════════
  const ValidationUtils = {
    isValidEmail(email) {
      const clean = String(email || '').trim().toLowerCase();
      const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      return re.test(clean);
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
      const clean = String(phone || '').replace(/[\s\-()]/g, '');
      const re = /^(?:\+91|91)?[6-9]\d{9}$/;
      return re.test(clean) || /^[6-9]\d{9}$/.test(clean);
    },
    evaluatePasswordStrength(password) {
      const p = String(password || '');
      if (!p) {
        return {
          score: 0,
          label: 'Enter password',
          cssClass: 'weak',
          isValid: false,
          hint: 'Min 8 chars with uppercase, number & symbol'
        };
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
        hint = 'Add symbols & numbers for better security';
      } else if (score === 3) {
        label = 'Good';
        cssClass = 'good';
        hint = 'Almost strong! Ensure special characters are included';
      } else if (score >= 4) {
        label = 'Strong & Secure ✓';
        cssClass = 'strong';
        hint = 'Great password!';
      }

      return {
        score,
        label,
        cssClass,
        isValid,
        hasLength,
        hasUpper,
        hasLower,
        hasNumber,
        hasSpecial,
        hint
      };
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
      field.setAttribute('aria-invalid', 'true');
    }
  }

  function clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    const errEl = document.getElementById('err-' + fieldId);
    const groupEl = document.getElementById('group-' + fieldId);

    if (groupEl) {
      groupEl.classList.remove('has-error');
      groupEl.classList.add('has-success');
    }
    if (errEl) {
      errEl.innerHTML = '';
      errEl.classList.remove('show');
    }
    if (field) {
      field.removeAttribute('aria-invalid');
    }
  }

  function resetFieldState(fieldId) {
    const field = document.getElementById(fieldId);
    const errEl = document.getElementById('err-' + fieldId);
    const groupEl = document.getElementById('group-' + fieldId);

    if (groupEl) {
      groupEl.classList.remove('has-error');
      groupEl.classList.remove('has-success');
    }
    if (errEl) {
      errEl.innerHTML = '';
      errEl.classList.remove('show');
    }
    if (field) {
      field.removeAttribute('aria-invalid');
    }
  }

  function togglePasswordVisibility(inputId, buttonEl) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
      input.type = 'text';
      if (buttonEl) buttonEl.textContent = '🙈';
    } else {
      input.type = 'password';
      if (buttonEl) buttonEl.textContent = '👁️';
    }
  }

  function updatePasswordStrengthUI(inputId, containerId, barId, labelId, hintId) {
    const input = document.getElementById(inputId);
    const container = document.getElementById(containerId);
    const bar = document.getElementById(barId);
    const label = document.getElementById(labelId);
    const hint = hintId ? document.getElementById(hintId) : null;

    if (!input || !container || !bar || !label) return;

    const val = input.value;
    if (!val) {
      container.classList.remove('show');
      return;
    }

    container.classList.add('show');
    const result = ValidationUtils.evaluatePasswordStrength(val);

    bar.className = 'strength-bar-fill ' + result.cssClass;
    label.textContent = result.label;
    label.style.color = result.cssClass === 'strong' ? 'var(--success)' : result.cssClass === 'good' ? '#2563EB' : result.cssClass === 'fair' ? 'var(--warning)' : 'var(--danger)';
    if (hint) hint.textContent = result.hint;
  }

  // ═══════════════════════ AUTHENTICATION & FORGOT PASSWORD (SWIGGY/ZOMATO STYLE) ═══════════════════════
  let activeForgotState = {
    identifier: '',
    email: '',
    phone: '',
    maskedDest: '',
    otp: '',
    verified: false,
    countdownInterval: null
  };

  function openAuthModal(mode = 'login') {
    const modal = document.getElementById('authModal');
    if (!modal) return;
    setAuthTabMode(mode);
    modal.classList.add('open');
  }

  function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('open');
    if (activeForgotState.countdownInterval) {
      clearInterval(activeForgotState.countdownInterval);
    }
  }

  function setAuthTabMode(mode) {
    const loginTabBtn = document.getElementById('authTabLogin');
    const regTabBtn = document.getElementById('authTabRegister');
    const loginBox = document.getElementById('authLoginForm');
    const registerBox = document.getElementById('authRegisterForm');
    const forgotBox = document.getElementById('authForgotForm');

    if (loginTabBtn && regTabBtn) {
      if (mode === 'login') {
        loginTabBtn.style.color = 'var(--primary)';
        loginTabBtn.style.borderBottomColor = 'var(--primary)';
        regTabBtn.style.color = 'var(--text-muted)';
        regTabBtn.style.borderBottomColor = 'transparent';
      } else if (mode === 'register') {
        regTabBtn.style.color = 'var(--primary)';
        regTabBtn.style.borderBottomColor = 'var(--primary)';
        loginTabBtn.style.color = 'var(--text-muted)';
        loginTabBtn.style.borderBottomColor = 'transparent';
      }
    }

    if (loginBox) loginBox.style.display = mode === 'login' ? 'block' : 'none';
    if (registerBox) registerBox.style.display = mode === 'register' ? 'block' : 'none';
    if (forgotBox) {
      forgotBox.style.display = mode === 'forgot' ? 'block' : 'none';
      if (mode === 'forgot') showForgotStep(1);
    }
  }

  function handleCustomerLogin() {
    const emailField = document.getElementById('loginEmailField');
    const passField = document.getElementById('loginPasswordField');
    if (!emailField || !passField || !window.FoodFlowStore) return;

    const email = emailField.value.trim();
    const password = passField.value;

    let hasErrors = false;

    if (!email) {
      showFieldError('loginEmailField', 'Email address is required.');
      hasErrors = true;
    } else if (!ValidationUtils.isValidEmail(email)) {
      showFieldError('loginEmailField', 'Please enter a valid email address (e.g. name@example.com).');
      hasErrors = true;
    } else {
      clearFieldError('loginEmailField');
    }

    if (!password) {
      showFieldError('loginPasswordField', 'Password is required.');
      hasErrors = true;
    } else if (password.length < 6) {
      showFieldError('loginPasswordField', 'Password must be at least 6 characters.');
      hasErrors = true;
    } else {
      clearFieldError('loginPasswordField');
    }

    if (hasErrors) {
      showToast('Please correct the highlighted errors.', 'error');
      return;
    }

    try {
      const user = window.FoodFlowStore.loginUser(email, password);
      closeAuthModal();
      updateCustomerAuthUI();
      showToast(`Welcome back, ${user.name}! 👋`, 'success');
    } catch (err) {
      const errMsg = err.message;
      if (errMsg.includes('email') || errMsg.includes('No account found')) {
        showFieldError('loginEmailField', errMsg);
      } else if (errMsg.includes('password') || errMsg.includes('Incorrect password')) {
        showFieldError('loginPasswordField', errMsg);
      }
      showToast(errMsg, 'error');
    }
  }

  function handleCustomerRegister() {
    const firstField = document.getElementById('regFirstName');
    const lastField = document.getElementById('regLastName');
    const emailField = document.getElementById('regEmail');
    const phoneField = document.getElementById('regPhone');
    const passField = document.getElementById('regPassword');
    const confirmPassField = document.getElementById('regConfirmPassword');
    const termsField = document.getElementById('regTermsCheckbox');

    if (!firstField || !emailField || !phoneField || !passField || !confirmPassField || !window.FoodFlowStore) return;

    const first = firstField.value.trim();
    const last = lastField ? lastField.value.trim() : '';
    const email = emailField.value.trim();
    const phone = phoneField.value.trim();
    const password = passField.value;
    const confirmPassword = confirmPassField.value;
    const agreeTerms = termsField ? termsField.checked : true;

    let hasErrors = false;

    // First Name
    if (!first) {
      showFieldError('regFirstName', 'First name is required.');
      hasErrors = true;
    } else if (!ValidationUtils.isValidName(first)) {
      showFieldError('regFirstName', 'First name must contain 2-35 letters only.');
      hasErrors = true;
    } else {
      clearFieldError('regFirstName');
    }

    // Last Name
    if (last && !ValidationUtils.isValidLastName(last)) {
      showFieldError('regLastName', 'Last name must contain letters only.');
      hasErrors = true;
    } else if (lastField) {
      clearFieldError('regLastName');
    }

    // Email
    if (!email) {
      showFieldError('regEmail', 'Email address is required.');
      hasErrors = true;
    } else if (!ValidationUtils.isValidEmail(email)) {
      showFieldError('regEmail', 'Please enter a valid email address (e.g. name@example.com).');
      hasErrors = true;
    } else if (window.FoodFlowStore.getUserByEmail(email)) {
      showFieldError('regEmail', 'An account with this email address already exists. Please sign in instead.');
      hasErrors = true;
    } else {
      clearFieldError('regEmail');
    }

    // Phone
    if (!phone) {
      showFieldError('regPhone', 'Mobile number is required.');
      hasErrors = true;
    } else if (!ValidationUtils.isValidPhone(phone)) {
      showFieldError('regPhone', 'Please enter a valid 10-digit mobile number (e.g. 9876543210).');
      hasErrors = true;
    } else {
      clearFieldError('regPhone');
    }

    // Password
    const strength = ValidationUtils.evaluatePasswordStrength(password);
    if (!password) {
      showFieldError('regPassword', 'Password is required.');
      hasErrors = true;
    } else if (!strength.isValid) {
      showFieldError('regPassword', 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.');
      hasErrors = true;
    } else {
      clearFieldError('regPassword');
    }

    // Confirm Password
    if (!confirmPassword) {
      showFieldError('regConfirmPassword', 'Please confirm your password.');
      hasErrors = true;
    } else if (confirmPassword !== password) {
      showFieldError('regConfirmPassword', 'Passwords do not match. Please re-enter.');
      hasErrors = true;
    } else {
      clearFieldError('regConfirmPassword');
    }

    // Terms
    if (termsField && !agreeTerms) {
      showFieldError('regTermsCheckbox', 'You must accept the Terms of Service & Privacy Policy to register.');
      hasErrors = true;
    } else if (termsField) {
      clearFieldError('regTermsCheckbox');
    }

    if (hasErrors) {
      showToast('Please fix the highlighted validation errors.', 'error');
      return;
    }

    try {
      const newUser = window.FoodFlowStore.registerUser({
        firstName: first,
        lastName: last,
        email: email,
        password: password,
        phone: phone,
        role: 'Customer'
      });
      window.FoodFlowStore.setCurrentUser(newUser);
      closeAuthModal();
      updateCustomerAuthUI();
      showToast(`Account created successfully! Welcome, ${newUser.name}! 🎉`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function initOtpBoxes() {
    for (let i = 1; i <= 6; i++) {
      const box = document.getElementById(`otpBox${i}`);
      if (!box) continue;

      box.addEventListener('input', (e) => {
        const val = e.target.value.replace(/\D/g, '');
        e.target.value = val ? val[0] : '';
        if (e.target.value) {
          e.target.classList.add('filled');
          if (i < 6) {
            const next = document.getElementById(`otpBox${i + 1}`);
            if (next) next.focus();
          } else {
            clearFieldError('forgotOtpField');
          }
        } else {
          e.target.classList.remove('filled');
        }
      });

      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && i > 1) {
          const prev = document.getElementById(`otpBox${i - 1}`);
          if (prev) {
            prev.focus();
            prev.value = '';
            prev.classList.remove('filled');
          }
        }
      });

      box.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').substring(0, 6);
        if (text) {
          autoFillOtpBoxes(text);
        }
      });
    }
  }

  function autoFillOtpBoxes(code) {
    const clean = String(code).replace(/\D/g, '').substring(0, 6);
    for (let i = 1; i <= 6; i++) {
      const box = document.getElementById(`otpBox${i}`);
      if (box) {
        box.value = clean[i - 1] || '';
        if (box.value) box.classList.add('filled');
        else box.classList.remove('filled');
      }
    }
    const lastBox = document.getElementById(`otpBox${Math.min(clean.length, 6)}`);
    if (lastBox) lastBox.focus();
    clearFieldError('forgotOtpField');
    showToast(`✓ OTP code ${clean} auto-filled!`, 'info');
  }

  function getEnteredOtpFromBoxes() {
    let digits = '';
    for (let i = 1; i <= 6; i++) {
      const box = document.getElementById(`otpBox${i}`);
      digits += (box && box.value) ? box.value.trim() : '';
    }
    return digits;
  }

  function clearOtpBoxes() {
    for (let i = 1; i <= 6; i++) {
      const box = document.getElementById(`otpBox${i}`);
      if (box) {
        box.value = '';
        box.classList.remove('filled');
      }
    }
  }

  function quickFillForgotInput(val) {
    const input = document.getElementById('forgotEmailField');
    if (input) {
      input.value = val;
      clearFieldError('forgotEmailField');
    }
  }

  function showForgotStep(stepNum) {
    const s1 = document.getElementById('forgotStep1');
    const s2 = document.getElementById('forgotStep2');
    const s3 = document.getElementById('forgotStep3');
    const s4 = document.getElementById('forgotStep4');

    if (s1) s1.style.display = stepNum === 1 ? 'block' : 'none';
    if (s2) s2.style.display = stepNum === 2 ? 'block' : 'none';
    if (s3) s3.style.display = stepNum === 3 ? 'block' : 'none';
    if (s4) s4.style.display = stepNum === 4 ? 'block' : 'none';

    if (stepNum === 2) {
      setTimeout(() => {
        initOtpBoxes();
        const b1 = document.getElementById('otpBox1');
        if (b1) b1.focus();
      }, 100);
    }
  }

  function handleRequestPasswordOTP() {
    const inputField = document.getElementById('forgotEmailField');
    if (!inputField || !window.FoodFlowStore) return;

    const identifier = inputField.value.trim();
    if (!identifier) {
      showFieldError('forgotEmailField', 'Please enter your registered mobile number or email address.');
      return;
    }
    
    const isEmail = identifier.includes('@');
    const isPhone = !isEmail && identifier.replace(/\D/g, '').length >= 10;

    if (!isEmail && !isPhone) {
      showFieldError('forgotEmailField', 'Please enter a valid 10-digit mobile number or email address.');
      return;
    }
    clearFieldError('forgotEmailField');

    try {
      const res = window.FoodFlowStore.generatePasswordResetOTP(identifier);
      activeForgotState.identifier = identifier;
      activeForgotState.email = res.email;
      activeForgotState.phone = res.phone;
      activeForgotState.maskedDest = res.maskedDest;
      activeForgotState.otp = res.otp;
      activeForgotState.verified = false;

      const destDisp = document.getElementById('forgotTargetEmailDisplay');
      const otpDisp = document.getElementById('simulatedOtpCode');
      const destIcon = document.getElementById('otpDestIcon');

      if (destDisp) destDisp.textContent = res.maskedDest;
      if (otpDisp) otpDisp.textContent = res.otp;
      if (destIcon) destIcon.textContent = res.isPhone ? '📱' : '✉️';

      clearOtpBoxes();
      showForgotStep(2);
      startForgotCountdown();
      showToast(`✓ OTP sent to ${res.maskedDest}`, 'success');
    } catch (err) {
      showFieldError('forgotEmailField', err.message);
      showToast(err.message, 'error');
    }
  }

  function copySimulatedOtp() {
    if (activeForgotState.otp) {
      autoFillOtpBoxes(activeForgotState.otp);
    }
  }

  function startForgotCountdown() {
    if (activeForgotState.countdownInterval) {
      clearInterval(activeForgotState.countdownInterval);
    }
    let remaining = 30;
    const resendBtn = document.getElementById('resendOtpBtn');
    if (resendBtn) {
      resendBtn.disabled = true;
      resendBtn.textContent = `Resend OTP in 00:${String(remaining).padStart(2, '0')}`;
    }

    activeForgotState.countdownInterval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(activeForgotState.countdownInterval);
        if (resendBtn) {
          resendBtn.disabled = false;
          resendBtn.textContent = 'Resend OTP via SMS';
        }
      } else {
        if (resendBtn) resendBtn.textContent = `Resend OTP in 00:${String(remaining).padStart(2, '0')}`;
      }
    }, 1000);
  }

  function handleVerifyPasswordOTP(action = 'login') {
    if (!window.FoodFlowStore) return;
    const entered = getEnteredOtpFromBoxes();

    if (!entered || entered.length < 6) {
      showFieldError('forgotOtpField', 'Please enter all 6 digits of the verification code.');
      return;
    }

    const check = window.FoodFlowStore.verifyPasswordResetOTP(activeForgotState.email, entered);
    if (!check.valid) {
      showFieldError('forgotOtpField', check.message || 'Incorrect 6-digit OTP code.');
      showToast(check.message || 'Incorrect OTP code', 'error');
      return;
    }

    clearFieldError('forgotOtpField');
    activeForgotState.verified = true;
    if (activeForgotState.countdownInterval) clearInterval(activeForgotState.countdownInterval);

    if (action === 'login') {
      const user = window.FoodFlowStore.loginUser(activeForgotState.email);
      closeAuthModal();
      updateCustomerAuthUI();
      showToast(`🎉 Signed in successfully! Welcome, ${user.name}!`, 'success');
    } else {
      showForgotStep(3);
      showToast('✓ OTP verified! Please choose a new password.', 'success');
      setTimeout(() => {
        const passInput = document.getElementById('forgotNewPasswordField');
        if (passInput) passInput.focus();
      }, 100);
    }
  }

  function handleNewPasswordLiveCheck(val) {
    const hasLen = val.length >= 8;
    const hasCase = /[a-z]/.test(val) && /[A-Z]/.test(val);
    const hasNum = /\d/.test(val);
    const hasSpecial = /[^A-Za-z0-9]/.test(val);

    const cLen = document.getElementById('pwCheckLen');
    const cCase = document.getElementById('pwCheckCase');
    const cNum = document.getElementById('pwCheckNum');
    const cSpec = document.getElementById('pwCheckSpecial');

    if (cLen) cLen.className = 'pw-check-item' + (hasLen ? ' valid' : '');
    if (cCase) cCase.className = 'pw-check-item' + (hasCase ? ' valid' : '');
    if (cNum) cNum.className = 'pw-check-item' + (hasNum ? ' valid' : '');
    if (cSpec) cSpec.className = 'pw-check-item' + (hasSpecial ? ' valid' : '');

    clearFieldError('forgotNewPasswordField');
  }

  function handleConfirmPasswordLiveCheck(val) {
    const mainPass = document.getElementById('forgotNewPasswordField')?.value || '';
    if (val && mainPass && val === mainPass) {
      clearFieldError('forgotConfirmPasswordField');
    }
  }

  function handleSubmitNewPassword() {
    const newPassField = document.getElementById('forgotNewPasswordField');
    const confirmPassField = document.getElementById('forgotConfirmPasswordField');
    if (!newPassField || !confirmPassField || !window.FoodFlowStore) return;

    const newPass = newPassField.value;
    const confirmPass = confirmPassField.value;

    const hasLen = newPass.length >= 8;
    const hasCase = /[a-z]/.test(newPass) && /[A-Z]/.test(newPass);
    const hasNum = /\d/.test(newPass);
    const hasSpecial = /[^A-Za-z0-9]/.test(newPass);

    if (!newPass) {
      showFieldError('forgotNewPasswordField', 'New password is required.');
      return;
    }
    if (!hasLen || !hasCase || !hasNum || !hasSpecial) {
      showFieldError('forgotNewPasswordField', 'Please ensure your password satisfies all 4 requirements above.');
      return;
    }
    clearFieldError('forgotNewPasswordField');

    if (!confirmPass) {
      showFieldError('forgotConfirmPasswordField', 'Please confirm your new password.');
      return;
    }
    if (confirmPass !== newPass) {
      showFieldError('forgotConfirmPasswordField', 'Passwords do not match. Please re-type.');
      return;
    }
    clearFieldError('forgotConfirmPasswordField');

    try {
      window.FoodFlowStore.updateUserPassword(activeForgotState.email, newPass);
      
      const user = window.FoodFlowStore.loginUser(activeForgotState.email);
      updateCustomerAuthUI();

      const successMsg = document.getElementById('forgotSuccessMessage');
      if (successMsg) {
        successMsg.textContent = `Welcome back, ${user.name}! Your new password has been saved in MySQL and you are signed in.`;
      }

      showForgotStep(4);
      showToast('✓ Password updated & signed in successfully!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function handleFinishPasswordReset() {
    closeAuthModal();
    updateCustomerAuthUI();
    showCustomerScreen('home');
  }

  function handleCustomerLogout() {
    if (!window.FoodFlowStore) return;
    window.FoodFlowStore.logout();
    updateCustomerAuthUI();
    showToast('Logged out successfully', 'info');
    showCustomerScreen('home');
  }

  function updateCustomerAuthUI() {
    if (!window.FoodFlowStore) return;
    const user = window.FoodFlowStore.getCurrentUser();
    const authBtn = document.getElementById('navAuthBtn');
    if (!authBtn) return;

    if (user) {
      authBtn.innerHTML = `👤 ${user.name.split(' ')[0]}`;
      authBtn.onclick = openCustomerProfile;
    } else {
      authBtn.innerHTML = `Sign In`;
      authBtn.onclick = () => openAuthModal('login');
    }
  }

  // ═══════════════════════ ADMIN PORTAL CONTROLLERS ═══════════════════════
  function showAdminPage(pageName, navElement) {
    AppState.activeAdminPage = pageName;
    document.querySelectorAll('.admin-page').forEach((p) => p.classList.remove('active'));
    document.querySelectorAll('.admin-nav-item').forEach((n) => n.classList.remove('active'));

    const targetPage = document.getElementById(`admin-page-${pageName}`);
    if (targetPage) targetPage.classList.add('active');
    if (navElement) navElement.classList.add('active');

    const titles = {
      dashboard: 'Dashboard Overview',
      orders: 'Orders Management',
      users: 'User Accounts Directory',
      restaurants: 'Registered Restaurants',
      menu: 'Menu Management',
      payments: 'Payment Transactions',
      health: 'App Health & Live Logs',
      settings: 'Platform Settings & Promos'
    };

    const subs = {
      dashboard: 'Real-time sales, order volume and activity',
      orders: 'Manage and update live customer orders',
      users: 'View customer & staff directory, suspend or add accounts',
      restaurants: 'All restaurant partners, ratings and revenues',
      menu: 'Add, edit, delete and toggle item availability',
      payments: 'Comprehensive transaction history and receipts',
      health: 'Live server metrics, CI/CD pipeline and log streaming',
      settings: 'Platform fees, maintenance mode & promo coupons'
    };

    const titleEl = document.getElementById('adminTopbarTitle');
    const subEl = document.getElementById('adminTopbarSub');
    if (titleEl) titleEl.textContent = titles[pageName] || 'Admin Panel';
    if (subEl) subEl.textContent = subs[pageName] || '';

    if (pageName === 'dashboard') renderAdminDashboard();
    if (pageName === 'orders') renderAdminOrders();
    if (pageName === 'users') renderAdminUsers();
    if (pageName === 'restaurants') renderAdminRestaurants();
    if (pageName === 'menu') renderAdminMenu();
    if (pageName === 'payments') renderAdminPayments();
    if (pageName === 'health') renderAdminHealth();
    if (pageName === 'settings') renderAdminSettingsPromos();
    updateAdminBadges();
  }

  function updateAdminBadges() {
    if (!window.FoodFlowStore) return;
    const orders = window.FoodFlowStore.getOrders();
    const pendingCount = orders.filter((o) => o.status === 'pending' || o.status === 'preparing').length;
    const badge = document.getElementById('adminPendingOrdersBadge');
    if (badge) badge.textContent = pendingCount;
  }

  function renderAdminDashboard() {
    if (!window.FoodFlowStore) return;
    const stats = window.FoodFlowStore.getDashboardStats();
    const orders = window.FoodFlowStore.getOrders();
    const restaurants = window.FoodFlowStore.getRestaurants();

    const ordEl = document.getElementById('admStatOrders');
    const revEl = document.getElementById('admStatRevenue');
    const usrEl = document.getElementById('admStatUsers');
    const pndEl = document.getElementById('admStatPending');

    if (ordEl) ordEl.textContent = stats.totalOrdersToday;
    if (revEl) revEl.textContent = `₹${stats.revenueToday.toLocaleString()}`;
    if (usrEl) usrEl.textContent = stats.activeUsersCount;
    if (pndEl) pndEl.textContent = stats.pendingOrdersCount;

    // Chart
    const chartEl = document.getElementById('admWeeklyChart');
    if (chartEl) {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const vals = [85, 102, 98, 134, 128, 155, Math.max(stats.totalOrdersToday, 40)];
      const maxVal = Math.max(...vals);
      chartEl.innerHTML = vals
        .map(
          (v, i) => `
        <div class="bar-wrap" style="flex:1; display:flex; flex-direction:column; align-items:center; gap:4px;">
          <div class="bar" style="width:100%; height:${Math.round((v / maxVal) * 140)}px; background:var(--primary); border-radius:4px 4px 0 0; opacity:0.85;" title="${v} orders"></div>
          <span style="font-size:0.7rem; color:var(--text-muted);">${days[i]}</span>
        </div>`
        )
        .join('');
    }

    // Category Breakdown
    const catEl = document.getElementById('admCatBreakdown');
    if (catEl) {
      const cats = [
        ['Biryani', '🍛', 38],
        ['Pizza', '🍕', 24],
        ['Burger', '🍔', 18],
        ['Chinese', '🍜', 12],
        ['South Indian', '🥘', 8]
      ];
      catEl.innerHTML = cats
        .map(
          ([name, icon, pct]) => `
        <div style="margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:5px;">
            <span>${icon} ${name}</span><span style="font-weight:700;">${pct}%</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;"></div></div>
        </div>`
        )
        .join('');
    }

    // Recent Orders Table
    const recentTable = document.getElementById('admRecentOrdersTable');
    if (recentTable) {
      recentTable.innerHTML = `
        <thead><tr><th>Order ID</th><th>Customer</th><th>Restaurant</th><th>Total</th><th>Status</th></tr></thead>
        <tbody>${orders
          .slice(0, 5)
          .map(
            (o) => `
          <tr>
            <td><strong>#${o.id}</strong></td>
            <td>${o.customer}</td>
            <td>${o.restaurant}</td>
            <td><strong>₹${o.total}</strong></td>
            <td>${getBadgeForStatus(o.status)}</td>
          </tr>`
          )
          .join('')}</tbody>`;
    }

    // Top Restaurants
    const topRestEl = document.getElementById('admTopRestaurants');
    if (topRestEl) {
      topRestEl.innerHTML = restaurants
        .slice(0, 5)
        .map(
          (r, i) => `
        <div style="display:flex; align-items:center; gap:12px; padding:10px 0; ${i < 4 ? 'border-bottom:1px solid var(--border)' : ''}">
          <span style="font-size:0.8rem; font-weight:800; color:var(--text-light); width:18px;">${i + 1}</span>
          <img src="${r.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=100&q=80'}" class="admin-thumb-img" alt="${r.name}">
          <div style="flex:1;">
            <div style="font-weight:700; font-size:0.9rem;">${r.name}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">★ ${r.rating} · ${r.ordersCount || 0} orders</div>
          </div>
          <div style="font-weight:800; font-size:0.9rem;">₹${(r.revenue || 0).toLocaleString()}</div>
        </div>`
        )
        .join('');
    }
  }

  let activeAdminCancelOrderId = null;

  function renderAdminOrders(customList = null) {
    if (!window.FoodFlowStore) return;
    const orders = customList || window.FoodFlowStore.getOrders();
    const countLabel = document.getElementById('admOrdersCountLabel');
    if (countLabel) countLabel.textContent = `Showing ${orders.length} orders`;

    const table = document.getElementById('admOrdersTable');
    if (!table) return;

    table.innerHTML = `
      <thead>
        <tr>
          <th>Order ID</th>
          <th>Customer</th>
          <th>Restaurant</th>
          <th>Items</th>
          <th>Total</th>
          <th>Payment</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${orders
          .map(
            (o) => `
          <tr>
            <td><strong style="font-size:0.85rem;">#${o.id}</strong></td>
            <td>
              <div style="font-weight:600;">${o.customer}</div>
              <div style="font-size:0.75rem; color:var(--text-muted);">${o.phone}</div>
            </td>
            <td>${o.restaurant}</td>
            <td style="max-width:180px; font-size:0.82rem; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${o.itemsSummary || ''}">
              ${o.itemsSummary || (o.items || []).map((i) => `${i.name} ×${i.qty}`).join(', ')}
            </td>
            <td><strong>₹${o.total}</strong></td>
            <td>
              <div style="font-size:0.82rem;">${o.paymentMethod}</div>
              <div style="display:flex; align-items:center; gap:4px; margin-top:2px;">
                <span class="badge ${o.paymentStatus === 'success' ? 'badge-success' : o.paymentStatus === 'refunded' ? 'badge-info' : 'badge-warning'}" style="font-size:0.68rem;">${o.paymentStatus}</span>
                ${o.refundStatus === 'refunded' ? '<span class="badge badge-success" style="font-size:0.65rem;" title="100% Refunded">💰 Refund</span>' : ''}
              </div>
            </td>
            <td>
              ${getBadgeForStatus(o.status)}
              ${o.status === 'cancelled' ? `<div style="font-size:0.72rem; color:var(--danger); max-width:130px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px;" title="${o.cancelReason || ''}">Reason: ${o.cancelReason || 'Cancelled'}</div>` : ''}
            </td>
            <td>
              <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <button class="action-btn" onclick="openAdminOrderStatusModal('${o.id}')">✏️ Status</button>
                <button class="action-btn success" onclick="openAdminReceiptModal('${o.id}')">📄 Receipt</button>
                ${(o.status === 'pending' || o.status === 'preparing') ? `<button class="action-btn danger" onclick="openAdminCancelModal('${o.id}')">✕ Cancel</button>` : ''}
              </div>
            </td>
          </tr>`
          )
          .join('')}
      </tbody>`;
  }

  function filterAdminOrdersQuery(query) {
    if (!window.FoodFlowStore) return;
    const orders = window.FoodFlowStore.getOrders();
    const q = (query || '').toLowerCase();
    const filtered = orders.filter(
      (o) =>
        o.id.toLowerCase().includes(q) ||
        o.customer.toLowerCase().includes(q) ||
        o.restaurant.toLowerCase().includes(q)
    );
    renderAdminOrders(filtered);
  }

  function filterAdminOrdersStatus(statusVal) {
    if (!window.FoodFlowStore) return;
    const orders = window.FoodFlowStore.getOrders();
    if (statusVal === 'all') {
      renderAdminOrders(orders);
    } else {
      renderAdminOrders(orders.filter((o) => o.status === statusVal));
    }
  }

  function handleAdminExportCSV() {
    if (!window.FoodFlowStore) return;
    const res = window.FoodFlowStore.exportOrdersCSV();
    if (res) {
      showToast('✓ Orders exported to CSV file successfully!', 'success');
    } else {
      showToast('No orders available to export', 'info');
    }
  }

  let activeModalOrderId = null;
  function openAdminOrderStatusModal(orderId) {
    if (!window.FoodFlowStore) return;
    const order = window.FoodFlowStore.getOrderById(orderId);
    if (!order) return;
    activeModalOrderId = orderId;

    const idLabel = document.getElementById('admStatusModalOrderId');
    const select = document.getElementById('admStatusSelect');
    const note = document.getElementById('admStatusNote');

    if (idLabel) idLabel.textContent = `#${order.id} (${order.customer})`;
    if (select) select.value = order.status;
    if (note) note.value = order.adminNote || '';

    const modal = document.getElementById('adminOrderStatusModal');
    if (modal) modal.classList.add('open');
  }

  function submitAdminOrderStatus() {
    if (!activeModalOrderId || !window.FoodFlowStore) return;
    const select = document.getElementById('admStatusSelect');
    const note = document.getElementById('admStatusNote');
    const newStatus = select ? select.value : 'preparing';
    const noteText = note ? note.value.trim() : '';

    if (newStatus === 'cancelled') {
      closeAdminModal('adminOrderStatusModal');
      openAdminCancelModal(activeModalOrderId);
      return;
    }

    window.FoodFlowStore.updateOrderStatus(activeModalOrderId, newStatus, noteText);
    closeAdminModal('adminOrderStatusModal');
    renderAdminOrders();
    renderAdminDashboard();
    updateAdminBadges();
    showToast(`✓ Order #${activeModalOrderId} updated to "${newStatus.toUpperCase()}"`, 'success');
  }

  function openAdminCancelModal(orderId) {
    if (!window.FoodFlowStore) return;
    const order = window.FoodFlowStore.getOrderById(orderId);
    if (!order) return;

    activeAdminCancelOrderId = orderId;
    const idEl = document.getElementById('admCancelOrderId');
    const custEl = document.getElementById('admCancelCustomer');
    const refundBox = document.getElementById('admCancelRefundBox');

    if (idEl) idEl.textContent = `#${order.id}`;
    if (custEl) custEl.textContent = `${order.customer} (₹${order.total})`;

    const isPrepaid = order.paymentMethod !== 'Cash on Delivery';

    if (refundBox) {
      if (isPrepaid) {
        refundBox.innerHTML = `
          <div class="refund-card-highlight">
            <div class="refund-icon">💰</div>
            <div>
              <div style="font-weight:800; font-size:0.92rem; color:#166534;">Automated Prepaid Refund: ₹${order.total}</div>
              <div style="font-size:0.8rem; color:#14532D; margin-top:2px;">
                Since order was paid via <strong>${order.paymentMethod}</strong>, canceling will automatically issue a 100% refund and log a refund transaction.
              </div>
            </div>
          </div>`;
      } else {
        refundBox.innerHTML = `
          <div class="cancel-reason-box" style="background:#F0FDF4; border-color:#BBF7D0; color:#166534;">
            ℹ️ Cash on Delivery order — No payment refund deduction required.
          </div>`;
      }
    }

    const modal = document.getElementById('adminCancelOrderModal');
    if (modal) modal.classList.add('open');
  }

  function handleAdminCancelReasonChange(val) {
    const customGroup = document.getElementById('admCancelCustomReasonGroup');
    if (customGroup) {
      customGroup.style.display = val === 'Other' ? 'block' : 'none';
    }
  }

  function submitAdminCancelOrder() {
    if (!activeAdminCancelOrderId || !window.FoodFlowStore) return;
    const select = document.getElementById('admCancelReasonSelect');
    const customInput = document.getElementById('admCancelCustomReasonInput');
    const noteEl = document.getElementById('admCancelInternalNote');

    let reason = select ? select.value : 'Cancelled by Admin';
    if (reason === 'Other' && customInput && customInput.value.trim()) {
      reason = customInput.value.trim();
    } else if (reason === 'Other') {
      showToast('Please specify the custom cancellation reason', 'error');
      return;
    }

    if (noteEl && noteEl.value.trim()) {
      reason += ` — Note: ${noteEl.value.trim()}`;
    }

    const res = window.FoodFlowStore.cancelOrder(activeAdminCancelOrderId, reason, 'Super Admin');
    closeAdminModal('adminCancelOrderModal');

    renderAdminOrders();
    renderAdminPayments();
    renderAdminDashboard();
    updateAdminBadges();
    renderAdminHealth();

    showToast(`✓ Order #${activeAdminCancelOrderId} cancelled. ${res.message}`, 'success');
  }

  function renderAdminUsers(customList = null) {
    if (!window.FoodFlowStore) return;
    const users = customList || window.FoodFlowStore.getUsers();
    const table = document.getElementById('admUsersTable');
    if (!table) return;

    table.innerHTML = `
      <thead>
        <tr>
          <th>User ID</th>
          <th>Full Name</th>
          <th>Email</th>
          <th>Role</th>
          <th>Orders</th>
          <th>Total Spent</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${users
          .map(
            (u) => `
          <tr>
            <td style="color:var(--text-muted); font-size:0.8rem;">${u.id}</td>
            <td><strong>${u.name}</strong></td>
            <td style="font-size:0.82rem;">${u.email}</td>
            <td><span class="badge ${u.role === 'Customer' ? 'badge-neutral' : u.role.includes('Admin') ? 'badge-primary' : 'badge-info'}">${u.role}</span></td>
            <td>${u.ordersCount || 0}</td>
            <td>${u.totalSpent ? '₹' + u.totalSpent.toLocaleString() : '—'}</td>
            <td>${getBadgeForStatus(u.status)}</td>
            <td>
              <button class="action-btn ${u.status === 'active' ? 'danger' : 'success'}" onclick="handleAdminToggleUser('${u.id}')">
                ${u.status === 'active' ? '⊘ Suspend' : '✓ Activate'}
              </button>
            </td>
          </tr>`
          )
          .join('')}
      </tbody>`;
  }

  function filterAdminUsersQuery(query) {
    if (!window.FoodFlowStore) return;
    const users = window.FoodFlowStore.getUsers();
    const q = (query || '').toLowerCase();
    const filtered = users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q));
    renderAdminUsers(filtered);
  }

  function filterAdminUsersRole(roleVal) {
    if (!window.FoodFlowStore) return;
    const users = window.FoodFlowStore.getUsers();
    if (roleVal === 'All' || roleVal === 'All Roles') {
      renderAdminUsers(users);
    } else {
      renderAdminUsers(users.filter((u) => u.role === roleVal));
    }
  }

  function handleAdminToggleUser(userId) {
    if (!window.FoodFlowStore) return;
    const updated = window.FoodFlowStore.toggleUserStatus(userId);
    if (updated) {
      renderAdminUsers();
      showToast(`User #${userId} status set to ${updated.status.toUpperCase()}`, updated.status === 'active' ? 'success' : 'error');
    }
  }

  function openAddUserModal() {
    const modal = document.getElementById('adminAddUserModal');
    if (modal) modal.classList.add('open');
  }

  function submitAdminAddUser() {
    const first = document.getElementById('admAddUserFirst');
    const last = document.getElementById('admAddUserLast');
    const email = document.getElementById('admAddUserEmail');
    const phone = document.getElementById('admAddUserPhone');
    const pass = document.getElementById('admAddUserPassword');
    const role = document.getElementById('admAddUserRole');

    if (!first || !email || !phone || !window.FoodFlowStore) return;

    const firstName = first.value.trim();
    const lastName = last ? last.value.trim() : '';
    const emailVal = email.value.trim();
    const phoneVal = phone.value.trim();
    const passwordVal = pass ? pass.value : 'Password@123';

    let hasErrors = false;

    if (!firstName || !ValidationUtils.isValidName(firstName)) {
      showFieldError('admAddUserFirst', 'Valid first name is required (2-35 letters).');
      hasErrors = true;
    } else {
      clearFieldError('admAddUserFirst');
    }

    if (lastName && !ValidationUtils.isValidLastName(lastName)) {
      showFieldError('admAddUserLast', 'Last name must contain letters only.');
      hasErrors = true;
    } else if (last) {
      clearFieldError('admAddUserLast');
    }

    if (!emailVal || !ValidationUtils.isValidEmail(emailVal)) {
      showFieldError('admAddUserEmail', 'Valid email address is required.');
      hasErrors = true;
    } else if (window.FoodFlowStore.getUserByEmail(emailVal)) {
      showFieldError('admAddUserEmail', 'An account with this email already exists.');
      hasErrors = true;
    } else {
      clearFieldError('admAddUserEmail');
    }

    if (!phoneVal || !ValidationUtils.isValidPhone(phoneVal)) {
      showFieldError('admAddUserPhone', 'Valid 10-digit phone number is required.');
      hasErrors = true;
    } else {
      clearFieldError('admAddUserPhone');
    }

    if (pass && passwordVal && passwordVal.length < 6) {
      showFieldError('admAddUserPassword', 'Password must be at least 6 characters.');
      hasErrors = true;
    } else if (pass) {
      clearFieldError('admAddUserPassword');
    }

    if (hasErrors) {
      showToast('Please resolve validation errors in the form.', 'error');
      return;
    }

    try {
      const newUser = window.FoodFlowStore.registerUser({
        firstName: firstName,
        lastName: lastName,
        email: emailVal,
        password: passwordVal,
        phone: phoneVal,
        role: role ? role.value : 'Customer'
      });
      closeAdminModal('adminAddUserModal');
      renderAdminUsers();
      showToast(`✓ User ${newUser.name} created successfully!`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function renderAdminRestaurants(customList = null) {
    if (!window.FoodFlowStore) return;
    const list = customList || window.FoodFlowStore.getRestaurants();
    const table = document.getElementById('admRestaurantsTable');
    if (!table) return;

    table.innerHTML = `
      <thead>
        <tr>
          <th>Restaurant</th>
          <th>Cuisine</th>
          <th>Rating</th>
          <th>Orders</th>
          <th>Revenue</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${list
          .map(
            (r) => `
          <tr>
            <td>
              <div style="display:flex; align-items:center; gap:12px;">
                <img src="${r.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=100&q=80'}" class="admin-thumb-img" alt="${r.name}">
                <div>
                  <strong>${r.name}</strong>
                  <div style="font-size:0.75rem; color:var(--text-muted);">${r.location || ''}</div>
                </div>
              </div>
            </td>
            <td>${r.cuisine}</td>
            <td><span style="color:var(--warning); font-weight:700;">★ ${r.rating}</span></td>
            <td>${r.ordersCount || 0}</td>
            <td><strong>₹${(r.revenue || 0).toLocaleString()}</strong></td>
            <td>${getBadgeForStatus(r.status)}</td>
            <td>
              <button class="action-btn ${r.status === 'active' ? 'danger' : 'success'}" onclick="handleAdminToggleRestaurant(${r.id})">
                ${r.status === 'active' ? 'Deactivate' : 'Activate'}
              </button>
            </td>
          </tr>`
          )
          .join('')}
      </tbody>`;
  }

  function filterAdminRestaurantsQuery(query) {
    if (!window.FoodFlowStore) return;
    const list = window.FoodFlowStore.getRestaurants();
    const q = (query || '').toLowerCase();
    const filtered = list.filter((r) => r.name.toLowerCase().includes(q) || r.cuisine.toLowerCase().includes(q));
    renderAdminRestaurants(filtered);
  }

  function handleAdminToggleRestaurant(restId) {
    if (!window.FoodFlowStore) return;
    const rest = window.FoodFlowStore.getRestaurantById(restId);
    if (!rest) return;
    const newStatus = rest.status === 'active' ? 'inactive' : 'active';
    window.FoodFlowStore.updateRestaurant(restId, { status: newStatus });
    renderAdminRestaurants();
    showToast(`${rest.name} set to ${newStatus.toUpperCase()}`, 'info');
  }

  function openAddRestaurantModal() {
    const modal = document.getElementById('adminAddRestaurantModal');
    if (modal) modal.classList.add('open');
  }

  function submitAdminAddRestaurant() {
    const name = document.getElementById('admAddRestName');
    const image = document.getElementById('admAddRestImage') || document.getElementById('admAddRestEmoji');
    const cuisine = document.getElementById('admAddRestCuisine');
    const time = document.getElementById('admAddRestTime');
    const fee = document.getElementById('admAddRestFee');
    const desc = document.getElementById('admAddRestDesc');

    if (!name || !name.value.trim() || !window.FoodFlowStore) {
      showToast('Please enter restaurant name', 'error');
      return;
    }

    const newRest = window.FoodFlowStore.addRestaurant({
      name: name.value.trim(),
      image: image && image.value.trim() ? image.value.trim() : 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80',
      cuisine: cuisine && cuisine.value.trim() ? cuisine.value.trim() : 'Multi-Cuisine',
      deliveryTime: time && time.value.trim() ? time.value.trim() : '25–35',
      feeValue: fee ? Number(fee.value) : 30,
      desc: desc ? desc.value.trim() : 'Fresh culinary dishes prepared to order'
    });

    closeAdminModal('adminAddRestaurantModal');
    renderAdminRestaurants();
    showToast(`✓ Restaurant "${newRest.name}" registered!`, 'success');
  }

  function renderAdminMenu() {
    if (!window.FoodFlowStore) return;
    const filterRest = document.getElementById('admMenuRestSelect');
    const restId = filterRest ? filterRest.value : 'all';
    const items = window.FoodFlowStore.getMenuItems(restId);

    const container = document.getElementById('admMenuItemsContainer');
    if (!container) return;

    const byRest = {};
    items.forEach((item) => {
      if (!byRest[item.restaurant]) byRest[item.restaurant] = [];
      byRest[item.restaurant].push(item);
    });

    container.innerHTML = Object.entries(byRest)
      .map(
        ([restaurantName, restItems]) => `
      <div class="card" style="margin-bottom:1.5rem;">
        <div class="card-header">
          <span class="card-title">${restaurantName} (${restItems.length} items)</span>
          <button class="filter-btn outline" style="font-size:0.8rem;" onclick="openAddMenuModal()">+ Add Item</button>
        </div>
        <div class="card-body" style="padding:0 1.25rem;">
          ${restItems
            .map(
              (item) => `
            <div style="display:flex; align-items:center; gap:14px; padding:12px 0; border-bottom:1px solid var(--border);">
              <img src="${item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=100&q=80'}" class="admin-thumb-img" style="width:48px; height:48px;" alt="${item.name}">
              <div style="flex:1;">
                <div style="font-weight:700; font-size:0.95rem;">
                  ${item.name} ${item.veg ? '<span style="color:#17A865; font-size:0.75rem;">🌿 Veg</span>' : '<span style="color:#DC2626; font-size:0.75rem;">🍗 Non-Veg</span>'}
                </div>
                <div style="font-size:0.8rem; color:var(--text-muted);">${item.category} · ${item.desc || ''}</div>
              </div>
              <span style="font-weight:800; font-size:1rem; min-width:65px; text-align:right;">₹${item.price}</span>
              <div style="display:flex; align-items:center; gap:12px;">
                <label class="toggle" title="${item.available ? 'Item Available (Click to toggle)' : 'Item Unavailable'}">
                  <input type="checkbox" ${item.available ? 'checked' : ''} onchange="handleAdminToggleItemAvailability(${item.id}, this.checked)">
                  <span class="toggle-slider"></span>
                </label>
                <button class="action-btn danger" onclick="handleAdminDeleteItem(${item.id})">🗑️</button>
              </div>
            </div>`
            )
            .join('')}
        </div>
      </div>`
      )
      .join('');
  }

  function handleAdminToggleItemAvailability(itemId, isChecked) {
    if (!window.FoodFlowStore) return;
    window.FoodFlowStore.toggleMenuItemAvailability(itemId, isChecked);
    showToast(`Item #${itemId} marked ${isChecked ? 'AVAILABLE' : 'UNAVAILABLE'}`, 'info');
  }

  function handleAdminDeleteItem(itemId) {
    if (!window.FoodFlowStore) return;
    if (confirm('Are you sure you want to delete this menu item?')) {
      window.FoodFlowStore.deleteMenuItem(itemId);
      renderAdminMenu();
      showToast('Menu item deleted', 'info');
    }
  }

  function openAddMenuModal() {
    const modal = document.getElementById('adminAddMenuModal');
    if (modal) modal.classList.add('open');
  }

  function submitAdminAddMenuItem() {
    const name = document.getElementById('admAddItemName');
    const emoji = document.getElementById('admAddItemEmoji');
    const desc = document.getElementById('admAddItemDesc');
    const price = document.getElementById('admAddItemPrice');
    const category = document.getElementById('admAddItemCategory');
    const restSelect = document.getElementById('admAddItemRestSelect');
    const typeSelect = document.getElementById('admAddItemType');

    if (!name || !name.value.trim() || !price || !price.value || !window.FoodFlowStore) {
      showToast('Please provide an Item Name and Price', 'error');
      return;
    }

    const newItem = window.FoodFlowStore.addMenuItem({
      name: name.value.trim(),
      emoji: emoji && emoji.value.trim() ? emoji.value.trim() : '🍽️',
      desc: desc ? desc.value.trim() : '',
      price: Number(price.value),
      category: category && category.value.trim() ? category.value.trim() : 'Specials',
      restId: restSelect ? Number(restSelect.value) : 1,
      veg: typeSelect ? typeSelect.value === 'veg' : false,
      available: true
    });

    closeAdminModal('adminAddMenuModal');
    renderAdminMenu();
    showToast(`✓ Added "${newItem.name}" to menu!`, 'success');
  }

  function renderAdminPayments() {
    if (!window.FoodFlowStore) return;
    const payments = window.FoodFlowStore.getPayments();
    const table = document.getElementById('admPaymentsTable');
    if (!table) return;

    table.innerHTML = `
      <thead>
        <tr>
          <th>Txn ID</th>
          <th>Order ID</th>
          <th>Customer</th>
          <th>Amount</th>
          <th>Payment Method</th>
          <th>Timestamp</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${payments
          .map(
            (p) => `
          <tr style="${p.status === 'refunded' ? 'background:rgba(232,248,238,0.5);' : ''}">
            <td><strong style="font-size:0.82rem;">${p.id}</strong></td>
            <td>#${p.orderId}</td>
            <td>${p.customer}</td>
            <td>
              <strong style="${p.status === 'refunded' ? 'color:#166534;' : ''}">
                ${p.status === 'refunded' ? '-' : ''}₹${p.amount}
              </strong>
            </td>
            <td>
              <div style="font-size:0.82rem;">${p.method}</div>
              ${p.refundRef ? `<div style="font-size:0.7rem; color:#166534; font-family:var(--code-font);">Ref: ${p.refundRef}</div>` : ''}
            </td>
            <td style="font-size:0.8rem; color:var(--text-muted);">${p.time}</td>
            <td>
              <span class="badge ${p.status === 'success' ? 'badge-success' : p.status === 'refunded' ? 'badge-primary' : 'badge-danger'}">
                ${p.status === 'refunded' ? '💰 Refunded' : p.status === 'success' ? '✓ Success' : '✗ Failed'}
              </span>
            </td>
            <td>
              <button class="action-btn" onclick="openAdminReceiptModal('${p.orderId}')">📄 Receipt</button>
              ${p.status === 'failed' ? `<button class="action-btn success" onclick="handleAdminRetryPayment('${p.id}')">↩ Retry</button>` : ''}
            </td>
          </tr>`
          )
          .join('')}
      </tbody>`;
  }

  function handleAdminRetryPayment(txnId) {
    if (!window.FoodFlowStore) return;
    const res = window.FoodFlowStore.retryPayment(txnId);
    if (res) {
      renderAdminPayments();
      renderAdminOrders();
      renderAdminDashboard();
      showToast(`Payment ${txnId} re-processed successfully!`, 'success');
    }
  }

  function openAdminReceiptModal(orderId) {
    if (!window.FoodFlowStore) return;
    const order = window.FoodFlowStore.getOrderById(orderId);
    if (!order) return;

    const content = document.getElementById('receiptModalContent');
    if (content) {
      content.innerHTML = `
        <div style="text-align:center; margin-bottom:1.5rem;">
          <div style="font-size:2rem; font-weight:800;">🍕 Food<span style="color:var(--primary)">Flow</span></div>
          <div style="font-size:0.85rem; color:var(--text-muted);">Official Tax Invoice & Order Receipt</div>
        </div>
        <div style="background:var(--surface2); padding:1rem; border-radius:8px; margin-bottom:1rem; font-size:0.88rem;">
          <div><strong>Order ID:</strong> #${order.id}</div>
          <div><strong>Customer:</strong> ${order.customer} (${order.phone})</div>
          <div><strong>Restaurant:</strong> ${order.restaurant}</div>
          <div><strong>Date & Time:</strong> ${order.timeFormatted || 'Today'}</div>
          <div><strong>Payment Method:</strong> ${order.paymentMethod} (${order.paymentStatus})</div>
          <div><strong>Address:</strong> ${order.address}</div>
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:0.88rem; margin-bottom:1rem;">
          <thead>
            <tr style="border-bottom:1.5px solid var(--border); text-align:left;">
              <th style="padding:6px;">Item</th>
              <th style="padding:6px; text-align:center;">Qty</th>
              <th style="padding:6px; text-align:right;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${(order.items || [])
              .map(
                (i) => `
              <tr style="border-bottom:1px solid var(--border);">
                <td style="padding:6px; display:flex; align-items:center; gap:8px;">
                  <img src="${i.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=100&q=80'}" style="width:28px; height:28px; border-radius:4px; object-fit:cover;">
                  <span>${i.name}</span>
                </td>
                <td style="padding:6px; text-align:center;">×${i.qty}</td>
                <td style="padding:6px; text-align:right;">₹${i.price * i.qty}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
        <div style="display:flex; justify-content:space-between; font-size:0.88rem; margin-bottom:4px;"><span>Subtotal:</span><span>₹${order.subtotal}</span></div>
        <div style="display:flex; justify-content:space-between; font-size:0.88rem; margin-bottom:4px;"><span>Delivery Fee:</span><span>₹${order.deliveryFee}</span></div>
        <div style="display:flex; justify-content:space-between; font-size:0.88rem; margin-bottom:4px;"><span>Platform Fee:</span><span>₹${order.platformFee}</span></div>
        ${order.discount ? `<div style="display:flex; justify-content:space-between; font-size:0.88rem; color:var(--success); margin-bottom:4px;"><span>Discount:</span><span>-₹${order.discount}</span></div>` : ''}
        <hr style="margin:8px 0; border:none; border-top:1.5px solid var(--border);">
        <div style="display:flex; justify-content:space-between; font-size:1.1rem; font-weight:800;"><span>Total Paid:</span><span>₹${order.total}</span></div>
      `;
    }

    const modal = document.getElementById('receiptModal');
    if (modal) modal.classList.add('open');
  }

  function renderAdminHealth() {
    if (!window.FoodFlowStore) return;
    const logContainer = document.getElementById('adminLiveLogOutput');
    if (!logContainer) return;
    const logs = window.FoodFlowStore.getLogs();

    logContainer.innerHTML = logs
      .map((l) => {
        const color = l.type === 'WARN' ? '#F7B733' : l.type === 'ERROR' ? '#DC2626' : '#17A865';
        return `<div><span style="color:${color}; font-weight:bold;">[${l.type}]</span> <span style="color:#777;">${l.time}</span> ${l.text}</div>`;
      })
      .join('');

    logContainer.scrollTop = logContainer.scrollHeight;
  }

  function handleGenerateTestLog() {
    if (!window.FoodFlowStore) return;
    window.FoodFlowStore.addLog('INFO', `Manual health check performed by Super Admin (${new Date().toLocaleTimeString()})`);
    showToast('Test system log appended', 'info');
  }

  function renderAdminSettingsPromos() {
    if (!window.FoodFlowStore) return;
    const promos = window.FoodFlowStore.getPromos();
    const container = document.getElementById('admSettingsPromosList');
    if (!container) return;

    container.innerHTML = promos
      .map(
        (p) => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border);">
        <div>
          <div style="font-weight:700;">${p.code}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${p.description} (Min ₹${p.minOrder})</div>
        </div>
        <span class="badge ${p.status === 'active' ? 'badge-success' : 'badge-neutral'}">${p.status}</span>
      </div>`
      )
      .join('');
  }

  function openAddPromoModal() {
    const modal = document.getElementById('adminAddPromoModal');
    if (modal) modal.classList.add('open');
  }

  function submitAdminAddPromo() {
    const code = document.getElementById('admAddPromoCode');
    const discount = document.getElementById('admAddPromoDiscount');
    const minOrder = document.getElementById('admAddPromoMinOrder');
    const desc = document.getElementById('admAddPromoDesc');

    if (!code || !code.value.trim() || !window.FoodFlowStore) {
      showToast('Please enter promo code', 'error');
      return;
    }

    const newP = window.FoodFlowStore.addPromo({
      code: code.value.trim(),
      discount: discount ? Number(discount.value) : 20,
      minOrder: minOrder ? Number(minOrder.value) : 199,
      description: desc && desc.value.trim() ? desc.value.trim() : 'Special discount coupon'
    });

    closeAdminModal('adminAddPromoModal');
    renderAdminSettingsPromos();
    showToast(`✓ Promo code ${newP.code} created!`, 'success');
  }

  function closeAdminModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('open');
  }

  // ═══════════════════════ HELPERS & UTILITIES ═══════════════════════
  function getBadgeForStatus(status) {
    const map = {
      pending: 'badge-warning',
      preparing: 'badge-primary',
      'on-the-way': 'badge-info',
      delivered: 'badge-success',
      cancelled: 'badge-danger',
      active: 'badge-success',
      inactive: 'badge-neutral',
      suspended: 'badge-danger',
      success: 'badge-success',
      failed: 'badge-danger'
    };

    const labels = {
      'on-the-way': '🛵 On the Way',
      preparing: '👨‍🍳 Preparing',
      pending: '⏳ Pending',
      delivered: '✓ Delivered',
      cancelled: '✗ Cancelled',
      active: '● Active',
      inactive: '○ Inactive',
      suspended: '⊘ Suspended',
      success: '✓ Success',
      failed: '✗ Failed'
    };

    return `<span class="badge ${map[status] || 'badge-neutral'}">${labels[status] || status}</span>`;
  }

  // Safe continuous background health logger
  setInterval(() => {
    if (!window.FoodFlowStore) return;
    const msgs = [
      ['INFO', 'GET /api/v1/restaurants 200 OK — 14ms'],
      ['INFO', 'Database heartbeat OK — connections stable (14/100)'],
      ['INFO', 'Docker container healthcheck PASSED (uptime 14d 6h)'],
      ['INFO', 'Jenkins CI pipeline #142 status: STABLE (0 failures)'],
      ['INFO', 'Payment gateway webhooks listener alive (98.7% success rate)']
    ];
    const rand = msgs[Math.floor(Math.random() * msgs.length)];
    window.FoodFlowStore.addLog(rand[0], rand[1]);
  }, 10000);

  function setupLiveValidationListeners() {
    const bindLive = (id, validator) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => {
        validator(el.value, false);
      });
      el.addEventListener('blur', () => {
        validator(el.value, true);
      });
    };

    // Login fields
    bindLive('loginEmailField', (val, isBlur) => {
      if (!val && isBlur) showFieldError('loginEmailField', 'Email address is required.');
      else if (val && !ValidationUtils.isValidEmail(val) && isBlur) showFieldError('loginEmailField', 'Please enter a valid email format (e.g. name@example.com).');
      else if (val && ValidationUtils.isValidEmail(val)) clearFieldError('loginEmailField');
    });

    bindLive('loginPasswordField', (val, isBlur) => {
      if (!val && isBlur) showFieldError('loginPasswordField', 'Password is required.');
      else if (val && val.length >= 6) clearFieldError('loginPasswordField');
    });

    // Registration fields
    bindLive('regFirstName', (val, isBlur) => {
      if (!val && isBlur) showFieldError('regFirstName', 'First name is required.');
      else if (val && !ValidationUtils.isValidName(val) && isBlur) showFieldError('regFirstName', 'First name must contain 2-35 letters only.');
      else if (val && ValidationUtils.isValidName(val)) clearFieldError('regFirstName');
    });

    bindLive('regLastName', (val, isBlur) => {
      if (val && !ValidationUtils.isValidLastName(val) && isBlur) showFieldError('regLastName', 'Last name must contain letters only.');
      else if (!val || ValidationUtils.isValidLastName(val)) clearFieldError('regLastName');
    });

    bindLive('regEmail', (val, isBlur) => {
      if (!val && isBlur) showFieldError('regEmail', 'Email address is required.');
      else if (val && !ValidationUtils.isValidEmail(val) && isBlur) showFieldError('regEmail', 'Please enter a valid email format.');
      else if (val && ValidationUtils.isValidEmail(val)) {
        if (window.FoodFlowStore && window.FoodFlowStore.getUserByEmail(val)) {
          showFieldError('regEmail', 'An account with this email already exists.');
        } else {
          clearFieldError('regEmail');
        }
      }
    });

    bindLive('regPhone', (val, isBlur) => {
      if (!val && isBlur) showFieldError('regPhone', 'Mobile number is required.');
      else if (val && !ValidationUtils.isValidPhone(val) && isBlur) showFieldError('regPhone', 'Please enter a valid 10-digit mobile number.');
      else if (val && ValidationUtils.isValidPhone(val)) clearFieldError('regPhone');
    });

    const regPass = document.getElementById('regPassword');
    if (regPass) {
      regPass.addEventListener('input', () => {
        updatePasswordStrengthUI('regPassword', 'regPassStrengthContainer', 'regPassStrengthBar', 'regPassStrengthLabel');
        const str = ValidationUtils.evaluatePasswordStrength(regPass.value);
        if (str.isValid) clearFieldError('regPassword');
      });
      regPass.addEventListener('blur', () => {
        const str = ValidationUtils.evaluatePasswordStrength(regPass.value);
        if (!regPass.value) showFieldError('regPassword', 'Password is required.');
        else if (!str.isValid) showFieldError('regPassword', 'Min 8 chars with uppercase, lowercase, number & symbol.');
        else clearFieldError('regPassword');
      });
    }

    bindLive('regConfirmPassword', (val, isBlur) => {
      const p = document.getElementById('regPassword') ? document.getElementById('regPassword').value : '';
      if (!val && isBlur) showFieldError('regConfirmPassword', 'Please confirm your password.');
      else if (val && val !== p && isBlur) showFieldError('regConfirmPassword', 'Passwords do not match.');
      else if (val && val === p) clearFieldError('regConfirmPassword');
    });

    const forgotNewPass = document.getElementById('forgotNewPasswordField');
    if (forgotNewPass) {
      forgotNewPass.addEventListener('input', () => {
        updatePasswordStrengthUI('forgotNewPasswordField', 'forgotPassStrengthContainer', 'forgotPassStrengthBar', 'forgotPassStrengthLabel');
        const str = ValidationUtils.evaluatePasswordStrength(forgotNewPass.value);
        if (str.isValid) clearFieldError('forgotNewPasswordField');
      });
    }
  }

  function updateDbStatusUI() {
    if (!window.FoodFlowStore) return;
    const isConn = window.FoodFlowStore.isMysqlConnected;
    const badge = document.getElementById('topDbStatusBadge');
    const dot = document.getElementById('topDbStatusDot');
    const text = document.getElementById('topDbStatusText');
    const modalStatus = document.getElementById('modalDbLiveStatus');
    const modalDetails = document.getElementById('modalDbLiveDetails');

    if (badge && text) {
      if (isConn) {
        badge.className = 'db-status-badge connected';
        if (dot) dot.style.background = '#22C55E';
        text.innerHTML = '🟢 MySQL: foodflow_db (Port 3306)';
      } else {
        badge.className = 'db-status-badge offline';
        if (dot) dot.style.background = '#EAB308';
        text.innerHTML = '🟡 MySQL: Offline (Local Mode)';
      }
    }

    if (modalStatus) {
      if (isConn) {
        modalStatus.innerHTML = '🟢 Connected to MySQL (foodflow_db)';
        modalStatus.style.color = 'var(--success)';
        if (modalDetails) modalDetails.innerHTML = 'Live queries and order records are saving directly to MySQL database tables.';
      } else {
        modalStatus.innerHTML = '🟡 MySQL Server Offline (Running in Local Mode)';
        modalStatus.style.color = 'var(--warning)';
        if (modalDetails) modalDetails.innerHTML = 'Follow the steps below to execute schema.sql in MySQL Workbench and start the backend server.';
      }
    }
  }

  function openMysqlHelperModal() {
    updateDbStatusUI();
    const modal = document.getElementById('mysqlHelperModal');
    if (modal) modal.classList.add('open');
  }

  async function handleRetestMysqlConnection() {
    showToast('Probing MySQL database server on port 5000 / 3306...', 'info');
    if (window.FoodFlowStore) {
      await window.FoodFlowStore.probeMysqlServer();
      updateDbStatusUI();
      if (window.FoodFlowStore.isMysqlConnected) {
        showToast('✓ Connected to MySQL database successfully! 🎉', 'success');
      } else {
        showToast('MySQL backend is offline. Run "npm start" in terminal.', 'error');
      }
    }
  }

  // Reactive Store Event Subscription
  if (window.FoodFlowStore) {
    window.FoodFlowStore.subscribe((eventType, payload) => {
      if (eventType === 'order_placed') {
        SoundEffects.playAlert();
        updateAdminBadges();
        if (AppState.activeAdminPage === 'dashboard') renderAdminDashboard();
        if (AppState.activeAdminPage === 'orders') renderAdminOrders();
        if (AppState.activeAdminPage === 'payments') renderAdminPayments();
        if (AppState.activePortal === 'admin') {
          showToast(`🔔 New Order #${payload.id} received from ${payload.customer}!`, 'info');
        }
      }

      if (eventType === 'order_status_updated') {
        if (AppState.currentTrackingOrderId === payload.orderId) {
          renderLiveOrderTracker(payload.order);
          SoundEffects.playSuccess();
          showToast(`Order #${payload.orderId} status: ${payload.newStatus.toUpperCase()}`, 'info');
        }
        if (AppState.activeCustomerScreen === 'profile') {
          renderProfileContent(AppState.activeProfileTab);
        }
        if (AppState.activePortal === 'admin') {
          renderAdminOrders();
          renderAdminDashboard();
          updateAdminBadges();
        }
      }

      if (eventType === 'menu_availability_changed' || eventType === 'menu_item_added' || eventType === 'menu_item_updated' || eventType === 'menu_item_deleted') {
        if (AppState.selectedRestaurant) {
          renderCustomerMenuItems(AppState.selectedRestaurant);
        }
        if (AppState.activeAdminPage === 'menu') {
          renderAdminMenu();
        }
      }

      if (eventType === 'user_registered' || eventType === 'user_status_changed') {
        renderAdminUsers();
      }

      if (eventType === 'log_appended') {
        if (AppState.activeAdminPage === 'health') {
          renderAdminHealth();
        }
      }

      if (eventType === 'db_status_changed' || eventType === 'mysql_synced') {
        updateDbStatusUI();
        if (AppState.activeAdminPage === 'dashboard') renderAdminDashboard();
        if (AppState.activeAdminPage === 'orders') renderAdminOrders();
        if (AppState.activeAdminPage === 'users') renderAdminUsers();
        if (AppState.activeAdminPage === 'menu') renderAdminMenu();
      }
    });
  }

  // Initialize UI Function
  function initApp() {
    renderCustomerHome();
    updateCustomerCartUI();
    updateCustomerAuthUI();
    renderAdminDashboard();
    renderAdminOrders();
    renderAdminUsers();
    renderAdminRestaurants();
    renderAdminMenu();
    renderAdminPayments();
    renderAdminSettingsPromos();
    updateAdminBadges();
    setupLiveValidationListeners();
    updateDbStatusUI();
    setTimeout(updateDbStatusUI, 1200);
  }

  // Bind all functions to Global Window Scope
  window.AppState = AppState;
  window.SoundEffects = SoundEffects;
  window.ValidationUtils = ValidationUtils;
  window.showFieldError = showFieldError;
  window.clearFieldError = clearFieldError;
  window.resetFieldState = resetFieldState;
  window.togglePasswordVisibility = togglePasswordVisibility;
  window.updatePasswordStrengthUI = updatePasswordStrengthUI;
  window.updateDbStatusUI = updateDbStatusUI;
  window.openMysqlHelperModal = openMysqlHelperModal;
  window.handleRetestMysqlConnection = handleRetestMysqlConnection;
  window.showToast = showToast;
  window.switchPortal = switchPortal;
  window.handleDemoRoleSwitch = handleDemoRoleSwitch;
  window.showCustomerScreen = showCustomerScreen;
  window.renderCustomerHome = renderCustomerHome;
  window.filterByCuisinePill = filterByCuisinePill;
  window.handleCustomerSearch = handleCustomerSearch;
  window.openCustomerRestaurant = openCustomerRestaurant;
  window.renderCustomerMenuItems = renderCustomerMenuItems;
  window.jumpToMenuCategory = jumpToMenuCategory;
  window.customerAddToCart = customerAddToCart;
  window.customerUpdateQty = customerUpdateQty;
  window.updateCustomerCartUI = updateCustomerCartUI;
  window.renderCustomerSideCart = renderCustomerSideCart;
  window.proceedToCheckout = proceedToCheckout;
  window.renderCheckoutSummary = renderCheckoutSummary;
  window.handleApplyPromo = handleApplyPromo;
  window.selectPaymentMethod = selectPaymentMethod;
  window.handlePlaceOrder = handlePlaceOrder;
  window.renderLiveOrderTracker = renderLiveOrderTracker;
  window.simulateNextTrackingStep = simulateNextTrackingStep;
  window.openCustomerProfile = openCustomerProfile;
  window.setProfileTab = setProfileTab;
  window.renderProfileContent = renderProfileContent;
  window.saveCustomerProfileSettings = saveCustomerProfileSettings;
  window.openAddAddressModal = openAddAddressModal;
  window.submitCustomerAddress = submitCustomerAddress;
  window.viewOrderTrackingLive = viewOrderTrackingLive;
  window.reorderCustomerItems = reorderCustomerItems;
  window.openAuthModal = openAuthModal;
  window.closeAuthModal = closeAuthModal;
  window.setAuthTabMode = setAuthTabMode;
  window.handleCustomerLogin = handleCustomerLogin;
  window.handleCustomerRegister = handleCustomerRegister;
  window.showForgotStep = showForgotStep;
  window.handleRequestPasswordOTP = handleRequestPasswordOTP;
  window.copySimulatedOtp = copySimulatedOtp;
  window.autoFillOtpBoxes = autoFillOtpBoxes;
  window.quickFillForgotInput = quickFillForgotInput;
  window.handleVerifyPasswordOTP = handleVerifyPasswordOTP;
  window.handleNewPasswordLiveCheck = handleNewPasswordLiveCheck;
  window.handleConfirmPasswordLiveCheck = handleConfirmPasswordLiveCheck;
  window.handleSubmitNewPassword = handleSubmitNewPassword;
  window.handleFinishPasswordReset = handleFinishPasswordReset;
  window.handleCustomerLogout = handleCustomerLogout;
  window.updateCustomerAuthUI = updateCustomerAuthUI;
  window.showAdminPage = showAdminPage;
  window.updateAdminBadges = updateAdminBadges;
  window.renderAdminDashboard = renderAdminDashboard;
  window.renderAdminOrders = renderAdminOrders;
  window.filterAdminOrdersQuery = filterAdminOrdersQuery;
  window.filterAdminOrdersStatus = filterAdminOrdersStatus;
  window.handleAdminExportCSV = handleAdminExportCSV;
  window.openAdminOrderStatusModal = openAdminOrderStatusModal;
  window.submitAdminOrderStatus = submitAdminOrderStatus;
  window.renderAdminUsers = renderAdminUsers;
  window.filterAdminUsersQuery = filterAdminUsersQuery;
  window.filterAdminUsersRole = filterAdminUsersRole;
  window.handleAdminToggleUser = handleAdminToggleUser;
  window.openAddUserModal = openAddUserModal;
  window.submitAdminAddUser = submitAdminAddUser;
  window.renderAdminRestaurants = renderAdminRestaurants;
  window.filterAdminRestaurantsQuery = filterAdminRestaurantsQuery;
  window.handleAdminToggleRestaurant = handleAdminToggleRestaurant;
  window.openAddRestaurantModal = openAddRestaurantModal;
  window.submitAdminAddRestaurant = submitAdminAddRestaurant;
  window.renderAdminMenu = renderAdminMenu;
  window.handleAdminToggleItemAvailability = handleAdminToggleItemAvailability;
  window.handleAdminDeleteItem = handleAdminDeleteItem;
  window.openAddMenuModal = openAddMenuModal;
  window.submitAdminAddMenuItem = submitAdminAddMenuItem;
  window.renderAdminPayments = renderAdminPayments;
  window.handleAdminRetryPayment = handleAdminRetryPayment;
  window.openAdminReceiptModal = openAdminReceiptModal;
  window.renderAdminHealth = renderAdminHealth;
  window.handleGenerateTestLog = handleGenerateTestLog;
  window.renderAdminSettingsPromos = renderAdminSettingsPromos;
  window.openSwiggyPaymentModal = openSwiggyPaymentModal;
  window.switchPaymentTab = switchPaymentTab;
  window.selectUpiApp = selectUpiApp;
  window.submitCustomUpiPay = submitCustomUpiPay;
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
  window.openCustomerCancelModal = openCustomerCancelModal;
  window.confirmCustomerOrderCancellation = confirmCustomerOrderCancellation;
  window.openAdminCancelModal = openAdminCancelModal;
  window.handleAdminCancelReasonChange = handleAdminCancelReasonChange;
  window.submitAdminCancelOrder = submitAdminCancelOrder;
  window.closeAdminModal = closeAdminModal;
  window.getBadgeForStatus = getBadgeForStatus;

  // Run on ready or immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
