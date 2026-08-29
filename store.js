/**
 * FoodFlow - Centralized Reactive Data Store (Bulletproof & Crash-Resistant)
 * Works in file://, http://, https://, and private/isolated browser contexts.
 */

(function () {
  'use strict';

  const STORAGE_KEYS = {
    ORDERS: 'foodflow_orders_v2',
    RESTAURANTS: 'foodflow_restaurants_v2',
    MENU_ITEMS: 'foodflow_menu_items_v2',
    USERS: 'foodflow_users_v2',
    PAYMENTS: 'foodflow_payments_v2',
    PROMOS: 'foodflow_promos_v2',
    SETTINGS: 'foodflow_settings_v2',
    CURRENT_USER: 'foodflow_current_user_v2',
    LOGS: 'foodflow_system_logs_v2',
    CART: 'foodflow_cart_v2',
    ADDRESSES: 'foodflow_addresses_v2'
  };

  // Safe In-Memory Storage Fallback
  const memoryStore = {};

  function safeStorageGet(key) {
    try {
      if (typeof localStorage !== 'undefined') {
        const val = localStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch (e) {}
    return memoryStore[key] || null;
  }

  function safeStorageSet(key, val) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, val);
      }
    } catch (e) {}
    memoryStore[key] = val;
  }

  function safeStorageRemove(key) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch (e) {}
    delete memoryStore[key];
  }

  // Safe BroadcastChannel initialization
  let syncChannel = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      syncChannel = new BroadcastChannel('foodflow_sync_channel');
    }
  } catch (e) {
    console.log('FoodFlow: BroadcastChannel running in fallback mode');
  }

  // Pre-seeded Restaurants with Real High-Resolution Food Photography
  const INITIAL_RESTAURANTS = [
    {
      id: 1,
      name: 'Spice Garden',
      image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80',
      cuisine: 'Biryani',
      rating: 4.8,
      deliveryTime: '25–35',
      fee: 'Free',
      feeValue: 0,
      tag: 'Trending',
      desc: 'Authentic Hyderabadi biryani, aromatic curries & tandoori specials',
      status: 'active',
      ordersCount: 48,
      revenue: 27360,
      location: 'Banjara Hills, Hyderabad'
    },
    {
      id: 2,
      name: 'Pizza Republic',
      image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
      cuisine: 'Pizza',
      rating: 4.6,
      deliveryTime: '30–40',
      fee: '₹30',
      feeValue: 30,
      tag: 'Popular',
      desc: 'Wood-fired gourmet pizzas crafted with artisanal San Marzano sauce',
      status: 'active',
      ordersCount: 35,
      revenue: 16905,
      location: 'Jubilee Hills, Hyderabad'
    },
    {
      id: 3,
      name: 'Burger Barn',
      image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80',
      cuisine: 'Burger',
      rating: 4.5,
      deliveryTime: '20–30',
      fee: '₹20',
      feeValue: 20,
      tag: 'Fast Delivery',
      desc: 'Juicy smashed patties, crispy chicken brioche & loaded fries',
      status: 'active',
      ordersCount: 29,
      revenue: 13717,
      location: 'Madhapur, Hyderabad'
    },
    {
      id: 4,
      name: 'Wok & Roll',
      image: 'https://images.unsplash.com/photo-1552611052-33e04de081de?auto=format&fit=crop&w=600&q=80',
      cuisine: 'Chinese',
      rating: 4.4,
      deliveryTime: '25–35',
      fee: '₹30',
      feeValue: 30,
      tag: 'Trending',
      desc: 'Sizzling Indo-Chinese wok specialties, momos & spicy noodles',
      status: 'active',
      ordersCount: 22,
      revenue: 11154,
      location: 'Gachibowli, Hyderabad'
    },
    {
      id: 5,
      name: 'Dosa Delight',
      image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=600&q=80',
      cuisine: 'South Indian',
      rating: 4.9,
      deliveryTime: '15–25',
      fee: 'Free',
      feeValue: 0,
      tag: 'Top Rated',
      desc: 'Crispy ghee roast dosas, fluffy idlis & traditional filter coffee',
      status: 'active',
      ordersCount: 41,
      revenue: 8610,
      location: 'Kukatpally, Hyderabad'
    },
    {
      id: 6,
      name: 'Sweet Cravings',
      image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80',
      cuisine: 'Desserts',
      rating: 4.7,
      deliveryTime: '20–30',
      fee: '₹25',
      feeValue: 25,
      tag: 'Sweet Tooth',
      desc: 'Molten chocolate lava cakes, artisan cheesecakes & creamy kulfis',
      status: 'active',
      ordersCount: 18,
      revenue: 5670,
      location: 'Kondapur, Hyderabad'
    }
  ];

  // Pre-seeded Menu Items with Real High-Resolution Food Photography
  const INITIAL_MENU_ITEMS = [
    // Spice Garden
    { id: 101, restId: 1, restaurant: 'Spice Garden', name: 'Royal Chicken Dum Biryani', category: 'Biryani', desc: 'Fragrant aged Basmati rice layered with tender spiced chicken, saffron, and fresh mint. Served with spicy mirchi ka salan and dahi raita.', price: 199, image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=400&q=80', badges: ['bestseller', 'spicy'], veg: false, available: true },
    { id: 102, restId: 1, restaurant: 'Spice Garden', name: 'Hyderabadi Mutton Biryani', category: 'Biryani', desc: 'Slow-cooked succulent tender goat meat with long-grain Basmati rice, cooked on gentle charcoal dum.', price: 249, image: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=400&q=80', badges: ['spicy'], veg: false, available: true },
    { id: 103, restId: 1, restaurant: 'Spice Garden', name: 'Paneer Tikka Biryani', category: 'Biryani', desc: 'Fresh garden vegetables and char-grilled cottage cheese in aromatic basmati, dum-cooked.', price: 149, image: 'https://images.unsplash.com/photo-1642821373181-696a54913e93?auto=format&fit=crop&w=400&q=80', badges: ['veg'], veg: true, available: true },
    { id: 104, restId: 1, restaurant: 'Spice Garden', name: 'Chicken 65', category: 'Starters', desc: 'Crispy deep-fried boneless chicken tossed in southern curd, curry leaves, and spicy red masala.', price: 149, image: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=400&q=80', badges: ['spicy', 'bestseller'], veg: false, available: true },
    { id: 105, restId: 1, restaurant: 'Spice Garden', name: 'Tandoori Paneer Tikka', category: 'Starters', desc: 'Clay oven grilled cottage cheese cubes marinated in spiced hung curd with spicy mint chutney.', price: 129, image: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=400&q=80', badges: ['veg', 'bestseller'], veg: true, available: true },
    { id: 106, restId: 1, restaurant: 'Spice Garden', name: 'Gulab Jamun (2 pcs)', category: 'Desserts', desc: 'Melt-in-mouth warm khoya dumplings soaked in fragrant cardamom & rose sugar syrup.', price: 59, image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=400&q=80', badges: ['veg'], veg: true, available: true },

    // Pizza Republic
    { id: 201, restId: 2, restaurant: 'Pizza Republic', name: 'Margherita Classica', category: 'Classic Pizzas', desc: 'San Marzano tomato sauce, fresh buffalo mozzarella & fragrant sweet basil leaves.', price: 199, image: 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=400&q=80', badges: ['veg', 'bestseller'], veg: true, available: true },
    { id: 202, restId: 2, restaurant: 'Pizza Republic', name: 'BBQ Smoky Chicken Pizza', category: 'Classic Pizzas', desc: 'Smoky BBQ glazed chicken chunks, caramelized onions, jalapeños & double mozzarella.', price: 279, image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80', badges: ['bestseller'], veg: false, available: true },
    { id: 203, restId: 2, restaurant: 'Pizza Republic', name: 'Pepperoni Supreme', category: 'Classic Pizzas', desc: 'Cured Italian pepperoni slices, melted mozzarella & aromatic oregano seasoning.', price: 259, image: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=400&q=80', badges: [], veg: false, available: true },
    { id: 204, restId: 2, restaurant: 'Pizza Republic', name: 'Truffle Mushroom Pizza', category: 'Specialty', desc: 'Wild portobello mushrooms, black truffle oil, shaved parmesan & fresh baby arugula.', price: 319, image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=400&q=80', badges: ['veg'], veg: true, available: true },
    { id: 205, restId: 2, restaurant: 'Pizza Republic', name: 'Cheesy Garlic Breadsticks', category: 'Sides', desc: 'Freshly baked artisan baguette loaded with roasted garlic herb butter and gooey mozzarella.', price: 79, image: 'https://images.unsplash.com/photo-1619535860434-ba1d8fa12536?auto=format&fit=crop&w=400&q=80', badges: ['veg'], veg: true, available: true },

    // Burger Barn
    { id: 301, restId: 3, restaurant: 'Burger Barn', name: 'Classic Smash Cheeseburger', category: 'Burgers', desc: 'Double smashed patties, melted cheddar, crisp dill pickles & signature house burger sauce.', price: 199, image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80', badges: ['bestseller'], veg: false, available: true },
    { id: 302, restId: 3, restaurant: 'Burger Barn', name: 'Crispy Peri-Peri Chicken Burger', category: 'Burgers', desc: '24hr buttermilk marinated fried chicken breast with spicy peri-peri rub & creamy slaw.', price: 179, image: 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format&fit=crop&w=400&q=80', badges: ['bestseller', 'spicy'], veg: false, available: true },
    { id: 303, restId: 3, restaurant: 'Burger Barn', name: 'Smoky Black Bean Veg Burger', category: 'Burgers', desc: 'Crispy black bean & roasted corn patty, avocado slices, caramelized onions & herb mayo.', price: 159, image: 'https://images.unsplash.com/photo-1585238342024-78d387f4a707?auto=format&fit=crop&w=400&q=80', badges: ['veg'], veg: true, available: true },
    { id: 304, restId: 3, restaurant: 'Burger Barn', name: 'Loaded Peri-Peri Truffle Fries', category: 'Sides', desc: 'Crispy skin-on french fries smothered in warm cheese sauce, peri-peri seasoning & jalapeños.', price: 99, image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=400&q=80', badges: ['veg'], veg: true, available: true },
    { id: 305, restId: 3, restaurant: 'Burger Barn', name: 'Crispy Onion Rings', category: 'Sides', desc: 'Golden crispy thick-cut beer-battered onion rings served with smoky chipotle dip.', price: 79, image: 'https://images.unsplash.com/photo-1639024471287-0351860db52e?auto=format&fit=crop&w=400&q=80', badges: ['veg'], veg: true, available: true },

    // Wok & Roll
    { id: 401, restId: 4, restaurant: 'Wok & Roll', name: 'Chicken Hakka Noodles', category: 'Noodles & Rice', desc: 'High flame wok-tossed noodles with tender chicken shreds, crunchy cabbage & soya garlic sauce.', price: 169, image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=400&q=80', badges: ['bestseller', 'spicy'], veg: false, available: true },
    { id: 402, restId: 4, restaurant: 'Wok & Roll', name: 'Schezwan Veg Fried Rice', category: 'Noodles & Rice', desc: 'Fiery Schezwan tossed long grain rice with garden fresh diced vegetables and spring onions.', price: 129, image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=400&q=80', badges: ['veg', 'spicy'], veg: true, available: true },
    { id: 403, restId: 4, restaurant: 'Wok & Roll', name: 'Steamed Chicken Dumplings (6 pcs)', category: 'Starters', desc: 'Delicate steamed dumplings stuffed with minced seasoned chicken and scallions with chili dip.', price: 179, image: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=400&q=80', badges: ['bestseller'], veg: false, available: true },
    { id: 404, restId: 4, restaurant: 'Wok & Roll', name: 'Chilli Chicken Dry', category: 'Starters', desc: 'Wok-seared crispy chicken tossed with green chillies, garlic, capsicum and spicy soy reduction.', price: 169, image: 'https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=400&q=80', badges: ['spicy'], veg: false, available: true },

    // Dosa Delight
    { id: 501, restId: 5, restaurant: 'Dosa Delight', name: 'Butter Masala Dosa', category: 'Dosas', desc: 'Golden crispy fermented rice crepe smeared with pure butter and stuffed with spiced potato masala.', price: 89, image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=400&q=80', badges: ['veg', 'bestseller'], veg: true, available: true },
    { id: 502, restId: 5, restaurant: 'Dosa Delight', name: 'Ghee Roast Paper Dosa', category: 'Dosas', desc: 'Ultra-crispy giant paper thin dosa roasted generously in aromatic desi cow ghee.', price: 99, image: 'https://images.unsplash.com/photo-1688583488220-410a514d4e0b?auto=format&fit=crop&w=400&q=80', badges: ['veg'], veg: true, available: true },
    { id: 503, restId: 5, restaurant: 'Dosa Delight', name: 'Steamed Idli Sambar Combo', category: 'Tiffin', desc: 'Steaming fluffy idlis and crunchy medu vada served with hot drumstick sambar & 3 chutneys.', price: 69, image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=400&q=80', badges: ['veg'], veg: true, available: true },
    { id: 504, restId: 5, restaurant: 'Dosa Delight', name: 'Crispy Medu Vada (2 pcs)', category: 'Tiffin', desc: 'Deep-fried golden crunchy urad dal fritters with ginger, curry leaves & coconut chutney.', price: 59, image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=400&q=80', badges: ['veg'], veg: true, available: true },
    { id: 505, restId: 5, restaurant: 'Dosa Delight', name: 'Authentic Madras Filter Coffee', category: 'Beverages', desc: 'Traditional frothy chicory-infused filter coffee brewed with rich hot milk.', price: 39, image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80', badges: ['veg'], veg: true, available: true },

    // Sweet Cravings
    { id: 601, restId: 6, restaurant: 'Sweet Cravings', name: 'Molten Chocolate Lava Cake', category: 'Cakes', desc: 'Decadent dark chocolate sponge with rich molten fudge center & vanilla bean cream.', price: 149, image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=400&q=80', badges: ['veg', 'bestseller'], veg: true, available: true },
    { id: 602, restId: 6, restaurant: 'Sweet Cravings', name: 'New York Strawberry Cheesecake', category: 'Cakes', desc: 'Classic baked rich cream cheese slice crowned with fresh glazed strawberry compote.', price: 169, image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=400&q=80', badges: ['veg'], veg: true, available: true },
    { id: 603, restId: 6, restaurant: 'Sweet Cravings', name: 'Royal Alphonso Mango Kulfi', category: 'Ice Cream', desc: 'Traditional slow-reduced dense milk kulfi infused with pure Alphonso mango pulp & pistachios.', price: 89, image: 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?auto=format&fit=crop&w=400&q=80', badges: ['veg'], veg: true, available: true }
  ];

  // Pre-seeded Orders
  const INITIAL_ORDERS = [
    {
      id: 'FF2A8X3K',
      customer: 'Ravi Kumar',
      email: 'ravi@example.com',
      phone: '9876543210',
      restaurantId: 1,
      restaurant: 'Spice Garden',
      items: [
        { id: 101, name: 'Royal Chicken Dum Biryani', price: 199, qty: 2, image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=400&q=80' },
        { id: 105, name: 'Tandoori Paneer Tikka', price: 129, qty: 1, image: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=400&q=80' }
      ],
      itemsSummary: 'Royal Chicken Dum Biryani ×2, Tandoori Paneer Tikka ×1',
      subtotal: 527,
      deliveryFee: 0,
      platformFee: 5,
      discount: 0,
      total: 532,
      status: 'preparing',
      paymentMethod: 'UPI (Google Pay)',
      paymentStatus: 'success',
      refundStatus: 'none',
      refundAmount: 0,
      address: 'Flat 4B, Palm Grove Apartments, Malkajgiri, Hyderabad - 500047',
      notes: 'Please add extra green mint chutney and onions.',
      createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
      timeFormatted: '15 mins ago'
    },
    {
      id: 'FF3B7Y1M',
      customer: 'Priya Sharma',
      email: 'priya@example.com',
      phone: '9123456789',
      restaurantId: 2,
      restaurant: 'Pizza Republic',
      items: [
        { id: 201, name: 'Margherita Classica', price: 199, qty: 1, image: 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=400&q=80' },
        { id: 205, name: 'Cheesy Garlic Breadsticks', price: 79, qty: 2, image: 'https://images.unsplash.com/photo-1619535860434-ba1d8fa12536?auto=format&fit=crop&w=400&q=80' }
      ],
      itemsSummary: 'Margherita Classica ×1, Cheesy Garlic Breadsticks ×2',
      subtotal: 357,
      deliveryFee: 30,
      platformFee: 5,
      discount: 0,
      total: 392,
      status: 'delivered',
      paymentMethod: 'Credit Card (Visa •••• 4242)',
      paymentStatus: 'success',
      refundStatus: 'none',
      refundAmount: 0,
      address: 'Plot 42, Jubilee Hills Road No. 36, Hyderabad - 500033',
      notes: 'Leave at front desk.',
      createdAt: new Date(Date.now() - 120 * 60000).toISOString(),
      timeFormatted: '2 hrs ago'
    },
    {
      id: 'FF4C9Z2P',
      customer: 'Ananya Patel',
      email: 'ananya@example.com',
      phone: '9723456789',
      restaurantId: 3,
      restaurant: 'Burger Barn',
      items: [
        { id: 301, name: 'Classic Smash Cheeseburger', price: 199, qty: 2, image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80' },
        { id: 304, name: 'Loaded Peri-Peri Truffle Fries', price: 99, qty: 1, image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=400&q=80' }
      ],
      itemsSummary: 'Classic Smash Cheeseburger ×2, Loaded Peri-Peri Truffle Fries ×1',
      subtotal: 477,
      deliveryFee: 20,
      platformFee: 5,
      discount: 100,
      total: 402,
      status: 'on-the-way',
      paymentMethod: 'UPI (PhonePe)',
      paymentStatus: 'success',
      refundStatus: 'none',
      refundAmount: 0,
      address: 'Villa 15, Green Meadows, Gachibowli, Hyderabad - 500032',
      notes: 'Do not ring the bell.',
      createdAt: new Date(Date.now() - 35 * 60000).toISOString(),
      timeFormatted: '35 mins ago'
    },
    {
      id: 'FF5D1W8Q',
      customer: 'Ravi Kumar',
      email: 'ravi@example.com',
      phone: '9876543210',
      restaurantId: 5,
      restaurant: 'Dosa Delight',
      items: [
        { id: 501, name: 'Butter Masala Dosa', price: 89, qty: 1, image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=400&q=80' },
        { id: 503, name: 'Steamed Idli Sambar Combo', price: 69, qty: 1, image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=400&q=80' },
        { id: 505, name: 'Authentic Madras Filter Coffee', price: 39, qty: 1, image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80' }
      ],
      itemsSummary: 'Butter Masala Dosa ×1, Steamed Idli Sambar Combo ×1, Filter Coffee ×1',
      subtotal: 197,
      deliveryFee: 0,
      platformFee: 5,
      discount: 0,
      total: 202,
      status: 'pending',
      paymentMethod: 'Net Banking (HDFC Bank)',
      paymentStatus: 'success',
      refundStatus: 'none',
      refundAmount: 0,
      address: 'Flat 4B, Palm Grove Apartments, Malkajgiri, Hyderabad - 500047',
      notes: 'Extra coconut chutney please.',
      createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
      timeFormatted: '5 mins ago'
    },
    {
      id: 'FF6E2V7R',
      customer: 'Priya Sharma',
      email: 'priya@example.com',
      phone: '9123456789',
      restaurantId: 4,
      restaurant: 'Wok & Roll',
      items: [
        { id: 401, name: 'Chicken Hakka Noodles', price: 169, qty: 1, image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=400&q=80' },
        { id: 404, name: 'Chilli Chicken Dry', price: 169, qty: 1, image: 'https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=400&q=80' }
      ],
      itemsSummary: 'Chicken Hakka Noodles ×1, Chilli Chicken Dry ×1',
      subtotal: 348,
      deliveryFee: 30,
      platformFee: 5,
      discount: 50,
      total: 333,
      status: 'preparing',
      paymentMethod: 'Cash on Delivery',
      paymentStatus: 'pending',
      refundStatus: 'none',
      refundAmount: 0,
      address: 'Plot 42, Jubilee Hills Road No. 36, Hyderabad - 500033',
      notes: 'Make it extra spicy.',
      createdAt: new Date(Date.now() - 20 * 60000).toISOString(),
      timeFormatted: '20 mins ago'
    },
    {
      id: 'FF7F3U6S',
      customer: 'Ananya Patel',
      email: 'ananya@example.com',
      phone: '9723456789',
      restaurantId: 6,
      restaurant: 'Sweet Cravings',
      items: [
        { id: 601, name: 'Molten Chocolate Lava Cake', price: 149, qty: 2, image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=400&q=80' },
        { id: 603, name: 'Royal Alphonso Mango Kulfi', price: 89, qty: 1, image: 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?auto=format&fit=crop&w=400&q=80' }
      ],
      itemsSummary: 'Molten Chocolate Lava Cake ×2, Mango Kulfi ×1',
      subtotal: 407,
      deliveryFee: 25,
      platformFee: 5,
      discount: 0,
      total: 437,
      status: 'cancelled',
      paymentMethod: 'Credit Card (Mastercard •••• 8821)',
      paymentStatus: 'refunded',
      refundStatus: 'refunded',
      refundAmount: 437,
      refundId: 'REF-98124X',
      cancelReason: 'Customer ordered by mistake',
      cancelledBy: 'Customer',
      address: 'Villa 15, Green Meadows, Gachibowli, Hyderabad - 500032',
      notes: 'Cancelled via customer app.',
      createdAt: new Date(Date.now() - 24 * 3600000).toISOString(),
      timeFormatted: '1 day ago'
    },
    {
      id: 'FF8G4T5T',
      customer: 'Ravi Kumar',
      email: 'ravi@example.com',
      phone: '9876543210',
      restaurantId: 1,
      restaurant: 'Spice Garden',
      items: [
        { id: 101, name: 'Royal Chicken Dum Biryani', price: 199, qty: 2, image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=400&q=80' }
      ],
      itemsSummary: 'Royal Chicken Dum Biryani ×2',
      subtotal: 398,
      deliveryFee: 0,
      platformFee: 5,
      discount: 0,
      total: 403,
      status: 'delivered',
      paymentMethod: 'UPI (Paytm)',
      paymentStatus: 'success',
      refundStatus: 'none',
      refundAmount: 0,
      address: 'Flat 4B, Palm Grove Apartments, Malkajgiri, Hyderabad - 500047',
      notes: 'Delivered hot.',
      createdAt: new Date(Date.now() - 72 * 3600000).toISOString(),
      timeFormatted: '3 days ago'
    },
    {
      id: 'FF9H5S4U',
      customer: 'Priya Sharma',
      email: 'priya@example.com',
      phone: '9123456789',
      restaurantId: 2,
      restaurant: 'Pizza Republic',
      items: [
        { id: 202, name: 'BBQ Smoky Chicken Pizza', price: 279, qty: 1, image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80' },
        { id: 205, name: 'Cheesy Garlic Breadsticks', price: 79, qty: 1, image: 'https://images.unsplash.com/photo-1619535860434-ba1d8fa12536?auto=format&fit=crop&w=400&q=80' }
      ],
      itemsSummary: 'BBQ Smoky Chicken Pizza ×1, Cheesy Garlic Breadsticks ×1',
      subtotal: 358,
      deliveryFee: 30,
      platformFee: 5,
      discount: 0,
      total: 393,
      status: 'delivered',
      paymentMethod: 'Credit Card (RuPay •••• 1092)',
      paymentStatus: 'success',
      refundStatus: 'none',
      refundAmount: 0,
      address: 'Plot 42, Jubilee Hills Road No. 36, Hyderabad - 500033',
      notes: 'Contactless delivery done.',
      createdAt: new Date(Date.now() - 96 * 3600000).toISOString(),
      timeFormatted: '4 days ago'
    }
  ];

  // Pre-seeded Users
  const INITIAL_USERS = [
    { id: 'U001', name: 'Ravi Kumar', email: 'ravi@example.com', password: 'Password@123', phone: '9876543210', ordersCount: 12, totalSpent: 6840, joined: 'Jun 2026', status: 'active', role: 'Customer' },
    { id: 'U002', name: 'Priya Sharma', email: 'priya@example.com', password: 'Password@123', phone: '9123456789', ordersCount: 8, totalSpent: 2880, joined: 'May 2026', status: 'active', role: 'Customer' },
    { id: 'U003', name: 'Arjun Reddy', email: 'arjun@example.com', password: 'Password@123', phone: '9345678901', ordersCount: 34, totalSpent: 9690, joined: 'Jan 2026', status: 'active', role: 'Customer' },
    { id: 'U004', name: 'Meera Nair', email: 'meera@example.com', password: 'Password@123', phone: '9567890123', ordersCount: 5, totalSpent: 1725, joined: 'Jun 2026', status: 'active', role: 'Customer' },
    { id: 'U005', name: 'Super Admin', email: 'admin@foodflow.com', password: 'Password@123', phone: '9111222333', ordersCount: 0, totalSpent: 0, joined: 'Jan 2026', status: 'active', role: 'Super Admin' },
    { id: 'U006', name: 'Kiran Patel', email: 'kiran@example.com', password: 'Password@123', phone: '9789012345', ordersCount: 21, totalSpent: 5985, joined: 'Mar 2026', status: 'suspended', role: 'Customer' },
    { id: 'U007', name: 'Spice Garden Admin', email: 'admin@spicegarden.com', password: 'Password@123', phone: '9888777666', ordersCount: 0, totalSpent: 0, joined: 'Feb 2026', status: 'active', role: 'Restaurant Admin' },
    { id: 'U008', name: 'Delivery Partner Vikram', email: 'vikram@foodflow.com', password: 'Password@123', phone: '9444555666', ordersCount: 0, totalSpent: 0, joined: 'Feb 2026', status: 'active', role: 'Delivery Agent' }
  ];

  // Pre-seeded Payments
  const INITIAL_PAYMENTS = [
    { id: 'TXN001', orderId: 'FF2A8X3K', customer: 'Ravi Kumar', amount: 532, method: 'UPI (Google Pay)', status: 'success', time: '15 mins ago', timestamp: Date.now() - 15 * 60000 },
    { id: 'TXN002', orderId: 'FF3B7Y1M', customer: 'Priya Sharma', amount: 392, method: 'Credit Card', status: 'success', time: '5 mins ago', timestamp: Date.now() - 5 * 60000 }
  ];

  // Pre-seeded Promo Coupons (Updated to KBSIRSTUDENT)
  const INITIAL_PROMOS = [
    { code: 'KBSIRSTUDENT', type: 'percent', discount: 50, maxDiscount: 150, minOrder: 199, description: '50% off student special up to ₹150', status: 'active' },
    { code: 'FLAT100', type: 'flat', discount: 100, maxDiscount: 100, minOrder: 499, description: '₹100 flat off on orders above ₹499', status: 'active' },
    { code: 'FREESHIP', type: 'free_delivery', discount: 40, maxDiscount: 40, minOrder: 250, description: 'Free delivery on all orders above ₹250', status: 'active' }
  ];

  // Pre-seeded Addresses
  const INITIAL_ADDRESSES = [
    { id: 'ADDR1', userEmail: 'ravi@example.com', label: 'Home', isDefault: true, address: 'Flat 4B, Palm Grove Apartments, Malkajgiri, Hyderabad - 500047' },
    { id: 'ADDR2', userEmail: 'ravi@example.com', label: 'Office', isDefault: false, address: '4th Floor, Tech Hub Tower, Hitech City, Hyderabad - 500081' }
  ];

  // Pre-seeded Settings
  const INITIAL_SETTINGS = {
    appName: 'FoodFlow',
    supportEmail: 'support@foodflow.com',
    defaultDeliveryFee: 40,
    platformFee: 5,
    taxRatePercent: 5.0,
    maintenanceMode: false,
    liveDispatch: true
  };

  // Main Reactive Store Class
  class FoodFlowStore {
    constructor() {
      this.listeners = new Set();
      this.apiBaseUrl = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin.startsWith('http')) 
        ? `${window.location.origin}/api` 
        : 'http://localhost:5000/api';
      this.isMysqlConnected = false;
      this.init();
      this.setupSync();
      this.probeMysqlServer();
    }

    init() {
      if (!this.get(STORAGE_KEYS.RESTAURANTS)) this.save(STORAGE_KEYS.RESTAURANTS, INITIAL_RESTAURANTS);
      if (!this.get(STORAGE_KEYS.MENU_ITEMS)) this.save(STORAGE_KEYS.MENU_ITEMS, INITIAL_MENU_ITEMS);
      if (!this.get(STORAGE_KEYS.ORDERS)) this.save(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
      if (!this.get(STORAGE_KEYS.USERS)) this.save(STORAGE_KEYS.USERS, INITIAL_USERS);
      if (!this.get(STORAGE_KEYS.PAYMENTS)) this.save(STORAGE_KEYS.PAYMENTS, INITIAL_PAYMENTS);
      if (!this.get(STORAGE_KEYS.PROMOS)) this.save(STORAGE_KEYS.PROMOS, INITIAL_PROMOS);
      if (!this.get(STORAGE_KEYS.SETTINGS)) this.save(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
      if (!this.get(STORAGE_KEYS.ADDRESSES)) this.save(STORAGE_KEYS.ADDRESSES, INITIAL_ADDRESSES);
      if (!this.get(STORAGE_KEYS.CART)) this.save(STORAGE_KEYS.CART, []);
    }

    async probeMysqlServer() {
      if (typeof fetch === 'undefined') return;
      const candidateUrls = [
        this.apiBaseUrl,
        'http://localhost:5000/api',
        'http://localhost:5001/api',
        'http://localhost:5002/api'
      ];

      for (const url of candidateUrls) {
        try {
          const res = await fetch(`${url}/health`, { method: 'GET', headers: { 'Accept': 'application/json' } });
          if (res.ok) {
            const data = await res.json();
            if (data.connected === true) {
              this.apiBaseUrl = url;
              this.isMysqlConnected = true;
              this.notifyListeners('db_status_changed', { connected: true, url: this.apiBaseUrl, stats: data.stats });
              this.syncFromMysql();
              return;
            }
          }
        } catch (err) {}
      }
      this.isMysqlConnected = false;
      this.notifyListeners('db_status_changed', { connected: false });
    }

    async syncFromMysql() {
      if (!this.isMysqlConnected) return;
      try {
        const [usersRes, restRes, menuRes, ordRes, payRes] = await Promise.all([
          fetch(`${this.apiBaseUrl}/users`).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`${this.apiBaseUrl}/restaurants`).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`${this.apiBaseUrl}/menu`).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`${this.apiBaseUrl}/orders`).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`${this.apiBaseUrl}/payments`).then(r => r.ok ? r.json() : null).catch(() => null)
        ]);

        if (restRes && restRes.data && restRes.data.length > 0) {
          const formattedRest = restRes.data.map(r => ({
            id: r.id,
            name: r.name,
            image: r.image_url || r.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80',
            cuisine: r.cuisine,
            rating: Number(r.rating) || 4.5,
            deliveryTime: r.delivery_time || '25–35',
            fee: Number(r.delivery_fee) === 0 ? 'Free' : `₹${Number(r.delivery_fee)}`,
            feeValue: Number(r.delivery_fee) || 0,
            desc: r.description,
            ordersCount: r.orders_count || 0,
            revenue: Number(r.revenue) || 0,
            status: r.status || 'active',
            location: r.location || 'Hyderabad'
          }));
          this.save(STORAGE_KEYS.RESTAURANTS, formattedRest);
        }

        if (menuRes && menuRes.data && menuRes.data.length > 0) {
          const formattedMenu = menuRes.data.map(m => ({
            id: m.id,
            restId: m.restaurant_id,
            name: m.name,
            category: m.category,
            desc: m.description,
            price: Number(m.price),
            image: m.image_url || m.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
            veg: Boolean(m.is_veg),
            badges: m.is_bestseller ? ['bestseller'] : (m.is_veg ? ['veg'] : []),
            available: m.available !== false
          }));
          this.save(STORAGE_KEYS.MENU_ITEMS, formattedMenu);
        }

        if (ordRes && ordRes.data && ordRes.data.length > 0) {
          const formattedOrders = ordRes.data.map(o => ({
            id: o.id,
            customer: o.customer_name || o.customer,
            email: o.email,
            phone: o.phone,
            restaurantId: o.restaurant_id,
            restaurant: o.restaurant_name || o.restaurant,
            itemsSummary: o.items_summary || 'Food items',
            subtotal: Number(o.subtotal) || 0,
            deliveryFee: Number(o.delivery_fee) || 0,
            platformFee: 5,
            discount: Number(o.discount) || 0,
            total: Number(o.total) || 0,
            status: o.status || 'pending',
            paymentMethod: o.payment_method || 'UPI',
            paymentStatus: o.payment_status || 'success',
            cancelReason: o.cancel_reason,
            cancelledBy: o.cancelled_by,
            refundStatus: o.refund_status || 'none',
            refundAmount: Number(o.refund_amount || 0),
            refundId: o.refund_ref,
            address: o.delivery_address || 'Hyderabad',
            notes: o.kitchen_note || '',
            createdAt: o.created_at,
            timeFormatted: o.created_at ? new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'
          }));
          this.save(STORAGE_KEYS.ORDERS, formattedOrders);
        }

        if (usersRes && usersRes.data && usersRes.data.length > 0) {
          const formattedUsers = usersRes.data.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone,
            role: u.role,
            status: u.status,
            ordersCount: u.orders_count,
            totalSpent: Number(u.total_spent),
            joined: u.joined_date || '2026',
            initials: u.initials || (u.name ? u.name[0] : 'U')
          }));
          this.save(STORAGE_KEYS.USERS, formattedUsers);
        }

        if (payRes && payRes.data && payRes.data.length > 0) {
          const formattedPay = payRes.data.map(p => ({
            id: p.id,
            orderId: p.order_id,
            customer: p.customer_name,
            amount: Number(p.amount),
            method: p.method,
            status: p.status,
            refundRef: p.refund_ref,
            time: p.created_at ? new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
            timestamp: p.created_at ? new Date(p.created_at).getTime() : Date.now()
          }));
          this.save(STORAGE_KEYS.PAYMENTS, formattedPay);
        }

        this.emitSync('mysql_synced', { timestamp: Date.now() });
      } catch (e) {
        console.warn('FoodFlow Store: Background MySQL sync notice:', e.message);
      }
    }

    setupSync() {
      if (syncChannel) {
        try {
          syncChannel.onmessage = (event) => {
            if (event && event.data && event.data.type) {
              this.notifyListeners(event.data.type, event.data.payload);
            }
          };
        } catch (e) {}
      }

      try {
        window.addEventListener('storage', (e) => {
          if (Object.values(STORAGE_KEYS).includes(e.key)) {
            this.notifyListeners('storage_change', { key: e.key, newValue: e.newValue });
          }
        });
      } catch (e) {}
    }

    emitSync(type, payload = {}) {
      if (syncChannel) {
        try {
          syncChannel.postMessage({ type, payload, timestamp: Date.now() });
        } catch (err) {}
      }
      this.notifyListeners(type, payload);
    }

    subscribe(listener) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    notifyListeners(eventType, payload) {
      this.listeners.forEach((fn) => {
        try {
          fn(eventType, payload);
        } catch (err) {
          console.error('FoodFlow Store listener error:', err);
        }
      });
    }

    getRaw(key) {
      return safeStorageGet(key);
    }

    get(key, defaultValue = null) {
      try {
        const data = safeStorageGet(key);
        return data ? JSON.parse(data) : defaultValue;
      } catch (err) {
        return defaultValue;
      }
    }

    async apiCall(endpoint, body = null, method = 'POST') {
      if (typeof fetch === 'undefined') return null;
      try {
        const opts = {
          method,
          headers: { 'Content-Type': 'application/json' }
        };
        if (body && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
          opts.body = JSON.stringify(body);
        }
        const res = await fetch(`${this.apiBaseUrl}${endpoint}`, opts);
        if (res.ok) {
          if (!this.isMysqlConnected) {
            this.isMysqlConnected = true;
            this.notifyListeners('db_status_changed', { connected: true });
          }
          const json = await res.json();
          console.log(`[MySQL Sync] ✓ API ${method} ${endpoint} successfully saved to MySQL database:`, json);
          return json;
        } else {
          const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          console.warn(`[MySQL Sync] ⚠️ Backend returned error for ${endpoint}:`, errData);
          return null;
        }
      } catch (e) {
        console.warn(`[MySQL Sync] ⚠️ Could not connect to MySQL Backend API (${this.apiBaseUrl}${endpoint}): ${e.message}`);
        console.warn(`[MySQL Sync] 👉 Make sure you ran "npm start" or "node server.js" in the FoodFlow_Fresh directory.`);
        return null;
      }
    }

    save(key, value) {
      try {
        safeStorageSet(key, JSON.stringify(value));
      } catch (err) {}
    }

    // --- RESTAURANTS ---
    getRestaurants() {
      return this.get(STORAGE_KEYS.RESTAURANTS, INITIAL_RESTAURANTS);
    }

    getRestaurantById(id) {
      const list = this.getRestaurants();
      return list.find((r) => r.id === Number(id)) || null;
    }

    addRestaurant(restData) {
      const list = this.getRestaurants();
      const newId = list.length > 0 ? Math.max(...list.map((r) => r.id)) + 1 : 1;
      const newRest = {
        id: newId,
        name: restData.name,
        image: restData.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80',
        cuisine: restData.cuisine || 'Multi-Cuisine',
        rating: 4.5,
        deliveryTime: restData.deliveryTime || '25–35',
        fee: restData.feeValue === 0 ? 'Free' : `₹${restData.feeValue || 30}`,
        feeValue: restData.feeValue !== undefined ? restData.feeValue : 30,
        tag: 'New',
        desc: restData.desc || 'Fresh dishes prepared to order',
        status: 'active',
        ordersCount: 0,
        revenue: 0,
        location: restData.location || 'Banjara Hills, Hyderabad'
      };

      list.push(newRest);
      this.save(STORAGE_KEYS.RESTAURANTS, list);
      this.addLog('INFO', `Restaurant added: "${newRest.name}" [${newRest.cuisine}]`);
      this.emitSync('restaurant_added', newRest);
      this.apiCall('/restaurants', restData, 'POST');
      return newRest;
    }

    updateRestaurant(id, updates) {
      const list = this.getRestaurants();
      const idx = list.findIndex((r) => r.id === Number(id));
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updates };
        this.save(STORAGE_KEYS.RESTAURANTS, list);
        this.emitSync('restaurant_updated', list[idx]);
        if (updates.status) {
          this.apiCall(`/restaurants/${id}/status`, {}, 'PUT');
        }
        return list[idx];
      }
      return null;
    }

    // --- MENU ITEMS ---
    getMenuItems(restaurantId = null) {
      const items = this.get(STORAGE_KEYS.MENU_ITEMS, INITIAL_MENU_ITEMS);
      if (restaurantId !== null && restaurantId !== 'all') {
        return items.filter((item) => (item.restId || item.restaurant_id) === Number(restaurantId));
      }
      return items;
    }

    getMenuItemById(id) {
      const items = this.getMenuItems();
      return items.find((i) => i.id === Number(id)) || null;
    }

    addMenuItem(itemData) {
      const items = this.getMenuItems();
      const newId = items.length > 0 ? Math.max(...items.map((i) => i.id)) + 1 : 101;
      const rest = this.getRestaurantById(itemData.restId) || { name: 'Custom Restaurant' };

      const newItem = {
        id: newId,
        restId: Number(itemData.restId),
        restaurant: rest.name,
        name: itemData.name,
        category: itemData.category || 'General',
        desc: itemData.desc || '',
        price: Number(itemData.price) || 99,
        image: itemData.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
        badges: itemData.badges || (itemData.veg ? ['veg'] : []),
        veg: Boolean(itemData.veg),
        available: itemData.available !== undefined ? itemData.available : true
      };

      items.push(newItem);
      this.save(STORAGE_KEYS.MENU_ITEMS, items);
      this.addLog('INFO', `Menu item added: "${newItem.name}" at ${newItem.restaurant}`);
      this.emitSync('menu_item_added', newItem);
      this.apiCall('/menu', {
        restaurant_id: newItem.restId,
        category: newItem.category,
        name: newItem.name,
        description: newItem.desc,
        price: newItem.price,
        image_url: newItem.image,
        is_veg: newItem.veg,
        is_bestseller: false
      }, 'POST');
      return newItem;
    }

    updateMenuItem(id, updates) {
      const items = this.getMenuItems();
      const idx = items.findIndex((i) => i.id === Number(id));
      if (idx !== -1) {
        items[idx] = { ...items[idx], ...updates };
        this.save(STORAGE_KEYS.MENU_ITEMS, items);
        this.emitSync('menu_item_updated', items[idx]);
        return items[idx];
      }
      return null;
    }

    toggleMenuItemAvailability(id, isAvailable) {
      const updated = this.updateMenuItem(id, { available: isAvailable });
      if (updated) {
        this.addLog('INFO', `Item #${id} (${updated.name}) marked ${isAvailable ? 'AVAILABLE' : 'UNAVAILABLE'}`);
        this.emitSync('menu_availability_changed', { id, available: isAvailable });
        this.apiCall(`/menu/${id}/availability`, { available: isAvailable }, 'PUT');
      }
      return updated;
    }

    deleteMenuItem(id) {
      let items = this.getMenuItems();
      const item = items.find((i) => i.id === Number(id));
      items = items.filter((i) => i.id !== Number(id));
      this.save(STORAGE_KEYS.MENU_ITEMS, items);
      if (item) {
        this.addLog('WARN', `Menu item #${id} (${item.name}) removed from catalog`);
      }
      this.emitSync('menu_item_deleted', { id });
      this.apiCall(`/menu/${id}`, {}, 'DELETE');
      return true;
    }

    // --- CART ---
    getCart() {
      return this.get(STORAGE_KEYS.CART, []);
    }

    saveCart(cart) {
      this.save(STORAGE_KEYS.CART, cart);
      this.emitSync('cart_updated', cart);
    }

    addToCart(itemId, qty = 1) {
      const item = this.getMenuItemById(itemId);
      if (!item) return false;
      if (!item.available) return false;

      let cart = this.getCart();
      const existing = cart.find((x) => x.id === item.id);

      if (existing) {
        existing.qty += qty;
      } else {
        cart.push({
          id: item.id,
          restId: item.restId,
          restaurant: item.restaurant,
          name: item.name,
          price: item.price,
          image: item.image,
          veg: item.veg,
          qty: qty
        });
      }

      this.saveCart(cart);
      return true;
    }

    updateCartQty(itemId, delta) {
      let cart = this.getCart();
      const idx = cart.findIndex((x) => x.id === Number(itemId));
      if (idx === -1) return;

      cart[idx].qty += delta;
      if (cart[idx].qty <= 0) {
        cart.splice(idx, 1);
      }
      this.saveCart(cart);
    }

    clearCart() {
      this.saveCart([]);
    }

    // --- ORDERS ---
    getOrders() {
      let stored = this.get(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
      if (!Array.isArray(stored) || stored.length === 0) {
        this.save(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
        return INITIAL_ORDERS;
      }
      // If cached orders have fewer entries than default seeds, merge any missing seeds
      if (stored.length < INITIAL_ORDERS.length) {
        const storedIds = new Set(stored.map((o) => o.id));
        const missing = INITIAL_ORDERS.filter((o) => !storedIds.has(o.id));
        if (missing.length > 0) {
          stored = [...stored, ...missing];
          this.save(STORAGE_KEYS.ORDERS, stored);
        }
      }
      return stored;
    }

    getOrderById(id) {
      const orders = this.getOrders();
      return orders.find((o) => o.id === id) || null;
    }

    getUserOrders(emailOrName) {
      const orders = this.getOrders();
      if (!emailOrName) return orders;
      return orders.filter(
        (o) =>
          (o.email && o.email.toLowerCase() === emailOrName.toLowerCase()) ||
          (o.customer && o.customer.toLowerCase() === emailOrName.toLowerCase())
      );
    }

    placeOrder(orderData) {
      const orders = this.getOrders();
      const newOrderId = 'FF' + Math.random().toString(36).substring(2, 8).toUpperCase();

      const newOrder = {
        id: newOrderId,
        customer: orderData.customer || 'Customer',
        email: orderData.email || 'customer@foodflow.com',
        phone: orderData.phone || '9876543210',
        restaurantId: orderData.restaurantId || 1,
        restaurant: orderData.restaurant || 'Spice Garden',
        items: orderData.items || [],
        itemsSummary: (orderData.items || []).map((i) => `${i.name} ×${i.qty}`).join(', '),
        subtotal: orderData.subtotal || 0,
        deliveryFee: orderData.deliveryFee !== undefined ? orderData.deliveryFee : 40,
        platformFee: 5,
        discount: orderData.discount || 0,
        total: orderData.total || 0,
        status: 'pending',
        paymentMethod: orderData.paymentMethod || 'UPI',
        paymentStatus: orderData.paymentMethod === 'Cash on Delivery' ? 'pending' : 'success',
        refundStatus: 'none',
        refundAmount: 0,
        address: orderData.address || 'Standard Delivery Address, Hyderabad',
        notes: orderData.notes || '',
        createdAt: new Date().toISOString(),
        timeFormatted: 'Just now'
      };

      orders.unshift(newOrder);
      this.save(STORAGE_KEYS.ORDERS, orders);

      // Record Payment Transaction
      this.recordPayment({
        orderId: newOrder.id,
        customer: newOrder.customer,
        amount: newOrder.total,
        method: newOrder.paymentMethod,
        status: newOrder.paymentStatus
      });

      // Update restaurant order count & revenue
      const rest = this.getRestaurantById(newOrder.restaurantId);
      if (rest) {
        this.updateRestaurant(rest.id, {
          ordersCount: (rest.ordersCount || 0) + 1,
          revenue: (rest.revenue || 0) + newOrder.total
        });
      }

      this.addLog('INFO', `New Order #${newOrder.id} placed by ${newOrder.customer} (₹${newOrder.total})`);
      this.emitSync('order_placed', newOrder);

      // Async MySQL API write
      this.apiCall('/orders', {
        id: newOrder.id,
        customer: newOrder.customer,
        email: newOrder.email,
        phone: newOrder.phone,
        deliveryAddress: newOrder.address,
        restaurantId: newOrder.restaurantId,
        restaurant: newOrder.restaurant,
        items: newOrder.items,
        subtotal: newOrder.subtotal,
        discount: newOrder.discount,
        deliveryFee: newOrder.deliveryFee,
        tax: 0,
        total: newOrder.total,
        promoCode: null,
        paymentMethod: newOrder.paymentMethod,
        kitchenNote: newOrder.notes
      }, 'POST');

      return newOrder;
    }

    updateOrderStatus(orderId, newStatus, note = '') {
      const orders = this.getOrders();
      const idx = orders.findIndex((o) => o.id === orderId);
      if (idx !== -1) {
        const oldStatus = orders[idx].status;
        orders[idx].status = newStatus;
        if (note) orders[idx].adminNote = note;
        if (newStatus === 'delivered' && orders[idx].paymentStatus === 'pending') {
          orders[idx].paymentStatus = 'success';
        }
        this.save(STORAGE_KEYS.ORDERS, orders);

        this.addLog('INFO', `Order #${orderId} status changed: "${oldStatus}" → "${newStatus}"`);
        this.emitSync('order_status_updated', { orderId, oldStatus, newStatus, order: orders[idx] });
        this.apiCall(`/orders/${orderId}/status`, { status: newStatus, note: note || '' }, 'PUT');
        return orders[idx];
      }
      return null;
    }

    cancelOrder(orderId, reason = 'Order cancelled', cancelledBy = 'Customer') {
      const orders = this.getOrders();
      const idx = orders.findIndex((o) => o.id === orderId);
      if (idx === -1) return { success: false, message: 'Order not found' };

      const order = orders[idx];
      const isPrepaid = order.paymentMethod !== 'Cash on Delivery' && order.paymentStatus !== 'failed';
      
      order.status = 'cancelled';
      order.cancelReason = reason;
      order.cancelledBy = cancelledBy;
      order.cancelledAt = new Date().toISOString();

      let refundInfo = null;

      if (isPrepaid) {
        order.paymentStatus = 'refunded';
        order.refundStatus = 'refunded';
        order.refundAmount = order.total;
        order.refundId = 'REF-' + Math.random().toString(36).substring(2, 9).toUpperCase();
        order.refundTime = new Date().toISOString();

        // Record Refund Transaction
        this.recordPayment({
          orderId: order.id,
          customer: order.customer,
          amount: order.total,
          method: `${order.paymentMethod} (Refund)`,
          status: 'refunded',
          refundRef: order.refundId,
          notes: `Refund for cancelled order #${order.id}. Reason: ${reason} (Cancelled by ${cancelledBy})`
        });

        this.addLog('WARN', `Order #${order.id} CANCELLED by ${cancelledBy}. Reason: "${reason}". Refund of ₹${order.total} PROCESSED to ${order.paymentMethod} [Ref: ${order.refundId}]`);
        
        refundInfo = {
          refunded: true,
          amount: order.total,
          refundId: order.refundId,
          method: order.paymentMethod
        };
      } else {
        order.paymentStatus = 'cancelled';
        order.refundStatus = 'not_applicable';
        order.refundAmount = 0;
        this.addLog('WARN', `Order #${order.id} CANCELLED by ${cancelledBy}. Reason: "${reason}". (COD order - no refund required)`);
        
        refundInfo = {
          refunded: false,
          isCod: true,
          message: 'Order was placed via Cash on Delivery. No payment refund needed.'
        };
      }

      this.save(STORAGE_KEYS.ORDERS, orders);
      this.emitSync('order_cancelled', { orderId, order, cancelledBy, reason, refundInfo });
      this.apiCall(`/orders/${orderId}/cancel`, {
        reason: reason,
        cancelledBy: cancelledBy,
        refundStatus: order.refundStatus,
        refundAmount: order.refundAmount,
        refundRef: order.refundId
      }, 'POST');

      return {
        success: true,
        order: order,
        refundInfo: refundInfo,
        message: isPrepaid 
          ? `Order #${order.id} cancelled. ₹${order.total} has been refunded to your ${order.paymentMethod}.`
          : `Order #${order.id} has been cancelled successfully.`
      };
    }

    // --- USERS & AUTH ---
    getUsers() {
      return this.get(STORAGE_KEYS.USERS, INITIAL_USERS);
    }

    getCurrentUser() {
      return this.get(STORAGE_KEYS.CURRENT_USER, {
        id: 'U001',
        name: 'Ravi Kumar',
        email: 'ravi@example.com',
        phone: '9876543210',
        role: 'Customer',
        initials: 'RK'
      });
    }

    setCurrentUser(user) {
      this.save(STORAGE_KEYS.CURRENT_USER, user);
      this.emitSync('auth_changed', user);
    }

    updateUserProfile(profileData) {
      const users = this.getUsers();
      const cleanEmail = (profileData.email || '').toLowerCase().trim();
      const idx = users.findIndex((u) => (u.email && u.email.toLowerCase() === cleanEmail) || (u.id === profileData.id));
      
      const fullName = (profileData.name || '').trim();
      const parts = fullName.split(' ');
      const firstName = parts[0] || fullName;
      const lastName = parts.slice(1).join(' ') || '';
      const initials = ((firstName[0] || 'U') + (lastName ? lastName[0] : '')).toUpperCase();

      let updatedUser = null;
      if (idx !== -1) {
        users[idx].name = fullName || users[idx].name;
        users[idx].phone = profileData.phone || users[idx].phone;
        users[idx].initials = initials;
        this.save(STORAGE_KEYS.USERS, users);
        updatedUser = { ...users[idx] };
      }

      const currentUser = this.getCurrentUser();
      if (currentUser && ((currentUser.email && currentUser.email.toLowerCase() === cleanEmail) || currentUser.id === profileData.id)) {
        currentUser.name = fullName || currentUser.name;
        currentUser.phone = profileData.phone || currentUser.phone;
        currentUser.initials = initials;
        this.setCurrentUser(currentUser);
        updatedUser = { ...currentUser };
      }

      this.addLog('INFO', `User profile updated: ${cleanEmail} → "${fullName}" (${profileData.phone})`);
      this.emitSync('user_profile_updated', { email: cleanEmail, name: fullName, phone: profileData.phone, initials });

      // Direct write to MySQL REST API
      this.apiCall('/auth/profile', {
        email: cleanEmail,
        name: fullName,
        phone: profileData.phone,
        firstName: firstName,
        lastName: lastName,
        initials: initials
      }, 'PUT');

      return updatedUser;
    }

    registerUser(userData) {
      const users = this.getUsers();
      const cleanEmail = (userData.email || '').toLowerCase().trim();

      const existing = users.find((u) => u.email.toLowerCase() === cleanEmail);
      if (existing) {
        throw new Error('An account with this email address already exists. Please log in.');
      }

      const newId = 'U00' + (users.length + 1);
      const fullName = userData.name || `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
      const initials = (
        (userData.firstName && userData.firstName[0]) ||
        (userData.name && userData.name[0]) ||
        'U'
      ).toUpperCase();

      const newUser = {
        id: newId,
        name: fullName || 'FoodFlow User',
        email: cleanEmail,
        password: userData.password || 'Password@123',
        phone: userData.phone || '9876543210',
        role: userData.role || 'Customer',
        ordersCount: 0,
        totalSpent: 0,
        joined: 'Today',
        status: 'active',
        initials: initials
      };

      users.push(newUser);
      this.save(STORAGE_KEYS.USERS, users);
      this.addLog('INFO', `New user registered: ${newUser.name} (${newUser.email})`);
      this.emitSync('user_registered', newUser);

      // Async MySQL API sync
      this.apiCall('/auth/register', {
        firstName: userData.firstName || newUser.name.split(' ')[0],
        lastName: userData.lastName || (newUser.name.split(' ')[1] || ''),
        email: newUser.email,
        password: newUser.password,
        phone: newUser.phone,
        role: newUser.role
      }, 'POST');

      return newUser;
    }

    loginUser(email, password = null) {
      const users = this.getUsers();
      const cleanEmail = (email || '').toLowerCase().trim();
      const user = users.find((u) => u.email.toLowerCase() === cleanEmail);

      if (!user) {
        // Create demo session for instant testing if not existing
        const demoUser = {
          id: 'U' + Math.floor(100 + Math.random() * 900),
          name: email.split('@')[0].toUpperCase(),
          email: cleanEmail,
          phone: '9876543210',
          role: cleanEmail.includes('admin') ? 'Super Admin' : 'Customer',
          initials: email[0].toUpperCase(),
          status: 'active'
        };
        this.setCurrentUser(demoUser);
        this.addLog('INFO', `User logged in: ${demoUser.email} [${demoUser.role}]`);
        return demoUser;
      }

      if (user.status === 'suspended') {
        throw new Error('This account has been suspended by administration. Please contact support.');
      }

      // If user entered a password, check for match
      if (password !== null && user.password) {
        if (user.password !== password) {
          throw new Error('Incorrect password. Please verify your credentials and try again.');
        }
      }

      const sessionUser = {
        ...user,
        initials: user.name
          .split(' ')
          .map((p) => p[0])
          .join('')
          .substring(0, 2)
          .toUpperCase()
      };

      this.setCurrentUser(sessionUser);
      this.addLog('INFO', `User logged in: ${sessionUser.email} [${sessionUser.role}]`);
      return sessionUser;
    }

    getUserByIdentifier(identifier) {
      const users = this.getUsers();
      if (!identifier) return null;
      const clean = identifier.toLowerCase().trim();
      const cleanDigits = identifier.replace(/\D/g, '');
      return users.find((u) => {
        if (u.email && u.email.toLowerCase() === clean) return true;
        if (cleanDigits.length >= 10 && u.phone) {
          const userDigits = u.phone.replace(/\D/g, '');
          if (userDigits.endsWith(cleanDigits.slice(-10))) return true;
        }
        return false;
      }) || null;
    }

    getUserByEmail(email) {
      return this.getUserByIdentifier(email);
    }

    generatePasswordResetOTP(identifier) {
      const user = this.getUserByIdentifier(identifier);
      if (!user) {
        throw new Error('No registered account found with this email or mobile number.');
      }
      if (user.status === 'suspended') {
        throw new Error('This account has been suspended. Password reset is not permitted.');
      }

      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const isPhone = !identifier.includes('@') && identifier.replace(/\D/g, '').length >= 10;
      
      let maskedDest = user.email;
      if (isPhone && user.phone) {
        const p = user.phone.replace(/\D/g, '').slice(-10);
        maskedDest = `+91 ${p.substring(0, 5)} •••${p.slice(-2)}`;
      } else {
        const parts = user.email.split('@');
        maskedDest = `${parts[0].slice(0, 2)}•••@${parts[1]}`;
      }

      const resetRecord = {
        email: user.email,
        phone: user.phone,
        otp: otp,
        timestamp: Date.now(),
        expiresAt: Date.now() + 10 * 60 * 1000 // 10 mins validity
      };

      this.save('foodflow_last_otp_' + user.email.toLowerCase(), resetRecord);
      this.addLog('INFO', `Password reset OTP generated for ${user.email} (${maskedDest}): ${otp}`);
      this.apiCall('/auth/forgot-password/request', { email: user.email, identifier: identifier }, 'POST');
      return { 
        success: true, 
        email: user.email, 
        phone: user.phone, 
        maskedDest: maskedDest, 
        isPhone: isPhone, 
        otp: otp, 
        user: user 
      };
    }

    verifyPasswordResetOTP(identifier, enteredOtp) {
      const user = this.getUserByIdentifier(identifier);
      const email = user ? user.email.toLowerCase() : (identifier || '').toLowerCase().trim();
      const cleanOtp = (enteredOtp || '').trim();
      const record = this.get('foodflow_last_otp_' + email, null);

      if (!record) {
        return { valid: false, message: 'No active OTP request found. Please request a new code.' };
      }
      if (Date.now() > record.expiresAt) {
        return { valid: false, message: 'OTP has expired (10 min limit). Please request a new code.' };
      }
      if (record.otp !== cleanOtp) {
        return { valid: false, message: 'Incorrect 6-digit OTP code. Please check and try again.' };
      }

      return { valid: true, user: user };
    }

    updateUserPassword(identifier, newPassword) {
      const user = this.getUserByIdentifier(identifier);
      if (!user) {
        throw new Error('User account not found.');
      }

      const users = this.getUsers();
      const idx = users.findIndex((u) => u.id === user.id);

      if (idx === -1) {
        throw new Error('User account not found.');
      }

      users[idx].password = newPassword;
      this.save(STORAGE_KEYS.USERS, users);
      this.save('foodflow_last_otp_' + user.email.toLowerCase(), null);

      this.addLog('INFO', `Password updated successfully for account: ${user.email}`);
      this.emitSync('user_password_updated', { email: user.email });
      this.apiCall('/auth/forgot-password/reset', { email: user.email, newPassword }, 'POST');
      return { success: true, user: users[idx] };
    }

    logout() {
      const user = this.getCurrentUser();
      this.setCurrentUser(null);
      if (user) {
        this.addLog('INFO', `User logged out: ${user.email}`);
      }
    }

    toggleUserStatus(userId) {
      const users = this.getUsers();
      const idx = users.findIndex((u) => u.id === userId);
      if (idx !== -1) {
        users[idx].status = users[idx].status === 'active' ? 'suspended' : 'active';
        this.save(STORAGE_KEYS.USERS, users);
        this.addLog('WARN', `User #${userId} status set to: ${users[idx].status}`);
        this.emitSync('user_status_changed', users[idx]);
        this.apiCall(`/users/${userId}/status`, {}, 'PUT');
        return users[idx];
      }
      return null;
    }

    // --- ADDRESSES ---
    getAddresses(userEmail) {
      const addrs = this.get(STORAGE_KEYS.ADDRESSES, INITIAL_ADDRESSES);
      if (!userEmail) return addrs;
      return addrs.filter((a) => a.userEmail.toLowerCase() === userEmail.toLowerCase());
    }

    addAddress(addrData) {
      const addrs = this.get(STORAGE_KEYS.ADDRESSES, INITIAL_ADDRESSES);
      const newAddr = {
        id: 'ADDR' + (addrs.length + 1),
        userEmail: addrData.userEmail,
        label: addrData.label || 'Home',
        isDefault: addrData.isDefault || false,
        address: addrData.address
      };
      addrs.push(newAddr);
      this.save(STORAGE_KEYS.ADDRESSES, addrs);
      this.addLog('INFO', `Address added for ${addrData.userEmail}`);
      this.emitSync('address_added', newAddr);
      this.apiCall('/addresses', {
        userEmail: newAddr.userEmail,
        label: newAddr.label,
        addressText: newAddr.address
      }, 'POST');
      return newAddr;
    }

    deleteAddress(addrId) {
      let addrs = this.get(STORAGE_KEYS.ADDRESSES, INITIAL_ADDRESSES);
      addrs = addrs.filter((a) => a.id !== addrId);
      this.save(STORAGE_KEYS.ADDRESSES, addrs);
      this.emitSync('address_deleted', { id: addrId });
      this.apiCall(`/addresses/${addrId}`, {}, 'DELETE');
      return true;
    }

    // --- PAYMENTS ---
    getPayments() {
      return this.get(STORAGE_KEYS.PAYMENTS, INITIAL_PAYMENTS);
    }

    recordPayment(paymentData) {
      const payments = this.getPayments();
      const newTxn = {
        id: paymentData.id || ('TXN' + String(payments.length + 1).padStart(3, '0')),
        orderId: paymentData.orderId,
        customer: paymentData.customer,
        amount: paymentData.amount,
        method: paymentData.method || 'UPI',
        status: paymentData.status || 'success',
        refundRef: paymentData.refundRef || null,
        notes: paymentData.notes || '',
        time: 'Just now',
        timestamp: Date.now()
      };
      payments.unshift(newTxn);
      this.save(STORAGE_KEYS.PAYMENTS, payments);
      this.emitSync('payment_recorded', newTxn);
      return newTxn;
    }

    retryPayment(txnId) {
      const payments = this.getPayments();
      const idx = payments.findIndex((p) => p.id === txnId);
      if (idx !== -1) {
        payments[idx].status = 'success';
        this.save(STORAGE_KEYS.PAYMENTS, payments);

        const order = this.getOrderById(payments[idx].orderId);
        if (order && order.paymentStatus === 'failed') {
          this.updateOrderStatus(order.id, 'preparing', 'Payment successfully retried');
        }

        this.addLog('INFO', `Payment ${txnId} re-processed successfully`);
        this.emitSync('payment_retried', payments[idx]);
        return payments[idx];
      }
      return null;
    }

    // --- PROMOS & SETTINGS ---
    getPromos() {
      return this.get(STORAGE_KEYS.PROMOS, INITIAL_PROMOS);
    }

    addPromo(promoData) {
      const promos = this.getPromos();
      const newPromo = {
        code: (promoData.code || '').trim().toUpperCase(),
        type: promoData.type || 'percent',
        discount: Number(promoData.discount) || 20,
        maxDiscount: Number(promoData.maxDiscount) || 100,
        minOrder: Number(promoData.minOrder) || 199,
        description: promoData.description || 'Special promo discount',
        status: 'active'
      };
      promos.unshift(newPromo);
      this.save(STORAGE_KEYS.PROMOS, promos);
      this.addLog('INFO', `New Promo Code added: ${newPromo.code}`);
      this.emitSync('promo_added', newPromo);

      // Async write to MySQL API
      this.apiCall('/promos', {
        code: newPromo.code,
        discount_percent: newPromo.discount,
        max_discount: newPromo.maxDiscount,
        min_order_amount: newPromo.minOrder,
        description: newPromo.description
      }, 'POST');

      return newPromo;
    }

    deletePromo(code) {
      const cleanCode = (code || '').trim().toUpperCase();
      let promos = this.getPromos();
      promos = promos.filter((p) => p.code.toUpperCase() !== cleanCode);
      this.save(STORAGE_KEYS.PROMOS, promos);
      this.addLog('WARN', `Promo coupon ${cleanCode} removed`);
      this.emitSync('promo_deleted', { code: cleanCode });
      this.apiCall(`/promos/${cleanCode}`, {}, 'DELETE');
      return true;
    }

    validatePromo(code, subtotal) {
      const promos = this.getPromos();
      const match = promos.find((p) => p.code.toUpperCase() === (code || '').trim().toUpperCase() && p.status === 'active');
      if (!match) return { valid: false, message: 'Invalid or expired coupon code.' };
      if (subtotal < match.minOrder) {
        return { valid: false, message: `Minimum order of ₹${match.minOrder} required for ${match.code}.` };
      }

      let discount = 0;
      if (match.type === 'percent') {
        discount = Math.min(Math.round((subtotal * match.discount) / 100), match.maxDiscount);
      } else if (match.type === 'flat') {
        discount = match.discount;
      } else if (match.type === 'free_delivery') {
        discount = match.discount;
      }

      return {
        valid: true,
        promo: match,
        discountAmount: discount,
        message: `Promo ${match.code} applied! Saved ₹${discount}`
      };
    }

    getSettings() {
      return this.get(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
    }

    updateSettings(updates) {
      const current = this.getSettings();
      const updated = { ...current, ...updates };
      this.save(STORAGE_KEYS.SETTINGS, updated);
      this.addLog('INFO', 'System platform settings updated');
      this.emitSync('settings_updated', updated);
      this.apiCall('/settings', updated, 'PUT');
      return updated;
    }

    // --- SYSTEM LOGS ---
    getLogs() {
      return this.get(STORAGE_KEYS.LOGS, []);
    }

    addLog(type, text) {
      const logs = this.getLogs();
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      const newEntry = { type: type || 'INFO', text, time: timeStr, timestamp: Date.now() };
      logs.push(newEntry);
      if (logs.length > 80) logs.shift();
      this.save(STORAGE_KEYS.LOGS, logs);
      this.emitSync('log_appended', newEntry);
    }

    clearLogs() {
      this.save(STORAGE_KEYS.LOGS, []);
      this.emitSync('logs_cleared', {});
    }

    // --- CSV EXPORT UTILITY ---
    exportOrdersCSV() {
      const orders = this.getOrders();
      if (orders.length === 0) return null;

      const headers = ['Order ID', 'Customer', 'Phone', 'Restaurant', 'Items', 'Subtotal', 'Delivery Fee', 'Total', 'Status', 'Payment Method', 'Payment Status', 'Created At'];
      const rows = orders.map((o) => [
        o.id,
        `"${o.customer}"`,
        `"${o.phone}"`,
        `"${o.restaurant}"`,
        `"${(o.itemsSummary || '').replace(/"/g, '""')}"`,
        o.subtotal,
        o.deliveryFee,
        o.total,
        o.status,
        o.paymentMethod,
        o.paymentStatus,
        o.createdAt
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `foodflow_orders_export_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return true;
    }

    // --- SUMMARY STATS ---
    getDashboardStats() {
      const orders = this.getOrders();
      const users = this.getUsers();

      const validOrders = orders.filter((o) => o.status !== 'cancelled');
      const totalRevenue = validOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      const pendingOrders = orders.filter((o) => o.status === 'pending' || o.status === 'preparing');
      const activeUsers = users.filter((u) => u.status === 'active').length;

      return {
        totalOrdersToday: orders.length,
        revenueToday: totalRevenue,
        activeUsersCount: activeUsers,
        pendingOrdersCount: pendingOrders.length,
        recentOrders: orders.slice(0, 6)
      };
    }

    // Reset to initial demo data
    resetDemoData() {
      safeStorageRemove(STORAGE_KEYS.ORDERS);
      safeStorageRemove(STORAGE_KEYS.RESTAURANTS);
      safeStorageRemove(STORAGE_KEYS.MENU_ITEMS);
      safeStorageRemove(STORAGE_KEYS.USERS);
      safeStorageRemove(STORAGE_KEYS.PAYMENTS);
      safeStorageRemove(STORAGE_KEYS.PROMOS);
      safeStorageRemove(STORAGE_KEYS.SETTINGS);
      safeStorageRemove(STORAGE_KEYS.CART);
      safeStorageRemove(STORAGE_KEYS.LOGS);
      safeStorageRemove(STORAGE_KEYS.ADDRESSES);
      this.init();
      this.emitSync('demo_reset', {});
    }
  }

  // Global window attachment
  window.FoodFlowStore = new FoodFlowStore();
})();
