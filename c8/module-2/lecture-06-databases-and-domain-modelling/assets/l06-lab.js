/* Lecture 6 · The Modelling Lab · page logic.
   Seven levels, one game. Levels 1 to 6 play in the same full-screen shell: a top bar with points,
   streak and misses, a how-to-play card, a bonus round, and a win card with stars. Level 7 is a
   workspace on the page. The rules (done, stars, points, next) live in l06-levels.js.
   Everything saves on this device under c8.l06.lab. */
document.addEventListener('DOMContentLoaded',function(){
  var $=function(s,r){return (r||document).querySelector(s)}, $$=function(s,r){return [].slice.call((r||document).querySelectorAll(s))};
  var store=window.c8store, K='c8.l06.lab', CKK='c8.ck.'+(document.body.dataset.page||'l06-lab');
  var D=window.L06, LV=window.L06Lv, C=window.L06Check;
  var S=LV.migrate(store.get(K,{}));
  var nameEq=C.nameEq, isPk=C.isPk, isFk=C.isFk, G=LV.G, tH=LV.tH, rY=LV.rY;
  function ck(){ return store.get(CKK,{}); }
  var redraws=[];
  function save(){ store.set(K,S); redraws.forEach(function(f){ f(); }); }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function uid(p){ return (p||'id')+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
  function el(h){ var t=document.createElement('template'); t.innerHTML=h.trim(); return t.content.firstElementChild; }
  function clip(s,n){ s=String(s); return s.length>n?s.slice(0,n-1)+'…':s; }
  function isLink(s){ return typeof s==='string' && s.charAt(0)==='#'; }
  function starStr(n){ return '<span class="stars">'+'★★★'.slice(0,n)+'<i>'+'★★★'.slice(n)+'</i></span>'; }
  function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }
  function sing(s){ return s==='diagnoses'?'diagnosis':s.replace(/s$/,''); }
  function reduced(){ return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function goSec(id){ var t=document.getElementById(id); if(t) window.scrollTo({top:t.getBoundingClientRect().top+window.scrollY-72,behavior:'instant'}); }

  /* a button that asks twice instead of a browser dialog */
  function sure(btn,fn,label){
    if(!btn) return;
    btn.addEventListener('click',function(){
      if(btn.dataset.armed){ clearTimeout(btn._t); delete btn.dataset.armed; btn.textContent=btn._o; btn.classList.remove('armed'); fn(); return; }
      btn._o=btn.textContent; btn.dataset.armed='1'; btn.textContent=label||'Sure? Tap again'; btn.classList.add('armed');
      btn._t=setTimeout(function(){ if(!btn.dataset.armed) return; delete btn.dataset.armed; btn.textContent=btn._o; btn.classList.remove('armed'); },3000);
    });
  }

  /* ================= the board: blocks drawn like the whiteboard ================= */
  function tblSVG(t){
    var x=t.x, y=t.y, w=t.w, h=tH(t), cx=x+w/2, ghost=!!t.ghost, title=t.title||t.name;
    var s='<g class="tb'+(t.box?' tgt':'')+(t.hold?' hold':'')+(t.lit?' lit':'')+'"'+(t.box?' data-box="'+t.box+'" tabindex="0" role="button" aria-label="'+esc(title==='?'?'a hidden block':title)+'"':'')+'>'+
      '<g class="ln" filter="url(#wob)"><rect class="blk'+(t.hold?' dash c-act':ghost?' dash ink':'')+'" x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="6"/><path class="thin'+(t.hold||ghost?' dash ink':'')+'" d="M'+x+' '+(y+HD())+' H'+(x+w)+'"/></g><g class="tx">'+
      '<text x="'+cx+'" y="'+(y+25)+'" class="'+(title.length>13?'xs':'m')+' '+(t.hold?'c-act':ghost?'c-mute':'c-thing')+'">'+esc(clip(title,18))+'</text>';
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
  function HD(){ return G.HD; }
  function arrowD(f,fi,t,ti){
    var fy=rY(f,fi), ty=ti<0?t.y+G.HD/2:rY(t,ti), fc=f.x+f.w/2, tc=t.x+t.w/2, sx, ex, d;
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
  function aaravBoard(stage,o){
    o=o||{}; var ts=LV.aaravTables(stage,S,o);
    if(o.lit) ts.forEach(function(t){ if(o.lit.indexOf(t.name)>-1) t.lit=true; });
    return boardSVG(ts,stage>=3?arrowsFor(ts):[],'Aarav\'s board: '+ts.filter(function(t){ return !t.ghost; }).map(function(t){ return t.name+(t.cols.length?' ('+t.cols.filter(function(c){ return !c.miss; }).map(function(c){ return c.n; }).join(', ')+')':''); }).join('; '));
  }

  /* ================= the shell: one full-screen game, the same for every level ================= */
  var RULES='+10 a right call · +5 on a retry · +5 for a streak of three · misses cost stars';
  var current=null;
  function shell(n,o){
    var info=LV.LEVELS[n-1];
    var g=el('<div class="game lv'+n+'" data-nolink role="dialog" aria-modal="true" aria-label="Level '+n+': '+esc(info.title)+'" hidden>'+
      '<header class="g-bar"><div class="g-name"><span class="kick">Level '+n+(info.q?' · '+info.q:'')+'</span><b class="g-title">'+esc(info.title)+'</b></div>'+
      '<div class="g-score" aria-live="polite"><span class="pts"><b class="g-pts">0</b> pts</span><span class="streak g-streak"></span><span class="miss">misses <b class="g-miss">0</b></span></div>'+
      '<div class="g-act"><button type="button" class="g-btn" data-restart>Restart</button><button type="button" class="g-btn exit" data-exit>Exit ✕</button></div></header>'+
      '<div class="g-prog"><i></i></div>'+
      '<div class="g-main '+(o.layout||'')+'">'+o.main+'</div>'+
      '<div class="g-dock" aria-live="polite"></div>'+
      '<div class="g-over g-intro" hidden></div><div class="g-over g-mid" hidden></div><div class="g-over g-win" hidden></div></div>');
    document.body.appendChild(g);
    var dock=$('.g-dock',g), intro=$('.g-intro',g), mid=$('.g-mid',g), win=$('.g-win',g), last=null;
    var api={g:g,n:n,o:o};
    api.rec=function(){ return o.rec?o.rec():S.lv[n]; };
    api.hud=function(){
      var L=api.rec(), h=o.hud?o.hud():{pts:L.pts,miss:L.miss,streak:L.streak};
      $('.g-pts',g).textContent=h.pts||0; $('.g-miss',g).textContent=h.miss||0;
      $('.g-streak',g).textContent=(h.streak||0)>=2?'streak ×'+h.streak:'';
      $('.g-prog i',g).style.width=(Math.min(1,o.progress())*100)+'%';
    };
    api.dock=function(msg,cls){ dock.className='g-dock'+(cls?' '+cls:''); dock.innerHTML=(msg?'<p class="g-msg">'+msg+'</p>':'')+(o.dockExtra?o.dockExtra():''); };
    api.idle=function(){ api.dock(o.idle||'',''); };
    /* a right call: returns the "+10" label; a miss: counts against the stars */
    api.right=function(key){
      var L=api.rec(); L.streak=(L.streak||0)+1;
      var gn=LV.gain(!!L.missed[key],L.streak); L.pts=(L.pts||0)+gn; save(); api.hud();
      return '<b class="gain">+'+gn+(L.streak>=3?' streak':'')+'</b> ';
    };
    api.miss=function(key){ var L=api.rec(); L.miss=(L.miss||0)+1; L.streak=0; if(key) L.missed[key]=1; save(); api.hud(); };
    api.complete=function(){ setTimeout(function(){ if(g.hidden) return; var left=(o.bonus||[]).filter(function(b){ return !api.rec().bonus[b.k]; }); if(left.length) bonus(left,0); else finish(); },800); };
    api.inter=function(html,then){ mid.innerHTML=html; mid.hidden=false; var b=$('[data-go]',mid); if(b){ b.focus({preventScroll:true}); b.onclick=function(){ mid.hidden=true; then&&then(); }; } };

    function bonus(list,i){
      var b=list[i], L=api.rec(), k=b.k, head='<p class="kick">Bonus round · '+(i+1)+' of '+list.length+'</p>';
      function after(){ if(i+1<list.length) bonus(list,i+1); else { mid.hidden=true; finish(); } }
      if(b.type==='think'){
        var T=D.THINK[k];
        mid.innerHTML='<div class="g-card">'+head+'<h3>Pause and think</h3><p>'+esc(T.p)+'</p><input type="text" class="g-in" placeholder="One line, then lock it in" value="'+esc(S.think[k]||'')+'"><p class="g-rules">+15 for any honest line. The reveal comes after.</p><div class="g-btns"><button type="button" class="btn" data-lock disabled>Lock it in</button><button type="button" class="btn ghost" data-skip>Skip</button></div><div class="g-rev" hidden></div></div>';
        var inp=$('input',mid), lock=$('[data-lock]',mid);
        inp.addEventListener('input',function(){ lock.disabled=inp.value.trim().length<8; }); lock.disabled=inp.value.trim().length<8;
        lock.onclick=function(){ S.think[k]=inp.value.trim(); L.bonus[k]=1; L.pts=(L.pts||0)+15; save(); api.hud(); inp.disabled=true; lock.remove(); $('[data-skip]',mid).textContent='Next →'; var r=$('.g-rev',mid); r.hidden=false; r.innerHTML='<b class="gain">+15</b> '+T.reveal; };
        $('[data-skip]',mid).onclick=after;
      } else {
        var Q=D.QUIZ[k];
        mid.innerHTML='<div class="g-card">'+head+'<h3>'+esc(Q.p)+'</h3><p class="g-scn">'+esc(Q.scn)+'</p><div class="g-opts">'+Q.o.map(function(x,j){ return '<button type="button" class="g-opt" data-i="'+j+'">'+esc(x[0])+'</button>'; }).join('')+'</div><p class="g-rev" hidden></p><div class="g-btns"><button type="button" class="btn" data-next hidden>Next →</button></div></div>';
        $('.g-opts',mid).onclick=function(e){
          var bt=e.target.closest('.g-opt'); if(!bt||bt.disabled) return;
          var x=Q.o[+bt.dataset.i], r=$('.g-rev',mid); r.hidden=false;
          if(x[1]){ var gn=api.right('bonus.'+k); L.bonus[k]=1; save(); $$('.g-opt',mid).forEach(function(z){ z.disabled=true; }); bt.classList.add('ok'); r.innerHTML=gn+'<b>Yes.</b> '+esc(x[2]); var nx=$('[data-next]',mid); nx.hidden=false; nx.focus(); }
          else { api.miss('bonus.'+k); bt.classList.add('no'); bt.disabled=true; r.innerHTML='<b>Not quite.</b> '+esc(x[2]); }
        };
        $('[data-next]',mid).onclick=after;
      }
      mid.hidden=false; var f=$('input,.g-opt',mid); if(f) f.focus({preventScroll:true});
    }
    function finish(){
      var L=api.rec(), mc=o.hud?o.hud().miss:L.miss; if(!L.best||L.pts>L.best) L.best=L.pts; save();
      var st=o.stars?o.stars():LV.stars(L.miss), nx=o.next?o.next():(n<7?{label:'Next: Level '+(n+1)+' →',go:function(){ api.close(true); goSec(LV.LEVELS[n].sec); }}:null);
      win.innerHTML='<div class="g-card win"><p class="kick">'+(o.winKick?o.winKick():'Level '+n+' complete')+'</p><p class="g-stars">'+starStr(st)+'</p><h3>'+(o.winPts?o.winPts():(L.pts||0))+' points</h3><p>'+o.summary()+'</p><p class="g-miss">'+(mc?mc+(mc===1?' miss.':' misses.'):'No misses.')+(L.best>L.pts?' Best: '+L.best+'.':'')+'</p>'+
        '<div class="g-btns">'+(nx?'<button type="button" class="btn" data-next>'+nx.label+'</button>':'')+'<button type="button" class="btn ghost" data-again>Play again</button><button type="button" class="btn ghost" data-exit>Back to the lab</button></div></div>';
      win.hidden=false;
      if(nx) $('[data-next]',win).onclick=nx.go;
      sure($('[data-again]',win),function(){ restart(); showIntro(); },'Wipe this level? Tap again');
      var f=$('[data-next]',win)||$('[data-exit]',win); f.focus({preventScroll:true});
    }
    function showIntro(){
      var I=typeof o.intro==='function'?o.intro():o.intro, need=o.needs&&o.needs();
      intro.innerHTML='<div class="g-card"><p class="kick">'+(need?'Level '+n+' builds on Level 1':'How to play')+'</p><h3>'+I.h+'</h3>'+(need?
        '<p class="g-need">'+need.msg+'</p><div class="g-btns"><button type="button" class="btn" data-need>'+need.btn+'</button><button type="button" class="btn ghost" data-exit>Back to the lab</button></div>':
        '<ol class="g-steps">'+I.steps.map(function(s){ return '<li>'+s+'</li>'; }).join('')+'</ol>'+(I.tip?'<p class="g-tip">'+I.tip+'</p>':'')+(I.extra||'')+'<p class="g-rules">'+(I.rules||RULES)+'</p><button type="button" class="btn" data-go>Let\'s start</button>')+'</div>';
      intro.hidden=false;
      if(need) $('[data-need]',intro).onclick=need.go;
      var go=$('[data-go]',intro); if(go) go.onclick=function(){ var extra=o.onGo?o.onGo(intro):null; intro.hidden=true; if(extra) api.dock(extra,'ok'); else api.idle(); o.paint(); if(o.afterGo) o.afterGo(); };
      var f=$('input',intro)||$('.btn',intro); if(f) f.focus({preventScroll:true});
    }
    function restart(){
      var best=(api.rec().best)||0; o.reset();
      if(!o.rec) S.lv[n]={pts:0,miss:0,streak:0,missed:{},bonus:{},best:best};
      save(); win.hidden=true; mid.hidden=true; o.paint(); api.hud(); api.dock('Fresh start.');
    }
    api.open=function(){
      if(current&&current!==api) current.close(true);
      current=api; last=document.activeElement;
      g.hidden=false; document.documentElement.classList.add('g-lock');
      win.hidden=true; mid.hidden=true; intro.hidden=true;
      if(o.onOpen) o.onOpen();
      o.paint(); api.hud(); api.idle();
      if(o.isDone()) finish(); else showIntro();
    };
    api.close=function(quiet){
      if(g.hidden) return;
      g.hidden=true; document.documentElement.classList.remove('g-lock'); if(o.onClose) o.onClose(); current=null; save();
      if(!quiet&&last&&document.contains(last)) last.focus({preventScroll:true});
    };
    g.addEventListener('click',function(e){ if(e.target.closest('[data-exit]')) api.close(); });
    sure($('[data-restart]',g),function(){ restart(); showIntro(); },'Wipe it? Tap again');
    api.finish=finish; api.intro=showIntro;
    return api;
  }
  document.addEventListener('keydown',function(e){ if(e.key!=='Escape'||!current) return; if(current.o.esc&&current.o.esc()) return; current.close(); });

  /* ================= the level cards on the page, and the level map ================= */
  var ART={1:['gt','gt','gf','gq','gt','gq'],2:['gt','gf','gf','gt','gf','gq'],3:['gt','gl','gt','gq','gl','gt'],4:['gf','gx','gf','gx','gq','gf'],5:['gt','gl','gt','gl','gt','gl'],6:['gt','gf','gl','gt','gf','gl']};
  var games={};
  function cardHTML(n){
    var info=LV.LEVELS[n-1], c=ck(), d=LV.done(n,S,c), p=LV.progress(n,S,c), pts=LV.levelPts(n,S,c), need=LV.needs(n,S)&&!d;
    var meta=d?starStr(LV.levelStars(n,S,c))+' '+pts+' pts · done':p[0]?p[0]+' of '+p[1]+' · '+pts+' pts':info.meta;
    var btn=n===6?'':'<button type="button" class="btn" data-open="'+n+'">'+(d?'Open Level '+n:p[0]?'Resume Level '+n:'Start Level '+n)+'</button>';
    return '<div class="gc-art" aria-hidden="true">'+ART[n].map(function(k){ return '<i class="'+k+'">'+(k==='gq'?'?':'')+'</i>'; }).join('')+'</div>'+
      '<div class="gc-body"><p class="kick">Level '+n+(info.q?' · '+info.q:'')+'</p><h3>'+esc(info.title)+'</h3><p>'+esc(info.desc)+'</p>'+
      (need?'<p class="gc-need">Builds on Level 1: find the six blocks there first.</p>':'')+'<p class="gc-meta">'+meta+'</p>'+btn+'</div>';
  }
  function drawCards(){ $$('.gcard[data-level]').forEach(function(c){ c.innerHTML=cardHTML(+c.dataset.level); }); }
  document.addEventListener('click',function(e){ var b=e.target.closest('[data-open]'); if(b&&games[b.dataset.open]) games[b.dataset.open].open(); });
  function mapHTML(){
    var c=ck(), nx=LV.next(S,c), tot=0, st=0;
    var tiles=LV.LEVELS.map(function(L){
      var d=LV.done(L.n,S,c), s=LV.levelStars(L.n,S,c), p=LV.levelPts(L.n,S,c), pr=LV.progress(L.n,S,c); tot+=p; st+=s;
      var cls=d?'done':L.n===nx?'next':'later';
      return '<a class="lvt '+cls+'" href="#'+L.sec+'"><span class="ln">Level '+L.n+(d?' · done':L.n===nx?' · next':'')+'</span><b>'+esc(L.title)+'</b><span class="ls">'+(d?starStr(s):'<span class="lpr">'+pr[0]+' / '+pr[1]+'</span>')+'</span><span class="lp">'+(p?p+' pts':'')+'</span></a>';
    }).join('');
    return '<div class="lvsum"><span class="stars">★</span> <b>'+st+'</b> / 21 stars · <b>'+tot+'</b> pts · '+(nx?'Level '+nx+' next':'run complete')+'</div><div class="lvtiles">'+tiles+'</div>';
  }
  function drawMap(){ $$('.lvmap').forEach(function(m){ m.innerHTML=mapHTML(); }); }

  /* ================= Level 1 · find the things ================= */
  var WORD={msg1:'his message',msg2:'the app\'s reply'}, FACT_COL={casual:'tone',time:'sent at'};
  function wordOf(id){ if(WORD[id]) return WORD[id]; var x=$('#tx [data-t="'+id+'"]'); return x?x.textContent.trim():id; }
  function huntBoard(pop){
    var all=D.TOKEN_ORDER, tr=function(id){ return LV.tagRight(S,id); }, fe=function(e){ return LV.foundEnt(S,e); };
    function ids(role,ent){ return all.filter(function(id){ var t=D.TOKENS[id]; return t.role===role && (!ent||t.ent===ent); }); }
    function slot(id,cls,txt){ var on=tr(id); return '<span class="hs '+cls+(on?' on':'')+'" data-drop="'+id+'">'+(on?esc(txt||wordOf(id)):'')+'</span>'; }
    function cnt(role){ var x=ids(role); return [x.filter(tr).length,x.length]; }
    var bl=LV.blocksFound(S), fa=cnt('fact');
    var hud='<div class="hb-hud"><span class="c thing">blocks <b>'+bl+'</b>/'+D.TARGET_ENTITIES.length+'</span><span class="c fact">facts <b>'+fa[0]+'</b>/'+fa[1]+'</span></div>';
    var blocks=D.TARGET_ENTITIES.map(function(e){
      var on=fe(e), facts=ids('fact',e).filter(tr);
      return '<div class="hb-blk'+(on?' on':'')+(pop===e?' pop':'')+'"><div class="nm">'+(on?esc(e):'?')+'</div>'+
        '<div class="ws">'+ids('thing',e).map(function(id){ return slot(id,'thing'); }).join('')+'</div>'+
        (facts.length?'<div class="fs">'+facts.map(function(id){ return slot(id,'fact',FACT_COL[id]+': '+wordOf(id)); }).join('')+'</div>':'')+'</div>';
    }).join('');
    return '<p class="kick">Aarav\'s board</p>'+hud+'<div class="hb-grid">'+blocks+'</div>';
  }
  function fly(from,id){
    var to=$('#board1 [data-drop="'+id+'"]'); if(!to||!from) return;
    to.scrollIntoView({block:'nearest'});
    if(!to.animate||reduced()){ to.classList.add('land'); return; }
    var a=from.getBoundingClientRect(), b=to.getBoundingClientRect(), t=D.TOKENS[id];
    var c=el('<span class="flychip '+t.role+'">'+esc(to.textContent)+'</span>');
    c.style.left=a.left+'px'; c.style.top=a.top+'px'; document.body.appendChild(c);
    var dx=b.left-a.left, dy=b.top-a.top; to.style.visibility='hidden';
    c.animate([{transform:'translate(0,0) scale(1)'},{transform:'translate('+dx/2+'px,'+(dy/2-60)+'px) scale(1.15)',offset:.45},{transform:'translate('+dx+'px,'+dy+'px) scale(1)'}],{duration:650,easing:'cubic-bezier(.3,.6,.25,1)'});
    /* a timer, not onfinish: a hidden tab can pause the animation, and the chip must still land */
    setTimeout(function(){ c.remove(); to.style.visibility=''; to.classList.add('land'); },680);
  }
  (function(){
    var tpl=$('#tx1'); if(!tpl) return;
    var api, root, board, sel=null, pop=null, popT=null;
    api=games[1]=shell(1,{
      layout:'',
      main:'<section class="g-chat" aria-label="Aarav\'s chat"><p class="g-lab">Aarav\'s chat · point at an underlined word</p><div class="tx" id="tx"></div></section><section class="g-board" aria-label="Aarav\'s board"><div class="hboard" id="board1"></div></section>',
      idle:'Point at an underlined word in the chat (or tap it) and make your call.',
      intro:{h:'Find the things worth storing',steps:['Point at an underlined word in Aarav\'s chat (or tap it).','Call it right there: a <span class="q thing">thing</span> gets its own block, a <span class="q fact">fact</span> describes a thing.','Right calls fly onto the board. Uncover all six blocks.'],tip:'The test: can the app create, read, update and delete it on its own, and can there be many?'},
      bonus:[{k:'conv'},{k:'tone'}],
      progress:function(){ var p=LV.progress(1,S); return p[0]/p[1]; },
      isDone:function(){ return LV.done(1,S); },
      summary:function(){ return 'Six blocks found and two facts stuck on.'; },
      reset:function(){ S.tags={}; },
      paint:function(){ board.innerHTML=huntBoard(); paintWords(); },
      esc:function(){ if(pop){ unpop(); return true; } return false; },
      onClose:function(){ unpop(); }
    });
    root=$('#tx',api.g); root.innerHTML=tpl.innerHTML; board=$('#board1',api.g);
    function paintWords(){
      $$('[data-t]',root).forEach(function(x){
        var id=x.dataset.t; x.classList.remove('thing','fact','sel');
        if(LV.tagRight(S,id)) x.classList.add(D.TOKENS[id].role);
        if(id===sel) x.classList.add('sel');
      });
    }
    /* the calls pop up right under the word: on hover with a mouse, on tap or Enter otherwise */
    function unpop(){ clearTimeout(popT); if(pop){ pop.remove(); pop=null; } if(sel){ sel=null; paintWords(); } }
    function ask(id,focus){
      var w=$('[data-t="'+id+'"]',root); if(!w) return;
      clearTimeout(popT); if(pop&&sel===id){ if(focus) $('.g-call:not(:disabled)',pop).focus({preventScroll:true}); return; }
      if(pop) pop.remove();
      sel=id; paintWords();
      pop=el('<div class="g-pop" role="group" aria-label="What is '+esc(wordOf(id))+'?"><div class="g-calls">'+
        '<button type="button" class="g-call thing" data-c="thing">a thing<small>its own block</small></button>'+
        '<button type="button" class="g-call fact" data-c="fact">a fact<small>describes a thing</small></button></div><p class="g-hint" hidden></p></div>');
      api.g.appendChild(pop);
      var r=w.getBoundingClientRect(), pw=pop.offsetWidth, ph=pop.offsetHeight;
      pop.style.left=Math.min(Math.max(8,r.left+r.width/2-pw/2),window.innerWidth-pw-8)+'px';
      pop.style.top=(r.bottom+8+ph>window.innerHeight-8?r.top-ph-8:r.bottom+8)+'px';
      pop.addEventListener('mouseenter',function(){ clearTimeout(popT); });
      pop.addEventListener('mouseleave',function(){ popT=setTimeout(unpop,250); });
      pop.addEventListener('click',function(e){ var b=e.target.closest('.g-call'); if(b&&!b.disabled) call(b.dataset.c); });
      if(focus) $('.g-call',pop).focus({preventScroll:true});
    }
    function call(c){
      var id=sel; if(!id) return;
      var tok=D.TOKENS[id], right=c===tok.role, w=$('[data-t="'+id+'"]',root);
      if(!right){
        api.miss(id);
        if(pop){ $$('.g-call',pop).forEach(function(b){ if(b.dataset.c===c){ b.classList.add('no'); b.disabled=true; } });
          var m=$('.g-hint',pop); m.hidden=false; m.innerHTML='<b>Not quite.</b> '+tok.nudge; }
        if(w){ w.classList.add('no'); setTimeout(function(){ w.classList.remove('no'); },400); }
        return;
      }
      var newEnt=tok.role==='thing'&&!LV.foundEnt(S,tok.ent)?tok.ent:'';
      var gn=api.right(id); S.tags[id]=c; unpop(); save();
      board.innerHTML=huntBoard(newEnt); paintWords(); api.hud(); fly(w,id);
      api.dock(gn+'<b>Yes.'+(newEnt?' New block: '+newEnt+'.':tok.role==='thing'?' Another word for '+tok.ent+'.':'')+'</b> '+tok.why,'ok');
      if(LV.done(1,S)) api.complete();
    }
    root.addEventListener('click',function(e){
      var t=e.target.closest('[data-t]'); if(!t){ unpop(); return; }
      var id=t.dataset.t;
      if(LV.tagRight(S,id)){ unpop(); api.dock('<b>Already on the board.</b> '+D.TOKENS[id].why); return; }
      ask(id,e.detail===0);
    });
    root.addEventListener('mouseover',function(e){ var t=e.target.closest('[data-t]'); if(!t||LV.tagRight(S,t.dataset.t)) return; ask(t.dataset.t); });
    root.addEventListener('mouseout',function(e){
      var t=e.target.closest('[data-t]'); if(!t||(e.relatedTarget&&(t.contains(e.relatedTarget)||(pop&&pop.contains(e.relatedTarget))))) return;
      clearTimeout(popT); popT=setTimeout(unpop,250);
    });
    root.addEventListener('keydown',function(e){ var t=e.target.closest('[data-t]'); if(t&&(e.key==='Enter'||e.key===' ')){ e.preventDefault(); t.click(); } });
    $$('[data-t]',root).forEach(function(x){ x.tabIndex=0; x.setAttribute('role','button'); });
    api.g.addEventListener('scroll',function(e){ if(pop&&!pop.contains(e.target)) unpop(); },true);
    window.addEventListener('resize',function(){ if(pop) unpop(); });
  })();

  /* the levels that read the board need the six blocks from Level 1 */
  function needBlocks(n){ return function(){
    if(!LV.needs(n,S)) return null;
    var left=D.TARGET_ENTITIES.length-LV.blocksFound(S);
    return {msg:'Level '+n+' works on the six blocks you uncover in Level 1. '+left+(left===1?' block is':' blocks are')+' still hidden.',btn:'Play Level 1',go:function(){ games[1].open(); }};
  }; }
  /* a tap-to-place level: a card on the left, targets on the right */
  function pile(cards,placed,cur,label){
    var left=cards.filter(function(c){ return !placed(c); });
    return {left:left,cur:left.find(function(c){ return c.id===cur; })||left[0],
      bank:function(c0){ return left.length>1?left.filter(function(c){ return c!==c0; }).map(function(c){ return '<button type="button" class="fc" data-pick="'+c.id+'">'+esc(label(c))+'</button>'; }).join(''):'<span class="empty">'+(left.length?'Last card.':'Every card is placed.')+'</span>'; }};
  }

  /* ================= Level 2 · fill the blocks ================= */
  (function(){
    var api, picked=null;
    api=games[2]=shell(2,{
      layout:'side',
      main:'<section class="g-side"><p class="g-lab">Fact card</p><div class="fcard" id="l2card"></div><p class="g-lab">Still in the pile · tap one to swap</p><div class="bank g-bank" id="l2bank"></div></section>'+
        '<section class="g-stage"><p class="g-lab">Aarav\'s board · tap the block this fact describes</p><figure class="wbx board"><div class="sc" id="l2board"></div></figure></section>',
      idle:'Tap the block on the board that this fact describes.',
      intro:{h:'Stick each fact on its block',steps:['A fact card sits on the left.','Ask: which block would I need this to recreate? Tap that block on the board.','One card fits no column. Put it on the coral block, held for Level 4.'],tip:'memory.txt already answered this for a message: who said it, what, and when.'},
      bonus:[{k:'t2',type:'think'},{k:'time'},{k:'attach'}],
      needs:needBlocks(2),
      progress:function(){ var p=LV.progress(2,S); return p[0]/p[1]; },
      isDone:function(){ return LV.done(2,S); },
      summary:function(){ return 'Eight facts on their blocks, and the screenshot held back for Level 4.'; },
      reset:function(){ S.facts={}; },
      paint:paint
    });
    function paint(){
      var P=pile(D.FACTS,function(c){ return S.facts[c.id]===c.ent; },picked,function(c){ return c.id; }), c=P.cur;
      $('#l2card',api.g).innerHTML=c?'<b class="fname">'+esc(c.id)+'</b><p>Which block can you not recreate without it?</p><p class="fcount">'+(D.FACTS.length-P.left.length+1)+' of '+D.FACTS.length+'</p>':'<b class="fname">done</b>';
      $('#l2bank',api.g).innerHTML=P.bank(c);
      $('#l2board',api.g).innerHTML=aaravBoard(2,{targets:true});
      picked=c?c.id:null;
    }
    function drop(box){
      var card=D.FACTS.find(function(c){ return c.id===picked; }); if(!card) return;
      if(card.ent===box){ var gn=api.right(card.id); S.facts[card.id]=box; picked=null; save(); paint(); api.dock(gn+'<b>Yes.</b> '+card.why,'ok'); if(LV.done(2,S)) api.complete(); }
      else { api.miss(card.id); api.dock('<b>Not quite.</b> '+card.nudge,'no'); var g=$('#l2board [data-box="'+box+'"]',api.g); if(g){ g.classList.add('no'); setTimeout(function(){ g.classList.remove('no'); },400); } }
    }
    api.g.addEventListener('click',function(e){
      var p=e.target.closest('[data-pick]'); if(p){ picked=p.dataset.pick; paint(); return; }
      var b=e.target.closest('#l2board [data-box]'); if(b) drop(b.dataset.box);
    });
    api.g.addEventListener('keydown',function(e){ var b=e.target.closest('#l2board [data-box]'); if(b&&(e.key==='Enter'||e.key===' ')){ e.preventDefault(); drop(b.dataset.box); } });
  })();

  /* ================= Level 3 · connect the blocks ================= */
  var MINI={users:'name',conversations:'started_at',messages:'content',workflows:'description',diagnoses:'plan',tools:'name'};
  function pairMini(p){
    var known=LV.shapeKnown(S,p), ok=known&&LV.keyOk(S,p), m2m=p.shape==='many-to-many', k=S.keys[p.id]||{};
    function blk(n,x,extra){ return {name:n,x:x,y:30,w:G.BW,cols:[{n:'id',k:'pk'},{n:MINI[n],k:''}].concat(extra||[])}; }
    var A, B, ts, ex='', lab='';
    if(m2m&&ok){
      A=blk(p.ta,12); B=blk(p.tb,452);
      ts=[A,{name:p.join.table,x:232,y:30,w:G.BW,cols:[{n:'id',k:'pk'},{n:p.join.cols[0],k:'fk',ref:p.ta},{n:p.join.cols[1],k:'fk',ref:p.tb}]},B];
      ex='<g class="tx"><text x="307" y="190" class="xs c-link">one row per pairing</text></g>';
      lab=p.ta+' and '+p.tb+', joined by '+p.join.table;
    } else {
      A=blk(p.ta,60); B=blk(p.tb,404,ok?[{n:p.fk.name,k:'fk',ref:p.ta}]:[]);
      if(!ok&&k.table){ (k.table===p.ta?A:B).lit=true; }
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
  function traceHTML(){
    var cm=LV.keyOk(S,D.PAIRS[1]), uc=LV.keyOk(S,D.PAIRS[0]);
    return '<span class="nd">message 101</span><span class="ar">→</span><span class="nd '+(cm?'':'dim')+'">'+(cm?'conversation_id = 7':'conversation ?')+'</span><span class="ar">→</span><span class="nd '+(uc&&cm?'':'dim')+'">'+(uc&&cm?'user_id = 1 · Aarav':'user ?')+'</span>';
  }
  (function(){
    var api, crossed={}, curId=null;
    function tpl(id){ var t=$('#'+id); return t?t.innerHTML:''; }
    function interCard(kick,id,text,btn){ return '<div class="g-card wide"><p class="kick">'+kick+'</p><figure class="wbx">'+tpl(id)+'</figure><p>'+text+'</p><div class="g-btns"><button type="button" class="btn" data-go>'+(btn||'Got it')+'</button></div></div>'; }
    function seen(k){ var L=S.lv[3]; L.seen=L.seen||{}; return L.seen[k]; }
    function see(k){ S.lv[3].seen=S.lv[3].seen||{}; S.lv[3].seen[k]=1; save(); }
    function cur(){ return D.PAIRS.find(function(p){ return !LV.linked(S,p); }); }
    function lessons(then){
      var p=cur();
      if(!seen('rows')) return api.inter(interCard('Before you link · 1 of 2','i-rows','To point at a row you need a way to name it, and its words cannot do it: two messages both say "okay". So number the rows. That number is the row\'s <b>id</b>, its key. It never repeats.','Next'),function(){ see('rows'); lessons(then); });
      if(!seen('side')) return api.inter(interCard('Before you link · 2 of 2','i-side','A <b>pointer</b> is a column that holds another row\'s id. A cell holds one value, so the pointer goes on the side that has only one to point at: each message is in exactly one chat. Name it after the other block, singular, plus <code>_id</code>.','Link the first pair'),function(){ see('side'); lessons(then); });
      if(p&&p.shape==='many-to-many'&&!seen('third')) return api.inter(interCard('The last pair','i-third','When both answers are yes, neither block can hold one pointer. A third block holds one row per pairing, with a pointer to each side.','Link it'),function(){ see('third'); lessons(then); });
      if(then) then();
    }
    api=games[3]=shell(3,{
      layout:'side',
      main:'<section class="g-side"><div id="l3round"></div></section><section class="g-stage"><p class="g-lab">Aarav\'s board</p><figure class="wbx board"><div class="sc" id="l3board"></div></figure><p class="g-lab">Follow message 101 back to its owner</p><div class="trace" id="l3trace"></div></section>',
      idle:'Answer both questions, then place the pointer.',
      intro:{h:'Link the blocks, pair by pair',steps:['Each round is one pair of blocks. Answer two questions about it, asked both ways.','The answers give the link its shape: one-to-many or many-to-many.','Then place the pointer: tap the block that holds it, then pick its name.'],tip:'The pointer goes on the side that has only one to point at.'},
      bonus:[{k:'often'}],
      needs:needBlocks(3),
      progress:function(){ var p=LV.progress(3,S); return p[0]/p[1]; },
      isDone:function(){ return LV.done(3,S); },
      summary:function(){ return 'Five links placed: four pointers on the many side and one third block. Follow one message back to its owner:</p><div class="trace">'+traceHTML()+'</div><p>'; },
      reset:function(){ S.dir={}; S.keys={}; S.shapes={}; crossed={}; },
      afterGo:function(){ lessons(); },
      paint:paint
    });
    function opt(kind,v,label,state){ return '<button type="button" class="g-chip'+(state?' '+state:'')+'" data-'+kind+'="'+esc(v)+'"'+(state?' disabled':'')+'>'+esc(label||v)+'</button>'; }
    function paint(){
      var p=cur(), box=$('#l3round',api.g);
      $('#l3board',api.g).innerHTML=aaravBoard(3); $('#l3trace',api.g).innerHTML=traceHTML();
      if(!p){ box.innerHTML='<p class="kick">All five pairs linked</p><p>Every block is linked.</p>'; return; }
      if(p.id!==curId){ curId=p.id; crossed={}; }
      var d=S.dir[p.id]||{}, k=S.keys[p.id]||{}, known=LV.shapeKnown(S,p), m2m=p.shape==='many-to-many', i=D.PAIRS.indexOf(p);
      function yn(q){ var got=d[q]; return ['yes','no'].map(function(v){ return opt(q,v,v,got===v?'ok':crossed[q+v]?'no':''); }).join(''); }
      var h='<p class="kick">Pair '+(i+1)+' of '+D.PAIRS.length+' · '+esc(p.ta)+' and '+esc(p.tb)+'</p><div class="mini">'+pairMini(p)+'</div>'+
        '<div class="g-q"><span>'+esc(p.qa)+'</span><div class="g-chips">'+yn('ab')+'</div></div>';
      if(d.ab===p.ab) h+='<div class="g-q"><span>'+esc(p.qb)+'</span><div class="g-chips">'+yn('ba')+'</div></div>';
      if(known){
        h+='<p class="g-shape"><b>'+cap(p.shape)+'.</b> '+esc(p.why)+'</p>';
        if(!m2m){
          h+='<div class="g-q"><span>Which block holds the pointer?</span><div class="g-chips">'+[p.ta,p.tb].map(function(n){ return opt('side',n,n,k.table===n?'ok':crossed['side'+n]?'no':''); }).join('')+'</div></div>';
          if(k.table===p.fk.table) h+='<div class="g-q"><span>Call it</span><div class="g-chips">'+p.names.map(function(n){ return opt('name',n,n,nameEq(k.name,n)?'ok':crossed['name'+n]?'no':''); }).join('')+'</div></div>';
        } else {
          h+='<div class="g-q"><span>Name the third block</span><div class="g-chips">'+p.joins.map(function(n){ return opt('join',n,n,k.join===n?'ok':crossed['join'+n]?'no':''); }).join('')+'</div></div>';
          if(k.join===p.join.table) h+='<div class="g-q"><span>Its two pointers, one to each side</span><div class="g-chips">'+p.ptrs.map(function(n){ return opt('ptr',n,n,(k.c1===n||k.c2===n)?'ok':crossed['ptr'+n]?'no':''); }).join('')+'</div></div>';
        }
      }
      box.innerHTML=h;
    }
    function after(p,msg){
      if(LV.linked(S,p)){
        S.shapes[p.id]=p.shape; save(); paint();
        api.dock(msg+'<b>Linked.</b> '+(p.shape==='many-to-many'?'One row per pairing in '+p.join.table+'.':p.fk.name+' on '+p.fk.table+' points back to '+p.ta+'.'),'ok');
        if(LV.done(3,S)) api.complete(); else lessons();
      } else { paint(); api.dock(msg,'ok'); }
    }
    api.g.addEventListener('click',function(e){
      var b=e.target.closest('.g-chip'); if(!b||b.disabled) return;
      var p=cur(); if(!p) return; var k=S.keys[p.id]=S.keys[p.id]||{}, d=S.dir[p.id]=S.dir[p.id]||{}, gn;
      function wrong(step,v,nudge){ crossed[step+v]=1; api.miss(p.id+'.'+step); paint(); api.dock('<b>Not quite.</b> '+nudge,'no'); }
      if(b.dataset.ab||b.dataset.ba){
        var q=b.dataset.ab?'ab':'ba', v=b.dataset[q];
        if(v===p[q]){ gn=api.right(p.id+'.'+q); d[q]=v; save(); after(p,gn+'<b>Yes.</b>'+(LV.shapeKnown(S,p)?' '+cap(p.shape)+'.':'')+' '); }
        else wrong(q,v,q==='ab'?p.na:p.nb);
      } else if(b.dataset.side){
        var sd=b.dataset.side;
        if(sd===p.fk.table){ gn=api.right(p.id+'.side'); k.table=sd; save(); after(p,gn+'<b>Yes.</b> Each '+sing(p.tb)+' has one '+sing(p.ta)+', so one value is enough. '); }
        else wrong('side',sd,'A cell holds one value, and one '+sing(p.ta)+' has many '+p.tb+'. Try the other side.');
      } else if(b.dataset.name){
        var nm=b.dataset.name;
        if(nm===p.fk.name){ gn=api.right(p.id+'.name'); k.name=nm; save(); after(p,gn+'<b>Yes.</b> '); }
        else wrong('name',nm,'Name it after the block it points at, singular, plus _id.');
      } else if(b.dataset.join){
        var j=b.dataset.join;
        if(j===p.join.table){ gn=api.right(p.id+'.join'); k.join=j; save(); after(p,gn+'<b>Yes.</b> A block of its own for the pairs. '); }
        else wrong('join',j,j==='tools'||j==='workflows'?j+' already exists, and a cell there can hold only one value. The pairs need a block of their own.':'A new block for the pairs, named after both sides.');
      } else if(b.dataset.ptr){
        var pt=b.dataset.ptr, ix=p.join.cols.indexOf(pt);
        if(ix>-1){ gn=api.right(p.id+'.ptr'); k['c'+(ix+1)]=pt; save(); after(p,gn+'<b>Yes.</b> '); }
        else wrong('ptr',pt,'One pointer to each side, named after that block, singular, plus _id.');
      }
    });
  })();

  /* ================= Level 4 · rows or files ================= */
  function board4(){
    var shot=S.sort.shot==='file', meta=S.sort.meta==='row';
    var M={name:'messages',x:22,y:24,w:170,cols:[{n:'id',k:'pk'},{n:'conversation_id',k:'fk'},{n:'content',k:''}]};
    var A={name:'attachments',x:282,y:24,w:180,ghost:shot?'':'1',empty:'sort the screenshot first',cols:shot?[{n:'id',k:'pk'},{n:'message_id',k:'fk',ref:'messages'},{n:'file_name',k:'',miss:meta?'':'1'},{n:'file_url',k:'file'}]:[]};
    var ex=shot?'<g class="ln" filter="url(#wob)"><path d="M566 60 H700 L688 162 H578 Z M562 60 H704"/><rect class="thin f-act" x="608" y="86" width="50" height="38" rx="4"/><path class="thin c-act" d="M612 120 L626 104 L636 114 L644 106 L654 120"/>'+
      '<path class="arw c-act" d="M'+(A.x+A.w)+' '+rY(A,3)+' C510 '+rY(A,3)+' 530 128 568 120" marker-end="url(#ahc)"/></g><g class="tx"><text x="633" y="192" class="m">file storage</text><text x="633" y="218" class="xs c-act">jira-board.png</text></g>':'';
    var ts=[M,A];
    return boardSVG(ts,arrowsFor(ts),shot?'The attachments block: id, message_id pointing at messages, file_name, and file_url pointing at jira-board.png in file storage.':'The attachments block appears once the screenshot is sorted.',ex,760,232);
  }
  (function(){
    var api, picked=null, T=D.THINK.t4;
    api=games[4]=shell(4,{
      layout:'side',
      main:'<section class="g-side"><p class="g-lab">Card</p><div class="fcard" id="l4card"></div><p class="g-lab">Still in the pile · tap one to swap</p><div class="bank g-bank" id="l4bank"></div></section>'+
        '<section class="g-stage"><p class="g-lab">Where does it go? Tap a bin</p><div class="bins" id="l4bins">'+
        '<div class="bin" data-box="row" role="button" tabindex="0"><div class="h"><b>A cell in a row</b><small>Text, numbers, dates, yes or no.</small></div><div class="in"></div></div>'+
        '<div class="bin" data-box="file" role="button" tabindex="0"><div class="h"><b>A file in storage, with its link in a row</b><small>Images, documents, audio, video.</small></div><div class="in"></div></div></div>'+
        '<figure class="wbx board"><p class="kick">Aarav\'s board · the held block</p><div class="sc" id="l4board"></div></figure></section>',
      idle:'Tap the bin this card belongs in.',
      intro:function(){ return {h:'Rows or files?',steps:['A card sits on the left: something Aarav\'s app keeps.','Tap the bin it belongs in: a cell in a row, or a file in storage with its link in a row.','Sort the screenshot and its block appears on the board.'],
        extra:'<label class="g-think"><span>Before you start, one line: '+esc(T.p)+'</span><input type="text" data-think="t4" placeholder="+15 for any honest line" value="'+esc(S.think.t4||'')+'"></label>'}; },
      onGo:function(intro){
        var i=$('[data-think]',intro), v=i?i.value.trim():''; if(v.length<8) return null;
        S.think.t4=v; var L=S.lv[4]; if(L.bonus.t4) return null;
        L.bonus.t4=1; L.pts+=15; save(); api.hud(); return '<b class="gain">+15</b> '+T.reveal;
      },
      progress:function(){ var p=LV.progress(4,S); return p[0]/p[1]; },
      isDone:function(){ return LV.done(4,S); },
      summary:function(){ return 'Five things in cells, three in file storage. The screenshot\'s block is on the board: a row keeps the link, the bytes sit outside.'; },
      reset:function(){ S.sort={}; },
      paint:paint
    });
    function paint(){
      var P=pile(D.STORE_CARDS,function(c){ return S.sort[c.id]===c.where; },picked,function(c){ return c.t; }), c=P.cur;
      $('#l4card',api.g).innerHTML=c?'<b class="fname sm">'+esc(c.t)+'</b><p class="fcount">'+(D.STORE_CARDS.length-P.left.length+1)+' of '+D.STORE_CARDS.length+'</p>':'<b class="fname">done</b>';
      $('#l4bank',api.g).innerHTML=P.bank(c);
      $$('#l4bins .bin',api.g).forEach(function(b){ $('.in',b).innerHTML=D.STORE_CARDS.filter(function(x){ return S.sort[x.id]===b.dataset.box; }).map(function(x){ return '<span class="fc ok">'+esc(x.t)+'</span>'; }).join(''); });
      $('#l4board',api.g).innerHTML=board4();
      picked=c?c.id:null;
    }
    function drop(box,b){
      var card=D.STORE_CARDS.find(function(c){ return c.id===picked; }); if(!card) return;
      if(card.where===box){ var gn=api.right(card.id); S.sort[card.id]=box; picked=null; save(); paint(); api.dock(gn+'<b>Yes.</b> '+card.why,'ok'); if(LV.done(4,S)) api.complete(); }
      else { api.miss(card.id); api.dock('<b>Not quite.</b> '+card.nudge,'no'); b.classList.add('no'); setTimeout(function(){ b.classList.remove('no'); },400); }
    }
    api.g.addEventListener('click',function(e){
      var p=e.target.closest('[data-pick]'); if(p){ picked=p.dataset.pick; paint(); return; }
      var b=e.target.closest('#l4bins .bin'); if(b) drop(b.dataset.box,b);
    });
    api.g.addEventListener('keydown',function(e){ var b=e.target.closest('#l4bins .bin'); if(b&&(e.key==='Enter'||e.key===' ')){ e.preventDefault(); drop(b.dataset.box,b); } });
  })();

  /* ================= Level 5 · the boss: can the model answer? ================= */
  function missingPieces(){ var ts=LV.aaravTables(5,S), m=0, t=0; ts.forEach(function(x){ t++; if(x.ghost) m++; x.cols.forEach(function(c){ t++; if(c.miss) m++; }); }); return [m,t]; }
  (function(){
    var api, step=0, lit=[], itemKey=null;
    var items=D.BOSS.qs.map(function(q,i){ return {key:'q'+i,q:q}; }).concat(D.BOSS.bridge.map(function(b,i){ return {key:'b'+i,b:b}; }));
    function cur(){ return items.find(function(it){ return !S.boss.done[it.key]; }); }
    api=games[5]=shell(5,{
      layout:'side',
      main:'<section class="g-side"><div id="l5task"></div></section><section class="g-stage"><p class="g-lab">Aarav\'s whole board · tap a block</p><figure class="wbx board"><div class="sc" id="l5board"></div></figure></section>',
      idle:'Tap the blocks in order, following the arrows.',
      intro:function(){ var m=missingPieces(); return {h:'Can the model answer?',steps:['Three questions the product must answer. For each, tap the blocks that answer it, in order, following the arrows.','Then four addresses from your Lecture 4 API table. Tap the block each request reaches.','A model is done when it can answer what the product must ask.'],
        tip:m[0]?m[0]+' of '+m[1]+' pieces of your board are still dashed. You can play, but Levels 1 to 4 fill them in.':'Every piece of this board came from your own placements.'}; },
      progress:function(){ var p=LV.progress(5,S); return p[0]/p[1]; },
      isDone:function(){ return LV.done(5,S); },
      summary:function(){ return 'Three product questions answered by following the arrows, and four addresses landed on their blocks. Next week each block becomes a table.'; },
      reset:function(){ S.boss={done:{}}; step=0; lit=[]; },
      paint:paint
    });
    function paint(){
      var it=cur(), box=$('#l5task',api.g);
      if(!it){ box.innerHTML='<p class="kick">All answered</p>'; $('#l5board',api.g).innerHTML=aaravBoard(5,{targets:true}); return; }
      if(it.key!==itemKey){ itemKey=it.key; step=0; lit=[]; }
      var nq=D.BOSS.qs.length;
      if(it.q){
        var path=it.q.path;
        box.innerHTML='<p class="kick">Question '+(+it.key.slice(1)+1)+' of '+nq+'</p><h3 class="g-big">"'+esc(it.q.q)+'"</h3><p>'+(step?'Now follow an arrow from <b>'+esc(path[step-1])+'</b>.':'Tap the block this question starts from.')+'</p>'+
          '<div class="g-path">'+path.map(function(n,i){ return '<span class="'+(i<step?'on':'')+'">'+(i<step?esc(n):'?')+'</span>'; }).join('<i>→</i>')+'</div>';
      } else {
        box.innerHTML='<p class="kick">Address '+(+it.key.slice(1)+1)+' of '+D.BOSS.bridge.length+' · your Lecture 4 API table</p><h3 class="g-big"><code>'+esc(it.b[0])+' '+esc(it.b[1])+'</code></h3><p>Which block does this request reach?</p>';
      }
      $('#l5board',api.g).innerHTML=aaravBoard(5,{targets:true,lit:lit});
    }
    function tap(box){
      var it=cur(); if(!it) return;
      if(it.q){
        var want=it.q.path[step];
        if(box===want){
          var gn=api.right(it.key+'.'+step); lit.push(box); step++;
          if(step===it.q.path.length){ S.boss.done[it.key]=true; save(); api.dock(gn+'<b>Yes.</b> '+esc(it.q.why),'ok'); paint(); if(LV.done(5,S)) api.complete(); }
          else { paint(); api.dock(gn+'<b>Yes.</b> '+esc(box)+'. Now follow an arrow.','ok'); }
        } else { api.miss(it.key+'.'+step); api.dock('<b>Not quite.</b> '+(step?'Which block is joined to '+esc(it.q.path[step-1])+' by an arrow, and holds what the question asks for?':'Start from the block the question is about.'),'no'); }
      } else {
        if(box===it.b[2]){ var g2=api.right(it.key); S.boss.done[it.key]=true; save(); paint(); api.dock(g2+'<b>Yes.</b> '+esc(it.b[1])+' reaches a row in '+esc(box)+'.','ok'); if(LV.done(5,S)) api.complete(); }
        else { api.miss(it.key); api.dock('<b>Not quite.</b> The last noun in the address names the block.','no'); }
      }
    }
    api.g.addEventListener('click',function(e){ var b=e.target.closest('#l5board [data-box]'); if(b){ e.preventDefault(); tap(b.dataset.box); } });
    api.g.addEventListener('keydown',function(e){ var b=e.target.closest('#l5board [data-box]'); if(b&&(e.key==='Enter'||e.key===' ')){ e.preventDefault(); tap(b.dataset.box); } });
  })();

  /* ================= the builder (Level 6 and Level 7) ================= */
  function blankCol(name,type,pk){ return {id:uid('c'),name:name||'',type:type||'text',primary:!!pk,foreign:false,fkRef:'',required:true,unique:false}; }
  function blankTable(name){ return {id:uid('t'),name:name||'',columns:[blankCol('id','id',true)]}; }
  function normalize(raw,starter){
    var tables=(Array.isArray(raw)?raw:[]).map(function(t){ return {id:t.id||uid('t'),name:typeof t.name==='string'?t.name:'',columns:(Array.isArray(t.columns)?t.columns:[]).map(function(c){ return {id:c.id||uid('c'),name:c.name||'',type:D.COL_TYPES.indexOf(c.type)>-1?c.type:'text',primary:c.primary===true,foreign:c.foreign===true,fkRef:c.fkRef||'',required:c.required!==false,unique:!!c.unique}; })}; });
    if(!tables.length) tables=(starter||['']).map(blankTable);
    return tables;
  }
  function live(schema){ return schema.filter(function(t){ return t.name && t.columns.some(function(c){ return c.name; }); }); }
  function refOf(schema,ref){ return schema.find(function(t){ return t.id===ref || nameEq(t.name,ref); }); }
  function guessType(n){ return /_id$/.test(n)?'id':/(_at|date|_from|_to)$|^date/.test(n)?'date and time':/quantity|price|year|length|likes|impressions|comments|count|views/.test(n)?'number':'text'; }
  /* the Aarav model as builder tables, pointers resolved to ids */
  function aaravSchema(names){
    var s=D.AARAV_MODEL.filter(function(m){ return !names||names.indexOf(m.name)>-1; }).map(function(m){ return {id:uid('t'),name:m.name,columns:m.cols.filter(function(c){ return !c[2]||!names||names.indexOf(c[2])>-1; }).map(function(c){ return {id:uid('c'),name:c[0],type:c[1]?'id':guessType(c[0]),primary:c[1]==='pk',foreign:c[1]==='fk',fkRef:c[2]||'',required:true,unique:false}; })}; });
    var byName={}; s.forEach(function(t){ byName[t.name]=t.id; }); s.forEach(function(t){ t.columns.forEach(function(c){ if(c.foreign&&byName[c.fkRef]) c.fkRef=byName[c.fkRef]; }); });
    return s;
  }
  function makeBuilder(mount,key,starter,opts){
    opts=opts||{}; var schema=normalize(S.schemas[key],starter), picked=null; S.schemas[key]=schema;
    function persist(){ S.schemas[key]=schema; save(); }
    function draw(){
      mount.innerHTML='';
      if(opts.chips){
        var used=schema.reduce(function(a,t){ return a.concat(t.columns.map(function(c){ return c.name; })); },[]);
        var row=el('<div class="chiprow"><span class="lb">Column chips · tap one, then tap a table · a chip can go on more than one table</span>'+opts.chips.map(function(n){ var u=used.some(function(x){ return nameEq(x,n); }); return '<button type="button" class="fc'+(u?' used':'')+'" data-chip="'+esc(n)+'" aria-pressed="'+(picked===n)+'">'+esc(n)+'</button>'; }).join('')+'</div>');
        row.addEventListener('click',function(e){ var b=e.target.closest('[data-chip]'); if(!b) return; picked=picked===b.dataset.chip?null:b.dataset.chip; draw(); });
        mount.appendChild(row);
      }
      var g=el('<div class="tgrid'+(picked?' can':'')+'"></div>');
      schema.forEach(function(t,ti){ g.appendChild(drawTable(t,ti)); });
      mount.appendChild(g);
    }
    function drawTable(t,ti){
      var card=el('<div class="tbl"><div class="hd"><input type="text" value="'+esc(t.name)+'" placeholder="table_name" aria-label="Table name" spellcheck="false"><button type="button" class="x" aria-label="Remove table">×</button></div><div class="cols"></div></div>');
      var ni=$('.hd input',card); ni.addEventListener('input',function(){ t.name=ni.value; persist(); }); ni.addEventListener('change',draw);
      sure($('.hd .x',card),function(){ schema.splice(ti,1); if(!schema.length) schema.push(blankTable('')); persist(); draw(); },'?');
      var cols=$('.cols',card);
      t.columns.forEach(function(c,ci){ cols.appendChild(drawCol(t,c,ci)); });
      var add=el('<button type="button" class="add">+ column</button>'); add.addEventListener('click',function(){ t.columns.push(blankCol()); persist(); draw(); }); cols.appendChild(add);
      card.addEventListener('click',function(e){ if(!picked||e.target.closest('input,select,button,label')) return; if(!t.columns.some(function(c){ return nameEq(c.name,picked); })) t.columns.push(blankCol(picked,guessType(picked))); picked=null; persist(); draw(); });
      return card;
    }
    function drawCol(t,c,ci){
      var others=schema.filter(function(x){ return x.id!==t.id && x.name; });
      var row=el('<div class="crow"><input type="text" value="'+esc(c.name)+'" placeholder="column" aria-label="Column name" spellcheck="false"><select aria-label="Type">'+D.COL_TYPES.map(function(x){ return '<option '+(c.type===x?'selected':'')+'>'+x+'</option>'; }).join('')+'</select>'+
        '<div class="flags"><label class="k '+(c.primary?'on':'')+'" title="The row\'s id"><input type="checkbox" data-f="primary" '+(c.primary?'checked':'')+'>key</label><label class="f '+(c.foreign?'on':'')+'" title="Holds another table\'s id"><input type="checkbox" data-f="foreign" '+(c.foreign?'checked':'')+'>points to</label><label class="'+(c.required?'on':'')+'" title="Cannot be empty"><input type="checkbox" data-f="required" '+(c.required?'checked':'')+'>required</label><label class="'+(c.unique?'on':'')+'" title="No two rows share it"><input type="checkbox" data-f="unique" '+(c.unique?'checked':'')+'>unique</label><button type="button" class="x" aria-label="Remove column">×</button></div>'+
        (c.foreign?'<div class="ref">→ <select aria-label="Table it points to"><option value="">which table?</option>'+others.map(function(o){ return '<option value="'+o.id+'" '+(c.fkRef===o.id?'selected':'')+'>'+esc(o.name)+'</option>'; }).join('')+'</select></div>':'')+'</div>');
      $('input[type=text]',row).addEventListener('input',function(e){ c.name=e.target.value; persist(); });
      $('input[type=text]',row).addEventListener('change',function(){ if(opts.chips) draw(); });
      $('select',row).addEventListener('change',function(e){ c.type=e.target.value; persist(); });
      $$('.flags input',row).forEach(function(i){ i.addEventListener('change',function(){ c[i.dataset.f]=i.checked; if(i.dataset.f==='primary'&&i.checked) c.required=true; if(i.dataset.f==='foreign'&&!i.checked) c.fkRef=''; persist(); draw(); }); });
      var rs=$('.ref select',row); if(rs) rs.addEventListener('change',function(){ c.fkRef=rs.value; persist(); });
      $('.flags .x',row).addEventListener('click',function(){ t.columns.splice(ci,1); persist(); draw(); });
      return row;
    }
    draw();
    return {get:function(){ return schema; }, add:function(){ schema.push(blankTable('')); persist(); draw(); },
      reset:function(){ schema=(starter||['']).map(blankTable); persist(); draw(); },
      load:function(s){ schema=s; persist(); draw(); }};
  }

  /* ---- sheets, csv, picture ---- */
  function sample(c,n){ if(isPk(c)||c.type==='id') return n; if(isFk(c)) return 1; if(c.type==='number') return n*10; if(c.type==='yes/no') return n%2?'yes':'no'; if(c.type==='date and time') return '2026-10-1'+n+' 09:00'; return c.name+'_'+n; }
  function sheetsHTML(schema){
    var ts=live(schema); if(!ts.length) return '<p class="muted">Name a table and its columns first.</p>';
    return '<div class="sheets">'+ts.map(function(t){ var cols=t.columns.filter(function(c){return c.name}); return '<div class="sh"><div class="cap"><b>'+esc(t.name)+'</b><span>2 sample rows</span></div><table><thead><tr>'+cols.map(function(c){ return '<th>'+esc(c.name)+(isPk(c)?' · key':'')+(isFk(c)?' · →':'')+'</th>'; }).join('')+'</tr></thead><tbody>'+[1,2].map(function(n){ return '<tr>'+cols.map(function(c){ return '<td>'+esc(sample(c,n))+'</td>'; }).join('')+'</tr>'; }).join('')+'</tbody></table></div>'; }).join('')+'</div>';
  }
  function csvCell(v){ var s=String(v==null?'':v); return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; }
  function downloadCSVs(schema,out){
    var ts=live(schema); if(!ts.length){ if(out) out.innerHTML='<p class="muted">Name a table and its columns first.</p>'; return; }
    ts.forEach(function(t){
      var cols=t.columns.filter(function(c){return c.name});
      var txt=[cols.map(function(c){return csvCell(c.name)}).join(',')].concat([1,2].map(function(n){ return cols.map(function(c){ return csvCell(sample(c,n)); }).join(','); })).join('\n');
      var url=URL.createObjectURL(new Blob([txt],{type:'text/csv;charset=utf-8'})); var a=document.createElement('a'); a.href=url; a.download=(t.name.replace(/[^a-z0-9_-]+/gi,'_')||'table')+'.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(url); },800);
    });
  }
  function relsHTML(ts){
    var rels=[];
    ts.forEach(function(t){ t.columns.forEach(function(c){ if(!isFk(c)||!c.fkRef) return; var tg=refOf(ts,c.fkRef); if(!tg) return; rels.push('<div class="r"><span>'+esc(tg.name)+'</span><span class="cr">'+(c.unique?'1 ─── 1':'1 ──< many')+'</span><span>'+esc(t.name)+'</span><span class="v">via '+esc(c.name)+'</span></div>'); }); });
    return rels.length?'<div class="er"><div class="rels">'+rels.join('')+'</div></div>':'';
  }
  function pictureHTML(schema){
    var ts=schema.filter(function(t){ return t.name; }); if(!ts.length) return '<p class="er empty">Add a table to see the picture.</p>';
    var tables=ts.map(function(t,i){ return {name:t.name,i:i,cols:t.columns.filter(function(c){ return c.name; }).map(function(c){ var r=isFk(c)&&c.fkRef&&refOf(ts,c.fkRef); return {n:c.name+(c.unique&&!isPk(c)?' · unique':''),k:isPk(c)?'pk':isFk(c)?'fk':'',ref:r?r.name:''}; })}; });
    LV.grid(tables,function(t){ return [t.i%4,Math.floor(t.i/4)]; });
    return '<figure class="wbx board pic"><div class="sc">'+boardSVG(tables,arrowsFor(tables),'Your tables and the pointers between them')+'</div></figure>'+relsHTML(ts);
  }

  /* ================= Level 6 · the Arena, one brief at a time in the shell ================= */
  function chipsFor(b){
    var pool=[];
    function add(n){ if(n&&!pool.some(function(x){ return nameEq(x,n); })) pool.push(n); }
    b.rubric.entities.forEach(function(e){ e.attrs.forEach(function(a){ if(a.role!=='pk') add(a.name); }); });
    /* the classic wrong-way pointer, as a decoy: the one side pointing at its many side */
    b.rubric.relationships.forEach(function(r){ add(sing(r.fk.table)+'_id'); });
    return pool.sort();
  }
  (function(){
    var root=$('#arena'); if(!root) return;
    var api, b=null, bld=null;
    function rec(){ var a=S.arena[b.id]=S.arena[b.id]||{}; a.hints=a.hints||{}; a.missed=a.missed||{}; return a; }
    function nextBrief(){ return D.BRIEFS.find(function(x){ return !S.solved[x.id]&&x!==b&&!x.stretch; })||(!S.solved.linkedin&&b.id!=='linkedin'&&LV.done(6,S)?D.BRIEFS.find(function(x){ return x.stretch; }):null); }
    function dockBtns(){ return '<div class="g-btnrow"><button type="button" class="btn" data-check>Check my model</button><button type="button" class="btn ghost" data-pic>Picture</button><button type="button" class="btn ghost" data-sheets>Sheets</button><button type="button" class="btn ghost" data-csv>Download the sheets</button></div>'; }
    api=games[6]=shell(6,{
      layout:'side arena',
      main:'<section class="g-side" id="arBrief"></section><section class="g-stage"><div class="wtb"><button type="button" class="btn ghost small" data-add>+ table</button><button type="button" class="btn ghost small" data-load hidden>Load my board from Level 5 · 2 stars at most</button><button type="button" class="btn ghost small" data-start>Start again</button><span class="sp" id="arExp"></span></div><div id="arBuilder"></div><div id="arOut"></div></section>',
      idle:'',
      dockExtra:dockBtns,
      rec:rec,
      hud:function(){ var a=rec(); return {pts:S.solved[b.id]?LV.arenaPts(S,b.id):LV.solvePts(a),miss:(a.miss||0)+Object.keys(a.hints).length,streak:0}; },
      intro:function(){ return {h:esc(b.title),steps:['Read the brief on the left.','Tap a column chip, then tap a table to add it. Type names of your own when you need them. Tick key, points to and unique where they belong.','Check my model. The first check says what is wrong; from the second on, it also says where.'],tip:'This brief drills: '+esc(b.move)+'.',rules:'50 points for a model that passes · −10 per failed check or opened hint, never below 20 · stars by misses'}; },
      progress:function(){ var p=LV.progress(6,S); return p[0]/p[1]; },
      isDone:function(){ return !!S.solved[b.id]; },
      stars:function(){ return LV.arenaStars(S,b.id); },
      winKick:function(){ return (b.stretch?'Stretch':'Brief '+b.order)+' passed'; },
      winPts:function(){ return LV.arenaPts(S,b.id); },
      summary:function(){ return 'Every structural check is a tick.'+(rec().loaded?' You loaded your board, so 2 stars at most.':'')+' Arena: '+LV.progress(6,S)[0]+' of 6 briefs done.'; },
      next:function(){ var nb=nextBrief(); return nb?{label:'Next brief: '+esc(nb.title)+' →',go:function(){ openBrief(nb); }}:{label:'Next: Level 7 →',go:function(){ api.close(true); goSec('s7'); }}; },
      reset:function(){ S.arena[b.id]={}; delete S.solved[b.id]; S.schemas['arena.'+b.id]=null; },
      paint:paint
    });
    function paint(){
      var a=rec();
      $('#arBrief',api.g).innerHTML='<p class="kick">'+(b.stretch?'Stretch':'Brief '+b.order)+' · '+esc(b.move)+'</p><h3>'+esc(b.title)+'</h3><p class="story">'+esc(b.story)+'</p><ul>'+b.reqs.map(function(r){return '<li>'+esc(r)+'</li>'}).join('')+'</ul>'+
        '<p class="g-lab">Hints · each one costs a star</p>'+b.hints.map(function(h,i){ return '<details class="hint" data-h="'+i+'"'+(a.hints[i]?' open':'')+'><summary>'+(i+1)+(a.hints[i]?'':' · costs a star')+'</summary><div class="b">'+esc(h)+'</div></details>'; }).join('');
      $$('#arBrief details',api.g).forEach(function(d){ d.addEventListener('toggle',function(){ if(d.open&&!a.hints[d.dataset.h]){ a.hints[d.dataset.h]=1; save(); api.hud(); $('summary',d).textContent=(+d.dataset.h+1)+''; } }); });
      $('#arExp',api.g).textContent=b.rubric.entities.length+' tables expected';
      $('[data-load]',api.g).hidden=b.id!=='aarav';
      bld=makeBuilder($('#arBuilder',api.g),'arena.'+b.id,b.starter,{chips:chipsFor(b)});
      $('#arOut',api.g).innerHTML='';
    }
    function openBrief(x){ b=x; S.arenaEx=x.id; store.set(K,S); $('.g-title',api.g).textContent=x.title; api.open(); }
    api.g.addEventListener('click',function(e){
      var t=e.target, out=$('#arOut',api.g);
      if(t.closest('[data-add]')) bld.add();
      else if(t.closest('[data-pic]')){ out.innerHTML=pictureHTML(bld.get()); out.scrollIntoView({block:'nearest'}); }
      else if(t.closest('[data-sheets]')){ out.innerHTML=sheetsHTML(bld.get()); out.scrollIntoView({block:'nearest'}); }
      else if(t.closest('[data-csv]')) downloadCSVs(bld.get(),out);
      else if(t.closest('[data-check]')){
        var a=rec(), r=C.check(bld.get(),b,{reveal:(a.checks||0)>=1}); a.checks=(a.checks||0)+1;
        out.innerHTML='<ul class="checks">'+r.checks.map(function(c){ return '<li class="'+(c.ok?'ok':'')+'">'+c.html+'</li>'; }).join('')+r.suggestions.map(function(s){ return '<li class="sug">'+s+'</li>'; }).join('')+'</ul>'+pictureHTML(bld.get());
        if(r.done){ S.solved[b.id]=true; a.pts=LV.solvePts(a); save(); api.hud(); api.dock('<b>Yes.</b> Every structural check is a tick.','ok'); setTimeout(api.finish,600); }
        else { a.miss=(a.miss||0)+1; save(); api.hud(); api.dock('<b>Not quite.</b> Fix the crosses, then check again.'+(a.checks===1?' The next check also says where.':''),'no'); }
        out.scrollIntoView({block:'start',behavior:reduced()?'auto':'smooth'});
      }
    });
    sure($('[data-start]',api.g),function(){ bld.reset(); $('#arOut',api.g).innerHTML=''; },'Back to the starter tables? Tap again');
    sure($('[data-load]',api.g),function(){ bld.load(aaravSchema(['users','conversations','messages','workflows','diagnoses'])); rec().loaded=1; save(); api.hud(); },'Loading caps this brief at 2 stars. Tap again');
    function list(){
      var c=ck(), n=LV.progress(6,S,c)[0];
      $('#arenaCount').textContent=n+' / 6 done';
      root.innerHTML='<div class="briefs">'+D.BRIEFS.map(function(x){ var s=LV.arenaStars(S,x.id); return '<button type="button" class="brief '+(S.solved[x.id]?'done':'')+(x.stretch?' stretch':'')+'" data-brief="'+x.id+'"><span class="n">'+(x.stretch?'stretch':'brief '+x.order)+'</span><b>'+esc(x.title)+'</b><small>'+esc(x.blurb)+'</small><span class="row"><span class="mv">'+esc(x.move)+'</span>'+(S.solved[x.id]?starStr(s):'')+'</span></button>'; }).join('')+'</div>';
    }
    root.addEventListener('click',function(e){ var x=e.target.closest('[data-brief]'); if(x) openBrief(D.BRIEFS.find(function(y){ return y.id===x.dataset.brief; })); });
    redraws.push(list); list();
  })();

  /* ================= Level 7 · your model ================= */
  (function(){
    var root=$('#bp'); if(!root) return;
    $$('[data-bp]',root).forEach(function(f){ f.value=S.bp[f.dataset.bp]||''; f.addEventListener('input',function(){ S.bp[f.dataset.bp]=f.value; store.set(K,S); drawMap(); drawFinish(); }); });
    var bld=makeBuilder($('#bpBuilder',root),'myapp',['users']), out=$('#bpOut',root);
    $('#bpAdd',root).addEventListener('click',bld.add);
    sure($('#bpReset',root),function(){ bld.reset(); out.innerHTML=''; },'Clear your tables? Tap again');
    sure($('#bpAarav',root),function(){ bld.load(aaravSchema()); out.innerHTML=''; },'Replace your tables? Tap again');
    $('#bpEr',root).addEventListener('click',function(){ out.innerHTML=pictureHTML(bld.get()); out.scrollIntoView({behavior:'smooth',block:'start'}); });
    $('#bpSheets',root).addEventListener('click',function(){ out.innerHTML=sheetsHTML(bld.get()); });
    $('#bpCsv',root).addEventListener('click',function(){ downloadCSVs(bld.get(),out); });
    function blueprint(){
      var s=bld.get();
      return 'My blueprint\n\nWhat the app does: '+(S.bp.desc||'')+'\n\nThree questions the data must answer:\n1. '+(S.bp.q1||'')+'\n2. '+(S.bp.q2||'')+'\n3. '+(S.bp.q3||'')+'\n\nTables:\n'+live(s).map(function(tb){ return '- '+tb.name+': '+tb.columns.filter(function(c){return c.name}).map(function(c){ var r=isFk(c)&&refOf(s,c.fkRef); return c.name+(isPk(c)?' (key)':'')+(r?' (→ '+r.name+')':'')+(c.unique&&!isPk(c)?' (unique)':''); }).join(', '); }).join('\n')+'\n\nFiles my app stores, and the column with the link: '+(S.bp.files||'')+'\n\nMy Lecture 4 API table, with a table beside each address:\n'+(S.bp.api||'');
    }
    $('#bpCopy',root).addEventListener('click',function(){ window.c8copy(this,blueprint()); });
    document.addEventListener('click',function(e){ var b=e.target.closest('[data-copybp]'); if(b) window.c8copy(b,blueprint()); });
  })();
  function drawFinish(){
    var f=$('#finish'); if(!f) return;
    var c=ck(), y=LV.yoursParts(S,c), nx=LV.next(S,c), st=0, pts=0;
    LV.LEVELS.forEach(function(L){ st+=LV.levelStars(L.n,S,c); pts+=LV.levelPts(L.n,S,c); });
    var todo=[['written','What your app does and its three questions'],['tables','At least two tables with columns'],['bridge','Files and the bridge written'],['checks','All five checks above ticked']];
    f.innerHTML=nx?'<div class="fin"><p class="kick">To finish Level 7</p><ul class="todo">'+todo.map(function(t){ return '<li class="'+(y[t[0]]?'ok':'')+'">'+t[1]+'</li>'; }).join('')+'</ul>'+(nx<7?'<p class="muted">Then the run ends. Level '+nx+' is still open: <a href="#'+LV.LEVELS[nx-1].sec+'">play it</a>.</p>':'')+'</div>':
      '<div class="fin win"><p class="kick">Run complete</p><p class="g-stars">'+starStr(Math.round(st/7))+'</p><h3>'+st+' / 21 stars · '+pts+' points</h3><p>Seven levels, from Aarav\'s chat to your own tables. Copy your blueprint, put the tables in your HLD\'s storage box, and submit.</p><div class="g-btns"><button type="button" class="btn" data-copybp>Copy my blueprint as text</button><a class="btn ghost" href="/c8/module-2/lecture-06-databases-and-domain-modelling/practice-set#s03">What to submit</a></div></div>';
  }

  /* ================= the page: briefings, boards and the map, redrawn after every change ================= */
  function drawPage(){
    drawMap(); drawCards(); drawFinish();
    var b2=$('#board2'); if(b2) b2.innerHTML=aaravBoard(2);
    var b4=$('#board4'); if(b4) b4.innerHTML=board4();
    var m5=$('#er5');
    if(m5){
      var mp=missingPieces();
      m5.innerHTML=boardSVG(LV.aaravTables(5,S),arrowsFor(LV.aaravTables(5,S)),'Aarav\'s whole model: eight blocks and the pointers between them.');
      var st=$('#er5State'); if(st) st.innerHTML=mp[0]?'<div class="done not">'+mp[0]+' of '+mp[1]+' pieces still to place. Dashed pieces link back to the level that places them.</div>':'<div class="done">Every block, line and arrow here came from your own placements in Levels 1 to 4.</div>';
    }
  }
  redraws.push(drawPage); drawPage();
  document.addEventListener('c8:ck',function(){ drawMap(); drawCards(); drawFinish(); });

  /* ================= reset the whole lab ================= */
  sure($('#labReset'),function(){ try{ localStorage.removeItem(K); localStorage.removeItem(CKK); }catch(e){} location.reload(); },'Wipe every level on this device? Tap again');
});
