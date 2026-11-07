export interface HeroResponse {
  status: number;
  statusText: string;
  timingMs: number;
  /** Pretty-printed response body. */
  body: string;
}

/** Public, key-less endpoint the hero demo calls through the existing proxy. */
export const HERO_DEMO_URL = "https://jsonplaceholder.typicode.com/users/1";

/** Recorded from a real call to HERO_DEMO_URL; shown on timeout, offline or failure. */
export const FALLBACK_RESPONSE: HeroResponse = {
  status: 200,
  statusText: "OK",
  timingMs: 142,
  body: JSON.stringify(
    {
      id: 1,
      name: "Leanne Graham",
      username: "Bret",
      email: "Sincere@april.biz",
      address: { city: "Gwenborough", zipcode: "92998-3874" },
      company: { name: "Romaguera-Crona" },
    },
    null,
    2,
  ),
};
