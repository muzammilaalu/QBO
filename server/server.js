import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import session from "express-session";
import sessionFileStore from "session-file-store";
import connectDB from './src/config/database.js';

import authRoutes from "./src/routes/auth.routes.js";
import allocationRoutes from "./src/routes/allocation.routes.js";

await connectDB();
dotenv.config();

const app = express();
const FileStore = sessionFileStore(session);

app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL,
      'https://unartistic-extroversively-cornell.ngrok-free.dev',
    ],
    credentials: true,
  })
);

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: new FileStore({
      path: './sessions',
      ttl: 86400,
      retries: 1,
    }),
    cookie: {
      secure: false,        // ← false rakho (ngrok HTTP internally)
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',      // ← Yeh add karo
    },
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/allocation", allocationRoutes);

app.get("/health", (req, res) => res.json({ status: "OK" }));

const PORT = process.env.PORT || 7002;

app.listen(PORT, () =>
  console.log(`✅ Server running on port ${PORT}`)
);