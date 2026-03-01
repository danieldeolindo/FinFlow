/* ═══════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════ */
const DEFCATS=['Alimentação','Transporte','Moradia','Saúde','Lazer','Educação','Vestuário','Tecnologia','Outros'];
const KW={
  'Alimentação':['mercado','supermercado','ifood','restaurante','comida','lanche','pizza','açougue','padaria','café'],
  'Transporte':['uber','99','combustível','gasolina','ônibus','metrô','estacionamento','passagem','taxi','posto'],
  'Moradia':['aluguel','condomínio','água','luz','energia','internet','gás','telefone'],
  'Saúde':['farmácia','médico','dentista','hospital','clínica','remédio','plano','academia'],
  'Lazer':['cinema','show','netflix','spotify','jogo','viagem','hotel','passeio'],
  'Educação':['curso','livro','escola','faculdade','apostila','udemy'],
  'Vestuário':['roupa','sapato','tênis','calça','camisa','vestido'],
  'Tecnologia':['celular','notebook','computador','tablet','fone','carregador','apple','samsung'],
};
const INV_LABELS={rf:'Renda Fixa',rv:'Renda Variável',crypto:'Cripto',other:'Outro'};
const INV_COLORS={rf:'inv-rf',rv:'inv-rv',crypto:'inv-crypto',other:'inv-other'};
const CHT_COLORS=['#2d6a4f','#40916c','#52b788','#74c69d','#95d5b2','#1b4332','#d8f3dc','#b7e4c7','#2563eb','#7c3aed','#dc2626','#d97706'];

/* ═══════════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════════ */
let S={
  expenses:[],investments:[],categories:[...DEFCATS],
  editExpId:null,editInvId:null,
  sortField:null,sortDir:1,
  period:'month',gaugeType:'ring',
  goal:null,salary:null,saveGoalPct:null,
  theme:'light',user:null,
  selectedMonth:new Date().getMonth(),   // 0-11
  selectedYear:new Date().getFullYear()
};
let charts={line:null,bar:null,pie:null,comp:null,gauge:null,invPie:null,invBar:null};

/* ═══════════════════════════════════════════════════════════
   STORAGE
═══════════════════════════════════════════════════════════ */
const sk=s=>'ff_'+(S.user?S.user.email:'g')+'_'+s;
function loadUD(){
  try{
    const raw=localStorage.getItem(sk('d'));
    if(!raw)return; // nothing saved yet, keep defaults
    const d=JSON.parse(raw);
    // Restore each field individually so a bad field doesn't wipe everything
    if(Array.isArray(d.expenses))S.expenses=d.expenses;
    if(Array.isArray(d.investments))S.investments=d.investments;
    if(Array.isArray(d.categories)&&d.categories.length)S.categories=d.categories;
    if(d.goal!=null)S.goal=d.goal;
    if(d.salary!=null)S.salary=d.salary;
    if(d.saveGoalPct!=null)S.saveGoalPct=d.saveGoalPct;
    if(d.theme)S.theme=d.theme;
    // Restore selected month/year if saved
    if(typeof d.selectedMonth==='number')S.selectedMonth=d.selectedMonth;
    if(typeof d.selectedYear==='number')S.selectedYear=d.selectedYear;
  }catch(e){
    console.warn('FinFlow: loadUD parse error',e);
    // Do NOT reset expenses/investments on parse error
  }
}
function persist(){
  try{
    localStorage.setItem(sk('d'),JSON.stringify({
      expenses:S.expenses,investments:S.investments,categories:S.categories,
      goal:S.goal,salary:S.salary,saveGoalPct:S.saveGoalPct,theme:S.theme,
      selectedMonth:S.selectedMonth,selectedYear:S.selectedYear
    }));
  }catch(e){console.warn('FinFlow: persist error',e);}
}
function getUsers(){try{return JSON.parse(localStorage.getItem('ff_users')||'{}')}catch(e){return{}}}
function saveUsers(u){localStorage.setItem('ff_users',JSON.stringify(u))}

/* ═══════════════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════════════ */
function swLoginTab(tab,el){
  $$('.ltab').forEach(t=>t.classList.remove('active'));el.classList.add('active');
  $$('.lform').forEach(f=>f.classList.remove('active'));
  $('lf-'+tab).classList.add('active');
  $('li-err').textContent='';$('re-err').textContent='';
}
function doLogin(){
  const email=$('li-email').value.trim().toLowerCase();
  const pass=$('li-pass').value;
  const err=$('li-err');
  if(!email||!pass){err.textContent='Preencha e-mail e senha.';return}
  const users=getUsers();
  if(!users[email]){err.textContent='Usuário não encontrado.';return}
  if(users[email].pw!==btoa(pass)){err.textContent='Senha incorreta.';return}
  S.user={email,name:users[email].name};
  enterApp();
}
function doRegister(){
  const name=$('re-name').value.trim();
  const email=$('re-email').value.trim().toLowerCase();
  const pass=$('re-pass').value;
  const pass2=$('re-pass2').value;
  const err=$('re-err');
  if(!name||!email||!pass||!pass2){err.textContent='Preencha todos os campos.';return}
  if(pass!==pass2){err.textContent='As senhas não coincidem.';return}
  if(pass.length<6){err.textContent='Senha deve ter ao menos 6 caracteres.';return}
  if(!/\S+@\S+\.\S+/.test(email)){err.textContent='E-mail inválido.';return}
  const users=getUsers();
  if(users[email]){err.textContent='E-mail já cadastrado.';return}
  users[email]={name,pw:btoa(pass)};saveUsers(users);
  S.user={email,name};enterApp();
}
function enterApp(){
  localStorage.setItem('ff_sess',JSON.stringify(S.user));
  loadUD();applyTheme();
  $('loginScreen').style.display='none';
  const app=$('appMain');app.style.display='flex';app.style.flexDirection='column';
  const ini=(S.user.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  $('uavatar').textContent=ini;$('uname').textContent=S.user.name||S.user.email;
  $('goalInput').value=S.goal||'';
  $('salaryInput').value=S.salary||'';
  $('saveGoalInput').value=S.saveGoalPct||'';
  fillCatSelects();genRecurring();renderMonthBar();renderTable();renderInvTable();checkAlerts();
}
function doLogout(){
  if(!confirm('Sair da conta?'))return;
  localStorage.removeItem('ff_sess');S.user=null;
  $('appMain').style.display='none';$('loginScreen').style.display='flex';
  $('li-email').value='';$('li-pass').value='';$('li-err').textContent='';
}
function checkSession(){
  try{
    const s=JSON.parse(localStorage.getItem('ff_sess')||'null');
    if(s&&s.email){S.user=s;enterApp();return}
  }catch(e){}
}

/* ═══════════════════════════════════════════════════════════
   UTILS
═══════════════════════════════════════════════════════════ */
const $=id=>document.getElementById(id);
const $$=sel=>document.querySelectorAll(sel);
const fmtR=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
const fmtD=d=>{if(!d)return'—';const[y,m,dy]=d.split('-');return`${dy}/${m}/${y}`};
const today=()=>new Date().toISOString().split('T')[0];
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2);
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function status(e){
  if(e.paid)return'paid';
  if(!e.dueDate)return'pending';
  return e.dueDate<today()?'overdue':'pending';
}
const MONTHS=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

/* ── CENTRAL MONTH FILTER ───────────────────────────────── *
 * Compara mês E ANO selecionados com as regras de recorrência:
 *
 *  recorrenciaTipo === 'nenhuma'   → só no mês/ano da dueDate
 *  recorrenciaTipo === 'infinita'  → a partir do mês/ano da dueDate (inclusive)
 *  recorrenciaTipo === 'parcelada' → de dueDate até dueDate + recorrenciaMeses - 1
 *
 * Retrocompatibilidade: aceita campos legados (recorrente/isTemplate/recurrence)
 */
function filterByMonth(arr){
  const selM=S.selectedMonth, selY=S.selectedYear;
  // ym numérico para comparação (ex: 2026*12+1 = 24313)
  const selYM=selY*12+selM;

  return arr.filter(e=>{
    // --- data de início do lançamento ---
    const dateStr=e.dueDate||e.date||'';
    const startDate=new Date(dateStr+'T00:00:00');
    const startM=startDate.getMonth();   // 0-11
    const startY=startDate.getFullYear();
    const startYM=startY*12+startM;

    // --- determinar tipo (novo campo ou legado) ---
    const tipo=e.recorrenciaTipo
      ||(e.recorrente||e.isTemplate||e.recurrence==='monthly'?'infinita':'nenhuma');

    if(tipo==='nenhuma'||tipo==='none'||!tipo){
      // Não recorrente: só aparece no mês/ano exato
      return selYM===startYM;
    }

    if(tipo==='infinita'||tipo==='monthly'){
      // Recorrente infinito: aparece a partir do mês de criação (inclusive)
      return selYM>=startYM;
    }

    if(tipo==='parcelada'){
      const meses=parseInt(e.recorrenciaMeses)||1;
      const endYM=startYM+meses-1;
      return selYM>=startYM&&selYM<=endYM;
    }

    return false;
  });
}

/* Legacy alias kept so existing callers still work */
function monthlyExpenses(){return filterByMonth(S.expenses)}

/* For dashboard periodFilter — now delegates to filterByMonth
   when period === 'month', otherwise keeps old time-range logic */
function periodFilter(arr,dateKey){
  const now=new Date();
  if(S.period==='month')return filterByMonth(arr);
  return arr.filter(e=>{
    const ref=e[dateKey]||'';
    if(S.period==='7')return(now-new Date(ref+'T00:00:00'))/86400000<=7;
    if(S.period==='30')return(now-new Date(ref+'T00:00:00'))/86400000<=30;
    return true;
  });
}

/* ── MONTH BAR ──────────────────────────────────────────── */
function renderMonthBar(){
  const bar=$('mbar'),yearEl=$('mbar-year');if(!bar)return;
  // Year navigation
  if(yearEl){
    yearEl.innerHTML=`
      <button class="mbar-year-btn" onclick="setYear(${S.selectedYear-1})" title="Ano anterior">‹</button>
      <span class="mbar-year-lbl">${S.selectedYear}</span>
      <button class="mbar-year-btn" onclick="setYear(${S.selectedYear+1})" title="Próximo ano">›</button>`;
  }
  // Month chips
  bar.innerHTML=MONTHS.map((name,i)=>`
    <button class="mchip${i===S.selectedMonth?' active':''}"
      onclick="setMonth(${i})"
      role="tab" aria-selected="${i===S.selectedMonth}"
      aria-label="${name}">${name}</button>`
  ).join('');
  setTimeout(()=>{
    const active=bar.querySelector('.mchip.active');
    if(active)active.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
  },50);
}

function setYear(y){
  if(S.selectedYear===y)return;
  S.selectedYear=y;
  _applyDateFilter();
}

function setMonth(m){
  if(S.selectedMonth===m&&S.selectedYear===S.selectedYear){}// always re-render if year changed
  S.selectedMonth=m;
  _applyDateFilter();
}

function _applyDateFilter(){
  persist(); // save selected month/year
  renderMonthBar();
  renderTable();
  checkAlerts();
  if($('tab-dashboard').classList.contains('active')){destroyAll();renderAllCharts()}
  if($('tab-metas')&&$('tab-metas').classList.contains('active'))renderMeta();
  if($('tab-score')&&$('tab-score').classList.contains('active'))renderScore();
}
function destroyAll(){Object.keys(charts).forEach(k=>{if(charts[k])charts[k].destroy();charts[k]=null})}
function clrs(n){return Array.from({length:n},(_,i)=>CHT_COLORS[i%CHT_COLORS.length])}
const isDark=()=>S.theme==='dark';
const tclr=()=>isDark()?'#8a8a7e':'#6b6660';
const gclr=()=>isDark()?'#2d3329':'#f0ede8';

/* ═══════════════════════════════════════════════════════════
   THEME
═══════════════════════════════════════════════════════════ */
function toggleTheme(){
  S.theme=S.theme==='light'?'dark':'light';
  applyTheme();
  if(S.user){persist();setTimeout(()=>{destroyAll();renderAllCharts()},300)}
}
function applyTheme(){
  document.documentElement.setAttribute('data-theme',S.theme);
  const sw=$('tsw');if(sw){S.theme==='dark'?sw.classList.add('on'):sw.classList.remove('on')}
  const lbl=$('ltheme-lbl');if(lbl)lbl.textContent=S.theme==='dark'?'☀️ Modo claro':'🌙 Modo escuro';
}

/* ═══════════════════════════════════════════════════════════
   SIDEBAR / TABS
═══════════════════════════════════════════════════════════ */
const openSB=()=>{$('sidebar').classList.add('open');$('obg').classList.add('open')};
const closeSB=()=>{$('sidebar').classList.remove('open');$('obg').classList.remove('open')};
const TITLES={lancamentos:'Lançamentos',dashboard:'Dashboard',investimentos:'Investimentos',metas:'Metas Financeiras',score:'Score Financeiro'};
function goTab(tab,el){
  $$('.tab-view').forEach(t=>t.classList.remove('active'));
  $('tab-'+tab).classList.add('active');
  $$('.nitem').forEach(n=>n.classList.remove('active'));
  el.classList.add('active');
  $('ptitle').textContent=TITLES[tab]||tab;
  closeSB();
  // topAddBtn: only show on lançamentos tab
  const addBtn=$('topAddBtn');
  if(tab==='lancamentos'){addBtn.style.display='';addBtn.textContent='+ Novo gasto';addBtn.onclick=openModal}
  else addBtn.style.display='none';
  if(tab==='dashboard'){destroyAll();renderAllCharts()}
  if(tab==='investimentos'){renderInvTable();renderInvCharts()}
  if(tab==='metas'){renderMeta()}
  if(tab==='score')renderScore();
}

/* ═══════════════════════════════════════════════════════════
   MODALS
═══════════════════════════════════════════════════════════ */
function openModal(expId){
  closeAllDD();
  S.editExpId=expId||null;
  $('mexp-title').textContent=expId?'Editar Lançamento':'Novo Lançamento';
  fillCatSelects();
  if(expId){
    const e=S.expenses.find(x=>x.id===expId);
    if(e){
      $('inp-name').value=e.name;
      setTimeout(()=>{$('inp-cat').value=e.category},0);
      $('inp-val').value=e.amount;
      $('inp-due').value=e.dueDate||'';
      $('inp-color').value=e.color||'#2d6a4f';
      // Load recurrence: prefer new field, fall back to legacy
      const tipo=e.recorrenciaTipo||(e.recorrente||e.isTemplate||e.recurrence==='monthly'?'infinita':'nenhuma');
      $('inp-rec').value=tipo;
      if(tipo==='parcelada'){
        $('fg-parcelas').style.display='';
        $('inp-parcelas').value=e.recorrenciaMeses||'';
      }else{
        $('fg-parcelas').style.display='none';
        $('inp-parcelas').value='';
      }
    }
  }else{
    $('inp-name').value='';$('inp-cat').value='';$('inp-val').value='';
    $('inp-due').value=today();$('inp-color').value='#2d6a4f';
    $('inp-rec').value='nenhuma';$('inp-parcelas').value='';
    $('fg-parcelas').style.display='none';
    $('cat-sugg').innerHTML='';
  }
  $('mov-exp').classList.add('open');
  setTimeout(()=>$('inp-name').focus(),50);
}
function openInvModal(invId){
  closeAllDD();
  S.editInvId=invId||null;
  $('minv-title').textContent=invId?'Editar Investimento':'Novo Investimento';
  if(invId){
    const i=S.investments.find(x=>x.id===invId);
    if(i){
      $('inv-name').value=i.name;$('inv-type').value=i.type;
      $('inv-val').value=i.amount;$('inv-rent').value=i.rent||'';
      $('inv-date').value=i.date||'';$('inv-color').value=i.color||'#2563eb';
    }
  }else{
    $('inv-name').value='';$('inv-type').value='rf';
    $('inv-val').value='';$('inv-rent').value='';
    $('inv-date').value=today();$('inv-color').value='#2563eb';
  }
  $('mov-inv').classList.add('open');
  setTimeout(()=>$('inv-name').focus(),50);
}
function closeModal(id){$(id).classList.remove('open')}
function openExport(){closeAllDD();$('mov-exp-modal').classList.add('open')}

/* ═══════════════════════════════════════════════════════════
   CATEGORIES
═══════════════════════════════════════════════════════════ */
function fillCatSelects(){
  ['inp-cat','fCat'].forEach(sid=>{
    // Don't rebuild inp-cat while the expense modal is open (would reset selected value)
    if(sid==='inp-cat'&&$('mov-exp').classList.contains('open'))return;
    const sel=$(sid);if(!sel)return;
    const val=sel.value;
    sel.innerHTML=sid==='inp-cat'?'<option value="">Selecionar...</option>':'<option value="">Categorias</option>';
    S.categories.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;sel.appendChild(o)});
    if(sid==='inp-cat'){const o=document.createElement('option');o.value='__new__';o.textContent='+ Nova categoria';sel.appendChild(o)}
    try{sel.value=val}catch(_){}
  });
}
$('inp-cat').addEventListener('change',function(){if(this.value==='__new__'){this.value='';$('mov-cat').classList.add('open');$('new-cat').value='';$('new-cat').focus()}});
function addCat(){
  const n=$('new-cat').value.trim();if(!n)return;
  if(!S.categories.includes(n)){S.categories.push(n);persist()}
  // Rebuild inp-cat directly (ignores the "modal open" guard in fillCatSelects)
  // so the new category appears and is selected immediately
  const sel=$('inp-cat');
  if(sel){
    const cur=sel.value;
    sel.innerHTML='<option value="">Selecionar...</option>';
    S.categories.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;sel.appendChild(o)});
    sel.appendChild(Object.assign(document.createElement('option'),{value:'__new__',textContent:'+ Nova categoria'}));
    sel.value=n; // select the new category
  }
  fillCatSelects(); // update fCat filter dropdown
  closeModal('mov-cat');
}

/* ═══════════════════════════════════════════════════════════
   KEYWORD SUGGEST
═══════════════════════════════════════════════════════════ */
function onNameInput(){
  const n=$('inp-name').value.toLowerCase();
  const el=$('cat-sugg');
  if(!n){el.innerHTML='';return}
  for(const[cat,kws]of Object.entries(KW)){
    if(kws.some(k=>n.includes(k))){
      el.innerHTML=`<span class="sugg" onclick="applySugg('${cat}')">💡 ${cat}</span>`;return;
    }
  }
  el.innerHTML='';
}
function applySugg(cat){$('inp-cat').value=cat;$('cat-sugg').innerHTML=''}

/* ═══════════════════════════════════════════════════════════
   RECURRING
═══════════════════════════════════════════════════════════ */
/* genRecurring — desativada. O novo sistema de recorrência usa filterByMonth
   para exibir lançamentos recorrentes em todos os meses relevantes sem criar
   cópias no array. Mantida como stub para não quebrar chamadas existentes. */
function genRecurring(){
  // No-op: filtragem por mês agora é feita em filterByMonth()
}

/* ── Mostra/oculta campo de parcelas conforme tipo selecionado */
function onRecChange(){
  const v=$('inp-rec').value;
  $('fg-parcelas').style.display=v==='parcelada'?'':'none';
  if(v==='parcelada')$('inp-parcelas').focus();
}

/* ═══════════════════════════════════════════════════════════
   SAVE EXPENSE
═══════════════════════════════════════════════════════════ */
function saveExpense(){
  const name=$('inp-name').value.trim();
  const category=$('inp-cat').value;
  const amount=parseFloat($('inp-val').value);
  const dueDate=$('inp-due').value;
  const color=$('inp-color').value||'#2d6a4f';
  const recorrenciaTipo=$('inp-rec').value||'nenhuma';
  const recorrenciaMeses=recorrenciaTipo==='parcelada'?parseInt($('inp-parcelas').value)||0:null;

  // Validation
  if(!name){alert('Informe o nome do gasto.');$('inp-name').focus();return}
  if(!category||category===''||category==='__new__'){alert('Selecione uma categoria.');$('inp-cat').focus();return}
  if(!dueDate){alert('Informe a data de vencimento.');$('inp-due').focus();return}
  if(isNaN(amount)||amount<=0){alert('Informe um valor válido maior que zero.');$('inp-val').focus();return}
  if(recorrenciaTipo==='parcelada'&&(!recorrenciaMeses||recorrenciaMeses<2)){
    alert('Informe o número de parcelas (mínimo 2).');$('inp-parcelas').focus();return
  }

  // Calcular dataFinal para parceladas
  let dataFinal=null;
  if(recorrenciaTipo==='parcelada'&&recorrenciaMeses){
    const d=new Date(dueDate+'T00:00:00');
    d.setMonth(d.getMonth()+recorrenciaMeses-1);
    dataFinal=d.toISOString().split('T')[0];
  }

  // Campos legados mantidos para retrocompatibilidade
  const recorrente=recorrenciaTipo==='infinita';
  const isTemplate=recorrente;
  const recurrence=recorrenciaTipo==='infinita'?'monthly':'none';

  const payload={
    name,category,amount,dueDate,color,date:dueDate,
    recorrenciaTipo,recorrenciaMeses,dataFinal,
    recorrente,isTemplate,recurrence  // legado
  };

  if(S.editExpId){
    const idx=S.expenses.findIndex(x=>x.id===S.editExpId);
    if(idx!==-1)S.expenses[idx]={...S.expenses[idx],...payload};
    S.editExpId=null;
  }else{
    S.expenses.push({id:uid(),paid:false,templateId:null,...payload});
  }

  persist();

  // Fecha modal e reseta formulário
  $('mov-exp').classList.remove('open');
  $('inp-name').value='';$('inp-cat').value='';$('inp-val').value='';
  $('inp-due').value='';$('inp-color').value='#2d6a4f';
  $('inp-rec').value='nenhuma';$('inp-parcelas').value='';
  $('fg-parcelas').style.display='none';
  $('cat-sugg').innerHTML='';

  renderTable();checkAlerts();
  if($('tab-dashboard').classList.contains('active')){destroyAll();renderAllCharts()}
}

/* ═══════════════════════════════════════════════════════════
   DROPDOWN MENU CONTROLLER
═══════════════════════════════════════════════════════════ */
let _openDD=null; // currently open dropdown menu element

function positionDD(btn,menu){
  const br=btn.getBoundingClientRect();
  const vw=window.innerWidth,vh=window.innerHeight;
  // Default: open below-right aligned
  let top=br.bottom+4,left=br.right-menu.offsetWidth;
  if(left<6)left=6;
  if(left+menu.offsetWidth>vw-6)left=vw-menu.offsetWidth-6;
  if(top+menu.offsetHeight>vh-10){
    // flip up
    top=br.top-menu.offsetHeight-4;
  }
  menu.style.top=top+'px';
  menu.style.left=left+'px';
}

function openDD(btn){
  const menu=btn.nextElementSibling;
  if(!menu||!menu.classList.contains('ddmenu'))return;
  // close any other open dropdown first
  if(_openDD&&_openDD!==menu){closeAllDD()}
  const isOpen=menu.classList.contains('open');
  if(isOpen){closeAllDD();return}
  menu.classList.add('open');
  btn.setAttribute('aria-expanded','true');
  _openDD=menu;
  positionDD(btn,menu);
  // Focus first item for keyboard nav
  const first=menu.querySelector('.dditem');
  if(first)setTimeout(()=>first.focus(),50);
}

function closeAllDD(){
  if(_openDD){
    _openDD.classList.remove('open');
    const btn=_openDD.previousElementSibling;
    if(btn)btn.setAttribute('aria-expanded','false');
    _openDD=null;
  }
}

// Close on outside click — skip if clicking inside a ddwrap OR a ddmenu item
document.addEventListener('click',e=>{
  if(!_openDD)return;
  if(e.target.closest('.ddwrap')||e.target.closest('.ddmenu'))return;
  closeAllDD();
},{capture:true});

// Close on Escape key (merged with modal handler below)
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeAllDD();}
  // Arrow key navigation inside open dropdown
  if(!_openDD)return;
  const items=[..._openDD.querySelectorAll('.dditem')];
  if(!items.length)return;
  const focused=document.activeElement;
  const idx=items.indexOf(focused);
  if(e.key==='ArrowDown'){e.preventDefault();items[Math.min(idx+1,items.length-1)].focus()}
  else if(e.key==='ArrowUp'){e.preventDefault();items[Math.max(idx-1,0)].focus()}
  else if(e.key==='Tab'){closeAllDD()}
});

/* ═══════════════════════════════════════════════════════════
   EXPENSE ACTIONS  ← EVENT DELEGATION
═══════════════════════════════════════════════════════════ */
function markPaid(id){
  const i=S.expenses.findIndex(x=>x.id===id);
  if(i!==-1){S.expenses[i].paid=!S.expenses[i].paid;persist();renderTable();checkAlerts()}
}
function delExp(id){
  if(!confirm('Excluir este lançamento?'))return;
  S.expenses=S.expenses.filter(e=>e.id!==id);
  persist();renderTable();checkAlerts();
  if($('tab-dashboard').classList.contains('active')){destroyAll();renderAllCharts()}
}
// Safe delegation — handles desktop tbody AND mobile card list
function _expAction(e){
  const btn=e.target.closest('[data-act]');if(!btn)return;
  const{act,id}=btn.dataset;
  if(act==='opts'){openDD(btn);return}
  closeAllDD();
  if(act==='pay')markPaid(id);
  else if(act==='edit')openModal(id);
  else if(act==='del')delExp(id);
}
// Delegação global — captura cliques em tbody, mcard-exp E ddmenu flutuante
document.addEventListener('click',e=>{
  const btn=e.target.closest('[data-act]');if(!btn)return;
  const{act}=btn.dataset;
  // Só processa ações de lançamento
  const expActs=['opts','pay','edit','del'];
  const invActs=['opts-inv','edit-inv','del-inv'];
  if(expActs.includes(act))_expAction(e);
  else if(invActs.includes(act))_invAction(e);
});

/* ═══════════════════════════════════════════════════════════
   RENDER EXPENSE TABLE
═══════════════════════════════════════════════════════════ */
function sortBy(f){
  if(S.sortField===f)S.sortDir*=-1;else{S.sortField=f;S.sortDir=1}
  $('fSort').value='';renderTable();
}
function renderTable(){
  const srch=$('srch').value.toLowerCase();
  const cat=$('fCat').value;
  const sf=$('fStatus').value;
  const so=$('fSort').value;
  // Month filter is primary — then apply UI filters on top
  let list=filterByMonth(S.expenses);
  if(srch)list=list.filter(e=>e.name.toLowerCase().includes(srch));
  if(cat)list=list.filter(e=>e.category===cat);
  if(sf)list=list.filter(e=>status(e)===sf);
  if(so){
    const[f,d]=so.split('-');
    list.sort((a,b)=>f==='val'?(d==='d'?b.amount-a.amount:a.amount-b.amount):(d==='a'?(a.dueDate||'').localeCompare(b.dueDate||''):(b.dueDate||'').localeCompare(a.dueDate||'')));
  }else if(S.sortField){
    list.sort((a,b)=>{
      if(S.sortField==='name')return S.sortDir*a.name.localeCompare(b.name);
      if(S.sortField==='amount')return S.sortDir*(a.amount-b.amount);
      if(S.sortField==='due')return S.sortDir*(a.dueDate||'').localeCompare(b.dueDate||'');
      return 0;
    });
  }else{
    const ord={overdue:0,pending:1,paid:2};
    list.sort((a,b)=>{const sa=status(a),sb=status(b);return ord[sa]!==ord[sb]?ord[sa]-ord[sb]:(a.dueDate||'').localeCompare(b.dueDate||'')});
  }
  const tbody=$('tbody'),empty=$('empty-exp'),mcardList=$('mcard-exp');
  if(!list.length){
    tbody.innerHTML='';
    if(mcardList)mcardList.innerHTML='';
    empty.style.display='';
    fillCatSelects();return
  }
  empty.style.display='none';
  const rows=list.map(e=>{
    const st=status(e);
    const rc=st==='overdue'?'tr-overdue':st==='paid'?'tr-paid':'';
    const ac=st==='overdue'?'amt amt-overdue':st==='paid'?'amt amt-paid':'amt';
    const badge=st==='paid'?'<span class="sbadge s-paid">✅ Pago</span>':st==='overdue'?'<span class="sbadge s-overdue">🔴 Vencido</span>':'<span class="sbadge s-pending">🕐 Pendente</span>';
    const tipo=e.recorrenciaTipo||(e.recorrente||e.isTemplate?'infinita':'nenhuma');
    const recBadge=tipo==='infinita'
      ?'<span style="font-size:10px;color:var(--accent);font-weight:600;margin-left:4px" title="Recorrente mensal">🔁</span>'
      :tipo==='parcelada'
        ?`<span style="font-size:10px;color:#7c3aed;font-weight:600;margin-left:4px" title="Parcelado em ${e.recorrenciaMeses}x">📦${e.recorrenciaMeses}x</span>`
        :'';
    const dot=`<span class="name-dot" style="background:${e.color||'#2d6a4f'}"></span>`;
    const payItem=e.paid
      ?`<button class="dditem dditem-undo" data-act="pay" data-id="${e.id}">↩ Desfazer pagamento</button>`
      :`<button class="dditem dditem-pay" data-act="pay" data-id="${e.id}">✅ Pagar</button>`;
    const ddMenu=`<div class="ddwrap">
          <button class="ddbtn" data-act="opts" data-id="${e.id}" aria-haspopup="true" aria-expanded="false">Opções</button>
          <div class="ddmenu" role="menu">
            ${payItem}
            <div class="ddsep"></div>
            <button class="dditem dditem-edit" data-act="edit" data-id="${e.id}" role="menuitem">✏️ Editar</button>
            <button class="dditem dditem-del" data-act="del" data-id="${e.id}" role="menuitem">🗑️ Excluir</button>
          </div>
        </div>`;
    return{e,st,rc,ac,badge,recBadge,dot,payItem,ddMenu};
  });
  // Desktop table
  tbody.innerHTML=rows.map(({e,st,rc,ac,badge,recBadge,dot,ddMenu})=>`<tr class="${rc}">
      <td style="color:${e.color||'inherit'};font-weight:500">${dot}${esc(e.name)}${recBadge}</td>
      <td><span class="cbadge">${esc(e.category)}</span></td>
      <td class="${ac}">${fmtR(e.amount)}</td>
      <td style="color:${st==='overdue'?'var(--red)':st==='paid'?'var(--green)':'var(--muted)'};font-weight:${st!=='pending'?600:400}">${fmtD(e.dueDate)}</td>
      <td>${badge}</td>
      <td>${ddMenu}</td>
    </tr>`).join('');
  // Mobile cards
  if(mcardList){
    mcardList.innerHTML=rows.map(({e,st,badge,recBadge,dot,ddMenu})=>`
      <div class="mcard${st==='overdue'?' mc-overdue':st==='paid'?' mc-paid':''}">
        <div class="mcard-top">
          <div class="mcard-name">${dot}<span style="color:${e.color||'inherit'}">${esc(e.name)}</span>${recBadge}</div>
          ${ddMenu}
        </div>
        <div class="mcard-body">
          <div class="mcard-cell"><span class="mcard-lbl">Categoria</span><span class="mcard-val"><span class="cbadge">${esc(e.category)}</span></span></div>
          <div class="mcard-cell"><span class="mcard-lbl">Valor</span><span class="mcard-val ${st==='overdue'?'amt-overdue':st==='paid'?'amt-paid':''}" style="font-weight:600">${fmtR(e.amount)}</span></div>
          <div class="mcard-cell"><span class="mcard-lbl">Vencimento</span><span class="mcard-val" style="color:${st==='overdue'?'var(--red)':st==='paid'?'var(--green)':'var(--muted)'};font-weight:${st!=='pending'?600:400}">${fmtD(e.dueDate)}</span></div>
          <div class="mcard-cell"><span class="mcard-lbl">Status</span><span class="mcard-val">${badge}</span></div>
        </div>
      </div>`).join('');
  }
  fillCatSelects();
}

/* ═══════════════════════════════════════════════════════════
   INVESTMENT ACTIONS
═══════════════════════════════════════════════════════════ */
function saveInvestment(){
  const name=$('inv-name').value.trim();
  const type=$('inv-type').value;
  const amount=parseFloat($('inv-val').value);
  const rent=parseFloat($('inv-rent').value)||0;
  const date=$('inv-date').value;
  const color=$('inv-color').value||'#2563eb';

  // Validation with specific messages
  if(!name){alert('Informe o nome do investimento.');$('inv-name').focus();return}
  if(!date){alert('Informe a data do investimento.');$('inv-date').focus();return}
  if(isNaN(amount)||amount<=0){alert('Informe um valor válido maior que zero.');$('inv-val').focus();return}

  if(S.editInvId){
    const idx=S.investments.findIndex(x=>x.id===S.editInvId);
    if(idx!==-1)S.investments[idx]={...S.investments[idx],name,type,amount,rent,date,color};
    S.editInvId=null;
  }else{
    S.investments.push({id:uid(),name,type,amount,rent,date,color});
  }

  persist();

  // Close modal and reset form immediately after persist
  $('mov-inv').classList.remove('open');
  $('inv-name').value='';
  $('inv-type').value='rf';
  $('inv-val').value='';
  $('inv-rent').value='';
  $('inv-date').value=today();
  $('inv-color').value='#2563eb';

  // Re-render after modal is closed
  renderInvTable();
  renderInvCharts();
  if($('tab-dashboard').classList.contains('active')){destroyAll();renderAllCharts()}
}
function delInv(id){
  if(!confirm('Excluir investimento?'))return;
  S.investments=S.investments.filter(i=>i.id!==id);
  persist();renderInvTable();renderInvCharts();
  if($('tab-dashboard').classList.contains('active')){destroyAll();renderAllCharts()}
}
function _invAction(e){
  const btn=e.target.closest('[data-act]');if(!btn)return;
  const{act,id}=btn.dataset;
  if(act==='opts-inv'){openDD(btn);return}
  closeAllDD();
  if(act==='edit-inv')openInvModal(id);
  else if(act==='del-inv')delInv(id);
}
// Delegação de investimentos tratada pelo listener global em _expAction/_invAction acima

/* ═══════════════════════════════════════════════════════════
   RENDER INVESTMENT TABLE & CARDS
═══════════════════════════════════════════════════════════ */
function renderInvTable(){
  const total=S.investments.reduce((s,i)=>s+i.amount,0);
  const totalNow=S.investments.reduce((s,i)=>{const yrs=calcYears(i.date);return s+i.amount*(1+i.rent/100*yrs)},0);
  const profit=totalNow-total;
  $('inv-sgrid').innerHTML=`
    <div class="card scard"><div class="sico2">💼</div><div class="slabel">Total investido</div><div class="sval blue">${fmtR(total)}</div><div class="ssub">${S.investments.length} ativos</div></div>
    <div class="card scard"><div class="sico2">📈</div><div class="slabel">Valor atual estimado</div><div class="sval green">${fmtR(totalNow)}</div><div class="ssub">estimativa</div></div>
    <div class="card scard"><div class="sico2">${profit>=0?'🟢':'🔴'}</div><div class="slabel">Rentabilidade total</div><div class="sval ${profit>=0?'green':'red'}">${fmtR(profit)}</div><div class="ssub">${total>0?((profit/total)*100).toFixed(1)+'%':'—'}</div></div>
    <div class="card scard"><div class="sico2">🏦</div><div class="slabel">Patrimônio total</div><div class="sval">${fmtR(totalNow+S.expenses.filter(e=>!e.paid).reduce((_,__)=>_,0))}</div><div class="ssub">invest. + não pagos</div></div>`;
  const tbody=$('inv-tbody'),empty=$('empty-inv'),mcardInv=$('mcard-inv');
  if(!S.investments.length){
    tbody.innerHTML='';
    if(mcardInv)mcardInv.innerHTML='';
    empty.style.display='';return
  }
  empty.style.display='none';
  const rows=S.investments.map(i=>{
    const now=i.amount*(1+(i.rent/100)*calcYears(i.date));
    const prof=now-i.amount;
    const tc=INV_COLORS[i.type]||'inv-other';
    const dot=`<span class="name-dot" style="background:${i.color||'#2563eb'}"></span>`;
    const ddMenu=`<div class="ddwrap">
          <button class="ddbtn" data-act="opts-inv" data-id="${i.id}" aria-haspopup="true" aria-expanded="false">Opções</button>
          <div class="ddmenu" role="menu">
            <button class="dditem dditem-edit" data-act="edit-inv" data-id="${i.id}" role="menuitem">✏️ Editar</button>
            <div class="ddsep"></div>
            <button class="dditem dditem-del" data-act="del-inv" data-id="${i.id}" role="menuitem">🗑️ Excluir</button>
          </div>
        </div>`;
    return{i,now,prof,tc,dot,ddMenu};
  });
  // Desktop table
  tbody.innerHTML=rows.map(({i,now,prof,tc,dot,ddMenu})=>`<tr>
      <td style="font-weight:500;color:${i.color||'inherit'}">${dot}${esc(i.name)}</td>
      <td><span class="inv-type-badge ${tc}">${INV_LABELS[i.type]||i.type}</span></td>
      <td class="amt">${fmtR(i.amount)}</td>
      <td style="color:var(--muted)">${i.rent?i.rent+'%/a':'—'}</td>
      <td class="${prof>=0?'inv-profit':'inv-loss'}">${fmtR(now)} <small>(${prof>=0?'+':''}${fmtR(prof)})</small></td>
      <td style="color:var(--muted)">${fmtD(i.date)}</td>
      <td>${ddMenu}</td>
    </tr>`).join('');
  // Mobile cards
  if(mcardInv){
    mcardInv.innerHTML=rows.map(({i,now,prof,tc,dot,ddMenu})=>`
      <div class="mcard">
        <div class="mcard-top">
          <div class="mcard-name">${dot}<span style="color:${i.color||'inherit'}">${esc(i.name)}</span><span class="inv-type-badge ${tc}" style="margin-left:4px">${INV_LABELS[i.type]||i.type}</span></div>
          ${ddMenu}
        </div>
        <div class="mcard-body">
          <div class="mcard-cell"><span class="mcard-lbl">Investido</span><span class="mcard-val amt">${fmtR(i.amount)}</span></div>
          <div class="mcard-cell"><span class="mcard-lbl">Rentab.</span><span class="mcard-val">${i.rent?i.rent+'%/a':'—'}</span></div>
          <div class="mcard-cell"><span class="mcard-lbl">Valor atual</span><span class="mcard-val ${prof>=0?'inv-profit':'inv-loss'}">${fmtR(now)}</span></div>
          <div class="mcard-cell"><span class="mcard-lbl">Lucro/Perda</span><span class="mcard-val ${prof>=0?'inv-profit':'inv-loss'}">${prof>=0?'+':''}${fmtR(prof)}</span></div>
          <div class="mcard-cell"><span class="mcard-lbl">Data</span><span class="mcard-val" style="color:var(--muted)">${fmtD(i.date)}</span></div>
        </div>
      </div>`).join('');
  }
}
function calcYears(dateStr){
  if(!dateStr)return 0;
  return Math.max(0,(new Date()-new Date(dateStr+'T00:00:00'))/(365.25*24*3600*1000));
}

/* ═══════════════════════════════════════════════════════════
   INVESTMENT CHARTS
═══════════════════════════════════════════════════════════ */
function renderInvCharts(){
  if(charts.invPie){charts.invPie.destroy();charts.invPie=null}
  if(charts.invBar){charts.invBar.destroy();charts.invBar=null}
  // pie by type — use custom colors per investment
  const byType={};const byTypeColors={};
  S.investments.forEach(i=>{
    const lbl=INV_LABELS[i.type]||i.type;
    byType[lbl]=(byType[lbl]||0)+i.amount;
    if(!byTypeColors[lbl])byTypeColors[lbl]=i.color||CHT_COLORS[Object.keys(byType).length%CHT_COLORS.length];
  });
  const ptx=document.getElementById('invPieChart');
  if(ptx&&Object.keys(byType).length){
    charts.invPie=new Chart(ptx,{type:'doughnut',data:{labels:Object.keys(byType),datasets:[{data:Object.values(byType),backgroundColor:Object.keys(byType).map(k=>byTypeColors[k]),borderWidth:2,borderColor:isDark()?'#181c17':'#fff'}]},options:{responsive:true,maintainAspectRatio:false,cutout:'58%',plugins:{legend:{position:'bottom',labels:{color:tclr(),font:{family:'DM Sans',size:11},boxWidth:11,padding:9}}}}});
  }
  // bar rentability — use custom colors per investment
  const sorted=[...S.investments].sort((a,b)=>b.rent-a.rent);
  const btx=document.getElementById('invBarChart');
  if(btx&&sorted.length){
    charts.invBar=new Chart(btx,{type:'bar',data:{labels:sorted.map(i=>i.name),datasets:[{label:'Rentab. %/a',data:sorted.map(i=>i.rent||0),backgroundColor:sorted.map(i=>i.color||'#2563eb'),borderRadius:5,borderSkipped:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:tclr(),font:{family:'DM Sans',size:11}}},y:{grid:{color:gclr()},ticks:{color:tclr(),font:{family:'DM Sans',size:11},callback:v=>v+'%'}}}}});
  }
}

/* ═══════════════════════════════════════════════════════════
   DASHBOARD CHARTS
═══════════════════════════════════════════════════════════ */
function setPeriod(p,el){
  S.period=p;$$('.ppill').forEach(x=>x.classList.remove('active'));el.classList.add('active');
  destroyAll();renderAllCharts();
}
function setGaugeType(t,el){
  S.gaugeType=t;$$('.gpill').forEach(x=>x.classList.remove('active'));el.classList.add('active');
  renderGauge();
}
function renderAllCharts(){
  const paid=periodFilter(S.expenses,'dueDate').filter(e=>e.paid);
  const all=periodFilter(S.expenses,'dueDate');
  renderStats(all,paid);
  renderBarChart(paid);
  renderPieChart(paid);
  renderLineChart(paid);
  renderCompChart();
  renderGauge();
}
function renderStats(all,paid){
  const total=paid.reduce((s,e)=>s+e.amount,0);
  const bycat={};paid.forEach(e=>{bycat[e.category]=(bycat[e.category]||0)+e.amount});
  const maxV=paid.length?Math.max(...paid.map(e=>e.amount)):0;
  const maxN=paid.length?(paid.find(e=>e.amount===maxV)||{}).name||'—':'—';
  // Overdue from filtered month (recorrentes included)
  const ov=filterByMonth(S.expenses).filter(e=>status(e)==='overdue');
  const totalInv=S.investments.reduce((s,i)=>s+i.amount,0);
  $('sgrid').innerHTML=`
    <div class="card scard"><div class="sico2">💰</div><div class="slabel">Total pago</div><div class="sval green">${fmtR(total)}</div><div class="ssub">${paid.length} lançamentos</div></div>
    <div class="card scard"><div class="sico2">🔴</div><div class="slabel">Em atraso</div><div class="sval red">${fmtR(ov.reduce((s,e)=>s+e.amount,0))}</div><div class="ssub">${ov.length} vencidos</div></div>
    <div class="card scard"><div class="sico2">🔝</div><div class="slabel">Maior gasto</div><div class="sval" style="font-size:18px">${fmtR(maxV)}</div><div class="ssub">${maxN}</div></div>
    <div class="card scard"><div class="sico2">📈</div><div class="slabel">Total investido</div><div class="sval blue">${fmtR(totalInv)}</div><div class="ssub">${S.investments.length} ativos</div></div>`;
}
function renderBarChart(expenses){
  const by={};expenses.forEach(e=>{by[e.category]=(by[e.category]||0)+e.amount});
  const s=Object.entries(by).sort((a,b)=>b[1]-a[1]);
  const ctx=document.getElementById('barChart');if(!ctx||!s.length)return;
  charts.bar=new Chart(ctx,{type:'bar',data:{labels:s.map(x=>x[0]),datasets:[{data:s.map(x=>x[1]),backgroundColor:clrs(s.length),borderRadius:5,borderSkipped:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:tclr(),font:{family:'DM Sans',size:11}}},y:{grid:{color:gclr()},ticks:{color:tclr(),font:{family:'DM Sans',size:11},callback:v=>'R$'+v.toLocaleString('pt-BR')}}}}});
}
function renderPieChart(expenses){
  const by={};expenses.forEach(e=>{by[e.category]=(by[e.category]||0)+e.amount});
  const entries=Object.entries(by).sort((a,b)=>b[1]-a[1]);
  const ctx=document.getElementById('pieChart');if(!ctx||!entries.length)return;
  // Use horizontal bar instead of doughnut to avoid infinite resize loop
  charts.pie=new Chart(ctx,{type:'bar',data:{labels:entries.map(x=>x[0]),datasets:[{data:entries.map(x=>x[1]),backgroundColor:clrs(entries.length),borderRadius:5,borderSkipped:false}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>{const total=entries.reduce((s,x)=>s+x[1],0);return fmtR(ctx.raw)+' ('+((ctx.raw/total)*100).toFixed(1)+'%)';}}}},scales:{x:{grid:{color:gclr()},ticks:{color:tclr(),font:{family:'DM Sans',size:11},callback:v=>'R$'+v.toLocaleString('pt-BR')}},y:{grid:{display:false},ticks:{color:tclr(),font:{family:'DM Sans',size:11}}}}}});
}
function renderLineChart(expenses){
  const by={};expenses.forEach(e=>{const d=e.dueDate||e.date;by[d]=(by[d]||0)+e.amount});
  const days=Object.keys(by).sort();let cum=0;
  const ctx=document.getElementById('lineChart');if(!ctx||!days.length)return;
  const g=ctx.getContext('2d').createLinearGradient(0,0,0,180);
  g.addColorStop(0,'rgba(82,183,136,.3)');g.addColorStop(1,'rgba(82,183,136,0)');
  charts.line=new Chart(ctx,{type:'line',data:{labels:days.map(fmtD),datasets:[{label:'Acumulado',data:days.map(d=>{cum+=by[d];return cum}),borderColor:'#52b788',backgroundColor:g,fill:true,tension:.4,pointRadius:3,pointBackgroundColor:'#52b788'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:tclr(),font:{family:'DM Sans',size:11},maxRotation:30}},y:{grid:{color:gclr()},ticks:{color:tclr(),font:{family:'DM Sans',size:11},callback:v=>'R$'+v.toLocaleString('pt-BR')}}}}});
}
function renderCompChart(){
  const me=filterByMonth(S.expenses).filter(e=>e.paid).reduce((s,e)=>s+e.amount,0);
  const mi=S.investments.reduce((s,i)=>s+i.amount,0);
  const mLabel=MONTHS[S.selectedMonth];
  const ctx=document.getElementById('compChart');if(!ctx)return;
  charts.comp=new Chart(ctx,{type:'bar',data:{labels:[mLabel+': Gastos','Total: Investimentos'],datasets:[{data:[me,mi],backgroundColor:['rgba(220,38,38,.8)','rgba(37,99,235,.8)'],borderRadius:8,borderSkipped:false}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{grid:{color:gclr()},ticks:{color:tclr(),font:{family:'DM Sans',size:11},callback:v=>'R$'+v.toLocaleString('pt-BR')}},y:{grid:{display:false},ticks:{color:tclr(),font:{family:'DM Sans',size:12}}}}}});
}

/* ═══ SALARY GAUGE ══════════════════════════════════════ */
function renderGauge(){
  const me=monthlyExpenses().filter(e=>e.paid).reduce((s,e)=>s+e.amount,0);
  const salary=S.salary||0;
  const pct=salary>0?Math.min((me/salary)*100,100):0;
  const color=pct>=80?'var(--red)':pct>=50?'var(--yellow)':'var(--green)';
  const label=pct>=80?'🔴 Estado crítico':pct>=50?'🟡 Alerta moderado':'🟢 Normal';
  // destroy previous gauge chart
  if(charts.gauge){charts.gauge.destroy();charts.gauge=null}
  const wrap=$('gaugePieWrap');
  if(wrap)wrap.style.display='none';
  if(!salary){
    $('gaugeContent').innerHTML=`<div style="text-align:center;color:var(--muted);font-size:13px;padding:20px">Configure o salário em "Metas" para ver este gráfico</div>`;
    return;
  }
  if(S.gaugeType==='ring'){
    $('gaugeContent').innerHTML=`
      <div style="position:relative;width:130px;height:130px;margin:0 auto 12px;flex-shrink:0">
        <svg width="130" height="130" viewBox="0 0 130 130" style="transform:rotate(-90deg)">
          <circle cx="65" cy="65" r="55" fill="none" stroke="var(--border)" stroke-width="13"/>
          <circle cx="65" cy="65" r="55" fill="none" stroke="${color}" stroke-width="13"
            stroke-dasharray="${2*Math.PI*55}" stroke-dashoffset="${2*Math.PI*55*(1-pct/100)}" stroke-linecap="round"
            style="transition:stroke-dashoffset .7s ease"/>
        </svg>
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
          <div style="font-family:'DM Serif Display',serif;font-size:26px;color:${color}">${pct.toFixed(0)}%</div>
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px">do salário</div>
        </div>
      </div>
      <div style="font-size:13px;font-weight:600;color:${color};text-align:center;margin-bottom:8px">${label}</div>
      <div style="text-align:center;font-size:12px;color:var(--muted)">${fmtR(me)} de ${fmtR(salary)}</div>`;
  }else if(S.gaugeType==='bar'){
    $('gaugeContent').innerHTML=`
      <div class="adv-bar-wrap" style="padding:0 10px;width:100%">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px;font-weight:500;flex-wrap:wrap;gap:4px">
          <span>Gasto: <b style="color:${color}">${fmtR(me)}</b></span>
          <span>Salário: <b>${fmtR(salary)}</b></span>
        </div>
        <div class="adv-bar-bg">
          <div class="adv-bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <div class="adv-bar-markers">
          <span>0%</span><span style="color:var(--yellow)">50%</span><span style="color:var(--red)">80%</span><span>100%</span>
        </div>
        <div style="text-align:center;font-size:14px;font-weight:600;color:${color};margin-top:8px">${label} — ${pct.toFixed(1)}%</div>
      </div>`;
  }else{
    // pizza mode: use bounded wrap with fixed height
    $('gaugeContent').innerHTML='';
    if(wrap){
      wrap.style.display='block';
      const gc=$('gaugePieCanvas');
      const remaining=Math.max(0,salary-me);
      charts.gauge=new Chart(gc,{type:'doughnut',data:{labels:['Gasto','Restante'],datasets:[{data:[me,remaining],backgroundColor:[pct>=80?'rgba(220,38,38,.85)':pct>=50?'rgba(217,119,6,.85)':'rgba(22,163,74,.85)','rgba(128,128,128,.18)'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:'60%',animation:{duration:600},plugins:{legend:{position:'bottom',labels:{color:tclr(),font:{family:'DM Sans',size:11},boxWidth:11}},tooltip:{callbacks:{label:c=>`${c.label}: ${fmtR(c.raw)}`}}}}});
    }
  }
}
/* ═══════════════════════════════════════════════════════════
   META / INSIGHTS
═══════════════════════════════════════════════════════════ */
function saveMeta(){
  S.salary=parseFloat($('salaryInput').value)||null;
  S.goal=parseFloat($('goalInput').value)||null;
  S.saveGoalPct=parseFloat($('saveGoalInput').value)||null;
  persist();renderMeta();checkAlerts();
}
function renderMeta(){
  const me=monthlyExpenses();
  const spent=me.filter(e=>e.paid).reduce((s,e)=>s+e.amount,0);
  const pending=me.filter(e=>!e.paid).reduce((s,e)=>s+e.amount,0);
  const salary=S.salary||0;const goal=S.goal||0;
  let html='';
  // salary bar
  if(salary>0){
    const salPct=Math.min((spent/salary)*100,100);
    const sc=salPct>=80?'crit':salPct>=50?'warn':'';
    html+=`<div style="margin-bottom:18px">
      <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Comprometimento do salário</div>
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span>Pago: <b>${fmtR(spent)}</b></span><span>Salário: <b>${fmtR(salary)}</b></span></div>
      <div class="gbar-bg"><div class="gbar-fill ${sc}" style="width:${salPct}%"></div></div>
      <div class="gmeta"><span>${salPct.toFixed(1)}% do salário comprometido</span><span style="color:${salPct>=80?'var(--red)':salPct>=50?'var(--yellow)':'var(--green)'}">${salPct>=80?'🔴 Crítico':salPct>=50?'🟡 Moderado':'🟢 Normal'}</span></div>
    </div>`;
  }
  // goal bar
  if(goal>0){
    const gp=Math.min((spent/goal)*100,100);
    const gc=gp>=100?'crit':gp>=80?'warn':'';
    html+=`<div style="margin-bottom:18px">
      <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Meta de gastos</div>
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span>Pago: <b>${fmtR(spent)}</b></span><span>Meta: <b>${fmtR(goal)}</b></span></div>
      <div class="gbar-bg"><div class="gbar-fill ${gc}" style="width:${gp}%"></div></div>
      <div class="gmeta"><span>${gp.toFixed(1)}% da meta</span><span>${gp<100?'Restam '+fmtR(goal-spent):'⚠️ Meta ultrapassada!'}</span></div>
    </div>`;
  }
  // savings
  if(salary>0&&S.saveGoalPct){
    const saveAmt=salary*(S.saveGoalPct/100);
    const leftover=Math.max(0,salary-spent);
    const savePct=Math.min((leftover/saveAmt)*100,100);
    html+=`<div style="margin-bottom:8px">
      <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Meta de poupança (${S.saveGoalPct}% = ${fmtR(saveAmt)})</div>
      <div class="gbar-bg"><div class="gbar-fill" style="width:${savePct}%"></div></div>
      <div class="gmeta"><span>Sobra estimada: ${fmtR(leftover)}</span><span>${leftover>=saveAmt?'✅ Meta atingida':'⚠️ Abaixo da meta'}</span></div>
    </div>`;
  }
  if(!html)html=`<p style="color:var(--muted);font-size:13px">Configure salário e meta acima para ver as barras de progresso.</p>`;
  $('metaProgress').innerHTML=html;
  // insights
  const bycat={};me.forEach(e=>{bycat[e.category]=(bycat[e.category]||0)+e.amount});
  const topCat=Object.entries(bycat).sort((a,b)=>b[1]-a[1])[0];
  const mLabel=MONTHS[S.selectedMonth];
  $('insights').innerHTML=`<div style="display:flex;flex-direction:column;gap:10px;font-size:13px">
    <div>📅 <b>${me.length}</b> lançamentos em <b>${mLabel}</b> — total: <b>${fmtR(me.reduce((s,e)=>s+e.amount,0))}</b></div>
    ${topCat?`<div>🏆 Maior categoria: <b>${topCat[0]}</b> — ${fmtR(topCat[1])}</div>`:''}
    <div>✅ Pago: ${fmtR(spent)} &nbsp;|&nbsp; ⏳ Pendente: ${fmtR(pending)}</div>
    ${salary>0?`<div>💰 Salário restante estimado: <b>${fmtR(Math.max(0,salary-spent))}</b></div>`:''}
    ${S.investments.length?`<div>📈 Total investido: <b>${fmtR(S.investments.reduce((s,i)=>s+i.amount,0))}</b></div>`:''}
  </div>`;
}

/* ═══════════════════════════════════════════════════════════
   ALERTS
═══════════════════════════════════════════════════════════ */
function checkAlerts(){
  // overdue within selected month
  const ov=filterByMonth(S.expenses).filter(e=>status(e)==='overdue');
  const alOv=$('al-overdue');
  if(ov.length){alOv.style.display='';alOv.innerHTML=`<div class="alert alert-red">🔴 <b>${ov.length} lançamento(s) vencido(s)</b> — total: ${fmtR(ov.reduce((s,e)=>s+e.amount,0))}</div>`}
  else alOv.style.display='none';
  // goal
  const alG=$('al-goal');
  if(!S.goal){alG.style.display='none';return}
  const spent=filterByMonth(S.expenses).filter(e=>e.paid).reduce((s,e)=>s+e.amount,0);
  const pct=(spent/S.goal)*100;
  if(pct>=100){alG.style.display='';alG.innerHTML=`<div class="alert alert-red">⚠️ Meta de ${fmtR(S.goal)} ultrapassada! Pago: ${fmtR(spent)}</div>`}
  else if(pct>=80){alG.style.display='';alG.innerHTML=`<div class="alert alert-warn">⚠️ ${pct.toFixed(0)}% da meta mensal (${fmtR(spent)} de ${fmtR(S.goal)})</div>`}
  else alG.style.display='none';
}

/* ═══════════════════════════════════════════════════════════
   SCORE
═══════════════════════════════════════════════════════════ */
function renderScore(){
  if(!S.expenses.length){$('scoreNum').textContent='--';$('scoreLbl').textContent='Adicione gastos para calcular';$('scoreComp').innerHTML='';$('scoreRecs').innerHTML='';return}
  const me=monthlyExpenses();
  const spent=me.filter(e=>e.paid).reduce((s,e)=>s+e.amount,0);
  const ov=S.expenses.filter(e=>status(e)==='overdue');
  let gScore=100;if(S.goal&&spent>0)gScore=Math.max(0,100-((spent/S.goal-.5)*100));
  const lux=me.filter(e=>['Lazer','Vestuário'].includes(e.category)).reduce((s,e)=>s+e.amount,0);
  const lScore=spent>0?Math.max(0,100-(lux/spent)*150):100;
  const days=[...new Set(me.map(e=>e.dueDate||e.date))].length;
  const rScore=Math.min(100,days*5);
  const ovScore=Math.max(0,100-ov.length*20);
  const invScore=S.investments.length?Math.min(100,S.investments.length*10+((S.investments.reduce((s,i)=>s+i.amount,0)/(S.salary||1))*20)):50;
  const score=Math.round(gScore*.35+lScore*.2+rScore*.1+ovScore*.2+invScore*.15);
  const lbl=score>=80?'🟢 Excelente':score>=60?'🟡 Bom':score>=40?'🟠 Regular':'🔴 Atenção';
  $('scoreNum').textContent=score;$('scoreLbl').textContent=lbl;
  const c=$('scoreCircle');
  c.style.strokeDashoffset=264-(score/100)*264;
  c.style.stroke=score>=80?'#16A34A':score>=60?'#d97706':'#DC2626';
  $('scoreComp').innerHTML=[
    {l:'Controle de meta',v:gScore},
    {l:'Gastos supérfluos',v:lScore},
    {l:'Pontualidade',v:ovScore},
    {l:'Regularidade',v:rScore},
    {l:'Investimentos',v:invScore},
  ].map(x=>`<div style="margin-bottom:13px">
    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span>${x.l}</span><b>${Math.round(x.v)}/100</b></div>
    <div class="gbar-bg"><div class="gbar-fill ${x.v<40?'crit':x.v<70?'warn':''}" style="width:${x.v}%"></div></div>
  </div>`).join('');
  const recs=[];
  if(!S.goal)recs.push('💡 Configure uma meta mensal em Metas');
  if(gScore<70&&S.goal)recs.push('⚠️ Gastos acima do planejado — revise o orçamento');
  if(lScore<70)recs.push('🛍️ Reduza gastos em Lazer e Vestuário');
  if(ov.length)recs.push(`🔴 ${ov.length} conta(s) vencida(s) — regularize para melhorar o score`);
  if(!S.investments.length)recs.push('📈 Comece a investir para melhorar seu score');
  if(score>=80)recs.push('🎉 Parabéns! Saúde financeira excelente!');
  $('scoreRecs').innerHTML=recs.map(r=>`<div style="padding:9px 0;border-bottom:1px solid var(--border);font-size:12px">${r}</div>`).join('');
}

/* ═══════════════════════════════════════════════════════════
   EXPORT
═══════════════════════════════════════════════════════════ */
function exportCSV(){
  const rows=S.expenses.map(e=>[e.name,e.category,e.amount.toFixed(2),e.dueDate||'',status(e)]);
  const csv=[['Nome','Categoria','Valor','Vencimento','Status'],...rows].map(r=>r.map(v=>`"${v}"`).join(',')).join('\n');
  dl('finflow_gastos.csv',csv,'text/csv');closeModal('mov-exp-modal');
}
function exportJSON(){
  dl('finflow_dados.json',JSON.stringify({expenses:S.expenses,investments:S.investments},null,2),'application/json');closeModal('mov-exp-modal');
}
function dl(n,c,t){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([c],{type:t}));a.download=n;a.click()}

/* ═══════════════════════════════════════════════════════════
   GLOBAL MODAL CLOSE
═══════════════════════════════════════════════════════════ */
$$('.mov').forEach(m=>{m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open')})});
// ESC closes modals (dropdown ESC is handled in DROPDOWN MENU CONTROLLER)
document.addEventListener('keydown',e=>{if(e.key==='Escape')$$('.mov').forEach(m=>m.classList.remove('open'))});

/* ═══════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════ */
// Responsive search placeholder toggle
function syncSearchPlaceholder(){
  const inp=$('srch');if(!inp)return;
  inp.placeholder=window.innerWidth<=768?'':'Buscar por nome...';
}
window.addEventListener('resize',syncSearchPlaceholder);

// Load theme before session check to avoid flash
(function(){
  try{
    const s=JSON.parse(localStorage.getItem('ff_sess')||'null');
    if(s&&s.email){
      const d=JSON.parse(localStorage.getItem('ff_'+s.email+'_d')||'{}');
      if(d.theme){document.documentElement.setAttribute('data-theme',d.theme);S.theme=d.theme}
    }
  }catch(_){}
})();
applyTheme();
syncSearchPlaceholder();
checkSession();