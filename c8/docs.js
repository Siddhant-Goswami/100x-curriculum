/* Shared behaviour for the C8 code-track doc pages */
(function(){
  var $=function(s,r){return (r||document).querySelector(s)}, $$=function(s,r){return [].slice.call((r||document).querySelectorAll(s))};
  var store={get:function(k,d){try{var v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set:function(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
  window.c8store=store;

  /* ---- theme ---- */
  var root=document.documentElement;
  var th=store.get('c8.theme',null); if(th) root.setAttribute('data-theme',th);
  function themeIcon(){var dark=root.getAttribute('data-theme')==='dark'||(!root.getAttribute('data-theme')&&matchMedia('(prefers-color-scheme:dark)').matches);var b=$('#theme');if(b)b.innerHTML=dark?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>'}
  /* ---- OS ---- */
  var os=store.get('c8.os',null)||(/Mac|iPhone|iPad/.test(navigator.platform)?'mac':'win'); root.setAttribute('data-os',os);
  /* ---- track ---- */
  root.setAttribute('data-track',store.get('c8.track','all'));

  document.addEventListener('DOMContentLoaded',function(){
    /* nav current */
    var norm=function(p){return p.replace(/\.html$/,'').replace(/\/index$/,'/').split('/').pop()};var here=norm(location.pathname);
    $$('.top nav a').forEach(function(a){if(norm(a.getAttribute('href'))===here)a.setAttribute('aria-current','page')});

    /* theme button */
    var tb=$('#theme'); themeIcon();
    if(tb) tb.addEventListener('click',function(){var dark=root.getAttribute('data-theme')==='dark'||(!root.getAttribute('data-theme')&&matchMedia('(prefers-color-scheme:dark)').matches);var n=dark?'light':'dark';root.setAttribute('data-theme',n);store.set('c8.theme',n);themeIcon()});

    /* progress */
    var pg=$('#prog');
    function prog(){if(!pg)return;var h=document.documentElement;var p=h.scrollTop/(h.scrollHeight-h.clientHeight||1);pg.style.width=(p*100)+'%'}
    addEventListener('scroll',prog,{passive:true}); prog();

    /* TOC build + scroll spy */
    var secs=$$('section.s[id]');
    var toc=$('#toc'), mt=$('#mtoc');
    if(secs.length){
      var html=secs.map(function(s){var h=$('h2',s);var n=$('.n',h);var hc=h?h.cloneNode(true):null;if(hc){[].slice.call(hc.querySelectorAll('.n,.pill')).forEach(function(x){x.remove()})}var t=hc?hc.textContent.trim():s.id;return '<a href="#'+s.id+'">'+(n?'<span class="n">'+n.textContent+'</span>':'')+t+'</a>'}).join('');
      if(toc) toc.insertAdjacentHTML('beforeend',html);
      if(mt) mt.innerHTML=html;
      var links=$$('#toc a');
      var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){links.forEach(function(l){l.classList.toggle('on',l.getAttribute('href')==='#'+e.target.id)})}})},{rootMargin:'-20% 0px -70% 0px',threshold:0});
      secs.forEach(function(s){io.observe(s)});
    }

    /* OS switches */
    $$('.seg[data-seg="os"] button').forEach(function(b){
      b.setAttribute('aria-pressed',b.dataset.v===os?'true':'false');
      b.addEventListener('click',function(){os=b.dataset.v;root.setAttribute('data-os',os);store.set('c8.os',os);$$('.seg[data-seg="os"] button').forEach(function(x){x.setAttribute('aria-pressed',x.dataset.v===os?'true':'false')})});
    });

    /* copy buttons */
    function copy(btn,text){navigator.clipboard&&navigator.clipboard.writeText(text).then(function(){var o=btn.textContent;btn.textContent='Copied';btn.classList.add('ok');setTimeout(function(){btn.textContent=o;btn.classList.remove('ok')},1400)})}
    document.addEventListener('click',function(e){var b=e.target.closest('.cp');if(!b)return;var k=b.closest('.code');if(k){copy(b,$$('.ln code',k).map(function(x){return x.textContent}).join('\n'));return}var c=b.closest('.cmd');if(c)copy(b,$('span',c).textContent.trim())});
    window.c8copy=copy;

    /* checklists with persistence */
    var key='c8.ck.'+(document.body.dataset.page||here);
    var saved=store.get(key,{});
    var boxes=$$('.ck input[type=checkbox]');
    function paint(){
      var total=0,done=0,byStage={};
      boxes.forEach(function(b){var li=b.closest('li');li.classList.toggle('done',b.checked);total++;if(b.checked)done++;var st=b.closest('[data-stage]');if(st){var k=st.dataset.stage;byStage[k]=byStage[k]||{t:0,d:0};byStage[k].t++;if(b.checked)byStage[k].d++}});
      Object.keys(byStage).forEach(function(k){var st=$('[data-stage="'+k+'"]');var bar=$('.stg .bar i',st),num=$('.stg .num',st);if(bar)bar.style.width=(byStage[k].d/byStage[k].t*100)+'%';if(num)num.textContent=byStage[k].d+' / '+byStage[k].t;var sc=$('.score[data-for="'+k+'"]');if(sc){var fg=$('.fg',sc);fg.style.strokeDashoffset=126-126*(byStage[k].d/byStage[k].t);$('b',$('.ring',sc)).textContent=byStage[k].d+'/'+byStage[k].t}});
      var all=$('.score[data-for="all"]');if(all){$('.fg',all).style.strokeDashoffset=126-126*(total?done/total:0);$('b',$('.ring',all)).textContent=done+'/'+total}
      document.dispatchEvent(new CustomEvent('c8:ck',{detail:{total:total,done:done}}));
    }
    boxes.forEach(function(b,i){var id=b.id||('ck'+i);b.checked=!!saved[id];b.addEventListener('change',function(){saved[id]=b.checked;store.set(key,saved);paint()})});
    if(boxes.length) paint();
    $$('.reset').forEach(function(r){r.addEventListener('click',function(){if(!confirm('Clear every tick on this page?'))return;saved={};store.set(key,saved);boxes.forEach(function(b){b.checked=false});paint()})});

    /* track picker */
    $$('.trkpick button[data-v]:not(.reset)').forEach(function(b){
      var cur=root.getAttribute('data-track');b.setAttribute('aria-pressed',b.dataset.v===cur?'true':'false');
      b.addEventListener('click',function(){var v=b.dataset.v;root.setAttribute('data-track',v);store.set('c8.track',v);$$('.trkpick button[data-v]:not(.reset)').forEach(function(x){x.setAttribute('aria-pressed',x.dataset.v===v?'true':'false')})});
    });

    /* accordion search */
    var sr=$('#errsearch');
    if(sr) sr.addEventListener('input',function(){var q=sr.value.toLowerCase();$$('details.acc[data-q]').forEach(function(d){var hit=!q||d.dataset.q.toLowerCase().indexOf(q)>-1;d.style.display=hit?'':'none';if(q&&hit)d.open=true})});

    /* vote bars animate on view */
    var v=$('.vote');
    if(v){new IntersectionObserver(function(es,o){es.forEach(function(e){if(e.isIntersecting){$$('.bar i',v).forEach(function(i){i.style.width=i.dataset.w+'%'});o.disconnect()}})},{threshold:.3}).observe(v)}

  });

  /* code block helper: render(lines, tags) -> HTML */
  window.c8code=function(opts){
    var lines=opts.code.replace(/\n$/,'').split('\n'), tags=opts.tags||{};
    var esc=function(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')};
    var hi=function(s){var e=esc(s);
      // strings first
      var parts=[];var re=/("""[\s\S]*?"""|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;var last=0,m;
      while((m=re.exec(e))){parts.push(kw(e.slice(last,m.index)));parts.push('<span class="s">'+m[0]+'</span>');last=re.lastIndex}
      parts.push(kw(e.slice(last)));return parts.join('');
      function kw(t){return t.replace(/\b(import|as|def|return|if|in|from)\b/g,'<span class="k">$1</span>').replace(/\b(gr\.\w+|print|int|os\.environ\.get|launch|lower)\b/g,'<span class="f">$1</span>').replace(/(#.*)$/,'<span class="c">$1</span>')}};
    var body=lines.map(function(l,i){var t=tags[i];return '<div class="ln'+(t?' tag':'')+'"'+(t?' style="--l:'+t[1]+'"':'')+'><code>'+(hi(l)||' ')+'</code>'+(t?'<em>'+esc(t[0])+'</em>':'')+'</div>'}).join('');
    return '<div class="code"'+(opts.id?' id="'+opts.id+'"':'')+'><div class="hd"><span>'+esc(opts.title||'app.py')+'</span><button class="cp" type="button">Copy</button></div><pre>'+body+'</pre></div>';
  };
})();
