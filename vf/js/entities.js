// User-facing names for board destinations. Engine IDs never become labels.
const name=s=>s.replace(/^./,c=>c.toUpperCase());
export function alertInfo(piece){
  if(!piece?.id?.startsWith('alert_cards.'))return {};
  if(piece.type==='war')return {name:'War Alert',glyph:'voidborn',entityType:'alert',typeLabel:'War',displayRef:'',actionDescription:'No new Crisis is revealed this round. Apply the War modifier for the current Cycle during the Skirmish.'};
  return {name:`Level ${piece.level} Alert`,glyph:'alert',entityType:'alert',typeLabel:'Situation',displayRef:'',actionDescription:`Reveal a level ${piece.level} Crisis this turn.`};
}
export function destinationInfo(piece){
  const id=piece?.id||'';
  const track=id.match(/^tracks\.[^_]+_(society|statecraft|economy)$/);
  if(track){const key=track[1];return {name:name(key)+' track',glyph:key,entityType:'track',track:key,choiceDescription:`Space ${piece.index||0} · ${piece.corrupted?'Corrupted':'Pure'}`,actionDescription:`Space ${piece.index||0} of 7 · ${piece.corrupted?'Corrupted':'Pure'}. Corrupted tracks can advance, but do not grant their space benefits.`};}
  const slot=id.match(/^agendas\.[^_]+_(\d+)$/);
  if(slot){const index=Number(slot[1]);return {name:index===0?'Starting Agenda slot':'Agenda slot '+index,glyph:'agenda',entityType:'agenda-slot',actionDescription:piece.corrupted?'Corrupted · its Agenda cannot be evaluated.':piece.card?'Occupied · Pure Agenda slot.':'Empty · Pure Agenda slot.'};}
  const chamber=id.match(/^dc_[^_]+_(\d+)$/);
  if(chamber)return {name:'Decontamination chamber '+(Number(chamber[1])+1),glyph:'corruption',entityType:'storage',actionDescription:piece.corrupted?'Contains Corruption.':'Available Corruption storage.'};
  if(id.startsWith('ep_'))return {name:'Escape Pods trade slot',glyph:'trade',entityType:'storage',actionDescription:piece.trade?'Contains a Trade token.':'Available Trade-token storage.'};
  if(/^haven_\d+$/.test(id))return {name:'Safe Haven '+id.split('_')[1],glyph:'haven',entityType:'haven',actionDescription:`${piece.cubes?.length||0} of ${piece.capacity||0} Fleet Power.`};
  return {};
}
