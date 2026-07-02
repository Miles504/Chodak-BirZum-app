// ============================================================
// Chodak BirZum — Admin panel logikasi
// ============================================================

import { firebaseConfig, ADMIN_PASSWORD } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---------- Parol ekrani ----------
const loginScreen = document.getElementById("loginScreen");
const adminApp = document.getElementById("adminApp");

document.getElementById("loginBtn").onclick = () => {
  const val = document.getElementById("passwordInput").value;
  if (val === ADMIN_PASSWORD) {
    loginScreen.classList.add("hidden");
    adminApp.classList.remove("hidden");
    init();
  } else {
    document.getElementById("loginError").classList.remove("hidden");
  }
};

// ---------- Tablar ----------
document.querySelectorAll(".admin-tab").forEach((tab) => {
  tab.onclick = () => {
    document.querySelectorAll(".admin-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    document.querySelectorAll(".admin-tab-content").forEach((c) => c.classList.add("hidden"));
    document.getElementById(`tab-${tab.dataset.tab}`).classList.remove("hidden");
  };
});

let restaurants = [];

async function init() {
  await loadRestaurants();
  await loadOrders();
  await loadAds();
}

// ---------- Reklamalar ----------
async function loadAds() {
  const snap = await getDocs(collection(db, "ads"));
  const ads = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  document.getElementById("adsAdminList").innerHTML =
    ads
      .map(
        (a) => `
    <div class="admin-list-item">
      <div class="title">${a.emoji || "📣"} ${a.text}</div>
      <div class="meta">Rang: ${a.color || "standart"}</div>
    </div>
  `
      )
      .join("") || `<div class="admin-list-item">Hali reklama qo'shilmagan</div>`;
}

document.getElementById("addAdBtn").onclick = async () => {
  const text = document.getElementById("adText").value.trim();
  const emoji = document.getElementById("adEmoji").value.trim();
  const color = document.getElementById("adColor").value.trim();

  if (!text) {
    alert("Reklama matnini kiriting");
    return;
  }

  await addDoc(collection(db, "ads"), { text, emoji, color, active: true });

  ["adText", "adEmoji", "adColor"].forEach((id) => (document.getElementById(id).value = ""));
  loadAds();
};

// ---------- Restoranlar ----------
async function loadRestaurants() {
  const snap = await getDocs(collection(db, "restaurants"));
  restaurants = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  document.getElementById("restaurantsAdminList").innerHTML = restaurants
    .map(
      (r) => `
    <div class="admin-list-item">
      <div class="title">${r.emoji || "🍽️"} ${r.name}</div>
      <div class="meta">${r.description || ""} · Tel: ${r.phone || "—"} · Chat ID: ${r.telegram_chat_id || "—"}</div>
      <div class="meta">📍 ${r.lat && r.lng ? `${r.lat}, ${r.lng}` : "koordinata kiritilmagan"}</div>
    </div>
  `
    )
    .join("") || `<div class="admin-list-item">Hali restoran qo'shilmagan</div>`;

  // Mahsulot formasi uchun select'larni to'ldirish
  const options = restaurants
    .map((r) => `<option value="${r.id}">${r.emoji || ""} ${r.name}</option>`)
    .join("");
  document.getElementById("pRestaurant").innerHTML = options;
  document.getElementById("pViewRestaurant").innerHTML = options;

  if (restaurants.length > 0) {
    loadProducts(document.getElementById("pViewRestaurant").value);
  }
}

document.getElementById("addRestaurantBtn").onclick = async () => {
  const name = document.getElementById("rName").value.trim();
  const description = document.getElementById("rDesc").value.trim();
  const emoji = document.getElementById("rEmoji").value.trim();
  const phone = document.getElementById("rPhone").value.trim();
  const telegram_chat_id = document.getElementById("rChatId").value.trim();
  const lat = parseFloat(document.getElementById("rLat").value);
  const lng = parseFloat(document.getElementById("rLng").value);

  if (!name) {
    alert("Restoran nomini kiriting");
    return;
  }

  await addDoc(collection(db, "restaurants"), {
    name,
    description,
    emoji,
    phone,
    telegram_chat_id,
    lat: isNaN(lat) ? null : lat,
    lng: isNaN(lng) ? null : lng,
    active: true,
  });

  ["rName", "rDesc", "rEmoji", "rPhone", "rChatId", "rLat", "rLng"].forEach(
    (id) => (document.getElementById(id).value = "")
  );
  await loadRestaurants();
};

// ---------- Mahsulotlar ----------
document.getElementById("pViewRestaurant").onchange = (e) => loadProducts(e.target.value);

async function loadProducts(restaurantId) {
  if (!restaurantId) return;
  const snap = await getDocs(collection(db, "restaurants", restaurantId, "products"));
  const products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  document.getElementById("productsAdminList").innerHTML =
    products
      .map(
        (p) => `
    <div class="admin-list-item">
      <div class="title">${p.emoji || "🍲"} ${p.name} — ${Number(p.price).toLocaleString()} so'm</div>
      <div class="meta">${p.category || "Boshqa"} · ${p.desc || ""}</div>
    </div>
  `
      )
      .join("") || `<div class="admin-list-item">Bu restoranda mahsulot yo'q</div>`;
}

document.getElementById("addProductBtn").onclick = async () => {
  const restaurantId = document.getElementById("pRestaurant").value;
  const name = document.getElementById("pName").value.trim();
  const desc = document.getElementById("pDesc").value.trim();
  const category = document.getElementById("pCategory").value.trim() || "Boshqa";
  const price = Number(document.getElementById("pPrice").value);
  const emoji = document.getElementById("pEmoji").value.trim();

  if (!restaurantId) {
    alert("Avval restoran qo'shing");
    return;
  }
  if (!name || !price) {
    alert("Mahsulot nomi va narxini kiriting");
    return;
  }

  await addDoc(collection(db, "restaurants", restaurantId, "products"), {
    name,
    desc,
    category,
    price,
    emoji,
    available: true,
  });

  ["pName", "pDesc", "pCategory", "pPrice", "pEmoji"].forEach(
    (id) => (document.getElementById(id).value = "")
  );
  loadProducts(restaurantId);
};

// ---------- Buyurtmalar ----------
async function loadOrders() {
  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(30));
  const snap = await getDocs(q);
  const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  document.getElementById("ordersAdminList").innerHTML =
    orders
      .map((o) => {
        const itemsText = (o.items || [])
          .map((i) => `${i.name} x${i.qty}`)
          .join(", ");
        return `
      <div class="admin-list-item">
        <div class="title">${o.restaurantName || "?"} — ${Number(o.total).toLocaleString()} so'm</div>
        <div class="meta">${itemsText}</div>
        <div class="meta">${o.customerName} · ${o.phone} · ${o.address}</div>
      </div>
    `;
      })
      .join("") || `<div class="admin-list-item">Hali buyurtma yo'q</div>`;
}
