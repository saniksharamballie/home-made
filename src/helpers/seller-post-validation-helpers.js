function postMissingForStep(step){
  var f=ST.pf||{}, items=ST.pi||[], missing=[];
  if(step===1){
    if(!String(f.name||'').trim()) missing.push('name');
    if(!String(f.desc||'').trim()) missing.push('desc');
    if(!String(f.wa||'').trim() || normalizePhoneNumber(f.wa).length<9) missing.push('wa');
    if(!String(f.waConfirm||'').trim() || normalizePhoneNumber(f.wa)!==normalizePhoneNumber(f.waConfirm)) missing.push('waConfirm');
    if(!String(f.img||'').trim()) missing.push('listingPhoto');
    if(!String(f.region||'').trim()) missing.push('region');
    if(!String(f.cat||'').trim()) missing.push('cat');
    if(!f.del && !f.pu) missing.push('fulfilment');
    if(f.del && String(f.fee||'').trim()==='') missing.push('fee');
  } else if(step===2){
    if(!items.length) missing.push('items');
    items.forEach(function(it,i){
      if(!String(it.n||'').trim()) missing.push('itemName_'+i);
      if(!(parseFloat(it.p)>0)) missing.push('itemPrice_'+i);
      if(!String(it.svs||'').trim()) missing.push('itemServing_'+i);
      if(!String(it.img||'').trim()) missing.push('itemPhoto_'+i);
    });
  } else if(step===3){
    if(!String(f.timeframe||'').trim()) missing.push('timeframe');
    if(!f.legalAccepted) missing.push('legal');
  }
  return missing;
}
