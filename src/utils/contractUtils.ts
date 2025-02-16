import { ContractFunction } from '../types/contracts';

export const processABI = (abi: any[]): ContractFunction[] => {
  return abi
    .filter(item => item.type === 'function')
    .map(item => {
      const funcForDescription: ContractFunction = {
        name: item.name,
        description: '',
        type: item.type,
        stateMutability: item.stateMutability,
        inputs: item.inputs || [],
        outputs: item.outputs || []
      };
      
      return {
        name: item.name,
        description: generateFunctionDescription(funcForDescription),
        type: item.type,
        stateMutability: item.stateMutability,
        inputs: item.inputs.map((input: any) => ({
          name: input.name || 'value',
          type: input.type,
          description: `Input parameter of type ${input.type}`,
          components: input.components
        })),
        outputs: item.outputs?.map((output: any) => ({
          name: output.name || 'value',
          type: output.type,
          components: output.components
        }))
      };
    });
};

export const generateFunctionDescription = (func: ContractFunction): string => {
  const inputsDesc = func.inputs
    .map(input => `${input.name} (${input.type})`)
    .join(', ');
  
  const outputsDesc = func.outputs && func.outputs.length > 0
    ? ` returns (${func.outputs.map(out => `${out.name || 'value'} (${out.type})`).join(', ')})`
    : '';
  
  const mutability = func.stateMutability ? ` [${func.stateMutability}]` : '';
  
  return `${func.name}(${inputsDesc})${outputsDesc}${mutability}`;
};

export const generateExampleValue = (type: string): string => {
  switch (type) {
    case 'uint256':
    case 'uint':
      return '1000000000000000000'; // 1 ETH en wei
    case 'uint8':
      return '100';
    case 'address':
      return '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
    case 'bool':
      return 'true';
    case 'string':
      return '"Example String"';
    case 'bytes':
      return '0x0123456789abcdef';
    default:
      if (type.includes('[]')) {
        return '[]'; // Array vacío para tipos array
      }
      return '""'; // Valor por defecto para tipos desconocidos
  }
}; 