# Contributing to the library

Thanks for stopping by! This page explains how you can describe anime for AnimeSelect, and what happens to your answers afterwards.

The library is the heart of the project. The recommendations will only be as good as the anime in it, and I can't rewatch hundreds of shows by myself. That's where you come in.

👉 **[Open the contribution page](https://sorylokan.github.io/animeselect/contribute/)**

## What you'll need

- A free GitHub account (your answers are sent as a GitHub issue).
- An anime you've watched, and remember well enough.

That's it. No coding.

## How it goes

1. Search for an anime. The search uses [AniList](https://anilist.co), so titles, years and pictures come from there.
2. Answer the questions you can. You can skip any of them.
3. If you want, pick up to four mood tags.
4. Send it. The page opens a GitHub issue already filled in; you just have to confirm.

You can describe several anime before sending, up to 20 at once. For a big batch (more than about 7), the page gives you the text to paste into the issue yourself, because the link would get too long.

One thing to know: **an anime means its first season.** Season 2, sequel movies and so on don't get their own entry. When you describe an anime, you can think about the whole show, not just the first season.

## The nine questions

Each question has five answers, going from "very little" to "a lot". The page shows them as words, not numbers.

| Question | What it's about |
| --- | --- |
| Art direction | How distinctive the overall visual style is. |
| 3D usage | How much 3D animation is used. |
| Character design | How distinctive and detailed the characters look. |
| Animation | How smooth and well executed the animation is. |
| Mood | How bright or dark the anime feels overall. |
| Pacing | How fast things happen. |
| Narrative complexity | How complex the story is to follow. |
| Emotional intensity | How strong the emotions are. |
| Fan service | How much fan service there is. |

A few notes:

- **Mood** is only about light versus dark. For the general vibe (cozy, mysterious, melancholic…), that's what the mood tags are for.
- **Fan service** isn't used to find similar anime. It's only there so people can filter it out if they want to.

## How sure are you?

For each answer, you say whether you're **sure** or **not really sure**. Answers you're not sure about still count, just half as much.

And if you don't remember, or can't judge, **just skip the question**. A skipped question is not a bad score, it simply means "no opinion". An honest blank is much more useful than a guess.

## What happens next

1. A small script checks that your issue is in the right format (known questions, answers between 1 and 5, valid tags, real anime, first season only). If something's wrong, it leaves a comment on the issue explaining what.
2. I read it, and approve it if it looks fine.
3. Your answers are added to the library, and the combined results are updated.

The script only checks the format. It can't tell if an answer is "right", and there isn't really a right answer anyway. That's why answers from several people are combined: for each question, the library keeps a kind of middle value of everyone's answers (answers you're sure about weigh more). It also keeps track of how many people answered, so an anime with a single answer isn't treated like a well-known one.

Mood tags are kept when enough of the people who described that anime agree on them.

## Your GitHub name and privacy

Issues on this repo are public, so anyone can see what you sent.

Your GitHub username is saved with your answers. That's what lets you **change your mind later**: if you describe the same anime again, your new answers replace the old ones instead of counting twice.

Please don't put anything personal in the issue.

## For the curious: the format

If you'd rather write the issue by hand, the page needs to find this exact line at the top:

```
<!-- animeselect:library-suggestion -->
```

followed by a JSON block like this one:

```json
{
  "schema": 1,
  "contributions": [
    {
      "anilist_id": 132474,
      "ratings": {
        "pacing": { "level": 2, "confidence": "certain" },
        "mood": { "level": 1, "confidence": "mitigated" }
      },
      "mood_tags": ["melancholic", "cozy"]
    }
  ]
}
```

- `anilist_id` is the number in the anime's AniList address.
- The rating names are: `art_direction`, `three_d_usage`, `character_design`, `animation`, `mood`, `pacing`, `narrative_complexity`, `emotional_intensity`, `fan_service`.
- `level` goes from 1 to 5. `confidence` is `certain` (sure) or `mitigated` (not really sure).
- A skipped question is simply left out.
- Up to 4 mood tags, taken from the list in [`data/taxonomy.json`](../data/taxonomy.json).
- From 1 to 20 anime per issue, each one only once.

If anything in your issue doesn't match this format, the script will leave a comment telling you what to fix.