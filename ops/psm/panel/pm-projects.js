(() => {
 'use strict';
 const element=id=>document.getElementById(id);
 const labels={web:'الويب',php:'PHP',database:'قاعدة البيانات',expo:'Expo',scheduler:'المهام المجدولة',ingress:'مدخل PSM'};
 const actions={'restart-web':'الويب','restart-php':'PHP','restart-expo':'Expo'};
 let loading=false;
 function state(node,text,ok){node.textContent=text;node.dataset.state=ok?'ok':'pending';}
 async function load(){
  if(loading||!element('pm-project-card'))return;loading=true;
  try{
   const response=await fetch('/api/pm/projects',{credentials:'same-origin',cache:'no-store'});
   if(!response.ok)throw Error('load');
   const project=(await response.json()).projects[0];
   element('pm-project-root').textContent=project.root;
   state(element('pm-project-state'),project.status==='independent'?'مستقل على PSM':'التشغيل جاهز — يتبقى تحديث DNS',project.status==='independent');
   state(element('pm-public-state'),project.publicReady?'HTTPS على PSM يعمل':'جارٍ التحقق من مدخل PSM',project.publicReady);
   const services=element('pm-service-states');services.replaceChildren();
   for(const [key,label] of Object.entries(labels)){
    const row=document.createElement('div'),name=document.createElement('span'),value=document.createElement('b');
    name.textContent=label;const ok=project.services[key]==='active';state(value,ok?'يعمل':'غير جاهز',ok);row.append(name,value);services.append(row);
   }
   const rows=element('pm-dns-rows');rows.replaceChildren();
   for(const domain of project.domains){
    const row=document.createElement('tr');
    for(const value of [domain.domain,domain.addresses.join('، ')||'غير متاح',domain.expected,domain.ready?'مكتمل':'بانتظار التحويل']){
     const cell=document.createElement('td');cell.textContent=value;row.append(cell);
    }
    rows.append(row);
   }
   element('pm-certificate').textContent=project.certificate.validTo?'الشهادة صالحة حتى '+new Intl.DateTimeFormat('ar-SA',{dateStyle:'medium',timeZone:'Asia/Riyadh'}).format(new Date(project.certificate.validTo)):'جارٍ التحقق من الشهادة';
  }catch{element('pm-project-message').textContent='تعذر تحديث الحالة. أعد المحاولة.';}
  finally{loading=false;}
 }
 async function act(button){
  const action=button.dataset.pmAction;
  if(!actions[action]||!confirm('متأكد من إعادة تشغيل '+actions[action]+' لإدارة الأملاك؟'))return;
  const buttons=document.querySelectorAll('[data-pm-action]');buttons.forEach(b=>b.disabled=true);
  const message=element('pm-project-message');message.textContent='جارٍ تنفيذ الطلب...';
  try{
   const session=await (await fetch('/api/session',{cache:'no-store'})).json();
   const response=await fetch('/api/pm/projects/rental/actions',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf},body:JSON.stringify({project:'rental',action,approved:true})});
   if(!response.ok)throw Error('request');const job=await response.json();
   for(let i=0;i<25;i++){
    await new Promise(resolve=>setTimeout(resolve,1200));
    const result=await (await fetch('/api/pm/jobs/'+job.id,{cache:'no-store'})).json();
    if(result.status==='completed'){message.textContent='تمت إعادة التشغيل.';await load();return;}
    if(['failed','rejected'].includes(result.status))throw Error('job');
   }
   message.textContent='الطلب مستمر. حدّث الحالة بعد قليل.';
  }catch{message.textContent='تعذر تنفيذ الطلب. حدّث الحالة وأعد المحاولة.';}
  finally{buttons.forEach(b=>b.disabled=false);}
 }
 document.addEventListener('DOMContentLoaded',()=>{
  element('pm-project-refresh')?.addEventListener('click',load);
  document.querySelectorAll('[data-pm-action]').forEach(button=>button.addEventListener('click',()=>act(button)));
  load();
 });
 window.addEventListener('hashchange',()=>{if(location.hash==='#screen-pm')load();});
})();
