import { FileCodec } from './file-codec.interface';
import { FileCodecRegistry } from './file-codec.registry';

describe('FileCodecRegistry', () => {
  const csvCodec: FileCodec = {
    format: 'csv',
    encode: jest.fn(),
    parse: jest.fn(),
  };

  it('registers and resolves a codec by format', () => {
    const registry = new FileCodecRegistry();
    registry.register(csvCodec);

    expect(registry.get('csv')).toBe(csvCodec);
  });

  it('rejects duplicate and unsupported formats clearly', () => {
    const registry = new FileCodecRegistry();
    registry.register(csvCodec);

    expect(() => registry.register(csvCodec)).toThrow('codec already registered for format: csv');
    expect(() => registry.get('xlsx')).toThrow('unsupported file format: xlsx');
  });
});
