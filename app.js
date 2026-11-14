'use strict';
/* LIGHT LAB: zero dependencies, no server or arbitrary code execution. */
const $=id=>document.getElementById(id);
const MISSION={
  AND:{name:'AND 원리 확인',type:'기초 실험 · 01',description:'A와 B가 모두 ON인 경우에만 전구가 켜지는 회로를 설계하세요.',conditions:['A와 B가 모두 1이면 점등','둘 중 하나라도 0이면 소등'],expected:s=>s.A&&s.B},
  OR:{name:'OR 원리 확인',type:'기초 실험 · 02',description:'A와 B 중 적어도 하나가 ON이면 전구가 켜지는 회로를 설계하세요.',conditions:['A 또는 B 중 하나 이상이 1이면 점등','A와 B가 모두 0이면 소등'],expected:s=>s.A||s.B},
  NOT:{name:'NOT 원리 확인',type:'기초 실험 · 03',description:'A 스위치의 값을 뒤집어 전구를 제어하세요. A가 OFF이면 전구가 켜져야 합니다.',conditions:['A가 0이면 점등','A가 1이면 소등'],expected:s=>!s.A},
  SMART:{name:'전시관 스마트 조명',type:'최종 프로젝트 · 04',description:'관람객이 감지되거나 관리자가 수동으로 켜면 조명이 켜져야 합니다. 단, 점검 모드라면 항상 꺼져야 해요.',conditions:['A: 관람객 감지 → 1일 때 점등 조건','B: 관리자 수동 스위치 → 1일 때 점등 조건','C: 점검 모드 → 1이면 반드시 소등'],expected:s=>(s.A||s.B)&&!s.C}
};
const GATES={AND:{n:2,glyph:'&'},OR:{n:2,glyph:'≥1'},NOT:{n:1,glyph:'¬'},NAND:{n:2,glyph:'⊼'},NOR:{n:2,glyph:'⊽'},XOR:{n:2,glyph:'⊕'}};
const WIDTH=1280,HEIGHT=690, NODE_W=142;
function baseline(){return [
  {id:'A',type:'INPUT',label:'A',x:100,y:145},
  {id:'B',type:'INPUT',label:'B',x:100,y:295},
  {id:'C',type:'INPUT',label:'C',x:100,y:445},
  {id:'Y',type:'LAMP',label:'Y',x:867,y:273}
]}
let nodes=baseline(), wires=[],inputState={A:false,B:false,C:false},mission='SMART',counter=0,selected=null,pending=null,
    attempts=[],activity=[],refl='',undoStack=[],currentResults=null,lastCheckedSignature='',toastTimer=null;
const clipNum=(x,min,max)=>Math.min(max,Math.max(min,Number(x)||0));
const nodeById=id=>nodes.find(n=>n.id===id);
const portCount=n=>n.type==='LAMP'?1:(GATES[n.type]?.n||0);
const inputWire=(id,index)=>wires.find(w=>w.to===id&&w.port===index);
const stamp=()=>new Date().toLocaleString('ko-KR');
function log(type,detail){activity.push({time:stamp(),type,detail});if(activity.length>300)activity.shift()}
function snapshot(){return {nodes:structuredClone(nodes),wires:structuredClone(wires),counter}}
function remember(){undoStack.push(snapshot());if(undoStack.length>50)undoStack.shift()}
function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600)}
function saveLocal(){try{localStorage.setItem('lightLabV3',JSON.stringify({nodes,wires,inputState,mission,counter,attempts,activity,refl,team:$('teamCode').value}))}catch(e){}}
function loadLocal(){try{const r=JSON.parse(localStorage.getItem('lightLabV3')||'null');if(!r)return;applyLoaded(r,true)}catch(e){}}
function sanitizeLoaded(raw){
  if(!raw||!Array.isArray(raw.nodes)||!Array.isArray(raw.wires))throw Error('잘못된 회로 파일입니다.');
  const base=baseline(),known=new Set(base.map(x=>x.id));let list=[...base];
  for(const obj of raw.nodes){if(!GATES[obj?.type]||typeof obj.id!=='string'||known.has(obj.id)||list.length>=44)continue;known.add(obj.id);list.push({id:obj.id,type:obj.type,label:obj.type,x:clipNum(obj.x,15,WIDTH-190),y:clipNum(obj.y,45,HEIGHT-180)})}
  for(const b of base){const old=raw.nodes.find(x=>x.id===b.id);if(old){b.x=clipNum(old.x,10,WIDTH-180);b.y=clipNum(old.y,45,HEIGHT-180)}}
  const ws=[];for(const w of raw.wires){const src=list.find(n=>n.id===w.from),dst=list.find(n=>n.id===w.to);const idx=Number(w.port);if(!src||!dst||src.type==='LAMP'||dst.type==='INPUT'||src.id===dst.id||!Number.isInteger(idx)||idx<0||idx>=portCount(dst))continue;if(!ws.some(a=>a.to===dst.id&&a.port===idx))ws.push({from:src.id,to:dst.id,port:idx})}
  return {nodes:list,wires:ws,counter:Math.min(Math.max(Number(raw.counter)||0,0),9999)}
}
function applyLoaded(raw,quiet=false){const clean=sanitizeLoaded(raw);nodes=clean.nodes;wires=clean.wires;counter=clean.counter;inputState={A:!!raw.inputState?.A,B:!!raw.inputState?.B,C:!!raw.inputState?.C};mission=MISSION[raw.mission]?raw.mission:'SMART';$('missionSelect').value=mission;attempts=Array.isArray(raw.attempts)?raw.attempts.slice(-100):[];activity=Array.isArray(raw.activity)?raw.activity.slice(-300):[];refl=String(raw.refl||'').slice(0,5000);$('reflection').value=refl;$('teamCode').value=String(raw.team||'').slice(0,32);pending=null;selected=null;currentResults=null;lastCheckedSignature='';updateMissionText();render();if(!quiet)toast('회로와 수행 기록을 불러왔습니다.');saveLocal()}
function gateGraphic(type){
 const shapes={
 AND:'<path d="M8 8 H28 C61 8 61 46 28 46 H8 Z"/>',
 OR:'<path d="M9 8 C25 15 25 39 9 46 C35 46 52 41 59 27 C52 13 35 8 9 8 Z"/>',
 NOT:'<path d="M7 8 L45 27 L7 46 Z"/><circle cx="51" cy="27" r="5"/>',
 NAND:'<path d="M4 8 H26 C55 8 55 46 26 46 H4 Z"/><circle cx="55" cy="27" r="4"/>',
 NOR:'<path d="M3 8 C20 15 20 39 3 46 C30 46 46 41 52 27 C46 13 30 8 3 8 Z"/><circle cx="56" cy="27" r="4"/>',
 XOR:'<path d="M10 8 C26 15 26 39 10 46 C36 46 52 41 59 27 C52 13 36 8 10 8 Z"/><path d="M3 8 C19 16 19 38 3 46"/>'
 };
 return '<svg width="56" height="46" viewBox="0 0 64 54" aria-label="'+type+' 게이트 기호" fill="#eaf1ff" stroke="#3263b5" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">'+shapes[type]+'</svg>'
}
function nodeHTML(n){const gate=GATES[n.type];const isInput=n.type==='INPUT',lamp=n.type==='LAMP';const width=lamp?165:142;
 const el=document.createElement('div');el.className='logic-node '+(isInput?'node-input ':'')+(lamp?'node-lamp ':'')+(selected===n.id?'selected ':'');
 el.dataset.node=n.id;el.style.left=n.x+'px';el.style.top=n.y+'px';el.style.width=width+'px';
 const head=document.createElement('div');head.className='node-head';const h1=document.createElement('span');h1.textContent=lamp?'LIGHT BULB':isInput?'TOGGLE SWITCH':n.type;const h2=document.createElement('small');h2.textContent=lamp?'OUTPUT':isInput?'INPUT':'GATE';head.append(h1,h2);el.append(head);
 const body=document.createElement('div');body.className='node-body';
 if(isInput){const core=document.createElement('div');core.className='node-core';core.textContent=n.label;const t=document.createElement('button');t.className='tiny-toggle '+(inputState[n.id]?'is-on':'');t.textContent=inputState[n.id]?'1 · ON':'0 · OFF';t.addEventListener('click',e=>{e.stopPropagation();toggleInput(n.id)});body.append(core,t)}
 else if(lamp){const icon=document.createElement('div');icon.className='lamp-icon';icon.textContent='💡';const label=document.createElement('div');label.className='lamp-state';label.textContent='Y = ?';body.append(icon,label)}
 else{const core=document.createElement('div');core.className='node-core';core.innerHTML=gateGraphic(n.type);const l=document.createElement('div');l.className='node-name';l.textContent=n.type==='NOT'?'입력 1개':'입력 2개';body.append(core,l)}
 el.append(body);if(!isInput){for(let i=0;i<portCount(n);i++){const p=document.createElement('button');p.className='pin in '+(portCount(n)===2?'two':'one');p.dataset.node=n.id;p.dataset.side='in';p.dataset.index=i;p.title=n.id+' 입력 '+(i+1);p.setAttribute('aria-label',n.id+' '+(i+1)+'번 입력 포트');if(lamp)p.style.top='92px';p.addEventListener('click',e=>{e.stopPropagation();portClick(n.id,'in',i)});el.append(p)}}
 if(!lamp){const p=document.createElement('button');p.className='pin out';p.dataset.node=n.id;p.dataset.side='out';p.title=n.id+' 출력';p.setAttribute('aria-label',n.id+' 출력 포트');p.addEventListener('click',e=>{e.stopPropagation();portClick(n.id,'out')});el.append(p)}
 head.addEventListener('pointerdown',e=>startMove(e,n,el,head));el.addEventListener('click',e=>{if(e.target.closest('.pin'))return;selected=n.id;renderNodes()});return el;
}
function startMove(e,n,el,handle){if(e.button!==0)return;e.preventDefault();selected=n.id;renderSelection();let oldX=n.x,oldY=n.y,originX=e.clientX,originY=e.clientY,moved=false;handle.setPointerCapture(e.pointerId);
 function move(ev){const dx=ev.clientX-originX,dy=ev.clientY-originY;if(Math.abs(dx)+Math.abs(dy)>4)moved=true;n.x=Math.round(clipNum(oldX+dx,8,WIDTH-(n.type==='LAMP'?178:153))/11)*11;n.y=Math.round(clipNum(oldY+dy,35,HEIGHT-(n.type==='LAMP'?185:136))/11)*11;el.style.left=n.x+'px';el.style.top=n.y+'px';drawWires()}
 function end(){handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);if(moved){undoStack.push({nodes:nodes.map(p=>p.id===n.id?{...p,x:oldX,y:oldY}:{...p}),wires:structuredClone(wires),counter});log('노드 이동',n.id);changed()}renderSelection()}
 handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end)
}
function renderSelection(){for(const el of document.querySelectorAll('.logic-node'))el.classList.toggle('selected',el.dataset.node===selected)}
function renderNodes(){const layer=$('nodeLayer');layer.innerHTML='';for(const n of nodes)layer.append(nodeHTML(n));updateLive();drawWires();renderSelection()}
function render(){renderNodes();updateMissionText();renderControls();renderTestSummary()}
function renderControls(){for(const id of ['A','B','C']){const b=$('switch'+id);b.classList.toggle('on',inputState[id]);b.setAttribute('aria-pressed',String(inputState[id]))}}
function toggleInput(id){inputState[id]=!inputState[id];log('스위치',id+'='+Number(inputState[id]));renderNodes();renderControls();saveLocal()}
function portClick(id,side,index){if(side==='out'){pending=id;$('connectPrompt').textContent=id+' 출력 선택됨 → 연결할 입력 포트 ●를 누르세요.';renderNodes();toast('출력 선택 완료! 연결할 입력 포트를 클릭하세요.');return}
 if(!pending){toast('먼저 출발 노드의 오른쪽 출력 포트를 클릭하세요.');return}
 if(pending===id){toast('같은 노드에 직접 연결할 수 없어요.');return}
 remember();wires=wires.filter(w=>!(w.to===id&&w.port===index));wires.push({from:pending,to:id,port:index});log('배선',pending+' → '+id+' 입력 '+(index+1));pending=null;$('connectPrompt').textContent='연결 완료! 다음 출력을 선택하세요.';changed();renderNodes()}
function evalNode(id,values,visited=new Set(),memo=new Map()){
 if(memo.has(id))return memo.get(id);if(visited.has(id))return null;const n=nodeById(id);if(!n)return null;
 if(n.type==='INPUT'){const v=Boolean(values[n.id]);memo.set(id,v);return v}
 visited.add(id);let inp=[];for(let p=0;p<portCount(n);p++){const link=inputWire(id,p);if(!link){visited.delete(id);return null}const v=evalNode(link.from,values,visited,memo);if(v===null){visited.delete(id);return null}inp.push(v)}visited.delete(id);
 let out=null;switch(n.type){case 'LAMP':out=inp[0];break;case 'NOT':out=!inp[0];break;case 'AND':out=inp[0]&&inp[1];break;case 'OR':out=inp[0]||inp[1];break;case 'NAND':out=!(inp[0]&&inp[1]);break;case 'NOR':out=!(inp[0]||inp[1]);break;case 'XOR':out=inp[0]!==inp[1];break;}memo.set(id,out);return out
}
function getInputValue(id,p){const w=inputWire(id,p);if(!w)return null;return evalNode(w.from,inputState)}
function updateLive(){const v=evalNode('Y',inputState);const lamp=document.querySelector('.node-lamp');if(lamp){lamp.classList.toggle('is-on',v===true);lamp.querySelector('.lamp-state').textContent='Y = '+(v===null?'?':Number(v))}
 $('led').classList.toggle('on',v===true);$('liveText').textContent=v===null?'전구: 회로 연결 필요':v?'전구: ON · 점등 중':'전구: OFF · 소등 중';$('liveDetail').textContent='입력 A='+Number(inputState.A)+'  ·  B='+Number(inputState.B)+'  ·  C='+Number(inputState.C);
 for(const n of nodes){for(const side of ['out','in']){const ports=document.querySelectorAll('.pin[data-node="'+n.id+'"][data-side="'+side+'"]');for(const port of ports){const value=side==='out'?evalNode(n.id,inputState):getInputValue(n.id,Number(port.dataset.index));port.classList.toggle('high',value===true);port.classList.toggle('pending',side==='out'&&pending===n.id)}}}}
function portXY(id,side,p=0){const node=document.querySelector('.logic-node[data-node="'+id+'"]');if(!node)return null;let sel='.pin.'+side;if(side==='in')sel+='[data-index="'+p+'"]';const port=node.querySelector(sel);if(!port)return null;const nr=$('board').getBoundingClientRect(),r=port.getBoundingClientRect();return {x:r.left-nr.left+r.width/2,y:r.top-nr.top+r.height/2}}
function drawWires(){const svg=$('wires');svg.innerHTML='';const ns='http://www.w3.org/2000/svg';for(const [idx,w]of wires.entries()){const s=portXY(w.from,'out'),t=portXY(w.to,'in',w.port);if(!s||!t)continue;const bend=Math.max(50,Math.abs(t.x-s.x)*.52);const d=`M ${s.x} ${s.y} C ${s.x+bend} ${s.y}, ${t.x-bend} ${t.y}, ${t.x} ${t.y}`;const v=evalNode(w.from,inputState),cls=v===null?'unknown':v?'high':'low';const hit=document.createElementNS(ns,'path');hit.setAttribute('class','wire-hit');hit.setAttribute('d',d);hit.setAttribute('title','클릭하면 연결 삭제');hit.addEventListener('click',e=>{e.stopPropagation();remember();const removed=wires.splice(idx,1)[0];log('연결 삭제',removed.from+' → '+removed.to);changed();renderNodes();toast('연결선을 삭제했습니다.')});svg.append(hit);const path=document.createElementNS(ns,'path');path.setAttribute('class','wire '+cls);path.setAttribute('d',d);svg.append(path)} }
function changed(){currentResults=null;lastCheckedSignature='';renderTestSummary();saveLocal()}
function addGate(type,x,y){if(!GATES[type])return;if(nodes.length>=40){toast('게이트가 너무 많아요. 먼저 사용하지 않는 게이트를 삭제하세요.');return}remember();counter++;const id='g'+counter;const spots=[{x:355,y:150},{x:590,y:305},{x:690,y:135},{x:350,y:445},{x:810,y:440},{x:595,y:120},{x:605,y:500}];const loc=spots[(counter-1)%spots.length];const g={id,type,label:type,x:clipNum(x??loc.x,10,WIDTH-180),y:clipNum(y??loc.y,42,HEIGHT-155)};nodes.push(g);selected=id;log('게이트 추가',type+' ('+id+')');changed();renderNodes();toast(type+' 게이트 추가 완료')}
function deleteSelected(){if(!selected){toast('삭제할 게이트를 먼저 클릭하세요.');return}const n=nodeById(selected);if(n.type==='INPUT'||n.type==='LAMP'){toast('기본 스위치와 전구는 삭제할 수 없습니다.');return}remember();nodes=nodes.filter(n=>n.id!==selected);wires=wires.filter(w=>w.from!==selected&&w.to!==selected);log('게이트 삭제',selected);selected=null;changed();renderNodes()}
function resetCircuit(showNotice=true){remember();nodes=baseline();wires=[];inputState={A:false,B:false,C:false};counter=0;pending=null;selected=null;currentResults=null;log('초기화',mission);changed();render();if(showNotice)toast('새로운 빈 회로로 초기화했습니다.')}
function updateMissionText(){const m=MISSION[mission];$('missionSelect').value=mission;$('missionType').textContent=m.type;$('missionTitle').textContent=m.name;$('missionDescription').textContent=m.description;$('missionConditions').innerHTML='';for(const c of m.conditions){const p=document.createElement('div');p.textContent='✓ '+c;$('missionConditions').append(p)}$('attemptLabel').textContent='시도 '+attempts.filter(a=>a.mission===mission).length+'회'}
function truthRows(){const ans=[];for(let i=0;i<8;i++){const s={A:!!(i&4),B:!!(i&2),C:!!(i&1)};const expected=!!MISSION[mission].expected(s),actual=evalNode('Y',s);ans.push({A:Number(s.A),B:Number(s.B),C:Number(s.C),expected:Number(expected),actual:actual===null?null:Number(actual),pass:actual!==null&&actual===expected})}return ans}
function circuitExpr(id='Y',visited=new Set()){
 if(visited.has(id))return '↺';const n=nodeById(id);if(!n)return '?';if(n.type==='INPUT')return n.id;
 visited.add(id);let args=[];for(let p=0;p<portCount(n);p++){const w=inputWire(id,p);args.push(w?circuitExpr(w.from,visited):'?')}visited.delete(id);
 if(n.type==='LAMP')return args[0];if(n.type==='NOT')return '(NOT '+args[0]+')';if(n.type==='NAND')return '(NOT ('+args.join(' AND ')+'))';if(n.type==='NOR')return '(NOT ('+args.join(' OR ')+'))';return '('+args.join(' '+n.type+' ')+')'}
function renderTestSummary(){const current=attempts.filter(a=>a.mission===mission);$('attemptLabel').textContent='시도 '+current.length+'회';if(!currentResults){$('testScore').textContent='미검증';$('testScore').className='';$('testBadge').textContent='전체 조건 검증 전';$('tableArea').innerHTML='<p class="empty-msg">회로를 만든 뒤 검증 버튼을 누르면 각 입력의 실제 출력과 목표 출력을 비교합니다.</p>';$('feedback').textContent='';return}
 const r=currentResults,ok=r.filter(x=>x.pass).length,passed=ok===8;$('testScore').textContent=ok+' / 8';$('testScore').className=passed?'ok':'fail';$('testBadge').textContent=passed?'모든 조건 일치':'오류를 수정해 보세요';$('tableArea').innerHTML='';const t=document.createElement('table');t.className='test-table';t.innerHTML='<thead><tr><th>A</th><th>B</th><th>C</th><th>목표</th><th>실제</th><th>확인</th></tr></thead>';const body=document.createElement('tbody');for(const x of r){const tr=document.createElement('tr');tr.className=x.pass?'':'bad-row';for(const v of [x.A,x.B,x.C,x.expected,x.actual===null?'?':x.actual,x.pass?'✓':'✕']){const td=document.createElement('td');td.textContent=v;tr.append(td)}tr.lastChild.className=x.pass?'ok':'bad';body.append(tr)}t.append(body);$('tableArea').append(t);
 const f=$('feedback');f.innerHTML='';const msg=document.createElement('div');msg.className=passed?'success':'error';msg.textContent=passed?'모든 입력에서 조명이 요구 조건대로 동작합니다. 설계 근거와 수정 과정도 기록하세요.':r.some(x=>x.actual===null)?'일부 입력에서 결과가 ?입니다. 게이트의 미연결 포트나 순환 연결을 살펴보세요.':'서로 다른 결과가 나온 입력 조합을 비교하며 AND·OR·NOT의 조건을 다시 확인하세요.';f.append(msg)
}
function testAll(){const rows=truthRows(),good=rows.filter(x=>x.pass).length;currentResults=rows;const rec={attempt:attempts.filter(x=>x.mission===mission).length+1,mission,time:stamp(),correct:good,passed:good===8,expression:circuitExpr(),nodeCount:nodes.length-4,wireCount:wires.length,rows:structuredClone(rows),reflection:$('reflection').value.slice(0,5000)};attempts.push(rec);if(attempts.length>100)attempts.shift();log('전체 검증',mission+': '+good+'/8');renderTestSummary();saveLocal();toast(good===8?'8개 조건 모두 일치! 이제 설명과 성찰을 작성하세요.':'검증 결과 '+good+'/8: 표시된 불일치 조건을 확인하세요.')}
function undo(){if(!undoStack.length){toast('되돌릴 동작이 없습니다.');return}const s=undoStack.pop();nodes=s.nodes;wires=s.wires;counter=s.counter;pending=null;selected=null;log('되돌리기','이전 회로 상태 복원');changed();render();toast('직전 배치·배선 작업을 되돌렸습니다.')}
function downloadBlob(filename,text,mime){const blob=new Blob([text],{type:mime});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2500)}
function exportProject(){const team=$('teamCode').value.trim()||'익명모둠';const payload={format:'LIGHT_LAB_3',exportedAt:new Date().toISOString(),team,mission,inputState,nodes,wires,counter,attempts,activity,reflection:$('reflection').value};downloadBlob('LIGHT_LAB_'+filenameSafe(team)+'.json',JSON.stringify(payload,null,2),'application/json;charset=utf-8');toast('회로 + 검증 기록 + 성찰을 JSON으로 저장했습니다.')}
function filenameSafe(s){return String(s).replace(/[^a-zA-Z0-9가-힣_-]/g,'_').slice(0,32)}
function escCSV(v){const s=String(v==null?'':v);return '"'+s.replaceAll('"','""')+'"'}
function exportCSV(){const team=$('teamCode').value.trim()||'익명모둠';let rows=[['모둠','일시','미션','시도','정답개수','전체일치','논리식','게이트수','연결선수','A','B','C','목표출력','실제출력','일치','성찰']];for(const a of attempts){for(const r of a.rows){rows.push([team,a.time,a.mission,a.attempt,a.correct,a.passed?'예':'아니오',a.expression,a.nodeCount,a.wireCount,r.A,r.B,r.C,r.expected,r.actual===null?'미연결':r.actual,r.pass?'예':'아니오',a.reflection])}}if(rows.length===1){rows.push([team,'',mission,'','검증 기록 없음','','','','','','','','','','',$('reflection').value])}const csv='\ufeff'+rows.map(r=>r.map(escCSV).join(',')).join('\r\n');downloadBlob('LIGHT_LAB_'+filenameSafe(team)+'_검증기록.csv',csv,'text/csv;charset=utf-8');toast('CSV 파일을 저장했습니다.')}
function exprShow(){toast('현재 구성된 회로의 논리식:  '+circuitExpr())}
function initialize(){
 $('missionSelect').addEventListener('change',e=>{const next=e.target.value;if(next===mission)return;if(nodes.length>4&&!confirm('미션을 바꾸면 현재 캔버스의 회로가 초기화됩니다. 수행 기록은 유지됩니다. 계속할까요?')){$('missionSelect').value=mission;return}mission=next;resetCircuit(false);log('미션 변경',mission);saveLocal()});
 for(const b of document.querySelectorAll('.gate-item')){const type=b.dataset.type;b.addEventListener('click',()=>addGate(type));b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();addGate(type)}});b.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',type);e.dataTransfer.effectAllowed='copy'})}
 $('board').addEventListener('dragover',e=>{e.preventDefault();$('board').classList.add('drag-over')});$('board').addEventListener('dragleave',()=> $('board').classList.remove('drag-over'));$('board').addEventListener('drop',e=>{e.preventDefault();$('board').classList.remove('drag-over');const type=e.dataTransfer.getData('text/plain');const r=$('board').getBoundingClientRect();addGate(type,e.clientX-r.left-75,e.clientY-r.top-50)});
 for(const id of ['A','B','C'])$('switch'+id).addEventListener('click',()=>toggleInput(id));$('testBtn').addEventListener('click',testAll);$('exprBtn').addEventListener('click',exprShow);$('undoBtn').addEventListener('click',undo);$('removeBtn').addEventListener('click',deleteSelected);$('resetBtn').addEventListener('click',()=>{if(confirm('배치한 게이트와 연결선을 모두 삭제할까요? 검증 기록은 유지됩니다.'))resetCircuit()});
 $('saveBtn').addEventListener('click',exportProject);$('exportBtn').addEventListener('click',exportProject);$('csvBtn').addEventListener('click',exportCSV);$('loadBtn').addEventListener('click',()=>$('fileInput').click());$('fileInput').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{const raw=JSON.parse(await f.text());remember();applyLoaded(raw);log('회로 파일 불러오기',f.name)}catch(err){toast('파일을 읽을 수 없습니다: '+err.message)}e.target.value=''});
 $('teamCode').addEventListener('input',saveLocal);$('reflection').addEventListener('input',e=>{refl=e.target.value;saveLocal()});$('printBtn').addEventListener('click',()=>window.print());$('helpBtn').addEventListener('click',()=>$('helpDialog').showModal());$('closeHelp').addEventListener('click',()=>$('helpDialog').close());
 document.addEventListener('keydown',e=>{if(e.target.matches('textarea,input,select'))return;if(e.key==='Escape'&&pending){pending=null;$('connectPrompt').textContent='연결을 취소했습니다.';renderNodes()}if(e.key==='Delete'||e.key==='Backspace')deleteSelected();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo()}});
 window.addEventListener('resize',drawWires);loadLocal();render();
}
initialize();
