'use strict';
// Destino Ethnic drums: golpes con timbre (grave / agudo / abierto / apagado) mapeados por tradición:
// dum/tak, sam/tali/khali, gongs colotómicos, claves, capas latinas y kits de dub (drum_maps.json).
const { chooseMap, makeResolver } = require('./drums');
const { note } = require('./common');

const LONG = { gong: 2, kempul: 1, kenong: 0.8, pad: 2 };

function render(events, ctx) {
  const o = ctx.opts;
  const maps = (ctx.data.drumMaps && ctx.data.drumMaps.maps) || [];
  const map = chooseMap(ctx.norm.source, 'ethnic', maps, o.drumMap) || { id: 'rack', roles: { kick: 36 } };
  const rack = maps.find((m) => m.id === 'drum_rack_default');
  const resolve = makeResolver(map, rack ? [rack] : []);
  ctx.meta = { ...(ctx.meta || {}), drumMap: map.id };
  return events.map((e) => {
    const pitch = resolve(e.role, e.timbre);
    const dur = LONG[e.role] ? Math.max(e.gate, LONG[e.role]) : Math.max(0.05, Math.min(e.gate || 0.1, 0.5));
    return note(e, pitch, dur, ctx, { drumMap: map.id, timbre: e.timbre });
  });
}

module.exports = { render };
