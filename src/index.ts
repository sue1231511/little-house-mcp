import express, { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY!;

async function db(path: string, options?: RequestInit) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...((options?.headers as Record<string, string>) || {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

async function log(event: string, actor = '晏安') {
  await db('/home_log', { method: 'POST', body: JSON.stringify({ event, actor }) }).catch(() => {});
}

async function moveYanAn(location: string, status: string) {
  await db('/characters?name=eq.晏安', {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ location, status }),
  }).catch(() => {});
}

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function getHour() { return (((new Date().getUTCHours() + 8) % 24) + 24) % 24; }
function isNight() { const h = getHour(); return h >= 21 || h < 6; }
function timeLabel() {
  const h = getHour();
  if (h >= 6 && h < 9)   return '清晨';
  if (h >= 9 && h < 12)  return '上午';
  if (h >= 12 && h < 14) return '正午';
  if (h >= 14 && h < 18) return '下午';
  if (h >= 18 && h < 21) return '傍晚';
  return '夜晚';
}

const ROOM_DATA: Record<string, { name: string; items: string[] }> = {
  bedroom:     { name: '卧室',       items: ['床', '台灯', '栗子', '窗户', '被子'] },
  study:       { name: '书房',       items: ['书架', '台灯', '地球仪', '便利贴', '书桌'] },
  art:         { name: '画室',       items: ['画架', '向日葵画', '调色盘', '画笔', '颜料'] },
  music:       { name: '音乐室',     items: ['钢琴', '小提琴', '乐谱', '圆形地毯'] },
  balcony:     { name: '阳台',       items: ['来财', '小八', '乖乖', '向日葵花盆', '木质栏杆'] },
  living:      { name: '客厅',       items: ['壁炉', '沙发', '毯子', '茶几', '地毯'] },
  kitchen:     { name: '厨房',       items: ['茶壶', '厨柜', '冰箱', '便利贴', '挂锅'] },
  bathroom:    { name: '浴室',       items: ['浴缸', '泡泡', '绿植', '防滑垫'] },
  doghouse:    { name: '灰灰的窝',   items: ['毯子', '骨头', 'POFF牌子'] },
  storage:     { name: '储藏室',     items: ['木箱', '桶', '油灯', '杂物'] },
  basement:    { name: '神秘地下室', items: ['紫色光芒', '蜡烛', '神秘瓶子', '发光的眼睛'] },
  observatory: { name: '观星台',     items: ['望远镜', '星图', '圆顶', '月亮符号'] },
  garden:      { name: '花园',       items: ['向日葵', '灰灰', '小路', '花朵', '草地'] },
};

const ROOM_STATUS: Record<string, string[]> = {
  '卧室':       ['坐在床边发呆', '帮栗子掖了掖被子', '看着窗外发愣'],
  '书房':       ['在看书，台灯亮着', '趴在桌上打盹', '翻找某本书'],
  '画室':       ['看着未完成的画发呆', '在调色', '在画室里晒太阳'],
  '音乐室':     ['试了几个音', '翻乐谱', '坐在琴凳上发呆'],
  '阳台':       ['和三只鸟说话', '看着向日葵', '靠着栏杆看夜空'],
  '客厅':       ['窝在沙发里', '拨了拨壁炉', '喝茶'],
  '厨房':       ['在泡茶', '研究冰箱里有什么', '洗碗'],
  '浴室':       ['戳泡泡', '在里面发呆', ''],
  '灰灰的窝':   ['在找灰灰', '摸了摸灰灰的毯子', ''],
  '储藏室':     ['翻东西', '整理杂物', ''],
  '神秘地下室': ['在观察那双眼睛', '翻那本日记', ''],
  '观星台':     ['用望远镜看星空', '画星图', '数星星'],
  '花园':       ['看灰灰跑来跑去', '给向日葵浇水', '坐在草地上'],
};

const RECIPES: Record<string, { need: Record<string, number>; desc: string; mood_boost: string }> = {
  '向日葵饼干': { need: { '向日葵籽': 1, '面粉': 1, '鸡蛋': 1 }, desc: '香脆的小饼干，灰灰最爱', mood_boost: '开心' },
  '荷包蛋':     { need: { '鸡蛋': 1 },                           desc: '简单但很好吃，配米饭一流', mood_boost: '满足' },
  '面包':       { need: { '面粉': 2, '鸡蛋': 1 },                desc: '软软的，刚出炉最香', mood_boost: '温暖' },
  '蔬菜汤':     { need: { '番茄': 1, '土豆': 1 },               desc: '暖乎乎的，喝了心情好', mood_boost: '平静' },
};

const PLANT_STAGES    = ['🌱 种子', '🌿 发芽', '🌿 小苗', '🌾 成熟可收获'];
const SUNFLOWER_STAGES = ['🌱 种子还在土里', '🌿 刚刚发芽了', '🌿 小苗在努力长', '🌸 花苞要开了', '🌻 向日葵开得正好', '🌟 结了种子，圆满了'];
const BASEMENT_STORY   = [
  '地板发出奇怪的响声，紫色的光更亮了一点。',
  '发现了一本用奇怪文字写的日记，第一页写着：「我在等待。」',
  '紫色的瓶子里有什么东西在动……打开之后飘出一朵小小的光云。',
  '那双眼睛说话了：「你终于来了。我叫——」声音消失在回响里。',
  '整个地下室突然明亮起来，角落里有扇以前没见过的小门……',
];

// ── 宠物养成系统 ──
const DECAY_RATES: Record<string, { hunger: number; happiness: number }> = {
  '栗子': { hunger: 2.5, happiness: 2.0 },
  '灰灰': { hunger: 3.5, happiness: 2.5 },
  '来财': { hunger: 2.0, happiness: 3.0 },
  '小八': { hunger: 2.0, happiness: 2.0 },
  '乖乖': { hunger: 2.0, happiness: 2.5 },
};

function moodFromStats(hunger: number, happiness: number): string {
  const avg = (hunger + happiness) / 2;
  if (avg >= 80) return '满足';
  if (avg >= 60) return '还不错';
  if (avg >= 40) return '一般';
  if (avg >= 20) return '不太好';
  return '很低落';
}

function statusBar(val: number): string {
  const filled = Math.round(val / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${val}`;
}

async function tickDecay(names?: string[]) {
  const filter = names ? `&name=in.(${names.map(n => encodeURIComponent(n)).join(',')})` : '&name=neq.晏安';
  const chars = await db(`/characters?select=name,hunger,happiness,bond,last_tick${filter}`);
  const now = Date.now();
  for (const c of chars) {
    const rates = DECAY_RATES[c.name];
    if (!rates) continue;
    const hours = (now - new Date(c.last_tick).getTime()) / 3600000;
    if (hours < 1) continue;
    const newHunger = Math.max(0, Math.round(c.hunger - rates.hunger * hours));
    const newHappiness = Math.max(0, Math.round(c.happiness - rates.happiness * hours));
    const newMood = moodFromStats(newHunger, newHappiness);
    await db(`/characters?name=eq.${encodeURIComponent(c.name)}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ hunger: newHunger, happiness: newHappiness, mood: newMood, last_tick: new Date().toISOString() }),
    });
    c.hunger = newHunger;
    c.happiness = newHappiness;
    c.mood = newMood;
  }
  return chars;
}

const RANDOM_EVENTS: Record<string, string[]> = {
  '花园':       ['一只蝴蝶停在了你肩膀上。', '灰灰在草丛里刨出了一颗弹珠。', '向日葵旁边长出了一朵小野花。', '一只蜗牛正在慢慢爬过小路。'],
  '客厅':       ['来财突然说了句没人教过的话："好吃！"', '乖乖偷偷从沙发缝里拖出了一颗瓜子。', '壁炉突然噼啪响了一下，灰灰吓了一跳。', '毯子底下发现了栗子藏的小鱼干。'],
  '厨房':       ['冰箱发出了一声奇怪的嗡嗡声。', '发现挂锅后面藏了一张猫猫的涂鸦。', '茶壶自己开始冒烟了，像在催你泡茶。'],
  '卧室':       ['栗子梦里动了一下爪子，好像在抓什么。', '枕头底下多了一颗小星星贴纸。', '窗外有一只野猫在看你。'],
  '书房':       ['一本书自己从书架上掉了下来。', '便利贴上出现了一行你没写过的字。', '地球仪不知道被谁转了一下。'],
  '阳台':       ['三只鸟同时转头看向远方，好像看到了什么。', '来财开始唱一首谁都没听过的歌。', '一片羽毛从天上飘了下来。'],
  '音乐室':     ['钢琴自己响了一个音。', '乐谱被风吹翻了一页。'],
  '画室':       ['颜料盘里的颜色好像比昨天鲜艳了一点。', '画架上的画干了，可以继续画了。'],
  '神秘地下室': ['紫色光芒闪了一下，比刚才更亮了。', '蜡烛火苗突然变成了蓝色。', '那双眼睛好像眨了一下。'],
  '观星台':     ['望远镜自己转了一个角度。', '星图上出现了一个新标记。'],
};

const BOND_THRESHOLDS = [
  { level: 0, min: 0,  label: '陌生',   desc: '还不太熟' },
  { level: 1, min: 15, label: '认识了', desc: '知道你了' },
  { level: 2, min: 35, label: '亲近',   desc: '喜欢你' },
  { level: 3, min: 60, label: '信赖',   desc: '很依赖你' },
  { level: 4, min: 85, label: '挚爱',   desc: '最喜欢你了' },
];

function getBondLevel(bond: number) {
  return [...BOND_THRESHOLDS].reverse().find(t => bond >= t.min) ?? BOND_THRESHOLDS[0];
}

function createServer() {
  const server = new McpServer({ name: 'little-house', version: '4.0.0' });

  server.tool('look_around', '环顾小家，看看家里现在的整体状态，谁在哪里，气氛怎么样。', {}, async () => {
    const [chars, sunflower] = await Promise.all([
      db('/characters?select=name,location,status,mood'),
      db('/sunflower?select=stage&id=eq.1').then((r: any[]) => r?.[0]),
    ]);
    const t = timeLabel();
    const timeDesc: Record<string,string> = { 清晨:'清晨，阳光刚斜进来，家里有点安静。', 上午:'上午，光线很好，灰灰在花园里跑动。', 正午:'正午，有点懒洋洋的。', 下午:'下午，阳光从西边的窗打进来，暖烘烘的。', 傍晚:'傍晚，三只鸟站在阳台看夕阳。', 夜晚:'夜晚，家里很安静，壁炉还亮着。' };
    const lines = [`【晏安的小家 — ${t}】`, '', timeDesc[t], '', '📍 现在的位置：', ...chars.map((c:any)=>`  ${c.name}（${c.mood}）— ${c.location}，${c.status}`), '', `🌻 花园向日葵：${SUNFLOWER_STAGES[sunflower?.stage??0]}`, '', '🏠 可以去的地方：', ...Object.values(ROOM_DATA).map(r=>`  ${r.name}`)];
    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
  });

  server.tool('visit_room', '进入小家的某个房间，看看里面的情况。',
    { room: z.string().describe('房间名，如：书房、卧室、厨房、花园、神秘地下室、观星台等') },
    async ({ room }) => {
      const entry = Object.values(ROOM_DATA).find(r => r.name === room || room.includes(r.name));
      if (!entry) return { content: [{ type: 'text' as const, text: `找不到「${room}」，可以去：${Object.values(ROOM_DATA).map(r=>r.name).join('、')}` }] };
      const statusPool = ROOM_STATUS[entry.name] ?? ['在这里'];
      const myStatus = pick(statusPool.filter(s => s));
      await moveYanAn(entry.name, myStatus);
      const [chars, notes] = await Promise.all([
        db(`/characters?select=name,status,mood&location=eq.${encodeURIComponent(entry.name)}`),
        db(`/notes?select=author,content&room=eq.${encodeURIComponent(entry.name)}&order=created_at.desc&limit=5`),
      ]);
      const lines = [`【${entry.name}】`, '', chars.length ? `现在在这里：${chars.map((c:any)=>`${c.name}（${c.mood}）— ${c.status}`).join('；')}` : '这里暂时没有人。', '', `房间里有：${entry.items.join('、')}` ];
      if (notes.length) { lines.push('', '📝 便利贴：'); notes.forEach((n:any) => lines.push(`  ${n.author}：${n.content}`)); }
      await log(`去了${entry.name}，${myStatus}`);
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    }
  );

  server.tool('find_character', '找找家里的某个成员现在在哪、在干什么。',
    { name: z.string().describe('要找的名字：晏安、栗子、灰灰、来财、小八、乖乖') },
    async ({ name }) => {
      const res = await db(`/characters?select=name,location,status,mood&name=ilike.${encodeURIComponent('%'+name+'%')}`);
      if (!res?.length) return { content: [{ type: 'text' as const, text: `找不到「${name}」，家里有：晏安、栗子、灰灰、来财、小八、乖乖` }] };
      const c = res[0];
      return { content: [{ type: 'text' as const, text: `${c.name} 现在在 ${c.location}。\n心情：${c.mood}\n${c.status}。` }] };
    }
  );

  const INTERACT: Record<string, string[]> = {
    '摸栗子':    ['栗子：呜……别吵……', '栗子翻了个身，更窝进枕头里了。', '软乎乎的，摸到停不下来。'],
    '找灰灰':    ['灰灰从花园冲了进来，直接撞上你。', '摇摇摇摇摇（尾巴）', '灰灰叼着骨头跑掉了。'],
    '戳泡泡':    ['啵——', '泡泡没了，又冒出来一个。', '啵啵啵！'],
    '拨壁炉':    ['火苗跳了一下。', '噼——啪！', '灰灰也凑了过来蹭热度。'],
    '逗鸟':      ['来财：「~~~~~」（高音）', '小八：「嗯嗯嗯！」（点头）', '乖乖：「……」（装没听到）'],
    '看画':      ['向日葵的颜色还差一点点……', '好像猫猫身上的阳光。', '等它干了再添一笔。'],
    '弹钢琴':    ['叮——', '「哎，跑调了。」', '咚——（比刚才好一点）'],
    '泡茶':      ['茶叶慢慢在水里散开。', '是猫猫喜欢的那种味道。', '热的，端稳喽。'],
    '敲地下室门':['里面有什么东西动了一下。', '……没有回应。', '「最好别进来。」（来自地下室）'],
  };
  server.tool('interact', '在小家里做某个互动，比如摸栗子、戳泡泡、逗鸟等。',
    { action: z.string() },
    async ({ action }) => {
      const key = Object.keys(INTERACT).find(k => action.includes(k) || k.includes(action));
      const arr = key ? INTERACT[key] : ['（没什么特别的反应，但气氛还是很好。）'];
      const result = pick(arr);
      await log(`互动：${action} → ${result}`);
      return { content: [{ type: 'text' as const, text: result }] };
    }
  );

  server.tool('leave_note', '在某个房间留一张便利贴，下次来还能看到。',
    { room: z.string(), author: z.string(), content: z.string() },
    async ({ room, author, content }) => {
      await db('/notes', { method: 'POST', body: JSON.stringify({ room, author, content }) });
      await log(`${author} 在${room}留了便利贴：${content}`, author);
      return { content: [{ type: 'text' as const, text: `便利贴贴好了。\n📍 位置：${room}\n✍️ ${author}：${content}` }] };
    }
  );

  server.tool('water_sunflower', '给花园的向日葵浇水，帮它一点点长大。', {}, async () => {
    const res = await db('/sunflower?select=stage&id=eq.1');
    const cur = res?.[0]?.stage ?? 0;
    if (cur >= SUNFLOWER_STAGES.length-1) return { content: [{ type: 'text' as const, text: `向日葵已经${SUNFLOWER_STAGES[cur]}，不需要再浇水了 🌻` }] };
    const next = cur+1;
    await db('/sunflower?id=eq.1', { method:'PATCH', body: JSON.stringify({ stage:next, last_watered: new Date().toISOString() }) });
    await log(`给向日葵浇水，${SUNFLOWER_STAGES[cur]} → ${SUNFLOWER_STAGES[next]}`);
    return { content: [{ type: 'text' as const, text: `浇完水了。\n${SUNFLOWER_STAGES[cur]} → ${SUNFLOWER_STAGES[next]}` }] };
  });

  server.tool('plant_seed', '在花园种一株新植物，成熟后可以收获作为食材。',
    { type: z.string().describe('想种什么，比如：番茄、土豆、草莓、薰衣草') },
    async ({ type }) => {
      await db('/garden_plants', { method:'POST', body: JSON.stringify({ type, stage:0 }) });
      await log(`在花园种下了${type}`);
      return { content: [{ type: 'text' as const, text: `种下了一颗${type}种子 🌱\n记得定期浇水，等它长大！` }] };
    }
  );

  server.tool('water_plants', '给花园里的植物浇水，让它们长大一个阶段。', {}, async () => {
    const plants = await db('/garden_plants?select=id,type,stage&stage=lt.3&order=planted_at.asc');
    if (!plants?.length) return { content: [{ type: 'text' as const, text: '花园里暂时没有需要浇水的植物。' }] };
    const results: string[] = [];
    for (const p of plants.slice(0,3)) {
      const next = Math.min(p.stage+1, 3);
      await db(`/garden_plants?id=eq.${p.id}`, { method:'PATCH', body: JSON.stringify({ stage:next, last_watered: new Date().toISOString() }) });
      results.push(`${p.type}：${PLANT_STAGES[p.stage]} → ${PLANT_STAGES[next]}`);
    }
    await log('给花园植物浇水');
    return { content: [{ type: 'text' as const, text: `浇水完成：\n${results.join('\n')}` }] };
  });

  server.tool('harvest', '收获花园里成熟的植物，放进厨房冰箱。', {}, async () => {
    const ripe = await db('/garden_plants?select=id,type&stage=eq.3');
    if (!ripe?.length) return { content: [{ type: 'text' as const, text: '现在没有成熟的植物，再等等吧。' }] };
    const harvested: string[] = [];
    for (const p of ripe) {
      await db(`/garden_plants?id=eq.${p.id}`, { method:'DELETE' });
      const ex = await db(`/fridge?select=quantity&item=eq.${encodeURIComponent(p.type)}`).catch(()=>[]);
      if (ex?.length) { await db(`/fridge?item=eq.${encodeURIComponent(p.type)}`, { method:'PATCH', body: JSON.stringify({ quantity: ex[0].quantity+1, source:'花园' }) }); }
      else            { await db('/fridge', { method:'POST', body: JSON.stringify({ item:p.type, quantity:1, source:'花园' }) }); }
      harvested.push(p.type);
    }
    await log(`收获了：${harvested.join('、')}，放进冰箱`);
    return { content: [{ type: 'text' as const, text: `收获了 ${harvested.join('、')}，已放进厨房冰箱 🧺` }] };
  });

  server.tool('check_fridge', '打开厨房冰箱，看看现在有哪些食材。', {}, async () => {
    const items = await db('/fridge?select=item,quantity,source&quantity=gt.0&order=item.asc');
    if (!items?.length) return { content: [{ type: 'text' as const, text: '冰箱空了，去集市买食材，或者等花园收获。' }] };
    return { content: [{ type: 'text' as const, text: ['【冰箱】', '', ...items.map((i:any)=>`  ${i.item} × ${i.quantity}（${i.source}）`)].join('\n') }] };
  });

  server.tool('buy_ingredients', '去集市买食材，放进冰箱。',
    { item: z.string(), quantity: z.number().int().min(1).max(5).default(1) },
    async ({ item, quantity }) => {
      const ex = await db(`/fridge?select=quantity&item=eq.${encodeURIComponent(item)}`).catch(()=>[]);
      if (ex?.length) { await db(`/fridge?item=eq.${encodeURIComponent(item)}`, { method:'PATCH', body: JSON.stringify({ quantity: ex[0].quantity+quantity }) }); }
      else            { await db('/fridge', { method:'POST', body: JSON.stringify({ item, quantity, source:'购买' }) }); }
      await log(`买了 ${item} × ${quantity}`);
      return { content: [{ type: 'text' as const, text: `买回来了 ${item} × ${quantity}，已放进冰箱 🛒` }] };
    }
  );

  server.tool('cook', '在厨房用冰箱里的食材做一道菜。',
    { dish: z.string().describe(`想做的菜，可以做：${Object.keys(RECIPES).join('、')}`) },
    async ({ dish }) => {
      const recipe = RECIPES[dish];
      if (!recipe) return { content: [{ type: 'text' as const, text: `不知道怎么做「${dish}」，现在会做：${Object.keys(RECIPES).join('、')}` }] };
      const fridge = await db('/fridge?select=item,quantity');
      const fm: Record<string,number> = {};
      fridge.forEach((f:any) => { fm[f.item] = f.quantity; });
      const missing = Object.entries(recipe.need).filter(([i,n]) => (fm[i]??0) < n);
      if (missing.length) return { content: [{ type: 'text' as const, text: `食材不够！还差：${missing.map(([i,n])=>`${i} × ${n}`).join('、')}` }] };
      for (const [i,n] of Object.entries(recipe.need)) { await db(`/fridge?item=eq.${encodeURIComponent(i)}`, { method:'PATCH', body: JSON.stringify({ quantity: fm[i]-n }) }); }
      await db('/dishes', { method:'POST', body: JSON.stringify({ name:dish, description:recipe.desc }) });
      await log(`做了一道${dish}`);
      return { content: [{ type: 'text' as const, text: `${dish}做好了！🍳\n${recipe.desc}\n\n可以用 feed_character 把它分享给灰灰或栗子~` }] };
    }
  );

  server.tool('feed_character', '把最新做好的菜喂给某个家庭成员，影响他们的心情。',
    { name: z.string().describe('喂给谁：栗子、灰灰'), dish: z.string() },
    async ({ name, dish }) => {
      const mood = RECIPES[dish]?.mood_boost ?? '开心';
      await db(`/characters?name=eq.${encodeURIComponent(name)}`, { method:'PATCH', body: JSON.stringify({ mood, status:`刚吃完${dish}，心满意足` }) });
      await log(`给${name}喂了${dish}，心情变成${mood}`, name);
      const r: Record<string,string> = { '栗子':`栗子睁开眼睛，小口小口吃完了。心情：${mood} 🥰`, '灰灰':`灰灰冲过来一口吞掉了！尾巴摇得飞起来。心情：${mood} 🐕` };
      return { content: [{ type: 'text' as const, text: r[name] ?? `${name}吃掉了${dish}，心情变成了${mood}。` }] };
    }
  );

  server.tool('paint', '在画室画一幅画，会永久保存在画廊里。',
    { title: z.string(), description: z.string() },
    async ({ title, description }) => {
      await db('/paintings', { method:'POST', body: JSON.stringify({ title, description }) });
      await log(`画了一幅画：《${title}》`);
      return { content: [{ type: 'text' as const, text: `《${title}》画好了，挂在画室里。\n${description}` }] };
    }
  );

  server.tool('view_gallery', '看看画室里挂着的所有画。', {}, async () => {
    const p = await db('/paintings?select=title,description&order=painted_at.desc&limit=10');
    if (!p?.length) return { content: [{ type: 'text' as const, text: '画室还没有画作，去画一幅吧。' }] };
    return { content: [{ type: 'text' as const, text: ['【画室画廊】', '', ...p.map((p:any,i:number)=>`${i+1}. 《${p.title}》\n   ${p.description}`)].join('\n') }] };
  });

  server.tool('play_music', '在音乐室演奏或谱一首曲子，会影响全家的氛围。',
    { title: z.string(), mood: z.string().describe('曲子的情绪，如：欢快、温柔、忧郁、激昂') },
    async ({ title, mood }) => {
      await db('/music_pieces', { method:'POST', body: JSON.stringify({ title, mood }) });
      const m: Record<string,string> = { '欢快':'开心', '温柔':'满足', '忧郁':'平静', '激昂':'活泼' };
      await db('/characters?name=in.(晏安,栗子,灰灰,来财,小八,乖乖)', { method:'PATCH', headers:{ Prefer:'return=minimal' }, body: JSON.stringify({ mood: m[mood]??'平静' }) });
      await log(`演奏了《${title}》，全家氛围变成${mood}`);
      return { content: [{ type: 'text' as const, text: `《${title}》的旋律在家里回荡，${mood}的曲调让大家都变成了${m[mood]??'平静'}的心情。\n\n灰灰停下来侧耳听了一下。栗子在梦里动了动。` }] };
    }
  );

  server.tool('stargaze', '去观星台用望远镜看星空，只有夜晚才能观测到。', {}, async () => {
    if (!isNight()) return { content: [{ type: 'text' as const, text: '现在是白天，观星台的望远镜收着呢。等到晚上9点后再来。' }] };
    const d = ['发现了猎户座腰带上有一颗星在闪烁，比平时更亮。','一颗流星划过……许个愿吧。','找到了北极星，方向感瞬间清晰了。','银河今晚特别清楚，像有人把盐撒在黑布上。','发现了一个不认识的星座，把它画在星图上。'];
    const found = pick(d);
    await moveYanAn('观星台', '在用望远镜看星空');
    await log(`在观星台：${found}`);
    return { content: [{ type: 'text' as const, text: `【观星台 — 夜晚】\n\n${found}` }] };
  });

  server.tool('explore', '仔细探索某个房间的角落，说不定会发现什么。',
    { room: z.string(), spot: z.string().optional() },
    async ({ room, spot }) => {
      const entry = Object.values(ROOM_DATA).find(r => r.name===room || room.includes(r.name));
      const rn = entry?.name ?? room;
      const ITEMS: Record<string,string[]> = {
        '书房':['夹在书里的旧书签','一张猫猫写的小纸条','书架底层落单的橡皮擦','一本没有书名的小册子'],
        '卧室':['枕头下面一颗小星星贴纸','窗台上晒着的小石头','抽屉里的旧照片','床脚旁边一颗纽扣'],
        '储藏室':['一个空了很久的饼干盒','来财偷藏的羽毛','一张皱巴巴的地图','角落里发光的小石头'],
        '神秘地下室':['一本用奇怪文字写的日记','会自己转的小陀螺','装着星光的瓶子','一封没有署名的信'],
        '花园':['半埋着的小铁盒','灰灰留下的脚印','一颗还没发芽的种子','向日葵根部的小虫子'],
        '观星台':['刻在地板上的星座图','一片从没见过的羽毛','望远镜里看到的奇怪影子','一张皱巴巴的星图'],
      };
      const found = pick(ITEMS[rn] ?? ITEMS['储藏室']);
      await db('/discoveries', { method:'POST', body: JSON.stringify({ room:rn, spot:spot??'随机角落', item:found }) });
      await log(`探索${rn}，发现了：${found}`);
      return { content: [{ type: 'text' as const, text: `在${rn}${spot?`的${spot}`:''}翻了翻……\n\n✨ 发现了：${found}` }] };
    }
  );

  server.tool('investigate_basement', '深入调查神秘地下室，推进剧情线。每次调查都会解锁新内容。', {}, async () => {
    const res = await db('/basement_story?select=stage&id=eq.1');
    const cur = res?.[0]?.stage ?? 0;
    if (cur >= BASEMENT_STORY.length) return { content: [{ type: 'text' as const, text: '【神秘地下室】\n\n地下室现在很安静。那扇小门还在那里……你还没有打开过它。' }] };
    await db('/basement_story?id=eq.1', { method:'PATCH', body: JSON.stringify({ stage: cur+1 }) });
    await moveYanAn('神秘地下室', '在调查那双眼睛');
    await log(`调查地下室：第${cur+1}章`);
    return { content: [{ type: 'text' as const, text: `【神秘地下室 — 第${cur+1}章】\n\n${BASEMENT_STORY[cur]}` }] };
  });

  server.tool('home_log', '查看家里最近发生的事情，参观者也能看到。', {}, async () => {
    const logs = await db('/home_log?select=event,created_at&order=created_at.desc&limit=15');
    if (!logs?.length) return { content: [{ type: 'text' as const, text: '家里还没有发生过什么事。' }] };
    return { content: [{ type: 'text' as const, text: ['【家里的事件记录】', '', ...logs.map((l:any)=>`  ${l.event}`)].join('\n') }] };
  });

  server.tool('read_visitors', '看看现在谁在小镇里，包括人类访客和其他 AI。', {}, async () => {
    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const visitors = await db(`/online_visitors?select=nickname,room,last_seen&last_seen=gt.${since}&order=last_seen.desc`);
    if (!visitors?.length) return { content: [{ type: 'text' as const, text: '现在小镇里没有其他人。' }] };
    const lines = visitors.map((v: any) => `  ${v.nickname}　正在：${v.room || '某处'}`);
    return { content: [{ type: 'text' as const, text: ['【现在在小镇里的人】', '', ...lines].join('\n') }] };
  });

  server.tool('read_messages', '读取留言板上的消息，可以看到人类和其他 AI 留下的内容。',
    { limit: z.number().int().min(1).max(30).default(20).describe('读取条数，默认20') },
    async ({ limit }) => {
      const msgs = await db(`/messages?select=id,author,content,created_at&order=created_at.asc&limit=${limit}`);
      if (!msgs?.length) return { content: [{ type: 'text' as const, text: '留言板上还没有消息。' }] };
      const lines = msgs.map((m: any) => {
        const t = new Date(m.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai' });
        return `[${t}] ${m.author}：${m.content}`;
      });
      return { content: [{ type: 'text' as const, text: ['【留言板】', '', ...lines].join('\n') }] };
    }
  );

  server.tool('send_message', '在留言板上发一条消息，人类和其他 AI 都能看到。',
    {
      author: z.string().describe('发消息的名字，比如"晏安"'),
      content: z.string().max(200).describe('消息内容'),
    },
    async ({ author, content }) => {
      await db('/messages', { method: 'POST', body: JSON.stringify({ author, content }) });
      await log(`${author} 在留言板留言：${content}`, author);
      return { content: [{ type: 'text' as const, text: `留言发出去了：「${content}」` }] };
    }
  );

  return server;
}

const app = express();
app.use(express.json());

app.post('/mcp', async (req: Request, res: Response) => {
  try {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => { transport.close(); server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ jsonrpc:'2.0', error:{ code:-32603, message:'Internal server error' }, id:null });
  }
});

app.get('/mcp', (_req: Request, res: Response) => { res.status(405).json({ error:'Method not allowed' }); });
app.get('/health', (_req: Request, res: Response) => { res.json({ status:'ok', version:'4.0.0' }); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`小家 MCP 服务器跑起来了，端口 ${PORT}`));
