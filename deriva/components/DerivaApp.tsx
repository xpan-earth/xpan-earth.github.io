"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ContentItem, DriftOperation, Edition, LocalArchiveRecord, LocalPreferences, NewsEvent, SourceHealth } from "../lib/types";
import { selectLayout } from "../lib/engine/layout";
import { semanticSimilarity, selectDriftItem } from "../lib/engine/ranking";
import { stableId } from "../lib/engine/id";
import { tokens } from "../lib/engine/text";
import { addHistory, clearLearnedProfile, DEFAULT_PREFERENCES, exportArchive, getPreferences, importArchive, listSaved, removeItem, saveItem, setPreferences, updateSaved } from "../lib/client/db";

type View = "ahora" | "deriva" | "cruces" | "archivo" | "ediciones";
type Modal = "install" | "sources" | "settings" | "import" | "privacy" | null;

const DRIFT_QUERIES = ["deployable structure", "acoustic apparatus", "scientific diagram", "urban infrastructure", "botanical system", "obsolete machine", "geological map", "experimental film"];

export default function DerivaApp({ initialEditions, initialArchive, initialView = "ahora", initialArchiveScope = "guardados" }: { initialEditions: Edition[]; initialArchive: ContentItem[]; initialView?: View; initialArchiveScope?: "guardados" | "fuentes" }) {
  const [view, setView] = useState<View>(initialView);
  const [editions, setEditions] = useState(initialEditions);
  const [currentEdition, setCurrentEdition] = useState(initialEditions.at(-1)!);
  const [eventIndex, setEventIndex] = useState(0);
  const [archivePool, setArchivePool] = useState(initialArchive);
  const [saved, setSaved] = useState<LocalArchiveRecord[]>([]);
  const [preferences, setPreferencesState] = useState<LocalPreferences>(DEFAULT_PREFERENCES);
  const [driftCurrent, setDriftCurrent] = useState<ContentItem>(initialArchive[0]);
  const [driftSeen, setDriftSeen] = useState(() => new Set<string>([initialArchive[0].id]));
  const [driftCount, setDriftCount] = useState(1);
  const [lastOperation, setLastOperation] = useState<DriftOperation>("otra-cosa");
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState("");
  const [sourceHealth, setSourceHealth] = useState<SourceHealth[]>(currentEdition.sourceHealth);
  const [swUpdate, setSwUpdate] = useState<ServiceWorkerRegistration | null>(null);
  const [selectedEdition, setSelectedEdition] = useState<Edition | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2400);
  }, []);

  useEffect(() => {
    void Promise.all([listSaved(), getPreferences()]).then(([records, prefs]) => {
      setSaved(records);
      setPreferencesState(prefs);
    }).catch(() => notify("el archivo local no pudo abrirse"));

    const online = () => setOffline(false);
    const offlineHandler = () => setOffline(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", offlineHandler);

    if ("serviceWorker" in navigator && location.hostname !== "terminal.local") {
      navigator.serviceWorker.register("/sw.js").then((registration) => {
        if (registration.waiting) setSwUpdate(registration);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) setSwUpdate(registration);
          });
        });
      }).catch(() => undefined);
    }
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offlineHandler);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [notify]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/editions?all=1").then((response) => response.ok ? response.json() : Promise.reject()).then((data) => {
      if (!cancelled && data.editions?.length) setEditions(data.editions);
    }).catch(() => undefined);
    void fetch("/api/editions").then((response) => response.ok ? response.json() : Promise.reject()).then((data) => {
      if (!cancelled && data.edition) {
        setCurrentEdition(data.edition);
        setSourceHealth(data.edition.sourceHealth ?? []);
      }
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const currentEvent = currentEdition.events[eventIndex] ?? currentEdition.events[0];
  const showView = useCallback((next: View) => {
    setView(next);
    window.history.replaceState(null, "", `${location.pathname}?view=${next}`);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const recordItem = useCallback(async (item: ContentItem, operation: string) => {
    try { await addHistory(item, operation); } catch { /* History is useful, never a navigation blocker. */ }
  }, []);

  const save = useCallback(async (item: ContentItem) => {
    await saveItem(item);
    setSaved(await listSaved());
    setPreferencesState((previous) => {
      const learned = { ...previous.learnedTopics };
      item.topics.forEach((topic) => { learned[topic] = Math.min(1, (learned[topic] ?? 0) + 0.12); });
      const next = { ...previous, learnedTopics: learned };
      void setPreferences(next);
      return next;
    });
    navigator.serviceWorker?.controller?.postMessage({ type: "CACHE_ITEM", urls: item.media.map((media) => media.thumbnail ?? media.url).slice(0, 2) });
    notify("guardado en el archivo local");
  }, [notify]);

  const share = useCallback(async (item: ContentItem) => {
    const payload = { title: item.presentedTitle, text: item.summary, url: item.canonicalUrl };
    try {
      if (navigator.share) await navigator.share(payload);
      else { await navigator.clipboard.writeText(`${payload.title}\n${payload.url}`); notify("enlace copiado"); }
    } catch { /* A cancelled native share is not an error. */ }
  }, [notify]);

  const advanceEvent = useCallback((direction: 1 | -1) => {
    setEventIndex((index) => (index + direction + currentEdition.events.length) % currentEdition.events.length);
    void recordItem(currentEvent, direction > 0 ? "siguiente-noticia" : "noticia-anterior");
  }, [currentEdition.events.length, currentEvent, recordItem]);

  const deriveQuery = useCallback((operation: DriftOperation) => {
    const topic = driftCurrent.topics[0] || driftCurrent.entities[0];
    if (operation === "seguir-hilo" || operation === "profundizar" || operation === "cruzar-ahora") return [topic, ...driftCurrent.materials, ...driftCurrent.operations].filter(Boolean).slice(0, 3).join(" ") || "technical system";
    if (operation === "acercar") return Object.entries(preferences.learnedTopics).sort((a, b) => b[1] - a[1]).map(([key]) => key).slice(0, 3).join(" ") || "architecture sound system";
    if (operation === "alejar") return DRIFT_QUERIES[Math.min(DRIFT_QUERIES.length - 1, Math.floor(preferences.distance / 100 * DRIFT_QUERIES.length))];
    return DRIFT_QUERIES[(driftCount * 5 + preferences.distance) % DRIFT_QUERIES.length];
  }, [driftCurrent, preferences, driftCount]);

  const drift = useCallback(async (operation: DriftOperation) => {
    if (driftCount >= preferences.sessionLength) {
      notify(`sesión terminada: ${driftCount} hallazgos`);
      return;
    }
    if (operation === "cruzar-ahora") {
      const best = [...currentEdition.events].sort((a, b) => semanticSimilarity(driftCurrent, b) - semanticSimilarity(driftCurrent, a))[0];
      if (best) { setEventIndex(currentEdition.events.findIndex((event) => event.id === best.id)); showView("cruces"); setLastOperation(operation); }
      return;
    }
    setLoading(true);
    const query = deriveQuery(operation);
    let candidatePool = archivePool;
    try {
      const response = await fetch(`/api/archive?q=${encodeURIComponent(query)}&seed=${encodeURIComponent(`${operation}-${driftCurrent.id}-${driftCount}`)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.items?.length) {
          candidatePool = [...data.items, ...archivePool].filter((item, index, array) => array.findIndex((other) => other.id === item.id) === index);
          setArchivePool(candidatePool);
        }
        if (data.health) setSourceHealth(data.health);
      }
    } catch { notify("usando la reserva documental offline"); }
    const next = selectDriftItem(candidatePool, driftCurrent, driftSeen, operation, preferences.learnedTopics, `${operation}-${driftCurrent.id}-${driftCount}`)
      ?? selectDriftItem(initialArchive, driftCurrent, new Set(), operation, preferences.learnedTopics, `${Date.now()}`);
    if (next) {
      setDriftCurrent(next);
      setDriftSeen((seen) => new Set([...seen, next.id]));
      setDriftCount((count) => count + 1);
      setLastOperation(operation);
      await recordItem(next, operation);
      if (navigator.vibrate) navigator.vibrate(10);
    }
    setLoading(false);
  }, [archivePool, currentEdition.events, deriveQuery, driftCount, driftCurrent, driftSeen, initialArchive, notify, preferences, recordItem, showView]);

  const restartDrift = () => {
    const start = archivePool[(Date.now() >>> 4) % archivePool.length] ?? initialArchive[0];
    setDriftCurrent(start); setDriftSeen(new Set([start.id])); setDriftCount(1); setLastOperation("otra-cosa");
  };

  const onTouchStart = (event: React.TouchEvent) => { touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; };
  const onTouchEnd = (event: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = event.changedTouches[0].clientX - touchStart.current.x;
    const dy = event.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (view === "ahora") advanceEvent(dx < 0 ? 1 : -1);
      if (view === "deriva" && dx < 0) void drift("otra-cosa");
    }
  };

  return (
    <div className="app-shell" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <a className="skip-link" href="#main">saltar al contenido</a>
      <Header edition={currentEdition} offline={offline} onSources={() => setModal("sources")} onInstall={() => setModal("install")} />
      <main id="main" tabIndex={-1}>
        {view === "ahora" && <NowView event={currentEvent} index={eventIndex} total={currentEdition.events.length} onNext={() => advanceEvent(1)} onPrevious={() => advanceEvent(-1)} onSave={() => void save(currentEvent)} onShare={() => void share(currentEvent)} onAntecedent={() => { setDriftCurrent(bestArchiveFor(currentEvent, archivePool)); showView("deriva"); }} onCross={() => showView("cruces")} />}
        {view === "deriva" && <DriftView item={driftCurrent} count={driftCount} limit={preferences.sessionLength} operation={lastOperation} loading={loading} explanationVisible={preferences.explanationVisible} onOperation={(operation) => void drift(operation)} onSave={() => void save(driftCurrent)} onShare={() => void share(driftCurrent)} onRestart={restartDrift} />}
        {view === "cruces" && <CrossView news={currentEvent} archive={bestArchiveFor(currentEvent, archivePool)} onOpenNews={() => showView("ahora")} onOpenArchive={(item) => { setDriftCurrent(item); showView("deriva"); }} />}
        {view === "archivo" && <ArchiveView saved={saved} sourcePool={archivePool} initialScope={initialArchiveScope} onRemove={async (id) => { await removeItem(id); setSaved(await listSaved()); }} onUpdate={async (record) => { await updateSaved(record); setSaved(await listSaved()); }} onOpen={(item) => { setDriftCurrent(item); void recordItem(item, "reabrir-archivo"); showView("deriva"); }} onImport={() => setModal("import")} onExport={async () => downloadText("deriva-archivo.json", await exportArchive())} />}
        {view === "ediciones" && <EditionsView editions={editions} selected={selectedEdition} onSelect={setSelectedEdition} onOpen={(edition) => { setCurrentEdition(edition); setEventIndex(0); showView("ahora"); }} />}
      </main>
      <PrimaryNav active={view} onSelect={showView} />
      <button className="settings-trigger" aria-label="ajustes" onClick={() => setModal("settings")}>•••</button>
      {offline && <div className="offline-strip" role="status">sin red · edición y guardados disponibles</div>}
      {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
      {loading && <div className="loading-state" role="status"><span>abriendo otro campo</span></div>}
      {swUpdate && <div className="update-banner" role="status">hay una versión nueva <button onClick={() => { swUpdate.waiting?.postMessage({ type: "SKIP_WAITING" }); location.reload(); }}>actualizar</button></div>}
      {modal && <ModalLayer type={modal} onClose={() => setModal(null)} sourceHealth={sourceHealth} preferences={preferences} onPreferences={async (next) => { setPreferencesState(next); await setPreferences(next); }} onClearProfile={async () => { const next = await clearLearnedProfile(); setPreferencesState(next); notify("perfil local borrado"); }} onImportDone={async (count) => { setSaved(await listSaved()); notify(`${count} elementos importados`); setModal(null); }} />}
    </div>
  );
}

function Header({ edition, offline, onSources, onInstall }: { edition: Edition; offline: boolean; onSources(): void; onInstall(): void }) {
  return <header className="topbar"><div className="wordmark">deriva</div><div className="edition-stamp"><span>{edition.date}</span><strong>{edition.slot}</strong>{offline && <i>offline</i>}</div><div className="top-actions"><button onClick={onSources}>fuentes</button><button onClick={onInstall}>instalar</button></div></header>;
}

function NowView({ event, index, total, onNext, onPrevious, onSave, onShare, onAntecedent, onCross }: { event: NewsEvent; index: number; total: number; onNext(): void; onPrevious(): void; onSave(): void; onShare(): void; onAntecedent(): void; onCross(): void }) {
  return <section className="now-view" aria-label="edición actual">
    <EditorialPiece item={event} index={index} context="news" />
    <div className="story-progress" aria-label={`acontecimiento ${index + 1} de ${total}`}>{Array.from({ length: total }, (_, i) => <span key={i} className={i === index ? "active" : ""} />)}</div>
    <div className="story-actions"><button onClick={onPrevious}>anterior</button><button onClick={onAntecedent}>antecedente</button><button onClick={onCross}>cruzar</button><button onClick={onSave}>guardar</button><button onClick={onShare}>compartir</button><button className="primary" onClick={onNext}>siguiente →</button></div>
  </section>;
}

function DriftView({ item, count, limit, operation, loading, explanationVisible, onOperation, onSave, onShare, onRestart }: { item: ContentItem; count: number; limit: number; operation: DriftOperation; loading: boolean; explanationVisible: boolean; onOperation(operation: DriftOperation): void; onSave(): void; onShare(): void; onRestart(): void }) {
  const explanation = relationExplanation(item, operation);
  return <section className="drift-view" aria-label="sesión de deriva">
    <div className="session-counter">sesión <strong>{String(count).padStart(2, "0")}</strong> / {String(limit).padStart(2, "0")}</div>
    <EditorialPiece item={item} index={count} context="archive" />
    {explanationVisible && <p className="arrival-line">llegaste aquí por: {explanation}</p>}
    <div className="operator-bank" aria-label="operadores de deriva">
      <button disabled={loading} onClick={() => onOperation("seguir-hilo")}>seguir el hilo</button><button disabled={loading} onClick={() => onOperation("acercar")}>acercar</button><button disabled={loading} onClick={() => onOperation("alejar")}>alejar</button><button disabled={loading} onClick={() => onOperation("profundizar")}>profundizar</button><button disabled={loading} onClick={() => onOperation("cruzar-ahora")}>cruzar con ahora</button><button className="primary" disabled={loading} onClick={() => onOperation("otra-cosa")}>otra cosa →</button>
    </div>
    <div className="secondary-actions"><a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">abrir fuente ↗</a><button onClick={onSave}>guardar</button><button onClick={onShare}>compartir</button>{count >= limit && <button onClick={onRestart}>nueva sesión</button>}</div>
  </section>;
}

function EditorialPiece({ item, index, context }: { item: ContentItem; index: number; context: "news" | "archive" }) {
  const layout = selectLayout(item, index);
  const sourceCount = item.sources.length;
  return <article className={`editorial-piece layout-${layout}`} data-layout={layout}>
    <Media key={item.id} item={item} />
    <div className="piece-copy">
      <div className="kicker"><span>{context === "news" && "category" in item ? item.category : item.kind}</span><span>{item.institution}</span><span>{formatTime(item.updatedAt ?? item.publishedAt ?? item.objectDate)}</span></div>
      <h1>{item.presentedTitle}</h1>
      <p className="summary">{item.summary}</p>
      {"whyItMatters" in item && item.whyItMatters && <p className="why"><b>por qué importa</b>{item.whyItMatters}</p>}
      <div className="provenance"><span>{sourceCount > 1 ? `${sourceCount} fuentes` : "1 fuente · visible"}</span><span>{item.verification.replaceAll("-", " ")}</span></div>
      <div className="source-links">{item.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.name} ↗</a>)}</div>
      {(item.attribution || item.license) && <small className="attribution">{item.attribution}{item.license ? ` · ${item.license}` : ""}</small>}
    </div>
  </article>;
}

function Media({ item }: { item: ContentItem }) {
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const media = item.media[active];
  if (!media || failed) return <div className="media-fallback" aria-label="sin previsualización"><span>{item.kind}</span><b>{item.presentedTitle.slice(0, 1)}</b><i>{item.institution}</i></div>;
  if (media.type === "audio") return <div className="media-shell audio-shell"><div className="audio-glyph">∿</div><audio controls preload="metadata" src={media.url}>Tu navegador no puede reproducir audio.</audio></div>;
  if (media.type === "video") return <div className="media-shell"><video controls playsInline preload="metadata" poster={media.thumbnail}><source src={media.url} /></video></div>;
  if (media.type === "pdf") return <div className="document-shell"><div className="document-page"><span>documento</span><strong>{item.presentedTitle}</strong><a href={media.url} target="_blank" rel="noopener noreferrer">abrir visor ↗</a></div></div>;
  // eslint-disable-next-line @next/next/no-img-element -- sources are dynamic, rights-filtered archive URLs.
  return <div className="media-shell">{/* Heterogeneous archive media is already rights-filtered and cannot use a fixed Next image allowlist. */}<img src={media.url} alt={media.alt} loading="eager" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />{item.media.length > 1 && <div className="media-sequence">{item.media.map((_, index) => <button key={index} aria-label={`imagen ${index + 1}`} className={index === active ? "active" : ""} onClick={() => setActive(index)} />)}</div>}<button className="zoom-link" onClick={(event) => event.currentTarget.parentElement?.classList.toggle("zoomed")}>zoom</button></div>;
}

function CrossView({ news, archive, onOpenNews, onOpenArchive }: { news: NewsEvent; archive: ContentItem; onOpenNews(): void; onOpenArchive(item: ContentItem): void }) {
  const bridge = explainBridge(news, archive);
  const steps = [
    { label: "acontecimiento actual", value: news.presentedTitle },
    { label: "entidad", value: sharedValue(news.entities, archive.entities) || news.entities[0] || news.topics[0] },
    { label: "operación", value: sharedValue(news.operations, archive.operations) || archive.operations[0] || "transformación" },
    { label: archive.kind, value: archive.presentedTitle },
  ];
  return <section className="cross-view"><header><p>cruce verificable</p><h1>presente ↔ archivo</h1><p>{bridge}</p></header><ol className="cross-sequence">{steps.map((step, index) => <li key={`${step.label}-${index}`}><span>0{index + 1}</span><small>{step.label}</small><strong>{step.value}</strong>{index < steps.length - 1 && <i>↓</i>}</li>)}</ol><div className="cross-actions"><button onClick={onOpenNews}>abrir acontecimiento</button><button className="primary" onClick={() => onOpenArchive(archive)}>abrir documento →</button></div></section>;
}

function ArchiveView({ saved, sourcePool, initialScope, onRemove, onUpdate, onOpen, onImport, onExport }: { saved: LocalArchiveRecord[]; sourcePool: ContentItem[]; initialScope: "guardados" | "fuentes"; onRemove(id: string): void; onUpdate(record: LocalArchiveRecord): void; onOpen(item: ContentItem): void; onImport(): void; onExport(): void }) {
  const [query, setQuery] = useState(""); const [kind, setKind] = useState("todos"); const [scope, setScope] = useState<"guardados" | "fuentes">(initialScope);
  const rows = scope === "guardados" ? saved : sourcePool.map((item) => ({ item, savedAt: "", lastOpenedAt: "", note: "", collection: "fuentes", origin: "saved" as const }));
  const filtered = rows.filter((record) => (kind === "todos" || record.item.kind === kind) && tokens(`${record.item.presentedTitle} ${record.item.summary} ${record.item.institution} ${record.note} ${record.collection}`).some((token) => !query || tokens(query).includes(token)));
  return <section className="archive-view"><header><p>archivo local-first</p><h1>{scope === "guardados" ? `${saved.length} piezas guardadas` : `${sourcePool.length} piezas disponibles`}</h1><div className="archive-tabs"><button className={scope === "guardados" ? "active" : ""} onClick={() => setScope("guardados")}>guardados</button><button className={scope === "fuentes" ? "active" : ""} onClick={() => setScope("fuentes")}>explorar fuentes</button></div></header><div className="archive-tools"><label><span>buscar</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="título, tema, fuente, nota" /></label><label><span>tipo</span><select value={kind} onChange={(event) => setKind(event.target.value)}><option>todos</option>{[...new Set(rows.map((record) => record.item.kind))].map((value) => <option key={value}>{value}</option>)}</select></label><button onClick={onImport}>importar</button><button onClick={onExport}>exportar JSON</button></div>{filtered.length ? <div className="archive-list">{filtered.map((record) => <ArchiveRow key={record.item.id} record={record} editable={scope === "guardados"} onOpen={onOpen} onRemove={onRemove} onUpdate={onUpdate} />)}</div> : <div className="empty-state"><strong>nada aquí todavía</strong><span>guarda una pieza o cambia los filtros.</span></div>}</section>;
}

function ArchiveRow({ record, editable, onOpen, onRemove, onUpdate }: { record: LocalArchiveRecord; editable: boolean; onOpen(item: ContentItem): void; onRemove(id: string): void; onUpdate(record: LocalArchiveRecord): void }) {
  const [editing, setEditing] = useState(false); const [note, setNote] = useState(record.note); const [collection, setCollection] = useState(record.collection);
  return <article className="archive-row"><button className="archive-open" onClick={() => onOpen(record.item)}><span>{record.item.kind}</span><strong>{record.item.presentedTitle}</strong><small>{record.item.institution} · {record.item.objectDate ?? formatTime(record.item.publishedAt)}</small></button>{editing ? <div className="archive-edit"><input value={collection} onChange={(event) => setCollection(event.target.value)} aria-label="colección" /><textarea value={note} onChange={(event) => setNote(event.target.value)} aria-label="nota" placeholder="nota personal" /><button onClick={() => { onUpdate({ ...record, note, collection }); setEditing(false); }}>guardar cambios</button></div> : editable && <div className="row-actions"><button onClick={() => setEditing(true)}>nota</button><button onClick={() => onRemove(record.item.id)}>eliminar</button></div>}</article>;
}

function EditionsView({ editions, selected, onSelect, onOpen }: { editions: Edition[]; selected: Edition | null; onSelect(edition: Edition | null): void; onOpen(edition: Edition): void }) {
  if (selected) return <section className="editions-view"><button className="back" onClick={() => onSelect(null)}>← ediciones</button><header><p>{selected.date} · {selected.slot}</p><h1>{selected.title}</h1><p>{selected.dek}</p></header><ol className="edition-contents">{selected.events.map((event, index) => <li key={event.id}><span>{String(index + 1).padStart(2, "0")}</span><strong>{event.presentedTitle}</strong><small>{event.institution}</small></li>)}</ol><button className="open-edition" onClick={() => onOpen(selected)}>abrir edición →</button></section>;
  return <section className="editions-view"><header><p>archivo de ediciones</p><h1>10:00 / 15:00 / 20:00</h1><p>cada edición es una unidad cerrada. los asuntos que continúan quedan marcados.</p></header><div className="edition-list">{editions.map((edition) => <button key={edition.id} onClick={() => onSelect(edition)}><span>{edition.date}</span><strong>{edition.slot}</strong><i>{edition.events.length} acontecimientos</i><small>{edition.continuedIds.length ? `${edition.continuedIds.length} continúan` : "edición inicial"}</small></button>)}</div></section>;
}

function PrimaryNav({ active, onSelect }: { active: View; onSelect(view: View): void }) {
  const views: View[] = ["ahora", "deriva", "cruces", "archivo", "ediciones"];
  return <nav className="primary-nav" aria-label="navegación principal">{views.map((view) => <button key={view} aria-current={active === view ? "page" : undefined} onClick={() => onSelect(view)}><span>{view === "cruces" ? "↔" : view === "deriva" ? "∿" : view === "archivo" ? "□" : view === "ediciones" ? "≡" : "●"}</span>{view}</button>)}</nav>;
}

function ModalLayer({ type, onClose, sourceHealth, preferences, onPreferences, onClearProfile, onImportDone }: { type: Exclude<Modal, null>; onClose(): void; sourceHealth: SourceHealth[]; preferences: LocalPreferences; onPreferences(value: LocalPreferences): void; onClearProfile(): void; onImportDone(count: number): void }) {
  const panel = useRef<HTMLDivElement>(null); const opener = useRef<Element | null>(null);
  useEffect(() => { opener.current = document.activeElement; panel.current?.querySelector<HTMLElement>("button, input, select")?.focus(); const key = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; document.addEventListener("keydown", key); return () => { document.removeEventListener("keydown", key); (opener.current as HTMLElement | null)?.focus?.(); }; }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div ref={panel} className="modal-panel" role="dialog" aria-modal="true" aria-label={type}><div className="modal-head"><strong>{modalTitle(type)}</strong><button onClick={onClose} aria-label="cerrar">cerrar</button></div>{type === "install" && <InstallPanel />}{type === "sources" && <SourcesPanel sources={sourceHealth} />}{type === "settings" && <SettingsPanel value={preferences} onChange={onPreferences} onClear={onClearProfile} />}{type === "import" && <ImportPanel onDone={onImportDone} />}{type === "privacy" && <PrivacyPanel />}</div></div>;
}

function InstallPanel() {
  const standalone = typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone);
  if (standalone) return <div className="install-panel"><span className="step-number">✓</span><h2>deriva ya está instalada.</h2><p>abre la aplicación desde la pantalla de inicio.</p></div>;
  return <div className="install-panel"><p>en iPhone o iPad:</p><ol><li><span>01</span><strong>abre esta URL en Safari</strong></li><li><span>02</span><strong>toca compartir</strong></li><li><span>03</span><strong>añadir a pantalla de inicio</strong></li><li><span>04</span><strong>activa “abrir como app” y toca añadir</strong></li></ol><p className="fine-print">Safari no usa el mismo aviso automático de instalación que Chromium.</p></div>;
}

function SourcesPanel({ sources }: { sources: SourceHealth[] }) {
  const unique = sources.filter((source, index, array) => array.findIndex((other) => other.id === source.id) === index);
  return <div className="sources-panel"><p>las fuentes se consultan en el servidor. una caída nunca se oculta detrás de contenido falso.</p>{unique.map((source) => <div className="source-health" key={source.id}><span className={`status status-${source.status}`} /> <strong>{source.name}</strong><i>{source.status}</i><small>{source.message}{source.itemCount != null ? ` · ${source.itemCount} resultados` : ""}</small>{source.officialDocs && <a href={source.officialDocs} target="_blank" rel="noopener noreferrer">documentación ↗</a>}</div>)}</div>;
}

function SettingsPanel({ value, onChange, onClear }: { value: LocalPreferences; onChange(value: LocalPreferences): void; onClear(): void }) {
  return <div className="settings-panel"><label><span>hallazgos por sesión</span><select value={value.sessionLength} onChange={(event) => onChange({ ...value, sessionLength: Number(event.target.value) })}><option value="6">6</option><option value="12">12</option><option value="18">18</option></select></label><label><span>distancia · {value.distance}</span><input type="range" min="0" max="100" value={value.distance} onChange={(event) => onChange({ ...value, distance: Number(event.target.value) })} /></label><label className="check"><span>mostrar por qué llegaste</span><input type="checkbox" checked={value.explanationVisible} onChange={(event) => onChange({ ...value, explanationVisible: event.target.checked })} /></label><label className="check"><span>reducir datos</span><input type="checkbox" checked={value.reducedData} onChange={(event) => onChange({ ...value, reducedData: event.target.checked })} /></label><button className="destructive" onClick={onClear}>borrar perfil aprendido</button><p>las preferencias permanecen únicamente en este dispositivo. telemetría desactivada.</p></div>;
}

function ImportPanel({ onDone }: { onDone(count: number): void }) {
  const [url, setUrl] = useState("");
  const importUrl = async () => {
    try {
      const parsed = new URL(url); if (!/^https?:$/.test(parsed.protocol)) throw new Error();
      const id = stableId("personal-link", parsed.href, parsed.href); const now = new Date().toISOString();
      const personal: ContentItem = { schemaVersion: 2, id, kind: "archivo-personal", originalTitle: parsed.hostname, presentedTitle: parsed.hostname, summary: `Enlace incorporado manualmente al archivo personal: ${parsed.pathname}.`, institution: "archivo personal", canonicalUrl: parsed.href, sourceUrl: parsed.href, sources: [{ name: parsed.hostname, url: parsed.href }], media: [], rights: "enlace del usuario", license: "sin determinar", attribution: "importación personal", language: "und", place: [], topics: tokens(parsed.pathname), entities: [], materials: [], operations: ["importar"], scores: { visualQuality: 0.2, relevance: 0.7, novelty: 0.6, distance: 0.5, reliability: 0.5 }, relations: [], verification: "sin-verificar", provenance: { adapter: "personal", rawId: parsed.href, fetchedAt: now, cacheKey: id }, selectionReasons: ["incorporado por el usuario"], firstIngestedAt: now, lastIngestedAt: now };
      await saveItem(personal, "", "importados", "imported"); onDone(1);
    } catch { /* Invalid URLs remain in the input for correction. */ }
  };
  return <div className="import-panel"><label><span>importar enlace</span><div><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" /><button onClick={() => void importUrl()}>incorporar</button></div></label><label className="file-control"><span>importar archivo JSON o archivo propio</span><input type="file" accept="application/json,image/*,audio/*,video/*,.pdf" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; if (file.type === "application/json" || file.name.endsWith(".json")) { onDone(await importArchive(await file.text())); return; } const dataUrl = await readDataUrl(file); const now = new Date().toISOString(); const id = stableId("personal-file", `${file.name}-${file.size}-${file.lastModified}`); const mediaType = file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : file.type.startsWith("video/") ? "video" : "pdf"; const personal: ContentItem = { schemaVersion: 2, id, kind: mediaType === "image" ? "imagen" : mediaType === "audio" ? "audio" : mediaType === "video" ? "video" : "pdf", originalTitle: file.name, presentedTitle: file.name, summary: `Archivo personal incorporado localmente (${Math.round(file.size / 1024)} KB).`, institution: "archivo personal", canonicalUrl: `https://local.deriva/${id}`, sourceUrl: `https://local.deriva/${id}`, sources: [], media: [{ url: dataUrl, type: mediaType, alt: file.name, attribution: "archivo personal" }], rights: "archivo del usuario", license: "privado", attribution: "archivo personal", language: "und", place: [], topics: tokens(file.name), entities: [], materials: [], operations: ["importar"], scores: { visualQuality: 0.7, relevance: 0.8, novelty: 0.8, distance: 0.3, reliability: 1 }, relations: [], verification: "verificado", provenance: { adapter: "personal", rawId: file.name, fetchedAt: now, cacheKey: id }, selectionReasons: ["incorporado por el usuario"], firstIngestedAt: now, lastIngestedAt: now }; await saveItem(personal, "", "archivos propios", "imported"); onDone(1); }} /></label></div>;
}

function PrivacyPanel() { return <div className="privacy-panel"><h2>privacidad</h2><p>deriva no requiere cuenta. guardados, notas, historial y preferencias permanecen en IndexedDB dentro de este dispositivo.</p><p>no hay telemetría, anuncios, perfiles sociales ni métricas de atención. al abrir una fuente externa aplican las políticas de ese sitio.</p></div>; }

function bestArchiveFor(news: NewsEvent, pool: ContentItem[]): ContentItem { return [...pool].sort((a, b) => semanticSimilarity(news, b) - semanticSimilarity(news, a))[0] ?? pool[0]; }
function sharedValue(a: string[], b: string[]) { return a.find((value) => b.some((other) => other.toLowerCase() === value.toLowerCase())); }
function explainBridge(news: ContentItem, archive: ContentItem) { const shared = sharedValue(news.topics, archive.topics) || sharedValue(news.operations, archive.operations) || sharedValue(news.materials, archive.materials); return shared ? `la relación se sostiene en “${shared}”, presente en los metadatos de ambas piezas.` : `el puente compara operaciones y entidades con una similitud calculada de ${Math.round(semanticSimilarity(news, archive) * 100)}%.`; }
function relationExplanation(item: ContentItem, operation: DriftOperation) { const parts = [item.operations[0], item.materials[0], item.topics[0]].filter(Boolean); return `${operation.replaceAll("-", " ")} → ${parts.join(" → ") || item.institution}`; }
function formatTime(value?: string) { if (!value) return ""; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es-MX", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" }).format(date); }
function modalTitle(type: Exclude<Modal, null>) { return ({ install: "instalar deriva", sources: "salud de fuentes", settings: "ajustes locales", import: "incorporar al archivo", privacy: "privacidad" } as const)[type]; }
function downloadText(name: string, text: string) { const url = URL.createObjectURL(new Blob([text], { type: "application/json" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url); }
function readDataUrl(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); }); }
