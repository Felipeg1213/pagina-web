import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';

sqlite3.verbose(); // ← esto ayuda a obtener logs más claros de errores

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta a la base de datos
const dbPath = path.join(__dirname, '../habits.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error al conectar con SQLite:', err);
  } else {
    console.log('✅ Conectado a la base de datos SQLite');
  }
});

// Crear tablas si no existen
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#60a5fa'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS habit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      habit_id TEXT NOT NULL,
      date TEXT NOT NULL,
      FOREIGN KEY (habit_id) REFERENCES habits (id) ON DELETE CASCADE,
      UNIQUE(habit_id, date)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS habit_order (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      habit_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      FOREIGN KEY (habit_id) REFERENCES habits (id) ON DELETE CASCADE,
      UNIQUE(habit_id)
    )
  `);
});

export default db;