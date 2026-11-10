// Keep calculation branches in the worker; send only the chosen route's display data.
export function combatView(route){
  const start=route.full?.[0]||{},playerRole=start.invader?.colour==='blue'?'invader':'defender';
  const sector=start.sectorID?.match(/sectors\.(\d+)-(\d+)/);
  const opponent=playerRole==='invader'?'defender':'invader';
  const side=start[opponent]||{};
  return {winner:route.winner,ending:route.ending||{},cost:route.cost||{},display:route.display||[],
    playerRole,opponentLabel:side.colour==='voidborn'||side.fleets?.voidborn?'Voidborn':'Sector defenses',
    sector:sector?String.fromCharCode(65+Number(sector[1]))+(Number(sector[2])+1):'',
    kind:start.options?.skirmish?'Skirmish':'Invasion'};
}
export function combatResult(route){return route.winner==='draw'?'Mutual destruction':route.winner===route.playerRole?'Victory':'Defeat';}
export function combatPhase(step,route){
  if(step.type==='starting')return 'Starting forces';
  if(step.type==='approach')return 'Approach';
  if(step.type==='salvo')return `Salvo ${step.round||1} · ${step.timing==='sim'?'Simultaneous':step.timing===route.playerRole?'You fire':route.opponentLabel+' fires'}`;
  return 'Resolution';
}
