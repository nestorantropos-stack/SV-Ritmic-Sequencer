'use strict';
// Núcleo de SV Ritmic Sequencer: JavaScript puro (CommonJS), sin dependencias de Max.
// Se prueba en Node (tests/) y se empaqueta en un único archivo para el objeto v8 (D-003).

module.exports = {
  ...require('./util'),
  ...require('./rng'),
  ...require('./rhythm'),
  ...require('./meter'),
  ...require('./cycles'),
  ...require('./syncopation'),
  ...require('./timing'),
  ...require('./layers'),
  transforms: require('./transforms'),
  ...require('./pattern'),
  catalog: require('./catalog'),
  harmony: require('./harmony'),
  ...require('./engine'),
  analysis: require('./analysis'),
  suggest: require('./suggest'),
  midifile: require('./midifile'),
  listen: require('./listen'),
};
