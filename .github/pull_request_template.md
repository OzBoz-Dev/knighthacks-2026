## Summary

State the problem and the change in two to four sentences.

Commits, in order:

1. 

## Linked issue

Closes #

## Notes for the reviewer

State a known limit, a decision, or a file that needs a close look. Write "None" if there is none.

## Test evidence

Paste each command and its result. If a check fails, name it and say why.

```
```

## Checklist

- [ ] The change stays inside the folders my role owns, or the team agreed to it in the issue.
- [ ] The change keeps the frozen types in `prd.md` section 8, or updates the PRD, the types, and the fixtures together.
- [ ] No key, token, or `.env` file is in the diff.
- [ ] Every data value on screen has an accurate source label (live, Databricks, or saved).
- [ ] The diff holds no emoji and no em dash.
- [ ] The checks for each area I touched pass. The results are in Test evidence.
- [ ] A change to the user interface includes a screenshot.

## Failure path

| Failure | The user sees | The log records | Is a retry safe |
|---|---|---|---|
|  |  |  |  |

Write "No new failure path" when the change adds none.
