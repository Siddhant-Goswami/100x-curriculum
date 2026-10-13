/* Lecture 6 · The Modelling Lab · page logic.
   Everything the student places is saved on this device under c8.l06.lab.
   Section 5 reads those placements back to draw Aarav's model. */
document.addEventListener('DOMContentLoaded',function(){
  var $=function(s,r){return (r||document).querySelector(s)}, $$=function(s,r){return [].slice.call((r||document).querySelectorAll(s))};
  var store=window.c8store, K='c8.l06.lab';
  var S=store.get(K,{}); ['think','tags','facts','shapes','dir','keys','quiz','sort','schemas','solved','bp'].forEach(function(k){ if(!S[k]||typeof S[k]!=='object') S[k]={}; });
  if(!Array.isArray(S.demoRows)) S.demoRows=[];
  function save(){ store.set(K,S); drawBoards(); }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function uid(p){ return (p||'id')+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
  function el(h){ var t=document.createElement('template'); t.innerHTML=h.trim(); return t.content.firstElementChild; }
  var nameEq=window.L06Check.nameEq, isPk=window.L06Check.isPk, isFk=window.L06Check.isFk;
  var D=window.L06;

  /* ================= what the student has placed so far ================= */
  function tagRight(id){ var t=D.TOKENS[id]; var c=S.tags[id]; return !!c && (c===t.role || (t.role==='file'&&c==='thing')); }
  function foundEnt(e){ return Object.keys(S.tags).some(function(id){ var t=D.TOKENS[id]; return t && t.ent===e && t.role==='thing' && S.tags[id]==='thing'; }); }
  function pairById(id){ return D.PAIRS.find(function(p){ return p.id===id; }); }
  function shapeKnown(p){ var d=S.dir[p.id]||{}; return d.ab===p.ab && d.ba===p.ba; }
  function keyOk(p){
    var k=S.keys[p.id]; if(!k) return false;
    if(p.shape==='many-to-many') return !!(k.join && nameEq(k.join,p.join.table) || (k.join&&/workflow.*tool|tool.*workflow/i.test(k.join))) && nameEq(k.c1,p.join.cols[0]) && nameEq(k.c2,p.join.cols[1]);
    return k.table===p.fk.table && nameEq(k.name,p.fk.name);
  }
  /* answers saved before the two-question cards count as answered */
  D.PAIRS.forEach(function(p){ if(!S.dir[p.id] && S.shapes[p.id]===p.shape) S.dir[p.id]={ab:p.ab,ba:p.ba}; });

  /* ================= the board: blocks drawn like the whiteboard =================
     One picture of Aarav's model that grows with the bricks: blocks after section 1,
     facts after 2, keys and pointers after 3, everything in 5. The same renderer draws
     the link cards in section 3 and the Picture of any table builder. */
  var BW=150, HD=36, RH=26, GX=[16,210,404,598], GAP=44;
  function tH(t){ return HD+Math.max(t.cols.length,1)*RH+10; }
  function rY(t,i){ return t.y+HD+5+i*RH+RH/2; }
  function clip(s,n){ s=String(s); return s.length>n?s.slice(0,n-1)+'…':s; }
  function isLink(s){ return typeof s==='string' && s.charAt(0)==='#'; }
  function tblSVG(t){
    var x=t.x, y=t.y, w=t.w, h=tH(t), cx=x+w/2, ghost=!!t.ghost;
    var s='<g class="tb'+(t.box?' tgt':'')+(t.hold?' hold':'')+'"'+(t.box?' data-box="'+t.box+'" tabindex="0" role="button" aria-label="'+esc(t.title||t.name)+'"':'')+'>'+
      '<g class="ln" filter="url(#wob)"><rect class="blk'+(t.hold?' dash c-act':ghost?' dash ink':'')+'" x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="6"/><path class="thin'+(t.hold||ghost?' dash ink':'')+'" d="M'+x+' '+(y+HD)+' H'+(x+w)+'"/></g><g class="tx">'+
      '<text x="'+cx+'" y="'+(y+25)+'" class="'+((t.title||t.name).length>13?'xs':'m')+' '+(t.hold?'c-act':ghost?'c-mute':'c-thing')+'">'+esc(clip(t.title||t.name,18))+'</text>';
    if(!t.cols.length){
      var ey=rY(t,0)+6;
      s+=isLink(t.ghost)?'<a href="'+t.ghost+'"><text x="'+cx+'" y="'+ey+'" class="xxs c-act">place it ↗</text></a>':'<text x="'+cx+'" y="'+ey+'" class="xxs c-mute">'+esc(t.empty||'')+'</text>';
    }
    t.cols.forEach(function(c,i){
      var ty=rY(t,i)+6, cc=c.miss?'c-mute':c.k==='pk'?'c-thing':c.k==='fk'?'c-link':c.k==='file'?'c-act':'c-fact';
      var txt='<text x="'+(x+12)+'" y="'+ty+'" class="xxs l '+cc+'">'+esc(clip(c.n,c.k==='pk'?14:18))+(isLink(c.miss)?' ↗':'')+'</text>';
      s+=isLink(c.miss)?'<a href="'+c.miss+'">'+txt+'</a>':txt;
      if(c.k==='pk'&&!c.miss) s+='<text x="'+(x+w-10)+'" y="'+ty+'" class="xxs r c-thing">key</text>';
    });
    return s+'</g></g>';
  }
  function arrowD(f,fi,t,ti){
    var fy=rY(f,fi), ty=ti<0?t.y+HD/2:rY(t,ti), fc=f.x+f.w/2, tc=t.x+t.w/2, sx, ex, d;
    if(Math.abs(fc-tc)<4){ sx=f.x; ex=t.x-3; return 'M'+sx+' '+fy+' C'+(sx-40)+' '+fy+' '+(ex-40)+' '+ty+' '+ex+' '+ty; }
    if(tc<fc){ sx=f.x; ex=t.x+t.w+3; } else { sx=f.x+f.w; ex=t.x-3; }
    d=(ex-sx)/2; return 'M'+sx+' '+fy+' C'+(sx+d)+' '+fy+' '+(ex-d)+' '+ty+' '+ex+' '+ty;
  }
  function arrowsFor(tables){
    var out=[];
    tables.forEach(function(t){ t.cols.forEach(function(c,i){
      if(c.k!=='fk'||!c.ref) return; var tg=tables.find(function(x){ return x.name===c.ref; }); if(!tg) return;
      out.push({f:t,fi:i,t:tg,ti:tg.cols.findIndex(function(x){ return x.k==='pk'; }),dash:!!c.miss||!!tg.ghost});
    }); });
    return out;
  }
  function boardSVG(tables,arrows,label,extra,w,h){
    h=h||Math.max.apply(null,tables.map(function(t){ return t.y+tH(t); }))+14;
    return '<svg class="wb" viewBox="0 0 '+(w||760)+' '+h+'" role="img" aria-label="'+esc(label)+'">'+tables.map(tblSVG).join('')+
      '<g class="ln" filter="url(#wob)">'+arrows.map(function(a){ return '<path class="arw '+(a.dash?'dash ink':'c-link')+'" d="'+arrowD(a.f,a.fi,a.t,a.ti)+'"'+(a.dash?'':' marker-end="url(#ahv)"')+'/>'; }).join('')+'</g>'+(extra||'')+'</svg>';
  }
  function grid(tables,pos){
    var rows={}; tables.forEach(function(t){ var p=pos(t); t.x=GX[p[0]]; t.w=t.w||BW; (rows[p[1]]=rows[p[1]]||[]).push(t); });
    var y=14; Object.keys(rows).sort(function(a,b){ return a-b; }).forEach(function(r){ var mh=0; rows[r].forEach(function(t){ t.y=y; mh=Math.max(mh,tH(t)); }); y+=mh+GAP; });
  }

  /* Aarav's board at a stage: 1 blocks, 2 facts, 3 keys and pointers, 5 everything (grey pieces link back) */
  var POS={users:[0,0],conversations:[1,0],messages:[2,0],attachments:[3,0],diagnoses:[0,1],workflows:[1,1],workflow_tools:[2,1],tools:[3,1]};
  function aaravTables(stage,o){
    o=o||{}; var reveal=stage>=5, tables=[];
    D.AARAV_MODEL.forEach(function(m){
      if(m.name==='attachments'&&stage<5){
        if(stage===2) tables.push({name:'attachments',title:'hold for section 4',hold:true,box:o.targets?'hold':'',empty:'?',cols:D.FACTS.filter(function(f){ return f.ent==='hold'&&S.facts[f.id]==='hold'; }).map(function(f){ return {n:f.id,k:'file'}; })});
        return;
      }
      if(m.name==='workflow_tools'&&stage<3) return;
      var tOk=stage===2 || (m.src.ent ? foundEnt(D.TOKENS[m.src.ent].ent) : m.src.sort ? S.sort[m.src.sort]==='file' : m.src.pair ? keyOk(pairById(m.src.pair)) : true);
      if(!tOk && !reveal && !m.src.ent) return;
      var cols=[];
      if(stage>1) m.cols.forEach(function(c){
        var nm=c[0], kind=c[1], src=c[3]||{}, ok=true, lk='';
        if(stage<3&&(kind||!src.fact)) return;
        if(src.fact){ ok=S.facts[src.fact]===m.name; lk='#s2'; }
        else if(src.pair){ ok=keyOk(pairById(src.pair)); lk='#s3'; }
        else if(src.sort){ ok=S.sort[src.sort]===(src.sort==='meta'?'row':'file'); lk='#s4'; }
        if(!ok&&!reveal) return;
        cols.push({n:nm,k:kind||(nm==='file_url'?'file':''),ref:c[2]||'',miss:ok?'':lk});
      });
      tables.push({name:m.name,cols:cols,box:o.targets?m.name:'',ghost:tOk?'':(reveal?(m.src.ent?'#s1':m.src.sort?'#s4':'#s3'):'1'),
        empty:tOk?(stage===1?'what does it have?':stage===2?(m.cols.some(function(c){ return c[3]&&c[3].fact; })?'+ facts':'just its name'):''):'not found yet'});
    });
    grid(tables,function(t){ return POS[t.name]; });
    return tables;
  }
  function aaravBoard(stage,o){
    var ts=aaravTables(stage,o);
    return boardSVG(ts,stage>=3?arrowsFor(ts):[],'Aarav\'s board: '+ts.filter(function(t){ return !t.ghost; }).map(function(t){ return t.name+(t.cols.length?' ('+t.cols.filter(function(c){ return !c.miss; }).map(function(c){ return c.n; }).join(', ')+')':''); }).join('; '));
  }

  /* ================= pause and think: one line unlocks the reveal ================= */
  $$('.think').forEach(function(box){
    var k=box.dataset.k, inp=$('input',box), rev=$('.rev',box), mine=$('.mine',box);
    inp.value=S.think[k]||'';
    function paint(){ var ok=inp.value.trim().length>=8; rev.classList.toggle('open',ok); if(!ok) rev.removeAttribute('open'); if(mine) mine.textContent=ok?'Your answer is saved beside the reveal.':'Write at least a few words to open the reveal.'; }
    inp.addEventListener('input',function(){ S.think[k]=inp.value; store.set(K,S); paint(); });
    paint();
  });

  /* ================= section 0 · the demo ================= */
  (function(){
    var root=$('#demo'); if(!root) return;
    var msgs=[], on=!!S.demoOn;
    var msgsEl=$('.msgs',root), form=$('form',root), inp=$('input[type=text]',root), tog=$('#demoSave',root), st=$('.st',root), sheet=$('.sheet .in',root), note=$('#demoNote',root);
    tog.checked=on;
    function reply(t){ return msgs.filter(function(m){return m.r==='u'}).length===0 ? D.AARAV_PLAN : (/casual/i.test(t) ? D.AARAV_PLAN_CASUAL : 'Noted. Want the plan redone in a different tone?'); }
    function drawChat(){
      msgsEl.innerHTML = msgs.length ? msgs.map(function(m){ return '<div class="bub '+m.r+'">'+esc(m.t)+'</div>'; }).join('') : '<div class="empty">Nothing yet. Type as Aarav, or press the button.</div>';
      msgsEl.scrollTop=msgsEl.scrollHeight;
      $('#demoMem',root).textContent='in memory: '+msgs.length+(msgs.length===1?' message':' messages');
    }
    function drawSheet(){
      if(!on){ sheet.innerHTML='<p class="off">Saving is off. Everything lives inside the running app.</p>'; return; }
      var rows=S.demoRows;
      sheet.innerHTML='<div class="sh"><div class="cap"><b>messages</b><span>'+rows.length+' row'+(rows.length===1?'':'s')+'</span></div><table><thead><tr><th>id</th><th>role</th><th>content</th><th>created_at</th></tr></thead><tbody>'+
        (rows.length?rows.map(function(r,i){ return '<tr'+(i===rows.length-1&&r._new?' class="new"':'')+'><td>'+r.id+'</td><td>'+r.role+'</td><td title="'+esc(r.content)+'">'+esc(r.content)+'</td><td>'+r.created_at+'</td></tr>'; }).join(''):'<tr><td colspan="4" class="muted" style="white-space:normal">No rows yet. Send a message and watch one appear.</td></tr>')+
        '</tbody></table></div>';
      rows.forEach(function(r){ delete r._new; });
    }
    function send(t){
      if(!t) return;
      var now=new Date();
      [{r:'u',t:t},{r:'a',t:reply(t)}].forEach(function(m){
        msgs.push(m);
        if(on){ S.demoRows.push({id:S.demoRows.length+1, role:m.r==='u'?'user':'app', content:m.t, created_at:now.toISOString().slice(0,16).replace('T',' '), _new:true}); }
      });
      store.set(K,S); drawChat(); drawSheet(); note.textContent='';
    }
    form.addEventListener('submit',function(e){ e.preventDefault(); var v=inp.value.trim(); inp.value=''; send(v); });
    $('#demoAarav',root).addEventListener('click',function(){ send(D.AARAV_IN); });
    tog.addEventListener('change',function(){ on=tog.checked; S.demoOn=on; store.set(K,S); drawSheet(); note.textContent=on?'Saving is on. New messages become rows.':'Saving is off.'; });
    $('#demoRestart',root).addEventListener('click',function(){
      var had=msgs.length; msgs=[]; drawChat();
      st.classList.add('off'); $('span',st).textContent='app closed';
      note.innerHTML='';
      setTimeout(function(){
        st.classList.remove('off'); $('span',st).textContent='app running';
        if(on && S.demoRows.length){
          msgs=S.demoRows.map(function(r){ return {r:r.role==='user'?'u':'a', t:r.content}; }); drawChat();
          note.innerHTML='<span class="kept">'+msgs.length+' messages came back.</span> The app reopened and read its rows.';
        } else {
          note.innerHTML='<span class="lost">'+had+' messages gone.</span> They lived in memory, and memory died with the app.';
        }
      },800);
    });
    $('#demoClear',root).addEventListener('click',function(){ S.demoRows=[]; msgs=[]; store.set(K,S); drawChat(); drawSheet(); note.textContent='Table emptied.'; });
    drawChat(); drawSheet();
  })();

  /* ================= section 1 · tap the words ================= */
  (function(){
    var root=$('#tx'); if(!root) return;
    var fb=$('#txFb');
    var pick=null;
    function closePick(){ if(pick){ pick.remove(); pick=null; } $$('.hot',root).forEach(function(x){ x.classList.remove('hot'); }); }
    function paint(){
      $$('[data-t]',root).forEach(function(x){
        var id=x.dataset.t, c=S.tags[id]; x.classList.remove('thing','fact','neither','file');
        if(c){ var tok=D.TOKENS[id]; var right=(c===tok.role)||(tok.role==='file'&&c==='thing'); if(right) x.classList.add(tok.role); }
      });
      var right=D.TOKEN_ORDER.filter(function(id){ var t=D.TOKENS[id]; var c=S.tags[id]; return c && (c===t.role || (t.role==='file'&&c==='thing')); }).length;
      $('#txCount').textContent=right+' / '+D.TOKEN_ORDER.length+' placed';
    }
    root.addEventListener('click',function(e){
      var t=e.target.closest('[data-t]'); if(!t){ closePick(); return; }
      closePick(); t.classList.add('hot');
      var r=t.getBoundingClientRect();
      pick=el('<div class="pick" style="position:fixed" role="group" aria-label="What is this?"><button type="button" data-c="thing">a thing</button><button type="button" data-c="fact">a fact about a thing</button><button type="button" data-c="neither">neither</button></div>');
      document.body.appendChild(pick);
      var pw=pick.offsetWidth; var left=Math.min(Math.max(8,r.left), window.innerWidth-pw-8);
      pick.style.left=left+'px'; pick.style.top=(r.bottom+6)+'px';
      pick.addEventListener('click',function(ev){
        var b=ev.target.closest('button'); if(!b) return;
        var id=t.dataset.t, tok=D.TOKENS[id], c=b.dataset.c;
        var right=(c===tok.role)||(tok.role==='file'&&c==='thing');
        S.tags[id]=c; save();
        fb.className='fbk '+(right?'ok':'no');
        fb.innerHTML=(right?'<b>Yes.</b> ':'<b>Not quite.</b> ')+tok.why;
        closePick(); paint();
      });
    });
    document.addEventListener('click',function(e){ if(pick && !pick.contains(e.target) && !root.contains(e.target)) closePick(); });
    window.addEventListener('scroll',function(){ if(pick) closePick(); },{passive:true});
    paint();
  })();

  /* ================= generic tap-to-place: a bank of cards and target boxes ================= */
  function placer(opts){
    var bank=$(opts.bank), boxes=$$(opts.box), fb=$(opts.fb), picked=null;
    function paint(){
      var left=opts.cards.filter(function(c){ return opts.placed(c)===null; });
      bank.innerHTML=left.length?left.map(function(c){ return '<button type="button" class="fc" data-id="'+c.id+'" aria-pressed="false">'+esc(opts.label(c))+'</button>'; }).join(''):'<span class="empty">Every card is placed.</span>';
      boxes.forEach(function(b){
        var inEl=$('.in',b); var mine=opts.cards.filter(function(c){ return opts.placed(c)===b.dataset.box; });
        inEl.innerHTML=(opts.boxExtra?opts.boxExtra(b.dataset.box):'')+mine.map(function(c){ return '<span class="fc ok">'+esc(opts.label(c))+'</span>'; }).join('')+(mine.length?'':'<span class="tip">'+(opts.tip||'tap a card, then tap here')+'</span>');
      });
      if(opts.count) opts.count(opts.cards.filter(function(c){ return opts.placed(c)!==null; }).length);
    }
    bank.addEventListener('click',function(e){
      var b=e.target.closest('.fc'); if(!b) return;
      picked=picked===b.dataset.id?null:b.dataset.id;
      $$('.fc',bank).forEach(function(x){ x.setAttribute('aria-pressed',x.dataset.id===picked?'true':'false'); });
      boxes.forEach(function(x){ x.classList.toggle('can',!!picked); });
    });
    boxes.forEach(function(b){
      b.addEventListener('click',function(){
        if(!picked) return;
        var card=opts.cards.find(function(c){ return c.id===picked; }); var ok=opts.right(card,b.dataset.box);
        fb.className='fbk '+(ok?'ok':'no');
        fb.innerHTML=(ok?'<b>Yes.</b> ':'<b>Not there.</b> ')+card.why;
        if(ok){ opts.set(card,b.dataset.box); picked=null; boxes.forEach(function(x){ x.classList.remove('can'); }); save(); paint(); }
        else { var c=$('.fc[data-id="'+card.id+'"]',bank); if(c){ c.classList.add('no'); setTimeout(function(){ c.classList.remove('no'); },400); } }
      });
    });
    paint();
  }

  /* section 2 · facts snap onto the blocks on the board */
  (function(){
    var bank=$('#factBank'), mount=$('#factBoard'), fig=$('#factFig'), fb=$('#factFb'); if(!bank||!mount) return;
    var picked=null;
    function paint(){
      var left=D.FACTS.filter(function(c){ return !S.facts[c.id]; });
      if(picked && S.facts[picked]) picked=null;
      bank.innerHTML=left.length?left.map(function(c){ return '<button type="button" class="fc" data-id="'+c.id+'" aria-pressed="'+(picked===c.id)+'">'+esc(c.id)+'</button>'; }).join(''):'<span class="empty">Every card is placed.</span>';
      mount.innerHTML=aaravBoard(2,{targets:true});
      fig.classList.toggle('can',!!picked);
      $('#factCount').textContent=(D.FACTS.length-left.length)+' / '+D.FACTS.length+' placed';
    }
    function drop(box){
      if(!picked){ fb.className='fbk'; fb.innerHTML='Tap a card first, then its block.'; return; }
      var card=D.FACTS.find(function(c){ return c.id===picked; }), ok=card.ent===box;
      fb.className='fbk '+(ok?'ok':'no');
      fb.innerHTML=(ok?'<b>Yes.</b> ':'<b>Not there.</b> ')+card.why;
      if(ok){ S.facts[card.id]=box; picked=null; save(); paint(); }
      else { var c=$('.fc[data-id="'+card.id+'"]',bank); if(c){ c.classList.add('no'); setTimeout(function(){ c.classList.remove('no'); },400); } }
    }
    bank.addEventListener('click',function(e){ var b=e.target.closest('.fc'); if(!b) return; picked=picked===b.dataset.id?null:b.dataset.id; paint(); });
    mount.addEventListener('click',function(e){ var g=e.target.closest('[data-box]'); if(g) drop(g.dataset.box); });
    mount.addEventListener('keydown',function(e){ var g=e.target.closest('[data-box]'); if(g&&(e.key==='Enter'||e.key===' ')){ e.preventDefault(); drop(g.dataset.box); } });
    paint();
  })();

  /* section 4 · rows or files */
  if($('#sortBank')) placer({
    bank:'#sortBank', box:'#sortBins .bin', fb:'#sortFb', cards:D.STORE_CARDS,
    label:function(c){ return c.t; },
    placed:function(c){ return S.sort[c.id]||null; },
    right:function(c,box){ return c.where===box; },
    set:function(c,box){ S.sort[c.id]=box; },
    tip:'tap a card, then tap here',
    count:function(n){ $('#sortCount').textContent=n+' / '+D.STORE_CARDS.length+' placed'; }
  });

  /* ================= section 3 · two questions per pair, then the pointer, drawn as you go ================= */
  var MINI={users:'name',conversations:'started_at',messages:'content',workflows:'description',diagnoses:'plan',tools:'name'};
  function pairMini(p){
    var known=shapeKnown(p), ok=known&&keyOk(p), m2m=p.shape==='many-to-many';
    function blk(n,x,extra){ return {name:n,x:x,y:30,w:BW,cols:[{n:'id',k:'pk'},{n:MINI[n],k:''}].concat(extra||[])}; }
    var A, B, ts, ex='', lab='';
    if(m2m&&ok){
      A=blk(p.ta,12); B=blk(p.tb,452);
      var J={name:p.join.table,x:232,y:30,w:BW,cols:[{n:'id',k:'pk'},{n:p.join.cols[0],k:'fk',ref:p.ta},{n:p.join.cols[1],k:'fk',ref:p.tb}]};
      ts=[A,J,B];
      ex='<g class="tx"><text x="307" y="190" class="xs c-link">one row per pairing</text></g>';
      lab=p.ta+' and '+p.tb+', joined by '+p.join.table;
    } else {
      A=blk(p.ta,60); B=blk(p.tb,404,ok?[{n:p.fk.name,k:'fk',ref:p.ta}]:[]);
      ts=[A,B];
      var aEnd=p.ba==='yes'?'many':'one', bEnd=p.ab==='yes'?'many':'one', ly=rY(A,0)+13;
      if(ok){
        ex='<g class="tx"><text x="'+(A.x+A.w+18)+'" y="'+(rY(A,0)-12)+'" class="xs l c-link">'+aEnd+'</text><text x="'+(B.x-12)+'" y="'+(rY(B,2)-12)+'" class="xs r c-link">'+bEnd+'</text>'+
          '<text x="307" y="186" class="xs c-link">'+esc(p.fk.name)+' points back</text></g>';
      } else {
        /* no wobble filter here: a flat line has a zero-height box and the filter would erase it */
        ex='<g class="ln"><path class="'+(known?'c-link':'dash ink')+'" d="M'+(A.x+A.w)+' '+ly+' H'+B.x+'"/></g><g class="tx">'+
          (known?'<text x="'+(A.x+A.w+12)+'" y="'+(ly-10)+'" class="xs l c-link">'+aEnd+'</text><text x="'+(B.x-12)+'" y="'+(ly-10)+'" class="xs r c-link">'+bEnd+'</text>'+
            '<text x="307" y="'+(ly+30)+'" class="xs '+(m2m?'c-act':'c-mute')+'">'+(m2m?'neither side can hold it':'which side holds the pointer?')+'</text>'
          :'<text x="307" y="'+(ly+10)+'" class="h c-mute">?</text>')+'</g>';
      }
      lab=p.ta+' and '+p.tb+(ok?', linked by '+p.fk.name:'');
    }
    return boardSVG(ts,ok?arrowsFor(ts):[],lab,ex,614,ok?200:150);
  }
  (function(){
    var root=$('#pairs'); if(!root) return;
    function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }
    function draw(){
      root.innerHTML='';
      D.PAIRS.forEach(function(p){
        var d=S.dir[p.id]||{}, known=shapeKnown(p), ok=known&&keyOk(p), k=S.keys[p.id]||{}, m2m=p.shape==='many-to-many';
        var asks=[['ab',p.qa],['ba',p.qb]].map(function(q){
          var got=d[q[0]], right=got===p[q[0]];
          return '<div class="qrow" data-q="'+q[0]+'"><span>'+esc(q[1])+'</span><div class="opts">'+['yes','no'].map(function(v){ return '<button type="button" data-v="'+v+'" aria-pressed="'+(got===v)+'" class="'+(got===v?(right?'ok':'no'):'')+'">'+v+'</button>'; }).join('')+'</div></div>';
        }).join('');
        var fb=d.ab&&d.ab!==p.ab?'<b>Look again.</b> '+p.na : d.ba&&d.ba!==p.ba?'<b>Look again.</b> '+p.nb : known?'<b>'+cap(p.shape)+'.</b> '+p.why : '';
        var card=el('<div class="pair'+(ok?' linked':'')+'" data-p="'+p.id+'"><div class="mini">'+pairMini(p)+'</div><div class="ask">'+asks+'</div><div class="fb '+(known?'ok':'')+'">'+fb+'</div></div>');
        if(known){
          if(m2m){
            card.appendChild(el('<div class="key"><span class="lb">the third block</span><div class="row"><input type="text" data-k="join" placeholder="block name" value="'+esc(k.join||'')+'"><input type="text" data-k="c1" placeholder="pointer to '+p.ta+'" value="'+esc(k.c1||'')+'"><input type="text" data-k="c2" placeholder="pointer to '+p.tb+'" value="'+esc(k.c2||'')+'"><span class="'+(ok?'ok':'no')+'">'+(ok?'✓ one row per pairing':'name it, then its two pointers')+'</span></div></div>'));
          } else {
            var st=ok?'✓ on the many side':k.table&&k.table!==p.fk.table?'a column holds one value: try the other side':k.table?'name it: the other block, singular, plus _id':'pick the many side, then name it';
            card.appendChild(el('<div class="key"><span class="lb">the pointer</span><div class="row"><span>goes on</span>'+[p.ta,p.tb].map(function(n){ return '<button type="button" class="tb'+(k.table===n?(n===p.fk.table?' ok':' no'):'')+'" data-tb="'+n+'" aria-pressed="'+(k.table===n)+'">'+n+'</button>'; }).join('')+'<span>called</span><input type="text" data-k="name" placeholder="column name" value="'+esc(k.name||'')+'"><span class="'+(ok?'ok':'no')+'">'+st+'</span></div></div>'));
          }
        }
        root.appendChild(card);
      });
      var n=D.PAIRS.filter(function(p){ return shapeKnown(p) && keyOk(p); }).length;
      $('#pairCount').textContent=n+' / '+D.PAIRS.length+' linked';
      drawTrace();
    }
    function setKey(id,f,v){ S.keys[id]=S.keys[id]||{}; S.keys[id][f]=v; save(); draw(); }
    root.addEventListener('click',function(e){
      var b=e.target.closest('.qrow button'), tb=e.target.closest('[data-tb]');
      if(b){
        var id=b.closest('.pair').dataset.p, p=pairById(id);
        S.dir[id]=S.dir[id]||{}; S.dir[id][b.closest('.qrow').dataset.q]=b.dataset.v;
        if(shapeKnown(p)) S.shapes[id]=p.shape; else delete S.shapes[id];
        save(); draw();
      } else if(tb){ setKey(tb.closest('.pair').dataset.p,'table',tb.dataset.tb); }
    });
    root.addEventListener('change',function(e){
      var f=e.target.closest('input[data-k]'); if(!f) return;
      setKey(f.closest('.pair').dataset.p,f.dataset.k,f.value.trim());
    });
    root.addEventListener('keydown',function(e){ if(e.key==='Enter'&&e.target.matches('input')){ e.preventDefault(); e.target.blur(); } });
    function drawTrace(){
      var t=$('#trace'); if(!t) return;
      var cm=keyOk(D.PAIRS[1]), uc=keyOk(D.PAIRS[0]);
      t.innerHTML='<span class="nd">message 101</span><span class="ar">→</span><span class="nd '+(cm?'':'dim')+'">'+(cm?'conversation_id = 7':'conversation ?')+'</span><span class="ar">→</span><span class="nd '+(uc&&cm?'':'dim')+'">'+(uc&&cm?'user_id = 1 · Aarav':'user ?')+'</span>';
    }
    draw();
  })();

  /* ================= quick checks ================= */
  var QUIZ={
    conv:{p:'Is "conversation" a thing in your app?',scn:'Aarav chats on Monday. On Tuesday he opens a fresh conversation. Each can be started, reopened and deleted.',
      o:[['Yes, it earns its own table',1,'Create, Read, reopen, Delete, each on its own, and many over time. A thing with its own row.'],['No, it just describes Aarav',0,'A conversation is not a fact about Aarav. You can create and delete each one, and there are many. A thing.']]},
    email:{p:'Is "email address" a thing?',scn:'A user signs in with an email like aarav@mail.com.',
      o:[['No, it describes a user',1,'An email cannot be created or deleted on its own. It only describes a user: a column, not a table.'],['Yes, give it its own table',0,'It has no life of its own. Splitting it out is the classic over-split.']]},
    tone:{p:'Thing or fact: "tone"?',scn:'A diagnosis is written in a chosen tone, formal or casual. Tones are not saved or reused anywhere.',
      o:[['A fact on the diagnosis',1,'As described, tone belongs to one diagnosis. One column.'],['Its own thing',0,'Nobody creates or deletes a "tone" here. It describes one diagnosis. If users could save and reuse named tones, the answer would flip.']]},
    attach:{p:'Thing or fact: "attachment"?',scn:'Aarav uploads a screenshot and reuses it in different conversations.',
      o:[['Its own thing',1,'Created and deleted on its own, reused across conversations. A row of its own, pointing at the message it was sent with. Where its bytes go is section 4.'],['A fact on the message',0,'It outlives the message and is reused. That independent life makes it a thing.']]},
    often:{p:'Where does "how often" live?',scn:'For each tool in a workflow, Aarav says how often he uses it there: daily, weekly. Jira is daily in one workflow and monthly in another.',
      o:[['On the workflow_tools row',1,'It describes one workflow-tool pairing, so it sits on the pairing row. Not on the tool, not on the workflow.'],['On the tools table',0,'Jira is daily in one workflow and monthly in another. One cell on tools cannot hold both.'],['On the workflows table',0,'A workflow uses several tools, each with its own frequency. One cell cannot hold them all.']]},
    grade:{p:'Transfer: where does a "grade" belong?',scn:'Students take many courses, courses have many students. The university records a grade per student per course.',
      o:[['On the enrollment row',1,'The grade describes one student-course pairing. Same move as how often: on the third table.'],['On the students table',0,'A student has many grades, one per course.'],['On the courses table',0,'A course has many grades, one per student.']]}
  };
  $$('.qc').forEach(function(box){
    var k=box.dataset.k, q=QUIZ[k]; if(!q) return;
    box.innerHTML='<p class="p">'+q.p+'</p><p class="scn">'+q.scn+'</p><div class="ch">'+q.o.map(function(o,i){ return '<button type="button" data-i="'+i+'">'+o[0]+'</button>'; }).join('')+'</div><p class="ex"></p>';
    var ex=$('.ex',box);
    function lock(){ $$('.ch button',box).forEach(function(b){ b.disabled=true; if(q.o[+b.dataset.i][1]) b.classList.add('ok'); }); ex.className='ex ok'; ex.textContent=q.o.find(function(o){return o[1]})[2]; }
    if(S.quiz[k]) lock();
    box.addEventListener('click',function(e){
      var b=e.target.closest('button'); if(!b||b.disabled) return;
      var o=q.o[+b.dataset.i];
      if(o[1]){ S.quiz[k]=true; save(); lock(); }
      else { b.classList.add('no'); ex.className='ex'; ex.textContent=o[2]; }
    });
  });

  /* ================= the builder (sections 6 and 7) ================= */
  function blankCol(name,type,pk){ return {id:uid('c'),name:name||'',type:type||'text',primary:!!pk,foreign:false,fkRef:'',required:true,unique:false}; }
  function blankTable(name){ return {id:uid('t'),name:name||'',columns:[blankCol('id','id',true)]}; }
  function normalize(raw,starter){
    var tables=(Array.isArray(raw)?raw:[]).map(function(t){ return {id:t.id||uid('t'),name:typeof t.name==='string'?t.name:'',columns:(Array.isArray(t.columns)?t.columns:[]).map(function(c){ return {id:c.id||uid('c'),name:c.name||'',type:D.COL_TYPES.indexOf(c.type)>-1?c.type:'text',primary:c.primary===true,foreign:c.foreign===true,fkRef:c.fkRef||'',required:c.required!==false,unique:!!c.unique}; })}; });
    if(!tables.length) tables=(starter||['']).map(blankTable);
    return tables;
  }
  function live(schema){ return schema.filter(function(t){ return t.name && t.columns.some(function(c){ return c.name; }); }); }
  function refOf(schema,ref){ return schema.find(function(t){ return t.id===ref || nameEq(t.name,ref); }); }

  function makeBuilder(mount,key,starter){
    var schema=normalize(S.schemas[key],starter); S.schemas[key]=schema;
    function persist(){ S.schemas[key]=schema; save(); }
    function draw(){
      mount.innerHTML='';
      var g=el('<div class="tgrid"></div>');
      schema.forEach(function(t,ti){ g.appendChild(drawTable(t,ti)); });
      mount.appendChild(g);
    }
    function drawTable(t,ti){
      var card=el('<div class="tbl"><div class="hd"><input type="text" value="'+esc(t.name)+'" placeholder="table_name" aria-label="Table name" spellcheck="false"><button type="button" class="x" aria-label="Remove table">×</button></div><div class="cols"></div></div>');
      var ni=$('.hd input',card); ni.addEventListener('input',function(){ t.name=ni.value; persist(); }); ni.addEventListener('change',draw);
      $('.hd .x',card).addEventListener('click',function(){ schema.splice(ti,1); if(!schema.length) schema.push(blankTable('')); persist(); draw(); });
      var cols=$('.cols',card);
      t.columns.forEach(function(c,ci){ cols.appendChild(drawCol(t,c,ci)); });
      var add=el('<button type="button" class="add">+ column</button>'); add.addEventListener('click',function(){ t.columns.push(blankCol()); persist(); draw(); }); cols.appendChild(add);
      return card;
    }
    function drawCol(t,c,ci){
      var others=schema.filter(function(x){ return x.id!==t.id && x.name; });
      var row=el('<div class="crow"><input type="text" value="'+esc(c.name)+'" placeholder="column" aria-label="Column name" spellcheck="false"><select aria-label="Type">'+D.COL_TYPES.map(function(x){ return '<option '+(c.type===x?'selected':'')+'>'+x+'</option>'; }).join('')+'</select>'+
        '<div class="flags"><label class="k '+(c.primary?'on':'')+'" title="The row\'s address"><input type="checkbox" data-f="primary" '+(c.primary?'checked':'')+'>key</label><label class="f '+(c.foreign?'on':'')+'" title="Holds another table\'s key"><input type="checkbox" data-f="foreign" '+(c.foreign?'checked':'')+'>points to</label><label class="'+(c.required?'on':'')+'" title="Cannot be empty"><input type="checkbox" data-f="required" '+(c.required?'checked':'')+'>required</label><label class="'+(c.unique?'on':'')+'" title="No two rows share it"><input type="checkbox" data-f="unique" '+(c.unique?'checked':'')+'>unique</label><button type="button" class="x" aria-label="Remove column">×</button></div>'+
        (c.foreign?'<div class="ref">→ <select aria-label="Table it points to"><option value="">which table?</option>'+others.map(function(o){ return '<option value="'+o.id+'" '+(c.fkRef===o.id?'selected':'')+'>'+esc(o.name)+'</option>'; }).join('')+'</select></div>':'')+'</div>');
      $('input[type=text]',row).addEventListener('input',function(e){ c.name=e.target.value; persist(); });
      $('select',row).addEventListener('change',function(e){ c.type=e.target.value; persist(); });
      $$('.flags input',row).forEach(function(i){ i.addEventListener('change',function(){ c[i.dataset.f]=i.checked; if(i.dataset.f==='primary'&&i.checked) c.required=true; if(i.dataset.f==='foreign'&&!i.checked) c.fkRef=''; persist(); draw(); }); });
      var rs=$('.ref select',row); if(rs) rs.addEventListener('change',function(){ c.fkRef=rs.value; persist(); });
      $('.flags .x',row).addEventListener('click',function(){ t.columns.splice(ci,1); persist(); draw(); });
      return row;
    }
    draw();
    return {get:function(){ return schema; }, add:function(){ schema.push(blankTable('')); persist(); draw(); }, reset:function(){ schema=(starter||['']).map(blankTable); persist(); draw(); }};
  }

  /* ---- sheets, csv, er ---- */
  function sample(c,n){ if(isPk(c)||c.type==='id') return n; if(isFk(c)) return 1; if(c.type==='number') return n*10; if(c.type==='yes/no') return n%2?'yes':'no'; if(c.type==='date and time') return '2026-10-1'+n+' 09:00'; return c.name+'_'+n; }
  function sheetsHTML(schema){
    var ts=live(schema); if(!ts.length) return '<p class="muted">Name a table and its columns first.</p>';
    return '<div class="sheets">'+ts.map(function(t){ var cols=t.columns.filter(function(c){return c.name}); return '<div class="sh"><div class="cap"><b>'+esc(t.name)+'</b><span>2 sample rows</span></div><table><thead><tr>'+cols.map(function(c){ return '<th>'+esc(c.name)+(isPk(c)?' · key':'')+(isFk(c)?' · →':'')+'</th>'; }).join('')+'</tr></thead><tbody>'+[1,2].map(function(n){ return '<tr>'+cols.map(function(c){ return '<td>'+esc(sample(c,n))+'</td>'; }).join('')+'</tr>'; }).join('')+'</tbody></table></div>'; }).join('')+'</div>';
  }
  function csvCell(v){ var s=String(v==null?'':v); return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; }
  function downloadCSVs(schema){
    var ts=live(schema); if(!ts.length){ alert('Name a table and its columns first.'); return; }
    ts.forEach(function(t){
      var cols=t.columns.filter(function(c){return c.name});
      var txt=[cols.map(function(c){return csvCell(c.name)}).join(',')].concat([1,2].map(function(n){ return cols.map(function(c){ return csvCell(sample(c,n)); }).join(','); })).join('\n');
      var url=URL.createObjectURL(new Blob([txt],{type:'text/csv;charset=utf-8'})); var a=document.createElement('a'); a.href=url; a.download=(t.name.replace(/[^a-z0-9_-]+/gi,'_')||'table')+'.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(url); },800);
    });
  }
  /* the Picture of any builder: the same blocks and arrows, four to a row */
  function relsHTML(ts){
    var rels=[];
    ts.forEach(function(t){ t.columns.forEach(function(c){ if(!isFk(c)||!c.fkRef) return; var tg=refOf(ts,c.fkRef); if(!tg) return; rels.push('<div class="r"><span>'+esc(tg.name)+'</span><span class="cr">'+(c.unique?'1 ─── 1':'1 ──< many')+'</span><span>'+esc(t.name)+'</span><span class="v">via '+esc(c.name)+'</span></div>'); }); });
    return rels.length?'<div class="er"><div class="rels">'+rels.join('')+'</div></div>':'';
  }
  function pictureHTML(schema){
    var ts=schema.filter(function(t){ return t.name; }); if(!ts.length) return '<p class="er empty">Add a table to see the picture.</p>';
    var tables=ts.map(function(t,i){ return {name:t.name,i:i,cols:t.columns.filter(function(c){ return c.name; }).map(function(c){ var r=isFk(c)&&c.fkRef&&refOf(ts,c.fkRef); return {n:c.name+(c.unique&&!isPk(c)?' · unique':''),k:isPk(c)?'pk':isFk(c)?'fk':'',ref:r?r.name:''}; })}; });
    grid(tables,function(t){ return [t.i%4,Math.floor(t.i/4)]; });
    return '<figure class="wbx board pic"><div class="sc">'+boardSVG(tables,arrowsFor(tables),'Your tables and the pointers between them')+'</div></figure>'+relsHTML(ts);
  }

  /* section 4 · the block held in section 2, with its bytes outside in file storage */
  function board4(){
    var shot=S.sort.shot==='file', meta=S.sort.meta==='row';
    var M={name:'messages',x:22,y:24,w:170,cols:[{n:'id',k:'pk'},{n:'conversation_id',k:'fk'},{n:'content',k:''}]};
    var A={name:'attachments',x:282,y:24,w:180,ghost:shot?'':'1',empty:'sort the screenshot first',cols:shot?[{n:'id',k:'pk'},{n:'message_id',k:'fk',ref:'messages'},{n:'file_name',k:'',miss:meta?'':'1'},{n:'file_url',k:'file'}]:[]};
    var ex=shot?'<g class="ln" filter="url(#wob)"><path d="M566 60 H700 L688 162 H578 Z M562 60 H704"/><rect class="thin f-act" x="608" y="86" width="50" height="38" rx="4"/><path class="thin c-act" d="M612 120 L626 104 L636 114 L644 106 L654 120"/>'+
      '<path class="arw c-act" d="M'+(A.x+A.w)+' '+rY(A,3)+' C510 '+rY(A,3)+' 530 128 568 120" marker-end="url(#ahc)"/></g><g class="tx"><text x="633" y="192" class="m">file storage</text><text x="633" y="218" class="xs c-act">jira-board.png</text></g>':'';
    var ts=[M,A];
    return boardSVG(ts,arrowsFor(ts),shot?'The attachments block: id, message_id pointing at messages, file_name, and file_url pointing at jira-board.png in file storage.':'The attachments block appears once the screenshot is sorted.',ex,760,232);
  }

  /* ================= every board on the page, redrawn after each placement ================= */
  function drawBoards(){
    var b1=$('#board1');
    if(b1){ b1.innerHTML=aaravBoard(1); var n1=D.TARGET_ENTITIES.filter(foundEnt).length;
      $('#board1Cap').textContent=n1===D.TARGET_ENTITIES.length?'All six blocks are on the board, each one a future table. They are empty: question 2 fills them.':n1+' of 6 blocks found. The grey ones are still hiding in Aarav\'s chat.'; }
    var b3=$('#board3');
    if(b3){ b3.innerHTML=aaravBoard(3); var n3=D.PAIRS.filter(function(p){ return shapeKnown(p)&&keyOk(p); }).length;
      $('#board3Cap').textContent=(n3===D.PAIRS.length?'Every block is linked. ':n3+' of 5 links placed. ')+'Each arrow runs from a pointer on the many side to the key of the row it points at.'; }
    var b4=$('#board4'); if(b4) b4.innerHTML=board4();
    var m5=$('#er5');
    if(m5){
      var ts=aaravTables(5), missing=0, total=0;
      ts.forEach(function(t){ total++; if(t.ghost) missing++; t.cols.forEach(function(c){ total++; if(c.miss) missing++; }); });
      m5.innerHTML=boardSVG(ts,arrowsFor(ts),'Aarav\'s whole model: eight blocks and the pointers between them.');
      var st=$('#er5State'); if(st) st.innerHTML=missing?'<div class="done not">'+missing+' of '+total+' pieces still to place. Grey pieces link back to the section that places them.</div>':'<div class="done">Every block, line and arrow here came from your own placements in sections 1 to 4.</div>';
      var br=$('#bridge'); if(br) $$('td[data-t]',br).forEach(function(td){ var t=ts.find(function(x){ return x.name===td.dataset.t; }); td.classList.toggle('lit',!!t&&!t.ghost); });
    }
  }
  drawBoards();

  /* ================= section 6 · the Arena ================= */
  (function(){
    var root=$('#arena'); if(!root) return;
    var core=D.BRIEFS.filter(function(b){return !b.stretch});
    function list(){
      var n=core.filter(function(b){return S.solved[b.id]}).length;
      $('#arenaCount').textContent=n+' / '+core.length+' done';
      root.innerHTML='<div class="briefs">'+D.BRIEFS.map(function(b){ return '<button type="button" class="brief '+(S.solved[b.id]?'done':'')+(b.stretch?' stretch':'')+'" data-id="'+b.id+'"><span class="n">'+(b.stretch?'stretch':'brief '+b.order)+'</span><b>'+esc(b.title)+'</b><small>'+esc(b.blurb)+'</small><span class="mv">'+esc(b.move)+'</span></button>'; }).join('')+'</div>';
      $$('.brief',root).forEach(function(b){ b.addEventListener('click',function(){ S.arenaEx=b.dataset.id; store.set(K,S); exercise(D.BRIEFS.find(function(x){return x.id===b.dataset.id})); root.scrollIntoView({behavior:'smooth',block:'start'}); }); });
    }
    function exercise(b){
      root.innerHTML='<p><button type="button" class="btn ghost small" id="exBack">← all briefs</button></p>'+
        '<div class="exh"><p class="kick">'+(b.stretch?'Stretch':'Brief '+b.order)+' · '+esc(b.move)+'</p><h3>'+esc(b.title)+'</h3><p class="story">'+esc(b.story)+'</p><ul>'+b.reqs.map(function(r){return '<li>'+esc(r)+'</li>'}).join('')+'</ul></div>'+
        '<div class="wtb"><button type="button" class="btn ghost small" id="exAdd">+ table</button><button type="button" class="btn ghost small" id="exReset">Start again</button><span class="sp">'+b.rubric.entities.length+' things expected</span></div>'+
        '<div id="exBuilder"></div>'+b.hints.map(function(h,i){ return '<details class="hint"><summary>'+(i+1)+'</summary><div class="b">'+esc(h)+'</div></details>'; }).join('')+
        '<div class="btnrow" style="margin:14px 0"><button type="button" class="btn" id="exCheck">Check my model</button><button type="button" class="btn ghost" id="exEr">Picture</button><button type="button" class="btn ghost" id="exSheets">Sheets</button><button type="button" class="btn ghost" id="exCsv">Download the sheets</button></div><div id="exOut"></div>';
      var bld=makeBuilder($('#exBuilder',root),'arena.'+b.id,b.starter), out=$('#exOut',root);
      $('#exBack',root).addEventListener('click',function(){ delete S.arenaEx; store.set(K,S); list(); });
      $('#exAdd',root).addEventListener('click',bld.add);
      $('#exReset',root).addEventListener('click',function(){ if(confirm('Back to the starter tables for this brief?')){ bld.reset(); out.innerHTML=''; } });
      $('#exEr',root).addEventListener('click',function(){ out.innerHTML=pictureHTML(bld.get()); });
      $('#exSheets',root).addEventListener('click',function(){ out.innerHTML=sheetsHTML(bld.get()); });
      $('#exCsv',root).addEventListener('click',function(){ downloadCSVs(bld.get()); });
      $('#exCheck',root).addEventListener('click',function(){
        var r=window.L06Check.check(bld.get(),b);
        out.innerHTML=(r.done?'<div class="done">Done. Every structural check is a tick.</div>':'<div class="done not">Not yet. Fix the crosses, then check again.</div>')+
          '<ul class="checks">'+r.checks.map(function(c){ return '<li class="'+(c.ok?'ok':'')+'">'+c.html+'</li>'; }).join('')+r.suggestions.map(function(s){ return '<li class="sug">'+s+'</li>'; }).join('')+'</ul>'+pictureHTML(bld.get());
        if(r.done && !S.solved[b.id]){ S.solved[b.id]=true; save(); }
        out.scrollIntoView({behavior:'smooth',block:'start'});
      });
    }
    var cur=S.arenaEx && D.BRIEFS.find(function(x){return x.id===S.arenaEx}); if(cur) exercise(cur); else list();
  })();

  /* ================= section 7 · your blueprint ================= */
  (function(){
    var root=$('#bp'); if(!root) return;
    $$('[data-bp]',root).forEach(function(f){ f.value=S.bp[f.dataset.bp]||''; f.addEventListener('input',function(){ S.bp[f.dataset.bp]=f.value; store.set(K,S); }); });
    var bld=makeBuilder($('#bpBuilder',root),'myapp',['users']), out=$('#bpOut',root);
    $('#bpAdd',root).addEventListener('click',bld.add);
    $('#bpReset',root).addEventListener('click',function(){ if(confirm('Clear your tables and start from users?')){ bld.reset(); out.innerHTML=''; } });
    $('#bpEr',root).addEventListener('click',function(){ out.innerHTML=pictureHTML(bld.get()); out.scrollIntoView({behavior:'smooth',block:'start'}); });
    $('#bpSheets',root).addEventListener('click',function(){ out.innerHTML=sheetsHTML(bld.get()); });
    $('#bpCsv',root).addEventListener('click',function(){ downloadCSVs(bld.get()); });
    $('#bpAarav',root).addEventListener('click',function(){
      if(!confirm('Replace your tables with Aarav\'s model from section 5?')) return;
      S.schemas.myapp=D.AARAV_MODEL.map(function(m){ return {id:uid('t'),name:m.name,columns:m.cols.map(function(c){ return {id:uid('c'),name:c[0],type:c[1]?'id':(c[0].indexOf('_at')>-1?'date and time':'text'),primary:c[1]==='pk',foreign:c[1]==='fk',fkRef:c[2]||'',required:true,unique:false}; })}; });
      /* point refs at ids */
      var byName={}; S.schemas.myapp.forEach(function(t){ byName[t.name]=t.id; }); S.schemas.myapp.forEach(function(t){ t.columns.forEach(function(c){ if(c.foreign&&byName[c.fkRef]) c.fkRef=byName[c.fkRef]; }); });
      save(); location.reload();
    });
    $('#bpCopy',root).addEventListener('click',function(){
      var s=bld.get(); var t='My blueprint\n\nWhat the app does: '+(S.bp.desc||'')+'\n\nThree questions the data must answer:\n1. '+(S.bp.q1||'')+'\n2. '+(S.bp.q2||'')+'\n3. '+(S.bp.q3||'')+'\n\nTables:\n'+live(s).map(function(tb){ return '- '+tb.name+': '+tb.columns.filter(function(c){return c.name}).map(function(c){ var r=isFk(c)&&refOf(s,c.fkRef); return c.name+(isPk(c)?' (key)':'')+(r?' (→ '+r.name+')':'')+(c.unique&&!isPk(c)?' (unique)':''); }).join(', '); }).join('\n')+'\n\nFiles my app stores, and the column with the link: '+(S.bp.files||'')+'\n\nMy Lecture 4 API table, with a table beside each address:\n'+(S.bp.api||'');
      window.c8copy(this,t);
    });
  })();

  /* ================= reset the whole lab ================= */
  var rl=$('#labReset'); if(rl) rl.addEventListener('click',function(){ if(!confirm('Wipe everything you placed and built in this lab, on this device?')) return; try{ localStorage.removeItem(K); localStorage.removeItem('c8.ck.'+(document.body.dataset.page||'')); }catch(e){} location.reload(); });
});
