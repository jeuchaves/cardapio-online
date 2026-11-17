// Telefone brasileiro: a máscara é só visual. O que vai para a API é sempre o valor normalizado
// (apenas dígitos, até 13 com o código do país 55), que cabe nos 20 caracteres que a API aceita.

const MAX_DIGITS = 13;

export function normalizePhone(input: string): string {
  return input.replace(/\D/g, "").slice(0, MAX_DIGITS);
}

// (11) 9999-9999, (11) 99999-9999 ou +55 (11) 99999-9999. Valores parciais são formatados ao digitar.
export function formatPhone(digits: string): string {
  const country = digits.length > 11 && digits.startsWith("55");
  const national = country ? digits.slice(2) : digits;
  const area = national.slice(0, 2);
  const rest = national.slice(2);
  const split = rest.length > 8 ? 5 : 4;
  let text = area;
  if (national.length > 0) text = `(${area}`;
  if (national.length > 2) text = `(${area}) ${rest.slice(0, split)}`;
  if (rest.length > split) text += `-${rest.slice(split)}`;
  return country ? `+55 ${text}` : text;
}
