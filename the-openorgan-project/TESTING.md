# Testing Checklist

Use separate browser profiles for an organist, an organization, and the administrator.

## Build

```powershell
npm install
npm run check
npm run build
npm run dev
npm run test:smoke
```

## Public

- Homepage, logo, favicon, About, and footer
- Unique page titles and descriptions
- `/sitemap.xml` and `/robots.txt`
- Search list/map desktop layout and mobile toggle
- Map marker/card synchronization
- Bold unclaimed labels
- Distance ranking after location permission
- Organ and event detail maps
- Newest/oldest event ordering

## Organist

- Register and log in
- Edit photo, bio, level, years, age range, and email visibility
- Submit a practice request
- Read approval/rejection notes
- Collapse and expand decided reservations
- Propose a modification and receive its result
- Mark an ended approved session complete
- Receive a friendly already-completed message if the host completed first
- Rate the organ and leave a public comment
- Ask questions and receive unread answer indicators
- Sign up for optional/required events and cancel signup

## Organization

- Register and save profile/administrator photos
- Confirm official-domain email code
- Remain unable to publish before manual verification
- Create draft organ and event
- After approval, publish and enable booking
- Verify private access notes do not appear in the public organ document
- Approve/reject a reservation and leave/edit a note
- Review the complete organist trust profile
- Propose/approve/reject reservation modifications
- Mark session complete and leave overall rating, would-host-again, and comment
- Answer a question and open the asker’s profile
- View event signups

## Administrator

- Add the existing Firebase UID to `OPENORGAN_ADMIN_UIDS`
- Open `/admin/verifications`
- Approve and reject test organizations
- Open `/admin/claims`
- Approve a claim only for a verified organization
- Confirm the claimed organ becomes an owner draft with booking disabled

## Security checks

- Unauthenticated Firestore read cannot retrieve `organPrivate`
- Another organization cannot edit an organ, private note, event, reservation, question, or claim
- An unverified organization cannot publish active content
- An unclaimed organ cannot receive a reservation
- A review cannot be submitted before completion
- Each reservation produces at most one organ review and one user review
