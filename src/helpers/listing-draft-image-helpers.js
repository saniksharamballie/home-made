var HM_DRAFT_IMAGE_BUCKET='seller-draft-images';
var HM_DRAFT_IMAGE_MAX_BYTES=5*1024*1024;
var HM_DRAFT_IMAGE_MAX_DIMENSION=8000;
var HM_DRAFT_IMAGE_MAX_PIXELS=32000000;
var HM_DRAFT_IMAGE_MAX_MENU_IMAGES=25;
var HM_DRAFT_IMAGE_SIGNED_SECONDS=300;
var HM_DRAFT_IMAGE_MIME_TYPES=['image/jpeg','image/png','image/webp'];

function listingDraftImageInteger(value){
  var number=Number(value);
  return Number.isFinite(number)&&number>=0?Math.round(number):0;
}

function listingDraftImagePathParts(path){
  var match=/^drafts\/([0-9a-f-]{36})\/([0-9]+)\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(jpe?g|png|webp)$/i.exec(String(path||''));
  return match?{authId:match[1].toLowerCase(),sellerId:match[2],objectId:match[3].toLowerCase(),extension:match[4].toLowerCase()}:null;
}

function listingDraftImageMetadata(value){
  value=value&&typeof value==='object'?value:{};
  var path=String(value.path||'').trim();
  var mimeType=String(value.mimeType||value.mime_type||'').toLowerCase();
  var size=listingDraftImageInteger(value.size);
  var width=listingDraftImageInteger(value.width);
  var height=listingDraftImageInteger(value.height);
  if(value.bucket!==HM_DRAFT_IMAGE_BUCKET||!listingDraftImagePathParts(path)) return null;
  if(HM_DRAFT_IMAGE_MIME_TYPES.indexOf(mimeType)<0||!size||size>HM_DRAFT_IMAGE_MAX_BYTES) return null;
  if(width>HM_DRAFT_IMAGE_MAX_DIMENSION||height>HM_DRAFT_IMAGE_MAX_DIMENSION||width*height>HM_DRAFT_IMAGE_MAX_PIXELS) return null;
  return {bucket:HM_DRAFT_IMAGE_BUCKET,path:path,mimeType:mimeType,size:size,width:width,height:height};
}

function listingDraftImageOwnedBy(value,authId,sellerId){
  var image=listingDraftImageMetadata(value);
  var parts=image&&listingDraftImagePathParts(image.path);
  return !!(parts&&String(parts.authId)===String(authId||'').toLowerCase()&&String(parts.sellerId)===String(sellerId));
}

function listingDraftImageBuildPath(authId,sellerId,randomId,extension){
  var path='drafts/'+String(authId||'').toLowerCase()+'/'+String(sellerId)+'/'+String(randomId||'').toLowerCase()+'.'+String(extension||'webp').toLowerCase();
  return listingDraftImagePathParts(path)?path:'';
}

function listingDraftImageSourceError(file,width,height){
  if(!file) return 'Choose an image first.';
  if(HM_DRAFT_IMAGE_MIME_TYPES.indexOf(String(file.type||'').toLowerCase())<0) return 'Use a JPEG, PNG or WebP image.';
  if(!Number(file.size)||Number(file.size)>HM_DRAFT_IMAGE_MAX_BYTES) return 'Image must be under 5 MB.';
  if(width!==undefined&&height!==undefined){
    width=listingDraftImageInteger(width);
    height=listingDraftImageInteger(height);
    if(!width||!height) return 'The image could not be decoded.';
    if(width>HM_DRAFT_IMAGE_MAX_DIMENSION||height>HM_DRAFT_IMAGE_MAX_DIMENSION||width*height>HM_DRAFT_IMAGE_MAX_PIXELS){
      return 'Image dimensions are too large.';
    }
  }
  return '';
}

function listingDraftImageCollect(draft){
  draft=draft&&typeof draft==='object'?draft:{};
  var images=[];
  var listing=listingDraftImageMetadata(draft.listingImage);
  if(listing) images.push(listing);
  (Array.isArray(draft.menuItems)?draft.menuItems:[]).forEach(function(item){
    var image=listingDraftImageMetadata(item&&item.image);
    if(image) images.push(image);
  });
  return images;
}

function listingDraftImagePathSet(draft){
  var set={};
  listingDraftImageCollect(draft).forEach(function(image){set[image.path]=true;});
  return set;
}

function listingDraftImageRemoved(previousDraft,nextDraft){
  var next=listingDraftImagePathSet(nextDraft);
  return listingDraftImageCollect(previousDraft).filter(function(image){return !next[image.path];});
}

function listingDraftImageUnsafeReference(value){
  var text=String(value||'').trim().toLowerCase();
  return /^(?:data|blob):/.test(text)||/^https?:\/\//.test(text);
}

function listingDraftImagePublicationBlocked(postForm,items){
  postForm=postForm||{};
  if(postForm.stagedImage||postForm.draftImage||listingDraftImageUnsafeReference(postForm.img)) return true;
  return (Array.isArray(items)?items:[]).some(function(item){
    item=item||{};
    return !!(item.stagedImage||item.draftImage||listingDraftImageUnsafeReference(item.img));
  });
}

if(typeof module!=='undefined'&&module.exports){
  module.exports={
    HM_DRAFT_IMAGE_BUCKET:HM_DRAFT_IMAGE_BUCKET,
    HM_DRAFT_IMAGE_MAX_BYTES:HM_DRAFT_IMAGE_MAX_BYTES,
    HM_DRAFT_IMAGE_MAX_DIMENSION:HM_DRAFT_IMAGE_MAX_DIMENSION,
    HM_DRAFT_IMAGE_MAX_PIXELS:HM_DRAFT_IMAGE_MAX_PIXELS,
    HM_DRAFT_IMAGE_MAX_MENU_IMAGES:HM_DRAFT_IMAGE_MAX_MENU_IMAGES,
    HM_DRAFT_IMAGE_SIGNED_SECONDS:HM_DRAFT_IMAGE_SIGNED_SECONDS,
    HM_DRAFT_IMAGE_MIME_TYPES:HM_DRAFT_IMAGE_MIME_TYPES,
    listingDraftImagePathParts:listingDraftImagePathParts,
    listingDraftImageMetadata:listingDraftImageMetadata,
    listingDraftImageOwnedBy:listingDraftImageOwnedBy,
    listingDraftImageBuildPath:listingDraftImageBuildPath,
    listingDraftImageSourceError:listingDraftImageSourceError,
    listingDraftImageCollect:listingDraftImageCollect,
    listingDraftImagePathSet:listingDraftImagePathSet,
    listingDraftImageRemoved:listingDraftImageRemoved,
    listingDraftImageUnsafeReference:listingDraftImageUnsafeReference,
    listingDraftImagePublicationBlocked:listingDraftImagePublicationBlocked
  };
}
