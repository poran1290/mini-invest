// Enhanced script: Chart.js integration + CSV export/import + improved portfolio management

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

  // Portfolio logic
  const tableBody = document.querySelector('#portfolioTable tbody');
  const portfolioTotalEl = document.getElementById('portfolioTotal');
  const addForm = document.getElementById('addForm');
  const exportBtn = document.getElementById('exportCsv');
  const importInput = document.getElementById('importCsv');
  const clearBtn = document.getElementById('clearPortfolio');

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
    const labels = [];
    const data = [];

    items.forEach((it, idx) => {
      const fv = calculateFV(it.amount, it.rate, it.years, 12);
      total += fv;
      labels.push(it.name);
      data.push(Number(fv.toFixed(2)));
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
    updateChart(labels, data);
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

  clearBtn.addEventListener('click', () => {
    if(!confirm('সব পোর্টফোলিও আইটেম মুছে ফেলতে চান?')) return;
    savePortfolio([]);
    renderPortfolio();
  });

  // CSV Export
  exportBtn.addEventListener('click', () => {
    const items = loadPortfolio();
    if(items.length === 0){ alert('পোর্টফোলিও খালি'); return; }
    const header = ['name','amount','rate','years'];
    const rows = items.map(it => [escapeCsv(it.name), it.amount, it.rate, it.years].join(','));
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mini_invest_portfolio.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  // CSV Import
  importInput.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const txt = reader.result;
      try{
        const parsed = parseCsv(txt);
        // parsed: array of objects with name, amount, rate, years
        const arr = loadPortfolio();
        parsed.forEach(row => {
          if(row.name && !isNaN(Number(row.amount))){
            arr.push({name:row.name, amount:Number(row.amount), rate:Number(row.rate||0), years:Number(row.years||0)});
          }
        });
        savePortfolio(arr);
        renderPortfolio();
        importInput.value = '';
      }catch(err){
        alert('CSV ফাইল পার্স করতে সমস্যা: ' + err.message);
      }
    };
    reader.readAsText(f);
  });

  // Chart.js
  const ctx = document.getElementById('portfolioChart').getContext('2d');
  let portfolioChart = null;

  function updateChart(labels, data){
    if(!portfolioChart){
      portfolioChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Future Value (৳)',
            data: data,
            backgroundColor: labels.map((_,i)=>`hsl(${(i*47)%360} 70% 55%)`),
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: { beginAtZero: true }
          }
        }
      });
    } else {
      portfolioChart.data.labels = labels;
      portfolioChart.data.datasets[0].data = data;
      portfolioChart.update();
    }
  }

  // Utils
  function escapeHtml(s){
    return String(s).replace(/[&<>\