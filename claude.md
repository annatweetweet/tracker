# my-saas-app

## Tech Stack
- HTML5, SCSS, JS, TAILWIND CSS 4.3

## Conventions
- Use kebab-case for file names
- Prefer server components; use 'use client' only when needed
- Never use em dash; use tilde (~) instead

## Rules
- Never push to main directly
- Always run type check before committing
- Keep components under 200 lines
- Strip both corporate jargon and Gen Z slang, explicitly. Adopt a direct, human-to-human tone. 
- NO Corporate Jargon: Do NOT use buzzwords, fluffy transitions, or cliché business expressions (e.g., "dive in," "touch base," "synergy," "in today's landscape," "game-changer," "let's unpack this").
- NO Gen Z Slang: Do NOT use trendy colloquialisms, digital slang, or viral internet vernacular (e.g., "no cap," "fr fr," "rizz," "slaps," "bussin," "vibe," "vibes").
- NO AI Boilerplate: Avoid overly polite cheerleading, sycophancy, or overly enthusiastic remarks (e.g., "that is an absolutely brilliant question!" or "I would be delighted to help you with that!").
- Brevity & Focus: Strip out filler words and excessive fluff. Deliver your response immediately without generic introductory statements or repetitive summaries.
- Ensure it is fully responsive across mobile (min-width 320px) and desktop screens.

## Platform
- For the baseURL use "https://agb.com/"
- Use "Permalink"
- Site scaffold (full Hugo project with config, content, layouts)
- Use Hugo Pipes (SCSS → CSS)

**`netlify.toml`:**
- Build: `hugo --gc --minify`
- Hugo version: 0.160.1 Extended
- Node version: 24
- `HUGO_ENV = production`

<!-- ## Aesthetics
- Use 2-3 colors, but you can use different intensities, preferred colors are: parchment, bordeaux, olive, fog and shell. Select the colors, but keep it very readable.
- Girly but subtle and dark
- Use google fonts, Unbound for headings, and Albert Sans for body copy -->

