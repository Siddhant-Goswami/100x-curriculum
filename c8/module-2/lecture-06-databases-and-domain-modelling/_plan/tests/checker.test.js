/* Run with: node --test c8/module-2/lecture-06-databases-and-domain-modelling/_plan/tests/checker.test.js
   Loads the lab's data and checker the way the page does (plain scripts), then checks a few models. */
const test=require('node:test'); const assert=require('node:assert'); const fs=require('fs'); const path=require('path'); const vm=require('vm');
const ctx={window:{}}; ctx.window=ctx;
for(const f of ['l06-data.js','l06-grader.js','l06-levels.js']) vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../assets',f),'utf8'),ctx);
const D=ctx.L06, check=ctx.L06Check.check, LV=ctx.L06Lv;
const col=(n,o={})=>Object.assign({id:'c_'+n+Math.random(),name:n,type:'text',primary:false,foreign:false,fkRef:'',required:true,unique:false},o);
const T=(name,cols)=>({id:'t_'+name,name,columns:cols});
const brief=id=>D.BRIEFS.find(b=>b.id===id);

test('pet clinic: pointer on the many side is done',()=>{
  const r=check([T('owners',[col('id',{primary:true}),col('name')]),T('pets',[col('id',{primary:true}),col('name'),col('owner_id',{foreign:true,fkRef:'t_owners'})])],brief('petclinic'));
  assert.equal(r.done,true);
});
test('pet clinic: pointer on the one side is a cross',()=>{
  const r=check([T('owners',[col('id',{primary:true}),col('name'),col('pet_id',{foreign:true,fkRef:'t_pets'})]),T('pets',[col('id',{primary:true}),col('name')])],brief('petclinic'));
  assert.equal(r.done,false);
  assert.ok(r.checks.some(c=>!c.ok && /wrong way/.test(c.html)));
});
test('bakery: missing quantity blocks done',()=>{
  const r=check([T('customers',[col('id',{primary:true}),col('name')]),T('products',[col('id',{primary:true}),col('name')]),T('orders',[col('id',{primary:true}),col('customer_id',{foreign:true,fkRef:'t_customers'})]),T('order_items',[col('id',{primary:true}),col('order_id',{foreign:true,fkRef:'t_orders'}),col('product_id',{foreign:true,fkRef:'t_products'})])],brief('bakery'));
  assert.equal(r.done,false); assert.ok(r.checks.some(c=>!c.ok && /quantity/.test(c.html)));
});
test('linkedin: one summary per post needs unique',()=>{
  const base=()=>[T('users',[col('id',{primary:true})]),T('templates',[col('id',{primary:true}),col('user_id',{foreign:true,fkRef:'t_users'})]),T('posts',[col('id',{primary:true}),col('user_id',{foreign:true,fkRef:'t_users'}),col('template_id',{foreign:true,fkRef:'t_templates'}),col('status')])];
  const a=base(); a.push(T('post_analytics',[col('id',{primary:true}),col('post_id',{foreign:true,fkRef:'t_posts'})]));
  assert.equal(check(a,brief('linkedin')).done,false);
  const b=base(); b.push(T('post_analytics',[col('id',{primary:true}),col('post_id',{foreign:true,fkRef:'t_posts',unique:true})]));
  assert.equal(check(b,brief('linkedin')).done,true);
});
test('synonyms and plurals match',()=>{
  const r=check([T('owner',[col('id',{primary:true}),col('name')]),T('animals',[col('id',{primary:true}),col('name'),col('owner_id',{foreign:true,fkRef:'owner'})])],brief('petclinic'));
  assert.equal(r.done,true);
});
test('suggestions never block done',()=>{
  const r=check([T('owners',[col('id',{primary:true}),col('name')]),T('pets',[col('id',{primary:true}),col('name'),col('owner_id',{foreign:true,fkRef:'t_owners'})])],brief('petclinic'));
  assert.ok(r.suggestions.length>0); assert.equal(r.done,true);
});

/* ---------- the levels ---------- */
const solvedState=()=>{
  const S=LV.migrate({});
  D.TOKEN_ORDER.forEach(id=>{ const t=D.TOKENS[id]; S.tags[id]=t.role==='file'?'thing':t.role; });
  D.FACTS.forEach(f=>{ S.facts[f.id]=f.ent; });
  D.PAIRS.forEach(p=>{ S.dir[p.id]={ab:p.ab,ba:p.ba}; S.keys[p.id]=p.join?{join:p.join.table,c1:p.join.cols[0],c2:p.join.cols[1]}:{table:p.fk.table,name:p.fk.name}; });
  D.STORE_CARDS.forEach(c=>{ S.sort[c.id]=c.where; });
  LV.bossKeys().forEach(k=>{ S.boss.done[k]=true; });
  return S;
};
test('stars: 0 or 1 miss is 3, up to 4 is 2, more is 1',()=>{
  assert.deepEqual([0,1,2,4,5,9].map(LV.stars),[3,3,2,2,1,1]);
});
test('scoring: +10, +5 on a retry, +5 more on a streak of three',()=>{
  assert.equal(LV.gain(false,1),10); assert.equal(LV.gain(true,1),5); assert.equal(LV.gain(false,3),15); assert.equal(LV.gain(true,4),10);
});
test('arena points: 50, minus 10 per failed check or hint, never below 20',()=>{
  assert.equal(LV.solvePts({}),50); assert.equal(LV.solvePts({miss:1,hints:{0:1}}),30); assert.equal(LV.solvePts({miss:9}),20);
});
test('arena stars: a loaded board caps the brief at 2',()=>{
  const S=LV.migrate({solved:{aarav:true},arena:{aarav:{loaded:1}}});
  assert.equal(LV.arenaStars(S,'aarav'),2); assert.equal(LV.arenaStars(S,'petclinic'),0);
});
test('unlock order: the next level is the first one not done',()=>{
  const S=LV.migrate({});
  assert.equal(LV.next(S,{}),1);
  const T=solvedState();
  assert.equal(LV.next(T,{}),6);
  [1,2,3,4,5].forEach(n=>assert.equal(LV.done(n,T,{}),true));
  delete T.facts.tone; assert.equal(LV.next(T,{}),2);
});
test('level 2 and 3 need the six blocks from level 1',()=>{
  const S=LV.migrate({}); assert.equal(LV.needs(2,S),1); assert.equal(LV.needs(3,S),1); assert.equal(LV.needs(4,S),0);
  assert.equal(LV.needs(2,solvedState()),0);
});
test('stage 2 board: an unfound block is a "?" and never a target',()=>{
  const S=LV.migrate({});
  const users=LV.aaravTables(2,S,{targets:true}).find(t=>t.name==='users');
  assert.equal(users.title,'?'); assert.ok(!users.box);
  S.tags.aarav='thing';
  const u2=LV.aaravTables(2,S,{targets:true}).find(t=>t.name==='users');
  assert.equal(u2.title,undefined); assert.equal(u2.box,'users');
});
test('stage 5 board: everything is drawn and every block is a target',()=>{
  const ts=LV.aaravTables(5,LV.migrate({}),{targets:true});
  assert.equal(ts.length,D.AARAV_MODEL.length); assert.ok(ts.every(t=>t.box===t.name));
});
test('level 5 path answers stay on the board',()=>{
  const names=D.AARAV_MODEL.map(m=>m.name);
  D.BOSS.qs.forEach(q=>q.path.forEach(n=>assert.ok(names.includes(n),n)));
  D.BOSS.bridge.forEach(b=>assert.ok(names.includes(b[2])));
});
test('level 3 chips always offer the right answer',()=>{
  D.PAIRS.forEach(p=>{
    if(p.join){ assert.ok(p.joins.includes(p.join.table)); p.join.cols.forEach(c=>assert.ok(p.ptrs.includes(c))); }
    else assert.ok(p.names.includes(p.fk.name));
  });
});
test('every word, fact card and sort card has a nudge',()=>{
  Object.keys(D.TOKENS).forEach(k=>assert.ok(D.TOKENS[k].nudge,k));
  D.FACTS.forEach(f=>assert.ok(f.nudge,f.id)); D.STORE_CARDS.forEach(c=>assert.ok(c.nudge,c.id));
});
test('first check keeps the answer out of the crosses; the second shows it',()=>{
  const m=[T('owners',[col('id',{primary:true}),col('name')]),T('pets',[col('id',{primary:true}),col('name')])];
  const a=check(m,brief('petclinic'),{reveal:false}), b=check(m,brief('petclinic'),{reveal:true});
  assert.ok(!a.checks.some(c=>/owner_id|goes on|pets<\/code> has no/.test(c.html)));
  assert.ok(b.checks.some(c=>/owner_id/.test(c.html)));
  assert.equal(a.done,b.done);
});
test('old saves: the question 1 score moves into level 1',()=>{
  const S=LV.migrate({g1:{pts:80,miss:2,missed:{hiprio:1}}});
  assert.equal(S.lv[1].pts,80); assert.equal(S.lv[1].miss,2); assert.equal(LV.levelStars(1,S,{}),0);
});
test('deliverables tick themselves from the lab',()=>{
  const T=solvedState();
  assert.deepEqual(LV.deliverables(T,{}),{d2:true,d3:false,d4:false});
  LV.CORE.forEach(b=>{ T.solved[b.id]=true; });
  T.bp={desc:'a',q1:'a',q2:'a',q3:'a',files:'none',api:'POST /x → x'};
  T.schemas.myapp=[{name:'a',columns:[{name:'id'}]},{name:'b',columns:[{name:'id'}]}];
  assert.equal(LV.deliverables(T,{}).d4,false);
  const ck={c7a:1,c7b:1,c7c:1,c7d:1,c7e:1};
  assert.deepEqual(LV.deliverables(T,ck),{d2:true,d3:true,d4:true});
  assert.equal(LV.next(T,ck),0);
});
