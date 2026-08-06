import { createContractConfig, type ContractConfig, type ContractTarget } from './contract-config';
import { requestContractTarget } from './contract-http';
import { ContractFixtures } from './contract-fixtures';

const request=(target:ContractTarget,config:ContractConfig,path:string,options?:Parameters<typeof requestContractTarget>[3])=>requestContractTarget(target,path,config.timeoutMs,options);
const payload=(suffix:string)=>({code:`ct-student-write-${suffix}`,fullname:'Contract Student Write',email:`ct-student-write-${suffix}@example.test`,username:`ct-student-write-${suffix}`,password:'Valid1!x',hobbies:0});
const success=(response:Awaited<ReturnType<typeof request>>,message:string)=>{expect(response.status).toBe(200);expect(response.body).toMatchObject({code:'200',status:200,message});return response.body as {data:Record<string,unknown>};};

describe.each(createContractConfig().targets)('student write/trash contract: %s',(target)=>{
  const config=createContractConfig(); let fixtures:ContractFixtures;
  beforeAll(()=>{fixtures=new ContractFixtures();}); afterAll(async()=>fixtures.cleanup(),15_000);
  it('keeps create/update/trash/restore/permanent contracts without password',async()=>{
    const suffix=`${target.name}-${Date.now().toString(36)}`;
    const invalid=await request(target,config,'/student',{method:'POST',body:{}});expect(invalid.body).toMatchObject({code:'E603',status:400});
    const created=success(await request(target,config,'/student',{method:'POST',body:payload(suffix)}),'T\u1ea1o sinh vi\u00ean th\u00e0nh c\u00f4ng'); const id=Number(created.data.id); fixtures.trackStudent(id); expect(JSON.stringify(created.data)).not.toContain('password');
    const duplicate=await request(target,config,'/student',{method:'POST',body:payload(suffix)});expect(duplicate.body).toMatchObject({code:'E603',status:409});
    const updated=success(await request(target,config,`/student/${id}`,{method:'PUT',body:{fullname:'Updated Student'}}),'C\u1eadp nh\u1eadt sinh vi\u00ean th\u00e0nh c\u00f4ng');expect(updated.data.fullname).toBe('Updated Student');expect(JSON.stringify(updated.data)).not.toContain('password');
    success(await request(target,config,`/student/${id}`,{method:'DELETE'}),'X\u00f3a sinh vi\u00ean th\u00e0nh c\u00f4ng');
    const deleted=success(await request(target,config,'/student/deleted/page?page=1&size=10'),'L\u1ea5y danh s\u00e1ch sinh vi\u00ean \u0111\u00e3 x\u00f3a th\u00e0nh c\u00f4ng');expect(JSON.stringify(deleted.data)).not.toContain('password');
    const restored=success(await request(target,config,'/student/deleted/restore',{method:'PATCH',body:{idlist:[id,id]}}),`\u0110\u00e3 kh\u00f4i ph\u1ee5c 1 sinh vi\u00ean`);expect(restored.data.restored).toEqual([id]);
    success(await request(target,config,`/student/${id}`,{method:'DELETE'}),'X\u00f3a sinh vi\u00ean th\u00e0nh c\u00f4ng');
    const permanent=success(await request(target,config,'/student/deleted/permanent',{method:'DELETE',body:{idlist:[id,id]}}),`\u0110\u00e3 x\u00f3a v\u0129nh vi\u1ec5n 1 sinh vi\u00ean`);expect(permanent.data.deleted).toEqual([id]);
    const active=success(await request(target,config,'/student',{method:'POST',body:payload(`${suffix}-active`)}),'T\u1ea1o sinh vi\u00ean th\u00e0nh c\u00f4ng'); const activeId=Number(active.data.id); fixtures.trackStudent(activeId);
    const activePermanent=success(await request(target,config,'/student/deleted/permanent',{method:'DELETE',body:{idlist:[activeId]}}),'\u0110\u00e3 x\u00f3a v\u0129nh vi\u1ec5n 0 sinh vi\u00ean');expect(activePermanent.data).toMatchObject({deleted:[],notFound:[activeId]});
  },30_000);
});
