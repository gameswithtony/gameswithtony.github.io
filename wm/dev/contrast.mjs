// Runs in the page through CDP. Measures rendered text against its layered surface.
export async function contrastAudit() {
  await Promise.allSettled(document.getAnimations().filter(a=>a.effect?.getComputedTiming().endTime!==Infinity).map(a=>a.finished));
  const rgb = value => {
    const parts = value.match(/[\d.]+/g)?.map(Number) || [0,0,0,0];
    return [...parts.slice(0,3),parts[3] ?? 1];
  };
  const blend = (front, back) => front.slice(0,3).map((n,i)=>n*front[3]+back[i]*(1-front[3])).concat(1);
  const background = element => {
    const layers=[];
    for(let e=element;e;e=e.parentElement)layers.unshift(rgb(getComputedStyle(e).backgroundColor));
    return layers.reduce((color,layer)=>blend(layer,color),rgb(getComputedStyle(document.body).backgroundColor));
  };
  const luminance = color => color.slice(0,3).map(n=>{const s=n/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
  const ratio = (a,b) => {const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
  const failures=[];let measured=0,minimum=Infinity;
  for(const e of document.querySelectorAll('body *')) {
    const text=[...e.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent.trim()).join(' ').trim();
    if(!text||!e.getClientRects().length||e.closest('svg,script,style,.sr-only,button:disabled'))continue;
    const closedDetails=e.closest('details:not([open])');
    if(closedDetails&&!closedDetails.querySelector('summary')?.contains(e))continue;
    const style=getComputedStyle(e);
    if(style.visibility!=='visible')continue;
    let opacity=1;for(let p=e;p;p=p.parentElement)opacity*=Number(getComputedStyle(p).opacity);
    const bg=background(e),fg=rgb(style.color);fg[3]*=opacity;
    const contrast=ratio(blend(fg,bg),bg),size=parseFloat(style.fontSize),weight=parseFloat(style.fontWeight);
    const required=size>=24||size>=18.66&&weight>=700?3:4.5;
    measured++;minimum=Math.min(minimum,contrast);
    if(contrast+.02<required)failures.push({text:text.slice(0,70),element:e.tagName.toLowerCase()+'.'+e.className,contrast:+contrast.toFixed(2),required,size,color:style.color,background:bg.slice(0,3).map(Math.round),opacity});
  }
  return {theme:document.documentElement.dataset.theme,measured,minimum:+minimum.toFixed(2),failures};
}
