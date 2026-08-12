# ReviseHub

Code review for public GitHub repositories. It finds problems in pull requests,
dependencies, and repository structure — and **works with no API key at all**.

Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Recharts, and an optional
Google Gemini layer.

---

## ⚠️ If you ran an earlier version of this project, rotate your keys

Before this rewrite, `GEMINI_API_KEY` and `VITE_GITHUB_TOKEN` were compiled into the
browser bundle, so anyone who loaded the site could read them from DevTools. If that
version was ever deployed or shared:

1. Revoke and regenerate your Gemini key at <https://aistudio.google.com/apikey>
2. Revoke and regenerate your GitHub token at <https://github.com/settings/tokens>

Both are now server-side only and are never sent to the browser.

---

## Two engines, one of which needs no key

```
                ┌─> Analysis engine  (deterministic, no key)  ─┐
GitHub data ────┤                                              ├──> findings
                └─> AI layer         (Gemini, optional)       ─┘
```

The engine always runs. The AI layer enhances it when a key is available, and steps
aside when it is not.

### The engine — deterministic rules, no key

Same input, same output, every time. Findings are labelled **Verified rule** in the UI.

| Rule group | Finds |
| --- | --- |
| **Secrets** | AWS, Google, GitHub, Slack, Stripe, OpenAI, Anthropic keys, JWTs, private keys, and database URLs with passwords, added in a diff. The matched value is always redacted. |
| **Dependencies** | Known CVEs in `package.json` via [OSV.dev](https://osv.dev) — real advisory IDs, severity, and fixed versions. Dev dependencies are ranked lower than runtime ones. |
| **Hygiene** | `console.log`/`debugger` left in, `.env` or key files committed, merge conflict markers, TODO markers, oversized changes, source changed without tests. |
| **Complexity** | Cyclomatic complexity, function length, nesting depth, parameter count — from the syntax tree of changed JS/TS files. Test, generated, and vendored files are excluded. |
| **Repo health** | Missing CI, tests, README, licence, `.gitignore`, or lockfile. |

### The AI layer — optional

Scoped to what rules cannot express: logic errors, inverted conditions, unhandled
nulls, missing edge cases, API misuse. It is told what the engine already found so it
does not repeat it. Findings are labelled **AI** with a confidence score, and are never
presented as equivalent to a verified rule.

---

## Getting started

**Prerequisites:** Node.js 20.9 or newer.

```bash
npm install
```

```bash
cp .env.example .env.local
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `GITHUB_TOKEN` | Strongly recommended | Raises the GitHub API limit from 60 requests/hour to 5,000. A fine-grained token with public repository read access is enough. |
| `GEMINI_API_KEY` | Only for AI features | [Get one here](https://aistudio.google.com/apikey). Without it, everything except the AI layer still works. |
| `GEMINI_MODEL` | No | Defaults to `gemini-2.5-flash`. |

```bash
npm run dev
```

Open <http://localhost:3000>.

### Bring your own key

Visitors can supply their own Gemini key from the sidebar. It is held in
`sessionStorage`, cleared when the tab closes, sent as a request header to this app's
own API routes, and never persisted or logged server-side. A user-supplied key takes
precedence over the server's, so a deployed demo does not burn the owner's quota.

### Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npm run verify` | All four, in order — what CI runs |

---

## Architecture

```
app/
  page.tsx                          Landing page and repository input
  r/[owner]/[repo]/
    pulls/                          Pull request list
    pulls/[number]/                 Diff viewer + findings panel
    security/                       Dependency CVEs + repo health
    dashboard/                      Contributor, churn, velocity charts
    analysis/                       AI project assessment
    files/                          File tree and viewer
  api/
    analysis/pull                   Engine (no key)
    ai/review · ai/analyze · ai/chat
    github/file
lib/
  analysis/
    types.ts                        Finding schema, shared by both engines
    engine.ts                       Rule orchestration
    rules/                          secrets · hygiene · complexity · dependencies · repo-health
  ai/provider.ts                    Provider interface + Gemini implementation
  github/                           GitHub API client and data layer
  diff.ts                           Unified diff parser
tests/                              Vitest suites for the parser and rules
```

### Where secrets live

`lib/env.ts`, `lib/github/`, `lib/ai/`, and the dependency rule all import the
`server-only` package. If any is ever imported from a Client Component, the build fails
rather than shipping a key to the browser.

### Safety of the analysis engine

Complexity analysis uses `ts.createSourceFile`, which parses text into an AST and
nothing more. **No code from the target repository is executed, and none of its
configuration is loaded.** This is deliberate: running a repository's own ESLint or
build config would mean executing arbitrary code from a stranger's repository on the
server.

### GitHub request budget

The dashboard is built from GitHub's precomputed `/stats/*` endpoints — three requests
regardless of repository size. The pull request list is one request. Those endpoints
return `202` with an empty body while GitHub warms its cache; the app says so rather
than rendering zeroes as though they were measurements.

---

## Cost

| Piece | Cost |
| --- | --- |
| Vercel Hobby hosting | Free (non-commercial use) |
| GitHub API | Free |
| OSV.dev vulnerability database | Free, no account |
| The whole analysis engine | Free, no key |
| Gemini | Free tier, and entirely optional |

---

## Current limitations

- **Public repositories only.** There is no sign-in.
- **Nothing is persisted.** Findings are computed per request; chat history is lost on
  refresh.
- **Complexity analysis covers JavaScript and TypeScript.** Other languages still get
  secrets, hygiene, dependency, and repo-health rules.
- **Dependency scanning covers npm**, and reads versions from `package.json`, so the
  version actually installed may differ from the one checked.
- **The chat assistant sees the file listing and README, not file contents.** It is
  prompted to say so rather than guess.
- **AI reviews are diff-only**, capped at ~80,000 characters. Skipped files are listed
  rather than silently dropped.
- **Rate limiting is per server instance** and resets on redeploy.

---

## Roadmap

1. **Persistence and accounts** — Postgres, GitHub OAuth, saved and shareable reviews.
2. **More rules** — tree-sitter grammars for Python, Go, and Java; SQL injection and
   unsafe-eval patterns; licence compatibility.
3. **Agentic AI review** — tool use so the model can read files on demand instead of
   working from the diff alone.
4. **Automation** — webhooks to review new pull requests and post findings back to
   GitHub as a status check.
5. **Applicable fixes** — turn a suggested patch into a real pull request.
