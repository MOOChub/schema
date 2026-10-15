# MOOChub v3 to v4 Migration Guide

This guide is the operational companion to the [v4 changelog](changelog.md).
It is organized around provider work: transport, resource identity, field
conversion, new resource types, and verification. The schema files remain the
normative source when this guide and an implementation disagree.

## 1. Transport and catalog

| v3 | v4 | Provider action | Verify |
| --- | --- | --- | --- |
| Course resources in `data` | A JSON:API catalog in `data` | Return `application/vnd.api+json`; use resource `type` `courses`, `programs`, or another supported type. | Validate the complete document against `<release_version>/schemas/api/catalogFeed.json`. |
| Provider/API `id` | JSON:API `data[].id` plus semantic `attributes.id` | Keep the JSON:API ID provider-local and stable. Give the semantic object a stable URI when available. | IDs are non-empty, never reused, and `(type, attributes.id)` identifies one entity. |
| One implicit course collection | Paginated catalog | Implement `page[number]`, `page[size]`, optional `filter[type]`, and pagination links. | `links.self` is present; `next`/`prev` are `null` at the ends; page ordering is stable. |
| No defined harvesting contract | Incremental harvesting | Update `dateModified` whenever the published resource changes. Document deletion behavior. | A harvester can follow `links.next` and detect changes without relying on array order. |

The JSON:API resource ID and the semantic JSON-LD ID are different identifiers.
They may be equal, but providers must not assume that they are interchangeable.

## 2. Course field conversion

| v3 property | v4 representation | Migration decision |
| --- | --- | --- |
| `name` | `name` | Migrate to the v4 localized string shape. Now requires at least one language entry. |
| `description` | `description` | Convert to the v4 rich-text shape, declare the language and format (e.g., `text/html` or `text/markdown`). May now include mutiple entries for different languages or formats. |
| `url` | `url` | Preserve the detail URL; it must be a URI and use HTTPS. |
| `license` | `license` | `license` is one object, not an array. |
| `image` | `image` | Only provide a single `license` object. |
| `trailer` | `trailer` | Only provide a single `license` object. `type` may now be either `VideoObject` or `AudioObject`. Instead of `contentUrl` one may now use `embedUrl`, if the provider supports embedding. |
| `Person.url`, `Organization.url` | `sameAs` | Convert to an array of URLs for social media, homepages, and other references. |
| `workload` | `timeRequired` | Convert the h/timeframe representation to an approximate total ISO 8601 duration. |
| `duration` | `CourseInstance.duration` | Move it to the relevant instance. |
| `access` | `isAccessibleForFree` and `conditionsOfAccess` | Map free/paid to the boolean. Move member, student, login, or enrollment details into `conditionsOfAccess`. |
| `courseMode` | `CourseInstance.courseMode` | Move it to the relevant instance. Values are `online`, `onsite`, `blended`, `synchronous`, or `asynchronous`. |
| `startDate`, `endDate` | Course instance or event dates | Move offering dates to `CourseInstance`; use `subEvent` for event or phase dates. Use a Schdule resource for regular recurring events in a single instance. |
| `applicationStartDate`, `applicationDeadline` | Course instance dates | Move them to the relevant instance. |
| `offers` | `CourseInstance.offers` | Move it to the relevant instance. |
| `teaches` | `teaches` | Convert entries to v4 `Competency` objects and use `relatedSkill`/`proficiencyLevel` where applicable. v3 `teaches` maps to v4 `relatedSkill`, but wrapped in a `Competency` object, allowing natural language competencies to be mapped to defined skills. |
| `hollandCode` | `educationalAlignment` | Create one alignment per code and include the Holland framework and identifier. |
| `educationalAlignment` | `educationalAlignment` | Convert to an `AlignmentObject` with `alignmentType`, `educationalFramework`, and `targetName` or `targetUrl`. |
| `educationalLevel` | `educationalLevel` | Convert to a `Concept` object with `inScheme`, `id`, and `prefLabel`. |
| `contentLocation` | `CourseInstance.location` | Move location data to the offering when it describes where an instance takes place. |
| `audience` | `audience` | Convert to an `Audience` object with `audienceType`, `suggestedAge`, and `description`. New `audience.audienceType` allowed concept ids still match previous `audience` vocabulary, still using the LRMI `audienceType` vocabulary. |
| `learningResourceType` | No v4 course property | No longer required; |

## 3. New resources and relationships

- `hasPart`, `isPartOf`, and `isBasedOn` allows a course to reference other courses, programs, or LearningResource objects. Use `hasPart` for a course with multiple parts, `isPartOf` for a course that is part of a program, and `isBasedOn` for a course that is derived from another course or resource.
- `programs` describe a structured sequence or group of courses. Use
  `hasPart` for program parts and `hasCourse` for course membership.
- `credentials` describe an awarded qualification. Use
  `educationalCredentialAwarded` from a course or program, and use `hasPart`,
  `isPartOf` for credential relationships, and `isAwardedBy` from a credential to the awarding course or program.
- `persons`, `organizations`, and `locations` allow stable shared entities
  instead of repeating full objects in every course, by setting `type`, `id`, and `name` in a compact reference. Use the full object when the entity is not shared.

`courses`, `programs`, `credentials`, `persons`, `organizations`, and `locations` may now also be published independently, with their own `id`, `type`, and JSON-LD `@context`. This allows a provider to publish a catalog of shared entities that can be referenced by multiple courses, programs, or credentials.
Independent publication is optional, but every independently harvestable object
must have a stable semantic ID and matching `type`. Compact references may use
only `id`, `type`, and `name`; they must not erase data already
stored from a full representation.
