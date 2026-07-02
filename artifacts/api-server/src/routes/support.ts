import { Router, type Request, type Response, type NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
import { db, conversations, messages, settingsTable } from "@workspace/db";
import { eq, desc, asc } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

// Helper to check if user is admin
async function isAdmin(req: Request): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.admin_email;
  if (!adminEmail) return false;
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) return false;
    const cleanEmailStr = adminEmail.replace(/['"]/g, "");
    const emails = cleanEmailStr.split(",").map(e => e.trim().toLowerCase());
    return emails.includes(session.user.email.toLowerCase());
  } catch (err) {
    logger.error({ err }, "isAdmin check in support failed");
    return false;
  }
}

// Middleware to enforce admin access
async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ok = await isAdmin(req);
  if (!ok) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

// --- Admin status endpoints ---

router.get("/support/admin-status", async (_req, res) => {
  try {
    const [row] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, "admin_online"));
    const online = row ? row.value === "true" : false;
    res.json({ online });
  } catch (err) {
    logger.error({ err }, "Failed to get admin online status");
    res.json({ online: false });
  }
});

router.post("/support/admin-status", requireAdmin, async (req, res) => {
  try {
    const { online } = req.body;
    const value = online ? "true" : "false";

    await db
      .insert(settingsTable)
      .values({ key: "admin_online", value })
      .onConflictDoUpdate({
        target: settingsTable.key,
        set: { value },
      });

    res.json({ success: true, online });
  } catch (err) {
    logger.error({ err }, "Failed to update admin online status");
    res.status(500).json({ error: "Failed to update admin online status" });
  }
});

// --- Conversations endpoints ---

// Start conversation (Visitor)
router.post("/support/conversations", async (req, res) => {
  try {
    const { visitorName, visitorEmail, visitorPhone } = req.body;
    const dateStr = new Date().toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const [newConv] = await db
      .insert(conversations)
      .values({
        title: `Chat ${visitorName || "Visitatore"} (${dateStr})`,
        visitorName: visitorName || null,
        visitorEmail: visitorEmail || null,
        visitorPhone: visitorPhone || null,
        status: "ai",
      })
      .returning();

    res.json(newConv);
  } catch (err) {
    logger.error({ err }, "Failed to start support conversation");
    res.status(500).json({ error: "Failed to start support conversation" });
  }
});

// List conversations (Admin only)
router.get("/support/conversations", requireAdmin, async (_req, res) => {
  try {
    const list = await db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.updatedAt));
    res.json(list);
  } catch (err) {
    logger.error({ err }, "Failed to list conversations");
    res.status(500).json({ error: "Failed to list conversations" });
  }
});

// Get messages (Visitor or Admin)
router.get("/support/conversations/:id/messages", async (req, res) => {
  try {
    const convId = parseInt(req.params.id);
    if (isNaN(convId)) {
      res.status(400).json({ error: "Invalid conversation ID" });
      return;
    }

    const messagesList = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, convId))
      .orderBy(asc(messages.createdAt));

    res.json(messagesList);
  } catch (err) {
    logger.error({ err }, "Failed to get messages");
    res.status(500).json({ error: "Failed to get messages" });
  }
});

// Send message
router.post("/support/conversations/:id/messages", async (req, res) => {
  try {
    const convId = parseInt(req.params.id);
    if (isNaN(convId)) {
      res.status(400).json({ error: "Invalid conversation ID" });
      return;
    }

    const { role, content } = req.body;
    if (!content || !role) {
      res.status(400).json({ error: "Role and content are required" });
      return;
    }

    // 1. Fetch current conversation to check status
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, convId));

    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    // 2. Insert the sender's message
    const [userMsg] = await db
      .insert(messages)
      .values({
        conversationId: convId,
        role,
        content,
      })
      .returning();

    // Update the conversation's updatedAt timestamp
    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, convId));

    // 3. If sent by user and status is 'ai', trigger AI response
    if (role === "user" && conv.status === "ai") {
      // Check if user is asking for a human agent explicitly
      const humanKeywords = ["operatore", "umano", "parlare con qualcuno", "persona", "assistenza umana", "human", "agent", "supporto umano", "aiuto reale"];
      const requestHuman = humanKeywords.some(k => content.toLowerCase().includes(k));

      if (requestHuman) {
        // Change conversation status to human_needed
        await db
          .update(conversations)
          .set({ status: "human_needed" })
          .where(eq(conversations.id, convId));

        // Insert notification message from system/assistant
        const [systemMsg] = await db
          .insert(messages)
          .values({
            conversationId: convId,
            role: "assistant",
            content: "Ho inoltrato la tua richiesta per parlare con un operatore umano. Non appena un operatore sarà online ti risponderà qui.",
          })
          .returning();

        res.json({ userMessage: userMsg, aiMessage: systemMsg, status: "human_needed" });
        return;
      }

      // Otherwise generate AI response using OpenAI (mapped to Groq)
      try {
        // Get chat history for context
        const history = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, convId))
          .orderBy(asc(messages.createdAt));

        const formattedMessages = [
          {
            role: "system" as const,
            content: "Sei l'assistente AI di supporto di PrevAI. PrevAI è una piattaforma web all'avanguardia per artigiani e imprese edili in Italia per creare preventivi e computi metrici dettagliati partendo da descrizioni testuali. Rispondi in modo gentile, professionale e conciso in italiano. Se l'utente chiede esplicitamente di parlare con un operatore, con una persona, o se fa domande complesse su pagamenti, account o bug tecnici, digli che può richiedere un operatore umano cliccando sul pulsante nella chat, o che se scrive 'parla con operatore' provvederai a metterlo in attesa per l'intervento umano.",
          },
          ...history.map(m => ({
            role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
            content: m.content,
          })),
        ];

        const aiResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini", // Auto-mapped to llama-3.3-70b-versatile
          messages: formattedMessages,
          max_tokens: 350,
          temperature: 0.7,
        });

        const aiContent = aiResponse.choices[0]?.message?.content || "Siamo spiacenti, si è verificato un errore nella risposta.";

        const [aiMsg] = await db
          .insert(messages)
          .values({
            conversationId: convId,
            role: "assistant",
            content: aiContent,
          })
          .returning();

        res.json({ userMessage: userMsg, aiMessage: aiMsg, status: "ai" });
      } catch (aiErr) {
        logger.error({ err: aiErr }, "Failed to generate support bot response");
        const [fallbackMsg] = await db
          .insert(messages)
          .values({
            conversationId: convId,
            role: "assistant",
            content: "Al momento ho qualche difficoltà a rispondere. Se hai bisogno di assistenza immediata puoi richiedere il supporto di un operatore umano cliccando sul tasto in alto.",
          })
          .returning();
        res.json({ userMessage: userMsg, aiMessage: fallbackMsg, status: "ai" });
      }
    } else {
      // Conversation status is already human_needed, human_active, closed, or admin is posting
      let newStatus = conv.status;
      if (role === "admin" && conv.status !== "human_active") {
        newStatus = "human_active";
        await db
          .update(conversations)
          .set({ status: "human_active" })
          .where(eq(conversations.id, convId));
      }
      res.json({ userMessage: userMsg, status: newStatus });
    }
  } catch (err) {
    logger.error({ err }, "Failed to send message");
    res.status(500).json({ error: "Failed to send message" });
  }
});

// Request Human
router.post("/support/conversations/:id/request-human", async (req, res) => {
  try {
    const convId = parseInt(req.params.id);
    if (isNaN(convId)) {
      res.status(400).json({ error: "Invalid conversation ID" });
      return;
    }

    await db
      .update(conversations)
      .set({ status: "human_needed", updatedAt: new Date() })
      .where(eq(conversations.id, convId));

    const [systemMsg] = await db
      .insert(messages)
      .values({
        conversationId: convId,
        role: "assistant",
        content: "Richiesta operatore umano inoltrata. Rimani in attesa, un operatore si collegherà appena possibile.",
      })
      .returning();

    res.json({ success: true, systemMessage: systemMsg });
  } catch (err) {
    logger.error({ err }, "Failed to request human support");
    res.status(500).json({ error: "Failed to request human support" });
  }
});

// Join conversation (Admin only)
router.post("/support/conversations/:id/join", requireAdmin, async (req, res) => {
  try {
    const convId = parseInt(req.params.id);
    if (isNaN(convId)) {
      res.status(400).json({ error: "Invalid conversation ID" });
      return;
    }

    await db
      .update(conversations)
      .set({ status: "human_active", updatedAt: new Date() })
      .where(eq(conversations.id, convId));

    const [systemMsg] = await db
      .insert(messages)
      .values({
        conversationId: convId,
        role: "assistant",
        content: "Un operatore di PrevAI è entrato in chat e prenderà in carico la tua richiesta.",
      })
      .returning();

    res.json({ success: true, systemMessage: systemMsg });
  } catch (err) {
    logger.error({ err }, "Failed to join support conversation");
    res.status(500).json({ error: "Failed to join support conversation" });
  }
});

// Close conversation
router.post("/support/conversations/:id/close", async (req, res) => {
  try {
    const convId = parseInt(req.params.id);
    if (isNaN(convId)) {
      res.status(400).json({ error: "Invalid conversation ID" });
      return;
    }

    await db
      .update(conversations)
      .set({ status: "closed", updatedAt: new Date() })
      .where(eq(conversations.id, convId));

    const [systemMsg] = await db
      .insert(messages)
      .values({
        conversationId: convId,
        role: "assistant",
        content: "La sessione di chat è stata chiusa. Grazie per averci contattato!",
      })
      .returning();

    res.json({ success: true, systemMessage: systemMsg });
  } catch (err) {
    logger.error({ err }, "Failed to close support conversation");
    res.status(500).json({ error: "Failed to close support conversation" });
  }
});

export default router;
