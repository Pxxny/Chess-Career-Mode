import { useContext, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Drawer } from "vaul";
import { motion, useReducedMotion } from "motion/react";
import { TableVirtuoso } from "react-virtuoso";
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { Button, Card, CardTitle } from "@/components/ui";
import { useGameStore } from "@/store/gameStore";
import { highlightsOf, type CareerArticle } from "@/game/career/highlights";
import { translateUI as t } from "@/i18n/translate";
import { LanguageContext } from "@/i18n/context";
import { useNavigate } from "react-router-dom";

const LABELS = { trophy: "Tournament victory", national: "National team", title: "New title", qualification: "Championship qualification" };
function Reader({ article, close, resume, remaining = 0 }: { article: CareerArticle; close: () => void; resume?: () => void; remaining?: number }) {
  const reduced = useReducedMotion();
  const navigate = useNavigate();
  const registrations = () => {
    close();
    const params = new URLSearchParams({ section: "registrations" });
    // Old articles have no metadata; their qualifications are still recovered from the save.
    const eventId = article.eventId ?? (article.id.startsWith("national-selected:") ? article.id.slice("national-selected:".length) : undefined);
    const qualification = article.qualification ?? (article.kind === "qualification" ? article.id.split(":")[2] : undefined);
    if (eventId) params.set("focusRegistration", eventId);
    if (qualification) params.set("qualification", qualification);
    navigate(`/complete?${params}`);
  };
  return <div data-testid="career-news-article" className="min-w-0 break-words [overflow-wrap:anywhere]">
    <motion.img initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} src={`/news/${article.kind}.svg`} alt={t(LABELS[article.kind])} className="aspect-[2/1] w-full rounded-xl object-cover" />
    <div className="py-5"><p className="text-xs font-semibold uppercase tracking-wider text-gold-400">{LABELS[article.kind]} · {article.year} / W{article.week}</p>
      <h2 className="mt-3 font-display text-2xl font-bold" translate="no">{t(article.headline)}</h2>
      <p className="mt-4 whitespace-pre-line text-sm leading-7 text-ink-muted" translate="no">{t(article.body)}</p>
      {resume && <p className="mt-4 rounded-xl bg-gold-500/10 p-3 text-xs text-gold-300">Season simulation is paused. Your completed progress is saved.</p>}
    </div>
    <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
      {(article.kind === "national" || article.kind === "qualification") && <Button onClick={registrations}>Your registrations</Button>}
      {resume && <Button onClick={resume}>{remaining > 1 ? "Next story" : "Continue season"}</Button>}
      <Button variant="secondary" onClick={close}>{resume ? "Read and stay paused" : "Close news"}</Button>
    </div>
  </div>;
}
function NewsOverlay({ article, close, resume, remaining }: { article: CareerArticle; close: () => void; resume?: () => void; remaining?: number }) {
  useContext(LanguageContext);
  // Phone-sized screens use a drawer; larger screens use a dialog.
  const mobile = typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;
  if (mobile) return <Drawer.Root open onOpenChange={(open) => { if (!open) close(); }}>
    <Drawer.Portal><Drawer.Overlay className="fixed inset-0 z-[65] bg-black/70" />
      <Drawer.Content className="fixed inset-x-0 bottom-0 z-[66] max-h-[94dvh] overflow-y-auto rounded-t-3xl border border-white/10 bg-navy-800 px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-3 outline-none">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/25" />
        <Drawer.Title className="mb-3 text-sm font-semibold text-gold-300">{t("Career news")}</Drawer.Title>
        <Drawer.Description className="sr-only">{t("An important moment in your chess career.")}</Drawer.Description>
        <Reader article={article} close={close} resume={resume} remaining={remaining} />
      </Drawer.Content></Drawer.Portal>
  </Drawer.Root>;
  return <Dialog.Root open onOpenChange={(open) => { if (!open) close(); }}><Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-[65] bg-black/70 backdrop-blur-sm" />
    <Dialog.Content className="fixed left-1/2 top-1/2 z-[66] max-h-[90dvh] w-[92vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-white/10 bg-navy-800 p-6 shadow-2xl outline-none">
      <Dialog.Title className="mb-4 text-sm font-semibold text-gold-300">{t("Career news")}</Dialog.Title>
      <Dialog.Description className="sr-only">{t("An important moment in your chess career.")}</Dialog.Description>
      <Reader article={article} close={close} resume={resume} remaining={remaining} />
    </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
export function CareerNewsDialog() {
  const save = useGameStore((s) => s.save), running = useGameStore((s) => s.seasonRunning);
  if (!save || running) return null;
  const state = highlightsOf(save), article = state.items.find((a) => state.unread.includes(a.id));
  if (!article) return null;
  const close = () => useGameStore.getState().readArticle(article.id);
  return <NewsOverlay article={article} close={close} remaining={state.unread.length} resume={save.seasonSimulation?.status === "paused" ? () => {
    close();
    if (state.unread.length === 1 && save.seasonSimulation?.status === "paused") void useGameStore.getState().simulateSeason();
  } : undefined} />;
}
export function CareerNewsroom() {
  const language = useContext(LanguageContext);
  const save = useGameStore((s) => s.save)!;
  const articles = useMemo(() => highlightsOf(save).items, [save]);
  const [selected, setSelected] = useState<CareerArticle | null>(null), [query, setQuery] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);
  const columns = useMemo<ColumnDef<CareerArticle>[]>(() => [
    { id: "date", accessorFn: (a) => a.year * 364 + (a.week - 1) * 7 + a.day, header: t("Date"), cell: ({ row }) => <span className="text-xs text-ink-faint">{row.original.year} · W{row.original.week}</span> },
    { accessorKey: "headline", header: t("Headline"), cell: ({ row }) => <button type="button" onClick={() => setSelected(row.original)} className="min-h-12 py-2 text-left text-sm font-semibold text-gold-300" translate="no">{t(row.original.headline)}</button> },
  ], [language]);
  const filtered = useMemo(() => articles.filter((a) => t(a.headline).toLocaleLowerCase().includes(query.toLocaleLowerCase())), [articles, query, language]);
  const table = useReactTable({ data: filtered, columns, autoResetPageIndex: false, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });
  return <Card className="mb-4" data-testid="career-newsroom">
    <CardTitle>Career newsroom</CardTitle>
    <p className="mb-4 text-sm text-ink-muted">Only major career moments interrupt simulation. Read your saved stories here.</p>
    {!articles.length ? <p className="text-sm text-ink-faint">Your first major career story will appear here.</p> : <>
      <input aria-label="Search career news" value={query} onChange={(e) => setQuery(e.target.value)} className="mb-3 w-full rounded-xl bg-navy-900 p-3 text-sm" placeholder={t("Search career news")} />
      <TableVirtuoso style={{ height: Math.min(360, Math.max(120, table.getRowModel().rows.length * 64 + 48)) }} data={table.getRowModel().rows} components={{ Table: (props) => <table {...props} aria-label={t("Career news archive")} className="w-full table-fixed text-left" /> }}
        fixedHeaderContent={() => <tr>{table.getHeaderGroups()[0].headers.map((h) => <th key={h.id} className={`bg-navy-800 p-2 text-xs ${h.id === "date" ? "w-24" : ""}`} aria-sort={h.column.getIsSorted() === "asc" ? "ascending" : h.column.getIsSorted() === "desc" ? "descending" : "none"}><button type="button" className="min-h-11" onClick={h.column.getToggleSortingHandler()}>{flexRender(h.column.columnDef.header, h.getContext())} {h.column.getIsSorted() === "asc" ? "↑" : "↓"}</button></th>)}</tr>}
        itemContent={(_, row) => row.getVisibleCells().map((cell) => <td key={cell.id} className="border-t border-white/5 p-2">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)} />
      {!table.getRowModel().rows.length && <p className="text-sm text-ink-faint">No matching news.</p>}
    </>}
    {selected && <NewsOverlay article={selected} close={() => setSelected(null)} />}
  </Card>;
}
