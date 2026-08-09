import { StudentCommandService } from './student-command.service';
import { StudentQueryService } from './student-query.service';
import type { StudentPersistenceTransaction, StudentRepositoryPort, StudentTransactionPort } from '../domain/student-persistence.port';

describe('Student persistence ports',()=>{
  it('uses the repository port for reads',async()=>{
    const repository:Pick<StudentRepositoryPort,'findActiveById'>={findActiveById:jest.fn().mockResolvedValue({id:'5',username:'student'})};
    const service=new StudentQueryService(repository as StudentRepositoryPort);
    await expect(service.getDetail(5)).resolves.toMatchObject({id:'5'});
    expect(repository.findActiveById).toHaveBeenCalledWith(5);
  });

  it('uses the transaction and repository ports for writes',async()=>{
    const transaction={} as StudentPersistenceTransaction;
    const transactions:StudentTransactionPort={run:jest.fn(async<T>(work:(value:StudentPersistenceTransaction)=>Promise<T>)=>work(transaction))};
    const repository:Pick<StudentRepositoryPort,'updateActive'>={updateActive:jest.fn().mockResolvedValue({id:'5'})};
    const passwords={hash:jest.fn(),compare:jest.fn()};
    const storage={upload:jest.fn(),delete:jest.fn(),getPublicUrl:jest.fn()};
    const service=new StudentCommandService(repository as StudentRepositoryPort,transactions,passwords,storage);
    await expect(service.update(5,{fullname:'Updated'})).resolves.toMatchObject({id:'5'});
    expect(transactions.run).toHaveBeenCalledTimes(1);
    expect(repository.updateActive).toHaveBeenCalledWith(5,{fullname:'Updated'},transaction);
  });
});
