function normalizePrivateOwnerSeller(row){
  if(!row || row.id == null || !row.auth_id) return null;
  var data=row.data&&typeof row.data==='object'?row.data:{};
  return Object.assign({},data,row,{
    id:row.id,
    auth_id:row.auth_id,
    name:row.name||data.storeName||'',
    seller:row.seller||data.contactName||'',
    email:row.email||data.contactEmail||'',
    wa:row.wa||data.phone||'',
    cat:row.category||data.cat||'african',
    baseTier:data.baseTier||data.paidTier||row.base_tier||row.tier||data.tier||'standard',
    tier:row.tier||data.tier||'standard',
    region:row.region||data.region||'',
    active:row.active===true,
    img:data.storePic||data.store_pic||data.img||data.image||data.image_url||'',
    storePic:data.storePic||data.store_pic||'',
    avatar:data.avatar||data.icon||'',
    desc:data.bio||data.desc||data.description||'',
    data:data,
    _data:data,
    _supabase:true,
    _privateOwner:true
  });
}

function resolveOwnerSellerState(profile,publicSellers,ownerId){
  profile=profile||null;
  publicSellers=Array.isArray(publicSellers)?publicSellers:[];
  var lookupStatus=(profile&&profile.sellerLookupStatus)||'';
  if(lookupStatus==='loading') return {status:'loading',seller:null,source:null};
  if(lookupStatus==='error') return {status:'error',seller:null,source:null};
  if(lookupStatus==='unlinked') return {status:'unlinked',seller:null,source:null};

  var sellerId=(profile&&profile.sellerId)||ownerId||null;
  var publicSeller=sellerId==null?null:publicSellers.find(function(seller){
    return seller && String(seller.id)===String(sellerId);
  });
  if(publicSeller) return {status:'loaded',seller:publicSeller,source:'public'};

  if(!profile || profile.role!=='seller' || sellerId==null){
    return {status:'unlinked',seller:null,source:null};
  }

  var privateSeller=profile.ownerSeller||normalizePrivateOwnerSeller(profile.raw);
  var ownsPrivateSeller=privateSeller
    && profile.authId
    && privateSeller.id!=null
    && privateSeller.auth_id
    && String(privateSeller.id)===String(sellerId)
    && String(privateSeller.auth_id)===String(profile.authId);
  if(!ownsPrivateSeller) return {status:'unlinked',seller:null,source:null};
  return {status:'loaded',seller:privateSeller,source:'private'};
}

if(typeof module!=='undefined' && module.exports){
  module.exports={
    normalizePrivateOwnerSeller:normalizePrivateOwnerSeller,
    resolveOwnerSellerState:resolveOwnerSellerState
  };
}
