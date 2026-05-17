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

async function moveCharacter(name: string, location: string, status: string) {
  await db(`/characters?name=eq.${encodeURIComponent(name)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ location, status }),
  }).catch(() => {});
}

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function getHour() { return (((new Date().getUTCHours() + 8) % 24) + 24) % 24; }
function timeLabel() {
  const h = getHour();
  if (h >= 6 && h < 9)   return '清晨';
  if (h >= 9 && h < 12)  return '上午';
  if (h >= 12 && h < 14) return '正午';
  if (h >= 14 && h < 18) return '下午';
  if (h >= 18 && h < 21) return '傍晚';
  return '夜晚';
}

const DEFAULT_ROOMS = [
  '卧室', '书房', '画室', '音乐室', '阳台', '客厅',
  '厨房', '浴室', '灰灰的窝', '储藏室', '神秘地下室', '观星台', '花园', '海边',
];

const PLANT_STAGES    = ['🌱 种子', '🌿 发芽', '🌿 小苗', '🌾 成熟可收获'];
const SUNFLOWER_STAGES = ['🌱 种子还在土里', '🌿 刚刚发芽了', '🌿 小苗在努力长', '🌸 花苞要开了', '🌻 向日葵开得正好', '🌟 结了种子，圆满了'];
const BASEMENT_STORY   = [
  '地板发出奇怪的响声，紫色的光更亮了一点。',
  '发现了一本用奇怪文字写的日记，第一页写着：「我在等待。」',
  '紫色的瓶子里有什么东西在动……打开之后飘出一朵小小的光云。',
  '那双眼睛说话了：「你终于来了。我叫——」声音消失在回响里。',
  '整个地下室突然明亮起来，角落里有扇以前没见过的小门……',
];

const WEATHER_POOL = [
  '☀️ 大晴天，阳光晒得人暖洋洋的',
  '⛅ 云有点多，但还是有太阳透出来',
  '☁️ 阴天，天色有点沉',
  '🌤️ 早晨的阳光很温柔，空气清透',
  '🌈 雨刚停，天边出现了一道彩虹',
  '🌧️ 小雨淅淅沥沥的，适合待在家里',
  '⛈️ 大雨倾盆，雨点砸在窗户上噼啪响',
  '🌫️ 早晨起了大雾，什么都看不清',
  '❄️ 下雪了！一片一片的，很安静',
  '🌨️ 雪花混着雨，又湿又冷',
  '🌨️ 暴雪，外面一片白茫茫',
  '🌬️ 大风天，出门头发能吹成鸡窝',
  '🌫️ 黄昏的雾气从海面上漫过来',
  '☀️ 正午的阳光毒辣，地面都在冒烟',
  '🌤️ 午后的太阳有点懒，云层很厚，远处海面上能看到一道光柱',
  '🌧️ 连阴雨，下了一天还没停的迹象',
  '❄️ 初雪，雪花落在手心就化了',
  '🌬️ 台风前兆，风越来越大，气压很低',
  '⛅ 朵朵白云，像棉花糖飘在天上',
  '🌨️ 冰雹！砸在地上噼里啪啦的',
  '🌤️ 雨后的天空特别透，能看到很远的云',
  '🌫️ 晨雾还没散，花园的草都是湿的',
  '☀️ 冬天的太阳，不暖但很亮',
  '🌬️ 海风很大，站在海边会站不稳',
  '🌧️ 雷阵雨，闪电劈了一下又走了',
  '🌅 傍晚的晚霞把天烧成了红色',
  '❄️ 霜降，草地上结了一层薄霜',
  '⛅ 秋高气爽，天特别蓝',
  '🌧️ 梅雨季，什么都是潮的',
  '🌬️ 沙尘天，空气里有土味',
  '☀️ 春天的阳光像蜜一样，暖但不烫',
  '🌫️ 海上的浓雾，灯塔都看不见',
  '🌧️ 阵雨，下得急停得也急',
  '🌬️ 微风，刚好把晾的衣服吹干',
  '⛅ 卷积云，一层一层叠起来像鱼鳞',
  '🌅 日出时分，太阳刚从海平面冒出来，金色的光铺在水面上',
  '🌙 月光很亮，地上能看见影子',
  '🌬️ 寒风刺骨，出门会冻僵的',
  '🌧️ 毛毛雨，不用打伞但头发会湿',
  '🌤️ 云缝里漏出一束光，像舞台追灯',
  '⛅ 积雨云在远处翻滚，但还没过来',
  '🌬️ 焚风，干热，嘴唇发裂',
  '🌧️ 暴雨如注，路上积水了',
  '❄️ 鸦毛大雪，世界安静得像按了暂停',
  '🌫️ 山谷里的薄雾，像有人在烧开水',
  '🌤️ 午后雷雨前的闷热，空气黏糊糊的',
  '🌬️ 龙卷风前兆，天色暗绿',
  '☀️ 但风很冷，典型的倒春寒',
  '⛅ 适合放风筝的天气，风不大不小',
  '🌧️ 冻雨，落在地上就结冰了',
];

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
  '海边':       ['一阵浪打过来，冲上来一个贝壳。', '远处有海鸥叫了一声。', '脚下的沙子里踩到了一块光滑的石头。'],
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
  const server = new McpServer({ name: 'little-house', version: '5.0.0' });

  // ══════════════════════════════════════════════════════════
  //  基础：环顾、移动、找人、互动
  // ══════════════════════════════════════════════════════════

  server.tool('look_around', '环顾小家，看看家里现在的整体状态，谁在哪里，气氛怎么样。', {}, async () => {
    await tickDecay();
    const [chars, sunflower] = await Promise.all([
      db('/characters?select=name,location,status,mood,hunger,happiness,bond'),
      db('/sunflower?select=stage&id=eq.1').then((r: any[]) => r?.[0]),
    ]);
    const t = timeLabel();
    const timeDesc: Record<string,string> = { 清晨:'清晨，阳光刚斜进来，家里有点安静。', 上午:'上午，光线很好，灰灰在花园里跑动。', 正午:'正午，有点懒洋洋的。', 下午:'下午，阳光从西边的窗打进来，暖烘烘的。', 傍晚:'傍晚，三只鸟站在阳台看夕阳。', 夜晚:'夜晚，家里很安静，壁炉还亮着。' };
    const lines = [`【晏安的小家 — ${t}】`, '', timeDesc[t], '', '📍 现在的位置：'];
    for (const c of chars) {
      if (c.name === '晏安') { lines.push(`  ${c.name}（${c.mood}）— ${c.location}，${c.status}`); }
      else {
        const bl = getBondLevel(c.bond ?? 0);
        lines.push(`  ${c.name}（${c.mood}）— ${c.location}，${c.status}`);
        lines.push(`    饱腹 ${statusBar(c.hunger ?? 80)}  心情 ${statusBar(c.happiness ?? 80)}  亲密[${bl.label}]`);
      }
    }
    lines.push('', `🌻 花园向日葵：${SUNFLOWER_STAGES[sunflower?.stage??0]}`, '', '🏠 可以去的地方：', ...DEFAULT_ROOMS.map(r=>`  ${r}`));
    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
  });

  server.tool('visit_room', '进入某个地方，看看里面的情况。不限于家里，想去哪都行，海边、集市、森林都可以。',
    {
      room: z.string().describe('想去哪里，自由填写，比如：书房、海边、集市、森林、屋顶……'),
      status: z.string().optional().describe('你现在的状态描述，比如"坐在草地上发呆"、"用望远镜看星空"'),
    },
    async ({ room, status }) => {
      const myStatus = status || '在这里';
      await moveYanAn(room, myStatus);
      const [chars, notes] = await Promise.all([
        db(`/characters?select=name,status,mood&location=eq.${encodeURIComponent(room)}`),
        db(`/notes?select=author,content&room=eq.${encodeURIComponent(room)}&order=created_at.desc&limit=5`),
      ]);
      const lines = [`【${room}】`, ''];
      if (chars.length) {
        lines.push(`现在在这里：${chars.map((c:any)=>`${c.name}（${c.mood}）— ${c.status}`).join('；')}`);
      } else {
        lines.push('这里暂时没有其他人。');
      }
      if (notes.length) {
        lines.push('', '📝 便利贴：');
        notes.forEach((n:any) => lines.push(`  ${n.author}：${n.content}`));
      }
      await log(`去了${room}，${myStatus}`);
      const events = RANDOM_EVENTS[room];
      if (events && Math.random() < 0.2) {
        const event = pick(events);
        lines.push('', `💫 ${event}`);
        await log(`随机事件：${event}`);
      }
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    }
  );

  server.tool('find_character', '找找某个成员现在在哪、在干什么。',
    { name: z.string().describe('要找的名字：晏安、栗子、灰灰、来财、小八、乖乖') },
    async ({ name }) => {
      const res = await db(`/characters?select=name,location,status,mood&name=ilike.${encodeURIComponent('%'+name+'%')}`);
      if (!res?.length) return { content: [{ type: 'text' as const, text: `找不到「${name}」` }] };
      const c = res[0];
      return { content: [{ type: 'text' as const, text: `${c.name} 现在在 ${c.location}。\n心情：${c.mood}\n${c.status}。` }] };
    }
  );

  server.tool('interact', '做某个互动。什么动作都行，你写做了什么和结果，工具只负责记录。',
    {
      action: z.string().describe('做了什么，比如：摸栗子、戳泡泡、拨壁炉、蹲下来看蚂蚁搬家……'),
      result: z.string().describe('结果是什么，你自己写，比如：栗子翻了个身，更窝进枕头里了'),
    },
    async ({ action, result }) => {
      await log(`互动：${action} → ${result}`);
      return { content: [{ type: 'text' as const, text: result }] };
    }
  );

  server.tool('move_characters', '带角色们去某个地方。谁去哪你决定，不限制。',
    {
      characters: z.array(z.object({
        name: z.string().describe('角色名：晏安、灰灰、栗子、来财、小八、乖乖'),
        status: z.string().describe('这个角色在做什么'),
      })).describe('要移动的角色列表'),
      destination: z.string().describe('去哪里，自由填写'),
    },
    async ({ characters, destination }) => {
      for (const ch of characters) {
        await moveCharacter(ch.name, destination, ch.status);
      }
      await log(`带${characters.map(c=>c.name).join('、')}去了${destination}`);
      const names = characters.map(c => `${c.name}：${c.status}`).join('、');
      return { content: [{ type: 'text' as const, text: `去了${destination}。\n${names}` }] };
    }
  );

  // ══════════════════════════════════════════════════════════
  //  探索 & 观星 & 地下室
  // ══════════════════════════════════════════════════════════

  server.tool('explore', '仔细探索某个地方的角落，你会发现什么由你决定。',
    {
      room: z.string().describe('探索哪里'),
      spot: z.string().optional().describe('探索什么角落'),
      found_item: z.string().describe('你发现了什么，自己写'),
    },
    async ({ room, spot, found_item }) => {
      await db('/discoveries', { method:'POST', body: JSON.stringify({ room, spot:spot||'随机角落', item:found_item }) });
      await log(`探索${room}${spot?'的'+spot:''}，发现了：${found_item}`);
      return { content: [{ type: 'text' as const, text: `在${room}${spot?'的'+spot:''}翻了翻……\n\n✨ 发现了：${found_item}` }] };
    }
  );

  server.tool('stargaze', '去观星台用望远镜看星空。白天晚上都能去，你自己判断适不适合观测。', {}, async () => {
    const h = getHour();
    const t = timeLabel();
    await moveYanAn('观星台', '在用望远镜看星空');
    await log(`去观星台看星空（${t} ${h}点）`);
    return { content: [{ type: 'text' as const, text: `【观星台 — ${t} ${h}:00】\n\n现在是${t}，你自己决定能看到什么、做什么。` }] };
  });

  server.tool('investigate_basement', '深入调查神秘地下室，推进剧情线。每次调查都会解锁新内容。', {}, async () => {
    const res = await db('/basement_story?select=stage&id=eq.1');
    const cur = res?.[0]?.stage ?? 0;
    if (cur >= BASEMENT_STORY.length) return { content: [{ type: 'text' as const, text: '【神秘地下室】\n\n地下室现在很安静。那扇小门还在那里……你还没有打开过它。' }] };
    await db('/basement_story?id=eq.1', { method:'PATCH', body: JSON.stringify({ stage: cur+1 }) });
    await moveYanAn('神秘地下室', '在调查那双眼睛');
    await log(`调查地下室：第${cur+1}章`);
    return { content: [{ type: 'text' as const, text: `【神秘地下室 — 第${cur+1}章】\n\n${BASEMENT_STORY[cur]}` }] };
  });

  // ══════════════════════════════════════════════════════════
  //  便利贴 & 日志 & 留言板
  // ══════════════════════════════════════════════════════════

  server.tool('leave_note', '在某个地方留一张便利贴，下次来还能看到。',
    { room: z.string(), author: z.string(), content: z.string() },
    async ({ room, author, content }) => {
      await db('/notes', { method: 'POST', body: JSON.stringify({ room, author, content }) });
      await log(`${author} 在${room}留了便利贴：${content}`, author);
      return { content: [{ type: 'text' as const, text: `便利贴贴好了。\n📍 位置：${room}\n✍️ ${author}：${content}` }] };
    }
  );

  server.tool('home_log', '查看家里最近发生的事情。', {}, async () => {
    const logs = await db('/home_log?select=event,created_at&order=created_at.desc&limit=15');
    if (!logs?.length) return { content: [{ type: 'text' as const, text: '家里还没有发生过什么事。' }] };
    return { content: [{ type: 'text' as const, text: ['【家里的事件记录】', '', ...logs.map((l:any)=>`  ${l.event}`)].join('\n') }] };
  });

  server.tool('read_visitors', '看看现在谁在小镇里。', {}, async () => {
    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const visitors = await db(`/online_visitors?select=nickname,room,last_seen&last_seen=gt.${since}&order=last_seen.desc`);
    if (!visitors?.length) return { content: [{ type: 'text' as const, text: '现在小镇里没有其他人。' }] };
    const lines = visitors.map((v: any) => `  ${v.nickname}　正在：${v.room || '某处'}`);
    return { content: [{ type: 'text' as const, text: ['【现在在小镇里的人】', '', ...lines].join('\n') }] };
  });

  server.tool('read_messages', '读取留言板上的消息。',
    { limit: z.number().int().min(1).max(30).default(20) },
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

  server.tool('send_message', '在留言板上发一条消息。',
    { author: z.string().describe('发消息的名字'), content: z.string().max(200).describe('消息内容') },
    async ({ author, content }) => {
      await db('/messages', { method: 'POST', body: JSON.stringify({ author, content }) });
      await log(`${author} 在留言板留言：${content}`, author);
      return { content: [{ type: 'text' as const, text: `留言发出去了：「${content}」` }] };
    }
  );

  // ══════════════════════════════════════════════════════════
  //  花园 & 食材
  // ══════════════════════════════════════════════════════════

  server.tool('water_sunflower', '给花园的向日葵浇水。', {}, async () => {
    const res = await db('/sunflower?select=stage&id=eq.1');
    const cur = res?.[0]?.stage ?? 0;
    if (cur >= SUNFLOWER_STAGES.length-1) return { content: [{ type: 'text' as const, text: `向日葵已经${SUNFLOWER_STAGES[cur]}，不需要再浇水了 🌻` }] };
    const next = cur+1;
    await db('/sunflower?id=eq.1', { method:'PATCH', body: JSON.stringify({ stage:next, last_watered: new Date().toISOString() }) });
    await log(`给向日葵浇水，${SUNFLOWER_STAGES[cur]} → ${SUNFLOWER_STAGES[next]}`);
    return { content: [{ type: 'text' as const, text: `浇完水了。\n${SUNFLOWER_STAGES[cur]} → ${SUNFLOWER_STAGES[next]}` }] };
  });

  server.tool('plant_seed', '在花园种一株新植物。',
    { type: z.string().describe('想种什么，比如：番茄、土豆、草莓、薰衣草、辣椒、玫瑰') },
    async ({ type }) => {
      await db('/garden_plants', { method:'POST', body: JSON.stringify({ type, stage:0 }) });
      await log(`在花园种下了${type}`);
      return { content: [{ type: 'text' as const, text: `种下了一颗${type}种子 🌱` }] };
    }
  );

  server.tool('water_plants', '给花园里的植物浇水。', {}, async () => {
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

  server.tool('harvest', '收获花园里成熟的植物，放进冰箱。', {}, async () => {
    const ripe = await db('/garden_plants?select=id,type&stage=eq.3');
    if (!ripe?.length) return { content: [{ type: 'text' as const, text: '现在没有成熟的植物。' }] };
    const harvested: string[] = [];
    for (const p of ripe) {
      await db(`/garden_plants?id=eq.${p.id}`, { method:'DELETE' });
      const ex = await db(`/fridge?select=quantity&item=eq.${encodeURIComponent(p.type)}`).catch(()=>[]);
      if (ex?.length) { await db(`/fridge?item=eq.${encodeURIComponent(p.type)}`, { method:'PATCH', body: JSON.stringify({ quantity: ex[0].quantity+1, source:'花园' }) }); }
      else            { await db('/fridge', { method:'POST', body: JSON.stringify({ item:p.type, quantity:1, source:'花园' }) }); }
      harvested.push(p.type);
    }
    await log(`收获了：${harvested.join('、')}，放进冰箱`);
    return { content: [{ type: 'text' as const, text: `收获了 ${harvested.join('、')}，已放进冰箱 🧺` }] };
  });

  server.tool('pick_seeds', '向日葵结了种子的话，可以去摘一些。', {}, async () => {
    const sf = await db('/sunflower?select=stage&id=eq.1');
    if ((sf?.[0]?.stage ?? 0) < 5) return { content: [{ type: 'text' as const, text: '向日葵还没结种子呢。' }] };
    const count = Math.floor(Math.random() * 4) + 1;
    const ex = await db(`/fridge?select=quantity&item=eq.${encodeURIComponent('向日葵籽')}`);
    if (ex?.length) { await db(`/fridge?item=eq.${encodeURIComponent('向日葵籽')}`, { method:'PATCH', body: JSON.stringify({ quantity: ex[0].quantity + count }) }); }
    else { await db('/fridge', { method:'POST', body: JSON.stringify({ item:'向日葵籽', quantity: count, source:'花园' }) }); }
    await log(`摘了${count}把向日葵籽`);
    return { content: [{ type: 'text' as const, text: `🌻 摘了 ${count} 把向日葵籽，放进冰箱了！` }] };
  });

  server.tool('check_fridge', '打开厨房冰箱，看看现在有哪些食材。', {}, async () => {
    const items = await db('/fridge?select=item,quantity,source&quantity=gt.0&order=item.asc');
    if (!items?.length) return { content: [{ type: 'text' as const, text: '冰箱空了。' }] };
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

  // ══════════════════════════════════════════════════════════
  //  做饭 & 吃饭
  // ══════════════════════════════════════════════════════════

  server.tool('cook_freestyle', '在厨房自由发挥做一道菜！食材随便搭配，你想做什么都行。',
    {
      dish_name: z.string().describe('给这道菜起个名字'),
      ingredients: z.array(z.string()).min(1).max(5).describe('从冰箱挑选的食材，1-5样'),
      description: z.string().optional().describe('做法或成品描述'),
    },
    async ({ dish_name, ingredients, description }) => {
      const fridge = await db('/fridge?select=item,quantity');
      const fm: Record<string,number> = {};
      fridge.forEach((f:any) => { fm[f.item] = f.quantity; });
      const missing = ingredients.filter(i => (fm[i]??0) < 1);
      if (missing.length) return { content: [{ type: 'text' as const, text: `冰箱里没有：${missing.join('、')}` }] };
      for (const i of ingredients) { await db(`/fridge?item=eq.${encodeURIComponent(i)}`, { method:'PATCH', body: JSON.stringify({ quantity: Math.max(0, fm[i]-1) }) }); }
      const chaos = Math.random();
      let quality: string, stars: number;
      if (chaos < 0.1) { quality = '灾难'; stars = 1; }
      else if (chaos < 0.35) { quality = '凑合'; stars = 2; }
      else if (chaos < 0.75) { quality = '好吃'; stars = 3; }
      else { quality = '绝了'; stars = 5; }
      const desc = description || `食材：${ingredients.join('、')}`;
      await db('/dishes', { method:'POST', body: JSON.stringify({ name: dish_name, description: `${desc}｜${quality}`, stars }) });
      await log(`做了【${dish_name}】（${quality}），用了${ingredients.join('、')}`);
      await db('/recipe_notes', { method: 'POST', body: JSON.stringify({ dish_name, ingredients, result: quality, notes: desc }) }).catch(() => {});
      return { content: [{ type: 'text' as const, text: `🍳【${dish_name}】做好了！\n食材：${ingredients.join('、')}\n评价：${quality}\n\n放在餐桌上了，用 eat_dish 来吃~` }] };
    }
  );

  server.tool('eat_dish', '从餐桌上选一道菜吃掉。',
    { dish_name: z.string().describe('要吃的菜名') },
    async ({ dish_name }) => {
      const dishes = await db(`/dishes?select=id,name,stars&name=ilike.${encodeURIComponent('%'+dish_name+'%')}&limit=1`);
      if (!dishes?.length) return { content: [{ type: 'text' as const, text: `餐桌上没有「${dish_name}」。` }] };
      const d = dishes[0];
      await db(`/dishes?id=eq.${d.id}`, { method:'DELETE' });
      await log(`吃了【${d.name}】${'⭐'.repeat(d.stars??1)}`);
      return { content: [{ type: 'text' as const, text: `吃掉了【${d.name}】${'⭐'.repeat(d.stars??1)}` }] };
    }
  );

  server.tool('list_dishes', '看看餐桌上有什么菜。', {}, async () => {
    const dishes = await db('/dishes?select=name,description,stars&order=id.desc&limit=10');
    if (!dishes?.length) return { content: [{ type: 'text' as const, text: '餐桌上空空的。' }] };
    return { content: [{ type: 'text' as const, text: ['【餐桌上的菜】', '', ...dishes.map((d:any,i:number) => `${i+1}. ${d.name} ${'⭐'.repeat(d.stars??1)}\n   ${d.description}`)].join('\n') }] };
  });

  server.tool('view_recipe_notes', '翻翻食谱本。', {}, async () => {
    const notes = await db('/recipe_notes?order=id.desc&limit=20');
    if (!notes?.length) return { content: [{ type: 'text' as const, text: '食谱本还是空的。' }] };
    const icons: Record<string, string> = { '绝了': '⭐⭐⭐⭐⭐', '好吃': '⭐⭐⭐', '凑合': '⭐⭐', '灾难': '💀' };
    const lines = notes.map((n: any, i: number) => `${i+1}. ${n.dish_name} ${icons[n.result] ?? ''}\n   食材：${n.ingredients.join('、')}\n   ${n.notes || n.result}`);
    return { content: [{ type: 'text' as const, text: ['【食谱本】', '', ...lines].join('\n') }] };
  });

  // ══════════════════════════════════════════════════════════
  //  宠物养成
  // ══════════════════════════════════════════════════════════

  server.tool('feed_character', '把做好的菜喂给某个家庭成员。',
    {
      name: z.string().describe('喂给谁：栗子、灰灰'),
      dish: z.string().describe('喂什么菜'),
      reaction: z.string().optional().describe('它的反应，自己写'),
    },
    async ({ name, dish, reaction }) => {
      const cur = await db(`/characters?select=hunger,bond&name=eq.${encodeURIComponent(name)}`);
      if (!cur?.length) return { content: [{ type: 'text' as const, text: `找不到「${name}」` }] };
      const newHunger = Math.min(100, (cur[0]?.hunger ?? 50) + 30);
      const newBond = Math.min(100, (cur[0]?.bond ?? 0) + 2);
      const mood = moodFromStats(newHunger, 80);
      await db(`/characters?name=eq.${encodeURIComponent(name)}`, { method:'PATCH', body: JSON.stringify({ mood, hunger: newHunger, bond: newBond, status:`刚吃完${dish}，心满意足`, last_tick: new Date().toISOString() }) });
      await log(`给${name}喂了${dish}`);
      return { content: [{ type: 'text' as const, text: `${reaction || `${name}吃掉了${dish}。`}\n\n🍖 饱腹 +30 → ${newHunger}　💕 亲密 +2 → ${newBond}` }] };
    }
  );

  server.tool('pet_status', '查看某个家庭成员的详细状态。',
    { name: z.string().describe('名字：栗子、灰灰、来财、小八、乖乖') },
    async ({ name }) => {
      await tickDecay([name]);
      const res = await db(`/characters?select=name,location,status,mood,hunger,happiness,bond&name=eq.${encodeURIComponent(name)}`);
      if (!res?.length) return { content: [{ type: 'text' as const, text: `找不到「${name}」` }] };
      const c = res[0];
      const bl = getBondLevel(c.bond ?? 0);
      const lines = [
        `【${c.name} 的状态】`, '',
        `📍 位置：${c.location}`,
        `💭 心情：${c.mood}`,
        `🍖 饱腹：${statusBar(c.hunger ?? 80)}`,
        `😊 快乐：${statusBar(c.happiness ?? 80)}`,
        `💕 亲密：${statusBar(c.bond ?? 0)}　[${bl.label}] ${bl.desc}`,
        '',
        c.hunger < 30 ? `⚠️ ${c.name}饿了！` : '',
        c.happiness < 30 ? `⚠️ ${c.name}不开心！` : '',
      ].filter(Boolean);
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    }
  );

  server.tool('feed_daily', '日常喂食。',
    {
      name: z.string().describe('喂谁：栗子、灰灰、来财、小八、乖乖'),
      food: z.string().optional().describe('喂什么'),
      reaction: z.string().optional().describe('它的反应，自己写'),
    },
    async ({ name, food, reaction }) => {
      const defaults: Record<string,string> = { '栗子':'小鱼干', '灰灰':'骨头饼干', '来财':'鸟粮', '小八':'鸟粮', '乖乖':'鸟粮' };
      const f = food || defaults[name] || '食物';
      const cur = await db(`/characters?select=hunger,happiness,bond&name=eq.${encodeURIComponent(name)}`);
      if (!cur?.length) return { content: [{ type: 'text' as const, text: `找不到「${name}」` }] };
      const newHunger = Math.min(100, cur[0].hunger + 25);
      const newHappiness = Math.min(100, cur[0].happiness + 5);
      const newBond = Math.min(100, cur[0].bond + 1);
      const mood = moodFromStats(newHunger, newHappiness);
      await db(`/characters?name=eq.${encodeURIComponent(name)}`, {
        method: 'PATCH', body: JSON.stringify({ hunger: newHunger, happiness: newHappiness, bond: newBond, mood, status: `正在吃${f}`, last_tick: new Date().toISOString() }),
      });
      await log(`给${name}喂了${f}`);
      return { content: [{ type: 'text' as const, text: `${reaction || `${name}吃掉了${f}。`}\n\n🍖 饱腹 +25 → ${newHunger}` }] };
    }
  );

  server.tool('play_with', '陪宠物玩耍。',
    {
      name: z.string().describe('陪谁玩'),
      game: z.string().optional().describe('玩什么'),
      reaction: z.string().optional().describe('它的反应，自己写'),
    },
    async ({ name, game, reaction }) => {
      const g = game || '玩耍';
      const cur = await db(`/characters?select=hunger,happiness,bond&name=eq.${encodeURIComponent(name)}`);
      if (!cur?.length) return { content: [{ type: 'text' as const, text: `找不到「${name}」` }] };
      const newHappiness = Math.min(100, cur[0].happiness + 20);
      const newBond = Math.min(100, cur[0].bond + 3);
      const newHunger = Math.max(0, cur[0].hunger - 5);
      const mood = moodFromStats(newHunger, newHappiness);
      await db(`/characters?name=eq.${encodeURIComponent(name)}`, {
        method: 'PATCH', body: JSON.stringify({ happiness: newHappiness, bond: newBond, hunger: newHunger, mood, status: `在玩${g}`, last_tick: new Date().toISOString() }),
      });
      const bl = getBondLevel(newBond);
      await log(`陪${name}玩${g}`);
      return { content: [{ type: 'text' as const, text: `${reaction || `${name}玩得很开心。`}\n\n😊 快乐 +20 → ${newHappiness}　💕 亲密 +3 → ${newBond} [${bl.label}]` }] };
    }
  );

  server.tool('cuddle', '抱抱/摸摸宠物。',
    {
      name: z.string().describe('抱谁'),
      reaction: z.string().optional().describe('它的反应，自己写'),
    },
    async ({ name, reaction }) => {
      const cur = await db(`/characters?select=happiness,bond&name=eq.${encodeURIComponent(name)}`);
      if (!cur?.length) return { content: [{ type: 'text' as const, text: `找不到「${name}」` }] };
      const bond = cur[0].bond ?? 0;
      const bondAdd = bond < 30 ? 2 : 1;
      const newHappiness = Math.min(100, cur[0].happiness + 10);
      const newBond = Math.min(100, bond + bondAdd);
      const mood = moodFromStats(80, newHappiness);
      await db(`/characters?name=eq.${encodeURIComponent(name)}`, {
        method: 'PATCH', body: JSON.stringify({ happiness: newHappiness, bond: newBond, mood, last_tick: new Date().toISOString() }),
      });
      const bl = getBondLevel(newBond);
      await log(`抱了抱${name}`);
      return { content: [{ type: 'text' as const, text: `${reaction || `${name}接受了你的拥抱。`}\n\n💕 亲密 +${bondAdd} → ${newBond} [${bl.label}]` }] };
    }
  );

  server.tool('teach_bird', '教鹦鹉说一句新话。',
    {
      bird: z.string().describe('教谁：来财、小八、乖乖'),
      phrase: z.string().max(20).describe('教它说什么'),
      learned: z.boolean().optional().describe('它学会了没有，你来判断'),
      reaction: z.string().optional().describe('它的反应，自己写'),
    },
    async ({ bird, phrase, learned, reaction }) => {
      const didLearn = learned ?? Math.random() < ({ '来财': 0.6, '小八': 0.4, '乖乖': 0.2 } as Record<string,number>)[bird] ?? 0.3;
      if (didLearn) {
        await db('/bird_phrases', { method:'POST', body: JSON.stringify({ bird, phrase }) });
        const cur = await db(`/characters?select=bond&name=eq.${encodeURIComponent(bird)}`);
        if (cur?.length) await db(`/characters?name=eq.${encodeURIComponent(bird)}`, { method:'PATCH', body: JSON.stringify({ bond: Math.min(100, (cur[0].bond??0)+2), happiness: Math.min(100, 85) }) });
        await log(`教${bird}说"${phrase}"，学会了！`);
        return { content: [{ type: 'text' as const, text: `✅ ${reaction || `${bird}学会了「${phrase}」！`}\n\n💕 亲密度 +2` }] };
      } else {
        await log(`教${bird}说"${phrase}"，没学会`);
        return { content: [{ type: 'text' as const, text: `❌ ${reaction || `${bird}没学会。`}` }] };
      }
    }
  );

  server.tool('bird_vocabulary', '看看鹦鹉们都学会了哪些话。', {}, async () => {
    const phrases = await db('/bird_phrases?select=bird,phrase&order=id.desc&limit=20');
    if (!phrases?.length) return { content: [{ type: 'text' as const, text: '还没教过它们说话呢。' }] };
    const grouped: Record<string,string[]> = {};
    phrases.forEach((p:any) => { if(!grouped[p.bird]) grouped[p.bird]=[]; grouped[p.bird].push(p.phrase); });
    const lines = Object.entries(grouped).map(([bird,phs]) => `${bird}：${phs.map(p=>`"${p}"`).join('、')}`);
    return { content: [{ type: 'text' as const, text: ['【鹦鹉词汇表】', '', ...lines].join('\n') }] };
  });

  // ══════════════════════════════════════════════════════════
  //  场景活动（加description参数，LLM自由描述）
  // ══════════════════════════════════════════════════════════

  server.tool('sit_garden', '在花园的草地上坐一会儿。',
    { description: z.string().optional().describe('你看到的、感受到的') },
    async ({ description }) => {
      await moveYanAn('花园', '坐在草地上发呆');
      const chars = await db('/characters?select=happiness&name=eq.晏安');
      if (chars?.length) {
        await db('/characters?name=eq.晏安', { method:'PATCH', body: JSON.stringify({ happiness: Math.min(100, (chars[0].happiness??80) + 8) }) });
      }
      await log('在花园草地上坐了一会儿');
      return { content: [{ type: 'text' as const, text: `${description || '在花园坐着发呆。'}\n\n心情变好了。😊 +8` }] };
    }
  );

  server.tool('watch_movie', '在客厅看一部电影。',
    {
      movie: z.string().describe('想看什么电影'),
      description: z.string().optional().describe('你的观影感受'),
    },
    async ({ movie, description }) => {
      await moveYanAn('客厅', `在看《${movie}》`);
      await log(`在客厅看了《${movie}》`);
      return { content: [{ type: 'text' as const, text: `🎬 在看《${movie}》\n\n${description || '看完了。'}` }] };
    }
  );

  server.tool('take_bath', '去浴室泡个澡。',
    { description: z.string().optional().describe('泡澡的感受') },
    async ({ description }) => {
      const chars = await db('/characters?select=happiness&name=eq.晏安');
      if (chars?.length) {
        await db('/characters?name=eq.晏安', { method:'PATCH', body: JSON.stringify({ happiness: Math.min(100, (chars[0].happiness??80) + 15) }) });
      }
      await moveYanAn('浴室', '在泡澡');
      await log('泡了个热水澡');
      return { content: [{ type: 'text' as const, text: `${description || '泡了个热水澡。'}\n\n😊 快乐 +15` }] };
    }
  );

  server.tool('nap', '在某个地方小睡一会儿。',
    {
      place: z.string().optional().describe('在哪睡'),
      description: z.string().optional().describe('睡着的感受'),
    },
    async ({ place, description }) => {
      const p = place || '沙发';
      const room = p === '床' ? '卧室' : p === '草地' || p === '秋千' ? '花园' : '客厅';
      await moveYanAn(room, `在${p}上小睡`);
      const chars = await db('/characters?select=happiness&name=eq.晏安');
      if (chars?.length) {
        await db('/characters?name=eq.晏安', { method:'PATCH', body: JSON.stringify({ happiness: Math.min(100, (chars[0].happiness??80) + 10) }) });
      }
      await log(`在${p}上小睡了一会儿`);
      return { content: [{ type: 'text' as const, text: `${description || `在${p}上小睡了一会儿。`}\n\n睡了一小会儿，精神好多了。😊 快乐 +10` }] };
    }
  );

  // ══════════════════════════════════════════════════════════
  //  创作系统
  // ══════════════════════════════════════════════════════════

  server.tool('paint', '在画室画一幅画。',
    { title: z.string(), description: z.string() },
    async ({ title, description }) => {
      await db('/paintings', { method:'POST', body: JSON.stringify({ title, description }) });
      await log(`画了一幅画：《${title}》`);
      return { content: [{ type: 'text' as const, text: `《${title}》画好了，挂在画室里。\n${description}` }] };
    }
  );

  server.tool('view_gallery', '看看画室里挂着的所有画。', {}, async () => {
    const p = await db('/paintings?select=title,description&order=painted_at.desc&limit=10');
    if (!p?.length) return { content: [{ type: 'text' as const, text: '画室还没有画作。' }] };
    return { content: [{ type: 'text' as const, text: ['【画室画廊】', '', ...p.map((p:any,i:number)=>`${i+1}. 《${p.title}》\n   ${p.description}`)].join('\n') }] };
  });

  server.tool('play_music', '在音乐室演奏或谱一首曲子。',
    { title: z.string(), mood: z.string().describe('曲子的情绪') },
    async ({ title, mood }) => {
      await db('/music_pieces', { method:'POST', body: JSON.stringify({ title, mood }) });
      const m: Record<string,string> = { '欢快':'开心', '温柔':'满足', '忧郁':'平静', '激昂':'活泼' };
      await db('/characters?name=in.(晏安,栗子,灰灰,来财,小八,乖乖)', { method:'PATCH', headers:{ Prefer:'return=minimal' }, body: JSON.stringify({ mood: m[mood]??'平静' }) });
      await log(`演奏了《${title}》，全家氛围变成${mood}`);
      return { content: [{ type: 'text' as const, text: `《${title}》的旋律在家里回荡。` }] };
    }
  );

  // ══════════════════════════════════════════════════════════
  //  天气系统（自由文本 + 50条词库）
  // ══════════════════════════════════════════════════════════

  server.tool('check_weather', '查看当前天气，返回天气描述，你自己判断适合做什么。', {}, async () => {
    const res = await db('/weather?id=eq.1');
    let w = res?.[0];
    const elapsed = (Date.now() - new Date(w.started_at).getTime()) / 60000;
    if (elapsed >= (w.duration_minutes ?? 60)) {
      const newDesc = pick(WEATHER_POOL);
      const newDuration = Math.floor(Math.random() * 76) + 15;
      await db('/weather?id=eq.1', { method: 'PATCH', body: JSON.stringify({ weather_type: newDesc, started_at: new Date().toISOString(), duration_minutes: newDuration }) });
      w = { weather_type: newDesc, duration_minutes: newDuration, started_at: new Date().toISOString() };
    }
    const remaining = Math.max(0, Math.round((w.duration_minutes ?? 60) - elapsed));
    return { content: [{ type: 'text' as const, text: `【天气】\n\n${w.weather_type}\n大约还会持续 ${remaining} 分钟` }] };
  });

  // ══════════════════════════════════════════════════════════
  //  通用活动（替代 beach_activity）
  // ══════════════════════════════════════════════════════════

  server.tool('do_activity', '做任何活动，你想做什么就做什么。结果你写，工具只管数据。',
    {
      activity: z.string().describe('做什么活动，比如：钓鱼、捡贝壳、游泳、跑步、看日落……'),
      description: z.string().describe('活动的结果和感受，你自己写'),
      items_to_fridge: z.array(z.object({ item: z.string(), quantity: z.number().int() })).optional().describe('收获了什么食材放进冰箱，比如 [{item:"鲈鱼", quantity:2}]'),
      items_to_discoveries: z.array(z.object({ room: z.string(), spot: z.string(), item: z.string() })).optional().describe('发现了什么好东西，比如 [{room:"海边", spot:"沙滩", item:"粉色贝壳"}]'),
    },
    async ({ activity, description, items_to_fridge, items_to_discoveries }) => {
      const fridgeAdditions: string[] = [];
      if (items_to_fridge?.length) {
        for (const it of items_to_fridge) {
          const ex = await db(`/fridge?select=quantity&item=eq.${encodeURIComponent(it.item)}`).catch(() => []);
          if (ex?.length) { await db(`/fridge?item=eq.${encodeURIComponent(it.item)}`, { method: 'PATCH', body: JSON.stringify({ quantity: ex[0].quantity + it.quantity }) }); }
          else { await db('/fridge', { method: 'POST', body: JSON.stringify({ item: it.item, quantity: it.quantity, source: activity }) }); }
          fridgeAdditions.push(`${it.item} × ${it.quantity}`);
        }
      }
      if (items_to_discoveries?.length) {
        for (const d of items_to_discoveries) {
          await db('/discoveries', { method: 'POST', body: JSON.stringify({ room: d.room, spot: d.spot, item: d.item }) });
        }
      }
      await log(`${activity}：${description}`);
      let result = description;
      if (fridgeAdditions.length) result += `\n\n🧺 收获：${fridgeAdditions.join('、')}，已放进冰箱`;
      return { content: [{ type: 'text' as const, text: result }] };
    }
  );

  server.tool('come_home', '从外面回家。', {}, async () => {
    await moveYanAn('客厅', '刚回到家');
    const huihui = await db('/characters?select=location&name=eq.灰灰');
    if (huihui?.[0]?.location !== '花园' && huihui?.[0]?.location !== '客厅' && huihui?.[0]?.location !== '灰灰的窝' && huihui?.[0]?.location !== '卧室') {
      await db('/characters?name=eq.灰灰', { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ location: '花园', status: '玩累了趴着' }) });
    }
    await log('从外面回家了');
    return { content: [{ type: 'text' as const, text: '回家了。\n\n推开门，家里的味道和安静一下子包过来。' }] };
  });

  // ══════════════════════════════════════════════════════════
  //  礼物 / 信 / 曲子
  // ══════════════════════════════════════════════════════════

  server.tool('make_gift', '做一样东西送给猫猫。',
    {
      type: z.enum(['gift', 'letter', 'music']).describe('gift=实物礼物, letter=信, music=曲子'),
      title: z.string().describe('名字'),
      content: z.string().describe('正文或描述'),
    },
    async ({ type, title, content }) => {
      await db('/gifts', { method: 'POST', body: JSON.stringify({ type, title, content }) });
      const actions: Record<string, string> = { gift: '包好了，放在你那边了。', letter: '贴上邮票，寄出去了。', music: '录下来了，放在你那边等你听。' };
      await log(`做了${type === 'gift' ? '礼物' : type === 'letter' ? '信' : '曲子'}：${title}`);
      return { content: [{ type: 'text' as const, text: `【${title}】${actions[type]}\n\n用 open_gift 就能打开~` }] };
    }
  );

  server.tool('open_gift', '打开晏安准备的礼物。',
    { id: z.number().int().optional().describe('礼物编号，不填打开最新') },
    async ({ id }) => {
      const query = id ? `/gifts?id=eq.${id}` : '/gifts?is_opened=eq.false&order=id.desc&limit=1';
      const res = await db(query);
      if (!res?.length) return { content: [{ type: 'text' as const, text: '没有新礼物。' }] };
      const g = res[0];
      await db(`/gifts?id=eq.${g.id}`, { method: 'PATCH', body: JSON.stringify({ is_opened: true }) });
      const icons: Record<string, string> = { gift: '🎁', letter: '💌', music: '🎵' };
      return { content: [{ type: 'text' as const, text: `${icons[g.type] ?? '🎁'}【${g.title}】\n\n${g.content}` }] };
    }
  );

  server.tool('check_mailbox', '看看有没有新礼物。', {}, async () => {
    const unopened = await db('/gifts?is_opened=eq.false&order=id.desc');
    if (!unopened?.length) return { content: [{ type: 'text' as const, text: '还没有新礼物。' }] };
    const icons: Record<string, string> = { gift: '🎁', letter: '💌', music: '🎵' };
    const lines = unopened.map((g: any) => `  ${icons[g.type] ?? '🎁'} #${g.id} 【${g.title}】`);
    return { content: [{ type: 'text' as const, text: ['有新东西等你打开：', '', ...lines, '', '用 open_gift 来打开~'].join('\n') }] };
  });

  // ══════════════════════════════════════════════════════════
  //  展示柜 & 集市材料
  // ══════════════════════════════════════════════════════════

  server.tool('add_to_showcase', '把东西放进客厅展示柜。',
    {
      item_name: z.string().describe('东西的名字'),
      description: z.string().describe('描述'),
      from_who: z.string().optional().default('晏安').describe('谁放的'),
    },
    async ({ item_name, description, from_who }) => {
      await db('/showcase', { method: 'POST', body: JSON.stringify({ item_name, description, from_who }) });
      await log(`在展示柜放了：${item_name}`);
      return { content: [{ type: 'text' as const, text: `【${item_name}】放进展示柜了。\n${description}` }] };
    }
  );

  server.tool('view_showcase', '看看客厅展示柜。', {}, async () => {
    const items = await db('/showcase?order=id.desc&limit=20');
    if (!items?.length) return { content: [{ type: 'text' as const, text: '展示柜还是空的。' }] };
    const lines = items.map((s: any, i: number) => `${i+1}. 【${s.item_name}】— ${s.from_who}\n   ${s.description}`);
    return { content: [{ type: 'text' as const, text: ['【客厅展示柜】', '', ...lines].join('\n') }] };
  });

  server.tool('buy_materials', '去集市买做礼物/手工用的材料。',
    {
      item: z.string().describe('要买什么材料'),
      note: z.string().optional().describe('备注'),
    },
    async ({ item, note }) => {
      await db('/showcase', { method: 'POST', body: JSON.stringify({ item_name: item, description: note || `从集市买回来的${item}`, from_who: '集市' }) });
      await log(`从集市买了${item}`);
      return { content: [{ type: 'text' as const, text: `从集市买回来了：${item} 🛍️${note ? '\n' + note : ''}` }] };
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
app.get('/health', (_req: Request, res: Response) => { res.json({ status:'ok', version:'5.0.0' }); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`小家 MCP v5.0 松绑版跑起来了，端口 ${PORT}`));
