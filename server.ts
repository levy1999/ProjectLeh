import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("bills.db");

// Initialize database
db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_name TEXT NOT NULL,
      amount REAL NOT NULL,
      quantity INTEGER DEFAULT 1,
      session_date TEXT,
      session_time TEXT,
      session_type TEXT,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      patient_phone TEXT,
      schedule_days TEXT,
      schedule_times TEXT,
      weekly_schedule TEXT,
      frequency TEXT DEFAULT 'weekly',
      start_date TEXT,
      photo_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      phone TEXT,
      absences INTEGER DEFAULT 0,
      default_amount REAL DEFAULT 0,
      default_session_type TEXT DEFAULT 'Particular',
      schedule_days TEXT,
      schedule_times TEXT,
      weekly_schedule TEXT,
      frequency TEXT DEFAULT 'weekly',
      start_date TEXT,
      photo_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

// Migration: Add new columns if they don't exist
try {
  db.prepare("SELECT default_amount FROM patients LIMIT 1").get();
} catch (e) {
  try { db.exec("ALTER TABLE patients ADD COLUMN default_amount REAL DEFAULT 0"); } catch (err) {}
}

try {
  db.prepare("SELECT default_session_type FROM patients LIMIT 1").get();
} catch (e) {
  try { db.exec("ALTER TABLE patients ADD COLUMN default_session_type TEXT DEFAULT 'Particular'"); } catch (err) {}
}

// Migration: Check if we need to migrate from old 'bills' table or just start fresh
// Since it's a transformation, I'll keep the API endpoints similar but update the table name and fields
try {
  db.prepare("SELECT patient_phone FROM sessions LIMIT 1").get();
} catch (e) {
  try { db.exec("ALTER TABLE sessions ADD COLUMN patient_phone TEXT"); } catch (err) {}
}

try {
  db.prepare("SELECT quantity FROM sessions LIMIT 1").get();
} catch (e) {
  try { db.exec("ALTER TABLE sessions ADD COLUMN quantity INTEGER DEFAULT 1"); } catch (err) {}
}

try {
  db.prepare("SELECT session_type FROM sessions LIMIT 1").get();
} catch (e) {
  try { db.exec("ALTER TABLE sessions ADD COLUMN session_type TEXT DEFAULT 'Particular'"); } catch (err) {}
}

try {
  db.prepare("SELECT session_time FROM sessions LIMIT 1").get();
} catch (e) {
  try { db.exec("ALTER TABLE sessions ADD COLUMN session_time TEXT"); } catch (err) {}
}

try {
  db.prepare("SELECT schedule_days FROM sessions LIMIT 1").get();
} catch (e) {
  try { db.exec("ALTER TABLE sessions ADD COLUMN schedule_days TEXT"); } catch (err) {}
}

try {
  db.prepare("SELECT schedule_times FROM sessions LIMIT 1").get();
} catch (e) {
  try { db.exec("ALTER TABLE sessions ADD COLUMN schedule_times TEXT"); } catch (err) {}
}

try {
  db.prepare("SELECT schedule_days FROM patients LIMIT 1").get();
} catch (e) {
  try { db.exec("ALTER TABLE patients ADD COLUMN schedule_days TEXT"); } catch (err) {}
}

try {
  db.prepare("SELECT schedule_times FROM patients LIMIT 1").get();
} catch (e) {
  try { db.exec("ALTER TABLE patients ADD COLUMN schedule_times TEXT"); } catch (err) {}
}

try {
  db.prepare("SELECT weekly_schedule FROM sessions LIMIT 1").get();
} catch (e) {
  try { db.exec("ALTER TABLE sessions ADD COLUMN weekly_schedule TEXT"); } catch (err) {}
}

try {
  db.prepare("SELECT weekly_schedule FROM patients LIMIT 1").get();
} catch (e) {
  try { db.exec("ALTER TABLE patients ADD COLUMN weekly_schedule TEXT"); } catch (err) {}
}

// Migration: Delete specific session requested by user
try {
  db.prepare("DELETE FROM sessions WHERE session_date = '2026-03-19' AND session_time = '10:49'").run();
} catch (e) {
  console.error("Error deleting specific session:", e);
}

try {
  db.prepare("SELECT frequency FROM sessions LIMIT 1").get();
} catch (e) {
  try { db.exec("ALTER TABLE sessions ADD COLUMN frequency TEXT DEFAULT 'weekly'"); } catch (err) {}
}

try {
  db.prepare("SELECT frequency FROM patients LIMIT 1").get();
} catch (e) {
  try { db.exec("ALTER TABLE patients ADD COLUMN frequency TEXT DEFAULT 'weekly'"); } catch (err) {}
}

try {
  db.prepare("SELECT start_date FROM patients LIMIT 1").get();
} catch (e) {
  try { db.exec("ALTER TABLE patients ADD COLUMN start_date TEXT"); } catch (err) {}
}

try {
  db.prepare("SELECT start_date FROM sessions LIMIT 1").get();
} catch (e) {
  try { db.exec("ALTER TABLE sessions ADD COLUMN start_date TEXT"); } catch (err) {}
}

try {
  db.prepare("SELECT photo_url FROM patients LIMIT 1").get();
} catch (e) {
  try { db.exec("ALTER TABLE patients ADD COLUMN photo_url TEXT"); } catch (err) {}
}

try {
  db.prepare("SELECT photo_url FROM sessions LIMIT 1").get();
} catch (e) {
  try { db.exec("ALTER TABLE sessions ADD COLUMN photo_url TEXT"); } catch (err) {}
}

try {
  db.prepare("SELECT payment_method FROM sessions LIMIT 1").get();
} catch (e) {
  try { db.exec("ALTER TABLE sessions ADD COLUMN payment_method TEXT DEFAULT 'Pix'"); } catch (err) {}
}

try {
  db.prepare("SELECT is_paid FROM sessions LIMIT 1").get();
} catch (e) {
  try { db.exec("ALTER TABLE sessions ADD COLUMN is_paid INTEGER DEFAULT 0"); } catch (err) {}
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/patients", (req, res) => {
    try {
      const patients = db.prepare("SELECT * FROM patients ORDER BY absences DESC").all();
      res.json(patients);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch patients" });
    }
  });

  app.post("/api/patients", (req, res) => {
    const { name, phone, absences, default_amount, default_session_type, schedule_days, schedule_times, weekly_schedule, frequency, start_date, photo_url } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }
    try {
      const stmt = db.prepare(`
        INSERT INTO patients (name, phone, absences, default_amount, default_session_type, schedule_days, schedule_times, weekly_schedule, frequency, start_date, photo_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
          phone = excluded.phone,
          absences = excluded.absences,
          default_amount = excluded.default_amount,
          default_session_type = excluded.default_session_type,
          schedule_days = excluded.schedule_days,
          schedule_times = excluded.schedule_times,
          weekly_schedule = excluded.weekly_schedule,
          frequency = excluded.frequency,
          start_date = excluded.start_date,
          photo_url = excluded.photo_url
      `);
      stmt.run(
        name, 
        phone || "", 
        absences || 0, 
        default_amount || 0, 
        default_session_type || "Particular",
        schedule_days || "",
        schedule_times || "",
        weekly_schedule || "",
        frequency || "weekly",
        start_date || "",
        photo_url || ""
      );
      res.json({ success: true, name, phone, absences, default_amount, default_session_type, schedule_days, schedule_times, weekly_schedule, frequency, start_date, photo_url });
    } catch (error) {
      console.error("Database error adding patient:", error);
      res.status(500).json({ 
        error: "Failed to save patient", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  app.patch("/api/patients/:id", (req, res) => {
    const { id } = req.params;
    const { absences } = req.body;
    try {
      db.prepare("UPDATE patients SET absences = ? WHERE id = ?").run(absences, id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update patient absences" });
    }
  });

  app.delete("/api/patients/:id", (req, res) => {
    const { id } = req.params;
    try {
      // Get patient name first to delete sessions
      const patient = db.prepare("SELECT name FROM patients WHERE id = ?").get(id) as { name: string } | undefined;
      if (patient) {
        db.prepare("DELETE FROM sessions WHERE patient_name = ?").run(patient.name);
      }
      db.prepare("DELETE FROM patients WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete patient" });
    }
  });

  app.delete("/api/patients/by-name/:name", (req, res) => {
    const { name } = req.params;
    try {
      db.prepare("DELETE FROM sessions WHERE patient_name = ?").run(name);
      db.prepare("DELETE FROM patients WHERE name = ?").run(name);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete patient by name" });
    }
  });

  app.get("/api/sessions", (req, res) => {
    try {
      const sessions = db.prepare("SELECT * FROM sessions ORDER BY created_at DESC").all();
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  app.post("/api/sessions", (req, res) => {
    const { 
      patient_name, 
      amount, 
      quantity, 
      session_date, 
      session_time, 
      session_type, 
      status, 
      notes, 
      patient_phone,
      schedule_days,
      schedule_times,
      weekly_schedule,
      frequency,
      start_date,
      photo_url,
      payment_method
    } = req.body;
    
    // Validate required fields
    if (!patient_name || amount === undefined) {
      return res.status(400).json({ error: "Campos obrigatórios ausentes (Nome ou Valor)" });
    }

    try {
      // Ensure patient exists and update schedule if provided
      db.prepare(`
        INSERT INTO patients (name, phone, schedule_days, schedule_times, weekly_schedule, frequency, start_date, photo_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
          phone = CASE WHEN excluded.phone != '' THEN excluded.phone ELSE patients.phone END,
          schedule_days = CASE WHEN excluded.schedule_days != '' THEN excluded.schedule_days ELSE patients.schedule_days END,
          schedule_times = CASE WHEN excluded.schedule_times != '' THEN excluded.schedule_times ELSE patients.schedule_times END,
          weekly_schedule = CASE WHEN excluded.weekly_schedule != '' AND excluded.weekly_schedule != '{}' THEN excluded.weekly_schedule ELSE patients.weekly_schedule END,
          frequency = CASE WHEN excluded.frequency != '' THEN excluded.frequency ELSE patients.frequency END,
          start_date = CASE WHEN excluded.start_date != '' THEN excluded.start_date ELSE patients.start_date END,
          photo_url = CASE WHEN excluded.photo_url != '' THEN excluded.photo_url ELSE patients.photo_url END
      `).run(
        patient_name, 
        patient_phone || "", 
        schedule_days || "", 
        schedule_times || "", 
        weekly_schedule || "{}",
        frequency || "weekly",
        start_date || "",
        photo_url || ""
      );

      const stmt = db.prepare(
        "INSERT INTO sessions (patient_name, amount, quantity, session_date, session_time, session_type, status, notes, patient_phone, schedule_days, schedule_times, weekly_schedule, frequency, start_date, photo_url, payment_method, is_paid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
      
      const params = [
        patient_name, 
        amount, 
        quantity || 1, 
        session_date || "", 
        session_time || "",
        session_type || "Particular", 
        status || "pending", 
        notes || "", 
        patient_phone || "",
        schedule_days || "",
        schedule_times || "",
        weekly_schedule || "",
        frequency || "weekly",
        start_date || "",
        photo_url || "",
        payment_method || "Pix",
        req.body.is_paid ? 1 : 0
      ];

      console.log("Attempting to save session with params:", params);
      
      const info = stmt.run(...params);
      
      res.json({ 
        id: info.lastInsertRowid, 
        patient_name, 
        amount, 
        quantity: quantity || 1, 
        session_date, 
        session_time: session_time || "",
        session_type, 
        status, 
        notes, 
        patient_phone,
        schedule_days,
        schedule_times,
        weekly_schedule
      });
    } catch (error) {
      console.error("Database error adding session:", error);
      res.status(500).json({ 
        error: "Erro interno ao salvar no banco de dados", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  app.patch("/api/sessions/:id", (req, res) => {
    const { id } = req.params;
    const { status, quantity, session_time, payment_method, is_paid } = req.body;
    try {
      const updates: string[] = [];
      const params: any[] = [];

      if (status !== undefined) {
        updates.push("status = ?");
        params.push(status);
      }
      if (quantity !== undefined) {
        updates.push("quantity = ?");
        params.push(quantity);
      }
      if (session_time !== undefined) {
        updates.push("session_time = ?");
        params.push(session_time);
      }
      if (payment_method !== undefined) {
        updates.push("payment_method = ?");
        params.push(payment_method);
      }
      if (is_paid !== undefined) {
        updates.push("is_paid = ?");
        params.push(is_paid ? 1 : 0);
      }

      if (updates.length > 0) {
        params.push(id);
        db.prepare(`UPDATE sessions SET ${updates.join(", ")} WHERE id = ?`).run(...params);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update session" });
    }
  });

  app.delete("/api/sessions/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete session" });
    }
  });

  app.delete("/api/sessions/related/:id", (req, res) => {
    const { id } = req.params;
    try {
      const session = db.prepare("SELECT patient_name, session_time, frequency FROM sessions WHERE id = ?").get(id) as any;
      if (session) {
        db.prepare("DELETE FROM sessions WHERE patient_name = ? AND session_time = ? AND frequency = ?")
          .run(session.patient_name, session.session_time, session.frequency);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete related sessions" });
    }
  });

  app.delete("/api/sessions/by-schedule", (req, res) => {
    const { patient_name, day, frequency } = req.query;
    try {
      // Map day name to SQLite strftime day of week (0-6, Sunday is 0)
      const dayMap: { [key: string]: string } = {
        'Domingo': '0',
        'Segunda': '1',
        'Terça': '2',
        'Quarta': '3',
        'Quinta': '4',
        'Sexta': '5',
        'Sábado': '6'
      };
      
      const dayIndex = dayMap[day as string];
      if (dayIndex !== undefined) {
        db.prepare("DELETE FROM sessions WHERE patient_name = ? AND strftime('%w', session_date) = ? AND frequency = ?")
          .run(patient_name, dayIndex, frequency);
      } else {
        db.prepare("DELETE FROM sessions WHERE patient_name = ? AND frequency = ?")
          .run(patient_name, frequency);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete sessions by schedule" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
