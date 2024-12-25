import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import cors from 'cors';
import { createServer } from 'http';

const app = express();
const server = createServer(app);

// Enable CORS for all routes
app.use(cors({
  origin: true,
  credentials: true
}));

// Parse JSON for all routes except Stripe webhook
app.use((req, res, next) => {
  if (req.originalUrl === '/api/stripe/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});
app.use(express.urlencoded({ extended: false }));

// Add request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  console.log('Environment variables check:');
  console.log('- VITE_STRIPE_PUBLIC_KEY exists:', !!process.env.VITE_STRIPE_PUBLIC_KEY);
  console.log('- STRIPE_SECRET_KEY exists:', !!process.env.STRIPE_SECRET_KEY);
  console.log('- DOCUMO_API_KEY exists:', !!process.env.DOCUMO_API_KEY);

  // Register API routes before Vite middleware
  registerRoutes(app);

  // Setup Vite and static file serving for non-API routes
  if (process.env.NODE_ENV === 'development') {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Get port from environment variable or use 3000 as fallback
  const port = parseInt(process.env.PORT || '3000', 10);
  
  // In Replit, we need to listen on 0.0.0.0
  server.listen(port, () => {
    console.log(`Server running at http://0.0.0.0:${port}`);
    if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
      console.log(`Replit URL: https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`);
    }
  });
})();
