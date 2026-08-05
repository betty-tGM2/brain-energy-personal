"use client";

import { FormEvent, useEffect, useState } from "react";

type Status = "planned" | "started" | "completed" | "skipped";
type Tab = "today" | "tasks" | "ideas" | "history";

type CheckIn = {
  sleepStart: string;
  sleepEnd: string;
  sleep: number;
  energy: number;
  mood: number;
  stress: number;
  focus: number;
  minutes: number;
};

type Task = {
  id: string;
  title: string;
  category: string;
  minutes: number;
  energy: number;
  status: Status;
};

type Reflection = {
  rating: number;
  perceivedCapacity: number;
  note: string;
  exercised: boolean;
  savedAt: string;
};

type AppData = {
  checkIn: CheckIn;
  checkedIn: boolean;
  tasks: Task[];
  reflection: Reflection | null;
};

const defaultData: AppData = {
  checkIn: { sleepStart: "23:30", sleepEnd: "07:00", sleep: 7.5, energy: 3, mood: 4, stress: 2, focus: 3, minutes: 300 },
  checkedIn: false,
  tasks: [
    { id: "sample-1", title: "Complete research methods assignment", category: "Academic", minutes: 90, energy: 28, status: "planned" },
    { id: "sample-2", title: "French listening practice", category: "Language", minutes: 30, energy: 12, status: "planned" },
    { id: "sample-3", title: "Post-dinner walk", category: "Health", minutes: 35, energy: 8, status: "planned" },
  ],
  reflection: null,
};

const categoryColors: Record<string, string> = {
  Academic: "lavender", Career: "sky", Health: "mint", Language: "peach", Life: "sand", Hobby: "rose",
  学习: "lavender",
  事业: "sky",
  健康: "mint",
  语言: "peach",
  生活: "sand",
  兴趣: "rose",
};

function clockHours(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour + minute / 60;
}

function circularHours(hours: number) {
  const angle = (hours / 24) * Math.PI * 2;
  return { sin: Math.sin(angle), cos: Math.cos(angle) };
}

function circularTime(time: string) {
  return circularHours(clockHours(time));
}

function sleepTimingFeatures(c: CheckIn) {
  const bedtime = clockHours(c.sleepStart);
  const wakeTime = clockHours(c.sleepEnd);
  const bedtimeContinuous = bedtime < 12 ? bedtime + 24 : bedtime;
  const midpointContinuous = bedtimeContinuous + c.sleep / 2;
  const midpointClock = midpointContinuous % 24;
  const bedtimeCircular = circularTime(c.sleepStart);
  const wakeCircular = circularTime(c.sleepEnd);
  const midpointCircular = circularHours(midpointClock);
  return {
    duration: c.sleep,
    bedtimeSin: bedtimeCircular.sin,
    bedtimeCos: bedtimeCircular.cos,
    wakeTimeSin: wakeCircular.sin,
    wakeTimeCos: wakeCircular.cos,
    midpointSin: midpointCircular.sin,
    midpointCos: midpointCircular.cos,
  };
}

function sleepTimingContribution(c: CheckIn) {
  const bedtime = clockHours(c.sleepStart);
  const bedtimeContinuous = bedtime < 12 ? bedtime + 24 : bedtime;
  const wakeTime = clockHours(c.sleepEnd);
  const bedtimeScore = Math.max(-9, Math.min(6, 6 - Math.abs(bedtimeContinuous - 22.5) * 3));
  const wakeDistanceOutsideBand = Math.max(0, Math.abs(wakeTime - 7.5) - 1.5);
  const wakeScore = Math.max(-5, 2 - wakeDistanceOutsideBand * 1.5);
  return Math.round((bedtimeScore + wakeScore) * 10) / 10;
}

function calculateCapacity(c: CheckIn) {
  const sleepScore = Math.max(-12, Math.min(8, (c.sleep - 7) * 5));
  const raw = 40 + sleepScore + sleepTimingContribution(c) + c.energy * 7 + c.mood * 3 - c.stress * 4 + c.focus * 4;
  return Math.max(20, Math.min(100, Math.round(raw)));
}

function sleepDuration(start: string, end: string) {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const startTotal = startHour * 60 + startMinute;
  let endTotal = endHour * 60 + endMinute;
  if (endTotal <= startTotal) endTotal += 24 * 60;
  return Math.round(((endTotal - startTotal) / 60) * 10) / 10;
}

function inferSleepTimes(hours: number) {
  const endMinutes = 7 * 60 + 30;
  const startMinutes = (endMinutes - Math.round(hours * 60) + 24 * 60) % (24 * 60);
  const toClock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  return { sleepStart: toClock(startMinutes), sleepEnd: "07:30" };
}

function todayLabel(language: "en" | "zh") {
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-GB", { month: "long", day: "numeric", weekday: "short" }).format(new Date());
}

export default function Home() {
  const [language, setLanguage] = useState<"en" | "zh">("en");
  const [tab, setTab] = useState<Tab>("today");
  const [data, setData] = useState<AppData>(defaultData);
  const [hydrated, setHydrated] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [reflectionOpen, setReflectionOpen] = useState(false);

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem("brain-energy-language");
    if (storedLanguage === "zh" || storedLanguage === "en") setLanguage(storedLanguage);
    const stored = window.localStorage.getItem("brain-energy-v1");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AppData;
        if (!parsed.checkIn.sleepStart || !parsed.checkIn.sleepEnd) {
          const inferred = inferSleepTimes(parsed.checkIn.sleep || 7.5);
          parsed.checkIn = { ...parsed.checkIn, ...inferred };
        }
        parsed.checkIn.sleep = sleepDuration(parsed.checkIn.sleepStart, parsed.checkIn.sleepEnd);
        if (parsed.reflection && typeof parsed.reflection.exercised !== "boolean") parsed.reflection.exercised = false;
        const englishSamples: Record<string, Pick<Task, "title" | "category">> = {
          "sample-1": { title: "Complete research methods assignment", category: "Academic" },
          "sample-2": { title: "French listening practice", category: "Language" },
          "sample-3": { title: "Post-dinner walk", category: "Health" },
        };
        parsed.tasks = parsed.tasks.map((task) => englishSamples[task.id] ? { ...task, ...englishSamples[task.id] } : task);
        setData(parsed);
      } catch { /* keep safe defaults */ }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem("brain-energy-v1", JSON.stringify(data));
  }, [data, hydrated]);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem("brain-energy-language", language);
  }, [language, hydrated]);

  const capacity = calculateCapacity(data.checkIn);
  const activeTasks = data.tasks.filter((task) => task.status !== "skipped");
  const plannedEnergy = activeTasks.reduce((sum, task) => sum + task.energy, 0);
  const plannedMinutes = activeTasks.reduce((sum, task) => sum + task.minutes, 0);
  const completed = data.tasks.filter((task) => task.status === "completed").length;
  const loadRatio = Math.round((plannedEnergy / capacity) * 100);
  const zh = language === "zh";
  const assessmentLabel = loadRatio > 100
    ? (zh ? "超过预计容量" : "Above estimated capacity")
    : loadRatio > 80
      ? (zh ? "接近预计容量" : "Near estimated capacity")
      : (zh ? "在预计容量范围内" : "Within estimated capacity");

  function updateCheckIn(next: CheckIn) {
    setData((current) => ({ ...current, checkIn: next, checkedIn: true }));
    setCheckInOpen(false);
  }

  function addTask(task: Omit<Task, "id" | "status">) {
    setData((current) => ({
      ...current,
      tasks: [...current.tasks, { ...task, id: crypto.randomUUID(), status: "planned" }],
    }));
    setTaskOpen(false);
  }

  function setTaskStatus(id: string, status: Status) {
    setData((current) => ({
      ...current,
      tasks: current.tasks.map((task) => task.id === id ? { ...task, status } : task),
    }));
  }

  const categoryZh: Record<string, string> = { Academic: "学业", Career: "事业", Health: "健康", Language: "语言", Life: "生活", Hobby: "兴趣" };
  const sampleTitleZh: Record<string, string> = { "sample-1": "完成研究方法作业", "sample-2": "法语听力练习", "sample-3": "晚饭后散步" };

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <div className="brand-mark" aria-hidden="true"><span /></div>
        <div className="brand-copy"><strong>Brain Energy</strong><span>{zh ? "个人执行模型" : "Personal execution model"}</span></div>
        <button className="language-toggle" aria-label={zh ? "Switch to English" : "切换到中文"} onClick={() => setLanguage(zh ? "en" : "zh")}>{zh ? "EN" : "中文"}</button>
      </header>

      {tab === "today" && (
        <section className="page today-page">
          <div className="day-heading">
            <div><p className="eyebrow">{hydrated ? todayLabel(language) : (zh ? "今天" : "TODAY")}</p><h1>{zh ? "每日执行概览" : "Daily execution overview"}</h1></div>
            <button className={`checkin-pill ${data.checkedIn ? "done" : ""}`} onClick={() => setCheckInOpen(true)}>
              <span>{data.checkedIn ? "✓" : "+"}</span>{data.checkedIn ? (zh ? "已完成状态记录" : "Check-in recorded") : (zh ? "晨间状态记录" : "Daily check-in")}
            </button>
          </div>

          <article className="capacity-card">
            <div className="capacity-top">
              <div><p className="card-kicker">{zh ? "今日容量" : "TODAY’S CAPACITY"}</p><div className="capacity-number"><strong>{capacity}</strong><span>/ 100</span></div></div>
              <div className="energy-orbit" style={{ "--capacity": `${capacity * 3.6}deg` } as React.CSSProperties}>
                <div><span>{zh ? "状态" : "STATE"}</span><b>{capacity >= 75 ? (zh ? "高" : "High") : capacity >= 55 ? (zh ? "中等" : "Moderate") : (zh ? "低" : "Low")}</b></div>
              </div>
            </div>
            <p className="capacity-note">{data.checkedIn ? (zh ? "根据睡眠时长、入睡和起床时间，以及今天的身体能量、心情、压力和专注度计算。" : "Calculated from sleep duration, bedtime, wake time, physical energy, mood, stress, and focus.") : (zh ? "完成晨间状态记录以生成今日容量估计。" : "Complete the daily check-in to generate a state-based capacity estimate.")}</p>
            <div className="signals">
              <span>{zh ? "睡眠" : "Sleep"} {data.checkIn.sleepStart}–{data.checkIn.sleepEnd} ({data.checkIn.sleep}h)</span><span>{zh ? "睡眠时段贡献" : "Timing effect"} {sleepTimingContribution(data.checkIn) >= 0 ? "+" : ""}{sleepTimingContribution(data.checkIn)}</span><span>{zh ? "压力" : "Stress"} {data.checkIn.stress}/5</span><span>{zh ? "专注" : "Focus"} {data.checkIn.focus}/5</span>
            </div>
          </article>

          <div className="section-title">
            <div><p className="eyebrow">{zh ? "今日计划" : "TODAY’S PLAN"}</p><h2>{zh ? "给今天的计划留一点余量" : "Leave some margin in today’s plan"}</h2></div>
            <button className="round-add" aria-label={zh ? "添加任务" : "Add task"} onClick={() => setTaskOpen(true)}>＋</button>
          </div>

          <article className={`load-card ${loadRatio > 100 ? "warning" : ""}`}>
            <div><span className="load-icon">{loadRatio > 100 ? "!" : "✓"}</span><div><strong>{assessmentLabel}</strong><p>{plannedEnergy} {zh ? "能量" : "energy"} · {Math.round(plannedMinutes / 60 * 10) / 10} {zh ? "小时" : "hours"}</p></div></div>
            <span className="load-percent">{loadRatio}%</span>
            <div className="load-track"><span style={{ width: `${Math.min(loadRatio, 100)}%` }} /></div>
            {loadRatio > 100 && <p className="warning-copy">{zh ? "计划能量超过今天的预计容量。该提示仅供参考，不会阻止计划。" : "Planned energy exceeds today’s estimated capacity. This is advisory and does not block the plan."}</p>}
          </article>

          <div className="task-list">
            {data.tasks.map((task, index) => (
              <article className={`task-card status-${task.status}`} key={task.id}>
                <button className="task-check" aria-label={`${task.title} status`} onClick={() => setTaskStatus(task.id, task.status === "completed" ? "planned" : "completed")}>
                  {task.status === "completed" ? "✓" : index + 1}
                </button>
                <div className="task-main">
                  <span className={`category ${categoryColors[task.category] || "sand"}`}>{zh ? (categoryZh[task.category] || task.category) : task.category}</span>
                  <h3>{zh ? (sampleTitleZh[task.id] || task.title) : task.title}</h3>
                  <p>{task.minutes} {zh ? "分钟" : "min"} <i /> {task.energy} {zh ? "能量" : "energy"}</p>
                </div>
                <button className="task-menu" aria-label={zh ? "任务操作" : "Task action"} onClick={() => setTaskStatus(task.id, task.status === "started" ? "skipped" : "started")}>{task.status === "started" ? (zh ? "跳过" : "Skip") : task.status === "skipped" ? (zh ? "已跳过" : "Skipped") : (zh ? "开始" : "Start")}</button>
              </article>
            ))}
          </div>

          <button className="reflection-banner" onClick={() => setReflectionOpen(true)}>
            <span className="moon">R</span><span><strong>{data.reflection ? (zh ? "晚间复盘已记录" : "Daily reflection recorded") : (zh ? "完成晚间复盘" : "Complete daily reflection")}</strong><small>{data.reflection ? (zh ? `今日整体评分：${data.reflection.rating}/5` : `Overall day rating: ${data.reflection.rating}/5`) : (zh ? "记录执行结果和感知容量，用于模型校准。" : "Record outcomes and perceived capacity for model calibration.")}</small></span><b>→</b>
          </button>
        </section>
      )}

      {tab === "tasks" && <SimplePage eyebrow={zh ? "任务库" : "TASK LIBRARY"} title={zh ? "任务" : "Tasks"} copy={zh ? "保存带有时间和能量估计的可执行工作。大型任务应拆分成一天内可以安排的单位。" : "Store actionable work with time and energy estimates. Divide large tasks into units that can be scheduled within one day."} action={zh ? "添加任务" : "Add task"} onAction={() => setTaskOpen(true)} items={data.tasks.map(t => `${zh ? (sampleTitleZh[t.id] || t.title) : t.title} · ${t.energy} ${zh ? "能量" : "energy"}`)} />}
      {tab === "ideas" && <SimplePage eyebrow={zh ? "想法库" : "IDEA VAULT"} title={zh ? "想法" : "Ideas"} copy={zh ? "保存可能在未来推进的想法，不设置期限或执行压力。除非明确升级，否则想法不会进入任务列表。" : "Store possible future ideas without deadlines or execution pressure. Ideas do not enter the task list unless explicitly promoted."} action={zh ? "添加想法" : "Add idea"} items={zh ? ["交换旅行规划工具", "学习陶艺", "研究主题：个人容量与执行"] : ["Exchange travel planning tool", "Learn ceramics", "Research topic: personal capacity and execution"]} />}
      {tab === "history" && <HistoryPage capacity={capacity} completed={completed} total={data.tasks.length} checkIn={data.checkIn} language={language} />}

      <nav className="bottom-nav" aria-label="Primary navigation">
        <NavButton active={tab === "today"} icon="01" label={zh ? "今天" : "Today"} onClick={() => setTab("today")} />
        <NavButton active={tab === "tasks"} icon="02" label={zh ? "任务" : "Tasks"} onClick={() => setTab("tasks")} />
        <NavButton active={tab === "ideas"} icon="03" label={zh ? "想法" : "Ideas"} onClick={() => setTab("ideas")} />
        <NavButton active={tab === "history"} icon="04" label={zh ? "分析" : "Analysis"} onClick={() => setTab("history")} />
      </nav>

      {checkInOpen && <CheckInSheet initial={data.checkIn} language={language} onClose={() => setCheckInOpen(false)} onSave={updateCheckIn} />}
      {taskOpen && <TaskSheet language={language} onClose={() => setTaskOpen(false)} onSave={addTask} />}
      {reflectionOpen && <ReflectionSheet initial={data.reflection} capacity={capacity} language={language} onClose={() => setReflectionOpen(false)} onSave={(reflection) => { setData(current => ({ ...current, reflection })); setReflectionOpen(false); }} />}
    </main>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) {
  return <button className={active ? "active" : ""} onClick={onClick}><span>{icon}</span><small>{label}</small></button>;
}

function SimplePage({ eyebrow, title, copy, action, items, onAction }: { eyebrow: string; title: string; copy: string; action: string; items: string[]; onAction?: () => void }) {
  return <section className="page sub-page"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-copy">{copy}</p><button className="primary-button" onClick={onAction}>{action}<span>＋</span></button><div className="simple-list">{items.map((item) => <article key={item}><span>◇</span><strong>{item}</strong><button>→</button></article>)}</div></section>;
}

function HistoryPage({ capacity, completed, total, checkIn, language }: { capacity: number; completed: number; total: number; checkIn: CheckIn; language: "en" | "zh" }) {
  const bars = [52, 68, 61, 79, 73, capacity, 0];
  const zh = language === "zh";
  const sleepFeatures = sleepTimingFeatures(checkIn);
  return <section className="page sub-page"><p className="eyebrow">{zh ? "模型与分析" : "MODEL & ANALYSIS"}</p><h1>{zh ? "执行规律" : "Execution patterns"}</h1><p className="page-copy">{zh ? "个人模型使用最近30个日历日内的合格观察数据。历史记录会保留，但不会影响当前系数。" : "The personal model uses eligible observations from the most recent 30 calendar days. Historical records remain available but do not influence the active coefficients."}</p><article className="model-card"><span>{zh ? "30天滚动模型" : "30-DAY ROLLING MODEL"}</span><strong>{zh ? "冷启动 · 正在收集观察数据" : "Cold start · collecting observations"}</strong><p>{zh ? "至少获得10条完整日记录后，才会估计个人系数。" : "Personal coefficients will be estimated after at least 10 complete daily records."}</p><div className="model-progress"><i style={{ width: "10%" }} /></div><small>{zh ? "1 / 10 条合格记录" : "1 / 10 eligible records"}</small></article><article className="feature-card"><span>{zh ? "睡眠回归特征" : "SLEEP REGRESSION FEATURES"}</span><strong>{checkIn.sleepStart}–{checkIn.sleepEnd} · {sleepFeatures.duration}h</strong><p>{zh ? "模型分别使用睡眠时长、入睡时间、起床时间、睡眠中点和作息规律性。时间通过正弦/余弦循环编码，避免午夜断点。" : "The model uses duration, bedtime, wake time, sleep midpoint, and schedule regularity. Clock times use sine/cosine circular encoding to avoid the midnight discontinuity."}</p></article><article className="chart-card"><div><strong>{zh ? "最近7天容量" : "Capacity · last 7 days"}</strong><span>{zh ? "均值" : "Mean"} {Math.round(bars.filter(Boolean).reduce((a,b) => a+b, 0) / 6)}</span></div><div className="bars">{bars.map((height, i) => <span key={i} style={{ height: `${height || 8}%` }} className={i === 5 ? "current" : ""} />)}</div><div className="days">{(zh ? ["四","五","六","日","一","今","明"] : ["Thu","Fri","Sat","Sun","Mon","Now","Next"]).map(d => <small key={d}>{d}</small>)}</div></article><article className="insight-card"><span>{zh ? "今日记录" : "TODAY’S RECORD"}</span><strong>{completed} / {total} {zh ? "项任务已完成" : "tasks completed"}</strong><p>{zh ? "执行结果已记录，用于后续分析。" : "Execution outcome recorded for future analysis."}</p></article></section>;
}

function Sheet({ title, intro, language, onClose, children }: { title: string; intro: string; language: "en" | "zh"; onClose: () => void; children: React.ReactNode }) {
  return <div className="sheet-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="sheet" role="dialog" aria-modal="true" aria-label={title}><div className="sheet-handle" /><button className="sheet-close" onClick={onClose}>×</button><p className="eyebrow">{language === "zh" ? "数据录入" : "DATA ENTRY"}</p><h2>{title}</h2><p className="sheet-intro">{intro}</p>{children}</section></div>;
}

function Scale({ label, value, onChange, low, high }: { label: string; value: number; onChange: (v: number) => void; low: string; high: string }) {
  return <label className="field scale-field"><span><strong>{label}</strong><small>{low} → {high}</small></span><div className="scale-buttons">{[1,2,3,4,5].map(n => <button type="button" className={value === n ? "selected" : ""} onClick={() => onChange(n)} key={n}>{n}</button>)}</div></label>;
}

function CheckInSheet({ initial, language, onClose, onSave }: { initial: CheckIn; language: "en" | "zh"; onClose: () => void; onSave: (value: CheckIn) => void }) {
  const [form, setForm] = useState(initial);
  const zh = language === "zh";
  const updateSleep = (key: "sleepStart" | "sleepEnd", value: string) => {
    const next = { ...form, [key]: value };
    next.sleep = sleepDuration(next.sleepStart, next.sleepEnd);
    setForm(next);
  };
  const hours = Math.floor(form.minutes / 60);
  const halfHour = form.minutes % 60 >= 30 ? 30 : 0;
  return <Sheet language={language} title={zh ? "晨间状态记录" : "Daily check-in"} intro={zh ? "记录用于估计今日执行容量的晨间变量。" : "Record the morning variables used to estimate today’s execution capacity."} onClose={onClose}><form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, sleep: sleepDuration(form.sleepStart, form.sleepEnd) }); }}><div className="time-section"><span className="field-label">{zh ? "睡眠时间" : "Sleep interval"}</span><div className="field-row"><label className="text-field"><span>{zh ? "入睡时间" : "Sleep time"}</span><input type="time" value={form.sleepStart} onChange={e => updateSleep("sleepStart", e.target.value)} /></label><label className="text-field"><span>{zh ? "起床时间" : "Wake time"}</span><input type="time" value={form.sleepEnd} onChange={e => updateSleep("sleepEnd", e.target.value)} /></label></div><small className="computed-value">{zh ? "计算时长" : "Calculated duration"}: {sleepDuration(form.sleepStart, form.sleepEnd)} {zh ? "小时" : "hours"}</small></div><Scale label={zh ? "身体能量" : "Physical energy"} value={form.energy} low={zh ? "低" : "Low"} high={zh ? "高" : "High"} onChange={energy => setForm({ ...form, energy })} /><Scale label={zh ? "心情" : "Mood"} value={form.mood} low={zh ? "低" : "Low"} high={zh ? "高" : "High"} onChange={mood => setForm({ ...form, mood })} /><Scale label={zh ? "压力" : "Stress"} value={form.stress} low={zh ? "低" : "Low"} high={zh ? "高" : "High"} onChange={stress => setForm({ ...form, stress })} /><Scale label={zh ? "专注度" : "Focus"} value={form.focus} low={zh ? "低" : "Low"} high={zh ? "高" : "High"} onChange={focus => setForm({ ...form, focus })} /><div className="time-section available-time"><span className="field-label">{zh ? "今天可用时间" : "Available time today"}</span><div className="duration-selects"><label><span>{zh ? "小时" : "Hours"}</span><select value={hours} onChange={e => setForm({ ...form, minutes: Number(e.target.value) * 60 + halfHour })}>{Array.from({ length: 17 }, (_, i) => <option value={i} key={i}>{i}</option>)}</select></label><label><span>{zh ? "分钟" : "Minutes"}</span><select value={halfHour} onChange={e => setForm({ ...form, minutes: hours * 60 + Number(e.target.value) })}><option value={0}>00</option><option value={30}>30</option></select></label></div></div><button className="submit-button">{zh ? "计算今日容量" : "Calculate capacity"} <span>→</span></button></form></Sheet>;
}

function TaskSheet({ language, onClose, onSave }: { language: "en" | "zh"; onClose: () => void; onSave: (task: Omit<Task, "id" | "status">) => void }) {
  const [title, setTitle] = useState(""); const [category, setCategory] = useState("Academic"); const [minutes, setMinutes] = useState(45); const [energy, setEnergy] = useState(15);
  const categories = ["Academic", "Career", "Health", "Language", "Life", "Hobby"];
  const zh = language === "zh";
  const categoryZh: Record<string, string> = { Academic: "学业", Career: "事业", Health: "健康", Language: "语言", Life: "生活", Hobby: "兴趣" };
  return <Sheet language={language} title={zh ? "添加今日任务" : "Add task to today"} intro={zh ? "估计这个执行单位所需的时间和能量。运动可以作为健康类任务添加。" : "Estimate the time and energy required for this execution unit. Exercise can be added as a Health task."} onClose={onClose}><form onSubmit={(e: FormEvent) => { e.preventDefault(); if (title.trim()) onSave({ title: title.trim(), category, minutes, energy }); }}><label className="text-field"><span>{zh ? "任务名称" : "Task title"}</span><input autoFocus required placeholder={zh ? "例如：完成文献综述提纲" : "e.g. Draft literature review outline"} value={title} onChange={e => setTitle(e.target.value)} /></label><label className="text-field"><span>{zh ? "分类" : "Category"}</span><select value={category} onChange={e => setCategory(e.target.value)}>{categories.map(c => <option value={c} key={c}>{zh ? categoryZh[c] : c}</option>)}</select></label><div className="field-row"><label className="text-field"><span>{zh ? "预计分钟" : "Estimated minutes"}</span><input type="number" min="5" value={minutes} onChange={e => setMinutes(Number(e.target.value))} /></label><label className="text-field"><span>{zh ? "预计能量" : "Estimated energy"}</span><input type="number" min="1" max="100" value={energy} onChange={e => setEnergy(Number(e.target.value))} /></label></div><button className="submit-button">{zh ? "加入今日计划" : "Add to today’s plan"} <span>＋</span></button></form></Sheet>;
}

function ReflectionSheet({ initial, capacity, language, onClose, onSave }: { initial: Reflection | null; capacity: number; language: "en" | "zh"; onClose: () => void; onSave: (r: Reflection) => void }) {
  const [rating, setRating] = useState(initial?.rating || 3); const [perceived, setPerceived] = useState(initial?.perceivedCapacity || capacity); const [note, setNote] = useState(initial?.note || ""); const [exercised, setExercised] = useState(initial?.exercised || false);
  const zh = language === "zh";
  return <Sheet language={language} title={zh ? "晚间复盘" : "Daily reflection"} intro={zh ? "记录执行结果、运动情况和回顾性容量估计，用于模型校准。" : "Record execution outcomes, exercise, and a retrospective capacity estimate for model calibration."} onClose={onClose}><form onSubmit={e => { e.preventDefault(); onSave({ rating, perceivedCapacity: perceived, note, exercised, savedAt: new Date().toISOString() }); }}><Scale label={zh ? "今日整体评分" : "Overall day rating"} value={rating} low={zh ? "低" : "Low"} high={zh ? "高" : "High"} onChange={setRating} /><label className="toggle-field"><span><strong>{zh ? "今天是否运动" : "Exercise completed today"}</strong><small>{zh ? "记录任何有意进行的身体活动" : "Any intentional physical activity"}</small></span><input type="checkbox" checked={exercised} onChange={e => setExercised(e.target.checked)} /></label><label className="range-field"><span><strong>{zh ? "回顾性实际容量" : "Retrospective capacity"}</strong><b>{perceived}/100</b></span><input type="range" min="0" max="100" value={perceived} onChange={e => setPerceived(Number(e.target.value))} /></label><label className="text-field"><span>{zh ? "相关因素或例外情况" : "Relevant factors or exceptions"}</span><textarea rows={4} value={note} onChange={e => setNote(e.target.value)} placeholder={zh ? "可选，用于后续分析" : "Optional notes for later analysis"} /></label><button className="submit-button">{zh ? "保存复盘" : "Save reflection"} <span>✓</span></button></form></Sheet>;
}
