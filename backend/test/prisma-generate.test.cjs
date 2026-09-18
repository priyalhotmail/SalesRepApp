const {test}=require("node:test");
const assert=require("node:assert/strict");
const {backendProcesses}=require("../scripts/prisma-generate.cjs");
const backend="D:\\Work Space\\SalesRepApp\\backend";
const cli="D:\\Work Space\\SalesRepApp\\node_modules\\@nestjs\\cli\\bin\\nest.js";
test("matches this backend and its watcher, excluding frontend and other projects",()=>{
 const rows=[
  {ProcessId:1,CommandLine:'node --enable-source-maps "D:\\Work Space\\SalesRepApp\\backend\\dist\\main"'},
  {ProcessId:2,CommandLine:'"node" "D:\\Work Space\\SalesRepApp\\node_modules\\.bin\\..\\@nestjs\\cli\\bin\\nest.js" start --watch'},
  {ProcessId:3,CommandLine:'node "D:\\Work Space\\SalesRepApp\\node_modules\\vite\\bin\\vite.js"'},
  {ProcessId:4,CommandLine:'node "D:\\Work Space\\OtherApp\\backend\\dist\\main"'},
  {ProcessId:5,CommandLine:'node "D:\\Work Space\\SalesRepApp-copy\\backend\\dist\\main"'},
  {ProcessId:6,CommandLine:null},
  {ProcessId:7,CommandLine:'node "D:\\Work Space\\SalesRepApp\\node_modules\\@nestjs\\cli\\bin\\nest.js" build'},
 ];
 assert.deepEqual(backendProcesses(rows,backend,cli).map(p=>p.ProcessId),[1,2]);
});
test("matches main.js with normalized casing and separators",()=>{
 assert.equal(backendProcesses([{CommandLine:'node "d:/work space/salesrepapp/backend/dist/main.js"'}],backend,cli).length,1);
});
