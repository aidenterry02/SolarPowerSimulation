export interface UrlDemoState {
  lat?: number;
  lon?: number;
  address?: string;
  portion?: number;
  monthlyKwh?: number;
  costPerWatt?: number;
  itc?: number;
  nm?: string;
  step?: number;
}

export function readUrlState(): UrlDemoState {
  const p = new URLSearchParams(window.location.search);
  const num = (k: string) => {
    const v = p.get(k);
    if (v == null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    lat: num("lat"),
    lon: num("lon"),
    address: p.get("address") ?? undefined,
    portion: num("portion"),
    monthlyKwh: num("kwh"),
    costPerWatt: num("cpw"),
    itc: num("itc"),
    nm: p.get("nm") ?? undefined,
    step: num("step"),
  };
}

export function writeUrlState(state: UrlDemoState): void {
  const p = new URLSearchParams();
  const set = (k: string, v: string | number | undefined) => {
    if (v === undefined || v === "") return;
    p.set(k, String(v));
  };
  set("lat", state.lat);
  set("lon", state.lon);
  set("address", state.address);
  set("portion", state.portion);
  set("kwh", state.monthlyKwh);
  set("cpw", state.costPerWatt);
  set("itc", state.itc);
  set("nm", state.nm);
  set("step", state.step);

  const qs = p.toString();
  const url = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
  window.history.replaceState({}, "", url);
}

export function shareUrl(state: UrlDemoState): string {
  const u = new URL(window.location.href);
  // rebuild clean
  u.search = "";
  const p = u.searchParams;
  if (state.lat != null) p.set("lat", String(state.lat));
  if (state.lon != null) p.set("lon", String(state.lon));
  if (state.address) p.set("address", state.address);
  if (state.portion != null) p.set("portion", String(state.portion));
  if (state.monthlyKwh != null) p.set("kwh", String(state.monthlyKwh));
  if (state.costPerWatt != null) p.set("cpw", String(state.costPerWatt));
  if (state.itc != null) p.set("itc", String(state.itc));
  if (state.nm) p.set("nm", state.nm);
  return u.toString();
}
