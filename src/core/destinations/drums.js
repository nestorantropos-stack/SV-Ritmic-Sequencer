'use strict';
// Resolución de golpe → nota MIDI con los mapas de data/drum_maps.json (editables por el usuario).

// Alias de roles del catálogo hacia los nombres de los mapas.
const ALIAS = {
  timeline: 'claves', bell: 'cowbell', clave: 'claves', surdo: 'kick', bombo: 'kick', alfaia: 'alfaia_grave',
  llamador: 'conga_open', guacharaca: 'guiro', darbuka: null, palmas: 'palma_sorda', accent: 'palma_abierta',
  group: 'perc_1', beat: 'perc_1', cell: 'perc_1', euclid: 'perc_1', ratio_2: 'perc_2', ratio_3: 'perc_1', ratio_4: 'perc_3',
  clap: 'clap', matra: 'perc_2', anga: 'perc_1', golpe: 'kick', sacudida: 'shaker', base: 'kick', pulse: 'tom', improvising: 'rim',
  six_eight: 'perc_1', three_four: 'perc_2', layer_a: 'perc_1', layer_b: 'perc_2', fixed: 'clap', shifting: 'rim',
  conga: 'conga_open', woodblock: 'woodblock_hi', tamborim: 'rim', chico_abierto: 'chico_abierto', gak: 'kick',
  tom: 'tom_mid', tom_mid: 'tom', ride_bell: 'ride', hat_open: 'hat_open',
};

// Mapa por defecto según el patrón (tradición) y el destino.
function chooseMap(pattern, destination, maps, override) {
  const byId = (id) => maps.find((m) => m.id === id);
  if (override && byId(override)) return byId(override);
  if (pattern.params && pattern.params.drum_map && byId(pattern.params.drum_map)) return byId(pattern.params.drum_map);
  const id = pattern.id || '';
  if (destination === 'hihats') return byId('hihats_gm');
  if (/^CIC\.4\.(3|4)/.test(id)) return byId('iqa_dum_tak');
  if (/^CIC\.4\.(1|2)/.test(id)) return byId('tala_bols');
  if (/^CIC\.4\.5/.test(id)) return byId('janggu');
  if (/^CIC\.5/.test(id)) return byId('gamelan_colotomic');
  if (/^CIC\.7/.test(id)) return byId('cajon_flamenco');
  if ((pattern.categories || []).includes('latin_percussion')) return byId('gm_percussion');
  if (/^RGG/.test(id) || (pattern.categories || []).includes('dub_reggae')) return byId('dub_kit');
  return byId('drum_rack_default');
}

// Devuelve una función role/timbre → nota. Los roles sin nota reciben pads libres en orden de aparición.
function makeResolver(map, fallbacks = []) {
  const used = new Set(Object.values(map.roles || {}));
  const extra = new Map();
  let nextPad = 36;
  const freePad = () => {
    while (used.has(nextPad) && nextPad < 52) nextPad++;
    const p = nextPad < 52 ? nextPad : 60 + extra.size;
    used.add(p);
    return p;
  };
  const lookup = (m, role) => {
    if (!m || !m.roles) return undefined;
    if (m.roles[role] !== undefined) return m.roles[role];
    const a = ALIAS[role];
    if (a && m.roles[a] !== undefined) return m.roles[a];
    return undefined;
  };
  return (role, timbre = 0) => {
    if (map.by_timbre && map.timbre) return map.timbre[String(timbre)] ?? map.timbre['0'];
    let p = lookup(map, role);
    for (const f of fallbacks) { if (p !== undefined) break; p = lookup(f, role); }
    if (p !== undefined) return p;
    if (!extra.has(role)) extra.set(role, freePad());
    return extra.get(role);
  };
}

module.exports = { chooseMap, makeResolver, ALIAS };
