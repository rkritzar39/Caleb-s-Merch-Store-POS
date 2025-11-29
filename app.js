/* Caleb's Merch Store — app.js
   Hybrid POS:
   - localStorage data model (products, users, sales)
   - admin/staff demo auth
   - inventory CRUD (admin)
   - create sale, void, refund
   - shipping rules (flat + free-over)
   - collect customer info
   - generate PDF receipt via jsPDF
   - optional Firebase hooks (commented)
*/

/* ======= Configuration ======= */
const TAX_RATE = 0.07; // 7%
const SHIPPING_RULES = { flatRate: 6.50, freeOver: 100.00 }; // dollars

/* ======= Storage keys ======= */
const KEY_PRODUCTS = 'calebs_products_v1';
const KEY_USERS = 'calebs_users_v1';
const KEY_SALES = 'calebs_sales_v1';
const KEY_SESSION = 'calebs_session_v1';

/* ======= Demo seed data (if inventory empty) ======= */
const SAMPLE_PRODUCTS = [
  { id: idNow(), sku: 'OUT-001', name: 'Outdoor Backpack', price: 49.99, category: 'Outdoor', stock: 12, img: '', desc: '' },
  { id: idNow(), sku: 'HAT-001', name: 'Caleb Hat', price: 19.99, category: 'Hats', stock: 30, img: '', desc: '' },
  { id: idNow(), sku: 'HD-001', name: 'Logo Hoodie', price: 39.99, category: 'Hoodies & Sweatshirts', stock: 18, img: '', desc: '' },
  { id: idNow(), sku: 'TEE-001', name: 'Graphic Tee', price: 24.99, category: 'T-Shirts', stock: 40, img: '', desc: '' },
  { id: idNow(), sku: 'BABY-001', name: 'Baby Onesie', price: 14.99, category: 'Baby & Toddler', stock: 20, img: '', desc: '' },
  { id: idNow(), sku: 'MUG-001', name: 'Caleb Mug', price: 12.99, category: 'Kitchenwear', stock: 25, img: '', desc: '' },
  { id: idNow(), sku: 'STK-001', name: 'Sticker Pack', price: 4.99, category: 'Accessories', stock: 250, img: '', desc: '' }
];

/* ======= DOM refs ======= */
const productGrid = document.getElementById('productGrid');
const categoryList = document.getElementById('categoryList');
const searchInput = document.getElementById('searchInput');
const lowStockFilter = document.getElementById('lowStockFilter');

const cartItemsEl = document.getElementById('cartItems');
const subtotalEl = document.getElementById('cartSubtotal');
const shippingEl = document.getElementById('cartShipping');
const taxEl = document.getElementById('cartTax');
const totalEl = document.getElementById('cartTotal');

const checkoutModal = document.getElementById('checkoutModal');
const checkoutBtn = document.getElementById('checkoutBtn');

const inventoryBtn = document.getElementById('inventoryBtn');
const inventoryModal = document.getElementById('inventoryModal');
const inventoryList = document.getElementById('inventoryList');
const newProductBtn = document.getElementById('newProductBtn');
const importSeedBtn = document.getElementById('importSeedBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const exportProductsCsvBtn = document.getElementById('exportProductsCsvBtn');

const authBtn = document.getElementById('authBtn');
const authModal = document.getElementById('authModal');

const salesBtn = document.getElementById('salesBtn');
const salesModal = document.getElementById('salesModal');
const salesList = document.getElementById('salesList');

const userBadge = document.getElementById('userBadge');
const syncToggle = document.getElementById('syncToggle');

const productEditorModal = document.getElementById('productEditorModal');

/* form refs inside product editor */
const prodId = document.getElementById('prodId');
const prodSku = document.getElementById('prodSku');
const prodName = document.getElementById('prodName');
const prodPrice = document.getElementById('prodPrice');
const prodStock = document.getElementById('prodStock');
const prodCategory = document.getElementById('prodCategory');
const prodImg = document.getElementById('prodImg');
const prodDesc = document.getElementById('prodDesc');
const saveProductBtn = document.getElementById('saveProductBtn');
const cancelProductBtn = document.getElementById('cancelProductBtn');

/* checkout form refs */
const paymentType = document.getElementById('paymentType');
const mixedInputs = document.getElementById('mixedInputs');
const payCashAmount = document.getElementById('payCashAmount');
const payCardAmount = document.getElementById('payCardAmount');
const employeeSelect = document.getElementById('employeeSelect');
const confirmSaleBtn = document.getElementById('confirmSaleBtn');
const cancelSaleBtn = document.getElementById('cancelSaleBtn');

/* customer fields */
const custName = document.getElementById('custName');
const custEmail = document.getElementById('custEmail');
const custPhone = document.getElementById('custPhone');
const custAddress = document.getElementById('custAddress');

/* sales controls */
const closeSalesBtn = document.getElementById('closeSalesBtn');

/* other controls */
const clearCartBtn = document.getElementById('clearCartBtn');

/* ======= App state ======= */
let PRODUCTS = load(KEY_PRODUCTS) || SAMPLE_PRODUCTS.slice();
let USERS = load(KEY_USERS) || seedUsers();
let SALES = load(KEY_SALES) || [];
let SESSION = load(KEY_SESSION) || null;
let CART = [];

/* Optional: hybrid sync flag (local by default) */
let HYBRID_SYNC = false;

/* ======= Init ======= */
renderAuthBadge();
renderCategoryClicks();
renderProducts('All Products');

bindUI();
renderCart();
renderEmployees();

/* ======= Functions ======= */

function idNow(){ return 'id_' + Math.random().toString(36).slice(2,9) + '_' + Date.now().toString(36) }

function load(key){
  try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : null } catch(e){ console.warn('load fail',e); return null }
}
function save(key,val){ localStorage.setItem(key, JSON.stringify(val)) }

/* seed demo users (admin + staff) */
function seedUsers(){
  const u = [
    { id:idNow(), email:'admin@example.com', name:'Admin', role:'admin', password:'admin123' },
    { id:idNow(), email:'staff@example.com', name:'Staff', role:'staff', password:'staff123' }
  ];
  save(KEY_USERS,u);
  return u;
}

/* ========= UI BINDINGS ========== */
function bindUI(){
  // search
  searchInput?.addEventListener('input', ()=> renderProducts(getActiveCategory()));

  // low stock
  lowStockFilter?.addEventListener('change', ()=> renderProducts(getActiveCategory()));

  // product clicks handled in renderProducts

  // category click handled separately
  document.querySelectorAll('#categoryList li').forEach(li=>{
    li.addEventListener('click', ()=> {
      document.querySelector('#categoryList li.active')?.classList.remove('active');
      li.classList.add('active');
      renderProducts(li.innerText);
    });
  });

  checkoutBtn.addEventListener('click', ()=> {
    if(CART.length===0){ alert('Cart is empty'); return; }
    if(!SESSION){ alert('Please sign in to complete a sale'); openAuthModal(); return; }
    openCheckoutModal();
  });

  clearCartBtn.addEventListener('click', ()=> { CART = []; renderCart(); });

  // checkout modal behavior
  paymentType?.addEventListener('change', ()=> {
    mixedInputs.classList.toggle('hidden', paymentType.value !== 'mixed');
  });
  confirmSaleBtn?.addEventListener('click', confirmSale);
  cancelSaleBtn?.addEventListener('click', ()=> checkoutModal.classList.add('hidden'));

  // inventory
  inventoryBtn?.addEventListener('click', ()=> {
    if(!SESSION || !isAdmin()) { alert('Inventory requires admin'); openAuthModal(); return; }
    openInventoryModal();
  });
  newProductBtn?.addEventListener('click', ()=> openProductEditor());
  importSeedBtn?.addEventListener('click', ()=> { PRODUCTS = PRODUCTS.concat(SAMPLE_PRODUCTS); save(KEY_PRODUCTS,PRODUCTS); renderProducts(getActiveCategory()); alert('Sample products added'); });
  exportCsvBtn?.addEventListener('click', ()=> downloadCsv(PRODUCTS,'inventory_export.csv'));
  exportProductsCsvBtn?.addEventListener('click', ()=> downloadCsv(PRODUCTS,'products.csv'));
  closeInventoryBtn?.addEventListener('click', ()=> inventoryModal.classList.add('hidden'));

  // auth
  authBtn?.addEventListener('click', ()=> { if(SESSION) signOut(); else openAuthModal(); });
  document.getElementById('authSubmitBtn')?.addEventListener('click', doAuth);
  document.getElementById('authCancelBtn')?.addEventListener('click', ()=> authModal.classList.add('hidden'));

  // product editor
  saveProductBtn?.addEventListener('click', saveProduct);
  cancelProductBtn?.addEventListener('click', ()=> productEditorModal.classList.add('hidden'));

  // sales modal
  salesBtn?.addEventListener('click', ()=> { openSalesModal(); });
  closeSalesBtn?.addEventListener('click', ()=> salesModal.classList.add('hidden'));

  // sync toggle
  syncToggle?.addEventListener('click', ()=> {
    HYBRID_SYNC = !HYBRID_SYNC;
    syncToggle.innerText = HYBRID_SYNC ? 'Hybrid Sync ON' : 'Local Mode';
    // If turning on hybrid we would init firebase here (see comment)
    if(HYBRID_SYNC) alert('Hybrid mode: enable Firebase in app.js to sync across devices (not configured by default).');
  });

  // employees select will be updated on renderEmployees

  // initialize keyboard shortcuts (optional)
  window.addEventListener('keydown', (e)=>{
    if(e.key === 'F2') openInventoryModal();
    if(e.key === 'F1') document.getElementById('searchInput').focus();
  });
}

/* ======= AUTH ======= */
function openAuthModal(){ authModal.classList.remove('hidden'); }
function signOut(){ SESSION = null; save(KEY_SESSION,null); renderAuthBadge(); alert('Signed out'); }
function doAuth(){
  const email = document.getElementById('authEmail').value.trim();
  const pass = document.getElementById('authPassword').value;
  const user = USERS.find(u=>u.email === email && u.password === pass);
  if(!user){ alert('Invalid demo credentials'); return; }
  SESSION = { id: user.id, email: user.email, name:user.name, role:user.role };
  save(KEY_SESSION,SESSION);
  authModal.classList.add('hidden');
  renderAuthBadge();
  renderEmployees();
  alert(`Signed in as ${user.role}`);
}
function renderAuthBadge(){
  if(SESSION) userBadge.innerText = `${SESSION.name} (${SESSION.role})`;
  else userBadge.innerText = 'Not signed in';
}
function isAdmin(){ return SESSION && SESSION.role === 'admin' }

/* ======= PRODUCTS UI & INVENTORY CRUD ======= */
function renderProducts(filter = 'All Products'){
  const q = (searchInput?.value || '').trim().toLowerCase();
  const lowOnly = lowStockFilter?.checked === true;

  const list = PRODUCTS.filter(p => {
    if(filter !== 'All Products' && p.category !== filter) return false;
    if(q && !(p.name.toLowerCase().includes(q) || (p.sku||'').toLowerCase().includes(q))) return false;
    if(lowOnly && p.stock > 10) return false;
    return true;
  });

  productGrid.innerHTML = '';
  list.forEach(p => {
    const el = document.createElement('div'); el.className = 'product';
    el.innerHTML = `
      <img src="${p.img || 'https://via.placeholder.com/320x200?text=Product'}" alt="">
      <div class="name">${escapeHtml(p.name)}</div>
      <div class="price">$${formatDollars(p.price)}</div>
      <div class="meta">${p.sku || ''} • stock: ${p.stock}</div>
    `;
    el.addEventListener('click', ()=> addToCart(p.id));
    productGrid.appendChild(el);
  });
}

function openInventoryModal(){
  inventoryModal.classList.remove('hidden');
  renderInventoryList();
}

function renderInventoryList(){
  inventoryList.innerHTML = '';
  PRODUCTS.forEach(p=>{
    const row = document.createElement('div'); row.className='inventory-row';
    row.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center">
        <img src="${p.img || 'https://via.placeholder.com/80'}" style="width:80px;height:60px;object-fit:cover;border-radius:6px" />
        <div>
          <div style="font-weight:700">${escapeHtml(p.name)}</div>
          <div class="muted">${p.sku || ''} • ${p.category}</div>
          <div class="muted">Price: $${formatDollars(p.price)} • Stock: ${p.stock}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="small-btn edit-btn" data-id="${p.id}">Edit</button>
        <button class="small-btn delete-btn" data-id="${p.id}">Delete</button>
      </div>
    `;
    inventoryList.appendChild(row);
  });

  // bind edit/delete
  inventoryList.querySelectorAll('.edit-btn').forEach(b=>{
    b.addEventListener('click', e=>{
      const id = e.target.getAttribute('data-id');
      const p = PRODUCTS.find(x=>x.id===id);
      openProductEditor(p);
    });
  });
  inventoryList.querySelectorAll('.delete-btn').forEach(b=>{
    b.addEventListener('click', e=>{
      const id = e.target.getAttribute('data-id');
      if(!confirm('Delete product?')) return;
      PRODUCTS = PRODUCTS.filter(x=>x.id!==id);
      save(KEY_PRODUCTS,PRODUCTS);
      renderInventoryList(); renderProducts(getActiveCategory());
    });
  });
}

function openProductEditor(product){
  productEditorModal.classList.remove('hidden');
  if(!product){
    prodId.value=''; prodSku.value=''; prodName.value=''; prodPrice.value=''; prodStock.value=''; prodCategory.value=''; prodImg.value=''; prodDesc.value='';
    document.getElementById('prodEditorTitle').innerText = 'New Product';
  } else {
    prodId.value=product.id; prodSku.value=product.sku; prodName.value=product.name; prodPrice.value=product.price; prodStock.value=product.stock; prodCategory.value=product.category; prodImg.value=product.img; prodDesc.value=product.desc;
    document.getElementById('prodEditorTitle').innerText = 'Edit Product';
  }
}

function saveProduct(){
  if(!isAdmin()){ alert('Only admin can save products'); return; }
  const id = prodId.value || idNow();
  const sku = prodSku.value.trim();
  const name = prodName.value.trim(); if(!name){ alert('Name required'); return; }
  const price = Number(prodPrice.value); if(Number.isNaN(price)){ alert('Invalid price'); return; }
  const stock = parseInt(prodStock.value||'0',10);
  const category = prodCategory.value.trim() || 'Accessories';
  const img = prodImg.value.trim();
  const desc = prodDesc.value.trim();

  const existingIndex = PRODUCTS.findIndex(p=>p.id===id);
  const obj = { id, sku, name, price, stock, category, img, desc };
  if(existingIndex >= 0) PRODUCTS[existingIndex] = obj;
  else PRODUCTS.unshift(obj);

  save(KEY_PRODUCTS, PRODUCTS);
  productEditorModal.classList.add('hidden');
  renderInventoryList();
  renderProducts(getActiveCategory());
}

/* ======= CART / SALES ======= */
function addToCart(productId){
  const p = PRODUCTS.find(x=>x.id===productId);
  if(!p) return;
  const inCart = CART.find(i=>i.id===p.id);
  if(inCart){ inCart.qty += 1; }
  else CART.push({ id:p.id, name:p.name, price:p.price, qty:1 });
  renderCart();
}

function renderCart(){
  cartItemsEl.innerHTML = '';
  let subtotal = 0;
  CART.forEach(item=>{
    subtotal += (item.price * item.qty);
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <div style="display:flex;gap:10px;align-items:center">
        <div><strong>${escapeHtml(item.name)}</strong><br><small class="muted">x${item.qty}</small></div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end">
        <div>$${formatDollars(item.price * item.qty)}</div>
        <div style="display:flex;gap:6px;margin-top:6px">
          <button class="small-btn dec" data-id="${item.id}">−</button>
          <button class="small-btn inc" data-id="${item.id}">+</button>
          <button class="small-btn rm" data-id="${item.id}">Remove</button>
        </div>
      </div>
    `;
    cartItemsEl.appendChild(row);
  });

  // bind cart item buttons
  cartItemsEl.querySelectorAll('.inc').forEach(b=> b.addEventListener('click', e=> {
    const id = e.target.getAttribute('data-id'); CART.find(i=>i.id===id).qty++; renderCart();
  }));
  cartItemsEl.querySelectorAll('.dec').forEach(b=> b.addEventListener('click', e=> {
    const id = e.target.getAttribute('data-id'); const it = CART.find(i=>i.id===id); if(!it) return;
    it.qty = Math.max(1, it.qty-1); renderCart();
  }));
  cartItemsEl.querySelectorAll('.rm').forEach(b=> b.addEventListener('click', e=> {
    const id = e.target.getAttribute('data-id'); CART = CART.filter(i=>i.id!==id); renderCart();
  }));

  // shipping calculation (if delivery selected)
  const deliverySelected = document.querySelector('input[name="delivery"]:checked')?.value === 'delivery';
  let shipping = 0;
  if(deliverySelected){
    const subtotalRounded = roundTwo(subtotal);
    if(subtotalRounded >= SHIPPING_RULES.freeOver) shipping = 0;
    else shipping = SHIPPING_RULES.flatRate;
  }

  const tax = roundTwo((subtotal + shipping) * TAX_RATE);
  const total = roundTwo(subtotal + shipping + tax);

  subtotalEl.innerText = `$${formatDollars(subtotal)}`;
  shippingEl.innerText = `$${formatDollars(shipping)}`;
  taxEl.innerText = `$${formatDollars(tax)}`;
  totalEl.innerText = `$${formatDollars(total)}`;
}

/* ======= Confirm Sale ======= */
function openCheckoutModal(){ 
  // fill employee select
  renderEmployees();
  checkoutModal.classList.remove('hidden');
}

function confirmSale(){
  // validation
  const name = custName.value.trim(); const email = custEmail.value.trim(); const phone = custPhone.value.trim();
  const deliveryMode = document.querySelector('input[name="delivery"]:checked')?.value;
  if(!name){ if(!confirm('Customer name empty. Continue?')===true) return; }
  // payment validation simplified for demo
  let tender = { type: paymentType.value };
  if(paymentType.value === 'mixed'){
    const cash = Number(payCashAmount.value) || 0; const card = Number(payCardAmount.value) || 0;
    tender = { type:'mixed', cash: cash, card: card };
  }

  // compute totals again
  let subtotal = 0; CART.forEach(i => subtotal += i.price * i.qty);
  const shipping = (deliveryMode === 'delivery' && subtotal < SHIPPING_RULES.freeOver) ? SHIPPING_RULES.flatRate : 0;
  const tax = roundTwo((subtotal + shipping) * TAX_RATE);
  const total = roundTwo(subtotal + shipping + tax);

  // create sale record
  const sale = {
    id: idNow(),
    createdAt: new Date().toISOString(),
    status: 'paid',
    items: JSON.parse(JSON.stringify(CART)), // deep copy
    subtotal: roundTwo(subtotal),
    shipping: roundTwo(shipping),
    tax: tax,
    total: total,
    customer: { name, email, phone, address: custAddress.value || '', deliveryMode },
    employee: SESSION ? { id: SESSION.id, name: SESSION.name, role: SESSION.role } : { id: null, name: 'guest', role: 'guest' },
    payment: tender,
    void: null,
    refund: null
  };

  // decrement inventory
  try{
    sale.items.forEach(it=>{
      const prod = PRODUCTS.find(p => p.id === it.id);
      if(prod){ prod.stock = Math.max(0, (prod.stock - it.qty)); }
    });
    save(KEY_PRODUCTS, PRODUCTS);
  } catch(e){ console.error(e); }

  SALES.unshift(sale); save(KEY_SALES, SALES);

  // optional: push to remote (Firebase) if HYBRID_SYNC true (stub)
  if(HYBRID_SYNC){ /* TODO: upload sale to remote DB */ }

  // print receipt (PDF) then clear cart
  generateReceiptPDF(sale);
  CART = []; renderCart();
  checkoutModal.classList.add('hidden');
  renderProducts(getActiveCategory());
  alert('Sale recorded');
}

/* ======= Sales history / void / refund ======= */
function openSalesModal(){
  salesModal.classList.remove('hidden'); renderSalesList();
}

function renderSalesList(){
  salesList.innerHTML = '';
  if(SALES.length === 0){ salesList.innerHTML = '<div class="muted">No sales yet</div>'; return; }
  SALES.forEach(s=>{
    const row = document.createElement('div'); row.className = 'inventory-row';
    row.innerHTML = `
      <div style="flex:1">
        <div style="font-weight:700">${s.id} • $${formatDollars(s.total)}</div>
        <div class="muted">${new Date(s.createdAt).toLocaleString()} • ${s.employee?.name || ''} • status: ${s.status}</div>
        <div class="muted">Customer: ${escapeHtml(s.customer?.name || '-') } ${ s.customer?.address ? ' • ' + escapeHtml(s.customer.address) : ''}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        ${ s.status === 'paid' ? `<button class="small-btn void-btn" data-id="${s.id}">Void</button>` : ''}
        ${ s.status === 'paid' ? `<button class="small-btn refund-btn" data-id="${s.id}">Refund</button>` : ''}
        <button class="small-btn print-btn" data-id="${s.id}">Print</button>
      </div>
    `;
    salesList.appendChild(row);
  });

  // bind actions
  salesList.querySelectorAll('.void-btn').forEach(b=>b.addEventListener('click', e=>{
    const id = e.target.getAttribute('data-id'); doVoidSale(id);
  }));
  salesList.querySelectorAll('.refund-btn').forEach(b=>b.addEventListener('click', e=>{
    const id = e.target.getAttribute('data-id'); doRefundSale(id);
  }));
  salesList.querySelectorAll('.print-btn').forEach(b=>b.addEventListener('click', e=>{
    const id = e.target.getAttribute('data-id'); const s = SALES.find(x=>x.id===id); if(s) generateReceiptPDF(s);
  }));
}

function doVoidSale(id){
  if(!confirm('Void this sale? This marks it void and will not restock by default. Admin only.')) return;
  if(!SESSION || !isAdmin()){ alert('Only admin can void'); return; }
  const sale = SALES.find(s=>s.id===id);
  if(!sale) return;
  sale.status = 'voided';
  sale.void = { by: SESSION.name, at: new Date().toISOString(), reason: 'Voided by admin' };
  save(KEY_SALES, SALES);
  renderSalesList();
  alert('Sale voided');
}

function doRefundSale(id){
  const sale = SALES.find(s=>s.id===id);
  if(!sale) return;
  const amountStr = prompt('Refund amount (e.g. 19.99) — full refund by default', sale.total);
  if(amountStr === null) return;
  const amt = Number(amountStr);
  if(isNaN(amt) || amt <= 0){ alert('Invalid amount'); return; }
  const reason = prompt('Reason for refund (optional)', 'Customer return');
  // restock items proportional to refunded amount - for simplicity we'll restock full quantities on full refund
  if(confirm('Restock items? (Yes will add items back to inventory)')){
    sale.items.forEach(it=>{
      const prod = PRODUCTS.find(p=>p.id===it.id);
      if(prod) prod.stock = (prod.stock + it.qty);
    });
    save(KEY_PRODUCTS, PRODUCTS);
  }
  sale.refund = { by: SESSION ? SESSION.name : 'unknown', at: new Date().toISOString(), amount: roundTwo(amt), reason };
  sale.status = 'refunded';
  save(KEY_SALES, SALES);
  renderSalesList(); renderProducts(getActiveCategory());
  alert('Refund recorded');
}

/* ======= Receipt (PDF) ======= */
function generateReceiptPDF(sale){
  try{
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({unit:'pt', format:'letter'});
    let y = 40;
    doc.setFontSize(18); doc.text("Caleb's Merch Store", 40, y); y += 24;
    doc.setFontSize(12); doc.text(`Sale: ${sale.id}`, 40, y); y += 16;
    doc.text(`Date: ${new Date(sale.createdAt).toLocaleString()}`, 40, y); y += 18;
    doc.text(`Employee: ${sale.employee?.name || ''}`, 40, y); y += 18;
    doc.text(`Customer: ${sale.customer?.name || ''}`, 40, y); y += 18;
    if(sale.customer?.address) { doc.text(`Address: ${sale.customer.address}`, 40, y); y += 18; }
    y += 6; doc.line(36, y, 560, y); y+=12;
    sale.items.forEach(it=>{
      const left = `${it.qty} x ${it.name}`;
      const right = `$${formatDollars(it.price * it.qty)}`;
      doc.text(left, 40, y);
      doc.text(right, 480, y);
      y += 16;
    });
    y += 6; doc.line(36, y, 560, y); y+=16;
    doc.text(`Subtotal: $${formatDollars(sale.subtotal)}`, 40, y); y += 16;
    doc.text(`Shipping: $${formatDollars(sale.shipping)}`, 40, y); y += 16;
    doc.text(`Tax: $${formatDollars(sale.tax)}`, 40, y); y+=16;
    doc.setFontSize(14); doc.text(`Total: $${formatDollars(sale.total)}`, 40, y); y+=24;
    doc.setFontSize(10); doc.text('Thank you for shopping at Caleb\'s Merch Store!', 40, y);
    doc.save(`receipt_${sale.id}.pdf`);
  }catch(e){ console.error('pdf fail',e); alert('Receipt generation failed') }
}

/* ======= Utility Helpers ======= */
function formatDollars(n){ return (Math.round((n + Number.EPSILON) * 100)/100).toFixed(2) }
function roundTwo(n){ return Math.round((n + Number.EPSILON) * 100)/100 }
function escapeHtml(s){ if(!s) return ''; return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;' })[c]); }
function getActiveCategory(){ return document.querySelector('#categoryList li.active')?.innerText || 'All Products' }

/* ======= CSV helpers ======= */
function downloadCsv(arr, filename='export.csv'){
  if(!arr || !arr.length){ alert('Nothing to export'); return; }
  const keys = Object.keys(arr[0]);
  const csv = [keys.join(',')].concat(arr.map(o=> keys.map(k=> JSON.stringify(o[k]===undefined?'':o[k])).join(','))).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

/* ======= Employees select ======= */
function renderEmployees(){
  employeeSelect.innerHTML = '';
  USERS.forEach(u=>{
    const opt = document.createElement('option'); opt.value = u.id; opt.innerText = `${u.name} (${u.role})`;
    employeeSelect.appendChild(opt);
  });
}

/* ======= Save on change ======= */
window.addEventListener('beforeunload', ()=> {
  save(KEY_PRODUCTS, PRODUCTS);
  save(KEY_SALES, SALES);
  save(KEY_USERS, USERS);
  save(KEY_SESSION, SESSION);
});

/* ======= initial render calls ======= */
function renderEmployees(){ if(typeof window !== 'undefined'){ const s = employeeSelect; if(s){ s.innerHTML=''; USERS.forEach(u=>{ const o=document.createElement('option'); o.value=u.id; o.textContent=`${u.name} (${u.role})`; s.appendChild(o); }); } } }
function renderCategoryClicks(){ /* already bound in bindUI at top-level for dynamic pages */ }

/* expose some debug helpers on window for convenience */
window.__POS = {
  PRODUCTS, SALES, USERS,
  addToCart, renderProducts, openInventoryModal, openSalesModal
};

/* initial saves to ensure storage keys exist */
save(KEY_PRODUCTS, PRODUCTS);
save(KEY_USERS, USERS);
save(KEY_SALES, SALES);
