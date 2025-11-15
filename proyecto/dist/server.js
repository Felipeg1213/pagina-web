import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './database/db.js'; // 👈 Nueva importación
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 8080;
// Middleware
app.use(express.json());
// ✅ Sirve archivos estáticos desde dist
app.use(express.static(path.join(__dirname, 'dist')));
// Ruta principal
app.get('/', (req, res) => {
    // ✅ Enviar index.html desde dist
    res.sendFile(path.join(__dirname, 'dist', 'index.html'), (err) => {
        if (err) {
            console.error('Error sending index.html:', err);
            res.status(500).send('Error loading the dashboard');
        }
    });
});
// API Health
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Habits Tracker Server is running' });
});
// CRUD Hábitos
app.get('/api/habits', (req, res) => {
    db.all(`
    SELECT h.id, h.name, h.color, o.position
    FROM habits h
    LEFT JOIN habit_order o ON h.id = o.habit_id
    ORDER BY COALESCE(o.position, 999)
  `, (err, rows) => {
        if (err)
            return res.status(500).json({ error: 'Failed to fetch habits' });
        res.json(rows);
    });
});
app.post('/api/habits', (req, res) => {
    const { id, name, color } = req.body;
    db.run('INSERT INTO habits (id, name, color) VALUES (?, ?, ?)', id, name, color || '#60a5fa', function (err) {
        if (err)
            return res.status(500).json({ error: 'Failed to create habit' });
        db.get('SELECT MAX(position) AS maxPos FROM habit_order', (err, row) => {
            const position = (row?.maxPos || 0) + 1;
            db.run('INSERT INTO habit_order (habit_id, position) VALUES (?, ?)', id, position, (err) => {
                if (err)
                    return res.status(500).json({ error: 'Failed to create habit' });
                res.status(201).json({ message: 'Habit created' });
            });
        });
    });
});
app.put('/api/habits/:id', (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    db.run('UPDATE habits SET name = ? WHERE id = ?', name, id, function (err) {
        if (err)
            return res.status(500).json({ error: 'Failed to update habit' });
        res.json({ message: 'Habit updated' });
    });
});
app.delete('/api/habits/:id', (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM habits WHERE id = ?', id, function (err) {
        if (err)
            return res.status(500).json({ error: 'Failed to delete habit' });
        res.json({ message: 'Habit deleted' });
    });
});
app.patch('/api/habits/:id/color', (req, res) => {
    const { id } = req.params;
    const { color } = req.body;
    db.run('UPDATE habits SET color = ? WHERE id = ?', color, id, function (err) {
        if (err)
            return res.status(500).json({ error: 'Failed to update color' });
        res.json({ message: 'Color updated' });
    });
});
app.patch('/api/habits/:id/move', (req, res) => {
    const { id } = req.params;
    const { direction } = req.body;
    db.get('SELECT position FROM habit_order WHERE habit_id = ?', id, (err, row) => {
        if (err || !row)
            return res.status(404).json({ error: 'Habit not found' });
        const pos = row.position;
        const newPos = pos + direction;
        db.get('SELECT habit_id FROM habit_order WHERE position = ?', newPos, (err, swap) => {
            if (swap) {
                db.run('UPDATE habit_order SET position = ? WHERE habit_id = ?', newPos, id);
                db.run('UPDATE habit_order SET position = ? WHERE habit_id = ?', pos, swap.habit_id, (err) => {
                    if (err)
                        return res.status(500).json({ error: 'Failed to move habit' });
                    res.json({ message: 'Habit moved' });
                });
            }
            else {
                res.json({ message: 'Habit moved' });
            }
        });
    });
});
app.get('/api/logs/:date', (req, res) => {
    const { date } = req.params;
    db.all('SELECT habit_id FROM habit_logs WHERE date = ?', date, (err, rows) => {
        if (err)
            return res.status(500).json({ error: 'Failed to fetch logs' });
        res.json(rows.map(r => r.habit_id));
    });
});
app.post('/api/logs', (req, res) => {
    const { habit_id, date, done } = req.body;
    if (done) {
        db.run('INSERT OR IGNORE INTO habit_logs (habit_id, date) VALUES (?, ?)', habit_id, date, function (err) {
            if (err)
                return res.status(500).json({ error: 'Failed to update log' });
            res.json({ message: 'Log updated' });
        });
    }
    else {
        db.run('DELETE FROM habit_logs WHERE habit_id = ? AND date = ?', habit_id, date, function (err) {
            if (err)
                return res.status(500).json({ error: 'Failed to update log' });
            res.json({ message: 'Log updated' });
        });
    }
});
app.delete('/api/logs/:date', (req, res) => {
    const { date } = req.params;
    db.run('DELETE FROM habit_logs WHERE date = ?', date, function (err) {
        if (err)
            return res.status(500).json({ error: 'Failed to clear day' });
        res.json({ message: 'Day cleared' });
    });
});
app.get('/api/stats', (req, res) => {
    db.get('SELECT COUNT(*) AS count FROM habits', (err, total) => {
        if (err)
            return res.status(500).json({ error: 'Failed to fetch stats' });
        const today = new Date().toISOString().slice(0, 10);
        db.get('SELECT COUNT(DISTINCT habit_id) AS count FROM habit_logs WHERE date = ?', today, (err, completed) => {
            if (err)
                return res.status(500).json({ error: 'Failed to fetch stats' });
            res.json({
                totalHabits: total.count,
                completedToday: completed.count,
                currentStreak: 0
            });
        });
    });
});
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
app.listen(PORT, () => {
    console.log(`🚀 Habits Tracker Server running on http://localhost:${PORT}`);
    console.log(`📊 Dashboard available at http://localhost:${PORT}/`);
});
export default app;
