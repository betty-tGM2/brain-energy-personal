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
    { id: "sample-1", title: "完成研究方法作业", category: "学习", minutes: 90, energy: 28, status: "planned" },
    { id: "sample-2", title: "法语听力练习", category: "语言", minutes: 30, energy: 12, status: "planned" },
    { id: "sample-3", title: "晚饭后散步", category: "健康", minutes: 35, energy: 8, status: "planned" },
  ],
  reflection: null,
};

const categoryColors: Record<string, string> = {
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
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" }).format(new Date());
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
      try { setData(JSON.parse(stored)); } catch { /* keep safe defaults */ }
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
  const assessment = loadRatio > 100 ? "有点 ambitious" : loadRatio > 80 ? "接近上限" : "节奏刚刚好";

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
        <div className="brand-copy"><strong>Brain Energy</strong><span>plan with your real capacity</span></div>
        <button className="avatar" aria-label="个人设置">B</button>
      </header>

      {tab === "today" && (
        <section className="page today-page">
          <div className="day-heading">
            <div><p className="eyebrow">{hydrated ? todayLabel() : "今天"}</p><h1>今天，和自己<br />站在同一边。</h1></div>
            <button className={`checkin-pill ${data.checkedIn ? "done" : ""}`} onClick={() => setCheckInOpen(true)}>
              <span>{data.checkedIn ? "✓" : "↗"}</span>{data.checkedIn ? "已记录状态" : "今日 Check-in"}
            </button>
          </div>

          <article className="capacity-card">
            <div className="capacity-top">
              <div><p className="card-kicker">TODAY’S CAPACITY</p><div className="capacity-number"><strong>{capacity}</strong><span>/ 100</span></div></div>
              <div className="energy-orbit" style={{ "--capacity": `${capacity * 3.6}deg` } as React.CSSProperties}>
                <div><span>ENERGY</span><b>{capacity >= 75 ? "充沛" : capacity >= 55 ? "平稳" : "轻缓"}</b></div>
              </div>
            </div>
            <p className="capacity-note">{data.checkedIn ? "根据你今天的睡眠、压力和专注状态计算。" : "先花一分钟告诉我你今天的状态，预测会更准确。"}</p>
            <div className="signals">
              <span>☾ {data.checkIn.sleep}h 睡眠</span><span>◉ 压力 {data.checkIn.stress}/5</span><span>⌁ 专注 {data.checkIn.focus}/5</span>
            </div>
          </article>

          <div className="section-title">
            <div><p className="eyebrow">TODAY’S PLAN</p><h2>给今天留一点余地</h2></div>
            <button className="round-add" aria-label="添加任务" onClick={() => setTaskOpen(true)}>＋</button>
          </div>

          <article className={`load-card ${loadRatio > 100 ? "warning" : ""}`}>
            <div><span className="load-icon">{loadRatio > 100 ? "!" : "✓"}</span><div><strong>{assessment}</strong><p>{plannedEnergy} 能量 · {Math.round(plannedMinutes / 60 * 10) / 10} 小时</p></div></div>
            <span className="load-percent">{loadRatio}%</span>
            <div className="load-track"><span style={{ width: `${Math.min(loadRatio, 100)}%` }} /></div>
            {loadRatio > 100 && <p className="warning-copy">这个计划可能比你今天的状态更有野心。可以继续，也可以为自己减轻一点。</p>}
          </article>

          <div className="task-list">
            {data.tasks.map((task, index) => (
              <article className={`task-card status-${task.status}`} key={task.id}>
                <button className="task-check" aria-label={`${task.title} 状态`} onClick={() => setTaskStatus(task.id, task.status === "completed" ? "planned" : "completed")}>
                  {task.status === "completed" ? "✓" : index + 1}
                </button>
                <div className="task-main">
                  <span className={`category ${categoryColors[task.category] || "sand"}`}>{task.category}</span>
                  <h3>{task.title}</h3>
                  <p>{task.minutes} 分钟 <i /> {task.energy} 能量</p>
                </div>
                <button className="task-menu" aria-label="任务操作" onClick={() => setTaskStatus(task.id, task.status === "started" ? "skipped" : "started")}>{task.status === "started" ? "跳过" : task.status === "skipped" ? "已跳过" : "开始"}</button>
              </article>
            ))}
          </div>

          <button className="reflection-banner" onClick={() => setReflectionOpen(true)}>
            <span className="moon">☾</span><span><strong>{data.reflection ? "今晚的复盘已保存" : "晚上回来看看今天"}</strong><small>{data.reflection ? `你给今天 ${data.reflection.rating}/5 分` : "不是评判，只是了解什么对你有帮助"}</small></span><b>→</b>
          </button>
        </section>
      )}

      {tab === "tasks" && <SimplePage eyebrow="TASK LIBRARY" title="所有任务" copy="任务是可以被安排的行动。把大任务拆到一天真正能完成的大小。" action="添加新任务" onAction={() => setTaskOpen(true)} items={data.tasks.map(t => `${t.title} · ${t.energy} 能量`)} />}
      {tab === "ideas" && <SimplePage eyebrow="IDEA VAULT" title="想法不需要承诺" copy="先把灵感安全地放在这里。它们没有期限，也不会自动变成待办。" action="记录一个想法" items={["做一个交换旅行规划工具", "学习陶艺", "关于个人能量的播客选题"]} />}
      {tab === "history" && <HistoryPage capacity={capacity} completed={completed} total={data.tasks.length} />}

      <nav className="bottom-nav" aria-label="主要导航">
        <NavButton active={tab === "today"} icon="⌂" label="今天" onClick={() => setTab("today")} />
        <NavButton active={tab === "tasks"} icon="◫" label="任务" onClick={() => setTab("tasks")} />
        <NavButton active={tab === "ideas"} icon="◇" label="想法" onClick={() => setTab("ideas")} />
        <NavButton active={tab === "history"} icon="↗" label="趋势" onClick={() => setTab("history")} />
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
  return <section className="page sub-page"><p className="eyebrow">YOUR PATTERNS</p><h1>慢慢认识自己</h1><p className="page-copy">模型只学习最近 30 个日历日。现在先忠实记录，不急着下结论。</p><article className="model-card"><span>30 DAY MODEL</span><strong>冷启动 · 收集中</strong><p>至少 10 个完整记录日后，才开始生成个人系数。</p><div className="model-progress"><i style={{ width: "10%" }} /></div><small>1 / 10 个有效记录日</small></article><article className="chart-card"><div><strong>最近 7 天容量</strong><span>平均 {Math.round(bars.filter(Boolean).reduce((a,b) => a+b, 0) / 6)}</span></div><div className="bars">{bars.map((height, i) => <span key={i} style={{ height: `${height || 8}%` }} className={i === 5 ? "current" : ""} />)}</div><div className="days">{["四","五","六","日","一","今","明"].map(d => <small key={d}>{d}</small>)}</div></article><article className="insight-card"><span>今天的事实</span><strong>{completed} / {total} 项完成</strong><p>这是执行记录，不是对你能力的评价。</p></article></section>;
}

function Sheet({ title, intro, onClose, children }: { title: string; intro: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="sheet-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="sheet" role="dialog" aria-modal="true" aria-label={title}><div className="sheet-handle" /><button className="sheet-close" onClick={onClose}>×</button><p className="eyebrow">DAILY PRACTICE</p><h2>{title}</h2><p className="sheet-intro">{intro}</p>{children}</section></div>;
}

function Scale({ label, value, onChange, low, high }: { label: string; value: number; onChange: (v: number) => void; low: string; high: string }) {
  return <label className="field scale-field"><span><strong>{label}</strong><small>{low} → {high}</small></span><div className="scale-buttons">{[1,2,3,4,5].map(n => <button type="button" className={value === n ? "selected" : ""} onClick={() => onChange(n)} key={n}>{n}</button>)}</div></label>;
}

function CheckInSheet({ initial, onClose, onSave }: { initial: CheckIn; onClose: () => void; onSave: (value: CheckIn) => void }) {
  const [form, setForm] = useState(initial);
  return <Sheet title="你今天感觉怎么样？" intro="没有正确答案。用一分钟记录此刻真实的你。" onClose={onClose}><form onSubmit={(e) => { e.preventDefault(); onSave(form); }}><label className="field"><span><strong>睡了多久</strong><small>小时</small></span><input type="number" step="0.5" min="0" max="14" value={form.sleep} onChange={e => setForm({ ...form, sleep: Number(e.target.value) })} /></label><Scale label="身体能量" value={form.energy} low="很低" high="充沛" onChange={energy => setForm({ ...form, energy })} /><Scale label="心情" value={form.mood} low="低落" high="很好" onChange={mood => setForm({ ...form, mood })} /><Scale label="压力" value={form.stress} low="轻松" high="很高" onChange={stress => setForm({ ...form, stress })} /><Scale label="专注" value={form.focus} low="涣散" high="清晰" onChange={focus => setForm({ ...form, focus })} /><label className="field"><span><strong>今天可用时间</strong><small>分钟</small></span><input type="number" min="0" max="1440" value={form.minutes} onChange={e => setForm({ ...form, minutes: Number(e.target.value) })} /></label><label className="toggle-field"><span><strong>今天有运动吗？</strong><small>哪怕只是散步</small></span><input type="checkbox" checked={form.exercise} onChange={e => setForm({ ...form, exercise: e.target.checked })} /></label><button className="submit-button">生成今日容量 <span>→</span></button></form></Sheet>;
}

function TaskSheet({ onClose, onSave }: { onClose: () => void; onSave: (task: Omit<Task, "id" | "status">) => void }) {
  const [title, setTitle] = useState(""); const [category, setCategory] = useState("学习"); const [minutes, setMinutes] = useState(45); const [energy, setEnergy] = useState(15);
  return <Sheet title="给今天加一件事" intro="估计它需要多少时间和能量，不用追求完美。" onClose={onClose}><form onSubmit={(e: FormEvent) => { e.preventDefault(); if (title.trim()) onSave({ title: title.trim(), category, minutes, energy }); }}><label className="text-field"><span>任务名称</span><input autoFocus required placeholder="例如：完成论文提纲" value={title} onChange={e => setTitle(e.target.value)} /></label><label className="text-field"><span>分类</span><select value={category} onChange={e => setCategory(e.target.value)}>{Object.keys(categoryColors).map(c => <option key={c}>{c}</option>)}</select></label><div className="field-row"><label className="text-field"><span>预计分钟</span><input type="number" min="5" value={minutes} onChange={e => setMinutes(Number(e.target.value))} /></label><label className="text-field"><span>预计能量</span><input type="number" min="1" max="100" value={energy} onChange={e => setEnergy(Number(e.target.value))} /></label></div><button className="submit-button">加入今日计划 <span>＋</span></button></form></Sheet>;
}

function ReflectionSheet({ initial, capacity, onClose, onSave }: { initial: Reflection | null; capacity: number; onClose: () => void; onSave: (r: Reflection) => void }) {
  const [rating, setRating] = useState(initial?.rating || 3); const [perceived, setPerceived] = useState(initial?.perceivedCapacity || capacity); const [note, setNote] = useState(initial?.note || "");
  return <Sheet title="今天真实地发生了什么？" intro="复盘不是打分。它帮助未来的计划更懂你。" onClose={onClose}><form onSubmit={e => { e.preventDefault(); onSave({ rating, perceivedCapacity: perceived, note, savedAt: new Date().toISOString() }); }}><Scale label="今天整体感受" value={rating} low="很难" high="很好" onChange={setRating} /><label className="range-field"><span><strong>回头看，实际容量</strong><b>{perceived}/100</b></span><input type="range" min="0" max="100" value={perceived} onChange={e => setPerceived(Number(e.target.value))} /></label><label className="text-field"><span>有什么帮助了你，或阻碍了你？</span><textarea rows={4} value={note} onChange={e => setNote(e.target.value)} placeholder="可选。写给未来的自己……" /></label><button className="submit-button">保存今晚的观察 <span>✓</span></button></form></Sheet>;
}
