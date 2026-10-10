/* Run with: node --test c8/module-2/lecture-06-databases-and-domain-modelling/_plan/tests/checker.test.js
   Loads the lab's data and checker the way the page does (plain scripts), then checks a few models. */
const test=require('node:test'); const assert=require('node:assert'); const fs=require('fs'); const path=require('path'); const vm=require('vm');
const ctx={window:{}}; ctx.window=ctx;
for(const f of ['l06-data.js','l06-grader.js']) vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../assets',f),'utf8'),ctx);
const D=ctx.L06, check=ctx.L06Check.check;
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
