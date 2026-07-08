function normalizePhoneNumber(v){
  return String(v||'').replace(/[^\d+]/g,'').replace(/^\+/, '');
}
