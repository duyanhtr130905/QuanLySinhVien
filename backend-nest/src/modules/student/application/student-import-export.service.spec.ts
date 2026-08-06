import { StudentImportExportService } from './student-import-export.service';

const columns = ['code','fullname','dob','gender','class','email','username','password','homecity','address','hobbies','description','hair_color','facebook'];
const validValues = { code:'SV1', fullname:'One', dob:'01/01/2000', gender:'Nam', class:'C1', email:'one@example.test', username:'one', password:'Valid1!x', hobbies:'Music' };

const makeCodecs = () => {
  const codecs = new Map(['csv','xlsx','json','xml'].map((format) => [format, { encode:jest.fn(async(rows:Record<string,unknown>[]) => Buffer.from(JSON.stringify(rows))), parse:jest.fn(async() => [validValues]) }]));
  return { get:jest.fn((format:string) => codecs.get(format)), codecs };
};

const readonlyPool = () => ({ query:jest.fn().mockResolvedValueOnce({rows:[{id:1,code:'C1'}]}).mockResolvedValueOnce({rows:[{id:1,name:'Music',bit_value:1}]}).mockResolvedValueOnce({rows:[]}) });
const passwords = () => ({ hash:jest.fn(async(value:string) => `hash:${value}`) });

describe('StudentImportExportService',()=>{
  it.each(['csv','xlsx','json','xml'] as const)('keeps template/export schema and parses %s previews',async(format)=>{
    const codecs=makeCodecs();
    const pool=readonlyPool();
    const service=new StudentImportExportService(pool as never,{run:async<T>(work:(client:never)=>Promise<T>)=>work({} as never)} as never,codecs as never,passwords() as never);
    const template=await service.template(format);
    expect(Object.keys(JSON.parse(template.buffer.toString())[0])).toEqual(columns);
    const preview=await service.preview(Buffer.from('fixture'),`students.${format}`);
    expect(preview.rows[0]).toMatchObject({status:'valid',mode:'create'});
    expect(codecs.codecs.get(format)?.parse).toHaveBeenCalledWith(Buffer.from('fixture'));
  });

  it('exports the canonical schema with an empty password and resolved class/hobby names',async()=>{
    const codecs=makeCodecs();
    const pool={query:jest.fn().mockResolvedValueOnce({rows:[{id:1,code:'SV1',fullname:'One',sex:true,class_id:1,email:'one@example.test',username:'one',hobbies:1}]}).mockResolvedValueOnce({rows:[{id:1,code:'C1'}]}).mockResolvedValueOnce({rows:[{id:1,name:'Music',bit_value:1}]})};
    const service=new StudentImportExportService(pool as never,{run:async<T>(work:(client:never)=>Promise<T>)=>work({} as never)} as never,codecs as never,passwords() as never);
    const file=await service.exportOne(1,'json');
    const rows=JSON.parse(file.buffer.toString()) as Array<Record<string,unknown>>;
    expect(Object.keys(rows[0])).toEqual(columns);
    expect(rows[0]).toMatchObject({class:'C1',hobbies:'Music',gender:'Nam',password:''});
    expect(JSON.stringify(rows)).not.toContain('hash:');
  });

  it('validates duplicates, legacy gender/date, and missing password without hashing or writes',async()=>{
    const pool={query:jest.fn().mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[{code:'OTHER',email:'taken@example.test',username:'taken'}]})};
    const hasher=passwords();
    const service=new StudentImportExportService(pool as never,{run:async<T>(work:(client:never)=>Promise<T>)=>work({} as never)} as never,makeCodecs() as never,hasher as never);
    const result=await service.validate([
      {draftKey:'one',values:{...validValues,code:'DUP',email:'taken@example.test',username:'taken',gender:'not-a-gender',dob:'2000/01/01'}},
      {draftKey:'two',values:{...validValues,code:'DUP',email:'two@example.test',username:'two',password:''}},
    ]);
    expect(result.rows[0].fieldErrors).toEqual(expect.objectContaining({code:expect.any(String),email:expect.any(String),username:expect.any(String),gender:expect.any(String),dob:expect.any(String)}));
    expect(result.rows[1].fieldErrors).toEqual(expect.objectContaining({code:expect.any(String),password:expect.any(String)}));
    expect(pool.query).toHaveBeenCalledTimes(3);
    expect(hasher.hash).not.toHaveBeenCalled();
  });

  it('updates class/hobbies while preserving an existing hash for a blank password',async()=>{
    const client={query:jest.fn()
      .mockResolvedValueOnce({rows:[{id:1,code:'C1'}]})
      .mockResolvedValueOnce({rows:[{id:2,name:'Music',bit_value:4}]})
      .mockResolvedValueOnce({rows:[{id:9,code:'SV1',email:'one@example.test',username:'one'}]})
      .mockResolvedValueOnce({rows:[{id:9,code:'SV1',password:'old-hash'}]})
      .mockResolvedValueOnce({rows:[{id:9,code:'SV1'}]})};
    const hasher=passwords();
    const service=new StudentImportExportService({} as never,{run:async<T>(work:(value:typeof client)=>Promise<T>)=>work(client)} as never,makeCodecs() as never,hasher as never);
    const result=await service.commit([{draftKey:'update',rowNumber:2,values:{...validValues,password:'',hobbies:'Music'}}]);
    expect(result.updated).toHaveLength(1);
    const updateCall=client.query.mock.calls[4];
    expect(updateCall[0]).toContain('UPDATE "tra_student"');
    expect(updateCall[0]).not.toContain('"password"');
    expect(updateCall[1]).toEqual(expect.arrayContaining([1,4]));
    expect(hasher.hash).not.toHaveBeenCalled();
  });

  it('rolls back an invalid create before any insert/update',async()=>{
    const client={query:jest.fn().mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[]})};
    const run=jest.fn(async<T>(work:(value:typeof client)=>Promise<T>)=>work(client));
    const service=new StudentImportExportService({} as never,{run} as never,makeCodecs() as never,passwords() as never);
    await expect(service.commit([{draftKey:'bad',values:{...validValues,password:''}}])).rejects.toMatchObject({code:'J604',getStatus:expect.any(Function)});
    expect(client.query).toHaveBeenCalledTimes(3);
  });
});
