export const FUNDOS_QUADRO = [
  { key: "petroleo", label: "Petróleo", css: "linear-gradient(135deg, #0E6E66, #14A098)" },
  { key: "oceano", label: "Oceano", css: "linear-gradient(135deg, #0B4F6C, #01BAEF)" },
  { key: "floresta", label: "Floresta", css: "linear-gradient(135deg, #145A32, #27AE60)" },
  { key: "por-do-sol", label: "Pôr do sol", css: "linear-gradient(135deg, #D97757, #F2C14E)" },
  { key: "uva", label: "Uva", css: "linear-gradient(135deg, #4A2545, #8E44AD)" },
  { key: "ardosia", label: "Ardósia", css: "linear-gradient(135deg, #232420, #4B4E46)" },
  { key: "ceu", label: "Céu", css: "linear-gradient(135deg, #1B6FA8, #57C2E9)" },
  { key: "vinho", label: "Vinho", css: "linear-gradient(135deg, #5C1A1A, #B33951)" },
];

export function cssDoFundo(key) {
  return FUNDOS_QUADRO.find((f) => f.key === key)?.css ?? null;
}