// ============================================================
// INTERRA Delivery — Mini App logic
// Menyuni MENU massividan o'zgartiring, qolgani avtomatik ishlaydi.
// ============================================================

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

const MENU = [
  {
    category: "Osh & Milliy",
    items: [
      { id: "p1", name: "Toshkent oshi", desc: "Qo'y go'shti, sabzi, guruch", price: 35000, emoji: "🍚" },
      { id: "p2", name: "Manti (6 dona)", desc: "Bug'da pishirilgan, qatiq bilan", price: 28000, emoji: "🥟" },
      { id: "p3", name: "Norin", desc: "An'anaviy retsept", price: 32000, emoji: "🍜" },
    ],
  },
  {
    category: "Fast-food",
    items: [
      { id: "p4", name: "Burger Klassik", desc: "Mol go'shti, pishloq, sous", price: 24000, emoji: "🍔" },
      { id: "p5", name: "Lavash Tovuq", desc: "Tovuq, sabzavotlar, sous", price: 21000, emoji: "🌯" },
      { id: "p6", name: "Fri kartoshka", desc: "O'rta porsiya", price: 12000, emoji: "🍟" },
    ],
  },
  {
    category: "Ichimliklar",
    items: [
      { id: "p7", name: "Kompot", desc: "Uy sharoitida tayyorlangan", price: 8000, emoji: "🥤" },
      { id: "p8", name: "Cola 0.5L", desc: "Sovutilgan", price: 9000, emoji: "🥫" },
    ],
  },
];

const cart = {}; // { id: qty }

// ---------- Render categories ----------
const categoriesEl = document.getElementById("categories");
MENU.forEach((section, idx) => {
  const chip = document.createElement("button");
  chip.className = "cat-chip" + (idx === 0 ? " active" : "");
  chip.textContent = section.category;
  chip.onclick = () => {
    document.querySelectorAll(".cat-chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    document.getElementById(`section-${idx}`).scrollIntoView({ behavior: "smooth", block: "start" });
  };
  categoriesEl.appendChild(chip);
});

// ---------- Render menu ----------
const menuEl = document.getElementById("menu");
MENU.forEach((section, idx) => {
  const sectionEl = document.createElement("section");
  sectionEl.className = "menu-section";
  sectionEl.id = `section-${idx}`;

  const heading = document.createElement("h2");
  heading.textContent = section.category;
  sectionEl.appendChild(heading);

  const grid = document.createElement("div");
  grid.className = "item-grid";

  section.items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "item-card";
    card.innerHTML = `
      <div class="item-emoji">${item.emoji}</div>
      <div class="item-name">${item.name}</div>
      <div class="item-desc">${item.desc}</div>
      <div class="item-footer">
        <div class="item-price">${item.price.toLocaleString()} so'm</div>
        <div class="qty-control" id="qty-${item.id}"></div>
      </div>
    `;
    grid.appendChild(card);
    renderQtyControl(item);
  });

  sectionEl.appendChild(grid);
  menuEl.appendChild(sectionEl);
});

function renderQtyControl(item) {
  const el = document.getElementById(`qty-${item.id}`);
  const qty = cart[item.id] || 0;

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
  const current = cart[item.id] || 0;
  const next = Math.max(0, current + delta);
  if (next === 0) delete cart[item.id];
  else cart[item.id] = next;

  renderQtyControl(item);
  renderCartBar();
  if (tg) tg.HapticFeedback?.impactOccurred("light");
}

function getAllItems() {
  return MENU.flatMap((s) => s.items);
}

function getCartEntries() {
  const all = getAllItems();
  return Object.entries(cart).map(([id, qty]) => {
    const item = all.find((i) => i.id === id);
    return { ...item, qty };
  });
}

function getTotal() {
  return getCartEntries().reduce((sum, i) => sum + i.price * i.qty, 0);
}

// ---------- Cart bar ----------
const cartBar = document.getElementById("cartBar");
function renderCartBar() {
  const entries = getCartEntries();
  const count = entries.reduce((s, i) => s + i.qty, 0);
  const total = getTotal();

  document.getElementById("cartCount").textContent = count;
  document.getElementById("cartTotal").textContent = total.toLocaleString();

  cartBar.classList.toggle("hidden", count === 0);
}

// ---------- Cart sheet ----------
const cartOverlay = document.getElementById("cartOverlay");
const cartSheet = document.getElementById("cartSheet");

document.getElementById("openCart").onclick = openCart;
cartOverlay.onclick = closeCart;

function openCart() {
  renderCartSheet();
  cartOverlay.classList.remove("hidden");
  cartSheet.classList.remove("hidden");
}
function closeCart() {
  cartOverlay.classList.add("hidden");
  cartSheet.classList.add("hidden");
}

function renderCartSheet() {
  const entries = getCartEntries();
  const itemsEl = document.getElementById("cartItems");

  if (entries.length === 0) {
    itemsEl.innerHTML = `<div class="empty-cart">Savat bo'sh</div>`;
  } else {
    itemsEl.innerHTML = entries
      .map(
        (i) => `
      <div class="cart-row">
        <div>
          <div class="name">${i.emoji} ${i.name}</div>
          <div class="sub">${i.qty} x ${i.price.toLocaleString()} so'm</div>
        </div>
        <strong>${(i.qty * i.price).toLocaleString()}</strong>
      </div>
    `
      )
      .join("");
  }

  document.getElementById("sheetTotal").textContent = `${getTotal().toLocaleString()} so'm`;
}

// ---------- Address ----------
const addressInput = document.getElementById("addressInput");
const addrLabel = document.getElementById("addrLabel");
addressInput.addEventListener("input", () => {
  addrLabel.textContent = addressInput.value.trim() || "Manzilni kiriting";
});
document.getElementById("addrBtn").onclick = openCart;

// ---------- Submit order ----------
document.getElementById("submitOrder").onclick = () => {
  const entries = getCartEntries();
  const address = addressInput.value.trim();

  if (entries.length === 0) {
    tg?.HapticFeedback?.notificationOccurred("error");
    return;
  }
  if (!address) {
    addressInput.focus();
    tg?.HapticFeedback?.notificationOccurred("error");
    return;
  }

  const order = {
    items: entries.map((i) => ({ name: i.name, qty: i.qty, price: i.price })),
    total: getTotal(),
    address,
  };

  if (tg) {
    // Bu ma'lumot bot.js dagi bot.on("message") handleriga boradi
    tg.sendData(JSON.stringify(order));
    tg.HapticFeedback?.notificationOccurred("success");
    tg.close();
  } else {
    // Brauzerda test qilish uchun
    alert("Buyurtma (test rejimi):\n" + JSON.stringify(order, null, 2));
  }
};
