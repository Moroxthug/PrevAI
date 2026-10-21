import { createVerify, generateKeyPairSync } from "node:crypto";
import { provinceCity, siteFor } from "./geo.js";
import { describe, expect, it } from "vitest";
import { chanceOf, conditionOfSymbol, forecastFrom as metForecast } from "./metno.js";
import { clearForecastCache, forecastCached, getProvider } from "./provider.js";
import { conditionOf, forecastFrom as kitForecast, precipTypeOf, weatherKitToken } from "./weatherkit.js";
import type { Forecast, WeatherProvider } from "./types.js";

const TZ = "Europe/Rome";

describe("WeatherKit", () => {
  it("signs an ES256 token Apple can verify", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const token = weatherKitToken({ teamId: "TEAM123456", serviceId: "it.prevai.weather", keyId: "KEY1234567", privateKey: pem }, 1_800_000_000);
    const [h, p, sig] = token.split(".");
    expect(JSON.parse(Buffer.from(h!, "base64url").toString())).toEqual({ alg: "ES256", kid: "KEY1234567", id: "TEAM123456.it.prevai.weather" });
    expect(JSON.parse(Buffer.from(p!, "base64url").toString())).toEqual({ iss: "TEAM123456", iat: 1_800_000_000, exp: 1_800_003_600, sub: "it.prevai.weather" });
    const ok = createVerify("SHA256").update(`${h}.${p}`).verify({ key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(sig!, "base64url"));
    expect(ok).toBe(true);
  });
  it("maps Apple's condition codes to the nine we draw", () => {
    expect(conditionOf("Clear")).toBe("clear");
    expect(conditionOf("MostlyClear")).toBe("partly_cloudy");
    expect(conditionOf("MostlyCloudy")).toBe("cloudy");
    expect(conditionOf("HeavyRain")).toBe("rain");
    expect(conditionOf("ScatteredShowers")).toBe("showers");
    expect(conditionOf("Snow")).toBe("snow");
    expect(conditionOf("FreezingRain")).toBe("sleet");
    expect(conditionOf("IsolatedThunderstorms")).toBe("thunder");
    expect(conditionOf("Haze")).toBe("fog");
    expect(precipTypeOf("clear")).toBe("none");
    expect(precipTypeOf("snow")).toBe("snow");
  });
  it("turns Apple's reply into hours on the hour, percent and local dates", () => {
    const f = kitForecast({
      currentWeather: { temperature: 11.6, conditionCode: "Cloudy" },
      forecastHourly: { hours: [{ forecastStart: "2026-09-29T11:00:00Z", temperature: 12.2, precipitationChance: 0.7, precipitationType: "rain" }] },
      forecastDaily: { days: [{ forecastStart: "2026-09-29T04:00:00Z", precipitationChance: 0.8, precipitationType: "rain" }] },
    }, TZ);
    expect(f.now).toEqual({ tempC: 12, condition: "cloudy" });
    expect(f.hourly[0]).toEqual({ hour: "2026-09-29T13:00:00+02:00", tempC: 12, precipProb: 70, precipType: "rain" });
    expect(f.daily7[0]).toEqual({ date: "2026-09-29", precipProb: 80, precipType: "rain" });
  });
});

describe("MET Norway", () => {
  it("maps its symbols to the nine we draw", () => {
    expect(conditionOfSymbol("clearsky_day")).toBe("clear");
    expect(conditionOfSymbol("fair_night")).toBe("partly_cloudy");
    expect(conditionOfSymbol("cloudy")).toBe("cloudy");
    expect(conditionOfSymbol("lightrainshowers_day")).toBe("showers");
    expect(conditionOfSymbol("heavyrain")).toBe("rain");
    expect(conditionOfSymbol("lightsleet")).toBe("sleet");
    expect(conditionOfSymbol("snow")).toBe("snow");
    expect(conditionOfSymbol("rainandthunder")).toBe("thunder");
    expect(conditionOfSymbol("fog")).toBe("fog");
    expect(conditionOfSymbol(undefined)).toBe("cloudy");
  });
  it("estimates the chance from the symbol and the millimetres an hour", () => {
    expect(chanceOf("none", 0, 1)).toBe(0);
    expect(chanceOf("none", 0.1, 1)).toBe(20);
    expect(chanceOf("rain", 0, 1)).toBe(35);
    expect(chanceOf("rain", 0.1, 1)).toBe(55);
    expect(chanceOf("rain", 1.8, 1)).toBe(90);
    expect(chanceOf("rain", 3, 6)).toBe(80);
  });
  it("builds the hours (to the company clock) and the days, the wettest period of each day", () => {
    const step = (time: string, temp: number, sym: string, mm: number, six = false) => ({ time, data: { instant: { details: { air_temperature: temp } }, ...(six ? { next_6_hours: { summary: { symbol_code: sym }, details: { precipitation_amount: mm } } } : { next_1_hours: { summary: { symbol_code: sym }, details: { precipitation_amount: mm } } }) } });
    const f = metForecast({ properties: { timeseries: [
      step("2026-09-29T07:00:00Z", 15.2, "cloudy", 0),
      step("2026-09-29T13:00:00Z", 16.6, "heavyrain", 1.8),
      step("2026-10-01T06:00:00Z", 10, "lightrain", 0.6, true),
    ] } }, TZ);
    expect(f.now).toEqual({ tempC: 15, condition: "cloudy" });
    expect(f.hourly).toEqual([
      { hour: "2026-09-29T09:00:00+02:00", tempC: 15, precipProb: 0, precipType: "none" },
      { hour: "2026-09-29T15:00:00+02:00", tempC: 17, precipProb: 90, precipType: "rain" },
    ]);
    expect(f.daily7).toEqual([{ date: "2026-09-29", precipProb: 90, precipType: "rain" }, { date: "2026-10-01", precipProb: 55, precipType: "rain" }]);
  });
});

describe("the provider and its 30-minute cache", () => {
  const f: Forecast = { now: { tempC: 1, condition: "clear" }, hourly: [], daily7: [] };
  const counting = () => { const p = { name: "mock" as const, calls: 0, fail: false, async forecast() { p.calls++; if (p.fail) throw new Error("down"); return f; } }; return p as typeof p & WeatherProvider; };
  it("asks once in half an hour, again after, and serves an old answer when the source is down", async () => {
    clearForecastCache();
    const p = counting();
    const t0 = 1_000_000_000_000;
    await forecastCached(p, 45.46, 9.19, TZ, t0);
    await forecastCached(p, 45.46, 9.19, TZ, t0 + 29 * 60_000);
    expect(p.calls).toBe(1);
    await forecastCached(p, 45.46, 9.19, TZ, t0 + 31 * 60_000);
    expect(p.calls).toBe(2);
    p.fail = true;
    await expect(forecastCached(p, 45.46, 9.19, TZ, t0 + 90 * 60_000)).resolves.toBe(f);
    await expect(forecastCached(p, 45.46, 9.19, TZ, t0 + 8 * 3_600_000)).rejects.toThrow("down");
  });
  it("picks WeatherKit only with all four credentials, else MET Norway, and the mock only by name", () => {
    expect(getProvider({} as NodeJS.ProcessEnv).name).toBe("metno");
    expect(getProvider({ WEATHER_PROVIDER: "mock" } as NodeJS.ProcessEnv).name).toBe("mock");
    expect(getProvider({ WEATHERKIT_TEAM_ID: "a", WEATHERKIT_SERVICE_ID: "b", WEATHERKIT_KEY_ID: "c" } as NodeJS.ProcessEnv).name).toBe("metno");
    expect(getProvider({ WEATHERKIT_TEAM_ID: "a", WEATHERKIT_SERVICE_ID: "b", WEATHERKIT_KEY_ID: "c", WEATHERKIT_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----" } as NodeJS.ProcessEnv).name).toBe("weatherkit");
  });
});

describe("where a company or a site is", () => {
  it("a province without an address gets its capoluogo", () => {
    expect(provinceCity("MI")?.name).toBe("Milano");
    expect(provinceCity("milano")?.name).toBe("Milano");
    expect(provinceCity("FC")?.name).toBe("Forlì");
    expect(provinceCity(null)).toBeNull();
    expect(provinceCity("ZZ")).toBeNull();
  });
  it("the town named last in the address wins, within the province when it is known", () => {
    expect(siteFor("Via Roma 12, 47521 Cesena", "FC")?.name).toBe("Cesena");
    expect(siteFor("Via Milano 3, Bergamo", null)?.name).toBe("Bergamo");
    expect(siteFor("Via Roma 5", "MI")?.name).toBe("Milano");
    expect(siteFor("Viale Monza 40, Monza", null)?.prov).toBe("MB");
    expect(siteFor("Piazza Duomo 1, 20099 Sesto San Giovanni (MI)", null)?.name).toBe("Milano");
    expect(siteFor("Via Garibaldi 2, Reggio Emilia", null)?.prov).toBe("RE");
    expect(siteFor(null, null, "Forlì")?.prov).toBe("FC");
    expect(siteFor("Strada senza nome", null)).toBeNull();
  });
});
