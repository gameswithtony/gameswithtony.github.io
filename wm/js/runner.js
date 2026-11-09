// All pending work is serializable data. Handlers may add tasks or stop at a decision.
export const H = {};
export const DONE = Symbol('done');
export const clone = x => JSON.parse(JSON.stringify(x));
export function add(st, ...tasks) { st.stack.push(...tasks.reverse()); }
export function ask(st, t, title, options, text = '', kind = 'choice') {
  if (!options.some(o => !o.disabled)) throw new Error('No legal choice: ' + title);
  st.prompt = { title, text, kind, task: t.t, options };
}
export function log(st, who, text) {
  st.log.push({ n: ++st.seq, round: st.round, who, text });
}
export function run(st) {
  let guard = 0;
  while (st.stack.length && !st.prompt && !st.over) {
    if (++guard > 10000) throw new Error('Task loop: ' + JSON.stringify(st.stack.at(-1)));
    const task = st.stack.at(-1), handler = H[task.t];
    if (!handler) throw new Error('Unknown task: ' + task.t);
    if (handler(st, task) === DONE) st.stack.splice(st.stack.indexOf(task), 1);
  }
  return st;
}
export function choices(prompt) { return prompt ? prompt.options.filter(o => !o.disabled).map(o => o.v) : []; }
export function answer(st, value) {
  if (st.over || !st.prompt || !choices(st.prompt).some(v => JSON.stringify(v) === JSON.stringify(value))) throw new Error('That choice is not available.');
  st.stack.at(-1).answer = value;
  st.prompt = null;
  return run(st);
}
export function takeAnswer(t) {
  if (!Object.hasOwn(t, 'answer')) return undefined;
  const v = t.answer; delete t.answer; return v;
}
