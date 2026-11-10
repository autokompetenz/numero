/**
 * Affichage des pays côté navigateur.
 *
 * Les noms renvoyés par Ultra SMS sont dans la langue du fournisseur (souvent
 * le portugais) et les drapeaux sont neutres. On les remplace par le nom
 * français officiel (Intl.DisplayNames) et le drapeau dérivé du code ISO.
 */

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['fr'], { type: 'region' });
  } catch {
    return null;
  }
})();

export function countryDisplayName(code: string, fallback = ''): string {
  const normalized = (code ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return fallback || code;

  try {
    const name = regionNames?.of(normalized);
    if (name && name !== normalized) return name;
  } catch {
    // Code inconnu de l'ICU : on garde le libellé fournisseur.
  }
  return fallback || normalized;
}

export function countryDisplayFlag(code: string, fallback = '🌐'): string {
  const normalized = (code ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return fallback || '🌐';

  return String.fromCodePoint(
    ...[...normalized].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65),
  );
}
