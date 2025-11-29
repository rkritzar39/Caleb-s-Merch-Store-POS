// ===== Sample Product Data =====
const products = [
    { id: 1, name: "Outdoor Backpack", price: 49.99, category: "Outdoor", img: "img/outdoor1.jpg" },
    { id: 2, name: "Caleb Hat", price: 19.99, category: "Hats", img: "img/hat1.jpg" },
    { id: 3, name: "Logo Hoodie", price: 39.99, category: "Hoodies & Sweatshirts", img: "img/hoodie1.jpg" },
    { id: 4, name: "Graphic Tee", price: 24.99, category: "T-Shirts", img: "img/tshirt1.jpg" },
    { id: 5, name: "Baby Onesie", price: 14.99, category: "Baby & Toddler", img: "img/baby1.jpg" },
    { id: 6, name: "Caleb Mug", price: 12.99, category: "Kitchenwear", img: "img/mug1.jpg" },
    { id: 7, name: "Sticker Pack", price: 4.99, category: "Accessories", img: "img/sticker1.jpg" }
];

// ===== DOM =====
const productGrid = document.getElementById("productGrid");
const categoryList = document.getElementById("categoryList");
const cartItemsEl = document.getElementById("cartItems");
const subtotalEl = document.getElementById("cartSubtotal");
const taxEl = document.getElementById("cartTax");
const totalEl = document.getElementById("cartTotal");

const checkoutModal = document.getElementById("checkoutModal");
const checkoutBtn = document.getElementById("checkoutBtn");

const settingsDrawer = document.getElementById("settingsDrawer");
const settingsBtn = document.getElementById("settingsBtn");

// ===== Cart =====
let cart = [];

// ===== Render Products =====
function renderProducts(filter = "All Products") {
    productGrid.innerHTML = "";

    const filtered =
        filter === "All Products"
            ? products
            : products.filter(p => p.category === filter);

    filtered.forEach(p => {
        const el = document.createElement("div");
        el.className = "product";
        el.innerHTML = `
            <img src="${p.img}" alt="">
            <div class="name">${p.name}</div>
            <div class="price">$${p.price.toFixed(2)}</div>
        `;
        el.onclick = () => addToCart(p);
        productGrid.appendChild(el);
    });
}

renderProducts();

// ===== Category Click =====
categoryList.querySelectorAll("li").forEach(li => {
    li.onclick = () => {
        categoryList.querySelector(".active")?.classList.remove("active");
        li.classList.add("active");
        renderProducts(li.innerText);
    };
});

// ===== Cart Logic =====
function addToCart(prod) {
    const item = cart.find(i => i.id === prod.id);

    if (item) item.qty++;
    else cart.push({ ...prod, qty: 1 });

    renderCart();
}

function renderCart() {
    cartItemsEl.innerHTML = "";

    let subtotal = 0;

    cart.forEach(item => {
        subtotal += item.price * item.qty;

        const row = document.createElement("div");
        row.className = "cart-item";
        row.innerHTML = `
            <span>${item.name} (x${item.qty})</span>
            <span>$${(item.price * item.qty).toFixed(2)}</span>
        `;
        cartItemsEl.appendChild(row);
    });

    const tax = subtotal * 0.07;
    const total = subtotal + tax;

    subtotalEl.innerText = `$${subtotal.toFixed(2)}`;
    taxEl.innerText = `$${tax.toFixed(2)}`;
    totalEl.innerText = `$${total.toFixed(2)}`;
}

// ===== Checkout =====
checkoutBtn.onclick = () => {
    checkoutModal.classList.remove("hidden");
};

document.querySelector(".close-modal").onclick = () => {
    checkoutModal.classList.add("hidden");
};

// ===== Settings Drawer =====
settingsBtn.onclick = () => {
    settingsDrawer.classList.toggle("hidden");
};

document.querySelector(".close-settings").onclick = () => {
    settingsDrawer.classList.add("hidden");
};
