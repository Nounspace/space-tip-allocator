export const sumBy = <T>(arr: T[], getVal: (item: T) => number): number => {
  return arr.map(getVal).reduce((sum, val) => sum + val, 0);
};
