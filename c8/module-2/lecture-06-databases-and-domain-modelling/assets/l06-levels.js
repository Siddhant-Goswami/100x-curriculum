/* Lecture 6 · The Modelling Lab · the rules of the game.
   Pure functions over the saved state S (c8.l06.lab) and the data (window.L06).
   Shared by the lab page, the practice set page (which ticks the deliverables the lab has earned)
   and the tests. No DOM here. Load after l06-data.js and l06-grader.js. */
(function(root){
  var D=root.L06, C=root.L06Check;

  var LEVELS=[
    {n:1,sec:'s1',q:'Question 1',title:'Find the things',desc:'Thirteen words are highlighted in Aarav\'s chat. Call each one a thing or a fact and uncover the six blocks worth storing.',meta:'13 words · 6 hidden blocks · about 5 minutes'},
    {n:2,sec:'s2',q:'Question 2',title:'Fill the blocks',desc:'Nine fact cards. Stick each one on the block it describes, and hold back the one that fits no column.',meta:'9 cards · 6 blocks · about 5 minutes'},
    {n:3,sec:'s3',q:'Question 3',title:'Connect the blocks',desc:'Five pairs of blocks. Ask two questions about each pair, then place the pointer that links them.',meta:'5 pairs · about 15 minutes'},
    {n:4,sec:'s4',q:'',title:'Rows or files',desc:'Eight things Aarav\'s app keeps. Sort each into a cell in a row, or a file in storage with its link in a row.',meta:'8 cards · about 4 minutes'},
    {n:5,sec:'s5',q:'Boss level',title:'Can the model answer?',desc:'Answer three of the product\'s questions by following the arrows on your board, then land four API addresses on their blocks.',meta:'3 questions · 4 addresses · about 6 minutes'},
    {n:6,sec:'s6',q:'',title:'The Arena',desc:'Six briefs, one brick each. Build the tables from a blank page, then check them.',meta:'6 briefs · about 45 minutes'},
    {n:7,sec:'s7',q:'',title:'Your model',desc:'The same bricks, for the app on your HLD.',meta:''}
  ];
  var CORE=D.BRIEFS.filter(function(b){ return !b.stretch; });

  /* ---------- scoring: the same in every level ---------- */
  function stars(miss){ miss=miss||0; return miss<=1?3:miss<=4?2:1; }
  /* +10 a right call, +5 if that item was missed before, +5 more on a streak of three or longer */
  function gain(missedBefore,streak){ return (missedBefore?5:10)+(streak>=3?5:0); }
  /* the Arena: 50 for a model that passes, minus 10 per failed check or opened hint, never below 20 */
  function solvePts(a){ a=a||{}; return Math.max(20,50-10*((a.miss||0)+Object.keys(a.hints||{}).length)); }

  /* ---------- what the student has placed ---------- */
  function tagRight(S,id){ var t=D.TOKENS[id], c=(S.tags||{})[id]; return !!t && !!c && (c===t.role || (t.role==='file'&&c==='thing')); }
  function foundEnt(S,e){ var tags=S.tags||{}; return Object.keys(tags).some(function(id){ var t=D.TOKENS[id]; return t && t.ent===e && t.role==='thing' && tags[id]==='thing'; }); }
  function blocksFound(S){ return D.TARGET_ENTITIES.filter(function(e){ return foundEnt(S,e); }).length; }
  function pairById(id){ return D.PAIRS.find(function(p){ return p.id===id; }); }
  function shapeKnown(S,p){ var d=(S.dir||{})[p.id]||{}; return d.ab===p.ab && d.ba===p.ba; }
  function keyOk(S,p){
    var k=(S.keys||{})[p.id]; if(!k) return false;
    if(p.shape==='many-to-many') return !!k.join && (C.nameEq(k.join,p.join.table) || /workflow.*tool|tool.*workflow/i.test(k.join)) && C.nameEq(k.c1,p.join.cols[0]) && C.nameEq(k.c2,p.join.cols[1]);
    return k.table===p.fk.table && C.nameEq(k.name,p.fk.name);
  }
  function linked(S,p){ return shapeKnown(S,p) && keyOk(S,p); }
  function bossKeys(){ return D.BOSS.qs.map(function(q,i){ return 'q'+i; }).concat(D.BOSS.bridge.map(function(b,i){ return 'b'+i; })); }

  /* ---------- a level is done when its state is complete, never by a self-tick ---------- */
  function yoursParts(S,ck){
    var bp=S.bp||{}; ck=ck||{};
    var sch=((S.schemas||{}).myapp)||[];
    return {
      written:['desc','q1','q2','q3'].every(function(k){ return (bp[k]||'').trim(); }),
      tables:sch.filter(function(t){ return t.name && t.columns.some(function(c){ return c.name; }); }).length>=2,
      bridge:['files','api'].every(function(k){ return (bp[k]||'').trim(); }),
      checks:['c7a','c7b','c7c','c7d','c7e'].every(function(k){ return !!ck[k]; })
    };
  }
  function progress(n,S,ck){
    if(n===1) return [D.TOKEN_ORDER.filter(function(id){ return tagRight(S,id); }).length, D.TOKEN_ORDER.length];
    if(n===2) return [D.FACTS.filter(function(f){ return (S.facts||{})[f.id]===f.ent; }).length, D.FACTS.length];
    if(n===3) return [D.PAIRS.filter(function(p){ return linked(S,p); }).length, D.PAIRS.length];
    if(n===4) return [D.STORE_CARDS.filter(function(c){ return (S.sort||{})[c.id]===c.where; }).length, D.STORE_CARDS.length];
    if(n===5){ var b=(S.boss||{}).done||{}, ks=bossKeys(); return [ks.filter(function(k){ return b[k]; }).length, ks.length]; }
    if(n===6) return [CORE.filter(function(b){ return (S.solved||{})[b.id]; }).length, CORE.length];
    var y=yoursParts(S,ck); return [['written','tables','bridge','checks'].filter(function(k){ return y[k]; }).length, 4];
  }
  function done(n,S,ck){ var p=progress(n,S,ck); return p[0]===p[1]; }
  /* the next level to play: the first one not done; 0 when the run is complete */
  function next(S,ck){ for(var n=1;n<=7;n++) if(!done(n,S,ck)) return n; return 0; }
  /* what a level builds on: the levels that read the board need the six blocks from Level 1 */
  function needs(n,S){ return (n===2||n===3) && blocksFound(S)<D.TARGET_ENTITIES.length ? 1 : 0; }

  function arenaRec(S,id){ return ((S.arena||{})[id])||{}; }
  function arenaStars(S,id){
    if(!(S.solved||{})[id]) return 0;
    var a=arenaRec(S,id), s=stars((a.miss||0)+Object.keys(a.hints||{}).length);
    return a.loaded?Math.min(2,s):s;
  }
  function arenaPts(S,id){ if(!(S.solved||{})[id]) return 0; var a=arenaRec(S,id); return a.pts!=null?a.pts:50; }
  function levelStars(n,S,ck){
    if(!done(n,S,ck)) return 0;
    if(n===6) return Math.round(CORE.reduce(function(t,b){ return t+arenaStars(S,b.id); },0)/CORE.length);
    if(n===7) return 3;
    return stars(((S.lv||{})[n]||{}).miss);
  }
  function levelPts(n,S,ck){
    if(n===6) return D.BRIEFS.reduce(function(t,b){ return t+arenaPts(S,b.id); },0);
    if(n===7) return done(7,S,ck)?50:0;
    return ((S.lv||{})[n]||{}).pts||0;
  }
  /* the practice set's deliverables 2 to 4 tick themselves from these */
  function deliverables(S,ck){ return {d2:done(5,S,ck), d3:done(6,S,ck), d4:done(7,S,ck)}; }

  /* older saves: the Question 1 score lived in S.g1 */
  function migrate(S){
    S=S&&typeof S==='object'?S:{};
    ['think','tags','facts','shapes','dir','keys','sort','schemas','solved','bp','lv','arena'].forEach(function(k){ if(!S[k]||typeof S[k]!=='object') S[k]={}; });
    if(S.g1 && !S.lv[1]) S.lv[1]={pts:S.g1.pts||0,miss:S.g1.miss||0,streak:S.g1.streak||0,missed:S.g1.missed||{},best:S.g1.best||0};
    for(var n=1;n<=5;n++){ var L=S.lv[n]=S.lv[n]||{}; ['pts','miss','streak'].forEach(function(k){ if(typeof L[k]!=='number') L[k]=0; }); if(!L.missed||typeof L.missed!=='object') L.missed={}; if(!L.bonus||typeof L.bonus!=='object') L.bonus={}; }
    if(!S.boss||typeof S.boss!=='object') S.boss={}; if(!S.boss.done||typeof S.boss.done!=='object') S.boss.done={};
    return S;
  }

  /* ---------- Aarav's board, laid out: blocks, columns and pointers at a stage ----------
     stage 2 facts, 3 pointers, 5 everything (dashed pieces link back to the level that places them).
     A block the student has not found in Level 1 is a "?" until stage 5, and never a target before it. */
  var G={BW:150,HD:36,RH:26,GX:[16,210,404,598],GAP:44};
  function tH(t){ return G.HD+Math.max(t.cols.length,1)*G.RH+10; }
  function rY(t,i){ return t.y+G.HD+5+i*G.RH+G.RH/2; }
  function grid(tables,pos){
    var rows={}; tables.forEach(function(t){ var p=pos(t); t.x=G.GX[p[0]]; t.w=t.w||G.BW; (rows[p[1]]=rows[p[1]]||[]).push(t); });
    var y=14; Object.keys(rows).sort(function(a,b){ return a-b; }).forEach(function(r){ var mh=0; rows[r].forEach(function(t){ t.y=y; mh=Math.max(mh,tH(t)); }); y+=mh+G.GAP; });
  }
  var POS={users:[0,0],conversations:[1,0],messages:[2,0],attachments:[3,0],diagnoses:[0,1],workflows:[1,1],workflow_tools:[2,1],tools:[3,1]};
  function aaravTables(stage,S,o){
    o=o||{}; var reveal=stage>=5, tables=[], facts=S.facts||{}, sort=S.sort||{};
    D.AARAV_MODEL.forEach(function(m){
      if(m.name==='attachments'&&stage<5){
        if(stage===2) tables.push({name:'attachments',title:'hold for level 4',hold:true,box:o.targets?'hold':'',empty:'?',cols:D.FACTS.filter(function(f){ return f.ent==='hold'&&facts[f.id]==='hold'; }).map(function(f){ return {n:f.id,k:'file'}; })});
        return;
      }
      if(m.name==='workflow_tools'&&stage<3) return;
      var found=m.src.ent ? foundEnt(S,D.TOKENS[m.src.ent].ent) : m.src.sort ? sort[m.src.sort]==='file' : m.src.pair ? keyOk(S,pairById(m.src.pair)) : true;
      if(!found && !reveal){
        if(m.src.ent) tables.push({name:m.name,title:'?',cols:[],ghost:'1',empty:'find it in level 1'});
        return;
      }
      var cols=[];
      if(stage>1) m.cols.forEach(function(c){
        var nm=c[0], kind=c[1], src=c[3]||{}, ok=true, lk='';
        if(stage<3&&(kind||!src.fact)) return;
        if(src.fact){ ok=facts[src.fact]===m.name; lk='#s2'; }
        else if(src.pair){ ok=keyOk(S,pairById(src.pair)); lk='#s3'; }
        else if(src.sort){ ok=sort[src.sort]===(src.sort==='meta'?'row':'file'); lk='#s4'; }
        if(!ok&&!reveal) return;
        cols.push({n:nm,k:kind||(nm==='file_url'?'file':''),ref:c[2]||'',miss:ok?'':lk});
      });
      tables.push({name:m.name,cols:cols,box:o.targets?m.name:'',ghost:found?'':(m.src.ent?'#s1':m.src.sort?'#s4':'#s3'),
        empty:found?(stage===2?(m.cols.some(function(c){ return c[3]&&c[3].fact; })?'+ facts':'just its name'):''):'not found yet'});
    });
    grid(tables,function(t){ return POS[t.name]; });
    return tables;
  }

  root.L06Lv={LEVELS:LEVELS,CORE:CORE,G:G,tH:tH,rY:rY,grid:grid,
    stars:stars,gain:gain,solvePts:solvePts,
    tagRight:tagRight,foundEnt:foundEnt,blocksFound:blocksFound,pairById:pairById,shapeKnown:shapeKnown,keyOk:keyOk,linked:linked,bossKeys:bossKeys,
    yoursParts:yoursParts,progress:progress,done:done,next:next,needs:needs,
    arenaRec:arenaRec,arenaStars:arenaStars,arenaPts:arenaPts,levelStars:levelStars,levelPts:levelPts,deliverables:deliverables,
    migrate:migrate,aaravTables:aaravTables};
})(typeof window!=='undefined'?window:this);
