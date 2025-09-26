export const asArray = <T = any,>(val: any): T[] => {
  if (Array.isArray(val)) return val as T[];
  if (val && typeof val === 'object' && Array.isArray((val as any).data)) return (val as any).data as T[];
  return [];
};
