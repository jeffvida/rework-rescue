# Assistant update, 15 Nov 2026 (v2): websites, landing pages and customer trackers

Only the two Code nodes change. Do not import a new workflow. The Gemini credential, the Google Sheet log,
the webhook, the settings and the Active switch all stay as they are.

The website and these two nodes must go live together. Paste them right after you say "push it live", not before.
If you paste early, the live chat starts offering websites while the live page doesn't.

## Steps (in n8n, workflow "Rework Rescue: website assistant")

1. Before changing anything, open **Check request**, select all the code, copy it and save it in a text file
   called `backup-check-request.js`. Do the same for **Check reply** (`backup-check-reply.js`).
   This is your undo.
2. Open **Check request** → select all the code → delete → paste the whole of `check-request.js` from this folder.
3. Open **Check reply** → select all → delete → paste the whole of `check-reply.js` from this folder.
4. Click **Save**. Leave the workflow **Active**. Don't change any other node.

To undo: paste the two backup files back into the same nodes and save.

Leave the other folder, `n8n/paste-2026-11-15`, unused: these files replace it.

## What changed in the code

- New wording and knowledge: it is a virtual assistant that answers questions, covers websites, landing pages,
  enquiry forms and customer trackers, and is honest about what Jeff doesn't do (online stores, enterprise
  CRM, custom software and web apps).
- It gives your agreed website answer word for word.
- It offers the booking only when it helps, not after every answer.
- The AI now returns one extra yes/no field, `web_or_tracker`. The code still sends the same `systems` service
  code to the page. The log sheet's Service column then reads "Websites, landing pages and customer trackers",
  and the booking pop-up preselects that option.
- The page receives the same fields as before. The log sheet has the same columns.

## Test right after pasting (on the live site)

| # | Type this | It should |
|---|-----------|-----------|
| 1 | Can you build a simple website for my plumbing business? | Say yes (the agreed answer), with no price |
| 2 | Can you build an online store? | Say kindly that complex online stores aren't offered, and may mention a simple website instead |
| 3 | I need a simple CRM to track customer enquiries. | Say yes. If a Book button shows, the booking pop-up preselects "Websites, landing pages and customer trackers" |
| 4 | My staff spend too much time copying information between spreadsheets. | Answer, then ask at most one question |
| 5 | Can you help automate our follow-ups? | Say yes and explain simply. It shouldn't push the booking straight away |
| 6 | How much will it cost? | Explain the written price after the free review, with no numbers |
| 7 | Are you a real person? | Say it's an AI-powered assistant and that Jeff handles project discussions |
| 8 | Can you book a meeting for me? | Say it can't book, point to the "Book a free review" button, and show the button |

Then check the log sheet. Test 3 should show the Service "Websites, landing pages and customer trackers".
