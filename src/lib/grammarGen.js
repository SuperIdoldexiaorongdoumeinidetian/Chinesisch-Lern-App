// Grammatik-Übungsgenerator: baut zur Laufzeit aus Satz-Templates
// (grammar_templates.json), dem angereicherten Wortschatz (vocab.json) und den
// Verb-Objekt-Kollokationen (collocations.json) korrekte chinesische Sätze und
// daraus Übungen in allen Aufgabenformaten – rein clientseitig, ohne API.
//
// Grundprinzip Korrektheit: Der Generator kombiniert NICHT frei, sondern zieht
// nur aus kuratierten, semantisch geprüften Pools (Kollokationen, Ort↔Tätigkeit-
// Paare, Adjektiv↔Nomen-Zuordnungen). Lieber weniger Kombinationen als ein
// falscher Satz. Zeichen, Pinyin und deutsche Übersetzung werden aus den
// Wortdaten zusammengesetzt (inkl. Tonsandhi für 一 und 不 sowie deutscher
// Konjugation).
// Die Import-Attribute ("with type json") erlauben es, dieses Modul auch
// direkt in Node auszuführen (Testskript) – Vite/Rollup verstehen sie ebenso.
import vocab from "../data/vocab.json" with { type: "json" };
import collocations from "../data/collocations.json" with { type: "json" };
import templatesData from "../data/grammar_templates.json" with { type: "json" };
import topics from "../data/grammar.json" with { type: "json" };

// --------------------------------------------------------------------------
// Zufall: seedbarer Generator (mulberry32), damit Übungsdurchläufe
// reproduzierbar gemischt sind, aber jeder Aufruf frische Aufgaben liefert.
// --------------------------------------------------------------------------
export function makeRng(seed = Date.now() % 2147483647) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const shuffle = (rng, arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// --------------------------------------------------------------------------
// Pinyin: Nachschlag aus vocab.json + Tabelle für Funktionswörter.
// Die Tabelle gewinnt, weil sie die im Satz übliche Form enthält
// (z. B. 过 als Partikel „guo“ statt „guò“).
// --------------------------------------------------------------------------
const FUNC_PINYIN = {
  在: "zài", 去: "qù", 吗: "ma", 很: "hěn", 是: "shì", 有: "yǒu", 的: "de",
  了: "le", 这: "zhè", 那: "nà", 谁: "shéi", 什么: "shénme", 哪儿: "nǎr",
  人: "rén", 姓: "xìng", 叫: "jiào", 家: "jiā", 口: "kǒu", 岁: "suì",
  今年: "jīnnián", 现在: "xiànzài", 不: "bù", 没: "méi", 没有: "méiyǒu",
  太: "tài", 要: "yào", 想: "xiǎng", 会: "huì", 能: "néng", 可以: "kěyǐ",
  听说: "tīngshuō", 好吗: "hǎo ma", 我们: "wǒmen", 你: "nǐ", 我: "wǒ",
  比: "bǐ", 跟: "gēn", 一样: "yíyàng", 一起: "yìqǐ", 得: "de",
  得多: "de duō", 一点儿: "yìdiǎnr", 有点儿: "yǒudiǎnr", 最: "zuì",
  喜欢: "xǐhuan", 看看: "kànkan", 试试: "shìshi", 过: "guo",
  还是: "háishi", 又: "yòu", 一边: "yìbiān", 因为: "yīnwèi",
  所以: "suǒyǐ", 有的: "yǒude", 每: "měi", 个: "gè", 星期: "xīngqī",
  都: "dōu", 以后: "yǐhòu", 给: "gěi", 月: "yuè", 号: "hào",
  块: "kuài", 钱: "qián", 杯: "bēi", 两: "liǎng", 点: "diǎn",
  半: "bàn", 一刻: "yí kè", 分: "fēn", 一些: "yìxiē", 这些: "zhèxiē",
  些: "xiē", 本: "běn", 买: "mǎi", 看: "kàn", 吃: "chī", 喝: "hē",
  一: "yī", 便宜: "piányi", 好: "hǎo", 用: "yòng", 见面: "jiànmiàn",
  电影: "diànyǐng", 菜: "cài", 贵: "guì", 生日: "shēngrì",
  是不是: "shì bu shì", 有没有: "yǒu méiyǒu",
  // Zähleinheitswörter (in vocab.json teils nur als measureWord-Feld, nicht
  // als eigener Eintrag vorhanden)
  件: "jiàn", 条: "tiáo", 张: "zhāng", 辆: "liàng", 位: "wèi",
  双: "shuāng", 碗: "wǎn", 份: "fèn", 部: "bù", 朵: "duǒ",
};

const vocabPinyin = new Map();
for (const e of vocab) {
  // Kernlektionen bevorzugen (stabilere Pinyin-Schreibweise als Zusatzteile)
  const core = /^\d/.test(e.lesson);
  if (!vocabPinyin.has(e.hanzi) || core) {
    if (!vocabPinyin.has(e.hanzi) || !vocabPinyin.get(e.hanzi).core) {
      vocabPinyin.set(e.hanzi, { p: e.pinyin, core });
    }
  }
}
export function pinyinOf(hanzi) {
  if (FUNC_PINYIN[hanzi]) return FUNC_PINYIN[hanzi];
  const hit = vocabPinyin.get(hanzi);
  if (hit) return hit.p;
  return null; // Testskript prüft, dass das nie im Endergebnis landet
}
const W = (h, p) => ({ h, p: p ?? pinyinOf(h) ?? "?" });

// Ton einer Pinyin-Silbe (1–4, 0 = neutral) – für das Tonsandhi von 一/不.
function firstTone(p) {
  if (!p) return 0;
  const map = { "āēīōūǖ": 1, "áéíóúǘ": 2, "ǎěǐǒǔǚ": 3, "àèìòùǜ": 4 };
  for (const ch of p) for (const [chars, t] of Object.entries(map)) if (chars.includes(ch)) return t;
  return 0;
}
// 不 → bú vor 4. Ton; 一 → yí vor 4. Ton (und 个), sonst yì.
// Ausnahme: in Datumsangaben (一月, 一号) bleibt 一 als Zahl „yī“.
function applySandhi(tokens) {
  return tokens.map((t, i) => {
    const next = tokens[i + 1];
    if (!next) return t;
    if (t.h === "不" && (firstTone(next.p) === 4 || next.h === "是")) return { ...t, p: "bú" };
    if (t.h === "一" && next.h !== "月" && next.h !== "号") {
      return { ...t, p: firstTone(next.p) === 4 || next.h === "个" ? "yí" : "yì" };
    }
    return t;
  });
}

// --------------------------------------------------------------------------
// Deutsche Konjugation (Präsens) – reicht für die kuratierten Verben.
// --------------------------------------------------------------------------
const IRREGULAR = {
  sein: { "1s": "bin", "2s": "bist", "3s": "ist", "1p": "sind", "2p": "seid", "3p": "sind" },
  haben: { "1s": "habe", "2s": "hast", "3s": "hat", "1p": "haben", "2p": "habt", "3p": "haben" },
  essen: { "2s": "isst", "3s": "isst" },
  sehen: { "2s": "siehst", "3s": "sieht" },
  lesen: { "2s": "liest", "3s": "liest" },
  fahren: { "2s": "fährst", "3s": "fährt" },
  tragen: { "2s": "trägst", "3s": "trägt" },
  schlafen: { "2s": "schläfst", "3s": "schläft" },
  laufen: { "2s": "läufst", "3s": "läuft" },
  sprechen: { "2s": "sprichst", "3s": "spricht" },
  moechten: { "1s": "möchte", "2s": "möchtest", "3s": "möchte", "1p": "möchten", "2p": "möchtet", "3p": "möchten" },
  wollen: { "1s": "will", "2s": "willst", "3s": "will", "1p": "wollen", "2p": "wollt", "3p": "wollen" },
  koennen: { "1s": "kann", "2s": "kannst", "3s": "kann", "1p": "können", "2p": "könnt", "3p": "können" },
};
export function konjugiere(inf, person) {
  const irr = IRREGULAR[inf];
  if (irr?.[person]) return irr[person];
  if (inf === "moechten" || inf === "koennen") return IRREGULAR[inf]["3p"];
  const stem = inf.endsWith("en") ? inf.slice(0, -2) : inf.slice(0, -1);
  const e = /[td]$/.test(stem) || /[mn]$/.test(stem) && /[^aeiouhlr][mn]$/.test(stem) ? "e" : "";
  switch (person) {
    case "1s": return stem + "e";
    case "2s": return /[sßxz]$/.test(stem) ? stem + "t" : stem + e + "st";
    case "3s": return stem + e + "t";
    case "2p": return stem + e + "t";
    default: return inf; // 1p / 3p = Infinitiv
  }
}

// --------------------------------------------------------------------------
// Deutsches Nomen-Werkzeug: Artikel/Pronomen nach Genus deklinieren.
// --------------------------------------------------------------------------
const DEM_NOM = { m: "dieser", f: "diese", n: "dieses", pl: "diese" };
const DEM_AKK = { m: "diesen", f: "diese", n: "dieses", pl: "diese" };
const EIN_AKK = { m: "einen", f: "eine", n: "ein" };
const KEIN_AKK = { m: "keinen", f: "keine", n: "kein", pl: "keine" };
const POSS_STAMM = { "1s": "mein", "2s": "dein", "3sm": "sein", "3sf": "ihr" };
const POSS_END_NOM = { m: "", n: "", f: "e", pl: "e" };
const POSS_END_AKK = { m: "en", n: "", f: "e", pl: "e" };
const REL_AKK = { m: "den", f: "die", n: "das", pl: "die" };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Besitzer (Pronomen/Name) + Nomen als deutsche Possessivphrase.
function possPhrase(owner, noun, akk = false) {
  if (owner.name) return `${owner.name}s ${noun.de}`; // „Annas Handy“
  const key = owner.person === "3s" ? `3s${owner.genus}` : owner.person;
  const stamm = POSS_STAMM[key] ?? "mein";
  const end = (akk ? POSS_END_AKK : POSS_END_NOM)[noun.genus] ?? "";
  return `${stamm}${end} ${noun.de}`;
}

// --------------------------------------------------------------------------
// Kuratiertes Lexikon (nur Kurswörter; Pinyin kommt aus vocab.json).
// --------------------------------------------------------------------------
const PRONOUNS = [
  { h: "我", de: "ich", person: "1s", genus: "m", fam: "Meine" },
  { h: "你", de: "du", person: "2s", genus: "m", fam: "Deine" },
  { h: "他", de: "er", person: "3s", genus: "m", fam: "Seine" },
  { h: "她", de: "sie", person: "3s", genus: "f", fam: "Ihre" },
  { h: "我们", de: "wir", person: "1p" },
  { h: "你们", de: "ihr", person: "2p" },
  { h: "他们", de: "sie", person: "3p" },
];
const NAMES = [
  { h: "王大民", de: "Wang Damin", name: "Wang Damin", person: "3s", genus: "m" },
  { h: "李丽", de: "Li Li", name: "Li Li", person: "3s", genus: "f" },
  { h: "安娜", de: "Anna", name: "Anna", person: "3s", genus: "f" },
  { h: "马克", de: "Mark", name: "Mark", person: "3s", genus: "m" },
];
// 我 + Verwandtschaftswort (ohne 的 – bei nahestehenden Personen üblich)
// koch = darf in „X 做的菜“ vorkommen
const KIN = [
  { h: "妈妈", de: "meine Mama", genus: "f" },
  { h: "爸爸", de: "mein Papa", genus: "m" },
  { h: "哥哥", de: "mein älterer Bruder", genus: "m" },
  { h: "姐姐", de: "meine ältere Schwester", genus: "f" },
  { h: "弟弟", de: "mein jüngerer Bruder", genus: "m" },
  { h: "妹妹", de: "meine jüngere Schwester", genus: "f" },
  { h: "朋友", de: "mein Freund", genus: "m" },
];
const kinToken = (k) => ({ h: "我" + k.h, p: `wǒ ${pinyinOf(k.h)}` });

const TIMES = [
  { h: "今天", de: "heute", future: true },
  { h: "周末", de: "am Wochenende", future: true },
  { h: "后天", de: "übermorgen", future: true },
  { h: "星期六", de: "am Samstag", future: true },
  { h: "星期天", de: "am Sonntag", future: true },
  { h: "今天晚上", de: "heute Abend", future: true, p: () => `${pinyinOf("今天")} ${pinyinOf("晚上")}` },
  { h: "今天下午", de: "heute Nachmittag", future: true, p: () => `${pinyinOf("今天")} ${pinyinOf("下午")}` },
];
const timeToken = (t) => ({ h: t.h, p: t.p ? t.p() : pinyinOf(t.h) });

// Orte mit deutschen Wo-/Wohin-Formen. reise = Land/Stadt (für 去/过).
const PLACES = [
  { h: "图书馆", in: "in der Bibliothek", zu: "in die Bibliothek" },
  { h: "学校", in: "in der Schule", zu: "in die Schule" },
  { h: "咖啡馆", in: "im Café", zu: "ins Café" },
  { h: "酒吧", in: "in der Bar", zu: "in die Bar" },
  { h: "饭馆", in: "im Restaurant", zu: "ins Restaurant" },
  { h: "超市", in: "im Supermarkt", zu: "in den Supermarkt" },
  { h: "商场", in: "im Einkaufszentrum", zu: "ins Einkaufszentrum" },
  { h: "书店", in: "in der Buchhandlung", zu: "in die Buchhandlung" },
  { h: "电影院", in: "im Kino", zu: "ins Kino" },
  { h: "健身房", in: "im Fitnessstudio", zu: "ins Fitnessstudio" },
  { h: "公司", in: "in der Firma", zu: "in die Firma" },
  { h: "家", in: "zu Hause", zu: "nach Hause" },
  { h: "门口", in: "am Eingang", zu: "zum Eingang" },
  { h: "北京", in: "in Peking", zu: "nach Peking", reise: true },
  { h: "上海", in: "in Shanghai", zu: "nach Shanghai", reise: true },
  { h: "中国", in: "in China", zu: "nach China", reise: true },
  { h: "德国", in: "in Deutschland", zu: "nach Deutschland", reise: true },
  { h: "日本", in: "in Japan", zu: "nach Japan", reise: true },
  { h: "美国", in: "in den USA", zu: "in die USA", reise: true },
];
const placeByHanzi = Object.fromEntries(PLACES.map((p) => [p.h, p]));

// Tätigkeiten ohne Objekt (lexikalisierte Verben aus dem Kursvokabular)
const ACTS = {
  工作: { v: "arbeiten", obj: "", inf: "arbeiten" },
  学习: { v: "lernen", obj: "", inf: "lernen" },
  休息: { v: "machen", obj: "eine Pause", inf: "eine Pause machen" },
  睡觉: { v: "schlafen", obj: "", inf: "schlafen" },
  上网: { v: "surfen", obj: "im Internet", inf: "im Internet surfen" },
  做饭: { v: "kochen", obj: "", inf: "kochen" },
  吃饭: { v: "essen", obj: "", inf: "essen" },
  上课: { v: "haben", obj: "Unterricht", inf: "zum Unterricht gehen" },
  上班: { v: "arbeiten", obj: "", inf: "zur Arbeit gehen" },
  开会: { v: "haben", obj: "eine Besprechung", inf: "zur Besprechung kommen" },
  聊天: { v: "plaudern", obj: "", inf: "plaudern" },
  下课: { nach: "Nach dem Unterricht" },
  下班: { nach: "Nach der Arbeit" },
};

// Ort ↔ passende Tätigkeit (kuratiert, damit nie „im Supermarkt schlafen“
// o. Ä. entsteht). vo = Kollokation aus collocations.json, act = ACTS-Eintrag.
const ORT_ACT = [
  { ort: "图书馆", vos: ["看书", "学习汉语"], acts: ["学习"] },
  { ort: "咖啡馆", vos: ["喝咖啡", "喝茶", "看书"], acts: [] },
  { ort: "酒吧", vos: ["喝啤酒"], acts: [] },
  { ort: "饭馆", vos: ["吃饺子", "吃面条"], acts: ["吃饭"] },
  { ort: "超市", vos: ["买水果", "买面包"], acts: [] },
  { ort: "商场", vos: ["买衣服", "买鞋"], acts: [] },
  { ort: "书店", vos: ["买书", "买词典"], acts: [] },
  { ort: "家", vos: ["看书"], acts: ["休息", "睡觉", "做饭", "上网"] },
  { ort: "健身房", vos: ["做瑜伽", "做运动"], acts: [] },
  { ort: "学校", vos: ["学习汉语"], acts: ["上课"] },
  { ort: "公司", vos: [], acts: ["工作", "开会"] },
];
// Ziel-Variante für 去 + Ort + Tätigkeit (Serialverb wie 去饭馆吃饭)
const ORT_ACT_ZIEL = [
  { ort: "饭馆", vos: ["吃饺子", "吃面条"], acts: ["吃饭"] },
  { ort: "咖啡馆", vos: ["喝咖啡"], acts: [] },
  { ort: "电影院", vos: ["看电影"], acts: [] },
  { ort: "酒吧", vos: ["喝啤酒"], acts: [] },
];

const collocByKey = Object.fromEntries(collocations.map((c) => [c.verb + c.obj, c]));

// Adjektive: deutsche Formen + wofür sie passen (Kategorien der Nomen).
// neg = taugt für 太…了 / 有点儿 (unerwünschte Eigenschaft).
const ADJ = {
  高: { de: "groß", komp: "größer", fuer: ["person"] },
  忙: { de: "beschäftigt", fuer: ["person"], neg: true, zustand: true },
  累: { de: "müde", fuer: ["person"], neg: true, zustand: true },
  饿: { de: "hungrig", fuer: ["person"], neg: true, zustand: true },
  高兴: { de: "froh", fuer: ["person"], zustand: true },
  开心: { de: "fröhlich", fuer: ["person"], zustand: true },
  年轻: { de: "jung", komp: "jünger", fuer: ["person"] },
  幽默: { de: "humorvoll", fuer: ["person"] },
  漂亮: { de: "hübsch", fuer: ["person-f", "kleidung", "gegenstand"] },
  帅: { de: "gutaussehend", fuer: ["person-m"] },
  贵: { de: "teuer", komp: "teurer", sup: "am teuersten", fuer: ["kleidung", "gegenstand", "fahrzeug", "getraenk"], neg: true },
  便宜: { de: "günstig", komp: "günstiger", sup: "am günstigsten", fuer: ["kleidung", "gegenstand", "fahrzeug"] },
  好看: { de: "schön", komp: "schöner", sup: "am schönsten", fuer: ["kleidung", "gegenstand"] },
  好吃: { de: "lecker", sup: "am leckersten", fuer: ["essen"] },
  // 辣 nur für Gerichte (菜) – ein „scharfer Apfel/Kuchen“ ergäbe keinen Sinn
  辣: { de: "scharf", sup: "am schärfsten", fuer: ["gericht"], neg: true },
  甜: { de: "süß", sup: "am süßesten", fuer: ["essen"] },
  长: { de: "lang", komp: "länger", sup: "am längsten", fuer: ["lang"], neg: true },
  短: { de: "kurz", komp: "kürzer", sup: "am kürzesten", fuer: ["lang"], neg: true },
  小: { de: "klein", sup: "am kleinsten", fuer: ["kleidung"], neg: true },
  快: { de: "schnell", komp: "schneller", sup: "am schnellsten", fuer: ["fahrzeug"] },
};
const adjToken = (h) => W(h);
const adjsFuer = (cat) => Object.entries(ADJ).filter(([, a]) => a.fuer.includes(cat));

// Nomen für 这/那 + ZEW + Nomen und Zahl + ZEW + Nomen.
// zew MUSS mit measureWord in vocab.json übereinstimmen (Testskript prüft das).
const NOUNS = {
  衣服: { de: "Kleidungsstück", genus: "n", pl: "Kleidungsstücke", zew: "件", cat: "kleidung", kauf: true },
  毛衣: { de: "Pullover", genus: "m", pl: "Pullover", zew: "件", cat: "kleidung", kauf: true },
  衬衫: { de: "Hemd", genus: "n", pl: "Hemden", zew: "件", cat: "kleidung", kauf: true },
  外套: { de: "Jacke", genus: "f", pl: "Jacken", zew: "件", cat: "kleidung", kauf: true },
  裤子: { de: "Hose", genus: "f", pl: "Hosen", zew: "条", cat: "kleidung", lang: true, kauf: true },
  连衣裙: { de: "Kleid", genus: "n", pl: "Kleider", zew: "条", cat: "kleidung", lang: true, kauf: true },
  围巾: { de: "Schal", genus: "m", pl: "Schals", zew: "条", cat: "kleidung", lang: true, kauf: true },
  鞋: { de: "Schuhe", genus: "pl", pl: "Paar Schuhe", zew: "双", cat: "kleidung", kauf: true },
  书: { de: "Buch", genus: "n", pl: "Bücher", zew: "本", cat: "gegenstand", kauf: true },
  词典: { de: "Wörterbuch", genus: "n", pl: "Wörterbücher", zew: "本", cat: "gegenstand", kauf: true },
  手机: { de: "Handy", genus: "n", pl: "Handys", zew: "部", cat: "gegenstand", kauf: true },
  照片: { de: "Foto", genus: "n", pl: "Fotos", zew: "张", cat: "gegenstand" },
  地图: { de: "Landkarte", genus: "f", pl: "Landkarten", zew: "张", cat: "gegenstand", kauf: true },
  自行车: { de: "Fahrrad", genus: "n", pl: "Fahrräder", zew: "辆", cat: "fahrzeug", kauf: true },
  咖啡: { de: "Kaffee", genus: "m", pl: "Tassen Kaffee", zew: "杯", cat: "getraenk" },
  茶: { de: "Tee", genus: "m", pl: "Tassen Tee", zew: "杯", cat: "getraenk" },
  菜: { de: "Gericht", genus: "n", pl: "Gerichte", zew: "个", cat: "essen", gericht: true },
  苹果: { de: "Apfel", genus: "m", pl: "Äpfel", zew: "个", cat: "essen", kauf: true },
  蛋糕: { de: "Kuchen", genus: "m", pl: "Stücke Kuchen", zew: "块", cat: "essen", kauf: true },
  花: { de: "Blume", genus: "f", pl: "Blumen", zew: "朵", cat: "gegenstand", kauf: true },
  礼物: { de: "Geschenk", genus: "n", pl: "Geschenke", zew: "件", cat: "gegenstand", kauf: true },
  邮票: { de: "Briefmarke", genus: "f", pl: "Briefmarken", zew: "张", cat: "gegenstand", kauf: true },
};
const nounEntries = Object.entries(NOUNS).map(([h, n]) => ({ h, ...n }));

// Zahlwörter 1–99 als Zeichen + Pinyin (systematisch aus den Kursziffern).
const DIGITS = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
const DIGITS_P = ["líng", "yī", "èr", "sān", "sì", "wǔ", "liù", "qī", "bā", "jiǔ"];
export function numHanzi(n, liang = false) {
  if (n === 2 && liang) return { h: "两", p: "liǎng" };
  if (n <= 10) return n === 10 ? { h: "十", p: "shí" } : { h: DIGITS[n], p: DIGITS_P[n] };
  const z = Math.floor(n / 10), r = n % 10;
  let h = (z > 1 ? DIGITS[z] : "") + "十" + (r ? DIGITS[r] : "");
  let p = (z > 1 ? DIGITS_P[z] + " " : "") + "shí" + (r ? " " + DIGITS_P[r] : "");
  return { h, p };
}
const ZAHL_DE = ["null", "ein", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf"];
const MONATE = ["", "Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

// Ein-Sandhi für 一 + ZEW (一杯 yì bēi, 一件 yí jiàn, 一个 yí gè)
function yiVor(zewP) {
  const t = firstTone(zewP);
  return t === 4 || zewP === "gè" ? "yí" : "yì";
}
// Zahl + ZEW + Nomen als Ein-Token-Baustein („两本书“)
function numnpToken(n, noun) {
  const zewP = pinyinOf(noun.zew) ?? "?";
  const num = numHanzi(n, true);
  const numP = n === 1 ? yiVor(zewP) : num.p;
  return {
    h: `${n === 1 ? "一" : num.h}${noun.zew}${noun.h}`,
    p: `${numP} ${zewP} ${pinyinOf(noun.h)}`,
  };
}
function numnpDe(n, noun) {
  if (n === 1) {
    if (noun.genus === "pl") return `ein ${noun.pl.replace("Paar ", "Paar ")}`;
    return `${EIN_AKK[noun.genus]} ${noun.de}`;
  }
  return `${["", "", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn"][n]} ${noun.pl}`;
}
function demnpToken(dem, noun) {
  return {
    h: `${dem}${noun.zew}${noun.h}`,
    p: `${dem === "这" ? "zhè" : "nà"} ${pinyinOf(noun.zew)} ${pinyinOf(noun.h)}`,
  };
}

// Uhrzeit: Zeichen/Pinyin/Deutsch zusammen bauen. 两点 statt 二点!
function uhrzeitParts(rng, forceTwo = false) {
  const hour = forceTwo ? 2 : 1 + Math.floor(rng() * 12);
  const hh = hour === 2 ? { h: "两", p: "liǎng" } : numHanzi(hour);
  const variants = [
    { h: `${hh.h}点`, p: `${hh.p} diǎn`, de: `${ZAHL_DE[hour]} Uhr` },
    { h: `${hh.h}点半`, p: `${hh.p} diǎn bàn`, de: `halb ${ZAHL_DE[hour === 12 ? 1 : hour + 1]}` },
    { h: `${hh.h}点一刻`, p: `${hh.p} diǎn yí kè`, de: `Viertel nach ${ZAHL_DE[hour]}` },
    { h: `${hh.h}点二十分`, p: `${hh.p} diǎn èrshí fēn`, de: `${ZAHL_DE[hour]} Uhr zwanzig` },
  ];
  const v = pick(rng, variants);
  return { token: { h: v.h, p: v.p }, de: v.de };
}

// Verb + 得 + Adjektiv-Paare für Thema 33 (kuratiert)
const V_ADV = [
  { v: "跑", adj: "快", deV: "laufen", deKomp: "schneller" },
  { v: "走", adj: "慢", deV: "gehen", deKomp: "langsamer" },
  { v: "吃", adj: "快", deV: "essen", deKomp: "schneller" },
];
const V_ADV2 = [
  { v: "写", adj: "好", deV: "schreiben", deKomp: "besser" },
  { v: "说", adj: "好", deV: "sprechen", deKomp: "besser" },
];

// Berufe (deutsche Formen nach Genus/Numerus des Subjekts)
const BERUFE = [
  { h: "老师", m: "Lehrer", f: "Lehrerin", pl: "Lehrer" },
  { h: "医生", m: "Arzt", f: "Ärztin", pl: "Ärzte" },
  { h: "学生", m: "Student", f: "Studentin", pl: "Studenten" },
  { h: "大学生", m: "Student", f: "Studentin", pl: "Studenten" },
  { h: "记者", m: "Journalist", f: "Journalistin", pl: "Journalisten" },
  { h: "律师", m: "Anwalt", f: "Anwältin", pl: "Anwälte" },
  { h: "工程师", m: "Ingenieur", f: "Ingenieurin", pl: "Ingenieure" },
  { h: "护士", m: "Krankenpfleger", f: "Krankenschwester", pl: "Krankenpfleger" },
];
const LAENDER_PERSON = [
  { h: "中国", m: "Chinese", f: "Chinesin" },
  { h: "德国", m: "Deutscher", f: "Deutsche" },
  { h: "日本", m: "Japaner", f: "Japanerin" },
  { h: "美国", m: "Amerikaner", f: "Amerikanerin" },
  { h: "法国", m: "Franzose", f: "Französin" },
  { h: "英国", m: "Engländer", f: "Engländerin" },
];
const SURNAMES = [
  { h: "黄", de: "Huang" },
  { h: "孙", de: "Sun" },
];
// Gerichte für 过-Erfahrungssätze
const GERICHTE = [
  { h: "北京烤鸭", de: "Pekingente" },
  { h: "饺子", de: "Jiaozi" },
  { h: "火锅", de: "Hotpot" },
  { h: "麻婆豆腐", de: "Mapo-Tofu" },
];
const GETRAENKE_41 = [
  { h: "咖啡", de: "Kaffee" },
  { h: "茶", de: "Tee" },
];
const ACT_PAARE = [
  { a: "吃饭", b: "聊天", deA: { v: "essen", obj: "" }, deB: { v: "plaudern", obj: "" } },
  { a: "喝茶", b: "聊天", deA: { v: "trinken", obj: "Tee" }, deB: { v: "plaudern", obj: "" }, aTokens: ["喝", "茶"] },
];
const BEGLEITER = [
  { h: "朋友", dat: "Freunden" },
  { h: "同学", dat: "Mitschülern" },
  { h: "家人", dat: "der Familie" },
];
const ANRUF_ZIELE = [
  { h: "妈妈", genus: "f", de: "Mama" },
  { h: "爸爸", genus: "m", de: "Papa" },
  { h: "朋友", genus: "m", de: "Freund" },
];
const TREFF_ORTE = ["门口", "图书馆", "咖啡馆", "电影院"];
const MASS_NOUNS = [
  { h: "水果", phrase: "etwas Obst" },
  { h: "花", phrase: "ein paar Blumen" },
  { h: "东西", phrase: "ein paar Sachen" },
];
const PLURAL_NOUNS = ["花", "书", "照片", "衣服"];
const PERS_NOUN = [
  { h: "老师", m: "Lehrer", f: "Lehrerin" },
  { h: "朋友", m: "Freund", f: "Freundin" },
  { h: "同学", m: "Mitschüler", f: "Mitschülerin" },
];
const THINGS_MEIN = ["书", "手机", "词典", "自行车", "照片"];
const KAUF_ORT = { 书: "书店", 词典: "书店", 毛衣: "商场", 裤子: "商场", 衬衫: "商场", 连衣裙: "商场", 外套: "商场", 衣服: "商场", 手机: "商场", 蛋糕: "超市" };
const ADJ_PAARE_DING = [
  { a: "便宜", b: "好看", cats: ["kleidung", "gegenstand"] },
  { a: "便宜", b: "好吃", cats: ["essen"] },
  { a: "便宜", b: "快", cats: ["fahrzeug"] },
];
const ADJ_PAARE_PERSON = [
  { a: "高", b: "帅", genus: "m" },
  { a: "年轻", b: "幽默", genus: "m" },
  { a: "年轻", b: "漂亮", genus: "f" },
  { a: "漂亮", b: "幽默", genus: "f" },
];

// --------------------------------------------------------------------------
// Slot-Füller. Jeder Füller schreibt tokens (Zeichen+Pinyin) und deutsche
// Angaben in den Kontext. Spätere Slots dürfen frühere lesen (z. B. Adjektiv
// passend zum gewählten Nomen). de-Felder dürfen Funktionen sein, die beim
// Rendern mit dem fertigen Kontext aufgerufen werden.
// --------------------------------------------------------------------------
function subjFill(pool) {
  return (rng, ctx) => {
    const s = pick(rng, pool);
    if (s.kin) {
      ctx.person = "3s";
      ctx.subjGenus = s.genus;
      ctx.subj = { de: s.de, person: "3s", genus: s.genus };
      return { tokens: [kinToken(s)], de: { d: s.de, klein: s.de, nom: s.de } };
    }
    ctx.person = s.person;
    ctx.subjGenus = s.genus ?? "m";
    ctx.subj = s;
    return {
      tokens: [W(s.h)],
      de: {
        d: cap(s.de), klein: s.de, nom: s.de === "ich" ? "ich" : s.de,
        fam: s.fam ?? "Seine",
        seinV: () => konjugiere("sein", s.person),
      },
    };
  };
}
const kinPool = KIN.map((k) => ({ ...k, kin: true }));

const SLOTS = {
  subj: subjFill([...PRONOUNS, ...NAMES, ...kinPool]),
  subjSg: subjFill([...PRONOUNS.filter((p) => p.person.endsWith("s")), ...NAMES, ...kinPool]),
  subjPl: subjFill(PRONOUNS.filter((p) => p.person.endsWith("p"))),
  subjPronSg: subjFill(PRONOUNS.filter((p) => ["我", "你", "他", "她"].includes(p.h))),
  subjPronSg2: subjFill(PRONOUNS.filter((p) => ["你", "他", "她"].includes(p.h))),
  subjPron3: subjFill(PRONOUNS.filter((p) => ["他", "她"].includes(p.h))),
  subjDu: subjFill(PRONOUNS.filter((p) => p.h === "你")),
  subjPers: subjFill([...PRONOUNS.filter((p) => p.person.endsWith("s")), ...NAMES, ...kinPool]),
  kinSubj: (rng, ctx) => {
    const k = pick(rng, KIN.filter((x) => x.h !== "朋友"));
    ctx.person = "3s";
    ctx.subjGenus = k.genus;
    return { tokens: [kinToken(k)], de: { d: cap(k.de), klein: k.de } };
  },
  subjSame: (rng, ctx) => ({ tokens: ctx.subjTokens ?? [W("我")], de: { d: "" } }),

  time: (rng, ctx) => {
    const t = pick(rng, TIMES);
    ctx.timeIdx = null; // wird beim Zusammenbau gesetzt
    return { tokens: [timeToken(t)], de: { d: t.de }, meta: { isTime: true } };
  },
  timeFuture: (rng) => {
    const t = pick(rng, TIMES.filter((x) => x.future));
    return { tokens: [timeToken(t)], de: { d: t.de }, meta: { isTime: true } };
  },

  place: (rng) => {
    // 家 ausschließen: der Slot steht in den Templates immer nach 去, und
    // „nach Hause gehen“ heißt 回家, nie 去家.
    const p = pick(rng, PLACES.filter((x) => !x.reise && x.h !== "门口" && x.h !== "家"));
    return { tokens: [W(p.h)], de: { d: p.in, in: p.in, zu: p.zu }, meta: { isPlace: true } };
  },
  placeReise: (rng, ctx, key) => {
    const used = ctx.usedPlaces ?? (ctx.usedPlaces = new Set());
    const p = pick(rng, PLACES.filter((x) => x.reise && !used.has(x.h)));
    used.add(p.h);
    return { tokens: [W(p.h)], de: { d: p.zu, in: p.in, zu: p.zu }, meta: { isPlace: true } };
  },
  // Freizeit-Orte für „nach der Arbeit/dem Unterricht gehe ich …“ (Thema 47):
  // 公司/学校 wären dort widersinnig (man kommt ja gerade von dort).
  placeFreizeit: (rng) => {
    const p = pick(rng, PLACES.filter((x) => !x.reise && !["门口", "家", "公司", "学校"].includes(x.h)));
    return { tokens: [W(p.h)], de: { d: p.in, in: p.in, zu: p.zu }, meta: { isPlace: true } };
  },
  placeReiseA: (...a) => SLOTS.placeReise(...a),
  placeReiseB: (...a) => SLOTS.placeReise(...a),
  treffOrt: (rng) => {
    const p = placeByHanzi[pick(rng, TREFF_ORTE)];
    return { tokens: [W(p.h)], de: { d: p.in, in: p.in } };
  },
  kaufOrt: (rng, ctx) => {
    const ort = KAUF_ORT[ctx.nounH] ?? "商场";
    const p = placeByHanzi[ort];
    return { tokens: [W(p.h)], de: { d: p.in, in: p.in }, meta: { isPlace: true } };
  },

  // Kollokation Verb+Objekt (zwei Tokens, damit die Stellung geübt wird)
  vo: (rng, ctx) => voFill(rng, ctx, collocations),
  voKonsum: (rng, ctx) => voFill(rng, ctx, collocations.filter((c) => ["essen", "trinken"].includes(c.cat))),
  voMono: (rng, ctx) => voFill(rng, ctx, collocations.filter((c) => c.verb.length === 1)),
  voSkill: (rng, ctx) => {
    const skills = [
      collocByKey["说汉语"], collocByKey["写汉字"],
      { verb: "做饭", obj: "", de: { v: "kochen", obj: "" }, lexical: true },
      { verb: "唱歌", obj: "", de: { v: "singen", obj: "" }, lexical: true },
      { verb: "跳舞", obj: "", de: { v: "tanzen", obj: "" }, lexical: true },
      collocByKey["骑自行车"],
    ];
    return voFill(rng, ctx, skills.filter(Boolean));
  },
  voPairA: (rng, ctx) => {
    const verbs = ["喝", "吃"];
    const verb = pick(rng, verbs);
    const options = collocations.filter((c) => c.verb === verb);
    // Nur Paare mit gleichem deutschen Verb: 喝汤 heißt „Suppe ESSEN“ und
    // würde sonst mit „trinken“-Objekten gemischt („Isst du Suppe oder Milch?“)
    const pairable = options.filter((a) =>
      options.some((b) => b.obj !== a.obj && b.de.v === a.de.v)
    );
    const a = pick(rng, pairable);
    ctx.voPair = { verb, other: options.filter((c) => c.obj !== a.obj && c.de.v === a.de.v) };
    return voResult(a, ctx);
  },
  voPairB: (rng, ctx) => {
    const b = pick(rng, ctx.voPair.other);
    return voResult(b, ctx);
  },
  voNumKonsum: (rng, ctx) => {
    const options = [
      { c: collocByKey["喝咖啡"], noun: NOUNS["咖啡"], n: 1, deN: "eine Tasse Kaffee" },
      { c: collocByKey["喝茶"], noun: NOUNS["茶"], n: 1, deN: "eine Tasse Tee" },
      { c: collocByKey["吃苹果"], noun: NOUNS["苹果"], n: 1, deN: "einen Apfel" },
      { c: collocByKey["吃饺子"], noun: { ...NOUNS["菜"], h: "饺子", zew: "个" }, n: 3, deN: "drei Jiaozi" },
    ].filter((o) => o.c);
    const o = pick(rng, options);
    const np = numnpToken(o.n, { ...o.noun, h: o.c.obj });
    return {
      tokens: [W(o.c.verb), W("了"), np],
      de: { d: o.deN, deNum: o.deN, part: o.c.de.part },
      meta: { le: true },
    };
  },

  act: (rng, ctx) => {
    const h = pick(rng, ["工作", "学习", "睡觉", "聊天"]);
    return actResult(h, ctx);
  },
  actPflicht: (rng, ctx) => {
    const h = pick(rng, ["上课", "上班", "开会"]);
    const a = ACTS[h];
    return { tokens: [W(h)], de: { d: a.inf, inf: a.inf, v: () => konjugiere(a.v, ctx.person), obj: a.obj } };
  },
  actEreignis: (rng) => {
    const h = pick(rng, ["下课", "吃饭", "下班"]);
    const nach = h === "吃饭" ? "Nach dem Essen" : ACTS[h]?.nach ?? "Danach";
    return { tokens: [W(h)], de: { d: nach, nach } };
  },
  actPaarA: (rng, ctx) => {
    const paar = pick(rng, ACT_PAARE);
    ctx.actPaar = paar;
    const tokens = paar.aTokens ? paar.aTokens.map((t) => W(t)) : [W(paar.a)];
    return { tokens, de: { d: "", v: () => konjugiere(paar.deA.v, ctx.person), obj: paar.deA.obj } };
  },
  actPaarB: (rng, ctx) => {
    const paar = ctx.actPaar;
    return { tokens: [W(paar.b)], de: { d: "", v: () => konjugiere(paar.deB.v, ctx.person), obj: paar.deB.obj } };
  },

  adjPerson: (rng, ctx) => {
    const g = ctx.subjGenus ?? "m";
    const pool = Object.entries(ADJ).filter(([, a]) =>
      a.fuer.includes("person") || a.fuer.includes(`person-${g}`)
    );
    const [h, a] = pick(rng, pool);
    return { tokens: [adjToken(h)], de: { d: a.de }, meta: { isAdj: true } };
  },
  adjZustandNeg: (rng) => {
    const [h, a] = pick(rng, Object.entries(ADJ).filter(([, x]) => x.zustand && x.neg));
    return { tokens: [adjToken(h)], de: { d: a.de }, meta: { isAdj: true } };
  },
  adjThing: (rng, ctx) => {
    const cats = ctx.nounCats ?? ["gegenstand"];
    const pool = Object.entries(ADJ).filter(([, a]) => cats.some((c) => a.fuer.includes(c)));
    const [h, a] = pick(rng, pool);
    return { tokens: [adjToken(h)], de: { d: a.de, sup: a.sup ?? `am ${a.de}sten` }, meta: { isAdj: true } };
  },
  adjThingNeg: (rng, ctx) => {
    const cats = ctx.nounCats ?? ["kleidung"];
    const pool = Object.entries(ADJ).filter(([, a]) => a.neg && cats.some((c) => a.fuer.includes(c)));
    const [h, a] = pick(rng, pool.length ? pool : [["贵", ADJ["贵"]]]);
    return { tokens: [adjToken(h)], de: { d: a.de }, meta: { isAdj: true } };
  },
  adjVergleich: (rng, ctx) => {
    const cats = ctx.nounCats ?? ["kleidung"];
    const pool = Object.entries(ADJ).filter(([, a]) => a.komp && cats.some((c) => a.fuer.includes(c)));
    const [h, a] = pick(rng, pool.length ? pool : [["贵", ADJ["贵"]]]);
    return { tokens: [adjToken(h)], de: { d: a.de, komp: a.komp }, meta: { isAdj: true } };
  },
  adjPersVergleich: (rng) => {
    const [h, a] = pick(rng, [["高", ADJ["高"]], ["年轻", ADJ["年轻"]]]);
    return { tokens: [adjToken(h)], de: { d: a.de, komp: a.komp }, meta: { isAdj: true } };
  },
  adjPairA: (rng, ctx) => {
    const cats = ctx.nounCats ?? ["kleidung"];
    const paar = pick(rng, ADJ_PAARE_DING.filter((p) => p.cats.some((c) => cats.includes(c))));
    ctx.adjPaar = paar;
    return { tokens: [adjToken(paar.a)], de: { d: ADJ[paar.a].de } };
  },
  adjPairB: (rng, ctx) => ({ tokens: [adjToken(ctx.adjPaar.b)], de: { d: ADJ[ctx.adjPaar.b].de } }),
  persAdjPairA: (rng, ctx) => {
    const paar = pick(rng, ADJ_PAARE_PERSON.filter((p) => p.genus === (ctx.subjGenus ?? "m")));
    ctx.adjPaar = paar;
    return { tokens: [adjToken(paar.a)], de: { d: ADJ[paar.a].de } };
  },
  persAdjPairB: (rng, ctx) => ({ tokens: [adjToken(ctx.adjPaar.b)], de: { d: ADJ[ctx.adjPaar.b].de } }),

  demnp: (rng, ctx) => demnpFill(rng, ctx, nounEntries.filter((n) => n.cat !== "getraenk")),
  demnpKauf: (rng, ctx) => demnpFill(rng, ctx, nounEntries.filter((n) => n.kauf)),
  demnpKleidung: (rng, ctx) => demnpFill(rng, ctx, nounEntries.filter((n) => n.cat === "kleidung" && n.h !== "鞋")),
  demnpGastro: (rng) => {
    const ort = pick(rng, [
      { h: "饭馆", de: "Restaurant" },
      { h: "餐厅", de: "Restaurant" },
    ]);
    // 这/那 variieren, damit mehr als zwei verschiedene Sätze entstehen
    const dem = pick(rng, [
      { h: "这", p: "zhè", de: "in diesem" },
      { h: "那", p: "nà", de: "in jenem" },
    ]);
    const de = `${dem.de} ${ort.de}`;
    return { tokens: [{ h: `${dem.h}家${ort.h}`, p: `${dem.p} jiā ${pinyinOf(ort.h)}` }], de: { d: de, inDem: de } };
  },
  demnpPair: (rng, ctx) => {
    const noun = pick(rng, nounEntries.filter((n) => n.komp !== false && n.genus !== "pl" && ["kleidung", "gegenstand", "fahrzeug"].includes(n.cat)));
    ctx.pairNoun = noun;
    ctx.nounCats = nounCatsOf(noun);
    ctx.nounH = noun.h;
    return { tokens: [demnpToken("这", noun)], de: { d: `${DEM_NOM[noun.genus]} ${noun.de}` } };
  },
  demnpPairB: (rng, ctx) => {
    const noun = ctx.pairNoun;
    return { tokens: [demnpToken("那", noun)], de: { d: `${noun.genus === "pl" ? "jene" : { m: "jener", f: "jene", n: "jenes" }[noun.genus]} ${noun.de}` } };
  },

  numnp: (rng, ctx) => numnpFill(rng, ctx, nounEntries.filter((n) => n.pl && n.cat !== "essen"), [1, 2, 3, 4, 5]),
  numnpKauf: (rng, ctx) => numnpFill(rng, ctx, nounEntries.filter((n) => n.kauf), [1, 2, 3]),
  numnpLiang: (rng, ctx) => numnpFill(rng, ctx, nounEntries.filter((n) => n.pl && n.cat !== "essen"), [2]),

  numAge: (rng, ctx) => {
    const n = 18 + Math.floor(rng() * 13); // 18–30
    ctx.age = n;
    const num = numHanzi(n);
    return { tokens: [{ h: num.h, p: num.p }], de: { d: String(n) } };
  },
  numFam: (rng) => {
    const n = 3 + Math.floor(rng() * 4); // 3–6
    const num = numHanzi(n);
    return { tokens: [num], de: { d: String(n) } };
  },
  numMonat: (rng, ctx) => {
    const n = 1 + Math.floor(rng() * 12);
    ctx.monat = n;
    const num = numHanzi(n);
    return { tokens: [num], de: { d: String(n), monat: MONATE[n] } };
  },
  numTag: (rng) => {
    const n = 1 + Math.floor(rng() * 28);
    const num = numHanzi(n);
    return { tokens: [num], de: { d: String(n), zahl: String(n) } };
  },
  numPreis: (rng) => {
    const n = pick(rng, [10, 15, 20, 25, 30, 40, 50, 60, 80]);
    const num = numHanzi(n);
    return { tokens: [num], de: { d: String(n), zahl: String(n) } };
  },
  numPreisKlein: (rng) => {
    const n = pick(rng, [5, 8, 10, 12, 15]);
    const num = numHanzi(n);
    return { tokens: [num], de: { d: String(n), zahl: String(n) } };
  },

  uhrzeit: (rng) => {
    const u = uhrzeitParts(rng);
    return { tokens: [u.token], de: { d: u.de } };
  },
  uhrzeitLiang: (rng) => {
    const u = uhrzeitParts(rng, true);
    return { tokens: [u.token], de: { d: u.de } };
  },

  beruf: (rng, ctx) => {
    const b = pick(rng, BERUFE);
    const form = () => {
      if (ctx.person?.endsWith("p")) return b.pl;
      return (ctx.subjGenus === "f" ? b.f : b.m);
    };
    return { tokens: [W(b.h)], de: { d: form, pl: b.pl } };
  },
  land: (rng, ctx) => {
    const l = pick(rng, LAENDER_PERSON);
    return { tokens: [W(l.h)], de: { d: l.m, person: () => (ctx.subjGenus === "f" ? l.f : l.m) } };
  },
  surname: (rng) => {
    const s = pick(rng, SURNAMES);
    return { tokens: [W(s.h)], de: { d: s.de } };
  },
  fullname: (rng) => {
    const n = pick(rng, NAMES);
    return { tokens: [W(n.h)], de: { d: n.de } };
  },
  persNoun: (rng, ctx) => {
    const p = pick(rng, PERS_NOUN);
    return { tokens: [W(p.h)], de: { d: () => (ctx.subjGenus === "f" ? p.f : p.m) } };
  },
  gericht: (rng) => {
    const g = pick(rng, GERICHTE);
    return { tokens: [W(g.h)], de: { d: g.de } };
  },
  getraenk: (rng) => {
    const g = pick(rng, GETRAENKE_41);
    return { tokens: [W(g.h)], de: { d: g.de } };
  },
  massNoun: (rng) => {
    const m = pick(rng, MASS_NOUNS);
    return { tokens: [W(m.h)], de: { d: m.phrase, phrase: m.phrase } };
  },
  pluralNoun: (rng, ctx) => {
    const h = pick(rng, PLURAL_NOUNS);
    const noun = NOUNS[h] ?? { de: "Sachen", genus: "pl", pl: "Sachen", cat: "gegenstand" };
    ctx.nounCats = nounCatsOf(noun);
    return { tokens: [W(h)], de: { d: noun.pl, pl: noun.pl } };
  },

  // Besitzer für X 的 Y (Pronomen Singular oder Name)
  poss: possFill(),
  poss2: possFill(["你", "他", "她"]),
  possPron: possFill(["我"]),
  possSolo: (rng, ctx) => {
    const p = pick(rng, PRONOUNS.filter((x) => ["我", "你", "他", "她"].includes(x.h)));
    const dat = { 我: "mir", 你: "dir", 他: "ihm", 她: "ihr" }[p.h];
    return { tokens: [W(p.h)], de: { d: dat, dat } };
  },
  possThing: (rng, ctx) => {
    const noun = pick(rng, ["手机", "自行车", "词典"].map((h) => ({ h, ...NOUNS[h] })));
    ctx.pairNoun = noun;
    return {
      tokens: [{ h: `我的${noun.h}`, p: `wǒ de ${pinyinOf(noun.h)}` }],
      de: { d: possPhrase({ person: "1s" }, noun) },
    };
  },
  possThingB: (rng, ctx) => {
    const noun = ctx.pairNoun;
    const phrase = possPhrase({ person: "2s" }, noun);
    return {
      tokens: [{ h: `你的${noun.h}`, p: `nǐ de ${pinyinOf(noun.h)}` }],
      de: { d: cap(phrase), klein: phrase },
    };
  },
  thing: (rng, ctx) => {
    const h = pick(rng, THINGS_MEIN);
    const noun = { h, ...NOUNS[h] };
    ctx.nounH = h;
    ctx.nounCats = nounCatsOf(noun);
    ctx.lastNoun = noun;
    return {
      tokens: [W(h)],
      de: {
        d: noun.de,
        kein: `${KEIN_AKK[noun.genus]} ${noun.de}`,
        einen: noun.genus === "pl" ? noun.de : `${EIN_AKK[noun.genus]} ${noun.de}`,
        deinAkk: `dein${POSS_END_AKK[noun.genus] ?? ""} ${noun.de}`,
      },
    };
  },
  thing37: (rng, ctx) => {
    const options = [
      { h: "照片", akk: "deine Fotos" },
      { h: "书", akk: "dein Buch" },
      { h: "手机", akk: "dein Handy" },
    ];
    const o = pick(rng, options);
    return { tokens: [W(o.h)], de: { d: o.akk, deinAkk: o.akk } };
  },
  kaufThing: (rng, ctx) => {
    const options = [
      { h: "书", rel: "das Buch, das ich gekauft habe" },
      { h: "毛衣", rel: "der Pullover, den ich gekauft habe" },
      { h: "裤子", rel: "die Hose, die ich gekauft habe" },
      { h: "手机", rel: "das Handy, das ich gekauft habe" },
    ];
    const o = pick(rng, options);
    return { tokens: [W(o.h)], de: { d: o.rel, relSatz: o.rel } };
  },
  kinPron: (rng, ctx) => {
    const k = pick(rng, KIN.filter((x) => ["妈妈", "爸爸", "哥哥", "姐姐"].includes(x.h)));
    return { tokens: [kinToken(k)], de: { d: k.de, klein: k.de } };
  },
  // „Etwas billiger/größer …, okay?“ – Wunsch beim Einkaufen (Thema 46)
  adjWunsch: (rng) => {
    const o = pick(rng, [
      { h: "便宜", komp: "billiger" },
      { h: "小", komp: "kleiner" },
      { h: "快", komp: "schneller" },
      { h: "慢", komp: "langsamer" },
    ]);
    return { tokens: [W(o.h)], de: { d: o.komp, komp: o.komp } };
  },

  persA: (rng, ctx) => {
    const k = pick(rng, KIN.filter((x) => ["哥哥", "姐姐", "弟弟", "妹妹"].includes(x.h)));
    ctx.persA = k;
    return { tokens: [kinToken(k)], de: { d: cap(k.de), klein: k.de } };
  },
  persB: (rng, ctx) => ({ tokens: [W("我")], de: { d: "ich", nom: "ich" } }),

  vAdv: (rng, ctx) => {
    const v = pick(rng, V_ADV);
    ctx.vAdv = v;
    return { tokens: [W(v.v)], de: { d: v.deV, v: () => konjugiere(v.deV, "3s") } };
  },
  advAdj: (rng, ctx) => ({ tokens: [adjToken(ctx.vAdv.adj)], de: { d: ADJ[ctx.vAdv.adj]?.de ?? "", komp: ctx.vAdv.deKomp } }),
  vAdv2: (rng, ctx) => {
    const v = pick(rng, V_ADV2);
    ctx.vAdv = v;
    return { tokens: [W(v.v)], de: { d: v.deV, v: () => konjugiere(v.deV, "3s") } };
  },
  advAdj2: (rng, ctx) => SLOTS.advAdj(rng, ctx),

  ortAct: (rng, ctx) => ortActFill(rng, ctx, ORT_ACT, false),
  ortActZiel: (rng, ctx) => ortActFill(rng, ctx, ORT_ACT_ZIEL, true),

  begleiter: (rng) => {
    const b = pick(rng, BEGLEITER);
    return { tokens: [W(b.h)], de: { d: b.dat, dat: b.dat } };
  },
  anrufZiel: (rng, ctx) => {
    const z = pick(rng, ANRUF_ZIELE);
    const dat = () => {
      const key = ctx.person === "3s" ? `3s${ctx.subjGenus}` : ctx.person;
      const stamm = POSS_STAMM[key] ?? "mein";
      return `${stamm}${z.genus === "f" ? "er" : "em"} ${z.de}`;
    };
    return { tokens: [W(z.h)], de: { d: dat, dat } };
  },
};

function possFill(allowed) {
  return (rng, ctx) => {
    let pool = [...PRONOUNS.filter((p) => ["我", "你", "他", "她"].includes(p.h)), ...NAMES];
    if (allowed) pool = pool.filter((p) => allowed.includes(p.h));
    const o = pick(rng, pool);
    ctx.possOwner = o;
    const dNom = () => possPhraseOwnerOnly(o, ctx, false);
    const dAkk = () => possPhraseOwnerOnly(o, ctx, true);
    return {
      tokens: [W(o.h)],
      de: {
        d: dNom, dNom,
        dNomM: () => cap(o.name ? `${o.name}s` : POSS_STAMM[o.person === "3s" ? `3s${o.genus}` : o.person] ?? "mein"),
        dAkk,
        klein: o.de,
      },
    };
  };
}
// Possessiv-Bestimmer passend zum zuletzt gewählten Nomen
function possPhraseOwnerOnly(owner, ctx, akk) {
  const noun = ctx.lastNoun;
  if (!noun) return owner.name ? `${owner.name}s` : "mein";
  if (owner.name) return `${owner.name}s`;
  const key = owner.person === "3s" ? `3s${owner.genus}` : owner.person;
  const stamm = POSS_STAMM[key] ?? "mein";
  const end = (akk ? POSS_END_AKK : POSS_END_NOM)[noun.genus] ?? "";
  return `${stamm}${end}`;
}

function nounCatsOf(noun) {
  const cats = [noun.cat];
  if (noun.lang) cats.push("lang");
  if (noun.gericht) cats.push("gericht");
  return cats;
}

// 这/那 + ZEW + Nomen als Slot-Füllung (setzt Nomen-Kontext für Folge-Slots).
// Plural-Nomen (鞋) sind ausgenommen: die de-Muster der Templates verwenden
// durchgehend „ist“, und „Diese Schuhe ist …“ wäre falsches Deutsch.
function demnpFill(rng, ctx, pool) {
  const noun = pick(rng, pool.filter((n) => n.genus !== "pl"));
  ctx.nounH = noun.h;
  ctx.nounCats = nounCatsOf(noun);
  ctx.lastNoun = noun;
  const dem = pick(rng, ["这", "那"]);
  const nom = `${DEM_NOM[noun.genus]} ${noun.de}`;
  return {
    tokens: [demnpToken(dem, noun)],
    de: {
      d: nom,
      akk: `${DEM_AKK[noun.genus]} ${noun.de}`,
      pron: { m: "ihn", f: "sie", n: "es", pl: "sie" }[noun.genus],
    },
    meta: { zew: noun.zew },
  };
}
// Zahl + ZEW + Nomen als Slot-Füllung
function numnpFill(rng, ctx, pool, counts) {
  const noun = pick(rng, pool);
  const n = pick(rng, counts);
  ctx.nounH = noun.h;
  ctx.nounCats = nounCatsOf(noun);
  ctx.lastNoun = noun;
  return {
    tokens: [numnpToken(n, noun)],
    de: { d: numnpDe(n, noun) },
    meta: { zew: noun.zew, n },
  };
}

function voResult(c, ctx) {
  const tokens = c.lexical ? [W(c.verb)] : [W(c.verb), W(c.obj)];
  ctx.voVerb = c.verb;
  return {
    tokens,
    de: {
      d: c.de.obj,
      v: () => konjugiere(c.de.v, ctx.person ?? "1s"),
      vPl: c.de.v,
      v1pl: c.de.v, // „wir trinken“ – Plural = Infinitiv
      v3pl: c.de.v, // „manche trinken“
      duV: konjugiere(c.de.v, "2s"), // „trinkst (du)“ für Fragen mit festem 你
      obj: c.de.obj,
      objNach: c.de.obj,
      inf: c.de.v === "moechten" ? c.de.v : c.de.v,
      part: c.de.part ?? "",
    },
    meta: { isVo: true, verb: c.verb, obj: c.obj },
  };
}
function voFill(rng, ctx, pool) {
  const c = pick(rng, pool);
  return voResult(c, ctx);
}
function actResult(h, ctx) {
  const a = ACTS[h];
  return {
    tokens: [W(h)],
    de: { d: "", v: () => konjugiere(a.v, ctx.person ?? "1s"), obj: a.obj, inf: a.inf },
    meta: { isVo: true, verb: h, obj: "" },
  };
}
function ortActFill(rng, ctx, table, ziel) {
  const entry = pick(rng, table);
  const place = placeByHanzi[entry.ort];
  const choices = [
    ...entry.vos.map((k) => ({ vo: collocByKey[k] })).filter((x) => x.vo),
    ...entry.acts.map((h) => ({ act: h })),
  ];
  const c = pick(rng, choices);
  let tunTokens, deV, deObj, deInf;
  if (c.vo) {
    tunTokens = [W(c.vo.verb), W(c.vo.obj)];
    deV = () => konjugiere(c.vo.de.v, ctx.person ?? "1s");
    deObj = c.vo.de.obj;
    deInf = `${c.vo.de.obj ? c.vo.de.obj + " " : ""}${c.vo.de.v === "sehen" ? "sehen" : c.vo.de.v}`.trim();
  } else {
    const a = ACTS[c.act];
    tunTokens = [W(c.act)];
    deV = () => konjugiere(a.v, ctx.person ?? "1s");
    deObj = a.obj;
    deInf = a.inf;
  }
  const dort = () => `${typeof deV === "function" ? deV() : deV} dort${deObj ? " " + deObj : ""}`;
  return {
    tokens: [W(entry.ort), ...tunTokens],
    de: {
      d: place.in, in: place.in, zu: place.zu,
      v: deV, obj: deObj, inf: deInf,
      dortInf: `${deInf.includes(" ") ? deInf : deInf} dort`.replace(" dort", "") + "", // s. unten
      dort,
    },
    meta: { isOrtAct: true, ortLen: 1 },
  };
}

// --------------------------------------------------------------------------
// Satz aus Template bauen.
// --------------------------------------------------------------------------
const PERSON_BY_META = { ich: "1s", du: "2s", wir: "1p" };

export function generateSentence(template, topicCfg, rng) {
  const ctx = { slots: {} };
  if (template.subjekt) {
    ctx.person = PERSON_BY_META[template.subjekt] ?? "1s";
    ctx.subjGenus = "m";
  }
  const tokens = [];
  const slotOfToken = []; // parallele Liste: welcher Slot (Name) ein Token erzeugt hat
  for (const part of template.pattern) {
    if (SLOTS[part]) {
      const fill = SLOTS[part](rng, ctx, part);
      ctx.slots[part] = fill;
      if (part.startsWith("subj")) ctx.subjTokens = fill.tokens;
      for (const t of fill.tokens) {
        tokens.push(t);
        slotOfToken.push(part);
      }
    } else {
      // Literal (auch Satzzeichen „，“)
      tokens.push(part === "，" ? { h: "，", p: "，", punct: true } : W(part));
      slotOfToken.push(null);
    }
  }

  const withSandhi = applySandhi(tokens);
  const isQuestion = !!template.frage || tokens.some((t) => ["吗", "好吗", "谁", "什么", "哪儿", "几", "多少", "什么时候", "还是"].includes(t.h));
  const hanzi = withSandhi.map((t) => t.h).join("") + (isQuestion ? "？" : "。");
  const pinyin = cap(withSandhi.filter((t) => !t.punct).map((t) => t.p).join(" ")
    .replace(/ ，/g, ",")) + (isQuestion ? "?" : ".");

  // Falls das de-Muster selbst schon mit Satzzeichen endet („…, okay?“),
  // dieses erst entfernen – sonst stünde am Ende „okay??“.
  const deutsch =
    renderDe(template.de, ctx).replace(/[.?!]+$/, "") +
    (isQuestion && template.frage !== false && (template.frage || hanzi.endsWith("？")) ? "?" : ".");

  // Alternative gültige Reihenfolgen (z. B. Zeitangabe vor dem Subjekt)
  const altOrders = [];
  if (template.alt?.includes("timeFirst")) {
    const ti = slotOfToken.findIndex((s) => s === "time" || s === "timeFuture");
    if (ti > 0) {
      const reordered = [...withSandhi];
      const [t] = reordered.splice(ti, 1);
      reordered.unshift(t);
      altOrders.push(reordered);
    }
  }

  return {
    template, topicCfg, tokens: withSandhi, slotOfToken,
    hanzi, pinyin, deutsch, isQuestion, altOrders, ctx,
  };
}

// Deutsche Übersetzung aus dem de-Muster des Templates rendern.
function renderDe(pattern, ctx) {
  if (!pattern) return "";
  let out = pattern.replace(/\{([^}]+)\}/g, (_, expr) => {
    // {:verb} → nur das konjugierte Verb (fürs deutsche Satzmuster,
    // z. B. „Weil du müde {:sein}“ → „bist“)
    if (expr.startsWith(":")) return konjugiere(expr.slice(1), ctx.person ?? "1s");
    // {subj:verb} → Subjekt + konjugiertes Verb
    if (expr.includes(":")) {
      const [slotName, verb] = expr.split(":");
      const slot = findSlot(ctx, slotName) ?? { de: { klein: deSubjektFallback(ctx) } };
      const subjDe = resolveDe(slot, "klein", ctx) || deSubjektFallback(ctx);
      return `${subjDe} ${konjugiere(verb, ctx.person ?? "1s")}`;
    }
    const [slotName, field] = expr.split(".");
    const slot = findSlot(ctx, slotName);
    if (!slot) return deSubjektFallback(ctx, expr);
    return resolveDe(slot, field ?? "d", ctx);
  });
  out = out.replace(/\s+/g, " ").trim();
  return cap(out);
}
// Slot nachschlagen; „subj“ matcht auch die Varianten (subjSg, subjPronSg, …),
// damit die de-Muster einheitlich {subj.…} schreiben können.
function findSlot(ctx, slotName) {
  if (ctx.slots[slotName]) return ctx.slots[slotName];
  if (slotName === "subj") {
    const key = Object.keys(ctx.slots).find((k) => k.startsWith("subj"));
    if (key) return ctx.slots[key];
  }
  return null;
}
function resolveDe(slot, field, ctx) {
  const v = slot.de?.[field] ?? slot.de?.d ?? "";
  return typeof v === "function" ? v(ctx) : v;
}
function deSubjektFallback(ctx, expr) {
  if (!expr || expr.startsWith("subj")) {
    return { "1s": "ich", "2s": "du", "1p": "wir", "2p": "ihr", "3p": "sie" }[ctx.person] ?? "er";
  }
  return "";
}

// --------------------------------------------------------------------------
// Aufgaben-Generatoren: bauen aus einem generierten Satz je ein Übungsobjekt
// im Schema, das GrammarExercise.jsx rendert (plus Felder `optionen` für
// Auswahl-Lücken und `alternativen` für weitere gültige Wortstellungen).
// --------------------------------------------------------------------------
const topicMeta = Object.fromEntries(topics.map((t) => [t.id, t]));
let idCounter = 0;

function baseExercise(sentence, format, punkte) {
  const t = topicMeta[sentence.topicCfg.topicId];
  return {
    id: `gen-${sentence.template.id}-${format}-${++idCounter}`,
    topicId: sentence.topicCfg.topicId,
    lektion: t.lektion,
    format,
    punkte,
    erklaerung: `Thema ${t.id} „${t.titel}“ – Struktur: ${t.struktur}.`,
    hinweis: sentence.topicCfg.hinweis,
    pinyin: sentence.pinyin,
    deutsch: sentence.deutsch,
  };
}
const stripPunct = (h) => h.replace(/[。？]/g, "");

// --- Schüttelsatz ---------------------------------------------------------
export function genReihenfolge(sentence, rng) {
  const parts = sentence.tokens.filter((t) => !t.punct);
  // Ab 3 Bausteinen sinnvoll (你/很/高); Sätze mit Komma lassen sich nicht
  // schütteln – solche Themen setzen "reihenfolge": false in der Konfiguration.
  if (parts.length < 3 || sentence.tokens.some((t) => t.punct)) return null;
  const loesung = stripPunct(sentence.hanzi);
  const alternativen = sentence.altOrders.map((o) => o.map((t) => t.h).join(""));
  return {
    ...baseExercise(sentence, "reihenfolge", 2),
    frage: "Bringe die Wörter in die richtige Reihenfolge.",
    tokens: shuffle(rng, parts.map((t) => t.h)),
    loesung,
    alternativen,
  };
}

// --- Lückentext -----------------------------------------------------------
export function genLueckentext(sentence, rng) {
  const cfg = sentence.topicCfg.luecke;
  if (!cfg?.length) return null;
  const spec = pick(rng, cfg);
  let ziel = spec.ziel;
  let distraktoren = spec.distraktoren;

  // Manche Lücken (谁, 什么, 有没有 …) kommen nur in der FRAGE-Form vor:
  // dann erst den Satz per Frage-/Umformungsregel in die Frage verwandeln
  // und die Lücke dort reißen. Pinyin/Deutsch beziehen sich sonst auf den
  // Aussagesatz und würden nicht mehr passen – daher weglassen.
  let basisHanzi = sentence.hanzi;
  let extra = {};
  if (spec.frage) {
    basisHanzi = FRAGEN[spec.frage]?.(sentence);
    if (!basisHanzi) return null;
    extra = { pinyin: undefined, deutsch: undefined };
  } else if (spec.umformung) {
    const b = UMFORMUNGEN[spec.umformung]?.build(sentence);
    if (!b) return null;
    basisHanzi = b.loesung;
    extra = { pinyin: undefined, deutsch: undefined };
  }

  if (ziel === "zew") {
    // ZEW-Lücke: das Zähleinheitswort aus dem Zahl/这-Nomen-Baustein.
    // ZEW = erstes Zeichen nach der Zahl bzw. 这/那.
    const npToken = sentence.tokens.find((t) => /^[一二三四五六七八九十两这那]/.test(t.h) && t.h.length >= 3);
    if (!npToken) return null;
    ziel = npToken.h.replace(/^(这|那|[一二三四五六七八九十两]+)/, "")[0];
    // 个 nicht als Distraktor anbieten – es ist bei manchen Nomen halbwegs
    // akzeptabel und wäre damit keine eindeutig falsche Option.
    const pool = ["本", "杯", "件", "条", "张", "辆", "口", "位", "双", "碗", "份", "部"].filter((z) => z !== ziel);
    distraktoren = shuffle(rng, pool).slice(0, 3);
  }
  if (!ziel || !basisHanzi.includes(ziel)) return null;

  const satz = basisHanzi.replace(ziel, "___");
  return {
    ...baseExercise(sentence, "lueckentext", 1),
    frage: "Ergänze das grammatisch passende Wort.",
    satz,
    loesungen: [ziel],
    optionen: [shuffle(rng, [ziel, ...distraktoren])],
    loesung: basisHanzi,
    ...extra,
  };
}

// --- Wort einsetzen -------------------------------------------------------
export function genWortEinsetzen(sentence, rng) {
  const cfg = sentence.topicCfg.einsetzen;
  if (!cfg?.length) return null;
  const spec = pick(rng, cfg);
  // Slot-basiert („time“) oder Literal („在“, „都“ …)
  let idx = -1;
  if (SLOTS[spec]) idx = sentence.slotOfToken.findIndex((s) => s === spec);
  else idx = sentence.tokens.findIndex((t) => t.h === spec);
  if (idx < 0) return null;
  const wort = sentence.tokens[idx].h;
  // Satzzeichen (Komma) bleiben als Bausteine sichtbar – die Antwortprüfung
  // ignoriert Interpunktion ohnehin (normalizeHanzi).
  const basis = sentence.tokens.filter((_, i) => i !== idx).map((t) => t.h);

  const loesung = stripPunct(sentence.hanzi);
  const alternativen = sentence.altOrders.map((o) => o.map((t) => t.h).join(""));
  return {
    ...baseExercise(sentence, "wort_einsetzen", 1),
    frage: "Setze das Wort in Klammern an die richtige Stelle.",
    basis,
    wort,
    loesung,
    alternativen,
  };
}

// --- Fehlersatz korrigieren ----------------------------------------------

// Aus einem Zahl/这/那+ZEW+Nomen-Baustein („两本书“) nur das Nomen („书“) holen.
// Pinyin des Bausteins ist „Zahl ZEW Nomen…“ – die ersten beiden Silbengruppen
// gehören zu Zahl und ZEW (gilt für alle Zahlen ≤ 10, die wir generieren).
function npNounOnly(np) {
  if (!np) return null;
  const noun = np.h.replace(/^(这|那|[一二三四五六七八九十两]+)./, "");
  if (!noun || noun === np.h) return null;
  return { h: noun, p: np.p.split(" ").slice(2).join(" ") || pinyinOf(noun) || "?" };
}

const FEHLER_REGELN = {
  zeitAmEnde: {
    hinweis: "Zeitangaben stehen vor dem Verb, nicht am Satzende",
    wende(sentence) {
      const i = sentence.slotOfToken.findIndex((s) => s === "time" || s === "timeFuture");
      if (i < 0) return null;
      const toks = sentence.tokens.filter((_, j) => j !== i);
      toks.push(sentence.tokens[i]);
      return toks;
    },
  },
  ortNachVerb: {
    hinweis: "在 + Ort steht vor dem Verb",
    wende(sentence) {
      const zaiIdx = sentence.tokens.findIndex((t) => t.h === "在");
      if (zaiIdx < 0) return null;
      // 在 + Ort ans Satzende schieben
      const moved = sentence.tokens.slice(zaiIdx, zaiIdx + 2);
      const rest = [...sentence.tokens.slice(0, zaiIdx), ...sentence.tokens.slice(zaiIdx + 2)];
      return [...rest, ...moved];
    },
  },
  shiStattHen: {
    hinweis: "Beim Adjektivprädikat steht 很, nicht 是",
    wende(sentence) {
      const i = sentence.tokens.findIndex((t) => t.h === "很");
      if (i < 0) return null;
      const toks = [...sentence.tokens];
      toks[i] = { h: "是", p: "shì" };
      return toks;
    },
  },
  jiaoStattXing: {
    hinweis: "Vor dem bloßen Nachnamen steht 姓, nicht 叫",
    wende(sentence) {
      const i = sentence.tokens.findIndex((t) => t.h === "姓");
      if (i < 0) return null;
      const toks = [...sentence.tokens];
      toks[i] = { h: "叫", p: "jiào" };
      return toks;
    },
  },
  deFehlt: {
    hinweis: "Besitz braucht 的: 我的书",
    wende(sentence) {
      const i = sentence.tokens.findIndex((t) => t.h === "的");
      if (i < 0) return null;
      return sentence.tokens.filter((_, j) => j !== i);
    },
  },
  buStattMei: {
    hinweis: "有 wird mit 没 verneint, nie mit 不",
    wende(sentence) {
      const i = sentence.tokens.findIndex((t) => t.h === "没有");
      if (i < 0) return null;
      const toks = [...sentence.tokens];
      toks[i] = { h: "不有", p: "bù yǒu" };
      return toks;
    },
  },
  buStattMeiGuo: {
    hinweis: "过-Erfahrung wird mit 没 verneint",
    wende(sentence) {
      const i = sentence.tokens.findIndex((t) => t.h === "没");
      if (i < 0) return null;
      const toks = [...sentence.tokens];
      toks[i] = { h: "不", p: "bù" };
      return toks;
    },
  },
  erStattLiang: {
    hinweis: "Vor Zähleinheitswörtern steht 两, nicht 二",
    wende(sentence) {
      const i = sentence.tokens.findIndex((t) => t.h.includes("两"));
      if (i < 0) return null;
      const toks = [...sentence.tokens];
      toks[i] = { ...toks[i], h: toks[i].h.replace("两", "二"), p: toks[i].p.replace("liǎng", "èr") };
      return toks;
    },
  },
  falschesZew: {
    hinweis: "Jedes Nomen hat sein festes Zähleinheitswort",
    wende(sentence, rng) {
      const i = sentence.tokens.findIndex((t) => /^(这|那|[一二三四五六七八九十两]+)./.test(t.h) && t.h.length >= 3);
      if (i < 0) return null;
      const tok = sentence.tokens[i];
      const zew = tok.h.replace(/^(这|那|[一二三四五六七八九十两]+)/, "")[0];
      const falsch = pick(rng, ["个", "本", "杯", "件", "条", "张"].filter((z) => z !== zew));
      const toks = [...sentence.tokens];
      toks[i] = { ...tok, h: tok.h.replace(zew, falsch), p: tok.p.replace(pinyinOf(zew), pinyinOf(falsch)) };
      return toks;
    },
  },
  maPlusVnv: {
    hinweis: "V-不-V-Fragen stehen ohne 吗",
    frageForm: true,
    wende(sentence) {
      // aus dem Aussagesatz erst die V-不-V-Frage bauen, dann falsches 吗 anhängen
      const vnv = buildVnv(sentence);
      if (!vnv) return null;
      return [...vnv, { h: "吗", p: "ma" }];
    },
    loesungTokens(sentence) {
      return buildVnv(sentence);
    },
  },
  heStattHaishi: {
    hinweis: "In Alternativfragen steht 还是, nicht 和",
    wende(sentence) {
      const i = sentence.tokens.findIndex((t) => t.h === "还是");
      if (i < 0) return null;
      const toks = [...sentence.tokens];
      toks[i] = { h: "和", p: "hé" };
      return toks;
    },
  },
  yidianrStattYoudianr: {
    hinweis: "„etwas zu …“ (unangenehm) heißt 有点儿 + Adjektiv",
    wende(sentence) {
      const i = sentence.tokens.findIndex((t) => t.h === "有点儿");
      if (i < 0) return null;
      const toks = [...sentence.tokens];
      toks[i] = { h: "一点儿", p: "yìdiǎnr" };
      return toks;
    },
  },
  henInBi: {
    hinweis: "Im 比-Vergleich steht kein 很 vor dem Adjektiv",
    wende(sentence) {
      const i = sentence.slotOfToken.findIndex((s) => s && s.startsWith("adj"));
      if (i < 0) return null;
      const toks = [...sentence.tokens];
      toks.splice(i, 0, { h: "很", p: "hěn" });
      return toks;
    },
  },
  massVorAdj: {
    hinweis: "Das Maß (一点儿/得多) steht nach dem Adjektiv",
    wende(sentence) {
      const mi = sentence.tokens.findIndex((t) => t.h === "一点儿" || t.h === "得多");
      const ai = sentence.slotOfToken.findIndex((s) => s && s.startsWith("adj"));
      if (mi < 0 || ai < 0 || mi <= ai) return null;
      const toks = [...sentence.tokens];
      [toks[ai], toks[mi]] = [toks[mi], toks[ai]];
      return toks;
    },
  },
  leFehlt: {
    hinweis: "太 + Adjektiv braucht 了 am Satzende",
    wende(sentence) {
      const i = sentence.tokens.findIndex((t) => t.h === "了");
      if (i < 0) return null;
      return sentence.tokens.filter((_, j) => j !== i);
    },
  },
  datumKleinVorGross: {
    hinweis: "Datum von groß nach klein: erst 月, dann 号",
    wende(sentence) {
      const mi = sentence.tokens.findIndex((t) => t.h === "月");
      const hi = sentence.tokens.findIndex((t) => t.h === "号");
      if (mi < 0 || hi < 0) return null;
      const toks = [...sentence.tokens];
      // [Monat,月] und [Tag,号] als Blöcke tauschen
      const monat = toks.slice(mi - 1, mi + 1);
      const tag = toks.slice(hi - 1, hi + 1);
      toks.splice(hi - 1, 2, ...monat);
      toks.splice(mi - 1, 2, ...tag);
      return toks;
    },
  },
  liangInZehnern: {
    hinweis: "In Zehnern steht 二 (二十), nicht 两",
    wende(sentence) {
      const i = sentence.tokens.findIndex((t) => t.h.startsWith("二十"));
      if (i < 0) return null;
      const toks = [...sentence.tokens];
      toks[i] = { ...toks[i], h: toks[i].h.replace("二十", "两十"), p: toks[i].p.replace("èrshí", "liǎng shí").replace("èr shí", "liǎng shí") };
      return toks;
    },
  },
  douVorSubjekt: {
    hinweis: "都 steht nach dem Subjekt, vor dem Verb",
    wende(sentence) {
      const i = sentence.tokens.findIndex((t) => t.h === "都");
      if (i < 1) return null;
      const toks = sentence.tokens.filter((_, j) => j !== i);
      toks.unshift(sentence.tokens[i]);
      return toks;
    },
  },
  meiMitLe: {
    hinweis: "Nach 没(有) steht kein 了 – die Verneinung hebt die Abgeschlossenheit auf",
    // Aus „我买了两本书“ wird der Fehlersatz „我没买了书“; richtig ist „我没买书“.
    // (Die Mengenangabe fällt weg – bei 没 verneint man die ganze Handlung.)
    wende(sentence) {
      const li = sentence.tokens.findIndex((t) => t.h === "了");
      const noun = npNounOnly(sentence.tokens[li + 1]);
      if (li < 1 || !noun) return null;
      const toks = [...sentence.tokens];
      toks[li + 1] = noun;
      toks.splice(li - 1, 0, { h: "没", p: "méi" });
      return toks;
    },
    loesungTokens(sentence) {
      const li = sentence.tokens.findIndex((t) => t.h === "了");
      const noun = npNounOnly(sentence.tokens[li + 1]);
      if (li < 1 || !noun) return null;
      const toks = sentence.tokens.flatMap((t, j) =>
        j === li ? [] : j === li + 1 ? [noun] : [t]
      );
      toks.splice(li - 1, 0, { h: "没", p: "méi" });
      return toks;
    },
  },
  douFehlt: {
    hinweis: "Nach 每 + Zeit/ZEW gehört 都 vor das Verb",
    wende(sentence) {
      const i = sentence.tokens.findIndex((t) => t.h === "都");
      if (i < 0) return null;
      return sentence.tokens.filter((_, j) => j !== i);
    },
  },
  praepNachVerb: {
    hinweis: "跟 + Person + 一起 steht vor dem Verb",
    wende(sentence) {
      const gi = sentence.tokens.findIndex((t) => t.h === "跟");
      if (gi < 0) return null;
      const block = sentence.tokens.slice(gi, gi + 3); // 跟 + Person + 一起
      const rest = [...sentence.tokens.slice(0, gi), ...sentence.tokens.slice(gi + 3)];
      return [...rest, ...block];
    },
  },
};

export function genFehler(sentence, rng) {
  const regeln = (sentence.topicCfg.fehlerRegeln ?? []).filter((r) => FEHLER_REGELN[r]);
  const anwendbar = regeln
    .map((r) => ({ r, regel: FEHLER_REGELN[r], toks: FEHLER_REGELN[r].wende(sentence, rng) }))
    .filter((x) => x.toks);
  if (!anwendbar.length) return null;
  const { regel, toks } = pick(rng, anwendbar);
  const punct = regel.frageForm ? "？" : sentence.isQuestion ? "？" : "。";
  const falsch = toks.map((t) => t.h).join("") + punct;
  const loesungTokens = regel.loesungTokens?.(sentence);
  const loesung = loesungTokens
    ? loesungTokens.map((t) => t.h).join("") + (regel.frageForm ? "？" : "。")
    : sentence.hanzi;
  if (stripPunct(falsch) === stripPunct(loesung)) return null;
  return {
    ...baseExercise(sentence, "fehler", 1),
    frage: "Der Satz enthält einen Fehler. Schreibe ihn richtig.",
    falsch,
    loesung,
    hinweis: regel.hinweis,
  };
}

// --- Umformung ------------------------------------------------------------
function buildVnv(sentence) {
  // Aussagesatz → V-不-V-Frage (nur bei einsilbigem Verb bzw. 是/有)
  const vi = sentence.tokens.findIndex(
    (t, i) => ["是", "有", "会"].includes(t.h) || sentence.slotOfToken[i]?.startsWith("vo")
  );
  if (vi < 0) return null;
  const v = sentence.tokens[vi];
  if (v.h.length !== 1) return null;
  const toks = [...sentence.tokens];
  toks.splice(vi + 1, 0, { h: v.h, p: v.p }, );
  toks.splice(vi + 1, 0, { h: "不", p: firstTone(v.p) === 4 ? "bú" : "bù" });
  return toks;
}

const UMFORMUNGEN = {
  ma: {
    anweisung: "Forme den Aussagesatz in eine 吗-Frage um.",
    build(sentence) {
      let toks = frageSubjekt(sentence.tokens);
      // Beim Adjektivprädikat fällt das unbetonte 很 in der Frage weg:
      // 你很忙。 → 你忙吗？ (nicht 你很忙吗？)
      const hen = toks.findIndex(
        (t, i) => t.h === "很" && sentence.slotOfToken[i + 1]?.startsWith("adj")
      );
      if (hen >= 0) toks = toks.filter((_, i) => i !== hen);
      return { quelle: sentence.hanzi, loesung: toks.map((t) => t.h).join("") + "吗？" };
    },
  },
  vnv: {
    anweisung: "Forme den Aussagesatz in eine V-不-V-Frage um.",
    build(sentence) {
      const vnv = buildVnv({ ...sentence, tokens: frageSubjekt(sentence.tokens) });
      if (!vnv) return null;
      return { quelle: sentence.hanzi, loesung: vnv.map((t) => t.h).join("") + "？" };
    },
  },
  maZuVnv: {
    anweisung: "Forme die 吗-Frage in eine V-不-V-Frage um.",
    build(sentence) {
      const frageToks = frageSubjekt(sentence.tokens);
      const vnv = buildVnv({ ...sentence, tokens: frageToks });
      if (!vnv) return null;
      return {
        quelle: frageToks.map((t) => t.h).join("") + "吗？",
        loesung: vnv.map((t) => t.h).join("") + "？",
      };
    },
  },
  youmeiyou: {
    anweisung: "Forme den Satz in eine 有没有-Frage um.",
    build(sentence) {
      const yi = sentence.tokens.findIndex((t) => t.h === "有");
      if (yi < 0) return null;
      const toks = frageSubjekt(sentence.tokens);
      const out = [...toks];
      out[yi] = { h: "有没有", p: "yǒu méiyǒu" };
      return { quelle: sentence.hanzi, loesung: out.map((t) => t.h).join("") + "？" };
    },
  },
  youmeiyouZuMa: {
    anweisung: "Forme die 有没有-Frage in eine Frage mit 吗 um.",
    build(sentence) {
      const yi = sentence.tokens.findIndex((t) => t.h === "有");
      if (yi < 0) return null;
      const toks = frageSubjekt(sentence.tokens);
      const vnvToks = [...toks];
      vnvToks[yi] = { h: "有没有", p: "yǒu méiyǒu" };
      return {
        quelle: vnvToks.map((t) => t.h).join("") + "？",
        loesung: toks.map((t) => t.h).join("") + "吗？",
      };
    },
  },
  haoma: {
    anweisung: "Mache aus dem Satz einen Vorschlag mit ，好吗？",
    build(sentence) {
      const base = sentence.tokens.filter((t) => !t.punct && t.h !== "好吗");
      return {
        quelle: base.map((t) => t.h).join("") + "。",
        loesung: base.map((t) => t.h).join("") + "，好吗？",
      };
    },
  },
  biZuMeiyou: {
    anweisung: "Drücke denselben Vergleich mit 没有 aus (A 比 B … → B 没有 A …).",
    build(sentence) {
      const bi = sentence.tokens.findIndex((t) => t.h === "比");
      if (bi < 0) return null;
      const a = sentence.tokens.slice(0, bi);
      const b = sentence.tokens.slice(bi + 1, bi + 2);
      const rest = sentence.tokens.slice(bi + 2).filter((t) => t.h !== "一点儿" && t.h !== "得多");
      const loesung = [...b, { h: "没有", p: "méiyǒu" }, ...a, ...rest].map((t) => t.h).join("") + "。";
      return { quelle: sentence.hanzi, loesung };
    },
  },
};
// 我→你 im Fragekontext (wer fragt, spricht das Gegenüber an).
// Behandelt auch 我+Verwandtschaft („我妹妹“ → „你妹妹“).
function frageSubjekt(tokens) {
  return tokens.map((t) => {
    if (t.h === "我") return { h: "你", p: "nǐ" };
    if (t.h === "我们") return { h: "你们", p: "nǐmen" };
    if (t.h.startsWith("我") && t.h.length > 1 && !t.h.startsWith("我们")) {
      return { h: "你" + t.h.slice(1), p: t.p.replace(/^wǒ/, "nǐ") };
    }
    return t;
  });
}

export function genUmformung(sentence, rng) {
  const arten = (sentence.topicCfg.umformungen ?? []).filter((u) => UMFORMUNGEN[u]);
  if (!arten.length) return null;
  const art = UMFORMUNGEN[pick(rng, arten)];
  const built = art.build(sentence);
  if (!built) return null;
  return {
    ...baseExercise(sentence, "umformung", 2),
    frage: art.anweisung,
    quelle: built.quelle,
    loesung: built.loesung,
    alternativen: built.alternativen ?? [],
    // Das Basis-Pinyin gehört zum Ausgangssatz, nicht zur umgeformten
    // Lösung – lieber weglassen als Falsches anzeigen.
    pinyin: undefined,
  };
}

// --- Frage beantworten / Frage stellen -----------------------------------
const FRAGEN = {
  objShenme: (sentence) => {
    const oi = sentence.tokens.findIndex((t, i) => sentence.slotOfToken[i]?.startsWith("vo") && i > 0 && sentence.slotOfToken[i - 1] === sentence.slotOfToken[i]);
    if (oi < 0) return null;
    const toks = frageSubjekt(sentence.tokens);
    toks[oi] = { h: "什么", p: "shénme" };
    return toks.map((t) => t.h).join("") + "？";
  },
  ortNar: (sentence) => {
    const zi = sentence.tokens.findIndex((t) => t.h === "在");
    if (zi < 0) return null;
    const toks = frageSubjekt(sentence.tokens);
    toks[zi + 1] = { h: "哪儿", p: "nǎr" };
    return toks.map((t) => t.h).join("") + "？";
  },
  zeitWann: (sentence) => {
    const ti = sentence.slotOfToken.findIndex((s) => s === "time" || s === "timeFuture");
    if (ti < 0) return null;
    const toks = frageSubjekt(sentence.tokens);
    toks[ti] = { h: "什么时候", p: "shénme shíhou" };
    return toks.map((t) => t.h).join("") + "？";
  },
  jaNein: (sentence) => frageSubjekt(sentence.tokens).map((t) => t.h).join("") + "吗？",
  werIstDas: (sentence) => {
    const shi = sentence.tokens.findIndex((t) => t.h === "是");
    if (shi < 0) return null;
    return sentence.tokens.slice(0, shi + 1).map((t) => t.h).join("") + "谁？";
  },
  werSubj: (sentence) => {
    const shi = sentence.tokens.findIndex((t) => t.h === "是");
    if (shi < 0) return null;
    const rest = frageSubjekt(sentence.tokens.slice(shi));
    return "谁" + rest.map((t) => t.h).join("") + "？";
  },
  // WICHTIG: Jede Frage prüft, ob sie zum generierten Satz passt, und gibt
  // sonst null zurück – ein Thema kann Templates mit unterschiedlichem Inhalt
  // haben (z. B. Thema 6: Alter UND Uhrzeit), und Frage und Antwort müssen
  // zusammengehören.
  duoDa: (sentence) => {
    if (!sentence.tokens.some((t) => t.h === "岁")) return null;
    const subj = frageSubjekt(sentence.tokens.slice(0, 1));
    return subj.map((t) => t.h).join("") + "今年多大？";
  },
  jiDian: (sentence) =>
    sentence.tokens.some((t) => t.h.includes("点")) ? "现在几点？" : null,
  jiYueJiHao: (sentence) => {
    // Geburtstags-Satz: den Besitzer aus dem Satz übernehmen
    // (我的生日… → Frage 你的生日是几月几号？, 马克的生日… → 马克的…)
    const si = sentence.tokens.findIndex((t) => t.h === "生日");
    if (si >= 0) {
      const owner = frageSubjekt(sentence.tokens.slice(0, si + 1)).map((t) => t.h).join("");
      return owner + "是几月几号？";
    }
    return sentence.tokens.some((t) => t.h === "月" || t.h === "号")
      ? "今天几月几号？"
      : null;
  },
  duoshaoQian: (sentence) => {
    // Das komplette Subjekt (alles vor der Preiszahl) übernehmen:
    // 一杯咖啡八块钱 → 一杯咖啡多少钱？ (nicht nur das erste Token)
    const pi = sentence.slotOfToken.findIndex((s) => s?.startsWith("numPreis"));
    if (pi < 1 || !sentence.tokens.some((t) => t.h === "块")) return null;
    return sentence.tokens.slice(0, pi).map((t) => t.h).join("") + "多少钱？";
  },
  alternativ: (sentence) => sentence.hanzi,
  // 您贵姓？ fragt das Gegenüber – passt nur, wenn die Antwort in der
  // Ich-Form steht (Subjekt 我 bzw. 你, das zur Antwort 我 gespiegelt wird)
  guixing: (sentence) =>
    sentence.tokens.some((t) => t.h === "姓") && ["我", "你"].includes(sentence.tokens[0].h)
      ? "您贵姓？"
      : null,
  jiaoShenme: (sentence) =>
    sentence.tokens.some((t) => t.h === "叫")
      ? frageSubjekt(sentence.tokens.slice(0, 1)).map((t) => t.h).join("") + "叫什么名字？"
      : null,
};

// Gegenstück zu frageSubjekt: In der ANTWORT spricht der Gefragte –
// 你 wird zu 我 („你叫什么名字？“ → „我叫…“, nie „你叫…“).
function antwortSubjekt(tokens) {
  return tokens.map((t) => {
    if (t.h === "你") return { h: "我", p: "wǒ" };
    if (t.h === "你们") return { h: "我们", p: "wǒmen" };
    if (t.h.startsWith("你") && t.h.length > 1 && !t.h.startsWith("你们")) {
      return { h: "我" + t.h.slice(1), p: t.p.replace(/^nǐ/, "wǒ") };
    }
    return t;
  });
}

export function genFrage(sentence, rng, stellen = false) {
  const arten = (sentence.topicCfg.fragen ?? []).filter((f) => FRAGEN[f]);
  if (!arten.length) return null;
  const frage = FRAGEN[pick(rng, arten)](sentence);
  if (!frage) return null;
  // Antwortsatz: der Gefragte antwortet in der Ich-Form (你 → 我);
  // das Pinyin dazu neu zusammensetzen, damit es zur Antwort passt.
  let antwortToks = antwortSubjekt(sentence.tokens);
  let antwort = antwortToks.map((t) => t.h).join("") + (sentence.isQuestion ? "？" : "。");
  // Bei Alternativfragen die erste Option als Antwort wählen
  if (sentence.topicCfg.fragen?.includes("alternativ")) {
    const hi = sentence.tokens.findIndex((t) => t.h === "还是");
    if (hi > 0) {
      antwortToks = [{ h: "我", p: "wǒ" }, ...sentence.tokens.slice(1, hi)];
      antwort = antwortToks.map((t) => t.h).join("") + "。";
    }
  }
  const antwortPinyin =
    cap(antwortToks.filter((t) => !t.punct).map((t) => t.p).join(" ")) +
    (antwort.endsWith("？") ? "?" : ".");
  // Wurde das Subjekt gespiegelt, stimmt die deutsche Übersetzung des
  // Ausgangssatzes („Du …“) nicht mehr zur Antwort („我 …“) – dann weglassen.
  const deutschPasst = antwort === sentence.hanzi;
  if (stellen) {
    return {
      ...baseExercise(sentence, "frage_stellen", 2),
      frage: "Stelle zur vorgegebenen Antwort die passende Frage.",
      gegebeneAntwort: antwort,
      loesung: frage,
      pinyin: undefined, // Basis-Pinyin gehört zur Antwort, nicht zur Frage
      deutsch: deutschPasst ? sentence.deutsch : undefined,
    };
  }
  return {
    ...baseExercise(sentence, "frage_beantworten", 2),
    frage: "Beantworte die Frage mit Schriftzeichen (Musterlösung als Beispiel).",
    antwortFrage: frage,
    loesung: antwort,
    pinyin: antwortPinyin,
    deutsch: deutschPasst ? sentence.deutsch : undefined,
  };
}

// --- Übersetzung ----------------------------------------------------------
export function genUebersetzung(sentence) {
  if (sentence.template.uebersetzung === false) return null;
  return {
    ...baseExercise(sentence, "uebersetzung", 2),
    frage: "Übersetze ins Chinesische (Schriftzeichen).",
    deutsch: sentence.deutsch,
    loesung: sentence.hanzi,
    alternativen: sentence.altOrders.map((o) => o.map((t) => t.h).join("")),
  };
}

// --------------------------------------------------------------------------
// Öffentliche API: Übungssätze für Üben & Prüfung
// --------------------------------------------------------------------------
export const GENERATOR_TOPICS = templatesData.map((t) => t.topicId);
const topicCfgById = Object.fromEntries(templatesData.map((t) => [t.topicId, t]));

const FORMAT_BUILDERS = {
  reihenfolge: (s, rng) => genReihenfolge(s, rng),
  lueckentext: (s, rng) => genLueckentext(s, rng),
  wort_einsetzen: (s, rng) => genWortEinsetzen(s, rng),
  fehler: (s, rng) => genFehler(s, rng),
  umformung: (s, rng) => genUmformung(s, rng),
  frage_beantworten: (s, rng) => genFrage(s, rng, false),
  frage_stellen: (s, rng) => genFrage(s, rng, true),
  uebersetzung: (s) => genUebersetzung(s),
};
export const GEN_FORMATS = Object.keys(FORMAT_BUILDERS);

// Welche Formate ein Thema anbieten kann (aus der Template-Konfiguration)
export function formatsForTopic(topicId) {
  const cfg = topicCfgById[topicId];
  if (!cfg) return [];
  // "reihenfolge": false → Thema erzeugt nur Sätze mit Komma, die sich nicht
  // schütteln lassen (z. B. 因为…所以…)
  const f = cfg.reihenfolge === false ? ["uebersetzung"] : ["reihenfolge", "uebersetzung"];
  if (cfg.luecke?.length) f.push("lueckentext");
  if (cfg.einsetzen?.length) f.push("wort_einsetzen");
  if (cfg.fehlerRegeln?.length) f.push("fehler");
  if (cfg.umformungen?.length) f.push("umformung");
  if (cfg.fragen?.length) f.push("frage_beantworten", "frage_stellen");
  return f;
}

// Merker gegen direkte Wiederholung desselben Satzes
let lastHanzi = new Set();

// Einen Übungssatz für Thema + Format erzeugen (mit Wiederholungs-Schutz).
export function generateExercise(topicId, format, rng) {
  const cfg = topicCfgById[topicId];
  if (!cfg) return null;
  for (let attempt = 0; attempt < 12; attempt++) {
    const template = pick(rng, cfg.templates);
    const sentence = generateSentence(template, cfg, rng);
    if (sentence.tokens.some((t) => t.p === "?")) continue; // fehlendes Pinyin → nie ausliefern
    const ex = FORMAT_BUILDERS[format]?.(sentence, rng);
    if (!ex) continue;
    if (lastHanzi.has(sentence.hanzi) && attempt < 8) continue;
    lastHanzi.add(sentence.hanzi);
    if (lastHanzi.size > 40) lastHanzi = new Set([...lastHanzi].slice(-20));
    return ex;
  }
  return null;
}

// Übungsset für EIN Thema: rotiert durch alle unterstützten Formate.
export function generateTopicSet(topicId, count = 10, seed) {
  const rng = makeRng(seed);
  const formats = shuffle(rng, formatsForTopic(topicId));
  const out = [];
  let i = 0;
  while (out.length < count && i < count * 4) {
    const ex = generateExercise(topicId, formats[i % formats.length], rng);
    if (ex) out.push(ex);
    i++;
  }
  return out;
}

// Gemischtes Set über mehrere Themen; schwache Themen (Fehlerquote > 30 %)
// werden doppelt gewichtet.
export function generateMixedSet(topicIds, weakIds, count = 12, seed) {
  const rng = makeRng(seed);
  const pool = topicIds.filter((id) => topicCfgById[id]);
  if (!pool.length) return [];
  const weighted = [...pool, ...pool.filter((id) => weakIds.includes(id))];
  const out = [];
  let guard = 0;
  while (out.length < count && guard < count * 6) {
    guard++;
    const topicId = pick(rng, weighted);
    const formats = formatsForTopic(topicId);
    const ex = generateExercise(topicId, pick(rng, formats), rng);
    if (ex) out.push(ex);
  }
  return out;
}

// Probeklausur im Stil von Probeklausur_1_Lek4-6: feste Aufgabenblöcke,
// Aufgaben werden frisch generiert.
export const GEN_EXAM_BLUEPRINT = [
  { format: "lueckentext", titel: "Lückentext", count: 6, roman: "I" },
  { format: "wort_einsetzen", titel: "Wort einsetzen", count: 2, roman: "II" },
  { format: "reihenfolge", titel: "Wörter in die richtige Reihenfolge", count: 4, roman: "III" },
  { format: "frage_beantworten", titel: "Mit Schriftzeichen antworten", count: 3, roman: "IV" },
  { format: "frage_stellen", titel: "Passende Frage stellen", count: 2, roman: "V" },
  { format: "fehler", titel: "Fehlersatz korrigieren", count: 3, roman: "VI" },
  { format: "umformung", titel: "Sätze umformen", count: 2, roman: "VII" },
  { format: "uebersetzung", titel: "Übersetzung Deutsch → Chinesisch", count: 4, roman: "VIII" },
];

export function buildGeneratedExam(topicIds, seed) {
  const rng = makeRng(seed);
  const inScope = (topicIds?.length ? topicIds : GENERATOR_TOPICS).filter((id) => topicCfgById[id]);
  const sections = [];
  const flat = [];
  for (const block of GEN_EXAM_BLUEPRINT) {
    const candidates = shuffle(rng, inScope.filter((id) => formatsForTopic(id).includes(block.format)));
    const exercises = [];
    let i = 0;
    while (exercises.length < block.count && i < candidates.length * 3 && candidates.length) {
      const topicId = candidates[i % candidates.length];
      const ex = generateExercise(topicId, block.format, rng);
      if (ex) exercises.push(ex);
      i++;
    }
    if (!exercises.length) continue;
    const punkte = exercises.reduce((s, ex) => s + (ex.punkte ?? 1), 0);
    sections.push({ ...block, exercises, punkte });
    flat.push(...exercises);
  }
  const total = flat.reduce((s, ex) => s + (ex.punkte ?? 1), 0);
  return { sections, exercises: flat, total };
}
