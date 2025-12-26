import React, { useCallback, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  LineChart as RLineChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import Papa from "papaparse";
import JSZip from "jszip";
import { toPng } from "html-to-image";
import {
  Upload,
  FileText,
  BarChart3,
  Table as TableIcon,
  Sparkles,
  Download,
  Layers,
  Activity,
  FileDown,
  Wand2,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Badge,
  Separator,
  Progress,
  Switch,
  Label,
  ScrollArea,
  Alert,
  AlertTitle,
  AlertDescription,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  NativeSelect,
  cn,
} from "./components/ui";

const EP_RE = /ep(\d+)/i;

function safeNumber(x: any, fallback = 0) {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function fmtNum(x: any, digits = 1) {
  const n = safeNumber(x, NaN);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function parseEpisodeFromName(name: string): string | null {
  const m = name.match(EP_RE);
  if (m?.[1]) return m[1];
  // fallback: 以分隔符包围的两到三位集号（避免 BV 号/时间戳误判）
  const m2 = name.match(/(?:^|[-_])(\d{2,3})(?:[-_])/);
  return m2?.[1] ?? null;
}

type TableMap = Record<string, any[]>;

type Store = {
  episodes: string[];
  episodeStats?: any[];
  basicStatsByEp: Record<string, any>;
  tablesByEp: Record<string, TableMap>;
  loadedFiles: { name: string; size: number; type: string }[];
};

type DistKind =
  | "emo_danmaku"
  | "emo_comment_root"
  | "emo_comment_reply"
  | "func_danmaku"
  | "func_comment_all"
  | "func_comment_root"
  | "func_comment_reply";

const TABLE_KEYS = {
  DANMU_EMO: "danmaku_emo_dist",
  COM_ROOT_EMO: "comment_root_emo_dist",
  COM_REPLY_EMO: "comment_reply_emo_dist",
  DANMU_FUNC: "danmaku_func_dist",
  COM_ALL_FUNC: "comment_func_dist",
  COM_ROOT_FUNC: "comment_root_func_dist",
  COM_REPLY_FUNC: "comment_reply_func_dist",
  DANMU_MIN_EMO: "danmaku_minute_emo_curve",
  DANMU_MIN_FUNC: "danmaku_minute_func_curve",
  BURST_2S: "danmaku_burst_2s",
  TOP_TERMS_DANMU: "top_terms_danmaku",
  TOP_TERMS_COMMENT: "top_terms_comment",
  DANMU_MODEL_EMO: "danmaku_model_emo_dist",
  COM_ROOT_MODEL_EMO: "comment_root_model_emo_dist",
  COM_REPLY_MODEL_EMO: "comment_reply_model_emo_dist",
  MODEL_USAGE: "model_usage",
  CLEANING_REPORT: "cleaning_report",
} as const;

function detectTableKey(filename: string): { key: string; ep?: string } | null {
  const lower = filename.toLowerCase();
  const ep = parseEpisodeFromName(lower) ?? undefined;

  if (lower.includes("episode_stats") && lower.endsWith(".csv")) return { key: "episode_stats" };
  if (lower.includes("danmaku_basic_stats") && lower.endsWith(".json")) return { key: "danmaku_basic_stats", ep };

  if (lower.includes("danmaku_emo_dist") && lower.endsWith(".csv")) return { key: TABLE_KEYS.DANMU_EMO, ep };
  if (lower.includes("comment_root_emo_dist") && lower.endsWith(".csv")) return { key: TABLE_KEYS.COM_ROOT_EMO, ep };
  if (lower.includes("comment_reply_emo_dist") && lower.endsWith(".csv")) return { key: TABLE_KEYS.COM_REPLY_EMO, ep };
  if (lower.includes("danmaku_model_emo_dist") && lower.endsWith(".csv")) return { key: TABLE_KEYS.DANMU_MODEL_EMO, ep };
  if (lower.includes("comment_root_model_emo_dist") && lower.endsWith(".csv")) return { key: TABLE_KEYS.COM_ROOT_MODEL_EMO, ep };
  if (lower.includes("comment_reply_model_emo_dist") && lower.endsWith(".csv")) return { key: TABLE_KEYS.COM_REPLY_MODEL_EMO, ep };
  if (lower.includes("model_usage") && lower.endsWith(".csv")) return { key: TABLE_KEYS.MODEL_USAGE, ep };
  if (lower.includes("danmaku_func_dist") && lower.endsWith(".csv")) return { key: TABLE_KEYS.DANMU_FUNC, ep };
  if (lower.includes("comment_func_dist") && lower.endsWith(".csv")) return { key: TABLE_KEYS.COM_ALL_FUNC, ep };
  if (lower.includes("comment_root_func_dist") && lower.endsWith(".csv")) return { key: TABLE_KEYS.COM_ROOT_FUNC, ep };
  if (lower.includes("comment_reply_func_dist") && lower.endsWith(".csv")) return { key: TABLE_KEYS.COM_REPLY_FUNC, ep };
  if (lower.includes("danmaku_minute_emo_curve") && lower.endsWith(".csv")) return { key: TABLE_KEYS.DANMU_MIN_EMO, ep };
  if (lower.includes("danmaku_minute_func_curve") && lower.endsWith(".csv")) return { key: TABLE_KEYS.DANMU_MIN_FUNC, ep };
  if (lower.includes("danmaku_burst_2s") && lower.endsWith(".csv")) return { key: TABLE_KEYS.BURST_2S, ep };
  if (lower.includes("top_terms_danmaku") && lower.endsWith(".csv")) return { key: TABLE_KEYS.TOP_TERMS_DANMU, ep };
  if (lower.includes("top_terms_comment") && lower.endsWith(".csv")) return { key: TABLE_KEYS.TOP_TERMS_COMMENT, ep };
  if (lower.includes("cleaning_report") && lower.endsWith(".csv")) return { key: TABLE_KEYS.CLEANING_REPORT, ep };

  return null;
}

function parseCsv(text: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (res) => resolve((res.data as any[]) ?? []),
      error: (err: unknown) => reject(err),
    });
  });
}

function clampTopN<T>(arr: T[], n: number) {
  return arr.slice(0, Math.max(0, Math.min(arr.length, n)));
}

function toPercent(n: number) {
  if (!Number.isFinite(n)) return "0%";
  return `${(n * 100).toFixed(1)}%`;
}

function niceKey(k: string) {
  return k.replace(/_/g, " ").replace(/\b(emo|func|ep)\b/gi, (m: string) => m.toUpperCase());
}

function downloadText(filename: string, text: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- colors ----------
const EMO_ORDER = ["touching", "laugh", "praise", "neg", "self_mock", "other"] as const;
const EMO_COLOR_MAP: Record<string, string> = {
  touching: "#2563eb",
  laugh: "#16a34a",
  praise: "#ea580c",
  neg: "#dc2626",
  self_mock: "#7c3aed",
  other: "#0891b2",
  pos: "#0ea5e9",
  neu: "#64748b",
};

function hslToHex(h: number, s: number, l: number) {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (0 <= h && h < 60) [r, g, b] = [c, x, 0];
  else if (60 <= h && h < 120) [r, g, b] = [x, c, 0];
  else if (120 <= h && h < 180) [r, g, b] = [0, c, x];
  else if (180 <= h && h < 240) [r, g, b] = [0, x, c];
  else if (240 <= h && h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function fnv1aHash32(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function stableColorFromKey(key: string) {
  const h = fnv1aHash32(key) % 360;
  const l = (fnv1aHash32(key + "_l") % 2) === 0 ? 45 : 58;
  return hslToHex(h, 82, l);
}

function colorForKey(key: string, mode: "emo" | "func") {
  if (mode === "emo" && EMO_COLOR_MAP[key]) return EMO_COLOR_MAP[key];
  if (mode === "func") return stableColorFromKey(key);
  return "#334155";
}

// ---------- export ----------
async function exportNodeAsPng(node: HTMLElement, filename: string) {
  // 导出稳定性：避免外链字体导致 canvas 污染 / 加载失败
  await new Promise((r) => setTimeout(r, 150));
  const fontStack =
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", "Noto Sans CJK SC", Arial, sans-serif';
  const dataUrl = await toPng(node, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    style: { fontFamily: fontStack },
  });
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

async function exportNodeAsPngBlob(node: HTMLElement) {
  await new Promise((r) => setTimeout(r, 150));
  const fontStack =
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", "Noto Sans CJK SC", Arial, sans-serif';
  const dataUrl = await toPng(node, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    style: { fontFamily: fontStack },
  });
  const res = await fetch(dataUrl);
  return await res.blob();
}

// ---------- analytics helpers ----------
function topKIntervals(curveRows: any[], seriesKey: string, windowSize: number, k: number) {
  if (!curveRows.length) return [];
  const rows = curveRows.slice().sort((a, b) => safeNumber(a.minute) - safeNumber(b.minute));
  const minutes = rows.map((r) => safeNumber(r.minute));
  const values = rows.map((r) => safeNumber(r[seriesKey]));
  const n = rows.length;
  const w = Math.max(1, Math.min(20, windowSize));
  const kk = Math.max(1, Math.min(5, k));

  const ps: number[] = [0];
  for (let i = 0; i < n; i++) ps.push(ps[i] + values[i]);

  const candidates: Array<{ i: number; j: number; score: number; start: number; end: number }> = [];
  for (let i = 0; i < n; i++) {
    const endMinute = minutes[i] + (w - 1);
    let j = i;
    while (j + 1 < n && minutes[j + 1] <= endMinute) j++;
    const score = ps[j + 1] - ps[i];
    candidates.push({ i, j, score, start: minutes[i], end: minutes[j] });
  }
  candidates.sort((a, b) => b.score - a.score);

  const picked: Array<{ start: number; end: number; score: number }> = [];
  const used: Array<[number, number]> = [];
  const overlaps = (a: [number, number], b: [number, number]) => Math.max(a[0], b[0]) <= Math.min(a[1], b[1]);

  for (const c of candidates) {
    if (picked.length >= kk) break;
    const range: [number, number] = [c.i, c.j];
    if (used.some((u) => overlaps(u, range))) continue;
    used.push(range);
    picked.push({ start: c.start, end: c.end, score: c.score });
  }
  return picked.sort((a, b) => a.start - b.start);
}

function computePeak(curveRows: any[], seriesKey: string) {
  let bestMinute: number | null = null;
  let bestVal = -Infinity;
  for (const r of curveRows) {
    const m = safeNumber(r.minute);
    const v = safeNumber(r[seriesKey]);
    if (v > bestVal) {
      bestVal = v;
      bestMinute = m;
    }
  }
  if (bestMinute == null || !Number.isFinite(bestVal) || bestVal < 0) return null;
  return { minute: bestMinute, value: bestVal };
}

function pickTopDist(rows: any[], keyField: string, valueField: string, topN: number) {
  const items = rows
    .map((r) => ({ k: String((r as any)[keyField] ?? (r as any).label ?? "other"), v: safeNumber((r as any)[valueField]) }))
    .sort((a, b) => b.v - a.v);
  return items.slice(0, Math.max(1, Math.min(10, topN)));
}

function fmtTopList(items: Array<{ k: string; v: number }>, kind: "ratio" | "cnt" = "ratio") {
  if (!items.length) return "—";
  return items.map((x) => (kind === "ratio" ? `${x.k}(${toPercent(x.v)})` : `${x.k}(${x.v})`)).join("、");
}

// ---------- UI helpers ----------
function StatCard({ title, value, hint }: { title: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      {hint ? <CardContent className="pt-0 text-sm text-slate-500">{hint}</CardContent> : null}
    </Card>
  );
}

function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <Alert>
      <div className="flex items-start gap-2">
        <Sparkles className="h-4 w-4 mt-0.5" />
        <div>
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription>{desc}</AlertDescription>
        </div>
      </div>
    </Alert>
  );
}

function ChipCheckbox({ checked, label, onChange }: { checked: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition",
        checked ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
      )}
      aria-pressed={checked}
    >
      {label}
    </button>
  );
}

function SectionHeader({ title, desc, onExport }: { title: string; desc?: string; onExport?: () => Promise<void> }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <CardTitle>{title}</CardTitle>
        {desc ? <CardDescription>{desc}</CardDescription> : null}
      </div>
      {onExport ? (
        <Button variant="secondary" onClick={onExport}>
          <Download className="h-4 w-4" />
          PNG
        </Button>
      ) : null}
    </div>
  );
}

export default function FanrenDashboard() {
  const [store, setStore] = useState<Store>({
    episodes: [],
    episodeStats: undefined,
    basicStatsByEp: {},
    tablesByEp: {},
    loadedFiles: [],
  });

  const [activeEp, setActiveEp] = useState<string | null>(null);

  const [curveMode, setCurveMode] = useState<"emo" | "func">("emo");
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [compareEps, setCompareEps] = useState<string[]>([]);
  const [compareSeries, setCompareSeries] = useState<string>("touching");
  const [markPeak, setMarkPeak] = useState<boolean>(true);
  const [markIntervals, setMarkIntervals] = useState<boolean>(true);
  const [intervalWindow, setIntervalWindow] = useState<number>(3);
  const [intervalTopK, setIntervalTopK] = useState<number>(3);

  const [distCompareEps, setDistCompareEps] = useState<string[]>([]);
  const [distKind, setDistKind] = useState<DistKind>("emo_danmaku");
  const [distStackTopN, setDistStackTopN] = useState<number>(6);

  const [reportText, setReportText] = useState<string>("");
  const [reportTitle, setReportTitle] = useState<string>("");

  const [showComments, setShowComments] = useState<boolean>(true);
  const [topNFunc, setTopNFunc] = useState<number>(12);
  const [searchBurst, setSearchBurst] = useState<string>("");
  const [searchTerms, setSearchTerms] = useState<string>("");

  const [loading, setLoading] = useState<{ progress: number; label: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const emoChartRef = useRef<HTMLDivElement | null>(null);
  const funcChartRef = useRef<HTMLDivElement | null>(null);
  const curveChartRef = useRef<HTMLDivElement | null>(null);
  const distCompareRef = useRef<HTMLDivElement | null>(null);

  const mergeEpisodes = useCallback((tablesByEp: Record<string, TableMap>, basicStatsByEp: Record<string, any>, episodeStats?: any[]) => {
    const eps = new Set<string>();
    Object.keys(tablesByEp).forEach((ep) => eps.add(ep));
    Object.keys(basicStatsByEp).forEach((ep) => eps.add(ep));
    (episodeStats ?? []).forEach((r) => {
      const ep = String((r as any).episode_id ?? (r as any).episode ?? "");
      if (ep) eps.add(ep);
    });
    return Array.from(eps).sort((a, b) => safeNumber(a) - safeNumber(b));
  }, []);

  const ingestFileText = useCallback(
    async (name: string, text: string) => {
      const detected = detectTableKey(name);
      if (!detected) return;

      if (detected.key === "episode_stats") {
        const rows = await parseCsv(text);
        setStore((prev) => {
          const eps = mergeEpisodes(prev.tablesByEp, prev.basicStatsByEp, rows);
          return { ...prev, episodeStats: rows, episodes: eps };
        });
        return;
      }

      if (detected.key === "danmaku_basic_stats") {
        const ep = detected.ep;
        if (!ep) return;
        const obj = JSON.parse(text);
        setStore((prev) => {
          const basicStatsByEp = { ...prev.basicStatsByEp, [ep]: obj };
          const episodes = mergeEpisodes(prev.tablesByEp, basicStatsByEp, prev.episodeStats);
          return { ...prev, basicStatsByEp, episodes };
        });
        return;
      }

      const ep = detected.ep;
      if (!ep) return;

      const rows = await parseCsv(text);
      setStore((prev) => {
        const cur = prev.tablesByEp[ep] ?? {};
        const nextTablesByEp = { ...prev.tablesByEp, [ep]: { ...cur, [detected.key]: rows } };
        const episodes = mergeEpisodes(nextTablesByEp, prev.basicStatsByEp, prev.episodeStats);
        return { ...prev, tablesByEp: nextTablesByEp, episodes };
      });
    },
    [mergeEpisodes]
  );

  const ingestFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (!list.length) return;
      setLoadError(null);

      const meta = list.map((f) => ({ name: f.name, size: f.size, type: f.type || "" }));
      setStore((prev) => ({ ...prev, loadedFiles: [...prev.loadedFiles, ...meta] }));

      const zipFiles = list.filter((f) => f.name.toLowerCase().endsWith(".zip"));
      const normalFiles = list.filter((f) => !f.name.toLowerCase().endsWith(".zip"));

      try {
        for (let zi = 0; zi < zipFiles.length; zi++) {
          const zf = zipFiles[zi];
          setLoading({ progress: 5, label: `解压 ${zf.name}` });
          const buf = await zf.arrayBuffer();
          const zip = await JSZip.loadAsync(buf);
          const entries = Object.values(zip.files).filter((e) => !e.dir);

          for (let i = 0; i < entries.length; i++) {
            const e = entries[i];
            const nm = e.name.split("/").pop() || e.name;
            const low = nm.toLowerCase();
            if (!(low.endsWith(".csv") || low.endsWith(".json"))) continue;
            setLoading({ progress: Math.round((i / Math.max(1, entries.length)) * 90) + 5, label: `解析 ${nm}` });
            const t = await e.async("string");
            await ingestFileText(nm, t);
          }
        }

        for (let i = 0; i < normalFiles.length; i++) {
          const f = normalFiles[i];
          setLoading({ progress: Math.round((i / Math.max(1, normalFiles.length)) * 80) + 10, label: `解析 ${f.name}` });
          const t = await f.text();
          await ingestFileText(f.name, t);
        }
      } catch (err: any) {
        const msg = err?.message ? String(err.message) : "文件解析失败，请检查 CSV/JSON 格式。";
        setLoadError(msg);
      } finally {
        setLoading(null);
      }
    },
    [ingestFileText]
  );

  const onPickFiles = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files) return;
      await ingestFiles(e.target.files);
      e.target.value = "";
    },
    [ingestFiles]
  );

  React.useEffect(() => {
    if (!activeEp && store.episodes.length) setActiveEp(store.episodes[store.episodes.length - 1]);
  }, [store.episodes, activeEp]);

  React.useEffect(() => {
    if (store.episodes.length && compareEps.length === 0) {
      const last = store.episodes[store.episodes.length - 1];
      const prev = store.episodes[Math.max(0, store.episodes.length - 2)];
      const init = prev && prev !== last ? [prev, last] : [last];
      setCompareEps(init);
    }
  }, [store.episodes, compareEps.length]);

  React.useEffect(() => {
    if (store.episodes.length && distCompareEps.length === 0) {
      const last = store.episodes[store.episodes.length - 1];
      const prev = store.episodes[Math.max(0, store.episodes.length - 2)];
      const init = prev && prev !== last ? [prev, last] : [last];
      setDistCompareEps(init);
    }
  }, [store.episodes, distCompareEps.length]);

  const epStats = useMemo(() => {
    if (!activeEp) return null;
    const byStats = store.episodeStats?.find((r) => String((r as any).episode_id) === String(activeEp)) ?? null;
    const basic = store.basicStatsByEp[activeEp] ?? null;
    return { byStats, basic };
  }, [activeEp, store.episodeStats, store.basicStatsByEp]);

  const tables = useMemo(() => {
    if (!activeEp) return {} as TableMap;
    return store.tablesByEp[activeEp] ?? {};
  }, [activeEp, store.tablesByEp]);

  const danmuEmo = useMemo(
    () => (tables[TABLE_KEYS.DANMU_EMO] ?? []).map((r) => ({ ...r, ratio: safeNumber((r as any).ratio), cnt: safeNumber((r as any).cnt) })),
    [tables]
  );
  const comRootEmo = useMemo(
    () => (tables[TABLE_KEYS.COM_ROOT_EMO] ?? []).map((r) => ({ ...r, ratio: safeNumber((r as any).ratio), cnt: safeNumber((r as any).cnt) })),
    [tables]
  );

  const emoBars = useMemo(() => {
    const map: Record<string, any> = {};
    for (const r of danmuEmo) {
      const emo = String((r as any).emo ?? (r as any).label ?? "other");
      map[emo] = map[emo] ?? { emo };
      map[emo].danmaku = safeNumber((r as any).ratio);
      map[emo].danmaku_cnt = safeNumber((r as any).cnt);

    }
    for (const r of comRootEmo) {
      const emo = String((r as any).emo ?? (r as any).label ?? "other");
      map[emo] = map[emo] ?? { emo };
      map[emo].comment = safeNumber((r as any).ratio);
      map[emo].comment_cnt = safeNumber((r as any).cnt);
    }
    const order = new Map(EMO_ORDER.map((k, i) => [k, i]));
    return Object.values(map).sort((a: any, b: any) => (order.get(a.emo) ?? 999) - (order.get(b.emo) ?? 999));
  }, [danmuEmo, comRootEmo]);

const danmuModelEmo = useMemo(
  () =>
    (tables[TABLE_KEYS.DANMU_MODEL_EMO] ?? []).map((r) => ({
      label: String((r as any).model_emo ?? (r as any).emo ?? (r as any).label ?? "neu"),
      ratio: safeNumber((r as any).ratio),
      cnt: safeNumber((r as any).cnt),
    })),
  [tables]
);

const comRootModelEmo = useMemo(
  () =>
    (tables[TABLE_KEYS.COM_ROOT_MODEL_EMO] ?? []).map((r) => ({
      label: String((r as any).model_emo ?? (r as any).emo ?? (r as any).label ?? "neu"),
      ratio: safeNumber((r as any).ratio),
      cnt: safeNumber((r as any).cnt),
    })),
  [tables]
);

const modelUsage = useMemo(() => (tables[TABLE_KEYS.MODEL_USAGE] ?? []) as any[], [tables]);


const polBars = useMemo(() => {
  const map: Record<string, any> = {};
  for (const r of danmuModelEmo) {
    const k = String((r as any).label ?? "neu");
    map[k] = map[k] ?? { label: k };
    map[k].danmaku = safeNumber((r as any).ratio);
    map[k].danmaku_cnt = safeNumber((r as any).cnt);
  }
  for (const r of comRootModelEmo) {
    const k = String((r as any).label ?? "neu");
    map[k] = map[k] ?? { label: k };
    map[k].comment = safeNumber((r as any).ratio);
    map[k].comment_cnt = safeNumber((r as any).cnt);
  }
  const order = ["pos", "neu", "neg"];
  return order.filter((k) => map[k]).map((k) => map[k]).concat(Object.values(map).filter((v: any) => !order.includes(String(v.label))));
}, [danmuModelEmo, comRootModelEmo]);

const usageDanmu = useMemo(() => modelUsage.find((r: any) => String(r.dataset) === "danmaku") ?? null, [modelUsage]);
const usageRoot = useMemo(() => modelUsage.find((r: any) => String(r.dataset) === "comment_root") ?? null, [modelUsage]);

  const danmuFunc = useMemo(
    () => (tables[TABLE_KEYS.DANMU_FUNC] ?? []).map((r) => ({ ...r, ratio: safeNumber((r as any).ratio), cnt: safeNumber((r as any).cnt) })),
    [tables]
  );

  const funcBars = useMemo(() => {
    const rows = danmuFunc
      .map((r) => ({ func: String((r as any).func ?? (r as any).label ?? "other"), ratio: safeNumber((r as any).ratio), cnt: safeNumber((r as any).cnt) }))
      .sort((a, b) => b.ratio - a.ratio);
    return clampTopN(rows, topNFunc);
  }, [danmuFunc, topNFunc]);

  const curveData = useMemo(() => {
    const key = curveMode === "emo" ? TABLE_KEYS.DANMU_MIN_EMO : TABLE_KEYS.DANMU_MIN_FUNC;
    const rows = (tables[key] ?? []).map((r) => ({ ...r, minute: safeNumber((r as any).minute) }));
    return rows.sort((a, b) => (a as any).minute - (b as any).minute);
  }, [tables, curveMode]);

  const curveSeriesKeys = useMemo(() => {
    if (!curveData.length) return [] as string[];
    const sample = curveData[0] as any;
    const keys = Object.keys(sample).filter((k) => !["episode_id", "minute"].includes(k));
    if (curveMode === "emo") {
      const order = new Map<string, number>(EMO_ORDER.map((k, i) => [k, i]));
      return keys.sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
    }
    const sums: Record<string, number> = {};
    for (const k of keys) sums[k] = 0;
    for (const row of curveData as any[]) for (const k of keys) sums[k] += safeNumber(row[k]);
    return keys.sort((a, b) => (sums[b] ?? 0) - (sums[a] ?? 0));
  }, [curveData, curveMode]);

  const [intervalSeriesKey, setIntervalSeriesKey] = useState<string>("touching");
  React.useEffect(() => {
    const first = curveSeriesKeys[0] ?? (curveMode === "emo" ? "touching" : "");
    if (!first) return;
    setIntervalSeriesKey((prev) => (curveMode === "emo" ? (EMO_ORDER.includes(prev as any) ? prev : "touching") : curveSeriesKeys.includes(prev) ? prev : first));
  }, [curveMode, curveSeriesKeys]);

  const intervalsSingle = useMemo(() => {
    if (!markIntervals || !curveData.length || !intervalSeriesKey) return [];
    return topKIntervals(curveData as any[], intervalSeriesKey, intervalWindow, intervalTopK);
  }, [markIntervals, curveData, intervalSeriesKey, intervalWindow, intervalTopK]);

  const compareCurveCombined = useMemo(() => {
    if (!compareMode || !compareEps.length) return [];
    const key = curveMode === "emo" ? TABLE_KEYS.DANMU_MIN_EMO : TABLE_KEYS.DANMU_MIN_FUNC;

    const byEp: Record<string, any[]> = {};
    const minuteSet = new Set<number>();
    for (const ep of compareEps) {
      const rows = (store.tablesByEp[ep]?.[key] ?? []).map((r) => ({ ...r, minute: safeNumber((r as any).minute) }));
      byEp[ep] = rows;
      rows.forEach((r) => minuteSet.add(safeNumber((r as any).minute)));
    }

    const minutes = Array.from(minuteSet).sort((a, b) => a - b);
    const lookup: Record<string, Record<number, number>> = {};
    for (const ep of compareEps) {
      lookup[ep] = {};
      for (const r of byEp[ep] ?? []) lookup[ep][safeNumber((r as any).minute)] = safeNumber((r as any)[compareSeries]);
    }

    return minutes.map((m) => {
      const row: any = { minute: m };
      for (const ep of compareEps) row[`ep${ep}`] = lookup[ep]?.[m] ?? 0;
      return row;
    });
  }, [compareMode, compareEps, store.tablesByEp, curveMode, compareSeries]);

  const compareColors = useMemo(() => {
    const m: Record<string, string> = {};
    compareEps.forEach((ep) => (m[`ep${ep}`] = stableColorFromKey("ep_" + ep)));
    return m;
  }, [compareEps]);

  const comparePeaks = useMemo(() => {
    if (!compareMode || !markPeak || !compareCurveCombined.length) return [];
    const out: Array<{ epKey: string; minute: number; value: number }> = [];
    for (const ep of compareEps) {
      const epKey = `ep${ep}`;
      let bestMinute: number | null = null;
      let bestVal = -Infinity;
      for (const r of compareCurveCombined as any[]) {
        const v = safeNumber(r[epKey]);
        if (v > bestVal) {
          bestVal = v;
          bestMinute = safeNumber(r.minute);
        }
      }
      if (bestMinute != null && Number.isFinite(bestVal)) out.push({ epKey, minute: bestMinute, value: bestVal });
    }
    return out;
  }, [compareMode, markPeak, compareCurveCombined, compareEps]);

  const intervalsCompare = useMemo(() => {
    if (!compareMode || !markIntervals || !compareCurveCombined.length) return {} as Record<string, any[]>;
    const out: Record<string, any[]> = {};
    for (const ep of compareEps) {
      const epKey = `ep${ep}`;
      out[epKey] = topKIntervals(compareCurveCombined as any[], epKey, intervalWindow, intervalTopK);
    }
    return out;
  }, [compareMode, markIntervals, compareCurveCombined, compareEps, intervalWindow, intervalTopK]);

  const distCompareData = useMemo(() => {
    if (!distCompareEps.length) return { rows: [], keys: [] as string[], label: "", colors: {} as Record<string, string> };

    const isEmo = distKind.startsWith("emo_");

    if (isEmo) {
      const tableKey =
        distKind === "emo_danmaku"
          ? TABLE_KEYS.DANMU_EMO
          : distKind === "emo_comment_root"
          ? TABLE_KEYS.COM_ROOT_EMO
          : TABLE_KEYS.COM_REPLY_EMO;
      const keys = [...EMO_ORDER];

      const hasAny = distCompareEps.some((ep) => (store.tablesByEp[ep]?.[tableKey]?.length ?? 0) > 0);
      if (!hasAny) return { rows: [], keys: [], label: "", colors: {} as Record<string, string> };

      const rows = distCompareEps.map((ep) => {
        const dist = store.tablesByEp[ep]?.[tableKey] ?? [];
        const m: Record<string, number> = {};
        for (const r of dist as any[]) {
          const emo = String(r.emo ?? r.label ?? "other");
          m[emo] = safeNumber(r.ratio);
        }
        const row: any = { episode: `第${ep}集`, ep };
        for (const k of keys) row[k] = m[k] ?? 0;
        return row;
      });

      const label =
        distKind === "emo_danmaku"
          ? "弹幕情绪分布（堆叠）"
          : distKind === "emo_comment_root"
          ? "根评论情绪分布（堆叠）"
          : "回复评论情绪分布（堆叠）";
      return { rows, keys, label, colors: EMO_COLOR_MAP };
    }

    const funcTableKey =
      distKind === "func_danmaku"
        ? TABLE_KEYS.DANMU_FUNC
        : distKind === "func_comment_all"
        ? TABLE_KEYS.COM_ALL_FUNC
        : distKind === "func_comment_root"
        ? TABLE_KEYS.COM_ROOT_FUNC
        : TABLE_KEYS.COM_REPLY_FUNC;

    const hasAny = distCompareEps.some((ep) => (store.tablesByEp[ep]?.[funcTableKey]?.length ?? 0) > 0);
    if (!hasAny) return { rows: [], keys: [], label: "", colors: {} as Record<string, string> };

    const funcMean: Record<string, number[]> = {};
    for (const ep of distCompareEps) {
      const dist = store.tablesByEp[ep]?.[funcTableKey] ?? [];
      for (const r of dist as any[]) {
        const func = String(r.func ?? r.label ?? "other");
        funcMean[func] = funcMean[func] ?? [];
        funcMean[func].push(safeNumber(r.ratio));
      }
    }
    const funcScores = Object.entries(funcMean).map(([k, arr]) => [k, arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length)] as const);
    funcScores.sort((a, b) => b[1] - a[1]);
    const topKeys = funcScores.slice(0, Math.max(3, Math.min(12, distStackTopN))).map((x) => x[0]);
    const keys = [...topKeys, "other"];
    const colors: Record<string, string> = {};
    keys.forEach((k) => (colors[k] = k === "other" ? "#94a3b8" : stableColorFromKey("func_" + k)));

    const rows = distCompareEps.map((ep) => {
      const dist = store.tablesByEp[ep]?.[funcTableKey] ?? [];
      const m: Record<string, number> = {};
      for (const r of dist as any[]) {
        const func = String(r.func ?? r.label ?? "other");
        m[func] = safeNumber(r.ratio);
      }
      const row: any = { episode: `第${ep}集`, ep };
      for (const k of topKeys) row[k] = m[k] ?? 0;
      const sumTop = topKeys.reduce((s, k) => s + (row[k] ?? 0), 0);
      row["other"] = Math.max(0, 1 - sumTop);
      return row;
    });

    const label =
      distKind === "func_danmaku"
        ? "弹幕功能分布（TopN + other）"
        : distKind === "func_comment_all"
        ? "评论功能分布（总体）"
        : distKind === "func_comment_root"
        ? "评论功能分布（根评）"
        : "评论功能分布（回复）";
    return { rows, keys, label, colors };
  }, [distCompareEps, distKind, store.tablesByEp, distStackTopN]);

  const distCompareMissing = useMemo(() => {
    if (!distCompareEps.length) return { missingEps: [] as string[], filePattern: "" };

    const filePattern =
      distKind === "emo_danmaku"
        ? "danmaku_emo_dist_ep{ep}.csv"
        : distKind === "emo_comment_root"
        ? "comment_root_emo_dist_ep{ep}.csv"
        : distKind === "emo_comment_reply"
        ? "comment_reply_emo_dist_ep{ep}.csv"
        : distKind === "func_danmaku"
        ? "danmaku_func_dist_ep{ep}.csv"
        : distKind === "func_comment_all"
        ? "comment_func_dist_ep{ep}.csv"
        : distKind === "func_comment_root"
        ? "comment_root_func_dist_ep{ep}.csv"
        : "comment_reply_func_dist_ep{ep}.csv";

    const tableKey = distKind.startsWith("emo_")
      ? distKind === "emo_danmaku"
        ? TABLE_KEYS.DANMU_EMO
        : distKind === "emo_comment_root"
        ? TABLE_KEYS.COM_ROOT_EMO
        : TABLE_KEYS.COM_REPLY_EMO
      : distKind === "func_danmaku"
      ? TABLE_KEYS.DANMU_FUNC
      : distKind === "func_comment_all"
      ? TABLE_KEYS.COM_ALL_FUNC
      : distKind === "func_comment_root"
      ? TABLE_KEYS.COM_ROOT_FUNC
      : TABLE_KEYS.COM_REPLY_FUNC;

    const missingEps = distCompareEps.filter((ep) => (store.tablesByEp[ep]?.[tableKey]?.length ?? 0) === 0);
    return { missingEps, filePattern };
  }, [distCompareEps, distKind, store.tablesByEp]);

  const burstRows = useMemo(() => {
    const rows = (tables[TABLE_KEYS.BURST_2S] ?? []).map((r) => ({
      sec_bin: safeNumber((r as any).sec_bin),
      norm_content: String((r as any).norm_content ?? ""),
      cnt: safeNumber((r as any).cnt),
    }));
    const q = searchBurst.trim().toLowerCase();
    const filtered = q ? rows.filter((r) => r.norm_content.toLowerCase().includes(q)) : rows;
    return filtered.slice(0, 200);
  }, [tables, searchBurst]);

  const termsDanmu = useMemo(
    () => (tables[TABLE_KEYS.TOP_TERMS_DANMU] ?? []).map((r) => ({ term: String((r as any).term ?? ""), cnt: safeNumber((r as any).cnt) })),
    [tables]
  );
  const termsComment = useMemo(
    () => (tables[TABLE_KEYS.TOP_TERMS_COMMENT] ?? []).map((r) => ({ term: String((r as any).term ?? ""), cnt: safeNumber((r as any).cnt) })),
    [tables]
  );

  const filteredTerms = useMemo(() => {
    const q = searchTerms.trim().toLowerCase();
    const base = showComments ? termsComment : termsDanmu;
    const rows = q ? base.filter((r) => r.term.toLowerCase().includes(q)) : base;
    return rows.slice(0, 200);
  }, [termsDanmu, termsComment, showComments, searchTerms]);

  const ready = store.episodes.length > 0;

  const epOptions = useMemo(() => store.episodes.map((ep) => ({ label: `第 ${ep} 集`, value: ep })), [store.episodes]);

  const uploadSummary = useMemo(() => {
    if (!store.loadedFiles.length) return null;
    const totalBytes = store.loadedFiles.reduce((sum, f) => sum + (f.size || 0), 0);
    const sizeMb = totalBytes / (1024 * 1024);
    const sizeLabel = sizeMb >= 1 ? `${sizeMb.toFixed(1)} MB` : `${Math.max(1, Math.round(sizeMb * 1024))} KB`;
    return { count: store.loadedFiles.length, sizeLabel };
  }, [store.loadedFiles]);

  const compareSeriesOptions = useMemo(() => {
    if (curveMode === "emo") return EMO_ORDER.map((k) => ({ label: k, value: k }));
    const keys = curveSeriesKeys.length ? curveSeriesKeys : ["ritual_call", "viewing_status", "emo_like", "emo_touching", "other"];
    return keys.slice(0, 50).map((k) => ({ label: k, value: k }));
  }, [curveMode, curveSeriesKeys]);

  const intervalSeriesOptions = useMemo(() => {
    if (curveMode === "emo") return EMO_ORDER.map((k) => ({ label: k, value: k }));
    return (curveSeriesKeys.length ? curveSeriesKeys : ["ritual_call", "viewing_status", "other"]).slice(0, 40).map((k) => ({ label: k, value: k }));
  }, [curveMode, curveSeriesKeys]);

  const toggleCompareEp = useCallback(
    (ep: string) => setCompareEps((prev) => (prev.includes(ep) ? prev.filter((x) => x !== ep) : [...prev, ep].sort((a, b) => safeNumber(a) - safeNumber(b)))),
    []
  );
  const toggleDistEp = useCallback(
    (ep: string) => setDistCompareEps((prev) => (prev.includes(ep) ? prev.filter((x) => x !== ep) : [...prev, ep].sort((a, b) => safeNumber(a) - safeNumber(b)))),
    []
  );

  const generateReportMarkdown = useCallback(() => {
    const ep = activeEp ?? "—";
    const danmuTotal = (epStats as any)?.byStats?.danmu_total ?? (epStats as any)?.basic?.danmu_total ?? "—";
    const density = (epStats as any)?.byStats?.minute_avg_density ?? (epStats as any)?.basic?.minute_avg_density ?? "—";
    const rootCnt = (epStats as any)?.byStats?.root_cnt ?? "—";
    const replyCnt = (epStats as any)?.byStats?.reply_cnt ?? "—";

    const topDanmuEmo = fmtTopList(pickTopDist(danmuEmo as any[], "emo", "ratio", 3), "ratio");
    const topRootEmo = fmtTopList(pickTopDist(comRootEmo as any[], "emo", "ratio", 3), "ratio");
    const topFunc = fmtTopList(pickTopDist(danmuFunc as any[], "func", "ratio", 3), "ratio");

    const peak = curveData.length && intervalSeriesKey ? computePeak(curveData as any[], intervalSeriesKey) : null;
    const ints = intervalsSingle as any[];

    const cmpSummary =
      compareMode && (compareCurveCombined as any[]).length
        ? compareEps
            .map((epx) => {
              const epKey = `ep${epx}`;
              const p = (comparePeaks as any[]).find((x) => x.epKey === epKey);
              const topInts = (intervalsCompare as any)[epKey] ?? [];
              const intStr = topInts.slice(0, 3).map((it: any) => `${it.start}–${it.end}m`).join("、");
              return `- 第${epx}集：峰值@${p?.minute ?? "—"}m；Top区间：${intStr || "—"}`;
            })
            .join("\n")
        : "";

    const caption1 = `图1 展示第${ep}集弹幕与根评论的情绪分布对比：弹幕Top情绪为 ${topDanmuEmo}；根评论Top情绪为 ${topRootEmo}。`;
    const caption2 = `图2 展示第${ep}集弹幕功能分布（Top${topNFunc}）：Top功能为 ${topFunc}。`;
    const caption3 = compareMode
      ? `图3 展示多集 minute 曲线对比（维度=${compareSeries}）：各集峰值与高峰区间可据图与下表归纳。`
      : `图3 展示第${ep}集 minute 曲线（维度=${curveMode}）；在 ${intervalSeriesKey} 维度下的峰值为 @${peak?.minute ?? "—"}m，Top区间为：${
          (ints || []).slice(0, 3).map((it: any) => `${it.start}–${it.end}m`).join("、") || "—"
        }。`;
    const caption4 = `图4 展示多集分布对比（${distKind}，堆叠）：用于论证“不同剧情功能集 → 情绪/互动结构差异”。`;

    return `# 论文图注与快速结论（自动生成）

## 数据概况（第${ep}集）
- 弹幕总数：${danmuTotal}
- 每分钟平均弹幕密度：${density}
- 根评论数：${rootCnt}
- 回复数：${replyCnt}

## 图注（可直接粘贴到论文）
- ${caption1}
- ${caption2}
- ${caption3}
- ${caption4}

## 快速结论句式（可改写）
- 第${ep}集中，弹幕更偏向“即时情绪/仪式性互动”（Top功能：${topFunc}），根评论更偏向“解释/评价/叙述式表达”（情绪Top：${topRootEmo}）。
- 时间轴上，${intervalSeriesKey} 在 ${peak?.minute ?? "—"} 分钟附近出现峰值，并在 Top 区间内集中爆发，可对应剧情高能段落进行质性补充。

${compareMode ? `## 多集对比要点（${compareSeries})\n${cmpSummary}` : ""}

## 导出说明
- 图像：使用界面 PNG 按钮或“一键导出图包”
- 图包：包含主要图 + 本报告（md）
`;
  }, [activeEp, epStats, danmuEmo, comRootEmo, danmuFunc, curveData, intervalSeriesKey, intervalsSingle, compareMode, compareCurveCombined, compareEps, comparePeaks, intervalsCompare, compareSeries, curveMode, distKind, topNFunc]);

  const exportPack = useCallback(async () => {
    const zip = new JSZip();
    const ep = activeEp ?? "unknown";
    try {
      if (emoChartRef.current) zip.file(`ep${ep}/fig_emo_dist.png`, await exportNodeAsPngBlob(emoChartRef.current));
    } catch (_err) {
      // Skip failed chart export to keep the pack usable.
    }
    try {
      if (funcChartRef.current) zip.file(`ep${ep}/fig_func_dist.png`, await exportNodeAsPngBlob(funcChartRef.current));
    } catch (_err) {
      // Skip failed chart export to keep the pack usable.
    }
    try {
      if (curveChartRef.current) {
        const name = compareMode ? `compare_${curveMode}_${compareSeries}.png` : `ep${ep}_curve_${curveMode}.png`;
        zip.file(`figs/${name}`, await exportNodeAsPngBlob(curveChartRef.current));
      }
    } catch (_err) {
      // Skip failed chart export to keep the pack usable.
    }
    try {
      if (distCompareRef.current) zip.file(`figs/compare_dist_${distKind}.png`, await exportNodeAsPngBlob(distCompareRef.current));
    } catch (_err) {
      // Skip failed chart export to keep the pack usable.
    }
    const md = generateReportMarkdown();
    zip.file(`report_${Date.now()}.md`, md);
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(`fanren_fig_pack_${Date.now()}.zip`, blob);
  }, [activeEp, compareMode, curveMode, compareSeries, distKind, generateReportMarkdown]);

  const buildReport = useCallback(() => {
    const md = generateReportMarkdown();
    setReportTitle(`report_ep${activeEp ?? "unknown"}_${Date.now()}.md`);
    setReportText(md);
  }, [generateReportMarkdown, activeEp]);

  return (
    <div className="min-h-screen w-full">
      <div className="mx-auto max-w-6xl p-4 md:p-8">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="flex flex-col gap-3">
          <Card className="border-slate-200/70 bg-white/80 backdrop-blur">
            <CardHeader className="pb-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                    <div>
                      <h1 className="text-xl md:text-2xl font-semibold">凡人修仙传 · 弹幕/评论 情绪与互动模式可视化</h1>
                      <p className="text-sm text-slate-500 mt-1">上传 pipeline 产出 zip 或 tables 文件，自动识别并生成交互图表（v4：一键导出图包 + 自动生成图注/结论）。</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input ref={inputRef} className="hidden" type="file" multiple accept=".zip,.csv,.json" onChange={onPickFiles} />
                  <Button onClick={() => inputRef.current?.click()}>
                    <Upload className="h-4 w-4" />
                    上传文件/Zip
                  </Button>
                  <Button variant="secondary" onClick={exportPack} disabled={!ready}>
                    <FileDown className="h-4 w-4" />
                    一键导出图包
                  </Button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge variant="default">自动图注</Badge>
                <Badge>多集对比</Badge>
                <Badge>PNG 导出</Badge>
                {uploadSummary ? <Badge>已加载 {uploadSummary.count} 个文件 · {uploadSummary.sizeLabel}</Badge> : <Badge>支持 CSV / JSON / ZIP</Badge>}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {loading ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm text-slate-500">{loading.label}</div>
                    <div className="w-40">
                      <Progress value={loading.progress} />
                    </div>
                  </div>
                </div>
              ) : null}
              {loadError ? (
                <Alert className="mt-3">
                  <AlertTitle>文件解析失败</AlertTitle>
                  <AlertDescription>{loadError}</AlertDescription>
                </Alert>
              ) : null}

              {ready ? null : (
                <div className="mt-4">
                  <EmptyState title="还没有数据" desc="请上传 outputs 的 zip（推荐）或 outputs/tables 下的 csv/json 文件。" />
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {ready ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.05 }} className="mt-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">控制面板</CardTitle>
                    <CardDescription>单集分析用于写 4.x；多集对比适合写“不同剧情功能集的差异”。</CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-[180px]">
                      <NativeSelect value={activeEp ?? undefined} onChange={(v) => setActiveEp(v)} options={epOptions} />
                    </div>

                    <div className="flex items-center gap-2">
                      <Label>曲线</Label>
                      <div className="flex items-center gap-2">
                        <Button variant={curveMode === "emo" ? "default" : "secondary"} onClick={() => setCurveMode("emo")}>
                          emo
                        </Button>
                        <Button variant={curveMode === "func" ? "default" : "secondary"} onClick={() => setCurveMode("func")}>
                          func
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator className="mt-4" />

                <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
                  <div className="lg:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Switch checked={compareMode} onCheckedChange={setCompareMode} />
                        <Label>对比模式（多集曲线）</Label>
                      </div>

                      {compareMode ? (
                        <div className="flex items-center gap-2">
                          <Label className="whitespace-nowrap">对比维度</Label>
                          <NativeSelect value={compareSeries} onChange={setCompareSeries} options={compareSeriesOptions} className="w-56" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Label className="whitespace-nowrap">Top区间维度</Label>
                          <NativeSelect value={intervalSeriesKey} onChange={setIntervalSeriesKey} options={intervalSeriesOptions} className="w-56" />
                        </div>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
                        <Switch checked={markPeak} onCheckedChange={setMarkPeak} />
                        <Label>标注峰值</Label>
                      </div>
                      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
                        <Switch checked={markIntervals} onCheckedChange={setMarkIntervals} />
                        <Label>标注Top区间</Label>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between">
                          <Label>区间窗口</Label>
                          <span className="text-xs text-slate-500">{intervalWindow} 分钟</span>
                        </div>
                        <Input type="number" min={1} max={10} value={intervalWindow} onChange={(e) => setIntervalWindow(Math.max(1, Math.min(10, Number(e.target.value) || 3)))} className="mt-2" />
                        <div className="flex items-center justify-between mt-2">
                          <Label>TopK</Label>
                          <span className="text-xs text-slate-500">{intervalTopK}</span>
                        </div>
                        <Input type="number" min={1} max={5} value={intervalTopK} onChange={(e) => setIntervalTopK(Math.max(1, Math.min(5, Number(e.target.value) || 3)))} className="mt-2" />
                      </div>
                    </div>

                    {compareMode ? (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                        <div className="text-sm font-medium mb-2">选择参与曲线对比的集数</div>
                        <div className="flex flex-wrap gap-2">
                          {store.episodes.map((ep) => (
                            <ChipCheckbox key={ep} checked={compareEps.includes(ep)} label={`第${ep}集`} onChange={() => toggleCompareEp(ep)} />
                          ))}
                        </div>
                        <div className="mt-2 text-xs text-slate-500">建议选 2–4 集：开篇设定集 / 日常铺垫集 / 高能剧情集（例如结婴）。</div>
                      </div>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-2">
                    <StatCard title="弹幕条数" value={(epStats as any)?.byStats?.danmu_total ?? (epStats as any)?.basic?.danmu_total ?? "—"} hint={<span>每分钟平均密度：{fmtNum((epStats as any)?.byStats?.minute_avg_density ?? (epStats as any)?.basic?.minute_avg_density, 1)}</span>} />
                    <StatCard title="根评论数" value={(epStats as any)?.byStats?.root_cnt ?? "—"} hint={<span>（parent=0）</span>} />
                    <StatCard title="回复数" value={(epStats as any)?.byStats?.reply_cnt ?? "—"} hint={<span>（parent!=0）</span>} />
                    <StatCard title="写作助手" value={<span className="text-base">图注/结论</span>} hint={<span>见「图注&导出」</span>} />
                  </div>
                </div>
              </CardHeader>
              <CardContent />
            </Card>

            <Tabs defaultValue="charts" className="mt-4">
              <TabsList>
                <TabsTrigger value="charts"><BarChart3 className="h-4 w-4" />单集图表</TabsTrigger>
                <TabsTrigger value="compare"><Layers className="h-4 w-4" />多集分布对比</TabsTrigger>
                <TabsTrigger value="curves"><Activity className="h-4 w-4" />时间曲线</TabsTrigger>
                <TabsTrigger value="tables"><TableIcon className="h-4 w-4" />表格</TabsTrigger>
                <TabsTrigger value="report"><Wand2 className="h-4 w-4" />图注&导出</TabsTrigger>
              </TabsList>

              <TabsContent value="charts" className="mt-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <SectionHeader
                        title="情绪分布（弹幕 vs 根评论）"
                        desc="ratio 为占比；悬停查看 cnt 与占比。"
                        onExport={async () => {
                          if (!emoChartRef.current || !activeEp) return;
                          await exportNodeAsPng(emoChartRef.current, `ep${activeEp}_emo_dist.png`);
                        }}
                      />
                    </CardHeader>
                    <CardContent>
                      <div ref={emoChartRef} className="h-[360px]">
                        {emoBars.length ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={emoBars} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="emo" tick={{ fontSize: 12 }} />
                              <YAxis tickFormatter={(v) => `${Math.round((v as number) * 100)}%`} />
                              <Tooltip
                                formatter={(v: any, name: any, props: any) => {
                                  const row = props?.payload;
                                  if (name === "danmaku") return [toPercent(v), `弹幕（${row?.danmaku_cnt ?? 0}）`];
                                  if (name === "comment") return [toPercent(v), `根评（${row?.comment_cnt ?? 0}）`];
                                  return [v, name];
                                }}
                              />
                              <Legend />
                              <Bar dataKey="danmaku" name="danmaku" fill="#0f172a" radius={[12, 12, 0, 0]} />
                              <Bar dataKey="comment" name="comment" fill="#64748b" radius={[12, 12, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <EmptyState title="缺少情绪分布表" desc="请上传 danmaku_emo_dist_ep*.csv 与 comment_root_emo_dist_ep*.csv（或 zip）。" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
<Card>
  <CardHeader className="pb-2">
    <CardTitle className="text-base flex items-center gap-2">
      <Sparkles className="h-4 w-4" />
      模型极性分布（model_emo，仅统计 model_used=True）
    </CardTitle>
    <CardDescription className="text-xs">
      {usageDanmu ? `弹幕：${Math.round(safeNumber(usageDanmu.ratio) * 100)}% 调用覆盖` : "弹幕：未上传 model_usage 表"}
      {" · "}
      {usageRoot ? `根评：${Math.round(safeNumber(usageRoot.ratio) * 100)}% 调用覆盖` : "根评：未上传 model_usage 表"}
    </CardDescription>
  </CardHeader>
  <CardContent>
    <div className="h-[360px]">
      {polBars.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={polBars} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `${Math.round((v as number) * 100)}%`} />
            <Tooltip formatter={(v: any) => `${Math.round((v as number) * 1000) / 10}%`} />
            <Legend />
            <Bar dataKey="danmaku" name="弹幕" fill={colorForKey("pos", "emo")} />
            <Bar dataKey="comment" name="根评论" fill={colorForKey("neg", "emo")} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyState title="暂无数据" desc="请上传 tables/ 下的 danmaku_model_emo_dist_ep*.csv、comment_root_model_emo_dist_ep*.csv" />
      )}
    </div>
    <div className="mt-3 text-xs text-slate-600">
      建议写法：将 pos/neg/neu 作为“极性维度”，与论文的 laugh/touching/praise 等“类型维度”区分开。
    </div>
  </CardContent>
</Card>


                  <Card>
                    <CardHeader>
                      <SectionHeader
                        title="弹幕功能分布（TopN）"
                        desc="颜色为稳定映射：同一功能在不同图/不同集颜色一致。"
                        onExport={async () => {
                          if (!funcChartRef.current || !activeEp) return;
                          await exportNodeAsPng(funcChartRef.current, `ep${activeEp}_func_dist.png`);
                        }}
                      />
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3 mb-3">
                        <Label>TopN</Label>
                        <Input className="w-24" type="number" min={5} max={50} value={topNFunc} onChange={(e) => setTopNFunc(Math.max(5, Math.min(50, Number(e.target.value) || 12)))} />
                        <span className="text-xs text-slate-500">（建议 10–20）</span>
                      </div>
                      <div ref={funcChartRef} className="h-[320px]">
                        {funcBars.length ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={funcBars} layout="vertical" margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis type="number" tickFormatter={(v) => `${Math.round((v as number) * 100)}%`} />
                              <YAxis type="category" dataKey="func" width={130} tick={{ fontSize: 12 }} />
                              <Tooltip formatter={(v: any, _name: any, props: any) => [toPercent(v), `占比（cnt=${props?.payload?.cnt ?? 0}）`]} />
                              <Bar dataKey="ratio" radius={[12, 12, 12, 12]} fill="#0f172a" />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <EmptyState title="缺少功能分布表" desc="请上传 danmaku_func_dist_ep*.csv（或 zip）。" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="compare" className="mt-4">
                <Card>
                  <CardHeader>
                    <SectionHeader
                      title="多集分布对比（堆叠）"
                      desc="用于论证“不同剧情功能集 → 情绪/互动结构差异”。"
                      onExport={async () => {
                        if (!distCompareRef.current) return;
                        await exportNodeAsPng(distCompareRef.current, `compare_dist_${distKind}.png`);
                      }}
                    />
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <Label>对比类型</Label>
                        <NativeSelect
                          value={distKind}
                          onChange={(v) => setDistKind(v as any)}
                          options={[
                            { label: "弹幕情绪分布（堆叠）", value: "emo_danmaku" },
                            { label: "根评论情绪分布（堆叠）", value: "emo_comment_root" },
                            { label: "回复评论情绪分布（堆叠）", value: "emo_comment_reply" },
                            { label: "弹幕功能分布（TopN+other）", value: "func_danmaku" },
                            { label: "评论功能分布（总体）", value: "func_comment_all" },
                            { label: "评论功能分布（根评）", value: "func_comment_root" },
                            { label: "评论功能分布（回复）", value: "func_comment_reply" },
                          ]}
                          className="mt-2"
                        />
                        {distKind.startsWith("func_") ? (
                          <>
                            <div className="mt-3 flex items-center justify-between">
                              <Label>TopN</Label>
                              <span className="text-xs text-slate-500">{distStackTopN}</span>
                            </div>
                            <Input type="number" min={3} max={12} value={distStackTopN} onChange={(e) => setDistStackTopN(Math.max(3, Math.min(12, Number(e.target.value) || 6)))} className="mt-2" />
                          </>
                        ) : null}
                      </div>

                      <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-3">
                        <div className="text-sm font-medium mb-2">选择参与分布对比的集数</div>
                        <div className="flex flex-wrap gap-2">
                          {store.episodes.map((ep) => (
                            <ChipCheckbox key={ep} checked={distCompareEps.includes(ep)} label={`第${ep}集`} onChange={() => toggleDistEp(ep)} />
                          ))}
                        </div>
                        <div className="mt-2 text-xs text-slate-500">建议：开篇/设定集 + 铺垫集 + 高能集（形成结构差异）。</div>

                        {distCompareMissing.missingEps.length ? (
                          <Alert className="mt-3">
                            <AlertTitle>部分集数缺少所需表</AlertTitle>
                            <AlertDescription>
                              当前对比类型需要 <code>{distCompareMissing.filePattern}</code>。缺失集：{distCompareMissing.missingEps.map((e) => `第${e}集`).join("、")}。
                              （旧 zip 上传也不会报错，但该集将无法参与此对比）
                            </AlertDescription>
                          </Alert>
                        ) : null}
                      </div>
                    </div>

                    <div ref={distCompareRef} className="h-[460px]">
                      {distCompareData.rows.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={distCompareData.rows} margin={{ top: 10, right: 16, left: 0, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="episode" tick={{ fontSize: 12 }} />
                            <YAxis tickFormatter={(v) => `${Math.round((v as number) * 100)}%`} />
                            <Tooltip formatter={(v: any, name: any) => [toPercent(v), name]} />
                            <Legend />
                            {distCompareData.keys.map((k) => (
                              <Bar key={k} dataKey={k} stackId="a" fill={(distCompareData.colors as any)[k] ?? "#94a3b8"} radius={[8, 8, 0, 0]} />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <EmptyState title="缺少多集分布数据" desc="请上传所选集数的 dist 表（danmaku_emo_dist / comment_root_emo_dist / comment_reply_emo_dist / *_func_dist）。" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="curves" className="mt-4">
                <Card>
                  <CardHeader>
                    <SectionHeader
                      title={`弹幕时间曲线（minute × ${curveMode}）${compareMode ? ` · 多集对比（${compareSeries}）` : ""}`}
                      desc="Top区间：按窗口自动找 TopK 非重叠高峰区间，并用阴影标注。"
                      onExport={async () => {
                        if (!curveChartRef.current) return;
                        const name = compareMode ? `compare_${curveMode}_${compareSeries}.png` : `ep${activeEp}_curve_${curveMode}.png`;
                        await exportNodeAsPng(curveChartRef.current, name);
                      }}
                    />
                  </CardHeader>

                  <CardContent>
                    <div ref={curveChartRef} className="h-[480px]">
                      {compareMode ? (
                        (compareCurveCombined as any[]).length ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <RLineChart data={compareCurveCombined as any[]} margin={{ top: 10, right: 12, left: 0, bottom: 10 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="minute" tick={{ fontSize: 12 }} />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              {markIntervals
                                ? compareEps.flatMap((ep) => {
                                    const epKey = `ep${ep}`;
                                    const ints = (intervalsCompare as any)[epKey] ?? [];
                                    return ints.map((it: any, idx: number) => <ReferenceArea key={`${epKey}-${idx}`} x1={it.start} x2={it.end} fill={compareColors[epKey]} fillOpacity={0.08} strokeOpacity={0} />);
                                  })
                                : null}

                              {compareEps.map((ep) => {
                                const epKey = `ep${ep}`;
                                return <Line key={epKey} type="monotone" dataKey={epKey} name={`第${ep}集`} dot={false} strokeWidth={2.5} stroke={compareColors[epKey]} activeDot={{ r: 4 }} />;
                              })}

                              {markPeak ? (
                                (comparePeaks as any[]).map((p) => (
                                  <ReferenceDot key={p.epKey} x={p.minute} y={p.value} r={4} fill={compareColors[p.epKey]} stroke="white" label={{ value: `峰值@${p.minute}m`, position: "top", fontSize: 12 }} />
                                ))
                              ) : null}
                            </RLineChart>
                          </ResponsiveContainer>
                        ) : (
                          <EmptyState title="缺少对比曲线表" desc="请确保对比集数都上传了 danmaku_minute_*_curve_ep*.csv（或 zip）。" />
                        )
                      ) : (curveData as any[]).length ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <RLineChart data={curveData as any[]} margin={{ top: 10, right: 12, left: 0, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="minute" tick={{ fontSize: 12 }} />
                            <YAxis />
                            <Tooltip />
                            <Legend />

                            {markIntervals && (intervalsSingle as any[]).length ? (intervalsSingle as any[]).map((it, idx) => <ReferenceArea key={idx} x1={it.start} x2={it.end} fill={colorForKey(intervalSeriesKey, curveMode)} fillOpacity={0.10} strokeOpacity={0} />) : null}

                            {curveSeriesKeys.slice(0, 10).map((k) => (
                              <Line key={k} type="monotone" dataKey={k} dot={false} strokeWidth={2.5} stroke={colorForKey(k, curveMode)} activeDot={{ r: 4 }} />
                            ))}

                            {markPeak && intervalSeriesKey ? (() => {
                              const peak = computePeak(curveData as any[], intervalSeriesKey);
                              if (!peak) return null;
                              return (
                                <>
                                  <ReferenceLine x={peak.minute} stroke="#94a3b8" strokeDasharray="4 4" />
                                  <ReferenceDot x={peak.minute} y={peak.value} r={4} fill={colorForKey(intervalSeriesKey, curveMode)} stroke="white" label={{ value: `峰值@${peak.minute}m`, position: "top", fontSize: 12 }} />
                                </>
                              );
                            })() : null}
                          </RLineChart>
                        </ResponsiveContainer>
                      ) : (
                        <EmptyState title="缺少 minute 曲线表" desc={`请上传 danmaku_minute_${curveMode}_curve_ep*.csv（或 zip）。`} />
                      )}
                    </div>

                    {!compareMode ? (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                        <div className="text-sm font-medium mb-2">Top 区间（{intervalSeriesKey}，窗口={intervalWindow}分钟）</div>
                        {(intervalsSingle as any[]).length ? (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            {(intervalsSingle as any[]).map((it, i) => (
                              <div key={i} className="rounded-xl border border-slate-200 p-3">
                                <div className="text-sm font-semibold">区间 {i + 1}: {it.start}m–{it.end}m</div>
                                <div className="text-xs text-slate-500 mt-1">强度：{it.score.toFixed(2)}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-slate-500">暂无（可能缺少该维度列，或数据较少）。</div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                        <div className="text-sm font-medium mb-2">多集摘要（峰值 & Top区间）</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {compareEps.map((ep) => {
                            const epKey = `ep${ep}`;
                            const p = (comparePeaks as any[]).find((x) => x.epKey === epKey);
                            const ints = (intervalsCompare as any)[epKey] ?? [];
                            return (
                              <div key={ep} className="rounded-xl border border-slate-200 p-3">
                                <div className="text-sm font-semibold">第{ep}集</div>
                                <div className="text-xs text-slate-500 mt-1">峰值：@{p?.minute ?? "—"}m</div>
                                <div className="text-xs text-slate-500 mt-1">Top区间：{ints.slice(0, 3).map((it: any) => `${it.start}–${it.end}m`).join("、") || "—"}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="tables" className="mt-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>2秒窗刷屏句（Top）</CardTitle>
                      <CardDescription>展示同时间窗内重复句的强度（cnt）。</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 mb-3">
                        <Input placeholder="搜索刷屏句…" value={searchBurst} onChange={(e) => setSearchBurst(e.target.value)} />
                      </div>
                      <Separator className="my-2" />
                      {burstRows.length ? (
                        <ScrollArea className="h-[360px] pr-1">
                          <div className="space-y-2">
                            {burstRows.map((r, idx) => (
                              <div key={idx} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate">{r.norm_content}</div>
                                  <div className="text-xs text-slate-500">sec_bin={r.sec_bin * 2}s ~ {r.sec_bin * 2 + 2}s</div>
                                </div>
                                <Badge>{r.cnt}</Badge>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <EmptyState title="缺少刷屏表" desc="请上传 danmaku_burst_2s_ep*.csv（或 zip）。" />
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>高频词粗看（支撑 3.2.1 词表来源）</CardTitle>
                      <CardDescription>弹幕/评论切换 + 搜索；用于归纳情绪词/身份词/仪式词。</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <Switch checked={showComments} onCheckedChange={setShowComments} />
                          <Label>显示评论（关=弹幕）</Label>
                        </div>
                        <Input className="w-52" placeholder="搜索词项…" value={searchTerms} onChange={(e) => setSearchTerms(e.target.value)} />
                      </div>
                      <Separator className="my-2" />
                      {(showComments ? termsComment : termsDanmu).length ? (
                        <ScrollArea className="h-[360px] pr-1">
                          <div className="space-y-2">
                            {filteredTerms.map((r, idx) => (
                              <div key={idx} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                                <div className="text-sm font-medium">{r.term}</div>
                                <Badge>{r.cnt}</Badge>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <EmptyState title="缺少高频词表" desc="请上传 ep*_top_terms_danmaku.csv / ep*_top_terms_comment.csv（或 zip）。" />
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle>本集已识别的表</CardTitle>
                    <CardDescription>用于排查缺哪个文件导致某些图表为空。</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(tables).length ? (
                        Object.keys(tables).map((k) => (
                          <Badge key={k}>
                            <FileText className="h-3 w-3 mr-1" />
                            {niceKey(k)} ({(tables as any)[k]?.length ?? 0})
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500">暂无表格被识别到</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="report" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>图注 & 结论句（自动生成）</CardTitle>
                    <CardDescription>自动输出“图注 + 数据概况 + 可改写的结论句式”，并支持下载 md 与一键导出图包。</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button onClick={buildReport}><Wand2 className="h-4 w-4" />生成图注&结论</Button>
                      <Button variant="secondary" disabled={!reportText} onClick={() => downloadText(reportTitle || `report_${Date.now()}.md`, reportText, "text/markdown;charset=utf-8")}>
                        <Download className="h-4 w-4" />下载 Markdown
                      </Button>
                      <Button variant="secondary" onClick={exportPack} disabled={!ready}><FileDown className="h-4 w-4" />一键导出图包（含报告）</Button>
                    </div>

                    <Separator className="my-4" />

                    {reportText ? (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="text-sm font-medium mb-2">预览（可复制）</div>
                          <pre className="text-xs whitespace-pre-wrap leading-relaxed">{reportText}</pre>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="text-sm font-medium mb-2">写作建议</div>
                          <ul className="text-sm text-slate-600 list-disc pl-5 space-y-1">
                            <li>把“Top区间”对应到剧情段落（你已有剧情功能说明），形成“定量→质性”的闭环。</li>
                            <li>多集对比时，优先用开篇/日常/高能三类集数；用堆叠图证明结构差异，再用曲线证明时间分布差异。</li>
                            <li>报告为自动生成，你可把术语替换为论文话语：如“仪式性互动”“共情弹幕”“群体身份指称”等。</li>
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <EmptyState title="还没生成报告" desc="点击“生成图注&结论”，会基于当前选择的集数/维度自动生成可粘贴文本。" />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
