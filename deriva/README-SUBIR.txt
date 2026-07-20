DERIVA / XPAN — LISTO PARA /deriva/

1. Descomprime el ZIP.
2. Copia la carpeta completa "deriva" a la RAÍZ del repositorio actual de xpan.
   No sustituyas el repositorio ni copies solamente su contenido.
3. En GitHub Desktop: Commit to main → Push origin.
4. Abre https://xpan.earth/deriva/ y recarga una vez.

No necesita npm, build, servidor, variables de entorno ni cambios en el resto del sitio.

INSTALAR EN IPHONE
Safari → botón Compartir → Añadir a pantalla de inicio → Añadir.

ARQUITECTURA
PWA estática sin dependencias. Las tres ediciones viajan como snapshots dentro de
data/content.js. Guardados, notas, historial y preferencias se almacenan localmente
en IndexedDB. sw.js conserva el shell y snapshots para uso offline.

LÍMITE REAL
GitHub Pages no ejecuta ingestión server-side. La edición incluida es un corte
documental fechado 20.07.2026; no se presenta como noticias en vivo. Para renovar
contenido se sustituye el snapshot data/content.js mediante el flujo editorial del
repositorio. Las fuentes externas siempre se abren en su sitio original.
