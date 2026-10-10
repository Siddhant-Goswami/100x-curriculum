/* ============================================================
   THE MODELING LAB — app controller
   Linear lesson player (one concept per screen) + Arena.
   ============================================================ */

const LS_KEY = 'modeling-lab.v2';
const LEGACY_LS_KEY = 'modeling-lab.v1';
const state = load();
function uid(prefix='id'){ return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }
function load(){
  try{
    const raw=localStorage.getItem(LS_KEY) || localStorage.getItem(LEGACY_LS_KEY);
    return raw ? JSON.parse(raw) : {};
  }catch(e){ return {}; }
}
function persist(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }catch(e){} }
state.pos        = Number.isInteger(state.pos) ? state.pos : 0;
state.maxReached = Number.isInteger(state.maxReached) ? state.maxReached : 0;
state.answered   = state.answered && typeof state.answered==='object' ? state.answered : {};
state.schemas    = state.schemas && typeof state.schemas==='object' ? state.schemas : {};
state.solved     = state.solved && typeof state.solved==='object' ? state.solved : {};

/* ---------- DOM helpers ---------- */
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
function el(html){ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstElementChild; }
function ic(name,attrs=''){ return `<i data-lucide="${name}" ${attrs}></i>`; }
function icons(){ if(window.lucide) try{ lucide.createIcons(); }catch(e){} }
function esc(s){ return (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toast(msg, kind=''){ const t=$('#toast'); t.innerHTML=(kind==='good'?ic('check'):kind==='bad'?ic('x'):'')+`<span>${msg}</span>`; t.className='toast show '+kind; icons(); clearTimeout(t._t); t._t=setTimeout(()=>t.className='toast',2600); }

/* ---------- flatten modules into a linear step list ---------- */
const FLAT=[]; const MOD_START=[];
MODULES.forEach((m,mi)=>{ MOD_START[mi]=FLAT.length; m.steps.forEach((step,si)=>FLAT.push({gi:FLAT.length, mi, si, module:m, step})); });
const TOTAL=FLAT.length;
state.pos=Math.max(0,Math.min(TOTAL-1,state.pos));
state.maxReached=Math.max(state.pos,Math.min(TOTAL-1,state.maxReached));
function moduleOf(gi){ return FLAT[gi].mi; }
function moduleUnlocked(mi){ return MODULES[mi].open || MOD_START[mi] <= state.maxReached; }
function moduleDone(mi){
  if(MODULES[mi].arena) return CHALLENGES.every(c=>state.solved[c.id]);
  const next = MOD_START[mi+1];
  return next!==undefined && state.maxReached >= next;
}

/* ---------- navigation ---------- */
function goStep(gi){
  gi=Math.max(0,Math.min(TOTAL-1,gi));
  state.pos=gi; state.maxReached=Math.max(state.maxReached,gi); persist();
  closeSidebar();
  render(); window.scrollTo({top:0,behavior:'smooth'});
  $('#stage').focus({preventScroll:true});
}
function goModule(mi){ if(moduleUnlocked(mi)) goStep(MOD_START[mi]); }
function closeSidebar(){
  const sidebar=$('#sidebar'), menu=$('#menuBtn'), scrim=$('#scrim');
  sidebar.classList.remove('open'); scrim.classList.remove('open');
  menu.setAttribute('aria-expanded','false'); menu.setAttribute('aria-label','Open course navigation');
}
function openSidebar(){
  const sidebar=$('#sidebar'), menu=$('#menuBtn'), scrim=$('#scrim');
  sidebar.classList.add('open'); scrim.classList.add('open');
  menu.setAttribute('aria-expanded','true'); menu.setAttribute('aria-label','Close course navigation');
  $('.mod.active',sidebar)?.focus();
}

/* ============================================================
   SIDEBAR + TOPBAR
   ============================================================ */
function renderNav(){
  const nav=$('#moduleNav'); nav.innerHTML='';
  MODULES.forEach((m,mi)=>{
    const unlocked=moduleUnlocked(mi), done=moduleDone(mi), active=moduleOf(state.pos)===mi;
    const item=el(`<button type="button" class="mod ${active?'active':''} ${done?'done':''} ${unlocked?'':'locked'}" ${active?'aria-current="step"':''} ${unlocked?'':'disabled'}>
        <span class="mod-ic">${ic(done?'check':m.icon)}</span>
        <span class="mod-label">${m.title}</span>
        ${m.arena?`<span class="mod-meta">${CHALLENGES.filter(c=>state.solved[c.id]).length}/${CHALLENGES.length}</span>`:''}
        ${unlocked?'':ic('lock','width=14 height=14')}
      </button>`);
    if(unlocked) item.onclick=()=>goModule(mi);
    nav.appendChild(item);
  });
  icons();
}
function renderTop(){
  const pct=Math.round(state.pos/(TOTAL-1)*100);
  $('#progressFill').style.width = pct+'%';
  $('#progressBar').setAttribute('aria-valuenow',String(pct));
  const m=FLAT[state.pos].module;
  $('#progressLabel').textContent = m.arena ? 'The Arena' : `${m.title} · ${state.pos+1}/${TOTAL}`;
}

/* ============================================================
   STEP RENDERERS
   ============================================================ */
function render(){
  const {step}=FLAT[state.pos];
  renderNav(); renderTop();
  const stage=$('#stage'); stage.innerHTML='';
  const footer=$('#stepFooter');

  if(step.t==='arena'){ footer.style.display='none'; renderArena(stage); icons(); return; }
  if(step.t==='build'){ footer.style.display='none'; renderMyApp(stage); icons(); return; }
  footer.style.display='flex';

  const node = ({intro:renderIntro,demo:renderDemo,concept:renderConcept,quiz:renderQuiz,er:renderErStep}[step.t]||renderConcept)(step);
  stage.appendChild(node);
  renderFooter();
  icons();
}

function renderIntro(step){
  return el(`<div class="step center">
    <div class="eyebrow-row" style="justify-content:center"><span class="pill pill--coral">${ic('sparkles')} Cohort 7 · domain modeling</span></div>
    <h1 style="font-size:var(--fs-display);line-height:1.05">${step.title.replace(/\n/g,'<br>')}</h1>
    <p class="subtitle" style="font-size:var(--fs-h4);max-width:560px;margin:0 auto var(--space-4)">${step.subtitle}</p>
    <p class="body" style="max-width:600px;margin:0 auto;text-align:left">${step.body}</p>
  </div>`);
}

/* Socratic "pause and think" callout — posed BEFORE the reveal */
function askHTML(step){
  return step.ask?`<div class="ask">${ic('help-circle')}<div class="ask-c"><span class="ask-k">Pause &amp; think</span><p>${step.ask}</p></div></div>`:'';
}

function renderConcept(step){
  return el(`<div class="step">
    <div class="eyebrow-row">${ic('circle-dot')}<span class="eyebrow eyebrow--accent">${step.eyebrow||'Concept'}</span></div>
    <h1>${step.title}</h1>
    ${step.subtitle?`<p class="subtitle">${step.subtitle}</p>`:''}
    ${askHTML(step)}
    ${step.body?`<details class="reveal"><summary>${ic('eye')} Reveal explanation</summary><div class="reveal-body"><p class="body">${step.body}</p></div></details>`:''}
    ${step.art||''}
  </div>`);
}

/* static ER reveal — renders a predefined schema as an ER diagram */
function renderErStep(step){
  return el(`<div class="step">
    <div class="eyebrow-row">${ic('git-fork')}<span class="eyebrow eyebrow--accent">${step.eyebrow||'ER diagram'}</span></div>
    <h1>${step.title}</h1>
    ${step.subtitle?`<p class="subtitle">${step.subtitle}</p>`:''}
    ${askHTML(step)}
    ${step.body?`<p class="body">${step.body}</p>`:''}
    <div class="er-static">${renderER(step.schema||[])}</div>
  </div>`);
}

function renderQuiz(step){
  const gi=state.pos; const answered=!!state.answered[gi];
  const node=el(`<div class="step">
    <div class="eyebrow-row">${ic('help-circle')}<span class="eyebrow eyebrow--accent">${step.eyebrow||'Quick check'}</span></div>
    <h2 class="q-prompt">${step.prompt}</h2>
    ${step.scn?`<p class="q-scn">${step.scn}</p>`:''}
    <div class="choices"></div>
    <div class="explain" role="status" aria-live="polite"></div>
  </div>`);
  const choices=$('.choices',node), explain=$('.explain',node);
  step.options.forEach(opt=>{
    const b=el(`<button type="button" class="choice ${answered?'locked':''} ${answered&&opt.correct?'correct':''}" ${answered?'disabled':''}><span class="mark">${ic('check')}</span><span>${opt.label}</span></button>`);
    if(answered && opt.correct){ /* keep shown */ }
    b.onclick=()=>{
      if(state.answered[gi]) return;
      if(opt.correct){
        $$('.choice',choices).forEach(c=>{ c.classList.add('locked'); c.disabled=true; });
        b.classList.add('correct');
        explain.innerHTML=`<div class="card card--surface">${ic('lightbulb')}<p>${opt.fb}</p></div>`;
        state.answered[gi]=true; persist();
        toast('Correct','good');
        $('#continueBtn').disabled=false; $('#continueBtn').classList.remove('is-off');
        icons();
      } else {
        b.classList.remove('wrong'); void b.offsetWidth; b.classList.add('wrong');
        explain.innerHTML=`<div class="card card--surface" style="border-color:#FDE68A">${ic('info')}<p>${opt.fb}</p></div>`;
        icons();
      }
    };
    choices.appendChild(b);
  });
  if(answered){ const o=step.options.find(x=>x.correct); explain.innerHTML=`<div class="card card--surface">${ic('lightbulb')}<p>${o.fb}</p></div>`; }
  return node;
}

/* amnesia demo */
function renderDemo(){
  const node=el(`<div class="step">
    <div class="eyebrow-row">${ic('zap')}<span class="eyebrow eyebrow--accent">Feel it first</span></div>
    <h1>Aarav's app has amnesia.</h1>
    <p class="subtitle">Be Aarav for a moment. Send a few messages, then restart the server and watch them vanish.</p>
    <div class="demo-chat">
      <div class="demo-top"><span class="demo-status" id="dstat"><span class="dot"></span> server running</span><span class="mono" id="dmem" style="font-size:12px;color:var(--fg-muted)">memory: 0 msgs</span></div>
      <div class="demo-body" id="dbody"><div class="demo-empty">No messages yet, say something.</div></div>
      <div class="demo-in"><input class="input" id="din" placeholder="Type a message…" autocomplete="off"><button class="btn btn--primary btn--sm" id="dsend">Send</button></div>
    </div>
    <div class="row-wrap"><button class="btn btn--secondary btn--sm" id="drestart">${ic('rotate-ccw')} Restart server</button><span class="body-sm" id="dnote"></span></div>
    <p class="body mt-4">Everything a running program holds lives in <b>memory</b>, and memory dies the instant the program stops. So Aarav needs a place <i>outside</i> the program. But a place to put things is useless until you know <b>what shape</b> those things are. That shape is what we model next.</p>
  </div>`);
  let msgs=[];
  const body=$('#dbody',node), input=$('#din',node);
  const draw=()=>{ body.innerHTML = msgs.length? msgs.map(m=>`<div class="bub ${m.r}">${esc(m.t)}</div>`).join('') : '<div class="demo-empty">No messages yet, say something.</div>'; body.scrollTop=body.scrollHeight; $('#dmem',node).textContent='memory: '+msgs.length+' msgs'; };
  const send=()=>{ const v=input.value.trim(); if(!v)return; msgs.push({r:'u',t:v}); msgs.push({r:'b',t:['Got it.','Noted.','Tell me more.','Sure thing.'][v.length%4]}); input.value=''; draw(); };
  $('#dsend',node).onclick=send; input.onkeydown=e=>{ if(e.key==='Enter')send(); };
  $('#drestart',node).onclick=()=>{
    if(!msgs.length){ toast('Send a message first'); return; }
    const had=msgs.length; msgs=[]; draw();
    const st=$('#dstat',node); st.classList.add('off'); st.innerHTML='<span class="dot"></span> restarting…';
    setTimeout(()=>{ const s2=$('#dstat',node); if(s2){ s2.classList.remove('off'); s2.innerHTML='<span class="dot"></span> server running'; } },700);
    $('#dnote',node).innerHTML=`<b style="color:var(--error)">${had} messages gone.</b> They lived in memory.`;
  };
  return node;
}

/* ---------- footer ---------- */
function renderFooter(){
  const gi=state.pos, {step}=FLAT[gi];
  const back=$('#backBtn'), cont=$('#continueBtn'), dots=$('#stepDots');
  back.style.visibility = gi===0 ? 'hidden':'visible';
  back.onclick=()=>goStep(gi-1);

  const blocked = step.t==='quiz' && !state.answered[gi];
  cont.disabled = blocked;
  const next = FLAT[gi+1];
  const intoArena = next && next.step.t==='arena';
  cont.innerHTML = (intoArena?'Enter the Arena ':'Continue ')+ic('arrow-right');
  cont.onclick=()=>{ if(!cont.disabled) goStep(gi+1); };

  // dots within current module
  const mi=moduleOf(gi); const start=MOD_START[mi]; const len=MODULES[mi].steps.length;
  dots.innerHTML='';
  for(let k=0;k<len;k++){ const g=start+k; dots.appendChild(el(`<span class="sdot ${g<gi?'done':''} ${g===gi?'cur':''}"></span>`)); }
  icons();
}

/* ============================================================
   SCHEMA BUILDER (shared by Arena)
   ============================================================ */
function isPk(col){ return col.primary===true || col.key==='pk'; }
function isFk(col){ return col.foreign===true || col.key==='fk'; }
function blankCol(name='',type='text',key='none'){
  return {id:uid('col'),name,type,key:'none',primary:key==='pk',foreign:key==='fk',fkRef:'',required:true,unique:false};
}
function blankTable(name=''){ return {id:uid('tbl'),name,columns:[blankCol('id','id','pk')]}; }

function normalizeSchema(raw){
  const schema=Array.isArray(raw) ? raw : [];
  const tables=schema.map(t=>({
    id:t.id||uid('tbl'),
    name:typeof t.name==='string'?t.name:'',
    columns:Array.isArray(t.columns)?t.columns.map(c=>({
      id:c.id||uid('col'),
      name:typeof c.name==='string'?c.name:'',
      type:c.type==='number'?'decimal':(COL_TYPES.includes(c.type)?c.type:'text'),
      key:'none',
      primary:c.primary===true || c.key==='pk',
      foreign:c.foreign===true || c.key==='fk',
      fkRef:c.fkRef||'',
      required:c.required!==false,
      unique:!!c.unique && c.key!=='pk',
    })):[blankCol('id','id','pk')],
  }));
  const byName=new Map(tables.map(t=>[t.name,t.id]));
  tables.forEach(t=>t.columns.forEach(c=>{
    if(isFk(c) && byName.has(c.fkRef)) c.fkRef=byName.get(c.fkRef);
    if(!isFk(c)) c.fkRef='';
  }));
  return tables.length?tables:[blankTable('')];
}

function makeBuilder(mountSel, key, opts={}){
  const mount=$(mountSel);
  let schema=state.schemas[key];
  if(!schema) schema=(opts.starter||['']).map(n=>blankTable(n));
  schema=normalizeSchema(schema); state.schemas[key]=schema; persist();
  const save=()=>{ state.schemas[key]=schema; persist(); };

  function draw(){
    mount.innerHTML='';
    const grid=el(`<div class="tables-grid"></div>`);
    schema.forEach((t,ti)=>grid.appendChild(drawTable(t,ti)));
    mount.appendChild(grid); icons();
  }
  function drawTable(tbl,ti){
    const card=el(`<div class="tbl">
      <div class="tbl-head">${ic('table-2')}<input value="${esc(tbl.name)}" placeholder="table_name" aria-label="Table name"><button type="button" class="icon-btn" aria-label="Delete table">${ic('trash-2')}</button></div>
      <div class="cols"></div></div>`);
    const ni=$('input',card);
    ni.oninput=()=>{ tbl.name=ni.value; save(); };
    ni.onchange=()=>draw();
    $('.icon-btn',card).onclick=()=>{ schema.splice(ti,1); if(!schema.length)schema.push(blankTable('')); save(); draw(); };
    const cols=$('.cols',card);
    tbl.columns.forEach((c,ci)=>cols.appendChild(drawCol(tbl,c,ci)));
    const add=el(`<button class="btn btn--ghost btn--sm add-col">${ic('plus')} add column</button>`);
    add.onclick=()=>{ tbl.columns.push(blankCol()); save(); draw(); };
    cols.appendChild(add);
    return card;
  }
  function drawCol(tbl,col,ci){
    const others=schema.filter(t=>t.id!==tbl.id && t.name);
    const row=el(`<div class="col-row">
      <input class="input col-name" value="${esc(col.name)}" placeholder="column" aria-label="Column name">
      <select class="select type-sel" aria-label="Data type">${COL_TYPES.map(t=>`<option ${col.type===t?'selected':''}>${t}</option>`).join('')}</select>
      <label class="constraint-check key-check" title="Primary key"><input type="checkbox" class="primary-check" ${isPk(col)?'checked':''}> PK</label>
      <label class="constraint-check key-check" title="Foreign key"><input type="checkbox" class="foreign-check" ${isFk(col)?'checked':''}> FK</label>
      ${isFk(col)?`<select class="select fk-target" aria-label="Referenced table"><option value="">→ table…</option>${others.map(t=>`<option value="${esc(t.id)}" ${col.fkRef===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select>`:''}
      <label class="constraint-check" title="Required (NOT NULL)"><input type="checkbox" class="required-check" ${col.required?'checked':''}> NN</label>
      <label class="constraint-check" title="Unique"><input type="checkbox" class="unique-check" ${col.unique?'checked':''}> UQ</label>
      <button type="button" class="icon-btn col-del" aria-label="Remove column">${ic('x','width=15 height=15')}</button></div>`);
    $('.col-name',row).oninput=e=>{ col.name=e.target.value; save(); };
    $('.type-sel',row).onchange=e=>{ col.type=e.target.value; save(); };
    $('.primary-check',row).onchange=e=>{ col.primary=e.target.checked; col.key='none'; if(col.primary)col.required=true; save(); draw(); };
    $('.foreign-check',row).onchange=e=>{ col.foreign=e.target.checked; col.key='none'; if(!col.foreign)col.fkRef=''; save(); draw(); };
    $('.required-check',row).onchange=e=>{ col.required=e.target.checked; save(); };
    $('.unique-check',row).onchange=e=>{ col.unique=e.target.checked; save(); };
    const ft=$('.fk-target',row);
    if(ft){ ft.onchange=e=>{ col.fkRef=e.target.value; save(); }; }
    $('.col-del',row).onclick=()=>{ tbl.columns.splice(ci,1); save(); draw(); };
    return row;
  }
  draw();
  return { getSchema:()=>schema, addTable:()=>{schema.push(blankTable(''));save();draw();}, reset:()=>{schema=(opts.starter||['']).map(n=>blankTable(n));save();draw();} };
}

/* ---------- CSV / sheets / ER ---------- */
function sampleVal(col,n){
  if(isPk(col)||col.type==='id') return n;
  if(isFk(col)) return 1;
  if(col.type==='integer') return n*10;
  if(col.type==='decimal') return (n*10.5).toFixed(2);
  if(col.type==='date') return '2026-06-0'+n;
  if(col.type==='timestamp') return `2026-06-0${n}T10:00:00Z`;
  if(col.type==='boolean') return n%2?'true':'false';
  if(col.type==='uuid') return `00000000-0000-4000-8000-00000000000${n}`;
  return `${col.name}_${n}`;
}
function liveTables(schema){ return schema.filter(t=>t.name && t.columns.some(c=>c.name)); }
function tableForRef(schema,ref){ return schema.find(t=>t.id===ref || nameEq(t.name,ref)); }
function csvCell(value){
  const s=String(value??'');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
}
function csvFiles(schema){
  return liveTables(schema).map(t=>{
    const cols=t.columns.filter(c=>c.name);
    const content=[cols.map(c=>csvCell(c.name)).join(','),...[1,2].map(n=>cols.map(c=>csvCell(sampleVal(c,n))).join(','))].join('\n');
    return {name:`${safeFileName(t.name)}.csv`,content};
  });
}
function safeFileName(name){ return (name||'table').trim().replace(/[^a-z0-9_-]+/gi,'_').replace(/^_+|_+$/g,'')||'table'; }
function triggerDownload(name,content,type){
  const url=URL.createObjectURL(new Blob([content],{type}));
  const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function downloadCSVs(schema){
  const files=csvFiles(schema);
  if(!files.length){ toast('Add a named table with columns first','bad'); return; }
  files.forEach(file=>triggerDownload(file.name,file.content,'text/csv;charset=utf-8'));
  toast(`Downloading ${files.length} valid CSV file${files.length===1?'':'s'}`,'good');
}
function sqlIdent(value){ return `"${String(value||'').replace(/"/g,'""')}"`; }
function sqlType(type){
  return ({text:'TEXT',integer:'INTEGER',decimal:'DECIMAL(12,2)',boolean:'BOOLEAN',date:'DATE',timestamp:'TIMESTAMPTZ',uuid:'UUID',id:'BIGINT'})[type]||'TEXT';
}
function schemaToSQL(schema){
  const tables=liveTables(schema);
  const creates=tables.map(t=>{
    const cols=t.columns.filter(c=>c.name);
    const pk=cols.filter(isPk);
    const defs=cols.map(c=>{
      const bits=[sqlIdent(c.name),sqlType(c.type)];
      if(c.required) bits.push('NOT NULL');
      if(c.unique && !isPk(c)) bits.push('UNIQUE');
      if(isPk(c) && pk.length===1) bits.push('PRIMARY KEY');
      return `  ${bits.join(' ')}`;
    });
    if(pk.length>1) defs.push(`  PRIMARY KEY (${pk.map(c=>sqlIdent(c.name)).join(', ')})`);
    return `CREATE TABLE ${sqlIdent(t.name)} (\n${defs.join(',\n')}\n);`;
  });
  const refs=[];
  tables.forEach(t=>t.columns.filter(c=>isFk(c)&&c.name).forEach(c=>{
    const target=tableForRef(tables,c.fkRef);
    const targetPks=target?target.columns.filter(x=>isPk(x)&&x.name):[];
    if(target&&targetPks.length===1){
      const constraint=safeFileName(`fk_${t.name}_${c.name}`);
      refs.push(`ALTER TABLE ${sqlIdent(t.name)} ADD CONSTRAINT ${sqlIdent(constraint)} FOREIGN KEY (${sqlIdent(c.name)}) REFERENCES ${sqlIdent(target.name)} (${sqlIdent(targetPks[0].name)});`);
    } else if(target&&targetPks.length>1){
      refs.push(`-- ${t.name}.${c.name}: composite foreign keys must reference every primary-key column on ${target.name}.`);
    }
  }));
  return [...creates,...refs].join('\n\n');
}
function downloadSQL(schema,fname='schema.sql'){
  const sql=schemaToSQL(schema);
  if(!sql){ toast('Add a named table with columns first','bad'); return; }
  triggerDownload(fname,sql,'text/sql;charset=utf-8');
}
function renderSheets(schema){
  const tables=liveTables(schema);
  if(!tables.length) return '<p class="body-sm muted">Add tables and columns to preview the sheets.</p>';
  return tables.map(t=>{ const cols=t.columns.filter(c=>c.name);
    return `<div class="sheet"><h4>${ic('file-spreadsheet')} ${esc(t.name)}.csv</h4><div class="sheet-scroll"><table class="sheet-tbl">
      <tr>${cols.map(c=>`<th>${esc(c.name)}${isPk(c)?' ·pk':''}${isFk(c)?' ·fk':''}${c.required?' ·nn':''}${c.unique?' ·uq':''}</th>`).join('')}</tr>
      ${[1,2].map(n=>`<tr>${cols.map(c=>`<td>${esc(sampleVal(c,n))}</td>`).join('')}</tr>`).join('')}</table></div></div>`; }).join('');
}
function renderER(schema){
  const tables=liveTables(schema);
  if(!tables.length) return '<p class="body-sm muted">Add tables to see the ER diagram.</p>';
  const boxes=tables.map(t=>{ const cols=t.columns.filter(c=>c.name);
    return `<div class="er-box"><div class="er-box-h">${esc(t.name)}</div><ul>${cols.map(c=>`<li><span class="key-tags">${isPk(c)?'<span class="kt pk">pk</span>':''}${isFk(c)?'<span class="kt fk">fk</span>':''}</span>${esc(c.name)}${c.required?' <span class="constraint">NN</span>':''}${c.unique?' <span class="constraint">UQ</span>':''}</li>`).join('')}</ul></div>`; }).join('');
  const rels=[];
  tables.forEach(t=>t.columns.forEach(c=>{
    if(!isFk(c)||!c.fkRef) return;
    const target=tableForRef(tables,c.fkRef);
    const oneToOne=c.unique || (isPk(c)&&t.columns.filter(isPk).length===1);
    if(target) rels.push(`<div class="rel">${esc(target.name)} <span class="crow">${oneToOne?'1 ─── 1':'1 ──&lt; ∞'}</span> ${esc(t.name)} <span class="muted">(via ${esc(c.name)})</span></div>`);
  }));
  return `<div class="er-wrap"><div class="er-entities">${boxes}</div>${rels.length?`<div class="er-rels"><h4>Relationships</h4>${rels.join('')}</div>`:''}</div>`;
}

/* result banner */
function resultHTML(res){
  const msg=res.status==='pass'?'Schema accepted':res.status==='partial'?'Almost there':'Keep modeling';
  return `<div class="score ${res.status}"><div class="score-ring" style="--p:${res.pct}%"><span>${res.pct}</span></div>
    <div class="score-msg"><h2>${msg}</h2><p>${res.score.toFixed(0)} / ${res.max} points · pass at 85%</p></div></div>
    <ul class="fb-list">${res.feedback.map(f=>`<li class="fb ${f.type}">${ic({good:'check',miss:'x',warn:'alert-triangle',tip:'sparkles'}[f.type]||'circle')}<span>${f.html}</span></li>`).join('')}</ul>`;
}

/* ============================================================
   THE ARENA
   ============================================================ */
function renderArena(stage){
  if(state.arenaEx && CHALLENGES.find(c=>c.id===state.arenaEx)) return renderExercise(stage, CHALLENGES.find(c=>c.id===state.arenaEx));

  const tiers=[['beginner','Beginner','seedling'],['intermediate','Intermediate','trending-up'],['advanced','Advanced','flame']];
  const solvedCount=CHALLENGES.filter(c=>state.solved[c.id]).length;
  const wrap=el(`<div class="step step--wide">
    <div class="arena-head">
      <div class="eyebrow-row">${ic('dumbbell')}<span class="eyebrow eyebrow--accent">The Arena · ${solvedCount}/${CHALLENGES.length} solved</span></div>
      <h1>Model it yourself.</h1>
      <p class="subtitle">Pick a brief, design the model, then submit for focused feedback on the exercise's entities, keys, constraints, and relationships.</p>
    </div>
    <div id="tiers"></div>
    <div id="arenaCert"></div>
    <div class="myapp-cta card card--feature">
      <div>
        <h3 class="h4" style="margin:0 0 4px">Ready to model your own app?</h3>
        <p class="body-sm" style="margin:0">Take the same three questions to the idea you actually want to build.</p>
      </div>
      <button class="btn btn--primary" id="toMyApp">${ic('pen-tool')} Open Your blueprint</button>
    </div>
  </div>`);
  const tcont=$('#tiers',wrap);
  tiers.forEach(([key,label,icon])=>{
    const list=CHALLENGES.filter(c=>c.difficulty===key);
    const sec=el(`<div class="tier"><h3 class="tier-title h4">${ic(icon)} ${label}</h3><div class="ex-grid"></div></div>`);
    const grid=$('.ex-grid',sec);
    list.forEach(c=>{
      const solved=state.solved[c.id];
      const card=el(`<button class="ex-card"><div class="ex-top"><span class="diffpill ${c.difficulty}">${c.skill}</span>${solved?`<span class="ex-solved">${ic('check-circle-2')}</span>`:''}</div>
        <h3>${c.title}</h3><p>${c.blurb}</p></button>`);
      card.onclick=()=>{ state.arenaEx=c.id; persist(); render(); window.scrollTo({top:0}); };
      grid.appendChild(card);
    });
    tcont.appendChild(sec);
  });
  if(solvedCount===CHALLENGES.length) $('#arenaCert',wrap).innerHTML=certHTML();
  stage.appendChild(wrap);
  const myAppMi=MODULES.findIndex(m=>m.id==='myapp');
  if(myAppMi>=0) $('#toMyApp',wrap).onclick=()=>goModule(myAppMi);
}

/* ============================================================
   YOUR BLUEPRINT — the custom capstone (free-form, ungraded)
   ============================================================ */
function renderMyApp(stage){
  state.myappDesc = state.myappDesc || '';
  const wrap=el(`<div class="step step--wide">
    <div class="arena-head">
      <div class="eyebrow-row">${ic('pen-tool')}<span class="eyebrow eyebrow--accent">Your blueprint · the capstone</span></div>
      <h1>Now model YOUR app.</h1>
      <p class="subtitle">The same three questions you used for Aarav, pointed at the thing you actually want to build. Nothing here is graded. This is your real design.</p>
    </div>

    <div class="myapp-q">
      <div class="myapp-qcard"><span class="myapp-qn">1</span><b>What are the things?</b><p>Collect candidate nouns, then test whether each needs its own identity, lifecycle, rules, and queries.</p></div>
      <div class="myapp-qcard"><span class="myapp-qn">2</span><b>What does each thing have?</b><p>List the facts you would need to recreate one. Those are its columns. If it only describes something else, it is an attribute, not a table.</p></div>
      <div class="myapp-qcard"><span class="myapp-qn">3</span><b>How do they connect?</b><p>Name minimum and maximum cardinality. Use an FK for one-to-many, a unique FK for one-to-one, and a join table for many-to-many.</p></div>
    </div>

    <div class="card card--surface model-checklist">
      <h3 class="h4">Before calling the model done</h3>
      <p class="body-sm">Try to create an invalid state: a duplicate enrollment, two analytics rows for one post, a required relationship with no parent, or history that gets overwritten. Use PK/FK, NN, UQ, and composite keys to block what the product says must never happen.</p>
    </div>

    <label class="label" for="myDesc" style="margin-top:var(--space-2)">In one line, what does your app do?</label>
    <textarea class="textarea" id="myDesc" rows="2" placeholder="e.g. A user types a messy goal and gets back a structured weekly plan.">${esc(state.myappDesc)}</textarea>

    <div class="work-toolbar" style="margin-top:var(--space-5)">
      <button class="btn btn--secondary btn--sm" id="addTbl">${ic('plus')} Add table</button>
      <button class="btn btn--ghost btn--sm" id="resetTbl">${ic('rotate-ccw')} Reset</button>
      <span class="body-sm muted">PK and FK can both be checked. NN = required; UQ = individually unique.</span>
    </div>
    <div id="mybuilder"></div>

    <div class="row-wrap" style="margin-top:var(--space-5)">
      <button class="btn btn--primary" id="erBtn">${ic('git-fork')} View ER diagram</button>
      <button class="btn btn--secondary btn--sm" id="sheetBtn">${ic('table')} CSV sheets</button>
      <button class="btn btn--ghost btn--sm" id="csvBtn">${ic('download')} Sample CSVs</button>
      <button class="btn btn--ghost btn--sm" id="sqlBtn">${ic('file-code-2')} SQL schema</button>
      <button class="btn btn--ghost btn--sm" id="toArena">${ic('arrow-left')} Back to the Arena</button>
    </div>
    <div id="myResult" style="margin-top:var(--space-4)"></div>
  </div>`);
  stage.appendChild(wrap);

  const builder=makeBuilder('#mybuilder','myapp',{starter:['users']});
  $('#myDesc',wrap).oninput=e=>{ state.myappDesc=e.target.value; persist(); };
  $('#addTbl',wrap).onclick=()=>builder.addTable();
  $('#resetTbl',wrap).onclick=()=>{ if(confirm('Reset your blueprint to a single starter table? This clears your tables.')){ builder.reset(); $('#myResult',wrap).innerHTML=''; } };
  $('#erBtn',wrap).onclick=()=>{ $('#myResult',wrap).innerHTML=`<h3 class="h4" style="margin:var(--space-4) 0 var(--space-2)">Your ER diagram</h3>${renderER(builder.getSchema())}`; icons(); $('#myResult',wrap).scrollIntoView({behavior:'smooth',block:'start'}); };
  $('#sheetBtn',wrap).onclick=()=>{ $('#myResult',wrap).innerHTML=`<h3 class="h4" style="margin:var(--space-4) 0 var(--space-2)">Your data as CSV sheets</h3>${renderSheets(builder.getSchema())}`; icons(); };
  $('#csvBtn',wrap).onclick=()=>downloadCSVs(builder.getSchema());
  $('#sqlBtn',wrap).onclick=()=>downloadSQL(builder.getSchema(),'my_app_schema.sql');
  const arenaMi=MODULES.findIndex(m=>m.arena);
  $('#toArena',wrap).onclick=()=>{ if(arenaMi>=0) goModule(arenaMi); };
  icons();
}

function renderExercise(stage, ch){
  const wrap=el(`<div class="step step--wide">
    <button class="btn btn--ghost btn--sm" id="backList">${ic('arrow-left')} All exercises</button>
    <div class="ex-brief">
      <div class="row-wrap"><span class="diffpill ${ch.difficulty}">${ch.difficulty}</span><span class="pill pill--coral">${ic('target')} ${ch.skill}</span></div>
      <h2>${ch.title}</h2>
      <p class="story">${ch.story}</p>
      <ul class="ex-reqs">${ch.reqs.map(r=>`<li>${ic('chevron-right')}<span>${r}</span></li>`).join('')}</ul>
    </div>
    <div class="card" style="box-shadow:none;border:none;padding:0">
      <div class="work-toolbar">
        <button class="btn btn--secondary btn--sm" id="addTbl">${ic('plus')} Add table</button>
        <button class="btn btn--ghost btn--sm" id="resetTbl">${ic('rotate-ccw')} Reset</button>
        <span class="body-sm muted">${ch.rubric.entities.length} core entities expected</span>
      </div>
      <div id="builder"></div>
      <div style="margin-top:var(--space-3);display:flex;flex-direction:column;gap:8px">
        ${ch.hints.map((hh,i)=>`<details class="hint"><summary>${ic('lightbulb')} Hint ${i+1}</summary><div class="hint-body">${hh}</div></details>`).join('')}
      </div>
    </div>
    <div class="row-wrap" style="margin-top:var(--space-5)">
      <button class="btn btn--primary" id="submit">${ic('zap')} Submit for grading</button>
      <button class="btn btn--secondary btn--sm" id="erBtn">${ic('git-fork')} ER diagram</button>
      <button class="btn btn--secondary btn--sm" id="sheetBtn">${ic('table')} CSV sheets</button>
      <button class="btn btn--ghost btn--sm" id="csvBtn">${ic('download')} Sample CSVs</button>
      <button class="btn btn--ghost btn--sm" id="sqlBtn">${ic('file-code-2')} SQL schema</button>
    </div>
    <div id="exResult" style="margin-top:var(--space-4)"></div>
  </div>`);
  stage.appendChild(wrap);

  const builder=makeBuilder('#builder','arena.'+ch.id,{starter:ch.starter});
  $('#backList',wrap).onclick=()=>{ delete state.arenaEx; persist(); render(); window.scrollTo({top:0}); };
  $('#addTbl',wrap).onclick=()=>builder.addTable();
  $('#resetTbl',wrap).onclick=()=>{ if(confirm('Reset this schema to the starter tables?')){ builder.reset(); $('#exResult',wrap).innerHTML=''; } };
  $('#erBtn',wrap).onclick=()=>{ $('#exResult',wrap).innerHTML=`<h3 class="h4" style="margin:var(--space-4) 0 var(--space-2)">ER diagram</h3>${renderER(builder.getSchema())}`; icons(); };
  $('#sheetBtn',wrap).onclick=()=>{ $('#exResult',wrap).innerHTML=`<h3 class="h4" style="margin:var(--space-4) 0 var(--space-2)">Your data as CSV sheets</h3>${renderSheets(builder.getSchema())}`; icons(); };
  $('#csvBtn',wrap).onclick=()=>downloadCSVs(builder.getSchema());
  $('#sqlBtn',wrap).onclick=()=>downloadSQL(builder.getSchema(),ch.id+'_schema.sql');
  $('#submit',wrap).onclick=()=>{
    const res=gradeSchema(builder.getSchema(), ch);
    $('#exResult',wrap).innerHTML=resultHTML(res)+`<div style="margin-top:var(--space-4)"><h3 class="h4" style="margin:0 0 var(--space-2)">ER diagram</h3>${renderER(builder.getSchema())}</div>`;
    icons();
    if(res.status==='pass' && !state.solved[ch.id]){ state.solved[ch.id]=true; persist(); toast('Exercise solved','good'); }
    $('#exResult',wrap).scrollIntoView({behavior:'smooth',block:'start'});
  };
  icons();
}

function certHTML(){
  return `<div class="cert">
    <div class="big">100x</div>
    <h1>You modeled all ${CHALLENGES.length}.</h1>
    <p class="body" style="max-width:560px;margin:0 auto">You can identify entities, relationships, junction data, and historical records, then express the model as tables with keys and basic constraints. Production design continues with invariants, indexes, authorization, migrations, and query testing.</p>
    <div class="card card--surface" style="text-align:left;margin-top:var(--space-5)"><p class="body" style="margin:0">${ic('arrow-right')} <b>Next:</b> take the model to <b>Your blueprint</b>, export SQL, and test whether the schema can answer the product's real questions without losing history or allowing invalid states.</p></div>
  </div>`;
}

/* ============================================================
   BOOT
   ============================================================ */
$('#homeLink').onclick=()=>goStep(0);
$('#resetBtn').onclick=()=>{ if(confirm('Wipe all progress and saved schemas?')){ localStorage.removeItem(LS_KEY); localStorage.removeItem(LEGACY_LS_KEY); location.reload(); } };
$('#menuBtn').onclick=()=>$('#sidebar').classList.contains('open')?closeSidebar():openSidebar();
$('#scrim').onclick=()=>{ closeSidebar(); $('#menuBtn').focus(); };
document.addEventListener('keydown',e=>{
  const sidebar=$('#sidebar');
  if(e.key==='Escape'&&sidebar.classList.contains('open')){
    closeSidebar(); $('#menuBtn').focus(); return;
  }
  if(e.key==='Tab'&&sidebar.classList.contains('open')){
    const focusable=$$('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',sidebar);
    if(!focusable.length) return;
    const first=focusable[0], last=focusable[focusable.length-1];
    if(e.shiftKey&&document.activeElement===first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey&&document.activeElement===last){ e.preventDefault(); first.focus(); }
  }
});
render();
icons();
