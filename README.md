<div align="center">

# ReviseHub

**Code review for any public GitHub repository — that works with no API key at all.**

Finds leaked credentials, vulnerable dependencies, and O(n²) loops using deterministic
rules. AI is a second, optional layer for what rules genuinely cannot express.

[**Live demo →**](https://revisehub-beryl.vercel.app)

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Tests](https://img.shields.io/badge/tests-68%20passing-34D399)](#testing)
[![License](https://img.shields.io/badge/license-MIT-A78BFA)](LICENSE)

</div>

<!--
  SCREENSHOTS — add these for a much stronger first impression.
  Create a `docs/` folder, drop the images in, then delete this comment block.

  |  |  |
  | :--: | :--: |
  | ![Security](docs/security.png) | ![Efficiency](docs/efficiency.png) |
  | Dependency CVEs and repository health | Efficiency grading with an AI rewrite |
-->

---

## The problem

Most "AI code review" tools stop working the moment the API key fails — rate limits,
quota exhaustion, a retired model. The analysis and the language model are the same
component, so when one breaks, everything breaks.

ReviseHub separates them.

```
                ┌─> Analysis engine  (deterministic, no key)  ─┐
GitHub data ────┤                                              ├──> findings
                └─> AI layer         (Gemini, optional)       ─┘
```

The engine always runs. The AI layer enhances it when a key is available, and steps
aside when it is not.

---

## What the engine finds

No API key. Same input, same output, every time. Labelled **Verified rule** in the UI.

| Rule group       | Finds                                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Secrets**      | AWS, Google, GitHub, Slack, Stripe, OpenAI and Anthropic keys, JWTs, private keys, and database URLs with passwords — added in a diff. The matched value is always redacted.                      |
| **Dependencies** | Known CVEs in `package.json` via [OSV.dev](https://osv.dev) — real advisory IDs, severity, and the version that fixes it. Dev dependencies rank below runtime ones.                               |
| **Efficiency**   | Nested loops, a linear scan inside a loop, `await` in a loop, spread accumulation, sorting or building a regex in a loop, `JSON.parse(JSON.stringify())` cloning. Scored 0–100 with an A–F grade. |
| **Complexity**   | Cyclomatic complexity, function length, nesting depth, parameter count — from the syntax tree of changed files.                                                                                   |
| **Hygiene**      | `console.log`/`debugger` left in, `.env` or key files committed, merge conflict markers, oversized changes, source changed without tests.                                                         |
| **Repo health**  | Missing CI, tests, README, licence, `.gitignore`, or lockfile.                                                                                                                                    |

## What the AI layer adds

Optional. Scoped to what rules cannot express, and clearly separated from them.

- **Logic review** — off-by-one errors, inverted conditions, unhandled nulls, missing
  edge cases. It is told what the engine already found so it does not repeat it.
- **Code optimisation** — rewrites a slow file and explains each change, with
  preserving observable behaviour as a hard requirement.
- **A repository assistant** — streams replies, and reads real source: type `@` to
  attach up to five files and it answers from their contents, not from filenames.

Findings are labelled **AI** with a confidence score. A rule that matched is a fact; a
model's opinion is not, and the interface never presents them as equivalent.

---

## Quick start

**Prerequisites:** Node.js 20.9 or newer.

```bash
git clone https://github.com/Ayush3422/REVISEHUB.git
cd REVISEHUB
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>. **It works immediately with an empty `.env.local`** —
just at GitHub's 60 requests/hour anonymous limit.

| Variable         | Required         | Purpose                                                                                                           |
| ---------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| `GITHUB_TOKEN`   | Recommended      | Raises the GitHub limit from 60/hour to 5,000. A fine-grained token with public repository read access is enough. |
| `GEMINI_API_KEY` | AI features only | [Get one free](https://aistudio.google.com/apikey). Everything else works without it.                             |
| `GEMINI_MODEL`   | No               | Defaults to `gemini-3.5-flash`.                                                                                   |

### Bring your own key

Visitors can supply their own Gemini key from the sidebar. It lives in `sessionStorage`,
is cleared when the tab closes, and is never persisted or logged server-side. A
user-supplied key takes precedence, so a public demo does not spend the owner's quota.

### Scripts

| Command                       | Does                                             |
| ----------------------------- | ------------------------------------------------ |
| `npm run dev`                 | Development server                               |
| `npm run build` / `npm start` | Production build and serve                       |
| `npm run verify`              | Typecheck, lint, test, build — what CI would run |

### Keyboard

| Shortcut                                      | Does                                                        |
| --------------------------------------------- | ----------------------------------------------------------- |
| <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>K</kbd> | Command palette — jump between sections, fuzzy-search files |
| <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>J</kbd> | Open the assistant                                          |
| `@` in the composer                           | Attach a file so the assistant reads its contents           |

---

## Architecture

```
app/
  page.tsx                      Landing page and repository input
  r/[owner]/[repo]/
    pulls/  pulls/[number]/     Pull request list · diff viewer + findings
    efficiency/                 Efficiency grade + AI optimizer
    security/                   Dependency CVEs + repository health
    dashboard/                  Contributor, churn and velocity charts
    analysis/  files/           AI assessment · file tree and viewer
  api/
    analysis/*                  Deterministic engine (no key)
    ai/*                        Review · analyse · chat · stream · optimize
    github/*                    File contents and tree
lib/
  analysis/
    types.ts                    Finding schema, shared by both engines
    engine.ts                   Rule orchestration
    rules/                      secrets · dependencies · efficiency ·
                                complexity · hygiene · repo-health
  ai/provider.ts                Provider interface + Gemini implementation
  github/                       GitHub API client and data layer
  diff.ts                       Unified diff parser
tests/                          Vitest suites for the parser and rules
```

### Where secrets live

`lib/env.ts`, `lib/github/`, and `lib/ai/` all import the `server-only` package. If any
is ever imported from a Client Component, **the build fails** rather than shipping a key
to the browser. No secret uses the `NEXT_PUBLIC_` prefix, because that prefix is exactly
what inlines a value into client JavaScript.

### The analysis engine never executes your code

Parsing uses `ts.createSourceFile`, which builds a syntax tree and nothing more. No
module from the target repository is loaded, and none of its configuration is read.

This is deliberate. Running a repository's own ESLint or build config would mean
executing arbitrary code from a stranger's repository on the server. It is also why
efficiency is **detected, not measured** — benchmarking would require running the code.
A clean report means "no known slow pattern was found", not "this code is fast", and the
interface says so.

### GitHub request budget

The dashboard is built from GitHub's precomputed `/stats/*` endpoints — three requests
regardless of repository size. The pull request list is one. Those endpoints return
`202` with an empty body while GitHub warms its cache; the app reports that state rather
than rendering zeroes as though they were measurements.

---

## Engineering decisions

Three problems found while building this, and what they changed.

**A secret scanner that returns "clean" is worse than none.** The scanner initially only
knew Google's classic `AIza…` key format. Google also issues keys shaped `AQ.…`, and
those passed straight through. Not a false positive anyone would notice — a clean result
that reads as an all-clear. Fixed, with regression tests for both formats.

**A noisy analyser gets switched off.** The efficiency rules graded a well-written
open-source file **F/0** — but three of five findings were `path.indexOf('/')`, a
fixed-substring search on a short string, not the quadratic collection lookup the rule
exists for. Restricting it to non-literal arguments on non-string receivers moved the
same file to **C/60** with only the genuine issues.

**Colour must be measured, not eyeballed.** Every foreground token was checked against
the _composited_ glass surface — white at 6% over `#0A0F1E` renders as `#191D2C` — not
the page background, because glass lightens what sits under it and a ratio taken on the
raw background overstates the real one. That moved `muted` from the conventional
`#64748B`, which fell to 3.5:1 and would have failed AA for body text, to `#7A879E` at
4.6:1.

---

## Testing

```bash
npm run verify
```

68 tests across the diff parser and every rule group, including deliberate
false-positive controls — a rule that fires on the wrong thing is tested for as
carefully as one that fires on the right thing.

---

## Current limitations

Stated plainly rather than discovered later:

- **Public repositories only.** There is no sign-in.
- **Nothing is persisted.** Findings are computed per request; chat history lives in
  `sessionStorage` for the browser session.
- **AST analysis covers JavaScript and TypeScript.** Other languages still get secret
  detection, dependency scanning, diff hygiene, and repository health.
- **Dependency scanning supports npm.** Other ecosystems are not read yet.
- **Rate limiting is per server instance** and resets on redeploy. It stops one client
  looping an expensive call; it is not a shared limiter.
- **The AI can be wrong.** Its findings are a starting point for review, not a verdict —
  which is why they are labelled separately from the engine's.

## Roadmap

1. **Persistence and accounts** — Postgres, GitHub OAuth, saved and shareable reviews.
2. **Webhooks** — review every new pull request automatically and post a status check.
3. **More ecosystems** — PyPI, Go modules, Maven for dependency scanning.
4. **Repository-aware chat** — embeddings so the assistant can answer from any file
   without being handed one.

---

## License

[MIT](LICENSE)
