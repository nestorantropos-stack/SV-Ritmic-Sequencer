'use strict';
// Copia atómica para instalar: escribe un temporal y lo renombra, para que Max (autowatch) nunca lea un archivo a medias.
const fs = require('fs');
function copyAtomic(src, dest) {
  const tmp = dest + '.tmp';
  fs.copyFileSync(src, tmp);
  fs.renameSync(tmp, dest);
}

// Rellena las constantes de un script v8 (D-053): el sello del motor con el que se construyó (SV_ENGINE_BUILD) y,
// al instalar, la carpeta de instalación (SV_INSTALL_DIR, con «/» y barra final). En src/ quedan vacías.
function prepareScript(src, { build, installDir } = {}) {
  let out = src;
  const set = (name, value) => {
    const re = new RegExp(`^var ${name} = '';`, 'm');
    if (!re.test(out)) throw new Error(`el script no tiene «var ${name} = '';»`);
    out = out.replace(re, () => `var ${name} = ${JSON.stringify(value)};`);
  };
  if (build) set('SV_ENGINE_BUILD', build);
  if (installDir) set('SV_INSTALL_DIR', installDir.replace(/\\/g, '/').replace(/\/?$/, '/'));
  return out;
}

module.exports = { copyAtomic, prepareScript };
