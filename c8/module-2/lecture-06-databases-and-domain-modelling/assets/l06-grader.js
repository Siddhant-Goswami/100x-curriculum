/* Lecture 6 · The Modelling Lab · the checker.
   Compares a built schema with a brief's rubric and returns named checks, each a tick or a cross.
   No score, no percentage: done means every structural check is a tick.
   Name matching is forgiving: case, underscores, singular/plural and listed synonyms. */

(function(){
  function norm(s){ return (s||'').toString().toLowerCase().replace(/[^a-z0-9]/g,''); }
  function singular(s){ return s.endsWith('s') ? s.slice(0,-1) : s; }
  function nameEq(a,b){ a=norm(a); b=norm(b); if(!a||!b) return false; return a===b || singular(a)===singular(b); }
  function matchesAny(input,names){ return (names||[]).some(function(n){ return nameEq(input,n); }); }
  function entityTargets(e){ return [e.name].concat(e.aliases||[]); }
  function attrTargets(a){ return [a.name].concat(a.aliases||[]); }
  function esc(s){ return (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function isPk(c){ return !!c && c.primary===true; }
  function isFk(c){ return !!c && c.foreign===true; }
  function findTable(schema,entity){ return schema.find(function(t){ return matchesAny(t.name,entityTargets(entity)); }); }
  function findCol(table,attr){ return table.columns.find(function(c){ return matchesAny(c.name,attrTargets(attr)); }); }
  function refTable(schema,ref){ return schema.find(function(t){ return t.id===ref || nameEq(t.name,ref); }); }
  function fkPointsAt(col,refEntity,schema){ if(!isFk(col)) return false; var t=refTable(schema,col.fkRef); return !!t && matchesAny(t.name,entityTargets(refEntity)); }

  /* returns {done, checks:[{ok, structural, html}], suggestions:[html]} */
  function check(schema, brief){
    var rubric=brief.rubric, checks=[], suggestions=[];
    var byName={}; rubric.entities.forEach(function(e){ byName[e.name]=e; });
    function add(ok,html,structural){ checks.push({ok:!!ok, html:html, structural:structural!==false}); }

    /* broken structure first */
    var named=schema.filter(function(t){ return t.name; });
    var dupT=named.filter(function(t,i){ return named.findIndex(function(x){ return nameEq(x.name,t.name); })!==i; });
    if(dupT.length) add(false,'Two tables share the name <code>'+esc(dupT[0].name)+'</code>. Rename or remove one.');
    named.forEach(function(t){
      var cols=t.columns.filter(function(c){ return c.name; });
      var dup=cols.find(function(c,i){ return cols.findIndex(function(x){ return nameEq(x.name,c.name); })!==i; });
      if(dup) add(false,'<code>'+esc(t.name)+'</code> has two columns called <code>'+esc(dup.name)+'</code>.');
      t.columns.filter(isFk).forEach(function(c){
        if(!c.fkRef || !refTable(schema,c.fkRef)) add(false,'<code>'+esc(t.name)+'.'+esc(c.name||'?')+'</code> is a pointer with no table to point at. Pick the table.');
      });
    });

    /* things and their facts */
    rubric.entities.forEach(function(entity){
      var table=findTable(schema,entity);
      if(!table){ add(false,'No table for <b>'+esc(entity.name)+'</b>.'); return; }
      add(true,'<code>'+esc(table.name)+'</code> is there.');
      if(!table.columns.some(isPk)) add(false,'<code>'+esc(table.name)+'</code> has no key. Every row needs an address, usually <code>id</code>.');
      entity.attrs.forEach(function(attr){
        if(attr.role==='pk') return;
        var col=findCol(table,attr);
        if(attr.role==='fk'){
          var refEntity=byName[attr.ref];
          if(col && fkPointsAt(col,refEntity,schema)) add(true,'<code>'+esc(table.name)+'.'+esc(col.name)+'</code> points to <code>'+esc(attr.ref)+'</code>.');
          else if(col && isFk(col)) add(false,'<code>'+esc(table.name)+'.'+esc(col.name)+'</code> is a pointer but does not point to <code>'+esc(attr.ref)+'</code>. Pick the table.');
          else if(col) add(false,'<code>'+esc(table.name)+'.'+esc(col.name)+'</code> should be a pointer to <code>'+esc(attr.ref)+'</code>. Tick "points to" and pick the table.');
          else add(false,'<code>'+esc(table.name)+'</code> has no pointer to <code>'+esc(attr.ref)+'</code> (for example <code>'+esc(attr.name)+'</code>). Without it the link does not exist.');
        } else if(col){
          if(attr.critical) add(true,'<code>'+esc(table.name)+'.'+esc(col.name)+'</code> is in the right place.');
        } else if(attr.critical){
          add(false,'<code>'+esc(table.name)+'</code> is missing <b>'+esc(attr.name)+'</b>, and that is the point of this brief. It describes exactly this row.');
        } else {
          suggestions.push('<code>'+esc(table.name)+'</code> could use a <b>'+esc(attr.name)+'</b> column.');
        }
      });
    });

    /* the links */
    rubric.relationships.forEach(function(rel){
      var tbl=schema.find(function(t){ return matchesAny(t.name,entityTargets(byName[rel.fk.table]||{name:rel.fk.table})); });
      var refEntity=byName[rel.fk.ref]||{name:rel.fk.ref};
      if(!tbl) return;
      var fks=tbl.columns.filter(function(c){ return fkPointsAt(c,refEntity,schema); });
      if(!fks.length){ add(false,'Link missing: <b>'+esc(rel.label)+'</b>. The pointer goes on <code>'+esc(rel.fk.table)+'</code>'+(rel.fk.unique?' and must be unique':'')+'.'); return; }
      if(rel.fk.unique){
        var uq=fks.some(function(c){ return c.unique; });
        if(!uq) add(false,'<b>'+esc(rel.label)+'</b> means one row each, so <code>'+esc(tbl.name)+'.'+esc(fks[0].name)+'</code> must be marked unique.');
        else add(true,'<b>'+esc(rel.label)+'</b>: the pointer is unique, so a second row is refused.');
      } else add(true,'<b>'+esc(rel.label)+'</b>.');
    });

    /* the classic mistake: the one side carrying a pointer to its many side */
    rubric.relationships.forEach(function(rel){
      var one=schema.find(function(t){ return matchesAny(t.name,entityTargets(byName[rel.fk.ref]||{name:rel.fk.ref})); });
      var many=byName[rel.fk.table];
      if(one && many){
        var wrong=one.columns.find(function(c){ return fkPointsAt(c,many,schema); });
        if(wrong) add(false,'<code>'+esc(one.name)+'.'+esc(wrong.name)+'</code> points the wrong way. One cell cannot hold many. Remove it; <code>'+esc(rel.fk.table)+'</code> already carries the link.');
      }
    });

    var done=checks.every(function(c){ return c.ok || !c.structural; });
    checks.sort(function(a,b){ return (a.ok?1:0)-(b.ok?1:0); });
    return {done:done, checks:checks, suggestions:suggestions};
  }

  window.L06Check={check:check, nameEq:nameEq, isPk:isPk, isFk:isFk, refTable:refTable};
})();
