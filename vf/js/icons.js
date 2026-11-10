import {houseEmblems,housePennant} from './house-emblems.js';
// Original SVG pieces. Each fleet, resource, and installation has its own silhouette.
const paths={
  galaxy:'<path d="m12 2 8.7 5v10L12 22l-8.7-5V7Z"/><circle cx="12" cy="12" r="3"/><path d="m12 2 0 7m0 6v7M3.3 7l6 3.5m5.4 3 6 3.5M3.3 17l6-3.5m5.4-3 6-3.5"/>',
  house:'<path d="M4 3h16v12l-8 7-8-7Z"/><path d="m8 14 4-8 4 8m-6-3h4"/>',
  cards:'<path d="m3 6 3-2 4 16-3 1Zm5-3h13v18H10Z"/><path d="m13 8 3-2 3 2v5l-3 2-3-2Z"/>',
  voidborn:'<path d="m12 2 3 5 6-2-3 7 4 6-7-1-3 5-3-5-7 1 4-6-3-7 6 2Z"/><path d="m9 10 3-2 3 2v4l-3 2-3-2Z"/>',
  history:'<path d="M3 10a9 9 0 1 1 1 9M3 4v6h6m3-4v7l4 2"/>',
  food:'<path d="M12 22V8m0 8C5 16 3 12 3 8c6 0 9 3 9 8Zm0-4c0-6 3-9 9-9 0 6-3 9-9 9Z"/>',
  energy:'<path d="m14 2-9 12h6l-1 8 9-12h-6Z" fill="currentColor" stroke="none"/>',
  materials:'<path d="m12 2 9 5v10l-9 5-9-5V7Z"/><path d="m3 7 9 5 9-5m-9 5v10M7 5l10 6"/>',
  credits:'<path d="m6 3 12 0 4 9-4 9H6l-4-9Z"/><path d="M16 8h-6l-2 4 2 4h6M5 12h3m8 0h3"/>',
  science:'<path d="m8 2 8 0m-6 0v7L4 19l2 3h12l2-3-6-10V2M7 16h10"/><circle cx="12" cy="12" r="1"/>',
  population:'<circle cx="12" cy="6" r="3"/><path d="M5 22v-7l4-3h6l4 3v7M9 17v5m6-5v5"/>',
  defense:'<path d="m12 2 9 5-2 10-7 5-7-5L3 7Z"/><path d="m7 12 3 3 7-7"/>',
  shipyard:'<path d="M3 3v13l4 5h10l4-5V3M7 3v9m10-9v9M8 17h8m-4-9v5"/>',
  starbase:'<path d="m12 2 4 5 6 1-3 5 1 7-8-3-8 3 1-7-3-5 6-1Z"/><circle cx="12" cy="11" r="3"/>',
  influence:'<path d="m12 2 3 6 7 2-5 5 1 7-6-4-6 4 1-7-5-5 7-2Z"/>',
  corruption:'<path d="m7 7 8-1 3 5-1 6-9 1-3-5Z" fill="currentColor" stroke="none"/><path d="M8 8Q5 6 6 3m5 4q-1-3 1-5m3 6q1-3 0-6m2 8q4-3 5-1m-5 4q3-1 5 1m-6 2q5 1 3 3m-6-2q1 3-1 5m-2-5q-3 3-2 5m-1-7q-4 3-5 0m4-3q-3 0-4-2m5-1Q3 8 3 6" stroke-width="2"/>',
  trade:'<path d="M3 7h16l-4-4m6 14H5l4 4M3 7v5m18 5v-5"/>',
  glory:'<path d="m12 2 3 5 6 1-3 5 1 7-7-3-7 3 1-7-3-5 6-1Z"/><path d="m9 11 2 2 4-5"/>',
  bounty:'<path d="m12 2 9 5v10l-9 5-9-5V7Z"/><path d="M8 8h8v8H8zM12 6v12M6 12h12"/>',
  reclaim:'<path d="M20 8a9 9 0 1 0 1 8M20 2v6h-6"/><path d="M8 12h8m-4-4v8"/>',
  society:'<circle cx="8" cy="7" r="3"/><circle cx="18" cy="9" r="2"/><path d="M2 21v-7l6-3 6 3v7m2-7 6 1v6M6 17v4m4-4v4"/>',
  statecraft:'<path d="m2 8 10-5 10 5H2Zm3 4v7m7-7v7m7-7v7M2 22h20"/>',
  economy:'<path d="M3 20h18M5 16v-4h4V8h5V3h5"/>',
  tech:'<path d="M7 7h10v10H7zM9 2v5m6-5v5M9 17v5m6-5v5M2 9h5m-5 6h5m10-6h5m-5 6h5M10 10h4v4h-4Z"/>',
  agenda:'<path d="M5 2h14v20H5zM8 6h8m-8 4h8m-8 4h4"/><path d="m13 18 2 2 5-5"/>',
  event:'<circle cx="12" cy="12" r="7"/><path d="M12 1v5m0 12v5M1 12h5m12 0h5M4 4l3 3m10 10 3 3M4 20l3-3M17 7l3-3"/>',
  haven:'<path d="m2 12 10-9 10 9M5 10v12h14V10M9 22v-8h6v8"/>',
  harbinger:'<path d="m12 2 5 5-2 5 6 6-7-2-2 6-2-6-7 2 6-6-2-5Z" fill="currentColor" stroke="none"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-11v1"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 1 1 4 3c-1 .5-1 1-1 3m0 3v.1"/>',
  alert:'<path d="m12 2 10 19H2Z"/><path d="M12 8v6m0 3v.1"/>',
  undo:'<path d="m8 3-6 6 6 6M2 9h12a7 7 0 0 1 0 14"/>',
  next:'<path d="M3 12h18m-7-7 7 7-7 7"/>',
  chevron:'<path d="m7 10 5 5 5-5"/>',
  check:'<path d="m4 12 5 5L20 5"/>',
  plus:'<path d="M12 4v16M4 12h16"/>',
  minus:'<path d="M4 12h16"/>',
  fit:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="3"/>',
  download:'<path d="M12 2v13m-5-5 5 5 5-5M3 18v4h18v-4"/>',
  lock:'<path d="M5 11h14v11H5zM8 11V6a4 4 0 0 1 8 0v5"/>',
  search:'<circle cx="10" cy="10" r="7"/><path d="m15 15 7 7"/>'
};
Object.assign(paths,{
  any_resource:'<path d="m12 2 9 5v10l-9 5-9-5V7Z"/><path d="m12 6 5 3v6l-5 3-5-3V9Z"/><path d="M12 6v12M7 9l10 6m0-6-10 6"/>',
  advance_lowest:'<path d="M4 21V9h4v12m2 0v-6h4v6m2 0V4h4v17M8 9l4-5 4 5m-4-5v7"/>',
  advance_track:'<path d="M3 15h4v6H3Zm7 0h4v6h-4Zm7 0h4v6h-4ZM7 18h3m4 0h3M3 7h18m-4-4 4 4-4 4"/>',
  discard_crisis:'<path d="M5 2h14v20H5zM8 6h8M8 10h5m-3 5 5 5m-5 0 5-5"/>',
  leadership:'<path d="M5 2v20M5 4h15l-4 5 4 5H5Z"/>'
});
const ships={
  corvette:'M16 1 23 17 21 25 16 22 11 25 9 17Z',
  destroyer:'M16 1 21 10 21 17 28 24 24 30 16 26 8 30 4 24 11 17 11 10Z',
  dreadnought:'M12 1H20L24 8 24 12 30 18 28 30H22L20 25H12L10 30H4L2 18 8 12 8 8Z',
  carrier:'M11 2H21V8L28 10V27L23 30 20 25H12L9 30 4 27V10L11 8Z',
  sentry:'M16 1 23 6 21 13 31 20 25 29 16 24 7 29 1 20 11 13 9 6Z',
  voidborn:'M16 0 20 10 30 5 25 16 31 27 20 24 16 32 12 24 1 27 7 16 2 5 12 10Z'
};
const aliases={farmers_guild:'food',engineers_guild:'energy',miners_guild:'materials',bankers_guild:'credits',scientists_guild:'science',conquest:'voidborn',development:'shipyard',innovation:'tech',politics:'statecraft',production:'food',progress:'science',prosperity:'economy',reinforcement:'shipyard',temptation:'corruption',upkeep:'food',fleet_active:'corvette',fleet_inactive:'corvette',activate:'corvette',deploy:'shipyard',regroup:'corvette',invade:'voidborn',skirmish:'defense',basic_tech:'tech',improved_tech:'tech',catastrophe:'corruption',gain_trade:'trade',gain_agenda:'agenda',gain_tech:'tech',increase_population:'population',military:'voidborn',economic:'economy',support:'society',might:'voidborn',wealth:'credits',dominance:'house',gain_corruption:'corruption',remove_corruption:'reclaim',move_corruption:'corruption',build:'shipyard',establish:'house',produce:'food',third_action:'plus',salvoDamage:'voidborn',salvoAbsorption:'defense',approachDamage:'voidborn',approachAbsorption:'defense'};
Object.assign(aliases,{engage:'voidborn',strategize:'agenda',prepare:'corvette',grow:'house',settle:'shipyard',harmonize:'population',research:'science',invent:'tech',consolidate:'agenda',inspire:'statecraft',prevail:'voidborn',control:'trade',thrive:'society',supply:'food',optimize:'reclaim',experiment:'science',restore:'reclaim',flourish:'economy',store:'materials',organize:'shipyard',accelerate:'economy',muster:'corvette',mobilize:'corvette',exploit:'glory',conspire:'corruption',exert:'corvette'});
Object.assign(aliases,{any:'any_resource',any_fem:'any_resource',any_guild:'house',guild:'house',focus:'cards',track:'advance_track',society_track:'society',statecraft_track:'statecraft',economy_track:'economy',track_corruption:'corruption',safe_haven:'haven',galactic_event:'event',recall:'corvette',deactivate:'corvette',unbuild:'shipyard',unguild:'house',discard_bounty:'bounty',discard_glory:'glory',discard_reclaim:'reclaim',score_glory:'glory',score_agenda:'agenda',return_voidborn:'voidborn',place_voidborn:'voidborn'});
export function glyphName(name){name=String(name||'info').toLowerCase().replace(/^heroic /,'').replaceAll(' ','_').replace(/_\d.*$/,'');return aliases[name]||name;}
export function icon(name,size=22){
  name=glyphName(name);
  if(ships[name])return ship(name,size);
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.info}</svg>`;
}
export function ship(type='corvette',size=32){return `<svg class="ship" width="${size}" height="${size}" viewBox="0 0 32 34" aria-hidden="true"><path d="${ships[type]||ships.corvette}" fill="currentColor"/>${type==='voidborn'?'':'<path d="M16 9v11m-3-5h6" fill="none" stroke="var(--abyss)" stroke-width="2"/><path d="M12 31h3m2 0h3" stroke="currentColor" stroke-width="2"/>'}</svg>`;}
export function crest(name,size=60){
  return `<svg class="crest" width="${size}" height="${size}" viewBox="-3 0 86 92" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">${houseEmblems[name]||houseEmblems.Valnis}${housePennant}</svg>`;
}
export function dial(value,max=13){const r=30,c=2*Math.PI*r;return `<svg class="dial" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="${r}" fill="none" stroke="currentColor" opacity=".17" stroke-width="6"/><circle cx="40" cy="40" r="${r}" fill="none" stroke="currentColor" stroke-width="6" stroke-dasharray="${c*Math.min(value,max)/max} ${c}" transform="rotate(-90 40 40)"/>${Array.from({length:max+1},(_,i)=>`<path d="M40 6v5" transform="rotate(${i*360/(max+1)} 40 40)" stroke="var(--abyss)" stroke-width="3"/>`).join('')}</svg>`;}
export function sectorFace(seed=0){return `<svg class="hex-face" viewBox="0 0 240 208" aria-hidden="true"><path class="hex-fill" d="M60 2H180L238 104 180 206H60L2 104Z"/><path class="hex-inner" d="M65 10H175L228 104 175 198H65L12 104Z"/><path class="orbit" d="M28 104h15m154 0h15M92 191h56M92 17h56"/><path class="orbit" d="m34 72 11 0m150 64h11M34 136h11m150-64h11"/><circle class="orbit" cx="120" cy="105" r="65" stroke-dasharray="2 9"/><circle class="orbit" cx="${seed%2?181:58}" cy="${seed%2?145:67}" r="3"/></svg>`;}
