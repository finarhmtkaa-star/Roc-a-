/* ============================================================
   ROCÈA HERBAL TEA — script.js
   ============================================================ */

/* ============ KONFIGURASI ============ */
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwu_nm2wK-JRlqoy0XCicwnrdjCb4AICjnJKbrtiuaNuuvoNybkCSKfiqE37MiPOsym1Q/exec";

const WHATSAPP_NUMBERS = [
    { display: "0823-3723-7718", link: "https://wa.me/6282337237718" },
    { display: "0856-0744-8226", link: "https://wa.me/6285607448226" },
    { display: "0878-9733-8641", link: "https://wa.me/6287897338641" },
    { display: "0857-4615-1290", link: "https://wa.me/6285746151290" }
];

const PRODUCTS = [
    {
        id: "original",
        nama: "ROCÈA Original",
        harga: 7000,
        ukuran: "250 ml",
        kemasan: "Botol plastik transparan 250 ml",
        komposisi: ["Bunga rosella", "Jeruk nipis", "Es"],
        deskripsi: "Minuman rosella dengan rasa segar dan sentuhan jeruk nipis, cocok dinikmati dalam keadaan dingin.",
        keywords: "original rosella jeruk nipis botol 250ml segar dingin herbal",
        gambar: "./assets/rocea-original.png",
        badge: "Best Seller"
    },
    {
        id: "mojito",
        nama: "ROCÈA Mojito",
        harga: 12000,
        ukuran: "400 ml",
        kemasan: "Cup injection plastik transparan 400 ml",
        komposisi: ["Rosella", "Sprite", "Es"],
        deskripsi: "Minuman rosella dengan sensasi Sprite yang menyegarkan, disajikan dingin dalam cup injection 400 ml.",
        keywords: "mojito rosella sprite cup 400ml segar dingin herbal takeaway",
        gambar: "./assets/rocea-mojito.png",
        badge: "New"
    }
];

const FAQ_DATA = [
    { q: "Apa itu ROCÈA?", a: "ROCÈA adalah minuman herbal berbahan dasar rosella dengan pilihan rasa yang menyegarkan." },
    { q: "Berapa ukuran ROCÈA Original?", a: "ROCÈA Original menggunakan botol plastik 250 ml." },
    { q: "Berapa ukuran ROCÈA Mojito?", a: "ROCÈA Mojito menggunakan cup injection 400 ml." },
    { q: "Apa bahan ROCÈA Original?", a: "Bunga rosella, jeruk nipis, dan es." },
    { q: "Apa bahan ROCÈA Mojito?", a: "Rosella, Sprite, dan es." },
    { q: "Bagaimana cara memesan?", a: "Pilih produk, tentukan jumlah, masukkan ke keranjang, lanjutkan checkout, lalu isi data pemesanan." }
];

/* ============ UTIL ============ */
const formatRupiah = (n) => new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
}).format(n);

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getProduct(id) {
    return PRODUCTS.find(p => p.id === id) || null;
}

/* ============ STORAGE ============ */
const Storage = {
    CART: "rocea_cart_v1",
    FAV: "rocea_fav_v1",
    ORDERS: "rocea_orders_v1",
    SEQ: "rocea_seq_v1",

    read(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
            console.warn("Storage read error:", e);
            return fallback;
        }
    },
    write(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.warn("Storage write error:", e);
            return false;
        }
    }
};

/* ============ STATE ============ */
let state = {
    cart: Storage.read(Storage.CART, []),      // [{id, qty}]
    favorites: Storage.read(Storage.FAV, []),   // [id]
    orders: Storage.read(Storage.ORDERS, []),   // [order]
    detail: { id: null, qty: 1 },
    checkoutLoading: false,
    currentPage: "beranda"
};

function persistCart() { Storage.write(Storage.CART, state.cart); }
function persistFav() { Storage.write(Storage.FAV, state.favorites); }
function persistOrders() { Storage.write(Storage.ORDERS, state.orders); }

/* ============ CART LOGIC ============ */
function addToCart(productId, qty = 1) {
    const product = getProduct(productId);
    if (!product) return;
    const existing = state.cart.find(i => i.id === productId);
    if (existing) {
        existing.qty += qty;
    } else {
        state.cart.push({ id: productId, qty });
    }
    persistCart();
    updateCartBadge();
    renderCart();
    showToast(`${product.nama} berhasil ditambahkan ke keranjang.`, "success");
}

function setCartQty(productId, qty) {
    const item = state.cart.find(i => i.id === productId);
    if (!item) return;
    if (qty < 1) qty = 1;
    item.qty = qty;
    persistCart();
    updateCartBadge();
    renderCart();
    renderCheckoutSummary();
}

function removeFromCart(productId) {
    const product = getProduct(productId);
    state.cart = state.cart.filter(i => i.id !== productId);
    persistCart();
    updateCartBadge();
    renderCart();
    renderCheckoutSummary();
    if (product) showToast(`${product.nama} dihapus dari keranjang.`, "info");
}

function clearCart() {
    state.cart = [];
    persistCart();
    updateCartBadge();
    renderCart();
}

function getCartTotal() {
    return state.cart.reduce((sum, item) => {
        const p = getProduct(item.id);
        return sum + (p ? p.harga * item.qty : 0);
    }, 0);
}

function getCartCount() {
    return state.cart.reduce((sum, item) => sum + item.qty, 0);
}

function updateCartBadge() {
    const count = getCartCount();
    const badge = $("#cartBadge");
    const badgeM = $("#cartBadgeMobile");
    if (badge) badge.textContent = count;
    if (badgeM) badgeM.textContent = count;
}

/* ============ FAVORIT LOGIC ============ */
function toggleFavorite(productId) {
    const product = getProduct(productId);
    if (!product) return;
    const idx = state.favorites.indexOf(productId);
    if (idx > -1) {
        state.favorites.splice(idx, 1);
        showToast(`${product.nama} dihapus dari favorit.`, "info");
    } else {
        state.favorites.push(productId);
        showToast(`${product.nama} ditambahkan ke favorit.`, "success");
    }
    persistFav();
    renderProducts();
    renderProductsPage();
    renderFavorites();
    renderDetailFavorite();
}

function isFavorite(productId) {
    return state.favorites.includes(productId);
}

/* ============ NAVIGASI ============ */
function navigateTo(page) {
    const target = $("#page-" + page);
    if (!target) return;

    $$(".page").forEach(p => p.classList.remove("active"));
    target.classList.add("active");

    $$(".nav-link").forEach(l => l.classList.remove("active"));
    $$(`.nav-link[data-nav="${page}"]`).forEach(l => l.classList.add("active"));

    state.currentPage = page;
    closeMobileMenu();

    if (page === "keranjang") renderCart();
    if (page === "checkout") renderCheckoutSummary();
    if (page === "pesanan") renderOrders();
    if (page === "favorit") renderFavorites();

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function openMobileMenu() {
    const nav = $("#navMobile");
    const toggle = $("#menuToggle");
    if (nav) nav.classList.add("open");
    if (toggle) toggle.classList.add("open");
}
function closeMobileMenu() {
    const nav = $("#navMobile");
    const toggle = $("#menuToggle");
    if (nav) nav.classList.remove("open");
    if (toggle) toggle.classList.remove("open");
}

/* ============ RENDER PRODUK ============ */
function productCardHtml(product) {
    const fav = isFavorite(product.id) ? "active" : "";
    const favIcon = isFavorite(product.id) ? "♥" : "♡";
    return `
        <article class="product-card" data-product-id="${product.id}">
            <div class="product-image">
                <img src="${product.gambar}" alt="${escapeHtml(product.nama)}" loading="lazy"
                     onerror="this.onerror=null; this.src='./assets/logo.png';">
                <span class="product-tag">${escapeHtml(product.badge)}</span>
                <button class="product-fav ${fav}" data-fav="${product.id}" aria-label="Favorit ${escapeHtml(product.nama)}">${favIcon}</button>
            </div>
            <div class="product-body">
                <h3 class="product-name">${escapeHtml(product.nama)}</h3>
                <p class="product-meta">${escapeHtml(product.ukuran)} · ${escapeHtml(product.kemasan)}</p>
                <p class="product-desc">${escapeHtml(product.deskripsi)}</p>
                <div class="product-price-row">
                    <span class="product-price">${formatRupiah(product.harga)}</span>
                    <span class="product-unit">per pcs</span>
                </div>
                <div class="product-actions">
                    <div class="qty-control" data-card-qty>
                        <button class="qty-btn" data-qty-action="minus" aria-label="Kurangi jumlah">−</button>
                        <span class="qty-value" data-qty-value>1</span>
                        <button class="qty-btn" data-qty-action="plus" aria-label="Tambah jumlah">+</button>
                    </div>
                </div>
                <div class="product-actions" style="margin-top:10px;">
                    <button class="btn btn-detail" data-detail="${product.id}">Detail</button>
                    <button class="btn btn-primary" data-add="${product.id}">Tambah ke Keranjang</button>
                </div>
            </div>
        </article>
    `;
}

function renderProducts(filter = "") {
    const grid = $("#productGrid");
    if (!grid) return;
    const list = filterProducts(filter);
    grid.innerHTML = list.map(productCardHtml).join("");
    const empty = $("#searchEmpty");
    if (empty) empty.style.display = list.length === 0 ? "block" : "none";
}

function renderProductsPage(filter = "") {
    const grid = $("#productGridPage");
    if (!grid) return;
    const list = filterProducts(filter);
    grid.innerHTML = list.map(productCardHtml).join("");
    const empty = $("#searchEmptyPage");
    if (empty) empty.style.display = list.length === 0 ? "block" : "none";
}

function filterProducts(query) {
    const q = (query || "").toLowerCase().trim();
    if (!q) return PRODUCTS;
    return PRODUCTS.filter(p =>
        p.nama.toLowerCase().includes(q) ||
        p.deskripsi.toLowerCase().includes(q) ||
        p.keywords.toLowerCase().includes(q)
    );
}

/* ============ RENDER FAVORIT ============ */
function renderFavorites() {
    const grid = $("#favoritGrid");
    const empty = $("#favoritEmpty");
    if (!grid) return;
    const list = PRODUCTS.filter(p => isFavorite(p.id));
    grid.innerHTML = list.map(productCardHtml).join("");
    if (empty) empty.style.display = list.length === 0 ? "block" : "none";
}

/* ============ RENDER CART ============ */
function renderCart() {
    const container = $("#cartContainer");
    if (!container) return;

    if (state.cart.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🛒</div>
                <h3>Keranjang kamu masih kosong.</h3>
                <p>Yuk pilih minuman herbal favoritmu dulu.</p>
                <button class="btn btn-primary" data-nav="produk">Belanja Sekarang</button>
            </div>
        `;
        return;
    }

    const itemsHtml = state.cart.map(item => {
        const p = getProduct(item.id);
        if (!p) return "";
        const sub = p.harga * item.qty;
        return `
            <div class="cart-item" data-cart-item="${p.id}">
                <img class="cart-item-img" src="${p.gambar}" alt="${escapeHtml(p.nama)}"
                     onerror="this.onerror=null; this.src='./assets/logo.png';">
                <div class="cart-item-info">
                    <div class="cart-item-name">${escapeHtml(p.nama)}</div>
                    <div class="cart-item-price">${formatRupiah(p.harga)} × ${item.qty} ${p.ukuran}</div>
                    <div class="cart-item-sub">${formatRupiah(sub)}</div>
                </div>
                <div class="cart-item-actions">
                    <div class="qty-control">
                        <button class="qty-btn" data-cart-minus="${p.id}" aria-label="Kurangi">−</button>
                        <span class="qty-value">${item.qty}</span>
                        <button class="qty-btn" data-cart-plus="${p.id}" aria-label="Tambah">+</button>
                    </div>
                    <button class="cart-remove" data-cart-remove="${p.id}">Hapus</button>
                </div>
            </div>
        `;
    }).join("");

    const total = getCartTotal();

    container.innerHTML = `
        <div class="cart-layout">
            <div class="cart-items">${itemsHtml}</div>
            <div class="cart-summary">
                <h3>Total Belanja</h3>
                <div class="summary-row"><span>Jumlah Item</span><span>${getCartCount()} pcs</span></div>
                <div class="summary-row total"><span>Total</span><span>${formatRupiah(total)}</span></div>
                <button class="btn btn-primary btn-block" data-nav="checkout">Checkout</button>
                <button class="btn btn-ghost btn-block" style="margin-top:8px;" data-nav="produk">Lanjut Belanja</button>
            </div>
        </div>
    `;
}

/* ============ RENDER CHECKOUT SUMMARY ============ */
function renderCheckoutSummary() {
    const container = $("#checkoutSummary");
    if (!container) return;
    if (state.cart.length === 0) {
        container.innerHTML = `<p style="color:var(--text-soft);font-size:.9rem;">Keranjang kosong.</p>`;
        return;
    }
    const lines = state.cart.map(item => {
        const p = getProduct(item.id);
        if (!p) return "";
        return `
            <div class="summary-product">
                <div>
                    <div class="summary-product-name">${escapeHtml(p.nama)}</div>
                    <div class="summary-product-qty">${item.qty} × ${formatRupiah(p.harga)}</div>
                </div>
                <div class="summary-product-sub">${formatRupiah(p.harga * item.qty)}</div>
            </div>
        `;
    }).join("");

    const total = getCartTotal();
    container.innerHTML = `
        ${lines}
        <div class="summary-row total"><span>Total</span><span>${formatRupiah(total)}</span></div>
    `;
}

/* ============ DETAIL MODAL ============ */
function openDetail(productId) {
    const p = getProduct(productId);
    if (!p) return;
    state.detail = { id: productId, qty: 1 };

    $("#detailImg").src = p.gambar;
    $("#detailImg").alt = p.nama;
    $("#detailImg").onerror = function () { this.onerror = null; this.src = "./assets/logo.png"; };
    $("#detailBadge").textContent = p.badge;
    $("#detailTitle").textContent = p.nama;
    $("#detailPrice").textContent = formatRupiah(p.harga);
    $("#detailUkuran").textContent = p.ukuran;
    $("#detailKemasan").textContent = p.kemasan;
    $("#detailDeskripsi").textContent = p.deskripsi;
    $("#detailQty").textContent = "1";
    $("#detailSubtotal").textContent = formatRupiah(p.harga);
    $("#detailKomposisi").innerHTML = p.komposisi.map(k => `<span class="chip">${escapeHtml(k)}</span>`).join("");

    renderDetailFavorite();
    openModal("#detailModal");
}

function renderDetailFavorite() {
    const btn = $("#btnDetailFav");
    if (!btn || !state.detail.id) return;
    const fav = isFavorite(state.detail.id);
    btn.classList.toggle("active", fav);
    btn.textContent = fav ? "♥" : "♡";
}

function updateDetailQty(delta) {
    if (!state.detail.id) return;
    state.detail.qty = Math.max(1, state.detail.qty + delta);
    const p = getProduct(state.detail.id);
    $("#detailQty").textContent = state.detail.qty;
    $("#detailSubtotal").textContent = formatRupiah(p.harga * state.detail.qty);
    if (delta !== 0) showToast("Jumlah diperbarui.", "info");
}

/* ============ MODAL ============ */
function openModal(sel) {
    const m = $(sel);
    if (!m) return;
    m.classList.add("open");
    document.body.style.overflow = "hidden";
}
function closeModal(sel) {
    const m = $(sel);
    if (!m) return;
    m.classList.remove("open");
    document.body.style.overflow = "";
}
function closeAllModals() {
    $$(".modal").forEach(m => m.classList.remove("open"));
    document.body.style.overflow = "";
}

/* ============ CS MODAL ============ */
function renderCsList() {
    const list = $("#csList");
    if (!list) return;
    list.innerHTML = WHATSAPP_NUMBERS.map(n => `
        <a class="cs-item" href="${n.link}" target="_blank" rel="noopener">
            <span class="cs-item-icon">💬</span>
            <span class="cs-item-text">
                <strong>${n.display}</strong>
                <small>Chat via WhatsApp</small>
            </span>
            <span class="profile-item-arrow">→</span>
        </a>
    `).join("");
}

/* ============ FAQ ============ */
function renderFaq() {
    const list = $("#faqList");
    if (!list) return;
    list.innerHTML = FAQ_DATA.map((f, i) => `
        <div class="faq-item" data-faq="${i}">
            <button class="faq-question" aria-expanded="false">
                <span>${escapeHtml(f.q)}</span>
                <span class="faq-arrow">⌄</span>
            </button>
            <div class="faq-answer">
                <div class="faq-answer-inner">${escapeHtml(f.a)}</div>
            </div>
        </div>
    `).join("");
}

function toggleFaq(el) {
    const item = el.closest(".faq-item");
    if (!item) return;
    const isOpen = item.classList.contains("open");
    $$(".faq-item").forEach(i => {
        i.classList.remove("open");
        const q = i.querySelector(".faq-question");
        if (q) q.setAttribute("aria-expanded", "false");
    });
    if (!isOpen) {
        item.classList.add("open");
        const q = item.querySelector(".faq-question");
        if (q) q.setAttribute("aria-expanded", "true");
    }
}

/* ============ TOAST ============ */
let toastTimer = null;
function showToast(message, type = "info") {
    const container = $("#toastContainer");
    if (!container) return;
    const icons = { success: "✅", error: "⚠️", info: "🔔" };
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="toast-icon">${icons[type] || "🔔"}</span><span>${escapeHtml(message)}</span>`;
    container.appendChild(el);

    setTimeout(() => {
        el.classList.add("out");
        setTimeout(() => el.remove(), 300);
    }, 2600);
}

/* ============ ORDER ID ============ */
function generateOrderId() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const dateStr = `${y}${m}${d}`;

    const seqData = Storage.read(Storage.SEQ, { date: "", counter: 0 });
    let counter = 1;
    if (seqData.date === dateStr) {
        counter = (seqData.counter || 0) + 1;
    }
    Storage.write(Storage.SEQ, { date: dateStr, counter });

    return `RCA-${dateStr}-${String(counter).padStart(3, "0")}`;
}

/* ============ FORMAT TANGGAL/JAM ============ */
function getNowParts() {
    const now = new Date();
    const tgl = now.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
    const jam = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return { tgl, jam };
}

/* ============ CHECKOUT VALIDASI ============ */
function validateCheckout() {
    const errors = {};
    const nama = $("#inpNama").value.trim();
    const wa = $("#inpWa").value.trim();
    const alamat = $("#inpAlamat").value.trim();
    const pembayaran = $('input[name="pembayaran"]:checked');

    if (!nama) errors.nama = "Nama wajib diisi.";
    if (!wa) errors.wa = "Nomor WhatsApp wajib diisi.";
    else if (!/^[0-9+\-\s()]{8,20}$/.test(wa)) errors.wa = "Format nomor WhatsApp tidak valid.";
    if (!alamat) errors.alamat = "Alamat wajib diisi.";
    if (!pembayaran) errors.pembayaran = "Pilih metode pembayaran.";
    if (state.cart.length === 0) errors.cart = "Keranjang masih kosong.";

    return errors;
}

function showFieldErrors(errors) {
    // reset
    $$(".form-group input, .form-group textarea").forEach(el => el.classList.remove("error"));
    ["#errNama", "#errWa", "#errAlamat", "#errPembayaran"].forEach(sel => {
        const el = $(sel);
        if (el) el.textContent = "";
    });

    const banner = $("#formErrorBanner");
    if (errors.cart) {
        banner.style.display = "block";
        banner.textContent = errors.cart;
    } else if (Object.keys(errors).length > 0) {
        banner.style.display = "block";
        banner.textContent = "Mohon lengkapi data yang masih kosong.";
    } else {
        banner.style.display = "none";
    }

    if (errors.nama) { $("#inpNama").classList.add("error"); $("#errNama").textContent = errors.nama; }
    if (errors.wa) { $("#inpWa").classList.add("error"); $("#errWa").textContent = errors.wa; }
    if (errors.alamat) { $("#inpAlamat").classList.add("error"); $("#errAlamat").textContent = errors.alamat; }
    if (errors.pembayaran) { $("#errPembayaran").textContent = errors.pembayaran; }
}

/* ============ BUILD ORDER DATA ============ */
function buildOrderData(orderId) {
    const nama = $("#inpNama").value.trim();
    const wa = $("#inpWa").value.trim();
    const alamat = $("#inpAlamat").value.trim();
    const pembayaran = $('input[name="pembayaran"]:checked').value;
    const catatan = $("#inpCatatan").value.trim();
    const { tgl, jam } = getNowParts();

    const items = state.cart.map(item => {
        const p = getProduct(item.id);
        return {
            id: p.id,
            nama: p.nama,
            qty: item.qty,
            hargaSatuan: p.harga,
            subtotal: p.harga * item.qty
        };
    });

    const total = items.reduce((s, i) => s + i.subtotal, 0);

    return {
        idPesanan: orderId,
        tanggal: tgl,
        jam: jam,
        nama: nama,
        noWhatsapp: wa,
        alamat: alamat,
        produk: items.map(i => `${i.nama} × ${i.qty}`).join(", "),
        items: items,
        jumlah: items.reduce((s, i) => s + i.qty, 0),
        hargaSatuan: items.map(i => `${i.nama}: ${i.hargaSatuan}`).join(", "),
        subtotal: items.map(i => `${i.nama}: ${i.subtotal}`).join(", "),
        total: total,
        pembayaran: pembayaran,
        catatan: catatan || "-",
        status: "Menunggu Konfirmasi"
    };
}

/* ============ SUBMIT CHECKOUT ============ */
async function submitCheckout(e) {
    if (e) e.preventDefault();
    if (state.checkoutLoading) return;

    const errors = validateCheckout();
    if (Object.keys(errors).length > 0) {
        showFieldErrors(errors);
        showToast("Mohon lengkapi data checkout.", "error");
        return;
    }
    showFieldErrors({});

    const btn = $("#btnBuatPesanan");
    state.checkoutLoading = true;
    btn.disabled = true;
    btn.textContent = "Memproses pesanan...";

    const orderId = generateOrderId();
    const orderData = buildOrderData(orderId);

    try {
        const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(orderData)
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        let data = null;
        try { data = await res.json(); } catch (_) { data = null; }

        // anggap sukses jika server menyatakan ok/success ATAU response sukses tanpa body error
        const ok = data && (data.status === "success" || data.success === true || data.ok === true);

        if (!ok) {
            // Jika server tidak eksplisit sukses, tetap kita perlakukan sebagai gagal
            throw new Error((data && (data.message || data.error)) || "Server tidak mengkonfirmasi pesanan.");
        }

        // SUCCESS
        const savedOrder = {
            idPesanan: orderData.idPesanan,
            tanggal: orderData.tanggal,
            jam: orderData.jam,
            items: orderData.items,
            total: orderData.total,
            pembayaran: orderData.pembayaran,
            status: orderData.status,
            nama: orderData.nama,
            catatan: orderData.catatan
        };
        state.orders.unshift(savedOrder);
        persistOrders();

        clearCart();
        showSuccessPage(savedOrder);
        showToast("Pesanan berhasil dibuat! 🎉", "success");

    } catch (err) {
        console.error("Checkout error:", err);
        const banner = $("#formErrorBanner");
        banner.style.display = "block";
        banner.textContent = "Gagal mengirim pesanan: " + (err.message || "Terjadi kesalahan.") + " Silakan coba lagi.";
        showToast("Gagal mengirim pesanan. Coba lagi.", "error");
    } finally {
        state.checkoutLoading = false;
        btn.disabled = false;
        btn.textContent = "Buat Pesanan";
    }
}

/* ============ SUCCESS PAGE ============ */
function showSuccessPage(order) {
    $("#suksesOrderId").textContent = order.idPesanan;
    $("#suksesDetails").innerHTML = `
        <div class="summary-row"><span>Nama</span><span>${escapeHtml(order.nama)}</span></div>
        <div class="summary-row"><span>Total</span><span>${formatRupiah(order.total)}</span></div>
        <div class="summary-row"><span>Pembayaran</span><span>${escapeHtml(order.pembayaran)}</span></div>
        <div class="summary-row"><span>Status</span><span>${escapeHtml(order.status)}</span></div>
    `;
    navigateTo("sukses");
}

/* ============ RENDER ORDERS ============ */
function renderOrders() {
    const container = $("#ordersContainer");
    if (!container) return;
    if (state.orders.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📦</div>
                <h3>Belum ada pesanan.</h3>
                <p>Yuk buat pesanan pertamamu di ROCÈA.</p>
                <button class="btn btn-primary" data-nav="produk">Belanja Sekarang</button>
            </div>
        `;
        return;
    }

    container.innerHTML = state.orders.map(o => `
        <div class="order-card">
            <div class="order-card-head">
                <div>
                    <div class="order-id">${escapeHtml(o.idPesanan)}</div>
                    <div class="order-date">${escapeHtml(o.tanggal)} · ${escapeHtml(o.jam)}</div>
                </div>
                <span class="status-badge">${escapeHtml(o.status)}</span>
            </div>
            <div class="order-products">
                ${o.items.map(i => `
                    <div class="order-product-line">
                        <span><strong>${escapeHtml(i.nama)}</strong> × ${i.qty}</span>
                        <span>${formatRupiah(i.subtotal)}</span>
                    </div>
                `).join("")}
            </div>
            <div class="order-card-foot">
                <span class="order-payment">${escapeHtml(o.pembayaran)}</span>
                <span class="order-total">${formatRupiah(o.total)}</span>
            </div>
        </div>
    `).join("");
}

/* ============ EVENT DELEGATION ============ */
function bindEvents() {
    // Navigasi
    document.addEventListener("click", (e) => {
        const navEl = e.target.closest("[data-nav]");
        if (navEl) {
            e.preventDefault();
            navigateTo(navEl.dataset.nav);
            return;
        }

        // mobile toggle
        if (e.target.closest("#menuToggle")) {
            const nav = $("#navMobile");
            if (nav.classList.contains("open")) closeMobileMenu();
            else openMobileMenu();
            return;
        }

        // product favorite
        const favBtn = e.target.closest("[data-fav]");
        if (favBtn) {
            e.stopPropagation();
            toggleFavorite(favBtn.dataset.fav);
            return;
        }

        // detail button
        const detailBtn = e.target.closest("[data-detail]");
        if (detailBtn) {
            openDetail(detailBtn.dataset.detail);
            return;
        }

        // add to cart (card)
        const addBtn = e.target.closest("[data-add]");
        if (addBtn) {
            const card = addBtn.closest(".product-card");
            const qtyVal = card ? parseInt(card.querySelector("[data-qty-value]").textContent, 10) || 1 : 1;
            addToCart(addBtn.dataset.add, qtyVal);
            return;
        }

        // card qty +/-
        const qtyBtn = e.target.closest("[data-qty-action]");
        if (qtyBtn) {
            const control = qtyBtn.closest("[data-card-qty]");
            const valueEl = control.querySelector("[data-qty-value]");
            let v = parseInt(valueEl.textContent, 10) || 1;
            if (qtyBtn.dataset.qtyAction === "plus") v++;
            else v = Math.max(1, v - 1);
            valueEl.textContent = v;
            return;
        }

        // detail qty
        const detailQtyBtn = e.target.closest("[data-detail-qty] .qty-btn");
        if (detailQtyBtn) {
            updateDetailQty(detailQtyBtn.dataset.action === "plus" ? 1 : -1);
            return;
        }

        // detail add
        if (e.target.closest("#btnDetailAdd")) {
            if (state.detail.id) {
                addToCart(state.detail.id, state.detail.qty);
                closeModal("#detailModal");
            }
            return;
        }

        // detail fav
        if (e.target.closest("#btnDetailFav")) {
            if (state.detail.id) toggleFavorite(state.detail.id);
            return;
        }

        // cart +/-
        const cartPlus = e.target.closest("[data-cart-plus]");
        if (cartPlus) {
            const item = state.cart.find(i => i.id === cartPlus.dataset.cartPlus);
            if (item) setCartQty(item.id, item.qty + 1);
            return;
        }
        const cartMinus = e.target.closest("[data-cart-minus]");
        if (cartMinus) {
            const item = state.cart.find(i => i.id === cartMinus.dataset.cartMinus);
            if (item) setCartQty(item.id, item.qty - 1);
            return;
        }
        const cartRemove = e.target.closest("[data-cart-remove]");
        if (cartRemove) {
            removeFromCart(cartRemove.dataset.cartRemove);
            return;
        }

        // FAQ
        const faqQ = e.target.closest(".faq-question");
        if (faqQ) {
            toggleFaq(faqQ);
            return;
        }

        // CS
        if (e.target.closest("#btnCs")) {
            renderCsList();
            openModal("#csModal");
            return;
        }

        // close modal
        if (e.target.closest("[data-close-modal]")) {
            closeAllModals();
            return;
        }

        // Bantuan link -> FAQ
        if (e.target.closest("#btnBantuan")) {
            e.preventDefault();
            navigateTo("beranda");
            setTimeout(() => {
                const faq = $("#faqList");
                if (faq) faq.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 200);
            return;
        }
    });

    // Search
    const searchHome = $("#searchInput");
    if (searchHome) searchHome.addEventListener("input", (e) => renderProducts(e.target.value));
    const searchPage = $("#searchInputPage");
    if (searchPage) searchPage.addEventListener("input", (e) => renderProductsPage(e.target.value));

    // Checkout form
    const checkoutForm = $("#checkoutForm");
    if (checkoutForm) checkoutForm.addEventListener("submit", submitCheckout);

    // Escape key to close modals
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeAllModals();
    });

    // Scroll header shadow
    window.addEventListener("scroll", () => {
        const header = $("#header");
        if (header) header.classList.toggle("scrolled", window.scrollY > 8);
    }, { passive: true });

    // clear checkout field errors on input
    ["#inpNama", "#inpWa", "#inpAlamat"].forEach(sel => {
        const el = $(sel);
        if (el) el.addEventListener("input", () => {
            el.classList.remove("error");
            const banner = $("#formErrorBanner");
            if (banner) banner.style.display = "none";
        });
    });
    $$('input[name="pembayaran"]').forEach(r => {
        r.addEventListener("change", () => {
            const err = $("#errPembayaran");
            if (err) err.textContent = "";
            const banner = $("#formErrorBanner");
            if (banner) banner.style.display = "none";
        });
    });
}

/* ============ INIT ============ */
function init() {
    renderProducts();
    renderProductsPage();
    renderFavorites();
    renderFaq();
    renderCart();
    renderCheckoutSummary();
    renderOrders();
    updateCartBadge();
    renderCsList();
    bindEvents();

    // handle hash awal
    if (location.hash === "#produk") navigateTo("produk");
    else navigateTo("beranda");
}

document.addEventListener("DOMContentLoaded", init);