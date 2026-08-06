import { CsvFileCodec } from '../../src/common/files/csv-file.codec';
import { JsonFileCodec } from '../../src/common/files/json-file.codec';
import { XlsxFileCodec } from '../../src/common/files/xlsx-file.codec';
import { XmlFileCodec } from '../../src/common/files/xml-file.codec';
import type { FileCodec } from '../../src/common/files/file-codec.interface';
import type { FileFormat } from '../../src/common/files/file-format.type';
import { createContractConfig, type ContractConfig, type ContractTarget } from './contract-config';
import { requestContractTarget } from './contract-http';
import { ContractFixtures } from './contract-fixtures';

const columns = ['code','fullname','dob','gender','class','email','username','password','homecity','address','hobbies','description','hair_color','facebook'];
const codecs:Record<FileFormat,FileCodec>={csv:new CsvFileCodec(),xlsx:new XlsxFileCodec(),json:new JsonFileCodec(),xml:new XmlFileCodec()};
const request = (target:ContractTarget, config:ContractConfig, path:string, options?:Parameters<typeof requestContractTarget>[3]) => requestContractTarget(target,path,config.timeoutMs,options);

describe.each(createContractConfig().targets)('student import/export contract: %s',(target)=>{
  const config=createContractConfig();
  let fixtures:ContractFixtures;
  beforeAll(()=>{fixtures=new ContractFixtures();});
  afterAll(async()=>fixtures?.cleanup(),15_000);

  it.each(['csv','xlsx','json','xml'] as FileFormat[])('round-trips canonical rows through %s',async(format)=>{
    const suffix=`${target.name}-${format}-${Date.now().toString(36)}`;
    const fileConfig={...config,timeoutMs:30_000};
    const source={code:`ct-student-file-${suffix}`,fullname:'File Student',dob:'',gender:'Nam',class:'',email:`ct-student-file-${suffix}@example.test`,username:`ct-student-file-${suffix}`,password:'Valid1!x',homecity:'',address:'',hobbies:'',description:'',hair_color:'#000000',facebook:''};
    const form=new FormData();
    form.append('file',new Blob([await codecs[format].encode([source])],{type:'application/octet-stream'}),`students.${format}`);
    const preview=await request(target,fileConfig,'/student/import',{method:'POST',formData:form});
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({code:'200',status:200});
    const draft=preview.body.data.rows[0];
    expect(JSON.stringify(draft)).not.toContain('hash');
    const validate=await request(target,fileConfig,'/student/import/validate',{method:'POST',body:{drafts:[draft]}});
    expect(validate.status).toBe(200);
    const committed=await request(target,fileConfig,'/student/import/commit',{method:'POST',body:{drafts:[draft]}});
    expect(committed.status).toBe(200);
    committed.body.data.created.forEach((item:{record:{id:number}})=>fixtures.trackStudent(item.record.id));
    const exported=await request(target,fileConfig,'/student/export',{method:'POST',body:{idlist:committed.body.data.created.map((item:{record:{id:number}})=>item.record.id),type:format},binary:true});
    expect(exported.status).toBe(200);
    const rows=await codecs[format].parse(exported.buffer);
    expect(Object.keys(rows[0])).toEqual(columns);
    expect(rows[0].password).toBe('');
    const template=await request(target,fileConfig,`/student/import/template?type=${format}`,{binary:true});
    expect(template.status).toBe(200);
    expect(Object.keys((await codecs[format].parse(template.buffer))[0])).toEqual(columns);
  },30_000);
});
