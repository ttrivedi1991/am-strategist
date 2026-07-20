// Single source of truth for WHICH Gemini model the app uses.
//
// Guarantees:
//   1. Version floor — never below Gemini 2.5 (FLOOR below).
//   2. Availability — the model is verified against the live API once per
//      day; when Google retires it (as happened to gemini-2.0-flash in July
//      2026), the resolver discovers the newest stable model that meets the
//      floor and switches automatically. No more silent 404 breakage.
//
// Every Gemini call site in the app must get its model name from
// ensureGeminiModel() — never hardcode a model string in a fetch URL.

const FLOOR: [major: number, minor: number] = [2, 5];
const DEFAULT_MODEL = "gemini-2.5-flash";
const CACHE_KEY = "geminiModel:v1";
const VERIFY_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const BASE = "https://generativelanguage.googleapis.com/v1beta";

function versionOf(name: string): [number, number] | null {
  const m = name.match(/gemini-(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

function meetsFloor(name: string): boolean {
  const v = versionOf(name);
  return !!v && (v[0] > FLOOR[0] || (v[0] === FLOOR[0] && v[1] >= FLOOR[1]));
}

function readCache(): { model: string; verifiedAt: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(model: string) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ model, verifiedAt: Date.now() }));
}

async function modelAvailable(apiKey: string, model: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/models/${model}?key=${apiKey}`);
    if (!res.ok) return false;
    const data = await res.json();
    return (data.supportedGenerationMethods ?? []).includes("generateContent");
  } catch {
    return false;
  }
}

// Newest stable model meeting the floor. Prefers flash (fast, cheap) over
// pro, higher versions over lower, and stable names over preview/exp builds.
async function discoverModel(apiKey: string): Promise<string> {
  try {
    const res = await fetch(`${BASE}/models?pageSize=200&key=${apiKey}`);
    if (!res.ok) return DEFAULT_MODEL;
    const data = await res.json();
    const candidates = (data.models ?? [])
      .map((m: any) => ({
        name: String(m.name ?? "").replace(/^models\//, ""),
        methods: m.supportedGenerationMethods ?? [],
      }))
      .filter((m: any) =>
        m.name.startsWith("gemini-") &&
        m.methods.includes("generateContent") &&
        meetsFloor(m.name) &&
        !/preview|exp|latest|thinking|image|tts|audio|live/.test(m.name)
      )
      .map((m: any) => {
        const [maj, min] = versionOf(m.name)!;
        const isFlash = m.name.includes("flash");
        // version dominates; flash beats pro at the same version; shorter
        // names beat suffixed variants (gemini-2.5-flash > gemini-2.5-flash-001)
        return { name: m.name, score: (maj * 100 + min) * 1000 + (isFlash ? 100 : 0) - m.name.length };
      })
      .sort((a: any, b: any) => b.score - a.score);
    return candidates[0]?.name ?? DEFAULT_MODEL;
  } catch {
    return DEFAULT_MODEL;
  }
}

// The one entry point. Returns a model name that meets the version floor and
// was verified available within the last 24 hours.
export async function ensureGeminiModel(apiKey: string): Promise<string> {
  const cached = readCache();
  if (cached && meetsFloor(cached.model) && Date.now() - cached.verifiedAt < VERIFY_MAX_AGE_MS) {
    return cached.model;
  }
  const candidate = cached && meetsFloor(cached.model) ? cached.model : DEFAULT_MODEL;
  if (await modelAvailable(apiKey, candidate)) {
    writeCache(candidate);
    return candidate;
  }
  const discovered = await discoverModel(apiKey);
  writeCache(discovered);
  return discovered;
}
