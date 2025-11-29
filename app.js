/* app.js — Local-only White POS Register
   Features:
   - LocalStorage (products, users, sales, session)
   - Demo auth (admin/staff)
   - Inventory CRUD (admin)
   - Cart, checkout, customer info, shipping, tax
   - Sales saved locally, void, refund, print PDF (jsPDF)
*/

/* CONFIG */
const TAX_RATE = 0.07; // 7%
const SHIPPING = { flat: 6.50, freeOver: 100.00 };

/* KEYS */
const K_PRODUCTS = 'caleb_products_v1';
const K_USERS = 'caleb_users_v1';
const K_SALES = 'caleb_sales_v1';
const K_SESSION = 'caleb_session_v1';

/* SAMPLE PRODUCTS */
const SAMPLE = [
  { id: idNow(), sku:'OUT-001', name:'Outdoor Backpack', price:49.99, category:'Outdoor', stock:12, img:'' },
  { id: idNow(), sku:'HAT-001', name:'Caleb Hat', price:19.99, category:'Hats', stock:30, img:'' },
  { id: idNow(), sku:'HD-001', name:'Logo Hoodie', price:39.99, category:'Hoodies & Sweatshirts', stock:18, img:'' },
  { id: idNow(), sku:'TEE-001', name:'Graphic Tee', price:24.99, category:'T-Shirts', stock:40, img:'' },
  { id: idNow(), sku:'BABY-001', name:'Baby Onesie', price:14.99, category:'Baby & Toddler', stock:20, img:'' },
  { id: idNow(), sku:'MUG-001', name:'Caleb Mug', price:12.99, category:'Kitchenwear', stock:25, img:'' },
  { id: idNow(), sku:'STK-001', name:'Sticker Pack', price:4.99, category:'Accessories', stock:250, img:'' }
];

/* STATE */
let PRODUCTS = load(K_PRODUCTS) || SAMPLE.slice();
let USERS = load(K_USERS) || seedUsers();
let SALES = load(K_SALES) || [];
let SESSION = load(K_SESSION) || null;
let CART = [];

/* DOM */
const productGrid = document.getElementById('productGrid');
const searchBox = document.getElementById('searchBox');
const catBtns = document.querySelectorAll('.cat');

const cartList = document.getElementById('cartList');
const subtotalEl = document.getElementById('subtotal');
const shippingEl = document.getElementById('shipping');
const taxEl = document.getElementById('tax');
const totalEl = document.getElementById('total');
const cartItemsCount = document.getElementById('cartItemsCount');
const cartEmployee = document.getElementById('cartEmployee');

const checkoutBtn = document.getElementById('checkoutBtn');
const clearBtn = document.getElementById('clearBtn');

const checkoutModal = document.getElementById('checkoutModal');
const paymentType = document.getElementById('paymentType');
const mixedInputs = document.getElementById('mixedInputs');
const cashAmt = document.getElementById('cashAmt');
const cardAmt = document.getElementById('cardAmt');
const employeeSelect = document.getElementById('employeeSelect');
const confirmSale = document.getElementById('confirmSale');
const cancelCheckout = document.getElementById('cancelCheckout');

const inventoryBtn = document.getElementById('inventoryBtn');
const inventoryModal = document.getElementById('inventoryModal');
const invList = document.getElementById('invList');
const newProdBtn = document.getElementById('newProdBtn');
const importSeed = document.getElementById('importSeed');
const exportInv = document.getElementById('exportInv');
const closeInv = document.getElementById('closeInv');

const prodEditor = document.getElementById('prodEditor');
const prodEditorTitle = document.getElementById('prodEditorTitle');
const pe_id = document.getElementById('pe_id');
const pe_sku = document.getElementById('pe_sku');
const pe_name = document.getElementById('pe_name');
const pe_price = document.getElementById('pe_price');
const pe_stock = document.getElementById('pe_stock');
const pe_cat = document.getElementById('pe_cat');
const pe_img = document.getElementById('pe_img');
const pe_desc = document.getElementById('pe_desc');
const saveProd = document.getElementById('saveProd');
const cancelProd = document.getElementById('cancelProd');

const salesBtn = document.getElementById('salesBtn');
const salesModal = document.getElementById('salesModal');
const salesList = document.getElementById('salesList');
const closeSales = document.getElementById('closeSales');

const authBtn = document.getElementById('authBtn');
const authModal = document.getElementById('authModal');
const authEmail = document.getElementById('authEmail');
const authPass = document.getElementById('authPass');
const authSubmit = document.getElementById('authSubmit');
const authCancel = document.getElementById('authCancel');
const userBadge = document.getElementById('userBadge');
const modeBtn = document.getElementById('modeBtn');

const custName = document.getElementById('custName');
const custEmail = document.getElementById('custEmail');
const custPhone = document.getElementById('custPhone');
const custAddress = document.getElementById('custAddress');

/* INIT */
renderProducts('All Products');
bindUI();
renderCart();
renderAuthBadge();
renderEmployees();

/* HELPERS */
function idNow(){ return 'p_' + Math.random().toString(36).slice(2,9) + '_' + Date.now().toString(36) }
function load(k){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : null } catch(e){ return null } }
function save(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
function round(n){ return Math.round((n + Number.EPSILON) * 100) / 100; }
function fmt(n){ return round(n).toFixed(2); }
function seedUsers(){
  const u = [
    { id:idNow(), name:'Admin', email:'admin@example.com', role:'admin', password:'admin123' },
    { id:idNow(), name:'Staff', email:'staff@example.com', role:'staff', password:'staff123' }
  ];
  save(K_USERS, u);
  return u;
}

/* UI BINDINGS */
function bindUI(){
  // categories
  catBtns.forEach(b=>{
    b.addEventListener('click', ()=> {
      document.querySelector('.cat.active')?.classList.remove('active');
      b.classList.add('active');
      renderProducts(b.dataset.cat);
    });
  });

  // search
  searchBox.addEventListener('input', ()=> renderProducts(getActiveCat()));

  // product click handled in renderProducts

  // cart actions
  checkoutBtn.addEventListener('click', ()=> {
    if(CART.length === 0){ alert('Cart empty'); return; }
    if(!SESSION) { alert('Please sign in'); openAuth(); return; }
    openCheckout();
  });
  clearBtn.addEventListener('click', ()=> { CART=[]; renderCart(); });

  // checkout modal
  paymentType.addEventListener('change', ()=> mixedInputs.classList.toggle('hidden', paymentType.value !== 'mixed'));
  confirmSale.addEventListener('click', finalizeSale);
  cancelCheckout.addEventListener('click', ()=> checkoutModal.classList.add('hidden'));

  // inventory
  inventoryBtn.addEventListener('click', ()=> {
    if(!SESSION || SESSION.role !== 'admin'){ alert('Inventory requires admin sign in'); openAuth(); return; }
    openInventory();
  });
  newProdBtn.addEventListener('click', ()=> openProductEditor());
  importSeed.addEventListener('click', ()=> { PRODUCTS = SAMPLE.concat(PRODUCTS); save(K_PRODUCTS, PRODUCTS); renderProducts(getActiveCat()); alert('Sample imported'); });
  exportInv.addEventListener('click', ()=> downloadCSV(PRODUCTS,'inventory.csv'));
  closeInv.addEventListener('click', ()=> inventoryModal.classList.add('hidden'));
  saveProd.addEventListener('click', saveProductEditor);
  cancelProd.addEventListener('click', ()=> prodEditor.classList.add('hidden'));

  // sales
  salesBtn.addEventListener('click', ()=> salesModal.classList.remove('hidden'));
  closeSales.addEventListener('click', ()=> salesModal.classList.add('hidden'));

  // auth
  authBtn.addEventListener('click', ()=> { if(SESSION) { signOut(); } else openAuth(); });
  authSubmit.addEventListener('click', doAuth);
  authCancel.addEventListener('click', ()=> authModal.classList.add('hidden'));

  // sales list binding
  salesModal.addEventListener('click', ()=> renderSales());

  // keyboard
  window.addEventListener('keydown', (e)=> {
    if(e.key === 'F1') searchBox.focus();
    if(e.key === 'F2') inventoryBtn.click();
  });

  // mode (placeholder)
  modeBtn.addEventListener('click', ()=> {
    alert('Local Mode active — hybrid sync can be added later.');
  });
}

/* PRODUCTS */
function renderProducts(category){
  const q = (searchBox.value || '').trim().toLowerCase();
  productGrid.innerHTML = '';
  const list = PRODUCTS.filter(p=>{
    if(category && category !== 'All Products' && p.category !== category) return false;
    if(q && !(p.name.toLowerCase().includes(q) || (p.sku||'').toLowerCase().includes(q))) return false;
    return true;
  });
  list.forEach(p=>{
    const el = document.createElement('div'); el.className = 'product';
    el.innerHTML = `
      <div style="width:100%;height:100px;background:#f3f4f6;border-radius:8px;display:flex;align-items:center;justify-content:center">
        <img src="${p.img || ''}" style="max-width:100%;max-height:100%;display:${p.img?'block':'none'}" alt="">
        ${p.img ? '' : '<div style="color:#9ca3af">No Image</div>'}
      </div>
      <div class="name">${escape(p.name)}</div>
      <div class="price">$${fmt(p.price)}</div>
      <div class="meta">${p.sku || ''} • stock ${p.stock}</div>
    `;
    el.addEventListener('click', ()=> addToCart(p.id));
    productGrid.appendChild(el);
  });
}

/* CART */
function addToCart(id){
  const p = PRODUCTS.find(x=>x.id===id);
  if(!p) return;
  const inCart = CART.find(i=>i.id===p.id);
  if(inCart){ inCart.qty += 1; }
  else CART.push({ id:p.id, name:p.name, price:p.price, qty:1 });
  renderCart();
}

function renderCart(){
  cartList.innerHTML = '';
  let subtotal = 0;
  CART.forEach(item=>{
    subtotal += item.price * item.qty;
    const row = document.createElement('div'); row.className = 'cart-item';
    row.innerHTML = `
      <div>
        <div style="font-weight:600">${escape(item.name)}</div>
        <div class="muted">x${item.qty} • $${fmt(item.price)}</div>
      </div>
      <div class="controls">
        <button class="btn small dec" data-id="${item.id}">−</button>
        <button class="btn small inc" data-id="${item.id}">+</button>
        <button class="btn small rm" data-id="${item.id}">Remove</button>
        <div style="margin-top:6px;font-weight:700">$${fmt(item.price * item.qty)}</div>
      </div>
    `;
    cartList.appendChild(row);
  });

  // bind controls
  cartList.querySelectorAll('.inc').forEach(b=> b.addEventListener('click', e=> { const id = e.target.dataset.id; CART.find(i=>i.id===id).qty++; renderCart(); }));
  cartList.querySelectorAll('.dec').forEach(b=> b.addEventListener('click', e=> { const id = e.target.dataset.id; const it = CART.find(i=>i.id===id); if(it){ it.qty = Math.max(1, it.qty-1); renderCart(); }}));
  cartList.querySelectorAll('.rm').forEach(b=> b.addEventListener('click', e=> { const id = e.target.dataset.id; CART = CART.filter(i=>i.id!==id); renderCart(); }));

  // shipping: check delivery radio
  const delivery = document.querySelector('input[name="deliveryOption"]:checked')?.value === 'delivery';
  let shipping = 0;
  const subtotalRounded = round(subtotal);
  if(delivery){
    shipping = subtotalRounded >= SHIPPING.freeOver ? 0 : SHIPPING.flat;
  }
  const tax = round((subtotal + shipping) * TAX_RATE);
  const total = round(subtotal + shipping + tax);

  subtotalEl.innerText = `$${fmt(subtotal)}`;
  shippingEl.innerText = `$${fmt(shipping)}`;
  taxEl.innerText = `$${fmt(tax)}`;
  totalEl.innerText = `$${fmt(total)}`;

  cartItemsCount.innerText = `${CART.reduce((s,i)=>s+i.qty,0)} items`;
  cartEmployee.innerText = `Employee: ${SESSION ? SESSION.name + ' ('+SESSION.role+')' : '—'}`;

  // persist current UI state if needed
}

/* CHECKOUT */
function openCheckout(){
  renderEmployees();
  checkoutModal.classList.remove('hidden');
}

function finalizeSale(){
  // validate employee
  const empId = employeeSelect.value;
  const employee = USERS.find(u=>u.id===empId) || { name:'Unknown' };
  // customer
  const customer = { name: custName.value.trim(), email: custEmail.value.trim(), phone: custPhone.value.trim(), address: custAddress.value.trim() };
  // payment
  let payment = { type: paymentType.value };
  if(payment.type === 'mixed'){ payment.cash = Number(cashAmt.value) || 0; payment.card = Number(cardAmt.value) || 0; }
  // compute totals
  let subtotal = 0; CART.forEach(i=> subtotal += i.price * i.qty);
  const shipping = document.querySelector('input[name="deliveryOption"]:checked')?.value === 'delivery' ? (subtotal >= SHIPPING.freeOver ? 0 : SHIPPING.flat) : 0;
  const tax = round((subtotal + shipping) * TAX_RATE);
  const total = round(subtotal + shipping + tax);

  // sale record
  const sale = {
    id: idNow(),
    createdAt: new Date().toISOString(),
    status: 'paid',
    items: JSON.parse(JSON.stringify(CART)),
    subtotal: round(subtotal),
    shipping: round(shipping),
    tax: tax,
    total: total,
    payment,
    customer,
    employee: { id: employee.id || null, name: employee.name || 'Unknown', role: employee.role || 'staff' },
    void: null,
    refund: null
  };

  // decrement inventory
  sale.items.forEach(it=>{
    const p = PRODUCTS.find(x=>x.id===it.id);
    if(p) p.stock = Math.max(0, p.stock - it.qty);
  });

  SALES.unshift(sale);
  save(K_SALES, SALES);
  save(K_PRODUCTS, PRODUCTS);

  // print receipt
  generatePDF(sale);

  // clear cart & UI
  CART = []; renderCart();
  checkoutModal.classList.add('hidden');
  alert('Sale complete and saved locally.');
}

/* SALES HISTORY + VOID + REFUND */
function renderSales(){
  salesList.innerHTML = '';
  if(SALES.length === 0){ salesList.innerHTML = '<div class="muted">No sales yet</div>'; return; }
  SALES.forEach(s=>{
    const row = document.createElement('div'); row.className = 'inventory-row';
    row.innerHTML = `
      <div>
        <div style="font-weight:700">${s.id} • $${fmt(s.total)}</div>
        <div class="muted">${new Date(s.createdAt).toLocaleString()} • ${s.employee?.name || '-'}</div>
        <div class="muted">Customer: ${escape(s.customer?.name || '-')}${ s.customer?.address ? ' • ' + escape(s.customer.address) : '' }</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        ${ s.status === 'paid' ? `<button class="btn" data-void="${s.id}">Void</button>` : '' }
        ${ s.status === 'paid' ? `<button class="btn" data-ref="${s.id}">Refund</button>` : '' }
        <button class="btn" data-print="${s.id}">Print</button>
      </div>
    `;
    salesList.appendChild(row);
  });

  // bind
  salesList.querySelectorAll('[data-void]').forEach(b=> b.addEventListener('click', e=> {
    const id = e.target.dataset.void;
    doVoid(id);
  }));
  salesList.querySelectorAll('[data-ref]').forEach(b=> b.addEventListener('click', e=> {
    const id = e.target.dataset.ref;
    doRefund(id);
  }));
  salesList.querySelectorAll('[data-print]').forEach(b=> b.addEventListener('click', e=> {
    const id = e.target.dataset.print; const s = SALES.find(x=>x.id===id); if(s) generatePDF(s);
  }));
}

/* VOID */
function doVoid(id){
  if(!SESSION || SESSION.role !== 'admin'){ alert('Only admin can void'); return; }
  if(!confirm('Void this sale? This marks the sale as voided (no restock).')) return;
  const sale = SALES.find(s=>s.id===id);
  if(!sale) return;
  sale.status = 'voided';
  sale.void = { by: SESSION.name, at: new Date().toISOString() };
  save(K_SALES, SALES);
  renderSales();
  alert('Sale voided');
}

/* REFUND */
function doRefund(id){
  if(!SESSION){ alert('Sign in to refund'); return; }
  const sale = SALES.find(s=>s.id===id);
  if(!sale) return;
  const amtStr = prompt('Refund amount (e.g. 14.99). Full refund by default:', sale.total);
  if(amtStr === null) return;
  const amt = Number(amtStr);
  if(Number.isNaN(amt) || amt <= 0){ alert('Invalid amount'); return; }
  const reason = prompt('Reason for refund (optional):', 'Customer return');

  // restock decision
  if(confirm('Restock items? (Yes to add sold quantities back)')){
    sale.items.forEach(it=>{
      const p = PRODUCTS.find(x=>x.id===it.id); if(p) p.stock = p.stock + it.qty;
    });
    save(K_PRODUCTS, PRODUCTS);
  }

  sale.refund = { by: SESSION.name, at: new Date().toISOString(), amount: amt, reason };
  sale.status = 'refunded';
  save(K_SALES, SALES);
  renderSales();
  renderProducts(getActiveCat());
  alert('Refund recorded');
}

/* PDF RECEIPT using jsPDF */
function generatePDF(sale){
  try{
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({unit:'pt', format:'letter'});
    let y = 40;
    doc.setFontSize(18); doc.text("Caleb's Merch Store", 40, y); y+=24;
    doc.setFontSize(11); doc.text(`Sale ID: ${sale.id}`, 40, y); y+=14;
    doc.text(`Date: ${new Date(sale.createdAt).toLocaleString()}`, 40, y); y+=14;
    doc.text(`Employee: ${sale.employee?.name || '-'}`, 40, y); y+=14;
    doc.text(`Customer: ${sale.customer?.name || '-'}`, 40, y); y+=14;
    if(sale.customer?.address) { doc.text(`Address: ${sale.customer.address}`, 40, y); y+=14; }
    y+=6; doc.line(36,y,560,y); y+=12;
    sale.items.forEach(it=>{
      doc.text(`${it.qty} x ${it.name}`, 40, y);
      doc.text(`$${fmt(it.price * it.qty)}`, 480, y);
      y+=14;
    });
    y+=6; doc.line(36,y,560,y); y+=12;
    doc.text(`Subtotal: $${fmt(sale.subtotal)}`, 40, y); y+=14;
    doc.text(`Shipping: $${fmt(sale.shipping)}`, 40, y); y+=14;
    doc.text(`Tax: $${fmt(sale.tax)}`, 40, y); y+=14;
    doc.setFontSize(13); doc.text(`Total: $${fmt(sale.total)}`, 40, y); y+=20;
    doc.setFontSize(10); doc.text('Thank you for your purchase!', 40, y);
    doc.save(`receipt_${sale.id}.pdf`);
  }catch(e){ console.error('pdf',e); alert('Receipt failed'); }
}

/* INVENTORY UI */
function openInventory(){ inventoryModal.classList.remove('hidden'); renderInventoryList(); }
function renderInventoryList(){
  invList.innerHTML = '';
  PRODUCTS.forEach(p=>{
    const row = document.createElement('div'); row.className = 'inventory-row';
    row.innerHTML = `
      <div>
        <div style="font-weight:700">${escape(p.name)}</div>
        <div class="muted">${p.sku || ''} • ${p.category}</div>
        <div class="muted">Price $${fmt(p.price)} • Stock ${p.stock}</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn" data-edit="${p.id}">Edit</button>
        <button class="btn" data-del="${p.id}">Delete</button>
      </div>
    `;
    invList.appendChild(row);
  });

  invList.querySelectorAll('[data-edit]').forEach(b=> b.addEventListener('click', e=> {
    const id = e.target.dataset.edit; const p = PRODUCTS.find(x=>x.id===id); openProductEditor(p);
  }));
  invList.querySelectorAll('[data-del]').forEach(b=> b.addEventListener('click', e=> {
    const id = e.target.dataset.del;
    if(!confirm('Delete product?')) return;
    PRODUCTS = PRODUCTS.filter(x=>x.id!==id); save(K_PRODUCTS, PRODUCTS); renderInventoryList(); renderProducts(getActiveCat());
  }));
}

function openProductEditor(p){
  prodEditor.classList.remove('hidden');
  if(!p){ prodEditorTitle.innerText='New Product'; pe_id.value=''; pe_sku.value=''; pe_name.value=''; pe_price.value=''; pe_stock.value=''; pe_cat.value=''; pe_img.value=''; pe_desc.value=''; }
  else {
    prodEditorTitle.innerText='Edit Product';
    pe_id.value=p.id; pe_sku.value=p.sku || ''; pe_name.value=p.name; pe_price.value=p.price; pe_stock.value=p.stock; pe_cat.value=p.category; pe_img.value=p.img || ''; pe_desc.value=p.desc || '';
  }
}

function saveProductEditor(){
  if(!SESSION || SESSION.role !== 'admin'){ alert('Admin only'); return; }
  const id = pe_id.value || idNow();
  const sku = pe_sku.value.trim();
  const name = pe_name.value.trim(); if(!name){ alert('Name required'); return; }
  const price = Number(pe_price.value); if(Number.isNaN(price)){ alert('Invalid price'); return; }
  const stock = parseInt(pe_stock.value||'0',10);
  const cat = pe_cat.value.trim() || 'Accessories';
  const img = pe_img.value.trim();
  const desc = pe_desc.value.trim();
  const existing = PRODUCTS.findIndex(x=>x.id===id);
  const obj = { id, sku, name, price, stock, category:cat, img, desc };
  if(existing >= 0) PRODUCTS[existing] = obj; else PRODUCTS.unshift(obj);
  save(K_PRODUCTS, PRODUCTS);
  prodEditor.classList.add('hidden'); renderInventoryList(); renderProducts(getActiveCat());
}

/* AUTH */
function openAuth(){ authModal.classList.remove('hidden'); }
function doAuth(){
  const email = authEmail.value.trim(), pass = authPass.value;
  const user = USERS.find(u=>u.email === email && u.password === pass);
  if(!user){ alert('Invalid credentials'); return; }
  SESSION = { id:user.id, name:user.name, role:user.role, email:user.email };
  save(K_SESSION, SESSION);
  authModal.classList.add('hidden');
  renderAuthBadge(); renderEmployees();
}
function signOut(){ SESSION = null; save(K_SESSION,null); renderAuthBadge(); alert('Signed out'); }
function renderAuthBadge(){ userBadge.innerText = SESSION ? `${SESSION.name} (${SESSION.role})` : 'Not signed in'; authBtn.innerText = SESSION ? 'Sign Out' : 'Sign In'; }

/* EMPLOYEES */
function renderEmployees(){
  if(!employeeSelect) return;
  employeeSelect.innerHTML = '';
  USERS.forEach(u=> { const o = document.createElement('option'); o.value = u.id; o.textContent = `${u.name} (${u.role})`; employeeSelect.appendChild(o); });
}

/* UTIL */
function getActiveCat(){ return document.querySelector('.cat.active')?.dataset.cat || 'All Products' }
function escape(s){ if(!s) return ''; return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function downloadCSV(arr, filename='export.csv'){
  if(!arr || !arr.length){ alert('Nothing to export'); return; }
  const keys = Object.keys(arr[0]);
  const csv = [keys.join(',')].concat(arr.map(o=> keys.map(k=> JSON.stringify(o[k]===undefined?'':o[k])).join(','))).join('\n');
  const blob = new Blob([csv], {type:'text/csv'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

/* SALES render */
function renderSalesListUI(){
  salesList.innerHTML = '';
  if(SALES.length === 0){ salesList.innerHTML = '<div class="muted">No sales yet</div>'; return; }
  SALES.forEach(s=>{
    const row = document.createElement('div'); row.className='inventory-row';
    row.innerHTML = `<div>
        <div style="font-weight:700">${s.id} • $${fmt(s.total)}</div>
        <div class="muted">${new Date(s.createdAt).toLocaleString()} • ${s.employee?.name || '-'}</div>
        <div class="muted">Customer: ${escape(s.customer?.name || '-')}${s.customer?.address ? ' • ' + escape(s.customer.address) : ''}</div>
      </div>
      <div style="display:flex;gap:8px">
        ${ s.status === 'paid' ? `<button class="btn" data-void="${s.id}">Void</button>` : '' }
        ${ s.status === 'paid' ? `<button class="btn" data-ref="${s.id}">Refund</button>` : '' }
        <button class="btn" data-print="${s.id}">Print</button>
      </div>`;
    salesList.appendChild(row);
  });

  salesList.querySelectorAll('[data-void]').forEach(b=> b.addEventListener('click', e=> {
    const id = e.target.dataset.void; doVoid(id);
  }));
  salesList.querySelectorAll('[data-ref]').forEach(b=> b.addEventListener('click', e=> {
    const id = e.target.dataset.ref; doRefund(id);
  }));
  salesList.querySelectorAll('[data-print]').forEach(b=> b.addEventListener('click', e=> {
    const id = e.target.dataset.print; const s = SALES.find(x=>x.id===id); if(s) generatePDF(s);
  }));
}

/* wrapper to keep renderSales up to date */
function renderSales(){ renderSalesListUI(); }

/* on modal open show list */
salesModal.addEventListener('show', renderSales);

/* finalize initial binding extras */
function getActiveCatBtnText(){ return getActiveCat(); }

/* start-up saves */
save(K_PRODUCTS, PRODUCTS);
save(K_USERS, USERS);
save(K_SALES, SALES);

/* Simple helper to ensure modals can be closed via Escape and clicks outside */
document.addEventListener('keydown', e=> { if(e.key === 'Escape'){ document.querySelectorAll('.modal').forEach(m=> m.classList.add('hidden')); }});
document.querySelectorAll('.modal').forEach(mod => {
  mod.addEventListener('click', e=> { if(e.target === mod) mod.classList.add('hidden'); });
});

/* expose for debug */
window.__POS = { PRODUCTS, USERS, SALES, CART, SESSION };

/* ensure sales modal content updates when shown */
inventoryModal.addEventListener('show', renderInventoryList);

/* initial render for sales list when user opens modal */
salesBtn.addEventListener('click', ()=> { renderSales(); salesModal.classList.remove('hidden'); });

/* if user clicks inventory button and admin, open modal */
inventoryBtn.addEventListener('click', ()=> {
  if(!SESSION || SESSION.role !== 'admin'){ alert('Admin only'); openAuth(); return; }
  openInventory();
});

/* small helpers to keep code compact */
function openAuth(){ authModal.classList.remove('hidden'); }
function openInventory(){ inventoryModal.classList.remove('hidden'); renderInventoryList(); }
function openProductEditor(p){ prodEditor.classList.remove('hidden'); if(!p){ prodEditorTitle.innerText='New Product'; pe_id.value=''; pe_sku.value=''; pe_name.value=''; pe_price.value=''; pe_stock.value=''; pe_cat.value=''; pe_img.value=''; pe_desc.value=''; } else { prodEditorTitle.innerText='Edit Product'; pe_id.value=p.id; pe_sku.value=p.sku || ''; pe_name.value=p.name; pe_price.value=p.price; pe_stock.value=p.stock; pe_cat.value=p.category; pe_img.value=p.img || ''; pe_desc.value=p.desc || ''; } }
function renderInventoryList(){ renderInventoryListUI(); }
function renderInventoryListUI(){ invList.innerHTML = ''; PRODUCTS.forEach(p=>{ const row = document.createElement('div'); row.className='inventory-row'; row.innerHTML = `<div><div style="font-weight:700">${escape(p.name)}</div><div class="muted">${p.sku || ''} • ${p.category}</div><div class="muted">Price $${fmt(p.price)} • Stock ${p.stock}</div></div><div style="display:flex;gap:8px"><button class="btn" data-edit="${p.id}">Edit</button><button class="btn" data-del="${p.id}">Delete</button></div>`; invList.appendChild(row); }); invList.querySelectorAll('[data-edit]').forEach(b=> b.addEventListener('click', e=> { const id=e.target.dataset.edit; const p = PRODUCTS.find(x=>x.id===id); openProductEditor(p); })); invList.querySelectorAll('[data-del]').forEach(b=> b.addEventListener('click', e=> { const id=e.target.dataset.del; if(!confirm('Delete product?')) return; PRODUCTS = PRODUCTS.filter(x=>x.id!==id); save(K_PRODUCTS, PRODUCTS); renderInventoryListUI(); renderProducts(getActiveCat()); })); }

/* save product editor */
function saveProductEditor(){ if(!SESSION || SESSION.role!=='admin'){ alert('Admin only'); return; } const id = pe_id.value || idNow(); const sku = pe_sku.value.trim(); const name = pe_name.value.trim(); if(!name){ alert('Name required'); return; } const price = Number(pe_price.value); if(Number.isNaN(price)){ alert('Invalid price'); return; } const stock = parseInt(pe_stock.value||'0',10); const cat = pe_cat.value.trim() || 'Accessories'; const img = pe_img.value.trim(); const desc = pe_desc.value.trim(); const existing = PRODUCTS.findIndex(x=>x.id===id); const obj = { id, sku, name, price, stock, category:cat, img, desc }; if(existing >= 0) PRODUCTS[existing] = obj; else PRODUCTS.unshift(obj); save(K_PRODUCTS, PRODUCTS); prodEditor.classList.add('hidden'); renderInventoryListUI(); renderProducts(getActiveCat()); }

/* auth logic */
authSubmit.addEventListener('click', ()=> {
  const email = authEmail.value.trim(), pass = authPass.value;
  const user = USERS.find(u=>u.email === email && u.password === pass);
  if(!user){ alert('Invalid demo creds'); return; }
  SESSION = { id:user.id, name:user.name, role:user.role, email:user.email };
  save(K_SESSION, SESSION);
  authModal.classList.add('hidden');
  renderAuthBadge();
  renderEmployees();
});
function signOut(){ SESSION=null; save(K_SESSION,null); renderAuthBadge(); }

/* employees rendering */
function renderEmployees(){ employeeSelect.innerHTML = ''; USERS.forEach(u=> { const o=document.createElement('option'); o.value=u.id; o.textContent = `${u.name} (${u.role})`; employeeSelect.appendChild(o); }); }

/* helpers used earlier */
function getActiveCat(){ return document.querySelector('.cat.active')?.dataset.cat || 'All Products' }

/* generate PDF wrapper (reveal if debug) already have generatePDF */

/* expose globals for debugging */
window.__POS = { PRODUCTS, USERS, SALES, CART, SESSION };

/* final save */
save(K_PRODUCTS, PRODUCTS);
save(K_USERS, USERS);
save(K_SALES, SALES);
