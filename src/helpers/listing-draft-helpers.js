function listingDraftText(value){
  return String(value == null ? '' : value).trim();
}

function listingDraftTags(values){
  var seen={};
  return (Array.isArray(values)?values:[]).map(listingDraftText).filter(function(value){
    if(!value || seen[value]) return false;
    seen[value]=true;
    return true;
  });
}

function listingDraftPrice(value){
  var text=listingDraftText(value);
  if(!text) return '';
  var price=Number(text);
  return Number.isFinite(price) ? price : '';
}

function listingDraftMenuItems(items){
  return (Array.isArray(items)?items:[]).map(function(item){
    item=item||{};
    return {
      n:listingDraftText(item.n),
      p:listingDraftPrice(item.p),
      svs:listingDraftText(item.svs)
    };
  });
}

function listingDraftContent(postForm,items){
  postForm=postForm||{};
  return {
    version:1,
    title:listingDraftText(postForm.name),
    description:listingDraftText(postForm.desc),
    category:listingDraftText(postForm.cat),
    dietaryTags:listingDraftTags(postForm.dietary),
    timeframe:listingDraftText(postForm.timeframe),
    leadDays:listingDraftText(postForm.leadDays),
    menuItems:listingDraftMenuItems(items)
  };
}

function normalizeListingDraft(value){
  value=value&&typeof value==='object'?value:{};
  return listingDraftContent({
    name:value.title,
    desc:value.description,
    cat:value.category,
    dietary:value.dietaryTags,
    timeframe:value.timeframe,
    leadDays:value.leadDays
  },value.menuItems);
}

function listingDraftEqual(left,right){
  return JSON.stringify(normalizeListingDraft(left))===JSON.stringify(normalizeListingDraft(right));
}

function listingDraftFingerprint(value){
  var source=JSON.stringify(normalizeListingDraft(value));
  var hash=2166136261;
  for(var i=0;i<source.length;i++){
    hash^=source.charCodeAt(i);
    hash=Math.imul(hash,16777619);
  }
  return ('00000000'+(hash>>>0).toString(16)).slice(-8);
}

function listingDraftHydrationKey(sellerId,value){
  if(sellerId==null || !value || typeof value!=='object') return '';
  return String(sellerId)+':'+listingDraftFingerprint(value);
}

function listingDraftIsBlank(postForm,items){
  var draft=listingDraftContent(postForm,items);
  return !draft.title&&!draft.description&&!draft.dietaryTags.length&&!draft.menuItems.some(function(item){
    return !!(item.n||item.p!==''||item.svs);
  });
}

function buildInactiveListingDraftPatch(existingData,postForm,items,nowIso){
  existingData=existingData&&typeof existingData==='object'?existingData:{};
  var content=listingDraftContent(postForm,items);
  if(listingDraftEqual(existingData.listingDraft,content)){
    return {changed:false,draft:normalizeListingDraft(existingData.listingDraft),sellerValues:{}};
  }
  var draft=Object.assign({},content,{updatedAt:nowIso||new Date().toISOString()});
  var data=Object.assign({},existingData,{listingDraft:draft});
  return {
    changed:true,
    draft:draft,
    sellerValues:{data:data,updated_at:draft.updatedAt}
  };
}

if(typeof module!=='undefined' && module.exports){
  module.exports={
    listingDraftContent:listingDraftContent,
    normalizeListingDraft:normalizeListingDraft,
    listingDraftEqual:listingDraftEqual,
    listingDraftFingerprint:listingDraftFingerprint,
    listingDraftHydrationKey:listingDraftHydrationKey,
    listingDraftIsBlank:listingDraftIsBlank,
    buildInactiveListingDraftPatch:buildInactiveListingDraftPatch
  };
}
