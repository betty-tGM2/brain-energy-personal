"use client";

import { FormEvent, useEffect, useState } from "react";

type Status = "planned" | "started" | "completed" | "skipped";
type Tab = "today" | "tasks" | "ideas" | "history";

type CheckIn = {
  sleep: number;
  energy: number;
  mood: number;
  stress: number;
  focus: number;
  minutes: number;
  exercise: boolean;
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
  savedAt: string;
};

type AppData = {
  checkIn: CheckIn;
  checkedIn: boolean;
  tasks: Task[];
  reflection: Reflection | null;
};

const defaultData: AppData = {
  checkIn: { sleep: 7.5, energy: 3, mood: 4, stress: 2, focus: 3, minutes: 300, exercise: false },
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

function calculateCapacity(c: CheckIn) {
  const sleepScore = Math.max(-12, Math.min(8, (c.sleep - 7) * 5));
  const raw = 40 + sleepScore + c.energy * 7 + c.mood * 3 - c.stress * 4 + c.focus * 4 + (c.exercise ? 3 : 0);
  return Math.max(20, Math.min(100, Math.round(raw)));
}

function todayLabel() {
  return new Intl.DateTimeFormat("en-GB", { month: "long", day: "numeric", weekday: "short" }).format(new Date());
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("today");
  const [data, setData] = useState<AppData>(defaultData);
  const [hydrated, setHydrated] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [reflectionOpen, setReflectionOpen] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("brain-energy-v1");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AppData;
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

  const capacity = calculateCapacity(data.checkIn);
  const activeTasks = data.tasks.filter((task) => task.status !== "skipped");
  const plannedEnergy = activeTasks.reduce((sum, task) => sum + task.energy, 0);
  const plannedMinutes = activeTasks.reduce((sum, task) => sum + task.minutes, 0);
  const completed = data.tasks.filter((task) => task.status === "completed").length;
  const loadRatio = Math.round((plannedEnergy / capacity) * 100);
  const assessment = loadRatio > 100 ? "Above estimated capacity" : loadRatio > 80 ? "Near estimated capacity" : "Within estimated capacity";

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

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <div className="brand-mark" aria-hidden="true"><span /></div>
        <div className="brand-copy"><strong>Brain Energy</strong><span>Personal execution model</span></div>
        <button className="avatar" aria-label="Profile and settings">BL</button>
      </header>

      {tab === "today" && (
        <section className="page today-page">
          <div className="day-heading">
            <div><p className="eyebrow">{hydrated ? todayLabel() : "TODAY"}</p><h1>Daily execution overview</h1></div>
            <button className={`checkin-pill ${data.checkedIn ? "done" : ""}`} onClick={() => setCheckInOpen(true)}>
              <span>{data.checkedIn ? "✓" : "+"}</span>{data.checkedIn ? "Check-in recorded" : "Daily check-in"}
            </button>
          </div>

          <article className="capacity-card">
            <div className="capacity-top">
              <div><p className="card-kicker">TODAY’S CAPACITY</p><div className="capacity-number"><strong>{capacity}</strong><span>/ 100</span></div></div>
              <div className="energy-orbit" style={{ "--capacity": `${capacity * 3.6}deg` } as React.CSSProperties}>
                <div><span>STATE</span><b>{capacity >= 75 ? "High" : capacity >= 55 ? "Moderate" : "Low"}</b></div>
              </div>
            </div>
            <p className="capacity-note">{data.checkedIn ? "Calculated from today's sleep, physical energy, mood, stress, and focus inputs." : "Complete the daily check-in to generate a state-based capacity estimate."}</p>
            <div className="signals">
              <span>Sleep {data.checkIn.sleep}h</span><span>Stress {data.checkIn.stress}/5</span><span>Focus {data.checkIn.focus}/5</span>
            </div>
          </article>

          <div className="section-title">
            <div><p className="eyebrow">TODAY’S PLAN</p><h2>Leave some margin in today’s plan</h2></div>
            <button className="round-add" aria-label="Add task" onClick={() => setTaskOpen(true)}>＋</button>
          </div>

          <article className={`load-card ${loadRatio > 100 ? "warning" : ""}`}>
            <div><span className="load-icon">{loadRatio > 100 ? "!" : "✓"}</span><div><strong>{assessment}</strong><p>{plannedEnergy} energy · {Math.round(plannedMinutes / 60 * 10) / 10} hours</p></div></div>
            <span className="load-percent">{loadRatio}%</span>
            <div className="load-track"><span style={{ width: `${Math.min(loadRatio, 100)}%` }} /></div>
            {loadRatio > 100 && <p className="warning-copy">Planned energy exceeds today’s estimated capacity. This is advisory and does not block the plan.</p>}
          </article>

          <div className="task-list">
            {data.tasks.map((task, index) => (
              <article className={`task-card status-${task.status}`} key={task.id}>
                <button className="task-check" aria-label={`${task.title} status`} onClick={() => setTaskStatus(task.id, task.status === "completed" ? "planned" : "completed")}>
                  {task.status === "completed" ? "✓" : index + 1}
                </button>
                <div className="task-main">
                  <span className={`category ${categoryColors[task.category] || "sand"}`}>{task.category}</span>
                  <h3>{task.title}</h3>
                  <p>{task.minutes} min <i /> {task.energy} energy</p>
                </div>
                <button className="task-menu" aria-label="Task action" onClick={() => setTaskStatus(task.id, task.status === "started" ? "skipped" : "started")}>{task.status === "started" ? "Skip" : task.status === "skipped" ? "Skipped" : "Start"}</button>
              </article>
            ))}
          </div>

          <button className="reflection-banner" onClick={() => setReflectionOpen(true)}>
            <span className="moon">R</span><span><strong>{data.reflection ? "Daily reflection recorded" : "Complete daily reflection"}</strong><small>{data.reflection ? `Overall day rating: ${data.reflection.rating}/5` : "Record outcomes and perceived capacity for model calibration."}</small></span><b>→</b>
          </button>
        </section>
      )}

      {tab === "tasks" && <SimplePage eyebrow="TASK LIBRARY" title="Tasks" copy="Store actionable work with time and energy estimates. Divide large tasks into units that can be scheduled within one day." action="Add task" onAction={() => setTaskOpen(true)} items={data.tasks.map(t => `${t.title} · ${t.energy} energy`)} />}
      {tab === "ideas" && <SimplePage eyebrow="IDEA VAULT" title="Ideas" copy="Store possible future ideas without deadlines or execution pressure. Ideas do not enter the task list unless explicitly promoted." action="Add idea" items={["Exchange travel planning tool", "Learn ceramics", "Research topic: personal capacity and execution"]} />}
      {tab === "history" && <HistoryPage capacity={capacity} completed={completed} total={data.tasks.length} />}

      <nav className="bottom-nav" aria-label="Primary navigation">
        <NavButton active={tab === "today"} icon="01" label="Today" onClick={() => setTab("today")} />
        <NavButton active={tab === "tasks"} icon="02" label="Tasks" onClick={() => setTab("tasks")} />
        <NavButton active={tab === "ideas"} icon="03" label="Ideas" onClick={() => setTab("ideas")} />
        <NavButton active={tab === "history"} icon="04" label="Analysis" onClick={() => setTab("history")} />
      </nav>

      {checkInOpen && <CheckInSheet initial={data.checkIn} onClose={() => setCheckInOpen(false)} onSave={updateCheckIn} />}
      {taskOpen && <TaskSheet onClose={() => setTaskOpen(false)} onSave={addTask} />}
      {reflectionOpen && <ReflectionSheet initial={data.reflection} capacity={capacity} onClose={() => setReflectionOpen(false)} onSave={(reflection) => { setData(current => ({ ...current, reflection })); setReflectionOpen(false); }} />}
    </main>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) {
  return <button className={active ? "active" : ""} onClick={onClick}><span>{icon}</span><small>{label}</small></button>;
}

function SimplePage({ eyebrow, title, copy, action, items, onAction }: { eyebrow: string; title: string; copy: string; action: string; items: string[]; onAction?: () => void }) {
  return <section className="page sub-page"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-copy">{copy}</p><button className="primary-button" onClick={onAction}>{action}<span>＋</span></button><div className="simple-list">{items.map((item) => <article key={item}><span>◇</span><strong>{item}</strong><button>→</button></article>)}</div></section>;
}

function HistoryPage({ capacity, completed, total }: { capacity: number; completed: number; total: number }) {
  const bars = [52, 68, 61, 79, 73, capacity, 0];
  return <section className="page sub-page"><p className="eyebrow">MODEL & ANALYSIS</p><h1>Execution patterns</h1><p className="page-copy">The personal model uses eligible observations from the most recent 30 calendar days. Historical records remain available but do not influence the active coefficients.</p><article className="model-card"><span>30-DAY ROLLING MODEL</span><strong>Cold start · collecting observations</strong><p>Personal coefficients will be estimated after at least 10 complete daily records.</p><div className="model-progress"><i style={{ width: "10%" }} /></div><small>1 / 10 eligible records</small></article><article className="chart-card"><div><strong>Capacity · last 7 days</strong><span>Mean {Math.round(bars.filter(Boolean).reduce((a,b) => a+b, 0) / 6)}</span></div><div className="bars">{bars.map((height, i) => <span key={i} style={{ height: `${height || 8}%` }} className={i === 5 ? "current" : ""} />)}</div><div className="days">{["Thu","Fri","Sat","Sun","Mon","Now","Next"].map(d => <small key={d}>{d}</small>)}</div></article><article className="insight-card"><span>TODAY’S RECORD</span><strong>{completed} / {total} tasks completed</strong><p>Execution outcome recorded for future analysis.</p></article></section>;
}

function Sheet({ title, intro, onClose, children }: { title: string; intro: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="sheet-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="sheet" role="dialog" aria-modal="true" aria-label={title}><div className="sheet-handle" /><button className="sheet-close" onClick={onClose}>×</button><p className="eyebrow">DATA ENTRY</p><h2>{title}</h2><p className="sheet-intro">{intro}</p>{children}</section></div>;
}

function Scale({ label, value, onChange, low, high }: { label: string; value: number; onChange: (v: number) => void; low: string; high: string }) {
  return <label className="field scale-field"><span><strong>{label}</strong><small>{low} → {high}</small></span><div className="scale-buttons">{[1,2,3,4,5].map(n => <button type="button" className={value === n ? "selected" : ""} onClick={() => onChange(n)} key={n}>{n}</button>)}</div></label>;
}

function CheckInSheet({ initial, onClose, onSave }: { initial: CheckIn; onClose: () => void; onSave: (value: CheckIn) => void }) {
  const [form, setForm] = useState(initial);
  return <Sheet title="Daily check-in" intro="Record the variables used to estimate today’s execution capacity." onClose={onClose}><form onSubmit={(e) => { e.preventDefault(); onSave(form); }}><label className="field"><span><strong>Sleep duration</strong><small>hours</small></span><input type="number" step="0.5" min="0" max="14" value={form.sleep} onChange={e => setForm({ ...form, sleep: Number(e.target.value) })} /></label><Scale label="Physical energy" value={form.energy} low="Low" high="High" onChange={energy => setForm({ ...form, energy })} /><Scale label="Mood" value={form.mood} low="Low" high="High" onChange={mood => setForm({ ...form, mood })} /><Scale label="Stress" value={form.stress} low="Low" high="High" onChange={stress => setForm({ ...form, stress })} /><Scale label="Focus" value={form.focus} low="Low" high="High" onChange={focus => setForm({ ...form, focus })} /><label className="field"><span><strong>Available time</strong><small>minutes</small></span><input type="number" min="0" max="1440" value={form.minutes} onChange={e => setForm({ ...form, minutes: Number(e.target.value) })} /></label><label className="toggle-field"><span><strong>Exercise completed</strong><small>Any intentional physical activity</small></span><input type="checkbox" checked={form.exercise} onChange={e => setForm({ ...form, exercise: e.target.checked })} /></label><button className="submit-button">Calculate capacity <span>→</span></button></form></Sheet>;
}

function TaskSheet({ onClose, onSave }: { onClose: () => void; onSave: (task: Omit<Task, "id" | "status">) => void }) {
  const [title, setTitle] = useState(""); const [category, setCategory] = useState("Academic"); const [minutes, setMinutes] = useState(45); const [energy, setEnergy] = useState(15);
  const categories = ["Academic", "Career", "Health", "Language", "Life", "Hobby"];
  return <Sheet title="Add task to today" intro="Estimate the time and energy required for this execution unit." onClose={onClose}><form onSubmit={(e: FormEvent) => { e.preventDefault(); if (title.trim()) onSave({ title: title.trim(), category, minutes, energy }); }}><label className="text-field"><span>Task title</span><input autoFocus required placeholder="e.g. Draft literature review outline" value={title} onChange={e => setTitle(e.target.value)} /></label><label className="text-field"><span>Category</span><select value={category} onChange={e => setCategory(e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select></label><div className="field-row"><label className="text-field"><span>Estimated minutes</span><input type="number" min="5" value={minutes} onChange={e => setMinutes(Number(e.target.value))} /></label><label className="text-field"><span>Estimated energy</span><input type="number" min="1" max="100" value={energy} onChange={e => setEnergy(Number(e.target.value))} /></label></div><button className="submit-button">Add to today’s plan <span>＋</span></button></form></Sheet>;
}

function ReflectionSheet({ initial, capacity, onClose, onSave }: { initial: Reflection | null; capacity: number; onClose: () => void; onSave: (r: Reflection) => void }) {
  const [rating, setRating] = useState(initial?.rating || 3); const [perceived, setPerceived] = useState(initial?.perceivedCapacity || capacity); const [note, setNote] = useState(initial?.note || "");
  return <Sheet title="Daily reflection" intro="Record execution outcomes and a retrospective capacity estimate for model calibration." onClose={onClose}><form onSubmit={e => { e.preventDefault(); onSave({ rating, perceivedCapacity: perceived, note, savedAt: new Date().toISOString() }); }}><Scale label="Overall day rating" value={rating} low="Low" high="High" onChange={setRating} /><label className="range-field"><span><strong>Retrospective capacity</strong><b>{perceived}/100</b></span><input type="range" min="0" max="100" value={perceived} onChange={e => setPerceived(Number(e.target.value))} /></label><label className="text-field"><span>Relevant factors or exceptions</span><textarea rows={4} value={note} onChange={e => setNote(e.target.value)} placeholder="Optional notes for later analysis" /></label><button className="submit-button">Save reflection <span>✓</span></button></form></Sheet>;
}
