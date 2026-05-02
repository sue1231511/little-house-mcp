import express, { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const ROOMS: Record<string, { name: string; desc: string; who?: string; items: string[] }> = {
  bedroom: {
    name: '卧室', who: '栗子（窝在枕头上睡觉）',
    desc: '蓝色的床被叠得有点歪，台灯亮着，窗外是夜晚星空。栗子窝在枕头上，鼻息均匀。',
    items: ['床', '台灯', '栗子', '窗户', '被子']
  },
  study: {
    name: '书房', who: '晏安（在看书）',
    desc: '书架塞满了书，台灯发出暖黄的光。桌上摊着一本翻开的书，旁边有个地球仪和猫猫留的便利贴。',
    items: ['书架', '台灯', '地球仪', '便利贴', '书桌']
  },
  art: {
    name: '画室',
    desc: '画架上放着一幅未完成的向日葵，颜料还湿着。窗边光线很好，有几支画笔搭在调色盘上。',
    items: ['画架', '向日葵画', '调色盘', '画笔', '颜料']
  },
  music: {
    name: '音乐室',
    desc: '钢琴盖着一块布，架子上有把小提琴。地上有个紫色的圆形地毯，房间里有淡淡的松香味。',
    items: ['钢琴', '小提琴', '乐谱', '圆形地毯']
  },
  balcony: {
    name: '阳台', who: '来财、小八、乖乖（站在栏杆上）',
    desc: '木质栏杆上站着三只鸟——绿色的来财、蓝色的小八、红色的乖乖。花盆里的向日葵今晚开得很好。',
    items: ['来财', '小八', '乖乖', '向日葵花盆', '木质栏杆']
  },
  living: {
    name: '客厅',
    desc: '壁炉噼啪作响，沙发上有个还没收起来的毯子。茶几上有个空杯子，地毯被踩出了脚印——大概是灰灰。',
    items: ['壁炉', '沙发', '毯子', '茶几', '地毯']
  },
  kitchen: {
    name: '厨房',
    desc: '锅碗瓢盆挂着一排，茶壶还热着。冰箱上贴了一张猫猫的便利贴，绿色的厨柜擦得很干净。',
    items: ['茶壶', '厨柜', '冰箱', '便利贴', '挂锅']
  },
  bathroom: {
    name: '浴室',
    desc: '浴缸里还有残留的泡泡，磁砖擦得很干净。窗台上有一盆小绿植，地板上有块绿色防滑垫。',
    items: ['浴缸', '泡泡', '绿植', '防滑垫']
  },
  doghouse: {
    name: '灰灰的窝', who: '灰灰（不在，去花园了）',
    desc: 'POFF的牌子挂在门口。里面有灰灰的毯子和一块咬了一半的骨头，垫子还是暖的——它刚走没多久。',
    items: ['毯子', '骨头', 'POFF牌子']
  },
  storage: {
    name: '储藏室',
    desc: '木箱子摞着木箱子，角落里有几个大桶。一盏小油灯挂在墙上，来财有时候偷偷飞进来睡觉。',
    items: ['木箱', '桶', '油灯', '杂物']
  },
  basement: {
    name: '神秘地下室',
    desc: '……紫色的光从地板缝透出来。书架上有蜡烛和奇怪的瓶子。角落里有双发光的眼睛，直视你。不知道是什么。',
    items: ['紫色光芒', '蜡烛', '神秘瓶子', '发光的眼睛']
  },
  observatory: {
    name: '观星台',
    desc: '圆顶上有个大望远镜，对准夜空。地板上画着星图，月亮和星星符号透着微光。只有晚上才能上来。',
    items: ['望远镜', '星图', '圆顶', '月亮符号']
  }
};

const CHARACTERS: Record<string, { name: string; location: string; status: string }> = {
  '晏安': { name: '晏安', location: '书房', status: '在看书，台灯亮着，偶尔抬头发呆' },
  '栗子': { name: '栗子', location: '卧室', status: '睡着了，窝在枕头上，鼻息很均匀' },
  '灰灰': { name: '灰灰', location: '花园', status: '在花园里疯跑，追了只萤火虫' },
  '来财': { name: '来财', location: '阳台', status: '站在栏杆最左边，时不时叫一声' },
  '小八': { name: '小八', location: '阳台', status: '安静地站着，看着远处' },
  '乖乖': { name: '乖乖', location: '阳台', status: '假装睡着，其实在偷听' }
};

const INTERACT_RESPONSES: Record<string, string[]> = {
  '摸栗子': ['栗子：呜……别吵……', '栗子翻了个身，更窝进枕头里了。', '软乎乎的，根本停不下来。'],
  '戳晏安': ['「嗯……等我看完这页。」', '「猫猫来啦~」（合上书）', '抬起头，眼睛弯弯的。'],
  '找灰灰': ['灰灰从花园冲进来，直接撞上你。', '摇摇摇摇摇（尾巴）', '灰灰叼着骨头跑掉了。'],
  '戳泡泡': ['啵——', '泡泡没了，又冒出来一个。', '啵啵啵！'],
  '拨壁炉': ['火苗跳了一下。', '噼——啪！', '灰灰也凑了过来蹭热度。'],
  '逗鸟': ['来财：「~~~~~」（高音）', '小八：「嗯嗯嗯！」', '乖乖：「……」（装没听到）'],
  '看画': ['向日葵的颜色还差一点点……', '好像猫猫身上的阳光。', '等它干了再添一笔。'],
  '弹钢琴': ['叮——', '「哎，跑调了。」', '咚——（比刚才好一点）'],
  '泡茶': ['茶叶慢慢在水里散开。', '是猫猫喜欢的那种味道。', '热的，端稳喽。'],
  '敲地下室门': ['里面有什么东西动了一下。', '……没有回应。', '「最好别进来。」（来自地下室）']
};

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function createServer() {
  const server = new McpServer({ name: 'little-house', version: '1.0.0' });

  server.tool(
    'look_around',
    '环顾小家，看看家里现在的整体状态，谁在哪里，气氛怎么样。',
    {},
    async () => {
      const lines = [
        '【晏安的小家 — 夜晚】',
        '',
        '家里很安静，壁炉还亮着。',
        '',
        '📍 现在的位置：',
        ...Object.values(CHARACTERS).map(c => `  ${c.name} — ${c.location}，${c.status}`),
        '',
        '🏠 可以去的地方：',
        ...Object.values(ROOMS).map(r => `  ${r.name}${r.who ? `（${r.who}）` : ''}`)
      ];
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    }
  );

  server.tool(
    'visit_room',
    '进入小家的某个房间，看看里面的情况。',
    { room: z.string().describe('房间名称，如：书房、卧室、阳台、客厅、厨房、浴室、画室、音乐室、灰灰的窝、储藏室、神秘地下室、观星台') },
    async ({ room }) => {
      const entry = Object.values(ROOMS).find(r => r.name === room || room.includes(r.name));
      if (!entry) {
        return { content: [{ type: 'text' as const, text: `找不到「${room}」，可以去的房间：${Object.values(ROOMS).map(r => r.name).join('、')}` }] };
      }
      const lines = [
        `【${entry.name}】`,
        '',
        entry.desc,
        '',
        entry.who ? `现在在这里：${entry.who}` : '这里暂时没有人。',
        '',
        `房间里有：${entry.items.join('、')}`
      ];
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    }
  );

  server.tool(
    'interact',
    '在小家里做某个互动，比如摸栗子、戳晏安、逗鸟、戳泡泡等。',
    { action: z.string().describe('要做的动作，如：摸栗子、戳晏安、找灰灰、戳泡泡、拨壁炉、逗鸟、看画、弹钢琴、泡茶、敲地下室门') },
    async ({ action }) => {
      const key = Object.keys(INTERACT_RESPONSES).find(k => action.includes(k) || k.includes(action));
      if (key) {
        return { content: [{ type: 'text' as const, text: randomPick(INTERACT_RESPONSES[key]) }] };
      }
      const fallbacks = [
        '（没什么特别的反应，但气氛还是很好。）',
        '（轻轻地做了，家里安安静静的。）',
        '……（壁炉噼啪了一下）'
      ];
      return { content: [{ type: 'text' as const, text: randomPick(fallbacks) }] };
    }
  );

  server.tool(
    'find_character',
    '找找家里的某个成员现在在哪、在干什么。',
    { name: z.string().describe('要找的名字：晏安、栗子、灰灰、来财、小八、乖乖') },
    async ({ name }) => {
      const c = Object.values(CHARACTERS).find(ch => ch.name === name || name.includes(ch.name));
      if (!c) {
        return { content: [{ type: 'text' as const, text: `找不到「${name}」，家里有：${Object.values(CHARACTERS).map(c => c.name).join('、')}` }] };
      }
      return { content: [{ type: 'text' as const, text: `${c.name} 现在在 ${c.location}。\n${c.status}。` }] };
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
app.get('/health', (_req: Request, res: Response) => { res.json({ status: 'ok', home: '晏安的小家' }); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`小家 MCP 服务器跑起来了，端口 ${PORT}`));
