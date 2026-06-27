Snapshot testing for demo UI

How to run locally:

```bash
cd demo
npm ci
npm test
```

To update snapshots:

```bash
cd demo
npm test -- -u
```

CI runs snapshot tests on pushes and pull requests affecting `demo/`.
