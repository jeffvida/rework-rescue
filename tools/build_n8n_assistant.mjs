// Builds n8n/rework-assistant.json, the importable n8n workflow behind the website's chat assistant.
// Run: node tools/build_n8n_assistant.mjs   (after changing src/assistant/rules.js, then re-import in n8n)
//
// Flow: Webhook -> Check request -> OK? -> AI reply (Gemini or OpenAI) -> Check reply -> Respond to the page -> Log to Google Sheet.
// The Code nodes get the same rules the tests cover (tests/assistant.test.mjs), copied in as plain JavaScript.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Which AI service answers. 'gemini' = Google Gemini free tier (no card needed; Google may use free-tier chats
// to improve its products, which the privacy page says). 'openai' = paid OpenAI API (not used for training).
// To switch: change PROVIDER, rebuild, re-import, add that provider's key (see n8n/ASSISTANT-SETUP.md), and
// update the privacy page and ASSISTANT_TEXT.disclaimer in src/assistant/rules.js.
const PROVIDER = 'gemini';
// The model. It must support JSON output with a schema. If it's retired, change it here, rebuild and re-import.
const MODEL = PROVIDER === 'gemini' ? 'gemini-3.5-flash-lite' : 'gpt-4.1-mini';
const AI_NODE = PROVIDER === 'gemini' ? 'Gemini: reply' : 'OpenAI: reply';
// Which websites may call the webhook from a browser. '*' while you test on Vercel preview links;
// once live, change it to https://rework-rescue.vercel.app (or your own domain).
const ALLOWED_ORIGINS = 'https://rework-rescue.vercel.app'; // live since 1 Nov 2026; use '*' to test on preview links
// The assistant log sheet ("assitant-log-header"): https://docs.google.com/spreadsheets/d/<this id>/edit
const LOG_SHEET_ID = '1ZQaxVtJG4vOeLb3y52-tZh1_XULh7tmv2NdDhTo_L1c';

const LIB = readFileSync(join(root, 'src/assistant/rules.js'), 'utf8')
  .split('\n').filter((l) => !/^import\s/.test(l)).join('\n')
  .replace(/^export\s+/gm, '');

const noStore = { responseHeaders: { entries: [{ name: 'Cache-Control', value: 'no-store' }] } };
const id = (n) => `8e1c2d3f-${String(n).padStart(4, '0')}-4b62-8a2e-7f2d0000${String(n).padStart(4, '0')}`;

const nodes = [
  {
    id: id(1), name: 'Setup notes', type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position: [-300, -300],
    parameters: {
      width: 620, height: 400,
      content: [
        '## Rework Rescue assistant',
        'Full steps: n8n/ASSISTANT-SETUP.md in the website repo.',
        PROVIDER === 'gemini'
          ? '1. **Gemini: reply** → create a **Header Auth** credential: Name `x-goog-api-key`, Value = your Google AI Studio API key.'
          : '1. **OpenAI: reply** → pick or create an **OpenAI** credential (your API key).',
        '2. **Log to Google Sheet** → pick your Google Sheets credential and the assistant log sheet.',
        '3. Save, switch the workflow to **Active**, copy the **Production URL** from **Assistant request**.',
        '4. Put it in `site-config.js` as `assistantUrl`, on a branch, and test on the Vercel preview.',
        '',
        `AI: ${PROVIDER}, model ${MODEL}. Rules and limits live in src/assistant/rules.js; rebuild with node tools/build_n8n_assistant.mjs.`,
        'Successful runs are not saved (they contain what visitors typed). Failed runs are.',
      ].join('\n'),
    },
  },
  {
    id: id(2), name: 'Assistant request', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [-300, 180],
    webhookId: '6b7d3e1f-5d2c-4f9b-8b62-3c8e00000b01',
    parameters: { httpMethod: 'POST', path: 'rr-assistant', responseMode: 'responseNode', options: { allowedOrigins: ALLOWED_ORIGINS } },
  },
  {
    id: id(3), name: 'Check request', type: 'n8n-nodes-base.code', typeVersion: 2, position: [-60, 180],
    parameters: {
      jsCode: `${LIB}
// ---- workflow step: check the message, then today's limits (only a short hash of the IP is kept, for today)
const req = $input.first().json;
const checked = checkRequest(req.body);
if (!checked.ok) return [{ json: checked }];
const ip = String((req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip'])) || '').split(',')[0].trim();
if (!takeDailyAllowance($getWorkflowStaticData('global'), ip)) {
  return [{ json: { ok: false, code: 'daily_limit', notice: 'The assistant is resting for today. You can still book a free report review below.' } }];
}
return [{ json: { ...checked, ai: ${PROVIDER === 'gemini' ? 'buildGeminiRequest(checked)' : `buildOpenAiRequest(checked, ${JSON.stringify(MODEL)})`} } }];`,
    },
  },
  {
    id: id(4), name: 'Request OK?', type: 'n8n-nodes-base.if', typeVersion: 2, position: [180, 180],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ id: 'd2b00000-0000-4000-8000-000000000001', leftValue: '={{ $json.ok === true }}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and',
      },
      options: {},
    },
  },
  {
    id: id(5), name: 'Notice', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [420, 380],
    parameters: {
      respondWith: 'json',
      responseBody: "={{ JSON.stringify({ reply: $json.notice, stage: 'notice', service: null, serviceLabel: '', bookService: '', showBooking: $json.code !== 'too_short' && $json.code !== 'too_long' }) }}",
      options: { responseCode: "={{ $json.code === 'bad_request' ? 400 : 200 }}", ...noStore },
    },
  },
  {
    id: id(6), name: AI_NODE, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [420, 160],
    // A failed or slow call (including a used-up free quota) must still answer the visitor:
    // the next step turns it into the fallback reply.
    onError: 'continueRegularOutput',
    parameters: PROVIDER === 'gemini' ? {
      method: 'POST', url: `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
      sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.ai) }}',
      options: { timeout: 20000 },
    } : {
      method: 'POST', url: 'https://api.openai.com/v1/chat/completions',
      authentication: 'predefinedCredentialType', nodeCredentialType: 'openAiApi',
      sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.ai) }}',
      options: { timeout: 20000 },
    },
  },
  {
    id: id(7), name: 'Check reply', type: 'n8n-nodes-base.code', typeVersion: 2, position: [660, 160],
    parameters: {
      jsCode: `${LIB}
// ---- workflow step: validate the model's JSON, block prices and promises, enforce the question limit
const asked = $('Check request').first().json;
const raw = modelText($input.first().json);
const done = finishReply(raw, asked.questionsAsked);
return [{ json: { ...done, row: logRow({ ...done, questionsAsked: asked.questionsAsked, messageCount: asked.messageCount, conversationId: asked.conversationId }) } }];`,
    },
  },
  {
    id: id(8), name: 'Reply to the page', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [900, 160],
    parameters: { respondWith: 'json', responseBody: '={{ JSON.stringify($json.response) }}', options: noStore },
  },
  {
    id: id(9), name: 'Sheet row', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1140, 160],
    parameters: { jsCode: "return [{ json: $('Check reply').first().json.row }];" },
  },
  {
    id: id(10), name: 'Log to Google Sheet', type: 'n8n-nodes-base.googleSheets', typeVersion: 4.5, position: [1380, 160],
    // The visitor already has their answer; a logging problem must not show up for them.
    onError: 'continueRegularOutput',
    parameters: {
      operation: 'append',
      // The assistant log sheet, kept here so a re-import doesn't clear it. Sheet ID 0 is the first tab.
      // Operation must stay "append" (Append Row); "Get Row(s)" would only read the sheet.
      documentId: { __rl: true, value: LOG_SHEET_ID, mode: 'id' },
      sheetName: { __rl: true, value: '0', mode: 'id' },
      columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], schema: [] },
      options: {},
    },
  },
];

const link = (to) => ({ node: to, type: 'main', index: 0 });
const connections = {
  'Assistant request': { main: [[link('Check request')]] },
  'Check request': { main: [[link('Request OK?')]] },
  'Request OK?': { main: [[link(AI_NODE)], [link('Notice')]] },
  [AI_NODE]: { main: [[link('Check reply')]] },
  'Check reply': { main: [[link('Reply to the page')]] },
  'Reply to the page': { main: [[link('Sheet row')]] },
  'Sheet row': { main: [[link('Log to Google Sheet')]] },
};

const workflow = { name: 'Rework Rescue: website assistant', nodes, connections, settings: {
  executionOrder: 'v1',
  // Privacy: don't keep a record of runs that worked (they contain what visitors typed). Failed runs are kept so problems can be fixed.
  saveDataSuccessExecution: 'none', saveManualExecutions: false, saveDataErrorExecution: 'all',
}, pinData: {} };
mkdirSync(join(root, 'n8n'), { recursive: true });
writeFileSync(join(root, 'n8n/rework-assistant.json'), `${JSON.stringify(workflow, null, 2)}\n`);
console.log(`n8n/rework-assistant.json: ${nodes.length} nodes, ${PROVIDER} model ${MODEL}`);
