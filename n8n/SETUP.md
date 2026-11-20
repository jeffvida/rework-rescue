# Booking setup (n8n + Google Calendar)

The booking pop-up on the site talks to one n8n workflow: `rework-review-booking.json`.

- **Availability** (`GET …/webhook/rr-availability`): reads your Google Calendar free/busy times and returns the open 30-minute slots.
- **Booking** (`POST …/webhook/rr-book`): checks the request, checks the slot is still free, creates the event with a Google Meet link and a private change/cancel link, emails the visitor the invite, emails you, and adds a row to your bookings Google Sheet.
- **Change or cancel** (`POST …/webhook/rr-manage`, since 20 Nov 2026): the visitor's private link (`/#booking=KEY`) looks the booking up, moves the same event (same Meet link, Google sends the updated invite) or cancels it. You get an email and the sheet row is updated.
- **Every 10 minutes**: reads your calendar and the bookings sheet, sends reminders that are due, and keeps the sheet in step when you move or cancel a review in Google Calendar, or the visitor declines the invite.

Bookable hours, notice period and limits live in `src/booking/slots.js` and `src/booking/check.js`.
After changing either, run `node tools/build_n8n.mjs` and re-import the workflow.

## One-time setup

1. **Block your day-job hours in Google Calendar** (a recurring "Busy" event is enough). The workflow offers any free time inside the booking hours, so anything not blocked can be booked.
2. In n8n: **Workflows → Import from file** → choose `n8n/rework-review-booking.json`.
3. Open **Google: busy times**. Under *Credential for Google Calendar OAuth2 API*, choose **Create new credential** and sign in with jeffhersonvida@gmail.com. Then select that same credential in **Google: is it still free?** and **Google: create event + invite**.
4. Open **Email Jeff**. Create a **Gmail OAuth2** credential with the same Google account.
5. **Every other Google, Email and sheet node** (change/cancel and the 10-minute reminder check): pick the same Google Calendar, Gmail and Google Sheets credentials. A node without a credential shows a red warning.
6. **Bookings sheet.** In Google Sheets, create a new spreadsheet (for example "Rework Rescue bookings"). Import `n8n/bookings-sheet-headers.csv` into it (File → Import → Upload → *Replace current sheet*), so row 1 holds the column headers. Then in n8n open **Log to Google Sheet**, create a **Google Sheets OAuth2** credential with the same Google account, The Document and Sheet fields are already set to the bookings sheet (its first tab); only pick the credential. Don't rename the headers: n8n matches them by name.
7. **Save**, then switch the workflow to **Active** (top right).
8. Open **Availability request** and **Booking request**, switch to the **Production URL** tab and copy each URL.
9. Put them in `site-config.js` as `bookingAvailabilityUrl` and `bookingRequestUrl`, on a branch, and check the Vercel preview.
10. After the site is live, set **Allowed Origins (CORS)** in both Webhook nodes to `https://rework-rescue.vercel.app` (or your own domain later). It is `*` so preview links work while testing.

## Checking it

- Open the availability Production URL in a browser: you should see `{"slots":[…],"minutes":30}`.
- Book a test slot on the preview with your own second email address. You should get the invite, and the event should be in your calendar. Delete the test event afterwards.
- If something fails, open **Executions** in n8n. Successful runs aren't kept (they contain visitors' details); failed runs are.

## Letting an email book again (reset link)

Each email can hold one upcoming review, and n8n remembers bookings itself, separately from the calendar and the sheet. To let an email book again (after testing, or when someone cancels):

1. Once, in n8n: open **Reset request**, set *Authentication* to **Basic Auth**, and create a credential with a username and a long password only you know. Save.
2. Open the node's **Production URL** in your browser and add `?email=` and the address, for example
   `https://<your-n8n>/webhook/rr-forget?email=someone@example.com`
   (or `?email=all` to clear every remembered booking). The browser asks for the username and password, then shows how many it cleared.

This doesn't delete the calendar event or the sheet row; remove those yourself if needed.

## The bookings sheet

One row per booking: when it was booked and the review time (both Philippine time), the review time in UTC, name, email, company, report or process, visitor's time zone, Find Your Rework result, Meet link, calendar link, and **Status**. Status starts as *Booked*. Visitors' text starting with = + - or @ is saved with a leading apostrophe so Sheets never runs it as a formula.

The workflow updates **Status** and the review times itself: *Rescheduled* (moved by the visitor or by you in Google Calendar), *Cancelled* (cancelled by the visitor, or the event deleted in your calendar), *Declined* (the visitor declined the invite). It finds the row by its **Calendar link**, so don't edit that column. Set *Done*, *No-show* or *Project* yourself after the review. Delete rows for inquiries that didn't lead to a project within 12 months of your last contact (the privacy notice promises this).

## Changing or cancelling (visitor)

- The invite and both reminders carry a private link: `https://rework-rescue.vercel.app/#booking=KEY`.
- Up to 2 changes per booking (`CHANGE_RULES` in `src/booking/manage.js`); new times follow the normal booking rules (12 hours' notice, 28 days ahead). Cancelling works until the review starts.
- A cancelled booking frees the visitor's email, so they can book again without the reset link.
- `/#booking=preview` shows the screens with a sample booking and changes nothing.

## Reminders

**Every 10 minutes** reads the calendar. For each booking it sends the 1-day reminder (between 24 and 2 hours before; skipped if the booking or the last move was made less than a day ahead) and the 1-hour reminder (between 60 and 10 minutes before), always for the event's **current** time. Before each email it marks the event, so a reminder is never sent twice. Declined or cancelled reviews get none. Bookings made before 20 Nov 2026 are picked up from their sheet row and reminded too (their emails say "reply to this email" instead of the link).

Keep the workflow **Active**. Text lives in `reminderEmail()` in `src/booking/check.js`; timing in `sweepReminders()` in `src/booking/manage.js`.

## Limits built in

- One upcoming review per email address.
- At most 6 new bookings in any 24 hours.
- 12 hours' minimum notice, up to 28 days ahead.
- A hidden "website" field catches simple bots; they get an "ok" answer and nothing is booked.
