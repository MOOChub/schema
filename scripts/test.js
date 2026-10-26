const fs = require('node:fs')
const path = require('node:path')
const Ajv2020 = require('ajv/dist/2020')
const crypto = require('node:crypto')
const draft7MetaSchema = require('ajv/dist/refs/json-schema-draft-07.json')
const addFormats = require('ajv-formats')
const { runJsonLdTests } = require('./jsonld-context-test')

const projectRoot = __dirname
const schemasDirectory = path.join(projectRoot, '../draft/schemas')
const cacheDirectory = path.join(projectRoot, '../.cache', 'remote-schemas')
const readJson = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'))
const invalidExpectations = readJson(
  path.join(projectRoot, '../scripts/invalid-expectations.json')
)
const green = (text) => `\x1b[32m${text}\x1b[0m`
const yellow = (text) => `\x1b[33m${text}\x1b[0m`
const red = (text) => `\x1b[31m${text}\x1b[0m`

function cachedSchemaFilename(uri) {
  const hash = crypto.createHash('sha256').update(uri).digest('hex')
  return path.join(cacheDirectory, `${hash}.json`)
}

async function loadRemoteSchema(uri) {
  const cacheFile = cachedSchemaFilename(uri)
  try {
    return readJson(cacheFile)
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error
  }

  const response = await fetch(uri)
  if (!response.ok) {
    throw new Error(
      `Unable to load schema ${uri}: ${response.status} ${response.statusText}`
    )
  }
  const schema = await response.json()
  fs.mkdirSync(cacheDirectory, { recursive: true })
  fs.writeFileSync(cacheFile, `${JSON.stringify(schema, null, 2)}\n`)
  return schema
}

const ajv = new Ajv2020({
  loadSchema: loadRemoteSchema,
  allErrors: true,
  strict: false,
})
ajv.addMetaSchema(draft7MetaSchema)

for (const filename of fs.readdirSync(schemasDirectory, { recursive: true })) {
  if (!filename.endsWith('.json')) continue
  const schemaFile = path.join(schemasDirectory, filename)
  ajv.addSchema(readJson(schemaFile))
}
addFormats(ajv)

function resolveSchema(schema) {
  if (!schema?.$ref) return schema
  return ajv.getSchema(schema.$ref)?.schema ?? schema
}

function schemaBranches(schema) {
  const resolved = resolveSchema(schema)
  return [
    resolved,
    ...(resolved?.allOf ?? []).flatMap(schemaBranches),
    ...(resolved?.anyOf ?? []).flatMap(schemaBranches),
    ...(resolved?.oneOf ?? []).flatMap(schemaBranches),
  ]
}

function findUnexpectedProperties(value, schema, instancePath = '') {
  const issues = []
  const branches = schemaBranches(schema)
  if (Array.isArray(value)) {
    const itemSchemas = branches.flatMap((branch) =>
      branch.items ? [branch.items] : []
    )
    value.forEach((item, index) => {
      for (const itemSchema of itemSchemas) {
        issues.push(
          ...findUnexpectedProperties(
            item,
            itemSchema,
            `${instancePath}/${index}`
          )
        )
      }
    })
    return issues
  }
  if (!value || typeof value !== 'object') return issues

  const properties = new Map()
  for (const branch of branches) {
    for (const [name, propertySchema] of Object.entries(
      branch.properties ?? {}
    )) {
      properties.set(name, propertySchema)
    }
  }
  if (properties.size > 0) {
    for (const [name, child] of Object.entries(value)) {
      if (!properties.has(name)) {
        issues.push(`${instancePath}/${name}`)
      } else {
        issues.push(
          ...findUnexpectedProperties(
            child,
            properties.get(name),
            `${instancePath}/${name}`
          )
        )
      }
    }
  }
  return issues
}

function reportFailure(failures, message) {
  failures.push(message)
}

function errorSignatures(errors) {
  return [
    ...new Set(
      (errors ?? []).map((error) => `${error.keyword}:${error.instancePath}`)
    ),
  ].sort()
}

async function main() {
  let passed = 0
  let failed = 0
  const failures = []

  for (const suite of [
    {
      rootSchema: '../draft/schemas/course.json',
      directories: [
        ['../draft/examples/course/valid', true],
        ['../draft/examples/course/invalid', false],
      ],
    },
    {
      rootSchema: '../draft/schemas/api/catalogFeed.json',
      directories: [
        ['../draft/examples/catalog/valid', true],
        ['../draft/examples/catalog/invalid', false],
      ],
    },
    {
      rootSchema: '../draft/schemas/program.json',
      directories: [
        ['../draft/examples/program/valid', true],
        ['../draft/examples/program/invalid', false],
      ],
    },
  ]) {
    const rootSchema = readJson(path.resolve(projectRoot, suite.rootSchema))
    const validate = await ajv.compileAsync({ $ref: rootSchema.$id })

    for (const [directory, expected] of suite.directories) {
      for (const filename of fs.readdirSync(
        path.join(projectRoot, directory)
      )) {
        if (!filename.endsWith('.json')) continue
        const data = readJson(path.join(projectRoot, directory, filename))
        const actual = validate(data)
        if (actual !== expected) {
          reportFailure(
            failures,
            `${directory}/${filename} was expected to be ${
              expected ? 'valid' : 'invalid'
            }: ${ajv.errorsText(validate.errors)}`
          )
          process.exitCode = 1
          failed++
        } else {
          if (!expected) {
            const expectationPath = path.relative(
              path.join(projectRoot, '../draft/examples'),
              path.join(projectRoot, directory, filename)
            )
            const expectedErrors = invalidExpectations[expectationPath]
            const actualErrors = errorSignatures(validate.errors)
            if (
              !expectedErrors ||
              JSON.stringify(actualErrors) !==
                JSON.stringify([...expectedErrors].sort())
            ) {
              reportFailure(
                failures,
                `${directory}/${filename} has unexpected validation errors. Expected: ${
                  expectedErrors?.join(', ') ?? 'none'
                }; actual: ${actualErrors.join(', ')}`
              )
              failed++
              continue
            }
          }
          if (expected) {
            let unexpected = findUnexpectedProperties(data, rootSchema)
            if (suite.rootSchema.endsWith('api/catalogFeed.json')) {
              unexpected = []
              for (const resource of data.data) {
                const attributesSchema = readJson(
                  path.resolve(
                    projectRoot,
                    resource.type === 'programs'
                      ? '../draft/schemas/program.json'
                      : '../draft/schemas/course.json'
                  )
                )
                unexpected.push(
                  ...findUnexpectedProperties(
                    resource.attributes,
                    attributesSchema,
                    `/data/${data.data.indexOf(resource)}/attributes`
                  )
                )
              }
            }
            if (unexpected.length > 0) {
              console.warn(
                `${yellow(
                  'Warning:'
                )} ${directory}/${filename} contains properties not defined in the schema: ${unexpected.join(
                  ', '
                )}`
              )
            }
          }
          console.log(`${green('✓')} ${directory}/${filename}`)
          passed++
        }
      }
    }
  }

  const jsonLdResult = await runJsonLdTests()
  if (jsonLdResult.failures.length > 0) {
    for (const error of jsonLdResult.failures) {
      reportFailure(failures, `JSON-LD validation failed: ${error}`)
    }
    failed++
  } else {
    console.log(`${green('✓')} JSON-LD examples (${jsonLdResult.checked})`)
    passed++
  }

  console.log(`\nValidation completed. Passed: ${passed}, Failed: ${failed}`)
  if (failures.length > 0) {
    console.error(`\n${red('Failures:')}`)
    for (const failure of failures) console.error(`- ${failure}`)
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
