import { Router } from "express";
import { requireAuth, getUserId } from "../middlewares/authMiddleware.js";
import { weatherToday } from "../weather/today.js";

// ── Pocket 129: weather for job sites (docs/pocket-design/handoff/WEATHER.md) ───────────────────
// GET /api/v1/weather/today — the sites with a visit today (up to 4, busiest first; the company's town when nothing is scheduled),
// each with now, the hours, seven days and the words for the day as keys the app turns into Italian. Each place is asked of the
// weather source once every 30 minutes. Any signed-in person of the company may read it. (QuoteAI also takes ?lang=en|fr; PrevAI is Italian only.)

const router = Router();

router.get("/v1/weather/today", requireAuth, async (req, res) => {
  try {
    const out = await weatherToday({ userId: getUserId(res) });
    res.setHeader("Cache-Control", "private, max-age=300");
    res.json(out);
  } catch (err) {
    req.log.error({ err }, "Error loading the weather");
    res.status(502).json({ error: "WEATHER_UNAVAILABLE", message: "Il meteo non è disponibile in questo momento." });
  }
});

export default router;
