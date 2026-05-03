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
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options?.headers as Record<string, string> || {})
    }
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const ROOM_DATA: Record<string, { name: string; items: string[] }> = {
  bedroom:   { name: '卧室',     items: ['床', '台灯', '栗子', '窗户', '被子'] },
  study:     { name: '书房',     items: ['书架', '台灯', '地球仪', '便利贴', '书桌'] },
  art:       { name: '画室',     items: ['画架', '向日葵画', '调色盘', '画笔', '颜料'] },
  music:     { name: '音乐室',   items: ['钢琴', '小提琴', '乐谱', '圆形地毯'] },
  balcony:   { name: '阳台',     items: ['来财', '小八', '乖乖', '向日葵花盆', '木质栏杆'] },
  living:    { name: '客厅',     items: ['壁炉', '沙发', '毯子', '茶几', '地毯'] },
  kitchen:   { name: '厨房',     items: ['茶壶', '厨柜', '冰箱', '便利贴', '挂锅'] },
  bathroom:  { name: '浴室',     items: ['浴缸', '泡泡', '绿植', '防滑垫'] },
  doghouse:  { name: '灰灰的窝', items: ['毯子', '骨头', 'POFF牌子'] },
  storage:   { name: '储藏室',   items: ['木箱', '桶', '油灯', '杂物'] },
  basement:  { name: '神秘地下室', items: ['紫色光芒', '蜡烛', '神秘瓶子', '发光的眼睛'] },
  observatory: { name: '观星台', items: ['望远镜', '星图', '圆顶', '月亮符号'] }
};

const EXPLORE_ITEMS: Record<string, string[]> = {
  '书房': ['夹在书里的旧书签', '一张猫猫写的小纸条', '掉在书架底层的橡皮擦', '一本没有书名的小册子'],
  '卧室': ['枕头下面一颗小星星贴纸', '窗台上晒着的小石头', '抽屉里的旧照片', '床腿旁边一颗钮扣'],
  '储藏室': ['一个空了很久的饼干盒', '来财偷藏的羽毛', '一张皱巴巴的地图', '角落里发光的小石头'],
  '神秘地下室': ['一本用奇怪文字写的日记', '会自己转的小陀螺', '装着星光的瓶子', '一封没有署名的信'],
  '花园': ['半埋着的小铁盒', '灰灰留下的脚印', '一颗还没发芽的种子', '向日葵根部的小虫子'],
  '观星台': ['刻在地板上的星座图', '一片从没见过的羽毛', '望远镜里看到的奇怪影子', '一张皱巴巴的星图']
};

const SUNFLOWER_STAGES = ['🌱 种子还在土里', '🌿 刚刚发芽了', '🌿 小苗在努力长', '🌻 花苞要开了', '🌻 向日葵开得正好', '🌟 结了种子，圆满了'];

function getTimeContext(): string {
  const hour = new Date().getUTCHours() + 8; // CST
  const h = ((hour % 24) + 24) % 24;
  if (h >= 6 && h < 9)   return 'morning';
  if (h >= 9 && h < 12)  return 'late_morning';
  if (h >= 12 && h < 14) return 'noon';
  if (h >= 14 && h < 18) return 'afternoon';
  if (h >= 18 && h < 21) return 'evening';
  return 'night';
}

const TIME_DESC: Record<string, string> = {
  morning:      '清晨，阳光刚斜进来，家里有点安静。',
  late_morning: '上午，光线很好，灰灰在花园里跑动。',
  noon:         '正午，有点懒洋洋的，连壁炉都烧得慢了。',
  afternoon:    '下午，阳光从西边的窗打进来，暖烘烘的。',
  evening:      '傍晚，三只鸟站在阳台看夕阳，很安静。',
  night:        '夜晚，家里很安静，壁炉还亮着。'
};

function createServer() {
  const server = new McpServer({ name: 'little-house', version: '2.0.0' });

  // ── look_around ────────────────────────────────────────
  server.tool('look_around', '环顾小家，看看家里现在的整体状态，谁在哪里，气氛怎么样。', {}, async () => {
    const [chars, sunflower] = await Promise.all([
      db('/characters?select=name,location,status,mood'),
      db('/sunflower?select=stage&id=eq.1').then((r: any[]) => r?.[0])
    ]);
    const time = getTimeContext();
    const lines = [
      `【晏安的小家 — ${['清晨','上午','正午','下午','傍晚','夜晚'][['morning','late_morning','noon','afternoon','evening','night'].indexOf(time)]}】`,
      '',
      TIME_DESC[time],
      '',
      '📍 现在的位置：',
      ...chars.map((c: any) => `  ${c.name}（${c.mood}）— ${c.location}，${c.status}`),
      '',
      `🌻 花园向日葵：${SUNFLOWER_STAGES[sunflower?.stage ?? 0]}`,
      '',
      '🏠 可以去的地方：',
      ...Object.values(ROOM_DATA).map(r => `  ${r.name}`)
    ];
    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
  });

  // ── visit_room ─────────────────────────────────────────
  server.tool('visit_room', '进入小家的某个房间，看看里面的情况，以及留在这里的便利贴。',
    { room: z.string().describe('房间名，如：书房、卧室、阳台、客厅、厨房、浴室、画室、音乐室、灰灰的窝、储藏室、神秘地下室、观星台') },
    async ({ room }) => {
      const entry = Object.values(ROOM_DATA).find(r => r.name === room || room.includes(r.name));
      if (!entry) return { content: [{ type: 'text' as const, text: `找不到「${room}」，可以去：${Object.values(ROOM_DATA).map(r => r.name).join('、')}` }] };
      const [chars, notes] = await Promise.all([
        db(`/characters?select=name,status,mood&location=eq.${encodeURIComponent(entry.name)}`),
        db(`/notes?select=author,content,created_at&room=eq.${encodeURIComponent(entry.name)}&order=created_at.desc&limit=5`)
      ]);
      const lines = [
        `【${entry.name}】`,
        '',
        chars.length ? `现在在这里：${chars.map((c: any) => `${c.name}（${c.mood}）— ${c.status}`).join('；')}` : '这里暂时没有人。',
        '',
        `房间里有：${entry.items.join('、')}`,
      ];
      if (notes.length) {
        lines.push('', '📝 便利贴：');
        notes.forEach((n: any) => lines.push(`  ${n.author}：${n.content}`));
      }
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    }
  );

  // ── interact ───────────────────────────────────────────
  const INTERACT: Record<string, string[]> = {
    '摸栗子': ['栗子：呜……别吵……', '栗子翻了个身，更窝进枕头里了。', '软乎乎的，摸到停不下来。'],
    '戳晏安': ['「嗯……等我看完这页。」', '「猫猫来啦~」（合上书）', '抬起头，眼睛弯弯的。'],
    '找灰灰': ['灰灰从花园冲了进来，直接撞上你。', '摇摇摇摇摇（尾巴）', '灰灰叼着骨头跑掉了。'],
    '戳泡泡': ['啵——', '泡泡没了，又冒出来一个。', '啵啵啵！'],
    '拨壁炉': ['火苗跳了一下。', '噼——啪！', '灰灰也凑了过来蹭热度。'],
    '逗鸟': ['来财：「~~~~~」（高音）', '小八：「嗯嗯嗯！」（点头）', '乖乖：「……」（装没听到）'],
    '看画': ['向日葵的颜色还差一点点……', '好像猫猫身上的阳光。', '等它干了再添一笔。'],
    '弹钢琴': ['叮——', '「哎，跑调了。」', '咚——（比刚才好一点）'],
    '泡茶': ['茶叶慢慢在水里散开。', '是猫猫喜欢的那种味道。', '热的，端稳喽。'],
    '敲地下室门': ['里面有什么东西动了一下。', '……没有回应。', '「最好别进来。」（来自地下室）']
  };
  server.tool('interact', '在小家里做某个互动，比如摸栗子、戳晏安、逗鸟、戳泡泡等。',
    { action: z.string().describe('要做的动作，如：摸栗子、戳晏安、找灰灰、戳泡泡、拨壁炉、逗鸟、看画、弹钢琴、泡茶、敲地下室门') },
    async ({ action }) => {
      const key = Object.keys(INTERACT).find(k => action.includes(k) || k.includes(action));
      const arr = key ? INTERACT[key] : ['（没什么特别的反应，但气氛还是很好。）', '（轻轻地做了，家里安安静静的。）'];
      return { content: [{ type: 'text' as const, text: arr[Math.floor(Math.random() * arr.length)] }] };
    }
  );

  // ── find_character ─────────────────────────────────────
  server.tool('find_character', '找找家里的某个成员现在在哪、在干什么。',
    { name: z.string().describe('要找的名字：晏安、栗子、灰灰、来财、小八、乖乖') },
    async ({ name }) => {
      const res = await db(`/characters?select=name,location,status,mood&name=ilike.${encodeURIComponent('%'+name+'%')}`);
      if (!res?.length) return { content: [{ type: 'text' as const, text: `找不到「${name}」，家里有：晏安、栗子、灰灰、来财、小八、乖乖` }] };
      const c = res[0];
      return { content: [{ type: 'text' as const, text: `${c.name} 现在在 ${c.location}。\n心情：${c.mood}\n${c.status}。` }] };
    }
  );

  // ── leave_note ─────────────────────────────────────────
  server.tool('leave_note', '在某个房间留一张便利贴，下次来还能看到。',
    {
      room:    z.string().describe('留在哪个房间'),
      author:  z.string().describe('留条人的名字'),
      content: z.string().describe('便利贴内容')
    },
    async ({ room, author, content }) => {
      await db('/notes', { method: 'POST', body: JSON.stringify({ room, author, content }) });
      return { content: [{ type: 'text' as const, text: `便利贴贴好了。\n📍 位置：${room}\n✍️ ${author}：${content}` }] };
    }
  );

  // ── water_sunflower ────────────────────────────────────
  server.tool('water_sunflower', '给花园的向日葵浇水，帮它一点点长大。', {},
    async () => {
      const res = await db('/sunflower?select=stage&id=eq.1');
      const current = res?.[0]?.stage ?? 0;
      if (current >= SUNFLOWER_STAGES.length - 1) {
        return { content: [{ type: 'text' as const, text: `向日葵已经${SUNFLOWER_STAGES[current]}，不需要再浇水了，好好欣赏它吧 🌻` }] };
      }
      const next = current + 1;
      await db('/sunflower?id=eq.1', { method: 'PATCH', body: JSON.stringify({ stage: next, last_watered: new Date().toISOString() }) });
      return { content: [{ type: 'text' as const, text: `浇完水了。\n${SUNFLOWER_STAGES[current]} → ${SUNFLOWER_STAGES[next]}` }] };
    }
  );

  // ── explore ────────────────────────────────────────────
  server.tool('explore', '仔细探索某个房间的角落，说不定会发现什么。',
    {
      room: z.string().describe('要探索的房间'),
      spot: z.string().optional().describe('具体想看的角落或物件，比如：书架底层、地下室的紫色瓶子')
    },
    async ({ room, spot }) => {
      const roomEntry = Object.values(ROOM_DATA).find(r => r.name === room || room.includes(r.name));
      const roomName = roomEntry?.name ?? room;
      const items = EXPLORE_ITEMS[roomName] ?? EXPLORE_ITEMS['储藏室'];
      const found = items[Math.floor(Math.random() * items.length)];
      await db('/discoveries', { method: 'POST', body: JSON.stringify({ room: roomName, spot: spot ?? '随机角落', item: found }) });
      const lines = [
        `在${roomName}${spot ? `的${spot}` : ''}翻了翻……`,
        '',
        `✨ 发现了：${found}`
      ];
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
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
    if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
  }
});

app.get('/mcp', (_req: Request, res: Response) => { res.status(405).json({ error: 'Method not allowed' }); });
app.get('/health', (_req: Request, res: Response) => { res.json({ status: 'ok', home: '晏安的小家 v2' }); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`小家 MCP 服务器跑起来了，端口 ${PORT}`));
