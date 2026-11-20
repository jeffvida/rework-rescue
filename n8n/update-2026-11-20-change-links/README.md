# Booking update, 20 Nov 2026: change/cancel links and the 10-minute reminder check

Your live workflow: https://n8n-production-cf1c.up.railway.app/workflow/fK3vgZsF5DQ3OK3p
The file to import: `n8n/rework-review-booking.json` (55 nodes).

**Order:** the website goes live first ("push it live"), then you import this into n8n. Until the import, the old
workflow keeps running as before. New invites only get the change link after the import.

## 1. Before you start (2 minutes)

1. In n8n, open the workflow and click **⋯ → Download**. Keep that file: it's your undo.
2. Open **Executions** and filter by **Waiting**. These are reminders the old version is still holding.
   Write down how many there are. After the import, step 3.5 stops them, and the new 10-minute check
   sends their reminders instead (it finds them through the bookings sheet).

## 2. Import into the same workflow (keeps the same webhook addresses)

1. Open the workflow. Click an empty spot on the canvas, press **Ctrl+A**, then **Delete**.
2. Open `rework-review-booking.json` from GitHub (**Raw**), select all, copy, click the empty canvas and press **Ctrl+V**.
3. Click **Save**. Don't create a new workflow: the webhook addresses and the saved booking limits stay with this one.

## 3. Credentials (each node with a red warning)

Open each node below and pick the existing credential from the dropdown (no new ones needed):

- **Google Calendar OAuth2** (HTTP Request nodes): Google: busy times · Google: is it still free? · Google: create event + invite ·
  Google: find the booking · Google: is the new time free? · Google: move the event · Google: cancel the event ·
  Google: upcoming events · Google: update the event
- **Gmail OAuth2**: Email Jeff · Email Jeff: sheet problem · Email Jeff: change · Email Jeff: sheet update problem · Email: reminder
- **Google Sheets OAuth2**: Log to Google Sheet · Update the sheet row · Read the bookings sheet · Sweep: update the sheet
- **Basic Auth**: Reset request (the same username/password credential as before)

Then:

4. **Save**, and make sure the workflow is **Active**.
5. Back in **Executions → Waiting**: stop each waiting run from the old version (open it → **Stop**).
   Otherwise those bookings could get a reminder twice.

## 4. Test (10 minutes)

1. Book a review on the live site with your second email address, at least a day ahead.
2. The invite should include "Need a different time? Change or cancel here: …#booking=…".
3. Open that link. You should see "Hi …, your review is booked for …".
4. **Pick a new time** → **Move my review**. Check: the calendar event moved (same Meet link), your second address got
   the updated invite, you got "Review moved: …", and the sheet row shows the new time and *Rescheduled*.
5. Open the link again → **Cancel the review** → **Yes, cancel it**. Check: the event is gone, the cancellation email
   arrived, you got "Review cancelled: …", the sheet says *Cancelled*, and you can book again with that address.
6. In **Executions**, runs of **Every 10 minutes** appear as successful (or not at all, since successful runs aren't kept).
   A failed one shows in red; open it to see why.

To see the screens without a booking: https://rework-rescue.vercel.app/#booking=preview (nothing is changed).

## Undo

Delete everything on the canvas, paste the file you downloaded in step 1.1, pick credentials, save, keep Active.
Change links already sent would then show "Your booking couldn't be changed right now" with an email option.
