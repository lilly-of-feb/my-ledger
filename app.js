(()=>{
'use strict';
const $=id=>document.getElementById(id);
const DEFAULTS={
 out:[['🍽️','외식비'],['🛒','식료품·생활용품'],['💄','의류·미용'],['🧶','취미·여행·문화'],['🐱','고양이'],['🎮','게임·웹소설·웹툰'],['💊','병원의약'],['🎁','경조사'],['📈','투자·보험·상조'],['🏠','주거·통신'],['🔄','정기결제'],['🚗','차량']],
 in:[['🏢','직장'],['💰','비정기수입'],['🎁','기타']],
 payment:[['💵','현금·이체'],['🏘️','지역화폐'],['💳','신용·체크'],['📱','간편결제']]
};
const makeItems=a=>a.map((x,i)=>({id:'i'+i+'_'+Math.random().toString(36).slice(2,7),icon:x[0],name:x[1]}));
let settings={out:makeItems(DEFAULTS.out),in:makeItems(DEFAULTS.in),payment:makeItems(DEFAULTS.payment)};
const CATS=[]; const allCats=()=>[...settings.out,...settings.in]; const catIcon=n=>allCats().find(c=>c.name===n)?.icon||'📌';
const KEY='simple-ledger-v1';
const BACKUP_KEY='simple-ledger-auto-backups-v1',JSON_DATE_KEY='simple-ledger-json-exported-at-v1';
let db={transactions:[],budgets:{},fixed:[],settings,sampleFixedSeeded:false},month=localMonth(),kind='out',category='외식비',editing=null,editingFixed=null,noticeTimer;
const LIVING_CATEGORIES=['외식비','식료품·생활용품','의류·미용','취미·여행·문화','고양이','게임·웹소설·웹툰','병원의약','경조사'];
function localDate(d=new Date()){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function localMonth(){return localDate().slice(0,7)}
function won(n){return Math.round(n||0).toLocaleString('ko-KR')+'원'}
function safe(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function notify(s){$('notice').textContent=s;$('notice').classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').classList.remove('show'),2600)}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(db));return true}catch(e){notify('저장 공간이 부족해. 백업 후 데이터를 정리해 줘.');return false}}
function readAutoBackups(){try{const x=JSON.parse(localStorage.getItem(BACKUP_KEY)||'[]');return Array.isArray(x)?x.filter(v=>v&&typeof v.savedAt==='string'&&v.data&&Array.isArray(v.data.transactions)):[]}catch(e){return []}}
function makeAutoBackup(){
 const previous=readAutoBackups(),last=previous[0],nowCount=db.transactions.length,oldCount=last?.data?.transactions?.length??0;
 if(last&&oldCount>0&&(nowCount===0||nowCount<oldCount-Math.max(3,Math.ceil(oldCount*0.5)))){
  notify('거래 내역이 크게 줄어 자동 백업을 건너뛰었어. 기존 백업은 보존했어.');return false;
 }
 if(!last&&nowCount===0)return false;
 const next=[{savedAt:new Date().toISOString(),data:JSON.parse(JSON.stringify(db))},...previous].slice(0,3);
 try{localStorage.setItem(BACKUP_KEY,JSON.stringify(next));return true}catch(e){notify('내부 백업 저장 공간이 부족해. 기존 백업은 유지했어.');return false}
}
function persistTransactionChange(){
 if(!persist())return false;
 makeAutoBackup();updateBackupStatus();return true;
}
function updateBackupStatus(){
 const backups=readAutoBackups(),last=backups[0];
 $('internalBackupStatus').textContent=last?'내부 자동 백업: '+new Date(last.savedAt).toLocaleString('ko-KR'):'내부 자동 백업 기록 없음';
 let exported=null;try{exported=localStorage.getItem(JSON_DATE_KEY)}catch(e){}
 $('jsonBackupStatus').textContent=exported?'JSON 파일 마지막 생성: '+new Date(exported).toLocaleString('ko-KR'):'JSON 파일 백업 기록 없음';
 const reminder=$('backupReminder');
 const due=!exported||!Number.isFinite(Date.now()-new Date(exported).getTime())||Date.now()-new Date(exported).getTime()>=7*24*60*60*1000;
 reminder.classList.toggle('hidden',!due);reminder.classList.toggle('blink',due);
}
function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||'null');if(x&&Array.isArray(x.transactions)&&x.budgets&&Array.isArray(x.fixed)){
 db=x;
 if(db.settings&&Array.isArray(db.settings.out)&&Array.isArray(db.settings.in)&&Array.isArray(db.settings.payment))settings=db.settings;
 const cash=settings.payment.find(p=>p.name==='현금');
 if(cash){cash.name='현금·이체';db.transactions.forEach(t=>{if(t.payment==='현금')t.payment='현금·이체'});db.fixed.forEach(f=>{if(f.payment==='현금')f.payment='현금·이체'})}
 else {
 settings={out:makeItems(DEFAULTS.out),in:makeItems(DEFAULTS.in),payment:makeItems(DEFAULTS.payment)};
 const legacy={'식비':'외식비','카페':'외식비','교통':'차량','쇼핑':'의류·미용','생활':'식료품·생활용품','문화':'취미·여행·문화','건강':'병원의약','뷰티':'의류·미용','통신':'주거·통신','급여':'직장','기타':'기타'};
 db.transactions.forEach(t=>{t.category=legacy[t.category]||t.category;if(t.type==='out'&&!t.payment)t.payment='현금·이체'});
 db.fixed.forEach(f=>{f.category=legacy[f.category]||f.category});
 db.settings=settings;
}
}}catch(e){notify('저장된 데이터 형식을 읽지 못했어.')}}
function saveSettings(){db.settings=settings;if(persist()){$('fixedCategory').innerHTML=settings.out.map(c=>`<option>${safe(c.name)}</option>`).join('');render();renderSettings();}}
function renderSettings(){
 const sections=[['out','지출 카테고리'],['payment','결제수단'],['in','수입 카테고리']];
 $('settingsLists').innerHTML=sections.map(([key,label])=>`<div class="card"><b>${label}</b>${settings[key].map((it,i)=>`<div class="setting-item"><span class="setting-name">${it.icon} ${safe(it.name)}</span><button data-set-edit="${key}:${it.id}">수정</button><button data-set-up="${key}:${i}" ${i===0?'disabled':''}>↑</button><button data-set-down="${key}:${i}" ${i===settings[key].length-1?'disabled':''}>↓</button><button data-set-del="${key}:${it.id}">삭제</button></div>`).join('')}<button class="secondary" style="width:100%;margin-top:9px" data-set-add="${key}">＋ 추가</button></div>`).join('');
}
function manageSetting(key,id=null){
 const arr=settings[key],item=id?arr.find(x=>x.id===id):null;
 const icon=prompt('아이콘(이모지)을 입력해 줘.',item?.icon||'📌');if(icon===null)return;
 const name=prompt('항목 이름을 입력해 줘.',item?.name||'');if(name===null)return;
 if(!name.trim())return notify('이름을 입력해 줘.');
 if(arr.some(x=>x.name===name.trim()&&x.id!==id))return notify('같은 이름이 이미 있어.');
 if(item){
  const old=item.name;item.icon=icon.trim()||'📌';item.name=name.trim();
  if(key==='payment'){db.transactions.forEach(t=>{if(t.payment===old)t.payment=item.name});db.fixed.forEach(f=>{if(f.payment===old)f.payment=item.name})}else{db.transactions.forEach(t=>{if(t.category===old)t.category=item.name});db.fixed.forEach(f=>{if(f.category===old)f.category=item.name});const li=LIVING_CATEGORIES.indexOf(old);if(li>=0)LIVING_CATEGORIES[li]=item.name}
 }else arr.push({id:'c'+Date.now()+Math.random().toString(36).slice(2,5),icon:icon.trim()||'📌',name:name.trim()});
 saveSettings();
}
function deleteSetting(key,id){
 const arr=settings[key],item=arr.find(x=>x.id===id);if(!item)return;
 if(arr.length<=1)return notify('마지막 항목은 삭제할 수 없어.');
 const used=key==='payment'?db.transactions.some(t=>t.payment===item.name)||db.fixed.some(f=>f.payment===item.name):db.transactions.some(t=>t.category===item.name)||db.fixed.some(f=>f.category===item.name);
 if(used){
  const choices=arr.filter(x=>x.id!==id);
  const pick=prompt('이 항목을 사용 중인 내역이 있어. 이동할 항목 번호를 입력해 줘.\\n'+choices.map((x,i)=>`${i+1}. ${x.icon} ${x.name}`).join('\\n'));
  if(pick===null)return;const target=choices[Number(pick)-1];if(!target)return notify('올바른 번호를 입력해 줘.');
  if(key==='payment'){db.transactions.forEach(t=>{if(t.payment===item.name)t.payment=target.name});db.fixed.forEach(f=>{if(f.payment===item.name)f.payment=target.name})}
  else {db.transactions.forEach(t=>{if(t.category===item.name)t.category=target.name});db.fixed.forEach(f=>{if(f.category===item.name)f.category=target.name})}
 }
 settings[key]=arr.filter(x=>x.id!==id);saveSettings();
}
function renderFixed(){
 const imported=db.fixed.filter(f=>db.transactions.some(t=>t.fixedId===f.id&&t.fixedMonth===month));
 const total=db.fixed.reduce((n,f)=>n+Number(f.amount||0),0);
 const importedTotal=imported.reduce((n,f)=>n+Number(f.amount||0),0);
 $('fixedMonthLabel').textContent=month.replace('-','년 ')+'월';
 $('fixedTotal').textContent=won(total);
 $('fixedImported').textContent=imported.length+'개 가져옴 · '+won(importedTotal);
 $('fixedList').innerHTML=db.fixed.length?db.fixed.map(f=>{
  const done=db.transactions.some(t=>t.fixedId===f.id&&t.fixedMonth===month);
  return `<div class="card fixed-item"><div class="row"><div class="grow"><b>${safe(f.name)}</b><div class="tiny">매월 ${f.day}일 · ${safe(f.category)} · ${safe(f.payment||'결제수단 미설정')}</div><b>${won(f.amount)}</b></div>${done?'<span class="tiny">가져옴 ✓</span>':'<span class="tiny">미등록</span>'}</div><div class="controls" style="justify-content:flex-end;margin-top:8px"><button data-fixed-edit="${f.id}">수정</button><button data-fixed-delete="${f.id}">삭제</button></div></div>`;
 }).join(''):'<div class="card muted" style="text-align:center;padding:24px;font-size:13px">등록된 고정지출이 없어.</div>';
 const remaining=db.fixed.filter(f=>!db.transactions.some(t=>t.fixedId===f.id&&t.fixedMonth===month)).length;
 $('importFixedBtn').disabled=remaining===0;
 $('importFixedBtn').textContent=remaining?`${month.slice(5)}월 고정지출 ${remaining}건 가져오기`:'모두 가져왔어';
}
function records(){return db.transactions.filter(t=>t.date?.startsWith(month))}
function sum(arr,k){return arr.filter(t=>t.type===k).reduce((n,t)=>n+Number(t.amount||0),0)}
function render(){
 const a=records(),inc=sum(a,'in'),out=sum(a,'out'),livingOut=a.filter(t=>t.type==='out'&&LIVING_CATEGORIES.includes(t.category)).reduce((n,t)=>n+Number(t.amount||0),0),budget=Number(db.budgets[month]||0);
 $('monthTitle').textContent=month.replace('-','년 ')+'월';
 $('income').textContent=won(inc);$('expense').textContent=won(out);
 $('remaining').textContent=budget?won(budget-livingOut):'예산 미설정';
 $('budgetText').textContent=budget?`생활비 예산 ${won(budget)} · ${Math.round(livingOut/budget*100)}% 사용`:'생활비 예산을 설정해 주세요';
 $('budgetBar').style.width=budget?Math.min(100,livingOut/budget*100)+'%':'0%';
 $('budgetBar').style.background=budget&&livingOut>budget?'var(--red)':'var(--accent)';
 const list=[...a].sort((x,y)=>y.date.localeCompare(x.date)||y.id-x.id);
 $('count').textContent=list.length+'건';
 $('transactions').innerHTML=list.length?list.map(t=>`<div class="transaction"><div class="emoji">${catIcon(t.category)}</div><div class="grow"><div style="font-weight:650;font-size:14px">${safe(t.memo||t.category)}</div><div class="tiny">${safe(t.date)} · ${safe(t.category)}</div></div><div class="amount" style="color:${t.type==='in'?'var(--accent)':'inherit'}">${t.type==='in'?'+':'−'}${won(t.amount)}<div class="controls"><button data-edit="${t.id}">수정</button><button data-delete="${t.id}">삭제</button></div></div></div>`).join(''):'<div class="muted" style="text-align:center;padding:30px 0;font-size:13px">아직 내역이 없어. 첫 거래를 등록해 봐!</div>';
 const renderGroup=(type)=>{const groups={};a.filter(t=>t.type===type).forEach(t=>groups[t.category]=(groups[t.category]||0)+Number(t.amount||0));const entries=Object.entries(groups).sort((x,y)=>y[1]-x[1]),total=entries.reduce((n,x)=>n+x[1],0),max=entries[0]?.[1]||1;return entries.length?entries.map(([c,v])=>`<div class="categoryline"><div class="row" style="justify-content:space-between;font-size:13px"><span>${catIcon(c)} ${safe(c)}</span><b>${won(v)}</b></div><div class="bar"><span style="width:${v/max*100}%"></span></div><div class="tiny">${total?Math.round(v/total*100):0}%</div></div>`).join(''):'<div class="muted" style="text-align:center;padding:18px;font-size:13px">해당 내역이 없어.</div>'};
 const paymentGroups={};a.filter(t=>t.type==='out').forEach(t=>{const p=t.payment||'미지정';paymentGroups[p]=(paymentGroups[p]||0)+Number(t.amount||0)});const paymentEntries=Object.entries(paymentGroups).sort((x,y)=>y[1]-x[1]),paymentTotal=paymentEntries.reduce((n,x)=>n+x[1],0),paymentMax=paymentEntries[0]?.[1]||1;const paymentStats=paymentEntries.length?paymentEntries.map(([name,value])=>{const item=settings.payment.find(x=>x.name===name);return `<div class="categoryline"><div class="row" style="justify-content:space-between;font-size:13px"><span>${item?.icon||'💳'} ${safe(name)}</span><b>${won(value)}</b></div><div class="bar"><span style="width:${value/paymentMax*100}%"></span></div><div class="tiny">${paymentTotal?Math.round(value/paymentTotal*100):0}%</div></div>`}).join(''):'<div class="muted" style="text-align:center;padding:18px;font-size:13px">해당 내역이 없어.</div>';$('statistics').innerHTML=`<b>지출분류 통계</b>${renderGroup('out')}<hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><b>결제수단 통계</b>${paymentStats}<hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><b>수입분류 통계</b>${renderGroup('in')}`;
 renderFixed();
 if(budget&&livingOut>budget)notify('생활비 예산을 초과했어.');
}
function showEntry(type='out',t=null){
 editing=t?.id??null;kind=t?.type||type;category=t?.category||(kind==='in'?settings.in[0]?.name:settings.out[0]?.name);
 $('formTitle').textContent=t?'거래 수정':kind==='in'?'수입 등록':'지출 등록';
 $('amount').value=t?.amount??'';$('memo').value=t?.memo??'';$('date').value=t?.date||localDate();
 const choices=kind==='out'?settings.out:settings.in;
 $('cats').innerHTML=choices.map(c=>`<button class="cat ${category===c.name?'sel':''}" data-category="${safe(c.name)}"><div style="font-size:20px">${c.icon}</div>${safe(c.name)}</button>`).join('');
 $('paymentWrap').classList.toggle('hidden',kind==='in');
 const selectedPayment=t?.payment||settings.payment[0]?.name||'';$('payment').innerHTML=settings.payment.map(c=>`<button type="button" class="cat payment-choice ${selectedPayment===c.name?'sel':''}" data-payment="${safe(c.name)}"><div style="font-size:20px">${c.icon}</div>${safe(c.name)}</button>`).join('');$('payment').dataset.value=selectedPayment;
 $('entryForm').classList.add('open');$('amount').focus();
}
function closeEntry(){$('entryForm').classList.remove('open');editing=null}
$('expenseBtn').onclick=()=>showEntry('out');$('incomeBtn').onclick=()=>showEntry('in');$('closeForm').onclick=closeEntry;
$('cats').onclick=e=>{const b=e.target.closest('[data-category]');if(!b)return;category=b.dataset.category;$('cats').querySelectorAll('.cat').forEach(x=>x.classList.toggle('sel',x===b))};
$('payment').onclick=e=>{const b=e.target.closest('[data-payment]');if(!b)return;$('payment').dataset.value=b.dataset.payment;$('payment').querySelectorAll('.cat').forEach(x=>x.classList.toggle('sel',x===b))};
$('saveEntry').onclick=()=>{const amount=Number($('amount').value),date=$('date').value;if(!Number.isSafeInteger(amount)||amount<=0||!date)return notify('금액과 날짜를 확인해 줘.');const t={id:editing??Date.now(),type:kind,amount,category,payment:kind==='out'?$('payment').dataset.value:'',memo:$('memo').value.trim(),date};if(editing)db.transactions=db.transactions.map(x=>x.id===editing?t:x);else db.transactions.push(t);if(persistTransactionChange()){closeEntry();render();}};
$('transactions').onclick=e=>{const edit=e.target.closest('[data-edit]'),del=e.target.closest('[data-delete]');if(edit){const t=db.transactions.find(x=>x.id===Number(edit.dataset.edit));if(t)showEntry(t.type,t)}if(del&&confirm('이 거래를 삭제할까?')){db.transactions=db.transactions.filter(x=>x.id!==Number(del.dataset.delete));persistTransactionChange();render()}};
$('prev').onclick=()=>{const [y,m]=month.split('-').map(Number),d=new Date(y,m-2,1);month=localDate(d).slice(0,7);render()};
$('next').onclick=()=>{const [y,m]=month.split('-').map(Number),d=new Date(y,m,1);month=localDate(d).slice(0,7);render()};
$('setBudget').onclick=()=>{const old=db.budgets[month]??'',v=prompt(`${month} 생활비 예산을 원 단위로 입력해 줘. (비우면 해제)`,old);if(v===null)return;if(v.trim()===''){delete db.budgets[month]}else if(!Number.isSafeInteger(Number(v))||Number(v)<0)return notify('0 이상의 정수 금액을 입력해 줘.');else db.budgets[month]=Number(v);persist();render()};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.section').forEach(x=>x.classList.toggle('active',x.id===b.dataset.tab))});
function openFixedForm(f=null){
 editingFixed=f?.id??null;
 $('fixedFormTitle').textContent=f?'고정지출 수정':'고정지출 추가';
 $('fixedName').value=f?.name||'';
 $('fixedAmount').value=f?.amount??'';
 $('fixedDay').value=f?.day??1;
 $('fixedCategory').innerHTML=settings.out.map(c=>`<option ${((f?.category||settings.out[0]?.name)===c.name)?'selected':''}>${safe(c.name)}</option>`).join('');
 $('fixedPayment').innerHTML=settings.payment.map(c=>`<option ${((f?.payment||settings.payment[0]?.name)===c.name)?'selected':''}>${safe(c.name)}</option>`).join('');
 $('fixedForm').classList.add('open');
}
function closeFixedForm(){$('fixedForm').classList.remove('open');editingFixed=null}
$('newFixed').onclick=()=>openFixedForm();
$('cancelFixed').onclick=closeFixedForm;
$('saveFixed').onclick=()=>{
 const name=$('fixedName').value.trim(),amount=Number($('fixedAmount').value),day=Number($('fixedDay').value);
 if(!name||!Number.isSafeInteger(amount)||amount<=0||!Number.isInteger(day)||day<1||day>31)return notify('항목명, 금액, 결제일을 확인해 줘.');
 const data={name,amount,day,category:$('fixedCategory').value,payment:$('fixedPayment').value};
 const wasEditing=editingFixed!==null;
 if(wasEditing){const f=db.fixed.find(x=>x.id===editingFixed);if(f)Object.assign(f,data)}
 else db.fixed.push({id:Date.now(),...data});
 if(persistTransactionChange()){closeFixedForm();render();notify(wasEditing?'고정지출 항목을 수정했어.':'고정지출 항목을 등록했어.')}
};
$('fixedList').onclick=e=>{
 const edit=e.target.closest('[data-fixed-edit]'),del=e.target.closest('[data-fixed-delete]');
 if(edit){const f=db.fixed.find(x=>x.id===Number(edit.dataset.fixedEdit));if(f)openFixedForm(f)}
 if(del&&confirm('이 고정지출 항목을 삭제할까? 이미 가져온 거래 내역은 그대로 유지돼.')){
  db.fixed=db.fixed.filter(f=>f.id!==Number(del.dataset.fixedDelete));
  if(persistTransactionChange())render();
 }
};
$('importFixedBtn').onclick=()=>{
 const [y,m]=month.split('-').map(Number),last=new Date(y,m,0).getDate();
 const pending=db.fixed.filter(f=>!db.transactions.some(t=>t.fixedId===f.id&&t.fixedMonth===month));
 if(!pending.length)return notify('이번 달 고정지출은 이미 모두 가져왔어.');
 if(!confirm(`${month} 고정지출 ${pending.length}건, ${won(pending.reduce((n,f)=>n+f.amount,0))}을 거래 내역에 추가할까?`))return;
 for(const f of pending){
  const date=month+'-'+String(Math.min(f.day,last)).padStart(2,'0');
  db.transactions.push({id:Date.now()+Math.floor(Math.random()*1000000),type:'out',amount:f.amount,category:f.category,payment:f.payment||'',memo:f.name,date,fixedId:f.id,fixedMonth:month});
 }
 if(persistTransactionChange()){render();notify(`${pending.length}건을 ${month} 거래 내역에 추가했어.`)}
};
function applyFixed(){/* 고정지출은 가져오기 버튼을 눌렀을 때만 생성 */}
function download(name,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('jsonExportBtn').onclick=()=>{
 const json=JSON.stringify({format:'simple-ledger-backup-v1',exportedAt:new Date().toISOString(),data:db},null,2);
 download('가계부_백업_'+localDate()+'.json',json,'application/json');
 try{localStorage.setItem(JSON_DATE_KEY,new Date().toISOString())}catch(e){}
 updateBackupStatus();notify('JSON 백업 파일을 만들었어. 휴대폰에 보관해 줘.');
};
$('csvExportBtn').onclick=()=>{
 const csv=[['날짜','유형','카테고리','결제수단','내용','금액'],...db.transactions.map(t=>[t.date,t.type==='in'?'수입':'지출',t.category,t.type==='in'?'-':(t.payment||'-'),t.memo,t.amount])].map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
 download('가계부_내역_'+month+'.csv','\uFEFF'+csv,'text/csv;charset=utf-8');notify('CSV 내역을 내보냈어.');
};
$('restoreBtn').onclick=()=>$('restoreDialog').showModal();
$('cancelRestore').onclick=()=>$('restoreDialog').close();
function validDate(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T00:00:00');return !Number.isNaN(d.getTime())&&localDate(d)===s}
function validateBackup(d){
 if(!d||!Array.isArray(d.transactions)||d.transactions.length>100000||!d.budgets||typeof d.budgets!=='object'||Array.isArray(d.budgets)||!Array.isArray(d.fixed)||d.fixed.length>10000)return false;
 const allowed=allCats().map(c=>c.name);
 for(const t of d.transactions){if(!t||!Number.isSafeInteger(t.id)||!['in','out'].includes(t.type)||!Number.isSafeInteger(t.amount)||t.amount<=0||!allowed.includes(t.category)||typeof t.memo!=='string'||t.memo.length>80||(t.type==='out'&&t.payment!==undefined&&t.payment!==''&&!settings.payment.some(p=>p.name===t.payment))||!validDate(t.date)||(t.fixedId!==undefined&&!Number.isSafeInteger(t.fixedId)))return false}
 for(const [m,v] of Object.entries(d.budgets)){if(!/^\d{4}-\d{2}$/.test(m)||!Number.isSafeInteger(v)||v<0)return false}
 for(const f of d.fixed){if(!f||!Number.isSafeInteger(f.id)||typeof f.name!=='string'||!f.name.trim()||f.name.length>80||!Number.isSafeInteger(f.amount)||f.amount<=0||!Number.isInteger(f.day)||f.day<1||f.day>31||!allowed.includes(f.category)||(f.payment!==undefined&&f.payment!==''&&!settings.payment.some(p=>p.name===f.payment))||(f.created!==undefined&&!validDate(f.created)))return false}
 return true;
}
$('doRestore').onclick=async()=>{const file=$('restoreFile').files[0];if(!file)return notify('백업 파일을 선택해 줘.');try{const raw=(await file.text()).replace(/^\uFEFF/,'');const x=JSON.parse(raw);const d=x.data;
 if(d&&(!d.settings||!Array.isArray(d.settings.out)||!Array.isArray(d.settings.in)||!Array.isArray(d.settings.payment))){
  d.settings={out:makeItems(DEFAULTS.out),in:makeItems(DEFAULTS.in),payment:makeItems(DEFAULTS.payment)};
 }
 const priorSettings=settings;settings=d.settings;
 if(x.format!=='simple-ledger-backup-v1'||!validateBackup(d)){settings=priorSettings;throw Error();}if(!confirm('현재 가계부 데이터를 백업 파일 내용으로 교체할까?'))return;const restorePoints=readAutoBackups();try{localStorage.setItem(BACKUP_KEY,JSON.stringify([{savedAt:new Date().toISOString(),data:JSON.parse(JSON.stringify(db)),label:'복원 전 자동 보관'},...restorePoints].slice(0,3)))}catch(e){notify('복원 전 현재 데이터를 내부 백업하지 못했어. 복원을 중단할게.');return}db=d;settings=d.settings;if(!persist())return;$('fixedCategory').innerHTML=settings.out.map(c=>`<option>${safe(c.name)}</option>`).join('');$('restoreDialog').close();updateBackupStatus();render();renderSettings();notify('백업을 복원했어.')}catch(e){notify('올바르지 않거나 손상된 가계부 백업 파일이야.')}};
load();
 if(!db.sampleFixedSeeded){if(!db.fixed.length)db.fixed.push({id:1710000000001,name:'통신요금',amount:19800,day:21,category:'주거·통신',payment:'현금·이체'});db.sampleFixedSeeded=true;}
 db.transactions.forEach(t=>{if(t.type==='out'&&!t.payment)t.payment=''});
 $('fixedCategory').innerHTML=settings.out.map(c=>`<option>${safe(c.name)}</option>`).join('');
 applyFixed();persist();render();renderSettings();updateBackupStatus();
 $('settingsLists').onclick=e=>{
  const a=e.target.closest('[data-set-add]'),ed=e.target.closest('[data-set-edit]'),del=e.target.closest('[data-set-del]'),up=e.target.closest('[data-set-up]'),down=e.target.closest('[data-set-down]');
  if(a)manageSetting(a.dataset.setAdd);
  if(ed){const [k,id]=ed.dataset.setEdit.split(':');manageSetting(k,id)}
  if(del){const [k,id]=del.dataset.setDel.split(':');deleteSetting(k,id)}
  if(up||down){const el=up||down,[k,i]=el.dataset[up?'setUp':'setDown'].split(':');const n=Number(i),arr=settings[k],to=n+(up?-1:1);if(arr[to]){[arr[n],arr[to]]=[arr[to],arr[n]];saveSettings()}}
 };
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>notify('오프라인 기능 설치에 실패했어. 온라인 상태에서 다시 열어 줘.'));
})();
