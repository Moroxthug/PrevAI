let app;
try {
  const mod = await import("../artifacts/api-server/dist/app.mjs");
  app = mod.default;
} catch (err) {
  // Surface the startup error as an HTTP response instead of crashing silently
  app = (_req, res) => {
    res.status(500).json({ error: "Startup failed", detail: err?.message ?? String(err) });
  };
}

export default app;
