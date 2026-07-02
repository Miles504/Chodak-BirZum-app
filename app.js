// ============================================================
// Chodak BirZum — mijoz Mini App logikasi
// Firebase Firestore'dan restoranlar va mahsulotlarni o'qiydi,
// buyurtmani Firestore'ga yozadi va botga yuboradi.
// ============================================================

import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

// ---------- Holat (state) ----------
let restaurants = [];
let currentRestaurant = null;
let currentProducts = [];
const cart = {}; // { productId: { ...product, qty } }

const DELIVERY_RATE_PER_KM = 6000; // so'm
const DEFAULT_CENTER = [41.2995, 69.2401]; // Toshkent markazi (restoran koordinatasi yo'q bo'lsa)

let deliveryMap = null;
let deliveryMarker = null;
let deliveryDistanceKm = null;
let selectedPaymentMethod = "cash";

// Ikki koordinata orasidagi masofa (km), Haversine formulasi
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getDeliveryFee() {
  if (deliveryDistanceKm == null) return 0;
  return Math.max(1, Math.ceil(deliveryDistanceKm)) * DELIVERY_RATE_PER_KM;
}

// ---------- Ekranlarni almashtirish ----------
const screens = {
  restaurants: document.getElementById("screen-restaurants"),
  menu: document.getElementById("screen-menu"),
  checkout: document.getElementById("screen-checkout"),
};
const backBtn = document.getElementById("backBtn");
const headerTitle = document.getElementById("headerTitle");
const headerSubtitle = document.getElementById("headerSubtitle");

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle("hidden", key !== name);
  });
  backBtn.classList.toggle("hidden", name === "restaurants");
  document.getElementById("cartBar").classList.toggle(
    "hidden",
    name === "checkout" || getCartCount() === 0
  );

  if (name === "restaurants") {
    headerTitle.textContent = "CHODAK";
    headerSubtitle.textContent = "BirZum";
  } else if (name === "menu" && currentRestaurant) {
    headerTitle.textContent = currentRestaurant.name;
    headerSubtitle.textContent = "Menyu";
  } else if (name === "checkout") {
    headerTitle.textContent = "Buyurtma";
    headerSubtitle.textContent = currentRestaurant?.name || "";
  }
}

backBtn.onclick = () => {
  if (!screens.checkout.classList.contains("hidden")) {
    showScreen("menu");
  } else if (!screens.menu.classList.contains("hidden")) {
    showScreen("restaurants");
  }
};

// ---------- 1. Restoranlarni yuklash ----------
async function loadRestaurants() {
  const loadingEl = document.getElementById("restaurantsLoading");
  const listEl = document.getElementById("restaurantList");
  const emptyEl = document.getElementById("restaurantsEmpty");

  try {
    const snap = await getDocs(collection(db, "restaurants"));
    restaurants = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((r) => r.active !== false);

    loadingEl.classList.add("hidden");

    if (restaurants.length === 0) {
      emptyEl.classList.remove("hidden");
      return;
    }

    listEl.innerHTML = restaurants
      .map(
        (r) => `
      <button class="restaurant-card" data-id="${r.id}">
        <div class="restaurant-emoji">${r.emoji || "🍽️"}</div>
        <div class="restaurant-info">
          <div class="restaurant-name">${r.name}</div>
          <div class="restaurant-desc">${r.description || ""}</div>
        </div>
      </button>
    `
      )
      .join("");

    listEl.querySelectorAll(".restaurant-card").forEach((card) => {
      card.onclick = () => openRestaurant(card.dataset.id);
    });
  } catch (err) {
    console.error(err);
    loadingEl.textContent =
      "Yuklashda xatolik. Firebase sozlamalarini tekshiring.";
  }
}

// ---------- 2. Restoran menyusini ochish ----------
async function openRestaurant(restaurantId) {
  currentRestaurant = restaurants.find((r) => r.id === restaurantId);
  if (!currentRestaurant) return;

  document.getElementById("restaurantBanner").innerHTML = `
    <div class="banner-emoji">${currentRestaurant.emoji || "🍽️"}</div>
    <div class="banner-name">${currentRestaurant.name}</div>
    <div class="banner-desc">${currentRestaurant.description || ""}</div>
  `;

  const snap = await getDocs(
    collection(db, "restaurants", restaurantId, "products")
  );
  currentProducts = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => p.available !== false);

  renderCategories();
  renderMenu();
  showScreen("menu");
}

function renderCategories() {
  const cats = [...new Set(currentProducts.map((p) => p.category || "Boshqa"))];
  const el = document.getElementById("categories");
  el.innerHTML = cats
    .map(
      (c, i) =>
        `<button class="cat-chip${i === 0 ? " active" : ""}" data-cat="${c}">${c}</button>`
    )
    .join("");
  el.querySelectorAll(".cat-chip").forEach((chip) => {
    chip.onclick = () => {
      el.querySelectorAll(".cat-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      document
        .getElementById(`cat-section-${chip.dataset.cat}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
  });
}

function renderMenu() {
  const cats = [...new Set(currentProducts.map((p) => p.category || "Boshqa"))];
  const menuEl = document.getElementById("menu");
  menuEl.innerHTML = "";

  cats.forEach((cat) => {
    const section = document.createElement("section");
    section.className = "menu-section";
    section.id = `cat-section-${cat}`;

    const heading = document.createElement("h2");
    heading.textContent = cat;
    section.appendChild(heading);

    const grid = document.createElement("div");
    grid.className = "item-grid";

    currentProducts
      .filter((p) => (p.category || "Boshqa") === cat)
      .forEach((item) => {
        const card = document.createElement("div");
        card.className = "item-card";
        card.innerHTML = `
          <div class="item-emoji">${item.emoji || "🍲"}</div>
          <div class="item-name">${item.name}</div>
          <div class="item-desc">${item.desc || ""}</div>
          <div class="item-footer">
            <div class="item-price">${Number(item.price).toLocaleString()} so'm</div>
            <div class="qty-control" id="qty-${item.id}"></div>
          </div>
        `;
        grid.appendChild(card);
        renderQtyControl(item);
      });

    section.appendChild(grid);
    menuEl.appendChild(section);
  });
}

function renderQtyControl(item) {
  const el = document.getElementById(`qty-${item.id}`);
  if (!el) return;
  const qty = cart[item.id]?.qty || 0;

  if (qty === 0) {
    el.innerHTML = `<button class="qty-btn add">+</button>`;
    el.querySelector(".add").onclick = () => updateQty(item, 1);
  } else {
    el.innerHTML = `
      <button class="qty-btn minus">−</button>
      <span class="qty-val">${qty}</span>
      <button class="qty-btn plus">+</button>
    `;
    el.querySelector(".minus").onclick = () => updateQty(item, -1);
    el.querySelector(".plus").onclick = () => updateQty(item, 1);
  }
}

function updateQty(item, delta) {
  const current = cart[item.id]?.qty || 0;
  const next = Math.max(0, current + delta);
  if (next === 0) delete cart[item.id];
  else cart[item.id] = { ...item, qty: next };

  renderQtyControl(item);
  renderCartBar();
  tg?.HapticFeedback?.impactOccurred("light");
}

function getCartEntries() {
  return Object.values(cart);
}
function getCartCount() {
  return getCartEntries().reduce((s, i) => s + i.qty, 0);
}
function getSubtotal() {
  return getCartEntries().reduce((s, i) => s + i.price * i.qty, 0);
}
function getTotal() {
  return getSubtotal() + getDeliveryFee();
}

// ---------- Savat paneli ----------
const cartBar = document.getElementById("cartBar");
function renderCartBar() {
  const count = getCartCount();
  document.getElementById("cartCount").textContent = count;
  document.getElementById("cartTotal").textContent = getSubtotal().toLocaleString();
  const onMenuScreen = !screens.menu.classList.contains("hidden");
  cartBar.classList.toggle("hidden", count === 0 || !onMenuScreen);
}

document.getElementById("goToCheckout").onclick = () => {
  renderCheckout();
  showScreen("checkout");
  setTimeout(initDeliveryMap, 50); // ekran ko'rinishi uchun kichik kechikish
};

// ---------- Xarita (dastavka nuqtasini belgilash) ----------
function initDeliveryMap() {
  const center =
    currentRestaurant?.lat && currentRestaurant?.lng
      ? [currentRestaurant.lat, currentRestaurant.lng]
      : DEFAULT_CENTER;

  if (!deliveryMap) {
    deliveryMap = L.map("deliveryMap").setView(center, 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(deliveryMap);

    // Restoran joylashuvini xaritada belgilash
    if (currentRestaurant?.lat && currentRestaurant?.lng) {
      L.marker([currentRestaurant.lat, currentRestaurant.lng], {
        icon: L.divIcon({ className: "", html: "🏠", iconSize: [24, 24] }),
      })
        .addTo(deliveryMap)
        .bindPopup(currentRestaurant.name);
    }

    deliveryMap.on("click", (e) => setDeliveryPoint(e.latlng.lat, e.latlng.lng));
  } else {
    deliveryMap.invalidateSize();
    deliveryMap.setView(center, 13);
  }

  // Foydalanuvchining haqiqiy joylashuvini avtomatik aniqlashga urinish
  if (navigator.geolocation && !deliveryMarker) {
    navigator.geolocation.getCurrentPosition(
      (pos) => setDeliveryPoint(pos.coords.latitude, pos.coords.longitude),
      () => {}, // ruxsat berilmasa — jim o'tkazamiz, foydalanuvchi qo'lda bosadi
      { timeout: 5000 }
    );
  }
}

function setDeliveryPoint(lat, lng) {
  if (deliveryMarker) {
    deliveryMarker.setLatLng([lat, lng]);
  } else {
    deliveryMarker = L.marker([lat, lng], { draggable: true }).addTo(deliveryMap);
    deliveryMarker.on("dragend", () => {
      const p = deliveryMarker.getLatLng();
      setDeliveryPoint(p.lat, p.lng);
    });
  }
  deliveryMap.panTo([lat, lng]);

  if (currentRestaurant?.lat && currentRestaurant?.lng) {
    deliveryDistanceKm = haversineKm(
      currentRestaurant.lat,
      currentRestaurant.lng,
      lat,
      lng
    );
  } else {
    deliveryDistanceKm = 1; // restoran koordinatasi kiritilmagan bo'lsa, minimal narx
  }

  updateTotals();
}

function updateTotals() {
  document.getElementById("checkoutSubtotal").textContent = `${getSubtotal().toLocaleString()} so'm`;

  if (deliveryDistanceKm == null) {
    document.getElementById("deliveryFeeLabel").textContent = "— (xaritadan belgilang)";
    document.getElementById("distanceLabel").textContent = "";
  } else {
    document.getElementById("deliveryFeeLabel").textContent = `${getDeliveryFee().toLocaleString()} so'm`;
    document.getElementById("distanceLabel").textContent = `(~${deliveryDistanceKm.toFixed(1)} km)`;
  }

  document.getElementById("checkoutTotal").textContent = `${getTotal().toLocaleString()} so'm`;
}

// ---------- To'lov turi ----------
document.querySelectorAll(".payment-option").forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll(".payment-option").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedPaymentMethod = btn.dataset.method;
  };
});

// ---------- 3. Checkout ----------
function renderCheckout() {
  deliveryDistanceKm = null;
  deliveryMarker = null;
  selectedPaymentMethod = "cash";
  document.querySelectorAll(".payment-option").forEach((b, i) =>
    b.classList.toggle("active", i === 0)
  );

  const entries = getCartEntries();
  document.getElementById("checkoutItems").innerHTML = entries
    .map(
      (i) => `
    <div class="cart-row">
      <div>
        <div class="name">${i.emoji || ""} ${i.name}</div>
        <div class="sub">${i.qty} x ${Number(i.price).toLocaleString()} so'm</div>
      </div>
      <strong>${(i.qty * i.price).toLocaleString()}</strong>
    </div>
  `
    )
    .join("");
  updateTotals();
}

document.getElementById("submitOrder").onclick = async () => {
  const name = document.getElementById("nameInput").value.trim();
  const phone = document.getElementById("phoneInput").value.trim();
  const address = document.getElementById("addressInput").value.trim();
  const comment = document.getElementById("commentInput").value.trim();
  const entries = getCartEntries();

  if (entries.length === 0) return;
  if (!name || !phone || !address) {
    tg?.HapticFeedback?.notificationOccurred("error");
    if (!name) document.getElementById("nameInput").focus();
    else if (!phone) document.getElementById("phoneInput").focus();
    else document.getElementById("addressInput").focus();
    return;
  }
  if (deliveryDistanceKm == null) {
    tg?.HapticFeedback?.notificationOccurred("error");
    alert("Iltimos, xaritada yetkazib berish nuqtasini belgilang.");
    return;
  }

  const order = {
    restaurantId: currentRestaurant.id,
    restaurantName: currentRestaurant.name,
    restaurantChatId: currentRestaurant.telegram_chat_id || null,
    items: entries.map((i) => ({ name: i.name, qty: i.qty, price: i.price })),
    subtotal: getSubtotal(),
    deliveryFee: getDeliveryFee(),
    distanceKm: Number(deliveryDistanceKm.toFixed(2)),
    total: getTotal(),
    paymentMethod: selectedPaymentMethod,
    customerName: name,
    phone,
    address,
    comment,
    status: "new",
    createdAt: serverTimestamp(),
  };

  try {
    await addDoc(collection(db, "orders"), order);

    if (tg) {
      tg.sendData(JSON.stringify(order));
      tg.HapticFeedback?.notificationOccurred("success");
    }

    showSuccess();
  } catch (err) {
    console.error(err);
    alert("Buyurtmani yuborishda xatolik yuz berdi. Qaytadan urinib ko'ring.");
  }
};

function showSuccess() {
  document.getElementById("successOverlay").classList.remove("hidden");
  document.getElementById("successSheet").classList.remove("hidden");
}
document.getElementById("closeSuccess").onclick = () => {
  document.getElementById("successOverlay").classList.add("hidden");
  document.getElementById("successSheet").classList.add("hidden");
  // Savatni tozalab, boshiga qaytish
  Object.keys(cart).forEach((k) => delete cart[k]);
  document.getElementById("nameInput").value = "";
  document.getElementById("phoneInput").value = "";
  document.getElementById("addressInput").value = "";
  document.getElementById("commentInput").value = "";
  renderCartBar();
  showScreen("restaurants");
  if (tg) tg.close();
};

// ---------- Reklama banneri ----------
let ads = [];
let adIndex = 0;
async function loadAds() {
  try {
    const snap = await getDocs(collection(db, "ads"));
    ads = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((a) => a.active !== false);
    if (ads.length === 0) return;

    const el = document.getElementById("adBanner");
    el.classList.remove("hidden");
    showAd();
    if (ads.length > 1) {
      setInterval(() => {
        adIndex = (adIndex + 1) % ads.length;
        showAd();
      }, 4000);
    }
  } catch (err) {
    console.error("Reklama yuklanmadi:", err);
  }
}
function showAd() {
  const ad = ads[adIndex];
  const el = document.getElementById("adBanner");
  el.style.background = ad.color
    ? ad.color
    : "linear-gradient(120deg, var(--paprika), var(--saffron))";
  el.innerHTML = `<span>${ad.emoji || "📣"}</span><span>${ad.text}</span>`;
}

// ---------- Ishga tushirish ----------
loadRestaurants();
loadAds();
showScreen("restaurants");
