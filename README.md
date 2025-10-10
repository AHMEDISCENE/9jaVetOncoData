# 9ja VetOncoData

## Data visibility
- **Shared reads:** Authenticated users now see aggregate dashboard, analytics, and feed content across all clinics by default. Optional filters let each user narrow results by clinic, geo-political zone, state, species, tumour type, or date range without restricting the underlying dataset.
- **My clinic filter:** A "My clinic only" toggle applies clinic-scoped filters on demand. It does not change underlying permissions; it simply scopes the shared views to the signed-in clinic when enabled.
- **Secure writes:** Create, update, and delete operations remain limited to the case or post creator and clinic administrators. Read sharing does not affect write restrictions.
- **Feeds:** The global feed lists posts from every clinic, with optional filters for clinic, zone, and state. Pagination keeps responses lightweight while still honouring the shared-read model.
