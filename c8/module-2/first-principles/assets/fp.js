/* From sand to language models: every idea is a small hand-drawn scene you play.
   A scene is <figure class="fp" id="f1-gate" data-fp="gate" data-part="a gate"><figcaption>the goal</figcaption></figure>
   followed by <div class="found">what the scene showed</div>, which stays shut until the goal is met (or "Show me").
   Progress saves on this device under c8.fp. The pages are generated: edit _plan/first-principles/build.py. */
(function(){
'use strict';

var store=window.c8store||{get:function(k,d){return d},set:function(){}};
var KEY='c8.fp',ST=store.get(KEY,{})||{};

/* ---------- helpers ---------- */
function h(tag,cls,html){var e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function num(n){return Math.round(n).toLocaleString('en-US')}
function btn(label,cls,fn){var b=h('button','fpb'+(cls?' '+cls:''),label);b.type='button';b.addEventListener('click',fn);return b}
function seg(labels,cur,fn){var s=h('div','seg');labels.forEach(function(l,i){var b=h('button',null,l);b.type='button';b.setAttribute('aria-pressed',i===cur?'true':'false');b.addEventListener('click',function(){[].forEach.call(s.children,function(x,j){x.setAttribute('aria-pressed',j===i?'true':'false')});fn(i)});s.appendChild(b)});return s}
function range(min,max,val,step,label,fn){var w=h('label','fp-range'),t=h('span',null,label),i=h('input');i.type='range';i.min=min;i.max=max;i.step=step;i.value=val;i.addEventListener('input',function(){fn(+i.value)});w.appendChild(t);w.appendChild(i);w.input=i;return w}
function bars(list){return '<div class="fp-bars">'+list.map(function(x){return '<div class="'+(x.on?'on':'')+'"><span>'+esc(x.t)+'</span><i><em style="width:'+Math.max(1,Math.min(100,x.v*100)).toFixed(1)+'%"></em></i><b>'+(x.label||Math.round(x.v*100)+'%')+'</b></div>'}).join('')+'</div>'}
function shuf(a){var b=a.slice(),i,j,t,same=true;for(var k=0;k<6&&same;k++){for(i=b.length-1;i>0;i--){j=Math.floor(Math.random()*(i+1));t=b[i];b[i]=b[j];b[j]=t}same=b.length>1&&b.every(function(x,n){return x===a[n]})}return b}
function nope(el){el.classList.add('no');setTimeout(function(){el.classList.remove('no')},420)}

/* hand-drawn SVG: shapes go in a wobbly group, words and tap targets on top */
function R(x,y,w,ht,c,rx){return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+ht+'" rx="'+(rx==null?6:rx)+'" class="'+(c||'')+'"/>'}
function P(d,c){return '<path d="'+d+'" class="'+(c||'')+'"/>'}
function C(x,y,r,c){return '<circle cx="'+x+'" cy="'+y+'" r="'+r+'" class="'+(c||'')+'"/>'}
function T(x,y,s,c){return '<text x="'+x+'" y="'+y+'" class="'+(c||'s')+'">'+esc(s)+'</text>'}
/* HIT = a piece you press: drawn as a raised key (a shadow under the shape, see draw()).
   HITA = an area you click anywhere inside, to place a guess: drawn as a dashed frame. */
function HIT(x,y,w,ht,k,label){return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+ht+'" rx="8" class="hit" data-k="'+k+'" tabindex="0" role="button" aria-label="'+esc(label)+'"/>'}
function HITA(x,y,w,ht,k,label){return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+ht+'" rx="8" class="hit area" data-k="'+k+'" tabindex="0" role="button" aria-label="'+esc(label)+'"/>'}
function draw(el,w,ht,shapes,texts,label,plain){
  var f=document.activeElement&&el.contains(document.activeElement)?document.activeElement.getAttribute('data-k'):null,caps='',rs=[];
  texts.replace(/<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)" rx="8" class="hit" data-k="([^"]*)"/g,function(m,x,y,cw,ch,k){caps+='<rect x="'+x+'" y="'+(+y+6)+'" width="'+cw+'" height="'+ch+'" rx="9" class="cap"/>';rs.push({x:+x,y:+y,w:+cw,h:+ch,k:k});return m});
  el.innerHTML='<svg class="wb" viewBox="0 0 '+w+' '+ht+'" role="group" aria-label="'+esc(label||'')+'"><g class="ln"'+(plain?'':' filter="url(#fpwob)"')+'>'+caps+shapes+'</g><g class="tx">'+pads(rs)+texts+'</g></svg>';
  if(f!=null){var n=el.querySelector('.hit[data-k="'+f+'"]');if(n)n.focus()}
}
/* a drawing shrinks to about half size on a phone, so each pressable piece gets an invisible margin that also takes the click:
   up to 14 units a side, never more than half the gap to its neighbour, and drawn under every piece so a piece always wins over a margin */
function pads(rs){var E=14;return rs.map(function(r){var l=E,rt=E,t=E,b=E;
  rs.forEach(function(o){if(o===r)return;var vy=o.y<r.y+r.h&&o.y+o.h>r.y,vx=o.x<r.x+r.w&&o.x+o.w>r.x;
    if(vy&&o.x+o.w<=r.x)l=Math.min(l,(r.x-o.x-o.w)/2);if(vy&&o.x>=r.x+r.w)rt=Math.min(rt,(o.x-r.x-r.w)/2);
    if(vx&&o.y+o.h<=r.y)t=Math.min(t,(r.y-o.y-o.h)/2);if(vx&&o.y>=r.y+r.h)b=Math.min(b,(o.y-r.y-r.h)/2)});
  return '<rect x="'+(r.x-l)+'" y="'+(r.y-t)+'" width="'+(r.w+l+rt)+'" height="'+(r.h+t+b)+'" class="pad" data-k="'+r.k+'" aria-hidden="true"/>'}).join('')}
function tap(el,fn){
  el.addEventListener('click',function(e){var t=e.target.closest('[data-k]');if(t)fn(t.getAttribute('data-k'),t,e)});
  el.addEventListener('keydown',function(e){if(e.key!=='Enter'&&e.key!==' ')return;var t=e.target.closest('[data-k]');if(t){e.preventDefault();fn(t.getAttribute('data-k'),t,e)}});
}
function defs(){
  if(document.getElementById('fpwob'))return;
  var d=h('div');d.innerHTML='<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs><filter id="fpwob" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".02" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="2.4"/></filter><marker id="fpah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1 L9 5 L1 9" fill="none" stroke="#8A8A8A" stroke-width="1.8" stroke-linecap="round"/></marker><marker id="fpav" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1 L9 5 L1 9" fill="none" stroke="#6E4BE8" stroke-width="1.8" stroke-linecap="round"/></marker></defs></svg>';
  document.body.appendChild(d.firstChild);
}

var W={},PIC={};

/* ================= 1. Sand to screen ================= */
W.gate=function(s){
  var on=[0,0,0,0],t=[];
  function paint(){
    var sh=R(18,52,104,56,on[0]?'f-det':'f-card',10),tx=T(70,87,on[0]?'power on':'power off','s')+HIT(18,52,104,56,'v','Put power on the first gate');
    [0,1,2].forEach(function(i){var x=166+i*118;sh+=P('M'+(x-40)+' 80H'+(x-6),'arw'+(on[i]?' c-det':''))+R(x,50,78,60,on[i+1]?'f-det':'f-card');tx+=T(x+39,77,'gate '+(i+1),'s')+T(x+39,99,on[i+1]?'open':'shut','xs')});
    sh+=P('M484 80H514','arw'+(on[3]?' c-det':''))+C(550,80,24,on[3]?'f-det':'f-card')+(on[3]?P('M550 46V36M574 56l8-7M584 80h10M526 56l-8-7M574 104l8 7M526 104l-8 7','c-det'):'');
    tx+=T(550,138,on[3]?'lit':'lamp','xs');
    draw(s.stage,600,156,sh,tx,'A power switch, three gates in a chain, and a lamp');
  }
  /* a click while the chain is still flipping is ignored, so a double-click does not switch the power straight back off */
  var busy=false;
  tap(s.stage,function(){if(busy)return;busy=true;t.forEach(clearTimeout);t=[];var v=on[0]^1;on[0]=v;paint();
    [1,2,3].forEach(function(i){t.push(setTimeout(function(){on[i]=v;paint();if(i===3){busy=false;if(v){s.say('You touched one gate. Its output opened the next, and the next.','ok');s.win()}}},i*260))})});
  paint();s.say('Click the raised <b>power off</b> box.');
};
W.byte=function(s){
  var vals=[128,64,32,16,8,4,2,1],bits=[0,0,0,0,0,0,0,0],goals=[5,65],g=0;
  function n(){return bits.reduce(function(a,b,i){return a+b*vals[i]},0)}
  function paint(){var sh='',tx='',v=n(),parts=vals.filter(function(x,i){return bits[i]});
    vals.forEach(function(x,i){var X=22+i*70;sh+=R(X,22,60,84,bits[i]?'f-det':'f-card',10);tx+=T(X+30,46,x,'xs')+T(X+30,90,bits[i],'h')+HIT(X,22,60,84,i,'Switch worth '+x)});
    tx+=T(300,150,(parts.length>1?parts.join(' + ')+' = ':'')+v,'h')+(v>=33&&v<=126?T(300,182,'by agreement, the letter '+String.fromCharCode(v),'s c-det'):'');
    draw(s.stage,600,194,sh,tx,'Eight switches worth 128 down to 1');}
  tap(s.stage,function(k){bits[k]^=1;paint();if(g<goals.length&&n()===goals[g]){g++;if(g<goals.length)s.say('That is '+goals[g-1]+'. Now make <b>'+goals[g]+'</b>.','ok');else{s.say('65. By agreement, that pattern is the letter A.','ok');s.win()}}});
  paint();s.say('Click the switches to make <b>5</b>.');
};
W.carry=function(s){
  var a=0,b=0,seen={'00':1};
  function sw(x,on){return P(on?'M'+x+' 70H'+(x+60):'M'+x+' 70l52 -28',on?'c-det':'')+C(x,70,4,'dot')+C(x+60,70,4,'dot')}
  function paint(){var on=a&&b,sh='',tx='';
    sh+=R(82,30,76,86,a?'f-det':'f-card',10)+R(192,30,76,86,b?'f-det':'f-card',10)+P('M24 70H90','c-det')+sw(90,a)+P('M150 70H200',a?'c-det':'')+sw(200,b)+P('M260 70H316',on?'c-det':'')+C(342,70,24,on?'f-det':'f-card');
    tx+=T(120,108,'A','m')+T(230,108,'B','m')+T(342,124,on?'current':'no current','xs')+HIT(82,30,76,86,'a','Switch A')+HIT(192,30,76,86,'b','Switch B');
    sh+=R(424,10,160,156,'f-card')+P('M424 42H584M477 10V166M530 10V166','thin');
    tx+=T(450,33,'A','xs')+T(503,33,'B','xs')+T(557,33,'out','xs');
    [[0,0],[0,1],[1,0],[1,1]].forEach(function(r,i){var y=68+i*30,k=''+r[0]+r[1],cur=r[0]===a&&r[1]===b,c='s'+(cur?' c-det':'');tx+=T(450,y,r[0],c)+T(503,y,r[1],c)+T(557,y,seen[k]?(r[0]&r[1]):'?',seen[k]?c:'s c-mute')});
    draw(s.stage,600,176,sh,tx,'Two switches in a row on one wire, a lamp, and a table of what you have tried');}
  tap(s.stage,function(k){if(k==='a')a^=1;else b^=1;seen[''+a+b]=1;paint();var n=Object.keys(seen).length;if(n===4){s.say('Four tries, one way through: both on.','ok');s.win()}else s.say(n+' of 4 rows tried.')});
  paint();s.say('Click switch <b>A</b> or <b>B</b> to flip it.');
};
W.adder=function(s){
  var Q=[[1,1],[2,3],[3,3]],q=0,out=[0,0,0],lock=false;
  function paint(){var A=Q[q][0],B=Q[q][1],sh='',tx='',sum=out[0]*4+out[1]*2+out[2],ok=sum===A+B;
    [[4,358],[2,428],[1,498]].forEach(function(c){tx+=T(c[1],20,c[0],'xs c-mute')});
    [[A,30,'A = '+A],[B,86,'+ B = '+B]].forEach(function(r){tx+=T(290,r[1]+33,r[2],'m r');[2,1].forEach(function(v,i){var bit=(r[0]&v)?1:0;sh+=R(400+i*70,r[1],56,46,bit?'f-det':'f-card',8);tx+=T(428+i*70,r[1]+33,bit,'m')})});
    sh+=P('M200 146H540');
    tx+=T(290,196,'= '+(ok?sum:'?'),'m r'+(ok?' c-hum':''));
    [4,2,1].forEach(function(v,i){sh+=R(330+i*70,160,56,50,ok?'f-hum':out[i]?'f-prob':'f-card',8);tx+=T(358+i*70,195,out[i],'m')+HIT(330+i*70,160,56,50,i,'Answer switch worth '+v)});
    draw(s.stage,600,222,sh,tx,'Two numbers in switches, and three answer switches worth 4, 2 and 1');}
  tap(s.stage,function(k){if(lock)return;out[k]^=1;paint();var A=Q[q][0],B=Q[q][1];if(out[0]*4+out[1]*2+out[2]!==A+B)return;lock=true;
    if(q===Q.length-1){s.say('3 + 3 = 6, written 110. You did by hand what a few wired switches do with nobody watching.','ok');s.win();return}
    s.say(A+' + '+B+' = '+(A+B)+'. Next one.','ok');setTimeout(function(){q++;out=[0,0,0];lock=false;paint();s.say('Sum '+(q+1)+' of 3. Set the answer switches.')},1100)});
  paint();s.say('Sum 1 of 3. Click the bottom row of switches to write the answer.');
};
W.bit=function(s){
  var inp=0,loop=0;
  function paint(){var c=loop?'f-det':'f-card',w=loop?' c-det':'';
    var sh=R(24,50,116,60,inp?'f-det':'f-card',10)+P('M144 80H194','arw'+(inp?' c-det':''))+R(200,48,110,64,c)+R(400,48,110,64,c)+P('M314 70H394','arw'+w)+P('M455 116V152H255V118','arw'+w)+P('M514 80H544','arw'+w);
    var tx=T(82,87,inp?'input: 1':'input: 0','s')+HIT(24,50,116,60,'i','Input')+T(255,87,'gate 1','s')+T(455,87,'gate 2','s')+T(572,92,loop,'h'+(loop?' c-det':''))+(loop?T(355,178,'each one holds the other open','xs c-mute'):'');
    draw(s.stage,600,190,sh,tx,'An input feeding two gates wired in a loop');}
  tap(s.stage,function(){inp^=1;if(inp)loop=1;paint();
    if(inp)s.say('Gate 1 switches on and turns on gate 2. Now take the input away.');
    else if(loop){s.say('The input is gone and the loop is still on. It remembers the 1.','ok');s.win()}
    else s.say('Nothing was stored, so there is nothing to keep.')});
  s.btn('Cut the power','',function(){inp=0;loop=0;paint();s.say('No electricity, no loop. The bit is gone.')});
  paint();s.say('Click the raised <b>input</b> box.');
};

/* ================= 2. How a machine remembers ================= */
W.bench=function(s){
  var HI='0110100001101001',bench=false,disk=false,power=true,lv=0,tick=0,timer=null;
  function paint(){var sh=R(14,34,572,76,'f-card',10)+R(14,150,572,76,'f-card',10),tx=T(20,24,'workbench (RAM)'+(bench?': "hi"':''),'s l')+T(20,142,'storage (flash)'+(disk?': "hi"':''),'s l');
    for(var i=0;i<16;i++){var x=30+i*33+(i>7?16:0),one=HI.charAt(i)==='1';
      if(bench&&one&&lv>0)sh+=R(x+2,96-46*lv,20,46*lv,'fill-det',2);
      sh+=P('M'+x+' 46V98H'+(x+24)+'V46','thin');
      sh+=R(x,164,24,48,disk&&one?'f-det':'',3)+R(x-4,160,32,56,'thin',6);}
    if(!power)tx+=T(300,84,'power off','h c-act');
    draw(s.stage,600,236,sh,tx,'Sixteen leaky buckets on the workbench and sixteen walled cells in storage');}
  function run(){clearInterval(timer);tick=0;timer=setInterval(function(){tick++;
    if(power){lv=tick%5===0?1:Math.max(.4,lv-.13);if(tick>45){clearInterval(timer);lv=1}}
    else{lv=Math.max(0,lv-.2);if(lv===0){clearInterval(timer);bench=false;paint();
      if(disk){s.say('The workbench is wiped. Storage still holds "hi".','ok');s.win()}else s.say('The buckets drained. "hi" is gone for good. Type it again, and save before you cut.');return}}
    paint()},170)}
  s.btn('Type hi','pri',function(){power=true;bench=true;lv=1;run();paint();s.say('On the workbench at once. The buckets leak, so the chip keeps topping them up.')});
  s.btn('Save to storage','',function(){if(!bench||!power){s.say('Nothing on the workbench to save.');return}disk=true;paint();s.say('Pushed through the wall and locked in. No leak, no topping up. But slow to write.')});
  s.btn('Cut the power','',function(){if(!power)return;if(!bench){s.say('The workbench is empty. Type hi first.');return}power=false;run();s.say('The topping-up has stopped.')});
  paint();s.say('Type hi, then cut the power.');
};
W.dir=function(s){
  var B={38:'plans',42:'chats',45:'notes'},round=1,open={},reads=0,busy=false;
  function paint(){var sh='',tx='';
    for(var i=0;i<12;i++){var n=36+i,x=16+(i%6)*76,y=30+Math.floor(i/6)*76,o=open[n];
      sh+=R(x,y,66,50,o?(B[n]==='chats'?'f-hum':'f-bg'):'f-card');tx+=T(x+33,y-6,n,'xs c-mute')+T(x+33,y+33,o?(B[n]||'…'):'?','s')+(o?'':HIT(x,y,66,50,n,'Read block '+n));}
    if(round===2){sh+=R(482,24,106,132,'f-det',8);tx+=T(535,50,'contents','xs')+T(535,80,'chats 42','s')+T(535,106,'plans 38','s')+T(535,132,'notes 45','s')}
    tx+=T(16,190,'reads: '+reads,'s l');
    draw(s.stage,600,200,sh,tx,'A row of numbered disk blocks, face down');}
  tap(s.stage,function(k){if(busy||open[k])return;open[k]=1;reads++;paint();
    if(B[k]!=='chats'){s.say(B[k]?'Block '+k+' is where '+B[k]+' starts. Keep reading.':'Block '+k+': not the start of anything. Keep reading.');return}
    if(round===1){busy=true;s.say('Found in <b>'+reads+'</b> reads. A disk only knows numbered blocks. So set a few blocks aside as a contents page.','ok');setTimeout(function(){round=2;open={};reads=0;busy=false;paint();s.say('Same disk, plus the contents page. Find the chats again.')},1900)}
    else{s.say(reads===1?'One read. The contents page said where to look.':'Found in '+reads+'. The contents page said 42.','ok');s.win()}});
  paint();s.say('The chats start in one of these blocks. Click blocks to read them until you find it.');
};
W.index=function(s){
  var N=21,vals,target,open,looks,sorted=0,found;
  function deal(){var set=[];while(set.length<N){var v=3+Math.floor(Math.random()*95);if(set.indexOf(v)<0)set.push(v)}set.sort(function(a,b){return a-b});
    var ti;do{ti=Math.floor(Math.random()*N)}while(ti===10);target=set[ti];vals=sorted?set:shuf(set);open={};looks=0;found=false;paint();
    s.say(sorted?'A sorted copy of the column. Find <b>'+target+'</b> in 5 looks or fewer. Each card tells you which way to go.':'The table, in the order the rows arrived. Click cards to turn them over and find <b>'+target+'</b>.')}
  function paint(){var sh='',tx='',lo=-1,hi=N,k;if(sorted)for(k in open){k=+k;if(vals[k]<target)lo=Math.max(lo,k);if(vals[k]>target)hi=Math.min(hi,k)}
    for(var i=0;i<N;i++){var x=22+(i%7)*80,y=14+Math.floor(i/7)*62,o=open[i],dead=sorted&&!o&&(i<lo||i>hi);
      sh+=R(x,y,70,48,o?(vals[i]===target?'f-hum':'f-bg'):dead?'dash':'f-card');
      tx+=o?T(x+35,y+33,vals[i],'m'):dead?'':T(x+35,y+33,'?','s c-mute')+HIT(x,y,70,48,i,'Turn card '+(i+1));}
    tx+=T(22,214,'looks: '+looks,'s l');
    draw(s.stage,600,224,sh,tx,'Twenty-one cards, face down');}
  tap(s.stage,function(k){k=+k;if(found||open[k])return;open[k]=1;looks++;var v=vals[k];
    if(v===target){found=true;paint();
      if(sorted&&looks<=5){s.say('Found in <b>'+looks+'</b>. You hopped instead of scanning.','ok');s.win()}
      else if(sorted)s.say('Found in '+looks+'. It can always be done in 5: start in the middle and halve what is left. Deal again.');
      else s.say('Found in <b>'+looks+'</b> looks, card by card. With a billion rows that is up to a billion reads. Now try the sorted copy.');return}
    paint();s.say(sorted?v+' is too '+(v<target?'low. '+target+' is further on.':'high. '+target+' is further back.'):v+'. No clue where '+target+' is. Keep turning.')});
  s.add(seg(['Table as it arrived','Sorted copy'],0,function(i){sorted=i;deal()}));
  s.btn('Deal again','',function(){deal()});
  deal();
};
/* link: pick where conversation 7 keeps its link, then send messages. The list rewrites the conversation row every time;
   a number on each message never touches it. Found once both ways have had two messages. */
W.link=function(s){
  var TX=['plan for mon?','sounds good','see you at 9','sent the doc','on it','thanks!','noted'],mode=-1,msgs,rw,run,sent=[0,0],won=false,go;
  function start(){msgs=[[102,TX[0]],[104,TX[1]]];rw=0;run=0}
  function paint(){var sh='',tx='',list=mode===0,num=mode===1,ids=msgs.map(function(m){return m[0]});
    function C(x,y,w,ht,c,t,tc){sh+=R(x,y,w,ht,c,4);tx+=T(x+w/2,y+ht/2+8,t,tc||'s')}
    tx+=T(14,22,'conversations','xs l');
    C(14,30,70,30,'f-bg','id','xs');C(84,30,150,30,'f-bg','title','xs');C(14,60,70,40,'f-card','7');C(84,60,150,40,'f-card','Mon plan');
    if(list){C(234,30,352,30,'f-bg','message ids','xs');C(234,60,352,40,rw?'f-prob':'f-card',ids.length>5?ids[0]+', '+ids[1]+' … '+ids[ids.length-1]+'  ('+ids.length+')':ids.join(', '))}
    tx+=T(14,130,'conversation row rewritten: '+rw+(rw===1?' time':' times'),'xs l'+(rw?' c-prob':''));
    tx+=T(14,166,'messages','xs l')+(msgs.length>3?T(586,166,(msgs.length-3)+' earlier '+(msgs.length===4?'row':'rows')+' above','xs r c-mute'):'');
    var cols=num?[[14,80,'id'],[94,210,'conversation_id'],[304,282,'text']]:[[14,80,'id'],[94,492,'text']];
    cols.forEach(function(c){C(c[0],174,c[1],30,'f-bg',c[2],'xs')});
    msgs.slice(-3).forEach(function(m,i,a){var y=204+i*40,last=i===a.length-1&&run>0;
      C(14,y,80,40,'f-card',m[0]);
      if(num){C(94,y,210,40,last?'f-det':'f-card','7');C(304,y,282,40,'f-card',m[1])}else C(94,y,492,40,'f-card',m[1])});
    draw(s.stage,600,330,sh,tx,'A conversations table with one row, conversation 7, and a messages table');}
  s.add(seg(['A list on the conversation','A number on each message'],-1,function(i){mode=i;start();go.disabled=false;paint();
    s.say(i?'Each message row gets a <b>conversation_id</b> column. Now send a message.':'Conversation 7 gets a <b>message ids</b> column. Now send a message.')}));
  go=s.btn('A new message arrives','pri',function(){if(mode<0)return;var id=msgs[msgs.length-1][0]+1;msgs.push([id,TX[msgs.length%TX.length]]);run++;sent[mode]++;if(!mode)rw++;paint();
    var other=sent[mode?0:1]<2?' Now switch to the other way and send two more.':'';
    if(!won&&sent[0]>=2&&sent[1]>=2){won=true;s.say('One number on the many side: the conversation row is never rewritten, and no row grows.','ok');s.win();return}
    if(!mode)s.say(run<2?'Message '+id+' arrives, so the list gains '+id+' and the whole conversation row is written again.':'The list grows with every message, and the row is written again each time. At 4,000 messages, one "hi" rewrites 4,000 ids.'+other);
    else s.say(run<2?'Message '+id+' gets conversation_id 7. The conversation row was not touched.':'Every message row is the same size, and the conversation row was never rewritten.'+other)});
  go.disabled=true;start();paint();s.say('Conversation 7 will get thousands of messages. Pick where the link goes, then send messages.');
};

/* ================= 3. Can you trust a machine ================= */
W.journal=function(s){
  var mode=0,p=0,run=false,off=false,st,timer,broke=false,held=false,go;
  function reset(){st={credits:100,plan:'free',j:''};p=0;run=false;off=false}
  function apply(){if(mode){st.j=p>=.25?'0412 · took credits, raised plan':p>.04?'0412 · took cre':'';if(p>=.5)st.credits=0;if(p>=.85)st.plan='pro'}else{if(p>=.3)st.credits=0;if(p>=.8)st.plan='pro'}}
  function paint(){var sh=R(30,40,250,50,st.credits===0?'f-bg':'f-card')+R(30,104,250,50,st.plan==='pro'?'f-hum':'f-card'),
    tx=T(30,30,'the books','s l')+T(46,73,'credits','s l')+T(264,74,st.credits,'m r')+T(46,137,'plan','s l')+T(264,138,st.plan,'m r');
    if(mode){sh+=R(320,40,264,50,st.j?'f-det':'f-card');tx+=T(320,30,'the journal','s l')+T(334,72,st.j||'(empty)','xs l')}
    else{sh+=R(320,40,264,50,'dash');tx+=T(320,30,'the journal','s l c-mute')+T(452,72,'not used yet','xs c-mute')}
    var marks=mode?[[.25,'journal line'],[.5,'take credits'],[.85,'raise plan']]:[[.3,'take credits'],[.8,'raise plan']];
    sh+=P('M30 196H570','thin');marks.forEach(function(m){var x=30+540*m[0];sh+=P('M'+x+' 186V206','thin');tx+=T(x,230,m[1],'xs c-mute')});
    sh+=C(30+540*p,196,9,off?'f-act':'f-prob');
    if(off)tx+=T(450,128,'power off','h c-act');
    draw(s.stage,600,240,sh,tx,'The books, the journal, and a timeline of the upgrade',true);}
  /* three buttons, each lit only when it can be used: start the upgrade, cut the power mid-way, restart */
  var cut,rs;
  function sync(){go.disabled=run||off;cut.disabled=!run;rs.disabled=!off}
  go=s.btn('Upgrade','pri',function(){
    reset();run=true;sync();s.say('Two writes: take the credits, raise the plan. Cut the power before both land.');
    timer=setInterval(function(){p=Math.min(1,p+.011);apply();paint();if(p>=1){clearInterval(timer);run=false;sync();s.say('Both writes landed. A good day. Upgrade again and cut the power partway.')}},50)});
  cut=s.btn('Cut the power','',function(){clearInterval(timer);run=false;off=true;sync();paint();s.say('Power off, mid-upgrade. Now restart the machine.')});
  rs=s.btn('Restart the machine','',function(){off=false;
    if(mode){held=true;if(p>=.25){st.credits=0;st.plan='pro';p=1;s.say('The machine reads the journal and finishes what it says. Credits taken, plan raised. All or nothing.','ok')}else{st.j='';p=0;s.say('The journal line is torn, so the machine throws it away. Nothing changed. All or nothing.','ok')}}
    else if(p>=.3&&p<.8){broke=true;s.say('Back on. The credits are gone and the plan never rose. Nothing on the disk says a change was half done. Now write the journal first.','ok')}
    else s.say(p<.3?'Nothing had been written yet. Cut a little later.':'Both writes had landed. Cut a little earlier.');
    sync();paint();if(broke&&held)s.win()});
  s.add(seg(['Edit the books directly','Write the journal first'],0,function(i){clearInterval(timer);mode=i;reset();sync();paint();s.say(i?'One line goes in the journal before anything else is touched. Try to break it.':'Two writes: take the credits, raise the plan.')}));
  sync();
  reset();paint();s.say('Press Upgrade, then cut the power between the two writes.');
};
W.original=function(s){
  var names=['Design','Product Design'],L=0,F=0,jr=0,caught=false,remade=false,timer;
  function paint(){var stale=F>=0&&F!==L;
    var sh=R(30,48,220,72,'f-det')+R(350,48,220,72,F<0?'dash':stale?'f-act':'f-det')+P('M256 84H344','arw'+(jr?' c-prob':''));
    var tx=T(140,38,'leader','s')+T(460,38,'follower (a copy)','s')+T(140,93,names[L],'m')+T(460,93,F<0?'(wiped)':names[F],'m')+T(300,70,'journal','xs'+(jr?' c-prob':' c-mute'))+T(140,146,'takes every write','xs c-mute')+T(460,146,F<0?'':stale?'a moment behind':'in step','xs c-mute');
    draw(s.stage,600,158,sh,tx,'A leader and a follower, joined by the journal');}
  function check(){if(caught&&remade)s.win()}
  function sync(ms,msg){clearTimeout(timer);jr=1;paint();timer=setTimeout(function(){F=L;jr=0;paint();if(msg)s.say(msg,'ok');check()},ms)}
  s.btn('Rename the workspace','pri',function(){L^=1;if(F>=0)sync(2600);else paint();s.say('The leader has the new name. Its journal line is on the way to the follower. Quick: read the follower.')});
  s.btn('Read from the follower','',function(){
    if(F<0)s.say('Nothing there to read.');
    else if(F!==L){caught=true;s.say('The follower says "'+names[F]+'". The leader says "'+names[L]+'". Two truths, for a moment. That is the price of a copy.','ok');check()}
    else s.say('It has caught up: "'+names[F]+'". Rename again and read faster.')});
  s.btn('Wipe the follower','',function(){clearTimeout(timer);jr=0;F=-1;paint();s.say('The copy is gone. Was anything lost? Remake it.')});
  s.btn('Remake it','',function(){if(F>=0){s.say('There is nothing to remake.');return}remade=true;sync(1200,'Replayed from the leader\'s journal. Nothing was lost, because the copy was never the original.')});
  paint();s.say('Rename the workspace, then read the follower before it catches up.');
};
W.line=function(s){
  var D=[[820,255],[950,300],[1040,275],[1180,340],[1260,318],[1380,372],[1450,395],[1620,400],[1740,452],[1850,438],[2010,505],[2180,520],[2350,572],[2520,590]];
  var w=10,c=560,hist=[],hide=false,fit=false,timer=null,X0=600,X1=2700,Y0=100,Y1=700,WD=530,HT=250,GOAL=25;
  var out=h('p','fp-out'),sp=h('div','fp-spark'),plot=h('div');s.stage.appendChild(plot);s.stage.appendChild(out);s.stage.appendChild(sp);
  function px(x){return 56+(x-X0)/(X1-X0)*WD}function py(y){return 10+HT-(y-Y0)/(Y1-Y0)*HT}
  function pred(x){return w*x/1000+c}
  function miss(){return D.reduce(function(a,d){return a+Math.abs(pred(d[0])-d[1])},0)/D.length}
  function nudge(){var gw=0,gc=0;D.forEach(function(d){var e=pred(d[0])-d[1];gw+=2*e*d[0]/1000;gc+=2*e});w-=.05*gw/D.length;c-=.05*gc/D.length}
  var sw=range(0,400,w,1,'How steep',function(v){w=v;paint()}),sc=range(0,600,c,1,'Where it starts',function(v){c=v;paint()});
  function paint(){var g=pred(1586),m=miss();if(!hide&&m<GOAL)fit=true;
    var sh=P('M56 10V'+(HT+10)+'H'+(56+WD),'ax')+(hide?'':D.map(function(d){return C(px(d[0]),py(d[1]),5,'pt')}).join(''))+
      '<clipPath id="fpc"><rect x="56" y="10" width="'+WD+'" height="'+HT+'"/></clipPath><g clip-path="url(#fpc)"><line class="curve" x1="'+px(X0)+'" y1="'+py(pred(X0))+'" x2="'+px(X1)+'" y2="'+py(pred(X1))+'"/><line class="gh" x1="'+px(1586)+'" y1="'+(HT+10)+'" x2="'+px(1586)+'" y2="'+py(g)+'"/>'+C(px(1586),py(g),6.5,'gp')+'</g>';
    var tx=[200,400,600].map(function(y){return T(48,py(y)+6,'$'+y+'k','xs r c-mute')}).join('')+[1000,1500,2000,2500].map(function(x){return T(px(x),HT+32,num(x),'xs c-mute')}).join('')+T(56+WD,HT+52,'size, sq ft','xs r c-mute')+(hide?T(320,60,'sales thrown away','s c-mute'):'');
    draw(plot,600,HT+60,sh,tx,'House sales: size against price, with a line through them',true);
    out.innerHTML='The house nobody sold (1,586 sq ft): the line guesses <b class="big">$'+Math.round(g)+'k</b>'+(hide?'':' <span class="mut">· average mistake</span> <b class="'+(m<GOAL?'good':'')+'">$'+Math.round(m)+'k</b> <span class="mut">(goal: under $'+GOAL+'k)</span>');
    sw.input.value=w;sc.input.value=c;
    if(hist.length>1){var mx=Math.max.apply(null,hist);sp.innerHTML='<span>Mistake after each nudge</span><svg viewBox="0 0 560 60" preserveAspectRatio="none"><polyline points="'+hist.map(function(v,i){return (i/(hist.length-1)*560).toFixed(1)+','+(56-v/mx*52).toFixed(1)}).join(' ')+'"/></svg>'}else sp.innerHTML='';}
  function go(n){clearInterval(timer);var left=n;if(!hist.length)hist.push(miss());timer=setInterval(function(){var k=Math.min(left,n>1?20:1);for(var i=0;i<k;i++)nudge();left-=k;hist.push(miss());paint();if(left<=0){clearInterval(timer);if(fit)s.say('The line has settled into the dots. Two numbers hold the whole pattern. Now throw the sales away.','ok')}},30)}
  var r=h('div','fp-row');r.appendChild(sw);r.appendChild(sc);s.stage.appendChild(r);
  s.btn('Nudge once','',function(){go(1)});s.btn('Nudge 1,000 times','pri',function(){go(1000)});
  s.btn('Throw the sales away','',function(){hide=!hide;this.textContent=hide?'Bring the sales back':'Throw the sales away';paint();
    if(hide&&fit){s.say('No sales left, and the line still prices the house nobody sold.','ok');s.win()}else if(hide)s.say('The line is still wild. Bring the sales back and fit it first.')});
  paint();s.say('The line starts random. Drag the two dials, or let the machine nudge them.');
};
W.loop=function(s){
  var PR=[{start:['The','capital','of','France','is'],
      ctx:{'France is':[['Paris',.91],['the',.03],['a',.02],['located',.01],['Lyon',.01]],'is Paris':[['.',.46],[',',.40],['and',.08],['which',.06]]},
      last:{'the':[['city',.5],['capital',.3],['largest',.2]],'a':[['city',.6],['beautiful',.25],['major',.15]],'located':[['in',.9],['on',.1]],'in':[['the',.5],['France',.3],['Europe',.2]],'Lyon':[['.',.55],[',',.45]],'is':[['a',.5],['the',.3],['known',.2]],'known':[['for',.9],['as',.1]],'for':[['its',.7],['the',.3]],'its':[['art',.4],['food',.3],['history',.3]],'of':[['France',.5],['light',.3],['the',.2]],'France':[['.',.6],[',',.4]],'Europe':[['.',1]],'and':[['the',.5],['a',.3],['its',.2]],'which':[['is',1]],'city':[['of',.5],['known',.3],['in',.2]],'capital':[['of',.8],['.',.2]],'as':[['the',1]],'on':[['the',1]],',':[['a',.35],['the',.3],['which',.2],['and',.15]],'Paris':[[',',.5],['.',.5]],'beautiful':[['city',.9],['.',.1]],'major':[['city',.9],['.',.1]],'largest':[['city',.9],['.',.1]]},
      end:function(t){return t.indexOf('Lyon')>-1?'Fluent, confident, wrong. The dice landed on a weak guess and the model carried on.':'A strong pattern: "France" and "Paris" sat together in millions of sentences.'}},
    {start:['The','founder','of','Bluefern','Robotics','is'],ctx:{},
      last:{'is':[['Daniel',.27],['Dr',.26],['Sarah',.25],['a',.22]],'Dr':[['Sarah',.5],['Daniel',.5]],'Daniel':[['Mercer',.55],['Okafor',.45]],'Sarah':[['Lindqvist',.55],['Mercer',.45]],'a':[['former',1]],'former':[['robotics',.6],['software',.4]],'robotics':[['engineer',1]],'software':[['engineer',1]],'engineer':[['named',1]],'named':[['Daniel',.5],['Sarah',.5]],'Mercer':[['.',1]],'Okafor':[['.',1]],'Lindqvist':[['.',1]]},
      end:function(){return 'We made that company up. The model named a founder anyway, with the same calm it used for Paris. There is no "not found". There is always a next token.'}}];
  var DEF=[['.',.6],[',',.2],['and',.2]],pi=0,toks,done,fin=[0,0],text=h('p','fp-text'),view=h('div');
  s.stage.appendChild(text);s.stage.appendChild(view);
  function dist(){var p=PR[pi];return p.ctx[toks.slice(-2).join(' ')]||p.last[toks[toks.length-1]]||DEF}
  function paint(msg,c){var n=PR[pi].start.length;text.innerHTML=toks.map(function(t,i){return '<span class="'+(i>=n?'new':'')+'">'+esc(t)+'</span>'}).join(' ')+(done?'':' <span class="fp-cur">?</span>');
    view.innerHTML=done?'':bars(dist().map(function(d,i){return {t:d[0],v:d[1],on:i===0}}));s.say(msg,c)}
  function add(t){toks.push(t);var n=PR[pi].start.length;if((t==='.'&&toks.length>n+1)||toks.length>=24)done=true;
    if(!done){paint('Added "'+esc(t)+'". Score every token again.');return}
    fin[pi]=1;paint(PR[pi].end(toks)+(fin[0]&&fin[1]?'':' Now finish the other sentence.'),'ok');if(fin[0]&&fin[1])s.win()}
  function reset(){toks=PR[pi].start.slice();done=false;paint('Chances for the next token. The top few are shown.')}
  s.add(seg(['A sentence it has read','A company it never read about'],0,function(i){pi=i;reset()}));
  s.btn('Pick the likeliest','pri',function(){if(!done)add(dist()[0][0])});
  s.btn('Roll the dice','',function(){if(done)return;var d=dist(),r=Math.random(),i=0;while(i<d.length-1&&(r-=d[i][1])>0)i++;add(d[i][0])});
  s.btn('Start again','',reset);
  reset();
};

/* ================= 4. What is learning ================= */
W.game=function(s){
  var KNOWN='THANK ',REST='YOU VERY MUCH',i=0,right=0,res=[],line=h('p','fp-shan'),keys=h('div','fp-keys');
  s.stage.appendChild(line);s.stage.appendChild(keys);
  function ch(c){return c===' '?'_':c}
  function paint(){line.innerHTML=KNOWN.split('').map(function(c){return '<span>'+ch(c)+'</span>'}).join('')+REST.split('').map(function(c,j){return j<i?'<span class="'+(res[j]?'ok':'miss')+'">'+ch(c)+'</span>':j===i?'<span class="fp-cur">?</span>':'<span class="mut">·</span>'}).join('')}
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ '.split('').forEach(function(c){keys.appendChild(btn(ch(c),'key',function(){if(i>=REST.length)return;var ok=c===REST.charAt(i);res.push(ok);if(ok)right++;var was=REST.charAt(i);i++;paint();
    if(i>=REST.length){[].forEach.call(keys.children,function(k){k.disabled=true});s.say('You got <b>'+right+' of '+REST.length+'</b> first time. Picking at random gets about 1 in 27. You have read a lot of English. That is all the machine has, too.','ok');s.win()}
    else s.say(ok?'Yes. Next letter.':'It was '+(was===' '?'a space':was)+'. Next letter.')}))});
  paint();s.say('Guess the next letter. The underscore is a space.');
};
W.token=function(s){
  var TEXT='the other path. then the thin moth bathes there',toks,next,log,chips=h('div','fp-chips'),out=h('p','fp-out'),opts=h('div','fp-row');
  s.stage.appendChild(chips);s.stage.appendChild(out);s.stage.appendChild(opts);
  function pairs(){var m={},o=[];for(var i=0;i<toks.length-1;i++){var k=toks[i]+'\u0001'+toks[i+1];if(!m[k]){m[k]=0;o.push(k)}m[k]++}return o.map(function(k){return [k.split('\u0001'),m[k]]}).sort(function(a,c){return c[1]-a[1]})}
  function show(t){return esc(t).replace(/ /g,'·')}
  function merge(a,c){var o=[];for(var i=0;i<toks.length;i++){if(toks[i]===a&&toks[i+1]===c){o.push(a+c);i++}else o.push(toks[i])}toks=o;log.push([next++,a+c])}
  function paint(){chips.innerHTML=toks.map(function(t){return '<span class="'+(t.length>1?'m':'')+'">'+show(t)+'</span>'}).join('');
    out.innerHTML='<b class="big">'+toks.length+'</b> tokens <span class="mut">for '+TEXT.length+' bytes</span>'+(log.length?' <span class="mut">· new:</span> '+log.slice(-4).map(function(l){return '<code>'+l[0]+' = '+show(l[1])+'</code>'}).join(' '):'');
    var p=pairs().filter(function(x){return x[1]>1});opts.innerHTML='';if(!p.length){opts.appendChild(h('span','lab','No pair appears twice any more.'));return}
    var max=p[0][1];opts.appendChild(h('span','lab','The machine counted every pair of neighbours. Merge the most common:'));
    shuf(p.slice(0,4)).forEach(function(x){opts.appendChild(btn('<code>'+show(x[0][0])+'</code> + <code>'+show(x[0][1])+'</code> <span class="mut">'+x[1]+' times</span>','',function(){
      if(x[1]!==max){nope(this);s.say('That pair appears '+x[1]+' times. Another appears '+max+'. Merge the most common one.');return}
      merge(x[0][0],x[0][1]);paint();var has=toks.indexOf('the')>-1;s.say('<code>'+show(x[0][0]+x[0][1])+'</code> appeared '+max+' times, so it becomes token '+(next-1)+'. The text got shorter.'+(has?' And "the" is now one token.':''),'ok');if(has)s.win()}))});}
  function reset(){toks=TEXT.split('');next=256;log=[];paint();s.say('Every character is one byte, so one token. A · is a space. Token numbers 0 to 255 are taken.')}
  s.btn('Let the machine finish','',function(){for(;;){var p=pairs();if(!p.length||p[0][1]<2)break;merge(p[0][0][0],p[0][0][1])}paint();s.say('Count, merge, repeat. A real tokenizer does this about fifty thousand times.')});
  s.btn('Start again','',reset);
  reset();
};
W.count=function(s){
  var TOK=['the','capital','of','France','is'],seen={},out=h('div');
  var Rw=[{n:1,rows:'50,000 rows',d:[['a',.09],['the',.08],['not',.05],['in',.04],['Paris',.001]],note:'It opened the row for "is": every sentence that ever had "is" in it, mixed together. "France" was one token back and the table never looked.'},
    {n:2,rows:'2,500,000,000 rows',d:[['a',.22],['the',.14],['Paris',.09],['in',.07],['one',.05]],note:'Better: "Paris" is near the top. And the table is fifty thousand times bigger.'},
    {n:10,rows:'a 1 followed by 47 zeros of rows',d:[],note:'More rows than grains of sand on Earth, and almost every one is empty. This exact run never appeared in any text.'}];
  function paint(i){var r=Rw[i];seen[i]=1;
    out.innerHTML='<p class="fp-text">'+TOK.map(function(t,j){return '<span class="'+(j>=TOK.length-r.n?'see':'cov')+'">'+t+'</span>'}).join(' ')+' <span class="fp-cur">?</span></p><p class="fp-out"><span class="mut">Table size:</span> <b>'+r.rows+'</b></p>'+(r.d.length?bars(r.d.map(function(d){return {t:d[0],v:d[1]*3,label:d[1]<.01?'0.1%':Math.round(d[1]*100)+'%',on:d[0]==='Paris'}})):'<p class="fp-out"><b class="big">not found</b></p>');
    s.say(r.note);if(Object.keys(seen).length===3)s.win()}
  s.stage.appendChild(out);s.add(seg(['Last 1 token','Last 2 tokens','Last 10 tokens'],0,paint));paint(0);
};
W.hill=function(s){
  var d,steps,seen,done,WD=560,HT=190,B=.62;
  function f(x){return 5*(x-B)*(x-B)+.2}function px(x){return 20+x*WD}function py(y){return 16+HT-y/2.3*HT}
  function piece(a,b){var pts=[];for(var x=a;x<=b+1e-9;x+=.01)pts.push(px(x).toFixed(1)+','+py(f(x)).toFixed(1));return '<polyline class="curve'+(done?'':' thin')+'" points="'+pts.join(' ')+'"/>'}
  function paint(){var sh='',g=d<B?1:-1;
    if(done)sh+=piece(0,1);else seen.concat([d]).forEach(function(x){sh+=piece(Math.max(0,x-.035),Math.min(1,x+.035))});
    seen.forEach(function(x){sh+=C(px(x),py(f(x)),4,'tr')});
    if(!done)sh+='<line class="ar" x1="'+px(d)+'" y1="'+py(f(d))+'" x2="'+px(d+g*.08)+'" y2="'+py(f(d+g*.08))+'" marker-end="url(#fpav)"/>';
    sh+=C(px(d),py(f(d)),8,'gp');
    var tx=T(Math.max(70,Math.min(530,px(d))),py(f(d))-18,'loss '+f(d).toFixed(2),'s')+T(20,HT+46,'dial turned down','xs l c-mute')+T(580,HT+46,'dial turned up','xs r c-mute')+(done?'':T(300,HT+46,'fog: you only feel the slope','xs c-mute'));
    draw(s.stage,600,HT+56,sh,tx,'A valley of loss, hidden in fog except where you stand',true);}
  function step(size){if(done)return;seen.push(d);var g=d<B?1:-1,was=d;d=Math.max(0,Math.min(1,d+g*size));steps++;
    if(Math.abs(d-B)<.03){done=true;paint();if(steps<=8){s.say('The bottom, in <b>'+steps+'</b> steps. You never saw the valley. The slope under your feet was enough.','ok');s.win()}else s.say('The bottom, in '+steps+' steps. Try again in 8 or fewer: big steps while far, small steps when close.');return}
    paint();s.say((was<B)!==(d<B)?'You jumped right over the bottom. The slope now points back.':'Step '+steps+'. Loss '+f(d).toFixed(2)+'. The slope says: keep turning the dial '+(d<B?'up':'down')+'.')}
  function reset(){d=.08;steps=0;seen=[];done=false;paint();s.say('The arrow is the slope where you stand. Choose how far to step.')}
  s.btn('Small step','pri',function(){step(.04)});s.btn('Big step','',function(){step(.2)});s.btn('Start again','',reset);
  reset();
};

/* ================= 5. Attention and transformers ================= */
W.map=function(s){
  var PT=[['Paris',.9,.9,-12,5,'r'],['London',.38,.9,0,-14,''],['France',.95,.2,-12,5,'r'],['Germany',.12,.2,12,5,'l']],step=0,guess=null,b1,b2;
  function px(x){return 60+x*500}function py(y){return 250-y*210}
  function arrow(a,b){return '<line class="ar" x1="'+px(a[0])+'" y1="'+(py(a[1])-9)+'" x2="'+px(b[0])+'" y2="'+(py(b[1])+11)+'" marker-end="url(#fpav)"/>'}
  function paint(){var sh=P('M60 16V250H584','ax'),tx=T(584,274,'how French?','xs r c-mute')+T(54,24,'city?','xs r c-mute');
    PT.forEach(function(p){sh+=C(px(p[1]),py(p[2]),6,'pt');tx+=T(px(p[1])+p[3],py(p[2])+p[4],p[0],'s '+p[5])});
    if(guess){tx+=T(px(guess[0]),py(guess[1])+8,'?','m c-act')}
    if(step>=1){sh+=arrow([.95,.2],[.9,.9]);tx+=T(px(.9)-34,py(.55),'country to capital','xs r c-prob')}
    if(step>=2){sh+=arrow([.12,.2],[.07,.9])+C(px(.07),py(.9),7,'gp');tx+=T(px(.07)+14,py(.9)+6,'Berlin','s l c-prob')}
    if(!guess)tx+=HITA(60,16,524,234,'plot','The map. Click where you think Berlin sits.');
    draw(s.stage,600,282,sh,tx,'Four words on a map with two scales: how French, and how much of a city',true);}
  s.stage.addEventListener('click',function(e){if(guess||!e.target.closest('[data-k="plot"]'))return;var svg=s.stage.querySelector('svg'),pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;var q=pt.matrixTransform(svg.getScreenCTM().inverse());
    guess=[Math.max(0,Math.min(1,(q.x-60)/500)),Math.max(0,Math.min(1,(250-q.y)/210))];b1.disabled=false;paint();s.say('Marked. Now find it with arithmetic instead.')});
  b1=s.btn('Paris minus France','pri',function(){step=Math.max(step,1);b2.disabled=false;paint();s.say('Paris − France = (0.90 − 0.95, 0.90 − 0.20) = <b>(−0.05, +0.70)</b>. A short arrow that means "country to capital".')});
  b2=s.btn('Add that arrow to Germany','',function(){step=2;paint();var dx=guess?Math.hypot(guess[0]-.07,guess[1]-.9):1;
    s.say('Germany + arrow = <b>(0.07, 0.90)</b>: right next to Berlin. '+(dx<.16?'Your guess was right beside it.':'Your guess was some way off, and the arithmetic was not.')+' Nobody told the map what a capital is.','ok');s.win()});
  b1.disabled=b2.disabled=true;paint();s.say('Berlin is not on the map yet. Click where you think it belongs.');
};
W.bank=function(s){
  var Q=[{w:['I','sat','on','the','river','bank'],key:4,side:0},{w:['I','paid','at','the','bank'],key:1,side:1}],cur=0,ok=[0,0];
  function paint(){var q=Q[cur],n=q.w.length,sw=560/n,sh='',tx='',solved=ok[cur];
    q.w.forEach(function(w,i){var x=20+i*sw,last=i===n-1;sh+=R(x+6,54,sw-12,46,last?'f-prob':solved&&i===q.key?'f-hum':'f-card',8);tx+=T(x+sw/2,86,w,'m')+(last||solved?'':HIT(x+6,54,sw-12,46,i,w))});
    if(solved){var x1=20+q.key*sw+sw/2,x2=20+(n-1)*sw+sw/2;sh+=P('M'+x2+' 50C'+x2+' 8 '+x1+' 8 '+x1+' 50','c-prob')}
    sh+=C(110,196,50,'dash')+C(490,196,50,'dash');tx+=T(110,192,'river','s')+T(110,214,'shore, water','xs c-mute')+T(490,192,'money','s')+T(490,214,'loan, pay','xs c-mute');
    var bx=solved?(q.side?410:190):300;sh+=C(bx,196,9,'f-prob');tx+=T(bx,176,'bank','s c-prob')+(solved?'':T(300,232,'one spot, two meanings','xs c-mute'));
    draw(s.stage,600,252,sh,tx,'A sentence ending in bank, and a map with a river side and a money side');}
  tap(s.stage,function(k){var q=Q[cur];k=+k;if(k!==q.key){s.say('"'+q.w[k]+'" sits next to almost any word. It tells "bank" nothing. Try another.');return}
    ok[cur]=1;paint();s.say('"bank" listened to "'+q.w[k]+'" and moved its spot.'+(ok[0]&&ok[1]?' Same token, two spots, decided by its company.':' Now the other sentence.'),'ok');if(ok[0]&&ok[1])s.win()});
  s.add(seg(['Sentence 1','Sentence 2'],0,function(i){cur=i;paint();s.say('Which word should "bank" listen to?')}));
  paint();s.say('Click the word that tells you which "bank" this is.');
};
W.listen=function(s){
  var Qv=[.8,-.3,.6,.9,-.1,.4,.7,-.5];
  var Tk=[['The',[.2,.3,.1,.2,.1,-.1,.3,.1]],['capital',[.6,-.3,.5,.7,-.2,.4,.5,-.2]],['of',[.1,-.1,.3,.2,.4,.2,.1,-.1]],['France',[.7,-.2,.5,.8,.1,.3,.6,-.4]],['is',[.2,.1,.2,.2,.2,.1,.1,.1]]];
  var sc=Tk.map(function(t){return t[1].reduce(function(a,x,i){return a+x*Qv[i]},0)}),ex=sc.map(Math.exp),sum=ex.reduce(function(a,c){return a+c},0),sh_=ex.map(function(e){return e/sum});
  var picks=[],shown=false,sel=3,stage=h('div'),tbl=h('div','fp-scroll');s.stage.appendChild(stage);s.stage.appendChild(tbl);
  function f(x){return x.toFixed(2).replace('-','−')}
  function paint(){var sh='',tx='';
    Tk.forEach(function(t,i){var x=14+i*116,cx=x+52,me=i===4,pk=picks.indexOf(i)>-1;
      if(shown&&!me)sh+='<path d="M542 '+(96)+'C542 '+(40-(4-i)*9)+' '+cx+' '+(40-(4-i)*9)+' '+cx+' 96" class="c-prob" style="stroke-width:'+(1+sh_[i]*16).toFixed(1)+'"/>';
      sh+=R(x,100,104,48,me?'f-prob':shown?(i===sel?'f-det':'f-card'):pk?'f-hum':'f-card',8);
      tx+=T(cx,132,t[0],'m')+(shown?T(cx,176,Math.round(sh_[i]*100)+'%','s'+(sh_[i]>.3?' c-prob':' c-mute')):'')+(me&&!shown?'':HIT(x,100,104,48,i,t[0]));});
    if(!shown)tx+=T(542,176,'asks: what am I describing?','xs r c-prob');
    draw(stage,600,188,sh,tx,'The five tokens. "is" asks a question of the others.');
    if(!shown){tbl.innerHTML='';return}var v=Tk[sel][1];
    tbl.innerHTML='<table class="fp-t"><tr><th>Question from "is"</th>'+Qv.map(function(x){return '<td>'+f(x)+'</td>'}).join('')+'<td></td></tr><tr><th>Label on "'+Tk[sel][0]+'"</th>'+v.map(function(x){return '<td>'+f(x)+'</td>'}).join('')+'<td></td></tr><tr><th>Multiply each pair</th>'+v.map(function(x,i){return '<td>'+f(x*Qv[i])+'</td>'}).join('')+'<td><b>= '+f(sc[sel])+'</b></td></tr></table>';}
  tap(stage,function(k){k=+k;
    if(shown){sel=k;paint();s.say('Question times label, pair by pair, then added up: <b>'+f(sc[k])+'</b> for "'+Tk[k][0]+'". The five totals become shares that add up to 100.');return}
    var at=picks.indexOf(k);if(at>-1)picks.splice(at,1);else picks.push(k);
    if(picks.length<2){paint();s.say('Pick one more.');return}
    shown=true;sel=3;paint();var hit=picks.filter(function(i){return i===1||i===3}).length;
    s.say((hit===2?'Both right. ':hit===1?'One of two. ':'Not those. ')+'"is" gives France '+Math.round(sh_[3]*100)+'% of its attention and capital '+Math.round(sh_[1]*100)+'%. Click any word to see the sum behind its share.','ok');s.win()});
  paint();s.say('Which two words should "is" listen to most? Click them.');
};
W.pairs=function(s){
  var n=6,stage=h('div'),opts=h('div','fp-row');s.stage.appendChild(stage);
  function paint(){var sh='',tx='',xs=[],i,j;for(i=0;i<n;i++)xs.push(n===1?300:40+i*(520/(n-1)));
    for(i=0;i<n;i++)for(j=i+1;j<n;j++)sh+='<path d="M'+xs[i]+' 168Q'+((xs[i]+xs[j])/2)+' '+(168-(xs[j]-xs[i])*.56)+' '+xs[j]+' 168" class="c-prob thinner"/>';
    for(i=0;i<n;i++)sh+=C(xs[i],168,6,'dot');
    tx+=T(300,206,n+' tokens, '+(n*(n-1)/2)+' pairs','m');
    draw(stage,600,216,sh,tx,n+' tokens in a row with an arc between every pair',true);}
  s.stage.appendChild(range(2,12,n,1,'Length of the text',function(v){n=v;paint();s.say(n===12?'12 tokens: 66 pairs. Double the text from 6 to 12 and the listening goes from 15 to 66.':'Every token listens to every token before it.')}));
  opts.appendChild(h('span','lab','So a 1,000-token prompt has'));
  [['4,500 pairs',0],['45,000 pairs',0],['about half a million pairs',1]].forEach(function(o){opts.appendChild(btn(o[0],'',function(){if(!o[1]){nope(this);s.say('More. Every one of the thousand listens to every earlier one.');return}s.say('499,500. Double the text and you get four times the listening.','ok');s.win()}))});
  s.stage.appendChild(opts);paint();s.say('Drag the slider and watch the arcs.');
};

/* ================= 6. Hardware ================= */
W.workers=function(s){
  var c=0,g=0,timer,t=0;
  function grid(x,n,cls){var o='';for(var i=0;i<64;i++)o+=R(x+(i%8)*22,44+Math.floor(i/8)*22,18,18,i<n?cls:'f-card',3);return o}
  function paint(){draw(s.stage,600,252,grid(40,c,'f-det')+grid(384,g,'f-prob'),T(128,28,'CPU: 4 brilliant workers','s')+T(472,28,'GPU: 64 simple workers','s')+T(128,244,c+' of 64 done','xs')+T(472,244,g+' of 64 done','xs'),'Two grids of 64 small sums, one for each chip',true)}
  s.btn('Start both','pri',function(){clearInterval(timer);c=0;g=0;t=0;paint();s.say('The same multiply and add, 64 times.');
    timer=setInterval(function(){t++;c=Math.min(64,c+4);g=64;paint();if(c>=64){clearInterval(timer);s.say('The GPU finished in one tick. The CPU took sixteen. Each of its workers is cleverer, and it did not matter.','ok');s.win()}},240)});
  paint();s.say('One token of a small model is 16 billion of these sums. Here are 64.');
};
W.trip=function(s){
  var bits=16,batch=1,GOAL=40000,stage=h('div');s.stage.appendChild(stage);
  function paint(){var d=8e9,maths=2*d/1e15,gb=d*bits/8/1e9,carry=gb*1e9/3e12,tps=batch/(carry+batch*maths),w=gb*9,ok=tps>=GOAL;
    var sh=R(16,50,120,70,'f-det')+R(464,50,120,70,'f-card')+P('M140 132H458','arw')+R(300-w/2,62,w,46,'f-prob',8);
    var n=Math.min(batch,40),i;for(i=0;i<n;i++)sh+=C(300-(Math.min(n,20)-1)*5.5+(i%20)*11,i<20?48:36,3.5,'dot');
    var tx=T(76,82,'the workbench','s')+T(76,104,'8 billion dials','xs c-mute')+T(524,82,'the workers','s')+T(524,104,'mostly waiting','xs c-mute')+T(300,92,gb+' GB','s')+T(300,156,'one trip serves '+num(batch)+(batch>1?' people':' person'),'xs c-mute')+T(300,204,num(tps)+' tokens a second','h'+(ok?' c-hum':''))+T(300,230,'goal: '+num(GOAL),'xs c-mute');
    draw(stage,600,240,sh,tx,'The dials travel from the workbench to the workers for every token');
    s.say((bits<16?'Each dial held in '+bits+' bits: rougher dials. ':'')+(batch>1?'Needs '+num(batch)+' people chatting at the same moment.':'')||'One person, sixteen bits a dial. Pull the two levers.',ok?'ok':'');
    if(ok)s.win();}
  var r=h('div','fp-row');r.appendChild(range(1,300,1,1,'People sharing each trip (batching)',function(v){batch=v;paint()}));s.stage.appendChild(r);
  var r2=h('div','fp-row');r2.appendChild(h('span','lab','Bits per dial (quantization)'));r2.appendChild(seg(['16','8','4'],0,function(i){bits=[16,8,4][i];paint()}));s.stage.appendChild(r2);
  paint();
};
W.scaling=function(s){
  var D=[[1,3.96],[1.5,3.75],[2,3.66],[2.5,3.53],[3,3.29],[3.5,3.19],[4,2.96],[4.5,2.9],[5,2.68],[5.5,2.58]],BX=9,guess=null,ext=false,b;
  var n=D.length,sx=0,sy=0,sxx=0,sxy=0;D.forEach(function(d){sx+=d[0];sy+=d[1];sxx+=d[0]*d[0];sxy+=d[0]*d[1]});var m=(n*sxy-sx*sy)/(n*sxx-sx*sx),c0=(sy-m*sx)/n,pred=m*BX+c0;
  function px(x){return 60+x*54}function py(l){return 20+(4.4-l)*58}
  /* the click column starts below its "the big one" label, so the dashed frame never runs through the words */
  var TOP=36;
  function paint(){var sh=P('M60 14V'+py(.6)+'H590','ax')+D.map(function(d){return C(px(d[0]),py(d[1]),6,'pt')}).join('')+'<line class="gh" x1="'+px(BX)+'" y1="'+TOP+'" x2="'+px(BX)+'" y2="'+py(.6)+'"/>';
    var tx=T(54,26,'loss','xs r c-mute')+T(590,py(.6)+24,'computing spent (each step is ten times more)','xs r c-mute')+T(px(3.5),py(4.25),'ten small models','xs c-mute')+T(px(BX),py(4.3),'the big one','xs c-mute');
    if(guess!=null)tx+=T(px(BX)-16,py(guess)+8,'?','m c-act');
    if(ext){sh+='<line class="curve" x1="'+px(.4)+'" y1="'+py(m*.4+c0)+'" x2="'+px(9.4)+'" y2="'+py(m*9.4+c0)+'"/>'+C(px(BX),py(pred),7,'gp')}
    if(!ext)tx+=HITA(px(BX)-28,TOP,56,py(.6)-TOP,'col','The big model. Click how low you think its loss will be.');
    draw(s.stage,600,py(.6)+34,sh,tx,'Loss against computing spent for small models, and a dashed line where the big model will be',true);}
  s.stage.addEventListener('click',function(e){if(ext||!e.target.closest('[data-k="col"]'))return;var svg=s.stage.querySelector('svg'),pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;var q=pt.matrixTransform(svg.getScreenCTM().inverse());
    guess=Math.max(.7,Math.min(4.4-(TOP+6-20)/58,4.4-(q.y-20)/58));b.disabled=false;paint();s.say('Marked. Now extend the line.')});
  b=s.btn('Extend the line','pri',function(){ext=true;paint();var off=Math.abs(guess-pred);s.say('The line says a loss of about <b>'+pred.toFixed(1)+'</b>. '+(off<.3?'Your eye had it.':'You were '+off.toFixed(1)+' away.')+' Draw the line through the ones you have, and it guesses the one you do not. The house prices again.','ok');s.win()});
  b.disabled=true;paint();s.say('Ten small models are trained and measured. On the dashed line, click where the big one will land.');
};

/* ================= 7. Guesser to assistant ================= */
W.judge=function(s){
  var Q=[['How do I get onto my neighbour\'s wifi without them knowing?','Step 1: download a password cracker. Step 2:','I can\'t help with getting into someone else\'s network. Locked out of your own? Here is how to reset it.',1,'safe'],
    ['Is my plan good? (The plan charges less than it costs to make.)','It\'s brilliant. You are going to be rich.','The idea is clear, but you charge less than it costs you. Fix that first.',1,'honest'],
    ['What is the capital of Australia?','Canberra.','Australia is a fascinating country with a long history, and many people think of Sydney.',0,'helpful'],
    ['Summarise this email in one line.','The client wants the report by Friday, not Monday.','The email discusses a number of matters relating to timing.',0,'helpful']];
  var i=0,taste={helpful:.5,honest:.5,safe:.5},q=h('p','fp-text'),opts=h('div','fp-opts'),view=h('div');
  s.stage.appendChild(q);s.stage.appendChild(opts);s.stage.appendChild(view);
  function meter(){view.innerHTML='<p class="fp-out mut">What the judge has learned from your picks</p>'+bars(['helpful','honest','safe'].map(function(k){return {t:k,v:taste[k],on:taste[k]>.6,label:taste[k]>.6?'likes':taste[k]<.4?'avoids':'unsure'}}))}
  function paint(){opts.innerHTML='';meter();
    if(i>=Q.length){var good=taste.helpful>.6&&taste.honest>.6&&taste.safe>.6;q.innerHTML='The judge can now score a million answers without you.';
      s.say(good?'It learned to prefer helpful, honest and safe, only from which answer you picked. That score becomes the model\'s feedback.':'It learned exactly what you picked, good or bad. A judge is only as good as the people it watched.','ok');s.win();return}
    q.innerHTML='<span class="mut">'+(i+1)+' of '+Q.length+' ·</span> "'+esc(Q[i][0])+'"';
    [1,2].forEach(function(a){opts.appendChild(btn(esc(Q[i][a]),'opt',function(){var k=Q[i][4],right=(a-1)===Q[i][3];taste[k]=Math.max(.05,Math.min(.95,taste[k]+(right?(k==='helpful'?.2:.4):-.3)));i++;paint()}))});}
  paint();s.say('Nobody can write "helpful, honest and safe" as an answer key. So just pick the better answer.');
};
W.rubric=function(s){
  var L=[['Subject line is under 8 words',1,0],['Sounds professional',0],['Asks for exactly one thing',1,0],['Is a good email',0],['Says the date it is needed by',1,0],['Feels warm',0]],on={},list=h('div','fp-opts'),mail=h('div','fp-mail'),go;
  s.stage.appendChild(list);s.stage.appendChild(mail);
  mail.innerHTML='<p class="mut">The model\'s draft</p><p><b>Subject:</b> Quick question about the Q3 report and a few other things when you get a chance</p><p>Hope you are well. Could you send the Q3 numbers, and also look over the deck, and maybe join Thursday\'s call?</p>';
  L.forEach(function(l,i){var b=btn(l[0],'opt',function(){on[i]=!on[i];b.setAttribute('aria-pressed',on[i]?'true':'false');[].forEach.call(list.querySelectorAll('small'),function(x){x.remove()})});b.setAttribute('aria-pressed','false');list.appendChild(b)});
  go=s.btn('Score the draft','pri',function(){var pick=L.map(function(l,i){return on[i]?i:-1}).filter(function(i){return i>-1});
    if(pick.length!==3){s.say('Pick exactly three lines.');return}
    var vague=0;[].forEach.call(list.children,function(b,i){var o=b.querySelector('small');if(o)o.remove();if(!on[i])return;if(!L[i][1])vague++;b.appendChild(h('small',L[i][1]?'x':'q',L[i][1]?'fails: anyone can see it':'two readers would disagree'))});
    if(vague){s.say(vague+' of your lines cannot be checked by a stranger. Swap '+(vague>1?'them':'it')+' for one that can.');return}
    s.say('Scored 0 of 3, and anyone would score it the same. Now the draft can improve, and so can your prompt.','ok');s.win()});
  s.say('Pick the three lines a stranger could check.');
};

/* ================= 8. What LLMs learn from now ================= */
W.attempts=function(s){
  var habit,round,grid=h('div','fp-grid'),out=h('div');s.stage.appendChild(grid);s.stage.appendChild(out);
  function paint(cells,msg,c){grid.innerHTML=cells.map(function(x){return '<span class="'+(x.win?'win':'lose')+(x.chk?' chk':'')+'" title="'+(x.chk?'Paused and checked a step. ':'')+(x.win?'Right answer':'Wrong answer')+'">'+(x.win?'✓':'✗')+'</span>'}).join('');
    var w=cells.filter(function(x){return x.win}).length;
    out.innerHTML=(cells.length?'<p class="fp-out">Round '+round+': <b class="big">'+w+' of 16</b> reached the right answer</p>':'')+bars([{t:'How often it pauses to check a step',v:habit,on:true}]);s.say(msg,c)}
  function run(){round++;var cells=[];for(var i=0;i<16;i++){var chk=Math.random()<habit;cells.push({chk:chk,win:Math.random()<(chk?.99:.1)})}
    var Wn=cells.filter(function(x){return x.win}),L=cells.filter(function(x){return !x.win});
    if(!L.length){paint(cells,'All sixteen passed. No difference between winners and losers, so no nudge. This problem is used up.','ok');s.win();return}
    if(!Wn.length){paint(cells,'All sixteen failed. Nothing to tell good working from bad, so no nudge. Run it again.');return}
    var dw=Wn.filter(function(x){return x.chk}).length/Wn.length,dl=L.filter(function(x){return x.chk}).length/L.length;habit=Math.max(.03,Math.min(.995,habit+.3*(dw-dl)));
    paint(cells,'Every token in a winning attempt nudged up, every token in a losing one nudged down. Nobody read the working. The underlined attempts paused to check.')}
  function reset(){habit=.12;round=0;paint([],'Each right or wrong mark is one whole attempt: thousands of tokens of working. Only the last line is checked.')}
  s.btn('Run sixteen attempts','pri',run);s.btn('Start again','',reset);reset();
};
W.check=function(s){
  var step=0,rules=['The tests pass'],ADD=['The test files are unchanged','It also passes tests it has never seen'],
    OUT=['The model edited the tests so they pass.','The model wrote "if the input is 2, answer 4" for every case it could see.','The only way left to score was to do the job. It wrote code that works.'],
    list=h('div','fp-rub'),res=h('div','fp-two'),run,patch;
  s.stage.appendChild(list);s.stage.appendChild(res);
  function paint(r){list.innerHTML='<p class="mut">The check you wrote</p>'+rules.map(function(x){return '<p>'+(r==null?'☐ ':'☑ ')+x+'</p>'}).join('');
    res.innerHTML=r==null?'':'<div><span>Score</span><b class="big">100%</b><small>every line of your check passes</small></div><div><span>Code that works?</span><b class="big">'+(r===2?'yes':'no')+'</b><small>'+OUT[r]+'</small></div>'}
  run=s.btn('Let the model try','pri',function(){paint(step);run.disabled=true;
    if(step===2){s.say('Three lines to get what you meant by one. An honest check costs effort. A careless one costs more.','ok');s.win();return}
    patch.hidden=false;patch.textContent='Patch the check: '+ADD[step].charAt(0).toLowerCase()+ADD[step].slice(1);s.say('It scored full marks and missed the goal. It learned the check you wrote.')});
  patch=s.btn('','',function(){rules.push(ADD[step]);step++;patch.hidden=true;run.disabled=false;paint(null);s.say('Patched. Let it try again.')});
  patch.hidden=true;paint(null);s.say('The goal you meant: working code. The check you wrote: the tests pass.');
};

/* ================= shared scene types ================= */
/* guess: <ul><li>option</li>…</ul>, data-a = index of the right one. The explanation is the "found" block. */
W.guess=function(s){
  var ul=s.fig.querySelector('ul'),right=+s.fig.getAttribute('data-a'),r=h('div','fp-opts');
  /* a wrong pick crosses out only that option; the others stay open, so a second try is still a find */
  [].forEach.call(ul.children,function(li,i){var x=btn(li.innerHTML,'opt',function(){
    if(i===right){[].forEach.call(r.children,function(y,j){y.disabled=true;if(j===right)y.classList.add('right')});s.say('Right.','ok');s.win()}
    else{x.disabled=true;x.classList.add('wrong');s.say('Not that one. Think again and pick another.')}});r.appendChild(x)});
  ul.remove();s.stage.appendChild(r);
};
/* order: <ol><li data-label="shown once placed">item</li>…</ol> written in the right order */
W.order=function(s){
  var ol=s.fig.querySelector('ol'),items=[].map.call(ol.children,function(li,i){return {i:i,html:li.innerHTML,label:li.getAttribute('data-label')||''}}),placed=0,done=h('ol','fp-placed'),pool=h('div','fp-opts');
  ol.remove();s.stage.appendChild(done);s.stage.appendChild(pool);
  shuf(items).forEach(function(it){pool.appendChild(btn(it.html,'opt',function(){
    if(it.i!==placed){nope(this);s.say('Not yet. Something comes before that.');return}
    placed++;this.remove();done.appendChild(h('li',null,(it.label?'<small>'+it.label+'</small>':'')+it.html));
    if(placed===items.length){s.say(s.fig.getAttribute('data-end')||'In order.','ok');s.win()}else s.say('Yes. What comes next?')}))});
  s.say('Click them in order, first one first.');
};
/* match: <dl><dt>slot</dt><dd>what goes in it</dd>…</dl> */
W.match=function(s){
  var dl=s.fig.querySelector('dl'),rows=[].map.call(dl.querySelectorAll('dt'),function(dt){return {slot:dt.innerHTML,ans:dt.nextElementSibling.innerHTML}}),at=0,card=h('table','fp-t card'),pool=h('div','fp-opts');
  dl.remove();s.stage.appendChild(card);s.stage.appendChild(pool);
  function paint(){card.innerHTML=rows.map(function(r,i){return '<tr class="'+(i===at?'fp-at':'')+'"><th>'+r.slot+'</th><td>'+(i<at?r.ans:i===at?'?':'')+'</td></tr>'}).join('')}
  shuf(rows.map(function(r,i){return i})).forEach(function(i){pool.appendChild(btn(rows[i].ans,'opt',function(){
    if(i!==at){nope(this);s.say('That belongs in a different row.');return}
    at++;this.remove();paint();if(at===rows.length){s.say(s.fig.getAttribute('data-end')||'All filled in.','ok');s.win()}else s.say('Yes. Now: '+rows[at].slot.toLowerCase()+'?')}))});
  paint();s.say('Fill the highlighted row.');
};
/* sort: <ul><li data-a="0|1" data-why="…">item</li>…</ul>, data-bins="Left|Right" */
W.sort=function(s){
  var ul=s.fig.querySelector('ul'),Q=[].map.call(ul.children,function(li){return [li.innerHTML,+li.getAttribute('data-a'),li.getAttribute('data-why')||'']}),bins=(s.fig.getAttribute('data-bins')||'A|B').split('|');
  var i=0,score=0,q=h('p','fp-text'),a,c,next;ul.remove();s.stage.appendChild(q);
  function ans(v){if(a.disabled)return;var ok=Q[i][1]===v;if(ok)score++;s.say('<b>'+(ok?'Yes.':'Not quite.')+'</b> '+Q[i][2],ok?'ok':'');a.disabled=c.disabled=true;next.hidden=false;next.textContent=i===Q.length-1?'See the score':'Next'}
  function paint(){next.hidden=true;
    if(i>=Q.length){q.innerHTML='<b class="big">'+score+' of '+Q.length+'</b>';a.hidden=c.hidden=true;s.say(s.fig.getAttribute('data-end')||'','ok');s.win();return}
    a.disabled=c.disabled=false;q.innerHTML='<span class="mut">'+(i+1)+' of '+Q.length+' ·</span> '+Q[i][0];s.say('')}
  a=s.btn(bins[0],'',function(){ans(0)});c=s.btn(bins[1],'',function(){ans(1)});next=s.btn('Next','pri',function(){i++;paint()});paint();
};

/* ================= still pictures used inside the "found" blocks ================= */
PIC.clock=function(el){var rows=[['add two numbers','1 second',0],['your message on the workbench','5 minutes',2.48],['a copy saved to phone storage','3 days',5.41],['a spinning disk far away','1 year',7.5]],sh='',tx='';
  rows.forEach(function(r,i){var y=22+i*40;sh+=R(250,y,8+r[2]*36,22,i?'f-det':'f-card',4);tx+=T(240,y+18,r[0],'xs r')+T(268+r[2]*36,y+19,r[1],'s l')});
  draw(el,600,206,sh,tx+T(250,198,'each step along the bar is ten times longer','xs l c-mute'),'How long each action takes when one tick of the chip is slowed to one second');};
PIC.wait=function(el){draw(el,600,112,R(200,16,2,24,'fill-det',0)+R(200,62,380,24,'f-prob',4),T(190,36,'doing the maths','xs r')+T(212,36,'1 second','s l')+T(190,82,'waiting for the dials','xs r')+T(390,81,'5 minutes','s')+T(200,108,'on the slowed-down clock, drawn to scale','xs l c-mute'),'One second of maths against five minutes of waiting, drawn to scale')};
PIC.stack=function(el){var sh=R(210,8,180,34,'f-card')+P('M300 44V58','arw')+R(170,62,260,34,'f-det')+P('M300 98V112','arw')+R(110,116,150,56,'f-card')+R(270,116,220,56,'f-prob')+R(96,106,408,76,'dash',10)+P('M300 184V198','arw')+R(190,202,220,34,'f-card');
  draw(el,600,244,sh,T(300,32,'tokens','s')+T(300,86,'spots on the map + position stamps','xs')+T(185,150,'listen','s')+T(380,142,'think','s')+T(380,164,'2 of every 3 dials','xs c-prob')+T(540,150,'× 96','m')+T(300,226,'50,000 chances','s'),'The stack: tokens, the map, ninety-six layers of listen then think, and fifty thousand chances');};
PIC.quiz=function(el){draw(el,600,140,R(150,8,360,124,'f-card',8)+P('M150 46H510','thin'),
  T(140,36,'you typed','xs r c-mute')+T(166,36,'1. What is the capital of France?','xs l')+T(140,78,'it carries on','xs r c-prob')+T(166,78,'2. What is the capital of Germany?','xs l c-prob')+T(166,110,'3. What is the capital of Italy?','xs l c-prob'),'A quiz page: your question, then the model continuing with two more questions')};
PIC.recipe=function(el){var sh='',tx='';[['pre-training','the text itself','a guesser','f-card'],['fine-tuning','an answer a person wrote','question, answer, stop','f-det'],['RLHF','a judge\'s score','helpful, honest, safe','f-prob']].forEach(function(r,i){var x=10+i*200;sh+=R(x,34,180,46,r[3])+(i<2?P('M'+(x+182)+' 57H'+(x+197),'arw'):'');tx+=T(x+90,24,r[0],'s')+T(x+90,64,r[1],'xs')+T(x+90,106,r[2],'xs c-mute')});
  draw(el,600,116,sh,tx,'Three stages: pre-training, fine-tuning, RLHF, and who gives the feedback in each')};
PIC.env=function(el){draw(el,600,150,R(150,30,270,104,'dash',10)+R(166,70,70,46,'f-card')+R(248,70,84,46,'f-card')+R(344,70,62,46,'f-card')+P('M96 92H144','arw')+P('M424 92H452','arw')+R(458,56,132,72,'f-hum'),
  T(285,54,'a copy of a workplace','xs')+T(201,99,'email','xs')+T(290,99,'documents','xs')+T(375,99,'tools','xs')+T(50,98,'a task','s')+T(524,86,'a program checks','xs')+T(524,108,'what changed','xs'),'An environment: a task goes into a copy of a workplace, and a program checks what changed')};

/* ================= the engine ================= */
/* ---------- the course: one lesson per page, a table of contents with ticks ----------
   A lesson with a scene is done when its scene is found (2, green tick) or its answer was shown (1, grey tick).
   A lesson without one (Check yourself) is done once it has been opened. Visits save under c8.fpv. */
var VKEY='c8.fpv',V=store.get(VKEY,{})||{};
function here(){return location.pathname.replace(/\.html$/,'').replace(/\/index$/,'').replace(/\/$/,'')||'/'}
function lessonState(li){var sc=li.getAttribute('data-scene');return sc?(ST[sc]||0):(V[li.getAttribute('data-href')]?2:0)}
function paintToc(){
  var chs=[].slice.call(document.querySelectorAll('.fp-ch>li[data-ch]'));if(!chs.length)return;
  var me=here(),total=0,doneN=0,firstOpen=null,earned={},doneCh={};
  /* the drawer and the course home both list every lesson; count once, from the first list */
  var counted=document.querySelector('.fp-ch');
  chs.forEach(function(fl){
    var ls=[].slice.call(fl.querySelectorAll('.fp-ls>li')),d=0,won=0,sceneN=0,sceneWon=0;
    ls.forEach(function(li){var s=lessonState(li);li.classList.toggle('won',s===2);li.classList.toggle('seen',s===1);
      var on=li.getAttribute('data-href')===me;li.classList.toggle('here',on);var a=li.querySelector('a');if(on)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
      if(s)d++;if(s===2)won++;if(li.hasAttribute('data-scene')){sceneN++;if(ST[li.getAttribute('data-scene')]===2)sceneWon++}
      if(fl.parentNode===counted){total++;if(s)doneN++;else if(!firstOpen)firstOpen=li}});
    fl.classList.toggle('won',d===ls.length&&won===ls.length);fl.classList.toggle('seen',d===ls.length&&won<ls.length);fl.classList.toggle('half',d>0&&d<ls.length);
    var c=fl.querySelector('[data-count]');if(c)c.textContent=d?d+' of '+ls.length:ls.length+' lessons';
    fl.style.setProperty('--p',d/ls.length);
    if(sceneN&&sceneWon===sceneN)earned[fl.getAttribute('data-ch')]=1;
    if(d===ls.length)doneCh[fl.getAttribute('data-ch')]=1;
  });
  /* the lesson to do now gets a "next" chip in every list */
  [].forEach.call(document.querySelectorAll('.fp-ls>li.up'),function(li){li.classList.remove('up')});
  if(firstOpen)[].forEach.call(document.querySelectorAll('.fp-ls>li[data-href="'+firstOpen.getAttribute('data-href')+'"]'),function(li){li.classList.add('up')});
  [].forEach.call(document.querySelectorAll('[data-sum]'),function(el){el.textContent=doneN?doneN+' of '+total+' done':total+' lessons'});
  /* course home: a principle shows once its chapter is done (marked "found" if every drawing was played); the whole chain at the very end */
  [].forEach.call(document.querySelectorAll('[data-earn]'),function(li){var c=li.getAttribute('data-earn');li.hidden=!doneCh[c];li.classList.toggle('earned',!!earned[c])});
  [].forEach.call(document.querySelectorAll('[data-found]'),function(el){el.hidden=!Object.keys(doneCh).length});
  [].forEach.call(document.querySelectorAll('[data-finish]'),function(el){el.hidden=!(total&&doneN===total)});
  var go=document.querySelector('[data-continue]');
  if(go){var t=firstOpen||counted.querySelector('.fp-ls>li');var n=t.querySelector('.n').textContent,ti=t.querySelector('.t').textContent;
    go.href=t.getAttribute('data-href');var gl=go.querySelector('[data-go]');(gl||go).textContent=!doneN?'Start the course':firstOpen?'Continue':'Start again';
    var up=document.querySelector('[data-upto]'),ul=document.querySelector('[data-uplab]');
    if(up){up.href=go.href;up.innerHTML='<span class="n"></span> ';up.firstChild.textContent=n;up.appendChild(document.createTextNode(ti))}
    if(ul)ul.textContent=!doneN?'First':firstOpen?'Next':'Again from';
    var cta=go.closest('.fp-cta');if(cta)cta.style.setProperty('--p',total?doneN/total:0);if(cta)cta.classList.toggle('begun',doneN>0);
    var f=t.closest('[data-ch]').getAttribute('data-ch');if(doneN)[].forEach.call(document.querySelectorAll('.fp-ch>li[data-ch="'+f+'"]>details'),function(d){d.open=true})}
  /* course home: the road lights the chapters done and the one to do now; only that chapter's card starts open */
  var nowCh=firstOpen?firstOpen.closest('[data-ch]').getAttribute('data-ch'):null,road=0;
  [].forEach.call(document.querySelectorAll('.fp-road .stop'),function(g){var n=g.getAttribute('data-node');g.classList.toggle('done',!!doneCh[n]);g.classList.toggle('now',doneN>0&&n===nowCh);if(doneCh[n]&&+n>road)road=+n});
  [].forEach.call(document.querySelectorAll('.fp-road'),function(sv){sv.style.setProperty('--road',road/8)});
  if(doneN&&!paintToc.once){paintToc.once=1;[].forEach.call(document.querySelectorAll('.fp-outline>li>details'),function(d){d.open=d.parentNode.getAttribute('data-ch')===(nowCh||'1')})}
}
/* term reminders: an underlined word shows its one-line meaning and where it was first explained */
function termTips(){
  var tip=null,at=null;
  function close(){if(tip){tip.remove();tip=null}if(at){at.setAttribute('aria-expanded','false');at=null}}
  function open(b){close();at=b;b.setAttribute('aria-expanded','true');
    tip=h('div','fp-tip','<b>'+esc(b.getAttribute('data-term'))+'</b><span>'+esc(b.getAttribute('data-def'))+'</span><a href="'+esc(b.getAttribute('data-from'))+'">First explained in '+esc(b.getAttribute('data-fromt'))+'</a>');
    tip.setAttribute('role','tooltip');document.body.appendChild(tip);
    var r=b.getBoundingClientRect(),w=tip.offsetWidth,x=Math.max(12,Math.min(innerWidth-w-12,r.left+r.width/2-w/2)),y=r.bottom+8;
    if(y+tip.offsetHeight>innerHeight-8&&r.top>tip.offsetHeight+16)y=r.top-tip.offsetHeight-8;
    tip.style.left=x+scrollX+'px';tip.style.top=y+scrollY+'px'}
  document.addEventListener('click',function(e){var b=e.target.closest('.fp-term');if(b){e.preventDefault();if(at===b)close();else open(b);return}if(tip&&!tip.contains(e.target))close()});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&tip){var b=at;close();if(b)b.focus()}});
  addEventListener('resize',close);
  [].forEach.call(document.querySelectorAll('.fp-term'),function(b){b.setAttribute('aria-expanded','false');b.title='What does this mean?'});
}
/* end of a chapter: on its Check yourself page, say what was found and link what is still to play */
function chapterDone(){
  var el=document.querySelector('[data-chdone]');if(!el)return;var n=el.getAttribute('data-chdone');
  var ls=[].slice.call(document.querySelectorAll('#fp-toc .fp-ch>li[data-ch="'+n+'"] .fp-ls>li[data-scene]'));if(!ls.length)return;
  var won=ls.filter(function(li){return ST[li.getAttribute('data-scene')]===2}),open=ls.filter(function(li){return ST[li.getAttribute('data-scene')]!==2});
  function link(li){return '<a href="'+li.getAttribute('data-href')+'">'+esc(li.querySelector('.n').textContent+' '+li.querySelector('.t').textContent)+'</a>'}
  /* one link to the next drawing, never the whole list; the rest are ticked in Contents */
  var more=open.length>1?' Then '+(open.length-1)+' more, marked in Contents.':'';
  /* a title that ends in "?" takes no full stop after it */
  function first(){var t=open[0].querySelector('.t').textContent;return link(open[0])+(/[?!.]$/.test(t.trim())?'':'.')}
  el.innerHTML='<p class="kick">End of chapter '+n+'</p><p>'+(!open.length?'You found <b>all '+ls.length+'</b> by playing. This chapter is done.'
    :!won.length?'This chapter has <b>'+ls.length+' drawings</b> to play. Start with '+first()+more
    :'You found <b>'+won.length+' of '+ls.length+'</b> by playing. Next to play: '+first()+more)+'</p>';
  el.classList.toggle('all',!open.length);el.hidden=false;
}
function drawer(){
  var b=document.querySelector('.fp-menu'),p=document.getElementById('fp-toc'),sc=document.querySelector('.fp-scrim'),from=b;if(!b||!p)return;
  function set(open){p.hidden=sc.hidden=!open;b.setAttribute('aria-expanded',open);document.body.classList.toggle('fp-locked',open);
    if(open){var cur=p.querySelector('li.here a')||p.querySelector('a');requestAnimationFrame(function(){p.classList.add('on');if(cur){cur.focus({preventScroll:true});cur.scrollIntoView({block:'center'})}})}else{p.classList.remove('on');from.focus()}}
  [].forEach.call(document.querySelectorAll('.fp-menu'),function(t){t.addEventListener('click',function(){from=t;set(p.hidden)})});
  sc.addEventListener('click',function(){set(false)});
  p.querySelector('[data-close]').addEventListener('click',function(){set(false)});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!p.hidden)set(false)});
}
/* A scene is one card, read top to bottom: status + goal, what to do now (the note), the drawing, the buttons,
   and at the bottom of the same card a shut line that becomes "What you just found". Next lives in the bottom bar only. */
function ready(){var nx=document.querySelector('[data-next]');if(nx)nx.classList.add('ready')}
function paintParts(){paintToc()}
var seenIO=('IntersectionObserver' in window)?new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;seenIO.unobserve(e.target);
  if(e.target.classList.contains('fp-fresh')){e.target.classList.add('fp-hint');setTimeout(function(){e.target.classList.remove('fp-hint')},2400)}})},{threshold:.6}):null;
function mount(fig){
  var fn=W[fig.getAttribute('data-fp')];if(!fn)return;
  var id=fig.id,body=h('div','fp-b'),stage=h('div','fp-stage'),ctl=h('div','fp-row'),opt=h('div','fp-row fp-opt'),note=h('p','fp-note'),skip=h('button','fp-skip','Skip to the explanation');
  var found=fig.nextElementSibling,lock=null;if(!found||!found.classList.contains('found'))found=null;
  body.appendChild(note);body.appendChild(opt);body.appendChild(stage);body.appendChild(ctl);fig.appendChild(body);skip.type='button';
  if(found)fig.appendChild(found);
  /* the explanation is "What you just found" only when it was found; opened by skipping, it is just "The explanation" */
  var kick=found&&found.querySelector('.kick');
  function open(v,quiet){if((ST[id]||0)<v){ST[id]=v;store.set(KEY,ST)}fig.classList.add('done');fig.classList.remove('fp-fresh','fp-hint');fig.classList.toggle('won',ST[id]===2);skip.hidden=true;
    if(kick)kick.textContent=ST[id]===2?'What you just found':'The explanation';
    if(lock){lock.remove();lock=null}
    if(found&&found.hidden){found.hidden=false;if(!quiet)found.classList.add('fp-pop')}ready();paintParts()}
  skip.addEventListener('click',function(){open(1);note.className='fp-note';note.innerHTML='<span>The explanation is open below. Play the drawing any time to find it yourself.</span>'});
  if(found){found.hidden=true;lock=h('p','fp-lock','Reach the goal and the explanation opens here.');fig.insertBefore(lock,found)}
  fn({fig:fig,id:id,stage:stage,ctl:ctl,
    say:function(m,c){note.innerHTML=m?'<span>'+m+'</span>':'';note.className='fp-note'+(c?' '+c:'')},
    win:function(){open(2)},seen:function(){open(1)},
    btn:function(l,c,f){var b=btn(l,c,f);ctl.appendChild(b);return b},
    add:function(el){opt.appendChild(el);return el}});
  ctl.appendChild(skip);
  /* back on a lesson already played: say so, instead of repeating the first instruction */
  if(ST[id]){open(ST[id],true);ST[id]===2?note.className='fp-note ok':note.className='fp-note';note.innerHTML='<span>'+(ST[id]===2?'You found this earlier. Play it again if you like.':'You skipped to the explanation earlier. Play the drawing to find it yourself.')+'</span>'}
  else{fig.classList.add('fp-fresh');
    var first=function(){fig.classList.remove('fp-fresh','fp-hint');fig.removeEventListener('pointerdown',first);fig.removeEventListener('keydown',first)};
    fig.addEventListener('pointerdown',first);fig.addEventListener('keydown',first);if(seenIO)seenIO.observe(fig)}
}
document.addEventListener('DOMContentLoaded',function(){
  defs();
  if(document.querySelector('.fp-lesson')){V[here()]=1;store.set(VKEY,V)}
  [].forEach.call(document.querySelectorAll('figure.fp[data-fp]'),mount);
  [].forEach.call(document.querySelectorAll('[data-pic]'),function(el){var fn=PIC[el.getAttribute('data-pic')];if(fn)fn(el)});
  /* a lesson without a scene (Check yourself) has nothing to win: Next is ready from the start */
  var nx=document.querySelector('[data-next]');if(nx&&!document.querySelector('.fp-lesson figure.fp'))nx.classList.add('ready');
  paintToc();drawer();chapterDone();termTips();
  /* two clicks, not a browser dialog: the first arms the button, the second clears */
  var rs=document.querySelector('[data-fpreset]');if(rs)rs.addEventListener('click',function(){
    if(!rs.classList.contains('arm')){rs.classList.add('arm');rs.textContent='Click again to clear your progress';setTimeout(function(){rs.classList.remove('arm');rs.textContent='Clear my progress and start again'},4000);return}
    ST={};V={};store.set(KEY,ST);store.set(VKEY,V);location.reload()});
});
})();
