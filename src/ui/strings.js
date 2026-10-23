'use strict';
// Textos de la interfaz. Español por defecto; otro idioma = otro archivo strings.<lang>.json con las mismas claves.
const ES = require('./strings.es.json');

const LANGS = { es: ES };
let current = ES;

function setLanguage(lang) { current = LANGS[lang] || ES; }
function registerLanguage(lang, table) { LANGS[lang] = table; }

// t('gen.summary', { bars: 8 }) → reemplaza {bars}. Si falta la clave, devuelve la clave (visible en pruebas).
function t(key, vars) {
  let s = current[key] ?? ES[key] ?? key;
  if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
  return s;
}

module.exports = { t, setLanguage, registerLanguage, ES };
