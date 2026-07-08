function formatSellerBackAt(value){
  if(!value) return '';
  var d=new Date(value);
  if(isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-ZA',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
}

function toDatetimeLocalValue(value){
  if(!value) return '';
  var d=new Date(value);
  if(isNaN(d.getTime())) return String(value).slice(0,16);
  var local=new Date(d.getTime()-d.getTimezoneOffset()*60000);
  return local.toISOString().slice(0,16);
}
