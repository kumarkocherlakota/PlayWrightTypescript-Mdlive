# ADR-003: Domain-based modularization with controlled public contracts

- Status: Accepted
- Date: 2026-10-31

## Context

Folder-by-type layouts (`pages/`, `api/`, `utils/`) grow into large, entangled directories in
enterprise applications. Healthcare applications have many distinct capabilities (appointments,
prescriptions, payments, telehealth) that are owned by different teams.

## Decision

- Organize business code under `src/domains/<domain>/` with `models`, `pages`, `components`,
  `api`, `workflows`, `builders`, `schemas`, `validators` as needed.
- Each domain exposes **one** public entry point: `src/domains/<domain>/index.ts`.
- Cross-domain imports and step definitions may only import from a domain's `index.ts`.
- Shared healthcare value types live in `src/domains/shared-kernel/`.
- Generic, domain-agnostic technical capabilities live in `src/core/` (technical) and
  `src/interaction/` (UI/API primitives).
- Boundaries are enforced with `dependency-cruiser` (`npm run arch:check`).

## Alternatives

| Option                                | Why not chosen                                          |
| ------------------------------------- | ------------------------------------------------------- |
| Folder-by-type                        | Low cohesion; changes to one feature touch many folders |
| One npm package per domain (monorepo) | Strong isolation but heavy tooling for a test project   |
| Barrel files without enforcement      | Boundaries erode silently                               |

## Reason

High cohesion per business capability, clear ownership, and a public contract that allows
internal refactoring without breaking other domains.

## Consequences

- New domains are added by copying the domain template (Phase 2+) and exporting a public API.
- Internal files can be renamed freely as long as `index.ts` stays stable.

## Trade-offs

Some duplication of folder skeletons across domains; slight indirection through `index.ts`.
