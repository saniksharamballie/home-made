function sellerStorefrontValue(value){
  return String(value == null ? '' : value).trim();
}

function sellerStorefrontChangedFields(current, baseline, dirty){
  current=current||{};
  baseline=baseline||{};
  dirty=dirty||{};
  return Object.keys(dirty).filter(function(field){
    return !!dirty[field] && sellerStorefrontValue(current[field]) !== sellerStorefrontValue(baseline[field]);
  });
}

function buildSellerStorefrontSelectivePatch(existingData, current, baseline, dirty, nowIso){
  existingData=existingData&&typeof existingData==='object'?existingData:{};
  current=current||{};
  var changedFields=sellerStorefrontChangedFields(current,baseline,dirty);
  var changedDataKeys=[];
  var sellerValues={};
  var profileValues={};
  var nextData=Object.assign({},existingData);

  function setData(key,value){
    nextData[key]=value;
    if(changedDataKeys.indexOf(key)<0) changedDataKeys.push(key);
  }

  changedFields.forEach(function(field){
    var value=sellerStorefrontValue(current[field]);
    if(field==='storeName'){
      sellerValues.name=value;
      profileValues.display_name=value;
      setData('storeName',value);
    }else if(field==='bio'){
      setData('bio',value);
    }else if(field==='contactName'){
      sellerValues.seller=value;
      setData('contactName',value);
    }else if(field==='contactEmail'){
      sellerValues.email=value;
      if(value) profileValues.email=value;
      setData('contactEmail',value);
    }else if(field==='phone'){
      sellerValues.wa=value;
      setData('phone',value);
    }else if(field==='address'){
      setData('address',value);
    }else if(field==='paymentInfo'){
      setData('paymentInfo',value);
    }else if(field==='storePic'){
      setData('storePic',value);
    }else if(field==='avatar'){
      setData('avatar',value);
    }else if(field==='dob'){
      var birthMonth=value ? value.slice(5,7) : '';
      setData('sellerBirthMonth',birthMonth);
      setData('birthMonth',birthMonth);
      if(birthMonth && !existingData.birthdayLockedAt){
        setData('birthdayLockedAt',nowIso||new Date().toISOString());
      }
    }
  });

  if(changedDataKeys.length) sellerValues.data=nextData;
  return {
    changedFields:changedFields,
    changedDataKeys:changedDataKeys,
    sellerValues:sellerValues,
    profileValues:profileValues,
    hasSellerChanges:Object.keys(sellerValues).length>0,
    hasProfileChanges:Object.keys(profileValues).length>0
  };
}

if(typeof module!=='undefined' && module.exports){
  module.exports={
    sellerStorefrontValue:sellerStorefrontValue,
    sellerStorefrontChangedFields:sellerStorefrontChangedFields,
    buildSellerStorefrontSelectivePatch:buildSellerStorefrontSelectivePatch
  };
}
