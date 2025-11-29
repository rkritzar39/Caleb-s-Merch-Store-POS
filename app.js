/**
 * app.js — Apple-style POS (Local-only with sale scheduler)
 *
 * - Loads POS_SETTINGS from localStorage (flashSales)
 * - Inventory, auth (demo), sales (create/void/refund)
 * - Discount engine: global/category/product/flash (time-window)
 * - Cart UI updates with discount badges/prices
 * - Shipping, tax, manual discount at checkout
 * - Receipt PDF via jsPDF
 */

/* CONFIG */
const TAX_RATE = 0.07;
const SHIPPING = { flat: 6.50, freeOver: 100.00 };

/* STORAGE KEYS */
const KEY_PRODUCTS = 'caleb_products_v3';
const KEY_USERS = 'caleb_users_v3';
const KEY_SALES = 'caleb_sales_v3';
const KEY_SESSION = 'caleb_session_v3';
const KEY_POS_SETTINGS = 'POS_SETTINGS';

/* LOAD OR INIT POS_SETTINGS (includes flashSales) */
let POS_SETTINGS = load(KEY_POS_SETTINGS) || {
  globalSale: { active: false, label: 'Black Friday', type: 'percentage', value: 30 },
  categorySales: {},
  productSales: {},
  flashSales: []
};

/* helper id */
function idNow(){ return 'id_' + Math.random().toString(36).slice(2,9) + '_' + Date.now().toString(36); }

/* SAMPLE PRODUCTS */
const SAMPLE_PRODUCTS = [
  { id: idNow(), sku:'OUT-001', name:'Outdoor Backpack', category:'Outdoor', price:49.99, stock:12, img:'', desc:'' },
  { id: idNow(), sku:'HAT-001', name:'Caleb Hat', category:'Hats', price:19.99, stock:30, img:'', desc:'' },
  { id: idNow(), sku:'HD-001', name:'Logo Hoodie', category:'Hoodies & Sweatshirts', price:39.99, stock:18, img:'', desc:'' },
  { id: idNow(), sku:'TEE-001', name:'Graphic Tee', category:'T-Shirts', price:24.99, stock:40, img:'', desc:'' },
  { id: idNow(), sku:'BABY-001', name:'Baby Onesie', category:'Baby & Toddler', price:14.99, stock:20, img:'', desc:'' },
  { id: idNow(), sku:'MUG-001', name:'Caleb Mug', category:'Kitchenwear', price:12.99, stock:25, img:'', desc:'' },
  { id: idNow(), sku:'STK-001', name:'Sticker Pack', category:'Accessories', price:4.99, stock:250, img:'', desc:'' }
];

/* APP STATE */
let PRODUCTS = load(KEY_PRODUCTS) || SAMPLE_PRODUCTS.slice();
let USERS = load(KEY_USERS) || seedUsers();
let SALES = load(KEY_SALES) || [];
let SESSION = load(KEY_SESSION) || null;
let CART = []; // {id,sku,name,qty,price} price is base price

/* DOM REFS */
const productGrid = document.getElementById('productGrid');
const pills = document.querySelectorAll('.pill');
const searchInput = document.getElementById('searchInput');

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

/* INIT */
renderProducts('All Products');
bindUI();
renderCart();
renderAuth();
renderEmployees();

/* STORAGE HELPERS */
function load(key){ try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : null } catch(e){ return null } }
function save(key,val){ localStorage.setItem(key, JSON.stringify(val)); }

/* UTILS */
function round2(n){ return Math.round((n + Number.EPSILON) * 100) / 100; }
function fmt(n){ return round2(n).toFixed(2); }
function escapeHtml(s){ if(!s) return ''; return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) }

/* DEMO USERS */
function seedUsers(){
  const u = [
    { id: idNow(), email:'admin@example.com', name:'Admin', role:'admin', password:'admin123' },
    { id: idNow(), email:'staff@example.com', name:'Staff', role:'staff', password:'staff123' }
  ];
  save(KEY_USERS, u);
  return u;
}

/* BIND UI */
function bindUI(){
  // category pills
  pills.forEach(p=>{
    p.addEventListener('click', ()=> {
      document.querySelector('.pill.active')?.classList.remove('active');
      p.classList.add('active');
      renderProducts(p.dataset.cat);
    });
  });

  // search
  searchInput.addEventListener('input', ()=> renderProducts(getActiveCat()));

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

  // keyboard
  window.addEventListener('keydown', (e)=> {
    if(e.key === 'F1') searchInput.focus();
    if(e.key === 'F2') inventoryBtn.click();
    if(e.key === 'Escape') document.querySelectorAll('.modal').forEach(m=> m.classList.add('hidden'));
  });
  document.querySelectorAll('.modal').forEach(mod => mod.addEventListener('click', e=> { if(e.target === mod) mod.classList.add('hidden'); }));
  modeBtn.addEventListener('click', ()=> alert('Local mode — hybrid Firebase integration can be added later.'));
}

/* ---------- PRODUCTS ---------- */
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

/* ---------- SALE ENGINE ---------- */
function getActiveSales(){
  const now = new Date();
  POS_SETTINGS = load(KEY_POS_SETTINGS) || POS_SETTINGS; // refresh in case admin changed
  if(!POS_SETTINGS.flashSales) POS_SETTINGS.flashSales = [];
  return POS_SETTINGS.flashSales.filter(s=>{
    if(!s.active && !s.enabled) return false;
    const start = s.start ? new Date(s.start) : null;
    const end = s.end ? new Date(s.end) : null;
    if(start && start > now) return false;
    if(end && end < now) return false;
    return true;
  });
}

function activeSaleBadgeForProduct(product){
  const now = new Date();
  const active = getActiveSales();
  // flash sales first
  for(const f of active){
    if(f.category && f.category !== '' && f.category !== product.category) continue;
    // match by sku or id optionally
    if(f.productId && f.productId !== product.id && f.productId !== product.sku) continue;
    if(f.type === 'percent') return `${f.name} • -${f.value}%`;
    if(f.type === 'amount') return `${f.name} • -$${fmt(f.value)}`;
    if(f.type === 'free_shipping') return `${f.name} • Free shipping`;
  }
  // product or category or global (handled during compute)
  if(POS_SETTINGS.productSales && (POS_SETTINGS.productSales[product.sku] || POS_SETTINGS.productSales[product.id])){
    const ps = POS_SETTINGS.productSales[product.sku] || POS_SETTINGS.productSales[product.id];
    if(ps.active) return ps.type === 'percentage' ? `-${ps.value}%` : `$${fmt(ps.value)}`;
  }
  const cat = POS_SETTINGS.categorySales && POS_SETTINGS.categorySales[product.category];
  if(cat && cat.active) return cat.type === 'percentage' ? `-${cat.value}%` : `$${fmt(cat.value)}`;
  if(POS_SETTINGS.globalSale && POS_SETTINGS.globalSale.active) return POS_SETTINGS.globalSale.type === 'percentage' ? `-${POS_SETTINGS.globalSale.value}%` : `$${fmt(POS_SETTINGS.globalSale.value)}`;
  return null;
}

/* compute item discounted price and applied discount lines */
function computeItemPrice(product){
  const base = Number(product.price);
  let price = base;
  const applied = [];
  const now = new Date();

  // flash sales (time-window) have priority
  const active = getActiveSales();
  for(const f of active){
    if(f.productId && f.productId !== product.id && f.productId !== product.sku) continue;
    if(f.category && f.category !== '' && f.category !== product.category) continue;
    if(f.type === 'percent'){ const amt = round2(base * (f.value/100)); price = round2(price - amt); applied.push({label:f.name || 'Flash', amount:amt}); }
    else if(f.type === 'amount'){ const amt = round2(f.value); price = round2(Math.max(0, price - amt)); applied.push({label:f.name || 'Flash', amount:amt}); }
    else if(f.type === 'free_shipping'){ applied.push({label:f.name || 'Free Shipping', amount:0, freeShipping:true}); }
    // continue to allow stacking? for simplicity stop after flash sale matched to avoid double stacking with category/global:
    return { basePrice: base, discountedPrice: price, applied };
  }

  // product-specific sale
  const prodKey = POS_SETTINGS.productSales && (POS_SETTINGS.productSales[product.sku] || POS_SETTINGS.productSales[product.id]);
  if(prodKey && prodKey.active){
    if(prodKey.type === 'percentage'){ const amt = round2(base * (prodKey.value/100)); price = round2(price - amt); applied.push({label:`Product ${prodKey.value}%`, amount:amt}); }
    else { const amt = round2(prodKey.value); price = round2(Math.max(0, price - amt)); applied.push({label:`Product $${fmt(prodKey.value)}`, amount:amt}); }
  }

  // category sale
  const catKey = POS_SETTINGS.categorySales && POS_SETTINGS.categorySales[product.category];
  if(catKey && catKey.active){
    if(catKey.type === 'percentage'){ const amt = round2(base * (catKey.value/100)); price = round2(price - amt); applied.push({label:`Category ${catKey.value}%`, amount:amt}); }
    else { const amt = round2(catKey.value); price = round2(Math.max(0, price - amt)); applied.push({label:`Category $${fmt(catKey.value)}`, amount:amt}); }
  }

  // global sale
  const g = POS_SETTINGS.globalSale;
  if(g && g.active){
    if(g.type === 'percentage'){ const amt = round2(base * (g.value/100)); price = round2(price - amt); applied.push({label:`${g.label} ${g.value}%`, amount:amt}); }
    else { const amt = round2(g.value); price = round2(Math.max(0, price - amt)); applied.push({label:`${g.label} $${fmt(g.value)}`, amount:amt}); }
  }

  return { basePrice: base, discountedPrice: Math.max(0, round2(price)), applied };
}

/* ---------- CART ---------- */
function addToCart(productId){
  const p = PRODUCTS.find(x=>x.id === productId);
  if(!p) return;
  const existing = CART.find(i=>i.id === p.id);
  if(existing) existing.qty++;
  else CART.push({ id: p.id, sku: p.sku, name: p.name, price: p.price, qty: 1 });
  renderCart();
}

function renderCart(){
  cartList.innerHTML = '';
  let subtotal = 0;
  let discountTotal = 0;
  let freeShippingFlag = false;

  CART.forEach(item=>{
    const prod = PRODUCTS.find(p=>p.id === item.id);
    if(!prod) return;
    const calc = computeItemPrice(prod);
    const linePrice = round2(calc.discountedPrice * item.qty);
    const lineBase = round2(calc.basePrice * item.qty);
    subtotal += lineBase;
    discountTotal += round2((calc.basePrice - calc.discountedPrice) * item.qty);
    if(calc.applied.some(a=>a.freeShipping)) freeShippingFlag = true;

    const row = document.createElement('div'); row.className = 'cart-item';
    row.innerHTML = `
      <div>
        <div style="font-weight:600">${escapeHtml(item.name)}</div>
        <div class="meta">x${item.qty} • $${fmt(calc.discountedPrice)} each</div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:700">$${fmt(linePrice)}</div>
        <div style="display:flex;gap:6px;margin-top:8px">
          <button class="btn small dec" data-id="${item.id}">−</button>
          <button class="btn small inc" data-id="${item.id}">+</button>
          <button class="btn small rm" data-id="${item.id}">Remove</button>
        </div>
      </div>
    `;
    cartList.appendChild(row);
  });

  // bind controls
  cartList.querySelectorAll('.inc').forEach(b=> b.addEventListener('click', e=> { const id = e.target.dataset.id; const it = CART.find(x=>x.id===id); if(it){ it.qty++; renderCart(); } }));
  cartList.querySelectorAll('.dec').forEach(b=> b.addEventListener('click', e=> { const id = e.target.dataset.id; const it = CART.find(x=>x.id===id); if(it){ it.qty = Math.max(1, it.qty-1); renderCart(); } }));
  cartList.querySelectorAll('.rm').forEach(b=> b.addEventListener('click', e=> { const id = e.target.dataset.id; CART = CART.filter(x=>x.id!==id); renderCart(); }));

  // shipping
  const deliverySelected = document.querySelector('input[name="deliveryMode"]:checked')?.value === 'delivery';
  let shipping = 0;
  const subtotalRounded = round2(subtotal);
  if(deliverySelected && !freeShippingFlag){
    shipping = subtotalRounded >= SHIPPING.freeOver ? 0 : SHIPPING.flat;
  }

  // tax
  const manualVal = parseManualDiscount(manualDiscountInput?.value || '');
  const taxBase = subtotalRounded - discountTotal + shipping;
  const tax = round2(Math.max(0, taxBase) * TAX_RATE);

  let totalBeforeManual = round2(subtotalRounded - discountTotal + shipping + tax);

  // manual discount (apply after other discounts)
  let manualAmt = 0;
  if(manualVal){
    if(manualVal.type === 'percentage') manualAmt = round2(totalBeforeManual * (manualVal.value/100));
    else manualAmt = round2(manualVal.value);
    manualAmt = Math.min(manualAmt, totalBeforeManual);
  }

  const finalTotal = round2(totalBeforeManual - manualAmt);

  subtotalEl.innerText = `$${fmt(subtotal)}`;
  discountTotalEl.innerText = `$${fmt(discountTotal + manualAmt)}`;
  shippingEl.innerText = `$${fmt(shipping)}`;
  taxEl.innerText = `$${fmt(tax)}`;
  totalEl.innerText = `$${fmt(finalTotal)}`;

  itemsCount.innerText = `${CART.reduce((s,i)=>s+i.qty,0)} items`;
  employeeBadge.innerText = `Employee: ${SESSION ? SESSION.name + ' ('+SESSION.role+')' : '—'}`;

  CART._totals = { subtotal: subtotalRounded, discounts: discountTotal + manualAmt, shipping, tax, total: finalTotal };
}

/* parse manual discount string */
function parseManualDiscount(s){
  if(!s) return null;
  s = s.trim();
  if(s.endsWith('%')){ const v = parseFloat(s.slice(0,-1)); if(!isNaN(v) && v>0) return { type:'percentage', value: v }; return null; }
  const v = parseFloat(s);
  if(!isNaN(v) && v>0) return { type:'fixed', value: v };
  return null;
}

/* ---------- CHECKOUT / SALES ---------- */
function openCheckout(){ renderEmployees(); checkoutModal.classList.remove('hidden'); }
function confirmSale(){
  const customer = { name: custName.value.trim(), email: custEmail.value.trim(), phone: custPhone.value.trim(), address: custAddress.value.trim() };
  if(!customer.name && !confirm('Customer name empty — continue?')) return;
  const totals = CART._totals || { subtotal:0, discounts:0, shipping:0, tax:0, total:0 };
  const empId = employeeSelect.value;
  const employee = USERS.find(u=>u.id===empId) || { id:null, name:'Unknown', role:'staff' };
  const payment = { type: paymentType.value };
  if(payment.type === 'mixed'){ payment.cash = Number(mixedCash.value) || 0; payment.card = Number(mixedCard.value) || 0; }

  const sale = {
    id: idNow(),
    createdAt: new Date().toISOString(),
    status: 'paid',
    items: CART.map(it=>({ id: it.id, name: it.name, qty: it.qty, price: it.price })),
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
  sale.items.forEach(it=>{
    const p = PRODUCTS.find(x=>x.id === it.id);
    if(p) p.stock = Math.max(0, p.stock - it.qty);
  });

  SALES.unshift(sale);
  save(KEY_SALES, SALES);
  save(KEY_PRODUCTS, PRODUCTS);

  generateReceiptPDF(sale);

  CART = [];
  renderCart();
  checkoutModal.classList.add('hidden');
  renderProducts(getActiveCat());
  alert('Sale recorded locally.');
}

/* ---------- SALES HISTORY / VOID / REFUND ---------- */
function renderSales(){
  salesList.innerHTML = '';
  if(SALES.length === 0){ salesList.innerHTML = '<div class="muted">No sales yet</div>'; return; }
  SALES.forEach(s=>{
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

function doVoidSale(id){
  if(!SESSION || SESSION.role !== 'admin'){ alert('Admin required to void'); return; }
  if(!confirm('Void this sale? It will be marked voided (no restock).')) return;
  const sale = SALES.find(s=>s.id===id);
  if(!sale) return;
  sale.status = 'voided';
  sale.void = { by: SESSION.name, at: new Date().toISOString(), reason: 'Voided by admin' };
  save(KEY_SALES, SALES);
  renderSales();
  alert('Sale voided');
}

function doRefundSale(id){
  if(!SESSION || (SESSION.role !== 'admin' && SESSION.role !== 'staff')){ alert('Sign in as staff or admin to refund'); return; }
  const sale = SALES.find(s=>s.id===id);
  if(!sale) return;
  const amtStr = prompt('Refund amount (full by default):', sale.total);
  if(amtStr === null) return;
  const amount = parseFloat(amtStr);
  if(isNaN(amount) || amount <= 0){ alert('Invalid amount'); return; }
  const reason = prompt('Reason (optional):', 'Customer return');
  if(confirm('Restock items for this refund?')){
    sale.items.forEach(it=>{
      const p = PRODUCTS.find(x=>x.id===it.id);
      if(p) p.stock += it.qty;
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

/* ---------- PDF RECEIPT ---------- */
function generateReceiptPDF(sale){
  try{
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({unit:'pt', format:'letter'});
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
  PRODUCTS.forEach(p=>{
    const row = document.createElement('div'); row.className='inventory-row';
    row.innerHTML = `<div>
      <div style="font-weight:700">${escapeHtml(p.name)}</div>
      <div class="muted">${p.sku || ''} • ${p.category}</div>
      <div class="muted">Price $${fmt(p.price)} • Stock ${p.stock}</div>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn" data-edit="${p.id}">Edit</button>
      <button class="btn" data-del="${p.id}">Delete</button>
    </div>`;
    inventoryList.appendChild(row);
  });

  inventoryList.querySelectorAll('[data-edit]').forEach(b=> b.addEventListener('click', e=> {
    const id = e.target.dataset.edit; const p = PRODUCTS.find(x=>x.id===id); openProductEditor(p);
  }));
  inventoryList.querySelectorAll('[data-del]').forEach(b=> b.addEventListener('click', e=> {
    const id = e.target.dataset.del; if(!confirm('Delete product?')) return; PRODUCTS = PRODUCTS.filter(x=>x.id!==id); save(KEY_PRODUCTS, PRODUCTS); renderInventoryList(); renderProducts(getActiveCat());
  }));
}

function openProductEditor(p){
  productEditor.classList.remove('hidden');
  if(!p){ document.getElementById('productEditorTitle').innerText='Create Product'; pe_id.value=''; pe_sku.value=''; pe_name.value=''; pe_price.value=''; pe_stock.value=''; pe_category.value=''; pe_img.value=''; pe_desc.value=''; }
  else { document.getElementById('productEditorTitle').innerText='Edit Product'; pe_id.value=p.id; pe_sku.value=p.sku||''; pe_name.value=p.name; pe_price.value=p.price; pe_stock.value=p.stock; pe_category.value=p.category; pe_img.value=p.img||''; pe_desc.value=p.desc||''; }
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
  USERS.forEach(u=> { const o = document.createElement('option'); o.value = u.id; o.textContent = `${u.name} (${u.role})`; employeeSelect.appendChild(o); });
}

/* ---------- HELPERS ---------- */
function getActiveCat(){ return document.querySelector('.pill.active')?.dataset.cat || 'All Products' }

/* initial render helpers */
function renderEmployees(){ if(employeeSelect) { employeeSelect.innerHTML=''; USERS.forEach(u=>{ const o=document.createElement('option'); o.value=u.id; o.textContent=`${u.name} (${u.role})`; employeeSelect.appendChild(o); }); } }
function renderProducts(cat){ renderProducts(cat); } // already defined earlier; safe no-op to avoid linter issues

/* CSV export helper */
function downloadCSV(arr, filename='export.csv'){ if(!arr || !arr.length){ alert('No data'); return; } const keys = Object.keys(arr[0]); const csv = [keys.join(',')].concat(arr.map(o=> keys.map(k=> JSON.stringify(o[k]===undefined?'':o[k])).join(','))).join('\n'); const blob = new Blob([csv], {type:'text/csv'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }

/* parse manual discount (reused) */
function parseManualDiscount(s){ if(!s) return null; s = s.trim(); if(s.endsWith('%')){ const v = parseFloat(s.slice(0,-1)); if(!isNaN(v) && v>0) return { type:'percentage', value: v }; return null; } const v = parseFloat(s); if(!isNaN(v) && v>0) return { type:'fixed', value: v }; return null; }

/* initial save */
save(KEY_PRODUCTS, PRODUCTS);
save(KEY_USERS, USERS);
save(KEY_SALES, SALES);
save(KEY_POS_SETTINGS, POS_SETTINGS);

/* expose debug */
window.__CALPOS = { PRODUCTS, USERS, SALES, CART, POS_SETTINGS };
