function cleanPostItem(it){
  it=it||{};
  return {
    n:it.n||'',
    p:parseFloat(it.p)||0,
    svs:it.svs||'',
    hot:!!it.hot,
    img:it.img||'',
    imgPath:it.imgPath||'',
    imgName:it.imgName||''
  };
}
