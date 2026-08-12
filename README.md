# ReviseHub

AI-assisted code review for public GitHub repositories. Point it at a repository to get
pull request reviews, project metrics, and a repository-aware assistant.

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Recharts, and the
Google Gemini API.

---

## ⚠️ If you ran an earlier version of this project, rotate your keys

Before this rewrite, `GEMINI_API_KEY` and `VITE_GITHUB_TOKEN` were compiled into the
browser bundle, so anyone who loaded the site could read them from DevTools. If that
version was ever deployed or shared:

1. Revoke and regenerate your Gemini key at <https://aistudio.google.com/apikey>
2. Revoke and regenerate your GitHub token at <https://github.com/settings/tokens>

Both keys are now server-side only and are never sent to the browser.

---

## Getting started

**Prerequisites:** Node.js 20.9 or newer.

```bash
npm install
```

Copy the example environment file and fill it in:

```bash
cp .env.example .env.local
```

| Variable         | Required             | Purpose                                                                                                                                    |
| ---------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `GEMINI_API_KEY` | For AI features      | [Get one here](https://aistudio.google.com/apikey). Without it, GitHub pages still work and AI features report that they are unconfigured. |
| `GEMINI_MODEL`   | No                   | Defaults to `gemini-2.5-flash`.                                                                                                            |
| `GITHUB_TOKEN`   | Strongly recommended | Raises the GitHub API limit from 60 requests/hour to 5,000. A fine-grained token with public repository read access is enough.             |

Then:

```bash
npm run dev
```

Open <http://localhost:3000>.

### Scripts

| Command             | Does                       |
| ------------------- | -------------------------- |
| `npm run dev`       | Development server         |
| `npm run build`     | Production build           |
| `npm start`         | Serve the production build |
| `npm run typecheck` | `tsc --noEmit`             |
| `npm run lint`      | ESLint                     |
| `npm run format`    | Prettier                   |

---

## Architecture

```
app/
  page.tsx                            Landing page and repository input
  r/[owner]/[repo]/
    layout.tsx                        Sidebar shell; validates the repository exists
    pulls/page.tsx                    Pull request list
    pulls/[number]/page.tsx           Diff viewer + AI review panel
    dashboard/page.tsx                Contributor, churn, and velocity charts
    analysis/page.tsx                 Written project health assessment
    files/page.tsx                    File tree and viewer
  api/
    ai/review    ai/analyze    ai/chat
    github/file
lib/
  env.ts            Validated server environment (server-only)
  github/           GitHub API client and data layer (server-only)
  ai/               Gemini client, review, analysis, chat (server-only)
  diff.ts           Unified diff parser (shared)
  types.ts          Shared types (client-safe)
components/         UI, all presentational
```

### Where secrets live

Every module under `lib/env.ts`, `lib/github/`, and `lib/ai/` imports the `server-only`
package. If any of them is ever imported from a Client Component, the build fails rather
than shipping a key to the browser.

Data reaches the page one of two ways:

- **Server Components** read GitHub directly during render (pull requests, dashboard,
  file tree). No API route, no token in the browser.
- **Route handlers** back the interactive actions the user triggers (AI review, analysis,
  chat, opening a file). These validate input with Zod and are rate limited per IP.

### GitHub request budget

The dashboard is built from GitHub's precomputed `/stats/*` endpoints — three requests
regardless of repository size. The pull request list is one request.

These endpoints are computed asynchronously by GitHub and return `202` with an empty body
the first time a repository is requested. The app detects this and says so, rather than
rendering zeroes as if they were measurements. Reload after a few seconds.

---

## Notes and current limitations

Being explicit about what this does and does not do:

- **Public repositories only.** There is no sign-in, so private repositories are not
  reachable.
- **Nothing is persisted.** Reviews, votes, and chat history live in component state and
  are lost on refresh. Suggestion ratings are labelled as local in the UI.
- **The assistant sees the file listing and the README, not file contents.** It is
  prompted to say so when a question needs code it has not been given, instead of
  guessing.
- **Reviews are diff-only** and capped at roughly 80,000 characters. Files that are
  skipped — binary, or over the budget — are listed in the results panel rather than
  silently dropped.
- **Rate limiting is per server instance** and resets on redeploy. It is enough to stop a
  single client looping an expensive call; it is not a shared limiter.
- The AI can be wrong. Treat findings as a starting point for review, not a verdict.

### Deploying

Deploys to Vercel's free tier as-is. Set `GEMINI_API_KEY` and `GITHUB_TOKEN` as
environment variables in the project settings — not in a committed file.

---

## Roadmap

Completed groundwork is above. Planned next:

1. **Persistence and accounts** — Postgres, GitHub OAuth, saved and shareable reviews.
2. **A stronger review engine** — per-hunk review with surrounding file context, tool use
   so the model can read files on demand, static analysis fed into the prompt, streamed
   output, and applicable fix patches.
3. **Repository-aware chat** — embeddings over the codebase so the assistant can answer
   from file contents.
4. **Automation** — webhooks to review new pull requests automatically and post findings
   back to GitHub.
5. **Testing and observability** — Vitest, Playwright, CI, and error tracking.
