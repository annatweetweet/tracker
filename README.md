# Anna's Money Tracker ~ AGB

Personal monthly expense tracker built with Hugo 0.160.1 Extended.

## Stack

- Hugo 0.160.1 Extended (Hugo Pipes for SCSS)
- SCSS (Dart Sass via Hugo Extended)
- Vanilla JS (no framework)
- Google Fonts: Unbounded + Albert Sans
- Netlify deployment

## Local Development

```bash
# Clone and run
hugo server -D

# Production build
hugo --gc --minify
```

Hugo Extended is required for Dart Sass / SCSS compilation via Hugo Pipes.

## Deploy

Push to your connected Git repo. Netlify picks up `netlify.toml` automatically:

- Build command: `hugo --gc --minify`
- Publish directory: `public`
- Hugo version: `0.160.1`
- Node version: `24`

## Project Structure

```
agb-money-tracker/
├── assets/
│   ├── js/
│   │   └── tracker.js          # All tracker interactivity
│   └── scss/
│       ├── main.scss           # Entry ~ imports all partials
│       ├── _tokens.scss        # Colors, fonts, spacing
│       ├── _base.scss          # Reset, body, utility classes
│       ├── _tracker.scss       # Layout, header, month nav, sections
│       ├── _summary.scss       # Summary bar
│       ├── _form.scss          # Add expense form
│       ├── _expense-list.scss  # Expense log items
│       └── _cat-chart.scss     # Category breakdown bars
├── content/
│   └── _index.md
├── layouts/
│   ├── _default/
│   │   ├── baseof.html         # Base template with Hugo Pipes
│   │   └── single.html
│   ├── partials/
│   │   └── tracker.html        # Full tracker UI markup
│   └── index.html
├── hugo.toml
├── netlify.toml
└── .gitignore
```

## Data

Expenses are stored in `localStorage` under the key `agb_expenses`. No backend required.
