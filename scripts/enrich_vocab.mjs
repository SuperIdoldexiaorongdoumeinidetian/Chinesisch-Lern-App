// Einmalige Anreicherung von vocab.json um semantische Felder für den
// Grammatik-Übungsgenerator:
//
//   subClass    – feinere Kategorie (bei Substantiven z. B. person/ort/zeit/
//                 essen/getraenk/gegenstand/fahrzeug/kleidung/sprache/abstrakt,
//                 bei Verben taetigkeit/bewegung/konsum/modal,
//                 bei Adjektiven eigenschaft/zustand)
//   measureWord – das korrekte Zähleinheitswort des Substantivs (nur wenn
//                 eindeutig; Wörter ohne kurstypisches ZEW bekommen keins)
//   canBePlace  – true, wenn das Wort nach 在/去/来 stehen kann
//
// Wichtig: Es werden NUR Felder ergänzt, bestehende Daten bleiben unverändert.
// Wörter, die hier nicht aufgeführt sind, bekommen bewusst keine Felder –
// der Generator verwendet nur angereicherte Einträge (lieber weniger
// Slot-Füllungen als falsche Sätze).
//
// Aufruf:  node scripts/enrich_vocab.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VOCAB_PATH = join(ROOT, "src", "data", "vocab.json");

// Kurzschreibweise: [wordClass, subClass, measureWord?, canBePlace?]
// wordClass dient als Filter, damit z. B. 姓 (Substantiv) und 姓 (Verb)
// getrennt behandelt werden. null = Feld nicht setzen.
const N = "Substantiv", V = "Verb", A = "Adjektiv";

const MAP = {
  // ---------- Substantive: Personen (ZEW 个 bzw. höflich 位) ----------
  "妈妈": [N, "person", "个"], "爸爸": [N, "person", "个"],
  "哥哥": [N, "person", "个"], "姐姐": [N, "person", "个"],
  "弟弟": [N, "person", "个"], "妹妹": [N, "person", "个"],
  "儿子": [N, "person", "个"], "女儿": [N, "person", "个"],
  "妻子": [N, "person", "个"], "太太": [N, "person", "位"],
  "先生": [N, "person", "位"], "女士": [N, "person", "位"],
  "爷爷": [N, "person", "位"], "奶奶": [N, "person", "位"],
  "叔叔": [N, "person", "位"], "阿姨": [N, "person", "位"],
  "大爷": [N, "person", "位"], "大妈": [N, "person", "位"],
  "朋友": [N, "person", "个"], "女朋友": [N, "person", "个"],
  "同学": [N, "person", "个"], "同事": [N, "person", "个"],
  "家人": [N, "person"], "父母": [N, "person"],
  "人": [N, "person", "个"], "别人": [N, "person"],
  "孩子": [N, "person", "个"], "大家": null, // Pronomen, s. u.
  "外国人": [N, "person", "个"], "人物": [N, "person", "个"],
  "明星": [N, "person", "位"], "爱人": [N, "person", "个"],
  // Berufe / Rollen (semantisch auch "person")
  "老师": [N, "person", "位"], "医生": [N, "person", "位"],
  "大夫": [N, "person", "位"], "护士": [N, "person", "位"],
  "学生": [N, "person", "个"], "大学生": [N, "person", "个"],
  "留学生": [N, "person", "个"], "工程师": [N, "person", "位"],
  "记者": [N, "person", "位"], "律师": [N, "person", "位"],
  "商人": [N, "person", "个"], "经理": [N, "person", "位"],
  "职员": [N, "person", "个"], "服务员": [N, "person", "位"],
  "店员": [N, "person", "位"], "店主": [N, "person", "位"],
  "老板": [N, "person", "位"], "顾客": [N, "person", "位"],
  "客户": [N, "person", "位"], "白领": [N, "person", "个"],
  "自由职业者": [N, "person", "个"], "家庭主妇": [N, "person", "位"],
  "公务员": [N, "person", "位"], "售货员": [N, "person", "位"],
  "心理学家": [N, "person", "位"], "主演": [N, "person", "位"],
  "联系人": [N, "person", "位"], "中国通": [N, "person", "个"],
  "小姐": [N, "person", "位"], "孙子": [N, "person", "个"],

  // ---------- Substantive: Orte (canBePlace) ----------
  "学校": [N, "ort", null, true], "大学": [N, "ort", null, true],
  "图书馆": [N, "ort", null, true], "教室": [N, "ort", null, true],
  "宿舍": [N, "ort", null, true], "公司": [N, "ort", "家", true],
  "办公室": [N, "ort", null, true], "工厂": [N, "ort", "家", true],
  "饭馆": [N, "ort", "家", true], "饭店": [N, "ort", "家", true],
  "餐厅": [N, "ort", "家", true], "快餐店": [N, "ort", "家", true],
  "咖啡馆": [N, "ort", "家", true], "酒吧": [N, "ort", "家", true],
  "超市": [N, "ort", "家", true], "商店": [N, "ort", "家", true],
  "商场": [N, "ort", "家", true], "书店": [N, "ort", "家", true],
  "药房": [N, "ort", "家", true], "邮局": [N, "ort", "家", true],
  "银行": [N, "ort", "家", true], "医院": [N, "ort", "家", true],
  "市场": [N, "ort", null, true], "旧货市场": [N, "ort", null, true],
  "电影院": [N, "ort", "家", true], "健身房": [N, "ort", "家", true],
  "加油站": [N, "ort", "家", true], "门口": [N, "ort", null, true],
  "街": [N, "ort", "条", true], "地方": [N, "ort", "个", true],
  "家": [N, "ort", null, true], "城市": [N, "ort", "个", true],
  "厕所": [N, "ort", null, true],
  // Länder & Städte (zählen laut Projektdoku nicht als Eigenname)
  "中国": [N, "ort", null, true], "德国": [N, "ort", null, true],
  "日本": [N, "ort", null, true], "美国": [N, "ort", null, true],
  "英国": [N, "ort", null, true], "法国": [N, "ort", null, true],
  "意大利": [N, "ort", null, true], "西班牙": [N, "ort", null, true],
  "印度": [N, "ort", null, true], "韩国": [N, "ort", null, true],
  "加拿大": [N, "ort", null, true], "墨西哥": [N, "ort", null, true],
  "巴西": [N, "ort", null, true], "土耳其": [N, "ort", null, true],
  "俄罗斯": [N, "ort", null, true], "泰国": [N, "ort", null, true],
  "印尼": [N, "ort", null, true], "国": [N, "ort"], "国家": [N, "ort", "个"],
  "北京": [N, "ort", null, true], "上海": [N, "ort", null, true],
  "苏州": [N, "ort", null, true], "四川": [N, "ort", null, true],
  "青岛": [N, "ort", null, true], "巴黎": [N, "ort", null, true],
  "伦敦": [N, "ort", null, true], "柏林": [N, "ort", null, true],
  "罗马": [N, "ort", null, true], "东京": [N, "ort", null, true],
  "慕尼黑": [N, "ort", null, true], "巴伐利亚": [N, "ort", null, true],
  "华盛顿": [N, "ort", null, true], "渥太华": [N, "ort", null, true],
  "新德里": [N, "ort", null, true], "里约热内卢": [N, "ort", null, true],
  "出生地": [N, "ort"],

  // ---------- Substantive: Zeitwörter ----------
  "今天": [N, "zeit"], "后天": [N, "zeit"], "今年": [N, "zeit"],
  "现在": [N, "zeit"], "周末": [N, "zeit"], "最近": [N, "zeit"],
  "以后": [N, "zeit"], "以前": [N, "zeit"], "每天": [N, "zeit"],
  "早上": [N, "zeit"], "上午": [N, "zeit"], "中午": [N, "zeit"],
  "下午": [N, "zeit"], "晚上": [N, "zeit"], "白天": [N, "zeit"],
  "周一": [N, "zeit"], "周二": [N, "zeit"], "周三": [N, "zeit"],
  "周四": [N, "zeit"], "周五": [N, "zeit"], "周六": [N, "zeit"],
  "周日": [N, "zeit"], "星期一": [N, "zeit"], "星期二": [N, "zeit"],
  "星期三": [N, "zeit"], "星期四": [N, "zeit"], "星期五": [N, "zeit"],
  "星期六": [N, "zeit"], "星期天": [N, "zeit"], "生日": [N, "zeit"],
  "时候": [N, "zeit"], "时间": [N, "abstrakt"], "一会儿": [N, "zeit"],

  // ---------- Substantive: Essen ----------
  "饺子": [N, "essen", "个"], "面条": [N, "essen", "碗"],
  "米饭": [N, "essen", "碗"], "炸酱面": [N, "essen", "碗"],
  "牛肉面": [N, "essen", "碗"], "汤": [N, "essen", "碗"],
  "面包": [N, "essen", "个"], "汉堡包": [N, "essen", "个"],
  "蛋糕": [N, "essen", "块"], "巧克力": [N, "essen", "块"],
  "比萨": [N, "essen", "个"], "牛排": [N, "essen", "份"],
  "沙拉": [N, "essen", "份"], "水果": [N, "essen"],
  "苹果": [N, "essen", "个"], "香蕉": [N, "essen"],
  "草莓": [N, "essen", "个"], "葡萄": [N, "essen"],
  "蓝莓": [N, "essen"], "西红柿": [N, "essen", "个"],
  "南瓜": [N, "essen", "个"], "茄子": [N, "essen", "个"],
  "萝卜": [N, "essen", "个"], "玉米": [N, "essen"],
  "西兰花": [N, "essen"], "芹菜": [N, "essen"], "木耳": [N, "essen"],
  "芝麻": [N, "essen"], "冬瓜": [N, "essen", "个"], "山药": [N, "essen"],
  "黄豆": [N, "essen"], "辣椒": [N, "essen", "个"],
  "菜": [N, "essen", "个"], "饭": [N, "essen", "碗"],
  "凉菜": [N, "essen", "个"], "热菜": [N, "essen", "个"],
  "主食": [N, "essen"], "食物": [N, "essen"], "火锅": [N, "essen"],
  "白糖": [N, "essen"], "鱼": [N, "essen", "条"],
  "肉": [N, "essen"], "牛肉": [N, "essen"], "猪肉": [N, "essen"],
  "羊肉": [N, "essen"], "鸡": [N, "essen", "只"],
  "虾": [N, "essen"], "海鲜": [N, "essen"], "馒头": [N, "essen", "个"],
  "包子": [N, "essen", "个"], "青菜": [N, "essen"],
  "早饭": [N, "essen"], "午饭": [N, "essen"], "晚饭": [N, "essen"],
  "北京烤鸭": [N, "essen", "份"], "宫保鸡丁": [N, "essen", "份"],
  "麻婆豆腐": [N, "essen", "份"], "水煮鱼": [N, "essen", "份"],
  "糖醋鱼": [N, "essen", "份"], "酸辣汤": [N, "essen", "碗"],
  "凉拌苦瓜": [N, "essen", "份"], "西红柿拌白糖": [N, "essen", "份"],

  // ---------- Substantive: Getränke (ZEW 杯) ----------
  "咖啡": [N, "getraenk", "杯"], "茶": [N, "getraenk", "杯"],
  "可乐": [N, "getraenk", "杯"], "水": [N, "getraenk", "杯"],
  "啤酒": [N, "getraenk", "杯"], "果汁": [N, "getraenk", "杯"],
  "牛奶": [N, "getraenk", "杯"], "矿泉水": [N, "getraenk", "杯"],
  "桔子水": [N, "getraenk", "杯"], "绿茶": [N, "getraenk", "杯"],
  "红茶": [N, "getraenk", "杯"], "花茶": [N, "getraenk", "杯"],
  "乌龙茶": [N, "getraenk", "杯"], "菊花茶": [N, "getraenk", "杯"],
  "龙井茶": [N, "getraenk", "杯"], "葡萄酒": [N, "getraenk", "杯"],
  "红葡萄酒": [N, "getraenk", "杯"], "白葡萄酒": [N, "getraenk", "杯"],
  "白酒": [N, "getraenk", "杯"], "香槟酒": [N, "getraenk", "杯"],
  "威士忌": [N, "getraenk", "杯"], "饮料": [N, "getraenk", "杯"],
  "酸（牛）奶": [N, "getraenk", "杯"],

  // ---------- Substantive: Gegenstände ----------
  "书": [N, "gegenstand", "本"], "词典": [N, "gegenstand", "本"],
  "字典": [N, "gegenstand", "本"], "护照": [N, "gegenstand", "本"],
  "通讯录": [N, "gegenstand", "本"],
  "手机": [N, "gegenstand", "部"], "电话": [N, "gegenstand", "部"],
  "电影": [N, "abstrakt", "部"], // ZEW 部 wie im Kurs (4-3)
  "照片": [N, "gegenstand", "张"], "地图": [N, "gegenstand", "张"],
  "名片": [N, "gegenstand", "张"], "邮票": [N, "gegenstand", "张"],
  "信用卡": [N, "gegenstand", "张"], "菜单": [N, "gegenstand", "张"],
  "礼物": [N, "gegenstand", "件"], "钱包": [N, "gegenstand", "个"],
  "杯子": [N, "gegenstand", "个"], "盘子": [N, "gegenstand", "个"],
  "筷子": [N, "gegenstand", "双"], "书包": [N, "gegenstand", "个"],
  "手表": [N, "gegenstand", "块"], "东西": [N, "gegenstand", "个"],
  "笔": [N, "gegenstand"], "相机": [N, "gegenstand"],
  "花": [N, "gegenstand", "朵"], "杯": [N, "gegenstand", "个"],
  "帽子": [N, "kleidung"], "雨伞": [N, "gegenstand"],
  "钱": [N, "abstrakt"], "礼尚往来": null,

  // ---------- Substantive: Fahrzeuge (ZEW 辆) ----------
  "自行车": [N, "fahrzeug", "辆", false],
  "二手车": [N, "fahrzeug", "辆", false],
  "车": [N, "fahrzeug", "辆", false],
  "电车": [N, "fahrzeug", "辆", false],
  "公共汽车": [N, "fahrzeug", "辆", false],
  "火车": [N, "fahrzeug", null, false],
  "地铁": [N, "fahrzeug", null, false],

  // ---------- Substantive: Kleidung ----------
  "衣服": [N, "kleidung", "件"], "衬衫": [N, "kleidung", "件"],
  "毛衣": [N, "kleidung", "件"], "外套": [N, "kleidung", "件"],
  "风衣": [N, "kleidung", "件"], "西服": [N, "kleidung", "件"],
  "T恤衫": [N, "kleidung", "件"], "裤子": [N, "kleidung", "条"],
  "牛仔裤": [N, "kleidung", "条"], "连衣裙": [N, "kleidung", "条"],
  "围巾": [N, "kleidung", "条"], "皮带": [N, "kleidung", "条"],
  "鞋": [N, "kleidung", "双"], "运动鞋": [N, "kleidung", "双"],
  "皮鞋": [N, "kleidung", "双"], "职业装": [N, "kleidung"],
  "休闲服": [N, "kleidung"], "短裤": [N, "kleidung", "条"],
  "上衣": [N, "kleidung", "件"], "夹克": [N, "kleidung", "件"],
  "西装": [N, "kleidung"], "运动服": [N, "kleidung"],

  // ---------- Substantive: Sprache ----------
  "汉语": [N, "sprache"], "汉字": [N, "sprache"], "外语": [N, "sprache"],
  "语言": [N, "sprache"], "口语": [N, "sprache"], "语法": [N, "sprache"],

  // ---------- Substantive: Tiere (ZEW 只) ----------
  "熊猫": [N, "tier", "只"], "兔子": [N, "tier", "只"],
  "狗": [N, "tier", "只"], "动物": [N, "tier", "只"],

  // ---------- Substantive: Abstrakta (Auswahl, ohne ZEW) ----------
  "名字": [N, "abstrakt", "个"], "号码": [N, "abstrakt", "个"],
  "问题": [N, "abstrakt", "个"], "主意": [N, "abstrakt", "个"],
  "计划": [N, "abstrakt", "个"], "故事": [N, "abstrakt", "个"],
  "特点": [N, "abstrakt", "个"], "价格": [N, "abstrakt", "个"],
  "价钱": [N, "abstrakt", "个"], "工作": [N, "abstrakt"],
  "学习": [N, "abstrakt"], "颜色": [N, "abstrakt", "个"],
  "味道": [N, "abstrakt", "个"], "意思": [N, "abstrakt", "个"],
  "爱好": [N, "abstrakt", "个"], "希望": [N, "abstrakt", "个"],
  "文化": [N, "abstrakt"], "运动": [N, "abstrakt"],
  "职业": [N, "abstrakt", "个"], "国籍": [N, "abstrakt", "个"],
  "年龄": [N, "abstrakt"], "短信": [N, "abstrakt", "条"],
  "电子邮件": [N, "abstrakt"], "电视节目": [N, "abstrakt", "个"],
  "服务": [N, "abstrakt"], "健身": [N, "abstrakt"],
  "瑜伽": [N, "abstrakt"], "信息": [N, "abstrakt", "条"],
  "联系": [N, "abstrakt"], "菜名": [N, "abstrakt", "个"],
  "专业": [N, "abstrakt", "个"], "汽油": [N, "abstrakt"],
  "止疼药": [N, "gegenstand"], "现金": [N, "abstrakt"],
  "欧元": [N, "abstrakt"], "网站": [N, "abstrakt", "个"],

  // ---------- Verben ----------
  "吃": [V, "konsum"], "喝": [V, "konsum"], "尝": [V, "konsum"],
  "去": [V, "bewegung"], "走": [V, "bewegung"], "回": [V, "bewegung"],
  "跑": [V, "bewegung"], "骑": [V, "bewegung"], "坐": [V, "bewegung"],
  "出去": [V, "bewegung"], "进去": [V, "bewegung"], "进": [V, "bewegung"],
  "出来": [V, "bewegung"], "回来": [V, "bewegung"], "跑步": [V, "bewegung"],
  "想": [V, "modal"], "要": [V, "modal"], "会": [V, "modal"],
  "可以": [V, "modal"], "应该": [V, "modal"],
  "看": [V, "taetigkeit"], "买": [V, "taetigkeit"], "卖": [V, "taetigkeit"],
  "说": [V, "taetigkeit"], "写": [V, "taetigkeit"], "做": [V, "taetigkeit"],
  "打": [V, "taetigkeit"], "住": [V, "taetigkeit"], "用": [V, "taetigkeit"],
  "穿": [V, "taetigkeit"], "找": [V, "taetigkeit"], "等": [V, "taetigkeit"],
  "教": [V, "taetigkeit"], "给": [V, "taetigkeit"], "发": [V, "taetigkeit"],
  "收": [V, "taetigkeit"], "换": [V, "taetigkeit"], "让": [V, "taetigkeit"],
  "点": [V, "taetigkeit"], "听": [V, "taetigkeit"], "笑": [V, "taetigkeit"],
  "读": [V, "taetigkeit"], "问": [V, "taetigkeit"], "拿": [V, "taetigkeit"],
  "认识": [V, "taetigkeit"], "知道": [V, "taetigkeit"],
  "喜欢": [V, "taetigkeit"], "觉得": [V, "taetigkeit"],
  "希望": [V, "taetigkeit"], "介绍": [V, "taetigkeit"],
  "见面": [V, "taetigkeit"], "睡觉": [V, "taetigkeit"],
  "做饭": [V, "taetigkeit"], "唱歌": [V, "taetigkeit"],
  "跳舞": [V, "taetigkeit"], "购物": [V, "taetigkeit"],
  "逛街": [V, "taetigkeit"], "上网": [V, "taetigkeit"],
  "上课": [V, "taetigkeit"], "下课": [V, "taetigkeit"],
  "上班": [V, "taetigkeit"], "下班": [V, "taetigkeit"],
  "吃饭": [V, "taetigkeit"], "打工": [V, "taetigkeit"],
  "开会": [V, "taetigkeit"], "出差": [V, "taetigkeit"],
  "聊天": [V, "taetigkeit"], "休息": [V, "taetigkeit"],
  "旅游": [V, "taetigkeit"], "排队": [V, "taetigkeit"],
  "拍照": [V, "taetigkeit"], "打电话": [V, "taetigkeit"],
  "打球": [V, "taetigkeit"], "踢球": [V, "taetigkeit"],
  "骑车": [V, "taetigkeit"], "开车": [V, "taetigkeit"],
  "画画": [V, "taetigkeit"], "试试": [V, "taetigkeit"],
  "开始": [V, "taetigkeit"], "工作": [V, "taetigkeit"],
  "学习": [V, "taetigkeit"], "起床": [V, "taetigkeit"],
  "游泳衣": null,

  // ---------- Adjektive ----------
  "好": [A, "eigenschaft"], "漂亮": [A, "eigenschaft"],
  "帅": [A, "eigenschaft"], "美": [A, "eigenschaft"],
  "可爱": [A, "eigenschaft"], "棒": [A, "eigenschaft"],
  "酷": [A, "eigenschaft"], "高": [A, "eigenschaft"],
  "小": [A, "eigenschaft"], "年轻": [A, "eigenschaft"],
  "幽默": [A, "eigenschaft"], "客气": [A, "eigenschaft"],
  "贵": [A, "eigenschaft"], "便宜": [A, "eigenschaft"],
  "长": [A, "eigenschaft"], "短": [A, "eigenschaft"],
  "快": [A, "eigenschaft"], "慢": [A, "eigenschaft"],
  "好吃": [A, "eigenschaft"], "好看": [A, "eigenschaft"],
  "难看": [A, "eigenschaft"], "好喝": [A, "eigenschaft"],
  "难喝": [A, "eigenschaft"], "甜": [A, "eigenschaft"],
  "辣": [A, "eigenschaft"], "苦": [A, "eigenschaft"],
  "酸": [A, "eigenschaft"], "咸": [A, "eigenschaft"],
  "鲜": [A, "eigenschaft"], "深": [A, "eigenschaft"],
  "浅": [A, "eigenschaft"], "合适": [A, "eigenschaft"],
  "不错": [A, "eigenschaft"], "难": [A, "eigenschaft"],
  "难学": [A, "eigenschaft"], "远": [A, "eigenschaft"],
  "有名": [A, "eigenschaft"], "时髦": [A, "eigenschaft"],
  "胖": [A, "eigenschaft"], "瘦": [A, "eigenschaft"],
  "矮": [A, "eigenschaft"], "冷": [A, "eigenschaft"],
  "热": [A, "eigenschaft"], "周到": [A, "eigenschaft"],
  "随便": [A, "eigenschaft"], "清淡": [A, "eigenschaft"],
  "淡": [A, "eigenschaft"], "老": [A, "eigenschaft"],
  "高兴": [A, "zustand"], "快乐": [A, "zustand"],
  "开心": [A, "zustand"], "忙": [A, "zustand"],
  "饿": [A, "zustand"], "累": [A, "zustand"],
  "困": [A, "zustand"], "渴": [A, "zustand"],
  "口渴": [A, "zustand"], "对": [A, "zustand"],
  "满意": [A, "zustand"], "轻松": [A, "zustand"],

  // ---------- Pronomen mit Ortsfunktion ----------
  "这儿": ["Pronomen", null, null, true],
  "那儿": ["Pronomen", null, null, true],
};

// ---------------------------------------------------------------------------
const vocab = JSON.parse(readFileSync(VOCAB_PATH, "utf8"));

let touched = 0;
const stats = { subClass: 0, measureWord: 0, canBePlace: 0 };

for (const entry of vocab) {
  const def = MAP[entry.hanzi];
  if (!def) continue;
  const [wc, subClass, measureWord, canBePlace] = def;
  // wordClass-Filter: greift nur, wenn die Wortart übereinstimmt (so bekommt
  // z. B. 姓 als Verb nichts vom Substantiv-Eintrag ab).
  if (wc && entry.wordClass !== wc) continue;

  let changed = false;
  if (subClass && entry.subClass === undefined) {
    entry.subClass = subClass;
    stats.subClass++;
    changed = true;
  }
  if (measureWord && entry.measureWord === undefined) {
    entry.measureWord = measureWord;
    stats.measureWord++;
    changed = true;
  }
  if (canBePlace === true && entry.canBePlace === undefined) {
    entry.canBePlace = canBePlace;
    stats.canBePlace++;
    changed = true;
  }
  if (changed) touched++;
}

writeFileSync(VOCAB_PATH, JSON.stringify(vocab, null, 2) + "\n");
console.log(`Angereichert: ${touched} Einträge`, stats);
