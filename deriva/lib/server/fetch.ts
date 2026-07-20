type Circuit = { failures: number; openUntil: number };

const circuits = new Map<string, Circuit>();

export type FetchPolicy = {
  timeoutMs?: number;
  retries?: number;
  cacheTtlSeconds?: number;
  headers?: Record<string, string>;
};

export async function fetchWithPolicy(url: string, policy: FetchPolicy = {}): Promise<Response> {
  const host = new URL(url).hostname;
  const circuit = circuits.get(host);
  if (circuit && circuit.openUntil > Date.now()) throw new Error(`circuit-open:${host}`);

  const retries = policy.retries ?? 1;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), policy.timeoutMs ?? 5200);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json, application/xml, text/xml, application/rss+xml, application/atom+xml;q=0.9, */*;q=0.2",
          "User-Agent": "deriva/2.0 (+https://deriva.oaiusercontent.com)",
          ...policy.headers,
        },
        cf: { cacheTtl: policy.cacheTtlSeconds ?? 900, cacheEverything: true },
      } as RequestInit & { cf: Record<string, unknown> });
      if (!response.ok) throw new Error(`http-${response.status}`);
      circuits.set(host, { failures: 0, openUntil: 0 });
      return response;
    } catch (error) {
      lastError = error;
      const previous = circuits.get(host)?.failures ?? 0;
      const failures = previous + 1;
      circuits.set(host, { failures, openUntil: failures >= 3 ? Date.now() + 5 * 60_000 : 0 });
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 180 * 2 ** attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("fetch-failed");
}

export async function fetchJson<T>(url: string, policy?: FetchPolicy): Promise<T> {
  return (await fetchWithPolicy(url, policy)).json() as Promise<T>;
}

export function resetCircuitsForTests(): void {
  circuits.clear();
}

