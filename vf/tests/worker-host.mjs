// Runs the same rules worker under Node. No browser or user profile involved.
import {parentPort} from 'node:worker_threads';
globalThis.postMessage=message=>parentPort.postMessage(message);
globalThis.onmessage=null;
globalThis.addEventListener=(name,fn)=>{if(name==='unhandledrejection')process.on('unhandledRejection',reason=>fn({reason,preventDefault(){}}));};
await import('../js/worker.js');
parentPort.on('message',data=>globalThis.onmessage({data}));
