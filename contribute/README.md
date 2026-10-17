# Community Contributions

This document describes the community evaluation system planned for AnimeSelect, including the evaluation criteria, submission format, validation process, and review procedure.

## Purpose

AnimeSelect uses descriptive characteristics to identify similarities between anime that are not adequately represented by genre labels alone.

Community contributions provide structured evaluations of these characteristics. Multiple assessments can be combined to build a more comprehensive catalog while accounting for differences in contributor confidence.

Contributions are subject to validation and maintainer review before they are incorporated into the catalog.

## Evaluation Criteria

Contributors can evaluate nine characteristics. Each uses five descriptive levels, ordered from the lowest to the highest intensity or prominence for the characteristic in question.

| Criterion | Description |
|---|---|
| Art direction | The distinctiveness of the anime's overall artistic direction. |
| 3D usage | The prominence of 3D animation in the work. |
| Character design | The distinctiveness and level of detail of character designs. |
| Animation | The fluidity and overall execution of animation. |
| Mood | The overall brightness or darkness of the work. |
| Pacing | The rhythm at which events and information unfold. |
| Narrative complexity | The complexity of the narrative structure. |
| Emotional intensity | The intensity of the emotions conveyed. |
| Fan service | The presence and prominence of fan service. |

The interface uses descriptive labels rather than numerical values.

The mood criterion refers specifically to brightness or darkness. It is distinct from the optional mood tags, which describe the broader atmosphere of an anime.

Fan service is collected as a catalog characteristic for filtering purposes; it is not used to calculate similarity scores.

## Mood Tags

Contributors may assign up to four mood tags to describe an anime's atmosphere.

Tags are selected from the project's predefined taxonomy. They complement the detailed evaluations and are not a substitute for them.

The catalog retains tags according to a configured community agreement threshold.

## Confidence

Contributors can indicate their confidence in each evaluation:

- `certain` — full contribution weight.
- `mitigated` — reduced contribution weight.
- No evaluation — the criterion is omitted.

Contributors should leave a criterion unanswered when they cannot assess it reliably. An unanswered criterion is not interpreted as a negative evaluation.

## Submission Process

The planned submission workflow is as follows:

1. Search for an anime using AniList.
2. Select the relevant title and complete any applicable evaluations.
3. Optionally select up to four mood tags.
4. Submit the suggestion through GitHub.
5. Allow automated validation and maintainer review to take place.

At least one criterion must be evaluated to submit a contribution.

For individual suggestions, the workflow prepares a GitHub Issue containing structured JSON. For multiple suggestions, the workflow generates a JSON file that can be attached to the issue.

The contribution interface is designed to work without an AnimeSelect account.

## Contribution Format

Submissions use a versioned JSON structure. A simplified example follows:

```json
{
  "schema": 1,
  "contributions": [
    {
      "anilist_id": 12345,
      "ratings": {
        "art_direction": {
          "level": 4,
          "confidence": "certain"
        },
        "animation": {
          "level": 3,
          "confidence": "mitigated"
        }
      },
      "mood_tags": ["mysterious", "stylish"]
    }
  ]
}
```

The example is illustrative; the AniList identifier must correspond to a valid anime.

The format has the following constraints:

- Only the nine defined evaluation criteria are accepted.
- Levels range from 1 to 5.
- Confidence must be `certain` or `mitigated` when a rating is present.
- Omitted criteria represent no evaluation.
- Mood tags must be unique, valid taxonomy entries, with no more than four tags per anime.
- A submission contains between one and twenty contributions, with no duplicate AniList identifiers.

The schema version allows the contribution format to evolve in a controlled manner.

## Validation and Review

Automated validation checks the submission structure, allowed criteria, rating values, mood tags, contribution count, and AniList identifiers.

Valid submissions are marked for review. Invalid submissions are rejected with feedback describing the detected errors.

A trusted maintainer must approve a contribution before it is incorporated into the catalog. Approval triggers the catalog update workflow.

Validation establishes that a submission conforms to the expected format; it does not establish that an evaluation is objectively correct.

## Aggregation

Community evaluations are stored separately from the generated anime catalog.

For each criterion, the catalog combines available ratings using a confidence-weighted median. If the cumulative weight falls exactly between two levels, the resulting value is the mean of those adjacent levels.

The resulting catalog records the combined value and the number of votes. Criteria without evaluations remain unassessed.

Low vote counts are identified separately so that limited agreement is not mistaken for strong consensus.

Mood tags are retained when their share of eligible contributions reaches the configured agreement threshold.

## Data Sources and Storage

AniList provides anime identifiers and metadata. Community evaluations are stored independently from catalog metadata and combined during catalog generation.

The generated catalog is the data source consumed by the recommendation application.

The contribution workflow uses GitHub Issues for submissions and GitHub Actions for automated validation and catalog processing.

## Privacy and Attribution

The submission workflow does not require an AnimeSelect account. Draft evaluations are intended to be stored locally in the contributor's browser.

GitHub Issues may be publicly accessible. Contributors should not include personal or sensitive information in submissions.

The contribution data format does not include contributor names or submission dates as fields within individual evaluation records. GitHub may nevertheless associate a submission with the contributor's account.

## Scope

The contribution system is intended to provide structured evaluation, automated validation, maintainer review, and reproducible catalog generation.

It does not currently define contributor rankings, public contributor profiles, a separate account system, or automatic approval of submissions.

## Contributing

Before submitting an evaluation, review the criteria and their definitions carefully. Evaluate only characteristics you can assess, use confidence levels honestly, and leave unknown values unanswered.

The aim is to build a consistent and useful catalog, not to establish a universal ranking of anime.