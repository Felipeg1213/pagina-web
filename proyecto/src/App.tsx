import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// ---------- Utilidades ----------
const $ = (sel: string, el: Document | Element = document): Element | null => el.querySelector(sel);
const $$ = (sel: string, el: Document | Element = document): Element[] => Array.from(el.querySelectorAll(sel));
const todayStr = (): string => new Date().toISOString().slice(0, 10);
const fmt = (d: Date): string => d.toISOString().slice(0, 10);
const parse = (str: string): Date => new Date(str + 'T00:00:00');

const startOfWeek = (d: Date): Date => { // Lunes
  const nd = new Date(d); const day = (nd.getDay() + 6) % 7; nd.setDate(nd.getDate() - day); nd.setHours(0, 0, 0, 0); return nd;
};
const weekDays = (baseDate: Date): string[] => {
  const s = startOfWeek(baseDate); return [...Array(7)].map((_, i) => fmt(new Date(s.getFullYear(), s.getMonth(), s.getDate() + i)));
};

function uid(): string { return Math.random().toString(36).slice(2, 9); }

function toast(msg: string = 'Guardado'): void {
  const t = $('#toast') as HTMLElement; t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1300);
}

// ---------- Tipos ----------
interface Habit {
  id: string;
  name: string;
  color: string;
  position?: number;
}

interface State {
  habits: Habit[];
  log: { [date: string]: string[] };
  order: string[];
}

// ---------- API Calls ----------
const API_BASE = 'http://localhost:8080/api';

async function apiGet(endpoint: string) {
  const res = await fetch(`${API_BASE}${endpoint}`);
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

async function apiPost(endpoint: string, data: any) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

async function apiPut(endpoint: string, data: any) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

async function apiPatch(endpoint: string, data: any) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

async function apiDelete(endpoint: string) {
  const res = await fetch(`${API_BASE}${endpoint}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

// ---------- Estado (API) ----------
const THEMES = 'habits.theme.v1';

function getTheme(): string { return localStorage.getItem(THEMES) || 'dark'; }
function setTheme(theme: string): void { localStorage.setItem(THEMES, theme); document.documentElement.classList.toggle('light', theme === 'light'); }

const App: React.FC = () => {
  const location = useLocation();
  const [state, setState] = useState<State>({ habits: [], log: {}, order: [] });
  const [currentDate, setCurrentDate] = useState(todayStr());
  const [theme, setThemeState] = useState(getTheme());

  useEffect(() => {
    setTheme(getTheme());
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const habits = await apiGet('/habits') as Habit[];
      const today = todayStr();
      const logs = await apiGet(`/logs/${today}`) as string[];
      setState({ habits, log: { [today]: logs }, order: habits.map(h => h.id) });
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  // ---------- Operaciones ----------
  const addHabit = async (name: string, color: string = '#60a5fa'): Promise<void> => {
    try {
      const id = uid();
      await apiPost('/habits', { id, name: name.trim(), color });
      await loadData();
      toast('Hábito agregado');
    } catch (err) {
      console.error('Failed to add habit:', err);
      toast('Error al agregar hábito');
    }
  };

  const editHabit = async (id: string, newName: string): Promise<void> => {
    try {
      await apiPut(`/habits/${id}`, { name: newName.trim() });
      await loadData();
      toast('Hábito editado');
    } catch (err) {
      console.error('Failed to edit habit:', err);
      toast('Error al editar hábito');
    }
  };

  const deleteHabit = async (id: string): Promise<void> => {
    try {
      await apiDelete(`/habits/${id}`);
      await loadData();
      toast('Hábito eliminado');
    } catch (err) {
      console.error('Failed to delete habit:', err);
      toast('Error al eliminar hábito');
    }
  };

  const setColor = async (id: string, color: string): Promise<void> => {
    try {
      await apiPatch(`/habits/${id}/color`, { color });
      await loadData();
      toast('Color actualizado');
    } catch (err) {
      console.error('Failed to update color:', err);
      toast('Error al actualizar color');
    }
  };

  const toggleDone = async (id: string, dateStr: string, done: boolean): Promise<void> => {
    try {
      await apiPost('/logs', { habit_id: id, date: dateStr, done });
      await loadData();
    } catch (err) {
      console.error('Failed to toggle done:', err);
      toast('Error al actualizar progreso');
    }
  };

  const clearDay = async (dateStr: string): Promise<void> => {
    try {
      await apiDelete(`/logs/${dateStr}`);
      await loadData();
      toast('Día limpiado');
    } catch (err) {
      console.error('Failed to clear day:', err);
      toast('Error al limpiar día');
    }
  };

  const move = async (id: string, dir: number): Promise<void> => { // dir: -1 up, +1 down
    try {
      await apiPatch(`/habits/${id}/move`, { direction: dir });
      await loadData();
    } catch (err) {
      console.error('Failed to move habit:', err);
      toast('Error al mover hábito');
    }
  };

  // ---------- Cálculos ----------
  const streakFor = (habitId: string): number => {
    let d = parse(currentDate);
    let count = 0;
    while (true) {
      const s = fmt(d);
      const day = state.log[s] || [];
      if (day.includes(habitId)) { count++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return count;
  };

  const globalStreak = (): number => {
    const arr = state.habits.map(h => ({ name: h.name, s: streakFor(h.id) })).sort((a, b) => b.s - a.s).slice(0, 1);
    return arr[0]?.s || 0;
  };

  const completionRate = (dateStr: string): number => {
    const total = state.habits.length || 1;
    const done = (state.log[dateStr] || []).length;
    return Math.round(done * 100 / total);
  };

  const weeklyCounts = (dateStr: string): number[] => {
    const base = parse(dateStr);
    const days = weekDays(base);
    return days.map(d => (state.log[d] || []).length);
  };

  // ---------- Render ----------
  const renderHabits = () => {
    const map = new Map(state.habits.map(h => [h.id, h]));
    return state.order.map(id => {
      const h = map.get(id);
      if (!h) return null;
      return (
        <div key={h.id} className="habit">
          <span className="dot" style={{ background: h.color }}></span>
          <label className="row" style={{ gap: '8px', flex: 1 }}>
            <input
              type="checkbox"
              checked={(state.log[currentDate] || []).includes(h.id)}
              onChange={(e) => toggleDone(h.id, currentDate, e.target.checked)}
            />
            <span className="habit-name">{h.name}</span>
          </label>
          <small title="Racha actual">🔥 {streakFor(h.id)}</small>
          <div className="habit-actions">
            <button className="btn small icon" title="Subir" onClick={() => move(h.id, -1)}>⬆️</button>
            <button className="btn small icon" title="Bajar" onClick={() => move(h.id, 1)}>⬇️</button>
            <button className="btn small icon" title="Editar" onClick={() => {
              const newName = prompt('Editar hábito', h.name);
              if (newName) editHabit(h.id, newName);
            }}>✏️</button>
            <button className="btn small icon" title="Color" onClick={() => {
              const c = prompt('Nuevo color (hex #rrggbb)', h.color);
              if (c && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)) setColor(h.id, c);
              else if (c) alert('Color no válido');
            }}>🎨</button>
            <button className="btn small icon" title="Eliminar" onClick={() => {
              if (confirm('¿Eliminar este hábito?')) deleteHabit(h.id);
            }}>🗑️</button>
          </div>
        </div>
      );
    });
  };

  const handleAddHabit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const nameInput = form.elements.namedItem('habitName') as HTMLInputElement;
    const colorInput = form.elements.namedItem('habitColor') as HTMLInputElement;
    const name = nameInput.value.trim();
    const color = colorInput.value;
    if (name) {
      addHabit(name, color);
      form.reset();
      nameInput.focus();
    }
  };

  const handleThemeToggle = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setThemeState(next);
    setTheme(next);
  };

  return (
    <div className="app container-fluid">
      <header className="appbar">
        <div className="row">
          <div className="col-12 col-md-4 mb-3">
            <div className="card custom-card title">
              <div className="card-body d-flex align-items-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0Zm9-5v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <h1 className="h4 mb-0 ms-2">Dashboard de Hábitos</h1>
                <div className="space flex-grow-1"></div>
                <button className="btn-custom icon" title="Alternar tema" onClick={handleThemeToggle}>🌓</button>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-4 mb-3">
            <div className="card custom-card date-row">
              <div className="card-body d-flex align-items-center">
                <label htmlFor="date" className="me-2">Fecha:</label>
                <input
                  id="date"
                  type="date"
                  className="form-control form-control-sm"
                  value={currentDate}
                  onChange={(e) => setCurrentDate(e.target.value)}
                />
                <div className="space flex-grow-1"></div>
                <span className="streak-badge badge bg-danger" title="Racha total">🔥 {globalStreak()}</span>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-4 mb-3">
            <div className="card custom-card stats">
              <div className="card-body">
                <div className="row">
                  <div className="col-6">
                    <div className="stat">
                      <div className="value h5">{completionRate(currentDate)}%</div>
                      <div className="label small">Completado hoy</div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="stat">
                      <div className="value h5">{weeklyCounts(currentDate).reduce((a, b) => a + b, 0)}</div>
                      <div className="label small">Progreso semanal</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="habits card custom-card">
        <div className="card-body">
          <form id="addForm" onSubmit={handleAddHabit}>
            <div className="input-group mb-3">
              <input
                id="habitName"
                name="habitName"
                type="text"
                className="form-control"
                placeholder="Nuevo hábito..."
                required
              />
              <input
                id="habitColor"
                name="habitColor"
                type="color"
                className="form-control form-control-color"
                defaultValue="#60a5fa"
              />
              <button className="btn btn-primary" type="submit">Agregar</button>
            </div>
          </form>
          <div id="habitList">
            {renderHabits()}
          </div>
        </div>
      </section>

      <section className="chart-section card custom-card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h2 className="h5 mb-0">Progreso Semanal</h2>
            <button
              id="resetTodayBtn"
              className="btn-custom small"
              onClick={() => {
                if (confirm('Esto desmarcará todos los hábitos de la fecha seleccionada.')) clearDay(currentDate);
              }}
            >
              Limpiar día
            </button>
          </div>
          <canvas id="chart"></canvas>
        </div>
      </section>

      <footer className="tools card custom-card">
        <div className="card-body">
          <div className="row g-2">
            <div className="col-6 col-md-3">
              <button
                id="exportBtn"
                className="btn-custom primary w-100"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = 'habitos_backup.json';
                  document.body.appendChild(a);
                  a.click();
                  URL.revokeObjectURL(a.href);
                  a.remove();
                  toast('Exportado');
                }}
              >
                Exportar JSON
              </button>
            </div>
            <div className="col-6 col-md-3">
              <label className="btn-custom w-100 mb-0" htmlFor="importFile">
                Importar JSON
              </label>
              <input
                id="importFile"
                type="file"
                accept="application/json"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const target = e.target as HTMLInputElement;
                  const file = target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  try {
                    const s: State = JSON.parse(text);
                    if (!s.habits || !s.log) {
                      alert('Archivo no válido');
                      return;
                    }
                    setState({ habits: s.habits, log: s.log, order: s.order || s.habits.map(h => h.id) });
                    toast('Importado');
                  } catch (err) {
                    alert('No se pudo importar');
                  }
                  target.value = '';
                }}
              />
            </div>
            <div className="col-6 col-md-3">
              <button
                id="clearAllBtn"
                className="btn-custom danger w-100"
                onClick={() => {
                  if (confirm('¿Borrar todos los datos de hábitos? Esta acción no se puede deshacer.')) {
                    const newState = { habits: [], log: {}, order: [] };
                    setState(newState);
                    toast('Datos borrados');
                  }
                }}
              >
                Borrar todo
              </button>
            </div>
            <div className="col-6 col-md-3">
              <button id="focusBtn" className="btn-custom w-100" data-bs-toggle="modal" data-bs-target="#timerModal">
                ⏱️ Focus Timer
              </button>
            </div>
          </div>
        </div>
      </footer>

      <div id="toast" className="toast">Guardado</div>

      {/* Modal Timer */}
      <TimerModal />
    </div>
  );
};

const TimerModal: React.FC = () => {
  const [minutes, setMinutes] = useState(25);
  const [timeView, setTimeView] = useState('25:00');
  const [timerInt, setTimerInt] = useState<number | null>(null);
  const [remain, setRemain] = useState(25 * 60);

  const drawTime = () => {
    const m = String(Math.floor(remain / 60)).padStart(2, '0');
    const s = String(remain % 60).padStart(2, '0');
    setTimeView(`${m}:${s}`);
  };

  const startTimer = () => {
    if (timerInt) return;
    const int = window.setInterval(() => {
      setRemain(prev => {
        if (prev > 0) {
          const newRemain = prev - 1;
          const m = String(Math.floor(newRemain / 60)).padStart(2, '0');
          const s = String(newRemain % 60).padStart(2, '0');
          setTimeView(`${m}:${s}`);
          return newRemain;
        } else {
          clearInterval(int);
          setTimerInt(null);
          toast('¡Tiempo! Buen trabajo 🎉');
          return 0;
        }
      });
    }, 1000);
    setTimerInt(int);
  };

  const pauseTimer = () => {
    if (timerInt) {
      clearInterval(timerInt);
      setTimerInt(null);
    }
  };

  const resetTimer = () => {
    pauseTimer();
    const mins = Math.min(180, Math.max(1, minutes));
    setRemain(mins * 60);
    drawTime();
  };

  useEffect(() => {
    resetTimer();
  }, [minutes]);

  return (
    <div className="modal fade" id="timerModal" tabIndex={-1} aria-labelledby="timerModalLabel" aria-hidden="true">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title" id="timerModalLabel">⏱️ Focus Timer</h5>
            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
          </div>
          <div className="modal-body text-center">
            <div className="mb-3">
              <label htmlFor="minutes" className="form-label">Minutos:</label>
              <input
                id="minutes"
                type="number"
                className="form-control d-inline-block w-auto"
                min="1"
                max="180"
                value={minutes}
                onChange={(e) => setMinutes(parseInt(e.target.value) || 25)}
              />
            </div>
            <div className="display-4 fw-bold mb-4">{timeView}</div>
            <div className="d-flex justify-content-center gap-2">
              <button type="button" className="btn-custom primary" onClick={startTimer}>Iniciar</button>
              <button type="button" className="btn-custom" onClick={pauseTimer}>Pausar</button>
              <button type="button" className="btn-custom" onClick={resetTimer}>Reiniciar</button>
            </div>
            <p className="text-muted mt-3 mb-0">Consejo: usa la técnica Pomodoro para mantener el foco.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
