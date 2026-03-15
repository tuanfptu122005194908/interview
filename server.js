import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from dist directory with correct MIME types
app.use((req, res, next) => {
  // Set MIME types for static assets
  if (req.path.endsWith(".css")) {
    res.setHeader("Content-Type", "text/css; charset=utf-8");
  } else if (req.path.endsWith(".js")) {
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  } else if (req.path.endsWith(".json")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
  }
  next();
});

// Serve static files
app.use(
  express.static(join(__dirname, "dist"), {
    maxAge: "1d",
    etag: false,
  }),
);

// SPA fallback - serve index.html for all routes not matching static files
app.get("*", (req, res) => {
  const indexPath = join(__dirname, "dist", "index.html");

  if (fs.existsSync(indexPath)) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(indexPath);
  } else {
    res
      .status(404)
      .send('Index file not found. Make sure to run "npm run build" first.');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Serving files from: ${join(__dirname, "dist")}`);
});
