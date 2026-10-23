# AnimeSelect

A small anime recommendation site I'm building in my free time.

It started from a frustration: most recommendation sites look at what you liked and send you more of the same genre. You loved a shonen? Here are ten more shonen. I got stuck in isekai that way, and after a while they all felt the same.

AnimeSelect tries something else. Instead of genres, it looks at things like the art direction, the animation, the mood, the pacing or how heavy the story gets. The idea is that two anime from completely different genres can still feel close, and that's exactly the kind of suggestion I'd like to get.

## Where things are

Honestly, it's early days.

- **The anime library** is open. That's the part where people describe anime they've watched, and it's what the recommendations will be built on later. You can help right now (see below).
- **The recommendation site** itself doesn't exist yet. I'll start on it once the library has enough anime in it.

So if you came here looking for recommendations, there's nothing to try yet. Sorry! But you can help make it happen.

## Helping with the library

You don't need to know how to code. You pick an anime you've seen, answer a few questions about it (from 1 to 5, and only the ones you feel sure about), and send it. It's sent as a GitHub issue, so you need a free GitHub account.

  ▶️ **[Open the contribution page](https://sorylokan.github.io/animeselect/contribute/)**

Everything about how it works (the questions, what happens to your answers, who checks them) is explained in **[contribute/README.md](contribute/README.md)**.

## How the recommendations should work

This part is still on paper, so it will probably change once I actually build it.

You'd tell the site a few anime you loved and a few you didn't, and maybe what you're in the mood for tonight. It would then compare that with the library and suggest three kinds of picks:

- **Top match**: the closest to what you like.
- **Outsider**: something a bit less obvious, but with several things you seem to enjoy.
- **Wildcard**: a surprise, but always with at least one clear reason behind it.

Each suggestion should come with the reasons why it was picked, and a warning when the library doesn't know much about that anime yet. No AI or machine learning in there, just rules and scores I can read and adjust.

## What's in this repo

| Folder | What it is |
| --- | --- |
| `contribute/` | The contribution page (plain HTML, CSS and JavaScript). |
| `scripts/` | The small scripts that check new contributions and rebuild the library. |
| `data/` | The library itself: everyone's answers, and the combined result. |
| `.github/workflows/` | The automation that runs those scripts on GitHub. |

## Planned tech

For the recommendation site, I'm currently thinking of React with TypeScript and Vite, hosted for free on GitHub Pages. Nothing is set in stone though: I'm learning as I go, and I may end up with something simpler. The plan is to keep everything in the browser, with no account and no server. Your preferences would stay on your device.

## For developers

You only need Node.js 22 or newer. There are no dependencies to install.

```
npm test              # run the tests
npm run build:library # rebuild data/anime.json from the contributions
```

## License

There's no license yet. I'm still figuring out which one fits best, for the code and for the community data. Until then, feel free to look around and contribute, but please ask before reusing anything.

---

**Note:** I'm not a professional developer, just someone who likes tinkering with websites. This project is heavily assisted by AI (for code, and for writing some of the docs). I make the decisions, check what goes in, and try to understand everything I publish.