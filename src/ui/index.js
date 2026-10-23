'use strict';
// Interfaz: tema, cadenas, geometría, dibujo (mgraphics y SVG), modelo y vistas (franja y panel).
module.exports = {
  theme: require('./theme'),
  strings: require('./strings'),
  geometry: require('./geometry'),
  canvas: require('./canvas'),
  widgets: require('./widgets'),
  model: require('./model'),
  strip: require('./strip'),
  panel: require('./panel'),
  listenView: require('./listen_view'),
};
