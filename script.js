// Simple investment calculator + small portfolio stored in localStorage
// বাংলা UI দিয়ে কাজ করে

// — Calculator logic
function calculateFV(principal, annualRatePct, years, compoundsPerYear){
  const P = Number(principal);
  const r = Number(annualRatePct)/100;
  const n = Number(compoundsPerYear);
  const t = Number(years);
  if(isNaN(P) || isNaN(r) || isNaN(n) || isNaN(t)) return null;
  const fv = P * Math.pow(1 + r / n, n * t);
  return fv;
}

document.addEventListener('DOMContentLoaded', () => {
  const principalEl = document.getElementById('principal');
  const rateEl = document.getElementById('rate');
  const yearsEl = document.getElementById('years');
  const compoundsEl = document.getElementById('compounds');
  const fvEl = document.getElementById('fv');
  const profitEl = document.getElementById('profit');
  const calcBtn = document.getElementById('calcBtn');

  calcBtn.addEventListener('click', () => {
    const fv = calculateFV(principalEl.value, rateEl.value, yearsEl.value, compoundsEl.value);
    if(fv === null){ alert('অনুগ্রহ করে সব ইনপুট সঠিক দিন'); return; }
    const principal = Number(principalEl.value);
    fvEl.textContent = fv.toLocaleString(undefined, {maximumFractionDigits:2});
    profitEl.textContent = (fv - principal).toLocaleString(undefined, {maximumFractionDigits:2});
  });

  // — Portfolio logic (simple, client-side)
  const tableBody = document.querySelector('#portfolioTable tbody');
  const portfolioTotalEl = document.getElementById('portfolioTotal');
  const addForm = document.getElementById('addForm');

  function loadPortfolio(){
    const raw = localStorage.getItem('mini_invest_portfolio');
    return raw ? JSON.parse(raw) : [];
  }

  function savePortfolio(arr){
    localStorage.setItem('mini_invest_portfolio', JSON.stringify(arr));
  }

  function renderPortfolio(){
    const items = loadPortfolio();
    tableBody.innerHTML = '';
    let total = 0;
    items.forEach((it, idx) => {
      const fv = calculateFV(it.amount, it.rate, it.years, 12);
      total += fv;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(it.name)}</td>
        <td>৳ ${Number(it.amount).toLocaleString()}</td>
        <td>${it.rate}%</td>
        <td>${it.years}</td>
        <td>৳ ${fv.toLocaleString(undefined, {maximumFractionDigits:2})}</td>
        <td><button data-idx="${idx}" class="remove-btn small">মুছো</button></td>
      `;
      tableBody.appendChild(tr);
    });
    portfolioTotalEl.textContent = `৳ ${total.toLocaleString(undefined, {maximumFractionDigits:2})}`;
  }

  addForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('p-name').value.trim();
    const amount = Number(document.getElementById('p-amount').value);
    const rate = Number(document.getElementById('p-rate').value);
    const years = Number(document.getElementById('p-years').value);
    if(!name || isNaN(amount) || isNaN(rate) || isNaN(years)){
      alert('সব ঘর সঠিকভাবে পূরণ করুন');
      return;
    }
    const arr = loadPortfolio();
    arr.push({name, amount, rate, years});
    savePortfolio(arr);
    addForm.reset();
    renderPortfolio();
  });

  tableBody.addEventListener('click', e => {
    if(e.target.matches('.remove-btn')){
      const idx = Number(e.target.dataset.idx);
      const arr = loadPortfolio();
      arr.splice(idx,1);
      savePortfolio(arr);
      renderPortfolio();
    }
  });

  // Utils
  function escapeHtml(s){
    return String(s).replace(/[&<>\"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; });
  }

  // initial render
  renderPortfolio();
});
