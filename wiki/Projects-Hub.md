# Projects Hub

Sonaria's source support comes entirely from plugins. There are three plugin categories (see the
[[Plugin System]] for details):

- **`ExtractorPlugin`** - search and play songs directly from a source.
- **`InfoExtractorPlugin`** - extract metadata from a source that does not provide audio itself.
- **`PlayableExtractorPlugin`** - play songs from a source by URL, without search.

Look for a plugin that implements one of these classes for each service you want to support, and
pass instances to Sonaria:

```ts
const sonaria = new Sonaria(client, {
  plugins: [myPlugin],
});
```

## Writing your own

If no plugin exists for a source, you can write one. See the [[Plugin System]] page for the methods
each plugin class requires, and the [API Documentation](https://sonaria.js.org/) for the full
reference.

## Community projects

Community plugins and other projects are not maintained in this repository. If you have built a
plugin or tool for Sonaria and would like to list it, open an issue or a pull request on
[GitHub](https://github.com/iFluxo/Sonaria).
