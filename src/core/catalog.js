'use strict';
// Catálogo de patrones: lista pública, búsqueda y filtros del navegador (Paso 3).

const isRestricted = (p) => !!(p.restricted_use || (p.origin && p.origin.restricted_use));

// Lista pública: excluye repertorio de uso restringido (§6.4 del informe). Esos patrones solo se
// ofrecen como principio estructural con su nota de contexto, mediante structuralPrinciples().
const publicPatterns = (patterns) => patterns.filter((p) => !isRestricted(p));
const structuralPrinciples = (patterns) => patterns.filter((p) => isRestricted(p) && p.structural_only);

// Normaliza para búsqueda sin tildes ni mayúsculas.
const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function haystack(p) {
  const o = p.origin || {};
  return fold([p.id, p.name, o.tradition, (o.genre || []).join(' '), o.context, (p.tags || []).join(' '), (p.taxonomy || []).join(' '), p.meter].join(' '));
}

// filters: { text, tradition, meter, destination, category, taxonomy (prefijo), status, verifiedOnly }
function search(patterns, filters = {}) {
  const terms = fold(filters.text).split(/\s+/).filter(Boolean);
  return publicPatterns(patterns).filter((p) => {
    if (terms.length) { const h = haystack(p); if (!terms.every((t) => h.includes(t))) return false; }
    if (filters.tradition && !fold(p.origin && p.origin.tradition).includes(fold(filters.tradition))) return false;
    if (filters.meter && p.meter !== filters.meter) return false;
    if (filters.destination && !(p.destinations || []).includes(filters.destination)) return false;
    if (filters.category && !(p.categories || []).includes(filters.category)) return false;
    if (filters.taxonomy && !(p.taxonomy || []).some((t) => t === filters.taxonomy || t.startsWith(filters.taxonomy + '.'))) return false;
    if (filters.status && p.status !== filters.status) return false;
    if (filters.verifiedOnly && p.verify) return false;
    return true;
  });
}

// Insignias que la interfaz muestra junto a cada patrón.
function badges(p) {
  const out = [];
  if (p.verify) out.push('verificar');
  if (p.status === 'C') out.push('corpus');
  if (p.missing_data) out.push('datos faltantes');
  if (isRestricted(p)) out.push('uso restringido');
  return out;
}

module.exports = { isRestricted, publicPatterns, structuralPrinciples, search, badges, fold };
