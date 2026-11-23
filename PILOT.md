# Single-form delivery pilot

Before testing, record written authorization, the exact form URL, the intended mailbox or CRM, the confirmation contact, test window, and the approved synthetic payload. Agree how to handle duplicate lead alerts and whether the agency should remove the synthetic records afterward.

| Case | Browser result | Test ID | Destination result | Evidence |
| --- | --- | --- | --- | --- |
| Desktop valid | Pending | Assign unique ID | Unverified | Screenshot and recipient record reference |
| Mobile layout valid | Pending | Assign unique ID | Unverified | Screenshot and recipient record reference |
| Required field missing | Pending | Assign ID if sent | Unverified if sent | Screenshot and whether a submission occurred |

Use synthetic inquiries labeled `TEST – NO FOLLOW-UP`. Keep a running submission count across initial testing and retest, with a total cap of five submissions. Record the recipient confirmation timestamp, matching test ID and an approved redacted record reference. A frontend acknowledgement alone leaves delivery unverified. Keep customer evidence out of the repository.

Prioritize fixes that restore the route to the agreed destination. If delivery remains unverified, ask the agency to check routing, provider events and CRM ingestion. If invalid input reaches the destination, prioritize required-field enforcement. Record one retest with fresh IDs after the agency implements fixes. Repairs, CAPTCHA bypass and load testing are outside the pilot scope.
