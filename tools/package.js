'use strict';
// Empaqueta una versión para distribuir: build/release/SV_Ritmic_Sequencer_<versión>.zip con el dispositivo,
// sus scripts, el preset .adv, la guía de uso y las pruebas manuales.
// Uso: node tools/package.js
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const NAME = 'SV Ritmic Sequencer';

function main() {
  const build = spawnSync(process.execPath, [path.join(__dirname, 'build_amxd.js')], { stdio: 'inherit' });
  if (build.status !== 0) throw new Error('Falló build_amxd.js');
  const stage = path.join(ROOT, 'build', 'release', `SV_Ritmic_Sequencer_${pkg.version}`);
  fs.rmSync(stage, { recursive: true, force: true });
  fs.mkdirSync(path.join(stage, NAME, 'exports'), { recursive: true });
  const dev = path.join(ROOT, 'build', 'device');
  for (const f of [`${NAME}.amxd`, 'sv_rs_v8.js', 'sv_rs_ui.js', 'sv_rs_engine.js']) fs.copyFileSync(path.join(dev, f), path.join(stage, NAME, f));
  for (const [src, dst] of [['README.md', 'LEEME.md'], ['docs/GUIA_DE_USO.md', 'GUIA_DE_USO.md'], ['docs/PRUEBAS_MANUALES.md', 'PRUEBAS_MANUALES.md'], ['CHANGELOG.md', 'CAMBIOS.md']]) {
    if (fs.existsSync(path.join(ROOT, src))) fs.copyFileSync(path.join(ROOT, src), path.join(stage, dst));
  }
  const zip = `${stage}.zip`;
  fs.rmSync(zip, { force: true });
  // bsdtar (Windows 10+ en System32, macOS) crea .zip con -a; el tar de GNU de Git Bash no, por eso se fija la ruta
  const sysTar = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
  const r = spawnSync(sysTar, ['-a', '-c', '-f', zip, '-C', path.dirname(stage), path.basename(stage)], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('No se pudo crear el .zip (tar -a)');
  console.log(`ok: ${zip} (${(fs.statSync(zip).size / 1024).toFixed(0)} KB)`);
}

if (require.main === module) main();
