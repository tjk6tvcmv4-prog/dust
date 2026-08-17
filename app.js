const STORAGE_KEY = "focus-flow-data-v1";

const defaultData = {
  theme: "dark",
  settings: { focus: 25, short: 5, long: 15 },
  tasks: [],
  sessions: [],
  taskCompletions: [],
  notificationsEnabled: false,
};

let data = loadData();
let timer = {
  mode: "focus",
  remaining: data.settings.focus * 60,
  total: data.settings.focus * 60,
  running: false,
  intervalId: null,
};
let statsRange = "week";

const elements = {
  themeToggle: document.querySelector("#theme-toggle"),
  settingsButton: document.querySelector("#settings-button"),
  settingsDialog: document.querySelector("#settings-dialog"),
  settingsForm: document.querySelector("#settings-form"),
  focusDuration: document.querySelector("#focus-duration"),
  shortDuration: document.querySelector("#short-duration"),
  longDuration: document.querySelector("#long-duration"),
  focusDurationOutput: document.querySelector("#focus-duration-output"),
  shortDurationOutput: document.querySelector("#short-duration-output"),
  longDurationOutput: document.querySelector("#long-duration-output"),
  notificationToggle: document.querySelector("#notification-toggle"),
  notificationStatus: document.querySelector("#notification-status"),
  timerOrbit: document.querySelector("#timer-orbit"),
  timerSystem: document.querySelector("#timer-system"),
  timerPanel: document.querySelector(".timer-panel"),
  timerDisplay: document.querySelector("#timer-display"),
  timerCaption: document.querySelector("#timer-caption"),
  timerModeLabel: document.querySelector("#timer-mode-label"),
  timerStatus: document.querySelector("#timer-status"),
  timerHint: document.querySelector("#timer-hint"),
  startPause: document.querySelector("#start-pause"),
  resetTimer: document.querySelector("#reset-timer"),
  currentTaskName: document.querySelector("#current-task-name"),
  taskForm: document.querySelector("#task-form"),
  newTask: document.querySelector("#new-task"),
  taskList: document.querySelector("#task-list"),
  taskEmptyState: document.querySelector("#task-empty-state"),
  taskCount: document.querySelector("#task-count"),
  taskTemplate: document.querySelector("#task-template"),
  todayLabel: document.querySelector("#today-label"),
  todayPomodoros: document.querySelector("#today-pomodoros"),
  todayMinutes: document.querySelector("#today-minutes"),
  todayTasks: document.querySelector("#today-tasks"),
  chart: document.querySelector("#focus-chart"),
  chartTotal: document.querySelector("#chart-total"),
  completionRate: document.querySelector("#completion-rate"),
  completionBar: document.querySelector("#completion-bar"),
  completionCopy: document.querySelector("#completion-copy"),
};

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return structuredClone(defaultData);
    return {
      ...structuredClone(defaultData),
      ...saved,
      settings: {
        ...defaultData.settings,
        ...saved.settings,
        short: saved.settings?.short ?? saved.settings?.break ?? defaultData.settings.short,
      },
      tasks: Array.isArray(saved.tasks) ? saved.tasks : [],
      sessions: Array.isArray(saved.sessions) ? saved.sessions : [],
      taskCompletions: Array.isArray(saved.taskCompletions) ? saved.taskCompletions : [],
    };
  } catch {
    return structuredClone(defaultData);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function dateKey(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function formatDateLabel() {
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" }).format(new Date());
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function getCurrentTask() {
  return data.tasks.find((task) => task.selected && !task.completed) || null;
}

function updateTheme() {
  document.documentElement.dataset.theme = data.theme;
  document.querySelector('meta[name="theme-color"]').content = data.theme === "light" ? "#dce1e2" : "#20252b";
}

function updateTimerUI() {
  const mode = getModeDetails(timer.mode);
  const progress = Math.max(0, Math.min(1, 1 - timer.remaining / timer.total));
  document.body.dataset.mode = timer.mode;
  elements.timerOrbit.style.setProperty("--progress", progress);
  elements.timerSystem.classList.toggle("running", timer.running);
  elements.timerDisplay.textContent = formatTime(timer.remaining);
  elements.timerModeLabel.textContent = mode.label;
  elements.timerCaption.textContent = timer.running ? mode.runningCaption : mode.readyCaption;
  elements.timerStatus.textContent = timer.running ? "进行中" : "准备开始";
  elements.timerStatus.classList.toggle("running", timer.running);
  elements.startPause.textContent = timer.running ? "暂停" : mode.startLabel;
  elements.timerHint.textContent = mode.hint;
  elements.currentTaskName.textContent = getCurrentTask()?.title || "未选择任务";
  document.querySelectorAll("[data-timer-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.timerMode === timer.mode);
  });
  document.title = `${formatTime(timer.remaining)} | Focus Flow`;
}

function getModeDetails(mode) {
  const modes = {
    focus: { label: "专注模式", readyCaption: "准备专注", runningCaption: "正在专注", startLabel: "开始专注", hint: "完成一个专注周期后，将进入短休息。" },
    short: { label: "短休息", readyCaption: "准备短休息", runningCaption: "正在短休息", startLabel: "开始休息", hint: "短暂休息后，回到下一轮专注。" },
    long: { label: "长休息", readyCaption: "准备长休息", runningCaption: "正在长休息", startLabel: "开始长休息", hint: "适度放松，准备重新投入学习。" },
  };
  return modes[mode] || modes.focus;
}

function setTimerMode(mode) {
  clearInterval(timer.intervalId);
  timer.mode = mode;
  timer.running = false;
  timer.total = data.settings[mode] * 60;
  timer.remaining = timer.total;
  updateTimerUI();
}

function startTimer() {
  if (timer.running) return;
  timer.running = true;
  timer.intervalId = window.setInterval(tick, 1000);
  updateTimerUI();
}

function pauseTimer() {
  timer.running = false;
  clearInterval(timer.intervalId);
  timer.intervalId = null;
  updateTimerUI();
}

function tick() {
  timer.remaining -= 1;
  if (timer.remaining <= 0) {
    completeTimer();
    return;
  }
  updateTimerUI();
}

function completeTimer() {
  pauseTimer();
  const wasFocus = timer.mode === "focus";
  if (wasFocus) {
    data.sessions.push({ date: dateKey(), minutes: data.settings.focus });
    saveData();
    renderStats();
  }
  playCompletionTone();
  notifyCompletion(wasFocus);
  if (wasFocus) {
    playCompletionFeedback();
  }
  setTimerMode(wasFocus ? "short" : "focus");
}

function playCompletionFeedback() {
  elements.timerPanel.classList.remove("completed");
  void elements.timerPanel.offsetWidth;
  elements.timerPanel.classList.add("completed");
  elements.todayPomodoros.classList.remove("flip");
  void elements.todayPomodoros.offsetWidth;
  elements.todayPomodoros.classList.add("flip");
  window.setTimeout(() => elements.timerPanel.classList.remove("completed"), 760);
  window.setTimeout(() => elements.todayPomodoros.classList.remove("flip"), 600);
}

function playCompletionTone() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audio = new AudioContextClass();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.setValueAtTime(620, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(850, audio.currentTime + 0.18);
    gain.gain.setValueAtTime(0.001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.11, audio.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.35);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.36);
  } catch {
    // Browsers can block audio until a user has interacted with the page.
  }
}

function notifyCompletion(wasFocus) {
  if (data.notificationsEnabled && "Notification" in window && Notification.permission === "granted") {
    new Notification(wasFocus ? "专注完成" : "休息完成", {
      body: wasFocus ? "做得好，开始休息一下吧。" : "休息结束，可以开始下一轮专注。",
    });
  }
}

function renderTasks() {
  elements.taskList.innerHTML = "";
  const activeTasks = data.tasks.filter((task) => !task.completed);
  const completedTasks = data.tasks.filter((task) => task.completed);
  [...activeTasks, ...completedTasks].forEach((task) => {
    const item = elements.taskTemplate.content.firstElementChild.cloneNode(true);
    const check = item.querySelector(".task-check");
    const select = item.querySelector(".task-select");
    item.classList.toggle("completed", task.completed);
    item.classList.toggle("selected", task.selected && !task.completed);
    select.textContent = task.title;
    select.title = task.title;
    check.addEventListener("click", () => toggleTask(task.id));
    select.addEventListener("click", () => selectTask(task.id));
    item.querySelector('[data-action="edit"]').addEventListener("click", () => editTask(task.id));
    item.querySelector('[data-action="delete"]').addEventListener("click", () => deleteTask(task.id));
    elements.taskList.append(item);
  });
  elements.taskCount.textContent = `${data.tasks.length} 项`;
  elements.taskEmptyState.classList.toggle("hidden", data.tasks.length > 0);
  updateTimerUI();
}

function addTask(title) {
  const cleanTitle = title.trim();
  if (!cleanTitle) return;
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const task = { id, title: cleanTitle, completed: false, selected: !getCurrentTask() };
  data.tasks.push(task);
  saveData();
  renderTasks();
  renderStats();
}

function toggleTask(id) {
  const task = data.tasks.find((item) => item.id === id);
  if (!task) return;
  task.completed = !task.completed;
  if (task.completed) {
    task.selected = false;
    data.taskCompletions.push({ date: dateKey(), taskId: task.id });
  } else {
    data.taskCompletions = data.taskCompletions.filter((entry) => entry.taskId !== task.id);
  }
  saveData();
  renderTasks();
  renderStats();
}

function selectTask(id) {
  const task = data.tasks.find((item) => item.id === id);
  if (!task || task.completed) return;
  data.tasks.forEach((item) => { item.selected = item.id === id; });
  saveData();
  renderTasks();
}

function editTask(id) {
  const task = data.tasks.find((item) => item.id === id);
  if (!task) return;
  const updatedTitle = window.prompt("编辑任务", task.title);
  if (updatedTitle === null) return;
  const cleanTitle = updatedTitle.trim();
  if (!cleanTitle) return;
  task.title = cleanTitle.slice(0, 80);
  saveData();
  renderTasks();
}

function deleteTask(id) {
  const task = data.tasks.find((item) => item.id === id);
  if (!task) return;
  if (!window.confirm(`删除任务“${task.title}”？`)) return;
  data.tasks = data.tasks.filter((item) => item.id !== id);
  data.taskCompletions = data.taskCompletions.filter((entry) => entry.taskId !== id);
  saveData();
  renderTasks();
  renderStats();
}

function sessionsForDate(key) {
  return data.sessions.filter((session) => session.date === key);
}

function completedTaskCountForDate(key) {
  return data.taskCompletions.filter((entry) => entry.date === key).length;
}

function renderStats() {
  const today = dateKey();
  const todaySessions = sessionsForDate(today);
  const todayMinutes = todaySessions.reduce((total, session) => total + session.minutes, 0);
  elements.todayPomodoros.textContent = todaySessions.length;
  elements.todayMinutes.innerHTML = `${todayMinutes}<span>min</span>`;
  elements.todayTasks.textContent = completedTaskCountForDate(today);

  renderChart();
  const todayCreated = data.tasks.length;
  const completedToday = completedTaskCountForDate(today);
  const rate = todayCreated ? Math.min(100, Math.round((completedToday / todayCreated) * 100)) : 0;
  elements.completionRate.textContent = `${rate}%`;
  elements.completionBar.style.width = `${rate}%`;
  elements.completionCopy.textContent = todayCreated
    ? `今天已完成 ${completedToday} / ${todayCreated} 项任务。`
    : "今天还没有创建任务。";
}

function renderChart() {
  const today = new Date();
  const days = [];
  if (statsRange === "day") {
    days.push(today);
  } else {
    for (let offset = 6; offset >= 0; offset -= 1) {
      const day = new Date();
      day.setDate(today.getDate() - offset);
      days.push(day);
    }
  }
  const values = days.map((day) => sessionsForDate(dateKey(day)).reduce((total, session) => total + session.minutes, 0));
  const maxValue = Math.max(...values, 25);
  elements.chart.innerHTML = "";
  elements.chart.style.gridTemplateColumns = `repeat(${days.length}, 1fr)`;
  values.forEach((value, index) => {
    const group = document.createElement("div");
    group.className = "bar-group";
    const valueLabel = document.createElement("span");
    valueLabel.className = "bar-value";
    valueLabel.textContent = value ? `${value}m` : "";
    const bar = document.createElement("i");
    bar.className = `bar${index === values.length - 1 ? " today" : ""}`;
    bar.style.height = `${value ? Math.max(8, (value / maxValue) * 170) : 3}px`;
    const label = document.createElement("span");
    label.className = "bar-label";
    label.textContent = statsRange === "day" ? "今天" : new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(days[index]).replace("周", "");
    group.append(valueLabel, bar, label);
    elements.chart.append(group);
  });
  const total = values.reduce((sum, value) => sum + value, 0);
  elements.chartTotal.textContent = `${total} min`;
}

function openSettings() {
  elements.focusDuration.value = data.settings.focus;
  elements.shortDuration.value = data.settings.short;
  elements.longDuration.value = data.settings.long;
  updateDurationOutputs();
  updateNotificationSetting();
  elements.settingsDialog.showModal();
}

function updateDurationOutputs() {
  elements.focusDurationOutput.textContent = `${elements.focusDuration.value} 分钟`;
  elements.shortDurationOutput.textContent = `${elements.shortDuration.value} 分钟`;
  elements.longDurationOutput.textContent = `${elements.longDuration.value} 分钟`;
}

function updateNotificationSetting() {
  if (!("Notification" in window)) {
    elements.notificationStatus.textContent = "此浏览器不支持系统通知，计时结束仍会播放提示音。";
    elements.notificationToggle.checked = false;
    elements.notificationToggle.disabled = true;
    return;
  }
  if (Notification.permission === "granted") {
    elements.notificationStatus.textContent = data.notificationsEnabled ? "已开启，计时结束时将显示系统通知。" : "开启后，计时结束时将显示系统通知。";
    elements.notificationToggle.checked = data.notificationsEnabled;
    elements.notificationToggle.disabled = false;
  } else if (Notification.permission === "denied") {
    elements.notificationStatus.textContent = "浏览器已阻止通知，可在浏览器设置中重新开启。";
    elements.notificationToggle.checked = false;
    elements.notificationToggle.disabled = true;
  } else {
    elements.notificationStatus.textContent = "计时结束时显示系统通知。";
    elements.notificationToggle.checked = false;
    elements.notificationToggle.disabled = false;
  }
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.view;
      document.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("active", item.dataset.view === target));
      document.querySelectorAll("[data-view-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.viewPanel === target));
    });
  });

  elements.themeToggle.addEventListener("click", () => {
    data.theme = data.theme === "dark" ? "light" : "dark";
    saveData();
    updateTheme();
  });
  elements.settingsButton.addEventListener("click", openSettings);
  elements.settingsForm.addEventListener("submit", (event) => {
    if (event.submitter?.id !== "save-settings") return;
    const focus = Number(elements.focusDuration.value);
    const short = Number(elements.shortDuration.value);
    const long = Number(elements.longDuration.value);
    if (!Number.isInteger(focus) || focus < 1 || focus > 120 || !Number.isInteger(short) || short < 1 || short > 60 || !Number.isInteger(long) || long < 1 || long > 90) {
      event.preventDefault();
      return;
    }
    data.settings = { focus, short, long };
    saveData();
    setTimerMode(timer.mode);
  });
  elements.notificationToggle.addEventListener("change", async () => {
    if (!elements.notificationToggle.checked) {
      data.notificationsEnabled = false;
      saveData();
      updateNotificationSetting();
      return;
    }
    if ("Notification" in window && Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      data.notificationsEnabled = permission === "granted";
    } else {
      data.notificationsEnabled = "Notification" in window && Notification.permission === "granted";
    }
    saveData();
    updateNotificationSetting();
  });

  elements.startPause.addEventListener("click", () => (timer.running ? pauseTimer() : startTimer()));
  elements.resetTimer.addEventListener("click", () => setTimerMode(timer.mode));
  document.querySelectorAll("[data-timer-mode]").forEach((button) => {
    button.addEventListener("click", () => setTimerMode(button.dataset.timerMode));
  });
  [elements.focusDuration, elements.shortDuration, elements.longDuration].forEach((input) => {
    input.addEventListener("input", updateDurationOutputs);
  });
  elements.taskForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addTask(elements.newTask.value);
    elements.newTask.value = "";
  });
  document.querySelectorAll("[data-range]").forEach((button) => {
    button.addEventListener("click", () => {
      statsRange = button.dataset.range;
      document.querySelectorAll("[data-range]").forEach((item) => item.classList.toggle("active", item === button));
      renderChart();
    });
  });
}

function initialize() {
  elements.todayLabel.textContent = formatDateLabel();
  updateTheme();
  bindEvents();
  renderTasks();
  renderStats();
  updateTimerUI();
}

initialize();
