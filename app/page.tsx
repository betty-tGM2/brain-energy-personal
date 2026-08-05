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
  urgency: 1 | 2 | 3;
  createdAt: string;
  status: Status;
};

type Idea = {
  id: string;
  title: string;
  description: string;
  category: string;
  createdAt: string;
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
  ideas: Idea[];
  reflection: Reflection | null;
};

const defaultData: AppData = {
  checkIn: { sleepStart: "23:30", sleepEnd: "07:00", sleep: 7.5, energy: 3, mood: 4, stress: 2, focus: 3, minutes: 300 },
  checkedIn: false,
  tasks: [
    { id: "sample-1", title: "Complete research methods assignment", category: "Academic", minutes: 90, energy: 28, urgency: 3, createdAt: "2026-08-05T08:00:00.000Z", status: "planned" },
    { id: "sample-2", title: "French listening practice", category: "Language", minutes: 30, energy: 12, urgency: 2, createdAt: "2026-08-05T08:01:00.000Z", status: "planned" },
    { id: "sample-3", title: "Post-dinner walk", category: "Health", minutes: 35, energy: 8, urgency: 1, createdAt: "2026-08-05T08:02:00.000Z", status: "planned" },
  ],
  ideas: [
    { id: "idea-1", title: "Exchange travel planning tool", description: "Explore constraints and possible user workflows.", category: "Product", createdAt: "2026-08-05T09:00:00.000Z" },
    { id: "idea-2", title: "Learn ceramics", description: "Find an introductory course for a future term.", category: "Learning", createdAt: "2026-08-05T09:01:00.000Z" },
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
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [ideaOpen, setIdeaOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
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
        parsed.tasks = parsed.tasks.map((task, index) => ({ ...task, ...(englishSamples[task.id] || {}), urgency: task.urgency || 2, createdAt: task.createdAt || new Date(Date.now() + index * 1000).toISOString() }));
        if (!Array.isArray(parsed.ideas)) parsed.ideas = defaultData.ideas;
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
  const completedEnergy = data.tasks.filter((task) => task.status === "completed").reduce((sum, task) => sum + task.energy, 0);
  const remainingEnergy = Math.max(0, capacity - completedEnergy);
  const unfinishedTasks = data.tasks.filter((task) => task.status === "planned" || task.status === "started");
  let fitEnergy = 0;
  const tasksThatFit = [...unfinishedTasks].sort((a, b) => a.energy - b.energy).filter((task) => {
    if (fitEnergy + task.energy > remainingEnergy) return false;
    fitEnergy += task.energy;
    return true;
  }).length;
  const usedRatio = Math.min(100, Math.round((completedEnergy / capacity) * 100));
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

  function saveTask(task: Omit<Task, "id" | "status" | "createdAt">) {
    setData((current) => ({ ...current, tasks: editingTask
      ? current.tasks.map((item) => item.id === editingTask.id ? { ...item, ...task } : item)
      : [...current.tasks, { ...task, id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: "planned" }],
    }));
    setTaskOpen(false);
    setEditingTask(null);
  }

  function openTaskEditor(task?: Task) { setEditingTask(task || null); setTaskOpen(true); }
  function deleteTask(id: string) {
    if (window.confirm(zh ? "删除这个任务？此操作无法撤销。" : "Delete this task? This cannot be undone.")) setData(current => ({ ...current, tasks: current.tasks.filter(task => task.id !== id) }));
  }
  function saveIdea(idea: Omit<Idea, "id" | "createdAt">) {
    setData(current => ({ ...current, ideas: editingIdea
      ? current.ideas.map(item => item.id === editingIdea.id ? { ...item, ...idea } : item)
      : [...current.ideas, { ...idea, id: crypto.randomUUID(), createdAt: new Date().toISOString() }],
    }));
    setIdeaOpen(false); setEditingIdea(null);
  }
  function openIdeaEditor(idea?: Idea) { setEditingIdea(idea || null); setIdeaOpen(true); }
  function deleteIdea(id: string) {
    if (window.confirm(zh ? "删除这个想法？此操作无法撤销。" : "Delete this idea? This cannot be undone.")) setData(current => ({ ...current, ideas: current.ideas.filter(idea => idea.id !== id) }));
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
            <button className="round-add" aria-label={zh ? "添加任务" : "Add task"} onClick={() => openTaskEditor()}>＋</button>
          </div>

          <article className={`load-card energy-budget ${remainingEnergy === 0 ? "depleted" : ""}`}>
            <div className="remaining-summary"><span className="load-icon">E</span><div><small>{zh ? "今日剩余能量" : "ENERGY REMAINING"}</small><strong>{remainingEnergy}<em> / {capacity}</em></strong></div></div>
            <span className="used-label">{zh ? `已使用 ${completedEnergy}` : `${completedEnergy} used`}</span>
            <div className="load-track used-track"><span style={{ width: `${usedRatio}%` }} /></div>
            <div className="task-fit"><strong>{unfinishedTasks.length === 0 ? (zh ? "今日计划已处理完毕" : "No unfinished tasks") : (zh ? `预计还可完成 ${tasksThatFit} / ${unfinishedTasks.length} 项任务` : `Estimated room for ${tasksThatFit} of ${unfinishedTasks.length} unfinished tasks`)}</strong><p>{zh ? "按剩余任务的能量估计；实际消耗可在复盘中校准。" : "Based on estimated task energy; actual usage is calibrated in reflection."}</p></div>
            <div className={`plan-load ${loadRatio > 100 ? "over" : ""}`}><span>{zh ? "计划总负载" : "Plan load"}</span><b>{plannedEnergy} / {capacity} · {loadRatio}%</b><small>{assessmentLabel} · {Math.round(plannedMinutes / 60 * 10) / 10}h</small></div>
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
                  <p>{task.minutes} {zh ? "分钟" : "min"} <i /> {task.energy} {zh ? "能量" : "energy"} <i /> {zh ? "紧急度" : "urgency"} {task.urgency}/3</p>
                </div>
                <div className="task-actions"><button onClick={() => openTaskEditor(task)}>{zh ? "编辑" : "Edit"}</button>{task.status !== "completed" && <button onClick={() => setTaskStatus(task.id, task.status === "started" ? "skipped" : "started")}>{task.status === "started" ? (zh ? "跳过" : "Skip") : task.status === "skipped" ? (zh ? "已跳过" : "Skipped") : (zh ? "开始" : "Start")}</button>}<button className="danger" aria-label={zh ? "删除任务" : "Delete task"} onClick={() => deleteTask(task.id)}>×</button></div>
              </article>
            ))}
          </div>

          <button className="reflection-banner" onClick={() => setReflectionOpen(true)}>
            <span className="moon">R</span><span><strong>{data.reflection ? (zh ? "晚间复盘已记录" : "Daily reflection recorded") : (zh ? "完成晚间复盘" : "Complete daily reflection")}</strong><small>{data.reflection ? (zh ? `今日整体评分：${data.reflection.rating}/5` : `Overall day rating: ${data.reflection.rating}/5`) : (zh ? "记录执行结果和感知容量，用于模型校准。" : "Record outcomes and perceived capacity for model calibration.")}</small></span><b>→</b>
          </button>
        </section>
      )}

      {tab === "tasks" && <TasksPage tasks={data.tasks} language={language} onAdd={() => openTaskEditor()} onEdit={openTaskEditor} onDelete={deleteTask} />}
      {tab === "ideas" && <IdeasPage ideas={data.ideas} language={language} onAdd={() => openIdeaEditor()} onEdit={openIdeaEditor} onDelete={deleteIdea} />}
      {tab === "history" && <HistoryPage capacity={capacity} completed={completed} total={data.tasks.length} checkIn={data.checkIn} language={language} />}

      <nav className="bottom-nav" aria-label="Primary navigation">
        <NavButton active={tab === "today"} icon="01" label={zh ? "今天" : "Today"} onClick={() => setTab("today")} />
        <NavButton active={tab === "tasks"} icon="02" label={zh ? "任务" : "Tasks"} onClick={() => setTab("tasks")} />
        <NavButton active={tab === "ideas"} icon="03" label={zh ? "想法" : "Ideas"} onClick={() => setTab("ideas")} />
        <NavButton active={tab === "history"} icon="04" label={zh ? "分析" : "Analysis"} onClick={() => setTab("history")} />
      </nav>

      {checkInOpen && <CheckInSheet initial={data.checkIn} language={language} onClose={() => setCheckInOpen(false)} onSave={updateCheckIn} />}
      {taskOpen && <TaskSheet initial={editingTask} language={language} onClose={() => { setTaskOpen(false); setEditingTask(null); }} onSave={saveTask} />}
      {ideaOpen && <IdeaSheet initial={editingIdea} language={language} onClose={() => { setIdeaOpen(false); setEditingIdea(null); }} onSave={saveIdea} />}
      {reflectionOpen && <ReflectionSheet initial={data.reflection} capacity={capacity} language={language} onClose={() => setReflectionOpen(false)} onSave={(reflection) => { setData(current => ({ ...current, reflection })); setReflectionOpen(false); }} />}
    </main>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) {
  return <button className={active ? "active" : ""} onClick={onClick}><span>{icon}</span><small>{label}</small></button>;
}

function TasksPage({ tasks, language, onAdd, onEdit, onDelete }: { tasks: Task[]; language: "en" | "zh"; onAdd: () => void; onEdit: (task: Task) => void; onDelete: (id: string) => void }) {
  const [filter, setFilter] = useState("All"); const [sort, setSort] = useState("urgency"); const zh = language === "zh";
  const categoryZh: Record<string,string> = { Academic:"学业", Career:"事业", Health:"健康", Language:"语言", Life:"生活", Hobby:"兴趣" };
  const visible = tasks.filter(t => filter === "All" || t.category === filter).sort((a,b) => sort === "energy" ? b.energy-a.energy : sort === "category" ? a.category.localeCompare(b.category) : sort === "created" ? b.createdAt.localeCompare(a.createdAt) : b.urgency-a.urgency);
  return <section className="page sub-page"><p className="eyebrow">{zh ? "任务库" : "TASK LIBRARY"}</p><h1>{zh ? "任务" : "Tasks"}</h1><p className="page-copy">{zh ? "管理任务的时间、能量、分类和紧急程度。" : "Manage task time, energy, category, and urgency."}</p><button className="primary-button" onClick={onAdd}>{zh ? "添加任务" : "Add task"}<span>＋</span></button><div className="list-controls"><label><span>{zh ? "筛选" : "Filter"}</span><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="All">{zh ? "全部分类" : "All categories"}</option>{["Academic","Career","Health","Language","Life","Hobby"].map(c=><option key={c} value={c}>{zh ? categoryZh[c] : c}</option>)}</select></label><label><span>{zh ? "排序" : "Sort"}</span><select value={sort} onChange={e=>setSort(e.target.value)}><option value="urgency">{zh ? "紧急程度" : "Urgency"}</option><option value="energy">{zh ? "能量" : "Energy"}</option><option value="category">{zh ? "分类" : "Category"}</option><option value="created">{zh ? "添加时间" : "Date added"}</option></select></label></div><div className="management-list">{visible.map(task=><article key={task.id} className={`category-border ${categoryColors[task.category] || "sand"}`}><div className="management-head"><span className={`category ${categoryColors[task.category] || "sand"}`}>{zh ? categoryZh[task.category] : task.category}</span><span className={`urgency urgency-${task.urgency}`}>{zh ? "紧急" : "Urgency"} {task.urgency}/3</span></div><h3>{task.title}</h3><p>{task.minutes} {zh ? "分钟" : "min"} · {task.energy} {zh ? "能量" : "energy"}</p><div className="row-actions"><button onClick={()=>onEdit(task)}>{zh ? "编辑" : "Edit"}</button><button className="danger" onClick={()=>onDelete(task.id)}>{zh ? "删除" : "Delete"}</button></div></article>)}</div></section>;
}

function IdeasPage({ ideas, language, onAdd, onEdit, onDelete }: { ideas: Idea[]; language: "en" | "zh"; onAdd: () => void; onEdit: (idea: Idea) => void; onDelete: (id: string) => void }) {
  const [filter,setFilter]=useState("All"); const [sort,setSort]=useState("created"); const zh=language==="zh"; const categories=[...new Set(ideas.map(i=>i.category))];
  const visible=ideas.filter(i=>filter==="All"||i.category===filter).sort((a,b)=>sort==="category"?a.category.localeCompare(b.category):b.createdAt.localeCompare(a.createdAt));
  return <section className="page sub-page"><p className="eyebrow">{zh?"想法库":"IDEA VAULT"}</p><h1>{zh?"想法":"Ideas"}</h1><p className="page-copy">{zh?"保存未来可能推进的想法。想法没有紧急程度，也不会自动成为任务。":"Store possible future ideas. Ideas have no urgency and do not automatically become tasks."}</p><button className="primary-button" onClick={onAdd}>{zh?"添加想法":"Add idea"}<span>＋</span></button><div className="list-controls"><label><span>{zh?"筛选":"Filter"}</span><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="All">{zh?"全部分类":"All categories"}</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label><span>{zh?"排序":"Sort"}</span><select value={sort} onChange={e=>setSort(e.target.value)}><option value="created">{zh?"添加时间":"Date added"}</option><option value="category">{zh?"分类":"Category"}</option></select></label></div><div className="management-list">{visible.map(idea=><article key={idea.id}><div className="management-head"><span className="category sky">{idea.category}</span></div><h3>{idea.title}</h3>{idea.description&&<p>{idea.description}</p>}<div className="row-actions"><button onClick={()=>onEdit(idea)}>{zh?"编辑":"Edit"}</button><button className="danger" onClick={()=>onDelete(idea.id)}>{zh?"删除":"Delete"}</button></div></article>)}</div></section>;
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

function TaskSheet({ initial, language, onClose, onSave }: { initial: Task | null; language: "en" | "zh"; onClose: () => void; onSave: (task: Omit<Task, "id" | "status" | "createdAt">) => void }) {
  const [title, setTitle] = useState(initial?.title || ""); const [category, setCategory] = useState(initial?.category || "Academic"); const [minutes, setMinutes] = useState(initial?.minutes || 45); const [energy, setEnergy] = useState(initial?.energy || 15); const [urgency,setUrgency]=useState<1|2|3>(initial?.urgency || 2);
  const categories = ["Academic", "Career", "Health", "Language", "Life", "Hobby"];
  const zh = language === "zh";
  const categoryZh: Record<string, string> = { Academic: "学业", Career: "事业", Health: "健康", Language: "语言", Life: "生活", Hobby: "兴趣" };
  return <Sheet language={language} title={initial ? (zh?"编辑任务":"Edit task") : (zh ? "添加今日任务" : "Add task to today")} intro={zh ? "设置这个执行单位所需的时间、能量和紧急程度。" : "Set the time, energy, and urgency for this execution unit."} onClose={onClose}><form onSubmit={(e: FormEvent) => { e.preventDefault(); if (title.trim()) onSave({ title: title.trim(), category, minutes, energy, urgency }); }}><label className="text-field"><span>{zh ? "任务名称" : "Task title"}</span><input autoFocus required placeholder={zh ? "例如：完成文献综述提纲" : "e.g. Draft literature review outline"} value={title} onChange={e => setTitle(e.target.value)} /></label><label className="text-field"><span>{zh ? "分类" : "Category"}</span><select value={category} onChange={e => setCategory(e.target.value)}>{categories.map(c => <option value={c} key={c}>{zh ? categoryZh[c] : c}</option>)}</select></label><div className="field-row"><label className="text-field"><span>{zh ? "预计分钟" : "Estimated minutes"}</span><input type="number" min="5" value={minutes} onChange={e => setMinutes(Number(e.target.value))} /></label><label className="text-field"><span>{zh ? "预计能量" : "Estimated energy"}</span><input type="number" min="1" max="100" value={energy} onChange={e => setEnergy(Number(e.target.value))} /></label></div><label className="text-field"><span>{zh?"紧急程度":"Urgency"}</span><select value={urgency} onChange={e=>setUrgency(Number(e.target.value) as 1|2|3)}><option value={1}>{zh?"1 · 低":"1 · Low"}</option><option value={2}>{zh?"2 · 中":"2 · Medium"}</option><option value={3}>{zh?"3 · 高":"3 · High"}</option></select></label><button className="submit-button">{initial?(zh?"保存修改":"Save changes"):(zh ? "加入今日计划" : "Add to today’s plan")} <span>✓</span></button></form></Sheet>;
}

function IdeaSheet({ initial, language, onClose, onSave }: { initial: Idea | null; language:"en"|"zh"; onClose:()=>void; onSave:(idea:Omit<Idea,"id"|"createdAt">)=>void }) {
  const [title,setTitle]=useState(initial?.title||""); const [description,setDescription]=useState(initial?.description||""); const [category,setCategory]=useState(initial?.category||"Product"); const zh=language==="zh";
  return <Sheet language={language} title={initial?(zh?"编辑想法":"Edit idea"):(zh?"添加想法":"Add idea")} intro={zh?"想法保存在独立的想法库中，不会自动进入任务列表。":"Ideas remain separate from tasks unless explicitly promoted."} onClose={onClose}><form onSubmit={e=>{e.preventDefault();if(title.trim())onSave({title:title.trim(),description:description.trim(),category:category.trim()||"Other"});}}><label className="text-field"><span>{zh?"标题":"Title"}</span><input autoFocus required value={title} onChange={e=>setTitle(e.target.value)} /></label><label className="text-field"><span>{zh?"描述":"Description"}</span><textarea rows={4} value={description} onChange={e=>setDescription(e.target.value)} /></label><label className="text-field"><span>{zh?"分类":"Category"}</span><input value={category} onChange={e=>setCategory(e.target.value)} /></label><button className="submit-button">{initial?(zh?"保存修改":"Save changes"):(zh?"保存想法":"Save idea")}<span>✓</span></button></form></Sheet>;
}

function ReflectionSheet({ initial, capacity, language, onClose, onSave }: { initial: Reflection | null; capacity: number; language: "en" | "zh"; onClose: () => void; onSave: (r: Reflection) => void }) {
  const [rating, setRating] = useState(initial?.rating || 3); const [perceived, setPerceived] = useState(initial?.perceivedCapacity || capacity); const [note, setNote] = useState(initial?.note || ""); const [exercised, setExercised] = useState(initial?.exercised || false);
  const zh = language === "zh";
  return <Sheet language={language} title={zh ? "晚间复盘" : "Daily reflection"} intro={zh ? "记录执行结果和当天实际状态，用于校准以后对类似日期的预测。" : "Record outcomes and your actual state to calibrate predictions for similar days."} onClose={onClose}><form onSubmit={e => { e.preventDefault(); onSave({ rating, perceivedCapacity: perceived, note, exercised, savedAt: new Date().toISOString() }); }}><Scale label={zh ? "今日整体评分" : "Overall day rating"} value={rating} low={zh ? "低" : "Low"} high={zh ? "高" : "High"} onChange={setRating} /><label className="toggle-field"><span><strong>{zh ? "今天是否运动" : "Exercise completed today"}</strong><small>{zh ? "记录任何有意进行的身体活动" : "Any intentional physical activity"}</small></span><input type="checkbox" checked={exercised} onChange={e => setExercised(e.target.checked)} /></label><label className="range-field"><span><strong>{zh ? "你今天实际有多少可用精力？" : "How much usable capacity did you actually have today?"}</strong><b>{perceived}/100</b></span><small className="capacity-help">{zh ? "回顾今天，不考虑计划了多少任务，估计你真正能用于执行事情的总精力。" : "Looking back, estimate the total capacity you had for doing things, independent of how much you planned."}</small><input type="range" min="0" max="100" value={perceived} onChange={e => setPerceived(Number(e.target.value))} /></label><label className="text-field"><span>{zh ? "相关因素或例外情况" : "Relevant factors or exceptions"}</span><textarea rows={4} value={note} onChange={e => setNote(e.target.value)} placeholder={zh ? "可选，用于后续分析" : "Optional notes for later analysis"} /></label><button className="submit-button">{zh ? "保存复盘" : "Save reflection"} <span>✓</span></button></form></Sheet>;
}
