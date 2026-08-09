import { StudentCopyService } from './student-copy.service';
import { StudentImportExportService } from './student-import-export.service';
import type { StudentCopyPort, StudentImportExportPort } from '../domain/student-persistence.port';

describe('Student extracted application ports',()=>{
  it('delegates copy flows to the copy port fake',async()=>{
    const port:Pick<StudentCopyPort,'preview'|'commit'>={preview:jest.fn().mockResolvedValue({drafts:[]}),commit:jest.fn().mockResolvedValue({created:[]})};
    const service=new StudentCopyService(port as StudentCopyPort);
    await expect(service.preview([1])).resolves.toEqual({drafts:[]});
    await expect(service.commit([],[])).resolves.toEqual({created:[]});
    expect(port.preview).toHaveBeenCalledWith([1]);
    expect(port.commit).toHaveBeenCalledWith([],[]);
  });

  it('delegates import/export flows to the import/export port fake',async()=>{
    const port:Pick<StudentImportExportPort,'template'|'commitSafe'>={template:jest.fn().mockResolvedValue({filename:'template.csv'}),commitSafe:jest.fn().mockResolvedValue({created:[]})};
    const service=new StudentImportExportService(port as StudentImportExportPort);
    await expect(service.template('csv')).resolves.toEqual({filename:'template.csv'});
    await expect(service.commitSafe([])).resolves.toEqual({created:[]});
    expect(port.template).toHaveBeenCalledWith('csv');
    expect(port.commitSafe).toHaveBeenCalledWith([]);
  });
});
