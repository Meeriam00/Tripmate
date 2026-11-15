/**
 * Azerbaijani suffixes for names, following vowel harmony, so the interface
 * reads naturally: "Məryəmə ödə", "Leylaya ödə", "Əlinin ödənişi".
 */
const VOWELS = "aıoueəiöüAIOUEƏİÖÜ";
const BACK = "aıouAIOU";

function lastVowel(word: string): string {
  for (let i = word.length - 1; i >= 0; i--) if (VOWELS.includes(word[i])) return word[i].toLocaleLowerCase("az");
  return "ə";
}
const endsWithVowel = (w: string) => VOWELS.includes(w[w.length - 1] ?? "");

/** Dative: Məryəm → Məryəmə, Leyla → Leylaya, Murad → Murada, Sən → Sənə. */
export function dative(name: string): string {
  if (name === "Sən") return "Sənə";
  const v = BACK.includes(lastVowel(name)) ? "a" : "ə";
  return name + (endsWithVowel(name) ? "y" : "") + v;
}

/** Genitive: Murad → Muradın, Əli → Əlinin, Məryəm → Məryəmin, Sən → Sənin. */
export function genitive(name: string): string {
  if (name === "Sən") return "Sənin";
  const v = lastVowel(name);
  const s = "aı".includes(v) ? "ın" : "ou".includes(v) ? "un" : "öü".includes(v) ? "ün" : "in";
  return name + (endsWithVowel(name) ? "n" : "") + s;
}

/** "I am …": Əli → Əliyəm, Tural → Turalam. */
export function iAm(name: string): string {
  const v = BACK.includes(lastVowel(name)) ? "am" : "əm";
  return name + (endsWithVowel(name) ? "y" : "") + v;
}

export const first = (name: string) => name.split(" ")[0];
