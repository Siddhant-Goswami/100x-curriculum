/* C8 kit: the drawn pieces the curriculum home and the whiteboards share, as one script any page can load.
   Load after docs.js. Everything hangs off window.C8Kit:
     rng(seed)                          seeded random, same numbers every load (mulberry32, as on the map)
     blob(cx,cy,rx,ry,seed,amp)         a coastline: 64 points round an ellipse, wobbled by three seeded sines
     smooth(points)                     closed Catmull-Rom path through the points, as the map draws its land
     terrain(g,{cx,cy,rx,ry,seed,c,soft,name,sub,q,ly})  a territory as on the map: coast, four contour rings, a label at y=ly
     pack(items,{cx,cy,rx,ry})          lays boxes {w,h} inside an ellipse without overlap; same input, same layout
     wbDefs()                           the whiteboard's wobble filter and arrowheads, added to the page once
     scrolly(steps,onStep)              calls onStep(n) when a [data-step] element crosses the middle of the screen; returns the observer
     combo(input,list,search,onPick)    an accessible combobox: type, arrow keys, Enter, Escape
     esc(s)                             HTML-escape
   Styles live in kit.css. */
(function(){
  var NS='http://www.w3.org/2000/svg';
  function rng(seed){var a=seed>>>0;return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
  function el(tag,attrs,parent){var e=document.createElementNS(NS,tag);for(var k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e}

  function blob(cx,cy,rx,ry,seed,amp){
    var r=rng(seed||1),p1=r()*6,p2=r()*6,p3=r()*6,out=[];amp=amp==null?.07:amp;
    for(var i=0;i<64;i++){var a=i/64*Math.PI*2,f=1+amp*(.55*Math.sin(3*a+p1)+.3*Math.sin(5*a+p2)+.15*Math.sin(9*a+p3));out.push([cx+Math.cos(a)*rx*f,cy+Math.sin(a)*ry*f])}
    return out;
  }
  function smooth(p){
    var n=p.length,d='M'+p[0][0].toFixed(1)+' '+p[0][1].toFixed(1);
    for(var i=0;i<n;i++){var p0=p[(i-1+n)%n],a=p[i],b=p[(i+1)%n],p3=p[(i+2)%n];
      d+='C'+(a[0]+(b[0]-p0[0])/6).toFixed(1)+' '+(a[1]+(b[1]-p0[1])/6).toFixed(1)+' '+(b[0]-(p3[0]-a[0])/6).toFixed(1)+' '+(b[1]-(p3[1]-a[1])/6).toFixed(1)+' '+b[0].toFixed(1)+' '+b[1].toFixed(1)}
    return d+'Z';
  }
  function terrain(g,o){
    var t=el('g',{'class':'terr'+(o.cls?' '+o.cls:''),style:'--c:'+o.c+';--soft:'+o.soft},g),hull=blob(o.cx,o.cy,o.rx,o.ry,o.seed,o.amp);
    el('path',{'class':'coast',d:smooth(hull)},t);
    [.84,.68,.52,.36].forEach(function(f){el('path',{'class':'contour',d:smooth(hull.map(function(p){return[o.cx+(p[0]-o.cx)*f,o.cy+(p[1]-o.cy)*f]}))},t)});
    if(o.name){var y=o.ly!=null?o.ly:o.cy-o.ry-(o.q?58:40),tx=el('text',{'class':'tl-n',x:o.cx,y:y},t);tx.textContent=o.name;
      if(o.sub){var s=el('text',{'class':'tl-s',x:o.cx,y:y+22},t);s.textContent=o.sub}
      if(o.q){var q=el('text',{'class':'tl-q',x:o.cx,y:y+40},t);q.textContent=o.q}}
    return t;
  }
  /* boxes start on a sunflower spiral, biggest at the centre, then push apart and stay inside the ellipse */
  function pack(items,E){
    var n=items.length,ga=Math.PI*(3-Math.sqrt(5)),pts=items.map(function(it,i){var r=Math.sqrt((i+.5)/n)*.8,a=i*ga;return{x:E.cx+Math.cos(a)*r*E.rx,y:E.cy+Math.sin(a)*r*E.ry,w:it.w,h:it.h,oy:it.oy||0}});
    for(var k=0;k<240;k++){
      for(var i=0;i<n;i++)for(var j=i+1;j<n;j++){var A=pts[i],B=pts[j],dx=B.x-A.x,dy=(B.y+B.oy)-(A.y+A.oy),ox=(A.w+B.w)/2-Math.abs(dx),oy=(A.h+B.h)/2-Math.abs(dy);
        if(ox>0&&oy>0){if(ox<oy){var s=(dx<0?-1:1)*ox/2;A.x-=s;B.x+=s}else{var t=(dy<0?-1:1)*oy/2;A.y-=t;B.y+=t}}}
      pts.forEach(function(p){var ax=Math.max(8,E.rx-p.w/2),ay=Math.max(8,E.ry-p.h/2),ux=(p.x-E.cx)/ax,uy=(p.y+p.oy-E.cy)/ay,d=Math.sqrt(ux*ux+uy*uy);if(d>1){p.x=E.cx+ux/d*ax;p.y=E.cy+uy/d*ay-p.oy}});
    }
    return pts.map(function(p){return{x:p.x,y:p.y}});
  }
  function wbDefs(){
    if(document.getElementById('wob'))return;
    var s=document.createElement('div');
    s.innerHTML='<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>'+
      '<filter id="wob"><feTurbulence type="fractalNoise" baseFrequency=".02" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="2.6"/></filter>'+
      [['ah','--ink2'],['ahc','--coral'],['ahg','--hum'],['ahv','--prob'],['aha','--det']].map(function(m){return '<marker id="'+m[0]+'" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1 L9 5 L1 9" fill="none" style="stroke:var('+m[1]+')" stroke-width="1.6" stroke-linecap="round"/></marker>'}).join('')+
      '</defs></svg>';
    document.body.insertBefore(s.firstChild,document.body.firstChild);
  }
  function scrolly(steps,onStep){
    if(!('IntersectionObserver' in window)){onStep(+steps[steps.length-1].getAttribute('data-step'));return null}
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)onStep(+e.target.getAttribute('data-step'))})},{rootMargin:'-50% 0px -50% 0px'});
    steps.forEach(function(s){io.observe(s)});
    return io;
  }
  function combo(input,list,search,onPick){
    var items=[],act=-1;
    input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');input.setAttribute('aria-controls',list.id);
    list.setAttribute('role','listbox');
    function close(){list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');act=-1}
    function mark(i){act=i;[].forEach.call(list.children,function(li,k){li.setAttribute('aria-selected',k===i?'true':'false')});
      if(i>=0){input.setAttribute('aria-activedescendant',list.id+'-'+i);list.children[i].scrollIntoView({block:'nearest'})}}
    function render(){items=search(input.value);
      if(!items.length){close();return}
      list.innerHTML=items.map(function(it,i){return '<li id="'+list.id+'-'+i+'" role="option" aria-selected="false" data-i="'+i+'">'+it.html+'</li>'}).join('');
      list.hidden=false;input.setAttribute('aria-expanded','true');mark(0)}
    function pick(i){var it=items[i];if(!it)return;close();onPick(it)}
    input.addEventListener('input',render);
    input.addEventListener('focus',function(){if(input.value.trim())render()});
    input.addEventListener('keydown',function(e){
      if(e.key==='ArrowDown'){e.preventDefault();if(list.hidden)render();else mark(Math.min(items.length-1,act+1))}
      else if(e.key==='ArrowUp'){e.preventDefault();mark(Math.max(0,act-1))}
      else if(e.key==='Enter'){if(!list.hidden&&act>=0){e.preventDefault();pick(act)}}
      else if(e.key==='Escape'){close()}});
    list.addEventListener('mousedown',function(e){e.preventDefault()});
    list.addEventListener('click',function(e){var li=e.target.closest('li[data-i]');if(li)pick(+li.dataset.i)});
    input.addEventListener('blur',function(){setTimeout(close,120)});
    return{close:close,render:render};
  }
  window.C8Kit={rng:rng,blob:blob,smooth:smooth,terrain:terrain,pack:pack,wbDefs:wbDefs,scrolly:scrolly,combo:combo,esc:esc,svg:el};
})();
