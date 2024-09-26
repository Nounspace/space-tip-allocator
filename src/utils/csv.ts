export type DataObject = { [key: string]: string | number };

export const formatAsCsv = (
  data: DataObject[],
  columns: [column: string, label: string][]
): string => {
  const labels = columns.map(c => c[1]);
  const values = data.map((o: DataObject) => columns.map(c => o[c[0]]));
  return [labels, ...values].map(row => row.join(",")).join("\n");
}

export default formatAsCsv;