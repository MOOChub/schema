# MOOChub Schema

This repository contains specifications for data exchange between MOOC
providers participating in the [MOOChub](https://moochub.org). The published v4
specification defines a paginated JSON:API catalog for exchanging courses,
programs, credentials, persons, organizations, and locations.

## Important: v3 sunset

By the end of February 2027, all providers must be able to deliver a [v4 feed](4.0.0/schemas/api/catalogFeed.json). At the
end of March 2027, the MOOChub.org client will stop accepting [v3 feeds](moochub-schema.json).

## Specification

The current published specification is the
[latest release (v4.0.0)](latest/index.html). Use it as the reference for
implementing the current v4 API. The versioned
[4.0.0 release](4.0.0/index.html) is a fixed snapshot. The
[draft](draft/index.html) is where changes for a future release are developed;
it may change and should not be treated as a published release.

The published specification documents the resource types, pagination rules, and
harvesting behavior in its [JSON:API catalog section](latest/index.html#catalog).
A complete feed example is available in
[examples/catalog/valid/catalog.json](latest/examples/catalog/valid/catalog.json).
API version negotiation and sunset behavior are described in the
[API versioning section](latest/index.html#api-versioning).

## Releases

Published releases are tagged in this repository. The
[latest finalized release](https://github.com/moochub/schema/releases/latest)
is also available through the `latest/` path; versioned paths such as `4.0.0/`
remain fixed snapshots. Releases follow
[semantic versioning](https://semver.org).

## Contributions

The schema is mainly driven by the
[MOOChub organization and their partners](https://moochub.org/partners/).
Therefore, it is designed to provide a consistent and uniform mechanism to
transport required information between the partners. We will evolve the schema
based on requirements introduced by partners and consumers. Additional
contributions to the schema are welcome and will be considered for an upcoming
release. Please create an issue or a pull request to start contributing!

## Contact

If you have further questions or would like to get listed in the
[MOOChub](https://moochub.org) using an endpoint following this schema, please
drop us a mail at <office@moochub.org>.
