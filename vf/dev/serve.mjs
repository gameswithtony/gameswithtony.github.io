import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.md':'text/plain; charset=utf-8','.json':'application/json','.woff2':'font/woff2','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400);res.end();return}
  if(pathname.split('/').some(p=>p.startsWith('.')||['resources','tests','dev'].includes(p))){res.writeHead(404);res.end();return}
  const file=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
  if(!file.startsWith(root+path.sep)||!types[path.extname(file)]){res.writeHead(404);res.end();return}
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);res.end('Not found');return}res.writeHead(200,{'content-type':types[path.extname(file)],'cache-control':'no-store','x-content-type-options':'nosniff'});res.end(data)});
});
server.listen(Number(process.argv[2]||8086),'127.0.0.1',()=>console.log('Local Voidfall: http://127.0.0.1:'+server.address().port));
