// Enhanced script: Auth (localStorage) + Chart.js integration + CSV export/import + improved portfolio management

// Password hashing using SubtleCrypto (SHA-256)
async function hashPassword(password){
  const enc = new TextEncoder();
  const data = enc.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2,'0')).join('');
}

function calculateFV(principal, annualRatePct, years, compoundsPerYear){
  const P = Number(principal);
  const r = Number(annualRatePct)/100;
  const n = Number(compoundsPerYear);
  const t = Number(years);
  if(isNaN(P) || isNaN(r) || isNaN(n) || isNaN(t)) return null;
  const fv = P * Math.pow(1 + r / n, n * t);
  return fv;
}

// Auth storage keys
const USERS_KEY = 'mini_invest_users';
const CURRENT_KEY = 'mini_invest_current'; // stores email

function loadUsers(){
  const raw = localStorage.getItem(USERS_KEY);
  return raw ? JSON.parse(raw) : [];
}
function saveUsers(u){
  localStorage.setItem(USERS_KEY, JSON.stringify(u));
}

function getCurrentUserEmail(){
  return localStorage.getItem(CURRENT_KEY);
}
function setCurrentUserEmail(email){
  if(email) localStorage.setItem(CURRENT_KEY, email);
  else localStorage.removeItem(CURRENT_KEY);
}

// Portfolio keys: per-user
function portfolioKeyFor(email){
  if(!email) return 'mini_invest_portfolio_guest';
  // sanitize email for key (replace @ and .)
  return `mini_invest_portfolio_${email.replace(/[@.]/g,'_')}`;
}

function loadPortfolio(){
  const key = portfolioKeyFor(getCurrentUserEmail());
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

function savePortfolio(arr){
  const key = portfolioKeyFor(getCurrentUserEmail());
  localStorage.setItem(key, JSON.stringify(arr));
}

document.addEventListener('DOMContentLoaded', () => {
  // Calculator elements
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

  // Portfolio elements
  const portfolioSection = document.getElementById('portfolio');
  const portfolioLock = document.getElementById('portfolioLock');
  const portfolioContent = document.getElementById('portfolioContent');
  const tableBody = document.querySelector('#portfolioTable tbody');
  const portfolioTotalEl = document.getElementById('portfolioTotal');
  const addForm = document.getElementById('addForm');
  const exportBtn = document.getElementById('exportCsv');
  const importInput = document.getElementById('importCsv');
  const clearBtn = document.getElementById('clearPortfolio');
  const openAuthFromLock = document.getElementById('openAuthFromLock');

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

  // Auth UI
  const authArea = document.getElementById('authArea');
  const authModal = document.getElementById('authModal');
  const modalClose = document.getElementById('modalClose');
  const showLogin = document.getElementById('showLogin');
  const showRegister = document.getElementById('showRegister');
  const loginBox = document.getElementById('loginBox');
  const registerBox = document.getElementById('registerBox');
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');

  function updateAuthUI(){
    const email = getCurrentUserEmail();
    authArea.innerHTML = '';
    if(email){
      const users = loadUsers();
      const me = users.find(u=>u.email===email) || {};
      const span = document.createElement('span');
      span.textContent = `স্বাগতম, ${me.name || email}`;
      span.style.marginRight = '8px';
      authArea.appendChild(span);
      const logoutBtn = document.createElement('button');
      logoutBtn.className = 'btn small outline';
      logoutBtn.textContent = 'লগআউট';
      logoutBtn.addEventListener('click', ()=>{ setCurrentUserEmail(null); updateAuthUI(); updateProtectedContent(); });
      authArea.appendChild(logoutBtn);
    } else {
      const loginLink = document.createElement('button');
      loginLink.className = 'btn small';
      loginLink.textContent = 'লগইন / রেজিস্টার';
      loginLink.addEventListener('click', ()=>{ openAuthModal('login'); });
      authArea.appendChild(loginLink);
    }
  }

  function openAuthModal(mode){
    authModal.setAttribute('aria-hidden','false');
    if(mode==='register'){
      showRegister.classList.add('active');
      showLogin.classList.remove('active');
      registerBox.classList.remove('hidden');
      loginBox.classList.add('hidden');
    } else {
      showLogin.classList.add('active');
      showRegister.classList.remove('active');
      loginBox.classList.remove('hidden');
      registerBox.classList.add('hidden');
    }
  }
  function closeAuthModal(){ authModal.setAttribute('aria-hidden','true'); }

  modalClose.addEventListener('click', closeAuthModal);
  showLogin.addEventListener('click', ()=>openAuthModal('login'));
  showRegister.addEventListener('click', ()=>openAuthModal('register'));
  openAuthFromLock.addEventListener('click', ()=>openAuthModal('login'));

  // Register
  registerBtn.addEventListener('click', async ()=>{
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim().toLowerCase();
    const pw = document.getElementById('regPassword').value;
    const pw2 = document.getElementById('regPassword2').value;
    if(!name || !email || !pw){ alert('সব ঘর পূরণ করুন'); return; }
    if(pw !== pw2){ alert('পাসওয়ার্ড মিলছে না'); return; }
    const users = loadUsers();
    if(users.find(u=>u.email===email)){ alert('এই ইমেইলে কেউ আগে থেকেই রেজিস্টার করেছে'); return; }
    const hash = await hashPassword(pw);
    users.push({name, email, passwordHash: hash});
    saveUsers(users);
    setCurrentUserEmail(email);
    updateAuthUI();
    updateProtectedContent();
    closeAuthModal();
    renderPortfolio();
    alert('রেজিস্ট্রেশন সফল — স্বাগতম!');
  });

  // Login
  loginBtn.addEventListener('click', async ()=>{
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const pw = document.getElementById('loginPassword').value;
    if(!email || !pw){ alert('ইমেইল ও পাসওয়ার্ড দিন'); return; }
    const users = loadUsers();
    const user = users.find(u=>u.email===email);
    if(!user){ alert('ইমেইল পাওয়া যায়নি'); return; }
    const hash = await hashPassword(pw);
    if(hash !== user.passwordHash){ alert('পাসওয়ার্ড ভুল'); return; }
    setCurrentUserEmail(email);
    updateAuthUI();
    updateProtectedContent();
    closeAuthModal();
    renderPortfolio();
    alert('লগইন সফল');
  });

  // Close modal when clicking outside content
  authModal.addEventListener('click', (e)=>{ if(e.target===authModal) closeAuthModal(); });

  // Protected content toggling
  const aboutDetails = document.getElementById('aboutDetails');
  const aboutHint = document.getElementById('aboutHint');

  function updateProtectedContent(){
    const email = getCurrentUserEmail();
    if(email){
      // show portfolio content and about details
      portfolioLock.classList.add('hidden');
      portfolioContent.classList.remove('hidden');
      aboutDetails.classList.remove('hidden');
      aboutHint.classList.add('hidden');
    } else {
      // hide portfolio content and show lock
      portfolioLock.classList.remove('hidden');
      portfolioContent.classList.add('hidden');
      aboutDetails.classList.add('hidden');
      aboutHint.classList.remove('hidden');
    }
  }

  // Utils
  function escapeHtml(s){
    return String(s).replace(/[&<>\"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; });
  }
  function escapeCsv(s){
    if(typeof s !== 'string') return s;
    if(s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  }
  function parseCsv(txt){
    const lines = txt.split(/\r?\n/).filter(Boolean);
    if(lines.length<=1) return [];
    const header = lines[0].split(',').map(h=>h.trim());
    const rows = lines.slice(1).map(l => {
      const cols = l.split(',');
      const obj = {};
      header.forEach((h,i)=>{ obj[h]=cols[i] ? cols[i].trim().replace(/^"|"$/g,'') : ''; });
      return obj;
    });
    return rows;
  }

  // initial render
  updateAuthUI();
  updateProtectedContent();
  renderPortfolio();
});
