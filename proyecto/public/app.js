"use strict";
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
// ---------- Estado (localStorage) ----------
const KEY = 'habits.state.v1';
const THEMES = 'habits.theme.v1';
function load() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw)
            return { habits: [], log: {}, order: [] };
        const s = JSON.parse(raw);
        if (!s.order)
            s.order = s.habits.map(h => h.id);
        return s;
    }
    catch (e) {
        console.error(e);
        return { habits: [], log: {}, order: [] };
    }
}
function save(state) { localStorage.setItem(KEY, JSON.stringify(state)); }
function getTheme() { return localStorage.getItem(THEMES) || 'dark'; }
function setTheme(theme) { localStorage.setItem(THEMES, theme); document.documentElement.classList.toggle('light', theme === 'light'); }
let state = load();
setTheme(getTheme());
// ---------- Operaciones ----------
function addHabit(name, color = '#60a5fa') {
    const h = { id: uid(), name: name.trim(), color };
    state.habits.push(h);
    state.order.push(h.id);
    save(state);
    render();
    toast('Hábito agregado');
}
function editHabit(id, newName) {
    const h = state.habits.find(h => h.id === id);
    if (!h)
        return;
    h.name = newName.trim();
    save(state);
    render();
    toast('Hábito editado');
}
function deleteHabit(id) {
    state.habits = state.habits.filter(h => h.id !== id);
    state.order = state.order.filter(x => x !== id);
    // limpiar del log
    for (const d in state.log) {
        state.log[d] = state.log[d].filter(x => x !== id);
        if (state.log[d].length === 0)
            delete state.log[d];
    }
    save(state);
    render();
    toast('Hábito eliminado');
}
function setColor(id, color) {
    const h = state.habits.find(h => h.id === id);
    if (h) {
        h.color = color;
        save(state);
        render();
        toast('Color actualizado');
    }
}
function toggleDone(id, dateStr, done) {
    const day = state.log[dateStr] || [];
    const has = day.includes(id);
    if (done && !has)
        day.push(id);
    if (!done && has)
        day.splice(day.indexOf(id), 1);
    if (day.length)
        state.log[dateStr] = day;
    else
        delete state.log[dateStr];
    save(state);
    updateStatsAndChart();
}
function clearDay(dateStr) {
    delete state.log[dateStr];
    save(state);
    render();
    toast('Día limpiado');
}
function move(id, dir) {
    const idx = state.order.indexOf(id);
    if (idx < 0)
        return;
    const j = idx + dir;
    if (j < 0 || j >= state.order.length)
        return;
    [state.order[idx], state.order[j]] = [state.order[j], state.order[idx]];
    save(state);
    render();
}
// ---------- Cálculos ----------
function streakFor(habitId) {
    // cuenta racha hasta hoy
    let d = parse($('#date').value || todayStr());
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
}
function globalStreak() {
    const arr = state.habits.map(h => ({ name: h.name, s: streakFor(h.id) })).sort((a, b) => b.s - a.s).slice(0, 1);
    return arr[0]?.s || 0;
}
function completionRate(dateStr) {
    const total = state.habits.length || 1;
    const done = (state.log[dateStr] || []).length;
    return Math.round(done * 100 / total);
}
function weeklyCounts(dateStr) {
    const base = parse(dateStr);
    const days = weekDays(base);
    return days.map(d => (state.log[d] || []).length);
}
// ---------- Render ----------
function render() {
    var _a;
    (_a = $('#date')).value || (_a.value = todayStr());
    // Lista de hábitos (ordenados)
    const root = $('#habitList');
    root.innerHTML = '';
    const map = new Map(state.habits.map(h => [h.id, h]));
    const dateStr = $('#date').value;
    state.order.forEach(id => {
        const h = map.get(id);
        if (!h)
            return;
        const item = document.createElement('div');
        item.className = 'habit';
        item.innerHTML = `
      <span class="dot" style="background:${h.color}"></span>
      <label class="row" style="gap:8px; flex:1;">
        <input type="checkbox" ${(state.log[dateStr] || []).includes(h.id) ? 'checked' : ''} data-check="${h.id}" />
        <span class="habit-name">${h.name}</span>
      </label>
      <small title="Racha actual">🔥 ${streakFor(h.id)}</small>
      <div class="habit-actions">
        <button class="btn small icon" title="Subir" data-up="${h.id}">⬆️</button>
        <button class="btn small icon" title="Bajar" data-down="${h.id}">⬇️</button>
        <button class="btn small icon" title="Editar" data-edit="${h.id}">✏️</button>
        <button class="btn small icon" title="Color" data-color="${h.id}">🎨</button>
        <button class="btn small icon" title="Eliminar" data-del="${h.id}">🗑️</button>
      </div>
    `;
        root.appendChild(item);
    });
    updateStatsAndChart();
}
// ---------- Chart ----------
let chart = null;
function updateChart() {
    const dateStr = $('#date').value;
    const labels = weekDays(parse(dateStr)).map(d => {
        const dd = new Date(d);
        return ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][(dd.getDay() + 6) % 7];
    });
    const values = weeklyCounts(dateStr);
    const goal = Array(7).fill(state.habits.length);
    const data = {
        labels,
        datasets: [
            { label: 'Completados', data: values, borderWidth: 2, tension: .35, fill: true },
            { label: 'Objetivo (hábitos)', data: goal, type: 'line', borderDash: [6, 6], pointRadius: 0 }
        ]
    };
    const opts = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text') } } },
        scales: {
            x: { ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--muted') } },
            y: { beginAtZero: true, ticks: { precision: 0, color: getComputedStyle(document.documentElement).getPropertyValue('--muted') } }
        }
    };
    if (chart) {
        chart.data = data;
        chart.options = opts;
        chart.update();
    }
    else {
        chart = new Chart($('#chart'), { type: 'line', data, options: opts });
    }
}
function updateStatsAndChart() {
    const dateStr = $('#date').value;
    $('#todayRate').textContent = completionRate(dateStr) + '%';
    $('#weeklyTotal').textContent = weeklyCounts(dateStr).reduce((a, b) => a + b, 0).toString();
    $('#streakGlobal').textContent = '🔥 ' + globalStreak();
    updateChart();
}
// ---------- Eventos ----------
$('#addForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#habitName').value.trim();
    const color = $('#habitColor').value;
    if (name) {
        addHabit(name, color);
        $('#addForm').reset();
        $('#habitName').focus();
    }
});
$('#habitList').addEventListener('change', e => {
    const target = e.target;
    const id = target.getAttribute('data-check');
    if (!id)
        return;
    toggleDone(id, $('#date').value, target.checked);
    toast('Progreso actualizado');
    render(); // para refrescar rachas
});
$('#habitList').addEventListener('click', e => {
    const target = e.target;
    const id = target.getAttribute('data-edit')
        || target.getAttribute('data-del')
        || target.getAttribute('data-up')
        || target.getAttribute('data-down')
        || target.getAttribute('data-color');
    if (!id)
        return;
    if (target.hasAttribute('data-edit')) {
        const h = state.habits.find(x => x.id === id);
        const newName = prompt('Editar hábito', h?.name || '');
        if (newName)
            editHabit(id, newName);
    }
    else if (target.hasAttribute('data-del')) {
        if (confirm('¿Eliminar este hábito?'))
            deleteHabit(id);
    }
    else if (target.hasAttribute('data-up')) {
        move(id, -1);
    }
    else if (target.hasAttribute('data-down')) {
        move(id, +1);
    }
    else if (target.hasAttribute('data-color')) {
        const h = state.habits.find(x => x.id === id);
        const c = prompt('Nuevo color (hex #rrggbb)', h?.color || '#60a5fa');
        if (c && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c))
            setColor(id, c);
        else if (c)
            alert('Color no válido');
    }
});
$('#date').addEventListener('change', () => { render(); });
$('#resetTodayBtn').addEventListener('click', () => {
    if (confirm('Esto desmarcará todos los hábitos de la fecha seleccionada.'))
        clearDay($('#date').value);
});
$('#themeBtn').addEventListener('click', () => {
    const next = getTheme() === 'light' ? 'dark' : 'light';
    setTheme(next);
    updateChart();
});
// Exportar / Importar / Borrar todo
$('#exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'habitos_backup.json';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();
    toast('Exportado');
});
$('#importFile').addEventListener('change', async (e) => {
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
        state = { habits: s.habits, log: s.log, order: s.order || s.habits.map(h => h.id) };
        save(state);
        render();
        toast('Importado');
    }
    catch (err) {
        alert('No se pudo importar');
    }
    target.value = '';
});
$('#clearAllBtn').addEventListener('click', () => {
    if (confirm('¿Borrar todos los datos de hábitos? Esta acción no se puede deshacer.')) {
        state = { habits: [], log: {}, order: [] };
        save(state);
        render();
        toast('Datos borrados');
    }
});
// ---------- Timer (Pomodoro) ----------
/**
 * Timer functionality for Pomodoro technique
 * Manages focus sessions with customizable duration
 */
const timeView = $('#timeView');
let timerInt = null, remain = 25 * 60;
/**
 * Updates the timer display with formatted time
 */
function drawTime() {
    const m = String(Math.floor(remain / 60)).padStart(2, '0');
    const s = String(remain % 60).padStart(2, '0');
    timeView.textContent = `${m}:${s}`;
}
/**
 * Starts the countdown timer
 */
function startTimer() {
    if (timerInt)
        return;
    timerInt = window.setInterval(() => {
        if (remain > 0) {
            remain--;
            drawTime();
        }
        else {
            clearInterval(timerInt);
            timerInt = null;
            toast('¡Tiempo! Buen trabajo 🎉');
        }
    }, 1000);
}
/**
 * Pauses the active timer
 */
function pauseTimer() { if (timerInt) {
    clearInterval(timerInt);
    timerInt = null;
} }
/**
 * Resets timer to initial state with current minutes setting
 */
function resetTimer() {
    pauseTimer();
    const mins = Math.min(180, Math.max(1, parseInt($('#minutes').value || '25', 10)));
    remain = mins * 60;
    drawTime();
}
// Timer event listeners
$('#focusBtn').addEventListener('click', () => { resetTimer(); });
$('#startTimer').addEventListener('click', startTimer);
$('#pauseTimer').addEventListener('click', pauseTimer);
$('#resetTimer').addEventListener('click', resetTimer);
$('#minutes').addEventListener('change', resetTimer);
// Bootstrap modal event handling - pause timer when modal is closed
$('#timerModal').addEventListener('hidden.bs.modal', pauseTimer);
// ---------- Init ----------
(function init() {
    $('#date').value = todayStr();
    render();
    toast('Listo ✨ Añade tus hábitos');
})();
//# sourceMappingURL=app.js.map