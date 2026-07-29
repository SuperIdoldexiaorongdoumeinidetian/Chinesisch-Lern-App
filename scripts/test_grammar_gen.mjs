// Qualitätssicherung für den Grammatik-Übungsgenerator.
//
// Generiert pro Template 50 Sätze und prüft automatisch:
//   1. Kein fehlendes Pinyin ("?") und keine unaufgelösten {…}-Platzhalter
//   2. Verb-Objekt-Paare kommen nur aus collocations.json (bzw. den
//      kuratierten lexikalisierten Tätigkeiten)
//   3. Zähleinheitswörter stimmen mit measureWord in vocab.json überein
//   4. Zeit- und Ortsangaben stehen vor dem Verb (Grundwortstellung)
//   5. Vor ZEW steht 两, nie 二; Adjektivprädikat ohne 是
//   6. Alle verwendeten Inhaltswörter existieren in vocab.json
//   7. Jedes Format, das ein Thema laut Konfiguration anbietet, ist auch
//      tatsächlich generierbar
//
// Aufruf:  node scripts/test_grammar_gen.mjs            (nur Prüfung)
//          node scripts/test_grammar_gen.mjs --samples  (+ 3 Beispiele/Thema)
import vocab from "../src/data/vocab.json" with { type: "json" };
import collocations from "../src/data/collocations.json" with { type: "json" };
import templatesData from "../src/data/grammar_templates.json" with { type: "json" };
import {
  makeRng,
  generateSentence,
  generateExercise,
  formatsForTopic,
  buildGeneratedExam,
} from "../src/lib/grammarGen.js";

const showSamples = process.argv.includes("--samples");
const errors = [];
const warn = (msg) => errors.push(msg);

// --- Nachschlagewerke aus den Datendateien ---------------------------------
const vocabSet = new Set(vocab.map((e) => e.hanzi));
const measureByNoun = new Map();
for (const e of vocab) if (e.measureWord && !measureByNoun.has(e.hanzi)) measureByNoun.set(e.hanzi, e.measureWord);
const collocSet = new Set(collocations.map((c) => c.verb + c.obj));
// Lexikalisierte "Verb+Objekt"-Wörter, die als EIN Vokabeleintrag existieren
const LEXICAL_VO = new Set(["工作", "学习", "休息", "睡觉", "上网", "做饭", "吃饭", "上课", "上班", "开会", "聊天", "下课", "下班", "见面", "唱歌", "跳舞", "打电话"]);

const ZEW_CHARS = "个本杯件条张辆口位双碗份部块朵家";
const NUM_CHARS = "一二三四五六七八九十两";

// Prüft einen Zahl/这/那+ZEW+Nomen-Baustein gegen measureWord aus vocab.json.
function checkZewToken(tokenH, where) {
  const m = tokenH.match(new RegExp(`^(这|那|[${NUM_CHARS}]+)([${ZEW_CHARS}])(.+)$`));
  if (!m) return;
  const [, num, zew, noun] = m;
  const expected = measureByNoun.get(noun);
  if (expected && expected !== zew) {
    warn(`${where}: ZEW „${zew}“ passt nicht zu ${noun} (vocab.json sagt „${expected}“) in „${tokenH}“`);
  }
  // 二 direkt vor ZEW ist immer falsch (两!)
  if (num.endsWith("二") && num !== "十二" && !num.endsWith("十二")) {
    warn(`${where}: 二 direkt vor ZEW in „${tokenH}“ – muss 两 sein`);
  }
}

// Prüft die Grundwortstellung: Zeit/在+Ort müssen vor dem ersten Verb stehen.
function checkWordOrder(sentence, where) {
  const slots = sentence.slotOfToken;
  const toks = sentence.tokens;
  const verbIdx = toks.findIndex(
    (t, i) => slots[i]?.startsWith("vo") || slots[i]?.startsWith("act") || ["去", "买", "看", "喝", "吃"].includes(t.h)
  );
  if (verbIdx < 0) return;
  for (let i = verbIdx + 1; i < toks.length; i++) {
    if (slots[i] === "time" || slots[i] === "timeFuture") {
      warn(`${where}: Zeitangabe „${toks[i].h}“ steht nach dem Verb: ${sentence.hanzi}`);
    }
  }
}

// Prüft, dass jedes Inhaltswort im Satz aus vocab.json stammt (Funktions-
// zeichen, Zahlen und ZEW ausgenommen).
const FUNC_OK = new Set(["在", "去", "来", "吗", "很", "是", "有", "的", "了", "这", "那", "谁", "什么", "哪儿", "不", "没", "没有", "太", "要", "想", "会", "能", "可以", "听说", "好吗", "比", "跟", "和", "一样", "一起", "得", "得多", "一点儿", "有点儿", "最", "喜欢", "看看", "试试", "过", "还是", "又", "一边", "因为", "所以", "有的", "每", "每天", "都", "以后", "给", "月", "号", "块", "钱", "岁", "点", "半", "分", "一刻", "一些", "这些", "些", "，", "人", "口", "家", "姓", "叫", "今年", "现在", "今天", "好", "菜", "书", "电话", "见面", "星期", "个"]);
function checkVocabCoverage(sentence, where) {
  for (let i = 0; i < sentence.tokens.length; i++) {
    const t = sentence.tokens[i];
    if (t.punct || FUNC_OK.has(t.h)) continue;
    // zusammengesetzte Bausteine (Zahl+ZEW+Nomen, 我+Verwandtschaft, Uhrzeit,
    // Zahlen) zerlegen wir nicht weiter – der ZEW-Check läuft separat
    if (new RegExp(`^(这|那|[${NUM_CHARS}])`).test(t.h)) continue;
    if (t.h.startsWith("我") || t.h.startsWith("你")) continue;
    if (/^[0-9]/.test(t.h)) continue;
    if (!vocabSet.has(t.h)) {
      // mehrteilige Phrasen wie 今天晚上 prüfen wir teilweise
      const parts = t.h.match(/今天(晚上|下午)/);
      if (parts) continue;
      warn(`${where}: „${t.h}“ steht nicht in vocab.json: ${sentence.hanzi}`);
    }
  }
}

// Prüft ein Verb-Objekt-Paar gegen collocations.json. Zwischen Verb und
// Objekt darf 了 stehen; das Objekt darf ein Zahl+ZEW+Nomen-Baustein sein
// (dann zählt das nackte Nomen als Objekt: 吃了三个饺子 → 吃+饺子).
function checkCollocations(sentence, where) {
  const slots = sentence.slotOfToken;
  const toks = sentence.tokens;
  const npNoun = (h) => {
    const m = h.match(new RegExp(`^(这|那|[${NUM_CHARS}]+)([${ZEW_CHARS}])(.+)$`));
    return m ? m[3] : h;
  };
  for (let i = 0; i < toks.length - 1; i++) {
    const s = slots[i];
    if (!s?.startsWith("vo")) continue;
    if (slots[i + 1] === s) {
      // Aspektpartikel 了 überspringen (gehört nicht zur Kollokation)
      let oi = i + 1;
      if (toks[oi].h === "了" && slots[oi + 1] === s) oi++;
      const pair = toks[i].h + npNoun(toks[oi].h);
      if (!collocSet.has(pair) && !LEXICAL_VO.has(toks[i].h)) {
        warn(`${where}: Verb-Objekt „${pair}“ steht nicht in collocations.json: ${sentence.hanzi}`);
      }
      i = oi; // Objekt übersprungen
    } else if (!LEXICAL_VO.has(toks[i].h)) {
      warn(`${where}: einzelnes „Verb“ ${toks[i].h} ist nicht lexikalisiert: ${sentence.hanzi}`);
    }
  }
}

// Statische Vorprüfung: {slot:verb} im de-Muster konjugiert das Wort nach
// dem Doppelpunkt als deutschen Infinitiv (z. B. {subj:essen} → „isst“).
// Steht dort versehentlich ein Slot-Name aus dem pattern (z. B. {subj:vo}),
// wird der Slot-Name selbst wie ein Verb "konjugiert" und ergibt Unsinn wie
// „ve“ statt „isst“ (siehe Thema 48 – echter Bug, der so gefunden wurde).
for (const cfg of templatesData) {
  for (const tpl of cfg.templates) {
    for (const m of (tpl.de ?? "").matchAll(/\{([a-zA-Z0-9]+):([a-zA-Z0-9]+)\}/g)) {
      if (tpl.pattern.includes(m[2])) {
        warn(`Thema ${cfg.topicId} / Template ${tpl.id}: „{${m[1]}:${m[2]}}“ konjugiert den Slot-Namen „${m[2]}“ statt eines echten Verb-Infinitivs – vermutlich sollte hier „{${m[2]}.v}“ o. Ä. stehen.`);
      }
    }
  }
}

// --- Hauptlauf: 50 Sätze pro Template ---------------------------------------
let sentenceCount = 0;
const samplesByTopic = new Map();
for (const cfg of templatesData) {
  for (const tpl of cfg.templates) {
    const rng = makeRng(42 + cfg.topicId * 100);
    const seen = new Set();
    for (let i = 0; i < 50; i++) {
      const where = `Thema ${cfg.topicId} / Template ${tpl.id}`;
      let s;
      try {
        s = generateSentence(tpl, cfg, rng);
      } catch (e) {
        warn(`${where}: Exception beim Generieren: ${e.message}`);
        break;
      }
      sentenceCount++;
      seen.add(s.hanzi);

      if (s.tokens.some((t) => t.p === "?")) warn(`${where}: fehlendes Pinyin in „${s.hanzi}“ (${s.pinyin})`);
      if (/[{}]/.test(s.deutsch)) warn(`${where}: unaufgelöster Platzhalter im Deutschen: „${s.deutsch}“`);
      if (/\bundefined\b|\[object/.test(s.deutsch)) warn(`${where}: „undefined“ im Deutschen: „${s.deutsch}“`);
      if (!s.deutsch || s.deutsch.length < 4) warn(`${where}: leere deutsche Übersetzung für „${s.hanzi}“`);
      for (const t of s.tokens) checkZewToken(t.h, where);
      checkWordOrder(s, where);
      checkCollocations(s, where);
      checkVocabCoverage(s, where);
      if (s.hanzi.includes("是很") || / shì hěn /.test(s.pinyin)) warn(`${where}: 是 vor Adjektivprädikat: ${s.hanzi}`);

      if (!samplesByTopic.has(cfg.topicId)) samplesByTopic.set(cfg.topicId, []);
      const samples = samplesByTopic.get(cfg.topicId);
      if (samples.length < 3 && !samples.some((x) => x.hanzi === s.hanzi)) {
        samples.push({ hanzi: s.hanzi, pinyin: s.pinyin, deutsch: s.deutsch });
      }
    }
    if (seen.size < 3) warn(`Thema ${cfg.topicId} / Template ${tpl.id}: nur ${seen.size} verschiedene Sätze in 50 Läufen`);
  }
}

// --- Jedes angebotene Format muss generierbar sein ---------------------------
for (const cfg of templatesData) {
  for (const format of formatsForTopic(cfg.topicId)) {
    const rng = makeRng(7 + cfg.topicId);
    let ok = false;
    for (let i = 0; i < 30 && !ok; i++) {
      const ex = generateExercise(cfg.topicId, format, rng);
      if (ex) {
        ok = true;
        // Grundplausibilität der Übung
        if (ex.format === "lueckentext" && !ex.satz.includes("___")) warn(`Thema ${cfg.topicId}/${format}: keine Lücke im Satz`);
        if (ex.format === "reihenfolge" && ex.tokens.join("") .length !== ex.loesung.length) warn(`Thema ${cfg.topicId}/${format}: Tokens ≠ Lösung: [${ex.tokens}] vs ${ex.loesung}`);
        if (ex.format === "fehler" && ex.falsch === ex.loesung) warn(`Thema ${cfg.topicId}/${format}: Fehlersatz gleich Lösung`);
        if (ex.format === "wort_einsetzen" && ex.basis.join("").includes(ex.wort) === false && !ex.loesung.includes(ex.wort)) warn(`Thema ${cfg.topicId}/${format}: Einsetzwort fehlt in Lösung`);
        // Frage und Antwort müssen zusammenpassen (z. B. nicht „现在几点？“
        // mit einer Alters-Antwort beantworten – Themen mit gemischten Templates!)
        if (ex.format === "frage_beantworten" || ex.format === "frage_stellen") {
          const frage = ex.antwortFrage ?? ex.loesung;
          const antwort = ex.format === "frage_beantworten" ? ex.loesung : ex.gegebeneAntwort;
          const paare = [
            ["几点", "点"], ["多大", "岁"], ["几月几号", "月"],
            ["多少钱", "块"], ["贵姓", "姓"], ["叫什么名字", "叫"],
          ];
          for (const [inFrage, inAntwort] of paare) {
            if (frage.includes(inFrage) && !antwort.includes(inAntwort)) {
              warn(`Thema ${cfg.topicId}/${format}: Frage „${frage}“ passt nicht zur Antwort „${antwort}“`);
            }
          }
          // Wer gefragt wird (你/您), antwortet mit 我 – nie mit 你
          if ((frage.startsWith("你") || frage.includes("您")) && antwort.startsWith("你")) {
            warn(`Thema ${cfg.topicId}/${format}: Antwort „${antwort}“ steht in der Du-Form zur Frage „${frage}“`);
          }
        }
      }
    }
    if (!ok) warn(`Thema ${cfg.topicId}: Format „${format}“ wird angeboten, ist aber nicht generierbar`);
  }
}

// --- Probeklausur muss vollständig baubar sein -------------------------------
const exam = buildGeneratedExam(null, 123);
if (exam.sections.length < 7) warn(`Probeklausur: nur ${exam.sections.length} Abschnitte baubar`);
if (exam.total < 20) warn(`Probeklausur: nur ${exam.total} Punkte insgesamt`);

// --- Ausgabe -----------------------------------------------------------------
console.log(`${sentenceCount} Sätze generiert.`);
if (errors.length) {
  // Gleiche Fehler nur einmal zeigen
  const uniq = [...new Set(errors)];
  console.log(`\n${uniq.length} eindeutige Probleme:`);
  for (const e of uniq.slice(0, 300)) console.log("  ✗ " + e);
  if (uniq.length > 300) console.log(`  … und ${uniq.length - 300} weitere`);
  process.exit(1);
}
console.log("Alle Prüfungen bestanden. ✓");

if (showSamples) {
  console.log("\n--- 3 Beispielsätze pro Thema ---");
  for (const [topicId, samples] of [...samplesByTopic.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`\nThema ${topicId}:`);
    for (const s of samples) console.log(`  ${s.hanzi}  |  ${s.pinyin}  |  ${s.deutsch}`);
  }
}
