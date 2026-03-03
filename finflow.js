/* ═══════════════════════════════════════════════════════════
   FIREBASE — inicialização (módulos ESM via CDN)
═══════════════════════════════════════════════════════════ */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyC1yhx-jjl50O4xXvwyVr4FynofkdyvMcQ",
  authDomain: "finflow-38806.firebaseapp.com",
  projectId: "finflow-38806",
  storageBucket: "finflow-38806.firebasestorage.app",
  messagingSenderId: "309545069446",
  appId: "1:309545069446:web:a4412b0e18e8cbc72e9a07"
};

const fbApp = initializeApp(firebaseConfig);
const auth  = getAuth(fbApp);
const db    = getFirestore(fbApp);

/* helpers para coleções do usuário */
function uCol(sub)     { return collection(db,'users',auth.currentUser.uid,sub); }
function uDoc(sub, id) { return doc(db,'users',auth.currentUser.uid,sub,id); }
function uPrefs()      { return doc(db,'users',auth.currentUser.uid,'settings','prefs'); }

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
const MONTHS=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

/* ═══════════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════════ */
let S={
  expenses:[],investments:[],categories:[...DEFCATS],
  editExpId:null,editInvId:null,editExpYM:null,
  sortField:null,sortDir:1,
  period:'month',gaugeType:'ring',
  goal:null,salary:null,saveGoalPct:null,
  theme:'light',user:null,
  selectedMonth:new Date().getMonth(),
  selectedYear:new Date().getFullYear()
};
let charts={line:null,bar:null,pie:null,comp:null,gauge:null,invPie:null,invBar:null};

/* ═══════════════════════════════════════════════════════════
   FIRESTORE — persist & load
═══════════════════════════════════════════════════════════ */

/* Salva preferências (categorias, meta, salário, tema, mês selecionado) */
async function persistPrefs() {
  if (!auth.currentUser) return;
  try {
    await setDoc(uPrefs(), {
      categories:    S.categories,
      goal:          S.goal,
      salary:        S.salary,
      saveGoalPct:   S.saveGoalPct,
      theme:         S.theme,
      selectedMonth: S.selectedMonth,
      selectedYear:  S.selectedYear
    });
  } catch(e) { console.warn('persistPrefs error', e); }
}

/* Alias chamado pelo código legado (ex: addCat, saveMeta, toggleTheme) */
async function persist() { await persistPrefs(); }

/* Salva/atualiza uma despesa individual no Firestore */
async function persistExpense(expense) {
  if (!auth.currentUser) return;
  try { await setDoc(uDoc('expenses', expense.id), expense); }
  catch(e) { console.warn('persistExpense error', e); }
}

/* Salva/atualiza um investimento individual */
async function persistInvestment(inv) {
  if (!auth.currentUser) return;
  try { await setDoc(uDoc('investments', inv.id), inv); }
  catch(e) { console.warn('persistInvestment error', e); }
}

/* Deleta uma despesa */
async function deleteExpense(id) {
  if (!auth.currentUser) return;
  try { await deleteDoc(uDoc('expenses', id)); }
  catch(e) { console.warn('deleteExpense error', e); }
}

/* Deleta um investimento */
async function deleteInvestment(id) {
  if (!auth.currentUser) return;
  try { await deleteDoc(uDoc('investments', id)); }
  catch(e) { console.warn('deleteInvestment error', e); }
}

/* Carrega todos os dados do Firestore para o estado S */
async function loadUD() {
  if (!auth.currentUser) return;
  try {
    // Preferências
    const prefsSnap = await getDoc(uPrefs());
    if (prefsSnap.exists()) {
      const d = prefsSnap.data();
      if (Array.isArray(d.categories) && d.categories.length) S.categories = d.categories;
      if (d.goal          != null) S.goal         = d.goal;
      if (d.salary        != null) S.salary        = d.salary;
      if (d.saveGoalPct   != null) S.saveGoalPct   = d.saveGoalPct;
      if (d.theme)                 S.theme          = d.theme;
      if (typeof d.selectedMonth === 'number') S.selectedMonth = d.selectedMonth;
      if (typeof d.selectedYear  === 'number') S.selectedYear  = d.selectedYear;
    }
    // Despesas
    const expSnap = await getDocs(uCol('expenses'));
    S.expenses = expSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Investimentos
    const invSnap = await getDocs(uCol('investments'));
    S.investments = invSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) { console.warn('loadUD error', e); }
}

/* ═══════════════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════════════ */
function swLoginTab(tab,el){
  $$('.ltab').forEach(t=>t.classList.remove('active'));el.classList.add('active');
  $$('.lform').forEach(f=>f.classList.remove('active'));
  $('lf-'+tab).classList.add('active');
  $('li-err').textContent='';$('re-err').textContent='';
}

async function doLogin(){
  const email=$('li-email').value.trim().toLowerCase();
  const pass=$('li-pass').value;
  const err=$('li-err');
  if(!email||!pass){err.textContent='Preencha e-mail e senha.';return}
  try{
    await signInWithEmailAndPassword(auth,email,pass);
    // onAuthStateChanged cuidará do enterApp()
  }catch(e){
    if(e.code==='auth/invalid-credential'||e.code==='auth/wrong-password'||e.code==='auth/user-not-found'){
      err.textContent='E-mail ou senha incorretos.';
    } else {
      err.textContent='Erro ao entrar: '+e.message;
    }
  }
}

async function doRegister(){
  const name=$('re-name').value.trim();
  const email=$('re-email').value.trim().toLowerCase();
  const pass=$('re-pass').value;
  const pass2=$('re-pass2').value;
  const err=$('re-err');
  if(!name||!email||!pass||!pass2){err.textContent='Preencha todos os campos.';return}
  if(pass!==pass2){err.textContent='As senhas não coincidem.';return}
  if(pass.length<6){err.textContent='Senha deve ter ao menos 6 caracteres.';return}
  if(!/\S+@\S+\.\S+/.test(email)){err.textContent='E-mail inválido.';return}
  try{
    const cred=await createUserWithEmailAndPassword(auth,email,pass);
    await updateProfile(cred.user,{displayName:name});
    // onAuthStateChanged cuidará do enterApp()
  }catch(e){
    if(e.code==='auth/email-already-in-use'){
      err.textContent='E-mail já cadastrado.';
    } else {
      err.textContent='Erro ao registrar: '+e.message;
    }
  }
}

async function doLogout(){
  if(!confirm('Sair da conta?'))return;
  // Resetar estado local
  S.expenses=[];S.investments=[];S.categories=[...DEFCATS];
  S.goal=null;S.salary=null;S.saveGoalPct=null;S.user=null;
  S.selectedMonth=new Date().getMonth();S.selectedYear=new Date().getFullYear();
  await signOut(auth);
  $('appMain').style.display='none';
  $('loginScreen').style.display='flex';
  $('li-email').value='';$('li-pass').value='';$('li-err').textContent='';
}

function enterApp(){
  applyTheme();
  $('loginScreen').style.display='none';
  const app=$('appMain');app.style.display='flex';app.style.flexDirection='column';
  const ini=(S.user.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  $('uavatar').textContent=ini;$('uname').textContent=S.user.name||S.user.email;
  $('goalInput').value=S.goal||'';
  $('salaryInput').value=S.salary||'';
  $('saveGoalInput').value=S.saveGoalPct||'';
  fillCatSelects();genRecurring();renderMonthBar();renderTable();renderInvTable();checkAlerts();
}

/* Observa mudança de autenticação — substitui checkSession() */
onAuthStateChanged(auth, async (user) => {
  if(user){
    S.user={uid:user.uid,email:user.email,name:user.displayName||user.email};
    setLoadingState(true);
    await loadUD();
    setLoadingState(false);
    enterApp();
  } else {
    $('appMain').style.display='none';
    $('loginScreen').style.display='flex';
  }
});

function setLoadingState(loading){
  // Mostra feedback visual enquanto carrega dados do Firestore
  const btn=$('loginScreen')&&document.querySelector('.lbtn');
  if(btn) btn.disabled=loading;
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
/* ── INSTÂNCIA MENSAL ───────────────────────────────────────
   Retorna os dados resolvidos de um lançamento para um mês específico,
   aplicando modificações pontuais e verificando exceções.
   ym = "YYYY-MM"
────────────────────────────────────────────────────────── */
function ymKey(year, month) {
  return `${year}-${String(month+1).padStart(2,'0')}`;
}
function currentYM() {
  return ymKey(S.selectedYear, S.selectedMonth);
}
function getInstancia(e, ym) {
  // Resolve dados do lançamento para uma competência específica
  const mod = (e.modificacoes||{})[ym];
  const tipo = e.recorrenciaTipo||(e.recorrente||e.isTemplate||e.recurrence==='monthly'?'infinita':'nenhuma');
  const isRecorrente = tipo === 'infinita' || tipo === 'parcelada';

  // ── Vencimento da instância ────────────────────────────────
  // Para recorrentes: usa o DIA original mas o MÊS/ANO da competência exibida.
  // Isso evita que meses futuros sejam marcados como atrasados com base na data de criação.
  let instDueDate = e.dueDate || '';
  if(isRecorrente && instDueDate){
    const [ymYear, ymMonth] = ym.split('-').map(Number);
    const diaOriginal = new Date(instDueDate + 'T00:00:00').getDate();
    // Cria data da instância: dia fixo + mês/ano da competência
    const d = new Date(ymYear, ymMonth - 1, diaOriginal);
    // Protege contra overflow de mês (ex: dia 31 em mês de 30 dias → usa último dia)
    if(d.getMonth() !== ymMonth - 1) d.setDate(0);
    instDueDate = d.toISOString().split('T')[0];
  }

  return {
    ...e,
    name:        mod?.nome      ?? e.name,
    amount:      mod?.valor     ?? e.amount,
    category:    mod?.categoria ?? e.category,
    _ym:         ym,
    _dueDate:    instDueDate,   // vencimento calculado para esta competência
    _isPaid:     !!((e.pagamentos||{})[ym]),
    _hasException: !!((e.excecoes||{})[ym]),
  };
}

function status(e, ym){
  // Suporta modo legado (campo paid) e novo (pagamentos[ym])
  const pago = ym
    ? !!((e.pagamentos||{})[ym])
    : !!(e.paid || e._isPaid);
  if(pago) return 'paid';

  // Usa _dueDate (vencimento da instância) se disponível, senão dueDate base
  const venc = e._dueDate || e.dueDate || '';
  if(!venc) return 'pending';
  return venc < today() ? 'overdue' : 'pending';
}

/* ── CENTRAL MONTH FILTER ───────────────────────────────── */
function filterByMonth(arr){
  const selM=S.selectedMonth, selY=S.selectedYear;
  const selYM=selY*12+selM;
  const ym=ymKey(selY, selM);
  return arr.filter(e=>{
    // Verificar exceção: se excecoes[ym] === true, não renderizar
    if((e.excecoes||{})[ym]) return false;
    const dateStr=e.dueDate||e.date||'';
    const startDate=new Date(dateStr+'T00:00:00');
    const startM=startDate.getMonth();
    const startY=startDate.getFullYear();
    const startYM=startY*12+startM;
    const tipo=e.recorrenciaTipo
      ||(e.recorrente||e.isTemplate||e.recurrence==='monthly'?'infinita':'nenhuma');
    if(tipo==='nenhuma'||tipo==='none'||!tipo) return selYM===startYM;
    if(tipo==='infinita'||tipo==='monthly')   return selYM>=startYM;
    if(tipo==='parcelada'){
      const meses=parseInt(e.recorrenciaMeses)||1;
      const endYM=startYM+meses-1;
      return selYM>=startYM&&selYM<=endYM;
    }
    return false;
  }).map(e => getInstancia(e, ym)); // Resolve dados mensais (modificações, pagamentos)
}
function monthlyExpenses(){return filterByMonth(S.expenses)}
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
  if(yearEl){
    yearEl.innerHTML=`
      <button class="mbar-year-btn" onclick="setYear(${S.selectedYear-1})" title="Ano anterior">‹</button>
      <span class="mbar-year-lbl">${S.selectedYear}</span>
      <button class="mbar-year-btn" onclick="setYear(${S.selectedYear+1})" title="Próximo ano">›</button>`;
  }
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
  S.selectedMonth=m;
  _applyDateFilter();
}
function _applyDateFilter(){
  persist();
  renderMonthBar();
  renderTable();
  checkAlerts();
  if($('tab-dashboard')&&$('tab-dashboard').classList.contains('active')){destroyAll();renderAllCharts()}
  if($('tab-metas')&&$('tab-metas').classList.contains('active'))renderMeta();
  if($('tab-score')&&$('tab-score').classList.contains('active'))renderScore();
}

/* ═══════════════════════════════════════════════════════════
   THEME
═══════════════════════════════════════════════════════════ */
function applyTheme(){
  document.documentElement.setAttribute('data-theme',S.theme);
  const isDk=S.theme==='dark';
  const lbl=$('ltheme-lbl');if(lbl)lbl.textContent=isDk?'☀️ Modo claro':'🌙 Modo escuro';
  const tsw=$('tsw');if(tsw)tsw.classList.toggle('on',isDk);
}
function toggleTheme(){
  S.theme=S.theme==='dark'?'light':'dark';
  applyTheme();persist();
}

/* ═══════════════════════════════════════════════════════════
   SIDEBAR
═══════════════════════════════════════════════════════════ */
const openSB=()=>{$('sidebar').classList.add('open');$('obg').classList.add('open')};
const closeSB=()=>{$('sidebar').classList.remove('open');$('obg').classList.remove('open')};

/* ═══════════════════════════════════════════════════════════
   TABS
═══════════════════════════════════════════════════════════ */
function goTab(tab,el){
  $$('.nitem').forEach(n=>n.classList.remove('active'));if(el)el.classList.add('active');
  $$('.tab-view').forEach(v=>v.classList.remove('active'));
  $('tab-'+tab).classList.add('active');
  const titles={lancamentos:'Lançamentos',dashboard:'Dashboard',investimentos:'Investimentos',metas:'Metas',score:'Score'};
  $('ptitle').textContent=titles[tab]||tab;
  const topBtn=$('topAddBtn');
  if(topBtn){topBtn.style.display=tab==='lancamentos'?'':'none'}
  closeSB();
  if(tab==='dashboard'){destroyAll();renderAllCharts()}
  if(tab==='investimentos'){renderInvTable();renderInvCharts()}
  if(tab==='metas'){renderMeta()}
  if(tab==='score')renderScore();
}

/* ═══════════════════════════════════════════════════════════
   DROPDOWN MENU CONTROLLER
═══════════════════════════════════════════════════════════ */
let _openDD=null;
function openDD(btn){
  const wrap=btn.closest('.ddwrap');if(!wrap)return;
  const menu=wrap.querySelector('.ddmenu');if(!menu)return;
  const isOpen=menu.classList.contains('open');
  closeAllDD();
  if(!isOpen){
    // Position the fixed menu under the button
    const r=btn.getBoundingClientRect();
    menu.style.top=(r.bottom+4)+'px';
    menu.style.right=(window.innerWidth-r.right)+'px';
    menu.classList.add('open');
    btn.setAttribute('aria-expanded','true');
    _openDD=menu;
  }
}
function closeAllDD(){
  if(_openDD){
    _openDD.classList.remove('open');
    const btn=_openDD.previousElementSibling;
    if(btn)btn.setAttribute('aria-expanded','false');
    _openDD=null;
  }
}
// Close on outside click
document.addEventListener('click',e=>{
  if(!_openDD)return;
  if(e.target.closest('.ddwrap')||e.target.closest('.ddmenu'))return;
  closeAllDD();
},{capture:true});
// Arrow key navigation inside open dropdown
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeAllDD();return}
  if(!_openDD)return;
  const items=[..._openDD.querySelectorAll('.dditem:not([disabled])')];
  if(!items.length)return;
  const cur=document.activeElement;
  const idx=items.indexOf(cur);
  if(e.key==='ArrowDown'){e.preventDefault();items[Math.min(idx+1,items.length-1)].focus()}
  if(e.key==='ArrowUp'){e.preventDefault();items[Math.max(idx-1,0)].focus()}
});

/* ═══════════════════════════════════════════════════════════
   CATEGORY SELECT
═══════════════════════════════════════════════════════════ */
function fillCatSelects(){
  ['inp-cat','fCat'].forEach(sid=>{
    if(sid==='inp-cat'&&$('mov-exp').classList.contains('open'))return;
    const sel=$(sid);if(!sel)return;
    const val=sel.value;
    sel.innerHTML=sid==='inp-cat'?'<option value="">Selecionar...</option>':'<option value="">Categorias</option>';
    S.categories.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;sel.appendChild(o)});
    if(sid==='inp-cat'){const o=document.createElement('option');o.value='__new__';o.textContent='+ Nova categoria';sel.appendChild(o)}
    try{sel.value=val}catch(_){}
  });
}
$('inp-cat').addEventListener('change',function(){
  if(this.value==='__new__'){this.value='';$('mov-cat').classList.add('open');$('new-cat').value='';$('new-cat').focus()}
});
function addCat(){
  const n=$('new-cat').value.trim();if(!n)return;
  if(!S.categories.includes(n)){S.categories.push(n);persist()}
  // Rebuild inp-cat directly so new option is available immediately
  const sel=$('inp-cat');
  if(sel){
    sel.innerHTML='<option value="">Selecionar...</option>';
    S.categories.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;sel.appendChild(o)});
    sel.appendChild(Object.assign(document.createElement('option'),{value:'__new__',textContent:'+ Nova categoria'}));
    sel.value=n;
  }
  fillCatSelects();
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
   RECURRING (stub — lógica agora em filterByMonth)
═══════════════════════════════════════════════════════════ */
function genRecurring(){
  // No-op: filtragem por mês é feita em filterByMonth()
}

/* ── Mostra/oculta campo de parcelas */
function onRecChange(){
  const v=$('inp-rec').value;
  $('fg-parcelas').style.display=v==='parcelada'?'':'none';
  if(v==='parcelada')$('inp-parcelas').focus();
}

/* ═══════════════════════════════════════════════════════════
   MODALS
═══════════════════════════════════════════════════════════ */
function closeModal(id){$(id).classList.remove('open')}

function openModal(expId){
  closeAllDD();
  S.editExpId=expId||null;
  S.editExpYM=null; // sempre null ao abrir modal base
  $('mexp-title').textContent=expId?'Editar Lançamento':'Novo Lançamento';
  // Garante que campo de recorrência está visível
  const recRow=$('inp-rec').closest('.fg');
  if(recRow) recRow.style.display='';
  fillCatSelects();
  if(expId){
    const e=S.expenses.find(x=>x.id===expId);
    if(e){
      $('inp-name').value=e.name;
      setTimeout(()=>{$('inp-cat').value=e.category},0);
      $('inp-val').value=e.amount;$('inp-due').value=e.dueDate||'';
      $('inp-color').value=e.color||'#2d6a4f';
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

function openExport(){closeAllDD();$('mov-exp-modal').classList.add('open')}

/* ═══════════════════════════════════════════════════════════
   SAVE EXPENSE
═══════════════════════════════════════════════════════════ */
async function saveExpense(){
  const name=$('inp-name').value.trim();
  const category=$('inp-cat').value;
  const amount=parseFloat($('inp-val').value);
  const dueDate=$('inp-due').value;
  const color=$('inp-color').value||'#2d6a4f';
  const recorrenciaTipo=$('inp-rec').value||'nenhuma';
  const recorrenciaMeses=recorrenciaTipo==='parcelada'?parseInt($('inp-parcelas').value)||0:null;

  if(!name){alert('Informe o nome do gasto.');$('inp-name').focus();return}
  if(!category||category===''||category==='__new__'){alert('Selecione uma categoria.');$('inp-cat').focus();return}
  if(!dueDate){alert('Informe a data de vencimento.');$('inp-due').focus();return}
  if(isNaN(amount)||amount<=0){alert('Informe um valor válido maior que zero.');$('inp-val').focus();return}
  if(recorrenciaTipo==='parcelada'&&(!recorrenciaMeses||recorrenciaMeses<2)){
    alert('Informe o número de parcelas (mínimo 2).');$('inp-parcelas').focus();return
  }

  // ── Edição mensal (apenas este mês) ────────────────────
  if(S.editExpId && S.editExpYM){
    const ym  = S.editExpYM;
    const idx = S.expenses.findIndex(x=>x.id===S.editExpId);
    if(idx !== -1){
      const e = S.expenses[idx];
      if(!e.modificacoes) e.modificacoes = {};
      // Salva apenas os campos que mudaram em relação à base
      const mod = {};
      if(name     !== e.name)     mod.nome      = name;
      if(amount   !== e.amount)   mod.valor     = amount;
      if(category !== e.category) mod.categoria = category;
      if(Object.keys(mod).length){
        e.modificacoes[ym] = mod;
      } else {
        // Nenhuma mudança: remove modificação existente se houver
        delete e.modificacoes[ym];
      }
      await persistExpense(e);
    }
    _closeExpModal();
    renderTable(); checkAlerts();
    if($('tab-dashboard').classList.contains('active')){destroyAll();renderAllCharts()}
    return;
  }

  // ── Edição base (todos os meses) ou novo ───────────────
  let dataFinal=null;
  if(recorrenciaTipo==='parcelada'&&recorrenciaMeses){
    const d=new Date(dueDate+'T00:00:00');
    d.setMonth(d.getMonth()+recorrenciaMeses-1);
    dataFinal=d.toISOString().split('T')[0];
  }
  const recorrente=recorrenciaTipo==='infinita';
  const isTemplate=recorrente;
  const recurrence=recorrenciaTipo==='infinita'?'monthly':'none';

  const payload={
    name,category,amount,dueDate,color,date:dueDate,
    recorrenciaTipo,recorrenciaMeses,dataFinal,
    recorrente,isTemplate,recurrence
  };

  if(S.editExpId){
    const idx=S.expenses.findIndex(x=>x.id===S.editExpId);
    if(idx!==-1){
      S.expenses[idx]={...S.expenses[idx],...payload};
      await persistExpense(S.expenses[idx]);
    }
    S.editExpId=null;
  }else{
    const newExp={id:uid(),paid:false,pagamentos:{},modificacoes:{},excecoes:{},templateId:null,...payload};
    S.expenses.push(newExp);
    await persistExpense(newExp);
  }

  _closeExpModal();
  renderTable();checkAlerts();
  if($('tab-dashboard').classList.contains('active')){destroyAll();renderAllCharts()}
}

function _closeExpModal(){
  $('mov-exp').classList.remove('open');
  $('inp-name').value='';$('inp-cat').value='';$('inp-val').value='';
  $('inp-due').value='';$('inp-color').value='#2d6a4f';
  $('inp-rec').value='nenhuma';$('inp-parcelas').value='';
  $('fg-parcelas').style.display='none';
  $('cat-sugg').innerHTML='';
  // Restaura campo de recorrência (pode ter sido ocultado em edição mensal)
  const recRow=$('inp-rec').closest('.fg');
  if(recRow) recRow.style.display='';
  S.editExpId=null;
  S.editExpYM=null;
}

/* ═══════════════════════════════════════════════════════════
   EXPENSE ACTIONS — modelo mensal
═══════════════════════════════════════════════════════════ */

/* ── PAGAR: sempre por competência mensal ─────────────── */
async function markPaid(id){
  const ym = currentYM();
  const i = S.expenses.findIndex(x=>x.id===id);
  if(i === -1) return;
  const e = S.expenses[i];
  // Garante que pagamentos existe
  if(!e.pagamentos) e.pagamentos = {};
  const tipo = e.recorrenciaTipo||(e.recorrente||e.isTemplate?'infinita':'nenhuma');
  const isRecorrente = tipo==='infinita'||tipo==='parcelada';
  if(isRecorrente){
    // Togela apenas o mês atual
    e.pagamentos[ym] = !e.pagamentos[ym];
    // Remove a flag legada para não conflitar
    delete e.paid;
  } else {
    // Lançamento único: mantém compatibilidade, também grava em pagamentos
    e.pagamentos[ym] = !e.pagamentos[ym];
    e.paid = e.pagamentos[ym]; // mantém campo legado para não quebrar filtros antigos
  }
  await persistExpense(e);
  renderTable(); checkAlerts();
}

/* ── EDITAR: abre diálogo de escopo ──────────────────── */
function editExp(id){
  const e = S.expenses.find(x=>x.id===id);
  if(!e) return;
  const tipo = e.recorrenciaTipo||(e.recorrente||e.isTemplate?'infinita':'nenhuma');
  const isRecorrente = tipo==='infinita'||tipo==='parcelada';
  if(!isRecorrente){
    // Lançamento único: edita direto
    openModal(id);
    return;
  }
  // Recorrente: pergunta escopo
  openScopeModal('edit', id);
}

/* ── EXCLUIR: abre diálogo de escopo ─────────────────── */
function delExp(id){
  const e = S.expenses.find(x=>x.id===id);
  if(!e) return;
  const tipo = e.recorrenciaTipo||(e.recorrente||e.isTemplate?'infinita':'nenhuma');
  const isRecorrente = tipo==='infinita'||tipo==='parcelada';
  if(!isRecorrente){
    _delExpFull(id);
    return;
  }
  openScopeModal('del', id);
}

async function _delExpFull(id){
  if(!confirm('Excluir este lançamento?')) return;
  S.expenses = S.expenses.filter(e=>e.id!==id);
  await deleteExpense(id);
  renderTable(); checkAlerts();
  if($('tab-dashboard').classList.contains('active')){destroyAll();renderAllCharts()}
}

async function _delExpMonth(id){
  const ym = currentYM();
  const i = S.expenses.findIndex(x=>x.id===id);
  if(i === -1) return;
  if(!S.expenses[i].excecoes) S.expenses[i].excecoes = {};
  S.expenses[i].excecoes[ym] = true;
  await persistExpense(S.expenses[i]);
  renderTable(); checkAlerts();
  if($('tab-dashboard').classList.contains('active')){destroyAll();renderAllCharts()}
}

/* ── MODAL DE ESCOPO (este mês / todos) ──────────────── */
let _scopeAction = null;
let _scopeExpId  = null;

function openScopeModal(action, id){
  _scopeAction = action;
  _scopeExpId  = id;
  const e = S.expenses.find(x=>x.id===id);
  const ym = currentYM();
  const [y,m] = ym.split('-');
  const mesLabel = `${MONTHS[parseInt(m)-1]} ${y}`;
  const isEdit = action === 'edit';
  const icon   = isEdit ? '✏️' : '🗑️';
  const verb   = isEdit ? 'editar' : 'excluir';
  const modal  = $('mov-scope');
  $('scope-title').textContent  = `${icon} ${isEdit ? 'Editar' : 'Excluir'} lançamento`;
  $('scope-desc').textContent   = `Deseja ${verb} apenas este mês ou toda a recorrência?`;
  $('scope-month-lbl').textContent = `Apenas ${mesLabel}`;
  $('scope-all-lbl').textContent   = isEdit ? 'Todos os meses (editar base)' : 'Todos os meses (excluir recorrência)';
  modal.classList.add('open');
}

function closeScopeModal(){
  $('mov-scope').classList.remove('open');
  _scopeAction = null;
  _scopeExpId  = null;
}

async function applyScopeMonth(){
  closeScopeModal();
  if(_scopeAction === null || _scopeExpId === null) return; // já foram limpos, usa valores salvos antes
  // Pega os valores antes do close ter limpado
  const act = _scopeAction || window._lastScopeAction;
  const id  = _scopeExpId  || window._lastScopeExpId;
  if(act === 'edit'){
    // Abre modal de edição passando contexto "apenas este mês"
    openModalMonthEdit(id);
  } else {
    await _delExpMonth(id);
  }
}

async function applyScopeAll(){
  closeScopeModal();
  const act = _scopeAction || window._lastScopeAction;
  const id  = _scopeExpId  || window._lastScopeExpId;
  if(act === 'edit'){
    openModal(id); // edita base normalmente
  } else {
    await _delExpFull(id);
  }
}

// Versão corrigida que guarda valores antes de chamar close
function _handleScopeChoice(choice){
  const act = _scopeAction;
  const id  = _scopeExpId;
  $('mov-scope').classList.remove('open');
  _scopeAction = null;
  _scopeExpId  = null;
  if(choice === 'month'){
    if(act === 'edit'){
      openModalMonthEdit(id);
    } else {
      _delExpMonth(id);
    }
  } else {
    if(act === 'edit'){
      openModal(id);
    } else {
      _delExpFull(id);
    }
  }
}

/* ── MODAL DE EDIÇÃO MENSAL ──────────────────────────── */
// Abre o modal de edição preenchido com os dados da instância do mês
function openModalMonthEdit(id){
  const ym  = currentYM();
  const e   = S.expenses.find(x=>x.id===id);
  if(!e) return;
  const inst = getInstancia(e, ym);
  // Reutiliza o modal de despesa mas com flag de edição mensal
  S.editExpId = id;
  S.editExpYM = ym; // sinaliza que é edição mensal
  $('mexp-title').textContent = `✏️ Editar — ${MONTHS[S.selectedMonth]} ${S.selectedYear}`;
  fillCatSelects();
  $('inp-name').value   = inst.name;
  setTimeout(()=>{ $('inp-cat').value = inst.category }, 0);
  $('inp-val').value    = inst.amount;
  $('inp-due').value    = e.dueDate||'';
  $('inp-color').value  = e.color||'#2d6a4f';
  // Para edição mensal, oculta campo de recorrência (não altera a base)
  const recRow = $('inp-rec').closest('.fg');
  if(recRow) recRow.style.display = 'none';
  $('fg-parcelas').style.display = 'none';
  $('cat-sugg').innerHTML = '';
  $('mov-exp').classList.add('open');
  setTimeout(()=>$('inp-name').focus(), 50);
}


/* ═══════════════════════════════════════════════════════════
   SAVE INVESTMENT
═══════════════════════════════════════════════════════════ */
async function saveInvestment(){
  const name=$('inv-name').value.trim();
  const type=$('inv-type').value;
  const amount=parseFloat($('inv-val').value);
  const rent=parseFloat($('inv-rent').value)||0;
  const date=$('inv-date').value;
  const color=$('inv-color').value||'#2563eb';

  if(!name){alert('Informe o nome do investimento.');$('inv-name').focus();return}
  if(!date){alert('Informe a data do investimento.');$('inv-date').focus();return}
  if(isNaN(amount)||amount<=0){alert('Informe um valor válido maior que zero.');$('inv-val').focus();return}

  if(S.editInvId){
    const idx=S.investments.findIndex(x=>x.id===S.editInvId);
    if(idx!==-1){
      S.investments[idx]={...S.investments[idx],name,type,amount,rent,date,color};
      await persistInvestment(S.investments[idx]);
    }
    S.editInvId=null;
  }else{
    const newInv={id:uid(),name,type,amount,rent,date,color};
    S.investments.push(newInv);
    await persistInvestment(newInv);
  }

  $('mov-inv').classList.remove('open');
  $('inv-name').value='';$('inv-type').value='rf';
  $('inv-val').value='';$('inv-rent').value='';
  $('inv-date').value=today();$('inv-color').value='#2563eb';

  renderInvTable();renderInvCharts();
  if($('tab-dashboard').classList.contains('active')){destroyAll();renderAllCharts()}
}

/* ═══════════════════════════════════════════════════════════
   INVESTMENT ACTIONS
═══════════════════════════════════════════════════════════ */
async function delInv(id){
  if(!confirm('Excluir investimento?'))return;
  S.investments=S.investments.filter(i=>i.id!==id);
  await deleteInvestment(id);
  renderInvTable();renderInvCharts();
  if($('tab-dashboard').classList.contains('active')){destroyAll();renderAllCharts()}
}

/* ═══════════════════════════════════════════════════════════
   EVENT DELEGATION — global (captura ddmenu position:fixed)
═══════════════════════════════════════════════════════════ */
function _expAction(e){
  const btn=e.target.closest('[data-act]');if(!btn)return;
  const{act,id}=btn.dataset;
  if(act==='opts'){openDD(btn);return}
  closeAllDD();
  if(act==='pay')markPaid(id);
  else if(act==='edit')editExp(id);
  else if(act==='del')delExp(id);
}
function _invAction(e){
  const btn=e.target.closest('[data-act]');if(!btn)return;
  const{act,id}=btn.dataset;
  if(act==='opts-inv'){openDD(btn);return}
  closeAllDD();
  if(act==='edit-inv')openInvModal(id);
  else if(act==='del-inv')delInv(id);
}
document.addEventListener('click',e=>{
  const btn=e.target.closest('[data-act]');if(!btn)return;
  const{act}=btn.dataset;
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
  // filterByMonth já retorna instâncias resolvidas via getInstancia
  let list=filterByMonth(S.expenses);
  if(srch)list=list.filter(e=>e.name.toLowerCase().includes(srch));
  if(cat)list=list.filter(e=>e.category===cat);
  // status agora usa _ym da instância
  if(sf)list=list.filter(e=>status(e,e._ym)===sf);
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
    list.sort((a,b)=>{const sa=status(a,a._ym),sb=status(b,b._ym);return ord[sa]!==ord[sb]?ord[sa]-ord[sb]:(a.dueDate||'').localeCompare(b.dueDate||'')});
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
    const ym = e._ym;
    const st = status(e, ym);
    const rc=st==='overdue'?'tr-overdue':st==='paid'?'tr-paid':'';
    const ac=st==='overdue'?'amt amt-overdue':st==='paid'?'amt amt-paid':'amt';
    const badge=st==='paid'?'<span class="sbadge s-paid">✅ Pago</span>':st==='overdue'?'<span class="sbadge s-overdue">🔴 Vencido</span>':'<span class="sbadge s-pending">🕐 Pendente</span>';
    const tipo=e.recorrenciaTipo||(e.recorrente||e.isTemplate?'infinita':'nenhuma');
    const recBadge=tipo==='infinita'
      ?'<span style="font-size:10px;color:var(--accent);font-weight:600;margin-left:4px" title="Recorrente mensal">🔁</span>'
      :tipo==='parcelada'
        ?`<span style="font-size:10px;color:#7c3aed;font-weight:600;margin-left:4px" title="Parcelado em ${e.recorrenciaMeses}x">📦${e.recorrenciaMeses}x</span>`
        :'';
    // Badge de modificação mensal
    const hasMod = !!(e.modificacoes||{})[ym] && Object.keys((e.modificacoes||{})[ym]||{}).length > 0;
    const modBadge = hasMod ? '<span style="font-size:10px;color:var(--yellow);font-weight:600;margin-left:4px" title="Modificado neste mês">✎</span>' : '';
    const dot=`<span class="name-dot" style="background:${e.color||'#2d6a4f'}"></span>`;
    const payItem = st === 'paid'
      ? `<button class="dditem dditem-undo" data-act="pay" data-id="${e.id}">↩ Desfazer pagamento</button>`
      : `<button class="dditem dditem-pay" data-act="pay" data-id="${e.id}">✅ Pagar</button>`;
    const ddMenu=`<div class="ddwrap">
          <button class="ddbtn" data-act="opts" data-id="${e.id}" aria-haspopup="true" aria-expanded="false">Opções</button>
          <div class="ddmenu" role="menu">
            ${payItem}
            <div class="ddsep"></div>
            <button class="dditem dditem-edit" data-act="edit" data-id="${e.id}" role="menuitem">✏️ Editar</button>
            <button class="dditem dditem-del" data-act="del" data-id="${e.id}" role="menuitem">🗑️ Excluir</button>
          </div>
        </div>`;
    return{e,st,rc,ac,badge,recBadge,modBadge,dot,payItem,ddMenu};
  });
  // Desktop table
  tbody.innerHTML=rows.map(({e,st,rc,ac,badge,recBadge,modBadge,dot,ddMenu})=>`<tr class="${rc}">
      <td style="color:${e.color||'inherit'};font-weight:500">${dot}${esc(e.name)}${recBadge}${modBadge}</td>
      <td><span class="cbadge">${esc(e.category)}</span></td>
      <td class="${ac}">${fmtR(e.amount)}</td>
      <td style="color:${st==='overdue'?'var(--red)':st==='paid'?'var(--green)':'var(--muted)'};font-weight:${st!=='pending'?600:400}">${fmtD(e._dueDate||e.dueDate)}</td>
      <td>${badge}</td>
      <td>${ddMenu}</td>
    </tr>`).join('');
  // Mobile cards
  if(mcardList){
    mcardList.innerHTML=rows.map(({e,st,badge,recBadge,modBadge,dot,ddMenu})=>`
      <div class="mcard${st==='overdue'?' mc-overdue':st==='paid'?' mc-paid':''}">
        <div class="mcard-top">
          <div class="mcard-name">${dot}<span style="color:${e.color||'inherit'}">${esc(e.name)}</span>${recBadge}${modBadge}</div>
          ${ddMenu}
        </div>
        <div class="mcard-body">
          <div class="mcard-cell"><span class="mcard-lbl">Categoria</span><span class="mcard-val"><span class="cbadge">${esc(e.category)}</span></span></div>
          <div class="mcard-cell"><span class="mcard-lbl">Valor</span><span class="mcard-val ${st==='overdue'?'amt-overdue':st==='paid'?'amt-paid':''}" style="font-weight:600">${fmtR(e.amount)}</span></div>
          <div class="mcard-cell"><span class="mcard-lbl">Vencimento</span><span class="mcard-val" style="color:${st==='overdue'?'var(--red)':st==='paid'?'var(--green)':'var(--muted)'};font-weight:${st!=='pending'?600:400}">${fmtD(e._dueDate||e.dueDate)}</span></div>
          <div class="mcard-cell"><span class="mcard-lbl">Status</span><span class="mcard-val">${badge}</span></div>
        </div>
      </div>`).join('');
  }
  fillCatSelects();
}

/* ═══════════════════════════════════════════════════════════
   RENDER INVESTMENT TABLE
═══════════════════════════════════════════════════════════ */
function renderInvTable(){
  const tbody=$('inv-tbody'),empty=$('empty-inv'),mcardList=$('mcard-inv');
  if(!S.investments.length){
    tbody.innerHTML='';
    if(mcardList)mcardList.innerHTML='';
    empty.style.display='';
    renderInvSummary();return
  }
  empty.style.display='none';
  const rows=S.investments.map(i=>{
    const today_ = today();
    const start  = new Date((i.date||today_)+'T00:00:00');
    const end    = new Date(today_+'T00:00:00');
    const days   = Math.max(0, (end - start) / 86400000);
    const years  = days / 365;
    // Compound interest: P × (1 + r)^t  where r = annual rate / 100
    const cur    = i.amount * Math.pow(1 + (i.rent||0)/100, years);
    const gain   = cur - i.amount;
    const gainCls=gain>=0?'amt-paid':'amt-overdue';
    const dot=`<span class="name-dot" style="background:${i.color||'#2563eb'}"></span>`;
    const ddMenu=`<div class="ddwrap">
      <button class="ddbtn" data-act="opts-inv" data-id="${i.id}" aria-haspopup="true" aria-expanded="false">Opções</button>
      <div class="ddmenu" role="menu">
        <button class="dditem dditem-edit" data-act="edit-inv" data-id="${i.id}" role="menuitem">✏️ Editar</button>
        <button class="dditem dditem-del" data-act="del-inv" data-id="${i.id}" role="menuitem">🗑️ Excluir</button>
      </div>
    </div>`;
    return{i,cur,gain,gainCls,dot,ddMenu};
  });
  tbody.innerHTML=rows.map(({i,cur,gain,gainCls,dot,ddMenu})=>`<tr>
    <td style="font-weight:500">${dot}${esc(i.name)}</td>
    <td><span class="cbadge ${INV_COLORS[i.type]||''}">${INV_LABELS[i.type]||i.type}</span></td>
    <td class="amt">${fmtR(i.amount)}</td>
    <td>${i.rent?i.rent+'%':'—'}</td>
    <td class="${gainCls}">${fmtR(cur)}</td>
    <td style="color:var(--muted)">${fmtD(i.date)}</td>
    <td>${ddMenu}</td>
  </tr>`).join('');
  if(mcardList){
    mcardList.innerHTML=rows.map(({i,cur,gain,gainCls,dot,ddMenu})=>`
      <div class="mcard">
        <div class="mcard-top">
          <div class="mcard-name">${dot}<span>${esc(i.name)}</span></div>
          ${ddMenu}
        </div>
        <div class="mcard-body">
          <div class="mcard-cell"><span class="mcard-lbl">Tipo</span><span class="mcard-val"><span class="cbadge ${INV_COLORS[i.type]||''}">${INV_LABELS[i.type]||i.type}</span></span></div>
          <div class="mcard-cell"><span class="mcard-lbl">Investido</span><span class="mcard-val" style="font-weight:600">${fmtR(i.amount)}</span></div>
          <div class="mcard-cell"><span class="mcard-lbl">Rentab.</span><span class="mcard-val">${i.rent?i.rent+'%':'—'}</span></div>
          <div class="mcard-cell"><span class="mcard-lbl">Valor Atual</span><span class="mcard-val ${gainCls}" style="font-weight:600">${fmtR(cur)}</span></div>
          <div class="mcard-cell"><span class="mcard-lbl">Data</span><span class="mcard-val">${fmtD(i.date)}</span></div>
        </div>
      </div>`).join('');
  }
  renderInvSummary();
}
function renderInvSummary(){
  const today_ = today();
  const total    = S.investments.reduce((s,i)=>s+i.amount,0);
  const totalCur = S.investments.reduce((s,i)=>{
    const days  = Math.max(0,(new Date(today_+'T00:00:00')-new Date((i.date||today_)+'T00:00:00'))/86400000);
    return s + i.amount * Math.pow(1+(i.rent||0)/100, days/365);
  },0);
  const gain = totalCur - total;
  $('inv-sgrid').innerHTML=`
    <div class="scard"><div class="scard-lbl">Total Investido</div><div class="scard-val">${fmtR(total)}</div></div>
    <div class="scard"><div class="scard-lbl">Valor Atual</div><div class="scard-val">${fmtR(totalCur)}</div></div>
    <div class="scard"><div class="scard-lbl">Ganho Estimado</div><div class="scard-val ${gain>=0?'s-paid':'s-overdue'}">${gain>=0?'+':''}${fmtR(gain)}</div></div>
    <div class="scard"><div class="scard-lbl">Ativos</div><div class="scard-val">${S.investments.length}</div></div>`;
}

/* ═══════════════════════════════════════════════════════════
   INVESTMENT CHARTS
═══════════════════════════════════════════════════════════ */
function renderInvCharts(){
  if(!S.investments.length)return;
  // Pie by type
  const byType={};
  S.investments.forEach(i=>{byType[i.type]=(byType[i.type]||0)+i.amount});
  const tc=$('invPieChart');
  if(tc){
    if(charts.invPie)charts.invPie.destroy();
    charts.invPie=new Chart(tc,{
      type:'doughnut',
      data:{labels:Object.keys(byType).map(k=>INV_LABELS[k]||k),datasets:[{data:Object.values(byType),backgroundColor:CHT_COLORS,borderWidth:2}]},
      options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{position:'bottom',labels:{color:tclr(),font:{size:11}}}}}
    });
  }
  // Bar by rentability
  const bc=$('invBarChart');
  if(bc){
    if(charts.invBar)charts.invBar.destroy();
    charts.invBar=new Chart(bc,{
      type:'bar',
      data:{labels:S.investments.map(i=>i.name),datasets:[{label:'Rentab. %',data:S.investments.map(i=>i.rent||0),backgroundColor:CHT_COLORS}]},
      options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{display:false}},scales:{x:{ticks:{color:tclr()}},y:{ticks:{color:tclr()},grid:{color:gclr()}}}}
    });
  }
}

/* ═══════════════════════════════════════════════════════════
   DASHBOARD CHARTS
═══════════════════════════════════════════════════════════ */
function destroyAll(){Object.keys(charts).forEach(k=>{if(charts[k])charts[k].destroy();charts[k]=null})}
function clrs(n){return Array.from({length:n},(_,i)=>CHT_COLORS[i%CHT_COLORS.length])}
const isDark=()=>S.theme==='dark';
const tclr=()=>isDark()?'#8a8a7e':'#6b6660';
const gclr=()=>isDark()?'#2d3329':'#f0ede8';

function setPeriod(p,el){
  S.period=p;
  $$('.ppill').forEach(b=>b.classList.remove('active'));el.classList.add('active');
  destroyAll();renderAllCharts();
}

function setGaugeType(t,el){
  S.gaugeType=t;
  $$('.gpill').forEach(b=>b.classList.remove('active'));el.classList.add('active');
  renderGauge(periodFilter(S.expenses,'dueDate'));
}

function renderAllCharts(){
  const allInst=periodFilter(S.expenses,'dueDate');
  const paid=allInst.filter(e=>status(e,e._ym)==='paid');
  const all=allInst;
  renderStats(all,paid);
  renderLineChart();
  renderBarChart(all);
  renderPieChart(all);
  renderCompChart();
  renderGauge(all);
}

function renderStats(all,paid){
  const total=all.reduce((s,e)=>s+e.amount,0);
  const paidAmt=paid.reduce((s,e)=>s+e.amount,0);
  const ov=filterByMonth(S.expenses).filter(e=>status(e,e._ym)==='overdue');
  const ovAmt=ov.reduce((s,e)=>s+e.amount,0);
  $('sgrid').innerHTML=`
    <div class="scard"><div class="scard-lbl">Total do período</div><div class="scard-val">${fmtR(total)}</div></div>
    <div class="scard"><div class="scard-lbl">Pago</div><div class="scard-val s-paid">${fmtR(paidAmt)}</div></div>
    <div class="scard"><div class="scard-lbl">Pendente</div><div class="scard-val">${fmtR(total-paidAmt)}</div></div>
    <div class="scard ${ov.length?'scard-warn':''}"><div class="scard-lbl">Vencido</div><div class="scard-val s-overdue">${fmtR(ovAmt)}</div></div>`;
}

function renderLineChart(){
  const c=$('lineChart');if(!c)return;
  // Group by month (last 6 months from selected)
  const months=[];
  for(let i=5;i>=0;i--){
    let m=S.selectedMonth-i,y=S.selectedYear;
    if(m<0){m+=12;y--}
    months.push({m,y,label:MONTHS[m].slice(0,3)+'/'+String(y).slice(2)});
  }
  const data=months.map(({m,y})=>{
    const selM=m,selY=y,selYM=selY*12+selM;
    const ym_=ymKey(selY,selM);
    return S.expenses.filter(e=>{
      if((e.excecoes||{})[ym_]) return false; // exceção para este mês
      const d=new Date((e.dueDate||e.date||'')+'T00:00:00');
      const eYM=d.getFullYear()*12+d.getMonth();
      const tipo=e.recorrenciaTipo||(e.recorrente?'infinita':'nenhuma');
      if(tipo==='infinita')return selYM>=eYM;
      if(tipo==='parcelada'){const end=eYM+(parseInt(e.recorrenciaMeses)||1)-1;return selYM>=eYM&&selYM<=end;}
      return selYM===eYM;
    }).reduce((s,e)=>{
      // Aplica modificação de valor se houver
      const val = ((e.modificacoes||{})[ym_]?.valor) ?? e.amount;
      return s + val;
    },0);
  });
  if(charts.line)charts.line.destroy();
  charts.line=new Chart(c,{
    type:'line',
    data:{labels:months.map(m=>m.label),datasets:[{label:'Total',data,fill:true,borderColor:'#2d6a4f',backgroundColor:'rgba(45,106,79,.12)',tension:.4,pointRadius:4}]},
    options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{display:false}},scales:{x:{ticks:{color:tclr()}},y:{ticks:{color:tclr(),callback:v=>fmtR(v)},grid:{color:gclr()}}}}
  });
}

function renderBarChart(all){
  const c=$('barChart');if(!c)return;
  const bycat={};all.forEach(e=>{bycat[e.category]=(bycat[e.category]||0)+e.amount});
  const sorted=Object.entries(bycat).sort((a,b)=>b[1]-a[1]);
  if(charts.bar)charts.bar.destroy();
  charts.bar=new Chart(c,{
    type:'bar',
    data:{labels:sorted.map(x=>x[0]),datasets:[{data:sorted.map(x=>x[1]),backgroundColor:clrs(sorted.length)}]},
    options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{display:false}},scales:{x:{ticks:{color:tclr()}},y:{ticks:{color:tclr(),callback:v=>fmtR(v)},grid:{color:gclr()}}}}
  });
}

function renderPieChart(all){
  const c=$('pieChart');if(!c)return;
  const bycat={};all.forEach(e=>{bycat[e.category]=(bycat[e.category]||0)+e.amount});
  const sorted=Object.entries(bycat).sort((a,b)=>b[1]-a[1]);
  if(charts.pie)charts.pie.destroy();
  charts.pie=new Chart(c,{
    type:'doughnut',
    data:{labels:sorted.map(x=>x[0]),datasets:[{data:sorted.map(x=>x[1]),backgroundColor:clrs(sorted.length),borderWidth:2}]},
    options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{position:'bottom',labels:{color:tclr(),font:{size:11}}}}}
  });
}

function renderCompChart(){
  const c=$('compChart');if(!c)return;
  const meArr=filterByMonth(S.expenses);
  const me=meArr.filter(e=>status(e,e._ym)==='paid').reduce((s,e)=>s+e.amount,0);
  const mi=S.investments.reduce((s,i)=>s+i.amount,0);
  const mLabel=MONTHS[S.selectedMonth];
  if(charts.comp)charts.comp.destroy();
  charts.comp=new Chart(c,{
    type:'bar',
    data:{labels:[`${mLabel}: Gastos`,`${mLabel}: Investimentos`],datasets:[{data:[me,mi],backgroundColor:['#dc2626','#2563eb']}]},
    options:{responsive:true,maintainAspectRatio:true,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{color:tclr(),callback:v=>fmtR(v)},grid:{color:gclr()}},y:{ticks:{color:tclr()}}}}
  });
}

function renderGauge(all){
  if(!S.salary){$('gaugeContent').innerHTML='<p style="color:var(--muted);font-size:13px;text-align:center">Configure seu salário em Metas</p>';return}
  const spent=all.filter(e=>status(e,e._ym)==='paid').reduce((s,e)=>s+e.amount,0);
  const pct=Math.min((spent/S.salary)*100,100);
  const sc=pct>=80?'crit':pct>=50?'warn':'ok';
  const scColor=pct>=80?'#dc2626':pct>=50?'#d97706':'#16a34a';
  $('gaugePieWrap').style.display='none';
  if(S.gaugeType==='ring'){
    $('gaugeContent').innerHTML=`
      <div style="position:relative;width:160px;height:160px;margin:0 auto">
        <svg width="160" height="160" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r="64" fill="none" stroke="var(--border)" stroke-width="16"/>
          <circle cx="80" cy="80" r="64" fill="none" stroke="${scColor}" stroke-width="16"
            stroke-dasharray="${2*Math.PI*64}" stroke-dashoffset="${2*Math.PI*64*(1-pct/100)}"
            stroke-linecap="round" transform="rotate(-90 80 80)"/>
        </svg>
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
          <div style="font-size:22px;font-weight:700;color:${scColor}">${pct.toFixed(0)}%</div>
          <div style="font-size:10px;color:var(--muted)">do salário</div>
        </div>
      </div>
      <div style="text-align:center;margin-top:8px;font-size:12px;color:var(--muted)">${fmtR(spent)} de ${fmtR(S.salary)}</div>`;
  } else if(S.gaugeType==='bar'){
    $('gaugeContent').innerHTML=`
      <div style="width:100%">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px"><span>${fmtR(spent)}</span><span>${fmtR(S.salary)}</span></div>
        <div class="gbar-bg" style="height:18px"><div class="gbar-fill ${sc}" style="width:${pct}%;height:18px"></div></div>
        <div class="gmeta"><span>${pct.toFixed(1)}% comprometido</span><span style="color:${scColor}">${pct>=80?'🔴 Crítico':pct>=50?'🟡 Moderado':'🟢 Normal'}</span></div>
      </div>`;
  } else if(S.gaugeType==='pie'){
    $('gaugeContent').innerHTML='';
    $('gaugePieWrap').style.display='flex';
    const pc=$('gaugePieCanvas');
    if(charts.gauge)charts.gauge.destroy();
    charts.gauge=new Chart(pc,{
      type:'doughnut',
      data:{labels:['Comprometido','Disponível'],datasets:[{data:[spent,Math.max(0,S.salary-spent)],backgroundColor:[scColor,'var(--border)'],borderWidth:0}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'70%',plugins:{legend:{display:false}}}
    });
  }
}

/* ═══════════════════════════════════════════════════════════
   METAS
═══════════════════════════════════════════════════════════ */
async function saveMeta(){
  S.goal=parseFloat($('goalInput').value)||null;
  S.salary=parseFloat($('salaryInput').value)||null;
  S.saveGoalPct=parseFloat($('saveGoalInput').value)||null;
  await persist();
  renderMeta();checkAlerts();
  if($('tab-dashboard').classList.contains('active')){destroyAll();renderAllCharts()}
}

function renderMeta(){
  const me=monthlyExpenses();
  const spent=me.filter(e=>status(e,e._ym)==='paid').reduce((s,e)=>s+e.amount,0);
  const pending=me.filter(e=>status(e,e._ym)==='pending').reduce((s,e)=>s+e.amount,0);
  const goal=parseFloat(S.goal)||0;
  const salary=parseFloat(S.salary)||0;
  let html='';
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
  const ov=filterByMonth(S.expenses).filter(e=>status(e,e._ym)==='overdue');
  const alOv=$('al-overdue');
  if(ov.length){alOv.style.display='';alOv.innerHTML=`<div class="alert alert-red">🔴 <b>${ov.length} lançamento(s) vencido(s)</b> — total: ${fmtR(ov.reduce((s,e)=>s+e.amount,0))}</div>`}
  else alOv.style.display='none';
  const alG=$('al-goal');
  if(!S.goal){alG.style.display='none';return}
  const spent=filterByMonth(S.expenses).filter(e=>status(e,e._ym)==='paid').reduce((s,e)=>s+e.amount,0);
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
  const spent=me.filter(e=>status(e,e._ym)==='paid').reduce((s,e)=>s+e.amount,0);
  const ov=filterByMonth(S.expenses).filter(e=>status(e,e._ym)==='overdue');
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
   TOGGLE PASSWORD VISIBILITY
═══════════════════════════════════════════════════════════ */
function togglePass(inputId, btn) {
  const inp = $(inputId);
  if (!inp) return;
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.textContent = show ? '🙈' : '👁️';
  btn.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
}

/* ═══════════════════════════════════════════════════════════
   GLOBAL MODAL CLOSE
═══════════════════════════════════════════════════════════ */
$$('.mov').forEach(m=>{m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open')})});
document.addEventListener('keydown',e=>{if(e.key==='Escape')$$('.mov').forEach(m=>m.classList.remove('open'))});

/* ═══════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════ */
function syncSearchPlaceholder(){
  const inp=$('srch');if(!inp)return;
  inp.placeholder=window.innerWidth<=768?'':'Buscar por nome...';
}
window.addEventListener('resize',syncSearchPlaceholder);
applyTheme();
syncSearchPlaceholder();
// onAuthStateChanged (acima) substitui checkSession()

/* ═══════════════════════════════════════════════════════════
   EXPOR FUNÇÕES AO WINDOW
   type="module" isola o escopo do JS — sem isso os onclick/
   oninput/onchange do HTML não encontram as funções.
═══════════════════════════════════════════════════════════ */
Object.assign(window, {
  // Auth
  doLogin, doRegister, doLogout, swLoginTab, toggleTheme,
  // Navigation
  goTab, openSB, closeSB, openExport,
  // Modals
  openModal, openInvModal, closeModal,
  // Expense
  saveExpense, sortBy, renderTable, markPaid, delExp, editExp,
  openScopeModal, closeScopeModal, applyScopeMonth, applyScopeAll, _handleScopeChoice,
  onNameInput, applySugg, onRecChange,
  // Investment
  saveInvestment, delInv,
  // Category
  addCat,
  // Meta
  saveMeta,
  // Dashboard
  setPeriod, setGaugeType,
  // Month bar
  setMonth, setYear,
  // Export
  exportCSV, exportJSON,
  // Password toggle
  togglePass,
});
