import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
// ---------- Utilidades ----------
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmt = (d) => d.toISOString().slice(0, 10);
const parse = (str) => new Date(str + 'T00:00:00');
const startOfWeek = (d) => {
    const nd = new Date(d);
    const day = (nd.getDay() + 6) % 7;
    nd.setDate(nd.getDate() - day);
    nd.setHours(0, 0, 0, 0);
    return nd;
};
const weekDays = (baseDate) => {
    const s = startOfWeek(baseDate);
    return [...Array(7)].map((_, i) => fmt(new Date(s.getFullYear(), s.getMonth(), s.getDate() + i)));
};
function uid() { return Math.random().toString(36).slice(2, 9); }
function toast(msg = 'Guardado') {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 1300);
}
// ---------- API Calls ----------
const API_BASE = 'http://localhost:8080/api';
async function apiGet(endpoint) {
    const res = await fetch(`${API_BASE}${endpoint}`);
    if (!res.ok)
        throw new Error(`API Error: ${res.status}`);
    return res.json();
}
async function apiPost(endpoint, data) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok)
        throw new Error(`API Error: ${res.status}`);
    return res.json();
}
async function apiPut(endpoint, data) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok)
        throw new Error(`API Error: ${res.status}`);
    return res.json();
}
async function apiPatch(endpoint, data) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok)
        throw new Error(`API Error: ${res.status}`);
    return res.json();
}
async function apiDelete(endpoint) {
    const res = await fetch(`${API_BASE}${endpoint}`, { method: 'DELETE' });
    if (!res.ok)
        throw new Error(`API Error: ${res.status}`);
    return res.json();
}
// ---------- Estado (API) ----------
const THEMES = 'habits.theme.v1';
function getTheme() { return localStorage.getItem(THEMES) || 'dark'; }
function setTheme(theme) { localStorage.setItem(THEMES, theme); document.documentElement.classList.toggle('light', theme === 'light'); }
const App = () => {
    const location = useLocation();
    const [state, setState] = useState({ habits: [], log: {}, order: [] });
    const [currentDate, setCurrentDate] = useState(todayStr());
    const [theme, setThemeState] = useState(getTheme());
    useEffect(() => {
        setTheme(getTheme());
        loadData();
    }, []);
    const loadData = async () => {
        try {
            const habits = await apiGet('/habits');
            const today = todayStr();
            const logs = await apiGet(`/logs/${today}`);
            setState({ habits, log: { [today]: logs }, order: habits.map(h => h.id) });
        }
        catch (err) {
            console.error('Failed to load data:', err);
        }
    };
    // ---------- Operaciones ----------
    const addHabit = async (name, color = '#60a5fa') => {
        try {
            const id = uid();
            await apiPost('/habits', { id, name: name.trim(), color });
            await loadData();
            toast('Hábito agregado');
        }
        catch (err) {
            console.error('Failed to add habit:', err);
            toast('Error al agregar hábito');
        }
    };
    const editHabit = async (id, newName) => {
        try {
            await apiPut(`/habits/${id}`, { name: newName.trim() });
            await loadData();
            toast('Hábito editado');
        }
        catch (err) {
            console.error('Failed to edit habit:', err);
            toast('Error al editar hábito');
        }
    };
    const deleteHabit = async (id) => {
        try {
            await apiDelete(`/habits/${id}`);
            await loadData();
            toast('Hábito eliminado');
        }
        catch (err) {
            console.error('Failed to delete habit:', err);
            toast('Error al eliminar hábito');
        }
    };
    const setColor = async (id, color) => {
        try {
            await apiPatch(`/habits/${id}/color`, { color });
            await loadData();
            toast('Color actualizado');
        }
        catch (err) {
            console.error('Failed to update color:', err);
            toast('Error al actualizar color');
        }
    };
    const toggleDone = async (id, dateStr, done) => {
        try {
            await apiPost('/logs', { habit_id: id, date: dateStr, done });
            await loadData();
        }
        catch (err) {
            console.error('Failed to toggle done:', err);
            toast('Error al actualizar progreso');
        }
    };
    const clearDay = async (dateStr) => {
        try {
            await apiDelete(`/logs/${dateStr}`);
            await loadData();
            toast('Día limpiado');
        }
        catch (err) {
            console.error('Failed to clear day:', err);
            toast('Error al limpiar día');
        }
    };
    const move = async (id, dir) => {
        try {
            await apiPatch(`/habits/${id}/move`, { direction: dir });
            await loadData();
        }
        catch (err) {
            console.error('Failed to move habit:', err);
            toast('Error al mover hábito');
        }
    };
    // ---------- Cálculos ----------
    const streakFor = (habitId) => {
        let d = parse(currentDate);
        let count = 0;
        while (true) {
            const s = fmt(d);
            const day = state.log[s] || [];
            if (day.includes(habitId)) {
                count++;
                d.setDate(d.getDate() - 1);
            }
            else
                break;
        }
        return count;
    };
    const globalStreak = () => {
        const arr = state.habits.map(h => ({ name: h.name, s: streakFor(h.id) })).sort((a, b) => b.s - a.s).slice(0, 1);
        return arr[0]?.s || 0;
    };
    const completionRate = (dateStr) => {
        const total = state.habits.length || 1;
        const done = (state.log[dateStr] || []).length;
        return Math.round(done * 100 / total);
    };
    const weeklyCounts = (dateStr) => {
        const base = parse(dateStr);
        const days = weekDays(base);
        return days.map(d => (state.log[d] || []).length);
    };
    // ---------- Render ----------
    const renderHabits = () => {
        const map = new Map(state.habits.map(h => [h.id, h]));
        return state.order.map(id => {
            const h = map.get(id);
            if (!h)
                return null;
            return (_jsxs("div", { className: "habit", children: [_jsx("span", { className: "dot", style: { background: h.color } }), _jsxs("label", { className: "row", style: { gap: '8px', flex: 1 }, children: [_jsx("input", { type: "checkbox", checked: (state.log[currentDate] || []).includes(h.id), onChange: (e) => toggleDone(h.id, currentDate, e.target.checked) }), _jsx("span", { className: "habit-name", children: h.name })] }), _jsxs("small", { title: "Racha actual", children: ["\uD83D\uDD25 ", streakFor(h.id)] }), _jsxs("div", { className: "habit-actions", children: [_jsx("button", { className: "btn small icon", title: "Subir", onClick: () => move(h.id, -1), children: "\u2B06\uFE0F" }), _jsx("button", { className: "btn small icon", title: "Bajar", onClick: () => move(h.id, 1), children: "\u2B07\uFE0F" }), _jsx("button", { className: "btn small icon", title: "Editar", onClick: () => {
                                    const newName = prompt('Editar hábito', h.name);
                                    if (newName)
                                        editHabit(h.id, newName);
                                }, children: "\u270F\uFE0F" }), _jsx("button", { className: "btn small icon", title: "Color", onClick: () => {
                                    const c = prompt('Nuevo color (hex #rrggbb)', h.color);
                                    if (c && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c))
                                        setColor(h.id, c);
                                    else if (c)
                                        alert('Color no válido');
                                }, children: "\uD83C\uDFA8" }), _jsx("button", { className: "btn small icon", title: "Eliminar", onClick: () => {
                                    if (confirm('¿Eliminar este hábito?'))
                                        deleteHabit(h.id);
                                }, children: "\uD83D\uDDD1\uFE0F" })] })] }, h.id));
        });
    };
    const handleAddHabit = (e) => {
        e.preventDefault();
        const form = e.target;
        const nameInput = form.elements.namedItem('habitName');
        const colorInput = form.elements.namedItem('habitColor');
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
    return (_jsxs("div", { className: "app container-fluid", children: [_jsx("header", { className: "appbar", children: _jsxs("div", { className: "row", children: [_jsx("div", { className: "col-12 col-md-4 mb-3", children: _jsx("div", { className: "card custom-card title", children: _jsxs("div", { className: "card-body d-flex align-items-center", children: [_jsx("svg", { width: "28", height: "28", viewBox: "0 0 24 24", fill: "none", children: _jsx("path", { d: "M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0Zm9-5v6l4 2", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round" }) }), _jsx("h1", { className: "h4 mb-0 ms-2", children: "Dashboard de H\u00E1bitos" }), _jsx("div", { className: "space flex-grow-1" }), _jsx("button", { className: "btn-custom icon", title: "Alternar tema", onClick: handleThemeToggle, children: "\uD83C\uDF13" })] }) }) }), _jsx("div", { className: "col-12 col-md-4 mb-3", children: _jsx("div", { className: "card custom-card date-row", children: _jsxs("div", { className: "card-body d-flex align-items-center", children: [_jsx("label", { htmlFor: "date", className: "me-2", children: "Fecha:" }), _jsx("input", { id: "date", type: "date", className: "form-control form-control-sm", value: currentDate, onChange: (e) => setCurrentDate(e.target.value) }), _jsx("div", { className: "space flex-grow-1" }), _jsxs("span", { className: "streak-badge badge bg-danger", title: "Racha total", children: ["\uD83D\uDD25 ", globalStreak()] })] }) }) }), _jsx("div", { className: "col-12 col-md-4 mb-3", children: _jsx("div", { className: "card custom-card stats", children: _jsx("div", { className: "card-body", children: _jsxs("div", { className: "row", children: [_jsx("div", { className: "col-6", children: _jsxs("div", { className: "stat", children: [_jsxs("div", { className: "value h5", children: [completionRate(currentDate), "%"] }), _jsx("div", { className: "label small", children: "Completado hoy" })] }) }), _jsx("div", { className: "col-6", children: _jsxs("div", { className: "stat", children: [_jsx("div", { className: "value h5", children: weeklyCounts(currentDate).reduce((a, b) => a + b, 0) }), _jsx("div", { className: "label small", children: "Progreso semanal" })] }) })] }) }) }) })] }) }), _jsx("section", { className: "habits card custom-card", children: _jsxs("div", { className: "card-body", children: [_jsx("form", { id: "addForm", onSubmit: handleAddHabit, children: _jsxs("div", { className: "input-group mb-3", children: [_jsx("input", { id: "habitName", name: "habitName", type: "text", className: "form-control", placeholder: "Nuevo h\u00E1bito...", required: true }), _jsx("input", { id: "habitColor", name: "habitColor", type: "color", className: "form-control form-control-color", defaultValue: "#60a5fa" }), _jsx("button", { className: "btn btn-primary", type: "submit", children: "Agregar" })] }) }), _jsx("div", { id: "habitList", children: renderHabits() })] }) }), _jsx("section", { className: "chart-section card custom-card", children: _jsxs("div", { className: "card-body", children: [_jsxs("div", { className: "d-flex justify-content-between align-items-center mb-3", children: [_jsx("h2", { className: "h5 mb-0", children: "Progreso Semanal" }), _jsx("button", { id: "resetTodayBtn", className: "btn-custom small", onClick: () => {
                                        if (confirm('Esto desmarcará todos los hábitos de la fecha seleccionada.'))
                                            clearDay(currentDate);
                                    }, children: "Limpiar d\u00EDa" })] }), _jsx("canvas", { id: "chart" })] }) }), _jsx("footer", { className: "tools card custom-card", children: _jsx("div", { className: "card-body", children: _jsxs("div", { className: "row g-2", children: [_jsx("div", { className: "col-6 col-md-3", children: _jsx("button", { id: "exportBtn", className: "btn-custom primary w-100", onClick: () => {
                                        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
                                        const a = document.createElement('a');
                                        a.href = URL.createObjectURL(blob);
                                        a.download = 'habitos_backup.json';
                                        document.body.appendChild(a);
                                        a.click();
                                        URL.revokeObjectURL(a.href);
                                        a.remove();
                                        toast('Exportado');
                                    }, children: "Exportar JSON" }) }), _jsxs("div", { className: "col-6 col-md-3", children: [_jsx("label", { className: "btn-custom w-100 mb-0", htmlFor: "importFile", children: "Importar JSON" }), _jsx("input", { id: "importFile", type: "file", accept: "application/json", style: { display: 'none' }, onChange: async (e) => {
                                            const target = e.target;
                                            const file = target.files?.[0];
                                            if (!file)
                                                return;
                                            const text = await file.text();
                                            try {
                                                const s = JSON.parse(text);
                                                if (!s.habits || !s.log) {
                                                    alert('Archivo no válido');
                                                    return;
                                                }
                                                setState({ habits: s.habits, log: s.log, order: s.order || s.habits.map(h => h.id) });
                                                toast('Importado');
                                            }
                                            catch (err) {
                                                alert('No se pudo importar');
                                            }
                                            target.value = '';
                                        } })] }), _jsx("div", { className: "col-6 col-md-3", children: _jsx("button", { id: "clearAllBtn", className: "btn-custom danger w-100", onClick: () => {
                                        if (confirm('¿Borrar todos los datos de hábitos? Esta acción no se puede deshacer.')) {
                                            const newState = { habits: [], log: {}, order: [] };
                                            setState(newState);
                                            toast('Datos borrados');
                                        }
                                    }, children: "Borrar todo" }) }), _jsx("div", { className: "col-6 col-md-3", children: _jsx("button", { id: "focusBtn", className: "btn-custom w-100", "data-bs-toggle": "modal", "data-bs-target": "#timerModal", children: "\u23F1\uFE0F Focus Timer" }) })] }) }) }), _jsx("div", { id: "toast", className: "toast", children: "Guardado" }), _jsx(TimerModal, {})] }));
};
const TimerModal = () => {
    const [minutes, setMinutes] = useState(25);
    const [timeView, setTimeView] = useState('25:00');
    const [timerInt, setTimerInt] = useState(null);
    const [remain, setRemain] = useState(25 * 60);
    const drawTime = () => {
        const m = String(Math.floor(remain / 60)).padStart(2, '0');
        const s = String(remain % 60).padStart(2, '0');
        setTimeView(`${m}:${s}`);
    };
    const startTimer = () => {
        if (timerInt)
            return;
        const int = window.setInterval(() => {
            setRemain(prev => {
                if (prev > 0) {
                    const newRemain = prev - 1;
                    const m = String(Math.floor(newRemain / 60)).padStart(2, '0');
                    const s = String(newRemain % 60).padStart(2, '0');
                    setTimeView(`${m}:${s}`);
                    return newRemain;
                }
                else {
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
    return (_jsx("div", { className: "modal fade", id: "timerModal", tabIndex: -1, "aria-labelledby": "timerModalLabel", "aria-hidden": "true", children: _jsx("div", { className: "modal-dialog modal-dialog-centered", children: _jsxs("div", { className: "modal-content", children: [_jsxs("div", { className: "modal-header", children: [_jsx("h5", { className: "modal-title", id: "timerModalLabel", children: "\u23F1\uFE0F Focus Timer" }), _jsx("button", { type: "button", className: "btn-close", "data-bs-dismiss": "modal", "aria-label": "Cerrar" })] }), _jsxs("div", { className: "modal-body text-center", children: [_jsxs("div", { className: "mb-3", children: [_jsx("label", { htmlFor: "minutes", className: "form-label", children: "Minutos:" }), _jsx("input", { id: "minutes", type: "number", className: "form-control d-inline-block w-auto", min: "1", max: "180", value: minutes, onChange: (e) => setMinutes(parseInt(e.target.value) || 25) })] }), _jsx("div", { className: "display-4 fw-bold mb-4", children: timeView }), _jsxs("div", { className: "d-flex justify-content-center gap-2", children: [_jsx("button", { type: "button", className: "btn-custom primary", onClick: startTimer, children: "Iniciar" }), _jsx("button", { type: "button", className: "btn-custom", onClick: pauseTimer, children: "Pausar" }), _jsx("button", { type: "button", className: "btn-custom", onClick: resetTimer, children: "Reiniciar" })] }), _jsx("p", { className: "text-muted mt-3 mb-0", children: "Consejo: usa la t\u00E9cnica Pomodoro para mantener el foco." })] })] }) }) }));
};
export default App;
