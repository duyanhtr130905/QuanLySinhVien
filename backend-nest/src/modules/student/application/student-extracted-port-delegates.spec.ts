import { StudentImportExportService } from './student-import-export.service';
import type { StudentImportExportPort } from '../domain/student-persistence.port';

describe('Student extracted application ports',()=>{
  it('delegates import/export flows to the import/export port fake',async()=>{
    const port:Pick<StudentImportExportPort,'template'|'commitSafe'>={template:jest.fn().mockResolvedValue({filename:'template.csv'}),commitSafe:jest.fn().mockResolvedValue({created:[]})};
    const service=new StudentImportExportService(port as StudentImportExportPort);
    await expect(service.template('csv')).resolves.toEqual({filename:'template.csv'});
    await expect(service.commitSafe([])).resolves.toEqual({created:[]});
    expect(port.template).toHaveBeenCalledWith('csv');
    expect(port.commitSafe).toHaveBeenCalledWith([]);
  });
});
