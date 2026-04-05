import { describe, it, expect } from "vitest";
import app from "../api.js";
import { PLAYGROUND_HTML } from "../playground.js";

describe("GET /playground", () => {
  const env = { DB: {} as unknown, API_KEYS: {} as unknown, SESSIONS: {} as unknown };

  it("returns 200 with text/html content type", async () => {
    const res = await app.request("http://localhost/playground", {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
  });

  it("does not require authentication", async () => {
    const res = await app.request("http://localhost/playground", {}, env);
    expect(res.status).toBe(200);
  });

  it("contains the expected section headings", async () => {
    const html = await (await app.request("http://localhost/playground", {}, env)).text();
    expect(html).toContain("<h2>Models</h2>");
    expect(html).toContain("<h2>Recommendations</h2>");
    expect(html).toContain("<h2>Transformations</h2>");
  });

  it("references real REST endpoints that exist on the API", async () => {
    expect(PLAYGROUND_HTML).toContain("/v1/search");
    expect(PLAYGROUND_HTML).toContain("/v1/recommend");
    expect(PLAYGROUND_HTML).toContain("/v1/transformations/");
  });

  it("includes localStorage persistence for the API key", () => {
    expect(PLAYGROUND_HTML).toContain("localStorage.getItem");
    expect(PLAYGROUND_HTML).toContain("localStorage.setItem");
  });

  it("links to the OpenAPI spec and health endpoint", () => {
    expect(PLAYGROUND_HTML).toContain("/openapi.json");
    expect(PLAYGROUND_HTML).toContain("/health");
  });
});
