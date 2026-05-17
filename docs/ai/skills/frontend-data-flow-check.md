Name: frontend-data-flow-check

Use when:
- frontend code transforms or reshapes server data,
- multiple components consume the same server-backed data,
- query/cache logic, view models, and presentation logic are mixing together,
- client-side state starts mirroring API state inconsistently.

Goal:
Keep data fetching, transformation, caching, and presentation boundaries coherent.

Core rules:
- Keep server data retrieval in the data/query layer.
- Avoid duplicating API data in local component state unless there is a clear editing or interaction reason.
- Prefer a single transformation point for shared derived data.
- Keep view-specific shaping close to the view, but keep reusable domain shaping out of leaf components.
- Do not let UI convenience drive accidental API or schema distortion.

Checks:
- Where is the source of truth for this data?
- Where is the transformation happening?
- Are multiple components deriving the same shape differently?
- Is this server state, client interaction state, or presentational formatting?

Output:
1. Recommended data flow boundary.
2. Where fetching, transformation, and presentation should live.
3. Current or potential duplication risks.
4. Whether API or schema reconsideration is needed.