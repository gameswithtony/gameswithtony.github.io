import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {encodeSave,decodeSave,makeSave,validateSave} from '../js/saves.js';
import {config} from './helpers.mjs';
const library=fs.readFileSync(new URL('../lz-string.min.js',import.meta.url),'utf8');
vm.runInThisContext(library);
const catalog={scenarios:[{name:'First Stand'}],houses:[{name:'Valnis'}]};
test('VF1 compressed game codes round trip and reject malformed or foreign saves',()=>{
  const save=makeSave(config,[{kind:'option',code:1,index:0}]);
  assert.deepEqual(decodeSave(encodeSave(save),catalog),save);
  assert.deepEqual(decodeSave(JSON.stringify(save),catalog),save);
  assert.throws(()=>decodeSave('WM1:abc',catalog));
  assert.throws(()=>decodeSave('VF1:broken',catalog));
  assert.throws(()=>validateSave({...save,config:{...config,house:'invented'}},catalog));
  assert.throws(()=>validateSave({...save,journal:[{kind:'option',code:1,index:-1}]},catalog));
});
