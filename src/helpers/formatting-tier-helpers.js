function hmNumber(value, fallback){
  var raw = typeof value === 'string' ? value.replace(/[^0-9.-]/g,'') : value;
  var n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function tierRank(t){
  return ({standard:0,gold:1,platinum:2})[String(t||'standard').toLowerCase()] || 0;
}

function tierDisplayLabel(t){
  t=String(t||'standard').toLowerCase();
  if(t==='platinum') return 'Platinum Seller';
  if(t==='gold') return 'Gold Seller';
  return 'Standard Seller';
}

var TIER_PRICES={standard:0,gold:149,platinum:299};
var TIER_TRIAL_DAYS={standard:0,gold:7,platinum:3};

function tierMonthlyPrice(t){
  return TIER_PRICES[String(t||'standard').toLowerCase()] || 0;
}

function tierTrialDays(t){
  return TIER_TRIAL_DAYS[String(t||'standard').toLowerCase()] || 0;
}

function tierPriceLabel(t){
  var price=tierMonthlyPrice(t);
  return price ? 'R'+price+'/mo' : 'Free';
}

function nextSellerTier(t){
  t=String(t||'standard').toLowerCase();
  if(t==='standard') return 'gold';
  if(t==='gold') return 'platinum';
  return '';
}

function sellerTierClass(t){
  t=String(t||'standard').toLowerCase();
  if(t==='platinum') return 'bp';
  if(t==='gold') return 'bgold';
  return 'bstd';
}

function sellerBirthdayValue(s){
  var d=(s&&(s._data||s.data))||{};
  return d.sellerBirthMonth || d.birthMonth || d.sellerDob || d.dateOfBirth || d.dob || d.birthDate || '';
}

function isBirthdayMonth(value){
  if(!value) return false;
  var raw=String(value).trim();
  var month=0;
  if(/^\d{1,2}$/.test(raw)){
    month=parseInt(raw,10);
  }else{
    var parts=raw.slice(0,10).split('-');
    if(parts.length<2) return false;
    month=parseInt(parts[1],10);
  }
  if(!month || month<1 || month>12) return false;
  return month === (new Date().getMonth()+1);
}

function sellerBaseTier(s){
  if(!s) return 'standard';
  var d=s._data||s.data||{};
  return String(s.baseTier || d.baseTier || d.paidTier || d.adminTierPrevious || s.tier || d.tier || 'standard').toLowerCase();
}

function sellerEffectiveTier(s){
  if(!s) return 'standard';
  var d=s._data||s.data||{};
  var base=String(s.baseTier || d.baseTier || d.paidTier || s.tier || d.tier || 'standard').toLowerCase();
  var effective=base;
  if(isBirthdayMonth(sellerBirthdayValue(s)) || d.birthdayMonthBoost===true || d.birthdayMonthBoost==='true') effective='platinum';
  if(d.adminTier){
    var adminTier=String(d.adminTier||'').toLowerCase();
    var until=d.adminTierUntil || d.adminPromotionUntil || '';
    var permanent=d.adminTierPermanent===true || d.adminTierPermanent==='true' || d.adminPromotionPermanent===true || d.adminPromotionPermanent==='true';
    var stillActive=permanent || !until || isNaN(new Date(until).getTime()) || new Date(until).getTime()>Date.now();
    if(stillActive && tierRank(adminTier)>tierRank(effective)) effective=adminTier;
  }
  return effective;
}

function applySellerComputedAccess(s){
  if(!s) return s;
  s.baseTier=sellerBaseTier(s);
  s.tier=sellerEffectiveTier(s);
  return s;
}

function hmBool(value, fallback){
  if(value === true || value === false) return value;
  if(value == null || value === '') return fallback;
  return ['true','1','yes','on'].indexOf(String(value).toLowerCase()) >= 0;
}

function hmTagArray(value){
  if(Array.isArray(value)) return value.filter(Boolean);
  if(typeof value === 'string' && value.trim()) return value.split(',').map(function(v){return v.trim();}).filter(Boolean);
  return [];
}
