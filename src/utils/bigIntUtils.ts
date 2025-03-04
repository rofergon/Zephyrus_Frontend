/**
 * Replacer function para JSON.stringify que maneja valores BigInt
 * Convierte BigInt a string y mantiene otros valores sin cambios
 */
export const bigIntReplacer = (_: string, value: any): any => {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
};

/**
 * Wrapper para JSON.stringify que maneja valores BigInt
 * @param value - El valor a serializar
 * @param space - Número de espacios para indentación (opcional)
 * @returns string - JSON serializado con BigInts convertidos a strings
 */
export const safeStringify = (value: any, space?: number): string => {
  return JSON.stringify(value, bigIntReplacer, space);
}; 