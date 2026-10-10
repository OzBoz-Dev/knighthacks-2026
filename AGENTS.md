# digiGPU agent and contributor rules

Every engineer and every coding agent (Claude, Codex, Cursor, other tools) follows this page.
Four people build in parallel for 12 hours. The rules keep the merges small, the contract stable,
and the history easy to read.

`prd.md` is the authority for product scope. This page is the authority for how the work gets in.
If the two disagree, stop and ask in the issue.

## Before you write code

1. Read `prd.md` sections 5, 8, and 9.
2. Open the GitHub issue for the task. Do not start an issue whose blockers are still open.
3. Assign the issue to yourself.
4. Edit only the folders that your role owns. The table below shows them.

Give an agent one issue, its exact file paths, and the PRD section per prompt. Run the result and
read the diff before you commit it.

## Folder ownership

The web app is `frontend-digi/`. `prd.md` section 7 uses the same path.

| Path | Owner | Scope label |
|---|---|---|
| `frontend-digi/` (web app) | P1, frontend | `web` |
| `frontend-digi/lib/solana/**`, `frontend-digi/components/solana/**`, `frontend-digi/app/solana-lab/**` | P3, Solana | `solana` |
| `api/` | P2, backend | `api` |
| `databricks/` | P4, Databricks | `databricks` |
| `fixtures/` | P2. P4 adds Databricks exports | `fixtures` |
| `docs/` | P4 | `docs` |
| `prd.md`, `AGENTS.md`, `CLAUDE.md`, `.github/` | Shared | `repo` |

P1 places the components that P3 exports. P1 does not edit their internals.

A change to a shared file needs agreement from the team in the issue first.

## Product rules

- The navigation holds exactly three tabs: Explore, Match, and My Reservations.
- Do not change a frozen type in `prd.md` section 8 without team approval. Change the PRD, the
  TypeScript type, the Go struct, and the fixtures in one pull request.
- Solana uses devnet, Phantom, `@solana/web3.js` v1, Wallet Adapter, and the Memo program only.
  Do not add a transfer, a token, a custom program, or Anchor.
- Databricks does deterministic analytics with SQL and PySpark. Do not add a model.
- The match ranking is deterministic. The same snapshot and the same request give the same order.
- Do not add auth, an ORM, a global state library, or an LLM feature.
- Every screen labels its data source: `Live Vast.ai inventory`,
  `Databricks insights updated at {time}`, or `Saved market snapshot from {time}`.
  Never show fixture data as live.
- Do not invent a number. Every price, percentile, and count comes from Vast.ai or Databricks.

## Security rules

- Keep the Vast.ai key and the Databricks token on the server. Never put them in a
  `NEXT_PUBLIC_` variable or in browser code.
- Never commit `.env`, `.env.local`, or a real key. Commit `.env.example` files with placeholders.
- Send request values to Databricks as named SQL parameters. Never put a request value into a SQL
  string.

## Code rules

Take the first option that fully works:

1. Does it need to exist? Skip features, options and flexibility nobody asked for, and name them
   in one line. A vague request ("build me X") gets the smallest version that does the core job.
2. Already in this codebase (a helper, component, service, pattern)? Use it the way the
   surrounding code does.
3. Standard library or a platform feature? Use it, unless the project has its own. A house
   component beats a native widget.
4. An installed dependency? Use it. Never add a dependency for a few lines.
5. Can it be one line a reader gets at a glance? One line.
6. Otherwise: the minimum code that works.

- Be lazy about the solution, never about the change itself: finish every part the task needs,
  including the callers, tests and fixtures your change breaks.
- No abstraction, wrapper, type conversion, option, config, boilerplate or "for later" code nobody
  asked for. Keep values in the form the platform already gives you. Deletion beats addition.
  Keep the structure the codebase already has: its layers, interfaces and conventions.
- The shortest working diff wins, once you know everything it must touch. A one-liner that needs
  decoding is not short.
- Comment only the why the code cannot show, in one line.
- Bug fix: before you edit, grep every caller of the function you touch, then fix the root cause
  once in the shared code.
- Code you move or merge keeps its error handling and validation.
- Between options of equal size, take the one that is correct on edge cases.
- Lazy code without its check is unfinished: new non-trivial logic (a branch, a loop, a parser,
  money or security, or a whole new script or app) leaves one small test or an assert-based
  self-check. Trivial changes need none.
- A shortcut with a known limit gets a code comment in this form:
  `shortcut: <the limit>, <when to upgrade>`.

Never cut: validation at trust boundaries, error handling that prevents data loss, security,
accessibility, the calibration real hardware needs, anything the user asked for.

## Branches

Branch from `main`. Use the format `<type>/<issue-number>-<slug>`.

```
feat/5-explore-offers-table
fix/12-match-tie-break
chore/1-repo-layout
docs/22-demo-script
```

The type is one of `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `ci`, or `build`.

One branch holds one issue. If an issue is too large for one pull request, split it and say so
in the pull request.

## Commits

Write every commit message as a conventional commit:

```
<type>(<scope>): <subject>
```

```
feat(web): add the offers table to the explore page
fix(api): drop offers that have a nonpositive price
feat(solana): sign the reservation memo on devnet
chore(web): merge main into the explore filters
```

- Use one of the types above and one of the scope labels in the ownership table.
- Write the subject in the imperative present tense: "add the table", not "added the table".
- Start the subject in lower case. Do not end it with a full stop.
- Keep the subject to 72 characters or fewer.
- Make one commit for one logical change. A reviewer reads the commits in order.
- To bring in new work from `main`, merge `main` into your branch. Use the subject
  `chore(<scope>): merge main into the <branch topic>`. Do not rebase a branch that another
  person has pulled.

## Pull requests

Open the pull request into `main`. Write the title as a conventional commit, with the same rules
as a commit subject.

Fill in every section of `.github/pull_request_template.md`:

1. **Summary.** State the problem and the change in two to four sentences.
2. **Commits, in order.** Write one line for each commit. Say what it changes and why.
3. **Linked issue.** Write `Closes #N`. If the pull request covers only part of the issue, write
   `Refs #N`, name the parts it covers, and say what follows in another pull request.
4. **Notes for the reviewer.** State a known limit, a decision, or a file that needs a close look.
5. **Test evidence.** Paste each command and its result. If a check fails, name it and say why.
6. **Checklist.** Tick every box, or say why a box does not apply.
7. **Failure path.** Use a table: the failure, what the user sees, what the log records, and
   whether a retry is safe. Write "No new failure path" when the change adds none.

Add a screenshot for a change to the user interface.

### Reviews and merges

- A pull request does not need a review from a teammate. The assignee of the issue, or an agent
  that works for the assignee, can approve and merge it.
- Merge with a merge commit. Do not squash, so every commit message reaches `main`.
- Merge to `main` at least every 90 minutes. Keep the web app and the API able to start.
- Delete the branch after the merge.

### Parallel agents

An agent can split work across subagents. Each subagent merges its own pull request, so these
rules keep parallel work from breaking `main`:

- Give each subagent its own git worktree and its own branch. One subagent works on one issue.
- Do not let two subagents edit the same file at the same time. If two issues touch one file,
  do them in sequence.
- Do not let a subagent edit a shared file: `prd.md`, the frozen types, `fixtures/`, `AGENTS.md`,
  `CLAUDE.md`, or `.github/`. The person who owns the agent makes those changes.
- Before the merge, merge `main` into the branch and run the checks again. Two branches that pass
  alone can fail together.
- After a set of merges, the person starts the web app and the API and confirms that both run.

### Time rules

- After H7, merge integration fixes only.
- After H9, merge fixes for bugs that break the demo only. Do not change the visual design.

## Checks before you push

Run the checks for each area that your change touches. Paste the results in the pull request.

| Area | Commands |
|---|---|
| `frontend-digi/` | `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` |
| `api/` | `gofmt -l .` (prints nothing), `go vet ./...`, `go test ./...`, `go build ./...` |
| `databricks/` | Run the changed notebook or script, and paste the row counts |

Use `npm ci`, not `npm install`, unless you add a dependency on purpose.

## Writing rules

Two rules apply, by surface.

| Surface | Rule |
|---|---|
| Code comments, commit messages, pull request titles and bodies, files under `docs/` | Simplified Technical English (ASD-STE100) |
| Text a user reads in the app: labels, empty states, errors, explanations | Voice guide |

### Simplified Technical English

- Use one word for one meaning. If a page calls it an "offer", do not call it a "listing" later.
- Use the plain word: "use", not "utilize"; "start", not "commence"; "show", not "surface".
- Keep the articles: "the build fails", not "build fails".
- Keep noun clusters to three words or fewer.
- Write the full form of each verb. Do not use contractions.
- An instruction has 20 words or fewer. A descriptive sentence has 25 words or fewer.
- Write one instruction per sentence, in the imperative. Put a condition first.
- Use the active voice. Name the actor.
- Do not use an "-ing" form as a verb: "the job runs", not "the job is running".
- Use a numbered list for steps in sequence and a bulleted list for items with no order.

### Voice guide

- Speak to the user as "you".
- Contractions are allowed.
- Put the result or the action first, then the reason.
- An error says what happened and what to do next.
- Do not promise what the product does not do. A reservation is a signed intent on devnet. It is
  not a booking and not a payment.

### Characters

These rules apply to every file and every message:

- Do not use an emoji.
- Do not use an em dash or an en dash. Use a comma, a full stop, a colon, or a hyphen.
- An arrow or another symbol that shows as text is allowed.

## Area rules

- `frontend-digi/AGENTS.md` holds the Next.js and UI rules for the web app. Read it before you
  edit `frontend-digi/`. This Next.js version has breaking changes.
- Load the Solana wallet provider in a client component with SSR disabled.
- `api/` is a Go service. `prd.md` section 7, Backend stack, names the libraries. Use the
  standard library first. Run `go mod tidy` after you add or remove an import.
- Build the canonical reservation payload from a map, as `prd.md` section 8 says. A struct
  keeps its field order, so its hash differs.
