export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const formatNumber = (value: number) => {
  return new Intl.NumberFormat("pt-PT").format(value);
};

export const formatPercent = (value: number) => {
  return `${value.toFixed(1)}%`;
};

export const getDiasDecorridosClassName = (dias: number) => {
  if (dias > 30) return "text-red-600 dark:text-red-400";
  if (dias > 14) return "text-yellow-600 dark:text-yellow-400";
  return "";
};

export const escalaoOrder: { [key: string]: number } = {
  "0-1500": 1,
  "1500-2500": 2,
  "2500-7500": 3,
  "7500-15000": 4,
  "15000-30000": 5,
  "30000+": 6,
};

export const getEscalaoOrder = (escalao: string): number => {
  return escalaoOrder[escalao] || 999;
};
