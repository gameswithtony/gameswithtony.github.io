// Persistence belongs to the host UI. Rules-side legacy saves are intentionally inert.
const table={put:async()=>{},get:async()=>null,delete:async()=>{},where:()=>[],toArray:async()=>[]};
export const dex={games:table,fullGames:table};
