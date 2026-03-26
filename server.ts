import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", platform: "QR Boraj Quantum" });
  });

  // Mock WooCommerce Integration Endpoint
  app.post("/api/wc/webhook", (req, res) => {
    console.log("WooCommerce Webhook Received:", req.body);
    res.status(200).send("Webhook Processed");
  });

  // OTP Endpoints
  const otps = new Map<string, { code: string, expires: number }>();

  app.post("/api/auth/send-otp", (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

    otps.set(email, { code, expires });

    // In a real app, use a service like SendGrid or Nodemailer here
    console.log(`[AUTH] OTP for ${email}: ${code}`);
    
    res.json({ message: "OTP sent successfully (Check server logs in demo)" });
  });

  app.post("/api/auth/verify-otp", (req, res) => {
    const { email, code } = req.body;
    const record = otps.get(email);

    if (!record) return res.status(400).json({ error: "No OTP found for this email" });
    if (Date.now() > record.expires) {
      otps.delete(email);
      return res.status(400).json({ error: "OTP expired" });
    }
    if (record.code !== code) return res.status(400).json({ error: "Invalid OTP code" });

    otps.delete(email);
    res.json({ success: true, message: "OTP verified" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
