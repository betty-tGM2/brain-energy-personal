"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient, Session } from "@supabase/supabase-js";

const supabase = createClient(
  "https://gfoagyikxpmirteasdqu.supabase.co",
  "sb_publishable_gcUk1GxBgNhShE_8Gqkx2w_aFI1SPlr",
);

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
  completedAt?: string;
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
  reserve?: "none" | "some" | "high";
  primaryConstraint?: "completed" | "energy" | "time" | "changed" | "estimate";
  note: string;
  exercised: boolean;
  savedAt: string;
};

type AppData = {
  days: Record<string, DayRecord>;
  ideas: Idea[];
};

type DayRecord = {
  checkIn: CheckIn;
  checkedIn: boolean;
  tasks: Task[];
  reflection: Reflection | null;
};

const defaultDay: DayRecord = {
  checkIn: { sleepStart: "23:30", sleepEnd: "07:00", sleep: 7.5, energy: 3, mood: 4, stress: 2, focus: 3, minutes: 300 },
  checkedIn: false,
  tasks: [
    { id: "sample-1", title: "Complete research methods assignment", category: "Academic", minutes: 90, energy: 28, urgency: 3, createdAt: "2026-08-05T08:00:00.000Z", status: "planned" },
    { id: "sample-2", title: "French listening practice", category: "Language", minutes: 30, energy: 12, urgency: 2, createdAt: "2026-08-05T08:01:00.000Z", status: "planned" },
    { id: "sample-3", title: "Post-dinner walk", category: "Health", minutes: 35, energy: 8, urgency: 1, createdAt: "2026-08-05T08:02:00.000Z", status: "planned" },
  ],
  reflection: null,
};

const defaultIdeas: Idea[] = [
    { id: "idea-1", title: "Exchange travel planning tool", description: "Explore constraints and possible user workflows.", category: "Product", createdAt: "2026-08-05T09:00:00.000Z" },
    { id: "idea-2", title: "Learn ceramics", description: "Find an introductory course for a future term.", category: "Learning", createdAt: "2026-08-05T09:01:00.000Z" },
];

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function freshData(): AppData {
  return { days: { [dateKey()]: structuredClone(defaultDay) }, ideas: structuredClone(defaultIdeas) };
}

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
  if (endTotal === startTotal) return 0;
  if (endTotal < startTotal) endTotal += 24 * 60;
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
  const [data, setData] = useState<AppData>(() => freshData());
  const [hydrated, setHydrated] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [ideaOpen, setIdeaOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [cloudUserId, setCloudUserId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<"idle"|"saving"|"saved"|"error">("idle");

  useEffect(() => {
    supabase.auth.getSession().then(({data:{session}})=>{setSession(session);setAuthReady(true);});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,next)=>{if(event==="PASSWORD_RECOVERY")setPasswordRecovery(true);setSession(next);setCloudUserId(null);setAuthReady(true);});
    return ()=>subscription.unsubscribe();
  },[]);

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem("brain-energy-language");
    if (storedLanguage === "zh" || storedLanguage === "en") setLanguage(storedLanguage);
    const stored = window.localStorage.getItem("brain-energy-v1");
    if (stored) {
      try {
        const raw = JSON.parse(stored) as AppData & Partial<DayRecord>;
        const parsed: AppData = raw.days ? raw : { days: { [dateKey()]: { checkIn: raw.checkIn!, checkedIn: Boolean(raw.checkedIn), tasks: raw.tasks || [], reflection: raw.reflection || null } }, ideas: raw.ideas || defaultIdeas };
        const previousDay=Object.entries(parsed.days).sort(([a],[b])=>b.localeCompare(a))[0]?.[1];
        const current = parsed.days[dateKey()] || { ...structuredClone(defaultDay), checkIn: previousDay?.checkIn || structuredClone(defaultDay.checkIn), tasks: [] };
        if (!current.checkIn.sleepStart || !current.checkIn.sleepEnd) {
          const inferred = inferSleepTimes(current.checkIn.sleep || 7.5);
          current.checkIn = { ...current.checkIn, ...inferred };
        }
        current.checkIn.sleep = sleepDuration(current.checkIn.sleepStart, current.checkIn.sleepEnd);
        if (current.reflection && typeof current.reflection.exercised !== "boolean") current.reflection.exercised = false;
        const englishSamples: Record<string, Pick<Task, "title" | "category">> = {
          "sample-1": { title: "Complete research methods assignment", category: "Academic" },
          "sample-2": { title: "French listening practice", category: "Language" },
          "sample-3": { title: "Post-dinner walk", category: "Health" },
        };
        current.tasks = current.tasks.map((task, index) => ({ ...task, ...(englishSamples[task.id] || {}), urgency: task.urgency || 2, createdAt: task.createdAt || new Date(Date.now() + index * 1000).toISOString() }));
        parsed.days[dateKey()] = current;
        if (!Array.isArray(parsed.ideas)) parsed.ideas = defaultIdeas;
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

  useEffect(()=>{
    if(!hydrated||!session?.user||cloudUserId===session.user.id)return;
    let cancelled=false;
    (async()=>{
      const {data:remote,error}=await supabase.from("user_app_state").select("data").eq("user_id",session.user.id).maybeSingle();
      if(cancelled)return;
      if(error){setSyncStatus("error");return;}
      if(remote?.data)setData(remote.data as AppData);
      else await supabase.from("user_app_state").upsert({user_id:session.user.id,data,updated_at:new Date().toISOString()});
      if(!cancelled){setCloudUserId(session.user.id);setSyncStatus("saved");}
    })();
    return()=>{cancelled=true;};
  },[hydrated,session,cloudUserId]);

  useEffect(()=>{
    if(!cloudUserId)return;
    setSyncStatus("saving");
    const timer=window.setTimeout(async()=>{
      const {error}=await supabase.from("user_app_state").upsert({user_id:cloudUserId,data,updated_at:new Date().toISOString()});
      setSyncStatus(error?"error":"saved");
    },600);
    return()=>window.clearTimeout(timer);
  },[data,cloudUserId]);

  const today = dateKey();
  const day = data.days[today] || defaultDay;
  const capacity = calculateCapacity(day.checkIn);
  const activeTasks = day.tasks.filter((task) => task.status !== "skipped");
  const plannedEnergy = activeTasks.reduce((sum, task) => sum + task.energy, 0);
  const plannedMinutes = activeTasks.reduce((sum, task) => sum + task.minutes, 0);
  const completed = day.tasks.filter((task) => task.status === "completed").length;
  const completedEnergy = day.tasks.filter((task) => task.status === "completed").reduce((sum, task) => sum + task.energy, 0);
  const completedMinutes = day.tasks.filter((task) => task.status === "completed").reduce((sum, task) => sum + task.minutes, 0);
  const remainingEnergy = Math.max(0, capacity - completedEnergy);
  const remainingMinutes = Math.max(0, day.checkIn.minutes - completedMinutes);
  const unfinishedTasks = day.tasks.filter((task) => task.status === "planned" || task.status === "started");
  let fitEnergy = 0;
  let fitMinutes = 0;
  const fittingTasks = [...unfinishedTasks].sort((a, b) => b.urgency - a.urgency || a.energy - b.energy).filter((task) => {
    if (fitEnergy + task.energy > remainingEnergy || fitMinutes + task.minutes > remainingMinutes) return false;
    fitEnergy += task.energy; fitMinutes += task.minutes;
    return true;
  });
  const tasksThatFit = fittingTasks.length;
  const usedRatio = Math.min(100, Math.round((completedEnergy / capacity) * 100));
  const loadRatio = Math.round((plannedEnergy / capacity) * 100);
  const zh = language === "zh";
  const assessmentLabel = loadRatio > 100
    ? (zh ? "超过预计容量" : "Above estimated capacity")
    : loadRatio > 80
      ? (zh ? "接近预计容量" : "Near estimated capacity")
      : (zh ? "在预计容量范围内" : "Within estimated capacity");

  function updateCheckIn(next: CheckIn) {
    setData((current) => ({ ...current, days: { ...current.days, [today]: { ...(current.days[today] || structuredClone(defaultDay)), checkIn: next, checkedIn: true } } }));
    setCheckInOpen(false);
  }

  function saveTask(task: Omit<Task, "id" | "status" | "createdAt">) {
    setData((current) => { const record=current.days[today]||structuredClone(defaultDay); return ({ ...current, days:{...current.days,[today]:{...record,tasks: editingTask
      ? record.tasks.map((item) => item.id === editingTask.id ? { ...item, ...task } : item)
      : [...record.tasks, { ...task, id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: "planned" }]}} }); });
    setTaskOpen(false);
    setEditingTask(null);
  }

  function openTaskEditor(task?: Task) { setEditingTask(task || null); setTaskOpen(true); }
  function deleteTask(id: string) {
    if (window.confirm(zh ? "删除这个任务？此操作无法撤销。" : "Delete this task? This cannot be undone.")) setData(current => { const record=current.days[today]; return ({ ...current, days:{...current.days,[today]:{...record,tasks:record.tasks.filter(task=>task.id!==id)}} }); });
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
    setData((current) => { const record=current.days[today]; return ({ ...current, days:{...current.days,[today]:{...record,tasks:record.tasks.map(task=>task.id===id?{...task,status,completedAt:status==="completed"?new Date().toISOString():undefined}:task)}} }); });
  }

  const categoryZh: Record<string, string> = { Academic: "学业", Career: "事业", Health: "健康", Language: "语言", Life: "生活", Hobby: "兴趣" };
  const sampleTitleZh: Record<string, string> = { "sample-1": "完成研究方法作业", "sample-2": "法语听力练习", "sample-3": "晚饭后散步" };

  if(!authReady)return <main className="auth-shell"><div className="auth-card"><div className="brand-mark"><span/></div><p className="eyebrow">BRAIN ENERGY</p><h1>{language==="zh"?"正在验证账户":"Verifying account"}</h1><p>{language==="zh"?"正在建立安全连接。":"Establishing a secure session."}</p></div></main>;
  if(!session)return <AuthScreen language={language} onLanguage={()=>setLanguage(language==="zh"?"en":"zh")}/>;
  if(passwordRecovery)return <PasswordRecoveryScreen language={language} onLanguage={()=>setLanguage(language==="zh"?"en":"zh")} onDone={()=>setPasswordRecovery(false)}/>;

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <div className="brand-mark" aria-hidden="true"><span /></div>
        <div className="brand-copy"><strong>Brain Energy</strong><span>{zh ? "个人执行模型" : "Personal execution model"}</span></div>
        <div className="account-tools"><span className={`sync-status ${syncStatus}`}>{syncStatus==="saving"?(zh?"同步中":"Syncing"):syncStatus==="error"?(zh?"同步失败":"Sync error"):(zh?"已同步":"Synced")}</span><button className="language-toggle" aria-label={zh ? "Switch to English" : "切换到中文"} onClick={() => setLanguage(zh ? "en" : "zh")}>{zh ? "EN" : "中文"}</button><button className="signout-button" onClick={()=>supabase.auth.signOut()}>{zh?"退出":"Sign out"}</button></div>
      </header>

      {tab === "today" && (
        <section className="page today-page">
          <div className="day-heading">
            <div><p className="eyebrow">{hydrated ? todayLabel(language) : (zh ? "今天" : "TODAY")}</p><h1>{zh ? "每日执行概览" : "Daily execution overview"}</h1></div>
            <button className={`checkin-pill ${day.checkedIn ? "done" : ""}`} onClick={() => setCheckInOpen(true)}>
              <span>{day.checkedIn ? "✓" : "+"}</span>{day.checkedIn ? (zh ? "已完成状态记录" : "Check-in recorded") : (zh ? "晨间状态记录" : "Daily check-in")}
            </button>
          </div>

          <article className="capacity-card">
            <div className="capacity-top">
              <div><p className="card-kicker">{zh ? "今日容量" : "TODAY’S CAPACITY"}</p><div className="capacity-number"><strong>{capacity}</strong><span>/ 100</span></div></div>
              <div className="energy-orbit" style={{ "--capacity": `${capacity * 3.6}deg` } as React.CSSProperties}>
                <div><span>{zh ? "状态" : "STATE"}</span><b>{capacity >= 75 ? (zh ? "高" : "High") : capacity >= 55 ? (zh ? "中等" : "Moderate") : (zh ? "低" : "Low")}</b></div>
              </div>
            </div>
            <p className="capacity-note">{day.checkedIn ? (zh ? "根据睡眠时长、入睡和起床时间，以及今天的身体能量、心情、压力和专注度计算。" : "Calculated from sleep duration, bedtime, wake time, physical energy, mood, stress, and focus.") : (zh ? "完成晨间状态记录以生成今日容量估计。" : "Complete the daily check-in to generate a state-based capacity estimate.")}</p>
            <div className="signals">
              <span>{zh ? "睡眠" : "Sleep"} {day.checkIn.sleepStart}–{day.checkIn.sleepEnd} ({day.checkIn.sleep}h)</span><span>{zh ? "睡眠时段贡献" : "Timing effect"} {sleepTimingContribution(day.checkIn) >= 0 ? "+" : ""}{sleepTimingContribution(day.checkIn)}</span><span>{zh ? "压力" : "Stress"} {day.checkIn.stress}/5</span><span>{zh ? "专注" : "Focus"} {day.checkIn.focus}/5</span>
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
            <div className="task-fit"><strong>{unfinishedTasks.length === 0 ? (zh ? "今日计划已处理完毕" : "No unfinished tasks") : (zh ? `预计还可完成 ${tasksThatFit} / ${unfinishedTasks.length} 项任务` : `Estimated room for ${tasksThatFit} of ${unfinishedTasks.length} unfinished tasks`)}</strong><p>{zh ? `剩余 ${remainingEnergy} 能量 · ${remainingMinutes} 分钟。按紧急程度优先，同时满足时间和能量限制。` : `${remainingEnergy} energy · ${remainingMinutes} min remaining. Prioritized by urgency while respecting both limits.`}</p>{fittingTasks.length>0&&<p className="fit-names">{zh?"建议组合":"Likely fit"}: {fittingTasks.map(task=>zh?(sampleTitleZh[task.id]||task.title):task.title).join(" + ")}</p>}</div>
            <div className={`plan-load ${loadRatio > 100 ? "over" : ""}`}><span>{zh ? "计划总负载" : "Plan load"}</span><b>{plannedEnergy} / {capacity} · {loadRatio}%</b><small>{assessmentLabel} · {Math.round(plannedMinutes / 60 * 10) / 10}h</small></div>
          </article>

          <div className="task-list">
            {day.tasks.map((task, index) => (
              <article className={`task-card status-${task.status}`} key={task.id}>
                <button className="task-check" aria-label={`${task.title} status`} onClick={() => setTaskStatus(task.id, task.status === "completed" ? "planned" : "completed")}>
                  {task.status === "completed" ? "✓" : index + 1}
                </button>
                <div className="task-main">
                  <span className={`category ${categoryColors[task.category] || "sand"}`}>{zh ? (categoryZh[task.category] || task.category) : task.category}</span>
                  <h3>{zh ? (sampleTitleZh[task.id] || task.title) : task.title}</h3>
                  <p>{task.minutes} {zh ? "分钟" : "min"} <i /> {task.energy} {zh ? "能量" : "energy"} <i /> {zh ? "紧急度" : "urgency"} {task.urgency}/3</p>
                </div>
                <div className="task-actions">{task.status !== "completed" && task.status !== "skipped" && <button onClick={() => setTaskStatus(task.id, task.status === "started" ? "completed" : "started")}>{task.status === "started" ? (zh ? "完成" : "Complete") : (zh ? "开始" : "Start")}</button>}<TaskOverflowMenu language={language} skipped={task.status==="skipped"} onSkip={() => setTaskStatus(task.id, task.status==="skipped"?"planned":"skipped")} onEdit={() => openTaskEditor(task)} onDelete={() => deleteTask(task.id)} /></div>
              </article>
            ))}
          </div>

          <button className="reflection-banner" onClick={() => setReflectionOpen(true)}>
            <span className="moon">R</span><span><strong>{day.reflection ? (zh ? "晚间复盘已记录" : "Daily reflection recorded") : (zh ? "完成晚间复盘" : "Complete daily reflection")}</strong><small>{day.reflection ? (zh ? `今日整体评分：${day.reflection.rating}/5` : `Overall day rating: ${day.reflection.rating}/5`) : (zh ? "记录执行结果和感知容量，用于模型校准。" : "Record outcomes and perceived capacity for model calibration.")}</small></span><b>→</b>
          </button>
        </section>
      )}

      {tab === "tasks" && <TasksPage tasks={day.tasks} language={language} onAdd={() => openTaskEditor()} onEdit={openTaskEditor} onDelete={deleteTask} />}
      {tab === "ideas" && <IdeasPage ideas={data.ideas} language={language} onAdd={() => openIdeaEditor()} onEdit={openIdeaEditor} onDelete={deleteIdea} />}
      {tab === "history" && <HistoryPage data={data} language={language} onImport={setData} />}

      <nav className="bottom-nav" aria-label="Primary navigation">
        <NavButton active={tab === "today"} icon="01" label={zh ? "今天" : "Today"} onClick={() => setTab("today")} />
        <NavButton active={tab === "tasks"} icon="02" label={zh ? "任务" : "Tasks"} onClick={() => setTab("tasks")} />
        <NavButton active={tab === "ideas"} icon="03" label={zh ? "想法" : "Ideas"} onClick={() => setTab("ideas")} />
        <NavButton active={tab === "history"} icon="04" label={zh ? "分析" : "Analysis"} onClick={() => setTab("history")} />
      </nav>

      {checkInOpen && <CheckInSheet initial={day.checkIn} language={language} onClose={() => setCheckInOpen(false)} onSave={updateCheckIn} />}
      {taskOpen && <TaskSheet initial={editingTask} language={language} onClose={() => { setTaskOpen(false); setEditingTask(null); }} onSave={saveTask} />}
      {ideaOpen && <IdeaSheet initial={editingIdea} language={language} onClose={() => { setIdeaOpen(false); setEditingIdea(null); }} onSave={saveIdea} />}
      {reflectionOpen && <ReflectionSheet initial={day.reflection} capacity={capacity} completedEnergy={completedEnergy} completedCount={completed} totalCount={activeTasks.length} latestCompletedAt={day.tasks.map(task=>task.completedAt||"").sort().at(-1)||""} language={language} onClose={() => setReflectionOpen(false)} onSave={(reflection) => { setData(current => ({ ...current, days:{...current.days,[today]:{...(current.days[today]||structuredClone(defaultDay)),reflection}} })); setReflectionOpen(false); }} />}
    </main>
  );
}

function AuthScreen({language,onLanguage}:{language:"en"|"zh";onLanguage:()=>void}){
  const zh=language==="zh"; const [mode,setMode]=useState<"signin"|"signup"|"recovery">("signin"); const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [confirm,setConfirm]=useState(""); const [message,setMessage]=useState(""); const [error,setError]=useState(""); const [loading,setLoading]=useState(false);
  const changeMode=(next:typeof mode)=>{setMode(next);setError("");setMessage("");setPassword("");setConfirm("");};
  const friendlyError=(text:string)=>text.toLowerCase().includes("rate limit")?(zh?"邮件请求过于频繁，请稍后再试。":"Too many email requests. Please try again later."):text.toLowerCase().includes("invalid login")?(zh?"邮箱或密码不正确。如果你还没有密码，请选择“设置或忘记密码”。":"Incorrect email or password. If you have not set a password, use Set or forgot password."):text;
  const submit=async(e:FormEvent)=>{e.preventDefault();setError("");setMessage("");setLoading(true);const normalized=email.trim().toLowerCase();if(mode!=="recovery"&&password.length<8){setError(zh?"密码至少需要 8 个字符。":"Password must contain at least 8 characters.");setLoading(false);return;}if(mode==="signup"&&password!==confirm){setError(zh?"两次输入的密码不一致。":"Passwords do not match.");setLoading(false);return;}let actionError=null;if(mode==="signin"){({error:actionError}=await supabase.auth.signInWithPassword({email:normalized,password}));}else if(mode==="signup"){({error:actionError}=await supabase.auth.signUp({email:normalized,password,options:{emailRedirectTo:window.location.origin}}));if(!actionError)setMessage(zh?"账户已创建。请打开确认邮件，然后使用邮箱和密码登录。":"Account created. Confirm your email, then sign in with your email and password.");}else{({error:actionError}=await supabase.auth.resetPasswordForEmail(normalized,{redirectTo:window.location.origin}));if(!actionError)setMessage(zh?"密码设置链接已发送。请打开最新一封邮件。":"A password setup link has been sent. Open the latest email.");}if(actionError)setError(friendlyError(actionError.message));setLoading(false);};
  const title=mode==="signin"?(zh?"登录个人执行模型":"Sign in to your execution model"):mode==="signup"?(zh?"创建体验账户":"Create an account"):(zh?"设置或重置密码":"Set or reset password");
  return <main className="auth-shell"><button className="auth-language" onClick={onLanguage}>{zh?"EN":"中文"}</button><section className="auth-card"><div className="brand-mark"><span/></div><p className="eyebrow">BRAIN ENERGY</p><h1>{title}</h1><p>{zh?"任何邮箱都可以注册。每个账户的记录独立存储，其他用户无法查看。":"Anyone can register with an email address. Records are private to each account and sync across devices."}</p><div className="auth-tabs"><button className={mode==="signin"?"active":""} type="button" onClick={()=>changeMode("signin")}>{zh?"登录":"Sign in"}</button><button className={mode==="signup"?"active":""} type="button" onClick={()=>changeMode("signup")}>{zh?"创建账户":"Create account"}</button></div><form onSubmit={submit}><label className="text-field"><span>{zh?"邮箱":"Email"}</span><input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/></label>{mode!=="recovery"&&<label className="text-field"><span>{zh?"密码":"Password"}</span><input type="password" autoComplete={mode==="signin"?"current-password":"new-password"} minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} placeholder={zh?"至少 8 个字符":"At least 8 characters"}/></label>}{mode==="signup"&&<label className="text-field"><span>{zh?"确认密码":"Confirm password"}</span><input type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>}{error&&<p className="auth-error">{error}</p>}{message&&<p className="auth-message">{message}</p>}<button className="submit-button" disabled={loading}>{loading?(zh?"处理中…":"Working…"):mode==="signin"?(zh?"登录":"Sign in"):mode==="signup"?(zh?"创建账户":"Create account"):(zh?"发送密码设置链接":"Send password setup link")}<span>→</span></button></form><button className="auth-text-button" type="button" onClick={()=>changeMode(mode==="recovery"?"signin":"recovery")}>{mode==="recovery"?(zh?"返回登录":"Back to sign in"):(zh?"设置或忘记密码":"Set or forgot password")}</button><small className="auth-footnote">{mode==="signup"?(zh?"首次创建账户需要确认邮箱。":"Email confirmation is required for a new account."):(zh?"密码登录不会发送登录邮件。":"Password sign-in does not send login emails.")}</small></section></main>;
}

function PasswordRecoveryScreen({language,onLanguage,onDone}:{language:"en"|"zh";onLanguage:()=>void;onDone:()=>void}){
  const zh=language==="zh"; const [password,setPassword]=useState(""); const [confirm,setConfirm]=useState(""); const [error,setError]=useState(""); const [loading,setLoading]=useState(false);
  const submit=async(e:FormEvent)=>{e.preventDefault();setError("");if(password.length<8){setError(zh?"密码至少需要 8 个字符。":"Password must contain at least 8 characters.");return;}if(password!==confirm){setError(zh?"两次输入的密码不一致。":"Passwords do not match.");return;}setLoading(true);const {error:updateError}=await supabase.auth.updateUser({password});setLoading(false);if(updateError)setError(updateError.message);else onDone();};
  return <main className="auth-shell"><button className="auth-language" onClick={onLanguage}>{zh?"EN":"中文"}</button><section className="auth-card"><div className="brand-mark"><span/></div><p className="eyebrow">BRAIN ENERGY</p><h1>{zh?"设置新密码":"Set a new password"}</h1><p>{zh?"为这个账户设置一个至少 8 个字符的密码。":"Set a password of at least 8 characters for this account."}</p><form onSubmit={submit}><label className="text-field"><span>{zh?"新密码":"New password"}</span><input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)}/></label><label className="text-field"><span>{zh?"确认新密码":"Confirm new password"}</span><input type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>{error&&<p className="auth-error">{error}</p>}<button className="submit-button" disabled={loading}>{loading?(zh?"正在保存…":"Saving…"):(zh?"保存密码":"Save password")}<span>→</span></button></form></section></main>;
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) {
  return <button className={active ? "active" : ""} onClick={onClick}><span>{icon}</span><small>{label}</small></button>;
}

function TaskOverflowMenu({ language, skipped=false, onSkip, onEdit, onDelete }: { language:"en"|"zh"; skipped?:boolean; onSkip?:()=>void; onEdit:()=>void; onDelete:()=>void }) {
  const [open,setOpen]=useState(false); const zh=language==="zh";
  return <div className="overflow-menu"><button className="ellipsis" aria-label={zh?"更多任务操作":"More task actions"} aria-expanded={open} onClick={()=>setOpen(!open)}>•••</button>{open&&<div className="menu-popover"><button onClick={()=>{setOpen(false);onEdit();}}>{zh?"编辑任务":"Edit task"}</button>{onSkip&&<button onClick={()=>{setOpen(false);onSkip();}}>{skipped?(zh?"恢复任务":"Restore task"):(zh?"跳过任务":"Skip task")}</button>}<button className="danger" onClick={()=>{setOpen(false);onDelete();}}>{zh?"删除任务":"Delete task"}</button></div>}</div>;
}

function TasksPage({ tasks, language, onAdd, onEdit, onDelete }: { tasks: Task[]; language: "en" | "zh"; onAdd: () => void; onEdit: (task: Task) => void; onDelete: (id: string) => void }) {
  const [filter, setFilter] = useState("All"); const [sort, setSort] = useState("urgency"); const zh = language === "zh";
  const categoryZh: Record<string,string> = { Academic:"学业", Career:"事业", Health:"健康", Language:"语言", Life:"生活", Hobby:"兴趣" };
  const visible = tasks.filter(t => filter === "All" || t.category === filter).sort((a,b) => sort === "energy" ? b.energy-a.energy : sort === "category" ? a.category.localeCompare(b.category) : sort === "created" ? b.createdAt.localeCompare(a.createdAt) : b.urgency-a.urgency);
  return <section className="page sub-page"><p className="eyebrow">{zh ? "任务库" : "TASK LIBRARY"}</p><h1>{zh ? "任务" : "Tasks"}</h1><p className="page-copy">{zh ? "管理任务的时间、能量、分类和紧急程度。" : "Manage task time, energy, category, and urgency."}</p><button className="primary-button" onClick={onAdd}>{zh ? "添加任务" : "Add task"}<span>＋</span></button><div className="list-controls"><label><span>{zh ? "筛选" : "Filter"}</span><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="All">{zh ? "全部分类" : "All categories"}</option>{["Academic","Career","Health","Language","Life","Hobby"].map(c=><option key={c} value={c}>{zh ? categoryZh[c] : c}</option>)}</select></label><label><span>{zh ? "排序" : "Sort"}</span><select value={sort} onChange={e=>setSort(e.target.value)}><option value="urgency">{zh ? "紧急程度" : "Urgency"}</option><option value="energy">{zh ? "能量" : "Energy"}</option><option value="category">{zh ? "分类" : "Category"}</option><option value="created">{zh ? "添加时间" : "Date added"}</option></select></label></div><div className="management-list">{visible.map(task=><article key={task.id} className={`category-border ${categoryColors[task.category] || "sand"}`}><div className="management-head"><span className={`category ${categoryColors[task.category] || "sand"}`}>{zh ? categoryZh[task.category] : task.category}</span><div className="management-meta"><span className={`urgency urgency-${task.urgency}`}>{zh ? "紧急" : "Urgency"} {task.urgency}/3</span><TaskOverflowMenu language={language} onEdit={()=>onEdit(task)} onDelete={()=>onDelete(task.id)} /></div></div><h3>{task.title}</h3><p>{task.minutes} {zh ? "分钟" : "min"} · {task.energy} {zh ? "能量" : "energy"}</p></article>)}</div></section>;
}

function IdeasPage({ ideas, language, onAdd, onEdit, onDelete }: { ideas: Idea[]; language: "en" | "zh"; onAdd: () => void; onEdit: (idea: Idea) => void; onDelete: (id: string) => void }) {
  const [filter,setFilter]=useState("All"); const [sort,setSort]=useState("created"); const zh=language==="zh"; const categories=[...new Set(ideas.map(i=>i.category))];
  const visible=ideas.filter(i=>filter==="All"||i.category===filter).sort((a,b)=>sort==="category"?a.category.localeCompare(b.category):b.createdAt.localeCompare(a.createdAt));
  return <section className="page sub-page"><p className="eyebrow">{zh?"想法库":"IDEA VAULT"}</p><h1>{zh?"想法":"Ideas"}</h1><p className="page-copy">{zh?"保存未来可能推进的想法。想法没有紧急程度，也不会自动成为任务。":"Store possible future ideas. Ideas have no urgency and do not automatically become tasks."}</p><button className="primary-button" onClick={onAdd}>{zh?"添加想法":"Add idea"}<span>＋</span></button><div className="list-controls"><label><span>{zh?"筛选":"Filter"}</span><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="All">{zh?"全部分类":"All categories"}</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label><span>{zh?"排序":"Sort"}</span><select value={sort} onChange={e=>setSort(e.target.value)}><option value="created">{zh?"添加时间":"Date added"}</option><option value="category">{zh?"分类":"Category"}</option></select></label></div><div className="management-list">{visible.map(idea=><article key={idea.id}><div className="management-head"><span className="category sky">{idea.category}</span></div><h3>{idea.title}</h3>{idea.description&&<p>{idea.description}</p>}<div className="row-actions"><button onClick={()=>onEdit(idea)}>{zh?"编辑":"Edit"}</button><button className="danger" onClick={()=>onDelete(idea.id)}>{zh?"删除":"Delete"}</button></div></article>)}</div></section>;
}

function HistoryPage({ data, language, onImport }: { data:AppData; language:"en"|"zh"; onImport:(data:AppData)=>void }) {
  const zh=language==="zh";
  const entries=Object.entries(data.days).sort(([a],[b])=>a.localeCompare(b));
  const recent=entries.slice(-7);
  const cutoff=new Date(); cutoff.setDate(cutoff.getDate()-29); const cutoffKey=dateKey(cutoff);
  const eligible=entries.filter(([date,record])=>date>=cutoffKey&&record.checkedIn&&Boolean(record.reflection)&&record.reflection?.primaryConstraint!=="time"&&record.reflection?.primaryConstraint!=="changed");
  const latest=entries.at(-1)?.[1]||defaultDay;
  const sleepFeatures=sleepTimingFeatures(latest.checkIn);
  const observed=recent.map(([date,record])=>({date,value:record.reflection?.perceivedCapacity??(record.checkedIn?calculateCapacity(record.checkIn):null)}));
  const values=observed.map(item=>item.value).filter((value):value is number=>value!==null);
  const mean=values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):null;
  const exportData=()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=`brain-energy-${dateKey()}.json`;link.click();URL.revokeObjectURL(url);};
  const importFile=(file?:File)=>{if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const parsed=JSON.parse(String(reader.result));if(!parsed?.days||!parsed?.ideas)throw new Error();onImport(parsed as AppData);window.alert(zh?"数据已导入。":"Data imported.");}catch{window.alert(zh?"无法读取这个备份文件。":"This backup file is not valid.");}};reader.readAsText(file);};
  return <section className="page sub-page"><p className="eyebrow">{zh?"模型与分析":"MODEL & ANALYSIS"}</p><h1>{zh?"执行规律":"Execution patterns"}</h1><p className="page-copy">{zh?"仅展示真实保存的每日记录。活动模型只使用最近30个日历日内的合格观察。":"Only genuine saved daily records are shown. The active model will use eligible observations from the most recent 30 calendar days."}</p><article className="model-card"><span>{zh?"30天滚动模型":"30-DAY ROLLING MODEL"}</span><strong>{eligible.length>=10?(zh?"具备拟合个人模型的最低样本量":"Minimum sample threshold reached"):(zh?"基准公式 · 正在收集观察数据":"Baseline heuristic · collecting observations")}</strong><p>{zh?"完整的晨间记录和晚间复盘构成一条合格记录。达到10条前不会估计个人系数。":"A completed morning check-in and evening reflection form one eligible observation. Personal coefficients are not estimated before 10 observations."}</p><div className="model-progress"><i style={{width:`${Math.min(100,eligible.length*10)}%`}}/></div><small>{eligible.length} / 10 {zh?"条合格记录":"eligible observations"}</small></article><article className="feature-card"><span>{zh?"最新睡眠特征":"LATEST SLEEP FEATURES"}</span><strong>{latest.checkIn.sleepStart}–{latest.checkIn.sleepEnd} · {sleepFeatures.duration}h</strong><p>{zh?"保存睡眠时长、入睡时间、起床时间和睡眠中点；时钟时间采用循环编码。":"Duration, bedtime, wake time, and midpoint are retained; clock times use circular encoding."}</p></article><article className="chart-card"><div><strong>{zh?"最近7条记录":"Latest 7 records"}</strong><span>{mean===null?(zh?"暂无数据":"No data"):`${zh?"均值":"Mean"} ${mean}`}</span></div>{observed.length?<><div className="bars">{observed.map((item,i)=><span key={item.date} style={{height:`${item.value??3}%`}} className={i===observed.length-1?"current":""}/>)}</div><div className="days">{observed.map(item=><small key={item.date}>{item.date.slice(5)}</small>)}</div></>:<p className="empty-history">{zh?"完成一次晨间记录后，这里才会出现数据。":"Data will appear after a morning check-in is recorded."}</p>}</article><article className="insight-card"><span>{zh?"数据备份":"DATA BACKUP"}</span><strong>{entries.length} {zh?"个日期已保存":"saved dates"}</strong><p>{zh?"数据目前保存在这台设备的浏览器中。定期导出备份，或在同一应用中导入。":"Data is currently stored in this device’s browser. Export a backup regularly or import it back into this app."}</p><div className="backup-actions"><button onClick={exportData}>{zh?"导出 JSON":"Export JSON"}</button><label>{zh?"导入 JSON":"Import JSON"}<input type="file" accept="application/json" onChange={e=>importFile(e.target.files?.[0])}/></label></div></article></section>;
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
  const duration=sleepDuration(form.sleepStart,form.sleepEnd); const invalidSleep=duration<2||duration>16;
  return <Sheet language={language} title={zh ? "晨间状态记录" : "Daily check-in"} intro={zh ? "记录用于估计今日执行容量的晨间变量。" : "Record the morning variables used to estimate today’s execution capacity."} onClose={onClose}><form onSubmit={(e) => { e.preventDefault(); if(!invalidSleep)onSave({ ...form, sleep: duration }); }}><div className="time-section"><span className="field-label">{zh ? "睡眠时间" : "Sleep interval"}</span><div className="field-row"><label className="text-field"><span>{zh ? "入睡时间" : "Sleep time"}</span><input type="time" value={form.sleepStart} onChange={e => updateSleep("sleepStart", e.target.value)} /></label><label className="text-field"><span>{zh ? "起床时间" : "Wake time"}</span><input type="time" value={form.sleepEnd} onChange={e => updateSleep("sleepEnd", e.target.value)} /></label></div><small className={`computed-value ${invalidSleep?"invalid":""}`}>{invalidSleep?(zh?"请检查时间：睡眠时长应在2–16小时之间。":"Check the interval: sleep duration must be 2–16 hours."):`${zh?"计算时长":"Calculated duration"}: ${duration} ${zh?"小时":"hours"}`}</small></div><Scale label={zh ? "身体能量" : "Physical energy"} value={form.energy} low={zh ? "低" : "Low"} high={zh ? "高" : "High"} onChange={energy => setForm({ ...form, energy })} /><Scale label={zh ? "心情" : "Mood"} value={form.mood} low={zh ? "低" : "Low"} high={zh ? "高" : "High"} onChange={mood => setForm({ ...form, mood })} /><Scale label={zh ? "压力" : "Stress"} value={form.stress} low={zh ? "低" : "Low"} high={zh ? "高" : "High"} onChange={stress => setForm({ ...form, stress })} /><Scale label={zh ? "专注度" : "Focus"} value={form.focus} low={zh ? "低" : "Low"} high={zh ? "高" : "High"} onChange={focus => setForm({ ...form, focus })} /><div className="time-section available-time"><span className="field-label">{zh ? "今天可用时间" : "Available time today"}</span><div className="duration-selects"><label><span>{zh ? "小时" : "Hours"}</span><select value={hours} onChange={e => setForm({ ...form, minutes: Number(e.target.value) * 60 + halfHour })}>{Array.from({ length: 17 }, (_, i) => <option value={i} key={i}>{i}</option>)}</select></label><label><span>{zh ? "分钟" : "Minutes"}</span><select value={halfHour} onChange={e => setForm({ ...form, minutes: hours * 60 + Number(e.target.value) })}><option value={0}>00</option><option value={30}>30</option></select></label></div></div><button className="submit-button" disabled={invalidSleep}>{zh ? "计算今日容量" : "Calculate capacity"} <span>→</span></button></form></Sheet>;
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

function ReflectionSheet({ initial, capacity, completedEnergy, completedCount, totalCount, latestCompletedAt, language, onClose, onSave }: { initial: Reflection | null; capacity: number; completedEnergy:number; completedCount:number; totalCount:number; latestCompletedAt:string; language: "en" | "zh"; onClose: () => void; onSave: (r: Reflection) => void }) {
  const systemEstimate = Math.min(100, Math.max(capacity, completedEnergy));
  const initialReserve=initial?.reserve||((initial?.perceivedCapacity||systemEstimate)<=completedEnergy+5?"none":(initial?.perceivedCapacity||systemEstimate)<systemEstimate?"some":"high");
  const [rating, setRating] = useState(initial?.rating || 3); const [reserve,setReserve]=useState<"none"|"some"|"high">(initialReserve); const [constraint,setConstraint]=useState<"completed"|"energy"|"time"|"changed"|"estimate">(initial?.primaryConstraint||"completed"); const [note, setNote] = useState(initial?.note || ""); const [exercised, setExercised] = useState(initial?.exercised || false);
  const zh = language === "zh";
  const activityAfterReflection=Boolean(initial&&latestCompletedAt&&latestCompletedAt>initial.savedAt);
  const inferredCapacity=reserve==="none"?completedEnergy:reserve==="some"?Math.max(completedEnergy,Math.round((completedEnergy+systemEstimate)/2)):systemEstimate;
  const showConstraint=reserve!=="high"&&completedCount<totalCount;
  const constraints=[{value:"energy",en:"Insufficient energy",zh:"精力不足"},{value:"time",en:"Insufficient time",zh:"时间不足"},{value:"changed",en:"Priorities changed",zh:"优先事项或计划改变"},{value:"estimate",en:"Estimate inaccurate",zh:"任务估计不准确"}] as const;
  const chooseReserve=(value:"none"|"some"|"high")=>{setReserve(value);if(value==="high")setConstraint("completed");};
  return <Sheet language={language} title={zh ? "晚间复盘" : "Daily reflection"} intro={zh ? "回答执行结果；系统在后台估计实际容量。" : "Record the outcome; the system infers actual capacity in the background."} onClose={onClose}><form onSubmit={e => { e.preventDefault(); onSave({ rating, perceivedCapacity: inferredCapacity, reserve, primaryConstraint:showConstraint?constraint:"completed", note, exercised, savedAt: new Date().toISOString() }); }}><div className="observed-capacity"><div><span>{zh?"自动记录":"AUTO-OBSERVED"}</span><strong>{completedEnergy} {zh?"预计任务能量已完成":"estimated task energy completed"}</strong><small>{completedCount} / {totalCount} {zh?"项计划任务":"planned tasks"}</small></div><div><span>{zh?"晨间估计":"MORNING ESTIMATE"}</span><strong>{systemEstimate}/100</strong><small>{zh?"作为推断的参考值":"Used as a prior for inference"}</small></div></div>{activityAfterReflection&&<p className="reflection-warning">{zh?"上次复盘后有新的任务完成，请重新检查下面的答案。":"New task activity was recorded after the last reflection. Review the answers below."}</p>}<Scale label={zh ? "今日整体评分" : "Overall day rating"} value={rating} low={zh ? "低" : "Low"} high={zh ? "高" : "High"} onChange={setRating} /><label className="toggle-field"><span><strong>{zh ? "今天是否运动" : "Exercise completed today"}</strong><small>{zh ? "记录任何有意进行的身体活动" : "Any intentional physical activity"}</small></span><input type="checkbox" checked={exercised} onChange={e => setExercised(e.target.checked)} /></label><fieldset className="choice-field"><legend>{zh?"结束今天的任务时，你还剩多少精力？":"When you stopped working, how much energy remained?"}</legend><div className="choice-buttons">{([{value:"none",en:"None",zh:"没有"},{value:"some",en:"Some",zh:"还有一点"},{value:"high",en:"A lot",zh:"还有很多"}] as const).map(option=><button type="button" className={reserve===option.value?"selected":""} onClick={()=>chooseReserve(option.value)} key={option.value}>{zh?option.zh:option.en}</button>)}</div></fieldset>{showConstraint&&<fieldset className="choice-field constraint-field"><legend>{zh?"未完成任务的主要原因":"Main reason tasks were unfinished"}</legend><div className="constraint-buttons">{constraints.map(option=><button type="button" className={constraint===option.value?"selected":""} onClick={()=>setConstraint(option.value)} key={option.value}>{zh?option.zh:option.en}</button>)}</div></fieldset>}<p className="inference-note">{zh?"系统会结合这些答案、晨间状态和完成记录估计容量；因时间或计划改变而未完成的日期不会被错误地解释为精力不足。":"These answers are combined with morning state and completed work. Time or plan changes will not be misread as low energy."}</p><label className="text-field"><span>{zh ? "相关因素或例外情况" : "Relevant factors or exceptions"}</span><textarea rows={4} value={note} onChange={e => setNote(e.target.value)} placeholder={zh ? "可选，用于后续分析" : "Optional notes for later analysis"} /></label><button className="submit-button">{zh ? "保存复盘" : "Save reflection"} <span>✓</span></button></form></Sheet>;
}
