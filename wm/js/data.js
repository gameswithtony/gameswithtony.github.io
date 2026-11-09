// Component values transcribed from the supplied TTS board, tiles and official rules.
// Artwork is deliberately absent. See resources/COMPONENTS.md for local research.
export const WEATHER = ['rain', 'wind', 'sun', 'fog', 'snow'];
export const WEATHER_NAME = { rain:'Rain', wind:'Wind', sun:'Sun', fog:'Fog', snow:'Snow' };
export const COLORS = ['green','white','pink','magenta','blue'];
export const CHEMS = COLORS;
export const COLOR_NAME = {green:'Verdino · green',white:'Melgoth · white',pink:'Delugium · pink',magenta:'Calorium · magenta',blue:'Radieu · blue'};
export const COLOR_LETTER = {green:'G',white:'W',pink:'P',magenta:'M',blue:'B'};
export const VOUCHER_NAME = {supply:'Supply',government:'Government',lab:'Lab',rd:'R&D',science:'Science'};
export const VOUCHER_CAP = {supply:5,government:3,lab:5,rd:3,science:3};
export const CAP = VOUCHER_CAP;
export const LOCATION_NAME = {1:'Supply',2:'Government',3:"Lativ’s Lab",4:'R&D',5:"Lativ’s Office"};
export const LOCATION_GAIN = {2:'lab',3:'rd',4:'government'};
export const CHEMICAL_PRICES = [1,1,2,2,3];
const b = (type,n=1,kind) => ({type,n,...kind?{kind}:{}});
const voucher = (kind='any',n=1) => b('voucher',n,kind);
const funding = (kind='any',n=1) => b('funding',n,kind);
const action = (kind,noChemical=false,noPart=false) => ({type:'action',kind,...noChemical?{noChemical:true}:{},...noPart?{noPart:true}:{}});
export const LOCATION = Object.fromEntries([2,3,4].map(l=>[l,[2,1,1].map(actions=>({gain:LOCATION_GAIN[l],actions}))]));
// Government spaces are clockwise from the left: left, top, right.
export const GOV = {rain:['pink','magenta','pink'],wind:['green','blue','green'],sun:['pink','green','white'],fog:['white','blue','white'],snow:['magenta','blue','magenta']};
// Lab columns have differing capacities; Wind and Fog have only two spaces.
export const LAB = {rain:['green','pink','white'],wind:['blue','green'],sun:['pink','blue','magenta'],fog:['white','pink'],snow:['magenta','green','blue']};
export const RD = {
 rain:[{color:'magenta',reward:[b('chemical')]},{color:'pink',reward:[b('chemical')]},{color:'pink',reward:[b('bot')],extra:'chemical'}],
 wind:[{color:'blue',reward:[b('workshop')]},{color:'green',reward:[b('workshop')]},{color:'green',reward:[b('bot')],extra:'part'}],
 sun:[{color:'pink',reward:[b('part')]},{color:'green',reward:[b('part')]},{color:'white',reward:[b('bot')],extra:'chemical'}],
 fog:[{color:'white',reward:[voucher()]},{color:'white',reward:[voucher()]},{color:'blue',reward:[b('bot')],extra:'part'}],
 snow:[{color:'blue',reward:[funding()]},{color:'magenta',reward:[funding()]},{color:'magenta',reward:[b('bot')],extra:'chemical'}]
};
export const ASSEMBLY = [
 {cost:1,reward:[voucher('lab')]},{cost:1,reward:[voucher('rd')]},{cost:1,reward:[voucher('government')]},
 {cost:2,reward:[voucher('science')]},{cost:2,reward:[voucher('supply')]},{cost:2,reward:[b('part')]},
 {cost:2,reward:[action('work',true)]},{cost:2,reward:[voucher()]},{cost:2,reward:[b('chemical')]},
 {cost:3,reward:[funding('rd')]},{cost:3,reward:[funding('lab')]},{cost:3,reward:[funding('government')]}
];
export const OFFICE = [
 {spaces:[[funding('government')],[],[]],publish:[b('chemical')]},
 {spaces:[[],[funding('lab')],[]],publish:[voucher('any',2)]},
 {spaces:[[],[],[funding('rd')]],publish:[funding(),funding()]},
 {spaces:[[voucher('supply',2)],[],[]],publish:[b('bot')]},
 {spaces:[[],[voucher('supply',2)],[]],publish:[action('work',true)]},
 {spaces:[[],[],[voucher('supply',2)]],publish:[b('part',2)]}
];
export const GOAL_SPACES = Object.fromEntries(['government','lab','rd'].map(k=>[k,[[voucher(),b('chemical')],[b('part')]]]));
export const SECURE_COLUMNS = {rain:[voucher('lab')],wind:[voucher('science')],sun:[voucher('supply')],fog:[voucher('science')],snow:[voucher('rd')]};
export const SECURE_ROWS = [[voucher('science')],[voucher('rd')],[voucher('lab')]];
export const FUNDING = {
 government:Array.from({length:10},(_,p)=>({cp:p>=8?7:p>=6?5:p>=4?3:p>=2?1:0,benefits:[voucher(),...p>=2?[b('chemical')]:[],...p>=4?[voucher()]:[],...p>=7?[b('bot')]:[],...p>=9?[b('cp',3)]:[]]})),
 lab:Array.from({length:10},(_,p)=>({cp:p>=8?4:p>=6?3:p>=4?2:p>=2?1:0,science:Number(p>=2)+Number(p>=4)+Number(p>=7),modifier:[0,1,1,2,2,3,3,4,4,5][p],benefits:[]})),
 rd:Array.from({length:10},(_,p)=>({cp:p>=9?7:p>=7?6:p>=5?5:p>=3?4:p>=1?3:0,benefits:[],alternatives:[...p>=1?[[b('part')]]:[],...p>=3?[[b('cp',3),b('part')]]:[],...p>=5?[[b('part',2)]]:[],...p>=7?[[b('cp',5),b('part')]]:[],...p>=9?[[b('cp',7)]]:[]]}))
};
export const REPORTS = [
 ['pink',2,'snow','top'],['pink',3,'rain','top'],['pink',4,'wind','top'],['pink',2,'wind','bottom'],['pink',3,'sun','bottom'],['pink',4,'fog','bottom'],['pink','lativ','rain','bottom'],
 ['pink',3,'sun','top'],['pink','lativ','snow','bottom'],['pink',1,'fog','top'],['white',2,'rain','top'],['white',3,'snow','top'],['white',4,'sun','top'],['white',2,'sun','bottom'],
 ['white',3,'wind','bottom'],['white',4,'fog','bottom'],['white','lativ','snow','top'],['white',3,'wind','bottom'],['white','lativ','rain','top'],['white',1,'wind','top']
].map(([agent,location,weather,priority],id)=>({id,agent,location,weather,priority}));
export const EXPERIMENTS = [
 ...WEATHER.map((weather,i)=>({id:i,stage:1,weather,cost:1,cp:[5,2,5,2,5][i],rewards:[[i===1||i===3?action('work'):b('part',2)],[b('investment')]]})),
 ...WEATHER.map((weather,i)=>({id:5+i,stage:2,weather,cost:2,cp:[6,3,6,3,6][i],rewards:[[i===0?action('research',true):i===2?b('bot'):i===4?action('sell'):b('part',2)],[b('investment')]]})),
 ...WEATHER.map((weather,i)=>({id:10+i,stage:3,weather,cost:1,cp:[7,4,7,4,7][i],rewards:[[action(i===1||i===3?'publish':'breakthrough')],[b('investment')]]}))
];
const extraParts={rain:[['blue'],['blue','blue']],wind:[['magenta'],['green','magenta']],sun:[['pink'],['pink','pink']],fog:[['green'],['green','magenta']],snow:[['white'],['white','white']]};
export const EXTREME = Object.fromEntries(WEATHER.map(w=>[w,[
 {cost:0,parts:[],spaces:[[b('part')],[b('cp',2)],[w==='rain'||w==='sun'?b('chemical'):w==='wind'||w==='snow'?funding():voucher()]]},
 {cost:1,parts:extraParts[w][0],spaces:[[b('part')],[b('cp',2)]]},
 {cost:2,parts:extraParts[w][1],spaces:[[b('investment')]]}
]]));
export const SUBSIDIES = [
 {name:'Research without a Chemical',benefits:[action('research',true)]},
 {name:'Publish a Paper',benefits:[action('publish')]},
 {name:'Sell a Part without a Part',benefits:[action('sell',false,true)]},
 {name:'Construct a Bot',benefits:[b('bot')]},
 {name:'Work without a Chemical',benefits:[action('work',true)]},
 {name:'Construct a Bot',benefits:[b('bot')]},
 {name:'Publish a Paper',benefits:[action('publish')]},
 {name:'Research without a Chemical',benefits:[action('research',true)]},
 {name:'Work without a Chemical',benefits:[action('work',true)]},
 {name:'Sell a Part without a Part',benefits:[action('sell',false,true)]},
 {name:'Acquire a Chemical',benefits:[b('chemical')]},
 {name:'Advance funding',benefits:[funding()]},
 {name:'Gain 2 Vouchers',benefits:[voucher('any',2)]},
 {name:'Gain a Machine Part',benefits:[b('part')]},
 {name:'Extend Workshop',benefits:[b('workshop')]}
].map((s,id)=>({...s,id}));
// All 36 goals; majority objectives and the three-Awards objective are excluded in solo setup.
const goalRows = [
 ['lab','sameRows',2,'Complete 2 Office rows for the same weather'],['lab','funding:lab',0,'Lead Lab funding',true],['lab','bottomRightBots',3,'Construct all 3 bottom-right Assembly Bots'],
 ['rd','distinctResearch:rd',5,'Have 5 different token types in the R&D Office column'],['rd','awards3',3,'Gain 3 Awards'],['rd','rdBots',0,'Have the most Bots in R&D',true],
 ['government','governmentResearch',0,'Have the most Government Office tokens',true],['government','workshops',0,'Have the most Workshop tiles',true],['government','sameBots:government',3,'Have 3 Bots in one Government branch'],
 ['lab','officeTokens',12,'Have 12 tokens in your Office'],['lab','workshopBots',0,'Have the most Bots in your Workshop',true],['lab','distinctResearch:lab',5,'Have 5 different token types in the Lab Office column'],
 ['rd','awards',0,'Have the most Awards',true],['rd','sameBots:rd',3,'Have 3 Bots in one R&D branch'],['rd','rdResearch',0,'Have the most R&D Office tokens',true],
 ['government','parts',3,'Have 3 Machine Parts in your Workshop'],['government','bots:government',4,'Have Bots in 4 Government branches'],['government','columnTokens:government',6,'Fill all 6 Government Office spaces'],
 ['lab','constructed',0,'Have the most constructed Bots',true],['lab','rows',3,'Complete 3 Office rows'],['lab','columnTokens:lab',6,'Fill all 6 Lab Office spaces'],
 ['rd','rdBots',5,'Have 5 Bots in R&D'],['rd','papers',0,'Have the most published papers',true],['rd','funding:rd',0,'Lead R&D funding',true],
 ['government','distinctResearch:government',5,'Have 5 different token types in the Government Office column'],['government','governmentBots',5,'Have 5 Government Bots'],['government','subsidies',0,'Have the most Subsidies',true],
 ['government','governmentBots',0,'Have the most Government Bots',true],['government','subsidies',5,'Have 5 Subsidies'],['government','funding:government',0,'Lead Government funding',true],
 ['rd','bots:rd',4,'Have Bots in 4 R&D branches'],['rd','papers',4,'Publish 4 papers'],['rd','columnTokens:rd',6,'Fill all 6 R&D Office spaces'],
 ['lab','officeTokens',0,'Have the most Office tokens',true],['lab','constructed',10,'Construct at least 10 Bots'],['lab','labResearch',0,'Have the most Lab Office tokens',true]
];
const GOAL_MIDDLE = {
 0:'completedRows',19:'completedRows',
 3:'rdOfficeColumn',32:'rdOfficeColumn',
 11:'labOfficeColumn',20:'labOfficeColumn',
 17:'governmentOfficeColumn',24:'governmentOfficeColumn',
 8:'governmentBots',16:'governmentBots',25:'governmentBots',
 13:'rdBots',21:'rdBots',30:'rdBots'
};
export const GOALS = goalRows.map(([kind,condition,need,name,majority=false],id)=>({id,kind,condition,need,name,majority,middle:GOAL_MIDDLE[id]||condition}));
// Ten distinct faces, three copies of each, verified from nested TTS bag textures.
const WORKSHOP_FACES = [
 ['white','green'],['white','blue'],['magenta','blue'],['pink','white'],['pink','magenta'],
 ['green','magenta'],['green','pink'],['magenta','white'],['blue','green'],['blue','pink']
];
// Preserve the actual thirty-child order in the source bag for reproducible shuffles.
const WORKSHOP_ORDER = [0,1,2,3,4,5,6,0,7,1,8,8,9,7,2,6,0,4,4,9,1,5,2,3,6,5,3,8,7,9];
export const WORKSHOPS = WORKSHOP_ORDER.map((face,id)=>({id,top:WORKSHOP_FACES[face][0],bottom:WORKSHOP_FACES[face][1]}));
export const CHALLENGES = [
 ['Fully Stocked Opponents','Saboteurs begin with one Chemical of each type.'],
 ['Jamming Devices','Each income raises the Target by 1 per Saboteur Bot on the board.'],
 ['Creative Accounting','Saboteurs begin with an Award. Each income moves one of your Funding markers back one space.'],
 ['Nobel Laureate','Saboteurs begin with an extra random Chemical. Victory requires the Nobel Prize.'],
 ['Only Overachievers Apply','Victory requires meeting at least 5 active Goals.'],
 ['The Clock is Ticking','Remove the top 2 Security Reports after setup.'],
 ['One Step Ahead','At the end of your turn, raise the Target by 3 if Saboteurs lead Initiative.'],
 ['Moral High Ground','Saboteurs to your left do not grant additional Vouchers.'],
 ['Peer Review','You cannot cite papers or pay Science for 3 CP when unlocking citations.'],
 ['Independent Prototypes','Saboteurs begin with an Award. Their Bots cannot supply prototype Parts.'],
 ['Budget Cuts','Saboteurs begin with an extra random Chemical. Lab funding modifier is always +0.'],
 ['Publish or Perish','Target starts 5 lower. Each citation unlock caused by Saboteurs raises it by 5. You must win by immediate victory.']
].map(([name,text],i)=>({id:i+1,name,text}));
export function benefitText(list=[]) {
 return list.map(x=>{const n=x.n??1;switch(x.type){case 'voucher':return `${n} ${VOUCHER_NAME[x.kind]||'any'} Voucher${n===1?'':'s'}`;case 'funding':return `+${n} ${VOUCHER_NAME[x.kind]||'any'} funding`;case 'cp':return `${n} CP`;case 'part':return `${n} Machine Part${n===1?'':'s'}`;case 'chemical':return `${n} Chemical${n===1?'':'s'}`;case 'bot':return 'Construct a Bot';case 'workshop':return 'Extend Workshop';case 'investment':return `${n} Investment${n===1?'':'s'}`;case 'award':return `${n} Award${n===1?'':'s'}`;case 'action':return ({work:'Work on Experiment',research:'Research',sell:'Sell a Part',publish:'Publish a Paper',breakthrough:'Breakthrough'}[x.kind]||x.kind)+(x.noChemical?' · no Chemical':'')+(x.noPart?' · no Part':'');default:return x.type;}}).join(' + ');
}
