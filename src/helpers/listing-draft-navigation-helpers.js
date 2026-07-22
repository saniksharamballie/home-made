function listingDraftStep(value){
  var step=Number(value);
  return Number.isInteger(step)&&step>=1&&step<=3 ? step : 0;
}

function canNavigateInactiveListingDraft(ownerSeller,currentStep,targetStep){
  var current=listingDraftStep(currentStep);
  var target=listingDraftStep(targetStep);
  return !!ownerSeller&&ownerSeller.active===false&&current>0&&target>0&&Math.abs(target-current)===1;
}

if(typeof module!=='undefined' && module.exports){
  module.exports={
    listingDraftStep:listingDraftStep,
    canNavigateInactiveListingDraft:canNavigateInactiveListingDraft
  };
}
