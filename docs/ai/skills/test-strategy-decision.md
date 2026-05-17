Name: test-strategy-decision

Use when:
- adding tests for a new feature,
- deciding what kind of test to write,
- deciding unit vs integration vs end-to-end coverage,
- deciding what needs regression protection before or after a change,
- planning tests before implementation in a TDD/TTD workflow.

Goal:
Choose the smallest effective test strategy that protects behaviour, catches likely regressions, and stays maintainable.

Core rules:
- Test behaviour, not implementation trivia.
- Prefer the lowest test layer that gives meaningful confidence.
- Use unit tests for isolated logic and branching behaviour.
- Use integration tests when behaviour depends on component interaction, data flow, persistence, or API boundaries.
- Use end-to-end tests sparingly for critical user journeys, not routine logic.
- Add or extend tests near existing patterns rather than inventing a new style.
- Do not over-mock behaviour that should be verified through a real boundary.
- Do not write broad slow tests when a focused cheaper test would prove the same thing.

Checks:
- What behaviour is changing?
- What is the most likely regression?
- What is the cheapest test that would catch it?
- Does this require a real boundary such as API, database, or UI interaction?
- What still requires manual verification?

Output:
1. Recommended test type or mix.
2. Main behaviours to verify.
3. What to mock and what not to mock.
4. Any manual verification still needed.
5. Which test files or areas should change.