export const getISODateString = (date?: Date): string => {
  return (date || new Date()).toISOString().split("T")[0]; // YYYY-MM-DD
};
