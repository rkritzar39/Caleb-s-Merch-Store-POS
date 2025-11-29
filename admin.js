// admin.js — schedule sales admin UI
const STORAGE_KEY = 'POS_SETTINGS';
let POS_SETTINGS = JSON.parse(localStorage.getItem(STORAGE_KEY)) || { flashSales: [], globalSale:{active:false} };

const form = document.getElementById('saleForm');
const salesList = document.getElementById('scheduledSales');
const saleName = document.getElementById('saleName');
const discountType = document.getElementById('discountType');
const discountValue = document.getElementById('discountValue');
const saleCategory = document.getElementById('saleCategory');
const saleStart = document.getElementById('saleStart');
const saleEnd = document.getElementById('saleEnd');
const saleActive = document.getElementById('saleActive');
const valueLabel = document.getElementById('valueLabel');

function saveSettings(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(POS_SETTINGS)); }

function renderSales(){
  salesList.innerHTML = '';
  if(!POS_SETTINGS.flashSales || POS_SETTINGS.flashSales.length === 0){ salesList.innerHTML = '<div class="muted">No scheduled sales.</div>'; return; }
  POS_SETTINGS.flashSales.forEach(s=>{
    const div = document.createElement('div'); div.className = 'sale-item';
    div.innerHTML = `
      <h3>${s.name}</h3>
      <div class="sale-meta"><strong>Type:</strong> ${s.type} ${s.type !== 'free_shipping' ? '• ' + (s.value || '—') : ''}</div>
      <div class="sale-meta"><strong>Category:</strong> ${s.category || 'All'}</div>
      <div class="sale-meta"><strong>Start:</strong> ${s.start}</div>
      <div class="sale-meta"><strong>End:</strong> ${s.end}</div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="edit-sale" data-id="${s.id}">Edit</button>
        <button class="delete-sale" data-id="${s.id}">Delete</button>
        <label style="display:flex;align-items:center;gap:6px;margin-left:auto">
          <input type="checkbox" class="toggle-active" data-id="${s.id}" ${s.active ? 'checked' : ''} /> Active
        </label>
      </div>
    `;
    salesList.appendChild(div);
  });

  // bind buttons
  document.querySelectorAll('.delete-sale').forEach(b=> b.addEventListener('click', e=>{
    const id = e.target.dataset.id;
    POS_SETTINGS.flashSales = POS_SETTINGS.flashSales.filter(x=>x.id != id);
    saveSettings(); renderSales();
  }));
  document.querySelectorAll('.edit-sale').forEach(b=> b.addEventListener('click', e=>{
    const id = e.target.dataset.id; const s = POS_SETTINGS.flashSales.find(x=>x.id==id);
    if(!s) return;
    saleName.value = s.name; discountType.value = s.type; discountValue.value = s.value || '';
    saleCategory.value = s.category || ''; saleStart.value = s.start; saleEnd.value = s.end; saleActive.checked = !!s.active;
    // focus user to edit; on submit we'll replace
    window.scrollTo({ top:0, behavior:'smooth' });
  }));
  document.querySelectorAll('.toggle-active').forEach(cb=> cb.addEventListener('change', e=>{
    const id = e.target.dataset.id; const s = POS_SETTINGS.flashSales.find(x=>x.id==id);
    if(s){ s.active = e.target.checked; saveSettings(); renderSales(); }
  }));
}

// hide discountValue when free_shipping selected
discountType.addEventListener('change', ()=> {
  if(discountType.value === 'free_shipping'){ valueLabel.style.display='none'; discountValue.value=''; }
  else { valueLabel.style.display='block'; }
});

// form submit
form.addEventListener('submit', e=>{
  e.preventDefault();
  const s = {
    id: Date.now().toString(),
    name: saleName.value.trim(),
    type: discountType.value === 'percent' ? 'percent' : (discountType.value === 'amount' ? 'amount' : 'free_shipping'),
    value: discountType.value === 'free_shipping' ? 0 : Number(discountValue.value || 0),
    category: saleCategory.value || '',
    start: saleStart.value,
    end: saleEnd.value,
    active: saleActive.checked
  };
  POS_SETTINGS.flashSales = POS_SETTINGS.flashSales || [];
  POS_SETTINGS.flashSales.push(s);
  saveSettings();
  form.reset();
  saleActive.checked = true;
  renderSales();
  alert('Sale scheduled — POS will apply it during the active window.');
});

// init
renderSales();
