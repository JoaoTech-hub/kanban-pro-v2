/**
 * Formata uma string de data ISO para o formato brasileiro dd/mm/aaaa.
 * Retorna string vazia se a data for inválida ou ausente.
 */
export function formatarData(dataISO) {
  if (!dataISO) return "";
  const [ano, mes, dia] = dataISO.split("-");
  if (!ano || !mes || !dia) return dataISO;
  return `${dia}/${mes}/${ano}`;
}

/**
 * Retorna o label em português para uma prioridade.
 */
export function labelPrioridade(prioridade) {
  const mapa = { baixa: "Baixa", media: "Média", alta: "Alta" };
  return mapa[prioridade] ?? prioridade;
}

/**
 * Verifica se um card está atrasado (prazo anterior a hoje).
 */
export function estaAtrasado(prazo) {
  if (!prazo) return false;
  return new Date(prazo) < new Date(new Date().toDateString());
}
