// Short rules explanations for action choices, separate from their compact labels.
const rules={
  establish:['Establish','Add a Guild to a free Guild space in one of your sectors. Its resource’s production level increases by that sector’s Population.','18–20'],
  build:['Build','Add a Shipyard or Sector Defense to a free Installation space in one of your sectors. Starbases require the matching Technology.','18–19'],
  activate:['Activate','Move inactive Fleet Power into your active supply, ready to deploy.','21'],
  deploy:['Deploy','Move active Fleet Power onto an eligible sector, forming or reinforcing a Fleet. Shipyards and Technologies determine where and how much you can deploy.','21'],
  regroup:['Regroup','Make up to five Fleet Power moves between adjacent sectors you control. Cannot abandon a non-Home sector or cross a Voidstorm.','23'],
  invade:['Invade','Send Fleet Power from adjacent sectors into a sector you do not control. Resolve combat to take control and collect its rewards.','23–27'],
  produce:['Produce','Gain the selected resource’s current production yield. Each stockpile holds at most 15.','19–20'],
  increase_population:['Increase Population','Raise an eligible sector’s Population by 1, up to 6. Each Guild there contributes more to its resource’s production level.','19–20'],
  advance_track:['Advance track','Move one space along the specified Civilization track and resolve its benefit. Corrupted tracks do not grant space benefits.','28–29'],
  gain_tech:['Gain Technology','Gain an available Basic Technology or improve one you own. Resolve its immediate effect and apply its permanent ability.','31'],
  gain_agenda:['Gain Agenda','Take an Agenda into your hand. Play it with a later Focus to gain its scoring opportunities.','30'],
  gain_trade:['Gain Trade','Take a Trade token and resolve its benefit. Use it with a Focus to unlock the third action.','30'],
  gain_corruption:['Gain Corruption','Place Corruption on an eligible sector, Agenda slot or Civilization track. Corrupted pieces lose their Pure benefits.','29'],
  remove_corruption:['Remove Corruption','Return an eligible Corruption marker to the supply, restoring the affected piece’s Pure benefits.','29'],
  move_corruption:['Move Corruption','Move an existing Corruption marker to another eligible location. Its former location becomes Pure.','29'],
  upgrade_glory:['Upgrade Glory','Replace a Glory token with one worth exactly 1 more. Value 5 tokens cannot be upgraded.','27']
};
export function actionHelp(action){
  const found=new Map();
  function visit(a){
    if(!a)return;
    if(Array.isArray(a)){a.forEach(visit);return;}
    if(typeof a==='object'){
      if(a.action)visit(a.action);
      for(const key of ['either_or','both_and','simple_list'])if(a[key])visit(a[key]);
    }
    const verb=typeof a==='string'?a:a.verb;
    if(rules[verb]){const [title,text,pages]=rules[verb];found.set(verb,{title,text,reference:'Rulebook pp. '+pages+'.'});}
  }
  visit(action);return [...found.values()];
}
