## Approach to code changes

Before editing:
- Read the relevant implementation and trace its callers and data flow.
- Identify affected contracts, tests, fixtures, configuration and exports.
- Look for existing helpers, components and patterns that solve the problem.

When implementing:
- Follow project conventions and reuse existing capabilities.
- Prefer standard-library/platform features and installed dependencies over
  custom implementations. If a widely adopted industry-standard alternative
  would be a better fit, suggest it and explain the trade-offs before adding
  or replacing dependencies.
- Do not introduce speculative features or layers of indirection.
- Keep code readable and address the root cause.
- Preserve validation, security, accessibility and data-loss protection.

Before finishing:
- Update affected integration points. Verify changed behavior with focused
  tests or relevant checks, proportionate to the scope and risk of the change.
  For bug fixes, add a regression test when practical.
- State what was checked, what remains unchecked and any material risks.
- For deliberate shortcuts, document the limitation and when to revisit it.
