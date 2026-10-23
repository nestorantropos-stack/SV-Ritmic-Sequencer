# Publicación y privacidad

Esta copia se publica con un historial nuevo: el historial de desarrollo local contiene metadatos personales y no se distribuye.

Se excluyen la configuración local del corpus, sus mediciones por archivo, muestras y MIDI de terceros, diagnósticos, credenciales y archivos de sesión de Live. Los patrones de producto, las fuentes culturales y las conclusiones agregadas se conservan. La autoría de Sidera Visus es información pública del producto.

Para repetir el análisis del corpus, copia `tools/corpus_sources.example.json` como `tools/corpus_sources.json` y configura tus propias carpetas. La configuración y los resultados permanecen ignorados por Git. No se requieren claves API para construir ni usar los dispositivos.

Los dispositivos en `dist/` se construyen sin `--install`, por lo que no incorporan rutas personales de instalación. Copia cada carpeta completa a tu User Library; los scripts JS deben permanecer junto a su .amxd. Consulta la guía y la lista de pruebas manuales para el estado de verificación.
