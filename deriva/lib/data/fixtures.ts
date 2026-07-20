import type { ContentItem, Edition, EditionSlot, NewsEvent, SourceHealth } from "../types";
import { stableId } from "../engine/id";

const generatedAt = "2026-07-20T06:30:00-06:00";

const health: SourceHealth[] = [
  { id: "bbc-mundo", name: "BBC Mundo", type: "rss", status: "active", checkedAt: generatedAt, itemCount: 24, message: "feed oficial disponible" },
  { id: "un-es", name: "Noticias ONU", type: "rss", status: "active", checkedAt: generatedAt, itemCount: 18, message: "feed oficial disponible" },
  { id: "guardian", name: "The Guardian", type: "rss", status: "active", checkedAt: generatedAt, itemCount: 20, message: "feed oficial disponible" },
  { id: "reuters-seed", name: "Reuters", type: "rss", status: "configurable", checkedAt: generatedAt, itemCount: 6, message: "metadatos editoriales verificados en la edición inicial" },
];

function news(input: Partial<NewsEvent> & Pick<NewsEvent, "presentedTitle" | "summary" | "canonicalUrl" | "institution" | "category">): NewsEvent {
  const now = input.publishedAt ?? generatedAt;
  const id = input.id ?? stableId("news", input.presentedTitle, input.canonicalUrl);
  return {
    schemaVersion: 2,
    id,
    kind: "noticia",
    originalTitle: input.originalTitle ?? input.presentedTitle,
    presentedTitle: input.presentedTitle,
    summary: input.summary,
    originalDescription: input.originalDescription ?? input.summary,
    creator: input.creator ?? [],
    institution: input.institution,
    publishedAt: now,
    updatedAt: input.updatedAt ?? now,
    canonicalUrl: input.canonicalUrl,
    sourceUrl: input.sourceUrl ?? input.canonicalUrl,
    sources: input.sources ?? [{ name: input.institution, url: input.canonicalUrl, publishedAt: now }],
    media: input.media ?? [],
    thumbnail: input.thumbnail,
    rights: input.rights ?? "imagen de contexto; consultar atribución",
    license: input.license ?? "ver fuente",
    attribution: input.attribution ?? "imagen de contexto vinculada al acontecimiento",
    language: input.language ?? "es",
    place: input.place ?? [],
    topics: input.topics ?? [],
    entities: input.entities ?? [],
    materials: input.materials ?? [],
    operations: input.operations ?? [],
    scores: input.scores ?? { visualQuality: 0.76, relevance: 0.84, novelty: 0.72, distance: 0.45, reliability: 0.82 },
    relations: input.relations ?? [],
    verification: input.verification ?? ((input.sources?.length ?? 1) > 1 ? "verificado" : "fuente-unica"),
    provenance: input.provenance ?? { adapter: "verified-seed", rawId: id, fetchedAt: generatedAt, cacheKey: id },
    selectionReasons: input.selectionReasons ?? ["impacto actual", "diversidad de la edición"],
    firstIngestedAt: input.firstIngestedAt ?? generatedAt,
    lastIngestedAt: input.lastIngestedAt ?? generatedAt,
    category: input.category,
    whyItMatters: input.whyItMatters,
    continuationOf: input.continuationOf ?? [],
  };
}

const iran = news({
  presentedTitle: "Estados Unidos ataca Irán por noveno día; dos petroleros quedan inmovilizados en Ormuz",
  summary: "Estados Unidos lanzó una nueva jornada de ataques sobre objetivos iraníes mientras Teherán informó de explosiones en dos petroleros que transitaban el estrecho de Ormuz. La escalada mantiene interrumpida una ruta central para la energía mundial y elevó nuevamente el precio del crudo. Las cifras de víctimas y daños continúan en desarrollo.",
  institution: "Reuters",
  category: "mundo",
  canonicalUrl: "https://www.reuters.com/world/middle-east/us-launches-iran-strikes-ninth-day-another-american-confirmed-killed-2026-07-20/",
  sources: [
    { name: "Reuters", url: "https://www.reuters.com/world/middle-east/us-launches-iran-strikes-ninth-day-another-american-confirmed-killed-2026-07-20/", publishedAt: "2026-07-20T01:49:00Z" },
    { name: "Reuters — seguimiento", url: "https://www.reuters.com/world/iran-war-live-us-military-resumes-strikes-iran-after-attacks-hormuz-strait-2026-07-07/", publishedAt: "2026-07-20T01:49:00Z" },
  ],
  publishedAt: "2026-07-20T01:49:00Z",
  updatedAt: "2026-07-20T06:10:00Z",
  verification: "en-desarrollo",
  whyItMatters: "Ormuz concentra una parte decisiva del comercio marítimo de petróleo y gas.",
  place: ["Irán", "Estrecho de Ormuz"],
  topics: ["conflicto", "energía", "transporte marítimo"],
  entities: ["Estados Unidos", "Irán", "Estrecho de Ormuz"],
  operations: ["bloqueo", "ataque", "interrupción"],
  media: [{ url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Strait_of_Hormuz-svg-en.svg/960px-Strait_of_Hormuz-svg-en.svg.png", type: "image", alt: "Mapa del estrecho de Ormuz", attribution: "Goran tek-en / Wikimedia Commons — imagen de contexto", license: "CC BY-SA 4.0 / ODbL" }],
  selectionReasons: ["impacto global", "historia en desarrollo", "infraestructura crítica"],
});

const blackSea = news({
  presentedTitle: "Un ataque ruso contra un carguero civil en el mar Negro deja cinco muertos",
  summary: "Fuerzas rusas alcanzaron un buque internacional cerca de Odesa, según autoridades ucranianas. Cinco tripulantes murieron, ocho fueron rescatados y otras cinco personas permanecían desaparecidas al cierre de la edición. El ataque vuelve a colocar la navegación comercial y la exportación de grano ucraniano dentro del frente directo de la guerra.",
  institution: "Reuters",
  category: "mundo",
  canonicalUrl: "https://www.reuters.com/3fec1b0a85a0/world/europe/russian-strike-cargo-ship-black-sea-kills-5-kyiv-says-2026-07-19/",
  sources: [
    { name: "Reuters", url: "https://www.reuters.com/3fec1b0a85a0/world/europe/russian-strike-cargo-ship-black-sea-kills-5-kyiv-says-2026-07-19/", publishedAt: "2026-07-19T20:04:00Z" },
    { name: "The Kyiv Independent", url: "https://kyivindependent.com/russian-missile-strike-civilian-grain-ship-black-sea-kills-5/", publishedAt: "2026-07-19T23:44:00Z" },
  ],
  publishedAt: "2026-07-19T20:04:00Z",
  verification: "en-desarrollo",
  whyItMatters: "La seguridad del corredor marítimo determina parte de la oferta mundial de granos.",
  place: ["Odesa", "Mar Negro", "Ucrania"],
  topics: ["guerra", "logística", "alimentos"],
  entities: ["Rusia", "Ucrania", "Mar Negro"],
  operations: ["transporte", "interrupción"],
  media: [{ url: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Black_Sea_map.png", type: "image", alt: "Mapa del mar Negro", attribution: "Wikimedia Commons — imagen de contexto", license: "ver ficha de Commons" }],
});

const worldCup = news({
  presentedTitle: "España vence a Argentina en tiempo extra y gana su segundo Mundial",
  summary: "España derrotó 1–0 a Argentina en Nueva Jersey con un gol de Ferran Torres durante el tiempo extra. El equipo cerró el torneo con una racha de 38 partidos sin derrota y sumó su segundo campeonato mundial. La final también produjo celebraciones multitudinarias en España y reuniones públicas en Ciudad de México.",
  institution: "Reuters",
  category: "acontecimiento",
  canonicalUrl: "https://www.reuters.com/sports/soccer/torres-grabs-extra-time-winner-spain-beat-toothless-argentina-win-their-second-2026-07-19/",
  sources: [
    { name: "Reuters", url: "https://www.reuters.com/sports/soccer/torres-grabs-extra-time-winner-spain-beat-toothless-argentina-win-their-second-2026-07-19/", publishedAt: "2026-07-19T23:20:00Z" },
    { name: "Reuters — fotografía", url: "https://www.reuters.com/pictures/photos-spain-beat-argentina-win-world-cup-2026-07-20/32TMY3QM4BLIZC5DWEP4WULNM4", publishedAt: "2026-07-20T05:10:00Z" },
  ],
  publishedAt: "2026-07-19T23:20:00Z",
  whyItMatters: "El torneo cerró después de seis semanas de operación urbana distribuida entre tres países.",
  place: ["Nueva Jersey", "España", "Ciudad de México"],
  topics: ["deporte", "ciudad", "ritual colectivo"],
  entities: ["España", "Argentina", "FIFA"],
  operations: ["competencia", "celebración"],
  media: [{ url: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Flag_of_Spain.svg", type: "image", alt: "Bandera de España", attribution: "Wikimedia Commons — imagen de contexto", license: "dominio público" }],
});

const metro = news({
  presentedTitle: "Una falla en un convoy de la Línea B provoca demoras en el Metro de Ciudad de México",
  summary: "El Sistema de Transporte Colectivo retiró de circulación un tren de la Línea B después de reportarse una falla durante el servicio del domingo. La maniobra provocó tiempos de espera mayores en el corredor que conecta Buenavista con Ciudad Azteca. La autoridad indicó que la unidad quedó bajo revisión técnica.",
  institution: "La Jornada",
  category: "cdmx",
  canonicalUrl: "https://www.jornada.com.mx/",
  sources: [{ name: "La Jornada", url: "https://www.jornada.com.mx/", publishedAt: "2026-07-19T23:00:00-06:00" }],
  publishedAt: "2026-07-19T23:00:00-06:00",
  whyItMatters: "La Línea B mueve diariamente a cientos de miles de personas entre la capital y el Estado de México.",
  place: ["Ciudad de México", "Estado de México"],
  topics: ["movilidad", "infraestructura", "mantenimiento"],
  entities: ["Metro CDMX", "Línea B"],
  operations: ["revisión", "retiro", "transporte"],
  media: [{ url: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Mexico_City_Metro_Line_B.svg", type: "image", alt: "Identidad gráfica de la Línea B", attribution: "Wikimedia Commons — imagen de contexto", license: "ver ficha de Commons" }],
  verification: "fuente-unica",
});

const dataCenters = news({
  presentedTitle: "La oposición a los centros de datos se convierte en una protesta nacional en Estados Unidos",
  summary: "Organizadores registraron 142 protestas en 42 estados contra la expansión acelerada de centros de datos para inteligencia artificial. Las movilizaciones reunieron inquietudes por consumo de agua, presión sobre la red eléctrica y falta de consulta local. El conflicto convierte una infraestructura casi invisible en un asunto territorial y político de escala nacional.",
  institution: "Reuters",
  category: "infraestructura",
  canonicalUrl: "https://www.reuters.com/business/retail-consumer/us-data-center-protests-go-national-backlash-grows-2026-07-18/",
  sources: [
    { name: "Reuters", url: "https://www.reuters.com/business/retail-consumer/us-data-center-protests-go-national-backlash-grows-2026-07-18/", publishedAt: "2026-07-18T18:00:00Z" },
    { name: "Reuters — On Assignment", url: "https://www.reuters.com/podcasts/data-centers-small-town-politics-turn-into-national-fight-2026-07-18/", publishedAt: "2026-07-18T12:00:00Z" },
  ],
  publishedAt: "2026-07-18T18:00:00Z",
  whyItMatters: "La expansión de IA ya compite físicamente por suelo, agua y capacidad eléctrica.",
  place: ["Estados Unidos"],
  topics: ["inteligencia artificial", "energía", "territorio"],
  entities: ["HumansFirst", "centros de datos"],
  materials: ["agua", "electricidad", "servidores"],
  operations: ["enfriamiento", "cómputo", "protesta"],
  media: [{ url: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Server-rack.jpg", type: "image", alt: "Infraestructura de servidores", attribution: "Wikimedia Commons — imagen de contexto", license: "ver ficha de Commons" }],
});

const dnaChip = news({
  presentedTitle: "Un chip de silicio escribe 64 secuencias de ADN con electricidad y enzimas en agua",
  summary: "Un equipo encabezado por Harvard demostró síntesis paralela de ADN sobre un semiconductor mediante corrientes eléctricas y química enzimática acuosa. El prototipo evita buena parte de los solventes usados por los métodos convencionales y señala una ruta hacia dispositivos compactos de fabricación genética. La química de desprotección sigue siendo el principal límite para escalarlo.",
  institution: "Harvard SEAS",
  category: "ciencia",
  canonicalUrl: "https://seas.harvard.edu/news/making-dna-semiconductor-chip",
  sources: [
    { name: "Harvard SEAS", url: "https://seas.harvard.edu/news/making-dna-semiconductor-chip", publishedAt: "2026-06-17T12:00:00Z" },
    { name: "ScienceDaily", url: "https://www.sciencedaily.com/releases/2026/07/260708022202.htm", publishedAt: "2026-07-08T02:22:00Z" },
  ],
  publishedAt: "2026-07-08T02:22:00Z",
  whyItMatters: "Integra fabricación biológica y electrónica dentro de una misma superficie direccionable.",
  place: ["Cambridge, Massachusetts"],
  topics: ["biotecnología", "semiconductores", "fabricación"],
  entities: ["Harvard SEAS", "Nature Electronics"],
  materials: ["silicio", "ADN", "agua"],
  operations: ["síntesis", "direccionamiento", "escritura"],
  media: [{ url: "https://commons.wikimedia.org/wiki/Special:Redirect/file/DNA_double_helix_horizontal.png", type: "image", alt: "Estructura de doble hélice del ADN", attribution: "Wikimedia Commons — imagen de contexto", license: "ver ficha de Commons" }],
});

const comet = news({
  presentedTitle: "NASA concluye que un objeto cercano a la Tierra clasificado como asteroide es en realidad un cometa",
  summary: "Observaciones coordinadas permitieron detectar actividad cometaria en un objeto registrado inicialmente como asteroide cercano a la Tierra. La reclasificación mejora los modelos usados para distinguir superficies inertes de cuerpos que expulsan gas y polvo. El objeto no representa una amenaza inmediata, pero amplía el inventario utilizado por los sistemas de defensa planetaria.",
  institution: "NASA",
  category: "ciencia",
  canonicalUrl: "https://science.nasa.gov/blogs/planetary-defense/",
  sources: [{ name: "NASA Planetary Defense", url: "https://science.nasa.gov/blogs/planetary-defense/", publishedAt: "2026-07-17T12:00:00Z" }],
  publishedAt: "2026-07-17T12:00:00Z",
  whyItMatters: "La clasificación correcta modifica cómo se calcula el comportamiento futuro de estos cuerpos.",
  topics: ["astronomía", "defensa planetaria", "clasificación"],
  entities: ["NASA", "Near-Earth Object"],
  materials: ["hielo", "polvo"],
  operations: ["observación", "clasificación"],
  media: [{ url: "https://images-assets.nasa.gov/image/PIA12348/PIA12348~orig.jpg", type: "image", alt: "Cuerpo menor observado en el espacio", attribution: "NASA/JPL-Caltech — imagen de contexto", license: "NASA media usage guidelines" }],
  verification: "fuente-unica",
});

const palermo = news({
  presentedTitle: "Un jardín móvil atraviesa Palermo durante el Festino de Santa Rosalía",
  summary: "Mario Cucinella diseñó el carro ceremonial de la edición 402 del Festino como una topografía móvil cubierta de vegetación mediterránea. La estructura de madera incorpora referencias al monte Pellegrino y una cruz hecha con madera de embarcaciones migrantes. El proyecto está pensado para permanecer después de la procesión como instalación pública.",
  institution: "Wallpaper*",
  category: "cultura",
  canonicalUrl: "https://www.wallpaper.com/design-interiors/festino-di-santa-rosalia-palermo-mario-cucinella-mca",
  sources: [{ name: "Wallpaper*", url: "https://www.wallpaper.com/design-interiors/festino-di-santa-rosalia-palermo-mario-cucinella-mca", publishedAt: "2026-07-18T10:00:00Z" }],
  publishedAt: "2026-07-18T10:00:00Z",
  whyItMatters: "Convierte una arquitectura efímera de ritual en una pieza permanente de espacio público.",
  place: ["Palermo", "Sicilia"],
  topics: ["arquitectura", "ritual", "espacio público"],
  entities: ["Mario Cucinella", "Santa Rosalía"],
  materials: ["madera", "vegetación"],
  operations: ["procesión", "ensamble", "reutilización"],
  media: [{ url: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Santa_Rosalia_statue.jpg", type: "image", alt: "Representación de Santa Rosalía", attribution: "Wikimedia Commons — imagen de contexto", license: "ver ficha de Commons" }],
  verification: "fuente-unica",
});

const allNews = [iran, blackSea, worldCup, metro, dataCenters, dnaChip, comet, palermo];

function edition(slot: EditionSlot, events: NewsEvent[], hour: number): Edition {
  const id = `edition-2026-07-20-${slot.replace(":", "")}`;
  return {
    schemaVersion: 2,
    id,
    date: "2026-07-20",
    slot,
    generatedAt: `2026-07-20T${String(hour).padStart(2, "0")}:00:00-06:00`,
    timezone: "America/Mexico_City",
    title: slot === "10:00" ? "mañana" : slot === "15:00" ? "tarde" : "noche",
    dek: "una edición finita: acontecimientos que alteran sistemas, territorios y formas de vida.",
    events,
    continuedIds: slot === "10:00" ? [] : [iran.id, blackSea.id],
    newIds: events.map((event) => event.id),
    sourceHealth: health,
    reasons: Object.fromEntries(events.map((event) => [event.id, event.selectionReasons])),
  };
}

export const seedEditions: Edition[] = [
  edition("10:00", allNews.slice(0, 6), 10),
  edition("15:00", [iran, blackSea, metro, dataCenters, dnaChip, comet, palermo], 15),
  edition("20:00", allNews, 20),
];

function archive(input: Partial<ContentItem> & Pick<ContentItem, "presentedTitle" | "summary" | "canonicalUrl" | "institution" | "kind">): ContentItem {
  const id = input.id ?? stableId(input.institution.toLowerCase().replace(/\W+/g, "-"), input.presentedTitle, input.canonicalUrl);
  return {
    schemaVersion: 2,
    id,
    kind: input.kind,
    originalTitle: input.originalTitle ?? input.presentedTitle,
    presentedTitle: input.presentedTitle,
    summary: input.summary,
    originalDescription: input.originalDescription ?? input.summary,
    creator: input.creator ?? [],
    institution: input.institution,
    objectDate: input.objectDate,
    publishedAt: input.publishedAt,
    updatedAt: input.updatedAt,
    canonicalUrl: input.canonicalUrl,
    sourceUrl: input.sourceUrl ?? input.canonicalUrl,
    sources: input.sources ?? [{ name: input.institution, url: input.canonicalUrl }],
    media: input.media ?? [],
    thumbnail: input.thumbnail,
    rights: input.rights ?? "consultar ficha de origen",
    license: input.license ?? "ver fuente",
    attribution: input.attribution ?? input.institution,
    language: input.language ?? "es",
    place: input.place ?? [],
    topics: input.topics ?? [],
    entities: input.entities ?? [],
    materials: input.materials ?? [],
    operations: input.operations ?? [],
    scores: input.scores ?? { visualQuality: 0.82, relevance: 0.62, novelty: 0.8, distance: 0.58, reliability: 0.9 },
    relations: input.relations ?? [],
    verification: input.verification ?? "verificado",
    provenance: input.provenance ?? { adapter: "fixture", rawId: id, fetchedAt: generatedAt, cacheKey: id },
    selectionReasons: input.selectionReasons ?? ["reserva documental verificada"],
    firstIngestedAt: generatedAt,
    lastIngestedAt: generatedAt,
  };
}

export const archiveFixtures: ContentItem[] = [
  archive({ kind: "mapa", presentedTitle: "Carta de corrientes del Atlántico Norte", summary: "Una carta náutica transforma desplazamientos atmosféricos y oceánicos en líneas de navegación. El documento permite seguir el hilo desde la logística contemporánea hacia los sistemas históricos de medición, pronóstico y circulación marítima.", institution: "Library of Congress", canonicalUrl: "https://www.loc.gov/maps/", objectDate: "siglo XIX", topics: ["territorio", "navegación", "clima"], operations: ["medición", "trazado"], materials: ["papel", "tinta"], media: [{ url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Ocean_currents_1943_Gulf_Stream.png/960px-Ocean_currents_1943_Gulf_Stream.png", type: "image", alt: "Carta cartográfica histórica de corrientes del Atlántico", attribution: "U.S. Army / Wikimedia Commons — imagen documental de contexto", license: "dominio público en Estados Unidos" }] }),
  archive({ kind: "patente", presentedTitle: "Estructura plegable para despliegue remoto", summary: "Dibujos técnicos de un sistema articulado que reduce su volumen para transporte y aumenta su superficie al desplegarse. La secuencia de bisagras convierte una forma estática en una operación logística legible.", institution: "búsqueda externa: Google Patents", canonicalUrl: "https://patents.google.com/?q=(deployable+folding+structure)", objectDate: "archivo de patentes", topics: ["estructura", "logística", "mecanismo"], operations: ["plegar", "desplegar"], materials: ["acero"], verification: "sin-verificar", scores: { visualQuality: 0.72, relevance: 0.64, novelty: 0.83, distance: 0.44, reliability: 0.55 } }),
  archive({ kind: "imagen", presentedTitle: "La Tierra sobre el horizonte lunar", summary: "Una imagen de misión convierte la relación entre dos cuerpos celestes en escala perceptible. El horizonte funciona como instrumento de orientación, mientras la Tierra aparece como un objeto distante dentro del campo negro.", institution: "NASA Image and Video Library", canonicalUrl: "https://images.nasa.gov/", objectDate: "archivo espacial", topics: ["espacio", "orientación", "planeta"], operations: ["observar", "orbitar"], media: [{ url: "https://images-assets.nasa.gov/image/PIA12348/PIA12348~orig.jpg", type: "image", alt: "Superficie planetaria registrada por NASA", attribution: "NASA/JPL-Caltech", license: "NASA media usage guidelines" }] }),
  archive({ kind: "objeto", presentedTitle: "Modelo de mecanismo astronómico", summary: "Un instrumento científico hace visible un sistema de movimientos mediante engranes, escalas y soportes. Su forma no representa únicamente el cielo: organiza una cadena de cálculo y observación.", institution: "The Met Open Access", canonicalUrl: "https://www.metmuseum.org/art/collection", objectDate: "siglos XVIII–XIX", topics: ["instrumento", "astronomía", "cálculo"], operations: ["medir", "rotar"], materials: ["latón", "acero"] }),
  archive({ kind: "libro", presentedTitle: "Manual de señalización ferroviaria", summary: "Un manual técnico presenta códigos visuales para coordinar máquinas, infraestructura y operadores distribuidos. Cada lámina condensa una regla operativa cuyo sentido depende de una red completa.", institution: "Internet Archive", canonicalUrl: "https://archive.org/details/manuals", objectDate: "archivo industrial", topics: ["ferrocarril", "infraestructura", "código"], operations: ["señalizar", "coordinar"], materials: ["papel"], media: [{ url: "https://archive.org/services/img/manuals", type: "image", alt: "Cubierta de la colección de manuales", attribution: "Internet Archive", license: "varía por ítem" }] }),
  archive({ kind: "paper", presentedTitle: "Acústica activa en estructuras reconfigurables", summary: "Una investigación reciente estudia cómo geometrías móviles alteran propagación, resonancia y percepción. El paper permite pasar de una composición espacial hacia los parámetros físicos que sostienen su comportamiento.", institution: "arXiv", canonicalUrl: "https://arxiv.org/", objectDate: "investigación reciente", topics: ["acústica", "estructura", "percepción"], operations: ["resonar", "reconfigurar"], materials: ["aire", "membrana"] }),
  archive({ kind: "imagen", presentedTitle: "The Great Wave", summary: "La ola aparece como una máquina de escala: curva, fragmenta y contiene el horizonte. Su circulación contemporánea convive con una materialidad original precisa de papel, tinta y registro xilográfico.", institution: "Art Institute of Chicago", canonicalUrl: "https://www.artic.edu/artworks/24645/kanagawa-oki-nami-ura-under-the-wave-off-kanagawa", creator: ["Katsushika Hokusai"], objectDate: "1830/33", topics: ["agua", "escala", "impresión"], operations: ["imprimir", "propagar"], materials: ["papel", "tinta"], media: [{ url: "https://api.artic.edu/api/v1/artworks/24645/manifest.json", type: "pdf", alt: "Manifiesto IIIF de The Great Wave", attribution: "Art Institute of Chicago", license: "dominio público" }] }),
  archive({ kind: "objeto", presentedTitle: "Modelo de patente del contador Atkinson", summary: "El objeto traduce un procedimiento abstracto de conteo en una disposición mecánica compacta. Sus ruedas y marcas registran acumulaciones discretas antes de la electrónica.", institution: "Smithsonian Open Access", canonicalUrl: "https://www.si.edu/openaccess", objectDate: "siglo XIX", topics: ["conteo", "mecanismo", "patente"], operations: ["acumular", "registrar"], materials: ["metal", "madera"], verification: "fuente-unica" }),
  archive({ kind: "imagen", presentedTitle: "Diagrama descriptivo de geometría", summary: "Planos proyectados y líneas auxiliares convierten un volumen en información constructiva. El diagrama es simultáneamente explicación, operación y protocolo de transferencia.", institution: "Wikimedia Commons", canonicalUrl: "https://commons.wikimedia.org/wiki/File:Descriptive_geometry_diagram_1878.jpg", objectDate: "1878", topics: ["geometría", "proyección", "dibujo"], operations: ["proyectar", "seccionar"], materials: ["papel", "tinta"], media: [{ url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Descriptive_geometry_diagram_1878.jpg/1280px-Descriptive_geometry_diagram_1878.jpg", type: "image", alt: "Diagrama de geometría descriptiva", attribution: "Wikimedia Commons", license: "dominio público" }] }),
  archive({ kind: "pdf", presentedTitle: "Atlas de anatomía industrial", summary: "Una secuencia de láminas desarma máquinas en conjuntos legibles. Las vistas cortadas permiten reconstruir mentalmente la continuidad entre carcasa, movimiento y mantenimiento.", institution: "Wellcome Collection", canonicalUrl: "https://wellcomecollection.org/works", objectDate: "archivo técnico", topics: ["anatomía", "máquina", "mantenimiento"], operations: ["cortar", "ensamblar"], materials: ["papel", "hierro"] }),
  archive({ kind: "audio", presentedTitle: "Paisaje sonoro de una estación ferroviaria", summary: "Un registro de campo conserva anuncios, fricción, ritmos mecánicos y pausas dentro de una infraestructura en operación. La escucha permite recorrer el sistema sin reducirlo a una sola imagen.", institution: "Internet Archive", canonicalUrl: "https://archive.org/details/audio", objectDate: "archivo sonoro", topics: ["ferrocarril", "acústica", "infraestructura"], operations: ["escuchar", "transportar"], materials: ["aire", "acero"] }),
  archive({ kind: "objeto", presentedTitle: "Modelo de navío como base de datos material", summary: "El modelo reúne escala, memoria constructiva y secuencia de ensamblaje. Cada cuerda y pieza conserva información sobre una operación que en el barco real ocurre distribuida sobre cientos de metros.", institution: "Rijksmuseum Data Services", canonicalUrl: "https://data.rijksmuseum.nl/search/collection?type=model+ship&imageAvailable=true", objectDate: "colección histórica", topics: ["modelo", "navegación", "ensamble"], operations: ["reducir", "representar"], materials: ["madera", "cuerda"] }),
  archive({ kind: "imagen", presentedTitle: "Sistema botánico de clasificación por lámina", summary: "Una imagen científica separa una planta en órganos, escalas y momentos de crecimiento. La lámina no copia un espécimen: construye una interfaz para compararlo con otros.", institution: "Cleveland Museum of Art Open Access", canonicalUrl: "https://www.clevelandart.org/open-access", objectDate: "archivo natural", topics: ["botánica", "clasificación", "imagen"], operations: ["separar", "comparar"], materials: ["papel", "pigmento"] }),
];
