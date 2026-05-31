# Firestore Security Specs (Torqued Application)

## Data Invariants
1. A booking must be strictly associated with its creator's authenticated UID (`customerUid == request.auth.uid`).
2. Private consumer information inside `/consumers/{userId}` must reside under strict owner-only read/write privileges.
3. A mechanic's profile is queryable by any customer but editable only by the authed mechanic with the matching UID.
4. License plate lookups are public for reading, but creating and updating is authenticated as either a customer or a mechanic.

## The "Dirty Dozen" (12 Vulnerability Payloads)

1. **Identity Spoofing in Bookings**: Creating a booking document claiming the `customerUid` is someone else's UID.
2. **Unauthorized Metadata Update inside Mechanics**: A user updates a mechanic profile belonging to a different worker.
3. **Privilege Escalation**: Attempting to alter billing status (`subscriptionActive`) inside a mechanic profile without permissions.
4. **Blanket Consumers Retrieval**: Querying multiple customer profiles without scope limitation.
5. **Dangling Booking Deletion**: A mechanic trying to delete a customer's booking document.
6. **Malicious ID Poisoning**: Trying to create a mechanic path using invalid character ids (e.g. `../inject/override`).
7. **Bypassing Signature Lock**: Attempting to query another mechanic's incoming queue from your own dashboard.
8. **Malicious Vehicle Record Override**: Trying to inject false mileage or plate records anonymously.
9. **Rogue Stripe ID Modification**: Modifying the `stripeSubscriptionId` on a mechanic profile to steal subscriptions.
10. **State Skipping in Diagnostics**: Marking a booking as `confirmed` without paying.
11. **PII Leakage on Profile Read**: Searching and fetching private details of any consumer.
12. **Denial of Wallet Recursion**: Hammering the firestore with unauthenticated database lookup calls.
