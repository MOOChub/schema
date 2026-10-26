const fs = require('node:fs/promises')
const path = require('node:path')
const jsonld = require('jsonld')

const root = path.resolve(__dirname, '..')
const contextPath = path.join(root, 'draft/context.jsonld')
const examplesRoot = path.join(root, 'draft/examples')
const contextUrl = 'https://w3id.org/moochub/draft/context.jsonld'

function collectContextDocuments(value, relativePath, documents = []) {
  if (!value || typeof value !== 'object') return documents
  if (Array.isArray(value)) {
    for (const item of value)
      collectContextDocuments(item, relativePath, documents)
    return documents
  }
  if ('@context' in value) documents.push({ value, relativePath })
  for (const child of Object.values(value)) {
    collectContextDocuments(child, relativePath, documents)
  }
  return documents
}

async function findValidExamples() {
  const examples = []
  for (const category of ['course', 'catalog', 'program']) {
    const directory = path.join(examplesRoot, category, 'valid')
    for (const filename of await fs.readdir(directory)) {
      if (!filename.endsWith('.json')) continue
      const filePath = path.join(directory, filename)
      const value = JSON.parse(await fs.readFile(filePath, 'utf8'))
      examples.push(
        ...collectContextDocuments(value, path.relative(root, filePath))
      )
    }
  }
  return examples
}

function useLocalContext(value, context) {
  const document = { ...value }
  const contexts = Array.isArray(value['@context'])
    ? value['@context']
    : [value['@context']]
  document['@context'] = contexts.map((entry) =>
    entry === contextUrl ? context : entry
  )
  return document
}

async function runJsonLdTests({ verbose = false } = {}) {
  const contextDocument = JSON.parse(await fs.readFile(contextPath, 'utf8'))
  const context = contextDocument['@context']
  const documents = await findValidExamples()
  const failures = []

  const errors = []

  for (const { value, relativePath } of documents) {
    const document = useLocalContext(value, context)
    try {
      await jsonld.expand(document)
    } catch (error) {
      failures.push(`${relativePath}: ${error.message}`)
    }
  }

  if (errors.length > 0) {
    failures.push(...errors)
  }
  if (verbose) {
    console.log(`JSON-LD-Dokumente geprüft: ${documents.length}`)
    if (failures.length > 0) {
      console.error('\nJSON-LD-Kontextprüfung fehlgeschlagen:')
      for (const failure of failures) console.error(`  - ${failure}`)
    } else {
      console.log('JSON-LD-Kontextprüfung erfolgreich.')
    }
  }
  return { checked: documents.length, failures }
}

async function main() {
  const result = await runJsonLdTests({ verbose: true })
  if (result.failures.length > 0) process.exitCode = 1
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}

module.exports = { runJsonLdTests }
