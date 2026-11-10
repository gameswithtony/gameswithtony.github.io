import test from 'node:test';
import assert from 'node:assert/strict';
import {destinationInfo,alertInfo} from '../js/entities.js';
import {cardTile,refLabel} from '../js/views.js';
test('Corruption destinations use track names and matching glyphs, never engine IDs',()=>{
  for(const track of ['society','statecraft','economy']){
    const info=destinationInfo({id:'tracks.blue_'+track,index:2,corrupted:false});
    assert.equal(info.name,track[0].toUpperCase()+track.slice(1)+' track');assert.equal(info.glyph,track);assert.ok(!info.name.includes('blue'));assert.ok(!info.name.includes('.'));
  }
});
test('Agenda, Haven and Technology storage destinations have readable names',()=>{
  assert.equal(destinationInfo({id:'agendas.blue_2'}).name,'Agenda slot 2');
  assert.equal(destinationInfo({id:'dc_14a_0'}).name,'Decontamination chamber 1');
  assert.equal(destinationInfo({id:'ep_2a'}).name,'Escape Pods trade slot');
  assert.equal(destinationInfo({id:'haven_2',capacity:2,cubes:[]}).name,'Safe Haven 2');
});

test('All Situation levels and War Alerts hide their internal identifiers',()=>{
  for(const level of [1,2,3])assert.equal(alertInfo({id:`alert_cards.${level}#103`,type:'situation',level}).name,`Level ${level} Alert`);
  const card={id:'alert_cards.easy_medium_war1',type:'war',ref:'easy_medium_war1'};
  const info={...card,...alertInfo(card)};
  assert.equal(info.name,'War Alert');assert.equal(info.glyph,'voidborn');assert.equal(refLabel(info),'');
  assert.ok(!cardTile({cards:{[card.id]:info}},info).includes('· easy_medium_war1'));
  assert.match(info.actionDescription,/No new Crisis/);
});
