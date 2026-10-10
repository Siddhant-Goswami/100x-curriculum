/* ============================================================
   THE GRADER — checks a built schema against a challenge rubric.
   Forgiving by design: fuzzy name match, singular/plural tolerant,
   synonym-aware. Returns a score + specific, teachy feedback.
   ============================================================ */

function norm(s){ return (s||'').toString().toLowerCase().replace(/[^a-z0-9]/g,''); }
function singular(s){ return s.endsWith('s') ? s.slice(0,-1) : s; }

function nameEq(a,b){
  a=norm(a); b=norm(b);
  if(!a||!b) return false;
  if(a===b) return true;
  if(singular(a)===singular(b)) return true;
  return false;
}
function matchesAny(input, names){ return (names||[]).some(n=>nameEq(input,n)); }

function entityTargets(e){ return [e.name, ...(e.aliases||[])]; }
function attrTargets(a){ return [a.name, ...(a.aliases||[])]; }
function safe(s){ return (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function isPrimary(col){ return col && (col.primary===true || col.key==='pk'); }
function isForeign(col){ return col && (col.foreign===true || col.key==='fk'); }

/* find the student's table that stands in for a rubric entity */
function findTable(schema, entity){
  return schema.find(t => matchesAny(t.name, entityTargets(entity)));
}
/* find a column in a table that satisfies an attribute spec */
function findCol(table, attr){
  return table.columns.find(c => matchesAny(c.name, attrTargets(attr)));
}
/* does a student fk column point at the rubric's referenced entity? */
function fkPointsAt(col, refEntity, schema){
  if(!isForeign(col)) return false;
  const target=(schema||[]).find(t=>t.id===col.fkRef || nameEq(t.name,col.fkRef));
  return !!target && matchesAny(target.name, entityTargets(refEntity));
}

function gradeSchema(schema, challenge){
  const rubric = challenge.rubric;
  const fb = [];            // feedback items
  let score = 0, max = 0;
  let penalty = 0;
  let criticalFail = false; // a structural mistake that should block a "pass"

  // resolve a rubric entity object by its canonical name (for ref lookups)
  const entityByName = {};
  rubric.entities.forEach(e => entityByName[e.name] = e);

  // Reject ambiguous or broken structures before comparing with the answer rubric.
  const namedTables=schema.filter(t=>t.name);
  const duplicateTables=namedTables.filter((t,i)=>namedTables.findIndex(x=>nameEq(x.name,t.name))!==i);
  if(duplicateTables.length){
    criticalFail=true; penalty+=8;
    fb.push({type:'miss',icon:'✕',html:`Duplicate table names make references ambiguous: <code>${safe(duplicateTables[0].name)}</code>. Rename or remove the duplicate.`});
  }
  namedTables.forEach(table=>{
    const namedCols=table.columns.filter(c=>c.name);
    const dup=namedCols.find((c,i)=>namedCols.findIndex(x=>nameEq(x.name,c.name))!==i);
    if(dup){
      criticalFail=true; penalty+=5;
      fb.push({type:'miss',icon:'✕',html:`<code>${safe(table.name)}</code> contains duplicate column <code>${safe(dup.name)}</code>.`});
    }
    table.columns.filter(isForeign).forEach(col=>{
      if(!schema.some(t=>t.id===col.fkRef || nameEq(t.name,col.fkRef))){
        criticalFail=true; penalty+=5;
        fb.push({type:'miss',icon:'✕',html:`<code>${safe(table.name)}.${safe(col.name)}</code> points to a table that does not exist.`});
      }
    });
  });

  // ---------- ENTITIES + ATTRIBUTES ----------
  rubric.entities.forEach(entity => {
    const W_ENTITY = 10;
    max += W_ENTITY;
    const table = findTable(schema, entity);

    if(!table){
      fb.push({type:'miss', icon:'✕',
        html:`Missing table for <b>${entity.name}</b>. ${entity.required===false?'(optional, but expected)':'This is a required entity.'}`});
      return;
    }
    score += W_ENTITY;
    fb.push({type:'good', icon:'✓', html:`Table <code>${safe(table.name)}</code> — entity found.`});

    // primary key
    const hasPk = table.columns.some(isPrimary);
    max += 2;
    if(hasPk){ score += 2; }
    else fb.push({type:'warn', icon:'!', html:`<code>${safe(table.name)}</code> has no primary key. Every table needs a unique address, often <code>id</code> or a composite key.`});

    // attributes
    entity.attrs.forEach(attr => {
      if(attr.role==='pk') return; // handled above
      const required = attr.required !== false;
      const isFk = attr.role==='fk';
      // structure dominates: fks & the lesson's critical attr are heavy,
      // required descriptive attrs matter, optional ones are barely weighted
      // so a structurally-correct model still passes without every nice-to-have column.
      const W = isFk ? 8 : (attr.critical ? 7 : (required ? 3 : 1));
      max += W;
      const col = findCol(table, attr);

      if(isFk){
        const refEntity = entityByName[attr.ref];
        if(col && fkPointsAt(col, refEntity, schema)){
          score += W;
        } else if(col && isForeign(col)){
          score += W*0.5;
          fb.push({type:'warn', icon:'!', html:`<code>${safe(table.name)}.${safe(col.name)}</code> is marked as a foreign key but doesn't point at <code>${attr.ref}</code>. Set its reference.`});
        } else if(col){
          score += W*0.35;
          fb.push({type:'warn', icon:'!', html:`<code>${safe(table.name)}.${safe(col.name)}</code> looks like it should be a <b>foreign key</b> → <code>${attr.ref}</code>, but it isn't marked as one. Mark the key as FK and pick the table it references.`});
        } else {
          fb.push({type:'miss', icon:'✕', html:`<code>${safe(table.name)}</code> is missing the foreign key to <code>${attr.ref}</code> (e.g. <code>${attr.name}</code>). Without it, the “${entity.name} → ${attr.ref}” link doesn't exist.`});
        }
      } else {
        if(col){ score += W; }
        else if(required){
          if(attr.critical){
            criticalFail = true;
            fb.push({type:'miss', icon:'✕', html:`<code>${safe(table.name)}</code> is missing <b>${attr.name}</b> — and that's the crux of this exercise. ${attr.role!=='fk'?'It describes a connection, so it must live exactly here.':''} Add it to pass.`});
          } else {
            fb.push({type:'miss', icon:'✕', html:`<code>${safe(table.name)}</code> is missing the <b>${attr.name}</b> attribute.`});
          }
        }
      }
    });
  });

  // ---------- RELATIONSHIP / FK PLACEMENT (the heart of it) ----------
  rubric.relationships.forEach(rel => {
    const W = rel.weight || 8; max += W;
    const tbl = schema.find(t => matchesAny(t.name, entityTargets(entityByName[rel.fk.table] || {name:rel.fk.table})));
    const refEntity = entityByName[rel.fk.ref] || {name:rel.fk.ref};

    if(!tbl){ return; } // already reported as missing entity

    const fkCols = tbl.columns.filter(c => fkPointsAt(c, refEntity, schema));

    if(rel.fk.selfJoin){
      // needs TWO distinct fks to the same table
      if(fkCols.length >= 2){
        score += W;
        fb.push({type:'good', icon:'★', html:`Self-join nailed: <code>${safe(tbl.name)}</code> has two foreign keys into <code>${refEntity.name}</code> — that's how a directional follow works.`});
      } else if(fkCols.length === 1){
        score += W*0.25; criticalFail = true;
        fb.push({type:'miss', icon:'✕', html:`<code>${safe(tbl.name)}</code> only has one FK to <code>${refEntity.name}</code>. A directional follow needs TWO (follower + followed), both pointing at users — otherwise you can't tell who follows whom. Fix this to pass.`});
      } else {
        criticalFail = true;
        fb.push({type:'miss', icon:'✕', html:`Relationship missing: <b>${rel.label}</b>.`});
      }
    } else {
      if(fkCols.length >= 1){
        const uniqueFk=fkCols.some(c=>c.unique || (isPrimary(c)&&tbl.columns.filter(isPrimary).length===1));
        if(rel.fk.unique && !uniqueFk){
          criticalFail=true;
          fb.push({type:'miss',icon:'✕',html:`<b>${rel.label}</b> is one-to-one, so its foreign key must also be <b>unique</b>. Mark UQ on <code>${safe(tbl.name)}.${safe(fkCols[0].name)}</code>.`});
        } else score += W;
      }
      else { criticalFail = true; fb.push({type:'miss', icon:'✕', html:`Relationship missing: <b>${rel.label}</b>. Add the FK on <code>${rel.fk.table}</code>${rel.fk.unique?' and mark it unique':''}.`}); }
    }
  });

  // ---------- mis-placed FK detection (teach the common mistake) ----------
  // If a "one" side table wrongly carries an fk to its "many" side.
  rubric.relationships.forEach(rel => {
    const oneSide = schema.find(t => matchesAny(t.name, entityTargets(entityByName[rel.fk.ref]||{name:rel.fk.ref})));
    const manyEntity = entityByName[rel.fk.table];
    if(oneSide && manyEntity){
      const wrong = oneSide.columns.find(c => fkPointsAt(c, manyEntity, schema));
      if(wrong){
        criticalFail=true; penalty+=6;
        fb.push({type:'miss', icon:'⤺', html:`Contradictory relationship: <code>${safe(oneSide.name)}.${safe(wrong.name)}</code> points at <code>${manyEntity.name}</code>. Remove it; <code>${rel.fk.table}</code> already carries the relationship.`});
      }
    }
  });

  score=Math.max(0,score-penalty);
  const pct = max>0 ? Math.round((score/max)*100) : 0;
  let status = 'fail';
  if(pct >= 85) status = 'pass';
  else if(pct >= 55) status = 'partial';
  // a structural mistake (missing core relationship / broken self-join) can't pass,
  // no matter how many other points were earned — the relationship IS the database.
  if(criticalFail && status === 'pass') status = 'partial';

  // closing tip
  if(status==='pass'){
    fb.unshift({type:'tip', icon:'🎉', html:`<b>Schema accepted.</b> The core entities, attributes, keys, and relationships satisfy this exercise. Export SQL, then review product-specific constraints and indexes.`});
  } else if(status==='partial'){
    fb.unshift({type:'tip', icon:'🔧', html:`<b>Close.</b> The skeleton is right but some links or fields are off. Read the ✕ and ! items below and adjust.`});
  } else {
    fb.unshift({type:'tip', icon:'🧭', html:`<b>Keep modeling.</b> Walk the recipe: nouns → entities, descriptions → attributes, then place a foreign key on every “many” side.`});
  }

  // sort: tip first, then misses, warns, goods
  const order = {tip:0, miss:1, warn:2, good:3};
  fb.sort((a,b)=> (order[a.type]??9) - (order[b.type]??9));

  return { score, max, pct, status, feedback:fb };
}
