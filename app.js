/**
 * app.js — Apple-style POS (Local-only with advanced sales engine)
 *
 * Features:
 * - LocalStorage backend (products, users, sales, session)
 * - Inventory CRUD (admin)
 * - Cart, checkout, delivery + shipping
 * - Discounts engine: global, category, product, flash (time-window), manual at checkout
 * - Void & refund flows; inventory restock on refund option
 * - PDF receipt generation via jsPDF
 * - Demo users: admin & staff
 *
 * Drop into same folder as index.html/styles.css and open index.html
 */

/* ---------- CONFIG ---------- */
const TAX_RATE = 0.07; // 7%
const SHIPPING = { flat: 6.50, freeOver: 100.00 }; // dollars

/* STORAGE KEYS */
const KEY_PRODUCTS = 'caleb_products_v2';
const KEY_USERS = 'caleb_users_v2';
const KEY_SALES = 'caleb_sales_v2';
const KEY_SESSION = 'caleb_session_v2';

/* ---------- DISCOUNT / SALE ENGINE (configurable) ---------- */
const POS_SETTINGS = {
  globalSale: {
    active: false,
    label: 'Black Friday 30% Off',
    type: 'percentage', // 'percentage' or 'fixed'
    value: 30 // percent
  },
  categorySales: {
    // Example: 'Hoodies & Sweatshirts': { active:true, type:'percentage', value:20 }
  },
  productSales: {
    // Example: 'HD-001': { active:true, type:'fixed', value:15.00 }
  },
  flashSales: [
    // Example time-based (ISO strings). Local time is used.
    // { id:'flash1', productId:'HD-001', active:true, type:'percentage', value:50, start:'2025-11-29T00:00:00', end:'2025-11-29T23:59:59' }
  ]
};

/* ---------- DEMO SEED ---------- */
function idNow(){ return 'id_' + Math.random().toString(36).slice(2,9) + '_' + Date.now().toString(36) }

const SAMPLE_PRODUCTS = [
  { id: idNow(), sku:'OUT-001', name:'Outdoor Backpack', category:'Outdoor', price:49.99, stock:12, img:'', desc:'' },
  { id: idNow(), sku:'HAT-001', name:'Caleb Hat', category:'Hats', price:19.99, stock:30, img:'', desc:'' },
  { id: idNow(), sku:'HD-001', name:'Logo Hoodie', category:'Hoodies & Sweatshirts', price:39.99, stock:18, img:'', desc:'' },
  { id: idNow(), sku:'TEE-001', name:'Graphic Tee', category:'T-Shirts', price:24.99, stock:40, img:'', desc:'' },
  { id: idNow(), sku:'BABY-001', name:'Baby Onesie', category:'Baby & Toddler', price:14.99, stock:20, img:'', desc:'' },
  { id: idNow(), sku:'MUG-001', name:'Caleb Mug', category:'Kitchenwear', price:12.99, stock:25, img:'', desc:'' },
  { id: idNow(), sku:'STK-001', name:'Sticker Pack', category:'Accessories', price:4.99, stock:250, img:'', desc:'' }
];

/* ---------- APP STATE ---------- */
let PRODUCTS = load(KEY_PRODUCTS) || SAMPLE_PRODUCTS.slice();
let USERS = load(KEY_USERS) || seedUsers();
let SALES = load(KEY_SALES) || [];
let SESSION = load(KEY_SESSION) || null;
let CART = [];

/* ---------- DOM ---------- */
const productGrid = document.getElementById('productGrid');
const searchInput = document.getElementById('searchInput');
const pills = document.querySelectorAll('.pill');

const cartList = document.getElementById('cartList');
const itemsCount = document.getElementById('itemsCount');
const employeeBadge = document.getElementById('employeeBadge');

const subtotalEl = document.getElementById('subtotal');
const discountTotalEl = document.getElementById('discountTotal');
const shippingEl = document.getElementById('shipping');
const taxEl = document.getElementById('tax');
const totalEl = document.getElementById('total');

const checkoutBtn = document.getElementById('checkoutBtn');
const clearBtn = document.getElementById('clearBtn');

const checkoutModal = document.getElementById('checkoutModal');
const paymentType = document.getElementById('paymentType');
const mixedRow = document.getElementById('mixedRow');
const mixedCash = document.getElementById('mixedCash');
const mixedCard = document.getElementById('mixedCard');
const employeeSelect = document.getElementById('employeeSelect');
const confirmSaleBtn = document.getElementById('confirmSale');
const cancelSaleBtn = document.getElementById('cancelSale');
const manualDiscountInput = document.getElementById('manualDiscount');

const inventoryBtn = document.getElementById('inventoryBtn');
const inventoryModal = document.getElementById('inventoryModal');
const inventoryList = document.getElementById('inventoryList');
const newProductBtn = document.getElementById('newProductBtn');
const importSampleBtn = document.getElementById('importSampleBtn');
const exportInvBtn = document.getElementById('exportInvBtn');
const closeInvBtn = document.getElementById('closeInvBtn');

const productEditor = document.getElementById('productEditor');
const pe_id = document.getElementById('pe_id');
const pe_sku = document.getElementById('pe_sku');
const pe_name = document.getElementById('pe_name');
const pe_price = document.getElementById('pe_price');
const pe_stock = document.getElementById('pe_stock');
const pe_category = document.getElementById('pe_category');
const pe_img = document.getElementById('pe_img');
const pe_desc = document.getElementById('pe_desc');
const saveProductBtn = document.getElementById('saveProductBtn');
const cancelProductBtn = document.getElementById('cancelProductBtn');

const salesBtn = document.getElementById('salesBtn');
const salesModal = document.getElementById('salesModal');
const salesList = document.getElementById('salesList');
const closeSalesBtn = document.getElementById('closeSalesBtn');

const authBtn = document.getElementById('authBtn');
const authModal = document.getElementById('authModal');
const authEmail = document.getElementById('authEmail');
const authPass = document.getElementById('authPass');
const authSubmit = document.getElementById('authSubmit');
const authCancel = document.getElementById('authCancel');
const userInfo = document.getElementById('userInfo');
const modeBtn = document.getElementById('modeBtn');

const custName = document.getElementById('custName');
const custEmail = document.getElementById('custEmail');
const custPhone = document.getElementById('custPhone');
const custAddress = document.getElementById('custAddress');

/* ---------- INIT ---------- */
renderProducts('All Products');
bindUI();
renderCart();
renderAuth();
renderEmployees();

/* ---------- HELPERS: Storage & Utils ---------- */
function load(key){ try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : null } catch(e){ console.warn('load',e); return null } }
function save(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
function round2(n){ return Math.round((n + Number.EPSILON) * 100) / 100; }
function fmt(n){ return round2(n).toFixed(2); }
function seedUsers(){
  const u = [
    { id: idNow(), email:'admin@example.com', name:'Admin', role:'admin', password:'admin123' },
    { id: idNow(), email:'staff@example.com', name:'Staff', role:'staff', password:'staff123' }
  ];
  save(KEY_USERS, u);
  return u;
}

/* ---------- UI BINDINGS ---------- */
function bindUI(){
  // categories
  pills.forEach(p=>{
    p.addEventListener('click', ()=> {
      document.querySelector('.pill.active')?.classList.remove('active');
      p.classList.add('active');
      renderProducts(p.dataset.cat);
    });
  });

  // search
  searchInput.addEventListener('input', ()=> renderProducts(getActiveCat()));

  // product click is bound during renderProducts

  // cart actions
  checkoutBtn.addEventListener('click', ()=> {
    if(CART.length === 0){ alert('Cart empty'); return; }
    if(!SESSION){ alert('Please sign in'); openAuth(); return; }
    openCheckout();
  });
  clearBtn.addEventListener('click', ()=> { CART = []; renderCart(); });

  // checkout modal
  paymentType.addEventListener('change', ()=> mixedRow.classList.toggle('hidden', paymentType.value !== 'mixed'));
  confirmSaleBtn.addEventListener('click', confirmSale);
  cancelSaleBtn.addEventListener('click', ()=> checkoutModal.classList.add('hidden'));

  // inventory
  inventoryBtn.addEventListener('click', ()=> {
    if(!SESSION || SESSION.role !== 'admin'){ alert('Admin required'); openAuth(); return; }
    openInventory();
  });
  newProductBtn.addEventListener('click', ()=> openProductEditor());
  importSampleBtn.addEventListener('click', ()=> { PRODUCTS = SAMPLE_PRODUCTS.concat(PRODUCTS); save(KEY_PRODUCTS, PRODUCTS); renderProducts(getActiveCat()); alert('Sample imported'); });
  exportInvBtn.addEventListener('click', ()=> downloadCSV(PRODUCTS,'inventory.csv'));
  closeInvBtn.addEventListener('click', ()=> inventoryModal.classList.add('hidden'));
  saveProductBtn.addEventListener('click', saveProductFromEditor);
  cancelProductBtn.addEventListener('click', ()=> productEditor.classList.add('hidden'));

  // sales modal
  salesBtn.addEventListener('click', ()=> { renderSales(); salesModal.classList.remove('hidden'); });
  closeSalesBtn.addEventListener('click', ()=> salesModal.classList.add('hidden'));

  // auth
  authBtn.addEventListener('click', ()=> { if(SESSION) signOut(); else openAuth(); });
  authSubmit.addEventListener('click', doAuth);
  authCancel.addEventListener('click', ()=> authModal.classList.add('hidden'));

  // general
  window.addEventListener('keydown', (e)=> {
    if(e.key === 'F1') searchInput.focus();
    if(e.key === 'F2') inventoryBtn.click();
    if(e.key === 'Escape') document.querySelectorAll('.modal').forEach(m=> m.classList.add('hidden'));
  });
  document.querySelectorAll('.modal').forEach(mod => mod.addEventListener('click', e=> { if(e.target === mod) mod.classList.add('hidden'); }));
  modeBtn.addEventListener('click', ()=> alert('Local mode — hybrid Firebase integration is optional later.'));
}

/* ---------- PRODUCTS & INVENTORY ---------- */
function renderProducts(category){
  const q = (searchInput.value || '').trim().toLowerCase();
  productGrid.innerHTML = '';
  const list = PRODUCTS.filter(p => {
    if(category && category !== 'All Products' && p.category !== category) return false;
    if(q && !(p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q))) return false;
    return true;
  });
  list.forEach(p => {
    const el = document.createElement('div'); el.className = 'product';
    // compute badge if any sale
    const saleBadge = activeSaleBadgeForProduct(p);
    el.innerHTML = `
      <div style="width:100%;height:110px;border-radius:10px;overflow:hidden;background:#fafcff;display:flex;align-items:center;justify-content:center">
        <img src="${p.img || ''}" alt="" style="max-width:100%;max-height:100%;display:${p.img?'block':'none'}"/>
        ${p.img ? '' : '<div class="muted">No Image</div>'}
      </div>
      <div class="name">${escapeHtml(p.name)}</div>
      <div class="price">$${fmt(p.price)}</div>
      <div class="muted" style="font-size:12px">${p.sku || ''} • stock ${p.stock}</div>
      ${saleBadge ? `<div style="margin-top:6px;color:var(--accent);font-weight:600">${saleBadge}</div>` : ''}
    `;
    el.addEventListener('click', ()=> addToCart(p.id));
    productGrid.appendChild(el);
  });
}

/* ---------- Discount engine helpers ---------- */
function activeSaleBadgeForProduct(product){
  // priority: flash -> product-specific -> category -> global
  // flash sales active in time window
  const now = new Date();
  for(const f of POS_SETTINGS.flashSales || []){
    if(!f.active) continue;
    if(f.productId !== product.id && f.productId !== product.sku) continue;
    if(f.start && new Date(f.start) > now) continue;
    if(f.end && new Date(f.end) < now) continue;
    return `${f.label || 'Flash Sale'} • ${f.type === 'percentage' ? ('-' + f.value + '%') : ('$' + fmt(f.value))}`;
  }
  // product sale
  const prodSale = POS_SETTINGS.productSales[product.sku] || POS_SETTINGS.productSales[product.id];
  if(prodSale && prodSale.active) return prodSale.type === 'percentage' ? `-${prodSale.value}%` : `$${fmt(prodSale.value)}`;
  // category
  const catSale = POS_SETTINGS.categorySales[product.category];
  if(catSale && catSale.active) return catSale.type === 'percentage' ? `-${catSale.value}%` : `$${fmt(catSale.value)}`;
  // global
  if(POS_SETTINGS.globalSale && POS_SETTINGS.globalSale.active) return POS_SETTINGS.globalSale.type === 'percentage' ? `-${POS_SETTINGS.globalSale.value}%` : `$${fmt(POS_SETTINGS.globalSale.value)}`;
  return null;
}

function computeItemPrice(product){
  // returns { basePrice, discountedPrice, appliedDiscounts: [{label,amount}] }
  const base = Number(product.price);
  let price = base;
  const applied = [];

  // flash
  const now = new Date();
  for(const f of POS_SETTINGS.flashSales || []){
    if(!f.active) continue;
    if(f.productId !== product.id && f.productId !== product.sku) continue;
    if(f.start && new Date(f.start) > now) continue;
    if(f.end && new Date(f.end) < now) continue;
    if(f.type === 'percentage'){ const amt = round2(base * (f.value/100)); price = round2(price - amt); applied.push({ label: f.label || 'Flash', amount: amt }); }
    else { const amt = round2(price - f.value); price = round2(f.value); applied.push({ label: f.label || 'Flash', amount: amt }); }
    return { basePrice:base, discountedPrice:price, applied };
  }

  // product-specific
  const prodKey = POS_SETTINGS.productSales[product.sku] || POS_SETTINGS.productSales[product.id];
  if(prodKey && prodKey.active){
    if(prodKey.type === 'percentage'){ const amt = round2(base * (prodKey.value/100)); price = round2(price - amt); applied.push({ label: `Product ${prodKey.value}%`, amount: amt }); }
    else { const amt = round2(price - prodKey.value); price = round2(prodKey.value); applied.push({ label: `Product $${fmt(prodKey.value)}`, amount: amt }); }
  }

  // category
  const catKey = POS_SETTINGS.categorySales[product.category];
  if(catKey && catKey.active){
    if(catKey.type === 'percentage'){ const amt = round2(base * (catKey.value/100)); price = round2(price - amt); applied.push({ label: `Category ${catKey.value}%`, amount: amt }); }
    else { const amt = round2(price - catKey.value); price = round2(catKey.value); applied.push({ label: `Category $${fmt(catKey.value)}`, amount: amt }); }
  }

  // global
  const g = POS_SETTINGS.globalSale;
  if(g && g.active){
    if(g.type === 'percentage'){ const amt = round2(base * (g.value/100)); price = round2(price - amt); applied.push({ label: `${g.label} ${g.value}%`, amount: amt }); }
    else { const amt = round2(price - g.value); price = round2(g.value); applied.push({ label: `${g.label} $${fmt(g.value)}`, amount: amt }); }
  }

  return { basePrice:base, discountedPrice: Math.max(0, round2(price)), applied };
}

/* ---------- CART ---------- */
function addToCart(productId){
  const p = PRODUCTS.find(x=>x.id===productId);
  if(!p) return;
  const existing = CART.find(i=>i.id === p.id);
  if(existing) existing.qty++;
  else CART.push({ id: p.id, sku: p.sku, name: p.name, qty: 1, price: p.price });
  renderCart();
}

function renderCart(){
  cartList.innerHTML = '';
  let subtotal = 0;
  let discountTotal = 0;

  CART.forEach(item=>{
    const prod = PRODUCTS.find(p => p.id === item.id);
    if(!prod) return;
    const itemCalc = computeItemPrice(prod);
    const itemLinePrice = round2(itemCalc.discountedPrice * item.qty);
    const itemBaseTotal = round2(itemCalc.basePrice * item.qty);
    subtotal += itemBaseTotal;
    discountTotal += round2((itemCalc.basePrice - itemCalc.discountedPrice) * item.qty);

    const row = document.createElement('div'); row.className = 'cart-item';
    row.innerHTML = `
      <div>
        <div style="font-weight:600">${escapeHtml(item.name)}</div>
        <div class="meta">x${item.qty} • $${fmt(itemCalc.discountedPrice)} each</div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:700">$${fmt(itemLinePrice)}</div>
        <div style="display:flex;gap:6px;margin-top:8px">
          <button class="btn small dec" data-id="${item.id}">−</button>
          <button class="btn small inc" data-id="${item.id}">+</button>
          <button class="btn small rm" data-id="${item.id}">Remove</button>
        </div>
      </div>
    `;
    cartList.appendChild(row);
  });

  // bind cart controls
  cartList.querySelectorAll('.inc').forEach(b=> b.addEventListener('click', e=>{
    const id = e.target.dataset.id; const it = CART.find(x=>x.id===id); if(it){ it.qty++; renderCart(); } 
  }));
  cartList.querySelectorAll('.dec').forEach(b=> b.addEventListener('click', e=>{
    const id = e.target.dataset.id; const it = CART.find(x=>x.id===id); if(it){ it.qty = Math.max(1, it.qty - 1); renderCart(); }
  }));
  cartList.querySelectorAll('.rm').forEach(b=> b.addEventListener('click', e=>{
    const id = e.target.dataset.id; CART = CART.filter(x=>x.id!==id); renderCart();
  }));

  // shipping based on customer choice
  const deliverySelected = document.querySelector('input[name="deliveryMode"]:checked')?.value === 'delivery';
  let shipping = 0;
  const subtotalRounded = round2(subtotal);
  if(deliverySelected){
    shipping = subtotalRounded >= SHIPPING.freeOver ? 0 : SHIPPING.flat;
  }

  // tax and manual discount (applies to total after discounts & shipping)
  const manualValue = parseManualDiscount(manualDiscountInput?.value || '');

  const taxBase = subtotalRounded - discountTotal + shipping;
  const tax = round2(Math.max(0, taxBase) * TAX_RATE);

  let totalBeforeManual = round2(subtotalRounded - discountTotal + shipping + tax);

  // apply manual discount
  let manualDiscountAmount = 0;
  if(manualValue){
    if(manualValue.type === 'percentage') manualDiscountAmount = round2(totalBeforeManual * (manualValue.value/100));
    else manualDiscountAmount = round2(manualValue.value);
    // clamp
    manualDiscountAmount = Math.min(manualDiscountAmount, totalBeforeManual);
  }

  const finalTotal = round2(totalBeforeManual - manualDiscountAmount);

  subtotalEl.innerText = `$${fmt(subtotal)}`;
  discountTotalEl.innerText = `$${fmt(discountTotal + manualDiscountAmount)}`;
  shippingEl.innerText = `$${fmt(shipping)}`;
  taxEl.innerText = `$${fmt(tax)}`;
  totalEl.innerText = `$${fmt(finalTotal)}`;

  itemsCount.innerText = `${CART.reduce((s,i)=>s+i.qty,0)} items`;
  employeeBadge.innerText = `Employee: ${SESSION ? SESSION.name + ' ('+SESSION.role+')' : '—'}`;

  // store temporary totals on CART for checkout use
  CART._totals = { subtotal: subtotalRounded, discounts: discountTotal + manualDiscountAmount, shipping, tax, total: finalTotal };
}

/* parse manual discount input */
function parseManualDiscount(s){
  if(!s) return null;
  s = s.trim();
  if(s.endsWith('%')){ const v = parseFloat(s.slice(0,-1)); if(!isNaN(v) && v>0) return { type:'percentage', value: v }; return null; }
  const v = parseFloat(s);
  if(!isNaN(v) && v > 0) return { type:'fixed', value: v };
  return null;
}

/* ---------- CHECKOUT / SALES ---------- */
function openCheckout(){
  renderEmployees(); checkoutModal.classList.remove('hidden');
}
function confirmSale(){
  // validations
  const customer = { name: custName.value.trim(), email: custEmail.value.trim(), phone: custPhone.value.trim(), address: custAddress.value.trim() };
  if(!customer.name){ if(!confirm('Customer name empty. Continue?')) return; }

  const totals = CART._totals || { subtotal:0, discounts:0, shipping:0, tax:0, total:0 };
  const empId = employeeSelect.value;
  const employee = USERS.find(u=>u.id === empId) || { id:null, name:'Unknown', role:'staff' };
  const payment = { type: paymentType.value };
  if(payment.type === 'mixed'){ payment.cash = Number(mixedCash.value) || 0; payment.card = Number(mixedCard.value) || 0; }

  // create sale
  const sale = {
    id: idNow(),
    createdAt: new Date().toISOString(),
    status: 'paid',
    items: CART.map(it => ({ id: it.id, name: it.name, qty: it.qty, price: it.price })),
    subtotal: totals.subtotal,
    discounts: totals.discounts,
    shipping: totals.shipping,
    tax: totals.tax,
    total: totals.total,
    customer,
    employee: { id: employee.id, name: employee.name, role: employee.role },
    payment,
    void: null,
    refund: null
  };

  // decrement inventory
  sale.items.forEach(it => {
    const p = PRODUCTS.find(x=>x.id === it.id);
    if(p) p.stock = Math.max(0, p.stock - it.qty);
  });

  SALES.unshift(sale);
  save(KEY_SALES, SALES);
  save(KEY_PRODUCTS, PRODUCTS);

  // optionally sync to remote (not implemented)...
  // print receipt
  generateReceiptPDF(sale);

  // clear cart & UI
  CART = [];
  renderCart();
  checkoutModal.classList.add('hidden');
  renderProducts(getActiveCat());
  alert('Sale recorded (local).');
}

/* ---------- SALES HISTORY / VOID / REFUND ---------- */
function renderSales(){
  salesList.innerHTML = '';
  if(SALES.length === 0){ salesList.innerHTML = '<div class="muted">No sales yet</div>'; return; }
  SALES.forEach(s => {
    const row = document.createElement('div'); row.className = 'inventory-row';
    row.innerHTML = `
      <div>
        <div style="font-weight:700">${s.id} • $${fmt(s.total)}</div>
        <div class="muted">${new Date(s.createdAt).toLocaleString()} • ${s.employee?.name || '-'}</div>
        <div class="muted">Customer: ${escapeHtml(s.customer?.name || '-')}${ s.customer?.address ? ' • ' + escapeHtml(s.customer.address) : '' }</div>
      </div>
      <div style="display:flex;gap:8px">
        ${ s.status === 'paid' ? `<button class="btn" data-void="${s.id}">Void</button>` : '' }
        ${ s.status === 'paid' ? `<button class="btn" data-ref="${s.id}">Refund</button>` : '' }
        <button class="btn" data-print="${s.id}">Print</button>
      </div>
    `;
    salesList.appendChild(row);
  });

  salesList.querySelectorAll('[data-void]').forEach(b=> b.addEventListener('click', e=>{
    const id = e.target.dataset.void;
    doVoidSale(id);
  }));
  salesList.querySelectorAll('[data-ref]').forEach(b=> b.addEventListener('click', e=>{
    const id = e.target.dataset.ref;
    doRefundSale(id);
  }));
  salesList.querySelectorAll('[data-print]').forEach(b=> b.addEventListener('click', e=>{
    const id = e.target.dataset.print; const s = SALES.find(x=>x.id === id); if(s) generateReceiptPDF(s);
  }));
}

function doVoidSale(id){
  if(!SESSION || SESSION.role !== 'admin'){ alert('Admin required to void'); return; }
  if(!confirm('Void this sale? It will be marked as voided (no restock).')) return;
  const sale = SALES.find(s=>s.id === id);
  if(!sale) return;
  sale.status = 'voided';
  sale.void = { by: SESSION.name, at: new Date().toISOString(), reason: 'Voided by admin' };
  save(KEY_SALES, SALES);
  renderSales();
  alert('Sale voided');
}

function doRefundSale(id){
  if(!SESSION || (SESSION.role !== 'admin' && SESSION.role !== 'staff')){ alert('Sign in as staff or admin to refund'); return; }
  const sale = SALES.find(s=>s.id === id);
  if(!sale) return;
  const amtStr = prompt('Refund amount (full by default):', sale.total);
  if(amtStr === null) return;
  const amount = parseFloat(amtStr);
  if(isNaN(amount) || amount <= 0){ alert('Invalid amount'); return; }
  const reason = prompt('Reason (optional):', 'Customer return');
  if(confirm('Restock items for this refund?')){
    sale.items.forEach(it => {
      const p = PRODUCTS.find(x=>x.id === it.id); if(p) p.stock += it.qty;
    });
    save(KEY_PRODUCTS, PRODUCTS);
  }
  sale.refund = { by: SESSION.name, at: new Date().toISOString(), amount, reason };
  sale.status = 'refunded';
  save(KEY_SALES, SALES);
  renderSales();
  renderProducts(getActiveCat());
  alert('Refund recorded');
}

/* ---------- PDF Receipt ---------- */
function generateReceiptPDF(sale){
  try{
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:'pt', format:'letter' });
    let y = 40;
    doc.setFontSize(18); doc.text("Caleb's Merch Store", 40, y); y += 22;
    doc.setFontSize(11); doc.text(`Sale: ${sale.id}`, 40, y); y += 14;
    doc.text(`Date: ${new Date(sale.createdAt).toLocaleString()}`, 40, y); y += 14;
    doc.text(`Employee: ${sale.employee?.name || ''}`, 40, y); y += 14;
    if(sale.customer?.name) { doc.text(`Customer: ${sale.customer.name}`, 40, y); y += 14; }
    if(sale.customer?.address) { doc.text(`Address: ${sale.customer.address}`, 40, y); y += 14; }
    y += 6; doc.line(36, y, 560, y); y += 14;
    sale.items.forEach(it=>{
      doc.text(`${it.qty} x ${it.name}`, 40, y);
      doc.text(`$${fmt(it.price * it.qty)}`, 480, y);
      y += 14;
    });
    y += 6; doc.line(36, y, 560, y); y += 14;
    doc.text(`Subtotal: $${fmt(sale.subtotal)}`, 40, y); y += 14;
    doc.text(`Discounts: -$${fmt(sale.discounts)}`, 40, y); y += 14;
    doc.text(`Shipping: $${fmt(sale.shipping)}`, 40, y); y += 14;
    doc.text(`Tax: $${fmt(sale.tax)}`, 40, y); y += 14;
    doc.setFontSize(13); doc.text(`Total: $${fmt(sale.total)}`, 40, y); y += 20;
    doc.setFontSize(10); doc.text('Thank you for shopping with Caleb\'s Merch Store!', 40, y);
    doc.save(`receipt_${sale.id}.pdf`);
  }catch(e){ console.error(e); alert('Receipt generation failed'); }
}

/* ---------- INVENTORY UI ---------- */
function openInventory(){ inventoryModal.classList.remove('hidden'); renderInventoryList(); }
function renderInventoryList(){
  inventoryList.innerHTML = '';
  PRODUCTS.forEach(p => {
    const row = document.createElement('div'); row.className = 'inventory-row';
    row.innerHTML = `
      <div>
        <div style="font-weight:700">${escapeHtml(p.name)}</div>
        <div class="muted">${p.sku || ''} • ${p.category}</div>
        <div class="muted">Price $${fmt(p.price)} • Stock ${p.stock}</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn" data-edit="${p.id}">Edit</button>
        <button class="btn" data-del="${p.id}">Delete</button>
      </div>
    `;
    inventoryList.appendChild(row);
  });

  inventoryList.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', e=>{
    const id = e.target.dataset.edit; const p = PRODUCTS.find(x=>x.id===id); openProductEditor(p);
  }));
  inventoryList.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', e=>{
    const id = e.target.dataset.del; if(!confirm('Delete product?')) return; PRODUCTS = PRODUCTS.filter(x=>x.id!==id); save(KEY_PRODUCTS, PRODUCTS); renderInventoryList(); renderProducts(getActiveCat());
  }));
}

function openProductEditor(p){
  productEditor.classList.remove('hidden');
  if(!p){ document.getElementById('productEditorTitle').innerText = 'Create Product'; pe_id.value=''; pe_sku.value=''; pe_name.value=''; pe_price.value=''; pe_stock.value=''; pe_category.value=''; pe_img.value=''; pe_desc.value=''; }
  else { document.getElementById('productEditorTitle').innerText = 'Edit Product'; pe_id.value=p.id; pe_sku.value=p.sku||''; pe_name.value=p.name; pe_price.value=p.price; pe_stock.value=p.stock; pe_category.value=p.category; pe_img.value=p.img||''; pe_desc.value=p.desc||''; }
}

function saveProductFromEditor(){
  if(!SESSION || SESSION.role !== 'admin'){ alert('Admin required'); return; }
  const id = pe_id.value || idNow();
  const sku = (pe_sku.value || '').trim();
  const name = (pe_name.value || '').trim(); if(!name){ alert('Name required'); return; }
  const price = Number(pe_price.value); if(isNaN(price)){ alert('Invalid price'); return; }
  const stock = parseInt(pe_stock.value||'0',10);
  const category = (pe_category.value || 'Accessories').trim();
  const img = pe_img.value || '';
  const desc = pe_desc.value || '';
  const obj = { id, sku, name, category, price, stock, img, desc };
  const idx = PRODUCTS.findIndex(x=>x.id===id);
  if(idx >= 0) PRODUCTS[idx] = obj; else PRODUCTS.unshift(obj);
  save(KEY_PRODUCTS, PRODUCTS);
  productEditor.classList.add('hidden');
  renderInventoryList();
  renderProducts(getActiveCat());
}

/* ---------- AUTH ---------- */
function openAuth(){ authModal.classList.remove('hidden'); }
function doAuth(){
  const email = authEmail.value.trim(); const pass = authPass.value;
  const u = USERS.find(x=>x.email === email && x.password === pass);
  if(!u){ alert('Invalid demo credentials'); return; }
  SESSION = { id: u.id, name: u.name, role: u.role, email: u.email };
  save(KEY_SESSION, SESSION);
  authModal.classList.add('hidden');
  renderAuth();
  alert(`Signed in as ${u.role}`);
}
function signOut(){ SESSION = null; save(KEY_SESSION, null); renderAuth(); alert('Signed out'); }
function renderAuth(){ userInfo.innerText = SESSION ? `${SESSION.name} (${SESSION.role})` : 'Not signed in'; authBtn.innerText = SESSION ? 'Sign Out' : 'Sign In'; renderEmployees(); }

/* ---------- EMPLOYEES ---------- */
function renderEmployees(){
  if(!employeeSelect) return;
  employeeSelect.innerHTML = '';
  USERS.forEach(u => { const o = document.createElement('option'); o.value = u.id; o.textContent = `${u.name} (${u.role})`; employeeSelect.appendChild(o); });
}

/* ---------- SALES LIST rendering ---------- */
function renderSales(){ renderSalesList(); }
function renderSalesList(){
  salesList.innerHTML = '';
  if(SALES.length === 0){ salesList.innerHTML = '<div class="muted">No sales yet</div>'; return; }
  SALES.forEach(s => {
    const row = document.createElement('div'); row.className = 'inventory-row';
    row.innerHTML = `<div>
      <div style="font-weight:700">${s.id} • $${fmt(s.total)}</div>
      <div class="muted">${new Date(s.createdAt).toLocaleString()} • ${s.employee?.name || '-'}</div>
      <div class="muted">Customer: ${escapeHtml(s.customer?.name || '-')}${ s.customer?.address ? ' • ' + escapeHtml(s.customer.address) : '' }</div>
    </div>
    <div style="display:flex;gap:8px">
      ${ s.status === 'paid' ? `<button class="btn" data-void="${s.id}">Void</button>` : '' }
      ${ s.status === 'paid' ? `<button class="btn" data-ref="${s.id}">Refund</button>` : '' }
      <button class="btn" data-print="${s.id}">Print</button>
    </div>`;
    salesList.appendChild(row);
  });

  salesList.querySelectorAll('[data-void]').forEach(b=> b.addEventListener('click', e=> doVoidSale(e.target.dataset.void)));
  salesList.querySelectorAll('[data-ref]').forEach(b=> b.addEventListener('click', e=> doRefundSale(e.target.dataset.ref)));
  salesList.querySelectorAll('[data-print]').forEach(b=> b.addEventListener('click', e=> { const s = SALES.find(x=>x.id === e.target.dataset.print); if(s) generateReceiptPDF(s); }));
}

/* ---------- UTILS ---------- */
function getActiveCat(){ return document.querySelector('.pill.active')?.dataset.cat || 'All Products' }
function escapeHtml(s){ if(!s) return ''; return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function downloadCSV(arr, filename='export.csv'){ if(!arr || !arr.length){ alert('No data'); return; } const keys = Object.keys(arr[0]); const csv = [keys.join(',')].concat(arr.map(o=> keys.map(k=> JSON.stringify(o[k]===undefined?'':o[k])).join(','))).join('\n'); const blob = new Blob([csv], {type:'text/csv'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }

/* ---------- INITIAL PERSIST ---------- */
save(KEY_PRODUCTS, PRODUCTS);
save(KEY_USERS, USERS);
save(KEY_SALES, SALES);

/* ---------- Small glue / start-up ---------- */
function getActiveCatElementText(){ return getActiveCat(); }

/* Expose quick API for debugging */
window.__CALPOS = { PRODUCTS, USERS, SALES, CART, POS_SETTINGS };

/* ---------- Final: ensure modals close on backdrop & ESC ---------- */
document.addEventListener('keydown', e=> { if(e.key === 'Escape') document.querySelectorAll('.modal').forEach(m=> m.classList.add('hidden')); });
document.querySelectorAll('.modal').forEach(m=> m.addEventListener('click', e=> { if(e.target === m) m.classList.add('hidden'); }));

/* ---------- END ---------- */
