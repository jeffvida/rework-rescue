# Booking setup (n8n + Google Calendar)

The booking pop-up on the site talks to one n8n workflow: `rework-review-booking.json`.

- **Availability** (`GET …/webhook/rr-availability`): reads your Google Calendar free/busy times and returns the open 30-minute slots.
- **Booking** (`POST …/webhook/rr-book`): checks the request, checks the slot is still free, creates the event with a Google Meet link, emails the visitor the invite, then emails you.

Bookable hours, notice period and limits live in `src/booking/slots.js` and `src/booking/check.js`.
After changing either, run `node tools/build_n8n.mjs` and re-import the workflow.

## One-time setup

1. **Block your day-job hours in Google Calendar** (a recurring "Busy" event is enough). The workflow offers any free time inside the booking hours, so anything not blocked can be booked.
2. In n8n: **Workflows → Import from file** → choose `n8n/rework-review-booking.json`.
3. Open **Google: busy times**. Under *Credential for Google Calendar OAuth2 API*, choose **Create new credential** and sign in with jeffhersonvida@gmail.com. Then select that same credential in **Google: is it still free?** and **Google: create event + invite**.
4. Open **Email Jeff**. Create a **Gmail OAuth2** credential with the same Google account.
5. **Save**, then switch the workflow to **Active** (top right).
6. Open **Availability request** and **Booking request**, switch to the **Production URL** tab and copy each URL.
7. Put them in `site-config.js` as `bookingAvailabilityUrl` and `bookingRequestUrl`, on a branch, and check the Vercel preview.
8. After the site is live, set **Allowed Origins (CORS)** in both Webhook nodes to `https://rework-rescue.vercel.app` (or your own domain later). It is `*` so preview links work while testing.

## Checking it

- Open the availability Production URL in a browser: you should see `{"slots":[…],"minutes":30}`.
- Book a test slot on the preview with your own second email address. You should get the invite, and the event should be in your calendar. Delete the test event afterwards.
- If something fails, open **Executions** in n8n. Successful runs aren't kept (they contain visitors' details); failed runs are.

## Limits built in

- One upcoming review per email address.
- At most 6 new bookings in any 24 hours.
- 12 hours' minimum notice, up to 28 days ahead.
- A hidden "website" field catches simple bots; they get an "ok" answer and nothing is booked.

Every availability check and booking counts as an n8n execution, so keep an eye on your n8n Cloud plan's monthly limit.
