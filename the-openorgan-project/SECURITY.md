# Security Notes

- Firestore reads return complete documents. Private door codes, key locations, and internal instructions are stored in `organPrivate/{organId}`, never in publicly readable `organs/{organId}`.
- Public Google Maps browser keys must have HTTP-referrer and API restrictions.
- The Google Routes/Places server key, Resend key, Firebase service account, and administrator UID list must remain server-only secrets.
- Organization domain-email verification does not itself grant publication rights. Manual administrator approval is still required.
- Unclaimed source listings cannot accept booking, payment, Q&A, or reviews.
- Reservation completion uses a transaction. A second completion attempt does not increment the trust counter.
- Review document IDs equal reservation IDs, preventing duplicate reviews for the same completed session.
- Contact email visibility is opt-in, requires a signed-in reader, and is stored separately in `publicContacts`. Reservation documents do not contain email snapshots.
- Back up Firestore before running migration or import scripts.
