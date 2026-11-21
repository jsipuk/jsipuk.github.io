# Lowbridge project instructions

Implement the requested milestone as a playable increment. Start with [the build board](docs/05-build-board.md). The designer-facing brief is [game design](docs/01-game-design.md). Match IDs and branch meanings in [the first-job fixture](fixtures/riverside-first-job.json).

- Inspect the existing repository, its package manager, commands and local instructions before editing. For a standalone project use the defaults in [the technical plan](docs/04-technical-plan.md). In a shared website repository keep the game inside its own directory.
- Target iPhone Safari touch first. Keep keyboard support so a coding agent can exercise the same actions on desktop. Use local, original placeholders until the greybox passes.
- Keep progression rules testable without rendering. Commit quest rewards and their world changes together. Match every claim of “tested on iPhone” to an actual device session.
- Prefer a small coherent change over scaffolding for future content. Reuse existing tooling and keep runtime dependencies local to the project. There is no server requirement for the planned campaign.
- Report the build command, checks performed, known issues and the next ticket. A local preview is the default delivery. Production publishing is a separate release step.
- When implementation and the spec diverge, record the chosen behaviour and reason in the relevant document. Preserve the player's earned progress across updates.
