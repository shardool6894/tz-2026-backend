# Participant identities

Deploy with frontend branch `codex/participant-ids-roll-numbers`.

`POST /api/auth/register` accepts `rollNumber` for a NITW account (identified by its email domain). Every `teamMembers` entry now requires `name` and `studentType` (`nitw` or `external`). NITW members must also supply `rollNumber`; this allows mixed-institution teams.

The server assigns `participantId` to the leader and every member. NITW IDs are normalized roll numbers, stored as strings to preserve leading zeroes. Outsider IDs use `26TZ` plus 4 random uppercase alphanumeric characters (8 characters total, e.g. `26TZA7K2`). Client-supplied participant IDs are ignored. Roll numbers accept 3–32 letters, digits, or hyphens.

The User document stores the leader's `studentType`, `rollNumber`, and `participantId`; every embedded member has the same fields. The existing `registrationNum` stays unchanged. A private `participantIds` array and unique sparse multikey index enforce uniqueness across leaders and team members in different registrations; duplicates within one request are also rejected. Random outsider-ID collisions retry the database insert up to five times; NITW roll conflicts still return 409. Ensure the declared index on `users.participantIds` is created when deploying (Mongoose auto-indexing or the normal database index deployment process).

Registration returns a `participants` array with `name`, `studentType`, `rollNumber`, and `participantId` for the receipt screen. Login, `/api/users/me`, and event-registration exports include the stored IDs. Invalid rolls return 400; a duplicate participant ID returns 409. Verification and resend requests never regenerate IDs.

Existing registrations require no backfill and keep their previous registration numbers. Identity fields may be absent on them. New frontend and backend code must be deployed together because new team registrations require institution types.

Run focused tests without a database or email service:

```sh
node --test test/participantIdentity.test.js test/authParticipantIdentity.test.js
```
