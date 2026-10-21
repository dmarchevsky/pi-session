# dev-flow

<!-- Operator-owned playbook. Regenerate with: flow init --draft -->

## global

```flow
defaultBranch = main
forge = github
```

## plan

- [ ] rendered mockups attached for every changed screen

<!-- what the plan must contain, UI expectations -->

## implement

```flow
test = bun test
```

<!-- optional tier-1: add a flow-check 'health' block once the app exposes a health endpoint -->

- [ ] app runs locally with real data; visual pass: no overflows or stray scrollbars

<!-- tier-3: standing guidance for this stage -->

## pre-release

<!-- e.g. review policy, docs expectations, who picks the version -->

```flow
versionFile = package.json
versionTag = v{version}
```

package.json is the single version source — the release bump, the tag and `pi list`/`pi update` all read the same file; never add a separate VERSION file.

## release

<!-- e.g. PR/merge/tag policy, who publishes artifacts -->
