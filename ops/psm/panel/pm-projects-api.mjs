import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import https from 'node:https';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const BASE='/mnt/HC_Volume_107348367/psm';
const QUEUE=BASE+'/operations/pm/requests';
const RESULTS=BASE+'/operations/pm/results';
const IP='2.29.21.85';
const execute=promisify(execFile);
const services={web:'psm-rental-web',php:'psm-rental-php',database:'psm-rental-db',expo:'rental-expo',scheduler:'psm-rental-scheduler.timer',ingress:'psm-ingress'};
const allowed=new Set(['restart-php','restart-web','restart-expo']);
const idPattern=/^[a-f0-9]{24}$/;

async function serviceState(name){
 try{return (await execute('/usr/bin/systemctl',['is-active',name],{timeout:1800,maxBuffer:2048})).stdout.trim();}
 catch(error){return String(error.stdout||'unavailable').trim().slice(0,30);}
}
function publicProbe(){
 return new Promise(resolve=>{
  const req=https.get({hostname:IP,servername:'rental.pm.sa',path:'/up',headers:{Host:'rental.pm.sa'},timeout:2200},res=>{
   const ok=res.statusCode===200&&res.headers['x-psm-ingress']==='standalone'&&res.headers['x-psm-runtime']==='rental-independent';
   res.resume();resolve(ok);
  });
  req.on('error',()=>resolve(false));req.on('timeout',()=>req.destroy());
 });
}
async function domainState(domain){
 try{
  const addresses=await Promise.race([dns.resolve4(domain),new Promise((_,reject)=>setTimeout(()=>reject(Error('timeout')),2000))]);
  return {domain,addresses,expected:IP,ready:addresses.length>0&&addresses.every(x=>x===IP)};
 }catch{return {domain,addresses:[],expected:IP,ready:false};}
}
export async function pmProjectStatus(){
 const [states,domains,publicReady]=await Promise.all([
  Promise.all(Object.entries(services).map(async([key,name])=>[key,await serviceState(name)])),
  Promise.all(['rental.pm.sa','rentals-api.pm.sa','panel.pm.sa'].map(domainState)),publicProbe()
 ]);
 let certificate={};
 try{
  const x=new crypto.X509Certificate(fs.readFileSync(BASE+'/operations/pm/metadata/rental-cert.pem'));
  certificate={validTo:new Date(x.validTo).toISOString(),issuer:x.issuer,validNow:Date.now()<Date.parse(x.validTo)};
 }catch{}
 return {id:'rental',name:'إدارة الأملاك',root:BASE+'/pm/rental',ip:IP,phpVersion:'8.4.27',
  services:Object.fromEntries(states),domains,publicReady,certificate,
  status:domains.slice(0,2).every(d=>d.ready)&&publicReady?'independent':'awaiting_dns',
  checkedAt:new Date().toISOString()};
}
export async function pmProjectsRouter(req,res,route,helpers){
 if(!route.startsWith('/api/pm/'))return false;
 const {s,json,requireFullAuth,requireCsrf,readJson,throttle,audit}=helpers;
 if(!requireFullAuth(res,s))return true;
 if(req.method==='GET'&&route==='/api/pm/projects'){
  json(res,200,{projects:[await pmProjectStatus()]});return true;
 }
 if(req.method==='GET'&&route.startsWith('/api/pm/jobs/')){
  const id=route.slice('/api/pm/jobs/'.length);
  if(!idPattern.test(id)){json(res,400,{error:'invalid_job'});return true;}
  const file=path.join(RESULTS,id+'.json');
  try{
   const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
   try{const st=fs.fstatSync(fd);if(!st.isFile()||st.size>4096)throw Error('invalid_result');json(res,200,JSON.parse(fs.readFileSync(fd,'utf8')));}
   finally{fs.closeSync(fd);}
  }catch(error){
   if(error.code==='ENOENT')json(res,200,{id,status:'pending'});else json(res,503,{error:'job_result_unavailable'});
  }
  return true;
 }
 if(req.method==='POST'&&route==='/api/pm/projects/rental/actions'){
  if(!requireCsrf(res,req,s))return true;
  const rate=throttle('pm-rental:'+s.token,3,60000);
  if(rate.blocked){json(res,429,{error:'try_later'});return true;}
  let data;try{data=await readJson(req);}catch{json(res,400,{error:'invalid_request'});return true;}
  if(data.project!=='rental'||data.approved!==true||!allowed.has(data.action)){
   json(res,400,{error:'invalid_action'});return true;
  }
  const id=crypto.randomBytes(12).toString('hex');
  const record={version:1,id,project:'rental',approved:true,action:data.action,createdAt:new Date().toISOString()};
  const temp=path.join(QUEUE,'.'+id+'.tmp'),final=path.join(QUEUE,id+'.json');
  try{
   fs.writeFileSync(temp,JSON.stringify(record),{flag:'wx',mode:0o640});fs.renameSync(temp,final);
   rate.increment();audit('pm_rental_action',data.action);json(res,202,{ok:true,id,status:'pending'});
  }catch{try{fs.unlinkSync(temp);}catch{}json(res,503,{error:'project_control_unavailable'});}
  return true;
 }
 json(res,404,{error:'not_found'});return true;
}
