import { createContractConfig, type ContractConfig, type ContractTarget } from './contract-config';
import { requestContractTarget } from './contract-http';
import { ContractFixtures } from './contract-fixtures';

const columns = ['code','fullname','dob','gender','class','email','username','password','homecity','address','hobbies','description','hair_color','facebook'];
const request = (target:ContractTarget, config:ContractConfig, path:string, options?:Parameters<typeof requestContractTarget>[3]) => requestContractTarget(target,path,config.timeoutMs,options);

describe.each(createContractConfig().targets)('student import/export contract: %s',(target)=>{
  const config=createContractConfig();
  let fixtures:ContractFixtures;
  beforeAll(()=>{fixtures=new ContractFixtures();});
  afterAll(async()=>fixtures?.cleanup(),15_000);

  it('keeps template, export, read-only preview, validate and commit across JSON/CSV',async()=>{
    const suffix=`${target.name}-${Date.now().toString(36)}`;
    const form=new FormData();
    form.append('file',new Blob([`code,fullname,dob,gender,class,email,username,password,homecity,address,hobbies,description,hair_color,facebook\nct-student-file-${suffix},File Student,,Nam,,ct-student-file-${suffix}@example.test,ct-student-file-${suffix},Valid1!x,,,,,#000000,\n`],{type:'text/csv'}),'students.csv');
    const preview=await request(target,config,'/student/import',{method:'POST',formData:form});
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({code:'200',status:200});
    const draft=preview.body.data.rows[0];
    expect(JSON.stringify(draft)).not.toContain('hash');
    const validate=await request(target,config,'/student/import/validate',{method:'POST',body:{drafts:[draft]}});
    expect(validate.status).toBe(200);
    const committed=await request(target,config,'/student/import/commit',{method:'POST',body:{drafts:[draft]}});
    expect(committed.status).toBe(200);
    committed.body.data.created.forEach((item:{record:{id:number}})=>fixtures.trackStudent(item.record.id));
    const exported=await request(target,config,'/student/export',{method:'POST',body:{idlist:committed.body.data.created.map((item:{record:{id:number}})=>item.record.id),type:'json'},binary:true});
    expect(exported.status).toBe(200);
    const rows=JSON.parse(exported.buffer.toString());
    expect(Object.keys(rows[0])).toEqual(columns);
    expect(rows[0].password).toBe('');
    const template=await request(target,config,'/student/import/template?type=json',{binary:true});
    expect(template.status).toBe(200);
    expect(Object.keys(JSON.parse(template.buffer.toString())[0])).toEqual(columns);
  },30_000);
});
